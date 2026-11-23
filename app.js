'use strict';
(() => {
  const KEY = 'rec-calories-v1';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  const dayKey = CHADQuest.dayKey;
  const valid = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const defaults = () => ({ schemaVersion: 5, target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, entries: [] });
  let state = defaults();
  let storageReadable = true;
  let previousGame = null;
  let celebrationTimer;
  let currentDay = dayKey();
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const defaultMeal = () => { const hour = new Date().getHours(); return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snacks'; };
  function prune(entries) { return entries; }
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      storageReadable = true;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !valid(parsed.target, 1, 50000) || !Array.isArray(parsed.entries)) throw new Error();
      const ids = new Set();
      const entries = parsed.entries.filter(e => e && typeof e.id === 'string' && !ids.has(e.id) && ids.add(e.id) && typeof e.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) && valid(e.kcal, 1, 50000) && valid(e.protein, 0, 5000) && ['carbs', 'fat'].every(k => e[k] === undefined || valid(e[k], 0, 5000)));
      if (entries.length !== parsed.entries.length || (parsed.proteinGoal !== undefined && !valid(parsed.proteinGoal, 1, 5000))) throw new Error();
      const prior = parsed.legacyRewards || (parsed.schemaVersion !== 5 ? (() => { const g=RECGame.derive(parsed,dayKey()); return {xp:g.xp,badges:g.badges.filter(b=>b.unlocked).map(b=>b.id)}; })() : null);
      state = { ...parsed, legacyRewards: prior, legacyGoals: parsed.legacyGoals || (parsed.schemaVersion !== 5 ? {target:parsed.target,proteinGoal:parsed.proteinGoal,carbsGoal:parsed.carbsGoal,fatGoal:parsed.fatGoal} : undefined), schemaVersion: 5, target: parsed.target, proteinGoal: parsed.proteinGoal ?? 220, carbsGoal: parsed.carbsGoal ?? 150, fatGoal: parsed.fatGoal ?? 45, entries: prune(entries) };
    } catch { storageReadable = false; message('Saved data could not be read. Saving is paused to protect it. Your existing data has not been replaced.', true); }
  }
  function save(next) {
    if (!storageReadable) { message('Saving is paused to protect unreadable saved data.', true); return false; }
    try { next = { ...next, schemaVersion: 5, entries: prune(next.entries) }; localStorage.setItem(KEY, JSON.stringify(next)); state = next; render(); return true; }
    catch {
      message('Could not save. Storage may be full or unavailable. Your entry has not been changed.', true); return false; }
  }
  function totals(entries) { return entries.reduce((sum, e) => ({ kcal: sum.kcal + e.kcal, protein: sum.protein + e.protein, carbs: sum.carbs + (e.carbs || 0), fat: sum.fat + (e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); }
  function add(name, kcal, protein, extras = {}) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: dayKey(), name: name.trim().slice(0, 80), kcal, protein, carbs: 0, fat: 0, meal: defaultMeal(), ...extras };
    if (save({ ...state, entries: [...state.entries, entry] })) { popXP(); message(`${name || 'Entry'} added · ${fmt(kcal)} kcal · +10 XP`); return true; }
    return false;
  }
  function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
  let scanner = null, draft = [], draftSource = 'photo', xpTimer, scannerSession=0;
  function render() {
    currentDay = dayKey();
    Object.assign(state, CHADQuest.goals(state, currentDay));
    const entries = state.entries.filter(e => e.day === currentDay), t = totals(entries);
    $('date-label').textContent = new Date().toLocaleDateString(undefined,{timeZone:'Australia/Darwin',weekday:'long',month:'short',day:'numeric'});
    $('remaining').textContent = fmt(Math.abs(state.target-t.kcal)); $('remaining-label').textContent = t.kcal>state.target?'kcal over':'kcal left';
    $('consumed').textContent=fmt(t.kcal); $('target-label').textContent=fmt(state.target); $('protein-total').textContent=fmt(t.protein); $('protein-goal-label').textContent=fmt(state.proteinGoal);
    $('carbs-total').textContent=fmt(t.carbs); $('fat-total').textContent=fmt(t.fat);
    for(const [id,value,goal] of [['calorie-ring',t.kcal,state.target],['protein-ring',t.protein,state.proteinGoal]]) { $(id).style.setProperty('--p',Math.min(100,value/goal*100)); $(id).setAttribute('aria-label',`${fmt(value)} of ${fmt(goal)} ${id==='protein-ring'?'grams protein':'calories'}`); }
    $('entry-count').textContent=`${entries.length} entries`;
    renderEntries($('entries'),entries); renderEntries($('past-entries'),state.entries.filter(e=>e.day!==currentDay).slice().sort((a,b)=>b.day.localeCompare(a.day)));
    const game=CHADQuest.rewards(state,currentDay,RECGame.derive(state,currentDay)); renderGame(game); CHADQuest.render(state, { save, showView, popXP });
  }
  function renderEntries(container,entries) {
    container.replaceChildren(); if(!entries.length) container.append(node('li','empty','Your next win starts with a meal.'));
    entries.slice().reverse().forEach(e=>{
      const row=node('li','entry'),info=node('div','entry-info'); info.append(node('strong','',e.name||'Quick entry'),node('small','',`${e.day===currentDay?e.meal||'Meal':e.day} · ${fmt(e.kcal)} kcal · P ${fmt(e.protein)} / C ${fmt(e.carbs||0)} / F ${fmt(e.fat||0)} g`));
      const again=node('button','repeat','Log again');again.type='button';again.onclick=()=>add(e.name,e.kcal,e.protein,{carbs:e.carbs||0,fat:e.fat||0,portion:e.portion||'',source:'repeat'});
      const del=node('button','delete','×');del.type='button';del.setAttribute('aria-label',`Delete ${e.name||'entry'}`);del.onclick=()=>CHADQuest.removeEntry(state,e,save);
      row.append(info,again,del);container.append(row);
    });
  }
  function renderGame(g) {
    $('home-streak').textContent=`🔥 ${g.streak}`; $('streak').textContent=`🔥 ${g.streak} day streak`; $('level-name').textContent=g.name; $('level-number').textContent=`Level ${g.level+1}`; $('xp-total').textContent=`${fmt(g.xp)} XP`; $('level-progress').value=g.next?(g.xp-g.floor)/(g.next-g.floor)*100:100; $('xp-bar').style.setProperty('--p',$('level-progress').value/100);$('xp-bar').setAttribute('aria-valuenow',Math.round($('level-progress').value));$('level-next').textContent=g.next?`${g.next-g.xp} XP to your next level`:'Legend status. Keep showing up.';
    const grade=g.days.get(currentDay)?.grade||'—';if($('daily-grade').textContent!==grade){$('daily-grade').textContent=grade;animate($('daily-grade'),'reveal');}
    $('quests').replaceChildren();g.quests.forEach(q=>{const row=node('div','quest');const title=node('div','quest-label');title.append(node('span','',`${q.complete?'✓':'○'} ${q.name}`),node('strong','',q.complete?`+${q.xp} XP`:`${fmt(q.progress)}/${q.target}`));const bar=node('progress');bar.max=q.target;bar.value=q.progress;bar.setAttribute('aria-label',`${q.name}: ${q.progress} of ${q.target}`);row.append(title,bar);$('quests').append(row);});
    $('badge-count').textContent=`${g.badges.filter(b=>b.unlocked).length}/${g.badges.length}`;$('badges').replaceChildren();g.badges.forEach(b=>{const li=node('li',`badge ${b.unlocked?'unlocked':'locked'}`);li.append(node('span','badge-icon',b.unlocked?b.icon:'○'),node('strong','',b.name),node('small','',b.hint));$('badges').append(li);});
    $('history-bars').replaceChildren();for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dayKey(d),day=g.days.get(key);const row=node('div','history-row');row.append(node('span','',`${d.toLocaleDateString(undefined,{weekday:'short'})} · ${day?.grade||'—'}`),node('strong','',`${fmt(day?.kcal||0)} kcal`));$('history-bars').append(row);}
    if(previousGame){const fresh=g.badges.filter(b=>b.unlocked&&!previousGame.badges.find(o=>o.id===b.id)?.unlocked);if(fresh.length){$('celebration').textContent=`✦ Badge unlocked: ${fresh.map(b=>b.name).join(', ')}`;$('celebration').hidden=false;clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>$('celebration').hidden=true,4500);}if(g.level>previousGame.level){$('new-level').textContent=`Level ${g.level+1} · ${g.name}`;if(!$('level-up').open)$('level-up').showModal();}}
    previousGame=g;
  }
  function animate(el,name){el.classList.remove(name);void el.offsetWidth;el.classList.add(name);}
  function popXP(amount=10){$('xp-pop').textContent=`+${amount} XP`;$('xp-pop').hidden=false;animate($('xp-pop'),'pop');animate($('today-scan'),'bounce');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(35);clearTimeout(xpTimer);xpTimer=setTimeout(()=>$('xp-pop').hidden=true,1100);}
  function stopScanner(){scannerSession++;scanner?.stop();scanner=null;$('barcode-video').hidden=true;$('stop-camera').hidden=true;}
  function showView(id){stopScanner();document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==id);document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.view===id);b.classList.toggle('is-active',b.dataset.view===id);if(b.dataset.view===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('today-scan').hidden=id==='scan';if(id==='history')CHADQuest.paintCharts();if(id==='scan')$('key-card').hidden=!!getKey();if(id==='settings')fillGoals();window.scrollTo(0,0);}
  function getKey(){try{return localStorage.getItem('rec-calories-ai-key')||'';}catch{return '';}}
  window.CHADSprites?.mount(document);
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('today-scan').onclick=()=>showView('scan');$('scan-settings').onclick=()=>{showView('settings');$('ai-key').focus();};$('scan-manual').onclick=()=>{showView('today');$('add-form').closest('details').open=true;$('calories').focus();};
  $('close-level').onclick=()=>$('level-up').close();
  $('add-form').onsubmit=e=>{e.preventDefault();const n=['calories','protein','carbs','fat'].map(id=>Number($(id).value||0));if(!valid(n[0],1,50000)||!n.slice(1).every(v=>valid(v,0,5000)))return message('Check your nutrition numbers.',true);if(add($('food-name').value,n[0],n[1],{carbs:n[2],fat:n[3],meal:$('meal').value,source:'manual'})){$('add-form').reset();$('meal').value=defaultMeal();}};
  const presets={cut:[1900,220,150,45],reset:[2700,200,320,70],bulk:[3000,200,370,80]}, goalIds=['daily-target','protein-goal','carbs-goal','fat-goal'];
  $('phase').onchange=()=>{const p=presets[$('phase').value];if(p)p.forEach((v,i)=>$(goalIds[i]).value=v);};
  $('settings-form').onsubmit=e=>{e.preventDefault();const v=goalIds.map(id=>Number($(id).value));if(!valid(v[0],1,50000)||!v.slice(1).every(n=>valid(n,1,5000)))return message('Check your goal numbers.',true);if(save({...state,phaseMode:$('phase').value,target:v[0],proteinGoal:v[1],carbsGoal:v[2],fatGoal:v[3],customGoals:v,phaseMacros:['cut','reset','bulk'].includes($('phase').value)?{...state.phaseMacros,[$('phase').value]:v}:state.phaseMacros})){try{const k=$('ai-key').value.trim();if(k)localStorage.setItem('rec-calories-ai-key',k);else localStorage.removeItem('rec-calories-ai-key');message('Settings saved.');}catch{message('Goals saved. Key storage unavailable.',true);}}};
  function openResult(items,source){draft=items;draftSource=source;$('scan-items').replaceChildren();draft.forEach(item=>$('scan-items').append(node('h3','',item.name)));$('confidence').textContent=source==='photo'||source==='text'?'AI estimate · check ingredients and portions':`Open Food Facts · ${items[0].portion} · check package label`;$('portion-slider').value='1';$('serving-control').hidden=items[0].basis!=='100g';$('serving-grams').value='100';$('scan-meal').value=defaultMeal();updateResult();$('confirm-sheet').showModal();}
  function result(){const m=Number($('portion-slider').value)*(draft[0]?.basis==='100g'?Number($('serving-grams').value)/100:1);return draft.map(i=>({...i,kcal:Math.round(i.kcal*m),protein:Math.round(i.protein*m*10)/10,carbs:Math.round(i.carbs*m*10)/10,fat:Math.round(i.fat*m*10)/10,portion:`${fmt(m)}× ${i.portion}`}));}
  function updateResult(){const t=totals(result());$('portion-label').textContent=`${$('portion-slider').value}×`;$('scan-total').textContent=`${fmt(t.kcal)} kcal`;$('result-macros').textContent=`Protein ${fmt(t.protein)} g · Carbs ${fmt(t.carbs)} g · Fat ${fmt(t.fat)} g`;}
  $('portion-slider').oninput=updateResult;$('serving-grams').oninput=updateResult;$('cancel-scan').onclick=()=>$('confirm-sheet').close();
  $('copy-result').onclick=async()=>{const t=totals(result());try{await navigator.clipboard.writeText(`${draft.map(i=>i.name).join(' + ')} · ${fmt(t.kcal)} kcal · P ${fmt(t.protein)}g C ${fmt(t.carbs)}g F ${fmt(t.fat)}g`);message('Summary copied.');}catch{message('Clipboard unavailable. Try from HTTPS.',true);}};
  $('scan-confirm-form').onsubmit=e=>{e.preventDefault();if(!draft.length)return;const items=result();if(!items.every(i=>valid(i.kcal,1,50000)&&['protein','carbs','fat'].every(k=>valid(i[k],0,5000))))return message('Check serving size and nutrition limits.',true);const entries=items.map((item,i)=>({...item,id:`${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,day:dayKey(),meal:$('scan-meal').value,source:draftSource}));if(save({...state,entries:[...state.entries,...entries]})){$('confirm-sheet').close();showView('today');popXP(entries.length*10);message('Meal logged. Keep building.');}};
  async function estimate(file){if(!getKey()){$('key-card').hidden=false;$('key-card').scrollIntoView({block:'center'});return;}if(scanBusy)return;scanBusy=true;$('scan-status').textContent='Decoding your meal…';$('camera-button').disabled=$('describe-button').disabled=true;try{const photo=file?await RECScan.compress(file):null;const r=await RECScan.analyze(photo?.image||null,getKey(),fetch,$('food-description').value);openResult(r.items,file?'photo':'text');$('scan-status').textContent='Ready to review.';}catch(e){$('scan-status').textContent=e.message;}finally{scanBusy=false;$('camera-button').disabled=$('describe-button').disabled=false;$('photo-input').value='';}}
  let scanBusy=false;$('camera-button').onclick=()=>{if(!getKey()){$('key-card').hidden=false;$('key-card').scrollIntoView({block:'center'});}else $('photo-input').click();};$('photo-input').onchange=()=>{if($('photo-input').files[0])estimate($('photo-input').files[0]);};$('describe-button').onclick=()=>{if(!$('food-description').value.trim())return message('Describe your meal first.',true);estimate();};
  let foodBusy=false;async function findFood(task){if(foodBusy)return;foodBusy=true;$('scan-status').textContent='Finding your food…';$('food-results').replaceChildren();try{const items=await task();if(!items.length)$('scan-status').textContent='No matching foods with complete nutrition. Try another name or barcode.';else{$('scan-status').textContent=`${items.length} result${items.length===1?'':'s'} · select to review` ;items.forEach(item=>{const b=node('button','food-result');b.type='button';b.append(node('strong','',item.name),node('small','',`${item.portion} · ${fmt(item.kcal)} kcal`));b.onclick=()=>openResult([item],item.source);$('food-results').append(b);});}}catch(e){$('scan-status').textContent=e.message;}finally{foodBusy=false;}}
  $('search-form').onsubmit=e=>{e.preventDefault();findFood(()=>CHADFood.search($('food-search').value));};$('barcode-form').onsubmit=e=>{e.preventDefault();findFood(async()=>[await CHADFood.lookup($('barcode').value)]);};
  $('barcode-camera').onclick=async()=>{stopScanner();const session=scannerSession;$('barcode-video').hidden=false;$('stop-camera').hidden=false;$('scan-status').textContent='Point your camera at a barcode.';try{const controls=await CHADFood.startScanner($('barcode-video'),code=>{stopScanner();$('barcode').value=code;findFood(async()=>[await CHADFood.lookup(code)]);});if(session!==scannerSession)controls.stop();else scanner=controls;}catch(e){stopScanner();$('scan-status').textContent=e.message;}};$('stop-camera').onclick=stopScanner;
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){state=defaults();previousGame=null;read();render();fillGoals();}});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScanner();else render();});setInterval(()=>{if(dayKey()!==currentDay)render();},30000);
  function fillGoals(){[state.target,state.proteinGoal,state.carbsGoal,state.fatGoal].forEach((v,i)=>$(goalIds[i]).value=v);}
  read();render();fillGoals();if(storageReadable)save(state);$('meal').value=defaultMeal();$('ai-key').value=getKey();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>$('offline-status').textContent='Ready for offline logging. Food lookup and AI need internet.').catch(()=>$('offline-status').textContent='Offline setup unavailable. Try opening online again.');
})();
