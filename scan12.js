'use strict';
// CHAD v12 · the camera, the nutrition card and Recently eaten.
//   Camera (the round + in the tab bar): live rear camera with framing corners; modes Scan food | Barcode | Food label |
//   Gallery; shutter; flash where the camera has one; Search food, Saved, Describe it. Without a live camera (an iPhone
//   home-screen app, a denied permission) the shutter opens the system camera through a file input instead.
//   A photo becomes a draft at once: it shows in Recently eaten as "Analysing…" while your proxy estimates it in the
//   background, and the nutrition card opens when the answer is in. Nothing is logged until Done (Undo in the toast).
//   Nutrition card (every way in: photo, label, barcode, search, typed, saved, and any food already logged): name,
//   servings in halves, calories and P/C/F (all editable), a health score, ingredients (grams, remove, add), "+ oil or
//   sauce?", Fix with AI (a note, re-sent with the photo), bookmark to Saved, Done.
// Photos and drafts live only in this device's IndexedDB (chad-photos-v12): the journal keeps a photo id, never a
// photo, and never a token. Every estimate goes through RECScan (scan9.js) with the proxy and token from Settings.
(() => {
  const $ = id => document.getElementById(id), U = () => window.CHADUX, M = () => window.CHADMotion;
  const KEYS = ['kcal', 'protein', 'carbs', 'fat'], NAMES = { kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
  const round = n => Math.round((Number(n) || 0) * 10) / 10, whole = n => Math.round(Number(n) || 0).toLocaleString('en-AU');
  const show = (k, v) => k === 'kcal' ? String(Math.round(v)) : String(round(v));
  // The proxy contract has one text field: a label photo says so there, and so do a description and a correction.
  const LABEL_HINT = 'This photo is a nutrition label. Read the nutrition label: use its serving size and the per-serving values printed on it.';
  const OFFLINE = 'Can’t reach your PC. Is Tailscale on and the PC awake?';
  // The same failures get the unreachable note and background recovery. Auth needs Settings/user action.
  const UNREACHABLE = new Set(['off', 'network', 'timeout', 'failed', 'http', 'interrupted']);
  const OIL = { name: 'Oil or sauce, 15 mL', grams: 13.6, kcal: 120, protein: 0, carbs: 0, fat: 13.6 };
  const SOURCE = { photo: 'Photo', label: 'Food label', text: 'Described', barcode: 'Barcode', manual: 'Typed in', favourite: 'Saved food', search: 'Food search', plan: 'Meal plan', custom: 'Custom meal', repeat: 'Logged again', addon: 'Add-on' };
  const uid = () => 'scan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, fn, cls = 'ch-btn', id) => { const n = el('button', cls, text); n.type = 'button'; n.onclick = fn; if (id) n.id = id; return n; };
  const icon = (name, size = 20, opts) => window.CHADIcons?.icon(name, size, opts) || '';
  // A few glyphs icons8.js does not have (same 24-unit grid, same stroke).
  const GLYPH = {
    bookmark: '<path d="M7 3.8h10a1 1 0 0 1 1 1v15.4l-6-4.2-6 4.2V4.8a1 1 0 0 1 1-1z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l4.6-4.6a1.5 1.5 0 0 1 2.1 0L15 17.2M13.5 15.7l1.9-1.9a1.5 1.5 0 0 1 2.1 0l2.9 2.9"/>',
    label: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
    flash: '<path d="M13.2 2.8 5.2 13.6h5.9l-1 7.6 8.7-11.2h-6.2z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const glyph = (name, size = 22) => `<svg class="ch-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[name]}</svg>`;
  let dbPromise, drafts = [], active = null, ui = {}, fixing = false, adding = false, handoff = false, stream = null, reader = null, cameraRun = 0, detectTimer, mode = 'food', context = null, torch = false, busyCapture = false, ticker = 0;
  const running = new Set(), photoCache = new Map();

  /* ---- device storage: photos { image, thumbnail } by id, and recoverable drafts ---- */
  function db() {
    return dbPromise ||= new Promise((resolve, reject) => {
      const r = indexedDB.open('chad-photos-v12', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('photos'); r.result.createObjectStore('drafts', { keyPath: 'id' }); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error('Device photo storage is unavailable.'));
    });
  }
  async function storage(store, operation, value, key) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const t = database.transaction(store, operation === 'get' || operation === 'getAll' ? 'readonly' : 'readwrite');
      const req = key === undefined ? t.objectStore(store)[operation](value) : t.objectStore(store)[operation](value, key);
      t.oncomplete = () => resolve(req.result); t.onerror = () => reject(Error('Device storage is full or unavailable.')); t.onabort = t.onerror;
    });
  }
  // A draft is saved without its callback, its photo (that is in `photos`) or its in-memory flags.
  const keep = d => { if (d.discarded || !drafts.includes(d)) return Promise.resolve(); const { add, image, thumbnail, saving, discarded, ...rest } = d; return storage('drafts', 'put', rest); };
  async function photoOf(d) {
    if (d.image) return { image: d.image, thumbnail: d.thumbnail || d.image };
    if (!d.photoId) return null;
    const p = await storage('photos', 'get', d.photoId).catch(() => null);
    if (p) photoCache.set(d.photoId, p.thumbnail || p.image);
    return p || null;
  }
  function thumb(photoId, img) {
    if (!photoId) return;
    if (photoCache.has(photoId)) { img.src = photoCache.get(photoId); return; }
    storage('photos', 'get', photoId).then(p => { if (p) { photoCache.set(photoId, p.thumbnail || p.image); img.src = p.thumbnail || p.image; } }).catch(() => {});
  }
  function notice(text) { U().message(text, true); }

  /* ---- the two sheets ---- */
  function build() {
    const app = document.querySelector('.ch-app') || document.body;
    app.insertAdjacentHTML('beforeend', `
      <dialog id="camera12" class="ch-sheet ch-cam" aria-labelledby="camera12-title" data-mode="food">
        <div class="ch-cam__view">
          <video id="camera12-video" autoplay muted playsinline></video>
          <div class="ch-cam__corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <p id="camera12-status" class="ch-cam__status" role="status"></p>
        </div>
        <div class="ch-cam__top">
          <button id="camera12-close" type="button" class="ch-cam__round" aria-label="Close camera">${glyph('close', 22)}</button>
          <h2 id="camera12-title" class="ch-cam__title">Scan food</h2>
          <button id="camera12-torch" type="button" class="ch-cam__round" aria-label="Flash" aria-pressed="false" hidden>${glyph('flash', 22)}</button>
          <span class="ch-cam__spacer" id="camera12-spacer" aria-hidden="true"></span>
        </div>
        <div class="ch-cam__bottom">
          <div class="ch-cam__modes" role="group" aria-label="Scan mode">
            <button type="button" data-mode12="food" aria-pressed="true">${icon('camera', 20)}<span>Scan food</span></button>
            <button type="button" data-mode12="barcode" aria-pressed="false">${icon('barcode', 20)}<span>Barcode</span></button>
            <button type="button" data-mode12="label" aria-pressed="false">${glyph('label', 20)}<span>Food label</span></button>
            <button type="button" data-mode12="gallery" aria-pressed="false">${glyph('image', 20)}<span>Gallery</span></button>
          </div>
          <div class="ch-cam__shoot">
            <button id="camera12-shutter" type="button" class="ch-cam__shutter" aria-label="Take food photo"><span class="ch-cam__digits" aria-hidden="true">123</span></button>
          </div>
          <div class="ch-cam__links">
            <button id="camera12-search" type="button">${icon('magnifier', 18)}<span>Search food</span></button>
            <button id="camera12-saved" type="button">${glyph('bookmark', 18)}<span>Saved</span></button>
            <button id="camera12-describe" type="button">${icon('pencil', 18)}<span>Describe it</span></button>
          </div>
          <input id="camera12-file" type="file" accept="image/*" capture="environment" hidden>
        </div>
      </dialog>
      <dialog id="nutrition12" class="ch-sheet ch-nut" aria-labelledby="nutrition12-title">
        <div class="ch-sheet__grip" aria-hidden="true"></div>
        <div class="ch-sheet__head ch-nut__head">
          <button id="nutrition12-close" type="button" class="ch-sheet__close" aria-label="Close">${icon('xmark', 22)}</button>
          <h2 id="nutrition12-title" class="ch-sheet__title ch-nut__title">Nutrition</h2>
          <button id="nutrition12-save" type="button" class="ch-nut__mark" aria-pressed="false" aria-label="Save to favourites">${glyph('bookmark', 22)}</button>
        </div>
        <div id="nutrition12-body" class="ch-sheet__body ch-nut__body"></div>
        <div id="nutrition12-foot" class="ch-nut__foot"></div>
      </dialog>`);
    $('open-camera').onclick = () => open();
    $('camera12-close').onclick = () => U().closeSheet($('camera12'));
    // Opened from the add-food sheet and closed without a photo, a lookup or a search: back to the meal being built.
    $('camera12').addEventListener('close', () => { if ($('camera12').open) return; stop(); if (!handoff) backToMeal(context); });
    $('nutrition12-close').onclick = () => U().closeSheet($('nutrition12'));
    $('nutrition12-save').onclick = () => { if (active?.status === 'ready') bookmark(active); };
    // Closed without adding, a builder card goes back to the meal being built (queued: a sheet opened meanwhile wins).
    $('nutrition12').addEventListener('close', () => {
      if ($('nutrition12').open) return;
      fixing = adding = false;
      const epoch = U().session();
      setTimeout(() => { if (epoch !== U().session() || document.hidden || $('nutrition12').open || document.querySelector('dialog.ch-sheet[open]') || !active?.add) return; const back = active.add; active.add = null; back(null); }, 0);
    });
    $('camera12-shutter').onclick = capture;
    $('camera12-file').onchange = async e => {
      const epoch = U().session();
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await accept(await RECScan.compress(f), epoch); } catch (err) { $('camera12-status').textContent = err.message; notice(err.message); }
    };
    document.querySelectorAll('[data-mode12]').forEach(b => b.onclick = () => b.dataset.mode12 === 'gallery' ? choose(false) : setMode(b.dataset.mode12));
    $('camera12-search').onclick = () => search();
    $('camera12-saved').onclick = saved;
    $('camera12-describe').onclick = () => describe();
    $('camera12-torch').onclick = async () => {
      try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: !torch }] }); torch = !torch; $('camera12-torch').setAttribute('aria-pressed', String(torch)); M()?.haptic('tap'); }
      catch { $('camera12-status').textContent = 'Flash is unavailable on this camera.'; }
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if ($('camera12').open) startCamera(); });
    U().wireSheet($('camera12'), { drag: false });
    U().wireSheet($('nutrition12'));
    window.CHADIcons?.mount($('nutrition12'));
  }

  /* ---- camera ---- */
  function stop() { cameraRun++; clearTimeout(detectTimer); reader?.stop?.(); reader = null; stream?.getTracks().forEach(t => t.stop()); stream = null; const v = $('camera12-video'); if (v) v.srcObject = null; torch = false; }
  function choose(capture) { const f = $('camera12-file'); if (capture) f.setAttribute('capture', 'environment'); else f.removeAttribute('capture'); f.click(); }
  function open(nextMode = 'food', ctx = null) { context = ctx; handoff = false; U().closeSheets(); U().showSheet($('camera12')); setMode(nextMode); }
  // The meal being built waits in the add-food sheet; a sheet opened in the meantime wins (the close event is queued).
  function backToMeal(ctx, epoch = U().session()) { setTimeout(() => { if (epoch === U().session() && !document.hidden && ctx?.back && !document.querySelector('dialog.ch-sheet[open]')) ctx.back(); }, 0); }
  // A sheet of the camera's own (Saved, Describe it): closed without a choice, it goes back to the meal too.
  function sheetFromCamera(title, nodes) { const ctx = context, epoch = U().session(); handoff = true; let chosen = false; U().detail(title, nodes); $('detail-sheet').addEventListener('close', () => { if (!chosen) backToMeal(ctx, epoch); }, { once: true }); return () => { chosen = true; }; }
  const TITLES = { food: 'Scan food', barcode: 'Scan barcode', label: 'Scan food label' };
  const SHUTTER = { food: 'Take food photo', barcode: 'Type the barcode digits', label: 'Take label photo' };
  function setMode(next) {
    mode = next; $('camera12').dataset.mode = next; $('camera12-title').textContent = TITLES[next];
    $('camera12-shutter').setAttribute('aria-label', SHUTTER[next]);
    document.querySelectorAll('[data-mode12]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode12 === next)));
    startCamera();
  }
  async function startCamera() {
    stop(); const run = cameraRun;
    $('camera12-torch').hidden = true; $('camera12-spacer').hidden = false;
    const say = text => { if (run === cameraRun) $('camera12-status').textContent = text; };
    say(mode === 'barcode' ? 'Point at a barcode' : mode === 'label' ? 'Fit the nutrition panel in the frame' : '');
    if (!navigator.mediaDevices?.getUserMedia) { say(mode === 'barcode' ? 'No live camera here. Tap the button to type the digits.' : 'Tap the shutter to take or choose a photo.'); return; }
    try {
      if (mode === 'barcode' && !window.BarcodeDetector) {
        const controls = await CHADFood.startScanner($('camera12-video'), code => barcode(code));
        if (run !== cameraRun) controls.stop(); else reader = controls;
        return;
      }
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (run !== cameraRun || !$('camera12').open) { next.getTracks().forEach(t => t.stop()); return; }
      stream = next; $('camera12-video').srcObject = stream; await $('camera12-video').play().catch(() => {});
      const flash = !!stream.getVideoTracks()[0]?.getCapabilities?.().torch;
      $('camera12-torch').hidden = !flash; $('camera12-spacer').hidden = flash;
      if (mode === 'barcode') {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const tick = async () => { if (run !== cameraRun) return; try { const found = await detector.detect($('camera12-video')); if (found[0] && run === cameraRun) return barcode(found[0].rawValue); } catch { /* the next frame */ } detectTimer = setTimeout(tick, 300); };
        tick();
      }
    } catch { say(mode === 'barcode' ? 'Camera unavailable. Tap the button to type the digits.' : 'Camera unavailable. Tap the shutter to take or choose a photo.'); }
  }
  async function barcode(code) {
    const epoch = U().session();
    stop(); M()?.haptic('success'); $('camera12-status').textContent = 'Finding food…';
    try { const item = await CHADFood.lookup(code); if (epoch !== U().session()) return; handoff = true; openResult(item, 'barcode', { add: context?.add }); }
    catch (e) { $('camera12-status').textContent = e.message + ' '; $('camera12-status').append(button('Type the digits', () => { handoff = true; U().openFood('barcode', context); }, 'ch-cam__inline')); }
  }
  // The live frame, at most 1024 px on the long edge (JPEG 0.8), and a 360 px thumbnail for the lists.
  function frame(video, size, quality) {
    const scale = Math.min(1, size / Math.max(video.videoWidth, video.videoHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(video.videoWidth * scale)); c.height = Math.max(1, Math.round(video.videoHeight * scale));
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  }
  async function capture() {
    if (busyCapture) return;
    if (mode === 'barcode') { handoff = true; return U().openFood('barcode', context); }
    const video = $('camera12-video');
    if (!video.videoWidth || !stream) return choose(true);
    busyCapture = true;
    try {
      M()?.haptic('tap'); M()?.pulse($('camera12'), 'is-shot', 320);
      await accept({ image: frame(video, 1024, .8), thumbnail: frame(video, 360, .72) });
    } catch (e) { $('camera12-status').textContent = e.message; } finally { busyCapture = false; }
  }
  // A photo is a draft at once: stored on the device first (a failed write never loses it), then analysed.
  async function accept(photo, epoch = U().session()) {
    const label = mode === 'label';
    const d = { id: uid(), day: U().dateKey(), at: Date.now(), source: label ? 'label' : 'photo', photoId: uid(), base: label ? LABEL_HINT : '', desc: '', note: '', status: 'pending', image: photo.image, thumbnail: photo.thumbnail };
    d.add = context?.add || null; handoff = true; stop();                 // the photo is taken: the camera goes off at once
    photoCache.set(d.photoId, photo.thumbnail);
    drafts.push(d);
    try { await storage('photos', 'put', { image: photo.image, thumbnail: photo.thumbnail }, d.photoId); await keep(d); }
    catch (e) { d.status = 'error'; d.errorKind = 'storage'; setError(d); render(); if (epoch === U().session()) { U().closeSheets(); review(d); } return; }
    if (epoch === U().session()) U().closeSheets();
    render(); estimate(d, epoch === U().session());
  }

  /* ---- estimates ---- */
  const TROUBLE = {
    off: [OFFLINE, 'Your photo is safe here.', 'retry'],
    network: [OFFLINE, 'Your photo is safe here. Retry when the PC is on.', 'retry'],
    timeout: [OFFLINE, 'It took too long to answer. Your photo is safe here.', 'retry'],
    auth: [OFFLINE, 'Your photo is safe here. Advanced › paste setup link', 'setup'],
    failed: [OFFLINE, 'Your photo is safe here.', 'retry'],
    http: [OFFLINE, 'Your photo is safe here.', 'retry'],
    key: ['OpenAI didn’t accept your key', 'Check it in Settings, or search or describe it instead.', 'setup'],
    busy: ['The AI is busy', 'Retry in a moment, or search or describe it instead.', 'retry'],
    limit: ['The AI needs a breather', 'Lots of scans lately. Retry in a few minutes, or search or describe it instead.', 'retry'],
    large: ['That photo is too big for the AI', 'Describe it instead, or search for it.', ''],
    empty: ['No food spotted', 'Retake the photo, or describe it instead.', 'retake'],
    parse: ['That answer came back garbled', 'Retry, or search or describe it instead.', 'retry'],
    interrupted: ['Scan interrupted', 'Your photo is safe. Retry when ready.', 'retry'],
    storage: ['Couldn’t keep the photo on this device', 'Storage may be full. Retry, or describe it instead.', 'retry'],
    photo: ['This photo is no longer on this device', 'Describe it or search for it instead.', '']
  };
  function setError(d) {
    const [title, text] = TROUBLE[d.errorKind] || ['The AI couldn’t finish that one', 'Retry, or search or describe it instead.'];
    d.error = title; d.errorText = d.photoId ? text : text.replace(/Your photo is safe/, 'Your words are kept').replace('Retake the photo, or describe it instead.', 'Describe it again with more detail, or search for it.');
  }
  // The note sent with a photo: the label instruction, a description, and for a correction what the card showed and
  // what is wrong. Never more than the 500 characters the proxy takes; the correction always fits.
  function hintFor(d) {
    const note = String(d.note || '').trim(), n = d.servings || 1, it = d.item;
    const prev = note && it && it.kcal >= 1 ? `Previous estimate: ${it.name || 'food'}, ${whole(it.kcal * n)} kcal, protein ${round(it.protein * n)} g, carbs ${round((it.carbs || 0) * n)} g, fat ${round((it.fat || 0) * n)} g${it.grams ? ', ' + whole(it.grams * n) + ' g' : ''}.` : '';
    const tail = [prev, note && 'Correction: ' + note].filter(Boolean).join('\n'), head = [d.base, d.desc].filter(Boolean).join('\n');
    const room = 500 - tail.length - (head && tail ? 1 : 0);
    return [room > 0 ? head.slice(0, room) : '', tail].filter(Boolean).join('\n').slice(0, 500);
  }
  const showing = d => active === d && $('nutrition12').open;
  const canOpen = () => !document.querySelector('dialog[open]') && !document.hidden && !document.documentElement.classList.contains('is-gym');
  async function estimate(d, autoOpen = false) {
    const epoch = U().session();
    if (running.has(d.id)) return;
    running.add(d.id); d.status = 'pending'; d.error = d.errorText = d.errorKind = ''; d.startedAt = Date.now(); d.lastAttemptAt = d.startedAt;
    if (!drafts.includes(d)) drafts.push(d);
    keep(d).catch(() => {}); render(); if (showing(d)) drawResult(); pend();
    try {
      const route = U().aiRoute();
      if (route.mode === 'none') throw Object.assign(Error(OFFLINE), { kind: 'off' });
      const photo = d.photoId || d.image ? await photoOf(d) : null;
      if ((d.photoId || d.image) && !photo?.image) throw Object.assign(Error('photo'), { kind: 'photo' });
      let raw;
      // The raw answer too: fibre, sugar and a processed flag feed the health score when the proxy sends them.
      const fetcher = async (...args) => { const response = await fetch(...args); if (response.ok) { try { raw = await response.clone().json(); } catch { /* RECScan reports it */ } } return response; };
      const result = await RECScan.estimate({ image: photo?.image || null, hint: hintFor(d) }, { ...route, fetcher });
      if (d.discarded) return;
      const meal = { ...result.meal };
      if (raw && typeof raw === 'object') {
        for (const [key, alias] of [['fibre', 'fibre_g'], ['sugar', 'sugar_g']]) { const v = raw[key] ?? raw[alias] ?? (key === 'fibre' ? raw.fiber ?? raw.fiber_g : undefined); if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5000) meal[key] = round(v); }
        if (typeof raw.processed === 'boolean') meal.processed = raw.processed;
      }
      d.item = meal; d.parts = (result.parts || []).map(cleanPart); d.partsDirty = d.parts.length > 0; d.confidence = result.confidence; d.servings = 1; d.note = ''; d.status = 'ready';
      M()?.haptic('success');
    } catch (e) {
      if (d.discarded) return;
      d.status = 'error'; d.errorKind = e.kind && (TROUBLE[e.kind] || RECScan.MESSAGES[e.kind]) ? e.kind : 'failed'; setError(d);
      if (e.kind === 'auth') U().aiRejected?.();
    } finally {
      running.delete(d.id);
      if (!d.discarded) {
        keep(d).catch(() => {}); render();
        if (showing(d)) drawResult();
        else if (autoOpen && epoch === U().session() && canOpen()) { U().shield(); review(d); }
        else U().toast(d.status === 'ready' ? 'Your food is ready' : 'Photo not analysed', () => review(d), { action: d.status === 'ready' ? 'Review' : 'Open', icon: d.status === 'ready' ? 'sparkles' : 'refresh', life: 12000 });
      }
    }
  }
  // While anything is analysing, its rings creep towards done (about 70% at ten seconds, never full until the answer).
  function pend() {
    if (ticker) return;
    ticker = setInterval(() => {
      const busy = drafts.filter(d => d.status === 'pending');
      if (!busy.length) { clearInterval(ticker); ticker = 0; return; }
      for (const d of busy) document.querySelectorAll(`[data-draft="${d.id}"] .ch-pend`).forEach(r => setPend(r, d));
    }, 400);
  }

  /* ---- the other ways in ---- */
  function search(words = '') {
    const ctx = context; handoff = true; U().clearFoodCtx(); U().closeSheets();
    if (ctx?.search) ctx.search(words); else window.CHADBuilder?.open(null, { search: words });
  }
  // Describe it: words (the keyboard's microphone works here too). With a draft, the words go with its photo.
  function describe(d = null) {
    const field = el('textarea', 'ch-input ch-describe'); field.maxLength = 400; field.rows = 3; field.id = 'describe12';
    field.placeholder = 'e.g. 250 g chicken breast, 150 g rice, salad'; field.value = d?.desc || ''; field.setAttribute('aria-label', 'Describe your food');
    field.enterKeyHint = 'send';
    const status = el('p', 'ch-hint', 'Tip: tap the keyboard’s microphone to say it.'); status.setAttribute('role', 'status');
    const go = button('Estimate', () => {
      const words = field.value.trim();
      if (!words) { status.textContent = 'Describe the food first.'; field.focus(); return; }
      const draft = d || { id: uid(), day: U().dateKey(), at: Date.now(), source: 'text', base: '', note: '', status: 'pending', add: context?.add || null };
      chose(); draft.desc = words; U().closeSheets(); estimate(draft, true);
    }, 'ch-btn ch-btn--primary ch-btn--block', 'describe12-go');
    field.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); } });
    const nodes = [field, status, go, button('Search food instead', () => { chose(); search(field.value.trim()); }, 'ch-btn ch-btn--block')];
    const chose = d ? () => {} : sheetFromCamera('Describe it', nodes);
    if (d) U().detail('Describe this photo', nodes);
    U().focusSheet(field);
  }
  // Saved: your bookmarked foods, then the built-in favourites. A tap opens the card (Done logs it).
  function saved() {
    const list = el('div', 'ch-saved'), mine = U().journal().savedFoods12 || [];
    const row = (f, macros) => {
      const b = button('', () => { chose(); openResult({ name: f.name, kcal: macros[0], protein: macros[1], carbs: macros[2], fat: macros[3], grams: f.grams || null, portion: f.portion || '' }, 'favourite', { add: context?.add }); }, 'ch-saved__row');
      b.append(el('b', '', f.name), el('small', '', `${whole(macros[0])} kcal · P ${round(macros[1])} · C ${round(macros[2])} · F ${round(macros[3])} g`));
      b.setAttribute('aria-label', `${f.name}, ${whole(macros[0])} kcal. Open`); return b;
    };
    mine.slice().reverse().forEach(f => list.append(row(f, KEYS.map(k => f[k] || 0))));
    (window.CHADFavourites || []).forEach(f => list.append(row(f, f.macros)));
    if (!mine.length) list.prepend(el('p', 'ch-hint', 'Bookmark a food on its card to keep it here.'));
    const chose = sheetFromCamera('Saved foods', [list]);
  }
  const cleanPart = p => ({ name: String(p?.name || 'Item').slice(0, 80), grams: Number(p?.grams) > 0 ? round(p.grams) : null, kcal: Number(p?.kcal) || 0, protein: Number(p?.protein) || 0, carbs: Number(p?.carbs) || 0, fat: Number(p?.fat) || 0 });
  // Any food from elsewhere (barcode, search, typed, saved, the builder's "Type it" and AI) opens this same card.
  function openResult(item, source, info = {}) {
    const d = { id: uid(), day: U().dateKey(), at: Date.now(), item: structuredClone(item || {}), source, parts: (info.parts || []).map(cleanPart), thumbnail: info.photo || '', status: 'ready', servings: 1, add: info.add || null, confidence: info.confidence ?? null, base: '', desc: '', note: '' };
    d.partsDirty = d.parts.length > 0;
    if (!(Number(d.item.grams) > 0)) { const g = item?.basis === '100g' ? 100 : Number(item?.servingGrams); if (g > 0) d.item.grams = g; }
    review(d);
    if (source === 'manual') U().focusSheet($(d.item.name ? 'n12-kcal' : 'n12-name'), 60);
  }
  // A food already logged: the same card, with Delete and Log again. Done saves the change (Undo in the toast).
  function edit(entry) {
    const fromParts = !entry.ingredients12 && Array.isArray(entry.parts) ? entry.parts.map(p => ({ ...p, grams: Number(/(\d+(?:\.\d+)?)\s*g\b/.exec(p.amount || '')?.[1]) || null })) : [];
    const d = { id: uid(), day: entry.day, at: entry.at || null, item: structuredClone(entry), origin: structuredClone(entry), parts: (entry.ingredients12 || fromParts).map(cleanPart), servings: 1, source: entry.source, photoId: entry.photoId, status: 'ready', entryId: entry.id, base: '', desc: '', note: '' };
    review(d);
  }
  function review(d) { active = d; fixing = adding = false; if (!$('nutrition12').open) { U().closeSheets(); U().showSheet($('nutrition12')); } drawResult(); }

  /* ---- the nutrition card ---- */
  const total = d => Object.fromEntries(KEYS.map(k => [k, (Number(d.item?.[k]) || 0) * (d.servings || 1)]));
  function health(item) {
    const kcal = Math.max(1, Number(item.kcal) || 0), density = Math.min(4, (Number(item.protein) || 0) * 4 / kcal * 8);
    return Math.round(Math.max(1, Math.min(10, 4 + density + Math.min(2, (Number(item.fibre) || 0) / 3) - Math.min(2, (Number(item.sugar) || 0) / 15) - (item.processed ? 2 : 0))) * 10) / 10;
  }
  const changed = d => { if (drafts.includes(d)) keep(d).catch(() => {}); };
  const timeOf = at => at ? new Date(at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Darwin' }).replace(/\s/g, ' ') : '';
  const isSaved = d => (U().journal().savedFoods12 || []).some(f => f.name.toLowerCase() === String(d.item?.name || '').trim().toLowerCase() && Math.round(f.kcal) === Math.round(total(d).kcal));
  function drawResult() {
    const d = active; if (!d) return;
    const body = $('nutrition12-body'), foot = $('nutrition12-foot'), ready = d.status === 'ready';
    ui = {}; body.replaceChildren(); foot.replaceChildren();
    $('nutrition12').dataset.state = d.status;
    $('nutrition12-title').textContent = ready ? (d.entryId ? 'Edit food' : 'Nutrition') : d.status === 'pending' ? 'Analysing…' : 'Not analysed';
    $('nutrition12-save').hidden = !ready;
    if (ready) { const on = isSaved(d); $('nutrition12-save').setAttribute('aria-pressed', String(on)); $('nutrition12-save').setAttribute('aria-label', on ? 'Saved to favourites. Remove' : 'Save to favourites'); }
    const shot = d.image || d.thumbnail || (d.photoId && photoCache.get(d.photoId));
    if (shot || d.photoId) {
      const fig = el('figure', 'ch-nut__photo'), img = el('img'); img.alt = 'Your food photo'; img.decoding = 'async';
      if (shot) img.src = shot; else thumb(d.photoId, img);
      fig.append(img);
      if (d.status === 'pending') { fig.classList.add('is-pending'); fig.append(pendRing(d), el('i', 'ch-nut__sweep')); fig.dataset.draft = d.id; }
      body.append(fig);
    }
    if (d.status === 'pending') {
      const words = el('div', 'ch-nut__wait'); words.setAttribute('role', 'status');
      words.append(el('strong', '', 'Analysing…'), el('p', '', d.note ? 'Fixing: “' + d.note.slice(0, 60) + '”' : d.desc && !d.photoId ? '“' + d.desc.slice(0, 80) + '”' : 'Usually about 10 seconds. You can close this: it carries on and lands in Recently eaten.'));
      if (!shot && !d.photoId) { const spark = el('span', 'ch-nut__spark'); spark.innerHTML = icon('sparkles', 40); spark.dataset.draft = d.id; spark.append(pendRing(d)); body.append(spark); }
      body.append(words);
      foot.append(button('Close', () => U().closeSheet($('nutrition12')), 'ch-btn ch-btn--block'));
      return;
    }
    if (d.status === 'error') {
      const box = el('div', 'ch-nut__trouble'); box.setAttribute('role', 'alert');
      box.innerHTML = icon(d.errorKind === 'network' || d.errorKind === 'timeout' ? 'wifi-off' : 'info', 28);
      box.append(el('strong', '', d.error), el('p', '', d.errorText || ''));
      body.append(box);
      const fix = (TROUBLE[d.errorKind] || [])[2];
      const ways = el('div', 'ch-nut__ways');
      ways.append(
        button('Search food', () => search(d.desc || ''), 'ch-way2', 'n12-search'),
        button('Describe it', () => describe(d), 'ch-way2', 'n12-describe'));
      ways.querySelector('#n12-search').insertAdjacentHTML('afterbegin', icon('magnifier', 20));
      ways.querySelector('#n12-describe').insertAdjacentHTML('afterbegin', icon('pencil', 20));
      body.append(ways);
      if (fix === 'setup') body.append(button(d.errorKind === 'auth' ? 'Advanced › paste setup link' : 'AI settings', () => { d.add = null; U().closeSheets(); U().goSetup(); }, 'ch-btn ch-btn--block', 'n12-setup'));   // Settings wins over going back to the meal
      if (fix === 'retake' && d.photoId) body.append(button('Retake photo', () => { discard(d, true); open(d.source === 'label' ? 'label' : 'food', context); }, 'ch-btn ch-btn--block', 'n12-retake'));
      body.append(button('Discard', () => discard(d), 'ch-link ch-link--danger', 'n12-discard'));
      foot.append(button('Retry', () => estimate(d), 'ch-btn ch-btn--primary ch-btn--block', 'n12-retry'));
      return;
    }
    // ---- ready ----
    const meta = [timeOf(d.at), SOURCE[d.source] || '', d.source === 'photo' || d.source === 'label' || d.source === 'text' ? (typeof d.confidence === 'number' ? Math.round(d.confidence * 100) + '% sure · check it' : 'AI estimate · check it') : ''].filter(Boolean).join(' · ');
    if (meta) body.append(el('p', 'ch-nut__meta', meta));
    const nameLabel = el('label', 'ch-sr', 'Food name'); nameLabel.htmlFor = 'n12-name';
    const name = el('input', 'ch-nut__name'); name.id = 'n12-name'; name.type = 'text'; name.maxLength = 80; name.value = d.item.name || ''; name.placeholder = 'Name this food'; name.autocomplete = 'off'; name.enterKeyHint = 'done';
    name.oninput = () => { d.item.name = name.value; changed(d); };
    name.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } };
    body.append(nameLabel, name);
    // Servings, in halves.
    const serv = el('div', 'ch-nut__serv'), stepper = el('div', 'ch-stepper'), servWords = el('span', 'ch-nut__servk'); ui.weight = el('small', 'ch-nut__weight'); ui.weight.id = 'n12-weight';
    servWords.append(el('span', 'ch-nut__k', 'Servings'), ui.weight); serv.append(servWords, stepper);
    ui.less = button('', () => portion(-.5), 'ch-stepper__btn', 'n12-less'); ui.less.innerHTML = icon('minus', 18, { weight: 2.6 }); ui.less.setAttribute('aria-label', 'Half a serving less');
    ui.more = button('', () => portion(.5), 'ch-stepper__btn', 'n12-more'); ui.more.innerHTML = icon('plus', 18, { weight: 2.6 }); ui.more.setAttribute('aria-label', 'Half a serving more');
    ui.servings = el('output', 'ch-stepper__val'); ui.servings.id = 'n12-servings'; ui.servings.setAttribute('aria-live', 'polite');
    stepper.append(ui.less, ui.servings, ui.more); body.append(serv);
    // Calories, big; then protein, carbs and fat. All editable; the ingredients follow the totals.
    const kcal = el('label', 'ch-nut__kcal'), kcalTop = el('span', 'ch-nut__k'); kcalTop.innerHTML = icon('flame', 18); kcalTop.append('Calories');
    ui.kcal = numInput('kcal'); kcal.append(kcalTop, ui.kcal); body.append(kcal);
    const tiles = el('div', 'ch-nut__pcf');
    for (const k of ['protein', 'carbs', 'fat']) { const t = el('label', 'ch-nut__tile ch-nut__tile--' + k), top = el('span', 'ch-nut__k'); top.append(el('i', 'ch-glyph ch-glyph--' + k), NAMES[k]); ui[k] = numInput(k); const val = el('span', 'ch-nut__val'); val.append(ui[k], el('small', '', 'g')); t.append(top, val); tiles.append(t); }
    body.append(tiles);
    // Health score.
    const hs = el('div', 'ch-nut__health'), hsTop = el('div', 'ch-nut__hrow');
    ui.health = el('b', '', ''); ui.health.id = 'health12'; ui.healthBar = el('i', 'ch-nut__hbar');
    const hsLabel = el('span', 'ch-nut__k'); hsLabel.innerHTML = icon('heart', 18); hsLabel.append('Health score');
    hsTop.append(hsLabel, ui.health); const track = el('span', 'ch-nut__htrack'); track.append(ui.healthBar);
    const how = el('details', 'ch-nut__how'); how.append(el('summary', '', 'How is this scored?'), el('p', '', 'Protein for its calories scores up to 4 points on top of 4; fibre adds up to 2 and sugar takes off up to 2 when the AI reports them; processed food takes off 2. A rough guide, not a medical rating.'));
    hs.append(hsTop, track, how); body.append(hs);
    // Ingredients.
    const ing = el('section', 'ch-nut__ing'), ingHead = el('div', 'ch-nut__inghead');
    ingHead.append(el('h3', '', 'Ingredients'), button('+ Add', () => { adding = !adding; drawParts(d); if (adding) U().focusSheet($('n12-item-name'), 30); }, 'ch-link', 'n12-add'));
    ui.parts = el('div', 'ch-nut__parts'); ui.parts.id = 'n12-parts';
    ui.oil = button('', () => addPart(d, OIL), 'ch-chip2', 'n12-oil');
    ing.append(ingHead, ui.parts, ui.oil); body.append(ing);
    drawParts(d);
    // Logged food: Log again and Delete. A draft: Discard.
    const more = el('div', 'ch-nut__more');
    if (d.entryId) more.append(button('Log again', () => { const e = U().journal().entries.find(x => x.id === d.entryId); if (e) { U().closeSheets(); U().logAgain(e); } }, 'ch-link', 'n12-again'), button('Delete food', () => deleteEntry(d), 'ch-link ch-link--danger', 'n12-delete'));
    else if (drafts.includes(d)) more.append(button('Discard', () => discard(d), 'ch-link ch-link--danger', 'n12-discard'));
    if (more.children.length) body.append(more);
    drawFoot(d);
    refresh();
  }
  function numInput(k) {
    const input = el('input', 'ch-nut__num ch-nut__num--' + k); input.id = 'n12-' + k; input.type = 'number'; input.inputMode = 'decimal'; input.min = '0'; input.max = k === 'kcal' ? '50000' : '5000'; input.step = 'any';
    input.setAttribute('aria-label', NAMES[k] + (k === 'kcal' ? ', kcal' : ', grams'));
    input.oninput = () => {
      const d = active, v = Number(input.value);
      if (input.value === '' || !Number.isFinite(v) || v < 0) return;
      const next = v / (d.servings || 1), sum = (d.parts || []).reduce((s, p) => s + (p[k] || 0), 0);
      // Typed straight in: the ingredients follow, in proportion (one ingredient takes it all when they are all 0).
      if (d.parts?.length) { if (sum > 0) d.parts.forEach(p => { p[k] = (p[k] || 0) * next / sum; }); else d.parts[0][k] = next; d.partsDirty = true; }
      d.item[k] = next; changed(d); refresh();
    };
    input.addEventListener('input', () => fit(input));
    return input;
  }
  // P/C/F fields are as wide as their number (the unit follows it); a calorie field fills its card.
  const fit = input => { if (input && input.id !== 'n12-kcal') input.style.width = Math.max(2, String(input.value || input.placeholder || '').length + .6) + 'ch'; };
  // The numbers on the card, updated in place (never the field being typed in, so typing is never interrupted).
  function refresh() {
    const d = active; if (!d || d.status !== 'ready' || !ui.kcal) return;
    const t = total(d), n = d.servings || 1, focus = document.activeElement;
    for (const k of KEYS) { if (ui[k] !== focus) ui[k].value = d.source === 'manual' && !t[k] ? '' : show(k, t[k]); fit(ui[k]); }
    ui.servings.textContent = String(n); ui.less.disabled = n <= .5;
    ui.weight.textContent = Number(d.item.grams) > 0 ? whole(d.item.grams * n) + ' g' : '';
    const score = health(d.item), noScore = !(t.kcal >= 1);
    ui.health.textContent = noScore ? '–' : score + '/10'; ui.healthBar.style.setProperty('--p', noScore ? 0 : (score / 10).toFixed(2));
    ui.parts?.querySelectorAll('[data-part]').forEach(row => {
      const p = d.parts[Number(row.dataset.part)]; if (!p) return;
      row.querySelector('.ch-ing__kcal').textContent = whole(p.kcal * n) + ' kcal';
      const g = row.querySelector('input'); if (g && g !== focus) g.value = p.grams ? String(round(p.grams * n)) : '';
    });
    const oils = (d.parts || []).filter(p => p.name === OIL.name).length;
    ui.oil.textContent = oils ? `+ oil or sauce? · ${oils} added` : '+ oil or sauce?';
    ui.oil.setAttribute('aria-label', 'Add 15 mL of oil or sauce, 120 kcal' + (oils ? ', ' + oils + ' added' : ''));
  }
  function portion(delta) { const d = active; d.servings = Math.max(.5, Math.min(20, (d.servings || 1) + delta)); changed(d); M()?.haptic('tap'); refresh(); }
  function recompute(d) {
    KEYS.forEach(k => { d.item[k] = d.parts.reduce((s, p) => s + (Number(p[k]) || 0), 0); });
    d.item.grams = d.parts.length && d.parts.every(p => p.grams > 0) ? round(d.parts.reduce((s, p) => s + p.grams, 0)) : null;
    d.partsDirty = true; changed(d);
  }
  // A meal with no breakdown becomes its first ingredient the moment something is added to it.
  function materialise(d) { if (!d.parts.length && Number(d.item.kcal) > 0) d.parts.push(cleanPart({ ...d.item, name: d.item.name || 'Food' })); }
  function addPart(d, part) {
    materialise(d);
    const n = d.servings || 1;                      // what you add is what the total grows by, whatever the servings
    d.parts.push(cleanPart({ ...part, grams: part.grams ? part.grams / n : null, ...Object.fromEntries(KEYS.map(k => [k, (Number(part[k]) || 0) / n])) }));
    recompute(d); adding = false; drawParts(d); refresh(); M()?.haptic('on');
  }
  function drawParts(d) {
    const box = ui.parts; if (!box) return; box.replaceChildren();
    d.parts.forEach((p, i) => {
      const row = el('div', 'ch-ing'); row.dataset.part = String(i);
      row.append(el('b', 'ch-ing__name', p.name));
      if (p.grams) {
        const g = el('input', 'ch-ing__grams'); g.type = 'number'; g.inputMode = 'decimal'; g.min = '0'; g.step = 'any'; g.setAttribute('aria-label', 'Grams of ' + p.name);
        g.oninput = () => {
          const v = Number(g.value), n = d.servings || 1;
          if (g.value === '' || !Number.isFinite(v) || v <= 0 || v > 20000 || !p.grams) return;
          const ratio = v / n / p.grams; KEYS.forEach(k => { p[k] = (p[k] || 0) * ratio; }); p.grams = v / n; recompute(d); refresh();
        };
        const unit = el('span', 'ch-ing__unit'); unit.append(g, el('small', '', 'g')); row.append(unit);
      } else row.append(el('span', 'ch-ing__unit ch-ing__unit--none', ''));
      row.append(el('span', 'ch-ing__kcal', ''));
      const x = button('', () => { d.parts.splice(i, 1); recompute(d); drawParts(d); refresh(); M()?.haptic('off'); }, 'ch-ing__x'); x.innerHTML = icon('xmark', 16, { weight: 2.6 }); x.setAttribute('aria-label', 'Remove ' + p.name);
      row.append(x); box.append(row);
    });
    if (!d.parts.length && !adding) box.append(el('p', 'ch-hint ch-nut__none', 'No breakdown. Add an item if something is missing.'));
    if (adding) box.append(addForm(d));
    refresh();
  }
  function addForm(d) {
    const form = el('div', 'ch-nut__addform'), error = el('p', 'ch-nut__error'); error.setAttribute('role', 'alert');
    const input = (key, label, type = 'number') => { const i = el('input', 'ch-input'); i.id = 'n12-item-' + key; i.type = type; i.setAttribute('aria-label', label); i.placeholder = label; if (type === 'number') { i.inputMode = 'decimal'; i.min = '0'; i.step = 'any'; } return i; };
    const nm = input('name', 'Item name', 'text'), g = input('grams', 'Grams'), kc = input('kcal', 'kcal'), pr = input('protein', 'Protein g'), cb = input('carbs', 'Carbs g'), fa = input('fat', 'Fat g');
    const grid = el('div', 'ch-nut__addgrid'); grid.append(g, kc, pr, cb, fa);
    const ok = button('Add item', () => {
      const v = { name: nm.value.trim(), grams: g.value === '' ? null : Number(g.value), kcal: Number(kc.value), protein: Number(pr.value) || 0, carbs: Number(cb.value) || 0, fat: Number(fa.value) || 0 };
      if (!v.name || kc.value === '' || !(v.kcal >= 0 && v.kcal <= 50000) || ['protein', 'carbs', 'fat'].some(k => !(v[k] >= 0 && v[k] <= 5000)) || (v.grams !== null && !(v.grams > 0 && v.grams <= 20000))) { error.textContent = 'Enter a name and kcal (grams and macros are optional).'; return; }
      addPart(d, v);
    }, 'ch-btn ch-btn--primary', 'n12-additem');
    form.append(nm, grid, error, ok, button('Cancel', () => { adding = false; drawParts(d); }, 'ch-btn'));
    return form;
  }
  // The bottom bar: Fix with AI and Done. Fix with AI opens a note right there; Send re-asks the AI with the photo.
  function drawFoot(d) {
    const foot = $('nutrition12-foot'); foot.replaceChildren();
    ui.error = el('p', 'ch-nut__error'); ui.error.setAttribute('role', 'alert');
    if (fixing) {
      const note = el('textarea', 'ch-input ch-nut__note'); note.id = 'n12-note'; note.maxLength = 200; note.rows = 2; note.placeholder = 'What’s wrong? e.g. 2 eggs, not 3'; note.setAttribute('aria-label', 'Correction for AI');
      const send = button('', () => {
        const text = note.value.trim();
        if (!text) { ui.error.textContent = 'Say what to fix first.'; note.focus(); return; }
        d.note = text; fixing = false; M()?.haptic('tap'); estimate(d);
      }, 'ch-btn ch-btn--primary', 'n12-send');
      send.innerHTML = icon('sparkles', 18); send.append('Send');
      const row = el('div', 'ch-nut__actions'); row.append(button('Cancel', () => { fixing = false; drawFoot(d); }, 'ch-btn', 'n12-cancelfix'), send);
      foot.append(note, ui.error, row);
      U().focusSheet(note, 30);
      return;
    }
    const fix = button('', () => { fixing = true; drawFoot(d); }, 'ch-btn ch-nut__fix', 'n12-fix'); fix.innerHTML = icon('sparkles', 18); fix.append('Fix with AI');
    const doneB = button(d.add ? 'Add to meal' : 'Done', () => done(d), 'ch-btn ch-btn--primary ch-nut__done', 'n12-done');
    const row = el('div', 'ch-nut__actions'); row.append(fix, doneB);
    if (!d.entryId) row.append(button('Plan for later', () => done(d, true), 'ch-btn ch-nut__later', 'n12-later'));
    foot.append(ui.error, row);
  }
  const validValues = v => KEYS.every(k => Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= (k === 'kcal' ? 50000 : 5000));
  function bookmark(d) {
    const t = total(d), name = String(d.item.name || '').trim().slice(0, 80);
    if (!fieldsOk(d)) return;
    if (!name || !validValues(t) || t.kcal < 1) { ui.error && (ui.error.textContent = 'Name it and check the numbers first.'); return; }
    const list = U().journal().savedFoods12 || [], same = list.find(f => f.name.toLowerCase() === name.toLowerCase() && Math.round(f.kcal) === Math.round(t.kcal));
    if (same) {
      const index = list.indexOf(same);
      U().change({ label: 'Removed from Saved', kind: 'off', forward: s => { const out = { ...s, savedFoods12: (s.savedFoods12 || []).filter(x => x.id !== same.id) }; if (!out.savedFoods12.length) delete out.savedFoods12; return out; }, backward: s => { const next = (s.savedFoods12 || []).filter(x => x.id !== same.id); next.splice(Math.min(index, next.length), 0, same); return { ...s, savedFoods12: next }; } });
    } else {
      const f = { id: uid(), name, ...Object.fromEntries(KEYS.map(k => [k, k === 'kcal' ? Math.round(t[k]) : round(t[k])])), grams: d.item.grams ? round(d.item.grams * (d.servings || 1)) : null };
      U().change({ label: 'Saved to favourites', forward: s => ({ ...s, savedFoods12: [...(s.savedFoods12 || []).filter(x => x.id !== f.id), f] }), backward: s => { const out = { ...s, savedFoods12: (s.savedFoods12 || []).filter(x => x.id !== f.id) }; if (!out.savedFoods12.length) delete out.savedFoods12; return out; } });
    }
    M()?.pulse($('nutrition12-save'), 'just-on', 450);
    const on = isSaved(d); $('nutrition12-save').setAttribute('aria-pressed', String(on)); $('nutrition12-save').setAttribute('aria-label', on ? 'Saved to favourites. Remove' : 'Save to favourites');
  }
  const FOOD = ['name', 'grams', 'portion', 'kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'processed', 'brand', 'code'];
  // The fields as shown: an empty protein / carbs / fat counts as 0; empty calories or a bad number is refused.
  function fieldsOk(d) {
    for (const k of KEYS) {
      const input = ui[k]; if (!input) continue;
      const raw = input.value.trim(), v = Number(raw), max = k === 'kcal' ? 50000 : 5000;
      if ((raw === '' && k === 'kcal') || (raw !== '' && !(Number.isFinite(v) && v >= 0 && v <= max))) { ui.error.textContent = k === 'kcal' ? 'Calories need a number from 1 to 50,000.' : NAMES[k] + ' needs a number from 0 to 5,000 g.'; input.focus(); return false; }
      if (raw === '' && Number(d.item[k]) !== 0) { input.value = '0'; input.dispatchEvent(new Event('input')); }
    }
    return true;
  }
  async function done(d, later = false) {
    if (d.saving) return;
    if (!fieldsOk(d)) return;
    const t = total(d), n = d.servings || 1, name = String(d.item.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) { ui.error.textContent = 'Give it a name first.'; $('n12-name')?.focus(); return; }
    if (!validValues(t) || t.kcal < 1) { ui.error.textContent = 'Calories need a number from 1 to 50,000.'; $('n12-kcal')?.focus(); return; }
    d.saving = true;
    try { if (d.image && d.photoId) await storage('photos', 'put', { image: d.image, thumbnail: d.thumbnail || d.image }, d.photoId); }
    catch { d.saving = false; ui.error.textContent = 'Couldn’t keep the photo on this device. Try again, or remove the photo.'; return; }
    const food = Object.fromEntries(FOOD.filter(k => d.item[k] !== undefined && d.item[k] !== null && d.item[k] !== '').map(k => [k, d.item[k]]));
    const grams = Number(d.item.grams) > 0 ? round(d.item.grams * n) : null;
    // A value left as it was keeps its exact stored form (an older entry may hold 182.2 kcal); a changed one is rounded.
    const value = k => d.origin && n === 1 && Number(d.item[k]) === Number(d.origin[k]) ? d.origin[k] : k === 'kcal' ? Math.round(t[k]) : round(t[k]);
    const entry = { ...(d.origin || {}), ...food, name, kcal: value('kcal'), protein: value('protein'), carbs: value('carbs'), fat: value('fat'), id: d.entryId || 'food-' + uid(), day: d.day, source: d.origin?.source || d.source, meal: d.origin?.meal || d.item.meal || U().defaultMeal() };
    if (d.origin && n === 1 && String(d.origin.name) === name) entry.name = d.origin.name;
    if (d.at) entry.at = d.at;
    if (grams) entry.grams = grams; else delete entry.grams;
    const portion = grams ? whole(grams) + ' g' : n === 1 ? (d.origin ? d.origin.portion : d.item.portion || '1 serving') : n + ' servings';
    if (portion) entry.portion = portion; else delete entry.portion;
    if (d.origin && n === 1 && Number(d.item.grams) === Number(d.origin.grams) && d.origin.portion !== undefined) entry.portion = d.origin.portion;
    if (d.photoId) entry.photoId = d.photoId;
    if (d.partsDirty && d.parts.length) entry.ingredients12 = d.parts.map(p => ({ name: p.name, grams: p.grams ? round(p.grams * n) : null, kcal: round(p.kcal * n), protein: round(p.protein * n), carbs: round(p.carbs * n), fat: round(p.fat * n) }));
    else if (d.partsDirty) delete entry.ingredients12;
    // A result never embeds a photo, a token or the draft's words in the journal or the export.
    delete entry.image; delete entry.thumbnail; delete entry.hint;
    // The draft leaves the list in the same render that adds the logged food (never both at once).
    const list = drafts; drafts = drafts.filter(x => x.id !== d.id);
    if (later) {
      if (!U().planFood(entry, d.day)) { drafts = list; d.saving = false; ui.error.textContent = 'Could not save planned food.'; render(); return; }
      d.add = null; U().closeSheets();
    }
    else if (d.add) { const back = d.add; d.add = null; U().closeSheets(); back(entry); render(); if (d.photoId && !d.entryId) storage('photos', 'delete', d.photoId).catch(() => {}); }
    else {
      const before = U().journal().entries.find(e => e.id === entry.id);
      // Nothing changed: nothing is saved, no toast, no Undo to replace the one waiting.
      if (before && same(before, entry)) { d.saving = false; U().closeSheets(); if (active === d) active = null; render(); storage('drafts', 'delete', d.id).catch(() => {}); return; }
      M()?.mark(`#recent12 [data-entry="${entry.id}"]`, 'just-on');
      const ok = U().change({ label: (before ? 'Saved · ' : '') + name + ' · ' + whole(entry.kcal) + ' kcal', day: entry.day,
        forward: s => ({ ...s, entries: before ? s.entries.map(e => e.id === entry.id ? entry : e) : [...s.entries.filter(e => e.id !== entry.id), entry] }),
        backward: s => ({ ...s, entries: before ? s.entries.map(e => e.id === entry.id ? before : e) : s.entries.filter(e => e.id !== entry.id) }) });
      if (!ok) { drafts = list; d.saving = false; ui.error.textContent = 'Couldn’t save. Storage may be full.'; render(); return; }
      U().closeSheets();
    }
    d.saving = false; if (active === d) active = null;      // the change above already drew the list (a redraw now would cut the logged row's rise)
    await storage('drafts', 'delete', d.id).catch(() => {});
  }
  const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
  const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  function deleteEntry(d) { const before = U().journal().entries.find(e => e.id === d.entryId); if (before && U().removeEntry(before)) U().closeSheets(); }
  // A draft you do not want: gone from the list (Undo in the toast puts it back, photo and all).
  function discard(d, quiet) {
    d.discarded = true; drafts = drafts.filter(x => x !== d); running.delete(d.id);
    storage('drafts', 'delete', d.id).catch(() => {});
    if (active === d && $('nutrition12').open) U().closeSheet($('nutrition12'));
    render(); M()?.haptic('off');
    if (d.photoId) setTimeout(() => { if (d.discarded) storage('photos', 'delete', d.photoId).catch(() => {}); }, 9000);
    if (!quiet) U().toast('Draft removed', () => { d.discarded = false; if (!drafts.includes(d)) drafts.push(d); if (d.status === 'pending') { d.status = 'error'; d.errorKind = 'interrupted'; setError(d); } keep(d).catch(() => {}); render(); }, { kind: 'off' });
  }

  /* ---- Recently eaten: drafts first (analysing, to review, to retry), then the day's food, newest first ---- */
  const pendFraction = d => 0.06 + 0.88 * (1 - Math.exp(-(Date.now() - (d.startedAt || Date.now())) / 8000));
  function setPend(r, d) { const p = pendFraction(d); r.style.setProperty('--p', p.toFixed(3)); const fill = r.querySelector('.ch-pend__fill'); if (fill) fill.style.strokeDasharray = (p * 100).toFixed(1) + ' 100'; }
  function pendRing(d) {
    const r = el('span', 'ch-pend');
    r.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ch-pend__track" cx="50" cy="50" r="40"/><circle class="ch-pend__fill" cx="50" cy="50" r="40" pathLength="100"/></svg>';
    setPend(r, d); return r;
  }
  function art(d, photoId, src, glyphName) {
    const box = el('span', 'ch-food__art');
    if (photoId || src) { const img = el('img'); img.alt = ''; img.decoding = 'async'; if (src) img.src = src; else thumb(photoId, img); box.append(img); }
    else { box.classList.add('is-icon'); box.innerHTML = icon(glyphName || 'fork', 24); }
    return box;
  }
  const glyphFor = e => e.source === 'favourite' || e.fav ? 'star' : e.source === 'barcode' ? 'barcode' : e.source === 'text' ? 'sparkles' : e.planSlot === 'D' ? 'moon' : e.planSlot === 'P' ? 'bolt' : 'fork';
  function render() {
    const list = $('recent12'); if (!list || !U()?.journal) return;
    const state = U().journal(), day = U().dateKey(), rows = [];
    const mine = drafts.filter(x => x.day === day);
    const busyEntries = new Set(mine.filter(x => x.entryId).map(x => x.entryId));
    for (const d of mine.slice().reverse()) {
      const li = el('li', 'ch-recent__item'), b = button('', () => review(d), 'ch-food is-draft is-' + d.status);
      b.dataset.draft = d.id;
      const a = art(d, d.photoId, d.thumbnail || (d.photoId && photoCache.get(d.photoId)), 'sparkles');
      if (d.status === 'pending') a.append(pendRing(d));
      const words = el('span', 'ch-food__words'), top = el('span', 'ch-food__top');
      if (d.status === 'pending') {
        top.append(el('b', 'ch-food__name', 'Analysing…'), el('small', 'ch-food__time', timeOf(d.at)));
        const sk = el('span', 'ch-food__skel'); sk.setAttribute('aria-hidden', 'true'); sk.append(el('i'), el('i'));
        words.append(top, sk, el('small', 'ch-food__note', d.note ? 'Fixing your food' : 'Estimating calories'));
        b.setAttribute('aria-label', 'Analysing a ' + (d.source === 'text' ? 'description' : 'photo') + '. Open');
      } else if (d.status === 'error') {
        top.append(el('b', 'ch-food__name', d.item?.name || 'Not analysed'), el('small', 'ch-food__time', timeOf(d.at)));
        words.append(top, el('small', 'ch-food__note is-alert', UNREACHABLE.has(d.errorKind) ? 'Can’t reach PC · tap to retry' : d.errorKind === 'auth' ? 'Check AI settings · tap' : (d.error || 'Needs a retry') + ' · tap'));
        b.setAttribute('aria-label', (d.error || 'Not analysed') + '. Open to retry, search or describe it');
      } else {
        const t = total(d);
        top.append(el('b', 'ch-food__name', d.item?.name || 'Food'), el('small', 'ch-food__time', timeOf(d.at)));
        const k = el('span', 'ch-food__kcal'); k.innerHTML = icon('flame', 14); k.append(whole(t.kcal) + ' kcal');
        words.append(top, k, el('small', 'ch-food__note is-ready', 'Ready · tap to check and log'));
        b.setAttribute('aria-label', (d.item?.name || 'Food') + ', ' + whole(t.kcal) + ' kcal, not logged yet. Review');
      }
      b.prepend(a); b.append(words); li.append(b); rows.push(li);
    }
    for (const e of state.entries.filter(x => x.day === day).slice().reverse()) {
      if (busyEntries.has(e.id)) continue;
      const li = el('li', 'ch-recent__item'), b = button('', () => edit(e), 'ch-food');
      b.dataset.entry = e.id;
      const words = el('span', 'ch-food__words'), top = el('span', 'ch-food__top'), when = e.at ? timeOf(e.at) : e.meal || '';
      top.append(el('b', 'ch-food__name', e.name || 'Food'), el('small', 'ch-food__time', when));
      const k = el('span', 'ch-food__kcal'); k.innerHTML = icon('flame', 14); k.append(whole(e.kcal) + ' kcal');
      const pcf = el('span', 'ch-food__pcf');
      for (const [key, letter] of [['protein', 'P'], ['carbs', 'C'], ['fat', 'F']]) { const m = el('span', 'ch-food__m ch-food__m--' + key); m.append(el('i', 'ch-glyph ch-glyph--' + key), round(e[key] || 0) + 'g'); m.setAttribute('aria-hidden', 'true'); pcf.append(m); }
      words.append(top, k, pcf);
      b.setAttribute('aria-label', `${e.name || 'Food'}${when ? ', ' + when : ''}, ${whole(e.kcal)} kcal, protein ${round(e.protein)} g, carbs ${round(e.carbs || 0)} g, fat ${round(e.fat || 0)} g. Edit`);
      b.prepend(art(e, e.photoId, null, glyphFor(e))); b.append(words); li.append(b); rows.push(li);
    }
    if (!rows.length) { const li = el('li', 'ch-recent__empty'); li.innerHTML = icon('camera', 28); li.append(el('b', '', 'Nothing logged yet'), el('span', '', 'Tap + to snap your food, or log a meal above.')); rows.push(li); }
    list.replaceChildren(...rows);
    if (drafts.some(d => d.status === 'pending')) pend();
  }
  // Photos no logged food and no draft points to, taken more than a day ago (a discarded draft, a deleted food after its
  // Undo, a photo added to a custom meal): deleted from the device.
  async function tidyPhotos() {
    try {
      const keys = await storage('photos', 'getAllKeys'), used = new Set([...U().journal().entries.map(e => e.photoId), ...drafts.map(d => d.photoId)].filter(Boolean)), day = Date.now() - 864e5;
      for (const key of keys) { const at = parseInt(String(key).split('-')[1], 36); if (!used.has(key) && Number.isFinite(at) && at < day) await storage('photos', 'delete', key); }
    } catch { /* tidying is best effort */ }
  }
  function init() {
    build();
    render();
    storage('drafts', 'getAll').then(saved => {
      const known = new Set(drafts.map(d => d.id));
      // An analysis cut short by a reload or a closed app can be retried: the photo is still here.
      const entries = U().journal().entries, logged = new Set(entries.map(e => e.photoId).filter(Boolean)), loggedAt = new Set(entries.filter(e => e.at).map(e => e.day + '@' + e.at));
      for (const d of saved) {
        if (known.has(d.id)) continue;
        if (!d.entryId && (d.photoId ? logged.has(d.photoId) : loggedAt.has(d.day + '@' + d.at))) { storage('drafts', 'delete', d.id).catch(() => {}); continue; }   // logged already
        const draft = { base: d.hint || '', desc: '', note: '', ...d };
        if (draft.status === 'pending') { draft.status = 'error'; draft.errorKind = 'interrupted'; }
        if (draft.status === 'error') setError(draft);
        drafts.push(draft);
      }
      render(); tidyPhotos(); retryDrafts(true);
    }).catch(() => {});
  }
  // Each load gets one immediate recovery attempt. Subsequent events use the persisted LAST attempt.
  // A throttled event gets one deferred attempt, never a polling loop or a retry-on-failure loop.
  const deferredRetries = new Map();
  function retryDrafts(startup = false, onlyId = null) {
    if (document.hidden && !startup) return;
    for (const d of drafts) {
      if (onlyId && d.id !== onlyId) continue;
      if (d.status !== 'error' || !UNREACHABLE.has(d.errorKind) || running.has(d.id)) continue;
      const remaining = 30000 - (Date.now() - (d.lastAttemptAt || 0));
      if (!startup && remaining > 0) {
        if (!deferredRetries.has(d.id)) deferredRetries.set(d.id, setTimeout(() => {
          deferredRetries.delete(d.id);
          if (drafts.includes(d) && d.status === 'error') retryDrafts(false, d.id);
        }, remaining));
        continue;
      }
      clearTimeout(deferredRetries.get(d.id)); deferredRetries.delete(d.id);
      estimate(d); // background result stays in Recently eaten; no modal opens on resume
    }
  }
  // navigator.onLine can be stale on iOS: the actual request determines reachability.
  addEventListener('online', () => retryDrafts());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retryDrafts(); });
  function suspend() { context = null; active = null; handoff = true; stop(); }
  window.CHADScan12 = { open, openResult, edit, render, health, suspend, drafts: () => drafts.slice() };
  init();
})();
