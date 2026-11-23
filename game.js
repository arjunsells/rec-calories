'use strict';
// Pure, derived rewards: deleting a log or editing goals recalculates progress.
((root) => {
  const LEVELS = ['Fresh Start', 'Building Momentum', 'Daily Contender', 'Goal Crusher', 'Elite Form', 'CHAD Legend'];
  const THRESHOLDS = [0, 100, 300, 700, 1400, 2500];
  const BADGES = [
    { id: 'first', name: 'First Rep', icon: '⚡', hint: 'Log your first entry.' },
    { id: 'logs25', name: 'Built Different', icon: '🎯', hint: 'Log 25 entries.' },
    { id: 'streak3', name: 'On Fire', icon: '🔥', hint: 'Log on 3 consecutive days.' },
    { id: 'streak7', name: 'Seven Strong', icon: '🏆', hint: 'Log on 7 consecutive days.' },
    { id: 'streak30', name: 'Unstoppable', icon: '💎', hint: 'Log on 30 consecutive days.' },
    { id: 'protein', name: 'Protein Power', icon: '💪', hint: 'Reach your protein goal in a day.' },
    { id: 'balanced', name: 'S Class', icon: '⭐', hint: 'Finish a day with an S grade.' }
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
      const day = days.get(e.day) || { kcal: 0, protein: 0, meals: new Set(), scans: 0 };
      day.kcal += e.kcal; day.protein += e.protein;
      if (['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(e.meal)) day.meals.add(e.meal);
      if (['photo', 'barcode'].includes(e.source)) day.scans++;
      days.set(e.day, day); logs++;
    });
    const questsFor = day => [
      { id: 'protein', name: 'Hit your protein goal', progress: Math.min(day.protein, state.proteinGoal), target: state.proteinGoal, xp: 30 },
      { id: 'meals', name: 'Log 3 meals', progress: Math.min(day.meals.size, 3), target: 3, xp: 30 },
      { id: 'scan', name: 'Scan a photo or barcode', progress: Math.min(day.scans, 1), target: 1, xp: 20 }
    ].map(quest => ({ ...quest, complete: quest.progress >= quest.target }));
    let xp = logs * 10, questXP = 0, run = 0, longest = 0, last = null, proteinHit = false, balanced = false;
    [...days.keys()].sort().forEach(key => {
      run = last === previousDay(key) ? run + 1 : 1;
      longest = Math.max(longest, run); last = key;
      const day = days.get(key);
      day.grade = grade(day.kcal, day.protein, state.target, state.proteinGoal);
      day.xp = key < today && ['S', 'A'].includes(day.grade) ? 50 + (day.grade === 'S' ? 25 : 0) : 0;
      day.quests = questsFor(day);
      day.questXP = day.quests.reduce((sum, quest) => sum + (quest.complete ? quest.xp : 0), 0);
      questXP += day.questXP;
      xp += day.xp + day.questXP;
      proteinHit ||= day.protein >= state.proteinGoal;
      balanced ||= key < today && day.grade === 'S';
    });
    let streak = 0, cursor = days.has(today) ? today : previousDay(today);
    while (days.has(cursor)) { streak++; cursor = previousDay(cursor); }
    const level = THRESHOLDS.findLastIndex(threshold => xp >= threshold);
    const unlocked = { first: logs > 0, logs25: logs >= 25, streak3: longest >= 3, streak7: longest >= 7, streak30: longest >= 30, protein: proteinHit, balanced };
    const quests = days.get(today)?.quests || questsFor({ protein: 0, meals: new Set(), scans: 0 });
    return { xp, questXP, quests, level, name: LEVELS[level], floor: THRESHOLDS[level], next: THRESHOLDS[level + 1] ?? null, streak, longest, days, badges: BADGES.map(badge => ({ ...badge, unlocked: unlocked[badge.id] })) };
  }
  const api = { derive, grade, previousDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RECGame = api;
})(globalThis);
