// Synthetic, event-driven draft recovery; --baseline serves the exact v12d scan12.js from Git.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { serve, launch, IPHONE } = require('./harness.cjs');
const baseline = process.argv.includes('--baseline');
const old = baseline && execFileSync('git', ['show', '5ec359c:scan12.js'], { encoding: 'utf8' });
(async () => {
  const server = await serve(8113, { handler: (pathname, res) => {
    if (!baseline || pathname !== '/scan12.js') return false;
    res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(old); return true;
  } });
  const browser = await launch(), failures = [];
  async function test(name, fn) {
    const context = await browser.newContext({ ...IPHONE, viewport: { width: 393, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await context.addInitScript(() => {
        localStorage.setItem('chad.aiProxyUrl', location.origin);
        const original = window.fetch;
        window.__calls = 0; window.__fail = true;
        window.fetch = (url, ...args) => {
          if (String(url).endsWith('/estimate')) {
            window.__calls++;
            if (window.__fail) return Promise.reject(new TypeError('WebKit encountered an internal error'));
            return Promise.resolve(new Response(JSON.stringify({ name: 'Synthetic meal', kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 }), { headers: { 'Content-Type': 'application/json' } }));
          }
          if (String(url).endsWith('/health')) return Promise.resolve(new Response('{"ok":true}'));
          return original(url, ...args);
        };
        // Deliberately stale iOS connectivity flag: an online event must still trigger recovery.
        window.__staleOffline = false;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !window.__staleOffline });
      });
      await context.clock.install({ time: new Date('2026-11-24T12:00:00+09:30') });
      await context.clock.pauseAt(new Date('2026-11-24T12:00:01+09:30'));
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:8113/');
      await page.waitForFunction(() => window.CHADScan12);
      await page.evaluate(async () => {
        const db = await new Promise(r => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => r(q.result); });
        await new Promise(r => {
          const t = db.transaction(['photos', 'drafts'], 'readwrite');
          t.objectStore('photos').put({ image: 'data:image/jpeg;base64,c3ludGhldGlj', thumbnail: '' }, 'synthetic-photo');
          t.objectStore('drafts').put({ id: 'synthetic-retry', photoId: 'synthetic-photo', day: CHADUX.dateKey(), at: Date.now() - 600000, desc: 'Synthetic meal', status: 'error', errorKind: 'network', lastAttemptAt: Date.now() - 1000 });
          t.oncomplete = r;
        });
      });
      await fn(page);
      assert.equal(await page.locator('dialog[open]').count(), 0, 'background recovery opens no modal');
      console.log('PASS ' + name);
    } catch (e) { failures.push(name + ': ' + e.message); console.error('FAIL ' + name + ': ' + e.message); }
    finally { await context.close(); }
  }
  const settle = page => page.waitForTimeout(200);
  const draft = page => page.evaluate(() => CHADScan12.drafts()[0]);
  const trigger = (page, event) => page.evaluate(event => event === 'online' ? dispatchEvent(new Event(event)) : document.dispatchEvent(new Event(event)), event);
  try {
    await test('reload retries recent attempt once and persists new attempt time', async page => {
      await page.reload(); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 1);
      const d = await draft(page); assert.equal(d.errorKind, 'network', 'WebKit TypeError maps to network');
      assert.equal(d.lastAttemptAt, await page.evaluate(() => Date.now()));
      const stored = await page.evaluate(async () => {
        const db = await new Promise(r => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => r(q.result); });
        return new Promise(r => { const q = db.transaction('drafts').objectStore('drafts').get('synthetic-retry'); q.onsuccess = () => r(q.result.lastAttemptAt); });
      });
      assert.equal(stored, d.lastAttemptAt);
      await page.clock.runFor(90000); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 1, 'a failure alone never creates a polling/retry loop');
    });
    await test('offline failure then online schedules exactly one retry at last-attempt cooldown', async page => {
      await page.reload(); await settle(page);
      await page.evaluate(() => { __calls = 0; __fail = false; __staleOffline = true; });
      await trigger(page, 'online'); await trigger(page, 'online'); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 0, 'second attempt within 30 seconds blocked');
      await page.clock.runFor(29999); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 0);
      await page.clock.runFor(1); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 1, 'throttled online event eventually retries without another event');
      assert.equal((await draft(page)).status, 'ready');
    });
    await test('visibility retries from last attempt rather than creation time', async page => {
      await page.reload(); await settle(page);
      await page.clock.runFor(30000);
      await page.evaluate(() => { __calls = 0; __fail = false; });
      await trigger(page, 'visibilitychange'); await settle(page);
      assert.equal(await page.evaluate(() => __calls), 1);
      assert.equal((await draft(page)).status, 'ready');
    });
    for (const kind of ['off', 'failed', 'http', 'timeout', 'interrupted', 'auth']) {
      await test('startup eligibility ' + kind, async page => {
        await page.evaluate(async kind => {
          const db = await new Promise(r => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => r(q.result); });
          await new Promise(r => { const t = db.transaction('drafts', 'readwrite'); const s = t.objectStore('drafts'); const q = s.get('synthetic-retry'); q.onsuccess = () => s.put({ ...q.result, errorKind: kind, status: kind === 'interrupted' ? 'pending' : 'error' }); t.oncomplete = r; });
        }, kind);
        await page.reload(); await settle(page);
        assert.equal(await page.evaluate(() => __calls), kind === 'auth' ? 0 : 1);
        if (kind === 'auth') assert.doesNotMatch(await page.locator('#recent12').innerText(), /Can’t reach PC/);
      });
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  assert.deepEqual(failures, [], baseline ? 'v12d baseline regression failures (expected)' : 'draft retry regressions');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
