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
    crafthouse: { n: 'R&R CraftHouse Grill', short: 'CraftHouse', color: '#CFAC52', i: 'hamburger', f: 'f', logo: 'play/crafthouse/logo.png', app: 'play/crafthouse/', game: 'crafthouse', demo: true }
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
  if (sitePage) document.documentElement.classList.add('g-site');
  // partner mode: no Home and no Make (the pitch pages and tools for shops and creators); those addresses go to Games
  if (brand && brand.p && sitePage) {
    try { const rootPath = new URL(me ? me.replace(/assets\/theme\.js(\?.*)?$/, '') : '/', location.href).pathname, rel = location.pathname.slice(rootPath.length);
      if (/^(index\.html)?$|^(make|create|links|partners)(\/|$)|^rewards(\/|\/index\.html|\/create(\/.*)?)?$/.test(rel)) location.replace(rootPath + 'games/'); } catch (e) {}
    document.documentElement.setAttribute('data-partner', brand.p);
  }
  if (sitePage && SECTIONS[section].fog) {
    document.documentElement.classList.add('g-fogged');
    try { if (me) { const s = document.createElement('script'); s.src = me.replace(/theme\.js(\?.*)?$/, 'fogbg.js'); s.defer = true; document.head.appendChild(s); } } catch (e) {}
  } else if (sitePage && !SECTIONS[section].solid && !brand) {
    document.documentElement.classList.add('g-patterned');
    try { if (me) document.documentElement.style.setProperty('--pattern', 'url("' + me.replace(/theme\.js(\?.*)?$/, 'patterns/' + (SECTIONS[section].pat || section) + '.png?v=2') + '")'); } catch (e) {}
  }
  function apply() {
    const s = prefs(), t = SECTIONS[section], el = document.documentElement;
    // the Games section is a dark stage (the fog) in both modes
    const mode = t.fog ? 'dark' : s.mode, bg = mode === 'light' ? '#F3F3F5' : '#17171A';
    const ac = accent();
    el.setAttribute('data-theme', mode); el.setAttribute('data-mode-pref', s.mode); el.setAttribute('data-section', section);
    el.classList.toggle('g-chrome-light', s.mode === 'light' && mode === 'dark');   // Games in light mode: dark stage, light top bar and dock
    el.setAttribute('data-role', s.role);   // who's visiting (Settings → I'm a…): pages show or hide parts with [data-only-for] / [data-hide-for]
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
    m.content = t.fog ? '#03050f' : bg;
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
