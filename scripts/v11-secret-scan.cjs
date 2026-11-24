// Secret and privacy scan of every file that is, or would be, committed (git ls-files: tracked plus untracked files
// that are not ignored). The repository is public. Fails on:
//   tokens and keys      64-hex tokens, sk- keys, JWTs, literal bearer tokens, an X-Chad-Token with a real-looking value
//   setup links          ...#ai=...&k=<token> or #k=<token> with a real-looking token (placeholders like <token> pass)
//   the proxy URL        the built-in proxy host anywhere but its one sanctioned place (DEFAULT_PROXY in scan9.js, since
//                        the v9b brief), any other tunnel host (*.ts.net, ngrok, tailscale) or tailnet IP (100.64/10), and
//                        any web host outside a short allowlist
//   a PIN or passcode    a PIN next to digits
//   body measurements    a body weight in kg or a body-fat figure (test fixtures are synthetic and say so on the line)
//   medications          medicine names, or a dose in mg, mcg or IU
//   photos               any image outside icons/, and any embedded image data longer than a tiny synthetic stub
//   private files        AI-PROXY.md, .env, auth.json, logs, job briefs and progress notes
//   email addresses      any, apart from noreply addresses and example domains
// node scripts/v11-secret-scan.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const scan = require('../scan9.js');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).filter(f => fs.existsSync(path.join(root, f)));
const problems = [];
const flag = (file, what, sample) => problems.push(`${file}: ${what}${sample ? ' (' + String(sample).slice(0, 60) + ')' : ''}`);

// Private files never tracked or staged.
for (const f of files) {
  if (/^AI-PROXY\.md$|(^|\/)\.env|(^|\/)auth\.json$|\.log$|\.err$|^(CLAUDE-)?JOB[^/]*\.md$|^V\d+-PROGRESS\.md$/i.test(f)) flag(f, 'a private file');
  if (/\.(png|jpe?g|webp|heic|heif|gif|bmp|tiff?)$/i.test(f) && !f.startsWith('icons/')) flag(f, 'an image outside icons/ (photos never ship)');
}
const builtIn = new URL(scan.DEFAULT_PROXY).hostname, SELF = 'scripts/v11-secret-scan.cjs';
// Reserved and placeholder names (RFC 2606/6761) and the docs' own placeholders are not real hosts.
const placeholder = host => /(^|\.)(example|invalid|test|localhost)$|(^|\.)example\.|your-name/.test(host);
const say = host => host === builtIn ? '<the built-in proxy host>' : host;            // never print the proxy host
const HOSTS = new Set(['world.openfoodfacts.org', 'au.openfoodfacts.org', 'search.openfoodfacts.org', 'openfoodfacts.org', 'api.openai.com', 'arjunsells.github.io', 'github.com', 'www.w3.org', 'www.chromium.org', 'developers.cloudflare.com', 'developer.mozilla.org', 'nandos.com.au', 'www.nandos.com.au', 'fonts.google.com', 'scripts.sil.org', 'openfontlicense.org', 'unpkg.com', 'www.npmjs.com', 'example.github.io', 'example.com', 'proxy.example', 'chad-proxy.example.workers.dev', 'x.workers.dev', 'evil.example', 'www.apache.org', 'opensource.org', 'zxing-js.github.io', 'github.com', 'raw.githubusercontent.com', 'json-schema.org']);
const MEDS = /\b(sertraline|fluoxetine|escitalopram|citalopram|lexapro|zoloft|prozac|venlafaxine|vyvanse|adderall|ritalin|concerta|dexamphetamine|lisdexamfetamine|methylphenidate|modafinil|metformin|ozempic|semaglutide|wegovy|mounjaro|tirzepatide|saxenda|liraglutide|phentermine|duromine|testosterone|finasteride|minoxidil|isotretinoin|roaccutane|accutane|melatonin|propranolol|sildenafil|tadalafil|insulin)\b/i;
for (const f of files) {
  const full = path.join(root, f), buffer = fs.readFileSync(full);
  if (buffer.includes(0)) continue;                                       // binary (icons, the font)
  const text = buffer.toString('utf8'), lines = text.split(/\r?\n/), vendor = f.startsWith('vendor/');
  lines.forEach((line, i) => {
    const at = f + ':' + (i + 1), synthetic = /synthetic|fixture|\bqa\b|example|placeholder|<token>/i.test(line);
    // tokens and keys
    if (/\b[a-f0-9]{64}\b/i.test(line) && !(f === 'vendor/README.md' && /SHA-256/.test(line))) flag(at, 'a 64-hex token');                 // the vendored file's checksum is not a secret
    if (/\bsk-[A-Za-z0-9_-]{20,}/.test(line)) flag(at, 'an API key');
    if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(line)) flag(at, 'a JWT');
    if (/Bearer (?!synthetic-)[A-Za-z0-9_\-.]{16,}/.test(line) && !vendor) flag(at, 'a literal bearer token', line.trim());
    { const m = /X-Chad-Token['"]?\s*[:=]\s*['"]([^'"<\s]{12,})['"]/i.exec(line); if (m && !/synthetic|wrong|qa|test/i.test(m[1])) flag(at, 'an X-Chad-Token value'); }
    // setup links with a token
    { const m = /[#&]k=([A-Za-z0-9_-]{12,})/.exec(line); if (m && !/synthetic|wrong|qa|test|token/i.test(m[1])) flag(at, 'a setup link with a token', m[0]); }
    // the proxy, tunnels, tailnet addresses
    if (line.includes(builtIn) && f !== 'scan9.js') flag(at, 'the built-in proxy address outside scan9.js');
    if (/\b[a-z0-9-]+\.[a-z0-9-]+\.ts\.net\b|\bngrok(-free)?\.(app|io)\b/i.test(f === 'scan9.js' ? line.split(builtIn).join('') : line)) flag(at, 'a tunnel host');
    if (/\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/.test(line)) flag(at, 'a tailnet IP address');
    if (!vendor) for (const m of line.matchAll(/https?:\/\/(?:[^@\/\s'"`]+@)?([a-z0-9.-]+)(?::\d+)?/gi)) { const host = m[1].toLowerCase(); if (host === '127.0.0.1' || host === 'localhost' || host === builtIn && f === 'scan9.js' || HOSTS.has(host) || placeholder(host)) continue; flag(at, 'a web host outside the allowlist', say(host)); }
    // a PIN or passcode
    if (/\b(PIN|passcode|pass code)\b\s*(is|:|=|-)?\s*['"]?\d{4,8}\b/i.test(line)) flag(at, 'a PIN');
    // body measurements
    if (f !== SELF && /\b(body ?weight|my weight|current weight|weighs|weighed|weigh-in|weight)\b[^\n]{0,40}?\b([3-9]\d|1\d\d|2\d\d)(\.\d)?\s*(kg)?\b/i.test(line) && /\b([3-9]\d|1\d\d|2\d\d)\.\d\b/.test(line) && !synthetic && !/min:|max:|min="|max="|placeholder/.test(line)) flag(at, 'a body weight (mark a test fixture synthetic on its line)', line.trim());
    if (f !== SELF && /body ?fat|\bbf ?%|\d+(\.\d+)? ?% ?(body ?)?fat\b/i.test(line)) flag(at, 'a body-fat figure', line.trim());
    // medications
    if (f !== SELF && MEDS.test(line) && !vendor) flag(at, 'a medication', MEDS.exec(line)[0]);
    if (f !== SELF && /\b\d+(\.\d+)?\s?(mg|mcg|µg|IU)\b/.test(line) && !vendor) flag(at, 'a dose', line.trim());
    // photos embedded as data
    { const m = /data:image\/(png|jpe?g|webp|heic|gif);base64,([A-Za-z0-9+/=]{200,})/.exec(line); if (m) flag(at, 'embedded image data'); }
    // email addresses
    for (const m of line.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) { if (/^noreply@|@users\.noreply\.github\.com$/i.test(m[0]) || placeholder(m[1].toLowerCase()) || vendor || f.startsWith('fonts/')) continue; flag(at, 'an email address'); }   // third-party licence texts keep their authors
  });
}
// The one sanctioned proxy address is written exactly once.
assert.equal(fs.readFileSync(path.join(root, 'scan9.js'), 'utf8').split(builtIn).length - 1, 1, 'the built-in proxy address appears once, in scan9.js');
// The ignore rules keep the private files out.
const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8') + '\n' + fs.readFileSync(path.join(root, '.git/info/exclude'), 'utf8');
for (const rule of ['AI-PROXY.md', '*.log', 'JOB*.md', 'CLAUDE-JOB*.md', '.env*', 'auth.json']) assert.ok(ignore.split(/\r?\n/).includes(rule), rule + ' is ignored');
assert.ok(/V1[01]-PROGRESS\.md|V\*-PROGRESS\.md/.test(ignore), 'the progress notes are ignored');
if (problems.length) { console.error('FAIL secret scan:\n  ' + problems.join('\n  ')); process.exitCode = 1; }
else console.log(`PASS secret scan of ${files.length} committed or committable files: no token, key, JWT or bearer token, no setup link with a token, the proxy address only once (scan9.js), no tunnel host or tailnet IP, no web host outside the allowlist, no PIN, no body weight or body fat, no medication or dose, no photo or embedded image, no private file, no email address; the private files are ignored.`);
