// Motion and feedback with animations ON (every other suite runs with reduced motion): haptics, count-up, ring
// transition, check pops, reorder glide, toast, animated sheet close, drag-to-dismiss, interactive day swipe, and
// Gym mode (entrance, a set's pop and XP, the rest ring running down, the next exercise sliding in, the finish trophy,
// count-up and confetti). The rule under test: state changes immediately; motion decorates and always cleans up.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = await serve(8092), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'no-preference' }), page = await context.newPage(), errors = watch(page);
    await page.addInitScript(() => { window.qaBuzz = []; Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(pattern) { window.qaBuzz.push(pattern); return true; } }); });
    await page.clock.install({ time: new Date(NOON) });                                             // noon in Darwin: lunch is the meal on top
    await page.goto('http://127.0.0.1:8092/'); await page.waitForFunction(() => window.CHADMotion && document.querySelector('.meal-pick'));
    assert.equal(await page.evaluate(() => CHADMotion.reduced()), false);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const drag = async (points, pause = 24) => { await touch('touchStart', ...points[0]); for (const p of points.slice(1)) { await sleep(pause); await touch('touchMove', ...p); } };
    const settle = () => page.waitForFunction(() => !document.querySelector('.ch-page-ghost,.xp-pop,.is-closing,.is-dragging,.just-on,.just-off,.is-entering,.ch-confetti') && document.getAnimations().every(a => a.animationName === 'ch-life' || a.animationName === 'ch-breathe' || a.animationName === 'ch-glow' || a.playState !== 'running'), null, { timeout: 5000 });
    const today = await page.evaluate(() => CHADQuest.dayKey()), day = async () => (await saved(page)).questsV5?.[today] || {};
    const wrap = async () => { if (!await page.locator('#today [data-quest=sleep]').count()) { await page.locator('[data-row=wrap]').tap(); await sleep(450); } };

    // 1. One tap on a meal: saved at once; haptic tick; the card pops and its tick lands in place; XP floats; numbers count;
    //    ring glides; a beat later the next meal takes the top and the logged one ticks into its line.
    const slot = await page.locator('#next-up').getAttribute('data-meal-slot'), card = page.locator(`[data-slot=${slot}][data-tier=S]`);
    const kcal = await page.evaluate(slot => Math.round(CHADPlan.find(s => s.id === slot).choices[0].macros[0]).toLocaleString(), slot);
    await card.tap();
    assert.equal((await day()).picks[slot], 'S', 'the journal is written before anything animates');
    assert.ok((await page.evaluate(() => window.qaBuzz.length)) >= 1, 'haptic feedback fired');
    const mid = await page.evaluate(() => ({ text: document.getElementById('consumed').textContent, p1: +getComputedStyle(document.getElementById('activity-rings')).getPropertyValue('--p1'), pop: !!document.querySelector('.ch-opt.just-on'), floater: document.querySelector('.xp-pop')?.textContent || '', toast: !document.getElementById('undo-toast').hidden }));
    assert.equal(mid.pop, true, 'the tapped card pops'); assert.match(mid.floater, /^\+\d+ XP$/); assert.equal(mid.toast, true);
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), slot, 'the logged meal holds its place for a beat'); assert.equal(await card.getAttribute('aria-pressed'), 'true');
    const seen = new Set([mid.text]); for (let i = 0; i < 8; i++) { await sleep(40); seen.add(await page.locator('#consumed').evaluate(e => e.textContent)); }
    assert.ok(seen.size >= 3, 'the calorie number counts up: ' + [...seen].join(' '));
    await page.waitForFunction(slot => document.getElementById('next-up')?.dataset.mealSlot !== slot, slot, { timeout: 2000 });
    assert.equal(await page.locator('#next-up.is-arriving').count(), 1, 'the next meal rises into the top spot');
    assert.equal(await page.locator(`[data-meal-row=${slot}]`).evaluate(e => e.classList.contains('just-on') && e.classList.contains('is-logged')), true, 'and the logged one ticks into its line');
    await settle();
    assert.equal(await page.locator('#consumed').evaluate(e => e.textContent), kcal, 'and lands on the exact value');
    const target = await page.evaluate(() => +document.getElementById('activity-rings').style.getPropertyValue('--p1'));
    assert.ok(mid.p1 >= 0 && mid.p1 < target, 'the ring was still filling right after the tap'); assert.ok(Math.abs(await page.evaluate(() => +getComputedStyle(document.getElementById('activity-rings')).getPropertyValue('--p1')) - target) < 1e-6);
    assert.equal(await page.locator('[data-flip]').evaluateAll(n => n.every(e => getComputedStyle(e).transform === 'none')), true, 'nothing is left displaced');

    // 2. Undo from the toast: instant state, the toast leaves, the card settles. A toast left alone goes after six seconds.
    const buzz = await page.evaluate(() => window.qaBuzz.length);
    await page.locator('#undo-toast button').tap();
    assert.equal((await day()).picks?.[slot], undefined, 'Undo leaves no trace'); assert.ok(await page.evaluate(() => window.qaBuzz.length) > buzz);
    await page.locator('#undo-toast').waitFor({ state: 'hidden' }); await settle();
    await sleep(450); await wrap();
    await page.locator('#today [data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-on').count(), 1, 'the chip pops');
    await page.locator('#undo-toast').waitFor({ state: 'visible' }); const shown = Date.now();
    await page.locator('#undo-toast').waitFor({ state: 'hidden', timeout: 9000 }); assert.ok(Date.now() - shown > 5000, 'the Undo window stays open for about six seconds');
    await page.locator('#today [data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-off').count(), 1); await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    // Water: the next bottle fills with a pop.
    await page.locator('.water-row').tap(); assert.equal(await page.locator('.bottle.just-on').count(), 1); assert.equal((await day()).water, .5);
    await page.locator('#undo-toast button').tap(); await settle();

    // 3. Sheets leave with an animation however they are dismissed, and the page is usable right after.
    for (const dismiss of [() => page.locator('[data-close=add-sheet]').tap(), () => page.keyboard.press('Escape'), () => page.touchscreen.tap(196, 60)]) {
      await sleep(450); await page.locator('#today-scan').tap(); assert.equal(await page.locator('#add-sheet').isVisible(), true); await sleep(520);
      await dismiss();
      assert.equal(await page.locator('#add-sheet').evaluate(d => d.open && d.classList.contains('is-closing')), true, 'closing is animated, not cut');
      await page.locator('#add-sheet').waitFor({ state: 'hidden', timeout: 2000 });
      assert.equal(await page.locator('#add-sheet').evaluate(d => d.className), 'ch-sheet');
    }
    await sleep(450); await page.locator('#today [data-quest=cardio]').tap(); assert.equal((await day()).cardio, true); await page.locator('#undo-toast button').tap();
    await sleep(450); await page.locator('#today-scan').tap(); await page.locator('[data-add=manual]').tap(); assert.equal(await page.locator('dialog[open]').count(), 1); assert.equal(await page.locator('#manual-sheet').isVisible(), true); await page.keyboard.press('Escape'); await page.locator('#manual-sheet').waitFor({ state: 'hidden' });
    await settle();

    // 4. Drag to dismiss: follows the finger, dims the backdrop less, closes past the threshold or on a flick.
    const sheet = page.locator('#detail-sheet');
    const open = async () => {                                     // a long press on the meal on top opens its sheet
      const target = page.locator('#next-up .meal-pick').first(); await target.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(450);   // clear of the header and the dock
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
    await page.setViewportSize({ width: 393, height: 400 }); box = await open();                    // short enough that even the shortest meal sheet scrolls
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
    await page.evaluate(() => scrollTo(0, 0));
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

    // 6. Tabs: the active pill slides, the incoming view rises.
    await page.locator('[data-view=history]').tap();
    assert.equal(await page.locator('.ch-tabbar').evaluate(e => e.style.getPropertyValue('--i')), '2'); assert.equal(await page.locator('#history.is-entering').count(), 1);
    assert.equal(await page.locator('#charts canvas').count(), 9); await settle();
    await page.locator('[data-view=today]').tap(); await settle();

    // 7. Gym mode: it rises in; a set pops with XP and a tick; the rest ring runs down; the next exercise slides in;
    //    the finish trophy springs up, the numbers count up, confetti and a success buzz; then it all cleans up.
    await page.locator('[data-view=training]').tap(); await settle();
    await page.locator('.is-today [data-gym-start]').tap();
    assert.equal(await page.locator('#gym.is-entering').count(), 1, 'Gym mode rises in'); await settle();
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('#gym-go').tap();
    assert.equal(await page.locator('.ch-gym__dot.just-on').count(), 1, 'the dot pops'); assert.match(await page.locator('.xp-pop').first().innerText(), /^\+5 XP$/); assert.ok(await page.evaluate(() => window.qaBuzz.length) >= 1);
    const arc = () => page.locator('#gym-arc').evaluate(e => parseFloat(getComputedStyle(e).strokeDashoffset));
    const a1 = await arc(); await sleep(1600); const a2 = await arc(); assert.ok(a2 > a1, 'the rest ring runs down: ' + a1 + ' -> ' + a2);
    assert.equal(await page.locator('#gym-arc').evaluate(e => getComputedStyle(e).transitionProperty.includes('stroke-dashoffset')), true, 'smoothly');
    await page.locator('[data-gym=skip]').tap(); await page.locator('[data-gym=next]').tap();
    assert.equal(await page.locator('#gym-stage.is-next').count(), 1, 'the next exercise slides in'); await settle();
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('[data-gym=finish]').tap();
    assert.equal(await page.locator('#gym-done').isVisible(), true); assert.equal(await page.locator('.ch-gym__trophy').evaluate(e => getComputedStyle(e).animationName), 'ch-trophy');
    const xp = new Set(); for (let i = 0; i < 8; i++) { xp.add(await page.locator('#gym-done-xp').innerText()); await sleep(60); }
    assert.ok(xp.size >= 3, 'the XP counts up: ' + [...xp].join(' ')); await page.waitForFunction(() => document.getElementById('gym-done-xp').textContent === '+75');
    await page.locator('.ch-confetti').waitFor({ state: 'attached', timeout: 2000 }); assert.ok(await page.evaluate(() => window.qaBuzz.some(p => Array.isArray(p))), 'a success buzz');
    await page.locator('.ch-confetti').waitFor({ state: 'detached', timeout: 4000 });
    await page.locator('[data-gym=done]').tap(); assert.equal(await page.locator('#gym').isVisible(), false); await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    await page.locator('[data-view=today]').tap(); await settle();

    // 8. A perfect day closes the rings: confetti, a success buzz, the S rank, and it cleans up.
    for (const id of ['L', 'D', 'P']) { const option = page.locator(`[data-slot=${id}][data-tier=S]`); if (!await option.count()) { await page.locator(`[data-meal-row=${id}]`).tap(); await sleep(450); } await option.tap(); await sleep(760); }
    while (!(await page.locator('.water-row.is-full').count())) await page.locator('.water-row').tap();
    await sleep(450); await wrap(); await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('#today [data-quest=steps]').tap();
    assert.equal(await page.locator('#quest-total').evaluate(e => e.__chTo), 17);
    await page.locator('.ch-confetti').waitFor({ state: 'attached', timeout: 2000 });
    assert.equal(await page.locator('#activity-rings.is-closed').count(), 1); assert.ok(await page.evaluate(() => window.qaBuzz.some(p => Array.isArray(p))), 'a success pattern, not just a tick');
    assert.match(await page.locator('#celebration').innerText(), /S rank/);
    await page.locator('.ch-confetti').waitFor({ state: 'detached', timeout: 4000 });
    await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    assert.equal(await page.locator('#quest-total').evaluate(e => e.textContent), '17'); assert.equal(await page.locator('#quest-grade').innerText(), 'S');

    // 9. Preferences are honoured: haptics off means silence; reduced motion means no movement at all.
    await page.locator('[data-view=settings]').tap(); await page.locator('#haptics-toggle').uncheck(); assert.equal((await saved(page)).haptics, false);
    await page.locator('[data-view=today]').tap(); await page.evaluate(() => { window.qaBuzz.length = 0; }); await wrap();
    await page.locator('#today [data-quest=cardio]').tap(); assert.equal(await page.evaluate(() => window.qaBuzz.length), 0, 'no haptics when switched off');
    await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-meal-row=L]').tap(); await page.locator('[data-slot=L][data-tier=S]').tap();     // open lunch, tap its logged option: removed
    const still = await page.evaluate(() => ({ floater: !!document.querySelector('.xp-pop'), animations: document.getAnimations().length, consumed: document.getElementById('consumed').textContent, expected: Math.round(JSON.parse(localStorage.getItem('rec-calories-v1')).entries.filter(e => e.day === CHADQuest.dayKey()).reduce((s, e) => s + e.kcal, 0)).toLocaleString() }));
    assert.equal(still.floater, false); assert.equal(still.animations, 0); assert.equal(still.consumed, still.expected, 'numbers jump straight to the value');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.ch-page-ghost').count(), 0);
    await page.locator('#today-scan').tap(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#add-sheet').isVisible(), false, 'sheets close at once');
    assert.deepEqual(errors, []);
    console.log('PASS v10 motion: data-first taps with haptic tick, card pop and in-place tick, XP floater, count-up, spring ring fill, next meal rising into the top spot and the logged one ticking into its line; chip and bottle pops; Undo toast in/out and 6 s lifetime; animated close by button/Escape/backdrop; drag-to-dismiss with finger tracking, backdrop fade, threshold, flick, rubber band and scroll hand-off; interactive day swipe with ghost push and spring-back; sliding tab pill and view entrance; Gym mode entrance, set pop with +5 XP and haptic, rest ring running down smoothly, next exercise sliding in, finish trophy, XP count-up, confetti and success buzz; 17/17 confetti with S rank; haptics-off and reduced-motion honoured; everything cleans up; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
