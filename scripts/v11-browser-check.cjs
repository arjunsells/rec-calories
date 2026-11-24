// v11 Today contract: Day 48 and the journey streak; ONE thing to do now by Darwin time (water 8 am, lunch noon, the
// session 4:30 pm, dinner 7 pm; Wednesday Muay Thai, Sunday the walk, a deload week; then the snack while protein is
// short, water, the wrap-up, done); the line (kcal and protein left, big) whose details open in place, never in a sheet;
// Later today folded into one row with water one tap on it; Quick log favourites one tap each; + Food; days by arrow keys
// and Today; Settings behind the gear (no tab); a missed day with Undo; the time of day changing with the app open;
// recovery of older days; offline. Isolated disposable contexts only. No user profile or fixture file is read.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');

(async () => {
  const server = await serve(8090), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page, text => text.includes('net::ERR_FAILED')), key = '2026-11-24';
    process.on('exit', () => { if (process.exitCode && errors.length) console.error('Page errors seen before the failure: ' + errors.join(' | ')); });
    await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8090/'); assert.deepEqual(errors, [], 'boot errors');
    // Synthetic history: three days on the water goal, and a v9 day with a Dessert pick (a slot v10 and v11 no longer have).
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

    // 1. Day 48 and a 48-day streak; no week strip or arrows; days by the arrow keys; Today brings you back.
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await page.locator('h1#journey-day').count(), 1);
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak'); assert.equal(await page.locator('#home-streak').innerText(), '48');
    assert.equal(await text('day-title'), 'Today'); assert.equal(await text('date-label'), 'Tue 24 Nov');
    assert.equal(await page.locator('#week-strip, #week-toggle, #previous-day, #next-day').count(), 0, 'no week strip, no arrow buttons: swipe or the keys');
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('day-title'), 'Yesterday');
    assert.equal(await page.locator('#home-streak').isVisible(), false, 'the Today pill replaces the streak chip on other days'); assert.equal(await page.locator('#return-today').isVisible(), true);
    // Yesterday's v9 Dessert pick is still there, in the food of that day.
    await tap(page.locator('#left-line')); assert.match(await page.locator('#entries').innerText(), /Honey cheesecake bowl[\s\S]*Synthetic historic meal/); await tap(page.locator('#left-line'));
    await tap(page.locator('#return-today')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await text('day-title'), 'Tomorrow'); await tap(page.locator('#return-today'));
    // Day 1 follows Settings; Settings is behind the gear, not a tab.
    assert.deepEqual(await page.locator('.ch-tabbar .tab').allInnerTexts(), ['Today', 'Gym', 'Progress']);
    await tap(page.locator('#open-settings')); assert.equal(await page.locator('#settings').isVisible(), true); assert.equal(await page.locator('.ch-tabbar.is-none').count(), 1, 'no tab lit in Settings');
    assert.equal(await page.locator('.ch-tabbar [aria-current]').count(), 0);
    await page.locator('#journey-start-date').fill('2026-10-09'); await tap(page.locator('#settings-form button'));
    await tap(page.locator('#close-settings')); assert.equal(await page.locator('#today').isVisible(), true); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '47 day streak');
    await undo(); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal((await saved(page)).journeyStartDate, '2026-10-08');
    // Darwin midnight, whatever the phone's own time zone (this browser runs on New York time).
    await at('2026-11-24T14:29:59Z'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await at('2026-11-24T14:30:00Z'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '49 day streak');

    // 2. ONE thing to do now. Morning: water (one big button), and nothing else on the first screen but the line.
    await fresh(); await at('2026-11-24T08:00:00+09:30');
    assert.equal(await now(), 'water'); assert.equal(await page.locator('#now .water-row.ch-water--big').count(), 1);
    assert.match(await page.locator('#now').innerText(), /0\s*\/ 4\.5 L[\s\S]*4\.5 L to go[\s\S]*500 mL/);
    await tap(page.locator('#now .water-row')); assert.equal((await day()).water, .5, 'one tap, 500 mL'); assert.match(await page.locator('#undo-toast').innerText(), /500 mL water/);
    await undo(); assert.equal((await day()).water, undefined, 'Undo: exactly as before (the day did not exist)');
    assert.equal(await page.locator('#later .water-row').count(), 0, 'water is not repeated below while it is the thing to do');
    await seed(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.questsV5 = { '2026-11-24': { water: 4.5 } }; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); }); await page.reload();
    assert.equal(await now(), 'meal:L', 'water done early: lunch is next');
    // Noon: lunch, its three options (the two go-tos pinned first), no breakfast anywhere.
    await fresh(); await at('2026-11-24T12:00:00+09:30');
    assert.equal(await now(), 'meal:L'); assert.doesNotMatch(await page.locator('#today').innerText(), /breakfast|pre-gym/i);
    assert.deepEqual(await page.locator('#now .ch-opt').evaluateAll(n => n.map(e => [e.querySelector('.meal-pick').dataset.tier, e.classList.contains('is-pinned')])), [['S', true], ['M', true], ['F', false]]);
    assert.match(await page.locator('#now [data-tier=S]').innerText(), /Strict[\s\S]*Nando's ½ PERi chicken[\s\S]*715[\s\S]*kcal[\s\S]*108[\s\S]*g protein/i);
    assert.match(await page.locator('#now [data-tier=M]').innerText(), /Gochi \+ 4 Nando's tenders[\s\S]*445[\s\S]*71/);
    assert.equal(await page.locator('#now [data-best]').count(), 0, 'nothing logged yet: no best fit');
    assert.equal(await page.locator('#now .ch-opt__how').count(), 0, 'fewer words: the how-to is in the long-press sheet');
    // The line: kcal and protein left, big; carbs, fat and the food open in place (no sheet).
    assert.equal(await page.locator('#remaining').innerText(), '1,900'); assert.equal(await page.locator('#protein-left').innerText(), '220');
    assert.equal(await page.locator('#left-more').isVisible(), false);
    await tap(page.locator('#left-line')); assert.equal(await page.locator('#left-more').isVisible(), true); assert.equal(await page.locator('dialog[open]').count(), 0, 'inline, not a modal');
    assert.equal(await page.locator('#left-line').getAttribute('aria-expanded'), 'true'); assert.match(await page.locator('#left-more').innerText(), /Carbs[\s\S]*150 g left[\s\S]*Fat[\s\S]*45 g left[\s\S]*Eaten 0 of 1,900 kcal/);
    await tap(page.locator('#left-line')); assert.equal(await page.locator('#left-more').isVisible(), false);
    // One tap: the go-to lunch, exact macros. The line moves, then water is the thing to do.
    await tap(page.locator('#now [data-slot=L][data-tier=S]'));
    let e = (await saved(page)).entries.find(x => x.day === key && x.planSlot === 'L'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ["Nando's ½ PERi chicken", 715, 108, 1.1, 30.8]);
    assert.equal(await page.locator('#remaining').innerText(), '1,185'); assert.equal(await page.locator('#protein-left').innerText(), '112');
    assert.equal(await now(), 'water', 'lunch in: water');
    await tap(page.locator('#left-line')); assert.match(await page.locator('#left-more').innerText(), /Carbs[\s\S]*149 g left[\s\S]*Fat[\s\S]*14 g left[\s\S]*Eaten 715 of 1,900 kcal · P 108 · C 1 · F 31 g/);
    assert.match(await page.locator('#entries').innerText(), /Nando's ½ PERi chicken[\s\S]*Lunch · 715 kcal/); await tap(page.locator('#left-line'));
    await undo(); assert.equal(await now(), 'meal:L'); await undo(); assert.equal(await now(), 'water', 'Redo');
    // 4:30 pm: the session, one big Start; 7 pm: dinner, with the best fit after the ½ chicken.
    await at('2026-11-24T16:30:00+09:30'); assert.equal(await now(), 'session');
    assert.match(await page.locator('#now').innerText(), /Now · 4–6 pm[\s\S]*Pull[\s\S]*7 exercises · 60 min · then Incline walk[\s\S]*20[\s\S]*SETS[\s\S]*Start/i);
    assert.ok((await page.locator('#now [data-gym-start]').boundingBox()).height >= 72);
    await at('2026-11-24T19:00:00+09:30'); assert.equal(await now(), 'meal:D');
    assert.equal(await page.locator('#now [data-best]').getAttribute('data-tier'), 'S', 'after the ½ chicken: the Strict dinner fits best'); assert.match(await page.locator('#now [data-best]').innerText(), /Best fit/i);
    // Then: the snack while protein is 20 g+ short, water, the wrap-up, done.
    await again(page.locator('#now [data-slot=D][data-tier=M]')); assert.equal(await now(), 'meal:P', '108 + 68 g protein: 44 g short, the snack');
    assert.equal(await page.locator('#now [data-best]').getAttribute('data-tier'), 'F', 'the tenders fit 44 g best');
    await again(page.locator('#now [data-slot=P][data-tier=S]')); assert.equal(await now(), 'water');
    for (let i = 0; i < 9; i++) await again(page.locator('#now .water-row, #later .water-row').first());
    assert.equal((await day()).water, 4.5); assert.equal(await now(), 'wrap');
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

    // 3. Below the first screen: + Custom (and saved meals), Later today folded into one row with water, Quick log.
    await fresh(); await at('2026-11-24T12:00:00+09:30');
    const first = await page.evaluate(() => { scrollTo(0, 0); return { after: document.getElementById('after-now').getBoundingClientRect().top, dock: document.querySelector('.ch-tabbar').getBoundingClientRect().top }; });   // a reload restores the scroll position
    assert.ok(first.after >= first.dock - 4, 'the first screen is the line and the one thing to do: everything else starts under the tab bar ' + JSON.stringify(first));
    assert.equal(await page.locator('#after-now [data-custom=L]').count(), 1); assert.match(await page.locator('#after-now [data-custom=L]').innerText(), /Custom lunch/);
    assert.equal(await page.locator('#later-toggle').getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#later-more').isVisible(), false);
    assert.match(await page.locator('#later-toggle').innerText(), /Later today[\s\S]*Pull 4 pm · Dinner · Wrap-up/);
    assert.equal(await page.locator('#later .water-row').count(), 1, 'water, one tap, in the Later row');
    await tap(page.locator('#later .water-row')); assert.equal((await day()).water, .5); await undo();
    await again(page.locator('#later-toggle')); assert.equal(await page.locator('#later-more').isVisible(), true); assert.equal(await page.locator('dialog[open]').count(), 0);
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
    await again(page.locator('#quick [data-fav=yopro-pouch]')); assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch').length, 2); assert.match(await page.locator('#quick [data-fav=yopro-pouch]').innerText(), /×2/);
    await undo(); assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch').length, 1, 'Undo takes back one');
    await again(page.locator('#quick [data-fav=gochi-noodle]')); e = (await saved(page)).entries.find(x => x.fav === 'gochi-noodle'); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat], ['Gochi noodle meal', 225, 31.8, 25.2, 2.6]);
    assert.equal(await page.locator('#remaining').innerText(), String(1900 - 120 - 225).replace(/(\d)(\d{3})$/, '$1,$2'));
    await again(page.locator('#add-food')); assert.equal(await page.locator('#builder-sheet').isVisible(), true); assert.equal(await page.locator('#builder-title').innerText(), 'Add food'); await page.keyboard.press('Escape');
    // A favourite logged on another day goes to that day.
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); await again(page.locator('#quick [data-fav=yopro-pouch]'));
    assert.equal((await saved(page)).entries.filter(x => x.fav === 'yopro-pouch' && x.day === '2026-11-23').length, 1); assert.match(await page.locator('#undo-toast').innerText(), /Yesterday/);
    await tap(page.locator('#return-today'));

    // 4. A missed day (Settings › Selected day) restarts the streak the day after; Undo brings it back.
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    await tap(page.locator('#open-settings')); assert.match(await page.locator('#weight-date').innerText(), /Sat 21 Nov/i);
    await page.locator('#missed-day').check(); assert.equal((await day('2026-11-21')).missed, true); assert.match(await page.locator('#undo-toast').innerText(), /missed · streak restarts/);
    await tap(page.locator('#close-settings')); await tap(page.locator('#return-today')); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '3 day streak');
    await undo(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak'); assert.equal((await day('2026-11-21')).missed, undefined);

    // 5. The time of day changes with the app open: no reload needed.
    const liveContext = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });   // its own clock
    const live = await liveContext.newPage(), liveErrors = watch(live);
    await live.clock.install({ time: new Date('2026-11-24T10:59:30+09:30') }); await live.goto('http://127.0.0.1:8090/'); await live.evaluate(() => localStorage.setItem('rec-calories-v1', JSON.stringify({ schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: { '2026-11-24': { water: 4.5 } } }))); await live.reload();
    const liveNow = () => live.locator('#now').evaluate(n => n.dataset.now === 'meal' ? 'meal:' + n.dataset.mealSlot : n.dataset.now);
    assert.equal(await liveNow(), 'meal:L');
    await live.clock.setSystemTime(new Date('2026-11-24T15:59:30+09:30')); await live.clock.runFor(61000); await live.waitForFunction(() => document.getElementById('now').dataset.now === 'session');
    assert.equal(await liveNow(), 'session', '4:00 pm: the session, without a reload');
    await live.clock.setSystemTime(new Date('2026-11-24T18:29:30+09:30')); await live.clock.runFor(61000); await live.waitForFunction(() => document.getElementById('now').dataset.now === 'meal');
    assert.equal(await liveNow(), 'meal:D', '6:30 pm: dinner, without a reload');
    assert.deepEqual(liveErrors, []); await liveContext.close();

    // 6. Offline: the shell opens Today, and the data is all there.
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller); await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await now(), 'meal:L'); assert.equal(await page.locator('#now .meal-pick').count(), 3, 'the shell works offline');
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-fixture')), 'preserve'); await context.setOffline(false);
    assert.deepEqual(errors, []);
    console.log('PASS v11 Today: Day 48 / 48-day streak (Day 1 from Settings with Undo, Darwin midnight from New York), days by arrow keys and Today, older days intact; Settings behind the gear (no tab lit, Done back); ONE thing to do now: 8 am water (one tap, Undo exact) then lunch, noon lunch (go-tos pinned, exact macros, 1 tap), 4:30 pm the session (Start 72 px, 20 sets), 7 pm dinner with Best fit, then the snack while protein is short, water, the wrap-up (3 habits), done; Wednesday Muay Thai, Sunday the walk, a deload week; the line (1,900 / 220 -> 1,185 / 112) with carbs, fat, eaten and the food inline (no sheet); everything else under the first screen: Custom, Later today (one row, water one tap there, the rest in place: session, other meals 1 tap / tap again to remove, habits), Quick log (YoPRO and Gochi noodle 1 tap each, x2 on a second tap, Undo takes back one, other days get their own); + Food opens the add-food sheet; a missed day restarts the streak (Undo); the time of day changing with the app open; offline.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
