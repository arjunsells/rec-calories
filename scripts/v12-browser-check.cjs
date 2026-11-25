// v12 Today contract: Day 48 and the journey streak; the week strip (Monday to Sunday around the day in view, a tap
// opens a day), the arrow keys and Today; Settings behind the gear (no tab lit); the hero (calories left, big) and the
// three macro cards (protein, carbs, fat left), a tap shows what was eaten instead, in place; the water card, always on
// Today, one tap a bottle (water is never the thing to do now any more); ONE thing to do now by Darwin time (lunch in the
// morning and at noon, the session 4:30 pm, dinner 7 pm; Wednesday Muay Thai, Sunday the walk, a deload week; then the
// snack while protein is short, the wrap-up, done); Today top to bottom (week strip, hero, macro cards, water card, then
// the thing to do now); Later today folded into one row (no water chip); Quick log favourites one tap each; + Food; the
// round + in the tab bar opens the camera; Recently eaten (the day's food, newest first; a tap opens its card); a
// missed day with Undo; the time of day changing with the app open; older days intact; offline. Isolated disposable
// contexts only. No user profile or fixture file is read.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');

(async () => {
  const server = await serve(8090), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page, text => text.includes('net::ERR_FAILED')), key = '2026-11-24';
    process.on('exit', () => { if (process.exitCode && errors.length) console.error('Page errors seen before the failure: ' + errors.join(' | ')); });
    await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8090/'); assert.deepEqual(errors, [], 'boot errors');
    // Synthetic history: three days on the water goal, and a v9 day with a Dessert pick (a slot v10 to v12 no longer have).
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension = { keep: true };
      s.questsV5 = { '2026-11-21': { water: 5 }, '2026-11-22': { water: 3.5 }, '2026-11-23': { water: 4.5, picks: { E: 'S' }, extension: 'keep' } };
      s.entries = [{ id: 'synthetic-history', day: '2026-11-23', name: 'Synthetic historic meal', kcal: 400, protein: 30, extra: 'keep' }, { id: 'plan-2026-11-23-E', day: '2026-11-23', name: 'Honey cheesecake bowl', kcal: 368, protein: 45, carbs: 40.6, fat: 4.6, meal: 'Dessert', source: 'plan', planSlot: 'E' }];
      localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('unrelated-fixture', 'preserve');
    });
    await page.reload();
    const text = id => page.locator('#' + id).evaluate(e => e.textContent);
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };          // a second tap within 400 ms is a slip by design
    const undo = () => tap(page.locator('#undo-toast button'));                                    // waits until the button is armed
    const day = async (k = key) => (await saved(page)).questsV5?.[k] || {};
    const at = async iso => { await page.clock.setFixedTime(new Date(iso)); await page.reload(); };
    const now = () => page.locator('#now').evaluate(n => n.dataset.now === 'meal' ? 'meal:' + n.dataset.mealSlot : n.dataset.now);
    const seed = fn => page.evaluate(fn);
    const fresh = () => seed(() => localStorage.setItem('rec-calories-v1', JSON.stringify({ schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} })));
    // The week strip: [day, weekday letter + date, in view, today, food logged] per button.
    const week = () => page.locator('#week button.ch-week__day').evaluateAll(n => n.map(b => [b.dataset.day, b.textContent, b.getAttribute('aria-current') || '', b.classList.contains('is-today'), b.classList.contains('is-logged')]));
    const inView = () => page.locator('#week [aria-current]').evaluateAll(n => n.map(b => b.dataset.day + ':' + b.getAttribute('aria-current')));
    // The hero and the three macro cards: number and label each (textContent: the labels are styled in CSS).
    const hero = () => page.evaluate(() => ['remaining', 'remaining-label', 'phase-line', 'protein-left', 'protein-left-label', 'carbs-left', 'carbs-left-label', 'fat-left', 'fat-left-label'].map(id => document.getElementById(id).textContent));
    const recent = () => page.locator('#recent12 .ch-food .ch-food__name').allTextContents();

    // 1. Day 48 and a 48-day streak; the week strip (no arrow buttons); days by a tap on the strip, the arrow keys and Today.
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await page.locator('h1#journey-day').count(), 1);
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak'); assert.equal(await page.locator('#home-streak').innerText(), '48');
    assert.equal(await text('day-title'), 'Today'); assert.equal(await text('date-label'), 'Tue 24 Nov');
    assert.deepEqual(await week(), [['2026-11-23', 'M23', '', false, true], ['2026-11-24', 'T24', 'date', true, false], ['2026-11-25', 'W25', '', false, false], ['2026-11-26', 'T26', '', false, false], ['2026-11-27', 'F27', '', false, false], ['2026-11-28', 'S28', '', false, false], ['2026-11-29', 'S29', '', false, false]], 'Monday to Sunday; today in view; the logged day marked');
    assert.equal(await page.locator('#week [data-day="2026-11-24"]').getAttribute('aria-label'), 'Tuesday 24 November, today'); assert.equal(await page.locator('#week [data-day="2026-11-23"]').getAttribute('aria-label'), 'Monday 23 November, food logged');
    assert.equal(await page.locator('#week-strip, #week-toggle, #previous-day, #next-day').count(), 0, 'no arrow buttons: tap a day on the strip, swipe or the keys');
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('day-title'), 'Yesterday');
    assert.equal(await page.locator('#home-streak').isVisible(), false, 'the Today pill replaces the streak chip on other days'); assert.equal(await page.locator('#return-today').isVisible(), true);
    assert.deepEqual(await inView(), ['2026-11-23:date'], 'the strip marks the day in view');
    assert.deepEqual(await hero(), ['1,132', 'Calories left', 'Cut · 13d left', '145', 'Protein left', '109', 'Carbs left', '40', 'Fat left'], 'the hero and macro cards follow the day in view');
    assert.equal(await text('water12-value'), '4.5 / 4.5 L', 'so does the water card');
    // Yesterday's v9 Dessert pick is still there, in Recently eaten for that day (newest first).
    assert.match(await page.locator('#recent12').innerText(), /Honey cheesecake bowl[\s\S]*Dessert[\s\S]*368 kcal[\s\S]*Synthetic historic meal[\s\S]*400 kcal/);
    await tap(page.locator('#return-today')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.deepEqual(await inView(), ['2026-11-24:date']);
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await text('day-title'), 'Tomorrow'); await tap(page.locator('#return-today'));
    // A tap on the strip opens that day; tapping today brings Today back.
    await tap(page.locator('#week [data-day="2026-11-23"]')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('day-title'), 'Yesterday'); assert.deepEqual(await inView(), ['2026-11-23:date']);
    assert.deepEqual(await recent(), ['Honey cheesecake bowl', 'Synthetic historic meal']);
    await tap(page.locator('#week [data-day="2026-11-29"]')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 53'); assert.equal(await text('day-title'), ''); assert.equal(await text('date-label'), 'Sun 29 Nov');
    assert.deepEqual(await inView(), ['2026-11-29:date']); assert.equal(await page.locator('#week [data-day="2026-11-24"]').evaluate(b => b.classList.contains('is-today')), true, 'today stays marked');
    await tap(page.locator('#week [data-day="2026-11-24"]')); assert.equal(await text('day-title'), 'Today'); assert.equal(await page.locator('#return-today').isVisible(), false); assert.equal(await page.locator('#home-streak').isVisible(), true);
    // Day 1 follows Settings; Settings is behind the gear, not a tab. The round + sits in the middle of the tab bar.
    assert.deepEqual(await page.locator('.ch-tabbar .tab').allInnerTexts(), ['Today', 'Gym', 'Progress']);
    assert.deepEqual(await page.locator('.ch-tabbar > button').evaluateAll(n => n.map(b => b.id || b.dataset.view)), ['today', 'open-camera', 'training', 'history']);
    await tap(page.locator('#open-settings')); assert.equal(await page.locator('#settings').isVisible(), true); assert.equal(await page.locator('.ch-tabbar.is-none').count(), 1, 'no tab lit in Settings');
    assert.equal(await page.locator('.ch-tabbar [aria-current]').count(), 0);
    await page.locator('#journey-start-date').fill('2026-10-09'); await tap(page.locator('#settings-form button'));
    await tap(page.locator('#close-settings')); assert.equal(await page.locator('#today').isVisible(), true); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '47 day streak');
    await undo(); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal((await saved(page)).journeyStartDate, '2026-10-08');
    // Darwin midnight, whatever the phone's own time zone (this browser runs on New York time).
    await at('2026-11-24T14:29:59Z'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await at('2026-11-24T14:30:00Z'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '49 day streak');
    assert.deepEqual(await inView(), ['2026-11-25:date']); assert.equal(await page.locator('#week .is-today').getAttribute('data-day'), '2026-11-25');

    // 2. ONE thing to do now. Morning: lunch is next. Water is never the thing to do now: it has its own card, all day.
    await fresh(); await at('2026-11-24T08:00:00+09:30');
    assert.equal(await now(), 'meal:L', '8 am: lunch is next (v11 put water first)'); assert.match(await page.locator('#now').innerText(), /Now · 12–1 pm[\s\S]*Lunch/i);
    assert.equal(await page.locator('#water-slot > button#water12.water-row.ch-watercard[data-water]').count(), 1, 'the water card, one button');
    assert.equal(await page.locator('#today .water-row').count(), 1, 'one water control on Today: the card (none in the thing to do now)');
    assert.match(await page.locator('#water12').innerText(), /Water[\s\S]*0\s*\/ 4\.5 L[\s\S]*4\.5 L to go/); assert.equal(await page.locator('#water12').getAttribute('aria-label'), 'Add 500 mL water. 0 of 4.5 L, 4.5 L to go');
    await tap(page.locator('#water12')); assert.equal((await day()).water, .5, 'one tap, 500 mL'); assert.match(await page.locator('#undo-toast').innerText(), /500 mL water/); assert.equal(await text('water12-value'), '0.5 / 4.5 L');
    assert.equal(await now(), 'meal:L', 'water does not change the thing to do now');
    await undo(); assert.equal((await day()).water, undefined, 'Undo: exactly as before (the day did not exist)'); assert.equal(await text('water12-value'), '0 / 4.5 L');
    await seed(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.questsV5 = { '2026-11-24': { water: 4.5 } }; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); }); await page.reload();
    assert.equal(await now(), 'meal:L', 'water done early: still lunch'); assert.equal(await page.locator('#water12.is-full').count(), 1); assert.match(await page.locator('#water12').innerText(), /4\.5\s*\/ 4\.5 L[\s\S]*Goal hit/);
    // Noon: lunch, its three options (the two go-tos pinned first), no breakfast anywhere.
    await fresh(); await at('2026-11-24T12:00:00+09:30');
    assert.equal(await now(), 'meal:L'); assert.doesNotMatch(await page.locator('#today').innerText(), /breakfast|pre-gym/i);
    assert.deepEqual(await page.locator('#now .ch-opt').evaluateAll(n => n.map(e => [e.querySelector('.meal-pick').dataset.tier, e.classList.contains('is-pinned')])), [['S', true], ['M', true], ['F', false]]);
    assert.match(await page.locator('#now [data-tier=S]').innerText(), /Strict[\s\S]*Nando's ½ PERi chicken[\s\S]*715[\s\S]*kcal[\s\S]*108[\s\S]*g protein/i);
    assert.match(await page.locator('#now [data-tier=M]').innerText(), /Gochi \+ 4 Nando's tenders[\s\S]*445[\s\S]*71/);
    assert.equal(await page.locator('#now [data-best]').count(), 0, 'nothing logged yet: no best fit');
    assert.equal(await page.locator('#now .ch-opt__how').count(), 0, 'fewer words: the how-to is in the long-press sheet');
    // The hero: calories left, big, and protein, carbs and fat left in three cards; a tap shows what was eaten instead, in
    // place (no sheet), and a second tap goes back. (v12: replaces v11's line and its inline details, #left-more.)
    assert.deepEqual(await hero(), ['1,900', 'Calories left', 'Cut · 12d left', '220', 'Protein left', '150', 'Carbs left', '45', 'Fat left']);
    assert.equal(await page.locator('#left-more, #entries, #consumed, #target-label, #protein-total, #kcal-bar').count(), 0, 'the v11 line details are gone');
    assert.equal(await page.locator('#left-line').getAttribute('aria-pressed'), 'false');
    await tap(page.locator('#left-line')); assert.equal(await page.locator('#left-line').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('dialog[open]').count(), 0, 'in place, not a modal');
    assert.deepEqual(await hero(), ['0', 'Calories eaten', 'of 1,900 kcal', '0', 'Protein eaten', '0', 'Carbs eaten', '0', 'Fat eaten']);
    await tap(page.locator('#left-line')); assert.equal(await page.locator('#left-line').getAttribute('aria-pressed'), 'false'); assert.equal(await text('remaining-label'), 'Calories left');
    // One tap: the go-to lunch, exact macros. The hero and the cards move; then the session is the thing to do (early).
    await tap(page.locator('#now [data-slot=L][data-tier=S]'));
    let e = (await saved(page)).entries.find(x => x.day === key && x.planSlot === 'L'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ["Nando's ½ PERi chicken", 715, 108, 1.1, 30.8]);
    assert.deepEqual(await hero(), ['1,185', 'Calories left', 'Cut · 12d left', '112', 'Protein left', '149', 'Carbs left', '14', 'Fat left']);
    assert.equal(await page.locator('#left-line').getAttribute('aria-label'), '1,185 kcal left of 1,900, 112 g protein left, 149 g carbs left, 14 g fat left. Show what was eaten');
    assert.equal(await now(), 'session', 'lunch in: the session (water stays on its card)');
    await undo(); assert.equal(await now(), 'meal:L'); assert.equal(await text('remaining'), '1,900'); await undo(); assert.equal(await now(), 'session', 'Redo');
    await again(page.locator('#left-line')); assert.deepEqual(await hero(), ['715', 'Calories eaten', 'of 1,900 kcal', '108', 'Protein eaten', '1', 'Carbs eaten', '31', 'Fat eaten']); await tap(page.locator('#left-line'));
    // The day's food: Recently eaten, newest first (v12: replaces v11's food list in the details); a tap opens its card.
    assert.match(await page.locator('#recent12').innerText(), /Nando's ½ PERi chicken[\s\S]*Lunch[\s\S]*715 kcal[\s\S]*108g[\s\S]*1\.1g[\s\S]*30\.8g/);
    assert.equal(await page.locator('#week [data-day="2026-11-24"].is-logged').count(), 1, 'the strip marks today as logged');
    await again(page.locator('#recent12 [data-entry="plan-2026-11-24-L"]')); await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready');
    assert.equal(await text('nutrition12-title'), 'Edit food'); assert.equal(await page.locator('#n12-name').inputValue(), "Nando's ½ PERi chicken"); assert.equal(await page.locator('#n12-kcal').inputValue(), '715');
    await tap(page.locator('#nutrition12-close')); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
    // 4:30 pm: the session, one big Start; 7 pm: dinner, with the best fit after the ½ chicken.
    await at('2026-11-24T16:30:00+09:30'); assert.equal(await now(), 'session');
    assert.match(await page.locator('#now').innerText(), /Now · 4–6 pm[\s\S]*Pull[\s\S]*7 exercises · 60 min · then Incline walk[\s\S]*20[\s\S]*SETS[\s\S]*Start/i);
    assert.ok((await page.locator('#now [data-gym-start]').boundingBox()).height >= 72);
    await at('2026-11-24T19:00:00+09:30'); assert.equal(await now(), 'meal:D');
    assert.equal(await page.locator('#now [data-best]').getAttribute('data-tier'), 'S', 'after the ½ chicken: the Strict dinner fits best'); assert.match(await page.locator('#now [data-best]').innerText(), /Best fit/i);
    // Then: the snack while protein is 20 g+ short, the wrap-up, done. Water fills on its card meanwhile.
    await again(page.locator('#now [data-slot=D][data-tier=M]')); assert.equal(await now(), 'meal:P', '108 + 68 g protein: 44 g short, the snack');
    assert.equal(await page.locator('#now [data-best]').getAttribute('data-tier'), 'F', 'the tenders fit 44 g best');
    await again(page.locator('#now [data-slot=P][data-tier=S]')); assert.equal(await now(), 'wrap', 'the snack in: the wrap-up (v11 put water first)');
    for (let i = 0; i < 9; i++) await again(page.locator('#water12'));
    assert.equal((await day()).water, 4.5); assert.match(await page.locator('#undo-toast').innerText(), /Water goal hit/); assert.equal(await page.locator('#water12.is-full').count(), 1);
    assert.equal(await now(), 'wrap', 'water never changes the thing to do now');
    assert.deepEqual(await page.locator('#now [data-quest]').evaluateAll(n => n.map(b => b.dataset.quest)), ['steps', 'sleep', 'electrolyte'], 'three habits, one tap each');
    for (const f of ['steps', 'sleep', 'electrolyte']) await again(page.locator(`#now [data-quest=${f}]`));
    assert.equal(await now(), 'done'); assert.match(await page.locator('#now').innerText(), /All done[\s\S]*kcal[\s\S]*protein[\s\S]*4\.5 L/);
    // Wednesday: Muay Thai at 6:30 in the gym window; Sunday: the walk; a deload week says so.
    await fresh(); await at('2026-11-25T17:00:00+09:30'); assert.equal(await now(), 'session'); assert.match(await page.locator('#now').innerText(), /Tonight · 6:30 pm[\s\S]*Muay Thai/i);
    await tap(page.locator('#now [data-quest=training]')); assert.equal((await day('2026-11-25')).training, true); assert.equal(await now(), 'meal:D', 'Muay Thai done: dinner is next (an unlogged lunch waits in Later today)');
    await again(page.locator('#later-toggle')); assert.equal(await page.locator('#later-more [data-later-slot=L]').count(), 1); assert.match(await page.locator('#later-more [data-later-slot=L]').innerText(), /Lunch[\s\S]*12–1 pm/); await again(page.locator('#later-toggle'));
    await undo();
    await at('2026-11-29T17:00:00+09:30'); assert.equal(await now(), 'session'); assert.match(await page.locator('#now').innerText(), /Rest \+ walk[\s\S]*45–60 min walk/);
    await tap(page.locator('#now [data-quest=cardio]')); assert.equal((await day('2026-11-29')).cardio, true);
    await at('2026-12-29T16:30:00+09:30'); assert.match(await page.locator('#now').innerText(), /Deload week · half the sets/); assert.match(await page.locator('#now').innerText(), /13[\s\S]*SETS/i, 'half of each exercise’s sets, rounded up: 13 of Pull’s 20');

    // 3. Today, top to bottom (v12 scrolls like a photo-first calorie app; v11's rule that everything but the line and the thing to do starts
    // under the tab bar is gone): the week strip, the hero, the three macro cards, the water card, then the thing to do
    // now; under it + Custom (and saved meals), Later today folded into one row, Quick log; then Recently eaten.
    await fresh(); await at('2026-11-24T12:00:00+09:30');
    const ids = ['week', 'left-line', 'protein-card', 'carbs-card', 'fat-card', 'water12', 'now', 'after-now', 'recent12'];
    const layout = await page.evaluate(ids => { scrollTo(0, 0); const all = [...document.querySelectorAll('#day-page *')]; return ids.map(id => { const n = document.getElementById(id), r = n.getBoundingClientRect(); return { id, at: all.indexOf(n), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) }; }); }, ids);   // a reload restores the scroll position
    const box = Object.fromEntries(layout.map(b => [b.id, b]));
    assert.deepEqual(layout.slice().sort((a, b) => a.at - b.at).map(b => b.id), ids, 'document order ' + JSON.stringify(layout));
    assert.equal(await page.locator('#day-page').evaluate(p => p.firstElementChild.id), 'week', 'the week strip comes first');
    assert.ok(box.week.bottom <= box['left-line'].top && box['left-line'].bottom <= box['protein-card'].top, 'the week strip, then the hero ' + JSON.stringify(layout));
    assert.ok(box['protein-card'].top === box['carbs-card'].top && box['carbs-card'].top === box['fat-card'].top && box['protein-card'].left < box['carbs-card'].left && box['carbs-card'].left < box['fat-card'].left, 'three macro cards in one row: protein, carbs, fat ' + JSON.stringify(layout));
    assert.ok(Math.max(box['protein-card'].bottom, box['carbs-card'].bottom, box['fat-card'].bottom) <= box.water12.top && box.water12.bottom <= box.now.top, 'the water card under the macro cards, then the thing to do now ' + JSON.stringify(layout));
    assert.ok(box.now.bottom <= box['after-now'].top && box['after-now'].bottom <= box.recent12.top, 'then the other options, Later today and Quick log, then Recently eaten ' + JSON.stringify(layout));
    assert.equal(await page.locator('#after-now [data-custom=L]').count(), 1); assert.match(await page.locator('#after-now [data-custom=L]').innerText(), /Custom lunch/);
    assert.equal(await page.locator('#later-toggle').getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#later-more').isVisible(), false);
    assert.match(await page.locator('#later-toggle').innerText(), /Later today[\s\S]*Pull 4 pm · Dinner · Wrap-up/);
    // Water: the card, one tap a bottle (again for another); Undo takes back one. (v11 also had a water chip in Later today.)
    await tap(page.locator('#water12')); await again(page.locator('#water12')); assert.equal((await day()).water, 1); assert.equal(await text('water12-value'), '1 / 4.5 L');
    await undo(); assert.equal((await day()).water, .5, 'Undo takes back one bottle'); assert.equal(await text('water12-value'), '0.5 / 4.5 L');
    await again(page.locator('#later-toggle')); assert.equal(await page.locator('#later-more').isVisible(), true); assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await page.locator('#later .water-row').count(), 0, 'no water chip in Later today: the card above has it');
    assert.match(await page.locator('#later-more').innerText(), /Pull[\s\S]*Start[\s\S]*Dinner[\s\S]*Roast chook & spuds[\s\S]*Snack[\s\S]*YoPRO × 2[\s\S]*Incline walk[\s\S]*10k steps[\s\S]*Sleep 7 h\+[\s\S]*Hydralyte/);
    assert.equal(await page.locator('#later-more [data-later-slot=L]').count(), 0, 'lunch is on top, not repeated');
    await tap(page.locator('#later-more [data-slot=D][data-tier=M]')); assert.equal((await day()).picks.D, 'M', 'dinner from Later: one tap');
    assert.equal(await page.locator('#later-more [data-slot=D][data-tier=M]').getAttribute('aria-pressed'), 'true');
    await again(page.locator('#later-more [data-slot=D][data-tier=M]')); assert.equal((await day()).picks?.D, undefined, 'tap the logged one again: removed');
    await again(page.locator('#later-more [data-quest=steps]')); assert.equal((await day()).steps, true); await undo();
    await again(page.locator('#later-toggle')); assert.equal(await page.locator('#later-more').isVisible(), false);
    // Quick log: YoPRO pouch and Gochi noodle, one tap each; a second tap is a second one; + Food opens the add-food sheet.
    assert.deepEqual(await page.locator('#quick [data-fav]').evaluateAll(n => n.map(b => b.dataset.fav)), ['yopro-pouch', 'gochi-noodle']);
    await tap(page.locator('#quick [data-fav=yopro-pouch]'));
    let pouches = (await saved(page)).entries.filter(x => x.fav === 'yopro-pouch'); assert.equal(pouches.length, 1); assert.deepEqual([pouches[0].name, pouches[0].kcal, pouches[0].protein, pouches[0].carbs, pouches[0].fat, pouches[0].day], ['YoPRO Perform pouch', 120, 20.1, 6.8, 1.2, key]);
    assert.match(await page.locator('#undo-toast').innerText(), /YoPRO pouch · 120 kcal/); assert.match(await page.locator('#quick [data-fav=yopro-pouch]').innerText(), /×1/);
    assert.match(await page.locator('#recent12 .ch-food').first().innerText(), /YoPRO Perform pouch[\s\S]*120 kcal/, 'in Recently eaten at once');
    await again(page.locator('#quick [data-fav=yopro-pouch]')); assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch').length, 2); assert.match(await page.locator('#quick [data-fav=yopro-pouch]').innerText(), /×2/);
    await undo(); assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch').length, 1, 'Undo takes back one');
    await again(page.locator('#quick [data-fav=gochi-noodle]')); e = (await saved(page)).entries.find(x => x.fav === 'gochi-noodle'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ['Gochi noodle meal', 225, 31.8, 25.2, 2.6]);
    assert.equal(await page.locator('#remaining').innerText(), String(1900 - 120 - 225).replace(/(\d)(\d{3})$/, '$1,$2'));
    assert.deepEqual(await recent(), ['Gochi noodle meal', 'YoPRO Perform pouch'], 'Recently eaten: newest first');
    await again(page.locator('#add-food')); assert.equal(await page.locator('#builder-sheet').isVisible(), true); assert.equal(await page.locator('#builder-title').innerText(), 'Add food'); await page.keyboard.press('Escape');
    // The round + in the tab bar opens the camera over Today (photos themselves: v12-scan-check).
    await again(page.locator('#open-camera')); await page.waitForFunction(() => document.getElementById('camera12').open);
    assert.equal(await text('camera12-title'), 'Scan food'); assert.equal(await page.locator('#camera12 [data-mode12=food]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.ch-tabbar [data-view=today]').getAttribute('aria-current'), 'page', 'a sheet over Today, not a tab');
    await tap(page.locator('#camera12-close')); await page.waitForFunction(() => !document.getElementById('camera12').open);
    // A favourite logged on another day goes to that day.
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); await again(page.locator('#quick [data-fav=yopro-pouch]'));
    assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch' && x.day === '2026-11-23').length, 1); assert.match(await page.locator('#undo-toast').innerText(), /Yesterday/);
    assert.deepEqual(await recent(), ['YoPRO Perform pouch'], 'that day’s Recently eaten');
    await tap(page.locator('#return-today'));

    // 4. A missed day (Settings › Selected day) restarts the streak the day after; Undo brings it back.
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await inView(), ['2026-11-21:date']); assert.equal(await page.locator('#week button').first().getAttribute('data-day'), '2026-11-16', 'the strip follows the day in view: its own week');
    await tap(page.locator('#open-settings')); assert.match(await page.locator('#weight-date').innerText(), /Sat 21 Nov/i);
    await page.locator('#missed-day').check(); assert.equal((await day('2026-11-21')).missed, true); assert.match(await page.locator('#undo-toast').innerText(), /missed · streak restarts/);
    await tap(page.locator('#close-settings')); await tap(page.locator('#return-today')); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '3 day streak');
    await undo(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak'); assert.equal((await day('2026-11-21')).missed, undefined);

    // 5. The time of day changes with the app open: no reload needed (no water logged: it never decides the thing to do).
    const liveContext = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });   // its own clock
    const live = await liveContext.newPage(), liveErrors = watch(live);
    await live.clock.install({ time: new Date('2026-11-24T10:59:30+09:30') }); await live.goto('http://127.0.0.1:8090/'); await live.evaluate(() => localStorage.setItem('rec-calories-v1', JSON.stringify({ schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} }))); await live.reload();
    const liveNow = () => live.locator('#now').evaluate(n => n.dataset.now === 'meal' ? 'meal:' + n.dataset.mealSlot : n.dataset.now);
    assert.equal(await liveNow(), 'meal:L');
    await live.clock.setSystemTime(new Date('2026-11-24T15:59:30+09:30')); await live.clock.runFor(61000); await live.waitForFunction(() => document.getElementById('now').dataset.now === 'session');
    assert.equal(await liveNow(), 'session', '4:00 pm: the session, without a reload');
    await live.clock.setSystemTime(new Date('2026-11-24T18:29:30+09:30')); await live.clock.runFor(61000); await live.waitForFunction(() => document.getElementById('now').dataset.now === 'meal');
    assert.equal(await liveNow(), 'meal:D', '6:30 pm: dinner, without a reload'); assert.equal(await live.locator('#water12').count(), 1, 'the water card stays');
    assert.deepEqual(liveErrors, []); await liveContext.close();

    // 6. Offline: the shell opens Today, and the data is all there.
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller); await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await now(), 'meal:L'); assert.equal(await page.locator('#now .meal-pick').count(), 3, 'the shell works offline');
    assert.equal(await page.locator('#week .ch-week__day').count(), 7); assert.equal(await text('water12-value'), '0.5 / 4.5 L'); assert.deepEqual(await recent(), ['Gochi noodle meal', 'YoPRO Perform pouch']);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-fixture')), 'preserve'); await context.setOffline(false);
    assert.deepEqual(errors, []);
    console.log('PASS v12 Today: Day 48 / 48-day streak (Day 1 from Settings with Undo, Darwin midnight from New York); the week strip (Mon-Sun, the day in view marked, logged days marked, a tap opens a day, its own week for other days), arrow keys and Today, older days intact (a v9 Dessert pick in Recently eaten); Settings behind the gear (no tab lit, Done back); the round + in the middle of the tab bar opens the camera; the hero and macro cards (1,900 / 220 / 150 / 45 left -> 1,185 / 112 / 149 / 14; a tap shows 715 / 108 / 1 / 31 eaten in place, again goes back); the water card (1 tap = 500 mL, toast, Undo exact, Water goal hit; never the thing to do now, no chip in Later today); ONE thing to do now: 8 am and noon lunch (go-tos pinned, exact macros, 1 tap), then the session early, 4:30 pm the session (Start 72 px, 20 sets), 7 pm dinner with Best fit, then the snack while protein is short, the wrap-up (3 habits), done; Wednesday Muay Thai, Sunday the walk, a deload week; Today top to bottom: week strip, hero, protein/carbs/fat cards, water card, the thing to do now, Custom / Later today / Quick log, Recently eaten; Later today (one row, the rest in place: session, other meals 1 tap / tap again to remove, habits); Quick log (YoPRO and Gochi noodle 1 tap each, x2 on a second tap, Undo takes back one, other days get their own); + Food opens the add-food sheet; Recently eaten newest first, a tap opens Edit food; a missed day restarts the streak (Undo); the time of day changing with the app open; offline.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
