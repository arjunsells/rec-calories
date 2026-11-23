const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),shots=path.resolve(root,'../rec-calories-shots');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(e?'missing':data);});});
(async()=>{await new Promise(r=>server.listen(8091,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.clock.install({time:new Date('2026-11-24T12:00:00+09:30')});await page.goto('http://127.0.0.1:8091/');
 if(process.env.CHAD_TEST_DATA){const fixture=JSON.parse(fs.readFileSync(process.env.CHAD_TEST_DATA,'utf8'));assert.ok(!/weight|thumbnail|photo|meds|api.?key/i.test(JSON.stringify(fixture)));await page.evaluate(s=>localStorage.setItem('rec-calories-v1',JSON.stringify(s)),fixture);await page.reload();}
 const check=async(label)=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' page overflow');const bad=await page.evaluate(()=>[...document.querySelectorAll('button,summary,input:not([type=hidden]),select,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&(r.width<44||r.height<44);}).map(e=>({text:(e.textContent||e.id).trim().slice(0,50),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.deepEqual(bad,[],label+' 44pt controls');};
 fs.mkdirSync(shots,{recursive:true});
 for(const theme of ['dark','light']){await page.emulateMedia({colorScheme:theme});for(const view of ['today','training','history','settings']){await page.locator(`[data-view=${view}]`).click();await check(theme+' '+view);if(view==='settings'){await page.evaluate(()=>document.querySelectorAll('#settings details').forEach(d=>d.open=true));await check(theme+' expanded settings');}}
 await page.locator('[data-view=today]').click();await page.screenshot({path:path.join(shots,`v6-today-${theme}.png`)});}
 await page.emulateMedia({colorScheme:'dark'});await page.locator('#today-scan').click();await check('add');await page.screenshot({path:path.join(shots,'v6-add-sheet.png')});
 for(const kind of ['manual','camera','barcode','search']){await page.locator(`[data-add=${kind}]`).click();await check(kind+' sheet');await page.keyboard.press('Escape');await page.locator('#today-scan').click();}await page.keyboard.press('Escape');
 await page.locator('#next-up .text-button').click();await check('meal detail');await page.keyboard.press('Escape');
 await page.locator('[data-view=training]').click();await page.screenshot({path:path.join(shots,'v6-training.png')});await page.locator('.is-today .exercise > .text-button').first().click();await check('training detail');await page.keyboard.press('Escape');
 await page.locator('[data-view=history]').click();await page.screenshot({path:path.join(shots,'v6-progress.png')});
 assert.deepEqual(errors,[]);console.log('PASS v6 design: Edge 390x844 both themes, all views and sheets, 44pt controls, no overflow or console errors; five requested screenshots saved outside repo.');
 await context.close();}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
