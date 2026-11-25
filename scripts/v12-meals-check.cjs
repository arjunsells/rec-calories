// Meals and the add-food sheet in a real browser (v12). The three-meal day (no breakfast, no pre-gym meal): the lunch
// go-tos one tap each with exact macros, dinner's three options with the best fit once lunch is in, Same as yesterday (a
// tag on yesterday's card; a button for a custom meal). Then the one add-food sheet, end to end, in its order: recent
// foods first, favourites (this meal's saved meals, the Quick log favourites, the foods here), search (the foods here and
// Open Food Facts, stubbed), and the three other ways, each through the nutrition card (#nutrition12, "Add to meal") and
// back: Ask AI (v12: the full-screen camera #camera12 with a synthetic canvas stream, a photo -> Analysing… -> the card;
// its Saved, Describe it and Search food; the built-in proxy address answered inside the browser; closed without a choice
// it goes straight back to the meal, and from Today it leaves no sheet open), a barcode (the scan sheet's digits,
// stubbed) and Type it (an empty card). ½ · 1 · 2 and grams − / +, remove, the running total, Undo/Redo in the
// sheet, Save as my meal (a one-tap favourite on that meal), Log (the meal, Undo in the toast), the draft across a
// reload, + Food for other food, and no AI on the device. Synthetic data only, disposable storage.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE } = require('./harness.cjs');
const scan = require('../scan9.js');
const TOKEN = 'synthetic-token-for-tests', APP = 'http://127.0.0.1:8104', key = '2026-11-24';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = await serve(8104), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });
    // The "camera": a 1280 x 960 canvas stream (synthetic), so the camera's shutter takes a real frame. No device camera.
    await context.addInitScript(() => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 960; const g = c.getContext('2d');
      const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 1280, 960); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(640, 480, 380, 0, 7); g.fill(); g.fillStyle = '#c98b3c'; g.fillRect(480, 360, 260, 160); };
      draw(); setInterval(draw, 100);
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(15) } });
    });
    // The built-in proxy address is answered here; Open Food Facts too. Nothing leaves the machine.
    const asked = [], off = [];
    await context.route(url => url.href.startsWith(scan.DEFAULT_PROXY), async route => {
      const req = route.request(), cors = { 'Access-Control-Allow-Origin': APP, 'Access-Control-Allow-Headers': 'Content-Type, X-Chad-Token', 'Access-Control-Allow-Methods': 'GET, POST' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const json = (status, data) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
      if (req.url().endsWith('/health')) return json(200, { ok: true });
      asked.push({ token: req.headers()['x-chad-token'], body: JSON.parse(req.postData() || '{}') });
      if (req.headers()['x-chad-token'] !== TOKEN) return json(401, { error: 'unauthorized' });
      await wait(600);                                                   // long enough to see "Analysing…" in Recently eaten
      return json(200, { name: 'Synthetic steak sandwich', grams: 300, kcal: 620, protein_g: 48, carbs_g: 52, fat_g: 22, confidence: 0.8, items: [] });
    });
    const product = { code: '93000001', product_name: 'Synthetic protein yoghurt', brands: 'Synthetic Co', serving_size: '170 g', serving_quantity: 170, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 9, carbohydrates_100g: 5, fat_100g: 0.5 } };
    await context.route('https://*.openfoodfacts.org/**', route => { off.push(route.request().url()); const one = route.request().url().includes('/product/'); return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify(one ? { status: 1, product } : { products: [product] }) }); });
    const page = await context.newPage(), errors = watch(page);
    await page.clock.install({ time: new Date(key + 'T12:00:00+09:30') });
    await page.goto(APP + '/');
    // Yesterday: the go-to lunch (a card today), and a custom dinner (not a card).
    await page.evaluate(token => {
      const s = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: { '2026-11-23': { picks: { L: 'S', D: 'C' }, water: 4.5 } } };
      s.entries.push({ id: 'plan-2026-11-23-L', day: '2026-11-23', name: "Nando's ½ PERi chicken", kcal: 715, protein: 108, carbs: 1.1, fat: 30.8, meal: 'Lunch', source: 'plan', planSlot: 'L' });
      s.entries.push({ id: 'plan-2026-11-23-D', day: '2026-11-23', name: 'Synthetic chook bowl', kcal: 640, protein: 52, carbs: 60, fat: 18, meal: 'Dinner', source: 'custom', planSlot: 'D', parts: [{ name: 'Roast chook, skin off', amount: '200 g', kcal: 330, protein: 56, carbs: 1, fat: 11, food: 'chook' }] });
      localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('chad.aiProxyToken', token);
    }, TOKEN);
    await page.reload();
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const undo = () => tap(page.locator('#undo-toast button'));
    const inSheet = () => tap(page.locator('#builder-undo .ch-toast__action'));                    // the sheet's own Undo / Redo
    const day = async (k = key) => (await saved(page)).questsV5?.[k] || {};
    const total = () => page.locator('#builder-total .ch-bld__kcal b').innerText();
    const items = () => page.locator('#builder-items [data-item]').evaluateAll(n => n.map(li => li.dataset.item));
    const taps = async act => { await page.evaluate(() => { if (!window.qaCounting) { window.qaCounting = true; document.addEventListener('click', () => window.qaTaps++, true); } window.qaTaps = 0; }); await act(); return page.evaluate(() => window.qaTaps); };
    // v12: the nutrition card (photo, words, barcode, typed in) and the camera.
    const card = (state = 'ready') => page.waitForFunction(s => { const d = document.getElementById('nutrition12'); return d.open && d.dataset.state === s && (s !== 'ready' || !!document.getElementById('n12-kcal')); }, state, { timeout: 15000 });
    const camera = async () => { await tap(page.locator('#builder-ask-go')); await page.waitForFunction(() => document.getElementById('camera12').open && document.getElementById('camera12-video').videoWidth > 0); };
    const addToMeal = async () => { assert.match(await page.locator('#n12-done').innerText(), /^Add to meal$/i, 'the card adds to the meal being built'); await tap(page.locator('#n12-done')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await page.locator('#nutrition12').isVisible(), false, 'back in the sheet'); };

    // 1. Lunch: the two go-tos pinned first, then Free; yesterday's go-to says so on its card (no extra button).
    assert.deepEqual(await page.evaluate(() => CHADPlan.map(s => s.name)), ['Lunch', 'Dinner', 'Snack']);
    assert.doesNotMatch(await page.locator('#today').innerText(), /breakfast|pre-gym/i);
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');
    assert.deepEqual(await page.locator('#now .ch-opt').evaluateAll(n => n.map(e => [e.querySelector('.meal-pick').dataset.tier, e.classList.contains('is-pinned')])), [['S', true], ['M', true], ['F', false]]);
    assert.equal(await page.locator('#now [data-yesterday]').getAttribute('data-tier'), 'S'); assert.match(await page.locator('#now [data-yesterday]').innerText(), /Same as yesterday[\s\S]*Nando's ½ PERi chicken/i);
    assert.equal(await page.locator('[data-again]').count(), 0, 'yesterday’s lunch is a card: one tap on it is Same as yesterday');
    assert.equal(await page.locator('#after-now [data-custom=L]').count(), 1, 'Custom lunch, one scroll down');
    assert.equal(await taps(() => tap(page.locator('#now [data-tier=S]'))), 1);
    let j = await saved(page), e = j.entries.find(x => x.day === key && x.planSlot === 'L');
    assert.equal(j.questsV5[key].picks.L, 'S'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ["Nando's ½ PERi chicken", 715, 108, 1.1, 30.8]);
    await undo(); assert.equal((await day()).picks?.L, undefined); await undo(); assert.equal((await day()).picks.L, 'S', 'Undo, then Redo');
    // The Medium go-to is one tap too (a switch, never a duplicate) from Later today, and back.
    await again(page.locator('#later-toggle')); await tap(page.locator('#later-more [data-slot=L][data-tier=M]'));
    e = (await saved(page)).entries.filter(x => x.day === key && x.planSlot === 'L'); assert.equal(e.length, 1); assert.deepEqual([e[0].name, e[0].kcal, e[0].protein, e[0].carbs, e[0].fat], ["Gochi + 4 Nando's tenders", 445, 71.4, 25.9, 9.1]);
    await undo(); assert.equal((await day()).picks.L, 'S'); await again(page.locator('#later-toggle'));

    // 2. 7 pm: dinner on top, with the best fit after the ½ chicken (Strict), and yesterday's custom dinner as a button.
    await page.clock.setFixedTime(new Date(key + 'T19:00:00+09:30')); await page.reload();
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'D');
    assert.equal(await page.locator('#remaining').innerText(), '1,185'); assert.equal(await page.locator('#protein-left').innerText(), '112');
    assert.equal(await page.locator('#now [data-best]').getAttribute('data-tier'), 'S'); assert.equal(await page.locator('#now .is-best').count(), 1, 'one best fit');
    const againButton = page.locator('#after-now [data-again]');
    assert.match(await againButton.innerText(), /Same as yesterday[\s\S]*640 kcal/i); assert.match(await againButton.getAttribute('aria-label'), /Synthetic chook bowl/);
    assert.equal(await taps(() => tap(againButton)), 1);
    j = await saved(page); e = j.entries.find(x => x.day === key && x.planSlot === 'D');
    assert.equal(j.questsV5[key].picks.D, 'C'); assert.deepEqual([e.name, e.kcal, e.protein, e.source, e.parts.length], ['Synthetic chook bowl', 640, 52, 'custom', 1]);
    await undo(); assert.equal((await day()).picks?.D, undefined); assert.equal((await saved(page)).entries.some(x => x.day === key && x.planSlot === 'D'), false, 'Undo takes it back exactly');
    await undo(); assert.equal((await day()).picks.D, 'C'); await undo();

    // 3. Custom dinner: the add-food sheet, recent first.
    await again(page.locator('#after-now [data-custom=D]'));
    assert.equal(await page.locator('#builder-sheet').isVisible(), true); assert.equal(await page.locator('#builder-title').innerText(), 'Custom dinner');
    assert.equal(await page.locator('#builder-slots, #builder-name, #builder-ask').count(), 0, 'fewer steps: no meal switch, no name field, no AI text box in the sheet');
    assert.equal(await total(), '0'); assert.equal(await page.locator('#builder-log').isDisabled(), true); assert.equal(await page.locator('#builder-save').isDisabled(), true);
    const order = await page.evaluate(() => [...document.querySelectorAll('#builder-body > h3')].map(h => h.textContent));
    assert.deepEqual(order, ['Recent', 'Favourites', 'Search', 'More ways'], 'recent first, then favourites, then search, then Ask AI / Barcode / Type it');
    assert.deepEqual(await page.locator('#builder-recent [data-food]').evaluateAll(n => n.map(b => b.dataset.food)), ['chook'], 'the roast chook from yesterday’s custom dinner is recent');
    assert.deepEqual((await page.locator('#builder-chips [data-food]').evaluateAll(n => n.map(b => b.dataset.food))).slice(0, 2), ['yopro-pouch', 'gochi-noodle'], 'favourites: the Quick log two first');
    assert.equal(await page.locator('#builder-chips [data-food=chook]').count(), 0, 'never the same food twice');
    // Grams: a tap adds 200 g of roast chook; + and − step 50 g; Undo and Redo in the sheet.
    await tap(page.locator('#builder-recent [data-food=chook]')); assert.deepEqual(await items(), ['chook']); assert.equal(await total(), '330');
    assert.match(await page.locator('#builder-undo').innerText(), /Added Roast chook, skin off[\s\S]*Undo/);
    await tap(page.locator('#builder-items [data-item=chook] .ch-bld__step').last()); assert.equal(await total(), '413'); assert.match(await page.locator('#builder-items [data-item=chook]').innerText(), /250 g/);
    await inSheet(); assert.equal(await total(), '330', 'Undo in the sheet'); await inSheet(); assert.equal(await total(), '413', 'Redo in the sheet');
    await tap(page.locator('#builder-items [data-item=chook] .ch-bld__step').first()); assert.equal(await total(), '330');
    // Portions: YoPRO as ½ · 1 · 2; remove and Undo.
    await tap(page.locator('#builder-chips [data-food=potatoes]')); await tap(page.locator('#builder-chips [data-food=yopro]'));
    assert.deepEqual(await items(), ['chook', 'potatoes', 'yopro']); assert.equal(await total(), '646');
    const yo = page.locator('#builder-items [data-item=yopro]');
    assert.equal(await yo.locator('.ch-bld__q[aria-pressed=true]').innerText(), '1');
    await tap(yo.locator('.ch-bld__q', { hasText: '2' })); assert.equal(await total(), '737'); assert.match(await yo.innerText(), /2 × 1 pot/);
    await tap(yo.locator('.ch-bld__q', { hasText: '½' })); assert.equal(await total(), '601');
    await tap(yo.locator('.ch-bld__x')); assert.deepEqual(await items(), ['chook', 'potatoes']); assert.equal(await total(), '555');
    await inSheet(); assert.deepEqual(await items(), ['chook', 'potatoes', 'yopro'], 'a removed item comes back with Undo'); await inSheet(); assert.equal(await total(), '555');
    assert.match(await page.locator('#builder-total').innerText(), /555[\s\S]*kcal[\s\S]*P\s*62[\s\S]*C\s*48[\s\S]*F\s*11[\s\S]*2 items/, 'the running total, kcal and P/C/F');
    // Search: the foods here at once, then Open Food Facts after a pause (one request).
    await page.locator('#builder-search').fill('yoghurt');
    assert.ok(await page.locator('#builder-results [data-result=local]').count() >= 1, 'the foods here first');
    await page.clock.runFor(500); await page.locator('#builder-results [data-result=off]').first().waitFor({ timeout: 10000 }); assert.equal(off.filter(u => u.includes('search')).length, 1, 'one request per pause');
    await tap(page.locator('#builder-results [data-result=off]').first()); assert.equal(await total(), '657', '+ 170 g of the synthetic yoghurt (102 kcal)');
    assert.match(await page.locator('#builder-items').innerText(), /Synthetic Co Synthetic protein yoghurt[\s\S]*170 g/);
    // Ask AI (v12): the full-screen camera (one sheet at a time) -> the shutter takes a photo -> "Analysing…" in Recently
    // eaten -> the nutrition card opens by itself with "Add to meal" (the v11 confirm sheet and its meal field are gone:
    // the meal is already chosen) -> half a serving -> back in the sheet with the item.
    await camera(); assert.equal(await page.locator('#builder-sheet').isVisible(), false, 'one sheet at a time');
    assert.equal(await page.locator('#camera12-title').textContent(), 'Scan food'); assert.equal(await page.locator('[data-mode12=food]').getAttribute('aria-pressed'), 'true');
    for (const id of ['camera12-search', 'camera12-saved', 'camera12-describe']) assert.equal(await page.locator('#' + id).isVisible(), true, id + ': the other ways on the same screen');
    await tap(page.locator('#camera12-shutter'));
    await page.waitForFunction(() => !document.getElementById('camera12').open && /Analysing/.test(document.querySelector('#recent12 .ch-food.is-pending')?.textContent || ''));
    await card();
    assert.equal(asked.length, 1); assert.equal(asked[0].token, TOKEN); assert.match(asked[0].body.image, /^data:image\/jpeg;base64,/, 'the photo goes to the built-in address'); assert.equal(asked[0].body.text, '', 'a plain photo, no words');
    assert.equal(await page.locator('#nutrition12-title').textContent(), 'Nutrition'); assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
    assert.equal(await page.locator('#nutrition12 select').count(), 0, 'no meal to pick: the meal is already chosen');
    assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic steak sandwich'); assert.equal(await page.locator('#n12-kcal').inputValue(), '620');
    assert.equal(await page.locator('#nutrition12 .ch-nut__photo img').count(), 1, 'the photo is on the card');
    await tap(page.locator('#n12-less')); assert.equal(await page.locator('#n12-servings').textContent(), '0.5'); assert.equal(await page.locator('#n12-kcal').inputValue(), '310', 'the card still scales: half a serving (150 of 300 g)');
    await addToMeal();
    assert.equal(await total(), '967'); assert.match(await page.locator('#builder-items').innerText(), /Synthetic steak sandwich[\s\S]*150 g/);
    assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), 0, 'added to the meal: no draft left in Recently eaten');
    assert.equal((await saved(page)).entries.some(x => x.name === 'Synthetic steak sandwich'), false, 'added to the meal, never logged on its own');
    // Closed without a photo, a lookup or a search, the camera goes straight back to the sheet with the meal: its ×,
    // Escape, and its own Saved and Describe it sheets closed without a choice (Escape). Nothing reopens it here.
    const backInSheet = async how => { await page.waitForFunction(() => document.getElementById('builder-sheet').open && document.querySelectorAll('dialog[open]').length === 1, null, { timeout: 2000 }); assert.equal(await total(), '967', how + ': back in the sheet, the meal intact'); };
    const sheetOf = async (id, title) => { await tap(page.locator('#' + id)); await page.waitForFunction(t => document.getElementById('detail-sheet').open && document.getElementById('detail-title').textContent === t && !document.getElementById('camera12').open, title); };
    await camera(); await tap(page.locator('#camera12-close')); await backInSheet('the camera’s ×');
    await camera(); await page.keyboard.press('Escape'); await backInSheet('Escape on the camera');
    await camera(); await sheetOf('camera12-saved', 'Saved foods'); await page.keyboard.press('Escape'); await backInSheet('Saved, closed without a choice');
    await camera(); await sheetOf('camera12-describe', 'Describe it'); await page.locator('#describe12').waitFor(); await page.keyboard.press('Escape'); await backInSheet('Describe it, closed without words');
    // A choice in Saved opens the card instead ("Add to meal"), and back with it.
    await camera(); await sheetOf('camera12-saved', 'Saved foods'); await tap(page.locator('#detail-sheet').getByRole('button', { name: /^YoPRO Perform pouch, 120 kcal/ }));
    await card(); assert.equal(await page.locator('#n12-name').inputValue(), 'YoPRO Perform pouch'); await addToMeal(); assert.equal(await total(), '1,087');
    await tap(page.locator('#builder-items .ch-bld__x').last()); assert.equal(await total(), '967');
    // From Today (the tab bar's +) there is no meal to go back to: closing leaves no sheet open. The meal waits.
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    const fromToday = async () => { await again(page.locator('#open-camera')); await page.waitForFunction(() => document.getElementById('camera12').open); };
    const noSheet = async how => { await page.waitForTimeout(300); assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 0, how + ' from Today: no sheet left open'); };
    await fromToday(); await tap(page.locator('#camera12-close')); await noSheet('the camera’s ×');
    await fromToday(); await page.keyboard.press('Escape'); await noSheet('Escape on the camera');
    await fromToday(); await sheetOf('camera12-saved', 'Saved foods'); await page.keyboard.press('Escape'); await noSheet('Saved, closed without a choice');
    await fromToday(); await sheetOf('camera12-describe', 'Describe it'); await page.locator('#describe12').waitFor(); await page.keyboard.press('Escape'); await noSheet('Describe it, closed without words');
    await again(page.locator('#after-now [data-custom=D]')); assert.equal(await total(), '967', 'the meal waits in its sheet');
    // The camera's Search food goes back to the sheet; its Describe it (words, no photo) opens the card, and closing the
    // card without adding goes back to the sheet too, the meal intact.
    await camera(); await tap(page.locator('#camera12-search')); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#camera12').isVisible(), false); assert.equal(await total(), '967', 'Search food: back to the meal');
    await camera(); await tap(page.locator('#camera12-describe')); await page.locator('#describe12').fill('another one'); await tap(page.locator('#describe12-go'));
    await card(); assert.equal(asked.length, 2); assert.equal(asked[1].body.text, 'another one'); assert.equal(asked[1].body.image, null, 'words only');
    assert.match(await page.locator('#n12-done').innerText(), /^Add to meal$/i);
    await tap(page.locator('#nutrition12-close')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '967', 'closed the card: back to the meal');
    // A barcode: the scan sheet's digits (Open Food Facts stubbed), then the same card, Add to meal.
    await tap(page.locator('#builder-barcode')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); assert.equal(await page.locator('#scan').getAttribute('data-mode'), 'barcode');
    await page.locator('#barcode').fill('93000001'); await tap(page.locator('#barcode-form button')); await card();
    assert.equal(await page.locator('#scan-sheet').isVisible(), false, 'one sheet at a time'); assert.equal(await page.locator('#n12-kcal').inputValue(), '102');
    await addToMeal(); assert.equal(await total(), '1,069');
    await tap(page.locator('#builder-items .ch-bld__x').last()); assert.equal(await total(), '967');
    // Type it in: the card, calories empty, with the search words as the name.
    await page.locator('#builder-search').fill('Synthetic gravy'); await tap(page.locator('#builder-type')); await card();
    assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic gravy'); assert.equal(await page.locator('#n12-kcal').inputValue(), '', 'Type it: the calories start empty');
    await page.locator('#n12-kcal').fill('60'); await page.locator('#n12-carbs').fill('8'); await addToMeal();
    assert.equal(await total(), '1,027'); assert.match(await page.locator('#builder-items').innerText(), /Synthetic gravy[\s\S]*1 serving/);
    await tap(page.locator('#builder-items .ch-bld__x').last()); assert.equal(await total(), '967');
    // Save: kept on this meal, with Undo and Redo in the sheet.
    const before = await saved(page);
    await tap(page.locator('#builder-save')); j = await saved(page);
    assert.equal(j.myMeals.length, 1); assert.equal(j.myMeals[0].slot, 'D'); assert.equal(Math.round(j.myMeals[0].macros[0]), 967); assert.equal(j.myMeals[0].parts.length, 4);
    assert.match(await page.locator('#builder-undo').innerText(), /Saved as my meal · on dinner/); assert.match(await page.locator('#builder-save').innerText(), /Saved/);
    await inSheet(); assert.deepEqual(await saved(page), before, 'Undo puts back exactly the journal it found'); assert.match(await page.locator('#builder-save').innerText(), /^\s*Save\s*$/);
    await inSheet(); assert.equal((await saved(page)).myMeals.length, 1, 'Redo saves it again');
    // Log: fills dinner (Custom), with what is in it; Undo in the toast.
    assert.match(await page.locator('#builder-log').innerText(), /Log dinner[\s\S]*967 kcal/);
    await tap(page.locator('#builder-log')); assert.equal(await page.locator('#builder-sheet').isVisible(), false);
    j = await saved(page); e = j.entries.find(x => x.day === key && x.planSlot === 'D');
    assert.equal(j.questsV5[key].picks.D, 'C'); assert.equal(e.name, 'Roast chook + Microwave baby potatoes + more', 'a name made of whole names'); assert.equal(Math.round(e.kcal), 967); assert.equal(e.source, 'custom'); assert.equal(e.parts.length, 4);
    assert.match(await page.locator('#undo-toast').innerText(), /Dinner logged/);
    await undo(); assert.equal((await day()).picks?.D, undefined); await undo(); assert.equal((await day()).picks.D, 'C');
    assert.equal(await page.evaluate(() => localStorage.getItem('chad.builder')), null, 'a logged meal leaves no draft');
    // The saved meal: a one-tap favourite on dinner (Later today), and the first favourite in its sheet.
    // v12: water has its own card all day and is never the thing to do now; with dinner in and protein within 20 g of the
    // goal (no snack needed), the evening's next thing is the wrap-up.
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'wrap', 'dinner in, protein within 20 g of the goal (no snack needed): the wrap-up');
    assert.equal(await page.locator('#now [data-water]').count(), 0); assert.equal(await page.locator('#water-slot #water12').count(), 1);
    await again(page.locator('#later-toggle'));
    const mine = page.locator('#later-more [data-later-slot=D] [data-my-meal]');
    assert.equal(await mine.count(), 1); assert.match(await mine.innerText(), /967 kcal/); assert.equal(await mine.getAttribute('aria-pressed'), 'true', 'it is what was logged');
    await tap(mine); assert.equal((await day()).picks?.D, undefined, 'tapping the logged favourite removes it');
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'D', 'dinner is the thing to do again');
    const under = page.locator('#after-now .ch-other [data-my-meal]'); assert.equal(await under.count(), 1, 'and its saved meal sits right under it');
    await again(under); assert.equal((await day()).picks.D, 'C', 'one tap logs it');
    if (await page.locator('#later-toggle').getAttribute('aria-expanded') !== 'true') await again(page.locator('#later-toggle'));
    await again(page.locator('#later-more [data-later-slot=D] [data-custom]')); assert.equal(await page.locator('#builder-chips [data-food^="mine:"]').count(), 1); assert.equal(await page.locator('#builder-chips [data-food]').first().getAttribute('data-food'), 'mine:' + j.myMeals[0].id);
    await page.keyboard.press('Escape'); await page.locator('#builder-sheet').waitFor({ state: 'hidden' });

    // 4. The draft survives closing the sheet and a reload; Log empties it.
    await again(page.locator('#after-now [data-custom=P]')); assert.equal(await page.locator('#builder-title').innerText(), 'Custom snack');
    await tap(page.locator('#builder-chips [data-food=yopro-pouch]')); await tap(page.locator('#builder-sheet [data-close=builder-sheet]'));
    await page.reload(); await tap(page.locator('#later-toggle')); await tap(page.locator('#later-more [data-later-slot=P] [data-custom]')); assert.deepEqual(await items(), ['yopro-pouch'], 'the draft is kept on this device');
    await tap(page.locator('#builder-log')); assert.equal((await day()).picks.P, 'C'); assert.equal(await page.evaluate(() => localStorage.getItem('chad.builder')), null);
    // + Food (other food): no meal, no Save; one food is logged as itself, the Quick log count follows.
    await again(page.locator('#add-food')); assert.equal(await page.locator('#builder-title').innerText(), 'Add food'); assert.equal(await page.locator('#builder-save').isVisible(), false, 'Save is for meals');
    await tap(page.locator('#builder-chips [data-food=gochi-noodle]')); assert.match(await page.locator('#builder-log').innerText(), /^Log[\s\S]*225 kcal/);
    await tap(page.locator('#builder-log')); e = (await saved(page)).entries.at(-1);
    assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat, e.fav, e.planSlot], ['Gochi noodle meal', 225, 31.8, 25.2, 2.6, 'gochi-noodle', undefined]); assert.match(await page.locator('#quick [data-fav=gochi-noodle]').innerText(), /×1/);
    await undo(); assert.equal((await saved(page)).entries.some(x => x.fav === 'gochi-noodle'), false);
    // Without AI on this device (no token): Ask AI -> the camera -> Describe it. The card says so honestly and points to
    // AI settings; nothing is sent; Search food takes the words back to the sheet, where Type it uses them as the name.
    await page.evaluate(() => localStorage.removeItem('chad.aiProxyToken')); await page.reload();
    const sent = asked.length;
    await tap(page.locator('#add-food')); await camera();
    await tap(page.locator('#camera12-describe')); await page.locator('#describe12').fill('Synthetic lasagne'); await tap(page.locator('#describe12-go'));
    await card('error');
    assert.match(await page.locator('#nutrition12-body').textContent(), /Pair this phone first[\s\S]*Photo AI isn’t set up on this phone[\s\S]*Settings › AI estimates/);
    assert.equal(await page.locator('#n12-setup').isVisible(), true, 'AI settings, one tap away'); assert.equal(asked.length, sent, 'nothing sent without a token');
    await tap(page.locator('#n12-search')); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#builder-title').innerText(), 'Add food'); assert.equal(await page.locator('#builder-search').inputValue(), 'Synthetic lasagne', 'the words go along');
    await tap(page.locator('#builder-type')); await card(); assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic lasagne', 'and on to Type it');
    await tap(page.locator('#nutrition12-close')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-chips [data-food=eggs]')); assert.equal(await total(), '144');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS v12 meals + the add-food sheet: Lunch / Dinner / Snack only, lunch go-tos pinned and 1 tap each with exact macros (715/108/1.1/30.8, 445/71.4/25.9/9.1), Undo/Redo; dinner after lunch with 1,185 / 112 left and the Strict Best fit; Same as yesterday (tag on a card, a button for a custom dinner, 1 tap, Undo/Redo); the sheet in order Recent -> Favourites -> Search -> More ways (no meal switch, name field or AI box), recent from yesterday’s custom dinner, the Quick log two first among favourites, grams − / + and ½ · 1 · 2, remove, running total, Undo/Redo in the sheet; search (foods here + Open Food Facts, one request); Ask AI = the camera: a photo (synthetic stream) -> Analysing… -> the nutrition card by itself (built-in address answered in the browser) -> ½ serving -> Add to meal -> back in the sheet; closed without a choice (×, Escape, Saved or Describe it + Escape) straight back to the meal, from Today no sheet left open; a Saved pick, Search food and Describe it from the camera, closing the card goes back; barcode digits and Type it (empty calories) into the same card; Save (exact Undo, Redo); Log dinner (Undo/Redo), then the wrap-up is next (water never the thing to do now); the saved meal as a 1-tap favourite (tap again removes) and first in its sheet; the draft across a reload; + Food logs other food as itself (Quick log ×1); no AI: an honest card with AI settings, nothing sent, the words go to Search and Type it.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
