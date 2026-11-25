// OPT-IN live check of v12's photo AI against the real CHAD proxy (not part of run-all). It needs this machine's proxy
// token in %USERPROFILE%\.chad-proxy\token (override: CHAD_TOKEN_FILE). The token is read into memory only: never
// printed, logged, written to a file or put in a screenshot; every line this script prints is scrubbed of it.
// The app is served from the local working tree under the Pages origin (https://arjunsells.github.io/rec-calories/)
// inside the browser, so the proxy's CORS rule applies exactly as on the phone. Real requests: the token check, one
// described estimate and one photo estimate at 393 × 852 @3x, one described estimate at 375 × 667, and rejected (401)
// calls with a made-up token. Photo: CHAD_LIVE_PHOTO=<path to a food photo>, or a drawn plate of eggs and toast, taken
// through the camera's file fallback (headless has no camera), exactly as the iPhone home-screen app does.
// Screenshots: ../rec-calories-shots/v12-ai-analysing.png (the Analysing… row) and v12-ai-card.png (toasts hidden).
// Route: on the proxy's own PC its name resolves to a tailnet address, which Chromium's Local Network Access rules block
// for a public page. A phone on mobile data sees the public Funnel address, so the browser is pinned to that address,
// looked up from public DNS at run time.
// CHAD_LIVE_STUB=1 runs the same script with no network and no token: a synthetic token and an in-browser stand-in for
// the proxy (same contract, same CORS), screenshots to .qa. It checks the script itself, not the proxy.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), dns = require('node:dns'), { execFileSync } = require('node:child_process');
const { launch, IPHONE, MIME, root } = require('./harness.cjs');
const scan = require('../scan9.js');
const STUB = process.env.CHAD_LIVE_STUB === '1';
const TOKEN_FILE = process.env.CHAD_TOKEN_FILE || path.join(os.homedir(), '.chad-proxy', 'token');
if (!STUB && !fs.existsSync(TOKEN_FILE)) { console.log('SKIP live AI check: no proxy token on this machine (CHAD_LIVE_STUB=1 checks the script without one).'); process.exit(0); }
const TOKEN = STUB ? 'synthetic-stub-token-for-the-live-script-0001' : fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const scrub = value => String(value).split(TOKEN).join('[token]');
for (const name of ['log', 'error', 'warn']) { const write = console[name].bind(console); console[name] = (...args) => write(...args.map(a => scrub(typeof a === 'string' ? a : a instanceof Error ? a.stack : JSON.stringify(a)))); }
process.on('uncaughtException', e => { console.error(e); process.exit(1); });
const ORIGIN = 'https://arjunsells.github.io', BASE = ORIGIN + '/rec-calories/', SHOTS = STUB ? path.join(root, '.qa') : path.join(root, '..', 'rec-calories-shots');
const LINK = BASE + '#ai=' + encodeURIComponent(scan.DEFAULT_PROXY.replace(/\/$/, '')) + '&k=' + TOKEN;
const PROXY = new URL(scan.DEFAULT_PROXY).origin;
const results = {}, tidy = r => ({ name: r[0], kcal: r[1], protein: r[2], carbs: r[3], fat: r[4] });

// The stand-in proxy (stub mode only): /health, the token checked before the input, an answer by what was sent.
function stub(route) {
  const req = route.request(), url = new URL(req.url()), cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type, x-chad-token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
  const reply = (status, body) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (url.pathname === '/health') return reply(200, { ok: true });
  if (req.headers()['x-chad-token'] !== TOKEN) return reply(401, { error: 'token' });
  const body = req.postDataJSON() || {};
  if (!body.image && !body.text) return reply(400, { error: 'input' });
  return new Promise(r => setTimeout(r, 1500)).then(() => reply(200, body.image
    ? { name: 'Eggs on toast', grams: 260, kcal: 520, protein_g: 26, carbs_g: 44, fat_g: 26, confidence: .7, items: [{ name: 'Fried eggs', grams: 120, kcal: 220, protein_g: 15, carbs_g: 1, fat_g: 17 }, { name: 'Toast', grams: 80, kcal: 210, protein_g: 7, carbs_g: 40, fat_g: 3 }, { name: 'Butter', grams: 10, kcal: 90, protein_g: 0, carbs_g: 0, fat_g: 10 }] }
    : { name: 'Chicken and rice', grams: 350, kcal: 525, protein_g: 66, carbs_g: 42, fat_g: 7, confidence: .8, items: [] }));
}
async function context(browser, size, scheme) {
  const ctx = await browser.newContext({ viewport: size, ...IPHONE, colorScheme: scheme, serviceWorkers: 'block', acceptDownloads: true });
  // The working tree, served as the Pages site. Nothing at that origin is fetched from the internet.
  await ctx.route(url => url.origin === ORIGIN, route => {
    const url = new URL(route.request().url()), rel = decodeURIComponent(url.pathname.replace(/^\/rec-calories\/?/, '')) || 'index.html', file = path.join(root, rel);
    if (!url.pathname.startsWith('/rec-calories/') || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'missing' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', headers: { 'Cache-Control': 'no-store' }, body: fs.readFileSync(file) });
  });
  if (STUB) await ctx.route(url => url.origin === PROXY, stub);
  const page = await ctx.newPage(), leaks = [], sent = [], errors = [];
  page.on('request', r => { if (r.url().includes(TOKEN) && !r.isNavigationRequest()) leaks.push(r.method()); if (r.url().startsWith(PROXY) && r.method() !== 'OPTIONS') sent.push({ method: r.method(), path: new URL(r.url()).pathname, token: r.headers()['x-chad-token'] === TOKEN ? 'device' : r.headers()['x-chad-token'] ? 'other' : 'none' }); });
  page.on('pageerror', e => errors.push(e.message));
  return { ctx, page, leaks, sent, errors };
}
const tap = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.tap(); };
const quiet = page => page.evaluate(() => { CHADUX.hideToast(true); const m = document.getElementById('message'); m.textContent = ''; document.getElementById('celebration').hidden = true; });
const card = page => page.evaluate(() => ['name', 'kcal', 'protein', 'carbs', 'fat'].map(k => document.getElementById('n12-' + k).value));
// The token is never on screen or in the page's markup, fields or journal.
const shown = page => page.evaluate(token => [document.documentElement.outerHTML, ...[...document.querySelectorAll('input,textarea')].map(e => e.value), localStorage.getItem('rec-calories-v1') || '', location.href].some(text => text.includes(token)), TOKEN);
const status = page => page.evaluate(() => document.getElementById('ai-status-title').textContent);
const openCamera = async page => { await tap(page.locator('[data-view=today]')); await page.waitForTimeout(450); await tap(page.locator('#open-camera')); await page.locator('#camera12').waitFor({ state: 'visible' }); await page.waitForTimeout(300); };
const describe = async (page, words) => { await openCamera(page); await tap(page.locator('#camera12-describe')); await page.locator('#describe12').fill(words); await tap(page.locator('#describe12-go')); };
const toSettings = async page => { if (await page.locator('#settings').isVisible()) return; await page.evaluate(() => CHADUX.closeSheets()); await tap(page.locator('[data-view=today]')); await tap(page.locator('#open-settings')); await page.locator('#advanced-settings').scrollIntoViewIfNeeded(); };
// The card opens by itself when the answer is in (or shows why there is none).
async function estimateCard(page, label) {
  const started = Date.now();
  await page.waitForFunction(() => document.getElementById('nutrition12').open && ['ready', 'error'].includes(document.getElementById('nutrition12').dataset.state), null, { timeout: 110000 });
  if (await page.locator('#nutrition12').getAttribute('data-state') !== 'ready') throw Error(label + ': no estimate. The app said: ' + await page.locator('#nutrition12-body').innerText());
  await page.waitForTimeout(400);
  const values = await card(page);
  results[label] = { ...tidy(values), health: await page.locator('#health12').innerText(), about: await page.locator('#nutrition12 .ch-nut__meta').innerText().catch(() => ''), ingredients: await page.locator('#n12-parts .ch-ing').count(), seconds: Math.round((Date.now() - started) / 100) / 10 };
  return values;
}
// Servings on the real answer: half a serving, half of everything (within rounding); then back.
async function halve(page, values) {
  await tap(page.locator('#n12-less')); assert.equal(await page.locator('#n12-servings').innerText(), '0.5');
  const half = await card(page);
  for (const i of [1, 2, 3, 4]) assert.ok(Math.abs(Number(half[i]) - Number(values[i]) / 2) <= (i === 1 ? 1 : 0.1), `half ${['', 'kcal', 'protein', 'carbs', 'fat'][i]}: ${half[i]} vs ${values[i]}`);
  await tap(page.locator('#n12-more'));
  assert.deepEqual(await card(page), values, 'back to the original numbers');
  return half;
}
async function logAndUndo(page, values, source) {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1') || '{"entries":[]}').entries.length);
  await tap(page.locator('#n12-done')); await page.waitForFunction(() => !document.getElementById('nutrition12').open);
  await page.waitForFunction(n => JSON.parse(localStorage.getItem('rec-calories-v1')).entries.length === n + 1, before);
  const journal = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')));
  const entry = journal.entries.at(-1);
  assert.deepEqual([entry.name, entry.kcal, entry.protein, entry.carbs, entry.fat, entry.source], [values[0], Number(values[1]), Number(values[2]), Number(values[3]), Number(values[4]), source]);
  assert.match(entry.portion, / g$|serving/);
  assert.equal(JSON.stringify(journal).includes('data:image'), false, 'no photo in the journal');
  await page.locator('#undo-toast button').waitFor(); await page.waitForTimeout(400); await tap(page.locator('#undo-toast button'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')).entries.length), before, 'Undo removes it');
}

(async () => {
  assert.ok(TOKEN.length >= 32, 'a proxy token is on this machine');
  fs.mkdirSync(SHOTS, { recursive: true });
  const photo = process.env.CHAD_LIVE_PHOTO ? { name: path.basename(process.env.CHAD_LIVE_PHOTO), mimeType: 'image/jpeg', buffer: fs.readFileSync(process.env.CHAD_LIVE_PHOTO) } : null;
  let args = [];
  if (STUB) results.route = 'in-browser stand-in proxy (CHAD_LIVE_STUB=1): nothing real was called';
  else {
    const host = new URL(scan.DEFAULT_PROXY).hostname, resolver = new dns.promises.Resolver(); resolver.setServers(['1.1.1.1', '8.8.8.8']);
    const [publicIP] = await resolver.resolve4(host).catch(() => []);
    results.route = publicIP ? 'public Funnel address (as a phone on mobile data)' : 'system DNS';
    if (publicIP) args = [`--host-resolver-rules=MAP ${host} ${publicIP}`];
  }
  const browser = await launch(args);
  try {
    // 1. 393 × 852 @3x: the setup link (the way a phone gets connected), Settings, a described and a photo estimate.
    const big = await context(browser, { width: 393, height: 852 }, 'dark'), page = big.page;
    await page.goto(LINK); await page.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    assert.equal(await page.evaluate(() => location.hash), '', 'the link leaves the address bar at once');
    assert.equal(await page.evaluate(token => localStorage.getItem('chad.aiProxyToken') === token, TOKEN), true, 'the token is saved on the device');
    assert.equal(await page.evaluate(url => localStorage.getItem('chad.aiProxyUrl') === url, scan.DEFAULT_PROXY), true);
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    await tap(page.locator('#ai-test')); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    results.settings = { status: await status(page), detail: await page.locator('#ai-status-text').innerText(), checks: big.sent.filter(s => s.path === '/estimate' && s.method === 'POST').length };
    assert.equal(await shown(page), false, 'no token on screen after setup');
    // A described estimate: the camera's Describe it.
    await describe(page, '200 g grilled chicken breast with 150 g cooked white rice');
    let values = await estimateCard(page, 'text');
    results.text.half = tidy(await halve(page, values));
    await logAndUndo(page, values, 'text');
    // A photo estimate through the camera's file fallback: the Analysing… row and the card are the screenshots.
    await page.waitForTimeout(450); await openCamera(page);
    const picture = photo || { name: 'plate.png', mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d');
      x.fillStyle = '#8a5a35'; x.fillRect(0, 0, 1600, 1200); for (let i = 0; i < 1200; i += 40) { x.fillStyle = i % 80 ? '#7d5030' : '#93633d'; x.fillRect(0, i, 1600, 20); }
      x.fillStyle = '#f4f4f2'; x.beginPath(); x.ellipse(800, 600, 560, 470, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e6e6e2'; x.beginPath(); x.ellipse(800, 600, 430, 350, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#c98a3c'; for (const [cx, cy] of [[640, 470], [700, 560]]) { x.save(); x.translate(cx, cy); x.rotate(-0.2); x.fillRect(-150, -110, 300, 220); x.fillStyle = '#e8b465'; x.fillRect(-130, -92, 260, 184); x.restore(); x.fillStyle = '#c98a3c'; }
      for (const [cx, cy] of [[940, 560], [1030, 700]]) { x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy, 150, 120, 0.4, 0, Math.PI * 2); x.fill(); x.fillStyle = '#ffb000'; x.beginPath(); x.arc(cx + 10, cy - 5, 48, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(cx - 5, cy - 20, 14, 0, Math.PI * 2); x.fill(); }
      return c.toDataURL('image/png').split(',')[1];
    }), 'base64') };
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap(page.locator('#camera12-shutter'))]);
    await chooser.setFiles(picture);
    await page.waitForFunction(() => document.querySelector('#recent12 .ch-food.is-pending'));
    await page.evaluate(() => document.getElementById('recent12').scrollIntoView({ block: 'center' })); await page.waitForTimeout(600); await quiet(page);
    assert.equal(await shown(page), false);
    await page.screenshot({ path: path.join(SHOTS, 'v12-ai-analysing.png') });
    values = await estimateCard(page, 'photo');
    await page.waitForTimeout(400); await quiet(page);
    assert.equal(await shown(page), false);
    await page.screenshot({ path: path.join(SHOTS, 'v12-ai-card.png') });
    results.photo.image = photo ? 'local photo' : 'drawn plate'; results.photo.half = tidy(await halve(page, values));
    await logAndUndo(page, values, 'photo');
    // The backup carries no AI settings.
    await toSettings(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-backup').click()]);
    const backup = fs.readFileSync(await download.path(), 'utf8'); assert.equal(backup.includes(TOKEN) || backup.includes(new URL(scan.DEFAULT_PROXY).host), false, 'backup without token or proxy');
    // 2. Failure paths. A made-up token in a setup link: flagged at once, then a 401 on the card with AI settings.
    await page.goto(BASE + '#ai=' + encodeURIComponent(scan.DEFAULT_PROXY) + '&k=synthetic-wrong-token');
    await page.locator('#message').filter({ hasText: 'didn’t take that link’s token' }).waitFor({ timeout: 20000 });
    await describe(page, 'a banana');
    await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'error', null, { timeout: 30000 });
    results.wrongToken = (await page.locator('#nutrition12 .ch-nut__trouble strong').innerText()) + ' / ' + (await page.locator('#n12-setup').isVisible() ? 'AI settings button' : 'no settings button');
    await tap(page.locator('#n12-setup')); assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-link');
    await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Set up again', null, { timeout: 20000 });
    // An unreachable proxy (a name that never resolves): asks first, shows Offline, and the card says the photo AI is
    // offline, with Search food taking the words along.
    await page.goto(BASE + '#ai=' + encodeURIComponent('https://chad-proxy.invalid') + '&k=synthetic-token');
    await page.locator('#detail-sheet').waitFor({ state: 'visible' }); await tap(page.locator('#detail-sheet').getByRole('button', { name: 'Connect' }));
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Offline', null, { timeout: 20000 });
    await describe(page, 'a banana');
    await page.waitForFunction(() => document.getElementById('nutrition12').open && document.getElementById('nutrition12').dataset.state === 'error', null, { timeout: 30000 });
    results.unreachable = await page.locator('#nutrition12 .ch-nut__trouble strong').innerText();
    assert.match(results.unreachable, /Can’t reach your PC — check it’s on and Tailscale is on on this phone/);
    await tap(page.locator('#n12-search')); await page.locator('#builder-sheet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#builder-search').inputValue(), 'a banana', 'Search food takes the words');
    await page.keyboard.press('Escape');
    // Back to the real link, then Disconnect (with Undo).
    await page.goto(LINK); await page.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    await toSettings(page); await page.waitForFunction(() => document.getElementById('ai-status-title').textContent === 'Connected', null, { timeout: 20000 });
    await tap(page.locator('#ai-disconnect')); assert.equal(await page.evaluate(() => localStorage.getItem('chad.aiProxyToken')), null); assert.equal(await status(page), 'Not set up');
    await page.waitForTimeout(400); await tap(page.locator('#undo-toast button')); assert.equal(await page.evaluate(token => localStorage.getItem('chad.aiProxyToken') === token, TOKEN), true, 'Undo reconnects');
    assert.equal(await shown(page), false); assert.deepEqual(big.leaks, [], 'the token never travels in a URL');
    assert.ok(big.sent.filter(s => s.method === 'POST' && s.path === '/estimate').every(s => s.token !== 'none'), 'every estimate call carries a token header');
    results.requests393 = big.sent.reduce((n, s) => ({ ...n, [`${s.method} ${s.path} (${s.token} token)`]: (n[`${s.method} ${s.path} (${s.token} token)`] || 0) + 1 }), {});
    assert.deepEqual(big.errors, []);
    await big.ctx.close();

    // 3. 375 × 667: the link, one described estimate, the card within reach, log and Undo.
    const small = await context(browser, { width: 375, height: 667 }, 'light'), little = small.page;
    await little.goto(LINK); await little.locator('#undo-toast').filter({ hasText: 'AI connected' }).waitFor();
    await describe(little, 'a flat white with full cream milk and a banana');
    values = await estimateCard(little, 'text375');
    assert.equal(await little.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
    const foot = await little.locator('#nutrition12-foot').boundingBox(); assert.ok(foot.y + foot.height <= 667 + 1, 'Done within reach');
    await quiet(little); await little.screenshot({ path: path.join(root, '.qa', 'v12-ai-card-375.png') });
    await logAndUndo(little, values, 'text');
    assert.equal(await shown(little), false); assert.deepEqual(small.leaks, []); assert.deepEqual(small.errors, []);
    await small.ctx.close();
  } finally { await browser.close(); }

  // 4. Nothing of the token anywhere it could leak: the working tree (tracked and untracked, not ignored) and the shots.
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const dirty = files.filter(f => { try { return fs.readFileSync(path.join(root, f)).includes(TOKEN); } catch { return false; } });
  const shots = fs.readdirSync(SHOTS).filter(f => { try { return fs.readFileSync(path.join(SHOTS, f)).includes(TOKEN); } catch { return false; } });
  assert.deepEqual(dirty.filter(f => !(STUB && f === 'scripts/v12-ai-live-check.cjs')), [], 'no repository file holds the token'); assert.deepEqual(shots, [], 'no screenshot file holds the token');
  console.log('Live results (no token):\n' + JSON.stringify(results, null, 2));
  console.log(`PASS ${STUB ? 'STUB (the script, not the proxy)' : 'live'} v12 photo AI through ${STUB ? 'an in-browser stand-in' : 'the real proxy'}: setup link stored and wiped, Connected (health + token check), a described and a photo estimate (camera file fallback, Analysing… row, the card by itself), half a serving and back, Done and Undo, 375 × 667 described estimate, made-up token → 401 → AI settings, unreachable proxy → "Can’t reach your PC" → Search food with the words, Disconnect with Undo, backup and journal clean, token never in a URL, on screen, in ${files.length} repository files or the shots. Screenshots: ${path.join(SHOTS, 'v12-ai-analysing.png')}, v12-ai-card.png.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
