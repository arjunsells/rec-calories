'use strict';
// CHAD v11 · navigation (three tabs, Settings behind the gear, swipe and arrow keys between days), sheets (one at a
// time, never one on top of another), toasts with Undo and Redo, the shared macro builders, and Darwin time of day.
// The journal lives in app11.js; the screens in quest11.js.
(() => {
  const $ = id => document.getElementById(id);
  const M = () => window.CHADMotion;
  const make = (tag, className, text) => { const n = document.createElement(tag); n.className = className || ''; if (text !== undefined) n.textContent = text; return n; };
  let selectedDay = null, stopScanner = () => {}, refresh = () => {}, undoTimer, leaveTimer, armTimer, shieldTimer, foodMeal = null, foodCtx = null;
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
      const item = make('div', 'ch-macros__item ch-macros__item--' + ['kcal', 'p', 'c', 'f'][i]), value = make('b', '', tenth.format(values[i] || 0));
      if (i) value.append(make('small', '', 'g'));
      item.append(value, make('span', '', label)); box.append(item);
    });
    return box;
  }

  /* ---- days: swipe or the arrow keys; "Today" brings you back ---- */
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
  // Darwin time decides what Today puts first. v11: morning (before 11), midday (11 am-4 pm), the gym window
  // (4-6:30 pm) and the evening. The meal of the moment follows: lunch until the gym window, then dinner.
  const darwinTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Darwin', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const minutesNow = (date = new Date()) => { const parts = darwinTime.formatToParts(date), get = t => Number(parts.find(p => p.type === t)?.value || 0); return (get('hour') % 24) * 60 + get('minute'); };
  const hourNow = (date = new Date()) => Math.floor(minutesNow(date) / 60);
  function timeBlock(date = new Date()) { const m = minutesNow(date); return m < 11 * 60 ? 'morning' : m < 16 * 60 ? 'midday' : m < 18 * 60 + 30 ? 'gym' : 'evening'; }
  function currentSlot(date = new Date()) { return { morning: 'L', midday: 'L', gym: 'D', evening: 'D' }[timeBlock(date)]; }
  // "Yesterday", "Tomorrow" or "Mon 23 Nov": names the day a change landed on when it is not today.
  function dayLabel(key) {
    const today = CHADQuest.dayKey();
    if (key === CHADQuest.shift(today, -1)) return 'Yesterday';
    if (key === CHADQuest.shift(today, 1)) return 'Tomorrow';
    return darwin(key, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
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
    if (action) {
      const b = make('button', 'ch-toast__action', options.action || 'Undo'); b.type = 'button';
      // Armed after a beat, so a double tap on Undo can never land on the Redo that takes its place.
      b.disabled = true; armTimer = setTimeout(() => { b.disabled = false; }, 350);
      // The toast changes width once tapped ("Undone · Redo"), so the second tap of a double tap could land on the page
      // under it: the page ignores touches for a moment, as after closing a sheet.
      b.onclick = () => { if (b.disabled) return; shield(); hideToast(true); action(); };
      bar.append(b);
    }
    const life = options.life || 6000;
    bar.style.setProperty('--life', life / 1000 + 's');
    bar.hidden = true; void bar.offsetWidth; bar.hidden = false;          // restart the entrance and the countdown
    undoTimer = setTimeout(hideToast, life);
  }

  /* ---- sheets: one at a time ---- */
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
    if (!d.open) d.showModal();
    const body = d.querySelector('.ch-sheet__body'); if (body) body.scrollTop = 0;
    clearTimeout(d.openingTimer); d.openingTimer = setTimeout(() => d.classList.remove('is-opening'), 700);
  }
  // The food sheet: Ask AI (a photo and/or words) or a barcode. ctx.add is set when the builder opened it: the answer
  // then goes back into the meal being built, and closing the sheet goes back to the builder (ctx.back).
  function openFood(kind, ctx = null, meal = null) {
    foodMeal = meal; foodCtx = ctx;
    closeSheets();
    const camera = kind !== 'barcode';
    $('scan').dataset.mode = camera ? 'camera' : 'barcode';
    $('scan-title').textContent = camera ? 'Ask AI' : 'Scan a barcode';
    show($('scan-sheet'));
    window.CHADUX.onFoodOpen?.(camera ? 'camera' : 'barcode');
  }
  function detail(title, nodes) { closeSheets(); $('detail-title').textContent = title; $('detail-content').replaceChildren(...nodes); show($('detail-sheet')); }

  const HELP = [
    ['Today', ['The top line is what is left today: kcal and protein. Tap it for carbs, fat and the food you logged.', 'Under it is the one thing to do now, on Darwin time: water in the morning, lunch until 4 pm, the gym 4–6:30 pm, then dinner. Scroll for Later today (water is one tap there), Custom, and Quick log.']],
    ['Logging and Undo', ['One tap logs a meal, a bottle of water or a favourite. Tap a logged meal again to remove it. Every change shows Undo for six seconds, and Undo offers Redo.', 'Custom and + Food open one sheet: recent foods first, then favourites, search, Ask AI (photo or words), barcode, or type it in.']],
    ['Gym', ['Start opens Gym mode: one exercise at a time, kg and reps filled in from last time, one tap logs a set and starts the rest timer. The screen stays awake, it works offline, and a closed app comes back to the same exercise.']],
    ['Days and streak', ['Swipe left or right to change day (or use the arrow keys); Today brings you back. The streak counts every day from Day 1. Only a day marked as missed (Settings › Selected day) restarts it.']]
  ];

  function setup(actions) {
    stopScanner = actions.stopScanner; refresh = actions.render;
    $('return-today').onclick = $('training-today').onclick = () => goTo(CHADQuest.dayKey());
    for (const [view, page] of [['today', 'day-page'], ['training', 'training-page']]) M()?.pager($(view), { target: () => $(page), commit: (dir, gesture) => navigate(dir, gesture) });
    // Keyboards and mice: the arrow keys change the day on Today and Gym.
    addEventListener('keydown', e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('is-gym') || e.target.closest?.('input,textarea,select,[contenteditable],.ch-seg')) return;
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
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet($(b.dataset.close)));
    document.querySelectorAll('dialog.ch-sheet').forEach(d => {
      d.addEventListener('close', () => { d.classList.remove('is-opening', 'is-closing', 'is-dragging'); d.style.transform = ''; d.style.removeProperty('--drag'); stopScanner(); });
      d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(d); });                       // Escape leaves the same way as a tap
      d.addEventListener('animationend', e => { if (e.target !== d) return; if (d.classList.contains('is-closing')) finishClose(d); else d.classList.remove('is-opening'); });
      d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSheet(d); } });
      M()?.sheet(d, closeSheet);
    });
    // Leaving the food sheet without an answer goes back to the meal being built (the close event is queued, so a sheet
    // opened in the meantime, such as the card with the answer, wins).
    $('scan-sheet').addEventListener('close', () => { const ctx = foodCtx; if (!ctx?.back || document.querySelector('dialog.ch-sheet[open]')) return; foodCtx = null; ctx.back(); });
    const help = $('help-settings');
    for (const [title, paragraphs] of HELP) { const d = make('details', 'ch-disclosure'); d.append(make('summary', '', title), ...paragraphs.map(text => make('p', '', text))); help.append(d); }
  }
  // Three tabs; Settings (behind the gear) is a view of its own with no tab lit.
  function tab(id) {
    const tabs = [...document.querySelectorAll('.ch-tabbar .tab')], index = tabs.findIndex(b => b.dataset.view === id), bar = document.querySelector('.ch-tabbar');
    if (!bar) return;
    bar.classList.toggle('is-none', index < 0);
    if (index >= 0) bar.style.setProperty('--i', index);
  }
  function render(state) {
    const key = dateKey(), today = CHADQuest.dayKey(), isToday = key === today;
    const relative = isToday ? 'Today' : key === CHADQuest.shift(today, -1) ? 'Yesterday' : key === CHADQuest.shift(today, 1) ? 'Tomorrow' : '';
    // "Yesterday" and "Tomorrow" already say which day it is; the short form keeps the line inside a 375px header.
    const label = darwin(key, { ...(relative && !isToday ? {} : { weekday: 'short' }), day: 'numeric', month: 'short', ...(key.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) }).replace(/,/g, '');
    $('journey-day').innerHTML = 'Day <b>' + journeyDay(key, state.journeyStartDate) + '</b>';
    $('day-title').textContent = relative; $('date-label').textContent = label;
    $('training-day-title').textContent = relative; $('training-date-label').textContent = label;
    $('return-today').hidden = $('training-today').hidden = isToday;
  }
  window.CHADUX = { setup, render, tab, currentSlot, timeBlock, minutesNow, hourNow, dateKey, navigate, goTo, dayLabel, toast, hideToast, detail, closeSheets, closeSheet, showSheet: show, shield, openFood, journeyDay, validDate, defaultJourneyStart, foodMeal: () => foodMeal, foodCtx: () => foodCtx, clearFoodCtx: () => { foodCtx = null; }, pcf, macroTiles };
})();
