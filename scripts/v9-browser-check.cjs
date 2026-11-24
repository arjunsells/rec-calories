// v9 interaction contract: less on screen, one tap per action, every change reversible, days by swipe, week strip and
// arrow keys, sheets, recovery. Isolated disposable contexts only. No user profile or fixture file is read.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');

(async () => {
  const server = await serve(8090), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page, text => text.includes('net::ERR_FAILED')), key = '2026-11-24';
    process.on('exit', () => { if (process.exitCode && errors.length) console.error('Page errors seen before the failure: ' + errors.join(' | ')); });
    await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8090/'); assert.deepEqual(errors, [], 'boot errors');
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension = { keep: true }; s.questsV5 = { '2026-11-23': { water: .5, extension: 'keep' } }; s.entries = [{ id: 'synthetic-history', day: '2026-11-23', name: 'Synthetic historic meal', kcal: 400, protein: 30, extra: 'keep' }]; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('unrelated-fixture', 'preserve'); });
    await page.reload();
    const text = id => page.locator('#' + id).evaluate(e => e.textContent);
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };          // a second tap within 400 ms is a slip by design
    const undo = () => tap(page.locator('#undo-toast button'));                                    // waits until the button is armed
    const day = async (k = key) => (await saved(page)).questsV5?.[k] || {};

    // Journey day: 24 Nov 2026 is Day 48, 25 Nov is Day 49. It is the title, and it follows the day in view.
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await page.locator('h1#journey-day').count(), 1);
    assert.equal(await text('day-title'), 'Today'); assert.equal(await text('date-label'), 'Tue 24 Nov');
    // The week folds away: one header button instead of two arrows and seven days.
    assert.equal(await page.locator('#previous-day,#next-day').count(), 0, 'no arrow buttons');
    assert.equal(await page.locator('#week-strip').isVisible(), false); assert.equal(await page.locator('#week-toggle').getAttribute('aria-expanded'), 'false');
    await tap(page.locator('#week-toggle')); assert.equal(await page.locator('#week-strip').isVisible(), true); assert.equal(await page.locator('#week-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#week-strip button').count(), 7);
    assert.deepEqual(await page.locator('#week-strip button').evaluateAll(bs => bs.map(b => b.dataset.day)), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    assert.equal(await page.locator('#week-strip [aria-current=date]').getAttribute('data-day'), key);
    await tap(page.locator('#week-strip [data-day="2026-11-25"]')); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await text('day-title'), 'Tomorrow');
    await tap(page.locator('#week-strip [data-day="2026-11-23"]'));
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('day-title'), 'Yesterday'); assert.equal(await text('date-label'), '23 Nov');
    assert.equal(await page.locator('#home-streak').isVisible(), false, 'the Today pill replaces the streak chip on other days');
    await tap(page.locator('#return-today')); assert.equal(await page.locator('#return-today').isVisible(), false);
    // Arrow keys change the day too (keyboards, and anyone without a touch screen).
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#week-strip button').first().getAttribute('data-day'), '2026-11-16', 'the strip follows into the previous week');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    await tap(page.locator('#week-toggle')); assert.equal(await page.locator('#week-strip').isVisible(), false, 'and folds away again');
    await tap(page.locator('[data-view=settings]'));
    assert.equal(await page.locator('#journey-start-date').inputValue(), '2026-10-08');
    await page.locator('#journey-start-date').fill('2026-10-09'); await tap(page.locator('#settings-form button'));
    assert.equal((await saved(page)).journeyStartDate, '2026-10-09'); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    await tap(page.locator('[data-view=settings]'));
    await page.locator('#journey-start-date').fill('2026-10-08'); await tap(page.locator('#settings-form button')); await tap(page.locator('[data-view=today]'));
    // Calendar dates stay Darwin-based even with a New York browser timezone: Day 48 until midnight in Darwin, then 49.
    for (const [instant, label] of [['2026-11-24T14:29:59Z', 'Day 48'], ['2026-11-24T14:30:00Z', 'Day 49'], ['2026-11-25T12:00:00+09:30', 'Day 49']]) { await page.clock.setFixedTime(new Date(instant)); await page.reload(); assert.equal(await page.locator('#journey-day').innerText(), label); }
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();

    // Less is more: one meal shows its three options; the other three are single quiet rows.
    assert.equal(await page.locator('#today details,#today summary,#training details,#training summary').count(), 0);
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 3); assert.equal(await page.locator('#next-up [data-slot=L]').count(), 3);
    assert.equal(await page.locator('#today .meal-info').count(), 1, 'one details button per meal, not per card');
    assert.deepEqual(await page.locator('#today [data-meal-row]').evaluateAll(n => n.map(e => e.dataset.mealRow)), ['P', 'D', 'E']);
    assert.match(await page.locator('#next-up [data-slot=L][data-tier=S]').innerText(), /kcal[\s\S]*P\s?60[\s\S]*C\s?58[\s\S]*F\s?14/, 'every card shows kcal and P/C/F');
    await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
    const oneTap = async (locator, check) => { await page.evaluate(() => window.qaTaps = 0); await tap(locator); assert.equal(await page.evaluate(() => window.qaTaps), 1); await check(); };
    await oneTap(page.locator('[data-slot=L][data-tier=S]'), async () => assert.equal((await day()).picks.L, 'S'));
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'P', 'the next meal takes the top');
    assert.deepEqual(await page.locator('#today [data-meal-row]').evaluateAll(n => n.map(e => e.dataset.mealRow)), ['L', 'D', 'E'], 'rows keep the order of the day');
    assert.match(await page.locator('[data-meal-row=L]').innerText(), /Strict · 584 kcal/); assert.equal(await page.locator('[data-meal-row=L]').evaluate(e => e.classList.contains('is-logged')), true);
    await oneTap(page.locator('[data-water]').first(), async () => assert.equal((await day()).water, .5));
    await undo(); assert.equal((await day()).water, undefined, 'Undo puts water back to nothing at all');
    await oneTap(page.locator('[data-quest=electrolyte]'), async () => assert.equal((await day()).electrolyte, true));
    await again(page.locator('[data-quest=electrolyte]')); assert.equal((await day()).electrolyte, false, 'a second tap switches it off');
    await tap(page.locator('[data-view=training]')); assert.equal(await page.locator('.training-level').first().getAttribute('data-day'), key);
    assert.equal(await page.locator('.training-level').count(), 1, 'one session at a time; the rest of the week is rows');
    assert.equal(await page.locator('.training-row').count(), 6);
    await oneTap(page.locator('.is-today .exercise-toggle').first(), async () => assert.equal((await day()).exercises[0], true));
    await again(page.locator('.is-today .exercise-toggle').first()); assert.equal((await day()).exercises[0], false);
    await tap(page.locator('.training-row[data-day="2026-11-23"]')); assert.equal(await page.locator('.training-level').getAttribute('data-day'), '2026-11-23', 'a row opens that day');
    await tap(page.locator('.training-level .exercise-toggle').first());
    assert.equal((await day('2026-11-23')).exercises[0], true); assert.equal((await day()).exercises[0], false);
    await tap(page.locator('#training-today')); assert.equal(await page.locator('.training-level').getAttribute('data-day'), key);

    // A row opens its meal in place: tap another option to switch, the gold one to remove; Undo and Redo.
    await tap(page.locator('[data-view=today]')); await tap(page.locator('[data-meal-row=L]'));
    assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 1); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'P', 'opening a row moves nothing else');
    assert.equal(await page.locator('[data-slot=L][data-tier=S]').getAttribute('aria-pressed'), 'true');
    await tap(page.locator('[data-slot=L][data-tier=M]'));
    assert.equal((await day()).picks.L, 'M'); assert.equal((await saved(page)).entries.filter(e => e.day === key && e.planSlot === 'L').length, 1, 'switching never duplicates');
    assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 0, 'a choice folds the meal back into its row'); assert.match(await page.locator('[data-meal-row=L]').innerText(), /Medium · 595 kcal/);
    await undo(); assert.equal((await day()).picks.L, 'S');
    await tap(page.locator('#undo-toast button')); assert.equal((await day()).picks.L, 'M', 'Undo offers Redo');
    await undo(); assert.equal((await day()).picks.L, 'S');
    await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]'));
    assert.equal((await day()).picks.L, undefined, 'tapping the logged option removes it'); assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 1, 'and the meal stays open to pick again');
    await tap(page.locator('[data-meal-toggle=L]')); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L', 'folded, an unlogged meal leads again');
    await undo(); assert.equal((await day()).picks.L, 'S');
    // The details sheet: all three options to compare; looking never logs; one button logs or switches.
    await again(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-meal-slot=L] .meal-info'));   // the row sits where the fold button was: a quick second tap there is a slip by design
    assert.equal(await page.locator('#detail-sheet .ch-tier[aria-pressed=true]').innerText(), 'Strict'); assert.equal(await page.locator('#detail-sheet .ch-tier.is-logged').getAttribute('data-tier'), 'S');
    await tap(page.locator('#detail-sheet .ch-tier[data-tier=F]')); assert.equal((await day()).picks.L, 'S', 'looking at another option never logs it');
    await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Switch to free' })); assert.equal((await day()).picks.L, 'F');
    await undo(); assert.equal((await day()).picks.L, 'S'); assert.equal(await page.locator('[data-meal-slot=L].is-open').count(), 0, 'a choice made in the sheet folds the meal too');
    // Water: the row adds 500 mL a tap, even past the goal; − takes 500 mL off; Undo puts it back.
    assert.equal(await page.locator('.water-minus').isVisible(), false, 'nothing to take off yet');
    for (let i = 0; i < 9; i++) await tap(page.locator('.water-row'));
    assert.equal((await day()).water, 4.5); assert.equal(await page.locator('.water-row').getAttribute('class').then(c => c.includes('is-full')), true);
    await tap(page.locator('.water-row')); assert.equal((await day()).water, 5, 'more than the goal is fine');
    await tap(page.locator('.water-minus')); await tap(page.locator('.water-minus')); assert.equal((await day()).water, 4);
    await undo(); assert.equal((await day()).water, 4.5);
    // Long press and the details button open the meal's sheet without logging; the sheet logs in one more tap.
    await tap(page.locator('#next-up .meal-info')); assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.ok(await page.locator('#detail-content li').count());
    assert.match(await page.locator('#detail-content .ch-macros').innerText(), /kcal[\s\S]*g[\s\S]*Protein[\s\S]*g[\s\S]*Carbs[\s\S]*g[\s\S]*Fat/, 'the sheet shows all four macros with units');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#detail-sheet').isVisible(), false);
    const meal = page.locator('[data-slot=P][data-tier=S]'); await meal.scrollIntoViewIfNeeded(); const box = await meal.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
    assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.equal((await day()).picks.P, undefined);
    await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log strict pre-gym' }));
    assert.equal(await page.locator('#detail-sheet').isVisible(), false); assert.equal((await day()).picks.P, 'S');
    await undo(); assert.equal((await day()).picks.P, undefined);
    await tap(page.locator('#today-scan')); await page.mouse.click(196, 40); assert.equal(await page.locator('#add-sheet').isVisible(), false, 'tapping outside closes a sheet');
    // Past days are editable, including Quick add, and the toast names the day it landed on.
    await page.locator('body').focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await text('date-label'), '23 Nov');
    await tap(page.locator('[data-meal-row=D]')); await tap(page.locator('[data-slot=D][data-tier=M]'));
    assert.equal((await day('2026-11-23')).picks.D, 'M'); assert.match(await page.locator('#undo-toast').innerText(), /Dinner logged · Yesterday/);
    await tap(page.locator('.water-row')); assert.equal((await day('2026-11-23')).water, 1);
    await tap(page.locator('[data-quest=sleep]')); assert.equal((await day('2026-11-23')).sleep, true);
    await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=manual]')); await page.locator('#food-name').fill('Synthetic quick meal'); await page.locator('#calories').fill('123'); await tap(page.locator('#add-form button'));
    assert.equal((await saved(page)).entries.at(-1).day, '2026-11-23'); assert.match(await page.locator('#undo-toast').innerText(), /Yesterday/);

    // Real protocol touch swipes: horizontal changes the day (even when it starts on a meal card), vertical scrolls.
    await page.waitForTimeout(450);                            // the page ignores touches for 400 ms after an action closes a sheet
    await page.evaluate(() => scrollTo(0, 0)); const cdp = await context.newCDPSession(page);
    const swipe = async (from, to) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await swipe({ x: 320, y: 300 }, { x: 100, y: 305 });
    assert.equal(await text('day-title'), 'Today');
    const card = await page.locator('#next-up .meal-pick').first().boundingBox(), before = await saved(page);
    await swipe({ x: card.x + card.width - 10, y: card.y + 60 }, { x: card.x - 20, y: card.y + 64 });
    assert.equal(await text('day-title'), 'Tomorrow', 'a swipe can start on a card'); assert.deepEqual(await saved(page), before, 'and never logs it');
    await swipe({ x: 80, y: 300 }, { x: 300, y: 296 }); assert.equal(await text('day-title'), 'Today', 'swiping right goes back a day');
    await swipe({ x: 200, y: 300 }, { x: 178, y: 302 }); assert.equal(await text('day-title'), 'Today', 'a short drag is not a swipe');
    await swipe({ x: 200, y: 300 }, { x: 170, y: 340 }); assert.equal(await text('day-title'), 'Today', 'a diagonal drag is not a swipe');
    assert.equal(await page.locator('#day-page').evaluate(e => e.style.transform + e.style.opacity), '', 'an abandoned drag leaves the page where it was');
    await page.evaluate(() => scrollTo(0, 0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 30, y: 470 }] });
    for (const y of [430, 370, 300]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 35, y }] });
    // Hold still before lifting: a flung page swallows the next tap (it only stops the scroll), as on a real phone.
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 35, y: 300 }] }); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48', 'vertical drag keeps the date');
    assert.ok(await page.evaluate(() => scrollY) > 0, 'vertical drag scrolls normally');
    assert.equal(await page.locator('.ch-datebar.is-scrolled').count() > 0, true, 'the header collapses once content scrolls under it');
    await tap(page.locator('[data-view=training]')); assert.equal(await page.locator('#training').isVisible(), true); await page.evaluate(() => scrollTo(0, 0));
    await swipe({ x: 320, y: 400 }, { x: 90, y: 404 }); assert.equal(await page.locator('.training-level').first().getAttribute('data-day'), '2026-11-25', 'Training swipes days too');
    await tap(page.locator('#training-today')); await tap(page.locator('[data-view=today]'));

    const got = await saved(page);
    assert.equal(got.entries[0].extra, 'keep'); assert.equal(got.questsV5['2026-11-23'].extension, 'keep'); assert.deepEqual(got.customExtension, { keep: true }); assert.equal(got.schemaVersion, 5);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-fixture')), 'preserve');
    await page.evaluate(() => dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' }))); assert.equal(await page.locator('#add-form').count(), 1);
    for (const [time, slot] of [['15:00:00', 'P'], ['19:00:00', 'D'], ['22:00:00', 'E']]) { await page.clock.setFixedTime(new Date('2026-11-24T' + time + '+09:30')); await page.reload(); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), slot); }

    // The + sheet: four ways in. Snap + Say without any AI still logs: say what it is, then search, barcode or quick add.
    await tap(page.locator('#today-scan')); assert.deepEqual(await page.locator('[data-add]').evaluateAll(bs => bs.map(b => b.dataset.add)), ['camera', 'barcode', 'search', 'manual']);
    await tap(page.locator('[data-add=camera]'));
    assert.equal(await page.locator('#snap-ways').isVisible(), true); assert.equal(await page.locator('#describe-button').isVisible(), false);
    assert.deepEqual(await page.locator('#snap-ways [data-snap]').evaluateAll(bs => bs.map(b => b.dataset.snap)), ['search', 'barcode', 'manual']);
    assert.doesNotMatch(await page.locator('#scan-sheet').innerText(), /error|failed|key/i, 'no scary words, no key nagging');
    const requests = []; await page.route('https://*.openfoodfacts.org/**', route => { requests.push(new URL(route.request().url()).host); return route.abort('failed'); });
    await page.locator('#food-description').fill('yopro'); await tap(page.locator('[data-snap=search]'));
    assert.equal(await page.locator('#scan').getAttribute('data-mode'), 'search'); assert.equal(await page.locator('#food-search').inputValue(), 'yopro');
    await page.locator('#food-state').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#food-state').innerText(), /unavailable right now/); assert.match(await page.locator('#food-state').innerText(), /Quick add/);
    assert.deepEqual(requests, ['au.openfoodfacts.org', 'world.openfoodfacts.org', 'au.openfoodfacts.org', 'world.openfoodfacts.org', 'world.openfoodfacts.org', 'search.openfoodfacts.org', 'au.openfoodfacts.org'], 'retry with backoff, then the last-resort endpoints');
    assert.equal(await page.locator('#food-state').getByRole('button', { name: 'Try again' }).count(), 1);
    await tap(page.locator('#scan-manual')); assert.equal(await page.locator('#manual-sheet').isVisible(), true); assert.equal(await page.locator('#food-name').inputValue(), 'yopro'); await page.keyboard.press('Escape');
    await tap(page.locator('[data-view=today]'));

    // An undo must not replace newer fields or entries written by another tab.
    const beforeWater = (await day()).water; await tap(page.locator('.water-row'));
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension.newer = true; s.entries.push({ ...s.entries[0], id: 'other-tab' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' })); });
    await undo();
    assert.equal((await day()).water, beforeWater); assert.equal((await saved(page)).customExtension.newer, true); assert.ok((await saved(page)).entries.some(e => e.id === 'other-tab'));
    // Failed storage leaves journal and pressed state unchanged, with an honest error.
    const beforeFailure = await saved(page); await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); }; });
    await tap(page.locator('[data-quest=cardio]')); assert.deepEqual(await saved(page), beforeFailure); assert.match(await page.locator('#message').innerText(), /Could not save/);
    assert.equal(await page.locator('[data-quest=cardio]').getAttribute('aria-pressed'), 'false'); await page.evaluate(() => Storage.prototype.setItem = window.qaSetItem);
    // Keyboard: Space logs the focused card, and focus lands on that meal's row.
    const lead = page.locator('#next-up .meal-pick').first(), slot = await lead.getAttribute('data-slot');
    await lead.focus(); await page.keyboard.press('Space'); assert.equal((await day()).picks[slot], 'S'); assert.equal(await page.evaluate(() => document.activeElement.dataset.mealRow), slot);
    // Browsing a future phase shows its goals without rewriting the saved ones.
    const targetBefore = (await saved(page)).target; await page.evaluate(() => CHADUX.navigate(20)); assert.equal(await page.locator('#target-label').innerText(), '3,000'); assert.equal((await saved(page)).target, targetBefore); await tap(page.locator('#return-today'));
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller); await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 3, 'the shell works offline'); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.deepEqual(errors, []);
    console.log('PASS v9 UX: one meal expanded + three rows, one details button per meal, P/C/F on every card; meal/bottle/quest/exercise = 1 tap each; no arrows: folding week strip, arrow keys, real touch swipes (also on Training), Day 48 / Day 49 Darwin-based; Undo and Redo, switch without duplicates, remove, water past goal and −, long press and details without logging, log from the sheet, tap-outside close; past editing incl. quick add with the day named in the toast; v7/v8 data preserved; cross-tab; Darwin slots; Snap + Say without AI hands off to search with the words; 7-request food recovery with Quick add hand-off; failed storage; keyboard focus; offline; zero unexpected console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
