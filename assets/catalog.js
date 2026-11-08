/* Grug · the closet catalog: custom clothing designs for the 3D avatar
   Every design is a Roblox classic clothing template (585 x 559 PNG in assets/clothing/<id>.png):
     slot 'shirt' → a SHIRT template, worn on the T-shirt or the Long-sleeve tee
     slot 'pants' → a PANTS template, worn on the Shorts or the Pants
   Players can also upload their own templates in the avatar editor (Custom clothing); this list is what's earned.
   Shared by the site, the avatar editor and every partner app (play/<name>/).

   get:   how it's earned.
          {type:'free'}                              everyone has it
          {type:'points', app:'yoshi', cost:40}      bought inside that partner's rewards app with its points
          {type:'milestone', app:'yoshi', stat:'best', value:6000, text:'Score 6,000 in one Sushi Swap run'}
          {type:'milestone', app:'grug', stat:'checkins', value:10, text:'Check in 10 times at any partner'}
   Milestones are checked by the app named in `app` ('grug' = the shared profile keeps the count).
   colors: the design's main colours (used where a game can't draw the template).
*/
(function (root) {
  'use strict';

  const APPS = {
    grug:     { name: 'Grug',                     short: 'Grug' },
    yoshi:    { name: 'Yoshi Sushi Asian Fusion', short: 'Yoshi',    game: 'Sushi Swap' },
    cielito:  { name: 'Cielito Lindo Taqueria',   short: 'Cielito',  game: 'Taco Match' },
    teahouse: { name: 'Teahouse Express',         short: 'Teahouse', game: 'Take a Tea' },
    soluna:   { name: 'Soluna Coffee',            short: 'Soluna',   game: 'Sunrise to Sunset' },
    alchemy:  { name: 'Alchemy Bake Lab',         short: 'Alchemy',  game: 'Sugar Alchemist' },
    rodeo:    { name: 'Rodeo Express Car Wash',   short: 'Rodeo',    game: 'Rodeo Wash Simulator' },
    runway:   { name: 'Runway Ready',             short: 'Runway',   game: 'Runway Ready' },
    chestquest: { name: 'Chest Quest',            short: 'Chest Quest', game: 'Chest Quest' },
    glowupspa: { name: 'Glow Up Spa',             short: 'Glow Up Spa', game: 'Glow Up Spa' }
  };

  const free = () => ({ type: 'free' });
  const pts = (app, cost) => ({ type: 'points', app, cost });
  const ms = (app, stat, value, text) => ({ type: 'milestone', app, stat, value, text });
  const shirt = (id, name, colors, get) => ({ id, slot: 'shirt', name, colors, get });
  const pants = (id, name, colors, get) => ({ id, slot: 'pants', name, colors, get });

  /* ---------------- designs ---------------- */
  const ITEMS = [
    /* Grug: free starters and milestones across every game */
    shirt('grug-tee',    'Grug classic tee',   ['#8FD33A', '#1F1A17'], free()),
    pants('jeans',       'Classic jeans',      ['#2F5C9A', '#3A2416'], free()),
    shirt('checker',     'Checkerboard',       ['#F4F1EA', '#141414'], ms('grug', 'plays', 1, 'Play your first run')),
    pants('chef-checks', 'Chef checks',        ['#F4F1EA', '#171412'], ms('grug', 'games', 2, 'Play 2 different games')),
    pants('camo',        'Camo cargos',        ['#6B7B3A', '#2F3520'], ms('grug', 'games', 3, 'Play 3 different games')),
    shirt('varsity',     'Katy varsity jacket', ['#22305A', '#EFE7D3'], ms('grug', 'checkins', 5, 'Check in 5 times at any partner')),
    pants('joggers',     'Track joggers',      ['#1B1B1E', '#F4F1EA'], ms('grug', 'plays', 15, 'Play 15 runs of any game')),
    pants('tartan',      'Tartan',             ['#B3262A', '#192850'], ms('grug', 'partners', 3, 'Check in at 3 different partners')),
    shirt('galaxy',      'Galaxy',             ['#3A1E78', '#FF5CA8'], ms('grug', 'checkins', 10, 'Check in 10 times at any partner')),
    shirt('flames',      'Ember flames',       ['#161212', '#FF8A2B'], ms('grug', 'checkins', 25, 'Check in 25 times at any partner')),
    /* partners */
    shirt('yoshi-fish',  'Yoshi fish tee',     ['#171412', '#F26A1B'], pts('yoshi', 40)),
    shirt('omakase',     'Omakase chef coat',  ['#F6F3EC', '#C0392B'], ms('yoshi', 'best', 6000, 'Score 6,000 in one Sushi Swap run')),
    shirt('taco-tee',    'Taco tee',           ['#C8382A', '#F2B544'], pts('cielito', 40)),
    shirt('serape',      'Serape stripes',     ['#C8382A', '#2E8B57'], ms('cielito', 'best', 6000, 'Score 6,000 in one Taco Match run')),
    shirt('boba-tee',    'Boba tee',           ['#1E6B35', '#F6C445'], pts('teahouse', 30)),
    pants('matcha',      'Matcha joggers',     ['#7FA650', '#F6F1E7'], ms('teahouse', 'best', 10, 'Run a tea shop that makes $10 a second')),
    shirt('barista',     'Barista apron',      ['#F3EEE4', '#4A3324'], pts('soluna', 30)),
    shirt('sunrise',     'Sunrise hoodie',     ['#FF8A5C', '#8E5CF0'], pts('soluna', 35)),
    shirt('sprinkles',   'Sprinkle tee',       ['#FF9CC2', '#6B3E26'], ms('alchemy', 'days', 1, 'Finish a day in Sugar Alchemist'))
  ];
  ITEMS.forEach(it => { it.template = 'shop:' + it.id; it.png = 'assets/clothing/' + it.id + '.png'; it.thumb = 'assets/clothing/thumbs/' + it.id + '.png'; });

  const SLOTS = [
    { id: 'shirt', name: 'Shirt' },
    { id: 'pants', name: 'Pants' }
  ];
  // the four garments that take a template (SandyKit part ids) and the texture each part starts from
  const GARMENTS = {
    shirt: [{ part: 'gen_tshirt', texture: 'gen_tshirt', name: 'T-shirt' }, { part: 'gen_longsleeve', texture: 'gen_longsleeve', name: 'Long-sleeve tee' }],
    pants: [{ part: 'mh_cortu_jeans_shorts', texture: 'mh_cortu_jeans_shorts', name: 'Shorts' }, { part: 'Female_Peasant_Legs', texture: 'peasant', name: 'Pants' }]
  };
  const CFG_KEY = { shirt: 'top', pants: 'legs' };   // where each slot lives in the avatar's look

  const byId = {};
  ITEMS.forEach(it => { byId[it.id] = it; });

  // what the closet remembers being worn (the avatar's look in 'grug.sandy.v1' is the real thing)
  const DEFAULT_AVATAR = { shirt: null, pants: null };

  const Catalog = {
    APPS, ITEMS, SLOTS, GARMENTS, CFG_KEY, DEFAULT_AVATAR,
    get: id => byId[id] || null,
    // the design an avatar look is wearing in a slot ('shop:<id>' template), or null
    wornIn(look, slot) { const v = look && look[CFG_KEY[slot]]; const m = v && typeof v.template === 'string' && /^shop:([\w-]+)$/.exec(v.template); return m && byId[m[1]] && byId[m[1]].slot === slot ? m[1] : null; },
    inSlot: slot => ITEMS.filter(it => it.slot === slot),
    isFree: it => !!it && it.get.type === 'free',
    freeIds: () => ITEMS.filter(it => it.get.type === 'free').map(it => it.id),
    forApp: app => ITEMS.filter(it => it.get.type !== 'free' && it.get.app === app),
    // Human text for how an item is earned.
    howText(it) {
      if (!it) return '';
      const g = it.get, app = APPS[g.app] || APPS.grug;
      if (g.type === 'free') return 'Free';
      if (g.type === 'points') return g.cost + ' ' + app.short + ' points';
      return g.text || 'Milestone';
    },
    slotName: slot => (SLOTS.find(s => s.id === slot) || {}).name || slot,
    normalize(a) {
      const o = { shirt: null, pants: null };
      if (a && typeof a === 'object') ['shirt', 'pants'].forEach(s => { const it = byId[a[s]]; if (it && it.slot === s) o[s] = it.id; });
      return o;
    },
    hash(a) { a = Catalog.normalize(a); return [a.shirt, a.pants].join('|'); }
  };

  root.GrugCatalog = Catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = Catalog;
})(typeof window !== 'undefined' ? window : globalThis);
