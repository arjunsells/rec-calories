// Feature regression across every tab in v12. All journals and measurements here are synthetic and live in a temporary
// browser profile: a perfect day's totals and the "over" words on the hero and the macro cards (a tap shows what was
// eaten; the meals in Recently eaten); the Gym tab (today's session, last sets, the exercise sheet, Mark done, another
// day, the week, the plan); Progress (streaks, workouts, records: the six most recent then Show all; the Calories chart
// with 7/30 days and the daily macro averages, then Protein and Water, and Weight once there is a weigh-in; per-day
// values, repaint on theme change; no level, score, badge or past entries); older journals (kept once, untouched, as a
// backup); phases with their goals and Quick log add-ons; a deload week; the theme; Gym mode without overflow; the
// offline shell.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, shellFiles, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v12-regression');

(async () => {
  const server = await serve(8088), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' }), page = await context.newPage();
    const errors = watch(page);
    await page.clock.install({ time: new Date(NOON) });
    const chartPixels = () => page.evaluate(() => [...document.querySelectorAll('#history canvas')].map(c => { const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let hash = 0; for (let i = 0; i < bytes.length; i++) hash = (hash * 31 + bytes[i]) | 0; return hash; }));
    const go = async () => { await page.goto('http://127.0.0.1:8088/'); await page.waitForFunction(() => window.CHADQuest && document.getElementById('now').dataset.now); await page.evaluate(() => document.fonts.ready); };
    const later = async open => { if ((await page.locator('#later-toggle').getAttribute('aria-expanded') === 'true') !== open) { await page.waitForTimeout(420); await page.locator('#later-toggle').click(); } };
    const pick = async (slot, tier) => { await page.waitForTimeout(420); if (!await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).count()) await later(true); await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).click(); };
    const tab = view => page.locator(`[data-view=${view}]`).click();
    const settings = async () => { await tab('today'); await page.locator('#open-settings').click(); };
    const theme = value => page.locator(`#theme-mode [data-theme-option=${value}]`).click();
    // The hero and the three macro cards: number and word each (textContent: the labels are styled in CSS).
    const words = () => page.evaluate(() => ['remaining', 'remaining-label', 'protein-left', 'protein-left-label', 'carbs-left', 'carbs-left-label', 'fat-left', 'fat-left-label'].map(id => document.getElementById(id).textContent));
    const cards = scope => page.locator(scope + ' .chart-card h2').allTextContents();
    const records = () => page.locator('#records [data-record]').evaluateAll(n => n.map(e => e.dataset.record));
    await go();
    assert.deepEqual((await page.locator('nav .ch-tab__label').allTextContents()).map(s => s.trim()), ['Today', 'Gym', 'Progress']);
    fs.mkdirSync(shots, { recursive: true });

    // A perfect day: three Strict meals (lunch, dinner, the snack): 1,908 kcal, 225 g protein, 140 g carbs, 49 g fat.
    for (const slot of ['L', 'D', 'P']) await pick(slot, 'S');
    assert.deepEqual(await words(), ['8', 'Calories over', '5', 'Protein over', '11', 'Carbs left', '4', 'Fat over'], 'a typical Strict day lands within 1% of the goal: 8 kcal and 5 g protein over, carbs left, fat over');
    assert.equal(await page.locator('#carbs-card').getAttribute('aria-label'), 'Carbs: 140 of 150 g eaten, 11 g left'); assert.equal(await page.locator('#fat-card').getAttribute('aria-label'), 'Fat: 49 of 45 g eaten, 4 g over');
    assert.deepEqual(await page.evaluate(() => ['calorie-left', 'protein-card', 'carbs-card', 'fat-card'].map(id => document.getElementById(id).classList.contains('is-over'))), [true, true, false, true], 'over is marked on the hero, protein and fat');
    // A tap on the hero shows what was eaten (v12: replaces v11's details with their totals and the carbs and fat meters).
    await page.locator('#left-line').click();
    assert.deepEqual(await words(), ['1,908', 'Calories eaten', '225', 'Protein eaten', '140', 'Carbs eaten', '49', 'Fat eaten']); assert.equal(await page.locator('#phase-line').textContent(), 'of 1,900 kcal');
    assert.deepEqual(await page.locator('#recent12 .ch-food[data-entry] .ch-food__name').allTextContents(), ['YoPRO × 2', 'Roast chook & spuds', "Nando's ½ PERi chicken"], 'the three meals in Recently eaten, newest first');
    await page.locator('#left-line').click(); assert.equal(await page.locator('#remaining-label').textContent(), 'Calories over');
    assert.equal((await saved(page)).entries.length, 3);
    // Switch a tier without duplicating; tap the logged option again to remove it.
    await later(true); await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 3); assert.equal((await saved(page)).questsV5['2026-11-24'].picks.L, 'M');
    await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 2); await later(false);
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L', 'an unlogged lunch is the thing to do again at noon');
    await pick('L', 'S');
    // Settings: weigh-in and water for the day, with Undo.
    await settings(); await page.locator('#local-weight').fill('80'); await page.locator('#local-weight').dispatchEvent('change'); assert.equal((await saved(page)).questsV5['2026-11-24'].weight, 80);   // synthetic
    await page.locator('#water-amount').fill('4.2'); await page.locator('#water-amount').dispatchEvent('change'); assert.equal((await saved(page)).questsV5['2026-11-24'].water, 4.2);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].water, undefined);
    await page.locator('#close-settings').click();

    // Gym: Tuesday's Pull, its seven exercises and their last sets; the exercise sheet; Mark done; other days; the plan.
    // (#training scopes .is-today: v12's week strip on Today marks today with .is-today too.)
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.questsV5['2026-11-17'] = { topSets: { 'Pull-ups': { kg: 10, reps: 8 } } }; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); });
    await page.reload(); await tab('training');
    assert.match(await page.locator('#training .is-today').innerText(), /Pull/); assert.equal(await page.locator('#training .is-today .exercise-row').count(), 7);
    assert.equal(await page.locator('#training .is-today .exercise-row').first().locator('.ch-ex__set').innerText(), '10×8', 'the last top set shows on its row');
    await page.locator('#training .is-today .exercise-row').first().click(); assert.match(await page.locator('#detail-sheet').innerText(), /Last 10 kg × 8 → try 9 reps, then 12\.5 kg[\s\S]*Best set[\s\S]*10 kg × 8/); await page.keyboard.press('Escape');
    await page.waitForTimeout(420); await page.locator('#training .is-today [data-quest=training]').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].training, true, 'Mark done');
    await page.waitForTimeout(420); await page.locator('#training .is-today [data-quest=training]').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].training, false);
    assert.equal(await page.locator('#training .is-today [data-gym-start]').count(), 1);
    await page.locator('.training-row[data-day="2026-11-25"]').click(); assert.match(await page.locator('.training-level').innerText(), /Muay Thai[\s\S]*10 min warm-up[\s\S]*6:30 pm[\s\S]*10 min stretch/);
    assert.equal(await page.locator('.training-level .exercise-row, .training-level [data-gym-start], .training-level [data-quest]').count(), 0, 'a day still to come has nothing to tap but its plan');
    await page.locator('#training-today').click();
    await page.locator('.training-row[data-day="2026-11-23"]').click();
    const session = page.locator('.training-level [data-quest=training]');
    assert.match((await session.innerText()).trim(), /Mark done/); await session.click(); assert.equal((await saved(page)).questsV5['2026-11-23'].training, true); assert.match((await session.innerText()).trim(), /Push done/);
    await page.waitForTimeout(420); await session.click(); assert.equal((await saved(page)).questsV5['2026-11-23'].training, false);
    await page.locator('#training-today').click();
    assert.match(await page.locator('.week-rows').innerText(), /Mon[\s\S]*Push/i); assert.equal(await page.locator('.training-row').count(), 6);
    await page.locator('.ch-plan > summary').click();
    assert.match(await page.locator('.ch-plan').innerText(), /4–6 pm Darwin[\s\S]*Side delts, upper chest, lats, traps[\s\S]*2 reps before failure[\s\S]*28 Dec–3 Jan[\s\S]*Perfect Week v2 review/);

    // An older journal (v4 shape) keeps everything, and v12 keeps the journal it found once, untouched, as a backup;
    // streaks and Progress from a month of synthetic history.
    const legacy = await page.evaluate(() => {
      const s = { target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Synthetic legacy meal', kcal: 400, protein: 20, extra: 'preserve', thumbnail: 'data:image/png;base64,c3ludGhldGlj' }] };
      const raw = JSON.stringify(s); localStorage.setItem('rec-calories-v1', raw); localStorage.setItem('unrelated-synthetic', 'keep'); return raw;
    });
    await page.reload();
    let migrated = await saved(page);
    assert.equal(migrated.schemaVersion, 5); assert.equal(migrated.appVersion, 12); assert.equal(migrated.entries[0].extra, 'preserve'); assert.equal(migrated.entries[0].thumbnail, 'data:image/png;base64,c3ludGhldGlj');
    assert.equal(migrated.legacyGoals.target, 2100); assert.ok(migrated.legacyRewards.xp > 0, 'a v4 journal keeps its XP (stored, never shown)'); assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-synthetic')), 'keep');
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-v11-backup')), legacy, 'the journal v12 found first is kept as it was');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rec-calories-v1')), q = CHADQuest;
      for (let n = 0; n < 30; n++) { const k = q.shift('2026-11-24', -n); s.questsV5 = s.questsV5 || {}; s.questsV5[k] = { picks: { L: 'S', D: 'S', P: 'S' }, water: q.waterGoal(k), steps: true }; CHADPlan.forEach(slot => { const c = slot.choices[0]; s.entries.push({ id: 'plan-' + k + '-' + slot.id, day: k, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); }); }
      const w = (k, kg) => ({ id: 'pull', start: Date.parse(k + 'T16:00:00+09:30'), end: Date.parse(k + 'T16:55:00+09:30'), sets: [{ x: 'Chest-supported row', kg, reps: 10, at: 1 }, { x: 'Pull-ups', kg: 0, reps: 9, at: 2 }] });
      s.questsV5['2026-11-10'].workout = w('2026-11-10', 50); s.questsV5['2026-11-10'].training = true; s.questsV5['2026-11-17'].workout = w('2026-11-17', 52.5); s.questsV5['2026-11-17'].training = true;
      // The rest of that Pull session the week before: seven records in all, so Progress shows six and Show all.
      s.questsV5['2026-11-10'].workout.sets.push({ x: 'Single-arm pulldown', kg: 30, reps: 12, at: 3 }, { x: 'Rear delt fly', kg: 8, reps: 15, at: 4 }, { x: 'DB shrugs', kg: 32.5, reps: 12, at: 5 }, { x: 'Incline DB curl', kg: 12.5, reps: 10, at: 6 }, { x: 'Hanging leg raise', kg: 0, reps: 12, at: 7 });
      localStorage.setItem('rec-calories-v1', JSON.stringify(s));
    });
    await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '48 day streak');
    await tab('history');
    assert.equal(await page.locator('#streak-count').innerText(), '48'); assert.match(await page.locator('#streak').innerText(), /since 8 Oct/i);
    assert.equal(await page.locator('#water-streak').innerText(), '30'); assert.match(await page.locator('#water-streak-s').innerText(), /best 30 days/i);
    assert.equal(await page.locator('#workouts .workout-row').count(), 2); assert.match(await page.locator('#workouts .workout-row').first().innerText(), /Tue 17 Nov[\s\S]*Pull[\s\S]*525 kg · 55 min/);
    assert.match(await page.locator('#workouts .workout-row').first().innerText(), /PR/, 'last week beat the week before');
    assert.match(await page.locator('#records [data-record="Chest-supported row"]').innerText(), /52\.5 kg × 10[\s\S]*e1RM 70/);
    // Records (v12): the six most recent, then Show all; the toggle goes both ways.
    assert.deepEqual(await records(), ['Pull-ups', 'Chest-supported row', 'Single-arm pulldown', 'Rear delt fly', 'DB shrugs', 'Incline DB curl'], 'the six most recent records');
    assert.equal(await page.locator('#records-toggle').textContent(), 'Show all 7'); assert.equal(await page.locator('#records-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('#records-toggle').click(); assert.equal((await records()).length, 7); assert.match(await page.locator('#records [data-record="Hanging leg raise"]').innerText(), /12 reps[\s\S]*bodyweight/);
    assert.equal(await page.locator('#records-toggle').textContent(), 'Show fewer'); assert.equal(await page.locator('#records-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#records-toggle').click(); assert.equal((await records()).length, 6);
    // Charts (v12): the range control, Calories and the daily macro averages first; Protein and Water after the records
    // (Weight only once there is a weigh-in). v11 showed four charts together.
    assert.deepEqual(await cards('#charts'), ['Calories']); assert.deepEqual(await cards('#charts-more'), ['Protein', 'Water'], 'no Weight chart without weigh-ins');
    assert.equal(await page.locator('#history .chart-card').count(), 3); assert.equal(await page.locator('#history canvas').count(), 3, 'calories, protein, water');
    assert.equal(await page.locator('#charts > .chart-controls:first-child + .chart-card + #macro-averages12').count(), 1, 'the range control, Calories, then the daily averages');
    assert.match(await page.locator('#macro-averages12').innerText(), /Daily average[\s\S]*7 days logged[\s\S]*225 g[\s\S]*Protein · goal 220[\s\S]*140 g[\s\S]*Carbs · goal 150[\s\S]*49 g[\s\S]*Fat · goal 45[\s\S]*1,908 kcal a day · goal 1,900/i);
    assert.deepEqual(await page.locator('#macro-averages12 [role=img]').evaluateAll(n => n.map(e => e.getAttribute('aria-label'))), ['Protein: 225 g a day on average, goal 220 g', 'Carbs: 140 g a day on average, goal 150 g', 'Fat: 49 g a day on average, goal 45 g']);
    assert.equal(await page.locator('.chart-card').filter({ hasText: 'Calories' }).locator('.chart-values .ch-hint').count(), 7);
    await page.locator('.chart-controls button', { hasText: '30 days' }).click();
    assert.equal(await page.locator('.chart-card').filter({ hasText: 'Calories' }).locator('.chart-values .ch-hint').count(), 30);
    assert.equal(await page.locator('.chart-card').filter({ hasText: 'Protein' }).locator('.chart-values .ch-hint').count(), 30, 'the range covers the charts below the records too');
    assert.match(await page.locator('#macro-averages12').innerText(), /30 days logged/i);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#history canvas')].every(c => c.width > 80 && c.height > 50)), true);
    for (const gone of ['#level-disc', '#xp-total', '#weekly-progress', '#past-entries', '#open-level', '#level-up', '.ch-grade', '#badges', '[data-badge]', '.streak-chart']) assert.equal(await page.locator(gone).count(), 0, gone + ' is gone');
    assert.doesNotMatch(await page.locator('#history').innerText(), /\bXP\b|level|badge|score|\/17|rank/i, 'no points clutter in Progress');
    // A weigh-in (Settings › Selected day) brings the Weight chart: a 7-day average.
    await settings(); await page.locator('#local-weight').fill('80.4'); await page.locator('#local-weight').dispatchEvent('change'); assert.equal((await saved(page)).questsV5['2026-11-24'].weight, 80.4);   // synthetic
    await page.locator('#close-settings').click(); await tab('history');
    assert.deepEqual(await cards('#charts-more'), ['Protein', 'Water', 'Weight']); assert.equal(await page.locator('#history canvas').count(), 4, 'calories, protein, water, weight');
    assert.match(await page.locator('.chart-card').filter({ hasText: 'Weight' }).innerText(), /7-day average, kg/); assert.equal(await page.locator('.chart-card').filter({ hasText: 'Weight' }).locator('.chart-values .ch-hint').last().textContent(), '2026-11-24: 80.4');
    const darkPixels = await chartPixels();
    await settings(); await theme('light'); await tab('history'); await page.waitForTimeout(150);
    assert.notDeepEqual(await chartPixels(), darkPixels, 'charts repaint for the light theme');
    await settings(); await theme('dark'); await tab('history'); await page.waitForTimeout(150);
    assert.deepEqual(await chartPixels(), darkPixels, 'charts repaint after the tab and theme come back');
    const waterGoals = await page.locator('.chart-card').filter({ hasText: 'Water' }).locator('.chart-values .ch-hint').allTextContents();
    assert.ok(waterGoals.some(v => v.endsWith('/ 3.5'))); assert.ok(waterGoals.some(v => v.endsWith('/ 5')), 'Sunday 3.5 L, Saturday 5 L');
    await page.screenshot({ path: path.join(shots, 'progress-dark.png') });

    // Phases: Reset and Bulk change the goals on the hero and the macro cards and bring their add-ons to Quick log; one
    // tap each. (v11 showed the goal in the line's details, #target-label; v12 shows it on the hero when eaten is shown.)
    for (const [date, hint, goal] of [['2026-12-01T12:00:00+09:30', 'Cut · 5d left', ['1,900', '220', '150', '45']], ['2026-12-08T12:00:00+09:30', 'Reset · 5d left', ['2,700', '200', '320', '70']], ['2026-12-14T12:00:00+09:30', 'Bulk · 139d left', ['3,000', '200', '370', '80']]]) {
      const phase = hint.split(' ')[0];
      await page.clock.setFixedTime(new Date(date)); await page.reload(); await tab('today');
      assert.deepEqual(await page.evaluate(() => ['remaining', 'protein-left', 'carbs-left', 'fat-left', 'phase-line'].map(id => document.getElementById(id).textContent)), [...goal, hint], phase + ' goals, all left (nothing eaten yet)');
      await page.locator('#left-line').click(); assert.equal(await page.locator('#phase-line').textContent(), 'of ' + goal[0] + ' kcal', phase + ' goal'); await page.locator('#left-line').click();
      assert.equal(await page.locator('#quick [data-addon]').count(), phase === 'Bulk' ? 3 : phase === 'Reset' ? 2 : 0, phase + ' add-ons');
    }
    await page.locator('#quick [data-addon=shake]').click(); assert.equal((await saved(page)).entries.at(-1).source, 'addon'); assert.equal(await page.locator('#quick [data-addon=shake]').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(420); await page.locator('#quick [data-addon=shake]').click(); assert.equal((await saved(page)).entries.some(e => e.id === 'addon-2026-12-14-shake'), false, 'a second tap takes it off');
    // A deload week: the Gym tab says so, and 3 sets become 2.
    await page.clock.setFixedTime(new Date('2026-12-29T12:00:00+09:30')); await page.reload(); await tab('training');
    assert.equal(await page.locator('.deload').isVisible(), true); assert.match(await page.locator('#training .is-today .exercise-row').first().innerText(), /2 × 6–10/, 'deload: 3 sets become 2');
    // The theme: Light sticks across a reload; Auto follows the system.
    await settings(); await theme('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light'); assert.equal(await page.evaluate(() => localStorage.getItem('rec-calories-theme')), 'light');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await settings(); assert.equal(await page.locator('#theme-mode [aria-pressed=true]').innerText(), 'Light');
    await theme('system'); assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    // Gym mode: no overflow on this phone, top to finish.
    await page.clock.setFixedTime(new Date(NOON)); await page.reload(); await tab('training');
    await page.locator('#training .is-today [data-gym-start]').click(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#gym-go').click(); await page.locator('[data-gym=skip]').click(); await page.locator('[data-gym=finish]').click(); assert.equal(await page.locator('#gym-done').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.locator('[data-gym=done]').click();
    // The offline shell: every file, the page and the data.
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(cache => caches.has(cache), CACHE), true);
    await context.setOffline(true); await page.reload();
    assert.equal(await page.locator('#journey-day').innerText(), 'Day 48');
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    await context.setOffline(false);
    assert.deepEqual(errors, []);
    console.log('PASS v12 regression: three tabs; a perfect day 1,908 kcal / 225 / 140 / 49 g with "Calories over" 8 and "Protein over" 5, carbs 11 left and fat 4 over on the macro cards (over marked), a tap shows 1,908 / 225 / 140 / 49 eaten "of 1,900 kcal", the three meals in Recently eaten; switch / remove without duplicates; Settings weigh-in and water with Undo; Gym tab (Pull and its last sets, the exercise sheet with the hint and best set, Mark done on and off, a coming day shows only its plan, another day, the week, the plan disclosure); a v4 journal kept (goals, extension fields, XP stored not shown) and kept once untouched as rec-calories-v11-backup, appVersion 12; streak 48 and water 30 (best 30 days); workouts with volume, minutes and PR; records with e1RM, the six most recent then Show all 7 / Show fewer; the range control, Calories and the daily macro averages (7 and 30 days logged), then Protein and Water, Weight once there is a weigh-in; 7/30 days and per-day values, repainting with the theme; no level, XP, score, badge or past entries; Cut/Reset/Bulk goals on the hero and macro cards and their add-ons in Quick log (on and off); a deload week; Light/Auto theme; Gym mode without overflow; the offline shell.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
