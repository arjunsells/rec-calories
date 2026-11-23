// Synthetic data only. Run with node scripts/check.cjs from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../game.js');
const food = require('../food.js');
class Element {
  constructor() { this.value=''; this.children=[]; this.textContent=''; this.events={}; this.dataset={}; this.style={setProperty(){}}; this.classList={toggle(){},add(){},remove(){}}; }
  append(...items){this.children.push(...items)} replaceChildren(...items){this.children=items}
  setAttribute(){} removeAttribute(){} addEventListener(type,fn){this.events[type]=fn}
  closest(){return new Element()} reset(){} focus(){} scrollIntoView(){} showModal(){this.open=true} close(){this.open=false}
}
function boot(saved=null,quota=false) {
  const elements=new Map(), storage=new Map(); if(saved!==null)storage.set('rec-calories-v1',saved);
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const context={document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},scrollTo(){}},navigator:{},Intl,Date,Math,fetch:()=>{throw Error('Unexpected network')},setTimeout(){},clearTimeout(){},setInterval(){},matchMedia:()=>({matches:true}),RECGame:game,RECScan:require('../scan.js'),CHADFood:food,CHADQuest:{dayKey:()=>'2026-11-24',goals:()=>({}),render(){},rewards:(_,__,g)=>g,removeEntry:(s,e,save)=>save({...s,entries:s.entries.filter(x=>x.id!==e.id)})},
    localStorage:{getItem:key=>storage.get(key)||null,removeItem:key=>storage.delete(key),setItem:(key,value)=>{if(quota)throw Error('quota');storage.set(key,value)}}};
  vm.runInNewContext(fs.readFileSync('app.js','utf8'),context);
  return {get,storage,submit:id=>get(id).onsubmit({preventDefault(){}}),data:()=>JSON.parse(storage.get('rec-calories-v1'))};
}
let app=boot();
assert.equal(app.get('remaining').textContent,'1,900');
for(const [id,value]of [['daily-target',1900],['protein-goal',220],['carbs-goal',150],['fat-goal',45]])assert.equal(app.get(id).value,value);
assert.equal(app.get('history-bars').children.length,7);assert.equal(app.get('quests').children.length,3);
app.get('food-name').value='<img src=x onerror=alert(1)>';
app.get('calories').value='450';app.get('protein').value='30.5';app.get('carbs').value='40';app.get('fat').value='12';app.submit('add-form');
assert.equal(app.get('remaining').textContent,'1,450');assert.equal(app.data().entries.length,1);assert.equal(app.data().schemaVersion,5);
assert.equal(app.get('entries').children[0].children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
app.get('entries').children[0].children[1].onclick();assert.equal(app.data().entries.length,2);assert.equal(app.data().entries[1].source,'repeat');
app.get('entries').children[0].children[2].onclick();assert.equal(app.data().entries.length,1);
for(const [phase,expected]of [['cut',[1900,220,150,45]],['reset',[2700,200,320,70]],['bulk',[3000,200,370,80]]]){app.get('phase').value=phase;app.get('phase').onchange();app.submit('settings-form');assert.deepEqual(['target','proteinGoal','carbsGoal','fatGoal'].map(k=>app.data()[k]),expected)}
const saved=app.storage.get('rec-calories-v1');app.get('protein-goal').value='0';app.submit('settings-form');assert.equal(app.storage.get('rec-calories-v1'),saved);
const legacy={target:1800,proteinGoal:180,carbsGoal:210,fatGoal:60,custom:'preserve',entries:[{id:'legacy',day:'2020-01-01',name:'Synthetic meal',kcal:1800,protein:180,extra:'preserve'}]};
app=boot(JSON.stringify(legacy));assert.equal(app.get('daily-target').value,1800);assert.equal(app.get('protein-goal').value,180);assert.deepEqual(app.data().entries,legacy.entries);assert.equal(app.data().custom,'preserve');assert.equal(app.data().carbsGoal,210);
const minimal={target:1750,entries:legacy.entries};app=boot(JSON.stringify(minimal));assert.equal(app.data().target,1750);assert.equal(app.data().proteinGoal,220);assert.deepEqual(app.data().entries,minimal.entries);
app=boot(JSON.stringify(legacy),true);const beforeQuota=app.storage.get('rec-calories-v1');app.get('calories').value='200';app.submit('add-form');assert.equal(app.storage.get('rec-calories-v1'),beforeQuota);assert.match(app.get('message').textContent,/Could not save/);
for(const unreadable of ['{broken',JSON.stringify({target:1800,entries:[null]})]){app=boot(unreadable);app.get('calories').value='200';app.submit('add-form');assert.equal(app.storage.get('rec-calories-v1'),unreadable);assert.match(app.get('message').textContent,/protect/)}
app=boot(null,true);app.get('calories').value='200';app.submit('add-form');assert.equal(app.storage.has('rec-calories-v1'),false);assert.match(app.get('message').textContent,/Could not save/);
console.log('PASS: defaults, manual/repeat/delete logs, safe text, phase presets, migration and unknown fields, unreadable data protection, failed storage.');
const meal=(day,kcal=1900,protein=220,extra={})=>({day,kcal,protein,...extra});
const derive=(entries,today='2026-11-24',overrides={})=>game.derive({target:1900,proteinGoal:220,entries,...overrides},today);
for(const [kcal,protein,expected]of [[1710,220,'S'],[2090,219,'A'],[2280,220,'B'],[2281,220,'C'],[100,220,'C'],[0,0,'—']])assert.equal(game.grade(kcal,protein,1900,220),expected);
let g=derive([meal('2026-11-24')]);assert.equal(g.xp,40);assert.equal(g.questXP,30);assert.equal(g.streak,1);assert.equal(g.badges.find(b=>b.id==='balanced').unlocked,false);
assert.equal(derive([meal('2026-11-23')]).xp,115);assert.equal(derive([meal('2026-11-23',1900,0)]).xp,60);assert.equal(derive([meal('2026-11-23',200,220)]).xp,40);assert.equal(derive([meal('2026-11-25')]).xp,0);
const questMeals=['Breakfast','Lunch','Dinner'].map((m,i)=>meal('2026-11-24',600,i===0?220:0,{meal:m,source:i===0?'barcode':'manual'}));
g=derive(questMeals);assert.equal(g.questXP,80);assert.equal(g.xp,110);assert.ok(g.quests.every(q=>q.complete));assert.deepEqual(derive(questMeals),g);
assert.equal(derive(questMeals.slice(1)).questXP,0);assert.equal(derive([meal('2026-11-24',100,0,{meal:'Lunch',source:'search'})]).quests.find(q=>q.id==='scan').complete,false);
assert.equal(derive([meal('2026-11-24',100,0,{source:'photo'})]).questXP,20);
assert.equal(derive(Array.from({length:3},()=>meal('2026-11-24',1,0,{meal:'Lunch'}))).quests.find(q=>q.id==='meals').progress,1);
for(const count of [3,7,30]){let cursor='2026-11-24';const entries=[];for(let i=0;i<count;i++){entries.push(meal(cursor));cursor=game.previousDay(cursor)}g=derive(entries);assert.equal(g.streak,count);assert.equal(g.longest,count);assert.equal(g.badges.find(b=>b.id===`streak${count}`).unlocked,true)}
assert.equal(derive([meal('2026-11-22')]).streak,0);assert.equal(derive([meal('2026-11-21'),meal('2026-11-23'),meal('2026-11-24')]).longest,2);
assert.equal(game.previousDay('2024-03-01'),'2024-02-29');assert.equal(game.previousDay('2026-01-01'),'2025-12-31');assert.equal(derive(Array.from({length:250},()=>meal('2026-11-24',1,0))).name,'CHAD Legend');
console.log('PASS: XP and daily quest rewards, deduplication, deletion recalculation, grade boundaries, badges, streaks 3/7/30, gaps, leap days, levels.');
const product={code:'12345678',product_name:'Synthetic cereal',serving_size:'40 g',nutriments:{'energy-kcal_100g':400,proteins_100g:10,carbohydrates_100g:50,fat_100g:8}};
const normalized=food.normalize(product);assert.equal(normalized.kcal,160);assert.equal(normalized.protein,4);assert.equal(normalized.basis,'serving');
const fallback=food.normalize({...product,serving_size:undefined});assert.equal(fallback.kcal,400);assert.equal(fallback.basis,'100g');
const serving=food.normalize({...product,nutriments:{'energy-kcal_serving':123,proteins_serving:5,carbohydrates_serving:20,fat_serving:2}});assert.equal(serving.kcal,123);
assert.equal(food.normalize({...product,nutriments:{'energy-kcal_100g':400}}),null);assert.equal(food.normalize(null),null);
assert.equal(food.normalize({...product,nutriments:{energy_100g:1673.6,proteins_100g:10,carbohydrates_100g:50,fat_100g:8}}).kcal,160);
assert.deepEqual(['kcal','protein','carbs','fat'].map(k=>food.scale(normalized,1.5)[k]),[240,6,30,4.8]);for(const m of [0,-1,NaN,101])assert.throws(()=>food.scale(normalized,m),/portion/);
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8'),css=fs.readFileSync('style.css','utf8')+fs.readFileSync('theme.css','utf8');
assert.match(html,/<title>CHAD/);assert.match(html,/apple-mobile-web-app-title[^>]+CHAD/);assert.match(sw,/rec-calories-shell-v6-ux/);
for(const file of ['ux.js','theme.css','sprites.js','charts.js','app.js','game.js','plan-data.js','quest.js','fonts/press-start-2p.ttf','fonts/OFL.txt','scan.js','food.js','vendor/zxing-browser.min.js','style.css','manifest.webmanifest','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png']){assert.ok(fs.existsSync(file),`${file} exists`);assert.ok(sw.includes(`./${file}`),`${file} cached`)}
assert.ok(html.indexOf('./game.js')<html.indexOf('./app.js'));assert.ok(html.indexOf('./food.js')<html.indexOf('./app.js'));assert.match(css,/prefers-reduced-motion/);assert.match(css,/prefers-color-scheme:\s*dark/);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));assert.equal(manifest.name,'CHAD');assert.equal(manifest.short_name,'CHAD');for(const k of ['id','start_url','scope'])assert.equal(manifest[k],'./');assert.equal(manifest.display,'standalone');
for(const [file,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){const png=fs.readFileSync(`icons/${file}`);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size)}
console.log('PASS: OFF serving/100g normalization, kJ conversion, scaling, CHAD manifest identity, PNG dimensions, shell-v6-ux complete assets and motion/dark CSS guards.');
(async()=>{let urls=[];const response=products=>({ok:true,json:async()=>({products})});
let results=await food.search('cereal',async url=>{urls.push(url);return response(urls.length===1?[]:[product])});assert.equal(results.length,1);assert.equal(results[0].source,'search');assert.equal(urls.length,2);assert.match(urls[0],/api\/v2\/search/);assert.match(urls[1],/cgi\/search.pl/);
urls=[];results=await food.search('cereal',async url=>{urls.push(url);return response([product])});assert.equal(urls.length,1);assert.equal(results.length,1);
assert.equal((await food.lookup('12345678',async()=>({ok:true,json:async()=>({status:1,product})}))).kcal,160);
await assert.rejects(food.lookup('12345678',async()=>({ok:true,json:async()=>({status:0})})),/not found/);await assert.rejects(food.lookup('12345678',async()=>({ok:false})),/busy/);await assert.rejects(food.lookup('x',()=>{throw Error('Must not fetch')}),/digits/);await assert.rejects(food.search('a',()=>{throw Error('Must not fetch')}),/two letters/);
console.log('PASS: mocked OFF v2/CGI fallback, barcode lookup, missing product and invalid query handling.');})().catch(e=>{console.error(e);process.exitCode=1});
