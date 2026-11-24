// How much is there to tap on Today: the shipped v9 (commit 472da71) and v10 pass 1 (commit 4d99981), both read from
// Git, against the working tree, with the same synthetic data, at 393x852 DPR 3 with iPhone safe areas, at four Darwin
// times (Today changes with the time of day). Counts every visible button, link, input, select, textarea and summary
// in Today and the floating dock (toasts hidden):
//   first paint  what can be seen and tapped without scrolling (above the dock's solid band, plus the dock itself)
//   full scroll  everything on the Today screen, top to bottom
// The rule: fewer than v9 in every scene, and never more than pass 1 ("less is more": pass 2 adds no controls).
// Then the taps it takes, counted with a capture listener: log the usual lunch (the Nando's ½ chicken: a pinned card
// in pass 2; v9 and pass 1 had no such card, so Quick add with the numbers typed), log 500 mL of water, and start a
// workout + log one set + finish it (v9 had no guided workout: its nearest path was a top set and "Complete session").
// node scripts/v10-button-count.cjs [--json]
const path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, root, MIME, V9, IPHONE } = require('./harness.cjs');
const PASS1 = '4d99981';
const fromGit = commit => (pathname, res) => {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { const body = execFileSync('git', ['show', commit + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// The same journal for every version. "Two meals logged": lunch and the afternoon slot "P" (v9's pre-gym, pass 1's
// snack, pass 2's after-dinner snack), which all plans have under the same ids; a coffee; 3.5 L of water; three
// habits; three exercises ticked.
function seed(day) {
  const state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  if (day === 'logged') {
    for (const id of ['L', 'P']) { const slot = CHADPlan.find(s => s.id === id), c = slot.choices[0]; state.entries.push({ id: 'plan-2026-11-24-' + id, day: '2026-11-24', name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); }
    state.entries.push({ id: 'demo-coffee', day: '2026-11-24', name: 'Flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' });
    state.questsV5['2026-11-24'] = { picks: { L: 'S', P: 'S' }, water: 3.5, electrolyte: true, steps: true, sleep: true, exercises: { 0: true, 1: true, 2: true } };
  }
  localStorage.setItem('rec-calories-v1', JSON.stringify(state));
}
function count() {
  document.querySelectorAll('#undo-toast,#message,#celebration').forEach(t => { t.hidden = true; });
  const bar = document.querySelector('.ch-tabbar').getBoundingClientRect(), solid = bar.top - 4;   // below this line the scrim is opaque page colour
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]')].filter(e => {
    if (e.closest('dialog:not([open])') || e.closest('.view[hidden]') || e.closest('#undo-toast') || e.closest('#gym')) return false;
    const r = e.getBoundingClientRect(), style = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  const inDock = e => !!e.closest('.ch-tabbar, .ch-snap');
  const firstPaint = controls.filter(e => { const r = e.getBoundingClientRect(); return inDock(e) || (r.bottom > 0 && r.top < solid); });
  const label = e => (e.getAttribute('aria-label') || e.textContent || e.id || e.className).trim().replace(/\s+/g, ' ').slice(0, 30);
  return { firstPaint: firstPaint.length, fullScroll: controls.length, firstPaintList: firstPaint.map(label), fullList: controls.map(label) };
}
const SCENES = [['morning, nothing logged', 'empty', '08:00'], ['midday, nothing logged', 'empty', '12:00'], ['gym window, 2 meals logged', 'logged', '16:30'], ['evening, 2 meals logged', 'logged', '19:00']];
const VERSIONS = [['v9', 8101, V9], ['pass 1', 8105, PASS1], ['pass 2', 8102, null]];

(async () => {
  const servers = await Promise.all(VERSIONS.map(([, port, commit]) => serve(port, commit ? { handler: fromGit(commit) } : {}))), browser = await launch(), results = [], taps = {};
  try {
    const open = async (port, day, time) => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
      await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') });
      await page.goto(`http://127.0.0.1:${port}/`); await page.evaluate(seed, day); await page.reload();
      await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px}' }); await page.waitForTimeout(150);
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      return { context, page };
    };
    for (const [version, port] of VERSIONS) for (const [scene, day, time] of SCENES) {
      const { context, page } = await open(port, day, time);
      results.push({ version, scene, ...(await page.evaluate(count)) });
      await context.close();
    }
    for (const [version, port] of VERSIONS) {
      const tapped = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
      const today = page => page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).questsV5?.['2026-11-24'] || {});
      // The usual lunch at noon: pass 2 pins it; before, it had to be typed in through Quick add.
      let { context, page } = await open(port, 'empty', '12:00');
      await page.evaluate(() => { window.qaTaps = 0; });
      const pinned = page.locator(`#next-up [data-slot=L][data-tier=S]`), isPinned = version === 'pass 2';
      let typed = 0;
      if (isPinned) await tapped(page, pinned);
      else {
        await tapped(page, page.locator('#today-scan')); await tapped(page, page.locator('[data-add=manual]'));
        for (const [id, value] of [['food-name', "Nando's ½ PERi chicken"], ['calories', '715'], ['protein', '108'], ['carbs', '1.1'], ['fat', '30.8']]) { await page.locator('#' + id).fill(value); typed++; }
        await tapped(page, page.locator('#add-form button'));
      }
      const lunch = (await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).entries)).find(e => e.day === '2026-11-24' && e.kcal === 715);
      taps[version] = { lunch: await page.evaluate(() => window.qaTaps), lunchTyped: typed, lunchSaved: !!lunch && lunch.protein === 108 };
      await context.close();
      // Water: from Today, add 500 mL.
      ({ context, page } = await open(port, 'empty', '16:30'));
      await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page, page.locator('.water-row'));
      Object.assign(taps[version], { water: await page.evaluate(() => window.qaTaps), waterSaved: (await today(page)).water === .5 });
      await context.close();
      // A workout: v10 starts from the gym-window hero, logs one set (kg and reps filled in) and finishes; v9's closest
      // path was Training, a top set (kg and reps typed) and Complete session.
      ({ context, page } = await open(port, 'empty', '16:30'));
      if (version !== 'v9') {
        await tapped(page, page.locator('#session-hero [data-gym-start]'));
        const fill = (await page.locator('#gym-kg').inputValue()) ? 0 : 1;            // a loaded move with no last time needs its weight once
        if (fill) await page.locator('#gym-kg').fill('20');
        const beforeSet = await page.evaluate(() => window.qaTaps);
        await tapped(page, page.locator('#gym-go')); const set = await page.evaluate(() => window.qaTaps) - beforeSet;
        await tapped(page, page.locator('[data-gym=finish]'));
        const d = await today(page);
        Object.assign(taps[version], { workout: await page.evaluate(() => window.qaTaps), set, typed: fill, workoutSaved: !!(d.workout && d.workout.end && d.workout.sets.length === 1 && d.training) });
      } else {
        await tapped(page, page.locator('[data-view=training]')); await tapped(page, page.locator('.is-today .exercise-info').first());
        await page.locator('#top-set-kg').fill('20'); await page.locator('#top-set-reps').fill('8'); await tapped(page, page.locator('#detail-sheet .top-set-form button'));
        await page.waitForTimeout(450); await tapped(page, page.locator('.is-today [data-quest=training]'));
        const d = await today(page);
        Object.assign(taps[version], { workout: await page.evaluate(() => window.qaTaps), set: null, typed: 2, workoutSaved: !!(d.topSets && d.training) });
      }
      await context.close();
    }
  } finally { await browser.close(); servers.forEach(s => s.close()); }
  if (process.argv.includes('--json')) return console.log(JSON.stringify({ results, taps }, null, 1));
  console.log('Today at 393x852 (DPR 3, iPhone safe areas), visible buttons + links + inputs, toasts hidden, Tue 24 Nov in Darwin:');
  let worse = false;
  const pad = n => String(n).padStart(2);
  for (const [scene] of SCENES) {
    const [a, p, b] = VERSIONS.map(([v]) => results.find(r => r.version === v && r.scene === scene));
    console.log(`  ${scene.padEnd(28)} first paint: v9 ${pad(a.firstPaint)} · pass 1 ${pad(p.firstPaint)} · pass 2 ${pad(b.firstPaint)}    full scroll: v9 ${pad(a.fullScroll)} · pass 1 ${pad(p.fullScroll)} · pass 2 ${pad(b.fullScroll)}`);
    if (b.fullScroll >= a.fullScroll || b.firstPaint > a.firstPaint) { worse = true; console.error('    more than v9: ' + scene); }
    if (b.fullScroll > p.fullScroll || b.firstPaint > p.firstPaint) { worse = true; console.error('    more than pass 1: ' + scene + '\n      pass 1: ' + p.fullList.join(' | ') + '\n      pass 2: ' + b.fullList.join(' | ')); }
  }
  for (const [v] of VERSIONS) console.log(`  ${v} full scroll, evening: ` + results.find(r => r.version === v && r.scene.startsWith('evening')).fullList.join(' | '));
  const t = taps['pass 2'];
  console.log(`Taps (pass 2): log the usual lunch ${t.lunch} (v9 ${taps.v9.lunch} taps + ${taps.v9.lunchTyped} typed fields, pass 1 ${taps['pass 1'].lunch} + ${taps['pass 1'].lunchTyped}: no card for it); log 500 mL water ${t.water} (v9 ${taps.v9.water}, pass 1 ${taps['pass 1'].water}); tick a set ${t.set} in Gym mode; start + one set + finish ${t.workout} taps, ${t.typed} typed (pass 1 ${taps['pass 1'].workout}); v9 had no workout, its nearest path (Training, top set, Complete session) took ${taps.v9.workout} taps + ${taps.v9.typed} typed fields.`);
  for (const [v] of VERSIONS) if (!taps[v].lunchSaved || !taps[v].waterSaved || !taps[v].workoutSaved) { console.error('FAIL a counted action did not save in ' + v + ': ' + JSON.stringify(taps[v])); process.exitCode = 1; }
  if (t.lunch !== 1 || t.water !== 1 || t.set !== 1) { console.error('FAIL the usual lunch, water and a set must be one tap each'); process.exitCode = 1; }
  if (worse) { console.error('FAIL pass 2 has more controls on Today than v9 or pass 1 somewhere'); process.exitCode = 1; }
  else if (!process.exitCode) console.log('PASS pass 2 has fewer controls on Today than v9 and no more than pass 1 in every scene, at first paint and over the full scroll; the usual lunch, water and a set are one tap each.');
})().catch(e => { console.error(e); process.exitCode = 1; });
