// Layout matrix: 393x852 and 375x667, DPR 3, touch, iPhone UA, light and dark, with and without simulated safe areas.
// Every v12 screen and sheet: Today at noon (week strip, the hero and its "eaten" side, the macro cards, the water card,
// lunch, Later today open, Quick log, Recently eaten with an Analysing… row and logged food), a past day, Gym, Progress,
// Settings with its disclosures open, the add-food sheet, the full-screen camera in each mode, the barcode digits sheet,
// the nutrition card (typed, a photo ready, Fix with AI open, an error, a logged food), Describe it, Saved, the meal
// sheet, and Gym mode (exercise, rest, finish): 48 px targets everywhere (an input inside a label counts by its label, the
// box you tap) and 56 px in Gym mode (72 px for its main buttons); WCAG AA contrast for every visible text (4.5:1, 3:1 for
// large), gradients and opacity composited, against what is really behind it; no horizontal scroll; nothing spills out of
// its card; the hero and the macro cards on the first screen; one tap per action; Gym mode clear of the notch and the
// home indicator; and a pixel check that nothing shows through or collides with the floating tab bar.
// Synthetic data only: a canvas stands in for the camera and the proxy is stubbed in the browser.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { serve, launch, watch, saved, decodePNG, IPHONE, NOON } = require('./harness.cjs');
const shots = path.join(os.tmpdir(), 'chad-v12-qa');

(async () => {
  const server = await serve(8091), browser = await launch();
  try {
    fs.mkdirSync(shots, { recursive: true });
    for (const [width, height] of [[393, 852], [375, 667]]) for (const theme of ['light', 'dark']) for (const safe of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce' }), page = await context.newPage(), errors = watch(page, t => /status of 401/.test(t));   // the 401 is the stub's, on purpose
      let proxy = 'ok';
      await context.route('**/estimate', async route => { await new Promise(r => setTimeout(r, proxy === 'slow' ? 2500 : 300)); if (proxy === '401') return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }); route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'Synthetic chicken, rice and greens with a long name', grams: 420, kcal: 640, protein_g: 52, carbs_g: 62, fat_g: 18, fibre_g: 6, sugar_g: 4, confidence: .6, items: [{ name: 'Grilled chicken thigh, skin off', grams: 180, kcal: 340, protein_g: 44, carbs_g: 0, fat_g: 16 }, { name: 'White rice', grams: 180, kcal: 230, protein_g: 4.5, carbs_g: 50, fat_g: .5 }, { name: 'Broccoli', grams: 60, kcal: 20, protein_g: 2, carbs_g: 4, fat_g: .2 }] }) }); });
      await page.addInitScript(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 720; const g = c.getContext('2d'); const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 960, 720); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(480, 360, 260, 0, 7); g.fill(); }; draw(); setInterval(draw, 120); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(10) } }); });
      if (safe) await page.addInitScript(css => { const add = () => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); }, ':root{--ch-sat:59px;--ch-sab:34px;--ch-sal:6px;--ch-sar:6px}');   // as soon as <html> exists, before any script
      await page.clock.install({ time: new Date(NOON) }); await page.goto('http://127.0.0.1:8091/');
      // A saved dinner, so its favourite and Same as yesterday are on screen too.
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rec-calories-v1')); s.myMeals = [{ id: 'my-qa', slot: 'D', name: 'Synthetic chook and spud bowl with corn', macros: [640, 52, 60, 18], parts: [] }]; s.questsV5 = { '2026-11-23': { picks: { D: 'C' } } }; s.entries = [{ id: 'plan-2026-11-23-D', day: '2026-11-23', name: 'Synthetic leftover pasta bake', kcal: 700, protein: 40, carbs: 80, fat: 20, planSlot: 'D', source: 'custom' }]; localStorage.setItem('rec-calories-v1', JSON.stringify(s)); localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-design-token'); });
      await page.reload(); await page.evaluate(() => document.fonts.ready);
      const name = width + 'x' + height + ' ' + theme + (safe ? ' safe' : '');
      const check = async label => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' ' + label + ' overflow');
        assert.doesNotMatch(await page.locator('body').innerText(), /pair/i, name + ' no pairing wording');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.ch-datebar,.ch-sheet__head,.ch-bld__total')].filter(e => {
          if (!e.getClientRects().length) return false;
          const bg = getComputedStyle(e).backgroundColor;
          return bg === 'transparent' || (bg.startsWith('rgba(') && parseFloat(bg.split(',').at(-1)) < 1);
        }).map(e => e.className)), [], name + ' ' + label + ' opaque headers');
        const bad = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,input:not([type=hidden]),select,textarea')].filter(e => {
          if (e.closest('#gym')) return false;                                                     // Gym mode has its own, bigger rule
          const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return false;
          const hit = e.matches('input,textarea,select') && e.closest('label') ? e.closest('label') : e, w = hit.offsetWidth || r.width, h = hit.offsetHeight || r.height;   // layout size: a press may scale a button for a moment
          return w < 47.99 || h < 47.99;
        }).map(e => ({ text: (e.getAttribute('aria-label') || e.textContent || e.id).trim().slice(0, 40), id: e.id, cls: String(e.className), w: e.offsetWidth, h: e.offsetHeight })));
        assert.deepEqual(bad, [], name + ' ' + label + ' 48px targets');
        // Nothing sticks out of its card.
        const spill = await page.evaluate(() => [...document.querySelectorAll('.ch-opt__hit > *, .ch-cell > *, .ch-done__label, .ch-water__val, .ch-water__goal, .ch-fav > *, .ch-row-pick > *, .ch-later__toggle > *, .ch-hero__words > *, .ch-macro > *, .ch-watercard__words > *, .ch-food__words > *, .ch-week__day > *, .ch-pill > *, .ch-now__title, .ch-bld__chip > *, .ch-ing > *, .ch-nut__tile > *, .ch-cam__modes > button > *, .ch-cam__links > button > *')].filter(e => { const p = e.closest('.ch-opt, .ch-cell, .ch-done, .ch-water, .ch-fav, .ch-row-pick, .ch-later__toggle, .ch-hero__words, .ch-macro, .ch-watercard__words, .ch-food__words, .ch-week__day, .ch-pill, .ch-now, .ch-bld__chip, .ch-ing, .ch-nut__tile, .ch-cam__modes > button, .ch-cam__links > button'); if (!p || p === e || !e.getClientRects().length) return false; const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); return a.right > b.right + 1 || a.left < b.left - 1; }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 30)));
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
        }, { sat: safe ? 59 : 0, sab: safe ? 34 : 0 });
        assert.deepEqual(out.bad, [], name + ' Gym mode ' + label + ': 56 px targets, 72 px main buttons'); assert.deepEqual(out.off, [], name + ' Gym mode ' + label + ': every control on screen, clear of the notch and home indicator'); assert.equal(out.wide, false);
      };
      const sheetFits = async (id, label) => { const box = await page.locator('#' + id).boundingBox(); assert.ok(box.y >= (safe ? 59 : 0) - 1 && box.y + box.height <= height + 1, name + ' ' + label + ' fits the screen ' + JSON.stringify(box)); };
      const tab = view => page.locator(`[data-view=${view}]`).tap();
      assert.equal(await page.evaluate(() => devicePixelRatio), 3);
      assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);

      // Today at noon: the week strip, the hero and the three macro cards are the first screen (the water card too on a tall
      // phone); then the water card, the thing to do now and Recently eaten, in that order.
      await check('today'); await aa('today');
      const first = await page.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(); return { hero: r('#left-line').bottom, macros: r('#macros').bottom, water: r('#water12').bottom, dock: r('.ch-tabbar').top, order: ['#week', '#left-line', '#macros', '#water12', '#now', '#after-now', '#recent12'].map(q => Math.round(r(q).top)) }; });
      assert.ok(first.hero <= first.dock && first.macros <= first.dock, name + ' the hero and the macro cards are on the first screen ' + JSON.stringify(first));
      if (height > 800) assert.ok(first.water <= first.dock, name + ' and the water card on a tall phone ' + JSON.stringify(first));
      assert.deepEqual(first.order, first.order.slice().sort((x, y) => x - y), name + ' week, hero, macros, water, now, the rest, Recently eaten ' + JSON.stringify(first.order));
      const header = await page.locator('.date-header').evaluate(e => e.getBoundingClientRect().height); assert.ok(header >= (safe ? 91 : 48));
      await page.locator('#left-line').tap(); assert.equal(await page.locator('#remaining-label').textContent(), 'Calories eaten'); await check('the hero, eaten'); await aa('the hero, eaten'); await page.waitForTimeout(420); await page.locator('#left-line').tap();
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
      assert.equal(await page.evaluate(() => {
        const items = [...document.querySelectorAll('#settings button,#settings summary')].filter(e => e.getClientRects().length);
        const r = items.at(-1).getBoundingClientRect(), bar = document.querySelector('.ch-tabbar').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= bar.top;
      }), true, name + ' last Settings control reachable above tab bar');
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
        const moved = await page.evaluate(({ view, top }) => { const card = view === 'today' ? document.querySelector('#first .ch-hero') : [...document.querySelectorAll('#training .ch-session')].at(-1); scrollBy(0, card.getBoundingClientRect().top - (top - 24)); const r = card.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, { view, top: dock.top });
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

      // The sheets, one at a time, each fitting the screen: the add-food sheet, the card, the camera in each mode, barcode,
      // a photo (Analysing…, ready, Fix with AI, an error), Describe it, Saved, a meal, a logged food.
      await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.waitForTimeout(420); await page.locator('#add-food').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
      for (const food of ['chook', 'yopro', 'steak-mash']) { await page.locator(`#builder-chips [data-food=${food}]`).tap(); await page.waitForTimeout(60); }
      await page.evaluate(() => { document.getElementById('builder-undo').hidden = true; });
      await check('add-food sheet'); await aa('add-food sheet'); await sheetFits('builder-sheet', 'the add-food sheet');
      const bspill = await page.evaluate(() => [...document.querySelectorAll('.ch-bld__item > *, .ch-bld__ctl > *, .ch-bld__chip > *, .ch-bld__total > *, .ch-bld__actions > *, .ch-bld__ways > *')].filter(e => { const p = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).map(e => e.className + ' ' + e.textContent.slice(0, 20)));
      assert.deepEqual(bspill, [], name + ' nothing spills out of the add-food sheet');
      const foot = await page.locator('.ch-bld__foot').boundingBox(); assert.ok(foot.y + foot.height <= height + 1, name + ' Log stays on screen');
      await page.locator('#builder-type').tap(); await page.locator('#nutrition12').waitFor({ state: 'visible' }); await check('the card, typed'); await aa('the card, typed'); await sheetFits('nutrition12', 'the card');
      await page.locator('#nutrition12-close').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
      await page.locator('#builder-ask-go').tap(); await page.locator('#camera12').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0);
      await check('camera'); await aa('camera');
      // The camera fills the screen edge to edge; its controls stay clear of the notch and the home indicator.
      assert.deepEqual(await page.evaluate(({ sat, sab }) => { const r = q => document.querySelector(q).getBoundingClientRect(); return { close: r('#camera12-close').top >= sat - 1, shutter: r('#camera12-shutter').bottom <= innerHeight - sab, links: r('.ch-cam__links').bottom <= innerHeight - sab + 1, full: r('#camera12').height >= innerHeight - 1 }; }, { sat: safe ? 59 : 0, sab: safe ? 34 : 0 }), { close: true, shutter: true, links: true, full: true }, name + ' the camera controls clear the notch and home indicator');
      for (const m of ['label', 'barcode']) { await page.locator(`[data-mode12=${m}]`).tap(); await page.waitForTimeout(150); await check('camera, ' + m); await aa('camera, ' + m); }
      await page.locator('#camera12-shutter').tap(); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); await check('barcode digits'); await aa('barcode digits'); await sheetFits('scan-sheet', 'barcode');
      await page.locator('#scan-sheet [data-close=scan-sheet]').tap(); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.locator('#builder-sheet [data-close=builder-sheet]').tap(); await page.waitForTimeout(420);
      // A photo: the Analysing… row, then the card by itself; Fix with AI open; the bottom of the card.
      proxy = 'slow'; await page.locator('#open-camera').tap(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await page.locator('#camera12-shutter').tap();
      await page.waitForFunction(() => document.querySelector('#recent12 .ch-food.is-pending')); await page.locator('#recent12').scrollIntoViewIfNeeded(); await check('Analysing row'); await aa('Analysing row');
      await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready', null, { timeout: 15000 });
      await check('the card, a photo'); await aa('the card, a photo'); await sheetFits('nutrition12', 'the card with a photo');
      const nspill = await page.evaluate(() => [...document.querySelectorAll('#nutrition12 .ch-ing > *, #nutrition12 .ch-nut__tile > *, #nutrition12 .ch-nut__serv > *, #nutrition12 .ch-nut__actions > *')].filter(e => { const p = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).map(e => e.className + ' ' + e.textContent.slice(0, 20)));
      assert.deepEqual(nspill, [], name + ' nothing spills out of the nutrition card');
      const nfoot = await page.locator('#nutrition12-foot').boundingBox(); assert.ok(nfoot.y + nfoot.height <= height + 1, name + ' Done stays on screen');
      await page.evaluate(() => { const b = document.getElementById('nutrition12-body'); b.scrollTop = b.scrollHeight; }); await page.waitForTimeout(100); await check('the card, bottom'); await aa('the card, bottom');
      await page.locator('#n12-fix').tap(); await check('Fix with AI'); await aa('Fix with AI'); await page.locator('#n12-cancelfix').tap();
      await page.locator('#nutrition12-close').tap(); await page.waitForTimeout(420);
      proxy = '401'; await page.locator('#open-camera').tap(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await page.locator('#camera12-shutter').tap();
      await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'error', null, { timeout: 15000 });
      await check('the card, an error'); await aa('the card, an error'); await sheetFits('nutrition12', 'the card with an error'); proxy = 'ok';
      await page.locator('#nutrition12-close').tap(); await page.waitForTimeout(420); await page.evaluate(() => scrollTo(0, document.getElementById('recent12').getBoundingClientRect().top + scrollY - 200)); await check('Recently eaten, drafts'); await aa('Recently eaten, drafts');
      for (const [id, label] of [['camera12-describe', 'Describe it'], ['camera12-saved', 'Saved']]) { await page.locator('#open-camera').tap(); await page.locator('#' + id).tap(); await page.locator('#detail-sheet').waitFor({ state: 'visible' }); await check(label); await aa(label); await sheetFits('detail-sheet', label); await page.keyboard.press('Escape'); await page.waitForTimeout(420); }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      await page.locator('#later-toggle').tap(); const dinner = page.locator('#later-more [data-slot=D][data-tier=S]'); await dinner.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(420); const card = await dinner.boundingBox(); await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
      assert.equal(await page.locator('#detail-sheet').isVisible(), true); await check('meal sheet'); await aa('meal sheet'); await sheetFits('detail-sheet', 'the meal sheet'); await page.keyboard.press('Escape');
      await page.waitForTimeout(420); await page.locator('#later-toggle').tap(); await page.waitForTimeout(420); await page.locator('#recent12 [data-entry]').first().scrollIntoViewIfNeeded(); await page.locator('#recent12 [data-entry]').first().tap(); await page.locator('#nutrition12').waitFor({ state: 'visible' }); assert.equal(await page.locator('dialog[open]').count(), 1, 'one sheet at a time'); await check('the card, a logged food'); await aa('the card, a logged food'); await page.keyboard.press('Escape');
      await page.waitForTimeout(420); await page.evaluate(() => scrollTo(0, 0));

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
      console.log('PASS ' + name + ': Today (week strip, hero + eaten side, macro cards, water card, Later today, Quick log, Recently eaten with drafts, a past day), Gym tab, Progress, Settings (disclosures open), the add-food sheet, the camera (food, label, barcode), barcode digits, the nutrition card (typed, photo, Fix with AI, error, logged food), Describe it, Saved, the meal sheet: WCAG AA text contrast (gradients and opacity composited), >= 48 px targets, nothing spills, no overflow, the first screen is the line and the one thing to do, every sheet fits, dock pixels clean behind the bar, last row clears the fade, toast above the dock, meal/water/YoPRO/habit/Start/set = 1 tap each; Gym mode exercise, rest and finish: 56 px targets, 72 px main buttons in the bottom of the screen, clear of notch and home indicator, finish fits; no JS/console errors');
    }
    console.log('Screenshots outside repo: ' + shots);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
