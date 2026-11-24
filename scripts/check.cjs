// Synthetic data only. Run with node scripts/check.cjs from the repository root.
// Journal storage and migration, legacy reward maths, Open Food Facts normalisation and the v8 shell manifest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../game.js');
const food = require('../food8.js');

class Element {
  constructor() { this.value = ''; this.children = []; this.textContent = ''; this.events = {}; this.dataset = {}; this.style = { setProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {} removeAttribute() {}
  addEventListener(type, fn) { this.events[type] = fn; }
  closest() { return new Element(); }
  reset() {} focus() {} blur() {} scrollIntoView() {} showModal() { this.open = true; } close() { this.open = false; }
}
function boot(saved = null, quota = false) {
  const elements = new Map(), storage = new Map();
  if (saved !== null) storage.set('rec-calories-v1', saved);
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const context = {
    document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
    window: { addEventListener() {}, scrollTo() {} }, addEventListener() {}, navigator: {}, Intl, Date, Math,
    fetch: () => { throw Error('Unexpected network'); }, setTimeout() {}, clearTimeout() {}, setInterval() {}, matchMedia: () => ({ matches: true }),
    RECGame: game, RECScan: require('../scan.js'), CHADFood: food,
    CHADQuest: { dayKey: () => '2026-11-24', goals: () => ({}), render() {}, rewards: (_, __, g) => g, removeEntry: (s, e, save) => save({ ...s, entries: s.entries.filter(x => x.id !== e.id) }) },
    localStorage: { getItem: key => storage.get(key) || null, removeItem: key => storage.delete(key), setItem: (key, value) => { if (quota) throw Error('quota'); storage.set(key, value); } }
  };
  const uxContext = { window: {} };
  vm.runInNewContext(fs.readFileSync('ux8.js', 'utf8'), uxContext);
  context.CHADUX = uxContext.window.CHADUX;
  vm.runInNewContext(fs.readFileSync('app8.js', 'utf8'), context);
  return { get, storage, submit: id => get(id).onsubmit({ preventDefault() {} }), data: () => JSON.parse(storage.get('rec-calories-v1')) };
}

let app = boot();
assert.equal(app.get('remaining').textContent, '1,900');
for (const [id, value] of [['daily-target', 1900], ['protein-goal', 220], ['carbs-goal', 150], ['fat-goal', 45]]) assert.equal(app.get(id).value, value);
assert.equal(app.get('history-bars').children.length, 7);
assert.equal(app.get('quests').children.length, 3);
app.get('food-name').value = '<img src=x onerror=alert(1)>';
app.get('calories').value = '450'; app.get('protein').value = '30.5'; app.get('carbs').value = '40'; app.get('fat').value = '12';
app.submit('add-form');
assert.equal(app.get('remaining').textContent, '1,450');
assert.equal(app.get('consumed').textContent, '450');
assert.equal(app.get('protein-total').textContent, '31', 'the hero shows whole numbers');
assert.equal(app.data().entries[0].protein, 30.5, 'the journal keeps the exact value');
assert.equal(app.data().entries.length, 1); assert.equal(app.data().schemaVersion, 5);
assert.equal(app.get('entries').children[0].children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
app.get('entries').children[0].children[1].onclick();
assert.equal(app.data().entries.length, 2); assert.equal(app.data().entries[1].source, 'repeat');
assert.equal(app.get('recent-food-list').children.length, 1, 'one "log again" row per food name');
app.get('entries').children[0].children[2].onclick();
assert.equal(app.data().entries.length, 1);
for (const [phase, expected] of [['cut', [1900, 220, 150, 45]], ['reset', [2700, 200, 320, 70]], ['bulk', [3000, 200, 370, 80]]]) {
  app.get('phase').value = phase; app.get('phase').onchange(); app.submit('settings-form');
  assert.deepEqual(['target', 'proteinGoal', 'carbsGoal', 'fatGoal'].map(k => app.data()[k]), expected);
}
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
// A v7 journal passes through untouched: same schema, every additive key preserved, nothing wiped.
const v7 = { schemaVersion: 5, journeyStartDate: '2026-10-01', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, arcadeTheme: 'dark', arcadeSound: true, phaseEnds: ['2026-12-06', '2026-12-13', '2027-05-02'], phaseMode: 'auto', customGoals: [1900, 220, 150, 45], phaseMacros: { cut: [1900, 220, 150, 45] }, legacyRewards: { xp: 120, badges: ['first'] }, futureField: { keep: true },
  questsV5: { '2026-11-23': { picks: { L: 'S', D: 'M' }, water: 4.5, steps: true, exercises: { 0: true }, topSets: { 'Pull-ups': { kg: 10, reps: 8 } }, extension: 'keep' } },
  entries: [{ id: 'plan-2026-11-23-L', day: '2026-11-23', name: 'PERi steak & spuds', kcal: 583.5, protein: 60.3, carbs: 58.1, fat: 13.7, meal: 'Lunch', source: 'plan', planSlot: 'L', extra: 'keep' }] };
app = boot(JSON.stringify(v7));
assert.deepEqual(app.data(), v7, 'v7 journal is rewritten byte-for-byte equivalent');
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
console.log('PASS: defaults, manual/repeat/delete logs, whole-number hero with exact journal, safe text, phase presets, v4 and v7 journals preserved, unknown fields, unreadable data protection, failed storage.');

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
assert.equal(fallback.kcal, 400); assert.equal(fallback.basis, '100g');
const serving = food.normalize({ ...product, nutriments: { 'energy-kcal_serving': 123, proteins_serving: 5, carbohydrates_serving: 20, fat_serving: 2 } });
assert.equal(serving.kcal, 123);
assert.equal(food.normalize({ ...product, nutriments: { 'energy-kcal_100g': 400 } }), null); assert.equal(food.normalize(null), null);
assert.equal(food.normalize({ ...product, nutriments: { energy_100g: 1673.6, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 8 } }).kcal, 160);
assert.equal('brand' in food.normalize({ ...product, brands: '' }), false);
assert.deepEqual(['kcal', 'protein', 'carbs', 'fat'].map(k => food.scale(normalized, 1.5)[k]), [240, 6, 30, 4.8]);
for (const m of [0, -1, NaN, 101]) assert.throws(() => food.scale(normalized, m), /portion/);

const html = fs.readFileSync('index.html', 'utf8'), sw = fs.readFileSync('sw.js', 'utf8'), css = fs.readFileSync('theme8.css', 'utf8');
assert.match(html, /<title>\s*CHAD/); assert.match(html, /apple-mobile-web-app-title[^>]+CHAD/); assert.match(sw, /const CACHE = 'rec-calories-shell-v8';/);
const shell = [...sw.match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const runtime = ['index.html', 'theme8.css', 'icons8.js', 'motion8.js', 'charts8.js', 'game.js', 'scan.js', 'food8.js', 'plan-data.js', 'quest8.js', 'ux8.js', 'app8.js', 'fonts/press-start-2p.ttf', 'fonts/OFL.txt', 'vendor/zxing-browser.min.js', 'vendor/ZXING-LICENSE', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
for (const file of runtime) { assert.ok(fs.existsSync(file), `${file} exists`); assert.ok(shell.includes(`./${file}`), `${file} cached`); }
for (const file of shell.filter(f => f !== './')) assert.ok(fs.existsSync(file), `${file} in the shell list exists`);
// Every local script and stylesheet the page loads is in the offline shell, and nothing loads from another origin.
const assets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const url of assets) { assert.ok(url.startsWith('./'), `${url} is local`); assert.ok(shell.includes(url), `${url} is in the offline shell`); }
for (const gone of ['theme7.css', 'icons7.js', 'charts7.js', 'style.css', 'app.js', 'ux.js', 'quest.js', 'food.js']) { assert.equal(fs.existsSync(gone), false, `${gone} removed`); assert.equal(shell.includes(`./${gone}`), false); assert.equal(html.includes(`./${gone}"`), false); }
assert.ok(html.indexOf('./game.js') < html.indexOf('./app8.js')); assert.ok(html.indexOf('./food8.js') < html.indexOf('./app8.js')); assert.ok(html.indexOf('./motion8.js') < html.indexOf('./ux8.js'));
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
// Nothing private or secret is shipped.
for (const file of fs.readdirSync('.').filter(f => /\.(js|html|css|webmanifest)$/.test(f))) assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(file, 'utf8')), false, `${file} has no API key`);
console.log('PASS: OFF serving/100g normalization, brand, kJ conversion, scaling, CHAD manifest identity, opaque PNG icons, complete local shell-v8, removed v7 files, motion/dark/dock CSS guards.');
