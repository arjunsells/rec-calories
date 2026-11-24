// v8 interaction contract: one tap per action, undo, days (arrows, week strip, real touch swipes), sheets, recovery.
// Isolated disposable contexts only. No user profile or fixture file is read.
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

    // Journey day: 24 Nov 2026 is Day 48. It is the title, and it follows the day in view.
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48'); assert.equal(await page.locator('h1#journey-day').count(), 1);
    assert.equal(await text('day-title'), 'Today'); assert.equal(await text('date-label'), 'Tue 24 Nov');
    await page.locator('#next-day').tap(); assert.equal(await page.locator('#journey-day').innerText(), 'Day 49'); assert.equal(await text('day-title'), 'Tomorrow');
    await page.locator('#previous-day').tap(); await page.locator('#previous-day').tap();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 47'); assert.equal(await text('day-title'), 'Yesterday'); assert.equal(await text('date-label'), '23 Nov');
    assert.equal(await page.locator('#home-streak').isVisible(), false, 'the Today pill replaces the streak chip on other days');
    await page.locator('#return-today').tap(); assert.equal(await page.locator('#return-today').isVisible(), false);
    // Week strip: seven days, one tap to jump, the selection is announced.
    assert.equal(await page.locator('#week-strip button').count(), 7);
    assert.deepEqual(await page.locator('#week-strip button').evaluateAll(bs => bs.map(b => b.dataset.day)), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    assert.equal(await page.locator('#week-strip [aria-current=date]').getAttribute('data-day'), key);
    await page.locator('#week-strip [data-day="2026-11-27"]').tap(); assert.equal(await page.locator('#journey-day').innerText(), 'Day 51'); assert.equal(await text('day-title'), ''); assert.equal(await text('date-label'), 'Fri 27 Nov');
    await page.locator('#week-strip [data-day="2026-11-24"]').tap(); assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    for (let i = 0; i < 2; i++) await page.locator('#previous-day').tap();
    assert.equal(await page.locator('#week-strip button').first().getAttribute('data-day'), '2026-11-16', 'the strip follows into the previous week');
    await page.locator('#return-today').tap();
    await page.locator('[data-view=settings]').tap();
    assert.equal(await page.locator('#journey-start-date').inputValue(), '2026-10-08');
    await page.locator('#journey-start-date').fill('2026-10-09'); await page.locator('#settings-form button').tap();
    assert.equal((await saved(page)).journeyStartDate, '2026-10-09'); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 47');
    await page.locator('[data-view=settings]').tap();
    await page.locator('#journey-start-date').fill('2026-10-08'); await page.locator('#settings-form button').tap(); await page.locator('[data-view=today]').tap();
    // Calendar dates stay Darwin-based even with a New York browser timezone.
    for (const [instant, day] of [['2026-11-24T14:29:59Z', 'Day 48'], ['2026-11-24T14:30:00Z', 'Day 49']]) { await page.clock.setFixedTime(new Date(instant)); await page.reload(); assert.equal(await page.locator('#journey-day').innerText(), day); }
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();

    // Nothing to expand: every choice is on screen.
    assert.equal(await page.locator('#today details,#today summary,#training details,#training summary').count(), 0);
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 12); assert.equal(await page.locator('#next-up [data-slot=L]').count(), 3);
    await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
    const oneTap = async (locator, check) => { await page.evaluate(() => window.qaTaps = 0); await tap(locator); assert.equal(await page.evaluate(() => window.qaTaps), 1); await check(); };
    const order = () => page.locator('#daily-checklist [data-meal-slot]').evaluateAll(n => n.map(e => e.dataset.mealSlot).join(''));
    await oneTap(page.locator('[data-slot=L][data-tier=S]'), async () => assert.equal((await saved(page)).questsV5[key].picks.L, 'S'));
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'P'); assert.equal(await order(), 'PDEL', 'what is left leads; the logged slot folds to the end');
    assert.equal(await page.locator('[data-meal-slot=L]').getAttribute('class').then(c => c.includes('is-logged')), true);
    await oneTap(page.locator('[data-water]').first(), async () => assert.equal((await saved(page)).questsV5[key].water, .5));
    await tap(page.locator('#undo-toast button')); assert.equal((await saved(page)).questsV5[key].water, undefined);
    await oneTap(page.locator('[data-quest=electrolyte]'), async () => assert.equal((await saved(page)).questsV5[key].electrolyte, true));
    await tap(page.locator('[data-quest=electrolyte]')); assert.equal((await saved(page)).questsV5[key].electrolyte, false);
    await tap(page.locator('[data-view=training]')); assert.equal(await page.locator('.training-level').first().getAttribute('data-day'), key);
    await oneTap(page.locator('.is-today .exercise-toggle').first(), async () => assert.equal((await saved(page)).questsV5[key].exercises[0], true));
    await tap(page.locator('.is-today .exercise-toggle').first()); assert.equal((await saved(page)).questsV5[key].exercises[0], false);
    await tap(page.locator('.training-level[data-day="2026-11-23"] .exercise-toggle').first());
    assert.equal((await saved(page)).questsV5['2026-11-23'].exercises[0], true); assert.equal((await saved(page)).questsV5[key].exercises[0], false);
    // Tier replacement, tap-again and toast undo.
    await tap(page.locator('[data-view=today]')); await tap(page.locator('[data-slot=L][data-tier=M]'));
    assert.equal((await saved(page)).entries.filter(e => e.day === key && e.planSlot === 'L').length, 1);
    await tap(page.locator('#undo-toast button')); assert.equal((await saved(page)).questsV5[key].picks.L, 'S');
    await tap(page.locator('[data-slot=L][data-tier=S]')); assert.equal((await saved(page)).questsV5[key].picks.L, undefined);
    await tap(page.locator('#undo-toast button')); assert.equal((await saved(page)).questsV5[key].picks.L, 'S');
    for (let i = 0; i < 9; i++) await tap(page.locator('[data-water]').first());
    assert.equal((await saved(page)).questsV5[key].water, 4.5); assert.equal(await page.locator('.water-row').getAttribute('class').then(c => c.includes('is-full')), true);
    await tap(page.locator('[data-water]').last()); assert.equal((await saved(page)).questsV5[key].water, 4);
    await tap(page.locator('#undo-toast button')); assert.equal((await saved(page)).questsV5[key].water, 4.5);
    // Info sheet and long press never log; the sheet can log in one more tap.
    await tap(page.locator('[data-meal-slot=L] .meal-info').first()); assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.ok(await page.locator('#detail-content li').count());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#detail-sheet').isVisible(), false);
    const meal = page.locator('[data-slot=P][data-tier=S]'); await meal.scrollIntoViewIfNeeded(); const box = await meal.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
    assert.equal(await page.locator('#detail-sheet').isVisible(), true); assert.equal((await saved(page)).questsV5[key].picks.P, undefined);
    await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log strict pre-gym' }));
    assert.equal(await page.locator('#detail-sheet').isVisible(), false); assert.equal((await saved(page)).questsV5[key].picks.P, 'S');
    await tap(page.locator('#undo-toast button')); assert.equal((await saved(page)).questsV5[key].picks.P, undefined);
    await tap(page.locator('#today-scan')); await page.mouse.click(196, 40); assert.equal(await page.locator('#add-sheet').isVisible(), false, 'tapping outside closes a sheet');
    // Past days are editable, including Quick add.
    await tap(page.locator('#previous-day')); assert.equal(await text('date-label'), '23 Nov');
    await tap(page.locator('[data-slot=D][data-tier=M]')); assert.equal((await saved(page)).questsV5['2026-11-23'].picks.D, 'M');
    await tap(page.locator('[data-water]').first()); assert.equal((await saved(page)).questsV5['2026-11-23'].water, 1);
    await tap(page.locator('[data-quest=sleep]')); assert.equal((await saved(page)).questsV5['2026-11-23'].sleep, true);
    await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=manual]')); await page.locator('#food-name').fill('Synthetic quick meal'); await page.locator('#calories').fill('123'); await tap(page.locator('#add-form button'));
    assert.equal((await saved(page)).entries.at(-1).day, '2026-11-23');

    // Real protocol touch swipes: horizontal changes the day (even when it starts on a meal card), vertical scrolls.
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
    await tap(page.locator('#previous-day')); await tap(page.locator('#return-today')); assert.equal(await page.locator('#return-today').isVisible(), false);
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
    await page.locator('#training-week [data-day="2026-11-24"]').tap(); await tap(page.locator('[data-view=today]'));

    const got = await saved(page);
    assert.equal(got.entries[0].extra, 'keep'); assert.equal(got.questsV5['2026-11-23'].extension, 'keep'); assert.deepEqual(got.customExtension, { keep: true }); assert.equal(got.schemaVersion, 5);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-fixture')), 'preserve');
    await page.evaluate(() => dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' }))); assert.equal(await page.locator('#add-form').count(), 1);
    for (const [time, slot] of [['15:00:00', 'P'], ['19:00:00', 'D'], ['22:00:00', 'E']]) { await page.clock.setFixedTime(new Date('2026-11-24T' + time + '+09:30')); await page.reload(); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), slot); }

    // The + sheet: four ways in, and a way out when the food service is down.
    await tap(page.locator('#today-scan')); assert.deepEqual(await page.locator('[data-add]').evaluateAll(bs => bs.map(b => b.dataset.add)), ['camera', 'barcode', 'search', 'manual']);
    await tap(page.locator('[data-add=camera]')); await tap(page.locator('#scan-settings')); assert.equal(await page.locator('#ai-key').isVisible(), true);
    const requests = []; await page.route('https://*.openfoodfacts.org/**', route => { requests.push(new URL(route.request().url()).host); return route.abort('failed'); });
    await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=search]')); await page.locator('#food-search').fill('yopro'); await tap(page.locator('#search-form button'));
    await page.locator('#food-state').waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.locator('#food-state').innerText(), /unavailable right now/); assert.match(await page.locator('#food-state').innerText(), /Quick add/);
    assert.deepEqual(requests, ['au.openfoodfacts.org', 'world.openfoodfacts.org', 'au.openfoodfacts.org', 'world.openfoodfacts.org', 'world.openfoodfacts.org', 'search.openfoodfacts.org', 'au.openfoodfacts.org'], 'retry with backoff, then the last-resort endpoints');
    assert.equal(await page.locator('#food-state').getByRole('button', { name: 'Try again' }).count(), 1);
    await tap(page.locator('#scan-manual')); assert.equal(await page.locator('#manual-sheet').isVisible(), true); assert.equal(await page.locator('#food-name').inputValue(), 'yopro'); await page.keyboard.press('Escape');
    await tap(page.locator('[data-view=today]'));

    // An undo must not replace newer fields or entries written by another tab.
    const beforeWater = (await saved(page)).questsV5[key].water; await tap(page.locator('[data-water]').first());
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.customExtension.newer = true; s.entries.push({ ...s.entries[0], id: 'other-tab' }); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); dispatchEvent(new StorageEvent('storage', { key: 'rec-calories-v1' })); });
    await tap(page.locator('#undo-toast button'));
    assert.equal((await saved(page)).questsV5[key].water, beforeWater); assert.equal((await saved(page)).customExtension.newer, true); assert.ok((await saved(page)).entries.some(e => e.id === 'other-tab'));
    // Failed storage leaves journal and pressed state unchanged, with an honest error.
    const beforeFailure = await saved(page); await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); }; });
    await tap(page.locator('[data-quest=cardio]')); assert.deepEqual(await saved(page), beforeFailure); assert.match(await page.locator('#message').innerText(), /Could not save/);
    assert.equal(await page.locator('[data-quest=cardio]').getAttribute('aria-pressed'), 'false'); await page.evaluate(() => Storage.prototype.setItem = window.qaSetItem);
    const keyboardMeal = page.locator('[data-slot=L][data-tier=S]'); await keyboardMeal.focus(); await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => document.activeElement.dataset.slot), 'L');
    // Browsing a future phase shows its goals without rewriting the saved ones.
    const targetBefore = (await saved(page)).target; await page.evaluate(() => CHADUX.navigate(20)); assert.equal(await page.locator('#target-label').innerText(), '3,000'); assert.equal((await saved(page)).target, targetBefore); await tap(page.locator('#return-today'));
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller); await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#today .meal-pick:visible').count(), 12); assert.deepEqual(errors, []);
    console.log('PASS v8 UX: meal=1 tap, bottle=1 tap, quest=1 tap, exercise=1 tap; Day 48 title, relative day labels, week strip jump; pending-first slot order; direct/toast undo, full water row, tier replacement, info/long press without logging, log from the sheet, tap-outside close; date arrows/real touch swipes incl. from a card and on Training; past editing incl. quick add; v7 data preserved; cross-tab; Darwin slots; four Add actions; 7-request food recovery with Quick add hand-off; failed storage; offline; zero unexpected console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
