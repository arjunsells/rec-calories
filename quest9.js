'use strict';
// CHAD v9 · scoring and calendar (unchanged since v5; entries indexed by day since v8) and the four screens.
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
  const deload = key => [['2026-12-28','2027-01-03'],['2027-02-08','2027-02-14'],['2027-03-22','2027-03-28'],['2027-05-03','2027-05-09']].some(([a,b])=>key>=a&&key<=b);
  const training = [
    {name:'REST',icon:'◇',muscles:'Recovery · full body',ex:['45–60 min walk','Mobility and foam roll'],cardio:'45–60 min walk',note:'Sauna or ice bath: Sunday only.'},
    {name:'PUSH',icon:'↑',muscles:'Chest · shoulders · triceps',ex:['Incline DB press|3x6–10','Machine chest press|3x8–12','Seated DB shoulder press|2x6–10','Cable side raise|4x12–20','Overhead cable triceps ext|3x10–15'],cardio:'2 km Zone 2'},
    {name:'PULL',icon:'↓',muscles:'Back · rear delts · traps · biceps · abs',ex:['Pull-ups|3x6–10','Chest-supported row|3x8–12','Single-arm pulldown|2x10–15','Rear delt fly|3x12–20','DB shrugs|3x10–15','Incline DB curl|3x8–12','Hanging leg raise|3x10–15'],cardio:'30–40 min incline walk or bike'},
    {name:'MUAY THAI ONLY',icon:'✕',muscles:'Conditioning · full body',ex:['10 min warm-up','Muay Thai · 6:30 pm','10 min stretch'],cardio:'Muay Thai class',note:'No gym. 5 pm snack: banana + YoPRO.'},
    {name:'DELTS + ARMS',icon:'✚',muscles:'Delts · biceps · triceps · abs',ex:['Machine side raise|4x12–20','Machine shoulder press|2x8–12','Reverse pec deck|2x15–20','EZ curl|3x8–12','Pushdown|3x10–15','Hammer curl|2x10–15','Dips|2x8–12','Cable crunch|3x10–15'],cardio:'2 km Zone 2',note:'Lighter pump day.'},
    {name:'UPPER',icon:'↗',muscles:'Upper chest · back width · delts',ex:['Smith incline|3x6–10','T-bar or seal row|3x6–10','Low-to-high cable fly|3x12–15','Lat pulldown|3x8–12','Side raise|3x12–20'],cardio:'30–40 min incline walk or bike'},
    {name:'SPRINTS + LEGS',icon:'Ⅱ',muscles:'Quads · hamstrings · glutes · calves · abs',ex:['10 min warm-up','Hill sprints|6–8 x 10–15 s','Hack squat|3x6–10','RDL|3x6–8','Leg press|2x10–15','Seated leg curl|3x10–15','Leg extension|2x12–15','Calf raise|4x10–15','Hanging leg raise|3x10–15'],cardio:'Hill sprints (in session)',note:'The one leg day. No run.'}
  ];
  // v8: entries are indexed by day once per journal array (every save replaces the array), so a render no longer
  // rescans the whole history for each of the ~500 day lookups behind streaks, weeks, charts and the heatmap.
  const byDay=new WeakMap();
  function entriesOn(state,key) {
    let index=byDay.get(state.entries);
    if(!index||index.size!==state.entries.length){index={size:state.entries.length,days:new Map()};for(const e of state.entries){const list=index.days.get(e.day);if(list)list.push(e);else index.days.set(e.day,[e]);}byDay.set(state.entries,index);}
    return index.days.get(key)||[];
  }
  function daily(state,key) {
    const q=state.questsV5?.[key]||{}, entries=entriesOn(state,key);
    const totals=entries.reduce((t,e)=>t.map((v,i)=>v+(e[['kcal','protein','carbs','fat'][i]]||0)),[0,0,0,0]);
    const picks=q.picks||{}; const protein=totals[1]>=210; const water=(q.water||0)>=waterGoal(key);
    const score=Object.values(picks).reduce((s,p)=>s+({S:3,M:2,F:1}[p]||0),0)+(protein?2:0)+(water?2:0)+(q.steps?1:0);
    return {...q,picks,totals,score,protein,waterHit:water,grade:score>=15?'S':score>=12?'A':score>=9?'B':'C'};
  }
  function week(state,start,today) {let total=0,free=0,complete=true;for(let i=0;i<7;i++){const key=shift(start,i),d=daily(state,key);total+=d.score;free+=Object.values(d.picks).filter(p=>p==='F').length;complete&&=key<=today&&Object.keys(d.picks).length===4;} const bonus=complete&&free<=2?10:0;return {total:total+bonus,free,bonus,complete};}
  function stats(state,today) {
    const keys=[...new Set([...state.entries.map(e=>e.day),...Object.keys(state.questsV5||{})])].filter(k=>k<=today).sort();
    let streak=0,cursor=daily(state,today).score>=9?today:shift(today,-1);
    while(daily(state,cursor).score>=9){streak++;cursor=shift(cursor,-1);}
    let longest=0,run=0,last='',pRun=0,wRun=0,maxP=0,maxW=0,perfect=false,fight=false,zero=false;
    for(const key of keys){const d=daily(state,key),adj=last===shift(key,-1);run=d.score>=9?(adj?run+1:1):0;pRun=d.protein?(adj?pRun+1:1):0;wRun=d.waterHit?(adj?wRun+1:1):0;longest=Math.max(longest,run);maxP=Math.max(maxP,pRun);maxW=Math.max(maxW,wRun);perfect||=d.score===17;fight||=weekday(key)===3&&d.waterHit&&d.electrolyte&&d.picks.D==='S';const w=week(state,monday(key),today);zero||=w.complete&&w.free===0;last=key;}
    const w=week(state,monday(today),today),level=w.total>=120?'AJ Mode':w.total>=105?'Champion':w.total>=85?'Beast':w.total>=60?'Grinder':'Rookie';
    return {streak,longest,week:w,level,maxP,maxW,perfect,fight,zero};
  }
  function rewards(state,key,g){
    const legacy=state.legacyRewards||{}, keys=Object.keys(state.questsV5||{}).filter(k=>k<=key);
    const questXP=keys.reduce((sum,k)=>{const d=daily(state,k),exercises=d.training?training[weekday(k)].ex.length:Object.values(d.exercises||{}).filter(Boolean).length;return sum+10*(Object.keys(d.picks).length+['electrolyte','cardio','steps','sleep'].filter(f=>d[f]).length+Math.ceil(d.water||0)+exercises);},0);
    g.xp=Math.max(g.xp,legacy.xp||0)+questXP;
    const floors=[0,100,300,700,1400,2500],names=['Fresh Start','Building Momentum','Daily Contender','Goal Crusher','Elite Form','CHAD Legend'];
    g.level=floors.findLastIndex(n=>g.xp>=n);g.floor=floors[g.level];g.next=floors[g.level+1]??null;g.name=names[g.level];
    g.badges.forEach(b=>b.unlocked||=!!legacy.badges?.includes(b.id));
    return g;
  }

  /* ---- v9 screens. Everything above is scoring and calendar logic: the same results as v5-v8. ----
     Every change goes through api.change() (app9.js): the journal is written first, then the toast offers Undo,
     and Undo offers Redo. Each direction touches only its own fields, so newer unrelated edits survive. */
  const LEVELS = [['Fresh Start', 0], ['Building Momentum', 100], ['Daily Contender', 300], ['Goal Crusher', 700], ['Elite Form', 1400], ['CHAD Legend', 2500]];
  const TIER = { S: 'Strict', M: 'Medium', F: 'Free' }, TIER_CLASS = { S: 'strict', M: 'medium', F: 'free' };
  const QUESTS = [['electrolyte', 'Hydralyte', 'electrolyte', 'Hydralyte'], ['training', 'Training', 'dumbbell', 'Training'], ['cardio', 'Cardio', 'run', 'Cardio'], ['steps', 'Steps', 'shoe', '10k steps'], ['sleep', 'Sleep', 'sleep', 'Sleep']];
  const BADGE_ICON = { first: 'bolt', logs25: 'target', streak3: 'flame', streak7: 'trophy', streak30: 'sparkles', protein: 'dumbbell', balanced: 'star', protein7: 'fork', water7: 'drop', zero: 'leaf', fight: 'glove', perfect: 'crown' };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ADDONS = { reset: [['shake', 'Daily shake', [610, 38, 83, 13]], ['banana', 'Extra banana', [89, 1.1, 23, .3]]], bulk: [['bagel', 'Plain bagel', [313, 10, 60, 2]], ['wrap', 'Protein wrap', [175, 10, 24, 4]], ['shake', 'Daily shake', [610, 38, 83, 13]]] };
  let api, current, lastStreak = null, lastGrade = null, settingsReady = false, chartRange = 7, themeShown, pinned = null, pinTimer, open = null, lastOpen = null, lastLead = null, lastTap = { id: null, t: 0 }, settleUntil = 0;
  const bestStreak = new Map(), sRanked = new Set();                 // celebrations happen once, however often a day is undone and redone
  const M = () => window.CHADMotion;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (cls, fn, text) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.onclick = fn; return b; };
  const icon = (name, size, opts) => window.CHADIcons.icon(name, size, opts);
  const oneDecimal = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }), fmt = n => oneDecimal.format(n), whole = n => Math.round(n).toLocaleString('en-AU');
  const activeKey = () => api.key || dayKey();
  const shortDate = key => new Date(key + 'T12:00:00+09:30').toLocaleDateString('en-AU', { timeZone: 'Australia/Darwin', weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const nice = name => name.charAt(0) + name.slice(1).toLowerCase();
  const macroWords = m => whole(m[0]) + ' kcal, protein ' + whole(m[1]) + ' g, carbs ' + whole(m[2]) + ' g, fat ' + whole(m[3]) + ' g';
  const floatXP = node => { const gain = api.xpGain ? api.xpGain() : 0; if (node && gain > 0) M()?.floater(node, '+' + gain + ' XP'); };
  function chime() { if (!current.arcadeSound || matchMedia('(prefers-reduced-motion: reduce)').matches) return; try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [523, 659, 784].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.025, ac.currentTime + i * .07); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + i * .07 + .1); o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * .07); o.stop(ac.currentTime + i * .07 + .11); }); setTimeout(() => ac.close(), 600); } catch { /* Sound remains optional. */ } }
  // A second tap on the same control within 400 ms would cancel the first: that is a slip, so the first one stands.
  function slip(id, e) {
    const t = e && e.timeStamp;
    if (!t) return false;
    const twice = lastTap.id === id && t >= lastTap.t && t - lastTap.t < 400;
    lastTap = { id, t };
    return twice;
  }
  // After a log moves the meals (the next one takes the top, an opened one folds), cards ignore touches until the move
  // is done: 700 ms while the logged card holds its place, 300 ms without motion. The second tap of a double tap must
  // neither undo the log nor land on the meal that slides under the finger. Undo in the toast is always there.
  const settling = e => !!(e && e.timeStamp && e.timeStamp < settleUntil);

  /* ---- changes ---- */
  // Some fields of one day. Undo puts back exactly those fields; containers that did not exist are dropped again.
  function update(patch, o) {
    const key = o.key || activeKey(), old = current.questsV5?.[key] || {}, was = api.shape(current, key);
    const before = Object.fromEntries(Object.keys(patch).map(k => [k, old[k]]));
    return api.change({ label: o.label, kind: o.kind || (o.positive ? 'on' : 'off'), positive: !!o.positive, day: key, onApply: o.positive ? chime : null,
      forward: s => api.patchDay(s, key, patch), backward: s => api.patchDay(s, key, before, was) });
  }
  // A meal slot: tap a card to log it, tap it again to remove it, tap another card to switch (never a duplicate).
  function pick(slot, tier, e) {
    const key = activeKey(), day = current.questsV5?.[key] || {}, picked = day.picks?.[slot.id], removing = picked === tier, was = api.shape(current, key), hadPicks = day.picks !== undefined;
    const prior = current.entries.map((e, i) => ({ e, i })).filter(({ e }) => e.day === key && e.planSlot === slot.id);
    const c = slot.choices.find(x => x.tier === tier);
    const entry = { id: 'plan-' + key + '-' + slot.id, day: key, name: c.title, kcal: c.macros[0], protein: c.macros[1], carbs: c.macros[2], fat: c.macros[3], meal: slot.name, source: 'plan', planSlot: slot.id };
    const others = s => s.entries.filter(e => !(e.day === key && e.planSlot === slot.id));
    const picksWith = (s, t) => { const p = { ...s.questsV5?.[key]?.picks }; if (t) p[slot.id] = t; else delete p[slot.id]; return p; };
    M()?.mark(`#today [data-slot="${slot.id}"][data-tier="${tier}"]`, null, node => { if (!node) return; M().pulse(node.parentElement, removing ? 'just-off' : 'just-on'); if (!removing) floatXP(node.parentElement); });
    const opened = open && open.key === key && open.id === slot.id;
    if (!removing && (opened || !picked)) { const still = hold(slot.id, key, opened); if (e && e.timeStamp) settleUntil = e.timeStamp + Math.max(300, still); }
    const ok = api.change({
      label: removing ? slot.name + ' removed' : picked ? slot.name + ' · ' + TIER[tier] : slot.name + ' logged', kind: removing ? 'off' : 'on', positive: !removing, day: key, onApply: removing ? null : chime,
      forward: s => ({ ...api.patchDay(s, key, { picks: picksWith(s, removing ? null : tier) }), entries: removing ? others(s) : [...others(s), entry] }),
      backward: s => { const p = picksWith(s, picked); return { ...api.patchDay(s, key, { picks: Object.keys(p).length || hadPicks ? p : undefined }, was), entries: api.restoreAt(others(s), prior) }; }
    });
    if (!ok) { clearTimeout(pinTimer); pinned = null; }
  }
  // A meal just logged stays where it is for a beat so its tick is seen; then the next meal takes the top, and a meal
  // that was opened from its row folds back into it. Without motion both happen at once.
  function hold(id, key, wasOpen) {
    clearTimeout(pinTimer); pinned = null;
    const settle = () => { if (wasOpen && open && open.key === key && open.id === id) open = null; };
    if (!M() || M().reduced()) { settle(); return 0; }
    pinned = wasOpen ? null : { id, key };
    pinTimer = setTimeout(() => { pinned = null; settle(); api.refresh(); M()?.pulse(document.querySelector(`#today [data-meal-row="${id}"]`), 'just-on'); }, 700);
    return 700;
  }
  // Training (Today) and Complete session (Training): switching it on leaves the ticks underneath alone, so
  // switching it off again gives back exactly what was ticked before. A session ticked in full clears completely.
  function toggleSession(key, labels) {
    const q = daily(current, key), plan = training[weekday(key)].ex;
    if (!q.training) return update({ training: true }, { key, positive: true, label: labels[0] });
    return update(plan.every((_, x) => q.exercises?.[x]) ? { training: false, exercises: undefined } : { training: false }, { key, kind: 'off', label: labels[1] });
  }
  function toggleQuest(field, label, key) {
    if (field === 'training') return toggleSession(key, ['Training logged', 'Training removed']);
    const done = !!daily(current, key)[field];
    return update({ [field]: !done }, { key, positive: !done, label: label + (done ? ' removed' : ' logged') });
  }
  // Long press opens the same sheet as the slot's details button, without logging.
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
  // One sheet per meal slot: the three options side by side, ingredients, macros, tip and swap, and one button to log.
  function mealSheet(slot, tier) {
    const key = activeKey(), seg = el('div', 'ch-seg ch-tiers'), body = el('div', 'ch-mealsheet');
    let shown = tier;
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', slot.name + ' options'); seg.style.setProperty('--n', 3);
    const paint = () => {
      const picked = daily(current, key).picks[slot.id], c = slot.choices.find(x => x.tier === shown), selected = picked === shown;
      seg.style.setProperty('--i', 'SMF'.indexOf(shown));
      [...seg.children].forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.tier === shown)); b.classList.toggle('is-logged', b.dataset.tier === picked); });
      const list = el('ul', 'ch-bullets'); c.items.forEach(item => list.append(el('li', '', item)));
      const nodes = [el('h3', 'ch-mealsheet__title', c.title), window.CHADUX.macroTiles(c.macros), list, note('lightbulb', c.tip)];
      if (c.fix !== c.tip) nodes.push(note('swap', c.fix));
      const label = selected ? 'Remove from ' + slot.name.toLowerCase() : picked ? 'Switch to ' + TIER[shown].toLowerCase() : 'Log ' + TIER[shown].toLowerCase() + ' ' + slot.name.toLowerCase();
      nodes.push(button('ch-btn ch-btn--block' + (selected ? '' : ' ch-btn--gold'), () => { window.CHADUX.closeSheets(); pick(slot, shown); }, label));
      nodes.push(button('ch-link ch-link--center', () => window.CHADUX.openFood('camera', slot.id === 'P' || slot.id === 'E' ? 'Snacks' : slot.name), 'Log something else'));
      body.replaceChildren(...nodes);
    };
    for (const t of ['S', 'M', 'F']) {
      const b = button('ch-tier ch-tier--' + TIER_CLASS[t], () => { if (shown === t) return; shown = t; M()?.haptic('tap'); paint(); });
      b.dataset.tier = t; b.append(el('span', 'ch-tier__dot'), TIER[t]); seg.append(b);
    }
    paint();
    window.CHADUX.detail(slot.name, [seg, body]);
  }
  function phaseHint(state, key) {
    if (state.phaseMode === 'custom') return 'Custom goals';
    const p = phase(state, key);
    if (phases.some(x => x[0] === state.phaseMode)) return p[1];
    const ends = state.phaseEnds || phases.map(x => x[2]), end = ends[phases.findIndex(x => x[0] === p[0])];
    const left = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(key + 'T00:00:00Z')) / 86400000);
    return left >= 0 ? p[1] + ' · ' + (left === 0 ? 'last day' : left + 'd left') : p[1];
  }

  function render(state, actions) {
    current = state; api = actions;
    const key = activeKey(), today = dayKey(), d = daily(state, key), s = stats(state, today), p = phase(state, key);
    $('quest-hero').hidden = true;
    $('home-streak').innerHTML = icon('flame', 18) + '<b class="ch-px">' + s.streak + '</b>'; $('home-streak').setAttribute('aria-label', s.streak + ' day streak');
    $('streak-count').textContent = s.streak; $('streak').replaceChildren(el('span', '', s.streak === 1 ? 'day' : 'days'), el('span', '', 'best ' + Math.max(s.longest, s.streak)));
    $('daily-grade').textContent = d.grade; $('daily-grade').className = 'ch-grade ch-grade--sm ch-grade--' + d.grade.toLowerCase(); $('grade-detail').textContent = d.score + '/17 pts';
    if (lastStreak !== null && s.streak > lastStreak && s.streak > (bestStreak.get(today) || 0)) { bestStreak.set(today, s.streak); api.celebrate('Streak saved · ' + s.streak + (s.streak === 1 ? ' day' : ' days')); M()?.pulse($('home-streak'), 'just-on'); }
    else if (lastStreak !== null && s.streak < lastStreak) api.celebrate(null);                  // undone: take the banner back
    else if (lastGrade && lastGrade.key === key && lastGrade.grade !== 'S' && d.grade === 'S' && !sRanked.has(key)) { sRanked.add(key); api.celebrate('S rank · ' + d.score + '/17'); }
    if (lastStreak === null) bestStreak.set(today, s.streak);
    lastStreak = s.streak; lastGrade = { key, grade: d.grade };
    renderToday(state, key, d, p);
    const tile = $('weekly-progress');
    const caption = el('span', 'ch-tile__s'); caption.append(el('span', '', s.week.total + ' pts'), el('span', '', s.week.free > 2 ? 'no bonus' : s.week.bonus ? '+10 bonus' : s.week.free + '/2 Free'));
    tile.replaceChildren(el('span', 'ch-tile__k', 'This week'), el('span', 'ch-tile__v ch-tile__v--text', s.level), caption);
    // Only the tab on screen is rebuilt; app9.js renders again when the tab changes.
    if (!$('training').hidden) renderTraining(state, key);
    if (!$('history').hidden) { renderCharts(state, key); renderBadges(s); }
    renderSettings(state, key, d);
  }

  /* ---- Today: the next meal open, water and habits, the other meals as quiet rows that open in place ---- */
  const isOpen = (id, key) => !!open && open.key === key && open.id === id;
  function leadSlot(d, key) {
    if (pinned && pinned.key === key) return CHADPlan.find(x => x.id === pinned.id);
    const start = key === dayKey() ? Math.max(0, CHADPlan.findIndex(x => x.id === window.CHADUX.currentSlot())) : 0;
    // The first meal still to log, counting from now. A meal opened from its row stays where it was opened.
    return Array.from({ length: 4 }, (_, i) => CHADPlan[(start + i) % 4]).find(x => !d.picks[x.id] && !isOpen(x.id, key)) || null;
  }
  function renderToday(state, key, d, p) {
    const list = $('daily-checklist'), glide = M()?.flip(list, '[data-flip]', n => n.dataset.flip), lead = leadSlot(d, key);
    list.replaceChildren();
    if (lead) list.append(slotBlock(state, lead, d, key, 'lead'));
    list.append(dailyCard(d, key), ...otherMeals(state, d, key, lead));
    if (p[0] !== 'cut') list.append(addonsCard(state, key, p));
    glide?.();
    lastLead = lead ? { id: lead.id, key } : null; lastOpen = open && open.key === key ? { ...open } : null;
  }
  const logged = (state, slot, d, key) => {
    const picked = d.picks[slot.id], c = picked && slot.choices.find(x => x.tier === picked), eaten = state.entries.find(e => e.day === key && e.planSlot === slot.id);
    return { picked, c, kcal: eaten ? eaten.kcal : c ? c.macros[0] : null };
  };
  // A meal with its three options. The lead is the next meal; an opened one folds back into its row with a tap.
  function slotBlock(state, slot, d, key, mode) {
    const { picked, kcal } = logged(state, slot, d, key), lead = mode === 'lead', block = el('section', 'meal-slot ch-slot' + (picked ? ' is-logged' : '') + (lead ? '' : ' is-open'));
    block.dataset.mealSlot = slot.id; block.dataset.flip = lead ? 'lead' : 'open-' + slot.id;
    if (lead) { block.id = 'next-up'; if (lastLead && lastLead.key === key && lastLead.id !== slot.id) block.classList.add('is-arriving'); }
    else if (!lastOpen || lastOpen.id !== slot.id || lastOpen.key !== key) block.classList.add('is-arriving');
    const head = el('div', 'ch-slot__head'), name = el('h2', 'ch-slot__name', slot.name), meta = el('span', 'ch-slot__meta');
    name.id = 'slot-heading-' + slot.id; block.setAttribute('aria-labelledby', name.id);
    if (picked) meta.innerHTML = icon('check', 14, { weight: 2.8 }) + TIER[picked] + (lead || kcal == null ? '' : ' · ' + whole(kcal) + ' kcal'); else meta.textContent = slot.time;
    const info = button('meal-info ch-slot__info', () => mealSheet(slot, picked || 'S')); info.innerHTML = icon('info', 20); info.setAttribute('aria-label', slot.name + ' details');
    if (lead) {
      const title = el('div', 'ch-slot__title');
      if (!picked) title.append(el('span', 'ch-chip ch-chip--next', 'Next'));
      title.append(name); head.append(title, meta, info);
    } else {
      const fold = button('ch-slot__fold', e => { if (slip('row-' + key + slot.id, e)) return; open = null; settleUntil = 0; M()?.haptic('tap'); api.refresh(); });
      fold.dataset.mealToggle = slot.id; fold.setAttribute('aria-expanded', 'true'); fold.setAttribute('aria-label', slot.name + ', fold away');
      fold.append(name, meta); fold.insertAdjacentHTML('beforeend', icon('chevron-up', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      head.append(fold, info);
    }
    block.append(head);
    const grid = el('div', 'meal-options ch-meals');
    for (const c of slot.choices) {
      const selected = picked === c.tier, card = el('div', 'meal-choice ch-meal ch-meal--' + TIER_CLASS[c.tier]);
      const b = button('meal-pick ch-meal__hit', e => { if (!slip('meal-' + key + slot.id + c.tier, e) && !settling(e)) pick(slot, c.tier, e); });
      b.dataset.slot = slot.id; b.dataset.tier = c.tier; b.setAttribute('aria-pressed', String(selected));
      b.setAttribute('aria-label', (selected ? 'Remove ' : picked ? 'Switch to ' : 'Log ') + TIER[c.tier] + ' ' + slot.name + ': ' + c.title + ', ' + macroWords(c.macros));
      const kcalText = el('span', 'ch-meal__kcal'); kcalText.innerHTML = whole(c.macros[0]) + '<small>kcal</small>';
      const macros = window.CHADUX.pcf(c.macros[1], c.macros[2], c.macros[3]); macros.classList.add('meal-macros');
      b.append(el('span', 'tier-label ch-meal__tier', TIER[c.tier]), el('span', 'meal-title ch-meal__name', c.title), kcalText, macros);
      longPress(b, () => mealSheet(slot, c.tier));
      card.append(b); grid.append(card);
    }
    block.append(grid);
    return block;
  }
  // The other meals in the order of the day. Each is one quiet row (logged: option and kcal; to come: its time);
  // a tap opens it in place with its three options. Rows next to each other share one card.
  function otherMeals(state, d, key, lead) {
    const out = []; let group = null;
    for (const slot of CHADPlan) {
      if (slot === lead) continue;
      if (isOpen(slot.id, key)) { group = null; out.push(slotBlock(state, slot, d, key, 'open')); continue; }
      if (!group) { group = el('section', 'ch-list ch-rows meal-rows'); group.dataset.flip = 'meals-' + slot.id; group.setAttribute('aria-label', lead ? 'Other meals' : 'Meals'); out.push(group); }
      const { picked, c, kcal } = logged(state, slot, d, key);
      const row = button('meal-row ch-cell' + (picked ? ' is-logged' : ''), e => { if (slip('row-' + key + slot.id, e)) return; open = { id: slot.id, key }; settleUntil = 0; M()?.haptic('tap'); api.refresh(); });
      row.dataset.mealRow = slot.id; row.setAttribute('aria-expanded', 'false');
      const status = el('span', 'ch-cell__status');
      if (picked) { status.innerHTML = icon('check', 15, { weight: 2.8 }); status.append(el('span', '', (TIER[picked] || picked) + (kcal != null ? ' · ' + whole(kcal) + ' kcal' : ''))); }
      else status.textContent = slot.time;
      row.append(el('span', 'ch-cell__title', slot.name), status);
      row.insertAdjacentHTML('beforeend', icon('chevron-down', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      row.setAttribute('aria-label', slot.name + (picked ? ', logged ' + (TIER[picked] || picked) + (c ? ', ' + c.title : '') + (kcal != null ? ', ' + whole(kcal) + ' kcal' : '') : ', ' + slot.time + ', not logged yet') + '. Show options');
      group.append(row);
    }
    return out;
  }
  function dailyCard(d, key) {
    const card = el('section', 'ch-card ch-daily daily-quests'), row = el('div', 'ch-water-row');
    card.dataset.flip = 'daily'; card.setAttribute('aria-label', 'Water and habits');
    const amount = d.water || 0, target = waterGoal(key), full = amount >= target, most = target + 2;
    // Tap anywhere on the bottles to add 500 mL, repeatedly. Taking water off has its own button that never moves.
    const add = button('water-row ch-water' + (full ? ' is-full' : ''), () => {
      if (amount >= most) { M()?.haptic('warn'); api.message('That is a lot of water for one day. Set the exact amount in Settings.'); return; }
      const next = Math.round(Math.min(most, amount + .5) * 10) / 10;
      M()?.mark(`.bottle[data-water="${Math.min(Math.ceil(target / .5) - 1, Math.floor(amount / .5))}"]`, full ? null : 'just-on', floatXP);
      if (!full && next >= target) M()?.mark('.water-row', 'just-on');
      update({ water: next }, { key, positive: true, label: !full && next >= target ? 'Water goal hit' : '500 mL added' });
    });
    add.setAttribute('aria-label', 'Add 500 mL water. ' + fmt(amount) + ' of ' + fmt(target) + ' L');
    const bottles = el('span', 'bottles ch-bottles'); bottles.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.ceil(target / .5); i++) {
      const b = el('i', 'bottle ch-bottle' + (amount > i * .5 ? ' filled' : '')); b.dataset.water = String(i); b.style.setProperty('--fill', Math.max(0, Math.min(1, (amount - i * .5) / .5))); bottles.append(b);
    }
    const total = el('span', 'water-total ch-water__val'); total.innerHTML = fmt(amount) + '<small>/' + fmt(target) + ' L</small>'; add.append(bottles, total);
    const minus = button('water-minus ch-water__minus', () => {
      const now = daily(current, key).water || 0; if (now <= 0) return;
      const next = Math.max(0, Math.round((now - .5) * 10) / 10);
      M()?.mark(`.bottle[data-water="${Math.ceil(now / .5) - 1}"]`, 'just-off');
      update({ water: next }, { key, kind: 'off', label: '500 mL removed' });
    });
    minus.innerHTML = icon('minus', 18, { weight: 2.6 }); minus.setAttribute('aria-label', 'Remove 500 mL water');
    if (amount <= 0) { minus.disabled = true; minus.classList.add('is-idle'); }
    row.append(add, minus); card.append(row);
    const chips = el('div', 'quest-chips ch-qchips');
    for (const [field, label, glyph, name] of QUESTS) {
      const done = !!d[field], b = button('quest-chip ch-qchip', e => {
        if (slip('quest-' + key + field, e)) return;
        M()?.mark(`#today [data-quest="${field}"]`, done ? 'just-off' : 'just-on', done ? null : floatXP);
        toggleQuest(field, label, key);
      });
      const disc = el('span', 'ch-qchip__icon'); disc.innerHTML = icon(glyph, 22);
      b.append(disc, el('span', 'ch-qchip__label', label));
      b.dataset.quest = field; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', String(done)); chips.append(b);
    }
    card.append(chips);
    return card;
  }
  function addonsCard(state, key, p) {
    const box = el('section', 'ch-card addons ch-addons'), row = el('div'); box.dataset.flip = 'addons'; box.append(el('h2', 'ch-h', p[1] + ' add-ons'), row);
    for (const [id, name, m] of ADDONS[p[0]]) {
      const eid = 'addon-' + key + '-' + id, has = state.entries.some(e => e.id === eid);
      const b = button('quest-chip ch-qchip ch-qchip--pill', e => {
        if (slip(eid, e)) return;
        const index = current.entries.findIndex(x => x.id === eid), old = current.entries[index], on = index >= 0;
        const entry = { id: eid, day: key, name, kcal: m[0], protein: m[1], carbs: m[2], fat: m[3], source: 'addon', meal: 'Snacks' };
        M()?.mark(`.addons [data-addon="${id}"]`, on ? 'just-off' : 'just-on', on ? null : floatXP);
        api.change({ label: name + (on ? ' removed' : ' logged'), kind: on ? 'off' : 'on', positive: !on, day: key, onApply: on ? null : chime,
          forward: s => ({ ...s, entries: on ? s.entries.filter(x => x.id !== eid) : [...s.entries.filter(x => x.id !== eid), entry] }),
          backward: s => ({ ...s, entries: on ? api.restoreAt(s.entries.filter(x => x.id !== eid), [{ e: old, i: index }]) : s.entries.filter(x => x.id !== eid) }) });
      }, name + ' · ' + m[0] + ' kcal');
      b.dataset.addon = id; b.setAttribute('aria-pressed', String(has)); row.append(b);
    }
    return box;
  }
  // Add-on entries that a pill on Today already shows (everything else logged appears under "Other food").
  function shownAddons(state, key) { const p = phase(state, key); return new Set(ADDONS[p[0]] ? ADDONS[p[0]].map(([id]) => 'addon-' + key + '-' + id) : []); }

  /* ---- Training: the day's session, then the rest of the week as rows ---- */
  function records(state) {
    const latest = {}, best = {};
    for (const key of Object.keys(state.questsV5 || {}).sort()) for (const [name, r] of Object.entries(state.questsV5[key]?.topSets || {})) {
      if (!r || typeof r.kg !== 'number' || typeof r.reps !== 'number') continue;
      latest[name] = r; if (!best[name] || r.kg * (1 + r.reps / 30) > best[name].kg * (1 + best[name].reps / 30)) best[name] = r;
    }
    return { latest, best };
  }
  function exerciseDetail(session, sessionKey, name, sets) {
    const nodes = [el('p', 'ch-hint', session.muscles), note('lightbulb', session.note || 'Stop 2 reps before failure. Add reps, then weight.')];
    if (sets && name !== 'Hill sprints') {
      const form = el('form', 'top-set-form'), kg = el('input', 'ch-input'), reps = el('input', 'ch-input'), rec = records(current);
      const field = (input, label, id) => { const f = el('div', 'ch-field'), l = el('label', 'ch-label', label); input.id = id; l.htmlFor = id; f.append(l, input); return f; };
      kg.type = reps.type = 'number'; kg.min = '0'; kg.max = '1000'; kg.step = '.5'; kg.inputMode = 'decimal'; kg.placeholder = 'kg'; kg.setAttribute('aria-label', name + ' weight kg');
      reps.min = '1'; reps.max = '200'; reps.inputMode = 'numeric'; reps.placeholder = 'reps'; reps.setAttribute('aria-label', name + ' reps'); kg.required = reps.required = true;
      const old = daily(current, sessionKey).topSets?.[name] || rec.latest[name]; if (old) { kg.value = old.kg; reps.value = old.reps; }
      if (rec.best[name]) { const row = el('div', 'ch-best'); row.append(el('span', '', 'Best top set'), el('b', '', fmt(rec.best[name].kg) + ' kg × ' + rec.best[name].reps)); form.append(row); }
      const submit = el('button', 'secondary ch-btn ch-btn--primary', 'Save top set'); submit.type = 'submit';
      form.append(field(kg, 'Weight (kg)', 'top-set-kg'), field(reps, 'Reps', 'top-set-reps'), submit);
      form.onsubmit = e => {
        e.preventDefault(); if (!form.reportValidity()) return;
        const record = { kg: Number(kg.value), reps: Number(reps.value) }, value = record.kg * (1 + record.reps / 30), best = Math.max(0, ...Object.values(current.questsV5 || {}).map(d => d.topSets?.[name]).filter(Boolean).map(r => r.kg * (1 + r.reps / 30)));
        window.CHADUX.closeSheets();
        if (!update({ topSets: { ...daily(current, sessionKey).topSets, [name]: record } }, { key: sessionKey, kind: 'save', label: 'Top set saved' })) return;
        if (value > best) { api.celebrate('Personal record · ' + name); M()?.haptic('success'); M()?.confetti(document.querySelector(`.training-level[data-day="${sessionKey}"]`)); chime(); }
      };
      nodes.push(form);
    }
    window.CHADUX.detail(name, nodes);
  }
  function renderTraining(state, key) {
    const box = $('training-content'); box.replaceChildren();
    if (deload(key)) { const banner = el('div', 'deload ch-deload'); banner.innerHTML = icon('leaf', 20); banner.append(el('span', '', 'Deload week · half sets')); box.append(banner); }
    const i = weekday(key), start = monday(key), session = training[i], q = daily(state, key), rec = records(state), today = dayKey();
    const card = el('section', 'training-level ch-session is-today' + (q.training ? ' is-done' : '')); card.dataset.day = key;
    const head = el('div', 'ch-session__head'), text = el('div', 'ch-grow'), doneN = session.ex.filter((_, x) => q.training || q.exercises?.[x]).length;
    text.append(el('p', 'ch-eyebrow', (key === today ? 'Today · ' : '') + DOW[i]), el('h2', 'ch-session__name', nice(session.name)), el('p', 'ch-session__focus', session.muscles));
    const ring = el('div', 'ch-ring'); ring.style.setProperty('--p', doneN / session.ex.length * 100); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', doneN + ' of ' + session.ex.length + ' done');
    ring.append(el('strong', '', doneN + '/' + session.ex.length)); head.append(text, ring); card.append(head);
    session.ex.forEach((line, j) => {
      const [name, sets] = line.split('|'), row = el('div', 'exercise ch-ex'), exDone = !!q.training || !!q.exercises?.[j]; let prescription = sets || '';
      if (deload(key) && prescription) prescription = prescription.replace(/^(\d+)(?:–(\d+))?/, (_, a, b) => Math.ceil(Number(a) / 2) + (b ? '–' + Math.ceil(Number(b) / 2) : ''));
      const b = button('exercise-toggle ch-ex__hit', e => {
        if (slip('ex-' + key + j, e)) return;
        const now = daily(current, key), done = !!now.training || !!now.exercises?.[j], ex = { ...now.exercises, [j]: !done }; if (now.training) session.ex.forEach((_, x) => ex[x] = x !== j);
        M()?.mark(`.training-level[data-day="${key}"] [data-exercise="${j}"]`, null, node => { if (!node) return; M().pulse(node.parentElement, done ? 'just-off' : 'just-on'); if (!done) floatXP(node.firstChild); });
        update({ exercises: ex, training: session.ex.every((_, x) => ex[x]) }, { key, positive: !done, label: done ? name + ' unticked' : name + ' done' });
      });
      b.append(el('span', 'ch-ex__check'), el('span', 'ch-ex__name', name)); if (prescription) b.append(el('span', 'ch-ex__meta', prescription.replace('x', ' × ')));
      b.setAttribute('aria-label', name + (prescription ? ', ' + prescription : '')); b.dataset.exercise = String(j); b.setAttribute('aria-pressed', String(exDone)); row.append(b);
      longPress(b, () => exerciseDetail(session, key, name, sets));
      // Details earn a button only where there is something to record: the top set of a strength move.
      if (sets && name !== 'Hill sprints') {
        const info = button('exercise-info ch-ex__info', () => exerciseDetail(session, key, name, sets)), top = rec.latest[name];
        if (top) info.append(el('span', 'ch-ex__set', fmt(top.kg) + '×' + top.reps)); else info.innerHTML = icon('info', 20);
        info.setAttribute('aria-label', name + ' details and top set' + (top ? ', last ' + fmt(top.kg) + ' kg for ' + top.reps : '')); row.append(info);
      }
      card.append(row);
    });
    const wrap = el('div', 'ch-session__all'), all = button('quest-chip ch-qchip ch-qchip--pill', e => {
      if (slip('session-' + key, e)) return;
      M()?.mark(`.training-level[data-day="${key}"] [data-quest="training"]`, daily(current, key).training ? 'just-off' : 'just-on', daily(current, key).training ? null : floatXP);
      toggleSession(key, ['Session complete', 'Session reopened']);
    });
    all.dataset.quest = 'training'; all.setAttribute('aria-pressed', String(!!q.training));
    if (q.training) all.innerHTML = icon('check', 18, { weight: 2.6 }); all.append(q.training ? 'Session complete' : 'Complete session');
    wrap.append(all); card.append(wrap);
    const foot = el('div', 'cardio-note ch-session__foot'); foot.innerHTML = icon(i === 0 ? 'leaf' : 'run', 16);
    const words = el('p'); words.append(session.cardio); if (session.note) words.append(el('small', '', session.note)); foot.append(words); card.append(foot);
    box.append(card);
    const head2 = el('div', 'ch-section'); head2.append(el('h2', 'ch-h', 'This week'));
    const rows = el('section', 'ch-list ch-rows week-rows'); rows.setAttribute('aria-label', 'Rest of the week');
    for (const j of [1, 2, 3, 4, 5, 6, 0]) {
      if (j === i) continue;
      const k = shift(start, (j + 6) % 7), other = training[j], qq = daily(state, k), n = other.ex.filter((_, x) => qq.training || qq.exercises?.[x]).length;
      const row = button('training-row ch-cell' + (qq.training ? ' is-done' : ''), () => window.CHADUX.goTo(k)), title = el('span', 'ch-cell__title');
      row.dataset.day = k; title.append(el('small', '', k === today ? 'Today' : DOW[j]), nice(other.name));
      const status = el('span', 'ch-cell__status');
      if (qq.training) { status.innerHTML = icon('check', 15, { weight: 2.8 }); status.append(el('span', '', 'Done')); } else status.textContent = n ? n + ' of ' + other.ex.length : other.ex.length + (other.ex.length === 1 ? ' move' : ' moves');
      row.append(title, status); row.insertAdjacentHTML('beforeend', icon('chevron', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      row.setAttribute('aria-label', (k === today ? 'Today, ' : '') + DOW[j] + ', ' + nice(other.name) + ', ' + (qq.training ? 'done' : n + ' of ' + other.ex.length + ' done') + '. Open this day');
      rows.append(row);
    }
    box.append(head2, rows);
  }

  /* ---- Progress ---- */
  function chartCard(title, kpi, points, color, kind) {
    const card = el('section', 'ch-card chart-card'), head = el('div', 'chart-card__head'), chart = el('div', 'ch-chart');
    head.append(el('h2', '', title), el('span', '', kpi || '')); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', title + (kpi ? ', ' + kpi : ''));
    card.append(head, chart);
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
  function renderCharts(state, key) {
    const box = $('charts'); box.replaceChildren();
    const d = daily(state, key), g = goals(state, key), rings = el('section', 'ch-card chart-card'), row = el('div', 'progress-rings'), head = el('div', 'chart-card__head');
    head.append(el('h2', '', key === dayKey() ? 'Today' : shortDate(key)), el('span', '', phaseHint(state, key))); rings.append(head, row);
    for (const [label, value, goal, color] of [['kcal', d.totals[0], g.target, '--ch-ring-move'], ['protein', d.totals[1], g.proteinGoal, '--ch-ring-exercise'], ['score', d.score, 17, '--ch-ring-stand']]) {
      const ring = el('div', 'progress-ring'); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', label + ': ' + fmt(value) + ' / ' + goal); row.append(ring);
      ring.paint = animate => CHADCharts.ring(ring, Math.min(100, value / goal * 100), { color, sub: label, animate: !!animate });
    }
    box.append(rings);
    const controls = el('div', 'chart-controls ch-seg'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Chart range'); controls.style.setProperty('--n', 2); controls.style.setProperty('--i', chartRange === 7 ? 0 : 1);
    [7, 30].forEach(n => { const b = button('', () => { if (chartRange === n) return; chartRange = n; M()?.haptic('tap'); renderCharts(current, activeKey()); }, n + ' days'); b.setAttribute('aria-pressed', String(chartRange === n)); controls.append(b); });
    box.append(controls);
    const data = Array.from({ length: chartRange }, (_, i) => shift(key, i - chartRange + 1)).map(k => ({ key: k, d: daily(state, k) }));
    const kcal = mean(data.map(x => x.d.totals[0])), protein = mean(data.map(x => x.d.totals[1])), litres = mean(data.map(x => x.d.water), 1), score = mean(data.map(x => x.d.score), 1);
    const weight = data.map(({ key: k }) => { const values = Array.from({ length: 7 }, (_, i) => daily(state, shift(k, -i)).weight).filter(v => typeof v === 'number' && v > 0); return { key: k, value: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null }; });
    box.append(
      chartCard('Calories', kcal && 'avg ' + kcal + ' kcal', data.map(({ key: k, d }) => ({ key: k, value: d.totals[0], goal: goals(state, k).target })), '--ch-ring-move', 'bar'),
      chartCard('Protein', protein && 'avg ' + protein + ' g', data.map(({ key: k, d }) => ({ key: k, value: d.totals[1] })), '--ch-ring-exercise', 'line'),
      chartCard('Weight', '7-day average, kg', weight, '--ch-indigo', 'weight'),
      chartCard('Water', litres && 'avg ' + litres + ' L', data.map(({ key: k, d }) => ({ key: k, value: d.water || 0, goal: waterGoal(k) })), '--ch-water', 'bar'),
      chartCard('Daily score', score && 'avg ' + score + ' / 17', data.map(({ key: k, d }) => ({ key: k, value: d.score, goal: 17 })), '--ch-ring-stand', 'bar'));
    const heat = el('section', 'ch-card chart-card'), heatHead = el('div', 'chart-card__head'), pixels = Array.from({ length: 91 }, (_, i) => { const k = shift(key, i - 90); return { key: k, value: daily(state, k).score / 17 }; });
    heatHead.append(el('h2', '', '13 weeks'), el('span', '', pixels.filter(p => p.value >= 9 / 17).length + ' days at B or better'));
    const squares = el('div', 'ch-chart streak-chart'); squares.setAttribute('role', 'img'); squares.setAttribute('aria-label', '91 days of daily quest scores'); heat.append(heatHead, squares);
    const values = el('details', 'chart-values'); values.append(el('summary', '', 'Daily scores')); pixels.forEach(p => values.append(el('p', 'ch-hint', p.key + ': ' + Math.round(p.value * 17) + '/17'))); heat.append(values); box.append(heat);
    heat.paint = animate => CHADCharts.heatmap(squares, pixels, { max: 1, today: 90, animate: !!animate });
    paintCharts();
  }
  function paintCharts(animate) { if ($('history').hidden) return; document.querySelectorAll('#charts .chart-card, #charts .progress-ring').forEach(c => c.paint?.(animate)); CHADCharts.redraw(); }
  function renderBadges(s) {
    const shelf = $('badges'); shelf.replaceChildren();
    const quest = [['protein7', 'Protein Streak', '7 days at 210 g+', s.maxP >= 7], ['water7', 'Hydration Hero', '7 days on water target', s.maxW >= 7], ['zero', 'Zero-Free Week', 'Complete Mon–Sun, no Free picks', s.zero], ['fight', 'Fight Night Fuel', 'Wednesday: water, electrolyte, Strict dinner', s.fight], ['perfect', 'Perfect Day', '17 / 17 daily points', s.perfect]];
    const all = [...(api.game?.badges || []).map(b => [b.id, b.name, b.hint, b.unlocked]), ...quest];
    for (const [id, name, hint, unlocked] of all) {
      const li = el('li', 'badge ' + (unlocked ? 'unlocked' : 'locked')), disc = el('span', 'badge-icon'); li.dataset.badge = id;
      disc.innerHTML = icon(unlocked ? BADGE_ICON[id] || 'star' : 'lock', 22); li.append(disc, el('strong', '', name), el('small', '', hint)); shelf.append(li);
    }
    $('badge-count').textContent = all.filter(b => b[3]).length + '/' + all.length;
  }

  /* ---- Settings ---- */
  function applyTheme(value) {
    if (value === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = value;
    const dark = value === 'dark' || value === 'system' && matchMedia('(prefers-color-scheme:dark)').matches;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.content = dark ? '#000000' : '#F2F2F7');
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
    $('phase').value = state.phaseMode || 'auto';
    if (!settingsReady) {
      settingsReady = true;
      const look = $('arcade-settings'), themeRow = el('div', 'ch-cell'), seg = el('div', 'ch-seg'); seg.id = 'theme-mode'; seg.style.setProperty('--n', 3); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Theme');
      [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([value, text]) => { const b = button('', () => { M()?.haptic('tap'); api.save({ ...current, arcadeTheme: value }); }, text); b.dataset.themeOption = value; seg.append(b); });
      themeRow.append(el('span', 'ch-cell__title', 'Theme'), seg);
      look.append(themeRow, switchRow('sound-toggle', 'Sounds', !!state.arcadeSound, on => api.save({ ...current, arcadeSound: on })), switchRow('haptics-toggle', 'Haptics', state.haptics !== false, on => { api.save({ ...current, haptics: on }); if (on) M()?.haptic('on'); }));

      const form = el('form', 'ch-group'), list = el('div', 'ch-list'), inputs = []; form.id = 'phase-form';
      ['Cut ends', 'Reset ends', 'Bulk ends'].forEach((name, i) => { const row = el('label', 'ch-cell'), input = el('input', 'ch-input'); input.type = 'date'; input.required = true; input.id = 'phase-end-' + i; row.append(el('span', 'ch-cell__title', name), input); list.append(row); inputs.push(input); });
      const submit = el('button', 'secondary ch-btn ch-btn--block', 'Save phase dates');
      form.append(el('h2', 'ch-list-h', 'Phase schedule'), list, el('p', 'ch-list-f', 'After Bulk ends, Bulk goals continue until you edit the phase. A manual phase or custom goals above override these dates.'), submit);
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
      dayList.append(weighRow, waterRow); day.append(heading, dayList);
      // An unchanged value is not a new edit: it must not replace the pending Undo.
      water.onchange = () => { const value = Number(water.value); if (water.value !== '' && Number.isFinite(value) && value >= 0 && value <= 30 && value !== (daily(current, activeKey()).water || 0)) update({ water: value }, { kind: 'save', label: 'Water saved' }); };
      weigh.onchange = () => { const v = weigh.value === '' ? null : Number(weigh.value); if ((v === null || Number.isFinite(v) && v >= 20 && v <= 500) && v !== (daily(current, activeKey()).weight ?? null)) update({ weight: v }, { kind: 'save', label: v === null ? 'Weigh-in cleared' : 'Weigh-in saved' }); };

      const exportButton = button('ch-cell', () => { const blob = new Blob([JSON.stringify({ journal: current, legacyGame: RECGame.derive(current, dayKey()).badges }, null, 2)], { type: 'application/json' }), a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'chad-local-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
      exportButton.id = 'export-backup'; exportButton.append(el('span', 'ch-cell__title ch-grow', 'Export local backup')); exportButton.insertAdjacentHTML('beforeend', icon('share', 20));
      $('data-settings').append(exportButton);
    }
    const seg = $('theme-mode'); seg.style.setProperty('--i', ['system', 'light', 'dark'].indexOf(theme)); [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeOption === theme)));
    $('sound-toggle').checked = !!state.arcadeSound; $('haptics-toggle').checked = state.haptics !== false;
    (state.phaseEnds || phases.map(p => p[2])).forEach((v, i) => { const input = $('phase-end-' + i); if (document.activeElement !== input) input.value = v; });
    $('local-weight').value = d.weight ?? ''; $('water-amount').value = d.water || 0; $('weight-date').textContent = shortDate(key);
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => applyTheme(current?.arcadeTheme || 'system'));
  window.CHADQuest = { dayKey, shift, weekday, monday, waterGoal, phase, goals, deload, daily, week, stats, training, rewards, render, paintCharts, shownAddons, LEVELS };
})();
