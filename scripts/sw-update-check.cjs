// Real service-worker upgrade from the shipped v10 shell (main 47c498e, read from Git history), with a synthetic journal.
// Covers the first launch after a deploy (the v10 worker still answers from its cache), the upgrade itself, offline use,
// and how v11 picks up the next release.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { serve, launch, saved, shellFiles, root, MIME, CACHE, V10, NOON } = require('./harness.cjs');
const oldFiles = new Map();
const oldFile = file => { if (!oldFiles.has(file)) oldFiles.set(file, execFileSync('git', ['show', V10 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 })); return oldFiles.get(file); };
const text = buffer => buffer.toString('utf8').split('\r\n').join('\n');
const newWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
let phase = 'v10';        // v10 -> v11 (deploy) -> v12 -> v13 (pretend future releases)

// Invariant behind the file names: anything the v10 worker has cached under the same URL must be byte-identical in v11,
// because that worker answers cache-first until the new one takes over. Changed files got new names.
const oldShell = [...text(oldFile('sw.js')).match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const page11 = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of page11.filter(u => oldShell.includes(u) && /\.(js|css)$/.test(u))) assert.equal(text(fs.readFileSync(path.join(root, url))), text(oldFile(url.slice(2))), url + ' is cached by the v10 worker, so it must not change without a new name');
assert.ok(page11.some(u => !oldShell.includes(u)), 'v11 loads files the v10 worker has never seen');

const handler = (pathname, res) => {
  const send = (body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); return true; };
  if (pathname === '/sw.js') return send(phase === 'v10' ? oldFile('sw.js') : phase === 'v11' ? newWorker : newWorker.replace(CACHE, 'rec-calories-shell-' + phase + '-test'), 'text/javascript');
  if (phase !== 'v10') return false;
  try { const file = pathname === '/' ? 'index.html' : pathname.slice(1); return send(oldFile(file), MIME[path.extname(file)] || 'text/plain'); }
  catch { res.writeHead(404); res.end('missing'); return true; }
};

(async () => {
  const server = await serve(8089, { handler }), browser = await launch();
  try {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(NOON) });
    await page.goto('http://127.0.0.1:8089/'); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v10')), true);
    assert.equal(await page.evaluate(() => typeof window.CHADFavourites), 'undefined', 'this really is the v10 app');
    // Use v10 the way it was used: lunch, water, a habit, a workout set, a saved meal, a journey date, a theme and a key.
    await page.locator('#next-up [data-slot=L][data-tier=S]').click(); await page.waitForTimeout(450); await page.locator('.water-row').click();
    await page.waitForTimeout(450); await page.locator('[data-row=wrap]').click(); await page.locator('#today [data-quest=sleep]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.journeyStartDate = '2026-10-08'; s.arcadeTheme = 'dark'; s.arcadeSound = false; s.questsV5['2026-11-24'].workout = { id: 'pull', start: Date.parse('2026-11-24T11:00:00+09:30'), end: Date.parse('2026-11-24T11:50:00+09:30'), sets: [{ x: 'Pull-ups', kg: 0, reps: 9, at: Date.parse('2026-11-24T11:05:00+09:30') }] }; s.questsV5['2026-11-24'].training = true; s.myMeals = [{ id: 'my-qa', slot: 'D', name: 'Synthetic bowl', macros: [640, 52, 60, 18], parts: [] }]; s.futureField = { keep: true }; s.entries.push({ id: 'synthetic-v10-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('rec-calories-ai-key', 'synthetic-test-token'); });
    await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick, [data-meal-row]'));        // v10 normalises the journal on load
    const before = await saved(page), raw = await page.evaluate(() => localStorage.getItem('rec-calories-v1'));
    assert.equal(before.questsV5['2026-11-24'].picks.L, 'S'); assert.equal(before.futureField.keep, true); assert.equal(before.appVersion, undefined);

    // 1. The deploy lands. The v10 worker still answers from its cache, so the first launch is the whole v10 app, consistent.
    phase = 'v11'; await page.evaluate(() => { window.qaOld = true; });
    await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick, [data-meal-row]'));
    assert.deepEqual(await saved(page), before, 'nothing changes before the new shell takes over');
    // 2. The v11 worker installs, takes over, removes the v10 cache, and the freshly opened page reloads once into v11.
    await page.evaluate(() => { window.qaOld = true; });
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaOld && window.CHADFavourites && document.getElementById('now'), null, { timeout: 20000 });
    await page.waitForFunction(async cache => (await caches.has(cache)) && !(await caches.has('rec-calories-shell-v10')), CACHE);
    assert.deepEqual(errors, [], 'no script errors through the upgrade');
    assert.deepEqual(await saved(page), { ...before, appVersion: 11 }, 'v11 keeps the v10 journal as it was (appVersion 11 added)');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-v10-backup')), raw, 'and keeps the v10 journal byte for byte');
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'water', 'noon, lunch in (v10), water at 0.5 L: water is the thing to do');
    assert.equal(await page.locator('#remaining').innerText(), String(1900 - 715 - 120).replace(/(\d)(\d{3})$/, '$1,$2'), 'the v10 lunch and coffee count');
    await page.locator('#left-line').click(); assert.equal(await page.locator('#entries [data-entry=synthetic-v10-coffee]').count(), 1, 'v10 entries are in the food list');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-ai-key')), 'synthetic-test-token', 'the v10 key is kept');
    assert.equal(await page.evaluate(() => RECScan.settings().mode), 'key', 'and still works as the own-key fallback');

    // 3. Offline from the v11 cache: page, assets and data.
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(() => window.CHADIcons && window.CHADCharts && window.CHADMotion && window.CHADGym && window.CHADTrain && window.CHADFavourites && document.getElementById('now').dataset.now);
    assert.deepEqual(await saved(page), { ...before, appVersion: 11 });
    await page.locator('[data-view=history]').click(); assert.match(await page.locator('#workouts').innerText(), /Pull/, 'the v10 workout is in the history offline');
    await page.locator('[data-view=training]').click(); assert.equal(await page.locator('.is-today .exercise-row').first().locator('.ch-ex__set').innerText(), '9', 'the v10 set is last time for Pull-ups');
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.equal(await page.evaluate(async () => (await fetch('./?source=pwa')).ok), true, 'navigations are served from the shell');
    await page.locator('[data-view=today]').click(); await page.locator('#quick [data-fav=yopro-pouch]').click(); assert.equal((await saved(page)).entries.at(-1).fav, 'yopro-pouch', 'logging works offline');
    await page.locator('#undo-toast button').click(); assert.deepEqual(await saved(page), { ...before, appVersion: 11 });
    await context.setOffline(false);

    // 4. The next release: a newer worker takes over a freshly opened v11 page, which reloads itself once.
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller && window.CHADQuest);
    await page.evaluate(() => { window.qaMarker = true; }); phase = 'v12';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest && document.getElementById('now').children.length, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v12-test')), true); assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), false);
    assert.deepEqual(await saved(page), { ...before, appVersion: 11 });
    // 5. ...but never under the user's hands: with a sheet open it offers the update instead.
    await page.evaluate(() => { window.qaMarker = true; }); await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.locator('#add-food').click(); assert.equal(await page.locator('#builder-sheet').isVisible(), true); phase = 'v13';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.locator('#undo-toast').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#undo-toast').innerText(), /Update ready/); assert.equal(await page.evaluate(() => window.qaMarker), true); assert.equal(await page.locator('#builder-sheet').isVisible(), true);
    await page.keyboard.press('Escape'); await page.locator('#undo-toast button').click();
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest, null, { timeout: 20000 });
    assert.deepEqual(await saved(page), { ...before, appVersion: 11 }); assert.deepEqual(errors, []);
    console.log('PASS actual v10 to v11 upgrade: unchanged same-name files verified against Git, the v10 app stays whole until the v11 worker takes over, v10 cache removed, one reload into v11, v10 journal kept (lunch, water, habit, workout, saved meal, theme, other food, key) with only appVersion 11 added and a byte-for-byte v10 backup, offline page/assets/data/history and logging, navigations from the shell; next-release path: one automatic reload on a fresh page, an "Update ready" toast when a sheet is open.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
