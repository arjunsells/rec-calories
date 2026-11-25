// Motion and feedback with animations ON (every other suite runs with reduced motion): haptics, the hero counting down
// and its ring gliding, the logged card holding its place and the next thing to do rising into it, chip and water-card
// pops, the hero flipping to "eaten", the toast, animated sheet close, drag-to-dismiss, the interactive day swipe and the
// week strip, tabs (the pill under the tab), Gym mode (entrance, a set's pop, the rest ring running down, the next
// exercise sliding in, the finish trophy, count-up and confetti), and the v12 photo flow (the camera fading in, the
// shutter flash, the Analysing… ring creeping towards done, the nutrition card sliding up, the logged food rising into
// Recently eaten). The rule under test: state changes immediately; motion decorates and always cleans up.
// Synthetic data only: a canvas stands in for the camera and the proxy is stubbed in the browser.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = await serve(8092), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'no-preference' }), page = await context.newPage(), errors = watch(page);
    await context.route('**/estimate', async route => { await sleep(1800); route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'Synthetic chicken plate', grams: 300, kcal: 600, protein_g: 60, carbs_g: 45, fat_g: 20, items: [] }) }); });
    await page.addInitScript(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 640, 480); }; draw(); setInterval(draw, 100); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => c.captureStream(10) } }); if (!sessionStorage.getItem('qa-proxy')) { sessionStorage.setItem('qa-proxy', '1'); localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-motion-token'); } });
    await page.addInitScript(() => { window.qaBuzz = []; Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(pattern) { window.qaBuzz.push(pattern); return true; } }); });
    await page.clock.install({ time: new Date(NOON) });                                             // noon in Darwin: lunch is the thing to do
    await page.goto('http://127.0.0.1:8092/'); await page.waitForFunction(() => window.CHADMotion && document.querySelector('#now .meal-pick'));
    assert.equal(await page.evaluate(() => CHADMotion.reduced()), false);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const drag = async (points, pause = 24) => { await touch('touchStart', ...points[0]); for (const p of points.slice(1)) { await sleep(pause); await touch('touchMove', ...p); } };
    const settle = () => page.waitForFunction(() => !document.querySelector('.ch-page-ghost,.is-closing,.is-dragging,.just-on,.just-off,.is-entering,.ch-confetti') && document.getAnimations().every(a => a.animationName === 'ch-life' || a.animationName === 'ch-breathe' || a.animationName === 'ch-glow' || a.animationName === 'ch-shimmer' || a.animationName === 'ch-sweep' || a.playState !== 'running'), null, { timeout: 5000 });
    const today = await page.evaluate(() => CHADQuest.dayKey()), day = async () => (await saved(page)).questsV5?.[today] || {};
    const later = async open => { if ((await page.locator('#later-toggle').getAttribute('aria-expanded') === 'true') !== open) { await page.locator('#later-toggle').scrollIntoViewIfNeeded(); await page.locator('#later-toggle').tap(); await sleep(450); } };

    // 1. One tap on lunch: saved at once; a haptic tick; the card pops and holds its place with its tick; the hero counts
    //    down and its ring glides; a beat later the next thing to do (the gym session) rises into the same spot.
    const card = page.locator('#now [data-slot=L][data-tier=S]');
    await card.tap();
    assert.equal((await day()).picks.L, 'S', 'the journal is written before anything animates');
    assert.ok((await page.evaluate(() => window.qaBuzz.length)) >= 1, 'haptic feedback fired');
    const mid = await page.evaluate(() => ({ text: document.getElementById('remaining').textContent, pop: !!document.querySelector('.ch-opt.just-on'), toast: !document.getElementById('undo-toast').hidden, bar: getComputedStyle(document.querySelector('#kcal-dial .ch-dial__fill')).strokeDasharray }));
    assert.equal(mid.pop, true, 'the tapped card pops'); assert.equal(mid.toast, true);
    assert.equal(await page.locator('#now').getAttribute('data-meal-slot'), 'L', 'the logged meal holds its place for a beat'); assert.equal(await card.getAttribute('aria-pressed'), 'true', 'with its gold tick');
    const seen = new Set([mid.text]); for (let i = 0; i < 8; i++) { await sleep(40); seen.add(await page.locator('#remaining').evaluate(e => e.textContent)); }
    assert.ok(seen.size >= 3, 'kcal left counts down: ' + [...seen].join(' '));
    await page.waitForFunction(() => document.getElementById('now').dataset.now === 'session', null, { timeout: 2000 });
    assert.equal(await page.locator('#now.is-arriving').count(), 1, 'the session rises into the top spot (water has its own card)');
    await settle();
    assert.equal(await page.locator('#remaining').evaluate(e => e.textContent), '1,185', 'and lands on the exact value');
    const ring = await page.locator('#kcal-dial .ch-dial__fill').evaluate(e => ({ now: getComputedStyle(e).strokeDasharray, glide: getComputedStyle(e).transitionProperty }));
    assert.notEqual(ring.now, mid.bar, 'the ring glided to its new length'); assert.match(ring.glide, /stroke-dasharray/); assert.match(ring.now, /^37\.6/, 'and stops at 715 of 1,900: ' + ring.now);
    assert.match(await page.locator('#protein-dial .ch-dial__fill').evaluate(e => getComputedStyle(e).strokeDasharray), /^49\.0/, 'the protein ring too (108 of 220)');

    // 2. Undo from the toast: instant state, the toast leaves. A toast left alone goes after six seconds. Pops.
    const buzz = await page.evaluate(() => window.qaBuzz.length);
    await page.locator('#undo-toast button').tap();
    assert.equal((await day()).picks?.L, undefined, 'Undo leaves no trace'); assert.ok(await page.evaluate(() => window.qaBuzz.length) > buzz);
    await page.locator('#undo-toast').waitFor({ state: 'hidden' }); await settle();
    await sleep(450); await later(true);
    await page.locator('#later-more [data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-on').count(), 1, 'the chip pops');
    await page.locator('#undo-toast').waitFor({ state: 'visible' }); const shown = Date.now();
    await page.locator('#undo-toast').waitFor({ state: 'hidden', timeout: 9000 }); assert.ok(Date.now() - shown > 5000, 'the Undo window stays open for about six seconds');
    await page.locator('#later-more [data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-off').count(), 1); await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    await later(false);
    // Water: one tap on the card; its + pops and the next pip fills.
    await sleep(450); await page.evaluate(() => scrollTo(0, 0)); await page.locator('#water12').tap();
    assert.equal(await page.locator('.ch-watercard.just-on').count(), 1, 'the water card pops'); assert.equal((await day()).water, .5); assert.equal(await page.locator('#water12 .ch-watercard__pips i.is-on').count(), 1);
    await page.locator('#undo-toast button').tap(); await settle();
    // The hero flips to what was eaten with a movement, and back.
    await sleep(450); await page.locator('#left-line').tap(); assert.equal(await page.locator('#left-line.is-flipping').count(), 1, 'the hero flips'); assert.equal(await page.locator('#remaining-label').textContent(), 'Calories eaten');
    await settle(); await sleep(450); await page.locator('#left-line').tap(); await settle(); assert.equal(await page.locator('#remaining-label').textContent(), 'Calories left');

    // 3. Sheets leave with an animation however they are dismissed, and the page is usable right after.
    for (const dismiss of [() => page.locator('[data-close=builder-sheet]').tap(), () => page.keyboard.press('Escape'), () => page.touchscreen.tap(196, 24)]) {   // the backdrop: above the tall sheet
      await sleep(450); await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.locator('#add-food').tap(); assert.equal(await page.locator('#builder-sheet').isVisible(), true); await sleep(520);
      await dismiss();
      assert.equal(await page.locator('#builder-sheet').evaluate(d => d.open && d.classList.contains('is-closing')), true, 'closing is animated, not cut');
      await page.locator('#builder-sheet').waitFor({ state: 'hidden', timeout: 2000 });
      assert.equal(await page.locator('#builder-sheet').evaluate(d => d.className), 'ch-sheet ch-builder');
    }
    await sleep(450); await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    await page.locator('#now [data-slot=L][data-tier=M]').tap(); assert.equal((await day()).picks.L, 'M', 'the page works right after'); await page.locator('#undo-toast button').tap();
    await settle();

    // 4. Drag to dismiss: follows the finger, dims the backdrop less, closes past the threshold or on a flick.
    const sheet = page.locator('#detail-sheet');
    const open = async () => {                                     // a long press on a lunch option opens its sheet
      const target = page.locator('#now .meal-pick').first(); await target.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(450);
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await sleep(650); await page.mouse.up();
      await sheet.waitFor({ state: 'visible' }); await sleep(560); return sheet.boundingBox();
    };
    let box = await open();
    await drag([[196, box.y + 10], [196, box.y + 40], [196, box.y + 90], [196, box.y + 150]]);
    const dragging = await sheet.evaluate(d => ({ cls: d.classList.contains('is-dragging'), y: new DOMMatrix(getComputedStyle(d).transform).m42, drag: +d.style.getPropertyValue('--drag') }));
    assert.equal(dragging.cls, true); assert.ok(Math.abs(dragging.y - 140) < 3, 'the sheet follows the finger: ' + dragging.y); assert.ok(dragging.drag > 0.1 && dragging.drag < 0.6);
    await drag([[196, box.y + 150], [196, box.y + 230]]); await touch('touchEnd');
    await sheet.waitFor({ state: 'hidden', timeout: 2000 }); assert.equal(await sheet.evaluate(d => d.style.transform + d.style.getPropertyValue('--drag') + d.className), 'ch-sheet');
    box = await open();
    await drag([[196, box.y + 10], [196, box.y + 30], [196, box.y + 52], [196, box.y + 52], [196, box.y + 52]], 60); await touch('touchEnd');
    await sleep(900); assert.equal(await sheet.isVisible(), true, 'a short pull springs back'); assert.equal(await sheet.evaluate(d => getComputedStyle(d).transform), 'none'); assert.equal(await sheet.evaluate(d => d.classList.contains('is-dragging')), false);
    await drag([[196, box.y + 10], [196, box.y - 40], [196, box.y - 110]]);
    const up = await sheet.evaluate(d => new DOMMatrix(getComputedStyle(d).transform).m42); assert.ok(up < 0 && up > -45, 'rubber band: ' + up);
    await touch('touchEnd'); await sleep(700); assert.equal(await sheet.isVisible(), true);
    await touch('touchStart', 196, box.y + 10); await touch('touchMove', 196, box.y + 30); await touch('touchMove', 196, box.y + 70); await touch('touchEnd');
    await sheet.waitFor({ state: 'hidden', timeout: 2000 });
    await page.setViewportSize({ width: 393, height: 320 }); box = await open();                    // short enough that the meal sheet scrolls
    const body = sheet.locator('.ch-sheet__body'), scrollable = await body.evaluate(b => b.scrollHeight > b.clientHeight + 70);
    assert.equal(scrollable, true, 'the short screen makes the sheet content scroll');
    await body.evaluate(b => { b.scrollTop = 60; });
    const inside = await body.boundingBox();
    await drag([[196, inside.y + 60], [196, inside.y + 100], [196, inside.y + 160], [196, inside.y + 220]]); await touch('touchEnd'); await sleep(500);
    assert.equal(await sheet.isVisible(), true, 'scrolled content scrolls instead of dismissing'); assert.equal(await sheet.evaluate(d => getComputedStyle(d).transform), 'none');
    await body.evaluate(b => { b.scrollTop = 0; }); await sleep(100);
    await drag([[196, inside.y + 60], [196, inside.y + 110], [196, inside.y + 200], [196, inside.y + 300]]); await touch('touchEnd');
    await sheet.waitFor({ state: 'hidden', timeout: 2000 });
    await page.setViewportSize({ width: 393, height: 852 }); await settle();

    // 5. Days: the page tracks the finger, the date flips on release, a ghost of the old day leaves, nothing lingers.
    await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    const title = () => page.locator('#journey-day').evaluate(e => e.textContent), start = await title();
    await drag([[330, 420], [300, 421], [240, 422], [180, 424]]);
    const tracking = await page.locator('#day-page').evaluate(e => ({ x: new DOMMatrix(getComputedStyle(e).transform).m41, opacity: +getComputedStyle(e).opacity }));
    assert.ok(tracking.x < -60 && tracking.x > -110, 'the page follows the finger with resistance: ' + tracking.x); assert.ok(tracking.opacity < 1);
    assert.equal(await title(), start, 'nothing changes until release');
    await touch('touchEnd');
    assert.notEqual(await title(), start, 'the day flips the moment the finger lifts'); assert.equal(await page.locator('.ch-page-ghost').count(), 1);
    assert.equal(await page.locator('.ch-page-ghost [id]').count(), 0, 'the ghost carries no duplicate ids'); assert.equal(await page.locator('#return-today').isVisible(), true);
    await settle(); assert.equal(await page.locator('#day-page').evaluate(e => e.getAttribute('style') || ''), '');
    await drag([[200, 420], [190, 420], [170, 421], [162, 421], [162, 421], [162, 421]], 70); const held = await title(); await touch('touchEnd');
    assert.equal(await title(), held); await settle(); assert.equal(await page.locator('#day-page').evaluate(e => e.getAttribute('style') || ''), '');
    await page.locator('#return-today').tap(); assert.equal(await title(), start); assert.equal(await page.locator('.ch-page-ghost').count(), 1); await settle();
    await sleep(450); await page.locator('#week .ch-week__day').first().tap(); assert.notEqual(await title(), start, 'a day in the week strip opens at once'); assert.equal(await page.locator('.ch-page-ghost').count(), 1, 'with the same push'); await settle();
    await page.locator('#return-today').tap(); await settle();

    // 6. Tabs: the active pill slides, the incoming view rises; Settings lights no tab.
    await page.locator('[data-view=history]').tap();
    assert.equal(await page.locator('.ch-tabbar').evaluate(e => e.style.getPropertyValue('--i')), '2'); assert.equal(await page.locator('#history.is-entering').count(), 1);
    const pill = await page.locator('.ch-tabbar').evaluate(b => { const t = b.querySelector('[data-view=history]'); return { x: parseFloat(b.style.getPropertyValue('--pill-x')), w: parseFloat(b.style.getPropertyValue('--pill-w')), centre: t.offsetLeft + t.offsetWidth / 2 }; });
    assert.ok(Math.abs(pill.x + pill.w / 2 - pill.centre) < 2, 'the pill sits under Progress, not under the +: ' + JSON.stringify(pill));
    assert.equal(await page.locator('#history canvas').count(), 3, 'three charts: calories, protein, water (weight only with weigh-ins)'); await settle();
    await page.locator('[data-view=today]').tap(); await settle();
    await page.locator('#open-settings').tap(); assert.equal(await page.locator('.ch-tabbar.is-none').count(), 1); assert.equal(await page.locator('#settings.is-entering').count(), 1); await settle();
    await page.locator('#close-settings').tap(); await settle();

    // 7. Gym mode: it rises in; a set pops with a tick (no XP); the rest ring runs down; the next exercise slides in; the
    //    finish trophy springs up, the numbers count up, confetti and a success buzz; then it all cleans up.
    await page.locator('[data-view=training]').tap(); await settle();
    await page.locator('.is-today [data-gym-start]').tap();
    assert.equal(await page.locator('#gym.is-entering').count(), 1, 'Gym mode rises in'); await settle();
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('#gym-go').tap();
    assert.equal(await page.locator('.ch-gym__dot.just-on').count(), 1, 'the dot pops'); assert.equal(await page.locator('.xp-pop').count(), 0, 'no XP floats up'); assert.ok(await page.evaluate(() => window.qaBuzz.length) >= 1);
    const arc = () => page.locator('#gym-arc').evaluate(e => parseFloat(getComputedStyle(e).strokeDashoffset));
    const a1 = await arc(); await sleep(1600); const a2 = await arc(); assert.ok(a2 > a1, 'the rest ring runs down: ' + a1 + ' -> ' + a2);
    assert.equal(await page.locator('#gym-arc').evaluate(e => getComputedStyle(e).transitionProperty.includes('stroke-dashoffset')), true, 'smoothly');
    await page.locator('[data-gym=skip]').tap(); await page.locator('#gym-go').tap(); await page.locator('[data-gym=skip]').tap(); await page.locator('[data-gym=next]').tap();
    assert.equal(await page.locator('#gym-stage.is-next').count(), 1, 'the next exercise slides in'); await settle();
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('[data-gym=finish]').tap();
    assert.equal(await page.locator('#gym-done').isVisible(), true); assert.equal(await page.locator('.ch-gym__trophy').evaluate(e => getComputedStyle(e).animationName), 'ch-trophy');
    const sets = new Set(); for (let i = 0; i < 8; i++) { sets.add(await page.locator('#gym-done-time').innerText() + '/' + await page.locator('#gym-done-sets').innerText()); await sleep(40); }
    await page.waitForFunction(() => document.getElementById('gym-done-sets').textContent === '2');
    assert.ok(sets.size >= 2, 'the numbers count up: ' + [...sets].join(' '));
    await page.locator('.ch-confetti').waitFor({ state: 'attached', timeout: 2000 }); assert.ok(await page.evaluate(() => window.qaBuzz.some(p => Array.isArray(p))), 'a success buzz');
    await page.locator('.ch-confetti').waitFor({ state: 'detached', timeout: 4000 });
    await page.locator('[data-gym=done]').tap(); assert.equal(await page.locator('#gym').isVisible(), false); await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    await page.locator('[data-view=today]').tap(); await settle();

    // 8. A photo: the camera fades in, the shutter flashes, the Analysing… ring creeps towards done, the card slides up
    //    by itself, and Done sends the food rising into Recently eaten.
    await page.locator('#open-camera').tap();
    assert.equal(await page.locator('#camera12').evaluate(d => d.classList.contains('is-opening') && getComputedStyle(d).animationName), 'ch-fade', 'the camera fades in');
    await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await settle();
    await page.locator('#camera12-shutter').tap(); assert.equal(await page.locator('#camera12.is-shot').count(), 1, 'the shutter flashes');
    await page.waitForFunction(() => document.querySelector('#recent12 .ch-food.is-pending .ch-pend__fill'));
    const creep = () => page.locator('#recent12 .ch-food.is-pending .ch-pend__fill').evaluate(e => parseFloat(e.style.strokeDasharray));
    const c1 = await creep(); await sleep(900); const c2 = await creep(); assert.ok(c2 > c1 && c2 < 100, 'the Analysing… ring creeps towards done: ' + c1 + ' -> ' + c2);
    assert.equal(await page.locator('#recent12 .ch-food.is-pending .ch-food__skel i').first().evaluate(e => getComputedStyle(e).animationName), 'ch-shimmer', 'the placeholder lines shimmer');
    await page.waitForFunction(() => document.getElementById('nutrition12').open, null, { timeout: 8000 });
    assert.equal(await page.locator('#nutrition12').evaluate(d => d.classList.contains('is-opening') && getComputedStyle(d).animationName), 'ch-sheet-in', 'the card slides up'); await settle();
    await page.locator('#n12-more').tap(); assert.equal(await page.locator('#n12-kcal').inputValue(), '900', 'servings change the numbers at once');
    await page.locator('#n12-done').tap(); await page.waitForFunction(() => document.querySelector('#recent12 [data-entry].just-on'), null, { timeout: 3000 });   // the food rises into Recently eaten (after its photo is kept)
    const id = (await saved(page)).entries.at(-1).id;
    assert.equal(await page.locator(`#recent12 [data-entry="${id}"]`).count(), 1, 'the logged food is in Recently eaten'); await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    assert.equal(await page.locator('#nutrition12').evaluate(d => d.open), false);

    // 9. Preferences are honoured: haptics off means silence; reduced motion means no movement at all.
    await page.locator('#open-settings').tap(); await page.locator('#haptics-toggle').uncheck(); assert.equal((await saved(page)).haptics, false);
    await page.locator('#close-settings').tap(); await page.evaluate(() => { window.qaBuzz.length = 0; }); await later(true);
    await page.locator('#later-more [data-quest=steps]').tap(); assert.equal(await page.evaluate(() => window.qaBuzz.length), 0, 'no haptics when switched off');
    await page.evaluate(() => CHADUX.hideToast(true)); await settle(); await later(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => scrollTo(0, 0)); await page.locator('#now [data-slot=L][data-tier=S]').tap();
    const still = await page.evaluate(() => ({ animations: document.getAnimations().length, left: document.getElementById('remaining').textContent, expected: Math.round(1900 - JSON.parse(localStorage.getItem('rec-calories-v1')).entries.filter(e => e.day === CHADQuest.dayKey()).reduce((s, e) => s + e.kcal, 0)).toLocaleString(), now: document.getElementById('now').dataset.now }));
    assert.equal(still.animations, 0); assert.equal(still.left, still.expected, 'numbers jump straight to the value'); assert.equal(still.now, 'meal', 'and the next thing (dinner: the gym is done) is there at once');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.ch-page-ghost').count(), 0);
    await page.locator('#add-food').scrollIntoViewIfNeeded(); await page.locator('#add-food').tap(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#builder-sheet').isVisible(), false, 'sheets close at once');
    assert.deepEqual(errors, []);
    console.log('PASS v12 motion: data-first taps with a haptic tick, the card pop and its gold tick held for a beat, the hero counting down and its rings gliding (stroke-dasharray), the session rising into the top spot; chip and water-card pops; the hero flipping to eaten and back; Undo toast in/out and a 6 s lifetime; animated close by button/Escape/backdrop; drag-to-dismiss with finger tracking, backdrop fade, threshold, flick, rubber band and scroll-first; the day swipe with tracking, release flip, ghost and clean-up, and the week strip; the tab pill under its tab (not the +), rising views, three charts, Settings lighting no tab; Gym mode entrance, set pop (no XP), the rest ring, slide-in, finish trophy, counting numbers, confetti and success buzz; the camera fading in, the shutter flash, the Analysing ring creeping and shimmering placeholders, the card sliding up, the logged food rising; haptics off is silent; reduced motion moves nothing.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
