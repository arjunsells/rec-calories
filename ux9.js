'use strict';
// CHAD v9 · navigation (swipe, a week strip that folds away, arrow keys), sheets, toasts with Undo and Redo, and the
// shared macro builders. The journal lives in app9.js; scoring and screens in quest9.js.
(() => {
  const $ = id => document.getElementById(id);
  const M = () => window.CHADMotion;
  const make = (tag, className, text) => { const n = document.createElement(tag); n.className = className || ''; if (text !== undefined) n.textContent = text; return n; };
  let selectedDay = null, stopScanner = () => {}, refresh = () => {}, undoTimer, leaveTimer, armTimer, shieldTimer, foodMeal = null, lastGrade = null, ringKey = null, weekOpen = false;
  const closedRings = new Set();                                  // a ring closing again after Undo/Redo is not a new moment
  const dateKey = () => selectedDay || CHADQuest.dayKey();
  const defaultJourneyStart = '2026-10-08';
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(key + 'T00:00:00Z')) && new Date(key + 'T00:00:00Z').toISOString().slice(0, 10) === key;
  // Subtract calendar dates, never device-local timestamps (Darwin has no DST).
  const journeyDay = (key, start = defaultJourneyStart) => Math.round((Date.parse(key + 'T00:00:00Z') - Date.parse((validDate(start) ? start : defaultJourneyStart) + 'T00:00:00Z')) / 86400000) + 1;
  const darwin = (key, options) => new Date(key + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', ...options });
  const activePage = () => document.querySelector('.view:not([hidden]) .ch-page');
  const tenth = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }), whole = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

  /* ---- macros, the same way everywhere: "P63 C51 F16" in a line, four tiles in a sheet ---- */
  function pcf(protein, carbs, fat, exact) {
    const box = make('span', 'ch-pcf'), f = n => exact ? tenth.format(n || 0) : whole.format(Math.round(n || 0));
    for (const [k, v] of [['p', protein], ['c', carbs], ['f', fat]]) { const part = make('span', 'ch-pcf__' + k); part.append(make('b', '', k.toUpperCase()), f(v)); box.append(part); }
    box.title = `Protein ${f(protein)} g · Carbs ${f(carbs)} g · Fat ${f(fat)} g`;
    return box;
  }
  function macroTiles(values) {
    const box = make('div', 'ch-macros');
    ['kcal', 'Protein', 'Carbs', 'Fat'].forEach((label, i) => {
      const item = make('div', 'ch-macros__item' + (i ? '' : ' ch-macros__item--kcal')), value = make('b', '', tenth.format(values[i] || 0));
      if (i) value.append(make('small', '', 'g'));
      item.append(value, make('span', '', label)); box.append(item);
    });
    return box;
  }

  /* ---- days ---- */
  function goTo(key, gesture) {
    const from = dateKey(), page = activePage();
    if (!validDate(key) || key === from) { if (page) { page.style.transform = ''; page.style.opacity = ''; } return; }
    selectedDay = key === CHADQuest.dayKey() ? null : key;
    closeSheets();
    M()?.haptic('tap');
    // The date changes first; the push between the two days is decoration on top.
    if (page && M()) M().pageTurn(page, key > from ? 1 : -1, refresh, gesture); else refresh();
  }
  const navigate = (offset, gesture) => goTo(CHADQuest.shift(dateKey(), offset), gesture);
  function currentSlot(date = new Date()) {
    const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Darwin', hour: 'numeric', hourCycle: 'h23' }).format(date));
    return hour < 14 ? 'L' : hour < 18 ? 'P' : hour < 21 ? 'D' : 'E';
  }
  // "Yesterday", "Tomorrow" or "Mon 23 Nov": names the day a change landed on when it is not today.
  function dayLabel(key) {
    const today = CHADQuest.dayKey();
    if (key === CHADQuest.shift(today, -1)) return 'Yesterday';
    if (key === CHADQuest.shift(today, 1)) return 'Tomorrow';
    return darwin(key, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  }
  // Seven persistent buttons, so the selection pill slides instead of being rebuilt.
  function weekStrip(strip, state, mode) {
    const key = dateKey(), today = CHADQuest.dayKey(), start = CHADQuest.monday(key);
    if (!strip.children.length) for (let i = 0; i < 7; i++) {
      const b = make('button', 'ch-week__day'); b.type = 'button';
      b.append(make('span', 'ch-week__dow', 'MTWTFSS'[i]), make('span', 'ch-week__ring'));
      b.onclick = () => goTo(b.dataset.day);
      strip.append(b);
    }
    [...strip.children].forEach((b, i) => {
      const k = CHADQuest.shift(start, i), d = CHADQuest.daily(state, k), plan = CHADQuest.training[CHADQuest.weekday(k)].ex;
      const done = plan.filter((_, x) => d.training || d.exercises?.[x]).length;
      const part = mode === 'training' ? done / plan.length : d.score / 17, gold = mode === 'training' ? !!d.training : d.grade === 'S';
      b.dataset.day = k;
      b.className = 'ch-week__day' + (k === key ? ' is-selected' : '') + (k === today ? ' is-now' : '') + (k > today ? ' is-future' : '') + (gold ? ' is-s' : '');
      b.lastChild.textContent = String(Number(k.slice(8)));
      b.lastChild.style.setProperty('--p', Math.max(0, Math.min(1, part)).toFixed(3));
      b.setAttribute('aria-label', darwin(k, { weekday: 'long', day: 'numeric', month: 'long' }) + (mode === 'training' ? `, ${done} of ${plan.length} exercises` : `, ${d.score} of 17 points`));
      if (k === key) b.setAttribute('aria-current', 'date'); else b.removeAttribute('aria-current');
    });
    strip.style.setProperty('--i', (CHADQuest.weekday(key) + 6) % 7);
    if (strip.dataset.start && strip.dataset.start !== start && !strip.hidden) M()?.pulse(strip, start > strip.dataset.start ? 'is-from-next' : 'is-from-prev', 500);
    strip.dataset.start = start;
  }
  // The week folds away: swipe changes the day, and one header button shows the strip when you want to jump.
  function setWeek(open) {
    weekOpen = !!open;
    for (const [strip, toggle] of [['week-strip', 'week-toggle'], ['training-week', 'training-week-toggle']]) {
      $(strip).hidden = !weekOpen; $(toggle).setAttribute('aria-expanded', String(weekOpen));
      if (weekOpen) M()?.pulse($(strip), 'is-opening', 500);
    }
  }

  /* ---- toast: one line, one action, within thumb reach ---- */
  function hideToast(instant) {
    const bar = $('undo-toast');
    clearTimeout(undoTimer); clearTimeout(leaveTimer); clearTimeout(armTimer);
    if (bar.hidden) return;
    if (instant || !M() || M().reduced()) { bar.hidden = true; bar.classList.remove('is-leaving'); return; }
    bar.classList.add('is-leaving');
    leaveTimer = setTimeout(() => { bar.hidden = true; bar.classList.remove('is-leaving'); }, 230);
  }
  function toast(text, action, options = {}) {
    clearTimeout(undoTimer); clearTimeout(leaveTimer); clearTimeout(armTimer);
    const bar = $('undo-toast'), off = options.kind === 'off', tick = make('span', 'ch-toast__icon' + (off ? ' is-undo' : ''));
    tick.innerHTML = CHADIcons.icon(off ? 'undo' : options.icon || 'check', 14, { weight: 3.2 });
    bar.classList.remove('is-leaving');
    bar.replaceChildren(tick, make('span', 'ch-toast__text', text));
    if (options.xp > 0) bar.append(make('span', 'ch-toast__xp', '+' + options.xp + ' XP'));
    if (action) {
      const b = make('button', 'ch-toast__action', options.action || 'Undo'); b.type = 'button';
      // Armed after a beat, so a double tap on Undo can never land on the Redo that takes its place.
      b.disabled = true; armTimer = setTimeout(() => { b.disabled = false; }, 350);
      b.onclick = () => { if (b.disabled) return; hideToast(true); action(); };
      bar.append(b);
    }
    const life = options.life || 6000;
    bar.style.setProperty('--life', life / 1000 + 's');
    bar.hidden = true; void bar.offsetWidth; bar.hidden = false;          // restart the entrance and the countdown
    undoTimer = setTimeout(hideToast, life);
  }

  /* ---- sheets ---- */
  function finishClose(d) {
    d.classList.remove('is-opening', 'is-closing', 'is-dragging'); d.style.transform = ''; d.style.removeProperty('--drag');
    if (d.open) d.close();
  }
  function closeSheet(d, animated = true) {
    if (!d || !d.open) return;
    if (!animated || !M() || M().reduced() || d.classList.contains('is-closing')) return finishClose(d);
    d.classList.remove('is-opening', 'is-dragging'); d.classList.add('is-closing');
    setTimeout(() => { if (d.classList.contains('is-closing')) finishClose(d); }, 340);   // animationend normally gets there first
  }
  // When an action closes a sheet, the page underneath ignores touches for a moment: the second tap of a double tap on
  // "Log" must not land on whatever sits under that button once the sheet is gone.
  function shield() { const app = document.querySelector('.ch-app'); if (!app) return; app.dataset.shield = ''; clearTimeout(shieldTimer); shieldTimer = setTimeout(() => delete app.dataset.shield, 400); }
  function closeSheets() { const open = document.querySelectorAll('dialog.ch-sheet[open]'); if (open.length) shield(); open.forEach(finishClose); stopScanner(); }
  function show(d) {
    d.classList.remove('is-closing', 'is-dragging'); d.classList.add('is-opening');      // the entrance plays once per opening
    d.showModal();
    const body = d.querySelector('.ch-sheet__body'); if (body) body.scrollTop = 0;
    clearTimeout(d.openingTimer); d.openingTimer = setTimeout(() => d.classList.remove('is-opening'), 700);
  }
  function openAdd() { closeSheets(); M()?.haptic('tap'); show($('add-sheet')); }
  function openFood(kind, meal = null) {
    foodMeal = meal;
    closeSheets();
    if (kind === 'manual') { show($('manual-sheet')); $('food-name').focus(); return; }
    const camera = kind === 'camera';
    $('scan').dataset.mode = kind;
    $('scan-title').textContent = camera ? 'Snap + Say' : kind === 'barcode' ? 'Scan a barcode' : 'Search foods';
    $('food-credit').hidden = camera;
    show($('scan-sheet'));
    window.CHADUX.onFoodOpen?.(kind);
    if (kind === 'search') $('food-search').focus();
  }
  function detail(title, nodes) { closeSheets(); $('detail-title').textContent = title; $('detail-content').replaceChildren(...nodes); show($('detail-sheet')); }

  const HELP = [
    ['Logging', ['The next meal sits at the top: tap an option to log it, tap it again to remove it, or tap another option to switch. Other meals wait in rows below; tap a row, the ⓘ button or long-press a card for ingredients, macros, tips and swaps, and log from there.', 'Tap the bottles to add 500 mL of water and − to take 500 mL off. Hydralyte, training, cardio, steps and sleep switch on and off with one tap. Every change shows Undo for six seconds, and Undo offers Redo.']],
    ['Days', ['Swipe left or right to change day, or use the arrow keys. The calendar button shows the week with each day’s ring: tap a day to jump. Today brings you back. Anything you log goes to the day on screen, and the Undo toast names that day when it is not today.']],
    ['Scoring & rewards', ['Meals: Strict 3, Medium 2, Free 1. Protein 210 g+ earns 2; water target earns 2; 10k steps earns 1. Max 17. S 15+, A 12+, B 9+, C ≤ 8. Grade B+ saves your streak. Weekly bonus +10 after a full Mon-Sun with at most 2 Free picks. XP, levels and badges are worked out from what is logged, so undoing and redoing never adds XP twice.', 'Weekly ranks: Rookie below 60; Grinder 60-84; Beast 85-104; Champion 105-119; AJ Mode 120+.']],
    ['Hydration', ['Hydration: 1 L by 10 am, 2 L by 1 pm, 3 L by 3:30 pm, 1 L at gym with Hydralyte, and 500 mL at dinner. Sunday target 3.5 L; Saturday 5 L; weekdays 4.5 L. Protein points start at 210 g; the ring uses your phase goal.']],
    ['Training', ['Training: stop 2 reps before failure. Add reps, then weight. Gym around 3:30 pm; cardio follows. Easy day if sleep is under 6 hours, joints hurt, or strength drops two sessions in a row. Deload halves sets, rounded up: 28 Dec-3 Jan, 8-14 Feb, 22-28 Mar, 3-9 May. Sauna or ice bath: Sunday only. Long-press any exercise for its notes.']],
    ['Photo estimates & food data', ['Snap + Say estimates a meal through your own AI proxy (Settings › Advanced) or, as a fallback, your own OpenAI key kept on this device. With neither, or when the estimator is unreachable, say what it is and log it from search, barcode or quick add. Estimates can miss portions; check before logging.', 'Food lookup uses Open Food Facts; check the package label. Recent search results are kept on this device so they still open on bad reception. Everything is metric: kg, g, L, mL. Reset and Bulk add-ons are estimates. Shake: 500 mL high-protein milk, 60 g oats and a banana.']]
  ];

  function setup(actions) {
    stopScanner = actions.stopScanner; refresh = actions.render;
    $('return-today').onclick = $('training-today').onclick = () => goTo(CHADQuest.dayKey());
    for (const id of ['week-toggle', 'training-week-toggle']) $(id).onclick = () => { M()?.haptic('tap'); setWeek(!weekOpen); };
    setWeek(false);
    for (const [view, page] of [['today', 'day-page'], ['training', 'training-page']]) M()?.pager($(view), { target: () => $(page), commit: (dir, gesture) => navigate(dir, gesture) });
    // Keyboards and mice: the arrow keys change the day on Today and Training.
    addEventListener('keydown', e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (document.querySelector('dialog[open]') || e.target.closest?.('input,textarea,select,[contenteditable],.ch-seg')) return;
      if (!['today', 'training'].includes(document.querySelector('.view:not([hidden])')?.id)) return;
      e.preventDefault(); navigate(e.key === 'ArrowLeft' ? -1 : 1);
    });
    // Big title -> compact bar. Two thresholds, so it can never flicker around one scroll position.
    let ticking = false, collapsed = false;
    const scrolled = () => {
      ticking = false;
      const next = collapsed ? scrollY > 4 : scrollY > 16;
      if (next === collapsed) return;
      collapsed = next; document.querySelectorAll('.ch-datebar').forEach(h => h.classList.toggle('is-scrolled', next));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; (window.requestAnimationFrame || setTimeout)(scrolled); } }, { passive: true });
    // A bottom sheet with a focused field lifts above the software keyboard (visual viewport), unless the page is zoomed.
    const vv = window.visualViewport;
    if (vv) {
      const lift = () => {
        const zoomed = Math.abs(vv.scale - 1) > 0.01, keyboard = zoomed ? 0 : Math.round(innerHeight - vv.height - vv.offsetTop), style = document.documentElement.style;
        style.setProperty('--ch-kb', (keyboard > 80 ? keyboard : 0) + 'px');
        if (zoomed || keyboard <= 80) style.removeProperty('--ch-vvh'); else style.setProperty('--ch-vvh', Math.round(vv.height) + 'px');
      };
      vv.addEventListener('resize', lift); vv.addEventListener('scroll', lift); lift();
    }
    window.CHADIcons?.mount(document);
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openFood(b.dataset.add));
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet($(b.dataset.close)));
    document.querySelectorAll('dialog.ch-sheet').forEach(d => {
      d.addEventListener('close', () => { d.classList.remove('is-opening', 'is-closing', 'is-dragging'); d.style.transform = ''; d.style.removeProperty('--drag'); stopScanner(); });
      d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(d); });                       // Escape leaves the same way as a tap
      d.addEventListener('animationend', e => { if (e.target !== d) return; if (d.classList.contains('is-closing')) finishClose(d); else d.classList.remove('is-opening'); });
      d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSheet(d); } });
      M()?.sheet(d, closeSheet);
    });
    $('activity-rings').addEventListener('ch:ringclosed', e => {
      const fresh = e.detail.all.filter(i => !closedRings.has(dateKey() + ':' + i));
      if (!fresh.length) return;
      fresh.forEach(i => closedRings.add(dateKey() + ':' + i));
      M()?.haptic('success');
      if (fresh.includes(2)) M()?.confetti($('activity-rings'));                                    // 17 / 17
    });
    const help = $('help-settings');
    for (const [title, paragraphs] of HELP) { const d = make('details', 'ch-disclosure'); d.append(make('summary', '', title), ...paragraphs.map(text => make('p', '', text))); help.append(d); }
  }
  function tab(id) {
    const tabs = [...document.querySelectorAll('.ch-tabbar .tab')], index = tabs.findIndex(b => b.dataset.view === id);
    if (index >= 0) document.querySelector('.ch-tabbar').style.setProperty('--i', index);
  }
  function render(state) {
    const key = dateKey(), today = CHADQuest.dayKey(), d = CHADQuest.daily(state, key), ring = $('quest-ring'), isToday = key === today;
    const relative = isToday ? 'Today' : key === CHADQuest.shift(today, -1) ? 'Yesterday' : key === CHADQuest.shift(today, 1) ? 'Tomorrow' : '';
    // "Yesterday" and "Tomorrow" already say which day it is; the short form keeps the line inside a 375px header.
    const label = darwin(key, { ...(relative && !isToday ? {} : { weekday: 'short' }), day: 'numeric', month: 'short', ...(key.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) }).replace(/,/g, '');
    $('journey-day').innerHTML = 'Day <b>' + journeyDay(key, state.journeyStartDate) + '</b>';
    $('day-title').textContent = relative; $('date-label').textContent = label;
    $('training-day-title').textContent = relative; $('training-date-label').textContent = label;
    $('grade-label').textContent = relative || label;
    $('return-today').hidden = $('training-today').hidden = isToday;
    ring.style.setProperty('--p', d.score / 17 * 100); ring.setAttribute('aria-label', `${d.score} of 17 quest points, grade ${d.grade}`);
    const turned = ringKey !== null && ringKey !== key;                          // another day: show it as it is, no count, no sweep
    if (M()) M().count($('quest-total'), d.score, { from: 0, instant: turned }); else $('quest-total').textContent = d.score;
    const grade = $('quest-grade');
    grade.textContent = d.grade; grade.className = 'ch-grade ch-grade--sm ch-grade--' + d.grade.toLowerCase();
    if (lastGrade && lastGrade.key === key && lastGrade.grade !== d.grade) M()?.pulse(grade, 'just-on');
    lastGrade = { key, grade: d.grade };
    const goals = CHADQuest.goals(state, key);
    // A ring only "closes" through an action on the day in view, never by browsing to a finished day.
    CHADCharts.rings($('activity-rings'), [d.totals[0] / goals.target, d.totals[1] / goals.proteinGoal, d.score / 17], { celebrate: ringKey === key, ...(turned ? { animate: false } : {}), labels: [$('calorie-ring').getAttribute('aria-label'), $('protein-ring').getAttribute('aria-label'), ring.getAttribute('aria-label')] });
    ringKey = key;
    weekStrip($('week-strip'), state, 'score'); weekStrip($('training-week'), state, 'training');
  }
  window.CHADUX = { setup, render, tab, currentSlot, dateKey, navigate, goTo, dayLabel, setWeek, weekOpen: () => weekOpen, toast, hideToast, detail, closeSheets, closeSheet, showSheet: show, openAdd, openFood, journeyDay, validDate, defaultJourneyStart, foodMeal: () => foodMeal, pcf, macroTiles };
})();
