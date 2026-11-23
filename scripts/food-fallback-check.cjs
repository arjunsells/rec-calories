const assert=require('node:assert/strict'),food=require('../food.js');
const product={product_name:'YoPRO synthetic test',nutriments:{'energy-kcal_100g':100,proteins_100g:10,carbohydrates_100g:5,fat_100g:2}};
const ok=products=>({ok:true,json:async()=>({products})});
(async()=>{
 for(let success=0;success<4;success++){
  const requests=[];
  const items=await food.search('yopro',async(url,options)=>{requests.push(url);assert.ok(options.signal instanceof AbortSignal);return requests.length===success+1?ok([product]):Promise.reject(TypeError('Synthetic CORS failure'));});
  assert.equal(items[0].source,'search');assert.equal(requests.length,success+1);
  const url=new URL(requests.at(-1));assert.equal(url.searchParams.get('page_size'),'20');assert.ok(url.searchParams.get('fields').includes('nutriments'));assert.equal(url.hostname,success<2?'world.openfoodfacts.org':'au.openfoodfacts.org');
 }
 let requests=0;
 await food.search('yopro',async()=>{requests++;return ok(requests===1?[{...product,product_name:'Unrelated popular food'}]:[product]);});assert.equal(requests,2,'v2 cannot silently ignore query');
 const urls=[];await food.search('up&go',async url=>{urls.push(url);return ok([{...product,product_name:'UP&GO'}]);});assert.equal(new URL(urls[0]).searchParams.get('search_terms'),'up&go');
 requests=0;await assert.rejects(food.search('yopro',async()=>{requests++;throw Object.assign(Error('timeout'),{name:'AbortError'});}),/Quick add/);assert.equal(requests,4);
 assert.deepEqual(await food.search('yopro',async()=>ok([])),[]);
 requests=0;await assert.rejects(food.search('yopro',async()=>{requests++;return {ok:true,json:async()=>{throw SyntaxError('invalid JSON')}};}),/unavailable/);assert.equal(requests,4);
 console.log('PASS OFF: four fallback branches, abort signals, query encoding/fields/page_size, v2 ignored-query guard, timeout/CORS/malformed JSON/manual recovery, empty results.');
})().catch(e=>{console.error(e);process.exitCode=1;});
