'use strict';
// Open Food Facts data: https://world.openfoodfacts.org (ODbL).
// v8: anonymous OFF requests are shed with intermittent 503s, so every lookup retries across hosts with
// backoff, remembers good answers (memory + localStorage) and degrades to saved results or Quick add.
// v9: portions are shown in metric only ("1 cup (240 ml)" -> "240 mL", "2 oz (56 g)" -> "56 g").
((root) => {
  const WORLD = 'https://world.openfoodfacts.org', AU = 'https://au.openfoodfacts.org', SAL = 'https://search.openfoodfacts.org';
  const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
  const CACHE_KEY = 'rec-calories-food-cache-v1';          // separate from the journal: safe to drop at any time
  const DAY = 864e5, TTL = { q: 7 * DAY, c: 30 * DAY }, MAX = { q: 24, c: 40 }, KEEP = 15;
  const TIMEOUT = 6000, BUDGET = 15000;
  const finite = n => n !== null && n !== '' && n !== undefined && Number.isFinite(Number(n)) && Number(n) >= 0;
  const round = n => Math.round((n + Number.EPSILON) * 10) / 10;
  const MESSAGES = {
    input: 'Type at least two letters to search.',
    offline: 'You are offline. Food search needs a connection. Use Quick add to enter the calories from the pack.',
    busy: 'Open Food Facts is busy. Try again in a moment.',
    network: 'Could not reach Open Food Facts. Check your connection.',
    timeout: 'Food lookup timed out. Try again.',
    parse: 'Food lookup returned an unreadable result. Try again.',
    unavailable: 'Food search is unavailable right now. Try again, or use Quick add to enter the package calories.',
    cancelled: 'Search cancelled.'
  };
  const fail = (kind, message, extra) => Object.assign(Error(message || MESSAGES[kind] || MESSAGES.unavailable), { kind }, extra);
  // Metric only. Imperial serving text keeps just its metric part; metric text is tidied ("30g" -> "30 g", "ml" -> "mL").
  const IMPERIAL = /(?:\d|\b)(?:fl\.?\s*oz|oz|ounces?|lbs?|pounds?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|pints?|quarts?|gallons?|inch(?:es)?|ft|feet)\b/i;
  const UNIT = { kg: 'kg', g: 'g', ml: 'mL', l: 'L' };
  const metricAmount = (n, unit) => { const u = unit.toLowerCase(); return u === 'cl' ? `${round(n * 10)} mL` : `${n} ${UNIT[u]}`; };
  function metricPortion(text, grams) {
    const s = String(text || '').replace(/\s+/g, ' ').trim(), found = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
    const fallback = grams ? `${grams} g` : '1 serving';
    if (IMPERIAL.test(s)) return found ? metricAmount(Number(found[1].replace(',', '.')), found[2]) : fallback;
    return s ? s.replace(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/gi, (_, n, u) => metricAmount(Number(n.replace(',', '.')), u)) : fallback;
  }
  const transient = error => ['busy', 'network', 'timeout', 'parse', 'http'].includes(error.kind);

  function normalize(product) {
    if (!product || typeof product !== 'object') return null;
    const n = product.nutriments || {};
    const energy = suffix => finite(n[`energy-kcal_${suffix}`]) ? Number(n[`energy-kcal_${suffix}`]) : finite(n[`energy_${suffix}`]) ? Number(n[`energy_${suffix}`]) / 4.184 : null;
    const values = suffix => ({ kcal: energy(suffix), protein: n[`proteins_${suffix}`], carbs: n[`carbohydrates_${suffix}`], fat: n[`fat_${suffix}`] });
    const complete = values => Object.values(values).every(finite) && Number(values.kcal) > 0;
    const servingText = String(product.serving_size || '').slice(0, 100);
    const quantityMatch = servingText.match(/([\d.]+)\s*(g|ml)\b/i);
    const servingGrams = finite(product.serving_quantity) && Number(product.serving_quantity) > 0 ? Number(product.serving_quantity) : quantityMatch && Number(quantityMatch[1]) > 0 ? Number(quantityMatch[1]) : null;
    let nutrition = values('serving'), basis = 'serving';
    if (!complete(nutrition)) {
      nutrition = values('100g');
      if (!complete(nutrition)) return null;
      if (servingGrams) nutrition = Object.fromEntries(Object.entries(nutrition).map(([k, v]) => [k, Number(v) * servingGrams / 100]));
      else basis = '100g';
    }
    const brand = String(product.brands || '').split(',')[0].trim().slice(0, 40);
    return {
      name: String(product.product_name || product.product_name_en || product.brands || 'Packaged food').slice(0, 80),
      ...Object.fromEntries(Object.entries(nutrition).map(([k, v]) => [k, round(Number(v))])),
      portion: basis === 'serving' ? metricPortion(servingText, servingGrams) : '100 g/mL (check pack)',
      basis, servingGrams: basis === 'serving' ? servingGrams : 100,
      code: String(product.code || ''), source: 'barcode', ...(brand ? { brand } : {})
    };
  }
  function scale(item, multiplier) {
    if (!Number.isFinite(Number(multiplier)) || Number(multiplier) <= 0 || Number(multiplier) > 100) throw Error('Choose a valid portion.');
    return { ...item, ...Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(k => [k, round(item[k] * Number(multiplier))])) };
  }

  /* ---- one request: timeout, caller cancellation, typed failures ---- */
  async function request(url, fetcher = root.fetch, timeoutMs = TIMEOUT, outer) {
    if (outer?.aborted) throw fail('cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    outer?.addEventListener('abort', cancel, { once: true });
    try {
      const response = await fetcher(url, { signal: controller.signal });
      if (!response.ok) throw fail('busy');                       // OFF answers 503 while it sheds anonymous load
      return await response.json();
    } catch (error) {
      if (error.kind) throw error;
      if (error.name === 'AbortError') throw fail(outer?.aborted && !timedOut ? 'cancelled' : 'timeout');   // only the caller cancels
      if (error instanceof SyntaxError) throw fail('parse');
      throw fail('network');                                      // offline, DNS, CORS, or an error page without CORS headers
    } finally { clearTimeout(timer); outer?.removeEventListener('abort', cancel); }
  }
  const pause = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(fail('cancelled'));
    const done = () => { signal?.removeEventListener('abort', stop); resolve(); };
    const stop = () => { clearTimeout(timer); reject(fail('cancelled')); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });

  /* ---- cache: recent answers survive reloads and bad reception ---- */
  let memory = { q: new Map(), c: new Map(), meta: {} }, loadedFrom;
  const storageOf = opts => { if (opts.storage !== undefined) return opts.storage; if (!root.document) return null; try { return root.localStorage || null; } catch { return null; } };
  function load(opts) {
    const storage = storageOf(opts);
    if (loadedFrom === storage) return;
    loadedFrom = storage; memory = { q: new Map(), c: new Map(), meta: {} };
    try {
      const data = JSON.parse(storage?.getItem(CACHE_KEY) || 'null');
      if (!data || data.v !== 1) return;
      for (const [k, e] of Object.entries(data.q || {})) if (e && typeof e.t === 'number' && Array.isArray(e.items)) memory.q.set(k, e);
      for (const [k, e] of Object.entries(data.c || {})) if (e && typeof e.t === 'number' && e.item) memory.c.set(k, e);
      if (data.meta && typeof data.meta === 'object') memory.meta = data.meta;
    } catch { /* a broken cache is an empty cache */ }
  }
  function persist(opts) {
    const storage = storageOf(opts);
    for (const kind of ['q', 'c']) memory[kind] = new Map([...memory[kind]].sort((a, b) => b[1].t - a[1].t).slice(0, MAX[kind]));
    if (!storage) return;
    try { storage.setItem(CACHE_KEY, JSON.stringify({ v: 1, q: Object.fromEntries(memory.q), c: Object.fromEntries(memory.c), meta: memory.meta })); }
    catch { try { storage.removeItem(CACHE_KEY); } catch { /* storage is optional; the journal key is never touched here */ } }
  }
  function clearCache(opts = {}) { loadedFrom = storageOf(opts); memory = { q: new Map(), c: new Map(), meta: {} }; try { loadedFrom?.removeItem(CACHE_KEY); } catch { /* optional */ } }
  function recent(limit = 6, opts = {}) { load(opts); return [...memory.q.values()].sort((a, b) => b.t - a.t).slice(0, limit).map(e => e.q); }
  const offline = opts => opts.online !== undefined ? !opts.online : root.navigator?.onLine === false;
  const compact = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

  /* ---- text search ---- */
  function plan(term, opts) {
    const cgi = host => `${host}/cgi/search.pl?${new URLSearchParams({ search_terms: term, page_size: '20', fields: FIELDS, search_simple: '1', action: 'process', json: '1' })}`;
    const steps = [
      { id: 'au', url: cgi(AU) },                                  // Australian products first: they are what is on the shelf
      { id: 'world', url: cgi(WORLD) },
      { id: 'au', url: cgi(AU), wait: 600 },                       // 503s clear within seconds: back off, go again
      { id: 'world', url: cgi(WORLD) },
      { id: 'world', url: cgi(WORLD), wait: 1300 },
      // search-a-licious: fast and reliable, but it sends no CORS headers today, so a browser cannot read it.
      // It is probed last and at most once a day; the day it starts answering it moves to the front.
      { id: 'sal', url: `${SAL}/search?${new URLSearchParams({ q: term, page_size: '20', fields: FIELDS })}`, pick: r => r.hits },
      // v2 search ignores search_terms and returns popular products; only exact name matches are kept.
      { id: 'v2', url: `${AU}/api/v2/search?${new URLSearchParams({ search_terms: term, page_size: '20', fields: FIELDS })}`, guard: true }
    ];
    const sal = memory.meta.sal, time = (opts.now || Date.now)();
    if (sal?.state === 'ok') return [steps[5], ...steps.slice(0, 5), steps[6]];
    if (sal?.state === 'blocked' && time - sal.t < DAY) return steps.filter(step => step.id !== 'sal');
    return steps;
  }
  async function network(term, opts) {
    const fetcher = opts.fetcher || root.fetch, sleep = opts.sleep || pause, clock = opts.now || Date.now, started = clock();
    const answered = new Set(), attempts = [];
    let lastKind = 'unavailable';
    for (const step of plan(term, opts)) {
      if (answered.has(step.id) || answered.has('world')) continue;        // world is the superset: an empty answer there is final
      if (clock() - started > (opts.budget || BUDGET)) break;
      if (step.wait) { opts.onStatus?.('retry'); await sleep(step.wait, opts.signal); }
      try {
        const result = await request(step.url, fetcher, opts.timeout || TIMEOUT, opts.signal);
        const raw = step.pick ? step.pick(result) : result.products;
        if (!Array.isArray(raw)) throw fail('parse');
        const products = step.guard ? raw.filter(p => compact([p.product_name, p.product_name_en, p.brands].join(' ')).includes(compact(term))) : raw;
        if (step.id === 'sal') memory.meta.sal = { state: 'ok', t: clock() };
        if (!step.guard || !raw.length || products.length) answered.add(step.id);
        const seen = new Set();
        const items = products.map(normalize).filter(Boolean).filter(item => { const key = `${item.name}|${item.kcal}|${item.portion}`; return !seen.has(key) && seen.add(key); });
        attempts.push({ endpoint: step.id, ok: true, items: items.length });
        if (items.length) return { items: items.map(item => ({ ...item, source: 'search' })), endpoint: step.id, attempts };
      } catch (error) {
        if (error.kind === 'cancelled') throw error;
        if (step.id === 'sal') memory.meta.sal = { state: 'blocked', t: clock() };
        lastKind = error.kind || 'unavailable';
        attempts.push({ endpoint: step.id, ok: false, kind: lastKind });
      }
    }
    if (answered.size) return { items: [], endpoint: [...answered][0], attempts };
    throw fail('unavailable', MESSAGES.unavailable, { attempts, cause: lastKind });
  }
  // Rich result: { items, from: 'cache' | 'network' | 'stale', age, endpoint, attempts }
  async function find(query, opts = {}) {
    const term = String(query).trim().replace(/\s+/g, ' ').slice(0, 100);
    if (term.length < 2) throw fail('input');
    load(opts);
    const key = term.toLowerCase(), clock = opts.now || Date.now, hit = memory.q.get(key);
    const saved = from => ({ items: hit.items.map(item => ({ ...item })), from, age: clock() - hit.t, attempts: [] });
    if (hit && !opts.fresh && clock() - hit.t < TTL.q) return saved('cache');
    if (offline(opts)) { if (hit) return saved('stale'); throw fail('offline'); }
    try {
      const result = await network(term, opts);
      if (result.items.length) memory.q.set(key, { t: clock(), q: term, items: result.items.slice(0, KEEP) });
      persist(opts);
      return { ...result, from: 'network', age: 0 };
    } catch (error) {
      if (error.kind !== 'cancelled') persist(opts);
      if (hit && error.kind !== 'cancelled') return saved('stale');
      if (error.kind === 'unavailable' && offline(opts)) throw fail('offline');
      throw error;
    }
  }
  const search = async (query, fetcher, opts = {}) => (await find(query, { ...opts, fetcher: fetcher || opts.fetcher })).items;

  /* ---- barcode lookup ---- */
  async function lookup(code, fetcher, opts = {}) {
    const barcode = String(code).trim();
    if (!/^\d{8,14}$/.test(barcode)) throw fail('input', 'Enter the 8–14 digits below the barcode.');
    load(opts);
    const clock = opts.now || Date.now, sleep = opts.sleep || pause, hit = memory.c.get(barcode);
    if (hit && !opts.fresh && clock() - hit.t < TTL.c) return { ...hit.item };
    if (offline(opts)) { if (hit) return { ...hit.item }; throw fail('offline', 'You are offline. Barcode lookup needs a connection. Use Quick add to enter the calories from the pack.'); }
    const path = `/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
    let last;
    for (const [host, wait] of [[WORLD, 0], [AU, 500], [WORLD, 1100]]) {
      if (wait) await sleep(wait, opts.signal);
      let result;
      try { result = await request(host + path, fetcher || opts.fetcher || root.fetch, opts.timeout || TIMEOUT, opts.signal); }
      catch (error) { if (!transient(error)) throw error; last = error; continue; }
      if (result.status === 0 || !result.product) throw fail('notfound', 'Barcode not found. Try food search or enter it manually.');
      const item = normalize({ ...result.product, code: barcode });
      if (!item) throw fail('incomplete', 'This product has incomplete nutrition. Check the pack and enter it manually.');
      memory.c.set(barcode, { t: clock(), item }); persist(opts);
      return item;
    }
    if (hit) return { ...hit.item };
    throw last;
  }

  /* ---- barcode camera: the 395 kB reader loads on first use (from the offline shell) ---- */
  let reader;
  function loadScanner() {
    if (root.ZXingBrowser) return Promise.resolve(root.ZXingBrowser);
    if (!root.document) return Promise.reject(Error('Barcode scanner is unavailable. Enter the barcode digits below.'));
    reader ||= new Promise((resolve, reject) => {
      const script = root.document.createElement('script');
      script.src = './vendor/zxing-browser.min.js';
      script.onload = () => root.ZXingBrowser ? resolve(root.ZXingBrowser) : reject(Error('Barcode scanner is unavailable. Enter the barcode digits below.'));
      script.onerror = () => { reader = null; script.remove(); reject(Error('Barcode scanner could not load. Enter the barcode digits below.')); };
      root.document.head.append(script);
    });
    return reader;
  }
  async function startScanner(video, onCode) {
    if (!root.navigator?.mediaDevices?.getUserMedia) throw Error('Camera is unavailable. Enter the barcode digits below.');
    const ZXing = await loadScanner();
    video.setAttribute('playsinline', ''); video.muted = true;
    const scanner = new ZXing.BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 1000 });
    try {
      let found = false;
      return await scanner.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (result, error, controls) => {
        if (result && !found && /^\d{8,14}$/.test(result.getText())) {
          found = true; controls.stop(); onCode(result.getText());
        }
      });
    } catch (error) {
      video.srcObject?.getTracks().forEach(track => track.stop());
      throw Error(error.name === 'NotAllowedError' ? 'Camera permission was declined. Enter the barcode digits below.' : 'Could not open the camera. Enter the barcode digits below.');
    }
  }
  const api = { search, find, lookup, normalize, scale, metricPortion, startScanner, loadScanner, recent, clearCache, MESSAGES, CACHE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHADFood = api;
})(globalThis);
