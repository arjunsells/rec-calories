// Render a disposable shell copy, with synthetic meal/quest data only.
// No browser profile, user journal, key, measurement, medication or photo is read.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'chad-browser-qa/node_modules/playwright'));
const repo=path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'chad-v7-shot-shell-'));
const output=process.env.CHAD_SHOTS||path.resolve(repo,'../rec-calories-shots');
const shell=fs.readFileSync(path.join(repo,'sw.js'),'utf8').match(/^const SHELL = (.+);$/m)[1];
for(const file of ['sw.js',...[...shell.matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(f=>f!=='./')]){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(repo,file),dest);}
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(e?'missing':data);});});
(async()=>{
 fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(8093,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const [width,height,theme] of [[393,852,'dark'],[393,852,'light'],[375,667,'dark']]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.clock.install({time:new Date('2026-11-24T19:00:00+09:30')});await page.goto('http://127.0.0.1:8093/');
   await page.evaluate(()=>{
    const state={schemaVersion:5,target:1900,proteinGoal:220,carbsGoal:150,fatGoal:45,entries:[],questsV5:{}};
    for(let n=1;n<=12;n++){const key=CHADQuest.shift('2026-11-24',-n);state.entries.push({id:'demo-'+n,day:key,name:'Example meal',kcal:1800+n*5,protein:220,carbs:150,fat:45});state.questsV5[key]={picks:{L:'S',P:'S',D:'S',E:'S'},water:CHADQuest.waterGoal(key),steps:true};}
    for(const id of ['L','P']){const c=CHADPlan.find(s=>s.id===id).choices[0];state.entries.push({id:'demo-today-'+id,day:'2026-11-24',name:c.title,kcal:c.macros[0],protein:c.macros[1],carbs:c.macros[2],fat:c.macros[3],meal:id==='L'?'Lunch':'Snacks',source:'plan',planSlot:id});}
    state.questsV5['2026-11-24']={picks:{L:'S',P:'S'},water:3.5,electrolyte:true,steps:true,sleep:true,exercises:{0:true,1:true,2:true}};
    localStorage.setItem('rec-calories-v1',JSON.stringify(state));
   });await page.reload();await page.evaluate(()=>document.fonts.ready);
   await page.addStyleTag({content:':root{--ch-sat:47px;--ch-sab:34px}'});
   const shoot=async name=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,name)});};
   if(width===375)await shoot('v7-se.png');
   else{
    await shoot('v7-today-'+theme+'.png');
    if(theme==='dark'){
     await page.locator('[data-view=training]').tap();await shoot('v7-training.png');
     await page.locator('[data-view=today]').tap();await page.locator('#today-scan').tap();await page.screenshot({path:path.join(output,'v7-add-sheet.png')});await page.keyboard.press('Escape');
     await page.locator('[data-view=history]').tap();await shoot('v7-progress.png');
    }
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  fs.copyFileSync(path.join(repo,'icons/icon-512.png'),path.join(output,'v7-icon.png'));
  const kit=process.env.CHAD_DESIGN_KIT||path.resolve(repo,'../rec-calories-design7');
  fs.copyFileSync(path.join(kit,'home-preview.png'),path.join(output,'v7-icon-home.png'));
  console.log('PASS six app screenshots and two icon images: '+output+' (disposable shell copy: '+root+')');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
