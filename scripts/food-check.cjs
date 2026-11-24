// Open Food Facts client with stubbed fetchers and an in-memory store. No network, no real storage.
const assert = require('node:assert/strict'), food = require('../food9.js');
const product = { code: '1', product_name: 'YoPRO synthetic test', brands: 'Synthetic', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 10, carbohydrates_100g: 5, fat_100g: 2 } };
const ok = products => ({ ok: true, json: async () => ({ products }) });
const busy = () => ({ ok: false, status: 503 });
const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const host = url => new URL(url).host + new URL(url).pathname;
const AU = 'au.openfoodfacts.org/cgi/search.pl', WORLD = 'world.openfoodfacts.org/cgi/search.pl', SAL = 'search.openfoodfacts.org/search', V2 = 'au.openfoodfacts.org/api/v2/search';
const base = () => ({ storage: store(), sleep: async () => {}, online: true });

(async () => {
  // 1. First endpoint answers: one request, Australian index first, full-text CGI search with the expected fields.
  let requests = [], opts = base();
  let found = await food.find('yopro', { ...opts, fetcher: async (url, init) => { requests.push(url); assert.ok(init.signal instanceof AbortSignal); return ok([product]); } });
  assert.equal(requests.length, 1); assert.equal(host(requests[0]), AU); assert.equal(found.from, 'network'); assert.equal(found.endpoint, 'au'); assert.equal(found.items[0].source, 'search');
  let url = new URL(requests[0]);
  assert.equal(url.searchParams.get('search_terms'), 'yopro'); assert.equal(url.searchParams.get('page_size'), '20'); assert.ok(url.searchParams.get('fields').includes('nutriments')); assert.equal(url.searchParams.get('json'), '1');

  // 2. The answer is remembered: the same query (any case or spacing) costs no request, in memory or after a reload.
  requests = [];
  found = await food.find('  YoPRO ', { ...opts, fetcher: async () => { throw Error('must not fetch'); } });
  assert.equal(found.from, 'cache'); assert.equal(found.items.length, 1);
  const persisted = JSON.parse(opts.storage.m.get(food.CACHE_KEY));
  assert.equal(persisted.v, 1); assert.equal(persisted.q.yopro.items[0].name, 'YoPRO synthetic test');
  const reloaded = store(); reloaded.m.set(food.CACHE_KEY, opts.storage.m.get(food.CACHE_KEY));
  found = await food.find('yopro', { storage: reloaded, online: true, sleep: async () => {}, fetcher: async () => { throw Error('must not fetch after reload'); } });
  assert.equal(found.from, 'cache'); assert.deepEqual(food.recent(6, { storage: reloaded }), ['yopro']);
  // fresh: true forces the network.
  found = await food.find('yopro', { storage: reloaded, online: true, fresh: true, sleep: async () => {}, fetcher: async url => { requests.push(url); return ok([product]); } });
  assert.equal(found.from, 'network'); assert.equal(requests.length, 1);

  // 3. Every 503 pattern recovers: the chain is au, world, (back off) au, world, (back off) world.
  for (let success = 0; success < 5; success++) {
    requests = []; const waits = []; opts = base();
    found = await food.find('yopro', { ...opts, sleep: async ms => { waits.push(ms); }, fetcher: async url => { requests.push(host(url)); return requests.length === success + 1 ? ok([product]) : busy(); } });
    assert.deepEqual(requests, [AU, WORLD, AU, WORLD, WORLD].slice(0, success + 1));
    assert.deepEqual(waits, [[], [], [600], [600], [600, 1300]][success], 'backoff before retry rounds');
    assert.equal(found.attempts.filter(a => !a.ok).length, success); assert.equal(found.items.length, 1);
  }
  // CORS failures (TypeError), timeouts and broken JSON are retried the same way.
  for (const failure of [() => { throw new TypeError('Failed to fetch'); }, () => { throw Object.assign(Error('timeout'), { name: 'AbortError' }); }, () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } })]) {
    requests = [];
    found = await food.find('yopro', { ...base(), fetcher: async url => { requests.push(url); return requests.length < 3 ? failure() : ok([product]); } });
    assert.equal(requests.length, 3); assert.equal(found.items.length, 1);
  }

  // 4. No Australian match widens to the world index; an empty world answer is final (no retries, no extra hosts).
  requests = [];
  found = await food.find('rare thing', { ...base(), fetcher: async url => { requests.push(host(url)); return ok(requests.length === 1 ? [] : [product]); } });
  assert.deepEqual(requests, [AU, WORLD]); assert.equal(found.endpoint, 'world');
  requests = []; opts = base();
  found = await food.find('nothing here', { ...opts, fetcher: async url => { requests.push(host(url)); return ok([]); } });
  assert.deepEqual(requests, [AU, WORLD]); assert.deepEqual(found.items, []);
  assert.equal(JSON.parse(opts.storage.m.get(food.CACHE_KEY)).q['nothing here'], undefined, 'empty answers are not cached');
  // Products without complete nutrition are dropped; duplicates collapse.
  requests = [];
  found = await food.find('mixed', { ...base(), fetcher: async () => ok([{ product_name: 'No nutrition' }, product, { ...product }, { ...product, product_name: 'Second' }]) });
  assert.deepEqual(found.items.map(i => i.name), ['YoPRO synthetic test', 'Second']);

  // 5. Everything down: seven requests at most, then an honest error that points to Quick add.
  requests = []; opts = base();
  await assert.rejects(food.find('yopro', { ...opts, fetcher: async url => { requests.push(host(url)); throw new TypeError('Failed to fetch'); } }), error => {
    assert.equal(error.kind, 'unavailable'); assert.match(error.message, /Quick add/); assert.match(error.message, /unavailable right now/); assert.equal(error.attempts.length, 7); return true;
  });
  assert.deepEqual(requests, [AU, WORLD, AU, WORLD, WORLD, SAL, V2]);
  // search-a-licious has no CORS headers today: once it fails it is not asked again for a day...
  requests = [];
  await assert.rejects(food.find('other', { ...opts, fetcher: async url => { requests.push(host(url)); return busy(); } }), /unavailable/);
  assert.equal(requests.includes(SAL), false); assert.equal(requests.length, 6);
  // ...and is probed again after 24 hours.
  requests = []; const later = Date.now() + 25 * 3600e3;
  await assert.rejects(food.find('third', { ...opts, now: () => later, fetcher: async url => { requests.push(host(url)); return busy(); } }), /unavailable/);
  assert.equal(requests.includes(SAL), true);
  // The day it answers it moves to the front of the queue.
  requests = []; opts = base();
  found = await food.find('yopro', { ...opts, fetcher: async url => { requests.push(host(url)); return host(url) === SAL ? { ok: true, json: async () => ({ hits: [product] }) } : busy(); } });
  assert.equal(found.endpoint, 'sal'); assert.equal(requests.at(-1), SAL);
  requests = [];
  found = await food.find('again', { ...opts, fetcher: async url => { requests.push(host(url)); return { ok: true, json: async () => ({ hits: [product], products: [product] }) }; } });
  assert.deepEqual(requests, [SAL]);

  // 6. The v2 endpoint ignores search terms, so only real name matches count and it cannot fake an empty answer.
  requests = [];
  found = await food.find('yopro', { ...base(), fetcher: async url => { requests.push(host(url)); return host(url) === V2 ? ok([{ ...product, product_name: 'Unrelated popular food', brands: '' }, product]) : busy(); } });
  assert.equal(found.endpoint, 'v2'); assert.deepEqual(found.items.map(i => i.name), ['YoPRO synthetic test']);
  await assert.rejects(food.find('yopro', { ...base(), fetcher: async url => host(url) === V2 ? ok([{ ...product, product_name: 'Unrelated popular food', brands: '' }]) : busy() }), /unavailable/);
  const encoded = []; await food.find('up&go', { ...base(), fetcher: async url => { encoded.push(url); return ok([{ ...product, product_name: 'UP&GO' }]); } });
  assert.equal(new URL(encoded[0]).searchParams.get('search_terms'), 'up&go');

  // 7. Offline: no request at all. Saved results still open; otherwise a clear message.
  opts = base(); await food.find('yopro', { ...opts, fetcher: async () => ok([product]) });
  found = await food.find('yopro', { ...opts, online: false, fresh: true, fetcher: async () => { throw Error('must not fetch offline'); } });
  assert.equal(found.from, 'stale');
  await assert.rejects(food.find('never searched', { ...opts, online: false, fetcher: async () => { throw Error('must not fetch offline'); } }), error => error.kind === 'offline' && /offline/i.test(error.message) && /Quick add/.test(error.message));
  // Expired results are refreshed, but still shown if the refresh fails.
  const old = Date.now() + 8 * 864e5;
  found = await food.find('yopro', { ...opts, now: () => old, fetcher: async () => busy() });
  assert.equal(found.from, 'stale'); assert.equal(found.items.length, 1);
  found = await food.find('yopro', { ...opts, now: () => old, fetcher: async () => ok([{ ...product, product_name: 'YoPRO refreshed' }]) });
  assert.equal(found.from, 'network'); assert.equal(found.items[0].name, 'YoPRO refreshed');

  // 8. Cancelling (a newer keystroke) stops the chain immediately and is never reported as a failure.
  requests = []; const controller = new AbortController();
  await assert.rejects(food.find('cancel me', { ...base(), signal: controller.signal, fetcher: (url, init) => new Promise((_, reject) => { requests.push(url); init.signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' }))); setTimeout(() => controller.abort(), 5); }) }), error => error.kind === 'cancelled');
  assert.equal(requests.length, 1);
  const done = new AbortController(); done.abort();
  await assert.rejects(food.find('already cancelled', { ...base(), signal: done.signal, fetcher: async () => { throw Error('must not fetch'); } }), error => error.kind === 'cancelled');
  // A request that never answers is cut off by the timeout and the next host is tried.
  requests = [];
  found = await food.find('slow', { ...base(), timeout: 20, fetcher: (url, init) => { requests.push(url); return requests.length === 1 ? new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' })))) : Promise.resolve(ok([product])); } });
  assert.equal(requests.length, 2); assert.equal(found.attempts[0].kind, 'timeout');

  // 9. The cache is bounded, tolerates corruption and never throws when storage is full or missing.
  opts = base();
  for (let i = 0; i < 30; i++) await food.find('query ' + i, { ...opts, now: () => 1e12 + i, fetcher: async () => ok(Array.from({ length: 20 }, (_, n) => ({ ...product, product_name: 'Item ' + n }))) });
  const bounded = JSON.parse(opts.storage.m.get(food.CACHE_KEY));
  assert.equal(Object.keys(bounded.q).length, 24); assert.ok(bounded.q['query 29'] && !bounded.q['query 0']); assert.equal(bounded.q['query 29'].items.length, 15);
  assert.ok(opts.storage.m.get(food.CACHE_KEY).length < 120000, 'cache stays small');
  const corrupt = store(); corrupt.m.set(food.CACHE_KEY, '{broken');
  assert.equal((await food.find('yopro', { storage: corrupt, online: true, sleep: async () => {}, fetcher: async () => ok([product]) })).from, 'network');
  const full = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => {} };
  assert.equal((await food.find('yopro', { storage: full, online: true, sleep: async () => {}, fetcher: async () => ok([product]) })).items.length, 1);
  assert.equal((await food.find('yopro', { storage: null, online: true, sleep: async () => {}, fetcher: async () => ok([product]) })).items.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(opts.storage.m.get(food.CACHE_KEY))).sort(), ['c', 'meta', 'q', 'v'], 'the cache holds search data only');

  // 10. The array-returning search() keeps working for callers that only want items.
  const items = await food.search('cereal', async () => ok([product]), base());
  assert.equal(items[0].source, 'search');
  await assert.rejects(food.search('a', () => { throw Error('Must not fetch'); }, base()), /two letters/);

  // 11. Barcode lookup: retry across hosts, remember the product, definitive answers are not retried.
  requests = []; opts = base(); let waits = [];
  let item = await food.lookup('12345678', async url => { requests.push(new URL(url).host); return requests.length < 3 ? busy() : { ok: true, json: async () => ({ status: 1, product }) }; }, { ...opts, sleep: async ms => { waits.push(ms); } });
  assert.equal(item.kcal, 100); assert.equal(item.code, '12345678'); assert.deepEqual(requests, ['world.openfoodfacts.org', 'au.openfoodfacts.org', 'world.openfoodfacts.org']); assert.deepEqual(waits, [500, 1100]);
  item = await food.lookup('12345678', async () => { throw Error('must not fetch: cached'); }, opts);
  assert.equal(item.kcal, 100);
  requests = [];
  await assert.rejects(food.lookup('87654321', async url => { requests.push(url); return { ok: true, json: async () => ({ status: 0 }) }; }, base()), /not found/); assert.equal(requests.length, 1);
  await assert.rejects(food.lookup('87654321', async () => ({ ok: true, json: async () => ({ status: 1, product: { product_name: 'x' } }) }), base()), /incomplete nutrition/);
  requests = [];
  await assert.rejects(food.lookup('87654321', async url => { requests.push(url); return busy(); }, base()), /busy/); assert.equal(requests.length, 3);
  await assert.rejects(food.lookup('87654321', async () => { throw new TypeError('offline'); }, base()), /Could not reach/);
  await assert.rejects(food.lookup('x', () => { throw Error('Must not fetch'); }, base()), /digits/);
  await assert.rejects(food.lookup('87654321', () => { throw Error('must not fetch offline'); }, { ...base(), online: false }), error => error.kind === 'offline');
  assert.equal((await food.lookup('12345678', () => { throw Error('must not fetch offline'); }, { ...opts, online: false, fresh: true })).kcal, 100);

  // v9: what comes back from Open Food Facts is shown in metric only.
  found = await food.find('synthetic metric', { ...base(), fetcher: async () => ok([{ ...product, code: '9', product_name: 'Synthetic US cereal', serving_size: '1 cup (30 g)', serving_quantity: 30 }, { ...product, code: '10', product_name: 'Synthetic soda', serving_size: '12 fl oz (355 ml)' }]) });
  assert.deepEqual(found.items.map(i => i.portion), ['30 g', '355 mL']);

  console.log('PASS OFF client: AU-first CGI chain, 503/CORS/timeout/bad-JSON retries with 600 ms and 1.3 s backoff, world widening, final empty answer, 7-request ceiling, search-a-licious probe/skip/promotion, v2 name guard, memory and persisted cache, forced refresh, stale-on-error, offline message with Quick add, cancellation, timeout, bounded and fault-tolerant cache, barcode retry/cache/definitive answers.');
})().catch(e => { console.error(e); process.exitCode = 1; });
