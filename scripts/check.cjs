// Synthetic data only. Run with node scripts/check.cjs from the repository root.
// Journal storage and migration, reversible changes, legacy reward maths, Open Food Facts normalisation, metric-only
// text, no secrets anywhere, and the v9 shell manifest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../game.js');
const food = require('../food9.js');
const scan = require('../scan9.js');

class Element {
  constructor() { this.value = ''; this.children = []; this.textContent = ''; this.events = {}; this.dataset = {}; this.style = { setProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {} removeAttribute() {} insertAdjacentHTML() {}
  addEventListener(type, fn) { this.events[type] = fn; }
  closest() { return null; }
  reset() {} focus() {} blur() {} scrollIntoView() {} showModal() { this.open = true; } close() { this.open = false; }
}
function boot(saved = null, quota = false) {
  const elements = new Map(), storage = new Map(), sheets = [];
  if (saved !== null) storage.set('rec-calories-v1', saved);
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  const localStorage = { getItem: key => storage.get(key) || null, removeItem: key => storage.delete(key), setItem: (key, value) => { if (quota) throw Error('quota'); storage.set(key, value); } };
  const uxContext = { window: {}, document, Intl, Date, Math, setTimeout() {}, clearTimeout() {}, CHADIcons: { icon: () => '', mount() {} } };
  vm.runInNewContext(fs.readFileSync('ux9.js', 'utf8'), uxContext);
  const CHADUX = { ...uxContext.window.CHADUX, detail: (title, nodes) => sheets.push({ title, nodes }), closeSheets() {} };
  const context = {
    document, window: { addEventListener() {}, scrollTo() {} }, addEventListener() {}, navigator: {}, location: { hash: '', pathname: '/', search: '' }, history: { replaceState() {} },
    Intl, Date, Math, URL, URLSearchParams, fetch: () => { throw Error('Unexpected network'); }, setTimeout() {}, clearTimeout() {}, setInterval() {}, matchMedia: () => ({ matches: true }),
    RECGame: game, RECScan: scan, CHADFood: food, CHADUX, localStorage,
    CHADQuest: { dayKey: () => '2026-11-24', goals: () => ({}), render() {}, rewards: (_, __, g) => g, shownAddons: () => new Set() }
  };
  vm.runInNewContext(fs.readFileSync('app9.js', 'utf8'), context);
  return { get, storage, sheets, submit: id => get(id).onsubmit({ preventDefault() {} }), data: () => JSON.parse(storage.get('rec-calories-v1')), undo: () => get('undo-toast').children.at(-1) };
}
const row = (app, i = 0) => app.get('entries').children[i].children[0];                  // li > button.entry-open
const press = button => { button.disabled = false; button.onclick(); };                     // the toast arms its button after 350 ms

let app = boot();
assert.equal(app.get('remaining').textContent, '1,900');
for (const [id, value] of [['daily-target', 1900], ['protein-goal', 220], ['carbs-goal', 150], ['fat-goal', 45]]) assert.equal(app.get(id).value, value);
assert.equal(app.get('history-bars').children.length, 7);
assert.equal(app.get('quests').children.length, 3);
assert.equal(app.get('extras').hidden, true, 'nothing logged: the Other food section is hidden');
app.get('food-name').value = '<img src=x onerror=alert(1)>';
app.get('calories').value = '450'; app.get('protein').value = '30.5'; app.get('carbs').value = '40'; app.get('fat').value = '12';
app.submit('add-form');
assert.equal(app.get('remaining').textContent, '1,450');
assert.equal(app.get('consumed').textContent, '450');
assert.equal(app.get('protein-total').textContent, '31', 'the hero shows whole numbers');
assert.equal(app.get('carbs-total').textContent, '40'); assert.equal(app.get('fat-total').textContent, '12');
assert.equal(app.data().entries[0].protein, 30.5, 'the journal keeps the exact value');
assert.equal(app.data().entries.length, 1); assert.equal(app.data().schemaVersion, 5);
assert.equal(app.get('extras').hidden, false);
assert.equal(row(app).children[0].children[0].textContent, '<img src=x onerror=alert(1)>', 'names are text, never markup');
// The row opens one sheet: macros, Log again, Delete.
row(app).onclick(); let sheet = app.sheets.at(-1); assert.equal(sheet.title, '<img src=x onerror=alert(1)>');
sheet.nodes[2].onclick();
assert.equal(app.data().entries.length, 2); assert.equal(app.data().entries[1].source, 'repeat');
assert.equal(app.get('recent-food-list').children.length, 1, 'one "log again" row per food name');
press(app.undo()); assert.equal(app.data().entries.length, 1, 'Undo removes the repeat');
press(app.undo()); assert.equal(app.data().entries.length, 2, 'Redo puts it back');
row(app).onclick(); app.sheets.at(-1).nodes[3].onclick();
assert.equal(app.data().entries.length, 1);
press(app.undo()); assert.equal(app.data().entries.length, 2, 'a deleted entry comes back');
const order = app.data().entries.map(e => e.id);
row(app, 1).onclick(); app.sheets.at(-1).nodes[3].onclick(); press(app.undo());
assert.deepEqual(app.data().entries.map(e => e.id), order, 'Undo puts a deleted entry back in its place');
row(app).onclick(); app.sheets.at(-1).nodes[3].onclick();
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
const legacy = { target: 1800, proteinGoal: 180, carbsGoal: 210, fatGoal: 60, custom: 'preserve', entries: [{ id: 'legacy', day: '2020-01-01', name: 'Synthetic meal', kcal: 1800, protein: 180, extra: 'preserve' }] };
app = boot(JSON.stringify(legacy));
assert.equal(app.get('daily-target').value, 1800); assert.equal(app.get('protein-goal').value, 180);
assert.deepEqual(app.data().entries, legacy.entries); assert.equal(app.data().custom, 'preserve'); assert.equal(app.data().carbsGoal, 210);
const minimal = { target: 1750, entries: legacy.entries };
app = boot(JSON.stringify(minimal));
assert.equal(app.data().target, 1750); assert.equal(app.data().proteinGoal, 220); assert.deepEqual(app.data().entries, minimal.entries);
// v7 and v8 journals pass through untouched: same schema, every additive key preserved, nothing wiped.
const v8 = { schemaVersion: 5, journeyStartDate: '2026-10-01', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, arcadeTheme: 'dark', arcadeSound: true, haptics: false, phaseEnds: ['2026-12-06', '2026-12-13', '2027-05-02'], phaseMode: 'auto', customGoals: [1900, 220, 150, 45], phaseMacros: { cut: [1900, 220, 150, 45] }, legacyRewards: { xp: 120, badges: ['first'] }, futureField: { keep: true },
  questsV5: { '2026-11-23': { picks: { L: 'S', D: 'M' }, water: 4.5, steps: true, training: true, exercises: { 0: true, 1: true }, topSets: { 'Pull-ups': { kg: 10, reps: 8 } }, extension: 'keep' }, '2026-11-24': { picks: {}, water: 0.5 } },
  entries: [{ id: 'plan-2026-11-23-L', day: '2026-11-23', name: 'PERi steak & spuds', kcal: 583.5, protein: 60.3, carbs: 58.1, fat: 13.7, meal: 'Lunch', source: 'plan', planSlot: 'L', extra: 'keep' }, { id: 'old-photo', day: '2026-11-22', name: 'Synthetic scan', kcal: 300, protein: 20, carbs: 30, fat: 9, source: 'photo', thumbnail: 'data:image/png;base64,c3ludGhldGlj' }] };
app = boot(JSON.stringify(v8));
assert.deepEqual(app.data(), v8, 'a v8 journal is rewritten equivalent: nothing added, nothing lost');
app = boot(JSON.stringify(legacy), true);
const beforeQuota = app.storage.get('rec-calories-v1');
app.get('calories').value = '200'; app.submit('add-form');
assert.equal(app.storage.get('rec-calories-v1'), beforeQuota); assert.match(app.get('message').textContent, /Could not save/);
for (const unreadable of ['{broken', JSON.stringify({ target: 1800, entries: [null] })]) {
  app = boot(unreadable); app.get('calories').value = '200'; app.submit('add-form');
  assert.equal(app.storage.get('rec-calories-v1'), unreadable); assert.match(app.get('message').textContent, /protect/);
}
app = boot(null, true);
app.get('calories').value = '200'; app.submit('add-form');
assert.equal(app.storage.has('rec-calories-v1'), false); assert.match(app.get('message').textContent, /Could not save/);
console.log('PASS: defaults, quick add / log again / delete through the entry sheet with Undo and Redo, exact positions, whole-number hero with exact journal, safe text, phase presets, reversible goals and Day 1, v4/v7/v8 journals preserved, unknown fields, unreadable data protection, failed storage.');

const meal = (day, kcal = 1900, protein = 220, extra = {}) => ({ day, kcal, protein, ...extra });
const derive = (entries, today = '2026-11-24', overrides = {}) => game.derive({ target: 1900, proteinGoal: 220, entries, ...overrides }, today);
for (const [kcal, protein, expected] of [[1710, 220, 'S'], [2090, 219, 'A'], [2280, 220, 'B'], [2281, 220, 'C'], [100, 220, 'C'], [0, 0, '—']]) assert.equal(game.grade(kcal, protein, 1900, 220), expected);
let g = derive([meal('2026-11-24')]);
assert.equal(g.xp, 40); assert.equal(g.questXP, 30); assert.equal(g.streak, 1); assert.equal(g.badges.find(b => b.id === 'balanced').unlocked, false);
assert.equal(derive([meal('2026-11-23')]).xp, 115); assert.equal(derive([meal('2026-11-23', 1900, 0)]).xp, 60); assert.equal(derive([meal('2026-11-23', 200, 220)]).xp, 40); assert.equal(derive([meal('2026-11-25')]).xp, 0);
const questMeals = ['Breakfast', 'Lunch', 'Dinner'].map((m, i) => meal('2026-11-24', 600, i === 0 ? 220 : 0, { meal: m, source: i === 0 ? 'barcode' : 'manual' }));
g = derive(questMeals);
assert.equal(g.questXP, 80); assert.equal(g.xp, 110); assert.ok(g.quests.every(q => q.complete)); assert.deepEqual(derive(questMeals), g);
assert.equal(derive(questMeals.slice(1)).questXP, 0);
assert.equal(derive([meal('2026-11-24', 100, 0, { meal: 'Lunch', source: 'search' })]).quests.find(q => q.id === 'scan').complete, false);
assert.equal(derive([meal('2026-11-24', 100, 0, { source: 'photo' })]).questXP, 20);
assert.equal(derive(Array.from({ length: 3 }, () => meal('2026-11-24', 1, 0, { meal: 'Lunch' }))).quests.find(q => q.id === 'meals').progress, 1);
for (const count of [3, 7, 30]) {
  let cursor = '2026-11-24'; const entries = [];
  for (let i = 0; i < count; i++) { entries.push(meal(cursor)); cursor = game.previousDay(cursor); }
  g = derive(entries);
  assert.equal(g.streak, count); assert.equal(g.longest, count); assert.equal(g.badges.find(b => b.id === `streak${count}`).unlocked, true);
}
assert.equal(derive([meal('2026-11-22')]).streak, 0);
assert.equal(derive([meal('2026-11-21'), meal('2026-11-23'), meal('2026-11-24')]).longest, 2);
assert.equal(game.previousDay('2024-03-01'), '2024-02-29'); assert.equal(game.previousDay('2026-01-01'), '2025-12-31');
assert.equal(derive(Array.from({ length: 250 }, () => meal('2026-11-24', 1, 0))).name, 'CHAD Legend');
console.log('PASS: XP and daily quest rewards, deduplication, deletion recalculation, grade boundaries, badges, streaks 3/7/30, gaps, leap days, levels.');

const product = { code: '12345678', product_name: 'Synthetic cereal', brands: 'Synthetic Co, Other', serving_size: '40 g', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 8 } };
const normalized = food.normalize(product);
assert.equal(normalized.kcal, 160); assert.equal(normalized.protein, 4); assert.equal(normalized.basis, 'serving'); assert.equal(normalized.brand, 'Synthetic Co');
const fallback = food.normalize({ ...product, serving_size: undefined });
assert.equal(fallback.kcal, 400); assert.equal(fallback.basis, '100g'); assert.equal(fallback.portion, '100 g/mL (check pack)');
const serving = food.normalize({ ...product, nutriments: { 'energy-kcal_serving': 123, proteins_serving: 5, carbohydrates_serving: 20, fat_serving: 2 } });
assert.equal(serving.kcal, 123);
assert.equal(food.normalize({ ...product, nutriments: { 'energy-kcal_100g': 400 } }), null); assert.equal(food.normalize(null), null);
assert.equal(food.normalize({ ...product, nutriments: { energy_100g: 1673.6, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 8 } }).kcal, 160);
assert.equal('brand' in food.normalize({ ...product, brands: '' }), false);
assert.deepEqual(['kcal', 'protein', 'carbs', 'fat'].map(k => food.scale(normalized, 1.5)[k]), [240, 6, 30, 4.8]);
for (const m of [0, -1, NaN, 101]) assert.throws(() => food.scale(normalized, m), /portion/);
// Metric only: imperial serving text keeps its metric part, metric text is tidied.
for (const [text, grams, expected] of [['1 cup (240 ml)', 240, '240 mL'], ['2 oz (56 g)', 56, '56 g'], ['30g', 30, '30 g'], ['1 biscuit (15g)', 15, '1 biscuit (15 g)'], ['33 cl', null, '330 mL'], ['1 can (12 fl oz)', null, '1 serving'], ['2 tbsp', 30, '30 g'], ['1 l', null, '1 L']]) assert.equal(food.metricPortion(text, grams), expected, text);
assert.equal(food.normalize({ ...product, serving_size: '1 cup (30 g)', serving_quantity: 30 }).portion, '30 g');
console.log('PASS: OFF serving/100g normalization, metric portions, brand, kJ conversion, scaling.');

const html = fs.readFileSync('index.html', 'utf8'), sw = fs.readFileSync('sw.js', 'utf8'), css = fs.readFileSync('theme9.css', 'utf8');
assert.match(html, /<title>\s*CHAD/); assert.match(html, /apple-mobile-web-app-title[^>]+CHAD/); assert.match(sw, /const CACHE = 'rec-calories-shell-v9';/);
const shell = [...sw.match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const runtime = ['index.html', 'theme9.css', 'icons8.js', 'motion8.js', 'charts8.js', 'game.js', 'scan9.js', 'food9.js', 'plan9.js', 'quest9.js', 'ux9.js', 'app9.js', 'fonts/press-start-2p.ttf', 'fonts/OFL.txt', 'vendor/zxing-browser.min.js', 'vendor/ZXING-LICENSE', 'vendor/README.md', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/mark.svg'];
for (const file of runtime) { assert.ok(fs.existsSync(file), `${file} exists`); assert.ok(shell.includes(`./${file}`), `${file} cached`); }
assert.deepEqual(shell.filter(f => f !== './').sort(), runtime.map(f => './' + f).sort(), 'the shell lists exactly the runtime files');
// Every local script and stylesheet the page loads is in the offline shell, and nothing loads from another origin.
const assets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of assets) { assert.ok(url.startsWith('./'), `${url} is local`); assert.ok(shell.includes(url), `${url} is in the offline shell`); }
for (const gone of ['theme8.css', 'app8.js', 'ux8.js', 'quest8.js', 'food8.js', 'scan.js', 'plan-data.js', 'theme7.css', 'icons7.js', 'charts7.js', 'style.css', 'app.js', 'ux.js', 'quest.js', 'food.js']) { assert.equal(fs.existsSync(gone), false, `${gone} removed`); assert.equal(shell.includes(`./${gone}`), false); assert.equal(html.includes(`./${gone}"`), false); }
assert.ok(html.indexOf('./game.js') < html.indexOf('./app9.js')); assert.ok(html.indexOf('./food9.js') < html.indexOf('./app9.js')); assert.ok(html.indexOf('./motion8.js') < html.indexOf('./ux9.js')); assert.ok(html.indexOf('./scan9.js') < html.indexOf('./app9.js'));
assert.match(css, /prefers-reduced-motion/); assert.match(css, /prefers-color-scheme:\s*dark/); assert.match(css, /\.ch-dock-scrim/);
assert.match(sw, /cache: 'reload'/); assert.match(sw, /cache\.match\('\.\/index\.html'\)/);
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.name, 'CHAD'); assert.equal(manifest.short_name, 'CHAD');
for (const k of ['id', 'start_url', 'scope']) assert.equal(manifest[k], './');
assert.equal(manifest.display, 'standalone');
assert.match(html, /^<!doctype html>/i); assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
assert.match(html, /theme-color" content="#F2F2F7" media="\(prefers-color-scheme: light\)"/);
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
// Metric only, in everything a person reads: no pounds, ounces, cups, feet, inches, spoons or Fahrenheit.
const visible = file => fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
for (const file of ['index.html', 'plan9.js', 'quest9.js', 'ux9.js', 'app9.js', 'scan9.js', 'game.js']) {
  const found = visible(file).match(/\b(?:lbs?|pounds?|oz|ounces?|cups?|ft|feet|inch(?:es)?|tsp|tbsp|teaspoons?|tablespoons?|fahrenheit|°F|miles?)\b/i);
  assert.equal(found, null, `${file} is metric only (found "${found?.[0]}")`);
}
// Nothing private or secret is shipped: no keys or tokens anywhere. The one personal host is the built-in proxy address,
// once, in scan9.js (an address is not a secret; the token that unlocks it never ships). Tests use RECScan.DEFAULT_PROXY.
const shipped = [...fs.readdirSync('.').filter(f => /\.(js|html|css|webmanifest|md)$/.test(f) && !/^(CLAUDE-)?JOB|^AI-PROXY/.test(f)), ...fs.readdirSync('docs').map(f => 'docs/' + f), ...fs.readdirSync('scripts').map(f => 'scripts/' + f), ...fs.readdirSync('icons').filter(f => f.endsWith('.svg')).map(f => 'icons/' + f)];
const builtIn = new URL(scan.DEFAULT_PROXY).host;
assert.match(scan.DEFAULT_PROXY, /^https:\/\//); assert.equal(fs.readFileSync('scan9.js', 'utf8').split(builtIn).length - 1, 1, 'the built-in proxy address is written once');
for (const file of shipped) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(text), false, `${file} has no API key`);
  assert.equal(/\b[a-f0-9]{64}\b/i.test(text), false, `${file} has no 64-hex token`);
  assert.equal(/\.ts\.net\b|tailscale|ngrok/i.test(file === 'scan9.js' ? text.replace(builtIn, '') : text) && !file.startsWith('scripts/'), false, `${file} names no personal tunnel host`);
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
assert.equal(fs.existsSync('scripts/make-icons.cjs'), false, 'the old flame-icon generator is gone, so it cannot overwrite the mascot icons');
console.log('PASS: CHAD manifest identity, opaque PNG icons, complete local shell-v9 (exact list), removed v8 files, motion/dark/dock CSS guards, metric-only text, no keys/tokens/setup links, one built-in proxy address (scan9.js only), plain-vector header mark, one prompt for app and proxy example.');
