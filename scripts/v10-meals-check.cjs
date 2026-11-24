// v10 pass 2, items F and G in a real browser. The three-meal day (no breakfast, no pre-gym meal): the lunch go-tos
// pinned first and one tap each, Remaining today and the best fit once lunch is in, Same as yesterday (a card says so;
// a custom meal gets its own button). The custom meal builder end to end: quick picks with ½ · 1 · 2 and grams − / +,
// the running total, search (the foods here and Open Food Facts, stubbed), Ask AI through the built-in proxy address
// (answered inside the browser, never sent anywhere) into the editable card and back, Save as my meal -> a one-tap
// favourite on that meal, Log into the slot, the draft kept across a reload, and Undo/Redo at every step: in the sheet
// for the builder's own steps and the save, in the toast for logging. Synthetic data only, disposable storage.
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
    await context.route('https://*.openfoodfacts.org/**', route => { off.push(route.request().url()); return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify({ products: [{ code: '93000001', product_name: 'Synthetic protein yoghurt', brands: 'Synthetic Co', serving_size: '170 g', serving_quantity: 170, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 9, carbohydrates_100g: 5, fat_100g: 0.5 } }] }) }); });
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
    const inSheet = () => tap(page.locator('#builder-undo .ch-toast__action'));                    // the builder's own Undo / Redo
    const day = async (k = key) => (await saved(page)).questsV5?.[k] || {};
    const total = () => page.locator('#builder-total .ch-bld__kcal b').innerText();
    const items = () => page.locator('#builder-items [data-item]').evaluateAll(n => n.map(li => li.dataset.item));
    const taps = async act => { await page.evaluate(() => { if (!window.qaCounting) { window.qaCounting = true; document.addEventListener('click', () => window.qaTaps++, true); } window.qaTaps = 0; }); await act(); return page.evaluate(() => window.qaTaps); };

    // 1. No breakfast, no pre-gym meal. At noon lunch leads: the two go-tos pinned first, then Free; yesterday's go-to
    //    says "Same as yesterday" on its card, so no extra button.
    assert.deepEqual(await page.evaluate(() => CHADPlan.map(s => s.name)), ['Lunch', 'Dinner', 'Snack']);
    assert.doesNotMatch(await page.locator('#today').innerText(), /breakfast|pre-gym/i);
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L');
    assert.deepEqual(await page.locator('#next-up .ch-opt').evaluateAll(n => n.map(e => [e.querySelector('.meal-pick').dataset.tier, e.classList.contains('is-pinned')])), [['S', true], ['M', true], ['F', false]]);
    assert.equal(await page.locator('#next-up [data-yesterday]').getAttribute('data-tier'), 'S'); assert.match(await page.locator('#next-up [data-yesterday]').innerText(), /Same as yesterday[\s\S]*Nando's ½ PERi chicken/i);
    assert.equal(await page.locator('#next-up [data-again]').count(), 0, 'yesterday’s lunch is a card: one tap on it is Same as yesterday');
    assert.equal(await page.locator('#next-up [data-custom]').count(), 1, '+ Custom on the meal');
    // One tap logs the pinned go-to with its exact macros.
    assert.equal(await taps(() => tap(page.locator('#next-up [data-tier=S]'))), 1);
    let j = await saved(page), e = j.entries.find(x => x.day === key && x.planSlot === 'L');
    assert.equal(j.questsV5[key].picks.L, 'S'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ["Nando's ½ PERi chicken", 715, 108, 1.1, 30.8]);
    await undo(); assert.equal((await day()).picks?.L, undefined); await tap(page.locator('#undo-toast button')); assert.equal((await day()).picks.L, 'S', 'Undo, then Redo');
    // The Medium go-to is one tap too (a switch, never a duplicate), and back.
    await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=M]'));
    e = (await saved(page)).entries.filter(x => x.day === key && x.planSlot === 'L'); assert.equal(e.length, 1); assert.deepEqual([e[0].name, e[0].kcal, e[0].protein, e[0].carbs, e[0].fat], ["Gochi + 4 Nando's tenders", 445, 71.4, 25.9, 9.1]);
    await undo(); assert.equal((await day()).picks.L, 'S');

    // 2. Dinner leads now: what is left today, the best fit (Strict after the ½ chicken), and yesterday's custom dinner
    //    as its own button.
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'D');
    assert.match(await page.locator('#next-up .ch-remaining').innerText(), /Remaining today[\s\S]*1,185 kcal[\s\S]*P\s*112[\s\S]*C\s*149[\s\S]*F\s*14/);
    assert.equal(await page.locator('#next-up [data-best]').getAttribute('data-tier'), 'S'); assert.equal(await page.locator('#next-up .is-best').count(), 1, 'one best fit');
    const againButton = page.locator('#next-up [data-again]');
    assert.match(await againButton.innerText(), /Same as yesterday[\s\S]*640 kcal/i); assert.match(await againButton.getAttribute('aria-label'), /Synthetic chook bowl/);
    assert.equal(await taps(() => tap(againButton)), 1);
    j = await saved(page); e = j.entries.find(x => x.day === key && x.planSlot === 'D');
    assert.equal(j.questsV5[key].picks.D, 'C'); assert.deepEqual([e.name, e.kcal, e.protein, e.source, e.parts.length], ['Synthetic chook bowl', 640, 52, 'custom', 1]);
    assert.match(await page.locator('[data-meal-row=D]').innerText(), /Synthetic chook bowl · 640 kcal/);
    await undo(); assert.equal((await day()).picks.D, undefined); assert.equal((await saved(page)).entries.some(x => x.day === key && x.planSlot === 'D'), false, 'Undo takes it back exactly');
    await tap(page.locator('#undo-toast button')); assert.equal((await day()).picks.D, 'C'); await undo();

    // 3. + Custom: the builder, for dinner.
    await page.waitForTimeout(450); await tap(page.locator('#next-up [data-custom]'));
    assert.equal(await page.locator('#builder-sheet').isVisible(), true); assert.equal(await page.locator('#builder-title').innerText(), 'Custom dinner');
    assert.equal(await page.locator('#builder-slots [aria-pressed=true]').innerText(), 'Dinner');
    assert.equal(await total(), '0'); assert.equal(await page.locator('#builder-log').isDisabled(), true); assert.equal(await page.locator('#builder-save').isDisabled(), true);
    assert.ok(await page.locator('#builder-chips [data-food]').count() >= 12, 'quick picks: common foods'); assert.equal(await page.locator('#builder-chips .is-recent').count(), 1, 'and the recent one (from yesterday’s custom dinner) first');
    assert.equal(await page.locator('#builder-chips [data-food]').first().getAttribute('data-food'), 'chook');
    for (const id of ['nandos-half', 'nandos-tenders', 'gochi', 'potatoes', 'yopro', 'eggs', 'steak-mash']) assert.equal(await page.locator(`#builder-chips [data-food="${id}"]`).count(), 1, id);
    // Grams: a tap adds 200 g of roast chook; + and − step 50 g; Undo and Redo in the sheet.
    await tap(page.locator('#builder-chips [data-food=chook]')); assert.deepEqual(await items(), ['chook']); assert.equal(await total(), '330');
    assert.match(await page.locator('#builder-undo').innerText(), /Added Roast chook, skin off[\s\S]*Undo/);
    await tap(page.locator('#builder-items [data-item=chook] .ch-bld__step').last()); assert.equal(await total(), '413'); assert.match(await page.locator('#builder-items [data-item=chook]').innerText(), /250 g/);
    await inSheet(); assert.equal(await total(), '330', 'Undo in the sheet'); await inSheet(); assert.equal(await total(), '413', 'Redo in the sheet');
    await tap(page.locator('#builder-items [data-item=chook] .ch-bld__step').first()); assert.equal(await total(), '330');
    // Portions: YoPRO as ½ · 1 · 2.
    await tap(page.locator('#builder-chips [data-food=potatoes]')); await tap(page.locator('#builder-chips [data-food=yopro]'));
    assert.deepEqual(await items(), ['chook', 'potatoes', 'yopro']); assert.equal(await total(), '646');
    const yo = page.locator('#builder-items [data-item=yopro]');
    assert.equal(await yo.locator('.ch-bld__q[aria-pressed=true]').innerText(), '1');
    await tap(yo.locator('.ch-bld__q', { hasText: '2' })); assert.equal(await total(), '737'); assert.match(await yo.innerText(), /2 × 1 pot/);
    await tap(yo.locator('.ch-bld__q', { hasText: '½' })); assert.equal(await total(), '601');
    await tap(yo.locator('.ch-bld__x')); assert.deepEqual(await items(), ['chook', 'potatoes']); assert.equal(await total(), '555');
    await inSheet(); assert.deepEqual(await items(), ['chook', 'potatoes', 'yopro'], 'a removed item comes back with Undo'); await inSheet(); assert.equal(await total(), '555');
    assert.match(await page.locator('#builder-total').innerText(), /555[\s\S]*kcal[\s\S]*P\s*62[\s\S]*C\s*48[\s\S]*F\s*11[\s\S]*2 items/, 'the running total, kcal and P/C/F');
    // Search: the foods here at once, then Open Food Facts.
    await page.locator('#builder-search').fill('yoghurt');
    assert.ok(await page.locator('#builder-results [data-result=local]').count() >= 1, 'the foods here first');
    await page.locator('#builder-results [data-result=off]').first().waitFor({ timeout: 10000 }); assert.ok(off.length >= 1, 'Open Food Facts asked');
    await tap(page.locator('#builder-results [data-result=off]').first()); assert.equal(await total(), '657', '+ 170 g of the synthetic yoghurt (102 kcal)');
    assert.match(await page.locator('#builder-items').innerText(), /Synthetic Co Synthetic protein yoghurt[\s\S]*170 g/);
    // Ask AI: words (the keyboard mic types into this same field) -> the editable card -> Add to meal -> back here.
    await page.locator('#builder-ask').fill('steak sandwich'); await tap(page.locator('#builder-ask-go'));
    await page.locator('#confirm-sheet').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(asked.length, 1); assert.equal(asked[0].token, TOKEN); assert.equal(asked[0].body.text, 'steak sandwich');
    assert.equal(await page.locator('#confirm-title').innerText(), 'Add to your meal'); assert.equal(await page.locator('#confirm-log').innerText(), 'Add to meal');
    assert.equal(await page.locator('#scan-meal-field').isVisible(), false, 'the meal is already chosen');
    assert.equal(await page.locator('#result-name').inputValue(), 'Synthetic steak sandwich'); assert.equal(await page.locator('#result-kcal').inputValue(), '620');
    await page.locator('#result-grams').fill('150'); assert.equal(await page.locator('#result-kcal').inputValue(), '310', 'the card still scales by weight');
    await tap(page.locator('#confirm-log'));
    assert.equal(await page.locator('#builder-sheet').isVisible(), true, 'back in the builder'); assert.equal(await page.locator('#confirm-sheet').isVisible(), false);
    assert.equal(await total(), '967'); assert.match(await page.locator('#builder-items').innerText(), /Synthetic steak sandwich[\s\S]*150 g/);
    // Closing the card without adding also goes back to the builder, meal intact.
    await page.locator('#builder-ask').fill('another one'); await tap(page.locator('#builder-ask-go')); await page.locator('#confirm-sheet').waitFor({ state: 'visible' });
    await tap(page.locator('#cancel-scan')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); assert.equal(await total(), '967');
    // Save as my meal: kept on this meal, with Undo and Redo in the sheet.
    const before = await saved(page);
    await tap(page.locator('#builder-save')); j = await saved(page);
    assert.equal(j.myMeals.length, 1); assert.equal(j.myMeals[0].slot, 'D'); assert.equal(Math.round(j.myMeals[0].macros[0]), 967); assert.equal(j.myMeals[0].parts.length, 4);
    assert.match(await page.locator('#builder-undo').innerText(), /Saved as my meal · on dinner/); assert.match(await page.locator('#builder-save').innerText(), /Saved/);
    await inSheet(); assert.deepEqual(await saved(page), before, 'Undo puts back exactly the journal it found'); assert.match(await page.locator('#builder-save').innerText(), /Save as my meal/);
    await inSheet(); assert.equal((await saved(page)).myMeals.length, 1, 'Redo saves it again');
    // Log: fills dinner (Custom), with what is in it; Undo in the toast.
    await page.locator('#builder-name').fill('Synthetic Tuesday dinner');
    await tap(page.locator('#builder-log')); assert.equal(await page.locator('#builder-sheet').isVisible(), false);
    j = await saved(page); e = j.entries.find(x => x.day === key && x.planSlot === 'D');
    assert.equal(j.questsV5[key].picks.D, 'C'); assert.equal(e.name, 'Synthetic Tuesday dinner'); assert.equal(Math.round(e.kcal), 967); assert.equal(e.source, 'custom'); assert.equal(e.parts.length, 4);
    assert.match(await page.locator('#undo-toast').innerText(), /Dinner logged/);
    await undo(); assert.equal((await day()).picks.D, undefined); await tap(page.locator('#undo-toast button')); assert.equal((await day()).picks.D, 'C');
    assert.equal(await page.evaluate(() => localStorage.getItem('chad.builder')), null, 'a logged meal leaves no draft');
    // The saved meal is a one-tap favourite on dinner: tap to remove the logged one, tap again to log it.
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'P', 'the snack is next');
    await tap(page.locator('[data-meal-row=D]'));
    const mine = page.locator('[data-meal-slot=D] [data-my-meal]');
    assert.equal(await mine.count(), 1); assert.match(await mine.innerText(), /967 kcal/);
    // The favourite was saved before the meal was renamed, so it keeps the name it was saved with.
    await tap(mine); j = await saved(page); e = j.entries.find(x => x.day === key && x.planSlot === 'D');
    assert.equal(j.questsV5[key].picks.D, 'C'); assert.equal(e.name, j.myMeals[0].name, 'one tap switches to the saved meal');
    if (await page.locator('[data-meal-row=D]').count()) await tap(page.locator('[data-meal-row=D]'));
    await again(page.locator('[data-meal-slot=D] [data-my-meal]')); assert.equal((await day()).picks.D, undefined, 'tapping the logged favourite removes it');
    await again(page.locator('#next-up [data-my-meal]').or(page.locator('[data-meal-slot=D] [data-my-meal]')).first()); assert.equal((await day()).picks.D, 'C', 'and one tap logs it');
    // Long press a favourite: what is in it, Log, Remove from my meals (Undo).
    if (await page.locator('[data-meal-row=D]').count()) await tap(page.locator('[data-meal-row=D]'));
    await page.waitForTimeout(450); const fav = page.locator('[data-meal-slot=D] [data-my-meal]'); await fav.scrollIntoViewIfNeeded(); const box = await fav.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
    assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.match(await page.locator('#detail-sheet').innerText(), /Roast chook[\s\S]*Synthetic steak sandwich/);
    await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Remove from my meals' })); assert.deepEqual((await saved(page)).myMeals, []);
    await undo(); assert.equal((await saved(page)).myMeals.length, 1);

    // 4. The draft survives closing the sheet and a reload; the slot can change in the sheet; Log empties it.
    await page.waitForTimeout(450); await tap(page.locator('#next-up [data-custom]')); assert.equal(await page.locator('#builder-title').innerText(), 'Custom snack');
    await tap(page.locator('#builder-chips [data-food=yopro]')); await tap(page.locator('#builder-sheet [data-close=builder-sheet]'));
    await page.reload(); await tap(page.locator('#next-up [data-custom]')); assert.deepEqual(await items(), ['yopro'], 'the draft is kept on this device');
    await tap(page.locator('#builder-slots [data-builder-slot=L]')); assert.equal(await page.locator('#builder-title').innerText(), 'Custom lunch');
    await tap(page.locator('#builder-slots [data-builder-slot=P]')); await tap(page.locator('#builder-log'));
    assert.equal((await day()).picks.P, 'C'); assert.equal(await page.evaluate(() => localStorage.getItem('chad.builder')), null);
    // Without AI on this device, Ask AI says so and points to Settings; the chips and search still work.
    await page.evaluate(() => localStorage.removeItem('chad.aiProxyToken')); await page.reload();
    await tap(page.locator('[data-meal-row=P]')); await tap(page.locator('[data-meal-slot=P] [data-custom]'));
    await page.locator('#builder-ask').fill('anything'); await tap(page.locator('#builder-ask-go'));
    assert.match(await page.locator('#builder-ai-state').innerText(), /aren’t set up[\s\S]*Set it up/); assert.equal(asked.length, 2, 'nothing sent without a token');
    await tap(page.locator('#builder-chips [data-food=eggs]')); assert.equal(await total(), '144');
    // The score: three meals logged (two custom at 1 point each) is honest; scoring stays derived.
    const d = await page.evaluate(() => CHADQuest.daily(JSON.parse(localStorage.getItem('rec-calories-v1')), '2026-11-24'));
    assert.deepEqual([d.picks.L, d.picks.D, d.picks.P], ['S', 'C', 'C']);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS v10 meals + builder: Lunch / Dinner / Snack only (no breakfast, no pre-gym), lunch go-tos pinned first and 1 tap each with exact macros (715/108/1.1/30.8, 445/71.4/25.9/9.1), Undo/Redo; Remaining today 1,185 kcal / P 112 / C 149 / F 14 after lunch and the Strict dinner as Best fit; Same as yesterday as a tag on yesterday’s card and as a button for a custom dinner (1 tap, Undo/Redo); + Custom: quick picks (recent first, common foods), grams − / + and ½ · 1 · 2, remove, running total with P/C/F, Undo/Redo in the sheet; search over the foods here + Open Food Facts (stubbed); Ask AI through the built-in address (answered in the browser) into the editable card, Add to meal, back to the builder (also when closed); Save as my meal (exact Undo, Redo); Log into the slot (Undo/Redo); the favourite: 1 tap log, tap again removes, long press shows it and removes it (Undo); draft kept across a reload, slot switch, logged empties it; no AI: an honest note and nothing sent; zero console errors.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
