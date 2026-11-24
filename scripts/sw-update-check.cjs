// Real service-worker upgrade from the shipped v9 shell (commit 472da71, read from Git history), with a synthetic journal.
// Covers the first launch after a deploy (the v9 worker still answers from its cache), the upgrade itself, offline use,
// and how v10 picks up the next release.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { serve, launch, saved, shellFiles, root, MIME, CACHE, V9, NOON } = require('./harness.cjs');
const oldFiles = new Map();
const oldFile = file => { if (!oldFiles.has(file)) oldFiles.set(file, execFileSync('git', ['show', V9 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 })); return oldFiles.get(file); };
const text = buffer => buffer.toString('utf8').split('\r\n').join('\n');
const newWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
let phase = 'v9';        // v9 -> v10 (deploy) -> v11 -> v12 (pretend future releases)

// Invariant behind the file names: anything the v9 worker has cached under the same URL must be byte-identical in v10,
// because that worker answers cache-first until the new one takes over. Changed files got new names.
const oldShell = [...text(oldFile('sw.js')).match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const page10 = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of page10.filter(u => oldShell.includes(u) && /\.(js|css)$/.test(u))) assert.equal(text(fs.readFileSync(path.join(root, url))), text(oldFile(url.slice(2))), url + ' is cached by the v9 worker, so it must not change without a new name');
assert.ok(page10.some(u => !oldShell.includes(u)), 'v10 loads files the v9 worker has never seen');

const handler = (pathname, res) => {
  const send = (body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); return true; };
  if (pathname === '/sw.js') return send(phase === 'v9' ? oldFile('sw.js') : phase === 'v10' ? newWorker : newWorker.replace(CACHE, 'rec-calories-shell-' + phase + '-test'), 'text/javascript');
  if (phase !== 'v9') return false;
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
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v9')), true);
    assert.equal(await page.evaluate(() => typeof window.CHADGym), 'undefined', 'this really is the v9 app');
    // Use v9 the way it was used: a meal, water, a quest, an exercise and top set, a journey date, a theme and a key.
    await page.locator('[data-slot=L][data-tier=S]').click(); await page.locator('.water-row').click(); await page.locator('[data-quest=sleep]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.journeyStartDate = '2026-10-08'; s.arcadeTheme = 'dark'; s.arcadeSound = false; s.questsV5['2026-11-24'].exercises = { 0: true }; s.questsV5['2026-11-24'].topSets = { 'Pull-ups': { kg: 10, reps: 8 } }; s.futureField = { keep: true }; s.entries.push({ id: 'synthetic-v9-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('rec-calories-ai-key', 'synthetic-test-token'); });
    await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick'));        // v9 normalises the journal on load
    const before = await saved(page);
    assert.equal(before.questsV5['2026-11-24'].picks.L, 'S'); assert.equal(before.futureField.keep, true);

    // 1. The deploy lands. The v9 worker still answers from its cache, so the first launch is the whole v9 app, consistent.
    phase = 'v10'; await page.evaluate(() => { window.qaOld = true; });
    await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick'));
    assert.deepEqual(await saved(page), before, 'nothing changes before the new shell takes over');
    // 2. The v10 worker installs, takes over, removes the v9 cache, and the freshly opened page reloads once into v10.
    await page.evaluate(() => { window.qaOld = true; });
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaOld && window.CHADGym && document.getElementById('week-toggle'), null, { timeout: 20000 });
    await page.waitForFunction(async cache => (await caches.has(cache)) && !(await caches.has('rec-calories-shell-v9')), CACHE);
    assert.deepEqual(errors, [], 'no script errors through the upgrade');
    assert.deepEqual(await saved(page), before, 'v10 rewrites the v9 journal unchanged');
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    assert.equal(await page.locator('[data-meal-row=L]').getAttribute('class').then(c => c.includes('is-logged')), true, 'v9 lunch shows as a logged row');
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'D', 'midday, lunch done: dinner is next (no pre-gym meal)');
    assert.match(await page.locator('[data-meal-row=L]').innerText(), /Strict · 584 kcal/);
    assert.match(await page.locator('[data-row=wrap]').innerText(), /1 of 4/, 'v9 sleep counts in the wrap-up');
    assert.match(await page.locator('.water-total').innerText(), /^0\.5/);
    assert.equal(await page.locator('#entries [data-entry=synthetic-v9-coffee]').count(), 1, 'v9 entries are listed under Other food');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-ai-key')), 'synthetic-test-token', 'the v9 key is kept');
    assert.equal(await page.evaluate(() => RECScan.settings().mode), 'key', 'and still works as the own-key fallback');

    // 3. Offline from the v10 cache: page, assets and data.
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(() => window.CHADIcons && window.CHADCharts && window.CHADMotion && window.CHADGym && window.CHADTrain && document.querySelector('[data-meal-row]'));
    assert.deepEqual(await saved(page), before);
    await page.locator('[data-view=training]').click(); assert.equal(await page.locator('.is-today .exercise-row').first().locator('.ch-ex__set').innerText(), '10×8', 'the v9 top set is last time for Pull-ups');
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.equal(await page.evaluate(async () => (await fetch('./?source=pwa')).ok), true, 'navigations are served from the shell');
    await context.setOffline(false);

    // 4. The next release: a newer worker takes over a freshly opened v10 page, which reloads itself once.
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller && window.CHADQuest);
    await page.evaluate(() => { window.qaMarker = true; }); phase = 'v11';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest && document.getElementById('daily-checklist').children.length, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v11-test')), true); assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), false);
    assert.deepEqual(await saved(page), before);
    // 5. ...but never under the user's hands: with a sheet open it offers the update instead.
    await page.evaluate(() => { window.qaMarker = true; }); await page.locator('#today-scan').click(); assert.equal(await page.locator('#add-sheet').isVisible(), true); phase = 'v12';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.locator('#undo-toast').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#undo-toast').innerText(), /Update ready/); assert.equal(await page.evaluate(() => window.qaMarker), true); assert.equal(await page.locator('#add-sheet').isVisible(), true);
    await page.keyboard.press('Escape'); await page.locator('#undo-toast button').click();
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest, null, { timeout: 20000 });
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
    console.log('PASS actual v9 to v10 upgrade: unchanged same-name files verified against Git, the v9 app stays whole until the v10 worker takes over, v9 cache removed, one reload into v10, v9 journal identical (meal, water, quest, exercise, top set, theme, other food, key), offline page/assets/data, navigations from the shell; next-release path: one automatic reload on a fresh page, an "Update ready" toast when a sheet is open.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
