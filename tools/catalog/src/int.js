  /* ---------------------------------------------------------------- jewelry: earrings, necklaces, purses, sandals and sound (GrugJewelry), and the KIMILAND brand */
  const KIMI_FLAV = ['Kimi', 'Cutie', 'Sweetie', 'Dreamy', 'Sugar', 'Fluffy', 'Cloud', 'Candy', 'Fairy', 'Tiny'];
  const brandBy = b => (b === 'kimiland' ? 'KIMILAND' : 'Grug Digital');
  // players who made things: names from the site's own name lists (assets/grug.js NAMES: one word from each list, an optional number)
  const NAME_ADJ = ['Spicy', 'Sleepy', 'Mighty', 'Chill', 'Brave', 'Sunny', 'Turbo', 'Lucky', 'Cozy', 'Crunchy', 'Zesty', 'Golden', 'Sneaky', 'Jolly', 'Frosty', 'Rowdy', 'Happy', 'Speedy', 'Fuzzy', 'Bouncy', 'Clever', 'Breezy', 'Snappy', 'Cheery', 'Toasty', 'Zippy', 'Witty', 'Sparkly', 'Mellow', 'Peppy', 'Plucky', 'Swift'];
  const NAME_NOUN = ['Kolache', 'Boba', 'Taco', 'Donut', 'Sushi', 'Latte', 'Cupcake', 'Dumpling', 'Pearl', 'Churro', 'Biscuit', 'Mango', 'Waffle', 'Pickle', 'Noodle', 'Pecan', 'Panda', 'Otter', 'Dino', 'Falcon', 'Koala', 'Penguin', 'Tiger', 'Turtle', 'Pretzel', 'Muffin', 'Bagel', 'Lychee', 'Matcha', 'Mochi', 'Ramen', 'Pudding'];
  const makerOf = id => { const r = rng('maker:' + id); if (!r.chance(0.35)) return null; const n = r.pick(NAME_ADJ) + ' ' + r.pick(NAME_NOUN); return r.chance(0.4) ? n + ' ' + r.i(1, 999) : n; };
  // "By" and the maker: Grug Digital's wordmark, KIMILAND's logo, or a player's name
  function byHTML(it, big) {
    if (it.mine) return 'By <b>You</b>';
    if (it.brand === 'kimiland') return `By <img class="blogo-k" src="../../assets/brands/kimiland-logo.png" alt="KIMILAND">${VERIFIED}`;
    if ((it.by || 'Grug Digital') === 'Grug Digital') return `By ${GRUG.logo('wordmark', 'auto', { cls: 'blogo-g' })}${VERIFIED}`;
    return `By <b>${esc(it.by)}</b>`;
  }
  const KIMI_EYE_KEYS = ['frame', 'frame2', 'tint', 'tintB', 'tint2', 'strap', 'strap2', 'gasket', 'logoColor'];
  // KIMILAND's eyewear: every colour is brought to a pastel (and the lenses kept light enough to stay pastel)
  function kimiEye(d) {
    const o = Object.assign({}, d);
    for (const k of KIMI_EYE_KEYS) if (typeof o[k] === 'string' && /^#[0-9a-f]{6}$/i.test(o[k]) && !J.isPastel(o[k])) o[k] = J.toPastel(o[k]);
    o.dark = Math.min(o.dark == null ? 0 : o.dark, 0.5); o.mirror = Math.min(o.mirror || 0, 0.25);
    return o;
  }
  function kimiEyeRandom(d, seed) {
    const r = rng('kimieye:' + seed), pink = r.chance(0.9), main = pink ? r.pick(J.PINKS) : r.pick(Object.values(J.PASTEL_OTHER)), acc = r.pick(J.PASTEL_ACC), o = Object.assign({}, d);
    if (o.finish === 'metal') o.finish = r.pick(['gloss', 'matte']);
    o.frame = main; o.frame2 = acc; if (o.pattern === 'tortoise') o.pattern = 'solid';
    o.tint = pink ? r.pick(['#ffd1e3', '#ffdcea', '#ffc4dc', '#ffe9f2']) : r.pick(Object.values(J.PASTEL_OTHER)); o.tintB = ''; o.tint2 = r.pick(J.PINKS);
    o.strap = main; o.strap2 = '#fffafc'; o.gasket = pink ? r.pick(J.PINKS) : acc; o.logoColor = '#fffafc';
    return kimiEye(o);
  }
  const kimiName = (name, seed) => /^(Kimi|Cutie|Sweetie|Dreamy|Sugar|Fluffy|Cloud|Candy|Fairy|Tiny)\b/.test(name) ? name : rng('kn:' + seed).pick(KIMI_FLAV) + ' ' + name;
  function genEyewear(seed) {
    const brand = J.brandFor(seed, 0.25); let d = GE.random(seed);
    if (brand === 'kimiland') d = GE.validate(kimiEyeRandom(d, seed)).d;
    return { d, brand, name: brand === 'kimiland' ? kimiName(GE.nameFor(d, seed), seed) : GE.nameFor(d, seed) };
  }

  const JKEY = dept => 'grug.jewelry.' + dept + '.v1', JROLLS = 'grug.jewelry.rolls.v1';
  const JDEPT = { earrings: { label: 'Earrings', one: 'earrings', icon: 'diamond', c: 'var(--g-purple)', studio: 'Earrings studio' }, sandals: { label: 'Sandals', one: 'sandals', icon: 'sun', c: 'var(--g-blue)', studio: 'Sandal studio' }, purses: { label: 'Purses', one: 'purse', icon: 'shopping_bag', c: 'var(--g-pink)', studio: 'Purse studio' }, necklaces: { label: 'Necklaces', one: 'necklace', icon: 'flower', c: 'var(--g-orange)', studio: 'Necklace studio' }, sound: { label: 'Sound', one: 'headphones', icon: 'note', c: 'var(--g-teal)', studio: 'Sound studio' }, back: { label: 'Back', one: 'sword', icon: 'sword', c: 'var(--g-red)', studio: 'Sword studio' }, clothing: { label: 'Clothing', one: 'piece of clothing', icon: 'shirt', c: 'var(--g-yellow)', studio: 'Clothing studio' } };
  const JSW = ['#e8344f', '#ff6fa8', '#ffc2d6', '#fff6f2', '#16161a', '#f2801f', '#f5d21f', '#9be338', '#2e9b48', '#14a3a0', '#4fd8e0', '#2b62d9', '#7d3fc4', '#d4af37', '#c8ccd2'];
  const JSW_KIMI = J.PINKS.slice(0, 6).concat(['#fffafc', '#c4e1ff', '#e0d3ff', '#fff2b8', '#c6f3dd', '#ffd8c4']);
  const KIMI_CARD = '#ffc2dc', KIMI_MANN = 'hsl(222, 38%, 62%)';
  const E_ = (id, size, col, o) => J.EL(Object.assign({ k: 'shape', id, size, col: col || '#ff8fc2' }, o || {}));
  const C_ = (id, size, o) => J.EL(Object.assign({ k: 'charm', id, size }, o || {}));
  const JSTART = {
    earrings: [
      ['Pearl studs', { mount: 'stud', metal: '#d4af37', seq: [E_('pearl', 1.2, '#fff6f2')] }],
      ['Gold hoops', { mount: 'hook', link: 'none', metal: '#d4af37', seq: [E_('ring', 2.8, '#d4af37', { finish: 'metal' })] }],
      ['Heart drops', { mount: 'hook', metal: '#d4af37', seq: [E_('bead', 0.7, '#d4af37', { finish: 'metal' }), E_('heart', 1.8, '#e8344f')] }],
      ['Candy cane charms', { mount: 'hook', metal: '#c8ccd2', seq: [E_('pearl', 0.8, '#fff6f2'), C_('candycane', 2.4)] }],
      ['Spooky danglers', { mount: 'hook', metal: '#50555c', gap: 0.5, seq: [E_('star', 1, '#7d3fc4'), C_('bat', 1.9), C_('ghost', 2), C_('pumpkin', 2)] }],
      ['Winter stack', { mount: 'hook', metal: '#c8ccd2', seq: [C_('snowflake', 2.1), E_('gem', 1.2, '#4fd8e0'), C_('christmas-ball', 1.9)] }],
      ['Cupid drops', { mount: 'hook', metal: '#e0a68f', seq: [C_('heart-with-an-arrow', 2.3), E_('bead', 0.8, '#ff6fa8'), C_('rose', 2)] }],
      ['Gingerbread pair', { mount: 'stud', metal: '#d4af37', seq: [C_('gingerbread', 2.3)] }],
      ['KIMILAND bows', { brand: 'kimiland', mount: 'hook', metal: '#ebe7f2', seq: [E_('bow', 1.3, '#ffb7d5'), E_('heart', 1.6, '#ffc4dc'), E_('pearl', 0.9, '#fffafc')] }],
      ['KIMILAND KL', { brand: 'kimiland', mount: 'hook', metal: '#f6cfc9', seq: [C_('kimiland-kl', 2.4), E_('pearl', 0.9, '#fffafc'), E_('heart', 1.4, '#ffd1e3')] }]
    ],
    necklaces: [
      ['Gold choker', { len: 0.02, cord: 'chain', cordCol: '#d4af37', thick: 0.3, items: [E_('heart', 1.5, '#d4af37', { finish: 'metal' })] }],
      ['Pearl strand', { len: 0.24, cord: 'pearls', cordCol: '#fff6f2', thick: 0.55, items: [E_('gem', 1.8, '#4fd8e0', { at: 0 })] }],
      ['Heart pendant', { len: 0.36, cord: 'chain', cordCol: '#d4af37', thick: 0.28, items: [E_('heart', 2.8, '#e8344f')] }],
      ['Charm chain', { len: 0.5, cord: 'chain', cordCol: '#c8ccd2', thick: 0.3, items: [C_('snowflake', 2.1, { at: -0.6 }), C_('christmas-bell', 2.2, { at: -0.2 }), C_('candycane', 2.3, { at: 0.2 }), C_('christmas-ball', 2, { at: 0.6 })] }],
      ['Bell ribbon', { len: 0.03, cord: 'ribbon', cordCol: '#c8232c', thick: 0.9, items: [C_('christmas-bell', 2.4)] }],
      ['Spooky long chain', { len: 0.86, cord: 'chain', cordCol: '#50555c', thick: 0.32, items: [C_('bat', 3.4)] }],
      ['Candy beads', { len: 0.4, cord: 'beads', cordCol: '#ff6fb0', cord2: '#fff36a', alt: true, thick: 0.6, items: [E_('star', 2, '#4fd8e0')] }],
      ['Rose charm', { len: 0.3, cord: 'cord', cordCol: '#16161a', thick: 0.3, items: [C_('rose', 2.8)] }],
      ['Mid-torso lariat', { len: 1, cord: 'chain', cordCol: '#d4af37', thick: 0.3, items: [E_('drop', 2.6, '#9be338')] }],
      ['KIMILAND pearls', { brand: 'kimiland', len: 0.3, cord: 'pearls', cordCol: '#ffd1e3', thick: 0.6, items: [E_('heart', 2.4, '#ffb7d5')] }],
      ['KIMILAND KL choker', { brand: 'kimiland', len: 0.04, cord: 'ribbon', cordCol: '#ffc4dc', thick: 0.9, items: [C_('kimiland-kl', 2.4)] }]
    ],
    sandals: [
      ['Pink ankle straps', { style: 'ankle', soleH: 1.2, heelH: 0, soleCol: '#fff6f2', bedCol: '#ffc2d6', strapCol: '#ff6fa8', strapT: 0.35, strapW: 1.2, charms: [E_('heart', 1.3, '#e8344f', { at: 0.9 })] }],
      ['Gold slides', { style: 'slide', soleH: 1, soleCol: '#16161a', bedCol: '#d4af37', strapCol: '#d4af37', strapW: 3, strapT: 0.4, finish: 'metal', charms: [] }],
      ['Sunset flip-flops', { style: 'thong', soleH: 1.4, soleCol: '#ff8a4c', soleCol2: '#ff6fa8', soleGrad: true, bedCol: '#fff6f2', strapCol: '#ff6fa8', strapCol2: '#f5d21f', strapGrad: true, strapW: 1.1, charms: [] }],
      ['Ocean gladiators', { style: 'gladiator', shaft: 18, soleH: 1, soleCol: '#fff6f2', bedCol: '#fff6f2', strapCol: '#2b62d9', strapCol2: '#4fd8e0', strapGrad: true, strapW: 1.1, strapT: 0.3, charms: [C_('snowflake', 1.5, { at: 0.6 })] }],
      ['Ribbon wedges', { style: 'wrap', shaft: 16, soleH: 1.4, heelH: 5, heelType: 'wedge', soleCol: '#c8ccd2', bedCol: '#fff6f2', strapCol: '#7d3fc4', strapW: 0.9, strapT: 0.25, charms: [] }],
      ['Block heel slingbacks', { style: 'ankle', soleH: 0.8, heelH: 6, heelType: 'block', soleCol: '#e8344f', bedCol: '#fff6f2', strapCol: '#e8344f', strapW: 1.4, charms: [C_('rose', 1.5, { at: 0.8 })] }],
      ['Pumpkin platforms', { style: 'slide', soleH: 3.6, heelH: 0, soleCol: '#16161a', bedCol: '#f2801f', strapCol: '#f2801f', strapW: 3, charms: [C_('pumpkin', 1.6, { at: 0.5 }), C_('bat', 1.4, { at: -0.4 })] }],
      ['KIMILAND pastel slides', { brand: 'kimiland', style: 'slide', soleH: 1.6, soleCol: '#ffc4dc', soleCol2: '#e0d3ff', soleGrad: true, bedCol: '#fffafc', strapCol: '#fffafc', strapW: 3, charms: [E_('heart', 1.3, '#ffb7d5', { at: 0.6 })] }],
      ['Cosy slippers', { style: 'slipper', soleH: 1.6, heelH: 0, soleCol: '#fff6f2', bedCol: '#ffc2d6', strapCol: '#ff8fc2', strapCol2: '#fff6f2', strapGrad: true, strapT: 0.5, strapW: 1.2, finish: 'matte', charms: [E_('heart', 1.4, '#e8344f', { at: 0.1 })] }],
      ['KIMILAND KL wraps', { brand: 'kimiland', style: 'wrap', shaft: 14, soleH: 1.4, heelH: 3, soleCol: '#fffafc', bedCol: '#ffc4dc', strapCol: '#ffb7d5', strapCol2: '#fffafc', strapGrad: true, strapW: 0.9, strapT: 0.25, charms: [C_('kimiland-kl', 1.6, { at: 0.8 })] }]
    ],
    purses: [
      ['Pink satchel', { shape: 'satchel', body: '#ff8fc2', body2: '#fff6f2', closure: 'clasp', strap: 'chain', hw: '#d4af37', strapCol: '#d4af37', charms: [E_('heart', 1.5, '#e8344f', { at: 0.6 })] }],
      ['Black tote', { shape: 'tote', w: 20, h: 16, depth: 7, body: '#2a2a31', body2: '#fff6f2', flap: false, closure: 'none', handle: true, strap: 'strap', strapCol: '#16161a', hw: '#c8ccd2', charms: [] }],
      ['Pumpkin bucket', { shape: 'bucket', body: '#f2801f', body2: '#2e9b48', closure: 'star', strap: 'cord', strapCol: '#2e9b48', hw: '#2e9b48', charms: [C_('pumpkin', 1.9, { at: 0.5, drop: 2.5 }), C_('bat', 1.6, { at: -0.5, drop: 4 })] }],
      ['Candy stripe clutch', { shape: 'clutch', pattern: 'stripes', body: '#e8344f', body2: '#fff6f2', flap: true, closure: 'bow', strap: 'wide', strapCol: '#e8344f', hw: '#c8ccd2', charms: [C_('candycane', 2, { at: 0.6 })] }],
      ['Pearl round', { shape: 'round', w: 15, depth: 5, body: '#fff6f2', pattern: 'quilt', closure: 'flower', strap: 'pearls', strapCol: '#fff6f2', hw: '#d4af37', charms: [E_('star', 1.3, '#f5d21f', { at: 0 })] }],
      ['Sweetheart bag', { shape: 'heart', w: 15, depth: 5, body: '#e8344f', body2: '#ffc2d6', closure: 'none', strap: 'chain', hw: '#d4af37', strapCol: '#d4af37', charms: [C_('rose', 2, { at: 0.2 })] }],
      ['Snow day', { shape: 'satchel', body: '#4fd8e0', body2: '#fff6f2', pattern: 'dots', closure: 'star', strap: 'beads', strapCol: '#2b62d9', hw: '#c8ccd2', charms: [C_('snowflake', 2, { at: -0.5, drop: 3 }), C_('christmas-ball', 1.8, { at: 0.5, drop: 2 })] }],
      ['KIMILAND gingham', { brand: 'kimiland', shape: 'satchel', pattern: 'gingham', body: '#ffb7d5', body2: '#fffafc', closure: 'bow', strap: 'chain', hw: '#f6cfc9', strapCol: '#f6cfc9', charms: [E_('heart', 1.4, '#ffc4dc', { at: 0.5 }), E_('pearl', 1, '#fffafc', { at: -0.4, drop: 3 })] }],
      ['KIMILAND KL tote', { brand: 'kimiland', shape: 'tote', pattern: 'solid', body: '#ffc4dc', body2: '#fffafc', flap: false, closure: 'none', handle: true, strap: 'cord', strapCol: '#fffafc', hw: '#f6cfc9', charms: [C_('kimiland-kl', 2.2, { at: 0.4, drop: 2 })] }]
    ],
    back: [
      ['Steel greatsword', { kind: 'back1', blade: 3, guard: 2, grip: 0, pommel: 1, len: 108, bladeCol: '#c8ccd2', edgeCol: '#f4f6f8', hiltCol: '#50555c', gripCol: '#3a2a20', strap: true, strapCol: '#6b4428', strapW: 3.4, finish: 'metal', charms: [] }],
      ['Twin gold blades', { kind: 'back2', blade: 8, guard: 6, grip: 4, pommel: 10, len: 82, bladeCol: '#e8ebef', edgeCol: '#f4f6f8', hiltCol: '#d4af37', gripCol: '#8a1c2b', gemCol: '#e8344f', strap: true, strapCol: '#16161a', strapW: 2.6, finish: 'metal', charms: [] }],
      ['Sheathed sabre', { kind: 'hip', blade: 12, guard: 9, grip: 7, pommel: 20, len: 78, sheath: true, sheathCol: '#16161a', sheathPat: 40, sheathPatCol: '#d4af37', hiltCol: '#d4af37', gripCol: '#16161a', strap: true, strapCol: '#16161a', strapW: 3.2, finish: 'metal', charms: [] }],
      ['Shadow blade', { kind: 'back1', blade: 15, guard: 14, grip: 10, pommel: 30, len: 96, bladeCol: '#26272b', edgeCol: '#7d3fc4', hiltCol: '#50555c', gripCol: '#16161a', gemCol: '#7d3fc4', strap: true, strapCol: '#16161a', strapW: 2.8, finish: 'metal', charms: [] }],
      ['KIMILAND heart blade', { brand: 'kimiland', kind: 'back1', blade: 6, guard: 11, grip: 3, pommel: 5, len: 84, bladeCol: '#fffafc', edgeCol: '#ffd1e3', hiltCol: '#f6cfc9', gripCol: '#ffc4dc', gemCol: '#ffb7d5', strap: true, strapCol: '#ffc4dc', strapPat: 12, strapPatCol: '#fffafc', strapW: 3, finish: 'gloss', charms: [] }]
    ],
    clothing: [
      ['White tee', { slot: 'top', part: 'gen_tshirt', col: '#f4f4f2', charms: [] }],
      ['Denim shorts', { slot: 'legs', part: 'mh_cortu_jeans_shorts', col: '#4a6fa5', charms: [] }],
      ['Gingham halter dress', { slot: 'top', part: 'mh_toigo_halter_dress_knee_length', col: '#ff8fc2', pat: 2, patCol: '#fff6f2', tiles: 14, charms: [] }],
      ['Tiered skirt', { slot: 'legs', part: 'mh_toigo_tiered_skirt', col: '#f5d21f', charms: [] }],
      ['Black hero boots', { slot: 'feet', part: 'mh_culturalibre_hero_boots_1', col: '#16161a', charms: [] }],
      ['KIMILAND long-sleeve', { brand: 'kimiland', slot: 'top', part: 'gen_longsleeve', col: '#ffc4dc', pat: 30, patCol: '#fffafc', tiles: 16, charms: [] }]
    ],
    sound: [
      ['Studio headphones', { kind: 'over', cup: 'round', cupR: 6.6, cupD: 3.4, padT: 1.8, cupCol: '#16161a', cupCol2: '#3a3b40', padCol: '#2a2a31', bandCol: '#16161a', hw: '#c8ccd2', yoke: 'fork', bandPad: true, wired: true, coil: true, cordCol: '#16161a', cordLen: 0.55, finish: 'matte', charms: [] }],
      ['Pink cat ears', { kind: 'over', cup: 'round', cupR: 6, cupCol: '#ff8fc2', cupCol2: '#fff6f2', padCol: '#fff6f2', bandCol: '#ff8fc2', topCol: '#ff8fc2', top: 'cat', glow: true, glowCol: '#ff6fb0', bandPad: true, charms: [] }],
      ['Gaming headset', { kind: 'over', cup: 'square', cupR: 6.2, cupCol: '#16161a', cupCol2: '#2a2a31', cupPat: 40, cupPatCol: '#9be338', padCol: '#2a2a31', bandCol: '#16161a', hw: '#50555c', mic: true, glow: true, glowCol: '#9be338', yoke: 'post', bandPad: true, wired: true, cordCol: '#16161a', cordLen: 0.7, charms: [] }],
      ['Snow day muffs', { kind: 'muffs', cupR: 6.4, cupCol: '#f4f4f2', bandCol: '#c8ccd2', bandW: 1.4, bandT: 0.6, charms: [] }],
      ['Candy cane muffs', { kind: 'muffs', cupR: 6, cupCol: '#c8232c', cupPat: 12, cupPatCol: '#fff6f2', bandCol: '#f4f4f2', bandW: 1.2, bandT: 0.5, top: 'bow', topCol: '#1f8a4c', charms: [] }],
      ['White earbuds', { kind: 'buds', bud: 'stem', budSize: 3.2, cupCol: '#f4f4f2', cupCol2: '#c8ccd2', padCol: '#f4f4f2', finish: 'gloss', charms: [] }],
      ['Wired earbuds', { kind: 'buds', bud: 'round', budSize: 3, cupCol: '#16161a', cupCol2: '#3a3b40', padCol: '#2a2a31', wired: true, remote: true, cordCol: '#16161a', cordLen: 0.5, charms: [] }],
      ['Spooky headphones', { kind: 'over', cup: 'cloud', cupR: 6.4, cupCol: '#f2801f', cupCol2: '#16161a', cupPat: 90, cupPatCol: '#7d3fc4', padCol: '#16161a', bandCol: '#16161a', top: 'devil', topCol: '#7d3fc4', hw: '#50555c', charms: [] }],
      ['Sweetheart cans', { kind: 'over', cup: 'heart', cupR: 6.2, cupCol: '#e8344f', cupCol2: '#ffc2d6', padCol: '#fff6f2', bandCol: '#fff6f2', top: 'bow', topCol: '#e8344f', hw: '#d4af37', yoke: 'post', charms: [] }],
      ['KIMILAND bunny muffs', { brand: 'kimiland', kind: 'muffs', cupR: 6.6, cupCol: '#ffd1e3', bandCol: '#fffafc', top: 'bunny', topCol: '#ffd1e3', padCol: '#fffafc', bandW: 1.4, charms: [] }],
      ['KIMILAND cloud cans', { brand: 'kimiland', kind: 'over', cup: 'cloud', cupR: 6.4, cupCol: '#c4e1ff', cupCol2: '#fffafc', padCol: '#fffafc', bandCol: '#fffafc', top: 'bear', topCol: '#c4e1ff', glow: true, glowCol: '#ffb7d5', hw: '#ebe7f2', bandPad: true, charms: [] }],
      ['KIMILAND buds', { brand: 'kimiland', kind: 'buds', bud: 'round', budSize: 3.2, cupCol: '#ffc4dc', cupCol2: '#fffafc', padCol: '#fffafc', wired: true, cordCol: '#fffafc', cordLen: 0.4, hw: '#f6cfc9', charms: [] }]
    ]
  };

  const JM = {
    on: false, dept: null, st: null, hist: { stack: [], i: -1 }, tab: 'pieces', saveT: 0, built: null, q: 0, notes: [], orig: null,
    isJ: it => !!it && (it.dept === 'earrings' || it.dept === 'necklaces' || it.dept === 'purses' || it.dept === 'sandals' || it.dept === 'sound' || it.dept === 'back' || it.dept === 'clothing'),
    list() { return this.dept === 'earrings' ? this.st.d.seq : this.dept === 'purses' || this.dept === 'sandals' || this.dept === 'sound' || this.dept === 'back' || this.dept === 'clothing' ? this.st.d.charms : this.st.d.items; },
    // a catalog item from a design
    item(dept, id, seed, d, o) { o = o || {}; const v = J.validate(dept, d, d.brand).d; return Object.assign({ id, dept, seed, d: v, brand: v.brand, name: o.name || J.nameFor(dept, v, seed), kind: J.kindOf(dept, v), by: o.by || brandBy(v.brand), order: 0, stamp: 0, gen: true }, o, { d: v }); },
    gen(dept, seed) { const id = { earrings: 'ge:', necklaces: 'gn:', purses: 'gp:', sandals: 'gs:', sound: 'ga:', back: 'gb:', clothing: 'gc:' }[dept] + seed; if (genCache.has(id)) return genCache.get(id); const d = J.random(dept, seed), mk = d.brand === 'grug' ? makerOf(id) : null, it = this.item(dept, id, seed, d, mk ? { by: mk, brand: 'players' } : undefined); genCache.set(id, it); return it; },
    byId(id) { const m = /^g([enpsabc]):(.*)$/.exec(id); return m ? this.gen({ e: 'earrings', n: 'necklaces', p: 'purses', s: 'sandals', a: 'sound', b: 'back', c: 'clothing' }[m[1]], m[2]) : null; },
    fromFav(f) { return this.item(f.dept, f.id, f.seed, f.d, { name: f.name, by: f.by, order: 100000 - (f.when || 0) / 1e9, favOnly: true, gen: /^g/.test(f.id), mine: f.id.startsWith('m:') }); },
    fromMine(m, i) { return this.item(m.dept, 'm:' + m.id, m.seed || m.id, m.d, { name: m.name, by: 'You', order: -1000 + i, stamp: m.when || 0, mine: true, gen: false, saved: m }); },
    text(it) { const list = it.d.seq || it.d.items || it.d.charms; return [it.name, it.dept, JDEPT[it.dept].one].concat(J.tagsFor(it.dept, it.d), list.map(J.elName)).concat(it.brand === 'kimiland' ? ['pastel', 'cute'] : []); },
    families(it) { return J.families(it.dept, it.d); },
    specRows(it) {
      const d = it.d, dept = it.dept, rows = [], kimi = d.brand === 'kimiland', list = d.seq || d.items || d.charms, sw = c => swatch(c);
      rows.push(['Type', dept === 'back' ? J.BACK_LABEL[d.kind] : dept === 'clothing' ? esc(J.CLOTH_LABEL[d.part]) + (J.isDress(d) ? ' (dress)' : '') : dept === 'sound' ? J.SOUND_LABEL[d.kind] + (d.kind === 'buds' ? ' (' + J.BUD_LABEL[d.bud].toLowerCase() + ')' : '') : dept === 'sandals' ? J.STYLE_LABEL[d.style] + ' sandals' : dept === 'purses' ? J.BAG_LABEL[d.shape] + ' purse' : dept === 'earrings' ? J.KIND_LABEL[J.kindOf(dept, d)] + ' earrings' : J.lenClass(d).label + ' necklace']);
      rows.push(['Brand', esc(it.brand === 'players' ? 'Made by a player' : brandBy(d.brand))]);
      if (dept === 'earrings') { rows.push(['Mount', d.mount === 'stud' ? 'Stud post' : 'Hook']); if (d.link !== 'none' || d.mount === 'hook') rows.push(['Metal', sw(d.metal) + esc(J.colourName(d.metal, kimi))]); rows.push(['Pair', d.pair === 'mismatch' ? 'Mismatched' : 'Matching']); }
      else if (dept === 'necklaces') { rows.push(['Length', J.lenLabel(d.len) + (JM.cm(d) ? ' · ' + JM.cm(d) + ' cm round' : '')]); rows.push(['Cord', { chain: 'Chain', cord: 'Cord', ribbon: 'Ribbon', beads: 'Beads', pearls: 'Pearls' }[d.cord] + ' · ' + sw(d.cordCol) + esc(J.colourName(d.cordCol, kimi))]); }
      if (dept === 'sandals') { rows.push(['Sole', d.soleH.toFixed(1) + ' cm' + (d.heelH >= 1 ? ' + ' + d.heelH.toFixed(1) + ' cm ' + J.HEEL_LABEL[d.heelType].toLowerCase() + ' heel' : '')]); rows.push(['Straps', sw(d.strapCol) + esc(J.colourName(d.strapCol, kimi)) + (d.strapGrad ? ' fading to ' + esc(J.colourName(d.strapCol2, kimi)) : '') + ' · ' + d.strapT.toFixed(2) + ' cm thick']); rows.push(['Sole colour', sw(d.soleCol) + esc(J.colourName(d.soleCol, kimi)) + (d.soleGrad ? ' fading to ' + esc(J.colourName(d.soleCol2, kimi)) : '')]); }
      if (dept === 'purses') { rows.push(['Strap', J.STRAP_LABEL[d.strap] + ' · ' + sw(d.strapCol) + esc(J.colourName(d.strapCol, kimi))]); rows.push(['Bag', sw(d.body) + esc(J.colourName(d.body, kimi)) + (d.pattern === 'solid' ? '' : ' · ' + J.PATTERN_LABEL[d.pattern].toLowerCase())]); rows.push(['Closure', J.CLOSURE_LABEL[d.closure] + (d.handle ? ' · top handle' : '')]); rows.push(['Size', Math.round(d.w) + ' × ' + Math.round(d.h) + ' cm']); }
      if (dept === 'sound') {
        const top = d.kind === 'buds' ? 'none' : d.top, extras = [];
        if (d.kind === 'over') { rows.push(['Cups', J.CUP_LABEL[d.cup] + ' · ' + sw(d.cupCol) + esc(J.colourName(d.cupCol, kimi)) + (d.cupCol2 !== d.cupCol ? ' and ' + sw(d.cupCol2) + esc(J.colourName(d.cupCol2, kimi)) : '') + (d.cupPat >= 0 ? ' · print' : '')]); rows.push(['Cushions', sw(d.padCol) + esc(J.colourName(d.padCol, kimi))]); }
        else if (d.kind === 'muffs') rows.push(['Muffs', sw(d.cupCol) + esc(J.colourName(d.cupCol, kimi)) + ' fluff' + (d.cupPat >= 0 ? ' · print' : '')]);
        else rows.push(['Buds', sw(d.cupCol) + esc(J.colourName(d.cupCol, kimi)) + ' · ' + d.budSize.toFixed(1) + ' cm']);
        if (d.kind !== 'buds') rows.push(['Band', sw(d.bandCol) + esc(J.colourName(d.bandCol, kimi)) + (top !== 'none' ? ' · ' + esc(J.TOPPER_LABEL[top].toLowerCase()) : '')]);
        if (d.kind !== 'muffs') rows.push(['Cord', d.wired ? (d.kind === 'over' && d.coil ? 'Coiled' : d.kind === 'buds' ? 'Y cable' : 'Straight') + ' · ' + sw(d.cordCol) + esc(J.colourName(d.cordCol, kimi)) + ' · plug at ' + (d.cordLen < 0.34 ? 'her chest' : d.cordLen < 0.67 ? 'her waist' : 'her hip') + (d.kind === 'buds' && d.remote ? ' · inline remote' : '') : 'Wireless']);
        if (d.kind === 'over' && d.mic) extras.push('boom mic'); if (d.kind === 'over' && d.glow) extras.push(sw(d.glowCol) + 'glow ring'); if (d.kind === 'over' && d.bandPad) extras.push('band cushion'); if (extras.length) rows.push(['Extras', extras.join(' · ')]);
      }
      if (dept === 'back') {
        rows.push(['Length', Math.round(d.len) + ' cm' + (d.kind === 'back2' ? ', each' : '')]);
        rows.push([d.sheath ? 'Scabbard' : 'Blade', d.sheath ? sw(d.sheathCol) + esc(J.colourName(d.sheathCol, kimi)) + (d.sheathPat >= 0 ? ' · print' : '') : sw(d.bladeCol) + esc(J.colourName(d.bladeCol, kimi)) + ' · ' + sw(d.edgeCol) + 'edge' + (d.bladePat >= 0 ? ' · etched' : '')]);
        rows.push(['Hilt', sw(d.hiltCol) + esc(J.colourName(d.hiltCol, kimi)) + ' · ' + sw(d.gripCol) + 'grip' + (J.hasGem(d) ? ' · ' + sw(d.gemCol) + 'gem' : '')]);
        rows.push([d.kind === 'hip' ? 'Belt' : 'Strap', d.strap ? sw(d.strapCol) + esc(J.colourName(d.strapCol, kimi)) + ' · ' + d.strapW.toFixed(1) + ' cm' : 'None']);
        rows.push(['Parts', 'Modular Sword Kit by MilkAndBanana (CC0)']);
      }
      if (dept === 'clothing') { rows.push(['Colour', sw(d.col) + esc(J.colourName(d.col, kimi))]); rows.push(['Print', d.pat >= 0 ? sw(d.patCol) + 'Pattern ' + (d.pat + 1) : 'None']); rows.push(['Worn on', esc(J.CLOTH_SLOT_LABEL[d.slot])]); }
      if (dept !== 'sound' && dept !== 'back' && dept !== 'clothing') rows.push([dept === 'earrings' ? 'Sequence' : dept === 'purses' ? 'Keychains' : dept === 'sandals' ? 'Strap charms' : 'Charms', list.length ? list.map(e => esc(J.elName(e))).join(', ') : 'None']);
      if (kimi) rows.push(['Colours', 'KIMILAND pastels']);
      return rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
    },
    cm(d) { try { return d.cord ? Math.round(J.lengthCm(d)) : 0; } catch (e) { return 0; } },
    necks: new Set(),
    mountItem(it) { const b = J.build(it.dept, it.d); const parent = b.frame === 'head' ? headGroup : scene; parent.add(b.root); b.root.userData.catalogItem = true; if (b.frame !== 'head') this.necks.add(b.root); this.syncDress(); return b; },
    unmount(b) { if (!b) return; if (b.root.parent) b.root.parent.remove(b.root); this.necks.delete(b.root); b.dispose(); this.syncDress(); },
    // the dress's ruffle is put away while any necklace is on her
    syncDress() { const c = sandy.__cut; if (!c) return; if (c.__c0 == null) c.__c0 = c.constant; const on = Array.from(this.necks).some(r => r.userData.jewel && r.userData.jewel.dept === 'sandals'), whole = Array.from(this.necks).some(r => r.userData.jewel && (r.userData.jewel.dept === 'clothing' || r.userData.jewel.dept === 'back')); c.constant = whole ? 1e5 : on ? 30 : c.__c0; (sandy.n3.sandals || []).forEach(sd => { if (sd && sd.group) sd.group.visible = !on; }); const sr = Array.from(this.necks).filter(r => r.userData.jewel && r.userData.jewel.dept === 'sandals').pop(); if (J.tiltFeet) J.tiltFeet(sandy, sr ? sr.userData.tilt || 0 : 0, !!(sr && sr.userData.noToes)); },
    // what the camera frames: the pieces themselves with some room
    frameBox(root, it) { sandy.object3d.updateMatrixWorld(true); if (it.dept === 'clothing') { const b = new THREE.Box3(); for (const m of root.userData.meshes ? root.userData.meshes() : []) b.union(new THREE.Box3().setFromObject(m)); if (b.isEmpty()) b.setFromCenterAndSize(new THREE.Vector3(0, 110, 0), new THREE.Vector3(40, 60, 30)); return b.expandByVector(new THREE.Vector3(4, 4, 4)); } if (it.dept === 'back') return new THREE.Box3().setFromObject(root).expandByVector(new THREE.Vector3(3, 3, 3)); const near = it.dept === 'earrings' ? root.children[0] && root.children[0].children[0] : it.dept === 'sound' ? (it.d.kind === 'buds' ? root.getObjectByName('soundL') : root.getObjectByName('soundHead')) : null; const box = new THREE.Box3().setFromObject(near || root); box.expandByVector(it.dept === 'earrings' ? new THREE.Vector3(3, 2.5, 4) : it.dept === 'purses' ? new THREE.Vector3(4, 3, 6) : it.dept === 'sandals' ? new THREE.Vector3(3, 2, 5) : it.dept === 'sound' ? (it.d.kind === 'buds' ? new THREE.Vector3(4, 3.5, 5) : new THREE.Vector3(2, 2, 4)) : new THREE.Vector3(1.5, 1.5, 4)); return box; },
    centre() { const b = this.built; if (!b) return new THREE.Vector3(0, this.dept === 'earrings' || this.dept === 'sound' ? 160 : 135, 0); if (this.dept === 'clothing' || this.dept === 'back') return this.frameBox(b.root, { dept: this.dept, d: this.st.d }).getCenter(new THREE.Vector3()); b.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(this.dept === 'sound' ? b.root.getObjectByName('soundHead') || b.root : b.root).getCenter(new THREE.Vector3()); },

    /* ---- the editor (the eyewear editor's page, switched into this) */
    enter(dept) {
      if (!this.orig) this.orig = { rtabs: $('#rtabs').innerHTML, roll: $('#rollMenu').innerHTML, title: $('#top .brand .ttl').textContent, starters: $('#starterTiles').innerHTML, sec: $$('#left .sec .g-label').map(x => x.textContent) };
      const changed = this.dept !== dept || !this.on; this.on = true; this.dept = dept; $('#editor').dataset.jm = dept;
      if (changed || !this.st) {
        const s = store.get(JKEY(dept), null);
        if (s && s.d) this.st = { d: J.validate(dept, s.d, s.d.brand).d, name: s.name || '', seed: s.seed || 'saved', autoName: s.autoName !== false };
        else { const seed = 'first-' + dept, d = J.random(dept, seed, { brand: 'grug' }); this.st = { d, seed, autoName: true, name: J.nameFor(dept, d, seed) }; }
        if (!this.st.name) this.st.name = J.nameFor(dept, this.st.d, this.st.seed);
        this.hist = { stack: [], i: -1 }; this.tab = 'pieces'; rtab = 'pieces';
      }
      $('#top .brand .ttl').textContent = JDEPT[dept].studio;
      const tabs = dept === 'back' ? [['pieces', 'Sword', 'sword'], ['strap', 'Wear', 'person'], ['look', 'Look', 'palette']] : dept === 'clothing' ? [['pieces', 'Piece', 'shirt'], ['look', 'Look', 'palette']] : dept === 'sound' ? [['pieces', 'Shape', 'note'], ['strap', 'Cord', 'sine_wave'], ['look', 'Look', 'palette']] : dept === 'sandals' ? [['pieces', 'Sole', 'sun'], ['strap', 'Straps', 'circle'], ['charms', 'Charms', 'star'], ['look', 'Look', 'palette']] : dept === 'purses' ? [['pieces', 'Bag', 'shopping_bag'], ['strap', 'Strap', 'circle'], ['charms', 'Charms', 'star'], ['look', 'Look', 'palette']] : dept === 'earrings' ? [['pieces', 'Pieces', 'diamond'], ['look', 'Look', 'palette'], ['fit', 'Fit', 'person']] : [['pieces', 'Cord', 'flower'], ['charms', 'Charms', 'star'], ['look', 'Look', 'palette']];
      $('#rtabs').innerHTML = tabs.map(([k, l, i], n) => `<button data-rt="${k}"${n ? '' : ' class="is-on"'}>${ic(i)} ${l}</button>`).join('');
      $('#rollMenu').innerHTML = [['all', 'dice', 'Everything', 'R'], ['colours', 'palette', 'Just the colours', 'C'], ['shape', JDEPT[dept].icon, 'Just the pieces', 'S']].map(([k, i, l, kk]) => `<button data-roll="${k}">${ic(i)}${l}<span class="g-kbd k">${kk}</span></button>`).join('')
        + (dept === 'back' ? J.BACK_KINDS.map(([k, l]) => [k, 'New: ' + l.toLowerCase()]) : dept === 'clothing' ? J.CLOTH_SLOTS.map(([k, l]) => [k, 'New: ' + l.toLowerCase()]) : dept === 'sound' ? J.SOUND_KINDS.map(([k, l]) => [k, 'New ' + l.toLowerCase()]) : dept === 'sandals' ? J.STYLES.map(([k, l]) => [k, 'New ' + l.toLowerCase()]) : dept === 'purses' ? J.BAG_SHAPES.map(([k, l]) => [k, 'New ' + l.toLowerCase()]) : dept === 'earrings' ? [['studs', 'New studs'], ['drops', 'New drops'], ['danglers', 'New danglers'], ['hoops', 'New hoops']] : [['choker', 'New choker'], ['short', 'New short necklace'], ['medium', 'New medium necklace'], ['long', 'New long necklace']]).map(([k, l]) => `<button data-roll="${k}">${ic(JDEPT[dept].icon)}${l}</button>`).join('')
        + `<button data-roll="kimiland">${ic('heart')}Roll as KIMILAND</button><button data-roll="grug">${ic('star')}Roll as Grug Digital</button>`;
      $$('#left .sec .g-label').forEach((x, i) => { if (i === 0) x.textContent = 'Starters'; });
      $('#bPublish').dataset.gTip = 'Show it in the catalog'; $('#docName').setAttribute('aria-label', 'Name');
      if (worn) worn.root.visible = false; setHair(true);
      this.rebuild(true); this.renderStarters(); this.renderRolls(); renderInspector(); GRUG.hydrate($('#rtabs')); GRUG.hydrate($('#rollMenu')); setView('three'); cam.dist = dept === 'back' ? 230 : dept === 'clothing' ? 200 : dept === 'earrings' ? 78 : dept === 'sound' ? 112 : dept === 'purses' ? 150 : dept === 'sandals' ? 120 : 118; cam.yaw = dept === 'back' ? 2.55 : dept === 'clothing' ? 0.4 : dept === 'earrings' ? 0.9 : dept === 'sound' ? 0.6 : dept === 'purses' ? 0.35 : dept === 'sandals' ? 0.55 : 0.5; if (dept === 'sound') cam.pitch = 0.12; if (dept === 'sandals') cam.pitch = 0.22; if (dept === 'back' || dept === 'clothing') cam.pitch = 0.1; this.commit(true); this.undoBtns();
    },
    leave() {
      if (!this.on) return; this.on = false; this.dept = null; delete $('#editor').dataset.jm; clearTimeout(this.saveT); this.unmount(this.built); this.built = null;
      if (this.orig) { $('#rtabs').innerHTML = this.orig.rtabs; $('#rollMenu').innerHTML = this.orig.roll; $('#top .brand .ttl').textContent = this.orig.title; $('#starterTiles').innerHTML = ''; GRUG.hydrate($('#rtabs')); GRUG.hydrate($('#rollMenu')); }
      rtab = 'frame'; if (worn) worn.root.visible = true; setHair(false); renderStarters(); renderRolls(); renderInspector(); undoBtns();
      $('#reads').innerHTML = ''; $('#fixes').hidden = true; rebuild(true);
    },
    rebuild(now) {
      if (!now) { if (!this.q) this.q = requestAnimationFrame(() => { this.q = 0; this.rebuild(true); }); return; }
      const r = J.validate(this.dept, this.st.d, this.st.d.brand); this.st.d = r.d; this.notes = r.notes;
      this.unmount(this.built); this.built = this.mountItem({ dept: this.dept, d: this.st.d }); if (worn) worn.root.visible = false;
      const kind = J.kindOf(this.dept, this.st.d), k = JDEPT[this.dept], tri = this.built.info.tris.toLocaleString();
      $('#reads').innerHTML = `<span class="ib2" style="--c:${k.c}">${ic(k.icon)}</span><span><b>${this.dept === 'back' ? J.BACK_LABEL[kind] : this.dept === 'clothing' ? J.CLOTH_LABEL[this.st.d.part] : this.dept === 'sound' ? J.SOUND_LABEL[kind] : this.dept === 'sandals' ? J.STYLE_LABEL[kind] + ' sandals' : this.dept === 'purses' ? J.BAG_LABEL[kind] + ' purse' : this.dept === 'earrings' ? J.KIND_LABEL[kind] : J.lenLabel(this.st.d.len)}</b><span>${this.dept === 'necklaces' ? Math.round(this.built.info.lengthCm) + ' cm round · ' : ''}${esc(brandBy(this.st.d.brand))} · ${tri} triangles</span></span>`;
      const fx = $('#fixes'); fx.hidden = !this.notes.length; fx.innerHTML = this.notes.length ? '<b>Adjusted:</b> ' + this.notes.map(esc).join('. ') + '.' : '';
      $('#docName').value = this.st.name;
    },
    set(patch, final) {
      Object.assign(this.st.d, patch); this.st.d = J.validate(this.dept, this.st.d, this.st.d.brand).d;
      if (this.st.autoName && final) this.st.name = J.nameFor(this.dept, this.st.d, this.st.seed);
      this.rebuild(final); if (final) { this.commit(); renderInspector(); }
    },
    setEl(i, patch, final) { Object.assign(this.list()[i], patch); this.set({}, final); },
    snap() { return JSON.stringify({ d: this.st.d, name: this.st.name, seed: this.st.seed, autoName: this.st.autoName }); },
    commit(initial) {
      const j = this.snap(), h = this.hist; if (h.stack[h.i] === j) return;
      h.stack = h.stack.slice(0, h.i + 1); h.stack.push(j); if (h.stack.length > 120) h.stack.shift(); h.i = h.stack.length - 1;
      $('#saved').classList.add('dirty'); clearTimeout(this.saveT); this.saveT = setTimeout(() => this.persist(), initial ? 0 : 350); this.undoBtns();
    },
    persist() { if (!this.on) return; if (store.set(JKEY(this.dept), JSON.parse(this.hist.stack[this.hist.i]))) { $('#saved').classList.remove('dirty'); $('#saved').textContent = 'Saved'; } else $('#saved').textContent = 'Not saved'; },
    undoBtns() { $('#bUndo').disabled = this.hist.i <= 0; $('#bRedo').disabled = this.hist.i >= this.hist.stack.length - 1; },
    restore(j) { const s = JSON.parse(j); this.st = { d: J.validate(this.dept, s.d, s.d.brand).d, name: s.name, seed: s.seed, autoName: s.autoName }; this.rebuild(true); renderInspector(); },
    undo() { const h = this.hist; if (h.i > 0) { h.i--; this.restore(h.stack[h.i]); this.persist(); this.undoBtns(); } },
    redo() { const h = this.hist; if (h.i < h.stack.length - 1) { h.i++; this.restore(h.stack[h.i]); this.persist(); this.undoBtns(); } },
    load(dept, d, o) { o = o || {}; this.dept = dept; const seed = o.seed || 'pair-' + Date.now().toString(36); this.st = { d: J.validate(dept, d, d.brand).d, seed, autoName: o.autoName !== false, name: o.name || '' }; if (!this.st.name) this.st.name = J.nameFor(dept, this.st.d, seed); },
    roll(how) {
      const seed = 'roll-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), opts = { brand: this.st.d.brand };
      if (how === 'colours') { opts.keep = 'shape'; opts.base = this.st.d; } else if (how === 'shape') { opts.keep = 'colours'; opts.base = this.st.d; }
      else if (how === 'kimiland' || how === 'grug') opts.brand = how; else if (how !== 'all') opts.kind = how;
      const d = J.random(this.dept, seed, opts);
      this.st = { d, seed, autoName: true, name: J.nameFor(this.dept, d, seed) }; this.rebuild(true); renderInspector(); this.commit();
      const all = store.get(JROLLS, {}) || {}; all[this.dept] = [{ seed, d, name: this.st.name }].concat(all[this.dept] || []).slice(0, 15); store.set(JROLLS, all); this.renderRolls(); GRUG.toast(this.st.name);
    },
    renderRolls() {
      const box = $('#rollList'); box.innerHTML = ''; const list = (store.get(JROLLS, {}) || {})[this.dept] || [];
      if (!list.length) { box.append(el('div', 'empty', 'Press Randomize and your rolls land here.')); box.style.display = 'block'; return; }
      box.style.display = '';
      for (const r of list) {
        const b = el('button', r.seed === this.st.seed ? 'on' : ''); b.setAttribute('data-g-tip', r.name); b.setAttribute('aria-label', r.name);
        b.onclick = () => { this.load(this.dept, r.d, { seed: r.seed, name: r.name }); this.rebuild(true); renderInspector(); this.commit(); this.renderRolls(); };
        box.append(b); const it = this.item(this.dept, 'jr:' + r.seed, r.seed, r.d, { name: r.name }), cb = u => { b.style.backgroundImage = `url(${u})`; }; cb.alive = () => document.body.contains(b); queueThumb(it, 'worn', cb);
      }
    },
    renderStarters() {
      const box = $('#starterTiles'); box.innerHTML = '';
      JSTART[this.dept].forEach(([label, patch], i) => {
        const d = J.validate(this.dept, Object.assign(J.DEF(this.dept), patch), patch.brand || 'grug').d, seed = 'jstart-' + this.dept + '-' + i, b = el('button', 'tile-b', `<span class="th"></span><span>${esc(label)}</span>`);
        b.onclick = () => { this.load(this.dept, d, { seed, name: label, autoName: false }); this.rebuild(true); renderInspector(); this.commit(); GRUG.toast(label); };
        box.append(b); const th = b.querySelector('.th'), cb = u => { th.style.backgroundImage = `url(${u})`; }; cb.alive = () => true; queueThumb(this.item(this.dept, 'js:' + this.dept + ':' + i, seed, d, { name: label }), 'worn', cb);
      });
    },
    brandChoice(parent) {
      const w = el('div', 'segwrap c2'); for (const [v, l] of J.BRANDS) { const b = el('button', this.st.d.brand === v ? 'on' : '', `<span>${esc(l)}</span>`); b.onclick = () => { this.st.d.brand = v; this.st.d = J.validate(this.dept, this.st.d, v).d; this.set({}, true); }; w.append(b); } parent.append(w);
      if (this.st.d.brand === 'kimiland') parent.append(el('div', 'note', 'KIMILAND pieces are always pastel. Whatever colour you pick is softened to the nearest pastel.'));
    },
    swatches() { return this.st.d.brand === 'kimiland' ? JSW_KIMI : JSW; },
    // a pattern from the pattern pack: a preview, step through them, none, shuffle, and the colour its dark parts take
    patPicker(parent, label, key, colKey, o) {
      o = o || {}; const d = this.st.d, idx = d[key], n = J.PAT_N, baseKey = o.base || { strapPatCol: 'strapCol', solePatCol: 'soleCol', bedPatCol: 'bedCol' }[colKey]; colKey = colKey || o.col; const row = el('div', 'patrow'), pv = document.createElement('canvas'); pv.width = pv.height = 44; pv.className = 'patpv';
      const x = pv.getContext('2d'); if (idx >= 0 && J.PAT.img) { const T = J.PAT.T, ox = (idx % J.PAT.cols) * T, oy = Math.floor(idx / J.PAT.cols) * T, a = new THREE.Color(d[baseKey]), b2 = new THREE.Color(d[colKey]), im = x.createImageData(44, 44); for (let yy = 0; yy < 44; yy++) for (let xx = 0; xx < 44; xx++) { const L = 1 - (1 - J.PAT.lum[(oy + Math.floor(yy * T / 44)) * J.PAT.w + ox + Math.floor(xx * T / 44)] / 255) * J.PAT_K, p = (yy * 44 + xx) * 4; im.data[p] = (a.r * L + b2.r * (1 - L)) * 255; im.data[p + 1] = (a.g * L + b2.g * (1 - L)) * 255; im.data[p + 2] = (a.b * L + b2.b * (1 - L)) * 255; im.data[p + 3] = 255; } x.putImageData(im, 0, 0); } else { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, 44, 44); }
      const name = el('span', 'lb', `${esc(label)}<small>${idx >= 0 ? 'Pattern ' + (idx + 1) + ' of ' + n : 'No pattern'}</small>`);
      const b = (html, title, fn) => { const t = el('button', 'g-btn g-btn--sm g-btn--ghost', html); t.title = title; t.onclick = fn; return t; };
      row.append(pv, name, b('&lsaquo;', 'Previous pattern', () => this.set({ [key]: idx <= 0 ? n - 1 : idx - 1 }, true)), b('&rsaquo;', 'Next pattern', () => this.set({ [key]: (idx + 1) % n }, true)), b(ic('dice'), 'A random pattern', () => this.set({ [key]: Math.floor(Math.random() * n) }, true))); if (!o.noNone) row.append(b(ic('cross'), 'No pattern', () => this.set({ [key]: -1 }, true)));
      parent.append(row); if (idx >= 0 && !o.noNone) this.colour(parent, label + ' pattern colour', d[colKey], (v, f) => this.set({ [colKey]: v }, f));
    },
    colour(parent, label, val, onset) {
      const row = el('div', 'row'); row.append(el('span', 'lb', esc(label))); parent.append(row);
      const c = el('div', 'colrow'), inp = el('input'); inp.type = 'color'; inp.value = val; inp.setAttribute('aria-label', label);
      inp.oninput = () => onset(inp.value, false); inp.onchange = () => onset(inp.value, true); c.append(inp);
      for (const h of this.swatches()) { const b = el('button', 'dot' + (h.toLowerCase() === val.toLowerCase() ? ' on' : '')); b.style.background = h; b.setAttribute('aria-label', J.colourName(h, this.st.d.brand === 'kimiland')); b.setAttribute('data-g-tip', J.colourName(h, this.st.d.brand === 'kimiland')); b.onclick = () => onset(h, true); c.append(b); }
      parent.append(c);
    },
    slider(parent, o) {
      const row = el('div', 'row', `<span class="lb">${esc(o.label)}</span><span class="val">${esc(o.fmt(o.value))}</span>`), r = el('input', 'g-range'); r.type = 'range'; r.min = o.min; r.max = o.max; r.step = o.step || 0.01; r.value = o.value; r.setAttribute('aria-label', o.label);
      r.oninput = () => { row.querySelector('.val').textContent = o.fmt(+r.value); o.on(+r.value, false); }; r.onchange = () => o.on(+r.value, true); row.append(r); if (o.ends) row.append(el('div', 'ends', `<span>${esc(o.ends[0])}</span><span>${esc(o.ends[1])}</span>`)); parent.append(row);
    },
    segs(parent, items, cur, on, cols) { const w = el('div', 'segwrap' + (cols ? ' c' + cols : '')); for (const [v, l] of items) { const b = el('button', cur === v ? 'on' : '', `<span>${esc(l)}</span>`); b.onclick = () => on(v); w.append(b); } parent.append(w); return w; },
    // one piece of the sequence: its picture, what it is, and its dials
    elCard(parent, i) {
      const list = this.list(), e = list[i], dept = this.dept, kimi = this.st.d.brand === 'kimiland', card = el('div', 'jel'), top = el('div', 'jtop');
      const pic = el('span', 'jpic'); if (e.k === 'charm') pic.style.backgroundImage = `url(${CHARM_PIC(e)})`; else pic.innerHTML = `<b style="background:${e.col}"></b>`;
      const sel = el('select', 'g-input'); sel.setAttribute('aria-label', 'What it is');
      sel.innerHTML = `<optgroup label="Shapes">${J.SHAPES.map(([v, l]) => `<option value="s:${v}"${e.k === 'shape' && e.id === v ? ' selected' : ''}>${l}</option>`).join('')}</optgroup>`
        + ['christmas', 'halloween', 'valentines', 'kimiland'].map(t => `<optgroup label="${esc(J.THEME_LABEL[t])} charms">${J.CHARMS.filter(c => c.theme === t).map(c => `<option value="c:${c.id}"${e.k === 'charm' && e.id === c.id ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</optgroup>`).join('');
      sel.onchange = () => { const [k, id] = sel.value.split(':'); const patch = k === 's' ? { k: 'shape', id } : { k: 'charm', id }; if (k === 'c' && dept !== 'earrings') patch.mode = 'hang'; this.setEl(i, patch, true); };
      const acts = el('span', 'jacts'); const mk = (icon, tip, fn, dis) => { const b = el('button', 'g-btn g-btn--ghost g-btn--icon g-btn--sm', ic(icon)); b.setAttribute('aria-label', tip); b.setAttribute('data-g-tip', tip); if (dis) b.disabled = true; b.onclick = fn; acts.append(b); };
      if (dept === 'earrings') { mk('arrow_up', 'Move up', () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; this.set({}, true); }, i === 0); mk('arrow_down_to_line', 'Move down', () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; this.set({}, true); }, i === list.length - 1); }
      mk('plus_in_circle', 'Copy', () => { if (list.length < J.LIMITS[dept].n) { list.splice(i + 1, 0, JSON.parse(JSON.stringify(e))); this.set({}, true); } }, list.length >= J.LIMITS[dept].n);
      const minN = dept === 'purses' || dept === 'sandals' ? 0 : 1; mk('trash_can', 'Remove', () => { if (list.length > minN) { list.splice(i, 1); this.set({}, true); } }, list.length <= minN);
      top.append(pic, sel, acts); card.append(top);
      this.slider(card, { label: 'Size', value: e.size, min: 0.5, max: dept === 'earrings' ? 4 : 5, fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.setEl(i, { size: v }, f) });
      if (e.k === 'shape') { this.colour(card, 'Colour', e.col, (v, f) => this.setEl(i, { col: v }, f)); this.segs(card, J.FINISHES.map(x => [x[0], x[1]]), e.finish, v => this.setEl(i, { finish: v }, true), 3); }
      else {
        const c = J.CHARM_BY[e.id];
        if (!c.noOutline) { const t = el('label', 'row sw2', '<span class="lb">Outlined</span>'), sw = el('input', 'g-switch'); sw.type = 'checkbox'; sw.checked = e.outline; sw.onchange = () => this.setEl(i, { outline: sw.checked }, true); t.append(sw); card.append(t); }
        if (!c.brand) { this.segs(card, [['', 'Original colours'], ['wash', kimi ? 'Pastel wash' : 'Colour wash']], e.tint ? 'wash' : '', v => this.setEl(i, { tint: v === 'wash' ? (J.isPastel(e.col) || !kimi ? e.col : '#ffc4dc') : '' }, true), 2); if (e.tint) this.colour(card, 'Wash colour', e.tint === 'pastel' ? '#ffc4dc' : e.tint, (v, f) => this.setEl(i, { tint: v }, f)); }
      }
      if (dept === 'sandals') this.slider(card, { label: 'Position', value: e.at, min: -1, max: 1, fmt: v => v < -0.05 ? 'Inner side' : v > 0.05 ? 'Outer side' : 'Top', ends: ['Inner side', 'Outer side'], on: (v, f) => this.setEl(i, { at: v }, f) });
      if (dept === 'purses') {
        this.slider(card, { label: 'Position', value: e.at, min: -1, max: 1, fmt: v => v < -0.05 ? 'Left' : v > 0.05 ? 'Right' : 'Middle', ends: ['Left of the bag', 'Right of the bag'], on: (v, f) => this.setEl(i, { at: v }, f) });
        this.slider(card, { label: 'Chain length', value: e.drop, min: 0.4, max: 9, fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.setEl(i, { drop: v }, f) });
      }
      if (dept === 'necklaces') {
        this.slider(card, { label: 'Position', value: e.at, min: -1, max: 1, fmt: v => v < -0.05 ? 'Left' : v > 0.05 ? 'Right' : 'Centre', ends: ['Left side', 'Right side'], on: (v, f) => this.setEl(i, { at: v }, f) });
        if (e.k === 'shape') this.segs(card, [['hang', 'Hangs'], ['thread', 'Threaded on']], e.mode, v => this.setEl(i, { mode: v }, true), 2);
      }
      parent.append(card);
    },
    addGallery(parent) {
      const list = this.list(), full = list.length >= J.LIMITS[this.dept].n, kimi = this.st.d.brand === 'kimiland', g = grp(parent, 'Add');
      g.append(el('div', 'note', full ? 'That\'s the most it holds. Remove one to add another.' : 'Tap a shape or a charm to add it.'));
      const sh = el('div', 'jgrid'); for (const [v, l] of J.SHAPES) { const b = el('button', '', `<span>${esc(l)}</span>`); b.disabled = full; b.onclick = () => { const e = J.EL({ k: 'shape', id: v, size: this.dept === 'earrings' ? 1.2 : 1.8, col: kimi ? '#ffc4dc' : '#ff8fc2', mode: this.dept === 'necklaces' && J.THREAD_SHAPES.includes(v) ? 'thread' : 'hang', at: this.dept === 'necklaces' ? 0.4 : this.dept === 'purses' || this.dept === 'sandals' ? 0.3 : 0, drop: 2.5 }); list.push(e); this.set({}, true); }; sh.append(b); }
      g.append(sh);
      for (const t of ['christmas', 'halloween', 'valentines', 'kimiland']) {
        g.append(el('div', 'g-label', esc(J.THEME_LABEL[t])));
        const gr = el('div', 'jgrid charms'); for (const c of J.CHARMS.filter(x => x.theme === t)) { const b = el('button', '', `<i style="background-image:url(${c.src})"></i>`); b.disabled = full; b.setAttribute('aria-label', c.label); b.setAttribute('data-g-tip', c.label); b.onclick = () => { const e = J.EL({ k: 'charm', id: c.id, size: this.dept === 'earrings' ? 2.1 : 2.6, outline: !c.noOutline, tint: kimi && !c.brand ? '#ffc4dc' : '', mode: 'hang', at: this.dept === 'necklaces' ? -0.4 : this.dept === 'purses' || this.dept === 'sandals' ? -0.3 : 0, drop: 2.5 }); list.push(e); this.set({}, true); }; gr.append(b); }
        g.append(gr);
      }
    },
    inspector() {
      const box = $('#insp'); box.innerHTML = ''; const st = this.st, d = st.d, dept = this.dept, tab = rtab;
      $$('#rtabs button').forEach(b => b.classList.toggle('is-on', b.dataset.rt === tab));
      if (dept === 'back') this.backPanel(box, tab);
      else if (dept === 'clothing') this.clothPanel(box, tab);
      else if (dept === 'sound') this.soundPanel(box, tab);
      else if (dept === 'sandals') this.sandalPanel(box, tab);
      else if (dept === 'purses') this.pursePanel(box, tab);
      else if (dept === 'earrings') {
        if (tab === 'pieces') {
          const g = grp(box, 'Top to bottom'); g.append(el('div', 'note', 'Each pair hangs from her ear, first piece on top. Charms and shapes can mix in any order.'));
          for (let i = 0; i < d.seq.length; i++) this.elCard(g, i); this.addGallery(box);
        } else if (tab === 'look') {
          const g1 = grp(box, 'Brand'); this.brandChoice(g1);
          const g2 = grp(box, 'Metal'); this.colour(g2, 'Hook, post and chain', d.metal, (v, f) => this.set({ metal: v }, f));
          const g3 = grp(box, 'Pair'); this.segs(g3, J.PAIRS, d.pair, v => this.set({ pair: v }, true), 2); g3.append(el('div', 'note', 'Mismatched hangs the sequence upside down on her other ear.'));
        } else {
          const g1 = grp(box, 'Mount'); this.segs(g1, J.MOUNTS, d.mount, v => this.set({ mount: v }, true), 2);
          const g2 = grp(box, 'Between the pieces'); this.segs(g2, J.LINKS, d.link, v => this.set({ link: v }, true), 3); this.slider(g2, { label: 'Spacing', value: d.gap, min: 0.15, max: 3, fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ gap: v }, f) });
          this.nameGroup(box);
        }
      } else {
        if (tab === 'pieces') {
          const g1 = grp(box, 'Length');
          this.slider(g1, { label: 'How low it hangs', value: d.len, min: 0, max: 1, fmt: v => J.lenLabel(v), ends: ['Almost a choker', 'Mid-torso'], on: (v, f) => this.set({ len: v }, f) });
          this.segs(g1, [[0.02, 'Choker'], [0.2, 'Short'], [0.45, 'Medium'], [0.7, 'Long'], [1, 'Mid-torso']], [0.02, 0.2, 0.45, 0.7, 1].reduce((a, b) => Math.abs(b - d.len) < Math.abs(a - d.len) ? b : a), v => this.set({ len: v }, true), 3);
          g1.append(el('div', 'note', 'About ' + this.cm(d) + ' cm all the way round. It follows her neck and chest, so it always rests on her.'));
          const g2 = grp(box, 'Cord'); this.segs(g2, J.CORDS, d.cord, v => this.set({ cord: v }, true), 3);
          this.slider(g2, { label: 'Thickness', value: d.thick, min: d.cord === 'ribbon' ? 0.5 : d.cord === 'beads' || d.cord === 'pearls' ? 0.3 : 0.1, max: d.cord === 'ribbon' ? 1.4 : d.cord === 'beads' || d.cord === 'pearls' ? 0.9 : 0.6, fmt: v => v.toFixed(2) + ' cm', on: (v, f) => this.set({ thick: v }, f) });
          this.colour(g2, d.alt ? 'First colour' : 'Colour', d.cordCol, (v, f) => this.set({ cordCol: v }, f));
          if (d.cord === 'beads') { const t = el('label', 'row sw2', '<span class="lb">Alternate two colours</span>'), sw = el('input', 'g-switch'); sw.type = 'checkbox'; sw.checked = d.alt; sw.onchange = () => this.set({ alt: sw.checked }, true); t.append(sw); g2.append(t); if (d.alt) this.colour(g2, 'Second colour', d.cord2, (v, f) => this.set({ cord2: v }, f)); }
        } else if (tab === 'charms') {
          const g = grp(box, 'Along the front'); g.append(el('div', 'note', 'Shapes and charms hang from the cord or thread on it. Position slides each one left or right of the middle.'));
          for (let i = 0; i < d.items.length; i++) this.elCard(g, i); this.addGallery(box);
        } else { const g1 = grp(box, 'Brand'); this.brandChoice(g1); this.nameGroup(box); }
      }
      GRUG.hydrate(box);
    },
    toggle(parent, label, val, on) { const t = el('label', 'row sw2', `<span class="lb">${esc(label)}</span>`), sw = el('input', 'g-switch'); sw.type = 'checkbox'; sw.checked = !!val; sw.onchange = () => on(sw.checked); t.append(sw); parent.append(t); },
    backPanel(box, tab) {
      const d = this.st.d, L = J.BK_LIM, kimi = d.brand === 'kimiland', n = k => J.SW.by[k].length;
      const stepper = (g, label, key) => { const row = el('div', 'patrow'), b = (html, title, fn) => { const t = el('button', 'g-btn g-btn--sm g-btn--ghost', html); t.title = title; t.onclick = fn; return t; }; row.append(el('span', 'lb', `${esc(label)}<small>${d[key] + 1} of ${n(key)}</small>`), b('&lsaquo;', 'Previous', () => this.set({ [key]: (d[key] + n(key) - 1) % n(key) }, true)), b('&rsaquo;', 'Next', () => this.set({ [key]: (d[key] + 1) % n(key) }, true)), b(ic('dice'), 'A random one', () => this.set({ [key]: Math.floor(Math.random() * n(key)) }, true))); g.append(row); };
      if (tab === 'pieces') {
        const g1 = grp(box, 'The sword'); g1.append(el('div', 'note', 'Every sword is four parts. Step through each, or roll one.'));
        stepper(g1, 'Blade', 'blade'); stepper(g1, 'Guard', 'guard'); stepper(g1, 'Grip', 'grip'); stepper(g1, 'Pommel', 'pommel');
        const g2 = grp(box, 'Size'); this.slider(g2, { label: 'Length', value: d.len, min: L.len[0], max: L.len[1], fmt: v => Math.round(v) + ' cm', ends: ['Short sword', 'Greatsword'], on: (v, f) => this.set({ len: v }, f) });
        this.slider(g2, { label: 'Blade width', value: d.bladeW, min: L.bladeW[0], max: L.bladeW[1], fmt: v => Math.round(v * 100) + '%', ends: ['Slim', 'Broad'], on: (v, f) => this.set({ bladeW: v }, f) });
        const g3 = grp(box, 'Scabbard'); this.toggle(g3, 'In a scabbard', d.sheath, v => this.set({ sheath: v }, true));
        g2.append(el('div', 'note', 'Sword parts: Modular Sword Kit by MilkAndBanana (CC0).'));
      } else if (tab === 'strap') {
        const g1 = grp(box, 'How she wears it'); this.segs(g1, J.BACK_KINDS, d.kind, v => this.set({ kind: v }, true), 3);
        if (d.kind !== 'hip') this.slider(g1, { label: 'Angle', value: d.tilt, min: L.tilt[0], max: L.tilt[1], fmt: v => Math.round(v) + '°', ends: ['Upright', 'Slanted'], on: (v, f) => this.set({ tilt: v }, f) });
        this.slider(g1, { label: 'Height', value: d.drop, min: L.drop[0], max: L.drop[1], fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' cm', ends: ['Lower', 'Higher'], on: (v, f) => this.set({ drop: v }, f) });
        const g2 = grp(box, d.kind === 'hip' ? 'Belt' : 'Strap'); this.toggle(g2, d.kind === 'hip' ? 'A belt round her hips' : d.kind === 'back2' ? 'Two straps across her chest' : 'A strap across her chest', d.strap, v => this.set({ strap: v }, true));
        if (d.strap) { this.slider(g2, { label: 'Width', value: d.strapW, min: L.strapW[0], max: L.strapW[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ strapW: v }, f) }); this.colour(g2, 'Colour', d.strapCol, (v, f) => this.set({ strapCol: v }, f)); this.patPicker(g2, d.kind === 'hip' ? 'Belt' : 'Strap', 'strapPat', 'strapPatCol', { base: 'strapCol' }); }
      } else {
        const g0 = grp(box, 'Finish'); this.segs(g0, J.FINISHES.map(x => [x[0], x[1]]), d.finish, v => this.set({ finish: v }, true), 3);
        if (d.sheath) { const gs = grp(box, 'Scabbard'); this.colour(gs, 'Colour', d.sheathCol, (v, f) => this.set({ sheathCol: v }, f)); this.patPicker(gs, 'Scabbard', 'sheathPat', 'sheathPatCol', { base: 'sheathCol' }); }
        else { const g1 = grp(box, 'Blade'); this.colour(g1, 'Blade', d.bladeCol, (v, f) => this.set({ bladeCol: v }, f)); this.colour(g1, 'Edge', d.edgeCol, (v, f) => this.set({ edgeCol: v }, f)); this.patPicker(g1, 'Blade', 'bladePat', 'bladePatCol', { base: 'bladeCol' }); }
        const g2 = grp(box, 'Hilt'); this.colour(g2, 'Guard and pommel', d.hiltCol, (v, f) => this.set({ hiltCol: v }, f)); this.colour(g2, 'Grip', d.gripCol, (v, f) => this.set({ gripCol: v }, f)); this.patPicker(g2, 'Grip', 'gripPat', 'gripPatCol', { base: 'gripCol' });
        if (J.hasWrap(d)) this.colour(g2, 'Grip wrap', d.wrapCol, (v, f) => this.set({ wrapCol: v }, f)); if (J.hasGem(d)) this.colour(g2, 'Gem', d.gemCol, (v, f) => this.set({ gemCol: v }, f));
        const g3 = grp(box, 'Brand'); this.brandChoice(g3); this.nameGroup(box);
      }
    },
    clothPanel(box, tab) {
      const d = this.st.d;
      if (tab === 'pieces') {
        const g1 = grp(box, 'Worn on'); this.segs(g1, J.CLOTH_SLOTS, d.slot, v => this.set({ slot: v, part: J.CLOTH[v][0][0] }, true), 3);
        const g2 = grp(box, 'Piece'); this.segs(g2, J.CLOTH[d.slot].map(x => [x[0], x[1]]), d.part, v => this.set({ part: v }, true), 2);
        if (d.slot === 'top') g2.append(el('div', 'note', 'Dresses cover her legs too, so they take the place of bottoms.'));
      } else {
        const g1 = grp(box, 'Colour'); this.colour(g1, 'Colour', d.col, (v, f) => this.set({ col: v }, f));
        const g2 = grp(box, 'Print'); this.patPicker(g2, 'All over', 'pat', 'patCol', { base: 'col' });
        if (d.pat >= 0) this.slider(g2, { label: 'Print size', value: d.tiles, min: 6, max: 32, fmt: v => v < 11 ? 'Big' : v < 20 ? 'Medium' : 'Small', ends: ['Big', 'Small'], on: (v, f) => this.set({ tiles: v }, f) });
        const g3 = grp(box, 'Brand'); this.brandChoice(g3); this.nameGroup(box);
      }
    },
    sandalPanel(box, tab) {
      const d = this.st.d, L = J.SAN_LIM, kimi = d.brand === 'kimiland';
      if (tab === 'pieces') {
        const g1 = grp(box, 'Style'); this.segs(g1, J.STYLES, d.style, v => this.set({ style: v }, true), 3);
        const g2 = grp(box, 'Sole'); this.slider(g2, { label: 'Sole height', value: d.soleH, min: L.soleH[0], max: L.soleH[1], fmt: v => v.toFixed(1) + ' cm', ends: ['Thin', 'Platform'], on: (v, f) => this.set({ soleH: v }, f) });
        this.slider(g2, { label: 'Heel lift', value: d.heelH, min: L.heelH[0], max: L.heelH[1], fmt: v => v < 0.5 ? 'Flat' : v.toFixed(1) + ' cm', ends: ['Flat', 'High heel'], on: (v, f) => this.set({ heelH: v }, f) });
        if (d.heelH >= 0.5) this.segs(g2, J.HEELS, d.heelType, v => this.set({ heelType: v }, true), 2);
        const g3 = grp(box, 'Sole colour'); this.toggle(g3, 'Fade to a second colour', d.soleGrad, v => this.set({ soleGrad: v }, true));
        this.colour(g3, d.soleGrad ? 'Heel colour' : 'Colour', d.soleCol, (v, f) => this.set({ soleCol: v }, f)); if (d.soleGrad) this.colour(g3, 'Toe colour', d.soleCol2, (v, f) => this.set({ soleCol2: v }, f));
        this.colour(g3, 'Footbed', d.bedCol, (v, f) => this.set({ bedCol: v }, f));
        const g4 = grp(box, 'Patterns'); this.patPicker(g4, 'Sole sides', 'solePat', 'solePatCol'); this.patPicker(g4, 'Footbed', 'bedPat', 'bedPatCol');
      } else if (tab === 'strap') {
        const g1 = grp(box, 'Straps');
        this.slider(g1, { label: 'Strap thickness', value: d.strapT, min: L.strapT[0], max: L.strapT[1], fmt: v => v.toFixed(2) + ' cm', ends: ['Thin', 'Chunky'], on: (v, f) => this.set({ strapT: v }, f) });
        this.slider(g1, { label: 'Strap width', value: d.strapW, min: d.style === 'slide' ? 1.8 : L.strapW[0], max: L.strapW[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ strapW: v }, f) });
        if (d.style === 'gladiator' || d.style === 'wrap') this.slider(g1, { label: 'How high they lace', value: d.shaft, min: L.shaft[0], max: L.shaft[1], fmt: v => Math.round(v) + ' cm', ends: ['Ankle', 'Calf'], on: (v, f) => this.set({ shaft: v }, f) });
        const g2 = grp(box, 'Strap colour'); this.toggle(g2, 'Fade to a second colour', d.strapGrad, v => this.set({ strapGrad: v }, true));
        this.colour(g2, d.strapGrad ? 'Start colour' : 'Colour', d.strapCol, (v, f) => this.set({ strapCol: v }, f)); if (d.strapGrad) this.colour(g2, 'End colour', d.strapCol2, (v, f) => this.set({ strapCol2: v }, f));
        const gp = grp(box, 'Strap pattern'); this.patPicker(gp, d.style === 'slipper' ? 'Slipper' : 'Straps', 'strapPat', 'strapPatCol');
        const g3 = grp(box, 'Buckles and hardware'); this.colour(g3, 'Hardware', d.hw, (v, f) => this.set({ hw: v }, f)); this.segs(g3, J.FINISHES.map(x => [x[0], x[1]]), d.finish, v => this.set({ finish: v }, true), 3);
      } else if (tab === 'charms') {
        const g = grp(box, 'Strap charms'); g.append(el('div', 'note', 'Charms and shapes are pinned on the main strap, facing out, on both sandals. Position slides each one along the strap.'));
        for (let i = 0; i < d.charms.length; i++) this.elCard(g, i); this.addGallery(box);
      } else { const g1 = grp(box, 'Brand'); this.brandChoice(g1); this.nameGroup(box); }
    },
    soundPanel(box, tab) {
      const d = this.st.d, L = J.SND_LIM, kind = d.kind;
      if (tab === 'pieces') {
        const g1 = grp(box, 'What it is'); this.segs(g1, J.SOUND_KINDS, kind, v => this.set({ kind: v }, true), 3);
        if (kind === 'over') {
          const g2 = grp(box, 'Cups'); this.segs(g2, J.CUPS, d.cup, v => this.set({ cup: v }, true), 3);
          this.slider(g2, { label: 'Cup size', value: d.cupR, min: L.cupR[0], max: L.cupR[1], fmt: v => (v * 2).toFixed(1) + ' cm across', on: (v, f) => this.set({ cupR: v }, f) });
          this.slider(g2, { label: 'Cup depth', value: d.cupD, min: Math.max(L.cupD[0], J.EAR_DEPTH - d.padT), max: L.cupD[1], fmt: v => v.toFixed(1) + ' cm', ends: ['Slim', 'Chunky'], on: (v, f) => this.set({ cupD: v }, f) });
          this.slider(g2, { label: 'Cushion', value: d.padT, min: L.padT[0], max: L.padT[1], fmt: v => v.toFixed(1) + ' cm thick', on: (v, f) => this.set({ padT: v }, f) });
          g2.append(el('div', 'note', 'The cups always cover her ears, so they stay a little deep.'));
          const g3 = grp(box, 'Headband'); this.segs(g3, J.YOKES, d.yoke, v => this.set({ yoke: v }, true), 2);
          this.slider(g3, { label: 'Band width', value: d.bandW, min: L.bandW[0], max: L.bandW[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ bandW: v }, f) });
          this.slider(g3, { label: 'Band thickness', value: d.bandT, min: L.bandT[0], max: L.bandT[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ bandT: v }, f) });
          this.toggle(g3, 'Cushion under the band', d.bandPad, v => this.set({ bandPad: v }, true));
        } else if (kind === 'muffs') {
          const g2 = grp(box, 'Muffs'); this.slider(g2, { label: 'Fluff size', value: d.cupR, min: L.cupR[0], max: L.cupR[1], fmt: v => (v * 2).toFixed(1) + ' cm', ends: ['Snug', 'Huge'], on: (v, f) => this.set({ cupR: v }, f) });
          const g3 = grp(box, 'Band'); this.slider(g3, { label: 'Band width', value: d.bandW, min: L.bandW[0], max: L.bandW[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ bandW: v }, f) });
          this.slider(g3, { label: 'Band thickness', value: d.bandT, min: L.bandT[0], max: L.bandT[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ bandT: v }, f) });
        } else {
          const g2 = grp(box, 'Buds'); this.segs(g2, J.BUDS, d.bud, v => this.set({ bud: v }, true), 2);
          this.slider(g2, { label: 'Bud size', value: d.budSize, min: L.budSize[0], max: L.budSize[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ budSize: v }, f) });
        }
        if (kind !== 'buds') { const g4 = grp(box, 'On top'); this.segs(g4, J.TOPPERS, d.top, v => this.set({ top: v }, true), 3); }
        if (kind === 'over') { const g5 = grp(box, 'Extras'); this.toggle(g5, 'Boom mic', d.mic, v => this.set({ mic: v }, true)); this.toggle(g5, 'Glowing ring', d.glow, v => this.set({ glow: v }, true)); }
      } else if (tab === 'strap') {
        const g1 = grp(box, 'Cord');
        if (kind === 'muffs') g1.append(el('div', 'note', 'Earmuffs have no cord. Switch to headphones or earbuds to wire them up.'));
        else {
          this.toggle(g1, 'Wired', d.wired, v => this.set({ wired: v }, true));
          if (d.wired) {
            if (kind === 'over') this.toggle(g1, 'Coiled cord', d.coil, v => this.set({ coil: v }, true)); else this.toggle(g1, 'Inline remote', d.remote, v => this.set({ remote: v }, true));
            this.slider(g1, { label: 'Where the plug hangs', value: d.cordLen, min: 0, max: 1, fmt: v => v < 0.34 ? 'Chest' : v < 0.67 ? 'Waist' : 'Hip', ends: ['Chest', 'Hip'], on: (v, f) => this.set({ cordLen: v }, f) });
            this.colour(g1, 'Cord colour', d.cordCol, (v, f) => this.set({ cordCol: v }, f));
            g1.append(el('div', 'note', kind === 'buds' ? 'A cord from each bud meets under her chin, then one cord runs down her chest to the plug.' : 'The cord leaves her left cup and runs down her chest to the plug.'));
          } else g1.append(el('div', 'note', 'Wireless. Turn on Wired for a cord down to a plug.'));
        }
        const g2 = grp(box, 'Hardware'); this.colour(g2, kind === 'buds' ? 'Chains and plug' : 'Sliders, hinges and plug', d.hw, (v, f) => this.set({ hw: v }, f));
      } else {
        const g1 = grp(box, 'Brand'); this.brandChoice(g1);
        const g2 = grp(box, kind === 'muffs' ? 'Fluff' : kind === 'buds' ? 'Buds' : 'Cups');
        this.colour(g2, kind === 'muffs' ? 'Colour' : kind === 'buds' ? 'Bud colour' : 'Cup colour', d.cupCol, (v, f) => this.set({ cupCol: v }, f));
        if (kind !== 'muffs') this.colour(g2, kind === 'buds' ? (d.bud === 'round' ? 'Outer face' : 'Stem tip') : 'Outer plate', d.cupCol2, (v, f) => this.set({ cupCol2: v }, f));
        if (kind === 'over' || (kind === 'buds' && d.bud === 'round') || kind === 'muffs') this.patPicker(g2, kind === 'muffs' ? 'Fur' : kind === 'buds' ? 'Outer face' : 'Outer plate', 'cupPat', 'cupPatCol', { base: kind === 'muffs' ? 'cupCol' : 'cupCol2' });
        this.colour(g2, kind === 'buds' ? 'Ear tips' : 'Cushions', d.padCol, (v, f) => this.set({ padCol: v }, f));
        if (kind !== 'muffs') this.segs(g2, J.FINISHES.map(x => [x[0], x[1]]), d.finish, v => this.set({ finish: v }, true), 3);
        if (kind !== 'buds') { const g3 = grp(box, 'Band'); this.colour(g3, 'Band colour', d.bandCol, (v, f) => this.set({ bandCol: v }, f)); if (kind === 'over') this.patPicker(g3, 'Band', 'bandPat', 'bandPatCol', { base: 'bandCol' }); if (d.top !== 'none') this.colour(g3, J.TOPPER_LABEL[d.top], d.topCol, (v, f) => this.set({ topCol: v }, f)); }
        if (kind === 'over' && d.glow) { const g4 = grp(box, 'Glow'); this.colour(g4, 'Glow colour', d.glowCol, (v, f) => this.set({ glowCol: v }, f)); }
        this.nameGroup(box);
      }
    },
    pursePanel(box, tab) {
      const d = this.st.d, L = J.BAG_LIM[d.shape], kimi = d.brand === 'kimiland';
      if (tab === 'pieces') {
        const g1 = grp(box, 'Shape'); this.segs(g1, J.BAG_SHAPES, d.shape, v => this.set({ shape: v }, true), 3);
        const g2 = grp(box, 'Size'); this.slider(g2, { label: 'Width', value: d.w, min: L.w[0], max: L.w[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ w: v }, f) });
        if (L.h) this.slider(g2, { label: 'Height', value: d.h, min: L.h[0], max: L.h[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ h: v }, f) }); else if (d.shape === 'bucket') this.slider(g2, { label: 'Height', value: d.h, min: 9, max: 18, fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ h: v }, f) });
        if (L.d) this.slider(g2, { label: 'Depth', value: d.depth, min: L.d[0], max: L.d[1], fmt: v => v.toFixed(1) + ' cm', on: (v, f) => this.set({ depth: v }, f) });
        const g3 = grp(box, 'Details'); if (d.shape === 'satchel' || d.shape === 'clutch') this.toggle(g3, 'Flap', d.flap, v => this.set({ flap: v }, true)); this.toggle(g3, 'Top handle', d.handle, v => this.set({ handle: v }, true));
        this.segs(g3, J.CLOSURES.filter(c => !(d.shape === 'bucket' && c[0] === 'clasp')), d.closure, v => this.set({ closure: v }, true), 4);
      } else if (tab === 'strap') {
        const g1 = grp(box, 'Strap'); this.segs(g1, J.STRAPS, d.strap, v => this.set({ strap: v }, true), 3); this.colour(g1, 'Strap colour', d.strapCol, (v, f) => this.set({ strapCol: v }, f));
        this.slider(g1, { label: 'How low the bag hangs', value: d.strapLen, min: 0, max: 1, fmt: v => v < 0.33 ? 'Ribs' : v < 0.66 ? 'Waist' : 'Hip', ends: ['Ribs', 'Hip'], on: (v, f) => this.set({ strapLen: v }, f) });
        g1.append(el('div', 'note', 'The strap crosses her body from her left shoulder to the bag at her right hip.'));
        const g2 = grp(box, 'Hardware'); this.colour(g2, 'Clasp, rings and chains', d.hw, (v, f) => this.set({ hw: v }, f));
      } else if (tab === 'charms') {
        const g = grp(box, 'Keychains'); g.append(el('div', 'note', 'Charms and shapes hang from the bottom of the bag on little chains. Position slides them along the bag; chain length sets how far they dangle.'));
        for (let i = 0; i < d.charms.length; i++) this.elCard(g, i); this.addGallery(box);
      } else {
        const g1 = grp(box, 'Brand'); this.brandChoice(g1);
        const g2 = grp(box, 'Bag'); this.segs(g2, J.PATTERNS, d.pattern, v => this.set({ pattern: v }, true), 3); if (d.pattern === 'print') this.patPicker(g2, 'Print', 'print', null, { base: 'body', col: 'body2', noNone: true }); this.colour(g2, d.pattern === 'solid' ? 'Colour' : 'First colour', d.body, (v, f) => this.set({ body: v }, f)); this.colour(g2, d.pattern === 'solid' ? 'Flap and trim' : 'Second colour', d.body2, (v, f) => this.set({ body2: v }, f));
        this.segs(g2, J.FINISHES.map(x => [x[0], x[1]]), d.finish, v => this.set({ finish: v }, true), 3);
        this.nameGroup(box);
      }
    },
    nameGroup(box) {
      const g3 = grp(box, 'Name'), nr = el('label', 'row sw2', '<span class="lb">Name it from the design</span>'), t = el('input', 'g-switch'); t.type = 'checkbox'; t.checked = this.st.autoName; t.onchange = () => { this.st.autoName = t.checked; if (t.checked) { this.st.name = J.nameFor(this.dept, this.st.d, this.st.seed); $('#docName').value = this.st.name; } this.commit(); }; nr.append(t); g3.append(nr);
      const g4 = grp(box, 'Files'), br = el('div', 'btnrow'), bj = el('button', 'g-btn g-btn--sm', `${ic('floppy_disk')}<span>Save .json</span>`), bo = el('button', 'g-btn g-btn--sm', `${ic('folder_open')}<span>Open .json</span>`);
      bj.onclick = () => GRUG.download(slug(this.st.name, this.dept) + '.json', new Blob([JSON.stringify({ kind: 'grug-' + this.dept, d: this.st.d, name: this.st.name, seed: this.st.seed }, null, 1)], { type: 'application/json' }));
      bo.onclick = () => { const f = el('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = async () => { try { const j = JSON.parse(await f.files[0].text()); if (j.kind !== 'grug-' + this.dept) throw 0; this.load(this.dept, j.d, { seed: j.seed, name: j.name, autoName: false }); this.rebuild(true); renderInspector(); this.commit(); } catch (e) { GRUG.toast('That file isn\'t a ' + JDEPT[this.dept].one + ' design'); } }; f.click(); };
      br.append(bj, bo); g4.append(br);
    },
    publish() { const list = mine(); list.unshift({ id: Date.now().toString(36), dept: this.dept, seed: this.st.seed, name: this.st.name || 'My ' + JDEPT[this.dept].one, d: this.st.d, when: Date.now() }); if (saveMine(list.slice(0, 60))) GRUG.toast('Added to the catalog'); },
    rename() { this.st.seed = this.st.seed.replace(/~\d+$/, '') + '~' + Math.floor(Math.random() * 1e6); this.st.name = J.nameFor(this.dept, this.st.d, this.st.seed); this.st.autoName = true; $('#docName').value = this.st.name; this.commit(); },
    async download(w, fmt) {
      if (w.dept === 'clothing') { GRUG.toast('Clothing downloads are in the classic closet'); return; }
      const base = slug(w.name, w.dept), b = J.build(w.dept, w.d); try { const { blob, ext } = await GE.exportModel(b.root, fmt, { scale: b.frame === 'head' ? hm.unitCm : 1, base }); GRUG.download(base + '.' + ext, blob); GRUG.toast('Downloaded ' + base + '.' + ext); } catch (e) { console.error(e); GRUG.toast('Couldn\'t make that file'); }
      b.dispose();
    }
  };
  const CHARM_PIC = e => (e.outline && !J.CHARM_BY[e.id].noOutline ? J.CHARM_BY[e.id].outline : J.CHARM_BY[e.id].src);
  // a picture for a card or a starter tile
  function thumbJewel(it, bodyColour) {
    const b = JM.mountItem(it), back = soloItem(b.root); sandy.object3d.updateMatrixWorld(true);
    frameOn(JM.frameBox(b.root, it), it.dept === 'back' ? (it.d.kind === 'hip' ? 1.25 : 2.6) : it.dept === 'clothing' ? 0.35 : it.dept === 'earrings' ? 1.0 : it.dept === 'sound' ? (it.d.kind === 'buds' ? 0.95 : 0.55) : it.dept === 'purses' ? 0.25 : it.dept === 'sandals' ? 0.55 : 0.3, it.dept === 'sandals' ? 0.2 : it.dept === 'sound' ? 0.12 : it.dept === 'back' || it.dept === 'clothing' ? 0.1 : 0.08, thumbCam, 26, 1.0);
    const url = snapScene(bodyColour, true); back(); JM.unmount(b); return url;
  }
  // the jewelry item page: the piece on her, framed
  function jewelShow() {
    const it = viewer.item; if (viewer.built) { if (viewer.built.root.parent) viewer.built.root.parent.remove(viewer.built.root); viewer.built.dispose(); viewer.built = null; }
    viewer.built = JM.mountItem(it); viewer.shown = viewer.built.root; if (worn) worn.root.visible = false; setHair(true); sandy.object3d.visible = true; sandy.object3d.updateMatrixWorld(true);
    const sph = (it.dept === 'sound' || it.dept === 'clothing' || it.dept === 'back' ? JM.frameBox(viewer.built.root, it) : new THREE.Box3().setFromObject(viewer.built.root)).getBoundingSphere(new THREE.Sphere());
    if (it.dept === 'earrings') sph.radius = Math.max(sph.radius, 13); else sph.radius = Math.max(sph.radius, it.dept === 'back' || it.dept === 'clothing' ? 30 : it.dept === 'purses' ? 22 : it.dept === 'sandals' ? 26 : it.dept === 'sound' ? (it.d.kind === 'buds' ? 12 : 20) : 16); cam.target.copy(sph.center); cam.yaw = it.dept === 'back' ? (it.d.kind === 'hip' ? 1.25 : 2.6) : it.dept === 'clothing' ? 0.35 : it.dept === 'earrings' ? 0.8 : it.dept === 'sound' ? (it.d.kind === 'buds' ? 0.95 : 0.6) : it.dept === 'purses' ? 0.35 : it.dept === 'sandals' ? 0.6 : 0.45; cam.pitch = 0.1; cam.dist = clamp(sph.radius / Math.sin(15 * Math.PI / 180) * 1.25, ZOOM[0], ZOOM[1]);
  }
  function jewelLike(box, it) {
    const r = rng('like:' + it.id); const kimi = it.brand === 'kimiland';
    for (let i = 0; i < 6; i++) { const seed = 'like-' + it.seed + '-' + i, li = JM.gen(it.dept, seed); const a = card(li, 'worn', { gen: -1 }); box.append(a); a._thumb(); }
  }

  // the KIMILAND logo on a preview opens a small toast offering their Roblox group
  const KIMI_URL = 'https://www.roblox.com/communities/5835899/KimiLand#!/about';
  function kimiAsk() {
    const old = document.getElementById('kimiToast'); if (old) old.remove();
    const t = el('div', 'kimitoast', `<img src="../../assets/brands/kimiland-logo.png" alt=""><span>Would you like to visit the KIMILAND Roblox group page?</span><button class="g-btn g-btn--sm g-btn--primary" data-y>Visit</button><button class="g-btn g-btn--sm g-btn--ghost" data-n>Not now</button>`); t.id = 'kimiToast'; t.setAttribute('role', 'alertdialog');
    t.querySelector('[data-y]').onclick = () => { window.open(KIMI_URL, '_blank', 'noopener'); t.remove(); }; t.querySelector('[data-n]').onclick = () => t.remove();
    document.body.append(t); setTimeout(() => { if (t.isConnected) t.remove(); }, 15000);
  }
  const kimiLogoBtn = () => { const b = el('button', 'kimilogo', '<img src="../../assets/brands/kimiland-logo.png" alt="KIMILAND">'); b.setAttribute('aria-label', 'KIMILAND: visit their Roblox group'); b.setAttribute('data-g-tip', 'KIMILAND'); b.onclick = e => { e.preventDefault(); e.stopPropagation(); kimiAsk(); }; return b; };
