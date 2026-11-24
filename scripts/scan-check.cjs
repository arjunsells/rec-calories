// Snap + Say client (scan9.js) with stubbed fetchers only: synthetic tokens, no live AI request, no real credential.
const assert = require('node:assert/strict');
globalThis.CHADFood = require('../food9.js');                // the AI's portions pass through the metric tidy-up
const scan = require('../scan9.js');
const meal = { name: 'Synthetic rice bowl', kcal: 640, protein: 42, carbs: 70, fat: 18, items: [{ name: 'Rice', portion: '1 cup (200 g)', kcal: 260, protein: 5, carbs: 57, fat: 1 }, { name: 'Chicken', portion: '150 g', kcal: 380, protein: 37, carbs: 13, fat: 17 }], confidence: 0.7 };
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const store = values => ({ getItem: k => values[k] ?? null });

(async () => {
  // Routes: nothing set means no request at all; the proxy wins over a key; the default proxy URL is empty.
  assert.deepEqual(scan.settings(store({})), { proxy: '', token: '', key: '', mode: 'none' });
  assert.equal(scan.settings(store({ 'rec-calories-ai-key': 'synthetic-key' })).mode, 'key', 'the v8 key keeps working');
  assert.equal(scan.settings(store({ 'chad.aiProxyUrl': 'https://proxy.example', 'rec-calories-ai-key': 'synthetic-key' })).mode, 'proxy');
  await assert.rejects(scan.estimate({ hint: 'rice' }, { fetcher: () => { throw Error('must not fetch'); } }), e => e.kind === 'off');
  await assert.rejects(scan.estimate({}, { proxy: 'https://proxy.example', fetcher: () => { throw Error('must not fetch'); } }), e => e.kind === 'input');

  // Proxy URLs: https, or http on this device's loopback only; never credentials; a bare origin posts to /estimate.
  for (const ok of ['https://proxy.example', 'https://chad.example.workers.dev/estimate', 'http://127.0.0.1:8095', 'http://localhost:9000/x']) assert.doesNotThrow(() => scan.checkProxy(ok), ok);
  for (const bad of ['proxy.example', 'http://proxy.example', 'ftp://proxy.example', 'https://user:pass@proxy.example', '', 'javascript:alert(1)']) assert.throws(() => scan.checkProxy(bad), e => e.kind === 'proxy', bad);
  assert.equal(scan.endpoint('https://proxy.example/'), 'https://proxy.example/estimate'); assert.equal(scan.endpoint('https://proxy.example/api/meal'), 'https://proxy.example/api/meal');
  assert.equal(scan.healthURL('https://proxy.example:8443/'), 'https://proxy.example:8443/health'); assert.equal(scan.healthURL('https://proxy.example/estimate'), 'https://proxy.example/health');
  // One-time setup links carry the URL and the token in the hash.
  assert.deepEqual(scan.setupLink('https://example.github.io/rec-calories/#ai=' + encodeURIComponent('https://proxy.example:8443') + '&k=synthetic-token'), { url: 'https://proxy.example:8443', token: 'synthetic-token' });
  assert.deepEqual(scan.setupLink('#ai=https%3A%2F%2Fproxy.example'), { url: 'https://proxy.example', token: '' });
  assert.equal(scan.setupLink('https://example.github.io/rec-calories/'), null); assert.equal(scan.setupLink(''), null);

  // The proxy request: JSON with image, hint (and text), metric; token header only when set; no cookies, no Authorization.
  let request;
  let result = await scan.estimate({ image: 'data:image/jpeg;base64,c3ludGhldGlj', hint: 'rice and chicken' }, { proxy: 'https://proxy.example', token: 'synthetic-token', fetcher: async (url, init) => { request = { url, ...init }; return reply(meal); } });
  assert.equal(request.url, 'https://proxy.example/estimate'); assert.equal(request.method, 'POST'); assert.equal(request.credentials, 'omit');
  assert.equal(request.headers['Content-Type'], 'application/json'); assert.equal(request.headers['X-Chad-Token'], 'synthetic-token'); assert.equal(request.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(request.body), { image: 'data:image/jpeg;base64,c3ludGhldGlj', hint: 'rice and chicken', text: 'rice and chicken', units: 'metric' });
  assert.equal(result.via, 'proxy'); assert.equal(result.items.length, 1, 'one entry for the meal'); assert.equal(result.items[0].name, 'Synthetic rice bowl');
  assert.deepEqual([result.items[0].kcal, result.items[0].protein, result.items[0].carbs, result.items[0].fat], [640, 42, 70, 18]);
  assert.equal(result.parts.length, 2); assert.equal(result.parts[0].portion, '200 g', 'portions come back metric'); assert.equal(result.confidence, 0.7);
  await scan.estimate({ hint: 'rice' }, { proxy: 'https://proxy.example', fetcher: async (url, init) => { request = init; return reply(meal); } });
  assert.equal(request.headers['X-Chad-Token'], undefined, 'no token, no header'); assert.equal(JSON.parse(request.body).image, null);
  // The same idea with _g names and grams, as some proxies answer.
  result = await scan.estimate({ hint: 'half a roast chicken' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ name: 'Half a roast chicken', grams: 350, kcal: 760, protein_g: 95, carbs_g: 0, fat_g: 42, confidence: 0.65, items: [{ name: 'Roast chicken', grams: 350, kcal: 760, protein_g: 95, carbs_g: 0, fat_g: 42 }], ms: 7571 }) });
  assert.deepEqual([result.items[0].name, result.items[0].portion, result.items[0].kcal, result.items[0].protein, result.items[0].carbs, result.items[0].fat], ['Half a roast chicken', '350 g', 760, 95, 0, 42]);
  // Items only: each becomes an entry and the total is recomputed.
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ items: meal.items, total: 9999 }) });
  assert.equal(result.items.length, 2); assert.equal(result.total, 640);
  // Nothing edible: a gentle "no food", not an error page.
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0, items: [] }) }), e => e.kind === 'empty');

  // Failures are typed and phrased gently: offline / CORS, timeout, rejected token, limits, busy (one retry), server errors, junk.
  const fails = [
    [async () => { throw TypeError('Failed to fetch'); }, 'network'],
    [async () => reply({ error: 'token' }, 401), 'auth'], [async () => reply({}, 403), 'auth'],
    [async () => reply({}, 429), 'limit'], [async () => reply({}, 413), 'large'], [async () => reply({}, 502), 'http'], [async () => reply({}, 500), 'http'],
    [async () => ({ ok: true, status: 200, json: async () => { throw SyntaxError('broken'); } }), 'parse'],
    [async () => reply({ name: 'x', kcal: -1, protein: 1, carbs: 1, fat: 1 }), 'parse'], [async () => reply({ name: 'x', kcal: 100, protein: '5', carbs: 1, fat: 1 }), 'parse'],
    [async () => reply({ name: 'x', kcal: 100, protein: Infinity, carbs: 1, fat: 1 }), 'parse'], [async () => reply({ items: [{ name: 'x' }] }), 'parse'], [async () => reply([1, 2]), 'parse']
  ];
  for (const [fetcher, kind] of fails) await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher }), e => e.kind === kind && !/[{}<>]|undefined|TypeError/.test(e.message), kind);
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', timeout: 30, fetcher: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' })))) }), e => e.kind === 'timeout');
  let calls = 0;
  const started = Date.now();
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => ++calls === 1 ? reply({ error: 'busy' }, 503) : reply(meal) });
  assert.equal(calls, 2, 'busy: one more go'); assert.ok(Date.now() - started >= 2900, 'after a short pause'); assert.equal(result.items[0].kcal, 640);
  calls = 0; await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => { calls++; return reply({}, 503); } }), e => e.kind === 'busy'); assert.equal(calls, 2, 'and only one');

  // Health: GET /health, no token, true only for {ok:true}.
  let health;
  assert.equal(await scan.health('https://proxy.example', { fetcher: async (url, init) => { health = { url, init }; return reply({ ok: true, busy: 0 }); } }), true);
  assert.equal(health.url, 'https://proxy.example/health'); assert.equal(health.init.method, undefined); assert.equal(health.init.headers, undefined);
  for (const fetcher of [async () => reply({ ok: false }), async () => reply({}, 404), async () => { throw TypeError('offline'); }]) assert.equal(await scan.health('https://proxy.example', { fetcher }), false);

  // Own OpenAI key (hidden fallback): the v8 request contract with the shared prompt and the same answer checks.
  let body;
  result = await scan.estimate({ image: 'data:image/jpeg;base64,c3ludGhldGlj', hint: 'rice' }, { key: 'synthetic-test-token', fetcher: async (url, init) => { request = { url, ...init }; body = JSON.parse(init.body); return reply({ choices: [{ message: { content: JSON.stringify(meal) } }] }); } });
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions'); assert.equal(request.headers.Authorization, 'Bearer synthetic-test-token');
  assert.equal(body.model, 'gpt-4o-mini'); assert.equal(body.store, false); assert.equal(body.response_format.type, 'json_object'); assert.equal(body.messages[0].content, scan.PROMPT); assert.match(scan.PROMPT, /metric/);
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,c3ludGhldGlj'); assert.equal(result.via, 'key'); assert.equal(result.items[0].kcal, 640);
  await scan.estimate({ hint: 'Chicken, rice and broccoli' }, { key: 'synthetic-test-token', fetcher: async (url, init) => { body = JSON.parse(init.body); return reply({ choices: [{ message: { content: JSON.stringify(meal) } }] }); } });
  assert.ok(JSON.stringify(body.messages[1]).includes('Chicken, rice and broccoli')); assert.ok(!JSON.stringify(body.messages[1]).includes('image_url'));
  await assert.rejects(scan.estimate({ hint: 'x' }, { key: 'synthetic-test-token', fetcher: async () => reply({}, 401) }), e => e.kind === 'key' && /OpenAI/.test(e.message));
  await assert.rejects(scan.estimate({ hint: 'x' }, { key: 'synthetic-test-token', fetcher: async () => reply({ choices: [{ message: { content: 'broken json' } }] }) }), e => e.kind === 'parse');
  console.log('PASS scan9: routes (none / proxy / own key, proxy first, empty default), URL rules and /estimate + /health, setup links, request contract (image, hint, text, metric, token header, no cookies), both answer shapes, items-only totals, no-food, typed gentle failures incl. CORS/offline, timeout, 401/403/413/429/5xx, one busy retry, health checks, own-key contract with the shared prompt. No real AI call made.');
})().catch(error => { console.error(error); process.exitCode = 1; });
