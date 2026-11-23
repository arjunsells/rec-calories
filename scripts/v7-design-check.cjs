const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),shots=path.join(os.tmpdir(),'chad-v7-qa');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(e?'missing':data);});});
(async()=>{
 await new Promise(r=>server.listen(8091,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 fs.mkdirSync(shots,{recursive:true});
 for(const [width,height] of [[393,852],[375,667]])for(const theme of ['light','dark'])for(const safe of [false,true]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:new Date('2026-11-24T12:00:00+09:30')});await page.goto('http://127.0.0.1:8091/');
  if(safe)await page.addStyleTag({content:':root{--ch-sat:47px;--ch-sab:34px;--ch-sal:6px;--ch-sar:6px}'});
  const name=width+'x'+height+' '+theme+(safe?' safe':'');
  const check=async label=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' '+label+' overflow');
   const bad=await page.evaluate(()=>[...document.querySelectorAll('button,a,summary,input:not([type=hidden]),select,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&(r.width<43.99||r.height<43.99);}).map(e=>({text:(e.textContent||e.id).trim().slice(0,40),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
   assert.deepEqual(bad,[],name+' '+label+' 44px targets');
  };
  assert.equal(await page.evaluate(()=>devicePixelRatio),3);
  assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
  for(const view of ['today','training','history','settings']){
   await page.locator(`[data-view=${view}]`).tap();await check(view);
   if(view==='settings'){await page.evaluate(()=>document.querySelectorAll('#settings details').forEach(d=>d.open=true));await check('settings open');}
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
   assert.equal(await page.evaluate(()=>document.querySelector('.view:not([hidden])').getBoundingClientRect().bottom<document.querySelector('#today-scan').getBoundingClientRect().top),true,name+' '+view+' last row clears FAB');
  }
  await page.locator('[data-view=today]').tap();
  const headerTop=await page.locator('.ch-header').evaluate(e=>e.getBoundingClientRect().height);assert.ok(headerTop>=(safe?91:44));
  assert.equal(await page.locator('#today details,#training details').count(),0);
  await page.screenshot({path:path.join(shots,name.replaceAll(' ','-')+'.png')});
  await page.evaluate(()=>{window.qaTaps=0;document.addEventListener('click',()=>window.qaTaps++,true);});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));
  for(const [selector,verify] of [['[data-slot=L][data-tier=S]',s=>s.questsV5['2026-11-24'].picks.L==='S'],['[data-water]',s=>s.questsV5['2026-11-24'].water===.5],['[data-quest=steps]',s=>s.questsV5['2026-11-24'].steps===true]]){
   await page.evaluate(()=>window.qaTaps=0);const b=page.locator(selector).first();await b.scrollIntoViewIfNeeded();await b.tap();assert.equal(await page.evaluate(()=>window.qaTaps),1,name+' one tap '+selector);assert.ok(verify(await saved()));
  }
  await page.locator('[data-view=training]').tap();await page.evaluate(()=>window.qaTaps=0);const exercise=page.locator('.is-today .exercise-toggle').first();await exercise.scrollIntoViewIfNeeded();await exercise.tap();assert.equal(await page.evaluate(()=>window.qaTaps),1,name+' one tap exercise');assert.equal((await saved()).questsV5['2026-11-24'].exercises[0],true);
  await page.locator('#today-scan').tap();await check('add');
  for(const kind of ['manual','camera','barcode','search']){await page.locator(`[data-add=${kind}]`).tap();await check(kind+' sheet');await page.keyboard.press('Escape');await page.locator('#today-scan').tap();}await page.keyboard.press('Escape');
  await page.locator('[data-view=today]').tap();await page.locator('.meal-info').first().tap();await check('meal detail');await page.keyboard.press('Escape');
  await page.locator('[data-view=training]').tap();await page.locator('.is-today .exercise-info').first().tap();await check('top set');await page.keyboard.press('Escape');
  assert.deepEqual(errors,[],name+' errors');await context.close();console.log('PASS '+name+': all screens/sheets, >=44px targets, no overflow, safe-area/FAB clearance, 4 actions each=1 tap, no JS/console errors');
 }
 console.log('Screenshots outside repo: '+shots);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
