// Every change is reversible. For each path: do it, Undo, and the journal is exactly what it was (deep equal), with
// the same XP, streak, score and quest state; Redo gives back exactly the changed journal. v10 adds the done chips, a
// missed day, Mark done, and Gym mode (start, a set, a removed set, the finish). Then the accidental-tap cases: double
// taps, a double tap on Undo, toggling on and off (no XP farming), celebrations that never repeat.
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
    // Three full days before today, and two other-food entries to delete.
    await page.evaluate(() => {
      const q = CHADQuest, s = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
      for (let n = 1; n <= 3; n++) { const k = q.shift('2026-11-24', -n); CHADPlan.forEach(slot => { const c = slot.choices[0]; s.entries.push({ id: 'plan-' + k + '-' + slot.id, day: k, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); }); s.questsV5[k] = { picks: { B: 'S', L: 'S', P: 'S', D: 'S' }, water: q.waterGoal(k), steps: true }; }
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
      return { journal: s, xp: g.xp, level: g.level, score: d.score, grade: d.grade, streak: st.streak, week: st.week.total, water: CHADQuest.waterStreak(s, today), shownXP: document.getElementById('xp-total').textContent, shownStreak: document.getElementById('home-streak').getAttribute('aria-label') };
    });
    const paths = [];
    async function reversible(name, act, check) {
      const before = await snapshot();
      await act();
      const after = await snapshot();
      assert.notDeepEqual(after.journal, before.journal, name + ': the action changed something');
      if (check) await check(after.journal, before.journal, after, before);
      await tap(toast()); assert.match(await page.locator('#undo-toast').innerText(), /Undone/, name + ': Undo confirms');
      assert.deepEqual(await snapshot(), before, name + ': Undo restores the exact journal, XP, streak, score and quests');
      await tap(toast()); assert.deepEqual(await snapshot(), after, name + ': Redo gives the change back exactly');
      await tap(toast()); assert.deepEqual(await snapshot(), before, name + ': and Undo again');
      paths.push(name);
    }
    const base = await snapshot();
    assert.equal(base.streak, 48); assert.equal(base.shownStreak, '48 day streak'); assert.equal(base.water, 3);

    // Meals: log, switch, remove, and log from the long-press sheet.
    await reversible('meal log', () => tap(page.locator('[data-slot=L][data-tier=S]')), j => assert.equal(j.questsV5[key].picks.L, 'S'));
    await tap(page.locator('[data-slot=L][data-tier=S]'));                                    // keep lunch logged
    await reversible('meal switch', async () => { await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=F]')); },
      j => { assert.equal(j.questsV5[key].picks.L, 'F'); assert.equal(j.entries.filter(e => e.planSlot === 'L' && e.day === key).length, 1); });
    await reversible('meal remove (tap the logged option)', async () => { await tap(page.locator('[data-meal-row=L]')); await tap(page.locator('[data-slot=L][data-tier=S]')); },
      j => { assert.equal(j.questsV5[key].picks.L, undefined); assert.equal(j.entries.some(e => e.planSlot === 'L' && e.day === key), false); });
    await tap(page.locator('[data-meal-toggle=L]'));
    await reversible('meal log from the long-press sheet', async () => {
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(450);
      const card = page.locator('#next-up [data-tier=M]'), box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log medium dinner' }));
    }, j => assert.equal(j.questsV5[key].picks.D, 'M'));
    // Water: from nothing (the day fields did not exist before), and again.
    await reversible('water add', () => tap(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, .5));
    await tap(page.locator('.water-row')); await tap(page.locator('.water-row'));
    await reversible('water add again', () => tap(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, 1.5));
    // Done chips on and off (the wrap-up opens in place at noon).
    await tap(page.locator('[data-row=wrap]'));
    for (const field of ['cardio', 'steps', 'sleep', 'electrolyte']) await reversible(field + ' on', () => tap(page.locator(`#today [data-quest=${field}]`)), j => assert.equal(j.questsV5[key][field], true));
    await tap(page.locator('#today [data-quest=steps]'));
    await reversible('steps off', () => again(page.locator('#today [data-quest=steps]')), j => assert.equal(j.questsV5[key].steps, false));
    await again(page.locator('[data-fold=wrap]'));
    // A missed day (Settings › Selected day): the journey streak restarts the day after, and comes back with Undo.
    await page.evaluate(() => CHADUX.goTo('2026-11-21')); await view('settings');
    await reversible('missed day', async () => { await page.locator('#missed-day').check(); }, (j, b, after) => { assert.equal(j.questsV5['2026-11-21'].missed, true); assert.equal(after.streak, 3); assert.equal(after.shownStreak, '3 day streak'); });
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey())); await view('today');
    // Muay Thai on a past Wednesday, and Mark done on Training.
    await page.evaluate(() => CHADUX.goTo('2026-11-18'));
    await tap(page.locator('[data-row=session]'));
    await reversible('Muay Thai done', () => tap(page.locator('#today [data-quest=training]')), j => assert.equal(j.questsV5['2026-11-18'].training, true));
    await page.evaluate(() => CHADUX.goTo('2026-11-23')); await view('training');
    await reversible('Mark done (Training)', () => tap(page.locator('.training-level [data-quest=training]')), j => assert.equal(j.questsV5['2026-11-23'].training, true));
    // Gym mode on today's Pull: start, a set, a removed set, the finish.
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    await reversible('workout start', () => tap(page.locator('.is-today [data-gym-start]')), j => assert.deepEqual(j.questsV5[key].workout.sets, []));
    await tap(page.locator('.is-today [data-gym-start]'));
    await reversible('workout set', () => tap(page.locator('#gym-go')), (j, b, after) => { assert.equal(j.questsV5[key].workout.sets.length, 1); assert.equal(j.questsV5[key].workout.sets[0].x, 'Pull-ups'); });
    await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]'));
    await reversible('workout set removed (tap its dot)', () => tap(page.locator('#gym-dots [data-set="0"]')), j => assert.equal(j.questsV5[key].workout.sets.length, 0));
    await tap(page.locator('#gym-go'));
    await reversible('workout finish', () => tap(page.locator('[data-gym=finish]')), (j, b, after, was) => { assert.ok(j.questsV5[key].workout.end); assert.equal(j.questsV5[key].training, true); assert.equal(after.xp - was.xp, 70, "finishing Pull: 7 moves x 10"); });
    if (await page.locator('#gym').isVisible()) await tap(page.locator('[data-gym=close]'));
    await view('today');

    // Other food: delete (back in the same place), log again, quick add.
    await reversible('delete an entry', async () => { await tap(page.locator('#entries [data-entry=synthetic-coffee] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => assert.equal(j.entries.some(e => e.id === 'synthetic-coffee'), false));
    await reversible('log again', async () => { await tap(page.locator('#entries [data-entry=synthetic-bar] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log again' })); }, j => assert.equal(j.entries.at(-1).source, 'repeat'));
    await reversible('quick add', async () => { await tap(page.locator('#today-scan')); await tap(page.locator('[data-add=manual]')); await page.locator('#food-name').fill('Synthetic wrap'); await page.locator('#calories').fill('350'); await page.locator('#protein').fill('25'); await page.locator('#carbs').fill('30'); await page.locator('#fat').fill('12'); await tap(page.locator('#add-form button')); }, j => assert.equal(j.entries.at(-1).name, 'Synthetic wrap'));
    await view('history');
    await reversible('delete a plan meal in Past entries', async () => { await tap(page.locator('#past-entries [data-entry="plan-2026-11-23-D"] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => { assert.equal(j.questsV5['2026-11-23'].picks.D, undefined); assert.equal(j.entries.some(e => e.id === 'plan-2026-11-23-D'), false); });
    // Settings: today's water and weigh-in, goals, phase dates.
    await view('settings');
    await reversible('water in Settings', async () => { await page.locator('#water-amount').fill('3.2'); await page.locator('#water-amount').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].water, 3.2));
    await reversible('weigh-in', async () => { await page.locator('#local-weight').fill('81.4'); await page.locator('#local-weight').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].weight, 81.4));
    await reversible('goals', async () => { await page.locator('#daily-target').fill('2100'); await tap(page.locator('#settings-form button')); }, j => assert.equal(j.target, 2100));
    assert.equal(await page.locator('#daily-target').inputValue(), '1900', 'the form shows the restored goal');
    await reversible('phase dates', async () => { await page.locator('#phase-end-0').fill('2026-12-01'); await tap(page.getByRole('button', { name: 'Save phase dates' })); }, j => assert.equal(j.phaseEnds[0], '2026-12-01'));
    // Reset add-ons (a Reset-phase day).
    await page.clock.setFixedTime(new Date('2026-12-08T12:00:00+09:30')); await page.reload();
    await reversible('add-on', () => tap(page.getByRole('button', { name: /Daily shake ·/ })), j => assert.ok(j.entries.some(e => e.id === 'addon-2026-12-08-shake')));
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();
    console.log('PASS every Undo path (' + paths.length + '): ' + paths.join(', ') + ' — exact journal, XP, streak, score and quests back each time; Redo exact; Undo again exact.');

    // Accidental taps. Lunch goes back to not logged, so it is the meal on top at noon.
    const lunch = page.locator('[data-slot=L][data-tier=S]');
    if (await page.locator('[data-meal-row=L].is-logged').count()) { await tap(page.locator('[data-meal-row=L]')); await tap(lunch); await tap(page.locator('[data-meal-toggle=L]')); }
    await page.waitForTimeout(450); assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), 'L');
    const clean = await snapshot();
    // 1. A quick double tap on a card logs it once, and never logs the meal that slides into its place.
    await page.evaluate(() => scrollTo(0, 0)); const lb = await lunch.boundingBox();
    await page.touchscreen.tap(lb.x + 40, lb.y + 30); await page.touchscreen.tap(lb.x + 40, lb.y + 30);
    assert.equal((await saved(page)).questsV5[key].picks.L, 'S', 'a double tap on a meal still logs it once');
    assert.equal((await saved(page)).questsV5[key].picks.D, undefined, 'and never logs the meal that slid into its place (dinner)');
    // 2. A double tap on Undo undoes once and never lands on the Redo that takes its place.
    const button = await toast().boundingBox(); await page.waitForTimeout(400);
    await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2); await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
    assert.equal((await saved(page)).questsV5[key].picks?.L, undefined, 'one Undo, not Undo + Redo');
    assert.deepEqual((await snapshot()).journal, clean.journal);
    // 3. Toggling on and off again and again earns nothing: XP is worked out from what is logged.
    await again(page.locator('[data-row=wrap]'));
    for (let i = 0; i < 3; i++) {
      if (!(await page.locator('#today [data-quest=cardio]').count())) await again(page.locator('[data-row=wrap]'));   // one line open at a time
      await again(page.locator('#today [data-quest=cardio]')); await again(page.locator('#today [data-quest=cardio]'));
      await again(page.locator('.water-row')); await tap(toast());
      await again(page.locator('[data-slot=L][data-tier=M]')); await page.waitForTimeout(450); await tap(page.locator('[data-meal-row=L]')); await again(page.locator('[data-slot=L][data-tier=M]'));
      await again(page.locator('[data-meal-toggle=L]'));
    }
    const farmed = await snapshot();
    assert.equal(farmed.xp, clean.xp, 'no XP from switching things on and off'); assert.equal(farmed.streak, clean.streak); assert.equal(farmed.score, clean.score);
    // 4. Undo and Redo back and forth: the XP of one log, never more.
    await page.waitForTimeout(450); await tap(page.locator('[data-slot=L][data-tier=S]')); const once = await snapshot();
    assert.ok(once.xp > clean.xp, 'a logged meal earns XP');
    for (let i = 0; i < 4; i++) { await tap(toast()); await tap(toast()); }
    assert.equal((await snapshot()).xp, once.xp, 'four Undo/Redo rounds later: still the XP of one log');
    // 5. Celebrations happen once: the S rank, and a journey milestone (25 Nov is Day 49: seven weeks).
    const hideBanner = () => page.evaluate(() => { document.getElementById('celebration').hidden = true; });
    while (((await saved(page)).questsV5[key].water || 0) < 4.5) await tap(page.locator('.water-row'));
    if (!(await saved(page)).questsV5[key].steps) {
      if (!(await page.locator('#today [data-quest=steps]').count())) await again(page.locator('[data-row=wrap]'));
      await again(page.locator('#today [data-quest=steps]'));
    }
    await hideBanner(); if (await page.locator('[data-fold=wrap]').count()) await again(page.locator('[data-fold=wrap]'));
    // The session is the fourth part of a perfect day: finish today's Pull (left open above), then the last two meals.
    await view('training'); await tap(page.locator('.is-today [data-gym-start]')); await tap(page.locator('[data-gym=finish]'));
    await tap(page.locator('[data-gym=done]')); assert.equal(await page.locator('#gym').isVisible(), false);
    await view('today'); await hideBanner(); assert.equal((await snapshot()).score, 9, 'lunch, the session, water and steps (protein comes with dinner)');
    for (const id of ['D', 'P']) { await page.waitForTimeout(460); const option = page.locator(`[data-slot=${id}][data-tier=S]`); if (!await option.count()) await tap(page.locator(`[data-meal-row=${id}]`)); await tap(option); }
    let now = await snapshot(); assert.equal(now.score, 17); assert.equal(now.grade, 'S'); assert.match(await page.locator('#celebration').innerText(), /S rank · 17\/17/);
    await hideBanner();
    await tap(toast()); assert.equal((await snapshot()).grade, 'A'); await tap(toast()); assert.equal((await snapshot()).grade, 'S');
    assert.equal(await page.locator('#celebration').isVisible(), false, 'the S rank is not announced twice');
    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+09:30')); await page.reload();
    assert.match(await page.locator('#celebration').innerText(), /7 weeks strong · 49-day streak/); await hideBanner();
    await page.reload(); assert.equal(await page.locator('#celebration').isVisible(), false, 'a milestone is celebrated once');
    assert.deepEqual(errors, []);
    console.log('PASS accidental taps: double tap on a card logs once; double tap on Undo undoes once (Redo is armed after a beat); 3 rounds of on/off for a chip, water and a meal earn 0 XP; 4 Undo/Redo rounds keep the XP of one log; S rank and the 7-week journey milestone are celebrated once; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
