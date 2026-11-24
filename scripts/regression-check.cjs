// Feature regression across every tab. All journals and measurements here are synthetic and live in a temporary browser profile.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, shellFiles, CACHE, NOON } = require('./harness.cjs');
const shots = process.env.CHAD_SHOTS || path.join(os.tmpdir(), 'chad-v9-regression');

(async () => {
  const server = await serve(8088), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' }), page = await context.newPage();
    const errors = watch(page);
    await page.clock.install({ time: new Date(NOON) });
    const chartPixels = () => page.evaluate(() => [...document.querySelectorAll('#charts canvas')].map(c => { const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let hash = 0; for (let i = 0; i < bytes.length; i++) hash = (hash * 31 + bytes[i]) | 0; return hash; }));
    const go = async () => { await page.goto('http://127.0.0.1:8088/'); await page.waitForFunction(() => window.CHADQuest && document.querySelector('#daily-checklist .ch-card')); await page.evaluate(() => document.fonts.ready); };
    // A meal option: on the top meal it is right there; any other meal opens from its row first. Taps are paced past
    // the 300 ms in which a card ignores a second touch after the meals move.
    const pick = async (slot, tier) => {
      await page.waitForTimeout(320);
      if (!await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).count()) await page.locator(`[data-meal-row=${slot}]`).click();
      await page.locator(`[data-slot=${slot}][data-tier=${tier}]`).click();
    };
    const score = () => page.locator('#quest-total').innerText().then(s => s + ' / 17');
    const tab = view => page.locator(`[data-view=${view}]`).click();
    const theme = value => page.locator(`#theme-mode [data-theme-option=${value}]`).click();
    await go();
    assert.deepEqual((await page.locator('nav .ch-tab__label').allTextContents()).map(s => s.trim()), ['Today', 'Training', 'Progress', 'Settings']);
    fs.mkdirSync(shots, { recursive: true });

    // A perfect day: four Strict meals, water target, steps = 17 / 17, grade S.
    for (const slot of ['L', 'P', 'D', 'E']) await pick(slot, 'S');
    assert.equal(await page.locator('#consumed').innerText(), '1,894'); assert.equal(await page.locator('#protein-total').innerText(), '220');
    assert.match(await page.locator('#calorie-ring').getAttribute('aria-label'), /^1,894\.1 of 1,900 calories$/, 'exact totals stay in the labels');
    assert.match(await page.locator('#protein-ring').getAttribute('aria-label'), /^219\.7 of 220 grams protein$/);
    assert.equal(await page.locator('#carbs-total').innerText(), '178'); assert.equal(await page.locator('#fat-total').innerText(), '38', 'carbs and fat in the hero');
    assert.match(await page.locator('#carbs-meter').getAttribute('aria-label'), /^177\.8 of 150 grams carbs$/);
    assert.equal(await page.locator('#remaining').innerText(), '6'); assert.equal(await page.locator('#remaining-label').innerText(), 'left');
    assert.equal(await score(), '14 / 17');
    assert.equal(await page.locator('#next-up').count(), 0, 'with every meal logged nothing needs to stay open');
    assert.equal(await page.locator('.meal-row.is-logged').count(), 4, 'logged meals are quiet rows');
    for (let i = 0; i < 9; i++) await page.locator('.water-row').click();
    await page.locator('[data-quest=steps]').click();
    assert.equal(await score(), '17 / 17'); assert.equal(await page.locator('#quest-grade').innerText(), 'S');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '1 day streak');
    assert.equal(await page.locator('#week-strip .is-selected').getAttribute('class').then(c => c.includes('is-s')), true, 'an S day is gold in the week strip');
    assert.equal((await saved(page)).entries.length, 4);
    await page.reload(); assert.equal(await score(), '17 / 17');
    // Switch tier without duplicating; tap the logged option again to remove it.
    await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 4); assert.equal(await score(), '16 / 17');
    await pick('L', 'M'); assert.equal((await saved(page)).entries.length, 3); assert.equal(await score(), '12 / 17');
    await page.locator('[data-meal-toggle=L]').click();
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L', 'an unlogged meal leads again');
    await pick('L', 'S');
    // Going over target says so.
    await page.evaluate(() => CHADUX.openFood('manual')); await page.locator('#food-name').fill('Synthetic extra'); await page.locator('#calories').fill('300'); await page.locator('#add-form button').click();
    assert.equal(await page.locator('#remaining-label').innerText(), 'over'); assert.equal(await page.locator('#remaining').innerText(), '294');
    assert.equal(await page.locator('#extras').isVisible(), true); assert.equal(await page.locator('#entries .entry').count(), 1, 'plan meals live in their rows; other food is listed below');
    await page.locator('#undo-toast button').click(); assert.equal(await page.locator('#remaining-label').innerText(), 'left'); assert.equal(await page.locator('#extras').isVisible(), false);
    for (const field of ['electrolyte', 'cardio', 'sleep']) await page.locator(`[data-quest=${field}]`).click();
    assert.equal(await page.locator('#today .quest-chip[aria-pressed=true]').count(), 4);

    await tab('settings');
    await page.locator('#local-weight').fill('80'); await page.locator('#local-weight').dispatchEvent('change');
    assert.equal((await saved(page)).questsV5['2026-11-24'].weight, 80);
    await page.locator('#water-amount').fill('4.2'); await page.locator('#water-amount').dispatchEvent('change');
    assert.equal((await saved(page)).questsV5['2026-11-24'].water, 4.2);
    await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).questsV5['2026-11-24'].water, 4.5);

    // Training: today's session, one-tap rows, top sets and PRs, whole session.
    await tab('training');
    assert.match(await page.locator('.is-today').innerText(), /Pull/); assert.equal(await page.locator('.is-today .exercise-toggle').count(), 7);
    await page.locator('.is-today .exercise-toggle').first().click();
    assert.equal((await saved(page)).questsV5['2026-11-24'].exercises[0], true);
    assert.equal(await page.locator('.is-today .ch-ring strong').innerText(), '1/7');
    await page.locator('.is-today .exercise > .exercise-info').first().click();
    await page.locator('#detail-sheet input').nth(0).fill('20'); await page.locator('#detail-sheet input').nth(1).fill('8'); await page.locator('#detail-sheet .top-set-form button').click();
    assert.match(await page.locator('#celebration').innerText(), /Personal record/);
    assert.deepEqual((await saved(page)).questsV5['2026-11-24'].topSets['Pull-ups'], { kg: 20, reps: 8 });
    assert.equal(await page.locator('.is-today .exercise-info').first().innerText(), '20×8', 'the last top set shows on the row');
    await page.locator('.is-today .exercise > .exercise-info').first().click();
    assert.match(await page.locator('#detail-sheet .ch-best').innerText(), /20 kg × 8/);
    await page.locator('#detail-sheet input').nth(1).fill('7'); await page.locator('#detail-sheet .top-set-form button').click();
    await page.clock.runFor(4000);
    assert.equal(await page.locator('#celebration').isVisible(), false, 'a lower set is not a record');
    assert.equal(await page.locator('.is-today .exercise-info').count(), 7, 'every Pull move has a top set to record');
    await page.locator('.training-row[data-day="2026-11-25"]').click(); assert.match(await page.locator('.training-level').innerText(), /Muay thai only/);
    assert.equal(await page.locator('.training-level .exercise-info').count(), 0, 'no details button where there is nothing to record (warm-up, class, stretch)'); await page.locator('#training-today').click();
    const session = page.locator('.is-today [data-quest=training]');
    assert.equal((await session.innerText()).trim(), 'Complete session');
    await session.click(); assert.equal(await page.locator('.is-today .exercise-toggle[aria-pressed=true]').count(), 7);
    assert.equal((await session.innerText()).trim(), 'Session complete'); assert.equal(await page.locator('#training-week .is-selected').getAttribute('class').then(c => c.includes('is-s')), true);
    await page.waitForTimeout(420); await session.click();
    assert.equal(await page.locator('.is-today .exercise-toggle[aria-pressed=true]').count(), 1, 'reopening gives back the one exercise ticked before');
    assert.match(await page.locator('.week-rows').innerText(), /Mon[\s\S]*Push/i); assert.equal(await page.locator('.training-row').count(), 6);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(shots, 'training.png') });

    // Saved v4 data, photos, extension fields, goals, and earned rewards survive the migration.
    await page.evaluate(() => { localStorage.setItem('rec-calories-v1', JSON.stringify({ schemaVersion: 4, target: 2100, proteinGoal: 175, carbsGoal: 180, fatGoal: 65, custom: 'preserve', entries: [{ id: 'legacy-synthetic', day: '2020-01-01', name: 'Synthetic historic meal', kcal: 2000, protein: 200, thumbnail: 'data:image/png;base64,c3ludGhldGlj', extra: 'preserve' }] })); localStorage.setItem('unrelated-synthetic', 'keep'); });
    await page.reload();
    const migrated = await saved(page);
    assert.equal(migrated.schemaVersion, 5); assert.equal(migrated.entries[0].extra, 'preserve'); assert.equal(migrated.entries[0].thumbnail, 'data:image/png;base64,c3ludGhldGlj');
    assert.equal(migrated.legacyGoals.target, 2100); assert.ok(migrated.legacyRewards.xp > 0); assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-synthetic')), 'keep');

    // Seed only synthetic history to verify streaks, charts and calendar-triggered behavior.
    await page.evaluate(() => { const q = CHADQuest, state = { schemaVersion: 5, target: 1900, proteinGoal: 220, entries: [], questsV5: {} }; for (let n = 0; n < 30; n++) { const key = q.shift('2026-11-24', -n); state.entries.push({ id: 'synthetic-' + n, day: key, name: 'Synthetic test day', kcal: 1750 + n * 7, protein: 220, carbs: 150, fat: 45 }); state.questsV5[key] = { picks: { L: 'S', P: 'S', D: 'S', E: 'S' }, water: q.waterGoal(key), steps: true, weight: 80 + n * .05 }; } localStorage.setItem('rec-calories-v1', JSON.stringify(state)); });
    await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '30 day streak');
    assert.equal(await page.locator('#week-strip .is-s').count(), 2, 'Monday and today are S days this week');
    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+09:30')); await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '30 day streak');
    await page.clock.setFixedTime(new Date('2026-11-26T12:00:00+09:30')); await page.reload(); assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), '0 day streak');
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();
    await tab('history');
    assert.equal(await page.locator('#streak-count').innerText(), '30'); assert.match(await page.locator('#streak').innerText(), /best 30/);
    assert.match(await page.locator('#weekly-progress').innerText(), /pts/); assert.equal(await page.locator('#daily-grade').innerText(), 'S');
    assert.equal(await page.locator('#charts canvas').count(), 9, 'three rings, five charts, heatmap');
    assert.equal(await page.locator('.streak-chart+details .ch-hint').count(), 91);
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    assert.equal(await page.locator('.chart-card').filter({ hasText: 'Calories' }).locator('.chart-values .ch-hint').count(), 30);
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(shots, 'progress-dark.png') });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#charts canvas')].every(c => c.width > 80 && c.height > 50)), true);
    assert.equal(await page.locator('#badges .badge').count(), 12); assert.ok(await page.locator('#badges .badge.unlocked').count() >= 4);
    assert.match(await page.locator('#badge-count').innerText(), /^\d+\/12$/);
    assert.ok(await page.locator('#past-entries .entry-open').count() >= 29, 'past entries open their sheet');
    // Level details.
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
    assert.equal(await page.locator('.deload').isVisible(), true); assert.match(await page.locator('.is-today .exercise-toggle').first().innerText(), /2 × 6/);

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

    for (const width of [320, 430, 680]) { await page.setViewportSize({ width, height: 932 }); for (const view of ['today', 'training', 'history', 'settings']) { await tab(view); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow ' + width + ' ' + view); } }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const value of ['light', 'dark']) {
      await tab('settings'); await theme(value);
      assert.equal(await page.locator('meta[name=theme-color]').first().getAttribute('content'), value === 'dark' ? '#000000' : '#F2F2F7');
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
    assert.equal(await page.locator('#daily-checklist [data-meal-row], #daily-checklist [data-meal-slot]').count() >= 4, true, 'every meal is on screen offline');
    await page.evaluate(() => document.fonts.load('12px "Press Start 2P"')); assert.equal(await page.evaluate(() => document.fonts.check('12px "Press Start 2P"')), true);
    assert.equal(await page.evaluate(() => typeof CHADFood.startScanner), 'function');
    assert.deepEqual(await page.evaluate(async cache => (await (await caches.open(cache)).keys()).map(r => new URL(r.url).pathname).sort(), CACHE), shellFiles().map(f => new URL(f, 'http://127.0.0.1:8088/').pathname).sort());
    for (const file of shellFiles().filter(f => f !== './')) assert.equal(await page.evaluate(async file => (await fetch(file)).status, file), 200, file + ' offline');
    assert.deepEqual(errors, []);
    console.log('PASS regression Edge 390x844: 17=S with whole-number hero (kcal, protein, carbs, fat) and exact labels, logged meals as rows, switch/remove/persist through rows, other food listed once, over-target; weigh-in and water edits; training rows, top sets on rows, PR, whole session on and off keeping earlier ticks, the week as rows; v4 migration incl photos/goals/rewards; 30-day streak, nine canvases, heatmap, 7/30 range, badges, level details, manual theme pixel redraw, daily water goals; phases/add-ons/deload; theme hint, haptics/sound switches, phase dates; 320/430/680 no overflow; dock clearance both themes; offline complete shell, font, scanner; zero JS/console errors. Screenshots: ' + shots);
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
