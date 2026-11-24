// Layout matrix: 393x852 and 375x667, DPR 3, touch, iPhone UA, light and dark, with and without simulated safe areas.
// Every screen and sheet (week strip open, a meal opened from its line, Advanced settings open) and Gym mode (exercise,
// rest, finish): 44 px targets everywhere and 56 px in Gym mode (72 px for its main buttons), no horizontal scroll,
// nothing spills out of its card, one tap per action, Gym mode clear of the notch and the home indicator, and a pixel
// check that nothing ever shows through or collides with the floating tab bar and the + button. Pass 2: every visible
// text meets WCAG AA contrast (4.5:1, 3:1 for large text) against what is really behind it, gradients and opacity
// included, in light and dark; and the custom meal builder sheet passes the same checks.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, decodePNG, IPHONE, NOON } = require('./harness.cjs');
const shots = path.join(os.tmpdir(), 'chad-v10-qa');

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
        // Nothing sticks out of its card: text never overflows the meal options, rows, chips or the water card.
        const spill = await page.evaluate(() => [...document.querySelectorAll('.ch-opt__hit > *, .ch-cell > *, .ch-done__label, .ch-water__val, .ch-water__goal, .ch-gymcard__name')].filter(e => { const p = e.closest('.ch-opt, .ch-cell, .ch-done, .ch-water, .ch-gymcard'); if (!p || !e.getClientRects().length) return false; const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.right > b.right + 1 || a.left < b.left - 1; }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 30)));
        assert.deepEqual(spill, [], name + ' ' + label + ' nothing spills out of its card');
        const clipped = await page.evaluate(() => [...document.querySelectorAll('.ch-opt__how')].filter(e => e.getClientRects().length && e.scrollHeight > e.clientHeight + 1).map(e => e.textContent.slice(0, 40)));
        assert.deepEqual(clipped, [], name + ' ' + label + ' every how-to is shown in full');
      };
      // WCAG AA: each element with its own text, against every colour that can be behind it (gradient stops composited
      // from the page down, opacity groups blended with what is under them). Disabled controls are exempt.
      const aa = async label => {
        const low = await page.evaluate(() => {
          const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
          const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
          const mix = (t, u, o) => ({ r: t.r * o + u.r * (1 - o), g: t.g * o + u.g * (1 - o), b: t.b * o + u.b * (1 - o), a: 1 });
          const lum = c => { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
          const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + .05) / (b + .05); };
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
            if (el.closest('svg, script, style, [hidden], dialog:not([open]), .ch-toast, #quests, #history-bars, .chart-values, .ch-sr') || el.closest(':disabled') || el.matches('option, input, textarea, select')) continue;
            if (!el.getClientRects().length) continue;
            const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
            if (document.querySelector('dialog[open]') && !el.closest('dialog[open]')) continue;          // under an open sheet, only the sheet is read
            const chain = []; for (let n = el; n; n = n.parentElement) chain.unshift(n);
            let backs = [{ r: 255, g: 255, b: 255, a: 1 }], under = null, opacity = 1;
            for (const n of chain) {
              const st = getComputedStyle(n), o = Number(st.opacity);
              if (o < 1 && !under) under = backs;
              opacity *= o;
              const bg = parse(st.backgroundColor); if (bg && bg.a > 0) backs = backs.map(c => over(bg, c));
              const img = st.backgroundImage;
              if (img && img !== 'none' && !/url\(/.test(img)) { const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])); if (stops.length) backs = stops.flatMap(t => backs.map(c => over(t, c))).slice(0, 96); }
            }
            if (opacity <= .05) continue;
            const ink = parse(cs.color); if (!ink || ink.a === 0) continue;
            const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700), need = large ? 3 : 4.5;
            let worst = 99;
            for (const b of backs) { const text = over(ink, b), seen = under ? under.map(u => [mix(text, u, opacity), mix(b, u, opacity)]) : [[text, b]]; for (const [t, g] of seen) worst = Math.min(worst, ratio(t, g)); }
            if (worst < need - 0.005) out.push((el.id ? '#' + el.id : String(el.className) || el.tagName) + ' "' + el.textContent.trim().slice(0, 24) + '" ' + worst.toFixed(2) + ' < ' + need);
          }
          return out;
        });
        assert.deepEqual(low, [], name + ' ' + label + ': WCAG AA text contrast');
      };
      // Gym mode: 56 px and up, 72 px for the main buttons, on screen and clear of the notch and the home indicator.
      const gymCheck = async label => {
        const out = await page.evaluate(({ sat, sab }) => {
          const vh = innerHeight, vw = innerWidth, bad = [], off = [];
          for (const b of document.querySelectorAll('#gym button')) {
            if (!b.getClientRects().length || getComputedStyle(b).visibility === 'hidden') continue;
            const r = b.getBoundingClientRect(), main = b.matches('#gym-go, [data-gym=done]');
            if (b.offsetWidth < 56 || b.offsetHeight < (main ? 72 : 56)) bad.push((b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24) + ' ' + b.offsetWidth + 'x' + b.offsetHeight);
            if (r.top < sat - 1 || r.bottom > vh - sab + 1 || r.left < 0 || r.right > vw) off.push((b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24) + ' ' + JSON.stringify([r.top, r.bottom, r.left, r.right].map(Math.round)));
          }
          return { bad, off, wide: document.documentElement.scrollWidth > vw };
        }, { sat: safe ? 47 : 0, sab: safe ? 34 : 0 });
        assert.deepEqual(out.bad, [], name + ' Gym mode ' + label + ': 56 px targets, 72 px main buttons'); assert.deepEqual(out.off, [], name + ' Gym mode ' + label + ': every control on screen, clear of the notch and home indicator'); assert.equal(out.wide, false);
      };
      const tab = view => page.locator(`[data-view=${view}]`).tap();
      assert.equal(await page.evaluate(() => devicePixelRatio), 3);
      assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
      for (const view of ['today', 'training', 'history', 'settings']) {
        await tab(view); await check(view); await aa(view);
        if (view === 'settings') { await page.evaluate(() => document.querySelectorAll('#settings details').forEach(d => d.open = true)); await check('settings open'); }
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        assert.equal(await page.evaluate(() => document.querySelector('.view:not([hidden])').getBoundingClientRect().bottom <= document.querySelector('.ch-dock-scrim').getBoundingClientRect().top), true, name + ' ' + view + ' last row clears the dock fade');
      }
      await tab('today'); await page.evaluate(() => scrollTo(0, 0));
      const header = await page.locator('.date-header').evaluate(e => e.getBoundingClientRect().height); assert.ok(header >= (safe ? 91 : 44));
      // All four macros are on the first screen, and the meal of the moment starts on it.
      for (const id of ['calorie-ring', 'protein-ring', 'carbs-meter', 'fat-meter']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box.y + box.height <= height - 90, name + ' ' + id + ' on the first screen'); }
      assert.ok((await page.locator('#next-up').boundingBox()).y < height - 160, name + ' the next meal starts on the first screen');
      await page.locator('#week-toggle').tap(); await check('week strip open'); await page.locator('#week-toggle').tap();
      await page.evaluate(() => CHADUX.navigate(-1)); await check('past date');
      assert.equal(await page.locator('.date-header .ch-datebar__title').evaluate(e => [...e.querySelectorAll('.ch-eyebrow,h1')].every(n => n.scrollWidth <= n.clientWidth + 1)), true, name + ' header text fits on a past day');
      await page.locator('#return-today').tap();
      await page.locator('[data-meal-row=D]').tap(); await check('a meal opened from its line'); await page.waitForTimeout(420); await page.locator('[data-meal-toggle=D]').tap();
      await page.waitForTimeout(420); await page.locator('[data-row=wrap]').tap(); await check('the wrap-up opened'); await page.waitForTimeout(420); await page.locator('[data-fold=wrap]').tap();
      await page.waitForTimeout(420); await page.locator('[data-row=session]').tap(); await check('the session opened'); await page.waitForTimeout(420); await page.locator('[data-fold=session]').tap();
      assert.equal(await page.locator('.ch-slot.is-open, .ch-gymcard.is-open, .ch-wrap.is-open').count(), 0, name + ' folded again');
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
        await page.evaluate(view => { const spacer = document.createElement('div'); spacer.className = 'qa-spacer'; spacer.style.height = '600px'; document.getElementById(view === 'today' ? 'day-page' : 'training-page').prepend(spacer); }, view);
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        const empty = decodePNG(await page.screenshot());
        const moved = await page.evaluate(({ view, top }) => { const card = view === 'today' ? [...document.querySelectorAll('#today .ch-card, #today .ch-list, #today .ch-water')].filter(n => n.offsetParent).at(-1) : [...document.querySelectorAll('#training .ch-session, #training .ch-plan')].at(-1); scrollBy(0, card.getBoundingClientRect().top - (top - 24)); const r = card.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, { view, top: dock.top });
        assert.ok(moved.top < dock.top && moved.bottom > dock.bottom && moved.left < dock.left + quarter, name + ' ' + view + ' a card sits behind the bar for the pixel check ' + JSON.stringify({ moved, dock }));
        const png = decodePNG(await page.screenshot());
        for (const [label, [x, y]] of Object.entries(points)) { const a = png.at(x * 3, y * 3), b = empty.at(x * 3, y * 3); assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 3), `${name} ${view} ${label}: ${a} with a card behind, ${b} over empty page`); }
        if (view === 'today') await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '-dock.png') });
        await page.evaluate(() => { document.querySelectorAll('.qa-spacer').forEach(n => n.remove()); scrollTo(0, 0); });
      }
      await tab('today');

      // One tap per action: a meal, water, a done chip (with its line open), Start, a set.
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      const one = async (locator, verify, label) => { await page.waitForTimeout(420); await page.evaluate(() => window.qaTaps = 0); await locator.scrollIntoViewIfNeeded(); await locator.tap(); assert.equal(await page.evaluate(() => window.qaTaps), 1, name + ' one tap ' + label); assert.ok(await verify(await saved(page)), name + ' ' + label + ' saved'); };
      await one(page.locator('[data-slot=L][data-tier=S]'), s => s.questsV5['2026-11-24'].picks.L === 'S', 'meal');
      await one(page.locator('.water-row'), s => s.questsV5['2026-11-24'].water === .5, 'water');
      await page.waitForTimeout(420); await page.locator('[data-row=wrap]').tap();
      await one(page.locator('#today [data-quest=steps]'), s => s.questsV5['2026-11-24'].steps === true, 'steps');
      await check('today with a logged meal and toast');
      // The Undo toast floats above the bar, inside the screen.
      const toast = await page.locator('#undo-toast').boundingBox(); assert.ok(toast && toast.y + toast.height <= dock.top - 4 && toast.x >= 8 && toast.x + toast.width <= width - 8, name + ' toast sits above the dock');
      await page.waitForTimeout(420); await page.locator('[data-fold=wrap]').tap();
      // After lunch: dinner leads with Remaining today, the best fit and the buttons under it; + Custom opens the builder.
      await page.evaluate(() => CHADUX.hideToast(true)); await page.waitForTimeout(420); await check('today after lunch'); await aa('today after lunch (dinner, best fit)');
      await page.locator('#next-up [data-custom]').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
      for (const food of ['chook', 'yopro', 'steak-mash']) { await page.locator(`#builder-chips [data-food=${food}]`).tap(); await page.waitForTimeout(60); }
      await page.evaluate(() => { document.getElementById('builder-undo').hidden = true; });
      await check('custom builder'); await aa('custom builder');
      const bld = await page.locator('#builder-sheet').boundingBox(); assert.ok(bld.y >= (safe ? 47 : 0) - 1 && bld.y + bld.height <= height + 1, name + ' the builder fits the screen');
      const bspill = await page.evaluate(() => [...document.querySelectorAll('.ch-bld__item > *, .ch-bld__ctl > *, .ch-bld__chip > *, .ch-bld__total > *, .ch-bld__actions > *')].filter(e => { const p = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).map(e => e.className + ' ' + e.textContent.slice(0, 20)));
      assert.deepEqual(bspill, [], name + ' nothing spills out of the builder');
      const foot = await page.locator('.ch-bld__foot').boundingBox(); assert.ok(foot.y + foot.height <= height + 1, name + ' Log and Save stay on screen');
      await page.keyboard.press('Escape'); await page.locator('#builder-sheet').waitFor({ state: 'hidden' });
      await tab('training'); await page.locator('#training-week-toggle').tap(); await check('training week open'); await page.locator('#training-week-toggle').tap();
      await page.locator('.is-today .exercise-row').first().tap(); await check('exercise sheet'); await page.keyboard.press('Escape');
      await page.waitForTimeout(420);
      await one(page.locator('.is-today [data-gym-start]'), s => !!s.questsV5['2026-11-24'].workout, 'Start');
      assert.equal(await page.locator('#gym').isVisible(), true); await gymCheck('exercise');
      assert.ok((await page.locator('#gym-go').boundingBox()).y > height * 0.55, name + ' the main button is in the bottom of the screen');
      await one(page.locator('#gym-go'), s => s.questsV5['2026-11-24'].workout.sets.length === 1, 'a set');
      assert.equal(await page.locator('#gym-rest').isVisible(), true); await gymCheck('rest');
      const ring = await page.locator('.ch-gym__ring').boundingBox(), stage = await page.locator('#gym-stage').boundingBox(); assert.ok(ring.y >= stage.y - 1 && ring.y + ring.height <= stage.y + stage.height + 1, name + ' the rest ring fits its panel');
      await page.locator('[data-gym=skip]').tap(); await page.locator('[data-gym=next]').tap(); await page.locator('[data-gym=next]').tap(); await gymCheck('third exercise');
      await page.locator('[data-gym=finish]').tap(); assert.equal(await page.locator('#gym-done').isVisible(), true); await gymCheck('finish');
      const done = await page.locator('#gym-done').evaluate(e => ({ h: e.scrollHeight, c: e.clientHeight })); assert.ok(done.h <= done.c + 1, name + ' the finish screen fits without scrolling');
      if (!safe && theme === 'dark') await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '-gym-finish.png') });
      await page.locator('[data-gym=done]').tap(); assert.equal(await page.locator('#gym').isVisible(), false);
      await page.locator('#today-scan').tap(); await check('add');
      for (const kind of ['manual', 'camera', 'barcode', 'search']) {
        await page.locator(`[data-add=${kind}]`).tap(); await check(kind + ' sheet');
        const sheet = await page.locator('dialog[open]').boundingBox(); assert.ok(sheet.y >= (safe ? 47 : 0) && sheet.y + sheet.height <= height, name + ' ' + kind + ' sheet fits the screen');
        await page.keyboard.press('Escape'); await page.locator('#today-scan').tap();
      }
      await page.keyboard.press('Escape');
      await tab('today'); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(420);
      const card = await page.locator('#next-up .meal-pick').first().boundingBox(); await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      assert.equal(await page.locator('#detail-sheet').isVisible(), true); await check('meal detail'); await aa('meal detail'); await page.keyboard.press('Escape');
      await tab('history'); await page.locator('#open-level').tap(); await check('level details'); await page.locator('#close-level').tap();
      assert.deepEqual(errors, [], name + ' errors'); await context.close();
      console.log('PASS ' + name + ': all screens and sheets incl. week strip, opened meal/session/wrap-up, Advanced and the custom meal builder, WCAG AA text contrast (gradients and opacity composited), >=44px targets, nothing spills, how-to in full, no overflow, four macros and the next meal on the first screen, dock pixels clean behind bar and +, last row clears the fade, toast above dock, meal/water/chip/Start/set = 1 tap each; Gym mode exercise, rest and finish: 56 px targets, 72 px main buttons in the bottom of the screen, clear of notch and home indicator, finish fits; no JS/console errors');
    }
    console.log('Screenshots outside repo: ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
