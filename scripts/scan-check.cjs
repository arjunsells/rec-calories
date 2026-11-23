// Uses a fake token and stubbed fetch only; no live AI request or credentials.
const assert = require('node:assert/strict');
const scan = require('../scan.js');
const item = { name: 'Synthetic rice bowl', portion: '250 g', kcal: 420, protein: 22, carbs: 55, fat: 12 };
const success = { ok:true, json:async()=>({choices:[{message:{content:JSON.stringify({items:[item],total:999})}}]}) };
(async () => {
  let request;
  const result = await scan.analyze('data:image/jpeg;base64,c3ludGhldGlj', 'synthetic-test-token', async (url, options) => { request = {url,...options}; return success; });
  assert.equal(result.total,420); // Recompute untrusted totals.
  assert.equal(request.url,'https://api.openai.com/v1/chat/completions');
  assert.equal(request.headers.Authorization,'Bearer synthetic-test-token');
  const body=JSON.parse(request.body);
  assert.equal(body.model,'gpt-4o-mini');assert.equal(body.store,false);assert.equal(body.response_format.type,'json_object');
  assert.equal(body.messages[1].content[1].image_url.url,'data:image/jpeg;base64,c3ludGhldGlj');
  let textBody;
  await scan.analyze(null,'synthetic-test-token',async(url,options)=>{textBody=JSON.parse(options.body);return success},'Chicken, rice and broccoli');
  assert.ok(JSON.stringify(textBody.messages[1]).includes('Chicken, rice and broccoli'));
  assert.ok(!JSON.stringify(textBody.messages[1]).includes('image_url'));
  for(const [status,pattern]of [[401,/key was rejected/],[429,/usage limit/],[500,/unavailable/]])await assert.rejects(scan.analyze('image','synthetic-test-token',async()=>({status,ok:false})),pattern);
  await assert.rejects(scan.analyze('image','',()=>{throw Error('Must not fetch')}),/Settings/);
  await assert.rejects(scan.analyze('image','synthetic-test-token',async()=>{throw TypeError('offline')}),/internet connection/);
  await assert.rejects(scan.analyze('image','synthetic-test-token',async()=>{throw Object.assign(Error(),{name:'AbortError'})}),/timed out/);
  await assert.rejects(scan.analyze('image','synthetic-test-token',async()=>({ok:true,json:async()=>{throw SyntaxError('broken')}})),/Could not read/);
  for(const content of ['broken','{}','{"items":[]}',JSON.stringify({items:[{...item,kcal:-1}]}),JSON.stringify({items:[{...item,carbs:'55'}]}),JSON.stringify({items:[{...item,protein:Infinity}]}),JSON.stringify({items:[{...item,name:''}]}),JSON.stringify({items:Array.from({length:31},()=>item)})])await assert.rejects(scan.analyze('image','synthetic-test-token',async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})})),/Could not read/);
  assert.equal(scan.parse(JSON.stringify({items:[{...item,kcal:420.4,protein:22.12}]})).items[0].protein,22.1);
  console.log('PASS: mocked AI image/text success and request contracts, recomputed totals, no key, 401, 429, server error, malformed and invalid JSON, offline and timeout. No real AI call made.');
})().catch(error=>{console.error(error);process.exitCode=1});
