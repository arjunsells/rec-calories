// Browser integration QA. Install Playwright outside the repository:
// npm install --prefix "$env:TEMP/chad-browser-qa" playwright
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),shots=process.env.CHAD_SHOTS||path.resolve(root,'../rec-calories-shots');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(err?'missing':data);});});
(async()=>{
 await new Promise(r=>server.listen(8087,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,isMobile:true,hasTouch:true,colorScheme:'light'}),page=await context.newPage();
 // Deterministic by default; set CHAD_LIVE_FOOD=1 to exercise live OFF.
 if(!process.env.CHAD_LIVE_FOOD) await page.route('https://world.openfoodfacts.org/**',route=>{const product={code:'9300652010794',product_name:'Weet-Bix synthetic QA',serving_size:'40 g',nutriments:{'energy-kcal_100g':400,proteins_100g:10,carbohydrates_100g:60,fat_100g:3}};return route.fulfill({json:route.request().url().includes('/product/')?{status:1,product}:{products:[product]}});});
 const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.clock.install({time:new Date('2026-11-24T12:00:00+09:30')});await page.goto('http://127.0.0.1:8087/');await page.waitForFunction(()=>document.getElementById('remaining').textContent==='1,900');
 assert.equal(await page.title(),'CHAD');assert.equal(await page.locator('#protein-goal').inputValue(),'220');assert.equal(await page.locator('#carbs-goal').inputValue(),'150');assert.equal(await page.locator('#fat-goal').inputValue(),'45');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#today-scan').click();await page.locator('#camera-button').click();assert.equal(await page.locator('#key-card').isVisible(),true);assert.match(await page.locator('#key-card').innerText(),/Paste your OpenAI key in Settings/);
 // Live OFF requests, neither intercepted nor supplied by a fixture.
 await page.locator('#barcode').fill('9300652010794');await page.locator('#barcode-form button').click();await page.locator('#food-results button').first().waitFor({timeout:45000});
 const realProduct=await page.locator('#food-results button').first().innerText();assert.match(realProduct,/Weet/i);await page.locator('#food-results button').first().click();
 await page.locator('#confirm-sheet').waitFor({state:'visible'});const kcal=parseFloat((await page.locator('#scan-total').innerText()).replaceAll(',',''));
 await page.locator('#portion-slider').fill('1.5');assert.equal(parseFloat((await page.locator('#scan-total').innerText()).replaceAll(',','')),Math.round(kcal*1.5));
 await page.locator('#scan-confirm-form button[type=submit]').click();assert.equal(await page.locator('#confirm-sheet').isVisible(),false);
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));assert.equal(saved.entries.at(-1).source,'barcode');assert.equal(saved.entries.at(-1).kcal,Math.round(kcal*1.5));
 await page.evaluate(()=>document.getElementById('today-scan').click());await page.locator('#food-search').fill('weet-bix');await page.locator('#search-form button').click();await page.locator('#food-results button').first().waitFor({timeout:45000}).catch(async e=>{throw Error(e.message+'; status='+await page.locator('#scan-status').textContent()+'; errors='+errors.join('|'))});assert.match(await page.locator('#food-results').innerText(),/Weet/i);
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS OFF search and lookup (live only when CHAD_LIVE_FOOD=1)');
 // One-tap repeats use the existing journal, retain today's data and do not reuse scan quest source.
 await page.locator('[data-view=today]').click();await page.locator('#entries .repeat').first().click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));assert.equal(saved.entries.length,2);assert.equal(saved.entries.at(-1).source,'repeat');
 await page.evaluate(()=>document.getElementById('today-scan').click());await page.locator('#scan-manual').click();await page.locator('#food-name').fill('Synthetic manual bowl');await page.locator('#calories').fill('200');await page.locator('#protein').fill('10');await page.locator('#carbs').fill('25');await page.locator('#fat').fill('5');await page.locator('#add-form button').click();assert.equal(await page.locator('#entries .entry').count(),3);
 // All AI network calls are mocked using a synthetic credential, never an actual user key.
 await page.locator('[data-view=settings]').click();await page.locator('#ai-key').fill('synthetic-test-token');await page.locator('#settings-form button').click();assert.equal(await page.locator('#ai-key').getAttribute('type'),'password');
 let mode='success',calls=0;
 await page.route('https://api.openai.com/**',async route=>{calls++;assert.equal(route.request().headers().authorization,'Bearer synthetic-test-token');const body=route.request().postDataJSON();assert.equal(body.store,false);if(mode==='401')return route.fulfill({status:401,body:'{}'});if(mode==='bad')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'broken json'}}]})});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({items:[{name:'Synthetic AI meal',portion:'200 g',kcal:400,protein:30,carbs:40,fat:12}],total:9999})}}]})});});
 await page.evaluate(()=>document.getElementById('today-scan').click());const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1800;c.height=1200;return c.toDataURL('image/png').split(',')[1];});
 const upload=()=>page.locator('#photo-input').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await upload();await page.locator('#confirm-sheet').waitFor({state:'visible'});assert.equal(await page.locator('#scan-total').innerText(),'400 kcal');await page.locator('#portion-slider').fill('2');assert.match(await page.locator('#result-macros').innerText(),/Protein 60 g/);await page.locator('#scan-confirm-form button[type=submit]').click();
 for(const [next,pattern] of [['401',/key was rejected/],['bad',/Could not read/]]){mode=next;await page.evaluate(()=>document.getElementById('today-scan').click());await upload();await page.waitForFunction(()=>!document.getElementById('camera-button').disabled);assert.match(await page.locator('#scan-status').innerText(),pattern);assert.equal(await page.locator('#confirm-sheet').isVisible(),false);}
 assert.equal(calls,3);
 // HTTP 401 deliberately causes a browser console network-error line; application errors remain forbidden.
 assert.deepEqual(errors,[]);assert.ok(consoleErrors.every(e=>/401/.test(e)),consoleErrors.join('\n'));
 // Legacy custom goals and all entry extension fields survive schema migration.
 await page.evaluate(()=>{localStorage.removeItem('rec-calories-ai-key');localStorage.setItem('rec-calories-v1',JSON.stringify({target:2100,proteinGoal:175,carbsGoal:180,fatGoal:65,entries:[{id:'legacy-synthetic',day:'2020-01-01',name:'Legacy synthetic meal',kcal:400,protein:20,extra:'preserve'}]}));});
 await page.reload();assert.equal(await page.locator('#daily-target').inputValue(),'1900');assert.equal(await page.locator('#protein-goal').inputValue(),'220');saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));assert.equal(saved.entries[0].extra,'preserve');assert.equal(saved.schemaVersion,5);
 await page.locator('[data-view=history]').click();await page.locator('#past-entries .repeat').click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));assert.equal(saved.entries.length,2);assert.notEqual(saved.entries[1].day,'2020-01-01');
 // Restore an empty synthetic journal for uncluttered presentation screenshots.
 await page.evaluate(()=>localStorage.removeItem('rec-calories-v1'));await page.reload();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 assert.equal(await page.evaluate(()=>caches.has('rec-calories-shell-v5b')),true);
 fs.mkdirSync(shots,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>scrollY),0);for(const id of ['calorie-ring','protein-ring']){const box=await page.locator('#'+id).boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=932);}await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});await page.screenshot({path:path.join(shots,'v5-today-light.png')});
 const lightBg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);await page.emulateMedia({colorScheme:'dark'});const darkBg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(lightBg,darkBg);await page.screenshot({path:path.join(shots,'v5-today-dark.png')});
 await context.setOffline(true);await page.reload();assert.equal(await page.title(),'CHAD');assert.equal(await page.locator('#remaining').innerText(),'1,900');assert.equal(await page.evaluate(()=>typeof ZXingBrowser.BrowserMultiFormatOneDReader),'function');assert.equal(await page.evaluate(()=>typeof CHADFood.startScanner),'function');assert.deepEqual(errors,[]);
 await context.setOffline(false);await context.close();
 console.log('PASS: mobile 430x932 light/dark, no unexpected JS/console errors; OFF barcode '+realProduct.replaceAll('\n',' ')+'; OFF search; portion math; one-tap log/repeat; manual entry; mocked AI success/401/bad JSON; legacy migration; v5 SW offline shell including scanner; screenshots '+shots);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
