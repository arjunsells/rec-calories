// v12 photo logging, end to end, with synthetic data only: a canvas stands in for the camera, the proxy and Open Food
// Facts are stubbed inside the browser, and no real AI, camera, credential or food service is ever reached.
//   camera (live frame, corners, modes, flash), photo -> Analysing… card in Recently eaten -> nutrition card (auto-open)
//   -> servings, oil, ingredient grams (typed key by key), remove, add item, calories typed -> bookmark -> Fix with AI
//   (photo + correction) -> Done -> Undo/Redo -> edit -> Delete/Undo; Food label; Describe it; Search food; Saved;
//   barcode (native detector + stub OFF, and the typed digits); proxy offline / 401 / timeout / no token / 502 messages,
//   Retry, Search/Describe from the error, a reload mid-scan (the photo survives), Discard + Undo; the file-input
//   fallback without a live camera (shutter = system camera, Gallery = library), the 3-tap photo log, no h-scroll.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE } = require('./harness.cjs');
const PORT = 8107, ORIGIN = 'http://127.0.0.1:' + PORT, TOKEN = 'synthetic-device-token';
const OFFLINE = 'Photo AI is offline - your PC needs to be on. Search or describe it instead';
const wait = ms => new Promise(r => setTimeout(r, ms));
const again = () => wait(460);                                  // past the 400 ms slip guard and the touch shield

const PLATE = { name: 'Synthetic chicken plate', grams: 300, kcal: 600, protein_g: 60, carbs_g: 45, fat_g: 20, fibre_g: 6, sugar_g: 3, processed: false, confidence: 0.7,
  items: [{ name: 'Chicken', grams: 200, kcal: 400, protein_g: 55, carbs_g: 0, fat_g: 18 }, { name: 'Rice', grams: 100, kcal: 200, protein_g: 5, carbs_g: 45, fat_g: 2 }] };
const FIXED = { name: 'Smaller chicken plate', grams: 220, kcal: 450, protein_g: 48, carbs_g: 30, fat_g: 14, items: [{ name: 'Chicken', grams: 150, kcal: 300, protein_g: 44, carbs_g: 0, fat_g: 13 }, { name: 'Rice', grams: 70, kcal: 150, protein_g: 4, carbs_g: 30, fat_g: 1 }] };
const LABEL = { name: 'Synthetic protein bar', kcal: 210, protein_g: 20, carbs_g: 22, fat_g: 6, items: [] };
const WORDS = { name: 'Described chicken salad', kcal: 380, protein_g: 42, carbs_g: 12, fat_g: 17, items: [] };

(async () => {
  const server = await serve(PORT), browser = await launch();
  let mode = 'ok', calls = [], hold = [];
  // The proxy: answers by what was sent (a correction, a label, words only, or a photo).
  const proxy = async route => {
    const req = route.request(), body = req.postDataJSON() || {};
    calls.push({ body, token: req.headers()['x-chad-token'] });
    if (mode === 'hang') { hold.push(route); return; }
    if (mode === 'abort') return route.abort('internetdisconnected');
    await wait(700);
    if (mode === '401') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"token"}' });
    if (mode === '502') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"synthetic"}' });
    const text = String(body.text || '');
    const answer = /Correction:/.test(text) ? FIXED : /nutrition label/i.test(text) ? LABEL : !body.image ? WORDS : PLATE;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  };
  const off = route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 1, product: { product_name: 'Synthetic barcode meal', serving_size: '100 g', nutriments: { 'energy-kcal_100g': 225, proteins_100g: 20, carbohydrates_100g: 25, fat_100g: 5 } } }) });
  // A v11 journal (synthetic), the proxy on this origin, a device token.
  const journal = { schemaVersion: 5, appVersion: 11, target: 1900, proteinGoal: 220, carbsGoal: 150, fatGoal: 45, journeyStartDate: '2026-10-08', entries: [{ id: 'old-1', day: '2026-11-23', name: 'Synthetic lunch', kcal: 715, protein: 108, carbs: 1.1, fat: 30.8, meal: 'Lunch', source: 'plan', planSlot: 'L' }], questsV5: { '2026-11-23': { picks: { L: 'S' }, water: 4.5 } } };
  async function open({ camera = true, detector = false, token = true } = {}) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, ...IPHONE, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/estimate', proxy); await context.route('**/health', r => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
    await context.route('**/api/v2/product/**', off);
    await context.addInitScript(({ raw, origin, token, camera, detector }) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1'); localStorage.setItem('rec-calories-v1', raw);
        if (token) { localStorage.setItem('chad.aiProxyUrl', origin); localStorage.setItem('chad.aiProxyToken', token); }
      }
      if (camera) {
        // The "camera": a 1280 x 960 canvas, with a torch the app can switch.
        const c = document.createElement('canvas'); c.width = 1280; c.height = 960; const g = c.getContext('2d');
        const draw = () => { g.fillStyle = '#6b5a48'; g.fillRect(0, 0, 1280, 960); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(640, 480, 380, 0, 7); g.fill(); g.fillStyle = '#c98b3c'; g.fillRect(480, 360, 260, 160); };
        draw(); setInterval(draw, 100);
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { const s = c.captureStream(15), t = s.getVideoTracks()[0]; t.getCapabilities = () => ({ torch: true }); t.applyConstraints = async x => { window.__torch = x; }; window.__stream = s; return s; } } });
      } else Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
      if (detector) window.BarcodeDetector = class { constructor(o) { window.__formats = o.formats; } async detect() { return window.__barcode ? [{ rawValue: window.__barcode }] : []; } };
    }, { raw: JSON.stringify(journal), origin: ORIGIN, token: token ? TOKEN : '', camera, detector });
    await context.clock.install({ time: new Date('2026-11-24T12:20:00+09:30') });
    const page = await context.newPage(), errors = watch(page, t => /Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(t));
    await page.goto(ORIGIN + '/'); await page.waitForFunction(() => window.CHADScan12 && document.getElementById('nutrition12'));
    return { context, page, errors };
  }
  const value = (page, id) => page.locator('#' + id).inputValue();
  const cardOpen = page => page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'ready' && document.getElementById('n12-kcal'));
  const closed = page => page.waitForFunction(() => !document.getElementById('nutrition12').open);
  const photoSize = page => page.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => r(q.result); });
    const all = await new Promise(r => { const q = db.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => r(q.result); });
    const size = async src => { const i = new Image(); i.src = src; await i.decode(); return [i.naturalWidth, i.naturalHeight]; };
    return Promise.all(all.map(async p => ({ image: await size(p.image), thumbnail: await size(p.thumbnail) })));
  });
  try {
    /* ---- 1. the camera, a photo, the Analysing card, the nutrition card ---- */
    let { context, page, errors } = await open();
    await page.locator('#open-camera').click();
    await page.waitForFunction(() => document.getElementById('camera12').open && document.getElementById('camera12-video').videoWidth > 0);
    assert.equal(await page.locator('#camera12 .ch-cam__corners i').count(), 4, 'framing corners');
    assert.deepEqual(await page.locator('[data-mode12]').allInnerTexts(), ['Scan food', 'Barcode', 'Food label', 'Gallery']);
    for (const name of ['Search food', 'Saved', 'Describe it']) assert(await page.getByRole('button', { name, exact: true }).isVisible(), name + ' link');
    assert(await page.locator('#camera12-torch').isVisible(), 'flash shown when the camera has a torch');
    await page.locator('#camera12-torch').click(); assert.equal(await page.locator('#camera12-torch').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.evaluate(() => window.__torch), { advanced: [{ torch: true }] }, 'torch switched on');
    const box = await page.locator('#camera12-shutter').boundingBox(); assert(box.width >= 72 && box.height >= 72, 'big shutter');
    // Tap 1 was the + button. Tap 2: the shutter.
    mode = 'ok'; calls = [];
    await page.locator('#camera12-shutter').click();
    await page.waitForFunction(() => !document.getElementById('camera12').open);
    await page.waitForFunction(() => { const row = document.querySelector('#recent12 .ch-food.is-pending'); return row && /Analysing/.test(row.textContent) && row.querySelector('img') && row.querySelector('.ch-pend'); });
    assert.equal(await page.evaluate(() => window.__stream.getTracks().every(t => t.readyState === 'ended')), true, 'camera stopped when the sheet closed');
    await cardOpen(page);
    assert.equal(calls.length, 1); assert.equal(calls[0].token, TOKEN, 'X-Chad-Token from Settings');
    assert.match(calls[0].body.image, /^data:image\/jpeg;base64,/); assert.equal(calls[0].body.text, '', 'no words with a plain photo');
    const sizes = await photoSize(page); assert.deepEqual(sizes[0].image, [1024, 768], 'photo downscaled to 1024 px'); assert(Math.max(...sizes[0].thumbnail) <= 360, 'thumbnail 360 px');
    assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic chicken plate');
    assert.equal(await value(page, 'n12-kcal'), '600'); assert.equal(await value(page, 'n12-protein'), '60'); assert.equal(await value(page, 'n12-carbs'), '45'); assert.equal(await value(page, 'n12-fat'), '20');
    assert.equal(await page.locator('#health12').textContent(), '9/10', 'health score: 4 + 3.2 protein + 2 fibre - 0.2 sugar');
    assert.equal(await page.locator('#n12-parts .ch-ing').count(), 2); assert(await page.locator('#nutrition12 .ch-nut__photo img').isVisible(), 'hero photo');
    // Servings in halves.
    await page.locator('#n12-more').click(); assert.equal(await page.locator('#n12-servings').textContent(), '1.5'); assert.equal(await value(page, 'n12-kcal'), '900');
    await page.locator('#n12-less').click(); await page.locator('#n12-less').click(); assert.equal(await page.locator('#n12-servings').textContent(), '0.5'); assert.equal(await value(page, 'n12-kcal'), '300');
    assert.equal(await page.locator('#n12-less').isDisabled(), true, 'never below half a serving');
    await page.locator('#n12-more').click(); assert.equal(await value(page, 'n12-kcal'), '600');
    // + oil or sauce? adds a tablespoon: 120 kcal, 13.6 g fat.
    await page.locator('#n12-oil').click(); assert.equal(await value(page, 'n12-kcal'), '720'); assert.equal(await value(page, 'n12-fat'), '33.6');
    assert.match(await page.locator('#n12-oil').textContent(), /1 added/);
    // Grams typed key by key: the field keeps focus and the totals follow.
    const chicken = page.getByLabel('Grams of Chicken', { exact: true });
    await chicken.click(); await chicken.press('Control+A'); await chicken.pressSequentially('400', { delay: 40 });
    assert.equal(await chicken.evaluate(e => e === document.activeElement), true, 'typing grams is never interrupted');
    assert.equal(await chicken.inputValue(), '400'); assert.equal(await value(page, 'n12-kcal'), '1120');
    await page.getByRole('button', { name: 'Remove Rice', exact: true }).click(); assert.equal(await value(page, 'n12-kcal'), '920');
    await page.locator('#n12-add').click(); await page.locator('#n12-item-name').fill('Synthetic sauce'); await page.locator('#n12-item-grams').fill('20'); await page.locator('#n12-item-kcal').fill('10');
    await page.locator('#n12-additem').click(); assert.equal(await value(page, 'n12-kcal'), '930'); assert.equal(await page.locator('#n12-parts .ch-ing').count(), 3);
    // Calories typed straight in: the ingredients follow in proportion.
    await page.locator('#n12-kcal').fill('1000');
    const partsKcal = await page.locator('#n12-parts .ch-ing__kcal').allTextContents(); assert.equal(partsKcal.reduce((s, t) => s + parseFloat(t.replace(/,/g, '')), 0) >= 999, true, 'ingredients scaled to the typed total');
    await page.locator('#n12-name').fill('My chicken plate');
    // Bookmark: on, off, on (Undo-able changes in the journal).
    await page.locator('#nutrition12-save').click(); assert.equal(await page.locator('#nutrition12-save').getAttribute('aria-pressed'), 'true'); assert.equal((await saved(page)).savedFoods12.length, 1);
    await again(); await page.locator('#nutrition12-save').click(); assert.equal(await page.locator('#nutrition12-save').getAttribute('aria-pressed'), 'false'); assert.equal((await saved(page)).savedFoods12, undefined);
    await again(); await page.locator('#nutrition12-save').click(); assert.equal((await saved(page)).savedFoods12[0].kcal, 1000);
    // Fix with AI: a note, re-sent with the photo; what the card showed goes along.
    await page.locator('#n12-fix').click(); await page.locator('#n12-note').fill('Smaller portion, no sauce');
    await page.locator('#n12-send').click();
    await page.waitForFunction(() => document.getElementById('nutrition12').dataset.state === 'pending');
    await cardOpen(page);
    const fix = calls.at(-1).body; assert(fix.image, 'the photo goes with the correction');
    assert.match(fix.text, /Previous estimate: My chicken plate, 1,000 kcal/); assert.match(fix.text, /Correction: Smaller portion, no sauce$/); assert(fix.text.length <= 500);
    assert.equal(await value(page, 'n12-kcal'), '450'); assert.equal(await page.locator('#n12-name').inputValue(), 'Smaller chicken plate');
    // Tap 3: Done. Logged, with its photo id; no photo, token or note in the journal.
    const before = (await saved(page)).entries.length;
    await page.locator('#n12-done').click(); await closed(page);
    let j = await saved(page), entry = j.entries.at(-1);
    assert.equal(j.entries.length, before + 1); assert.equal(entry.kcal, 450); assert.equal(entry.source, 'photo'); assert(entry.photoId); assert.equal(entry.day, '2026-11-24');
    assert.equal(entry.ingredients12.length, 2); assert(!JSON.stringify(j).includes('data:image')); assert(!JSON.stringify(j).includes(TOKEN)); assert(!JSON.stringify(j).includes('Correction'));
    assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), 0, 'the draft is gone once logged');
    assert(await page.locator(`#recent12 [data-entry="${entry.id}"] img`).count(), 'the logged row shows its photo');
    // Undo / Redo.
    await again(); await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.length, before, 'Undo takes it back');
    await again(); await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.at(-1).id, entry.id, 'Redo puts it back');
    // Tap a logged row: the same card, to edit; Done saves the change; Undo puts the old one back.
    await again(); await page.locator(`#recent12 [data-entry="${entry.id}"]`).click(); await cardOpen(page);
    assert.equal(await page.locator('#nutrition12-title').textContent(), 'Edit food');
    await page.locator('#n12-name').fill('Edited plate'); await page.locator('#n12-done').click(); await closed(page);
    assert.equal((await saved(page)).entries.find(e => e.id === entry.id).name, 'Edited plate');
    await again(); await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.find(e => e.id === entry.id).name, 'Smaller chicken plate');
    // Delete from the card, and Undo.
    await again(); await page.locator(`#recent12 [data-entry="${entry.id}"]`).click(); await cardOpen(page);
    await page.locator('#n12-delete').click(); await closed(page); assert.equal((await saved(page)).entries.some(e => e.id === entry.id), false);
    await again(); await page.locator('#undo-toast button').click(); assert.equal((await saved(page)).entries.some(e => e.id === entry.id), true);

    /* ---- 2. Food label, Describe it, Search food, Saved ---- */
    await again(); await page.locator('#open-camera').click(); await page.locator('[data-mode12="label"]').click();
    assert.equal(await page.locator('#camera12-title').textContent(), 'Scan food label');
    await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0);
    await page.locator('#camera12-shutter').click(); await cardOpen(page);
    assert.match(calls.at(-1).body.text, /nutrition label/i, 'the label instruction goes in the text field'); assert(calls.at(-1).body.image);
    assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic protein bar');
    await page.locator('#n12-done').click(); await closed(page); assert.equal((await saved(page)).entries.at(-1).source, 'label');
    await again(); await page.locator('#open-camera').click(); await page.getByRole('button', { name: 'Describe it', exact: true }).click();
    await page.locator('#describe12').fill('Chicken salad with avocado'); await page.locator('#describe12-go').click(); await cardOpen(page);
    assert.equal(calls.at(-1).body.image, null, 'words only'); assert.equal(calls.at(-1).body.text, 'Chicken salad with avocado');
    await page.locator('#n12-done').click(); await closed(page); assert.equal((await saved(page)).entries.at(-1).source, 'text');
    await again(); await page.locator('#open-camera').click(); await page.getByRole('button', { name: 'Search food', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('builder-sheet').open && !document.getElementById('camera12').open);
    await page.evaluate(() => CHADUX.closeSheets());
    await again(); await page.locator('#open-camera').click(); await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('detail-sheet').open);
    assert.match(await page.locator('#detail-content').textContent(), /My chicken plate.*YoPRO Perform pouch.*Gochi noodle meal/s, 'bookmarks, then the built-in favourites');
    await page.getByRole('button', { name: /^My chicken plate/ }).click(); await cardOpen(page);
    assert.equal(await value(page, 'n12-kcal'), '1000'); await page.locator('#n12-done').click(); await closed(page);
    assert.equal((await saved(page)).entries.at(-1).name, 'My chicken plate');

    /* ---- 3. barcodes: the camera's detector with Open Food Facts (stub), and typed digits ---- */
    await context.close();
    ({ context, page, errors: errors } = await open({ detector: true }));
    await page.locator('#open-camera').click(); await page.locator('[data-mode12="barcode"]').click();
    await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0);
    assert.equal(await page.locator('#camera12-shutter').getAttribute('aria-label'), 'Type the barcode digits');
    await page.evaluate(() => { window.__barcode = '9300000000017'; });
    await cardOpen(page); assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic barcode meal');
    assert(await page.evaluate(() => window.__formats.includes('ean_13')));
    await page.locator('#n12-done').click(); await closed(page); assert.equal((await saved(page)).entries.at(-1).source, 'barcode');
    await page.evaluate(() => { window.__barcode = ''; });                         // the stub detector sees nothing now (the typed path next)
    await again(); await page.locator('#open-camera').click(); await page.locator('[data-mode12="barcode"]').click(); await page.locator('#camera12-shutter').click();
    await page.waitForFunction(() => document.getElementById('scan-sheet').open);
    await page.locator('#barcode').fill('9300000000024'); await page.locator('#barcode-form button').click(); await cardOpen(page);
    assert.equal(await page.locator('#n12-name').inputValue(), 'Synthetic barcode meal'); await page.locator('#nutrition12-close').click(); await closed(page);

    /* ---- 4. when the AI can't answer: offline, 401, timeout, no token, 502. The photo always stays. ---- */
    const snap = async () => { await again(); await page.locator('#open-camera').click(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await page.locator('#camera12-shutter').click(); };
    const trouble = () => page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'error');
    mode = 'abort'; await snap(); await trouble();
    assert.match(await page.locator('#nutrition12-body').textContent(), new RegExp(OFFLINE.replace(/[-]/g, '\\-')));
    for (const id of ['n12-search', 'n12-describe', 'n12-retry']) assert(await page.locator('#' + id).isVisible(), id);
    assert(await page.locator('#nutrition12 .ch-nut__photo img').isVisible(), 'the photo is still there');
    mode = 'ok'; await page.locator('#n12-retry').click(); await cardOpen(page); assert.equal(await value(page, 'n12-kcal'), '600', 'Retry works');
    await page.locator('#nutrition12-close').click(); await closed(page);
    assert.match(await page.locator('#recent12 .ch-food.is-draft').first().textContent(), /Synthetic chicken plate.*Ready/s, 'a closed card waits in Recently eaten');
    mode = '401'; await snap(); await trouble();
    assert.match(await page.locator('#nutrition12-body').textContent(), /didn’t accept this phone/); assert(await page.locator('#n12-setup').isVisible(), 'AI settings for a rejected token');
    await page.locator('#nutrition12-close').click(); await closed(page);
    mode = '502'; await snap(); await trouble(); assert.match(await page.locator('#nutrition12-body').textContent(), /couldn’t finish/); await page.locator('#nutrition12-close').click(); await closed(page);
    mode = 'hang'; await page.evaluate(() => { RECScan.TIMEOUT.proxy = 1500; }); await snap(); await trouble();
    assert.match(await page.locator('#nutrition12-body').textContent(), /took too long/); assert.match(await page.locator('#nutrition12-body').textContent(), new RegExp(OFFLINE.replace(/[-]/g, '\\-')));
    // Search from the error: the add-food sheet opens; the draft stays.
    await page.locator('#n12-search').click(); await page.waitForFunction(() => document.getElementById('builder-sheet').open); await page.evaluate(() => CHADUX.closeSheets());
    const drafts = await page.locator('#recent12 .ch-food.is-draft').count(); assert(drafts >= 4, 'every unanswered photo is kept: ' + drafts);
    // No token: the friendly message and AI settings; no request at all.
    await page.evaluate(() => { localStorage.removeItem('chad.aiProxyUrl'); localStorage.removeItem('chad.aiProxyToken'); RECScan.TIMEOUT.proxy = 100000; });
    const sent = calls.length; mode = 'ok'; await snap(); await trouble();
    assert.equal(calls.length, sent, 'nothing is sent without a token');
    assert.match(await page.locator('#nutrition12-body').textContent(), /isn’t set up on this phone/); assert(await page.locator('#n12-setup').isVisible());
    // The same from the meal being built (+ Food > Ask AI): AI settings opens Settings and the meal does not pop back over it.
    const noAiCard = page.locator('#nutrition12[data-state="error"]');
    await page.locator('#nutrition12-close').click(); await closed(page); await again();
    await page.evaluate(() => CHADBuilder.open('D')); await page.waitForFunction(() => document.getElementById('builder-sheet').open);
    await page.locator('#builder-ask-go').click(); await page.waitForFunction(() => document.getElementById('camera12-video').videoWidth > 0); await page.locator('#camera12-shutter').click();
    await noAiCard.waitFor({ state: 'visible' }); await page.locator('#n12-setup').click(); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => !document.getElementById('settings').hidden && !document.querySelector('dialog[open]') && document.activeElement?.id === 'ai-link'), true, 'AI settings wins over the meal');
    await page.locator('#close-settings').click(); await again();
    await page.locator('#recent12 .ch-food.is-error').first().click(); await noAiCard.waitFor({ state: 'visible' });
    // Describe it from the error keeps the photo and adds the words.
    await page.evaluate(() => { localStorage.setItem('chad.aiProxyUrl', location.origin); localStorage.setItem('chad.aiProxyToken', 'synthetic-device-token'); });
    await page.locator('#n12-describe').click(); await page.locator('#describe12').fill('Grilled chicken and rice'); await page.locator('#describe12-go').click(); await cardOpen(page);
    assert(calls.at(-1).body.image, 'the photo goes with the words'); assert.equal(calls.at(-1).body.text, 'Grilled chicken and rice');
    await page.locator('#n12-discard').click(); await closed(page);
    const left = await page.locator('#recent12 .ch-food.is-draft').count();
    await again(); await page.locator('#undo-toast button').click(); assert.equal(await page.locator('#recent12 .ch-food.is-draft').count(), left + 1, 'Discard has Undo');
    // A reload mid-scan: the photo survives; Retry finishes it.
    mode = 'hang'; await snap(); await page.waitForFunction(() => document.querySelector('#recent12 .ch-food.is-pending'));
    hold = []; await page.reload(); await page.waitForFunction(() => window.CHADScan12);
    await page.waitForFunction(() => /Scan interrupted/.test(document.getElementById('recent12').textContent));
    mode = 'ok'; await page.locator('#recent12 .ch-food.is-error', { hasText: 'Scan interrupted' }).first().click();
    await page.locator('#n12-retry').click(); await cardOpen(page); assert.equal(await value(page, 'n12-kcal'), '600');
    await page.locator('#n12-done').click(); await closed(page);
    // Tidying the device's photos on start: one nothing points to from two days ago goes; one from a minute ago (its
    // draft may still be on its way) and one a logged food points to stay.
    const store = op => page.evaluate(async op => {
      const db = await new Promise(r => { const q = indexedDB.open('chad-photos-v12'); q.onsuccess = () => r(q.result); });
      const tx = (mode, fn) => new Promise(r => { const t = db.transaction('photos', mode), q = fn(t.objectStore('photos')); t.oncomplete = () => r(q?.result); });
      if (op.put) for (const key of op.put) await tx('readwrite', s => s.put({ image: 'data:image/jpeg;base64,AAAA', thumbnail: 'data:image/jpeg;base64,AAAA' }, key));
      return tx('readonly', s => s.getAllKeys());
    }, op);
    const old = 'scan-' + (Date.now() - 2 * 864e5).toString(36) + '-orphan', fresh = 'scan-' + Date.now().toString(36) + '-fresh', keptKey = (await saved(page)).entries.find(e => e.photoId).photoId;
    await store({ put: [old, fresh] }); await page.waitForTimeout(300);
    await page.reload(); await page.waitForFunction(() => window.CHADScan12); await page.waitForTimeout(800);
    const keys = await store({});
    assert.equal(keys.includes(old), false, 'an old photo nothing points to is deleted'); assert(keys.includes(fresh), 'a recent one stays'); assert(keys.includes(keptKey), 'a logged food keeps its photo');
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll');
    await context.close();

    /* ---- 5. no live camera (an iPhone home-screen app): the shutter opens the system camera, Gallery the library ---- */
    ({ context, page, errors } = await open({ camera: false }));
    await page.locator('#open-camera').click(); assert.match(await page.locator('#camera12-status').textContent(), /shutter/);
    assert.equal(await page.locator('#camera12-torch').isVisible(), false, 'no flash without a camera');
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#7a6a55'; g.fillRect(0, 0, 1600, 1200); return c.toDataURL('image/png').split(',')[1]; });
    let [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#camera12-shutter').click()]);
    assert.equal(await chooser.element().getAttribute('capture'), 'environment', 'shutter = system camera');
    mode = 'ok'; const count = calls.length;
    await chooser.setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await cardOpen(page); assert.equal(calls.length, count + 1);
    const sizes2 = await photoSize(page); assert.deepEqual(sizes2.at(-1).image, [1024, 768], 'file photo downscaled to 1024 px');
    await page.locator('#n12-done').click(); await closed(page);
    await again(); await page.locator('#open-camera').click();
    [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-mode12="gallery"]').click()]);
    assert.equal(await chooser.element().getAttribute('capture'), null, 'Gallery = photo library'); await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS v12-scan-check: camera (corners, 4 modes, flash, 80 px shutter), photo -> 1024 px JPEG + 360 px thumb -> Analysing card -> card (auto-open), servings 0.5 steps, oil +120, grams typed live, remove, add item, kcal typed, bookmark on/off, Fix with AI (photo + note + previous estimate), Done (3 taps) / Undo / Redo / edit / Delete, label hint, Describe, Search, Saved, native barcode + typed digits (stub OFF), offline / 401 / 502 / timeout / no token messages with Search, Describe, Retry, AI settings, Discard + Undo, reload mid-scan -> Retry, old unreferenced photos tidied on start, file-input fallback (system camera, library); no photo, token or note in the journal.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
