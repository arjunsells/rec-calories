// Screenshots from a disposable copy of the shell, with synthetic meal/quest data only. No browser profile, user journal,
// key, measurement, medication or photo is read. Output goes OUTSIDE the repository (or into the ignored .qa folder).
//   node scripts/v9-screenshots.cjs            the final set -> ../rec-calories-shots (override with CHAD_SHOTS):
//                                              v9-today-dark, v9-today-light, v9-training, v9-meal-detail, v9-progress
//   node scripts/v9-screenshots.cjs --review   every screen, light and dark, 393x852 and 375x667 -> .qa/v9-review
// Transient toasts are always dismissed before a capture, so nothing covers the header.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, shellFiles, root: repo, IPHONE } = require('./harness.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chad-v9-shot-shell-'));
const review = process.argv.includes('--review');
const output = review ? path.join(repo, '.qa', 'v9-review') : process.env.CHAD_SHOTS || path.resolve(repo, '../rec-calories-shots');
for (const file of ['sw.js', ...shellFiles().filter(f => f !== './')]) { const dest = path.join(dir, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(repo, file), dest); }

// A believable mid-evening day after 40 days on the plan: lunch and pre-gym logged, a coffee, most of the water,
// three quests, three exercises. All synthetic.
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

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = await serve(8093, { dir }), browser = await launch();
  try {
    const matrix = review ? [[393, 852, 'dark'], [393, 852, 'light'], [375, 667, 'dark'], [375, 667, 'light']] : [[393, 852, 'dark'], [393, 852, 'light']];
    for (const [width, height, theme] of matrix) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce' }), page = await context.newPage(), errors = watch(page);
      await page.clock.install({ time: new Date('2026-11-24T19:00:00+09:30') }); await page.goto('http://127.0.0.1:8093/');
      await page.evaluate(seed); await page.reload(); await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}' });
      const tag = review ? `-${width}-${theme}` : '', top = () => page.evaluate(() => scrollTo(0, 0));
      // Nothing transient on the picture: toasts and banners are dismissed, and taps have settled.
      const quiet = () => page.evaluate(() => { CHADUX.hideToast(true); for (const id of ['message', 'celebration']) document.getElementById(id).hidden = true; document.querySelector('.ch-app').removeAttribute('data-shield'); });
      const shoot = async name => {
        await quiet(); await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ch-toast')].some(t => !t.hidden && t.textContent.trim() && getComputedStyle(t).display !== 'none')), false, name + ': no toast on the picture');
        await page.screenshot({ path: path.join(output, name + tag + '.png') });
      };
      const tab = async view => { await page.locator(`[data-view=${view}]`).tap(); await top(); };
      if (review) {
        await shoot('today'); await page.evaluate(() => scrollTo(0, 420)); await shoot('today-mid'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('today-end'); await top();
        await page.locator('#week-toggle').tap(); await shoot('today-week'); await page.locator('#week-toggle').tap();
        await page.locator('[data-meal-row=L]').tap(); await page.evaluate(() => scrollTo(0, 300)); await shoot('today-open-row'); await page.waitForTimeout(420); await page.locator('[data-meal-toggle=L]').tap(); await top();
        await page.locator('[data-slot=D][data-tier=S]').tap(); await page.waitForTimeout(80); await page.screenshot({ path: path.join(output, 'toast' + tag + '.png') }); await page.locator('#undo-toast button').tap(); await top();
        await page.evaluate(() => CHADUX.navigate(-1)); await shoot('yesterday'); await page.locator('#return-today').tap();
        await page.locator('#next-up .meal-info').tap(); await shoot('meal-detail'); await page.keyboard.press('Escape');
        await page.locator('#entries .entry-open').first().tap(); await shoot('entry-sheet'); await page.keyboard.press('Escape');
        await page.locator('#today-scan').tap(); await shoot('add-sheet');
        for (const kind of ['camera', 'search', 'barcode', 'manual']) { await page.locator(`[data-add=${kind}]`).tap(); await shoot(kind + '-sheet'); await page.keyboard.press('Escape'); await page.locator('#today-scan').tap(); }
        await page.keyboard.press('Escape');
        await tab('training'); await shoot('training'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('training-end'); await top();
        await page.locator('.is-today .exercise-info').first().tap(); await shoot('exercise-sheet'); await page.keyboard.press('Escape');
        await tab('history'); await shoot('progress'); for (const [y, name] of [[620, 'progress-charts'], [1500, 'progress-charts-2'], [2500, 'progress-heat']]) { await page.evaluate(y => scrollTo(0, y), y); await shoot(name); }
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shoot('progress-end'); await top();
        await tab('settings'); await shoot('settings'); await page.evaluate(() => scrollTo(0, 760)); await shoot('settings-mid');
        await page.evaluate(() => { document.getElementById('advanced-settings').open = true; document.querySelector('#advanced-settings details').open = true; scrollTo(0, document.body.scrollHeight); }); await shoot('settings-advanced');
        await page.evaluate(() => localStorage.removeItem('rec-calories-v1')); await page.reload(); await page.addStyleTag({ content: height > 700 ? ':root{--ch-sat:47px;--ch-sab:34px}' : ':root{--ch-sat:20px}' }); await shoot('empty');
      } else {
        await shoot('v9-today-' + theme);
        if (theme === 'dark') {
          await page.locator('#next-up .meal-info').tap(); await shoot('v9-meal-detail'); await page.keyboard.press('Escape');
          await tab('training'); await shoot('v9-training');
          await tab('history'); await shoot('v9-progress');
        }
      }
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS screenshots: ' + output + (review ? '' : ' (v9-today-dark, v9-today-light, v9-training, v9-meal-detail, v9-progress)') + '; disposable shell copy: ' + dir);
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
