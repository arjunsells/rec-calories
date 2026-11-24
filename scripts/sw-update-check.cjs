// Real service-worker upgrade from the shipped v7 shell (commit dcf132a, read from Git history), with a synthetic journal.
// Covers the first launch after a deploy (old worker, new page), the upgrade itself, offline use, and how v8 picks up
// the next release.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { serve, launch, saved, shellFiles, root, MIME, CACHE, NOON } = require('./harness.cjs');
const V7 = 'dcf132a', oldFiles = new Map();
const oldFile = file => { if (!oldFiles.has(file)) oldFiles.set(file, execFileSync('git', ['show', V7 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 })); return oldFiles.get(file); };
const text = buffer => buffer.toString('utf8').split('\r\n').join('\n');
const newWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
let phase = 'v7';        // v7 -> page8 (new files, old worker) -> v8 -> v9 -> v10 (pretend future releases)

// Invariant behind the file names: anything the v7 worker still has cached under the same URL must be byte-identical
// in v8, because that worker answers cache-first until the new one takes over.
const oldShell = [...text(oldFile('sw.js')).match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const page8 = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of page8.filter(u => oldShell.includes(u) && /\.(js|css)$/.test(u))) assert.equal(text(fs.readFileSync(path.join(root, url))), text(oldFile(url.slice(2))), url + ' is cached by the v7 worker, so it must not change without a new name');
assert.ok(page8.some(u => !oldShell.includes(u)), 'v8 loads files the v7 worker has never seen');

const handler = (pathname, res) => {
  const send = (body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); return true; };
  if (pathname === '/sw.js') return send(phase === 'v7' || phase === 'page8' ? oldFile('sw.js') : phase === 'v8' ? newWorker : newWorker.replace(CACHE, 'rec-calories-shell-' + phase + '-test'), 'text/javascript');
  if (phase !== 'v7') return false;
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
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v7')), true);
    assert.equal(await page.evaluate(() => typeof window.CHADMotion), 'undefined', 'this really is the v7 app');
    // Use v7 the way it was used: a meal, water, a quest, an exercise, a custom journey date and theme.
    await page.locator('[data-slot=L][data-tier=S]').click(); await page.locator('.water-row').click(); await page.locator('[data-quest=sleep]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.journeyStartDate = '2026-10-08'; s.arcadeTheme = 'dark'; s.arcadeSound = false; s.questsV5['2026-11-24'].exercises = { 0: true }; s.questsV5['2026-11-24'].topSets = { 'Pull-ups': { kg: 10, reps: 8 } }; s.futureField = { keep: true }; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('rec-calories-ai-key', 'synthetic-test-token'); });
    await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick'));        // v7 itself normalises the journal on load
    const before = await saved(page);
    assert.equal(before.questsV5['2026-11-24'].picks.L, 'S'); assert.equal(before.futureField.keep, true);

    // 1. The deploy has landed but the v7 worker is still in control: the first launch must already be a working v8.
    phase = 'page8'; await page.reload();
    await page.waitForFunction(() => window.CHADMotion && window.CHADQuest && document.querySelectorAll('.meal-pick').length === 12);
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v7')), true, 'still served by the v7 worker');
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    assert.equal(await page.locator('[data-slot=L][data-tier=S]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-quest=sleep]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.deepEqual(errors, [], 'no script errors on the mixed first launch');
    assert.deepEqual(await saved(page), before, 'v8 rewrites the v7 journal unchanged');

    // 2. The v8 worker installs, takes over and removes the v7 cache. Same version as the page: no reload.
    phase = 'v8'; await page.evaluate(() => { window.qaStay = true; });
    await page.evaluate(async () => { const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); await (await navigator.serviceWorker.getRegistration()).update(); await changed; });
    await page.waitForFunction(async cache => (await caches.has(cache)) && !(await caches.has('rec-calories-shell-v7')), CACHE);
    await page.waitForTimeout(800); assert.equal(await page.evaluate(() => window.qaStay), true, 'a page that is already v8 is not reloaded');

    // 3. Offline from the v8 cache: page, assets and data.
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(() => window.CHADIcons && window.CHADCharts && window.CHADMotion && document.querySelector('.meal-pick'));
    assert.deepEqual(await saved(page), before); assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-ai-key')), 'synthetic-test-token');
    assert.equal(await page.locator('[data-slot=L][data-tier=S]').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await page.locator('[data-view=training]').click(); assert.equal(await page.locator('.is-today .exercise-toggle').first().getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('.is-today .exercise-info').first().innerText(), '10×8');
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.equal(await page.evaluate(async () => (await fetch('./?source=pwa')).ok), true, 'navigations are served from the shell');
    await context.setOffline(false);

    // 4. The next release: a newer worker takes over a freshly opened v8 page, which reloads itself once.
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller && window.CHADQuest);
    await page.evaluate(() => { window.qaMarker = true; }); phase = 'v9';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest && document.querySelector('.meal-pick'), null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => caches.has('rec-calories-shell-v9-test')), true); assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), false);
    assert.deepEqual(await saved(page), before);
    // 5. ...but never under the user's hands: with a sheet open it offers the update instead.
    await page.evaluate(() => { window.qaMarker = true; }); await page.locator('#today-scan').click(); assert.equal(await page.locator('#add-sheet').isVisible(), true); phase = 'v10';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.locator('#undo-toast').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#undo-toast').innerText(), /Update ready/); assert.equal(await page.evaluate(() => window.qaMarker), true); assert.equal(await page.locator('#add-sheet').isVisible(), true);
    await page.keyboard.press('Escape'); await page.locator('#undo-toast button').click();
    await page.waitForFunction(() => !window.qaMarker && window.CHADQuest, null, { timeout: 20000 });
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
    console.log('PASS actual v7 to v8 upgrade: unchanged same-name files verified against Git, working v8 on the first launch under the v7 worker, v7 cache removed, no needless reload, offline page/assets/data incl. top sets and key, navigations from the shell; next-release path: one automatic reload on a fresh page, an "Update ready" toast when a sheet is open. Journal identical throughout.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
