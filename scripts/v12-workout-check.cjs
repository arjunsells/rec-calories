// Gym mode end to end in v12, on a Monday at 16:20 in Darwin (Push): Start from the session card on Today (the thing to
// do now, under the water card) -> every set of every exercise -> the rest timer (+15 s, Skip, and true time through a
// locked screen) -> Finish (no XP) -> dinner on top of Today -> Progress (v12 lists five workouts, then "Show N more",
// and the six most recent records, then "Show all N": the new workout and its records come first) -> Undo and Redo of
// a set, the finish and the start. Also: the wake lock is held while Gym mode is open and taken again when the page
// comes back; a haptic tick on each set; a closed app resumes mid-workout (offline, from the shell); 56 px targets
// (72 px for the main ones) within thumb reach. Synthetic data in a disposable profile only.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE } = require('./harness.cjs');
const MONDAY = '2026-11-23', START = '2026-11-23T16:20:00+09:30';

(async () => {
  const server = await serve(8103), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, ...IPHONE, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = watch(page, text => text.includes('net::ERR_INTERNET_DISCONNECTED') || text.includes('net::ERR_FAILED'));
    process.on('exit', () => { if (process.exitCode && errors.length) console.error('Page errors seen before the failure: ' + errors.join(' | ')); });
    await page.addInitScript(() => {
      // A wake lock the test can see: requests, active sentinels, releases. Like the browser, a hidden page loses it.
      window.qaLocks = { requests: 0, active: 0, released: 0 };
      const live = new Set();
      Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get() { return { request: async type => {
        qaLocks.requests++; qaLocks.active++; const listeners = [];
        const s = { type, released: false, addEventListener: (t, fn) => { if (t === 'release') listeners.push(fn); }, release: async () => { if (s.released) return; s.released = true; qaLocks.active--; qaLocks.released++; live.delete(s); listeners.forEach(fn => fn()); } };
        live.add(s); return s; } }; } });
      document.addEventListener('visibilitychange', () => { if (document.hidden) [...live].forEach(s => s.release()); });
      window.qaHide = hidden => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); };
      window.qaBuzz = []; Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(p) { window.qaBuzz.push(p); return true; } });
      window.qaTaps = 0; document.addEventListener('click', () => { window.qaTaps++; }, true);
    });
    await page.clock.install({ time: new Date(START) });
    await page.goto('http://127.0.0.1:8103/');
    // Last Monday's Push (finished) and an older v9 top set: what "last time" and the records come from. The rest of last
    // week (no exercise in common with Push): Tuesday's Pull with its sets (seven more records), and Thursday to Saturday
    // marked done; so Progress has more than v12 shows at first (five workouts, six records).
    await page.evaluate(() => {
      const s = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
      const t = (x, kg, reps, n, day = '2026-11-16') => Array.from({ length: n }, (_, i) => ({ x, kg, reps, at: Date.parse(day + 'T16:10:00+09:30') + (i + x.length) * 60000 }));
      s.questsV5['2026-11-09'] = { topSets: { 'Incline DB press': { kg: 20, reps: 10 } } };
      s.questsV5['2026-11-16'] = { training: true, workout: { id: 'push', start: Date.parse('2026-11-16T16:02:00+09:30'), end: Date.parse('2026-11-16T16:58:00+09:30'), sets: [...t('Incline DB press', 22.5, 8, 3), ...t('Machine chest press', 50, 10, 3), ...t('Low-to-high cable fly', 12.5, 12, 3), ...t('Seated DB shoulder press', 20, 8, 2), ...t('Cable side raise', 7.5, 15, 4), ...t('Overhead cable triceps ext', 20, 12, 3)] } };
      const tue = '2026-11-17';
      s.questsV5[tue] = { training: true, workout: { id: 'pull', start: Date.parse(tue + 'T16:02:00+09:30'), end: Date.parse(tue + 'T16:57:00+09:30'), sets: [...t('Pull-ups', 0, 8, 3, tue), ...t('Chest-supported row', 50, 10, 3, tue), ...t('Single-arm pulldown', 30, 12, 2, tue), ...t('Rear delt fly', 8, 15, 3, tue), ...t('DB shrugs', 32.5, 12, 3, tue), ...t('Incline DB curl', 12.5, 10, 3, tue), ...t('Hanging leg raise', 0, 12, 3, tue)] } };
      for (const key of ['2026-11-19', '2026-11-20', '2026-11-21']) s.questsV5[key] = { training: true };
      localStorage.setItem('rec-calories-v1', JSON.stringify(s));
    });
    await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
    // The shell must control the page before the offline step: one more reload if the worker activated late.
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const taps = () => page.evaluate(() => window.qaTaps), zero = () => page.evaluate(() => { window.qaTaps = 0; });
    const workout = async () => (await saved(page)).questsV5?.[MONDAY]?.workout;
    const gymOpen = () => page.locator('#gym').isVisible();
    const toast = () => page.locator('#undo-toast button');
    const restText = () => page.locator('#gym-rest-time').innerText();

    // 1. Today at 16:20 is the gym window: the session is the one thing to do, with one big Start (water, not yet drunk,
    // has its own card above it and is never the thing to do now in v12).
    const hero = page.locator('#now');
    assert.equal(await hero.getAttribute('data-now'), 'session'); assert.match(await hero.innerText(), /Push[\s\S]*6 exercises · 60 min · then 2 km Zone 2/); assert.match(await hero.innerText(), /Now · 4–6 pm/i);
    assert.equal(await page.locator('#water-slot #water12').count(), 1, 'the water card'); assert.equal(await page.locator('#now .water-row').count(), 0);
    const startBox = await page.locator('#now [data-gym-start]').boundingBox(); assert.ok(startBox.height >= 72, 'Start is a big button: ' + startBox.height);
    assert.equal(await page.locator('#now .meal-pick').count(), 0, 'no meal competes with the session at 4 pm');
    // Start, Undo (gone again), Redo (in progress: Resume), Resume.
    await zero(); await tap(page.locator('#now [data-gym-start]')); assert.equal(await taps(), 1, 'one tap starts');
    assert.equal(await gymOpen(), true); assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-gym')), true);
    assert.deepEqual({ ...(await workout()), start: 0 }, { id: 'push', start: 0, sets: [] });
    assert.equal(await page.evaluate(() => document.querySelector('main').inert), true, 'the page behind is inert');
    assert.equal(await page.evaluate(() => qaLocks.active), 1, 'the screen stays awake');
    await tap(toast()); assert.equal(await workout(), undefined, 'Undo takes the start back'); assert.equal(await gymOpen(), false);
    assert.equal(await page.evaluate(() => qaLocks.active), 0, 'and lets the screen sleep');
    await tap(toast()); assert.ok(await workout(), 'Redo'); assert.match(await page.locator('#now [data-gym-start]').innerText(), /Resume/);
    await tap(page.locator('#now [data-gym-start]')); assert.equal(await gymOpen(), true);

    // 2. One exercise at a time: name, prescription, the overload hint, kg/reps from last time.
    assert.equal(await page.locator('#gym-name').innerText(), 'Incline DB press'); assert.match(await page.locator('#gym-rx').innerText(), /3 × 6–10 reps · rest 2 min/);
    assert.equal(await page.locator('#gym-hint').innerText(), 'Last 22.5 kg × 8 → try 9 reps, then 25 kg');
    assert.equal(await page.locator('#gym-kg').inputValue(), '22.5'); assert.equal(await page.locator('#gym-reps').inputValue(), '9');
    assert.equal(await page.locator('#gym-dots .ch-gym__dot').count(), 3);
    // Every control is big and the main ones are within thumb reach at the bottom.
    const sizes = await page.evaluate(() => [...document.querySelectorAll('#gym button')].filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden').map(b => ({ t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24), w: b.offsetWidth, h: b.offsetHeight, top: b.getBoundingClientRect().top })));
    assert.deepEqual(sizes.filter(s => s.w < 56 || s.h < 56), [], 'every Gym mode control is at least 56 px');
    const go = await page.locator('#gym-go').boundingBox(); assert.ok(go.height >= 72 && go.width > 300, 'the main button: ' + JSON.stringify(go)); assert.ok(go.y > 812 * 0.6, 'in the bottom of the screen');
    assert.ok((await page.locator('.ch-gym__step [data-gym="kg+"]').boundingBox()).y > 812 * 0.5, 'steppers within thumb reach');
    assert.equal(await page.locator('#gym').evaluate(e => getComputedStyle(e).color), 'rgb(255, 255, 255)', 'high contrast: white on near-black');
    // +/- 2.5 kg steppers.
    await tap(page.locator('[data-gym="kg+"]')); assert.equal(await page.locator('#gym-kg').inputValue(), '25'); await tap(page.locator('[data-gym="kg-"]')); assert.equal(await page.locator('#gym-kg').inputValue(), '22.5');

    // 3. Log a set: one tap, a haptic tick, the dot fills, the rest timer starts (2 min for this press).
    await page.evaluate(() => { window.qaBuzz.length = 0; }); await zero();
    await tap(page.locator('#gym-go')); assert.equal(await taps(), 1);
    let w = await workout(); assert.equal(w.sets.length, 1); assert.deepEqual({ ...w.sets[0], at: 0 }, { x: 'Incline DB press', kg: 22.5, reps: 9, at: 0 });
    assert.ok(await page.evaluate(() => window.qaBuzz.length) >= 1, 'haptic on the set');
    assert.equal(await page.locator('#gym-dots .ch-gym__dot.is-done').count(), 1); assert.match(await page.locator('#undo-toast').innerText(), /Set 1 · 22\.5 kg × 9/);
    assert.match(await page.locator('#celebration').innerText(), /Personal record · Incline DB press/, '22.5 × 9 beats last week');
    assert.equal(await page.locator('#gym-rest').isVisible(), true); assert.equal(await restText(), '2:00'); assert.match(await page.locator('#gym-rest-next').innerText(), /Next: set 2 of 3 · Incline DB press/);
    await page.clock.runFor(30000); await page.evaluate(() => qaHide(false)); assert.equal(await restText(), '1:30');
    await tap(page.locator('[data-gym=more]')); assert.equal(await restText(), '1:45', '+15 s');
    // The phone locks: no timers run, the clock moves on 60 s. Back on screen, the timer shows true time, and the wake
    // lock the browser dropped is taken again.
    await page.evaluate(() => qaHide(true)); assert.equal(await page.evaluate(() => qaLocks.active), 0);
    await page.clock.setSystemTime(new Date(await page.evaluate(() => Date.now()) + 60000));
    await page.evaluate(() => qaHide(false)); assert.equal(await restText(), '0:45', 'timestamps, not counted ticks');
    await page.waitForFunction(() => qaLocks.active === 1); assert.ok(await page.evaluate(() => qaLocks.requests) >= 3, 'the lock is requested again');
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.clock.runFor(46000);
    assert.equal(await restText(), 'Go', 'rest over'); assert.ok(await page.evaluate(() => window.qaBuzz.some(p => Array.isArray(p))), 'a success buzz when the rest ends');
    await page.clock.runFor(1600); assert.equal(await page.locator('#gym-rest').isVisible(), false);

    // 4. Set 2, Skip the rest; tap a logged dot to take that set off; Undo puts it back.
    await tap(page.locator('#gym-go')); assert.equal((await workout()).sets.length, 2); await tap(page.locator('[data-gym=skip]')); assert.equal(await page.locator('#gym-rest').isVisible(), false, 'Skip');
    await tap(page.locator('#gym-dots [data-set="0"]')); assert.equal((await workout()).sets.length, 1, 'a logged dot removes its set'); assert.match(await page.locator('#undo-toast').innerText(), /Set 1 removed/);
    await tap(toast()); w = await workout(); assert.equal(w.sets.length, 2, 'Undo'); assert.equal(w.sets[0].reps, 9, 'back in its place');

    // 5. The app closes mid-workout, offline: it opens straight back into Gym mode, same exercise, the sets intact.
    await tap(page.locator('[data-gym=next]')); assert.equal(await page.locator('#gym-name').innerText(), 'Machine chest press');
    assert.equal(await page.locator('#gym-hint').innerText(), 'Last 50 kg × 10 → try 11 reps, then 52.5 kg');
    await tap(page.locator('#gym-go')); assert.equal((await workout()).sets.length, 3);
    await context.setOffline(true); await page.reload(); await page.waitForFunction(() => window.CHADGym);
    assert.equal(await gymOpen(), true, 'resumed'); assert.equal(await page.locator('#gym-name').innerText(), 'Machine chest press');
    assert.equal(await page.locator('#gym-dots .is-done').count(), 1); assert.equal(await page.locator('#gym-rest').isVisible(), true, 'the rest timer carried on');
    await context.setOffline(false);
    // Minimise: back to Today, which offers Resume.
    await tap(page.locator('[data-gym=close]')); assert.equal(await gymOpen(), false); assert.match(await page.locator('#now').innerText(), /Resume[\s\S]*3 of 18 sets/);
    assert.equal(await page.evaluate(() => qaLocks.active), 0, 'no wake lock once minimised');
    await tap(page.locator('#now [data-gym-start]')); assert.equal(await page.locator('#gym-name').innerText(), 'Machine chest press', 'Resume opens where it was');

    // 6. Every remaining set: one tap each (kg and reps are already there), the next exercise slides in by itself.
    let guard = 0, gold = false;
    while (guard++ < 60) {
      const label = await page.locator('#gym-go').innerText();
      if (/Finish workout/.test(label)) { gold = await page.locator('#gym-go').evaluate(b => b.classList.contains('ch-gym__go--gold')); break; }
      if (/Log set/.test(label) && !(await page.locator('#gym-kg').inputValue())) await page.locator('#gym-kg').fill('20');
      await tap(page.locator('#gym-go')); await page.clock.runFor(800);
    }
    w = await workout(); assert.equal(w.sets.length, 18, 'all 18 Push sets'); assert.equal(gold, true, 'then Finish, in gold');
    assert.deepEqual([...new Set(w.sets.map(s => s.x))], ['Incline DB press', 'Machine chest press', 'Low-to-high cable fly', 'Seated DB shoulder press', 'Cable side raise', 'Overhead cable triceps ext']);
    assert.equal(await page.locator('#gym-rest').isVisible(), false, 'no rest after the very last set');

    // 7. Finish: volume, time, sets, records, and what is next (no XP any more). Then Done.
    await zero(); await tap(page.locator('#gym-go')); assert.equal(await taps(), 1);
    w = await workout(); assert.ok(w.end > w.start); assert.equal((await saved(page)).questsV5[MONDAY].training, true);
    assert.equal(await page.locator('#gym-done').isVisible(), true); assert.equal(await page.locator('#gym-done-title').innerText(), 'Push done');
    const expected = await page.evaluate(key => CHADTrain.summary(JSON.parse(localStorage.getItem('rec-calories-v1')), key), MONDAY);
    assert.equal(await page.locator('#gym-done-xp').count(), 0); assert.doesNotMatch(await page.locator('#gym-done').innerText(), /\bXP\b/, 'no XP on the finish screen');
    assert.equal(await page.locator('#gym-done-volume').innerText(), Math.round(expected.volume).toLocaleString('en-AU'));
    assert.equal(await page.locator('#gym-done-sets').innerText(), '18'); assert.equal(await page.locator('#gym-done-time').innerText(), String(expected.minutes));
    assert.ok(expected.prs.length >= 1); assert.match(await page.locator('#gym-done-prs').innerText(), /Incline DB press/); assert.match(await page.locator('#gym-done-next').innerText(), /Next: 2 km Zone 2/);
    assert.ok((await page.locator('[data-gym=done]').boundingBox()).height >= 72);
    await tap(page.locator('[data-gym=done]')); assert.equal(await gymOpen(), false); assert.equal(await page.evaluate(() => qaLocks.active), 0);
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'D', 'the session done: dinner is the thing to do'); assert.equal(await page.locator('[data-gym-start]').count(), 0, 'no Start left anywhere');
    await tap(page.locator('#later-toggle')); assert.match(await page.locator('#later-more .ch-later__session').innerText(), new RegExp('Push[\\s\\S]*Done · ' + expected.minutes + ' min'));

    // 8. History and records. v12 lists five workouts (newest first), then "Show N more"; and the six most recent records,
    // then "Show all N". This workout and its records are on top.
    await tap(page.locator('[data-view=history]'));
    const row = page.locator(`#workouts [data-workout="${MONDAY}"]`);
    assert.match(await row.innerText(), /Mon 23 Nov[\s\S]*Push/); assert.match(await row.innerText(), new RegExp(Math.round(expected.volume).toLocaleString('en-AU') + ' kg · ' + expected.minutes + ' min'));
    assert.match(await row.innerText(), /PR/); assert.match(await page.locator('#workout-count').innerText(), /^6 sessions$/i);
    const shownWorkouts = () => page.locator('#workouts [data-workout]').evaluateAll(n => n.map(b => b.dataset.workout));
    assert.deepEqual(await shownWorkouts(), [MONDAY, '2026-11-21', '2026-11-20', '2026-11-19', '2026-11-17'], 'five, newest first');
    assert.equal(await page.locator('#workouts .entry--more button').innerText(), 'Show 1 more'); await tap(page.locator('#workouts .entry--more button'));
    assert.deepEqual((await shownWorkouts()).filter(k => k === MONDAY || k === '2026-11-16'), [MONDAY, '2026-11-16'], 'this week and last week');
    assert.equal(await page.locator('#workouts .workout-row').count(), 6); assert.equal(await page.locator('#workouts .entry--more').count(), 0);
    const shownRecords = () => page.locator('#records [data-record]').evaluateAll(n => n.map(r => r.dataset.record));
    assert.deepEqual(await shownRecords(), ['Incline DB press', 'Machine chest press', 'Low-to-high cable fly', 'Seated DB shoulder press', 'Cable side raise', 'Overhead cable triceps ext'], 'the six most recent records: today\'s');
    assert.match(await page.locator('#records [data-record="Incline DB press"]').innerText(), /22\.5 kg × 9[\s\S]*e1RM 29\.3/);
    assert.match(await page.locator('#pr-count').innerText(), /^13 exercises$/i); assert.equal(await page.locator('#records-toggle').innerText(), 'Show all 13');
    await tap(page.locator('#records-toggle')); assert.equal((await shownRecords()).length, 13); assert.match(await page.locator('#records [data-record="Pull-ups"]').innerText(), /8 reps[\s\S]*bodyweight/i);
    assert.equal(await page.locator('#records-toggle').getAttribute('aria-expanded'), 'true'); assert.equal(await page.locator('#records-toggle').innerText(), 'Show fewer');
    await tap(row); assert.match(await page.locator('#detail-sheet').innerText(), /Incline DB press[\s\S]*22\.5×9/); await page.keyboard.press('Escape');

    // 9. Undo the finish (the toast is still up): the workout is open again, history and records follow. Redo.
    await tap(page.locator('[data-view=today]'));
    assert.match(await page.locator('#undo-toast').innerText(), /Push done · 18 sets/);
    await tap(toast()); w = await workout(); assert.equal(w.end, undefined); assert.equal(w.sets.length, 18); assert.equal((await saved(page)).questsV5[MONDAY].training, undefined);
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'session'); assert.match(await page.locator('#now').innerText(), /Resume/);
    await tap(toast()); assert.ok((await workout()).end, 'Redo'); assert.equal((await saved(page)).questsV5[MONDAY].training, true);
    await tap(page.locator('[data-view=history]')); assert.equal(await page.locator(`#workouts [data-workout="${MONDAY}"]`).count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS v12 Gym mode: Start from the 4 pm session card on Today (the thing to do now, water on its own card) in 1 tap (Undo/Redo/Resume), one exercise at a time with prescription, "Last 22.5 kg × 8 → try 9 reps, then 25 kg" and pre-filled kg/reps, ±2.5 kg; a set = 1 tap with haptic, dot and toast; rest 2:00 with +15 s, Skip, true time through a locked screen and a success buzz; dot tap removes a set, Undo restores it in place; wake lock held, dropped when hidden, taken again, released on minimise/finish; resumed after a reload offline with the rest timer running; all 18 sets, auto-advance, gold Finish; finish screen (no XP) with volume, minutes, sets, PRs, next cardio, then dinner on top; Progress: the new workout first of five (date, session, volume, duration, PR) then "Show 1 more" with last week\'s, its six records first (est 1RM) then "Show all 13"; Undo/Redo of the finish; 56 px targets, 72 px main buttons in thumb reach; zero errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
