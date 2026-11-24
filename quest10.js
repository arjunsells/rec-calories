'use strict';
// CHAD v10 · scoring and calendar (the v5-v9 rules; the streak is now the journey streak) and the four screens.
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
  // v10: the program lives in train10.js. A session done is worth its moves (gym) or items (class, rest) in XP, as in v9.
  const training = CHADTrain.WEEK;
  const sessionLength = key => { const s = CHADTrain.WEEK[weekday(key)]; return s.ex.length || s.items.length; };
  // v8: entries are indexed by day once per journal array (every save replaces the array), so a render no longer
  // rescans the whole history for each of the ~500 day lookups behind streaks, weeks, charts and the heatmap.
  const byDay=new WeakMap();
  function entriesOn(state,key) {
    let index=byDay.get(state.entries);
    if(!index||index.size!==state.entries.length){index={size:state.entries.length,days:new Map()};for(const e of state.entries){const list=index.days.get(e.day);if(list)list.push(e);else index.days.set(e.day,[e]);}byDay.set(state.entries,index);}
    return index.days.get(key)||[];
  }
  // Meal points come from at most four picks (a day from before v10 can hold an old Dessert pick as well as a new one).
  function daily(state,key) {
    const q=state.questsV5?.[key]||{}, entries=entriesOn(state,key);
    const totals=entries.reduce((t,e)=>t.map((v,i)=>v+(e[['kcal','protein','carbs','fat'][i]]||0)),[0,0,0,0]);
    const picks=q.picks||{}; const protein=totals[1]>=210; const water=(q.water||0)>=waterGoal(key);
    const meals=Object.values(picks).map(p=>({S:3,M:2,F:1}[p]||0)).sort((a,b)=>b-a).slice(0,4).reduce((s,v)=>s+v,0);
    const score=meals+(protein?2:0)+(water?2:0)+(q.steps?1:0);
    return {...q,picks,totals,score,protein,waterHit:water,grade:score>=15?'S':score>=12?'A':score>=9?'B':'C'};
  }
  function week(state,start,today) {let total=0,free=0,complete=true;for(let i=0;i<7;i++){const key=shift(start,i),d=daily(state,key);total+=d.score;free+=Object.values(d.picks).filter(p=>p==='F').length;complete&&=key<=today&&Object.keys(d.picks).length>=4;} const bonus=complete&&free<=2?10:0;return {total:total+bonus,free,bonus,complete};}
  function stats(state,today) {
    const keys=[...new Set([...state.entries.map(e=>e.day),...Object.keys(state.questsV5||{})])].filter(k=>k<=today).sort();
    const {streak,longest,since}=RECGame.journey(state,today);
    let last='',pRun=0,wRun=0,maxP=0,maxW=0,perfect=false,fight=false,zero=false;
    for(const key of keys){const d=daily(state,key),adj=last===shift(key,-1);pRun=d.protein?(adj?pRun+1:1):0;wRun=d.waterHit?(adj?wRun+1:1):0;maxP=Math.max(maxP,pRun);maxW=Math.max(maxW,wRun);perfect||=d.score===17;fight||=weekday(key)===3&&d.waterHit&&d.electrolyte&&d.picks.D==='S';const w=week(state,monday(key),today);zero||=w.complete&&w.free===0;last=key;}
    const w=week(state,monday(today),today),level=w.total>=120?'AJ Mode':w.total>=105?'Champion':w.total>=85?'Beast':w.total>=60?'Grinder':'Rookie';
    return {streak,longest,since,week:w,level,maxP,maxW,perfect,fight,zero};
  }
  // Days in a row on the water goal, up to today (or yesterday while today is still filling).
  function waterStreak(state,today) {let n=0,k=daily(state,today).waterHit?today:shift(today,-1);while(n<3660&&daily(state,k).waterHit){n++;k=shift(k,-1);}return n;}
  function rewards(state,key,g){
    const legacy=state.legacyRewards||{}, keys=Object.keys(state.questsV5||{}).filter(k=>k<=key);
    const questXP=keys.reduce((sum,k)=>{const d=daily(state,k),exercises=d.training?sessionLength(k):Object.values(d.exercises||{}).filter(Boolean).length,sets=Array.isArray(d.workout?.sets)?d.workout.sets.length:0;return sum+10*(Object.keys(d.picks).length+['electrolyte','cardio','steps','sleep'].filter(f=>d[f]).length+Math.ceil(d.water||0)+exercises)+CHADTrain.SET_XP*sets;},0);
    g.xp=Math.max(g.xp,legacy.xp||0)+questXP;
    const floors=[0,100,300,700,1400,2500],names=['Fresh Start','Building Momentum','Daily Contender','Goal Crusher','Elite Form','CHAD Legend'];
    g.level=floors.findLastIndex(n=>g.xp>=n);g.floor=floors[g.level];g.next=floors[g.level+1]??null;g.name=names[g.level];
    g.badges.forEach(b=>b.unlocked||=!!legacy.badges?.includes(b.id));
    return g;
  }
  // 0..1: how much of a day's session is done (the week strip on Training).
  function sessionProgress(state,key) {const d=state.questsV5?.[key]||{};if(CHADTrain.finished(d))return 1;const p=CHADTrain.progress(state,key);return p.total?p.done/p.total:Object.values(d.exercises||{}).filter(Boolean).length/Math.max(1,sessionLength(key));}

  /* ---- screens. Every change goes through api.change() (app10.js): the journal is written first, then the toast
     offers Undo, and Undo offers Redo. Each direction touches only its own fields, so newer unrelated edits survive. ---- */
  const LEVELS = [['Fresh Start', 0], ['Building Momentum', 100], ['Daily Contender', 300], ['Goal Crusher', 700], ['Elite Form', 1400], ['CHAD Legend', 2500]];
  const TIER = { S: 'Strict', M: 'Medium', F: 'Free' }, TIER_CLASS = { S: 'strict', M: 'medium', F: 'free' };
  const SLOT_ICON = { B: 'sun', L: 'fork', P: 'bolt', D: 'moon' };
  const DAY_ORDER = ['B', 'L', 'P', 'session', 'D', 'wrap'];
  const BADGE_ICON = { first: 'bolt', logs25: 'target', streak3: 'flame', streak7: 'trophy', streak30: 'sparkles', protein: 'dumbbell', balanced: 'star', protein7: 'fork', water7: 'drop', zero: 'leaf', fight: 'glove', perfect: 'crown' };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ADDONS = { reset: [['shake', 'Daily shake', [610, 38, 83, 13]], ['banana', 'Extra banana', [89, 1.1, 23, .3]]], bulk: [['bagel', 'Plain bagel', [313, 10, 60, 2]], ['wrap', 'Protein wrap', [175, 10, 24, 4]], ['shake', 'Daily shake', [610, 38, 83, 13]]] };
  const STREAK_MARKS = new Set([3, 30, 50, 100, 150, 200, 250, 300, 365]);
  let api, current, lastGrade = null, settingsReady = false, chartRange = 7, themeShown, pinned = null, pinTimer, open = null, lastOpen = null, lastLead = null, lastTap = { id: null, t: 0 }, settleUntil = 0, workoutsShown = 8;
  const sRanked = new Set();                                         // celebrations happen once, however often a day is undone and redone
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
  const floatXP = node => { const gain = api.xpGain ? api.xpGain() : 0; if (node && gain > 0) M()?.floater(node, '+' + gain + ' XP'); };
  function chime(notes = [523, 659, 784]) { if (!current?.arcadeSound || matchMedia('(prefers-reduced-motion: reduce)').matches) return; try { const ac = new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.025, ac.currentTime + i * .07); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + i * .07 + .1); o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * .07); o.stop(ac.currentTime + i * .07 + .11); }); setTimeout(() => ac.close(), 600); } catch { /* Sound remains optional. */ } }
  // A second tap on the same control within 400 ms would cancel the first: that is a slip, so the first one stands.
  function slip(id, e) {
    const t = e && e.timeStamp;
    if (!t) return false;
    const twice = lastTap.id === id && t >= lastTap.t && t - lastTap.t < 400;
    lastTap = { id, t };
    return twice;
  }
  // After a log moves the meals (the next one takes the top, an opened one folds), cards ignore touches until the move
  // is done: 700 ms while the logged card holds its place, 300 ms without motion. Undo in the toast is always there.
  const settling = e => !!(e && e.timeStamp && e.timeStamp < settleUntil);

  /* ---- changes ---- */
  // Some fields of one day. Undo puts back exactly those fields; containers that did not exist are dropped again.
  function update(patch, o) {
    const key = o.key || activeKey(), old = current.questsV5?.[key] || {}, was = api.shape(current, key);
    const before = Object.fromEntries(Object.keys(patch).map(k => [k, old[k]]));
    return api.change({ label: o.label, kind: o.kind || (o.positive ? 'on' : 'off'), positive: !!o.positive, day: key, onApply: o.positive ? () => chime() : null,
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
      label: removing ? slot.name + ' removed' : picked ? slot.name + ' · ' + TIER[tier] : slot.name + ' logged', kind: removing ? 'off' : 'on', positive: !removing, day: key, onApply: removing ? null : () => chime(),
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
  // One-tap habits: cardio, steps, sleep, Hydralyte, and the session on class and rest days.
  function toggleQuest(field, name, key) {
    const done = !!daily(current, key)[field];
    return update({ [field]: !done }, { key, positive: !done, label: name + (done ? ' removed' : ' logged') });
  }
  // Training's "Mark done": the session without logging sets. Switching it off leaves any ticks and sets alone.
  function toggleSession(key) {
    const q = daily(current, key), s = CHADTrain.plan(key);
    return update({ training: !q.training }, { key, positive: !q.training, label: s.name + (q.training ? ' reopened' : ' done') });
  }
  // Long press opens the same sheet as a details button would, without logging.
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
  // One sheet per meal (long press a card): the three options side by side, what is in it, the steps, and one button.
  function mealSheet(slot, tier) {
    const key = activeKey(), seg = el('div', 'ch-seg ch-tiers'), body = el('div', 'ch-mealsheet');
    let shown = tier;
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', slot.name + ' options'); seg.style.setProperty('--n', 3);
    const paint = () => {
      const picked = daily(current, key).picks[slot.id], c = slot.choices.find(x => x.tier === shown), selected = picked === shown;
      seg.style.setProperty('--i', 'SMF'.indexOf(shown));
      [...seg.children].forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.tier === shown)); b.classList.toggle('is-logged', b.dataset.tier === picked); });
      const list = el('ul', 'ch-bullets'); c.items.forEach(item => list.append(el('li', '', item)));
      const steps = el('ol', 'ch-steps'); c.how.forEach(step => steps.append(el('li', '', step)));
      const label = selected ? 'Remove from ' + slot.name.toLowerCase() : picked ? 'Switch to ' + TIER[shown].toLowerCase() : 'Log ' + TIER[shown].toLowerCase() + ' ' + slot.name.toLowerCase();
      body.replaceChildren(el('h3', 'ch-mealsheet__title', c.title), window.CHADUX.macroTiles(c.macros), list, steps,
        button('ch-btn ch-btn--block' + (selected ? '' : ' ch-btn--gold'), () => { window.CHADUX.closeSheets(); pick(slot, shown); }, label),
        button('ch-link ch-link--center', () => window.CHADUX.openFood('camera', slot.id === 'P' ? 'Snacks' : slot.name), 'Log something else'));
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
    const key = activeKey(), today = dayKey(), d = daily(state, key), s = stats(state, today), p = phase(state, key), water = waterStreak(state, today);
    $('quest-hero').hidden = true;
    $('home-streak').innerHTML = icon('flame', 18) + '<b class="ch-px">' + s.streak + '</b>'; $('home-streak').setAttribute('aria-label', s.streak + ' day streak');
    $('streak-count').textContent = s.streak;
    $('streak').replaceChildren(el('span', '', s.streak === 1 ? 'day' : 'days'), el('span', '', s.since ? 'since ' + dayMonth(s.since) : 'Day 1 ' + dayMonth(RECGame.journey(state, today).start)));
    $('water-streak').textContent = water;
    $('water-streak-s').replaceChildren(el('span', '', water === 1 ? 'day on goal' : 'days on goal'), el('span', '', 'best ' + Math.max(water, s.maxW)));
    if (lastGrade && lastGrade.key === key && lastGrade.grade !== 'S' && d.grade === 'S' && !sRanked.has(key)) { sRanked.add(key); api.celebrate('S rank · ' + d.score + '/17'); }
    lastGrade = { key, grade: d.grade };
    if (key === today) milestone(s.streak, today);
    renderToday(state, key, d, p);
    const tile = $('weekly-progress');
    const caption = el('span', 'ch-tile__s'); caption.append(el('span', '', s.week.total + ' pts'), el('span', '', s.week.free > 2 ? 'no bonus' : s.week.bonus ? '+10 bonus' : s.week.free + '/2 Free'));
    tile.replaceChildren(el('span', 'ch-tile__k', 'This week'), el('span', 'ch-tile__v ch-tile__v--text', s.level), caption);
    // Only the tab on screen is rebuilt; app10.js renders again when the tab changes.
    if (!$('training').hidden) renderTraining(state, key);
    if (!$('history').hidden) { renderWorkouts(state); renderRecords(state); renderCharts(state, key); renderBadges(s); }
    renderSettings(state, key, d);
    window.CHADGym?.render(state, { ...api, chime, update });
  }

  /* ---- Today: the rings, then what matters now (Darwin time), big. Everything else is one quiet line that opens in
     place. Morning: water and breakfast. Midday: lunch. 3-6 pm: the gym session, water below. Evening: dinner (Muay
     Thai first on Wednesday) and the wrap-up. Another day: its next meal. ---- */
  const isOpen = (id, key) => !!open && open.key === key && open.id === id;
  const done = d => CHADTrain.finished(d);
  function leadSlot(d, key) {
    if (pinned && pinned.key === key) return slotById(pinned.id) || null;
    const from = key === dayKey() ? Math.max(0, CHADPlan.findIndex(x => x.id === window.CHADUX.currentSlot())) : 0;
    return CHADPlan.slice(from).find(x => !d.picks[x.id] && !isOpen(x.id, key)) || null;
  }
  function heroes(d, key, s) {
    const lead = leadSlot(d, key);
    if (key !== dayKey()) return { blocks: lead ? ['meal'] : [], lead };
    const block = window.CHADUX.timeBlock();
    if (block === 'morning') return { blocks: ['water', ...(lead ? ['meal'] : [])], lead };
    if (block === 'midday') return { blocks: lead ? ['meal'] : [], lead };
    if (block === 'gym') return { blocks: ['session'], lead: null };
    if (s.kind === 'class' && !done(d)) return { blocks: ['session', 'wrap'], lead: null };          // Wednesday: Muay Thai at 6:30
    return { blocks: [...(lead ? ['meal'] : []), 'wrap'], lead };
  }
  function renderToday(state, key, d, p) {
    const list = $('daily-checklist'), glide = M()?.flip(list, '[data-flip]', n => n.dataset.flip), s = CHADTrain.plan(key), { blocks, lead } = heroes(d, key, s), out = [];
    for (const b of blocks) out.push(b === 'meal' ? slotBlock(state, lead, d, key, 'lead') : b === 'water' ? waterCard(d, key, true) : b === 'session' ? sessionCard(state, key, d, s, 'hero') : wrapCard(state, key, d, s, 'hero'));
    if (!blocks.includes('water')) out.push(waterCard(d, key, false));
    out.push(...quietLines(state, d, key, s, DAY_ORDER.filter(id => !(id === 'session' || id === 'wrap' ? blocks.includes(id) : lead && lead.id === id))));
    if (p[0] !== 'cut') out.push(addonsCard(state, key, p));
    list.replaceChildren(...out);
    glide?.();
    lastLead = lead ? { id: lead.id, key } : null; lastOpen = open && open.key === key ? { ...open } : null;
  }
  const logged = (state, slot, d, key) => {
    const picked = d.picks[slot.id], c = picked && slot.choices.find(x => x.tier === picked), eaten = state.entries.find(e => e.day === key && e.planSlot === slot.id);
    return { picked, c, kcal: eaten ? eaten.kcal : c ? c.macros[0] : null };
  };
  // A meal with its three options, Strict, Medium, Free: what it is, kcal and P/C/F, and how to make or order it.
  function slotBlock(state, slot, d, key, mode) {
    const { picked, kcal } = logged(state, slot, d, key), lead = mode === 'lead', block = el('section', 'meal-slot ch-slot' + (picked ? ' is-logged' : '') + (lead ? '' : ' is-open'));
    block.dataset.mealSlot = slot.id; block.dataset.flip = lead ? 'lead' : 'open-' + slot.id;
    if (lead) { block.id = 'next-up'; if (lastLead && lastLead.key === key && lastLead.id !== slot.id) block.classList.add('is-arriving'); }
    else if (!lastOpen || lastOpen.id !== slot.id || lastOpen.key !== key) block.classList.add('is-arriving');
    const head = el('div', 'ch-slot__head'), name = el('h2', 'ch-slot__name', slot.name), meta = el('span', 'ch-slot__meta');
    name.id = 'slot-heading-' + slot.id; block.setAttribute('aria-labelledby', name.id);
    if (picked) meta.innerHTML = icon('check', 14, { weight: 2.8 }) + TIER[picked] + (kcal == null ? '' : ' · ' + whole(kcal) + ' kcal'); else meta.textContent = slot.time;
    if (lead) {
      const title = el('div', 'ch-slot__title');
      if (!picked) title.append(el('span', 'ch-chip ch-chip--next', 'Next'));
      title.append(name); head.append(title, meta);
    } else {
      const fold = button('ch-slot__fold', e => { if (slip('row-' + key + slot.id, e)) return; open = null; settleUntil = 0; M()?.haptic('tap'); api.refresh(); });
      fold.dataset.mealToggle = slot.id; fold.setAttribute('aria-expanded', 'true'); fold.setAttribute('aria-label', slot.name + ', fold away');
      fold.append(name, meta); fold.insertAdjacentHTML('beforeend', icon('chevron-up', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
      head.append(fold);
    }
    block.append(head);
    const grid = el('div', 'meal-options ch-opts');
    for (const c of slot.choices) {
      const selected = picked === c.tier, card = el('div', 'meal-choice ch-opt ch-opt--' + TIER_CLASS[c.tier]);
      const b = button('meal-pick ch-opt__hit', e => { if (!slip('meal-' + key + slot.id + c.tier, e) && !settling(e)) pick(slot, c.tier, e); });
      b.dataset.slot = slot.id; b.dataset.tier = c.tier; b.setAttribute('aria-pressed', String(selected));
      b.setAttribute('aria-label', (selected ? 'Remove ' : picked ? 'Switch to ' : 'Log ') + TIER[c.tier] + ' ' + slot.name + ': ' + c.title + ', ' + macroWords(c.macros) + '. ' + howText(c));
      const kcalText = el('span', 'ch-opt__kcal'); kcalText.innerHTML = whole(c.macros[0]) + '<small>kcal</small>';
      const top = el('span', 'ch-opt__top'), mid = el('span', 'ch-opt__mid'), macros = window.CHADUX.pcf(c.macros[1], c.macros[2], c.macros[3]);
      macros.classList.add('meal-macros');
      top.append(el('span', 'tier-label ch-opt__tier', TIER[c.tier]), kcalText); mid.append(el('span', 'meal-title ch-opt__name', c.title), macros);
      b.append(top, mid, el('span', 'meal-how ch-opt__how', howText(c)));
      longPress(b, () => mealSheet(slot, c.tier));
      card.append(b); grid.append(card);
    }
    block.append(grid);
    return block;
  }
  // The quiet lines, in the order of the day. Rows next to each other share one card; a tap opens one in place.
  function quietLines(state, d, key, s, ids) {
    const out = []; let group = null;
    for (const id of ids) {
      if (isOpen(id, key)) { group = null; out.push(id === 'session' ? sessionCard(state, key, d, s, 'open') : id === 'wrap' ? wrapCard(state, key, d, s, 'open') : slotBlock(state, slotById(id), d, key, 'open')); continue; }
      if (!group) { group = el('section', 'ch-list ch-rows meal-rows day-rows'); group.dataset.flip = 'rows-' + id; group.setAttribute('aria-label', 'The rest of the day'); out.push(group); }
      group.append(id === 'session' ? sessionRow(state, key, d, s) : id === 'wrap' ? wrapRow(key, d, s) : mealRow(state, slotById(id), d, key));
    }
    return out;
  }
  function row(id, key, cls, glyph, title, status, label) {
    const r = button('ch-cell day-row ' + cls, e => { if (slip('row-' + key + id, e)) return; open = { id, key }; settleUntil = 0; M()?.haptic('tap'); api.refresh(); });
    const disc = el('span', 'ch-cell__icon'); disc.innerHTML = icon(glyph, 17, { weight: 2.1 });
    r.dataset.row = id; r.setAttribute('aria-expanded', 'false'); r.setAttribute('aria-label', label + '. Show');
    r.append(disc, el('span', 'ch-cell__title', title), status); r.insertAdjacentHTML('beforeend', icon('chevron-down', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
    return r;
  }
  const statusOf = (doneNow, text) => { const st = el('span', 'ch-cell__status'); if (doneNow) st.innerHTML = icon('check', 15, { weight: 2.8 }); st.append(el('span', '', text)); return st; };
  function mealRow(state, slot, d, key) {
    const { picked, c, kcal } = logged(state, slot, d, key), text = picked ? (TIER[picked] || picked) + (kcal != null ? ' · ' + whole(kcal) + ' kcal' : '') : slot.time;
    const r = row(slot.id, key, 'meal-row' + (picked ? ' is-logged' : ''), SLOT_ICON[slot.id] || 'fork', slot.name, statusOf(!!picked, text),
      slot.name + (picked ? ', logged ' + (TIER[picked] || picked) + (c ? ', ' + c.title : '') + (kcal != null ? ', ' + whole(kcal) + ' kcal' : '') : ', ' + slot.time + ', not logged yet'));
    r.dataset.mealRow = slot.id;
    return r;
  }
  const sessionIcon = s => s.kind === 'class' ? 'glove' : s.kind === 'rest' ? 'walk' : 'dumbbell';
  function sessionRow(state, key, d, s) {
    const sum = CHADTrain.summary(state, key), p = CHADTrain.progress(state, key), finished = s.kind === 'rest' ? !!d.cardio : sum.done;
    const text = finished ? (s.kind === 'rest' ? 'Walk done' : sum.minutes ? 'Done · ' + sum.minutes + ' min' : 'Done') : sum.live ? p.done + ' of ' + p.total + ' sets' : s.kind === 'gym' ? s.ex.length + ' exercises · ' + s.minutes + ' min' : s.kind === 'class' ? s.time : s.cardio;
    return row('session', key, 'session-row' + (finished ? ' is-done' : ''), sessionIcon(s), s.name, statusOf(finished, text), s.name + ', ' + text);
  }
  const wrapFields = s => [...(s.kind === 'class' ? [] : [['cardio', s.cardioShort || s.cardio, s.kind === 'rest' ? 'walk' : 'run', 'Cardio']]), ['steps', '10k steps', 'shoe', '10k steps'], ['sleep', 'Sleep 7 h+', 'sleep', 'Sleep'], ['electrolyte', 'Hydralyte', 'electrolyte', 'Hydralyte']];
  function wrapRow(key, d, s) {
    const fields = wrapFields(s), n = fields.filter(([f]) => d[f]).length, all = n === fields.length, text = all ? 'All done' : n + ' of ' + fields.length;
    return row('wrap', key, 'wrap-row' + (all ? ' is-done' : ''), 'check-circle', 'Wrap-up', statusOf(all, text), 'Wrap-up: steps, sleep and Hydralyte, ' + text);
  }
  // A fold header for a block opened from its line.
  function foldHead(id, key, title, meta) {
    const fold = button('ch-slot__fold ch-block__fold', e => { if (slip('row-' + key + id, e)) return; open = null; M()?.haptic('tap'); api.refresh(); });
    fold.dataset.fold = id; fold.setAttribute('aria-expanded', 'true'); fold.setAttribute('aria-label', title + ', fold away');
    fold.append(el('span', 'ch-slot__name', title), el('span', 'ch-slot__meta', meta)); fold.insertAdjacentHTML('beforeend', icon('chevron-up', 15, { weight: 2.4, cls: 'ch-cell__chev' }));
    return fold;
  }
  // One-tap done chips (cardio, steps, sleep, Hydralyte, Muay Thai): on and off, Undo in the toast, XP when on.
  function doneChip(field, label, glyph, key, name) {
    const on = !!daily(current, key)[field];
    const b = button('quest-chip ch-done', e => {
      if (slip('quest-' + key + field, e)) return;
      M()?.mark(`#today [data-quest="${field}"]`, on ? 'just-off' : 'just-on', on ? null : floatXP);
      if (field === 'training') toggleSession(key); else toggleQuest(field, name || label, key);
    });
    const disc = el('span', 'ch-done__icon'); disc.innerHTML = icon(glyph, 20, { weight: 2 });
    b.append(disc, el('span', 'ch-done__label', label));
    b.dataset.quest = field; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', label);
    return b;
  }
  // Today's session: one card. Gym days: what it is and one big Start (Resume mid-workout; a summary once done).
  // Wednesday: Muay Thai at 6:30 with one Done chip. Sunday: rest, and the walk as one chip.
  function sessionCard(state, key, d, s, mode) {
    const today = dayKey(), isToday = key === today, sum = CHADTrain.summary(state, key), p = CHADTrain.progress(state, key), finished = sum.done;
    const card = el('section', 'ch-card ch-gymcard ch-gymcard--' + s.kind + (finished ? ' is-done' : '') + (sum.live ? ' is-live' : '') + (mode === 'open' ? ' is-open' : ''));
    card.dataset.flip = mode === 'hero' ? 'hero-session' : 'open-session'; card.dataset.session = s.id;
    if (mode === 'hero') card.id = 'session-hero';
    const head = el('div', 'ch-gymcard__head'), text = el('div', 'ch-grow');
    const when = isToday ? (s.kind === 'gym' ? 'Today · 4–6 pm' : s.kind === 'class' ? 'Tonight · ' + s.time : 'Today · rest day') : shortDate(key);
    const chip = key <= today && (s.kind !== 'gym' || s.id !== 'legs');
    const meta = s.kind === 'gym' ? s.ex.length + ' exercises · ' + s.minutes + ' min' + (chip ? '' : ' · then ' + s.cardio) : s.kind === 'class' ? s.focus : s.cardio + ' · mobility';
    if (mode === 'open') card.append(foldHead('session', key, s.kind === 'class' ? s.name + ' · ' + s.time : s.name, isToday ? when.replace(/^(Today|Tonight) · /, '') : when));
    else text.append(el('p', 'ch-eyebrow', when), el('h2', 'ch-gymcard__name', s.kind === 'class' ? s.name + ' · ' + s.time : s.name));
    text.append(el('p', 'ch-gymcard__meta', meta));
    head.append(text);
    if (s.kind === 'gym') {
      const ring = el('div', 'ch-ring ch-gymcard__ring'); ring.style.setProperty('--p', finished ? 100 : p.total ? p.done / p.total * 100 : 0);
      ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', finished ? 'Done' : p.done + ' of ' + p.total + ' sets');
      if (finished) ring.innerHTML = icon('check', 22, { weight: 3 }); else ring.append(el('strong', '', p.done ? p.done + '/' + p.total : String(p.total)), el('small', '', 'sets'));
      head.append(ring);
    }
    card.append(head);
    if (s.deload) { const tag = el('p', 'ch-deload ch-deload--sm'); tag.innerHTML = icon('leaf', 16); tag.append(s.kind === 'class' ? 'Deload week · Muay Thai easy' : 'Deload week · half the sets, same weights'); card.append(tag); }
    const chips = el('div', 'ch-done-row');
    if (s.kind === 'gym') {
      if (finished) {
        const line = el('p', 'ch-gymcard__done'); line.innerHTML = icon('trophy', 18);
        line.append([sum.minutes && sum.minutes + ' min', sum.volume && whole(sum.volume) + ' kg', sum.sets && sum.sets + (sum.sets === 1 ? ' set' : ' sets'), sum.prs.length && sum.prs.length + (sum.prs.length === 1 ? ' PR' : ' PRs')].filter(Boolean).join(' · ') || 'Done');
        card.append(line);
      } else if (isToday) {
        const go = button('ch-btn ch-btn--go ch-btn--block', () => window.CHADGym?.start(key));
        go.dataset.gymStart = key; go.innerHTML = '<svg class="ch-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
        go.append(el('span', '', sum.live ? 'Resume' : 'Start'));
        if (sum.live) go.append(el('small', '', p.done + ' of ' + p.total + ' sets'));
        go.setAttribute('aria-label', (sum.live ? 'Resume ' : 'Start ') + s.name + (sum.live ? ', ' + p.done + ' of ' + p.total + ' sets done' : ', ' + s.ex.length + ' exercises'));
        card.append(go);
      } else if (key < today && !sum.live) card.append(markDone(key, s));
      if (key <= today && s.id !== 'legs') chips.append(doneChip('cardio', s.cardio, 'run', key, 'Cardio'));
    } else if (key <= today) chips.append(s.kind === 'class' ? doneChip('training', 'Muay Thai', 'glove', key) : doneChip('cardio', s.cardio, 'walk', key, 'Walk'));
    if (chips.children.length) card.append(chips);
    return card;
  }
  const markDone = (key, s) => { const b = button('quest-chip ch-qchip ch-qchip--pill', e => { if (!slip('session-' + key, e)) toggleSession(key); }); const on = !!daily(current, key).training; b.dataset.quest = 'training'; b.setAttribute('aria-pressed', String(on)); if (on) b.innerHTML = icon('check', 18, { weight: 2.6 }); b.append(on ? s.name + ' done' : 'Mark done'); return b; };
  // The evening: how the day went in one line, and the last few one-tap habits.
  function wrapCard(state, key, d, s, mode) {
    const g = goals(state, key), card = el('section', 'ch-card ch-wrap' + (mode === 'open' ? ' is-open' : ''));
    card.dataset.flip = mode === 'hero' ? 'hero-wrap' : 'open-wrap'; if (mode === 'hero') card.id = 'wrap-up';
    if (mode === 'open') card.append(foldHead('wrap', key, 'Wrap-up', d.score + '/17'));
    else {
      const head = el('div', 'ch-wrap__head'), grade = el('span', 'ch-grade ch-grade--sm ch-grade--' + d.grade.toLowerCase(), d.grade);
      head.append(el('div', 'ch-grow'), grade); head.firstChild.append(el('p', 'ch-eyebrow', 'Wrap-up'), el('h2', 'ch-wrap__title', d.score + '/17 today'));
      card.append(head);
    }
    const sumLine = el('p', 'ch-wrap__sum');
    sumLine.append(el('b', '', whole(d.totals[0])), ' / ' + whole(g.target) + ' kcal · ', el('b', '', whole(d.totals[1]) + ' g'), ' protein · ', el('b', '', fmt(d.water || 0) + ' L'));
    card.append(sumLine);
    const chips = el('div', 'ch-done-grid');
    for (const [field, label, glyph, name] of wrapFields(s)) chips.append(doneChip(field, label, glyph, key, name));
    card.append(chips);
    return card;
  }
  // Water: one tap adds a 500 mL bottle (again and again, even past the goal). Undo takes it back. The goal and the
  // days in a row on it are right there. Big in the morning; one line the rest of the day.
  function waterCard(d, key, big) {
    const amount = d.water || 0, target = waterGoal(key), full = amount >= target, most = target + 2, streak = waterStreak(current, dayKey()), left = Math.max(0, target - amount);
    const add = button('water-row ch-water' + (big ? ' ch-water--big' : '') + (full ? ' is-full' : ''), () => {
      if (amount >= most) { M()?.haptic('warn'); api.message('That is a lot of water for one day. Set the exact amount in Settings.'); return; }
      const next = Math.round(Math.min(most, amount + .5) * 10) / 10;
      M()?.mark(`.bottle[data-water="${Math.min(Math.ceil(target / .5) - 1, Math.floor(amount / .5))}"]`, full ? null : 'just-on', floatXP);
      if (!full && next >= target) M()?.mark('.water-row', 'just-on');
      update({ water: next }, { key, positive: true, label: !full && next >= target ? 'Water goal hit' : '500 mL water' });
    });
    add.dataset.flip = 'water';
    add.setAttribute('aria-label', 'Add 500 mL water. ' + fmt(amount) + ' of ' + fmt(target) + ' L' + (full ? ', goal hit' : ', ' + fmt(left) + ' L to go') + (streak ? '. ' + streak + ' day water streak' : ''));
    const bottles = el('span', 'bottles ch-bottles'); bottles.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.ceil(target / .5); i++) {
      const b = el('i', 'bottle ch-bottle' + (amount > i * .5 ? ' filled' : '')); b.dataset.water = String(i); b.style.setProperty('--fill', Math.max(0, Math.min(1, (amount - i * .5) / .5))); bottles.append(b);
    }
    const total = el('span', 'water-total ch-water__val'); total.innerHTML = fmt(amount) + '<small>/' + fmt(target) + ' L</small>';
    const goalText = el('span', 'ch-water__goal', full ? 'Goal hit' + (amount > target ? ' · +' + fmt(amount - target) + ' L' : '') : fmt(left) + ' L to go');
    const flame = el('span', 'ch-water__streak'); if (streak) { flame.innerHTML = icon('flame', 13); flame.append(String(streak)); flame.title = streak + ' days in a row'; }
    if (big) {
      const top = el('span', 'ch-water__top'); top.append(el('span', 'ch-water__label', 'Water'), flame);
      const sub = el('span', 'ch-water__sub'); sub.append(goalText, el('span', 'ch-water__tap', '+500 mL a tap'));
      const mid = el('span', 'ch-water__mid'); mid.append(bottles, total);
      add.append(top, mid, sub);
    } else {
      const drop = el('span', 'ch-water__drop'); drop.innerHTML = icon('drop', 18, { weight: 2.2 });
      const right = el('span', 'ch-water__right'); right.append(total, goalText);
      add.append(drop, bottles, right); if (streak) add.append(flame);
    }
    return add;
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
        api.change({ label: name + (on ? ' removed' : ' logged'), kind: on ? 'off' : 'on', positive: !on, day: key, onApply: on ? null : () => chime(),
          forward: s => ({ ...s, entries: on ? s.entries.filter(x => x.id !== eid) : [...s.entries.filter(x => x.id !== eid), entry] }),
          backward: s => ({ ...s, entries: on ? api.restoreAt(s.entries.filter(x => x.id !== eid), [{ e: old, i: index }]) : s.entries.filter(x => x.id !== eid) }) });
      }, name + ' · ' + m[0] + ' kcal');
      b.dataset.addon = id; b.setAttribute('aria-pressed', String(has)); row.append(b);
    }
    return box;
  }
  // Add-on entries that a pill on Today already shows (everything else logged appears under "Other food").
  function shownAddons(state, key) { const p = phase(state, key); return new Set(ADDONS[p[0]] ? ADDONS[p[0]].map(([id]) => 'addon-' + key + '-' + id) : []); }

  /* ---- Training: Perfect Week v1. The day's session with each exercise's prescription and last set, Start (today),
     Mark done, then the rest of the week and the plan's rules. ---- */
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
    nodes.push(note('dumbbell', CHADTrain.RULES.join(' ')));
    window.CHADUX.detail(e.name, nodes);
  }
  function renderTraining(state, key) {
    const box = $('training-content'); box.replaceChildren();
    const s = CHADTrain.plan(key), today = dayKey(), d = daily(state, key), sum = CHADTrain.summary(state, key), w = d.workout, isToday = key === today;
    if (s.deload) { const banner = el('div', 'deload ch-deload'); banner.innerHTML = icon('leaf', 20); banner.append(el('span', '', s.kind === 'class' ? 'Deload week · Muay Thai easy' : 'Deload week · half the sets, same weights')); box.append(banner); }
    const card = el('section', 'training-level ch-session is-today' + (sum.done ? ' is-done' : '')); card.dataset.day = key;
    const head = el('div', 'ch-session__head'), text = el('div', 'ch-grow'), p = CHADTrain.progress(state, key);
    text.append(el('p', 'ch-eyebrow', (isToday ? 'Today · ' : '') + DOW[weekday(key)] + (s.kind === 'gym' ? ' · ' + s.minutes + ' min' : s.kind === 'class' ? ' · ' + s.time : '')), el('h2', 'ch-session__name', s.name), el('p', 'ch-session__focus', s.focus));
    const ring = el('div', 'ch-ring'); ring.style.setProperty('--p', sum.done ? 100 : p.total ? p.done / p.total * 100 : 0); ring.setAttribute('role', 'img');
    ring.setAttribute('aria-label', sum.done ? 'Done' : p.total ? p.done + ' of ' + p.total + ' sets' : 'Not done yet');
    if (sum.done) ring.innerHTML = icon('check', 22, { weight: 3 }); else ring.append(el('strong', '', p.total ? p.done + '/' + p.total : '–'));
    head.append(text, ring); card.append(head);
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
    if (s.kind === 'gym' && isToday && !sum.done) {
      const go = button('ch-btn ch-btn--go ch-btn--block', () => window.CHADGym?.start(key)); go.dataset.gymStart = key;
      go.innerHTML = '<svg class="ch-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
      go.append(el('span', '', sum.live ? 'Resume workout' : 'Start workout')); actions.append(go);
    }
    // A finished workout is its own record (Undo takes it back); "Mark done" is for a session done without logging sets.
    if (key <= today && !sum.live && !w?.end) actions.append(markDone(key, s));
    if (actions.children.length) card.append(actions);
    const foot = el('div', 'cardio-note ch-session__foot'); foot.innerHTML = icon(s.kind === 'rest' ? 'leaf' : 'run', 16);
    const words = el('p'); words.append(s.kind === 'gym' ? 'Then ' + s.cardio : s.cardio); if (s.note) words.append(el('small', '', s.note)); foot.append(words); card.append(foot);
    box.append(card);
    const head2 = el('div', 'ch-section'); head2.append(el('h2', 'ch-h', 'Perfect Week v1'));
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
    const plan = el('section', 'ch-card ch-plan'), deloads = CHADTrain.DELOADS.map(([a, b]) => dayMonth(a) + '–' + dayMonth(b)).join(', ');
    for (const [glyph, label, value] of [['clock', 'Gym', '4–6 pm Darwin, cardio straight after'], ['target', 'Focus', CHADTrain.FOCUS.replace(/ · /g, ', ')], ['dumbbell', 'Rules', CHADTrain.RULES.join(' ')], ['leaf', 'Deloads', 'Half the sets, same weights, Muay Thai easy: ' + deloads], ['calendar', 'Next', 'Perfect Week v2 review on ' + shortDate(CHADTrain.REVIEW)]]) {
      const line = el('p', 'ch-plan__line'), disc = el('span', 'ch-plan__icon'); disc.innerHTML = icon(glyph, 16, { weight: 2.1 }); line.append(disc, el('b', '', label), el('span', '', value)); plan.append(line);
    }
    box.append(head2, rows, plan);
  }

  /* ---- Progress ---- */
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
    if (!all.length) return empty(list, 'dumbbell', 'No workouts yet', 'Start one from Today, 4–6 pm. Every set lands here.');
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
    if (!all.length) return empty(list, 'trophy', 'No records yet', 'Your best set for each exercise shows here, with its estimated 1RM.');
    for (const r of all) {
      const li = el('li', 'ch-cell record-row'), value = el('span', 'ch-cell__status');
      value.append(el('b', '', (r.kg > 0 ? CHADTrain.kgText(r.kg) + ' kg × ' : '') + r.reps + (r.kg > 0 ? '' : ' reps')), el('small', '', r.kg > 0 ? 'e1RM ' + CHADTrain.kgText(r.e1rm) : 'bodyweight'));
      li.dataset.record = r.name; li.append(el('span', 'ch-cell__title', r.name), value); list.append(li);
    }
  }
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
      // A missed day is the one thing that breaks the journey streak: one switch, with Undo like everything else.
      const missed = switchRow('missed-day', 'Missed day', false, on => update({ missed: on ? true : undefined }, { kind: on ? 'off' : 'on', positive: false, label: on ? 'Marked as missed · streak restarts' : 'Missed day cleared' }));
      dayList.append(weighRow, waterRow, missed); day.append(heading, dayList, el('p', 'ch-list-f', 'Every day from Day 1 counts toward the streak. Mark a day as missed to restart it the day after.'));
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
    $('local-weight').value = d.weight ?? ''; $('water-amount').value = d.water || 0; $('weight-date').textContent = shortDate(key); $('missed-day').checked = !!d.missed;
    $('missed-day').disabled = key > dayKey();
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => applyTheme(current?.arcadeTheme || 'system'));
  window.CHADQuest = { dayKey, shift, weekday, monday, waterGoal, phase, goals, deload, daily, week, stats, waterStreak, training, sessionLength, sessionProgress, rewards, render, paintCharts, shownAddons, LEVELS };
})();
