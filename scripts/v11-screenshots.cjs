// Screenshots from a disposable copy of the shell, with synthetic data only. No browser profile, user journal, key,
// measurement, medication or photo is read. Output goes OUTSIDE the repository (or into the ignored .qa folder).
//   node scripts/v11-screenshots.cjs            the final set at 375x812 (iPhone safe areas), no toasts on any picture ->
//                                              ../rec-calories-shots (override with CHAD_SHOTS): v11-today (midday,
//                                              light), v11-gym (Gym mode, a set), v11-dinner-pick (evening: the three
//                                              options + Custom), v11-custom (the add-food sheet, recent first),
//                                              v11-progress, v11-dark (Today, dark)
//   node scripts/v11-screenshots.cjs --review   more screens, light and dark, 375x812 and 375x667 -> .qa/v11-review
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, shellFiles, root: repo, IPHONE } = require('./harness.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chad-v11-shot-shell-'));
const review = process.argv.includes('--review');
const output = review ? path.join(repo, '.qa', 'v11-review') : process.env.CHAD_SHOTS || path.resolve(repo, '../rec-calories-shots');
for (const file of ['sw.js', ...shellFiles().filter(f => f !== './')]) { const dest = path.join(dir, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(repo, file), dest); }

// 47 days on the plan since Day 1 (8 Oct): lunch, dinner and the snack mostly Strict, water on target most days (the
// last 6 in a row), YoPRO pouches now and then, a custom dinner yesterday, and three weeks of finished workouts with
// believable, slowly rising weights. Today depends on the picture.
function seed(today) {
  const q = CHADQuest, T = CHADTrain, state = { schemaVersion: 5, appVersion: 11, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  const meal = (key, id, tier) => { const slot = CHADPlan.find(s => s.id === id), c = slot.choices.find(c => c.tier === tier); state.entries.push({ id: 'plan-' + key + '-' + id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); return tier; };
  const base = { 'Incline DB press': 22.5, 'Machine chest press': 50, 'Low-to-high cable fly': 12.5, 'Seated DB shoulder press': 20, 'Cable side raise': 7.5, 'Overhead cable triceps ext': 20, 'Pull-ups': 0, 'Chest-supported row': 50, 'Single-arm pulldown': 30, 'Rear delt fly': 8, 'DB shrugs': 32.5, 'Incline DB curl': 12.5, 'Hanging leg raise': 0, 'Machine side raise': 30, 'Machine shoulder press': 45, 'Reverse pec deck': 35, 'EZ curl': 25, Pushdown: 25, 'Hammer curl': 14, Dips: 0, 'Cable crunch': 40, 'Smith incline': 50, 'T-bar or seal row': 45, 'Lat pulldown': 55, 'Straight-arm pulldown': 25, 'Side raise': 9, 'Hill sprints': 0, 'Hack squat': 80, RDL: 80, 'Leg press': 140, 'Seated leg curl': 45, 'Leg extension': 50, 'Calf raise': 70 };
  for (let n = 47; n >= 1; n--) {
    const key = q.shift(today, -n), tiers = n % 9 === 0 ? 'MSF' : n % 4 === 0 ? 'SMS' : 'SSS', d = { picks: {}, water: n <= 6 || n % 5 ? q.waterGoal(key) : 3, steps: n % 6 !== 0, sleep: n % 3 !== 0, electrolyte: n % 2 === 0 };
    if (n % 8 === 3) continue;                                                       // a few days with nothing logged: the journey still counts them
    ['L', 'D', 'P'].forEach((id, i) => { d.picks[id] = meal(key, id, tiers[i]); });
    if (n % 3 === 1) state.entries.push({ id: 'fav-yopro-pouch-' + key, day: key, name: 'YoPRO Perform pouch', kcal: 120, protein: 20.1, carbs: 6.8, fat: 1.2, meal: 'Lunch', source: 'favourite', fav: 'yopro-pouch', portion: '1 pouch' });
    const s = T.plan(key);
    if (n <= 21 && s.kind === 'gym') {
      const week = Math.floor((21 - n) / 7), start = Date.parse(key + 'T16:05:00+09:30'); let at = start + 6 * 60000; const sets = [];
      for (const e of s.ex) for (let k = 0; k < e.sets; k++) { const kg = e.kind === 'time' ? 0 : base[e.name] + (e.kind === 'kg' ? week * 2.5 : 0); sets.push({ x: e.name, kg, reps: e.kind === 'time' ? 12 : Math.max(e.reps[0], e.reps[0] + 1 + week - k), at }); at += (e.rest + 45) * 1000; }
      d.workout = { id: s.id, start, end: at + 60000, sets }; d.training = true; d.cardio = true;
    } else if (s.kind !== 'gym') { d.training = s.kind === 'class'; d.cardio = true; }
    state.questsV5[key] = d;
  }
  // Yesterday's dinner was a custom one (so it is recent in the add-food sheet).
  const y = q.shift(today, -1); state.entries = state.entries.filter(e => !(e.day === y && e.planSlot === 'D'));
  state.questsV5[y] = { ...state.questsV5[y], picks: { ...state.questsV5[y]?.picks, D: 'C' } };
  state.entries.push({ id: 'plan-' + y + '-D', day: y, name: 'Roast chook + Microwave baby potatoes + Corn cob', kcal: 761, protein: 80.6, carbs: 69.4, fat: 13.2, meal: 'Dinner', source: 'custom', planSlot: 'D', parts: [{ name: 'Roast chook, skin off', amount: '250 g', kcal: 412.5, protein: 70, carbs: 1.3, fat: 13.8, food: 'chook' }, { name: 'Microwave baby potatoes', amount: '300 g', kcal: 225, protein: 6, carbs: 47.4, fat: .3, food: 'potatoes' }, { name: 'Corn cob', amount: '1 cob', kcal: 96, protein: 3.4, carbs: 21, fat: 1.5, food: 'corn' }] });
  state.entries.push({ id: 'food-' + y + '-flat-white', day: y, name: 'Flat white, full cream', kcal: 130, protein: 7, carbs: 10, fat: 7, meal: 'Lunch', source: 'manual', portion: '1 serving' });
  return state;
}
const lunchIn = (s, today) => { const c = CHADPlan[0].choices[0]; s.questsV5[today] = { picks: { L: 'S' }, water: 2.5, sleep: true }; s.entries.push({ id: 'plan-' + today + '-L', day: today, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: 'Lunch', source: 'plan', planSlot: 'L' }); return s; };
const SCENES = {
  // Noon: lunch on top, the two go-tos pinned first.
  midday: today => { const s = seed(today); s.questsV5[today] = { water: 1.5 }; return s; },
  // Lunch in, the gym done (finished at 5 pm): dinner on top with the best fit.
  evening: today => { const s = lunchIn(seed(today), today); s.questsV5[today] = { ...s.questsV5[today], water: 4, training: true, cardio: true }; s.entries.push({ id: 'fav-yopro-pouch-' + today, day: today, name: 'YoPRO Perform pouch', kcal: 120, protein: 20.1, carbs: 6.8, fat: 1.2, meal: 'Lunch', source: 'favourite', fav: 'yopro-pouch', portion: '1 pouch' }); return s; },
  // Lunch in, 4:30 pm: the session.
  gym: today => lunchIn(seed(today), today)
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
        await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}');
        await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') }); await page.goto('http://127.0.0.1:8093/');
        // The seed and the scene run in the page, where the plan and the program live.
        await page.evaluate(([seedSource, sceneSource, lunchSource, today]) => { const seed = new Function('return ' + seedSource)(), lunchIn = new Function('return ' + lunchSource)(); const scene = new Function('seed', 'lunchIn', 'return ' + sceneSource)(seed, lunchIn); localStorage.setItem('rec-calories-v1', JSON.stringify(scene(today))); localStorage.setItem('chad.streakSeen', today + ':48'); }, [seed.toString(), SCENES[scene].toString(), lunchIn.toString(), '2026-11-24']);
        await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
        return { context, page, errors };
      };
      const quiet = page => page.evaluate(() => { CHADUX.hideToast(true); for (const id of ['message', 'celebration']) document.getElementById(id).hidden = true; const u = document.getElementById('builder-undo'); if (u) u.hidden = true; });
      const shoot = async (page, name) => {
        await quiet(page); await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ch-toast')].some(t => !t.hidden && t.textContent.trim() && getComputedStyle(t).display !== 'none')), false, name + ': no toast on the picture');
        const file = path.join(output, (review ? '' : 'v11-') + name + tag + '.png'); await page.screenshot({ path: file }); made.push(file);
      };
      const top = page => page.evaluate(() => scrollTo(0, 0));

      // Today at noon: lunch on top with the go-tos (and the dark picture of the final set).
      let { context, page, errors } = await open('12:20', 'midday');
      assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');
      await shoot(page, finalDark ? 'dark' : 'today');
      if (finalDark) { assert.deepEqual(errors, []); await context.close(); continue; }
      if (review) { await page.locator('#left-line').tap(); await shoot(page, 'today-details'); await page.locator('#left-line').tap(); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot(page, 'today-below'); await page.locator('#later-toggle').tap(); await page.waitForTimeout(150); await page.evaluate(() => document.getElementById('later').scrollIntoView()); await shoot(page, 'today-later'); await top(page); }
      assert.deepEqual(errors, []); await context.close();

      // 7 pm: dinner on top, its three options, and + Custom right under them.
      ({ context, page, errors } = await open('19:05', 'evening'));
      assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'D'); assert.equal(await page.locator('#now [data-best]').count(), 1);
      // Scroll just enough that + Custom clears the tab bar, the three options still in view.
      await page.evaluate(() => { const pill = document.querySelector('#after-now [data-custom=D]'), bar = document.querySelector('.ch-tabbar').getBoundingClientRect(); scrollBy(0, pill.getBoundingClientRect().bottom - bar.top + 64); });   // clear of the fade above the bar
      await page.waitForTimeout(200);
      const seen = await page.evaluate(() => { const bar = document.querySelector('.ch-tabbar').getBoundingClientRect().top, vis = e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= bar; }; return { options: [...document.querySelectorAll('#now .ch-opt')].map(vis), custom: vis(document.querySelector('#after-now [data-custom=D]')) }; });
      assert.deepEqual(seen, { options: [true, true, true], custom: true }, 'the three dinner options and Custom are all in the picture');
      await shoot(page, 'dinner-pick');
      // The add-food sheet for dinner: recent first (yesterday's custom dinner and the pouches), then favourites.
      await page.locator('#after-now [data-custom=D]').tap(); await page.waitForTimeout(450);
      await page.locator('#builder-recent [data-food=chook]').tap(); await page.waitForTimeout(120); await page.locator('#builder-recent [data-food=potatoes]').tap(); await page.waitForTimeout(150);
      await page.evaluate(() => { const d = document.querySelector('#builder-sheet'); d.scrollTop = 0; d.querySelector('.ch-sheet__body').scrollTop = 0; });
      assert.equal(await page.evaluate(() => document.querySelector('#builder-body > h3').textContent), 'Recent', 'recent first');
      await shoot(page, 'custom');
      if (review) { await page.evaluate(() => { const b = document.querySelector('#builder-sheet .ch-sheet__body'); b.scrollTop = b.scrollHeight; }); await shoot(page, 'custom-end'); }
      assert.deepEqual(errors, []); await context.close();

      // 4:30 pm: the session on top; Gym mode with a set done.
      ({ context, page, errors } = await open('16:30', 'gym'));
      if (review) await shoot(page, 'today-gym');
      await page.locator('#now [data-gym-start]').tap();
      for (let i = 0; i < 3; i++) { await page.clock.runFor(70000); await page.locator('#gym-go').tap(); if (await page.locator('[data-gym=skip]').isVisible()) await page.locator('[data-gym=skip]').tap(); }
      await page.clock.runFor(900);
      assert.equal(await page.locator('#gym-name').innerText(), 'Chest-supported row');
      await page.clock.runFor(95000); await page.locator('#gym-go').tap(); await page.locator('[data-gym=skip]').tap(); await page.waitForTimeout(100);
      await shoot(page, 'gym');
      if (review) { await page.locator('#gym-go').tap(); await page.clock.runFor(36000); await shoot(page, 'rest-timer'); }
      await page.locator('[data-gym=close]').tap(); await page.waitForTimeout(150);
      await page.locator('[data-view=history]').tap(); await top(page); await page.waitForTimeout(250);
      await shoot(page, 'progress');
      if (review) { await page.evaluate(() => scrollTo(0, document.querySelector('#records').getBoundingClientRect().top + scrollY - 120)); await shoot(page, 'progress-records'); await page.locator('[data-view=training]').tap(); await top(page); await shoot(page, 'gym-tab'); await page.locator('[data-view=today]').tap(); await page.locator('#open-settings').tap(); await shoot(page, 'settings'); }
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log('Screenshots: ' + made.map(f => path.basename(f)).join(', ') + ' -> ' + output);
})().catch(e => { console.error(e); process.exitCode = 1; });
