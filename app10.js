'use strict';
// CHAD v10 · the journal: state, validation, persistence, reversible changes, food flows, Snap + Say and the offline
// shell. Screens are drawn by quest10.js, Gym mode by gym10.js; navigation, sheets and toasts live in ux10.js.
(() => {
  const KEY = 'rec-calories-v1', SHELL = 'rec-calories-shell-v10';
  const $ = id => document.getElementById(id);
  const M = () => window.CHADMotion;
  const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }), integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const fmt = value => oneDecimal.format(value);
  const whole = value => integer.format(Math.round(value));
  const dayKey = CHADQuest.dayKey;
  const valid = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const defaults = () => ({ schemaVersion: 5, journeyStartDate: '2026-10-08', target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [] });
  let state = defaults();
  let storageReadable = true, previousGame = null, lastGame = null, xpGain = 0, celebrationTimer, messageTimer, celebratedLevel = null;
  const celebratedBadges = new Set();                           // a level or badge is celebrated once, however often it is undone and redone
  let currentDay = dayKey(), observedToday = dayKey(), currentMealSlot, shownDay = null, turned = false;
  const selectedKey = () => window.CHADUX?.dateKey() || dayKey();
  const defaultMeal = () => { const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Darwin', hour: 'numeric', hourCycle: 'h23' }).format(new Date())); return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snacks'; };
  const glyph = (name, size, fallback) => window.CHADIcons?.icon(name, size) || fallback || '';
  const newId = (n = 0) => `${Date.now()}-${n}-${Math.random().toString(36).slice(2)}`;
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
      state = { ...parsed, journeyStartDate: CHADUX.validDate(parsed.journeyStartDate) ? parsed.journeyStartDate : CHADUX.defaultJourneyStart, legacyRewards: prior, legacyGoals: parsed.legacyGoals || (parsed.schemaVersion !== 5 ? { target: parsed.target, proteinGoal: parsed.proteinGoal, carbsGoal: parsed.carbsGoal, fatGoal: parsed.fatGoal } : undefined), schemaVersion: 5, target: parsed.target, proteinGoal: parsed.proteinGoal ?? 220, carbsGoal: parsed.carbsGoal ?? 150, fatGoal: parsed.fatGoal ?? 45, entries };
    } catch { storageReadable = false; message('Saved data could not be read. Saving is paused to protect it. Your existing data has not been replaced.', true); }
  }
  // Data first, decoration second: the journal is written before anything animates.
  function save(next) {
    if (!storageReadable) { M()?.clearMarks(); message('Saving is paused to protect unreadable saved data.', true); return false; }
    try { next = { ...next, schemaVersion: 5 }; localStorage.setItem(KEY, JSON.stringify(next)); }
    catch { M()?.clearMarks(); M()?.haptic('warn'); message('Could not save. Storage may be full or unavailable. Your entry has not been changed.', true); return false; }
    state = next; render(); M()?.flush();
    return true;
  }
  function totals(entries) { return entries.reduce((sum, e) => ({ kcal: sum.kcal + e.kcal, protein: sum.protein + e.protein, carbs: sum.carbs + (e.carbs || 0), fat: sum.fat + (e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); }

  /* ---- reversible changes ---- */
  // Which containers existed before a change, so its Undo can drop the ones it created: the exact journal comes back.
  const shape = (s, key) => ({ quests: s.questsV5 !== undefined, day: s.questsV5?.[key] !== undefined });
  // Some fields of one day; undefined removes a field. Every other field and day is kept as it is.
  function patchDay(s, key, patch, was) {
    const day = { ...s.questsV5?.[key] };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete day[k]; else day[k] = v;
    const quests = { ...s.questsV5, [key]: day };
    if (was && !was.day && !Object.keys(day).length) delete quests[key];
    const next = { ...s, questsV5: quests };
    if (was && !was.quests && !Object.keys(quests).length) delete next.questsV5;
    return next;
  }
  // Entries go back exactly where they were.
  function restoreAt(entries, saved) { const out = entries.slice(); saved.slice().sort((a, b) => a.i - b.i).forEach(({ e, i }) => out.splice(Math.min(i, out.length), 0, e)); return out; }
  function assign(s, fields) { const next = { ...s }; for (const [k, v] of Object.entries(fields)) if (v === undefined) delete next[k]; else next[k] = v; return next; }
  // One reversible change. forward and backward map the journal at that moment to the next one and touch only their own
  // fields, so a later unrelated edit (another tab included) survives an Undo. Undo offers Redo, Redo offers Undo.
  // XP, levels, streaks and badges are worked out from the journal, so going back and forth never counts anything twice.
  function change(c) {
    if (!save(c.forward(state))) return false;
    const day = c.day && c.day !== dayKey() ? ' · ' + CHADUX.dayLabel(c.day) : '', kind = c.kind || 'on';
    if (c.haptic !== false) M()?.haptic(kind === 'off' ? 'off' : 'on');
    c.onApply?.(); c.after?.();
    const done = () => CHADUX.toast(c.label + day, undo, { kind, xp: c.positive ? xpGain : 0 });
    const undo = () => { if (!save(c.backward(state))) return; c.after?.(); M()?.haptic('off'); CHADUX.toast('Undone' + day, redo, { kind: 'off', action: 'Redo' }); };
    const redo = () => { if (!save(c.forward(state))) return; c.after?.(); M()?.haptic(kind === 'off' ? 'off' : 'on'); done(); };
    done();
    return true;
  }
  function logEntries(list, label) {
    const ids = new Set(list.map(e => e.id));
    return change({ label, positive: true, day: list[0].day, haptic: false,
      forward: s => ({ ...s, entries: [...s.entries.filter(e => !ids.has(e.id)), ...list] }),
      backward: s => ({ ...s, entries: s.entries.filter(e => !ids.has(e.id)) }) });
  }
  function add(name, kcal, protein, extras = {}) {
    const entry = { id: newId(), day: selectedKey(), name: String(name || '').trim().slice(0, 80), kcal, protein, carbs: 0, fat: 0, meal: defaultMeal(), ...extras };
    M()?.mark(`#entries [data-entry="${entry.id}"]`, 'just-on');
    if (!logEntries([entry], `${entry.name || 'Entry'} · ${whole(kcal)} kcal`)) return false;
    popXP();
    return true;
  }
  // Deleting is never final: Undo puts the entry back in its place, and a plan meal back in its slot.
  function removeEntry(e) {
    const index = state.entries.findIndex(x => x.id === e.id);
    if (index < 0) return false;
    const tier = e.planSlot ? state.questsV5?.[e.day]?.picks?.[e.planSlot] : undefined, was = shape(state, e.day);
    return change({ label: `${e.name || 'Entry'} deleted`, kind: 'off', day: e.day,
      forward: s => {
        const out = { ...s, entries: s.entries.filter(x => x.id !== e.id) };
        if (!tier) return out;
        const picks = { ...s.questsV5?.[e.day]?.picks }; delete picks[e.planSlot];
        return patchDay(out, e.day, { picks });
      },
      backward: s => {
        const out = { ...s, entries: restoreAt(s.entries.filter(x => x.id !== e.id), [{ e, i: index }]) };
        if (!tier || s.questsV5?.[e.day]?.picks?.[e.planSlot]) return out;
        return patchDay(out, e.day, { picks: { ...s.questsV5?.[e.day]?.picks, [e.planSlot]: tier } }, was);
      } });
  }
  let scanner = null, scannerSession = 0;

  function render() {
    const focused = document.activeElement, view = focused?.closest?.('.view')?.id; let restore = [];
    if (focused?.dataset?.slot) restore = [`[data-slot="${focused.dataset.slot}"][data-tier="${focused.dataset.tier}"]`, `[data-meal-row="${focused.dataset.slot}"]`];
    else if (focused?.dataset?.mealRow) restore = [`[data-meal-row="${focused.dataset.mealRow}"]`, `#next-up [data-slot="${focused.dataset.mealRow}"]`];
    else if (focused?.dataset?.row) restore = [`[data-row="${focused.dataset.row}"]`, `[data-fold="${focused.dataset.row}"]`];
    else if (focused?.dataset?.fold) restore = [`[data-fold="${focused.dataset.fold}"]`, `[data-row="${focused.dataset.fold}"]`];
    else if (focused?.dataset?.gymStart) restore = ['[data-gym-start]'];
    else if (focused?.classList?.contains('water-row')) restore = ['.water-row'];
    else if (focused?.classList?.contains('water-minus')) restore = ['.water-minus:not(:disabled)', '.water-row'];
    else if (focused?.dataset?.quest && view) restore = [`#${view} [data-quest="${focused.dataset.quest}"]`];
    else if (focused?.dataset?.exercise) restore = [`.training-level [data-exercise="${focused.dataset.exercise}"]`];
    else if (focused?.dataset?.addon) restore = [`.addons [data-addon="${focused.dataset.addon}"]`];
    currentDay = selectedKey(); observedToday = dayKey(); currentMealSlot = window.CHADUX?.currentSlot();
    turned = shownDay !== null && shownDay !== currentDay; shownDay = currentDay;
    const goals = CHADQuest.goals(state, currentDay), entries = state.entries.filter(e => e.day === currentDay), t = totals(entries);
    const target = goals.target ?? state.target, proteinGoal = goals.proteinGoal ?? state.proteinGoal, carbsGoal = goals.carbsGoal ?? state.carbsGoal ?? 150, fatGoal = goals.fatGoal ?? state.fatGoal ?? 45, over = t.kcal > target;
    // Big numbers are whole; the exact values stay in the labels, the journal and the detail sheets.
    num('remaining', Math.abs(target - t.kcal)); $('remaining-label').textContent = over ? 'over' : 'left'; $('remaining-hint').classList.toggle('is-over', over);
    num('consumed', t.kcal, 0); num('protein-total', t.protein, 0); num('carbs-total', t.carbs, 0); num('fat-total', t.fat, 0);
    $('target-label').textContent = whole(target); $('protein-goal-label').textContent = whole(proteinGoal); $('carbs-goal-label').textContent = whole(carbsGoal); $('fat-goal-label').textContent = whole(fatGoal);
    for (const [id, value, goal, unit] of [['calorie-ring', t.kcal, target, 'calories'], ['protein-ring', t.protein, proteinGoal, 'grams protein']]) { $(id).style.setProperty('--p', Math.min(100, value / goal * 100)); $(id).setAttribute('aria-label', `${fmt(value)} of ${fmt(goal)} ${unit}`); }
    for (const [id, value, goal, unit] of [['carbs', t.carbs, carbsGoal, 'grams carbs'], ['fat', t.fat, fatGoal, 'grams fat']]) { $(id + '-bar').style.setProperty('--p', Math.min(1, value / goal)); $(id + '-meter').setAttribute('aria-label', `${fmt(value)} of ${fmt(goal)} ${unit}`); }
    // Plan meals live in their slots and add-ons in their pills; everything else logged today is listed here (a plan
    // meal from a slot that no longer exists, such as a pre-v10 Dessert, included).
    const picks = state.questsV5?.[currentDay]?.picks || {}, pills = CHADQuest.shownAddons?.(state, currentDay) || new Set(), slots = new Set((window.CHADPlan || []).map(x => x.id));
    const extras = entries.filter(e => !(e.planSlot && picks[e.planSlot] && slots.has(e.planSlot)) && !pills.has(e.id));
    $('extras').hidden = !extras.length; $('entry-count').textContent = extras.length ? `${extras.length} ${extras.length === 1 ? 'entry' : 'entries'}` : '';
    renderEntries($('entries'), extras, '');
    renderPast(); renderRecent();
    const game = CHADQuest.rewards(state, dayKey(), RECGame.derive(state, dayKey()));
    renderGame(game);
    CHADQuest.render(state, { save, change, showView, popXP, message, celebrate, refresh: render, patchDay, restoreAt, assign, shape, key: currentDay, game, xpGain: () => xpGain });
    window.CHADUX?.render(state);
    for (const selector of restore) { const target = document.querySelector(selector); if (target) { target.focus({ preventScroll: true }); break; } }
  }
  // One row per entry: what it is, when, kcal and P/C/F. A tap opens it, with Log again and Delete.
  function renderEntries(container, entries, empty) {
    container.replaceChildren();
    if (!entries.length) { if (empty) { const li = node('li', 'empty ch-empty'); li.append(node('strong', '', empty)); container.append(li); } return; }
    entries.slice().reverse().forEach(e => {
      const row = node('li', 'entry'), open = node('button', 'entry-open'), info = node('span', 'entry-info'), meta = node('small');
      const when = e.day === currentDay ? e.meal || 'Meal' : new Date(e.day + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', day: 'numeric', month: 'short' });
      row.dataset.entry = e.id; open.type = 'button';
      meta.append(`${when} · ${whole(e.kcal)} kcal · `, CHADUX.pcf(e.protein, e.carbs || 0, e.fat || 0));
      info.append(node('strong', '', e.name || 'Quick entry'), meta);
      open.append(info); open.insertAdjacentHTML('beforeend', glyph('chevron', 15));
      open.setAttribute('aria-label', `${e.name || 'Entry'}, ${when}, ${fmt(e.kcal)} kcal, protein ${fmt(e.protein)} g, carbs ${fmt(e.carbs || 0)} g, fat ${fmt(e.fat || 0)} g. Options`);
      open.onclick = () => entrySheet(e);
      row.append(open); container.append(row);
    });
  }
  const SOURCES = { plan: 'Meal plan', addon: 'Add-on', repeat: 'Logged again', manual: 'Quick add', search: 'Food search', barcode: 'Barcode', photo: 'Photo estimate', text: 'Snap + Say' };
  function entrySheet(e) {
    const when = new Date(e.day + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
    const meta = node('p', 'ch-hint', [when, e.meal, SOURCES[e.source], e.portion].filter(Boolean).join(' · '));
    const again = node('button', 'ch-btn ch-btn--block', 'Log again'), del = node('button', 'ch-btn ch-btn--block ch-btn--danger', 'Delete');
    again.type = del.type = 'button';
    again.onclick = () => { CHADUX.closeSheets(); add(e.name, e.kcal, e.protein, { carbs: e.carbs || 0, fat: e.fat || 0, portion: e.portion || '', source: 'repeat' }); };
    del.onclick = () => { CHADUX.closeSheets(); removeEntry(e); };
    CHADUX.detail(e.name || 'Entry', [CHADUX.macroTiles([e.kcal, e.protein, e.carbs || 0, e.fat || 0]), meta, again, del]);
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
  // Two taps to repeat something eaten before: the last few foods that are not plan cards.
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
    if (celebratedLevel === null) { celebratedLevel = g.level; g.badges.forEach(b => { if (b.unlocked) celebratedBadges.add(b.id); }); }
    else {
      const fresh = g.badges.filter(b => b.unlocked && !celebratedBadges.has(b.id));
      fresh.forEach(b => celebratedBadges.add(b.id));
      if (g.level > celebratedLevel) { celebratedLevel = g.level; $('new-level').textContent = `Level ${g.level + 1} · ${g.name}`; celebrate($('new-level').textContent); M()?.haptic('success'); M()?.confetti($('today-scan')); }
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
    if (id === 'settings') { fillGoals(); aiStatus(); }
    window.scrollTo(0, 0);
    if (before && before !== id) { M()?.haptic('tap'); M()?.enter($(id)); }
  }
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => showView(b.dataset.view));
  $('today-scan').onclick = () => window.CHADUX.openAdd();
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
  // Goals and Day 1 are reversible too: the toast puts the previous values back, Redo applies them again.
  $('settings-form').onsubmit = e => {
    e.preventDefault();
    const journeyStartDate = $('journey-start-date').value, mode = $('phase').value;
    if (!CHADUX.validDate(journeyStartDate)) return message('Choose a valid journey start date.', true);
    const v = goalIds.map(id => Number($(id).value));
    if (!valid(v[0], 1, 50000) || !v.slice(1).every(n => valid(n, 1, 5000))) return message('Check your goal numbers.', true);
    const fields = { journeyStartDate, phaseMode: mode, target: v[0], proteinGoal: v[1], carbsGoal: v[2], fatGoal: v[3], customGoals: v, phaseMacros: ['cut', 'reset', 'bulk'].includes(mode) ? { ...state.phaseMacros, [mode]: v } : state.phaseMacros };
    const before = Object.fromEntries(Object.keys(fields).map(k => [k, state[k]]));
    if (Object.keys(fields).every(k => JSON.stringify(fields[k]) === JSON.stringify(before[k]))) return message('Settings saved.');
    change({ label: 'Settings saved', kind: 'save', forward: s => assign(s, fields), backward: s => assign(s, before), after: fillGoals });
  };

  /* ---- review + log: one editable card for photo, words, barcode and search results ---- */
  // Name, weight, kcal and P/C/F are all editable; one tap on Log it logs. The weight scales energy and macros from
  // per-gram rates taken from the original answer (no rounding drift). A number typed straight in overrides its rate, so
  // a later weight change scales from what you typed. The photo thumbnail is only ever in memory: never stored.
  const NUMS = ['kcal', 'protein', 'carbs', 'fat'], numField = k => $('result-' + k);
  const roundNum = (k, v) => k === 'kcal' ? Math.round(v) : Math.round(v * 10) / 10;
  const numText = (k, v) => String(roundNum(k, v));
  let card = null;
  function openResult(item, source, info = {}) {
    const ai = source === 'photo' || source === 'text', grams = item.grams || (item.basis === '100g' ? 100 : item.servingGrams) || null;
    card = { item, source, ai, rate: grams ? Object.fromEntries(NUMS.map(k => [k, (item[k] || 0) / grams])) : null };
    $('confirm-title').textContent = ai ? 'Your meal, decoded.' : 'Check and log';
    $('result-name').value = item.name || '';
    $('result-grams').value = grams ? String(Math.round(grams * 10) / 10) : '';
    NUMS.forEach(k => { numField(k).value = numText(k, item[k] || 0); });
    const sure = typeof info.confidence === 'number' ? Math.round(info.confidence * 100) : null, meta = $('confidence');
    meta.textContent = ai ? ['AI estimate', sure === null ? 'check the portions' : `${sure}% sure`].join(' · ') : ['Open Food Facts', item.brand, 'check the label'].filter(Boolean).join(' · ');
    meta.classList.toggle('is-low', ai && sure !== null && sure < 45);
    if (meta.classList.contains('is-low')) meta.textContent += ' · worth a check';
    $('result-hint').hidden = !grams;
    const shot = $('result-photo'); shot.hidden = !info.photo; if (info.photo) shot.src = info.photo; else shot.removeAttribute('src');
    // The breakdown stays folded, and is left out when it only repeats the meal.
    const parts = (info.parts || []).filter(p => p && p.name), noisy = !parts.length || (parts.length === 1 && (parts[0].kcal === item.kcal || parts[0].name.toLowerCase() === String(item.name).toLowerCase()));
    $('result-parts').hidden = noisy; $('result-parts').open = false;
    $('result-parts-title').textContent = noisy ? '' : `What’s in it · ${parts.length} item${parts.length === 1 ? '' : 's'}`;
    $('result-parts-list').replaceChildren(...(noisy ? [] : parts.slice(0, 12)).map(p => { const li = node('li'); li.append(node('span', '', p.name), node('small', '', [p.portion, `${whole(p.kcal)} kcal`].filter(Boolean).join(' · '))); return li; }));
    $('scan-meal').value = window.CHADUX.foodMeal() || defaultMeal();
    window.CHADUX.closeSheets(); window.CHADUX.showSheet($('confirm-sheet')); fitName();
  }
  // The name is a title: as tall as its text (up to three lines, smaller type when long), and Return means done.
  function fitName() {
    const name = $('result-name'); name.classList.toggle('is-long', name.value.length > 30);
    name.style.height = 'auto'; name.style.height = Math.min(name.scrollHeight + 8, parseFloat(getComputedStyle(name).maxHeight) || 94) + 'px';   // + the 8 px bottom border
  }
  $('result-name').addEventListener('input', fitName);
  $('result-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('result-name').blur(); } });
  $('result-grams').addEventListener('input', () => {
    if (!card) return;
    const g = Number($('result-grams').value);
    if (!$('result-grams').value || !valid(g, 1, 20000)) return;             // half typed or empty: the numbers wait
    if (!card.rate) { card.rate = Object.fromEntries(NUMS.map(k => [k, (Number(numField(k).value) || 0) / g])); $('result-hint').hidden = false; return; }   // first weight for an answer without one
    NUMS.forEach(k => { numField(k).value = numText(k, card.rate[k] * g); });
  });
  NUMS.forEach(k => numField(k).addEventListener('input', () => {
    const g = Number($('result-grams').value), v = Number(numField(k).value);
    if (card?.rate && valid(g, 1, 20000) && numField(k).value !== '' && valid(v, 0, 50000)) card.rate[k] = v / g;   // typed: overrides, and scales from here
  }));
  // What would be logged right now, or a field to fix.
  function cardEntry() {
    const n = Object.fromEntries(NUMS.map(k => [k, numField(k).value === '' && k !== 'kcal' ? 0 : Number(numField(k).value)]));
    if (numField('kcal').value === '' || !valid(n.kcal, 1, 50000)) return { fix: 'kcal', text: 'Energy needs a number from 1 to 50,000 kcal.' };
    for (const k of ['protein', 'carbs', 'fat']) if (!valid(n[k], 0, 5000)) return { fix: k, text: `${k[0].toUpperCase() + k.slice(1)} needs a number from 0 to 5,000 g.` };
    const raw = $('result-grams').value, g = Number(raw);
    if (raw !== '' && !valid(g, 1, 20000)) return { fix: 'grams', text: 'Weight needs a number from 1 to 20,000 g.' };
    const name = $('result-name').value.replace(/\s+/g, ' ').trim().slice(0, 80) || (card.ai ? 'AI estimate' : 'Food');
    return { name, kcal: roundNum('kcal', n.kcal), protein: roundNum('protein', n.protein), carbs: roundNum('carbs', n.carbs), fat: roundNum('fat', n.fat), portion: raw !== '' ? `${fmt(g)} g` : card.item.portion || (card.ai ? 'AI estimate' : '') };
  }
  $('cancel-scan').onclick = () => window.CHADUX.closeSheet($('confirm-sheet'));
  // The photo leaves with the sheet (the close event is queued, so a sheet opened again in the meantime keeps its own).
  $('confirm-sheet').addEventListener('close', () => { if (!$('confirm-sheet').open) $('result-photo').removeAttribute('src'); });
  $('copy-result').onclick = async () => {
    const e = card && cardEntry(); if (!e || e.fix) return message(e?.text || 'Nothing to copy.', true);
    try { await navigator.clipboard.writeText(`${e.name}${e.portion ? ' · ' + e.portion : ''} · ${fmt(e.kcal)} kcal · P ${fmt(e.protein)} g C ${fmt(e.carbs)} g F ${fmt(e.fat)} g`); message('Summary copied.'); }
    catch { message('Clipboard unavailable. Try from HTTPS.', true); }
  };
  $('scan-confirm-form').onsubmit = e => {
    e.preventDefault(); if (!card) return;
    const values = cardEntry();
    if (values.fix) { message(values.text, true); numField(values.fix).focus(); return; }
    const entry = { ...values, id: newId(), day: selectedKey(), meal: $('scan-meal').value, source: card.source };
    M()?.mark(`#entries [data-entry="${entry.id}"]`, 'just-on');
    if (!logEntries([entry], `${entry.name} · ${whole(entry.kcal)} kcal`)) return;
    card = null; window.CHADUX.closeSheets(); showView('today'); popXP();
  };

  /* ---- Snap + Say: your proxy (or your own key) estimates; with neither, say what it is and log it another way ---- */
  let photo = null, scan = null, aiRejected = false;           // scan: the estimate in flight, with its own cancel
  const aiRoute = () => { let store = null; try { store = localStorage; } catch { /* storage blocked: no AI route */ } return RECScan.settings(store); };
  // Every way an estimate can go wrong, in plain words, with the one fix that helps (if any). The three ways to log it
  // anyway (search, barcode, quick add) are always there underneath.
  const TROUBLE = {
    network: ['AI is offline', 'Describe it or use Quick add / barcode.', 'retry'],
    timeout: ['That took too long', 'Try again, or log it another way.', 'retry'],
    busy: ['The AI is busy', 'Try again in a moment, or log it another way.', 'retry'],
    failed: ['The AI couldn’t finish that one', 'Try again, or Quick add it.', 'retry'],
    http: ['The AI isn’t answering', 'Try again soon, or log it another way.', 'retry'],
    parse: ['That answer came back garbled', 'Try again, or log it another way.', 'retry'],
    limit: ['The AI needs a breather', 'Lots of scans lately. Try again in a few minutes, or log it another way.'],
    large: ['That photo is too big', 'Try another photo, or say what it is.'],
    empty: ['No food spotted', 'Try another photo, or say what it is.'],
    auth: ['AI needs setting up again', 'This device’s access wasn’t accepted. Paste a fresh setup link, or log it another way.', 'setup'],
    key: ['OpenAI didn’t accept your key', 'Check it in Settings › Advanced, or log it another way.', 'setup']
  };
  // The Estimate button above doubles as "Try again" when trying again can help, and steps aside when only a fresh
  // setup link can (the card's own button goes to it).
  function ways(title, text, fix) {
    $('snap-ways-title').textContent = title; $('snap-ways-text').textContent = text;
    $('snap-setup').hidden = fix !== 'setup';
    $('describe-button').textContent = fix === 'retry' ? 'Try again' : 'Estimate';
    if (aiRoute().mode !== 'none') $('describe-button').hidden = fix === 'setup';
    $('snap-ways').hidden = false;
  }
  function snapState() {
    const on = aiRoute().mode !== 'none';
    analysing(null);
    $('describe-button').hidden = !on; $('describe-button').textContent = 'Estimate';
    $('snap-hint').textContent = on ? 'Estimates can miss portions. Check before logging.' : 'AI estimates aren’t set up on this device. Settings › Advanced connects them.';
    if (on) $('snap-ways').hidden = true; else ways('Find it', 'Say what it is, then pick how to log it.');
  }
  function clearPhoto() { photo = null; $('photo-preview').hidden = true; $('photo-image').removeAttribute('src'); $('camera-label').textContent = 'Take or choose a photo'; }
  // The analysing card: the photo (or a sparkle for words) under a slow scan line, a bar that eases towards done over
  // about ten seconds, honest words as time passes, and Cancel. null puts the photo and words back on screen.
  function analysing(shot, words) {
    const on = shot !== null, panel = $('snap-analysing');
    $('camera-panel').classList.toggle('is-analysing', on); panel.hidden = !on;
    if (!on) return;
    $('analysing-image').hidden = !shot; if (shot) $('analysing-image').src = shot; else $('analysing-image').removeAttribute('src');
    panel.classList.toggle('has-photo', !!shot);
    $('analysing-title').textContent = 'Analysing…'; $('analysing-text').textContent = shot || !words ? 'About 10 s' : `“${words.length > 60 ? words.slice(0, 58) + '…' : words}” · about 10 s`;
    panel.style.setProperty('--p', '.04');
  }
  async function estimate() {
    if (scan) return;
    const hint = $('food-description').value.trim(), route = aiRoute();
    if (!photo && !hint) { $('scan-status').textContent = RECScan.MESSAGES.input; $('food-description').focus(); return; }
    if (route.mode === 'none') return snapState();
    const source = photo ? 'photo' : 'text', shot = photo?.thumbnail || '', run = scan = { controller: new AbortController(), timers: [] };
    const say = (title, text) => { if (scan === run) { $('analysing-title').textContent = title; $('analysing-text').textContent = text; } };
    $('snap-ways').hidden = true; $('scan-status').textContent = ''; $('food-description').blur(); $('describe-button').textContent = 'Estimate';
    analysing(shot, hint); M()?.haptic('tap');
    // The bar eases towards done: about 70% at ten seconds, never quite full until the answer is in.
    const started = Date.now(), tick = () => { if (scan === run) $('snap-analysing').style.setProperty('--p', (0.04 + 0.9 * (1 - Math.exp((started - Date.now()) / 7000))).toFixed(3)); };
    run.ticker = setInterval(tick, 400); tick();
    run.timers.push(setTimeout(() => say('Analysing…', 'Almost there'), 12000), setTimeout(() => say('Still analysing…', 'Bigger meals take a little longer'), 25000), setTimeout(() => say('Still analysing…', 'Taking longer than usual. Cancel any time.'), 60000));
    try {
      const r = await RECScan.estimate({ image: photo?.image || null, hint }, { ...route, signal: run.controller.signal, onStatus: s => s === 'busy' ? say('The AI is busy', 'Trying again in a moment…') : say('Analysing…', 'Second go') });
      if (aiRejected) { aiRejected = false; aiStatus(); }
      clearPhoto(); $('food-description').value = '';                               // photo and words leave with their estimate
      const review = () => openResult(r.meal, source, { parts: r.parts, confidence: r.confidence, photo: shot });
      // Closed the sheet while waiting? The estimate waits in a toast instead of popping up unasked.
      if ($('scan-sheet').open) { M()?.haptic('success'); review(); }
      else CHADUX.toast('Your estimate is ready', review, { action: 'Review', icon: 'sparkles', life: 12000 });
    } catch (error) {
      if (error.kind === 'cancelled') return;                                         // back to the photo and the words, nothing lost
      if (error.kind === 'auth') { aiRejected = true; aiStatus(); }
      // Never a dead end: whatever went wrong, the food can still be logged from here.
      const [title, text, fix] = TROUBLE[error.kind] || [error.message, 'Say what it is above, then pick how to log it.'];
      if ($('scan-sheet').open) { ways(title, text, fix); M()?.haptic('warn'); }
      else message(`${title}. ${text}`, true);
    } finally {
      run.timers.forEach(clearTimeout); clearInterval(run.ticker);
      if (scan === run) { scan = null; analysing(null); }
    }
  }
  // Settings › Advanced, opened at the setup link field (or the own-key field), for a fresh link.
  function goSetup() {
    const key = aiRoute().mode === 'key';
    showView('settings'); $('advanced-settings').open = true; if (key) $('ai-more').open = true;
    $('advanced-settings').scrollIntoView({ block: 'start' }); $(key ? 'ai-key' : 'ai-link').focus({ preventScroll: true });
  }
  $('camera-button').onclick = () => $('photo-input').click();
  $('analysing-cancel').onclick = () => { if (!scan) return; scan.controller.abort(); M()?.haptic('off'); };
  $('snap-setup').onclick = goSetup;
  $('photo-clear').onclick = () => { clearPhoto(); if (aiRoute().mode === 'none') snapState(); };
  $('photo-input').onchange = async () => {
    const file = $('photo-input').files[0]; $('photo-input').value = '';
    if (!file || scan) return;
    try { photo = await RECScan.compress(file); }
    catch (error) { clearPhoto(); ways('That photo didn’t open', `${error.message}`); return; }
    $('photo-image').src = photo.thumbnail; $('photo-preview').hidden = false; $('camera-label').textContent = 'Use another photo';
    if (aiRoute().mode !== 'none') { estimate(); return; }
    ways('Got it. What is it?', 'Say what it is above, then pick how to log it.'); $('food-description').focus({ preventScroll: true });
  };
  $('describe-button').onclick = () => estimate();
  document.querySelectorAll('[data-snap]').forEach(b => b.onclick = () => {
    const kind = b.dataset.snap, words = $('food-description').value.trim();
    $('food-description').value = '';                                               // the words go along; they never linger for the next meal
    window.CHADUX.openFood(kind, window.CHADUX.foodMeal());
    if (kind === 'search' && words.length >= 2) { $('food-search').value = words.slice(0, 100); runSearch(words); }
    if (kind === 'manual' && words) $('food-name').value = words.slice(0, 80);
  });

  /* ---- Settings › Advanced: AI status (Test, Disconnect), the setup link, and other ways to connect (a proxy of your
     own, a token, the hidden own-key fallback). Device only: never in the journal, never in a backup, and a token is
     never shown again once saved. ---- */
  const local = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch { return false; } }
  };
  let checkRun = 0, aiCheck = '';                                // '', 'checking', 'ok', 'offline', 'rejected'
  function aiStatus(next) {
    if (next !== undefined) aiCheck = next;
    const r = aiRoute(), where = r.custom ? new URL(r.proxy).host : 'your CHAD proxy';
    const state = r.mode !== 'proxy' ? r.mode : aiCheck === 'checking' ? 'checking' : aiRejected ? 'rejected' : aiCheck || 'set';
    const [title, text, dot, short] = {
      none: ['Not set up', 'Paste the setup link from your CHAD proxy to turn on photo estimates.', '', 'Not set up'],
      key: ['Own OpenAI key', 'Photo estimates go straight to OpenAI with your key.', 'set', 'Own key'],
      set: ['Set up', `Photo estimates go through ${where}.`, 'set', 'On'],
      checking: ['Checking…', `Looking for ${where}.`, 'checking', 'Checking…'],
      ok: ['Connected', `Photo estimates go through ${where}.`, 'ok', 'Connected'],
      offline: ['Offline', r.custom ? 'Couldn’t reach your proxy. Check the address, and that it allows this site.' : 'Couldn’t reach the CHAD proxy. Is the PC on? Quick add and barcode still work.', 'bad', 'Offline'],
      rejected: ['Set up again', 'The proxy didn’t accept this device’s token. Paste a fresh setup link.', 'bad', 'Set up again']
    }[state];
    $('ai-status-title').textContent = title; $('ai-status-text').textContent = text; $('ai-status').dataset.state = dot || 'off';
    $('ai-mode').textContent = short; $('ai-dot').className = 'ch-dot' + (dot ? ' is-' + dot : '');
    $('ai-test').hidden = r.mode !== 'proxy'; $('ai-disconnect').hidden = r.mode === 'none';
    if (document.activeElement !== $('ai-proxy')) $('ai-proxy').value = r.saved;
    if (document.activeElement !== $('ai-token')) $('ai-token').value = '';              // never shown again, and never wiped while being typed
    $('ai-token').placeholder = r.token ? 'Saved on this device' : 'Not set';
    if (document.activeElement !== $('ai-key')) $('ai-key').value = r.key;
  }
  // Reachable (GET /health), and is the token accepted (an empty POST the proxy turns away before any AI runs)?
  async function checkHealth() {
    const r = aiRoute(), run = ++checkRun;
    if (r.mode !== 'proxy') { aiStatus(''); return ''; }
    aiStatus('checking');
    const result = await RECScan.check(r.proxy, r.token);
    if (run !== checkRun) return result;
    if (result === 'rejected') aiRejected = true; else if (result === 'ok') aiRejected = false;
    aiStatus(result);
    return result;
  }
  // Several device keys as one reversible change. Resolves with the check that follows it.
  function deviceChange(label, next) {
    const before = Object.fromEntries(Object.keys(next).map(k => [k, local.get(k)]));
    const apply = values => { aiRejected = false; return Object.entries(values).every(([k, v]) => local.set(k, v)); };
    if (!apply(next)) { apply(before); message('Could not save on this device.', true); aiStatus(); return null; }
    M()?.haptic('on');
    const checked = checkHealth();
    const announce = () => CHADUX.toast(label, undo, { kind: 'save' });
    const undo = () => { if (!apply(before)) return; checkHealth(); M()?.haptic('off'); CHADUX.toast('Undone', redo, { kind: 'off', action: 'Redo' }); };
    const redo = () => { if (!apply(next)) return; checkHealth(); announce(); };
    announce();
    return checked;
  }
  // A setup link (…/#ai=<proxy URL>&k=<token>). One for the built-in CHAD proxy connects at once; one opened from
  // outside the app that points somewhere else asks first, so a stranger's link can't send your photos elsewhere.
  function connectLink(link, from) {
    let url;
    try { url = RECScan.checkProxy(link.url); } catch (error) { message(error.message, true); return null; }
    const builtIn = RECScan.isDefault(url);
    if (builtIn && !link.token) { message('That setup link has no access token. Copy the whole link.', true); return null; }
    if (from === 'hash' && !builtIn) { offerSetup(url, link.token); return null; }
    const checked = deviceChange('AI connected', { [RECScan.PROXY_KEY]: url, [RECScan.TOKEN_KEY]: link.token });
    checked?.then(result => { if (result === 'rejected') message('The proxy didn’t take that link’s token. Ask for a fresh setup link.', true); });
    return checked;
  }
  // Pasted or typed: the field is emptied straight away, because the link carries the token.
  function takePasted() {
    const raw = $('ai-link').value.trim(); if (!raw) return;
    $('ai-link').value = '';
    const link = RECScan.setupLink(raw);
    if (!link) { message(RECScan.MESSAGES.link, true); return; }
    if (connectLink(link, 'paste')) $('ai-link').blur();
  }
  $('ai-link').addEventListener('input', e => { if (/^insertFrom|^insertReplacementText/.test(e.inputType || '')) takePasted(); });
  $('ai-link').addEventListener('change', takePasted);
  $('ai-link').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); takePasted(); } });
  $('ai-proxy').onchange = () => {
    const raw = $('ai-proxy').value.trim(), link = /(^|[#?&])(ai|k)=/.test(raw) ? RECScan.setupLink(raw) : null;
    if (link) { $('ai-proxy').value = ''; connectLink(link, 'paste'); return; }
    let url = '';
    try { url = raw ? RECScan.checkProxy(raw) : ''; } catch (error) { message(error.message, true); aiStatus(); return; }
    if (url === local.get(RECScan.PROXY_KEY)) return aiStatus();
    deviceChange(url ? 'AI proxy saved' : 'AI proxy removed', url ? { [RECScan.PROXY_KEY]: url } : { [RECScan.PROXY_KEY]: '', [RECScan.TOKEN_KEY]: '' });
  };
  $('ai-token').onchange = () => { const token = $('ai-token').value.trim(); $('ai-token').value = ''; if (token && token !== local.get(RECScan.TOKEN_KEY)) deviceChange('Access token saved', { [RECScan.TOKEN_KEY]: token }); };
  $('ai-key').onchange = () => { const key = $('ai-key').value.trim(); if (key !== local.get(RECScan.KEY_KEY)) deviceChange(key ? 'Key saved on this device' : 'Key removed', { [RECScan.KEY_KEY]: key }); };
  $('ai-disconnect').onclick = () => {
    const mode = aiRoute().mode;
    if (mode === 'proxy') deviceChange('AI disconnected', { [RECScan.PROXY_KEY]: '', [RECScan.TOKEN_KEY]: '' });
    else if (mode === 'key') deviceChange('Key removed', { [RECScan.KEY_KEY]: '' });
  };
  $('ai-test').onclick = async () => {
    $('ai-test').disabled = true;
    const result = await checkHealth();
    $('ai-test').disabled = false; M()?.haptic(result === 'ok' ? 'success' : 'warn');
  };
  $('advanced-settings').addEventListener('toggle', () => { if ($('advanced-settings').open) checkHealth(); });
  function offerSetup(url, token) {
    const connect = node('button', 'ch-btn ch-btn--block ch-btn--gold', 'Connect'), later = node('button', 'ch-link ch-link--center', 'Not now');
    connect.type = later.type = 'button';
    connect.onclick = () => { window.CHADUX.closeSheets(); deviceChange('AI connected', { [RECScan.PROXY_KEY]: url, [RECScan.TOKEN_KEY]: token }); };
    later.onclick = () => window.CHADUX.closeSheets();
    window.CHADUX.detail('Connect photo estimates?', [node('p', 'ch-setup', `Snap + Say will send your photos and notes to ${new URL(url).host}${token ? ' with this device’s access token' : ''}. You can disconnect in Settings › Advanced.`), connect, later]);
  }

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
        const b = node('button', 'food-result'), kcal = node('b', '', whole(item.kcal)), sub = node('small'); b.type = 'button'; b.style.animationDelay = `${Math.min(i, 8) * 25}ms`; kcal.append(node('small', '', 'kcal'));
        const label = [item.brand, item.portion].filter(Boolean).join(' · '); sub.append(label ? label + ' · ' : '', CHADUX.pcf(item.protein, item.carbs, item.fat));
        b.append(node('strong', '', item.name), sub, kcal);
        b.onclick = () => openResult(item, item.source); return b;
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
    try { const item = await CHADFood.lookup(code); $('food-results').replaceChildren(); $('scan-status').textContent = ''; openResult(item, 'barcode'); }
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

  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { state = defaults(); previousGame = null; read(); render(); fillGoals(); } if ([RECScan.PROXY_KEY, RECScan.TOKEN_KEY, RECScan.KEY_KEY, null].includes(e.key)) aiStatus(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopScanner(); else render(); });
  setInterval(() => { if (!document.hidden && !document.querySelector('dialog[open]') && (dayKey() !== observedToday || window.CHADUX?.currentSlot() !== currentMealSlot)) render(); }, 60000);
  function fillGoals() { $('journey-start-date').value = CHADUX.validDate(state.journeyStartDate) ? state.journeyStartDate : CHADUX.defaultJourneyStart; $('phase').value = state.phaseMode || 'auto'; const g = { ...state, ...CHADQuest.goals(state, dayKey()) }; [g.target, g.proteinGoal, g.carbsGoal, g.fatGoal].forEach((v, i) => $(goalIds[i]).value = v); }
  if (window.CHADUX) {
    window.CHADUX.save = save; window.CHADUX.change = change; window.CHADUX.popXP = popXP;
    window.CHADUX.onFoodOpen = kind => {
      $('food-state').hidden = true;
      if (kind === 'search') { if ($('food-search').value.trim().length < 2) foodIdle(); } else { $('food-results').replaceChildren(); $('scan-status').textContent = ''; }
      if (kind === 'camera' && !scan) { clearPhoto(); snapState(); }             // an estimate in flight keeps its card
    };
  }
  window.CHADUX?.setup({ stopScanner, render });
  read(); render(); fillGoals(); aiStatus(); if (storageReadable) save(state); $('meal').value = defaultMeal();
  window.CHADGym?.resume();                                        // a workout left open comes straight back
  // A setup link may open the app, or arrive in a tab that is already open. It is wiped from the address bar before
  // anything else happens, then saved: a quiet "AI connected" toast, with Undo.
  const takeLink = () => { const link = RECScan.setupLink(location.hash); if (!link) return; try { history.replaceState(null, '', location.pathname + location.search); } catch { /* the hash simply stays */ } connectLink(link, 'hash'); };
  takeLink(); addEventListener('hashchange', takeLink);

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
