'use strict';
// CHAD v10 · Gym mode: the guided workout. One exercise at a time with big set dots; logging a set starts the rest
// timer (60-120 s by exercise, +15 s, Skip), which counts from timestamps so it keeps true time through a locked screen.
// kg and reps are pre-filled from last time, with the overload hint ("add reps first, then weight"). The screen stays
// awake (Wake Lock, taken again whenever the page comes back), it works offline, and it resumes after the app closes.
//
// The start, every set, removing a set and the finish are journal changes (Undo/Redo like everything else). What is on
// screen (which exercise, the rest timer, kg/reps being typed) is device state under "chad.gym".
(() => {
  const STORE = 'chad.gym', RESUME_HOURS = 6;
  const $ = id => document.getElementById(id);
  const M = () => window.CHADMotion, T = () => window.CHADTrain;
  const icon = (name, size, opts) => window.CHADIcons?.icon(name, size, opts) || '';
  let api = null, state = null, ui = null, root = null, loop = null, lock = null, locking = false, finished = null, advanceTimer = null, flashTimer = null, shownSig = '';
  const celebrated = new Set();
  const day = (s, key) => s?.questsV5?.[key] || {};
  const workout = key => day(state, key).workout;
  const loadUI = () => { try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); return v && typeof v.key === 'string' ? { kg: {}, reps: {}, ex: 0, rest: null, ...v } : null; } catch { return null; } };
  const saveUI = () => { try { if (ui) localStorage.setItem(STORE, JSON.stringify(ui)); else localStorage.removeItem(STORE); } catch { /* the screen state is a convenience */ } };
  const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0'); };
  const setText = (s, e) => e.kind === 'time' ? s.reps + ' s' : (s.kg > 0 ? T().kgText(s.kg) + ' kg × ' : '') + s.reps + (s.kg > 0 ? '' : ' reps');
  const withWorkout = (s, key, fn) => { const w = s.questsV5?.[key]?.workout; return w ? api.patchDay(s, key, { workout: fn({ ...w, sets: Array.isArray(w.sets) ? w.sets : [] }) }) : s; };

  /* ---- the screen ---- */
  function build() {
    root = document.createElement('div');
    root.id = 'gym'; root.className = 'ch-gym'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'gym-name');
    const step = (field, by, unit, label, less, more) => `<div class="ch-gym__step" data-field="${field}"><button type="button" class="ch-gym__adj" data-gym="${field}-" aria-label="${less}">−${by}</button><label class="ch-gym__val"><input id="gym-${field}" type="number" inputmode="${field === 'kg' ? 'decimal' : 'numeric'}" min="0" max="${field === 'kg' ? 500 : 300}" step="${field === 'kg' ? 0.5 : 1}" enterkeyhint="done" autocomplete="off" aria-label="${label}"><span id="gym-${field}-unit">${unit}</span></label><button type="button" class="ch-gym__adj" data-gym="${field}+" aria-label="${more}">+${by}</button></div>`;
    root.innerHTML = `
      <header class="ch-gym__top">
        <button type="button" class="ch-gym__icon" data-gym="close" aria-label="Minimise workout">${icon('chevron-down', 26, { weight: 2.6 })}</button>
        <div class="ch-gym__title"><p id="gym-session"></p><p class="ch-gym__clock" id="gym-clock"></p></div>
        <button type="button" class="ch-gym__end" data-gym="finish">Finish</button>
      </header>
      <div class="ch-gym__bar" id="gym-bar" aria-hidden="true"></div>
      <section class="ch-gym__stage" id="gym-stage" aria-live="polite">
        <p class="ch-gym__count" id="gym-count"></p>
        <h2 class="ch-gym__name" id="gym-name"></h2>
        <p class="ch-gym__rx" id="gym-rx"></p>
        <p class="ch-gym__hint" id="gym-hint"></p>
        <div class="ch-gym__dots" id="gym-dots" role="group" aria-label="Sets"></div>
        <div class="ch-gym__rest" id="gym-rest" hidden>
          <div class="ch-gym__ring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="ch-gym__track" cx="100" cy="100" r="88"/><circle class="ch-gym__arc" id="gym-arc" cx="100" cy="100" r="88" pathLength="1000"/></svg>
            <div class="ch-gym__time"><b id="gym-rest-time" role="timer" aria-live="off"></b><small id="gym-rest-label">Rest</small></div></div>
          <p class="ch-gym__restnext" id="gym-rest-next"></p>
          <div class="ch-gym__restbtns"><button type="button" class="ch-gym__pill" data-gym="more">+15 s</button><button type="button" class="ch-gym__pill" data-gym="skip">Skip</button></div>
        </div>
      </section>
      <footer class="ch-gym__controls">
        ${step('kg', '2.5', 'kg', 'Weight in kg', '2.5 kg less', '2.5 kg more')}
        ${step('reps', '1', 'reps', 'Reps', 'One rep less', 'One rep more')}
        <button type="button" class="ch-gym__go" id="gym-go" data-gym="go"></button>
        <div class="ch-gym__nav"><button type="button" class="ch-gym__navbtn" data-gym="prev">${icon('chevron-left', 18, { weight: 2.6 })}Prev</button><button type="button" class="ch-gym__navbtn" data-gym="next">Next${icon('chevron', 18, { weight: 2.6 })}</button></div>
      </footer>
      <section class="ch-gym__done" id="gym-done" aria-labelledby="gym-done-title" hidden>
        <div class="ch-gym__trophy" id="gym-trophy">${icon('trophy', 44, { weight: 1.8 })}</div>
        <h2 id="gym-done-title"></h2>
        <p class="ch-gym__xp"><b id="gym-done-xp">0</b> XP</p>
        <div class="ch-gym__stats"><div><b id="gym-done-volume">0</b><span>kg volume</span></div><div><b id="gym-done-time">0</b><span>minutes</span></div><div><b id="gym-done-sets">0</b><span>sets</span></div></div>
        <ul class="ch-gym__prs" id="gym-done-prs"></ul>
        <p class="ch-gym__next" id="gym-done-next"></p>
        <button type="button" class="ch-gym__go ch-gym__go--gold" data-gym="done">Done</button>
      </section>`;
    (document.querySelector('.ch-app') || document.body).append(root);
    root.addEventListener('click', e => { const b = e.target.closest('[data-gym]'); if (b && root.contains(b) && !b.disabled) act(b.dataset.gym, b); });
    for (const field of ['kg', 'reps']) {
      const input = $('gym-' + field);
      input.addEventListener('input', () => { const e = current(); if (!e || input.value === '') return; const v = Number(input.value); if (Number.isFinite(v) && v >= 0) { ui[field][e.name] = v; saveUI(); } });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      input.addEventListener('focus', () => input.select());
    }
    // A sideways swipe on the exercise changes exercise; the buttons do the same within thumb reach.
    let touch = null;
    $('gym-stage').addEventListener('touchstart', e => { touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
    $('gym-stage').addEventListener('touchend', e => { if (!touch) return; const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null; if (Math.abs(dx) > 64 && Math.abs(dy) < 48) go(dx < 0 ? 1 : -1); }, { passive: true });
    addEventListener('keydown', e => { if (root.hidden || e.defaultPrevented) return; if (e.key === 'Escape') { e.preventDefault(); if (finished) done(); else minimise(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden || root.hidden) return; wake(); tick(); });
  }
  const plan = () => T().plan(ui.key);
  function current() { if (!ui) return null; const list = plan().ex; return list[Math.max(0, Math.min(ui.ex || 0, list.length - 1))] || null; }
  const complete = (w, e) => T().setsFor(w, e.name).length >= e.sets;
  function nextIncomplete(w, from) { const list = plan().ex; for (let i = 1; i <= list.length; i++) { const j = (from + i) % list.length; if (!complete(w, list[j])) return j; } return -1; }

  /* ---- keeping the screen awake for the whole workout ---- */
  async function wake() {
    if (lock || locking || !root || root.hidden || document.hidden || !navigator.wakeLock?.request) return;
    locking = true;
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener?.('release', () => { lock = null; }); if (root.hidden) release(); }
    catch { lock = null; }                                   // denied (battery saver, no gesture yet): the workout still works
    finally { locking = false; }
  }
  function release() { const l = lock; lock = null; try { l?.release?.(); } catch { /* already gone */ } }

  /* ---- showing and hiding ---- */
  function shell(on) { for (const n of [document.querySelector('main'), document.querySelector('.ch-tabbar'), $('today-scan')]) if (n) n.inert = on; document.documentElement.classList.toggle('is-gym', on); }
  function show() {
    if (!root) build();
    const was = root.hidden;
    root.hidden = false; shell(true); shownSig = '';
    paint();
    if (was) { M()?.pulse(root, 'is-entering', 600); (root.querySelector('#gym-go:not([hidden])') || root.querySelector('[data-gym="done"]'))?.focus({ preventScroll: true }); }
    clearInterval(loop); loop = setInterval(tick, 250); tick();
    wake();
  }
  function hide() {
    if (!root || root.hidden) return;
    root.hidden = true; shell(false); clearInterval(loop); loop = null; clearTimeout(advanceTimer); release();
  }
  function minimise() { if (ui) { ui.open = false; saveUI(); } hide(); api?.refresh(); document.querySelector('[data-gym-start]')?.focus({ preventScroll: true }); }
  function done() { finished = null; ui = null; saveUI(); hide(); api?.refresh(); M()?.enter($('today')); }

  /* ---- journal changes ---- */
  function start(key) {
    if (!api) return;
    const d = day(state, key), w = d.workout, s = T().plan(key);
    if (w && !w.end) return open(key);
    if (T().finished(d) || s.kind !== 'gym') return;
    const fresh = { id: s.id, start: Date.now(), sets: [] }, was = api.shape(state, key);
    ui = { key, open: true, ex: 0, kg: {}, reps: {}, rest: null }; saveUI(); finished = null;
    if (!api.change({ label: s.name + ' started', kind: 'on', day: key, forward: st => api.patchDay(st, key, { workout: fresh }), backward: st => api.patchDay(st, key, { workout: undefined }, was) })) { ui = null; saveUI(); return; }
    show();
  }
  function open(key) {
    const w = workout(key); if (!w || w.end) return;
    const saved = loadUI();
    ui = saved && saved.key === key ? saved : { key, open: true, ex: 0, kg: {}, reps: {}, rest: null };
    if (!(saved && saved.key === key)) { const first = nextIncomplete(w, -1); ui.ex = first < 0 ? 0 : first; }
    ui.open = true; saveUI(); finished = null; show();
  }
  function bestBefore(name) { return Math.max(0, ...(T().index(state).get(name) || []).filter(s => s.key < ui.key).map(T().strength)); }
  function logSet(e) {
    const key = ui.key, w = workout(key); if (!w || w.end) return;
    const kgIn = $('gym-kg'), repsIn = $('gym-reps');
    let kg = e.kind === 'time' ? 0 : Number(kgIn.value || 0), reps = Number(repsIn.value);
    if (e.kind === 'kg' && !(kg > 0)) return nudge(kgIn, 'Add the weight first');
    if (!(reps >= 1 && reps <= 300)) return nudge(repsIn, e.kind === 'time' ? 'How many seconds?' : 'How many reps?');
    kg = Math.round(Math.max(0, Math.min(500, kg)) * 10) / 10; reps = Math.round(reps);
    const at = Date.now(), set = { x: e.name, kg, reps, at }, n = T().setsFor(w, e.name).length + 1, record = bestBefore(e.name);
    const ok = api.change({ label: (e.kind === 'time' ? 'Sprint ' : 'Set ') + n + ' · ' + setText(set, e), kind: 'on', positive: true, day: key,
      forward: s => withWorkout(s, key, wk => ({ ...wk, sets: [...wk.sets.filter(x => !(x.at === at && x.x === e.name)), set] })),
      backward: s => withWorkout(s, key, wk => ({ ...wk, sets: wk.sets.filter(x => !(x.at === at && x.x === e.name)) })) });
    if (!ok) return;
    ui.kg[e.name] = kg; ui.reps[e.name] = reps;
    const nowW = workout(key), left = T().progress(state, key);
    ui.rest = left.done < left.total ? { until: at + e.rest * 1000, total: e.rest * 1000, at } : null;
    saveUI();
    M()?.mark(null, null, () => { const dot = root.querySelector(`.ch-gym__dot[data-set="${n - 1}"]`); M()?.pulse(dot, 'just-on'); const gain = api.xpGain?.(); if (dot && gain > 0) M()?.floater(dot, '+' + gain + ' XP'); }); M()?.flush();
    if (record > 0 && e.kind !== 'time' && T().strength(set) > record + 1e-9 && !celebrated.has(key + ':' + e.name)) { celebrated.add(key + ':' + e.name); api.celebrate('Personal record · ' + e.name); M()?.haptic('success'); }
    // Exercise done: the next one slides in after a beat, while the rest timer keeps running.
    if (complete(nowW, e)) { clearTimeout(advanceTimer); const at2 = ui.ex; advanceTimer = setTimeout(() => { if (!ui || ui.ex !== at2 || root.hidden) return; const j = nextIncomplete(workout(ui.key), at2); if (j >= 0) go(j - at2, true); }, 700); }
    paint();
  }
  function unlogSet(e, j) {
    const key = ui.key, w = workout(key), target = T().setsFor(w, e.name)[j]; if (!target) return;
    const index = w.sets.indexOf(target), same = x => x.at === target.at && x.x === target.x;
    api.change({ label: (e.kind === 'time' ? 'Sprint ' : 'Set ') + (j + 1) + ' removed', kind: 'off', day: key,
      forward: s => withWorkout(s, key, wk => ({ ...wk, sets: wk.sets.filter(x => !same(x)) })),
      backward: s => withWorkout(s, key, wk => { const sets = wk.sets.filter(x => !same(x)); sets.splice(Math.min(index, sets.length), 0, target); return { ...wk, sets }; }) });
  }
  // Finish: the end time and the session done, as one change. With nothing logged, the workout simply goes.
  function finish() {
    const key = ui.key, d = day(state, key), w = d.workout; if (!w || w.end) return;
    const s = T().plan(key), was = api.shape(state, key), sets = (w.sets || []).length;
    clearTimeout(advanceTimer);
    if (!sets) {
      if (api.change({ label: 'Workout ended · nothing logged', kind: 'off', day: key, forward: st => api.patchDay(st, key, { workout: undefined }, was), backward: st => api.patchDay(st, key, { workout: w }) })) { ui = null; saveUI(); hide(); api.refresh(); }
      return;
    }
    const end = Date.now(), training = d.training, xp = sets * T().SET_XP + (training ? 0 : 10 * (window.CHADQuest?.sessionLength(key) || s.ex.length));
    finished = { key, xp };
    const ok = api.change({ label: s.name + ' done · ' + sets + (sets === 1 ? ' set' : ' sets'), kind: 'on', day: key, onApply: () => api.chime?.([523, 659, 784, 1047]),
      forward: st => { const cur = st.questsV5?.[key]?.workout; return cur ? api.patchDay(st, key, { workout: { ...cur, end }, training: true }) : st; },
      backward: st => { const cur = st.questsV5?.[key]?.workout; if (!cur) return st; const { end: _, ...open } = cur; return api.patchDay(st, key, { workout: open, training }); } });
    if (!ok) { finished = null; return; }
    ui.rest = null; ui.open = true; saveUI(); paint();
    M()?.haptic('success');
    setTimeout(() => { if (finished && !root.hidden) M()?.confetti($('gym-trophy')); }, 120);
  }
  function nudge(input, text) { M()?.haptic('warn'); M()?.pulse(input.closest('.ch-gym__step'), 'is-wrong', 500); api?.message(text); input.focus(); }
  function go(delta, auto) {
    const list = plan().ex, to = Math.max(0, Math.min(list.length - 1, (ui.ex || 0) + delta));
    if (to === ui.ex) return;
    clearTimeout(advanceTimer);
    ui.ex = to; saveUI(); if (!auto) M()?.haptic('tap');
    const stage = $('gym-stage'); stage.classList.remove('is-next', 'is-prev'); void stage.offsetWidth; stage.classList.add(delta > 0 ? 'is-next' : 'is-prev');
    setTimeout(() => stage.classList.remove('is-next', 'is-prev'), 420);
    paint();
  }
  function adjust(field, sign) {
    const e = current(); if (!e) return;
    const input = $('gym-' + field), stepBy = field === 'kg' ? T().STEP : 1, now = Number(input.value || 0);
    const next = Math.max(field === 'reps' ? 1 : 0, Math.min(field === 'kg' ? 500 : 300, Math.round((now + sign * stepBy) * 10) / 10));
    input.value = String(next); ui[field][e.name] = next; saveUI(); M()?.haptic('tap');
    M()?.pulse(input.closest('.ch-gym__val'), 'is-bump', 300);
  }
  function act(what, b) {
    if (!ui) return;
    const e = current(), w = workout(ui.key);
    if (what === 'close') return minimise();
    if (what === 'done') return done();
    if (what === 'finish') return finish();
    if (what === 'more' && ui.rest) { ui.rest.until += 15000; ui.rest.total += 15000; saveUI(); M()?.haptic('tap'); return tick(); }
    if (what === 'skip') { ui.rest = null; saveUI(); M()?.haptic('tap'); return paint(); }
    if (what === 'prev' || what === 'next') return go(what === 'next' ? 1 : -1);
    if (/^(kg|reps)[+-]$/.test(what)) return adjust(what.slice(0, -1), what.endsWith('+') ? 1 : -1);
    if (!e || !w || w.end) return;
    if (what === 'dot') { const j = Number(b.dataset.set), have = T().setsFor(w, e.name).length; return j < have ? unlogSet(e, j) : logSet(e); }
    if (what === 'go') {
      if (!complete(w, e)) return logSet(e);
      const j = nextIncomplete(w, ui.ex);
      return j >= 0 ? go(j - ui.ex) : finish();
    }
  }

  /* ---- painting ---- */
  function paint() {
    if (!root || root.hidden || !ui) return;
    const key = ui.key, w = workout(key);
    if (finished && finished.key === key && w?.end) return paintDone();
    finished = null; root.classList.remove('is-finished'); $('gym-done').hidden = true;
    if (!w || w.end) { ui = null; saveUI(); hide(); return; }                    // undone or finished elsewhere
    if (ui.rest && !w.sets.some(x => x.at === ui.rest.at)) { ui.rest = null; saveUI(); }   // the set behind this rest was undone
    const s = plan(), list = s.ex, e = current(), mine = T().setsFor(w, e.name), have = mine.length, p = T().progress(state, key);
    $('gym-session').textContent = s.name + (s.deload ? ' · deload' : '');
    $('gym-count').textContent = 'Exercise ' + (ui.ex + 1) + ' of ' + list.length + ' · ' + p.done + '/' + p.total + ' sets';
    $('gym-name').textContent = e.name;
    $('gym-rx').textContent = T().rx(e) + (e.kind === 'time' ? '' : ' reps') + ' · rest ' + T().restText(e.rest);
    const top = T().last(state, e.name, key);
    $('gym-hint').textContent = T().hint(e, top);
    // progress bar: one segment per exercise
    const bar = $('gym-bar');
    if (bar.children.length !== list.length) bar.replaceChildren(...list.map(() => document.createElement('i')));
    [...bar.children].forEach((seg, i) => { seg.style.setProperty('--p', Math.min(1, T().setsFor(w, list[i].name).length / list[i].sets)); seg.classList.toggle('is-here', i === ui.ex); });
    // the set dots
    const sig = e.name + '|' + e.sets + '|' + mine.map(x => x.at).join(',');
    if (sig !== shownSig) {
      shownSig = sig;
      const dots = $('gym-dots'), count = Math.max(e.sets, have);
      dots.style.setProperty('--cols', count <= 5 ? count : Math.ceil(count / 2));
      dots.replaceChildren(...Array.from({ length: count }, (_, j) => {
        const b = document.createElement('button'), set = mine[j]; b.type = 'button'; b.className = 'ch-gym__dot' + (set ? ' is-done' : j === have ? ' is-next' : '');
        b.dataset.gym = 'dot'; b.dataset.set = String(j);
        if (set) { b.innerHTML = icon('check', 26, { weight: 3.2 }); b.append(Object.assign(document.createElement('small'), { textContent: e.kind === 'time' ? set.reps + 's' : set.kg > 0 ? T().kgText(set.kg) + '×' + set.reps : '×' + set.reps })); }
        else b.append(Object.assign(document.createElement('span'), { textContent: String(j + 1) }));
        b.setAttribute('aria-label', set ? (e.kind === 'time' ? 'Sprint ' : 'Set ') + (j + 1) + ' done: ' + setText(set, e) + '. Tap to remove' : 'Log ' + (e.kind === 'time' ? 'sprint ' : 'set ') + (j + 1));
        return b;
      }));
    }
    // kg and reps, pre-filled: what was typed, else this workout's last set, else the suggestion from last time
    const prev = mine.at(-1), sug = T().suggest(e, top), kg = ui.kg[e.name] ?? (prev ? prev.kg : sug.kg), reps = ui.reps[e.name] ?? (prev ? prev.reps : sug.reps);
    root.querySelector('[data-field="kg"]').hidden = e.kind === 'time';
    if (document.activeElement !== $('gym-kg')) $('gym-kg').value = kg == null ? '' : String(kg);
    if (document.activeElement !== $('gym-reps')) $('gym-reps').value = reps == null ? '' : String(reps);
    $('gym-kg').placeholder = e.kind === 'bw' ? '0' : '–'; $('gym-kg-unit').textContent = e.kind === 'bw' ? '+kg' : 'kg';
    $('gym-reps-unit').textContent = e.kind === 'time' ? 's' : 'reps';
    // the big button: log the next set, move on, or finish
    const goBtn = $('gym-go'), allDone = p.done >= p.total, next = nextIncomplete(w, ui.ex);
    goBtn.classList.toggle('ch-gym__go--gold', allDone);
    if (have < e.sets) { goBtn.innerHTML = icon('check', 26, { weight: 3 }); goBtn.append(Object.assign(document.createElement('span'), { textContent: (e.kind === 'time' ? 'Log sprint ' : 'Log set ') + (have + 1) + ' of ' + e.sets })); }
    else if (next >= 0) { goBtn.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'Next: ' + list[next].name })); goBtn.insertAdjacentHTML('beforeend', icon('chevron', 22, { weight: 2.8 })); }
    else { goBtn.innerHTML = icon('trophy', 24, { weight: 2 }); goBtn.append(Object.assign(document.createElement('span'), { textContent: 'Finish workout' })); }
    $('gym-rest-next').textContent = have < e.sets ? 'Next: ' + (e.kind === 'time' ? 'sprint ' : 'set ') + (have + 1) + ' of ' + e.sets + ' · ' + e.name : next >= 0 ? 'Next: ' + list[next].name : 'All sets done';
    root.querySelector('[data-gym="prev"]').disabled = ui.ex <= 0; root.querySelector('[data-gym="next"]').disabled = ui.ex >= list.length - 1;
    tick();
  }
  function tick() {
    if (!root || root.hidden || !ui) return;
    const w = workout(ui.key); if (!w) return;
    $('gym-clock').textContent = clock((w.end || Date.now()) - w.start);
    const panel = $('gym-rest'), arc = $('gym-arc');
    if (ui.rest) {
      const left = ui.rest.until - Date.now();
      if (left <= 0) return restOver();
      panel.hidden = false; panel.classList.remove('is-go'); root.classList.add('is-resting');
      $('gym-rest-time').textContent = clock(left + 999); $('gym-rest-label').textContent = 'Rest';
      arc.style.strokeDashoffset = String(Math.round(1000 * (1 - left / ui.rest.total)));
    } else if (!panel.classList.contains('is-go')) { panel.hidden = true; root.classList.remove('is-resting'); }
  }
  // The rest is over: a buzz, a beep if sounds are on, and "Go" for a moment.
  function restOver() {
    ui.rest = null; saveUI();
    const panel = $('gym-rest'); panel.hidden = false; panel.classList.add('is-go'); root.classList.add('is-resting');
    $('gym-rest-time').textContent = 'Go'; $('gym-rest-label').textContent = 'Next set'; $('gym-arc').style.strokeDashoffset = '0';
    M()?.haptic('success'); api?.chime?.([784, 988]);
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { panel.classList.remove('is-go'); panel.hidden = true; root.classList.remove('is-resting'); }, 1400);
  }
  function paintDone() {
    const sum = T().summary(state, finished.key), s = T().plan(finished.key);
    root.classList.add('is-finished'); $('gym-done').hidden = false; $('gym-rest').hidden = true;
    $('gym-done-title').textContent = sum.name + ' done';
    const counts = [['gym-done-xp', finished.xp, n => '+' + Math.round(n)], ['gym-done-volume', sum.volume, n => Math.round(n).toLocaleString('en-AU')], ['gym-done-time', sum.minutes || 0, n => String(Math.round(n))], ['gym-done-sets', sum.sets, n => String(Math.round(n))]];
    for (const [id, value, format] of counts) { const node = $(id); if (node.__done === finished.key + value) continue; node.__done = finished.key + value; node.__chTo = null; if (M()) M().count(node, value, { format, from: 0, duration: 900 }); else node.textContent = format(value); }
    const prs = $('gym-done-prs');
    const shown = sum.prs.slice(0, 3), more = sum.prs.length - shown.length;
    $('gym-done-time').nextElementSibling.textContent = sum.minutes === 1 ? 'minute' : 'minutes'; $('gym-done-sets').nextElementSibling.textContent = sum.sets === 1 ? 'set' : 'sets';
    prs.replaceChildren(...(shown.length ? shown.map(r => { const li = document.createElement('li'); li.innerHTML = icon('crown', 18, { weight: 2 }); li.append(Object.assign(document.createElement('span'), { textContent: r.name }), Object.assign(document.createElement('b'), { textContent: (r.kg > 0 ? T().kgText(r.kg) + ' kg × ' : '') + r.reps + (r.kg > 0 ? '' : ' reps') })); return li; }).concat(more > 0 ? [Object.assign(document.createElement('li'), { className: 'is-more', textContent: '+ ' + more + (more === 1 ? ' more record' : ' more records') })] : []) : [Object.assign(document.createElement('li'), { className: 'is-none', textContent: 'No new records today. Add a rep next time.' })]));
    $('gym-done-next').textContent = s.id === 'legs' ? 'Next: stretch, then dinner' : 'Next: ' + s.cardio;
  }

  // On load: a workout left open (and not too old) comes straight back.
  function resume() {
    const saved = loadUI(); if (!saved || !saved.open || !api) return;
    const w = workout(saved.key);
    if (!w || w.end || Date.now() - w.start > RESUME_HOURS * 36e5) { if (!w || w.end) { ui = null; saveUI(); } return; }
    ui = saved; show();
  }
  function render(next, actions) {
    state = next; api = actions;
    if (root && !root.hidden) paint();
  }
  window.CHADGym = { render, start, open, resume, minimise, isOpen: () => !!root && !root.hidden, state: () => ui && { ...ui } };
})();
