'use strict';
// CHAD v11 · the one add-food sheet. "Custom" on a meal builds that meal; "+ Food" on Today logs anything else. Tap
// first, typing optional: search (the foods here and Open Food Facts) and Ask AI (a photo and/or words through
// your proxy, app11.js), a barcode, or typing it in, above your recent foods and favourites (saved meals for this meal,
// Quick log favourites, the foods here); those three open the editable card and come back here with the
// item. Each item has ½ · 1 · 2 (or grams − / +) and a remove button; the total runs at the top. Log fills the meal
// (or logs other food) with Undo in the toast; Save keeps a meal as a one-tap favourite on that meal. Every step inside
// the sheet (add, portion, remove, save) has Undo, and Undo has Redo, right there in the sheet.
((root) => {
  // Foods here: per portion ("item") or per 100 g. Nando's, Gochi and YoPRO Perform are exact (see plan11.js); the
  // rest are estimates from typical labels, metric, check the pack. `one` is the portion one tap adds. The first two
  // are Today's Quick log favourites.
  const FOODS = [
    { id: 'yopro-pouch', name: 'YoPRO Perform pouch', unit: 'item', one: '1 pouch', per: [120, 20.1, 6.8, 1.2], words: 'yopro perform pouch protein yoghurt yogurt' },
    { id: 'gochi-noodle', name: 'Gochi noodle meal', unit: 'item', one: '1 meal', per: [225, 31.8, 25.2, 2.6], words: 'gochi noodle korean chicken' },
    { id: 'nandos-half', name: "Nando's ½ PERi chicken", unit: 'item', one: '½ chicken', per: [715, 108, 1.1, 30.8], words: 'nandos half chicken peri' },
    { id: 'nandos-tenders', name: "Nando's PERi tenders", unit: 'item', one: '4 tenders', per: [220, 39.6, 0.7, 6.5], words: 'nandos tenders chicken peri' },
    { id: 'chook', name: 'Roast chook, skin off', unit: 'g', one: 200, step: 50, per: [165, 28, 0.5, 5.5], words: 'roast chicken chook bbq woolworths coles' },
    { id: 'potatoes', name: 'Microwave baby potatoes', unit: 'g', one: 300, step: 50, per: [75, 2, 15.8, 0.1], words: 'potato potatoes spuds baby microwave' },
    { id: 'yopro', name: 'YoPRO Vanilla 160 g', unit: 'item', one: '1 pot', per: [91.1, 15.2, 6.1, 0.5], words: 'yopro yoghurt yogurt protein pot vanilla' },
    { id: 'eggs', name: 'Eggs', unit: 'item', one: '2 eggs', per: [144, 12.6, 0.8, 9.6], words: 'egg eggs scrambled boiled' },
    { id: 'steak-mash', name: 'Woolworths Pepper Rump Steak With Mash', unit: 'item', one: '400 g pack', per: [356, 40.9, 13.3, 14.2], words: 'woolworths woolies premade ready meal steak mash' },
    { id: 'nandos-quarter', name: "Nando's ¼ chicken + pita", unit: 'item', one: '1 meal', per: [604, 61.3, 50.8, 15.9], words: 'nandos quarter chicken leg pita' },
    { id: 'beef-strips', name: 'Lean beef strips', unit: 'g', one: 200, step: 50, per: [130, 22.5, 0, 4.5], words: 'beef strips steak lean woolworths' },
    { id: 'hp-yoghurt', name: 'High-protein plain yoghurt', unit: 'g', one: 200, step: 50, per: [61, 9.4, 5, 0.75], words: 'yoghurt yogurt greek high protein woolworths' },
    { id: 'chobani-pot', name: 'Chobani 20 g Protein Pot', unit: 'item', one: '1 pot', per: [150, 20, 13, 2.2], words: 'chobani yoghurt yogurt protein pot' },
    { id: 'whey', name: 'Protein shake (whey + skim milk)', unit: 'item', one: '1 shake', per: [222, 34.2, 17.4, 1.8], words: 'protein shake whey milk' },
    { id: 'banana', name: 'Banana', unit: 'item', one: '1 small', per: [89, 1.1, 23, 0.3], words: 'banana fruit' },
    { id: 'corn', name: 'Corn cob', unit: 'item', one: '1 cob', per: [96, 3.4, 21, 1.5], words: 'corn cob' },
    { id: 'toast', name: 'Wholemeal toast', unit: 'item', one: '1 slice', per: [95, 4.5, 16, 1.2], words: 'toast bread wholemeal slice' },
    { id: 'peri', name: "Nando's PERi-PERi sauce", unit: 'item', one: '20 g', per: [15, 0.2, 1.2, 1], words: 'peri sauce nandos hot' }
  ];
  const MACROS = ['kcal', 'protein', 'carbs', 'fat'];
  const tenth = n => Math.round(n * 10) / 10;
  const norm = s => String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9½¼ ]/g, ' ').replace(/\s+/g, ' ').trim();
  // An item in the meal: { key, name, unit: 'item' | 'g', qty (portions, or grams), one (portion words, or default
  // grams), step (grams), per: [kcal, P, C, F] per portion or per 100 g, food? (a local id) }.
  const macrosOf = it => it.per.map(v => tenth(v * (it.unit === 'g' ? it.qty / 100 : it.qty)));
  const total = items => items.reduce((t, it) => t.map((v, i) => tenth(v + macrosOf(it)[i])), [0, 0, 0, 0]);
  const portionText = it => it.unit === 'g' ? Math.round(it.qty) + ' g' : it.qty === 1 ? String(it.one) : (it.qty === .5 ? '½' : String(it.qty).replace(/\.5$/, '½')) + ' × ' + it.one;
  // "Roast chook + Microwave baby potatoes + more": whole names only, never cut mid-word, at most 80 characters.
  const autoName = items => {
    const names = items.map(it => it.name.replace(/\s*\(.*\)$/, '').replace(/,.*$/, '')), all = names.join(' + ');
    if (names.length <= 3 && all.length <= 80) return all;
    let out = names[0].slice(0, 70);
    for (const n of names.slice(1, 3)) { if ((out + ' + ' + n).length > 70) break; out += ' + ' + n; }
    return out + ' + more';
  };
  const fromFood = (f, extra = {}) => ({ key: f.id, food: f.id, name: f.name, unit: f.unit, qty: f.unit === 'g' ? f.one : 1, one: f.one, step: f.step || 0, per: f.per.slice(), ...extra });
  // A saved meal ("my meal") as one portion of itself.
  const fromMine = m => ({ key: 'mine:' + m.id, name: m.name, unit: 'item', qty: 1, one: '1 meal', step: 0, per: m.macros.map(Number) });
  // Search the foods here: every word must match the name or its keywords.
  function searchLocal(term, limit = 6) {
    const words = norm(term).split(' ').filter(Boolean);
    if (!words.length) return [];
    return FOODS.filter(f => { const hay = norm(f.name + ' ' + f.words); return words.every(w => hay.includes(w)); }).slice(0, limit);
  }
  // An Open Food Facts result (food9.js): per serving when the serving has a weight, else per 100 g.
  function fromOFF(item) {
    const g = item.basis === '100g' ? 100 : item.servingGrams, values = MACROS.map(k => Number(item[k]) || 0), name = [item.brand, item.name].filter(Boolean).join(' ').slice(0, 80) || 'Food';
    if (g > 0) return { key: 'off-' + (item.code || name), name, unit: 'g', qty: Math.round(g), one: Math.round(g), step: g >= 150 ? 50 : g >= 40 ? 10 : 5, per: values.map(v => tenth(v / g * 100)), source: 'search' };
    return { key: 'off-' + (item.code || name), name, unit: 'item', qty: 1, one: item.portion || '1 serving', step: 0, per: values, source: 'search' };
  }
  // The card's answer (Ask AI, a barcode, typed in): by weight when it has one, else as one portion.
  function fromCard(v) {
    const g = /^(\d+(?:\.\d+)?) g$/.exec(v.portion || ''), values = MACROS.map(k => Number(v[k]) || 0), key = (v.source || 'ai') + '-' + Date.now().toString(36);
    if (g && Number(g[1]) > 0) { const w = Number(g[1]); return { key, name: v.name, unit: 'g', qty: w, one: w, step: w >= 150 ? 50 : 10, per: values.map(x => x / w * 100), source: v.source || 'ai' }; }
    return { key, name: v.name, unit: 'item', qty: 1, one: '1 serving', step: 0, per: values, source: v.source || 'ai' };
  }
  // Your recent and frequent foods: what you logged off the plan in the last 60 days, and what went into custom meals,
  // most often first. Foods that are also here use their own portions.
  function recentFoods(state, today, limit = 6) {
    const from = new Date(Date.parse(today + 'T00:00:00Z') - 60 * 864e5).toISOString().slice(0, 10), seen = new Map();
    const note = (key, item, at) => { const n = seen.get(key); if (n) { n.count++; n.at = Math.max(n.at, at); } else seen.set(key, { item, count: 1, at }); };
    (state.entries || []).forEach((e, at) => {
      if (!e || e.day < from || e.day > today || ['plan', 'addon'].includes(e.source)) return;
      if (Array.isArray(e.parts) && e.parts.length) { for (const p of e.parts) if (p && p.name) { const f = FOODS.find(x => x.id === p.food); note(f ? f.id : 'name:' + norm(p.name), f ? fromFood(f) : { key: 'name:' + norm(p.name), name: p.name, unit: 'item', qty: 1, one: p.amount || '1 serving', step: 0, per: [p.kcal || 0, p.protein || 0, p.carbs || 0, p.fat || 0] }, at); } return; }
      if (!e.name || !(e.kcal > 0)) return;
      const f = e.fav && FOODS.find(x => x.id === e.fav);
      if (f) { note(f.id, fromFood(f), at); return; }
      note('name:' + norm(e.name), { key: 'name:' + norm(e.name), name: e.name, unit: 'item', qty: 1, one: e.portion || '1 serving', step: 0, per: [e.kcal, e.protein || 0, e.carbs || 0, e.fat || 0] }, at);
    });
    return [...seen.values()].sort((a, b) => b.count - a.count || b.at - a.at).slice(0, limit).map(x => x.item);
  }
  // What a logged or saved meal remembers about each item (shown in its sheet, and feeding the recent foods).
  const partsOf = items => items.map(it => { const m = macrosOf(it); return { name: it.name, amount: portionText(it), kcal: m[0], protein: m[1], carbs: m[2], fat: m[3], ...(it.food ? { food: it.food } : {}) }; });
  const pure = { FOODS, searchLocal, fromFood, fromMine, fromOFF, fromCard, macrosOf, total, portionText, autoName, recentFoods, partsOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = pure; return; }
  if (!root.document) { root.CHADBuilder = pure; return; }

  /* ---- the sheet ---- */
  const DRAFT = 'chad.builder';                                    // the meal being built: device only, never in a backup
  const $ = id => document.getElementById(id);
  const M = () => root.CHADMotion;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (cls, fn, text) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.onclick = fn; return b; };
  const icon = (name, size, opts) => root.CHADIcons?.icon(name, size, opts) || '';
  const whole = n => Math.round(n).toLocaleString('en-AU');
  const clone = items => items.map(it => ({ ...it, per: it.per.slice() }));
  // slotId: 'L', 'D' or 'P' builds that meal; null logs other food.
  let slotId = 'L', items = [], name = '', built = false, toastTimer, armTimer, searchRun = 0, searchAbort = null, searchTimer, savedAs = null, offRows = [];
  const slot = () => slotId ? root.CHADPlan.find(s => s.id === slotId) || null : null;
  const journal = () => root.CHADUX?.journal?.() || (() => { try { return JSON.parse(localStorage.getItem('rec-calories-v1') || '{}') || {}; } catch { return {}; } })();
  function keep() { try { if (items.length || name) localStorage.setItem(DRAFT, JSON.stringify({ slot: slotId, items, name })); else localStorage.removeItem(DRAFT); } catch { /* the draft is a convenience */ } }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (d && Array.isArray(d.items)) { items = d.items.filter(it => it && typeof it.name === 'string' && Array.isArray(it.per) && it.per.length === 4 && it.qty > 0); name = typeof d.name === 'string' ? d.name : ''; return d.slot === null || root.CHADPlan.some(s => s.id === d.slot) ? d.slot : undefined; }
    } catch { /* a broken draft is an empty one */ }
    return undefined;
  }

  // Undo inside the sheet: the bottom toast sits under an open sheet, so the builder shows its own, one line, one action.
  function toast(text, action, options = {}) {
    clearTimeout(toastTimer); clearTimeout(armTimer);
    const bar = $('builder-undo'), off = options.kind === 'off', tick = el('span', 'ch-toast__icon' + (off ? ' is-undo' : ''));
    tick.innerHTML = icon(off ? 'undo' : 'check', 14, { weight: 3.2 });
    bar.replaceChildren(tick, el('span', 'ch-toast__text', text));
    if (action) {
      const b = button('ch-toast__action', () => { if (b.disabled) return; bar.hidden = true; action(); }, options.action || 'Undo');
      b.disabled = true; armTimer = setTimeout(() => { b.disabled = false; }, 350);          // a double tap never lands on Redo
      bar.append(b);
    }
    bar.hidden = true; void bar.offsetWidth; bar.hidden = false;
    toastTimer = setTimeout(() => { bar.hidden = true; }, options.life || 6000);
  }
  // One step on the meal: done, with Undo; Undo offers Redo.
  function step(label, mutate, kind = 'on') {
    const before = { items: clone(items), name }; mutate(); const after = { items: clone(items), name };
    savedAs = null; keep(); paint(); M()?.haptic(kind === 'off' ? 'off' : 'tap');
    const put = s => { items = clone(s.items); name = s.name; savedAs = null; keep(); paint(); };
    const undo = () => { put(before); M()?.haptic('off'); toast('Undone', redo, { kind: 'off', action: 'Redo' }); };
    const redo = () => { put(after); M()?.haptic('on'); toast(label, undo, { kind }); };
    toast(label, undo, { kind });
  }
  function add(item, how = 'Added') {
    const same = items.find(it => it.key === item.key && it.unit === item.unit);
    if (same) step(how + ' ' + item.name, () => { same.qty = same.unit === 'g' ? same.qty + (same.step || 50) : same.qty + 1; });
    else step(how + ' ' + item.name, () => { items.push({ ...item, per: item.per.slice() }); });
    M()?.pulse(document.querySelector(`#builder-items [data-item="${CSS.escape(item.key)}"]`), 'just-on', 500);
  }
  const setQty = (it, qty) => { if (qty > 0 && qty !== it.qty) step(it.name + ' · ' + portionText({ ...it, qty }), () => { it.qty = qty; }); };
  const remove = it => step(it.name + ' removed', () => { items = items.filter(x => x !== it); }, 'off');

  function build() {
    built = true;
    const body = $('builder-body');
    const totalBar = el('div', 'ch-bld__total'); totalBar.id = 'builder-total'; totalBar.setAttribute('role', 'status');
    const list = el('ul', 'ch-bld__items ch-list'); list.id = 'builder-items';
    const recent = el('div', 'ch-bld__chips'); recent.id = 'builder-recent';
    const recentHead = el('h3', 'ch-list-h', 'Recent'); recentHead.id = 'builder-recent-h';
    const chips = el('div', 'ch-bld__chips'); chips.id = 'builder-chips';
    const search = el('form', 'ch-bld__search'); search.setAttribute('role', 'search');
    search.innerHTML = '<label class="ch-sr" for="builder-search">Search foods</label><div class="ch-search"><i data-icon="magnifier" data-size="18"></i><input id="builder-search" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="100" placeholder="Search foods"></div>';
    const results = el('div', 'ch-bld__results ch-list'); results.id = 'builder-results';
    const ways = el('div', 'ch-bld__ways');
    const way = (id, glyph, text, fn, label) => { const b = button('ch-bld__way', fn); b.id = id; b.innerHTML = icon(glyph, 20, { weight: 2.1 }); b.append(el('span', '', text)); b.setAttribute('aria-label', label); ways.append(b); };
    way('builder-ask-go', 'sparkles', 'Ask AI', () => askAI(), 'Ask AI: a photo or words');
    way('builder-barcode', 'barcode', 'Barcode', () => root.CHADUX.openFood('barcode', context(), defaultFor()), 'Scan a barcode');
    way('builder-type', 'pencil', 'Type it', () => root.CHADUX.openResult({ name: $('builder-search').value.trim().slice(0, 80) }, 'manual', { add: context().add }), 'Type it in');
    const undoBar = el('div', 'ch-toast ch-bld__undo'); undoBar.id = 'builder-undo'; undoBar.setAttribute('role', 'status'); undoBar.hidden = true;
    const actions = el('div', 'ch-bld__actions');
    const save = button('ch-btn ch-bld__save', () => saveMeal()); save.id = 'builder-save';
    const log = button('ch-btn ch-btn--gold ch-bld__log', () => logMeal()); log.id = 'builder-log';
    const later = button('ch-btn ch-bld__later', () => logMeal(true), 'Plan for later'); later.id = 'builder-later';
    actions.append(save, log, later);
    const foot = el('div', 'ch-bld__foot'); foot.append(undoBar, actions);
    // Entry methods stay above the growing lists, visible on opening even on a small phone.
    body.replaceChildren(totalBar, el('h3', 'ch-list-h', 'Search'), search, results, el('h3', 'ch-list-h', 'More ways'), ways, list, recentHead, recent, el('h3', 'ch-list-h', 'Favourites'), chips, foot);
    root.CHADIcons?.mount(body);
    search.onsubmit = e => { e.preventDefault(); runSearch($('builder-search').value); $('builder-search').blur(); };
    $('builder-search').addEventListener('input', () => { clearTimeout(searchTimer); const term = $('builder-search').value; offRows = []; paintLocal(term); if (term.trim().length >= 2) searchTimer = setTimeout(() => runSearch(term), 450); });
  }
  const autoOr = () => name.trim() || autoName(items);
  const defaultFor = () => slot()?.name === 'Snack' ? 'Snacks' : slot()?.name || null;
  // Where the card's answer goes: back into this meal. Closing the food sheet or the card also comes back here.
  function context() { const at = slotId; return { add: values => { open(at); if (values) add(fromCard(values), 'Added'); }, back: () => open(at), search: words => open(at, { search: words }) }; }
  function paint() {
    if (!built) return;
    const s = slot(), t = total(items);
    $('builder-title').textContent = s ? 'Custom ' + s.name.toLowerCase() : 'Add food';
    // The running total, in the same colours as everywhere else.
    const bar = $('builder-total'), k = el('span', 'ch-bld__kcal'); k.append(el('b', '', whole(t[0])), el('small', '', 'kcal'));
    bar.replaceChildren(k, root.CHADUX.pcf(t[1], t[2], t[3]), el('span', 'ch-bld__count', items.length ? items.length + (items.length === 1 ? ' item' : ' items') : 'Tap a food to add it'));
    bar.setAttribute('aria-label', (s ? s.name : 'Food') + ' so far: ' + whole(t[0]) + ' kcal, protein ' + whole(t[1]) + ' g, carbs ' + whole(t[2]) + ' g, fat ' + whole(t[3]) + ' g');
    const list = $('builder-items'); list.replaceChildren();
    for (const it of items) {
      const m = macrosOf(it), li = el('li', 'ch-bld__item'), top = el('div', 'ch-bld__itemtop'), ctl = el('div', 'ch-bld__ctl');
      li.dataset.item = it.key;
      top.append(el('span', 'ch-bld__iname', it.name), el('b', 'ch-bld__ikcal', whole(m[0]) + ' kcal'));
      ctl.append(el('span', 'ch-bld__portion', portionText(it)));
      if (it.unit === 'g') {
        const less = button('ch-bld__step', () => setQty(it, Math.max(it.step || 10, it.qty - (it.step || 10))), '−'), more = button('ch-bld__step', () => setQty(it, it.qty + (it.step || 10)), '+');
        less.setAttribute('aria-label', 'Less ' + it.name); more.setAttribute('aria-label', 'More ' + it.name); less.disabled = it.qty <= (it.step || 10);
        ctl.append(less, more);
      } else for (const q of [.5, 1, 2]) {
        const b = button('ch-bld__q', () => setQty(it, q), q === .5 ? '½' : String(q)); b.setAttribute('aria-pressed', String(it.qty === q)); b.setAttribute('aria-label', (q === .5 ? 'Half' : q === 1 ? 'One' : 'Two') + ' × ' + it.one + ' ' + it.name);
        ctl.append(b);
      }
      const x = button('ch-bld__x', () => remove(it)); x.innerHTML = icon('xmark', 16, { weight: 2.6 }); x.setAttribute('aria-label', 'Remove ' + it.name);
      ctl.append(x);
      li.append(top, ctl); list.append(li);
    }
    list.hidden = !items.length;
    paintChips(); paintFoot();
  }
  const chip = (item, kind) => {
    const m = macrosOf(item), b = button('ch-bld__chip' + (kind ? ' is-' + kind : ''), () => add(item));
    if (kind) b.innerHTML = icon(kind === 'recent' ? 'repeat' : 'star', 14, { weight: 2.4 });
    b.append(el('span', '', item.name), el('small', '', whole(m[0]) + ' kcal · ' + portionText(item)));
    b.dataset.food = item.key; b.setAttribute('aria-label', 'Add ' + item.name + ', ' + portionText(item) + ', ' + whole(m[0]) + ' kcal' + (kind === 'recent' ? ', recent' : kind === 'mine' ? ', my meal' : ''));
    return b;
  };
  // Recent first, then favourites: this meal's saved meals, then the foods here (never the same food twice).
  function paintChips() {
    const state = journal(), today = root.CHADQuest.dayKey(), recent = recentFoods(state, today), keys = new Set(recent.map(r => r.key));
    $('builder-recent').replaceChildren(...recent.map(r => chip(r, 'recent')));
    $('builder-recent').hidden = $('builder-recent-h').hidden = !recent.length;
    const mine = slotId ? root.CHADQuest.myMeals(state, slotId).slice().reverse().map(fromMine) : [];
    $('builder-chips').replaceChildren(...mine.map(m => chip(m, 'mine')), ...FOODS.filter(f => !keys.has(f.id)).map(f => chip(fromFood(f))));
  }
  function paintFoot() {
    const t = total(items), s = slot(), log = $('builder-log'), save = $('builder-save');
    log.disabled = !items.length;
    $('builder-later').disabled = !items.length;
    log.replaceChildren(el('span', '', s ? 'Log ' + s.name.toLowerCase() : 'Log'), el('small', '', whole(t[0]) + ' kcal'));
    save.hidden = !s;
    save.disabled = !items.length || !!savedAs;
    save.innerHTML = icon('star', 16, { weight: 2.2 }); save.append(savedAs ? 'Saved' : 'Save'); save.classList.toggle('is-saved', !!savedAs);
    save.setAttribute('aria-label', savedAs ? 'Saved as my meal' : 'Save as my meal');
  }
  // Search: the foods here at once, then Open Food Facts after a pause (a newer keystroke cancels the request).
  function resultRow(item, where) {
    const m = macrosOf(item), b = button('food-result ch-bld__result', () => { add(item); });
    const sub = el('small'); sub.append(portionText(item) + ' · ', root.CHADUX.pcf(m[1], m[2], m[3]));
    const k = el('b', '', whole(m[0])); k.append(el('small', '', 'kcal'));
    b.append(el('strong', '', item.name), sub, k); b.dataset.result = where; b.setAttribute('aria-label', 'Add ' + item.name + ', ' + portionText(item) + ', ' + whole(m[0]) + ' kcal');
    return b;
  }
  function paintLocal(term, words) {
    const local = term.trim().length >= 2 ? searchLocal(term).map(f => resultRow(fromFood(f), 'local')) : [];
    const rows = [...local, ...offRows];
    if (words) { const p = el('p', 'ch-hint ch-bld__note', words); p.id = 'builder-note'; rows.push(p); }
    $('builder-results').replaceChildren(...rows);
  }
  async function runSearch(query) {
    const term = String(query).trim(), run = ++searchRun;
    clearTimeout(searchTimer); searchAbort?.abort(); offRows = [];
    if (term.length < 2) { paintLocal(term); return; }
    if (navigator.onLine === false) { paintLocal(term, 'Offline: the foods here still work, and so does Type it.'); return; }
    const controller = searchAbort = new AbortController();
    paintLocal(term, 'Searching Open Food Facts…');
    try {
      const found = await root.CHADFood.find(term, { signal: controller.signal });
      if (run !== searchRun) return;
      offRows = found.items.slice(0, 8).map(it => resultRow(fromOFF(it), 'off'));
      paintLocal(term, found.items.length ? (found.from === 'cache' ? 'Saved on this device' : found.from === 'stale' ? 'Saved earlier; could not refresh' : '') : 'Nothing more on Open Food Facts for “' + term + '”. Type it in instead.');
    } catch (e) {
      if (run !== searchRun || e.kind === 'cancelled') return;
      paintLocal(term, e.kind === 'offline' ? 'Offline: the foods here still work, and so does Type it.' : 'Open Food Facts isn’t answering. The foods here still work, and so do Ask AI and Type it.');
    }
  }
  // Ask AI: the photo and/or words go to your proxy (the food sheet, app11.js); the answer opens in the editable card,
  // and "Add to meal" brings it back here. Without AI set up the sheet says so and offers the other ways.
  function askAI() { root.CHADUX.openFood('camera', context(), defaultFor()); }
  function saveMeal() {
    const s = slot(); if (!s || !items.length || savedAs) return;
    const t = total(items), meal = { slot: slotId, name: autoOr(), macros: t, parts: partsOf(items) }, where = s.name.toLowerCase();
    // The save's Undo and Redo show here; Undo gives the button back, Redo saves it again.
    const shown = (text, action, options = {}) => { savedAs = /^Undone/.test(text) ? null : true; paintFoot(); toast(text === 'Saved as my meal' ? 'Saved as my meal · on ' + where : text, action, options); };
    if (root.CHADQuest.saveMyMeal(meal, shown)) M()?.pulse($('builder-save'), 'just-on', 500);
  }
  function logMeal(later = false) {
    if (!items.length) return;
    const t = total(items), meal = { name: autoOr(), macros: t, parts: partsOf(items) }, target = slotId;
    root.CHADUX.closeSheets();
    const ok = later ? root.CHADUX.planFood({ name: meal.name, kcal: tenth(t[0]), protein: tenth(t[1]), carbs: tenth(t[2]), fat: tenth(t[3]) }) : target ? root.CHADQuest.logCustom(target, meal) : logOther(meal);
    if (ok) { items = []; name = ''; savedAs = null; keep(); }
  }
  // Other food: one entry with what is in it (a single food is simply that food), filed under the meal of the moment.
  function logOther(meal) {
    const one = items.length === 1 ? items[0] : null, [kcal, protein, carbs, fat] = meal.macros.map(tenth), favs = new Set((root.CHADFavourites || []).map(f => f.id));
    // A single Quick log favourite (one portion) counts on its Quick log button too.
    const entry = { id: 'food-' + Date.now() + '-' + Math.random().toString(36).slice(2), day: root.CHADUX.dateKey(), name: meal.name, kcal: Math.max(1, kcal), protein, carbs, fat, meal: defaultMeal(), source: one?.source || 'custom', ...(one ? { portion: portionText(one) } : {}), ...(one && favs.has(one.food) && one.qty === 1 ? { fav: one.food } : {}), parts: meal.parts };
    return root.CHADUX.change({ label: meal.name + ' · ' + Math.round(kcal).toLocaleString('en-AU') + ' kcal', positive: true, day: entry.day,
      forward: s => ({ ...s, entries: [...s.entries.filter(e => e.id !== entry.id), entry] }),
      backward: s => ({ ...s, entries: s.entries.filter(e => e.id !== entry.id) }) });
  }
  const defaultMeal = () => { const block = root.CHADUX.timeBlock(); return block === 'morning' || block === 'midday' ? 'Lunch' : root.CHADUX.hourNow() < 21 ? 'Dinner' : 'Snacks'; };
  // id: a meal ('L', 'D', 'P'), or null for other food. opts.search starts a search with those words.
  function open(id, opts = {}) {
    if (!built) build();
    if (!items.length && !name) { const saved = restore(); if (saved !== undefined && id === undefined) slotId = saved; }
    if (id !== undefined) slotId = id && root.CHADPlan.some(s => s.id === id) ? id : null;
    offRows = []; $('builder-search').value = ''; $('builder-results').replaceChildren(); $('builder-undo').hidden = true;
    paint(); root.CHADUX.closeSheets(); M()?.haptic('tap');
    root.CHADUX.showSheet($('builder-sheet'));
    if (opts.search) { $('builder-search').value = opts.search.slice(0, 100); runSearch(opts.search); }
  }
  root.CHADBuilder = { ...pure, open, items: () => clone(items), slot: () => slotId };
})(globalThis);
