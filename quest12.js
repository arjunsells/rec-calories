'use strict';
// CHAD v12 · scoring and calendar (the v5-v10 rules, kept for the data and never shown: no score, grade, level or XP
// on screen) and the screens: Today, Gym, Progress and Settings.
(() => {
  const $ = id => document.getElementById(id);
  // v8: one formatter, reused. Building an Intl.DateTimeFormat per call made every render pay for thousands of them.
  const darwinDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Darwin',year:'numeric',month:'2-digit',day:'2-digit'});
  const dayKey = (date = new Date()) => darwinDate.format(date);
  const shift = (key,n) => {const d=new Date(key+'T12:00:00+09:30'); d.setUTCDate(d.getUTCDate()+n); return dayKey(d);};
  const weekday = key => new Date(key+'T12:00:00+09:30').getUTCDay();
  const monday = key => shift(key,-((weekday(key)+6)%7));
  const waterGoal = key => weekday(key)===0?3.5:weekday(key)===6?5:4.5;
  const phases = [ ['cut','Cut','2026-12-06',[1900,220,150,45]], ['reset','Reset','2026-12-13',[2700,200,320,70]], ['bulk','Bulk','2027-05-02',[3000,200,370,80]] ];
  function phase(state,key) {const ends=state.phaseEnds||phases.map(p=>p[2]);const index=key<=ends[0]?0:key<=ends[1]?1:2;return phases.find(p=>p[0]===state.phaseMode)||phases[index];}
  function goals(state,key) {const p=phase(state,key);const v=state.phaseMode==='custom'?(state.customGoals||[state.target,state.proteinGoal,state.carbsGoal,state.fatGoal]):(state.phaseMacros?.[p[0]]||p[3]);return {target:v[0],proteinGoal:v[1],carbsGoal:v[2],fatGoal:v[3]};}
  const deload = key => CHADTrain.deload(key);
  const training = CHADTrain.WEEK;
  const sessionLength = key => { const s = CHADTrain.WEEK[weekday(key)]; return s.ex.length || s.items.length; };
  // v8: entries are indexed by day once per journal array (every save replaces the array).
  const byDay=new WeakMap();
  function entriesOn(state,key) {
    let index=byDay.get(state.entries);
    if(!index||index.size!==state.entries.length){index={size:state.entries.length,days:new Map()};for(const e of state.entries){const list=index.days.get(e.day);if(list)list.push(e);else index.days.set(e.day,[e]);}byDay.set(state.entries,index);}
    return index.days.get(key)||[];
  }
  // Kept from v10 so earlier days and the data mean exactly what they meant: from 24 Nov 2026 (three meals) the day's
  // session counts like a fourth Strict pick. Nothing on screen shows the score any more.
  const THREE_MEALS = '2026-11-24';
  const sessionDone = (q,key) => { const s=CHADTrain.WEEK[weekday(key)]; return !!s && (s.kind==='rest' ? !!q.cardio : CHADTrain.finished(q)); };
  const POINTS = {S:3,M:2,F:1,C:1};
  function daily(state,key) {
    const q=state.questsV5?.[key]||{}, entries=entriesOn(state,key);
    const totals=entries.reduce((t,e)=>t.map((v,i)=>v+(e[['kcal','protein','carbs','fat'][i]]||0)),[0,0,0,0]);
    const picks=q.picks||{}; const protein=totals[1]>=210; const water=(q.water||0)>=waterGoal(key);
    const session=key>=THREE_MEALS&&sessionDone(q,key);
    const meals=[...Object.values(picks).map(p=>POINTS[p]||0),...(session?[3]:[])].sort((a,b)=>b-a).slice(0,4).reduce((s,v)=>s+v,0);
    const score=meals+(protein?2:0)+(water?2:0)+(q.steps?1:0);
    return {...q,picks,totals,score,protein,waterHit:water,sessionHit:session,grade:score>=15?'S':score>=12?'A':score>=9?'B':'C'};
  }
  function week(state,start,today) {let total=0,free=0,complete=true;for(let i=0;i<7;i++){const key=shift(start,i),d=daily(state,key);total+=d.score;free+=Object.values(d.picks).filter(p=>p==='F').length;complete&&=key<=today&&Object.keys(d.picks).length>=(key>=THREE_MEALS?3:4);} const bonus=complete&&free<=2?10:0;return {total:total+bonus,free,bonus,complete};}
  function stats(state,today) {
    const keys=[...new Set([...state.entries.map(e=>e.day),...Object.keys(state.questsV5||{})])].filter(k=>k<=today).sort();
    const {streak,longest,since}=RECGame.journey(state,today);
    let last='',pRun=0,wRun=0,maxP=0,maxW=0;
    for(const key of keys){const d=daily(state,key),adj=last===shift(key,-1);pRun=d.protein?(adj?pRun+1:1):0;wRun=d.waterHit?(adj?wRun+1:1):0;maxP=Math.max(maxP,pRun);maxW=Math.max(maxW,wRun);last=key;}
    const w=week(state,monday(today),today),level=w.total>=120?'AJ Mode':w.total>=105?'Champion':w.total>=85?'Beast':w.total>=60?'Grinder':'Rookie';
    return {streak,longest,since,week:w,level,maxP,maxW};
  }
  // Days in a row on the water goal, up to today (or yesterday while today is still filling).
  function waterStreak(state,today) {let n=0,k=daily(state,today).waterHit?today:shift(today,-1);while(n<3660&&daily(state,k).waterHit){n++;k=shift(k,-1);}return n;}
  // 0..1: how much of a day's session is done.
  function sessionProgress(state,key) {const d=state.questsV5?.[key]||{};if(CHADTrain.finished(d))return 1;const p=CHADTrain.progress(state,key);return p.total?p.done/p.total:Object.values(d.exercises||{}).filter(Boolean).length/Math.max(1,sessionLength(key));}

  /* ---- screens. Every change goes through api.change() (app12.js): the journal is written first, then the toast
     offers Undo, and Undo offers Redo. Each direction touches only its own fields, so newer unrelated edits survive. ---- */
  const TIER = { S: 'Strict', M: 'Medium', F: 'Free', C: 'Custom' }, TIER_CLASS = { S: 'strict', M: 'medium', F: 'free' };
  const SLOT_ICON = { L: 'fork', D: 'moon', P: 'bolt' };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ADDONS = { reset: [['shake', 'Daily shake', [610, 38, 83, 13]], ['banana', 'Extra banana', [89, 1.1, 23, .3]]], bulk: [['bagel', 'Plain bagel', [313, 10, 60, 2]], ['wrap', 'Protein wrap', [175, 10, 24, 4]], ['shake', 'Daily shake', [610, 38, 83, 13]]] };
  const STREAK_MARKS = new Set([3, 30, 50, 100, 150, 200, 250, 300, 365]);
  // The snack is offered as the thing to do now only while protein is this far short (it is optional).
  const SNACK_GAP = 20;
  let api, current, settingsReady = false, chartRange = 7, themeShown, pinned = null, pinTimer, laterOpen = false, lastTap = { id: null, t: 0 }, settleUntil = 0, workoutsShown = 5, lastNow = null, recordsAll = false;
  const M = () => window.CHADMotion;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (cls, fn, text) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.onclick = fn; return b; };
  const icon = (name, size, opts) => window.CHADIcons.icon(name, size, opts);
  const oneDecimal = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }), fmt = n => oneDecimal.format(n), whole = n => Math.round(n).toLocaleString('en-AU');
  const activeKey = () => api.key || dayKey();
  const shortDate = key => new Date(key + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const dayMonth = key => new Date(key + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', day: 'numeric', month: 'short' });
  const macroWords = m => whole(m[0]) + ' kcal, protein ' + whole(m[1]) + ' g, carbs ' + whole(m[2]) + ' g, fat ' + whole(m[3]) + ' g';
  const howText = c => c.how.join('. ') + '.';
  const slotById = id => CHADPlan.find(x => x.id === id);
  function chime(notes = [523, 659, 784]) { if (!current?.arcadeSound || matchMedia('(prefers-reduced-motion: reduce)').matches) return; try { const ac = new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.025, ac.currentTime + i * .07); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + i * .07 + .1); o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * .07); o.stop(ac.currentTime + i * .07 + .11); }); setTimeout(() => ac.close(), 600); } catch { /* Sound remains optional. */ } }
  // A second tap on the same control within 400 ms would cancel the first: that is a slip, so the first one stands.
  function slip(id, e) {
    const t = e && e.timeStamp;
    if (!t) return false;
    const twice = lastTap.id === id && t >= lastTap.t && t - lastTap.t < 400;
    lastTap = { id, t };
    return twice;
  }
  // After a log moves the thing to do now on (the next one takes its place), cards ignore touches until the move is
  // done: 700 ms while the logged card holds its place, 300 ms without motion. Undo in the toast is always there.
  const settling = e => !!(e && e.timeStamp && e.timeStamp < settleUntil);

  /* ---- changes ---- */
  // Some fields of one day. Undo puts back exactly those fields; containers that did not exist are dropped again.
  function update(patch, o) {
    const key = o.key || activeKey(), old = current.questsV5?.[key] || {}, was = api.shape(current, key);
    const before = Object.fromEntries(Object.keys(patch).map(k => [k, old[k]]));
    return api.change({ label: o.label, kind: o.kind || (o.positive ? 'on' : 'off'), positive: !!o.positive, day: key, onApply: o.positive ? () => chime() : null,
      forward: s => api.patchDay(s, key, patch), backward: s => api.patchDay(s, key, before, was) });
  }
  /* ---- meals: what is left today, the option that fits it best, and yesterday's meal ---- */
  // Goals minus what is logged on the day: [kcal, protein, carbs, fat] (negative = over).
  function remaining(state, key) { const g = goals(state, key), t = daily(state, key).totals; return [g.target - t[0], g.proteinGoal - t[1], g.carbsGoal - t[2], g.fatGoal - t[3]]; }
  // Which option fits what is left best. Each option is followed by the slots still to come that day (`later`: a main
  // meal is always eaten, an optional one may be skipped), and the day is scored where it would end: kcal off the goal
  // (over counts double) plus protein still missing, both as a share of the goal. Ties go to the stricter option.
  function bestFit(left, choices, later = [], goal = [1900, 220]) {
    const cost = r => (r[0] < 0 ? -2 * r[0] : r[0]) / goal[0] + Math.max(0, r[1]) / goal[1];
    const finish = (r, rest) => {
      if (!rest.length) return cost(r);
      const [next, ...tail] = rest, eat = next.choices.map(c => finish([r[0] - c.macros[0], r[1] - c.macros[1]], tail));
      return Math.min(...eat, ...(next.optional ? [finish(r, tail)] : []));
    };
    let best = -1, low = Infinity;
    choices.forEach((c, i) => { const v = finish([left[0] - c.macros[0], left[1] - c.macros[1]], later); if (v < low - 1e-9) { low = v; best = i; } });
    return best;
  }
  // Slots still to come after this one, in the order of the day (the snack is optional).
  const laterSlots = (d, slot) => CHADPlan.slice(CHADPlan.indexOf(slot) + 1).filter(x => !d.picks[x.id]).map(x => ({ choices: x.choices, optional: x.id === 'P' }));
  // Yesterday's meal in this slot: one of today's cards (the card says so, one tap logs it), or anything else that was
  // logged there (a custom meal, an earlier plan's card), which "Same as yesterday" logs again as it was.
  function yesterdayMeal(state, key, slot) {
    const y = shift(key, -1), tier = state.questsV5?.[y]?.picks?.[slot.id];
    if (!tier) return null;
    const entry = state.entries.find(e => e.day === y && e.planSlot === slot.id);
    const card = slot.choices.find(c => c.tier === tier && (!entry || entry.name === c.title));
    if (card) return { tier, card };
    return entry ? { tier, entry } : null;
  }
  const meal = (slot, c) => ({ tier: c.tier, title: c.title, macros: c.macros, source: 'plan' });
  const fromEntry = (tier, e, source) => ({ tier, title: e.name, macros: [e.kcal, e.protein, e.carbs || 0, e.fat || 0], source, parts: e.parts });
  const myMeals = (state, slotId) => (Array.isArray(state.myMeals) ? state.myMeals : []).filter(m => m && m.slot === slotId && typeof m.name === 'string' && Array.isArray(m.macros));
  // A meal slot: tap a card to log it, tap it again to remove it, tap another to switch (never a duplicate). The same
  // goes for a custom meal from the builder or a saved one: it fills the slot (tier C). `again` logs without ever
  // removing (Same as yesterday, the builder's Log).
  function choose(slot, sel, e, again) {
    const key = activeKey(), day = current.questsV5?.[key] || {}, picked = day.picks?.[slot.id], was = api.shape(current, key), hadPicks = day.picks !== undefined;
    const prior = current.entries.map((e, i) => ({ e, i })).filter(({ e }) => e.day === key && e.planSlot === slot.id);
    const same = picked === sel.tier && (sel.tier !== 'C' || prior.some(({ e }) => e.name === sel.title && e.kcal === sel.macros[0]));
    const removing = same && !again;
    if (same && again) { api.message(slot.name + ' is already logged.'); return false; }
    const entry = { id: 'plan-' + key + '-' + slot.id, day: key, name: sel.title, kcal: sel.macros[0], protein: sel.macros[1], carbs: sel.macros[2], fat: sel.macros[3], meal: slot.name, source: sel.source || 'plan', planSlot: slot.id, ...(Array.isArray(sel.parts) && sel.parts.length ? { parts: sel.parts } : {}) };
    const others = s => s.entries.filter(e => !(e.day === key && e.planSlot === slot.id));
    const picksWith = (s, t) => { const p = { ...s.questsV5?.[key]?.picks }; if (t) p[slot.id] = t; else delete p[slot.id]; return p; };
    const where = sel.mark === 'again' ? `#today [data-slot-meal="${slot.id}"][data-again]` : sel.mark ? `#today [data-my-meal="${sel.mark}"]` : sel.tier === 'C' ? `#today [data-custom="${slot.id}"]` : `#today [data-slot="${slot.id}"][data-tier="${sel.tier}"]`;
    M()?.mark(where, null, node => { if (!node) return; M().pulse(node.closest('.ch-opt') || node, removing ? 'just-off' : 'just-on'); });
    const fromNow = lastNow && lastNow.key === key && lastNow.id === slot.id;
    if (!removing && fromNow && !picked) { const still = hold(slot.id, key); if (e && e.timeStamp) settleUntil = e.timeStamp + Math.max(300, still); }
    const name = sel.tier === 'C' ? sel.title : TIER[sel.tier];
    const ok = api.change({
      label: removing ? slot.name + ' removed' : picked ? slot.name + ' · ' + name : slot.name + ' logged', kind: removing ? 'off' : 'on', positive: !removing, day: key, onApply: removing ? null : () => chime(),
      forward: s => ({ ...api.patchDay(s, key, { picks: picksWith(s, removing ? null : sel.tier) }), entries: removing ? others(s) : [...others(s), entry] }),
      backward: s => { const p = picksWith(s, picked); return { ...api.patchDay(s, key, { picks: Object.keys(p).length || hadPicks ? p : undefined }, was), entries: api.restoreAt(others(s), prior) }; }
    });
    if (!ok) { clearTimeout(pinTimer); pinned = null; }
    return ok;
  }
  const pick = (slot, tier, e) => choose(slot, meal(slot, slot.choices.find(x => x.tier === tier)), e);
  // Saved meals ("Save" in the builder) live in the journal, so they are backed up and every change undoes.
  function saveMyMeal(item, toaster) {
    const id = 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), m = { id, slot: item.slot, name: item.name, macros: item.macros, parts: item.parts || [] };
    const had = Array.isArray(current.myMeals);                       // Undo puts back exactly the journal it found
    const ok = api.change({ label: 'Saved as my meal', kind: 'save', toaster,
      forward: s => ({ ...s, myMeals: [...(Array.isArray(s.myMeals) ? s.myMeals : []).filter(x => x.id !== id), m] }),
      backward: s => { const list = (Array.isArray(s.myMeals) ? s.myMeals : []).filter(x => x.id !== id); return list.length || had ? { ...s, myMeals: list } : api.assign(s, { myMeals: undefined }); } });
    return ok ? id : null;
  }
  function forgetMyMeal(m) {
    const list = Array.isArray(current.myMeals) ? current.myMeals : [], at = list.findIndex(x => x.id === m.id);
    if (at < 0) return false;
    return api.change({ label: m.name + ' removed from my meals', kind: 'off',
      forward: s => ({ ...s, myMeals: (s.myMeals || []).filter(x => x.id !== m.id) }),
      backward: s => { const out = (s.myMeals || []).filter(x => x.id !== m.id); out.splice(Math.min(at, out.length), 0, m); return { ...s, myMeals: out }; } });
  }
  // A meal just logged from the card on top stays there for a beat so its tick is seen; then the next thing to do takes
  // its place. Without motion it moves on at once.
  function hold(id, key) {
    clearTimeout(pinTimer); pinned = null;
    if (!M() || M().reduced()) return 0;
    pinned = { id, key };
    pinTimer = setTimeout(() => { pinned = null; api.refresh(); M()?.pulse($('now'), 'is-arriving', 600); }, 700);
    return 700;
  }
  // One-tap habits: cardio, steps, sleep, Hydralyte, and the session on class and rest days.
  function toggleQuest(field, name, key) {
    const done = !!daily(current, key)[field];
    return update({ [field]: !done }, { key, positive: !done, label: name + (done ? ' removed' : ' logged') });
  }
  // "Mark done": the session without logging sets. Switching it off leaves any sets alone.
  function toggleSession(key) {
    const q = daily(current, key), s = CHADTrain.plan(key);
    return update({ training: !q.training }, { key, positive: !q.training, label: s.name + (q.training ? ' reopened' : ' done') });
  }
  // Long press opens the meal's details, without logging.
  function longPress(b, open) {
    let timer, suppress = false, origin;
    const cancel = () => { clearTimeout(timer); timer = null; };
    b.addEventListener('pointerdown', e => { suppress = false; origin = { x: e.clientX, y: e.clientY }; timer = setTimeout(() => { timer = null; suppress = true; M()?.haptic('tap'); open(); }, 550); });
    b.addEventListener('pointermove', e => { if (origin && (Math.abs(e.clientX - origin.x) > 10 || Math.abs(e.clientY - origin.y) > 10)) cancel(); });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(type, cancel);
    b.addEventListener('click', e => { if (suppress) { e.stopImmediatePropagation(); e.preventDefault(); suppress = false; } }, true);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  const note = (name, text) => { const n = el('div', 'ch-note'); n.innerHTML = icon(name, 20); n.append(el('p', '', text)); return n; };
  // One sheet per option (long press): what is in it, the steps, and one button.
  function mealSheet(slot, tier) {
    const key = activeKey(), c = slot.choices.find(x => x.tier === tier), picked = daily(current, key).picks[slot.id], selected = picked === tier;
    const list = el('ul', 'ch-bullets'); c.items.forEach(item => list.append(el('li', '', item)));
    const steps = el('ol', 'ch-steps'); c.how.forEach(step => steps.append(el('li', '', step)));
    const label = selected ? 'Remove from ' + slot.name.toLowerCase() : picked ? 'Switch to this' : 'Log ' + slot.name.toLowerCase();
    window.CHADUX.detail(TIER[tier] + ' ' + slot.name.toLowerCase(), [el('h3', 'ch-mealsheet__title', c.title), window.CHADUX.macroTiles(c.macros), list, steps,
      button('ch-btn ch-btn--block' + (selected ? '' : ' ch-btn--gold'), () => { window.CHADUX.closeSheets(); pick(slot, tier); }, label)]);
  }
  function phaseHint(state, key) {
    if (state.phaseMode === 'custom') return 'Custom goals';
    const p = phase(state, key);
    if (phases.some(x => x[0] === state.phaseMode)) return p[1];
    const ends = state.phaseEnds || phases.map(x => x[2]), end = ends[phases.findIndex(x => x[0] === p[0])];
    const left = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(key + 'T00:00:00Z')) / 86400000);
    return left >= 0 ? p[1] + ' · ' + (left === 0 ? 'last day' : left + 'd left') : p[1];
  }
  // A journey milestone is celebrated once per device: every full week, and 3, 30, 50, 100 days and so on.
  function milestone(streak, today) {
    if (!streak || !(streak % 7 === 0 || STREAK_MARKS.has(streak))) return;
    let seen = ''; try { seen = localStorage.getItem('chad.streakSeen') || ''; } catch { /* no storage: no repeat guard, no banner */ return; }
    if (seen === today + ':' + streak) return;
    try { localStorage.setItem('chad.streakSeen', today + ':' + streak); } catch { return; }
    api.celebrate(streak % 7 === 0 ? streak / 7 + (streak === 7 ? ' week' : ' weeks') + ' strong · ' + streak + '-day streak' : streak + '-day streak');
    M()?.pulse($('home-streak'), 'just-on');
  }

  function render(state, actions) {
    current = state; api = actions;
    const key = activeKey(), today = dayKey(), d = daily(state, key), s = stats(state, today), water = waterStreak(state, today);
    $('home-streak').innerHTML = icon('flame', 18) + '<b class="ch-px">' + s.streak + '</b>'; $('home-streak').setAttribute('aria-label', s.streak + ' day streak'); $('home-streak').setAttribute('role', 'img');
    $('streak-count').textContent = s.streak;
    $('streak').textContent = s.since ? 'Since ' + dayMonth(s.since) : 'Day 1 ' + dayMonth(RECGame.journey(state, today).start);
    $('water-streak').textContent = water;
    $('water-streak-s').textContent = 'Best ' + Math.max(water, s.maxW) + (Math.max(water, s.maxW) === 1 ? ' day' : ' days');
    if (key === today) milestone(s.streak, today);
    renderToday(state, key, d);
    // Only the tab on screen is rebuilt; app12.js renders again when the tab changes.
    if (!$('training').hidden) renderTraining(state, key);
    if (!$('history').hidden) { renderWorkouts(state); renderRecords(state); renderCharts(state, key); }
    renderSettings(state, key, d);
    window.CHADGym?.render(state, { ...api, chime, update });
  }

  /* ---- Today: the line (app12.js), then ONE thing to do now, big, filling the first screen. Darwin time: water in
     the morning (lunch once it is in), lunch until 4 pm, the session 4-6:30 pm, then dinner, the snack while protein is
     short, water, the wrap-up. Everything else is one scroll down: Custom, Later today (water one tap), Quick log. ---- */
  const done = d => CHADTrain.finished(d);
  const sessionPending = (d, s) => s.kind === 'rest' ? !d.cardio : s.kind === 'class' ? !d.training : !done(d);
  const WRAP = [['steps', '10k steps', 'shoe', '10k steps'], ['sleep', 'Sleep 7 h+', 'sleep', 'Sleep'], ['electrolyte', 'Hydralyte', 'electrolyte', 'Hydralyte']];
  // What to do now: { id: 'meal' | 'water' | 'session' | 'wrap' | 'done', slot }.
  function nowFor(state, d, key, s) {
    if (pinned && pinned.key === key) return { id: 'meal', slot: slotById(pinned.id) };
    const pending = {
      water: () => (d.water || 0) < waterGoal(key),
      lunch: () => !d.picks.L, dinner: () => !d.picks.D,
      snack: () => !d.picks.P && !!d.picks.D && remaining(state, key)[1] >= SNACK_GAP,
      session: () => sessionPending(d, s),
      wrap: () => WRAP.some(([f]) => !d[f])
    };
    // v12: water has its own card above this one (one tap, all day), so it is never the thing to do now.
    const order = key !== dayKey() ? ['lunch', 'dinner', 'snack', 'wrap'] : {
      morning: ['lunch', 'session', 'dinner'],
      midday: ['lunch', 'session', 'dinner'],
      gym: ['session', 'dinner', 'snack', 'wrap'],
      evening: ['dinner', 'snack', 'wrap']
    }[window.CHADUX.timeBlock()];
    const id = order.find(x => pending[x]());
    if (!id) return { id: 'done' };
    if (['lunch', 'dinner', 'snack'].includes(id)) return { id: 'meal', slot: slotById({ lunch: 'L', dinner: 'D', snack: 'P' }[id]) };
    return { id };
  }
  function renderToday(state, key, d) {
    const s = CHADTrain.plan(key), now = nowFor(state, d, key, s), box = $('now'), id = now.id === 'meal' ? now.slot.id : now.id;
    const arriving = lastNow && lastNow.key === key && lastNow.id !== id;
    box.className = 'ch-now ch-now--' + now.id + (arriving ? ' is-arriving' : '');
    box.dataset.now = now.id; if (now.slot) box.dataset.mealSlot = now.slot.id; else delete box.dataset.mealSlot;
    box.replaceChildren(...(now.id === 'meal' ? nowMeal(state, now.slot, d, key) : now.id === 'water' ? nowWater(d, key) : now.id === 'session' ? nowSession(state, key, d, s) : now.id === 'wrap' ? nowWrap(state, key, d) : nowDone(state, key, d)));
    $('water-slot')?.replaceChildren(waterCard(d, key));
    const after = [];
    if (now.id === 'meal') after.push(otherRow(state, now.slot, d, key));
    after.push(laterBlock(state, key, d, s, now), quickBlock(state, key));
    $('after-now').replaceChildren(...after.filter(Boolean));
    lastNow = { key, id };
  }
  const head = (eyebrow, title, meta) => { const h = el('div', 'ch-now__head'), t = el('h2', 'ch-now__title', title); t.id = 'now-title'; h.append(el('p', 'ch-eyebrow ch-now__eyebrow', eyebrow), t); if (meta) h.append(el('p', 'ch-now__meta', meta)); return h; };
  const logged = (state, slot, d, key) => {
    const picked = d.picks[slot.id], eaten = state.entries.find(e => e.day === key && e.planSlot === slot.id);
    const c = picked && picked !== 'C' ? slot.choices.find(x => x.tier === picked && (!eaten || eaten.name === x.title)) || slot.choices.find(x => x.tier === picked) : null;
    // A custom meal (or an earlier plan's card) is named by what was logged.
    const label = picked === 'C' ? (eaten?.name || 'Custom') : c ? c.title : TIER[picked] || picked;
    return { picked, c, eaten, label, kcal: eaten ? eaten.kcal : c ? c.macros[0] : null };
  };
  // A meal, now: its three options, Strict, Medium, Free (lunch pins its two go-tos first). Once anything is logged
  // that day, the option that fits what is left best says so; yesterday's card says so too. Long press for the details.
  function nowMeal(state, slot, d, key) {
    const isToday = key === dayKey(), picked = d.picks[slot.id];
    const when = isToday ? (slot.id === 'L' ? 'Now · 12–1 pm' : slot.id === 'D' ? 'Now · after the gym' : 'Now · optional') : 'Next';
    const g = goals(state, key), y = picked ? null : yesterdayMeal(state, key, slot);
    const fit = !picked && d.totals[0] > 0 ? bestFit(remaining(state, key), slot.choices, laterSlots(d, slot), [g.target, g.proteinGoal]) : -1;
    const grid = el('div', 'meal-options ch-opts');
    slot.choices.forEach((c, i) => grid.append(option(slot, c, key, { picked, best: i === fit, again: !!y?.card && y.card === c })));
    return [head(when, slot.name), grid];
  }
  function option(slot, c, key, o) {
    const selected = o.picked === c.tier, card = el('div', 'meal-choice ch-opt ch-opt--' + TIER_CLASS[c.tier] + (o.best ? ' is-best' : '') + (c.pinned ? ' is-pinned' : '') + (selected ? ' is-logged' : ''));
    const b = button('meal-pick ch-opt__hit', e => { if (!slip('meal-' + key + slot.id + c.tier, e) && !settling(e)) pick(slot, c.tier, e); });
    b.dataset.slot = slot.id; b.dataset.tier = c.tier; b.setAttribute('aria-pressed', String(selected));
    if (o.best) b.dataset.best = ''; if (o.again) b.dataset.yesterday = '';
    b.setAttribute('aria-label', (selected ? 'Remove ' : o.picked ? 'Switch to ' : 'Log ') + TIER[c.tier] + ' ' + slot.name + ': ' + c.title + (c.pinned ? ' (go-to)' : '') + ', ' + macroWords(c.macros) + '.' + (o.again ? ' Same as yesterday.' : '') + (o.best ? ' Best fit for what is left today.' : ''));
    const top = el('span', 'ch-opt__top'), title = el('span', 'meal-title ch-opt__name'), nums = el('span', 'ch-opt__nums');
    top.append(el('span', 'tier-label ch-opt__tier', TIER[c.tier]));
    if (o.again) top.append(el('span', 'ch-opt__tag ch-opt__tag--again', 'Same as yesterday'));
    else if (o.best) top.append(el('span', 'ch-opt__tag ch-opt__tag--fit', 'Best fit'));
    if (c.pinned) { const pin = el('span', 'ch-opt__pin'); pin.innerHTML = icon('star', 14, { weight: 2.2 }); title.append(pin); }
    title.append(c.title);
    const k = el('span', 'ch-opt__kcal'); k.append(el('b', '', whole(c.macros[0])), ' kcal');
    const p = el('span', 'ch-opt__p'); p.append(el('b', '', whole(c.macros[1])), ' g protein');
    nums.append(k, p);
    b.append(top, title, nums);
    longPress(b, () => mealSheet(slot, c.tier));
    card.append(b);
    return card;
  }
  // Under the meal of the moment, one scroll down: yesterday's off-card meal, the saved meals, and + Custom.
  function otherRow(state, slot, d, key) {
    const row = el('div', 'ch-other'), picked = d.picks[slot.id], { eaten } = logged(state, slot, d, key), y = picked ? null : yesterdayMeal(state, key, slot);
    row.dataset.otherSlot = slot.id;
    if (y?.entry) {
      const b = button('ch-pill ch-pill--again', e => { if (!slip('again-' + key + slot.id, e) && !settling(e)) choose(slot, { ...fromEntry(y.tier, y.entry, y.entry.source || 'plan'), mark: 'again' }, e, true); });
      b.innerHTML = icon('repeat', 15, { weight: 2.4 }); b.append(el('span', '', 'Same as yesterday'), el('small', '', whole(y.entry.kcal) + ' kcal'));
      b.dataset.slotMeal = slot.id; b.dataset.again = ''; b.setAttribute('aria-label', 'Same as yesterday: ' + y.entry.name + ', ' + whole(y.entry.kcal) + ' kcal. Log it again');
      row.append(b);
    }
    for (const m of myMeals(state, slot.id).slice(-4).reverse()) {
      const on = picked === 'C' && eaten?.name === m.name && eaten?.kcal === m.macros[0];
      const b = button('ch-pill ch-pill--mine', e => { if (!slip('mine-' + key + m.id, e) && !settling(e)) choose(slot, { tier: 'C', title: m.name, macros: m.macros, source: 'custom', parts: m.parts, mark: m.id }, e); });
      b.innerHTML = icon('star', 14, { weight: 2.2 }); b.append(el('span', '', m.name), el('small', '', whole(m.macros[0]) + ' kcal'));
      b.dataset.slotMeal = slot.id; b.dataset.myMeal = m.id; b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', (on ? 'Remove ' : 'Log ') + 'my meal ' + m.name + ', ' + macroWords(m.macros));
      longPress(b, () => myMealSheet(slot, m));
      row.append(b);
    }
    const custom = button('ch-pill ch-pill--custom', () => window.CHADBuilder?.open(slot.id));
    custom.innerHTML = icon('plus', 15, { weight: 2.6 }); custom.append('Custom ' + slot.name.toLowerCase()); custom.dataset.custom = slot.id; custom.setAttribute('aria-label', 'Custom ' + slot.name.toLowerCase() + ': build it from foods');
    row.append(custom);
    return row;
  }
  // A saved meal, long-pressed: what is in it, Log, and Remove from my meals (Undo in the toast).
  function myMealSheet(slot, m) {
    const nodes = [window.CHADUX.macroTiles(m.macros)];
    if (m.parts?.length) { const list = el('ul', 'ch-bullets'); m.parts.forEach(p => list.append(el('li', '', [p.name, p.amount].filter(Boolean).join(' · ')))); nodes.push(list); }
    nodes.push(button('ch-btn ch-btn--block ch-btn--gold', () => { window.CHADUX.closeSheets(); choose(slot, { tier: 'C', title: m.name, macros: m.macros, source: 'custom', parts: m.parts, mark: m.id }); }, 'Log to ' + slot.name.toLowerCase()),
      button('ch-btn ch-btn--block ch-btn--danger', () => { window.CHADUX.closeSheets(); forgetMyMeal(m); }, 'Remove from my meals'));
    window.CHADUX.detail(m.name, nodes);
  }
  // Water: one tap adds a 500 mL bottle (again and again, even past the goal). Undo takes it back. Big when it is the
  // thing to do now; a chip in Later today the rest of the day.
  function waterButton(d, key, big) {
    const amount = d.water || 0, target = waterGoal(key), full = amount >= target, most = target + 2, streak = waterStreak(current, dayKey()), left = Math.max(0, target - amount);
    const add = button('water-row ch-water' + (big ? ' ch-water--big' : ' ch-water--chip') + (full ? ' is-full' : ''), e => {
      if (slip('water-' + key, e) || settling(e)) return;
      if (amount >= most) { M()?.haptic('warn'); api.message('That is a lot of water for one day. Set the exact amount in Settings.'); return; }
      const next = Math.round(Math.min(most, amount + .5) * 10) / 10;
      M()?.mark(`.bottle[data-water="${Math.min(Math.ceil(target / .5) - 1, Math.floor(amount / .5))}"]`, full ? null : 'just-on');
      if (!full && next >= target) M()?.mark('.water-row', 'just-on');
      update({ water: next }, { key, positive: true, label: !full && next >= target ? 'Water goal hit' : '500 mL water' });
    });
    add.dataset.water = '';
    add.setAttribute('aria-label', 'Add 500 mL water. ' + fmt(amount) + ' of ' + fmt(target) + ' L' + (full ? ', goal hit' : ', ' + fmt(left) + ' L to go') + (streak ? '. ' + streak + ' day water streak' : ''));
    const total = el('span', 'water-total ch-water__val'); total.innerHTML = fmt(amount) + '<small> / ' + fmt(target) + ' L</small>';
    const goalText = el('span', 'ch-water__goal', full ? 'Goal hit' + (amount > target ? ' · +' + fmt(amount - target) + ' L' : '') : fmt(left) + ' L to go');
    if (big) {
      const bottles = el('span', 'bottles ch-bottles'); bottles.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < Math.ceil(target / .5); i++) { const b = el('i', 'bottle ch-bottle' + (amount > i * .5 ? ' filled' : '')); b.dataset.water = String(i); b.style.setProperty('--fill', Math.max(0, Math.min(1, (amount - i * .5) / .5))); bottles.append(b); }
      const plus = el('span', 'ch-water__tap'); plus.innerHTML = icon('plus', 22, { weight: 2.8 }); plus.append('500 mL');
      const flame = el('span', 'ch-water__streak'); if (streak) { flame.innerHTML = icon('flame', 14); flame.append(streak + (streak === 1 ? ' day' : ' days')); }
      const top = el('span', 'ch-water__top'); top.append(total, flame);
      add.append(top, bottles, goalText, plus);
    } else {
      const drop = el('span', 'ch-water__drop'); drop.innerHTML = icon('drop', 18, { weight: 2.2 });
      const words = el('span', 'ch-water__words'); words.append(total, goalText);
      const plus = el('span', 'ch-water__plus'); plus.innerHTML = icon('plus', 16, { weight: 2.8 }); plus.append('500');
      add.append(drop, words, plus);
    }
    return add;
  }
  function nowWater(d, key) { return [head('Now', 'Water'), waterButton(d, key, true)]; }
  // v12: the water card on Today. The whole card is one button: +500 mL a tap (Undo in the toast), a pip per bottle.
  function waterCard(d, key) {
    const amount = d.water || 0, target = waterGoal(key), full = amount >= target, most = target + 2, left = Math.max(0, target - amount), streak = waterStreak(current, dayKey());
    const card = button('water-row ch-watercard' + (full ? ' is-full' : ''), e => {
      if (slip('water-' + key, e) || settling(e)) return;
      if (amount >= most) { M()?.haptic('warn'); api.message('That is a lot of water for one day. Set the exact amount in Settings.'); return; }
      const next = Math.round(Math.min(most, amount + .5) * 10) / 10;
      M()?.mark('.ch-watercard', 'just-on');
      update({ water: next }, { key, positive: true, label: !full && next >= target ? 'Water goal hit' : '500 mL water' });
    });
    card.id = 'water12'; card.dataset.water = '';
    card.setAttribute('aria-label', 'Add 500 mL water. ' + fmt(amount) + ' of ' + fmt(target) + ' L' + (full ? ', goal hit' : ', ' + fmt(left) + ' L to go') + (streak ? '. ' + streak + ' day water streak' : ''));
    const drop = el('span', 'ch-watercard__icon'); drop.innerHTML = icon('drop', 22, { weight: 2.2 });
    const words = el('span', 'ch-watercard__words'), value = el('b', 'ch-watercard__val'); value.id = 'water12-value';
    value.append(fmt(amount), el('small', '', ' / ' + fmt(target) + ' L'));
    words.append(el('span', 'ch-watercard__k', 'Water'), value);
    const plus = el('span', 'ch-watercard__plus'); plus.innerHTML = icon('plus', 20, { weight: 2.8 });
    const pips = el('span', 'ch-watercard__pips'); pips.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.ceil(target / .5); i++) { const p = el('i', amount >= (i + 1) * .5 - 1e-9 ? 'is-on' : amount > i * .5 ? 'is-half' : ''); pips.append(p); }
    const note = el('span', 'ch-watercard__note', full ? 'Goal hit' + (amount > target ? ' · +' + fmt(amount - target) + ' L' : '') : '+500 mL a tap · ' + fmt(left) + ' L to go');
    card.append(drop, words, plus, pips, note);
    return card;
  }
  // Today's session. Gym days: what it is and one big Start (Resume mid-workout; a summary once done). Wednesday: Muay
  // Thai at 6:30 with one Done. Sunday: rest, and the walk as one Done.
  const sessionIcon = s => s.kind === 'class' ? 'glove' : s.kind === 'rest' ? 'walk' : 'dumbbell';
  function startButton(key, s, sum, p, label) {
    const go = button('ch-btn ch-btn--go ch-btn--block', e => { if (!settling(e)) window.CHADGym?.start(key); });
    go.dataset.gymStart = key; go.innerHTML = '<svg class="ch-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
    go.append(el('span', '', sum.live ? 'Resume' : label || 'Start'));
    if (sum.live) go.append(el('small', '', p.done + ' of ' + p.total + ' sets'));
    go.setAttribute('aria-label', (sum.live ? 'Resume ' : 'Start ') + s.name + (sum.live ? ', ' + p.done + ' of ' + p.total + ' sets done' : ', ' + s.ex.length + ' exercises'));
    return go;
  }
  function nowSession(state, key, d, s) {
    const sum = CHADTrain.summary(state, key), p = CHADTrain.progress(state, key), isToday = key === dayKey(), out = [];
    const when = s.kind === 'gym' ? 'Now · 4–6 pm' : s.kind === 'class' ? 'Tonight · ' + s.time : 'Today · rest day';
    out.push(head(isToday ? when : shortDate(key), s.name, s.kind === 'gym' ? s.ex.length + ' exercises · ' + s.minutes + ' min · then ' + s.cardioShort : s.kind === 'class' ? s.focus : s.cardio));
    if (s.deload) { const tag = el('p', 'ch-deload ch-deload--sm'); tag.innerHTML = icon('leaf', 16); tag.append(s.kind === 'class' ? 'Deload week · Muay Thai easy' : 'Deload week · half the sets'); out.push(tag); }
    if (s.kind === 'gym') {
      // One ring for the sets (the Gym tab lists the exercises); then one big Start at thumb height.
      const ring = el('div', 'ch-ring ch-now__ring' + (sum.done ? ' is-done' : '')); ring.style.setProperty('--p', sum.done ? 100 : p.total ? p.done / p.total * 100 : 0);
      ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', sum.done ? 'Done' : p.done + ' of ' + p.total + ' sets');
      if (sum.done) ring.innerHTML = icon('check', 44, { weight: 3 }); else ring.append(el('strong', '', p.done ? p.done + '/' + p.total : String(p.total)), el('small', '', 'SETS'));
      out.push(ring);
      if (isToday) out.push(startButton(key, s, sum, p));
      else if (key < dayKey() && !sum.live) out.push(markDone(key, s));
    } else {
      const glyph = el('div', 'ch-now__glyph'); glyph.innerHTML = icon(sessionIcon(s), 52, { weight: 1.7 }); out.push(glyph);
      const chips = el('div', 'ch-done-row ch-now__done');
      chips.append(s.kind === 'class' ? doneChip('training', 'Muay Thai done', 'glove', key, 'Muay Thai') : doneChip('cardio', 'Walk done', 'walk', key, 'Walk'));
      out.push(chips);
    }
    return out;
  }
  const markDone = (key, s) => { const b = button('quest-chip ch-done ch-done--wide', e => { if (!slip('session-' + key, e) && !settling(e)) toggleSession(key); }); const on = !!daily(current, key).training; b.dataset.quest = 'training'; b.setAttribute('aria-pressed', String(on)); const disc = el('span', 'ch-done__icon'); disc.innerHTML = icon('check', 18, { weight: 2.6 }); b.append(disc, el('span', 'ch-done__label', on ? s.name + ' done' : 'Mark done')); return b; };
  // One-tap done chips (cardio, steps, sleep, Hydralyte, Muay Thai, the walk): on and off, Undo in the toast.
  function doneChip(field, label, glyph, key, name) {
    const on = !!daily(current, key)[field];
    const b = button('quest-chip ch-done', e => {
      if (slip('quest-' + key + field, e) || settling(e)) return;
      M()?.mark(`#today [data-quest="${field}"], #training [data-quest="${field}"]`, on ? 'just-off' : 'just-on');
      if (field === 'training') toggleSession(key); else toggleQuest(field, name || label, key);
    });
    const disc = el('span', 'ch-done__icon'); disc.innerHTML = icon(glyph, 20, { weight: 2 });
    b.append(disc, el('span', 'ch-done__label', label));
    b.dataset.quest = field; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', label);
    return b;
  }
  function daySum(state, key, d) {
    const g = goals(state, key), line = el('p', 'ch-wrap__sum');
    line.append(el('b', '', whole(d.totals[0])), ' / ' + whole(g.target) + ' kcal · ', el('b', '', whole(d.totals[1]) + ' g'), ' protein · ', el('b', '', fmt(d.water || 0) + ' L'));
    return line;
  }
  // The evening, with everything logged: how the day went in one line, and the last few one-tap habits.
  function nowWrap(state, key, d) {
    const chips = el('div', 'ch-done-grid');
    for (const [field, label, glyph, name] of WRAP) chips.append(doneChip(field, label, glyph, key, name));
    return [head(key === dayKey() ? 'Now' : shortDate(key), 'Wrap-up'), daySum(state, key, d), chips];
  }
  function nowDone(state, key, d) {
    const badge = el('div', 'ch-now__trophy'); badge.innerHTML = icon('check-circle', 44, { weight: 1.8 });
    return [head(key === dayKey() ? 'Today' : shortDate(key), 'All done', key === dayKey() ? 'Nothing left to do now.' : 'Every meal is in.'), badge, daySum(state, key, d)];
  }
  // Later today: one quiet row. Water is one tap on it; the rest of the day folds open in place.
  function laterBlock(state, key, d, s, now) {
    const box = el('section', 'ch-later'), row = el('div', 'ch-later__row'), isToday = key === dayKey();
    box.id = 'later'; box.setAttribute('aria-label', isToday ? 'Later today' : 'Rest of the day');
    const items = laterItems(state, key, d, s, now);
    const toggle = button('ch-later__toggle', e => { if (slip('later-' + key, e)) return; laterOpen = !laterOpen; M()?.haptic('tap'); api.refresh(); if (laterOpen) M()?.pulse($('later-more'), 'is-opening', 420); });
    toggle.id = 'later-toggle'; toggle.setAttribute('aria-expanded', String(laterOpen)); toggle.setAttribute('aria-controls', 'later-more');
    const words = el('span', 'ch-later__words'); words.append(el('b', '', isToday ? 'Later today' : 'Rest of the day'), el('small', '', items.summary || 'All in'));
    toggle.append(words); toggle.insertAdjacentHTML('beforeend', icon(laterOpen ? 'chevron-up' : 'chevron-down', 16, { weight: 2.4, cls: 'ch-later__chev' }));
    toggle.setAttribute('aria-label', (isToday ? 'Later today' : 'Rest of the day') + ': ' + (items.summary || 'all in') + (laterOpen ? '. Hide' : '. Show'));
    row.append(toggle);
    const more = el('div', 'ch-later__more'); more.id = 'later-more'; more.hidden = !laterOpen;
    if (laterOpen) more.append(...items.nodes);
    box.append(row, more);
    return box;
  }
  function laterItems(state, key, d, s, now) {
    const nodes = [], words = [], isToday = key === dayKey();
    // The session, unless it is the thing to do now.
    if (now.id !== 'session') {
      const sum = CHADTrain.summary(state, key), p = CHADTrain.progress(state, key), finished = s.kind === 'rest' ? !!d.cardio : sum.done;
      const card = el('div', 'ch-later__session' + (finished ? ' is-done' : '')), info = el('div', 'ch-later__info'), glyph = el('span', 'ch-cell__icon'); glyph.innerHTML = icon(sessionIcon(s), 17, { weight: 2.1 });
      const status = finished ? (s.kind === 'rest' ? 'Walk done' : sum.minutes ? 'Done · ' + sum.minutes + ' min' : 'Done') : sum.live ? p.done + ' of ' + p.total + ' sets' : s.kind === 'gym' ? s.ex.length + ' exercises · 4–6 pm' : s.kind === 'class' ? s.time : s.cardio;
      info.append(glyph, el('span', 'ch-later__name', s.name), el('small', '', status));
      card.append(info);
      if (s.kind === 'gym') { if (isToday && !sum.done) card.append(startButton(key, s, sum, p)); else if (key < dayKey() && !sum.live) card.append(markDone(key, s)); }
      else if (key <= dayKey()) card.append(s.kind === 'class' ? doneChip('training', 'Muay Thai done', 'glove', key, 'Muay Thai') : doneChip('cardio', 'Walk done', 'walk', key, 'Walk'));
      if (!finished) words.push(s.kind === 'gym' ? s.name + ' 4 pm' : s.kind === 'class' ? 'Muay Thai 6:30' : 'Walk');
      nodes.push(card);
    }
    // Every meal but the one on top: its three options in place (tap the logged one to remove it), and + Custom.
    for (const slot of CHADPlan) {
      if (now.id === 'meal' && now.slot.id === slot.id) continue;
      const { picked, label, kcal } = logged(state, slot, d, key), block = el('div', 'ch-later__meal meal-slot' + (picked ? ' is-logged' : ''));
      block.dataset.laterSlot = slot.id;
      const h = el('div', 'ch-later__mealhead'), status = el('span', 'ch-later__status');
      if (picked) { status.innerHTML = icon('check', 14, { weight: 2.8 }); status.append(label + (kcal == null ? '' : ' · ' + whole(kcal) + ' kcal')); } else status.append(slot.time);
      h.append(el('span', 'ch-later__name', slot.name), status);
      const list = el('div', 'ch-later__opts');
      slot.choices.forEach(c => list.append(compact(slot, c, key, picked)));
      const custom = button('ch-pill ch-pill--custom', () => window.CHADBuilder?.open(slot.id)); custom.innerHTML = icon('plus', 15, { weight: 2.6 }); custom.append('Custom'); custom.dataset.custom = slot.id; custom.setAttribute('aria-label', 'Custom ' + slot.name.toLowerCase() + ': build it from foods');
      for (const m of myMeals(state, slot.id).slice(-2).reverse()) {
        const on = picked === 'C' && state.entries.some(e => e.day === key && e.planSlot === slot.id && e.name === m.name && e.kcal === m.macros[0]);
        const b = button('ch-pill ch-pill--mine', e => { if (!slip('mine-' + key + m.id, e)) choose(slot, { tier: 'C', title: m.name, macros: m.macros, source: 'custom', parts: m.parts, mark: m.id }, e); });
        b.innerHTML = icon('star', 14, { weight: 2.2 }); b.append(el('span', '', m.name), el('small', '', whole(m.macros[0]) + ' kcal')); b.dataset.slotMeal = slot.id; b.dataset.myMeal = m.id; b.setAttribute('aria-pressed', String(on));
        list.append(b);
      }
      list.append(custom);
      block.append(h, list);
      if (!picked && !(slot.id === 'P')) words.push(slot.name);
      nodes.push(block);
    }
    // The wrap-up habits (cardio on gym days), unless they are the thing to do now.
    if (now.id !== 'wrap') {
      const chips = el('div', 'ch-done-grid ch-later__wrap');
      if (s.kind === 'gym' && s.id !== 'legs') chips.append(doneChip('cardio', s.cardioShort || s.cardio, 'run', key, 'Cardio'));
      for (const [field, label, glyph, name] of WRAP) chips.append(doneChip(field, label, glyph, key, name));
      nodes.push(chips);
      if (WRAP.some(([f]) => !d[f])) words.push('Wrap-up');
    }
    return { nodes, summary: words.join(' · ') };
  }
  // A meal's option in Later today: one line, one tap (tap the logged one to remove it).
  function compact(slot, c, key, picked) {
    const selected = picked === c.tier, b = button('meal-pick ch-row-pick ch-row-pick--' + TIER_CLASS[c.tier] + (selected ? ' is-logged' : ''), e => { if (!slip('meal-' + key + slot.id + c.tier, e) && !settling(e)) pick(slot, c.tier, e); });
    b.dataset.slot = slot.id; b.dataset.tier = c.tier; b.setAttribute('aria-pressed', String(selected));
    b.setAttribute('aria-label', (selected ? 'Remove ' : picked ? 'Switch to ' : 'Log ') + TIER[c.tier] + ' ' + slot.name + ': ' + c.title + ', ' + macroWords(c.macros));
    const name = el('span', 'ch-row-pick__name'); if (c.pinned) { const pin = el('span', 'ch-opt__pin'); pin.innerHTML = icon('star', 13, { weight: 2.2 }); name.append(pin); } name.append(c.title);
    b.append(el('span', 'ch-row-pick__dot'), name, el('span', 'ch-row-pick__kcal', whole(c.macros[0]) + ' kcal'));
    longPress(b, () => mealSheet(slot, c.tier));
    return b;
  }
  // Quick log: the favourites, one tap each (again for a second one), Reset/Bulk add-ons, and + Food for anything else.
  function quickBlock(state, key) {
    const box = el('section', 'ch-quick'), row = el('div', 'ch-quick__row'), p = phase(state, key);
    box.id = 'quick'; box.append(el('h2', 'ch-eyebrow ch-quick__h', 'Quick log'), row);
    for (const fav of window.CHADFavourites || []) {
      const n = state.entries.filter(e => e.day === key && e.fav === fav.id).length;
      const b = button('ch-fav', e => { if (slip('fav-' + key + fav.id, e)) return; api.logFavourite(fav, key); });
      const star = el('span', 'ch-fav__star'); star.innerHTML = icon('star', 16, { weight: 2.2 });
      b.append(star, el('span', 'ch-fav__name', fav.short || fav.name), el('small', 'ch-fav__kcal', whole(fav.macros[0]) + ' kcal'));
      if (n) b.append(el('span', 'ch-fav__count', '×' + n));
      b.dataset.fav = fav.id; b.setAttribute('aria-label', 'Log ' + fav.name + ', ' + macroWords(fav.macros) + (n ? '. Logged ' + n + (n === 1 ? ' time' : ' times') + ' today' : ''));
      row.append(b);
    }
    for (const [id, name, m] of ADDONS[p[0]] || []) {
      const eid = 'addon-' + key + '-' + id, has = state.entries.some(e => e.id === eid);
      const b = button('ch-fav ch-fav--addon' + (has ? ' is-on' : ''), e => {
        if (slip(eid, e)) return;
        const index = current.entries.findIndex(x => x.id === eid), old = current.entries[index], on = index >= 0;
        const entry = { id: eid, day: key, name, kcal: m[0], protein: m[1], carbs: m[2], fat: m[3], source: 'addon', meal: 'Snacks' };
        M()?.mark(`#quick [data-addon="${id}"]`, on ? 'just-off' : 'just-on');
        api.change({ label: name + (on ? ' removed' : ' logged'), kind: on ? 'off' : 'on', positive: !on, day: key, onApply: on ? null : () => chime(),
          forward: s => ({ ...s, entries: on ? s.entries.filter(x => x.id !== eid) : [...s.entries.filter(x => x.id !== eid), entry] }),
          backward: s => ({ ...s, entries: on ? api.restoreAt(s.entries.filter(x => x.id !== eid), [{ e: old, i: index }]) : s.entries.filter(x => x.id !== eid) }) });
      });
      b.append(el('span', 'ch-fav__name', name), el('small', 'ch-fav__kcal', m[0] + ' kcal'));
      b.dataset.addon = id; b.setAttribute('aria-pressed', String(has)); b.setAttribute('aria-label', p[1] + ' add-on: ' + name + ', ' + m[0] + ' kcal');
      row.append(b);
    }
    const addFood = button('ch-fav ch-fav--add', () => window.CHADBuilder?.open(null));
    addFood.id = 'add-food'; addFood.innerHTML = icon('plus', 18, { weight: 2.6 }); addFood.append(el('span', 'ch-fav__name', 'Food')); addFood.setAttribute('aria-label', 'Add other food: recent, favourites, search, AI, barcode or type it in');
    row.append(addFood);
    return box;
  }

  /* ---- Gym: Perfect Week v1. The day's session with each exercise's prescription and last set, Start (today),
     Mark done, cardio, then the rest of the week and the plan's rules. ---- */
  function exerciseSheet(e, key) {
    const rec = CHADTrain.records(current).find(r => r.name === e.name), top = CHADTrain.last(current, e.name, key), list = CHADTrain.index(current).get(e.name) || [];
    const nodes = [el('p', 'ch-hint', CHADTrain.rx(e) + (e.kind === 'time' ? '' : ' reps') + ' · rest ' + CHADTrain.restText(e.rest) + (e.kind === 'bw' ? ' · bodyweight, add kg when it gets easy' : ''))];
    nodes.push(note('lightbulb', CHADTrain.hint(e, top)));
    if (rec) { const best = el('div', 'ch-best'); best.append(el('span', '', 'Best set'), el('b', '', (rec.kg > 0 ? CHADTrain.kgText(rec.kg) + ' kg × ' : '') + rec.reps + (rec.kg > 0 ? ' · e1RM ' + CHADTrain.kgText(rec.e1rm) + ' kg' : ' reps'))); nodes.push(best); }
    const days = [...new Set(list.map(s => s.key))].slice(-5).reverse();
    if (days.length) {
      const hist = el('ul', 'ch-list ch-history');
      for (const k of days) { const li = el('li', 'ch-cell'); li.append(el('span', 'ch-cell__title', shortDate(k)), el('span', 'ch-cell__status', list.filter(s => s.key === k).map(s => (s.kg > 0 ? CHADTrain.kgText(s.kg) + '×' : '') + s.reps).join('  '))); hist.append(li); }
      nodes.push(hist);
    }
    window.CHADUX.detail(e.name, nodes);
  }
  const statusOf = (doneNow, text) => { const st = el('span', 'ch-cell__status'); if (doneNow) st.innerHTML = icon('check', 15, { weight: 2.8 }); st.append(el('span', '', text)); return st; };
  function renderTraining(state, key) {
    const box = $('training-content'); box.replaceChildren();
    const s = CHADTrain.plan(key), today = dayKey(), d = daily(state, key), sum = CHADTrain.summary(state, key), w = d.workout, isToday = key === today;
    if (s.deload) { const banner = el('div', 'deload ch-deload'); banner.innerHTML = icon('leaf', 20); banner.append(el('span', '', s.kind === 'class' ? 'Deload week · Muay Thai easy' : 'Deload week · half the sets, same weights')); box.append(banner); }
    const card = el('section', 'training-level ch-session is-today' + (sum.done ? ' is-done' : '')); card.dataset.day = key;
    const top = el('div', 'ch-session__head'), text = el('div', 'ch-grow'), p = CHADTrain.progress(state, key);
    text.append(el('p', 'ch-eyebrow', (isToday ? 'Today · ' : '') + DOW[weekday(key)] + (s.kind === 'gym' ? ' · ' + s.minutes + ' min' : s.kind === 'class' ? ' · ' + s.time : '')), el('h2', 'ch-session__name', s.name), el('p', 'ch-session__focus', s.focus));
    const ring = el('div', 'ch-ring'); ring.style.setProperty('--p', sum.done ? 100 : p.total ? p.done / p.total * 100 : 0); ring.setAttribute('role', 'img');
    ring.setAttribute('aria-label', sum.done ? 'Done' : p.total ? p.done + ' of ' + p.total + ' sets' : 'Not done yet');
    if (sum.done) ring.innerHTML = icon('check', 22, { weight: 3 }); else ring.append(el('strong', '', p.total ? p.done + '/' + p.total : '–'));
    top.append(text, ring); card.append(top);
    if (s.kind === 'gym') s.ex.forEach((e, j) => {
      const r = el('div', 'exercise ch-ex'), sets = CHADTrain.setsFor(w, e.name).length, latest = CHADTrain.last(state, e.name, '9999-12-31');
      const b = button('exercise-row ch-ex__hit', () => exerciseSheet(e, key));
      const check = el('span', 'ch-ex__check' + (sets >= e.sets || sum.done ? ' is-done' : sets ? ' is-part' : '')); check.style.setProperty('--p', Math.min(1, sets / e.sets));
      const words = el('span', 'ch-ex__words'); words.append(el('span', 'ch-ex__name', e.name), el('span', 'ch-ex__meta', CHADTrain.rx(e) + ' · rest ' + CHADTrain.restText(e.rest)));
      b.append(check, words);
      if (latest && e.kind !== 'time') b.append(el('span', 'ch-ex__set', (latest.kg > 0 ? CHADTrain.kgText(latest.kg) + '×' : '') + latest.reps));
      b.insertAdjacentHTML('beforeend', icon('chevron', 14, { weight: 2.4, cls: 'ch-ex__chev' }));
      b.dataset.exercise = String(j); b.setAttribute('aria-label', e.name + ', ' + CHADTrain.rx(e) + (sets ? ', ' + sets + ' sets logged' : '') + (latest && e.kind !== 'time' ? ', last ' + (latest.kg > 0 ? CHADTrain.kgText(latest.kg) + ' kg for ' : '') + latest.reps : '') + '. Details');
      r.append(b); card.append(r);
    });
    else s.items.forEach(item => { const r = el('div', 'exercise ch-ex ch-ex--item'); r.append(el('span', 'ch-ex__dot'), el('span', 'ch-ex__name', item)); card.append(r); });
    const actions = el('div', 'ch-session__all');
    if (s.kind === 'gym' && isToday && !sum.done) actions.append(startButton(key, s, sum, p, 'Start workout'));
    // A finished workout is its own record (Undo takes it back); "Mark done" is for a session done without logging sets.
    if (key <= today && !sum.live && !w?.end) actions.append(s.kind === 'class' ? doneChip('training', 'Muay Thai done', 'glove', key, 'Muay Thai') : s.kind === 'rest' ? doneChip('cardio', 'Walk done', 'walk', key, 'Walk') : markDone(key, s));
    if (key <= today && s.kind === 'gym' && s.id !== 'legs') actions.append(doneChip('cardio', 'Then ' + s.cardio, 'run', key, 'Cardio'));
    if (actions.children.length) card.append(actions);
    if (s.note) { const foot = el('div', 'cardio-note ch-session__foot'); foot.innerHTML = icon('lightbulb', 16); foot.append(el('p', '', s.note)); card.append(foot); }
    box.append(card);
    const head2 = el('div', 'ch-section'); head2.append(el('h2', 'ch-h', 'This week'));
    const rows = el('section', 'ch-list ch-rows week-rows'); rows.setAttribute('aria-label', 'Rest of the week');
    const start = monday(key);
    for (const j of [1, 2, 3, 4, 5, 6, 0]) {
      if (j === weekday(key)) continue;
      const k = shift(start, (j + 6) % 7), other = CHADTrain.plan(k), info = CHADTrain.summary(state, k), pp = CHADTrain.progress(state, k);
      const r = button('training-row ch-cell' + (info.done ? ' is-done' : ''), () => window.CHADUX.goTo(k)), title = el('span', 'ch-cell__title');
      r.dataset.day = k; title.append(el('small', '', k === today ? 'Today' : DOW[j]), other.name);
      const status = info.done ? statusOf(true, info.minutes ? info.minutes + ' min' : 'Done') : statusOf(false, info.live ? pp.done + ' of ' + pp.total + ' sets' : other.kind === 'gym' ? other.ex.length + ' exercises' : other.kind === 'class' ? other.time : 'Walk');
      r.append(title, status); r.insertAdjacentHTML('beforeend', icon('chevron', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      r.setAttribute('aria-label', (k === today ? 'Today, ' : '') + DOW[j] + ', ' + other.name + ', ' + (info.done ? 'done' : 'not done yet') + '. Open this day');
      rows.append(r);
    }
    const plan = el('details', 'ch-disclosure ch-plan'), deloads = CHADTrain.DELOADS.map(([a, b]) => dayMonth(a) + '–' + dayMonth(b)).join(', ');
    plan.append(el('summary', '', 'Plan and rules'));
    for (const [glyph, label, value] of [['clock', 'Gym', '4–6 pm Darwin, cardio straight after'], ['target', 'Focus', CHADTrain.FOCUS.replace(/ · /g, ', ')], ['dumbbell', 'Rules', CHADTrain.RULES.join(' ')], ['leaf', 'Deloads', 'Half the sets, same weights, Muay Thai easy: ' + deloads], ['calendar', 'Next', 'Perfect Week v2 review on ' + shortDate(CHADTrain.REVIEW)]]) {
      const line = el('p', 'ch-plan__line'), disc = el('span', 'ch-plan__icon'); disc.innerHTML = icon(glyph, 16, { weight: 2.1 }); line.append(disc, el('b', '', label), el('span', '', value)); plan.append(line);
    }
    const planList = el('div', 'ch-list'); planList.append(plan);
    box.append(head2, rows, planList);
  }

  /* ---- Progress: the streaks, workouts, records and four charts ---- */
  function workoutSheet(key) {
    const sum = CHADTrain.summary(current, key), w = current.questsV5?.[key]?.workout, nodes = [];
    const tiles = el('div', 'ch-macros ch-macros--3');
    for (const [v, k] of [[sum.volume ? whole(sum.volume) : '–', 'kg volume'], [sum.minutes ? String(sum.minutes) : '–', 'minutes'], [String(sum.sets), 'sets']]) { const t = el('div', 'ch-macros__item'); t.append(el('b', '', v), el('span', '', k)); tiles.append(t); }
    nodes.push(tiles);
    if (sum.prs.length) { const prs = el('ul', 'ch-bullets'); sum.prs.forEach(r => prs.append(el('li', '', 'PR · ' + r.name + ': ' + (r.kg > 0 ? CHADTrain.kgText(r.kg) + ' kg × ' : '') + r.reps + (r.kg > 0 ? '' : ' reps')))); nodes.push(prs); }
    const names = [...new Set((w?.sets || []).map(s => s.x))];
    if (names.length) {
      const list = el('ul', 'ch-list ch-history');
      for (const n of names) { const li = el('li', 'ch-cell'); li.append(el('span', 'ch-cell__title', n), el('span', 'ch-cell__status', CHADTrain.setsFor(w, n).map(s => (s.kg > 0 ? CHADTrain.kgText(s.kg) + '×' : '') + s.reps).join('  '))); list.append(li); }
      nodes.push(list);
    } else nodes.push(el('p', 'ch-hint', 'Marked done without sets.'));
    window.CHADUX.detail(sum.name + ' · ' + shortDate(key), nodes);
  }
  function empty(list, glyph, title, text) { const li = el('li', 'ch-empty'); li.innerHTML = icon(glyph, 32); li.append(el('strong', '', title), el('span', '', text)); list.append(li); }
  function renderWorkouts(state) {
    const list = $('workouts'), all = CHADTrain.workouts(state, dayKey()); list.replaceChildren();
    $('workout-count').textContent = all.length ? all.length + (all.length === 1 ? ' session' : ' sessions') : '';
    if (!all.length) return empty(list, 'dumbbell', 'No workouts yet', 'Start one from Today, 4–6 pm.');
    for (const w of all.slice(0, workoutsShown)) {
      const li = el('li', 'entry'), b = button('ch-cell workout-row' + (w.prs.length ? ' has-pr' : ''), () => workoutSheet(w.key)), title = el('span', 'ch-cell__title');
      const when = el('small', '', shortDate(w.key)); if (w.prs.length) when.append(el('span', 'ch-pr', w.prs.length === 1 ? 'PR' : w.prs.length + ' PRs'));
      b.dataset.workout = w.key; title.append(when, el('span', 'ch-cell__name', w.name));
      const status = el('span', 'ch-cell__status'); status.append(el('span', '', w.sets ? [whole(w.volume) + ' kg', w.minutes && w.minutes + ' min'].filter(Boolean).join(' · ') : 'Marked done'));
      b.append(title, status); b.insertAdjacentHTML('beforeend', icon('chevron', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      b.setAttribute('aria-label', shortDate(w.key) + ', ' + w.name + ', ' + (w.sets ? whole(w.volume) + ' kg volume' + (w.minutes ? ', ' + w.minutes + ' minutes' : '') : 'marked done') + (w.prs.length ? ', ' + w.prs.length + ' personal records' : '') + '. Details');
      li.append(b); list.append(li);
    }
    if (all.length > workoutsShown) { const li = el('li', 'entry entry--more'); li.append(button('ch-link ch-link--center', () => { workoutsShown += 8; renderWorkouts(current); }, 'Show ' + Math.min(8, all.length - workoutsShown) + ' more')); list.append(li); }
  }
  function renderRecords(state) {
    const list = $('records'), all = CHADTrain.records(state); list.replaceChildren();
    $('pr-count').textContent = all.length ? all.length + (all.length === 1 ? ' exercise' : ' exercises') : '';
    if (!all.length) return empty(list, 'trophy', 'No records yet', 'Your best set for each exercise shows here.');
    // v12: the six most recent records; the rest one tap away.
    const shown = recordsAll ? all : all.slice().sort((a, b) => String(b.key || '').localeCompare(String(a.key || ''))).slice(0, 6);
    for (const r of shown) {
      const li = el('li', 'ch-cell record-row'), value = el('span', 'ch-cell__status');
      value.append(el('b', '', (r.kg > 0 ? CHADTrain.kgText(r.kg) + ' kg × ' : '') + r.reps + (r.kg > 0 ? '' : ' reps')), el('small', '', r.kg > 0 ? 'e1RM ' + CHADTrain.kgText(r.e1rm) : 'bodyweight'));
      li.dataset.record = r.name; li.append(el('span', 'ch-cell__title', r.name), value); list.append(li);
    }
    if (all.length > 6) {
      const li = el('li', 'entry entry--more'), more = button('ch-link ch-link--center', () => { recordsAll = !recordsAll; M()?.haptic('tap'); renderRecords(current); }, recordsAll ? 'Show fewer' : 'Show all ' + all.length);
      more.id = 'records-toggle'; more.setAttribute('aria-expanded', String(recordsAll)); li.append(more); list.append(li);
    }
  }
  function chartCard(title, kpi, points, color, kind) {
    const card = el('section', 'ch-card chart-card'), top = el('div', 'chart-card__head'), chart = el('div', 'ch-chart');
    top.append(el('h2', '', title), el('span', '', kpi || '')); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', title + (kpi ? ', ' + kpi : ''));
    card.append(top, chart);
    if (!points.some(p => p.value)) card.append(el('p', 'ch-hint', 'No data yet'));
    // Keep every daily value and goal available to screen readers and offline users.
    const values = el('details', 'chart-values'); values.append(el('summary', '', 'Daily values'));
    points.forEach(p => values.append(el('p', 'ch-hint', p.key + ': ' + (p.value == null ? 'No entry' : fmt(p.value)) + (p.goal ? ' / ' + fmt(p.goal) : ''))));
    card.append(values);
    const step = Math.ceil(points.length / 7), data = points.map((p, i) => ({ label: (points.length - 1 - i) % step === 0 ? Number(p.key.slice(8)) + (points.length > 7 ? '/' + Number(p.key.slice(5, 7)) : '') : '', value: p.value }));
    card.paint = animate => kind === 'bar'
      ? CHADCharts.barsVsGoal(chart, data, points.at(-1).goal, { color, overColor: '--ch-orange', goals: points.map(p => p.goal), highlight: points.length - 1, animate: !!animate })
      : CHADCharts.line(chart, data, { color, unit: kind === 'weight' ? 'kg' : 'g', whole: kind !== 'weight', animate: !!animate });
    return card;
  }
  const mean = (values, digits = 0) => { const v = values.filter(x => typeof x === 'number' && x > 0); return v.length ? fmt(Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10 ** digits) / 10 ** digits) : null; };
  // v12: daily macro averages over the days with food logged in the range (an empty day is not a 0 g day), against
  // the goals of the day in view.
  function macroAverages(state, data, key) {
    const logged = data.filter(x => x.d.totals[0] > 0), g = goals(state, key), card = el('section', 'ch-card ch-avg');
    card.id = 'macro-averages12';
    const head = el('div', 'chart-card__head'); head.append(el('h2', '', 'Daily average'), el('span', '', logged.length ? logged.length + (logged.length === 1 ? ' day logged' : ' days logged') : 'No food logged'));
    const row = el('div', 'ch-avg__row');
    [['protein', 'Protein', 1, g.proteinGoal], ['carbs', 'Carbs', 2, g.carbsGoal], ['fat', 'Fat', 3, g.fatGoal]].forEach(([k, name, i, goal]) => {
      const avg = logged.length ? logged.reduce((s, x) => s + x.d.totals[i], 0) / logged.length : 0, item = el('div', 'ch-avg__item ch-avg__item--' + k);
      const value = el('b', ''); value.append(whole(avg), el('small', '', ' g'));
      const bar = el('i', 'ch-avg__bar'); bar.style.setProperty('--p', Math.max(0, Math.min(1, avg / goal)).toFixed(3));
      item.append(value, el('span', '', name + ' · goal ' + whole(goal)), bar);
      item.setAttribute('role', 'img'); item.setAttribute('aria-label', name + ': ' + whole(avg) + ' g a day on average, goal ' + whole(goal) + ' g');
      row.append(item);
    });
    const kcal = logged.length ? logged.reduce((s, x) => s + x.d.totals[0], 0) / logged.length : 0;
    card.append(head, row, el('p', 'ch-avg__kcal', logged.length ? whole(kcal) + ' kcal a day · goal ' + whole(g.target) : 'Log food to see your averages.'));
    return card;
  }
  function renderCharts(state, key) {
    const box = $('charts'), more = $('charts-more'); box.replaceChildren(); more?.replaceChildren();
    const controls = el('div', 'chart-controls ch-seg'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Chart range'); controls.style.setProperty('--n', 2); controls.style.setProperty('--i', chartRange === 7 ? 0 : 1);
    [7, 30].forEach(n => { const b = button('', () => { if (chartRange === n) return; chartRange = n; M()?.haptic('tap'); renderCharts(current, activeKey()); }, n + ' days'); b.setAttribute('aria-pressed', String(chartRange === n)); controls.append(b); });
    box.append(controls);
    const data = Array.from({ length: chartRange }, (_, i) => shift(key, i - chartRange + 1)).map(k => ({ key: k, d: daily(state, k) }));
    const kcal = mean(data.map(x => x.d.totals[0])), protein = mean(data.map(x => x.d.totals[1])), litres = mean(data.map(x => x.d.water), 1);
    const weight = data.map(({ key: k }) => { const values = Array.from({ length: 7 }, (_, i) => daily(state, shift(k, -i)).weight).filter(v => typeof v === 'number' && v > 0); return { key: k, value: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null }; });
    box.append(
      chartCard('Calories', kcal && 'avg ' + kcal + ' kcal', data.map(({ key: k, d }) => ({ key: k, value: d.totals[0], goal: goals(state, k).target })), '--ch-kcal', 'bar'),
      macroAverages(state, data, key));
    (more || box).append(
      chartCard('Protein', protein && 'avg ' + protein + ' g', data.map(({ key: k, d }) => ({ key: k, value: d.totals[1] })), '--ch-protein', 'line'),
      chartCard('Water', litres && 'avg ' + litres + ' L', data.map(({ key: k, d }) => ({ key: k, value: d.water || 0, goal: waterGoal(k) })), '--ch-water', 'bar'),
      ...(weight.some(p => p.value) ? [chartCard('Weight', '7-day average, kg', weight, '--ch-weight', 'weight')] : []));
    paintCharts();
  }
  function paintCharts(animate) { if ($('history').hidden) return; document.querySelectorAll('#history .chart-card').forEach(c => c.paint?.(animate)); CHADCharts.redraw(); }

  /* ---- Settings ---- */
  function applyTheme(value) {
    if (value === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = value;
    const dark = value === 'dark' || value === 'system' && matchMedia('(prefers-color-scheme:dark)').matches;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.content = dark ? '#000000' : '#FFFFFF');
    if (themeShown !== value) { themeShown = value; try { localStorage.setItem('rec-calories-theme', value); } catch { /* only a hint for a flash-free launch */ } }
  }
  function switchRow(id, title, checked, onchange) {
    const row = el('label', 'ch-cell'), control = el('span', 'ch-switch'), input = el('input');
    input.type = 'checkbox'; input.id = id; input.checked = checked; input.setAttribute('role', 'switch'); input.onchange = () => onchange(input.checked);
    control.append(input, el('i')); row.append(el('span', 'ch-cell__title', title), control); return row;
  }
  function numberRow(id, title, unit, attrs) {
    const row = el('label', 'ch-cell'), input = el('input', 'ch-input'); input.id = id; input.type = 'number'; input.inputMode = 'decimal'; Object.assign(input, attrs);
    row.append(el('span', 'ch-cell__title', title), input, el('span', 'ch-cell__unit', unit)); return [row, input];
  }
  function renderSettings(state, key, d) {
    const theme = state.arcadeTheme || 'system';
    applyTheme(theme); M()?.setHaptics(state.haptics !== false);
    if (document.activeElement !== $('phase')) $('phase').value = state.phaseMode || 'auto';
    if (!settingsReady) {
      settingsReady = true;
      const look = $('arcade-settings'), themeRow = el('div', 'ch-cell'), seg = el('div', 'ch-seg'); seg.id = 'theme-mode'; seg.style.setProperty('--n', 3); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Theme');
      [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([value, text]) => { const b = button('', () => { M()?.haptic('tap'); api.save({ ...current, arcadeTheme: value }); }, text); b.dataset.themeOption = value; seg.append(b); });
      themeRow.append(el('span', 'ch-cell__title', 'Theme'), seg);
      look.append(themeRow, switchRow('sound-toggle', 'Sounds', !!state.arcadeSound, on => api.save({ ...current, arcadeSound: on })), switchRow('haptics-toggle', 'Haptics', state.haptics !== false, on => { api.save({ ...current, haptics: on }); if (on) M()?.haptic('on'); }));

      const form = el('form', 'ch-group'), list = el('div', 'ch-list'), inputs = []; form.id = 'phase-form';
      ['Cut ends', 'Reset ends', 'Bulk ends'].forEach((name, i) => { const row = el('label', 'ch-cell'), input = el('input', 'ch-input'); input.type = 'date'; input.required = true; input.id = 'phase-end-' + i; row.append(el('span', 'ch-cell__title', name), input); list.append(row); inputs.push(input); });
      const submit = el('button', 'secondary ch-btn ch-btn--block', 'Save phase dates');
      form.append(el('h2', 'ch-list-h', 'Phase dates'), list, el('p', 'ch-list-f', 'After Bulk ends, Bulk goals continue. A manual phase or custom goals above override these dates.'), submit);
      form.onsubmit = e => {
        e.preventDefault(); const ends = inputs.map(i => i.value);
        if (ends[0] >= ends[1] || ends[1] >= ends[2]) { inputs[1].setCustomValidity('Dates must be in order.'); inputs[1].reportValidity(); return; }
        const before = current.phaseEnds;
        if (JSON.stringify(before) === JSON.stringify(ends)) return api.message('Phase dates unchanged.');
        api.change({ label: 'Phase dates saved', kind: 'save', forward: s => ({ ...s, phaseEnds: ends }), backward: s => api.assign(s, { phaseEnds: before }) });
      };
      inputs.forEach(i => i.oninput = () => inputs[1].setCustomValidity(''));
      $('phase-settings').append(form);

      const day = $('day-settings'), heading = el('h2', 'ch-list-h', 'Selected day · '), date = el('span'), dayList = el('div', 'ch-list'); date.id = 'weight-date'; heading.append(date);
      const [weighRow, weigh] = numberRow('local-weight', 'Weigh-in', 'kg', { min: '20', max: '500', step: '.1', placeholder: 'Optional' }), [waterRow, water] = numberRow('water-amount', 'Water', 'L', { min: '0', max: '30', step: '.1' });
      // A missed day is the one thing that breaks the journey streak: one switch, with Undo like everything else.
      const missed = switchRow('missed-day', 'Missed day', false, on => update({ missed: on ? true : undefined }, { kind: on ? 'off' : 'on', positive: false, label: on ? 'Marked as missed · streak restarts' : 'Missed day cleared' }));
      dayList.append(weighRow, waterRow, missed); day.append(heading, dayList, el('p', 'ch-list-f', 'Swipe Today to another day to change it here. A missed day restarts the streak the day after.'));
      // An unchanged value is not a new edit: it must not replace the pending Undo.
      water.onchange = () => { const value = Number(water.value); if (water.value !== '' && Number.isFinite(value) && value >= 0 && value <= 30 && value !== (daily(current, activeKey()).water || 0)) update({ water: value }, { kind: 'save', label: 'Water saved' }); };
      weigh.onchange = () => { const v = weigh.value === '' ? null : Number(weigh.value); if ((v === null || Number.isFinite(v) && v >= 20 && v <= 500) && v !== (daily(current, activeKey()).weight ?? null)) update({ weight: v }, { kind: 'save', label: v === null ? 'Weigh-in cleared' : 'Weigh-in saved' }); };

      const exportButton = button('ch-cell', () => { const blob = new Blob([JSON.stringify({ journal: current }, null, 2)], { type: 'application/json' }), a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'chad-local-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
      exportButton.id = 'export-backup'; exportButton.append(el('span', 'ch-cell__title ch-grow', 'Export local backup')); exportButton.insertAdjacentHTML('beforeend', icon('share', 20));
      $('data-settings').append(exportButton);
      const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.id = 'import-backup-file'; file.hidden = true;
      const importButton = button('ch-cell', () => file.click()); importButton.id = 'import-backup'; importButton.append(el('span', 'ch-cell__title ch-grow', 'Import local backup'));
      file.onchange = async () => { try { if (file.files[0]) window.CHADUX.importBackup(JSON.parse(await file.files[0].text())); } catch { api.message('Could not import this backup. Nothing was changed.', true); } finally { file.value = ''; } };
      $('data-settings').append(importButton, file);
    }
    const seg = $('theme-mode'); seg.style.setProperty('--i', ['system', 'light', 'dark'].indexOf(theme)); [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeOption === theme)));
    $('sound-toggle').checked = !!state.arcadeSound; $('haptics-toggle').checked = state.haptics !== false;
    (state.phaseEnds || phases.map(p => p[2])).forEach((v, i) => { const input = $('phase-end-' + i); if (document.activeElement !== input) input.value = v; });
    if (document.activeElement !== $('local-weight')) $('local-weight').value = d.weight ?? '';
    if (document.activeElement !== $('water-amount')) $('water-amount').value = d.water || 0;
    $('weight-date').textContent = shortDate(key); $('missed-day').checked = !!d.missed;
    $('missed-day').disabled = key > dayKey();
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => applyTheme(current?.arcadeTheme || 'system'));
  // The builder logs into a slot through the same reversible path as a card (tier C), and saves meals to the journal.
  const logCustom = (slotId, item) => { const slot = slotById(slotId); return !!slot && choose(slot, { tier: 'C', title: item.name, macros: item.macros, source: 'custom', parts: item.parts }, null, true); };   // Log never removes
  window.CHADQuest = { longPress, dayKey, shift, weekday, monday, waterGoal, phase, goals, phaseHint, deload, daily, week, stats, waterStreak, training, sessionLength, sessionProgress, render, paintCharts, THREE_MEALS, SNACK_GAP, remaining, bestFit, yesterdayMeal, myMeals, logCustom, saveMyMeal, forgetMyMeal, nowFor: (state, key) => nowFor(state, daily(state, key), key, CHADTrain.plan(key)) };
})();
