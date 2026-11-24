// Motion and feedback with animations ON (every other suite runs with reduced motion): haptics, count-up, ring
// transition, check pops, reorder glide, toast, animated sheet close, drag-to-dismiss, interactive day swipe.
// The rule under test: state changes immediately; motion decorates and always cleans up after itself.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE } = require('./harness.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = await serve(8092), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'no-preference' }), page = await context.newPage(), errors = watch(page);
    await page.addInitScript(() => { window.qaBuzz = []; Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(pattern) { window.qaBuzz.push(pattern); return true; } }); });
    await page.goto('http://127.0.0.1:8092/'); await page.waitForFunction(() => window.CHADMotion && document.querySelector('.meal-pick'));
    assert.equal(await page.evaluate(() => CHADMotion.reduced()), false);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const drag = async (points, pause = 24) => { await touch('touchStart', ...points[0]); for (const p of points.slice(1)) { await sleep(pause); await touch('touchMove', ...p); } };
    const settle = () => page.waitForFunction(() => !document.querySelector('.ch-page-ghost,.xp-pop,.is-closing,.is-dragging,.just-on,.just-off,.is-entering') && document.getAnimations().every(a => a.animationName === 'ch-life' || a.playState !== 'running'), null, { timeout: 5000 });
    const today = await page.evaluate(() => CHADQuest.dayKey()), day = async () => (await saved(page)).questsV5?.[today] || {};

    // 1. One tap on a meal: saved at once; haptic tick; the card pops and its tick lands in place; XP floats; numbers count;
    //    ring glides; a beat later the next meal takes the top and the logged one ticks into its row.
    const slot = await page.locator('#next-up').getAttribute('data-meal-slot'), card = page.locator(`[data-slot=${slot}][data-tier=S]`);
    const kcal = await page.evaluate(slot => Math.round(CHADPlan.find(s => s.id === slot).choices[0].macros[0]).toLocaleString(), slot);
    await card.tap();
    assert.equal((await day()).picks[slot], 'S', 'the journal is written before anything animates');
    assert.ok((await page.evaluate(() => window.qaBuzz.length)) >= 1, 'haptic feedback fired');
    const mid = await page.evaluate(() => ({ text: document.getElementById('consumed').textContent, p1: +getComputedStyle(document.getElementById('activity-rings')).getPropertyValue('--p1'), pop: !!document.querySelector('.ch-meal.just-on'), floater: document.querySelector('.xp-pop')?.textContent || '', gliding: [...document.querySelectorAll('[data-flip]')].filter(e => e.getAnimations().length).length, toast: !document.getElementById('undo-toast').hidden }));
    assert.equal(mid.pop, true, 'the tapped card pops'); assert.match(mid.floater, /^\+\d+ XP$/); assert.equal(mid.toast, true);
    assert.equal(await page.locator('#next-up').getAttribute('data-meal-slot'), slot, 'the logged meal holds its place for a beat'); assert.equal(await card.getAttribute('aria-pressed'), 'true');
    const seen = new Set([mid.text]); for (let i = 0; i < 8; i++) { await sleep(40); seen.add(await page.locator('#consumed').evaluate(e => e.textContent)); }
    assert.ok(seen.size >= 3, 'the calorie number counts up: ' + [...seen].join(' '));
    await page.waitForFunction(slot => document.getElementById('next-up')?.dataset.mealSlot !== slot, slot, { timeout: 2000 });
    assert.equal(await page.locator('#next-up.is-arriving').count(), 1, 'the next meal rises into the top spot');
    assert.equal(await page.locator(`[data-meal-row=${slot}]`).evaluate(e => e.classList.contains('just-on') && e.classList.contains('is-logged')), true, 'and the logged one ticks into its row');
    await settle();
    assert.equal(await page.locator('#consumed').evaluate(e => e.textContent), kcal, 'and lands on the exact value');
    const target = await page.evaluate(() => +document.getElementById('activity-rings').style.getPropertyValue('--p1'));
    assert.ok(mid.p1 >= 0 && mid.p1 < target, 'the ring was still filling right after the tap'); assert.ok(Math.abs(await page.evaluate(() => +getComputedStyle(document.getElementById('activity-rings')).getPropertyValue('--p1')) - target) < 1e-6);
    assert.equal(await page.locator('[data-flip]').evaluateAll(n => n.every(e => getComputedStyle(e).transform === 'none')), true, 'nothing is left displaced');

    // 2. Undo from the toast: instant state, the toast leaves, the card settles.
    const buzz = await page.evaluate(() => window.qaBuzz.length);
    await page.locator('#undo-toast button').tap();
    assert.equal((await day()).picks?.[slot], undefined, "Undo leaves no trace"); assert.ok(await page.evaluate(() => window.qaBuzz.length) > buzz);
    await page.locator('#undo-toast').waitFor({ state: 'hidden' }); await settle();
    // A toast left alone removes itself after six seconds.
    await page.locator('[data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-on').count(), 1);
    await page.locator('#undo-toast').waitFor({ state: 'visible' }); const shown = Date.now();
    await page.locator('#undo-toast').waitFor({ state: 'hidden', timeout: 9000 }); assert.ok(Date.now() - shown > 5000, 'the Undo window stays open for about six seconds');
    await page.locator('[data-quest=sleep]').tap(); assert.equal(await page.locator('.quest-chip.just-off').count(), 1); await page.evaluate(() => CHADUX.hideToast(true)); await settle();

    // 3. Sheets leave with an animation however they are dismissed, and the page is usable right after.
    for (const dismiss of [() => page.locator('[data-close=add-sheet]').tap(), () => page.keyboard.press('Escape'), () => page.touchscreen.tap(196, 60)]) {
      await page.locator('#today-scan').tap(); assert.equal(await page.locator('#add-sheet').isVisible(), true); await sleep(520);
      await dismiss();
      assert.equal(await page.locator('#add-sheet').evaluate(d => d.open && d.classList.contains('is-closing')), true, 'closing is animated, not cut');
      await page.locator('#add-sheet').waitFor({ state: 'hidden', timeout: 2000 });
      assert.equal(await page.locator('#add-sheet').evaluate(d => d.className), 'ch-sheet');
    }
    await page.locator('[data-quest=cardio]').tap(); assert.equal((await day()).cardio, true); await page.locator('#undo-toast button').tap();
    // Opening one sheet from another never stacks them.
    await page.locator('#today-scan').tap(); await page.locator('[data-add=manual]').tap(); assert.equal(await page.locator('dialog[open]').count(), 1); assert.equal(await page.locator('#manual-sheet').isVisible(), true); await page.keyboard.press('Escape'); await page.locator('#manual-sheet').waitFor({ state: 'hidden' });

    // 4. Drag to dismiss: follows the finger, dims the backdrop less, closes past the threshold or on a flick.
    const sheet = page.locator('#detail-sheet');
    const open = async () => { await page.locator('#next-up .meal-info').first().tap(); await sheet.waitFor({ state: 'visible' }); await sleep(560); return sheet.boundingBox(); };
    let box = await open();
    await drag([[196, box.y + 10], [196, box.y + 40], [196, box.y + 90], [196, box.y + 150]]);
    const dragging = await sheet.evaluate(d => ({ cls: d.classList.contains('is-dragging'), y: new DOMMatrix(getComputedStyle(d).transform).m42, drag: +d.style.getPropertyValue('--drag') }));
    assert.equal(dragging.cls, true); assert.ok(Math.abs(dragging.y - 140) < 3, 'the sheet follows the finger: ' + dragging.y); assert.ok(dragging.drag > 0.1 && dragging.drag < 0.6);
    await drag([[196, box.y + 150], [196, box.y + 230]]); await touch('touchEnd');
    await sheet.waitFor({ state: 'hidden', timeout: 2000 }); assert.equal(await sheet.evaluate(d => d.style.transform + d.style.getPropertyValue('--drag') + d.className), 'ch-sheet');
    // A short pull springs back and the sheet stays.
    box = await open();
    await drag([[196, box.y + 10], [196, box.y + 30], [196, box.y + 52], [196, box.y + 52], [196, box.y + 52]], 60); await touch('touchEnd');
    await sleep(900); assert.equal(await sheet.isVisible(), true); assert.equal(await sheet.evaluate(d => getComputedStyle(d).transform), 'none'); assert.equal(await sheet.evaluate(d => d.classList.contains('is-dragging')), false);
    // Pulling up only stretches a little (rubber band).
    await drag([[196, box.y + 10], [196, box.y - 40], [196, box.y - 110]]);
    const up = await sheet.evaluate(d => new DOMMatrix(getComputedStyle(d).transform).m42); assert.ok(up < 0 && up > -45, 'rubber band: ' + up);
    await touch('touchEnd'); await sleep(700); assert.equal(await sheet.isVisible(), true);
    // A fast flick closes even when short.
    await touch('touchStart', 196, box.y + 10); await touch('touchMove', 196, box.y + 30); await touch('touchMove', 196, box.y + 70); await touch('touchEnd');
    await sheet.waitFor({ state: 'hidden', timeout: 2000 });
    // From the content: a pull closes at the top, but scrolls when the content is scrolled.
    await page.setViewportSize({ width: 393, height: 470 }); box = await open();
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
    assert.equal(await page.locator('#week-strip').evaluate(e => getComputedStyle(e).getPropertyValue('--i').trim() === String((CHADQuest.weekday(CHADUX.dateKey()) + 6) % 7)), true, 'the week selection moved with it');
    // An abandoned swipe springs back.
    await drag([[200, 420], [190, 420], [170, 421], [162, 421], [162, 421], [162, 421]], 70); const held = await title(); await touch('touchEnd');
    assert.equal(await title(), held); await settle(); assert.equal(await page.locator('#day-page').evaluate(e => e.getAttribute('style') || ''), '');
    // Arrows and the Today pill use the same push.
    await page.locator('#return-today').tap(); assert.equal(await title(), start); assert.equal(await page.locator('.ch-page-ghost').count(), 1); await settle();

    // 6. Tabs: the active pill slides, the incoming view rises.
    await page.locator('[data-view=history]').tap();
    assert.equal(await page.locator('.ch-tabbar').evaluate(e => e.style.getPropertyValue('--i')), '2'); assert.equal(await page.locator('#history.is-entering').count(), 1);
    assert.equal(await page.locator('#charts canvas').count(), 9); await settle();
    await page.locator('[data-view=today]').tap(); await settle();

    // 7. A perfect day closes the rings: confetti, a success buzz, and it cleans up.
    // Any meal that is not on top opens from its row first; each log is given its beat before the next tap.
    for (const id of ['L', 'P', 'D', 'E']) { const option = page.locator(`[data-slot=${id}][data-tier=S]`); if (!await option.count()) await page.locator(`[data-meal-row=${id}]`).tap(); await option.tap(); await sleep(760); }
    while (!(await page.locator('.water-row.is-full').count())) await page.locator('.water-row').tap();
    await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('[data-quest=steps]').tap();
    assert.equal(await page.locator('#quest-total').evaluate(e => e.__chTo), 17);
    await page.locator('.ch-confetti').waitFor({ state: 'attached', timeout: 2000 });
    assert.equal(await page.locator('#activity-rings.is-closed').count(), 1); assert.ok(await page.evaluate(() => window.qaBuzz.some(p => Array.isArray(p))), 'a success pattern, not just a tick');
    assert.match(await page.locator('#celebration').innerText(), /S rank|Streak saved/);
    await page.locator('.ch-confetti').waitFor({ state: 'detached', timeout: 4000 });
    await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    assert.equal(await page.locator('#quest-total').evaluate(e => e.textContent), '17'); assert.equal(await page.locator('#quest-grade').innerText(), 'S');

    // 8. Preferences are honoured: haptics off means silence; reduced motion means no movement at all.
    await page.locator('[data-view=settings]').tap(); await page.locator('#haptics-toggle').uncheck(); assert.equal((await saved(page)).haptics, false);
    await page.locator('[data-view=today]').tap(); await page.evaluate(() => { window.qaBuzz.length = 0; });
    await page.locator('[data-quest=cardio]').tap(); assert.equal(await page.evaluate(() => window.qaBuzz.length), 0, 'no haptics when switched off');
    await page.evaluate(() => CHADUX.hideToast(true)); await settle();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-meal-row=L]').tap(); await page.locator('[data-slot=L][data-tier=S]').tap();     // open lunch, tap its logged option: removed
    const still = await page.evaluate(() => ({ floater: !!document.querySelector('.xp-pop'), animations: document.getAnimations().length, consumed: document.getElementById('consumed').textContent, expected: Math.round(JSON.parse(localStorage.getItem('rec-calories-v1')).entries.filter(e => e.day === CHADQuest.dayKey()).reduce((s, e) => s + e.kcal, 0)).toLocaleString() }));
    assert.equal(still.floater, false); assert.equal(still.animations, 0); assert.equal(still.consumed, still.expected, 'numbers jump straight to the value');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.ch-page-ghost').count(), 0);
    await page.locator('#today-scan').tap(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#add-sheet').isVisible(), false, 'sheets close at once');
    assert.deepEqual(errors, []);
    console.log('PASS v9 motion: data-first taps with haptic tick, card pop and in-place tick, XP floater, count-up, spring ring fill, next meal rising into the top spot and the logged one ticking into its row; Undo toast in/out and 6 s lifetime; animated close by button/Escape/backdrop; drag-to-dismiss with finger tracking, backdrop fade, threshold, flick, rubber band and scroll hand-off; interactive day swipe with ghost push and spring-back; sliding tab pill and view entrance; 17/17 confetti with success haptic; haptics-off and reduced-motion honoured; everything cleans up; zero console/page errors.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
