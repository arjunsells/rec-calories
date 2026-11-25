// v11 -> v12 with zero loss, on the same origin (so the same localStorage), with a realistic v11 dataset made by the
// shipped v11 itself (main 566cc4e, read from Git): 47 days of history (meals, water, habits, three weeks of finished
// workouts with records) in a journal last written by v10, which v11 upgrades on its first open (so the device also
// holds rec-calories-v10-backup, as a real phone does); then, in the v11 app's own screens: lunch from the card on top,
// water, a habit in Later today, a custom dinner saved as my meal and logged, a Quick log favourite, a barcode food from
// the add-food sheet (Open Food Facts stubbed, so the food cache is written), a draft left in the add-food sheet, a
// workout started with two sets and left open, the theme, sounds, a synthetic weigh-in, a missed day (20 Oct: the streak
// restarts, 35 days, a milestone v11 celebrates once) and an own AI key. Then v12 opens it:
//   - the journal is every v11 field, unchanged, plus appVersion: 12; the v11 journal is kept byte for byte under
//     rec-calories-v11-backup; every device key (Gym mode, the draft, the theme, the AI key, the milestone, the food
//     cache, the v10 backup) is untouched;
//   - v12 shows the same streak, water streak, workouts, records, saved meal, recent foods, theme, sounds, weigh-in (in
//     the weight chart too), missed day and own key, and the open workout resumes with its sets (it is the thing to do
//     now at noon);
//   - a change in v12 (the water card) is an ordinary journal change, and the backup is never rewritten;
//   - a photo logged (and bookmarked: savedFoods12, a v12-only field) in v12, with a synthetic camera and a stubbed proxy,
//     stays in this device's IndexedDB: the journal gets its id, never an image (no data:image anywhere in localStorage);
//   - v11 opened again reads what v12 wrote, shows the same things and loses nothing, the bookmark included (it stamps
//     appVersion 11 back); v12 opened after that keeps its first backup and still finds the photo.
// Synthetic data only, in a disposable browser profile.
const assert = require('node:assert/strict'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { serve, launch, watch, saved, root, MIME, IPHONE, V11 } = require('./harness.cjs');
const TODAY = '2026-11-24', ORIGIN = 'http://127.0.0.1:8106', TOKEN = 'synthetic-device-token';
const OFF = { status: 1, product: { product_name: 'Synthetic barcode meal', serving_size: '100 g', nutriments: { 'energy-kcal_100g': 225, proteins_100g: 20, carbohydrates_100g: 25, fat_100g: 5 } } };
const PLATE = { name: 'Synthetic chicken plate', grams: 300, kcal: 600, protein_g: 60, carbs_g: 45, fat_g: 20, confidence: 0.7, items: [{ name: 'Chicken', grams: 200, kcal: 400, protein_g: 55, carbs_g: 0, fat_g: 18 }, { name: 'Rice', grams: 100, kcal: 200, protein_g: 5, carbs_g: 45, fat_g: 2 }] };
let phase = 'v11';
const fromGit = new Map();
const handler = (pathname, res) => {
  if (phase !== 'v11') return false;                                              // v12: the working tree
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try { if (!fromGit.has(file)) fromGit.set(file, execFileSync('git', ['show', V11 + ':' + file], { cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(fromGit.get(file)); }
  catch { res.writeHead(404); res.end('missing'); }
  return true;
};
// 47 days on the plan since Day 1, as v10 and v11 store them: picks + plan entries, water, habits, and three weeks of
// finished workouts with slowly rising weights (so there are records). Runs in the page (the plan is there). Written
// without appVersion, as v10 left it, so v11 makes its own backup of it on the next open.
function history(today) {
  const q = CHADQuest, T = CHADTrain, s = JSON.parse(localStorage.getItem('rec-calories-v1')) || {};
  Object.assign(s, { journeyStartDate: '2026-10-08', entries: s.entries || [], questsV5: s.questsV5 || {} });
  delete s.appVersion;
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
    // No real services: Open Food Facts answers one synthetic product, the photo proxy one synthetic plate.
    await context.route('**/api/v2/product/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(OFF) }));
    await context.route('**/estimate', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(PLATE) }));
    // A synthetic camera for v12's photo step: a canvas stream (v11 never asks for it).
    await context.addInitScript(() => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 960; const g = c.getContext('2d');
      const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 1280, 960); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(640, 480, 380, 0, 7); g.fill(); g.fillStyle = '#c98b3c'; g.fillRect(480, 360, 260, 160); };
      draw(); setInterval(draw, 100);
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(15) } });
    });
    const page = await context.newPage(), errors = watch(page);
    await page.clock.install({ time: new Date(TODAY + 'T12:00:00+09:30') });
    const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
    const again = async locator => { await page.waitForTimeout(450); await tap(locator); };
    const storageNow = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    // Progress, as both versions draw it, with every workout and record shown (v11 and v12 show five workouts, then
    // "Show N more"; v12 shows six records, then "Show all N").
    const progress = async () => {
      for (let n = 0; n < 12 && await page.locator('#workouts .entry--more button').count(); n++) await tap(page.locator('#workouts .entry--more button'));
      if (await page.locator('#records-toggle[aria-expanded=false]').count()) await tap(page.locator('#records-toggle'));
      return page.evaluate(() => {
        const text = id => document.getElementById(id).textContent;
        return { streak: document.getElementById('home-streak').getAttribute('aria-label'), since: (/since (\d+ \w+)/i.exec(text('streak')) || [])[1], water: text('water-streak'), best: (/best (\d+)/i.exec(text('water-streak-s')) || [])[1],
          workouts: [...document.querySelectorAll('#workouts [data-workout]')].map(b => b.dataset.workout + ' ' + b.querySelector('.ch-cell__name').textContent + ' ' + b.querySelector('.ch-cell__status').textContent),
          records: [...document.querySelectorAll('#records [data-record]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), counts: [text('workout-count'), text('pr-count')] };
      });
    };

    // 1. The shipped v11 builds the dataset.
    await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADQuest && window.CHADFavourites && document.getElementById('now')?.dataset.now);
    assert.deepEqual(await page.evaluate(() => [typeof window.CHADScan12, !!document.getElementById('left-more')]), ['undefined', true], 'this really is v11');
    await page.evaluate(history, TODAY); await page.reload(); await page.waitForFunction(() => document.querySelector('#now [data-slot=L][data-tier=S]'));
    await tap(page.locator('#now [data-slot=L][data-tier=S]'));                      // lunch, the pinned go-to, from the card on top
    for (let i = 0; i < 3; i++) await again(page.locator('.water-row'));            // 1.5 L (v11: water is the thing to do now)
    await again(page.locator('#later-toggle')); await again(page.locator('#later-more [data-quest=sleep]'));       // a habit, in Later today
    // A custom dinner (Later today), saved as my meal, logged.
    await again(page.locator('#later-more [data-later-slot=D] [data-custom=D]')); await tap(page.locator('#builder-chips [data-food=chook]')); await tap(page.locator('#builder-chips [data-food=potatoes]'));
    await tap(page.locator('#builder-save')); await tap(page.locator('#builder-log'));
    assert.equal((await saved(page)).questsV5[TODAY].picks.D, 'C');
    await again(page.locator('#quick [data-fav=yopro-pouch]'));                     // a Quick log favourite
    // Other food from the add-food sheet: a barcode (stubbed Open Food Facts), checked on the card, added, logged.
    await again(page.locator('#add-food')); await tap(page.locator('#builder-barcode'));
    await page.locator('#barcode').fill('9300000000017'); await tap(page.locator('#barcode-form button[type=submit]'));
    await page.waitForFunction(() => document.getElementById('confirm-sheet').open); await tap(page.locator('#confirm-log'));
    await page.waitForFunction(() => document.getElementById('builder-sheet').open && document.querySelectorAll('#builder-items [data-item]').length === 1);
    await tap(page.locator('#builder-log'));
    // A draft left in the add-food sheet.
    await again(page.locator('#add-food')); await tap(page.locator('#builder-chips [data-food=eggs]')); await page.keyboard.press('Escape');
    // Today's Pull: started from the Gym tab, two sets, left open (minimised).
    await page.locator('[data-view=training]').tap(); await tap(page.locator('.is-today [data-gym-start]'));
    await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]')); await tap(page.locator('#gym-go')); await tap(page.locator('[data-gym=skip]'));
    await tap(page.locator('[data-gym=close]'));
    // Settings (the gear): dark, sounds on, a synthetic weigh-in, a missed day; and an own AI key on this device.
    await page.locator('[data-view=today]').tap(); await page.locator('#open-settings').tap();
    await page.locator('#theme-mode [data-theme-option=dark]').tap(); await page.locator('#sound-toggle').check();
    await page.locator('#local-weight').fill('70.1'); await page.locator('#local-weight').dispatchEvent('change');   // synthetic
    await page.evaluate(() => CHADUX.goTo('2026-10-20')); await page.locator('#missed-day').check(); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    await page.locator('#ai-more summary').tap(); await page.locator('#ai-key').fill('synthetic-key-for-tests'); await page.locator('#ai-key').dispatchEvent('change');
    await page.locator('#close-settings').tap(); await page.waitForTimeout(300);
    const v11Journal = await saved(page), v11Storage = await storageNow(), v11Raw = v11Storage['rec-calories-v1'], day = v11Journal.questsV5[TODAY];
    assert.equal(v11Journal.appVersion, 11); assert.equal(v11Storage['rec-calories-v11-backup'], undefined);
    for (const k of ['chad.gym', 'chad.builder', 'chad.streakSeen', 'rec-calories-theme', 'rec-calories-ai-key', 'rec-calories-food-cache-v1', 'rec-calories-v10-backup']) assert.ok(v11Storage[k], 'v11 wrote ' + k);
    assert.equal(JSON.parse(v11Storage['rec-calories-v10-backup']).appVersion, undefined, 'the v10 journal v11 found');
    assert.equal(v11Storage['chad.streakSeen'], TODAY + ':35', 'the five-week milestone, celebrated once on this device');
    assert.ok(v11Journal.myMeals?.length === 1 && day.picks.L === 'S' && day.picks.D === 'C' && day.water === 1.5 && day.sleep === true && day.workout.sets.length === 2 && !day.workout.end && v11Journal.questsV5['2026-10-20'].missed === true && day.weight === 70.1);   // synthetic weigh-in
    assert.deepEqual(v11Journal.entries.filter(e => e.day === TODAY).map(e => e.source), ['plan', 'custom', 'favourite', 'barcode'], 'lunch, the custom dinner, a favourite and a barcode food');
    assert.deepEqual(JSON.parse(v11Storage['chad.builder']).items.map(it => it.key), ['eggs'], 'the draft');
    await page.locator('[data-view=history]').tap();
    const v11Shown = await progress();
    assert.deepEqual([v11Shown.streak, v11Shown.since], ['35 day streak', '21 Oct'], 'v11: the missed 20 Oct restarts the streak (21 Oct to 24 Nov)');
    assert.ok(v11Shown.records.length >= 20 && v11Shown.workouts.length >= 8);

    // 2. v12 opens the same storage.
    phase = 'v12'; await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADScan12 && document.getElementById('now')?.dataset.now);
    const v12Journal = await saved(page), v12Storage = await storageNow();
    assert.deepEqual(v12Journal, { ...v11Journal, appVersion: 12 }, 'every v11 field, unchanged; only appVersion: 12');
    assert.equal(v12Storage['rec-calories-v11-backup'], v11Raw, 'the v11 journal, byte for byte');
    for (const [k, v] of Object.entries(v11Storage)) if (k !== 'rec-calories-v1') assert.equal(v12Storage[k], v, k + ' untouched');
    assert.deepEqual(Object.keys(v12Storage).sort(), [...Object.keys(v11Storage), 'rec-calories-v11-backup'].sort(), 'no key removed, one added');
    assert.equal(v12Journal.legacyRewards.xp, 260, 'stored XP stays stored (just not shown)');
    // What v12 shows from it.
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), v11Shown.streak);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    // v11 put water first here (1.5 of 4.5 L); v12 never does (the water card), so the open Pull is the thing to do now.
    assert.equal(await page.locator('#now').getAttribute('data-now'), 'session', 'noon, lunch and dinner in, the Pull left open: the session is the thing to do now');
    assert.match(await page.locator('#now [data-gym-start]').innerText(), /Resume[\s\S]*2 of \d+ sets/);
    assert.match(await page.locator('#water12-value').innerText(), /^1\.5\s*\/\s*4\.5 L$/, 'the v11 water, on the water card');
    assert.deepEqual(await page.locator('#recent12 [data-entry]').evaluateAll(n => n.map(b => b.dataset.entry)), v11Journal.entries.filter(e => e.day === TODAY).map(e => e.id).reverse(), 'the v11 food of the day in Recently eaten, newest first');
    await page.locator('[data-view=history]').tap();
    assert.equal(await page.locator('#workouts .workout-row').count(), 5); assert.match(await page.locator('#workouts .entry--more').innerText(), /^Show \d+ more$/);
    assert.equal(await page.locator('#records [data-record]').count(), 6); assert.equal(await page.locator('#records-toggle').innerText(), 'Show all ' + v11Shown.records.length);
    assert.deepEqual(await progress(), v11Shown, 'the same streak, water streak, workouts and records');
    assert.match(await page.locator('#charts-more .chart-card', { hasText: 'Weight' }).locator('.chart-values').textContent(), new RegExp(TODAY + ': 70\\.1'), 'the v11 weigh-in, in the weight chart');   // synthetic
    await page.locator('[data-view=today]').tap(); await page.locator('#open-settings').tap();
    assert.equal(await page.locator('#sound-toggle').isChecked(), true); assert.equal(await page.locator('#local-weight').inputValue(), '70.1');   // synthetic weigh-in
    assert.equal(await page.locator('#theme-mode [aria-pressed=true]').getAttribute('data-theme-option'), 'dark');
    await page.evaluate(() => CHADUX.goTo('2026-10-20')); assert.equal(await page.locator('#missed-day').isChecked(), true); await page.evaluate(() => CHADUX.goTo(CHADQuest.dayKey()));
    assert.equal(await page.evaluate(() => RECScan.settings().mode), 'key', 'the own key still works'); assert.equal(await page.locator('#ai-status-title').innerText(), 'Own key');
    await page.locator('#close-settings').tap();
    // The open workout resumes with its sets (Gym tab, and the card on top of Today).
    await page.locator('[data-view=training]').tap(); assert.match(await page.locator('.is-today [data-gym-start]').innerText(), /Resume/);
    await tap(page.locator('.is-today [data-gym-start]')); assert.equal(await page.locator('#gym').isVisible(), true); assert.equal(await page.locator('#gym-dots .is-done').count(), 2, 'both sets');
    await tap(page.locator('[data-gym=close]'));
    // The saved dinner is a favourite on dinner (Later today, the add-food sheet); the draft and the recent foods wait there.
    await page.locator('[data-view=today]').tap(); await tap(page.locator('#later-toggle'));
    assert.equal(await page.locator(`#later-more [data-later-slot=D] [data-my-meal="${v11Journal.myMeals[0].id}"]`).getAttribute('aria-pressed'), 'true', 'the saved dinner, logged today');
    await again(page.locator('#later-more [data-later-slot=D] [data-custom=D]'));
    assert.deepEqual(await page.locator('#builder-items [data-item]').evaluateAll(n => n.map(e => e.dataset.item)), ['eggs'], 'the draft');
    assert.equal(await page.locator(`#builder-chips [data-food="mine:${v11Journal.myMeals[0].id}"]`).count(), 1, 'the saved meal is a favourite here');
    const recent = await page.locator('#builder-recent [data-food]').evaluateAll(n => n.map(e => e.dataset.food));
    assert.ok(recent.length === 4 && ['chook', 'potatoes', 'yopro-pouch'].every(k => recent.includes(k)), 'the v11 foods are the recent ones: ' + recent);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => localStorage.getItem('chad.builder')), v11Storage['chad.builder'], 'opening the draft does not rewrite it');
    // A change in v12 is an ordinary journal change.
    await again(page.locator('#water12'));
    const changed = await saved(page); assert.equal(changed.questsV5[TODAY].water, 2); assert.equal(changed.appVersion, 12);
    assert.deepEqual({ ...changed, questsV5: { ...changed.questsV5, [TODAY]: { ...changed.questsV5[TODAY], water: 1.5 } } }, { ...v11Journal, appVersion: 12 }, 'only the water changed');
    assert.equal((await storageNow())['rec-calories-v11-backup'], v11Raw, 'the backup is never rewritten');
    // A photo logged in v12 (the synthetic proxy for this step only): the photo stays in IndexedDB, the journal gets its id.
    await page.evaluate(token => { localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', token); }, TOKEN);
    await again(page.locator('#open-camera'));
    await page.waitForFunction(() => document.getElementById('camera12').open && document.getElementById('camera12-video').videoWidth > 0);
    await tap(page.locator('#camera12-shutter'));
    await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready');
    await tap(page.locator('#nutrition12-save')); assert.equal(await page.locator('#nutrition12-save').getAttribute('aria-pressed'), 'true');   // bookmarked: a v12-only journal field
    await again(page.locator('#n12-done')); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
    const withPhoto = await saved(page), photoEntry = withPhoto.entries.at(-1), { savedFoods12, ...rest } = withPhoto;
    assert.deepEqual([photoEntry.name, photoEntry.kcal, photoEntry.source, photoEntry.day, typeof photoEntry.photoId], [PLATE.name, 600, 'photo', TODAY, 'string']);
    assert.deepEqual(savedFoods12.map(f => [f.name, f.kcal]), [[PLATE.name, 600]], 'the bookmark');
    assert.deepEqual({ ...rest, entries: rest.entries.slice(0, -1) }, changed, 'one new entry and the bookmark, nothing else');
    const everything = await storageNow();
    assert.deepEqual(Object.keys(everything).filter(k => everything[k].includes('data:image')), [], 'no photo anywhere in localStorage, the journal included');
    const stored = await page.evaluate(async id => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('chad-photos-v12'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
      const photo = await new Promise((resolve, reject) => { const r = db.transaction('photos').objectStore('photos').get(id); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
      db.close(); return photo ? [photo.image.slice(0, 23), photo.thumbnail.slice(0, 23)] : null;
    }, photoEntry.photoId);
    assert.deepEqual(stored, ['data:image/jpeg;base64,', 'data:image/jpeg;base64,'], 'the photo and its thumbnail live in IndexedDB');
    await page.evaluate(() => { localStorage.removeItem('chad.aiProxyUrl'); localStorage.removeItem('chad.aiProxyToken'); });     // back to the own key

    // 3. v11 again (an older copy still open somewhere): it reads what v12 wrote, and loses nothing.
    phase = 'v11'; await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADQuest && document.getElementById('now')?.dataset.now && !window.CHADScan12);
    const back = await saved(page);
    assert.deepEqual(back, { ...withPhoto, appVersion: 11 }, 'v11 rewrites the v12 journal unchanged (with its own appVersion)');
    assert.equal(await page.locator('#home-streak').getAttribute('aria-label'), v11Shown.streak); assert.match(await page.locator('.water-total').innerText(), /^2\b/);
    await page.locator('#left-line').tap(); assert.equal(await page.locator(`#entries [data-entry="${photoEntry.id}"]`).count(), 1, 'the v12 photo food is in the v11 food list');
    const backStorage = await storageNow();
    assert.equal(backStorage['rec-calories-v11-backup'], v11Raw); assert.equal(backStorage['rec-calories-v10-backup'], v11Storage['rec-calories-v10-backup'], 'both backups stay as they were');
    await page.locator('[data-view=history]').tap();
    assert.deepEqual(await progress(), v11Shown, 'the same streak, water streak, workouts and records');

    // 4. v12 once more: its first backup is kept (never overwritten), the journal is whole, the photo is still here.
    phase = 'v12'; await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADScan12 && document.getElementById('now')?.dataset.now);
    assert.deepEqual(await saved(page), { ...withPhoto, appVersion: 12 });
    assert.equal((await storageNow())['rec-calories-v11-backup'], v11Raw, 'the v11 backup is never overwritten');
    await page.waitForFunction(id => /^data:image\/jpeg/.test(document.querySelector(`#recent12 [data-entry="${id}"] img`)?.src || ''), photoEntry.id);
    assert.deepEqual(errors, []);
    console.log(`PASS v11 -> v12 with zero loss: a v11 dataset made by the shipped v11 (47 days, ${v11Shown.workouts.length} workouts, ${v11Shown.records.length} records, lunch, water, a habit, a saved custom dinner, a favourite, a barcode food with the food cache, a builder draft, an open workout with 2 sets, dark theme, sounds, a synthetic weigh-in, a missed day, an own key, the v10 backup) -> v12: every journal field unchanged + appVersion 12, the v11 journal kept byte for byte (never rewritten or overwritten), every device key untouched, the same streak (${v11Shown.streak}, since ${v11Shown.since}), water streak, workouts and records (5 then Show more, 6 then Show all), weight chart, settings, saved meal, draft, recent foods and Resume (the thing to do now); a v12 water tap is an ordinary change; a v12 photo stays in IndexedDB (only its id in the journal, no data:image in localStorage); v11 reads the v12 journal back with nothing lost (the v12 bookmark included), and v12 after it still has its backup and the photo.`);
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
