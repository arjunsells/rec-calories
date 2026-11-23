'use strict';
(() => {
  const KEY = 'rec-calories-v1';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const valid = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const defaults = () => ({ schemaVersion: 3, target: 1800, proteinGoal: 180, entries: [] });
  let state = defaults();
  let storageReadable = true;
  let previousGame = null;
  let celebrationTimer;
  let currentDay = dayKey();
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const defaultMeal = () => { const hour = new Date().getHours(); return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snacks'; };
  function prune(entries) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return entries.map(e => { const copy = { ...e }; if (e.day < dayKey(cutoff)) delete copy.thumbnail; return copy; });
  }
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      storageReadable = true;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !valid(parsed.target, 1, 50000) || !Array.isArray(parsed.entries)) throw new Error();
      const ids = new Set();
      const entries = parsed.entries.filter(e => e && typeof e.id === 'string' && !ids.has(e.id) && ids.add(e.id) && typeof e.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) && valid(e.kcal, 1, 50000) && valid(e.protein, 0, 5000) && ['carbs', 'fat'].every(k => e[k] === undefined || valid(e[k], 0, 5000)));
      if (entries.length !== parsed.entries.length || (parsed.proteinGoal !== undefined && !valid(parsed.proteinGoal, 1, 5000))) throw new Error();
      state = { ...parsed, schemaVersion: 3, target: parsed.target, proteinGoal: parsed.proteinGoal ?? 180, entries: prune(entries) };
    } catch { storageReadable = false; message('Saved data could not be read. Saving is paused to protect it. Your existing data has not been replaced.', true); }
  }
  function save(next) {
    if (!storageReadable) { message('Saving is paused to protect unreadable saved data.', true); return false; }
    try { next = { ...next, schemaVersion: 3, entries: prune(next.entries) }; localStorage.setItem(KEY, JSON.stringify(next)); state = next; render(); return true; }
    catch {
      if (next.entries.some(e => e.thumbnail)) {
        try { const lean = { ...next, entries: next.entries.map(e => { const copy = { ...e }; delete copy.thumbnail; return copy; }) }; localStorage.setItem(KEY, JSON.stringify(lean)); state = lean; render(); return true; } catch { /* Preserve original data if storage remains full. */ }
      }
      message('Could not save. Storage may be full or unavailable. Your entry has not been changed.', true); return false; }
  }
  function totals(entries) { return entries.reduce((sum, e) => ({ kcal: sum.kcal + e.kcal, protein: sum.protein + e.protein, carbs: sum.carbs + (e.carbs || 0), fat: sum.fat + (e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); }
  function add(name, kcal, protein, extras = {}) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: dayKey(), name: name.trim().slice(0, 80), kcal, protein, carbs: 0, fat: 0, meal: defaultMeal(), ...extras };
    if (save({ ...state, entries: [...state.entries, entry] })) { message(`${name || 'Entry'} added · ${fmt(kcal)} kcal · +10 XP`); return true; }
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
    $('formula-remaining').textContent = fmt(remaining);
    $('target-label').textContent = fmt(state.target);
    $('protein-total').textContent = fmt(total.protein);
    $('carbs-total').textContent = fmt(total.carbs); $('fat-total').textContent = fmt(total.fat);
    $('protein-bar').value = Math.min(100, total.protein / state.proteinGoal * 100);
    $('carbs-bar').value = Math.min(100, total.carbs / (state.target * 0.5 / 4) * 100);
    $('fat-bar').value = Math.min(100, total.fat / (state.target * 0.3 / 9) * 100);
    $('daily-target').value = state.target;
    $('protein-goal').value = state.proteinGoal;
    $('protein-goal-label').textContent = fmt(state.proteinGoal);
    $('date-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    $('entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    $('entries').replaceChildren();
    meals.forEach(meal => {
      const section = node('li', 'meal-section'); const list = node('ul', 'meal-entries');
      const items = entries.filter(e => (meals.includes(e.meal) ? e.meal : 'Snacks') === meal);
      const heading = node('div', 'section-heading'); heading.append(node('h3', '', meal), node('span', '', `${fmt(totals(items).kcal)} kcal`));
      section.append(heading, list);
      if (!items.length) list.append(node('li', 'meal-empty', 'No food logged yet'));
      items.slice().reverse().forEach(entry => {
        const row = node('li', 'entry'); const info = node('div', 'entry-info');
        info.append(node('strong', '', entry.name || 'Quick entry'), node('small', '', `${entry.portion ? entry.portion + ' \u00b7 ' : ''}P ${fmt(entry.protein)} \u00b7 C ${fmt(entry.carbs || 0)} \u00b7 F ${fmt(entry.fat || 0)} g`));
        if (typeof entry.thumbnail === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(entry.thumbnail)) { const img = node('img', 'entry-thumb'); img.src = entry.thumbnail; img.alt = ''; row.append(img); }
        const remove = node('button', 'delete', '\u00d7'); remove.type = 'button'; remove.setAttribute('aria-label', `Delete ${entry.name || 'entry'}, ${fmt(entry.kcal)} kcal`);
        remove.addEventListener('click', () => { if (save({ ...state, entries: state.entries.filter(e => e.id !== entry.id) })) message('Entry deleted.'); });
        row.append(info, node('span', 'entry-kcal', `${fmt(entry.kcal)} kcal`), remove); list.append(row);
      });
      $('entries').append(section);
    });
    const game = RECGame.derive(state, currentDay);
    renderQuick(); renderHistory(game); renderGame(game);
  }
  function renderQuick() {
    const groups = new Map();
    state.entries.forEach((entry, index) => {
      const key = JSON.stringify([entry.name.toLowerCase(), entry.kcal, entry.protein, entry.carbs || 0, entry.fat || 0]);
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
      button.type = 'button'; button.addEventListener('click', () => add(entry.name, entry.kcal, entry.protein, { carbs: entry.carbs || 0, fat: entry.fat || 0, portion: entry.portion || '' })); container.append(button);
    });
  }
  function renderHistory(game) {
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
      bar.append(fill, target); const gameDay = game.days.get(key);
      if (gameDay) label.children[0].textContent += ` · ${gameDay.grade}${key === currentDay ? ' (so far)' : ` · +${gameDay.xp} day XP`}`;
      row.append(label, bar); $('history-bars').append(row);
    });
  }
  function renderGame(game) {
    $('streak').textContent = `🔥 ${game.streak} day${game.streak === 1 ? '' : 's'}`;
    $('streak').setAttribute('aria-label', `${game.streak} day logging streak`);
    $('level-name').textContent = game.name;
    $('level-number').textContent = `Level ${game.level + 1}`;
    $('xp-total').textContent = `${fmt(game.xp)} XP`;
    $('level-progress').value = game.next ? (game.xp - game.floor) / (game.next - game.floor) * 100 : 100;
    $('level-progress').setAttribute('aria-valuetext', game.next ? `${game.xp - game.floor} of ${game.next - game.floor} XP to next level` : 'Maximum level reached');
    $('level-next').textContent = game.next ? `${fmt(game.next - game.xp)} XP to next level` : 'Top level reached. Keep building your journey.';
    const today = game.days.get(currentDay);
    $('daily-grade').textContent = today ? today.grade : '—';
    $('grade-detail').textContent = today ? 'Today’s grade · so far' : 'Today’s grade · add a log to begin';
    $('badge-count').textContent = `${game.badges.filter(b => b.unlocked).length} / ${game.badges.length}`;
    $('badges').replaceChildren();
    game.badges.forEach(badge => {
      const item = node('li', `badge ${badge.unlocked ? 'unlocked' : 'locked'}`);
      const icon = node('span', 'badge-icon', badge.unlocked ? badge.icon : '○');
      icon.setAttribute('aria-hidden', 'true');
      item.append(icon, node('strong', '', badge.name), node('small', '', `${badge.unlocked ? 'Unlocked' : 'Locked'} · ${badge.hint}`));
      $('badges').append(item);
    });
    if (previousGame) {
      if (game.xp < previousGame.xp) { clearTimeout(celebrationTimer); $('celebration').hidden = true; }
      const fresh = game.badges.filter(b => b.unlocked && !previousGame.badges.find(old => old.id === b.id).unlocked);
      const levelUp = game.level > previousGame.level;
      if (levelUp || fresh.length) {
        clearTimeout(celebrationTimer);
        const celebration = $('celebration');
        celebration.textContent = [levelUp ? `Level up! ${game.name}` : '', ...fresh.map(b => `Badge unlocked: ${b.name}`)].filter(Boolean).join(' · ');
        celebration.hidden = false;
        celebrationTimer = setTimeout(() => { celebration.hidden = true; }, 5000);
      }
    }
    previousGame = game;
  }
  function showView(id) {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== id; });
    document.querySelectorAll('.tab').forEach(button => { button.classList.toggle('active', button.dataset.view === id); if (button.dataset.view === id) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    message(''); render(); window.scrollTo?.(0, 0);
  }
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const kcal = Number($('calories').value); const protein = Number($('protein').value || 0);
    if (!valid(kcal, 1, 50000) || !Number.isInteger(kcal) || !valid(protein, 0, 5000)) return message('Enter whole calories from 1 to 50,000 and protein from 0 to 5,000 g.', true);
    const carbs = Number($('carbs').value || 0), fat = Number($('fat').value || 0);
    if (!valid(carbs, 0, 5000) || !valid(fat, 0, 5000)) return message('Enter carbs and fat from 0 to 5,000 g.', true);
    if (add($('food-name').value, kcal, protein, { carbs, fat, meal: meals.includes($('meal').value) ? $('meal').value : defaultMeal() })) { $('add-form').reset(); $('meal').value = defaultMeal(); $('calories').focus(); }
  });
  $('settings-form').addEventListener('submit', event => {
    event.preventDefault(); const target = Number($('daily-target').value);
    const proteinGoal = Number($('protein-goal').value);
    if (!valid(target, 1, 50000) || !Number.isInteger(target)) return message('Enter a whole daily target from 1 to 50,000 kcal.', true);
    if (!valid(proteinGoal, 1, 5000)) return message('Enter a protein goal from 1 to 5,000 g.', true);
    if (save({ ...state, target, proteinGoal })) { try { const key = $('ai-key').value.trim(); if (key) localStorage.setItem('rec-calories-ai-key', key); else localStorage.removeItem('rec-calories-ai-key'); message('Settings saved.'); } catch { message('Goals saved, but the AI key could not be saved on this device.', true); } }
  });
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { state = defaults(); previousGame = null; read(); render(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (dayKey() !== currentDay && storageReadable) save(state); else render(); } });
  setInterval(() => { if (dayKey() !== currentDay) save(state); }, 30000);
  read(); render();
  if (storageReadable && state.entries.length) save(state);
  $('meal').value = defaultMeal();
  try { $('ai-key').value = localStorage.getItem('rec-calories-ai-key') || ''; } catch { /* Manual logging still works. */ }
  let scanBusy = false, draftThumbnail = '', draftFields = [];
  $('today-scan').addEventListener('click', () => showView('scan'));
  $('scan-settings').addEventListener('click', () => { showView('settings'); $('ai-key').focus(); });
  $('scan-manual').addEventListener('click', () => { showView('today'); $('calories').focus(); });
  $('camera-button').addEventListener('click', () => {
    let key; try { key = localStorage.getItem('rec-calories-ai-key'); } catch { /* Message below. */ }
    if (!key) { $('scan-status').textContent = 'Add your AI key in Settings to scan. You can always enter food manually.'; return; }
    if (!scanBusy) $('photo-input').click();
  });
  $('cancel-scan').addEventListener('click', () => $('confirm-sheet').close());
  $('confirm-sheet').addEventListener('close', () => { draftThumbnail = ''; draftFields = []; $('scan-items').replaceChildren(); });
  $('photo-input').addEventListener('change', async () => {
    const file = $('photo-input').files[0]; if (!file || scanBusy) return;
    scanBusy = true; $('camera-button').disabled = true; $('scan-status').textContent = 'Preparing photo and estimating your meal...';
    try {
      const photo = await RECScan.compress(file);
      const result = await RECScan.analyze(photo.image, localStorage.getItem('rec-calories-ai-key'));
      draftThumbnail = photo.thumbnail; draftFields = []; $('scan-items').replaceChildren();
      result.items.forEach((item, i) => {
        const card = node('fieldset', 'scan-item'); card.append(node('legend', '', `Food ${i + 1}`)); const fields = {};
        for (const [key, label] of Object.entries({ name: 'Food name', portion: 'Estimated amount', kcal: 'Calories (kcal)', protein: 'Protein (g)', carbs: 'Carbs (g)', fat: 'Fat (g)' })) {
          const input = node('input'); input.id = `scan-${i}-${key}`; input.value = item[key]; input.required = true;
          if (key === 'name' || key === 'portion') { input.maxLength = key === 'name' ? 80 : 100; } else { input.type = 'number'; input.min = key === 'kcal' ? '1' : '0'; input.max = key === 'kcal' ? '50000' : '5000'; input.step = key === 'kcal' ? '1' : '0.1'; input.inputMode = 'decimal'; }
          const title = node('label', '', label); title.setAttribute('for', input.id); card.append(title, input); fields[key] = input;
          input.addEventListener('input', () => { $('scan-total').textContent = `${fmt(draftFields.reduce((sum, row) => sum + Number(row.kcal.value || 0), 0))} kcal estimated total`; });
        }
        draftFields.push(fields); $('scan-items').append(card);
      });
      $('scan-total').textContent = `${fmt(result.total)} kcal estimated total`; $('scan-meal').value = defaultMeal();
      $('confirm-sheet').showModal(); $('scan-status').textContent = 'Estimate ready. Review before logging.';
    } catch (error) { $('scan-status').textContent = error.message || 'Scan failed. Try again or enter food manually.'; }
    finally { scanBusy = false; $('camera-button').disabled = false; $('photo-input').value = ''; }
  });
  $('scan-confirm-form').addEventListener('submit', event => {
    event.preventDefault(); if (!draftFields.length) return;
    try {
      const result = RECScan.parse(JSON.stringify({ items: draftFields.map(fields => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, ['name', 'portion'].includes(key) ? input.value : Number(input.value)]))) }));
      const entries = result.items.map((item, i) => ({ ...item, id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, day: dayKey(), meal: $('scan-meal').value, ...(i === 0 ? { thumbnail: draftThumbnail } : {}) }));
      if (save({ ...state, entries: [...state.entries, ...entries] })) { $('confirm-sheet').close(); showView('today'); message(`Meal logged \u00b7 ${fmt(result.total)} kcal \u00b7 +${entries.length * 10} XP`); } else $('scan-total').textContent = 'Could not save this meal. Storage is unavailable or full. Your meal is still here to review.';
    } catch (error) { $('scan-total').textContent = error.message; }
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(async () => { await navigator.serviceWorker.ready; $('offline-status').textContent = 'Ready for offline use on this device.'; }).catch(() => { $('offline-status').textContent = 'Offline setup unavailable. Open this app online and try again.'; });
  } else $('offline-status').textContent = 'This browser does not support offline installation.';
})();
