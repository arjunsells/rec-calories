// How much is there to tap on Today: the shipped v9 (commit 472da71, read from Git) against the working tree, with the
// same synthetic data, at 393x852 DPR 3 with iPhone safe areas, at four Darwin times (v10's Today changes with the time
// of day). Counts every visible button, link, input, select, textarea and summary in Today and the floating dock
// (toasts hidden):
//   first paint  what can be seen and tapped without scrolling (above the dock's solid band, plus the dock itself)
//   full scroll  everything on the Today screen, top to bottom
// Then the taps it takes, counted with a capture listener: log 500 mL of water, and start a workout + log one set +
// finish it (v9 had no guided workout: its nearest path was a top set and "Complete session" on Training).
// node scripts/v10-button-count.cjs [--json]
const path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, root, MIME, V9, IPHONE } = require('./harness.cjs');
const fromGit = (pathname, res) => {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { const body = execFileSync('git', ['show', V9 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// The same journal for both versions. "Two meals logged": lunch and the afternoon snack (pre-gym), which both plans
// have under the same ids; a coffee; 3.5 L of water; three habits; three exercises ticked.
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

(async () => {
  const v9 = await serve(8101, { handler: fromGit }), v10 = await serve(8102), browser = await launch(), results = [], taps = {};
  try {
    const open = async (port, day, time) => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
      await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') });
      await page.goto(`http://127.0.0.1:${port}/`); await page.evaluate(seed, day); await page.reload();
      await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px}' }); await page.waitForTimeout(150);
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      return { context, page };
    };
    for (const [version, port] of [['v9', 8101], ['v10', 8102]]) for (const [scene, day, time] of SCENES) {
      const { context, page } = await open(port, day, time);
      results.push({ version, scene, ...(await page.evaluate(count)) });
      await context.close();
    }
    // Taps. Water: from Today, add 500 mL. Workout: v10 starts from the gym-window hero, logs one set (kg and reps are
    // filled in) and finishes; v9's closest path was Training, a top set (kg and reps typed) and Complete session.
    for (const [version, port] of [['v9', 8101], ['v10', 8102]]) {
      let { context, page } = await open(port, 'empty', '16:30');
      const tapped = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
      const before = () => page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).questsV5?.['2026-11-24'] || {});
      await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page.locator('.water-row'));
      taps[version] = { water: await page.evaluate(() => window.qaTaps), waterSaved: (await before()).water === .5 };
      await context.close(); ({ context, page } = await open(port, 'empty', '16:30'));
      if (version === 'v10') {
        await tapped(page.locator('#session-hero [data-gym-start]'));
        const typed = (await page.locator('#gym-kg').inputValue()) ? 0 : 1;            // a loaded move with no last time needs its weight once
        if (typed) await page.locator('#gym-kg').fill('20');
        await tapped(page.locator('#gym-go')); await tapped(page.locator('[data-gym=finish]'));
        const d = await before();
        taps[version].workout = await page.evaluate(() => window.qaTaps); taps[version].typed = typed; taps[version].workoutSaved = !!(d.workout && d.workout.end && d.workout.sets.length === 1 && d.training);
      } else {
        await tapped(page.locator('[data-view=training]')); await tapped(page.locator('.is-today .exercise-info').first());
        await page.locator('#top-set-kg').fill('20'); await page.locator('#top-set-reps').fill('8'); await tapped(page.locator('#detail-sheet .top-set-form button'));
        await page.waitForTimeout(450); await tapped(page.locator('.is-today [data-quest=training]'));
        const d = await before();
        taps[version].workout = await page.evaluate(() => window.qaTaps); taps[version].typed = 2; taps[version].workoutSaved = !!(d.topSets && d.training);
      }
      await context.close();
    }
  } finally { await browser.close(); v9.close(); v10.close(); }
  if (process.argv.includes('--json')) return console.log(JSON.stringify({ results, taps }, null, 1));
  console.log('Today at 393x852 (DPR 3, iPhone safe areas), visible buttons + links + inputs, toasts hidden, Tue 24 Nov in Darwin:');
  let worse = false;
  for (const [scene] of SCENES) {
    const [a, b] = ['v9', 'v10'].map(v => results.find(r => r.version === v && r.scene === scene));
    console.log(`  ${scene.padEnd(28)} first paint: v9 ${String(a.firstPaint).padStart(2)} -> v10 ${String(b.firstPaint).padStart(2)}    full scroll: v9 ${String(a.fullScroll).padStart(2)} -> v10 ${String(b.fullScroll).padStart(2)}`);
    if (b.fullScroll >= a.fullScroll || b.firstPaint > a.firstPaint) worse = true;
  }
  for (const v of ['v9', 'v10']) console.log(`  ${v} full scroll, evening: ` + results.find(r => r.version === v && r.scene.startsWith('evening')).fullList.join(' | '));
  console.log(`Taps: log 500 mL water: v9 ${taps.v9.water} -> v10 ${taps.v10.water}. Start + one set + finish: v10 ${taps.v10.workout} taps, ${taps.v10.typed} typed fields (kg and reps pre-filled; Tuesday opens on bodyweight pull-ups); v9 had no workout, its nearest path (Training, top set, Complete session) took ${taps.v9.workout} taps + ${taps.v9.typed} typed fields.`);
  if (!taps.v10.waterSaved || !taps.v10.workoutSaved || !taps.v9.waterSaved || !taps.v9.workoutSaved) { console.error('FAIL a counted action did not save'); process.exitCode = 1; }
  if (worse) { console.error('FAIL v10 does not have fewer controls than v9 in every scene'); process.exitCode = 1; }
  else if (!process.exitCode) console.log('PASS v10 has fewer controls on Today than v9 in every scene, at first paint and over the full scroll.');
})().catch(e => { console.error(e); process.exitCode = 1; });
