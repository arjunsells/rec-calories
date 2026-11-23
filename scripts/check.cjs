// Dependency-free checks with synthetic data; never reads a user's browser data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
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
  window: { addEventListener() {} }, navigator: {}, Intl, Date, Math, setInterval() {},
  localStorage: { getItem: () => stored, setItem: (_, value) => { if (failStorage) throw Error('quota'); stored = value; } }
};
const code = fs.readFileSync('app.js', 'utf8');
const submit = id => get(id).events.submit({ preventDefault() {} });
const boot = () => vm.runInNewContext(code, context);
boot();
assert.equal(get('remaining').textContent, '1,800');
assert.equal(get('history-bars').children.length, 7);
get('food-name').value = '<img src=x onerror=alert(1)>';
get('calories').value = '450'; get('protein').value = '30.5'; submit('add-form');
assert.equal(get('remaining').textContent, '1,350');
assert.equal(get('protein-total').textContent, '30.5');
assert.equal(get('entries').children[0].children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
get('quick-items').children[1].events.click();
assert.equal(JSON.parse(stored).entries.length, 2);
assert.equal(get('consumed').textContent, '900');
get('daily-target').value = '800'; submit('settings-form');
assert.equal(get('remaining-label').textContent, 'kcal over target');
assert.equal(get('remaining').textContent, '100');
boot();
assert.equal(get('consumed').textContent, '900');
assert.equal(get('daily-target').value, 800);
get('entries').children[0].children[2].events.click();
assert.equal(JSON.parse(stored).entries.length, 1);
const before = stored;
failStorage = true; get('calories').value = '200'; submit('add-form');
assert.equal(stored, before);
assert.match(get('message').textContent, /Could not save/);
failStorage = false; get('calories').value = '-20'; submit('add-form');
assert.equal(stored, before);
const data = JSON.parse(stored); data.entries[0].day = '2000-01-01'; stored = JSON.stringify(data); boot();
assert.equal(get('consumed').textContent, '0');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, './');
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const png = fs.readFileSync(`icons/${file}`); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
}
console.log('PASS: defaults, totals, protein, safe names, repeat add, target, persistence, delete, storage failure, invalid input, local-day filtering, seven history rows, manifest, PNG dimensions.');
