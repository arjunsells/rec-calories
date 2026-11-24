// Screenshots from a disposable copy of the shell, with synthetic data only. No browser profile, user journal, key,
// measurement, medication or photo is read. Output goes OUTSIDE the repository (or into the ignored .qa folder).
//   node scripts/v10-screenshots.cjs            the final set at 375x812, light (Today also in dark) ->
//                                              ../rec-calories-shots (override with CHAD_SHOTS): v10-today-midday,
//                                              v10-today-gym, v10-today-dark, v10-workout-set, v10-rest-timer,
//                                              v10-finish, v10-custom-builder, v10-water, v10-progress
//   node scripts/v10-screenshots.cjs --review   every screen, light and dark, 375x812 and 375x667 -> .qa/v10-review
// Transient toasts are always dismissed before a capture, so nothing covers the picture.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, shellFiles, root: repo, IPHONE } = require('./harness.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chad-v10-shot-shell-'));
const review = process.argv.includes('--review');
const output = review ? path.join(repo, '.qa', 'v10-review') : process.env.CHAD_SHOTS || path.resolve(repo, '../rec-calories-shots');
for (const file of ['sw.js', ...shellFiles().filter(f => f !== './')]) { const dest = path.join(dir, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(repo, file), dest); }

// 47 days on the plan since Day 1 (8 Oct): lunch, dinner and the snack mostly Strict, water on target most days (the
// last 6 in a row), and three weeks of finished workouts with believable, slowly rising weights. Today depends on the
// picture.
function seed(today) {
  const q = CHADQuest, T = CHADTrain, state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  const meal = (key, id, tier) => { const slot = CHADPlan.find(s => s.id === id), c = slot.choices.find(c => c.tier === tier); state.entries.push({ id: 'plan-' + key + '-' + id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); return tier; };
  const base = { 'Incline DB press': 22.5, 'Machine chest press': 50, 'Low-to-high cable fly': 12.5, 'Seated DB shoulder press': 20, 'Cable side raise': 7.5, 'Overhead cable triceps ext': 20, 'Pull-ups': 0, 'Chest-supported row': 50, 'Single-arm pulldown': 30, 'Rear delt fly': 8, 'DB shrugs': 32.5, 'Incline DB curl': 12.5, 'Hanging leg raise': 0, 'Machine side raise': 30, 'Machine shoulder press': 45, 'Reverse pec deck': 35, 'EZ curl': 25, 'Pushdown': 25, 'Hammer curl': 14, 'Dips': 0, 'Cable crunch': 40, 'Smith incline': 50, 'T-bar or seal row': 45, 'Lat pulldown': 55, 'Straight-arm pulldown': 25, 'Side raise': 9, 'Hill sprints': 0, 'Hack squat': 80, 'RDL': 80, 'Leg press': 140, 'Seated leg curl': 45, 'Leg extension': 50, 'Calf raise': 70 };
  for (let n = 47; n >= 1; n--) {
    const key = q.shift(today, -n), tiers = n % 9 === 0 ? 'MSF' : n % 4 === 0 ? 'SMS' : 'SSS', d = { picks: {}, water: n <= 6 || n % 5 ? q.waterGoal(key) : 3, steps: n % 6 !== 0, sleep: n % 3 !== 0, electrolyte: n % 2 === 0 };
    if (n % 8 === 3) continue;                                                       // a few days with nothing logged: the journey still counts them
    ['L', 'D', 'P'].forEach((id, i) => { d.picks[id] = meal(key, id, tiers[i]); });
    const s = T.plan(key);
    if (n <= 21 && s.kind === 'gym') {
      const week = Math.floor((21 - n) / 7), start = Date.parse(key + 'T16:05:00+09:30'); let at = start + 6 * 60000; const sets = [];
      for (const e of s.ex) for (let k = 0; k < e.sets; k++) { const kg = e.kind === 'time' ? 0 : base[e.name] + (e.kind === 'kg' ? week * 2.5 : 0); sets.push({ x: e.name, kg, reps: e.kind === 'time' ? 12 : Math.max(e.reps[0], e.reps[0] + 1 + week - k), at }); at += (e.rest + 45) * 1000; }
      d.workout = { id: s.id, start, end: at + 60000, sets }; d.training = true; d.cardio = true;
    } else if (s.kind !== 'gym') { d.training = s.kind === 'class'; d.cardio = true; }
    state.questsV5[key] = d;
  }
  return state;
}
const lunchIn = (s, today) => { const c = CHADPlan[0].choices[0]; s.questsV5[today] = { picks: { L: 'S' }, water: 2.5, sleep: true }; s.entries.push({ id: 'plan-' + today + '-L', day: today, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: 'Lunch', source: 'plan', planSlot: 'L' }); return s; };
const SCENES = {
  // Noon: lunch is next, the two go-tos pinned first, yesterday's one says so.
  midday: today => { const s = seed(today); s.questsV5[today] = { water: 2, sleep: true }; return s; },
  // After lunch: the gym window (the session is the hero), or dinner with the best fit.
  afterLunch: today => lunchIn(seed(today), today),
  morning: today => { const s = seed(today); s.questsV5[today] = { water: 1.5 }; return s; }
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = await serve(8093, { dir }), browser = await launch(), made = [];
  try {
    const matrix = review ? [[375, 812, 'dark'], [375, 812, 'light'], [375, 667, 'dark'], [375, 667, 'light']] : [[375, 812, 'light'], [375, 812, 'dark']];
    for (const [width, height, theme] of matrix) {
      const tag = review ? `-${height}-${theme}` : '', finalDark = !review && theme === 'dark';
      const open = async (time, scene) => {
        const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage(), errors = watch(page);
        await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') }); await page.goto('http://127.0.0.1:8093/');
        // The seed and the scene run in the page, where the plan and the program live.
        await page.evaluate(([seedSource, sceneSource, lunchSource, today]) => { const seed = new Function('return ' + seedSource)(), lunchIn = new Function('return ' + lunchSource)(); const scene = new Function('seed', 'lunchIn', 'return ' + sceneSource)(seed, lunchIn); localStorage.setItem('rec-calories-v1', JSON.stringify(scene(today))); }, [seed.toString(), SCENES[scene].toString(), lunchIn.toString(), '2026-11-24']);
        await page.reload(); await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}' });
        await page.waitForTimeout(150);
        return { context, page, errors };
      };
      const quiet = page => page.evaluate(() => { CHADUX.hideToast(true); for (const id of ['message', 'celebration']) document.getElementById(id).hidden = true; const u = document.getElementById('builder-undo'); if (u) u.hidden = true; document.querySelector('.ch-app').removeAttribute('data-shield'); });
      const shoot = async (page, name) => {
        await quiet(page); await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ch-toast')].some(t => !t.hidden && t.textContent.trim() && getComputedStyle(t).display !== 'none')), false, name + ': no toast on the picture');
        const file = path.join(output, (review ? '' : 'v10-') + name + tag + '.png'); await page.screenshot({ path: file }); made.push(file);
      };
      const top = page => page.evaluate(() => scrollTo(0, 0));

      // Today at noon: lunch next with the go-tos; in dark too (the final set's dark picture).
      let { context, page, errors } = await open('12:20', 'midday');
      await shoot(page, finalDark ? 'today-dark' : 'today-midday');
      if (finalDark) { assert.deepEqual(errors, []); await context.close(); continue; }
      if (review) { await page.evaluate(() => scrollTo(0, 420)); await shoot(page, 'midday-meals'); }
      assert.deepEqual(errors, []); await context.close();

      // After lunch, 1 pm: dinner leads with what is left today and the best fit; + Custom opens the builder.
      ({ context, page, errors } = await open('13:00', 'afterLunch'));
      if (review) { await shoot(page, 'after-lunch'); await page.evaluate(() => scrollTo(0, 380)); await shoot(page, 'after-lunch-dinner'); await top(page); }
      await page.locator('#next-up [data-custom]').tap(); await page.waitForTimeout(450);
      for (const food of ['chook', 'potatoes', 'corn']) { await page.locator(`#builder-chips [data-food=${food}]`).tap(); await page.waitForTimeout(120); }
      await page.locator('#builder-items [data-item=chook] .ch-bld__step').last().tap(); await page.waitForTimeout(150);
      // Taps scroll things into view, the sheet itself included (overflow hidden: a finger never can): back to the top.
      await page.evaluate(() => { const d = document.querySelector('#builder-sheet'); d.scrollTop = 0; d.querySelector('.ch-sheet__body').scrollTop = 0; });
      await shoot(page, 'custom-builder');
      if (review) { await page.evaluate(() => { const b = document.querySelector('#builder-sheet .ch-sheet__body'); b.scrollTop = b.scrollHeight; }); await shoot(page, 'custom-builder-end'); }
      assert.deepEqual(errors, []); await context.close();

      // Today in the gym window: the session is the hero, water below, the rest as quiet lines.
      ({ context, page, errors } = await open('16:30', 'afterLunch'));
      await shoot(page, 'today-gym');
      if (review) { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot(page, 'today-end'); await top(page); await page.locator('[data-row=wrap]').tap(); await page.waitForTimeout(450); await shoot(page, 'today-wrap-open'); await page.locator('[data-fold=wrap]').tap(); await page.waitForTimeout(450); }
      // Gym mode: an exercise with a set done (no rest showing), then the rest timer, then the finish.
      await page.locator('#session-hero [data-gym-start]').tap();
      for (let i = 0; i < 3; i++) { await page.clock.runFor(70000); await page.locator('#gym-go').tap(); if (await page.locator('[data-gym=skip]').isVisible()) await page.locator('[data-gym=skip]').tap(); }
      await page.clock.runFor(900);
      assert.equal(await page.locator('#gym-name').innerText(), 'Chest-supported row');
      await page.clock.runFor(95000); await page.locator('#gym-go').tap(); await page.locator('[data-gym=skip]').tap(); await page.waitForTimeout(100);
      await shoot(page, 'workout-set');
      await page.locator('#gym-go').tap(); await page.clock.runFor(36000);
      await shoot(page, 'rest-timer');
      let guard = 0;
      while (guard++ < 40 && !/Finish workout/.test(await page.locator('#gym-go').innerText())) { await page.clock.runFor(95000); await page.locator('#gym-go').tap(); if (await page.locator('[data-gym=skip]').isVisible()) await page.locator('[data-gym=skip]').tap(); await page.clock.runFor(800); }
      await page.locator('#gym-go').tap(); await page.waitForTimeout(200);
      assert.equal(await page.locator('#gym-done').isVisible(), true);
      await shoot(page, 'finish');
      await page.locator('[data-gym=done]').tap(); await page.waitForTimeout(150);
      if (review) { await top(page); await shoot(page, 'today-done'); await page.locator('[data-view=training]').tap(); await top(page); await shoot(page, 'training'); await page.locator('.is-today .exercise-row').nth(1).tap(); await shoot(page, 'exercise-sheet'); await page.keyboard.press('Escape'); }
      await page.locator('[data-view=history]').tap(); await top(page); await page.waitForTimeout(250);
      await shoot(page, 'progress');
      if (review) { await page.evaluate(() => scrollTo(0, document.querySelector('#records').getBoundingClientRect().top + scrollY - 120)); await shoot(page, 'progress-records'); await page.locator('#workouts .workout-row').first().tap(); await shoot(page, 'workout-sheet'); await page.keyboard.press('Escape'); await page.locator('[data-view=settings]').tap(); await top(page); await shoot(page, 'settings'); }
      assert.deepEqual(errors, []); await context.close();

      // Morning: water front and centre, lunch next under it.
      ({ context, page, errors } = await open('08:10', 'morning'));
      await shoot(page, 'water');
      if (review) {
        await page.evaluate(() => scrollTo(0, 360)); await shoot(page, 'morning-meals');
        const card = await page.locator('#next-up .meal-pick').first().boundingBox(); await page.mouse.move(card.x + 40, card.y + 30); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up(); await shoot(page, 'meal-sheet'); await page.keyboard.press('Escape');
        await page.clock.setFixedTime(new Date('2026-11-24T19:10:00+09:30')); await page.reload(); await top(page); await page.addStyleTag({ content: height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}' }); await shoot(page, 'evening');
        await page.clock.setFixedTime(new Date('2026-11-25T19:10:00+09:30')); await page.reload(); await top(page); await page.addStyleTag({ content: height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}' }); await shoot(page, 'wednesday-evening');
      }
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log('Screenshots: ' + made.map(f => path.basename(f)).join(', ') + ' -> ' + output);
})().catch(e => { console.error(e); process.exitCode = 1; });
