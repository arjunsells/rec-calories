// Every change is reversible. For each path: do it, Undo, and the journal is exactly what it was (deep equal), with
// the same streak, water streak and (hidden) day score; Redo gives back exactly the changed journal. v11 paths: meals
// (the card on top, Later today, the long-press sheet, a saved meal, a custom meal), water, the habits, the favourites,
// + Food, a missed day, Muay Thai, Mark done, Gym mode (start, a set, a removed set, the finish), the food list (delete,
// log again, a plan meal on another day), Settings (water, weigh-in, goals, phase dates) and a Reset add-on. Then the
// accidental-tap cases: double taps, a double tap on Undo, switching on and off, Undo/Redo rounds, celebrations once.
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
      for (let n = 1; n <= 3; n++) { const k = q.shift('2026-11-24', -n); CHADPlan.forEach(slot => { const c = slot.choices[0]; s.entries.push({ id: 'plan-' + k + '-' + slot.id, day: k, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); }); s.questsV5[k] = { picks: { L: 'S', P: 'S', D: 'S' }, water: q.waterGoal(k), steps: true }; }
      s.entries.push({ id: 'synthetic-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Lunch', source: 'manual' }, { id: 'synthetic-bar', day: '2026-11-24', name: 'Synthetic protein bar', kcal: 200, protein: 20, carbs: 18, fat: 7, meal: 'Lunch', source: 'search' });
      localStorage.setItem('rec-calories-v1', JSON.stringify(s));
    });
    await page.reload();
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const toast = () => page.locator('#undo-toast button');
    const view = async name => { await page.waitForTimeout(450); if (name === 'settings') await page.locator('#open-settings').tap(); else await page.locator(`[data-view=${name}]`).tap(); };
    const later = async open => { if ((await page.locator('#later-toggle').getAttribute('aria-expanded') === 'true') !== open) await again(page.locator('#later-toggle')); };
    const details = async open => { if ((await page.locator('#left-line').getAttribute('aria-expanded') === 'true') !== open) await again(page.locator('#left-line')); };
    // Everything derived from what is saved right now (and what the screen says about it).
    const snapshot = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rec-calories-v1')), today = CHADQuest.dayKey(), d = CHADQuest.daily(s, today), st = CHADQuest.stats(s, today);
      return { journal: s, score: d.score, grade: d.grade, streak: st.streak, week: st.week.total, water: CHADQuest.waterStreak(s, today), shownStreak: document.getElementById('home-streak').getAttribute('aria-label'), left: document.getElementById('left-line').getAttribute('aria-label') };
    });
    const paths = [];
    async function reversible(name, act, check) {
      const before = await snapshot();
      await act();
      const after = await snapshot();
      assert.notDeepEqual(after.journal, before.journal, name + ': the action changed something');
      if (check) await check(after.journal, before.journal, after, before);
      await tap(toast()); assert.match(await page.locator('#undo-toast').innerText(), /Undone/, name + ': Undo confirms');
      assert.deepEqual(await snapshot(), before, name + ': Undo restores the exact journal, streaks and score');
      await tap(toast()); assert.deepEqual(await snapshot(), after, name + ': Redo gives the change back exactly');
      await tap(toast()); assert.deepEqual(await snapshot(), before, name + ': and Undo again');
      paths.push(name);
    }
    const base = await snapshot();
    assert.equal(base.streak, 48); assert.equal(base.shownStreak, '48 day streak'); assert.equal(base.water, 3);

    // Meals: the card on top, a switch and a remove in Later today, the long-press sheet.
    await reversible('meal log (the card on top)', () => tap(page.locator('#now [data-slot=L][data-tier=S]')), j => assert.equal(j.questsV5[key].picks.L, 'S'));
    await tap(page.locator('#now [data-slot=L][data-tier=S]'));                               // keep lunch logged
    await later(true);
    await reversible('meal switch (Later today)', () => again(page.locator('#later-more [data-slot=L][data-tier=F]')),
      j => { assert.equal(j.questsV5[key].picks.L, 'F'); assert.equal(j.entries.filter(e => e.planSlot === 'L' && e.day === key).length, 1); });
    await reversible('meal remove (tap the logged option)', () => again(page.locator('#later-more [data-slot=L][data-tier=S]')),
      j => { assert.equal(j.questsV5[key].picks.L, undefined); assert.equal(j.entries.some(e => e.planSlot === 'L' && e.day === key), false); });
    await reversible('meal log from the long-press sheet', async () => {
      await page.waitForTimeout(450); const card = page.locator('#later-more [data-slot=D][data-tier=M]'); await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log dinner' }));
    }, j => assert.equal(j.questsV5[key].picks.D, 'M'));
    // Water: from nothing (the day's water did not exist before), and again.
    await later(false);
    await reversible('water add', () => tap(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, .5));
    await tap(page.locator('.water-row')); await again(page.locator('.water-row'));
    await reversible('water add again', () => again(page.locator('.water-row')), j => assert.equal(j.questsV5[key].water, 1.5));
    // The habits on and off (Later today).
    await later(true);
    for (const field of ['cardio', 'steps', 'sleep', 'electrolyte']) await reversible(field + ' on', () => again(page.locator(`#later-more [data-quest=${field}]`)), j => assert.equal(j.questsV5[key][field], true));
    await again(page.locator('#later-more [data-quest=steps]'));
    await reversible('steps off', () => again(page.locator('#later-more [data-quest=steps]')), j => assert.equal(j.questsV5[key].steps, false));
    await later(false);
    // The favourites and + Food.
    await reversible('YoPRO pouch (Quick log)', () => again(page.locator('#quick [data-fav=yopro-pouch]')), j => assert.equal(j.entries.at(-1).fav, 'yopro-pouch'));
    await reversible('Gochi noodle (Quick log)', () => again(page.locator('#quick [data-fav=gochi-noodle]')), j => assert.equal(j.entries.at(-1).kcal, 225));
    await reversible('+ Food, typed in', async () => {
      await again(page.locator('#add-food')); await tap(page.locator('#builder-type')); await page.locator('#result-name').fill('Synthetic wrap'); await page.locator('#result-kcal').fill('350'); await page.locator('#result-protein').fill('25');
      await tap(page.locator('#confirm-log')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    }, j => { const e = j.entries.at(-1); assert.deepEqual([e.name, e.kcal, e.protein, e.planSlot], ['Synthetic wrap', 350, 25, undefined]); });
    // A custom snack from the add-food sheet, and saving it as my meal (its Undo is in the sheet: checked in v11-meals-check).
    await later(true);
    await reversible('custom meal (Log snack)', async () => { await again(page.locator('#later-more [data-later-slot=P] [data-custom]')); await tap(page.locator('#builder-chips [data-food=yopro]')); await tap(page.locator('#builder-log')); }, j => assert.equal(j.questsV5[key].picks.P, 'C'));
    await later(false);
    // A missed day (Settings › Selected day): the journey streak restarts the day after, and comes back with Undo.
    await page.evaluate(() => CHADUX.goTo('2026-11-21')); await view('settings');
    await reversible('missed day', async () => { await page.locator('#missed-day').check(); }, (j, b, after) => { assert.equal(j.questsV5['2026-11-21'].missed, true); assert.equal(after.streak, 3); assert.equal(after.shownStreak, '3 day streak'); });
    await page.locator('#close-settings').tap(); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    // Muay Thai on a past Wednesday (Later today), and Mark done in the Gym tab.
    await page.evaluate(() => CHADUX.goTo('2026-11-18')); await later(true);
    await reversible('Muay Thai done', () => again(page.locator('#later-more [data-quest=training]')), j => assert.equal(j.questsV5['2026-11-18'].training, true));
    await page.evaluate(() => CHADUX.goTo('2026-11-23')); await view('training');
    await reversible('Mark done (Gym tab)', () => again(page.locator('.training-level [data-quest=training]')), j => assert.equal(j.questsV5['2026-11-23'].training, true));
    // Gym mode on today's Pull: start, a set, a removed set, the finish.
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    await reversible('workout start', () => again(page.locator('.is-today [data-gym-start]')), j => assert.deepEqual(j.questsV5[key].workout.sets, []));
    await tap(page.locator('.is-today [data-gym-start]'));
    await reversible('workout set', () => tap(page.locator('#gym-go')), j => { assert.equal(j.questsV5[key].workout.sets.length, 1); assert.equal(j.questsV5[key].workout.sets[0].x, 'Pull-ups'); });
    await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]'));
    await reversible('workout set removed (tap its dot)', () => tap(page.locator('#gym-dots [data-set="0"]')), j => assert.equal(j.questsV5[key].workout.sets.length, 0));
    await tap(page.locator('#gym-go'));
    await reversible('workout finish', () => tap(page.locator('[data-gym=finish]')), (j, b, after, was) => { assert.ok(j.questsV5[key].workout.end); assert.equal(j.questsV5[key].training, true); assert.equal(after.score - was.score, 3, 'the session counts (hidden score)'); });
    if (await page.locator('#gym').isVisible()) await tap(page.locator('[data-gym=close]'));
    await view('today');
    // The food list (under the line): delete (back in the same place), log again; a plan meal on another day.
    await details(true);
    await reversible('delete an entry', async () => { await tap(page.locator('#entries [data-entry=synthetic-coffee] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => assert.equal(j.entries.some(e => e.id === 'synthetic-coffee'), false));
    await reversible('log again', async () => { await details(true); await tap(page.locator('#entries [data-entry=synthetic-bar] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log again' })); }, j => assert.equal(j.entries.at(-1).source, 'repeat'));
    await page.evaluate(() => CHADUX.goTo('2026-11-23')); await details(true);
    await reversible('delete a plan meal on another day', async () => { await tap(page.locator('#entries [data-entry="plan-2026-11-23-D"] .entry-open')); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Delete' })); }, j => { assert.equal(j.questsV5['2026-11-23'].picks.D, undefined); assert.equal(j.entries.some(e => e.id === 'plan-2026-11-23-D'), false); });
    await details(false); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    // Settings: today's water and weigh-in, goals, phase dates.
    await view('settings');
    await reversible('water in Settings', async () => { await page.locator('#water-amount').fill('3.2'); await page.locator('#water-amount').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].water, 3.2));
    await reversible('weigh-in', async () => { await page.locator('#local-weight').fill('70.4'); await page.locator('#local-weight').dispatchEvent('change'); }, j => assert.equal(j.questsV5[key].weight, 70.4));   // synthetic
    await reversible('goals', async () => { await page.locator('#daily-target').fill('2100'); await tap(page.locator('#settings-form button')); }, j => assert.equal(j.target, 2100));
    assert.equal(await page.locator('#daily-target').inputValue(), '1900', 'the form shows the restored goal');
    await reversible('phase dates', async () => { await page.locator('#phase-end-0').fill('2026-12-01'); await tap(page.getByRole('button', { name: 'Save phase dates' })); }, j => assert.equal(j.phaseEnds[0], '2026-12-01'));
    await page.locator('#close-settings').tap();
    // A Reset add-on (a Reset-phase day), in Quick log.
    await page.clock.setFixedTime(new Date('2026-12-08T12:00:00+09:30')); await page.reload();
    await reversible('add-on', () => tap(page.locator('#quick [data-addon=shake]')), j => assert.ok(j.entries.some(e => e.id === 'addon-2026-12-08-shake')));
    await page.clock.setFixedTime(new Date(NOON)); await page.reload();
    console.log('PASS every Undo path (' + paths.length + '): ' + paths.join(', ') + ' — exact journal, streaks and (hidden) score back each time; Redo exact; Undo again exact.');

    // Accidental taps. Lunch goes back to not logged, so it is the thing to do at noon.
    if ((await saved(page)).questsV5?.[key]?.picks?.L) { await later(true); await again(page.locator('#later-more [data-slot=L][data-tier=' + (await saved(page)).questsV5[key].picks.L + ']')); await later(false); }
    await page.waitForTimeout(450); assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');
    const clean = await snapshot();
    // 1. A quick double tap on a card logs it once, and never logs what slides into its place.
    await page.evaluate(() => scrollTo(0, 0)); const lunch = page.locator('#now [data-slot=L][data-tier=S]'); const lb = await lunch.boundingBox();
    await page.touchscreen.tap(lb.x + 40, lb.y + 30); await page.touchscreen.tap(lb.x + 40, lb.y + 30);
    let j = await saved(page);
    assert.equal(j.questsV5[key].picks.L, 'S', 'a double tap on a meal still logs it once'); assert.equal(j.questsV5[key].water, clean.journal.questsV5[key].water, 'and never adds the water that took its place');
    // 2. A double tap on Undo undoes once and never lands on the Redo that takes its place.
    const button = await toast().boundingBox(); await page.waitForTimeout(400);
    await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2); await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
    assert.equal((await saved(page)).questsV5[key].picks?.L, undefined, 'one Undo, not Undo + Redo');
    assert.deepEqual((await snapshot()).journal, clean.journal);
    // 3. Switching on and off again and again leaves the day exactly as it was.
    await later(true);
    for (let i = 0; i < 3; i++) {
      await again(page.locator('#later-more [data-quest=cardio]')); await again(page.locator('#later-more [data-quest=cardio]'));
      await again(page.locator('#quick [data-fav=yopro-pouch]')); await tap(toast());
    }
    const farmed = await snapshot();
    assert.equal(farmed.score, clean.score); assert.equal(farmed.streak, clean.streak); assert.equal(farmed.journal.entries.length, clean.journal.entries.length, 'no favourite left behind');
    assert.equal(farmed.journal.questsV5[key].cardio, false, 'switched off again (the field is kept as false, as in v10)');
    // 4. Undo and Redo back and forth: the change of one log, never more.
    await later(false); await page.waitForTimeout(450); await tap(page.locator('#now [data-slot=L][data-tier=S]')); const once = await snapshot();
    for (let i = 0; i < 4; i++) { await tap(toast()); await tap(toast()); }
    assert.deepEqual((await snapshot()).journal, once.journal, 'four Undo/Redo rounds later: exactly one lunch');
    // 5. Celebrations happen once: a journey milestone (25 Nov is Day 49: seven weeks).
    const hideBanner = () => page.evaluate(() => { document.getElementById('celebration').hidden = true; });
    await hideBanner();
    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+09:30')); await page.reload();
    assert.match(await page.locator('#celebration').innerText(), /7 weeks strong · 49-day streak/); await hideBanner();
    await page.reload(); assert.equal(await page.locator('#celebration').isVisible(), false, 'a milestone is celebrated once');
    assert.doesNotMatch(await page.locator('body').innerText(), /\bXP\b|S rank|\blevel \d|\/17/i, 'no XP, rank, level or score anywhere');
    assert.deepEqual(errors, []);
    console.log('PASS accidental taps: a double tap on a card logs once and never logs what slides into its place; a double tap on Undo undoes once (Redo is armed after a beat); 3 rounds of on/off for a habit and a favourite leave the day as it was; 4 Undo/Redo rounds keep exactly one log; the 7-week journey milestone is celebrated once; no XP, rank, level or score on screen; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
