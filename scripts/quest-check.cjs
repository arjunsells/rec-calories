// v5 scoring, calendar and plan invariants. All measurements below are synthetic.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},Intl,Date,matchMedia:()=>({addEventListener(){}})};vm.createContext(ctx);vm.runInContext(fs.readFileSync('quest.js','utf8'),ctx);vm.runInContext(fs.readFileSync('plan-data.js','utf8'),ctx);
const q=ctx.window.CHADQuest,plan=ctx.window.CHADPlan;
const state={target:1900,proteinGoal:220,entries:[],questsV5:{}};
const complete=(key,tiers='SSSS')=>{state.questsV5[key]={picks:Object.fromEntries(['L','P','D','E'].map((id,i)=>[id,tiers[i]])),water:q.waterGoal(key),steps:true};plan.forEach((slot,i)=>{const c=slot.choices.find(c=>c.tier===tiers[i]);state.entries.push({day:key,kcal:c.macros[0],protein:c.macros[1]});});};
assert.equal(plan.length,4);assert.ok(plan.every(s=>s.choices.length===3&&s.choices.every(c=>c.items.length&&c.macros.length===4&&c.tip&&c.fix)));
complete('2026-11-24');assert.equal(q.daily(state,'2026-11-24').totals[1],219.7);assert.equal(q.daily(state,'2026-11-24').score,17);assert.equal(q.daily(state,'2026-11-24').grade,'S');
for(const [score,grade]of [[0,'C'],[8,'C'],[9,'B'],[11,'B'],[12,'A'],[14,'A'],[15,'S'],[17,'S']]){
 let found=false;for(const tiers of ['SSSS','SSSM','SSMM','SMMM','MMMM','MMMF','MMFF','MFFF','FFFF',''])for(let protein=0;protein<=1;protein++)for(let water=0;water<=1;water++)for(let steps=0;steps<=1;steps++){
  const s={entries:protein?[{day:'2026-11-24',protein:210,kcal:1}]:[],questsV5:{'2026-11-24':{picks:Object.fromEntries([...tiers].map((t,i)=>[i,t])),water:water?4.5:0,steps:!!steps}}};const d=q.daily(s,'2026-11-24');if(d.score===score){assert.equal(d.grade,grade);found=true;}}
 assert.ok(found,'grade boundary '+score);
}
assert.equal(q.stats(state,'2026-11-24').streak,1);assert.equal(q.stats(state,'2026-11-25').streak,1);assert.equal(q.stats(state,'2026-11-26').streak,0);complete('2026-11-23');assert.equal(q.stats(state,'2026-11-24').streak,2);state.questsV5['2026-11-23'].picks={};assert.equal(q.stats(state,'2026-11-24').streak,1);
for(const [date,name]of [['2026-12-06','cut'],['2026-12-07','reset'],['2026-12-13','reset'],['2026-12-14','bulk'],['2027-05-02','bulk']])assert.equal(q.phase(state,date)[0],name);
assert.equal(q.goals(state,'2026-12-07').target,2700);assert.equal(q.goals(state,'2026-12-14').target,3000);assert.equal(q.phase({...state,phaseEnds:['2026-12-01','2026-12-10','2027-05-02']},'2026-12-02')[0],'reset');assert.equal(q.goals({...state,phaseMode:'custom',customGoals:[2222,111,222,33]},'2026-12-14').target,2222);
assert.equal(q.dayKey(new Date('2026-12-06T14:29:59Z')),'2026-12-06');assert.equal(q.dayKey(new Date('2026-12-06T14:30:00Z')),'2026-12-07');assert.equal(q.shift('2027-01-01',-1),'2026-12-31');assert.equal(q.monday('2026-11-29'),'2026-11-23');
for(const [date,expected]of [['2026-12-27',false],['2026-12-28',true],['2027-01-03',true],['2027-01-04',false],['2027-02-08',true],['2027-02-14',true],['2027-03-22',true],['2027-03-28',true],['2027-05-03',true],['2027-05-09',true]])assert.equal(q.deload(date),expected);
assert.equal(q.waterGoal('2026-11-29'),3.5);assert.equal(q.waterGoal('2026-11-28'),5);assert.equal(q.waterGoal('2026-11-24'),4.5);
state.entries=[];state.questsV5={};for(let i=0;i<7;i++)complete(q.shift('2026-11-23',i));let stats=q.stats(state,'2026-11-29');assert.equal(stats.week.total,129);assert.equal(stats.week.bonus,10);assert.equal(stats.level,'AJ Mode');assert.equal(stats.maxP,7);assert.equal(stats.maxW,7);assert.equal(stats.zero,true);assert.equal(stats.streak,7);assert.equal(q.week(state,'2026-11-23','2026-11-28').bonus,0);state.questsV5['2026-11-23'].picks={L:'F',P:'F',D:'F',E:'S'};assert.equal(q.stats(state,'2026-11-29').week.bonus,0);assert.equal(q.stats(state,'2026-11-29').zero,false);
const g=q.rewards({entries:[],legacyRewards:{xp:3000,badges:['first']},questsV5:{}},'2026-11-24',{xp:0,badges:[{id:'first',unlocked:false}]});assert.equal(g.xp,3000);assert.equal(g.name,'CHAD Legend');assert.equal(g.badges[0].unlocked,true);
assert.equal(q.training[1].ex.length,5);assert.equal(q.training[2].ex.length,7);assert.equal(q.training[4].ex.length,8);assert.equal(q.training[5].ex.length,5);assert.equal(q.training[6].ex.length,9);
console.log('PASS v5: 12 sourced cards, precise macros, 17=S, all grade boundaries, B+ streak/gaps, weekly bonus/cap/levels/badges, Darwin midnight, phases/edit/custom, deload boundaries, weekday hydration, preserved legacy awards, full training plan.');
