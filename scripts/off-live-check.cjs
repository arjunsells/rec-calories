// LIVE Open Food Facts diagnostic (opt-in, not part of run-all): which endpoints a real browser can read from the
// app's origin, with their status and CORS header, and what the shipped food9.js chain does with them right now.
// Isolated headless profile; no account, key or saved user data. Requests are paced (OFF asks for <= 10 searches/min).
//   node scripts/off-live-check.cjs                      from https://arjunsells.github.io/rec-calories/
//   node scripts/off-live-check.cjs http://127.0.0.1:8080/   from another origin serving this folder
const fs = require('node:fs'), path = require('node:path');
const { launch, serve, root } = require('./harness.cjs');
const origin = process.argv[2] || 'https://arjunsells.github.io/rec-calories/';
const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const local = origin.startsWith('http://127.0.0.1:8086') ? await serve(8086) : null, browser = await launch();
  try {
    const page = await browser.newPage(), network = new Map();
    page.on('response', async r => { if (r.url().includes('openfoodfacts.org')) network.set(r.url(), { status: r.status(), acao: (await r.allHeaders().catch(() => ({})))['access-control-allow-origin'] || null }); });
    await page.goto(origin);
    console.log('origin ' + await page.evaluate(() => location.origin) + '   ' + new Date().toISOString());
    const cgi = (host, q) => `https://${host}.openfoodfacts.org/cgi/search.pl?${new URLSearchParams({ search_terms: q, page_size: '20', fields: FIELDS, search_simple: '1', action: 'process', json: '1' })}`;
    const endpoints = q => ({
      'au cgi/search.pl': cgi('au', q), 'world cgi/search.pl': cgi('world', q),
      'search-a-licious': `https://search.openfoodfacts.org/search?${new URLSearchParams({ q, page_size: '20', fields: FIELDS })}`,
      'au api/v2/search': `https://au.openfoodfacts.org/api/v2/search?${new URLSearchParams({ search_terms: q, page_size: '20', fields: FIELDS })}`,
      'world api/v2/product': `https://world.openfoodfacts.org/api/v2/product/9300652010794.json?fields=${FIELDS}`
    });
    const tally = {};
    for (const query of ['yopro', 'up&go']) for (const [name, url] of Object.entries(endpoints(query))) {
      const result = await page.evaluate(async url => {
        const c = new AbortController(), t = setTimeout(() => c.abort(), 8000), started = performance.now();
        try { const r = await fetch(url, { signal: c.signal }), j = await r.json(), list = j.products || j.hits || (j.product ? [j.product] : []); return { readable: true, status: r.status, ms: Math.round(performance.now() - started), items: list.length, first: list.slice(0, 2).map(p => p.product_name || p.product_name_en) }; }
        catch (e) { return { readable: false, ms: Math.round(performance.now() - started), error: e.name + ': ' + e.message }; } finally { clearTimeout(t); }
      }, url);
      const seen = network.get(url) || null;
      (tally[name] ??= []).push(result.readable ? 'ok' : seen ? String(seen.status) : 'blocked');
      console.log(JSON.stringify({ endpoint: name, query, ...result, network: seen }));
      await sleep(6500);
    }
    console.log('SUMMARY readable-from-browser per endpoint: ' + JSON.stringify(tally));
    // The shipped implementation, live, with a fresh cache each time: which endpoint answered and how many tries it took.
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'food9.js'), 'utf8') });
    let answered = 0;
    for (const query of ['weet-bix', 'yopro', 'chobani', 'up&go', 'protein yoghurt']) {
      const outcome = await page.evaluate(async query => {
        CHADFood.clearCache(); const started = performance.now();
        try { const r = await CHADFood.find(query); return { ok: true, ms: Math.round(performance.now() - started), from: r.from, endpoint: r.endpoint, items: r.items.length, first: r.items.slice(0, 2).map(i => i.name + ' ' + i.kcal + ' kcal'), attempts: r.attempts.map(a => a.endpoint + (a.ok ? ':ok' : ':' + a.kind)) }; }
        catch (e) { return { ok: false, ms: Math.round(performance.now() - started), kind: e.kind, message: e.message, attempts: (e.attempts || []).map(a => a.endpoint + ':' + a.kind) }; }
      }, query);
      if (outcome.ok && outcome.items) answered++;
      console.log('CHADFood.find ' + JSON.stringify({ query, ...outcome }));
      await sleep(8000);
    }
    const cached = await page.evaluate(async () => { const started = performance.now(), r = await CHADFood.find('protein yoghurt'); return { from: r.from, ms: Math.round(performance.now() - started), items: r.items.length }; });
    console.log('repeat of the last query ' + JSON.stringify(cached));
    const barcode = await page.evaluate(async () => { try { const i = await CHADFood.lookup('9300652010794'); return { ok: true, name: i.name, kcal: i.kcal, portion: i.portion }; } catch (e) { return { ok: false, kind: e.kind, message: e.message }; } });
    console.log('CHADFood.lookup 9300652010794 ' + JSON.stringify(barcode));
    console.log(`RESULT live: ${answered}/5 searches returned foods through the retry chain; barcode ${barcode.ok ? 'ok' : 'failed'}.`);
  } finally { await browser.close(); local?.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
