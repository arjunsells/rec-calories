/* CHAD v5 — sprites.js · pixel-art SVG sprites built from 12x12 text grids.
   window.CHADSprites.sprite(name, size) -> SVG markup string.
   window.CHADSprites.mount(root)        -> fills every <i data-sprite="flame" data-size="24"></i>.
   window.CHADSprites.names              -> list of sprite names.
   Colours: "#" = currentColor (set CSS `color` on the parent); letters map to
   theme.css variables with hard-coded fallbacks so sprites work without it. */
(function (root) {
  'use strict';

  var PAL = {
    '#': 'currentColor',
    g: 'var(--ch-gold,#f3c466)',
    d: 'var(--ch-gold-deep,#B0894C)',
    y: 'var(--ch-yellow,#ffd94a)',
    o: 'var(--ch-orange,#ff9a3d)',
    r: 'var(--ch-red,#ff4f6e)',
    c: 'var(--ch-cyan,#35e9ff)',
    m: 'var(--ch-magenta,#ff3dcb)',
    n: 'var(--ch-green,#39ff9a)',
    w: 'var(--ch-sprite-hi,#fff)',
    k: 'var(--ch-ink,#04050c)',
    b: 'var(--ch-cyan,#35e9ff)'
  };
  var ALPHA = { b: 0.45 };

  var G = {
    flame: [
      '.....r......',
      '....rr......',
      '....rrr.....',
      '...rrrr..r..',
      '..rroorr.rr.',
      '..rooorrrr..',
      '.rrooyorrr..',
      '.rroyyoorr..',
      '.rroyyyorr..',
      '.rroywyorr..',
      '..rroyyorr..',
      '...rrrrr....'],
    check: [
      '............',
      '..........##',
      '.........###',
      '........###.',
      '.......###..',
      '##....###...',
      '###..###....',
      '.######.....',
      '..####......',
      '...##.......',
      '............',
      '............'],
    star: [
      '.....yy.....',
      '.....yy.....',
      '....yyyy....',
      'yyyyywyyyyyy',
      '.yyywyyyyyy.',
      '..yyyyyyyy..',
      '...yyyyyy...',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '.yyyy..yyyy.',
      '.yy......yy.',
      '............'],
    trophy: [
      '..gggggggg..',
      'gggggggggggg',
      'g.gwgggggg.g',
      'g.gwgggggg.g',
      '.ggwggggggg.',
      '..gggggggg..',
      '...gggggg...',
      '....gggg....',
      '.....dd.....',
      '.....dd.....',
      '...dddddd...',
      '..dddddddd..'],
    heart: [
      '............',
      '.rrr...rrr..',
      'rrrrr.rrrrr.',
      'rwwrrrrrrrr.',
      'rwrrrrrrrrr.',
      'rrrrrrrrrrr.',
      '.rrrrrrrrr..',
      '..rrrrrrr...',
      '...rrrrr....',
      '....rrr.....',
      '.....r......',
      '............'],
    coin: [
      '...dddddd...',
      '..dggggggd..',
      '.dggwddgggd.',
      'dggwgddggggd',
      'dggwgddggggd',
      'dggwgddggggd',
      'dggggddggggd',
      'dggggddggggd',
      'dggggddggggd',
      '.dgggddgggd.',
      '..dggggggd..',
      '...dddddd...'],
    water: [
      '....cccc....',
      '....cccc....',
      '.....cc.....',
      '...cccccc...',
      '..c......c..',
      '..c......c..',
      '..cbbbbbbc..',
      '..cbwbbbbc..',
      '..cbwbbbbc..',
      '..cbbbbbbc..',
      '..cbbbbbbc..',
      '...cccccc...'],
    chest: [
      '............',
      '............',
      '.####..####.',
      '#####..#####',
      '#####..#####',
      '#####..#####',
      '#####..#####',
      '.####..####.',
      '..###..###..',
      '............',
      '............',
      '............'],
    back: [
      '............',
      '#####..#####',
      '#####..#####',
      '#####..#####',
      '.####..####.',
      '.####..####.',
      '..###..###..',
      '..###..###..',
      '...##..##...',
      '...##..##...',
      '....#..#....',
      '............'],
    shoulders: [
      '............',
      '....####....',
      '....####....',
      '....####....',
      '.###.##.###.',
      '#####..#####',
      '#####..#####',
      '###......###',
      '###......###',
      '.#........#.',
      '............',
      '............'],
    arms: [
      '............',
      '..###.......',
      '..###.......',
      '..###.......',
      '..###..###..',
      '..###.#####.',
      '..#########.',
      '..#########.',
      '...#######..',
      '....#####...',
      '............',
      '............'],
    legs: [
      '..########..',
      '..########..',
      '..###..###..',
      '..###..###..',
      '..###..###..',
      '..###..###..',
      '..##....##..',
      '..##....##..',
      '..##....##..',
      '..##....##..',
      '.###....###.',
      '.###....###.'],
    abs: [
      '............',
      '..###..###..',
      '..###..###..',
      '............',
      '..###..###..',
      '..###..###..',
      '............',
      '..###..###..',
      '..###..###..',
      '............',
      '...##..##...',
      '............'],
    rest: [
      '....####....',
      '..####......',
      '.####.......',
      '.###....ccc.',
      '###.......c.',
      '###......c..',
      '###.....ccc.',
      '.###........',
      '.####.....#.',
      '..#####.###.',
      '....#####...',
      '............'],
    glove: [
      '...rrrrr....',
      '..rrrrrrr...',
      '.rrwrrrrrr..',
      '.rrwrrrrrrr.',
      '.rrrrrrrrrr.',
      '.rrrrrrrrrr.',
      '.rrrrrrrrr..',
      '..rrrrrrr...',
      '..rrrrrr....',
      '..wwwwww....',
      '..rrrrrr....',
      '..rrrrrr....'],
    'badge-shield': [
      '.dddddddddd.',
      '.dggggggggd.',
      '.dgggwwgggd.',
      '.dgggwwgggd.',
      '.dgwwwwwwgd.',
      '.dgwwwwwwgd.',
      '.dgggwwgggd.',
      '.dgggwwgggd.',
      '..dggggggd..',
      '...dggggd...',
      '....dggd....',
      '.....dd.....'],
    'badge-medal': [
      '..mm....mm..',
      '..mmm..mmm..',
      '...mm..mm...',
      '...mmmmmm...',
      '....dddd....',
      '...dggggd...',
      '..dggwgggd..',
      '..dgwggggd..',
      '..dggggggd..',
      '..dggggggd..',
      '...dggggd...',
      '....dddd....'],
    'badge-crown': [
      '............',
      '............',
      'g....gg....g',
      'g....gg....g',
      'gg..gggg..gg',
      'ggg.gggg.ggg',
      'gggggggggggg',
      'gggggggggggg',
      'gmggcggcggmg',
      'gggggggggggg',
      'dddddddddddd',
      '............'],
    'badge-bolt': [
      '......yyyy..',
      '.....yyyy...',
      '....yyyy....',
      '...yyyy.....',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '.....yyyy...',
      '....yyyy....',
      '...yyyy.....',
      '..yyy.......',
      '..yy........',
      '..y.........'],
    /* UI glyphs (tab bar etc.) */
    today: [
      '............',
      '..#......#..',
      '############',
      '############',
      '#..........#',
      '#.##.##.##.#',
      '#..........#',
      '#.##.##.##.#',
      '#..........#',
      '#.##.##....#',
      '############',
      '............'],
    training: [
      '............',
      '............',
      '.##......##.',
      '.##......##.',
      '###......###',
      '############',
      '############',
      '###......###',
      '.##......##.',
      '.##......##.',
      '............',
      '............'],
    progress: [
      '............',
      '.........##.',
      '.........##.',
      '.....##..##.',
      '.....##..##.',
      '.....##..##.',
      '.##..##..##.',
      '.##..##..##.',
      '.##..##..##.',
      '.##..##..##.',
      '############',
      '............'],
    settings: [
      '.....##.....',
      '.#..####..#.',
      '.##########.',
      '..###..###..',
      '.###....###.',
      '###......###',
      '###......###',
      '.###....###.',
      '..###..###..',
      '.##########.',
      '.#..####..#.',
      '.....##.....'],
    camera: [
      '............',
      '...####.....',
      '.##########.',
      '############',
      '####....####',
      '###..##..###',
      '###.####.###',
      '###.####.###',
      '###..##..###',
      '####....####',
      '############',
      '............'],
    lock: [
      '............',
      '....####....',
      '...##..##...',
      '...##..##...',
      '...##..##...',
      '.##########.',
      '.##########.',
      '.####..####.',
      '.####..####.',
      '.##########.',
      '.##########.',
      '............']
  };
  // aliases
  G['muay-thai'] = G.glove;
  G.xp = G.coin;
  G.bottle = G.water;
  G.badge = G['badge-shield'];

  var cache = {};

  function paths(grid) {
    // merge horizontal runs per colour into one <path> each
    var by = {}, order = [];
    for (var y = 0; y < grid.length; y++) {
      var row = grid[y], x = 0;
      while (x < row.length) {
        var ch = row.charAt(x);
        if (ch === '.' || ch === ' ') { x++; continue; }
        var x0 = x;
        while (x < row.length && row.charAt(x) === ch) x++;
        if (!by[ch]) { by[ch] = ''; order.push(ch); }
        by[ch] += 'M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z';
      }
    }
    var out = '';
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      out += '<path fill="' + (PAL[k] || 'currentColor') + '"' +
        (ALPHA[k] ? ' fill-opacity="' + ALPHA[k] + '"' : '') + ' d="' + by[k] + '"/>';
    }
    return out;
  }

  /** sprite('flame', 32) -> '<svg …>' ; unknown names return an empty box of the same size. */
  function sprite(name, size, label) {
    size = size || 24;
    var grid = G[name];
    var w = grid ? grid[0].length : 12, h = grid ? grid.length : 12;
    var body = grid ? (cache[name] || (cache[name] = paths(grid))) : '';
    var a11y = label ? ' role="img" aria-label="' + String(label).replace(/"/g, '&quot;') + '"' : ' aria-hidden="true"';
    return '<svg class="ch-sprite" xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" focusable="false"' + a11y + '>' + body + '</svg>';
  }

  /** Replace the contents of every [data-sprite] element under root. */
  function mount(scope) {
    var els = (scope || document).querySelectorAll('[data-sprite]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.innerHTML = sprite(el.getAttribute('data-sprite'), +el.getAttribute('data-size') || 24);
    }
  }

  root.CHADSprites = { sprite: sprite, mount: mount, names: Object.keys(G), grids: G, palette: PAL };
})(typeof window !== 'undefined' ? window : this);
