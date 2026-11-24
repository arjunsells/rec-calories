// Snap + Say client (scan9.js) with stubbed fetchers only: synthetic tokens, no live AI request, no real credential.
const assert = require('node:assert/strict');
globalThis.CHADFood = require('../food9.js');                // the AI's portions pass through the metric tidy-up
const scan = require('../scan9.js');
const DEFAULT = scan.DEFAULT_PROXY;
const meal = { name: 'Synthetic rice bowl', kcal: 640, protein: 42, carbs: 70, fat: 18, items: [{ name: 'Rice', portion: '1 cup (200 g)', kcal: 260, protein: 5, carbs: 57, fat: 1 }, { name: 'Chicken', portion: '150 g', kcal: 380, protein: 37, carbs: 13, fat: 17 }], confidence: 0.7 };
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const store = values => ({ getItem: k => values[k] ?? null });
const never = () => { throw Error('must not fetch'); };

(async () => {
  // Routes. The built-in address is https and needs a token before anything is sent; a token beats an own key;
  // an address of your own (no token) is still used, as the v9 Worker example allows.
  assert.match(DEFAULT, /^https:\/\/[^/]+\/$/);
  assert.deepEqual(scan.settings(store({})), { proxy: DEFAULT, saved: '', token: '', key: '', custom: false, mode: 'none' });
  assert.deepEqual(scan.settings(store({ 'chad.aiProxyToken': 'synthetic-token' })), { proxy: DEFAULT, saved: '', token: 'synthetic-token', key: '', custom: false, mode: 'proxy' }, 'a token alone uses the built-in proxy');
  assert.equal(scan.settings(store({ 'rec-calories-ai-key': 'synthetic-key' })).mode, 'key', 'the v8 key keeps working');
  assert.equal(scan.settings(store({ 'chad.aiProxyToken': 'synthetic-token', 'rec-calories-ai-key': 'synthetic-key' })).mode, 'proxy', 'proxy first');
  const own = scan.settings(store({ 'chad.aiProxyUrl': 'https://proxy.example/', 'rec-calories-ai-key': 'synthetic-key' }));
  assert.deepEqual([own.mode, own.proxy, own.custom], ['proxy', 'https://proxy.example/', true]);
  assert.equal(scan.settings(store({ 'chad.aiProxyUrl': DEFAULT, 'chad.aiProxyToken': 't' })).custom, false);
  await assert.rejects(scan.estimate({ hint: 'rice' }, { ...scan.settings(store({})), fetcher: never }), e => e.kind === 'off', 'no token: nothing is sent to the built-in proxy');
  await assert.rejects(scan.estimate({ hint: 'rice' }, { fetcher: never }), e => e.kind === 'off');
  await assert.rejects(scan.estimate({}, { proxy: 'https://proxy.example', fetcher: never }), e => e.kind === 'input');

  // Proxy URLs: https, or http on this device's loopback only; never credentials; a bare origin posts to /estimate.
  for (const ok of ['https://proxy.example', 'https://chad.example.workers.dev/estimate', 'http://127.0.0.1:8095', 'http://localhost:9000/x', DEFAULT]) assert.doesNotThrow(() => scan.checkProxy(ok), ok);
  for (const bad of ['proxy.example', 'http://proxy.example', 'ftp://proxy.example', 'https://user:pass@proxy.example', '', 'javascript:alert(1)']) assert.throws(() => scan.checkProxy(bad), e => e.kind === 'proxy', bad);
  assert.equal(scan.endpoint('https://proxy.example/'), 'https://proxy.example/estimate'); assert.equal(scan.endpoint('https://proxy.example/api/meal'), 'https://proxy.example/api/meal');
  assert.equal(scan.healthURL('https://proxy.example:8443/'), 'https://proxy.example:8443/health'); assert.equal(scan.healthURL('https://proxy.example/estimate'), 'https://proxy.example/health');
  assert.equal(scan.endpoint(DEFAULT), DEFAULT + 'estimate'); assert.equal(scan.healthURL(DEFAULT), DEFAULT + 'health');
  for (const same of [DEFAULT, DEFAULT.slice(0, -1), DEFAULT + 'estimate']) assert.equal(scan.isDefault(same), true, same);
  for (const other of ['https://proxy.example', 'not a url', '']) assert.equal(scan.isDefault(other), false, other);

  // Setup links: the whole link, just the hash, or the bare "ai=…&k=…"; a token-only link is for the built-in proxy.
  const link = 'https://example.github.io/rec-calories/#ai=' + encodeURIComponent('https://proxy.example:8443') + '&k=synthetic-token';
  assert.deepEqual(scan.setupLink(link), { url: 'https://proxy.example:8443', token: 'synthetic-token' });
  assert.deepEqual(scan.setupLink(link.slice(link.indexOf('#'))), { url: 'https://proxy.example:8443', token: 'synthetic-token' });
  assert.deepEqual(scan.setupLink(link.slice(link.indexOf('#') + 1)), { url: 'https://proxy.example:8443', token: 'synthetic-token' });
  assert.deepEqual(scan.setupLink('  ' + link + '\n'), { url: 'https://proxy.example:8443', token: 'synthetic-token' }, 'pasted with spaces around it');
  assert.deepEqual(scan.setupLink('#ai=https%3A%2F%2Fproxy.example'), { url: 'https://proxy.example', token: '' });
  assert.deepEqual(scan.setupLink('#k=synthetic-token'), { url: DEFAULT, token: 'synthetic-token' });
  for (const none of ['https://example.github.io/rec-calories/', '', '#today', '#ai=&k=', '#ai=https%3A%2F%2Fproxy.example&k=two%20words']) assert.equal(scan.setupLink(none), null, none);

  // The proxy request: JSON with image, text (and hint), metric; token header only when set; no cookies, no Authorization.
  let request;
  let result = await scan.estimate({ image: 'data:image/jpeg;base64,c3ludGhldGlj', hint: 'rice and chicken' }, { proxy: 'https://proxy.example', token: 'synthetic-token', fetcher: async (url, init) => { request = { url, ...init }; return reply(meal); } });
  assert.equal(request.url, 'https://proxy.example/estimate'); assert.equal(request.method, 'POST'); assert.equal(request.credentials, 'omit'); assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(request.headers['Content-Type'], 'application/json'); assert.equal(request.headers['X-Chad-Token'], 'synthetic-token'); assert.equal(request.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(request.body), { image: 'data:image/jpeg;base64,c3ludGhldGlj', text: 'rice and chicken', hint: 'rice and chicken', units: 'metric' });
  assert.equal(result.via, 'proxy'); assert.equal(result.meal.name, 'Synthetic rice bowl');
  assert.deepEqual([result.meal.kcal, result.meal.protein, result.meal.carbs, result.meal.fat, result.meal.grams, result.meal.portion], [640, 42, 70, 18, 350, '350 g'], 'no weight on the meal: its parts weigh 200 + 150 g');
  assert.equal(result.parts.length, 2); assert.equal(result.parts[0].portion, '200 g', 'portions come back metric'); assert.equal(result.confidence, 0.7);
  await scan.estimate({ hint: 'rice' }, { proxy: 'https://proxy.example', fetcher: async (url, init) => { request = init; return reply(meal); } });
  assert.equal(request.headers['X-Chad-Token'], undefined, 'no token, no header'); assert.equal(JSON.parse(request.body).image, null);
  // The CHAD proxy's own answer: _g names and grams (the weight the card scales from).
  const chicken = { name: 'Half a roast chicken', grams: 350, kcal: 760, protein_g: 95, carbs_g: 0, fat_g: 42, confidence: 0.65, items: [{ name: 'Roast chicken', grams: 350, kcal: 760, protein_g: 95, carbs_g: 0, fat_g: 42 }], ms: 7571 };
  result = await scan.estimate({ hint: 'half a roast chicken' }, { mode: 'proxy', proxy: DEFAULT, token: 'synthetic-token', fetcher: async (url, init) => { request = { url, ...init }; return reply(chicken); } });
  assert.equal(request.url, DEFAULT + 'estimate');
  assert.deepEqual(result.meal, { name: 'Half a roast chicken', grams: 350, portion: '350 g', kcal: 760, protein: 95, carbs: 0, fat: 42 });
  assert.deepEqual(result.parts[0], { name: 'Roast chicken', grams: 350, portion: '350 g', kcal: 760, protein: 95, carbs: 0, fat: 42 });
  // Items only: one meal from its parts. A broken breakdown line is dropped, not fatal.
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ items: meal.items, total: 9999 }) });
  assert.deepEqual([result.meal.name, result.meal.kcal, result.meal.protein, result.meal.grams], ['Rice and Chicken', 640, 42, 350]);
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ items: [{ name: 'A', grams: 100, kcal: 100, protein: 1, carbs: 2, fat: 3 }, { name: 'B', grams: 50, kcal: 50, protein: 1, carbs: 2, fat: 3 }, { name: 'C', grams: 10, kcal: 10, protein: 0, carbs: 1, fat: 0 }, { name: 'D', grams: 10, kcal: 10, protein: 0, carbs: 1, fat: 0 }] }) });
  assert.deepEqual([result.meal.name, result.meal.grams, result.meal.kcal], ['A, B and 2 more', 170, 170]);
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ ...chicken, items: [...chicken.items, { name: 'broken', kcal: 'lots' }] }) });
  assert.equal(result.meal.kcal, 760); assert.equal(result.parts.length, 1);
  // Nothing edible: a gentle "no food", not an error page (the CHAD proxy says "Not food" with zeros).
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0, items: [] }) }), e => e.kind === 'empty');
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => reply({ name: 'Not food', grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, confidence: 0, items: [{ name: 'Not food', grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }] }) }), e => e.kind === 'empty');

  // Failures are typed and phrased gently: offline / CORS, timeout, rejected token, limits, busy (one retry), estimate
  // failed (502), other server errors, junk.
  const fails = [
    [async () => { throw TypeError('Failed to fetch'); }, 'network'],
    [async () => reply({ error: 'unauthorized' }, 401), 'auth'], [async () => reply({}, 403), 'auth'],
    [async () => reply({}, 429), 'limit'], [async () => reply({}, 413), 'large'], [async () => reply({ error: 'estimate failed, try again' }, 502), 'failed'], [async () => reply({}, 500), 'failed'], [async () => reply({}, 504), 'failed'], [async () => reply({}, 404), 'http'],
    [async () => ({ ok: true, status: 200, json: async () => { throw SyntaxError('broken'); } }), 'parse'],
    [async () => reply({ name: 'x', kcal: -1, protein: 1, carbs: 1, fat: 1 }), 'parse'], [async () => reply({ name: 'x', kcal: 100, protein: '5', carbs: 1, fat: 1 }), 'parse'],
    [async () => reply({ name: 'x', kcal: 100, protein: Infinity, carbs: 1, fat: 1 }), 'parse'], [async () => reply({ items: [{ name: 'x' }] }), 'parse'], [async () => reply([1, 2]), 'parse']
  ];
  for (const [fetcher, kind] of fails) await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher }), e => e.kind === kind && !/[{}<>]|undefined|TypeError|\b\d{3}\b/.test(e.message), kind);
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', timeout: 30, fetcher: hang }), e => e.kind === 'timeout');
  // Cancel: the caller's signal stops it at once (kind "cancelled", never mistaken for a timeout), even before it starts.
  const stop = new AbortController(), cancelled = scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: hang, signal: stop.signal });
  setTimeout(() => stop.abort(), 20);
  await assert.rejects(cancelled, e => e.kind === 'cancelled');
  await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: never, signal: AbortSignal.abort() }), e => e.kind === 'cancelled');
  assert.equal(scan.TIMEOUT.proxy, 100000, 'the proxy gets 100 s');
  let calls = 0;
  const said = [], started = Date.now();
  result = await scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', onStatus: s => said.push(s), fetcher: async () => ++calls === 1 ? reply({ error: 'busy' }, 503) : reply(meal) });
  assert.equal(calls, 2, 'busy: one more go'); assert.ok(Date.now() - started >= 2900, 'after three seconds'); assert.equal(result.meal.kcal, 640); assert.deepEqual(said, ['busy', 'retry']);
  calls = 0; await assert.rejects(scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', fetcher: async () => { calls++; return reply({}, 503); } }), e => e.kind === 'busy'); assert.equal(calls, 2, 'and only one');
  // Cancel during the busy pause.
  const pausing = new AbortController(), paused = scan.estimate({ hint: 'x' }, { proxy: 'https://proxy.example', signal: pausing.signal, fetcher: async () => reply({}, 503) });
  setTimeout(() => pausing.abort(), 50);
  await assert.rejects(paused, e => e.kind === 'cancelled');

  // Health: GET /health, no token, true only for {ok:true}.
  let health;
  assert.equal(await scan.health('https://proxy.example', { fetcher: async (url, init) => { health = { url, init }; return reply({ ok: true, busy: 0 }); } }), true);
  assert.equal(health.url, 'https://proxy.example/health'); assert.equal(health.init.method, undefined); assert.equal(health.init.headers, undefined);
  for (const fetcher of [async () => reply({ ok: false }), async () => reply({}, 404), async () => { throw TypeError('offline'); }]) assert.equal(await scan.health('https://proxy.example', { fetcher }), false);
  // Test (Settings): health, then an empty POST that the proxy turns away before any AI runs: 400 = token fine, 401 = not.
  const probe = status => async (url, init) => { (probe.seen ||= []).push({ url, init }); return url.endsWith('/health') ? reply({ ok: true }) : reply({ error: 'x' }, status); };
  assert.equal(await scan.check('https://proxy.example', 'synthetic-token', { fetcher: probe(400) }), 'ok');
  const sent = probe.seen.at(-1); assert.equal(sent.url, 'https://proxy.example/estimate'); assert.equal(sent.init.method, 'POST'); assert.equal(sent.init.body, '{}'); assert.equal(sent.init.headers['X-Chad-Token'], 'synthetic-token'); assert.equal(sent.init.credentials, 'omit');
  assert.equal(await scan.check('https://proxy.example', 'synthetic-wrong', { fetcher: probe(401) }), 'rejected');
  assert.equal(await scan.check('https://proxy.example', 'synthetic-token', { fetcher: probe(503) }), 'ok', 'busy still means the token passed');
  probe.seen = []; assert.equal(await scan.check('https://proxy.example', '', { fetcher: probe(401) }), 'ok'); assert.equal(probe.seen.length, 1, 'no token: health only');
  assert.equal(await scan.check('https://proxy.example', 'synthetic-token', { fetcher: async () => { throw TypeError('offline'); } }), 'offline');

  // Own OpenAI key (hidden fallback): the v8 request contract with the shared prompt and the same answer checks.
  let body;
  result = await scan.estimate({ image: 'data:image/jpeg;base64,c3ludGhldGlj', hint: 'rice' }, { key: 'synthetic-test-token', fetcher: async (url, init) => { request = { url, ...init }; body = JSON.parse(init.body); return reply({ choices: [{ message: { content: JSON.stringify(meal) } }] }); } });
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions'); assert.equal(request.headers.Authorization, 'Bearer synthetic-test-token');
  assert.equal(body.model, 'gpt-4o-mini'); assert.equal(body.store, false); assert.equal(body.response_format.type, 'json_object'); assert.equal(body.messages[0].content, scan.PROMPT); assert.match(scan.PROMPT, /metric/);
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,c3ludGhldGlj'); assert.equal(result.via, 'key'); assert.equal(result.meal.kcal, 640);
  result = await scan.estimate({ hint: 'rice' }, { ...scan.settings(store({ 'rec-calories-ai-key': 'synthetic-test-token' })), fetcher: async () => reply({ choices: [{ message: { content: JSON.stringify(meal) } }] }) });
  assert.equal(result.via, 'key', 'the settings object routes to the own key');
  await scan.estimate({ hint: 'Chicken, rice and broccoli' }, { key: 'synthetic-test-token', fetcher: async (url, init) => { body = JSON.parse(init.body); return reply({ choices: [{ message: { content: JSON.stringify(meal) } }] }); } });
  assert.ok(JSON.stringify(body.messages[1]).includes('Chicken, rice and broccoli')); assert.ok(!JSON.stringify(body.messages[1]).includes('image_url'));
  await assert.rejects(scan.estimate({ hint: 'x' }, { key: 'synthetic-test-token', fetcher: async () => reply({}, 401) }), e => e.kind === 'key' && /OpenAI/.test(e.message));
  await assert.rejects(scan.estimate({ hint: 'x' }, { key: 'synthetic-test-token', fetcher: async () => reply({ choices: [{ message: { content: 'broken json' } }] }) }), e => e.kind === 'parse');
  console.log('PASS scan9: routes (built-in https proxy only with a token, own address without one, proxy before own key, none), URL rules and /estimate + /health, setup links (whole link, hash, bare, token-only, junk), request contract (image, text, hint, metric, token header, no cookies, no referrer), _g/grams answers, items-only meals, dropped broken lines, "Not food", typed gentle failures (offline/CORS, 401/403, 413, 429, 502/500/504, 404, junk), 100 s timeout vs cancel, one busy retry with status, cancel mid-pause, health, token check (400 ok / 401 rejected / health only without a token), own-key contract with the shared prompt. No real AI call made.');
})().catch(error => { console.error(error); process.exitCode = 1; });
