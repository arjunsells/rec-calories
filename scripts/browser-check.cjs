// Food and AI flows end to end. Open Food Facts and OpenAI are mocked; a synthetic key and journal only.
// Set CHAD_LIVE_FOOD=1 to let the Open Food Facts requests reach the real service.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v8-regression');
const product = { code: '9300652010794', product_name: 'Weet-Bix synthetic QA', brands: 'Synthetic', serving_size: '40 g', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 3 } };

(async () => {
  const server = await serve(8087), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'light', reducedMotion: 'reduce' }), page = await context.newPage();
    const off = [];
    if (!process.env.CHAD_LIVE_FOOD) await page.route('https://*.openfoodfacts.org/**', route => { off.push(route.request().url()); return route.fulfill({ json: route.request().url().includes('/product/') ? { status: 1, product } : { products: [product] } }); });
    const errors = watch(page, text => /401/.test(text));          // the mocked 401 below logs one network line
    await page.clock.install({ time: new Date(NOON) });
    await page.goto('http://127.0.0.1:8087/');
    await page.waitForFunction(() => document.getElementById('remaining').textContent === '1,900');
    assert.equal(await page.title(), 'CHAD');
    for (const [id, value] of [['protein-goal', '220'], ['carbs-goal', '150'], ['fat-goal', '45']]) assert.equal(await page.locator('#' + id).inputValue(), value);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => typeof window.ZXingBrowser), 'undefined', 'the barcode reader is not loaded until it is needed');

    // Snap + Say without a key points at Settings.
    await page.locator('#today-scan').click(); await page.locator('[data-add=camera]').click(); await page.locator('#camera-button').click();
    assert.equal(await page.locator('#key-card').isVisible(), true); assert.match(await page.locator('#key-card').innerText(), /Paste your OpenAI key in Settings/);

    // Barcode: one lookup opens the review sheet directly; the product is remembered.
    await page.evaluate(() => CHADUX.openFood('barcode'));
    assert.equal(await page.locator('#search-panel').isVisible(), false, 'barcode mode shows only barcode controls');
    await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
    await page.locator('#confirm-sheet').waitFor({ state: 'visible', timeout: 45000 });
    assert.match(await page.locator('#scan-items').innerText(), /Weet/i);
    const kcal = parseFloat((await page.locator('#scan-total').innerText()).replaceAll(',', ''));
    await page.locator('#portion-slider').fill('1.5');
    assert.equal(parseFloat((await page.locator('#scan-total').innerText()).replaceAll(',', '')), Math.round(kcal * 1.5));
    await page.locator('#scan-confirm-form button[type=submit]').click();
    assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
    let journal = await saved(page);
    assert.equal(journal.entries.at(-1).source, 'barcode'); assert.equal(journal.entries.at(-1).kcal, Math.round(kcal * 1.5));
    assert.match(await page.locator('#undo-toast').innerText(), /Weet/i);
    if (!process.env.CHAD_LIVE_FOOD) {
      assert.equal(off.filter(u => u.includes('/product/')).length, 1);
      await page.evaluate(() => CHADUX.openFood('barcode')); await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
      await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
      assert.equal(off.filter(u => u.includes('/product/')).length, 1, 'a known barcode costs no request');
      await page.locator('#cancel-scan').click();
    }

    // Search: typing and pressing Search is one request; results list; the answer is cached and offered again.
    await page.evaluate(() => CHADUX.openFood('search'));
    assert.equal(await page.locator('#barcode-panel').isVisible(), false, 'search mode shows only search controls');
    await page.locator('#food-search').fill('weet-bix'); await page.locator('#search-form button').click();
    await page.locator('#food-results button').first().waitFor({ timeout: 45000 }).catch(async e => { throw Error(e.message + '; status=' + await page.locator('#scan-status').textContent() + '; state=' + await page.locator('#food-state').textContent()); });
    assert.match(await page.locator('#food-results').innerText(), /Weet/i);
    assert.match(await page.locator('#scan-status').innerText(), /result/);
    const realProduct = (await page.locator('#food-results button').first().innerText()).replaceAll('\n', ' ');
    if (!process.env.CHAD_LIVE_FOOD) {
      await page.clock.runFor(1000);
      assert.equal(off.filter(u => u.includes('search')).length, 1, 'debounce and submit share one request');
      await page.locator('#food-search').fill('');
      assert.deepEqual(await page.locator('#recent-searches button').allInnerTexts(), ['weet-bix']);
      await page.locator('#recent-searches button').click();
      await page.locator('#food-results button').first().waitFor();
      assert.match(await page.locator('#scan-status').innerText(), /saved on this device/);
      assert.equal(off.filter(u => u.includes('search')).length, 1, 'a recent search costs no request');
      // Live search: typing alone (no button) searches after a pause.
      await page.locator('#food-search').fill('weet');
      assert.equal(off.filter(u => u.includes('search')).length, 1, 'nothing is sent while typing');
      await page.clock.runFor(600);
      await page.waitForFunction(() => /result/.test(document.getElementById('scan-status').textContent));
      assert.equal(off.filter(u => u.includes('search')).length, 2);
      assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('rec-calories-food-cache-v1'))).q['weet-bix'], 'results persist for the next launch');
    }
    assert.deepEqual(errors, []);
    console.log('PASS OFF search and lookup (live only when CHAD_LIVE_FOOD=1): ' + realProduct);

    // One-tap repeats use the existing journal and can be undone.
    await page.locator('[data-close=scan-sheet]').click(); await page.locator('[data-view=today]').click();
    await page.locator('#entries .repeat').first().click();
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.equal(journal.entries.at(-1).source, 'repeat');
    await page.locator('#undo-toast button').click();
    assert.equal((await saved(page)).entries.length, 1, 'Undo removes the repeated entry');
    await page.locator('#entries .repeat').first().click();
    // The + sheet offers recent foods: two taps to log something eaten before.
    await page.locator('#today-scan').click();
    assert.equal(await page.locator('#recent-food-list .recent-food').count(), 1);
    await page.locator('#recent-food-list .recent-food').first().click();
    assert.equal((await saved(page)).entries.length, 3); assert.equal(await page.locator('#add-sheet').isVisible(), false);
    // Delete is undoable.
    await page.locator('#entries .delete').first().click(); assert.equal((await saved(page)).entries.length, 2);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, 3);
    await page.locator('#entries .delete').first().click();

    await page.evaluate(() => CHADUX.openFood('manual'));
    await page.locator('#food-name').fill('Synthetic manual bowl'); await page.locator('#calories').fill('200'); await page.locator('#protein').fill('10'); await page.locator('#carbs').fill('25'); await page.locator('#fat').fill('5');
    await page.locator('#add-form button').click();
    assert.equal(await page.locator('#entries .entry').count(), 3);
    assert.equal(await page.locator('#carbs-total').innerText(), String(Math.round((await saved(page)).entries.reduce((s, e) => s + (e.carbs || 0), 0))));

    // All AI network calls are mocked using a synthetic credential, never an actual user key.
    await page.locator('[data-view=settings]').click();
    await page.locator('#ai-key').fill('synthetic-test-token'); await page.locator('#settings-form button').click();
    assert.equal(await page.locator('#ai-key').getAttribute('type'), 'password');
    assert.match(await page.locator('#message').innerText(), /Settings saved/);
    let mode = 'success', calls = 0;
    await page.route('https://api.openai.com/**', async route => {
      calls++; assert.equal(route.request().headers().authorization, 'Bearer synthetic-test-token');
      assert.equal(route.request().postDataJSON().store, false);
      if (mode === '401') return route.fulfill({ status: 401, body: '{}' });
      if (mode === 'bad') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'broken json' } }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ name: 'Synthetic AI meal', portion: '200 g', kcal: 400, protein: 30, carbs: 40, fat: 12 }], total: 9999 }) } }] }) });
    });
    await page.evaluate(() => CHADUX.openFood('camera'));
    assert.equal(await page.locator('#key-card').isVisible(), false);
    const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; return c.toDataURL('image/png').split(',')[1]; });
    const upload = () => page.locator('#photo-input').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    await upload(); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#scan-total').innerText(), '400 kcal');
    await page.locator('#portion-slider').fill('2'); assert.match(await page.locator('#result-macros').innerText(), /Protein 60 g/);
    await page.locator('#scan-confirm-form button[type=submit]').click();
    assert.equal((await saved(page)).entries.at(-1).source, 'photo');
    for (const [next, pattern] of [['401', /key was rejected/], ['bad', /Could not read/]]) {
      mode = next; await page.evaluate(() => CHADUX.openFood('camera')); await upload();
      await page.waitForFunction(() => !document.getElementById('camera-button').disabled);
      assert.match(await page.locator('#scan-status').innerText(), pattern); assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
    }
    // Text only ("Say").
    mode = 'success'; await page.locator('#food-description').fill('Chicken, rice and broccoli'); await page.locator('#describe-button').click();
    await page.locator('#confirm-sheet').waitFor({ state: 'visible' }); await page.locator('#cancel-scan').click();
    assert.equal(calls, 4);
    assert.deepEqual(errors, []);

    // Legacy custom goals and all entry extension fields survive schema migration.
    await page.evaluate(() => { localStorage.removeItem('rec-calories-ai-key'); localStorage.setItem('rec-calories-v1', JSON.stringify({ target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Legacy synthetic meal', kcal: 400, protein: 20, extra: 'preserve' }] })); });
    await page.reload();
    assert.equal(await page.locator('#daily-target').inputValue(), '1900'); assert.equal(await page.locator('#protein-goal').inputValue(), '220');
    journal = await saved(page); assert.equal(journal.entries[0].extra, 'preserve'); assert.equal(journal.schemaVersion, 5);
    await page.locator('[data-view=history]').click(); await page.locator('#past-entries .repeat').click();
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.notEqual(journal.entries[1].day, '2020-01-01');

    // Restore an empty synthetic journal for uncluttered screenshots, then go offline.
    await page.evaluate(() => localStorage.removeItem('rec-calories-v1')); await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), true);
    fs.mkdirSync(shots, { recursive: true });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    for (const id of ['calorie-ring', 'protein-ring']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= 844); }
    await page.screenshot({ path: path.join(shots, 'empty-today-light.png') });
    const lightBg = await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    assert.notEqual(lightBg, await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor));
    await page.screenshot({ path: path.join(shots, 'empty-today-dark.png') });
    await context.setOffline(true); await page.reload();
    assert.equal(await page.title(), 'CHAD'); assert.equal(await page.locator('#remaining').innerText(), '1,900');
    // The barcode reader loads on demand from the offline shell.
    assert.equal(await page.evaluate(async () => { await CHADFood.loadScanner(); return typeof ZXingBrowser.BrowserMultiFormatOneDReader; }), 'function');
    assert.equal(await page.evaluate(() => typeof CHADFood.startScanner), 'function');
    // Offline search: no request, a clear state, saved results still open, Quick add carries the name over.
    const before = off.length;
    await page.evaluate(() => CHADUX.openFood('search'));
    await page.locator('#food-search').fill('synthetic new food'); await page.locator('#search-form button').click();
    await page.locator('#food-state').waitFor({ state: 'visible' });
    assert.match(await page.locator('#food-state').innerText(), /offline/i); assert.match(await page.locator('#food-state').innerText(), /Quick add/);
    if (!process.env.CHAD_LIVE_FOOD) {
      await page.locator('#food-search').fill('weet-bix'); await page.locator('#search-form button').click();
      await page.locator('#food-results button').first().waitFor();
      assert.match(await page.locator('#food-results').innerText(), /Weet/i);
      await page.locator('#food-search').fill('synthetic new food');
    }
    assert.equal(off.length, before, 'nothing is requested while offline');
    await page.locator('#scan-manual').click();
    assert.equal(await page.locator('#manual-sheet').isVisible(), true); assert.equal(await page.locator('#food-name').inputValue(), 'synthetic new food');
    assert.deepEqual(errors, []);
    await context.setOffline(false); await context.close();
    console.log('PASS: mobile 390x844 light/dark, no unexpected JS/console errors; barcode auto-review and cache; debounced search, recent searches and persisted results; portion math; repeat, recent foods, delete with Undo; manual entry; mocked AI photo/text success, 401 and bad JSON; legacy migration; offline shell with on-demand scanner; offline search state and Quick add hand-off; screenshots ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
