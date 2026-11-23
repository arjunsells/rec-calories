'use strict';
// v6 structure only. Journal keys, scoring and plan nutrition stay in the v5 modules.
(() => {
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => { const n=document.createElement(tag);n.className=className||'';if(text!==undefined)n.textContent=text;return n; };
  const tiers = {S:'Strict',M:'Medium',F:'Free'};
  const selectedTiers = {};
  let mealsOpen=false, waterOpen=false, weighOpen=false, stopScanner=()=>{};
  function currentSlot(date=new Date()) {
    const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Darwin',hour:'numeric',hourCycle:'h23'}).format(date));
    return hour<14?'L':hour<18?'P':hour<21?'D':'E';
  }
  function closeSheets(){document.querySelectorAll('dialog.ch-sheet[open]').forEach(d=>d.close());stopScanner();}
  function openAdd(){closeSheets();$('add-sheet').showModal();}
  function openFood(kind){
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
  function group(parent,title,nodes){const d=make('details','card settings-group');d.append(make('summary','',title),...nodes);parent.append(d);return d;}
  function setup(actions){
    stopScanner=actions.stopScanner;
    const scan=$('scan');scan.classList.remove('view','ch-view');scan.hidden=false;$('scan-sheet').append(scan);
    const form=$('add-form'),old=form.closest('details');$('manual-sheet').append(form);old.remove();
    $('food-name').required=true;$('food-name').placeholder='e.g. Chicken bowl';
    const macros=make('details');macros.append(make('summary','','More nutrition (optional)'));
    // Keep protein, carbohydrate, fat and meal controls available with the same IDs.
    const protein=$('protein').parentElement;const calories=$('calories').parentElement;
    const oldRow=calories.parentElement;oldRow.before(calories);protein.remove();oldRow.remove();
    macros.append(protein,$('carbs').closest('.input-row'));
    const mealLabel=document.querySelector('label[for="meal"]');macros.append(mealLabel,$('meal'));
    form.insertBefore(macros,form.querySelector('button'));
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
    const weekly=Object.assign(make('div'),{id:'weekly-progress'});$('charts').before(weekly);
    const journal=$('entries').closest('.below-fold');
    const journalDetails=make('details','journal-section');journalDetails.append(make('summary','','Food journal'),...journal.children);journal.replaceChildren(journalDetails);
  }
  function render(state){
    const backup=[...$('arcade-settings').querySelectorAll('button')].find(b=>b.textContent==='Export local backup');if(backup){const hint=backup.nextElementSibling;$('data-settings').append(backup,hint);}
    const key=CHADQuest.dayKey(),d=CHADQuest.daily(state,key),checklist=$('daily-checklist');
    const ring=$('quest-ring');if(ring){ring.style.setProperty('--p',d.score/17*100);ring.setAttribute('aria-label',`${d.score} of 17 quest points, grade ${d.grade}`);$('quest-total').textContent=d.score;$('quest-grade').textContent='Grade '+d.grade;}
    const blocks=[...checklist.querySelectorAll('.meal-slot')];
    const next=make('section','next-up');next.id='next-up';next.setAttribute('aria-labelledby','next-title');next.append(Object.assign(make('h2','','Next up'),{id:'next-title'}));
    const meals=make('details','card today-meals');meals.open=mealsOpen;meals.append(make('summary',"",`Today's meals · ${Object.keys(d.picks).length} / 4 logged`));meals.ontoggle=()=>mealsOpen=meals.open;
    blocks.forEach((block,i)=>{
      const slot=CHADPlan[i],cards=[...block.querySelectorAll('.meal-pick')];
      let tier=selectedTiers[slot.id]||d.picks[slot.id]||'S';
      const control=make('div','tier-control');control.setAttribute('role','group');control.setAttribute('aria-label',slot.name+' meal tier');
      const sync=()=>{cards.forEach(card=>card.hidden=card.dataset.tier!==tier);control.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.chooseTier===tier));};
      Object.entries(tiers).forEach(([id,label])=>{const b=make('button','tier-segment',label);b.type='button';b.dataset.chooseTier=id;b.onclick=()=>{tier=id;selectedTiers[slot.id]=id;sync();};control.append(b);});
      cards.forEach(card=>{
        const chosen=d.picks[slot.id]===card.dataset.tier;
        card.setAttribute('aria-label',`${chosen?'Undo':'Log'} ${tiers[card.dataset.tier]} ${slot.name}: ${slot.choices.find(c=>c.tier===card.dataset.tier).title}`);
        card.append(make('span','meal-log-label',chosen?'Logged · tap to undo':'Log '+tiers[card.dataset.tier]+' meal'));
      });
      block.querySelector('.meal-options').before(control);sync();
      const more=make('button','text-button','Meal details & tips');more.type='button';more.onclick=()=>{
        const c=slot.choices.find(c=>c.tier===tier),list=make('ul','meal-items');c.items.forEach(item=>list.append(make('li','',item)));
        detail(c.title,[make('p','',tiers[tier]+' · '+c.macros[0]+' kcal'),list,make('p','',c.tip),make('p','hint',c.fix)]);
      };block.append(more);
      if(slot.id===currentSlot()&&!d.picks[slot.id])next.append(block);else meals.append(block);
    });
    // Water is a repeatable one-tap bottle; the original absolute-volume controls remain as a stepper.
    const water=checklist.querySelector('.water-card'),bottles=water.querySelector('.bottles');
    const adjust=make('details','water-adjust');adjust.open=waterOpen;adjust.append(make('summary','','Adjust water'),water.querySelector('.hint'),bottles);adjust.ontoggle=()=>waterOpen=adjust.open;
    const add=make('button','primary ch-btn ch-btn--primary ch-btn--block water-add','+ Add a bottle · 500 mL');add.type='button';
    const setWater=value=>{const amount=Math.max(0,Math.min(30,Math.round(value*10)/10));
      if(window.CHADUX.save({...state,questsV5:{...state.questsV5,[key]:{...state.questsV5?.[key],water:amount}}})&&amount>(d.water||0))window.CHADUX.popXP();};
    add.onclick=()=>setWater((d.water||0)+.5);
    const undo=make('button','secondary ch-btn water-undo','− Undo 500 mL');undo.type='button';undo.disabled=!(d.water>0);undo.onclick=()=>setWater((d.water||0)-.5);adjust.querySelector('summary').after(undo);water.append(add,adjust);
    const checks=checklist.querySelector('.checks');
    const weigh=$('local-weight').closest('details');weigh.open=weighOpen;weigh.ontoggle=()=>weighOpen=weigh.open;
    if(next.children.length===1){
      const pending=!d.waterHit?water:[...checks.querySelectorAll('button.check-card')].find(b=>b.getAttribute('aria-pressed')==='false');
      if(pending)next.append(pending);else if(!d.weight)next.append(weigh);else next.append(make('p','hint','All set. Your current meal and daily quests are logged.'));
    }
    const heading=checklist.querySelector('.section-heading');heading?.remove();checklist.querySelector(':scope > p.hint')?.remove();
    checklist.querySelector('.quest-section-title').textContent='Daily quests';
    checklist.prepend(next);checklist.append(meals);$('weekly-progress').replaceChildren(checklist.querySelector('.week-summary'));
    // Top-set forms use the existing validation and PR logic, displayed in a bottom sheet.
    document.querySelectorAll('.top-set').forEach(log=>{
      const b=make('button','text-button','Exercise details / log top set');b.type='button';
      const form=log.querySelector('form');form.addEventListener('submit',()=>closeSheets());
      b.onclick=()=>detail(log.closest('.exercise').querySelector('.exercise-toggle').textContent,[form]);
      log.before(b);log.hidden=true;
    });
  }
  window.CHADUX={setup,render,currentSlot,closeSheets,openAdd,openFood};
})();
