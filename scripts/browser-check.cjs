// Food and AI flows end to end, all through v11's one add-food sheet (+ Food / Custom): Ask AI without AI, a barcode,
// search (the foods here and Open Food Facts), Type it, the food list under the line (log again, delete), an own OpenAI
// key, legacy data, and offline. Open Food Facts and OpenAI are mocked; a synthetic key and journal only.
// Set CHAD_LIVE_FOOD=1 to let the Open Food Facts requests reach the real service.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v11-regression');
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
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.click(); };
    const addFood = async () => { await page.waitForTimeout(420); await tap(page.locator('#add-food')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); };
    const details = async open => { if ((await page.locator('#left-line').getAttribute('aria-expanded') === 'true') !== open) await tap(page.locator('#left-line')); };
    const sheetRow = async (id, action) => { await details(true); await tap(page.locator(`#entries [data-entry="${id}"] .entry-open`)); await page.locator('#detail-sheet').getByRole('button', { name: action }).click(); };
    const card = () => page.evaluate(() => ['grams', 'kcal', 'protein', 'carbs', 'fat'].map(k => document.getElementById('result-' + k).value));

    // Ask AI without any AI: no key nagging, the three other ways.
    await addFood(); await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#snap-ways').isVisible(), true); assert.match(await page.locator('#snap-ways').innerText(), /Search[\s\S]*Barcode[\s\S]*Type it/);
    assert.match(await page.locator('#snap-hint').innerText(), /Settings/); assert.doesNotMatch(await page.locator('#scan-sheet').innerText(), /OpenAI|API key/);
    await page.keyboard.press('Escape'); await page.locator('#builder-sheet').waitFor({ state: 'visible' });

    // Barcode: one lookup opens the card directly; the product is remembered; Add to meal, then Log.
    await tap(page.locator('#builder-barcode')); await page.locator('#scan-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#camera-panel').isVisible(), false, 'barcode mode shows only barcode controls');
    await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
    await page.locator('#confirm-sheet').waitFor({ state: 'visible', timeout: 45000 });
    assert.match(await page.locator('#result-name').inputValue(), /Weet/i); assert.equal(await page.locator('#confirm-log').innerText(), 'Add to meal');
    const kcal = Number((await card())[1]);
    if (!process.env.CHAD_LIVE_FOOD) assert.deepEqual(await card(), ['40', '160', '4', '24', '1.2'], 'one 40 g serving, all four macros, editable');
    const grams = Number((await card())[0]); await page.locator('#result-grams').fill(String(grams * 1.5));
    assert.equal(Number((await card())[1]), Math.round(kcal * 1.5), 'the weight scales everything');
    await page.locator('#scan-confirm-form button[type=submit]').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    await tap(page.locator('#builder-log'));
    let journal = await saved(page), e = journal.entries.at(-1);
    assert.deepEqual([e.source, e.kcal, e.portion, e.planSlot], ['barcode', Math.round(kcal * 1.5), `${grams * 1.5} g`, undefined], 'logged as itself (other food)');
    assert.match(await page.locator('#undo-toast').innerText(), /Weet/i);
    if (!process.env.CHAD_LIVE_FOOD) {
      assert.equal(off.filter(u => u.includes('/product/')).length, 1);
      await addFood(); await tap(page.locator('#builder-barcode')); await page.locator('#barcode').fill('9300652010794'); await page.locator('#barcode-form button').click();
      await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
      assert.equal(off.filter(u => u.includes('/product/')).length, 1, 'a known barcode costs no request');
      await page.locator('#cancel-scan').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    } else await addFood();

    // Search: the foods here at once, Open Food Facts after a pause; typing then Search is one request; results list
    // kcal and P/C/F; the answer is kept on the device.
    await page.locator('#builder-search').fill('weet-bix'); await page.locator('#builder-search').press('Enter');
    await page.locator('#builder-results [data-result=off]').first().waitFor({ timeout: 45000 });
    assert.match(await page.locator('#builder-results').innerText(), /Weet/i);
    if (!process.env.CHAD_LIVE_FOOD) assert.match(await page.locator('#builder-results [data-result=off]').first().innerText(), /40 g[\s\S]*P\s?4[\s\S]*C\s?24[\s\S]*F\s?1/);
    const realProduct = (await page.locator('#builder-results [data-result=off]').first().innerText()).replaceAll('\n', ' ');
    if (!process.env.CHAD_LIVE_FOOD) {
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

    // The food under the line: kcal and P/C/F; Log again and Delete, each with Undo.
    await details(true); assert.match(await page.locator('#entries .entry-open').first().innerText(), /kcal[\s\S]*P[\s\S]*C[\s\S]*F/, 'food rows show kcal and P/C/F');
    const barcodeId = e.id;
    await sheetRow(barcodeId, 'Log again');
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.equal(journal.entries.at(-1).source, 'repeat');
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, 1, 'Undo removes the repeated entry');
    await sheetRow(barcodeId, 'Delete'); assert.equal((await saved(page)).entries.length, 0);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, 1, 'Delete undone');
    // The recent foods: what was logged comes first next time.
    await addFood(); assert.match(await page.locator('#builder-recent').innerText(), /Weet/i, 'recent first'); await page.keyboard.press('Escape');
    // Type it: the card, empty; Add to meal; Log. The line follows.
    await addFood(); await tap(page.locator('#builder-type')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    await page.locator('#result-name').fill('Synthetic manual bowl'); await page.locator('#result-kcal').fill('200'); await page.locator('#result-protein').fill('10'); await page.locator('#result-carbs').fill('25'); await page.locator('#result-fat').fill('5');
    await page.locator('#scan-confirm-form button[type=submit]').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    e = (await saved(page)).entries.at(-1); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat, e.source], ['Synthetic manual bowl', 200, 10, 25, 5, 'manual']);
    await details(true); assert.equal(await page.locator('#entries .entry').count(), 2);
    const carbs = Math.round((await saved(page)).entries.reduce((s, x) => s + (x.carbs || 0), 0));
    assert.equal(await page.locator('#carbs-left').innerText(), String(150 - carbs)); await details(false);

    // Own OpenAI key (the hidden fallback in Settings › AI). All AI calls are mocked with a synthetic credential.
    await page.locator('#open-settings').click(); await page.locator('#ai-more > summary').click();
    await page.locator('#ai-key').fill('synthetic-test-token'); await page.locator('#ai-key').press('Tab');
    assert.equal(await page.locator('#ai-key').getAttribute('type'), 'password');
    assert.match(await page.locator('#undo-toast').innerText(), /Key saved on this device/); assert.equal(await page.locator('#ai-status-title').innerText(), 'Own key');
    await page.locator('#close-settings').click();
    let mode = 'success', calls = 0;
    await page.route('https://api.openai.com/**', async route => {
      calls++; assert.equal(route.request().headers().authorization, 'Bearer synthetic-test-token');
      assert.equal(route.request().postDataJSON().store, false);
      if (mode === '401') return route.fulfill({ status: 401, body: '{}' });
      if (mode === 'bad') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'broken json' } }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ name: 'Synthetic AI meal', portion: '200 g', kcal: 400, protein: 30, carbs: 40, fat: 12 }], total: 9999 }) } }] }) });
    });
    const askAI = async () => { await addFood(); await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); };
    await askAI();
    assert.equal(await page.locator('#snap-ways').isVisible(), false); assert.equal(await page.locator('#describe-button').isVisible(), true);
    const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; return c.toDataURL('image/png').split(',')[1]; });
    const upload = () => page.locator('#photo-input').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    await upload(); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.deepEqual(await card(), ['200', '400', '30', '40', '12'], 'the "200 g" portion is the weight');
    await page.locator('#result-grams').fill('400'); assert.deepEqual(await card(), ['400', '800', '60', '80', '24']);
    await page.locator('#scan-confirm-form button[type=submit]').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    e = (await saved(page)).entries.at(-1); assert.deepEqual([e.source, e.kcal, e.portion], ['photo', 800, '400 g']);
    for (const [next, pattern] of [['401', /OpenAI didn’t accept your key/], ['bad', /garbled/]]) {
      mode = next; await askAI(); await upload();
      await page.locator('#snap-ways').waitFor({ state: 'visible' });
      assert.match(await page.locator('#snap-ways').innerText(), pattern); assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
      await page.keyboard.press('Escape'); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    }
    // Text only ("Say").
    mode = 'success'; await askAI(); await page.locator('#food-description').fill('Chicken, potatoes and corn'); await page.locator('#describe-button').click();
    await page.locator('#confirm-sheet').waitFor({ state: 'visible' }); await page.locator('#cancel-scan').click(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    assert.equal(calls, 4);
    assert.deepEqual(errors, []);

    // Legacy custom goals and all entry extension fields survive; an old day's food can be logged again on that day.
    await page.evaluate(() => { localStorage.removeItem('rec-calories-ai-key'); localStorage.setItem('rec-calories-v1', JSON.stringify({ target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Legacy synthetic meal', kcal: 400, protein: 20, extra: 'preserve' }] })); });
    await page.reload();
    assert.equal(await page.locator('#daily-target').inputValue(), '1900'); assert.equal(await page.locator('#protein-goal').inputValue(), '220');
    journal = await saved(page); assert.equal(journal.entries[0].extra, 'preserve'); assert.equal(journal.schemaVersion, 5); assert.equal(journal.appVersion, 11);
    await page.evaluate(() => CHADUX.goTo('2020-01-01')); await sheetRow('legacy-synthetic', 'Log again');
    journal = await saved(page); assert.equal(journal.entries.length, 2); assert.equal(journal.entries[1].day, '2020-01-01', 'logged on the day on screen');
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));

    // An empty synthetic journal for uncluttered screenshots, then offline.
    await page.evaluate(() => localStorage.removeItem('rec-calories-v1')); await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), true);
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
    if (!process.env.CHAD_LIVE_FOOD) { await page.locator('#builder-search').fill('weet-bix'); await page.locator('#builder-search').press('Enter'); await page.locator('#builder-note').waitFor(); }
    assert.equal(off.length, before, 'nothing is requested while offline');
    await page.locator('#builder-search').fill('synthetic new food'); await tap(page.locator('#builder-type')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-name').inputValue(), 'synthetic new food');
    assert.deepEqual(errors, []);
    await context.setOffline(false); await context.close();
    console.log('PASS: mobile 390x844 light/dark, no unexpected JS/console errors; Ask AI without AI (three other ways, no key nag); barcode through the sheet into the card (P/C/F, weight scaling, Add to meal, Log as other food) and cached; search in the sheet (one request per pause, Enter shares it, kept on the device, live after a pause); the food list under the line (kcal and P/C/F, Log again and Delete with Undo); recent foods first; Type it; own-key fallback in Settings: mocked photo/text success, 401 and bad JSON end in the gentle fallback; legacy journal kept (appVersion 11); the line on the first screen; offline shell with on-demand scanner; offline search: no request, an honest note, the foods here, Type it with the words; screenshots ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
