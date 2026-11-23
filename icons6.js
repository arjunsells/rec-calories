/* CHAD v6 — icons6.js · SF-Symbol-like line icons as inline SVG. No dependencies.
   window.CHADIcons:
     icon(name, size = 24, opts)  -> '<svg class="ch-icon" …>' markup string
                                     opts: {weight: stroke width (default 1.8), label: 'aria label', cls: 'extra class'}
     mount(root = document)       -> fills every <i data-icon="camera" data-size="24"></i>
     names                        -> list of icon names (aliases included)
   Icons use stroke="currentColor": set `color` on the parent. They scale with `size` (px).
   v5 sprite names used for tab icons are aliased (today, training, progress, settings, water),
   so <i data-icon="training"> works. */
(function (root) {
  'use strict';

  function gear() {
    // 8-tooth cog generated so it stays symmetric
    var n = 8, ro = 9.3, ri = 7.1, d = '';
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - Math.PI / 2, s = Math.PI * 2 / n;
      [[ri, -0.30], [ro, -0.17], [ro, 0.17], [ri, 0.30]].forEach(function (p, k) {
        var ang = a + p[1] * s;
        d += (i === 0 && k === 0 ? 'M' : 'L') + (12 + Math.cos(ang) * p[0]).toFixed(2) + ' ' + (12 + Math.sin(ang) * p[0]).toFixed(2);
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
  function p(d) { return '<path d="' + d + '"/>'; }

  var I = {
    house: p('M3.5 11.5 12 4l8.5 7.5') + p('M5.75 9.8V19a1 1 0 0 0 1 1h3.5v-5.2h3.5V20h3.5a1 1 0 0 0 1-1V9.8'),
    dumbbell: '<rect x="5.2" y="6.5" width="3.2" height="11" rx="1.3"/><rect x="15.6" y="6.5" width="3.2" height="11" rx="1.3"/>' +
      '<rect x="2" y="9.5" width="3.2" height="5" rx="1.2"/><rect x="18.8" y="9.5" width="3.2" height="5" rx="1.2"/>' + p('M8.4 12h7.2'),
    chart: '<rect x="3.5" y="12" width="4.4" height="8" rx="1.3"/><rect x="9.8" y="4" width="4.4" height="16" rx="1.3"/><rect x="16.1" y="8.5" width="4.4" height="11.5" rx="1.3"/>',
    gear: gear(),
    plus: p('M12 4.5v15M4.5 12h15'),
    minus: p('M5 12h14'),
    xmark: p('M6 6l12 12M18 6 6 18'),
    camera: p('M3 9.2a2 2 0 0 1 2-2h2.1l1.25-1.9a1.6 1.6 0 0 1 1.33-.7h4.64a1.6 1.6 0 0 1 1.33.7L16.9 7.2H19a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') + '<circle cx="12" cy="13.1" r="3.6"/>',
    barcode: p('M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2') + p('M7.5 8.5v7M10.5 8.5v7M13.5 8.5v7M16.5 8.5v7'),
    magnifier: '<circle cx="10.5" cy="10.5" r="6.5"/>' + p('M15.4 15.4 20.5 20.5'),
    bolt: p('M13.2 2.8 5.2 13.6h5.9l-1 7.6 8.7-11.2h-6.2z'),
    drop: p('M12 3.2s6.4 6.4 6.4 11.1A6.4 6.4 0 0 1 12 20.8a6.4 6.4 0 0 1-6.4-6.5C5.6 9.6 12 3.2 12 3.2z'),
    flame: p('M12 21c3.7 0 6.6-2.7 6.6-6.5 0-2.6-1.4-4.5-2.9-6.1-.4 1.3-1 2.1-2 2.6.3-3-1-5.9-3.6-8 .2 2.9-1.3 4.6-2.6 6.3-1.2 1.6-2.1 3.1-2.1 5.2C5.4 18.3 8.3 21 12 21z'),
    check: p('M5 12.6l4.6 4.6L19 7.4'),
    chevron: p('M9 5l7 7-7 7'),
    'chevron-left': p('M15 5l-7 7 7 7'),
    'chevron-down': p('M5 9l7 7 7-7'),
    'chevron-up': p('M5 15l7-7 7 7'),
    moon: p('M20.2 14.4A8.3 8.3 0 0 1 9.6 3.8a8.3 8.3 0 1 0 10.6 10.6z'),
    sun: sun(),
    trophy: p('M8 4h8v5.2a4 4 0 0 1-8 0z') + p('M8 5.6H5.3c0 2.3 1 3.9 3 4.4M16 5.6h2.7c0 2.3-1 3.9-3 4.4M12 13.2V17M8.6 20h6.8M9.8 17h4.4'),
    star: p('M12 3.6l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z'),
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/>' + p('M8 10.5V8a4 4 0 0 1 8 0v2.5'),
    heart: p('M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z'),
    bed: p('M3 18.5V7M3 15h18v3.5M21 15v-1.2a3 3 0 0 0-3-3h-6.5V15') + '<circle cx="7.2" cy="11.6" r="1.6"/>',
    walk: '<circle cx="13" cy="4.6" r="1.6"/>' + p('M9.2 21l2.3-6-1.7-2.6.9-4.7 2.9.5 1.9 3 3 1M10.6 7.7 7.2 9.6v3M12.4 13.6l2.9 2.5.9 4.9'),
    scale: '<rect x="4" y="4" width="16" height="16" rx="4.5"/>' + p('M8.3 9.6a5.2 5.2 0 0 1 7.4 0l-2 2.6h-3.4z'),
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/>' + p('M4 10h16M8 3.5v4M16 3.5v4'),
    key: '<circle cx="8" cy="15.5" r="4"/>' + p('M10.9 12.6 19.5 4M16.2 7.3l2.5 2.5M13.6 9.9l1.9 1.9'),
    info: '<circle cx="12" cy="12" r="9"/>' + p('M12 11v5.6M12 7.6v.2'),
    trash: p('M5 7h14M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 11.4a1.6 1.6 0 0 0 1.6 1.6h5.2a1.6 1.6 0 0 0 1.6-1.6L17 7M10 11v5.5M14 11v5.5'),
    fork: p('M6 3.5V9a2.5 2.5 0 0 0 5 0V3.5M8.5 3.5v17M17.5 20.5v-17c-2.2 1.6-3.3 4.2-3.3 7.6v1.6h3.3'),
    sparkles: p('M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z') + p('M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z'),
    speaker: p('M4 9.6v4.8h3.4l4.6 4V5.6l-4.6 4z') + p('M15.5 9a4.2 4.2 0 0 1 0 6M18 6.4a7.8 7.8 0 0 1 0 11.2'),
    person: '<circle cx="12" cy="8" r="3.6"/>' + p('M5 20.2a7 7 0 0 1 14 0'),
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/>' + p('M12 7v5.2l3.2 2'),
    share: p('M12 15V3.6M8 7.4l4-4 4 4M7 11H5.6A1.6 1.6 0 0 0 4 12.6v5.8A1.6 1.6 0 0 0 5.6 20h12.8a1.6 1.6 0 0 0 1.6-1.6v-5.8a1.6 1.6 0 0 0-1.6-1.6H17'),
    pencil: p('M4 20l1-4.2L16.2 4.6a1.8 1.8 0 0 1 2.5 0l.7.7a1.8 1.8 0 0 1 0 2.5L8.2 19z') + p('M14.4 6.4l3.2 3.2'),
    pill: '<rect x="3" y="8.2" width="18" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/>' + p('M9.3 9.3l5.4 5.4')
  };
  var ALIAS = { today: 'house', home: 'house', training: 'dumbbell', progress: 'chart', settings: 'gear', water: 'drop',
    search: 'magnifier', 'quick-add': 'bolt', quick: 'bolt', add: 'plus', close: 'xmark', scan: 'barcode',
    'chevron-right': 'chevron', back: 'chevron-left', streak: 'flame', sleep: 'bed', steps: 'walk', weight: 'scale',
    meal: 'fork', ai: 'sparkles', sound: 'speaker', dark: 'moon', light: 'sun', export: 'share', edit: 'pencil',
    electrolyte: 'pill', goal: 'target', badge: 'trophy', xp: 'star' };

  function icon(name, size, opts) {
    opts = opts || {};
    var body = I[name] || I[ALIAS[name]];
    if (!body) return '';
    size = +size || 24;
    var a11y = opts.label ? ' role="img" aria-label="' + String(opts.label).replace(/"/g, '&quot;') + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="ch-icon' + (opts.cls ? ' ' + opts.cls : '') + '" data-name="' + name + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (opts.weight || 1.8) +
      '" stroke-linecap="round" stroke-linejoin="round"' + a11y + '>' + body + '</svg>';
  }
  function mount(scope) {
    var els = (scope || root.document).querySelectorAll('[data-icon]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], svg = icon(el.getAttribute('data-icon'), el.getAttribute('data-size') || 24,
        { weight: +el.getAttribute('data-weight') || 0 });
      if (svg) el.innerHTML = svg;
    }
  }
  root.CHADIcons = { icon: icon, mount: mount, names: Object.keys(I).concat(Object.keys(ALIAS)) };
})(window);
