// Food and AI flows end to end in v12, through the one add-food sheet (+ Food) and the nutrition card: Ask AI without AI
// (the camera's other ways, and words that end in the friendly "not set up" card), a barcode, search (the foods here and
// Open Food Facts), Type it, Recently eaten (Log again, Delete), an own OpenAI key (a photo through the system camera,
// words, 401, bad JSON), legacy data, and offline. Open Food Facts and OpenAI are mocked; a synthetic key and journal
// only. There is no live camera here (as in an iPhone home-screen app): the camera's shutter opens the system camera.
// Set CHAD_LIVE_FOOD=1 to let the Open Food Facts requests reach the real service.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v12-regression');
const APP = 'http://127.0.0.1:8087', LIVE = !!process.env.CHAD_LIVE_FOOD;
const product = { code: '9300652010794', product_name: 'Weet-Bix synthetic QA', brands: 'Synthetic', serving_size: '40 g', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 3 } };

(async () => {
  const server = await serve(8087), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'light', reducedMotion: 'reduce' });
    await context.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }));
    const page = await context.newPage();
    const off = [], away = [];
    page.on('request', r => { const url = r.url(); if (/^https?:/.test(url) && !url.startsWith(APP)) away.push(url); });
    if (!LIVE) await context.route('https://*.openfoodfacts.org/**', route => { off.push(route.request().url()); return route.fulfill({ json: route.request().url().includes('/product/') ? { status: 1, product } : { products: [product] } }); });
    const errors = watch(page, text => /401/.test(text));          // the mocked 401 below logs one network line
    await page.clock.install({ time: new Date(NOON) });
    await page.goto(APP + '/');
    await page.waitForFunction(() => document.getElementById('remaining').textContent === '1,900');
    assert.equal(await page.title(), 'CHAD');
    for (const [id, value] of [['protein-goal', '220'], ['carbs-goal', '150'], ['fat-goal', '45']]) assert.equal(await page.locator('#' + id).inputValue(), value);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => typeof window.ZXingBrowser), 'undefined', 'the barcode reader is not loaded until it is needed');
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.click(); };
    const addFood = async () => { await page.waitForTimeout(420); await tap(page.locator('#add-food')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); };
    const cameraOpen = () => page.waitForFunction(() => document.getElementById('camera12')?.open);
    const cardOpen = (timeout = 30000) => page.waitForFunction(() => { const d = document.getElementById('nutrition12'); return d.open && d.dataset.state === 'ready' && document.getElementById('n12-kcal'); }, null, { timeout });
    const trouble = () => page.waitForFunction(() => { const d = document.getElementById('nutrition12'); return d.open && d.dataset.state === 'error'; });
    const closed = () => page.waitForFunction(() => !document.getElementById('nutrition12').open);
    const card = () => page.evaluate(() => ['kcal', 'protein', 'carbs', 'fat'].map(k => document.getElementById('n12-' + k).value));
    // Drafts (photos and words not logged yet) kept in this device's store, IndexedDB chad-photos-v12.
    const storedDrafts = () => page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      try { return await new Promise(resolve => { const q = db.transaction('drafts').objectStore('drafts').count(); q.onsuccess = () => resolve(q.result); }); } finally { db.close(); }
    });
    // A logged food in Recently eaten: a tap opens its card (Edit food); then one of its buttons.
    const entryCard = async (id, action) => {
      await page.waitForTimeout(420); await tap(page.locator(`#recent12 [data-entry="${id}"]`)); await cardOpen();
      assert.equal(await page.locator('#nutrition12-title').innerText(), 'Edit food');
      await page.locator('#' + action).click(); await closed();
    };

    // Ask AI without any AI: the camera opens with its other ways (no key nagging), and Escape goes back to the add-food
    // sheet. Words end in the friendly "not set up" card (Search food, Describe it, AI settings), nothing is sent
    // anywhere, and Discard goes back to the add-food sheet too.
    await addFood(); await tap(page.locator('#builder-ask-go')); await cameraOpen();
    assert.match(await page.locator('#camera12-status').innerText(), /Tap the shutter to take or choose a photo/, 'no live camera: the shutter takes or chooses a photo');
    assert.match(await page.locator('#camera12').innerText(), /Search food[\s\S]*Saved[\s\S]*Describe it/);
    assert.doesNotMatch(await page.locator('#camera12').innerText(), /OpenAI|API key/);
    await page.keyboard.press('Escape'); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    await tap(page.locator('#builder-ask-go')); await cameraOpen();
    await page.locator('#camera12-describe').click(); await page.locator('#describe12').fill('Synthetic soup'); await page.locator('#describe12-go').click();
    await trouble();
    assert.match(await page.locator('#nutrition12-body').innerText(), /Pair this phone first[\s\S]*Photo AI isn’t set up on this phone[\s\S]*Settings/); assert.doesNotMatch(await page.locator('#nutrition12').innerText(), /OpenAI|API key/);
    for (const id of ['n12-search', 'n12-describe', 'n12-setup', 'n12-retry']) assert.equal(await page.locator('#' + id).isVisible(), true, id);
    assert.deepEqual(away, [], 'no request without AI set up');
    await page.locator('#n12-discard').click(); await closed(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), 0, 'the discarded words leave no draft');

    // Barcode: one lookup opens the card directly; the product is remembered; Add to meal, then Log.
    await tap(page.locator('#builder-barcode')); await page.locator('#scan-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#camera-panel').isVisible(), false, 'barcode mode shows only barcode controls');
    await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
    await cardOpen(45000);
    assert.match(await page.locator('#n12-name').inputValue(), /Weet/i); assert.equal(await page.locator('#n12-done').innerText(), 'Add to meal');
    assert.match(await page.locator('#nutrition12 .ch-nut__meta').innerText(), /Barcode/);
    const kcal = Number((await card())[0]);
    if (!LIVE) assert.deepEqual(await card(), ['160', '4', '24', '1.2'], 'one 40 g serving, all four macros, editable');
    // v12: servings in halves stand in for v11's weight field. The card keeps the product's weight (one serving, or 100 g
    // for a per-100 g pack), so 1.5 servings scale the weight, the energy and the macros together.
    const pack = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-food-cache-v1')).c['9300652010794'].item);
    const weight = Math.round(Math.round((pack.basis === '100g' ? 100 : pack.servingGrams) * 1.5 * 10) / 10);
    await page.locator('#n12-more').click(); assert.equal(await page.locator('#n12-servings').innerText(), '1.5');
    const scaled = Number((await card())[0]); assert.ok(Math.abs(scaled - kcal * 1.5) <= 1, 'the servings scale everything');
    if (!LIVE) assert.deepEqual(await card(), ['240', '6', '36', '1.8']);
    await page.locator('#n12-done').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    assert.match(await page.locator('#builder-items').innerText(), new RegExp(`Weet[\\s\\S]*${scaled.toLocaleString('en-AU')} kcal[\\s\\S]*${weight} g`, 'i'), 'added to the meal being built, by weight');
    await tap(page.locator('#builder-log'));
    let journal = await saved(page), e = journal.entries.at(-1);
    assert.deepEqual([e.source, e.kcal, e.portion, e.planSlot], ['barcode', scaled, weight + ' g', undefined], 'logged as itself (other food), by weight');
    if (!LIVE) assert.deepEqual([e.portion, e.protein, e.carbs, e.fat], ['60 g', 6, 36, 1.8], '1.5 × 40 g');
    assert.match(await page.locator('#undo-toast').innerText(), /Weet/i);
    if (!LIVE) {
      assert.equal(off.filter(u => u.includes('/product/')).length, 1);
      await addFood(); await tap(page.locator('#builder-barcode')); await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
      await cardOpen();
      assert.equal(off.filter(u => u.includes('/product/')).length, 1, 'a known barcode costs no request');
      await page.locator('#nutrition12-close').click(); await closed(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });   // closing the card goes back to the meal being built
    } else await addFood();

    // Search: the foods here at once, Open Food Facts after a pause; typing then Search is one request; results list
    // kcal and P/C/F; the answer is kept on the device.
    await page.locator('#builder-search').fill('weet-bix'); await page.locator('#builder-search').press('Enter');
    await page.locator('#builder-results [data-result=off]').first().waitFor({ timeout: 45000 });
    assert.match(await page.locator('#builder-results').innerText(), /Weet/i);
    if (!LIVE) assert.match(await page.locator('#builder-results [data-result=off]').first().innerText(), /40 g[\s\S]*P\s?4[\s\S]*C\s?24[\s\S]*F\s?1/);
    const realProduct = (await page.locator('#builder-results [data-result=off]').first().innerText()).replaceAll('\n', ' ');
    if (!LIVE) {
      await page.clock.runFor(1000);
      assert.equal(off.filter(u => u.includes('search')).length, 1, 'debounce and Enter share one request');
      await page.locator('#builder-search').fill(''); await page.locator('#builder-search').fill('weet-bix'); await page.clock.runFor(600);
      await page.locator('#builder-note').filter({ hasText: 'Saved on this device' }).waitFor();
      assert.equal(off.filter(u => u.includes('search')).length, 1, 'a search done before costs no request');
      await page.locator('#builder-search').fill('weet'); assert.equal(off.filter(u => u.includes('search')).length, 1, 'nothing is sent while typing');
      await page.clock.runFor(600); await page.waitForFunction(() => document.querySelectorAll('#builder-results [data-result=off]').length > 0);
      assert.equal(off.filter(u => u.includes('search')).length, 2);
      assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('rec-calories-food-cache-v1'))).q['weet-bix'], 'results persist for the next launch');
    }
    assert.deepEqual(errors, []);
    console.log('PASS OFF search and lookup through the add-food sheet (live only when CHAD_LIVE_FOOD=1): ' + realProduct);
    await page.locator('#builder-sheet [data-close=builder-sheet]').click(); await page.locator('#builder-sheet').waitFor({ state: 'hidden' });   // Escape in the search box clears it first

    // Recently eaten (v12's food list, under the macro cards): kcal and P/C/F on each row; a tap opens the card with Log
    // again and Delete, each with Undo.
    const barcodeId = e.id, row = page.locator(`#recent12 [data-entry="${barcodeId}"]`);
    assert.match(await row.innerText(), /Weet[\s\S]*kcal/i);
    assert.match(await row.getAttribute('aria-label'), /kcal, protein [\d.]+ g, carbs [\d.]+ g, fat [\d.]+ g/, 'food rows give kcal and P/C/F');
    assert.equal(await row.locator('.ch-food__m--protein, .ch-food__m--carbs, .ch-food__m--fat').count(), 3);
    await entryCard(barcodeId, 'n12-again');
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.equal(journal.entries.at(-1).source, 'repeat');
    assert.equal(await page.locator('#recent12 [data-entry]').count(), 2);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, 1, 'Undo removes the repeated entry');
    await entryCard(barcodeId, 'n12-delete'); assert.equal((await saved(page)).entries.length, 0);
    assert.match(await page.locator('#undo-toast').innerText(), /deleted/);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, 1, 'Delete undone');
    // The recent foods: what was logged comes first next time.
    await addFood(); assert.match(await page.locator('#builder-recent').innerText(), /Weet/i, 'recent first'); await page.keyboard.press('Escape');
    // Type it: the card, empty (Add to meal); Add to meal; Log. The macro cards follow.
    await addFood(); await tap(page.locator('#builder-type')); await cardOpen();
    assert.deepEqual(await card(), ['', '', '', ''], 'typed in: the numbers start empty'); assert.equal(await page.locator('#n12-done').innerText(), 'Add to meal');
    await page.locator('#n12-name').fill('Synthetic manual bowl'); await page.locator('#n12-kcal').fill('200'); await page.locator('#n12-protein').fill('10'); await page.locator('#n12-carbs').fill('25'); await page.locator('#n12-fat').fill('5');
    await page.locator('#n12-done').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    e = (await saved(page)).entries.at(-1); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat, e.source], ['Synthetic manual bowl', 200, 10, 25, 5, 'manual']);
    assert.equal(await page.locator('#recent12 [data-entry]').count(), 2);
    assert.equal(await page.locator('#recent12 [data-entry]').first().getAttribute('data-entry'), e.id, 'newest first');
    const carbs = Math.round((await saved(page)).entries.reduce((s, x) => s + (x.carbs || 0), 0));
    await page.waitForFunction(text => document.getElementById('carbs-left').textContent === text, String(150 - carbs));
    assert.equal(await page.locator('#carbs-left-label').innerText(), 'Carbs left');

    // Own OpenAI key (the hidden fallback in Settings › AI). All AI calls are mocked with a synthetic credential.
    await page.locator('#open-settings').click(); await page.locator('#ai-more > summary').click();
    await page.locator('#ai-key').fill('synthetic-test-token'); await page.locator('#ai-key').press('Tab');
    assert.equal(await page.locator('#ai-key').getAttribute('type'), 'password');
    assert.match(await page.locator('#undo-toast').innerText(), /Key saved on this device/); assert.equal(await page.locator('#ai-status-title').innerText(), 'Own key');
    await page.locator('#close-settings').click();
    // (v11 also checked that Snap + Say switched to Estimate once a key was set; the v12 camera is the same either way.)
    let mode = 'success', calls = 0;
    const sent = [];
    await context.route('https://api.openai.com/**', async route => {
      calls++; assert.equal(route.request().headers().authorization, 'Bearer synthetic-test-token');
      const body = route.request().postDataJSON(); sent.push(body);
      assert.equal(body.store, false);
      if (mode === '401') return route.fulfill({ status: 401, body: '{}' });
      if (mode === 'bad') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'broken json' } }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ name: 'Synthetic AI meal', portion: '200 g', kcal: 400, protein: 30, carbs: 40, fat: 12 }], total: 9999 }) } }] }) });
    });
    const askAI = async () => { await addFood(); await tap(page.locator('#builder-ask-go')); await cameraOpen(); };
    const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; return c.toDataURL('image/png').split(',')[1]; });
    // The shutter, without a live camera, opens the system camera (a file input with capture) and the photo goes in.
    const upload = async () => {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#camera12-shutter').click()]);
      assert.equal(await chooser.element().getAttribute('capture'), 'environment');
      await chooser.setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    };
    await askAI(); await upload(); await cardOpen();
    assert.match(sent.at(-1).messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/, 'the photo goes as a JPEG');
    assert.deepEqual(await card(), ['400', '30', '40', '12']);
    const grams = page.getByLabel('Grams of Synthetic AI meal', { exact: true });
    assert.equal(await grams.inputValue(), '200', 'the "200 g" portion is the weight');
    await grams.fill('400'); assert.deepEqual(await card(), ['800', '60', '80', '24'], 'and the weight scales everything');
    await page.locator('#n12-fat').fill('');                                                   // an empty fat counts as 0
    assert.equal(await page.locator('#n12-done').innerText(), 'Add to meal');
    await page.locator('#n12-done').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    e = (await saved(page)).entries.at(-1); assert.deepEqual([e.source, e.kcal, e.protein, e.carbs, e.fat, e.portion], ['photo', 800, 60, 80, 0, '400 g']);
    // Every failure ends in the same friendly card: plain words, the photo kept, Search / Describe it / Retry, nothing
    // logged; a key OpenAI refuses (401) says so, with AI settings.
    for (const [next, pattern, setup] of [['401', /OpenAI didn’t accept your key[\s\S]*Check it in Settings, or search or describe it instead\./, 1], ['bad', /That answer came back garbled/, 0]]) {
      mode = next; const before = (await saved(page)).entries.length;
      await askAI(); await upload(); await trouble();
      assert.match(await page.locator('#nutrition12-body').innerText(), pattern); assert.doesNotMatch(await page.locator('#nutrition12').innerText(), /synthetic-test-token|\b401\b|undefined|TypeError/);
      for (const id of ['n12-search', 'n12-describe', 'n12-retry']) assert.equal(await page.locator('#' + id).isVisible(), true, next + ' ' + id);
      assert.equal(await page.locator('#n12-setup').count(), setup, next + ': AI settings only for the key');
      assert.equal(await page.locator('#nutrition12 .ch-nut__photo img').isVisible(), true, 'the photo is still there');
      assert.equal((await saved(page)).entries.length, before, 'nothing logged');
      await page.locator('#n12-discard').click(); await closed(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
      await page.locator('#builder-sheet').waitFor({ state: 'hidden' });
    }
    // AI settings opens Settings at the key (own-key mode), nothing on top. (From a card opened with the camera's +: from
    // the add-food sheet the sheet comes back over Settings, a v12 bug reported.) The refused words wait; Discard them.
    mode = '401'; await page.waitForTimeout(420); await tap(page.locator('#open-camera')); await cameraOpen();
    await page.locator('#camera12-describe').click(); await page.locator('#describe12').fill('Synthetic rice'); await page.locator('#describe12-go').click(); await trouble();
    assert.match(await page.locator('#nutrition12-body').innerText(), /OpenAI didn’t accept your key/);
    await page.locator('#n12-setup').click(); await page.locator('#settings').waitFor({ state: 'visible' }); await page.waitForTimeout(100);
    assert.equal(await page.locator('#ai-more').evaluate(d => d.open), true); assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-key', 'ready to fix the key');
    assert.equal(await page.evaluate(() => !!document.querySelector('dialog[open]')), false, 'nothing over Settings');
    await page.locator('#close-settings').click();
    const refused = page.locator('#recent12 .ch-food.is-draft.is-error');
    await page.waitForTimeout(420); await tap(refused); await trouble(); await page.locator('#n12-discard').click(); await closed();
    // Words only (camera › Describe it).
    mode = 'success'; await askAI(); await page.locator('#camera12-describe').click(); await page.locator('#describe12').fill('Chicken, potatoes and corn'); await page.locator('#describe12-go').click();
    await cardOpen(); assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic AI meal');
    assert.deepEqual(sent.at(-1).messages[1].content, [{ type: 'text', text: 'Chicken, potatoes and corn' }], 'words only, no image');
    await page.locator('#nutrition12-close').click(); await closed(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    await page.locator('#builder-sheet').waitFor({ state: 'hidden' });
    assert.equal(calls, 5);
    // A closed card waits in Recently eaten; Discard removes it, with Undo in the toast.
    const ready = page.locator('#recent12 .ch-food.is-draft.is-ready');
    assert.equal(await ready.count(), 1); assert.match(await ready.innerText(), /Synthetic AI meal[\s\S]*Ready/);
    await page.waitForTimeout(420); await tap(ready); await cardOpen(); await page.locator('#n12-discard').click(); await closed();
    assert.match(await page.locator('#undo-toast').innerText(), /Draft removed[\s\S]*Undo/); assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), 0);
    // Logged or discarded, every draft leaves this device's store too (a moment later: the reload below waits for it).
    for (const end = Date.now() + 15000; await storedDrafts();) { assert.ok(Date.now() < end, 'drafts left in the device store'); await page.waitForTimeout(25); }
    assert.deepEqual(errors, []);

    // Legacy custom goals and all entry extension fields survive (and one untouched copy is kept); an old day's food can
    // be logged again on that day.
    const legacy = JSON.stringify({ target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Legacy synthetic meal', kcal: 400, protein: 20, extra: 'preserve' }] });
    await page.evaluate(raw => { localStorage.removeItem('rec-calories-ai-key'); localStorage.setItem('rec-calories-v1', raw); }, legacy);
    await page.reload();
    assert.equal(await page.locator('#daily-target').inputValue(), '1900'); assert.equal(await page.locator('#protein-goal').inputValue(), '220');
    journal = await saved(page); assert.equal(journal.entries[0].extra, 'preserve'); assert.equal(journal.schemaVersion, 5); assert.equal(journal.appVersion, 12);
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-v11-backup')), legacy, 'the older journal is kept once, untouched');
    await page.evaluate(() => CHADUX.goTo('2020-01-01')); await entryCard('legacy-synthetic', 'n12-again');
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.equal(journal.entries[1].day, '2020-01-01', 'logged on the day on screen');
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));

    // An empty synthetic journal for uncluttered screenshots, then offline.
    await page.evaluate(() => localStorage.removeItem('rec-calories-v1')); await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), true);
    assert.match(await page.locator('#recent12').innerText(), /Nothing logged yet/);
    fs.mkdirSync(shots, { recursive: true });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    for (const id of ['left-line', 'remaining', 'protein-left']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= 844, id + ' on the first screen'); }
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
    // Offline search: no request, an honest note, the foods here still found, and Type it carries the words over.
    const before = off.length;
    await addFood(); await page.locator('#builder-search').fill('synthetic new food'); await page.locator('#builder-search').press('Enter');
    await page.locator('#builder-note').waitFor(); assert.match(await page.locator('#builder-note').innerText(), /Offline/);
    await page.locator('#builder-search').fill('potatoes'); await page.locator('#builder-search').press('Enter'); assert.ok(await page.locator('#builder-results [data-result=local]').count() >= 1, 'the foods here work offline');
    if (!LIVE) { await page.locator('#builder-search').fill('weet-bix'); await page.locator('#builder-search').press('Enter'); await page.locator('#builder-note').waitFor(); }
    assert.equal(off.length, before, 'nothing is requested while offline');
    await page.locator('#builder-search').fill('synthetic new food'); await tap(page.locator('#builder-type')); await cardOpen();
    assert.equal(await page.locator('#n12-name').inputValue(), 'synthetic new food');
    assert.deepEqual(errors, []);
    await context.setOffline(false); await context.close();
    console.log('PASS: mobile 390x844 light/dark, no unexpected JS/console errors; Ask AI without AI (the camera\'s other ways, no key nag, Escape back to the sheet, words end in the "not set up" card with Search / Describe it / AI settings, no request, Discard back to the sheet); barcode through the sheet into the nutrition card (P/C/F, servings scaling weight and kcal, Add to meal, Log as other food by weight) and cached; search in the sheet (one request per pause, Enter shares it, kept on the device, live after a pause); Recently eaten (kcal and P/C/F, newest first, card with Log again and Delete with Undo); recent foods first; Type it; own-key fallback in Settings: mocked photo (system camera, JPEG, ingredient grams scale, an empty fat counts as 0) and words through the camera, 401 ("OpenAI didn’t accept your key", AI settings → the key field) and bad JSON end in the friendly card with the photo kept, a closed card waits in Recently eaten, Discard with Undo, drafts leave the device store; legacy journal kept (appVersion 12, v11 backup); the hero on the first screen; offline shell with on-demand scanner; offline search: no request, an honest note, the foods here, Type it with the words; screenshots ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
