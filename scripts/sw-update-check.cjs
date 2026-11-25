// Real service-worker upgrade from the shipped v11 shell (main 566cc4e, read from Git history), with a synthetic journal.
// Covers the first launch after a deploy (the v11 worker still answers from its cache), the upgrade itself, offline use,
// and how v12 picks up the next release.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { serve, launch, saved, shellFiles, root, MIME, CACHE, V11, NOON } = require('./harness.cjs');
const oldFiles = new Map();
const oldFile = file => { if (!oldFiles.has(file)) oldFiles.set(file, execFileSync('git', ['show', V11 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); return oldFiles.get(file); };
const text = buffer => buffer.toString('utf8').split('\r\n').join('\n');
const newWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
let phase = 'v11';        // v11 -> v12 (deploy) -> v13 -> v14 (pretend future releases)

// Unchanged shared modules remain byte-identical to v11. v12d deliberately updates scan9.js
// in place; cache generations keep the old page/module together until the new worker takes
// over. Verify both cached bytes and routing behavior across that transition below.
const changedShared = new Set(['./scan9.js']);
const oldShell = [...text(oldFile('sw.js')).match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]), newShell = shellFiles();
const page12 = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of page12.filter(u => oldShell.includes(u) && !changedShared.has(u) && /\.(js|css)$/.test(u))) assert.equal(text(fs.readFileSync(path.join(root, url))), text(oldFile(url.slice(2))), url + ' is cached by the v11 worker, so it must not change without a new name');
const shared = newShell.filter(u => oldShell.includes(u) && !['./', './index.html'].includes(u));
assert.ok(shared.length >= 20 && ['./builder11.js', './gym11.js', './fonts/press-start-2p.ttf', './manifest.webmanifest'].every(u => shared.includes(u)), 'the shells share their unchanged files: ' + shared.join(' '));
for (const url of shared.filter(u => !changedShared.has(u))) { const now = fs.readFileSync(path.join(root, url)), then = oldFile(url.slice(2)); assert.ok(now.equals(then) || text(now) === text(then), url + ' is in both shells, so it must not change without a new name'); }
assert.ok(page12.some(u => !oldShell.includes(u)), 'v12 loads files the v11 worker has never seen');
assert.deepEqual(['./scan12.js', './app12.js', './quest12.js', './ux12.js', './theme12.css'].filter(u => !newShell.includes(u) || !page12.includes(u) || oldShell.includes(u)), [], 'the v12 shell adds the v12 files');
assert.deepEqual(['./app11.js', './quest11.js', './ux11.js', './theme11.css'].filter(u => !oldShell.includes(u) || newShell.includes(u) || page12.includes(u)), [], 'and drops the v11 ones');

const handler = (pathname, res) => {
  const send = (body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); return true; };
  if (pathname === '/sw.js') return send(phase === 'v11' ? oldFile('sw.js') : phase === 'v12' ? newWorker : newWorker.replace(CACHE, 'rec-calories-shell-' + phase + '-test'), 'text/javascript');
  if (phase !== 'v11') return false;
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
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v11')), true);
    assert.equal(text(Buffer.from(await page.evaluate(async () => (await fetch('./scan9.js')).text()))), text(oldFile('scan9.js')), 'v11 serves its original cached estimator');
    assert.equal(await page.evaluate(() => RECScan.settings({ getItem: () => null }).mode), 'none', 'v11 still requires setup');
    assert.deepEqual(await page.evaluate(() => [typeof window.CHADFavourites, typeof window.CHADScan12, !!document.getElementById('left-more')]), ['object', 'undefined', true], 'this really is the v11 app');
    // Use v11 the way it was used: lunch from the card on top, water, a habit in Later today; then a workout set, a saved
    // meal, a journey date, a theme, other food and a key.
    await page.locator('#now [data-slot=L][data-tier=S]').click();
    await page.waitForFunction(() => document.getElementById('now').dataset.now === 'water'); await page.waitForTimeout(450); await page.locator('.water-row').click();
    await page.waitForTimeout(450); await page.locator('#later-toggle').click(); await page.locator('#today [data-quest=sleep]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.journeyStartDate = '2026-10-08'; s.arcadeTheme = 'dark'; s.arcadeSound = false; s.questsV5['2026-11-24'].workout = { id: 'pull', start: Date.parse('2026-11-24T11:00:00+09:30'), end: Date.parse('2026-11-24T11:50:00+09:30'), sets: [{ x: 'Pull-ups', kg: 0, reps: 9, at: Date.parse('2026-11-24T11:05:00+09:30') }] }; s.questsV5['2026-11-24'].training = true; s.myMeals = [{ id: 'my-qa', slot: 'D', name: 'Synthetic bowl', macros: [640, 52, 60, 18], parts: [] }]; s.futureField = { keep: true }; s.entries.push({ id: 'synthetic-v11-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('rec-calories-ai-key', 'synthetic-test-token'); });
    await page.reload(); await page.waitForFunction(() => document.getElementById('now')?.dataset.now);        // v11 normalises the journal on load
    const before = await saved(page), raw = await page.evaluate(() => localStorage.getItem('rec-calories-v1'));
    assert.equal(before.questsV5['2026-11-24'].picks.L, 'S'); assert.equal(before.questsV5['2026-11-24'].water, 0.5); assert.equal(before.questsV5['2026-11-24'].sleep, true);
    assert.equal(before.futureField.keep, true); assert.equal(before.appVersion, 11);

    // 1. The deploy lands. The v11 worker still answers from its cache, so the first launch is the whole v11 app, consistent.
    phase = 'v12'; await page.evaluate(() => { window.qaOld = true; });
    await page.reload(); await page.waitForFunction(() => document.getElementById('now')?.dataset.now);
    assert.equal(await page.evaluate(() => typeof window.CHADScan12), 'undefined', 'still the whole v11 app, from the v11 cache');
    assert.deepEqual(await saved(page), before, 'nothing changes before the new shell takes over');
    // 2. The v12 worker installs, takes over, removes the v11 cache, and the freshly opened page reloads once into v12.
    await page.evaluate(() => { window.qaOld = true; });
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaOld && window.CHADScan12 && document.getElementById('now')?.dataset.now, null, { timeout: 20000 });
    await page.waitForFunction(async cache => (await caches.has(cache)) && !(await caches.has('rec-calories-shell-v11')), CACHE);
    assert.deepEqual(errors, [], 'no script errors through the upgrade');
    assert.equal(text(Buffer.from(await page.evaluate(async () => (await fetch('./scan9.js')).text()))), text(fs.readFileSync(path.join(root, 'scan9.js'))), 'v12d serves its updated estimator from the new cache');
    assert.equal(await page.evaluate(() => RECScan.settings({ getItem: () => null }).mode), 'proxy', 'v12d defaults to the built-in proxy without setup');
    assert.deepEqual(await saved(page), { ...before, appVersion: 12 }, 'v12 keeps the v11 journal as it was (appVersion 12)');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-v11-backup')), raw, 'and keeps the v11 journal byte for byte');
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    // v12: water is never the thing to do now (it has its own card all day), and the food list under the line (#entries)
    // gave way to Recently eaten (#recent12) and the hero's eaten view.
    assert.deepEqual([await page.locator('#now').getAttribute('data-now'), await page.locator('#now').getAttribute('data-meal-slot')], ['meal', 'D'], 'noon, lunch in and the Pull done (v11): dinner is the thing to do now');
    assert.match(await page.locator('#water12-value').innerText(), /^0\.5\s*\/\s*4\.5 L$/, 'the v11 water, on its own card');
    assert.equal(await page.locator('#remaining').innerText(), String(1900 - 715 - 120).replace(/(\d)(\d{3})$/, '$1,$2'), 'the v11 lunch and coffee count'); assert.match(await page.locator('#remaining-label').innerText(), /^Calories left$/i);
    assert.deepEqual(await page.locator('#recent12 [data-entry]').evaluateAll(n => n.map(b => b.dataset.entry)), ['synthetic-v11-coffee', 'plan-2026-11-24-L'], 'v11 entries are in Recently eaten, newest first');
    await page.locator('#left-line').click(); assert.match(await page.locator('#remaining-label').innerText(), /^Calories eaten$/i);
    await page.waitForFunction(() => document.getElementById('remaining').textContent === '835'); await page.locator('#left-line').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-ai-key')), 'synthetic-test-token', 'the v11 key is kept');
    assert.equal(await page.evaluate(() => RECScan.settings().mode), 'key', 'and still works as the own-key fallback');

    // 3. Offline from the v12 cache: page, assets and data.
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(() => window.CHADIcons && window.CHADCharts && window.CHADMotion && window.CHADGym && window.CHADTrain && window.CHADFavourites && window.CHADScan12 && document.getElementById('now').dataset.now);
    assert.deepEqual(await saved(page), { ...before, appVersion: 12 });
    await page.locator('[data-view=history]').click(); assert.match(await page.locator('#workouts').innerText(), /Pull/, 'the v11 workout is in the history offline');
    await page.locator('[data-view=training]').click(); assert.equal(await page.locator('.is-today .exercise-row').first().locator('.ch-ex__set').innerText(), '9', 'the v11 set is last time for Pull-ups');
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.deepEqual(await page.evaluate(async cache => { const c = await caches.open(cache); return [(await c.keys()).length, !!(await c.match('./scan12.js')), !!(await c.match('./app11.js'))]; }, CACHE), [shellFiles().length, true, false], 'the v12 shell, and nothing of v11');
    assert.equal(await page.evaluate(async () => (await fetch('./?source=pwa')).ok), true, 'navigations are served from the shell');
    await page.locator('[data-view=today]').click();
    await page.locator('#water12').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].water, 1, 'the water card works offline'); assert.match(await page.locator('#undo-toast').innerText(), /500 mL water/);
    await page.locator('#undo-toast button').click(); assert.deepEqual(await saved(page), { ...before, appVersion: 12 });
    await page.locator('#quick [data-fav=yopro-pouch]').click(); const pouch = (await saved(page)).entries.at(-1); assert.equal(pouch.fav, 'yopro-pouch', 'logging works offline');
    assert.equal(await page.locator('#recent12 [data-entry]').first().getAttribute('data-entry'), pouch.id, 'on top of Recently eaten');
    await page.locator('#undo-toast button').click(); assert.deepEqual(await saved(page), { ...before, appVersion: 12 });
    await context.setOffline(false);

    // 4. The next release: a newer worker takes over a freshly opened v12 page, which reloads itself once.
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller && window.CHADQuest);
    await page.evaluate(() => { window.qaMarker = true; }); phase = 'v13';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest && document.getElementById('now').children.length, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v13-test')), true); assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), false);
    assert.deepEqual(await saved(page), { ...before, appVersion: 12 });
    // 5. ...but never under the user's hands: with a sheet open it offers the update instead.
    await page.evaluate(() => { window.qaMarker = true; }); await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.locator('#add-food').click(); assert.equal(await page.locator('#builder-sheet').isVisible(), true); phase = 'v14';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.locator('#undo-toast').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#undo-toast').innerText(), /Update ready/); assert.equal(await page.evaluate(() => window.qaMarker), true); assert.equal(await page.locator('#builder-sheet').isVisible(), true);
    await page.keyboard.press('Escape'); await page.locator('#undo-toast button').click();
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest, null, { timeout: 20000 });
    assert.deepEqual(await saved(page), { ...before, appVersion: 12 }); assert.deepEqual(errors, []);
    console.log('PASS actual v11 to v12 upgrade: unchanged shared files verified against Git, scan9.js verified as original under v11 and updated under v12d with zero-setup routing, the v12 shell adds scan12/app12/quest12/ux12/theme12 and drops the v11 files, the v11 app stays whole until the v12 worker takes over, v11 cache removed, one reload into v12, v11 journal kept (lunch, water, habit, workout, saved meal, theme, other food, key) with only appVersion 12 and a byte-for-byte v11 backup, dinner on top with the v11 water on its own card, v11 food in Recently eaten and the eaten view, offline page/assets/data/history and logging (water card, Quick log, Undo), navigations from the shell; next-release path: one automatic reload on a fresh page, an "Update ready" toast when a sheet is open.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
