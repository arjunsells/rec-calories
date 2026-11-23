// Dependency-free checks with synthetic data; never reads a user's browser data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const RECGame = require('../game.js');
class Element {
  constructor() { this.value = ''; this.children = []; this.textContent = ''; this.events = {}; this.dataset = {}; this.attrs = {}; this.style = { setProperty() {} }; this.classList = { toggle() {} }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k, fn) { this.events[k] = fn; }
  closest() { return new Element(); }
  reset() {}
  focus() {}
}
const elements = new Map();
const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
let stored = null, failStorage = false;
const context = {
  document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], addEventListener() {} },
  window: { addEventListener() {} }, navigator: {}, Intl, Date, Math, setInterval() {}, setTimeout() {}, clearTimeout() {}, RECGame, RECScan: require('../scan.js'),
  localStorage: { getItem: key => key === 'rec-calories-v1' ? stored : null, removeItem() {}, setItem: (_, value) => { if (failStorage) throw Error('quota'); stored = value; } }
};
const code = fs.readFileSync('app.js', 'utf8');
const submit = id => get(id).events.submit({ preventDefault() {} });
const boot = () => vm.runInNewContext(code, context);
boot();
assert.equal(get('remaining').textContent, '1,800');
assert.equal(get('protein-goal').value, 180);
assert.equal(get('xp-total').textContent, '0 XP');
assert.equal(get('daily-grade').textContent, '—');
assert.equal(get('history-bars').children.length, 7);
get('food-name').value = '<img src=x onerror=alert(1)>';
get('calories').value = '450'; get('protein').value = '30.5'; submit('add-form');
assert.equal(get('remaining').textContent, '1,350');
assert.equal(get('protein-total').textContent, '30.5');
assert.equal(JSON.parse(stored).schemaVersion, 3);
assert.equal(get('xp-total').textContent, '10 XP');
assert.match(get('celebration').textContent, /First Open Home/);
assert.equal(get('entries').children.find(section => section.children[1].children[0]?.children.length).children[1].children[0].children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
get('quick-items').children[1].events.click();
assert.equal(JSON.parse(stored).entries.length, 2);
assert.equal(get('consumed').textContent, '900');
get('daily-target').value = '800'; submit('settings-form');
assert.equal(get('remaining-label').textContent, 'kcal over target');
assert.equal(get('remaining').textContent, '100');
boot();
assert.equal(get('consumed').textContent, '900');
assert.equal(get('daily-target').value, 800);
get('protein-goal').value = '200'; submit('settings-form');
assert.equal(JSON.parse(stored).proteinGoal, 200);
get('protein-goal').value = '0'; submit('settings-form');
assert.equal(JSON.parse(stored).proteinGoal, 200);
get('entries').children.find(section => section.children[1].children[0]?.children.length).children[1].children[0].children[2].events.click();
assert.equal(JSON.parse(stored).entries.length, 1);
assert.equal(get('xp-total').textContent, '10 XP');
const before = stored;
failStorage = true; get('calories').value = '200'; submit('add-form');
assert.equal(stored, before);
assert.match(get('message').textContent, /Could not save/);
failStorage = false; get('calories').value = '-20'; submit('add-form');
assert.equal(stored, before);
const data = JSON.parse(stored); data.entries[0].day = '2000-01-01'; stored = JSON.stringify(data); boot();
assert.equal(get('consumed').textContent, '0');
// Upgrade legacy data without deleting or changing historical entries.
const legacy = { target: 1800, entries: [{ id: 'legacy', day: '2020-01-01', name: 'Synthetic meal', kcal: 1800, protein: 180, extra: 'preserve' }] };
stored = JSON.stringify(legacy); boot();
assert.equal(get('xp-total').textContent, '85 XP');
assert.equal(get('protein-goal').value, 180);
submit('settings-form');
assert.deepEqual(JSON.parse(stored).entries, legacy.entries);
assert.equal(JSON.parse(stored).proteinGoal, 180);
for (const unreadable of ['{broken', JSON.stringify({ target: 1800, entries: [null] })]) {
  stored = unreadable; boot(); get('calories').value = '200'; submit('add-form');
  assert.equal(stored, unreadable);
  assert.match(get('message').textContent, /protect/);
}
// Fixed local day keys make reward tests independent of today's clock.
const meal = (day, kcal = 1800, protein = 180) => ({ day, kcal, protein });
const derive = (entries, today = '2026-11-23', overrides = {}) => RECGame.derive({ target: 1800, proteinGoal: 180, entries, ...overrides }, today);
assert.equal(RECGame.grade(1620, 180, 1800, 180), 'S');
assert.equal(RECGame.grade(1980, 179, 1800, 180), 'A');
assert.equal(RECGame.grade(2160, 180, 1800, 180), 'B');
assert.equal(RECGame.grade(2161, 180, 1800, 180), 'C');
assert.equal(RECGame.grade(100, 180, 1800, 180), 'C');
assert.equal(RECGame.grade(0, 0, 1800, 180), '—');
let game = derive([meal('2026-11-23')]);
assert.equal(game.xp, 10); assert.equal(game.streak, 1);
assert.equal(game.badges.find(b => b.id === 'balanced').unlocked, false);
assert.equal(derive([meal('2026-11-23')], '2026-11-24').xp, 85);
assert.equal(derive([meal('2026-11-22', 1800, 0)]).xp, 60);
assert.equal(derive([meal('2026-11-22', 200, 180)]).xp, 10);
assert.equal(derive([meal('2026-11-22')], undefined, { proteinGoal: 200 }).xp, 60);
assert.equal(derive([meal('2026-11-22')]).streak, 1);
assert.equal(derive([meal('2026-11-21')]).streak, 0);
assert.equal(derive([meal('2026-11-24')]).xp, 0);
for (const length of [3, 7, 30]) {
  let cursor = '2026-11-23'; const entries = [];
  for (let i = 0; i < length; i++) { entries.push(meal(cursor)); cursor = RECGame.previousDay(cursor); }
  game = derive(entries);
  assert.equal(game.streak, length); assert.equal(game.longest, length);
  assert.equal(game.badges.find(b => b.id === `streak${length}`).unlocked, true);
  assert.equal(derive(entries).xp, game.xp); // Recalculation never adds duplicate rewards.
}
assert.equal(derive([meal('2026-11-20'), meal('2026-11-22'), meal('2026-11-23')]).longest, 2);
assert.equal(RECGame.previousDay('2024-03-01'), '2024-02-29');
assert.equal(RECGame.previousDay('2026-01-01'), '2025-12-31');
assert.equal(derive(Array.from({ length: 10 }, () => meal('2026-11-23', 1, 0))).level, 1);
assert.equal(derive(Array.from({ length: 250 }, () => meal('2026-11-23', 1, 0))).name, 'Agency Legend');
assert.equal(derive([]).xp, 0);
const html = fs.readFileSync('index.html', 'utf8');
for (const id of elements.keys()) assert.ok(html.includes(`id="${id}"`), `Missing DOM element: ${id}`);
const sw = fs.readFileSync('sw.js', 'utf8');
assert.match(sw, /rec-calories-shell-v3/);
assert.match(sw, /'\.\/game.js'/);
assert.ok(html.indexOf('./game.js') < html.indexOf('./app.js'));
assert.match(fs.readFileSync('style.css', 'utf8'), /prefers-reduced-motion:no-preference/);
console.log('PASS: game XP, completed-day bonuses, grades, protein goals, legacy migration, unreadable-data protection, streaks 3/7/30, gaps, leap days, levels, deletion recalculation, DOM IDs, cache v3 and reduced-motion guard.');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, './');
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const png = fs.readFileSync(`icons/${file}`); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
}
console.log('PASS: defaults, totals, protein, safe names, repeat add, target, persistence, delete, storage failure, invalid input, local-day filtering, seven history rows, manifest, PNG dimensions.');
