// Synthetic standalone restoration, stale visual viewport and draft recovery. No external AI.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { serve, launch, IPHONE } = require('./harness.cjs');
const baseline = process.argv.includes('--baseline');
const previous = new Map(baseline ? ['ux12.js', 'scan12.js', 'app12.js', 'theme12.css'].map(p => ['/' + p, execFileSync('git', ['show', '4083ffa:' + p], { encoding: 'utf8' })]) : []);
(async () => {
  const server = await serve(8114, { handler: (p, res) => {
    const body = p === '/seed.html' ? '<!doctype html><title>Synthetic storage seed</title>' : previous.get(p);
    if (body === undefined) return false;
    res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(body); return true;
  } });
  const browser = await launch(), failures = [];
  async function check(name, fn) {
    try { await fn(); console.log('PASS ' + name); }
    catch (e) { failures.push(name); console.error('FAIL ' + name + ': ' + e.message); }
  }
  try {
    for (const [width, height] of [[393, 852], [375, 667]]) for (const colorScheme of ['light', 'dark']) {
      const label = `${width}x${height} ${colorScheme}`;
      const context = await browser.newContext({ ...IPHONE, viewport: { width, height }, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'standalone', { value: true });
          const safe = () => { const s = document.createElement('style'); s.textContent = ':root{--ch-sat:59px;--ch-sab:34px}'; document.documentElement.append(s); };
          if (document.documentElement) safe(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); safe(); } }).observe(document, { childList: true });
          window.__vvHeight = 120;
          Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => window.__vvHeight });
          localStorage.setItem('chad.aiProxyUrl', location.origin);
          const fetchOriginal = window.fetch;
          window.fetch = (url, ...args) => {
            if (String(url).endsWith('/estimate')) return new Promise((resolve, reject) => {
              window.__finishEstimate = () => window.__success ? resolve(new Response(JSON.stringify({ name: 'Synthetic food', kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 }), { headers: { 'Content-Type': 'application/json' } })) : reject(new TypeError('Synthetic offline failure'));
              if (!window.__holdEstimate) setTimeout(window.__finishEstimate, 20);
            });
            if (String(url).endsWith('/health')) return Promise.resolve(new Response('{"ok":true}'));
            return fetchOriginal(url, ...args);
          };
        });
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:8114/seed.html');
        await page.evaluate(async () => {
          const db = await new Promise(resolve => {
            const q = indexedDB.open('chad-photos-v12', 1);
            q.onupgradeneeded = () => { q.result.createObjectStore('photos'); q.result.createObjectStore('drafts', { keyPath: 'id' }); };
            q.onsuccess = () => resolve(q.result);
          });
          await new Promise(resolve => {
            const tx = db.transaction(['photos', 'drafts'], 'readwrite');
            tx.objectStore('photos').put({ image: 'data:image/jpeg;base64,c3ludGhldGlj', thumbnail: '' }, 'synthetic-photo');
            const day = new Date(Date.now() + 9.5 * 3600000).toISOString().slice(0, 10); // Darwin calendar day, including future test runs.
            for (const status of ['error', 'pending']) tx.objectStore('drafts').put({ id: 'synthetic-' + status, photoId: 'synthetic-photo', day, at: Date.now() - 60000, status, errorKind: 'network', lastAttemptAt: Date.now() - 1000 });
            tx.oncomplete = resolve;
          }); db.close();
        });
        await page.goto('http://127.0.0.1:8114/');
        await page.waitForFunction(() => window.CHADScan12?.drafts().length === 2 && CHADScan12.drafts().every(d => d.status === 'error'));
        const clear = async () => {
          await page.waitForTimeout(450);
          assert.equal(await page.locator('dialog[open]').count(), 0, 'no modal/backdrop in top layer');
          assert.equal(await page.locator('[data-shield]').count(), 0, 'no interaction shield');
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('dialog')].every(d => getComputedStyle(d).display === 'none')), true, 'closed dialogs removed from layout');
          assert.equal(await page.evaluate(() => {
            const b = document.querySelector('#settings-btn') || document.querySelector('.ch-tabbar button');
            const r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }), true, 'Today controls receive hit tests without a scrim');
        };
        const resume = () => page.evaluate(() => {
          dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
          Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'));
        });
        await check(label + ' seeded load and resume', async () => { await clear(); await resume(); await clear(); });
        await check(label + ' describe stale viewport', async () => {
          await page.evaluate(() => { __vvHeight = innerHeight; visualViewport.dispatchEvent(new Event('resize')); });
          await page.locator('[data-draft="synthetic-error"]').click();
          await page.locator('#n12-describe').click();
          await page.waitForTimeout(100);
          const before = await page.locator('#detail-sheet').boundingBox();
          assert(before.y >= 59 && before.y + before.height <= height + 1, 'tapped sheet inside safe viewport');
          await page.evaluate(() => { document.activeElement.blur(); __vvHeight = 120; visualViewport.dispatchEvent(new Event('resize')); });
          await page.waitForTimeout(50);
          const geometry = await page.evaluate(() => {
            const d = document.querySelector('#detail-sheet'), r = d.getBoundingClientRect();
            const controls = ['describe12', 'describe12-go'].map(id => document.getElementById(id).getBoundingClientRect());
            return { top: r.top, bottom: r.bottom, height: r.height, inner: innerHeight, safe: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ch-sat')) || 0, controls: controls.map(b => ({ top: b.top, bottom: b.bottom })) };
          });
          assert(geometry.top >= geometry.safe && geometry.bottom <= geometry.inner + 1, 'sheet inside safe viewport');
          assert(geometry.height > 280 && geometry.controls.every(r => r.top >= geometry.top && r.bottom <= geometry.bottom), 'textarea and Estimate fully visible');
          await resume(); await clear();
        });
        await check(label + ' frozen camera follow-up cannot reopen', async () => {
          await page.evaluate(() => { CHADUX.closeSheets(); CHADScan12.open('food', { back: () => CHADUX.detail('Obsolete callback', [document.createElement('p')]) }); });
          await page.locator('#camera12-describe').click();
          // Resume before Describe's delayed focus; include interrupted transforms and shield.
          await page.evaluate(() => { const d = document.querySelector('#detail-sheet'); d.style.transform = 'translateY(500px)'; d.style.setProperty('--drag', '.8'); d.classList.add('is-dragging'); CHADUX.shield(); });
          await resume(); await clear();
          assert.equal(await page.evaluate(() => document.activeElement?.id === 'describe12'), false, 'obsolete focus timer cancelled');
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('dialog')].every(d => !d.style.transform && !d.style.getPropertyValue('--drag') && !d.matches('.is-opening,.is-closing,.is-dragging'))), true);
        });
        await check(label + ' in-flight user estimate cannot reopen after resume', async () => {
          await page.evaluate(() => CHADUX.closeSheets());
          await page.locator('[data-draft="synthetic-error"]').click(); await page.locator('#n12-describe').click();
          await page.locator('#describe12').fill('Synthetic chicken and rice');
          await page.evaluate(() => { __holdEstimate = true; __success = true; __finishEstimate = null; });
          await page.locator('#describe12-go').click(); await page.waitForFunction(() => typeof __finishEstimate === 'function');
          await resume(); await page.evaluate(() => __finishEstimate()); await clear();
        });
        await check(label + ' frozen nutrition return cannot reopen', async () => {
          await page.evaluate(() => CHADScan12.openResult({ name: 'Synthetic food', kcal: 200, protein: 10, carbs: 20, fat: 5 }, 'manual', { add: () => CHADUX.detail('Obsolete nutrition return', [document.createElement('p')]) }));
          await resume(); await clear();
        });
        await check(label + ' pending barcode cannot reopen after resume', async () => {
          await page.evaluate(() => {
            CHADUX.closeSheets(); CHADFood.lookup = () => new Promise(resolve => { window.__finishLookup = () => resolve({ name: 'Synthetic barcode food', kcal: 200, protein: 10, carbs: 20, fat: 5 }); });
            CHADUX.openFood('barcode');
          });
          await page.locator('#barcode').fill('9300000000000'); await page.locator('#barcode').press('Enter');
          await page.waitForFunction(() => typeof __finishLookup === 'function');
          await resume(); await page.evaluate(() => __finishLookup()); await clear();
        });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  assert.deepEqual(failures, [], baseline ? 'pre-fix failures (expected)' : 'sheet restoration regressions');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
