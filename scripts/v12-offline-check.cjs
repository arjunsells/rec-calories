// v12 offline, with synthetic data only: the service worker caches the whole v12 shell (the exact list in sw.js), the app
// reloads with no network at all, and everything that does not need the internet still works offline: the water card,
// a Quick log favourite, the week strip, a typed food through the nutrition card, Gym and Progress. A photo taken
// offline becomes a draft that keeps its photo across an offline reload and says why it waits (the AI needs the PC);
// Retry finishes it once the network is back. No camera here (the system camera through the file input, as in an
// iPhone home-screen app), 375 x 667, no sideways scroll.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, shellFiles, CACHE, IPHONE } = require('./harness.cjs');
const PORT = 8108, ORIGIN = 'http://127.0.0.1:' + PORT;
const OFFLINE = 'Can’t reach your PC. Is Tailscale on and the PC awake?';
(async () => {
  const server = await serve(PORT), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 }, ...IPHONE, reducedMotion: 'reduce' });
    let calls = 0, online = true;                       // a route stub answers even in offline mode: it refuses while offline
    await context.route('**/estimate', async route => { if (!online) return route.abort('internetdisconnected'); calls++; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'Synthetic offline plate', kcal: 520, protein_g: 44, carbs_g: 50, fat_g: 14, items: [] }) }); });
    await context.addInitScript(origin => {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
      if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('chad.aiProxyUrl', origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-offline-token'); }
    }, ORIGIN);
    await context.clock.install({ time: new Date('2026-11-24T12:20:00+09:30') });
    const page = await context.newPage(), errors = watch(page, t => /Failed to load resource|net::ERR/.test(t));
    await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADScan12);
    // The shell: the worker takes control and caches exactly what sw.js lists.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload(); await page.waitForFunction(() => window.CHADScan12 && navigator.serviceWorker.controller); }
    const cached = await page.evaluate(async cache => (await (await caches.open(cache)).keys()).map(r => new URL(r.url).pathname), CACHE);
    for (const file of shellFiles()) assert(cached.includes(file === './' ? '/' : '/' + file.slice(2)), file + ' is in ' + CACHE);
    for (const file of ['/scan12.js', '/app12.js', '/quest12.js', '/ux12.js', '/theme12.css']) assert(cached.includes(file), file + ' cached');
    assert.equal(cached.some(p => /app11|quest11|ux11|theme11/.test(p)), false, 'no v11 file in the v12 shell');
    // Offline from here on: a reload still opens the app, from the cache.
    await context.setOffline(true); online = false;
    await page.reload(); await page.waitForFunction(() => window.CHADScan12 && document.getElementById('water12'));
    assert.equal(await page.locator('#remaining').textContent(), '1,900'); assert.equal(await page.locator('#week .ch-week__day').count(), 7);
    // Logging offline: water (1 tap), a favourite (1 tap), and a typed food through the card.
    await page.locator('#water12').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].water, .5);
    await page.waitForTimeout(460); await page.locator('#quick [data-fav="gochi-noodle"]').click(); assert.equal((await saved(page)).entries.at(-1).kcal, 225);
    await page.waitForTimeout(460); await page.evaluate(() => CHADUX.openResult({ name: 'Synthetic typed snack' }, 'manual'));
    await page.waitForFunction(() => document.getElementById('nutrition12').open); await page.locator('#n12-kcal').fill('180'); await page.locator('#n12-protein').fill('12');
    await page.locator('#n12-done').click(); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
    assert.equal((await saved(page)).entries.at(-1).name, 'Synthetic typed snack'); assert.equal(await page.locator('#remaining').textContent(), (1900 - 225 - 180).toLocaleString('en-AU'));
    // A photo offline: the system camera (file input), a draft at once, the friendly reason, and nothing lost.
    await page.waitForTimeout(460); await page.locator('#open-camera').click();
    assert.match(await page.locator('#camera12-status').textContent(), /shutter/);
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#806a50'; g.fillRect(0, 0, 1200, 900); return c.toDataURL('image/png').split(',')[1]; });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#camera12-shutter').click()]);
    await chooser.setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'error');
    assert.match(await page.locator('#nutrition12-body').textContent(), new RegExp(OFFLINE.replace(/-/g, '\\-')));
    assert(await page.locator('#nutrition12 .ch-nut__photo img').isVisible(), 'the photo stays on the card');
    assert.equal(calls, 0, 'nothing reached the proxy offline');
    await page.locator('#nutrition12-close').click(); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
    // An offline reload: the draft and its photo come back from the device.
    await page.reload(); await page.waitForFunction(() => window.CHADScan12 && document.querySelector('#recent12 .ch-food.is-draft img'));
    await page.waitForFunction(() => CHADScan12.drafts().some(d => d.status === 'error'));
    assert.match(await page.locator('#recent12 .ch-food.is-draft').first().textContent(), /Can’t reach PC/);
    // Gym and Progress open offline too.
    for (const view of ['training', 'history']) { await page.waitForTimeout(460); await page.locator(`.tab[data-view=${view}]`).click(); await page.waitForFunction(v => !document.getElementById(v).hidden, view); }
    assert(await page.locator('#history .chart-card').count() >= 3, 'charts drawn offline');
    await page.locator('.tab[data-view=today]').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll at 375 px');
    // Back online: Retry finishes the waiting photo.
    await context.setOffline(false); online = true;
    await page.waitForTimeout(460); await page.locator('#recent12 .ch-food.is-draft').first().click();
    await page.locator('#n12-retry').click(); await page.waitForFunction(() => document.getElementById('nutrition12').dataset.state === 'ready');
    assert.equal(calls, 1); assert.equal(await page.locator('#n12-kcal').inputValue(), '520');
    await page.locator('#n12-done').click(); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
    assert.equal((await saved(page)).entries.at(-1).name, 'Synthetic offline plate'); assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS v12 offline: the worker caches the exact v12 shell (${shellFiles().length} files, ${CACHE}, no v11 file); offline reload; water, a favourite and a typed food logged offline; an offline photo becomes a draft with its photo and the friendly offline reason (nothing sent), survives an offline reload, and Retry finishes it online; Gym and Progress offline; 375 px, no sideways scroll.`);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
