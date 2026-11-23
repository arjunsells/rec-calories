'use strict';
(() => {
  const KEY = 'rec-calories-v1';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const valid = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  let state = { target: 1800, entries: [] };
  let currentDay = dayKey();
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !valid(parsed.target, 1, 50000) || !Array.isArray(parsed.entries)) throw new Error();
      const ids = new Set();
      const entries = parsed.entries.filter(e => e && typeof e.id === 'string' && !ids.has(e.id) && ids.add(e.id) && typeof e.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) && valid(e.kcal, 1, 50000) && valid(e.protein, 0, 5000)).map(e => ({ id: e.id, name: e.name.slice(0, 80), day: e.day, kcal: e.kcal, protein: e.protein }));
      state = { target: parsed.target, entries };
    } catch { message('Saved data could not be read. New changes may replace it. Browser storage must be enabled.', true); }
  }
  function save(next) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); state = next; render(); return true; }
    catch { message('Could not save. Storage may be full or unavailable. Your entry has not been changed.', true); return false; }
  }
  function totals(entries) { return entries.reduce((sum, e) => ({ kcal: sum.kcal + e.kcal, protein: sum.protein + e.protein }), { kcal: 0, protein: 0 }); }
  function add(name, kcal, protein) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: dayKey(), name: name.trim().slice(0, 80), kcal, protein };
    if (save({ ...state, entries: [...state.entries, entry] })) { message(`${name || 'Entry'} added · ${fmt(kcal)} kcal`); return true; }
    return false;
  }
  function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
  function render() {
    currentDay = dayKey();
    const entries = state.entries.filter(e => e.day === currentDay);
    const total = totals(entries);
    const remaining = state.target - total.kcal;
    $('remaining').textContent = fmt(Math.abs(remaining));
    $('remaining-label').textContent = remaining < 0 ? 'kcal over target' : 'kcal remaining';
    $('calorie-ring').style.setProperty('--progress', `${Math.min(total.kcal / state.target * 100, 100)}%`);
    $('calorie-ring').setAttribute('aria-label', `${fmt(total.kcal)} of ${fmt(state.target)} kcal eaten; ${fmt(Math.abs(remaining))} ${remaining < 0 ? 'over target' : 'remaining'}`);
    $('calorie-ring').closest('.summary').classList.toggle('over', remaining < 0);
    $('consumed').textContent = fmt(total.kcal);
    $('target-label').textContent = fmt(state.target);
    $('protein-total').textContent = fmt(total.protein);
    $('daily-target').value = state.target;
    $('date-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    $('entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    $('entries').replaceChildren();
    if (!entries.length) $('entries').append(node('li', 'empty', 'A fresh start. Add your first entry above.'));
    entries.slice().reverse().forEach(entry => {
      const row = node('li', 'entry');
      const info = node('div', 'entry-info');
      info.append(node('strong', '', entry.name || 'Quick entry'), node('small', '', `${fmt(entry.protein)} g protein`));
      const remove = node('button', 'delete', '×');
      remove.type = 'button'; remove.setAttribute('aria-label', `Delete ${entry.name || 'entry'}, ${fmt(entry.kcal)} kcal`);
      remove.addEventListener('click', () => { if (save({ ...state, entries: state.entries.filter(e => e.id !== entry.id) })) message('Entry deleted.'); });
      row.append(info, node('span', 'entry-kcal', `${fmt(entry.kcal)} kcal`), remove); $('entries').append(row);
    });
    renderQuick(); renderHistory();
  }
  function renderQuick() {
    const groups = new Map();
    state.entries.forEach((entry, index) => {
      const key = JSON.stringify([entry.name.toLowerCase(), entry.kcal, entry.protein]);
      const previous = groups.get(key);
      groups.set(key, { entry, count: (previous?.count || 0) + 1, index });
    });
    const values = [...groups.values()];
    const recent = values.slice().sort((a, b) => b.index - a.index).slice(0, 3);
    const frequent = values.filter(g => g.count > 1 && !recent.includes(g)).sort((a, b) => b.count - a.count || b.index - a.index).slice(0, 3);
    const container = $('quick-items'); container.replaceChildren();
    if (!values.length) return;
    container.append(node('p', '', 'Tap to add again · recent & frequent'));
    [...recent, ...frequent].forEach(({ entry }) => {
      const button = node('button', '', `+ ${entry.name || 'Quick entry'} · ${fmt(entry.kcal)} kcal`);
      button.type = 'button'; button.addEventListener('click', () => add(entry.name, entry.kcal, entry.protein)); container.append(button);
    });
  }
  function renderHistory() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (6 - i));
      const key = dayKey(date); return { date, key, total: totals(state.entries.filter(e => e.day === key)) };
    });
    const max = Math.max(state.target, ...days.map(d => d.total.kcal)) * 1.08;
    $('history-bars').replaceChildren();
    days.forEach(({ date, key, total }) => {
      const row = node('div', 'history-row');
      const label = node('div', 'history-label');
      const day = key === dayKey() ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      const value = node('strong', '', `${fmt(total.kcal)} `); value.append(node('small', '', 'kcal'));
      label.append(node('span', '', day), value);
      const bar = node('div', 'bar'); bar.setAttribute('aria-hidden', 'true');
      const fill = node('div', 'bar-fill'); fill.style.width = `${total.kcal / max * 100}%`;
      const target = node('span', 'bar-target'); target.style.left = `${state.target / max * 100}%`;
      bar.append(fill, target); row.append(label, bar); $('history-bars').append(row);
    });
  }
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== tab.dataset.view; });
    document.querySelectorAll('.tab').forEach(button => { button.classList.toggle('active', button === tab); if (button === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    message(''); render();
  }));
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const kcal = Number($('calories').value); const protein = Number($('protein').value || 0);
    if (!valid(kcal, 1, 50000) || !Number.isInteger(kcal) || !valid(protein, 0, 5000)) return message('Enter whole calories from 1 to 50,000 and protein from 0 to 5,000 g.', true);
    if (add($('food-name').value, kcal, protein)) { $('add-form').reset(); $('calories').focus(); }
  });
  $('settings-form').addEventListener('submit', event => {
    event.preventDefault(); const target = Number($('daily-target').value);
    if (!valid(target, 1, 50000) || !Number.isInteger(target)) return message('Enter a whole daily target from 1 to 50,000 kcal.', true);
    if (save({ ...state, target })) message('Daily target saved.');
  });
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { state = { target: 1800, entries: [] }; read(); render(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (dayKey() !== currentDay) render(); }, 30000);
  read(); render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(async () => { await navigator.serviceWorker.ready; $('offline-status').textContent = 'Ready for offline use on this device.'; }).catch(() => { $('offline-status').textContent = 'Offline setup unavailable. Open this app online and try again.'; });
  } else $('offline-status').textContent = 'This browser does not support offline installation.';
})();
