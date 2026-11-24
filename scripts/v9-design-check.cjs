// Layout matrix: 393x852 and 375x667, DPR 3, touch, iPhone UA, light and dark, with and without simulated safe areas.
// Every screen and sheet (week strip open, a meal opened from its row, Advanced settings open): 44px targets, no
// horizontal scroll, one tap per action, and a pixel check that nothing ever shows through or collides with the floating
// tab bar and the + button.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, decodePNG, IPHONE, NOON } = require('./harness.cjs');
const shots = path.join(os.tmpdir(), 'chad-v9-qa');

(async () => {
  const server = await serve(8091), browser = await launch();
  try {
    fs.mkdirSync(shots, { recursive: true });
    for (const [width, height] of [[393, 852], [375, 667]]) for (const theme of ['light', 'dark']) for (const safe of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce' }), page = await context.newPage(), errors = watch(page);
      await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8091/');
      if (safe) await page.addStyleTag({ content: ':root{--ch-sat:47px;--ch-sab:34px;--ch-sal:6px;--ch-sar:6px}' });
      const name = width + 'x' + height + ' ' + theme + (safe ? ' safe' : '');
      const check = async label => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' ' + label + ' overflow');
        const bad = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,input:not([type=hidden]),select,textarea')].filter(e => { const r = e.getBoundingClientRect(), w = e.offsetWidth || r.width, h = e.offsetHeight || r.height; return r.width && r.height && getComputedStyle(e).visibility !== 'hidden' && (w < 43.99 || h < 43.99); }).map(e => ({ text: (e.textContent || e.id).trim().slice(0, 40), id: e.id, cls: e.className, w: e.offsetWidth, h: e.offsetHeight })));   // layout size: a press may scale a button for a moment
        assert.deepEqual(bad, [], name + ' ' + label + ' 44px targets');
        // Nothing sticks out of its card: text never overflows the meal cards or the rows.
        const spill = await page.evaluate(() => [...document.querySelectorAll('.ch-meal__hit > *, .ch-cell > *, .ch-qchip__label, .ch-water__val')].filter(e => { const p = e.closest('.ch-meal, .ch-cell, .ch-qchip, .ch-water'); if (!p || !e.getClientRects().length) return false; const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.right > b.right + 1 || a.left < b.left - 1; }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 30)));
        assert.deepEqual(spill, [], name + ' ' + label + ' nothing spills out of its card');
      };
      const tab = view => page.locator(`[data-view=${view}]`).tap();
      assert.equal(await page.evaluate(() => devicePixelRatio), 3);
      assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
      for (const view of ['today', 'training', 'history', 'settings']) {
        await tab(view); await check(view);
        if (view === 'settings') { await page.evaluate(() => document.querySelectorAll('#settings details').forEach(d => d.open = true)); await check('settings open'); }
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        // The last row ends above the fade, not merely above the bar.
        assert.equal(await page.evaluate(() => document.querySelector('.view:not([hidden])').getBoundingClientRect().bottom <= document.querySelector('.ch-dock-scrim').getBoundingClientRect().top), true, name + ' ' + view + ' last row clears the dock fade');
      }
      await tab('today'); await page.evaluate(() => scrollTo(0, 0));
      const header = await page.locator('.date-header').evaluate(e => e.getBoundingClientRect().height); assert.ok(header >= (safe ? 91 : 44));
      // All four macros and the next meal are on the first screen.
      for (const id of ['calorie-ring', 'protein-ring', 'carbs-meter', 'fat-meter']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box.y + box.height <= height - 90, name + ' ' + id + ' on the first screen'); }
      await page.locator('#week-toggle').tap(); await check('week strip open'); await page.locator('#week-toggle').tap();
      await page.evaluate(() => CHADUX.navigate(-1)); await check('past date');
      assert.equal(await page.locator('.date-header .ch-datebar__title').evaluate(e => [...e.querySelectorAll('.ch-eyebrow,h1')].every(n => n.scrollWidth <= n.clientWidth + 1)), true, name + ' header text fits on a past day');
      await page.locator('#return-today').tap();
      await page.locator('[data-meal-row=D]').tap(); await check('a meal opened from its row'); await page.waitForTimeout(420); await page.locator('[data-meal-toggle=D]').tap();
      assert.equal(await page.locator('.ch-slot.is-open').count(), 0, name + ' folded again');
      assert.equal(await page.locator('#today details,#training details').count(), 0);
      await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '.png') });

      // The floating dock: with a card scrolled right behind it, every pixel in and around the bar is identical to the
      // dock over empty page (bar glass, + button, their shadows). Nothing shows through, nothing looks clipped.
      const dock = await page.evaluate(() => { const bar = document.querySelector('.ch-tabbar').getBoundingClientRect(), fab = document.querySelector('#today-scan').getBoundingClientRect(), scrim = document.querySelector('.ch-dock-scrim').getBoundingClientRect(); return { top: bar.top, bottom: bar.bottom, left: bar.left, right: bar.right, fabLeft: fab.left, fabRight: fab.right, fabTop: fab.top, scrimTop: scrim.top }; });
      assert.ok(Math.abs(dock.top - dock.fabTop) < 1 && dock.fabLeft - dock.right >= 8, name + ' bar and + share a row without touching');
      const midY = (dock.top + dock.bottom) / 2, quarter = (dock.right - dock.left) / 4;
      const points = { 'below the bar': [dock.left + quarter * 1.5, Math.min(height - 2, dock.bottom + 5)], 'between the bar and the +': [(dock.right + dock.fabLeft) / 2, midY], 'left of the bar': [Math.max(2, dock.left - 6), midY], 'right of the +': [Math.min(width - 2, dock.fabRight + 6), midY], 'bar top edge': [dock.left + quarter * 2, dock.top + 2], 'through the bar glass': [dock.left + quarter * 2, dock.top + 9], 'through the bar glass, lower': [dock.left + quarter * 3, dock.bottom - 5], 'just above the bar': [dock.left + quarter * 1.5, dock.top - 2] };
      for (const view of ['today', 'training']) {
        await tab(view);
        // v9 pages are short: a test-only spacer above the content lets the last card scroll down behind the bar.
        await page.evaluate(view => { const spacer = document.createElement('div'); spacer.className = 'qa-spacer'; spacer.style.height = '600px'; document.getElementById(view === 'today' ? 'day-page' : 'training-page').prepend(spacer); }, view);
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        const empty = decodePNG(await page.screenshot());
        const moved = await page.evaluate(({ view, top }) => { const card = view === 'today' ? [...document.querySelectorAll('#today .ch-card, #today .ch-list')].filter(n => n.offsetParent).at(-1) : [...document.querySelectorAll('#training .ch-session')].at(-1); scrollBy(0, card.getBoundingClientRect().top - (top - 24)); const r = card.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, { view, top: dock.top });
        assert.ok(moved.top < dock.top && moved.bottom > dock.bottom && moved.left < dock.left + quarter, name + ' ' + view + ' a card sits behind the bar for the pixel check ' + JSON.stringify({ moved, dock }));
        const png = decodePNG(await page.screenshot());
        for (const [label, [x, y]] of Object.entries(points)) { const a = png.at(x * 3, y * 3), b = empty.at(x * 3, y * 3); assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 3), `${name} ${view} ${label}: ${a} with a card behind, ${b} over empty page`); }
        if (view === 'today') await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '-dock.png') });
        await page.evaluate(() => { document.querySelectorAll('.qa-spacer').forEach(n => n.remove()); scrollTo(0, 0); });
      }
      await tab('today');

      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      for (const [selector, verify] of [['[data-slot=L][data-tier=S]', s => s.questsV5['2026-11-24'].picks.L === 'S'], ['[data-water]', s => s.questsV5['2026-11-24'].water === .5], ['[data-quest=steps]', s => s.questsV5['2026-11-24'].steps === true]]) {
        await page.evaluate(() => window.qaTaps = 0); const b = page.locator(selector).first(); await b.scrollIntoViewIfNeeded(); await b.tap();
        assert.equal(await page.evaluate(() => window.qaTaps), 1, name + ' one tap ' + selector); assert.ok(verify(await saved(page)));
      }
      await check('today with a logged meal and toast');
      await tab('training'); await page.evaluate(() => window.qaTaps = 0);
      const exercise = page.locator('.is-today .exercise-toggle').first(); await exercise.scrollIntoViewIfNeeded(); await exercise.tap();
      assert.equal(await page.evaluate(() => window.qaTaps), 1, name + ' one tap exercise'); assert.equal((await saved(page)).questsV5['2026-11-24'].exercises[0], true);
      // The Undo toast floats above the bar, inside the screen.
      const toast = await page.locator('#undo-toast').boundingBox(); assert.ok(toast && toast.y + toast.height <= dock.top - 4 && toast.x >= 8 && toast.x + toast.width <= width - 8, name + ' toast sits above the dock');
      await page.locator('#training-week-toggle').tap(); await check('training week open'); await page.locator('#training-week-toggle').tap();
      await page.locator('#today-scan').tap(); await check('add');
      for (const kind of ['manual', 'camera', 'barcode', 'search']) {
        await page.locator(`[data-add=${kind}]`).tap(); await check(kind + ' sheet');
        const sheet = await page.locator('dialog[open]').boundingBox(); assert.ok(sheet.y >= (safe ? 47 : 0) && sheet.y + sheet.height <= height, name + ' ' + kind + ' sheet fits the screen');
        await page.keyboard.press('Escape'); await page.locator('#today-scan').tap();
      }
      await page.keyboard.press('Escape');
      await tab('today'); await page.locator('.meal-info').first().tap(); await check('meal detail'); await page.keyboard.press('Escape');
      await page.locator('#entries .entry-open').first().count() && await page.locator('#entries .entry-open').first().tap();
      await tab('training'); await page.locator('.is-today .exercise-info').first().tap(); await check('top set'); await page.keyboard.press('Escape');
      await tab('history'); await page.locator('#open-level').tap(); await check('level details'); await page.locator('#close-level').tap();
      assert.deepEqual(errors, [], name + ' errors'); await context.close();
      console.log('PASS ' + name + ': all screens and sheets incl. week strip, opened meal and Advanced, >=44px targets, nothing spills, no overflow, four macros on the first screen, dock pixels clean behind bar and +, last row clears the fade, toast above dock, 4 actions each=1 tap, no JS/console errors');
    }
    console.log('Screenshots outside repo: ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
