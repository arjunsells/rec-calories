/* CHAD v8 — icons8.js · SF-Symbol-like line icons as inline SVG. No dependencies.
   window.CHADIcons:
     icon(name, size = 24, opts)  -> '<svg class="ch-icon" …>' markup string ('' for unknown names)
                                     opts: {weight: stroke width (default 1.8), label: 'aria label', cls: 'extra class'}
     mount(root = document)       -> fills every <i data-icon="bottle" data-size="24" data-weight="2"></i>
     has(name)                    -> true if the name or alias exists
     names                        -> list of icon names (aliases included)
   Icons are drawn on a 24 x 24 grid with stroke="currentColor": set `color` on the parent.
   New in v8: wifi-off, refresh, crown. */
(function (root) {
  'use strict';

  function gear() {
    // 8-tooth cog generated so it stays symmetric
    var n = 8, ro = 9.3, ri = 7.1, d = '';
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - Math.PI / 2, s = Math.PI * 2 / n;
      [[ri, -0.30], [ro, -0.17], [ro, 0.17], [ri, 0.30]].forEach(function (pt, k) {
        var ang = a + pt[1] * s;
        d += (i === 0 && k === 0 ? 'M' : 'L') + (12 + Math.cos(ang) * pt[0]).toFixed(2) + ' ' + (12 + Math.sin(ang) * pt[0]).toFixed(2);
      });
    }
    return '<path d="' + d + 'Z"/><circle cx="12" cy="12" r="3.1"/>';
  }
  function sun() {
    var d = '';
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      d += 'M' + (12 + Math.cos(a) * 7).toFixed(2) + ' ' + (12 + Math.sin(a) * 7).toFixed(2) +
           'L' + (12 + Math.cos(a) * 9.3).toFixed(2) + ' ' + (12 + Math.sin(a) * 9.3).toFixed(2);
    }
    return '<circle cx="12" cy="12" r="4"/><path d="' + d + '"/>';
  }
  function p(d) { return '<path d="' + d + '"/>'; }                                   // stroked path
  // Solid parts set fill-opacity themselves so a tinted-fill rule on the <svg> (e.g. the active tab) cannot fade them.
  function pf(d) { return '<path d="' + d + '" fill="currentColor" fill-opacity="1"/>'; }      // stroked + filled
  function c(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; }
  function dot(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="currentColor" fill-opacity="1" stroke="none"/>'; }

  var DROP = 'M12 3.2s6.4 6.4 6.4 11.1A6.4 6.4 0 0 1 12 20.8a6.4 6.4 0 0 1-6.4-6.5C5.6 9.6 12 3.2 12 3.2z';
  var HEART = 'M12 19.5s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 6.8a4.2 4.2 0 0 1 7.5 2.6c0 5.5-7.5 10.1-7.5 10.1z';
  var SOLE = 'c1.8 0 3 1.5 3 3.5 0 1.7-.6 2.8-1 3.6h-4c-.4-.8-1-1.9-1-3.6 0-2 1.2-3.5 3-3.5z';
  var HEEL = 'h3.6v.5a1.8 1.8 0 0 1-3.6 0z';

  var I = {
    /* ---- navigation / chrome ---- */
    house: p('M3.5 11.5 12 4l8.5 7.5') + p('M5.75 9.8V19a1 1 0 0 0 1 1h3.5v-5.2h3.5V20h3.5a1 1 0 0 0 1-1V9.8'),
    dumbbell: '<rect x="5.4" y="6" width="3.4" height="12" rx="1.4"/><rect x="15.2" y="6" width="3.4" height="12" rx="1.4"/>' +
      '<rect x="2.4" y="9" width="3" height="6" rx="1.2"/><rect x="18.6" y="9" width="3" height="6" rx="1.2"/>' + p('M8.8 12h6.4'),
    chart: '<rect x="3.5" y="12" width="4.4" height="8" rx="1.3"/><rect x="9.8" y="4" width="4.4" height="16" rx="1.3"/><rect x="16.1" y="8.5" width="4.4" height="11.5" rx="1.3"/>',
    gear: gear(),
    rings: p('M12 3a9 9 0 1 1-8.46 5.92') + p('M12 6.6a5.4 5.4 0 1 1-5.07 7.25') + dot(12, 12, 1.5),
    plus: p('M12 4.5v15M4.5 12h15'),
    minus: p('M5 12h14'),
    xmark: p('M6 6l12 12M18 6 6 18'),
    check: p('M5 12.6l4.6 4.6L19 7.4'),
    'check-circle': c(12, 12, 9) + p('M7.9 12.4l2.9 2.9 5.4-5.9'),
    chevron: p('M9 5l7 7-7 7'),
    'chevron-left': p('M15 5l-7 7 7 7'),
    'chevron-down': p('M5 9l7 7 7-7'),
    'chevron-up': p('M5 15l7-7 7 7'),
    'arrow-up': p('M12 19.5v-15M5.5 11 12 4.5l6.5 6.5'),
    'arrow-down': p('M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5'),
    'arrow-up-right': p('M6.5 17.5l11-11M8.5 6.5h9v9'),
    undo: p('M8.6 5 4.4 9.2l4.2 4.2') + p('M4.6 9.2h9.7a5.2 5.2 0 0 1 0 10.4H9.4'),
    repeat: p('M18.7 15.5A7.4 7.4 0 1 1 12 5c2.1 0 4 .9 5.4 2.2l2.1 1.9') + p('M19.5 4.4v4.7h-4.7'),
    swap: p('M4 8h15M15.5 4.5 19 8l-3.5 3.5') + p('M20 16H5M8.5 12.5 5 16l3.5 3.5'),
    ellipsis: dot(5.5, 12, 1.7) + dot(12, 12, 1.7) + dot(18.5, 12, 1.7),
    list: dot(4.6, 6.5, 1.2) + dot(4.6, 12, 1.2) + dot(4.6, 17.5, 1.2) + p('M9 6.5h11M9 12h11M9 17.5h11'),
    info: c(12, 12, 9) + p('M12 11.1v5.3') + dot(12, 7.7, 1.15),

    /* ---- food / capture ---- */
    camera: p('M3 9.2a2 2 0 0 1 2-2h2.1l1.25-1.9a1.6 1.6 0 0 1 1.33-.7h4.64a1.6 1.6 0 0 1 1.33.7L16.9 7.2H19a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') + c(12, 13.1, 3.6),
    barcode: p('M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2') + p('M7.5 8.5v7M10.5 8.5v7M13.5 8.5v7M16.5 8.5v7'),
    magnifier: c(10.5, 10.5, 6.5) + p('M15.4 15.4 20.5 20.5'),
    bolt: p('M13.2 2.8 5.2 13.6h5.9l-1 7.6 8.7-11.2h-6.2z'),
    fork: p('M6 3.5V9a2.5 2.5 0 0 0 5 0V3.5M8.5 3.5v17M17.5 20.5v-17c-2.2 1.6-3.3 4.2-3.3 7.6v1.6h3.3'),
    sparkles: p('M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z') + p('M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z'),

    /* ---- quests ---- */
    drop: p(DROP),
    bottle: '<rect x="8.9" y="2.6" width="6.2" height="3" rx="1.1"/>' +
      p('M10 5.6v1.1c0 1-.5 1.7-1.3 2.4-.9.8-1.4 1.7-1.4 3v6.7a2.4 2.4 0 0 0 2.4 2.4h4.6a2.4 2.4 0 0 0 2.4-2.4v-6.7c0-1.3-.5-2.2-1.4-3-.8-.7-1.3-1.4-1.3-2.4V5.6') +
      p('M7.3 14.6c1.5-1.1 3.2-1.1 4.7 0s3.2 1.1 4.7 0'),
    electrolyte: p(DROP) + p('M13 9.9l-2.7 4.2h3.4L11 18.2'),
    tablet: '<ellipse cx="9.9" cy="13.4" rx="6.6" ry="3.7"/>' + p('M3.3 13.4v3c0 2 3 3.7 6.6 3.7s6.6-1.7 6.6-3.7v-3') + p('M7.5 13.4h4.8') +
      c(17.1, 6.8, 1.7) + dot(12.5, 4.9, 1.15) + dot(20, 10.8, 0.95),
    pill: '<rect x="3" y="8.2" width="18" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/>' + p('M9.3 9.3l5.4 5.4'),
    run: dot(15.6, 4.4, 1.9) + p('M7.6 12.2 9.2 8.9l4.3-1 2.9 2.9 2.8-.9') + p('M13.5 7.9l-2.3 5.7 3.8 2.4-.6 4.6') + p('M11.2 13.6 9 17.2l-4.4.4'),
    walk: dot(12.2, 4.4, 1.9) + p('M8.4 21l2.3-6-1.7-2.6.9-4.7 2.9.5 1.9 3 3 1M9.8 7.7 6.4 9.6v3M11.6 13.6l2.9 2.5.9 4.9'),
    'heart-pulse': p(HEART) + p('M5.5 12.2h2.7l1.5-2.6 2.5 5.2 2-4.2.9 1.6h3.4'),
    heart: p(HEART),
    shoe: p('M3.2 14.3V8.7c0-1 1.2-1.5 1.9-.8l.9.9c.6.6 1.6.6 2.2 0l1.9-2 5.1 4.7c.6.5 1.3.8 2 .9l1.3.2a2.9 2.9 0 0 1 2.7 2.1v.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4z') +
      p('M3.2 14.3h17.9') + p('M12.1 8.7l1.3-1.5M14.1 10.4l1.3-1.5'),
    footprints: '<g transform="rotate(-9 7.6 15)">' + p('M7.6 9.2' + SOLE) + pf('M5.8 18.4' + HEEL) + '</g>' +
      '<g transform="rotate(9 16.4 9.2)">' + p('M16.4 3.4' + SOLE) + pf('M14.6 12.6' + HEEL) + '</g>',
    moon: p('M20.2 14.4A8.3 8.3 0 0 1 9.6 3.8a8.3 8.3 0 1 0 10.6 10.6z'),
    sleep: p('M16.8 16.45A7 7 0 0 1 7.55 7.2a7 7 0 1 0 9.25 9.25z') + p('M14.6 4.2H20l-5.4 6H20'),
    bed: p('M3 18.5V7M3 15h18v3.5M21 15v-1.2a3 3 0 0 0-3-3h-6.5V15') + c(7.2, 11.6, 1.6),
    glove: p('M9.2 16.8c-1.3-1.5-2-3.1-2-5.2V9.1A5.1 5.1 0 0 1 12.3 4h1.9a5.2 5.2 0 0 1 5.2 5.2v2.3c0 2.1-.8 3.8-2.2 5.3') +
      p('M7.2 9.9c-1.7-.2-3 .9-3 2.6 0 1.8 1.5 3.1 3.5 2.9') + '<rect x="9.2" y="16.8" width="8" height="3.6" rx="1.2"/>',
    leaf: p('M19.2 4.8c.3 8.3-3.6 13.4-10.3 13.9-2.2.2-3.7-1.2-3.5-3.4C5.9 8.6 10.9 4.6 19.2 4.8z') + p('M4.6 19.6l7.8-8'),
    flame: p('M12 21c3.7 0 6.6-2.7 6.6-6.5 0-2.6-1.4-4.5-2.9-6.1-.4 1.3-1 2.1-2 2.6.3-3-1-5.9-3.6-8 .2 2.9-1.3 4.6-2.6 6.3-1.2 1.6-2.1 3.1-2.1 5.2C5.4 18.3 8.3 21 12 21z'),

    /* ---- status / misc ---- */
    sun: sun(),
    trophy: p('M8 4h8v5.2a4 4 0 0 1-8 0z') + p('M8 5.6H5.3c0 2.3 1 3.9 3 4.4M16 5.6h2.7c0 2.3-1 3.9-3 4.4M12 13.2V17M8.6 20h6.8M9.8 17h4.4'),
    star: p('M12 3.6l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z'),
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/>' + p('M8 10.5V8a4 4 0 0 1 8 0v2.5'),
    scale: '<rect x="4" y="4" width="16" height="16" rx="4.5"/>' + p('M8.3 9.6a5.2 5.2 0 0 1 7.4 0l-2 2.6h-3.4z'),
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/>' + p('M4 10h16M8 3.5v4M16 3.5v4'),
    key: c(8, 15.5, 4) + p('M10.9 12.6 19.5 4M16.2 7.3l2.5 2.5M13.6 9.9l1.9 1.9'),
    trash: p('M5 7h14M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 11.4a1.6 1.6 0 0 0 1.6 1.6h5.2a1.6 1.6 0 0 0 1.6-1.6L17 7M10 11v5.5M14 11v5.5'),
    speaker: p('M4 9.6v4.8h3.4l4.6 4V5.6l-4.6 4z') + p('M15.5 9a4.2 4.2 0 0 1 0 6M18 6.4a7.8 7.8 0 0 1 0 11.2'),
    person: c(12, 8, 3.6) + p('M5 20.2a7 7 0 0 1 14 0'),
    target: c(12, 12, 9) + c(12, 12, 5) + dot(12, 12, 1.4),
    clock: c(12, 12, 9) + p('M12 7v5.2l3.2 2'),
    timer: c(12, 13.4, 7.4) + p('M9.8 2.9h4.4M12 2.9v3.1M12 13.4V9.4'),
    share: p('M12 15V3.6M8 7.4l4-4 4 4M7 11H5.6A1.6 1.6 0 0 0 4 12.6v5.8A1.6 1.6 0 0 0 5.6 20h12.8a1.6 1.6 0 0 0 1.6-1.6v-5.8a1.6 1.6 0 0 0-1.6-1.6H17'),
    pencil: p('M4 20l1-4.2L16.2 4.6a1.8 1.8 0 0 1 2.5 0l.7.7a1.8 1.8 0 0 1 0 2.5L8.2 19z') + p('M14.4 6.4l3.2 3.2'),
    lightbulb: p('M9 17.4v-.6c0-1.3-.6-2.2-1.5-3.2a6.1 6.1 0 1 1 9 0c-.9 1-1.5 1.9-1.5 3.2v.6z') + p('M10 20.6h4'),
    'wifi-off': p('M3.5 9.4a12.6 12.6 0 0 1 4.3-2.7M12 5.5c3.2 0 6.2 1.2 8.5 3.3M6.6 12.9a8 8 0 0 1 3.2-1.9M14.6 11.2c1 .4 2 1 2.8 1.7M9.6 16.2a3.6 3.6 0 0 1 4.8 0') + dot(12, 19.2, 1.2) + p('M4.5 3.5l15 17'),
    refresh: p('M19.4 12a7.4 7.4 0 0 1-13.2 4.6M4.6 12a7.4 7.4 0 0 1 13.2-4.6') + p('M18.2 3.6v4h-4M5.8 20.4v-4h4'),
    crown: p('M4.2 17.6 3 8.2l5 3.6 4-6.2 4 6.2 5-3.6-1.2 9.4z') + p('M5 20.4h14')
  };

  var ALIAS = {
    today: 'house', home: 'house', summary: 'rings', training: 'dumbbell', progress: 'chart', settings: 'gear',
    water: 'drop', hydralyte: 'electrolyte', cardio: 'run', steps: 'shoe',
    search: 'magnifier', 'quick-add': 'bolt', quick: 'bolt', add: 'plus', close: 'xmark', scan: 'barcode',
    'chevron-right': 'chevron', forward: 'chevron', next: 'chevron', back: 'chevron-left', prev: 'chevron-left',
    streak: 'flame', weight: 'scale', meal: 'fork', ai: 'sparkles', sound: 'speaker', dark: 'moon', light: 'sun',
    export: 'share', edit: 'pencil', goal: 'target', badge: 'trophy', xp: 'star',
    offline: 'wifi-off', retry: 'refresh', level: 'crown', tip: 'lightbulb', more: 'ellipsis', again: 'repeat', rest: 'leaf', 'muay-thai': 'glove', done: 'check-circle'
  };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function body(name) {
    if (own(I, name)) return I[name];
    if (own(ALIAS, name)) return I[ALIAS[name]];
    return '';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function has(name) { return !!body(name); }
  function icon(name, size, opts) {
    opts = opts || {};
    var b = body(name);
    if (!b) return '';
    size = +size || 24;
    var a11y = opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="ch-icon' + (opts.cls ? ' ' + esc(opts.cls) : '') + '" data-name="' + esc(name) + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (+opts.weight || 1.8) +
      '" stroke-linecap="round" stroke-linejoin="round"' + a11y + '>' + b + '</svg>';
  }
  function mount(scope) {
    var els = (scope || root.document).querySelectorAll('[data-icon]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], svg = icon(el.getAttribute('data-icon'), el.getAttribute('data-size') || 24,
        { weight: +el.getAttribute('data-weight') || 0, label: el.getAttribute('data-label') || '' });
      if (svg) el.innerHTML = svg;
    }
  }
  root.CHADIcons = { icon: icon, mount: mount, has: has, names: Object.keys(I).concat(Object.keys(ALIAS)) };
})(window);
