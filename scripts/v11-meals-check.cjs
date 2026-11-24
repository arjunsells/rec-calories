// Meals and the add-food sheet in a real browser. The three-meal day (no breakfast, no pre-gym meal): the lunch go-tos
// one tap each with exact macros, dinner's three options with the best fit once lunch is in, Same as yesterday (a tag on
// yesterday's card; a button for a custom meal). Then the one add-food sheet, end to end, in its order: recent foods
// first, favourites (this meal's saved meals, the Quick log favourites, the foods here), search (the foods here and Open
// Food Facts, stubbed), and the three other ways, each through the editable card and back with "Add to meal": Ask AI
// (the built-in proxy address answered inside the browser), a barcode (stubbed), and typing it in. ½ · 1 · 2 and
// grams − / +, remove, the running total, Undo/Redo in the sheet, Save as my meal (a one-tap favourite on that meal),
// Log (the meal, Undo in the toast), the draft across a reload, + Food for other food, and no AI on the device.
// Synthetic data only, disposable storage.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE } = require('./harness.cjs');
const scan = require('../scan9.js');
const TOKEN = 'synthetic-token-for-tests', APP = 'http://127.0.0.1:8104', key = '2026-11-24';

(async () => {
  const server = await serve(8104), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });
    // The built-in proxy address is answered here; Open Food Facts too. Nothing leaves the machine.
    const asked = [], off = [];
    await context.route(url => url.href.startsWith(scan.DEFAULT_PROXY), route => {
      const req = route.request(), cors = { 'Access-Control-Allow-Origin': APP, 'Access-Control-Allow-Headers': 'Content-Type, X-Chad-Token', 'Access-Control-Allow-Methods': 'GET, POST' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const json = (status, data) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
      if (req.url().endsWith('/health')) return json(200, { ok: true });
      asked.push({ token: req.headers()['x-chad-token'], body: JSON.parse(req.postData() || '{}') });
      if (req.headers()['x-chad-token'] !== TOKEN) return json(401, { error: 'unauthorized' });
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
    // Ask AI: the food sheet (words here; the keyboard mic types into the same field) -> the card -> Add to meal -> back.
    await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); assert.equal(await page.locator('#builder-sheet').isVisible(), false, 'one sheet at a time');
    assert.equal(await page.locator('#scan-title').innerText(), 'Ask AI'); assert.equal(await page.locator('#describe-button').isVisible(), true);
    await page.locator('#food-description').fill('steak sandwich'); await tap(page.locator('#describe-button'));
    await page.locator('#confirm-sheet').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(asked.length, 1); assert.equal(asked[0].token, TOKEN); assert.equal(asked[0].body.text, 'steak sandwich');
    assert.equal(await page.locator('#confirm-title').innerText(), 'Add to your meal'); assert.equal(await page.locator('#confirm-log').innerText(), 'Add to meal');
    assert.equal(await page.locator('#scan-meal-field').isVisible(), false, 'the meal is already chosen');
    assert.equal(await page.locator('#result-name').inputValue(), 'Synthetic steak sandwich'); assert.equal(await page.locator('#result-kcal').inputValue(), '620');
    await page.locator('#result-grams').fill('150'); assert.equal(await page.locator('#result-kcal').inputValue(), '310', 'the card still scales by weight');
    await tap(page.locator('#confirm-log'));
    assert.equal(await page.locator('#builder-sheet').isVisible(), true, 'back in the sheet'); assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
    assert.equal(await total(), '967'); assert.match(await page.locator('#builder-items').innerText(), /Synthetic steak sandwich[\s\S]*150 g/);
    // Closing the AI sheet, or the card, without adding goes back too, the meal intact.
    await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '967', 'closed the AI sheet: back to the meal');
    await tap(page.locator('#builder-ask-go')); await page.locator('#food-description').fill('another one'); await tap(page.locator('#describe-button')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    await tap(page.locator('#cancel-scan')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '967', 'closed the card: back to the meal');
    // A barcode: the same card, Add to meal.
    await tap(page.locator('#builder-barcode')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); assert.equal(await page.locator('#scan').getAttribute('data-mode'), 'barcode');
    await page.locator('#barcode').fill('93000001'); await tap(page.locator('#barcode-form button')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#confirm-log').innerText(), 'Add to meal'); assert.equal(await page.locator('#result-kcal').inputValue(), '102');
    await tap(page.locator('#confirm-log')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '1,069');
    await tap(page.locator('#builder-items .ch-bld__x').last()); assert.equal(await total(), '967');
    // Type it in: the card, empty, with the search words as the name.
    await page.locator('#builder-search').fill('Synthetic gravy'); await tap(page.locator('#builder-type')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#confirm-title').innerText(), 'Type it in'); assert.equal(await page.locator('#result-name').inputValue(), 'Synthetic gravy'); assert.equal(await page.locator('#result-kcal').inputValue(), '');
    await page.locator('#result-kcal').fill('60'); await page.locator('#result-carbs').fill('8'); await tap(page.locator('#confirm-log'));
    await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '1,027'); assert.match(await page.locator('#builder-items').innerText(), /Synthetic gravy[\s\S]*1 serving/);
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
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'water', 'dinner in, protein within 20 g of the goal (no snack needed): water');
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
    // Without AI on this device, Ask AI says so and points to Settings; nothing is sent; the rest still works.
    await page.evaluate(() => localStorage.removeItem('chad.aiProxyToken')); await page.reload();
    await tap(page.locator('#add-food')); await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#describe-button').isVisible(), false); assert.match(await page.locator('#snap-ways').innerText(), /Say what it is/); assert.match(await page.locator('#snap-hint').innerText(), /isn’t set up[\s\S]*Settings/);
    await page.locator('#food-description').fill('Synthetic lasagne'); await tap(page.locator('[data-snap=manual]')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-name').inputValue(), 'Synthetic lasagne', 'the words go along'); assert.equal(asked.length, 2, 'nothing sent without a token');
    await tap(page.locator('#cancel-scan')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-chips [data-food=eggs]')); assert.equal(await total(), '144');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS v11 meals + the add-food sheet: Lunch / Dinner / Snack only, lunch go-tos pinned and 1 tap each with exact macros (715/108/1.1/30.8, 445/71.4/25.9/9.1), Undo/Redo; dinner after lunch with 1,185 / 112 left and the Strict Best fit; Same as yesterday (tag on a card, a button for a custom dinner, 1 tap, Undo/Redo); the sheet in order Recent -> Favourites -> Search -> More ways (no meal switch, name field or AI box), recent from yesterday’s custom dinner, the Quick log two first among favourites, grams − / + and ½ · 1 · 2, remove, running total, Undo/Redo in the sheet; search (foods here + Open Food Facts, one request); Ask AI through the built-in address (answered in the browser) into the card and back (also when closing the AI sheet or the card); barcode and Type it into the same card; Save (exact Undo, Redo); Log dinner (Undo/Redo); the saved meal as a 1-tap favourite (tap again removes) and first in its sheet; the draft across a reload; + Food logs other food as itself (Quick log ×1); no AI: an honest note, nothing sent, the words go to Type it.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
