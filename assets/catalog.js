/* Grug · the closet catalog
   Every piece of clothing and gear an avatar can wear, and how you get it.
   Shared by the site, the avatar editor and every partner app (play/<name>/).

   slot:  skinless parts of the avatar an item goes on. One item per slot.
          hair · face · hat · shirt · pants · back · hand
   kind:  what the 3D renderer draws (see avatar3d.js). Several items can share a kind with different colors.
   get:   how it's earned.
          {type:'free'}                              everyone has it
          {type:'points', app:'yoshi', cost:40}      bought inside that partner's rewards app with its points
          {type:'milestone', app:'yoshi', stat:'course', value:3, text:'Reach course 3 in Sushi Swap'}
          {type:'milestone', app:'grug', stat:'checkins', value:10, text:'Check in 10 times at any partner'}
   Milestones are checked by the app named in `app` ('grug' = the shared profile keeps the count).
*/
(function (root) {
  'use strict';

  const APPS = {
    grug:     { name: 'Grug',                     short: 'Grug' },
    yoshi:    { name: 'Yoshi Sushi Asian Fusion', short: 'Yoshi',    game: 'Sushi Swap' },
    cielito:  { name: 'Cielito Lindo Taqueria',   short: 'Cielito',  game: 'Taco Match' },
    teahouse: { name: 'Teahouse Express',         short: 'Teahouse', game: 'Take a Tea' },
    soluna:   { name: 'Soluna Coffee',            short: 'Soluna',   game: 'Sunrise to Sunset' },
    alchemy:  { name: 'Alchemy Bake Lab',         short: 'Alchemy',  game: 'Sugar Alchemist' }
  };

  // Skin tones: the classic yellow first, then a real range, then a few fun ones.
  const SKINS = [
    ['#F5CD30', 'Classic'], ['#FFE0BD', 'Porcelain'], ['#F1C27D', 'Sand'], ['#E0AC69', 'Honey'],
    ['#C68642', 'Caramel'], ['#8D5524', 'Cocoa'], ['#5C3A21', 'Espresso'], ['#3B2314', 'Ebony'],
    ['#A8E063', 'Lime'], ['#5DD9F2', 'Sky'], ['#C792EA', 'Grape'], ['#FF8FB1', 'Bubblegum'],
    ['#9E9E9E', 'Stone'], ['#F6F1E7', 'Bone']
  ];

  // Palette for recolorable items (hair, basic shirts and pants, caps).
  const COLORS = [
    ['#F6F1E7', 'White'], ['#2B2B2B', 'Black'], ['#6B7280', 'Grey'], ['#C0392B', 'Red'], ['#FF7A1A', 'Orange'],
    ['#FFD447', 'Yellow'], ['#9BE338', 'Lime'], ['#2E8B57', 'Green'], ['#2EC4A6', 'Teal'], ['#2D9BF0', 'Blue'],
    ['#2C3E6B', 'Navy'], ['#8E5CF0', 'Purple'], ['#FF5CA8', 'Pink'], ['#8B5A2B', 'Brown'], ['#4A2F1B', 'Dark brown'],
    ['#E8C98C', 'Blonde']
  ];

  const free = () => ({ type: 'free' });
  const pts = (app, cost) => ({ type: 'points', app, cost });
  const ms = (app, stat, value, text) => ({ type: 'milestone', app, stat, value, text });

  /* ---------------- items ---------------- */
  const ITEMS = [
    /* hair (recolorable) */
    { id: 'hair-short',    slot: 'hair', kind: 'short',    name: 'Short cut',      recolor: true, get: free() },
    { id: 'hair-bob',      slot: 'hair', kind: 'bob',      name: 'Bob',            recolor: true, get: free() },
    { id: 'hair-spiky',    slot: 'hair', kind: 'spiky',    name: 'Spiky',          recolor: true, get: free() },
    { id: 'hair-long',     slot: 'hair', kind: 'long',     name: 'Long',           recolor: true, get: free() },
    { id: 'hair-buns',     slot: 'hair', kind: 'buns',     name: 'Space buns',     recolor: true, get: free() },
    { id: 'hair-curly',    slot: 'hair', kind: 'curly',    name: 'Curly',          recolor: true, get: free() },
    { id: 'hair-ponytail', slot: 'hair', kind: 'ponytail', name: 'Ponytail',       recolor: true, get: free() },
    { id: 'hair-mohawk',   slot: 'hair', kind: 'mohawk',   name: 'Mohawk',         recolor: true, get: ms('grug', 'plays', 5, 'Play 5 runs of any game') },

    /* faces */
    { id: 'face-smile',      slot: 'face', kind: 'smile',      name: 'Smile',          get: free() },
    { id: 'face-grin',       slot: 'face', kind: 'grin',       name: 'Big grin',       get: free() },
    { id: 'face-happy',      slot: 'face', kind: 'happy',      name: 'Happy',          get: free() },
    { id: 'face-surprised',  slot: 'face', kind: 'surprised',  name: 'Surprised',      get: free() },
    { id: 'face-wink',       slot: 'face', kind: 'wink',       name: 'Wink',           get: free() },
    { id: 'face-serious',    slot: 'face', kind: 'serious',    name: 'Game face',      get: free() },
    { id: 'face-sleepy',     slot: 'face', kind: 'sleepy',     name: 'Sleepy',         get: ms('grug', 'checkins', 3, 'Check in 3 times at any partner') },
    { id: 'face-silly',      slot: 'face', kind: 'silly',      name: 'Silly',          get: ms('grug', 'plays', 10, 'Play 10 runs of any game') },
    { id: 'face-cat',        slot: 'face', kind: 'cat',        name: 'Cat',            get: ms('grug', 'games', 3, 'Play 3 different games') },
    { id: 'face-mustache',   slot: 'face', kind: 'mustache',   name: 'Chef mustache',  get: ms('alchemy', 'days', 1, 'Finish a day in Sugar Alchemist') },

    /* shirts */
    { id: 'tee',            slot: 'shirt', kind: 'tee',        name: 'T-shirt',          recolor: true, get: free() },
    { id: 'longsleeve',     slot: 'shirt', kind: 'longsleeve', name: 'Long sleeve',      recolor: true, get: free() },
    { id: 'hoodie',         slot: 'shirt', kind: 'hoodie',     name: 'Hoodie',           recolor: true, get: free() },
    { id: 'tee-grug',       slot: 'shirt', kind: 'tee',        name: 'Grug tee',         colors: ['#2B2B2B'], emblem: 'grug', get: free() },
    { id: 'jacket-varsity', slot: 'shirt', kind: 'jacket',     name: 'Katy varsity jacket', colors: ['#2C3E6B', '#F6F1E7'], get: ms('grug', 'checkins', 5, 'Check in 5 times at any partner') },
    { id: 'jersey-stripes', slot: 'shirt', kind: 'jersey',     name: 'Striped jersey',   colors: ['#C0392B', '#F6F1E7'], get: ms('grug', 'plays', 20, 'Play 20 runs of any game') },
    { id: 'tee-sushi',      slot: 'shirt', kind: 'tee',        name: 'Yoshi fish tee',   colors: ['#171412'], emblem: 'fish',   get: pts('yoshi', 40) },
    { id: 'chefcoat',       slot: 'shirt', kind: 'chefcoat',   name: 'Omakase coat',     colors: ['#F6F1E7', '#171412'], get: ms('yoshi', 'best', 6000, 'Score 6,000 in one Sushi Swap run') },
    { id: 'tee-taco',       slot: 'shirt', kind: 'tee',        name: 'Taco tee',         colors: ['#C0392B'], emblem: 'taco',   get: pts('cielito', 40) },
    { id: 'apron-cielito',  slot: 'shirt', kind: 'apron',      name: 'Taquero apron',    colors: ['#F6F1E7', '#2E8B57'], get: ms('cielito', 'best', 6000, 'Score 6,000 in one Taco Match run') },
    { id: 'tee-boba',       slot: 'shirt', kind: 'tee',        name: 'Boba tee',         colors: ['#1E6B35'], emblem: 'boba',   get: pts('teahouse', 30) },
    { id: 'apron-soluna',   slot: 'shirt', kind: 'apron',      name: 'Barista apron',    colors: ['#2B2B2B', '#5F5C37'], get: pts('soluna', 30) },
    { id: 'tee-sun',        slot: 'shirt', kind: 'tee',        name: 'Sunrise tee',      colors: ['#F6F1E7'], emblem: 'sun',    get: pts('soluna', 35) },
    { id: 'tee-cupcake',    slot: 'shirt', kind: 'tee',        name: 'Cupcake tee',      colors: ['#FF8FB1'], emblem: 'cupcake', get: ms('alchemy', 'days', 1, 'Finish a day in Sugar Alchemist') },

    /* pants */
    { id: 'pants',          slot: 'pants', kind: 'pants',   name: 'Pants',            recolor: true, get: free() },
    { id: 'shorts',         slot: 'pants', kind: 'shorts',  name: 'Shorts',           recolor: true, get: free() },
    { id: 'jeans',          slot: 'pants', kind: 'jeans',   name: 'Jeans',            colors: ['#3B5A8A'], get: free() },
    { id: 'pants-chef',     slot: 'pants', kind: 'checker', name: 'Chef checks',      colors: ['#2B2B2B', '#F6F1E7'], get: ms('grug', 'games', 2, 'Play 2 different games') },
    { id: 'pants-track',    slot: 'pants', kind: 'track',   name: 'Track pants',      colors: ['#2B2B2B', '#9BE338'], get: ms('grug', 'plays', 15, 'Play 15 runs of any game') },

    /* hats */
    { id: 'cap',            slot: 'hat', kind: 'cap',       name: 'Cap',              recolor: true, get: free() },
    { id: 'beanie',         slot: 'hat', kind: 'beanie',    name: 'Beanie',           recolor: true, get: free() },
    { id: 'hachimaki',      slot: 'hat', kind: 'headband',  name: 'Sushi chef headband', colors: ['#F6F1E7', '#C0392B'], get: ms('yoshi', 'course', 3, 'Reach course 3 in Sushi Swap') },
    { id: 'tacohat',        slot: 'hat', kind: 'tacohat',   name: 'Taco hat',         get: ms('cielito', 'course', 3, 'Reach course 3 in Taco Match') },
    { id: 'bobahat',        slot: 'hat', kind: 'bobahat',   name: 'Boba cup hat',     get: ms('teahouse', 'best', 10, 'Run a tea shop that makes $10 a second') },
    { id: 'leafcrown',      slot: 'hat', kind: 'leafcrown', name: 'Tea leaf crown',   get: pts('teahouse', 60) },
    { id: 'beanie-sunrise', slot: 'hat', kind: 'beanie',    name: 'Sunrise beanie',   colors: ['#B08A57', '#F6F1E7'], get: pts('soluna', 45) },
    { id: 'toque',          slot: 'hat', kind: 'toque',     name: 'Alchemist toque',  get: ms('alchemy', 'days', 1, 'Finish a day in Sugar Alchemist') },
    { id: 'cowboy',         slot: 'hat', kind: 'cowboy',    name: 'Katy cowboy hat',  get: ms('grug', 'checkins', 5, 'Check in 5 times at any partner') },
    { id: 'crown',          slot: 'hat', kind: 'crown',     name: "Regular's crown",  get: ms('grug', 'checkins', 10, 'Check in 10 times at any partner') },
    { id: 'headphones',     slot: 'hat', kind: 'headphones', name: 'Headphones',      get: ms('grug', 'games', 4, 'Play 4 different games') },
    { id: 'party',          slot: 'hat', kind: 'party',     name: 'Party hat',        get: ms('grug', 'plays', 1, 'Play your first run') },

    /* back */
    { id: 'backpack',       slot: 'back', kind: 'backpack', name: 'Backpack',         recolor: true, get: free() },
    { id: 'maki-backpack',  slot: 'back', kind: 'maki',     name: 'Maki roll backpack', get: pts('yoshi', 60) },
    { id: 'chili-buddy',    slot: 'back', kind: 'chili',    name: 'Chili buddy',      get: pts('cielito', 60) },
    { id: 'pearl-backpack', slot: 'back', kind: 'pearl',    name: 'Boba pearl backpack', get: pts('teahouse', 45) },
    { id: 'cape',           slot: 'back', kind: 'cape',     name: 'Katy cape',        colors: ['#9BE338'], get: ms('grug', 'partners', 3, 'Check in at 3 different partners') },
    { id: 'wings',          slot: 'back', kind: 'wings',    name: 'Ember wings',      get: ms('grug', 'checkins', 25, 'Check in 25 times at any partner') },

    /* hand */
    { id: 'club',           slot: 'hand', kind: 'club',     name: "Grug's club",      get: free() },
    { id: 'chopsticks',     slot: 'hand', kind: 'chopsticks', name: 'Chopsticks',     get: ms('yoshi', 'plays', 3, 'Play 3 runs of Sushi Swap') },
    { id: 'taco',           slot: 'hand', kind: 'taco',     name: 'Taco',             get: ms('cielito', 'plays', 3, 'Play 3 runs of Taco Match') },
    { id: 'bobacup',        slot: 'hand', kind: 'bobacup',  name: 'Boba cup',         get: ms('teahouse', 'plays', 1, 'Open your first tea shop') },
    { id: 'coffeecup',      slot: 'hand', kind: 'coffeecup', name: 'Soluna cup',      get: pts('soluna', 25) },
    { id: 'whisk',          slot: 'hand', kind: 'whisk',    name: 'Whisk',            get: ms('alchemy', 'days', 1, 'Finish a day in Sugar Alchemist') },
    { id: 'torch',          slot: 'hand', kind: 'torch',    name: 'Cave torch',       get: ms('grug', 'plays', 30, 'Play 30 runs of any game') }
  ];

  const SLOTS = [
    { id: 'skin',  name: 'Skin' },
    { id: 'face',  name: 'Face' },
    { id: 'hair',  name: 'Hair' },
    { id: 'hat',   name: 'Hat' },
    { id: 'shirt', name: 'Shirt' },
    { id: 'pants', name: 'Pants' },
    { id: 'back',  name: 'Back' },
    { id: 'hand',  name: 'Hand' }
  ];

  const byId = {};
  ITEMS.forEach(it => { byId[it.id] = it; });

  // The avatar everyone starts with (the same yellow, blue and navy as the Take a Tea character).
  const DEFAULT_AVATAR = {
    skin: '#F5CD30',
    face: 'face-smile',
    hair: 'hair-short', hairColor: '#4A2F1B',
    hat: null, hatColor: '#C0392B',
    shirt: 'tee', shirtColor: '#2D9BF0',
    pants: 'pants', pantsColor: '#2C3442',
    back: null, backColor: '#8B5A2B',
    hand: null
  };

  const Catalog = {
    APPS, SKINS, COLORS, ITEMS, SLOTS, DEFAULT_AVATAR,
    get: id => byId[id] || null,
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
    // Short noun for a slot, used in buttons: "Wear hat"
    slotName: slot => (SLOTS.find(s => s.id === slot) || {}).name || slot,
    // Make sure an avatar object only points at real items and sane colors.
    normalize(a) {
      const d = DEFAULT_AVATAR, o = Object.assign({}, d, a && typeof a === 'object' ? a : {});
      const hex = (v, f) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v.toUpperCase() : f;
      o.skin = hex(o.skin, d.skin);
      ['hairColor', 'hatColor', 'shirtColor', 'pantsColor', 'backColor'].forEach(k => { o[k] = hex(o[k], d[k]); });
      ['face', 'hair', 'hat', 'shirt', 'pants', 'back', 'hand'].forEach(slot => {
        const it = byId[o[slot]];
        if (!it || it.slot !== slot) o[slot] = (slot === 'face' || slot === 'shirt' || slot === 'pants') ? d[slot] : (slot === 'hair' ? (o[slot] === null ? null : d.hair) : null);
      });
      return o;
    },
    // A stable string for caching renders of one look.
    hash(a) { a = Catalog.normalize(a); return [a.skin, a.face, a.hair, a.hairColor, a.hat, a.hatColor, a.shirt, a.shirtColor, a.pants, a.pantsColor, a.back, a.backColor, a.hand].join('|'); }
  };

  root.GrugCatalog = Catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = Catalog;
})(typeof window !== 'undefined' ? window : globalThis);
