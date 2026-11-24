'use strict';
// v7 navigation and sheets. Storage and scoring remain in app.js / quest.js.
(() => {
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => { const n=document.createElement(tag);n.className=className||'';if(text!==undefined)n.textContent=text;return n; };
  let selectedDay=null, stopScanner=()=>{}, refresh=()=>{}, undoTimer, foodMeal=null;
  const dateKey=()=>selectedDay||CHADQuest.dayKey();
  const defaultJourneyStart='2026-10-08';
  const validDate=key=>typeof key==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(key)&&Number.isFinite(Date.parse(key+'T00:00:00Z'))&&new Date(key+'T00:00:00Z').toISOString().slice(0,10)===key;
  // Subtract calendar dates, never device-local timestamps (Darwin has no DST).
  const journeyDay=(key,start=defaultJourneyStart)=>Math.round((Date.parse(key+'T00:00:00Z')-Date.parse((validDate(start)?start:defaultJourneyStart)+'T00:00:00Z'))/86400000)+1;
  function navigate(offset){selectedDay=CHADQuest.shift(dateKey(),offset);if(selectedDay===CHADQuest.dayKey())selectedDay=null;closeSheets();refresh();window.scrollTo(0,0);}
  function toast(text,undo){
    clearTimeout(undoTimer);const bar=$('undo-toast'),tick=make('span','ch-toast__icon');tick.innerHTML=CHADIcons.icon('check',14,{weight:3.2});bar.replaceChildren(tick,make('span','ch-toast__text',text));bar.style.setProperty('--life','6s');
    if(undo){const b=make('button','ch-toast__action','Undo');b.type='button';b.onclick=()=>{bar.hidden=true;undo();};bar.append(b);}
    bar.hidden=false;undoTimer=setTimeout(()=>bar.hidden=true,6000);
  }
  function currentSlot(date=new Date()) {
    const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Darwin',hour:'numeric',hourCycle:'h23'}).format(date));
    return hour<14?'L':hour<18?'P':hour<21?'D':'E';
  }
  function closeSheets(){document.querySelectorAll('dialog.ch-sheet[open]').forEach(d=>d.close());stopScanner();}
  function openAdd(){closeSheets();$('add-sheet').showModal();}
  function openFood(kind,meal=null){
    foodMeal=meal;
    closeSheets();
    if(kind==='manual'){$('manual-sheet').showModal();$('food-name').focus();return;}
    const camera=kind==='camera';
    $('camera-panel').hidden=!camera;$('finder-panel').hidden=camera;
    $('scan-title').textContent=camera?'Snap + Say':kind==='barcode'?'Scan a barcode':'Search foods';
    try{$('key-card').hidden=!camera||!!localStorage.getItem('rec-calories-ai-key');}catch{$('key-card').hidden=!camera;}$('scan').hidden=false;$('scan-sheet').showModal();
    if(!camera)$(kind==='barcode'?'barcode':'food-search').focus();
    if(kind==='barcode')$('barcode-camera').scrollIntoView({block:'nearest'});
  }
  function detail(title,nodes){closeSheets();$('detail-title').textContent=title;$('detail-content').replaceChildren(...nodes);$('detail-sheet').showModal();}
  function group(parent,title,nodes){const d=make('details','ch-list settings-group');d.append(make('summary','',title),...nodes);parent.append(d);return d;}
  function setup(actions){
    stopScanner=actions.stopScanner;refresh=actions.render;
    $('previous-day').onclick=()=>navigate(-1);$('next-day').onclick=()=>navigate(1);
    $('return-today').onclick=()=>{selectedDay=null;refresh();};
    let start;const today=$('today');
    today.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('button,input,select,textarea,a,dialog')){start=null;return;}const t=e.touches[0];start={x:t.clientX,y:t.clientY};},{passive:true});
    today.addEventListener('touchmove',e=>{if(!start)return;if(e.touches.length!==1){start=null;return;}const t=e.touches[0],dx=Math.abs(t.clientX-start.x),dy=Math.abs(t.clientY-start.y);if(!start.axis&&Math.max(dx,dy)>12)start.axis=dx>dy*1.5?'x':'y';if(start.axis==='x'&&e.cancelable)e.preventDefault();},{passive:false});
    today.addEventListener('touchend',e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y,axis=start.axis;start=null;if(axis!=='y'&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(dx<0?1:-1);},{passive:true});
    today.addEventListener('touchcancel',()=>start=null,{passive:true});
    document.querySelectorAll('.view > h1,.section-heading h1').forEach(h=>h.classList.add('ch-large__title'));
    addEventListener('scroll',()=>{document.querySelectorAll('.ch-datebar').forEach(h=>h.classList.toggle('is-scrolled',scrollY>24));},{passive:true});
    document.querySelectorAll('dialog.ch-sheet').forEach(d=>{
      const close=d.querySelector('[data-close],#cancel-scan');
      if(close){close.className='ch-sheet__close';close.setAttribute('aria-label','Close');close.innerHTML=CHADIcons.icon('xmark',22);}
      if(!d.querySelector('.ch-sheet__grip'))d.prepend(make('div','ch-sheet__grip'));
      const head=d.querySelector('.sheet-heading');
      d.querySelector('h2')?.classList.add('ch-sheet__title');
      const body=make('div','ch-sheet__body');
      if(d.id==='confirm-sheet'){const form=d.querySelector('form');body.append(...[...form.children].filter(n=>!n.matches('.ch-sheet__grip,.section-heading')));form.append(body);}
      else {body.append(...[...d.children].filter(n=>n!==head&&!n.classList.contains('ch-sheet__grip')));d.append(body);}
    });
    window.CHADIcons?.mount(document);
    const scan=$('scan');scan.classList.remove('view','ch-view');scan.hidden=false;document.querySelector('#scan-sheet .ch-sheet__body').append(scan);
    const form=$('add-form');document.querySelector('#manual-sheet .ch-sheet__body').append(form);
    $('food-name').required=true;$('food-name').placeholder='e.g. Chicken bowl';
    document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openFood(b.dataset.add));
    document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
    document.querySelectorAll('dialog.ch-sheet').forEach(d=>{
      d.addEventListener('close',stopScanner);
      d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
    });
    const settings=$('settings'),arcade=$('arcade-settings'),goals=$('settings-form');
    const appearance=group(settings,'Appearance, sound & phase dates',[arcade]);
    settings.insertBefore(appearance,goals);
    const goalGroup=group(settings,'Goals & AI key',[goals]);appearance.after(goalGroup);
    const rewards=document.querySelector('#history details');if(rewards){group(settings,'Scoring & rewards',[...rewards.children].filter(n=>n.tagName!=='SUMMARY'));rewards.remove();}
    $('settings').querySelector('h1').textContent='Settings';group(settings,'Data & backup',[Object.assign(make('div'),{id:'data-settings'})]);
    group(settings,'Logging & training',[make('p','hint','Tap a meal to log it; tap again to remove it. The info button or a long press shows ingredients, tips and swaps. Water bottles add 500 mL; tapping a full row removes 500 mL. Undo reverses your last action.'),make('p','hint','Hydration: 1 L by 10 am, 2 L by 1 pm, 3 L by 3:30 pm, 1 L at gym with Hydralyte, and 500 mL at dinner. Sunday target 3.5 L; Saturday 5 L; weekdays 4.5 L. Protein points start at 210 g; the ring uses your phase goal.'),make('p','hint','Training: stop 2 reps before failure. Add reps, then weight. Gym around 3:30 pm; cardio follows. Easy day if sleep is under 6 hours, joints hurt, or strength drops two sessions in a row. Deload halves sets, rounded up: 28 Dec-3 Jan, 8-14 Feb, 22-28 Mar, 3-9 May. Sauna or ice bath: Sunday only.'),make('p','hint','Photo and text estimates go directly to OpenAI using your own key. Estimates can miss portions or ingredients; API usage may cost money. Food lookup uses Open Food Facts; check the package label. Reset and Bulk add-ons are estimates. Shake: 500 mL high-protein milk, 60 g oats and a banana.'),make('p','hint','Weekly ranks: Rookie below 60; Grinder 60-84; Beast 85-104; Champion 105-119; AJ Mode 120+.')]);
    const weekly=Object.assign(make('div'),{id:'weekly-progress'});$('charts').before(weekly);
  }
  function render(state){
    const backup=[...$('arcade-settings').querySelectorAll('button')].find(b=>b.textContent==='Export local backup');
    if(backup){const hint=backup.nextElementSibling;$('data-settings').append(backup,hint);}
    const key=dateKey(),d=CHADQuest.daily(state,key),ring=$('quest-ring');
    const isToday=key===CHADQuest.dayKey();
    $('journey-day').textContent='Day '+journeyDay(key,state.journeyStartDate);
    $('day-title').textContent=isToday?'Today':new Date(key+'T12:00:00+09:30').toLocaleDateString('en-AU',{timeZone:'Australia/Darwin',weekday:'long'});
    $('return-today').hidden=isToday;
    ring.style.setProperty('--p',d.score/17*100);ring.setAttribute('aria-label',`${d.score} of 17 quest points, grade ${d.grade}`);
    $('quest-total').textContent=d.score;$('quest-grade').textContent=d.grade;$('quest-grade').className='ch-grade ch-grade--sm ch-grade--'+d.grade.toLowerCase();
    const goals=CHADQuest.goals(state,key);
    CHADCharts.rings($('activity-rings'),[d.totals[0]/goals.target,d.totals[1]/goals.proteinGoal,d.score/17],{labels:[$('calorie-ring').getAttribute('aria-label'),$('protein-ring').getAttribute('aria-label'),ring.getAttribute('aria-label')]});
  }
  window.CHADUX={setup,render,currentSlot,dateKey,navigate,toast,detail,closeSheets,openAdd,openFood,journeyDay,validDate,defaultJourneyStart,foodMeal:()=>foodMeal};
})();
