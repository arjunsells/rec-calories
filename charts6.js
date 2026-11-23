/* CHAD v6 — charts6.js · iOS-clean canvas charts + SVG Activity rings. No dependencies.
   Drop-in for v5 charts.js (same window.CHADCharts API), restyled: system font, rounded bars,
   smooth line, no glow. One addition: rings().
   window.CHADCharts:
     barsVsGoal(el, data, goal, opts)  data: [n | null | {label, value}]
                                       opts: {highlight:index, unit:'', goalLabel:'Goal', goals:[per-bar goal], color, overColor}
     line(el, data, opts)              data: [n | null | {label, value}]   opts: {goal:n, color:'--ch-blue', unit:''}
     heatmap(el, data, opts)           data: [0..1 | null] oldest first, 7 per column   opts: {color:'--ch-green', max:1, rows:7, today:index}
     ring(el, pct, opts)               pct 0..100+   opts: {color:'--ch-ring-move', label:'72%', sub:'kcal', width:px}
     rings(el, values, opts)   NEW     Activity rings (SVG). values: up to 3 numbers 0..1 (outer → inner:
                                       calories, protein, quests). opts: {labels:['Calories 72%', …]} for aria-label.
                                       Call again with new values to animate to them. Styled by .ch-rings in theme6.css.
     redraw()                          re-render canvases (auto on resize / theme change)
   `el` is a <canvas> or any block element (a canvas is created inside; give it a height,
   e.g. class="ch-chart"). Colours come from theme6.css variables read on `el`.
   Colour opts take a CSS variable name ('--ch-pink') or any CSS colour.
   Draw-in animation is skipped when prefers-reduced-motion is set or opts.animate === false. */
(function (root) {
  'use strict';
  var doc = root.document;
  var RM = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reg = [];
  var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif';
  var NUM = 'ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';

  function v(el, name, fb) {
    var s = getComputedStyle(el).getPropertyValue(name);
    return (s && s.trim()) || fb;
  }
  // resolve nested var()/color-mix() by letting the browser compute it
  function resolve(el, value, fb) {
    if (!value) return fb;
    if (!/var\(|color-mix\(/.test(value)) return value;
    var probe = doc.createElement('i');
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;color:' + value;
    el.appendChild(probe);
    var c = getComputedStyle(probe).color;
    el.removeChild(probe);
    return c || fb;
  }
  function tv(el, name, fb) { return resolve(el, v(el, name, ''), fb); }
  function col(el, c, fb) { return !c ? fb : (c.indexOf('--') === 0 ? tv(el, c, fb) : c); }
  function theme(el) {
    return {
      gold: tv(el, '--ch-gold', '#B0894C'), cyan: tv(el, '--ch-cyan', '#00C3E3'),
      magenta: tv(el, '--ch-magenta', '#FF2D55'), green: tv(el, '--ch-green', '#34C759'),
      blue: tv(el, '--ch-blue', '#007AFF'), move: tv(el, '--ch-ring-move', '#FA114F'),
      text: tv(el, '--ch-text', '#000'), muted: tv(el, '--ch-muted', '#6E6E73'),
      track: tv(el, '--ch-track', 'rgba(120,120,128,.16)'), line: tv(el, '--ch-line', 'rgba(60,60,67,.16)'),
      surface: tv(el, '--ch-surface', '#fff')
    };
  }
  function norm(data) {
    return (data || []).map(function (d) {
      if (d && typeof d === 'object') return { label: d.label, value: d.value == null ? null : +d.value };
      return { label: null, value: d == null ? null : +d };
    });
  }
  function fmt(n) { return n >= 10000 ? Math.round(n / 1000) + 'k' : (Math.round(n * 10) / 10).toLocaleString('en-US'); }

  function surface(el, fallbackH) {
    var c = el.tagName === 'CANVAS' ? el : el.querySelector('canvas.ch-canvas');
    if (!c) {
      c = doc.createElement('canvas');
      c.className = 'ch-canvas';
      c.style.cssText = 'display:block;width:100%;height:100%';
      el.appendChild(c);
    }
    if (c !== el && !el.clientHeight) el.style.height = fallbackH + 'px';
    var w = Math.max(1, Math.round(c.clientWidth || el.clientWidth || 300));
    var h = Math.max(1, Math.round(c.clientHeight || el.clientHeight || fallbackH));
    var dpr = Math.min(root.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  // register el -> painter(ctx,w,h,T,t); animate t 0..1 on first render
  function mount(el, fallbackH, opts, paint) {
    if (!el) return;
    el.__chRender = function (animated) {
      if (el.__chRaf) cancelAnimationFrame(el.__chRaf);
      var s = surface(el, fallbackH), T = theme(el);
      function frame(t) {
        s.ctx.clearRect(0, 0, s.w, s.h);
        s.ctx.save();
        paint(s.ctx, s.w, s.h, T, t);
        s.ctx.restore();
      }
      if (!animated || (opts && opts.animate === false) || (RM && RM.matches)) { frame(1); return; }
      var t0 = 0, dur = (opts && opts.duration) || 800;
      (function tick(now) {
        if (!t0) t0 = now || performance.now();
        var p = Math.min(1, ((now || t0) - t0) / dur);
        frame(1 - Math.pow(1 - p, 4));
        if (p < 1) el.__chRaf = requestAnimationFrame(tick);
      })(0);
    };
    if (reg.indexOf(el) < 0) reg.push(el);
    el.__chRender(true);
  }

  function label(ctx, txt, x, y, color, align, size, weight, family) {
    ctx.font = (weight || 500) + ' ' + (size || 11) + 'px ' + (family || FONT);
    ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(txt, x, y);
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function dashed(ctx, color) { ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.strokeStyle = color; }

  /* ---- bars vs goal ---- */
  function barsVsGoal(el, data, goal, opts) {
    opts = opts || {};
    var d = norm(data);
    mount(el, 170, opts, function (ctx, w, h, T, t) {
      var hasLabels = d.some(function (p) { return p.label; });
      var top = 20, bot = hasLabels ? 20 : 4, H = h - top - bot, n = d.length || 1;
      var goals = opts.goals || d.map(function () { return goal; });
      var max = Math.max.apply(null, d.map(function (p) { return p.value || 0; }).concat(goals, [goal || 0, 1])) * 1.1;
      var slot = w / n, bw = Math.max(2, Math.min(22, slot * 0.46)), r = Math.min(7, bw / 2);
      var over = col(el, opts.overColor, T.magenta), under = col(el, opts.color, T.cyan);
      var hi = opts.highlight;
      // baseline
      ctx.fillStyle = T.line; ctx.fillRect(0, top + H, w, 1);
      d.forEach(function (p, i) {
        var cx = slot * i + slot / 2, x = cx - bw / 2, base = top + H;
        if (p.label) label(ctx, p.label, cx, h - 4, hi === i ? T.text : T.muted, 'center', 11, hi === i ? 600 : 500);
        if (p.value == null) { ctx.fillStyle = T.track; rrect(ctx, x, base - 4, bw, 4, 2); ctx.fill(); return; }
        var bh = Math.max(3, p.value / max * H * t);
        var c = (goals[i] && p.value > goals[i]) ? over : under;
        if (hi === i) c = T.gold;
        ctx.fillStyle = c;
        ctx.save(); ctx.beginPath(); ctx.rect(x - 1, top - 4, bw + 2, H + 4); ctx.clip();
        rrect(ctx, x, base - bh, bw, bh + r, r); ctx.fill(); ctx.restore();
      });
      if (goal) {
        dashed(ctx, T.muted);
        ctx.beginPath();
        goals.forEach(function (g, i) {
          var y = Math.round(top + H - g / max * H) + 0.5;
          if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(slot * i, y);
          ctx.lineTo(slot * (i + 1), y);
        });
        ctx.stroke(); ctx.setLineDash([]);
        var gy = top + H - goals[goals.length - 1] / max * H;
        label(ctx, (opts.goalLabel || 'Goal') + ' ' + fmt(goal) + (opts.unit || ''), w, Math.max(11, gy - 6), T.muted, 'right', 11, 600);
      }
    });
  }

  /* ---- line (monotone smooth) ---- */
  function smooth(ctx, P) {
    var n = P.length;
    if (n < 3) { P.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); return; }
    var dx = [], m = [], s = [];
    for (var i = 0; i < n - 1; i++) { dx[i] = P[i + 1].x - P[i].x; s[i] = (P[i + 1].y - P[i].y) / (dx[i] || 1); }
    m[0] = s[0]; m[n - 1] = s[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / s[i], b = m[i + 1] / s[i], q = a * a + b * b;
      if (q > 9) { var k = 3 / Math.sqrt(q); m[i] = k * a * s[i]; m[i + 1] = k * b * s[i]; }
    }
    ctx.moveTo(P[0].x, P[0].y);
    for (i = 0; i < n - 1; i++) {
      ctx.bezierCurveTo(P[i].x + dx[i] / 3, P[i].y + m[i] * dx[i] / 3, P[i + 1].x - dx[i] / 3, P[i + 1].y - m[i + 1] * dx[i] / 3, P[i + 1].x, P[i + 1].y);
    }
  }
  function line(el, data, opts) {
    opts = opts || {};
    var d = norm(data);
    mount(el, 170, opts, function (ctx, w, h, T, t) {
      var pts = [], vals = [];
      d.forEach(function (p, i) { if (p.value != null) { pts.push({ i: i, v: p.value }); vals.push(p.value); } });
      if (!pts.length) return;
      if (opts.goal != null) vals.push(opts.goal);
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = (hi - lo) * 0.18 || 1; lo -= pad; hi += pad;
      var hasLabels = d.some(function (p) { return p.label; });
      var L = 4, R = 10, top = 26, bot = hasLabels ? 20 : 8, W = w - L - R, H = h - top - bot, n = Math.max(1, d.length - 1);
      var c = col(el, opts.color, T.blue);
      function X(i) { return L + (d.length > 1 ? i / n * W : W / 2); }
      function Y(val) { return top + H - (val - lo) / (hi - lo) * H; }
      ctx.fillStyle = T.line;
      for (var g = 0; g <= 3; g++) ctx.fillRect(L, Math.round(top + H * g / 3), W, 1);
      if (opts.goal != null) {
        var gy = Math.round(Y(opts.goal)) + 0.5;
        dashed(ctx, T.muted);
        ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(L + W, gy); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, 'Goal ' + fmt(opts.goal) + (opts.unit || ''), L + 2, gy - 6, T.muted, 'left', 11, 600);
      }
      var P = pts.map(function (p) { return { x: X(p.i), y: Y(p.v) }; });
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, L + W * t + (t >= 1 ? R : 0), h); ctx.clip();
      var grad = ctx.createLinearGradient(0, top, 0, top + H);
      grad.addColorStop(0, c); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.2; ctx.fillStyle = grad;
      ctx.beginPath(); smooth(ctx, P);
      ctx.lineTo(P[P.length - 1].x, top + H); ctx.lineTo(P[0].x, top + H); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = c;
      ctx.beginPath(); smooth(ctx, P); ctx.stroke();
      ctx.restore();
      var last = P[P.length - 1], lv = pts[pts.length - 1].v;
      if (t >= 1) {
        ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2); ctx.fill();
        label(ctx, fmt(lv) + (opts.unit ? ' ' + opts.unit : ''), w - 2, 14, T.text, 'right', 15, 600, NUM);
      }
      if (hasLabels) {
        var step = Math.ceil(d.length / 7);
        d.forEach(function (p, i) { if (p.label && i % step === 0) label(ctx, p.label, Math.max(L + 10, Math.min(w - R - 6, X(i))), h - 4, T.muted, 'center', 11); });
      }
    });
  }

  /* ---- heatmap ---- */
  function heatmap(el, data, opts) {
    opts = opts || {};
    var d = norm(data), rows = opts.rows || 7;
    mount(el, rows * 14 + (rows - 1) * 3, opts, function (ctx, w, h, T, t) {
      var cols = Math.ceil(d.length / rows) || 1, gap = 3;
      var cell = Math.floor(Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows, 22));
      cell = Math.max(3, cell);
      var max = opts.max || Math.max.apply(null, d.map(function (p) { return p.value || 0; }).concat([1e-9]));
      if (!opts.max && max <= 4 && max > 1) max = 4;
      var c = col(el, opts.color, T.green), shown = Math.ceil(d.length * t), r = Math.min(5, cell * 0.28);
      d.forEach(function (p, i) {
        var x = Math.floor(i / rows) * (cell + gap), y = (i % rows) * (cell + gap);
        ctx.globalAlpha = 1; ctx.fillStyle = T.track; rrect(ctx, x, y, cell, cell, r); ctx.fill();
        if (i >= shown || !p.value) return;
        ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, p.value / max); ctx.fillStyle = c;
        rrect(ctx, x, y, cell, cell, r); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (opts.today != null && d[opts.today]) {
        var tx = Math.floor(opts.today / rows) * (cell + gap), ty = (opts.today % rows) * (cell + gap);
        ctx.strokeStyle = T.text; ctx.lineWidth = 1.5; rrect(ctx, tx - 1.75, ty - 1.75, cell + 3.5, cell + 3.5, r + 1.5); ctx.stroke();
      }
    });
  }

  /* ---- single ring (canvas) ---- */
  function ring(el, pct, opts) {
    opts = opts || {};
    pct = +pct || 0;
    mount(el, 120, opts, function (ctx, w, h, T, t) {
      var size = Math.min(w, h), lw = opts.width || Math.max(8, Math.round(size * 0.11));
      var cx = w / 2, cy = h / 2, r = size / 2 - lw / 2 - 1;
      var c = pct > 100 && opts.overColor ? col(el, opts.overColor, T.magenta) : col(el, opts.color, T.move);
      var a0 = -Math.PI / 2, frac = Math.min(1, Math.max(0, pct / 100)) * t;
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.2; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI * 2 * Math.max(frac, 0.0001)); ctx.stroke();
      var txt = opts.label != null ? String(opts.label) : Math.round(pct * t) + '%';
      var fs = Math.max(13, Math.round(size * 0.2));
      label(ctx, txt, cx, cy + (opts.sub ? fs * 0.18 : fs * 0.35), T.text, 'center', fs, 600, NUM);
      if (opts.sub) label(ctx, String(opts.sub), cx, cy + fs * 0.18 + 15, T.muted, 'center', 11, 500);
    });
  }

  /* ---- Activity rings (SVG, animated by CSS in theme6.css) ---- */
  function rings(el, values, opts) {
    if (!el) return;
    opts = opts || {};
    values = (values || []).slice(0, 3);
    if (!el.querySelector('svg')) {
      var R = [88, 66, 44], s = '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">';
      for (var i = 0; i < Math.max(1, values.length); i++) {
        s += '<g class="ch-rings__ring ch-rings__ring--' + (i + 1) + '">' +
          '<circle class="ch-rings__track" cx="100" cy="100" r="' + R[i] + '"/>' +
          '<circle class="ch-rings__arc" cx="100" cy="100" r="' + R[i] + '" pathLength="100"/></g>';
      }
      el.classList.add('ch-rings');
      el.innerHTML = s + '</svg>';
      el.getBoundingClientRect(); // commit the 0 state so the first set animates
    }
    el.setAttribute('role', 'img');
    if (opts.labels) el.setAttribute('aria-label', opts.labels.join(', '));
    var apply = function () {
      values.forEach(function (val, i) { el.style.setProperty('--p' + (i + 1), String(Math.max(0, Math.min(1, +val || 0)))); });
    };
    if (opts.animate === false || (RM && RM.matches) || !root.requestAnimationFrame) apply();
    else root.requestAnimationFrame(apply);
  }

  function redraw(animated) {
    reg = reg.filter(function (el) { return el.isConnected !== false && el.__chRender; });
    reg.forEach(function (el) { el.__chRender(!!animated); });
  }

  if (doc) {
    var timer;
    root.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(redraw, 120); });
    if (root.MutationObserver) new MutationObserver(function () { redraw(); })
      .observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var on = function () { redraw(); };
      mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener && mq.addListener(on);
    }
  }

  root.CHADCharts = { barsVsGoal: barsVsGoal, line: line, heatmap: heatmap, ring: ring, rings: rings, redraw: redraw };
})(window);
