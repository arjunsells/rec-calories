// Layout matrix: 393x852 and 375x667, DPR 3, touch, iPhone UA, light and dark, with and without simulated safe areas.
// Every screen and sheet (Today at noon with its details and Later today open, Quick log, Gym, Progress, Settings with
// its disclosure open, the add-food sheet, the card, the AI and barcode sheet, the meal sheet, the food sheet) and Gym
// mode (exercise, rest, finish): 48 px targets everywhere (an input inside a label counts by its label, the box you tap)
// and 56 px in Gym mode (72 px for its main buttons); WCAG AA contrast for every visible text (4.5:1, 3:1 for large),
// gradients and opacity composited, against what is really behind it; no horizontal scroll; nothing spills out of its
// card; the first screen is the line and the one thing to do; one tap per action; Gym mode clear of the notch and the
// home indicator; and a pixel check that nothing shows through or collides with the floating tab bar.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, decodePNG, IPHONE, NOON } = require('./harness.cjs');
const shots = path.join(os.tmpdir(), 'chad-v11-qa');

(async () => {
  const server = await serve(8091), browser = await launch();
  try {
    fs.mkdirSync(shots, { recursive: true });
    for (const [width, height] of [[393, 852], [375, 667]]) for (const theme of ['light', 'dark']) for (const safe of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce' }), page = await context.newPage(), errors = watch(page);
      if (safe) await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, ':root{--ch-sat:47px;--ch-sab:34px;--ch-sal:6px;--ch-sar:6px}');   // as soon as <html> exists, before any script
      await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8091/');
      // A saved dinner, so its favourite and Same as yesterday are on screen too.
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.myMeals = [{ id: 'my-qa', slot: 'D', name: 'Synthetic chook and spud bowl with corn', macros: [640, 52, 60, 18], parts: [] }]; s.questsV5 = { '2026-11-23': { picks: { D: 'C' } } }; s.entries = [{ id: 'plan-2026-11-23-D', day: '2026-11-23', name: 'Synthetic leftover pasta bake', kcal: 700, protein: 40, carbs: 80, fat: 20, planSlot: 'D', source: 'custom' }]; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); });
      await page.reload(); await page.evaluate(() => document.fonts.ready);
      const name = width + 'x' + height + ' ' + theme + (safe ? ' safe' : '');
      const check = async label => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' ' + label + ' overflow');
        const bad = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,input:not([type=hidden]),select,textarea')].filter(e => {
          if (e.closest('#gym')) return false;                                                     // Gym mode has its own, bigger rule
          const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return false;
          const hit = e.matches('input,textarea,select') && e.closest('label') ? e.closest('label') : e, w = hit.offsetWidth || r.width, h = hit.offsetHeight || r.height;   // layout size: a press may scale a button for a moment
          return w < 47.99 || h < 47.99;
        }).map(e => ({ text: (e.getAttribute('aria-label') || e.textContent || e.id).trim().slice(0, 40), id: e.id, cls: String(e.className), w: e.offsetWidth, h: e.offsetHeight })));
        assert.deepEqual(bad, [], name + ' ' + label + ' 48px targets');
        // Nothing sticks out of its card.
        const spill = await page.evaluate(() => [...document.querySelectorAll('.ch-opt__hit > *, .ch-cell > *, .ch-done__label, .ch-water__val, .ch-water__goal, .ch-fav > *, .ch-row-pick > *, .ch-later__toggle > *, .ch-left__col > *, .ch-pill > *, .ch-now__title, .ch-bld__chip > *')].filter(e => { const p = e.closest('.ch-opt, .ch-cell, .ch-done, .ch-water, .ch-fav, .ch-row-pick, .ch-later__toggle, .ch-left__col, .ch-pill, .ch-now, .ch-bld__chip'); if (!p || p === e || !e.getClientRects().length) return false; const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.right > b.right + 1 || a.left < b.left - 1; }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 30)));
        assert.deepEqual(spill, [], name + ' ' + label + ' nothing spills out of its card');
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
            if (el.closest('svg, script, style, [hidden], dialog:not([open]), .ch-toast, .chart-values, .ch-sr') || el.closest(':disabled') || el.matches('option, input, textarea, select')) continue;
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
      const sheetFits = async (id, label) => { const box = await page.locator('#' + id).boundingBox(); assert.ok(box.y >= (safe ? 47 : 0) - 1 && box.y + box.height <= height + 1, name + ' ' + label + ' fits the screen ' + JSON.stringify(box)); };
      const tab = view => page.locator(`[data-view=${view}]`).tap();
      assert.equal(await page.evaluate(() => devicePixelRatio), 3);
      assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);

      // Today at noon: the line and lunch fill the first screen; everything else is one scroll down.
      await check('today'); await aa('today');
      const first = await page.evaluate(() => ({ line: document.getElementById('left-line').getBoundingClientRect().bottom, now: document.querySelector('#now .ch-opt').getBoundingClientRect().top, after: document.getElementById('after-now').getBoundingClientRect().top, dock: document.querySelector('.ch-tabbar').getBoundingClientRect().top }));
      assert.ok(first.line <= first.dock && first.now < first.dock - 60, name + ' the line and the first lunch option are on the first screen ' + JSON.stringify(first));
      assert.ok(first.after >= first.dock - 4, name + ' nothing else competes on the first screen ' + JSON.stringify(first));
      const header = await page.locator('.date-header').evaluate(e => e.getBoundingClientRect().height); assert.ok(header >= (safe ? 91 : 48));
      await page.locator('#left-line').tap(); await check('the line opened'); await aa('the line opened'); await page.waitForTimeout(420); await page.locator('#left-line').tap();
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await check('Today, scrolled'); await aa('Today, scrolled');
      await page.waitForTimeout(420); await page.locator('#later-toggle').tap(); await check('Later today open'); await aa('Later today open');
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await aa('Later today, bottom');
      assert.equal(await page.evaluate(() => document.querySelector('.view:not([hidden])').getBoundingClientRect().bottom <= document.querySelector('.ch-dock-scrim').getBoundingClientRect().top), true, name + ' the last row clears the dock fade');
      await page.waitForTimeout(420); await page.locator('#later-toggle').tap();
      await page.evaluate(() => CHADUX.navigate(-1)); await check('past date');
      assert.equal(await page.locator('.date-header .ch-datebar__title').evaluate(e => [...e.querySelectorAll('.ch-eyebrow,h1')].every(n => n.scrollWidth <= n.clientWidth + 1)), true, name + ' header text fits on a past day');
      await page.locator('#return-today').tap(); await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '.png') });
      for (const [view, label] of [['training', 'Gym tab'], ['history', 'Progress']]) { await tab(view); await page.waitForTimeout(150); await check(label); await aa(label); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await check(label + ', bottom'); await aa(label + ', bottom'); }
      await tab('training'); await page.evaluate(() => document.querySelectorAll('#training details').forEach(d => d.open = true)); await check('Gym tab, plan open'); await aa('Gym tab, plan open');
      await tab('today'); await page.locator('#open-settings').tap(); await check('Settings'); await aa('Settings');
      await page.evaluate(() => document.querySelectorAll('#settings details').forEach(d => d.open = true)); await check('Settings, disclosures open'); await aa('Settings, disclosures open');
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await aa('Settings, bottom');
      await page.locator('#close-settings').tap();

      // The floating dock: with a card scrolled right behind it, every pixel in and around the bar is identical to the
      // dock over empty page (bar glass and shadow). Nothing shows through, nothing looks clipped.
      const dock = await page.evaluate(() => { const bar = document.querySelector('.ch-tabbar').getBoundingClientRect(); return { top: bar.top, bottom: bar.bottom, left: bar.left, right: bar.right }; });
      const midY = (dock.top + dock.bottom) / 2, quarter = (dock.right - dock.left) / 4;
      const points = { 'below the bar': [dock.left + quarter * 1.5, Math.min(height - 2, dock.bottom + 5)], 'left of the bar': [Math.max(2, dock.left - 6), midY], 'right of the bar': [Math.min(width - 2, dock.right + 6), midY], 'bar top edge': [dock.left + quarter * 2, dock.top + 2], 'through the bar glass': [dock.left + quarter * 2, dock.top + 9], 'through the bar glass, lower': [dock.left + quarter * 3, dock.bottom - 5], 'just above the bar': [dock.left + quarter * 1.5, dock.top - 2] };
      for (const view of ['today', 'training']) {
        await tab(view);
        await page.evaluate(view => { const spacer = document.createElement('div'); spacer.className = 'qa-spacer'; spacer.style.height = '900px'; document.getElementById(view === 'today' ? 'day-page' : 'training-page').prepend(spacer); }, view);
        await page.evaluate(() => scrollTo(0, 0));                                                  // the spacer is behind the bar (a capture at the very end of the page can shift fixed layers)
        const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => page.waitForTimeout(150));   // the header collapses on scroll: capture a settled frame
        await frames(); const empty = decodePNG(await page.screenshot());
        const moved = await page.evaluate(({ view, top }) => { const card = view === 'today' ? document.querySelector('#first .ch-left') : [...document.querySelectorAll('#training .ch-session')].at(-1); scrollBy(0, card.getBoundingClientRect().top - (top - 24)); const r = card.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, { view, top: dock.top });
        assert.ok(moved.top < dock.top && moved.bottom > dock.bottom && moved.left < dock.left + quarter, name + ' ' + view + ' a card sits behind the bar for the pixel check ' + JSON.stringify({ moved, dock }));
        await frames(); const png = decodePNG(await page.screenshot());
        for (const [label, [x, y]] of Object.entries(points)) { const a = png.at(x * 3, y * 3), b = empty.at(x * 3, y * 3); assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 3), `${name} ${view} ${label}: ${a} with a card behind, ${b} over empty page`); }
        if (view === 'today') await page.screenshot({ path: path.join(shots, name.replaceAll(' ', '-') + '-dock.png') });
        await page.evaluate(() => { document.querySelectorAll('.qa-spacer').forEach(n => n.remove()); scrollTo(0, 0); });
      }
      await tab('today');

      // One tap per action: a meal, water, a habit (Later today), a favourite.
      await page.evaluate(() => { window.qaTaps = 0; document.addEventListener('click', () => window.qaTaps++, true); });
      const one = async (locator, verify, label) => { await page.waitForTimeout(420); await page.evaluate(() => window.qaTaps = 0); await locator.scrollIntoViewIfNeeded(); await locator.tap(); assert.equal(await page.evaluate(() => window.qaTaps), 1, name + ' one tap ' + label); assert.ok(await verify(await saved(page)), name + ' ' + label + ' saved'); };
      await one(page.locator('#now [data-slot=L][data-tier=S]'), s => s.questsV5['2026-11-24'].picks.L === 'S', 'meal');
      await one(page.locator('.water-row'), s => s.questsV5['2026-11-24'].water === .5, 'water');
      await one(page.locator('#quick [data-fav=yopro-pouch]'), s => s.entries.some(e => e.fav === 'yopro-pouch'), 'YoPRO');
      await page.waitForTimeout(420); await page.locator('#later-toggle').tap();
      await one(page.locator('#later-more [data-quest=steps]'), s => s.questsV5['2026-11-24'].steps === true, 'steps');
      await check('today with a logged meal and toast');
      // The Undo toast floats above the bar, inside the screen.
      const toast = await page.locator('#undo-toast').boundingBox(); assert.ok(toast && toast.y + toast.height <= dock.top - 4 && toast.x >= 8 && toast.x + toast.width <= width - 8, name + ' toast sits above the dock');
      await page.evaluate(() => CHADUX.hideToast(true)); await page.waitForTimeout(420); await page.locator('#later-toggle').tap(); await page.evaluate(() => scrollTo(0, 0));
      await check('today after lunch'); await aa('today after lunch');

      // The sheets, one at a time, each fitting the screen: the add-food sheet, the card, Ask AI, barcode, a meal, a food.
      await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.waitForTimeout(420); await page.locator('#add-food').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
      for (const food of ['chook', 'yopro', 'steak-mash']) { await page.locator(`#builder-chips [data-food=${food}]`).tap(); await page.waitForTimeout(60); }
      await page.evaluate(() => { document.getElementById('builder-undo').hidden = true; });
      await check('add-food sheet'); await aa('add-food sheet'); await sheetFits('builder-sheet', 'the add-food sheet');
      const bspill = await page.evaluate(() => [...document.querySelectorAll('.ch-bld__item > *, .ch-bld__ctl > *, .ch-bld__chip > *, .ch-bld__total > *, .ch-bld__actions > *, .ch-bld__ways > *')].filter(e => { const p = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).map(e => e.className + ' ' + e.textContent.slice(0, 20)));
      assert.deepEqual(bspill, [], name + ' nothing spills out of the add-food sheet');
      const foot = await page.locator('.ch-bld__foot').boundingBox(); assert.ok(foot.y + foot.height <= height + 1, name + ' Log stays on screen');
      await page.locator('#builder-type').tap(); await page.locator('#confirm-sheet').waitFor({ state: 'visible' }); await check('the card'); await aa('the card'); await sheetFits('confirm-sheet', 'the card');
      await page.locator('#cancel-scan').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
      await page.locator('#builder-ask-go').tap(); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); await check('Ask AI'); await aa('Ask AI'); await sheetFits('scan-sheet', 'Ask AI');
      await page.locator('[data-snap=barcode]').tap(); await page.waitForTimeout(100); await check('barcode'); await aa('barcode'); await sheetFits('scan-sheet', 'barcode');
      await page.locator('#scan-sheet [data-close=scan-sheet]').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.locator('#builder-sheet [data-close=builder-sheet]').tap(); await page.waitForTimeout(420);
      await page.locator('#later-toggle').tap(); const dinner = page.locator('#later-more [data-slot=D][data-tier=S]'); await dinner.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(420); const card = await dinner.boundingBox(); await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      assert.equal(await page.locator('#detail-sheet').isVisible(), true); await check('meal sheet'); await aa('meal sheet'); await sheetFits('detail-sheet', 'the meal sheet'); await page.keyboard.press('Escape');
      await page.waitForTimeout(420); await page.locator('#later-toggle').tap(); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(420); await page.locator('#left-line').tap(); await page.locator('#entries .entry-open').first().tap(); assert.equal(await page.locator('dialog[open]').count(), 1, 'one sheet at a time'); await check('food sheet'); await aa('food sheet'); await page.keyboard.press('Escape');
      await page.waitForTimeout(420); await page.locator('#left-line').tap();

      // Gym mode from the Gym tab: exercise, rest, finish.
      await tab('training'); await page.locator('.is-today .exercise-row').first().tap(); await check('exercise sheet'); await aa('exercise sheet'); await page.keyboard.press('Escape');
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
      assert.deepEqual(errors, [], name + ' errors'); await context.close();
      console.log('PASS ' + name + ': Today (the line, its details, Later today, Quick log, a past day), Gym tab, Progress, Settings (disclosures open), the add-food sheet, the card, Ask AI, barcode, the meal and food sheets: WCAG AA text contrast (gradients and opacity composited), >= 48 px targets, nothing spills, no overflow, the first screen is the line and the one thing to do, every sheet fits, dock pixels clean behind the bar, last row clears the fade, toast above the dock, meal/water/YoPRO/habit/Start/set = 1 tap each; Gym mode exercise, rest and finish: 56 px targets, 72 px main buttons in the bottom of the screen, clear of notch and home indicator, finish fits; no JS/console errors');
    }
    console.log('Screenshots outside repo: ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
