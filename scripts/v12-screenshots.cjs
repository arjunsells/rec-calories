// Screenshots from a disposable copy of the shell, with synthetic data only. No browser profile, user journal, key,
// measurement, medication or real photo is read: the "camera" is a canvas drawing of a plate and the proxy is stubbed.
// Output goes OUTSIDE the repository (or into the ignored .qa folder).
//   node scripts/v12-screenshots.cjs            the final set at 375x812 (iPhone safe areas), no toasts on any picture ->
//                                              ../rec-calories-shots (override with CHAD_SHOTS): v12-home (midday,
//                                              light), v12-scan (the camera with its frame), v12-result-card (a photo
//                                              analysed), v12-gym (the Gym tab), v12-progress, v12-dark (Today, dark)
//   node scripts/v12-screenshots.cjs --review   more screens, light and dark, 375x812 and 375x667 -> .qa/v12-review
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, shellFiles, root: repo, IPHONE } = require('./harness.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chad-v12-shot-shell-'));
const review = process.argv.includes('--review');
const output = review ? path.join(repo, '.qa', 'v12-review') : process.env.CHAD_SHOTS || path.resolve(repo, '../rec-calories-shots');
for (const file of ['sw.js', ...shellFiles().filter(f => f !== './')]) { const dest = path.join(dir, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(repo, file), dest); }

// 47 days on the plan since Day 1 (8 Oct): lunch, dinner and the snack mostly Strict, water on target most days (the
// last 6 in a row), YoPRO pouches now and then, a custom dinner yesterday, and three weeks of finished workouts with
// believable, slowly rising weights. Today: a YoPRO pouch at 10:05 and 1.5 L of water.
function seed(today) {
  const q = CHADQuest, T = CHADTrain, state = { schemaVersion: 5, appVersion: 12, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  const meal = (key, id, tier) => { const slot = CHADPlan.find(s => s.id === id), c = slot.choices.find(c => c.tier === tier); state.entries.push({ id: 'plan-' + key + '-' + id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); return tier; };
  const base = { 'Incline DB press': 22.5, 'Machine chest press': 50, 'Low-to-high cable fly': 12.5, 'Seated DB shoulder press': 20, 'Cable side raise': 7.5, 'Overhead cable triceps ext': 20, 'Pull-ups': 0, 'Chest-supported row': 50, 'Single-arm pulldown': 30, 'Rear delt fly': 8, 'DB shrugs': 32.5, 'Incline DB curl': 12.5, 'Hanging leg raise': 0, 'Machine side raise': 30, 'Machine shoulder press': 45, 'Reverse pec deck': 35, 'EZ curl': 25, Pushdown: 25, 'Hammer curl': 14, Dips: 0, 'Cable crunch': 40, 'Smith incline': 50, 'T-bar or seal row': 45, 'Lat pulldown': 55, 'Straight-arm pulldown': 25, 'Side raise': 9, 'Hill sprints': 0, 'Hack squat': 80, RDL: 80, 'Leg press': 140, 'Seated leg curl': 45, 'Leg extension': 50, 'Calf raise': 70 };
  for (let n = 47; n >= 1; n--) {
    const key = q.shift(today, -n), tiers = n % 9 === 0 ? 'MSF' : n % 4 === 0 ? 'SMS' : 'SSS', d = { picks: {}, water: n <= 6 || n % 5 ? q.waterGoal(key) : 3, steps: n % 6 !== 0, sleep: n % 3 !== 0, electrolyte: n % 2 === 0 };
    if (n % 8 === 3) continue;
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
  const y = q.shift(today, -1); state.entries = state.entries.filter(e => !(e.day === y && e.planSlot === 'D'));
  state.questsV5[y] = { ...state.questsV5[y], picks: { ...state.questsV5[y]?.picks, D: 'C' } };
  state.entries.push({ id: 'plan-' + y + '-D', day: y, name: 'Roast chook + Microwave baby potatoes + Corn cob', kcal: 761, protein: 80.6, carbs: 69.4, fat: 13.2, meal: 'Dinner', source: 'custom', planSlot: 'D', parts: [{ name: 'Roast chook, skin off', amount: '250 g', kcal: 412.5, protein: 70, carbs: 1.3, fat: 13.8, food: 'chook' }, { name: 'Microwave baby potatoes', amount: '300 g', kcal: 225, protein: 6, carbs: 47.4, fat: .3, food: 'potatoes' }, { name: 'Corn cob', amount: '1 cob', kcal: 96, protein: 3.4, carbs: 21, fat: 1.5, food: 'corn' }] });
  state.questsV5[today] = { water: 1.5 };
  state.entries.push({ id: 'fav-yopro-pouch-' + today, day: today, name: 'YoPRO Perform pouch', kcal: 120, protein: 20.1, carbs: 6.8, fat: 1.2, meal: 'Lunch', source: 'favourite', fav: 'yopro-pouch', portion: '1 pouch', at: Date.parse(today + 'T10:05:00+09:30') });
  return state;
}
// The stand-in camera: a canvas drawing of a plate (chicken, rice, greens) on a timber table.
function camera() {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1440; const g = c.getContext('2d');
  const draw = () => {
    const wood = g.createLinearGradient(0, 0, 1080, 1440); wood.addColorStop(0, '#5b4634'); wood.addColorStop(1, '#3f3024'); g.fillStyle = wood; g.fillRect(0, 0, 1080, 1440);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 14; i++) g.fillRect(0, i * 110 + 30, 1080, 6);
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 60; g.shadowOffsetY = 26; g.fillStyle = '#f5f2ec'; g.beginPath(); g.arc(540, 700, 430, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#ebe6dc'; g.beginPath(); g.arc(540, 700, 330, 0, 7); g.fill();
    g.fillStyle = '#fbf8f0'; g.beginPath(); g.ellipse(640, 800, 190, 120, -.3, 0, 7); g.fill();
    g.fillStyle = '#efe9dc'; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(560 + (i * 37) % 200, 740 + (i * 53) % 130, 12, 6, i, 0, 7); g.fill(); }
    const meat = g.createLinearGradient(330, 480, 640, 760); meat.addColorStop(0, '#c47a33'); meat.addColorStop(1, '#8a4a1c'); g.fillStyle = meat; g.beginPath(); g.ellipse(470, 600, 190, 120, .45, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,25,8,.55)'; g.lineWidth = 10; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(360 + i * 60, 520 + i * 20); g.lineTo(460 + i * 60, 640 + i * 20); g.stroke(); }
    for (let i = 0; i < 11; i++) { g.fillStyle = i % 2 ? '#3f7d32' : '#4f9a3c'; g.beginPath(); g.arc(700 + Math.cos(i * 1.7) * 90, 540 + Math.sin(i * 2.3) * 60, 42, 0, 7); g.fill(); }
  };
  draw(); setInterval(draw, 200);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(10) } });
}
const PLATE = { name: 'Chicken, rice and greens', grams: 420, kcal: 640, protein_g: 52, carbs_g: 62, fat_g: 18, fibre_g: 6, sugar_g: 4, processed: false, confidence: .82,
  items: [{ name: 'Grilled chicken thigh', grams: 180, kcal: 340, protein_g: 44, carbs_g: 0, fat_g: 16 }, { name: 'White rice', grams: 180, kcal: 230, protein_g: 4.5, carbs_g: 50, fat_g: .5 }, { name: 'Broccoli', grams: 60, kcal: 20, protein_g: 2, carbs_g: 4, fat_g: .2 }] };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = await serve(8093, { dir }), browser = await launch(), made = [];
  try {
    const matrix = review ? [[375, 812, 'dark'], [375, 812, 'light'], [375, 667, 'dark'], [375, 667, 'light']] : [[375, 812, 'light'], [375, 812, 'dark']];
    for (const [width, height, theme] of matrix) {
      const tag = review ? `-${height}-${theme}` : '', finalDark = !review && theme === 'dark';
      const open = async time => {
        const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage(), errors = watch(page);
        await context.route('**/estimate', async route => { await new Promise(r => setTimeout(r, 900)); route.fulfill({ contentType: 'application/json', body: JSON.stringify(PLATE) }); });
        await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}');
        await page.addInitScript(camera);
        await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') }); await page.goto('http://127.0.0.1:8093/');
        await page.evaluate(([seedSource, today]) => { const seed = new Function('return ' + seedSource)(); localStorage.setItem('rec-calories-v1', JSON.stringify(seed(today))); localStorage.setItem('chad.streakSeen', today + ':48'); localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-shots-token'); }, [seed.toString(), '2026-11-24']);
        await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
        return { context, page, errors };
      };
      const quiet = page => page.evaluate(() => { CHADUX.hideToast(true); for (const id of ['message', 'celebration']) document.getElementById(id).hidden = true; const u = document.getElementById('builder-undo'); if (u) u.hidden = true; });
      const settle = page => page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || ['ch-shimmer', 'ch-sweep', 'ch-life'].includes(a.animationName)), null, { timeout: 4000 }).catch(() => {});
      const shoot = async (page, name) => {
        await quiet(page); await settle(page); await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ch-toast')].some(t => !t.hidden && t.textContent.trim() && getComputedStyle(t).display !== 'none')), false, name + ': no toast on the picture');
        const file = path.join(output, (review ? '' : 'v12-') + name + tag + '.png'); await page.screenshot({ path: file }); made.push(file);
      };
      // Today at 12:20: the week strip, the hero, the macro cards, water, lunch (and the dark picture of the final set).
      let { context, page, errors } = await open('12:20');
      assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L');
      await shoot(page, finalDark ? 'dark' : 'home');
      if (finalDark) { assert.deepEqual(errors, []); await context.close(); continue; }
      if (review) { await page.locator('#left-line').tap(); await shoot(page, 'home-eaten'); await page.waitForTimeout(450); await page.locator('#left-line').tap(); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot(page, 'home-bottom'); await page.evaluate(() => scrollTo(0, 0)); }
      // The camera: full screen, the plate in the frame, the four modes, the shutter.
      await page.locator('#open-camera').tap(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await page.waitForTimeout(400);
      await shoot(page, 'scan');
      if (review) { await page.locator('[data-mode12=label]').tap(); await page.waitForTimeout(300); await shoot(page, 'scan-label'); await page.locator('[data-mode12=food]').tap(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); }
      // A photo: Analysing… in Recently eaten, then the nutrition card by itself.
      await page.locator('#camera12-shutter').tap();
      if (review) { await page.waitForFunction(() => document.querySelector('#recent12 .ch-food.is-pending')); await page.evaluate(() => document.getElementById('recent12').scrollIntoView({ block: 'center' })); await page.waitForTimeout(250); await shoot(page, 'analysing'); }
      await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready', null, { timeout: 10000 });
      await page.waitForTimeout(300); await shoot(page, 'result-card');
      if (review) { await page.evaluate(() => { const b = document.getElementById('nutrition12-body'); b.scrollTop = b.scrollHeight; }); await shoot(page, 'result-card-bottom'); await page.locator('#n12-fix').tap(); await shoot(page, 'result-fix'); await page.locator('#n12-cancelfix').tap(); }
      await page.locator('#n12-done').tap(); await page.waitForFunction(() => !document.getElementById('nutrition12').open); await page.waitForTimeout(450);
      // Gym (the tab, restyled) and Progress.
      await page.locator('[data-view=training]').tap(); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
      await shoot(page, 'gym');
      await page.locator('[data-view=history]').tap(); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(350);
      await shoot(page, 'progress');
      if (review) { await page.evaluate(() => scrollTo(0, document.querySelector('#workouts').getBoundingClientRect().top + scrollY - 120)); await shoot(page, 'progress-workouts'); await page.locator('[data-view=today]').tap(); await page.locator('#open-settings').tap(); await shoot(page, 'settings'); }
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log('Screenshots: ' + made.map(f => path.basename(f)).join(', ') + ' -> ' + output);
})().catch(e => { console.error(e); process.exitCode = 1; });
