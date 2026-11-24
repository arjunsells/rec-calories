// Every change is reversible. For each path: do it, Undo, and the journal is exactly what it was (deep equal), with
// the same XP, streak, score and quest state; Redo gives back exactly the changed journal. Then the accidental-tap cases:
// double taps, a double tap on Undo, toggling on and off repeatedly (no XP farming), celebrations that never repeat.
// Synthetic journal in a disposable browser profile only.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');

(async () => {
  const server = await serve(8094), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page), key = '2026-11-24';
    await page.clock.install({ time: new Date(NOON) });
    await page.goto('http://127.0.0.1:8094/');
    // Three complete days before today: a 3-day streak that today can extend. Two other-food entries to delete.
    await page.evaluate(() => {
      const q = CHADQuest, s = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
      for (let n = 1; n <= 3; n++) { const k = q.shift('2026-11-24', -n); CHADPlan.forEach(slot => { const c = slot.choices[0]; s.entries.push({ id: 'plan-' + k + '-' + slot.id, day: k, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); }); s.questsV5[k] = { picks: { L: 'S', P: 'S', D: 'S', E: 'S' }, water: q.waterGoal(k), steps: true }; }
      s.entries.push({ id: 'synthetic-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' }, { id: 'synthetic-bar', day: '2026-11-24', name: 'Synthetic protein bar', kcal: 200, protein: 20, carbs: 18, fat: 7, meal: 'Snacks', source: 'search' });
      localStorage.setItem('rec-calories-v1', JSON.stringify(s));
    });
    await page.reload();
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const toast = () => page.locator('#undo-toast button');
    const view = async name => { await page.locator(`[data-view=${name}]`).tap(); };
    // Everything that rewards depend on, derived from what is saved right now.
    const snapshot = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rec-calories-v1')), today = CHADQuest.dayKey(), d = CHADQuest.daily(s, today);
      const g = CHADQuest.rewards(s, today, RECGame.derive(s, today)), st = CHADQuest.stats(s, today);
      return { journal: s, xp: g.xp, level: g.level, badges: g.badges.filter(b => b.unlocked).map(b => b.id), score: d.score, grade: d.grade, streak: st.streak, week: st.week.total, shownXP: document.getElementById('xp-total').textContent, shownStreak: document.getElementById('home-streak').getAttribute('aria-label') };
    });
    const paths = [];
    // Run one change, Undo it, Redo it, Undo again: exact journal and rewards each way.
    async function reversible(name, act, check) {
      const before = await snapshot();
      await act();
      const after = await snapshot();
      assert.notDeepEqual(after.journal, before.journal, name + ': the action changed something');
      if (check) await check(after.journal, before.journal);
      await tap(toast()); assert.match(await page.locator('#undo-toast').innerText(), /Undone/, name + ': Undo confirms');
      assert.deepEqual(await snapshot(), before, name + ': Undo restores the exact journal, XP, streak, score and quests');
      await tap(toast()); assert.deepEqual(await snapshot(), after, name + ': Redo gives the change back exactly');
      await tap(toast()); assert.deepEqual(await snapshot(), before, name + ': and Undo again');
      paths.push(name);
    }
    const base = await snapshot();
    assert.equal(base.streak, 3); assert.equal(base.shownStreak, '3 day streak');

    // Meals: log, switch, remove (tap the logged option again), from the card and from the sheet.
    await reversible('meal log', () => tap(page.locator('[data-slot=L][data-tier=S]')), j => assert.equal(j.questsV5[key].picks.L, 'S'));
    await tap(page.locator('[data-slot=L][data-tier=S]'));                                    // keep lunch logged
    await reversible('meal switch', async () => { await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=F]')); },
      j => { assert.equal(j.questsV5[key].picks.L, 'F'); assert.equal(j.entries.filter(e => e.planSlot === 'L' && e.day === key).length, 1); });
    await reversible('meal remove (tap the logged option)', async () => { await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]')); },
      j => { assert.equal(j.questsV5[key].picks.L, undefined); assert.equal(j.entries.some(e => e.planSlot === 'L' && e.day === key), false); });
    await tap(page.locator('[data-meal-toggle=L]'));
    await reversible('meal log from the details sheet', async () => { await tap(page.locator('#next-up .meal-info')); await tap(page.locator('#detail-sheet .ch-tier[data-tier=M]')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log medium pre-gym' })); }, j => assert.equal(j.questsV5[key].picks.P, 'M'));

    // Water: add from nothing (the day object did not exist before for these fields), add more, take off.
    await reversible('water add', () => tap(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, .5));
    await tap(page.locator('.water-row')); await tap(page.locator('.water-row'));
    await reversible('water add again', () => tap(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, 1.5));
    await reversible('water minus', () => tap(page.locator('.water-minus')), j => assert.equal(j.questsV5[key].water, .5));
    // Quests on, and off again.
    for (const field of ['electrolyte', 'cardio', 'steps', 'sleep']) await reversible(field + ' on', () => tap(page.locator(`#today [data-quest=${field}]`)), j => assert.equal(j.questsV5[key][field], true));
    await tap(page.locator('#today [data-quest=steps]'));
    await reversible('steps off', () => again(page.locator('#today [data-quest=steps]')), j => assert.equal(j.questsV5[key].steps, false));
    // Training: two exercises ticked, then the whole session on and off. Off gives back exactly the two ticks.
    await view('training');
    await reversible('exercise tick', () => tap(page.locator('.is-today .exercise-toggle').nth(0)), j => assert.equal(j.questsV5[key].exercises[0], true));
    await tap(page.locator('.is-today .exercise-toggle').nth(0)); await tap(page.locator('.is-today .exercise-toggle').nth(1));
    await reversible('exercise untick', () => again(page.locator('.is-today .exercise-toggle').nth(1)), j => assert.equal(j.questsV5[key].exercises[1], false));
    await reversible('session complete', () => tap(page.locator('.is-today [data-quest=training]')), async j => { assert.equal(j.questsV5[key].training, true); assert.equal(await page.locator('.is-today .exercise-toggle[aria-pressed=true]').count(), 7); });
    await tap(page.locator('.is-today [data-quest=training]'));
    await reversible('session reopen keeps earlier ticks', () => again(page.locator('.is-today [data-quest=training]')), async j => { assert.equal(j.questsV5[key].training, false); assert.deepEqual(j.questsV5[key].exercises, { 0: true, 1: true }); assert.equal(await page.locator('.is-today .exercise-toggle[aria-pressed=true]').count(), 2); });
    await again(page.locator('.is-today [data-quest=training]'));
    await view('today');
    await reversible('training habit on Today', () => tap(page.locator('#today [data-quest=training]')), j => { assert.equal(j.questsV5[key].training, true); assert.deepEqual(j.questsV5[key].exercises, { 0: true, 1: true }); });
    // A top set and its record.
    await view('training');
    await reversible('top set', async () => { await tap(page.locator('.is-today .exercise-info').first()); await page.locator('#top-set-kg').fill('22.5'); await page.locator('#top-set-reps').fill('8'); await tap(page.locator('#detail-sheet .top-set-form button')); }, j => assert.deepEqual(j.questsV5[key].topSets['Pull-ups'], { kg: 22.5, reps: 8 }));
    await view('today');

    // Other food: delete (back in the same place), log again, quick add.
    await reversible('delete an entry', async () => { await tap(page.locator('#entries [data-entry=synthetic-coffee] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => assert.equal(j.entries.some(e => e.id === 'synthetic-coffee'), false));
    await reversible('log again', async () => { await tap(page.locator('#entries [data-entry=synthetic-bar] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log again' })); }, j => assert.equal(j.entries.at(-1).source, 'repeat'));
    await reversible('quick add', async () => { await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=manual]')); await page.locator('#food-name').fill('Synthetic wrap'); await page.locator('#calories').fill('350'); await page.locator('#protein').fill('25'); await page.locator('#carbs').fill('30'); await page.locator('#fat').fill('12'); await tap(page.locator('#add-form button')); }, j => assert.equal(j.entries.at(-1).name, 'Synthetic wrap'));
    // A plan meal deleted from Progress takes its slot with it, and Undo gives both back.
    await view('history');
    await reversible('delete a plan meal in Past entries', async () => { await tap(page.locator('#past-entries [data-entry="plan-2026-11-23-D"] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => { assert.equal(j.questsV5['2026-11-23'].picks.D, undefined); assert.equal(j.entries.some(e => e.id === 'plan-2026-11-23-D'), false); });
    // Settings: today's water and weigh-in, goals, phase dates.
    await view('settings');
    await reversible('water in Settings', async () => { await page.locator('#water-amount').fill('3.2'); await page.locator('#water-amount').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].water, 3.2));
    await reversible('weigh-in', async () => { await page.locator('#local-weight').fill('81.4'); await page.locator('#local-weight').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].weight, 81.4));
    await reversible('goals', async () => { await page.locator('#daily-target').fill('2100'); await tap(page.locator('#settings-form button')); }, j => assert.equal(j.target, 2100));
    assert.equal(await page.locator('#daily-target').inputValue(), '1900', 'the form shows the restored goal');
    await reversible('phase dates', async () => { await page.locator('#phase-end-0').fill('2026-12-01'); await tap(page.getByRole('button', { name: 'Save phase dates' })); }, j => assert.equal(j.phaseEnds[0], '2026-12-01'));
    assert.equal(await page.locator('#phase-end-0').inputValue(), '2026-12-06', 'the date field shows the restored value');
    // Reset add-ons (a Reset-phase day).
    await page.clock.setFixedTime(new Date('2026-12-08T12:00:00+09:30')); await page.reload();
    await reversible('add-on', () => tap(page.getByRole('button', { name: /Daily shake ·/ })), j => assert.ok(j.entries.some(e => e.id === 'addon-2026-12-08-shake')));
    await tap(page.getByRole('button', { name: /Daily shake ·/ }));
    await reversible('add-on off', () => again(page.getByRole('button', { name: /Daily shake ·/ })), j => assert.equal(j.entries.some(e => e.id === 'addon-2026-12-08-shake'), false));
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();
    console.log('PASS every Undo path (' + paths.length + '): ' + paths.join(', ') + ' — exact journal, XP, streak, score and quests back each time; Redo exact; Undo again exact.');

    // Accidental taps. Lunch goes back to not logged, so it is the meal on top again.
    await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]')); await tap(page.locator('[data-meal-toggle=L]')); await page.waitForTimeout(450);
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L');
    const clean = await snapshot();
    // 1. A quick double tap on a card logs it once. The second tap would cancel the first, or land on the next meal that
    //    slides into its place: both are ignored for a moment.
    const lunch = page.locator('[data-slot=L][data-tier=S]'); await lunch.scrollIntoViewIfNeeded(); const lb = await lunch.boundingBox();
    await page.touchscreen.tap(lb.x + 40, lb.y + 40); await page.touchscreen.tap(lb.x + 40, lb.y + 40);
    assert.equal((await saved(page)).questsV5[key].picks.L, 'S', 'a double tap on a meal still logs it once');
    assert.equal((await saved(page)).questsV5[key].picks.P, undefined, 'and never logs the meal that slid into its place');
    // 1b. A double tap on a sheet's Log button logs once and never lands on what sits under the button afterwards.
    await page.waitForTimeout(450); await tap(page.locator('#next-up .meal-info'));
    const logButton = page.locator('#detail-sheet').getByRole('button', { name: 'Log strict pre-gym' }), lg = await logButton.boundingBox(), beforeSheet = await snapshot();
    await page.touchscreen.tap(lg.x + lg.width / 2, lg.y + lg.height / 2); await page.touchscreen.tap(lg.x + lg.width / 2, lg.y + lg.height / 2);
    const afterSheet = await snapshot(), without = j => { const d = { ...j.questsV5[key] }; delete d.picks; return { ...j, questsV5: { ...j.questsV5, [key]: d }, entries: j.entries.filter(e => e.planSlot !== 'P' || e.day !== key) }; };
    assert.equal(afterSheet.journal.questsV5[key].picks.P, 'S'); assert.deepEqual(without(afterSheet.journal), without(beforeSheet.journal), 'nothing else changed under the finger');
    await tap(toast()); await page.waitForTimeout(450);
    await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]')); await tap(page.locator('[data-meal-toggle=L]')); await page.waitForTimeout(450);
    await tap(page.locator('[data-slot=L][data-tier=S]'));
    // 2. A double tap on Undo undoes once and never lands on the Redo that takes its place.
    const button = await toast().boundingBox(); await page.waitForTimeout(400);
    await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2); await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
    assert.equal((await saved(page)).questsV5[key].picks?.L, undefined, 'one Undo, not Undo + Redo');
    assert.deepEqual((await snapshot()).journal, clean.journal);
    // 3. Toggling on and off again and again earns nothing: XP is worked out from what is logged.
    for (let i = 0; i < 3; i++) {
      await tap(page.locator('#today [data-quest=cardio]')); await again(page.locator('#today [data-quest=cardio]'));
      await tap(page.locator('.water-row')); await tap(page.locator('.water-minus'));
      await again(page.locator('[data-slot=L][data-tier=M]')); await tap(page.locator('[data-meal-row=L]')); await again(page.locator('[data-slot=L][data-tier=M]'));
      await page.waitForTimeout(450);
    }
    const farmed = await snapshot();
    assert.equal(farmed.xp, clean.xp, 'no XP from switching things on and off'); assert.equal(farmed.streak, clean.streak); assert.equal(farmed.score, clean.score);
    // 4. Undo and Redo back and forth: the XP of one log, never more.
    await tap(page.locator('[data-slot=L][data-tier=S]')); const once = await snapshot();
    assert.ok(once.xp > clean.xp, 'a logged meal earns XP');
    for (let i = 0; i < 4; i++) { await tap(toast()); await tap(toast()); }
    assert.equal((await snapshot()).xp, once.xp, 'four Undo/Redo rounds later: still the XP of one log');
    // 5. Celebrations happen once: the streak banner and the S rank do not come back with Undo and Redo.
    const hideBanner = () => page.evaluate(() => { document.getElementById('celebration').hidden = true; });
    while (((await saved(page)).questsV5[key].water || 0) < 4.5) await tap(page.locator('.water-row'));
    if (!(await saved(page)).questsV5[key].steps) await again(page.locator('#today [data-quest=steps]'));
    await hideBanner();
    let now = await snapshot(); assert.equal(now.score, 6, 'lunch, water and steps: one meal short of a B'); assert.equal(now.streak, 3);
    await page.waitForTimeout(460); await tap(page.locator('[data-slot=P][data-tier=S]'));
    assert.equal((await snapshot()).streak, 4); assert.match(await page.locator('#celebration').innerText(), /Streak saved · 4 days/);
    await hideBanner();
    await tap(toast()); assert.equal((await snapshot()).streak, 3, 'Undo takes the streak day back'); assert.equal(await page.locator('#celebration').isVisible(), false);
    await tap(toast()); assert.equal((await snapshot()).streak, 4, 'Redo gives it back');
    assert.equal(await page.locator('#celebration').isVisible(), false, 'without celebrating the same streak twice');
    await page.waitForTimeout(460); await tap(page.locator('[data-slot=D][data-tier=S]')); await page.waitForTimeout(460); await tap(page.locator('[data-slot=E][data-tier=S]'));
    now = await snapshot(); assert.equal(now.score, 17); assert.equal(now.grade, 'S'); assert.match(await page.locator('#celebration').innerText(), /S rank · 17\/17/);
    await hideBanner();
    await tap(toast()); assert.equal((await snapshot()).grade, 'A'); await tap(toast()); assert.equal((await snapshot()).grade, 'S');
    assert.equal(await page.locator('#celebration').isVisible(), false, 'and the S rank is not announced twice either');
    assert.deepEqual(errors, []);
    console.log('PASS accidental taps: double tap on a card logs once; double tap on Undo undoes once (Redo is armed after a beat); 3 rounds of on/off for a quest, water and a meal earn 0 XP; 4 Undo/Redo rounds keep the XP of one log; streak and S-rank banners never repeat; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
