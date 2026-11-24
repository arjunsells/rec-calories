// How much is there to tap on Today: the shipped v10 (main 47c498e, read from Git) against the working tree, with the
// same synthetic data, at 393x852 DPR 3 with iPhone safe areas, at four Darwin times (Today changes with the time of
// day). Counts every visible button, link, input, select, textarea and summary in Today and the floating dock (toasts
// hidden):
//   first paint  what can be seen and tapped without scrolling (above the dock's solid band, plus the dock itself)
//   full scroll  everything on the Today screen, top to bottom
// The rule: the first screen has FEWER than v10's 9 controls at morning, midday, the gym window and the evening (and
// fewer than v10 in that same scene), and the full scroll is never more than v10's.
// Then the taps it takes, counted with a capture listener: the usual lunch (the pinned Nando's ½ chicken), 500 mL of
// water (at each of the four times), one set in Gym mode, a YoPRO Perform pouch and a Gochi noodle meal (the Quick log
// favourites; v10 had none: its nearest path was Quick add with the numbers typed in).
// node scripts/v11-button-count.cjs [--json]
const path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, root, MIME, IPHONE } = require('./harness.cjs');
const V10 = '47c498e', LIMIT = 9;
const fromGit = commit => (pathname, res) => {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { const body = execFileSync('git', ['show', commit + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// The same journal for both. "Two meals logged": lunch and the snack "P" (the same ids in v10 and v11); a coffee;
// 3.5 L of water; three habits.
function seed(day) {
  const state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  if (day === 'logged') {
    for (const id of ['L', 'P']) { const slot = CHADPlan.find(s => s.id === id), c = slot.choices[0]; state.entries.push({ id: 'plan-2026-11-24-' + id, day: '2026-11-24', name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); }
    state.entries.push({ id: 'demo-coffee', day: '2026-11-24', name: 'Flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' });
    state.questsV5['2026-11-24'] = { picks: { L: 'S', P: 'S' }, water: 3.5, electrolyte: true, steps: true, sleep: true };
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
const VERSIONS = [['v10', 8101, V10], ['v11', 8102, null]];

(async () => {
  const servers = await Promise.all(VERSIONS.map(([, port, commit]) => serve(port, commit ? { handler: fromGit(commit) } : {}))), browser = await launch(), results = [], taps = {};
  try {
    const open = async (port, day, time) => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
      // iPhone safe areas from the very first frame (as on a phone), before any script lays the page out.
      await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, ':root{--ch-sat:47px;--ch-sab:34px}');   // as soon as <html> exists, before any script
      await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') });
      await page.goto(`http://127.0.0.1:${port}/`); await page.evaluate(seed, day); await page.reload();
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      return { context, page };
    };
    for (const [version, port] of VERSIONS) for (const [scene, day, time] of SCENES) {
      const { context, page } = await open(port, day, time);
      results.push({ version, scene, ...(await page.evaluate(count)) });
      await context.close();
    }
    const tapped = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const today = page => page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).questsV5?.['2026-11-24'] || {});
    const entries = page => page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).entries.filter(e => e.day === '2026-11-24'));
    for (const [version, port] of VERSIONS) {
      const t = taps[version] = {};
      // The usual lunch at noon: the pinned ½ chicken, one tap in both.
      let { context, page } = await open(port, 'empty', '12:00');
      await page.evaluate(() => { window.qaTaps = 0; });
      await tapped(page, page.locator(version === 'v10' ? '#next-up [data-slot=L][data-tier=S]' : '#now [data-slot=L][data-tier=S]'));
      const lunch = (await entries(page)).find(e => e.kcal === 715);
      Object.assign(t, { lunch: await page.evaluate(() => window.qaTaps), lunchSaved: !!lunch && lunch.protein === 108 && (await today(page)).picks?.L === 'S' });
      await context.close();
      // Water, at each time of day: one tap, wherever it sits.
      t.water = {};
      for (const [, day, time] of SCENES) {
        ({ context, page } = await open(port, day, time));
        const before = (await today(page)).water || 0;
        await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page, page.locator('.water-row'));
        t.water[time] = await page.evaluate(() => window.qaTaps); t.waterSaved = (t.waterSaved ?? true) && (await today(page)).water === before + .5;
        await context.close();
      }
      // One set in Gym mode (kg and reps filled in; a loaded move with no history needs its weight typed once).
      ({ context, page } = await open(port, 'empty', '16:30'));
      await tapped(page, page.locator(version === 'v10' ? '#session-hero [data-gym-start]' : '#now [data-gym-start]'));
      const fill = (await page.locator('#gym-kg').inputValue()) ? 0 : 1; if (fill) await page.locator('#gym-kg').fill('20');
      await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page, page.locator('#gym-go'));
      Object.assign(t, { set: await page.evaluate(() => window.qaTaps), setTyped: fill, setSaved: (await today(page)).workout?.sets?.length === 1 });
      await context.close();
      // The two favourites: one tap each in v11; v10 had no such button (Quick add, the numbers typed in).
      for (const [key, id, name, m] of [['yopro', 'yopro-pouch', 'YoPRO Perform pouch', [120, 20.1, 6.8, 1.2]], ['gochi', 'gochi-noodle', 'Gochi noodle meal', [225, 31.8, 25.2, 2.6]]]) {
        ({ context, page } = await open(port, 'empty', '12:00'));
        await page.evaluate(() => { window.qaTaps = 0; }); let typed = 0;
        if (version === 'v11') await tapped(page, page.locator(`#quick [data-fav="${id}"]`));
        else {
          await tapped(page, page.locator('#today-scan')); await tapped(page, page.locator('[data-add=manual]'));
          for (const [field, value] of [['food-name', name], ['calories', m[0]], ['protein', m[1]], ['carbs', m[2]], ['fat', m[3]]]) { await page.locator('#' + field).fill(String(value)); typed++; }
          await tapped(page, page.locator('#add-form button'));
        }
        const e = (await entries(page)).find(x => x.name === name);
        Object.assign(t, { [key]: await page.evaluate(() => window.qaTaps), [key + 'Typed']: typed, [key + 'Saved']: !!e && [e.kcal, e.protein, e.carbs, e.fat].join() === m.join() });
        await context.close();
      }
    }
  } finally { await browser.close(); servers.forEach(s => s.close()); }
  if (process.argv.includes('--json')) return console.log(JSON.stringify({ results, taps }, null, 1));
  console.log('Today at 393x852 (DPR 3, iPhone safe areas), visible buttons + links + inputs, toasts hidden, Tue 24 Nov in Darwin:');
  let worse = false;
  const pad = n => String(n).padStart(2);
  for (const [scene] of SCENES) {
    const [a, b] = VERSIONS.map(([v]) => results.find(r => r.version === v && r.scene === scene));
    console.log(`  ${scene.padEnd(28)} first screen: v10 ${pad(a.firstPaint)} -> v11 ${pad(b.firstPaint)}    full scroll: v10 ${pad(a.fullScroll)} -> v11 ${pad(b.fullScroll)}`);
    console.log(`    v11 first screen: ${b.firstPaintList.join(' | ')}`);
    if (b.firstPaint >= LIMIT || b.firstPaint >= a.firstPaint) { worse = true; console.error(`    FAIL first screen ${b.firstPaint}: must be fewer than ${LIMIT} and fewer than v10 (${a.firstPaint})`); }
    if (b.fullScroll > a.fullScroll) { worse = true; console.error('    FAIL more controls than v10 over the full scroll\n      v10: ' + a.fullList.join(' | ') + '\n      v11: ' + b.fullList.join(' | ')); }
  }
  const t = taps.v11, o = taps.v10, water = w => Object.entries(w).map(([time, n]) => time + ' ' + n).join(', ');
  console.log(`Taps (v11): the usual lunch ${t.lunch} (v10 ${o.lunch}); 500 mL water ${water(t.water)} (v10 ${water(o.water)}); one set in Gym mode ${t.set} (v10 ${o.set}); YoPRO Perform pouch ${t.yopro} (v10: ${o.yopro} taps + ${o.yoproTyped} typed fields through Quick add); Gochi noodle meal ${t.gochi} (v10: ${o.gochi} taps + ${o.gochiTyped} typed fields).`);
  for (const [v, x] of Object.entries(taps)) if (!x.lunchSaved || !x.waterSaved || !x.setSaved || !x.yoproSaved || !x.gochiSaved) { console.error('FAIL a counted action did not save in ' + v + ': ' + JSON.stringify(x)); process.exitCode = 1; }
  if (t.lunch !== 1 || Object.values(t.water).some(n => n !== 1) || t.set !== 1 || t.yopro !== 1 || t.gochi !== 1) { console.error('FAIL the usual lunch, water, a set, YoPRO and Gochi noodle must be one tap each'); process.exitCode = 1; }
  if (worse) { console.error('FAIL v11 is not lighter than v10 everywhere'); process.exitCode = 1; }
  else if (!process.exitCode) console.log(`PASS v11's first screen has fewer than ${LIMIT} controls at all four times (and fewer than v10 in each), the full scroll is never more than v10's, and the usual lunch, water (any time), a set, YoPRO and Gochi noodle are one tap each.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
