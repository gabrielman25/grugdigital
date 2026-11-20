/* =====================================================================================
   GRUG JEWELRY · the engine for earrings, necklaces, purses, sandals and sound  →  window.GrugJewelry
   Earrings are a sequence of shapes and charms that hang from her ear; a necklace is a cord of any length (almost a choker
   to midway down her torso) with shapes and charms on it. Shapes are made here; charms are the Events Icon Pack pictures
   (assets/events-icons/, by gvesster) and the KIMILAND monogram. Brands: Grug Digital (any colours) and KIMILAND (always
   pastel, and pastel pink nine times in ten). Built on GrugEyewear's seeded random, colour helpers and exporters.
   ===================================================================================== */
(function () {
  'use strict';
  const GE = window.GrugEyewear, U = GE.util, { clamp, lerp, rng, hash, hsl } = U, TAU = Math.PI * 2;
  // the site's assets folder: set by the closet runtime in games (window.GRUG_ASSETS), else from where the page is
  // (labs/catalog/ or avatar/); none in the stand-alone kit, which keeps its files next to the page
  const AB = window.GRUG_ASSETS || (/\/labs\//.test(location.pathname) ? '../../assets/' : /\/avatar\//.test(location.pathname) ? '../assets/' : null), ON_SITE = !!AB;
  const ICON_BASE = ON_SITE ? AB + 'events-icons/' : 'icons/', BRAND_BASE = ON_SITE ? AB + 'brands/' : 'brands/';

  /* ---------------------------------------------------------------- colour helpers */
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const hsl2hex = (h, s, l) => { h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  // a pastel is light and soft: lightness 0.76 to 0.95
  const isPastel = c => { if (!isHex(c)) return false; const [, , l] = hsl(c); return l >= 0.75; };
  // the nearest pastel to any colour (greys and darks become a soft cream-white)
  function toPastel(c) { const [h, s, l] = hsl(c); if (s < 0.14) return l < 0.5 ? '#f4edf3' : '#fffafc'; return hsl2hex(h, clamp(s, 0.55, 0.95), clamp(0.82 + (l - 0.5) * 0.06, 0.8, 0.88)); }
  const PINKS = ['#ffd1e3', '#ffc4dc', '#ffb7d5', '#ffdcea', '#ffcce1', '#ffbfd9', '#ffd9e8', '#ffaed0'];
  const PASTEL_OTHER = { blue: '#c4e1ff', lilac: '#e0d3ff', mint: '#c6f3dd', butter: '#fff2b8', peach: '#ffd8c4', lavender: '#d8d0ff', sky: '#bfe6ff' };
  const PASTEL_ACC = ['#fffafc', '#c4e1ff', '#e0d3ff', '#fff2b8', '#c6f3dd', '#ffd8c4', '#ffe9f2'];
  const PASTEL_METALS = [['Pearl Silver', '#ebe7f2'], ['Rose Gold', '#f6cfc9'], ['Champagne', '#f4e6bd'], ['White Gold', '#f2f2f7'], ['Blush', '#ffd9e6']];
  const METALS = [['Gold', '#d4af37'], ['Silver', '#c8ccd2'], ['Rose Gold', '#e0a68f'], ['Copper', '#c3743e'], ['Bronze', '#9c6b30'], ['Gunmetal', '#50555c'], ['Black Steel', '#26272b']];
  const PASTEL_NAME = [['Bubblegum', '#ffb7d5'], ['Cotton Candy', '#ffd1e3'], ['Blush', '#ffdcea'], ['Strawberry Milk', '#ffc4dc'], ['Marshmallow', '#fffafc'], ['Baby Blue', '#c4e1ff'], ['Lilac', '#e0d3ff'], ['Lavender', '#d8d0ff'], ['Butter', '#fff2b8'], ['Mint', '#c6f3dd'], ['Peach', '#ffd8c4'], ['Sky', '#bfe6ff'], ['Taffy', '#ffaed0'], ['Sugar', '#ffe9f2']];
  const NAMED = [['Black', '#16161a'], ['Charcoal', '#3a3b40'], ['Grey', '#8a8c92'], ['White', '#f4f4f2'], ['Ivory', '#efe6cf'], ['Red', '#d62f2f'], ['Cherry', '#b0122e'], ['Coral', '#ff7a6b'], ['Orange', '#f2801f'], ['Amber', '#e8a317'], ['Yellow', '#f5d21f'], ['Lime', '#9be338'], ['Mint', '#9df2c6'], ['Green', '#2e9b48'], ['Forest', '#24452c'], ['Teal', '#14a3a0'], ['Aqua', '#4fd8e0'], ['Sky', '#7cc4ff'], ['Blue', '#2b62d9'], ['Navy', '#1b2a55'], ['Purple', '#7d3fc4'], ['Violet', '#9a5cf0'], ['Lilac', '#d6b6e8'], ['Pink', '#ff8fc2'], ['Bubblegum', '#ff6fb0'], ['Rose', '#e8344f'], ['Magenta', '#d4247f'], ['Brown', '#6b4428'], ['Gold', '#d4af37'], ['Silver', '#c8ccd2']];
  const nearest = (hex, list) => { let best = list[0], bd = 9; for (const e of list) { const dd = U.cdist(hex, e[1]); if (dd < bd) { bd = dd; best = e; } } return best[0]; };
  const colourName = (hex, pastel) => nearest(hex, pastel ? PASTEL_NAME : NAMED);

  /* ---------------------------------------------------------------- brands */
  const BRANDS = [['grug', 'Grug Digital'], ['kimiland', 'KIMILAND']];
  const BRAND_LABEL = Object.fromEntries(BRANDS);
  // a share of what the catalog makes is KIMILAND's (deterministic from the seed so a pair is always the same pair)
  const brandFor = (seed, share) => (hash(seed + '|brand') % 1000) / 1000 < (share == null ? 0.3 : share) ? 'kimiland' : 'grug';

  /* ---------------------------------------------------------------- shapes (made here) and charms (pictures) */
  const SHAPES = [['bead', 'Bead'], ['pearl', 'Pearl'], ['cube', 'Cube'], ['heart', 'Heart'], ['star', 'Star'], ['moon', 'Moon'], ['flower', 'Flower'], ['drop', 'Drop'], ['gem', 'Gem'], ['ring', 'Ring'], ['disc', 'Coin'], ['bow', 'Bow']];
  const SHAPE_LABEL = Object.fromEntries(SHAPES);
  const THREAD_SHAPES = ['bead', 'pearl', 'cube', 'disc'];   // these sit on a necklace cord like beads; the rest hang from it
  const FINISHES = [['gloss', 'Glossy'], ['matte', 'Matte'], ['metal', 'Metal']];
  const CHARM_LIST = [
    ['christmas', 'candycane', 'Candy Cane', ['red', 'white']], ['christmas', 'christmas-tree', 'Christmas Tree', ['green', 'yellow']], ['christmas', 'christmas-bag', 'Gift Bag', ['red']], ['christmas', 'christmas-ball', 'Ornament', ['red', 'white']],
    ['christmas', 'christmas-bell', 'Holly Bells', ['yellow', 'green']], ['christmas', 'gingerbread', 'Gingerbread', ['brown', 'orange']], ['christmas', 'santa-hat', 'Santa Hat', ['red', 'white']], ['christmas', 'snowflake', 'Snowflake', ['blue', 'white']],
    ['christmas', 'snowman', 'Snowman', ['white', 'teal']], ['christmas', 'winter-glove', 'Mitten', ['red']],
    ['halloween', 'bat', 'Bat', ['black']], ['halloween', 'bone', 'Bone', ['orange', 'yellow']], ['halloween', 'candycorn', 'Candy Corn', ['orange', 'yellow', 'white']], ['halloween', 'cauldron', 'Cauldron', ['grey', 'green']],
    ['halloween', 'coffin', 'Coffin', ['grey', 'blue']], ['halloween', 'ghost', 'Ghost', ['white']], ['halloween', 'pumpkin', 'Pumpkin', ['orange']], ['halloween', 'tot-bag-orange', 'Treat Bag', ['orange']],
    ['halloween', 'tot-bag-purple', 'Purple Treat Bag', ['purple']], ['halloween', 'tombstone', 'Tombstone', ['grey']],
    ['valentines', 'broken-heart', 'Broken Heart', ['red']], ['valentines', 'broken-heart-left', 'Left Heart Half', ['red']], ['valentines', 'broken-heart-right', 'Right Heart Half', ['red']], ['valentines', 'calendar', 'Feb 14', ['white', 'red']],
    ['valentines', 'heart', 'Heart', ['red']], ['valentines', 'heart-key', 'Heart Key', ['red', 'pink']], ['valentines', 'heart-with-wings', 'Winged Heart', ['red', 'white']], ['valentines', 'heart-with-an-arrow', 'Cupid Heart', ['red', 'yellow']],
    ['valentines', 'hearts', 'Heart Cluster', ['red']], ['valentines', 'letter', 'Love Letter', ['white', 'red']], ['valentines', 'rose', 'Rose', ['red', 'green']], ['valentines', 'teddy-bear', 'Teddy Bear', ['brown', 'pink']]
  ];
  const CHARMS = CHARM_LIST.map(([theme, slug, label, fam]) => ({ id: slug, theme, label, fam, src: ICON_BASE + theme + '/' + slug + '.png', outline: ICON_BASE + theme + '/' + slug + '-outline.png' }));
  CHARMS.push({ id: 'kimiland-kl', theme: 'kimiland', label: 'KIMILAND KL', fam: ['pink', 'blue'], src: BRAND_BASE + 'kimiland-kl.png', outline: BRAND_BASE + 'kimiland-kl.png', brand: 'kimiland', noOutline: true });
  const CHARM_BY = Object.fromEntries(CHARMS.map(c => [c.id, c]));
  const THEME_LABEL = { christmas: 'Christmas', halloween: 'Halloween', valentines: "Valentine's Day", kimiland: 'KIMILAND' };
  // the pictures that read cutest as KIMILAND charms (all of them work: they're washed pastel)
  const KIMI_CHARMS = ['heart', 'hearts', 'rose', 'teddy-bear', 'letter', 'heart-with-wings', 'heart-key', 'heart-with-an-arrow', 'snowflake', 'candycane', 'ghost', 'santa-hat', 'christmas-ball', 'gingerbread', 'snowman', 'christmas-bell', 'bat', 'pumpkin', 'kimiland-kl', 'calendar'];

  const IMG = {}; let readyP = null;
  const loadImg = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  // the pattern pack (Kenney, CC0): 168 black-and-white tiles in one picture, read once into plain brightness values
  const PAT = { n: 0, cols: 14, T: 64, w: 0, lum: null };
  async function loadPatterns() { const P = window.GRUG_PATTERNS; if (!P || PAT.lum) return; try { const img = await loadImg(P.src), cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); const D = x.getImageData(0, 0, cv.width, cv.height).data, L = new Uint8Array(cv.width * cv.height); for (let i = 0; i < L.length; i++) L[i] = D[i * 4]; Object.assign(PAT, { n: P.n, cols: P.cols, T: P.tile, w: cv.width, lum: L, img }); } catch (e) { console.warn('patterns', e); } }
  function ready() { if (!readyP) readyP = Promise.all([loadPatterns(), loadSwords()].concat(CHARMS.map(async c => { c.img = await loadImg(c.src); c.imgO = c.noOutline ? c.img : await loadImg(c.outline); IMG[c.id] = c; }))); return readyP; }

  // a charm's picture as a texture, plain or outlined, left as drawn or washed with a colour ('pastel' = washed soft)
  const texCache = new Map();
  function charmTexture(id, outline, tint) {
    const key = id + '|' + (outline ? 1 : 0) + '|' + (tint || ''); if (texCache.has(key)) return texCache.get(key);
    const c = CHARM_BY[id] || CHARMS[0], im = outline ? c.imgO : c.img, cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
    if (im) cx.drawImage(im, 0, 0, 256, 256);
    if (tint) {
      // wash: lighten toward white, then lay the colour over it, only where the picture is
      cx.globalCompositeOperation = 'source-atop';
      if (tint.startsWith('#')) { cx.fillStyle = 'rgba(255,255,255,0.5)'; cx.fillRect(0, 0, 256, 256); const [r, g, b] = hex2rgb(tint); cx.fillStyle = `rgba(${r},${g},${b},0.42)`; cx.fillRect(0, 0, 256, 256); }
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.userData.canvas = cv; texCache.set(key, t); return t;
  }

  /* ---------------------------------------------------------------- themes (what a roll draws from) */
  const THEMES = {
    valentines: { label: "Valentine's", cols: ['#e8344f', '#ff6fa8', '#ffc2d6', '#fff0f4', '#8b1e3f', '#d4af37'], charm: 'valentines', metal: ['#d4af37', '#e0a68f', '#c8ccd2'] },
    christmas: { label: 'Christmas', cols: ['#c8232c', '#1f8a4c', '#f4f4f2', '#d4af37', '#14573a', '#ff8a8a'], charm: 'christmas', metal: ['#d4af37', '#c8ccd2'] },
    halloween: { label: 'Halloween', cols: ['#f2801f', '#7d3fc4', '#16161a', '#9be338', '#f4f4f2', '#3a2a55'], charm: 'halloween', metal: ['#c8ccd2', '#50555c', '#c3743e'] },
    sweet: { label: 'Sweet', cols: ['#ff6fb0', '#7cc4ff', '#fff36a', '#9df2c6', '#ffffff', '#c4a8f5'], charm: 'valentines', metal: ['#d4af37', '#c8ccd2', '#e0a68f'] },
    classic: { label: 'Classic', cols: ['#fff6f2', '#d4af37', '#16161a', '#1b2a55', '#c8ccd2', '#8a1c2b'], charm: null, metal: ['#d4af37', '#c8ccd2', '#e0a68f', '#26272b'] },
    ocean: { label: 'Ocean', cols: ['#14a3a0', '#4fd8e0', '#2b62d9', '#fff6f2', '#1b2a55', '#9df2c6'], charm: null, metal: ['#c8ccd2', '#d4af37'] },
    forest: { label: 'Forest', cols: ['#2e9b48', '#24452c', '#9be338', '#c98a2b', '#6b4428', '#efe6cf'], charm: null, metal: ['#c3743e', '#9c6b30', '#d4af37'] },
    night: { label: 'Night', cols: ['#7d3fc4', '#1b2a55', '#16161a', '#c4a8f5', '#f5d21f', '#4fd8e0'], charm: 'halloween', metal: ['#c8ccd2', '#50555c', '#d4af37'] }
  };

  /* ---------------------------------------------------------------- designs */
  const EL = (o) => Object.assign({ k: 'shape', id: 'bead', size: 1, col: '#ff8fc2', finish: 'gloss', outline: true, tint: '', mode: 'hang', at: 0, drop: 2 }, o);
  const DEF = {
    earrings: () => ({ v: 1, brand: 'grug', mount: 'stud', metal: '#d4af37', link: 'fine', gap: 0.6, pair: 'match', seq: [EL({ id: 'pearl', size: 1, col: '#fff6f2' }), EL({ id: 'heart', size: 1.6, col: '#e8344f' })] }),
    necklaces: () => ({ v: 1, brand: 'grug', len: 0.3, cord: 'chain', cordCol: '#d4af37', cord2: '#fff6f2', thick: 0.35, alt: false, items: [EL({ id: 'heart', size: 2.2, col: '#e8344f', at: 0 })] })
  };
  const MOUNTS = [['stud', 'Stud'], ['hook', 'Hook']];
  const LINKS = [['none', 'None'], ['fine', 'Fine chain'], ['beaded', 'Beaded']];
  const PAIRS = [['match', 'Matching'], ['mismatch', 'Mismatched']];
  const CORDS = [['chain', 'Chain'], ['cord', 'Cord'], ['ribbon', 'Ribbon'], ['beads', 'Beads'], ['pearls', 'Pearls']];
  const KE = 1.45;   // her head is big and round: earrings are drawn this much larger than their size says, so they read
  const LIMITS = { earrings: { n: 6, maxLen: 9.5 }, necklaces: { n: 10 } };
  const KT = 1.6, KN = 1.25;   // cords and charms are drawn a little bolder than their numbers say, so they read on her
  const D_MAX = 26;   // cm below the neck at len = 1: midway down her torso
  const depthOf = len => 0.8 + (D_MAX - 0.8) * Math.pow(clamp(len, 0, 1), 1.25);
  const LEN_CLASS = [[3.5, 'choker', 'Choker'], [9, 'short', 'Short'], [16, 'medium', 'Medium'], [99, 'long', 'Long']];
  const lenClass = d => { const D = depthOf(d.len); for (const [mx, id, label] of LEN_CLASS) if (D < mx) return { id, label }; return { id: 'long', label: 'Long' }; };
  const lenLabel = len => { const D = depthOf(len), c = lenClass({ len }); return len >= 0.97 ? 'Mid-torso' : c.label; };

  const elSize = (e) => e.k === 'charm' ? e.size : e.size;
  function cleanEl(e, dept, notes) {
    const o = EL(e || {}); o.k = o.k === 'charm' ? 'charm' : 'shape';
    if (o.k === 'charm') { if (!CHARM_BY[o.id]) o.id = 'heart'; } else if (!SHAPE_LABEL[o.id]) o.id = 'bead';
    o.size = clamp(+o.size || 1, 0.5, dept === 'earrings' ? 4 : 5); o.at = clamp(+o.at || 0, -1, 1);
    if (!isHex(o.col)) o.col = '#ff8fc2'; if (!FINISHES.some(f => f[0] === o.finish)) o.finish = 'gloss';
    o.outline = o.outline !== false; o.tint = o.tint === 'pastel' ? 'pastel' : isHex(o.tint) ? o.tint : '';
    o.mode = o.mode === 'thread' ? 'thread' : 'hang'; o.drop = clamp(+o.drop || 2, 0.4, 9); return o;
  }
  const elH = e => e.k === 'charm' ? e.size : ({ drop: 1.3, gem: 1.15, ring: 0.95, bow: 0.65, moon: 1, heart: 1, star: 1 }[e.id] || 1) * e.size;
  // washes a colour to a pastel when the item is KIMILAND's
  function kimiEl(e, pal) { e.col = isPastel(e.col) ? e.col : toPastel(e.col); if (e.k === 'charm' && !CHARM_BY[e.id].brand) e.tint = (e.tint && isPastel(e.tint)) ? e.tint : pal.tint; if (e.k === 'charm' && CHARM_BY[e.id].brand) e.tint = ''; return e; }
  function validate(dept, src, brand) {
    const notes = [], d = Object.assign(DEF[dept](), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!isHex(d.metal) && dept === 'earrings') d.metal = '#d4af37';
    d.seq = (d.seq || []).slice(0, LIMITS.earrings.n).map(e => cleanEl(e, 'earrings'));
    if (dept === 'earrings') {
      if (!d.seq.length) d.seq = DEF.earrings().seq;
      if (!MOUNTS.some(m => m[0] === d.mount)) d.mount = 'stud'; if (!LINKS.some(m => m[0] === d.link)) d.link = 'fine'; if (!PAIRS.some(m => m[0] === d.pair)) d.pair = 'match';
      d.gap = clamp(+d.gap || 0.6, 0.15, 3);
      // they hang clear of her shoulders: shorten the whole hang if it runs long
      const tot = () => d.seq.reduce((s, e, i) => s + elH(e) + (i ? d.gap : 0), 0) - (d.mount === 'stud' ? elH(d.seq[0]) * 0.5 : 0);
      let k = 0; while (tot() > LIMITS.earrings.maxLen && k++ < 8) { d.gap = Math.max(0.15, d.gap * 0.7); if (tot() > LIMITS.earrings.maxLen) for (const e of d.seq) e.size = Math.max(0.5, e.size * 0.92); if (!notes.length) notes.push('Shortened so they clear her shoulders'); }
      delete d.items; delete d.cord;
    } else {
      d.items = (d.items || d.seq || []).slice(0, LIMITS.necklaces.n).map(e => cleanEl(e, 'necklaces')); delete d.seq;
      if (!d.items.length) d.items = [EL({ id: 'pearl', size: 1.2, col: '#fff6f2', mode: 'thread' })];
      d.len = clamp(+d.len, 0, 1); if (!isFinite(d.len)) d.len = 0.3;
      if (!CORDS.some(m => m[0] === d.cord)) d.cord = 'chain'; if (!isHex(d.cordCol)) d.cordCol = '#d4af37'; if (!isHex(d.cord2)) d.cord2 = '#fff6f2';
      d.thick = clamp(+d.thick || 0.3, 0.1, 1.4); d.alt = !!d.alt;
      if (d.cord === 'ribbon') d.thick = clamp(d.thick, 0.5, 1.4); else if (d.cord === 'beads' || d.cord === 'pearls') d.thick = clamp(d.thick, 0.3, 0.9); else d.thick = Math.min(d.thick, 0.6);
      delete d.mount; delete d.pair; delete d.link; delete d.gap; delete d.metal;
    }
    // KIMILAND is always pastel: whatever was picked is brought to the nearest pastel
    if (d.brand === 'kimiland') {
      const pal = { tint: PINKS[0] };
      for (const e of (d.seq || d.items)) kimiEl(e, { tint: isPastel(e.col) ? e.col : toPastel(e.col) });
      if (dept === 'earrings') { if (!isPastel(d.metal)) { d.metal = toPastel(d.metal); notes.push('Brought to KIMILAND pastels'); } }
      else { if (!isPastel(d.cordCol)) { d.cordCol = toPastel(d.cordCol); notes.push('Brought to KIMILAND pastels'); } if (!isPastel(d.cord2)) d.cord2 = toPastel(d.cord2); }
    }
    return { d, notes };
  }

  /* ---------------------------------------------------------------- random */
  function kimiPalette(r) {
    const pink = r.chance(0.9), main = pink ? r.pick(PINKS) : r.pick(Object.values(PASTEL_OTHER));
    const acc = pink ? [r.pick(PINKS), '#fffafc', r.pick(PINKS)] : [main, '#fffafc', r.pick(Object.values(PASTEL_OTHER))];
    return { pink, main, mains: pink ? [main, r.pick(PINKS), r.pick(PINKS)] : [main, main], acc, metal: pink ? r.pick(['#ffd9e6', '#f6cfc9', '#ebe7f2']) : r.pick(PASTEL_METALS)[1], tint: main };
  }
  function pickCharm(r, theme, kimi) {
    if (kimi) return r.pick(KIMI_CHARMS);
    const T = THEMES[theme], pool = (T && T.charm) ? CHARMS.filter(c => c.theme === T.charm && !c.brand) : CHARMS.filter(c => !c.brand);
    return r.pick(pool).id;
  }
  function randomEl(r, dept, theme, pal, kimi, o) {
    o = o || {}; const T = THEMES[theme] || THEMES.classic, charmy = o.charm != null ? o.charm : r.chance(kimi ? 0.55 : T.charm ? 0.55 : 0.3);
    const cols = kimi ? [pal.main].concat(pal.mains, pal.acc) : T.cols;
    if (charmy) { const id = pickCharm(r, theme, kimi), c = CHARM_BY[id]; return EL({ k: 'charm', id, size: dept === 'earrings' ? r.f(1.3, 2.4) : r.f(1.8, 3.4), outline: c.noOutline ? false : r.chance(0.6), tint: kimi && !c.brand ? (pal.pink ? pal.main : r.pick(pal.mains)) : '', col: r.pick(cols), mode: 'hang' }); }
    const id = r.w({ bead: 3, pearl: 2, cube: 1, heart: 2.2, star: 1.6, moon: 1, flower: 1.2, drop: 1.4, gem: 1.4, ring: 1, disc: 0.8, bow: 0.8 });
    const col = id === 'pearl' ? (kimi ? '#fffafc' : '#fff6f2') : r.pick(cols);
    return EL({ k: 'shape', id, size: (dept === 'earrings' ? r.f(0.7, 1.7) : r.f(0.9, 2.4)) * (id === 'bead' || id === 'pearl' ? 0.8 : 1), col, finish: r.w({ gloss: 5, matte: 1.5, metal: kimi ? 0.5 : 1.5 }), mode: THREAD_SHAPES.includes(id) ? 'thread' : 'hang' });
  }
  // random(dept, seed, { brand, keep: 'colours'|'shape', base, kind })
  function random(dept, seed, o) {
    o = o || {}; const r = rng('jewel:' + dept + ':' + seed), brand = o.brand || brandFor(seed), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ valentines: 2, christmas: 2, halloween: 2, sweet: 1.5, classic: 3, ocean: 1, forest: 1, night: 1.2 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.pick(T.cols);
    const metal = kimi ? pal.metal : r.pick(T.metal);
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF[dept]();
    d.brand = brand;
    const recolour = () => { const list = d.seq || d.items; for (const e of list) { if (e.k === 'shape') e.col = e.id === 'pearl' ? (kimi ? '#fffafc' : '#fff6f2') : pick(); if (e.k === 'charm') { const c = CHARM_BY[e.id]; e.tint = kimi && !c.brand ? (pal.pink ? pal.main : r.pick(pal.mains)) : ''; } } if (dept === 'earrings') d.metal = metal; else { d.cordCol = d.cord === 'beads' || d.cord === 'pearls' ? pick() : (kimi ? pal.metal : metal); d.cord2 = kimi ? '#fffafc' : '#fff6f2'; } };
    if (o.keep === 'shape') { recolour(); return validate(dept, d, brand).d; }
    if (dept === 'earrings') {
      const kind = o.kind || r.w({ studs: 2, drops: 4, danglers: 3, hoops: 1.2 });
      d.mount = kind === 'studs' ? 'stud' : kind === 'hoops' ? 'hook' : r.pick(['stud', 'hook', 'hook']); d.link = r.w({ none: 1, fine: 4, beaded: 1.5 }); d.gap = r.f(0.3, 1.3); d.pair = r.chance(0.12) ? 'mismatch' : 'match';
      const n = kind === 'studs' ? 1 : kind === 'drops' ? r.i(2, 3) : kind === 'hoops' ? 1 : r.i(3, 5);
      d.seq = []; for (let i = 0; i < n; i++) { const e = kind === 'hoops' ? EL({ k: 'shape', id: 'ring', size: r.f(1.8, 3.4), col: pick(), finish: r.chance(0.7) ? 'metal' : 'gloss' }) : randomEl(r, dept, theme, pal, kimi, kind === 'studs' ? { charm: r.chance(0.35) } : i === 0 ? { charm: false } : {}); if (kind !== 'hoops' && i === 0 && d.mount === 'stud' && (e.id === 'drop' || e.id === 'bow')) e.id = 'bead'; if (kind === 'danglers' || kind === 'drops') e.size *= lerp(1, 0.8, i / Math.max(1, n - 1)); d.seq.push(e); }
      d.metal = metal;
    } else {
      d.len = o.kind === 'choker' ? r.f(0, 0.07) : o.kind === 'short' ? r.f(0.12, 0.3) : o.kind === 'medium' ? r.f(0.35, 0.58) : o.kind === 'long' ? r.f(0.62, 1) : r.w({ a: 2, b: 3, c: 2.4, d: 2.4 }) === 'a' ? r.f(0, 0.08) : r.pick([r.f(0.12, 0.3), r.f(0.35, 0.58), r.f(0.62, 1)]);
      d.cord = r.w({ chain: 4, cord: 2, ribbon: 1.6, beads: 1.6, pearls: 1.6 });
      d.thick = d.cord === 'ribbon' ? r.f(0.6, 1.2) : d.cord === 'beads' || d.cord === 'pearls' ? r.f(0.4, 0.7) : r.f(0.18, 0.45);
      d.cordCol = d.cord === 'pearls' ? (kimi ? '#fffafc' : '#fff6f2') : d.cord === 'chain' ? metal : pick(); d.cord2 = kimi ? '#fffafc' : r.pick(['#fff6f2', pick()]); d.alt = (d.cord === 'beads') && r.chance(0.6);
      const style = r.w({ pendant: 4, charms: 3, spread: 2 });
      const n = style === 'pendant' ? 1 : style === 'charms' ? r.i(2, 4) : r.i(3, 7);
      d.items = [];
      for (let i = 0; i < n; i++) {
        const e = randomEl(r, dept, theme, pal, kimi, style === 'pendant' ? { charm: r.chance(0.6) } : {});
        e.at = style === 'pendant' ? 0 : style === 'charms' ? (n === 1 ? 0 : lerp(-0.45, 0.45, i / (n - 1))) : (n === 1 ? 0 : lerp(-0.85, 0.85, i / (n - 1)));
        if (style === 'spread') { e.size *= 0.7; if (!THREAD_SHAPES.includes(e.id) && e.k === 'shape') e.mode = r.chance(0.5) ? 'hang' : 'thread'; }
        if (style === 'pendant') e.size *= 1.15; d.items.push(e);
      }
      if (style === 'pendant' && d.len < 0.1) d.len = r.f(0.12, 0.4);   // a pendant needs a little drop to hang from
    }
    if (o.keep === 'colours' && o.base) { const bl = o.base.seq || o.base.items, nl = d.seq || d.items; nl.forEach((e, i) => { const b = bl[i % bl.length]; if (e.k === 'shape') e.col = b.col; else if (!CHARM_BY[e.id].brand) e.tint = b.tint || ''; }); if (dept === 'earrings') d.metal = o.base.metal; else { d.cordCol = o.base.cordCol; d.cord2 = o.base.cord2; } }
    return validate(dept, d, brand).d;
  }

  /* ---------------------------------------------------------------- vocabulary: kinds, names, tags, specs */
  const earKind = d => d.seq.length === 1 ? (d.seq[0].id === 'ring' && d.seq[0].k === 'shape' ? 'hoops' : 'studs') : d.seq.length <= 3 ? 'drops' : 'danglers';
  const KIND_LABEL = { beanie: 'Beanies', beret: 'Berets', bucketHat: 'Bucket hats', cap: 'Caps', cowboyHat: 'Cowboy hats', sunHat: 'Sun hats', topHat: 'Top hats', witchHat: 'Witch hats', studs: 'Studs', drops: 'Drops', danglers: 'Danglers', hoops: 'Hoops', choker: 'Chokers', short: 'Short', medium: 'Medium', long: 'Long', satchel: 'Satchels', tote: 'Totes', bucket: 'Buckets', round: 'Rounds', heart: 'Hearts', clutch: 'Clutches', slide: 'Slides', thong: 'Thongs', ankle: 'Ankle straps', gladiator: 'Gladiators', wrap: 'Wraps', slipper: 'Slippers', over: 'Headphones', muffs: 'Earmuffs', buds: 'Earbuds', back1: 'One sword', back2: 'Two swords', hip: 'Hip sword', shirts: 'Shirts', sweaters: 'Sweaters and hoodies', jackets: 'Jackets', trousers: 'Trousers', shorts: 'Shorts', skirts: 'Skirts', sneakers: 'Sneakers', boots: 'Boots', outfits: 'Outfits' };
  const kindOf = (dept, d) => dept === 'earrings' ? earKind(d) : lenClass(d).id;
  const elName = e => e.k === 'charm' ? CHARM_BY[e.id].label : SHAPE_LABEL[e.id];
  const FLAVOUR = ['Cute', 'Fancy', 'Dainty', 'Glam', 'Posh', 'Sparkly', 'Merry', 'Spooky', 'Lovely', 'Bold', 'Sweet', 'Chic', 'Jolly', 'Charming', 'Darling', 'Lucky', 'Super', 'Pretty', 'Royal', 'Magic'];
  const KIMI_FLAVOUR = ['Kimi', 'Cutie', 'Sweetie', 'Dreamy', 'Sugar', 'Fluffy', 'Pretty', 'Cloud', 'Candy', 'Cozy', 'Fairy', 'Tiny'];
  function mainEl(list) { const cnt = new Map(); for (const e of list) { const k = e.k + ':' + e.id; cnt.set(k, (cnt.get(k) || 0) + 1); } let best = list[0], bn = 0; for (const e of list) { const n = cnt.get(e.k + ':' + e.id) + (e.k === 'charm' ? 0.5 : 0) + e.size * 0.01; if (n > bn) { bn = n; best = e; } } return best; }
  function nameFor(dept, d, seed) {
    const r = rng('jname:' + seed + ':' + dept), kimi = d.brand === 'kimiland', list = d.seq || d.items, m = mainEl(list), subject = elName(m);
    const colour = kimi ? colourName(m.tint && m.tint.startsWith('#') ? m.tint : m.col, true) : colourName(m.col);
    const fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(FLAVOUR);
    let noun;
    if (dept === 'earrings') { const k = earKind(d); noun = { studs: r.pick(['Studs', 'Studs', 'Stud Earrings']), drops: r.pick(['Drops', 'Drop Earrings', 'Dangles']), danglers: r.pick(['Danglers', 'Chandeliers', 'Long Dangles', 'Charm Strands']), hoops: r.pick(['Hoops', 'Hoop Earrings', 'Rings']) }[k]; }
    else { const c = lenClass(d).id; const cw = { chain: 'Chain', cord: 'Cord', ribbon: 'Ribbon', beads: 'Beaded', pearls: 'Pearl' }[d.cord]; noun = { choker: r.pick(['Choker', 'Collar', cw + ' Choker']), short: r.pick(['Necklace', 'Pendant', 'Charm Necklace']), medium: r.pick(['Necklace', 'Pendant Necklace', 'Lariat']), long: r.pick(['Long Chain', 'Long Necklace', 'Sautoir', 'Charm Chain']) }[c]; if (d.cord === 'pearls' && c !== 'choker') noun = 'Pearl ' + noun; if (d.cord === 'beads' && c !== 'choker') noun = 'Beaded ' + noun; }
    const subj = (list.length > 3 && dept === 'necklaces' && r.chance(0.5)) ? 'Charm' : subject;
    const form = r.pick([0, 1, 2, 3]);
    if (kimi) return [[colour, subj, noun], [fl, subj, noun], [fl, colour, noun], [subj, noun]][form].join(' ');
    return [[colour, subj, noun], [fl, subj, noun], [subj, noun], [fl, colour, noun]][form].join(' ');
  }
  function tagsFor(dept, d) {
    const t = [dept === 'earrings' ? 'Earrings' : 'Necklace', KIND_LABEL[kindOf(dept, d)]], list = d.seq || d.items, themes = new Set(list.filter(e => e.k === 'charm').map(e => CHARM_BY[e.id].theme));
    for (const th of themes) t.push(THEME_LABEL[th]); if (themes.size) t.push('Charms'); if (list.some(e => e.k === 'shape')) t.push('Shapes');
    if (dept === 'necklaces') t.push({ chain: 'Chain', cord: 'Cord', ribbon: 'Ribbon', beads: 'Beads', pearls: 'Pearls' }[d.cord]); else { t.push(d.mount === 'stud' ? 'Stud' : 'Hook'); if (d.pair === 'mismatch') t.push('Mismatched'); }
    if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  const famOfHex = hex => { const [h, s, l] = hsl(hex); if (l < 0.15) return 'black'; if (s < 0.16) return l > 0.86 ? 'white' : l < 0.22 ? 'black' : 'grey'; if (l > 0.93) return 'white'; if (h < 12 || h >= 340) return l > 0.68 ? 'pink' : 'red'; if (h < 38) return l < 0.42 || s < 0.45 ? 'brown' : 'orange'; if (h < 66) return l < 0.36 ? 'brown' : 'yellow'; if (h < 165) return 'green'; if (h < 196) return 'teal'; if (h < 252) return 'blue'; if (h < 292) return 'purple'; return 'pink'; };
  function families(dept, d) {
    const f = new Set(), list = d.seq || d.items;
    for (const e of list) { if (e.k === 'shape') f.add(famOfHex(e.col)); else { const c = CHARM_BY[e.id]; if (e.tint) f.add(famOfHex(e.tint === 'pastel' ? '#ffc4dc' : e.tint)); else for (const x of c.fam) f.add(x); } }
    if (dept === 'earrings') { if (d.link !== 'none' || d.mount === 'hook') f.add(famOfHex(d.metal)); } else { f.add(famOfHex(d.cordCol)); if (d.alt) f.add(famOfHex(d.cord2)); }
    if (f.size > 3) f.add('multi'); return f;
  }
  function describe(dept, d) {
    const list = d.seq || d.items, names = list.map(elName).map(s => s.toLowerCase()), uniq = Array.from(new Set(names)), brand = d.brand === 'kimiland' ? ' A KIMILAND piece: soft pastels, made to be cute.' : '';
    const nlist = uniq.length > 1 ? uniq.slice(0, -1).join(', ') + ' and ' + uniq[uniq.length - 1] : uniq[0];
    if (dept === 'earrings') return `${d.pair === 'mismatch' ? 'A mismatched pair' : 'A matching pair'} of ${earKind(d)} on a ${d.mount === 'stud' ? 'stud' : 'hook'}: ${nlist}${d.link === 'none' ? '' : ', ' + (d.link === 'fine' ? 'on fine chain' : 'on beaded chain')} in ${colourName(d.metal, d.brand === 'kimiland').toLowerCase()} metal.${brand}`;
    const c = lenClass(d), cord = { chain: 'chain', cord: 'cord', ribbon: 'ribbon', beads: 'beaded cord', pearls: 'pearl strand' }[d.cord];
    return `A ${c.label.toLowerCase()} ${cord} necklace${d.len >= 0.97 ? ' that falls to the middle of her torso' : ''} with ${nlist}.${brand}`;
  }

  /* ---------------------------------------------------------------- the body (for necklaces): front and back surfaces of her neck and chest */
  const FLD = { X0: -18, X1: 18, Y0: 95, Y1: 170, S: 0.5 };
  // her dress has a stiff ruffle over the chest that a necklace would sink into: it's put away while a necklace is on her
  function ruffleOf(sandy) {
    if (sandy.__ruffle !== undefined) return sandy.__ruffle; let found = null;
    sandy.object3d.updateMatrixWorld(true);
    sandy.object3d.traverse(o => { if (!found && o.isMesh && !o.name && !o.isSkinnedMesh && o.parent && o.parent.name === 'spine_M_03_jnt' && new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).x > 25) found = o; });
    return (sandy.__ruffle = found);
  }
  const DRESS_Y = 114;   // while a necklace is on, the dress is cut away above this height (its stiff ruffle would swallow the cord)
  function bodyField(sandy) {
    if (sandy.__jfield) return sandy.__jfield;
    sandy.object3d.updateMatrixWorld(true);
    const { X0, X1, Y0, Y1, S } = FLD, NX = Math.round((X1 - X0) / S) + 1, NY = Math.round((Y1 - Y0) / S) + 1, zF = new Float32Array(NX * NY).fill(-1e9), zB = new Float32Array(NX * NY).fill(1e9), q = new THREE.Vector3();
    const hairM = sandy.n3.hairMesh, hv = hairM && hairM.visible; if (hairM) hairM.visible = false;
    sandy.object3d.traverse(o => {
      if (!o.isMesh || !o.visible) return; for (let a = o; a; a = a.parent) if (a.userData && a.userData.catalogItem) return;
      const skinned = o.isSkinnedMesh && o.boneTransform; if (!skinned && (o.name || o.isSkinnedMesh)) return;   // her body and her clothes (the plain unnamed meshes), not her head, eyes or hands
      if (skinned) o.skeleton.update();
      const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count, W = new Array(P.count);
      const get = i => W[i] || (W[i] = (skinned ? o.boneTransform(i, new THREE.Vector3().fromBufferAttribute(P, i)) : new THREE.Vector3().fromBufferAttribute(P, i)).applyMatrix4(o.matrixWorld));
      for (let k = 0; k < n; k += 3) {
        const a = get(I ? I.getX(k) : k), b = get(I ? I.getX(k + 1) : k + 1), c = get(I ? I.getX(k + 2) : k + 2), L = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)), m = Math.min(40, Math.max(1, Math.ceil(L / 0.3)));
        for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) { const s = i / m, t = j / m; q.copy(a).multiplyScalar(1 - s - t).addScaledVector(b, s).addScaledVector(c, t); if (q.x < X0 || q.x > X1 || q.y < Y0 || q.y > Y1) continue; const id = Math.round((q.y - Y0) / S) * NX + Math.round((q.x - X0) / S); if (q.z > zF[id]) zF[id] = q.z; if (q.z < zB[id]) zB[id] = q.z; }
      }
    });
    if (hairM) hairM.visible = hv;
    // fill small gaps from neighbours so lookups are smooth
    for (let pass = 0; pass < 4; pass++) for (let iy = 1; iy < NY - 1; iy++) for (let ix = 1; ix < NX - 1; ix++) { const id = iy * NX + ix; if (zF[id] > -1e8) continue; let s = 0, c = 0, sb = 0; for (const dd of [-1, 1, -NX, NX]) if (zF[id + dd] > -1e8) { s += zF[id + dd]; sb += zB[id + dd]; c++; } if (c) { zF[id] = s / c; zB[id] = sb / c; } }
    // a necklace lies over her clothes, not in their folds: take the highest (front) and lowest (back) point within 1 cm, then soften
    const filt = (A, hi) => { const B = new Float32Array(A.length); for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) { let v = hi ? -1e9 : 1e9; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = ix + dx, y = iy + dy; if (x < 0 || y < 0 || x >= NX || y >= NY) continue; const a = A[y * NX + x]; if (Math.abs(a) > 1e8) continue; v = hi ? Math.max(v, a) : Math.min(v, a); } B[iy * NX + ix] = v; } return B; };
    const soft = A => { for (let pass = 0; pass < 2; pass++) { const B = A.slice(); for (let iy = 1; iy < NY - 1; iy++) for (let ix = 1; ix < NX - 1; ix++) { const id = iy * NX + ix, c = [A[id], A[id - 1], A[id + 1], A[id - NX], A[id + NX]]; if (c.some(v => Math.abs(v) > 1e8)) continue; B[id] = (c[0] * 2 + c[1] + c[2] + c[3] + c[4]) / 6; } A.set(B); } return A; };
    const zF2 = soft(filt(zF, true)), zB2 = soft(filt(zB, false)); zF.set(zF2); zB.set(zB2);
    const at = (A, x, y, def) => { const fx = (clamp(x, X0, X1 - S) - X0) / S, fy = (clamp(y, Y0, Y1 - S) - Y0) / S, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, g = (a, b) => { const v = A[(iy + b) * NX + ix + a]; return Math.abs(v) > 1e8 ? def : v; }; return lerp(lerp(g(0, 0), g(1, 0), tx), lerp(g(0, 1), g(1, 1), tx), ty); };
    const F = { front: (x, y) => at(zF, x, y, 0), back: (x, y) => at(zB, x, y, -10), neckY: 152.5 };
    F.halfW = y => { let w = 4; for (let x = 0; x <= X1 - 1; x += 0.5) if (F.front(x, y) - F.back(x, y) > 3) w = x; return w; };
    // her neck at the ring height: centre and half depth, from the front and back surfaces on her midline
    const zf0 = F.front(0, F.neckY), zb0 = F.back(0, F.neckY); F.zc = (zf0 + zb0) / 2; F.hz = (zf0 - zb0) / 2;
    return (sandy.__jfield = F);
  }

  /* ---------------------------------------------------------------- materials, geometry */
  let ENV = null, CTX = null;
  const mats = new Map();   // finish+colour -> material (shared, never disposed per item)
  function matFor(col, finish) {
    const key = col + '|' + finish; if (mats.has(key)) return mats.get(key);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: finish === 'matte' ? 0.85 : finish === 'metal' ? 0.24 : 0.22, metalness: finish === 'metal' ? 0.92 : 0, envMap: ENV, envMapIntensity: finish === 'metal' ? 1 : 0.5, side: THREE.DoubleSide });
    mats.set(key, m); return m;
  }
  const charmMats = new Map();
  function charmMat(e) {
    const tint = e.tint === 'pastel' ? '#ffc4dc' : e.tint, key = e.id + '|' + (e.outline ? 1 : 0) + '|' + tint; if (charmMats.has(key)) return charmMats.get(key);
    const m = new THREE.MeshBasicMaterial({ map: charmTexture(e.id, e.outline, tint), alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false }); charmMats.set(key, m); return m;
  }
  const GEO = {};
  function extrude(shape, depth, curve) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1, curveSegments: curve || 5 }); g.translate(0, 0, -depth / 2); return g; }
  function poly(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
  function geoFor(id) {
    if (GEO[id]) return GEO[id]; let g;
    switch (id) {
      case 'bead': case 'pearl': g = new THREE.SphereGeometry(0.5, 12, 8); break;
      case 'cube': g = new THREE.BoxGeometry(0.72, 0.72, 0.72); g.rotateY(0.6); break;
      case 'heart': { const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.35, -0.55, -0.12, -0.5, 0.14); s.bezierCurveTo(-0.46, 0.38, -0.12, 0.5, 0, 0.26); s.bezierCurveTo(0.12, 0.5, 0.46, 0.38, 0.5, 0.14); s.bezierCurveTo(0.55, -0.12, 0.15, -0.35, 0, -0.5); g = extrude(s, 0.26, 5); break; }
      case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.52; p.push([Math.cos(a) * r, Math.sin(a) * r - 0.02]); } g = extrude(poly(p), 0.22); break; }
      case 'moon': { const p = [], a0 = Math.atan2(0.411, 0.284); for (let i = 0; i <= 14; i++) { const a = lerp(a0, TAU - a0, i / 14); p.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]); } for (let i = 1; i < 14; i++) { const a = lerp(TAU - 1.37, 1.37, i / 14) ; p.push([0.2 + Math.cos(a + Math.PI) * 0 + Math.cos(a) * 0.42, Math.sin(a) * 0.42]); } g = extrude(poly(p), 0.2); break; }
      case 'flower': { const p = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r = 0.36 + 0.14 * Math.cos(5 * a); p.push([Math.cos(a) * r, Math.sin(a) * r]); } g = extrude(poly(p), 0.18); break; }
      case 'drop': { const p = []; for (let a = -Math.PI / 2; a <= 0.35; a += 0.35) p.push(new THREE.Vector2(Math.cos(a) * 0.4, -0.25 + Math.sin(a) * 0.4)); p.push(new THREE.Vector2(0.2, 0.25), new THREE.Vector2(0.06, 0.52), new THREE.Vector2(0.0, 0.65)); p[0].x = 0; g = new THREE.LatheGeometry(p, 12); g.translate(0, -0.05, 0); break; }
      case 'gem': g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.78, 1.15, 0.78); break;
      case 'ring': g = new THREE.TorusGeometry(0.38, 0.07, 6, 18); break;
      case 'disc': g = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16); g.rotateX(Math.PI / 2); break;
      case 'bow': g = extrude(poly([[0, 0.07], [-0.5, 0.3], [-0.5, -0.3], [0, -0.07], [0.5, -0.3], [0.5, 0.3]]), 0.16); break;
      default: g = new THREE.SphereGeometry(0.5, 10, 6);
    }
    return (GEO[id] = g);
  }
  const triOf = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

  /* the pieces she wears are built from: an element (shape or charm) hanging down from its own origin (its top), or centred */
  function makeEl(e, own, centred) {
    const g = new THREE.Group(), h = elH(e);
    if (e.k === 'charm') { const pg = new THREE.PlaneGeometry(e.size, e.size); own.geos.push(pg); const m = new THREE.Mesh(pg, charmMat(e)); m.position.y = centred ? 0 : -e.size / 2; m.name = 'charm'; g.add(m); own.tris += 2; }
    else {
      const geo = geoFor(e.id), mesh = new THREE.Mesh(geo, matFor(e.col, e.finish)); mesh.scale.setScalar(e.size); mesh.name = e.id;
      const dy = e.id === 'drop' ? 0.05 : 0; mesh.position.y = centred ? 0 : -(h / 2) + (e.id === 'drop' ? dy * e.size : 0); g.add(mesh); own.tris += triOf(geo);
    }
    g.userData.h = h; return g;
  }
  const cylBetween = (a, b, r, mat, own) => { const len = a.distanceTo(b); if (len < 1e-4) return null; const geo = new THREE.CylinderGeometry(r, r, len, 5, 1, true); own.geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); own.tris += 10; m.name = 'link'; return m; };

  /* ---------------------------------------------------------------- earrings */
  function earInfo(sandy, hm) {
    if (sandy.__jears) return sandy.__jears;
    const hg = sandy.n3.headGroup; sandy.object3d.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(hg.matrixWorld).invert(), out = [];
    sandy.object3d.traverse(o => { if (o.isMesh && o.name === 'ear' && o.visible !== false) { const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), b = new THREE.Box3(), v = new THREE.Vector3(), P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) b.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(M)); out.push(b); } });
    const info = { L: null, R: null };
    for (const b of out) { const side = (b.min.x + b.max.x) / 2 > 0 ? 1 : -1; info[side > 0 ? 'L' : 'R'] = { sx: side, x: (b.min.x + b.max.x) / 2, xOut: Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), yMin: b.min.y, yMax: b.max.y, zMid: (b.min.z + b.max.z) / 2, zFront: b.max.z }; }
    if (!info.L) info.L = { sx: 1, x: 10.7, xOut: 13.5, yMin: -1.4, yMax: 4.6, zMid: -0.6, zFront: 0 }; if (!info.R) info.R = Object.assign({}, info.L, { sx: -1, x: -info.L.x });
    return (sandy.__jears = info);
  }
  function buildEarrings(d, ctx, o) {
    const { sandy, hm } = ctx, own = { geos: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugEarrings'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'earrings', design: d };
    const E = earInfo(sandy, hm), cmU = hm.unitCm, metal = matFor(d.metal, 'metal');
    const cm = new THREE.Group(); cm.scale.setScalar(1 / cmU); root.add(cm);
    for (const side of ['L', 'R']) {
      const ear = E[side], sx = ear.sx, seq = (side === 'R' && d.pair === 'mismatch' ? d.seq.slice().reverse() : d.seq).map(e => Object.assign({}, e, { size: e.size * KE })), gapK = d.gap * KE, g = new THREE.Group(); cm.add(g);
      // they sit just outside her ear (not in it), each piece turned to face away from her head
      const X = sx * (ear.xOut * cmU + 0.05), zM = ear.zMid * cmU, zF = ear.zFront * cmU, yaw = sx * Math.PI / 2;
      const hoop = d.mount === 'hook' && seq[0].k === 'shape' && seq[0].id === 'ring';
      let cursor, zOff;
      if (d.mount === 'stud') { cursor = (ear.yMin + 1.15) * cmU; zOff = zM; }
      else if (hoop) { cursor = ear.yMin * cmU + 0.35 * KE; zOff = zM + 0.04; }
      else { const ry = ear.yMin * cmU + 0.5, ringGeo = new THREE.TorusGeometry(0.42, 0.045, 5, 14); own.geos.push(ringGeo); const ring = new THREE.Mesh(ringGeo, metal); ring.rotation.y = Math.PI / 2; ring.position.set(X, ry, zM); g.add(ring); own.tris += 140; cursor = ry - 0.42; zOff = zM + 0.04; }
      let prevBottom = null;
      seq.forEach((e, i) => {
        const el = makeEl(e, own, false); el.rotation.y = yaw; const bb = new THREE.Box3().setFromObject(el), hgt = bb.max.y - bb.min.y;   // its real height, so nothing overlaps
        if (i === 0 && d.mount === 'stud') { el.position.set(X, cursor - (bb.max.y + bb.min.y) / 2, zOff); g.add(el); prevBottom = el.position.y + bb.min.y; return; }
        const gap = Math.max(i === 0 ? 0 : 0.18 * KE, i === 0 ? (hoop ? 0 : 0.04 * KE) : d.link === 'none' ? 0.12 * KE : gapK), start = prevBottom == null ? cursor : prevBottom, top = start - gap;
        el.position.set(X, top - bb.max.y, zOff); g.add(el);
        const from = new THREE.Vector3(X, start, zOff), to = new THREE.Vector3(X, top + 0.04, zOff);
        if (d.link === 'beaded' && i > 0) { const n = Math.max(1, Math.round(gap / 0.28)), bg = geoFor('bead'); for (let k = 0; k < n; k++) { const bd = new THREE.Mesh(bg, metal); bd.scale.setScalar(0.16); bd.position.lerpVectors(from, to, (k + 0.5) / n); g.add(bd); own.tris += triOf(bg); } }
        else { const c = cylBetween(from, to, d.link === 'none' && i > 0 ? 0.03 : 0.035, metal, own); if (c) g.add(c); }
        prevBottom = top - hgt;
      });
    }
    return { root, d, info: { tris: Math.round(own.tris) }, frame: 'head', dispose() { for (const g of own.geos) g.dispose(); } };
  }

  /* ---------------------------------------------------------------- necklaces */
  // the cord's centre line, from the left side of her neck down the front and back round the nape: [{p, t, n}]
  function necklacePath(d, F) {
    const D = depthOf(d.len), y0 = F.neckY, r = d.cord === 'ribbon' ? 0.1 : d.thick * KT * 0.5 + 0.12, hz = F.hz, Rz = hz + r, Rx = hz * 1.17 + r + 0.5, N = 144, pts = [];
    for (let i = 0; i < N; i++) {
      const phi = -Math.PI + (i + 0.5) / N * TAU, c = Math.cos(phi), s = Math.sin(phi);   // phi 0 = straight down the front
      let x = Rx * s, y = y0, z = F.zc + Rz * c;
      if (c > 0) { const h = D * Math.pow(c, 1.5); y = y0 - h; z = Math.max(z, F.front(x, y) + r + 0.35); }
      else { y = y0 + 0.5 * (-c); z = Math.min(z, F.back(x, y) - r); }
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }
  const mergeGeos = list => { let nV = 0, nI = 0; for (const g of list) { nV += g.attributes.position.count; nI += g.index ? g.index.count : g.attributes.position.count; } const P = new Float32Array(nV * 3), Nn = new Float32Array(nV * 3), Uv = new Float32Array(nV * 2), I = new Uint32Array(nI); let vo = 0, io = 0; for (const g of list) { P.set(g.attributes.position.array, vo * 3); Nn.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) Uv.set(g.attributes.uv.array, vo * 2); const n = g.attributes.position.count; if (g.index) for (let k = 0; k < g.index.count; k++) I[io++] = g.index.array[k] + vo; else for (let k = 0; k < n; k++) I[io++] = vo + k; vo += n; } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); m.setAttribute('uv', new THREE.BufferAttribute(Uv, 2)); m.setIndex(new THREE.BufferAttribute(I, 1)); return m; };
  let chainTex = null;
  function chainTexture() {
    if (chainTex) return chainTex; const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 4; i++) { x.fillStyle = '#9a9a9a'; x.beginPath(); x.ellipse(16 + i * 32, 16, 13, 10, 0, 0, TAU); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(16 + i * 32, 16, 8, 5, 0, 0, TAU); x.fill(); }
    chainTex = new THREE.CanvasTexture(cv); chainTex.wrapS = THREE.RepeatWrapping; chainTex.encoding = THREE.sRGBEncoding; chainTex.userData.canvas = cv; return chainTex;
  }
  function cordMeshes(d, pts, F, own, root) {
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'), L = curve.getLength(), rad = d.thick * KT / 2, out = {};
    out.length = L;
    if (d.cord === 'chain' || d.cord === 'cord') {
      const geo = new THREE.TubeGeometry(curve, 180, rad, 5, true); own.geos.push(geo);
      let mat;
      if (d.cord === 'chain') { const tex = chainTexture(), key = 'chain|' + d.cordCol; mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.cordCol).convertSRGBToLinear(), map: tex, roughness: 0.28, metalness: 0.85, envMap: ENV, side: THREE.DoubleSide }); own.mats.push(mat); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / (d.thick * KT * 2.2)); }
      else { mat = matFor(d.cordCol, 'matte'); }
      const m = new THREE.Mesh(geo, mat); m.name = 'cord'; root.add(m); own.tris += triOf(geo);
    } else if (d.cord === 'ribbon') {
      const w = d.thick * 1.3, n = 200, P = [], Nn = [], I = [], Uv = [], up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i <= n; i++) {
        const u = i / n, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1), nrm = new THREE.Vector3(p.x, 0, p.z - F.zc).normalize(), b = new THREE.Vector3().crossVectors(t, nrm).normalize();
        const a = p.clone().addScaledVector(b, w / 2), c = p.clone().addScaledVector(b, -w / 2); P.push(a.x, a.y, a.z, c.x, c.y, c.z); Nn.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z); Uv.push(u, 0, u, 1);
        if (i < n) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); geo.setIndex(I); own.geos.push(geo);
      const m = new THREE.Mesh(geo, matFor(d.cordCol, 'matte')); m.name = 'ribbon'; root.add(m); own.tris += triOf(geo);
    } else {
      // beads and pearls: spheres side by side along the cord, merged into one mesh per colour
      const dia = d.thick * KT, cnt = Math.max(8, Math.floor(L / dia)), sg = new THREE.SphereGeometry(0.5, 7, 5), A = [], B = [];
      for (let i = 0; i < cnt; i++) { const p = curve.getPointAt(i / cnt), g = sg.clone(); g.scale(dia, dia, dia); g.translate(p.x, p.y, p.z); ((d.alt && i % 2) ? B : A).push(g); }
      const mk = (list, col, nm) => { if (!list.length) return; const geo = mergeGeos(list); own.geos.push(geo); const m = new THREE.Mesh(geo, matFor(col, d.cord === 'pearls' ? 'gloss' : 'gloss')); m.name = nm; root.add(m); own.tris += triOf(geo); };
      mk(A, d.cordCol, 'beads'); mk(B, d.cord2, 'beads2'); sg.dispose();
    }
    out.curve = curve; return out;
  }
  // where an item sits on the front of the cord: at -1..1 across the front, 0 at the lowest point
  function frontPoint(pts, at) {
    const n = pts.length, phi = clamp(at, -1, 1) * (Math.PI / 2) * 0.86, idx = ((phi + Math.PI) / TAU * n) - 0.5, i0 = Math.floor(idx), f = idx - i0, a = pts[((i0 % n) + n) % n], b = pts[(((i0 + 1) % n) + n) % n];
    const p = a.clone().lerp(b, f), t = b.clone().sub(a).normalize(); return { p, t };
  }
  function buildNecklace(d, ctx) {
    const { sandy } = ctx, F = bodyField(sandy), own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugNecklace'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'necklaces', design: d };
    const pts = necklacePath(d, F), cord = cordMeshes(d, pts, F, own, root), metalM = matFor(d.cordCol, 'metal');
    const items = d.items.map(e => Object.assign({}, e, { size: e.size * KN })).sort((a, b) => a.at - b.at);
    for (const e of items) {
      const { p, t } = frontPoint(pts, e.at), nx = (F.front(p.x + 0.5, p.y) - F.front(p.x - 0.5, p.y)), ny = (F.front(p.x, p.y + 0.5) - F.front(p.x, p.y - 0.5));
      const nrm = new THREE.Vector3(-nx, -ny, 1).normalize(), down = new THREE.Vector3(0, -1, 0).addScaledVector(nrm, -new THREE.Vector3(0, -1, 0).dot(nrm)).normalize();
      const right = new THREE.Vector3().crossVectors(down, nrm).normalize(), basis = new THREE.Matrix4().makeBasis(right.clone().negate(), down.clone().negate(), nrm);   // local +y up, +z out
      const thread = e.mode === 'thread', h = elH(e), el = makeEl(e, own, thread), cr = d.cord === 'ribbon' ? 0.1 : d.thick * KT * 0.5;
      el.quaternion.setFromRotationMatrix(basis);
      if (thread) { const align = new THREE.Matrix4().makeBasis(t.clone().cross(nrm).normalize().negate(), t.clone().cross(nrm).cross(t).normalize(), t.clone().cross(nrm).normalize()); el.position.copy(p).addScaledVector(nrm, cr * 0.3); }
      else {
        // a small ring joins it to the cord; the piece hangs just under it, resting on her
        const ringGeo = new THREE.TorusGeometry(Math.min(0.28, 0.1 + e.size * 0.05), 0.035, 5, 10); own.geos.push(ringGeo); const ring = new THREE.Mesh(ringGeo, metalM); ring.position.copy(p).addScaledVector(nrm, cr + 0.02); ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, down.clone().negate(), nrm)); root.add(ring); own.tris += 100;
        el.position.copy(p).addScaledVector(nrm, cr + 0.12).addScaledVector(down, -0.12 + 0.0); el.position.addScaledVector(down, -0.0); el.position.y -= 0.0;
        el.position.addScaledVector(down, 0);   // origin is the piece's top, level with the ring
        el.position.addScaledVector(down, -0);
        el.position.sub(down.clone().multiplyScalar(0.12));
      }
      root.add(el);
    }
    const tris = Math.round(own.tris);
    return { root, d, info: { tris, lengthCm: cord.length }, frame: 'world', dispose() { for (const g of own.geos) g.dispose(); for (const m of own.mats) m.dispose(); } };
  }


  /* ================================================================ purses
     A purse is a bag (a shape, a pattern, a flap and a closure), a strap that crosses her body (a loop over her left shoulder
     and round her back to the bag at her right hip), an optional top handle, and keychains: charms and shapes hanging
     from the bottom of the bag on little chains. */
  const BAG_SHAPES = [['satchel', 'Satchel'], ['tote', 'Tote'], ['bucket', 'Bucket'], ['round', 'Round'], ['heart', 'Heart'], ['clutch', 'Clutch']];
  const BAG_LABEL = Object.fromEntries(BAG_SHAPES);
  const PATTERNS = [['solid', 'Solid'], ['gingham', 'Gingham'], ['stripes', 'Stripes'], ['dots', 'Polka dots'], ['quilt', 'Quilted'], ['checks', 'Checks'], ['print', 'Print']];
  const PATTERN_LABEL = Object.fromEntries(PATTERNS);
  const STRAPS = [['chain', 'Chain'], ['strap', 'Strap'], ['wide', 'Wide strap'], ['cord', 'Cord'], ['beads', 'Beads'], ['pearls', 'Pearls']];
  const STRAP_LABEL = Object.fromEntries(STRAPS);
  const CLOSURES = [['none', 'None'], ['clasp', 'Clasp'], ['heart', 'Heart'], ['star', 'Star'], ['bow', 'Bow'], ['flower', 'Flower'], ['moon', 'Moon']];
  const CLOSURE_LABEL = Object.fromEntries(CLOSURES);
  const BAG_LIM = { satchel: { w: [12, 24], h: [9, 18], d: [3, 9] }, tote: { w: [14, 24], h: [12, 22], d: [4, 10] }, bucket: { w: [10, 20], h: [9, 18] }, round: { w: [10, 20], d: [3, 8] }, heart: { w: [10, 20], d: [3, 8] }, clutch: { w: [14, 24], h: [7, 13], d: [1.5, 4] } };
  const PURSE_N = 6;
  DEF.purses = () => ({ v: 1, brand: 'grug', shape: 'satchel', w: 18, h: 13, depth: 6, body: '#ff8fc2', body2: '#fff6f2', pattern: 'solid', print: 0, finish: 'gloss', flap: true, closure: 'clasp', handle: false, strap: 'chain', strapLen: 0.5, strapCol: '#d4af37', hw: '#d4af37', charms: [EL({ k: 'shape', id: 'heart', size: 1.6, col: '#e8344f', at: 0.7 })] });
  LIMITS.purses = { n: PURSE_N };

  function validateP(src, brand) {
    const notes = [], d = Object.assign(DEF.purses(), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!BAG_LABEL[d.shape]) d.shape = 'satchel'; const L = BAG_LIM[d.shape];
    d.w = clamp(+d.w || 18, L.w[0], L.w[1]);
    d.h = L.h ? clamp(+d.h || 12, L.h[0], L.h[1]) : d.shape === 'bucket' ? clamp(+d.h || 12, 9, 18) : d.w;
    if (d.shape === 'round') d.h = d.w; if (d.shape === 'heart') d.h = d.w * 0.92;
    d.depth = L.d ? clamp(+d.depth || 5, L.d[0], L.d[1]) : d.w;
    for (const k of ['body', 'body2', 'strapCol', 'hw']) if (!isHex(d[k])) d[k] = DEF.purses()[k];
    if (!PATTERN_LABEL[d.pattern]) d.pattern = 'solid'; { const v = Math.round(+d.print); d.print = isFinite(v) && v >= 0 && v < PAT_N ? v : 0; } if (!FINISHES.some(f => f[0] === d.finish)) d.finish = 'gloss';
    if (!STRAP_LABEL[d.strap]) d.strap = 'chain'; if (!CLOSURE_LABEL[d.closure]) d.closure = 'none';
    d.strapLen = clamp(+d.strapLen, 0, 1); if (!isFinite(d.strapLen)) d.strapLen = 0.5;
    d.flap = !!d.flap && (d.shape === 'satchel' || d.shape === 'clutch'); d.handle = !!d.handle;
    if (d.shape === 'bucket' && d.closure === 'clasp') d.closure = 'none';
    d.charms = (d.charms || []).slice(0, PURSE_N).map(e => cleanEl(e, 'purses'));
    if (d.brand === 'kimiland') {
      let changed = false;
      for (const k of ['body', 'body2', 'strapCol', 'hw']) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); changed = true; }
      for (const e of d.charms) kimiEl(e, { tint: isPastel(e.col) ? e.col : toPastel(e.col) });
      if (changed) notes.push('Brought to KIMILAND pastels');
    }
    return { d, notes };
  }

  function randomP(seed, o) {
    o = o || {}; const r = rng('jewel:purses:' + seed), brand = o.brand || brandFor(seed), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ valentines: 2, christmas: 2, halloween: 2, sweet: 1.5, classic: 3, ocean: 1, forest: 1, night: 1.2 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.pick(T.cols), metal = kimi ? pal.metal : r.pick(T.metal);
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF.purses(); d.brand = brand;
    const recolour = () => {
      d.body = kimi ? pal.main : pick(); d.body2 = kimi ? '#fffafc' : r.pick(T.cols); d.strapCol = d.strap === 'beads' || d.strap === 'pearls' ? (d.strap === 'pearls' ? (kimi ? '#fffafc' : '#fff6f2') : pick()) : (d.strap === 'chain' ? metal : pick()); d.hw = metal;
      for (const e of d.charms) { if (e.k === 'shape') e.col = e.id === 'pearl' ? (kimi ? '#fffafc' : '#fff6f2') : pick(); else { const c = CHARM_BY[e.id]; e.tint = kimi && !c.brand ? (pal.pink ? pal.main : r.pick(pal.mains)) : ''; } }
    };
    if (o.keep === 'shape') { recolour(); return validateP(d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? { body: d.body, body2: d.body2, strapCol: d.strapCol, hw: d.hw, cols: d.charms.map(e => [e.col, e.tint]) } : null;
    d.shape = o.kind && BAG_LABEL[o.kind] ? o.kind : r.w({ satchel: 3, tote: 2, bucket: 2, round: 2, heart: 1.4, clutch: 1.6 });
    const L = BAG_LIM[d.shape]; d.w = r.f(L.w[0] + 1, L.w[1] - 1); d.h = L.h ? r.f(L.h[0] + 1, L.h[1] - 1) : r.f(10, 17); d.depth = L.d ? r.f(L.d[0] + 0.5, L.d[1] - 0.5) : d.w;
    d.pattern = kimi ? r.w({ gingham: 4, solid: 3, dots: 2, quilt: 1.4, stripes: 1, checks: 0.6, print: 2.5 }) : r.w({ solid: 5, stripes: 2, dots: 1.5, quilt: 2, gingham: 1.5, checks: 1.5, print: 4 }); d.print = r.i(0, PAT_N - 1);
    d.finish = r.w({ gloss: 5, matte: 2.5, metal: kimi ? 0.3 : 1 }); d.flap = (d.shape === 'satchel' || d.shape === 'clutch') && r.chance(0.7);
    d.closure = d.shape === 'bucket' ? r.pick(['none', 'heart', 'star', 'flower']) : r.w({ none: 1, clasp: d.flap ? 3 : 1, heart: 1.4, star: 1, bow: 1.4, flower: 1, moon: 0.7 });
    d.handle = d.shape === 'tote' ? r.chance(0.85) : r.chance(0.3);
    d.strap = r.w({ chain: 3, strap: 3, wide: 1.5, cord: 1.4, beads: 1, pearls: 1 }); d.strapLen = r.f(0.1, 0.9);
    const n = r.w({ 0: 1, 1: 3, 2: 3, 3: 2.4, 4: 1.2 }) | 0; d.charms = [];
    for (let i = 0; i < n; i++) { const e = randomEl(r, 'necklaces', theme, pal, kimi, {}); e.size = e.size * 0.75; e.at = n === 1 ? r.f(0.2, 0.8) : lerp(-0.7, 0.8, i / (n - 1)); e.drop = r.f(0.8, 5); e.mode = 'hang'; d.charms.push(e); }
    recolour();
    if (keepC) { d.body = keepC.body; d.body2 = keepC.body2; d.strapCol = keepC.strapCol; d.hw = keepC.hw; d.charms.forEach((e, i) => { const c = keepC.cols[i % keepC.cols.length]; if (e.k === 'shape') e.col = c[0]; else if (!CHARM_BY[e.id].brand) e.tint = c[1] || ''; }); }
    return validateP(d, brand).d;
  }

  const bagKind = d => d.shape;
  const COL_WORD = (c, kimi) => colourName(c, kimi);
  function nameP(d, seed) {
    const r = rng('jname:' + seed + ':purses'), kimi = d.brand === 'kimiland', colour = colourName(d.body, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(FLAVOUR);
    const noun = { satchel: r.pick(['Satchel', 'Crossbody', 'Mini Satchel']), tote: r.pick(['Tote', 'Shopper', 'Tote Bag']), bucket: r.pick(['Bucket Bag', 'Pouch', 'Bucket']), round: r.pick(['Circle Bag', 'Round Bag', 'Moon Bag']), heart: r.pick(['Heart Bag', 'Heart Purse', 'Sweetheart Bag']), clutch: r.pick(['Clutch', 'Mini Clutch', 'Pouchette']) }[d.shape];
    const pat = d.pattern === 'solid' ? '' : { gingham: 'Gingham', stripes: 'Striped', dots: 'Polka Dot', quilt: 'Quilted', checks: 'Checked', print: 'Print' }[d.pattern];
    const sub = d.charms.length ? elName(mainEl(d.charms)) : '';
    const forms = [[colour, pat, noun], [fl, pat || colour, noun], [fl, sub ? sub + ' Charm' : colour, noun], [pat || fl, colour, noun]];
    return forms[r.i(0, 3)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function tagsP(d) {
    const t = ['Purse', BAG_LABEL[d.shape], STRAP_LABEL[d.strap], PATTERN_LABEL[d.pattern]], themes = new Set(d.charms.filter(e => e.k === 'charm').map(e => CHARM_BY[e.id].theme));
    if (d.pattern === 'solid') t.pop(); for (const th of themes) t.push(THEME_LABEL[th]); if (d.charms.length) t.push('Keychains'); if (d.handle) t.push('Top handle'); if (d.flap) t.push('Flap');
    if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  function familiesP(d) { const f = new Set([famOfHex(d.body)]); if (d.pattern !== 'solid') f.add(famOfHex(d.body2)); f.add(famOfHex(d.strapCol)); for (const e of d.charms) { if (e.k === 'shape') f.add(famOfHex(e.col)); else { const c = CHARM_BY[e.id]; if (e.tint) f.add(famOfHex(e.tint === 'pastel' ? '#ffc4dc' : e.tint)); else for (const x of c.fam) f.add(x); } } if (f.size > 3) f.add('multi'); return f; }
  function describeP(d) {
    const kimi = d.brand === 'kimiland', pat = d.pattern === 'solid' ? '' : PATTERN_LABEL[d.pattern].toLowerCase() + ' ', names = Array.from(new Set(d.charms.map(elName).map(s => s.toLowerCase())));
    const ch = names.length ? ', with ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + ' hanging off keychains' : '';
    return `A ${colourName(d.body, kimi).toLowerCase()} ${pat}${BAG_LABEL[d.shape].toLowerCase()} bag on a ${STRAP_LABEL[d.strap].toLowerCase()} strap worn across the body${d.handle ? ', with a top handle' : ''}${ch}.${kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : ''}`;
  }

  /* ---- drawing it */
  function rrShape(w, h, r, topR) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2, rt = topR == null ? r : topR; r = Math.min(r, w / 2, h / 2); const t = Math.min(rt, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - t); s.quadraticCurveTo(x + w, y + h, x + w - t, y + h); s.lineTo(x + t, y + h); s.quadraticCurveTo(x, y + h, x, y + h - t); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function heartShape(w, h) { const s = new THREE.Shape(), k = (a, b) => [a * w, b * h]; s.moveTo(...k(0, -0.5)); s.bezierCurveTo(...k(-0.15, -0.35), ...k(-0.55, -0.12), ...k(-0.5, 0.14)); s.bezierCurveTo(...k(-0.46, 0.38), ...k(-0.12, 0.5), ...k(0, 0.26)); s.bezierCurveTo(...k(0.12, 0.5), ...k(0.46, 0.38), ...k(0.5, 0.14)); s.bezierCurveTo(...k(0.55, -0.12), ...k(0.15, -0.35), ...k(0, -0.5)); return s; }
  function extrudeP(shape, depth, bev) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -depth / 2); return g; }
  function planarUV(g, w, h) { const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / w + 0.5, P.getY(i) / h + 0.5); uv.needsUpdate = true; }
  const patCache = new Map();
  function patternTex(d) {
    const nx = Math.max(2, Math.round(d.w / 3.2)), ny = Math.max(2, Math.round(d.h / 3.2)), key = [d.pattern, d.body, d.body2, nx, ny, d.pattern === 'print' ? d.print : ''].join('|');
    if (patCache.has(key)) return patCache.get(key);
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), cw = S / nx, ch = S / ny;
    x.fillStyle = d.pattern === 'gingham' || d.pattern === 'stripes' || d.pattern === 'checks' ? d.body2 : d.body; x.fillRect(0, 0, S, S);
    if (d.pattern === 'gingham') { x.fillStyle = d.body; x.globalAlpha = 0.55; for (let i = 0; i < nx; i += 2) x.fillRect(i * cw, 0, cw, S); for (let j = 0; j < ny; j += 2) x.fillRect(0, j * ch, S, ch); x.globalAlpha = 1; }
    else if (d.pattern === 'stripes') { x.fillStyle = d.body; for (let i = 0; i < nx; i += 2) x.fillRect(i * cw, 0, cw, S); }
    else if (d.pattern === 'print' && PAT.lum) { const im = x.getImageData(0, 0, S, S), D = im.data, a = hexRGB(d.body), b = hexRGB(d.body2), ox = (d.print % PAT.cols) * PAT.T, oy = Math.floor(d.print / PAT.cols) * PAT.T, tw = S / Math.max(nx, ny);
      for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const L = 1 - (1 - PAT.lum[(oy + Math.floor(((y % tw) / tw) * PAT.T)) * PAT.w + ox + Math.floor(((xx % tw) / tw) * PAT.T)] / 255) * PAT_K, p = (y * S + xx) * 4; D[p] = a[0] * L + b[0] * (1 - L); D[p + 1] = a[1] * L + b[1] * (1 - L); D[p + 2] = a[2] * L + b[2] * (1 - L); D[p + 3] = 255; } x.putImageData(im, 0, 0); }
    else if (d.pattern === 'checks') { x.fillStyle = d.body; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if ((i + j) % 2 === 0) x.fillRect(i * cw, j * ch, cw, ch); }
    else if (d.pattern === 'dots') { x.fillStyle = d.body2; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { x.beginPath(); x.ellipse((i + 0.5 + (j % 2) * 0.5) * cw, (j + 0.5) * ch, cw * 0.2, ch * 0.2, 0, 0, TAU); x.fill(); } }
    else if (d.pattern === 'quilt') { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; for (let i = -ny; i <= nx + ny; i++) { x.beginPath(); x.moveTo(i * cw, 0); x.lineTo(i * cw + S, S); x.stroke(); x.beginPath(); x.moveTo(i * cw, 0); x.lineTo(i * cw - S, S); x.stroke(); } x.fillStyle = d.body2; for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) { x.beginPath(); x.arc(i * cw, j * ch, 3.2, 0, TAU); x.fill(); } }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.userData.canvas = cv; patCache.set(key, t); return t;
  }
  const darker = (hex, k) => { const [r, g, b] = hex2rgb(hex); const f = v => Math.round(v * k).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };
  function bagMat(d, tex) { const metal = d.finish === 'metal'; return new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: d.finish === 'matte' ? 0.85 : metal ? 0.28 : 0.3, metalness: metal ? 0.7 : 0, envMap: ENV, envMapIntensity: metal ? 1 : 0.5, side: THREE.DoubleSide }); }
  const MESH = (geo, mat, own, nm) => { own.geos.push(geo); const m = new THREE.Mesh(geo, mat); if (nm) m.name = nm; own.tris += triOf(geo); return m; };

  // the bag, facing +z, centred, top at y = h/2
  function bagBody(d, own) {
    const g = new THREE.Group(), w = d.w, h = d.h, dp = d.depth, tex = patternTex(d), mat = bagMat(d, tex); own.mats.push(mat);
    const flatM = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.body2).convertSRGBToLinear(), roughness: d.finish === 'matte' ? 0.85 : 0.3, metalness: d.finish === 'metal' ? 0.7 : 0, envMap: ENV, side: THREE.DoubleSide }); own.mats.push(flatM);
    const dark = matFor(darker(d.body, 0.55), 'matte'), hwM = matFor(d.hw, 'metal');
    let flapH = 0;
    if (d.shape === 'satchel' || d.shape === 'clutch') {
      const geo = extrudeP(rrShape(w, h, Math.min(2.2, h * 0.22)), dp, 0.25); planarUV(geo, w + 0.5, h + 0.5); g.add(MESH(geo, mat, own, 'bag'));
      if (d.flap) { flapH = h * (d.shape === 'clutch' ? 0.62 : 0.5); const fs = rrShape(w + 0.3, flapH, Math.min(3, flapH * 0.4), 0.3), fg = extrudeP(fs, 0.3, 0.12); const m = MESH(fg, flatM, own, 'flap'); m.position.set(0, h / 2 - flapH / 2, dp / 2 + 0.18); g.add(m); }
    } else if (d.shape === 'tote') {
      const s = new THREE.Shape(), tw = w / 2, bw = w * 0.4, r = 1.2; s.moveTo(-bw + r, -h / 2); s.lineTo(bw - r, -h / 2); s.quadraticCurveTo(bw, -h / 2, bw, -h / 2 + r); s.lineTo(tw, h / 2); s.lineTo(-tw, h / 2); s.lineTo(-bw, -h / 2 + r); s.quadraticCurveTo(-bw, -h / 2, -bw + r, -h / 2);
      const geo = extrudeP(s, dp, 0.25); planarUV(geo, w + 0.5, h + 0.5); g.add(MESH(geo, mat, own, 'bag'));
      const lip = new THREE.BoxGeometry(w * 0.96, 0.3, dp * 0.86); const m = MESH(lip, dark, own, 'inside'); m.position.y = h / 2 - 0.05; g.add(m);
    } else if (d.shape === 'bucket') {
      const geo = new THREE.CylinderGeometry(w / 2, w * 0.38, h, 22, 1, false); g.add(MESH(geo, mat, own, 'bag'));
      const rim = new THREE.TorusGeometry(w / 2, 0.28, 6, 24); const rm = MESH(rim, flatM, own, 'rim'); rm.rotation.x = Math.PI / 2; rm.position.y = h / 2; g.add(rm);
      const cap = new THREE.CircleGeometry(w / 2 - 0.1, 22); const cm = MESH(cap, dark, own, 'inside'); cm.rotation.x = -Math.PI / 2; cm.position.y = h / 2 - 0.05; g.add(cm);
      const dr = new THREE.TorusGeometry(w / 2 - 0.4, 0.16, 5, 22); const dm = MESH(dr, hwM, own, 'drawstring'); dm.rotation.x = Math.PI / 2; dm.position.y = h / 2 - 1.2; g.add(dm);
    } else if (d.shape === 'round') {
      const geo = new THREE.CylinderGeometry(w / 2, w / 2, dp, 28, 1, false); geo.rotateX(Math.PI / 2); const P = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / w + 0.5, P.getY(i) / w + 0.5); g.add(MESH(geo, mat, own, 'bag'));
      for (const z of [dp / 2, -dp / 2]) { const pip = new THREE.TorusGeometry(w / 2, 0.3, 6, 28); const pm = MESH(pip, flatM, own, 'piping'); pm.position.z = z; g.add(pm); }
    } else if (d.shape === 'heart') {
      const geo = extrudeP(heartShape(w, h), dp, 0.3); planarUV(geo, w, h); g.add(MESH(geo, mat, own, 'bag'));
    }
    // the closure, on the front
    const cy = d.shape === 'bucket' ? h / 2 - 2.2 : d.flap ? h / 2 - flapH : d.shape === 'tote' ? h / 2 - 2 : d.shape === 'round' ? 0 : d.shape === 'heart' ? h * 0.12 : h * 0.28, cz = d.shape === 'bucket' ? w * 0.36 : d.flap ? dp / 2 + 0.55 : dp / 2 + 0.35;
    if (d.closure === 'clasp') { const cg = new THREE.BoxGeometry(1.6, 1.1, 0.5); const c1 = MESH(cg, hwM, own, 'clasp'); c1.position.set(0, cy, cz); g.add(c1); const kg = new THREE.TorusGeometry(0.3, 0.09, 5, 10); const c2 = MESH(kg, hwM, own, 'clasp'); c2.position.set(0, cy, cz + 0.3); g.add(c2); }
    else if (d.closure !== 'none') { const m = new THREE.Mesh(geoFor(d.closure), hwM); m.name = 'closure'; m.scale.setScalar(d.closure === 'bow' ? 2.8 : 2.2); m.position.set(0, cy, cz + 0.15); g.add(m); own.tris += triOf(m.geometry); }
    return g;
  }

  let _pursePath = null;
  // the strap: one loop from the bag's inner top corner up across her chest to her left shoulder, over it, down her back and round her right side to the bag
  function strapPoints(d, F, A, B, r) {
    const pts = [], yS = 149.2, xS = 12, front = (x, y) => F.front(x, y) + r + 0.35 + 1.1, back = (x, y) => F.back(x, y) - r - 0.35 - 0.6, ease = s => s * s * (3 - 2 * s);
    const ell = y => { const zc = (F.front(0, y) + F.back(0, y)) / 2, b = (F.front(0, y) - F.back(0, y)) / 2 + r + 0.35, a = Math.max(F.halfW(y) + r + 0.35, xS + 1); return { zc, a, b }; };
    const eB = ell(B.y), aB = Math.atan2(clamp(-B.x / eB.a, -1, 1), (B.z - eB.zc) / eB.b), eS = ell(yS), aS = Math.PI + Math.asin(clamp(xS / eS.a, -1, 1));
    const NB = 34;
    for (let i = 0; i <= NB; i++) {
      const s = i / NB, y = lerp(B.y, yS, ease(s)), e = ell(y), al = lerp(aB, aS, ease(s)); let x = -e.a * Math.sin(al), z = e.zc + e.b * Math.cos(al);
      if (Math.cos(al) > 0) z = Math.max(z, front(x, y)); else z = Math.min(z, back(x, y));
      const p = new THREE.Vector3(x, y, z); const k = clamp(s / 0.25, 0, 1); pts.push(i === 0 ? B.clone() : new THREE.Vector3().lerpVectors(B, p, ease(k)));
    }
    const zcS = (F.front(xS, yS) + F.back(xS, yS)) / 2;
    pts.push(new THREE.Vector3(xS + 0.6, yS + 1.4 + r, zcS));
    const NF = 22;
    for (let i = 0; i <= NF; i++) { const s = i / NF, x = lerp(xS, A.x, ease(s)), y = lerp(yS, A.y, s); let z = front(x, y); if (i === 0) z = Math.max(z, F.front(xS, yS) * 0.4 + r); pts.push(new THREE.Vector3(x, y, z)); }
    pts[pts.length - 1].copy(A); return pts;
  }
  function strapMeshes(d, pts, F, own, root) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), L = curve.getLength(), col = d.strapCol, out = { length: L };
    if (d.strap === 'chain' || d.strap === 'cord') {
      const rad = d.strap === 'chain' ? 0.34 : 0.42, geo = new THREE.TubeGeometry(curve, 110, rad, 5, false); own.geos.push(geo); let mat;
      if (d.strap === 'chain') { mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), map: chainTexture(), roughness: 0.28, metalness: 0.85, envMap: ENV, side: THREE.DoubleSide }); own.mats.push(mat); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / (rad * 5)); } else mat = matFor(col, 'matte');
      const m = new THREE.Mesh(geo, mat); m.name = 'strap'; root.add(m); own.tris += triOf(geo);
    } else if (d.strap === 'strap' || d.strap === 'wide') {
      const wd = d.strap === 'wide' ? 3.2 : 1.5, n = 180, P = [], Nn = [], I = [], Uv = [];
      for (let i = 0; i <= n; i++) { const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u), zc = (F.front(0, p.y) + F.back(0, p.y)) / 2, nrm = new THREE.Vector3(p.x * 0.35, 0, p.z - zc).normalize(), b = new THREE.Vector3().crossVectors(t, nrm).normalize(); const a = p.clone().addScaledVector(b, wd / 2), c = p.clone().addScaledVector(b, -wd / 2); P.push(a.x, a.y, a.z, c.x, c.y, c.z); Nn.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z); Uv.push(u, 0, u, 1); if (i < n) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); geo.setIndex(I); own.geos.push(geo);
      const m = new THREE.Mesh(geo, matFor(col, d.finish === 'matte' ? 'matte' : 'gloss')); m.name = 'strap'; root.add(m); own.tris += triOf(geo);
    } else {
      const dia = d.strap === 'pearls' ? 1.15 : 0.95, cnt = Math.max(8, Math.floor(L / dia)), sg = new THREE.SphereGeometry(0.5, 6, 4), A = [];
      for (let i = 0; i <= cnt; i++) { const p = curve.getPointAt(i / cnt), g = sg.clone(); g.scale(dia, dia, dia); g.translate(p.x, p.y, p.z); A.push(g); }
      const geo = mergeGeos(A); own.geos.push(geo); const m = new THREE.Mesh(geo, matFor(col, 'gloss')); m.name = 'beads'; root.add(m); own.tris += triOf(geo); sg.dispose();
    }
    return out;
  }

  function buildPurse(d, ctx) {
    const { sandy } = ctx, F = bodyField(sandy), own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugPurse'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'purses', design: d };
    const w = d.w, h = d.h, dp = d.depth, hwM = matFor(d.hw, 'metal'), yTop = lerp(132, 108, d.strapLen), yc = yTop - h / 2, xc = -3 - w * 0.15, zb = F.front(xc, Math.max(yc, 96)) + dp / 2 + 0.5;
    const bag = new THREE.Group(); bag.position.set(xc, yc, zb); root.add(bag); bag.add(bagBody(d, own));
    // the strap's two ends, at the bag's top corners (rings join them)
    const A = new THREE.Vector3(xc + w * 0.36, yTop + 0.25, zb), B = new THREE.Vector3(xc - w * 0.36, yTop + 0.25, zb), r = d.strap === 'wide' ? 1.4 : d.strap === 'strap' ? 0.7 : 0.4;
    const pts = strapPoints(d, F, A, B, r), info = strapMeshes(d, pts, F, own, root);
    for (const P of [A, B]) { const rg = new THREE.TorusGeometry(0.55, 0.12, 5, 10); const m = MESH(rg, hwM, own, 'ring'); m.position.copy(P).add(new THREE.Vector3(0, -0.1, 0)); root.add(m); }
    if (d.handle) { const arc = Math.max(4.2, w * 0.3), hp = [], n = 12; for (let i = 0; i <= n; i++) { const t = i / n, a = Math.PI * t; hp.push(new THREE.Vector3(-w * 0.2 * Math.cos(a), h / 2 - 0.1 + Math.sin(a) * arc, 0)); } const hg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 24, 0.38, 5, false); const hm2 = MESH(hg, matFor(d.strapCol, d.strap === 'chain' ? 'metal' : 'matte'), own, 'handle'); bag.add(hm2); }
    // keychains along the bottom edge
    const list = d.charms.map(e => Object.assign({}, e, { size: e.size * KN })).sort((a, b) => a.at - b.at);
    for (const e of list) {
      const bottom = d.shape === 'heart' ? 0.3 : d.shape === 'bucket' ? 0.8 : 1, ax = e.at * w * 0.4 * bottom, ay = -h / 2 + (d.shape === 'heart' ? h * 0.05 : 0.1), az = dp / 2 - 0.1 + (d.shape === 'round' ? 0 : 0);
      const rg = new THREE.TorusGeometry(0.4, 0.09, 5, 10); const ring = MESH(rg, hwM, own, 'ring'); ring.position.set(ax, ay, az); bag.add(ring);
      const drop = clamp(e.drop || 2, 0.4, 9), from = new THREE.Vector3(ax, ay - 0.1, az), to = new THREE.Vector3(ax, ay - drop, az), c = cylBetween(from, to, 0.07, hwM, own); if (c) bag.add(c);
      const el = makeEl(e, own, false); el.position.set(ax, ay - drop + 0.1, az); bag.add(el);
    }
    return { root, d, info: { tris: Math.round(own.tris), lengthCm: info.length }, frame: 'world', dispose() { for (const g of own.geos) g.dispose(); for (const m of own.mats) m.dispose(); } };
  }


  /* ================================================================ sandals
     A sandal is a sole (thickness, a raised heel: wedge or block), a footbed, straps that follow her foot (a band across the
     instep, a toe post, an ankle strap, laces up the shin, a criss-cross wrap) and charms pinned on the straps.
     Colours can fade from one to another on the sole and on the straps. Her foot is measured from her own mesh. */
  const STYLES = [['slide', 'Slide'], ['thong', 'Thong'], ['ankle', 'Ankle strap'], ['gladiator', 'Gladiator'], ['wrap', 'Wrap'], ['slipper', 'Slipper']];
  const STYLE_LABEL = Object.fromEntries(STYLES);
  const HEELS = [['wedge', 'Wedge'], ['block', 'Block']];
  const HEEL_LABEL = Object.fromEntries(HEELS);
  const SAN_LIM = { soleH: [0.5, 5], heelH: [0, 8], strapT: [0.1, 1], strapW: [0.6, 3.5], shaft: [6, 26] };
  const SAN_N = 5, PAT_N = 168, PAT_K = 0.4;   // patterns stay subtle: their dark parts only go 40% of the way to the pattern colour
  DEF.sandals = () => ({ v: 1, brand: 'grug', style: 'ankle', soleH: 1.2, heelH: 0, heelType: 'wedge', soleCol: '#fff6f2', soleCol2: '#ff8fc2', soleGrad: false, bedCol: '#ffc2d6', strapCol: '#ff6fa8', strapCol2: '#fff6f2', strapGrad: false, strapT: 0.35, strapW: 1.2, shaft: 12, hw: '#d4af37', finish: 'gloss', strapPat: -1, solePat: -1, bedPat: -1, strapPatCol: '#ffffff', solePatCol: '#ffffff', bedPatCol: '#ffffff', charms: [EL({ k: 'shape', id: 'heart', size: 1.4, col: '#e8344f', at: 0.6 })] });
  LIMITS.sandals = { n: SAN_N };

  function validateS(src, brand) {
    const notes = [], d = Object.assign(DEF.sandals(), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!STYLE_LABEL[d.style]) d.style = 'ankle';
    for (const k of Object.keys(SAN_LIM)) d[k] = clamp(+d[k] || SAN_LIM[k][0], SAN_LIM[k][0], SAN_LIM[k][1]);
    if (!(+src && 0) && src && src.heelH === 0) d.heelH = 0;
    if (d.style === 'slide') d.strapW = Math.max(d.strapW, 1.8);
    if (!HEEL_LABEL[d.heelType]) d.heelType = 'wedge';
    for (const k of ['soleCol', 'soleCol2', 'bedCol', 'strapCol', 'strapCol2', 'hw', 'strapPatCol', 'solePatCol', 'bedPatCol']) if (!isHex(d[k])) d[k] = DEF.sandals()[k];
    for (const k of ['strapPat', 'solePat', 'bedPat']) { const v = Math.round(+d[k]); d[k] = isFinite(v) && v >= 0 && v < PAT_N ? v : -1; }
    d.soleGrad = !!d.soleGrad; d.strapGrad = !!d.strapGrad; if (!FINISHES.some(f => f[0] === d.finish)) d.finish = 'gloss';
    d.charms = (d.charms || []).slice(0, SAN_N).map(e => cleanEl(e, 'sandals'));
    if (d.brand === 'kimiland') {
      let changed = false;
      for (const k of ['soleCol', 'soleCol2', 'bedCol', 'strapCol', 'strapCol2', 'hw', 'strapPatCol', 'solePatCol', 'bedPatCol']) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); changed = true; }
      for (const e of d.charms) kimiEl(e, { tint: isPastel(e.col) ? e.col : toPastel(e.col) });
      if (changed) notes.push('Brought to KIMILAND pastels');
    }
    return { d, notes };
  }

  function randomS(seed, o) {
    o = o || {}; const r = rng('jewel:sandals:' + seed), brand = o.brand || brandFor(seed), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ valentines: 2, christmas: 2, halloween: 2, sweet: 1.5, classic: 3, ocean: 1.2, forest: 1, night: 1.2 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.pick(T.cols), metal = kimi ? pal.metal : r.pick(T.metal);
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF.sandals(); d.brand = brand;
    const recolour = () => {
      d.strapCol = kimi ? pal.main : pick(); d.strapCol2 = pick(); d.soleCol = kimi ? (r.chance(0.5) ? '#fffafc' : pal.main) : r.chance(0.5) ? r.pick(['#fff6f2', '#16161a', '#c8ccd2', '#8a5a3c']) : pick(); d.soleCol2 = pick(); d.bedCol = kimi ? '#fffafc' : r.pick([d.strapCol, '#fff6f2', pick()]); d.hw = metal; const pc = base => { const c = new THREE.Color(base), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, hsl.l > 0.55 ? hsl.l - 0.22 : hsl.l + 0.22); return '#' + c.getHexString(); }; d.strapPatCol = pc(d.strapCol); d.solePatCol = pc(d.soleCol); d.bedPatCol = pc(d.bedCol);
      for (const e of d.charms) { if (e.k === 'shape') e.col = e.id === 'pearl' ? (kimi ? '#fffafc' : '#fff6f2') : pick(); else { const c = CHARM_BY[e.id]; e.tint = kimi && !c.brand ? (pal.pink ? pal.main : r.pick(pal.mains)) : ''; } }
    };
    if (o.keep === 'shape') { recolour(); return validateS(d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? { cols: ['soleCol', 'soleCol2', 'bedCol', 'strapCol', 'strapCol2', 'hw', 'soleGrad', 'strapGrad', 'strapPatCol', 'solePatCol', 'bedPatCol'].map(k => d[k]), ch: d.charms.map(e => [e.col, e.tint]) } : null;
    d.style = o.kind && STYLE_LABEL[o.kind] ? o.kind : r.w({ slide: 2.4, thong: 1.6, ankle: 3, gladiator: 1.8, wrap: 1.8, slipper: 1.6 });
    d.soleH = r.f(0.7, 3.4); d.heelH = r.chance(0.5) ? r.f(1.5, 6.5) : 0; d.heelType = r.pick(['wedge', 'block']);
    d.strapT = r.f(0.18, 0.75); d.strapW = d.style === 'slide' ? r.f(2, 3.4) : d.style === 'thong' ? r.f(0.8, 1.6) : r.f(0.7, 2.2); d.shaft = r.f(7, 24);
    d.soleGrad = r.chance(kimi ? 0.4 : 0.3); d.strapGrad = r.chance(kimi ? 0.45 : 0.35);
    d.strapPat = r.chance(0.4) ? r.i(0, PAT_N - 1) : -1; d.solePat = r.chance(0.3) ? r.i(0, PAT_N - 1) : -1; d.bedPat = r.chance(0.25) ? r.i(0, PAT_N - 1) : -1; d.finish = r.w({ gloss: 4, matte: 3, metal: kimi ? 0.2 : 0.8 });
    const n = r.w({ 0: 1.2, 1: 3, 2: 3, 3: 1.6, 4: 0.6 }) | 0; d.charms = [];
    for (let i = 0; i < n; i++) { const e = randomEl(r, 'necklaces', theme, pal, kimi, {}); e.size = clamp(e.size * 0.65, 0.8, 2.4); e.at = n === 1 ? r.f(0.2, 0.9) : lerp(-0.7, 0.9, i / (n - 1)); e.mode = 'hang'; d.charms.push(e); }
    recolour();
    if (keepC) { ['soleCol', 'soleCol2', 'bedCol', 'strapCol', 'strapCol2', 'hw', 'soleGrad', 'strapGrad', 'strapPatCol', 'solePatCol', 'bedPatCol'].forEach((k, i) => { d[k] = keepC.cols[i]; }); d.charms.forEach((e, i) => { const c = keepC.ch[i % keepC.ch.length]; if (!c) return; if (e.k === 'shape') e.col = c[0]; else if (!CHARM_BY[e.id].brand) e.tint = c[1] || ''; }); }
    return validateS(d, brand).d;
  }

  function nameS(d, seed) {
    const r = rng('jname:' + seed + ':sandals'), kimi = d.brand === 'kimiland', colour = colourName(d.strapCol, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(FLAVOUR);
    const noun = { slide: r.pick(['Slides', 'Slide Sandals', 'Sliders']), thong: r.pick(['Flip-Flops', 'Thong Sandals', 'Toe-Post Sandals']), ankle: r.pick(['Ankle Strap Sandals', 'Strappy Sandals', 'Ankle Straps']), gladiator: r.pick(['Gladiators', 'Gladiator Sandals', 'Lace-Up Sandals']), wrap: r.pick(['Wrap Sandals', 'Ribbon Sandals', 'Wraps']), slipper: r.pick(['Slippers', 'Mule Slippers', 'House Slippers', 'Toe-Cap Slippers']) }[d.style];
    const sole = d.heelH > 3.5 ? (d.heelType === 'block' ? 'Block Heel' : 'Wedge') : d.soleH > 2.8 && d.heelH < 1 ? 'Platform' : '', fade = d.strapGrad || d.soleGrad ? r.pick(['Ombré', 'Sunset', 'Fade']) : d.strapPat >= 0 || d.solePat >= 0 ? r.pick(['Print', 'Patterned', 'Graphic']) : '';
    const sub = d.charms.length ? elName(mainEl(d.charms)) + ' Charm' : '';
    const forms = [[colour, sole, noun], [fl, fade || colour, noun], [fl, sub || colour, noun], [fade || sole || fl, colour, noun]];
    return forms[r.i(0, 3)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function tagsS(d) {
    const t = ['Sandals', STYLE_LABEL[d.style]], themes = new Set(d.charms.filter(e => e.k === 'charm').map(e => CHARM_BY[e.id].theme));
    t.push(d.heelH < 1 ? (d.soleH > 2.8 ? 'Platform' : 'Flat') : HEEL_LABEL[d.heelType]); t.push(d.soleGrad || d.strapGrad ? 'Gradient' : 'Solid'); if (d.strapPat >= 0 || d.solePat >= 0 || d.bedPat >= 0) t.push('Patterned');
    for (const th of themes) t.push(THEME_LABEL[th]); if (d.charms.length) t.push('Charms'); if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  function familiesS(d) { const f = new Set([famOfHex(d.strapCol), famOfHex(d.soleCol)]); if (d.strapGrad) f.add(famOfHex(d.strapCol2)); if (d.soleGrad) f.add(famOfHex(d.soleCol2)); if (d.strapPat >= 0) f.add(famOfHex(d.strapPatCol)); for (const e of d.charms) { if (e.k === 'shape') f.add(famOfHex(e.col)); else { const c = CHARM_BY[e.id]; if (e.tint) f.add(famOfHex(e.tint === 'pastel' ? '#ffc4dc' : e.tint)); else for (const x of c.fam) f.add(x); } } if (f.size > 3) f.add('multi'); return f; }
  function describeS(d) {
    const kimi = d.brand === 'kimiland', names = Array.from(new Set(d.charms.map(elName).map(s => s.toLowerCase()))), heel = d.heelH < 1 ? (d.soleH > 2.8 ? 'platform' : 'flat') : HEEL_LABEL[d.heelType].toLowerCase() + ' heel';
    const ch = names.length ? ', with ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + ' pinned on the straps' : '';
    return `A pair of ${colourName(d.strapCol, kimi).toLowerCase()} ${d.style === 'slipper' ? 'slippers, a soft dome over the toes,' : STYLE_LABEL[d.style].toLowerCase() + ' sandals'} on a ${heel} sole${d.strapGrad || d.soleGrad ? ', fading from one colour to another' : ''}${ch}.${kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : ''}`;
  }

  function sweep(pts, nrm, w, t, uv, tag) {
    const n = pts.length, P = [], Nn = [], Uv = [], I = []; const T = new THREE.Vector3(), B = new THREE.Vector3();
    const sec = [];
    for (let i = 0; i < n; i++) { T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); const N = nrm[i].clone().addScaledVector(T, -nrm[i].dot(T)).normalize(); B.crossVectors(T, N).normalize(); sec.push({ p: pts[i], N, B: B.clone() }); }
    const corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]], face = [[0, 1, 'N', 1], [1, 2, 'B', -1], [2, 3, 'N', -1], [3, 0, 'B', 1]], cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    for (const [ia, ib, ax, sg] of face) {
      for (let i = 0; i < n - 1; i++) {
        const s0 = sec[i], s1 = sec[i + 1], q = [];
        for (const s of [s0, s1]) for (const k of [ia, ib]) { const [cw, ct] = corner[k]; q.push(s.p.clone().addScaledVector(s.B, cw * w / 2).addScaledVector(s.N, ct * t / 2)); }
        const nm0 = (ax === 'N' ? s0.N : s0.B).clone().multiplyScalar(sg), nm1 = (ax === 'N' ? s1.N : s1.B).clone().multiplyScalar(sg), base = P.length / 3;
        const nn = [nm0, nm0, nm1, nm1], us = uv.cm ? [ia, ib, ia, ib].map((k, c) => { const u0 = cum[i] % uv.period, u = c < 2 ? u0 : u0 + cum[i + 1] - cum[i]; return [uv.u(u), uv.v(corner[k][0] * w / 2)]; }) : [uv(i, n), uv(i, n), uv(i + 1, n), uv(i + 1, n)];
        for (let k = 0; k < 4; k++) { P.push(q[k].x, q[k].y, q[k].z); Nn.push(nn[k].x, nn[k].y, nn[k].z); Uv.push(us[k][0], us[k][1]); }
        const e1 = new THREE.Vector3().subVectors(q[1], q[0]), e2 = new THREE.Vector3().subVectors(q[2], q[0]), ok = new THREE.Vector3().crossVectors(e1, e2).dot(nm0) >= 0;
        if (ok) I.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); else I.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setIndex(I); return { geo: g, sec };
  }

  /* ---- her own flip-flop, as the base: Sandy's sandal (the fitted sole and Y strap from the classic kit, in her foot's bind space)
     is copied and reshaped; any extra strap is fitted to her foot and leg the same way the kit fits its own straps. */
  function V3(x, y, z) { return new THREE.Vector3(x, y, z); }
  /* ---- heels: her feet point down (the ankle bends) while the toes stay flat, so heel and toes both stand on the same floor */
  function tiltFeet(sandy, th, noToes) {
    const n3 = sandy.n3; th = +th || 0; noToes = !!noToes; if (!n3 || !n3.foot || (Math.abs((n3.__tilt || 0) - th) < 1e-4 && !!n3.__noToes === noToes)) return;
    if (!n3.__rest0) { sandy.object3d.updateMatrixWorld(true); n3.__rest0 = [0, 1].map(i => { const F = n3._foot && n3._foot[i], f = n3.foot[i]; return F && f && f.ball ? { ballInv: f.ball.matrixWorld.clone().invert(), rig0: new THREE.Matrix4().multiplyMatrices(F.fb.matrixWorld, F.toFoot) } : null; }); }
    if (!('__pp0' in n3)) n3.__pp0 = n3.postPose || null;
    const pp0 = n3.__pp0, X = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion(), qp = new THREE.Quaternion();
    const rot = (b, a) => { b.parent.getWorldQuaternion(qp); q.setFromAxisAngle(X, a); b.quaternion.premultiply(qp.clone().invert().multiply(q).multiply(qp)); };
    // (noToes is no longer used: sandals are fitted to her foot as it is, so her toes are never shrunk away inside a slipper)
    n3.postPose = (dt, now) => { if (pp0) pp0(dt, now); for (const f of n3.foot) for (const ch of f.toes || []) { const b = ch && ch[0]; if (!b) continue; if (!b.userData.__s0) b.userData.__s0 = b.scale.clone(); if (n3.__noToes) b.scale.setScalar(0.03); else b.scale.copy(b.userData.__s0); } const t = n3.__tilt || 0; if (!t) return; n3.root.updateMatrixWorld(true); for (const f of n3.foot) { if (!f.foot || !f.ball) continue; rot(f.foot, t); f.foot.updateMatrixWorld(true); rot(f.ball, -t); } };
    n3.__tilt = th; n3.__noToes = noToes; n3.update(0, performance.now()); n3.__skinW = null; sandy.object3d.updateMatrixWorld(true);
  }
  // how far the feet tip for a heel this high (the heel rises by heelH over the length from her heel to the ball of her foot)
  function tiltFor(sandy, d) {
    const F = sandy.n3 && sandy.n3._foot && sandy.n3._foot[0]; if (!F || !(d.heelH > 0.4)) return 0;
    let zMin = 1e9; for (const p of F.hull) zMin = Math.min(zMin, p[1]); const L = (F.Bl.z - zMin) * (F.fb.getWorldScale(new THREE.Vector3()).z || 1);
    return Math.asin(clamp(d.heelH / Math.max(8, L), 0, 0.55));
  }
  function sandalFit(sandy, i) {
    const n3 = sandy.n3, F = n3 && n3._foot && n3._foot[i], sd = n3 && n3.sandals && n3.sandals[i]; if (!F || !sd || !sd.sole) return null;
    const nb = n3.body; sandy.object3d.updateMatrixWorld(true); nb.skeleton.update();
    const rig = new THREE.Matrix4().multiplyMatrices(F.fb.matrixWorld, F.toFoot), rigInv = rig.clone().invert();
    const legs = F.legV.filter(v => v.p[1] > F.A.y - 2.5), nearLeg = p => { let b = null, bd = 1e9; for (const v of legs) { const d = (v.p[0] - p.x) ** 2 + (v.p[1] - p.y) ** 2 + (v.p[2] - p.z) ** 2; if (d < bd) { bd = d; b = v; } } return b; };
    // a point in her bind space -> the world: rigid on the foot (as her own sandal rides), following her skin up the leg
    // on a heel the ball of the foot bends back up: the forefoot follows the ball joint, the rest the foot joint
    const R0 = n3.__tilt && n3.__rest0 && n3.__rest0[i], ball = n3.foot && n3.foot[i] && n3.foot[i].ball, Mb = R0 && ball ? new THREE.Matrix4().multiplyMatrices(ball.matrixWorld, R0.ballInv).multiply(R0.rig0) : null;
    const footPt = p => { const a = p.clone().applyMatrix4(rig); if (!Mb) return a; let w = clamp((p.z - (F.Bl.z - 1.5)) / 3, 0, 1); w = w * w * (3 - 2 * w); return w > 0 ? a.lerp(p.clone().applyMatrix4(Mb), w) : a; };
    const toWorld = p => { const r = footPt(p), t = clamp((p.y - (F.A.y + 0.5)) / 2.5, 0, 1); if (t <= 0) return r; const v = nearLeg(p), s = nb.boneTransform(v.k, p.clone()).applyMatrix4(nb.matrixWorld); return r.lerp(s, t); };
    // her skin as she stands (posed, the foot drawn larger, toes resting on the sole): world points and normals of this leg
    if (!n3.__skinW || n3.__skinW.tilt !== (n3.__tilt || 0) + (n3.__noToes ? 'n' : '')) { const g = nb.geometry, P = g.attributes.position, I = g.index.array, pos = new Float32Array(P.count * 3), v = new THREE.Vector3(); for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k); nb.boneTransform(k, v); v.applyMatrix4(nb.matrixWorld); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; }
      const nrm = new Float32Array(P.count * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); for (let t = 0; t < I.length; t += 3) { const i0 = I[t], i1 = I[t + 1], i2 = I[t + 2]; a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3).sub(a); c.fromArray(pos, i2 * 3).sub(a); b.cross(c); for (const q of [i0, i1, i2]) { nrm[q * 3] += b.x; nrm[q * 3 + 1] += b.y; nrm[q * 3 + 2] += b.z; } }
      for (let k = 0; k < P.count; k++) { const l = Math.hypot(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]) || 1; nrm[k * 3] /= l; nrm[k * 3 + 1] /= l; nrm[k * 3 + 2] /= l; } n3.__skinW = { pos, nrm, n: P.count, tilt: (n3.__tilt || 0) + (n3.__noToes ? 'n' : '') }; }
    const SK = n3.__skinW, A0 = F.A.clone().applyMatrix4(rig), knee = F.K.clone().applyMatrix4(nb.matrixWorld), ids = [];
    for (let k = 0; k < SK.n; k++) { const x = SK.pos[k * 3], y = SK.pos[k * 3 + 1], z = SK.pos[k * 3 + 2]; if (y < A0.y + 40 && Math.hypot(x - A0.x, z - A0.z) < 22 && Math.sign(x) === Math.sign(A0.x)) ids.push(k); }
    const skinAt = p => { let bk = -1, bd = 1e9; for (const q of ids) { const d = (SK.pos[q * 3] - p.x) ** 2 + (SK.pos[q * 3 + 1] - p.y) ** 2 + (SK.pos[q * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; bk = q; } } if (bk < 0) return null; const n = V3(SK.nrm[bk * 3], SK.nrm[bk * 3 + 1], SK.nrm[bk * 3 + 2]); return { n, s: (p.x - SK.pos[bk * 3]) * n.x + (p.y - SK.pos[bk * 3 + 1]) * n.y + (p.z - SK.pos[bk * 3 + 2]) * n.z }; };
    const fwd = V3(0, 0, 1).transformDirection(rig), up = V3(0, 1, 0).transformDirection(rig);
    // the lowest point of her skin over (x, z), near height y (world): where the sole has to come up to
    const skinBelow = (x, z, y, r) => { let m = 1e9; r = r || 0.7; for (const q of ids) { const dx = SK.pos[q * 3] - x, dz = SK.pos[q * 3 + 2] - z, sy = SK.pos[q * 3 + 1]; if (dx * dx + dz * dz < r * r && sy > y - 3 && sy < y + 8 && sy < m) m = sy; } return m < 1e8 ? m : null; };
    return { F, sd, rig, rigInv, toWorld, footPt, skinAt, skinBelow, fwd, up, outerSign: F.A.x >= 0 ? 1 : -1, outer: V3(F.A.x >= 0 ? 1 : -1, 0, 0).transformDirection(rig) };
  }
  function rimArc(F, c, u, gap, n) {
    const nn = V3(-u.z, 0, u.x), near = F.all.filter(v => Math.abs((v[0] - c.x) * nn.x + (v[2] - c.z) * nn.z) < 1.3); if (near.length < 6) return null;
    const S = near.map(v => [(v[0] - c.x) * u.x + (v[2] - c.z) * u.z, v[1]]); let sa = 1e9, sb = -1e9, yt = -1e9; S.forEach(p => { sa = Math.min(sa, p[0]); sb = Math.max(sb, p[0]); yt = Math.max(yt, p[1]); });
    const sc = (sa + sb) / 2, yc = F.ymin + (yt - F.ymin) * 0.3, ytop = F.ytop, pts = [];
    for (let j = 0; j <= 24; j++) { const th = Math.PI * (1 - j / 24), dx = Math.cos(th), dy = Math.sin(th); let R = 0; for (const p of S) { const ox = p[0] - sc, oy = p[1] - yc, l = Math.hypot(ox, oy); if (l < 1e-3) continue; if ((ox * dx + oy * dy) / l > 0.93) R = Math.max(R, ox * dx + oy * dy); } const sp = sc + dx * (R + gap), yp = yc + dy * (R + gap); if (yp > ytop + 1.2) pts.push([sp, yp]); }
    const hull = F.hull, ray = (dx, dz) => { let best = 1e9; for (let k = 0; k < hull.length; k++) { const a = hull[k], b = hull[(k + 1) % hull.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - c.x) * ez - (a[1] - c.z) * ex) / den, w = ((a[0] - c.x) * dz - (a[1] - c.z) * dx) / den; if (t > 0 && w >= -1e-6 && w <= 1 + 1e-6 && t < best) best = t; } return best < 1e9 ? best : null; };
    const ra = ray(-u.x, -u.z), rb = ray(u.x, u.z); if (ra == null || rb == null || pts.length < 3) return null; const inset = 0.45;
    const all = [[-(ra - inset), ytop - 0.45], [-(ra - inset) * 0.97 + pts[0][0] * 0.03, ytop + 0.55], ...pts, [(rb - inset) * 0.97 + pts[pts.length - 1][0] * 0.03, ytop + 0.55], [rb - inset, ytop - 0.45]];
    return new THREE.CatmullRomCurve3(all.map(p => V3(c.x + u.x * p[0], p[1], c.z + u.z * p[0])), false, 'centripetal').getSpacedPoints(n || 40);
  }
  // pull a strap's centre line onto her skin: every inner point sits 'gap' off the skin (both edges of a w-wide strap clear it), smoothly
  // pull a strap's centre line (world) onto her posed skin: each free point sits 'gap' off it, with both edges of a w-wide strap clear, smoothly
  function hug(K, pts, sides, w, gap, fixed, opt) {
    const n = pts.length, closed = opt && opt.closed, nb = k => closed ? (k + n) % n : clamp(k, 0, n - 1);
    const need = (p, k) => { let m = null, dir = null; for (const e of [-1, 0, 1]) { const o = K.skinAt(p.clone().addScaledVector(sides[k], e * w / 2)); if (!o) continue; const q = gap - o.s; if (m === null || q > m) { m = q; dir = o.n; } } return { m: m || 0, dir }; };
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 0; k < n; k++) { if (fixed[k]) continue; const { m, dir } = need(pts[k], k); if (dir) pts[k].addScaledVector(dir, pass < 2 ? m * 0.8 : Math.max(0, m)); }
      for (let s = 0; s < 3; s++) { const c = pts.map(p => p.clone()); for (let k = 0; k < n; k++) { if (fixed[k] || (!closed && (k === 0 || k === n - 1))) continue; pts[k].copy(c[nb(k - 1)]).add(c[k].clone().multiplyScalar(2)).add(c[nb(k + 1)]).multiplyScalar(0.25); } }
    }
    for (let k = 0; k < n; k++) { if (fixed[k]) continue; const { m, dir } = need(pts[k], k); if (dir && m > 0) pts[k].addScaledVector(dir, m); }
    return pts;
  }
  // a strap's outward normals (world): her skin's normal under it, smoothed; the fixed ends lean out from the foot
  function skinNormals(K, pts, fixed, out, closed) {
    const n = pts.length, nr = pts.map((p, k) => { const o = K.skinAt(p); return o ? o.n.clone() : out(k); });
    fixed.forEach((f, k) => { if (f) nr[k] = out(k); });
    for (let pass = 0; pass < 5; pass++) { const c = nr.map(v => v.clone()); for (let k = 0; k < n; k++) { if (!closed && (k === 0 || k === n - 1)) continue; const a = c[closed ? (k + n - 1) % n : k - 1], b = c[closed ? (k + 1) % n : k + 1]; nr[k].copy(a).add(c[k].clone().multiplyScalar(2)).add(b).normalize(); } }
    return nr;
  }
  const tangentAt = (pts, k, closed) => { const n = pts.length; const a = pts[closed ? (k + n - 1) % n : Math.max(0, k - 1)], b = pts[closed ? (k + 1) % n : Math.min(n - 1, k + 1)]; return b.clone().sub(a).normalize(); };
  function legRing(F, h, gap, N) {
    N = N || 32; const V = F.legV; let w = h > F.A.y ? 1.1 : 0.7, S; do { S = V.filter(v => Math.abs(v.p[1] - h) < w); w *= 1.6; } while (S.length < 24 && w < 6);
    let cx = 0, cz = 0; S.forEach(v => { cx += v.p[0]; cz += v.p[2]; }); cx /= S.length; cz /= S.length; const R = new Float32Array(N).fill(-1);
    for (let j = 0; j < N; j++) { const th = j / N * Math.PI * 2, dx = Math.sin(th), dz = Math.cos(th); for (const v of S) { const ox = v.p[0] - cx, oz = v.p[2] - cz, l = Math.hypot(ox, oz); if (l < 1e-3) continue; const pr = ox * dx + oz * dz; if (pr / l > 0.86 && pr > R[j]) R[j] = pr; } }
    for (let it = 0; it < N; it++) { let ok = true; for (let j = 0; j < N; j++) if (R[j] < 0) { ok = false; const a = R[(j + N - 1) % N], b = R[(j + 1) % N]; if (a >= 0 || b >= 0) R[j] = a >= 0 && b >= 0 ? (a + b) / 2 : Math.max(a, b); } if (ok) break; }
    for (let pass = 0; pass < 3; pass++) { const c = R.slice(); for (let j = 0; j < N; j++) R[j] = Math.max(c[j], (c[(j + N - 1) % N] + 2 * c[j] + c[(j + 1) % N]) / 4); }
    return { h, cx, cz, R: Array.from(R, r => Math.max(0.5, r) + gap), N, at(th) { const f = ((th / (Math.PI * 2)) % 1 + 1) % 1 * N, j = Math.floor(f) % N, k = (j + 1) % N; return lerp(this.R[j], this.R[k], f - Math.floor(f)); } };
  }
  // one palette picture per pair: sole (fade), footbed, strap (fade)
  /* ---- one picture per pair: the straps, the sole's sides, the footbed and a plain strip, each a colour (or a fade) with an optional
     pattern from the pattern pack laid over it (its dark parts take the pattern colour). 1 cm of strap is PX pixels, so patterns
     keep their size whatever the strap; a strap's length wraps every PERIOD cm (whole tiles), so nothing stretches. */
  const TW = 512, PX = 22.857, TILE = 32, PERIOD = 8 * TILE / PX;
  const REG = { strap: [0, 128], sole: [136, 128], bed: [272, 128], plain: [416, 64] };
  const regV = (r, f) => { const [y0, h] = REG[r]; return 1 - (y0 + 2 + clamp(f, 0, 1) * (h - 4)) / TW; };
  const uFrac = f => (1 + clamp(f, 0, 1) * (TW - 2)) / TW, uCm = cm => (1 + cm * PX) / TW;
  const STRAP_UV = { cm: true, period: PERIOD, u: uCm, v: off => regV('strap', 0.5 + off * PX / (REG.strap[1] - 4)) };
  const hexRGB = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
  function sandalTex(d) {
    const cv = document.createElement('canvas'); cv.width = cv.height = TW; const x = cv.getContext('2d');
    const fill = (r, a, b) => { const [y0, h] = REG[r], g = x.createLinearGradient(0, 0, TW, 0); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, y0, TW, h); };
    fill('strap', d.strapCol, d.strapGrad ? d.strapCol2 : d.strapCol); fill('sole', d.soleCol, d.soleGrad ? d.soleCol2 : d.soleCol); fill('bed', d.bedCol, d.bedCol); fill('plain', d.strapCol, d.strapCol);
    const over = [['strap', d.strapPat, d.strapPatCol], ['sole', d.solePat, d.solePatCol], ['bed', d.bedPat, d.bedPatCol]].filter(o => o[1] >= 0 && PAT.lum);
    if (over.length) { const im = x.getImageData(0, 0, TW, TW), D = im.data;
      for (const [r, idx, col] of over) { const [y0, h] = REG[r], [cr, cg, cb] = hexRGB(col), ox = (idx % PAT.cols) * PAT.T, oy = Math.floor(idx / PAT.cols) * PAT.T, k = PAT.T / TILE;
        for (let y = y0; y < y0 + h; y++) for (let xx = 0; xx < TW; xx++) { const sx = ox + Math.floor(((xx % TILE) + 0.5) * k), sy = oy + Math.floor((((y - y0) % TILE) + 0.5) * k), L = 1 - (1 - PAT.lum[sy * PAT.w + sx] / 255) * PAT_K, a = 1 - L, p = (y * TW + xx) * 4; D[p] = D[p] * L + cr * a; D[p + 1] = D[p + 1] * L + cg * a; D[p + 2] = D[p + 2] * L + cb * a; } }
      x.putImageData(im, 0, 0); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.userData.canvas = cv; cv.__big = true; return t;
  }
  function buildSandals(d, ctx) {
    const { sandy } = ctx, own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugSandals'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'sandals', design: d };
    const tex = sandalTex(d); own.mats.push({ dispose() { tex.dispose(); } });
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: d.finish === 'matte' ? 0.85 : d.finish === 'metal' ? 0.28 : 0.3, metalness: d.finish === 'metal' ? 0.6 : 0, envMap: ENV, envMapIntensity: 0.6, side: THREE.DoubleSide }); own.mats.push(mat);
    const hwM = matFor(d.hw, 'metal'), T = d.strapT, SW = d.strapW, tilt0 = (sandy.n3 && sandy.n3.__tilt) || 0, toes0 = !!(sandy.n3 && sandy.n3.__noToes), tilt = tiltFor(sandy, d), noToes = false /* her toes are never tucked away: a slipper is made to fit over them */; tiltFeet(sandy, tilt, noToes); root.userData.tilt = tilt; root.userData.noToes = noToes;
    const add = (g, m, name) => { own.geos.push(g); const me = new THREE.Mesh(g, m || mat); me.name = name || ''; root.add(me); own.tris += triOf(g); return me; };
    const strapUV = STRAP_UV, ringUV = STRAP_UV;
    // a strap from its world centre line: hugged onto her skin, then swept as a flat band lying on it
    const strap = (K, pts, fixed, w, out, o) => { o = o || {}; const closed = !!o.closed;
      let nr = skinNormals(K, pts, fixed, out, closed); const sides = () => pts.map((p, k) => V3().crossVectors(nr[k], tangentAt(pts, k, closed)).normalize());
      hug(K, pts, sides(), w, o.gap || 0.2, fixed, { closed }); nr = skinNormals(K, pts, fixed, out, closed); hug(K, pts, sides(), w, o.gap || 0.2, fixed, { closed });
      const P = closed ? pts.concat([pts[0].clone()]) : pts, N = closed ? nr.concat([nr[0].clone()]) : nr;
      const g = sweep(P.map((p, k) => p.clone().addScaledVector(N[k], T / 2)), N, w, T, o.uv || strapUV, 'strap').geo; add(g, mat, 'strap');
      return { pts: P.map((p, k) => p.clone().addScaledVector(N[k], T)), nr: N };
    };
    for (const i of [0, 1]) {
      const K = sandalFit(sandy, i); if (!K) continue; const F = K.F, sd = K.sd, ytop = F.ytop, X = V3(1, 0, 0);
      // ---- the sole: her own flip-flop's sole, deepened (platform); on a heel it bends at the ball with her foot, and a wedge fills down to the floor
      sd.sole.updateMatrixWorld(true); const sg = sd.sole.geometry.clone().applyMatrix4(sd.sole.matrixWorld).applyMatrix4(K.rigInv), P = sg.attributes.position; sg.computeBoundingBox(); const bb = sg.boundingBox, T0 = Math.max(0.5, ytop - bb.min.y), z0 = bb.min.z, z1 = bb.max.z;
      for (const k of ['aToeW', 'aToeW5']) if (sg.attributes[k]) sg.deleteAttribute(k);
      // a little wider than her flip-flop's, so every strap lands on top of it, well inside the edge
      { const Zb = Math.floor(z0) - 1, nz = Math.ceil(z1) - Zb + 2, lo = new Float32Array(nz).fill(1e9), hi = new Float32Array(nz).fill(-1e9); for (let k = 0; k < P.count; k++) { const bi = Math.round(P.getZ(k)) - Zb; lo[bi] = Math.min(lo[bi], P.getX(k)); hi[bi] = Math.max(hi[bi], P.getX(k)); }
        const cxAt = z => { const i = clamp(Math.round(z) - Zb, 0, nz - 1); for (let r = 0; r < nz; r++) for (const j of [i - r, i + r]) if (j >= 0 && j < nz && hi[j] > lo[j]) return (lo[j] + hi[j]) / 2; return 0; };
        for (let k = 0; k < P.count; k++) { const x = P.getX(k), dx = x - cxAt(P.getZ(k)), w = clamp(Math.abs(dx) / 1.5, 0, 1); P.setX(k, x + Math.sign(dx) * 0.75 * w); } lo.forEach((v, j) => { if (hi[j] > v) { lo[j] -= 0.75; hi[j] += 0.75; } });
        // a smooth outline (filled, eased, read between the 1 cm slices) so whatever follows the sole's edge follows it cleanly
        { const ok = []; for (let j = 0; j < nz; j++) if (hi[j] > lo[j]) ok.push(j); for (let j = 0; j < nz; j++) if (!(hi[j] > lo[j]) && ok.length) { const n = ok.reduce((b, k) => Math.abs(k - j) < Math.abs(b - j) ? k : b, ok[0]); lo[j] = lo[n]; hi[j] = hi[n]; }
          for (let pass = 0; pass < 2; pass++) for (const A of [lo, hi]) { const c = A.slice(); for (let j = 1; j < nz - 1; j++) A[j] = (c[j - 1] + 2 * c[j] + c[j + 1]) / 4; } }
        K.soleEdge = z => { const f = clamp(z - Zb, 0, nz - 1.001), i = Math.floor(f), t = f - i; return [lerp(lo[i], lo[i + 1], t), lerp(hi[i], hi[i + 1], t)]; }; }
      K.soleZ = [z0, z1]; const tops = []; let yFloor = 1e9; for (let k = 0; k < P.count; k++) { const t = K.footPt(V3(P.getX(k), ytop, P.getZ(k))); tops.push(t); yFloor = Math.min(yFloor, t.y); } yFloor -= d.soleH;
      const wedge = d.heelType === 'wedge' && tilt > 0;
      { const Nn = (sg.computeVertexNormals(), sg.attributes.normal), U = new Float32Array(P.count * 2); for (let k = 0; k < P.count; k++) { const bed = Nn.getY(k) > 0.3 && P.getY(k) > ytop - 0.35, z = P.getZ(k); U[k * 2] = uFrac((z1 - z) / (z1 - z0)); if (bed) { const [l, h] = K.soleEdge ? K.soleEdge(z) : [bb.min.x, bb.max.x]; U[k * 2 + 1] = regV('bed', (P.getX(k) - l) / Math.max(1, h - l)); } else U[k * 2 + 1] = regV('sole', (ytop - P.getY(k)) / T0); } sg.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
      const fr = new Float32Array(P.count), bzA = new Float32Array(P.count); for (let k = 0; k < P.count; k++) { const y = P.getY(k), f = (ytop - y) / T0; fr[k] = clamp(f, 0, 1); bzA[k] = P.getZ(k); let w; if (f <= 0) w = K.footPt(V3(P.getX(k), y, P.getZ(k))); else { const t = tops[k], yb = wedge ? yFloor : t.y - d.soleH; w = V3(t.x, lerp(t.y, yb, clamp(f, 0, 1)), t.z); } P.setXYZ(k, w.x, w.y, w.z); }
      // the sole comes up under her foot (into it a little), so her heel and arch rest on it; its underside stays where it is
      { const Z0 = Math.floor(z0) - 1, nb2 = Math.ceil(z1) - Z0 + 2, gmin = new Float32Array(nb2).fill(1e9);
        for (let k = 0; k < P.count; k++) { if (fr[k] > 0.05) continue; const x = P.getX(k), y = P.getY(k), z = P.getZ(k), sb = K.skinBelow(x, z, y); if (sb == null) continue; const bi = Math.round(bzA[k]) - Z0; gmin[bi] = Math.min(gmin[bi], Math.max(0, sb + 0.2 - y)); }
        // one lift per slice along the foot (the smallest gap across it), smoothed heel to toe: the sole's top edge stays a clean line
        let last = -1; for (let i = 0; i < nb2; i++) if (gmin[i] < 1e8) { if (last < 0) for (let j = 0; j < i; j++) gmin[j] = gmin[i]; else for (let j = last + 1; j < i; j++) gmin[j] = lerp(gmin[last], gmin[i], (j - last) / (i - last)); last = i; } if (last < 0) gmin.fill(0); else for (let j = last + 1; j < nb2; j++) gmin[j] = gmin[last];
        for (let pass = 0; pass < 4; pass++) { const c = gmin.slice(); for (let i = 1; i < nb2 - 1; i++) gmin[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4; }
        const gAt = K.lift = z => { const f = clamp(z - Z0, 0, nb2 - 1.001), i = Math.floor(f); return lerp(gmin[i], gmin[i + 1], f - i); };
        for (let k = 0; k < P.count; k++) P.setY(k, P.getY(k) + gAt(bzA[k]) * (1 - fr[k])); }
      P.needsUpdate = true; sg.computeVertexNormals(); add(sg, mat, 'sole');
      // a block heel: the back of the same sole outline, from under her raised heel down to the floor
      if (d.heelType === 'block' && tilt > 0) {
        const zHeel = F.A.z + 1.5, zc = zHeel + 2.2, cut = [], H = F.hull; for (let k = 0; k < H.length; k++) { const a = H[k], b = H[(k + 1) % H.length], ia = a[1] <= zc, ib = b[1] <= zc; if (ia) cut.push(a); if (ia !== ib) { const t = (zc - a[1]) / (b[1] - a[1]); cut.push([a[0] + (b[0] - a[0]) * t, zc]); } }
        if (cut.length > 2) { const cx = cut.reduce((s, p) => s + p[0], 0) / cut.length, cz = cut.reduce((s, p) => s + p[1], 0) / cut.length, sh = new THREE.Shape(cut.map(p => new THREE.Vector2(cx + (p[0] - cx) * 0.86, cz + (p[1] - cz) * 0.86)));
          const hg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 4 }), HP = hg.attributes.position, U = new Float32Array(HP.count * 2);
          for (let k = 0; k < HP.count; k++) { const x = HP.getX(k), z = HP.getY(k), dd = HP.getZ(k), t = K.footPt(V3(x, ytop, z)), yTop = t.y - d.soleH + 0.15; HP.setXYZ(k, t.x, lerp(yTop, yFloor, dd), t.z); U[k * 2] = uFrac((z1 - z) / (z1 - z0)); U[k * 2 + 1] = regV('sole', 0.3 + dd * 0.7); }
          HP.needsUpdate = true; hg.setAttribute('uv', new THREE.BufferAttribute(U, 2)); hg.computeVertexNormals(); add(hg, mat, 'heel'); }
      }
      const paths = [];
      // ---- the Y strap: her flip-flop's own strap (as fitted to her standing foot), thickened outward and widened sideways
      if (d.style !== 'slide' && d.style !== 'slipper' && sd.strap) {
        sd.strap.updateMatrixWorld(true); const g = sd.strap.geometry.clone().applyMatrix4(sd.strap.matrixWorld).applyMatrix4(K.rigInv); for (const k of ['aToeW', 'aToeW5']) if (g.attributes[k]) g.deleteAttribute(k); const bindP = g.attributes.position.array.slice(); { const GP = g.attributes.position, v = V3(); for (let k = 0; k < GP.count; k++) { const w = K.footPt(v.fromBufferAttribute(GP, k)); GP.setXYZ(k, w.x, w.y, w.z); } GP.needsUpdate = true; }
        const SP = g.attributes.position; g.computeVertexNormals(); const SN = g.attributes.normal, key = k => Math.round(SP.getX(k) * 50) + ',' + Math.round(SP.getY(k) * 50) + ',' + Math.round(SP.getZ(k) * 50), acc = new Map();
        for (let k = 0; k < SP.count; k++) { const kk = key(k); let a = acc.get(kk); if (!a) acc.set(kk, a = V3()); a.add(V3(SN.getX(k), SN.getY(k), SN.getZ(k))); }
        const dt = Math.max(-0.15, T - 0.35), dw = Math.max(-0.25, (SW - 1.2) * 0.4), p = V3(), moved = new Map(), yFloor = V3(0, ytop + 0.25, 0).applyMatrix4(K.rig).y;
        for (let k = 0; k < SP.count; k++) { const kk = key(k); if (!moved.has(kk)) { p.fromBufferAttribute(SP, k); let m = V3(); if (bindP[k * 3 + 1] > ytop + 0.25) { const n = acc.get(kk).clone().normalize(), o = K.skinAt(p), on = o ? n.dot(o.n) : 1; m = n.multiplyScalar(Math.max(0, on) * dt + (1 - Math.abs(on)) * dw); } moved.set(kk, m); } const m = moved.get(kk); SP.setXYZ(k, SP.getX(k) + m.x, SP.getY(k) + m.y, SP.getZ(k) + m.z); }
        // gradient along the foot, heel to toe
        let f0 = 1e9, f1 = -1e9; for (let k = 0; k < SP.count; k++) { const f = p.fromBufferAttribute(SP, k).dot(K.fwd); f0 = Math.min(f0, f); f1 = Math.max(f1, f); }
        const U = new Float32Array(SP.count * 2); for (let k = 0; k < SP.count; k++) { U[k * 2] = uCm(f1 - p.fromBufferAttribute(SP, k).dot(K.fwd)); U[k * 2 + 1] = regV('strap', 0.15 + clamp((bindP[k * 3 + 1] - ytop) / 6, 0, 1) * 0.7); } g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.computeVertexNormals(); add(g, mat, 'strap');
        // its outer branch, traced along the top of the strap (for the charms); the knot over the toe post (for the knob)
        const W = F.t1.clone().add(F.t2).multiplyScalar(0.5), zm = F.Bl.z - 5, [xa, xb] = F.widthAt(zm), xo = K.outerSign > 0 ? Math.max(xa, xb) : Math.min(xa, xb), br = [], bn = [];
        const SB = []; for (let k = 0; k < SP.count; k++) SB.push(V3(bindP[k * 3], bindP[k * 3 + 1], bindP[k * 3 + 2]));
        for (let s = 0; s <= 16; s++) { const t = s / 16, x = lerp(W.x, xo, t), z = lerp(W.z, zm, t); let best = null, bk = -1; SB.forEach((q, k) => { const dx = q.x - x, dz = q.z - z; if (dx * dx + dz * dz < 0.7 && (!best || q.y > best.y)) { best = q; bk = k; } }); if (best && best.y > ytop + 0.6) { const wp = p.fromBufferAttribute(SP, bk).clone(), o = K.skinAt(wp); br.push(wp); bn.push((o ? o.n.clone() : K.up.clone()).add(K.up).normalize()); } }
        if (br.length > 3) paths.push({ pts: br.reverse(), nr: bn.reverse(), main: d.style === 'thong' });
        if (d.style === 'thong') { const top = br.length ? br[br.length - 1] : K.footPt(W), kg = new THREE.SphereGeometry(Math.max(0.45, SW * 0.38), 10, 8); kg.translate(top.x, top.y + 0.2, top.z); add(kg, hwM, 'knob'); }
      }
      // ---- a band across her foot, rim to rim, lying on her skin
      const across = (z, w, main) => { const c = V3(F.Bl.x, 0, z), pb = rimArc(F, c, X, 0.3, 36); if (!pb) return; if (K.soleEdge) for (const q of pb) { if (q.y > ytop + 1.6) continue; const [l, h] = K.soleEdge(q.z); const m = 0.7 + T * 1.2; q.x = clamp(q.x, l + m, h - m); } const fixed = pb.map(q => q.y < ytop + 0.9), pts = pb.map(q => K.footPt(q));
        const mid = pts.reduce((a, q) => a.add(q), V3()).multiplyScalar(1 / pts.length); const out = k => { const o = V3().crossVectors(tangentAt(pts, k), K.fwd).normalize(); if (o.dot(pts[k].clone().sub(mid)) < 0) o.negate(); return o; };
        const r = strap(K, pts, fixed, w, out); const outerFirst = r.pts[0].clone().sub(r.pts[r.pts.length - 1]).dot(K.outer) > 0; paths.push({ pts: outerFirst ? r.pts : r.pts.slice().reverse(), nr: outerFirst ? r.nr : r.nr.slice().reverse(), main }); };
      if (d.style === 'slide') across(F.Bl.z - 1.6, Math.max(1.8, SW * 1.5), true);
      // ---- a slipper: a soft closed shell over the front of her foot, grown from the sole's own outline (its edge runs along the sole's
      //      edge, its toe ends at the sole's tip, rounded like a real slipper), open from the instep back, with a plush collar
      if (d.style === 'slipper' && K.soleEdge) {
        const NU = 22, NZ = 20, PW = 3.0, BULGE = 0.1, gap = 0.5 + T * 0.3, zB = F.A.z + 7.2, inset = 0;
        let zEnd = K.soleZ ? K.soleZ[1] - 0.25 : F.zTip + 1;
        // what the shell must clear: her whole foot, toes included (the slipper fits her foot; her toes are not tucked away), slice by slice
        const nbS = sandy.n3.body, SIa = nbS.geometry.attributes.skinIndex, SWa = nbS.geometry.attributes.skinWeight, bones = nbS.skeleton.bones;
        const isToe = k => { let bi = 0, bw = 0; for (let j = 0; j < 4; j++) { const w = SWa.array[k * 4 + j]; if (w > bw) { bw = w; bi = SIa.array[k * 4 + j]; } } return /^(leg_[LR]_(foot|ball)_jnt|toe0\d_[LR]_\d+_jnt)$/.test(bones[bi].name); };
        const pts0 = F.legV.filter(v => v.p[1] < ytop + 10 && isToe(v.k)).map(v => v.p);
        // its toe reaches a little past her longest toe (over the sole's tip if it has to), so the tips are inside it too
        { let zt = -1e9; for (const p of pts0) if (p[2] > zt) zt = p[2]; if (zt > -1e8) zEnd = Math.max(zEnd, zt + 0.9); }
        // a fixed shape, not a cast of her foot: a quarter-ellipse from the collar down to the toe, the same arch across every slice,
        // scaled up just enough (one number for the whole slipper) that her foot fits inside with room to spare
        const zs = []; for (let k = 0; k <= NZ; k++) { const t = k / NZ; zs.push(lerp(zB, zEnd, 1 - Math.pow(1 - t, 1.4))); }
        const PF = 3.4, prof = z => { const t = clamp((z - zB) / (zEnd - zB), 0, 1); return Math.pow(1 - Math.pow(t, PF), 1 / PF); };   // a rounder toe box, tall enough over her toes right up to its tip
        // wide enough for her foot too: if a toe sits out by the sole's edge, the whole shell is that much wider (one number again)
        let WD = 1; for (const p of pts0) { if (p[2] < zB || p[2] > zEnd || p[1] < ytop + 0.4) continue; const [l, h] = K.soleEdge(p[2]), c = (l + h) / 2, a = Math.max(0.6, (h - l) / 2 - inset) * (1 + BULGE * 0.7); WD = Math.max(WD, Math.abs(p[0] - c) / a / 0.86); } WD = Math.min(WD, 1.3);
        let S = 3.5; for (const p of pts0) { if (p[2] < zB || p[2] > zEnd) continue; const t = (p[2] - zB) / (zEnd - zB); if (t > 0.97) continue; const [l, h] = K.soleEdge(p[2]), c = (l + h) / 2, a = Math.max(0.6, (h - l) / 2 - inset) * (1 + BULGE * 0.7) * WD, u = Math.abs(p[0] - c) / a; if (u >= 0.96) continue; const need = (p[1] + gap - ytop) / (prof(p[2]) * Math.pow(1 - Math.pow(u, PW), 1 / PW)); if (need > S) S = need; }
        S = Math.min(S, 14); const Hs = zs.map(z => Math.max(0.05, S * prof(z)));
        const rows = zs.map((z, k) => { const [l, h] = K.soleEdge(z), c = (l + h) / 2, a = Math.max(0.3, (h - l) / 2 - inset) * WD * (k === zs.length - 1 ? 0.2 : 1), r = []; for (let j = 0; j < NU; j++) { const th = Math.PI * (1 - j / (NU - 1)), cx = Math.cos(th), sy = Math.sin(th), x = c + a * (1 + BULGE * Math.sin(Math.PI * Math.min(1, sy * 1.15))) * Math.sign(cx) * Math.pow(Math.abs(cx), 2 / PW), y = ytop - 0.15 + (Hs[k] + 0.15) * Math.pow(sy, 2 / PW); r.push(V3(x, y, z)); } return r; });
        // front first, so the opening is the last row
        rows.reverse(); const W = NU, wr = rows.map(r => r.map(p => { const w = K.footPt(p), hf = clamp((p.y - ytop) / 3, 0, 1); if (K.lift) w.y += K.lift(p.z) * (1 - hf); return w; }));
        const pos = [], uv = [], idx = []; wr.forEach((r, ri) => r.forEach((p, j) => { pos.push(p.x, p.y, p.z); uv.push(uFrac(ri / (wr.length - 1)), regV('strap', j / (W - 1))); }));
        for (let r = 0; r < wr.length - 1; r++) for (let j = 0; j < W - 1; j++) { const a2 = r * W + j, b2 = a2 + 1, c2 = a2 + W, e2 = c2 + 1; idx.push(a2, c2, b2, b2, c2, e2); }
        const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setIndex(idx); dg.computeVertexNormals();
        { const mid = Math.floor(wr.length / 2) * W + Math.floor(W / 2), Np0 = dg.attributes.normal; if (V3(Np0.getX(mid), Np0.getY(mid), Np0.getZ(mid)).dot(K.up) < 0) { for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; } dg.setIndex(idx.slice()); dg.computeVertexNormals(); } }
        { const n = pos.length / 3, Np = dg.attributes.normal, P2 = pos.slice(), U2 = uv.slice(), I2 = idx.slice();
          for (let k = 0; k < n; k++) { P2.push(pos[k * 3] - Np.getX(k) * T, pos[k * 3 + 1] - Np.getY(k) * T, pos[k * 3 + 2] - Np.getZ(k) * T); U2.push(uv[k * 2], uv[k * 2 + 1]); }
          for (let t = 0; t < idx.length; t += 3) I2.push(idx[t] + n, idx[t + 2] + n, idx[t + 1] + n);
          const back = (wr.length - 1) * W; for (let j = 0; j < W - 1; j++) { const a2 = back + j, b2 = a2 + 1; I2.push(a2, a2 + n, b2, b2, a2 + n, b2 + n); }
          dg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); dg.setIndex(I2); dg.computeVertexNormals(); }
        add(dg, mat, 'slipper');
        // the plush collar round the opening (the footbed's colour)
        const backRow = wr[wr.length - 1], cr = 0.55 + T * 0.8, cg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(backRow.map(p => p.clone())), 40, cr, 10, false), CU = cg.attributes.uv; for (let k = 0; k < CU.count; k++) CU.setXY(k, uFrac(CU.getX(k)), regV('bed', 0.5)); add(cg, mat, 'collar');
        const cc = backRow.reduce((a2, p) => a2.add(p), V3()).multiplyScalar(1 / W); cc.y -= 3; const nr = backRow.map(p => p.clone().sub(cc).normalize()), cp = backRow.map((p, k) => p.clone().addScaledVector(nr[k], cr));
        const outerFirst = cp[0].clone().sub(cp[cp.length - 1]).dot(K.outer) > 0; paths.push({ pts: outerFirst ? cp : cp.slice().reverse(), nr: outerFirst ? nr : nr.slice().reverse(), main: true });
      }
      // ---- round her leg: an ankle strap, rings up the shin, a wrap; a heel strap up the back of her heel
      const ANK = F.A.y + 1.6, topY = Math.min(F.calfTop + 1, ANK + d.shaft);
      const ringW = (h, n) => { const R = legRing(F, h, 0.3, n || 22), pts = []; for (let j = 0; j < R.N; j++) { const th = j / R.N * Math.PI * 2, r = R.R[j]; pts.push(K.toWorld(V3(R.cx + Math.sin(th) * r, h, R.cz + Math.cos(th) * r))); } return { R, pts }; };
      const ringOut = (pts) => { const c = pts.reduce((a, q) => a.add(q), V3()).multiplyScalar(1 / pts.length); return k => { const o = pts[k].clone().sub(c); o.y = 0; return o.normalize(); }; };
      if (d.style === 'ankle' || d.style === 'gladiator' || d.style === 'wrap') {
        const ank = ringW(ANK), wA = Math.max(0.8, SW), r = strap(K, ank.pts, ank.pts.map(() => false), wA, ringOut(ank.pts), { closed: true, uv: ringUV });
        // the ankle strap's front half, outer side first (charms hang there); a buckle on the outer side
        { const n = ank.pts.length, ctr = r.pts.slice(0, n).reduce((a, q) => a.add(q), V3()).multiplyScalar(1 / n); let ko = 0, best = -1e9; for (let k = 0; k < n; k++) { const v = r.pts[k].clone().sub(ctr).dot(K.outer); if (v > best) { best = v; ko = k; } }
          const dirF = r.pts[(ko + 1) % n].clone().sub(r.pts[ko]).dot(K.fwd) > 0 ? 1 : -1, half = [], hn = []; for (let s = 0; s <= n / 2; s++) { const k = ((ko + dirF * s) % n + n) % n; half.push(r.pts[k]); hn.push(r.nr[k]); } paths.push({ pts: half, nr: hn, main: true, leg: true });
          const bg = new THREE.TorusGeometry(Math.max(0.5, SW * 0.42), 0.14, 6, 14), bq = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), r.nr[ko]); bg.applyQuaternion(bq); bg.translate(r.pts[ko].x + r.nr[ko].x * 0.15, r.pts[ko].y + r.nr[ko].y * 0.15, r.pts[ko].z + r.nr[ko].z * 0.15); add(bg, hwM, 'buckle'); }
        // heel strap: from the back of the sole up the back of her heel to the ankle strap
        { const pts = [], fixed = []; for (let s = 0; s <= 14; s++) { const y = lerp(ytop - 0.1, ANK, s / 14), R = legRing(F, Math.max(ytop + 0.4, y), 0.3), rr = R.at(Math.PI); pts.push(K.toWorld(V3(R.cx, y, R.cz - rr))); fixed.push(s === 0); }
          strap(K, pts, fixed, Math.max(0.9, SW * 0.9), () => K.fwd.clone().negate()); }
        if (d.style === 'gladiator') {
          across(F.Bl.z - 4.6, Math.max(0.8, SW * 0.8), false);
          const n = Math.max(2, Math.round((topY - ANK) / 4.2)); for (let k = 1; k <= n; k++) { const rg = ringW(ANK + (topY - ANK) * k / n); strap(K, rg.pts, rg.pts.map(() => false), Math.max(0.7, SW * 0.85), ringOut(rg.pts), { closed: true, uv: ringUV }); }
          const fp = []; for (let s = 0; s <= 12; s++) { const y = lerp(ANK, topY, s / 12), R = legRing(F, y, 0.3 + T); fp.push(K.toWorld(V3(R.cx, y, R.cz + R.at(0)))); } strap(K, fp, fp.map(() => false), Math.max(0.6, SW * 0.55), () => K.fwd.clone(), { gap: 0.2 + T });
        }
        if (d.style === 'wrap') { const pts = [], n = 40, turns = Math.max(1.2, (topY - ANK) / 6); for (let s = 0; s <= n; s++) { const t = s / n, y = lerp(ANK, topY, t), R = legRing(F, y, 0.3), th = (K.outerSign > 0 ? Math.PI / 2 : -Math.PI / 2) + K.outerSign * Math.PI * 2 * turns * t, rr = R.at(th); pts.push(K.toWorld(V3(R.cx + Math.sin(th) * rr, y, R.cz + Math.cos(th) * rr))); } strap(K, pts, pts.map(() => false), Math.max(0.7, SW * 0.8), ringOut(pts)); }
      }
      // ---- charms, pinned along the main strap, facing out
      const mp = paths.find(q => q.main) || paths[0]; if (!mp) continue;
      for (const e of d.charms.slice().sort((a, b) => a.at - b.at)) {
        const f = lerp(mp.leg ? 0 : 0.12, mp.leg ? 1 : 0.88, clamp((1 - e.at) / 2, 0, 1)) * (mp.pts.length - 1), a = Math.floor(f), b = Math.min(mp.pts.length - 1, a + 1), wp = mp.pts[a].clone().lerp(mp.pts[b], f - a), nn = mp.nr[a].clone().lerp(mp.nr[b], f - a).normalize();
        const size = e.size * KN, el = makeEl(Object.assign({}, e, { size }), own, true), up = Math.abs(nn.y) > 0.85 ? K.fwd.clone() : V3(0, 1, 0), yy = up.clone().addScaledVector(nn, -up.dot(nn)).normalize(), xx = V3().crossVectors(yy, nn).normalize();
        el.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, nn)); el.position.copy(wp).addScaledVector(nn, size * 0.5 * 0.6 + 0.1); root.add(el);
      }
    }
    tiltFeet(sandy, tilt0, toes0);
    return { root, d, info: { tris: Math.round(own.tris) }, frame: 'world', dispose() { for (const g of own.geos) g.dispose(); for (const m of own.mats) m.dispose(); } };
  }

  /* ================================================================ sound
     Sound is what she wears on her ears: over-ear headphones (two cups on cushions, a headband over her head on a slider or a
     fork, toppers such as cat ears, an optional boom mic and a glowing ring on each cup), fluffy earmuffs, and earbuds (a stem
     or a round bud). Headphones and earbuds can be wired: a cord (straight or coiled; a Y cable with an inline remote for
     earbuds) runs down her chest to a plug. Sound has no charms. Patterns from the pattern pack go on the cups (the muffs'
     fur) and on the band. Her head and ears are measured from her own mesh. */
  const SOUND_KINDS = [['over', 'Headphones'], ['muffs', 'Earmuffs'], ['buds', 'Earbuds']];
  const SOUND_LABEL = Object.fromEntries(SOUND_KINDS);
  const CUPS = [['round', 'Round'], ['oval', 'Oval'], ['square', 'Square'], ['heart', 'Heart'], ['cloud', 'Cloud']];
  const CUP_LABEL = Object.fromEntries(CUPS);
  const TOPPERS = [['none', 'None'], ['cat', 'Cat ears'], ['bunny', 'Bunny ears'], ['bear', 'Bear ears'], ['devil', 'Devil horns'], ['bow', 'Bow']];
  const TOPPER_LABEL = Object.fromEntries(TOPPERS);
  const YOKES = [['post', 'Slider'], ['fork', 'Fork']];
  const BUDS = [['stem', 'Stem'], ['round', 'Round']];
  const BUD_LABEL = Object.fromEntries(BUDS);
  const SND_LIM = { cupR: [4.8, 8.5], cupD: [2, 5.5], padT: [0.8, 2.6], bandW: [0.8, 5], bandT: [0.35, 2], budSize: [2, 5], cordLen: [0, 1] };
  const EAR_DEPTH = 4.4;   // a cup and its cushion together are at least EAR_DEPTH deep (her ear sticks out that far)
  const SND_COLS = ['cupCol', 'cupCol2', 'padCol', 'bandCol', 'topCol', 'hw', 'cordCol', 'glowCol', 'cupPatCol', 'bandPatCol'];
  DEF.sound = () => ({ v: 1, brand: 'grug', kind: 'over', cup: 'round', cupR: 6.2, cupD: 3.2, padT: 1.6, bandW: 3, bandT: 1, yoke: 'post', bandPad: true, top: 'none', mic: false, glow: false, bud: 'stem', budSize: 3.6, wired: false, coil: false, remote: false, cordLen: 0.5, cupCol: '#ff8fc2', cupCol2: '#fff6f2', padCol: '#2a2a31', bandCol: '#ff8fc2', topCol: '#ff8fc2', hw: '#c8ccd2', cordCol: '#16161a', glowCol: '#4fd8e0', finish: 'gloss', cupPat: -1, cupPatCol: '#ffffff', bandPat: -1, bandPatCol: '#ffffff', charms: [] });
  LIMITS.sound = { n: 0 };
  // what a design really has (a setting that doesn't apply to its kind is kept, so switching back brings it back)
  const isWired = d => !!d.wired && d.kind !== 'muffs', hasCoil = d => isWired(d) && !!d.coil && d.kind === 'over', hasRemote = d => isWired(d) && !!d.remote && d.kind === 'buds';
  const hasMic = d => !!d.mic && d.kind === 'over', hasGlow = d => !!d.glow && d.kind === 'over', topOf = d => d.kind === 'buds' ? 'none' : d.top;
  const shadeOf = base => { const c = new THREE.Color(base), h = {}; c.getHSL(h); c.setHSL(h.h, h.s, h.l > 0.55 ? h.l - 0.22 : h.l + 0.22); return '#' + c.getHexString(); };

  function validateSnd(src, brand) {
    const notes = [], D0 = DEF.sound(), d = Object.assign(DEF.sound(), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!SOUND_LABEL[d.kind]) d.kind = 'over'; if (!CUP_LABEL[d.cup]) d.cup = 'round'; if (!TOPPER_LABEL[d.top]) d.top = 'none'; if (!YOKES.some(y => y[0] === d.yoke)) d.yoke = 'post'; if (!BUD_LABEL[d.bud]) d.bud = 'stem';
    for (const k of Object.keys(SND_LIM)) { const v = +d[k]; d[k] = clamp(isFinite(v) && d[k] !== null && d[k] !== '' ? v : D0[k], SND_LIM[k][0], SND_LIM[k][1]); }
    for (const k of SND_COLS) if (!isHex(d[k])) d[k] = D0[k];
    for (const k of ['cupPat', 'bandPat']) { const v = Math.round(+d[k]); d[k] = isFinite(v) && v >= 0 && v < PAT_N ? v : -1; }
    if (!FINISHES.some(f => f[0] === d.finish)) d.finish = 'gloss';
    for (const k of ['wired', 'coil', 'remote', 'mic', 'glow', 'bandPad']) d[k] = !!d[k];
    if (d.kind === 'over' && d.padT + d.cupD < EAR_DEPTH) { d.cupD = Math.min(SND_LIM.cupD[1], EAR_DEPTH - d.padT); notes.push('Cups kept deep enough to cover her ears'); }
    d.charms = [];   // sound has no charms
    if (d.brand === 'kimiland') {
      let changed = false;
      for (const k of SND_COLS) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); changed = true; }
      if (changed) notes.push('Brought to KIMILAND pastels');
    }
    return { d, notes };
  }

  function randomSnd(seed, o) {
    o = o || {}; const r = rng('jewel:sound:' + seed), brand = o.brand || brandFor(seed), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ valentines: 1.6, christmas: 1.6, halloween: 1.8, sweet: 2, classic: 3, ocean: 1.2, forest: 0.8, night: 1.8 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.pick(T.cols), metal = kimi ? pal.metal : r.pick(T.metal);
    const NEON = ['#4fd8e0', '#ff6fb0', '#9be338', '#9a5cf0', '#f5d21f', '#7cc4ff'], DARK = ['#16161a', '#2a2a31', '#3a3b40'];
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF.sound(); d.brand = brand;
    const recolour = () => {
      const neutral = !kimi && r.chance(0.35);
      d.cupCol = kimi ? pal.main : neutral ? r.pick(['#16161a', '#f4f4f2', '#c8ccd2', '#3a3b40']) : pick();
      d.cupCol2 = kimi ? r.pick(pal.acc.concat(pal.mains)) : r.chance(0.3) ? d.cupCol : pick();
      d.padCol = kimi ? r.pick(['#fffafc', pal.main, r.pick(PINKS)]) : r.pick(DARK.concat(['#f4f4f2', d.cupCol2]));
      d.bandCol = kimi ? (r.chance(0.5) ? pal.main : '#fffafc') : r.chance(0.6) ? d.cupCol : pick();
      d.topCol = d.top === 'devil' && !kimi ? r.pick(['#d62f2f', '#16161a', '#7d3fc4']) : r.chance(0.6) ? d.bandCol : d.cupCol2;
      d.hw = metal; d.cordCol = kimi ? r.pick([pal.main, '#fffafc']) : r.pick(['#16161a', '#f4f4f2', d.cupCol, d.cupCol2]);
      d.glowCol = kimi ? r.pick(['#c4e1ff', '#e0d3ff', '#ffb7d5', '#c6f3dd']) : r.pick(NEON);
      d.cupPatCol = shadeOf(d.kind === 'muffs' ? d.cupCol : d.cupCol2); d.bandPatCol = shadeOf(d.bandCol);
    };
    if (o.keep === 'shape') { recolour(); return validateSnd(d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? { cols: SND_COLS.map(k => d[k]) } : null;
    d.kind = o.kind && SOUND_LABEL[o.kind] ? o.kind : r.w({ over: 4, muffs: 2.2, buds: 3 });
    d.cup = r.w(kimi ? { round: 2.5, oval: 1.2, square: 0.8, heart: 2, cloud: 1.6 } : { round: 3, oval: 2, square: 1.6, heart: 0.7, cloud: 0.5 });
    d.cupR = d.kind === 'muffs' ? r.f(5.4, 7.6) : r.f(5.4, 7.4); d.padT = r.f(1.1, 2.1); d.cupD = r.f(Math.max(2.4, EAR_DEPTH - d.padT + 0.2), 4.6);
    d.bandW = d.kind === 'muffs' ? r.f(0.9, 2) : r.f(2, 4.2); d.bandT = d.kind === 'muffs' ? r.f(0.4, 0.8) : r.f(0.7, 1.5);
    d.yoke = r.chance(0.45) ? 'fork' : 'post'; d.bandPad = d.kind === 'over' && r.chance(0.55);
    d.top = r.w(kimi ? { none: 2, cat: 2.2, bunny: 1.6, bear: 1.6, devil: 0.3, bow: 1.4 } : theme === 'halloween' || theme === 'night' ? { none: 3, cat: 1.6, devil: 1.8, bunny: 0.4, bear: 0.4, bow: 0.3 } : { none: 6, cat: 1.2, bunny: 0.6, bear: 0.6, devil: 0.3, bow: 0.6 });
    d.mic = d.kind === 'over' && r.chance(theme === 'night' ? 0.4 : 0.14); d.glow = d.kind === 'over' && r.chance(theme === 'night' || theme === 'halloween' ? 0.35 : kimi ? 0.15 : 0.12);
    d.bud = r.chance(0.65) ? 'stem' : 'round'; d.budSize = r.f(3, 4.2);
    d.wired = d.kind !== 'muffs' && r.chance(d.kind === 'buds' ? 0.5 : 0.4); d.coil = d.wired && d.kind === 'over' && r.chance(0.45); d.remote = d.wired && d.kind === 'buds' && r.chance(0.6); d.cordLen = r.f(0.15, 0.95);
    d.cupPat = r.chance(d.kind === 'muffs' ? 0.3 : 0.4) ? r.i(0, PAT_N - 1) : -1; d.bandPat = d.kind === 'over' && r.chance(0.3) ? r.i(0, PAT_N - 1) : -1;
    d.finish = d.kind === 'muffs' ? 'matte' : r.w({ gloss: 4, matte: 3, metal: kimi ? 0.2 : 1 });
    d.charms = [];
    recolour();
    if (keepC) SND_COLS.forEach((k, i) => { d[k] = keepC.cols[i]; });
    return validateSnd(d, brand).d;
  }

  function nameSnd(d, seed) {
    const r = rng('jname:' + seed + ':sound'), kimi = d.brand === 'kimiland', colour = colourName(d.cupCol, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(FLAVOUR), top = topOf(d);
    let noun = { over: r.pick(['Headphones', 'Headphones', 'Cans', 'Over-Ears', 'Studio Headphones']), muffs: r.pick(['Earmuffs', 'Ear Warmers', 'Fluffy Earmuffs', 'Muffs']), buds: r.pick(['Earbuds', 'Buds', 'In-Ears']) }[d.kind];
    if (hasMic(d)) noun = r.pick(['Headset', 'Gaming Headset']);
    const extra = top !== 'none' ? { cat: 'Kitty', bunny: 'Bunny', bear: 'Teddy', devil: 'Devil', bow: 'Bow' }[top] : hasGlow(d) ? r.pick(['Glow', 'Neon', 'Light-Up']) : hasCoil(d) ? 'Coiled' : isWired(d) ? r.pick(['Wired', 'Corded']) : d.kind === 'buds' && r.chance(0.3) ? 'Wireless' : '';
    const pat = d.cupPat >= 0 ? r.pick(['Print', 'Patterned', 'Graphic']) : '';
    const forms = [[colour, extra, noun], [fl, extra || colour, noun], [fl, pat || colour, noun], [extra || pat || fl, colour, noun], [colour, pat || extra, noun]];
    return forms[r.i(0, 4)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function tagsSnd(d) {
    const t = ['Sound', SOUND_LABEL[d.kind]], top = topOf(d);
    if (d.kind !== 'muffs') t.push(isWired(d) ? 'Wired' : 'Wireless'); if (hasCoil(d)) t.push('Coiled cord'); if (hasRemote(d)) t.push('Remote'); if (hasMic(d)) t.push('Mic'); if (hasGlow(d)) t.push('Glow');
    if (top !== 'none') t.push(TOPPER_LABEL[top]); if (d.kind === 'over') t.push(CUP_LABEL[d.cup] + ' cups'); if (d.kind === 'buds') t.push(BUD_LABEL[d.bud] + ' buds');
    if (d.cupPat >= 0 || (d.kind === 'over' && d.bandPat >= 0)) t.push('Patterned');
    if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  function familiesSnd(d) {
    const f = new Set([famOfHex(d.cupCol)]); if (d.kind !== 'muffs') f.add(famOfHex(d.cupCol2)); if (d.kind !== 'buds') f.add(famOfHex(d.bandCol)); if (d.cupPat >= 0) f.add(famOfHex(d.cupPatCol)); if (hasGlow(d)) f.add(famOfHex(d.glowCol));
    if (f.size > 3) f.add('multi'); return f;
  }
  function describeSnd(d) {
    const kimi = d.brand === 'kimiland', col = colourName(d.cupCol, kimi).toLowerCase(), top = topOf(d);
    const topW = top !== 'none' ? ', topped with ' + TOPPER_LABEL[top].toLowerCase() : '';
    let s;
    if (d.kind === 'over') s = `${hasMic(d) ? 'A gaming headset' : 'Over-ear headphones'} with ${col} ${CUP_LABEL[d.cup].toLowerCase()} cups${d.cupPat >= 0 ? ' in a print' : ''} on a ${colourName(d.bandCol, kimi).toLowerCase()} headband${topW}${hasGlow(d) ? ', a glowing ring round each cup' : ''}${hasMic(d) ? ', a mic on a boom' : ''}`;
    else if (d.kind === 'muffs') s = `Fluffy ${col} earmuffs${d.cupPat >= 0 ? ' with a print in the fur' : ''} on a thin ${colourName(d.bandCol, kimi).toLowerCase()} band${topW}`;
    else s = `A pair of ${col} ${d.bud === 'stem' ? 'stem' : 'round'} earbuds`;
    if (isWired(d)) s += d.kind === 'buds' ? `, on a Y cable${hasRemote(d) ? ' with an inline remote' : ''} down to a plug` : `, with a ${hasCoil(d) ? 'coiled' : 'straight'} cord down to a plug`;
    else if (d.kind !== 'muffs') s += ', wireless';
    return s + '.' + (kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : '');
  }

  /* ---- her head, measured: the ears, the side of her head, its outline round the band's plane and round her face (in cm, head frame) */
  function soundFit(sandy, hm) {
    const head = sandy.n3.headMesh, P = head.geometry.attributes.position, key = head.geometry.uuid + ':' + P.version + ':' + P.count;
    if (sandy.__jsnd && sandy.__jsnd.key === key) return sandy.__jsnd;
    const hg = sandy.n3.headGroup; sandy.object3d.updateMatrixWorld(true);
    const cmU = hm.unitCm, M = new THREE.Matrix4().makeScale(cmU, cmU, cmU).multiply(new THREE.Matrix4().copy(hg.matrixWorld).invert()).multiply(head.matrixWorld);
    const E = earInfo(sandy, hm).L, ear = { yMin: E.yMin * cmU, yMax: E.yMax * cmU, z: E.zMid * cmU, zFront: E.zFront * cmU, out: E.xOut * cmU };
    const yC = (ear.yMin + ear.yMax) / 2, zM = ear.z, V = new Float32Array(P.count * 3), v = new THREE.Vector3();
    let side = 0, top = -1e9, bot = 1e9, zMin = 1e9, zMax = -1e9;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(M); V[i * 3] = v.x; V[i * 3 + 1] = v.y; V[i * 3 + 2] = v.z; top = Math.max(top, v.y); bot = Math.min(bot, v.y); zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z); if (Math.abs(v.y - yC) < 2.5 && Math.abs(v.z - zM) < 3) side = Math.max(side, Math.abs(v.x)); }
    const yMouth = yC - 7.5, zc0 = (zMin + zMax) / 2, NB = 120, prof = new Float32Array(NB), hprof = new Float32Array(NB);
    for (let i = 0; i < P.count; i++) {
      const x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
      if (Math.abs(z - zM) < 2.5) { const th = Math.atan2(x, y - yC), b = Math.round((th + Math.PI) / TAU * NB) % NB, rr = Math.hypot(x, y - yC); if (rr > prof[b]) prof[b] = rr; }
      if (y > yMouth - 2.5 && y < yC + 1) { const ph = Math.atan2(x, z - zc0), b = Math.round((ph + Math.PI) / TAU * NB) % NB, rr = Math.hypot(x, z - zc0); if (rr > hprof[b]) hprof[b] = rr; }
    }
    for (const A of [prof, hprof]) { for (let pass = 0; pass < 12; pass++) for (let b = 0; b < NB; b++) if (!A[b]) A[b] = Math.max(A[(b + 1) % NB], A[(b + NB - 1) % NB]); const S = A.slice(); for (let b = 0; b < NB; b++) A[b] = Math.max(S[b], S[(b + 1) % NB], S[(b + NB - 1) % NB]); }
    const look = A => th => { const f = ((th + Math.PI) / TAU * NB % NB + NB) % NB, a = Math.floor(f) % NB, b = (a + 1) % NB; return lerp(A[a], A[b], f - Math.floor(f)); };
    return (sandy.__jsnd = { key, cmU, hg, ear, yC, zM, side: side || 14.8, top, bot, rAt: look(prof), hAt: look(hprof), zc0, yMouth });
  }

  /* ---- one picture per pair: the cups' outer plate (a rim, an inset in the second colour and its print; the muffs' fur), the
     cups' shell, the cushions and the band (its print keeps its size along the band, wrapping every PERIOD cm like the sandals') */
  const SREG = { plate: [0, 0, 256, 256], shell: [256, 0, 256, 128], pad: [256, 128, 256, 128], band: [0, 256, 512, 128] };
  const sUV = (r, fx, fy) => { const [x0, y0, w, h] = SREG[r]; return [(x0 + 2 + clamp(fx, 0, 1) * (w - 4)) / TW, 1 - (y0 + 2 + clamp(fy, 0, 1) * (h - 4)) / TW]; };
  const BAND_UV = { cm: true, period: PERIOD, u: uCm, v: off => 1 - (SREG.band[1] + SREG.band[3] / 2 + off * PX) / TW };
  function cupShape(d) {
    const R = d.cupR;
    if (d.cup === 'square') return rrShape(R * 1.84, R * 1.84, R * 0.5);
    if (d.cup === 'heart') return heartShape(R * 2.3, R * 2.2);
    const s = new THREE.Shape();
    if (d.cup === 'oval') s.absellipse(0, 0, R * 0.8, R * 1.12, 0, TAU, false, 0);
    else if (d.cup === 'cloud') { const n = 60; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = R * (0.85 + 0.15 * Math.abs(Math.cos(3 * a))); i ? s.lineTo(Math.sin(a) * rr, Math.cos(a) * rr) : s.moveTo(Math.sin(a) * rr, Math.cos(a) * rr); } s.closePath(); }
    else s.absarc(0, 0, R, 0, TAU, false);
    return s;
  }
  const shapeBox = s => { const pts = s.getPoints(48); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } return { pts, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
  function soundTex(d, sb) {
    const cv = document.createElement('canvas'); cv.width = cv.height = TW; const x = cv.getContext('2d');
    const rect = r => SREG[r], fill = (r, c) => { const [x0, y0, w, h] = rect(r); x.fillStyle = c; x.fillRect(x0, y0, w, h); };
    const muffs = d.kind === 'muffs';
    fill('plate', muffs ? d.cupCol : d.cupCol2); fill('shell', d.cupCol); fill('pad', d.padCol); fill('band', d.bandCol);
    { const [x0, y0, w, h] = rect('pad'); x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 2; for (let yy = y0 + 6; yy < y0 + h; yy += 10) { x.beginPath(); x.moveTo(x0, yy); x.lineTo(x0 + w, yy); x.stroke(); } }
    if (muffs) {   // fur: short light and dark strokes all over
      const r = rng('fur:' + d.cupCol), [x0, y0, w, h] = rect('plate'); x.lineCap = 'round';
      for (let i = 0; i < 2600; i++) { const px = x0 + r.f(0, w), py = y0 + r.f(0, h), a = r.f(0, TAU), l = r.f(3, 8); x.strokeStyle = r.chance(0.5) ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.13)'; x.lineWidth = r.f(1, 2); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    }
    const over = [['plate', d.cupPat, d.cupPatCol], ['band', d.kind === 'over' ? d.bandPat : -1, d.bandPatCol]].filter(o => o[1] >= 0 && PAT.lum);
    if (over.length) { const im = x.getImageData(0, 0, TW, TW), D = im.data;
      for (const [r, idx, col] of over) { const [x0, y0, w, h] = rect(r), [cr, cg, cb] = hexRGB(col), ox = (idx % PAT.cols) * PAT.T, oy = Math.floor(idx / PAT.cols) * PAT.T, k = PAT.T / TILE;
        for (let y = y0; y < y0 + h; y++) for (let xx = x0; xx < x0 + w; xx++) { const sx = ox + Math.floor((((xx - x0) % TILE) + 0.5) * k), sy = oy + Math.floor((((y - y0) % TILE) + 0.5) * k), L = 1 - (1 - PAT.lum[sy * PAT.w + sx] / 255) * PAT_K, a = 1 - L, p = (y * TW + xx) * 4; D[p] = D[p] * L + cr * a; D[p + 1] = D[p + 1] * L + cg * a; D[p + 2] = D[p + 2] * L + cb * a; } }
      x.putImageData(im, 0, 0); }
    // the plate's rim: the cup's own colour round an inset of the second colour (headphones, round buds)
    if (!muffs && sb) { const [x0, y0, w, h] = rect('plate'), map = p => [x0 + 2 + ((p.x * 0.78 + sb.cx * 0.22) - sb.x0) / sb.w * (w - 4), y0 + 2 + (1 - ((p.y * 0.78 + sb.cy * 0.22) - sb.y0) / sb.h) * (h - 4)];
      x.beginPath(); x.rect(x0, y0, w, h); sb.pts.forEach((p, i) => { const [a, b] = map(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fillStyle = d.cupCol; x.fill('evenodd'); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.userData.canvas = cv; cv.__big = true; return t;
  }
  // soft shading: a vertex takes the average normal of the faces that meet it at less than `deg` degrees, so bevels and curved
  // sides read smooth while a real corner stays crisp (ExtrudeGeometry is flat-shaded: every facet would catch the light)
  function smoothNormals(g, deg) {
    const P = g.attributes.position, N = g.attributes.normal, n = P.count, cs = Math.cos((deg || 62) * Math.PI / 180), F = new Float32Array(n * 3), a = V3(), b = V3(), c = V3(), groups = new Map();
    if (g.index) return g;
    for (let i = 0; i + 2 < n; i += 3) { a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2); const f = c.sub(b).cross(a.sub(b)); const l = f.length() || 1; for (let k = 0; k < 3; k++) { F[(i + k) * 3] = f.x / l; F[(i + k) * 3 + 1] = f.y / l; F[(i + k) * 3 + 2] = f.z / l; } }
    for (let i = 0; i < n; i++) { const key = Math.round(P.getX(i) * 500) + ',' + Math.round(P.getY(i) * 500) + ',' + Math.round(P.getZ(i) * 500); let q = groups.get(key); if (!q) groups.set(key, q = []); q.push(i); }
    for (const q of groups.values()) for (const i of q) { let x = 0, y = 0, z = 0; for (const j of q) { const d = F[i * 3] * F[j * 3] + F[i * 3 + 1] * F[j * 3 + 1] + F[i * 3 + 2] * F[j * 3 + 2]; if (d >= cs) { x += F[j * 3]; y += F[j * 3 + 1]; z += F[j * 3 + 2]; } } const l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
    N.needsUpdate = true; return g;
  }
  // a band with a rounded (stadium) cross-section, w across and t thick, along pts with outward normals nrm: smooth all round.
  // uv: sweep's cm-based object (the print keeps its size and wraps every period) or a function (i, n) -> [u, v]
  function roundSweep(pts, nrm, w, t, uv) {
    const n = pts.length, cum = [0], wide = w >= t, r = Math.min(w, t) / 2, h = Math.max(w, t) / 2 - r, m = 4, ring = [];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    for (const sd of [1, -1]) for (let k = 0; k <= m; k++) { const a = -Math.PI / 2 + k / m * Math.PI, ca = sd * Math.cos(a), sa = sd * Math.sin(a); ring.push(wide ? [sd * h + ca * r, sa * r, ca, sa] : [ca * r, sd * h + sa * r, ca, sa]); }
    const R = ring.length, sec = [], T = V3();
    for (let i = 0; i < n; i++) { T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize(); const Nn = nrm[i].clone().addScaledVector(T, -nrm[i].dot(T)).normalize(); sec.push({ p: pts[i], N: Nn, B: V3().crossVectors(T, Nn).normalize() }); }
    const Pp = [], Nr = [], Uv = [], I = [];
    for (let i = 0; i < n - 1; i++) {
      const u0 = uv.cm ? cum[i] % uv.period : 0, u1 = uv.cm ? u0 + cum[i + 1] - cum[i] : 0;
      for (let k = 0; k < R; k++) {
        const base = Pp.length / 3, k2 = (k + 1) % R;
        for (const [si, kk, uu] of [[i, k, u0], [i, k2, u0], [i + 1, k, u1], [i + 1, k2, u1]]) { const S = sec[si], [x, y, nx, ny] = ring[kk], q = S.p.clone().addScaledVector(S.B, x).addScaledVector(S.N, y), nn = S.B.clone().multiplyScalar(nx).addScaledVector(S.N, ny).normalize(); Pp.push(q.x, q.y, q.z); Nr.push(nn.x, nn.y, nn.z); const [U, V] = uv.cm ? [uv.u(uu), uv.v(x)] : uv(si, n); Uv.push(U, V); }
        I.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nr, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setIndex(I); return g;
  }
  // a cup (or a round bud): the shape extruded along +z from 0 to depth; its outer face takes the plate, the rest the shell
  function cupGeo(shape, sb, depth, bev, curve) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.1, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 2, curveSegments: curve || 12 }); g.translate(0, 0, bev);
    const P = g.attributes.position, N = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), nz = N.getZ(i); const [u, v] = nz > 0.7 ? sUV('plate', (px - sb.x0) / sb.w, 1 - (py - sb.y0) / sb.h) : sUV('shell', Math.atan2(py - sb.cy, px - sb.cx) / TAU + 0.5, pz / depth); uv.setXY(i, u, v); }
    uv.needsUpdate = true; return smoothNormals(g);
  }
  function ringGeo(shape, depth, kOut, kIn, uvR) {
    const pts = shape.getPoints(14), sh = new THREE.Shape(pts.map(p => p.clone().multiplyScalar(kOut))), hole = new THREE.Path(pts.map(p => p.clone().multiplyScalar(kIn)).reverse()); sh.holes.push(hole);
    const bev = Math.min(0.45, depth * 0.3), g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.1, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, bev);
    const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P.count; i++) { const [u, v] = sUV(uvR || 'pad', Math.atan2(P.getY(i), P.getX(i)) / TAU + 0.5, P.getZ(i) / depth); uv.setXY(i, u, v); } uv.needsUpdate = true; return smoothNormals(g);
  }
  // a geometry built facing +z (out of its cup) turned to face out of her head on side sx, then moved to x0 (its inner face), yC, zM
  const toSide = (g, sx, x0, y, z) => { g.rotateY(sx * Math.PI / 2); g.translate(sx * x0, y, z); return g; };
  // the band's centre line over her head, in the plane z = zM, from her right attach point (x = -xA) to her left (x = xA)
  function bandArc(K, xA, yA, clear) {
    const thA = Math.atan2(xA, yA - K.yC), rA = Math.hypot(xA, yA - K.yC), N = 40, th = [], r = [];
    for (let i = 0; i <= N; i++) { const t = lerp(-thA, thA, i / N); th.push(t); r.push(Math.max(K.rAt(t) + clear, rA)); }
    for (let pass = 0; pass < 12; pass++) { const c = r.slice(); for (let i = 1; i < N; i++) r[i] = Math.max((c[i - 1] + 2 * c[i] + c[i + 1]) / 4, K.rAt(th[i]) + clear); }
    r[0] = r[N] = rA;
    const rOf = t => { const f = clamp((t + thA) / (2 * thA), 0, 1) * N, i = Math.min(N - 1, Math.floor(f)); return lerp(r[i], r[i + 1], f - i); };
    const at = (t, dr) => { const rr = rOf(t) + (dr || 0); return V3(Math.sin(t) * rr, K.yC + Math.cos(t) * rr, K.zM); };
    return { th, r, thA, rOf, at, nrm: t => V3(Math.sin(t), Math.cos(t), 0) };
  }
  // a cord's centre line (world): through the control points, then lifted off her chest and smoothed
  // the front of her body at (x, y), world (bodyField's empty cells read front 0, back -10: nothing there)
  const bodyZ = (F, x, y) => { const zf = F.front(x, y), zb = F.back(x, y); return (Math.abs(zf) < 0.05 && Math.abs(zb + 10) < 0.05) ? -1e9 : zf; };
  function drapeCord(F, ctrl, r) {
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal'), N = Math.max(24, Math.round(curve.getLength() / 1.1)), pts = curve.getSpacedPoints(N);
    for (let pass = 0; pass < 5; pass++) {
      for (let k = 1; k < pts.length; k++) { const p = pts[k], zf = bodyZ(F, p.x, p.y); if (zf > -1e8 && p.z < zf + r + 0.45) p.z = zf + r + 0.45; }
      if (pass < 4) { const c = pts.map(p => p.clone()); for (let k = 1; k < pts.length - 1; k++) pts[k].copy(c[k - 1]).add(c[k].clone().multiplyScalar(2)).add(c[k + 1]).multiplyScalar(0.25); }
    }
    return pts;
  }

  function buildSound(d, ctx) {
    const { sandy, hm } = ctx, K = soundFit(sandy, hm), own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugSound'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'sound', design: d };
    sandy.object3d.updateMatrixWorld(true);
    const cm = new THREE.Group(); cm.scale.setScalar(1 / K.cmU); root.add(cm); const headP = new THREE.Group(); headP.name = 'soundHead'; cm.add(headP); const cordP = new THREE.Group(); cordP.name = 'soundCord'; cm.add(cordP);
    let curP = headP; const sideG = {}; for (const sx of [-1, 1]) { sideG[sx] = new THREE.Group(); sideG[sx].name = sx > 0 ? 'soundL' : 'soundR'; headP.add(sideG[sx]); }   // her left and right side (earbud pictures frame her left)
    const add = (geo, mat, nm, parent) => { own.geos.push(geo); const m = new THREE.Mesh(geo, mat); m.name = nm || 'part'; (parent || curP).add(m); own.tris += triOf(geo); return m; };
    const cyl = (a, b, r, mat, nm, parent, seg) => { const len = a.distanceTo(b); if (len < 1e-3) return null; const g = new THREE.CylinderGeometry(r, r, len, seg || 8, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return add(g, mat, nm, parent); };
    const ball = (p, r, mat, nm, parent, seg) => { const g = new THREE.SphereGeometry(r, seg || 8, Math.max(5, (seg || 8) - 3)); g.translate(p.x, p.y, p.z); return add(g, mat, nm, parent); };
    const kind = d.kind, metal = d.finish === 'metal', rough = d.finish === 'matte' ? 0.85 : metal ? 0.36 : 0.42;
    const sb = kind === 'over' ? shapeBox(cupShape(d)) : kind === 'buds' && d.bud === 'round' ? shapeBox(new THREE.Shape().absarc(0, 0, d.budSize * 0.5, 0, TAU, false)) : null;
    const tex = soundTex(d, sb); own.mats.push({ dispose() { tex.dispose(); } });
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: kind === 'muffs' ? 0.95 : rough, metalness: metal ? 0.5 : 0, envMap: ENV, envMapIntensity: kind === 'muffs' ? 0.2 : 0.75, side: THREE.DoubleSide }); own.mats.push(mat);
    const soft = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.9, metalness: 0, envMap: ENV, envMapIntensity: 0.3, side: THREE.DoubleSide }); own.mats.push(soft);
    const hwM = matFor(d.hw, 'metal'), padM = matFor(d.padCol, 'matte'), cordM = matFor(d.cordCol, 'gloss'), topM = matFor(d.topCol, d.finish), accM = matFor(d.cupCol2, d.finish), bodyM = matFor(d.cupCol, d.finish);
    const glowM = hasGlow(d) ? new THREE.MeshBasicMaterial({ color: new THREE.Color(d.glowCol).convertSRGBToLinear(), toneMapped: false }) : null; if (glowM) own.mats.push(glowM);
    const side = K.side, yC = K.yC, zM = K.zM;
    let arc = null, face = null, budAt = {}, cordFrom = {};

    if (kind === 'over' || kind === 'muffs') {
      let xA, yA, ext, halfH, faceX, clear = 1.0 + d.bandT / 2;
      if (kind === 'over') {
        const shape = cupShape(d), x0 = side - 0.35, cupIn = x0 + d.padT - 0.15, cupMid = cupIn + d.cupD / 2, cupOut = cupIn + d.cupD, bev = Math.min(0.6, d.cupD * 0.18);
        halfH = sb.y1; const halfW = Math.max(-sb.x0, sb.x1), cupTop = yC + sb.y1 + bev * 0.9;
        faceX = cupOut;
        for (const sx of [-1, 1]) {
          add(toSide(cupGeo(shape, sb, d.cupD, bev, 14), sx, cupIn, yC, zM), mat, 'cup');
          add(toSide(ringGeo(shape, d.padT, 0.96, 0.55), sx, x0, yC, zM), soft, 'cushion');
          if (glowM) { const ring = shape.getPoints(32).map(p => V3(p.x * 0.89 + sb.cx * 0.11, p.y * 0.89 + sb.cy * 0.11, d.cupD + 0.05)); const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 44, 0.22, 4, true); add(toSide(g, sx, cupIn, yC, zM), glowM, 'glow'); }
          if (d.yoke === 'fork') {
            const Rf = Math.max(halfH, halfW) + bev + 0.8, g = new THREE.TorusGeometry(Rf, 0.36, 6, 22, Math.PI); g.rotateY(Math.PI / 2); g.translate(sx * cupMid, yC, zM); add(g, hwM, 'yoke');
            for (const sz of [-1, 1]) { const a = V3(sx * cupMid, yC, zM + sz * Rf), b = V3(sx * cupMid, yC, zM + sz * (halfW + bev * 0.5)); cyl(a, b, 0.3, hwM, 'pin'); ball(a, 0.5, hwM, 'pin'); }
          } else { ball(V3(sx * cupMid, cupTop - 0.2, zM), 0.65, hwM, 'hinge'); }
        }
        if (d.yoke === 'fork') { const Rf = Math.max(halfH, halfW) + bev + 0.8; ext = 0.7; xA = cupMid; yA = yC + Rf + ext; }
        else { ext = 1.6; xA = cupMid; yA = cupTop + 1.0 + ext; for (const sx of [-1, 1]) cyl(V3(sx * xA, yA - ext + 0.4, zM), V3(sx * xA, cupTop - 0.2, zM), 0.42, hwM, 'slider'); }
        if (d.bandPad) clear += 0.9;
        face = { x: faceX, halfH, mid: cupMid, bot: yC + sb.y0 - bev };
        // the boom mic, from her left cup round the side of her face to her mouth
        if (hasMic(d)) {
          const M0 = V3(cupMid + 0.2, yC - halfH * 0.42, zM + halfW * 0.72), ph0 = Math.atan2(M0.x, M0.z - K.zc0), r0 = Math.hypot(M0.x, M0.z - K.zc0), ph1 = 0.32, pts = [];
          for (let i = 0; i <= 12; i++) { const t = i / 12, ph = lerp(ph0, ph1, t), y = lerp(M0.y, K.yMouth, Math.pow(t, 0.8)), want = K.hAt(ph) + (i === 12 ? 1.6 : 2.2), rr = Math.max(want, lerp(r0, want, Math.min(1, t * 1.6))); pts.push(V3(Math.sin(ph) * rr, y, K.zc0 + Math.cos(ph) * rr)); }
          pts[0].copy(M0); const boom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 30, 0.3, 6, false); add(boom, bodyM, 'boom');
          ball(pts[pts.length - 1], 1.05, padM, 'mic', headP, 12); ball(M0, 0.7, hwM, 'boom');
        }
      } else {
        // fluffy muffs: a bumpy ball, a little flat, over each ear
        const R = d.cupR, ax = 0.66, mx = Math.max(side + R * ax * 0.35, K.ear.out + 0.6 - R * ax); halfH = R; faceX = mx + R * ax;
        for (const sx of [-1, 1]) {
          const g = new THREE.SphereGeometry(1, 26, 18), P = g.attributes.position, uv = g.attributes.uv;
          for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nz = Math.sin(9 * x + 3 * y) * Math.sin(7 * y + 5 * z) * Math.sin(6 * z + 8 * x), h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453, w = 1 + 0.05 * nz + 0.035 * (h - Math.floor(h) - 0.5); P.setXYZ(i, x * w * R * ax, y * w * R, z * w * R * 0.95); const [u, v] = sUV('plate', uv.getX(i), 1 - uv.getY(i)); uv.setXY(i, u, v); }
          g.computeVertexNormals(); g.translate(sx * mx, yC, zM); add(g, mat, 'muff');
        }
        ext = 1.0; xA = mx - R * ax * 0.1; yA = yC + R * 0.86 + ext;
        face = { x: faceX, halfH, mid: mx, bot: yC - R + 0.8 };
      }
      // the band, its sliding ends, and the cushion under its top
      arc = bandArc(K, xA, yA, clear);
      const pts = [], nr = [], push = (p, n) => { pts.push(p); nr.push(n); };
      push(V3(-xA, yA - ext, zM), V3(-1, 0, 0)); for (let i = 0; i < arc.th.length; i++) { const t = arc.th[i]; push(V3(Math.sin(t) * arc.r[i], yC + Math.cos(t) * arc.r[i], zM), arc.nrm(t)); } push(V3(xA, yA - ext, zM), V3(1, 0, 0));
      add(roundSweep(pts, nr, d.bandW, d.bandT, BAND_UV), mat, 'band');
      if (kind === 'over' && d.bandPad) {
        const pp = [], pn = [], lim = Math.min(0.85, arc.thA * 0.62); for (let i = 0; i <= 24; i++) { const t = lerp(-lim, lim, i / 24); pp.push(arc.at(t, -d.bandT / 2 - 0.45)); pn.push(arc.nrm(t)); }
        add(roundSweep(pp, pn, d.bandW * 0.78, 0.9, (i, n) => sUV('pad', i / Math.max(1, n - 1), 0.5)), soft, 'bandCushion');
      }
      // toppers on the band
      const top = topOf(d);
      if (top !== 'none') {
        const place = (g, t, lift, tilt) => { const n = arc.nrm(t), p = arc.at(t, d.bandT / 2 - lift), zz = V3(0, 0, 1), xx = V3().crossVectors(n, zz).normalize(); const M = new THREE.Matrix4().makeBasis(xx, n, zz).multiply(new THREE.Matrix4().makeRotationZ(tilt || 0)); g.applyMatrix4(M); g.translate(p.x, p.y, p.z); return g; };
        const flat = (s, depth) => { const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 1, curveSegments: 8 }); g.translate(0, 0, -depth / 2); return smoothNormals(g); };
        const sc = clamp(d.bandW / 3, 0.75, 1.25);
        for (const sx of top === 'bow' ? [1] : [-1, 1]) {
          const t = sx * Math.min(arc.thA * 0.55, top === 'bow' ? 0.5 : 0.42), tilt = -sx * (top === 'bunny' ? 0.22 : top === 'devil' ? 0.3 : 0.12);
          if (top === 'cat') { const o = poly([[-1.7, 0], [1.7, 0], [0.35, 3.3], [-0.35, 3.3]]), i2 = poly([[-0.95, 0.35], [0.95, 0.35], [0.12, 2.3], [-0.12, 2.3]]); o.closePath(); const g = flat(o, 0.9); g.scale(sc, sc, sc); add(place(g, t, 0.3, tilt), topM, 'topper'); const gi = flat(i2, 0.3); gi.scale(sc, sc, sc); gi.translate(0, 0, 0.55 * sc); add(place(gi, t, 0.3, tilt), padM, 'topper'); }
          else if (top === 'bunny') { const o = new THREE.Shape(); o.absellipse(0, 3.4, 1.25, 3.6, 0, TAU, false, 0); const i2 = new THREE.Shape(); i2.absellipse(0, 3.6, 0.65, 2.7, 0, TAU, false, 0); const g = flat(o, 0.8); g.scale(sc, sc, sc); add(place(g, t, 0.4, tilt), topM, 'topper'); const gi = flat(i2, 0.3); gi.scale(sc, sc, sc); gi.translate(0, 0, 0.5 * sc); add(place(gi, t, 0.4, tilt), padM, 'topper'); }
          else if (top === 'bear') { const o = new THREE.Shape(); o.absarc(0, 1.5, 2.1, 0, TAU, false); const i2 = new THREE.Shape(); i2.absarc(0, 1.6, 1.15, 0, TAU, false); const g = flat(o, 0.9); g.scale(sc, sc, sc); add(place(g, t, 0.4, tilt), topM, 'topper'); const gi = flat(i2, 0.3); gi.scale(sc, sc, sc); gi.translate(0, 0, 0.55 * sc); add(place(gi, t, 0.4, tilt), padM, 'topper'); }
          else if (top === 'devil') { const g = new THREE.ConeGeometry(0.95, 3.4, 12); g.translate(0, 1.7, 0); g.scale(sc, sc, sc); add(place(g, t, 0.3, tilt), topM, 'topper'); }
          else if (top === 'bow') { const g = geoFor('bow').clone(); g.scale(5.6 * sc, 5.6 * sc, 3 * sc); g.translate(0, 1.1 * sc, 0); add(place(g, t, 0.2, -0.25), topM, 'topper'); const k = new THREE.SphereGeometry(0.75 * sc, 10, 7); k.translate(0, 1.1 * sc, 0.25 * sc); add(place(k, t, 0.2, 0), topM, 'topper'); }
        }
      }
      for (const sx of [-1, 1]) cordFrom[sx] = V3(sx * face.mid, face.bot - 0.1, zM);
    } else {
      // earbuds, resting in the front of each ear
      const s = d.budSize, zF = K.ear.zFront;
      for (const sx of [-1, 1]) {
        curP = sideG[sx]; const c = V3(sx * (side + s * 0.42), yC - 0.4, zF + s * 0.36);
        if (d.bud === 'stem') {
          const g = new THREE.SphereGeometry(0.5, 16, 12); g.scale(s * 0.9, s * 0.8, s * 0.86); g.translate(c.x, c.y, c.z); add(g, bodyM, 'bud');
          const tipIn = c.clone().add(V3(-sx * s * 0.34, -s * 0.05, -s * 0.18)); ball(tipIn, s * 0.24, padM, 'tip', null, 10);
          // the stem and its tip: one straight round rod (same radius and sides, so the seam is a clean straight line) with a rounded end
          const a = c.clone().add(V3(0, -s * 0.2, s * 0.05)), b = c.clone().add(V3(sx * s * 0.04, -s * 1.3, s * 0.3)), dir = b.clone().sub(a).normalize(), q = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), dir), sr = s * 0.15, tipL = s * 0.2, seg = 20;
          const rod = new THREE.CylinderGeometry(sr, sr, a.distanceTo(b), seg, 1, true); rod.translate(0, -a.distanceTo(b) / 2, 0); rod.applyQuaternion(q); rod.translate(a.x, a.y, a.z); add(rod, bodyM, 'stem');
          const prof = [new THREE.Vector2(sr, 0), new THREE.Vector2(sr, -tipL)]; for (let k = 1; k <= 6; k++) { const an = k / 6 * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(1e-4, sr * Math.cos(an)), -tipL - sr * 0.8 * Math.sin(an))); }
          const tip = new THREE.LatheGeometry(prof.reverse(), seg); tip.applyQuaternion(q); tip.translate(b.x, b.y, b.z); add(tip, accM, 'stemTip');
          budAt[sx] = b.clone().addScaledVector(dir, tipL + sr * 0.8); cordFrom[sx] = budAt[sx].clone();
        } else {
          const sh = new THREE.Shape().absarc(0, 0, s * 0.5, 0, TAU, false), g = cupGeo(sh, sb, s * 0.48, s * 0.13, 18), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), V3(sx * 0.62, 0, 0.78).normalize()); g.applyQuaternion(q); g.translate(c.x - sx * s * 0.2, c.y, c.z - s * 0.2); add(g, mat, 'bud');
          ball(c.clone().add(V3(-sx * s * 0.3, 0, -s * 0.3)), s * 0.26, padM, 'tip', null, 10);
          budAt[sx] = c.clone().add(V3(0, -s * 0.5, 0)); cordFrom[sx] = budAt[sx].clone();
        }
      }
      curP = headP;
    }


    // ---- the cord: from her left cup (or a Y from both buds) down her chest to a plug
    if (isWired(d)) {
      const F = bodyField(sandy), hg = K.hg, toW = p => hg.localToWorld(p.clone().multiplyScalar(1 / K.cmU)), toL = p => hg.worldToLocal(p.clone()).multiplyScalar(K.cmU);
      const rr = kind === 'buds' ? 0.14 : 0.24, yPlug = lerp(kind === 'buds' ? 136 : 134, 102, d.cordLen), tube = (pw, r, nm) => { const pl = pw.map(toL); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pl, false, 'centripetal'), Math.max(8, Math.round(pl.length * 0.8)), r, kind === 'buds' ? 4 : 5, false), cordM, nm || 'cord', cordP); return pl; };
      let main;
      if (kind === 'buds') {
        const B = { '-1': toW(cordFrom[-1]), 1: toW(cordFrom[1]) }, J0 = V3(0.6, 147, 0); J0.z = Math.max(bodyZ(F, 0.6, 147) + 1.4, B[1].z + 3);
        const legs = {};
        for (const sx of [-1, 1]) { const b = B[sx], c = [b, b.clone().add(V3(sx * 0.2, -2.6, 0.3)), V3(sx * Math.max(15.6, Math.abs(b.x) + 0.3), 156, b.z + 1.2), V3(sx * 9.5, 151, (b.z + J0.z) / 2 + 1), J0]; legs[sx] = tube(drapeCord(F, c, rr), rr, 'cord'); }
        const J = toL(J0); { const g = new THREE.CylinderGeometry(0.42, 0.42, 1.5, 10); g.translate(J.x, J.y - 0.5, J.z); add(g, cordM, 'splitter', cordP); }
        if (hasRemote(d)) { const L = legs[-1], k = Math.floor(L.length * 0.62), a = L[k], b = L[Math.min(L.length - 1, k + 1)], t = b.clone().sub(a).normalize(), g = new THREE.CylinderGeometry(0.55, 0.55, 2.8, 10); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), t)); g.translate(a.x, a.y, a.z); add(g, cordM, 'remote', cordP); ball(a.clone().add(V3(0, 0, 0.5)), 0.22, hwM, 'remote', cordP, 8); }
        main = tube(drapeCord(F, [J0, V3(1.2, 142, J0.z + 1), V3(2.2, (142 + yPlug) / 2, J0.z + 2), V3(2.8, yPlug, J0.z + 2)], rr), rr, 'cord');
      } else {
        const S = toW(cordFrom[1]), c = [S, S.clone().add(V3(0.2, -2.6, 0.5)), V3(Math.max(S.x - 0.5, 16), 154, S.z + 2.5), V3(12.5, 146, S.z + 7), V3(8, (146 + yPlug) / 2, S.z + 9), V3(5.5, yPlug, S.z + 9)], pw = drapeCord(F, c, rr);
        if (hasCoil(d)) {
          const pl = pw.map(toL), cv = new THREE.CatmullRomCurve3(pl, false, 'centripetal'), L = cv.getLength(), a = 0.22, b = 0.72, pitch = 0.95, turns = Math.max(4, Math.round(L * (b - a) / pitch)), M = turns * 6, fr = cv.computeFrenetFrames(M, false), hp = [];
          for (let i = 0; i <= M; i++) { const u = lerp(a, b, i / M), c0 = cv.getPointAt(u), ang = i / 6 * TAU, nn = fr.normals[i], bn = fr.binormals[i], rad = Math.min(0.75, 0.75 * Math.min(i, M - i) / 4); hp.push(c0.clone().addScaledVector(nn, Math.cos(ang) * rad).addScaledVector(bn, Math.sin(ang) * rad)); }
          const seg = (u0, u1) => { const q = []; for (let i = 0; i <= 14; i++) q.push(cv.getPointAt(lerp(u0, u1, i / 14))); return q; };
          for (const q of [seg(0, a), seg(b, 1)]) add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(q, false, 'centripetal'), 20, rr, 6, false), cordM, 'cord', cordP);
          add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, false, 'catmullrom', 0.5), hp.length, 0.19, 4, false), cordM, 'coil', cordP);
          main = seg(0.9, 1);
        } else main = tube(pw, rr, 'cord');
        ball(cordFrom[1], 0.5, hwM, 'jack', cordP, 8);
      }
      // the plug at the end: a housing and a metal jack
      { const n = main.length, E = main[n - 1], t = E.clone().sub(main[Math.max(0, n - 3)]).normalize(), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), t), part = (g, off, m, nm) => { g.applyQuaternion(q); g.translate(E.x + t.x * off, E.y + t.y * off, E.z + t.z * off); add(g, m, nm, cordP); };
        part(new THREE.CylinderGeometry(rr * 2.2, rr * 2.6, 2.6, 10), 1.3, cordM, 'plug'); part(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 8), 3.4, hwM, 'jack'); part(new THREE.SphereGeometry(0.24, 8, 6), 4.25, hwM, 'jack'); part(new THREE.TorusGeometry(0.24, 0.06, 4, 10).rotateX(Math.PI / 2), 3.1, accM, 'jack'); }
    }
    return { root, d, info: { tris: Math.round(own.tris) }, frame: 'head', dispose() { for (const g of own.geos) g.dispose(); for (const m of own.mats) m.dispose(); } };
  }


  /* ================================================================ back (swords)
     Swords worn on her: one across her back, two crossed on her back, or one at her hip. Each sword is put together from the
     Modular Sword Kit by MilkAndBanana (CC0, assets/swords/swords.bin: 21 blades, 21 guards, 23 grips, 44 pommels, made with
     tools/catalog/swords.mjs). Every part keeps the kit's painted shading (a brightness per vertex) under our own colours:
     blade and edge, the hilt's metal (guard and pommel), the grip and its leather wrap, and a gem. Patterns from the pattern
     pack go on the blade, the grip, the scabbard and the strap. A strap holds them on: a baldric round her chest for the back,
     a belt for the hip. World frame, laid over bodyField like the purse strap. */
  const SWORD_BASE = ON_SITE ? AB + 'swords/' : 'swords/';
  const SW = { parts: null, by: { blade: [], guard: [], grip: [], pommel: [] }, geo: new Map() };
  async function loadSwords() {
    if (SW.parts) return;
    try {
      const buf = await (await fetch(SWORD_BASE + 'swords.bin')).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)).trim()), base = 4 + hl;
      SW.q = head.q; SW.parts = head.parts; for (const p of SW.parts) { p.buf = buf; p.base = base; SW.by[p.k].push(p); }
    } catch (e) { console.warn('swords', e); SW.parts = []; }
  }
  const BACK_KINDS = [['back1', 'One on the back'], ['back2', 'Two on the back'], ['hip', 'At the hip']];
  const BACK_LABEL = Object.fromEntries(BACK_KINDS);
  const BK_LIM = { len: [50, 120], bladeW: [0.7, 1.45], tilt: [12, 42], strapW: [1.4, 5], drop: [-10, 10] };
  const BK_COLS = ['bladeCol', 'edgeCol', 'hiltCol', 'gripCol', 'wrapCol', 'gemCol', 'sheathCol', 'strapCol', 'bladePatCol', 'gripPatCol', 'sheathPatCol', 'strapPatCol'];
  const BK_PARTS = ['blade', 'guard', 'grip', 'pommel'];
  DEF.back = () => ({ v: 1, brand: 'grug', kind: 'back1', blade: 0, guard: 0, grip: 0, pommel: 0, len: 88, bladeW: 1, tilt: 28, drop: 0, finish: 'metal', bladeCol: '#c8ccd2', edgeCol: '#f4f4f2', hiltCol: '#d4af37', gripCol: '#3a2a20', wrapCol: '#7a4a2a', gemCol: '#e8344f', sheath: false, sheathCol: '#2a2a31', strap: true, strapCol: '#6b4428', strapW: 3, bladePat: -1, bladePatCol: '#16161a', gripPat: -1, gripPatCol: '#16161a', sheathPat: -1, sheathPatCol: '#d4af37', strapPat: -1, strapPatCol: '#16161a', charms: [] });
  LIMITS.back = { n: 0 };
  const bkCount = k => (SW.by[k] || []).length || 1;
  const hasWrap = d => { const p = SW.by.grip[d.grip]; return !!(p && p.regs > 1); }, hasGem = d => { const p = SW.by.pommel[d.pommel]; return !!(p && p.regs > 1); };
  function validateB(src, brand) {
    const notes = [], D0 = DEF.back(), d = Object.assign(DEF.back(), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!BACK_LABEL[d.kind]) d.kind = 'back1';
    for (const k of BK_PARTS) { const v = Math.round(+d[k]); d[k] = isFinite(v) ? ((v % bkCount(k)) + bkCount(k)) % bkCount(k) : 0; }
    for (const k of Object.keys(BK_LIM)) { const v = +d[k]; d[k] = clamp(isFinite(v) && d[k] !== null && d[k] !== '' ? v : D0[k], BK_LIM[k][0], BK_LIM[k][1]); }
    for (const k of BK_COLS) if (!isHex(d[k])) d[k] = D0[k];
    for (const k of ['bladePat', 'gripPat', 'sheathPat', 'strapPat']) { const v = Math.round(+d[k]); d[k] = isFinite(v) && v >= 0 && v < PAT_N ? v : -1; }
    if (!FINISHES.some(f => f[0] === d.finish)) d.finish = 'metal';
    d.sheath = !!d.sheath; d.strap = !!d.strap; d.charms = [];
    if (d.brand === 'kimiland') { let changed = false; for (const k of BK_COLS) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); changed = true; } if (changed) notes.push('Brought to KIMILAND pastels'); }
    return { d, notes };
  }
  function randomB(seed, o) {
    o = o || {}; const r = rng('jewel:back:' + seed), brand = o.brand || brandFor(seed, 0.15), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ classic: 3, night: 2, forest: 1.6, ocean: 1.2, halloween: 1.2, christmas: 0.6, valentines: 0.8, sweet: 1 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.pick(T.cols), metal = kimi ? pal.metal : r.pick(T.metal.concat(['#c8ccd2', '#c8ccd2']));
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF.back(); d.brand = brand;
    const recolour = () => {
      const steel = kimi ? r.pick(['#fffafc', '#ebe7f2', pal.main]) : r.w({ '#c8ccd2': 5, '#e8ebef': 2, '#50555c': 1.4, '#26272b': 1, [pick()]: 1.6 });
      d.bladeCol = steel; d.edgeCol = kimi ? '#fffafc' : r.chance(0.7) ? '#f4f6f8' : pick();
      d.hiltCol = metal; d.gripCol = kimi ? r.pick(pal.mains) : r.pick(['#3a2a20', '#16161a', '#6b4428', '#8a1c2b', '#1b2a55', pick()]);
      d.wrapCol = kimi ? '#fffafc' : r.pick(['#7a4a2a', '#16161a', '#c98a2b', pick()]); d.gemCol = kimi ? r.pick(pal.acc) : r.pick(['#e8344f', '#4fd8e0', '#9be338', '#7d3fc4', '#2b62d9', '#f5d21f']);
      d.sheathCol = kimi ? pal.main : r.pick(['#2a2a31', '#16161a', '#6b4428', '#8a1c2b', '#1b2a55', '#f4f4f2', pick()]); d.strapCol = kimi ? r.pick([pal.main, '#fffafc']) : r.pick(['#6b4428', '#3a2a20', '#16161a', '#8a1c2b', d.sheathCol]);
      d.bladePatCol = shadeOf(d.bladeCol); d.gripPatCol = shadeOf(d.gripCol); d.sheathPatCol = r.chance(0.5) ? d.hiltCol : shadeOf(d.sheathCol); d.strapPatCol = shadeOf(d.strapCol);
    };
    if (o.keep === 'shape') { recolour(); return validateB(d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? BK_COLS.map(k => d[k]) : null;
    d.kind = o.kind && BACK_LABEL[o.kind] ? o.kind : r.w({ back1: 4, back2: 2.6, hip: 2.4 });
    for (const k of BK_PARTS) d[k] = r.i(0, bkCount(k) - 1);
    d.len = d.kind === 'hip' ? r.f(58, 92) : d.kind === 'back2' ? r.f(60, 95) : r.f(72, 118); d.bladeW = r.f(0.8, 1.3); d.tilt = r.f(18, 38); d.drop = r.f(-4, 4);
    d.finish = kimi ? r.pick(['gloss', 'gloss', 'metal']) : r.w({ metal: 5, gloss: 1.5, matte: 0.6 });
    d.sheath = r.chance(d.kind === 'hip' ? 0.6 : 0.3); d.strap = r.chance(0.85); d.strapW = r.f(2, 4.2);
    d.bladePat = !d.sheath && r.chance(0.18) ? r.i(0, PAT_N - 1) : -1; d.gripPat = r.chance(0.25) ? r.i(0, PAT_N - 1) : -1; d.sheathPat = d.sheath && r.chance(0.35) ? r.i(0, PAT_N - 1) : -1; d.strapPat = d.strap && r.chance(0.25) ? r.i(0, PAT_N - 1) : -1;
    recolour(); if (keepC) BK_COLS.forEach((k, i) => { d[k] = keepC[i]; });
    return validateB(d, brand).d;
  }
  function nameB(d, seed) {
    const r = rng('jname:' + seed + ':back'), kimi = d.brand === 'kimiland', colour = colourName(d.sheath ? d.sheathCol : d.bladeCol, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(['Royal', 'Shadow', 'Storm', 'Ember', 'Frost', 'Iron', 'Moon', 'Sun', 'Wild', 'Noble', 'Rogue', 'Ancient', 'Dragon', 'Knight’s', 'Hero’s']);
    const noun = { back1: r.pick(['Greatsword', 'Longsword', 'Claymore', 'Back Sword', 'Blade']), back2: r.pick(['Twin Blades', 'Dual Swords', 'Crossed Swords', 'Twin Swords']), hip: r.pick(['Sabre', 'Side Sword', 'Hip Sword', 'Belt Blade', 'Arming Sword']) }[d.kind];
    const extra = d.sheath ? r.pick(['Sheathed', 'Scabbard']) : d.bladePat >= 0 ? r.pick(['Etched', 'Engraved']) : '';
    const forms = [[colour, noun], [fl, noun], [fl, colour, noun], [extra || fl, noun], [colour, extra, noun]];
    return forms[r.i(0, 4)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function tagsB(d) {
    const t = ['Back', 'Sword', BACK_LABEL[d.kind], d.kind === 'back2' ? 'Two swords' : 'One sword']; t.push(d.sheath ? 'Sheathed' : 'Bare blade'); if (d.strap) t.push(d.kind === 'hip' ? 'Belt' : 'Strap');
    if (d.bladePat >= 0 || d.gripPat >= 0 || d.sheathPat >= 0 || d.strapPat >= 0) t.push('Patterned'); if (hasGem(d)) t.push('Gem');
    if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  function familiesB(d) { const f = new Set([famOfHex(d.sheath ? d.sheathCol : d.bladeCol), famOfHex(d.hiltCol), famOfHex(d.gripCol)]); if (d.strap) f.add(famOfHex(d.strapCol)); if (f.size > 3) f.add('multi'); return f; }
  function describeB(d) {
    const kimi = d.brand === 'kimiland', cn = h => colourName(h, kimi).toLowerCase(), an = w => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w, sw = d.kind === 'back2' ? 'Two swords' : 'A sword';
    let s = `${sw} ${d.kind === 'hip' ? 'at her hip' : d.kind === 'back2' ? 'crossed on her back' : 'across her back'}, about ${Math.round(d.len)} cm long: ${d.sheath ? 'in ' + an(cn(d.sheathCol)) + ' scabbard' : an(cn(d.bladeCol)) + ' blade'} with ${an(cn(d.hiltCol))} hilt and ${an(cn(d.gripCol))} grip`;
    if (d.strap) s += `, on ${an(cn(d.strapCol))} ${d.kind === 'hip' ? 'belt' : 'strap'}`;
    return s + '.' + (kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : '') + ' Sword parts: Modular Sword Kit by MilkAndBanana (CC0).';
  }
  // one sword part as plain arrays (kit units, y along the blade)
  function swordPart(kind, i) {
    const p = SW.by[kind][i] || SW.by[kind][0]; if (!p) return null; if (SW.geo.has(p)) return SW.geo.get(p);
    const b = p.base, pos = new Int16Array(p.buf, b + p.pos, p.v * 3), nor = new Int8Array(p.buf, b + p.nor, p.v * 3), rs = new Uint8Array(p.buf, b + p.rs, p.v * 2), idx = new Uint16Array(p.buf, b + p.idx, p.i);
    const P = new Float32Array(p.v * 3), N = new Float32Array(p.v * 3), R = new Uint8Array(p.v), S = new Float32Array(p.v);
    for (let k = 0; k < p.v * 3; k++) { P[k] = pos[k] / SW.q; N[k] = nor[k] / 127; } for (let k = 0; k < p.v; k++) { R[k] = rs[k * 2]; S[k] = rs[k * 2 + 1] / 255; }
    const out = { P, N, R, S, I: idx, box: p.box, regs: p.regs }; SW.geo.set(p, out); return out;
  }
  // a pattern canvas: colour, and the pattern's dark parts in the pattern colour; tile px wide and tall (so it reads square on the part)
  function patCanvas(w, h, col, idx, pcol, tx, ty) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h);
    if (idx >= 0 && PAT.lum) { const im = x.getImageData(0, 0, w, h), D = im.data, [cr, cg, cb] = hexRGB(pcol), ox = (idx % PAT.cols) * PAT.T, oy = Math.floor(idx / PAT.cols) * PAT.T;
      for (let yy = 0; yy < h; yy++) { const sy = oy + Math.floor((((yy / ty) % 1) + 1) % 1 * PAT.T); for (let xx = 0; xx < w; xx++) { const sx = ox + Math.floor((((xx / tx) % 1) + 1) % 1 * PAT.T), L = 1 - (1 - PAT.lum[sy * PAT.w + sx] / 255) * PAT_K, a = 1 - L, p = (yy * w + xx) * 4; D[p] = D[p] * L + cr * a; D[p + 1] = D[p + 1] * L + cg * a; D[p + 2] = D[p + 2] * L + cb * a; } }
      x.putImageData(im, 0, 0); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.userData.canvas = cv; return t;
  }
  const BK_TILE = 3.2;   // cm per pattern tile on swords and straps
  // one sword, in cm: the guard at the origin, the blade along +y, its flat facing z
  function swordGroup(d, own, M) {
    const g = new THREE.Group(), parts = {}; for (const k of BK_PARTS) parts[k] = swordPart(k, d[k]);
    const B = parts.blade; if (!B) return g;
    const y0 = Math.min(...BK_PARTS.map(k => parts[k] ? parts[k].box[1] : 0)), y1 = B.box[4], s = d.len / (y1 - y0), bw = d.bladeW;
    const add = (geo, mat, nm) => { own.geos.push(geo); const m = new THREE.Mesh(geo, mat); m.name = nm; g.add(m); own.tris += triOf(geo); return m; };
    for (const k of BK_PARTS) {
      const pt = parts[k]; if (!pt) continue; if (k === 'blade' && d.sheath) continue;
      for (let reg = 0; reg < 2; reg++) {
        const I = []; for (let t = 0; t < pt.I.length; t += 3) if (pt.R[pt.I[t]] === reg) I.push(pt.I[t], pt.I[t + 1], pt.I[t + 2]); if (!I.length) continue;
        const used = new Int32Array(pt.P.length / 3).fill(-1), P = [], N = [], C = [], U = []; let n = 0; const I2 = [];
        const bx = pt.box, wX = Math.max(1e-3, bx[3] - bx[0]), hY = Math.max(1e-3, bx[4] - bx[1]);
        for (const v of I) { if (used[v] < 0) { used[v] = n++; const xx = pt.P[v * 3] * (k === 'blade' ? bw : 1), yy = pt.P[v * 3 + 1], zz = pt.P[v * 3 + 2]; P.push(xx * s, yy * s, zz * s); N.push(pt.N[v * 3], pt.N[v * 3 + 1], pt.N[v * 3 + 2]); const sh = 0.72 + 0.4 * pt.S[v]; C.push(sh, sh, sh);
            if (k === 'blade') U.push((pt.P[v * 3] - bx[0]) / wX, (yy - bx[1]) / hY); else if (k === 'grip') U.push(Math.abs(Math.atan2(zz, pt.P[v * 3])) / Math.PI, (yy - bx[1]) / hY); else U.push(0.5, 0.5); }
          I2.push(used[v]); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I2);
        const mat = k === 'blade' ? (reg ? M.edge : M.blade) : k === 'grip' ? (reg ? M.wrap : M.grip) : k === 'pommel' && reg ? M.gem : M.hilt;
        add(geo, mat, k);
      }
    }
    // the scabbard: the blade's outline, a little bigger, with a throat and a tip in the hilt's metal
    if (d.sheath) {
      const bx = B.box, hw = Math.max(Math.abs(bx[0]), Math.abs(bx[3])) * bw * s + 0.7, yA = Math.max(0.2, bx[1] * s - 0.3), yB = bx[4] * s + 1.2, th = Math.max(1.6, (bx[5] - bx[2]) * s + 1.2), tip = Math.min(yB - yA, hw * 2.4);
      const sh = new THREE.Shape(); sh.moveTo(-hw, yA); sh.lineTo(hw, yA); sh.lineTo(hw * 0.9, yB - tip); sh.quadraticCurveTo(hw * 0.86, yB - tip * 0.2, 0, yB); sh.quadraticCurveTo(-hw * 0.86, yB - tip * 0.2, -hw * 0.9, yB - tip); sh.closePath();
      const bev = Math.min(0.6, th * 0.35), geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.1, th - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 2, curveSegments: 10 }); geo.translate(0, 0, -th / 2 + bev);
      const P = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, clamp((P.getX(i) + hw) / (2 * hw), 0, 1), clamp((P.getY(i) - yA) / (yB - yA), 0, 1)); uv.needsUpdate = true; smoothNormals(geo);
      add(geo, M.sheath, 'sheath');
      for (const [ya, yb, sc] of [[yA, yA + 2.2, 1.06]]) { const r2 = new THREE.Shape(); const w2 = hw * sc + 0.15; r2.moveTo(-w2, ya); r2.lineTo(w2, ya); r2.lineTo(w2, yb); r2.lineTo(-w2, yb); r2.closePath(); const gg = new THREE.ExtrudeGeometry(r2, { depth: th * 1.04, bevelEnabled: false }); gg.translate(0, 0, -th * 0.52); if (ya > yA) { const PP = gg.attributes.position; for (let i = 0; i < PP.count; i++) { const f = clamp((PP.getY(i) - ya) / (yb - ya), 0, 1); PP.setX(i, PP.getX(i) * (1 - 0.85 * f * f)); } gg.computeVertexNormals(); } add(gg, M.hiltPlain, 'sheathMetal'); }
    }
    g.userData.len = d.len; g.userData.hiltLen = -y0 * s; g.userData.halfW = Math.max(Math.abs(B.box[0]), Math.abs(B.box[3])) * bw * s;
    return g;
  }
  // a closed loop round her body (a baldric or a belt), as points with outward normals
  function bodyLoop(F, at, r) {
    const pts = [], nr = [];
    for (let i = 0; i < 64; i++) {
      const al = i / 64 * TAU, [y, xMax] = at(al), zc = (F.front(0, y) + F.back(0, y)) / 2, b = (F.front(0, y) - F.back(0, y)) / 2 + r + 0.6, a = Math.max(F.halfW(y) + r + 0.6, 6);
      let x = clamp(a * Math.sin(al), -xMax, xMax), z = zc + b * Math.cos(al);
      if (Math.cos(al) > 0.05) z = Math.max(z, F.front(x, y) + r + 0.5); else if (Math.cos(al) < -0.05) z = Math.min(z, F.back(x, y) - r - 0.5);
      pts.push(V3(x, y, z));
    }
    for (let pass = 0; pass < 3; pass++) { const c = pts.map(p => p.clone()); for (let i = 0; i < 64; i++) pts[i].copy(c[(i + 63) % 64]).add(c[i].clone().multiplyScalar(2)).add(c[(i + 1) % 64]).multiplyScalar(0.25); }
    for (let i = 0; i < 64; i++) { const p = pts[i], zc = (F.front(0, p.y) + F.back(0, p.y)) / 2; nr.push(V3(p.x * 0.4, 0, p.z - zc).normalize()); }
    pts.push(pts[0].clone()); nr.push(nr[0].clone()); return { pts, nr };
  }
  function buildBack(d, ctx) {
    const { sandy } = ctx, F = bodyField(sandy), own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugBack'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'back', design: d };
    const metal = d.finish === 'metal', rough = d.finish === 'matte' ? 0.8 : metal ? 0.3 : 0.35, mk = (col, o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: rough, metalness: metal ? 0.75 : 0.05, envMap: ENV, envMapIntensity: metal ? 1 : 0.5, vertexColors: true, side: THREE.DoubleSide }, o || {})); own.mats.push(m); return m; };
    const pm = (tex, o) => { own.mats.push({ dispose() { tex.dispose(); } }); return mk('#ffffff', Object.assign({ map: tex }, o || {})); };
    const parts = {}; for (const k of BK_PARTS) parts[k] = swordPart(k, d[k]);
    const B = parts.blade, s = B ? d.len / (B.box[4] - Math.min(...BK_PARTS.map(k => parts[k] ? parts[k].box[1] : 0))) : 1;
    const bwCm = B ? (B.box[3] - B.box[0]) * d.bladeW * s : 6, blCm = B ? (B.box[4] - B.box[1]) * s : 60, gr = parts.grip, gwCm = gr ? Math.PI * (gr.box[3] - gr.box[0]) * s / 2 : 8, glCm = gr ? (gr.box[4] - gr.box[1]) * s : 12;
    const M = {
      blade: d.bladePat >= 0 ? pm(patCanvas(128, 512, d.bladeCol, d.bladePat, d.bladePatCol, 128 / bwCm * BK_TILE, 512 / blCm * BK_TILE)) : mk(d.bladeCol), edge: mk(d.edgeCol, { roughness: Math.max(0.15, rough - 0.15) }),
      hilt: mk(d.hiltCol), hiltPlain: mk(d.hiltCol, { vertexColors: false }), gem: mk(d.gemCol, { roughness: 0.15, metalness: 0.1, envMapIntensity: 1.2 }),
      grip: d.gripPat >= 0 ? pm(patCanvas(128, 256, d.gripCol, d.gripPat, d.gripPatCol, 128 / gwCm * BK_TILE, 256 / glCm * BK_TILE), { roughness: 0.7, metalness: 0 }) : mk(d.gripCol, { roughness: 0.75, metalness: 0 }), wrap: mk(d.wrapCol, { roughness: 0.8, metalness: 0 }),
      sheath: null
    };
    if (d.sheath) { const hw = bwCm / 2 + 0.7, ln = blCm + 1.5; M.sheath = d.sheathPat >= 0 ? pm(patCanvas(128, 512, d.sheathCol, d.sheathPat, d.sheathPatCol, 128 / (2 * hw) * BK_TILE, 512 / ln * BK_TILE), { vertexColors: false, roughness: 0.5, metalness: 0.05 }) : mk(d.sheathCol, { vertexColors: false, roughness: 0.5, metalness: 0.05 }); }
    // where each sword goes: a guard point and the blade's direction, with its flat facing `face`
    const place = (sw, G, dir, face) => { const Y = dir.clone().normalize(), Z = face.clone().addScaledVector(Y, -face.dot(Y)).normalize(), X = V3().crossVectors(Y, Z).normalize(); sw.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); sw.position.copy(G); root.add(sw); };
    const th = d.tilt * Math.PI / 180, half = bwCm / 2;
    if (d.kind === 'hip') {
      const yG = 103 + d.drop * 0.3, xS = F.halfW(yG) + 2.2 + (d.sheath ? 0.8 : 0), zc = (F.front(xS - 3, yG) + F.back(xS - 3, yG)) / 2 + 2.5;
      const sw = swordGroup(d, own, M); place(sw, V3(xS + 1, yG, zc + 5), V3(0.12, -0.86, -0.5), V3(1, 0, 0));
    } else {
      const n = d.kind === 'back2' ? 2 : 1, yG = 138 + d.drop;
      for (let k = 0; k < n; k++) {
        const sx = n === 2 ? (k ? 1 : -1) : -1, dir = V3(-sx * Math.sin(th), -Math.cos(th), 0), Gx = sx * (n === 2 ? 6 : 4.5);
        let zB = 1e9; for (let t = -10; t <= blCm; t += 4) { const p = V3(Gx, yG, 0).addScaledVector(dir, t); if (p.y < 96 || p.y > 168 || Math.abs(p.x) > 17) continue; zB = Math.min(zB, F.back(p.x, p.y)); }
        if (zB > 1e8) zB = F.back(0, 125);
        const zz = zB - (d.sheath ? 2.2 : 1.6) - (d.strap ? 0.9 : 0) - k * 2.2;
        const sw = swordGroup(d, own, M); place(sw, V3(Gx, yG, zz), dir, V3(0, 0, -1));
      }
    }
    // the strap: a baldric (or two crossed) round her chest, or a belt at her hips
    if (d.strap) {
      const SP = 16, W = 512, H = 128, PXs = 16, tex = patCanvas(W, H, d.strapCol, d.strapPat, d.strapPatCol, BK_TILE * PXs, BK_TILE * PXs); own.mats.push({ dispose() { tex.dispose(); } });
      const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.8, metalness: 0, envMap: ENV, envMapIntensity: 0.3, side: THREE.DoubleSide }); own.mats.push(sm);
      const UVS = { cm: true, period: SP, u: cm => (1 + cm * PXs) / W, v: off => 1 - (H / 2 + off * PXs) / H }, r = 0.25;
      const loops = d.kind === 'hip' ? [al => [104 + d.drop * 0.3, 40]] : (d.kind === 'back2' ? [-1, 1] : [1]).map(sx => al => { const y = 126 + 21 * sx * Math.sin(al); return [y + (y > 140 ? (y - 140) * 0.25 : 0), y > 138 ? 12.5 : 40]; });
      for (const at of loops) { const { pts, nr } = bodyLoop(F, at, r + d.strapW * 0.1), geo = roundSweep(pts, nr, d.strapW, 0.45, UVS); own.geos.push(geo); const m = new THREE.Mesh(geo, sm); m.name = 'strap'; root.add(m); own.tris += triOf(geo); }
    }
    return { root, d, info: { tris: Math.round(own.tris) }, frame: 'world', dispose() { for (const g of own.geos) g.dispose(); for (const m of own.mats) m.dispose(); } };
  }

  /* ================================================================ clothing
     Clothes from the Modular Anime Character pack, fitted to her body (tools/catalog/clothes/fit.mjs: assets/clothes/<id>.bin,
     each garment skinned to her own skeleton, plus the list of her skin it covers) and coloured by the pack's colour masks
     (assets/clothes/tex/<tex>_m.webp: red, green and blue mark three areas, each channel's brightness is its shading) with
     its normal maps (<tex>_n.webp). Five departments: tops, jackets, bottoms, shoes and outfits; she wears three slots (top:
     a top, a jacket or an outfit; legs: bottoms; feet: shoes). A shirt and trousers are her default: they show in any slot
     with nothing else in it (an outfit covers both). Open-toe shoes from the pack are left out (Sandals covers those).
     build() puts a piece on her through sandy.__wear (one per slot, stacked so a card picture can borrow a slot) and
     clothSync() redraws every slot; dispose() puts back what was there. */
  const CLOTH_BASE = ON_SITE ? AB + 'clothes/' : 'clothes/';
  const CLOTH_DEPTS = ['tops', 'jackets', 'bottoms', 'shoes', 'outfits'];
  const isCloth = dp => CLOTH_DEPTS.includes(dp);
  const CLOTH_DEPT_LABEL = { tops: 'Tops', jackets: 'Jackets', bottoms: 'Bottoms', shoes: 'Shoes', outfits: 'Outfits' };
  const CLOTH_SLOT_OF = { tops: 'top', jackets: 'top', outfits: 'top', bottoms: 'legs', shoes: 'feet' };
  // [id, dept, label, sub-kind, texture key, mask variants, names of the three colour areas, default colours]
  const CLOTHES = [
    ['tee', 'tops', 'T-shirt', 'shirts', 'top001', ['Plain', 'Ringer'], ['Shirt', 'Trim', 'Detail'], ['#f4f4f2', '#d9d9d9', '#16161a']],
    ['longsleeve', 'tops', 'Long-sleeve top', 'shirts', 'top008', ['Plain', 'Striped'], ['Top', 'Trim', 'Detail'], ['#f4f4f2', '#1b2a55', '#16161a']],
    ['shirt', 'tops', 'Button-up shirt', 'shirts', 'top004', null, ['Shirt', 'Buttons and cuffs', 'Detail'], ['#cfe3f5', '#f4f4f2', '#16161a']],
    ['vest', 'tops', 'Shirt and vest', 'shirts', 'top005', null, ['Shirt', 'Vest', 'Detail'], ['#f4f4f2', '#3a3b40', '#16161a']],
    ['tie', 'tops', 'Shirt and tie', 'shirts', 'top010', null, ['Shirt', 'Tie', 'Detail'], ['#f4f4f2', '#8a1c2b', '#1b2a55']],
    ['openshirt', 'tops', 'Open shirt and tee', 'shirts', 'top006', null, ['Open shirt', 'Tee', 'Detail'], ['#8a1c2b', '#f4f4f2', '#16161a']],
    ['sweatshirt', 'tops', 'Sweatshirt', 'sweaters', 'top003', null, ['Body', 'Cuffs and hem', 'Detail'], ['#9df2c6', '#f4f4f2', '#16161a']],
    ['hoodie', 'tops', 'Hoodie', 'sweaters', 'top009', null, ['Body', 'Hood lining and cuffs', 'Detail'], ['#3a3b40', '#ff6fb0', '#f4f4f2']],
    ['jacket', 'jackets', 'Zip jacket', 'jackets', 'top002', null, ['Lining', 'Jacket', 'Zip and pulls'], ['#f4f4f2', '#2b62d9', '#c8ccd2']],
    ['cropjacket', 'jackets', 'Cropped jacket', 'jackets', 'xtopsmall', null, ['Top', 'Jacket', 'Detail'], ['#f4f4f2', '#16161a', '#c8ccd2']],
    ['cropjacket2', 'jackets', 'Cropped jacket and crop top', 'jackets', 'xtop', null, ['Top', 'Jacket', 'Detail'], ['#f4f4f2', '#e8344f', '#c8ccd2']],
    ['blazer', 'jackets', 'School blazer', 'jackets', 'top011', null, ['Shirt', 'Blazer', 'Tie and trim'], ['#f4f4f2', '#1b2a55', '#8a1c2b']],
    ['pants', 'bottoms', 'Trousers', 'trousers', 'bot001', null, ['Trousers', 'Trim', 'Belt'], ['#2b3a5c', '#3a3b40', '#16161a']],
    ['skinny', 'bottoms', 'Skinny jeans', 'trousers', 'bot004', null, ['Jeans', 'Trim', 'Detail'], ['#3b5a8c', '#3b5a8c', '#c9a27e']],
    ['loosepants', 'bottoms', 'Loose trousers and belt', 'trousers', 'xbot', null, ['Trousers', 'Belt', 'Buckle'], ['#6b4428', '#16161a', '#c8ccd2']],
    ['shorts', 'bottoms', 'Shorts', 'shorts', 'bot002', null, ['Shorts', 'Trim', 'Detail'], ['#3b5a8c', '#f4f4f2', '#c9a27e']],
    ['longshorts', 'bottoms', 'Long shorts', 'shorts', 'bot005', null, ['Shorts', 'Trim', 'Detail'], ['#c9a27e', '#6b4428', '#16161a']],
    ['skirt', 'bottoms', 'Short skirt', 'skirts', 'bot003', null, ['Skirt', 'Trim', 'Detail'], ['#1b2a55', '#f4f4f2', '#16161a']],
    ['sneakers', 'shoes', 'High-top sneakers', 'sneakers', 'shoes002', null, ['Upper', 'Sole and laces', 'Detail'], ['#e8344f', '#f4f4f2', '#16161a']],
    ['lowsneakers', 'shoes', 'Sneakers', 'sneakers', 'shoes006', null, ['Upper', 'Sole and laces', 'Detail'], ['#f4f4f2', '#f4f4f2', '#2b62d9']],
    ['boots', 'shoes', 'Boots and socks', 'boots', 'shoes001', null, ['Boots', 'Laces', 'Socks'], ['#6b4428', '#c9a27e', '#f4f4f2']],
    ['chelsea', 'shoes', 'Chelsea boots', 'boots', 'shoes007', null, ['Boots', 'Elastic', 'Detail'], ['#16161a', '#3a3b40', '#c9a27e']],
    ['highboots', 'shoes', 'Tall boots', 'boots', 'shoes005', null, ['Boots', 'Trim', 'Laces'], ['#16161a', '#3a3b40', '#c8ccd2']],
    ['overalls', 'outfits', 'Overalls and tee', 'outfits', 'overalls', null, ['Overalls', 'Tee', 'Buttons'], ['#3b5a8c', '#f4f4f2', '#d4af37']],
    ['outfit2', 'outfits', 'Top and skirt', 'outfits', 'outfit002', null, ['Main', 'Second colour', 'Detail'], ['#ff8fc2', '#f4f4f2', '#16161a']],
    ['outfit3', 'outfits', 'Dress and jacket', 'outfits', 'outfit003', null, ['Main', 'Second colour', 'Detail'], ['#7d3fc4', '#f4f4f2', '#16161a']],
    ['racer', 'outfits', 'Racing suit', 'outfits', 'outfit004', null, ['Suit', 'Stripes', 'Detail'], ['#e8344f', '#f4f4f2', '#16161a']]
  ].map(([id, dept, label, sub, tex, vars, areas, cols]) => ({ id, dept, label, sub, tex, vars, areas, cols, feet: id === 'racer' }));
  const CLOTH_BY = Object.fromEntries(CLOTHES.map(c => [c.id, c]));
  const CLOTH_LABEL = Object.fromEntries(CLOTHES.map(c => [c.id, c.label]));
  const CLOTH_SUBS = { tops: [['shirts', 'Shirts'], ['sweaters', 'Sweaters and hoodies']], jackets: [], bottoms: [['trousers', 'Trousers'], ['shorts', 'Shorts'], ['skirts', 'Skirts']], shoes: [['sneakers', 'Sneakers'], ['boots', 'Boots']], outfits: [] };
  const CLOTH_SUB_LABEL = Object.fromEntries(Object.values(CLOTH_SUBS).flat().concat([['jackets', 'Jackets'], ['outfits', 'Outfits']]));
  const CLOTH_DEFAULT = { top: { part: 'tee', colA: '#f4f4f2', colB: '#e2e2de', colC: '#16161a', vari: 0, pat: -1 }, legs: { part: 'pants', colA: '#2b3a5c', colB: '#2b3a5c', colC: '#16161a', vari: 0, pat: -1 } };
  // the garments, loaded once each (geometry, colour mask, normal map)
  const CDATA = new Map();
  function clothData(id) {
    if (CDATA.has(id)) return CDATA.get(id);
    const c = CLOTH_BY[id], rec = { ready: false };
    rec.p = (async () => {
      const buf = await (await fetch(CLOTH_BASE + id + '.bin')).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), B = 4 + hl;
      rec.geos = head.parts.map(p => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, B + p.pos, p.v * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf, B + p.nor, p.v * 3), 3, true)); g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(buf, B + p.uv, p.v * 2), 2, true)); g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(buf, B + p.si, p.v * 4), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(buf, B + p.sw, p.v * 4), 4, true)); g.setIndex(new THREE.BufferAttribute(p.big ? new Uint32Array(buf, B + p.idx, p.i) : new Uint16Array(buf, B + p.idx, p.i), 1)); g.computeBoundingSphere(); return g; });
      rec.hide = new Uint16Array(buf, B + head.hide, head.nhide); rec.soft = head.nsoft ? new Uint16Array(buf, B + head.soft, head.nsoft) : []; rec.tris = head.parts.reduce((s, p) => s + p.i / 3, 0);
      const tl = new THREE.TextureLoader(), tex = f => new Promise(ok => tl.load(CLOTH_BASE + 'tex/' + f, t => ok(t), undefined, () => ok(null)));
      const vs = c.vars ? c.vars.map((v, i) => c.tex + '_' + 'ab'[i] + '_m.webp') : [c.tex + '_m.webp'];
      rec.masks = await Promise.all(vs.map(tex)); rec.normal = await tex(c.tex + '_n.webp');
      for (const t of rec.masks.concat([rec.normal])) if (t) { t.encoding = THREE.LinearEncoding; t.anisotropy = 4; t.needsUpdate = true; }
      rec.ready = true; return rec;
    })().catch(e => { console.warn('clothes', id, e); rec.failed = true; return rec; });
    CDATA.set(id, rec); return rec;
  }
  const prep = (dp, d) => isCloth(dp) && d && CLOTH_BY[d.part] ? clothData(d.part).p : Promise.resolve();
  // one tile of a print, as a texture the garment repeats
  const patTex = new Map();
  function patTile(idx) {
    if (patTex.has(idx)) return patTex.get(idx); if (!PAT.lum) return null;
    const T = PAT.T, D = new Uint8Array(T * T * 4), ox = (idx % PAT.cols) * T, oy = Math.floor(idx / PAT.cols) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const L = Math.round(255 * (1 - (1 - PAT.lum[(oy + y) * PAT.w + ox + x] / 255) * PAT_K)), p = ((T - 1 - y) * T + x) * 4; D[p] = D[p + 1] = D[p + 2] = L; D[p + 3] = 255; }
    const t = new THREE.DataTexture(D, T, T); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipMapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; patTex.set(idx, t); return t;
  }
  // a garment's material: the mask's three areas in three colours, shaded by the mask, with the print on the first area
  function clothMat(d, rec, paint, cut) {
    const lin = h => new THREE.Color(h).convertSRGBToLinear(), U = { uA: { value: lin(paint || d.colA) }, uB: { value: lin(paint || d.colB) }, uC: { value: lin(paint || d.colC) }, uPat: { value: null }, uPatCol: { value: lin(d.patCol || '#16161a') }, uTiles: { value: d.tiles || 14 } };
    const pt = !paint && d.pat >= 0 ? patTile(d.pat) : null; U.uPat.value = pt;
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rec.masks[Math.min(d.vari || 0, rec.masks.length - 1)] || null, normalMap: rec.normal || null, roughness: 0.82, metalness: 0, envMap: ENV, envMapIntensity: 0.35, side: THREE.DoubleSide });
    if (cut) m.clippingPlanes = [cut];
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.fragmentShader = 'uniform vec3 uA, uB, uC, uPatCol; uniform sampler2D uPat; uniform float uTiles;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 mk = texture2D( map, vUv ); float mm = max( max( mk.r, mk.g ), max( mk.b, 0.001 ) );
        float wb = smoothstep( 0.25, 0.75, mk.g / mm ), wc = smoothstep( 0.25, 0.75, mk.b / mm ); vec3 base = uA;
        ${pt ? 'base = mix( uPatCol, uA, texture2D( uPat, vUv * uTiles ).r );' : ''}
        base = mix( mix( base, uB, wb ), uC, wc ); diffuseColor.rgb *= base * ( 0.42 + 0.68 * mm );
      #endif`); };
    m.customProgramCacheKey = () => 'grugcloth' + (pt ? 'p' : ''); m.userData.clothU = U; return m;
  }
  // what she has on, slot by slot, drawn again from sandy.__wear
  // a piece built for a card picture: while it's taken, she wears only that (and the basic outfit), not her own wardrobe
  const CLOTH_PIC = { on: false };
  function clothState(sandy) { return sandy.__wear || (sandy.__wear = { on: {}, meshes: [], paint: null, hide0: null }); }
  function clothSync(sandy) {
    const st = clothState(sandy), body = sandy.n3.body; if (!body) return;
    for (const m of st.meshes) { if (m.parent) m.parent.remove(m); m.material.dispose(); } st.meshes = [];
    // her old outfit pieces (the kit's shirt, shorts and belt) never show
    sandy.object3d.traverse(o => { if (/^(shirt_geo|shorts_geo|belt_geo)$/.test(o.name)) o.visible = false; });
    const on = st.on, top = on.top || null, outfit = top && CLOTH_BY[top.part] && CLOTH_BY[top.part].dept === 'outfits';
    const want = [['top', top || CLOTH_DEFAULT.top, !top], ['legs', outfit ? null : on.legs || CLOTH_DEFAULT.legs, !on.legs], ['feet', top && CLOTH_BY[top.part] && CLOTH_BY[top.part].feet ? null : on.feet || null, false]];
    const A = body.geometry.attributes.aHide; if (A && !st.hide0) st.hide0 = A.array.slice(); if (A && st.hide0) { if (st.hide0.length !== A.array.length) st.hide0 = A.array.slice(); A.array.set(st.hide0); }
    for (const [slot, d, dflt] of want) {
      if (!d) continue; const rec = clothData(d.part); if (!rec.ready) { rec.p.then(() => { if (sandy.__wear === st) clothSync(sandy); }); continue; }
      const paint = dflt ? st.paint : null;
      for (const g of rec.geos) { const m = new THREE.SkinnedMesh(g, clothMat(d, rec, paint, sandy.__cut)); m.name = 'garment_' + slot; m.frustumCulled = false; m.userData.garment = { slot, dflt }; body.parent.add(m); m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale); m.bind(body.skeleton, body.bindMatrix); st.meshes.push(m); }
      if (A) { for (const i of rec.hide) if (i < A.count) A.array[i] = 1; for (const i of rec.soft) if (i < A.count && A.array[i] < 0.8) A.array[i] = 0.8; }   // a hem's last ring: hidden part of the way
    }
    if (A) A.needsUpdate = true;
    // shoes take her flip-flops off
    const shod = want[2][1] || (top && CLOTH_BY[top.part] && CLOTH_BY[top.part].feet); (sandy.n3.sandals || []).forEach(sd => { if (sd && sd.group) sd.group.visible = !shod && !sd.__hiddenBySandals; });
    sandy.object3d.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.toeU) o.visible = !shod; });
    delete sandy.__jfield;
  }
  // the default pieces take her mannequin paint on card pictures (null: their own colours)
  function clothPaint(sandy, css) { const st = clothState(sandy); if (st.paint === css) return; st.paint = css; const lin = new THREE.Color(css || '#ffffff').convertSRGBToLinear(); for (const m of st.meshes) { if (!m.userData.garment.dflt) continue; if (css) { const U = m.material.userData.clothU; U.uA.value.copy(lin); U.uB.value.copy(lin); U.uC.value.copy(lin); } else { m.material.dispose(); } } if (!css) clothSync(sandy); }
  const clothMeshes = (sandy, slot) => (sandy.__wear ? sandy.__wear.meshes : []).filter(m => !slot || m.userData.garment.slot === slot);
  const CL_COLS = ['colA', 'colB', 'colC', 'patCol'];
  const defCloth = dept => { const c = CLOTHES.find(x => x.dept === dept); return { v: 2, brand: 'grug', part: c.id, colA: c.cols[0], colB: c.cols[1], colC: c.cols[2], vari: 0, pat: -1, patCol: '#16161a', tiles: 14, charms: [] }; };
  for (const dp of CLOTH_DEPTS) { DEF[dp] = () => defCloth(dp); LIMITS[dp] = { n: 0 }; }
  function validateC(dp, src, brand) {
    const notes = [], D0 = defCloth(dp), d = Object.assign(defCloth(dp), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!CLOTH_BY[d.part] || CLOTH_BY[d.part].dept !== dp) { d.part = D0.part; }
    for (const k of CL_COLS) if (!isHex(d[k])) d[k] = D0[k];
    const c = CLOTH_BY[d.part]; d.vari = c.vars ? clamp(Math.round(+d.vari) || 0, 0, c.vars.length - 1) : 0;
    { const v = Math.round(+d.pat); d.pat = isFinite(v) && v >= 0 && v < PAT_N ? v : -1; } d.tiles = clamp(isFinite(+d.tiles) ? +d.tiles : 14, 4, 40); d.charms = [];
    if (d.brand === 'kimiland') { let ch = false; for (const k of CL_COLS) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); ch = true; } if (ch) notes.push('Brought to KIMILAND pastels'); }
    return { d, notes };
  }
  function randomC(dp, seed, o) {
    o = o || {}; const r = rng('jewel:' + dp + ':' + seed), brand = o.brand || brandFor(seed, 0.18), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ classic: 3, sweet: 1.6, ocean: 1.2, forest: 1, night: 1.4, halloween: 0.6, christmas: 0.5, valentines: 0.8 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], NEUT = ['#f4f4f2', '#16161a', '#3a3b40', '#c8ccd2', '#2b3a5c', '#3b5a8c', '#c9a27e', '#6b4428'], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.chance(0.45) ? r.pick(NEUT) : r.pick(T.cols);
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : defCloth(dp); d.brand = brand;
    const recolour = () => { d.colA = pick(); d.colB = r.chance(0.35) ? d.colA : pick(); d.colC = kimi ? '#fffafc' : r.chance(0.5) ? r.pick(NEUT) : pick(); d.patCol = kimi ? r.pick(['#fffafc', r.pick(pal.acc)]) : r.chance(0.5) ? shadeOf(d.colA) : pick(); if (d.patCol === d.colA) d.patCol = shadeOf(d.colA); };
    if (o.keep === 'shape') { recolour(); return validateC(dp, d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? CL_COLS.map(k => d[k]) : null;
    const pool = CLOTHES.filter(c => c.dept === dp && (!o.kind || c.sub === o.kind)); const c = r.pick(pool.length ? pool : CLOTHES.filter(x => x.dept === dp)); d.part = c.id; d.vari = c.vars ? r.i(0, c.vars.length - 1) : 0;
    d.pat = r.chance(dp === 'shoes' ? 0.12 : 0.3) ? r.i(0, PAT_N - 1) : -1; d.tiles = r.f(8, 22);
    recolour(); if (keepC) CL_COLS.forEach((k, i) => { d[k] = keepC[i]; });
    return validateC(dp, d, brand).d;
  }
  function nameC(dp, d, seed) { const r = rng('jname:' + seed + ':' + dp), kimi = d.brand === 'kimiland', colour = colourName(d.colA, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(FLAVOUR), noun = CLOTH_LABEL[d.part] || 'Top', pat = d.pat >= 0 ? r.pick(['Print', 'Patterned', 'Printed']) : ''; const forms = [[colour, noun], [fl, colour, noun], [pat || fl, noun], [colour, pat, noun]]; return forms[r.i(0, 3)].filter(Boolean).join(' ').replace(/\s+/g, ' '); }
  function tagsC(dp, d) { const c = CLOTH_BY[d.part], t = ['Clothing', CLOTH_DEPT_LABEL[dp], c.label, CLOTH_SUB_LABEL[c.sub]]; if (c.vars) t.push(c.vars[d.vari]); t.push(d.pat >= 0 ? 'Patterned' : 'Solid colour'); if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t.filter(Boolean))); }
  function familiesC(dp, d) { const f = new Set([famOfHex(d.colA), famOfHex(d.colB)]); if (d.pat >= 0) f.add(famOfHex(d.patCol)); if (f.size > 2) f.add('multi'); return f; }
  function describeC(dp, d) { const kimi = d.brand === 'kimiland', c = CLOTH_BY[d.part], cn = h => colourName(h, kimi).toLowerCase(); const lab = c.label.toLowerCase(), pl = w => /[^s]s$/.test(w), ws = lab.split(' '), pair = pl(ws[ws.length - 1]) && !/ and /.test(lab), bare = !pair && pl(ws[0]), head = (d.pat >= 0 ? 'printed ' : '') + cn(d.colA); return `${pair ? 'A pair of ' + head : bare ? head.charAt(0).toUpperCase() + head.slice(1) : (/^[aeiou]/.test(head) ? 'An ' : 'A ') + head} ${lab}${d.colB !== d.colA ? ', with ' + cn(d.colB) + ' ' + c.areas[1].toLowerCase() : ''}${d.pat >= 0 ? ', and a ' + cn(d.patCol) + ' pattern' : ''}.` + (c.dept === 'outfits' ? ' A whole outfit: it takes the place of a top and bottoms.' : '') + (kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : '') + ' From the Modular Anime Character pack, fitted to her.'; }
  function buildCloth(dp, d, ctx) {
    const { sandy } = ctx, root = new THREE.Group(); root.name = 'grugClothing'; root.userData.catalogItem = true; root.userData.jewel = { dept: dp, design: d };
    const st = clothState(sandy), slot = CLOTH_SLOT_OF[dp], token = {}, prev = st.on[slot]; st.on[slot] = Object.assign({}, d, { __t: token, __pic: CLOTH_PIC.on }); clothSync(sandy);
    root.userData.meshes = () => clothMeshes(sandy, slot); const rec = clothData(d.part);
    return { root, d, info: { tris: Math.round(rec.tris || 0) }, frame: 'world', dispose() { if (st.on[slot] && st.on[slot].__t === token) { if (prev) st.on[slot] = prev; else delete st.on[slot]; clothSync(sandy); } } };
  }
  // her default shirt and trousers go on as soon as the page has her
  function clothInit(sandy) { clothData(CLOTH_DEFAULT.top.part); clothData(CLOTH_DEFAULT.legs.part); clothSync(sandy); return Promise.all([clothData(CLOTH_DEFAULT.top.part).p, clothData(CLOTH_DEFAULT.legs.part).p]).then(() => clothSync(sandy)); }

  /* ================================================================ hats
     The classic hats (Chibi Hats by PaperPluto, window.HATPACK: eight low-poly hats and their shaded texture, already in
     assets/sandy-classic.js), made for her head: they sit in her head frame exactly where the classic kit seats them. Each
     takes any colour in up to three areas (the hat, its brim or trim, and a band round the crown), a print on the hat, and
     charms pinned on the crown (raycast onto its surface: at = round the crown, -1 left to 1 right; up = how high, 0 to 1).
     A hat never changes anything else on her (hair, glasses, her head): it simply sits on top. Where it sits is the
     player's: pos (x, y, z), rot (x, y, z, radians) and scale (x, y, z), set with the closet's Position / Rotation / Size
     sliders and applied about the hat's seat (hatPose). Not downloadable: there's no licence on file for handing out the
     pack's files. */
  const HAT_KINDS = [['beanie', 'Beanie'], ['beret', 'Beret'], ['bucketHat', 'Bucket hat'], ['cap', 'Cap'], ['cowboyHat', 'Cowboy hat'], ['sunHat', 'Sun hat'], ['topHat', 'Top hat'], ['witchHat', 'Witch hat']];
  const HAT_LABEL = Object.fromEntries(HAT_KINDS);
  // per hat: the names of its areas, which islands of the mesh are the second area (brim, visor, trim), a second area drawn
  // below a height on one-piece hats (brimBelow), the band round the crown [from, to] (heights in the hat's own units), and
  // the crown's middle for charms
  const HAT_INFO = {
    beanie: { areas: ['Beanie', 'Cuff'], brimBelow: 8.2, band: null },
    beret: { areas: ['Beret', 'Trim'], second: 'small', band: null },
    bucketHat: { areas: ['Hat', 'Brim', 'Band'], brimBelow: 7.6, band: [7.6, 10.6] },
    cap: { areas: ['Cap', 'Visor and button'], second: 'cap', band: null },
    cowboyHat: { areas: ['Hat', 'Brim', 'Band'], second: 'low', band: [7.2, 10] },
    sunHat: { areas: ['Hat', 'Brim', 'Band'], second: 'low', band: [9.6, 12.6] },
    topHat: { areas: ['Hat', 'Brim', 'Band'], second: 'low', band: [9, 13.6] },
    witchHat: { areas: ['Hat', 'Brim', 'Band'], second: 'low', band: [13.6, 18.2] }
  };
  const HAT_N = 4, KH = 2.1, HAT_COLS = ['col', 'col2', 'col3', 'patCol'];
  const hatSrc = kind => { const P = window.HATPACK; return P && P.hats ? P.hats.find(h => h.id === 'hat_' + kind) : null; };
  const hasHats = () => !!(window.HATPACK && window.HATPACK.hats && window.HATPACK.hats.length);
  DEF.hats = () => ({ v: 2, brand: 'grug', kind: 'beanie', col: '#e8344f', col2: '#f4f4f2', col3: '#16161a', band: true, pat: -1, patCol: '#16161a', tiles: 12, finish: 'matte', pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], charms: [] });
  const HAT_POSE = { pos: [-8, 8], rot: [-Math.PI, Math.PI], scale: [0.6, 1.8] };
  LIMITS.hats = { n: HAT_N };
  function validateH(src, brand) {
    const notes = [], D0 = DEF.hats(), d = Object.assign(DEF.hats(), src || {}); d.brand = brand || d.brand; if (!BRAND_LABEL[d.brand]) d.brand = 'grug';
    if (!HAT_LABEL[d.kind]) d.kind = 'beanie';
    for (const k of HAT_COLS) if (!isHex(d[k])) d[k] = D0[k];
    { const v = Math.round(+d.pat); d.pat = isFinite(v) && v >= 0 && v < PAT_N ? v : -1; } d.tiles = clamp(isFinite(+d.tiles) ? +d.tiles : 12, 4, 30);
    if (!FINISHES.some(f => f[0] === d.finish)) d.finish = 'matte'; d.band = d.band !== false;
    // where it sits (older designs had up, fwd, tilt and one size)
    if (src && !Array.isArray(src.pos) && (src.up != null || src.fwd != null || src.tilt != null || src.size != null)) { d.pos = [0, +src.up || 0, +src.fwd || 0]; d.rot = [+src.tilt || 0, 0, 0]; const k = isFinite(+src.size) ? +src.size : 1; d.scale = [k, k, k]; }
    delete d.up; delete d.fwd; delete d.tilt; delete d.size; d.v = 2;
    const vec = (v, def, [lo, hi]) => [0, 1, 2].map(i => { const x = Array.isArray(v) ? +v[i] : NaN; return clamp(isFinite(x) ? x : def, lo, hi); });
    d.pos = vec(d.pos, 0, HAT_POSE.pos); d.rot = vec(d.rot, 0, HAT_POSE.rot); d.scale = vec(d.scale, 1, HAT_POSE.scale);
    d.charms = (d.charms || []).slice(0, HAT_N).map(e => { const o = cleanEl(e, 'hats'); o.up = clamp(isFinite(+e.up) ? +e.up : 0.45, 0, 1); return o; });
    if (d.brand === 'kimiland') { let ch = false; for (const k of HAT_COLS) if (!isPastel(d[k])) { d[k] = toPastel(d[k]); ch = true; } for (const e of d.charms) kimiEl(e, { tint: isPastel(e.col) ? e.col : toPastel(e.col) }); if (ch) notes.push('Brought to KIMILAND pastels'); }
    return { d, notes };
  }
  function randomH(seed, o) {
    o = o || {}; const r = rng('jewel:hats:' + seed), brand = o.brand || brandFor(seed, 0.22), kimi = brand === 'kimiland';
    const theme = kimi ? 'sweet' : r.w({ classic: 3, christmas: 1.6, halloween: 1.4, valentines: 1.2, sweet: 1.4, ocean: 1, forest: 1, night: 1 });
    const pal = kimi ? kimiPalette(r) : null, T = THEMES[theme], NEUT = ['#f4f4f2', '#16161a', '#3a3b40', '#c8ccd2', '#c9a27e', '#6b4428', '#efe6cf'], pick = kimi ? () => r.pick(pal.mains.concat(pal.acc)) : () => r.chance(0.35) ? r.pick(NEUT) : r.pick(T.cols);
    let d = o.base ? JSON.parse(JSON.stringify(o.base)) : DEF.hats(); d.brand = brand;
    const recolour = () => { d.col = pick(); d.col2 = r.chance(0.45) ? d.col : pick(); d.col3 = kimi ? '#fffafc' : r.chance(0.5) ? r.pick(NEUT) : pick(); d.patCol = kimi ? r.pick(['#fffafc', r.pick(pal.acc)]) : shadeOf(d.col); for (const e of d.charms) { if (e.k === 'shape') e.col = pick(); else { const c = CHARM_BY[e.id]; e.tint = kimi && !c.brand ? (pal.pink ? pal.main : r.pick(pal.mains)) : ''; } } };
    if (o.keep === 'shape') { recolour(); return validateH(d, brand).d; }
    const keepC = o.keep === 'colours' && o.base ? HAT_COLS.map(k => d[k]) : null;
    d.kind = o.kind && HAT_LABEL[o.kind] ? o.kind : r.w(theme === 'halloween' ? { witchHat: 4, topHat: 1.4, beanie: 1, cap: 1, cowboyHat: 1 } : theme === 'christmas' ? { beanie: 4, beret: 1.5, bucketHat: 1, topHat: 1, cap: 1 } : { beanie: 2, beret: 1.6, bucketHat: 1.6, cap: 2.2, cowboyHat: 1.4, sunHat: 1.6, topHat: 1, witchHat: 0.5 });
    d.band = r.chance(0.7); d.pat = r.chance(0.28) ? r.i(0, PAT_N - 1) : -1; d.tiles = r.f(8, 18); d.finish = r.w({ matte: 5, gloss: 1.5, metal: kimi ? 0 : 0.3 });
    d.pos = [0, 0, 0]; d.rot = [r.chance(0.25) ? r.f(-0.12, 0.12) : 0, 0, 0]; d.scale = [1, 1, 1];
    const n = r.w({ 0: 2.4, 1: 3, 2: 1.6, 3: 0.6 }) | 0; d.charms = [];
    for (let i = 0; i < n; i++) { const e = randomEl(r, 'necklaces', theme, pal, kimi, { charm: T.charm || kimi ? r.chance(0.8) : r.chance(0.4) }); e.size = clamp(e.size * 0.85, 1.4, 3.2); e.at = n === 1 ? r.f(-0.25, 0.25) : lerp(-0.55, 0.55, i / (n - 1)); e.up = r.f(0.3, 0.6); d.charms.push(e); }
    recolour(); if (keepC) HAT_COLS.forEach((k, i) => { d[k] = keepC[i]; });
    return validateH(d, brand).d;
  }
  const HAT_FL = ['Cozy', 'Classic', 'Comfy', 'Snug', 'Jolly', 'Merry', 'Spooky', 'Sunny', 'Lucky', 'Dapper', 'Sweet', 'Bold'];
  function nameH(d, seed) {
    const r = rng('jname:' + seed + ':hats'), kimi = d.brand === 'kimiland', colour = colourName(d.col, kimi), fl = kimi ? r.pick(KIMI_FLAVOUR) : r.pick(HAT_FL), noun = HAT_LABEL[d.kind];
    const sub = d.charms.length ? elName(mainEl(d.charms)) : '', pat = d.pat >= 0 ? r.pick(['Print', 'Printed', 'Patterned']) : '';
    const forms = [[colour, noun], [fl, colour, noun], [sub ? sub : fl, noun], [pat || fl, colour, noun]];
    return forms[r.i(0, 3)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  function tagsH(d) {
    const t = ['Hat', HAT_LABEL[d.kind]], themes = new Set(d.charms.filter(e => e.k === 'charm').map(e => CHARM_BY[e.id].theme));
    for (const th of themes) t.push(THEME_LABEL[th]); if (d.charms.length) t.push('Charms'); t.push(d.pat >= 0 ? 'Patterned' : 'Solid colour');
    if (d.brand === 'kimiland') t.push('Pastel', 'KIMILAND'); return Array.from(new Set(t));
  }
  function familiesH(d) { const f = new Set([famOfHex(d.col)]); if (HAT_INFO[d.kind].areas.length > 1) f.add(famOfHex(d.col2)); if (d.pat >= 0) f.add(famOfHex(d.patCol)); for (const e of d.charms) { if (e.k === 'shape') f.add(famOfHex(e.col)); else { const c = CHARM_BY[e.id]; if (e.tint) f.add(famOfHex(e.tint === 'pastel' ? '#ffc4dc' : e.tint)); else for (const x of c.fam) f.add(x); } } if (f.size > 3) f.add('multi'); return f; }
  function describeH(d) {
    const kimi = d.brand === 'kimiland', info = HAT_INFO[d.kind], cn = h => colourName(h, kimi).toLowerCase(), names = Array.from(new Set(d.charms.map(elName).map(s => s.toLowerCase())));
    const head = (d.pat >= 0 ? 'printed ' : '') + cn(d.col), lab = HAT_LABEL[d.kind].toLowerCase();
    const two = info.areas.length > 1 && d.col2 !== d.col ? `, with a ${cn(d.col2)} ${info.areas[1].toLowerCase()}` : '', band = info.band && d.band ? `${two ? ' and' : ', with'} a ${cn(d.col3)} band` : '';
    const ch = names.length ? ' Pinned on it: ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + '.' : '';
    return `${/^[aeiou]/.test(head) ? 'An' : 'A'} ${head} ${lab}${two}${band}.${ch}${kimi ? ' A KIMILAND piece: soft pastels, made to be cute.' : ''}`;
  }
  // the hat's mesh, its areas (an attribute per vertex) and its crown, made once per hat
  const HGEO = {};
  function hatData(kind) {
    if (HGEO[kind]) return HGEO[kind]; const h = hatSrc(kind); if (!h) return null;
    const b = x => { const s = atob(x), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    const P = new Float32Array(b(h.pos)), N8 = new Int8Array(b(h.nrm)), U16 = new Uint16Array(b(h.uv)), I = new Uint16Array(b(h.idx)), N = new Float32Array(N8.length), UV = new Float32Array(U16.length);
    for (let i = 0; i < N8.length; i++) N[i] = N8[i] / 127; for (let i = 0; i < U16.length; i++) UV[i] = U16[i] / 65535;
    // islands: pieces joined in both space and the texture (crown, brim, visor, button…)
    const nv = P.length / 3, key = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], UV[i * 2], UV[i * 2 + 1]].map(v => v.toFixed(3)).join(','), ids = new Map(), vid = new Int32Array(nv);
    for (let i = 0; i < nv; i++) { const k = key(i); if (!ids.has(k)) ids.set(k, ids.size); vid[i] = ids.get(k); }
    const par = Array.from({ length: ids.size }, (_, i) => i), f = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    for (let t = 0; t < I.length; t += 3) { const a = f(vid[I[t]]); par[f(vid[I[t + 1]])] = a; par[f(vid[I[t + 2]])] = a; }
    const isl = new Map(); for (let t = 0; t < I.length; t += 3) { const r = f(vid[I[t]]); let s = isl.get(r); if (!s) isl.set(r, s = { tris: 0, y: 0, z: 0, lo: new THREE.Vector3(1e9, 1e9, 1e9), hi: new THREE.Vector3(-1e9, -1e9, -1e9) }); s.tris++; for (let k = 0; k < 3; k++) { const v = I[t + k]; s.y += P[v * 3 + 1] / 3; s.z += P[v * 3 + 2] / 3; s.lo.min(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])); s.hi.max(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])); } }
    for (const s of isl.values()) { s.y /= s.tris; s.z /= s.tris; }
    const info = HAT_INFO[kind], list = Array.from(isl.entries()), big = list.reduce((a, b) => (b[1].tris > a[1].tris ? b : a)), low = list.reduce((a, b) => (b[1].y < a[1].y ? b : a));
    const second = r => { const s = isl.get(r); if (list.length < 2) return false; if (info.second === 'low') return r === low[0]; if (info.second === 'small') return r !== big[0]; if (info.second === 'cap') return s.z > 4 || s.hi.distanceTo(s.lo) < 6; return false; };
    const reg = new Float32Array(nv); for (let t = 0; t < I.length; t += 3) { const v = second(f(vid[I[t]])) ? 1 : 0; reg[I[t]] = reg[I[t + 1]] = reg[I[t + 2]] = v; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('aReg', new THREE.BufferAttribute(reg, 1)); g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
    // the crown: everything not in the second area (its height range, for charms)
    const cb = new THREE.Box3(); for (let i = 0; i < nv; i++) if (!reg[i] && !(info.brimBelow != null && P[i * 3 + 1] < info.brimBelow)) cb.expandByPoint(new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    return (HGEO[kind] = { g, seat: new THREE.Vector3(...h.seat), crown: cb.isEmpty() ? g.boundingBox.clone() : cb, tris: I.length / 3 });
  }
  let HAT_TEX = null;
  const hatTex = () => { if (!HAT_TEX && window.HATPACK) { HAT_TEX = new THREE.TextureLoader().load(window.HATPACK.tex); HAT_TEX.encoding = THREE.sRGBEncoding; HAT_TEX.anisotropy = 4; } return HAT_TEX; };
  function hatMat(d, own) {
    const lin = h => new THREE.Color(h).convertSRGBToLinear(), info = HAT_INFO[d.kind], band = info.band && d.band ? info.band : [-1e4, -1e4];
    const U = { uA: { value: lin(d.col) }, uB: { value: lin(info.areas.length > 1 ? d.col2 : d.col) }, uC: { value: lin(d.col3) }, uPatCol: { value: lin(d.patCol) }, uPat: { value: null }, uTiles: { value: d.tiles }, uBelow: { value: info.brimBelow != null ? info.brimBelow : -1e4 }, uBand: { value: new THREE.Vector2(band[0], band[1]) } };
    const pt = d.pat >= 0 ? patTile(d.pat) : null; U.uPat.value = pt;
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hatTex(), roughness: d.finish === 'gloss' ? 0.32 : d.finish === 'metal' ? 0.3 : 0.86, metalness: d.finish === 'metal' ? 0.75 : 0, envMap: ENV, envMapIntensity: d.finish === 'matte' ? 0.3 : 0.7, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float aReg; varying float vReg; varying vec3 vHatP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vReg = aReg; vHatP = position;');
      sh.fragmentShader = 'uniform vec3 uA, uB, uC, uPatCol; uniform sampler2D uPat; uniform float uTiles, uBelow; uniform vec2 uBand; varying float vReg; varying vec3 vHatP;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 tx = texture2D( map, vUv ); vec3 base = uA;
        ${pt ? 'base = mix( uPatCol, uA, texture2D( uPat, vUv * uTiles ).r );' : ''}
        float wb = max( vReg, 1.0 - smoothstep( uBelow - 0.2, uBelow + 0.2, vHatP.y ) );
        float wc = ( 1.0 - wb ) * smoothstep( uBand.x - 0.15, uBand.x + 0.15, vHatP.y ) * ( 1.0 - smoothstep( uBand.y - 0.15, uBand.y + 0.15, vHatP.y ) );
        base = mix( mix( base, uB, wb ), uC, wc ); diffuseColor.rgb *= base * min( vec3( 1.0 ), tx.rgb * 1.12 );
      #endif`);
    };
    m.customProgramCacheKey = () => 'grughat' + (pt ? 'p' : ''); m.userData.hatU = U; own.mats.push(m); return m;
  }
  // where the hat sits: about its seat, the player's offset, turn (x, y, z) and size per axis
  function hatPose(root, d) {
    const H = hatData(d.kind), g = root.userData.hatGroup; if (!H || !g) return;
    g.position.copy(H.seat).add(new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2])); g.rotation.set(d.rot[0], d.rot[1], d.rot[2], 'YXZ'); g.scale.set(d.scale[0], d.scale[1], d.scale[2]); g.updateMatrixWorld(true);
  }
  function buildHat(d, ctx) {
    const own = { geos: [], mats: [], tris: 0 }, root = new THREE.Group(); root.name = 'grugHat'; root.userData.catalogItem = true; root.userData.jewel = { dept: 'hats', design: d };
    const H = hatData(d.kind); if (!H) return { root, d, info: { tris: 0 }, frame: 'head', dispose() {} };
    // as the classic kit seats it: the hat turns and grows about its seat
    const g = new THREE.Group(), inner = new THREE.Group(); inner.position.copy(H.seat).negate(); g.add(inner); root.add(g); root.userData.hatGroup = g; hatPose(root, d);
    const mesh = new THREE.Mesh(H.g, hatMat(d, own)); mesh.name = 'hat'; mesh.castShadow = true; mesh.frustumCulled = false; inner.add(mesh); own.tris += H.tris;
    // charms pinned on the crown: a ray from outside at that angle and height, onto the crown's surface
    const C = H.crown, cz = (C.min.z + C.max.z) / 2, ray = new THREE.Raycaster(), probe = new THREE.Mesh(H.g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), reg = H.g.attributes.aReg, info = HAT_INFO[d.kind];
    for (const e0 of d.charms) {
      const e = Object.assign({}, e0, { size: e0.size * KH }), a = e.at * 1.75, y = lerp(C.min.y + (C.max.y - C.min.y) * 0.12, C.max.y - (C.max.y - C.min.y) * 0.18, e.up), dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      ray.set(new THREE.Vector3(0, y, cz).addScaledVector(dir, 90), dir.clone().negate()); ray.far = 200;
      const hit = ray.intersectObject(probe, false).find(h => !reg.getX(h.face.a) && !(info.brimBelow != null && h.point.y < info.brimBelow + 0.5)); if (!hit) continue;
      const n = hit.face.normal.clone(); if (n.dot(dir) < 0) n.negate(); n.y *= 0.6; n.normalize();
      const el = makeEl(e, own, true), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(n, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
      el.quaternion.copy(q); el.position.copy(hit.point).addScaledVector(n, e.k === 'charm' ? 0.18 : 0.12 + elH(e) * 0.25); inner.add(el);
    }
    probe.material.dispose();
    return { root, d, info: { tris: Math.round(own.tris) }, frame: 'head', dispose() { for (const g2 of own.geos) g2.dispose(); for (const m of own.mats) m.dispose(); } };
  }

  const build = (dept, d, ctx, o) => isCloth(dept) ? buildCloth(dept, d, ctx || CTX) : dept === 'hats' ? buildHat(d, ctx || CTX) : dept === 'back' ? buildBack(d, ctx || CTX) : dept === 'sound' ? buildSound(d, ctx || CTX) : dept === 'sandals' ? buildSandals(d, ctx || CTX) : dept === 'purses' ? buildPurse(d, ctx || CTX) : dept === 'earrings' ? buildEarrings(d, ctx || CTX, o) : buildNecklace(d, ctx || CTX, o);
  function init(ctx) { CTX = ctx; ENV = ctx.env || null; for (const m of mats.values()) { m.envMap = ENV; m.needsUpdate = true; } }
  const lengthCm = d => { try { return Math.round(buildNecklaceLength(d)); } catch (e) { return 0; } };
  function buildNecklaceLength(d) { const F = bodyField(CTX.sandy), pts = necklacePath(d, F); return new THREE.CatmullRomCurve3(pts, true, 'centripetal').getLength(); }

  window.GrugJewelry = {
    ready, init, build, validate: (dp, s, b) => isCloth(dp) ? validateC(dp, s, b) : dp === 'hats' ? validateH(s, b) : dp === 'back' ? validateB(s, b) : dp === 'sound' ? validateSnd(s, b) : dp === 'sandals' ? validateS(s, b) : dp === 'purses' ? validateP(s, b) : validate(dp, s, b), random: (dp, seed, o) => isCloth(dp) ? randomC(dp, seed, o) : dp === 'hats' ? randomH(seed, o) : dp === 'back' ? randomB(seed, o) : dp === 'sound' ? randomSnd(seed, o) : dp === 'sandals' ? randomS(seed, o) : dp === 'purses' ? randomP(seed, o) : random(dp, seed, o), nameFor: (dp, d, s) => isCloth(dp) ? nameC(dp, d, s) : dp === 'hats' ? nameH(d, s) : dp === 'back' ? nameB(d, s) : dp === 'sound' ? nameSnd(d, s) : dp === 'sandals' ? nameS(d, s) : dp === 'purses' ? nameP(d, s) : nameFor(dp, d, s), tagsFor: (dp, d) => isCloth(dp) ? tagsC(dp, d) : dp === 'hats' ? tagsH(d) : dp === 'back' ? tagsB(d) : dp === 'sound' ? tagsSnd(d) : dp === 'sandals' ? tagsS(d) : dp === 'purses' ? tagsP(d) : tagsFor(dp, d), families: (dp, d) => isCloth(dp) ? familiesC(dp, d) : dp === 'hats' ? familiesH(d) : dp === 'back' ? familiesB(d) : dp === 'sound' ? familiesSnd(d) : dp === 'sandals' ? familiesS(d) : dp === 'purses' ? familiesP(d) : families(dp, d), describe: (dp, d) => isCloth(dp) ? describeC(dp, d) : dp === 'hats' ? describeH(d) : dp === 'back' ? describeB(d) : dp === 'sound' ? describeSnd(d) : dp === 'sandals' ? describeS(d) : dp === 'purses' ? describeP(d) : describe(dp, d), kindOf: (dp, d) => isCloth(dp) ? (CLOTH_BY[d.part] || {}).sub : dp === 'hats' ? d.kind : dp === 'back' ? d.kind : dp === 'sound' ? d.kind : dp === 'sandals' ? d.style : dp === 'purses' ? d.shape : kindOf(dp, d), HAT_KINDS, HAT_LABEL, HAT_INFO, HAT_N, HAT_POSE, hatPose, hasHats, BACK_KINDS, BACK_LABEL, BK_LIM, SW, swordPart, hasWrap, hasGem, CLOTHES, CLOTH_BY, CLOTH_LABEL, CLOTH_DEPTS, CLOTH_DEPT_LABEL, CLOTH_SLOT_OF, CLOTH_SUBS, CLOTH_SUB_LABEL, isCloth, CLOTH_PIC, clothMeshes, clothSync, clothPaint, clothInit, clothData, prep, SOUND_KINDS, SOUND_LABEL, CUPS, CUP_LABEL, TOPPERS, TOPPER_LABEL, YOKES, BUDS, BUD_LABEL, SND_LIM, EAR_DEPTH, soundFit, STYLES, STYLE_LABEL, HEELS, HEEL_LABEL, SAN_LIM, SAN_N, sandalFit, tiltFeet, PAT, PAT_N, PAT_K, BAG_SHAPES, BAG_LABEL, PATTERNS, PATTERN_LABEL, STRAPS, STRAP_LABEL, CLOSURES, CLOSURE_LABEL, BAG_LIM, PURSE_N, lengthCm, depthOf, lenClass, lenLabel, brandFor, famOfHex, isPastel, toPastel, bodyField, earInfo,
    DRESS_Y, DEF: dept => DEF[dept](), EL, SHAPES, SHAPE_LABEL, THREAD_SHAPES, FINISHES, CHARMS, CHARM_BY, THEME_LABEL, THEMES, MOUNTS, LINKS, PAIRS, CORDS, KIND_LABEL, BRANDS, BRAND_LABEL, LIMITS, D_MAX,
    PINKS, PASTEL_OTHER, PASTEL_ACC, PASTEL_METALS, METALS, colourName, charmTexture, geoFor, elH, elName, KIMI_CHARMS
  };
})();
