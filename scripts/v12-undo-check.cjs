// Every change is reversible. For each path: do it, Undo, and the journal is exactly what it was (deep equal), with
// the same streak, water streak and (hidden) day score; Redo gives back exactly the changed journal. v12 paths: meals
// (the card on top, Later today, the long-press sheet, a custom meal), water (the #water12 card, never the thing to do
// now), the habits, the Quick log favourites, + Food (Type it -> the nutrition card -> Add to meal -> Log), a missed day,
// Muay Thai, Mark done, Gym mode (start, a set, a removed set, the finish), Recently eaten -> the nutrition card (Delete
// food, Log again, Done after editing the name, calories and servings, Done after renaming only (untouched values keep
// their exact stored form), the bookmark on and off, a plan meal deleted on another day), Settings (water, weigh-in,
// goals, phase dates) and a Reset add-on. Not changes, so never in the journal: the hero tap (eaten mode), and Done on a
// logged food left as it was (byte-identical journal, no toast, the Undo on screen kept). Then the accidental-tap cases:
// double taps (the card on top settling), a double tap on Undo, switching on and off, Undo/Redo rounds, celebrations once.
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
    // Three full days before today, and two other-food entries to change and delete.
    await page.evaluate(() => {
      const q = CHADQuest, s = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
      for (let n = 1; n <= 3; n++) { const k = q.shift('2026-11-24', -n); CHADPlan.forEach(slot => { const c = slot.choices[0]; s.entries.push({ id: 'plan-' + k + '-' + slot.id, day: k, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); }); s.questsV5[k] = { picks: { L: 'S', P: 'S', D: 'S' }, water: q.waterGoal(k), steps: true }; }
      s.entries.push({ id: 'synthetic-coffee', day: '2026-11-24', name: 'Synthetic flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Lunch', source: 'manual' }, { id: 'synthetic-bar', day: '2026-11-24', name: 'Synthetic protein bar', kcal: 200, protein: 20, carbs: 18, fat: 7, meal: 'Lunch', source: 'search' });
      // An older-style entry: decimal values (shown rounded on the card) and no portion.
      s.entries.push({ id: 'synthetic-soup', day: '2026-11-24', name: 'Synthetic soup', kcal: 182.2, protein: 12.35, carbs: 20.04, fat: 7.25, meal: 'Lunch', source: 'search' });
      localStorage.setItem('rec-calories-v1', JSON.stringify(s));
    });
    await page.reload();
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const toast = () => page.locator('#undo-toast button');
    const view = async name => { await page.waitForTimeout(450); if (name === 'settings') await page.locator('#open-settings').tap(); else await page.locator(`[data-view=${name}]`).tap(); };
    const later = async open => { if ((await page.locator('#later-toggle').getAttribute('aria-expanded') === 'true') !== open) await again(page.locator('#later-toggle')); };
    // v12: the food list is Recently eaten (#recent12); a row opens the nutrition card (#nutrition12, "Edit food").
    const card = () => page.waitForFunction(() => { const d = document.getElementById('nutrition12'); return d.open && d.dataset.state === 'ready' && !!document.getElementById('n12-kcal'); });
    const closed = () => page.waitForFunction(() => !document.getElementById('nutrition12').open);
    const openEntry = async id => { await again(page.locator(`#recent12 [data-entry="${id}"]`)); await card(); assert.equal(await page.locator('#nutrition12-title').textContent(), 'Edit food', id + ': a logged food opens in its card'); };
    const bookmark = () => page.locator('#nutrition12-save').getAttribute('aria-pressed');
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
    // v12: water is its own card above the thing to do now, all day; it is never the thing to do now (noon: lunch).
    assert.equal(await page.locator('#water-slot #water12[data-water]').count(), 1); assert.equal(await page.locator('#now [data-water]').count(), 0);
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');

    // The hero: a tap shows what was eaten, a second tap what is left. A view, never a change: nothing written, no Undo.
    const raw = () => page.evaluate(() => localStorage.getItem('rec-calories-v1'));
    const stored = await raw(); await page.evaluate(() => CHADUX.hideToast(true));
    await tap(page.locator('#left-line'));
    assert.equal(await page.locator('#left-line').getAttribute('aria-pressed'), 'true'); assert.match(await page.locator('#remaining-label').innerText(), /^Calories eaten$/i);
    assert.match(await page.locator('#phase-line').innerText(), /^of 1,900 kcal$/i); assert.match(await page.locator('#protein-left-label').innerText(), /^Protein eaten$/i);
    assert.equal(await raw(), stored, 'eaten mode writes nothing to the journal'); assert.equal(await page.locator('#undo-toast').isVisible(), false, 'and offers no Undo: nothing changed');
    await again(page.locator('#left-line'));
    assert.equal(await page.locator('#left-line').getAttribute('aria-pressed'), 'false'); assert.match(await page.locator('#remaining-label').innerText(), /^Calories left$/i);
    assert.equal(await raw(), stored); assert.equal(await page.locator('#undo-toast').isVisible(), false); assert.deepEqual(await snapshot(), base, 'back to what is left: exactly as before');

    // Meals: the card on top, a switch and a remove in Later today, the long-press sheet.
    await reversible('meal log (the card on top)', () => tap(page.locator('#now [data-slot=L][data-tier=S]')), j => assert.equal(j.questsV5[key].picks.L, 'S'));
    await tap(page.locator('#now [data-slot=L][data-tier=S]'));                               // keep lunch logged
    await later(true);
    await reversible('meal switch (Later today)', () => again(page.locator('#later-more [data-slot=L][data-tier=F]')),
      j => { assert.equal(j.questsV5[key].picks.L, 'F'); assert.equal(j.entries.filter(e => e.planSlot === 'L' && e.day === key).length, 1); });
    await reversible('meal remove (tap the logged option)', () => again(page.locator('#later-more [data-slot=L][data-tier=S]')),
      j => { assert.equal(j.questsV5[key].picks.L, undefined); assert.equal(j.entries.some(e => e.planSlot === 'L' && e.day === key), false); });
    await reversible('meal log from the long-press sheet', async () => {
      await page.waitForTimeout(450); const option = page.locator('#later-more [data-slot=D][data-tier=M]'); await option.scrollIntoViewIfNeeded(); const box = await option.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Log dinner' }));
    }, j => assert.equal(j.questsV5[key].picks.D, 'M'));
    // Water: the #water12 card, from nothing (the day's water did not exist before), and again. Never in #now.
    await later(false);
    await reversible('water add (the water card)', () => tap(page.locator('#water12')), async j => {
      assert.equal(j.questsV5[key].water, .5); assert.match(await page.locator('#undo-toast').innerText(), /500 mL water/);
      assert.match(await page.locator('#water12-value').innerText(), /^0\.5\s*\/\s*4\.5 L$/); assert.equal(await page.locator('#now [data-water]').count(), 0, 'water never moves into the thing to do now');
    });
    await tap(page.locator('#water12')); await again(page.locator('#water12'));
    await reversible('water add again', () => again(page.locator('#water12')), j => assert.equal(j.questsV5[key].water, 1.5));
    // The habits on and off (Later today).
    await later(true);
    for (const field of ['cardio', 'steps', 'sleep', 'electrolyte']) await reversible(field + ' on', () => again(page.locator(`#later-more [data-quest=${field}]`)), j => assert.equal(j.questsV5[key][field], true));
    await again(page.locator('#later-more [data-quest=steps]'));
    await reversible('steps off', () => again(page.locator('#later-more [data-quest=steps]')), j => assert.equal(j.questsV5[key].steps, false));
    await later(false);
    // The favourites, and + Food: Type it opens the nutrition card (empty calories, "Add to meal"), back to the sheet, Log.
    await reversible('YoPRO pouch (Quick log)', () => again(page.locator('#quick [data-fav=yopro-pouch]')), j => assert.equal(j.entries.at(-1).fav, 'yopro-pouch'));
    await reversible('Gochi noodle (Quick log)', () => again(page.locator('#quick [data-fav=gochi-noodle]')), j => assert.equal(j.entries.at(-1).kcal, 225));
    await reversible('+ Food, typed in (the card, Add to meal, Log)', async () => {
      await again(page.locator('#add-food')); await tap(page.locator('#builder-type')); await card();
      assert.equal(await page.locator('#n12-kcal').inputValue(), '', 'Type it: the calories start empty'); assert.match(await page.locator('#n12-done').innerText(), /^Add to meal$/i);
      await page.locator('#n12-name').fill('Synthetic wrap'); await page.locator('#n12-kcal').fill('350'); await page.locator('#n12-protein').fill('25');
      await tap(page.locator('#n12-done')); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
    }, j => { const e = j.entries.at(-1); assert.deepEqual([e.name, e.kcal, e.protein, e.planSlot], ['Synthetic wrap', 350, 25, undefined]); });
    // A custom snack from the add-food sheet, and saving it as my meal (its Undo is in the sheet: checked in v12-meals-check).
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
    // Recently eaten (v12, replaces the food list under the line): a row opens the nutrition card. Delete food (back in the
    // same place), Log again, Done after an edit (saved in place), the bookmark on and off; a plan meal on another day.
    await reversible('Delete food (Recently eaten › the card)', async () => { await openEntry('synthetic-coffee'); await tap(page.locator('#n12-delete')); await closed(); },
      async j => { assert.equal(j.entries.some(e => e.id === 'synthetic-coffee'), false); assert.match(await page.locator('#undo-toast').innerText(), /Synthetic flat white deleted/); assert.equal(await page.locator('#recent12 [data-entry=synthetic-coffee]').count(), 0); });
    assert.equal(await page.locator('#recent12 [data-entry=synthetic-coffee]').count(), 1, 'Undo puts the row back in Recently eaten');
    await reversible('Log again (Recently eaten › the card)', async () => { await openEntry('synthetic-bar'); await tap(page.locator('#n12-again')); await closed(); },
      j => { const e = j.entries.at(-1); assert.deepEqual([e.name, e.kcal, e.protein, e.carbs, e.fat, e.source, e.day], ['Synthetic protein bar', 200, 20, 18, 7, 'repeat', key]); });
    await reversible('Done after an edit (name, calories, servings)', async () => {
      await openEntry('synthetic-bar');
      await page.locator('#n12-name').fill('Synthetic bar, edited'); await page.locator('#n12-kcal').fill('250'); await tap(page.locator('#n12-more'));
      assert.equal(await page.locator('#n12-servings').textContent(), '1.5'); assert.equal(await page.locator('#n12-kcal').inputValue(), '375', '250 kcal a serving × 1.5');
      assert.match(await page.locator('#n12-done').innerText(), /^Done$/i);
      await tap(page.locator('#n12-done')); await closed();
    }, async (j, b) => {
      const at = b.entries.findIndex(e => e.id === 'synthetic-bar'), e = j.entries[at];
      assert.equal(j.entries.length, b.entries.length, 'saved in place, not logged again');
      assert.deepEqual([e.id, e.name, e.kcal, e.protein, e.carbs, e.fat, e.portion, e.source, e.meal, e.day], ['synthetic-bar', 'Synthetic bar, edited', 375, 30, 27, 10.5, '1.5 servings', 'search', 'Lunch', key]);
      assert.match(await page.locator('#undo-toast').innerText(), /Saved · Synthetic bar, edited · 375 kcal/);
    });
    assert.match(await page.locator('#recent12 [data-entry=synthetic-bar]').innerText(), /Synthetic protein bar[\s\S]*200 kcal/, 'Undo shows the food as it was');
    // Done on a logged food left as it was changes nothing: the journal string stays byte-identical, no toast, no new
    // Undo; an Undo already on screen (500 mL water) stays the one on screen and still undoes the water.
    const soupWas = (await saved(page)).entries.find(e => e.id === 'synthetic-soup'); assert.deepEqual([soupWas.kcal, soupWas.portion], [182.2, undefined]);
    await page.evaluate(() => CHADUX.hideToast(true)); let journalWas = await raw();
    await openEntry('synthetic-soup'); assert.equal(await page.locator('#n12-kcal').inputValue(), '182', '182.2 kcal is shown rounded on the card');
    await tap(page.locator('#n12-done')); await closed();
    assert.equal(await raw(), journalWas, 'Done on an untouched food: the journal string is byte-identical'); assert.equal(await page.locator('#undo-toast').isVisible(), false, 'no toast, no Undo');
    await again(page.locator('#water12')); const waterToast = await page.locator('#undo-toast').innerText(); assert.match(waterToast, /500 mL water/);
    const watered = await saved(page); journalWas = await raw();
    await openEntry('synthetic-soup'); await tap(page.locator('#n12-done')); await closed();
    assert.equal(await raw(), journalWas, 'untouched again: byte-identical');
    assert.equal(await page.locator('#undo-toast').isVisible(), true); assert.equal(await page.locator('#undo-toast').innerText(), waterToast, 'the Undo on screen is still the water’s');
    await tap(toast()); assert.match(await page.locator('#undo-toast').innerText(), /Undone/); assert.equal((await saved(page)).questsV5[key].water, watered.questsV5[key].water - .5, 'and it still undoes the water');
    // Only the name changed: kcal, protein, carbs and fat keep their exact stored form and no portion appears; Undo puts
    // back the exact entry (the journal string byte-identical).
    journalWas = await raw();
    await reversible('Done after renaming only', async () => {
      await openEntry('synthetic-soup'); await page.locator('#n12-name').fill('Synthetic soup, renamed'); await tap(page.locator('#n12-done')); await closed();
    }, async j => {
      assert.deepEqual(j.entries.find(e => e.id === 'synthetic-soup'), { ...soupWas, name: 'Synthetic soup, renamed' }, 'only the name changed: 182.2 kcal, 12.35 g protein, 20.04 g carbs, 7.25 g fat, no portion');
      assert.match(await page.locator('#undo-toast').innerText(), /Saved · Synthetic soup, renamed · 182 kcal/);
    });
    assert.equal(await raw(), journalWas, 'Undo restores the exact entry: the journal string is byte-identical');
    // The bookmark (Saved foods, savedFoods12): its Undo is in the bottom toast, seen once the card is closed.
    await reversible('bookmark on (the card)', async () => {
      await openEntry('synthetic-bar'); assert.equal(await bookmark(), 'false');
      await tap(page.locator('#nutrition12-save')); assert.equal(await bookmark(), 'true');
      await tap(page.locator('#nutrition12-close')); await closed();
    }, j => assert.deepEqual(j.savedFoods12.map(f => [f.name, f.kcal, f.protein, f.carbs, f.fat]), [['Synthetic protein bar', 200, 20, 18, 7]]));
    await openEntry('synthetic-bar'); assert.equal(await bookmark(), 'false', 'after Undo the card shows it unsaved');
    await tap(page.locator('#nutrition12-save')); await tap(page.locator('#nutrition12-close')); await closed();       // keep it saved
    assert.equal((await saved(page)).savedFoods12.length, 1);
    await reversible('bookmark off (the card)', async () => {
      await openEntry('synthetic-bar'); assert.equal(await bookmark(), 'true');
      await tap(page.locator('#nutrition12-save')); assert.equal(await bookmark(), 'false');
      await tap(page.locator('#nutrition12-close')); await closed();
    }, j => assert.equal(j.savedFoods12, undefined, 'the last bookmark gone: no empty list left behind'));
    await page.evaluate(() => CHADUX.goTo('2026-11-23'));
    await reversible('Delete food, a plan meal on another day', async () => { await openEntry('plan-2026-11-23-D'); await tap(page.locator('#n12-delete')); await closed(); },
      async j => { assert.equal(j.questsV5['2026-11-23'].picks.D, undefined); assert.equal(j.entries.some(e => e.id === 'plan-2026-11-23-D'), false); assert.match(await page.locator('#undo-toast').innerText(), /deleted · Yesterday/); });
    await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
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
    console.log('PASS v12 every Undo path (' + paths.length + '): ' + paths.join(', ') + ' — exact journal, streaks and (hidden) score back each time; Redo exact; Undo again exact. Not changes: the hero tap (eaten mode) and Done on an untouched logged food write nothing (byte-identical journal, no toast, the Undo on screen kept); renaming only keeps 182.2 kcal / 12.35 g exact and adds no portion. Water is the #water12 card, never the thing to do now.');

    // Accidental taps. Lunch goes back to not logged, so it is the thing to do at noon.
    if ((await saved(page)).questsV5?.[key]?.picks?.L) { await later(true); await again(page.locator('#later-more [data-slot=L][data-tier=' + (await saved(page)).questsV5[key].picks.L + ']')); await later(false); }
    await page.waitForTimeout(450); assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');
    const clean = await snapshot();
    // 1. A quick double tap on a card logs it once, and never acts on what slides into its place. v12: today's session
    //    (the workout left open above) takes lunch's place, its Resume button right under the finger on the Medium go-to;
    //    water has its own card and never moves into #now. Where Resume lands is measured first: log, measure, Undo.
    const medium = page.locator('#now [data-slot=L][data-tier=M]'), centre = () => medium.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await centre(); const mb = await medium.boundingBox();
    await page.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2);
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'session', 'the session slides into lunch’s place');
    const rb = await page.locator('#now [data-gym-start]').boundingBox(); assert.match(await page.locator('#now [data-gym-start]').innerText(), /^Resume/);
    await tap(toast()); await page.waitForTimeout(450); assert.deepEqual((await snapshot()).journal, clean.journal);
    await centre(); assert.deepEqual(await medium.boundingBox(), mb, 'the same place again');
    const top = Math.max(mb.y, rb.y), bottom = Math.min(mb.y + mb.height, rb.y + rb.height), x = rb.x + rb.width / 2, y = (top + bottom) / 2;
    assert.ok(bottom - top >= 20, 'Resume lands under a finger on the Medium go-to');
    await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y);
    let j = await saved(page);
    assert.equal(j.questsV5[key].picks.L, 'M', 'a double tap on a meal still logs it once'); assert.equal(j.entries.length, clean.journal.entries.length + 1, 'one lunch, nothing else');
    assert.equal(await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.closest('#now [data-gym-start]'), [x, y]), true, 'the second tap landed on Resume');
    assert.equal(await page.locator('#gym').isVisible(), false, 'which waits for the move to settle: Gym mode stays shut');
    assert.equal(JSON.stringify(j.questsV5[key].workout), JSON.stringify(clean.journal.questsV5[key].workout), 'and the workout is untouched');
    assert.equal(j.questsV5[key].water, clean.journal.questsV5[key].water, 'and no water is added');
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
    console.log('PASS v12 accidental taps: a double tap on a card logs once and never acts on what slides into its place (the second tap lands on the session’s Resume: no Gym mode, workout untouched, no water); a double tap on Undo undoes once (Redo is armed after a beat); 3 rounds of on/off for a habit and a favourite leave the day as it was; 4 Undo/Redo rounds keep exactly one log; the 7-week journey milestone is celebrated once; no XP, rank, level or score on screen; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
