'use strict';
// Pure, derived rewards: deleting a log or editing goals recalculates progress.
((root) => {
  const LEVELS = ['Open Home Rookie', 'Listing Scout', 'Property Pro', 'Auction Ace', 'Market Leader', 'Agency Legend'];
  const THRESHOLDS = [0, 100, 300, 700, 1400, 2500];
  const BADGES = [
    { id: 'first', name: 'First Open Home', icon: '🏡', hint: 'Log your first entry.' },
    { id: 'logs25', name: 'Listing Portfolio', icon: '🔑', hint: 'Log 25 entries.' },
    { id: 'streak3', name: 'On the Market', icon: '🔥', hint: 'Log on 3 consecutive days.' },
    { id: 'streak7', name: 'Sold Week', icon: '🏆', hint: 'Log on 7 consecutive days.' },
    { id: 'streak30', name: 'Market Stalwart', icon: '💎', hint: 'Log on 30 consecutive days.' },
    { id: 'protein', name: 'Protein Property', icon: '💪', hint: 'Reach your protein goal in a day.' },
    { id: 'balanced', name: 'Perfect Settlement', icon: '⭐', hint: 'Finish a day with an S grade.' }
  ];
  function previousDay(key) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
      const day = days.get(e.day) || { kcal: 0, protein: 0 };
      day.kcal += e.kcal; day.protein += e.protein; days.set(e.day, day); logs++;
    });
    let xp = logs * 10, run = 0, longest = 0, last = null, proteinHit = false, balanced = false;
    [...days.keys()].sort().forEach(key => {
      run = last === previousDay(key) ? run + 1 : 1;
      longest = Math.max(longest, run); last = key;
      const day = days.get(key);
      day.grade = grade(day.kcal, day.protein, state.target, state.proteinGoal);
      day.xp = key < today && ['S', 'A'].includes(day.grade) ? 50 + (day.grade === 'S' ? 25 : 0) : 0;
      xp += day.xp;
      proteinHit ||= day.protein >= state.proteinGoal;
      balanced ||= key < today && day.grade === 'S';
    });
    let streak = 0, cursor = days.has(today) ? today : previousDay(today);
    while (days.has(cursor)) { streak++; cursor = previousDay(cursor); }
    const level = THRESHOLDS.findLastIndex(threshold => xp >= threshold);
    const unlocked = { first: logs > 0, logs25: logs >= 25, streak3: longest >= 3, streak7: longest >= 7, streak30: longest >= 30, protein: proteinHit, balanced };
    return { xp, level, name: LEVELS[level], floor: THRESHOLDS[level], next: THRESHOLDS[level + 1] ?? null, streak, longest, days, badges: BADGES.map(badge => ({ ...badge, unlocked: unlocked[badge.id] })) };
  }
  const api = { derive, grade, previousDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RECGame = api;
})(globalThis);
