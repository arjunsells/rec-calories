// OPT-IN live check of Snap + Say against the real CHAD proxy (not part of run-all). It needs this machine's proxy token
// in %USERPROFILE%\.chad-proxy\token (override: CHAD_TOKEN_FILE). The token is read into memory only: never printed,
// logged, written to a file or put in a screenshot; every line this script prints is scrubbed of it as a safety net.
// The app is served from the local working tree under the Pages origin (https://arjunsells.github.io/rec-calories/)
// inside the browser, so the proxy's CORS rule applies exactly as on the phone. Real requests: the token check, one
// text estimate and one photo estimate at 393 × 852 @3x, one text estimate at 375 × 667, and two rejected (401)
// calls with a made-up token. Photo: CHAD_LIVE_PHOTO=<path to a food photo>, or a drawn plate of eggs and toast.
// Screenshots: ../rec-calories-shots/v9-ai-analysing.png and v9-ai-confirm.png (toasts hidden).
// Route: on the proxy's own PC its name resolves to a tailnet address, which Chromium's Local Network Access rules block
// for a public page. A phone on mobile data sees the public Funnel address, so the browser is pinned to that address,
// looked up from public DNS at run time.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), dns = require('node:dns'), { execFileSync } = require('node:child_process');
const { launch, IPHONE, MIME, root } = require('./harness.cjs');
const scan = require('../scan9.js');
const TOKEN_FILE = process.env.CHAD_TOKEN_FILE || path.join(os.homedir(), '.chad-proxy', 'token');
if (!fs.existsSync(TOKEN_FILE)) { console.log('SKIP live AI check: no proxy token on this machine.'); process.exit(0); }
const TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const scrub = value => String(value).split(TOKEN).join('[token]');
for (const name of ['log', 'error', 'warn']) { const write = console[name].bind(console); console[name] = (...args) => write(...args.map(a => scrub(typeof a === 'string' ? a : a instanceof Error ? a.stack : JSON.stringify(a)))); }
process.on('uncaughtException', e => { console.error(e); process.exit(1); });
const ORIGIN = 'https://arjunsells.github.io', BASE = ORIGIN + '/rec-calories/', SHOTS = path.join(root, '..', 'rec-calories-shots');
const LINK = BASE + '#ai=' + encodeURIComponent(scan.DEFAULT_PROXY.replace(/\/$/, '')) + '&k=' + TOKEN;
const results = {}, tidy = r => ({ name: r[0], grams: r[1], kcal: r[2], protein: r[3], carbs: r[4], fat: r[5] });

async function context(browser, size, scheme) {
  const ctx = await browser.newContext({ viewport: size, ...IPHONE, colorScheme: scheme, serviceWorkers: 'block', acceptDownloads: true });
  // The working tree, served as the Pages site. Nothing at that origin is fetched from the internet.
  await ctx.route(url => url.origin === ORIGIN, route => {
    const url = new URL(route.request().url()), rel = decodeURIComponent(url.pathname.replace(/^\/rec-calories\/?/, '')) || 'index.html', file = path.join(root, rel);
    if (!url.pathname.startsWith('/rec-calories/') || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'missing' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', headers: { 'Cache-Control': 'no-store' }, body: fs.readFileSync(file) });
  });
  const page = await ctx.newPage(), leaks = [], sent = [], errors = [];
  page.on('request', r => { if (r.url().includes(TOKEN) && !r.isNavigationRequest()) leaks.push(r.method()); if (r.url().startsWith(scan.DEFAULT_PROXY)) sent.push({ method: r.method(), path: new URL(r.url()).pathname, token: r.headers()['x-chad-token'] === TOKEN ? 'device' : r.headers()['x-chad-token'] ? 'other' : 'none' }); });
  page.on('pageerror', e => errors.push(e.message));
  return { ctx, page, leaks, sent, errors };
}
const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
const quiet = page => page.evaluate(() => { CHADUX.hideToast(true); const m = document.getElementById('message'); m.textContent = ''; document.getElementById('celebration').hidden = true; });
const card = page => page.evaluate(() => ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'].map(k => document.getElementById('result-' + k).value));
// The token is never on screen or in the page's markup, fields or journal.
const shown = page => page.evaluate(token => [document.documentElement.outerHTML, ...[...document.querySelectorAll('input,textarea')].map(e => e.value), localStorage.getItem('rec-calories-v1') || '', location.href].some(text => text.includes(token)), TOKEN);
const status = page => page.evaluate(() => document.getElementById('ai-status-title').textContent);
const openSnap = async page => { await tap(page.locator('[data-view=today]')); await tap(page.locator('#add-food')); await tap(page.locator('#builder-ask-go')); await page.locator('#scan-sheet').waitFor({ state: 'visible' }); await page.waitForTimeout(450); };
const toSettings = async page => { if (await page.locator('#settings').isVisible()) return; await tap(page.locator('[data-view=today]')); await tap(page.locator('#open-settings')); await page.locator('#advanced-settings').scrollIntoViewIfNeeded(); };
async function estimateCard(page, label) {
  const started = Date.now();
  await page.locator('#snap-analysing').waitFor({ state: 'visible' });
  const outcome = await Promise.race([page.locator('#confirm-sheet').waitFor({ state: 'visible', timeout: 110000 }).then(() => 'card', () => 'timeout'), page.locator('#snap-ways').waitFor({ state: 'visible', timeout: 110000 }).then(() => 'ways', () => 'timeout')]);
  if (outcome !== 'card') throw Error(label + ': no estimate. The app said: ' + await page.locator('#snap-ways').innerText());
  await page.waitForTimeout(500);
  const values = await card(page);
  results[label] = { ...tidy(values), confidence: await page.locator('#confidence').innerText(), seconds: Math.round((Date.now() - started) / 100) / 10 };
  return values;
}
// Weight scaling on the real answer: half the weight, half of everything (within rounding); then back.
async function halve(page, values) {
  const grams = Number(values[1]); assert.ok(grams > 0, 'the answer has a weight');
  await page.locator('#result-grams').fill(String(grams / 2));
  const half = await card(page);
  for (const i of [2, 3, 4, 5]) assert.ok(Math.abs(Number(half[i]) - Number(values[i]) / 2) <= (i === 2 ? 1 : 0.1), `half ${['', '', 'kcal', 'protein', 'carbs', 'fat'][i]}: ${half[i]} vs ${values[i]}`);
  await page.locator('#result-grams').fill(values[1]);
  assert.deepEqual(await card(page), values, 'back to the original numbers');
  return half;
}
async function logAndUndo(page, values, source) {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1') || '{"entries":[]}').entries.length);
  await tap(page.locator('#scan-confirm-form button[type=submit]'));                 // Add to meal
  await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#builder-log'));
  const journal = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')));
  const entry = journal.entries.at(-1);
  assert.equal(journal.entries.length, before + 1); assert.deepEqual([entry.name, entry.kcal, entry.protein, entry.carbs, entry.fat, entry.portion.replace(/,/g, ''), entry.source], [values[0], Number(values[2]), Number(values[3]), Number(values[4]), Number(values[5]), Math.round(Number(values[1])) + ' g', source]);
  assert.equal(JSON.stringify(journal).includes('data:image'), false, 'no photo in the journal');
  await page.locator('#undo-toast button').waitFor(); await tap(page.locator('#undo-toast button'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).entries.length), before, 'Undo removes it');
}

(async () => {
  assert.ok(TOKEN.length >= 32, 'a proxy token is on this machine');
  fs.mkdirSync(SHOTS, { recursive: true });
  const photo = process.env.CHAD_LIVE_PHOTO ? { name: path.basename(process.env.CHAD_LIVE_PHOTO), mimeType: 'image/jpeg', buffer: fs.readFileSync(process.env.CHAD_LIVE_PHOTO) } : null;
  const host = new URL(scan.DEFAULT_PROXY).hostname, resolver = new dns.promises.Resolver(); resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const [publicIP] = await resolver.resolve4(host).catch(() => []);
  results.route = publicIP ? 'public Funnel address (as a phone on mobile data)' : 'system DNS';
  const browser = await launch(publicIP ? [`--host-resolver-rules=MAP ${host} ${publicIP}`] : []);
  try {
    // 1. 393 × 852 @3x: the setup link (the way a phone gets connected), Settings, a real text and a real photo estimate.
    const big = await context(browser, { width: 393, height: 852 }, 'dark'), page = big.page;
    await page.goto(LINK); await page.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    assert.equal(await page.evaluate(() => location.hash), '', 'the link leaves the address bar at once');
    assert.equal(await page.evaluate(token => localStorage.getItem('chad.aiProxyToken') === token, TOKEN), true, 'the token is saved on the device');
    assert.equal(await page.evaluate(url => localStorage.getItem('chad.aiProxyUrl') === url, scan.DEFAULT_PROXY), true);
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    await tap(page.locator('#ai-test')); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    results.settings = { status: await status(page), detail: await page.locator('#ai-status-text').innerText(), checks: big.sent.filter(s => s.path === '/estimate' && s.method === 'POST').length };
    assert.equal(await shown(page), false, 'no token on screen after setup');
    // Real text estimate.
    await openSnap(page);
    await page.locator('#food-description').fill('200 g grilled chicken breast with 150 g cooked white rice');
    await tap(page.locator('#describe-button'));
    let values = await estimateCard(page, 'text');
    results.text.half = tidy(await halve(page, values));
    await logAndUndo(page, values, 'text');
    // Real photo estimate: the analysing card and the confirm card are the screenshots.
    await openSnap(page);
    const picture = photo || { name: 'plate.png', mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d');
      x.fillStyle = '#8a5a35'; x.fillRect(0, 0, 1600, 1200); for (let i = 0; i < 1200; i += 40) { x.fillStyle = i % 80 ? '#7d5030' : '#93633d'; x.fillRect(0, i, 1600, 20); }
      x.fillStyle = '#f4f4f2'; x.beginPath(); x.ellipse(800, 600, 560, 470, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e6e6e2'; x.beginPath(); x.ellipse(800, 600, 430, 350, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#c98a3c'; for (const [cx, cy] of [[640, 470], [700, 560]]) { x.save(); x.translate(cx, cy); x.rotate(-0.2); x.fillRect(-150, -110, 300, 220); x.fillStyle = '#e8b465'; x.fillRect(-130, -92, 260, 184); x.restore(); x.fillStyle = '#c98a3c'; }
      for (const [cx, cy] of [[940, 560], [1030, 700]]) { x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy, 150, 120, 0.4, 0, Math.PI * 2); x.fill(); x.fillStyle = '#ffb000'; x.beginPath(); x.arc(cx + 10, cy - 5, 48, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(cx - 5, cy - 20, 14, 0, Math.PI * 2); x.fill(); }
      return c.toDataURL('image/png').split(',')[1];
    }), 'base64') };
    await page.locator('#photo-input').setInputFiles(picture);
    await page.locator('#snap-analysing').waitFor({ state: 'visible' }); await page.waitForTimeout(1800); await quiet(page);
    assert.equal(await shown(page), false);
    await page.screenshot({ path: path.join(SHOTS, 'v9-ai-analysing.png') });
    values = await estimateCard(page, 'photo');
    await page.waitForTimeout(400); await quiet(page);
    assert.equal(await shown(page), false);
    await page.screenshot({ path: path.join(SHOTS, 'v9-ai-confirm.png') });
    results.photo.image = photo ? 'local photo' : 'drawn plate'; results.photo.half = tidy(await halve(page, values));
    results.photo.breakdown = await page.locator('#result-parts').isVisible() ? await page.locator('#result-parts-title').innerText() : 'omitted';
    await logAndUndo(page, values, 'photo');
    // The backup carries no AI settings.
    await toSettings(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-backup').click()]);
    const backup = fs.readFileSync(await download.path(), 'utf8'); assert.equal(backup.includes(TOKEN) || backup.includes(new URL(scan.DEFAULT_PROXY).host), false, 'backup without token or proxy');
    // 2. Failure paths against real endpoints. A made-up token in a setup link: flagged at once, then a real 401 estimate.
    await page.goto(BASE + '#ai=' + encodeURIComponent(scan.DEFAULT_PROXY) + '&k=synthetic-wrong-token');
    await page.locator('#message').filter({ hasText: 'didn’t take that link’s token' }).waitFor({ timeout: 20000 });
    await openSnap(page); await page.locator('#food-description').fill('a banana'); await tap(page.locator('#describe-button'));
    await page.locator('#snap-ways').waitFor({ state: 'visible', timeout: 30000 });
    results.wrongToken = (await page.locator('#snap-ways-title').innerText()) + ' / ' + (await page.locator('#snap-setup').isVisible() ? 'Set up AI again button' : 'no setup button');
    await tap(page.locator('#snap-setup')); assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-link');
    await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Set up again', null, { timeout: 20000 });
    // An unreachable proxy (a name that never resolves): asks first, shows Offline, and the estimate ends in "AI is offline".
    await page.goto(BASE + '#ai=' + encodeURIComponent('https://chad-proxy.invalid') + '&k=synthetic-token');
    await page.locator('#detail-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Connect' }));
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Offline', null, { timeout: 20000 });
    await openSnap(page); await page.locator('#food-description').fill('a banana'); await tap(page.locator('#describe-button'));
    await page.locator('#snap-ways').waitFor({ state: 'visible', timeout: 30000 });
    results.unreachable = (await page.locator('#snap-ways-title').innerText()) + ' / ' + (await page.locator('#snap-ways-text').innerText());
    await tap(page.locator('[data-snap=manual]')); assert.equal(await page.locator('#result-name').inputValue(), 'a banana', 'Type it takes the words');
    await page.keyboard.press('Escape'); await page.locator('#confirm-sheet').waitFor({ state: 'hidden' }); await page.locator('#builder-sheet').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
    // Back to the real link, then Disconnect (with Undo).
    await page.goto(LINK); await page.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    await tap(page.locator('#ai-disconnect')); assert.equal(await page.evaluate(() => localStorage.getItem('chad.aiProxyToken')), null); assert.equal(await status(page), 'Not set up');
    await tap(page.locator('#undo-toast button')); assert.equal(await page.evaluate(token => localStorage.getItem('chad.aiProxyToken') === token, TOKEN), true, 'Undo reconnects');
    assert.equal(await shown(page), false); assert.deepEqual(big.leaks, [], 'the token never travels in a URL');
    assert.ok(big.sent.filter(s => s.method === 'POST' && s.path === '/estimate').every(s => s.token !== 'none'), 'every estimate call carries a token header');
    results.requests393 = big.sent.reduce((n, s) => ({ ...n, [`${s.method} ${s.path} (${s.token} token)`]: (n[`${s.method} ${s.path} (${s.token} token)`] || 0) + 1 }), {});
    assert.deepEqual(big.errors, []);
    await big.ctx.close();

    // 3. 375 × 667: the link, one real text estimate, the card within reach, log and Undo.
    const small = await context(browser, { width: 375, height: 667 }, 'light'), little = small.page;
    await little.goto(LINK); await little.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    await openSnap(little); await little.locator('#food-description').fill('a flat white with full cream milk and a banana');
    await tap(little.locator('#describe-button'));
    values = await estimateCard(little, 'text375');
    assert.equal(await little.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
    await quiet(little); await little.screenshot({ path: path.join(root, '.qa', 'v9-ai-confirm-375.png') });
    await logAndUndo(little, values, 'text');
    assert.equal(await shown(little), false); assert.deepEqual(small.leaks, []); assert.deepEqual(small.errors, []);
    await small.ctx.close();
  } finally { await browser.close(); }

  // 4. Nothing of the token anywhere it could leak: the working tree (tracked and untracked, not ignored) and the shots.
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const dirty = files.filter(f => { try { return fs.readFileSync(path.join(root, f)).includes(TOKEN); } catch { return false; } });
  const shots = fs.readdirSync(SHOTS).filter(f => fs.readFileSync(path.join(SHOTS, f)).includes(TOKEN));
  assert.deepEqual(dirty, [], 'no repository file holds the token'); assert.deepEqual(shots, [], 'no screenshot file holds the token');
  console.log('Live results (no token):\n' + JSON.stringify(results, null, 2));
  console.log(`PASS live Snap + Say through the real proxy: setup link stored and wiped, Connected (health + token check), real text and photo estimates in the editable card, weight scaling, log and Undo, 375 × 667 text estimate, made-up token → 401 → set up again, unreachable proxy → AI is offline → Quick add, Disconnect with Undo, backup and journal clean, token never in a URL, on screen, in ${files.length} repository files or the shots. Screenshots: ${path.join(SHOTS, 'v9-ai-analysing.png')}, v9-ai-confirm.png.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
