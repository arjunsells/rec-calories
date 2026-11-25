// Shared plumbing for the browser suites: a static server, headless Edge/Chrome and an iPhone-like context.
// Playwright lives outside the repository:  npm install --prefix "$env:TEMP/chad-browser-qa" playwright
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.tmpdir(), 'chad-browser-qa/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.md': 'text/markdown', '.txt': 'text/plain' };
// serve(port, { dir, handler }): handler(pathname, res) may answer a request itself by returning true.
function serve(port, options = {}) {
  const dir = options.dir || root;
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (options.handler && options.handler(pathname, res)) return;
    const file = path.join(dir, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(error ? 'missing' : data); });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
const launch = (args = []) => chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args });
const IPHONE = { deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
// Collects uncaught errors and console errors; `ignore` filters expected network noise.
function watch(page, ignore = () => false) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !ignore(m.text())) errors.push(m.text()); });
  return errors;
}
// Minimal PNG reader (8-bit RGB / RGBA, non-interlaced: what screenshots and the icons are) for pixel assertions.
function decodePNG(buffer) {
  const zlib = require('node:zlib');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20), depth = buffer[24], type = buffer[25], channels = { 2: 3, 6: 4 }[type];
  if (depth !== 8 || !channels || buffer[28] !== 0) throw Error('unsupported PNG: depth ' + depth + ', colour type ' + type);
  const chunks = [];
  for (let at = 8; at < buffer.length;) { const size = buffer.readUInt32BE(at), name = buffer.toString('latin1', at + 4, at + 8); if (name === 'IDAT') chunks.push(buffer.subarray(at + 8, at + 8 + size)); at += size + 12; }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * channels, data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = data.subarray(y * stride, (y + 1) * stride), up = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0, b = up ? up[x] : 0, c = up && x >= channels ? up[x - channels] : 0;
      const p = a + b - c, paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      out[x] = (line[x] + [0, a, b, (a + b) >> 1, paeth][filter]) & 255;
    }
  }
  return { width, height, channels, data, at: (x, y) => { const i = (Math.round(y) * width + Math.round(x)) * channels; return [data[i], data[i + 1], data[i + 2], channels === 4 ? data[i + 3] : 255]; } };
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v1')));
const shellFiles = () => [...fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/^const SHELL = (.+);$/m)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
module.exports = { root, serve, launch, watch, saved, shellFiles, decodePNG, IPHONE, MIME, NOON: '2026-11-24T12:00:00+09:30', CACHE: 'rec-calories-shell-v12f', V8: '7ddd9ab', V9: '472da71', V10: '47c498e', V11: '566cc4e' };
