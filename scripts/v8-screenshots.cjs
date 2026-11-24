// Review screenshots from a disposable copy of the shipped shell, with synthetic meal/quest data only.
// No browser profile, user journal, key, measurement, medication or photo is read. Output goes OUTSIDE the repository.
//   node scripts/v8-screenshots.cjs            final set -> ../rec-calories-shots (override with CHAD_SHOTS)
//   node scripts/v8-screenshots.cjs --review   every screen, both themes, both sizes -> <output>/review
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, shellFiles, root: repo, IPHONE } = require('./harness.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chad-v8-shot-shell-'));
const output = process.env.CHAD_SHOTS || path.resolve(repo, '../rec-calories-shots'), review = process.argv.includes('--review');
for (const file of ['sw.js', ...shellFiles().filter(f => f !== './')]) { const dest = path.join(dir, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(repo, file), dest); }

// A believable mid-evening day: two meals logged, most of the water, three quests, three exercises.
const seed = () => {
  const state = { schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [], questsV5: {} };
  for (let n = 1; n <= 40; n++) {
    const key = CHADQuest.shift('2026-11-24', -n), tiers = n % 9 === 0 ? 'SSMF' : n % 4 === 0 ? 'SSMS' : 'SSSS';
    CHADPlan.forEach((slot, i) => { const c = slot.choices.find(c => c.tier === tiers[i]); state.entries.push({ id: 'plan-' + key + '-' + slot.id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id }); });
    state.questsV5[key] = { picks: Object.fromEntries(CHADPlan.map((slot, i) => [slot.id, tiers[i]])), water: n % 6 === 0 ? 3.5 : CHADQuest.waterGoal(key), steps: n % 5 !== 0, sleep: n % 3 !== 0, electrolyte: n % 2 === 0, training: n % 7 !== 3, topSets: n === 7 ? { 'Pull-ups': { kg: 10, reps: 8 }, 'Chest-supported row': { kg: 60, reps: 10 } } : undefined };
  }
  for (const id of ['L', 'P']) { const slot = CHADPlan.find(s => s.id === id), c = slot.choices[0]; state.entries.push({ id: 'plan-2026-11-24-' + id, day: '2026-11-24', name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); }
  state.entries.push({ id: 'demo-coffee', day: '2026-11-24', name: 'Flat white', kcal: 120, protein: 8, carbs: 10, fat: 6, meal: 'Snacks', source: 'manual' });
  state.questsV5['2026-11-24'] = { picks: { L: 'S', P: 'S' }, water: 3.5, electrolyte: true, steps: true, sleep: true, exercises: { 0: true, 1: true, 2: true } };
  localStorage.setItem('rec-calories-v1', JSON.stringify(state));
};
// A generic home screen: placeholder tiles (no real app artwork), the CHAD icon at its real 60pt size.
const home = icon => `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:393px;height:852px;overflow:hidden;font:500 12px/1 -apple-system,"Segoe UI",system-ui,sans-serif;color:#fff;background:radial-gradient(120% 70% at 20% 0,#3b5c9a 0,#1b2f5e 38%,#0b1430 72%,#060a18 100%)}
.status{height:54px;padding:18px 30px 0;display:flex;justify-content:space-between;font:600 16px/1 -apple-system,"Segoe UI",sans-serif}.status i{font-style:normal;letter-spacing:2px;font-size:12px;opacity:.9}
.grid{display:grid;grid-template-columns:repeat(4,60px);justify-content:space-between;gap:26px 0;padding:22px 27px 0}
.app{display:grid;justify-items:center;gap:7px;width:60px}.app b{width:60px;height:60px;border-radius:13.5px;display:grid;place-items:center;box-shadow:0 6px 14px rgba(0,0,0,.28)}.app b::after{content:"";width:26px;height:26px;border-radius:var(--r,8px);background:rgba(255,255,255,.9)}
.app span{white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)}.app img{width:60px;height:60px;border-radius:13.5px;display:block;box-shadow:0 6px 14px rgba(0,0,0,.34)}
.dock{position:absolute;left:12px;right:12px;bottom:14px;height:92px;border-radius:34px;background:rgba(255,255,255,.2);backdrop-filter:blur(20px);display:flex;justify-content:space-around;align-items:center;padding:0 12px}
.dots{position:absolute;left:0;right:0;bottom:122px;text-align:center;letter-spacing:6px;opacity:.75;font-size:9px}
</style><div class="status"><span>9:41</span><i>&#9679;&#9679;&#9679;&#9679; &#9646;</i></div><div class="grid">${
    [['#34c759', 'Notes', '6px'], ['#ff9500', 'Photos', '50%'], ['#5856d6', 'Music', '50%'], ['#8e8e93', 'Settings', '9px'], ['#ff2d55', 'Health', '50% 50% 8px 8px'], ['#007aff', 'Mail', '5px'], ['#30b0c7', 'Maps', '50% 8px'], null, ['#ffcc00', 'Reminders', '4px'], ['#5ac8fa', 'Weather', '50%'], ['#af52de', 'Podcasts', '50% 50% 4px 4px'], ['#ff3b30', 'Calendar', '6px']]
      .map(a => a ? `<div class="app"><b style="background:linear-gradient(160deg,${a[0]},color-mix(in srgb,${a[0]} 62%,#000));--r:${a[2]}"></b><span>${a[1]}</span></div>` : `<div class="app"><img src="${icon}" alt=""><span>CHAD</span></div>`).join('')
  }</div><div class="dots">&#9679; &#9675; &#9675;</div><div class="dock">${['#34c759', '#007aff', '#ff9500', '#5856d6'].map(c => `<div class="app"><b style="background:linear-gradient(160deg,${c},color-mix(in srgb,${c} 62%,#000))"></b></div>`).join('')}</div>`;

(async () => {
  const out = review ? path.join(output, 'review') : output;
  fs.mkdirSync(out, { recursive: true });
  const server = await serve(8093, { dir }), browser = await launch();
  try {
    const matrix = review ? [[393, 852, 'dark'], [393, 852, 'light'], [375, 667, 'dark'], [375, 667, 'light']] : [[393, 852, 'dark'], [393, 852, 'light'], [375, 667, 'dark']];
    for (const [width, height, theme] of matrix) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce' }), page = await context.newPage(), errors = watch(page);
      await page.clock.install({ time: new Date('2026-11-24T19:00:00+09:30') }); await page.goto('http://127.0.0.1:8093/');
      await page.evaluate(seed); await page.reload(); await page.evaluate(() => document.fonts.ready);
      if (height > 700) await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px}' }); else await page.addStyleTag({ content: ':root{--ch-sat:20px}' });
      const tag = review ? `-${width}-${theme}` : '', top = () => page.evaluate(() => scrollTo(0, 0));
      const shoot = async name => { await page.waitForTimeout(80); await page.screenshot({ path: path.join(out, name + tag + '.png') }); };
      const tab = async view => { await page.locator(`[data-view=${view}]`).tap(); await top(); };
      if (review) {
        await shoot('today'); await page.evaluate(() => scrollTo(0, 360)); await shoot('today-mid'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('today-end'); await top();
        await page.locator('[data-slot=D][data-tier=S]').tap(); await shoot('toast'); await page.locator('#undo-toast button').tap();
        await page.locator('#previous-day').tap(); await shoot('yesterday'); await page.locator('#return-today').tap();
        await page.locator('#next-up .meal-info').first().tap(); await shoot('meal-sheet'); await page.keyboard.press('Escape');
        await page.locator('#today-scan').tap(); await shoot('add-sheet');
        for (const kind of ['search', 'camera', 'barcode', 'manual']) { await page.locator(`[data-add=${kind}]`).tap(); await shoot(kind + '-sheet'); await page.keyboard.press('Escape'); await page.locator('#today-scan').tap(); }
        await page.keyboard.press('Escape');
        await tab('training'); await shoot('training'); await page.evaluate(() => scrollTo(0, 560)); await shoot('training-mid'); await top();
        await page.locator('.is-today .exercise-info').first().tap(); await shoot('exercise-sheet'); await page.keyboard.press('Escape');
        await tab('history'); await shoot('progress'); for (const [y, name] of [[620, 'progress-charts'], [1500, 'progress-charts-2'], [2500, 'progress-heat']]) { await page.evaluate(y => scrollTo(0, y), y); await shoot(name); }
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('progress-end'); await top();
        await page.locator('#open-level').tap(); await shoot('level'); await page.locator('#close-level').tap();
        await tab('settings'); await shoot('settings'); await page.evaluate(() => scrollTo(0, 700)); await shoot('settings-mid'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('settings-end');
        await page.evaluate(() => { localStorage.removeItem('rec-calories-v1'); }); await page.reload(); await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px}' }); await shoot('empty');
      } else if (width === 375) await shoot('v8-se');
      else {
        await shoot('v8-today-' + theme);
        await page.evaluate(() => scrollTo(0, 360)); await shoot('v8-today-scrolled-' + theme); await top();
        if (theme === 'dark') {
          await page.locator('[data-slot=D][data-tier=S]').tap(); await shoot('v8-toast'); await page.locator('#undo-toast button').tap();
          await page.locator('#next-up .meal-info').first().tap(); await shoot('v8-meal-sheet'); await page.keyboard.press('Escape');
          await page.locator('#today-scan').tap(); await shoot('v8-add-sheet'); await page.keyboard.press('Escape');
          await tab('training'); await shoot('v8-training');
          await tab('history'); await shoot('v8-progress');
          await tab('settings'); await shoot('v8-settings');
        }
      }
      assert.deepEqual(errors, []); await context.close();
    }
    // The icon: the shipped 512 and a home-screen mock at 60pt @3x (the apple-touch-icon's real size).
    fs.copyFileSync(path.join(repo, 'icons/icon-512.png'), path.join(output, 'v8-icon.png'));
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 }), page = await context.newPage();
    await page.setContent(home('data:image/png;base64,' + fs.readFileSync(path.join(repo, 'icons/apple-touch-icon.png')).toString('base64')));
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await page.screenshot({ path: path.join(output, 'v8-icon-home.png') }); await context.close();
    console.log('PASS screenshots: ' + out + (review ? '' : ' (v8-today-dark, v8-today-light, v8-training, v8-progress, v8-add-sheet, v8-icon-home, v8-icon, plus scrolled/toast/meal-sheet/settings/se)') + '; disposable shell copy: ' + dir);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
