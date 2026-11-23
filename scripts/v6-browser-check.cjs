// Synthetic v5 fixture only, held in an isolated browser context, never the user's browser.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const root=path.resolve(__dirname,'..');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(e?'missing':data);});});
(async()=>{
 await new Promise(r=>server.listen(8090,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'America/New_York',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-24T12:00:00+09:30')});
  await page.goto('http://127.0.0.1:8090/');
  const fixture={schemaVersion:5,target:1900,proteinGoal:220,carbsGoal:150,fatGoal:45,customExtension:{keep:true},legacyRewards:{xp:0,badges:[]},entries:[{id:'synthetic-history',day:'2026-11-23',name:'Synthetic historic meal',kcal:400,protein:30,extra:'keep'}],questsV5:{'2026-11-23':{picks:{L:'M'},water:.5,extension:'keep'}}};
  await page.evaluate(data=>{localStorage.setItem('rec-calories-v1',JSON.stringify(data));localStorage.setItem('unrelated-fixture','preserve');},fixture);await page.reload();
  assert.equal(await page.locator('.ch-metric').count(),3);
  assert.equal(await page.locator('.today-meals').getAttribute('open'),null);
  assert.equal(await page.locator('#next-up [data-slot=L][data-tier=S]').isVisible(),true);
  assert.equal(await page.locator('#next-up [data-choose-tier=S]').getAttribute('aria-pressed'),'true');
  for(const id of ['calorie-ring','protein-ring','quest-ring']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.y>=0&&box.y+box.height<844);}
  const initialShots=path.join(os.tmpdir(),'chad-v6-qa');fs.mkdirSync(initialShots,{recursive:true});await page.screenshot({path:path.join(initialShots,'today-next-meal.png')});
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));
  await page.locator('#next-up [data-slot=L][data-tier=S]').click();
  assert.equal((await save()).entries.length,2);assert.equal(await page.locator('#next-up .water-add').isVisible(),true);
  await page.locator('.water-add').click();assert.equal((await save()).questsV5['2026-11-24'].water,.5);
  await page.locator('.water-add').click();assert.equal((await save()).questsV5['2026-11-24'].water,1);
  await page.locator('.water-adjust summary').click();await page.locator('.water-undo').click();assert.equal((await save()).questsV5['2026-11-24'].water,.5);
  await page.locator('.today-meals summary').click();await page.locator('.meal-slot .text-button').first().click();assert.equal(await page.locator('#detail-sheet').isVisible(),true);assert.ok((await page.locator('#detail-content li').count())>0);await page.keyboard.press('Escape');
  await page.locator('#today-scan').click();assert.deepEqual(await page.locator('[data-add]').evaluateAll(bs=>bs.map(b=>b.dataset.add)),['camera','barcode','search','manual']);
  for(const b of await page.locator('[data-add]').all()){const box=await b.boundingBox();assert.ok(box.width>=44&&box.height>=44);}
  await page.locator('[data-add=manual]').click();assert.equal(await page.locator('#manual-sheet').isVisible(),true);await page.locator('#food-name').fill('Synthetic quick meal');await page.locator('#calories').fill('123');await page.locator('#add-form button').click();assert.equal((await save()).entries.at(-1).kcal,123);
  const got=await save();assert.deepEqual(got.entries[0],fixture.entries[0]);assert.deepEqual(got.questsV5['2026-11-23'],fixture.questsV5['2026-11-23']);assert.deepEqual(got.customExtension,fixture.customExtension);assert.equal(got.schemaVersion,5);
  // Other-tab journal writes refresh without rebuilding/moving the static forms a second time.
  await page.evaluate(()=>{const data=localStorage.getItem('rec-calories-v1');dispatchEvent(new StorageEvent('storage',{key:'rec-calories-v1',newValue:data}));});assert.equal(await page.locator('#add-form').count(),1);
  for(const [time,slot] of [['15:00:00','P'],['19:00:00','D'],['22:00:00','E']]){await page.clock.setFixedTime(new Date('2026-11-24T'+time+'+09:30'));await page.reload();assert.equal(await page.locator(`#next-up [data-slot=${slot}][data-tier=S]`).isVisible(),true);}
  await page.locator('#today-scan').click();await page.locator('[data-add=camera]').click();await page.locator('#scan-settings').click();assert.equal(await page.locator('#ai-key').isVisible(),true);
  await page.locator('[data-view=training]').click();for(let i=0;i<2;i++){await page.locator('.is-today .exercise > .text-button').first().click();assert.equal(await page.locator('#detail-sheet form').count(),1);await page.keyboard.press('Escape');}
  // Friendly failure and manual entry remain available after all public endpoints fail.
  let requests=[];await page.route('https://*.openfoodfacts.org/**',route=>{requests.push(route.request().url());return route.abort('failed');});
  await page.locator('#today-scan').click();await page.locator('[data-add=search]').click();await page.locator('#food-search').fill('yopro');await page.locator('#search-form button').click();await page.waitForFunction(()=>document.getElementById('scan-status').textContent.includes('unavailable right now'));
  assert.equal(requests.length,4);assert.ok(requests[2].startsWith('https://au.'));await page.locator('#scan-manual').click();assert.equal(await page.locator('#manual-sheet').isVisible(),true);await page.keyboard.press('Escape');
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+09:30'));await page.reload();
  await page.evaluate(()=>scrollTo(0,0));
  for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const shots=path.join(os.tmpdir(),'chad-v6-qa');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'today-'+theme+'.png')});}
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();assert.equal(await page.locator('#today-scan').isVisible(),true);assert.equal(await page.evaluate(()=>typeof CHADUX.openAdd),'function');assert.deepEqual(errors,[]);
  console.log('PASS v6 Edge 390x844: three rings, Darwin slots with New York device timezone, Strict default, one-tap plan and bottle/undo, collapsed meals, detail sheets, four Add actions/44px targets, name+kcal quick add, v5/unknown data preserved, cross-tab refresh, key-settings focus, four OFF fallbacks + manual recovery, light/dark/reduced-motion/no overflow, offline ux.js. Screenshots: '+path.join(os.tmpdir(),'chad-v6-qa'));
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
