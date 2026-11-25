// Synthetic data only. Run with node scripts/check.cjs from the repository root.
// Journal storage and the v11 -> v12 migration, reversible changes, the v12 hero (calories left and P/C/F cards), favourites,
// the fallback card (typed in), legacy reward maths, Open Food Facts normalisation, metric-only text, no secrets anywhere,
// the journey streak, and the v12 shell manifest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../game10.js');
const food = require('../food9.js');
const scan = require('../scan9.js');

class Element {
  constructor() { this.value = ''; this.children = []; this.textContent = ''; this.events = {}; this.dataset = {}; this.style = { setProperty() {}, removeProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(k, v) { this[k] = v; } removeAttribute() {} insertAdjacentHTML() {} getAttribute(k) { return this[k]; }
  addEventListener(type, fn) { this.events[type] = fn; }
  closest() { return null; } querySelector() { return null; } querySelectorAll() { return []; }
  getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; }
  reset() {} focus() {} blur() {} scrollIntoView() {} showModal() { this.open = true; } close() { this.open = false; }
}
function boot(saved = null, quota = false, extra = {}) {
  const elements = new Map(), storage = new Map(Object.entries(extra)), sheets = [];
  if (saved !== null) storage.set('rec-calories-v1', saved);
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  const localStorage = { getItem: key => storage.has(key) ? storage.get(key) : null, removeItem: key => storage.delete(key), setItem: (key, value) => { if (quota) throw Error('quota'); storage.set(key, String(value)); } };
  const noop = () => {};
  const uxContext = { window: {}, document, Intl, Date, Math, setTimeout() {}, clearTimeout() {}, addEventListener: noop, scrollY: 0, innerHeight: 852, CHADIcons: { icon: () => '', mount() {} } };
  vm.runInNewContext(fs.readFileSync('ux12.js', 'utf8'), uxContext);
  const CHADUX = { ...uxContext.window.CHADUX, detail: (title, nodes) => sheets.push({ title, nodes }), closeSheets() {}, closeSheet() {}, render() {}, dateKey: () => '2026-11-24', timeBlock: () => 'midday', hourNow: () => 12 };
  const context = {
    document, window: { addEventListener() {}, scrollTo() {} }, addEventListener: noop, navigator: {}, location: { hash: '', pathname: '/', search: '' }, history: { replaceState() {} },
    Intl, Date, Math, URL, URLSearchParams, fetch: () => { throw Error('Unexpected network'); }, setTimeout() {}, clearTimeout() {}, setInterval() {}, matchMedia: () => ({ matches: true }), getComputedStyle: () => ({ maxHeight: '94px', rowGap: '16px' }), scrollY: 0,
    RECGame: game, RECScan: scan, CHADFood: food, CHADUX, localStorage, CHADPlan: [{ id: 'L', name: 'Lunch' }, { id: 'D', name: 'Dinner' }, { id: 'P', name: 'Snack' }],
    CHADQuest: { dayKey: () => '2026-11-24', goals: () => ({}), phaseHint: () => 'Cut · 12d left', render() {} }
  };
  vm.runInNewContext(fs.readFileSync('app12.js', 'utf8'), context);
  return { get, storage, sheets, CHADUX, submit: id => get(id).onsubmit({ preventDefault() {} }), data: () => JSON.parse(storage.get('rec-calories-v1')), undo: () => get('undo-toast').children.at(-1) };
}
const press = button => { button.disabled = false; button.onclick(); };                     // the toast arms its button after 350 ms
// "Type it in": the editable card with nothing in it, as + Food › Type it opens it outside a meal.
const typeIn = (app, name, kcal, p = '', c = '', f = '') => { app.CHADUX.openResult({ name }, 'manual'); app.get('result-kcal').value = kcal; app.get('result-protein').value = p; app.get('result-carbs').value = c; app.get('result-fat').value = f; app.get('scan-confirm-form').onsubmit({ preventDefault() {} }); };

let app = boot();
assert.equal(app.get('remaining').textContent, '1,900'); assert.equal(app.get('remaining-label').textContent, 'Calories left');
assert.equal(app.get('protein-left').textContent, '220'); assert.equal(app.get('protein-left-label').textContent, 'Protein left');
assert.equal(app.get('carbs-left').textContent, '150'); assert.equal(app.get('fat-left').textContent, '45'); assert.equal(app.get('fat-left-label').textContent, 'Fat left');
for (const [id, value] of [['daily-target', 1900], ['protein-goal', 220], ['carbs-goal', 150], ['fat-goal', 45]]) assert.equal(app.get(id).value, value);
assert.equal(app.get('left-line')['aria-pressed'], 'false', 'the hero shows what is left until it is tapped');
assert.equal(app.get('phase-line').textContent, 'Cut · 12d left', 'the phase under the number');
assert.equal(app.data().appVersion, 12, 'v12 marks the journal it writes'); assert.equal(app.data().schemaVersion, 5, 'and keeps schema 5');
assert.equal(app.storage.has('rec-calories-v11-backup'), false, 'a new journal needs no backup');
typeIn(app, '<img src=x onerror=alert(1)>', '450', '30.5', '40', '12');
assert.equal(app.get('remaining').textContent, '1,450'); assert.equal(app.get('protein-left').textContent, '190', 'whole numbers on the cards');
assert.equal(app.get('carbs-left').textContent, '110'); assert.equal(app.get('fat-left').textContent, '33');
assert.equal(app.data().entries[0].protein, 30.5, 'the journal keeps the exact value'); assert.equal(app.data().entries[0].source, 'manual');
assert.equal(app.data().entries.length, 1); assert.equal(app.data().entries[0].name, '<img src=x onerror=alert(1)>', 'a name is kept as typed (Recently eaten draws it as text)');
assert.match(app.get('protein-card')['aria-label'], /Protein: 31 of 220 g eaten, 190 g left/);
// A tap on the hero shows what was eaten (all four numbers), a second tap what is left.
app.get('left-line').onclick();
assert.equal(app.get('left-line')['aria-pressed'], 'true'); assert.equal(app.get('remaining').textContent, '450'); assert.equal(app.get('remaining-label').textContent, 'Calories eaten');
assert.equal(app.get('phase-line').textContent, 'of 1,900 kcal'); assert.equal(app.get('protein-left').textContent, '31'); assert.equal(app.get('protein-left-label').textContent, 'Protein eaten');
app.get('left-line').onclick(); assert.equal(app.get('remaining').textContent, '1,450'); assert.equal(app.get('remaining-label').textContent, 'Calories left');
// Over the goal: the words say so.
typeIn(app, 'Synthetic feast', '1600', '10');
assert.equal(app.get('remaining').textContent, '150'); assert.equal(app.get('remaining-label').textContent, 'Calories over');
press(app.undo()); assert.equal(app.get('remaining-label').textContent, 'Calories left', 'Undo');
// Log again and Delete (the nutrition card's buttons call these): Undo and Redo, exact positions.
let first = app.data().entries[0];
app.CHADUX.logAgain(first);
assert.equal(app.data().entries.length, 2); assert.equal(app.data().entries[1].source, 'repeat');
press(app.undo()); assert.equal(app.data().entries.length, 1, 'Undo removes the repeat');
press(app.undo()); assert.equal(app.data().entries.length, 2, 'Redo puts it back');
app.CHADUX.removeEntry(app.data().entries[1]);
assert.equal(app.data().entries.length, 1);
press(app.undo()); assert.equal(app.data().entries.length, 2, 'a deleted entry comes back');
const order = app.data().entries.map(e => e.id);
app.CHADUX.removeEntry(app.data().entries[0]); press(app.undo());
assert.deepEqual(app.data().entries.map(e => e.id), order, 'Undo puts a deleted entry back in its place');
app.CHADUX.removeEntry(app.data().entries[1]);
// A favourite: one tap logs one more, with its exact macros; Undo takes back exactly that one.
const pouch = { id: 'yopro-pouch', name: 'YoPRO Perform pouch', short: 'YoPRO pouch', portion: '1 pouch', macros: [120, 20.1, 6.8, 1.2] };
const beforeFav = app.data();
assert.equal(app.CHADUX.logFavourite(pouch), true); assert.equal(app.CHADUX.logFavourite(pouch), true);
let favs = app.data().entries.filter(e => e.fav === 'yopro-pouch');
assert.equal(favs.length, 2, 'a second tap is a second pouch'); assert.deepEqual([favs[0].kcal, favs[0].protein, favs[0].carbs, favs[0].fat, favs[0].source, favs[0].day], [120, 20.1, 6.8, 1.2, 'favourite', '2026-11-24']);
press(app.undo()); press(app.undo()); favs = app.data().entries.filter(e => e.fav === 'yopro-pouch'); assert.equal(favs.length, 2, 'Undo then Redo');
press(app.undo()); assert.equal(app.data().entries.filter(e => e.fav === 'yopro-pouch').length, 1);
app.CHADUX.logFavourite(pouch); press(app.undo()); press(app.undo()); press(app.undo());
assert.deepEqual(app.data().entries, [...beforeFav.entries, favs[0]].slice(0, beforeFav.entries.length + 1), 'only the last pouch is undone each time');
for (const [phase, expected] of [['cut', [1900, 220, 150, 45]], ['reset', [2700, 200, 320, 70]], ['bulk', [3000, 200, 370, 80]]]) {
  app.get('phase').value = phase; app.get('phase').onchange(); app.submit('settings-form');
  assert.deepEqual(['target', 'proteinGoal', 'carbsGoal', 'fatGoal'].map(k => app.data()[k]), expected);
}
// Settings are reversible: Undo gives back every field exactly, including ones that did not exist before.
const goalsBefore = app.data();
app.get('phase').value = 'custom'; app.get('daily-target').value = '2222'; app.get('journey-start-date').value = '2026-10-09'; app.submit('settings-form');
assert.equal(app.data().target, 2222); assert.equal(app.data().journeyStartDate, '2026-10-09');
press(app.undo()); assert.deepEqual(app.data(), goalsBefore, 'goals and Day 1 restored exactly');
assert.equal(app.get('journey-start-date').value, goalsBefore.journeyStartDate, 'and the form shows them again');
const saved = app.storage.get('rec-calories-v1');
app.get('protein-goal').value = '0'; app.submit('settings-form');
assert.equal(app.storage.get('rec-calories-v1'), saved);
// The fallback card (used only if scan12.js is missing) refuses what cannot be logged and keeps it open.
app.CHADUX.openResult({ name: 'Synthetic' }, 'manual'); app.get('result-kcal').value = ''; app.get('scan-confirm-form').onsubmit({ preventDefault() {} });
assert.equal(app.storage.get('rec-calories-v1'), saved, 'no kcal, nothing logged'); assert.match(app.get('message').textContent, /Energy needs a number/);
console.log('PASS: defaults and the v12 hero (calories left, protein/carbs/fat left, whole numbers; a tap shows eaten, again shows left; "over" past the goal), the typed card, Log again / Delete with Undo and Redo in exact positions, favourites one tap each (a second tap is a second one, Undo takes back exactly one), goals and Day 1 reversible, invalid goals and kcal refused.');

// v11 -> v12: nothing is lost. Every v11 field and key is read as it is; the journal gains appVersion: 12, and the
// journal as v11 left it is kept once, untouched, under rec-calories-v11-backup.
const legacy = { target: 1800, proteinGoal: 180, carbsGoal: 210, fatGoal: 60, custom: 'preserve', entries: [{ id: 'legacy', day: '2020-01-01', name: 'Synthetic meal', kcal: 1800, protein: 180, extra: 'preserve' }] };
app = boot(JSON.stringify(legacy));
assert.equal(app.get('daily-target').value, 1800); assert.equal(app.get('protein-goal').value, 180);
assert.deepEqual(app.data().entries, legacy.entries); assert.equal(app.data().custom, 'preserve'); assert.equal(app.data().carbsGoal, 210);
assert.equal(app.storage.get('rec-calories-v11-backup'), JSON.stringify(legacy), 'the journal as it was is kept once');
const minimal = { target: 1750, entries: legacy.entries };
app = boot(JSON.stringify(minimal));
assert.equal(app.data().target, 1750); assert.equal(app.data().proteinGoal, 220); assert.deepEqual(app.data().entries, minimal.entries);
const v10 = { schemaVersion: 5, appVersion: 11, journeyStartDate: '2026-10-01', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, arcadeTheme: 'dark', arcadeSound: true, haptics: false, phaseEnds: ['2026-12-06', '2026-12-13', '2027-05-02'], phaseMode: 'auto', customGoals: [1900, 220, 150, 45], phaseMacros: { cut: [1900, 220, 150, 45] }, legacyRewards: { xp: 120 }, futureField: { keep: true },
  myMeals: [{ id: 'my-1', slot: 'D', name: 'Synthetic bowl', macros: [640, 52, 60, 18], parts: [{ name: 'Roast chook, skin off', amount: '200 g', kcal: 330, protein: 56, carbs: 1, fat: 11, food: 'chook' }] }],
  questsV5: { '2026-11-23': { picks: { L: 'S', D: 'C' }, water: 4.5, steps: true, training: true, workout: { id: 'push', start: 1, end: 2, sets: [{ x: 'Incline DB press', kg: 25, reps: 8, at: 1 }] }, topSets: { 'Pull-ups': { kg: 10, reps: 8 } }, extension: 'keep' }, '2026-11-20': { missed: true }, '2026-11-24': { picks: {}, water: 0.5, weight: 70.1 } },   // synthetic weigh-in
  entries: [{ id: 'plan-2026-11-23-L', day: '2026-11-23', name: "Nando's ½ PERi chicken", kcal: 715, protein: 108, carbs: 1.1, fat: 30.8, meal: 'Lunch', source: 'plan', planSlot: 'L', extra: 'keep' }, { id: 'old-photo', day: '2026-11-22', name: 'Synthetic scan', kcal: 300, protein: 20, carbs: 30, fat: 9, source: 'photo', thumbnail: 'data:image/png;base64,c3ludGhldGlj' }] };
const v10raw = JSON.stringify(v10), device = { 'chad.gym': '{"key":"2026-11-24","open":false}', 'chad.builder': '{"slot":"D","items":[],"name":"x"}', 'chad.streakSeen': '2026-11-24:48', 'rec-calories-theme': 'dark', 'rec-calories-food-cache-v1': '{"q":{}}', 'rec-calories-ai-key': 'synthetic-key' };
app = boot(v10raw, false, device);
assert.deepEqual(app.data(), { ...v10, appVersion: 12 }, 'a v11 journal is rewritten with every field: only appVersion changes (11 -> 12)');
assert.equal(app.storage.get('rec-calories-v11-backup'), v10raw, 'byte for byte');
for (const [k, v] of Object.entries(device)) assert.equal(app.storage.get(k), v, k + ' is untouched');
// Opening again (or another tab writing) never replaces the first backup.
const after = app.storage.get('rec-calories-v1'); app = boot(after, false, { 'rec-calories-v11-backup': v10raw }); assert.equal(app.storage.get('rec-calories-v11-backup'), v10raw); assert.deepEqual(app.data(), { ...v10, appVersion: 12 });
app = boot(JSON.stringify({ ...v10, futureField: 2 }), false, { 'rec-calories-v11-backup': v10raw }); assert.equal(app.storage.get('rec-calories-v11-backup'), v10raw, 'the first backup stays');
app = boot(JSON.stringify(legacy), true);
const beforeQuota = app.storage.get('rec-calories-v1');
typeIn(app, 'Synthetic', '200');
assert.equal(app.storage.get('rec-calories-v1'), beforeQuota); assert.match(app.get('message').textContent, /Could not save/);
for (const unreadable of ['{broken', JSON.stringify({ target: 1800, entries: [null] })]) {
  app = boot(unreadable); typeIn(app, 'Synthetic', '200');
  assert.equal(app.storage.get('rec-calories-v1'), unreadable); assert.match(app.get('message').textContent, /protect/); assert.equal(app.storage.has('rec-calories-v11-backup'), false, 'unreadable data is never copied over the backup either');
}
app = boot(null, true);
typeIn(app, 'Synthetic', '200');
assert.equal(app.storage.has('rec-calories-v1'), false); assert.match(app.get('message').textContent, /Could not save/);
console.log('PASS: v4/v7/v11 journals preserved (every field; appVersion 12 written; a byte-for-byte backup of the v11 journal kept once and never replaced; device keys untouched), unknown fields, unreadable data protection, failed storage.');

const meal = (day, kcal = 1900, protein = 220, extra = {}) => ({ day, kcal, protein, ...extra });
const derive = (entries, today = '2026-11-24', overrides = {}) => game.derive({ target: 1900, proteinGoal: 220, entries, ...overrides }, today);
for (const [kcal, protein, expected] of [[1710, 220, 'S'], [2090, 219, 'A'], [2280, 220, 'B'], [2281, 220, 'C'], [100, 220, 'C'], [0, 0, '—']]) assert.equal(game.grade(kcal, protein, 1900, 220), expected);
let g = derive([meal('2026-11-24')]);
assert.equal(g.xp, 40); assert.equal(g.questXP, 30); assert.equal(g.streak, 48, 'the journey streak: Day 48'); assert.equal('badges' in g, false, 'no badges');
assert.equal(derive([meal('2026-11-23')]).xp, 115); assert.equal(derive([meal('2026-11-23', 1900, 0)]).xp, 60); assert.equal(derive([meal('2026-11-23', 200, 220)]).xp, 40); assert.equal(derive([meal('2026-11-25')]).xp, 0);
// v10: the journey streak. Every day from Day 1 (8 Oct 2026 unless edited) up to today counts, logged or not, so
// 24 Nov 2026 reads 48; only a day marked as missed breaks it, and a Day 1 in the future means no streak yet.
assert.equal(derive([]).streak, 48, 'nothing logged at all: still a 48-day streak on 24 Nov');
assert.equal(derive([meal('2026-11-22')]).streak, 48, 'gaps in logging do not break it');
assert.equal(derive([], '2026-11-25').streak, 49); assert.equal(derive([], '2026-10-08').streak, 1); assert.equal(derive([], '2026-10-07').streak, 0);
for (const count of [3, 7, 30]) {
  g = derive([meal('2026-11-24')], '2026-11-24', { journeyStartDate: game.addDays('2026-11-24', 1 - count) });
  assert.equal(g.streak, count); assert.equal(g.longest, count);
}
const missedDay = { questsV5: { '2026-11-20': { missed: true } } };
assert.equal(derive([], '2026-11-24', missedDay).streak, 4, 'a missed day restarts the streak the day after');
assert.equal(derive([], '2026-11-24', missedDay).longest, 43, 'and the run before it is the longest');
assert.equal(derive([], '2026-11-24', { questsV5: { '2026-11-24': { missed: true } } }).streak, 0);
assert.equal(derive([], '2026-11-24', { questsV5: { '2026-11-20': { missed: false } } }).streak, 48, 'only an explicit missed mark counts');
assert.equal(derive([], '2026-11-24', { journeyStartDate: '2026-12-01' }).streak, 0, 'Day 1 in the future');
assert.equal(derive([], '2026-11-24', { journeyStartDate: 'not a date' }).streak, 48, 'an invalid Day 1 falls back to 8 Oct');
assert.equal(game.previousDay('2024-03-01'), '2024-02-29'); assert.equal(game.previousDay('2026-01-01'), '2025-12-31');
console.log('PASS: legacy XP maths (kept for v4 journals, never shown), grade boundaries, no badges, journey streak 48 on 24 Nov 2026 (gaps, missed days, future Day 1), streaks of 3/7/30, leap days.');

const product = { code: '12345678', product_name: 'Synthetic cereal', brands: 'Synthetic Co, Other', serving_size: '40 g', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 8 } };
const normalized = food.normalize(product);
assert.equal(normalized.kcal, 160); assert.equal(normalized.protein, 4); assert.equal(normalized.basis, 'serving'); assert.equal(normalized.brand, 'Synthetic Co');
const fallback = food.normalize({ ...product, serving_size: undefined });
assert.equal(fallback.kcal, 400); assert.equal(fallback.basis, '100g'); assert.equal(fallback.portion, '100 g/mL (check pack)');
assert.equal(food.normalize({ ...product, nutriments: { 'energy-kcal_100g': 400 } }), null); assert.equal(food.normalize(null), null);
assert.equal(food.normalize({ ...product, nutriments: { energy_100g: 1673.6, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 8 } }).kcal, 160);
assert.deepEqual(['kcal', 'protein', 'carbs', 'fat'].map(k => food.scale(normalized, 1.5)[k]), [240, 6, 30, 4.8]);
for (const [text, grams, expected] of [['1 cup (240 ml)', 240, '240 mL'], ['2 oz (56 g)', 56, '56 g'], ['30g', 30, '30 g'], ['33 cl', null, '330 mL'], ['1 can (12 fl oz)', null, '1 serving'], ['1 l', null, '1 L']]) assert.equal(food.metricPortion(text, grams), expected, text);
console.log('PASS: OFF serving/100g normalization, metric portions, brand, kJ conversion, scaling.');

const html = fs.readFileSync('index.html', 'utf8'), sw = fs.readFileSync('sw.js', 'utf8'), css = fs.readFileSync('theme12.css', 'utf8');
assert.match(html, /<title>\s*CHAD/); assert.match(html, /apple-mobile-web-app-title[^>]+CHAD/); assert.match(sw, /const CACHE = 'rec-calories-shell-v12b';/);
const shell = [...sw.match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const runtime = ['index.html', 'theme12.css', 'icons8.js', 'motion8.js', 'charts8.js', 'game10.js', 'scan9.js', 'scan12.js', 'food9.js', 'plan11.js', 'train10.js', 'quest12.js', 'gym11.js', 'builder11.js', 'ux12.js', 'app12.js', 'fonts/press-start-2p.ttf', 'fonts/OFL.txt', 'vendor/zxing-browser.min.js', 'vendor/ZXING-LICENSE', 'vendor/README.md', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/mark.svg'];
for (const file of runtime) { assert.ok(fs.existsSync(file), `${file} exists`); assert.ok(shell.includes(`./${file}`), `${file} cached`); }
assert.deepEqual(shell.filter(f => f !== './').sort(), runtime.map(f => './' + f).sort(), 'the shell lists exactly the runtime files');
// Every local script and stylesheet the page loads is in the offline shell, and nothing loads from another origin.
const assets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of assets) { assert.ok(url.startsWith('./'), `${url} is local`); assert.ok(shell.includes(url), `${url} is in the offline shell`); }
for (const gone of ['theme11.css', 'app11.js', 'ux11.js', 'quest11.js', 'theme10.css', 'app10.js', 'ux10.js', 'quest10.js', 'plan10.js', 'gym10.js', 'builder10.js', 'theme9.css', 'app9.js', 'ux9.js', 'quest9.js', 'plan9.js', 'game.js', 'theme8.css', 'app8.js', 'ux8.js', 'quest8.js', 'food8.js', 'scan.js', 'plan-data.js', 'theme7.css', 'icons7.js', 'charts7.js', 'style.css', 'app.js', 'ux.js', 'quest.js', 'food.js']) { assert.equal(fs.existsSync(gone), false, `${gone} removed`); assert.equal(shell.includes(`./${gone}`), false); assert.equal(html.includes(`./${gone}"`), false); }
assert.ok(html.indexOf('./game10.js') < html.indexOf('./quest12.js')); assert.ok(html.indexOf('./food9.js') < html.indexOf('./app12.js')); assert.ok(html.indexOf('./motion8.js') < html.indexOf('./ux12.js')); assert.ok(html.indexOf('./scan9.js') < html.indexOf('./app12.js')); assert.ok(html.indexOf('./app12.js') < html.indexOf('./scan12.js'), 'scan12.js after the journal');
assert.ok(html.indexOf('./plan11.js') < html.indexOf('./quest12.js') && html.indexOf('./train10.js') < html.indexOf('./quest12.js') && html.indexOf('./quest12.js') < html.indexOf('./gym11.js') && html.indexOf('./gym11.js') < html.indexOf('./builder11.js') && html.indexOf('./builder11.js') < html.indexOf('./ux12.js') && html.indexOf('./ux12.js') < html.indexOf('./app12.js'), 'the modules load in order');
// Three tabs and the round + in the middle, Settings behind the gear, and none of what v11 took away.
assert.deepEqual([...html.matchAll(/class="tab ch-tab"[^>]*data-view="([^"]+)"/g)].map(m => m[1]), ['today', 'training', 'history'], 'three tabs: Today, Gym, Progress');
assert.deepEqual([...html.matchAll(/<span class="ch-tab__label">([^<]+)</g)].map(m => m[1]), ['Today', 'Gym', 'Progress']);
assert.match(html, /id="open-settings"[^>]*aria-label="Settings"/); assert.match(html, /id="open-camera"[^>]*aria-label="Scan or add food"/); assert.match(html, /id="close-settings"/);
for (const gone of ['today-scan', 'add-sheet', 'manual-sheet', 'level-up', 'quest-ring', 'quest-grade', 'activity-rings', 'week-strip', 'week-toggle', 'xp-total', 'level-disc', 'weekly-progress', 'past-entries']) assert.equal(html.includes(`id="${gone}"`), false, gone + ' is gone');
assert.doesNotMatch(fs.readFileSync('quest12.js', 'utf8') + fs.readFileSync('app12.js', 'utf8') + fs.readFileSync('ux12.js', 'utf8') + fs.readFileSync('gym11.js', 'utf8') + fs.readFileSync('scan12.js', 'utf8'), /'\+' \+ \w+ \+ ' XP'|S rank|LEVEL|level-up/, 'no XP, rank or level on screen');
assert.match(css, /prefers-reduced-motion/); assert.match(css, /prefers-color-scheme:\s*dark/); assert.match(css, /\.ch-dock-scrim/);
assert.match(sw, /cache: 'reload'/); assert.match(sw, /cache\.match\('\.\/index\.html'\)/);
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.name, 'CHAD'); assert.equal(manifest.short_name, 'CHAD');
for (const k of ['id', 'start_url', 'scope']) assert.equal(manifest[k], './');
assert.equal(manifest.display, 'standalone');
assert.match(html, /^<!doctype html>/i); assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
assert.match(html, /theme-color" content="#FFFFFF" media="\(prefers-color-scheme: light\)"/);
assert.match(html, /theme-color" content="#000000" media="\(prefers-color-scheme: dark\)"/);
assert.equal(manifest.background_color, '#0A1326');
for (const size of ['192x192', '512x512']) assert.ok(manifest.icons.some(i => i.sizes === size && i.purpose === 'any'));
assert.ok(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
// Icons: exact pixel size, 8-bit, and no alpha channel (colour type 2 = RGB, 3 = palette without tRNS) so they are full-bleed.
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  const png = fs.readFileSync(`icons/${file}`);
  assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  assert.ok([2, 3].includes(png[25]), `${file} has no alpha channel`); assert.equal(png.includes(Buffer.from('tRNS')), false, `${file} has no transparency chunk`);
}
// Metric only, in everything a person reads: no pounds, ounces, cups, feet, inches, spoons or Fahrenheit. "Gochi chicken
// cup" is a product's name (Arjun's lunch go-to), not a measure, so it is the one cup allowed.
const visible = file => fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/Gochi chicken cup/g, 'Gochi');
for (const file of ['index.html', 'plan11.js', 'train10.js', 'quest12.js', 'gym11.js', 'builder11.js', 'ux12.js', 'app12.js', 'scan9.js', 'scan12.js', 'game10.js']) {
  const found = visible(file).match(/\b(?:lbs?|pounds?|oz|ounces?|cups?|ft|feet|inch(?:es)?|tsp|tbsp|teaspoons?|tablespoons?|fahrenheit|°F|miles?)\b/i);
  assert.equal(found, null, `${file} is metric only (found "${found?.[0]}")`);
}
// Nothing private or secret is shipped: no keys or tokens anywhere. The one personal host is the built-in proxy address,
// once, in scan9.js (an address is not a secret; the token that unlocks it never ships). Tests use RECScan.DEFAULT_PROXY.
// scripts/v12-secret-scan.cjs checks every tracked file more widely (setup links, PINs, body measurements, meds, photos).
const shipped = [...fs.readdirSync('.').filter(f => /\.(js|html|css|webmanifest|md)$/.test(f) && !/^(CLAUDE-)?JOB|^AI-PROXY|^V\d+-PROGRESS/.test(f)), ...fs.readdirSync('docs').map(f => 'docs/' + f), ...fs.readdirSync('scripts').map(f => 'scripts/' + f), ...fs.readdirSync('icons').filter(f => f.endsWith('.svg')).map(f => 'icons/' + f)];
const builtIn = new URL(scan.DEFAULT_PROXY).host;
assert.match(scan.DEFAULT_PROXY, /^https:\/\//); assert.equal(fs.readFileSync('scan9.js', 'utf8').split(builtIn).length - 1, 1, 'the built-in proxy address is written once');
for (const file of shipped) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(text), false, `${file} has no API key`);
  assert.equal(/\b[a-f0-9]{64}\b/i.test(text), false, `${file} has no 64-hex token`);
  assert.equal(/\.ts\.net\b|\b[a-z0-9.-]+\.tailscale\.(?:com|net)\b|ngrok/i.test(file === 'scan9.js' ? text.replace(builtIn, '') : text) && !file.startsWith('scripts/'), false, `${file} names no personal tunnel host`);
  assert.equal(/[#&]k=[A-Za-z0-9]{16,}/.test(text), false, `${file} holds no setup link with a token`);
  assert.equal(/Bearer (?!synthetic-)[A-Za-z0-9_-]{12,}/.test(text), false, `${file} has no literal bearer token`);
}
// The proxy example asks the model exactly what the app's own-key route asks.
const worker = fs.readFileSync('docs/proxy-example.js', 'utf8'), prompt = vm.runInNewContext(worker.match(/const PROMPT = ([\s\S]+?);\r?\n/)[1]);
assert.equal(prompt, scan.PROMPT, 'one prompt for both routes');
assert.equal(/OPENAI_API_KEY\s*=\s*['"]/.test(worker), false, 'the worker reads its key from a secret only');
// The mascot mark in the Progress header: a small, self-contained vector (no scripts, no outside references).
const mark = fs.readFileSync('icons/mark.svg', 'utf8');
assert.match(html, /<img class="ch-mark" src="\.\/icons\/mark\.svg"/); assert.equal(/<script|\son[a-z]+=|<image|foreignObject|(?:href|src)="(?!#)/i.test(mark), false, 'mark.svg is plain vector art'); assert.ok(mark.length < 40000);
console.log('PASS: CHAD manifest identity, opaque PNG icons, complete local shell-v12b (exact list), removed v10 and older files, three tabs + the gear, no XP/rank/level/score UI, motion/dark/dock CSS guards, metric-only text, no keys/tokens/setup links, one built-in proxy address (scan9.js only), plain-vector header mark, one prompt for app and proxy example.');
