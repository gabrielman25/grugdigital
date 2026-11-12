/* Grug · grug.js — the shared core
   One local profile for the whole site (no accounts): name, avatar, closet, stats and settings live in this
   browser's localStorage under grug.profile.v1. Partner rewards apps keep their own points under their own keys;
   the profile export bundles all of them so a player can move to another phone.

   Load order on a page:  catalog.js → icons.js → games.js → grug.js
   Pages call Grug.ui.chrome('home') to get the shared header + tab bar.
*/
(function (root) {
  'use strict';
  const C = root.GrugCatalog, GAMES = root.GRUG_GAMES || [], ICONS = root.GRUG_ICONS || {};
  const KEY = 'grug.profile.v1', SNAP_KEY = 'grug.snaps.v1';
  const REWARDS_KEY = 'grug.rewards.v1';   // stamp cards from shops (rewards/), see assets/rewards.js
  /* ---------- who's visiting: picked once (askRole), kept in profile.prefs.role, changed in Settings ----------
     Each role sees only the dock tabs it needs ('' = not asked yet, 'all' = everything). A page reached by link still
     shows its own tab. theme.js puts the role on <html data-role> so pages can show or hide parts with
     [data-only-for="owner dev"] / [data-hide-for="owner"] (rules in grug.css). */
  const ROLES = {
    player: { label: 'Player', icon: 'game-controller', color: '#7EE081', text: 'Play games, earn rewards at shops and dress up your avatar', tabs: ['home', 'games', 'rewards', 'avatar', 'shop', 'profile'] },
    owner: { label: 'Restaurant owner', icon: 'storefront', color: '#FF9F5A', text: 'Make a free rewards card that brings guests back', tabs: ['home', 'games', 'rewards', 'profile'] },
    dev: { label: 'Game developer', icon: 'cube', color: '#4FD8C4', text: 'Free 3D models, Model Kit and the game library', tabs: ['home', 'games', 'create', 'avatar', 'shop', 'profile'] },
    creator: { label: 'Online creator', icon: 'camera', color: '#5AB0FF', text: 'Make a link page or a 3D world for your socials', tabs: ['home', 'games', 'links', 'avatar', 'shop', 'profile'] }
  };
  // tabs only some roles get; everyone else (and 'all') never sees them in the dock
  const ROLE_ONLY_TABS = { links: ['creator'] };
  const EXPORT_FORMAT = 'grug-profile';

  /* ---------- where the site lives (works from /, /grugdigital/, play/yoshi/, …) ---------- */
  const script = document.currentScript || Array.from(document.scripts).find(s => /grug\.js(\?|$)/.test(s.src));
  const ROOT = script ? script.src.replace(/assets\/grug\.js.*$/, '') : (location.origin + '/');
  const url = p => ROOT + String(p || '').replace(/^\/+/, '');

  /* ---------- small helpers ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const rid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const readJSON = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function storageWorks() { try { const k = '__grug_check'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return ok; } catch (e) { return false; } }

  /* NAMES · players pick one word from each list, plus an optional number (0–9999). No free text, so nobody can
     type a slur or anything else that would show up on screen or in the Discord feed. Only add words that are safe
     next to EVERY word in the other list (no colours, body words, or food words that double as insults). */
  const ADJ = ['Spicy', 'Sleepy', 'Mighty', 'Chill', 'Brave', 'Sunny', 'Turbo', 'Lucky', 'Cozy', 'Crunchy', 'Zesty', 'Golden', 'Sneaky', 'Jolly', 'Frosty', 'Rowdy',
    'Happy', 'Speedy', 'Fuzzy', 'Bouncy', 'Clever', 'Breezy', 'Snappy', 'Cheery', 'Toasty', 'Zippy', 'Witty', 'Sparkly', 'Mellow', 'Peppy', 'Plucky', 'Swift'];
  const NOUN = ['Kolache', 'Boba', 'Taco', 'Donut', 'Sushi', 'Latte', 'Cupcake', 'Dumpling', 'Pearl', 'Churro', 'Biscuit', 'Mango', 'Waffle', 'Pickle', 'Noodle', 'Pecan',
    'Panda', 'Otter', 'Dino', 'Falcon', 'Koala', 'Penguin', 'Tiger', 'Turtle', 'Pretzel', 'Muffin', 'Bagel', 'Lychee', 'Matcha', 'Mochi', 'Ramen', 'Pudding'];
  const NAME_MAX_NUM = 9999;
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const randomName = () => pickOf(ADJ) + ' ' + pickOf(NOUN);
  // 'Spicy Boba' or 'Spicy Boba 42' (built from the lists only)
  function makeName(adj, noun, num) {
    const a = ADJ.find(w => w.toLowerCase() === String(adj || '').toLowerCase()), n = NOUN.find(w => w.toLowerCase() === String(noun || '').toLowerCase());
    if (!a || !n) return '';
    const s = String(num == null ? '' : num).trim();
    if (s === '') return a + ' ' + n;
    if (!/^\d{1,4}$/.test(s) || +s > NAME_MAX_NUM) return '';
    return a + ' ' + n + ' ' + String(+s);
  }
  function parseName(name) { const m = /^\s*([A-Za-z]+)\s+([A-Za-z]+)(?:\s+(\d{1,4}))?\s*$/.exec(String(name == null ? '' : name)); return m && makeName(m[1], m[2], m[3]) ? { adj: m[1], noun: m[2], num: m[3] || '' } : null; }

  /* ---------- the profile ---------- */
  function fresh() {
    const now = Date.now();
    return {
      v: 1, id: rid(), name: randomName(), created: now, updated: now,
      avatar: C ? C.normalize(null) : {},
      inventory: [],            // earned (non-free) item ids
      earned: {},               // item id → {at, how}
      stats: { plays: {}, checkins: {}, best: {}, course: {}, days: {}, lastGame: '', lastPlayed: 0 },
      prefs: { motion: true, haptics: true, uiScale: 1, role: '', mode: 'light' },
      items: {},                // site-wide items (inventory on the settings page): item id → {n, at}; see ITEMS below
      emotes: EMOTE_DEFAULT.slice(),   // the emotes brought into games (ids from EMOTES, in wheel order)
      seen: {}                  // one-time hints
    };
  }
  /* ---------- emotes: played in any game you can walk around in (the emote wheel), picked in the avatar editor ----------
     anim = the SandyKit animation name (assets/sandy-runtime.js ANIMS). Everyone owns all of them; a loadout holds up to EMOTE_MAX. */
  const EMOTES = [
    { id: 'wave',   name: 'Wave',       anim: 'wave',    icon: 'hand-waving', hue: '#3b82f6' },
    { id: 'dance',  name: 'Groove',     anim: 'dance',   icon: 'sparkle',     hue: '#ec4899' },
    { id: 'disco',  name: 'Disco',      anim: 'disco',   icon: 'star',        hue: '#a855f7' },
    { id: 'shuffle', name: 'Shuffle',   anim: 'shuffle', icon: 'sneaker',     hue: '#22c55e' },
    { id: 'robot',  name: 'Robot',      anim: 'robot',   icon: 'lightning',   hue: '#06b6d4' },
    { id: 'cheer',  name: 'Cheer',      anim: 'cheer',   icon: 'confetti',    hue: '#f59e0b' },
    { id: 'bow',    name: 'Bow',        anim: 'bow',     icon: 'crown-simple', hue: '#f43f5e' },
    { id: 'flex',   name: 'Flex',       anim: 'flex',    icon: 'fire',        hue: '#f97316' },
    { id: 'jump',   name: 'Hop',        anim: 'jump',    icon: 'rocket',      hue: '#14b8a6' }
  ];
  const EMOTE_DEFAULT = ['wave', 'dance', 'cheer', 'bow'], EMOTE_MAX = 6;
  const emoteOf = id => EMOTES.find(e => e.id === id) || null;
  function normalize(p) {
    const f = fresh(); p = p && typeof p === 'object' ? p : {};
    const o = {
      v: 1, id: typeof p.id === 'string' && p.id ? p.id : f.id,
      name: cleanName(p.name) || f.name,
      created: +p.created || f.created, updated: +p.updated || f.created,
      avatar: C ? C.normalize(p.avatar) : (p.avatar || {}),
      inventory: Array.isArray(p.inventory) ? p.inventory.filter(id => typeof id === 'string' && C && C.get(id)) : [],
      earned: p.earned && typeof p.earned === 'object' ? p.earned : {},
      stats: Object.assign(f.stats, p.stats && typeof p.stats === 'object' ? p.stats : {}),
      prefs: Object.assign(f.prefs, p.prefs && typeof p.prefs === 'object' ? p.prefs : {}),
      items: p.items && typeof p.items === 'object' && !Array.isArray(p.items) ? p.items : {},
      emotes: Array.isArray(p.emotes) ? p.emotes.filter(id => emoteOf(id)).slice(0, EMOTE_MAX) : EMOTE_DEFAULT.slice(),
      seen: p.seen && typeof p.seen === 'object' ? p.seen : {}
    };
    ['plays', 'checkins', 'best', 'course', 'days'].forEach(k => { if (!o.stats[k] || typeof o.stats[k] !== 'object') o.stats[k] = {}; });
    o.inventory = Array.from(new Set(o.inventory));
    o.emotes = Array.from(new Set(o.emotes)); if (!o.emotes.length) o.emotes = EMOTE_DEFAULT.slice();
    o.prefs.uiScale = UI_SCALES.includes(+o.prefs.uiScale) ? +o.prefs.uiScale : 1;
    o.prefs.role = ROLES[o.prefs.role] || o.prefs.role === 'all' ? o.prefs.role : '';
    o.prefs.mode = o.prefs.mode === 'dark' ? 'dark' : 'light';   // light unless they picked dark
    delete o.prefs.colorIcons;   // the colourful icon pictures are gone: one flat icon style everywhere
    Object.keys(o.items).forEach(k => { const v = o.items[k]; if (!ITEMS[k] || !v || typeof v !== 'object' || !(+v.n > 0)) delete o.items[k]; else v.n = Math.min(ITEMS[k].max, Math.floor(+v.n)); });
    return o;
  }
  /* ---------- site-wide items: dropped by crates and eggs in every game, kept here, used from Settings (or wherever they're shown).
     max = how many can be held (1 = doesn't stack). use(id) runs the effect and takes one.
     free-shop: everything in the Shop catalog and every game store is free for 3 minutes; a timer shows at the top of the screen. */
  const UI_SCALES = [0.85, 1, 1.15, 1.3];
  const BOOST_KEY = 'grug.boost.v1';   // live effects, in their own key so games (iframes) and other tabs see them change
  const ITEMS = {
    'free-shop': { id: 'free-shop', name: 'Free Shop Token', icon: 'ticket', hue: '#f59e0b', max: 1, minutes: 3,
      desc: 'Everything in every shop is free for 3 minutes: the closet, Pearl power-ups, passes, the lot. Only one can be held at a time.',
      effect: 'freeShop' }
  };
  const ITEM_DROP = 0.06;   // chance each crate, egg or loot box in any game drops the token (when none is held)
  const boostRaw = () => { const b = readJSON(BOOST_KEY, null); return b && typeof b === 'object' ? b : {}; };
  const freeShopLeft = () => { const b = boostRaw(); return Math.max(0, Math.floor((+b.freeShopUntil || 0) - Date.now())); };
  const freeShop = () => freeShopLeft() > 0;
  const itemCount = id => +((profile.items[id] || {}).n) || 0;
  // true if one was added (a non-stacking item that's already held, or a full stack, says false)
  function grantItem(id, how) {
    const it = ITEMS[id]; if (!it) return false;
    const cur = profile.items[id] || { n: 0, at: 0 };
    if (cur.n >= it.max) return false;
    cur.n++; cur.at = Date.now(); cur.how = how || 'crate'; profile.items[id] = cur; save('items'); return true;
  }
  function useItem(id) {
    const it = ITEMS[id]; if (!it || itemCount(id) < 1) return false;
    if (it.effect === 'freeShop') {
      if (freeShop()) return false;    // one at a time: wait for the timer
      const b = boostRaw(); b.freeShopUntil = Date.now() + it.minutes * 60000; writeJSON(BOOST_KEY, b);
    }
    profile.items[id].n--; if (profile.items[id].n <= 0) delete profile.items[id]; save('items');
    emit('boost'); return true;
  }
  // a crate opened somewhere: roll for a site item. Returns the item won (and shows a toast on site pages), or null
  function crateRoll(how) {
    for (const id in ITEMS) { if (itemCount(id) >= ITEMS[id].max) continue; if (Math.random() < ITEM_DROP) { if (grantItem(id, how)) return ITEMS[id]; } }
    return null;
  }
  // a Pearl / point / coin price with the free-shop token on
  const priceNow = cost => freeShop() ? 0 : cost;
  /* the free-shop timer at the top of the screen (site pages; games draw their own with gamekit.js) */
  let barT = 0;
  function freeBar() {
    let bar = $('#g-freebar');
    const left = freeShopLeft();
    if (!left) { if (bar) bar.remove(); clearTimeout(barT); barT = 0; return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'g-freebar'; bar.className = 'g-freebar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
      bar.innerHTML = icon('ticket') + '<b>FREE SHOP</b><span class="t"></span>'; document.body.appendChild(bar); }
    const s = Math.ceil(left / 1000); bar.querySelector('.t').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    bar.classList.toggle('low', s <= 20);
    clearTimeout(barT); barT = setTimeout(freeBar, 250);
  }
  root.addEventListener('storage', e => { if (e.key === BOOST_KEY) { freeBar(); emit('boost'); } });
  /* ---------- UI size: a zoom on the page's UI, picked in Settings (the 3D scenes and the fog stay as they are) ---------- */
  function applyUiScale() {
    const z = profile.prefs.uiScale || 1;
    document.documentElement.style.setProperty('--g-ui', String(z));
    document.documentElement.classList.toggle('g-scaled', z !== 1);
  }
  // Only names built from the word lists survive; anything else (old free-text names, edited files) becomes ''.
  function cleanName(n) { const p = parseName(n); return p ? makeName(p.adj, p.noun, p.num) : ''; }

  const stored = readJSON(KEY, null);
  let profile = normalize(stored);
  let isNew = false;
  try { isNew = !localStorage.getItem(KEY); if (isNew) localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}   // a first visit gets its name and id right away
  // an old free-text name was replaced with a word-list name: keep the new one so it doesn't change on every page
  if (!isNew && stored && typeof stored === 'object' && stored.name !== profile.name) { profile.seen.renamed = Date.now(); writeJSON(KEY, profile); }
  try { applyUiScale(); } catch (e) {}
  const listeners = [];
  function emit(what) { listeners.forEach(fn => { try { fn(profile, what); } catch (e) { console.error(e); } }); try { root.dispatchEvent(new CustomEvent('grug:change', { detail: { what, profile } })); } catch (e) {} }
  function save(what) { profile.updated = Date.now(); const ok = writeJSON(KEY, profile); emit(what || 'save'); return ok; }
  // another tab (or a game inside an app) changed the profile
  root.addEventListener('storage', e => { if (e.key === KEY) { profile = normalize(readJSON(KEY, null)); emit('external'); } });

  /* ---------- closet ---------- */
  const owns = id => { const it = C.get(id); return !!it && (it.get.type === 'free' || profile.inventory.includes(id)); };
  function grant(id, how) {
    const it = C.get(id); if (!it || owns(id)) return false;
    profile.inventory.push(id); profile.earned[id] = { at: Date.now(), how: how || it.get.type };
    save('grant'); return true;
  }
  /* wearing a design = dressing the 3D avatar's look ('grug.sandy.v1') in a custom garment with that template.
     A garment of the same kind she already wears is kept (T-shirt or long sleeves, shorts or pants). */
  const LOOK_KEY = 'grug.sandy.v1';
  const look = () => { const c = readJSON(LOOK_KEY, null); return c && typeof c === 'object' ? c : {}; };
  const wearing = it => !!it && C.wornIn(look(), it.slot) === it.id;
  function equip(id) {
    const it = C.get(id); if (!it || !owns(id)) return false;
    const c = look(), key = C.CFG_KEY[it.slot], cur = c[key], G0 = C.GARMENTS[it.slot];
    const g = (cur && G0.find(x => x.part === cur.part)) || G0[it.slot === 'shirt' ? 0 : 1];
    c[key] = { part: g.part, texture: g.texture, colour: '#ffffff', template: it.template };
    writeJSON(LOOK_KEY, c); profile.avatar[it.slot] = id; profile.avatar = C.normalize(profile.avatar); save('avatar');
    refreshPictures(c); return true;
  }
  function unequip(slot) {
    const c = look(), key = C.CFG_KEY[slot]; if (!key) return false;
    if (c[key] && c[key].template) { c[key] = null; writeJSON(LOOK_KEY, c); refreshPictures(c); }
    profile.avatar[slot] = null; save('avatar'); return true;
  }
  // re-take the avatar's pictures after her look changed outside the editor (loads the 3D runtime once, in the background)
  let picBusy = null;
  function refreshPictures(c) {
    const run = () => root.SandyView.makeSnaps(c || look(), { step: true }).then(() => emit('snaps')).catch(() => {});
    if (root.SandyView) { picBusy = (picBusy || Promise.resolve()).then(run); return picBusy; }
    picBusy = new Promise(ok => { const s = document.createElement('script'); s.src = url('assets/sandy-view.js'); s.onload = ok; s.onerror = ok; document.head.appendChild(s); }).then(() => root.SandyView && run());
    return picBusy;
  }
  function setAvatar(patch) { profile.avatar = C.normalize(Object.assign({}, profile.avatar, patch)); save('avatar'); }
  function setName(name) { name = cleanName(name); if (!name) return false; profile.name = name; save('name'); return true; }

  /* ---------- stats & milestones ---------- */
  // mode: 'add' (count up), 'max' (keep the best), 'set'
  function track(app, stat, value, mode) {
    const s = profile.stats; if (!s[stat]) s[stat] = {};
    value = +value || 0; mode = mode || (stat === 'best' || stat === 'course' ? 'max' : 'add');
    const cur = +s[stat][app] || 0;
    s[stat][app] = mode === 'add' ? cur + value : mode === 'max' ? Math.max(cur, value) : value;
    if (stat === 'plays' || stat === 'days') { s.lastGame = app; s.lastPlayed = Date.now(); }
    const won = checkMilestones();
    save('stats');
    return won;
  }
  // the whole-site view of the stats ('grug' milestones)
  function totals() {
    const s = profile.stats, sum = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
    return { plays: sum(s.plays), checkins: sum(s.checkins), days: sum(s.days), games: Object.values(s.plays || {}).filter(v => v > 0).length, partners: Object.values(s.checkins || {}).filter(v => v > 0).length };
  }
  function statValue(app, stat) { return app === 'grug' ? (totals()[stat] || 0) : (+(profile.stats[stat] || {})[app] || 0); }
  function checkMilestones() {
    const won = [];
    C.ITEMS.forEach(it => {
      const g = it.get; if (g.type !== 'milestone' || owns(it.id)) return;
      if (statValue(g.app, g.stat) >= g.value) { profile.inventory.push(it.id); profile.earned[it.id] = { at: Date.now(), how: 'milestone' }; won.push(it); }
    });
    return won;
  }
  // designs whose milestone was already reached (stats from before they existed) count right away
  try { if (C && checkMilestones().length) writeJSON(KEY, profile); } catch (e) {}
  // progress toward a milestone item: {have, need, pct}
  function progress(it) { const g = it.get; if (g.type !== 'milestone') return null; const have = statValue(g.app, g.stat); return { have, need: g.value, pct: Math.min(100, Math.round(have / g.value * 100)) }; }

  /* ---------- favourite and ignored games (this device) ----------
     The store's heart and the Discovery Queue's Ignore. Favourites keep the order they were added in: games/favorites/
     shows them, in that order, as the FOSSIL32 rack. Ignoring a game drops it from favourites, and favouriting it again
     takes it off the ignore list. */
  const FAV_KEY = 'grug.games.favs.v1', IGN_KEY = 'grug.games.ignored.v1';
  const idList = k => { const v = readJSON(k, []); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && GAMES.some(g => g.id === x)) : []; };
  const setIn = (k, id, on) => { const l = idList(k).filter(x => x !== id); if (on) l.push(id); writeJSON(k, l); };
  const favs = {
    list: () => idList(FAV_KEY),
    has: id => idList(FAV_KEY).includes(id),
    set(id, on) { setIn(FAV_KEY, id, !!on); if (on) setIn(IGN_KEY, id, false); return !!on; },
    toggle(id) { return favs.set(id, !favs.has(id)); },
    ignored: () => idList(IGN_KEY),
    isIgnored: id => idList(IGN_KEY).includes(id),
    ignore(id, on) { setIn(IGN_KEY, id, !!on); if (on) setIn(FAV_KEY, id, false); return !!on; },
    clearIgnored() { writeJSON(IGN_KEY, []); }
  };

  /* ---------- partner points (read from each app's own storage) ---------- */
  function appState(game) { return game && game.storageKey ? readJSON(game.storageKey, null) : null; }
  function points() {
    // a venue's rewards app keeps its coins and visits ('coins' / 'visits', or 'points' / a history in the older apps);
    // a standalone game keeps its best and runs in its own save (games.js `save`)
    return GAMES.filter(g => g.storageKey).map(g => {
      const s = appState(g) || {}, h = (g.save && readJSON(g.save, null)) || s;
      return { game: g, points: Math.max(0, +s.points || +s.coins || 0), best: +(h.game && h.game.best) || 0, runs: +(h.game && h.game.runs) || 0,
        visits: +s.visits || (Array.isArray(s.history) ? s.history.filter(x => x && x.pts > 0).length : 0), has: !!localStorage.getItem(g.storageKey) || !!(g.save && localStorage.getItem(g.save)),
        coin: venueOf(g) && venueOf(g).wallet ? venueOf(g).wallet.label : 'points' };
    });
  }
  // the venue a game was made with (its PARTNERS entry in theme.js), and the link to that venue's rewards app
  const venueOf = g => { const P = root.GrugTheme && root.GrugTheme.PARTNERS; return g && g.venue && P && P[g.venue] ? P[g.venue] : null; };
  function rewardsUrl(g) {
    const v = venueOf(g); if (v) return url(v.app + (v.wallet && v.wallet.to || ''));
    const s = appState(g); return url(g.play) + (s && s.store ? '#' + esc(s.store) + '/rewards' : '');
  }

  /* ---------- export / import ---------- */
  // every save that belongs to the profile: the venues' rewards apps (storageKey, plus each PARTNERS wallet) and the games' own saves
  function appKeys() {
    const P = (root.GrugTheme && root.GrugTheme.PARTNERS) || {}, ks = [];
    GAMES.forEach(g => { if (g.storageKey) ks.push(g.storageKey); if (g.save) ks.push(g.save); });
    Object.values(P).forEach(p => { if (p.wallet && p.wallet.key) ks.push(p.wallet.key); });
    return [...new Set(ks)];
  }
  function exportData() {
    const apps = {};
    appKeys().forEach(k => { const v = localStorage.getItem(k); if (v) { try { apps[k] = JSON.parse(v); } catch (e) {} } });   // venue apps and game saves
    { const v = localStorage.getItem(REWARDS_KEY); if (v) { try { apps[REWARDS_KEY] = JSON.parse(v); } catch (e) {} } }   // saved Rewards cards + My creations
    const sandy = readJSON('grug.sandy.v1', null);   // the 3D avatar's look
    return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), site: ROOT, profile, apps, sandy };
  }
  function exportText() { return JSON.stringify(exportData(), null, 2); }
  function exportFilename() { return 'grug-profile-' + profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.json'; }
  function download() {
    const text = exportText(), name = exportFilename();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return name;
  }
  async function share() {
    const text = exportText(), name = exportFilename();
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Grug profile' }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    return 'unsupported';
  }
  // Read a pasted/opened export. Returns {ok, data, summary} or {ok:false, error}
  function parseImport(text) {
    let d; try { d = JSON.parse(String(text || '')); } catch (e) { return { ok: false, error: 'That isn’t a Grug profile file. It should be the .json file you exported from Profile.' }; }
    if (!d || typeof d !== 'object' || d.format !== EXPORT_FORMAT || !d.profile) return { ok: false, error: 'That file isn’t a Grug profile export (missing "format": "grug-profile").' };
    const p = normalize(d.profile);
    const apps = d.apps && typeof d.apps === 'object' ? d.apps : {};
    const pts = GAMES.filter(g => g.storageKey && apps[g.storageKey]).map(g => ({ game: g, points: Math.max(0, +apps[g.storageKey].points || +apps[g.storageKey].coins || 0) }));
    const sandy = d.sandy && typeof d.sandy === 'object' && !Array.isArray(d.sandy) ? d.sandy : null;
    return { ok: true, data: { profile: p, apps, sandy }, summary: { name: p.name, items: p.inventory.length, exportedAt: d.exportedAt || '', points: pts } };
  }
  // Replace everything on this device with the file's contents.
  function applyImport(data) {
    const p = normalize(data.profile); p.updated = Date.now();
    appKeys().forEach(k => { if (data.apps[k] && typeof data.apps[k] === 'object') writeJSON(k, data.apps[k]); });
    if (data.apps[REWARDS_KEY] && typeof data.apps[REWARDS_KEY] === 'object') writeJSON(REWARDS_KEY, data.apps[REWARDS_KEY]);
    profile = p; writeJSON(KEY, profile); try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
    if (data.sandy) { writeJSON('grug.sandy.v1', data.sandy); try { localStorage.removeItem('grug.sandy.snaps.v1'); } catch (e) {} }
    emit('import'); return true;
  }
  function reset(alsoPoints) {
    if (alsoPoints) appKeys().forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    if (alsoPoints) try { localStorage.removeItem(REWARDS_KEY); } catch (e) {}
    try { localStorage.removeItem(KEY); localStorage.removeItem(SNAP_KEY); localStorage.removeItem('grug.sandy.v1'); localStorage.removeItem('grug.sandy.snaps.v1'); } catch (e) {}
    profile = fresh(); writeJSON(KEY, profile); emit('reset');
  }

  /* ---------- avatar snapshots: pictures of the new 3D avatar (Sandy) ----------
     The avatar editor (avatar/) renders them whenever the look changes and caches them in 'grug.sandy.snaps.v1'
     (see assets/sandy-view.js). Until someone makes their own, everyone gets the default look's pictures. */
  const SANDY_KEY = 'grug.sandy.v1', SANDY_SNAPS = 'grug.sandy.snaps.v1';
  const sandyHash = (o) => { const s = JSON.stringify(o || null); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // the saved pictures; if the look changed since they were taken they're still shown (s.stale) until ensureSnaps redraws them
  function snaps() {
    const s = readJSON(SANDY_SNAPS, null), c = readJSON(SANDY_KEY, null);
    if (s && s.bust) { if (c && s.hash !== sandyHash(c)) s.stale = true; return s; }
    const d = url('assets/sandy/');
    return { def: true, bust: d + 'bust.png', full: d + 'full.png', happy: d + 'happy.png', sad: d + 'sad.png', cheer: d + 'cheer.png' };
  }
  // pages that show the avatar call this: out-of-date pictures (the editor was closed before it finished) get redrawn
  // in the background, a picture at a time, once the page has settled
  let ensureT = 0;
  function ensureSnaps(force) {
    const s = snaps(), c = readJSON(SANDY_KEY, null);
    if (c && (force || s.stale || s.def) && !ensureT && !picBusy) ensureT = setTimeout(() => {
      const go = () => { ensureT = 0; refreshPictures(c); };
      root.requestIdleCallback ? root.requestIdleCallback(go, { timeout: 3000 }) : go();
    }, force ? 50 : 1500);
    return s;
  }
  root.addEventListener('storage', e => { if (e.key === SANDY_SNAPS) emit('snaps'); });
  root.addEventListener('grug-sandy-snaps', () => emit('snaps'));

  /* the avatar as a picture (home hero, profile card): tap = a little hop; play(pose) swaps to a matching picture.
     Same shape as the old 3D view (play, setAvatar, el) so pages can swap it in. */
  function avatarPic(host, opts) {
    opts = opts || {};
    if (!document.getElementById('g-avpic-css')) { const st = document.createElement('style'); st.id = 'g-avpic-css';
      st.textContent = '.g-avpic{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        '.g-avpic img{height:94%;width:auto;max-width:100%;object-fit:contain;transform-origin:50% 100%;filter:drop-shadow(0 14px 18px rgba(0,0,0,.18));animation:g-av-breathe 4s ease-in-out infinite}' +
        '.g-avpic.hop img{animation:g-av-hop .6s cubic-bezier(.3,1.6,.5,1)}.g-avpic.dance img{animation:g-av-dance .5s ease-in-out 4}' +
        '@keyframes g-av-breathe{50%{transform:translateY(-1.5%) scaleY(1.008)}}@keyframes g-av-hop{0%{transform:none}35%{transform:translateY(-9%) scale(1.03)}70%{transform:translateY(1%) scaleY(.97)}100%{transform:none}}' +
        '@keyframes g-av-dance{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg) translateY(-2%)}75%{transform:rotate(4deg) translateY(-2%)}}' +
        '@media (prefers-reduced-motion:reduce){.g-avpic img{animation:none!important}}';
      document.head.appendChild(st); }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const wrap = document.createElement('div'); wrap.className = 'g-avpic'; if (opts.bottom) wrap.style.bottom = opts.bottom + 'px'; wrap.setAttribute('role', 'img'); wrap.setAttribute('aria-label', 'Your avatar');
    const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.onload = img.onerror = () => img.classList.add('ld'); wrap.appendChild(img); host.appendChild(wrap);
    let t = 0;
    const base = () => snaps().full;
    function paint() { img.src = base(); }
    function play(pose, o) {
      const s = snaps(), ms = (o && o.ms) || 1400;
      img.src = pose === 'sad' ? s.full : (pose === 'happy' || pose === 'wave' || pose === 'cheer' || pose === 'dance') ? s.cheer : s.full;
      wrap.classList.remove('hop', 'dance'); void wrap.offsetWidth; wrap.classList.add(pose === 'dance' ? 'dance' : 'hop');
      clearTimeout(t); t = setTimeout(() => { wrap.classList.remove('hop', 'dance'); paint(); }, ms);
    }
    wrap.addEventListener('click', () => { if (opts.onTap) opts.onTap(); else play('wave', { ms: 1600 }); });
    root.addEventListener('grug:change', e => { if (e.detail && e.detail.what === 'snaps' || e.detail && e.detail.what === 'import' || e.detail && e.detail.what === 'reset') paint(); });
    paint();
    return { el: wrap, play, setAvatar: paint, renderer: null };
  }

  /* ---------- icons ---------- */
  /* One icon style everywhere: flat, one colour, following the text colour.
     the @icons set in icons.js (GRUG_ICONS_SIMPLE): small SVGs on a 16px grid, used first
     Phosphor Icons 2.1.1 bold (GRUG_ICONS, 256px paths): any name the simple set doesn't have, and the shop icons ('sh-…') */
  const SIMPLE = root.GRUG_ICONS_SIMPLE || {};
  function icon(name, cls) {
    const c = cls ? ' ' + cls : '';
    if (SIMPLE[name]) return '<svg class="gi gi-s' + c + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' + SIMPLE[name] + '</svg>';
    const d = ICONS[name]; return '<svg class="gi' + c + '" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="' + (d || ICONS.question || '') + '"/></svg>';
  }

  const roleOf = () => profile.prefs.role || '';
  const showsTab = () => true;   // the dock shows everything to everyone now (Me and Make keep it short)

  /* ---------- UI chrome: floating top bar + dock ----------
     The dock has four tabs: Home, and three groups that open a small tray of pages:
       Games → Games (the store), Carts (quick one-tap games in a swipe feed, games/carts/)
       Me   → Avatar, Shop, Profile
       Make → Link page (creators), Rewards card (shop owners), 3D models (Model Kit + the asset library)
     Everyone sees every tab (the role picked in Settings only changes what the home page shows first). */
  const NAV = [
    ['home', 'Home', 'house', ''], ['games', 'Games', 'game-controller', 'games/'], ['avatar', 'Avatar', 't-shirt', 'avatar/'], ['shop', 'Shop', 'storefront', 'shop/'], ['profile', 'Profile', 'user', 'profile/'],
    ['links', 'Link page', 'share-network', 'links/'], ['rewards', 'Rewards card', 'gift', 'rewards/'], ['create', '3D models', 'cube', 'create/'],
    ['carts', 'Carts', 'device-mobile', 'games/carts/'],
    ['me', 'Me', 'user', 'me/'], ['make', 'Make', 'magic-wand', 'make/']   // the groups' own pages: a simple list of where to go
  ];
  // what's in the dock, left to right; a group opens its tray of pages
  const DOCK_GROUPS = [
    { id: 'home' }, { id: 'games', label: 'Games', items: ['games', 'carts'] },
    { id: 'me', label: 'Me', items: ['avatar', 'shop', 'profile'] },
    { id: 'make', label: 'Make', items: ['links', 'rewards', 'create'] }
  ];
  // the dock's stops, left to right: what a swipe (or Q / E, LB / RB) steps through
  const STOPS = ['home', 'games', 'me', 'make'];
  // partner mode: every standalone game (the partner's own first, see games/), but never another partner's rewards app,
  // so a game that still lives inside its venue's app (inApp) shows only in that venue's own wrap
  const partnerAllows = g => { const p = root.GrugTheme && root.GrugTheme.partner && root.GrugTheme.partner(); return !p || !g || g.id === p.game || !g.inApp; };
  try { const m = /\/games\/([\w-]+)\/?$/.exec(location.pathname), g = m && GAMES.find(x => x.id === m[1]); if (g && !partnerAllows(g)) location.replace(url('games/')); } catch (e) {}
  // partner mode (theme.js, e.g. crafthouse/): the site is just for playing and dressing up, so the dock is Games and Me
  const partnerOn = () => !!(root.GrugTheme && root.GrugTheme.partner && root.GrugTheme.partner());
  const PARTNER_TABS = ['games', 'me'];
  const dockGroups = () => partnerOn() ? DOCK_GROUPS.filter(g => PARTNER_TABS.includes(g.id)) : DOCK_GROUPS;
  const stops = () => partnerOn() ? PARTNER_TABS : STOPS;
  const SUB_TEXT = { games: 'The game store: every game, search and favorites', carts: 'Quick one-tap games: swipe up for the next',
    avatar: 'Dress up your 3D avatar', shop: 'Clothes and how to earn them', profile: 'Stats, inventory and settings',
    links: 'A link page or 3D world for your socials', rewards: 'A free stamp card for your shop', create: 'Model Kit and free 3D presets' };
  const groupOf = k => DOCK_GROUPS.find(g => g.id === k || (g.items && g.items.includes(k))) || DOCK_GROUPS[0];
  // dock icons: the simple set, one colour per tab
  // one colour per section, the same accents theme.js gives each section (Model Kit style)
  const DOCK_SIMPLE = { home: ['house', '#9BE338'], games: ['controller', '#7EE081'], carts: ['device-mobile', '#7EE081'], rewards: ['gift', '#FF9F5A'], links: ['share-network', '#5AB0FF'], create: ['cube', '#4FD8C4'], avatar: ['shirt', '#C59BFF'], shop: ['shop', '#FFBE1A'], profile: ['person', '#FF8FC2'],
    me: ['person', '#FF8FC2'], make: ['magic-wand', '#4FD8C4'] };
  const DOCK_LO = { home: '#6FB31C', games: '#4FB357', carts: '#4FB357', rewards: '#E0782F', links: '#2F86D6', create: '#25A893', avatar: '#9A6FE0', shop: '#D99A00', profile: '#E0669E', me: '#E0669E', make: '#25A893' };
  const dockIcon = k => '<svg class="k-ic k-ic-s" viewBox="0 0 16 16" fill="currentColor" style="color:' + DOCK_SIMPLE[k][1] + '" aria-hidden="true" focusable="false">' + (SIMPLE['dock-' + DOCK_SIMPLE[k][0]] || SIMPLE[DOCK_SIMPLE[k][0]] || '') + '</svg>';
  const DOCK = {};
  ['home', 'games', 'carts', 'rewards', 'links', 'create', 'avatar', 'shop', 'profile', 'me', 'make'].forEach(k => Object.defineProperty(DOCK, k, { get: () => dockIcon(k), enumerable: true }));
  const totalPoints = () => { try { return points().reduce((s, p) => s + (+p.points || 0), 0); } catch (e) { return 0; } };
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsOk = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  /* ---------- Pearls (the site-wide currency, sold on pearls.html; wallet in 'grug.pearls.v1') ---------- */
  const PEARL_KEY = 'grug.pearls.v1';
  const pearlBalance = () => { const w = readJSON(PEARL_KEY, null); return Math.max(0, Math.floor(+(w && w.balance) || 0)); };
  // the Pearls page, with a way back to where the guest is now
  const pearlsUrl = app => /\/pearls(\.html)?$/.test(location.pathname) ? location.pathname + location.search : url('pearls.html') + '?from=' + encodeURIComponent(location.pathname + location.search + location.hash) + '&app=' + encodeURIComponent(app || 'Grug');
  function chrome(active, opts) {
    opts = opts || {};
    const face = snaps(); const faceImg = face ? '<img class="g-face" alt="" src="' + face.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>';
    const navLabel = (NAV.find(n => n[0] === active) || NAV[0])[1];
    const titleBit = (document.title.split(' · ').find(x => x && x !== 'Grug') || navLabel);
    const pageTitle = opts.title || (/^games made/i.test(titleBit) ? 'Home' : titleBit);
    const brand = root.GrugTheme && root.GrugTheme.brand();
    // partner mode: theme.js already put the partner's own top bar in (header.ptb); it's used as it is
    const ptb = partnerOn() ? $('header.ptb') : null;
    const top = ptb || document.createElement('header'); if (!ptb) top.className = 'g-top';
    const partner = partnerOn() ? brand : null;
    if (!ptb) top.innerHTML = (partner ? '<a class="g-logo k-glass is-brand is-partner" href="' + url(partner.app) + '" aria-label="' + esc(partner.n) + ': open their app"><img class="g-partner-logo" alt="' + esc(partner.n) + '" src="' + url(partner.logo) + '">' + (partner.demo ? '<span class="g-partner-demo">Demo</span>' : '') + '</a>'
      : brand ? '<a class="g-logo k-glass is-brand" href="' + url('') + '" aria-label="' + esc(brand.n) + ' home"><span class="g-brand-mark" aria-hidden="true">' + shopIcon(brand.i) + '</span><span class="g-brand-name">' + esc(brand.n) + '</span></a>'
        : '<a class="g-logo k-glass" href="' + url('') + '" aria-label="Grug home">' + LOGO + '<span>Grug</span></a>') +
      '<div class="g-title k-glass" aria-hidden="true"><small>' + esc((active !== 'games' && (DOCK_GROUPS.find(g => g.id === (opts.dockAs || groupOf(active).id)) || {}).label) || (pageTitle === navLabel ? (brand ? brand.n : 'Grug') : navLabel)) + '</small><b>' + esc(pageTitle) + '</b></div>' +
      '<div class="g-status k-glass"><a class="g-pts" href="' + pearlsUrl() + '" title="Your Pearls · tap to get more" aria-label="Pearls: get more">' + icon('pearl') + '<span class="num">' + fmt(pearlBalance()) + '</span><span class="g-plus" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M6 2.5v7M2.5 6h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></a></div>' +
      (fsOk() ? '<button type="button" class="g-fs k-glass" aria-label="Full screen" aria-pressed="false">' + icon('arrows-out') + '</button>' : '') +
      '<button type="button" class="g-me" aria-label="Your account menu" aria-haspopup="menu" aria-expanded="false">' + faceImg + '</button>';
    const tabs = document.createElement('nav'); tabs.className = 'g-tabs k-glass'; tabs.setAttribute('aria-label', 'Sections');
    const navNow = () => NAV;
    const navOf = k => NAV.find(n => n[0] === k);
    const here = opts.dockAs || groupOf(active).id;   // a page can light up another tab (the guest's stamp card sits under Me, or Home in shop mode)
    // a tab's colours: the open section's own accent when it's the current tab
    const tabStyle = (k, on) => { const c = on || brand ? (root.GrugTheme && root.GrugTheme.accent ? root.GrugTheme.accent() : null) : null;
      return 'style="--tab:' + (c ? c.a : DOCK_SIMPLE[k][1]) + ';--tab-lo:' + (c ? c.lo : DOCK_LO[k]) + '"'; };
    const paintTabs = () => { tabs.innerHTML = '<span class="k-sb l" aria-hidden="true">LB</span><span class="k-sb r" aria-hidden="true">RB</span>' +
      dockGroups().map(g => { const on = g.id === here;
        if (!g.items) { const n = navOf(g.id); return '<a href="' + url(n[3]) + '" ' + tabStyle(g.id, on) + (on ? ' aria-current="page"' : '') + '>' + DOCK[g.id] + '<span>' + n[1] + '</span></a>'; }
        const cur = on && active !== g.id ? navOf(active) : null;
        return '<button type="button" class="g-grp" data-grp="' + g.id + '" aria-haspopup="menu" aria-expanded="false" ' + tabStyle(g.id, on) + (on ? ' aria-current="page"' : '') + '>' + DOCK[on ? active : g.id] +
          '<span>' + esc(g.label) + (cur ? '<i> · ' + esc(cur[1]) + '</i>' : '') + '</span><svg class="g-grp-up" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'; }).join(''); };
    paintTabs(); chromeTabs = paintTabs;
    // the tray a group opens: its pages, big enough to tap, each in its own colour
    const tray = document.createElement('div'); tray.className = 'g-tray k-glass'; tray.setAttribute('role', 'menu'); tray.hidden = true;
    let trayFor = null;
    const closeTray = () => { if (tray.hidden) return; tray.hidden = true; trayFor = null; $$('.g-grp', tabs).forEach(b => b.setAttribute('aria-expanded', 'false')); };
    const openTray = (btn, byKey) => {
      const g = DOCK_GROUPS.find(x => x.id === btn.dataset.grp); if (!g) return;
      if (trayFor === g.id) { closeTray(); return; }
      trayFor = g.id;
      tray.innerHTML = '<b class="g-tray-h">' + esc(g.label) + '</b>' + g.items.map(k => { const n = navOf(k);
        return '<a role="menuitem" href="' + url(n[3]) + '" style="--tab:' + (brand ? brand.color : DOCK_SIMPLE[k][1]) + ';--tab-lo:' + DOCK_LO[k] + '"' + (k === active ? ' aria-current="page"' : '') + '>' +
          '<span class="g-tray-ic">' + DOCK[k] + '</span><span class="g-tray-tx"><b>' + esc(n[1]) + '</b><small>' + esc(SUB_TEXT[k] || '') + '</small></span>' + icon('caret-right') + '</a>'; }).join('');
      tray.hidden = false; $$('.g-grp', tabs).forEach(b => b.setAttribute('aria-expanded', String(b === btn)));
      // sit just above the dock, over the group's tab (beside the rail in landscape)
      const r = btn.getBoundingClientRect(), d = tabs.getBoundingClientRect(), tw = tray.offsetWidth, th = tray.offsetHeight;
      if (d.height > d.width) { tray.style.left = (d.right + 10) + 'px'; tray.style.top = Math.max(10, Math.min(innerHeight - th - 10, r.top + r.height / 2 - th / 2)) + 'px'; tray.style.bottom = 'auto'; }
      else { tray.style.left = Math.max(10, Math.min(innerWidth - tw - 10, r.left + r.width / 2 - tw / 2)) + 'px'; tray.style.top = 'auto'; tray.style.bottom = (innerHeight - d.top + 10) + 'px'; }
      if (byKey) { const f = $('a[role=menuitem]', tray); if (f) f.focus({ preventScroll: true }); }   // keyboard users land in the tray
      buzz();
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('.g-grp'); if (b) { e.stopPropagation(); openTray(b, e.detail === 0); } });
    document.addEventListener('click', e => { if (!tray.hidden && !tray.contains(e.target)) closeTray(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !tray.hidden) { const g = trayFor; closeTray(); const b = $('.g-grp[data-grp="' + g + '"]', tabs); if (b) b.focus(); } });
    root.addEventListener('resize', closeTray); root.addEventListener('scroll', closeTray, { passive: true });
    document.body.appendChild(tray);
    document.body.prepend(top); document.body.appendChild(tabs);
    // partner mode: the partner app's tab bar (.g-pbar) is put in by theme.js with the top bar
    document.body.classList.add('g-chrome');
    // the account menu under the avatar
    const menu = document.createElement('div'); menu.className = 'g-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
    const paintMenu = () => { const f = snaps();
      if (partnerOn()) {   // partner mode: only what stays inside it (the avatar and Pearls), and Settings without a way out
        menu.innerHTML = '<div class="g-menu-h"><img alt="" src="' + f.bust + '"><div><b>' + esc(profile.name) + '</b><small>' + fmt(pearlBalance()) + ' Pearls</small></div></div>' +
          '<a role="menuitem" class="hot" href="' + pearlsUrl() + '">' + icon('pearl') + '<span>Buy Pearls</span>' + icon('caret-right') + '</a>' +
          '<a role="menuitem" href="' + url('avatar/') + '">' + icon('t-shirt') + '<span>Edit avatar</span></a>' +
          '<button type="button" role="menuitem" data-m="settings">' + icon('gear-six') + '<span>Settings</span></button>';
        return; }
      menu.innerHTML = '<div class="g-menu-h"><img alt="" src="' + f.bust + '"><div><b>' + esc(profile.name) + '</b><small>' + fmt(pearlBalance()) + ' Pearls · ' + fmt(totalPoints()) + ' partner points</small></div></div>' +
        '<a role="menuitem" class="hot" href="' + pearlsUrl() + '">' + icon('pearl') + '<span>Buy Pearls</span>' + icon('caret-right') + '</a>' +
        '<a role="menuitem" href="' + url('profile/') + '">' + icon('user') + '<span>Profile</span></a>' +
        '<a role="menuitem" href="' + url('avatar/') + '">' + icon('t-shirt') + '<span>Edit avatar</span></a>' +
        '<a role="menuitem" href="' + url('shop/?mine') + '">' + icon('shopping-bag') + '<span>My closet</span></a>' +
        '<button type="button" role="menuitemcheckbox" data-m="mode" aria-checked="' + !isLight() + '">' + icon('moon') + '<span>Dark mode</span><span class="g-switch sm" aria-hidden="true"></span></button>' +
        '<button type="button" role="menuitem" data-m="settings">' + icon('gear-six') + '<span>Settings</span></button>'; };
    document.body.appendChild(menu);
    const meBtn = $('.g-me', top);
    // full screen (left of the avatar): more room for games and the editor; hidden where the browser can't (iPhone Safari)
    const fsBtn = $('.g-fs', top);
    if (fsBtn) {
      const paintFs = () => { const on = !!fsEl(); if (!ptb) fsBtn.innerHTML = icon(on ? 'arrows-in' : 'arrows-out'); fsBtn.setAttribute('aria-pressed', String(on)); fsBtn.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen'); };
      fsBtn.addEventListener('click', () => { buzz(); const d = document.documentElement;
        try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = (d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } } catch (e) {} });
      document.addEventListener('fullscreenchange', paintFs); document.addEventListener('webkitfullscreenchange', paintFs); paintFs();
    }
    const setMenu = on => { if (on) paintMenu(); menu.hidden = !on; meBtn.setAttribute('aria-expanded', String(on)); if (on) { const f = $('[role=menuitem]', menu); if (f) f.focus({ preventScroll: true }); } };
    meBtn.addEventListener('click', e => { e.stopPropagation(); buzz(); setMenu(menu.hidden); });
    menu.addEventListener('click', e => {
      if (e.target.closest('[data-m=settings]')) { setMenu(false); settings(); return; }
      const m = e.target.closest('[data-m=mode]'); if (m) { setMode(isLight() ? 'dark' : 'light'); m.setAttribute('aria-checked', String(!isLight())); buzz(); }
    });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); meBtn.focus(); } });
    const paintPearls = () => { const pt = $('.g-pts .num', top); if (pt) pt.textContent = fmt(pearlBalance()); const a = $('.g-pts', top); if (a) a.href = pearlsUrl(); };
    root.addEventListener('storage', e => { if (e.key === PEARL_KEY) paintPearls(); });
    root.addEventListener('pageshow', paintPearls);
    if (!$('#g-toast')) { const t = document.createElement('div'); t.id = 'g-toast'; t.className = 'g-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    root.addEventListener('grug:change', () => {
      const s = snaps(); const el = $('.g-me', top); if (!el) return;
      if (ptb) { el.style.backgroundImage = 'url("' + s.bust + '")'; paintPearls(); return; }
      el.innerHTML = (s ? '<img class="g-face" alt="" src="' + s.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>');
      paintPearls();
    });
    // LB / RB: Q and E (or a controller's shoulder buttons) step through the dock
    // step to the next or previous dock tab (Me and Make open their list pages); wrap = Q / E and the shoulder buttons go round
    const go = (d, wrap) => { if (partnerOn()) return false; const STOPS = stops(); let i = STOPS.indexOf(here) + d; if (wrap) i = (i + STOPS.length) % STOPS.length; if (i < 0 || i >= STOPS.length) return false;
      try { sessionStorage.setItem('grug.swipe', d > 0 ? 'next' : 'prev'); } catch (e) {}
      closeTray(); location.href = url(navOf(STOPS[i])[3]); return true; };
    // swipe sideways anywhere on the page to change tabs (not on sliders, 3D views, maps or rows that scroll sideways)
    let sw = null;
    const scrollsX = el => { for (; el && el !== document.body; el = el.parentElement) { if (el.scrollWidth > el.clientWidth + 2) { const o = getComputedStyle(el).overflowX; if (o === 'auto' || o === 'scroll') return true; } } return false; };
    document.addEventListener('touchstart', e => {
      sw = null; if (e.touches.length !== 1 || document.querySelector('dialog[open]') || document.documentElement.classList.contains('f32-lock')) return;
      const t = e.target; if (t.closest && t.closest('input,textarea,select,canvas,video,iframe,[data-noswipe],.g-tray,.g-menu,.g-tabs')) return;
      if (scrollsX(t)) return;
      const p = e.touches[0]; sw = { x: p.clientX, y: p.clientY, t: performance.now() };
    }, { passive: true });
    document.addEventListener('touchmove', e => { if (!sw) return; const p = e.touches[0]; if (Math.abs(p.clientY - sw.y) > 40 && Math.abs(p.clientY - sw.y) > Math.abs(p.clientX - sw.x)) sw = null; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!sw) return; const p = e.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y, dt = performance.now() - sw.t; sw = null;
      if (Math.abs(dx) < Math.max(64, innerWidth * .18) || Math.abs(dx) < Math.abs(dy) * 1.8 || dt > 700) return;
      if (go(dx < 0 ? 1 : -1)) buzz(6);
    }, { passive: true });
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.querySelector('dialog[open]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase(); if (k === 'q') go(-1, true); else if (k === 'e') go(1, true);
    });
    root.addEventListener('gamepadconnected', () => {
      let prev = {};
      (function poll() {
        const p = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).find(Boolean);
        if (p) { [[4, -1], [5, 1]].forEach(([i, d]) => { const on = !!(p.buttons[i] && p.buttons[i].pressed); if (on && !prev[i]) go(d, true); prev[i] = on; }); }
        requestAnimationFrame(poll);
      })();
    }, { once: true });
    speed(); freeBar();
    // first visit: who are you? (not on pages a guest reaches from a shop's QR, which pass noRole)
    if (!roleOf() && !opts.noRole && !(root.GrugTheme && root.GrugTheme.brand()) && storageWorks()) setTimeout(() => { if (!roleOf() && !document.querySelector('dialog[open]')) askRole(); }, 700);
    root.addEventListener('grug:change', e => { if (e.detail && e.detail.what === 'boost') freeBar(); });
    return top;
  }

  /* ---------- the Me and Make pages: a plain list of where to go, like a link page. The picked row fills with its colour
     and slides on, then the page opens. ---------- */
  function hub(id, host) {
    const g = DOCK_GROUPS.find(x => x.id === id); if (!g || !host) return;
    const brand = root.GrugTheme && root.GrugTheme.brand();
    const face = snaps();
    const head = id === 'me'
      ? '<div class="g-hub-h"><img class="g-hub-face" alt="" src="' + face.bust + '"><h1>' + esc(profile.name) + '</h1><p>Your look, your closet and your settings.</p></div>'
      : '<div class="g-hub-h"><span class="g-hub-ic">' + DOCK.make + '</span><h1>Make</h1><p>Free tools for creators, shops and game makers.</p></div>';
    host.innerHTML = head + '<nav class="g-hub-list" aria-label="' + esc(g.label) + '">' + g.items.map(k => { const n = navOf(k);
      return '<a href="' + url(n[3]) + '" style="--tab:' + (brand ? brand.color : DOCK_SIMPLE[k][1]) + ';--tab-lo:' + (brand ? brand.color : DOCK_LO[k]) + '"><span class="g-hub-ico">' + DOCK[k] + '</span><span class="g-hub-tx"><b>' + esc(n[1]) + '</b><small>' + esc(SUB_TEXT[k] || '') + '</small></span>' + icon('caret-right') + '</a>'; }).join('') + '</nav>';
    host.addEventListener('click', e => {
      const a = e.target.closest('.g-hub-list a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); e.stopPropagation(); buzz();
      host.classList.add('going'); a.classList.add('go');
      try { sessionStorage.setItem('grug.swipe', 'next'); } catch (x) {}
      setTimeout(() => { location.href = a.href; }, document.documentElement.classList.contains('calm') ? 0 : 260);
    }, true);
  }
  const navOf = k => NAV.find(n => n[0] === k);
  // a shop's icon in shop mode (flat Phosphor icon 'sh-<id>' from icons.js)
  function shopIcon(id) { const d = (root.GRUG_ICONS && (root.GRUG_ICONS['sh-' + id] || root.GRUG_ICONS.storefront)) || '';
    return '<svg class="gi" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + d + '"/></svg>'; }

  /* ---------- fast pages: the next page starts loading as soon as a finger or mouse heads for its link ---------- */
  let sped = false;
  function speed() {
    if (sped) return; sped = true;
    // browsers without cross-page View Transitions: fade the page out, then go (theme.js fades the next one in)
    if (document.documentElement.classList.contains('g-fade')) {
      document.addEventListener('click', e => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
        let u; try { u = new URL(a.href); } catch (x) { return; }
        if (u.origin !== location.origin || u.href.indexOf(ROOT) !== 0 || (u.pathname === location.pathname && u.search === location.search)) return;
        e.preventDefault(); try { sessionStorage.setItem('grug.nav', '1'); } catch (x) {}
        document.documentElement.classList.add('g-leave'); setTimeout(() => { location.href = u.href; }, 90);
      });
      root.addEventListener('pageshow', e => { if (e.persisted) document.documentElement.classList.remove('g-leave', 'g-arrive'); });
    }
    const same = a => a && a.href && a.origin === location.origin && a.href.indexOf(ROOT) === 0 && !a.hasAttribute('download') && a.target !== '_blank' && !/#/.test(a.getAttribute('href') || '#');
    // Chrome: prerender site pages on hover/touch (not the heavy game apps or the 3D editor)
    try {
      if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
        const r = document.createElement('script'); r.type = 'speculationrules';
        const base = new URL(ROOT).pathname;
        r.textContent = JSON.stringify({ prerender: [{ where: { and: [{ href_matches: base + '*' }, { not: { href_matches: base + 'play/*' } }, { not: { href_matches: base + 'avatar/*' } }, { not: { href_matches: base + 'work/*' } }, { not: { href_matches: base + 'pearls.html*' } }] }, eagerness: 'moderate' }],
          prefetch: [{ where: { href_matches: base + '*' }, eagerness: 'moderate' }, { where: { selector_matches: '.g-tabs a' }, eagerness: 'immediate' }] });
        // the dock's pages are one tap away all the time: get them ready as soon as the pointer comes near
        const r2 = document.createElement('script'); r2.type = 'speculationrules';
        r2.textContent = JSON.stringify({ prerender: [{ where: { and: [{ selector_matches: '.g-tabs a, .g-menu a' }, { not: { href_matches: base + 'avatar/*' } }] }, eagerness: 'eager' }] });
        document.head.appendChild(r2);
        document.head.appendChild(r); return;
      }
    } catch (e) {}
    // elsewhere: a plain prefetch on hover / touch
    const done = new Set();
    const pre = e => { const a = e.target.closest && e.target.closest('a[href]'); if (!same(a) || done.has(a.href)) return; done.add(a.href);
      const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l); };
    document.addEventListener('pointerover', pre, { passive: true }); document.addEventListener('touchstart', pre, { passive: true });
  }

  /* ---------- light or dark (prefs.mode; theme.js applies it, the Games section stays dark either way) ---------- */
  const isLight = () => profile.prefs.mode !== 'dark';
  function setMode(m) {
    profile.prefs.mode = m === 'light' ? 'light' : 'dark'; save('prefs');
    if (root.GrugTheme) root.GrugTheme.apply();
    $$('[data-mode-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.modeSet === profile.prefs.mode)));
  }
  function modeHtml() {
    const cur = isLight() ? 'light' : 'dark';
    return '<div class="g-pref g-pref-col"><span><b>Light or dark</b><small>How the site looks. Games keep their own look</small></span><div class="g-seg" role="radiogroup" aria-label="Light or dark">' +
      [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([k, l, ic]) => '<button type="button" role="radio" data-mode-set="' + k + '" aria-checked="' + (cur === k) + '">' + icon(ic) + ' ' + l + '</button>').join('') + '</div></div>';
  }
  function wireMode(box) { $$('[data-mode-set]', box).forEach(b => b.addEventListener('click', () => { setMode(b.dataset.modeSet); buzz(); })); }
  /* shop mode (theme.js): the row in Settings that says whose site this looks like, and a way out */
  function brandHtml() {
    const b = root.GrugTheme && root.GrugTheme.brand(); if (!b) return '';
    return '<div class="g-pref g-brand-pref">' + (b.p && b.logo ? '<span class="g-brand-ic is-logo" aria-hidden="true"><img alt="" src="' + url(b.logo) + '"></span>' : '<span class="g-brand-ic" aria-hidden="true">' + shopIcon(b.i) + '</span>') + '<span><b>Visiting ' + esc(b.n) + (b.p && b.demo ? ' (demo)' : '') + '</b><small>' + (b.p ? 'Games and your avatar, in ' + esc(b.short || b.n) + ' colours' : 'The site wears their colours while you browse. Refreshing the page also ends it') + '</small></span>' +
      (b.p ? '' : '<button type="button" class="g-btn sm" data-brand-leave>Leave</button>') + '</div>';
  }
  function wireBrand(box) { const b = $('[data-brand-leave]', box); if (b) b.addEventListener('click', () => { root.GrugTheme.leaveBrand(); location.reload(); }); }

  /* ---------- appearance: nothing to pick any more. Each section has its own accent (theme.js), like Model Kit's modes.
     Kept so older pages that call it still work. ---------- */
  function appearance(box) { if (box) box.innerHTML = ''; }
  /* the UI size row (Settings and Profile): four sizes, applied everywhere on the site and in every game */
  function uiSizeHtml() {
    const names = { 0.85: 'Small', 1: 'Normal', 1.15: 'Large', 1.3: 'Huge' };
    return '<div class="g-pref g-pref-col"><span><b>UI size</b><small>Buttons, text and menus in every game and on the site</small></span>' +
      '<div class="g-seg" role="radiogroup" aria-label="UI size">' + UI_SCALES.map(z => '<button type="button" role="radio" data-ui="' + z + '" aria-checked="' + (profile.prefs.uiScale === z) + '">' + names[z] + '</button>').join('') + '</div></div>';
  }
  function wireUiSize(box, after) {
    $$('[data-ui]', box).forEach(b => b.addEventListener('click', () => {
      profile.prefs.uiScale = +b.dataset.ui; save('prefs'); applyUiScale(); buzz();
      $$('[data-ui]', box).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      if (after) after();
    }));
  }
  /* the inventory: site-wide items won from crates, with a Use button */
  function inventoryHtml() {
    const have = Object.keys(ITEMS).filter(id => itemCount(id) > 0);
    const left = freeShopLeft();
    let h = '<span class="k-set-h">Inventory</span>';
    if (!have.length) h += '<p class="g-fine g-inv-empty">' + icon('gift') + '<span>Nothing here yet. Every crate, egg and loot box in every game has a chance to drop a <b>' + ITEMS['free-shop'].name + '</b>.</span></p>';
    else h += '<div class="g-inv">' + have.map(id => { const it = ITEMS[id]; const busy = it.effect === 'freeShop' && left > 0;
      return '<div class="g-inv-it" data-inv="' + id + '"><span class="g-inv-ic" style="--c:' + it.hue + '">' + icon(it.icon) + '</span><span class="g-inv-tx"><b>' + esc(it.name) + (it.max > 1 ? ' ×' + itemCount(id) : '') + '</b><small>' + esc(it.desc) + '</small></span>' +
        '<button type="button" class="g-btn primary sm" data-use="' + id + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Running' : 'Use') + '</button></div>'; }).join('') + '</div>';
    if (left > 0) h += '<p class="g-fine">' + icon('ticket') + 'Free shop is on: ' + Math.ceil(left / 1000) + 's left.</p>';
    return h;
  }
  function wireInventory(box, rerender) {
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-use]'); if (!b) return;
      const it = ITEMS[b.dataset.use]; if (!it) return;
      const ok = await dialog({ title: 'Use ' + it.name + '?', html: '<p>' + esc(it.desc) + '</p><p class="g-fine">The timer starts right away, so head to a shop first if you want every second.</p>', actions: [{ label: 'Not yet', kind: 'quiet', value: null }, { label: 'Use it now', kind: 'primary', value: true }] });
      if (!ok) return;
      if (useItem(it.id)) { toast('Free shop! Everything is free for ' + it.minutes + ' minutes', { icon: 'ticket', ms: 4000 }); buzz([12, 40, 20]); freeBar(); } else toast('Wait for the current one to end', { icon: 'hourglass' });
      if (rerender) rerender();
    });
  }
  function settings() {
    return dialog({
      title: 'Settings', html: brandHtml() + (partnerOn() ? '' : modeHtml()) + (root.GrugTheme && root.GrugTheme.brand() ? '' : roleHtml()) + uiSizeHtml() +
        '<div class="g-pref"><span><b>Animations</b><small>Celebrations and poses</small></span><button type="button" class="g-switch" role="switch" data-pref="motion" aria-checked="' + !!profile.prefs.motion + '" aria-label="Animations"></button></div>' +
        '<div class="g-pref"><span><b>Vibrate on tap</b><small>A light buzz on phones that support it</small></span><button type="button" class="g-switch" role="switch" data-pref="haptics" aria-checked="' + !!profile.prefs.haptics + '" aria-label="Vibrate on tap"></button></div>' +
        '<div id="kInv"></div>' +
        '<p class="g-fine" style="margin-top:6px">Saved in your profile, so it comes along when you export it. Emotes are picked in the <a href="' + url('avatar/#emotes') + '" style="color:var(--ember);font-weight:800">avatar editor</a>. More in <a href="' + url('profile/') + '" style="color:var(--ember);font-weight:800">Profile</a>.</p>',
      actions: [{ label: 'Done', kind: 'primary', value: true }],
      onOpen: d => {
        d.classList.add('wide'); wireUiSize(d); wireMode(d); wireBrand(d);
        $$('[data-role-set]', d).forEach(b => b.addEventListener('click', () => { setRole(b.dataset.roleSet); $$('[data-role-set]', d).forEach(x => x.setAttribute('aria-checked', String(x === b))); buzz(); }));
        const inv = $('#kInv', d), paintInv = () => { inv.innerHTML = inventoryHtml(); }; paintInv(); wireInventory(inv, paintInv);
        $$('[data-pref]', d).forEach(b => b.addEventListener('click', () => {
          profile.prefs[b.dataset.pref] = !profile.prefs[b.dataset.pref]; save('prefs'); b.setAttribute('aria-checked', !!profile.prefs[b.dataset.pref]);
          if (root.GrugTheme) root.GrugTheme.apply(); buzz();
        }));
      }
    });
  }
  let chromeTabs = null;
  function setRole(r) {
    if (!(ROLES[r] || r === 'all')) return;
    profile.prefs.role = r; save('role');
    document.documentElement.setAttribute('data-role', r);
    if (chromeTabs) chromeTabs();
  }
  // the first-visit picker; resolves with the role picked ('all' if they skip it)
  function askRole() {
    let picked = null;
    const html = '<p class="g-fine" style="margin:-4px 0 12px">We\u2019ll show you the parts of Grug made for you. You can change this anytime in Settings.</p><div class="g-roles">' +
      Object.keys(ROLES).map(k => { const r = ROLES[k];
        return '<button type="button" data-role-pick="' + k + '" style="--rc:' + r.color + '"><span class="ic">' + icon(r.icon) + '</span><span><b>' + esc(r.label) + '</b><small>' + esc(r.text) + '</small></span>' + icon('caret-right') + '</button>'; }).join('') +
      '</div><button type="button" class="g-roles-all" data-role-pick="all">Show me everything</button>';
    return dialog({ title: 'Welcome to Grug! Who are you?', html, actions: [],
      onOpen: d => { d.classList.add('g-role-dialog'); $$('[data-role-pick]', d).forEach(b => b.addEventListener('click', () => { picked = b.dataset.rolePick; buzz(); d.close(''); })); }
    }).then(() => {
      const r = picked || 'all'; setRole(r);
      if (picked && picked !== 'all') toast('Set up for ' + ROLES[r].label.toLowerCase() + 's. Change it in Settings.', { icon: ROLES[r].icon, ms: 3600 });
      return r;
    });
  }
  function roleHtml() {
    const cur = roleOf() || 'all';
    return '<div class="g-pref g-pref-col"><span><b>I\u2019m a\u2026</b><small>Puts what\u2019s made for you first on the home page</small></span><div class="g-seg" role="radiogroup" aria-label="I am a">' +
      Object.keys(ROLES).map(k => '<button type="button" role="radio" data-role-set="' + k + '" aria-checked="' + (cur === k) + '">' + esc(ROLES[k].label) + '</button>').join('') +
      '<button type="button" role="radio" data-role-set="all" aria-checked="' + (cur === 'all') + '">Everything</button></div></div>';
  }
  const LOGO = '<svg class="g-mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="16" fill="#9BE338"/><path d="M19.8 51C19.5 50.9 18.9 50.9 18.4 50.9C17.2 50.9 17.1 50.7 17 48.6C16.8 46.5 17 45.5 17.9 43.8C18.1 43.3 18.3 42.8 18.3 42.8C18.3 42.6 19 41.2 19.3 40.7C19.8 39.8 19.8 39.8 19.7 39.6C19.5 38.9 19.2 38.3 18.8 37.8C17.9 36.4 17.6 35.3 17.7 34C17.8 32.5 18.1 32 19.1 31.1C19.5 30.8 19.9 30.5 20 30.5C20.5 30 21.2 29.7 21.7 29.7C22.5 29.7 22.8 29.4 22.8 28.8C22.8 27.9 23.5 28.4 23.6 29.3C23.6 30 23.1 30.5 21.7 30.8C20.7 31 20.2 33 21 33.9C21.9 35 25.6 34.7 26.6 33.5C26.6 33.4 26.7 33.4 26.7 33.4C26.8 33.4 27 33.3 27.3 33.2C27.5 33.1 28 32.9 28.2 32.8C29.5 32.4 29.8 32.4 30 32.4C30 32.4 30.3 32.3 30.5 32.2C31 32.1 31.5 32 33 31.9C34.8 31.8 35.5 31.7 35.8 31.6C35.9 31.5 36.2 31.4 36.4 31.4C37.8 31 38.2 30.7 39 29.2C39.6 28.1 39.6 25.4 39 24.6C38.9 24.5 38.8 24.4 38.8 24.4C38.8 24.3 38.1 23 37.9 22.8C37.8 22.7 37.3 22.4 36.8 22.1C36.3 21.8 35.8 21.5 35.7 21.5C35.3 21.2 33.8 20.9 32.9 20.9C32.5 20.9 32 20.9 31.9 20.8C31.8 20.8 31.5 20.7 31.3 20.7C30.3 20.5 30 20.3 29.2 19.5C28 18.3 27.9 17.7 28.3 15.9C28.4 15.7 28.5 15.4 28.5 15.3C28.6 15.2 28.7 15 28.7 14.9C29.1 14.2 29.8 13.4 30.4 13.3C31.1 13.1 31.3 13.1 32.3 13C33.2 13 34.1 13.1 34.9 13.3C35.2 13.3 35.6 13.4 35.8 13.5C36.7 13.6 37.3 13.8 38.7 14.4C39.5 14.7 40.5 15.4 41.3 16.1C41.5 16.2 41.9 16.5 42.1 16.6C42.2 16.8 42.5 17 42.6 17.1C42.7 17.3 42.9 17.5 43 17.6C43.3 18 43.8 18.7 44 19.2C44.1 19.5 44.3 19.9 44.5 20.1C44.6 20.3 44.8 20.6 44.8 20.9C44.9 21.1 45.1 21.4 45.3 21.7C45.5 21.9 45.6 22.2 45.7 22.3C45.7 22.4 45.8 22.7 45.8 22.9C45.9 23.1 46 23.6 46.1 23.9C46.2 24.2 46.4 24.6 46.4 24.7C46.6 25.2 46.8 26.3 46.9 26.8C46.9 27 47 27.4 47 27.7C47.1 28.3 47.1 32.1 46.9 32.4C46.9 32.5 46.9 33.2 46.9 34C46.9 34.8 46.9 35.6 46.8 35.8C46.8 36 46.7 36.3 46.7 36.5C46.6 36.9 46.5 37.4 46.4 37.7C46.3 37.8 46.3 38.1 46.2 38.3C46.2 38.6 46.1 38.9 46.1 39C46 39.1 46 39.3 45.9 39.5C45.6 40.7 45.3 41.5 45 42.3C45 42.4 44.9 42.7 44.8 43C44.7 43.4 44.5 43.9 44.3 44.3C44.1 44.7 43.9 45.2 43.8 45.5C43.7 45.8 43.6 46.1 43.5 46.2C43.5 46.2 43.5 46.3 43.5 46.3C43.5 46.4 43.4 46.5 43.3 46.7C43.2 46.8 43.1 47.1 43 47.2C43 47.3 42.9 47.5 42.8 47.7C42.6 47.9 42.4 48.3 42.3 48.6C41.1 50.8 41.2 50.8 38.3 50.8C34.9 50.8 34.8 50.7 34.8 49.5C34.8 49 34.8 48.8 34.7 48.6C33.3 46.1 32.8 45.5 31.8 45.2C31.6 45.1 31.3 45 31.1 45C30.4 44.8 29.9 44.9 28.2 45.4C27.2 45.7 26 46.8 26 47.5C26 47.6 26 47.7 26 47.7C25.9 47.8 25.9 48 25.8 48.2C25.8 48.4 25.6 48.8 25.4 49.1C25.3 49.4 25.2 49.7 25.2 49.7C25.2 50.3 24.3 50.8 23.4 50.8C23 50.9 22.5 50.9 22.3 50.9C22 51 20.6 51 19.8 51Z" fill="#1F1A17"/></svg>';

  let toastT;
  function toast(msg, opts) {
    opts = opts || {}; let t = $('#g-toast'); if (!t) { t = document.createElement('div'); t.id = 'g-toast'; t.className = 'g-toast'; document.body.appendChild(t); }
    t.innerHTML = (opts.img ? '<img alt="" src="' + opts.img + '">' : (opts.icon ? icon(opts.icon) : '')) + '<span>' + esc(msg) + '</span>';
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), opts.ms || 2800);
  }
  function buzz(p) { if (profile.prefs.haptics && navigator.vibrate) try { navigator.vibrate(p || 8); } catch (e) {} }
  // "You unlocked …" celebration for a list of items
  function celebrate(items) {
    if (!items || !items.length) return;
    const it = items[0]; const extra = items.length > 1 ? ' +' + (items.length - 1) + ' more' : '';
    toast('Unlocked: ' + it.name + extra, { icon: 'confetti', ms: 4000 }); buzz([12, 40, 20]);
  }

  // A sheet-style dialog. actions: [{label, kind:'primary'|'danger'|'quiet', value}] → resolves with the chosen value (null if dismissed)
  // onOpen(d) runs after it opens; onClose(d) runs before it's removed (read inputs there).
  function dialog(o) {
    return new Promise(resolve => {
      const d = document.createElement('dialog'); d.className = 'g-dialog';
      d.innerHTML = '<form method="dialog" class="g-dialog-in">' + (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + '<div class="g-dialog-body">' + (o.html || esc(o.text || '')) + '</div>' +
        '<div class="g-dialog-actions">' + (o.actions || [{ label: 'OK', kind: 'primary', value: true }]).map((a, i) => '<button class="g-btn ' + (a.kind || 'quiet') + '" value="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></form>';
      document.body.appendChild(d);
      d.addEventListener('close', () => { const i = d.returnValue === '' ? -1 : +d.returnValue; try { if (o.onClose) o.onClose(d); } catch (e) {} d.remove(); resolve(i >= 0 ? (o.actions || [{ value: true }])[i].value : null); });
      d.addEventListener('click', e => { if (e.target === d) d.close(''); });
      d.showModal();
      if (o.onOpen) o.onOpen(d);
    });
  }

  /* ---------- closet tiles (shared by shop, avatar editor and partner apps) ---------- */
  // state: 'owned' | 'wearing' | 'buy' | 'locked' | 'progress'
  function itemState(it, ctx) {
    ctx = ctx || {};
    if (wearing(it)) return 'wearing';
    if (owns(it.id)) return 'owned';
    if (it.get.type === 'points') return ctx.canBuy ? 'buy' : 'buyElsewhere';
    return 'progress';
  }
  /* a game as a FOSSIL32 box tile (assets/fossil32/: fossil32.js turns [data-f32] into a floating 3D box and opens the
     dark game stage on tap; without it the link goes to the game's page). opts.extra = more HTML for the body;
     opts.ribbon = a short label pinned to the box (the home carousel's "Last played");
     opts.kind = 'cart' shows the bare cartridge instead of the box (the home page). */
  function boxTile(g, opts) {
    opts = opts || {};
    const st = g.status === 'live' ? ['live', 'Live'] : g.status === 'legacy' ? ['legacy', 'Classic'] : ['soon', 'Demo'];
    const badge = '<span class="badge ' + st[0] + '"' + (st[0] === 'legacy' ? ' style="background:#6b7280;color:#fff"' : '') + '>' + st[1] + '</span>';
    const art = g.box && g.box.art ? g.box.art : g.thumb;
    const meta = icon(g.original ? 'sparkle' : 'storefront') + esc(g.original ? 'Grug Original' : g.partner) + '<span>·</span>' + esc(g.kind);
    const cart = opts.kind === 'cart';
    return '<a class="g-tile f32-tile' + (cart ? ' f32-cart' : '') + '" data-f32="' + esc(g.id) + '"' + (cart ? ' data-f32-kind="cart"' : '') + ' href="' + url('games/' + g.id + '/') + '" aria-label="' + esc(g.title) + ' (' + esc(g.kind) + ')">' +
      '<div class="f32-stage">' + badge + (opts.ribbon ? '<span class="f32-ribbon">' + icon('arrow-counter-clockwise') + esc(opts.ribbon) + '</span>' : '') + '<img class="f32-flat" src="' + url(art) + '" alt="" loading="lazy" decoding="async"></div>' +
      '<div class="body"><div class="title">' + esc(g.title) + '</div><div class="meta">' + meta + '</div>' + (opts.extra || '') + '</div></a>';
  }
  function itemTile(it, ctx) {
    ctx = ctx || {}; const st = itemState(it, ctx); const app = C.APPS[it.get.app] || C.APPS.grug;
    let foot = '';
    if (st === 'wearing') foot = '<span class="g-tag on">' + icon('check') + 'Wearing</span>';
    else if (st === 'owned') foot = '<span class="g-tag">Yours</span>';
    else if (freeShop()) foot = '<span class="g-tag free">' + icon('ticket') + 'FREE now</span>';
    else if (st === 'buy') foot = '<span class="g-tag pts">' + icon('coins') + fmt(it.get.cost) + ' points</span>';
    else if (st === 'buyElsewhere') foot = '<span class="g-tag pts">' + icon('coins') + fmt(it.get.cost) + ' at ' + esc(app.short) + '</span>';
    else { const p = progress(it); foot = '<span class="g-tag lock">' + icon('lock-simple') + (p ? p.have + '/' + p.need : '') + '</span>'; }
    return '<button type="button" class="g-item ' + st + '" data-item="' + it.id + '" data-slot="' + it.slot + '"><span class="g-item-pic" data-thumb="' + it.id + '"></span><span class="g-item-name">' + esc(it.name) + '</span>' + foot + '</button>';
  }
  // fill data-thumb placeholders with each design's picture (the avatar wearing it, made ahead of time)
  function fillThumbs(container) {
    $$('[data-thumb]', container).forEach(el => { const it = C.get(el.dataset.thumb); if (!it || el.dataset.done) return; el.dataset.done = '1';
      const src = url(it.thumb), im = new Image(); im.onload = im.onerror = () => { el.style.backgroundImage = 'url(' + src + ')'; el.classList.add('ld'); }; im.src = src; });
  }

  /* ---------- Discord feed ----------
     One webhook for the whole site. announce(kind, detail) posts:
       'logon'    {app}                     someone opened a game (once per game per phone every LOGON_GAP_MIN)
       'reward'   {app, points, pearls}     someone collected a check-in / tap reward
       'purchase' {pearls, price}           someone bought a Pearl pack
     Anyone who reads the page source can see the webhook. If it gets spammed, delete it in Discord
     (Server Settings → Integrations → Webhooks), make a new one and paste it here. */
  const DISCORD_WEBHOOK = '';   // paste your Discord webhook URL between the quotes ('' = feed off)
  const LOGON_GAP_MIN = 10, DKEY = 'grug.discord.v1';
  // what Pearls cost in the store (the 100-Pearl pack: $1.99), used to show earned Pearls in dollars in the feed
  const PEARL_USD = 1.99 / 100;
  const usd = pearls => '$' + (pearls * PEARL_USD).toFixed(2);
  const plain = s => String(s == null ? '' : s).replace(/[^A-Za-z0-9 .,$'&·:+\-()]/g, '').slice(0, 80);   // no markdown, mentions or links
  function appLabel(app) {
    const g = GAMES.find(x => x.app === app || x.id === app);
    return g ? '**' + plain(g.title) + '** (' + plain(g.partner) + ')' : '**' + plain(app || 'a Grug game') + '**';
  }
  function partnerName(app) { const g = GAMES.find(x => x.app === app || x.id === app); return plain(g ? g.partner : app || 'a Grug partner'); }
  function postDiscord(content) {
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(DISCORD_WEBHOOK)) return false;
    try {
      const f = new FormData(); f.append('payload_json', JSON.stringify({ content: String(content).slice(0, 1900), allowed_mentions: { parse: [] } }));
      fetch(DISCORD_WEBHOOK, { method: 'POST', body: f, mode: 'no-cors', keepalive: true }).catch(() => {});
      return true;
    } catch (e) { return false; }
  }
  function announce(kind, d) {
    d = d || {}; const who = '**' + plain(profile.name) + '**';
    if (kind === 'logon') {
      const log = readJSON(DKEY, {}) || {}; log.logon = log.logon && typeof log.logon === 'object' ? log.logon : {};
      const k = String(d.app || 'site'); if (Date.now() - (+log.logon[k] || 0) < LOGON_GAP_MIN * 60000) return false;
      log.logon[k] = Date.now(); writeJSON(DKEY, log);
      return postDiscord('🎮 ' + who + ' logged on to ' + appLabel(d.app));
    }
    if (kind === 'reward') {
      const bits = []; if (+d.points > 0) bits.push('+' + fmt(d.points) + ' points'); if (+d.pearls > 0) bits.push('+' + fmt(d.pearls) + ' Pearls (about ' + usd(+d.pearls) + ')');
      return postDiscord('🎁 ' + who + ' collected their daily reward at **' + partnerName(d.app) + '**' + (bits.length ? ': ' + bits.join(', ') : ''));
    }
    if (kind === 'purchase') return postDiscord('🫧 ' + who + ' bought **' + fmt(d.pearls) + ' Pearls**' + (d.price ? ' for ' + plain(d.price) : ''));
    return false;
  }

  /* ---------- public ---------- */
  root.Grug = {
    KEY, ROOT, url, esc, fmt, icon, GAMES, C,
    get profile() { return profile; }, get isNew() { return isNew; }, storageWorks,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    save, setName, setAvatar, equip, unequip, wearing, refreshPictures, owns, grant, track, totals, statValue, progress, checkMilestones, celebrate,
    favs,   // favourite and ignored games (the store, games/favorites/, the game pages)
    points, appState, venueOf, rewardsUrl, exportData, exportText, exportFilename, download, share, parseImport, applyImport, reset,
    snaps, ensureSnaps, randomName, cleanName, makeName, parseName, NAME_WORDS: { adj: ADJ.slice(), noun: NOUN.slice(), maxNum: NAME_MAX_NUM }, pearlBalance, pearlsUrl,
    announce,
    // site-wide items and live effects (see ITEMS above)
    ITEMS, itemCount, grantItem, useItem, crateRoll, freeShop, freeShopLeft, priceNow, BOOST_KEY, ITEM_DROP,
    // emotes: the catalog, the loadout and its limit
    EMOTES, EMOTE_MAX, emoteOf, get emotes() { return profile.emotes.slice(); },
    setEmotes(ids) { ids = Array.isArray(ids) ? Array.from(new Set(ids.filter(id => emoteOf(id)))).slice(0, EMOTE_MAX) : []; if (!ids.length) return false; profile.emotes = ids; save('emotes'); return true; },
    UI_SCALES, applyUiScale,
    LOGO,   // the Grug stegosaurus mark (an inline SVG)
    ROLES, get role() { return roleOf(); }, setRole, showsTab, partnerAllows,
    ui: { chrome, hub, shopIcon, askRole, toast, buzz, dialog, itemTile, itemState, fillThumbs, appearance, settings, avatarPic, boxTile, uiSizeHtml, wireUiSize, modeHtml, wireMode, setMode, brandHtml, wireBrand, inventoryHtml, wireInventory, freeBar }
  };
})(window);
