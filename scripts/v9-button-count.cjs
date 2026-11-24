// How much is there to tap on Today: the shipped v8 (commit 7ddd9ab, read from Git) against the working tree, with the
// same synthetic data, at 393x852 DPR 3 with iPhone safe areas. Counts every visible button, link, input, select,
// textarea and summary in Today and the floating dock (toasts hidden):
//   first paint  what can be seen and tapped without scrolling (above the dock's solid band, plus the dock itself)
//   full scroll  everything on the Today screen, top to bottom
// node scripts/v9-button-count.cjs [--json]
const path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, root, MIME, V8, IPHONE } = require('./harness.cjs');
const fromGit = (pathname, res) => {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { const body = execFileSync('git', ['show', V8 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// The screenshot day: 19:00 in Darwin, lunch and pre-gym logged, a coffee, 3.5 L of water, three quests, three exercises.
function seed(day) {
  const state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  if (day === 'mid-evening') {
    for (const id of ['L', 'P']) { const slot = CHADPlan.find(s => s.id === id), c = slot.choices[0]; state.entries.push({ id: 'plan-2026-11-24-' + id, day: '2026-11-24', name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); }
    state.entries.push({ id: 'demo-coffee', day: '2026-11-24', name: 'Flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' });
    state.questsV5['2026-11-24'] = { picks: { L: 'S', P: 'S' }, water: 3.5, electrolyte: true, steps: true, sleep: true, exercises: { 0: true, 1: true, 2: true } };
  }
  localStorage.setItem('rec-calories-v1', JSON.stringify(state));
}
function count() {
  document.querySelectorAll('#undo-toast,#message,#celebration').forEach(t => { t.hidden = true; });
  const scrim = document.querySelector('.ch-dock-scrim').getBoundingClientRect(), bar = document.querySelector('.ch-tabbar').getBoundingClientRect();
  const solid = bar.top - 4;                                                    // below this line the scrim is opaque page colour
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]')].filter(e => {
    if (e.closest('dialog:not([open])') || e.closest('.view[hidden]') || e.closest('#undo-toast')) return false;
    const r = e.getBoundingClientRect(), style = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  const inDock = e => !!e.closest('.ch-tabbar, .ch-snap');
  const firstPaint = controls.filter(e => { const r = e.getBoundingClientRect(); return inDock(e) || (r.bottom > 0 && r.top < solid); });
  const label = e => (e.getAttribute('aria-label') || e.textContent || e.id || e.className).trim().replace(/\s+/g, ' ').slice(0, 32);
  return { firstPaint: firstPaint.length, fullScroll: controls.length, firstPaintList: firstPaint.map(label), fullList: controls.map(label), scrimTop: Math.round(scrim.top) };
}

(async () => {
  const v8 = await serve(8101, { handler: fromGit }), v9 = await serve(8102), browser = await launch(), results = [];
  try {
    for (const [version, port] of [['v8', 8101], ['v9', 8102]]) for (const [day, time] of [['mid-evening', '2026-11-24T19:00:00+09:30'], ['empty', '2026-11-24T12:00:00+09:30']]) {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
      await page.clock.install({ time: new Date(time) });
      await page.goto(`http://127.0.0.1:${port}/`); await page.evaluate(seed, day); await page.reload();
      await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px}' }); await page.waitForTimeout(150);
      results.push({ version, day, ...(await page.evaluate(count)) });
      await context.close();
    }
  } finally { await browser.close(); v8.close(); v9.close(); }
  if (process.argv.includes('--json')) return console.log(JSON.stringify(results, null, 1));
  console.log('Today at 393x852 (DPR 3, iPhone safe areas), visible buttons + links + inputs, toasts hidden:');
  for (const day of ['mid-evening', 'empty']) {
    const [a, b] = ['v8', 'v9'].map(v => results.find(r => r.version === v && r.day === day));
    console.log(`  ${day.padEnd(12)} first paint: v8 ${a.firstPaint} -> v9 ${b.firstPaint}    full scroll: v8 ${a.fullScroll} -> v9 ${b.fullScroll}`);
  }
  const v9mid = results.find(r => r.version === 'v9' && r.day === 'mid-evening');
  console.log('  v9 first paint (mid-evening): ' + v9mid.firstPaintList.join(' | '));
  const worse = ['mid-evening', 'empty'].some(day => { const [a, b] = ['v8', 'v9'].map(v => results.find(r => r.version === v && r.day === day)); return b.fullScroll >= a.fullScroll || b.firstPaint > a.firstPaint; });
  if (worse) { console.error('FAIL v9 does not have fewer controls than v8'); process.exitCode = 1; }
  else console.log('PASS v9 has fewer controls on Today than v8, at first paint and over the full scroll.');
})().catch(e => { console.error(e); process.exitCode = 1; });
