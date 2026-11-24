// Feature regression across every tab. All journals and measurements here are synthetic and live in a temporary browser profile.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, shellFiles, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v10-regression');

(async () => {
  const server = await serve(8088), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' }), page = await context.newPage();
    const errors = watch(page);
    await page.clock.install({ time: new Date(NOON) });
    const chartPixels = () => page.evaluate(() => [...document.querySelectorAll('#charts canvas')].map(c => { const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let hash = 0; for (let i = 0; i < bytes.length; i++) hash = (hash * 31 + bytes[i]) | 0; return hash; }));
    const go = async () => { await page.goto('http://127.0.0.1:8088/'); await page.waitForFunction(() => window.CHADQuest && document.querySelector('#daily-checklist .water-row')); await page.evaluate(() => document.fonts.ready); };
    // A meal option: on the meal on top it is right there; any other meal opens from its line first. Taps are paced
    // past the 300 ms in which a card ignores a second touch after the meals move.
    const pick = async (slot, tier) => {
      await page.waitForTimeout(320);
      if (!await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).count()) await page.locator(`[data-meal-row=${slot}]`).click();
      await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).click();
    };
    const wrap = async () => { if (!await page.locator('#today [data-quest=steps]').count()) { await page.waitForTimeout(420); await page.locator('[data-row=wrap]').click(); } };
    const score = () => page.locator('#quest-total').innerText().then(s => s + ' / 17');
    const tab = view => page.locator(`[data-view=${view}]`).click();
    const theme = value => page.locator(`#theme-mode [data-theme-option=${value}]`).click();
    await go();
    assert.deepEqual((await page.locator('nav .ch-tab__label').allTextContents()).map(s => s.trim()), ['Today', 'Training', 'Progress', 'Settings']);
    fs.mkdirSync(shots, { recursive: true });

    // A perfect day: three Strict meals (lunch, dinner, the snack), the session, water target, steps = 17 / 17, grade S.
    for (const slot of ['L', 'D', 'P']) await pick(slot, 'S');
    assert.equal(await page.locator('#consumed').innerText(), '1,908'); assert.equal(await page.locator('#protein-total').innerText(), '225');
    assert.match(await page.locator('#calorie-ring').getAttribute('aria-label'), /^1,908\.2 of 1,900 calories$/, 'exact totals stay in the labels');
    assert.match(await page.locator('#protein-ring').getAttribute('aria-label'), /^225 of 220 grams protein$/);
    assert.equal(await page.locator('#carbs-total').innerText(), '140'); assert.equal(await page.locator('#fat-total').innerText(), '49', 'carbs and fat in the hero');
    assert.match(await page.locator('#carbs-meter').getAttribute('aria-label'), /^139\.5 of 150 grams carbs$/);
    assert.equal(await page.locator('#remaining').innerText(), '8'); assert.equal(await page.locator('#remaining-label').innerText(), 'over', 'a typical Strict day lands within 1% of the goal');
    assert.equal(await score(), '11 / 17');
    assert.equal(await page.locator('#next-up').count(), 0, 'with every meal logged nothing needs to stay open');
    assert.equal(await page.locator('.meal-row.is-logged').count(), 3, 'logged meals are quiet lines');
    for (let i = 0; i < 9; i++) await page.locator('.water-row').click();
    await wrap(); await page.locator('#today [data-quest=steps]').click();
    assert.equal(await score(), '14 / 17', 'three meals, protein, water, steps: the session is the last 3');
    await tab('training'); await page.locator('.is-today [data-quest=training]').click(); await tab('today');
    assert.equal(await score(), '17 / 17'); assert.equal(await page.locator('#quest-grade').innerText(), 'S');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak', 'the journey streak');
    assert.equal(await page.locator('#week-strip .is-selected').getAttribute('class').then(c => c.includes('is-s')), true, 'an S day is gold in the week strip');
    assert.equal((await saved(page)).entries.length, 3);
    await page.reload(); assert.equal(await score(), '17 / 17');
    // Switch tier without duplicating; tap the logged option again to remove it.
    await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 3); assert.equal(await score(), '14 / 17', 'the Medium go-to has 71 g protein: under 210 g for the day');
    await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 2); assert.equal(await score(), '12 / 17', 'no lunch: no protein points either');
    await page.locator('[data-meal-toggle=L]').click();
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L', 'an unlogged lunch leads again at noon');
    await pick('L', 'S');
    // Going over target says so; other food is listed once.
    await page.evaluate(() => CHADUX.openFood('manual')); await page.locator('#food-name').fill('Synthetic extra'); await page.locator('#calories').fill('300'); await page.locator('#add-form button').click();
    assert.equal(await page.locator('#remaining-label').innerText(), 'over'); assert.equal(await page.locator('#remaining').innerText(), '308');
    assert.equal(await page.locator('#extras').isVisible(), true); assert.equal(await page.locator('#entries .entry').count(), 1, 'plan meals live in their lines; other food is listed below');
    await page.locator('#undo-toast button').click(); assert.equal(await page.locator('#extras').isVisible(), false);
    await wrap(); for (const field of ['electrolyte', 'cardio', 'sleep']) { await page.waitForTimeout(420); await page.locator(`#today [data-quest=${field}]`).click(); }
    assert.equal(await page.locator('#today [data-quest][aria-pressed=true]').count(), 4);

    await tab('settings');
    await page.locator('#local-weight').fill('80'); await page.locator('#local-weight').dispatchEvent('change');
    assert.equal((await saved(page)).questsV5['2026-11-24'].weight, 80);
    await page.locator('#water-amount').fill('4.2'); await page.locator('#water-amount').dispatchEvent('change');
    assert.equal((await saved(page)).questsV5['2026-11-24'].water, 4.2);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].water, 4.5);

    // Training: today's session with its moves, rest and last set; Start; Mark done for a past day; the week as rows.
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.questsV5['2026-11-17'] = { topSets: { 'Pull-ups': { kg: 10, reps: 8 } } }; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); });
    await page.reload(); await tab('training');
    assert.match(await page.locator('.is-today').innerText(), /Pull/); assert.equal(await page.locator('.is-today .exercise-row').count(), 7);
    assert.equal(await page.locator('.is-today .exercise-row').first().locator('.ch-ex__set').innerText(), '10×8', 'the last top set shows on its row');
    await page.locator('.is-today .exercise-row').first().click(); assert.match(await page.locator('#detail-sheet').innerText(), /Last 10 kg × 8 → try 9 reps, then 12\.5 kg[\s\S]*Best set[\s\S]*10 kg × 8/); await page.keyboard.press('Escape');
    // The session was marked done above (the last 3 of 17): Mark done again switches it off, and Start comes back.
    await page.locator('.is-today [data-quest=training]').click(); await page.waitForTimeout(420); assert.equal((await saved(page)).questsV5['2026-11-24'].training, false);
    assert.equal(await page.locator('.is-today [data-gym-start]').count(), 1);
    await page.locator('.training-row[data-day="2026-11-25"]').click(); assert.match(await page.locator('.training-level').innerText(), /Muay Thai[\s\S]*10 min warm-up[\s\S]*6:30 pm[\s\S]*10 min stretch/);
    assert.equal(await page.locator('.training-level .exercise-row, .training-level [data-gym-start], .training-level [data-quest]').count(), 0, 'a day still to come has nothing to tap but its plan');
    await page.locator('.training-row[data-day="2026-11-23"]').click();
    const session = page.locator('.training-level [data-quest=training]');
    assert.equal((await session.innerText()).trim(), 'Mark done'); await session.click();
    assert.equal((await saved(page)).questsV5['2026-11-23'].training, true); assert.match((await session.innerText()).trim(), /Push done/);
    assert.equal(await page.locator('#training-week .is-selected').getAttribute('class').then(c => c.includes('is-s')), true, 'a done session is gold in the week strip');
    await page.waitForTimeout(420); await session.click(); assert.equal((await saved(page)).questsV5['2026-11-23'].training, false);
    await page.locator('#training-today').click();
    assert.match(await page.locator('.week-rows').innerText(), /Mon[\s\S]*Push/i); assert.equal(await page.locator('.training-row').count(), 6);
    assert.match(await page.locator('.ch-plan').innerText(), /4–6 pm Darwin[\s\S]*Side delts, upper chest, lats, traps[\s\S]*2 reps before failure[\s\S]*28 Dec–3 Jan[\s\S]*Perfect Week v2 review on Sun 20 Dec/);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(shots, 'training.png') });

    // Saved v4 data, photos, extension fields, goals, and earned rewards survive the migration.
    await page.evaluate(() => { localStorage.setItem('rec-calories-v1', JSON.stringify({ schemaVersion: 4, target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, custom: 'preserve', entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Synthetic historic meal', kcal: 2000, protein: 200, thumbnail: 'data:image/png;base64,c3ludGhldGlj', extra: 'preserve' }] })); localStorage.setItem('unrelated-synthetic', 'keep'); });
    await page.reload();
    const migrated = await saved(page);
    assert.equal(migrated.schemaVersion, 5); assert.equal(migrated.entries[0].extra, 'preserve'); assert.equal(migrated.entries[0].thumbnail, 'data:image/png;base64,c3ludGhldGlj');
    assert.equal(migrated.legacyGoals.target, 2100); assert.ok(migrated.legacyRewards.xp > 0); assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-synthetic')), 'keep');

    // Synthetic history: 30 logged days (and two workouts) for the streaks, charts, workouts, records and calendar.
    await page.evaluate(() => { const q = CHADQuest, state = { schemaVersion: 5, target: 1900, proteinGoal: 220, entries: [], questsV5: {} }; for (let n = 0; n < 30; n++) { const key = q.shift('2026-11-24', -n); state.entries.push({ id: 'synthetic-' + n, day: key, name: 'Synthetic test day', kcal: 1750 + n * 7, protein: 220, carbs: 150, fat: 45 }); state.questsV5[key] = { picks: { B: 'S', L: 'S', P: 'S', D: 'S' }, water: q.waterGoal(key), steps: true, weight: 80 + n * .05 }; }
      const w = (key, kg) => ({ id: 'pull', start: Date.parse(key + 'T16:00:00+09:30'), end: Date.parse(key + 'T16:55:00+09:30'), sets: [{ x: 'Chest-supported row', kg, reps: 10, at: Date.parse(key + 'T16:10:00+09:30') }, { x: 'Chest-supported row', kg, reps: 9, at: Date.parse(key + 'T16:14:00+09:30') }] });
      Object.assign(state.questsV5['2026-11-10'], { training: true, workout: w('2026-11-10', 50) }); Object.assign(state.questsV5['2026-11-17'], { training: true, workout: w('2026-11-17', 52.5) });
      localStorage.setItem('rec-calories-v1', JSON.stringify(state)); });
    await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak');
    assert.equal(await page.locator('#week-strip .is-s').count(), 2, 'Monday and today are S days this week');
    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+09:30')); await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '49 day streak');
    await page.clock.setFixedTime(new Date('2026-11-26T12:00:00+09:30')); await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '50 day streak', 'days without logs still count');
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();
    await tab('history');
    assert.equal(await page.locator('#streak-count').innerText(), '48'); assert.match(await page.locator('#streak').innerText(), /since 8 Oct/);
    assert.equal(await page.locator('#water-streak').innerText(), '30'); assert.match(await page.locator('#water-streak-s').innerText(), /days on goal[\s\S]*best 30/);
    assert.match(await page.locator('#weekly-progress').innerText(), /pts/);
    assert.equal(await page.locator('#workouts .workout-row').count(), 2); assert.match(await page.locator('#workouts .workout-row').first().innerText(), /Tue 17 Nov[\s\S]*Pull[\s\S]*998 kg · 55 min/);
    assert.match(await page.locator('#workouts .workout-row').first().innerText(), /PR/, 'last week beat the week before');
    assert.match(await page.locator('#records [data-record="Chest-supported row"]').innerText(), /52\.5 kg × 10[\s\S]*e1RM 70/);
    assert.equal(await page.locator('#charts canvas').count(), 9, 'three rings, five charts, heatmap');
    assert.equal(await page.locator('.streak-chart+details .ch-hint').count(), 91);
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    assert.equal(await page.locator('.chart-card').filter({ hasText: 'Calories' }).locator('.chart-values .ch-hint').count(), 30);
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(shots, 'progress-dark.png') });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#charts canvas')].every(c => c.width > 80 && c.height > 50)), true);
    assert.equal(await page.locator('#badges, #badge-count, .badge, [data-badge]').count(), 0, 'no badges'); assert.doesNotMatch(await page.locator('#history').innerText(), /badge/i);
    assert.ok(await page.locator('#past-entries .entry-open').count() >= 29, 'past entries open their sheet');
    await page.locator('#open-level').click(); assert.equal(await page.locator('#level-up').isVisible(), true);
    assert.equal(await page.locator('#level-list li').count(), 6); assert.equal(await page.locator('#level-list .is-current').count(), 1);
    assert.match(await page.locator('#new-level').innerText(), /^Level \d · /); await page.locator('#close-level').click();
    // Charts repaint for a manual theme and again when returning to the tab.
    const darkPixels = await chartPixels();
    await tab('settings'); await theme('light'); await tab('history');
    assert.notDeepEqual(await chartPixels(), darkPixels, 'charts repaint for manual light theme');
    await tab('settings'); await theme('dark'); await tab('history');
    assert.deepEqual(await chartPixels(), darkPixels, 'charts repaint after tab return and manual dark theme');
    const waterGoals = await page.locator('.chart-card').filter({ hasText: 'Water' }).locator('.chart-values .ch-hint').allTextContents();
    assert.ok(waterGoals.some(v => v.endsWith('/ 3.5'))); assert.ok(waterGoals.some(v => v.endsWith('/ 5')));

    // Phases follow the Darwin date; Reset and Bulk bring add-ons.
    for (const [date, phase, kcal] of [['2026-12-06', 'Cut', '1,900'], ['2026-12-07', 'Reset', '2,700'], ['2026-12-13', 'Reset', '2,700'], ['2026-12-14', 'Bulk', '3,000']]) {
      await page.clock.setFixedTime(new Date(date + 'T12:00:00+09:30')); await page.reload();
      assert.equal(await page.locator('#target-label').innerText(), kcal);
      if (phase !== 'Cut') { assert.ok(await page.getByRole('button', { name: /Daily shake ·/ }).count()); assert.equal(await page.locator('.addons .quest-chip').count(), phase === 'Bulk' ? 3 : 2); }
    }
    await page.getByRole('button', { name: /Daily shake ·/ }).click();
    assert.equal((await saved(page)).entries.at(-1).source, 'addon'); assert.equal(await page.getByRole('button', { name: /Daily shake ·/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#extras').isVisible(), false, 'an add-on shows as its pill, not twice');
    await page.waitForTimeout(420); await page.getByRole('button', { name: /Daily shake ·/ }).click();
    assert.equal((await saved(page)).entries.some(e => e.id === 'addon-2026-12-14-shake'), false);
    await page.clock.setFixedTime(new Date('2026-12-28T12:00:00+09:30')); await page.reload(); await tab('training');
    assert.equal(await page.locator('.deload').isVisible(), true); assert.match(await page.locator('.is-today .exercise-row').first().innerText(), /2 × 6–10/, 'deload: 3 sets become 2');

    // Appearance and schedule settings.
    await tab('settings'); await theme('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light'); assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-theme')), 'light');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await tab('settings');
    assert.equal(await page.locator('#theme-mode [aria-pressed=true]').innerText(), 'Light');
    await page.locator('#haptics-toggle').uncheck(); assert.equal((await saved(page)).haptics, false);
    await page.locator('#haptics-toggle').check(); assert.equal((await saved(page)).haptics, true);
    await page.locator('#sound-toggle').check(); assert.equal((await saved(page)).arcadeSound, true); await page.locator('#sound-toggle').uncheck();
    await page.locator('#phase-end-0').fill('2026-12-30'); await page.getByRole('button', { name: 'Save phase dates', exact: true }).click();
    assert.equal((await saved(page)).phaseEnds, undefined, 'out-of-order phase dates are refused');
    await page.locator('#phase-end-1').fill('2027-01-03'); await page.getByRole('button', { name: 'Save phase dates', exact: true }).click();
    assert.equal((await saved(page)).phaseEnds[0], '2026-12-30');
    await tab('today'); assert.equal(await page.locator('#target-label').innerText(), '1,900');
    assert.equal(await page.locator('#phase').evaluate(e => e.selectedOptions[0].textContent), 'Automatic');
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();

    for (const width of [320, 430, 680]) {
      await page.setViewportSize({ width, height: 932 });
      for (const view of ['today', 'training', 'history', 'settings']) { await tab(view); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow ' + width + ' ' + view); }
      await tab('today'); await page.evaluate(() => CHADGym.start(CHADQuest.dayKey())); assert.equal(await page.locator('#gym').isVisible(), true);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#gym *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), true, 'Gym mode fits at ' + width);
      await page.locator('[data-gym=close]').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const value of ['light', 'dark']) {
      await tab('settings'); await theme(value);
      assert.equal(await page.locator('meta[name=theme-color]').first().getAttribute('content'), value === 'dark' ? '#060A14' : '#EEF1F7');
      for (const view of ['today', 'training', 'history', 'settings']) {
        await tab(view); await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        assert.equal(await page.evaluate(() => document.querySelector('.view:not([hidden])').getBoundingClientRect().bottom < document.querySelector('.ch-dock-scrim').getBoundingClientRect().top), true, 'last row clears the dock and its fade ' + value + ' ' + view);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    }

    // Offline: the complete shell, the pixel font and the scanner.
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), true);
    await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#daily-checklist [data-meal-row], #daily-checklist [data-meal-slot]').count() >= 3, true, 'every meal is on screen offline');
    await page.evaluate(() => document.fonts.load('12px "Press Start 2P"')); assert.equal(await page.evaluate(() => document.fonts.check('12px "Press Start 2P"')), true);
    assert.equal(await page.evaluate(() => typeof CHADFood.startScanner), 'function'); assert.equal(await page.evaluate(() => typeof CHADGym.start), 'function');
    assert.deepEqual(await page.evaluate(async cache => (await (await caches.open(cache)).keys()).map(r => new URL(r.url).pathname).sort(), CACHE), shellFiles().map(f => new URL(f, 'http://127.0.0.1:8088/').pathname).sort());
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.deepEqual(errors, []);
    console.log('PASS regression Edge 390x844: 17 = S from three Strict meals (1,908 kcal, 225 g protein) and the session with whole-number hero and exact labels, logged meals as quiet lines, switch/remove/persist, other food listed once, over target; done chips; weigh-in and water edits; Training: moves with prescription, rest and last set, history sheet with the overload hint, Start, a future day read-only, Mark done (gold in the week), the plan card; v4 migration incl photos/goals/rewards; journey streak 48/49/50 whatever was logged, water streak 30, workouts with volume/duration/PR, records with est 1RM; nine canvases, heatmap, 7/30 range, badges, level details, manual theme pixel redraw, daily water goals; phases/add-ons/deload sets; theme hint, haptics/sound switches, phase dates; 320/430/680 no overflow incl. Gym mode; dock clearance both themes; offline complete shell, font, scanner, Gym mode; zero JS/console errors. Screenshots: ' + shots);
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
