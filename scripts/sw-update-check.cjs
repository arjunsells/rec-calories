// Real service-worker upgrade from the previous shell, using a synthetic journal only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),newWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
let upgraded=false;
// Serve the actual shipped v6 shell, including its original markup and assets.
const {execFileSync}=require('node:child_process'),oldFiles=new Map();
const oldFile=file=>{if(!oldFiles.has(file))oldFiles.set(file,execFileSync('git',['show','5ead80e:'+file],{cwd:root,maxBuffer:8*1024*1024}));return oldFiles.get(file);};
const previousWorker=oldFile('sw.js');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}if(pathname==='/sw.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end(upgraded?newWorker:previousWorker);}if(!upgraded){try{const data=oldFile(path.relative(root,file).replaceAll('\\','/'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});return res.end(data);}catch{res.writeHead(404);return res.end('missing');}}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(err?'missing':data);});});
(async()=>{await new Promise(r=>server.listen(8089,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-24T12:00:00+09:30')});await page.goto('http://127.0.0.1:8089/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);assert.equal(await page.evaluate(()=>caches.has('rec-calories-shell-v6')),true);
 await page.evaluate(()=>document.querySelectorAll('#today details').forEach(d=>d.open=true));
 await page.locator('[data-slot=L][data-tier=S]').click();const saved=await page.evaluate(()=>localStorage.getItem('rec-calories-v1'));
 upgraded=true;await page.evaluate(async()=>{const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));const registration=await navigator.serviceWorker.getRegistration();await registration.update();await changed;});
 await page.waitForFunction(async()=>(await caches.has('rec-calories-shell-v7'))&&!(await caches.has('rec-calories-shell-v6')));
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.CHADIcons&&window.CHADCharts&&document.querySelector('.meal-pick'));
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('rec-calories-v1')));for(const [key,value] of Object.entries(JSON.parse(saved)))assert.deepEqual(restored[key],value);assert.equal(await page.locator('[data-slot=L][data-tier=S]').getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);
 assert.equal(await page.locator('#journey-day').innerText(),'Day 48');
 for(const file of ['theme7.css','icons7.js','charts7.js','icons/icon-maskable-512.png'])assert.equal(await page.evaluate(async file=>(await fetch('./'+file)).status,file),200);
 console.log('PASS actual v6 to v7 upgrade: previous cache removed, new kit/icons available offline, synthetic journal and selected meal preserved, journey defaults to Day 48.');await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
