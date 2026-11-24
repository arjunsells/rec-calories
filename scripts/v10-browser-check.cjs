// v10 interaction contract: Today on Darwin time (only what matters now is big, everything else one quiet line), meals
// as Strict / Medium / Free with kcal, P/C/F and how to make them, one-tap water with its goal and streak, one-tap done
// chips, the journey streak (48 on 24 Nov 2026) and a missed day, days by swipe / week strip / arrow keys, every change
// reversible, recovery. Isolated disposable contexts only. No user profile or fixture file is read.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');

(async () => {
  const server = await serve(8090), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page, text => text.includes('net::ERR_FAILED')), key = '2026-11-24';
    process.on('exit', () => { if (process.exitCode && errors.length) console.error('Page errors seen before the failure: ' + errors.join(' | ')); });
    await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8090/'); assert.deepEqual(errors, [], 'boot errors');
    // Synthetic history: three days on the water goal, and a v9 day with a Dessert pick (a slot v10 no longer has).
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension = { keep: true };
      s.questsV5 = { '2026-11-21': { water: 5 }, '2026-11-22': { water: 3.5 }, '2026-11-23': { water: 4.5, picks: { E: 'S' }, extension: 'keep' } };
      s.entries = [{ id: 'synthetic-history', day: '2026-11-23', name: 'Synthetic historic meal', kcal: 400, protein: 30, extra: 'keep' }, { id: 'plan-2026-11-23-E', day: '2026-11-23', name: 'Honey cheesecake bowl', kcal: 368, protein: 45, carbs: 40.6, fat: 4.4, meal: 'Dessert', source: 'plan', planSlot: 'E' }];
      localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('unrelated-fixture', 'preserve');
    });
    await page.reload();
    const text = id => page.locator('#' + id).evaluate(e => e.textContent);
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };          // a second tap within 400 ms is a slip by design
    const undo = () => tap(page.locator('#undo-toast button'));                                    // waits until the button is armed
    const day = async (k = key) => (await saved(page)).questsV5?.[k] || {};
    const at = async iso => { await page.clock.setFixedTime(new Date(iso)); await page.reload(); };
    const blocks = () => page.locator('#daily-checklist > *').evaluateAll(n => n.map(e => e.id === 'next-up' ? 'meal:' + e.dataset.mealSlot : e.classList.contains('water-row') ? (e.classList.contains('ch-water--big') ? 'WATER' : 'water') : e.id === 'session-hero' ? 'SESSION' : e.id === 'wrap-up' ? 'WRAP' : e.classList.contains('day-rows') ? 'rows:' + [...e.querySelectorAll('[data-row]')].map(r => r.dataset.row).join(',') : e.dataset.flip || e.className));

    // Journey day and streak: 24 Nov 2026 is Day 48 and a 48-day streak (every day from Day 1 counts). 25 Nov: 49.
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await page.locator('h1#journey-day').count(), 1);
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak'); assert.equal(await page.locator('#home-streak').innerText(), '48');
    assert.equal(await text('day-title'), 'Today'); assert.equal(await text('date-label'), 'Tue 24 Nov');
    assert.equal(await page.locator('#previous-day,#next-day').count(), 0, 'no arrow buttons');
    assert.equal(await page.locator('#week-strip').isVisible(), false); await tap(page.locator('#week-toggle')); assert.equal(await page.locator('#week-strip button').count(), 7);
    assert.deepEqual(await page.locator('#week-strip button').evaluateAll(bs => bs.map(b => b.dataset.day)), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    await tap(page.locator('#week-strip [data-day="2026-11-25"]')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await text('day-title'), 'Tomorrow');
    await tap(page.locator('#week-strip [data-day="2026-11-23"]')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('date-label'), '23 Nov');
    assert.equal(await page.locator('#home-streak').isVisible(), false, 'the Today pill replaces the streak chip on other days');
    // A v9 Dessert from that day is listed under Other food (its slot is gone), and still counts in the score.
    assert.equal(await page.locator('#entries [data-entry="plan-2026-11-23-E"]').count(), 1); assert.equal(await page.locator('#quest-total').innerText(), '5');
    await tap(page.locator('#return-today'));
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#week-strip button').first().getAttribute('data-day'), '2026-11-16');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await tap(page.locator('#week-toggle')); assert.equal(await page.locator('#week-strip').isVisible(), false);
    await tap(page.locator('[data-view=settings]')); assert.equal(await page.locator('#journey-start-date').inputValue(), '2026-10-08');
    await page.locator('#journey-start-date').fill('2026-10-09'); await tap(page.locator('#settings-form button')); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await page.locator('#home-streak').innerText(), '47', 'the streak follows Day 1');
    await tap(page.locator('[data-view=settings]')); await page.locator('#journey-start-date').fill('2026-10-08'); await tap(page.locator('#settings-form button')); await tap(page.locator('[data-view=today]'));
    for (const [instant, label] of [['2026-11-24T14:29:59Z', 'Day 48'], ['2026-11-24T14:30:00Z', 'Day 49'], ['2026-11-25T12:00:00+09:30', 'Day 49']]) { await at(instant); assert.equal(await page.locator('#journey-day').innerText(), label); }
    // A missed day breaks the streak; Undo gives it back. One switch in Settings › Selected day.
    await at(NOON); await page.evaluate(() => CHADUX.goTo('2026-11-20')); await tap(page.locator('[data-view=settings]'));
    assert.match(await page.locator('#weight-date').innerText(), /Fri 20 Nov/i); await page.locator('#missed-day').check();
    assert.equal((await day('2026-11-20')).missed, true); assert.match(await page.locator('#undo-toast').innerText(), /missed/i);
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '4 day streak', '21-24 Nov');
    await undo(); assert.equal((await day('2026-11-20')).missed, undefined); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak');
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey())); await tap(page.locator('[data-view=today]'));

    // Time-aware Today (Darwin). Tuesday: Pull. Only the block that matters now is big; the rest are quiet lines.
    await at('2026-11-24T08:00:00+09:30');
    assert.deepEqual(await blocks(), ['WATER', 'meal:L', 'rows:session,D,P,wrap'], 'morning: water, and lunch next (no breakfast)');
    assert.equal(await page.locator('[data-slot=B],[data-meal-row=B],[data-meal-slot=B]').count(), 0, 'no breakfast anywhere'); assert.doesNotMatch(await page.locator('#today').innerText(), /breakfast|pre-gym/i);
    await at(NOON);
    assert.deepEqual(await blocks(), ['meal:L', 'water', 'rows:session,D,P,wrap'], 'midday: lunch');
    await at('2026-11-24T16:30:00+09:30');
    assert.deepEqual(await blocks(), ['SESSION', 'water', 'rows:L,D,P,wrap'], '4-6 pm: the session, water below (no pre-gym meal)');
    assert.match(await page.locator('#session-hero').innerText(), /Pull[\s\S]*7 exercises · 60 min[\s\S]*Start/); assert.ok((await page.locator('#session-hero [data-gym-start]').boundingBox()).height >= 72, 'a BIG Start');
    await at('2026-11-24T19:00:00+09:30');
    assert.deepEqual(await blocks(), ['meal:D', 'WRAP', 'water', 'rows:L,session,P'], 'evening: dinner and the wrap-up');
    assert.equal(await page.locator('#wrap-up [data-quest]').count(), 4, 'cardio, steps, sleep, Hydralyte');
    await at('2026-11-25T19:00:00+09:30');
    assert.deepEqual(await blocks(), ['SESSION', 'WRAP', 'water', 'rows:L,D,P'], 'Wednesday evening: Muay Thai first');
    assert.match(await page.locator('#session-hero').innerText(), /Muay Thai · 6:30 pm/);
    await tap(page.locator('#session-hero [data-quest=training]')); assert.equal((await day('2026-11-25')).training, true);
    assert.deepEqual(await blocks(), ['meal:D', 'WRAP', 'water', 'rows:L,session,P'], 'Muay Thai done: dinner is next');
    await undo(); assert.equal((await day('2026-11-25')).training, undefined);
    await at('2026-11-29T16:30:00+09:30');
    assert.match(await page.locator('#session-hero').innerText(), /Rest \+ walk/); await tap(page.locator('#session-hero [data-quest=cardio]')); assert.equal((await day('2026-11-29')).cardio, true, 'Sunday: the walk is one tap');
    await at('2026-12-28T16:30:00+09:30');
    assert.match(await page.locator('#session-hero').innerText(), /Deload week[\s\S]*half the sets/i); assert.match(await page.locator('#session-hero').innerText(), /Push[\s\S]*6 exercises/);
    // A quiet line opens in place and folds back; another day shows its next meal and no time-of-day hero.
    await at(NOON);
    await tap(page.locator('[data-row=session]')); assert.equal(await page.locator('.ch-gymcard.is-open [data-gym-start]').count(), 1, 'the session opens in place, Start inside');
    await again(page.locator('[data-fold=session]')); assert.equal(await page.locator('.ch-gymcard.is-open').count(), 0);
    await page.evaluate(() => CHADUX.navigate(1)); assert.deepEqual(await blocks(), ['meal:L', 'water', 'rows:session,D,P,wrap'], 'tomorrow: its first meal, nothing on the clock'); await tap(page.locator('#return-today'));

    // Meals: exactly three options, Strict, Medium, Free, each with kcal, P/C/F and how to make or order it.
    assert.equal(await page.locator('#today details,#today summary,#training details,#training summary').count(), 0);
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 3); assert.deepEqual(await page.locator('#next-up .meal-pick').evaluateAll(n => n.map(b => b.dataset.tier)), ['S', 'M', 'F']);
    assert.deepEqual(await page.locator('#next-up .ch-opt__tier').allTextContents(), ['Strict', 'Medium', 'Free']);
    assert.match(await page.locator('#next-up [data-tier=S]').innerText(), /715[\s\S]*kcal[\s\S]*Nando's ½ PERi chicken[\s\S]*P\s*108[\s\S]*C\s*1[\s\S]*F\s*31[\s\S]*Grab a ½ PERi-PERi chicken at Nando's\. No sides, bread or mayo\./);
    assert.match(await page.locator('#next-up [data-tier=M]').innerText(), /445[\s\S]*Gochi \+ 4 Nando's tenders[\s\S]*P\s*71[\s\S]*C\s*26[\s\S]*F\s*9/);
    assert.match(await page.locator('#next-up [data-tier=F]').innerText(), /Uber Eats: GYG brisket bowl[\s\S]*Order a Brisket Burrito Bowl\. Ask to skip the grain base, add brisket\. No corn chips or drink\./);
    assert.deepEqual(await page.locator('#next-up .ch-opt').evaluateAll(n => n.map(e => e.classList.contains('is-pinned'))), [true, true, false], 'the two go-tos are pinned first');
    assert.match(await page.locator('#next-up .ch-remaining').innerText(), /Remaining today[\s\S]*1,900 kcal[\s\S]*P\s*220[\s\S]*C\s*150[\s\S]*F\s*45/); assert.equal(await page.locator('#next-up [data-best]').count(), 0, 'nothing logged yet: no best fit');
    assert.equal(await page.locator('#next-up .meal-how').evaluateAll(n => n.every(e => e.scrollHeight <= e.clientHeight + 1)), true, 'the how-to is shown in full');
    assert.equal(await page.locator('#today .meal-info, .water-minus').count(), 0, 'no details buttons, no minus: less is more');
    // Counts every click; installed again after a reload.
    const oneTap = async (locator, check) => {
      await page.evaluate(() => { if (!window.qaCounting) { window.qaCounting = true; document.addEventListener('click', () => window.qaTaps++, true); } window.qaTaps = 0; });
      await tap(locator); assert.equal(await page.evaluate(() => window.qaTaps), 1); await check();
    };
    await oneTap(page.locator('[data-slot=L][data-tier=S]'), async () => assert.equal((await day()).picks.L, 'S'));
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'D', 'dinner takes the top (no pre-gym meal)');
    assert.equal(await page.locator('#next-up [data-best]').getAttribute('data-tier'), 'S', 'after the go-to lunch the Strict dinner fits best'); assert.match(await page.locator('#next-up [data-best]').innerText(), /Best fit[\s\S]*Roast chook & spuds/i);
    assert.match(await page.locator('#next-up .ch-remaining').innerText(), /1,185 kcal[\s\S]*P\s*112[\s\S]*C\s*149[\s\S]*F\s*14/);
    assert.match(await page.locator('[data-meal-row=L]').innerText(), /Strict · 715 kcal/); assert.equal(await page.locator('[data-meal-row=L]').evaluate(e => e.classList.contains('is-logged')), true);
    await tap(page.locator('[data-meal-row=L]')); assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 1); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'D', 'opening a line moves nothing else');
    await tap(page.locator('[data-slot=L][data-tier=M]')); assert.equal((await day()).picks.L, 'M'); assert.equal((await saved(page)).entries.filter(e => e.day === key && e.planSlot === 'L').length, 1, 'switching never duplicates');
    assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 0, 'a choice folds the meal back'); assert.match(await page.locator('[data-meal-row=L]').innerText(), /Medium · 445 kcal/);
    await undo(); assert.equal((await day()).picks.L, 'S'); await tap(page.locator('#undo-toast button')); assert.equal((await day()).picks.L, 'M', 'Undo offers Redo'); await undo();
    await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]')); assert.equal((await day()).picks.L, undefined, 'tapping the logged option removes it');
    await tap(page.locator('[data-meal-toggle=L]')); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L', 'folded, an unlogged lunch leads again at noon'); await undo(); assert.equal((await day()).picks.L, 'S');
    // Long press: the meal sheet compares the three without logging; one button logs.
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(450);          // clear of the sticky header and any shield
    const card = page.locator('[data-slot=D][data-tier=S]'); await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
    assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.equal((await day()).picks.D, undefined);
    assert.equal(await page.locator('#detail-sheet .ch-steps li').count(), 3); assert.match(await page.locator('#detail-content .ch-macros').innerText(), /kcal[\s\S]*Protein[\s\S]*Carbs[\s\S]*Fat/);
    await tap(page.locator('#detail-sheet .ch-tier[data-tier=M]')); assert.match(await page.locator('#detail-sheet').innerText(), /Steak & mash \+ spuds[\s\S]*820/);
    await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log medium dinner' })); assert.equal((await day()).picks.D, 'M'); await undo(); assert.equal((await day()).picks.D, undefined);
    await tap(page.locator('#today-scan')); await page.mouse.click(196, 40); assert.equal(await page.locator('#add-sheet').isVisible(), false, 'tapping outside closes a sheet');

    // Water: one tap per 500 mL, the goal in words, the streak; no minus (Undo takes it back); past the goal is fine.
    const water = page.locator('.water-row');
    assert.match(await water.innerText(), /0\s*\/4\.5 L[\s\S]*4\.5 L to go/); assert.match(await water.innerText(), /3/, 'a 3-day water streak (21-23 Nov)');
    await oneTap(water, async () => assert.equal((await day()).water, .5)); assert.match(await water.innerText(), /4 L to go/);
    await undo(); assert.equal((await day()).water, undefined, 'Undo puts water back to nothing at all');
    for (let i = 0; i < 9; i++) await tap(water);
    assert.equal((await day()).water, 4.5); assert.equal(await water.evaluate(e => e.classList.contains('is-full')), true); assert.match(await water.innerText(), /Goal hit/); assert.match(await water.getAttribute('aria-label'), /4 day water streak/);
    await tap(water); assert.equal((await day()).water, 5, 'more than the goal is fine'); await undo(); assert.equal((await day()).water, 4.5);

    // Done chips: one tap on, one tap off, XP in the toast, Undo.
    await at('2026-11-24T19:00:00+09:30');
    for (const [field, label] of [['cardio', 'Incline walk'], ['steps', '10k steps'], ['sleep', 'Sleep 7 h+'], ['electrolyte', 'Hydralyte']]) {
      const chip = page.locator(`#wrap-up [data-quest=${field}]`); assert.equal(await chip.innerText(), label);
      await oneTap(chip, async () => assert.equal((await day())[field], true)); assert.match(await page.locator('#undo-toast').innerText(), /logged[\s\S]*XP/);
    }
    await again(page.locator('#wrap-up [data-quest=steps]')); assert.equal((await day()).steps, false, 'a second tap switches it off'); await undo(); assert.equal((await day()).steps, true);
    assert.match(await page.locator('#wrap-up').innerText(), /4\.5 L/);

    // Training: one session at a time, the week as rows; Mark done for a past day; exercise rows open their history.
    await at(NOON); await tap(page.locator('[data-view=training]'));
    assert.equal(await page.locator('.training-level').count(), 1); assert.equal(await page.locator('.training-level').getAttribute('data-day'), key); assert.equal(await page.locator('.training-row').count(), 6);
    assert.equal(await page.locator('.is-today .exercise-row').count(), 7); assert.match(await page.locator('.is-today .exercise-row').first().innerText(), /Pull-ups[\s\S]*3 × 6–10 · rest 2 min/);
    await tap(page.locator('.is-today .exercise-row').first()); assert.match(await page.locator('#detail-sheet').innerText(), /Bodyweight first|Last/); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.is-today [data-gym-start]').count(), 1, 'Start on today\'s session');
    await tap(page.locator('.training-row[data-day="2026-11-23"]')); assert.equal(await page.locator('.training-level').getAttribute('data-day'), '2026-11-23');
    assert.equal(await page.locator('.training-level [data-gym-start]').count(), 0, 'no Start on another day');
    await tap(page.locator('.training-level [data-quest=training]')); assert.equal((await day('2026-11-23')).training, true); assert.match(await page.locator('#undo-toast').innerText(), /Push done · Yesterday/);
    await undo(); assert.equal((await day('2026-11-23')).training, undefined); await tap(page.locator('#training-today'));

    // Past days are editable, including Quick add, and the toast names the day it landed on.
    await tap(page.locator('[data-view=today]')); await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await text('date-label'), '23 Nov');
    await tap(page.locator('[data-meal-row=D]')); await tap(page.locator('[data-slot=D][data-tier=M]')); assert.equal((await day('2026-11-23')).picks.D, 'M'); assert.match(await page.locator('#undo-toast').innerText(), /Dinner logged · Yesterday/);
    await tap(page.locator('.water-row')); assert.equal((await day('2026-11-23')).water, 5);
    await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=manual]')); await page.locator('#food-name').fill('Synthetic quick meal'); await page.locator('#calories').fill('123'); await tap(page.locator('#add-form button'));
    assert.equal((await saved(page)).entries.at(-1).day, '2026-11-23'); assert.match(await page.locator('#undo-toast').innerText(), /Yesterday/);

    // Real protocol touch swipes: horizontal changes the day (even starting on a card), vertical scrolls.
    await page.waitForTimeout(450); await page.evaluate(() => scrollTo(0, 0)); const cdp = await context.newCDPSession(page);
    const swipe = async (from, to) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await swipe({ x: 320, y: 300 }, { x: 100, y: 305 }); assert.equal(await text('day-title'), 'Today');
    const lead = await page.locator('#next-up .meal-pick').first().boundingBox(), before = await saved(page);
    await swipe({ x: lead.x + lead.width - 10, y: lead.y + 30 }, { x: lead.x - 20, y: lead.y + 34 });
    assert.equal(await text('day-title'), 'Tomorrow', 'a swipe can start on a card'); assert.deepEqual(await saved(page), before, 'and never logs it');
    await swipe({ x: 80, y: 300 }, { x: 300, y: 296 }); assert.equal(await text('day-title'), 'Today');
    await swipe({ x: 200, y: 300 }, { x: 178, y: 302 }); await swipe({ x: 200, y: 300 }, { x: 170, y: 340 }); assert.equal(await text('day-title'), 'Today', 'short and diagonal drags are not swipes');
    assert.equal(await page.locator('#day-page').evaluate(e => e.style.transform + e.style.opacity), '');
    await page.evaluate(() => scrollTo(0, 0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 30, y: 470 }] });
    for (const y of [430, 370, 300]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 35, y }] });
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 35, y: 300 }] }); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.ok(await page.evaluate(() => scrollY) > 0, 'vertical drag scrolls');
    assert.equal(await page.locator('.ch-datebar.is-scrolled').count() > 0, true);
    await tap(page.locator('[data-view=training]')); await page.evaluate(() => scrollTo(0, 0));
    await swipe({ x: 320, y: 400 }, { x: 90, y: 404 }); assert.equal(await page.locator('.training-level').first().getAttribute('data-day'), '2026-11-25', 'Training swipes days too');
    await tap(page.locator('#training-today')); await tap(page.locator('[data-view=today]'));

    const got = await saved(page);
    assert.equal(got.entries[0].extra, 'keep'); assert.equal(got.questsV5['2026-11-23'].extension, 'keep'); assert.deepEqual(got.customExtension, { keep: true }); assert.equal(got.schemaVersion, 5);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-fixture')), 'preserve');
    await page.evaluate(() => dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' }))); assert.equal(await page.locator('#add-form').count(), 1);

    // The + sheet: four ways in. Snap + Say without any AI still logs: say what it is, then search, barcode or quick add.
    await tap(page.locator('#today-scan')); assert.deepEqual(await page.locator('[data-add]').evaluateAll(bs => bs.map(b => b.dataset.add)), ['camera', 'barcode', 'search', 'manual']);
    await tap(page.locator('[data-add=camera]')); assert.equal(await page.locator('#snap-ways').isVisible(), true); assert.equal(await page.locator('#describe-button').isVisible(), false);
    assert.doesNotMatch(await page.locator('#scan-sheet').innerText(), /error|failed|key/i);
    const requests = []; await page.route('https://*.openfoodfacts.org/**', route => { requests.push(new URL(route.request().url()).host); return route.abort('failed'); });
    await page.locator('#food-description').fill('yopro'); await tap(page.locator('[data-snap=search]'));
    assert.equal(await page.locator('#food-search').inputValue(), 'yopro'); await page.locator('#food-state').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#food-state').innerText(), /unavailable right now/); assert.equal(requests.length, 7, 'retry with backoff, then the last-resort endpoints');
    await tap(page.locator('#scan-manual')); assert.equal(await page.locator('#food-name').inputValue(), 'yopro'); await page.keyboard.press('Escape');
    await tap(page.locator('[data-view=today]'));

    // An undo must not replace newer fields or entries written by another tab.
    const beforeWater = (await day()).water; await tap(page.locator('.water-row'));
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension.newer = true; s.entries.push({ ...s.entries[0], id: 'other-tab' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' })); });
    await undo(); assert.equal((await day()).water, beforeWater); assert.equal((await saved(page)).customExtension.newer, true); assert.ok((await saved(page)).entries.some(e => e.id === 'other-tab'));
    // Failed storage leaves journal and pressed state unchanged, with an honest error.
    const beforeFailure = await saved(page); await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'rec-calories-v1') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return window.qaSetItem.call(this, k, v); }; });
    await tap(page.locator('[data-meal-row=P]')); await tap(page.locator('[data-slot=P][data-tier=S]')); assert.deepEqual(await saved(page), beforeFailure); assert.match(await page.locator('#message').innerText(), /Could not save/);
    assert.equal(await page.locator('[data-slot=P][data-tier=S]').getAttribute('aria-pressed'), 'false'); await page.evaluate(() => Storage.prototype.setItem = window.qaSetItem);
    await again(page.locator('[data-meal-toggle=P]'));
    // Keyboard: Space logs the focused card, and focus lands on that meal's row.
    const first = page.locator('#next-up .meal-pick').first(), slot = await first.getAttribute('data-slot');
    await first.focus(); await page.keyboard.press('Space'); assert.equal((await day()).picks[slot], 'S'); assert.equal(await page.evaluate(() => document.activeElement.dataset.mealRow), slot);
    // Browsing a future phase shows its goals without rewriting the saved ones.
    const targetBefore = (await saved(page)).target; await page.evaluate(() => CHADUX.navigate(20)); assert.equal(await page.locator('#target-label').innerText(), '3,000'); assert.equal((await saved(page)).target, targetBefore); await tap(page.locator('#return-today'));
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller); await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 3, 'the shell works offline'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.deepEqual(errors, []);
    await context.close();
    // Left open across 11:00, 3 pm and 6 pm, Today moves on by itself: the clock check runs once a minute.
    const open = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), live = await open.newPage(), liveErrors = watch(live);
    await live.clock.install({ time: new Date('2026-11-24T10:59:20+09:30') }); await live.goto('http://127.0.0.1:8090/');
    const hero = () => live.locator('#daily-checklist > :first-child').evaluate(e => e.id === 'next-up' ? 'meal:' + e.dataset.mealSlot : e.id || e.className.split(' ')[0]);
    assert.equal(await hero(), 'water-row', '10:59: water first');
    await live.clock.runFor(61000); assert.equal(await hero(), 'meal:L', '11:00: lunch, without a reload');
    await live.clock.runFor(4 * 3600000); assert.equal(await hero(), 'session-hero', '3 pm: the session');
    await live.clock.runFor(3 * 3600000); assert.equal(await hero(), 'meal:D', '6 pm: dinner'); assert.equal(await live.locator('#wrap-up').count(), 1);
    assert.deepEqual(liveErrors, []); await open.close();
    console.log('PASS v10 UX: Day 48 and a 48-day journey streak (Day 1 edits, Darwin midnight), a missed day restarts it with Undo; Today on Darwin time: morning water + lunch next (no breakfast), midday lunch, 4-6 pm the session with a 72 px Start and water below, evening dinner + wrap-up, Wednesday Muay Thai first, Sunday rest + walk, deload weeks, quiet lines that open in place, and the switch at 11, 3 and 6 with the app left open; meals Strict/Medium/Free in order with kcal, P/C/F and the how-to in full, lunch go-tos pinned, Remaining today, best fit after lunch, 1 tap to log, switch, remove, Undo/Redo, long press compares; water 1 tap with goal words and streak, no minus; done chips 1 tap with XP; Training session + week rows, Mark done with the day in the toast; old Dessert under Other food; past editing; swipes, arrow keys, week strip; Snap + Say hand-off; cross-tab Undo; failed storage; keyboard; offline; zero console errors.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
