'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Darwin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
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
  function daily(state,key) {
    const q=state.questsV5?.[key]||{}, entries=state.entries.filter(e=>e.day===key);
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
  let api, current, lastStreak=null, settingsReady=false;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls){const kit={card:'ch-card',secondary:'ch-btn ch-btn--block',checks:'ch-quests','check-card':'ch-quest','check-box':'ch-quest__box',checked:'is-done','meal-slot':'ch-slot','meal-options':'ch-meals','meal-choice':'ch-meal','meal-pick':'ch-meal__hit','meal-info':'ch-meal__info','daily-quests':'ch-flow','water-row':'ch-water','bottles':'ch-bottles','bottle':'ch-bottle','water-total':'ch-water__val','quest-chips':'ch-qchips','exercise':'ch-ex','exercise-toggle':'ch-ex__hit','exercise-info':'ch-ex__info','cardio-note':'ch-session__foot','addons':'ch-qchips--wrap','tier-S':'ch-meal--strict','tier-M':'ch-meal--medium','tier-F':'ch-meal--free',selected:'is-selected','tier-label':'ch-meal__tier','meal-title':'ch-meal__name','meal-macros':'ch-meal__macros','phase-chip':'ch-chip ch-chip--cyan',deload:'ch-deload'};e.className=cls+' '+cls.split(' ').map(c=>kit[c]||'').join(' ');}if(text!==undefined)e.textContent=text;return e;};
  const button=(text,fn,cls='secondary')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
  const fmt=n=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(n);
  function chime(){if(!current.arcadeSound||matchMedia('(prefers-reduced-motion: reduce)').matches)return;try{const ac=new (window.AudioContext||window.webkitAudioContext)();[523,659,784].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.025,ac.currentTime+i*.07);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+i*.07+.1);o.connect(g).connect(ac.destination);o.start(ac.currentTime+i*.07);o.stop(ac.currentTime+i*.07+.11);});setTimeout(()=>ac.close(),600);}catch{/* Sound remains optional. */}}
  const activeKey=()=>api.key||dayKey();
  // Undo only the fields touched by an action, preserving subsequent unrelated edits.
  function update(patch,positive=true,key=activeKey(),label='Updated'){
    const old=current.questsV5?.[key]||{},before=Object.fromEntries(Object.keys(patch).map(k=>[k,old[k]]));
    if(api.save({...current,questsV5:{...current.questsV5,[key]:{...old,...patch}}})){
      if(positive){api.popXP(10);chime();}
      window.CHADUX.toast(label,()=>{
        const q={...current.questsV5?.[key]};Object.entries(before).forEach(([k,v])=>{if(v===undefined)delete q[k];else q[k]=v;});
        api.save({...current,questsV5:{...current.questsV5,[key]:q}});
      });
      return true;
    }
    return false;
  }
  function pick(slot,tier){
    const key=activeKey(),q=daily(current,key),was=q.picks[slot.id]===tier,picks={...q.picks};
    const prior=current.entries.filter(e=>e.day===key&&e.planSlot===slot.id),oldTier=picks[slot.id];delete picks[slot.id];
    let entries=current.entries.filter(e=>!(e.day===key&&e.planSlot===slot.id));
    if(!was){picks[slot.id]=tier;const c=slot.choices.find(c=>c.tier===tier);entries.push({id:'plan-'+key+'-'+slot.id,day:key,name:c.title,kcal:c.macros[0],protein:c.macros[1],carbs:c.macros[2],fat:c.macros[3],meal:slot.name,source:'plan',planSlot:slot.id});}
    if(api.save({...current,entries,questsV5:{...current.questsV5,[key]:{...current.questsV5?.[key],picks}}})){
      if(!was){api.popXP();chime();}
      window.CHADUX.toast(was?'Meal removed':'Meal logged',()=>{
        const q={...current.questsV5?.[key],picks:{...current.questsV5?.[key]?.picks}};
        if(oldTier===undefined)delete q.picks[slot.id];else q.picks[slot.id]=oldTier;
        api.save({...current,entries:[...current.entries.filter(e=>!(e.day===key&&e.planSlot===slot.id)),...prior],questsV5:{...current.questsV5,[key]:q}});
      });
    }
  }
  function removeEntry(state,e,save){const quests={...state.questsV5};if(e.planSlot){const q={...quests[e.day],picks:{...quests[e.day]?.picks}};delete q.picks[e.planSlot];quests[e.day]=q;}save({...state,questsV5:quests,entries:state.entries.filter(x=>x.id!==e.id)});}
  function toggle(field,label,q,container,key=activeKey()){
    const done=!!q[field],pill=container.classList.contains('training-level'),b=button(pill?label:'',()=>{
      const patch=field==='training'?{training:!done,exercises:Object.fromEntries(training[weekday(key)].ex.map((_,i)=>[i,!done]))}:{[field]:!done};
      update(patch,!done,key,label+(done?' removed':' logged'));
    },'quest-chip ch-qchip'+(pill?' ch-qchip--pill':'')+(done?' checked':''));
    if(!pill){const ic=el('span','ch-qchip__icon');ic.innerHTML=CHADIcons.icon({electrolyte:'electrolyte',training:'dumbbell',cardio:'run',steps:'shoe',sleep:'sleep'}[field]||'check',26);b.append(ic,el('span','ch-qchip__label',label==='10k steps'?'Steps':label));b.setAttribute('aria-label',label);}
    b.dataset.quest=field;b.setAttribute('aria-pressed',done);container.append(b);
  }
  function mealDetail(slot,c){
    const list=el('ul','ch-bullets');c.items.forEach(item=>list.append(el('li','',item)));
    const macros=el('div','ch-macros');['kcal','Protein','Carbs','Fat'].forEach((label,i)=>{const item=el('div','ch-macros__item'+(i===0?' ch-macros__item--kcal':''));item.append(el('b','',fmt(c.macros[i])),el('span','',label));macros.append(item);});
    const note=(icon,text)=>{const n=el('div','ch-note');n.innerHTML=CHADIcons.icon(icon,22);n.append(el('p','',text));return n;};
    const other=button('Log another meal',()=>window.CHADUX.openFood('camera',slot.id==='P'||slot.id==='E'?'Snacks':slot.name),'ch-btn ch-btn--primary ch-btn--block');
    window.CHADUX.detail(c.title,[macros,list,note('lightbulb',c.tip),note('swap',c.fix),other]);
  }
  function render(state,actions){
    current=state;api=actions;const key=activeKey(),d=daily(state,key),s=stats(state,dayKey()),p=phase(state,key);
    const hero=$('quest-hero');hero.replaceChildren();hero.hidden=true;
    $('home-streak').innerHTML=CHADIcons.icon('flame',18)+'<b class="ch-px">'+s.streak+'</b>';$('home-streak').setAttribute('aria-label',s.streak+' day streak');$('streak').textContent=s.streak+' day streak';
    $('daily-grade').textContent=d.grade;$('daily-grade').className='ch-grade ch-grade--'+d.grade.toLowerCase();$('grade-detail').textContent=d.score+'/17 pts';
    if(lastStreak!==null&&s.streak>lastStreak){$('celebration').textContent='Streak saved \u00b7 '+s.streak+' days';$('celebration').hidden=false;setTimeout(()=>$('celebration').hidden=true,3500);}lastStreak=s.streak;
    const checklist=$('daily-checklist');checklist.replaceChildren();
    const quests=el('section','daily-quests');quests.setAttribute('aria-label','Daily quests');
    const amount=d.water||0,target=waterGoal(key),water=button('',()=>update({water:Math.max(0,Math.min(30,Math.round((amount+(amount>=target?-.5:.5))*10)/10))},amount<target,key,amount>=target?'Bottle removed':'Bottle added'),'water-row'+(amount>=target?' is-full':''));
    water.setAttribute('aria-label',(amount>=target?'Remove 500 mL water. ':'Add 500 mL water. ')+fmt(amount)+' of '+target+' litres');
    const bottles=el('span','bottles');bottles.setAttribute('aria-hidden','true');
    for(let i=0;i<Math.ceil(target/.5);i++){
      const filled=amount>i*.5,b=el('i','bottle'+(filled?' filled':''));b.dataset.water=String(i);b.style.setProperty('--fill',Math.max(0,Math.min(1,(amount-i*.5)/.5)));bottles.append(b);
    }
    const total=el('span','water-total');total.innerHTML=fmt(amount)+'<small>/'+target+' L</small>';water.append(bottles,total);quests.append(water);
    const chips=el('div','quest-chips');for(const [field,label] of [['electrolyte','Hydralyte'],['training','Training'],['cardio','Cardio'],['steps','10k steps'],['sleep','Sleep']])toggle(field,label,d,chips,key);
    quests.append(chips);
    // A vertical list keeps every choice one tap away; the current slot leads.
    const currentIndex=CHADPlan.findIndex(slot=>slot.id===window.CHADUX.currentSlot());
    const pending=Array.from({length:4},(_,i)=>CHADPlan[(currentIndex+i)%4]).find(slot=>!d.picks[slot.id]);
    const slotId=pending?.id||CHADPlan[currentIndex].id,slots=[...CHADPlan].sort((a,b)=>(b.id===slotId)-(a.id===slotId));
    slots.forEach((slot,i)=>{
      const block=el('section','meal-slot'+(i===0?' next-up':''));block.dataset.mealSlot=slot.id;if(i===0)block.id='next-up';
      const heading=el('div','section-heading ch-slot__head'),title=el('h2','ch-slot__name',(i===0&&pending?'Next \u00b7 ':'')+slot.name);title.id='slot-heading-'+slot.id;block.setAttribute('aria-labelledby',title.id);const meta=el('span','ch-slot__meta');if(d.picks[slot.id])meta.innerHTML=CHADIcons.icon('check',14,{weight:2.6})+({S:'Strict',M:'Medium',F:'Free'}[d.picks[slot.id]]);else meta.textContent=slot.time;heading.append(title,meta);block.append(heading);
      const grid=el('div','meal-options');
      for(const c of slot.choices){
        const selected=d.picks[slot.id]===c.tier,wrap=el('div','meal-choice'),b=button('',()=>pick(slot,c.tier),'meal-pick tier-'+c.tier+(selected?' selected':''));
        b.dataset.slot=slot.id;b.dataset.tier=c.tier;b.setAttribute('aria-pressed',selected);
        b.setAttribute('aria-label',(selected?'Undo ':'Log ')+({S:'Strict',M:'Medium',F:'Free'}[c.tier])+' '+slot.name+': '+c.title);
        const kcal=el('span','ch-meal__kcal');kcal.innerHTML=fmt(Math.round(c.macros[0]))+'<small>kcal</small>';b.append(el('span','tier-label',{S:'Strict',M:'Medium',F:'Free'}[c.tier]),el('span','meal-title',c.title),kcal,el('span','meal-macros',fmt(Math.round(c.macros[1]))+' g protein'));
        // Long press opens the same sheet as the accessible info button, without logging.
        let timer,suppress=false,origin;
        b.addEventListener('pointerdown',e=>{suppress=false;origin={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{timer=null;suppress=true;mealDetail(slot,c);},550);});
        const cancel=()=>{clearTimeout(timer);timer=null;};
        b.addEventListener('pointermove',e=>{if(origin&&(Math.abs(e.clientX-origin.x)>10||Math.abs(e.clientY-origin.y)>10))cancel();});
        b.addEventListener('pointerup',cancel);b.addEventListener('pointercancel',cancel);b.addEventListener('pointerleave',cancel);
        b.addEventListener('click',e=>{if(suppress){e.stopImmediatePropagation();e.preventDefault();suppress=false;}},true);
        b.addEventListener('contextmenu',e=>e.preventDefault());
        const info=button('',()=>mealDetail(slot,c),'meal-info');info.innerHTML=CHADIcons.icon('info',20);info.setAttribute('aria-label',slot.name+' '+({S:'Strict',M:'Medium',F:'Free'}[c.tier])+' details');
        wrap.append(b,info);grid.append(wrap);
      }
      block.append(grid);checklist.append(block);if(i===0)checklist.append(quests);
    });
    if(p[0]!=='cut'){
      const box=el('section','card addons');box.append(el('h2','',p[1]+' add-ons'));
      const addons=p[0]==='bulk'?[['bagel','Plain bagel',[313,10,60,2]],['wrap','Protein wrap',[175,10,24,4]],['shake','Daily shake',[610,38,83,13]]]:[['shake','Daily shake',[610,38,83,13]],['banana','Extra banana',[89,1.1,23,.3]]];
      for(const [id,name,m] of addons){const eid='addon-'+key+'-'+id,has=state.entries.some(e=>e.id===eid),old=state.entries.find(e=>e.id===eid);
        const b=button(name+' \u00b7 '+m[0]+' kcal',()=>{if(api.save({...current,entries:has?current.entries.filter(e=>e.id!==eid):[...current.entries,{id:eid,day:key,name,kcal:m[0],protein:m[1],carbs:m[2],fat:m[3],source:'addon',meal:'Snacks'}]})){if(!has)api.popXP();window.CHADUX.toast(has?'Add-on removed':'Add-on logged',()=>api.save({...current,entries:[...current.entries.filter(e=>e.id!==eid),...(old?[old]:[])]}));}},'quest-chip ch-qchip ch-qchip--pill'+(has?' checked':''));b.setAttribute('aria-pressed',has);box.append(b);
      }checklist.append(box);
    }
    let weigh=$('local-weight');if(!weigh){
      const box=el('section','card'),label=el('label','','Optional weigh-in (kg)');weigh=el('input');weigh.id='local-weight';weigh.type='number';weigh.min='20';weigh.max='500';weigh.step='.1';label.htmlFor=weigh.id;const date=el('p','hint');date.id='weight-date';box.append(date,label,weigh);
      const waterLabel=el('label','','Adjust water (L)'),water=el('input');water.id='water-amount';water.type='number';water.min='0';water.max='30';water.step='.1';waterLabel.htmlFor=water.id;box.append(waterLabel,water);$('data-settings').before(box);
      water.onchange=()=>{const value=Number(water.value);if(water.value!==''&&Number.isFinite(value)&&value>=0&&value<=30)update({water:value},false,activeKey(),'Water saved');};
      weigh.onchange=()=>{const v=weigh.value===''?null:Number(weigh.value);if(v===null||Number.isFinite(v)&&v>=20&&v<=500)update({weight:v},false,activeKey(),'Weigh-in saved');};
    }
    weigh.value=d.weight??'';$('water-amount').value=d.water||0;$('weight-date').textContent=key;
    const weekCard=el('section','card week-summary');weekCard.append(el('h2','',s.level+' \u00b7 '+s.week.total+' pts'),el('p','hint',s.week.free+'/2 Free \u00b7 '+(s.week.free>2?'No bonus':s.week.bonus?'+10 bonus':'+10 pending')));$('weekly-progress').replaceChildren(weekCard);
    renderTraining(state,key);renderCharts(state,key);renderSettings(state);appendBadges(s);
  }
  function renderTraining(state,key){
    const box=$('training-content');box.replaceChildren();if(deload(key))box.append(el('div','deload','Deload \u00b7 half sets'));
    const todayIndex=weekday(key),start=monday(key),order=[todayIndex,...[1,2,3,4,5,6,0].filter(i=>i!==todayIndex)];
    for(const i of order){
      const session=training[i],isToday=i===todayIndex,sessionKey=shift(start,(i+6)%7),q=daily(state,sessionKey);
      const card=el('section','training-level ch-session'+(isToday?' is-today':' ch-session--compact')+(q.training?' is-done':''));card.dataset.day=sessionKey;
      const heading=el('div','ch-session__head'),hb=el('div','ch-grow'),nm=session.name.charAt(0)+session.name.slice(1).toLowerCase(),doneN=session.ex.filter((_,x)=>q.training||q.exercises?.[x]).length;hb.append(el('p','ch-eyebrow',(isToday&&key===dayKey()?'Today \u00b7 ':'')+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]),el('h2','ch-session__name',nm));if(isToday)hb.append(el('p','ch-session__focus',session.muscles));heading.append(hb);if(isToday){const ring=el('div','ch-ring');ring.style.cssText='--p:'+(doneN/session.ex.length*100)+';--size:56px;--w:6px;--c:var(--ch-gold)';ring.setAttribute('role','img');ring.setAttribute('aria-label',doneN+' of '+session.ex.length+' done');const v=el('strong','ch-ring__val',doneN+'/'+session.ex.length);v.style.fontSize='15px';ring.append(v);heading.append(ring);}else{const m=el('span','ch-session__meta');if(q.training)m.innerHTML=CHADIcons.icon('check',16,{weight:2.6})+'Done';else m.textContent=doneN?doneN+' of '+session.ex.length:session.ex.length+' moves';heading.append(m);}card.append(heading);
      if(isToday)toggle('training','Whole session done',q,card,sessionKey);
      session.ex.forEach((text,j)=>{
        const [name,sets]=text.split('|'),row=el('div','exercise'),exDone=!!q.training||!!q.exercises?.[j];let prescription=sets||'';
        if(deload(sessionKey)&&prescription)prescription=prescription.replace(/^(\d+)(?:\u2013(\d+))?/,(_,a,b)=>Math.ceil(Number(a)/2)+(b?'\u2013'+Math.ceil(Number(b)/2):''));
        const b=button('',()=>{
          const now=daily(current,sessionKey),done=!!now.training||!!now.exercises?.[j],ex={...now.exercises,[j]:!done};if(now.training)session.ex.forEach((_,x)=>ex[x]=x!==j);
          update({exercises:ex,training:session.ex.every((_,x)=>ex[x])},!done,sessionKey,done?'Exercise removed':'Exercise logged');
        },'exercise-toggle');b.append(el('span','ch-ex__check'),el('span','ch-ex__name',name));if(prescription)b.append(el('span','ch-ex__meta',prescription.replace('x',' \u00d7 ')));b.setAttribute('aria-label',name+(prescription?', '+prescription:''));b.dataset.exercise=String(j);b.setAttribute('aria-pressed',exDone);row.append(b);
        const info=button('',()=>{
          const nodes=[el('p','',session.muscles),el('p','',session.note||'Stop 2 reps before failure. Add reps, then weight.')];
          if(sets&&name!=='Hill sprints'){
            const form=el('form','top-set-form'),kg=el('input'),reps=el('input');kg.type=reps.type='number';kg.min='0';kg.max='1000';kg.step='.5';kg.placeholder='kg';kg.setAttribute('aria-label',name+' weight kg');reps.min='1';reps.max='200';reps.placeholder='reps';reps.setAttribute('aria-label',name+' reps');kg.required=reps.required=true;
            const old=daily(current,sessionKey).topSets?.[name];if(old){kg.value=old.kg;reps.value=old.reps;}
            const submit=el('button','secondary','Save top set');submit.type='submit';form.append(kg,reps,submit);
            form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;const record={kg:Number(kg.value),reps:Number(reps.value)},value=record.kg*(1+record.reps/30),best=Math.max(0,...Object.values(current.questsV5||{}).map(d=>d.topSets?.[name]).filter(Boolean).map(r=>r.kg*(1+r.reps/30)));
              if(!update({topSets:{...daily(current,sessionKey).topSets,[name]:record}},false,sessionKey,'Top set saved'))return;window.CHADUX.closeSheets();if(value>best){$('celebration').textContent='Personal record \u00b7 '+name;$('celebration').hidden=false;setTimeout(()=>$('celebration').hidden=true,3500);chime();}
            };nodes.push(form);
          }window.CHADUX.detail(name,nodes);
        },'exercise-info');info.innerHTML=CHADIcons.icon('info',20);info.setAttribute('aria-label',name+' details and top set');row.append(info);card.append(row);
      });card.append(el('p','cardio-note',session.cardio));box.append(card);
    }
  }
  function appendBadges(s){const badges=[['protein7','Protein Streak','7 days at 210 g+',s.maxP>=7],['water7','Hydration Hero','7 days on water target',s.maxW>=7],['zero','Zero-Free Week','Complete Mon–Sun, no Free picks',s.zero],['fight','Fight Night Fuel','Wednesday: water, electrolyte, Strict dinner',s.fight],['perfect','Perfect Day','17 / 17 daily points',s.perfect]];for(const [id,name,hint,unlocked] of badges){const li=el('li','badge '+(unlocked?'unlocked':'locked'));li.dataset.badge=id;li.append(el('span','badge-icon',unlocked?'✦':'◇'),el('strong','',name),el('small','',hint));$('badges').append(li);}const all=$('badges').children;$('badge-count').textContent=[...all].filter(e=>e.classList.contains('unlocked')).length+'/'+all.length;}
  function kitChart(title,series,color,kind='bar'){
    const card=el('section','card chart-card'),chart=el('div','ch-chart');
    chart.setAttribute('role','img');chart.setAttribute('aria-label',title);
    card.append(el('h2','ch-h',title),chart);
    // Keep every daily value and goal available to screen readers and offline users.
    const values=el('details','chart-values');values.append(el('summary','','Daily values'));
    series.forEach(d=>values.append(el('p','hint',d.key+': '+(d.value==null?'No entry':fmt(d.value))+(d.goal?' / '+fmt(d.goal):''))));
    if(!series.some(d=>d.value))card.append(el('p','hint','No data yet'));card.append(values);card.paint=()=>kind==='bar'?CHADCharts.barsVsGoal(chart,series.map((d,i)=>({label:i%Math.ceil(series.length/7)===0?d.key.slice(5):'',value:d.value})),series.at(-1).goal,{color,goals:series.map(d=>d.goal),animate:false}):CHADCharts.line(chart,series.map((d,i)=>({label:i%Math.ceil(series.length/7)===0?d.key.slice(5):'',value:d.value})),{color,unit:kind==='weight'?'kg':'g',animate:false});
    return card;
  }
  let chartRange=7;
  function renderCharts(state,key){const box=$('charts');box.replaceChildren();const controls=el('div','chart-controls');[7,30].forEach(n=>{const b=button(n+' DAYS',()=>{chartRange=n;renderCharts(current,activeKey());},'secondary'+(chartRange===n?' active':''));b.setAttribute('aria-pressed',chartRange===n);controls.append(b);});box.append(controls);const days=Array.from({length:chartRange},(_,i)=>shift(key,i-chartRange+1));const data=days.map(k=>({key:k,d:daily(state,k)}));box.append(kitChart('CALORIES / GOAL',data.map(({key:k,d})=>({key:k,value:d.totals[0],goal:goals(state,k).target})),'--ch-gold'));box.append(kitChart('PROTEIN / g',data.map(({key:k,d})=>({key:k,value:d.totals[1]})),'--ch-cyan','line'));
    const weight=data.map(({key:k})=>{const values=Array.from({length:7},(_,i)=>daily(state,shift(k,-i)).weight).filter(v=>typeof v==='number'&&v>0);return {key:k,value:values.length?values.reduce((s,v)=>s+v,0)/values.length:null};});box.append(kitChart('WEIGHT / 7-DAY AVERAGE',weight,'--ch-magenta','weight'),kitChart('WATER / L',data.map(({key:k,d})=>({key:k,value:d.water||0,goal:waterGoal(k)})),'--ch-cyan'),kitChart('DAILY SCORE / 17',data.map(({key:k,d})=>({key:k,value:d.score,goal:17})),'--ch-magenta'));
    const heat=el('section','card chart-card');heat.append(el('h2','ch-h','13-week streak'));
    const pixels=Array.from({length:91},(_,i)=>{const k=shift(key,i-90);return {key:k,value:daily(state,k).score/17};});
    const squares=el('div','ch-chart streak-chart');squares.setAttribute('role','img');squares.setAttribute('aria-label','91 days of daily quest scores');heat.append(squares);
    const values=el('details','chart-values');values.append(el('summary','','Daily scores'));pixels.forEach(p=>values.append(el('p','hint',p.key+': '+Math.round(p.value*17)+'/17')));heat.append(values);box.append(heat);
    heat.paint=()=>CHADCharts.heatmap(squares,pixels,{max:1,today:90,animate:false});
    const rings=el('section','card progress-rings');rings.append(el('h2','ch-h','TODAY / GOALS'));const d=daily(state,key),g=goals(state,key);
    for(const [label,value,goal,color]of [['KCAL',d.totals[0],g.target,'--ch-gold'],['PROTEIN',d.totals[1],g.proteinGoal,'--ch-cyan']]){const ring=el('div','progress-ring');ring.setAttribute('role','img');ring.setAttribute('aria-label',label+': '+fmt(value)+' / '+goal);rings.append(ring);ring.paint=()=>CHADCharts.ring(ring,Math.min(100,value/goal*100),{color,sub:label,animate:false});}
    box.prepend(rings);paintCharts();
  }
  function paintCharts(){if($('history').hidden)return;document.querySelectorAll('#charts .chart-card, #charts .progress-ring').forEach(c=>c.paint?.());CHADCharts.redraw();}

  function applyTheme(value){if(value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=value;const dark=value==='dark'||value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches;document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=dark?'#000000':'#F2F2F7');}
  function renderSettings(state){applyTheme(state.arcadeTheme||'system');$('phase').value=state.phaseMode||'auto';if(settingsReady)return;settingsReady=true;const auto=el('option','','Automatic · Darwin date');auto.value='auto';$('phase').prepend(auto);$('phase').value=state.phaseMode||'auto';const box=$('arcade-settings');box.append(el('h2','','Appearance & phase schedule'));const theme=el('select');theme.id='theme-mode';[['system','Follow system'],['dark','Dark · Fitness'],['light','Light · iOS']].forEach(([v,t])=>{const o=el('option','',t);o.value=v;theme.append(o);});theme.value=state.arcadeTheme||'system';const label=el('label','','Appearance');label.htmlFor=theme.id;theme.onchange=()=>api.save({...current,arcadeTheme:theme.value});box.append(label,theme);const sound=button('Sounds: '+(state.arcadeSound?'ON':'OFF'),()=>{api.save({...current,arcadeSound:!current.arcadeSound});sound.textContent='Sounds: '+(current.arcadeSound?'ON':'OFF');sound.setAttribute('aria-pressed',!!current.arcadeSound);},'secondary');sound.setAttribute('aria-pressed',!!state.arcadeSound);box.append(sound);
    const form=el('form');form.append(el('h3','','Automatic phase dates'));const inputs=[];['Cut ends','Reset ends','Bulk ends'].forEach((name,i)=>{const input=el('input');input.type='date';input.required=true;input.value=(state.phaseEnds||phases.map(p=>p[2]))[i];input.id='phase-end-'+i;const label=el('label','',name);label.htmlFor=input.id;form.append(label,input);inputs.push(input);});const submit=el('button','secondary','Save phase dates');form.append(submit);form.onsubmit=e=>{e.preventDefault();const ends=inputs.map(i=>i.value);if(ends[0]>=ends[1]||ends[1]>=ends[2]){inputs[1].setCustomValidity('Dates must be in order.');inputs[1].reportValidity();return;}api.save({...current,phaseEnds:ends});};inputs.forEach(i=>i.oninput=()=>inputs[1].setCustomValidity(''));box.append(form,el('p','hint','After Bulk ends, Bulk goals continue until you edit the phase. Manual phase / custom goals below override automatic dates.'));
    const exportButton=button('Export local backup',()=>{const blob=new Blob([JSON.stringify({journal:current,legacyGame:RECGame.derive(current,dayKey()).badges},null,2)],{type:'application/json'}),a=el('a');a.href=URL.createObjectURL(blob);a.download='chad-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});box.append(exportButton,el('p','hint','Backup may contain your private measurements and meal photos. Keep it private. API keys are excluded.'));
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>applyTheme(current?.arcadeTheme||'system'));
  window.CHADQuest={dayKey,shift,weekday,monday,waterGoal,phase,goals,deload,daily,week,stats,training,rewards,render,removeEntry,paintCharts};
})();
