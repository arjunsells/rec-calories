// Synthetic frozen-session and stable sheet sizing regressions; no external services.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { serve, launch, IPHONE } = require('./harness.cjs');
const baseline = process.argv.includes('--baseline');
const previous = new Map(baseline ? ['ux12.js', 'theme12.css'].map(p => ['/' + p, execFileSync('git', ['show', '0a90096:' + p], { encoding: 'utf8' })]) : []);
(async () => {
  const server = await serve(8115, { handler: (p, res) => {
    if (!previous.has(p)) return false;
    res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/css' }); res.end(previous.get(p)); return true;
  } });
  const browser = await launch(), failures = [];
  let activePage;
  const check = async (name, fn) => {
    try { await fn(); console.log('PASS ' + name); }
    catch (e) {
      failures.push(name); console.error('FAIL ' + name + ': ' + e.message);
      await activePage.evaluate(() => { CHADUX.closeSheets(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelector('#synthetic-dialog')?.remove(); });
      await activePage.waitForTimeout(450);
    }
  };
  try {
    for (const [width, height] of [[393, 852], [375, 667]]) for (const colorScheme of ['light', 'dark']) {
      const label = `${width}x${height} ${colorScheme}`;
      const context = await browser.newContext({ ...IPHONE, viewport: { width, height }, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = activePage = await context.newPage();
        await page.goto('http://127.0.0.1:8115/');
        await page.waitForFunction(() => window.CHADUX && window.CHADScan12);
        await page.evaluate(() => {
          document.documentElement.style.setProperty('--ch-sat', '59px');
          const b = document.createElement('button'); b.id = 'synthetic-open'; b.textContent = 'Synthetic open';
          b.onclick = () => CHADUX.detail('Synthetic sheet', [document.createElement('input')]);
          document.querySelector('main').prepend(b);
        });
        const event = kind => page.evaluate(kind => {
          if (kind === 'pageshow') dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          else if (kind === 'DOMContentLoaded') document.dispatchEvent(new Event(kind));
          else { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }
        }, kind);
        const clear = async () => {
          assert.equal(await page.locator('dialog[open],dialog:modal,[data-shield]').count(), 0, 'no modal, native backdrop or shield');
          assert(await page.evaluate(() => [...document.querySelectorAll('dialog')].every(d => getComputedStyle(d).display === 'none')), 'closed dialogs hidden');
          assert(await page.evaluate(() => { const b = document.querySelector('#synthetic-open'), r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'page receives hit tests');
        };
        await check(label + ' tiny viewport preserves minimum', async () => {
          await page.locator('#synthetic-open').click();
          await page.evaluate(() => {
            document.activeElement.blur();
            Object.defineProperty(visualViewport, 'height', { configurable: true, value: 120 });
            visualViewport.dispatchEvent(new Event('resize'));
          });
          const r = await page.locator('#detail-sheet').boundingBox();
          assert(r.height >= Math.min(320, height * .85) - 1, 'sheet meets minimum height');
          assert(r.y >= 59 && r.y + r.height <= height, 'sheet fully inside safe viewport');
          await page.locator('#detail-sheet input').focus();
          for (const vvHeight of [120, 400]) {
            await page.evaluate(vvHeight => {
              Object.defineProperty(visualViewport, 'height', { configurable: true, value: vvHeight });
              visualViewport.dispatchEvent(new Event('resize'));
            }, vvHeight);
            const focused = await page.locator('#detail-sheet').boundingBox();
            assert(Math.abs(focused.height - r.height) <= 1, 'keyboard lift never resizes sheet');
            assert(focused.y >= 59 && focused.y + focused.height <= height, 'focused sheet stays on screen');
          }
          await page.evaluate(() => CHADUX.closeSheets());
        });
        for (const kind of ['DOMContentLoaded', 'pageshow', 'visible']) {
          await check(label + ' raw restored dialogs close on ' + kind, async () => {
            await page.evaluate(() => {
              const d = document.querySelector('#detail-sheet'); d.showModal();
              d.style.transform = 'translateY(400px)'; d.style.setProperty('--drag', '.8'); d.classList.add('is-dragging');
              const other = document.createElement('dialog'); other.id = 'synthetic-dialog'; document.body.append(other); other.showModal();
              CHADUX.shield();
            });
            await event(kind); await clear();
            assert(await page.evaluate(() => [...document.querySelectorAll('dialog')].every(d => !d.style.transform && !d.style.getPropertyValue('--drag') && !d.matches('.is-opening,.is-closing,.is-dragging'))));
            await page.locator('#synthetic-dialog').evaluate(d => d.remove());
          });
          await check(label + ' recent real tap survives ' + kind, async () => {
            await page.locator('#synthetic-open').click(); await event(kind);
            assert.equal(await page.locator('#detail-sheet[open]').count(), 1, 'recent user sheet retained');
            await page.evaluate(() => CHADUX.closeSheets());
          });
        }
        await check(label + ' expired real tap closes', async () => {
          await page.locator('#synthetic-open').click(); await page.waitForTimeout(2050);
          await event('pageshow'); await clear();
        });
        await check(label + ' synthetic click grants no grace', async () => {
          await page.locator('#synthetic-open').evaluate(b => b.click());
          await event('visible'); await clear();
        });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  assert.deepEqual(failures, [], baseline ? 'JOB12e2 baseline failures (expected)' : 'sheet lifecycle regressions');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
