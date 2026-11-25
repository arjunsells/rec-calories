'use strict';
// CHAD v12 · navigation (three tabs, Settings behind the gear, swipe and arrow keys between days), sheets (one at a
// time, never one on top of another), toasts with Undo and Redo, the shared macro builders, and Darwin time of day.
// The journal lives in app12.js; the screens in quest12.js.
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
  // Darwin time decides what Today puts first. v12: morning (before 11), midday (11 am-4 pm), the gym window
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
  let sheetEpoch = 0, lifecycleEpoch = 0;
  const userOpenedAt = new WeakMap();
  let openingEvent;
  // Keep the dispatch itself, not a sticky activation flag: timers and synthetic clicks get no grace.
  document.addEventListener('click', e => { if (e.isTrusted) openingEvent = e; }, true);
  const session = () => lifecycleEpoch;
  function focusSheet(field, delay = 50) {
    const epoch = session();
    setTimeout(() => {
      if (epoch === session() && !document.hidden && field?.isConnected && field.closest('dialog[open]')) field.focus({ preventScroll: true });
    }, delay);
  }
  function resetSheet(d) {
    clearTimeout(d.openingTimer); clearTimeout(d.closingTimer);
    d.getAnimations?.().forEach(a => a.cancel());
    d.classList.remove('is-opening', 'is-closing', 'is-dragging'); d.style.transform = ''; d.style.removeProperty('--drag');
  }
  function finishClose(d) {
    userOpenedAt.delete(d);
    resetSheet(d);
    if (d.open) d.close();
  }
  function closeSheet(d, animated = true) {
    if (!d || !d.open) return;
    if (!animated || !M() || M().reduced() || d.classList.contains('is-closing')) return finishClose(d);
    d.classList.remove('is-opening', 'is-dragging'); d.classList.add('is-closing');
    d.closingTimer = setTimeout(() => { if (d.classList.contains('is-closing')) finishClose(d); }, 340);
  }
  // When an action closes a sheet, the page underneath ignores touches for a moment: the second tap of a double tap on
  // "Log" must not land on whatever sits under that button once the sheet is gone.
  function shield() { const app = document.querySelector('.ch-app'); if (!app) return; app.dataset.shield = ''; clearTimeout(shieldTimer); shieldTimer = setTimeout(() => delete app.dataset.shield, 400); }
  function closeSheets() {
    const epoch = ++sheetEpoch;
    if (document.querySelector('dialog.ch-sheet[open]')) shield();
    document.querySelectorAll('dialog.ch-sheet').forEach(finishClose); stopScanner();
    // Native backdrops exist only while their dialog is open. A timeout also clears interrupted iOS animations;
    // a subsequent show invalidates this sweep, so it can never dismiss a newly opened sheet.
    setTimeout(() => { if (epoch === sheetEpoch) document.querySelectorAll('dialog.ch-sheet').forEach(finishClose); }, 360);
  }
  function show(d) {
    if (document.hidden) return;
    if (!d.open && openingEvent?.isTrusted && openingEvent.eventPhase !== Event.NONE) userOpenedAt.set(d, performance.now());
    ++sheetEpoch; resetSheet(d);
    d.classList.remove('is-closing', 'is-dragging'); d.classList.add('is-opening');      // the entrance plays once per opening
    if (!d.open) d.showModal();
    const body = d.querySelector('.ch-sheet__body'); if (body) body.scrollTop = 0;
    clearTimeout(d.openingTimer); d.openingTimer = setTimeout(() => d.classList.remove('is-opening'), 700);
  }
  // The food sheet: Ask AI (a photo and/or words) or a barcode. ctx.add is set when the builder opened it: the answer
  // then goes back into the meal being built, and closing the sheet goes back to the builder (ctx.back).
  function openFood(kind, ctx = null, meal = null) {
    if (kind !== 'barcode' && window.CHADScan12) return window.CHADScan12.open('food', ctx);
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
    ['Today', ['The big card is the calories left today, with protein, carbs and fat left under it. Tap it to see what you have eaten instead.', 'Water is one tap (+500 mL). Under it is the one thing to do now, on Darwin time: lunch until 4 pm, the gym 4–6:30 pm, then dinner. Recently eaten lists the day’s food: tap one to change it.']],
    ['Photos', ['The round + opens the camera. Take a photo: it is analysed in the background and lands in Recently eaten. Check it, change servings or ingredients, then Done. Barcode, Food label, Gallery, Search food, Saved and Describe it are on the same screen.', 'Photos stay on this device. If the AI is offline, search or describe the food instead; the photo waits for a retry.']],
    ['Logging and Undo', ['One tap logs a meal, a bottle of water or a favourite. Tap a logged meal again to remove it. Every change shows Undo for six seconds, and Undo offers Redo.', 'Custom and + Food open the add-food sheet: recent foods first, then favourites, search, Ask AI, barcode, or type it in.']],
    ['Gym', ['Start opens Gym mode: one exercise at a time, kg and reps filled in from last time, one tap logs a set and starts the rest timer. The screen stays awake, it works offline, and a closed app comes back to the same exercise.']],
    ['Days and streak', ['Tap a day in the week strip, or swipe left or right (or use the arrow keys); Today brings you back. The streak counts every day from Day 1. Only a day marked as missed (Settings › Selected day) restarts it.']]
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
    addEventListener('resize', () => tab(tabShown));
    document.fonts?.ready?.then(() => tab(tabShown));
    // A bottom sheet with a focused field lifts above the software keyboard (visual viewport), unless the page is zoomed.
    const vv = window.visualViewport;
    const lift = () => {
      const style = document.documentElement.style, field = document.activeElement;
      const editing = field?.matches('input:not([type=button]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]') && field.closest('dialog[open]');
      // Live geometry can lift a focused sheet, but never sizes it or pushes its top off screen.
      const valid = vv && Math.abs(vv.scale - 1) <= 0.01 && editing && vv.height >= Math.max(240, innerHeight * .35);
      const top = valid ? Math.max(0, Math.min(vv.offsetTop, innerHeight - vv.height)) : 0;
      const height = valid ? Math.min(innerHeight - top, vv.height) : innerHeight;
      const sheet = editing && field.closest('dialog[open]');
      const safeTop = sheet ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ch-sat')) || 0 : 0;
      const room = sheet ? Math.max(0, innerHeight - sheet.offsetHeight - safeTop - 16) : 0;
      style.setProperty('--ch-kb', (valid ? Math.min(room, Math.max(0, innerHeight - height - top)) : 0) + 'px');
      style.setProperty('--ch-vv-top', top + 'px');
      style.setProperty('--ch-vvh', Math.floor(height) + 'px');
    };
    vv?.addEventListener('resize', lift); vv?.addEventListener('scroll', lift);
    addEventListener('resize', lift); addEventListener('orientationchange', lift);
    document.addEventListener('focusin', lift); document.addEventListener('focusout', () => setTimeout(lift, 0));
    lift();
    // Home-screen Safari may freeze an entrance, exit or drag while backgrounded or restore it from bfcache.
    // A restored dialog has no fresh trusted open timestamp. Preserve only a fresh user tap
    // on a foreground lifecycle event; backgrounding still invalidates callbacks and closes sheets.
    const resetLifecycle = (event) => {
      const preserve = !document.hidden && event?.type !== 'pagehide';
      const recent = new Set([...document.querySelectorAll('dialog[open]')].filter(d => preserve && userOpenedAt.has(d) && performance.now() - userOpenedAt.get(d) < 2000));
      if (!recent.size) {
        ++lifecycleEpoch; ++sheetEpoch;
        foodCtx = null; window.CHADScan12?.suspend();
        document.activeElement?.blur?.();
        stopScanner();
      }
      document.querySelectorAll('dialog').forEach(d => { if (!recent.has(d)) finishClose(d); });
      clearTimeout(shieldTimer);
      document.querySelectorAll('[data-shield]').forEach(n => n.removeAttribute('data-shield'));
      lift();
    };
    resetLifecycle();
    document.addEventListener('DOMContentLoaded', resetLifecycle);
    document.addEventListener('visibilitychange', resetLifecycle);
    addEventListener('pagehide', resetLifecycle); addEventListener('pageshow', resetLifecycle);
    window.CHADIcons?.mount(document);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet($(b.dataset.close)));
    document.querySelectorAll('dialog.ch-sheet').forEach(d => {
      d.addEventListener('close', () => { if (!d.open) { resetSheet(d); stopScanner(); } });
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
  // Three tabs; Settings (behind the gear) is a view of its own with no tab lit. v12: the round + sits in the middle of
  // the bar, so the active pill is placed under the tab itself (measured), not at a third of the bar.
  let tabShown = 'today';
  function tab(id) {
    const tabs = [...document.querySelectorAll('.ch-tabbar .tab')], index = tabs.findIndex(b => b.dataset.view === id), bar = document.querySelector('.ch-tabbar');
    if (!bar) return;
    tabShown = id;
    bar.classList.toggle('is-none', index < 0);
    if (index < 0) return;
    bar.style.setProperty('--i', index);
    const b = tabs[index], w = Math.min(b.offsetWidth - 8, 92);
    if (b.offsetWidth) { bar.style.setProperty('--pill-x', Math.round(b.offsetLeft + (b.offsetWidth - w) / 2) + 'px'); bar.style.setProperty('--pill-w', Math.round(w) + 'px'); }
  }
  // The week strip on Today: Monday to Sunday around the day in view. A tap opens that day; logged days have a solid
  // ring, the others a dashed one; the day in view is filled.
  function week(state) {
    const box = $('week'); if (!box) return;
    const key = dateKey(), today = CHADQuest.dayKey(), start = CHADQuest.monday(key), logged = new Set(state.entries.map(e => e.day));
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const k = CHADQuest.shift(start, i), b = make('button', 'ch-week__day'), picked = k === key;
      b.type = 'button'; b.dataset.day = k;
      b.classList.toggle('is-logged', logged.has(k)); b.classList.toggle('is-today', k === today); b.classList.toggle('is-future', k > today);
      if (picked) b.setAttribute('aria-current', 'date');
      b.append(make('small', 'ch-week__dow', darwin(k, { weekday: 'narrow' })), make('b', 'ch-week__num', String(Number(k.slice(8)))));
      b.setAttribute('aria-label', darwin(k, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/,/g, '') + (k === today ? ', today' : '') + (logged.has(k) ? ', food logged' : ''));
      b.onclick = () => { if (k !== dateKey()) goTo(k); };
      rows.push(b);
    }
    box.replaceChildren(...rows);
  }
  // A sheet made after setup (v12's camera and nutrition sheets) gets the same handling as the others: Escape and a
  // tap outside close it with the animation, a pull on its grip or title closes it (drag: false skips that), and the
  // scanner stops with it.
  function wireSheet(d, options = {}) {
    if (!d || d.dataset.wired) return; d.dataset.wired = '';
    d.addEventListener('close', () => { if (!d.open) resetSheet(d); });
    d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(d); });
    d.addEventListener('animationend', e => { if (e.target !== d) return; if (d.classList.contains('is-closing')) finishClose(d); else d.classList.remove('is-opening'); });
    d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSheet(d); } });
    if (options.drag !== false) M()?.sheet(d, closeSheet);
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
    week(state);
    tab(tabShown);
  }
  window.CHADUX = { session, focusSheet, setup, render, tab, currentSlot, timeBlock, minutesNow, hourNow, dateKey, navigate, goTo, dayLabel, toast, hideToast, detail, closeSheets, closeSheet, showSheet: show, shield, openFood, wireSheet, journeyDay, validDate, defaultJourneyStart, foodMeal: () => foodMeal, foodCtx: () => foodCtx, clearFoodCtx: () => { foodCtx = null; }, pcf, macroTiles };
})();
