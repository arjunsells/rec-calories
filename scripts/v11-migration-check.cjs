// v10 -> v11 with zero loss, on the same origin (so the same localStorage), with a realistic v10 dataset made by the
// shipped v10 itself (main 47c498e, read from Git): 47 days of history (meals, water, habits, a missed day, three weeks
// of finished workouts with records), then, in the v10 app's own screens: lunch, water, a habit, a custom dinner saved
// as a favourite, a workout started with two sets and left open, a draft meal in the builder, the theme, sounds, a
// synthetic weigh-in, a missed day, and an own AI key. Then v11 opens it:
//   - the journal is every v10 field, unchanged, plus appVersion: 11; the v10 journal is kept byte for byte under
//     rec-calories-v10-backup; every device key (Gym mode, the draft, the theme, the AI key, the milestone, the food
//     cache) is untouched;
//   - v11 shows the same streak, water streak, workouts, records, saved meal, theme, sounds, weigh-in, missed day, and the
//     open workout resumes with its sets;
//   - a change in v11 (water) is a normal journal change;
//   - v10 opened again reads what v11 wrote, shows the same things, and loses nothing (appVersion stays).
// Synthetic data only, in a disposable browser profile.
const assert = require('node:assert/strict'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, watch, saved, root, MIME, IPHONE } = require('./harness.cjs');
const V10 = '47c498e', TODAY = '2026-11-24';
let phase = 'v10';
const fromGit = new Map();
const handler = (pathname, res) => {
  if (phase !== 'v10') return false;                                              // v11: the working tree
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { if (!fromGit.has(file)) fromGit.set(file, execFileSync('git', ['show', V10 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024 })); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(fromGit.get(file)); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// 47 days on the plan since Day 1, as v10 stores them: picks + plan entries, water, habits, a missed day, and three weeks
// of finished workouts with slowly rising weights (so there are records). Runs in the page (the plan is there).
function history(today) {
  const q = CHADQuest, T = CHADTrain, s = JSON.parse(localStorage.getItem('rec-calories-v1')) || {};
  Object.assign(s, { journeyStartDate: '2026-10-08', entries: s.entries || [], questsV5: s.questsV5 || {} });
  const meal = (key, id, tier) => { const slot = CHADPlan.find(x => x.id === id), c = slot.choices.find(c => c.tier === tier); s.entries.push({ id: 'plan-' + key + '-' + id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: id }); return tier; };
  const base = { 'Incline DB press': 22.5, 'Machine chest press': 50, 'Low-to-high cable fly': 12.5, 'Seated DB shoulder press': 20, 'Cable side raise': 7.5, 'Overhead cable triceps ext': 20, 'Pull-ups': 0, 'Chest-supported row': 50, 'Single-arm pulldown': 30, 'Rear delt fly': 8, 'DB shrugs': 32.5, 'Incline DB curl': 12.5, 'Hanging leg raise': 0, 'Machine side raise': 30, 'Machine shoulder press': 45, 'Reverse pec deck': 35, 'EZ curl': 25, Pushdown: 25, 'Hammer curl': 14, Dips: 0, 'Cable crunch': 40, 'Smith incline': 50, 'T-bar or seal row': 45, 'Lat pulldown': 55, 'Straight-arm pulldown': 25, 'Side raise': 9, 'Hill sprints': 0, 'Hack squat': 80, RDL: 80, 'Leg press': 140, 'Seated leg curl': 45, 'Leg extension': 50, 'Calf raise': 70 };
  for (let n = 47; n >= 1; n--) {
    const key = q.shift(today, -n), tiers = n % 9 === 0 ? 'MSF' : n % 4 === 0 ? 'SMS' : 'SSS', d = { picks: {}, water: n <= 6 || n % 5 ? q.waterGoal(key) : 3, steps: n % 6 !== 0, sleep: n % 3 !== 0, electrolyte: n % 2 === 0 };
    if (n % 8 === 3) continue;
    ['L', 'D', 'P'].forEach((id, i) => { d.picks[id] = meal(key, id, tiers[i]); });
    const p = T.plan(key);
    if (n <= 21 && p.kind === 'gym') {
      const week = Math.floor((21 - n) / 7), start = Date.parse(key + 'T16:05:00+09:30'); let at = start + 6 * 60000; const sets = [];
      for (const e of p.ex) for (let k = 0; k < e.sets; k++) { sets.push({ x: e.name, kg: e.kind === 'time' ? 0 : base[e.name] + (e.kind === 'kg' ? week * 2.5 : 0), reps: e.kind === 'time' ? 12 : e.reps[0] + 1 + week, at }); at += (e.rest + 45) * 1000; }
      d.workout = { id: p.id, start, end: at + 60000, sets }; d.training = true; d.cardio = true;
    } else if (p.kind !== 'gym') { d.training = p.kind === 'class'; d.cardio = true; }
    s.questsV5[key] = d;
  }
  s.legacyRewards = { xp: 260 };                                                   // as a pre-v5 journal carried along
  localStorage.setItem('rec-calories-v1', JSON.stringify(s));
}

(async () => {
  const server = await serve(8106, { handler }), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(), errors = watch(page);
    await page.clock.install({ time: new Date(TODAY + 'T12:00:00+09:30') });
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const storageNow = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));

    // 1. The shipped v10 builds the dataset.
    await page.goto('http://127.0.0.1:8106/'); await page.waitForFunction(() => window.CHADQuest && document.querySelector('#week-toggle'));
    assert.equal(await page.evaluate(() => typeof window.CHADFavourites), 'undefined', 'this really is v10');
    await page.evaluate(history, TODAY); await page.reload(); await page.waitForFunction(() => document.querySelector('.meal-pick'));
    await tap(page.locator('#next-up [data-slot=L][data-tier=S]'));                  // lunch, the pinned go-to
    for (let i = 0; i < 3; i++) await again(page.locator('.water-row'));            // 1.5 L
    await again(page.locator('[data-row=wrap]')); await again(page.locator('#today [data-quest=sleep]'));
    // A custom dinner, saved as my meal, logged; then a draft left in the builder.
    await again(page.locator('#next-up [data-custom]')); await tap(page.locator('#builder-chips [data-food=chook]')); await tap(page.locator('#builder-chips [data-food=potatoes]'));
    await tap(page.locator('#builder-save')); await tap(page.locator('#builder-log'));
    assert.equal((await saved(page)).questsV5[TODAY].picks.D, 'C');
    await again(page.locator('#next-up [data-custom]')); await tap(page.locator('#builder-chips [data-food=eggs]')); await page.keyboard.press('Escape');
    // Today's Pull: started, two sets, left open (minimised).
    await page.locator('[data-view=training]').tap(); await tap(page.locator('.is-today [data-gym-start]'));
    await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]')); await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]'));
    await tap(page.locator('[data-gym=close]'));
    // Settings: dark, sounds on, a synthetic weigh-in, a missed day; and an own AI key on this device.
    await page.locator('[data-view=settings]').tap();
    await page.locator('#theme-mode [data-theme-option=dark]').tap(); await page.locator('#sound-toggle').check();
    await page.locator('#local-weight').fill('70.1'); await page.locator('#local-weight').dispatchEvent('change');   // synthetic
    await page.evaluate(() => CHADUX.goTo('2026-10-20')); await page.locator('#missed-day').check(); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    await page.evaluate(() => localStorage.setItem('rec-calories-ai-key', 'synthetic-key-for-tests'));
    await page.waitForTimeout(300);
    const v10Journal = await saved(page), v10Storage = await storageNow(), v10Raw = v10Storage['rec-calories-v1'];
    assert.equal(v10Journal.appVersion, undefined); assert.equal(v10Storage['rec-calories-v10-backup'], undefined);
    for (const k of ['chad.gym', 'chad.builder', 'rec-calories-theme', 'rec-calories-ai-key']) assert.ok(v10Storage[k], 'v10 wrote ' + k);
    assert.ok(v10Journal.myMeals?.length === 1 && v10Journal.questsV5[TODAY].workout.sets.length === 2 && !v10Journal.questsV5[TODAY].workout.end && v10Journal.questsV5['2026-10-20'].missed === true && v10Journal.questsV5[TODAY].weight === 70.1);   // synthetic weigh-in
    await page.locator('[data-view=history]').tap();
    const v10Shown = await page.evaluate(() => ({ streak: document.getElementById('home-streak').getAttribute('aria-label'), water: document.getElementById('water-streak').textContent, workouts: [...document.querySelectorAll('#workouts [data-workout]')].map(b => b.dataset.workout + ' ' + b.querySelector('.ch-cell__name').textContent + ' ' + b.querySelector('.ch-cell__status').textContent), records: [...document.querySelectorAll('#records [data-record]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), counts: [document.getElementById('workout-count').textContent, document.getElementById('pr-count').textContent] }));
    assert.equal(v10Shown.streak, '35 day streak', 'v10: the missed 20 Oct restarts the streak (21 Oct to 24 Nov)'); assert.ok(v10Shown.records.length >= 20 && v10Shown.workouts.length >= 8);

    // 2. v11 opens the same storage.
    phase = 'v11'; await page.goto('http://127.0.0.1:8106/'); await page.waitForFunction(() => window.CHADFavourites && document.getElementById('now').dataset.now);
    const v11Journal = await saved(page), v11Storage = await storageNow();
    assert.deepEqual(v11Journal, { ...v10Journal, appVersion: 11 }, 'every v10 field, unchanged; only appVersion: 11 added');
    assert.equal(v11Storage['rec-calories-v10-backup'], v10Raw, 'the v10 journal, byte for byte');
    for (const [k, v] of Object.entries(v10Storage)) if (k !== 'rec-calories-v1') assert.equal(v11Storage[k], v, k + ' untouched');
    assert.deepEqual(Object.keys(v11Storage).sort(), [...Object.keys(v10Storage), 'rec-calories-v10-backup'].sort(), 'no key removed, one added');
    assert.equal(v11Journal.legacyRewards.xp, 260, 'stored XP stays stored (just not shown)');
    // What v11 shows from it.
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), v10Shown.streak);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'water', 'noon, lunch and dinner in, water at 1.5 of 4.5 L: water');
    assert.match(await page.locator('.water-row').innerText(), /1\.5/);
    await page.locator('[data-view=history]').tap();
    const v11Shown = await page.evaluate(() => ({ water: document.getElementById('water-streak').textContent, workouts: [...document.querySelectorAll('#workouts [data-workout]')].map(b => b.dataset.workout + ' ' + b.querySelector('.ch-cell__name').textContent + ' ' + b.querySelector('.ch-cell__status').textContent), records: [...document.querySelectorAll('#records [data-record]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), counts: [document.getElementById('workout-count').textContent, document.getElementById('pr-count').textContent] }));
    assert.deepEqual(v11Shown, { water: v10Shown.water, workouts: v10Shown.workouts, records: v10Shown.records, counts: v10Shown.counts }, 'the same water streak, workouts and records');
    await page.locator('[data-view=today]').tap(); await page.locator('#open-settings').tap();
    assert.equal(await page.locator('#sound-toggle').isChecked(), true); assert.equal(await page.locator('#local-weight').inputValue(), '70.1');   // synthetic weigh-in
    assert.equal(await page.locator('#theme-mode [aria-pressed=true]').getAttribute('data-theme-option'), 'dark');
    await page.evaluate(() => CHADUX.goTo('2026-10-20')); assert.equal(await page.locator('#missed-day').isChecked(), true); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    assert.equal(await page.evaluate(() => RECScan.settings().mode), 'key', 'the own key still works');
    // The saved dinner is a favourite on dinner; the draft is still in the add-food sheet; the open workout resumes.
    await page.locator('[data-view=training]').tap(); assert.match(await page.locator('.is-today [data-gym-start]').innerText(), /Resume/);
    await tap(page.locator('.is-today [data-gym-start]')); assert.equal(await page.locator('#gym').isVisible(), true); assert.equal(await page.locator('#gym-dots .is-done').count(), 2, 'both sets');
    await tap(page.locator('[data-gym=close]'));
    await page.evaluate(() => CHADBuilder.open('D')); assert.deepEqual(await page.locator('#builder-items [data-item]').evaluateAll(n => n.map(e => e.dataset.item)), ['eggs'], 'the draft');
    assert.equal(await page.locator(`#builder-chips [data-food="mine:${v10Journal.myMeals[0].id}"]`).count(), 1, 'the saved meal is a favourite here'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage.getItem('chad.builder'))), JSON.stringify(v10Storage['chad.builder']), 'opening the draft does not rewrite it');
    // A change in v11 is an ordinary journal change.
    await page.locator('[data-view=today]').tap(); await tap(page.locator('.water-row'));
    const changed = await saved(page); assert.equal(changed.questsV5[TODAY].water, 2); assert.equal(changed.appVersion, 11);
    assert.deepEqual({ ...changed, questsV5: { ...changed.questsV5, [TODAY]: { ...changed.questsV5[TODAY], water: 1.5 } } }, { ...v10Journal, appVersion: 11 }, 'only the water changed');
    assert.equal((await storageNow())['rec-calories-v10-backup'], v10Raw, 'the backup is never rewritten');

    // 3. v10 again (an older copy still open somewhere): it reads what v11 wrote, and loses nothing.
    phase = 'v10'; await page.goto('http://127.0.0.1:8106/'); await page.waitForFunction(() => window.CHADQuest && document.querySelector('#week-toggle') && !window.CHADFavourites);
    const back = await saved(page);
    assert.deepEqual(back, changed, 'v10 rewrites the v11 journal unchanged (appVersion included)');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), v10Shown.streak); assert.match(await page.locator('.water-total').innerText(), /^2/);
    await page.locator('[data-view=history]').tap();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#records [data-record]')].map(r => r.textContent.replace(/\s+/g, ' ').trim())), v10Shown.records);
    assert.deepEqual(errors, []);
    console.log(`PASS v10 -> v11 with zero loss: a v10 dataset made by the shipped v10 (47 days, ${v10Shown.workouts.length} workouts shown, ${v10Shown.records.length} records, a saved meal, an open workout with 2 sets, a builder draft, dark theme, sounds, a synthetic weigh-in, a missed day, an own key) -> v11: every journal field unchanged + appVersion 11, the v10 journal kept byte for byte (never rewritten), every device key untouched, the same streak (${v10Shown.streak}), water streak, workouts and records, settings, saved meal, draft and Resume; a v11 change is an ordinary change; v10 reads the v11 journal back with nothing lost.`);
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
