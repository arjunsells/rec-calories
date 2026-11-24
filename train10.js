'use strict';
// CHAD v10 · Perfect Week v1: the training program, the deload weeks and the workout maths (prescriptions, last
// sets, overload hints, records, volume, PRs). Pure functions of the journal: no DOM, no storage. Node tests load it.
//
// A workout lives in the journal, on its day: questsV5[day].workout = { id, start, end?, sets: [{ x, kg, reps, at }] }
// (x = exercise name, at = when the set was logged, ms). Older top sets (v9: questsV5[day].topSets) count as records.
((root) => {
  const weekday = key => new Date(key + 'T12:00:00+09:30').getUTCDay();          // 0 = Sunday, on the Darwin calendar
  const DELOADS = [['2026-12-28', '2027-01-03'], ['2027-02-08', '2027-02-14'], ['2027-03-22', '2027-03-28'], ['2027-05-03', '2027-05-09']];
  const deload = key => DELOADS.some(([a, b]) => key >= a && key <= b);
  const REVIEW = '2026-12-20';                                                     // Perfect Week v2 review
  const RULES = ['Stop 2 reps before failure.', 'Add reps first, then weight.'];
  const FOCUS = 'Side delts · upper chest · lats · traps';
  const GYM = 'Gym 4–6 pm · cardio straight after';
  const SET_XP = 5, STEP = 2.5;
  // name, sets, reps low–high, rest (s), kind: 'kg' (load), 'bw' (bodyweight, kg = added load), 'time' (seconds)
  const x = (name, sets, low, high, rest, kind = 'kg') => ({ name, sets, reps: [low, high], rest, kind });
  const WEEK = [
    { id: 'rest', day: 0, name: 'Rest + walk', kind: 'rest', focus: 'Recovery · mobility', cardio: '45–60 min walk', cardioShort: 'Long walk', minutes: 60, items: ['45–60 min walk', 'Mobility and foam roll'], note: 'Sauna or ice bath: Sunday only.', ex: [] },
    { id: 'push', day: 1, name: 'Push', kind: 'gym', focus: 'Upper chest · side delts · triceps', cardio: '2 km Zone 2', cardioShort: '2 km Zone 2', minutes: 60, ex: [
      x('Incline DB press', 3, 6, 10, 120), x('Machine chest press', 3, 8, 12, 90), x('Low-to-high cable fly', 3, 12, 15, 60),
      x('Seated DB shoulder press', 2, 6, 10, 120), x('Cable side raise', 4, 12, 20, 60), x('Overhead cable triceps ext', 3, 10, 15, 60)] },
    { id: 'pull', day: 2, name: 'Pull', kind: 'gym', focus: 'Lats · traps · rear delts · biceps · abs', cardio: '30–40 min incline walk', cardioShort: 'Incline walk', minutes: 60, ex: [
      x('Pull-ups', 3, 6, 10, 120, 'bw'), x('Chest-supported row', 3, 8, 12, 90), x('Single-arm pulldown', 2, 10, 15, 90), x('Rear delt fly', 3, 12, 20, 60),
      x('DB shrugs', 3, 10, 15, 60), x('Incline DB curl', 3, 8, 12, 60), x('Hanging leg raise', 3, 10, 15, 60, 'bw')] },
    { id: 'muaythai', day: 3, name: 'Muay Thai', kind: 'class', time: '6:30 pm', focus: 'Conditioning · full body', cardio: 'Muay Thai class', minutes: 60, items: ['10 min warm-up', 'Muay Thai · 6:30 pm', '10 min stretch'], note: 'No gym. 5 pm snack: banana + YoPRO.', ex: [] },
    { id: 'delts', day: 4, name: 'Delts + Arms', kind: 'gym', focus: 'Side delts · biceps · triceps · abs', cardio: '2 km Zone 2', cardioShort: '2 km Zone 2', minutes: 60, note: 'Lighter pump day.', ex: [
      x('Machine side raise', 4, 12, 20, 60), x('Machine shoulder press', 2, 8, 12, 90), x('Reverse pec deck', 2, 15, 20, 60), x('EZ curl', 3, 8, 12, 60),
      x('Pushdown', 3, 10, 15, 60), x('Hammer curl', 2, 10, 15, 60), x('Dips', 2, 8, 12, 90, 'bw'), x('Cable crunch', 3, 10, 15, 60)] },
    { id: 'upper', day: 5, name: 'Upper chest + Back', kind: 'gym', focus: 'Upper chest · lats · side delts', cardio: '30–40 min incline walk', cardioShort: 'Incline walk', minutes: 60, ex: [
      x('Smith incline', 3, 6, 10, 120), x('T-bar or seal row', 3, 6, 10, 120), x('Low-to-high cable fly', 3, 12, 15, 60),
      x('Lat pulldown', 3, 8, 12, 90), x('Straight-arm pulldown', 3, 12, 15, 60), x('Side raise', 3, 12, 20, 60)] },
    { id: 'legs', day: 6, name: 'Sprints + Legs', kind: 'gym', focus: 'Quads · hamstrings · glutes · calves · abs', cardio: 'Hill sprints', cardioShort: 'Hill sprints', minutes: 60, note: '10 min warm-up first. The one leg day. No run.', ex: [
      x('Hill sprints', 6, 10, 15, 90, 'time'), x('Hack squat', 3, 6, 10, 120), x('RDL', 3, 6, 8, 120), x('Leg press', 2, 10, 15, 90),
      x('Seated leg curl', 3, 10, 15, 60), x('Leg extension', 2, 12, 15, 60), x('Calf raise', 4, 10, 15, 60), x('Hanging leg raise', 3, 10, 15, 60, 'bw')] }
  ];
  const KIND = new Map(WEEK.flatMap(s => s.ex.map(e => [e.name, e.kind])));
  const byId = id => WEEK.find(s => s.id === id);

  // The day's session. Deload weeks: half the sets (rounded up), same weights.
  function plan(key) {
    const s = WEEK[weekday(key)], light = deload(key);
    return { ...s, deload: light, ex: s.ex.map(e => ({ ...e, sets: light ? Math.ceil(e.sets / 2) : e.sets })) };
  }
  // "Push · 6 exercises · 60 min", "Muay Thai · 6:30 pm", "Rest + walk"
  function label(key) {
    const s = plan(key);
    if (s.kind === 'gym') return s.name + ' · ' + s.ex.length + ' exercises · ' + s.minutes + ' min';
    return s.kind === 'class' ? s.name + ' · ' + s.time : s.name;
  }
  const one = n => Math.round(n * 10) / 10;
  const kgText = n => one(n).toLocaleString('en-AU', { maximumFractionDigits: 1 });
  const restText = s => s >= 120 && s % 60 === 0 ? s / 60 + ' min' : s + ' s';
  const reps = e => e.reps[0] + '–' + e.reps[1] + (e.kind === 'time' ? ' s' : '');
  const rx = e => e.sets + ' × ' + reps(e);                                         // "3 × 6–10", "6 × 10–15 s"
  const e1rm = (kg, n) => kg > 0 ? kg * (1 + n / 30) : 0;                          // Epley estimate
  // How strong a set is, for records: a loaded set by its estimated 1RM; bodyweight-only sets by reps (below any load).
  const strength = s => s.kg > 0 ? e1rm(s.kg, s.reps) : s.reps / 1000;
  const validSet = s => s && typeof s.x === 'string' && typeof s.kg === 'number' && s.kg >= 0 && typeof s.reps === 'number' && s.reps > 0;

  // Every set, oldest first, grouped by exercise. Built once per journal (each change replaces questsV5).
  const cache = new WeakMap(), NONE = {};
  function index(state) {
    const q = state.questsV5 || NONE;
    let i = cache.get(q);
    if (i) return i;
    i = new Map();
    const add = (name, set) => { if (KIND.get(name) === 'time') return; const list = i.get(name); if (list) list.push(set); else i.set(name, [set]); };
    for (const key of Object.keys(q).sort()) {
      const d = q[key] || {};
      for (const [name, r] of Object.entries(d.topSets || {})) if (r && typeof r.kg === 'number' && typeof r.reps === 'number' && r.reps > 0) add(name, { key, kg: r.kg, reps: r.reps, at: 0 });
      if (Array.isArray(d.workout?.sets)) for (const s of d.workout.sets) if (validSet(s)) add(s.x, { key, kg: s.kg, reps: s.reps, at: s.at || 0 });
    }
    cache.set(q, i);
    return i;
  }
  // The best set of the most recent day before `key` that has this exercise: what "last time" means.
  function last(state, name, key) {
    const list = (index(state).get(name) || []).filter(s => s.key < key);
    if (!list.length) return null;
    const day = list.at(-1).key;
    return list.filter(s => s.key === day).reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));
  }
  // Add reps first, then weight: below the top of the range, one more rep at the same weight; at the top, the next
  // weight up at the bottom of the range.
  function suggest(e, top) {
    if (!top) return { kg: e.kind === 'kg' ? null : 0, reps: e.reps[0] };
    if (top.reps < e.reps[1]) return { kg: top.kg, reps: top.reps + 1 };
    return { kg: one(top.kg + STEP), reps: e.reps[0] };
  }
  function hint(e, top) {
    if (e.kind === 'time') return e.sets + ' sprints of ' + reps(e) + ' · walk back down';
    if (!top) return e.kind === 'bw' ? 'Bodyweight first · ' + reps(e) + ' reps, 2 in the tank' : 'New · pick a weight for ' + reps(e) + ' reps, 2 in the tank';
    const was = (top.kg > 0 ? kgText(top.kg) + ' kg × ' : '') + top.reps + (top.kg > 0 ? '' : ' reps');
    if (top.reps < e.reps[1]) return 'Last ' + was + ' → try ' + (top.reps + 1) + ' reps, then ' + kgText(top.kg + STEP) + ' kg';
    return 'Last ' + was + ' → try ' + kgText(top.kg + STEP) + ' kg × ' + e.reps[0];
  }
  const loaded = s => (s.kg > 0 && KIND.get(s.x) !== 'time' ? s.kg * s.reps : 0);
  const volume = sets => one((sets || []).filter(validSet).reduce((t, s) => t + loaded(s), 0));
  // Exercises whose best set on `key` beats every earlier day's best. A first-ever log is not a record yet.
  function prsOn(state, key) {
    const out = [];
    for (const [name, list] of index(state)) {
      const today = list.filter(s => s.key === key), before = list.filter(s => s.key < key);
      if (!today.length || !before.length) continue;
      const best = today.reduce((a, b) => (strength(b) > strength(a) ? b : a)), prev = Math.max(...before.map(strength));
      if (strength(best) > prev + 1e-9) out.push({ name, kg: best.kg, reps: best.reps, e1rm: one(e1rm(best.kg, best.reps)) });
    }
    return out;
  }
  // The best set ever per exercise, in program order (then any older names).
  function records(state) {
    const order = [...new Set(WEEK.flatMap(s => s.ex.map(e => e.name)))], i = index(state), out = [];
    for (const name of [...order, ...[...i.keys()].filter(n => !order.includes(n)).sort()]) {
      const list = i.get(name); if (!list?.length) continue;
      const best = list.reduce((a, b) => (strength(b) >= strength(a) ? b : a));
      out.push({ name, kg: best.kg, reps: best.reps, key: best.key, e1rm: one(e1rm(best.kg, best.reps)) });
    }
    return out;
  }
  const finished = d => !!(d && (d.training || d.workout?.end));
  // What the workout on a day amounts to.
  function summary(state, key) {
    const d = state.questsV5?.[key] || {}, w = d.workout, sets = (w?.sets || []).filter(validSet);
    const session = (w && byId(w.id)) || WEEK[weekday(key)];
    const minutes = w && typeof w.end === 'number' && typeof w.start === 'number' ? Math.max(1, Math.round((w.end - w.start) / 60000)) : null;
    return { key, id: session.id, name: session.name, kind: session.kind, sets: sets.length, volume: volume(sets), minutes, exercises: new Set(sets.map(s => s.x)).size, done: finished(d), live: !!(w && !w.end), prs: sets.length ? prsOn(state, key) : [] };
  }
  // Finished workouts and sessions marked done, newest first (rest days only when a workout was logged).
  function workouts(state, today) {
    const q = state.questsV5 || {};
    return Object.keys(q).filter(k => (!today || k <= today) && (q[k]?.workout?.end || (q[k]?.training && WEEK[weekday(k)].kind !== 'rest'))).sort().reverse().map(k => summary(state, k));
  }
  // The sets logged so far for one exercise in a workout, in order.
  const setsFor = (w, name) => (w?.sets || []).filter(s => s.x === name && validSet(s));
  // Sets in the session's prescription that are still to do, and in total.
  function progress(state, key) {
    const s = plan(key), w = state.questsV5?.[key]?.workout;
    const total = s.ex.reduce((t, e) => t + e.sets, 0), done = s.ex.reduce((t, e) => t + Math.min(e.sets, setsFor(w, e.name).length), 0);
    return { total, done, exercises: s.ex.filter(e => setsFor(w, e.name).length >= e.sets).length };
  }

  const api = { WEEK, DELOADS, REVIEW, RULES, FOCUS, GYM, SET_XP, STEP, weekday, deload, plan, label, byId, kgText, restText, rx, reps, e1rm, strength, last, suggest, hint, volume, prsOn, records, summary, workouts, setsFor, progress, finished, index };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHADTrain = api;
})(globalThis);
