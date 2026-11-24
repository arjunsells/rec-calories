/* CHAD v8 — motion8.js · springs, haptics, count-up, reorder, sheet drag and day paging. No dependencies.
   window.CHADMotion:
     reduced()                       true when prefers-reduced-motion is set (everything below then jumps)
     haptic(kind)                    'tap' | 'on' | 'off' | 'success' | 'warn'. navigator.vibrate where it exists;
                                     on iOS a hidden switch control is toggled (system tick, Safari 17.4+). Never throws.
     setHaptics(on)                  user preference (Settings)
     springTo(el, from, to, opts)    {x,y,scale,opacity} -> {…}; a damped spring baked into Web Animations keyframes,
                                     so it runs off the main thread and takes a release velocity. Returns a Promise.
     count(el, to, opts)             count-up for a number element. opts: {format, duration, from}
     mark(selector, cls, fn)         queue a one-shot class for the element that matches AFTER the next render
     flush() / clearMarks()          apply / drop the queue (app8.js calls these around a save)
     pulse(el, cls, ms)              restart a one-shot CSS animation class
     flip(scope, selector, keyFn)    capture positions; returns play(opts) to glide survivors to their new place
     sheet(dialog, close)            drag-to-dismiss with rubber band and velocity
     pager(surface, opts)            horizontal swipe with axis lock. opts: {target(), commit(dir, gesture)}
     pageTurn(page, dir, render, g)  push transition between two renders of the same container
     floater(el, text)               small label that rises from an element ("+10 XP")
     confetti(el)                    pixel confetti from an element (level, PR, S rank)
     enter(view)                     staggered rise for a view that just became visible
   Motion never gates state: every caller changes data first, then decorates. */
(function (root) {
  'use strict';
  var doc = root.document, nav = root.navigator || {};
  var RM = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  var raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : null;
  var caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : function () {};
  function reduced() { return !!RM.matches; }
  function now() { return root.performance && performance.now ? performance.now() : Date.now(); }
  function noop() {}

  /* ---- haptics ---- */
  var PATTERN = { tap: 8, on: 14, off: 6, success: [14, 60, 22], warn: [26, 50, 26] };
  var hapticsOn = true;
  var ios = /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  function iosTick() {
    // iOS has no Vibration API. Safari plays the system tick when a switch control toggles, so a hidden
    // <input type="checkbox" switch> is toggled through its label. Harmless where it does nothing.
    var label = doc.createElement('label'), input = doc.createElement('input');
    label.setAttribute('aria-hidden', 'true'); label.style.display = 'none';
    input.type = 'checkbox'; input.setAttribute('switch', '');
    label.appendChild(input); doc.head.appendChild(label); label.click(); doc.head.removeChild(label);
  }
  function haptic(kind) {
    if (!hapticsOn) return false;
    try {
      var active = nav.userActivation;
      if (active && !active.hasBeenActive) return false;            // never buzz before the first touch
      if (typeof nav.vibrate === 'function') return nav.vibrate(PATTERN[kind] || PATTERN.tap);
      if (ios) { iosTick(); return true; }
    } catch (e) { /* haptics are optional */ }
    return false;
  }
  function setHaptics(on) { hapticsOn = on !== false; }

  /* ---- springs ---- */
  // A damped spring sampled at 60 Hz: progress 0 -> 1 (it may overshoot). v0 = velocity / distance, per second.
  function springSamples(v0, k, c) {
    var x = 0, v = v0 || 0, dt = 1 / 240, out = [0], settled = 0;
    k = k || 260; c = c || 28;
    while (out.length < 150) {
      for (var i = 0; i < 4; i++) { var a = -k * (x - 1) - c * v; v += a * dt; x += v * dt; }
      out.push(x);
      if (Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.03) { if (++settled > 2) break; } else settled = 0;
    }
    out[out.length - 1] = 1;
    return { samples: out, duration: Math.round((out.length - 1) * 1000 / 60) };
  }
  function pose(from, to, p) {
    var x = (from.x || 0) + ((to.x || 0) - (from.x || 0)) * p, y = (from.y || 0) + ((to.y || 0) - (from.y || 0)) * p;
    var s0 = from.scale == null ? 1 : from.scale, s1 = to.scale == null ? 1 : to.scale, s = s0 + (s1 - s0) * p;
    var frame = { transform: 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' + (s0 !== 1 || s1 !== 1 ? ' scale(' + s.toFixed(4) + ')' : '') };
    if (from.opacity != null || to.opacity != null) {
      var o0 = from.opacity == null ? 1 : from.opacity, o1 = to.opacity == null ? 1 : to.opacity;
      frame.opacity = Math.max(0, Math.min(1, o0 + (o1 - o0) * Math.min(1, p * 1.6)));       // opacity settles early, no flicker on overshoot
    }
    return frame;
  }
  function springTo(el, from, to, opts) {
    opts = opts || {};
    if (!el || reduced() || !el.animate) return Promise.resolve();
    var dist = Math.hypot((to.x || 0) - (from.x || 0), (to.y || 0) - (from.y || 0)) || 1;
    var s = springSamples(Math.max(-12, Math.min(12, (opts.velocity || 0) / dist)), opts.stiffness, opts.damping);
    var frames = s.samples.map(function (p) { return pose(from, to, p); });
    var anim = el.animate(frames, { duration: s.duration, delay: opts.delay || 0, easing: 'linear', fill: 'backwards' });
    return new Promise(function (resolve) {
      var done = false, finish = function () { if (!done) { done = true; resolve(); } };
      anim.onfinish = finish; anim.oncancel = finish;
      root.setTimeout(finish, s.duration + (opts.delay || 0) + 120);
    });
  }

  /* ---- count-up ---- */
  function count(el, to, opts) {
    if (!el) return;
    opts = opts || {};
    to = +to || 0;
    var f = opts.format || function (n) { return Math.round(n).toLocaleString(); };
    var from = el.__chTo != null ? el.__chTo : (opts.from != null ? +opts.from : to);
    if (el.__chRaf) caf(el.__chRaf);
    el.__chTo = to;
    if (opts.instant || from === to || reduced() || !raf || doc.hidden) { el.textContent = f(to); return; }
    var t0 = 0, n = 0, dur = opts.duration || 650;
    (function tick(t) {
      n++; if (!t0) t0 = t || now();
      var p = Math.max(((t || t0) - t0) / dur, n / 90);            // the frame cap ends it even on a frozen clock
      if (p >= 1) { el.textContent = f(to); el.__chRaf = 0; return; }
      el.textContent = f(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      el.__chRaf = raf(tick);
    })(0);
  }

  /* ---- one-shot classes after a render ---- */
  var marks = [];
  function pulse(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    root.setTimeout(function () { el.classList.remove(cls); }, ms || 900);
  }
  function mark(selector, cls, fn) { marks.push({ s: selector, c: cls, f: fn }); }
  function clearMarks() { marks = []; }
  function flush() {
    var list = marks; marks = [];
    list.forEach(function (m) {
      var el = m.s ? doc.querySelector(m.s) : null;
      if (el && m.c) pulse(el, m.c);
      if (m.f) try { m.f(el); } catch (e) { /* decoration only */ }
    });
  }

  /* ---- reorder: First, Last, Invert, Play ---- */
  function flip(scope, selector, keyFn) {
    var before = new Map();
    if (scope && !reduced()) scope.querySelectorAll(selector).forEach(function (el) { var r = el.getBoundingClientRect(); before.set(keyFn(el), { x: r.left, y: r.top }); });
    // opts.hold: ms everything stays where it was (so the tick is seen in place). opts.jump: key of the block that
    // was acted on. It never crosses the others: it fades out where it was and arrives in its new place, while the
    // rest close ranks in one direction.
    return function play(opts) {
      if (!before.size || reduced()) return;
      opts = opts || {};
      var hold = opts.hold || 0;
      scope.querySelectorAll(selector).forEach(function (el) {
        var key = keyFn(el), b = before.get(key);
        if (!b) return;
        var r = el.getBoundingClientRect(), dx = b.x - r.left, dy = b.y - r.top;
        if (Math.abs(dx) + Math.abs(dy) < 2) return;
        if (key !== opts.jump || !el.animate) { springTo(el, { x: dx, y: dy }, { x: 0, y: 0 }, { delay: hold, stiffness: 210, damping: 26 }); return; }
        var total = hold + 400, was = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
        el.animate([
          { transform: was, opacity: 1, offset: 0 },
          { transform: was, opacity: 1, offset: hold / total },
          { transform: was + ' scale(.985)', opacity: 0, offset: (hold + 150) / total },
          { transform: 'translate3d(0,10px,0)', opacity: 0, offset: (hold + 160) / total },
          { transform: 'translate3d(0,0,0)', opacity: 1, offset: 1 }
        ], { duration: total, easing: 'ease-out', fill: 'backwards' });
      });
    };
  }

  /* ---- sheets: pull down to dismiss ---- */
  function sheet(d, close) {
    var body = d.querySelector('.ch-sheet__body'), st = null;
    function begin(y, fromBody) { st = { y0: y, y: y, t: now(), vy: 0, off: 0, moved: false, fromBody: fromBody, h: d.getBoundingClientRect().height || 1 }; }
    function move(y, e) {
      if (!st) return;
      var dy = y - st.y0;
      if (!st.moved) {
        if (Math.abs(dy) < 6) return;
        if (st.fromBody && (dy < 0 || (body && body.scrollTop > 0))) { st = null; return; }       // that is a scroll, not a pull
        st.moved = true; d.classList.remove('is-opening'); d.classList.add('is-dragging');
      }
      if (e && e.cancelable) e.preventDefault();
      var t = now();
      st.vy = (y - st.y) / Math.max(1, t - st.t) * 1000; st.y = y; st.t = t;
      st.off = dy > 0 ? dy : -Math.pow(-dy, 0.72);                                               // rubber band upward
      d.style.transform = 'translateY(' + st.off.toFixed(1) + 'px)';
      d.style.setProperty('--drag', Math.max(0, Math.min(1, dy / st.h)).toFixed(3));
    }
    function end() {
      var s = st; st = null;
      if (!s || !s.moved) return;
      if (s.off > Math.min(140, s.h * 0.34) || (s.vy > 650 && s.off > 16)) { haptic('tap'); d.classList.remove('is-dragging'); close(d); return; }
      d.style.transform = ''; d.style.removeProperty('--drag');
      springTo(d, { y: s.off }, { y: 0 }, { velocity: -s.vy, stiffness: 320, damping: 30 }).then(function () { d.classList.remove('is-dragging'); });
    }
    function interactive(t) { return !!(t.closest && t.closest('input,textarea,select,video,[data-nodrag]')); }
    d.addEventListener('touchstart', function (e) {
      st = null;
      if (e.touches.length !== 1 || interactive(e.target)) return;
      begin(e.touches[0].clientY, !!(body && body.contains(e.target)));
    }, { passive: true });
    d.addEventListener('touchmove', function (e) { if (st) move(e.touches[0].clientY, e); }, { passive: false });
    d.addEventListener('touchend', end, { passive: true });
    d.addEventListener('touchcancel', end, { passive: true });
    // mouse / trackpad: the grip and the title bar
    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0 || interactive(e.target) || !e.target.closest('.ch-sheet__grip,.ch-sheet__head') || e.target.closest('button')) return;
      begin(e.clientY, false);
      var up = function () { root.removeEventListener('pointermove', mv); root.removeEventListener('pointerup', up); end(); };
      var mv = function (ev) { move(ev.clientY, ev); };
      root.addEventListener('pointermove', mv); root.addEventListener('pointerup', up);
    });
  }

  /* ---- days: horizontal swipe with axis lock ---- */
  function pager(surface, opts) {
    var st = null;
    function reset(el) { if (el) { el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; } }
    surface.addEventListener('touchstart', function (e) {
      st = null;
      if (e.touches.length !== 1 || (e.target.closest && e.target.closest('input,select,textarea,dialog,[data-noswipe]'))) return;
      var p = e.touches[0];
      st = { x: p.clientX, y: p.clientY, lx: p.clientX, lt: now(), vx: 0, dx: 0, dy: 0, axis: null, el: null };
    }, { passive: true });
    surface.addEventListener('touchmove', function (e) {
      if (!st) return;
      if (e.touches.length !== 1) { reset(st.el); st = null; return; }
      var p = e.touches[0], dx = p.clientX - st.x, dy = p.clientY - st.y;
      if (!st.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        st.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
        if (st.axis === 'x') { st.el = opts.target(); if (st.el) st.el.style.willChange = 'transform'; }
      }
      if (st.axis !== 'x') return;
      if (e.cancelable) e.preventDefault();
      var t = now();
      st.vx = (p.clientX - st.lx) / Math.max(1, t - st.lt) * 1000; st.lx = p.clientX; st.lt = t; st.dx = dx; st.dy = dy;
      if (st.el && !reduced()) { st.el.style.transform = 'translate3d(' + (dx * 0.6).toFixed(1) + 'px,0,0)'; st.el.style.opacity = String(1 - Math.min(0.4, Math.abs(dx) / 480)); }
    }, { passive: false });
    function end() {
      var s = st; st = null;
      if (!s || s.axis !== 'x') return;
      // Commit on distance, or on a deliberate flick (short but fast, still clearly horizontal).
      var flat = Math.abs(s.dx) > Math.abs(s.dy) * 1.5, far = Math.abs(s.dx) > 72 && flat, flick = Math.abs(s.vx) > 600 && Math.abs(s.dx) > 32 && s.vx * s.dx > 0 && flat;
      if (far || flick) { opts.commit(s.dx < 0 ? 1 : -1, { from: reduced() ? 0 : s.dx * 0.6, velocity: s.vx }); return; }
      var el = s.el; if (!el) return;
      var from = s.dx * 0.6; reset(el);
      springTo(el, { x: from, opacity: 1 - Math.min(0.4, Math.abs(s.dx) / 480) }, { x: 0, opacity: 1 }, { velocity: -s.vx * Math.sign(from || 1), stiffness: 320, damping: 30 });
    }
    surface.addEventListener('touchend', end, { passive: true });
    surface.addEventListener('touchcancel', function () { if (st) reset(st.el); st = null; }, { passive: true });
  }

  // Push transition: a frozen copy of the old page leaves while the freshly rendered one springs in.
  function pageTurn(page, dir, render, g) {
    g = g || {};
    if (!page || reduced() || !page.animate) { if (page) { page.style.transform = ''; page.style.opacity = ''; page.style.willChange = ''; } render(); return; }
    var w = page.offsetWidth, from = g.from || 0, travel = w + 24, ghost = page.cloneNode(true);       // a full page apart: never overlapping
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    ghost.classList.add('ch-page-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    ghost.style.top = page.offsetTop + 'px'; ghost.style.left = page.offsetLeft + 'px'; ghost.style.width = w + 'px';
    var startOpacity = page.style.opacity === '' ? 1 : +page.style.opacity;
    page.style.transform = ''; page.style.opacity = ''; page.style.willChange = '';
    page.parentNode.appendChild(ghost);
    render();
    // Both pages travel the same distance on the same spring, so they stay side by side like two real pages.
    var gone = false, remove = function () { if (!gone) { gone = true; ghost.remove(); } };
    var spring = { velocity: Math.abs(g.velocity || 0), stiffness: 300, damping: 32 };
    ghost.style.transform = 'translate3d(' + (-dir * travel) + 'px,0,0)';                                 // where it rests once the animation ends
    springTo(ghost, { x: from, opacity: startOpacity }, { x: -dir * travel, opacity: startOpacity }, spring).then(remove);
    root.setTimeout(remove, 1200);
    springTo(page, { x: from + dir * travel }, { x: 0 }, spring);
  }

  /* ---- little rewards ---- */
  function floater(el, text) {
    if (!el || reduced()) return;
    var r = el.getBoundingClientRect(), p = doc.createElement('p');
    if (!r.width) return;
    p.className = 'xp-pop'; p.textContent = text; p.setAttribute('aria-hidden', 'true');
    p.style.left = Math.max(8, Math.min(root.innerWidth - 72, r.left + r.width / 2 - 28)) + 'px';
    p.style.top = Math.max(8, r.top - 6) + 'px';
    doc.body.appendChild(p);
    root.setTimeout(function () { p.remove(); }, 950);
  }
  var COLORS = ['#F3E0B2', '#C9A465', '#FF9C22', '#FF4E2B', '#FFD95A', '#FFFFFF'];
  function confetti(el) {
    if (reduced() || !raf || doc.hidden || doc.querySelector('.ch-confetti')) return;      // one celebration at a time
    var c = doc.createElement('canvas'), dpr = Math.min(root.devicePixelRatio || 1, 2), w = root.innerWidth, h = root.innerHeight;
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var ox = r && r.width ? r.left + r.width / 2 : w / 2, oy = r && r.width ? r.top + r.height / 2 : h * 0.3;
    c.className = 'ch-confetti'; c.width = w * dpr; c.height = h * dpr; c.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(c);
    var ctx = c.getContext('2d'), bits = [], n = 0;
    for (var i = 0; i < 64; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 260 + Math.random() * 420;
      bits.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: (4 + Math.floor(Math.random() * 3) * 2), c: COLORS[i % COLORS.length], life: 0.9 + Math.random() * 0.5 });
    }
    (function tick() {
      n++;
      var t = n / 60, alive = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        if (t > b.life) return;
        alive = true;
        b.vy += 900 / 60; b.vx *= 0.985; b.x += b.vx / 60; b.y += b.vy / 60;
        ctx.globalAlpha = Math.min(1, (b.life - t) * 3);
        ctx.fillStyle = b.c;
        ctx.fillRect(Math.round(b.x / 2) * 2, Math.round(b.y / 2) * 2, b.s, b.s);               // snapped: pixel confetti
      });
      if (alive && n < 120) raf(tick); else c.remove();
    })();
    root.setTimeout(function () { c.remove(); }, 2600);
  }
  function enter(view) { if (view && !reduced()) pulse(view, 'is-entering', 800); }

  // iOS only shows :active on touch when a touch listener exists.
  if (doc && doc.addEventListener) doc.addEventListener('touchstart', noop, { passive: true });

  root.CHADMotion = { reduced: reduced, haptic: haptic, setHaptics: setHaptics, springTo: springTo, springSamples: springSamples, count: count, mark: mark, flush: flush, clearMarks: clearMarks, pulse: pulse, flip: flip, sheet: sheet, pager: pager, pageTurn: pageTurn, floater: floater, confetti: confetti, enter: enter };
})(window);
