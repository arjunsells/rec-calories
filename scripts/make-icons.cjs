// CHAD app icon: a polished gold ring that laps itself (a closed Activity ring) around a pixel flame, on navy.
// Drawn on a canvas in headless Edge/Chrome and written as OPAQUE PNGs (no alpha channel, full-bleed):
//   icons/apple-touch-icon.png 180   icons/icon-192.png 192   icons/icon-512.png 512   icons/icon-maskable-512.png 512
//   icons/icon.svg (small vector favicon)
// The artwork is redrawn for every size so the flame always lands on whole device pixels.
// Usage: node scripts/make-icons.cjs [--preview <dir>]     (Playwright as for the browser suites; nothing else)
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { launch, root } = require('./harness.cjs');

const FLAME = [                 // 12 x 16, '.' = empty: r red, o orange, y yellow, w white-hot
  '......r.....', '......rr....', '.....rrr....', '.....rrrr...', '....rrrrr...', '....rrrrrr..', '.r.rrrorrr..', '.rrrrroorrr.',
  'rrrrrooorrr.', 'rrrroooorrrr', 'rrrrooyooorr', 'rrroooyyoorr', 'rrrooyyyyorr', 'rrrooywwyorr', '.rrrooyyorr.', '..rrrrrrrr..'];
const FIRE = { r: ['#FF5630', '#F0242B'], o: ['#FFA126', '#FF7A18'], y: ['#FFDD63', '#FFC02E'], w: ['#FFFDF0', '#FFF2C6'] };
const GOLD = [[0, '#EBC97C'], [0.07, '#C89845'], [0.2, '#9C7024'], [0.31, '#D2A553'], [0.41, '#FBE3A2'], [0.5, '#C4933F'], [0.62, '#86601C'], [0.74, '#C99A47'], [0.86, '#FFF0BE'], [0.94, '#F2D48C'], [1, '#EBC97C']];

// Runs in the page. S = output size in px; maskable keeps the art inside the central safe zone.
function draw(S, maskable, FLAME, FIRE, GOLD) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d'), k = (maskable ? 0.84 : 1) * S / 1024, cx = S / 2, cy = S / 2, U = v => v * k, TAU = Math.PI * 2, TOP = -Math.PI / 2;
  const fill = gradient => { ctx.fillStyle = gradient; ctx.fillRect(0, 0, S, S); };
  // navy field: lit from the top left, falling off to near black
  let g = ctx.createLinearGradient(S * 0.22, 0, S * 0.78, S);
  g.addColorStop(0, '#234682'); g.addColorStop(0.38, '#14284B'); g.addColorStop(0.78, '#0A1326'); g.addColorStop(1, '#060A14'); fill(g);
  g = ctx.createRadialGradient(cx, -S * 0.12, 0, cx, -S * 0.12, S); g.addColorStop(0, 'rgba(160,188,245,.30)'); g.addColorStop(0.5, 'rgba(94,130,201,.07)'); g.addColorStop(1, 'rgba(20,40,75,0)'); fill(g);
  g = ctx.createRadialGradient(cx, cy * 0.86, S * 0.42, cx, cy * 0.86, S * 0.86); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); fill(g);
  g = ctx.createRadialGradient(cx, cy + U(34), 0, cx, cy + U(34), U(318)); g.addColorStop(0, 'rgba(255,128,36,.40)'); g.addColorStop(0.46, 'rgba(204,120,44,.14)'); g.addColorStop(1, 'rgba(10,19,38,0)'); fill(g);

  // the ring
  const R = U(342), W = U(104), lap = TOP + TAU * 0.082;                    // the head rides 30 degrees past the top
  const arc = (r, a0, a1, width, style, cap) => { ctx.lineWidth = width; ctx.strokeStyle = style; ctx.lineCap = cap || 'butt'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); };
  const band = () => { ctx.beginPath(); ctx.arc(cx, cy, R + W / 2, 0, TAU); ctx.arc(cx, cy, R - W / 2, 0, TAU, true); ctx.clip('evenodd'); };
  const gold = ctx.createConicGradient(TOP, cx, cy); GOLD.forEach(([at, colour]) => gold.addColorStop(at, colour));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = U(44); ctx.shadowOffsetY = U(20); arc(R, 0, TAU, W, gold); ctx.restore();
  ctx.save(); band();
  ctx.filter = `blur(${U(9)}px)`;                                           // a tube, not a flat band
  arc(R + W / 2, 0, TAU, U(26), 'rgba(42,22,0,.42)'); arc(R - W / 2, 0, TAU, U(24), 'rgba(42,22,0,.36)');
  arc(R + W * 0.08, 0, TAU, W * 0.3, 'rgba(255,248,224,.16)');
  arc(R - W / 2, Math.PI * 0.1, Math.PI * 0.9, U(26), 'rgba(255,122,31,.50)');                // firelight on the inner edge
  ctx.filter = `blur(${U(4)}px)`;
  arc(R + W * 0.14, Math.PI * 1.08, Math.PI * 1.42, W * 0.13, 'rgba(255,253,242,.62)', 'round');   // specular, upper left
  arc(R + W * 0.14, Math.PI * 0.16, Math.PI * 0.3, W * 0.1, 'rgba(255,253,242,.24)', 'round');
  ctx.filter = 'none'; ctx.restore();
  // the lap: the last 30 degrees ride on top of the start and throw a soft shadow forward
  const hx = cx + Math.cos(lap) * R, hy = cy + Math.sin(lap) * R;
  ctx.save(); band(); ctx.filter = `blur(${U(16)}px)`; ctx.fillStyle = 'rgba(22,11,0,.62)';
  ctx.beginPath(); ctx.arc(cx + Math.cos(lap + 0.1) * R, cy + Math.sin(lap + 0.1) * R, W * 0.5, 0, TAU); ctx.fill(); ctx.restore();
  // The head is drawn on its own layer so it gets the same tube shading as the ring, clipped to its own shape.
  const layer = document.createElement('canvas'); layer.width = layer.height = S;
  const t = layer.getContext('2d'), lit = t.createConicGradient(TOP, cx, cy);
  lit.addColorStop(0, GOLD[0][1]); lit.addColorStop(0.082, '#FFEDB4'); lit.addColorStop(0.3, '#FFEDB4'); lit.addColorStop(1, GOLD[0][1]);     // starts as the ring's own colour: no seam
  t.lineWidth = W; t.strokeStyle = lit; t.beginPath(); t.arc(cx, cy, R, TOP, lap); t.stroke();
  t.fillStyle = '#FFEDB4'; t.beginPath(); t.arc(hx, hy, W / 2, 0, TAU); t.fill();
  t.globalCompositeOperation = 'source-atop';
  const shade = (r, width, style, a0 = TOP - 0.4, a1 = lap + 0.6) => { t.lineWidth = width; t.strokeStyle = style; t.beginPath(); t.arc(cx, cy, r, a0, a1); t.stroke(); };
  t.filter = `blur(${U(9)}px)`; shade(R + W / 2, U(26), 'rgba(42,22,0,.42)'); shade(R - W / 2, U(24), 'rgba(42,22,0,.36)'); shade(R + W * 0.08, W * 0.3, 'rgba(255,250,232,.22)');
  t.filter = `blur(${U(11)}px)`; t.strokeStyle = 'rgba(60,34,0,.34)'; t.lineWidth = U(14); t.beginPath(); t.arc(hx, hy, W / 2, lap - 0.9, lap + 1.9); t.stroke();   // the cap rounds away
  t.filter = 'none';
  ctx.drawImage(layer, 0, 0);

  // the flame: whole device pixels, a soft glow behind, a faint drop below
  const cell = Math.max(1, Math.round(S * (maskable ? 0.84 : 1) * 0.0285)), cols = FLAME[0].length, rows = FLAME.length;
  const x0 = Math.round(cx - cols * cell / 2), y0 = Math.round(cy - U(4) - rows * cell / 2);
  const cells = (paint, dx = 0, dy = 0) => FLAME.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { ctx.fillStyle = paint(ch, y); ctx.fillRect(x0 + x * cell + dx, y0 + y * cell + dy, cell, cell); } }));
  ctx.save(); ctx.filter = `blur(${U(40)}px)`; ctx.globalAlpha = 0.72; cells(() => '#FF5A1F'); ctx.restore();
  ctx.save(); ctx.filter = `blur(${U(8)}px)`; ctx.globalAlpha = 0.36; cells(() => '#000', 0, U(9)); ctx.restore();
  const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
  cells((ch, y) => mix(FIRE[ch][0], FIRE[ch][1], y / (rows - 1)));
  return Array.from(ctx.getImageData(0, 0, S, S).data);
}

/* ---- PNG writers (no dependencies) ---- */
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), out = Buffer.alloc(body.length + 8); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(zlib.crc32(body) >>> 0, body.length + 4); return out; };
const header = (size, type) => { const b = Buffer.alloc(13); b.writeUInt32BE(size, 0); b.writeUInt32BE(size, 4); b[8] = 8; b[9] = type; return chunk('IHDR', b); };
const png = (size, type, parts) => Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), header(size, type), ...parts, chunk('IEND', Buffer.alloc(0))]);
// 8-bit RGB, each row filtered with whichever of the five PNG filters gives the smallest residual.
function truecolour(size, rgba) {
  const stride = size * 3, rows = [], prev = Buffer.alloc(stride), line = Buffer.alloc(stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) line[x * 3 + c] = rgba[(y * size + x) * 4 + c];
    let best = null, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = Buffer.alloc(stride + 1); out[0] = f; let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? line[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0, p = a + b - c;
        const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
        const v = (line[i] - [0, a, b, (a + b) >> 1, paeth][f]) & 255; out[i + 1] = v; score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; best = out; }
    }
    rows.push(best); line.copy(prev);
  }
  return png(size, 2, [chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 }))]);
}
// 256-colour palette (median cut) with Floyd-Steinberg dithering: about a third of the bytes at 512px.
function palette(size, rgba) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) { const key = (rgba[i] >> 2) << 12 | (rgba[i + 1] >> 2) << 6 | rgba[i + 2] >> 2; counts.set(key, (counts.get(key) || 0) + 1); }
  let boxes = [[...counts].map(([key, n]) => [(key >> 12 & 63) * 4 + 2, (key >> 6 & 63) * 4 + 2, (key & 63) * 4 + 2, n])];
  const span = box => { let best = 0, axis = 0; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; } if (hi - lo > best) { best = hi - lo; axis = c; } } return [best, axis]; };
  while (boxes.length < 256) {
    let pick = -1, most = 0, axis = 0;
    boxes.forEach((box, i) => { if (box.length < 2) return; const [range, a] = span(box), weight = range * Math.sqrt(box.reduce((s, p) => s + p[3], 0)); if (weight > most) { most = weight; pick = i; axis = a; } });
    if (pick < 0) break;
    const box = boxes[pick].sort((a, b) => a[axis] - b[axis]), total = box.reduce((s, p) => s + p[3], 0);
    let acc = 0, cut = 1; for (let i = 0; i < box.length - 1; i++) { acc += box[i][3]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }
  const colours = boxes.map(box => { const n = box.reduce((s, p) => s + p[3], 0); return [0, 1, 2].map(c => Math.round(box.reduce((s, p) => s + p[c] * p[3], 0) / n)); });
  const cache = new Map(), nearest = (r, g, b) => { const key = (r >> 1) << 14 | (g >> 1) << 7 | b >> 1; let hit = cache.get(key); if (hit === undefined) { let best = Infinity; for (let i = 0; i < colours.length; i++) { const d = (colours[i][0] - r) ** 2 + (colours[i][1] - g) ** 2 + (colours[i][2] - b) ** 2; if (d < best) { best = d; hit = i; } } cache.set(key, hit); } return hit; };
  const work = Float32Array.from({ length: size * size * 3 }, (_, i) => rgba[(i / 3 | 0) * 4 + i % 3]), raw = Buffer.alloc(size * (size + 1));
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3, r = clamp(work[i]), g = clamp(work[i + 1]), b = clamp(work[i + 2]), index = nearest(r, g, b);
    raw[y * (size + 1) + 1 + x] = index;
    for (let c = 0; c < 3; c++) {
      const error = [r, g, b][c] - colours[index][c];
      if (x + 1 < size) work[i + 3 + c] += error * 7 / 16;
      if (y + 1 < size) { if (x) work[i + size * 3 - 3 + c] += error * 3 / 16; work[i + size * 3 + c] += error * 5 / 16; if (x + 1 < size) work[i + size * 3 + 3 + c] += error / 16; }
    }
  }
  return png(size, 3, [chunk('PLTE', Buffer.from(colours.flat())), chunk('IDAT', zlib.deflateSync(raw, { level: 9 }))]);
}
// Small vector twin for the browser tab: same ring and flame, flat shading.
function svg() {
  const cell = 28, x0 = 512 - 6 * cell, y0 = 508 - 8 * cell, rects = { r: '', o: '', y: '', w: '' };
  FLAME.forEach((row, y) => { for (let x = 0; x < row.length;) { const ch = row[x]; let end = x; while (end < row.length && row[end] === ch) end++; if (ch !== '.') rects[ch] += `M${x0 + x * cell} ${y0 + y * cell}h${(end - x) * cell}v${cell}h${-(end - x) * cell}z`; x = end; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><title>CHAD</title><defs><linearGradient id="b" x1=".22" y1="0" x2=".78" y2="1"><stop offset="0" stop-color="#234682"/><stop offset=".38" stop-color="#14284B"/><stop offset=".78" stop-color="#0A1326"/><stop offset="1" stop-color="#060A14"/></linearGradient><linearGradient id="g" x1=".15" y1=".1" x2=".85" y2=".9"><stop offset="0" stop-color="#FFF0BE"/><stop offset=".3" stop-color="#EBC97C"/><stop offset=".62" stop-color="#B98A3A"/><stop offset="1" stop-color="#E2BC6C"/></linearGradient><radialGradient id="w" cx=".5" cy=".53" r=".31"><stop offset="0" stop-color="#FF8024" stop-opacity=".4"/><stop offset="1" stop-color="#0A1326" stop-opacity="0"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#b)"/><rect width="1024" height="1024" fill="url(#w)"/><circle cx="512" cy="512" r="342" fill="none" stroke="url(#g)" stroke-width="104"/>` +
    Object.entries(rects).map(([ch, d]) => `<path d="${d}" fill="${FIRE[ch][0]}"/>`).join('') + '</svg>\n';
}

(async () => {
  const out = path.join(root, 'icons'), browser = await launch();
  try {
    const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
    await page.goto('about:blank');
    for (const [file, size, maskable, writer] of [['apple-touch-icon.png', 180, false, truecolour], ['icon-192.png', 192, false, truecolour], ['icon-512.png', 512, false, palette], ['icon-maskable-512.png', 512, true, palette]]) {
      const rgba = await page.evaluate(([source, ...args]) => new Function('return (' + source + ')')()(...args), [draw.toString(), size, maskable, FLAME, FIRE, GOLD]);
      assert(rgba.length === size * size * 4, 'unexpected pixel count');
      for (let i = 3; i < rgba.length; i += 4) assert(rgba[i] === 255, file + ' must be fully opaque');
      const data = writer(size, rgba);
      fs.writeFileSync(path.join(out, file), data);
      console.log(`${file}  ${size}x${size}  ${writer === palette ? '256-colour' : 'RGB'}  opaque  ${data.length} bytes`);
    }
    fs.writeFileSync(path.join(out, 'icon.svg'), svg());
    console.log(`icon.svg  ${fs.statSync(path.join(out, 'icon.svg')).size} bytes`);
    const preview = process.argv.indexOf('--preview');
    if (preview > 0) {                                      // 1024px master for review, outside the repository
      const dir = process.argv[preview + 1]; fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'v8-icon.png'), truecolour(1024, await page.evaluate(([source, ...args]) => new Function('return (' + source + ')')()(...args), [draw.toString(), 1024, false, FLAME, FIRE, GOLD])));
      console.log('preview: ' + path.join(dir, 'v8-icon.png'));
    }
  } finally { await browser.close(); }
  function assert(ok, message) { if (!ok) throw Error(message); }
})().catch(e => { console.error(e); process.exitCode = 1; });
