// v10 scoring, calendar, journey streak, meal plan, training program and workout maths. All data here is synthetic.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), { execFileSync } = require('node:child_process');
const load = files => { const ctx = { window: {}, Intl, Date, Math, matchMedia: () => ({ addEventListener() {} }) }; vm.createContext(ctx); for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx); return ctx; };
const ctx = load(['game10.js', 'train10.js', 'quest10.js', 'plan10.js']);
const q = ctx.window.CHADQuest, plan = ctx.window.CHADPlan, T = ctx.CHADTrain, G = ctx.RECGame;
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const eq = (a, b, message) => assert.deepEqual(plain(a), plain(b), message);

/* ---- F. Meals (supersedes E): Lunch -> gym 4-6 pm -> Dinner -> an optional snack. No breakfast, no pre-gym meal ---- */
eq(plan.map(s => [s.id, s.name]), [['L', 'Lunch'], ['D', 'Dinner'], ['P', 'Snack']], 'lunch, dinner, then the optional snack');
assert.ok(!plan.some(s => /breakfast|pre-gym|pre gym/i.test([s.name, s.time, ...s.choices.flatMap(c => [c.title, ...c.items, ...c.how])].join(' '))), 'no breakfast and no pre-gym meal anywhere in the plan');
const [L, D, P] = plan;
eq(L.choices.slice(0, 2).map(c => [c.pinned, c.title, c.macros]), [[true, "Nando's ½ PERi chicken", [715, 108, 1.1, 30.8]], [true, "Gochi + 4 Nando's tenders", [445, 71.4, 25.9, 9.1]]], 'lunch pins the two go-tos first, with the exact macros');
assert.ok(!L.choices[2].pinned && [D, P].every(s => s.choices.every(c => !c.pinned)), 'only the two lunch go-tos are pinned');
const BANNED = /chicken breast|breast meat|salad|\brice\b|shellfish|prawn|shrimp|crab|lobster|oyster|mussel|scallop|squid|calamari|\bclams?\b|octopus|crayfish|bug meat/i;
for (const slot of plan) {
  assert.equal(slot.choices.length, 3, slot.name + ' has exactly three options');
  eq(slot.choices.map(c => c.tier), ['S', 'M', 'F'], slot.name + ': Strict, Medium, Free, in that order (the lunch go-tos first)');
  for (const c of slot.choices) {
    const where = slot.name + ' ' + c.tier + ' ' + c.title;
    assert.ok(c.title && c.items.length >= 1, where + ': a name and what is in it');
    assert.equal(c.macros.length, 4); assert.ok(c.macros.every(n => typeof n === 'number' && n >= 0), where + ': kcal and P/C/F in grams');
    // The energy has to add up: 4 kcal per gram of protein and carbs, 9 per gram of fat (fibre and rounding: within 10%).
    const energy = 4 * c.macros[1] + 4 * c.macros[2] + 9 * c.macros[3];
    assert.ok(Math.abs(energy - c.macros[0]) / c.macros[0] < 0.1, where + ': macros add up to the kcal (' + energy.toFixed(0) + ' vs ' + c.macros[0] + ')');
    assert.ok(Array.isArray(c.how) && c.how.length >= 1 && c.how.length <= 3 && c.how.every(step => typeof step === 'string' && step.length > 3 && step.length <= 60), where + ': a how-to of at most three short steps');
    assert.equal(BANNED.test([c.title, ...c.items, ...c.how].join(' | ')), false, where + ': no chicken breast, salad, rice or shellfish');
    assert.ok(c.items.every(i => !/\d\s*(?:tsp|tbsp|cups?|oz|lbs?)\b/i.test(i)), where + ': metric (a "chicken cup" is a product, "1 cup" a unit)');
  }
  const [strict, medium, free] = slot.choices;
  assert.ok(strict.items.length <= 5, slot.name + ' Strict: five ingredients at most');
  assert.ok(!/uber/i.test(strict.title + strict.how.join(' ')) && (strict.pinned || !/order|pick-up|takeaway/i.test(strict.title + strict.how.join(' '))), slot.name + ' Strict is bought or cooked, not delivered');
  assert.match(free.title, /^Uber Eats/, slot.name + ' Free is Uber Eats');
  assert.ok(free.how.some(step => /^Order /.test(step)) && free.how.some(step => /^(Ask|Add|No )/.test(step)), slot.name + ' Free says what to order and what to ask for');
  assert.ok(medium.title && medium.how.length, slot.name + ' Medium is easy');
}
assert.match(P.time, /optional/i, 'the snack is optional'); assert.ok(P.choices.some(c => /YoPRO/.test(c.title + c.items.join(' '))) && P.choices.some(c => /shake/i.test(c.title)), 'snacks: YoPRO and a protein shake');
assert.ok(D.choices[0].macros[0] > L.choices[0].macros[0] && D.choices[0].macros[0] > P.choices[0].macros[0], 'dinner is the biggest meal of a typical day');
// A typical day (the ½ chicken, the Strict dinner, the Strict snack) is the Cut day: 1,900 kcal / 220 P / 150 C / 45 F.
const sum3 = cs => [0, 1, 2, 3].map(i => cs.reduce((t, c) => t + c.macros[i], 0));
const typical = sum3([L.choices[0], D.choices[0], P.choices[0]]);
assert.ok(Math.abs(typical[0] - 1900) <= 60 && Math.abs(typical[1] - 220) <= 10 && Math.abs(typical[2] - 150) <= 15 && Math.abs(typical[3] - 45) <= 6, 'a typical day hits the goals: ' + typical.map(Math.round).join('/'));
// Every dinner fills what a typical lunch leaves, with the snack that fits best (or none).
const GOAL = [1900, 220];
for (const lunch of L.choices.slice(0, 2)) for (const dinner of D.choices) {
  const left = [1900 - lunch.macros[0] - dinner.macros[0], 220 - lunch.macros[1] - dinner.macros[1]], s = q.bestFit(left, P.choices, [], GOAL), day = sum3([lunch, dinner, ...(s >= 0 ? [P.choices[s]] : [])]);
  assert.ok(day[0] >= 1550 && day[0] <= 2100 && day[1] >= 190, lunch.title + ' + ' + dinner.title + ' + the best snack: ' + day.map(Math.round).join('/'));
}
console.log('PASS meals: Lunch, Dinner, optional Snack (no breakfast, no pre-gym), exactly 3 options each in Strict, Medium, Free order, lunch go-tos pinned first at 715/108/1.1/30.8 and 445/71.4/25.9/9.1, macros add up, how-to in ≤3 steps, Free = Uber Eats, Strict ≤5 ingredients, no chicken breast/salad/rice/shellfish; typical day ' + typical.map(Math.round).join('/') + ' (kcal/P/C/F), every dinner works after either go-to.');

/* ---- F. Smart pick, remaining today, same as yesterday ---- */
// After the ½ chicken (1,185 kcal and 112 g protein left, the snack still to come) the Strict dinner fits best.
assert.equal(q.bestFit([1900 - 715, 220 - 108], D.choices, [{ choices: P.choices, optional: true }], GOAL), 0, 'after the go-to lunch: Strict dinner');
assert.equal(q.bestFit([800, 68], D.choices, [], GOAL), 1, '800 kcal / 68 g left: Medium (820 / 68), Strict would overshoot');
assert.equal(q.bestFit([940, 115], D.choices, [], GOAL), 2, '940 kcal / 115 g left: Free (945 / 115.5)');
assert.equal(q.bestFit([180, 30], P.choices, [], GOAL), 0, 'snack, 180 / 30 left: YoPRO × 2');
assert.equal(q.bestFit([320, 55], P.choices, [], GOAL), 2, 'snack, 320 / 55 left: the tenders');
// Brute force agrees on random days: the pick is the cheapest option counting the snack that fits after it (or none).
{
  let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cost = x => (x[0] < 0 ? -2 * x[0] : x[0]) / 1900 + Math.max(0, x[1]) / 220;
  for (let n = 0; n < 200; n++) {
    const left = [Math.round(rnd() * 1600), Math.round(rnd() * 180)], i = q.bestFit(left, D.choices, [{ choices: P.choices, optional: true }], GOAL);
    const each = D.choices.map(d => Math.min(cost([left[0] - d.macros[0], left[1] - d.macros[1]]), ...P.choices.map(s => cost([left[0] - d.macros[0] - s.macros[0], left[1] - d.macros[1] - s.macros[1]]))));
    assert.ok(each[i] <= Math.min(...each) + 1e-9, 'best fit ' + left);
  }
}
const day0 = { target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [{ id: 'a', day: '2026-11-24', name: "Nando's ½ PERi chicken", kcal: 715, protein: 108, carbs: 1.1, fat: 30.8, planSlot: 'L' }], questsV5: { '2026-11-24': { picks: { L: 'S' } } } };
eq(q.remaining(day0, '2026-11-24').map(n => Math.round(n * 10) / 10), [1185, 112, 148.9, 14.2], 'remaining today = goals minus what is logged');
// Same as yesterday: a card from today's plan says so; anything else (a custom meal, an older plan's card) comes back as it was.
const ys = { entries: [{ id: 'y', day: '2026-11-23', name: "Nando's ½ PERi chicken", kcal: 715, protein: 108, carbs: 1.1, fat: 30.8, planSlot: 'L' }, { id: 'z', day: '2026-11-23', name: 'Chook & spud bowl', kcal: 640, protein: 52, carbs: 60, fat: 18, planSlot: 'D', source: 'custom', parts: [{ name: 'Roast chook', amount: '200 g' }] }], questsV5: { '2026-11-23': { picks: { L: 'S', D: 'C' } } } };
assert.equal(q.yesterdayMeal(ys, '2026-11-24', L).card, L.choices[0], 'yesterday’s go-to lunch is today’s Strict card');
eq(q.yesterdayMeal(ys, '2026-11-24', D), { tier: 'C', entry: ys.entries[1] }, 'yesterday’s custom dinner comes back as it was');
assert.equal(q.yesterdayMeal(ys, '2026-11-24', P), null, 'no snack yesterday: nothing to repeat');
assert.equal(q.yesterdayMeal({ ...ys, entries: [{ ...ys.entries[0], name: 'PERi steak & spuds' }, ys.entries[1]] }, '2026-11-24', L).entry.name, 'PERi steak & spuds', 'an older plan’s card is repeated by name');
assert.equal(q.yesterdayMeal(ys, '2026-11-25', L), null, 'only yesterday counts');
console.log('PASS smart pick (best fit after a go-to lunch, by kcal and protein, brute-force checked on 200 days), remaining today, same as yesterday (a card, a custom meal, an older card, none).');

/* ---- scoring: three meals + the session from 24 Nov 2026; earlier days unchanged ---- */
const state = { target: 1900, proteinGoal: 220, entries: [], questsV5: {} };
const sessionOf = key => { const s = T.WEEK[q.weekday(key)]; return s.kind === 'rest' ? { cardio: true } : { training: true }; };
const complete = (key, tiers = 'SSS') => { state.questsV5[key] = { picks: Object.fromEntries(plan.map((s, i) => [s.id, tiers[i]])), water: q.waterGoal(key), steps: true, ...sessionOf(key) }; plan.forEach((slot, i) => { const c = slot.choices.find(c => c.tier === tiers[i]); state.entries.push({ day: key, kcal: c.macros[0], protein: c.macros[1] }); }); };
complete('2026-11-24'); assert.equal(q.daily(state, '2026-11-24').score, 17, 'three Strict meals + the session + protein + water + steps = 17'); assert.equal(q.daily(state, '2026-11-24').grade, 'S'); assert.ok(q.daily(state, '2026-11-24').totals[1] >= 210);
delete state.questsV5['2026-11-24'].training; assert.equal(q.daily(state, '2026-11-24').score, 14, 'the session is worth 3'); state.questsV5['2026-11-24'].training = true;
state.questsV5['2026-11-24'].picks.D = 'C'; assert.equal(q.daily(state, '2026-11-24').score, 15, 'a custom meal is worth 1'); state.questsV5['2026-11-24'].picks.D = 'S';
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-24': { workout: { id: 'pull', start: 1, end: 2, sets: [] } } } }, '2026-11-24').score, 3, 'a finished workout is the session');
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-25': { training: true } } }, '2026-11-25').score, 3, 'Wednesday: Muay Thai');
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-29': { cardio: true } } }, '2026-11-29').score, 3, 'Sunday: the walk');
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-23': { training: true, picks: { L: 'S' } } } }, '2026-11-23').score, 3, 'before 24 Nov the session scores nothing (four meals then)');
for (const [score, grade] of [[0, 'C'], [8, 'C'], [9, 'B'], [11, 'B'], [12, 'A'], [14, 'A'], [15, 'S'], [17, 'S']]) {
  let found = false;
  for (const tiers of ['SSSS', 'SSSM', 'SSMM', 'SMMM', 'MMMM', 'MMMF', 'MMFF', 'MFFF', 'FFFF', '']) for (let protein = 0; protein <= 1; protein++) for (let water = 0; water <= 1; water++) for (let steps = 0; steps <= 1; steps++) {
    const s = { entries: protein ? [{ day: '2026-11-24', protein: 210, kcal: 1 }] : [], questsV5: { '2026-11-24': { picks: Object.fromEntries([...tiers].map((t, i) => [i, t])), water: water ? 4.5 : 0, steps: !!steps } } }; const d = q.daily(s, '2026-11-24');
    if (d.score === score) { assert.equal(d.grade, grade); found = true; }
  }
  assert.ok(found, 'grade boundary ' + score);
}
// Meal points top out at four: a day from before v10 can hold an old Dessert pick next to a new one.
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-20': { picks: { B: 'S', L: 'S', P: 'S', D: 'S', E: 'S' } } } }, '2026-11-20').score, 12);
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-20': { picks: { L: 'S', P: 'M', D: 'F', E: 'S' } } } }, '2026-11-20').score, 9, 'a v9 day scores as it did');
assert.equal(q.daily({ entries: [], questsV5: { '2026-11-24': { picks: { L: 'S', P: 'S', D: 'S', E: 'S' }, training: true } } }, '2026-11-24').score, 12, 'four old picks and the session: still twelve');
assert.equal(q.daily({ entries: [], questsV5: { k: { picks: { L: 'S' }, training: true } } }, 'k').score, 3, 'an odd key never throws');
for (const [date, name] of [['2026-12-06', 'cut'], ['2026-12-07', 'reset'], ['2026-12-13', 'reset'], ['2026-12-14', 'bulk'], ['2027-05-02', 'bulk']]) assert.equal(q.phase(state, date)[0], name);
assert.equal(q.goals(state, '2026-12-07').target, 2700); assert.equal(q.goals(state, '2026-12-14').target, 3000); assert.equal(q.goals({ ...state, phaseMode: 'custom', customGoals: [2222, 111, 222, 33] }, '2026-12-14').target, 2222);
eq(plain(q.goals({}, '2026-11-24')), { target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45 }, 'default daily target 1,900 kcal / 220 P / 150 C / 45 F');
assert.equal(q.dayKey(new Date('2026-12-06T14:29:59Z')), '2026-12-06'); assert.equal(q.dayKey(new Date('2026-12-06T14:30:00Z')), '2026-12-07'); assert.equal(q.shift('2027-01-01', -1), '2026-12-31'); assert.equal(q.monday('2026-11-29'), '2026-11-23');
assert.equal(q.waterGoal('2026-11-29'), 3.5); assert.equal(q.waterGoal('2026-11-28'), 5); assert.equal(q.waterGoal('2026-11-24'), 4.5);
state.entries = []; state.questsV5 = {}; for (let i = 0; i < 7; i++) complete(q.shift('2026-11-30', i));
let stats = q.stats(state, '2026-12-06'); assert.equal(stats.week.total, 129, 'a perfect week: 7 × 17 + 10'); assert.equal(stats.week.bonus, 10); assert.equal(stats.level, 'AJ Mode'); assert.equal(stats.maxP, 7); assert.equal(stats.maxW, 7);
assert.equal(['perfect', 'fight', 'zero'].some(k => k in stats), false, 'no badge-only stats');
state.questsV5['2026-11-30'].picks = { L: 'F', D: 'F', P: 'F' }; assert.equal(q.stats(state, '2026-12-06').week.bonus, 0, 'three Free picks: no bonus');
state.questsV5['2026-11-30'].picks = { L: 'S', D: 'S' }; assert.equal(q.stats(state, '2026-12-06').week.complete, false, 'a meal missing: the week is not complete');
const legacy = q.rewards({ entries: [], legacyRewards: { xp: 3000, badges: ['first'] }, questsV5: {} }, '2026-11-24', { xp: 0 }); assert.equal(legacy.xp, 3000); assert.equal(legacy.name, 'CHAD Legend'); assert.equal('badges' in legacy, false, 'no badges, even from a legacy journal');
// water streak: days in a row on the goal, up to today (or yesterday while today is filling)
const wet = { entries: [], questsV5: { '2026-11-21': { water: 5 }, '2026-11-22': { water: 3.5 }, '2026-11-23': { water: 4.5 }, '2026-11-24': { water: 1 } } };
assert.equal(q.waterStreak(wet, '2026-11-24'), 3); wet.questsV5['2026-11-24'].water = 4.5; assert.equal(q.waterStreak(wet, '2026-11-24'), 4); wet.questsV5['2026-11-22'].water = 3; assert.equal(q.waterStreak(wet, '2026-11-24'), 2);

/* ---- A. The journey streak: 48 on 24 Nov 2026 ---- */
assert.equal(q.stats({ entries: [], questsV5: {} }, '2026-11-24').streak, 48, 'Day 1 = 8 Oct 2026: 24 Nov is a 48-day streak, today included');
// A believable history: 40 logged days out of 48 (gaps on 8 days), as in the v9 app that showed 40. Still 48.
const history = { journeyStartDate: '2026-10-08', entries: [], questsV5: {} };
for (let n = 0, logged = 0; n < 48; n++) { const k = q.shift('2026-11-24', -n); if (n % 6 === 5) continue; history.questsV5[k] = { picks: { L: 'S', D: 'M' }, water: 2 }; history.entries.push({ id: 'h' + n, day: k, name: 'Synthetic', kcal: 900, protein: 80 }); logged++; }
assert.equal(Object.keys(history.questsV5).length, 40); assert.equal(q.stats(history, '2026-11-24').streak, 48, '40 logged days, 8 gaps: still 48');
assert.equal(q.stats(history, '2026-11-24').since, '2026-10-08');
history.questsV5['2026-11-20'] = { ...history.questsV5['2026-11-20'], missed: true };
assert.equal(q.stats(history, '2026-11-24').streak, 4, 'a day marked missed restarts it'); assert.equal(q.stats(history, '2026-11-24').longest, 43);
delete history.questsV5['2026-11-20'].missed; assert.equal(q.stats(history, '2026-11-24').streak, 48, 'and clearing the mark gives it back');
assert.equal(q.stats({ ...history, journeyStartDate: '2026-10-09' }, '2026-11-24').streak, 47, 'Day 1 follows Settings');
assert.equal(q.stats({ ...history, journeyStartDate: '2026-11-25' }, '2026-11-24').streak, 0, 'a Day 1 still to come: no streak yet');
assert.equal(q.stats(history, '2026-11-25').streak, 49);
assert.equal(G.derive({ target: 1900, proteinGoal: 220, entries: history.entries, questsV5: history.questsV5 }, '2026-11-24').streak, 48, 'the game shows the same streak');
console.log('PASS scoring: 17 = S from three Strict meals + the session (from 24 Nov 2026; custom meal 1, earlier days unchanged), all grade boundaries, meal points capped at four, phases and goals (default 1,900/220/150/45), Darwin midnight, weekly bonus (three meals a day) and levels, no badges, legacy XP, water streak; journey streak 48 on 2026-11-24 (empty journal and 40-of-48 logged), a day marked missed restarts it and clearing the mark restores it, Day 1 edits, future Day 1.');

/* ---- Perfect Week v1 ---- */
eq(T.WEEK.map(s => s.name), ['Rest + walk', 'Push', 'Pull', 'Muay Thai', 'Delts + Arms', 'Upper chest + Back', 'Sprints + Legs']);
assert.equal(T.label('2026-11-23'), 'Push · 6 exercises · 60 min'); assert.equal(T.label('2026-11-25'), 'Muay Thai · 6:30 pm'); assert.equal(T.label('2026-11-29'), 'Rest + walk');
for (const [key, cardio] of [['2026-11-23', '2 km Zone 2'], ['2026-11-24', '30–40 min incline walk'], ['2026-11-26', '2 km Zone 2'], ['2026-11-27', '30–40 min incline walk'], ['2026-11-28', 'Hill sprints'], ['2026-11-29', '45–60 min walk']]) assert.equal(T.plan(key).cardio, cardio);
for (const s of T.WEEK.filter(s => s.kind === 'gym')) {
  assert.ok(s.ex.length >= 5 && s.ex.length <= 8 && s.minutes === 60, s.name + ': 5-8 exercises, 60 min');
  assert.ok(s.ex.every(e => e.sets >= 2 && e.sets <= 6 && e.rest >= 60 && e.rest <= 120 && e.reps[0] < e.reps[1]), s.name + ': sets, rep ranges, 60-120 s rest');
  assert.ok(s.ex.reduce((t, e) => t + e.sets, 0) >= 15, s.name + ': a real session');
}
const focus = T.WEEK.flatMap(s => s.ex.map(e => e.name)).join(' ');
for (const move of ['side raise', 'Incline', 'pulldown', 'shrugs']) assert.ok(focus.toLowerCase().includes(move.toLowerCase()), 'focus: ' + move);
assert.equal(T.plan('2026-11-23').ex[0].name, 'Incline DB press'); assert.equal(T.plan('2026-11-23').ex[2].name, 'Low-to-high cable fly', 'Push adds an upper-chest fly');
for (const [date, expected] of [['2026-12-27', false], ['2026-12-28', true], ['2027-01-03', true], ['2027-01-04', false], ['2027-02-08', true], ['2027-02-14', true], ['2027-03-22', true], ['2027-03-28', true], ['2027-05-03', true], ['2027-05-09', true], ['2027-05-10', false]]) { assert.equal(T.deload(date), expected, date); assert.equal(q.deload(date), expected); }
eq(T.plan('2026-12-28').ex.map(e => e.sets), T.plan('2026-11-23').ex.map(e => Math.ceil(e.sets / 2)), 'deload: half the sets, rounded up');
assert.equal(T.REVIEW, '2026-12-20'); assert.match(T.RULES.join(' '), /2 reps before failure.*reps first, then weight/);
// add reps first, then weight
const incline = { name: 'x', sets: 3, reps: [8, 12], rest: 90, kind: 'kg' };
assert.equal(T.hint(incline, { kg: 12.5, reps: 10 }), 'Last 12.5 kg × 10 → try 11 reps, then 15 kg', 'the brief, word for word');
eq(plain(T.suggest(incline, { kg: 12.5, reps: 10 })), { kg: 12.5, reps: 11 });
assert.equal(T.hint(incline, { kg: 12.5, reps: 12 }), 'Last 12.5 kg × 12 → try 15 kg × 8'); eq(plain(T.suggest(incline, { kg: 12.5, reps: 12 })), { kg: 15, reps: 8 });
assert.match(T.hint(incline, null), /^New/); eq(plain(T.suggest(incline, null)), { kg: null, reps: 8 });
console.log('PASS program: Perfect Week v1 (Push 6 · Pull · Muay Thai 6:30 pm · Delts + Arms · Upper chest + Back · Sprints + Legs · Rest + walk), cardio per day, 5-8 exercises with 60-120 s rest, focus moves, deload weeks and half sets, v2 review date, rules, "Last 12.5 kg × 10 → try 11 reps, then 15 kg".');

/* ---- workout maths ---- */
const gym = { entries: [], questsV5: {
  '2026-11-09': { topSets: { 'Incline DB press': { kg: 20, reps: 8 } } },
  '2026-11-16': { training: true, workout: { id: 'push', start: Date.parse('2026-11-16T16:00:00+09:30'), end: Date.parse('2026-11-16T16:52:00+09:30'), sets: [{ x: 'Incline DB press', kg: 22.5, reps: 8, at: 1 }, { x: 'Incline DB press', kg: 22.5, reps: 7, at: 2 }, { x: 'Cable side raise', kg: 7.5, reps: 15, at: 3 }] } },
  '2026-11-23': { training: true, workout: { id: 'push', start: Date.parse('2026-11-23T16:05:00+09:30'), end: Date.parse('2026-11-23T17:01:00+09:30'), sets: [{ x: 'Incline DB press', kg: 25, reps: 8, at: 4 }, { x: 'Incline DB press', kg: 22.5, reps: 9, at: 5 }, { x: 'Cable side raise', kg: 7.5, reps: 14, at: 6 }, { x: 'Hill sprints', kg: 0, reps: 12, at: 7 }] } },
  '2026-11-24': { workout: { id: 'pull', start: Date.parse('2026-11-24T16:10:00+09:30'), sets: [{ x: 'Pull-ups', kg: 0, reps: 9, at: 8 }] } } } };
eq(plain(T.last(gym, 'Incline DB press', '2026-11-23')), { key: '2026-11-16', kg: 22.5, reps: 8, at: 1 }, 'last time = the best set of the last session before');
assert.equal(T.last(gym, 'Incline DB press', '2026-11-30').kg, 25); assert.equal(T.last(gym, 'Incline DB press', '2026-11-09'), null);
const sum = T.summary(gym, '2026-11-23');
assert.equal(sum.volume, 25 * 8 + 22.5 * 9 + 7.5 * 14, 'volume = kg × reps, time sets excluded'); assert.equal(sum.minutes, 56); assert.equal(sum.sets, 4); assert.equal(sum.done, true);
eq(plain(sum.prs.map(p => p.name)), ['Incline DB press'], 'a heavier set is a PR; a lower one is not; sprints never');
assert.equal(T.summary(gym, '2026-11-16').prs.length, 1, 'beats the v9 top set from the week before');
assert.equal(T.summary(gym, '2026-11-24').live, true); assert.equal(T.summary(gym, '2026-11-24').done, false);
eq(plain(T.workouts(gym, '2026-11-24').map(w => w.key)), ['2026-11-23', '2026-11-16'], 'history: finished workouts, newest first');
const best = T.records(gym).find(r => r.name === 'Incline DB press'); assert.equal(best.kg, 25); assert.equal(best.reps, 8); assert.equal(best.e1rm, 31.7, 'est 1RM (Epley): 25 × (1 + 8/30)');
assert.ok(!T.records(gym).some(r => r.name === 'Hill sprints'));
assert.equal(T.records(gym).find(r => r.name === 'Pull-ups').reps, 9, 'bodyweight records by reps');
eq(plain(T.progress(gym, '2026-11-24')), { total: 20, done: 1, exercises: 0 });
// XP: 10 per session move once done (as in v9), plus 5 per logged set; derived, so Undo/Redo never doubles it.
const xp = s => q.rewards(s, '2026-11-24', { xp: 0, badges: [] }).xp;
const before = xp(gym); gym.questsV5['2026-11-24'].workout.sets.push({ x: 'Pull-ups', kg: 0, reps: 8, at: 9 }); assert.equal(xp(gym) - before, 5);
gym.questsV5['2026-11-24'].training = true; assert.equal(xp(gym) - before, 5 + 70, 'finishing Pull: 7 moves × 10');
console.log('PASS workouts: last session, volume, duration, PRs vs earlier days (v9 top sets count), history newest first, best set + est 1RM per exercise, bodyweight records, progress, set and session XP.');

// v10 keeps v9's daily and weekly scoring (proven identical to v8 before). Prove it again against the shipped v9 code
// (Git, 472da71) on random synthetic journals: every day and week identical; stats identical except the streak, which
// is now the journey streak by design; XP identical where no session was done (session XP follows the new program).
const old = load([]); vm.runInContext(execFileSync('git', ['show', '472da71:quest9.js'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }), old);
const shipped = old.window.CHADQuest;
let seed = 20261124; const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, chance = p => random() < p, tiers = 'SMF';
for (let round = 0; round < 12; round++) {
  const journal = { target: 1900, proteinGoal: 220, entries: [], questsV5: {}, legacyRewards: chance(.3) ? { xp: Math.floor(random() * 900), badges: ['first'] } : undefined }, days = 40 + Math.floor(random() * 160), today = '2026-11-24';
  for (let n = -3; n < days; n++) {
    if (chance(.12)) continue;
    const key = q.shift(today, -n), picks = {};
    for (const id of (chance(.5) ? ['L', 'P', 'D', 'E'] : ['B', 'L', 'P', 'D'])) if (chance(.85)) { const tier = tiers[Math.floor(random() * (chance(.7) ? 1 : 3))]; picks[id] = tier; journal.entries.push({ id: 'plan-' + key + '-' + id, day: key, name: 'Synthetic', kcal: 300 + Math.floor(random() * 400), protein: Math.round(random() * 700) / 10, planSlot: id }); }
    for (let extra = 0; extra < Math.floor(random() * 3); extra++) journal.entries.push({ id: 'x' + n + '-' + extra, day: key, name: 'Synthetic', kcal: 1 + Math.floor(random() * 600), protein: Math.round(random() * 500) / 10 });
    journal.questsV5[key] = { picks, water: chance(.8) ? q.waterGoal(key) - (chance(.3) ? .5 : 0) : Math.round(random() * 40) / 10, steps: chance(.7), electrolyte: chance(.5), cardio: chance(.4), sleep: chance(.6), exercises: chance(.4) ? { 0: true, 2: chance(.5) } : undefined };
  }
  const keys = Array.from({ length: days + 8 }, (_, n) => q.shift(today, 4 - n));
  eq(plain(keys.map(k => { const { sessionHit, ...d } = q.daily(journal, k); assert.equal(sessionHit, false); return d; })), plain(keys.map(k => shipped.daily(journal, k))), 'round ' + round + ': days');
  eq(plain(keys.map(k => q.week(journal, q.monday(k), today))), plain(keys.map(k => shipped.week(journal, shipped.monday(k), today))), 'round ' + round + ': weeks');
  for (const k of [today, q.shift(today, -9), q.shift(today, 3)]) {
    const { streak, longest, since, ...rest } = q.stats(journal, k), was = shipped.stats(journal, k);
    for (const gone of ['streak', 'longest', 'perfect', 'fight', 'zero']) delete was[gone]; eq(plain(rest), plain(was), 'round ' + round + ': stats');
    assert.equal(streak, G.journey(journal, k).streak);
  }
  assert.equal(q.rewards(journal, today, { xp: 50, badges: [] }).xp, shipped.rewards(journal, today, { xp: 50, badges: [] }).xp, 'round ' + round + ': XP');
}
console.log('PASS v10 scoring equals the shipped v9 on 12 random journals (days, weeks, stats apart from the journey streak and the badge-only ones, XP without sessions).');
