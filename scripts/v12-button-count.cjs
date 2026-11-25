// How much is there to tap on Today, and how many taps the everyday things take: the shipped v11 (main 566cc4e, read from
// Git) against the working tree (v12), with the same synthetic data, at 393x852 DPR 3 with iPhone safe areas, at four
// Darwin times (Today changes with the time of day). Counts every visible button, link, input, select, textarea and
// summary in Today and the floating dock (toasts hidden):
//   first paint  what can be seen and tapped without scrolling (above the dock's solid band, plus the dock itself)
//   full scroll  everything on the Today screen, top to bottom
// Each count is split into navigation (the tab bar with its round +, the gear, the week strip, Today) and actions
// (everything else). v12 adds navigation on purpose (the week strip's seven days and the camera button the brief asks
// for), so the rule is on actions: the first screen has FEWER than 9 action controls at morning, midday, the gym window
// and the evening, like v11's first screen. Totals are reported side by side.
// Then the taps, counted with a capture listener (the action must also be saved): the usual lunch (the pinned Nando's ½
// chicken), 500 mL of water (at each of the four times), one set in Gym mode, a YoPRO Perform pouch, a Gochi noodle meal,
// and a photo of food logged (v12: the round +, the shutter, Done; v11: + Food, Ask AI, the photo button, Add to meal,
// Log). Synthetic data only: a canvas camera, a stubbed proxy, a generated image for v11's file picker.
// node scripts/v12-button-count.cjs [--json]
const path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, root, MIME, IPHONE, V11 } = require('./harness.cjs');
const LIMIT = 9;
const fromGit = commit => (pathname, res) => {
  if (pathname === '/estimate') return false;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { const body = execFileSync('git', ['show', commit + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// The same journal for both. "Two meals logged": lunch and the snack "P" (the same ids in v11 and v12); a coffee;
// 3.5 L of water; three habits.
function seed(day) {
  const state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  if (day === 'logged') {
    for (const id of ['L', 'P']) { const slot = CHADPlan.find(s => s.id === id), c = slot.choices[0]; state.entries.push({ id: 'plan-2026-11-24-' + id, day: '2026-11-24', name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); }
    state.entries.push({ id: 'demo-coffee', day: '2026-11-24', name: 'Flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' });
    state.questsV5['2026-11-24'] = { picks: { L: 'S', P: 'S' }, water: 3.5, electrolyte: true, steps: true, sleep: true };
  }
  localStorage.setItem('rec-calories-v1', JSON.stringify(state));
  localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-count-token');
}
function count() {
  document.querySelectorAll('#undo-toast,#message,#celebration').forEach(t => { t.hidden = true; });
  const bar = document.querySelector('.ch-tabbar').getBoundingClientRect(), solid = bar.top - 4;   // below this line the scrim is opaque page colour
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]')].filter(e => {
    if (e.closest('dialog:not([open])') || e.closest('.view[hidden]') || e.closest('#undo-toast') || e.closest('#gym')) return false;
    const r = e.getBoundingClientRect(), style = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  const inDock = e => !!e.closest('.ch-tabbar, .ch-snap'), nav = e => inDock(e) || !!e.closest('#week, .ch-datebar');
  const firstPaint = controls.filter(e => { const r = e.getBoundingClientRect(); return inDock(e) || (r.bottom > 0 && r.top < solid); });
  const label = e => (e.getAttribute('aria-label') || e.textContent || e.id || e.className).trim().replace(/\s+/g, ' ').slice(0, 30);
  return { firstPaint: firstPaint.length, firstActions: firstPaint.filter(e => !nav(e)).length, fullScroll: controls.length, fullActions: controls.filter(e => !nav(e)).length,
    firstActionList: firstPaint.filter(e => !nav(e)).map(label), fullList: controls.map(label) };
}
const SCENES = [['morning, nothing logged', 'empty', '08:00'], ['midday, nothing logged', 'empty', '12:00'], ['gym window, 2 meals logged', 'logged', '16:30'], ['evening, 2 meals logged', 'logged', '19:00']];
const VERSIONS = [['v11', 8101, V11], ['v12', 8102, null]];
const PLATE = { name: 'Synthetic chicken plate', grams: 300, kcal: 600, protein_g: 60, carbs_g: 45, fat_g: 20, items: [] };

(async () => {
  const servers = await Promise.all(VERSIONS.map(([, port, commit]) => serve(port, commit ? { handler: fromGit(commit) } : {}))), browser = await launch(), results = [], taps = {};
  try {
    const open = async (port, day, time) => {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await context.newPage();
      await context.route('**/estimate', async route => { await new Promise(r => setTimeout(r, 300)); route.fulfill({ contentType: 'application/json', body: JSON.stringify(PLATE) }); });
      // iPhone safe areas from the very first frame (as on a phone), before any script lays the page out; and a camera.
      await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, ':root{--ch-sat:47px;--ch-sab:34px}');
      await page.addInitScript(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 640, 480); }; draw(); setInterval(draw, 100); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(10) } }); });
      await page.clock.install({ time: new Date('2026-11-24T' + time + ':00+09:30') });
      await page.goto(`http://127.0.0.1:${port}/`); await page.evaluate(seed, day); await page.reload();
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
      // A user's taps only (not a button opening the file picker on their behalf).
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', e => { if (e.isTrusted) window.qaTaps++; }, true); });
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
      // The usual lunch at noon: the pinned ½ chicken, one tap.
      let { context, page } = await open(port, 'empty', '12:00');
      await page.evaluate(() => { window.qaTaps = 0; });
      await tapped(page, page.locator('#now [data-slot=L][data-tier=S]'));
      const lunch = (await entries(page)).find(e => e.kcal === 715);
      Object.assign(t, { lunch: await page.evaluate(() => window.qaTaps), lunchSaved: !!lunch && lunch.protein === 108 && (await today(page)).picks?.L === 'S' });
      await context.close();
      // Water, at each time of day: one tap, wherever it sits (v12: the water card, all day).
      t.water = {};
      for (const [, day, time] of SCENES) {
        ({ context, page } = await open(port, day, time));
        const before = (await today(page)).water || 0;
        await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page, page.locator('.water-row').first());
        t.water[time] = await page.evaluate(() => window.qaTaps); t.waterSaved = (t.waterSaved ?? true) && (await today(page)).water === before + .5;
        await context.close();
      }
      // One set in Gym mode (kg and reps filled in; a loaded move with no history needs its weight typed once).
      ({ context, page } = await open(port, 'empty', '16:30'));
      await tapped(page, page.locator('#now [data-gym-start]'));
      const fill = (await page.locator('#gym-kg').inputValue()) ? 0 : 1; if (fill) await page.locator('#gym-kg').fill('20');
      await page.evaluate(() => { window.qaTaps = 0; }); await tapped(page, page.locator('#gym-go'));
      Object.assign(t, { set: await page.evaluate(() => window.qaTaps), setTyped: fill, setSaved: (await today(page)).workout?.sets?.length === 1 });
      await context.close();
      // The two favourites: one tap each.
      for (const [key, id, name, m] of [['yopro', 'yopro-pouch', 'YoPRO Perform pouch', [120, 20.1, 6.8, 1.2]], ['gochi', 'gochi-noodle', 'Gochi noodle meal', [225, 31.8, 25.2, 2.6]]]) {
        ({ context, page } = await open(port, 'empty', '12:00'));
        await page.evaluate(() => { window.qaTaps = 0; });
        await tapped(page, page.locator(`#quick [data-fav="${id}"]`));
        const e = (await entries(page)).find(x => x.name === name);
        Object.assign(t, { [key]: await page.evaluate(() => window.qaTaps), [key + 'Saved']: !!e && [e.kcal, e.protein, e.carbs, e.fat].join() === m.join() });
        await context.close();
      }
      // A photo of food, logged. v12: the round +, the shutter, Done (the card opens by itself when the answer is in).
      // v11: + Food, Ask AI, the photo button (the system picker is not a tap in the app), Add to meal, Log.
      ({ context, page } = await open(port, 'empty', '12:00'));
      await page.evaluate(() => { window.qaTaps = 0; });
      if (version === 'v12') {
        await tapped(page, page.locator('#open-camera')); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0);
        await tapped(page, page.locator('#camera12-shutter'));
        await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready');
        await tapped(page, page.locator('#n12-done')); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
      } else {
        await tapped(page, page.locator('#add-food')); await tapped(page, page.locator('#builder-ask-go'));
        const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#806a50'; g.fillRect(0, 0, 800, 600); return c.toDataURL('image/png').split(',')[1]; });
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tapped(page, page.locator('#camera-button'))]);
        await chooser.setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
        await page.locator('#confirm-sheet').waitFor({ state: 'visible' }); await tapped(page, page.locator('#confirm-log'));
        await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tapped(page, page.locator('#builder-log'));
      }
      await page.waitForTimeout(300);
      const photo = (await entries(page)).find(x => x.kcal === 600 || /Synthetic chicken plate/.test(x.name));
      Object.assign(t, { photo: await page.evaluate(() => window.qaTaps), photoSaved: !!photo });
      await context.close();
    }
  } finally { await browser.close(); servers.forEach(s => s.close()); }
  if (process.argv.includes('--json')) return console.log(JSON.stringify({ results, taps }, null, 1));
  console.log('Today at 393x852 (DPR 3, iPhone safe areas), visible buttons + links + inputs, toasts hidden, Tue 24 Nov in Darwin:');
  let worse = false;
  const pad = n => String(n).padStart(2);
  for (const [scene] of SCENES) {
    const [a, b] = VERSIONS.map(([v]) => results.find(r => r.version === v && r.scene === scene));
    console.log(`  ${scene.padEnd(28)} first screen: v11 ${pad(a.firstPaint)} -> v12 ${pad(b.firstPaint)} (actions ${a.firstActions} -> ${b.firstActions})    full scroll: v11 ${pad(a.fullScroll)} -> v12 ${pad(b.fullScroll)} (actions ${a.fullActions} -> ${b.fullActions})`);
    console.log(`    v12 first-screen actions: ${b.firstActionList.join(' | ')}`);
    if (b.firstActions >= LIMIT) { worse = true; console.error(`    FAIL first-screen actions ${b.firstActions}: must be fewer than ${LIMIT}`); }
  }
  const t = taps.v12, o = taps.v11, water = w => Object.entries(w).map(([time, n]) => time + ' ' + n).join(', ');
  console.log(`Taps (v12): the usual lunch ${t.lunch} (v11 ${o.lunch}); 500 mL water ${water(t.water)} (v11 ${water(o.water)}); one set in Gym mode ${t.set} (v11 ${o.set}); YoPRO Perform pouch ${t.yopro} (v11 ${o.yopro}); Gochi noodle meal ${t.gochi} (v11 ${o.gochi}); a photo of food logged ${t.photo} (v11 ${o.photo}).`);
  for (const [v, x] of Object.entries(taps)) if (!x.lunchSaved || !x.waterSaved || !x.setSaved || !x.yoproSaved || !x.gochiSaved || !x.photoSaved) { console.error('FAIL a counted action did not save in ' + v + ': ' + JSON.stringify(x)); process.exitCode = 1; }
  if (t.lunch !== 1 || Object.values(t.water).some(n => n !== 1) || t.set !== 1 || t.yopro !== 1 || t.gochi !== 1 || t.photo !== 3) { console.error('FAIL the usual lunch, water, a set, YoPRO and Gochi noodle must be one tap each, and a photo log three'); process.exitCode = 1; }
  if (worse) { console.error('FAIL v12 has too many actions on its first screen'); process.exitCode = 1; }
  else if (!process.exitCode) console.log(`PASS v12's first screen has fewer than ${LIMIT} action controls at all four times (navigation aside: the week strip, the tab bar with its +, the gear), and the usual lunch, water (any time), a set, YoPRO and Gochi noodle are one tap each; a photo of food is logged in three (+, shutter, Done).`);
})().catch(e => { console.error(e); process.exitCode = 1; });
