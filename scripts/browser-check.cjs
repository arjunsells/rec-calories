const { chromium } = require('../.qa/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = process.cwd();
fs.mkdirSync(path.join(root, '.qa/tmp'), {recursive:true});
process.env.TEMP = process.env.TMP = path.join(root, '.qa/tmp');
const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png'};
const server = http.createServer((req,res)=>{
 const file=path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
 fs.readFile(file,(err,data)=>{res.writeHead(err ? 404 : 200, {'Content-Type':types[path.extname(file)] || 'text/plain'});res.end(err?'missing':data);});
});
(async()=>{
 await new Promise(r=>server.listen(8087,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(localStorage.getItem('rec-calories-v1'))return;
  const d=new Date();d.setDate(d.getDate()-1);const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  localStorage.setItem('rec-calories-v1',JSON.stringify({target:1800,entries:[{id:'synthetic',name:'Synthetic test',day,kcal:1800,protein:180}]}));
 });
 await page.goto('http://127.0.0.1:8087/');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();
 assert.equal(await page.locator('#xp-total').textContent(),'85 XP');
 await page.locator('#calories').fill('1800');await page.locator('#protein').fill('180');await page.locator('#add-form button').click();
 assert.equal(await page.locator('#daily-grade').textContent(),'S');
 await page.locator('#quick-items button').first().click();
 assert.equal(await page.locator('#xp-total').textContent(),'105 XP');
 assert.match(await page.locator('#celebration').innerText(), /Level up/);
 assert.equal(await page.locator('#level-name').textContent(),'Listing Scout');
 await page.locator('.delete').first().click();
 assert.equal(await page.locator('#xp-total').textContent(),'95 XP');
 await page.locator('[data-view=history]').click(); await page.locator('.game-card').scrollIntoViewIfNeeded();
 await page.screenshot({path:'.qa/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
 await page.locator('[data-view="settings"]').click();
 await page.locator('#protein-goal').fill('200');await page.locator('#settings-form button').click();
 await page.reload();assert.equal(await page.locator('#protein-goal').inputValue(),'200');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')).entries.length),2);

 await page.locator('[data-view=scan]').click();
 await page.locator('#camera-button').click();
 assert.match(await page.locator('#scan-status').innerText(), /AI key in Settings/);
 await page.locator('#scan-settings').click();
 await page.locator('#ai-key').fill('synthetic-test-token');
 await page.locator('#settings-form button').click();
 assert.equal(await page.locator('#ai-key').getAttribute('type'), 'password');
 const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; c.getContext('2d').fillRect(0,0,1800,1200); return c.toDataURL('image/png').split(',')[1]; });
 const upload = async () => page.locator('#photo-input').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 let mode = 'success', calls = 0;
 await page.route('https://api.openai.com/**', async route => {
  calls++; const body=route.request().postDataJSON();
  assert.equal(route.request().headers().authorization,'Bearer synthetic-test-token');
  const dimensions=await page.evaluate(async src => {const i=new Image();i.src=src;await i.decode();return [i.width,i.height]},body.messages[1].content[1].image_url.url);
  assert.deepEqual(dimensions,[1024,683]);
  if(mode==='offline')return route.abort('internetdisconnected');
  if(mode==='401')return route.fulfill({status:401,body:'{}'});
  if(mode==='bad')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'not json'}}]})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({items:[{name:'Synthetic meal',portion:'200 g',kcal:400,protein:20,carbs:40,fat:12}],total:400})}}]})});
 });
 await page.locator('[data-view=scan]').click(); await upload();
 await page.locator('#confirm-sheet').waitFor({state:'visible'});
 await page.locator('#scan-0-name').fill('Edited synthetic meal');await page.locator('#scan-0-portion').fill('220 g');await page.locator('#scan-0-kcal').fill('450');
 await page.locator('#scan-meal').selectOption('Lunch');await page.locator('#scan-confirm-form button[type=submit]').click();
 assert.equal(await page.locator('#consumed').innerText(),'2,250');
 const logged=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')).entries.at(-1));
 assert.equal(logged.name,'Edited synthetic meal');assert.equal(logged.kcal,450);assert.equal(logged.meal,'Lunch');assert.equal(logged.carbs,40);assert.equal(logged.portion,'220 g');
 const thumbSize=await page.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();return Math.max(i.width,i.height)},logged.thumbnail);assert.equal(thumbSize,96);
 for(const [m,pattern] of [['401',/key was rejected/],['bad',/Could not read/],['offline',/internet connection/]]){
  mode=m;await page.locator('[data-view=scan]').click();await upload();await page.waitForFunction(()=>!document.getElementById('camera-button').disabled);
  assert.match(await page.locator('#scan-status').innerText(),pattern);assert.equal(await page.locator('#confirm-sheet').isVisible(),false);
  await page.locator('#scan-manual').click();assert.equal(await page.locator('#add-form').isVisible(),true);
 }
 assert.equal(calls,4);
 // Thumbnail expiration on boot retains entries and XP.
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('rec-calories-v1'));s.entries.push({id:'old-photo',day:'2000-01-01',name:'Synthetic old',kcal:20,protein:0,thumbnail:s.entries.at(-1).thumbnail});localStorage.setItem('rec-calories-v1',JSON.stringify(s));});
 await page.reload();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')).entries.find(e=>e.id==='old-photo').thumbnail),undefined);
 await page.locator('[data-view=today]').click(); await page.emulateMedia({reducedMotion:'reduce'}); await page.screenshot({path:'.qa/mobile-v3.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
 await context.setOffline(true);await page.reload();
 assert.match(await page.locator('#level-name').textContent(), /Open Home Rookie/);
 assert.equal(await page.locator('#xp-total').textContent(),'90 XP');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('#celebration').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('#celebration').evaluate(e=>getComputedStyle(e,'::before').animationName),'none');
 assert.deepEqual(errors,[]);
 console.log('PASS: photo compression 1024px, editable scan confirm/log with macros and 96px thumbnail, mock success/401/bad JSON/offline, manual fallback, thumbnail expiry, key masking;  mobile browser, legacy migration, one-tap repeat, XP/grade/level celebration, delete, editable protein persistence, no overflow, service-worker offline reload, reduced-motion, zero JS errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
