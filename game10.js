'use strict';
// Pure, derived rewards: deleting a log or editing goals recalculates progress. v10: no badges, just XP, levels and
// the streak.
// v10: the streak is the journey streak. Every day from Day 1 (journeyStartDate, editable in Settings; 8 Oct 2026 by
// default) up to today counts, today included, logged or not. Only a day marked as missed breaks it (the streak starts
// again the day after), and a Day 1 still in the future means no streak yet. 24 Nov 2026 is Day 48: a 48-day streak.
((root) => {
  const LEVELS = ['Fresh Start', 'Building Momentum', 'Daily Contender', 'Goal Crusher', 'Elite Form', 'CHAD Legend'];
  const THRESHOLDS = [0, 100, 300, 700, 1400, 2500];
  const START = '2026-10-08';
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(key + 'T00:00:00Z')) && new Date(key + 'T00:00:00Z').toISOString().slice(0, 10) === key;
  // Calendar dates only (Darwin has no daylight saving, and these never touch the device clock).
  const addDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const span = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5) + 1;   // inclusive
  function previousDay(key) { return addDays(key, -1); }
  // The journey streak on `today`: { streak, longest, start, since, missed }.
  function journey(state, today) {
    const start = validDate(state?.journeyStartDate) ? state.journeyStartDate : START;
    if (!validDate(today) || today < start) return { streak: 0, longest: 0, start, since: null, missed: [] };
    const q = state?.questsV5 || {}, missed = Object.keys(q).filter(k => k >= start && k <= today && q[k]?.missed === true).sort();
    let longest = 0, since = start;
    for (const m of missed) { longest = Math.max(longest, span(since, m) - 1); since = addDays(m, 1); }
    const streak = since > today ? 0 : span(since, today);
    return { streak, longest: Math.max(longest, streak), start, since: streak ? since : null, missed };
  }
  function grade(kcal, protein, target, proteinGoal) {
    if (!kcal) return '—';
    const difference = Math.abs(kcal - target) / target;
    return difference <= 0.100000001 ? (protein >= proteinGoal ? 'S' : 'A') : difference <= 0.200000001 ? 'B' : 'C';
  }
  function derive(state, today) {
    const days = new Map();
    let logs = 0;
    state.entries.filter(e => e.day <= today).forEach(e => {
      const day = days.get(e.day) || { kcal: 0, protein: 0, meals: new Set(), scans: 0 };
      day.kcal += e.kcal; day.protein += e.protein;
      // The v4 "Log 3 meals" quest reads the meal names of old entries (a v4 Breakfast included); the plan has none now.
      if (['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(e.meal)) day.meals.add(e.meal);
      if (['photo', 'barcode'].includes(e.source)) day.scans++;
      days.set(e.day, day); logs++;
    });
    const questsFor = day => [
      { id: 'protein', name: 'Hit your protein goal', progress: Math.min(day.protein, state.proteinGoal), target: state.proteinGoal, xp: 30 },
      { id: 'meals', name: 'Log 3 meals', progress: Math.min(day.meals.size, 3), target: 3, xp: 30 },
      { id: 'scan', name: 'Scan a photo or barcode', progress: Math.min(day.scans, 1), target: 1, xp: 20 }
    ].map(quest => ({ ...quest, complete: quest.progress >= quest.target }));
    let xp = logs * 10, questXP = 0;
    [...days.keys()].sort().forEach(key => {
      const day = days.get(key);
      day.grade = grade(day.kcal, day.protein, state.target, state.proteinGoal);
      day.xp = key < today && ['S', 'A'].includes(day.grade) ? 50 + (day.grade === 'S' ? 25 : 0) : 0;
      day.quests = questsFor(day);
      day.questXP = day.quests.reduce((sum, quest) => sum + (quest.complete ? quest.xp : 0), 0);
      questXP += day.questXP;
      xp += day.xp + day.questXP;
    });
    const { streak, longest } = journey(state, today);
    const level = THRESHOLDS.findLastIndex(threshold => xp >= threshold);
    const quests = days.get(today)?.quests || questsFor({ protein: 0, meals: new Set(), scans: 0 });
    return { xp, questXP, quests, level, name: LEVELS[level], floor: THRESHOLDS[level], next: THRESHOLDS[level + 1] ?? null, streak, longest, days };
  }
  const api = { derive, grade, previousDay, journey, addDays, START };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RECGame = api;
})(globalThis);
