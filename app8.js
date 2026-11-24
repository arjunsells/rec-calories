'use strict';
// v8 journal: state, validation, persistence, food flows and the offline shell. Rendering helpers live in quest8.js / ux8.js.
(() => {
  const KEY = 'rec-calories-v1', SHELL = 'rec-calories-shell-v8';
  const $ = id => document.getElementById(id);
  const M = () => window.CHADMotion;
  const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }), integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const fmt = value => oneDecimal.format(value);
  const whole = value => integer.format(Math.round(value));
  const dayKey = CHADQuest.dayKey;
  const valid = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const defaults = () => ({ schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [] });
  let state = defaults();
  let storageReadable = true, previousGame = null, lastGame = null, xpGain = 0, celebrationTimer, messageTimer;
  let currentDay = dayKey(), observedToday = dayKey(), currentMealSlot, shownDay = null, turned = false;
  const selectedKey = () => window.CHADUX?.dateKey() || dayKey();
  const defaultMeal = () => { const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Darwin', hour: 'numeric', hourCycle: 'h23' }).format(new Date())); return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snacks'; };
  const glyph = (name, size, fallback) => window.CHADIcons?.icon(name, size) || fallback || '';
  function prune(entries) { return entries; }
  function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
  function message(text, error = false) {
    const m = $('message');
    m.hidden = true; m.textContent = text; m.classList.toggle('error', error); void m.offsetWidth; m.hidden = false;
    clearTimeout(messageTimer); if (text) messageTimer = setTimeout(() => { m.textContent = ''; }, error ? 6000 : 3200);
  }
  function celebrate(text) {
    const c = $('celebration');
    if (!text) { clearTimeout(celebrationTimer); c.hidden = true; return; }
    c.hidden = true; c.textContent = text; void c.offsetWidth; c.hidden = false;
    clearTimeout(celebrationTimer); celebrationTimer = setTimeout(() => { c.hidden = true; }, 3800);
  }
  // Numbers count up when you act on a day; another day's numbers simply appear with its page.
  const num = (id, value, from) => { if (M()) M().count($(id), value, { format: whole, from, instant: turned }); else $(id).textContent = whole(value); };

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
      const prior = parsed.legacyRewards || (parsed.schemaVersion !== 5 ? (() => { const g = RECGame.derive(parsed, dayKey()); return { xp: g.xp, badges: g.badges.filter(b => b.unlocked).map(b => b.id) }; })() : null);
      state = { ...parsed, journeyStartDate: CHADUX.validDate(parsed.journeyStartDate) ? parsed.journeyStartDate : CHADUX.defaultJourneyStart, legacyRewards: prior, legacyGoals: parsed.legacyGoals || (parsed.schemaVersion !== 5 ? { target: parsed.target, proteinGoal: parsed.proteinGoal, carbsGoal: parsed.carbsGoal, fatGoal: parsed.fatGoal } : undefined), schemaVersion: 5, target: parsed.target, proteinGoal: parsed.proteinGoal ?? 220, carbsGoal: parsed.carbsGoal ?? 150, fatGoal: parsed.fatGoal ?? 45, entries: prune(entries) };
    } catch { storageReadable = false; message('Saved data could not be read. Saving is paused to protect it. Your existing data has not been replaced.', true); }
  }
  // Data first, decoration second: the journal is written before anything animates.
  function save(next) {
    if (!storageReadable) { M()?.clearMarks(); message('Saving is paused to protect unreadable saved data.', true); return false; }
    try { next = { ...next, schemaVersion: 5, entries: prune(next.entries) }; localStorage.setItem(KEY, JSON.stringify(next)); }
    catch { M()?.clearMarks(); M()?.haptic('warn'); message('Could not save. Storage may be full or unavailable. Your entry has not been changed.', true); return false; }
    state = next; render(); M()?.flush();
    return true;
  }
  function totals(entries) { return entries.reduce((sum, e) => ({ kcal: sum.kcal + e.kcal, protein: sum.protein + e.protein, carbs: sum.carbs + (e.carbs || 0), fat: sum.fat + (e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); }
  function add(name, kcal, protein, extras = {}) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: selectedKey(), name: name.trim().slice(0, 80), kcal, protein, carbs: 0, fat: 0, meal: defaultMeal(), ...extras };
    M()?.mark(`#entries [data-entry="${entry.id}"]`, 'just-on');
    if (!save({ ...state, entries: [...state.entries, entry] })) return false;
    popXP();
    if (window.CHADUX?.toast) window.CHADUX.toast(`${entry.name || 'Entry'} · ${whole(kcal)} kcal`, () => save({ ...state, entries: state.entries.filter(e => e.id !== entry.id) }), { xp: xpGain });
    else message(`${name || 'Entry'} added · ${fmt(kcal)} kcal`);
    return true;
  }
  let scanner = null, draft = [], draftSource = 'photo', scannerSession = 0;

  function render() {
    const focused = document.activeElement; let restoreFocus;
    if (focused?.dataset?.slot) restoreFocus = `[data-slot="${focused.dataset.slot}"][data-tier="${focused.dataset.tier}"]`;
    else if (focused?.classList?.contains('water-row')) restoreFocus = '.water-row';
    else if (focused?.dataset?.quest) restoreFocus = `#${focused.closest('.view').id} [data-quest="${focused.dataset.quest}"]`;
    else if (focused?.dataset?.exercise) restoreFocus = `.training-level[data-day="${focused.closest('.training-level').dataset.day}"] [data-exercise="${focused.dataset.exercise}"]`;
    currentDay = selectedKey(); observedToday = dayKey(); currentMealSlot = window.CHADUX?.currentSlot();
    turned = shownDay !== null && shownDay !== currentDay; shownDay = currentDay;
    const goals = CHADQuest.goals(state, currentDay), entries = state.entries.filter(e => e.day === currentDay), t = totals(entries);
    const target = goals.target ?? state.target, proteinGoal = goals.proteinGoal ?? state.proteinGoal, carbsGoal = goals.carbsGoal ?? state.carbsGoal ?? 150, fatGoal = goals.fatGoal ?? state.fatGoal ?? 45, over = t.kcal > target;
    // Big numbers are whole; the exact values stay in the labels and the journal.
    num('remaining', Math.abs(target - t.kcal)); $('remaining-label').textContent = over ? 'over' : 'left'; $('remaining-hint').classList.toggle('is-over', over);
    num('consumed', t.kcal, 0); num('protein-total', t.protein, 0); num('carbs-total', t.carbs, 0); num('fat-total', t.fat, 0);
    $('target-label').textContent = whole(target); $('protein-goal-label').textContent = whole(proteinGoal); $('carbs-goal-label').textContent = whole(carbsGoal); $('fat-goal-label').textContent = whole(fatGoal);
    for (const [id, value, goal, unit] of [['calorie-ring', t.kcal, target, 'calories'], ['protein-ring', t.protein, proteinGoal, 'grams protein']]) { $(id).style.setProperty('--p', Math.min(100, value / goal * 100)); $(id).setAttribute('aria-label', `${fmt(value)} of ${fmt(goal)} ${unit}`); }
    for (const [id, value, goal, unit] of [['carbs', t.carbs, carbsGoal, 'grams carbs'], ['fat', t.fat, fatGoal, 'grams fat']]) { $(id + '-bar').style.setProperty('--p', Math.min(1, value / goal)); $(id + '-meter').setAttribute('aria-label', `${fmt(value)} of ${fmt(goal)} ${unit}`); }
    $('entry-count').textContent = entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : '';
    renderEntries($('entries'), entries, 'Nothing logged yet');
    renderPast(); renderRecent();
    const game = CHADQuest.rewards(state, dayKey(), RECGame.derive(state, dayKey()));
    renderGame(game);
    CHADQuest.render(state, { save, showView, popXP, message, celebrate, key: currentDay, game, xpGain: () => xpGain });
    window.CHADUX?.render(state);
    if (restoreFocus) document.querySelector(restoreFocus)?.focus({ preventScroll: true });
  }
  function renderEntries(container, entries, empty) {
    container.replaceChildren();
    if (!entries.length) { const li = node('li', 'empty ch-empty'); li.append(node('strong', '', empty)); container.append(li); return; }
    entries.slice().reverse().forEach(e => {
      const row = node('li', 'entry'), info = node('div', 'entry-info'), when = e.day === currentDay ? e.meal || 'Meal' : new Date(e.day + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', day: 'numeric', month: 'short' });
      row.dataset.entry = e.id;
      info.append(node('strong', '', e.name || 'Quick entry'), node('small', '', `${when} · ${whole(e.kcal)} kcal · P ${fmt(e.protein)} · C ${fmt(e.carbs || 0)} · F ${fmt(e.fat || 0)}`));
      const again = node('button', 'repeat'); again.type = 'button'; again.innerHTML = glyph('repeat', 20, '↻'); again.setAttribute('aria-label', `Log ${e.name || 'entry'} again`);
      again.onclick = () => add(e.name, e.kcal, e.protein, { carbs: e.carbs || 0, fat: e.fat || 0, portion: e.portion || '', source: 'repeat' });
      const del = node('button', 'delete'); del.type = 'button'; del.innerHTML = glyph('trash', 20, '×'); del.setAttribute('aria-label', `Delete ${e.name || 'entry'}`);
      del.onclick = () => {
        const tier = e.planSlot ? state.questsV5?.[e.day]?.picks?.[e.planSlot] : undefined;
        if (CHADQuest.removeEntry(state, e, save) === false) return;
        M()?.haptic('off');
        window.CHADUX?.toast(`${e.name || 'Entry'} deleted`, () => {                       // deleting is no longer final
          if (state.entries.some(x => x.id === e.id)) return;
          const quests = { ...state.questsV5 };
          if (e.planSlot && tier && !quests[e.day]?.picks?.[e.planSlot]) quests[e.day] = { ...quests[e.day], picks: { ...quests[e.day]?.picks, [e.planSlot]: tier } };
          save({ ...state, questsV5: quests, entries: [...state.entries, e] });
        }, { kind: 'off' });
      };
      row.append(info, again, del); container.append(row);
    });
  }
  // Other days, newest first. Built only while Progress is on screen, forty at a time: the list grows for months.
  let pastShown = 40;
  function renderPast() {
    if ($('history').hidden) return;
    const past = state.entries.filter(e => e.day !== currentDay).sort((a, b) => a.day.localeCompare(b.day)), shown = past.slice(-pastShown);
    renderEntries($('past-entries'), shown, 'No other days yet');
    if (past.length > shown.length) {
      const row = node('li', 'entry entry--more'), more = node('button', 'ch-link ch-link--center', `Show ${Math.min(40, past.length - shown.length)} older`);
      more.type = 'button'; more.onclick = () => { pastShown += 40; renderPast(); }; row.append(more); $('past-entries').append(row);
    }
  }
  // One tap to repeat something eaten before: the last few foods that are not plan cards.
  function renderRecent() {
    const seen = new Set(), list = [];
    for (let i = state.entries.length - 1; i >= 0 && list.length < 4; i--) {
      const e = state.entries[i], id = (e.name || '').trim().toLowerCase();
      if (!e.name || e.source === 'plan' || e.source === 'addon' || seen.has(id)) continue;
      seen.add(id); list.push(e);
    }
    $('recent-foods').hidden = !list.length;
    $('recent-food-list').replaceChildren(...list.map(e => {
      const b = node('button', 'recent-food'); b.type = 'button'; b.innerHTML = glyph('repeat', 22);
      b.append(node('span', '', e.name), node('b', '', `${whole(e.kcal)} kcal`));
      b.onclick = () => { window.CHADUX?.closeSheets(); add(e.name, e.kcal, e.protein, { carbs: e.carbs || 0, fat: e.fat || 0, portion: e.portion || '', source: 'repeat' }); };
      return b;
    }));
  }
  function renderGame(g) {
    xpGain = previousGame ? Math.max(0, g.xp - previousGame.xp) : 0; lastGame = g;
    $('level-name').textContent = g.name; $('level-number').textContent = `Level ${g.level + 1}`; $('level-badge').textContent = g.level + 1;
    if (M()) M().count($('xp-total'), g.xp, { format: n => `${whole(n)} XP` }); else $('xp-total').textContent = `${fmt(g.xp)} XP`;
    $('level-progress').value = g.next ? (g.xp - g.floor) / (g.next - g.floor) * 100 : 100;
    $('xp-bar').style.setProperty('--p', $('level-progress').value / 100); $('xp-bar').setAttribute('aria-valuenow', Math.round($('level-progress').value));
    $('level-next').textContent = g.next ? `${whole(g.next - g.xp)} XP to level ${g.level + 2}` : 'Legend status. Keep showing up.';
    // Legacy v4 quest and week rows stay in the hidden containers that older saved layouts expect.
    $('quests').replaceChildren(); g.quests.forEach(q => { const row = node('div', 'quest'), bar = node('progress'); bar.max = q.target; bar.value = q.progress; row.append(node('span', '', `${q.complete ? '✓' : '○'} ${q.name}`), bar); $('quests').append(row); });
    $('history-bars').replaceChildren(); for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const row = node('div', 'history-row'); row.append(node('span', '', dayKey(d)), node('strong', '', `${fmt(g.days.get(dayKey(d))?.kcal || 0)} kcal`)); $('history-bars').append(row); }
    if (previousGame) {
      const fresh = g.badges.filter(b => b.unlocked && !previousGame.badges.find(o => o.id === b.id)?.unlocked);
      if (g.level > previousGame.level) { $('new-level').textContent = `Level ${g.level + 1} · ${g.name}`; celebrate($('new-level').textContent); M()?.haptic('success'); M()?.confetti($('today-scan')); }
      else if (fresh.length) { celebrate(`Badge unlocked · ${fresh.map(b => b.name).join(', ')}`); M()?.haptic('success'); }
    }
    previousGame = g;
  }
  function popXP() { M()?.pulse($('today-scan'), 'bounce', 600); M()?.haptic('on'); }
  function stopScanner() { scannerSession++; scanner?.stop(); scanner = null; $('barcode-video').hidden = true; $('stop-camera').hidden = true; }
  function showView(id) {
    stopScanner();
    if (id === 'scan') { window.CHADUX.openFood('camera'); return; }
    window.CHADUX?.closeSheets();
    const before = document.querySelector('.view:not([hidden])')?.id;
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== id);
    document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('active', b.dataset.view === id); if (b.dataset.view === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.CHADUX?.tab(id);
    if (before !== id) render();                                   // hidden tabs are not kept up to date: build this one now
    if (id === 'history') CHADQuest.paintCharts(before !== id);
    if (id === 'settings') fillGoals();
    window.scrollTo(0, 0);
    if (before && before !== id) { M()?.haptic('tap'); M()?.enter($(id)); }
  }
  function getKey() { try { return localStorage.getItem('rec-calories-ai-key') || ''; } catch { return ''; } }
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => showView(b.dataset.view));
  $('today-scan').onclick = () => window.CHADUX.openAdd();
  $('scan-settings').onclick = () => { showView('settings'); $('ai-key').scrollIntoView({ block: 'center' }); $('ai-key').focus(); };
  $('scan-manual').onclick = () => { const term = $('scan').dataset.mode === 'search' ? $('food-search').value.trim() : ''; window.CHADUX.openFood('manual'); if (term && !$('food-name').value) $('food-name').value = term.slice(0, 80); };
  $('close-level').onclick = () => $('level-up').close();
  $('open-level').onclick = () => {
    const g = lastGame; if (!g) return;
    $('new-level').textContent = `Level ${g.level + 1} · ${g.name}`;
    $('level-list').replaceChildren(...(CHADQuest.LEVELS || []).map(([name, floor], i) => { const li = node('li', i === g.level ? 'is-current' : i < g.level ? 'is-done' : ''); li.append(node('span', '', `${i + 1} · ${name}`), node('span', '', `${whole(floor)} XP`)); return li; }));
    $('level-up').showModal();
  };
  $('add-form').onsubmit = e => {
    e.preventDefault();
    const n = ['calories', 'protein', 'carbs', 'fat'].map(id => Number($(id).value || 0));
    if (!valid(n[0], 1, 50000) || !n.slice(1).every(v => valid(v, 0, 5000))) return message('Check your nutrition numbers.', true);
    if (add($('food-name').value, n[0], n[1], { carbs: n[2], fat: n[3], meal: $('meal').value, source: 'manual' })) { $('add-form').reset(); $('meal').value = defaultMeal(); window.CHADUX?.closeSheets(); showView('today'); }
  };
  const presets = { cut: [1900, 220, 150, 45], reset: [2700, 200, 320, 70], bulk: [3000, 200, 370, 80] }, goalIds = ['daily-target', 'protein-goal', 'carbs-goal', 'fat-goal'];
  $('phase').onchange = () => { const p = presets[$('phase').value]; if (p) p.forEach((v, i) => $(goalIds[i]).value = v); };
  $('settings-form').onsubmit = e => {
    e.preventDefault();
    const journeyStartDate = $('journey-start-date').value;
    if (!CHADUX.validDate(journeyStartDate)) return message('Choose a valid journey start date.', true);
    const v = goalIds.map(id => Number($(id).value));
    if (!valid(v[0], 1, 50000) || !v.slice(1).every(n => valid(n, 1, 5000))) return message('Check your goal numbers.', true);
    if (!save({ ...state, journeyStartDate, phaseMode: $('phase').value, target: v[0], proteinGoal: v[1], carbsGoal: v[2], fatGoal: v[3], customGoals: v, phaseMacros: ['cut', 'reset', 'bulk'].includes($('phase').value) ? { ...state.phaseMacros, [$('phase').value]: v } : state.phaseMacros })) return;
    try { const k = $('ai-key').value.trim(); if (k) localStorage.setItem('rec-calories-ai-key', k); else localStorage.removeItem('rec-calories-ai-key'); M()?.haptic('on'); message('Settings saved.'); }
    catch { message('Goals saved. Key storage unavailable.', true); }
  };

  /* ---- review + log a found or estimated food ---- */
  function openResult(items, source) {
    const ai = source === 'photo' || source === 'text';
    draft = items; draftSource = source;
    $('confirm-title').textContent = ai ? 'Your meal, decoded.' : 'Review and log';
    $('scan-items').replaceChildren(...draft.map(item => node('h3', '', item.name)));
    $('confidence').textContent = ai ? 'AI estimate · check ingredients and portions' : `Open Food Facts · ${items[0].portion} · check package label`;
    $('portion-slider').value = '1'; $('serving-control').hidden = items[0].basis !== '100g'; $('serving-grams').value = '100';
    $('scan-meal').value = window.CHADUX.foodMeal() || defaultMeal();
    updateResult(); window.CHADUX.closeSheets(); window.CHADUX.showSheet($('confirm-sheet'));
  }
  function result() { const m = Number($('portion-slider').value) * (draft[0]?.basis === '100g' ? Number($('serving-grams').value) / 100 : 1); return draft.map(i => ({ ...i, kcal: Math.round(i.kcal * m), protein: Math.round(i.protein * m * 10) / 10, carbs: Math.round(i.carbs * m * 10) / 10, fat: Math.round(i.fat * m * 10) / 10, portion: `${fmt(m)}× ${i.portion}` })); }
  function updateResult() { const t = totals(result()); $('portion-label').textContent = `${$('portion-slider').value}×`; $('scan-total').textContent = `${fmt(t.kcal)} kcal`; $('result-macros').textContent = `Protein ${fmt(t.protein)} g · Carbs ${fmt(t.carbs)} g · Fat ${fmt(t.fat)} g`; }
  $('portion-slider').oninput = updateResult; $('serving-grams').oninput = updateResult; $('cancel-scan').onclick = () => window.CHADUX.closeSheet($('confirm-sheet'));
  $('copy-result').onclick = async () => { const t = totals(result()); try { await navigator.clipboard.writeText(`${draft.map(i => i.name).join(' + ')} · ${fmt(t.kcal)} kcal · P ${fmt(t.protein)}g C ${fmt(t.carbs)}g F ${fmt(t.fat)}g`); message('Summary copied.'); } catch { message('Clipboard unavailable. Try from HTTPS.', true); } };
  $('scan-confirm-form').onsubmit = e => {
    e.preventDefault(); if (!draft.length) return;
    const items = result();
    if (!items.every(i => valid(i.kcal, 1, 50000) && ['protein', 'carbs', 'fat'].every(k => valid(i[k], 0, 5000)))) return message('Check serving size and nutrition limits.', true);
    const entries = items.map((item, i) => ({ ...item, id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, day: selectedKey(), meal: $('scan-meal').value, source: draftSource })), ids = new Set(entries.map(x => x.id));
    if (!save({ ...state, entries: [...state.entries, ...entries] })) return;
    window.CHADUX.closeSheets(); showView('today'); popXP();
    window.CHADUX.toast(`${entries.length === 1 ? entries[0].name : entries.length + ' items'} · ${whole(totals(entries).kcal)} kcal`, () => save({ ...state, entries: state.entries.filter(x => !ids.has(x.id)) }), { xp: xpGain });
  };

  /* ---- Snap + Say (your own OpenAI key) ---- */
  let scanBusy = false;
  const needKey = () => { $('key-card').hidden = false; $('key-card').scrollIntoView({ block: 'center' }); };
  async function estimate(file) {
    if (!getKey()) return needKey();
    if (scanBusy) return;
    const trigger = file ? $('camera-button') : $('describe-button');
    scanBusy = true; $('scan-status').textContent = 'Decoding your meal…'; $('camera-button').disabled = $('describe-button').disabled = true; trigger.classList.add('is-loading');
    try { const photo = file ? await RECScan.compress(file) : null; const r = await RECScan.analyze(photo?.image || null, getKey(), fetch, $('food-description').value); openResult(r.items, file ? 'photo' : 'text'); $('scan-status').textContent = 'Ready to review.'; }
    catch (e) { $('scan-status').textContent = e.message; M()?.haptic('warn'); }
    finally { scanBusy = false; $('camera-button').disabled = $('describe-button').disabled = false; trigger.classList.remove('is-loading'); $('photo-input').value = ''; }
  }
  $('camera-button').onclick = () => { if (!getKey()) needKey(); else $('photo-input').click(); };
  $('photo-input').onchange = () => { if ($('photo-input').files[0]) estimate($('photo-input').files[0]); };
  $('describe-button').onclick = () => { if (!$('food-description').value.trim()) return message('Describe your meal first.', true); estimate(); };

  /* ---- food finder: live search with debounce, cancel, saved results and an honest offline state ---- */
  let searchRun = 0, searchAbort = null, searchTimer, barcodeBusy = false;
  function foodLoading(text) { const rows = node('div', 'ch-skel'); rows.append(node('i'), node('i'), node('i')); $('food-state').hidden = true; $('food-results').replaceChildren(rows); $('scan-status').textContent = text; }
  function foodState(kind, title, text, retry) {
    const box = $('food-state'), actions = node('div', 'ch-state__actions');
    $('food-results').replaceChildren(); $('scan-status').textContent = '';
    box.className = 'ch-state'; box.dataset.kind = kind; box.innerHTML = glyph(kind === 'offline' ? 'wifi-off' : kind === 'empty' ? 'magnifier' : 'refresh', 32);
    box.append(node('strong', '', title), node('p', '', text));
    if (retry) { const b = node('button', 'ch-btn ch-btn--sm', 'Try again'); b.type = 'button'; b.onclick = retry; actions.append(b); box.append(actions); }
    box.hidden = false;
  }
  function foodRecents() {
    const box = $('recent-searches'), empty = !$('food-search').value.trim();
    box.replaceChildren(...(empty ? CHADFood.recent(6) : []).map(term => { const b = node('button'); b.type = 'button'; b.innerHTML = glyph('clock', 15); b.append(term); b.onclick = () => { $('food-search').value = term; runSearch(term); }; return b; }));
  }
  function foodIdle() { searchRun++; searchAbort?.abort(); clearTimeout(searchTimer); $('food-results').replaceChildren(); $('food-state').hidden = true; $('scan-status').textContent = ''; foodRecents(); }
  async function runSearch(query, fresh = false) {
    const term = String(query).trim(), run = ++searchRun;
    clearTimeout(searchTimer); searchAbort?.abort();
    if (term.length < 2) { foodIdle(); if (term) $('scan-status').textContent = CHADFood.MESSAGES.input; return; }
    const controller = searchAbort = new AbortController();
    $('recent-searches').replaceChildren(); foodLoading('Searching Open Food Facts…');
    const slow = setTimeout(() => { if (run === searchRun) $('scan-status').textContent = 'Still looking…'; }, 3500);
    try {
      const found = await CHADFood.find(term, { signal: controller.signal, fresh, onStatus: status => { if (run === searchRun && status === 'retry') $('scan-status').textContent = 'Open Food Facts is busy. Retrying…'; } });
      if (run !== searchRun) return;
      if (!found.items.length) return foodState('empty', 'No matches', `Nothing with complete nutrition for “${term}”. Try another name, or Quick add it.`);
      $('food-state').hidden = true;
      $('food-results').replaceChildren(...found.items.map((item, i) => {
        const b = node('button', 'food-result'), kcal = node('b', '', whole(item.kcal)); b.type = 'button'; b.style.animationDelay = `${Math.min(i, 8) * 25}ms`; kcal.append(node('small', '', 'kcal'));
        b.append(node('strong', '', item.name), node('small', '', [item.brand, item.portion].filter(Boolean).join(' · ')), kcal);
        b.onclick = () => openResult([item], item.source); return b;
      }));
      $('scan-status').textContent = `${found.items.length} result${found.items.length === 1 ? '' : 's'}` + (found.from === 'cache' ? ' · saved on this device' : found.from === 'stale' ? ' · saved earlier, could not refresh' : '');
    } catch (e) {
      if (run !== searchRun || e.kind === 'cancelled') return;
      M()?.haptic('warn');
      if (e.kind === 'offline') foodState('offline', 'You are offline', e.message, () => runSearch(term, true));
      else foodState('error', 'Search is unavailable', e.message, () => runSearch(term, true));
    } finally { clearTimeout(slow); }
  }
  async function findBarcode(code) {
    if (barcodeBusy) return;
    barcodeBusy = true; foodLoading('Looking up the barcode…');
    try { const item = await CHADFood.lookup(code); $('food-results').replaceChildren(); $('scan-status').textContent = ''; openResult([item], 'barcode'); }
    catch (e) {
      M()?.haptic('warn');
      if (e.kind === 'offline') foodState('offline', 'You are offline', e.message, () => findBarcode(code));
      else if (['notfound', 'incomplete', 'input'].includes(e.kind)) foodState('empty', e.kind === 'input' ? 'Check the digits' : 'No nutrition found', e.message);
      else foodState('error', 'Lookup is unavailable', e.message, () => findBarcode(code));
    } finally { barcodeBusy = false; }
  }
  $('food-search').addEventListener('input', () => {
    const term = $('food-search').value.trim();
    clearTimeout(searchTimer);
    if (term.length < 2) return foodIdle();
    $('recent-searches').replaceChildren();
    searchTimer = setTimeout(() => runSearch(term), 450);                         // one request per pause, not per keystroke
  });
  $('search-form').onsubmit = e => { e.preventDefault(); runSearch($('food-search').value); $('food-search').blur(); };
  $('barcode-form').onsubmit = e => { e.preventDefault(); findBarcode($('barcode').value); };
  $('barcode-camera').onclick = async () => {
    stopScanner(); const session = scannerSession;
    $('barcode-video').hidden = false; $('stop-camera').hidden = false; $('food-state').hidden = true; $('scan-status').textContent = 'Point your camera at a barcode.';
    try { const controls = await CHADFood.startScanner($('barcode-video'), code => { stopScanner(); M()?.haptic('success'); $('barcode').value = code; findBarcode(code); }); if (session !== scannerSession) controls.stop(); else scanner = controls; }
    catch (e) { stopScanner(); $('scan-status').textContent = e.message; }
  };
  $('stop-camera').onclick = stopScanner;
  addEventListener('online', () => { if ($('scan-sheet').open && !$('food-state').hidden && $('food-state').dataset.kind === 'offline' && $('scan').dataset.mode === 'search') runSearch($('food-search').value, true); });

  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { state = defaults(); previousGame = null; read(); render(); fillGoals(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopScanner(); else render(); });
  setInterval(() => { if (!document.hidden && !document.querySelector('dialog[open]') && (dayKey() !== observedToday || window.CHADUX?.currentSlot() !== currentMealSlot)) render(); }, 60000);
  function fillGoals() { $('journey-start-date').value = CHADUX.validDate(state.journeyStartDate) ? state.journeyStartDate : CHADUX.defaultJourneyStart; const g = { ...state, ...CHADQuest.goals(state, dayKey()) }; [g.target, g.proteinGoal, g.carbsGoal, g.fatGoal].forEach((v, i) => $(goalIds[i]).value = v); }
  if (window.CHADUX) { window.CHADUX.save = save; window.CHADUX.popXP = popXP; window.CHADUX.onFoodOpen = kind => { $('food-state').hidden = true; if (kind === 'search') { if ($('food-search').value.trim().length < 2) foodIdle(); } else { $('food-results').replaceChildren(); $('scan-status').textContent = ''; } }; }
  window.CHADUX?.setup({ stopScanner, render });
  read(); render(); fillGoals(); if (storageReadable) save(state); $('meal').value = defaultMeal(); $('ai-key').value = getKey();

  /* ---- offline shell ---- */
  if ('serviceWorker' in navigator) {
    const sw = navigator.serviceWorker, hadController = !!sw.controller;
    let fresh = true, handled = false;
    setTimeout(() => { fresh = false; }, 12000);
    sw.register('./sw.js').then(() => sw.ready).then(() => $('offline-status').textContent = 'Ready for offline logging. Food lookup and AI need internet.').catch(() => $('offline-status').textContent = 'Offline setup unavailable. Try opening online again.');
    // A newer shell took over this page. The shell serves page and assets from one cache, so reloading is all it takes.
    if (hadController) sw.addEventListener('controllerchange', () => {
      if (handled || !sw.controller) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = e => {
        if (handled || typeof e.data !== 'string' || e.data === SHELL) return;
        handled = true;
        try { if (sessionStorage.getItem('rec-calories-reloaded') === e.data) return; sessionStorage.setItem('rec-calories-reloaded', e.data); } catch { /* reload at most once per page either way */ }
        const busy = document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (fresh && !busy) location.reload();
        else window.CHADUX?.toast('Update ready', () => location.reload(), { action: 'Reload', icon: 'refresh', life: 12000 });
      };
      sw.controller.postMessage('version', [channel.port2]);
    });
  }
})();
