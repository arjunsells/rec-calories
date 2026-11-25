// Standalone-like safe areas and initial visibility: never scroll/focus a control before measuring it.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { serve, launch, IPHONE, NOON } = require('./harness.cjs');
const baseline = process.argv.includes('--baseline');
const old = new Map(baseline ? ['index.html', 'theme12.css', 'builder11.js', 'ux12.js'].map(p =>
  ['/' + p, execFileSync('git', ['show', 'e5e3b97:' + p], { encoding: 'utf8' })]) : []);
(async () => {
  const server = await serve(8116, { handler: (p, res) => {
    if (!old.has(p)) return false;
    res.writeHead(200, { 'Content-Type': p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(old.get(p)); return true;
  } });
  const browser = await launch(), failures = [];
  try {
    for (const [width, height] of [[393, 852], [430, 932], [375, 667]]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ ...IPHONE, viewport: { width, height }, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        await page.clock.install({ time: new Date(NOON) });
        await page.goto('http://127.0.0.1:8116/');
        await page.waitForFunction(() => window.CHADBuilder && window.CHADUX);
        await page.evaluate(() => {
          document.documentElement.style.setProperty('--ch-sat', '59px');
          document.documentElement.style.setProperty('--ch-sab', '34px');
          document.documentElement.style.setProperty('--ch-sal', '6px');
          document.documentElement.style.setProperty('--ch-sar', '6px');
        });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#later-toggle').tap();
        for (const [label, selector, title] of [
          ['Quick log + Food', '#add-food', 'Add food'],
          ['meal + Custom', '[data-custom=L]', 'Custom lunch'],
          ['snack + Custom', '[data-custom=P]', 'Custom snack']
        ]) {
          const name = `${width}x${height} ${colorScheme} ${label}`;
          try {
            await page.locator(selector).tap();
            await page.locator('#builder-sheet[open]').waitFor();
            assert.equal(await page.locator('#builder-title').innerText(), title);
            const geometry = await page.evaluate(() => {
              const sheet = document.querySelector('#builder-sheet'), body = document.querySelector('#builder-body');
              const r = sheet.getBoundingClientRect(), b = body.getBoundingClientRect();
              const controls = ['#builder-search', '#builder-ask-go', '#builder-barcode', '#builder-type'].map(q => {
                const el = document.querySelector(q), c = el.getBoundingClientRect();
                return { q, visible: c.width > 0 && c.height > 0 && c.top >= Math.max(r.top, b.top) && c.bottom <= Math.min(r.bottom, b.bottom) && c.left >= b.left && c.right <= b.right };
              });
              return { height: r.height, top: r.top, bottom: r.bottom, vh: innerHeight, scroll: body.scrollTop, controls };
            });
            const issues = [];
            if (geometry.height < geometry.vh * .75) issues.push(`height ${geometry.height.toFixed(1)} < 75%`);
            if (geometry.top < 59 || geometry.bottom > geometry.vh) issues.push('outside safe viewport');
            if (geometry.scroll !== 0) issues.push('body initially scrolled');
            issues.push(...geometry.controls.filter(c => !c.visible).map(c => c.q + ' clipped'));
            assert.deepEqual(issues, [], name);
            // Focused keyboard lift keeps the fixed height and the safe top, even with stale/tiny viewport reports.
            await page.locator('#builder-search').focus();
            for (const vvHeight of [400, 120]) {
              const lifted = await page.evaluate(vvHeight => {
                Object.defineProperty(visualViewport, 'height', { configurable: true, value: vvHeight });
                visualViewport.dispatchEvent(new Event('resize'));
                const r = document.querySelector('#builder-sheet').getBoundingClientRect();
                return { height: r.height, top: r.top, bottom: r.bottom, kb: parseFloat(document.documentElement.style.getPropertyValue('--ch-kb')) };
              }, vvHeight);
              assert(Math.abs(lifted.height - geometry.height) < 1, 'keyboard preserves height');
              assert(lifted.top >= 59 && lifted.bottom <= height, 'keyboard preserves safe bounds');
              assert(vvHeight === 120 ? lifted.kb === 0 : lifted.kb > 0, 'valid keyboard lifts; tiny report is ignored');
            }
            console.log('PASS ' + name);
          } catch (e) { failures.push(name); console.error('FAIL ' + name + ': ' + e.message); }
          finally { await page.evaluate(() => { document.activeElement.blur(); CHADUX.closeSheets(); }); await page.waitForTimeout(400); }
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  assert.deepEqual(failures, [], baseline ? 'e5e3b97 baseline failures (expected)' : 'builder initial height and visibility');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
