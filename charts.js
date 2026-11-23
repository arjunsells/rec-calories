/* CHAD v5 — charts.js · tiny neon canvas charts. No dependencies.
   window.CHADCharts:
     barsVsGoal(el, data, goal, opts)  data: [n | null | {label, value}]   opts: {highlight:index, unit:'', goalLabel:'GOAL'}
     line(el, data, opts)              data: [n | null | {label, value}]   opts: {goal:n, color:'--ch-cyan', unit:''}
     heatmap(el, data, opts)           data: [0..1 | null] oldest first, 7 per column   opts: {color:'--ch-green', max:1, rows:7}
     ring(el, pct, opts)               pct 0..100+   opts: {color:'--ch-cyan', label:'72%', sub:'KCAL', width:px}
     redraw()                          re-render everything (auto on resize / theme change / font load)
   `el` is a <canvas> or any block element (a canvas is created inside; give it a height,
   e.g. class="ch-chart"). Colours come from theme.css variables on `el`; `--ch-glow`
   drives the neon blur (0 in light theme). Colour opts take a CSS variable name or any CSS colour.
   Draw-in animation is skipped when prefers-reduced-motion is set or opts.animate === false. */
(function (root) {
  'use strict';
  var doc = root.document;
  var RM = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reg = [];
  var PX = '"Press Start 2P",ui-monospace,monospace';

  function v(el, name, fb) {
    var s = getComputedStyle(el).getPropertyValue(name);
    return (s && s.trim()) || fb;
  }
  function col(el, c, fb) { return !c ? fb : (c.indexOf('--') === 0 ? v(el, c, fb) : c); }
  function theme(el) {
    return {
      gold: v(el, '--ch-gold', '#f3c466'), cyan: v(el, '--ch-cyan', '#35e9ff'),
      magenta: v(el, '--ch-magenta', '#ff3dcb'), green: v(el, '--ch-green', '#39ff9a'),
      red: v(el, '--ch-red', '#ff4f6e'), text: v(el, '--ch-text', '#e9eeff'),
      muted: v(el, '--ch-muted', '#8f9ac6'), track: v(el, '--ch-track', 'rgba(255,255,255,.09)'),
      ink: v(el, '--ch-ink', '#04050c'), surface: v(el, '--ch-surface', '#0f1632'),
      glow: parseFloat(v(el, '--ch-glow', '0')) || 0
    };
  }
  function norm(data) {
    return (data || []).map(function (d) {
      if (d && typeof d === 'object') return { label: d.label, value: d.value == null ? null : +d.value };
      return { label: null, value: d == null ? null : +d };
    });
  }
  function fmt(n) { return n >= 10000 ? Math.round(n / 1000) + 'k' : String(Math.round(n * 10) / 10); }

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
      var t0 = 0, dur = (opts && opts.duration) || 700;
      (function tick(now) {
        if (!t0) t0 = now || performance.now();
        var p = Math.min(1, ((now || t0) - t0) / dur);
        frame(1 - Math.pow(1 - p, 3));
        if (p < 1) el.__chRaf = requestAnimationFrame(tick);
      })(0);
    };
    if (reg.indexOf(el) < 0) reg.push(el);
    el.__chRender(true);
  }

  function glow(ctx, T, color, k) { ctx.shadowColor = color; ctx.shadowBlur = T.glow * (k || 1); }
  function noGlow(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
  function label(ctx, txt, x, y, color, align, size) {
    ctx.font = (size || 8) + 'px ' + PX;
    ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(txt, x, y);
  }

  /* ---- bars vs goal ---- */
  function barsVsGoal(el, data, goal, opts) {
    opts = opts || {};
    var d = norm(data);
    mount(el, 160, opts, function (ctx, w, h, T, t) {
      var hasLabels = d.some(function (p) { return p.label; });
      var top = 18, bot = hasLabels ? 18 : 4, H = h - top - bot, n = d.length || 1;
      // Optional daily goals preserve phase changes and weekday hydration targets.
      var goals = opts.goals || d.map(function () { return goal; });
      var max = Math.max.apply(null, d.map(function (p) { return p.value || 0; }).concat(goals, [goal || 0, 1])) * 1.12;
      var gap = Math.max(3, Math.min(10, w / n * 0.28));
      var bw = Math.max(2, (w - gap * (n - 1)) / n);
      var over = col(el, opts.overColor, T.magenta), under = col(el, opts.color, T.cyan);
      d.forEach(function (p, i) {
        var x = Math.round(i * (bw + gap)), base = top + H;
        ctx.fillStyle = T.track; noGlow(ctx);
        ctx.fillRect(x, top, Math.round(bw), H);
        if (p.value == null) return;
        var bh = Math.max(2, Math.round(p.value / max * H * t));
        var c = (goals[i] && p.value > goals[i]) ? over : under;
        if (opts.highlight === i) c = T.gold;
        glow(ctx, T, c); ctx.fillStyle = c;
        ctx.fillRect(x, base - bh, Math.round(bw), bh);
        noGlow(ctx);
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillRect(x, base - bh, Math.max(2, Math.round(bw * 0.22)), bh);
        if (!T.glow) { ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, base - bh + 1, Math.round(bw) - 2, Math.max(1, bh - 2)); }
        if (p.label) label(ctx, p.label, x + bw / 2, h - 3, opts.highlight === i ? T.gold : T.muted);
      });
      if (goal) {
        var gy = Math.round(top + H - goal / max * H) + 0.5;
        ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = T.gold; glow(ctx, T, T.gold, 0.8);
        ctx.beginPath();
        goals.forEach(function (g, i) {
          var y = Math.round(top + H - g / max * H) + 0.5, x = i * (bw + gap);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          ctx.lineTo(Math.min(w, x + bw + gap), y);
        });
        ctx.stroke();
        ctx.setLineDash([]); noGlow(ctx);
        label(ctx, (opts.goalLabel || 'GOAL') + ' ' + fmt(goal) + (opts.unit || ''), w, Math.max(9, gy - 5), T.gold, 'right');
      }
    });
  }

  /* ---- line ---- */
  function line(el, data, opts) {
    opts = opts || {};
    var d = norm(data);
    mount(el, 160, opts, function (ctx, w, h, T, t) {
      var pts = [], vals = [];
      d.forEach(function (p, i) { if (p.value != null) { pts.push({ i: i, v: p.value, label: p.label }); vals.push(p.value); } });
      if (!pts.length) return;
      if (opts.goal != null) vals.push(opts.goal);
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
      var hasLabels = d.some(function (p) { return p.label; });
      var L = 6, R = 10, top = 20, bot = hasLabels ? 18 : 8, W = w - L - R, H = h - top - bot, n = Math.max(1, d.length - 1);
      var c = col(el, opts.color, T.cyan);
      function X(i) { return L + (d.length > 1 ? i / n * W : W / 2); }
      function Y(val) { return top + H - (val - lo) / (hi - lo) * H; }
      // grid
      ctx.strokeStyle = T.track; ctx.lineWidth = 1;
      for (var g = 0; g <= 3; g++) { var yy = Math.round(top + H * g / 3) + 0.5; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + W, yy); ctx.stroke(); }
      if (opts.goal != null) {
        var gy = Math.round(Y(opts.goal)) + 0.5;
        ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = T.gold;
        ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(L + W, gy); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, 'GOAL ' + fmt(opts.goal) + (opts.unit || ''), L + 2, gy - 5, T.gold, 'left');
      }
      // reveal clip
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, L + W * t + (t >= 1 ? R : 0), h); ctx.clip();
      // area
      var grad = ctx.createLinearGradient(0, top, 0, top + H);
      grad.addColorStop(0, c); grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = T.glow ? 0.22 : 0.16; ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(X(pts[0].i), top + H);
      pts.forEach(function (p) { ctx.lineTo(X(p.i), Y(p.v)); });
      ctx.lineTo(X(pts[pts.length - 1].i), top + H); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // stroke
      ctx.lineWidth = 3; ctx.lineJoin = 'miter'; ctx.lineCap = 'square'; ctx.strokeStyle = c; glow(ctx, T, c);
      ctx.beginPath();
      pts.forEach(function (p, k) { k ? ctx.lineTo(X(p.i), Y(p.v)) : ctx.moveTo(X(p.i), Y(p.v)); });
      ctx.stroke(); noGlow(ctx);
      // pixel points
      if (pts.length <= 16) pts.forEach(function (p) { ctx.fillStyle = T.surface; ctx.fillRect(X(p.i) - 3, Y(p.v) - 3, 6, 6); ctx.fillStyle = c; ctx.fillRect(X(p.i) - 2, Y(p.v) - 2, 4, 4); });
      ctx.restore();
      // last value marker
      var last = pts[pts.length - 1];
      if (t >= 1) {
        glow(ctx, T, T.gold); ctx.fillStyle = T.gold; ctx.fillRect(X(last.i) - 4, Y(last.v) - 4, 8, 8); noGlow(ctx);
        label(ctx, 'NOW ' + fmt(last.v) + (opts.unit || ''), w - 2, 10, T.gold, 'right');
      }
      if (hasLabels) {
        var step = Math.ceil(d.length / 7);
        d.forEach(function (p, i) { if (p.label && i % step === 0) label(ctx, p.label, Math.max(L + 8, Math.min(w - R - 4, X(i))), h - 3, T.muted); });
      }
    });
  }

  /* ---- heatmap ---- */
  function heatmap(el, data, opts) {
    opts = opts || {};
    var d = norm(data), rows = opts.rows || 7;
    mount(el, rows * 14 + (rows - 1) * 3, opts, function (ctx, w, h, T, t) {
      var cols = Math.ceil(d.length / rows) || 1, gap = 3;
      var cell = Math.floor(Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows, 20));
      cell = Math.max(3, cell);
      var max = opts.max || Math.max.apply(null, d.map(function (p) { return p.value || 0; }).concat([1e-9]));
      if (!opts.max && max <= 4 && max > 1) max = 4; // 0..4 levels
      var c = col(el, opts.color, T.green), shown = Math.ceil(d.length * t);
      d.forEach(function (p, i) {
        var x = Math.floor(i / rows) * (cell + gap), y = (i % rows) * (cell + gap);
        noGlow(ctx); ctx.globalAlpha = 1; ctx.fillStyle = T.track; ctx.fillRect(x, y, cell, cell);
        if (i >= shown || !p.value) return;
        var k = Math.min(1, p.value / max);
        ctx.globalAlpha = 0.22 + 0.78 * k; ctx.fillStyle = c;
        if (k >= 0.99) glow(ctx, T, c, 0.6);
        ctx.fillRect(x, y, cell, cell);
      });
      ctx.globalAlpha = 1; noGlow(ctx);
      if (opts.today != null && d[opts.today]) {
        ctx.strokeStyle = T.gold; ctx.lineWidth = 2;
        ctx.strokeRect(Math.floor(opts.today / rows) * (cell + gap) - 1, (opts.today % rows) * (cell + gap) - 1, cell + 2, cell + 2);
      }
    });
  }

  /* ---- ring ---- */
  function ring(el, pct, opts) {
    opts = opts || {};
    pct = +pct || 0;
    mount(el, 120, opts, function (ctx, w, h, T, t) {
      var size = Math.min(w, h), lw = opts.width || Math.max(8, Math.round(size * 0.1));
      var cx = w / 2, cy = h / 2, r = size / 2 - lw / 2 - Math.max(2, T.glow * 0.6);
      var c = pct > 100 ? col(el, opts.overColor, T.magenta) : col(el, opts.color, T.cyan);
      var a0 = -Math.PI / 2, frac = Math.min(1, Math.max(0, pct / 100)) * t;
      ctx.lineWidth = lw; ctx.lineCap = 'butt';
      ctx.strokeStyle = T.track; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      if (frac > 0) {
        ctx.strokeStyle = c; glow(ctx, T, c);
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI * 2 * frac); ctx.stroke(); noGlow(ctx);
      }
      // arcade tick marks
      ctx.strokeStyle = T.surface; ctx.lineWidth = 2;
      for (var i = 0; i < 20; i++) {
        var a = a0 + i / 20 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - lw / 2 - 1), cy + Math.sin(a) * (r - lw / 2 - 1));
        ctx.lineTo(cx + Math.cos(a) * (r + lw / 2 + 1), cy + Math.sin(a) * (r + lw / 2 + 1)); ctx.stroke();
      }
      var txt = opts.label != null ? String(opts.label) : Math.round(pct * t) + '%';
      var fs = Math.max(8, Math.round(size * 0.14));
      glow(ctx, T, c, 0.6);
      label(ctx, txt, cx + 1, cy + (opts.sub ? fs * 0.3 : fs * 0.5), T.text, 'center', fs);
      noGlow(ctx);
      if (opts.sub) label(ctx, String(opts.sub), cx + 1, cy + fs * 0.3 + 14, T.muted, 'center', 7);
    });
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
    if (doc.fonts && doc.fonts.load) doc.fonts.load('8px "Press Start 2P"').then(function () { redraw(); }, function () {});
  }

  root.CHADCharts = { barsVsGoal: barsVsGoal, line: line, heatmap: heatmap, ring: ring, redraw: redraw };
})(window);
