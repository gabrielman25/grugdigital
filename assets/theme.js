/* Grug · theme.js — the look, matched to Model Kit: dark #17171A (or light #F3F3F5, Settings → Light mode) with a static
   pixel pattern, and each section of the site owns one accent colour (like Model Kit's modes): Home lime, Games green,
   Create teal, Avatar purple, Shop yellow, Profile pink, Rewards orange, Links blue. The accent fills the active dock tab,
   primary buttons, switches and highlights, and tints the pattern. Text on an accent is #1E1B16 (white on a dark one). Light is the default.
   The blue smoky fog (fogbg.js) is only for the Games section, which stays a dark stage in light mode, with the
   top bar, dock and menus still light (html.g-chrome-light).

   SHOP MODE (Ziosk-style). A guest who arrives from a shop's rewards card link (rewards/card/#c=…, the printed QR or
   NFC sticker) sees the whole site wear that shop's name, emoji and colour while they browse and play. It lives in
   sessionStorage 'grug.brand.v1' and ends on a refresh, when the site is opened normally (typed, bookmarked or from
   another site, not from a page of ours), or from Settings → Leave. Pages read it with GrugTheme.brand().
   PARTNER MODE (CraftHouse mode). A full partner's own link (crafthouse/ for R&R CraftHouse Grill, or ?partner=<id> on any
   page) does the same with the partner's real logo pinned in the top bar, and trims the site to playing and dressing up:
   the dock is just Games and Me, and Home and Make send the guest to Games. Unlike shop mode it survives a refresh (a guest
   at the table stays in it); it ends when the tab closes, when the site is opened normally, or from Settings → Leave.
   Partners are listed in PARTNERS below.
   Load it in <head> (no defer) right after grug.css so the look is set before the first paint.
   Choices live in the profile (grug.profile.v1 → prefs), so they travel with Profile → Export like everything else.
*/
(function (root) {
  'use strict';
  const KEY = 'grug.profile.v1';
  const HUE = 228;   // the fog's blue (Games only)
  const INK = '#1E1B16';
  // a = accent, lo = its pressed/shadow shade, pattern = assets/patterns/<id>.png (pre-tinted, 96px), fog = Games
  const SECTIONS = {
    home: { name: 'Home', a: '#9BE338', lo: '#6FB31C' },
    games: { name: 'Games', a: '#7EE081', lo: '#4FB357', fog: true },
    create: { name: 'Create', a: '#4FD8C4', lo: '#25A893' },
    avatar: { name: 'Avatar', a: '#C59BFF', lo: '#9A6FE0' },
    shop: { name: 'Shop', a: '#FFBE1A', lo: '#D99A00' },
    profile: { name: 'Profile', a: '#FF8FC2', lo: '#E0669E' },
    // the dock's groups have a page each (a list of where to go); they borrow a member's pattern
    me: { name: 'Me', a: '#FF8FC2', lo: '#E0669E', pat: 'profile' },
    make: { name: 'Make', a: '#4FD8C4', lo: '#25A893', pat: 'create' },
    // solid: plain #17171A behind the page, no pattern tile
    rewards: { name: 'Rewards', a: '#FF9F5A', lo: '#E0782F', solid: true },
    links: { name: 'Links', a: '#5AB0FF', lo: '#2F86D6', solid: true },
    website: { name: 'Website', a: '#5AB0FF', lo: '#2F86D6', solid: true },   // the restaurant account's website editor (business/site/)
    pearls: { name: 'Pearls', a: '#C59BFF', lo: '#9A6FE0' }
  };
  // the lights that drift through the Games fog
  const ORBS = ['#9be338', '#ffd23f', '#5ab0ff', '#e8f0ff', '#7EE081', '#ffd23f', '#5ab0ff'];
  const DEFAULTS = { backdrop: true, motion: true };
  const BRAND_KEY = 'grug.brand.v1', BRAND_KEEP = 'grug.brand.keep';
  const calmMQ = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function prefs() {
    let p = {};
    try { p = (JSON.parse(localStorage.getItem(KEY) || 'null') || {}).prefs || {}; } catch (e) { }
    if (root.Grug && root.Grug.profile) p = root.Grug.profile.prefs || p;
    return { mode: p.mode === 'dark' ? 'dark' : 'light', backdrop: p.backdrop !== false, motion: p.motion !== false, role: /^(player|owner|dev|creator|all)$/.test(p.role) ? p.role : 'all' };
  }
  const isCalm = s => !s.motion || !!(calmMQ && calmMQ.matches);
  function sectionOf(path) {
    if (/\/business\/site(\/|$)/.test(path)) return 'website';
    if (/\/rewards(\/|$)/.test(path)) return 'rewards';
    if (/\/links(\/|$)/.test(path)) return 'links';   // creators' link pages (links/create/ is not the Create tab either)   // before the others: rewards/create/ is not the Create tab
    const m = /\/(games|create|avatar|shop|profile|me|make)(\/|$)/.exec(path); if (m) return m[1];
    if (/\/pearls(\.html)?$/.test(path)) return 'pearls';
    return 'home';
  }
  let section = 'home';
  try { section = sectionOf(location.pathname); } catch (e) {}

  /* ---------- shop mode ---------- */
  // the shop's lettering (the same list as GrugRewards.FONTS; families in assets/shop-fonts.css): it sets the headings
  // the shop's icon id (a flat icon, 'sh-<id>' in icons.js); older links carried an emoji (the same map as rewards.js)
  const OLD_ICON = { '☕': 'coffee', '🧋': 'pint-glass', '🍵': 'tea-bag', '🍺': 'beer-stein', '🍷': 'wine', '🍸': 'martini', '🌮': 'pepper', '🍕': 'pizza', '🍔': 'hamburger',
    '🍣': 'fish', '🍜': 'bowl-steam', '🥗': 'leaf', '🍩': 'cookie', '🥐': 'bread', '🧁': 'cake', '🍦': 'ice-cream', '⭐': 'star' };
  const SHOP_ICON = v => { v = String(v || '').replace(/\uFE0F/g, ''); return /^[a-z-]{2,20}$/.test(v) ? v : OLD_ICON[v] || 'storefront'; };
  const SHOP_FONTS = { f: null, l: 'Shop Lora', h: 'Shop Patrick Hand', o: 'Shop Oswald', p: 'Shop Playfair', b: 'Shop Lilita', r: 'Shop Righteous', m: 'Shop Outfit' };
  // full partners with their own branded version of the site (partner mode): logo and app paths are from the site root
  const PARTNERS = {
    crafthouse: { n: 'R&R CraftHouse Grill', short: 'CraftHouse', color: '#CFAC52', i: 'hamburger', f: 'f', logo: 'play/crafthouse/logo.png', barLogo: 'play/crafthouse/logo-bar.png', app: 'play/crafthouse/', game: 'crafthouse', demo: true,
      // the look on the site: the coin in the top bar, the typeface ("Partner Font") and the colours (--p-* in grug.css)
      coin: 'play/crafthouse/coin.png', font: 'play/crafthouse/bricolage.woff2', colors: { accent: '#CFAC52', deep: '#24383f', cream: '#fbf4ea', page: '#F8F5EE' },
      wallet: { key: 'rr-crafthouse-gameday-v1', field: 'coins', label: 'Craft Coins', to: '#store', rate: 25 },   // the app's own coins, shown in the top bar
      // the app's own tab bar: the only navigation on every page in partner mode (grug.js). [id, label, icon, link]: '' or '#…' is
      // in the partner's app, anything else is a site path. Play is the site's game list (the partner's game plus Grug originals).
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'meat', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } },
    // Demo made to pitch Coco Crepes, Waffles & Coffee (Katy): its rewards app (play/coco/, built from tools/partner-app/partners/coco/)
    // has no game of its own yet (no `game`), so partner mode lists the Grug originals only. fontDisplay: a second face for headings.
    coco: { n: 'Coco Crepes, Waffles & Coffee', short: 'Coco', color: '#E5BD2F', i: 'coffee', f: 'f', logo: 'play/coco/logo.png', barLogo: 'play/coco/logo-bar.png', app: 'play/coco/', demo: true,
      coin: 'play/coco/coin.png', font: 'play/coco/montserrat.woff2', fontDisplay: 'play/coco/frank-ruhl-libre.woff2', colors: { accent: '#E5BD2F', deep: '#533020', cream: '#fbf3e4', page: '#FBF7EF' },
      wallet: { key: 'coco-crepes-crepeclub-v1', field: 'coins', label: 'Coco Coins', to: '#store', rate: 25 },
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'cup', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } },
    // Teahouse Express (Katy Mills): its rewards app (play/teahouse/, partners/teahouse/) and its standalone games Steal a Sip and Take a Tea.
    teahouse: { n: 'Teahouse Express', short: 'Teahouse', color: '#F6C445', i: 'pint-glass', f: 'f', logo: 'play/teahouse/logo.png', barLogo: 'play/teahouse/logo-bar.png', app: 'play/teahouse/', game: 'teahouse', demo: true,
      coin: 'play/teahouse/coin.png', font: 'play/teahouse/nunito.woff2', fontDisplay: 'play/teahouse/fredoka.woff2', colors: { accent: '#F6C445', deep: '#1E6B35', cream: '#FBF7EC', page: '#FBF7EC' },
      wallet: { key: 'teahouse-express-teaclub-v1', field: 'coins', label: 'Teahouse Coins', to: '#store', rate: 25 },
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'cup', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } },
    // Soluna Coffee (Elyson): its rewards app (play/soluna/, partners/soluna/) and its standalone game Sunrise to Sunset (play/sunrise/).
    soluna: { n: 'Soluna Coffee', short: 'Soluna', color: '#C8924F', i: 'coffee', f: 'f', logo: 'play/soluna/logo.png', barLogo: 'play/soluna/logo-bar.png', app: 'play/soluna/', game: 'soluna', demo: true,
      coin: 'play/soluna/coin.png', font: 'play/soluna/jost.woff2', fontDisplay: 'play/soluna/fraunces.woff2', colors: { accent: '#C8924F', deep: '#5F5C37', cream: '#F6F1E7', page: '#F8F4EC' },
      wallet: { key: 'soluna-coffee-club-v1', field: 'coins', label: 'Soluna Coins', to: '#store', rate: 25 },
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'cup', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } },
    // Rodeo Express Car Wash (Peek Rd): its rewards app (play/rodeo/, partners/rodeo/) and its standalone game Rodeo Wash Simulator (play/rodeowash/).
    rodeo: { n: 'Rodeo Express Car Wash', short: 'Rodeo', color: '#E39B32', i: 'storefront', f: 'f', logo: 'play/rodeo/logo.png', barLogo: 'play/rodeo/logo-bar.png', app: 'play/rodeo/', game: 'rodeo', demo: true,
      coin: 'play/rodeo/coin.png', font: 'play/rodeo/archivo.woff2', fontDisplay: 'play/rodeo/rye.woff2', colors: { accent: '#E39B32', deep: '#4B3A2C', cream: '#FBF3E6', page: '#FAF5EC' },
      wallet: { key: 'rodeo-express-wash-club-v1', field: 'coins', label: 'Rodeo Coins', to: '#store', rate: 25 },
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'car', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } },
    // Alchemy Bake Lab (Peek Rd): its rewards app (play/alchemy/, partners/alchemy/) and its standalone game Sugar Alchemist (play/sugaralchemist/). A typewriter wordmark stands in for the real logo until the owner says yes.
    alchemy: { n: 'Alchemy Bake Lab', short: 'Alchemy', color: '#C2A26B', i: 'cake', f: 'f', logo: 'play/alchemy/logo.png', barLogo: 'play/alchemy/logo-bar.png', app: 'play/alchemy/', game: 'alchemy', demo: true,
      coin: 'play/alchemy/coin.png', font: 'play/alchemy/karla.woff2', fontDisplay: 'play/alchemy/special-elite.woff2', colors: { accent: '#C2A26B', deep: '#1E1F21', cream: '#F3F1EA', page: '#F6F5F0' },
      wallet: { key: 'alchemy-bake-lab-labclub-v1', field: 'coins', label: 'Alchemy Coins', to: '#store', rate: 25 },
      bar: [['home', 'Home', 'house', ''], ['menu', 'Menu', 'alembic', '#menu'], ['play', 'Play', 'controller', 'games/'], ['pass', 'Pass', 'trophy', '#pass'], ['store', 'Coins', 'coins', '#store']], barOn: { games: 'play' } }
  };
  const partnerBrand = id => PARTNERS[id] ? Object.assign({ p: id, at: Date.now() }, PARTNERS[id]) : null;
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  // a shop's setup from its card link (the same text assets/rewards.js writes): name, colour and emoji are all we need here
  function brandFrom(c) {
    try {
      const t = decodeURIComponent(escape(atob(String(c).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(c).length + 3) % 4)))).split('~');
      if (t[0] !== '2' || t.length < 8) return null;
      const color = /^[0-9a-f]{6}$/i.test(t[3]) ? '#' + t[3].toUpperCase() : '#4FD8C4';
      return { c: String(c), n: String(t[1] || 'Your shop').slice(0, 28), color, i: SHOP_ICON(t[4]), f: SHOP_FONTS[t[8]] ? t[8] : 'f', at: Date.now() };
    } catch (e) { return null; }
  }
  let brand = null;
  (function decideBrand() {
    let nav = 'navigate', fromSite = false;
    try { const e = performance.getEntriesByType('navigation')[0]; if (e && e.type) nav = e.type; } catch (e) {}
    try { fromSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    const keep = ss.get(BRAND_KEEP); ss.del(BRAND_KEEP);
    let was = null; try { was = JSON.parse(ss.get(BRAND_KEY) || 'null'); } catch (e) {}
    const wasPartner = !!(was && was.p && PARTNERS[was.p]);
    // a refresh ends shop mode (not partner mode); opening the site normally ends both
    if (!keep && ((nav === 'reload' && !wasPartner) || (nav === 'navigate' && !fromSite))) ss.del(BRAND_KEY);
    // a partner's link starts partner mode: ?partner=<id> (crafthouse/ forwards here with it); the address is tidied after
    try {
      const q = new URLSearchParams(location.search), pid = q.get('partner');
      if (pid && PARTNERS[pid]) { ss.set(BRAND_KEY, JSON.stringify(partnerBrand(pid))); q.delete('partner');
        const s = q.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); }
    } catch (e) {}
    // arriving on a shop's card link starts it (not on a refresh of that page)
    try {
      if (/\/rewards\/card\/?$/.test(location.pathname) && (nav !== 'reload' || keep)) {
        const c = new URLSearchParams(location.hash.slice(1)).get('c'), b = c && brandFrom(c);
        if (b) ss.set(BRAND_KEY, JSON.stringify(b));
      }
    } catch (e) {}
    try { const b = JSON.parse(ss.get(BRAND_KEY) || 'null');
      if (b && b.p) brand = partnerBrand(b.p);   // partner mode: always the partner's current setup
      else if (b && b.c && /^#[0-9A-F]{6}$/i.test(b.color)) { b.i = SHOP_ICON(b.i); brand = b; } } catch (e) {}
  })();

  // the tab's name says the shop's name, not ours (pages that set their own title later are caught too)
  function brandTitle() {
    try { if (!brand || !sitePage || !document.title) return; let t = document.title;
      if (/\bGrug\b/.test(t)) t = t.split(' · ').map(x => x.replace(/\bGrug\b/g, brand.n)).filter((x, i, a) => a.indexOf(x) === i).join(' · ');   // no "Boba Bliss · … · Boba Bliss"
      else if (t.indexOf(brand.n) < 0) t += ' · ' + brand.n;
      if (t !== document.title) document.title = t; } catch (e) {} }
  try { const te = document.querySelector('title'); if (te) new MutationObserver(brandTitle).observe(te, { childList: true, characterData: true, subtree: true }); } catch (e) {}

  /* ---------- colour helpers ---------- */
  const rgb = h => { const v = parseInt(String(h).replace('#', ''), 16) || 0; return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const toHex = a => '#' + a.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (h, to, k) => { const a = rgb(h), b = rgb(to); return toHex(a.map((x, i) => x + (b[i] - x) * k)); };
  const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  // the accent as text or a thin line on the page: nudged until it reads clearly on this background
  function readable(c, bg) { let t = c; for (let i = 0; i < 8 && contrast(t, bg) < 3.2; i++) t = mix(t, lum(bg) > .5 ? '#000000' : '#FFFFFF', .14 * (i + 1)); return t; }
  const inkOn = c => contrast(c, INK) >= contrast(c, '#FFFFFF') ? INK : '#FFFFFF';
  // the accent of this page: the section's own, or the shop's colour in shop mode
  function accent() {
    if (brand) return { a: brand.color, lo: mix(brand.color, '#000000', .22) };
    const t = SECTIONS[section]; return { a: t.a, lo: t.lo };
  }

  // a swipe (or Q / E) to the next or previous dock tab: the new page slides in from that side (grug.css). Read again when a
  // page made ahead of time (prerendered) is shown, since the swipe happened after it was made.
  function swipeIn() {
    const d = ss.get('grug.swipe'); if (!d) return; ss.del('grug.swipe');
    const el = document.documentElement; el.classList.add('g-swipe-' + d);
    setTimeout(() => el.classList.remove('g-swipe-next', 'g-swipe-prev'), 700);
  }
  swipeIn(); root.addEventListener('pagereveal', swipeIn);

    // browsers without cross-page View Transitions get a short fade instead (grug.js marks the way out)
  try { if (!('onpagereveal' in root)) { document.documentElement.classList.add('g-fade'); if (sessionStorage.getItem('grug.nav')) { sessionStorage.removeItem('grug.nav'); document.documentElement.classList.add('g-arrive'); } } } catch (e) {}
  // pages with the Grug top bar and dock: draw their skeletons right away (grug.css), so nothing jumps when they arrive
  try { if (!/[?&]mode=viewer/.test(location.search) && !/\/(play|work)\//.test(location.pathname)) document.documentElement.classList.add('g-pre'); } catch (e) {}
  // backdrop: the fog for the Games section, a pixel pattern everywhere else (not the games themselves or embedded viewers)
  let sitePage = false;
  try { sitePage = !/[?&]mode=viewer/.test(location.search) && !/\/(play|work|tools|showcase)\//.test(location.pathname); } catch (e) {}
  const me = (document.currentScript && document.currentScript.src) || '';
  // the custom cursor on every page (assets/cursors.js; theme.js, grug.js or gamekit.js loads it, once)
  try { if (!root.GrugCursors && !document.getElementById('grug-cursors-js') && me) { const s = document.createElement('script'); s.id = 'grug-cursors-js'; s.src = new URL('cursors.js', me).href; (document.head || document.documentElement).appendChild(s); } } catch (e) {}
  if (sitePage) document.documentElement.classList.add('g-site');
  // the restaurant account has no home page: opening the site's home while it's the account in use opens the dashboard
  // (shop mode and partner mode always use the player account, so they never come here)
  if (!brand) { try { const b = JSON.parse(localStorage.getItem('grug.business.v1') || 'null');
    if (b && b.mode === 'business' && b.active && b.shops && b.shops[b.active]) {
      const home = new URL(me ? me.replace(/assets\/theme\.js(\?.*)?$/, '') : '/', location.href).pathname;
      if (location.pathname === home || location.pathname === home + 'index.html') location.replace(home + 'business/' + location.search); } } catch (e) {} }
  // partner mode is a closed space: only the game list, game pages and the avatar editor. Every other address
  // (Home, Make, Me, Shop, Profile, other partners' pages…) goes to the game list; grug.js also turns away game pages for
  // other partners' games. On a game's host page (play/…) the back button returns to the game list.
  if (brand && brand.p) {
    let rootPath = '/';
    try { rootPath = new URL(me ? me.replace(/assets\/theme\.js(\?.*)?$/, '') : '/', location.href).pathname; } catch (e) {}
    if (sitePage) { try { const rel = location.pathname.slice(rootPath.length);
      if (!/^games(\/|$)|^avatar(\/|$)|^rewards\/card(\/|$)/.test(rel)) location.replace(rootPath + 'games/'); } catch (e) {} }
    // a game's host page: Back returns to wherever the game was started (the partner's app, or the game list). The app
    // and the site's pages note that place (grug.partner.back) as a game launches; the game list if nothing was noted.
    else if (/\/play\//.test(location.pathname)) document.addEventListener('DOMContentLoaded', () => { const a = document.getElementById('rrBack'); if (!a) return;
      const back = ss.get('grug.partner.back'), ok = !!back && back.indexOf(rootPath) === 0;
      a.href = ok ? back : rootPath + 'games/'; a.setAttribute('aria-label', ok && back.indexOf(rootPath + (PARTNERS[brand.p].app || '')) === 0 ? 'Back to the ' + (PARTNERS[brand.p].short || '') + ' app' : 'Back to the games'); });
    if (sitePage) addEventListener('fossil32:play', () => ss.set('grug.partner.back', location.pathname + location.search));
    document.documentElement.setAttribute('data-partner', brand.p);
    // its look: colours as --p-* (grug.css), the top bar's coin, and its typeface as "Partner Font"
    try { const P = PARTNERS[brand.p], C = P.colors || {}, st = document.documentElement.style;
      [['accent', '--p-accent'], ['deep', '--p-deep'], ['cream', '--p-cream'], ['page', '--p-page']].forEach(([k, v]) => { if (C[k]) st.setProperty(v, C[k]); });
      if (P.coin) st.setProperty('--p-coin', 'url("' + rootPath + P.coin + '")');
      if (P.font) { const f = document.createElement('style'); f.textContent = '@font-face{font-family:"Partner Font";src:url("' + rootPath + P.font + '") format("woff2");font-weight:200 800;font-display:swap}' +
        (P.fontDisplay ? '@font-face{font-family:"Partner Display";src:url("' + rootPath + P.fontDisplay + '") format("woff2");font-weight:200 800;font-display:swap}' : ''); document.head.appendChild(f); } } catch (e) {}
    if (sitePage) queueMicrotask(() => partnerChrome(brand, rootPath));   // once this script has finished (the icons below are defined)
  }
  // Games: the blue fog in dark mode, a plain page in light mode (partner mode is always light); the cubes in both
  const fogOn = !!SECTIONS[section].fog;
  if (sitePage && fogOn) {
    document.documentElement.classList.add('g-fogged');
    try { if (me) { const s = document.createElement('script'); s.src = me.replace(/theme\.js(\?.*)?$/, 'fogbg.js'); s.defer = true; document.head.appendChild(s); } } catch (e) {}
  } else if (sitePage && !SECTIONS[section].solid && !brand) {
    document.documentElement.classList.add('g-patterned');
    try { if (me) document.documentElement.style.setProperty('--pattern', 'url("' + me.replace(/theme\.js(\?.*)?$/, 'patterns/' + (SECTIONS[section].pat || section) + '.png?v=2') + '")'); } catch (e) {}
  }
  /* partner mode's top bar and tab bar, put into the page the moment <body> exists (before anything is drawn), so every
     page shows exactly the same bars as the partner's app: same markup and styles (.ptb, .g-pbar), same avatar picture
     (the site's saved one), the app's own coin balance. grug.js wires them up (account menu, full screen). */
  // the partner app tab bar's icons (@icons, MIT): the same ones the partner app draws, so the bar looks identical
  const PBAR_ICONS = {
    expand: '<path fill="currentColor" d="M5.293 9.293a1 1 0 1 1 1.414 1.414L4.414 13H5a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1v-3a1 1 0 1 1 2 0v.586zM9.293 9.293a1 1 0 0 1 1.414 0L13 11.586V11a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1h-3a1 1 0 1 1 0-2h.586l-2.293-2.293a1 1 0 0 1 0-1.414M5 1a1 1 0 0 1 0 2h-.586l2.293 2.293a1 1 0 1 1-1.414 1.414L3 4.414V5a1 1 0 0 1-2 0V2a1 1 0 0 1 1-1zM14 1a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.586l-2.293 2.293a1 1 0 1 1-1.414-1.414L11.586 3H11a1 1 0 1 1 0-2z"/>',
    plus: '<path fill="currentColor" d="M8 1a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2H9v5a1 1 0 1 1-2 0V9H2a1 1 0 0 1 0-2h5V2a1 1 0 0 1 1-1"/>',
    house: '<path fill="currentColor" d="M7.316 1.14a1 1 0 0 1 1.368 0l6.394 5.995a.5.5 0 0 1-.342.865H13v7h-3v-3a2 2 0 0 0-4 0v3H3V8H1.264a.5.5 0 0 1-.341-.865z"/>',
    cup: '<path fill="currentColor" d="M14.333 12c.368 0 .667.299.667.667 0 .736-.597 1.333-1.333 1.333H2a1 1 0 1 1 0-2zM11 2a1 1 0 0 1 1 1v1h1a2 2 0 0 1 .204 3.99L13 8h-1.126A4.002 4.002 0 0 1 4 7V3a1 1 0 0 1 1-1zm1 5h1a1 1 0 1 0 0-2h-1z"/>',
    meat: '<path fill="currentColor" d="M5.043 9.457a3.75 3.75 0 0 0 1.5 1.5L5 12.5V14a1 1 0 0 1-2 0v-1H2a1 1 0 0 1 0-2h1.5zM8.608.867C9.613.715 11.688.687 13.5 2.5c1.812 1.811 1.786 3.886 1.634 4.891-.061.402-.309.74-.634.984l-.884.663a7.32 7.32 0 0 1-5.823 1.32 2.74 2.74 0 0 1-2.151-2.151 7.32 7.32 0 0 1 1.32-5.824l.663-.883c.244-.326.581-.572.983-.633m4.22 2.547c-.78-.78-1.73-1.098-2.121-.707-.39.39-.074 1.34.707 2.12.78.782 1.73 1.099 2.121.709.39-.39.074-1.341-.707-2.122"/>',
    car: '<path fill="currentColor" d="M4.5 11a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M11.5 11a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3"></path> <path fill="currentColor" d="M9.323 3a1 1 0 0 1 .928.629L12 8l2.316.772a1 1 0 0 1 .684.949V12h-1.05a2.501 2.501 0 0 0-4.9 0h-2.1a2.501 2.501 0 0 0-4.9 0H1V8.192a1 1 0 0 1 .071-.37L2.75 3.628A1 1 0 0 1 3.677 3zM2 8h4V4H3.5zm5 0h4L9.5 4H7z"></path>',
    alembic: '<path fill="currentColor" d="M10 10a1 1 0 0 1 .114 1.993l.78 1.56a1 1 0 0 1-1.789.894L7.882 12H4.118l-1.224 2.447a1 1 0 0 1-1.789-.894l.78-1.56A1 1 0 0 1 2 10zM6.31 1.01C10.69 1.23 14.972 5.97 15 6l-1 2-3.024-1.513A5 5 0 0 1 9.999 9h-8a5 5 0 0 1 4.31-7.99"></path>',
    controller: '<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.26 3a3 3 0 0 1 2.988 2.729l.57 6.264a1.84 1.84 0 0 1-3.364 1.188L11 11H5l-1.454 2.18a1.84 1.84 0 0 1-3.364-1.187l.57-6.264A3 3 0 0 1 3.74 3zM12 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2M4 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2-2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>',
    trophy: '<path fill="currentColor" d="M12.91 2H15a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3h-.636l-.002.017A4.38 4.38 0 0 1 9 11.884V13h2l1 1v1H4v-1l1-1h2v-1.116a4.38 4.38 0 0 1-3.362-3.867L3.636 8H3l-.154-.004A3 3 0 0 1 0 5V3a1 1 0 0 1 .897-.995L1 2h2.09L3 1h10zM2 5a1 1 0 0 0 1 1h.454l-.182-2H2zm10.546 1H13a1 1 0 0 0 1-1V4h-1.273z"/>',
    coins: '<path fill="currentColor" d="M14 13c0 1.105-2.239 2-5 2s-5-.895-5-2v-.363q.445.117.923.197a12.8 12.8 0 0 0 3.076.127q.49.037 1.001.039c1.475 0 2.857-.237 3.907-.657.395-.158.77-.354 1.093-.594zM2 8.749c.322.24.698.436 1.093.594C4.143 9.763 5.525 10 7 10q.51-.001 1-.04.496.04 1 .04c.708 0 1.413-.056 2.077-.166q.478-.08.923-.197V10c0 1.105-2.239 2-5 2s-5-.895-5-2zM14 7c0 1.105-2.239 2-5 2s-5-.895-5-2V5.749c.32.238.695.435 1.093.594a9 9 0 0 0 1.83.491C7.587 6.944 8.293 7 9 7c.708 0 1.413-.056 2.077-.166a9 9 0 0 0 1.83-.491c.398-.16.773-.356 1.093-.594z"/><path fill="currentColor" d="M9 2c2.761 0 5 .895 5 2 0 .262-.129.522-.38.766-.252.242-.62.462-1.085.648a8 8 0 0 1-1.622.434C10.306 5.948 9.656 6 9 6s-1.307-.052-1.913-.152a8 8 0 0 1-1.622-.434C5 5.228 4.632 5.008 4.38 4.766 4.129 4.522 4 4.262 4 4c0-1.105 2.239-2 5-2M8 5h2V3H8z"/>'
  };
  function partnerChrome(p, rootPath) {
    const R = (me ? me.replace(/assets\/theme\.js(\?.*)?$/, '') : rootPath), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let face = R + 'assets/sandy/bust.png'; try { const s = JSON.parse(localStorage.getItem('grug.sandy.snaps.v1') || 'null'); if (s && s.bust) face = s.bust; } catch (e) {}
    let coins = 0; try { const w = p.wallet && JSON.parse(localStorage.getItem(p.wallet.key) || 'null'); coins = Math.max(0, Math.floor(+(w && w[p.wallet.field]) || 0)); } catch (e) {}
    const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled), svg = n => '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' + (PBAR_ICONS[n] || '') + '</svg>';
    // every wrap is a demonstration until the business signs off (assets/demo.js): its notice and chip go on every
    // wrapped page, and the coin balance is left off the bar because nothing is earned or spent
    const FROZEN = !(window.GRUG_DEMO && window.GRUG_DEMO.isLive(p.p));
    if (FROZEN) { document.documentElement.style.setProperty('--gd-lift', '84px');
      const note = () => window.GRUG_DEMO && window.GRUG_DEMO.install(p.n, p.p);
      if (window.GRUG_DEMO) note(); else { const sc = document.createElement('script'); sc.src = R + 'assets/demo.js'; sc.onload = note; document.head.appendChild(sc); } }
    const top = document.createElement('header'); top.className = 'g-top ptb';
    top.innerHTML = '<a class="ptb-logo" href="' + R + p.app + '" aria-label="' + esc(p.n) + ' home"><img src="' + R + (p.barLogo || p.logo) + '" alt="' + esc(p.n) + '">' + (p.demo || FROZEN ? '<span class="ptb-demo" title="A demonstration only. Not affiliated with or endorsed by this business.">Demo</span>' : '') + '</a><span class="ptb-sp"></span>' +
      (p.wallet && !FROZEN ? '<a class="ptb-wallet" href="' + R + p.app + p.wallet.to + '" aria-label="' + esc(p.wallet.label) + '"><i class="ptb-coin"></i><span>' + coins.toLocaleString('en-US') + '</span><span class="ptb-plus">' + svg('plus') + '</span></a>' : '') +
      (fsOk ? '<button type="button" class="g-fs ptb-fs" aria-label="Full screen" aria-pressed="false">' + svg('expand') + '</button>' : '') +
      '<button type="button" class="g-me ptb-av" aria-label="Your account menu" aria-haspopup="menu" aria-expanded="false" style="background-image:url(&quot;' + esc(face) + '&quot;)"></button>';
    const bar = document.createElement('nav'); bar.className = 'g-pbar'; bar.setAttribute('aria-label', (p.short || p.n) + ' app');
    const lit = (p.barOn || {})[section];
    bar.innerHTML = (p.bar || []).map(([id, label, ic, to]) => '<a href="' + (/^#|^$/.test(to) ? R + p.app + to : R + to) + '"' + (id === lit ? ' aria-current="page"' : '') + '>' + svg(ic) + '<span>' + esc(label) + '</span></a>').join('');
    const put = () => { if (!document.body) return false; if (!document.querySelector('header.ptb')) document.body.prepend(top); if (!document.querySelector('.g-pbar')) document.body.appendChild(bar); return true; };
    if (!put()) new MutationObserver((m, o) => { if (put()) o.disconnect(); }).observe(document.documentElement, { childList: true });
  }
  function apply() {
    const s = prefs(), t = SECTIONS[section], el = document.documentElement;
    // the Games section is a dark stage (the fog) in both modes
    const mode = brand && brand.p ? 'light' : s.mode, fog = t.fog && mode === 'dark', bg = mode === 'light' ? (brand && brand.p ? ((PARTNERS[brand.p] || {}).colors || {}).page || '#F8F5EE' : '#F3F3F5') : '#17171A';
    const ac = accent();
    el.setAttribute('data-theme', mode); el.setAttribute('data-mode-pref', s.mode); el.setAttribute('data-section', section);
    el.classList.remove('g-chrome-light');   // (the Games page no longer forces a dark stage in light mode)   // Games in light mode: dark stage, light top bar and dock
    el.setAttribute('data-role', s.role);
    // which account is in use (assets/business.js): pages show or hide parts with [data-only-account="business"]
    try { const b = JSON.parse(localStorage.getItem('grug.business.v1') || 'null'); el.setAttribute('data-account', b && b.mode === 'business' && b.active && !brand ? 'business' : 'player'); } catch (e) { el.setAttribute('data-account', 'player'); }   // who's visiting (Settings → I'm a…): pages show or hide parts with [data-only-for] / [data-hide-for]
    if (brand) el.setAttribute('data-brand', ''); else el.removeAttribute('data-brand');
    el.style.setProperty('--h', HUE);
    el.style.setProperty('--sel-a', ac.a); el.style.setProperty('--sel-b', ac.a); el.style.setProperty('--on-sel', inkOn(ac.a));
    el.style.setProperty('--mode', ac.a); el.style.setProperty('--mode-lo', ac.lo); el.style.setProperty('--mode-text', readable(ac.a, bg));
    el.style.setProperty('--hot-a', '#FFBE1A'); el.style.setProperty('--hot-b', '#FF8FC2');
    if (brand) { el.style.setProperty('--brand', brand.color); el.style.setProperty('--brand-ink', inkOn(brand.color));
      const fam = SHOP_FONTS[brand.f];
      if (fam) { el.style.setProperty('--display', '"' + fam + '","Fredoka",system-ui,sans-serif'); el.setAttribute('data-brand-font', brand.f);
        if (!document.getElementById('g-shop-fonts') && me) { const l = document.createElement('link'); l.id = 'g-shop-fonts'; l.rel = 'stylesheet'; l.href = me.replace(/theme\.js(\?.*)?$/, 'shop-fonts.css'); document.head.appendChild(l); } } }
    el.classList.toggle('calm', isCalm(s));
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = fog ? '#03050f' : bg;   // (fog = Games in dark mode)
    // the tab's name says the shop's name, not ours
    brandTitle();
    try { document.dispatchEvent(new CustomEvent('grug:theme', { detail: { section, mode, brand } })); } catch (e) {}
    return s;
  }

  // the old wavy image backdrop is gone: drop its cached frame
  try { localStorage.removeItem('grug.bg.v1'); } catch (e) {}

  function set(patch) {
    if (root.Grug && root.Grug.profile) { Object.assign(root.Grug.profile.prefs, patch); root.Grug.save('prefs'); }
    else { try { const p = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; p.prefs = Object.assign(p.prefs || {}, patch); localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { } }
    apply();
  }

  apply();
  // another tab changed the profile (theme picked elsewhere) → follow it
  root.addEventListener('storage', e => { if (e.key === KEY) apply(); });
  root.addEventListener('grug:change', e => { const w = e.detail && e.detail.what; if (w === 'import' || w === 'reset' || w === 'external' || w === 'prefs') apply(); });

  /* ---------- the page scrollbar: a slim themed bar that floats over the page (the system one is hidden in grug.css),
     so content stays centred on the whole screen. Shows while scrolling or when the pointer is near; drag it or click its track. */
  function scrollbar() {
    if (document.querySelector('.k-sbar') || !document.body) return;
    const bar = document.createElement('div'); bar.className = 'k-sbar'; bar.setAttribute('aria-hidden', 'true');
    const th = document.createElement('i'); bar.appendChild(th); document.body.appendChild(bar);
    const se = document.scrollingElement || document.documentElement;
    let hideT = 0, drag = null, raf = 0;
    const geo = () => { const H = se.scrollHeight, V = innerHeight, T = bar.clientHeight, h = Math.max(36, T * V / Math.max(H, 1)); return { H, V, T, h, max: Math.max(1, H - V) }; };
    function paint() { raf = 0; const g = geo(), need = g.H > g.V + 2; bar.classList.toggle('need', need); th.style.display = need ? '' : 'none'; if (!need) return;
      th.style.height = g.h + 'px'; th.style.top = ((g.T - g.h) * (se.scrollTop / g.max)) + 'px'; }
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const show = () => { bar.classList.add('on'); clearTimeout(hideT); hideT = setTimeout(() => bar.classList.remove('on'), 900); };
    addEventListener('scroll', () => { queue(); show(); }, { passive: true });
    addEventListener('resize', queue); new ResizeObserver(queue).observe(document.body);
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && innerWidth - e.clientX < 22) show(); }, { passive: true });
    const jump = y => se.scrollTo({ top: y, behavior: 'instant' });
    th.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = { y: e.clientY, top: se.scrollTop }; bar.classList.add('hold'); th.setPointerCapture(e.pointerId); });
    th.addEventListener('pointermove', e => { if (!drag) return; const g = geo(); jump(drag.top + (e.clientY - drag.y) * g.max / Math.max(1, g.T - g.h)); });
    const end = () => { drag = null; bar.classList.remove('hold'); show(); };
    th.addEventListener('pointerup', end); th.addEventListener('pointercancel', end);
    bar.addEventListener('pointerdown', e => { if (e.target !== bar) return; const g = geo(), r = bar.getBoundingClientRect(), f = (e.clientY - r.top - g.h / 2) / Math.max(1, g.T - g.h); se.scrollTo({ top: f * g.max, behavior: 'smooth' }); show(); });
    paint();
  }
  if (document.body) scrollbar(); else document.addEventListener('DOMContentLoaded', scrollbar);

  // shop mode from a page: enter (the card page when its link changes), leave (Settings), keep across one reload
  function setBrand(c, reloadNext) { const b = brandFrom(c); if (!b) return null; ss.set(BRAND_KEY, JSON.stringify(b)); if (reloadNext) ss.set(BRAND_KEEP, '1'); brand = b; apply(); return b; }
  function leaveBrand() { ss.del(BRAND_KEY); ss.del(BRAND_KEEP); brand = null; }
  root.GrugTheme = { SECTIONS, ORBS, section: () => section, sectionOf, prefs, set, apply, accent, readable, inkOn,
    brand: () => brand, partner: () => (brand && brand.p ? brand : null), PARTNERS, setBrand, leaveBrand, isDark: () => document.documentElement.getAttribute('data-theme') !== 'light', kick: () => {} };
})(window);
