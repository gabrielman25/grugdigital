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

  const ADJ = ['Spicy', 'Sleepy', 'Mighty', 'Chill', 'Brave', 'Sunny', 'Turbo', 'Lucky', 'Cozy', 'Crunchy', 'Zesty', 'Golden', 'Sneaky', 'Jolly', 'Frosty', 'Rowdy'];
  const NOUN = ['Kolache', 'Boba', 'Taco', 'Donut', 'Sushi', 'Latte', 'Cupcake', 'Dumpling', 'Pearl', 'Churro', 'Biscuit', 'Mango', 'Waffle', 'Pickle', 'Noodle', 'Pecan'];
  const randomName = () => ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];

  /* ---------- the profile ---------- */
  function fresh() {
    const now = Date.now();
    return {
      v: 1, id: rid(), name: randomName(), created: now, updated: now,
      avatar: C ? C.normalize(null) : {},
      inventory: [],            // earned (non-free) item ids
      earned: {},               // item id → {at, how}
      stats: { plays: {}, checkins: {}, best: {}, course: {}, days: {}, lastGame: '', lastPlayed: 0 },
      prefs: { motion: true, haptics: true },
      seen: {}                  // one-time hints
    };
  }
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
      seen: p.seen && typeof p.seen === 'object' ? p.seen : {}
    };
    ['plays', 'checkins', 'best', 'course', 'days'].forEach(k => { if (!o.stats[k] || typeof o.stats[k] !== 'object') o.stats[k] = {}; });
    o.inventory = Array.from(new Set(o.inventory));
    return o;
  }
  function cleanName(n) { return String(n == null ? '' : n).replace(/[^\w .'\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20); }

  let profile = normalize(readJSON(KEY, null));
  let isNew = false;
  try { isNew = !localStorage.getItem(KEY); if (isNew) localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}   // a first visit gets its name and id right away
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
    const run = () => root.SandyView.makeSnaps(c || look()).then(() => emit('snaps')).catch(() => {});
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

  /* ---------- partner points (read from each app's own storage) ---------- */
  function appState(game) { return game && game.storageKey ? readJSON(game.storageKey, null) : null; }
  function points() {
    return GAMES.filter(g => g.storageKey).map(g => {
      const s = appState(g) || {};
      return { game: g, points: Math.max(0, +s.points || 0), best: +(s.game && s.game.best) || 0, runs: +(s.game && s.game.runs) || 0, visits: Array.isArray(s.history) ? s.history.filter(h => h && h.pts > 0).length : 0, has: !!localStorage.getItem(g.storageKey) };
    });
  }

  /* ---------- export / import ---------- */
  function exportData() {
    const apps = {};
    GAMES.forEach(g => { if (g.storageKey) { const v = localStorage.getItem(g.storageKey); if (v) { try { apps[g.storageKey] = JSON.parse(v); } catch (e) {} } } });
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
    const pts = GAMES.filter(g => g.storageKey && apps[g.storageKey]).map(g => ({ game: g, points: Math.max(0, +apps[g.storageKey].points || 0) }));
    const sandy = d.sandy && typeof d.sandy === 'object' && !Array.isArray(d.sandy) ? d.sandy : null;
    return { ok: true, data: { profile: p, apps, sandy }, summary: { name: p.name, items: p.inventory.length, exportedAt: d.exportedAt || '', points: pts } };
  }
  // Replace everything on this device with the file's contents.
  function applyImport(data) {
    const p = normalize(data.profile); p.updated = Date.now();
    GAMES.forEach(g => { if (g.storageKey && data.apps[g.storageKey] && typeof data.apps[g.storageKey] === 'object') writeJSON(g.storageKey, data.apps[g.storageKey]); });
    profile = p; writeJSON(KEY, profile); try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
    if (data.sandy) { writeJSON('grug.sandy.v1', data.sandy); try { localStorage.removeItem('grug.sandy.snaps.v1'); } catch (e) {} }
    emit('import'); return true;
  }
  function reset(alsoPoints) {
    if (alsoPoints) GAMES.forEach(g => { if (g.storageKey) try { localStorage.removeItem(g.storageKey); } catch (e) {} });
    try { localStorage.removeItem(KEY); localStorage.removeItem(SNAP_KEY); localStorage.removeItem('grug.sandy.v1'); localStorage.removeItem('grug.sandy.snaps.v1'); } catch (e) {}
    profile = fresh(); writeJSON(KEY, profile); emit('reset');
  }

  /* ---------- avatar snapshots: pictures of the new 3D avatar (Sandy) ----------
     The avatar editor (avatar/) renders them whenever the look changes and caches them in 'grug.sandy.snaps.v1'
     (see assets/sandy-view.js). Until someone makes their own, everyone gets the default look's pictures. */
  const SANDY_KEY = 'grug.sandy.v1', SANDY_SNAPS = 'grug.sandy.snaps.v1';
  const sandyHash = (o) => { const s = JSON.stringify(o || null); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  function snaps() {
    const s = readJSON(SANDY_SNAPS, null), c = readJSON(SANDY_KEY, null);
    if (s && s.bust && (!c || s.hash === sandyHash(c))) return s;
    const d = url('assets/sandy/');
    return { def: true, bust: d + 'bust.png', full: d + 'full.png', happy: d + 'happy.png', sad: d + 'sad.png', cheer: d + 'cheer.png' };
  }
  function ensureSnaps() { return snaps(); }
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
  function icon(name, cls) { const d = ICONS[name]; return '<svg class="gi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="' + (d || ICONS.question || '') + '"/></svg>'; }

  /* ---------- UI chrome: floating top bar + dock (kubii theme) ---------- */
  const NAV = [
    ['home', 'Home', 'house', ''], ['games', 'Games', 'game-controller', 'games/'], ['avatar', 'Avatar', 't-shirt', 'avatar/'],
    ['shop', 'Shop', 'storefront', 'shop/'], ['profile', 'Profile', 'user', 'profile/']
  ];
  // glossy dock icons (gradient ids are unique per page: there is only one dock)
  const DOCK = {
    home: '<svg class="k-ic" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="kdH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecfccb"/><stop offset=".5" stop-color="#a3e635"/><stop offset="1" stop-color="#4d7c0f"/></linearGradient></defs><path d="M24 4.5 43.5 20.5c1.6 1.3.7 4-1.4 4H41v14.8a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V24.5H5.9c-2.1 0-3-2.7-1.4-4z" fill="url(#kdH)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><rect x="18" y="27" width="12" height="16.3" rx="4.5" fill="#fff"/><path d="M12 22 24 12l7 5.6" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    games: '<svg class="k-ic" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="kdG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#99f6e4"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs><path d="M15 12h18c7 0 11 6 12 14 1 8-1 12-5 12-3.5 0-5.5-3-7.5-5.5h-17C13.5 35 11.5 38 8 38c-4 0-6-4-5-12 1-8 5-14 12-14z" fill="url(#kdG)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><rect x="11" y="20.5" width="10" height="3.6" rx="1.3" fill="#fff"/><rect x="14.2" y="17.3" width="3.6" height="10" rx="1.3" fill="#fff"/><circle cx="31" cy="20.5" r="2.5" fill="#fff"/><circle cx="36" cy="25.5" r="2.5" fill="#fff"/><path d="M14 15.5h20" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/></svg>',
    avatar: '<svg class="k-ic" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="kdA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fed7aa"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs><rect x="6" y="6" width="36" height="36" rx="11" fill="url(#kdA)" stroke="#fff" stroke-width="2.6"/><rect x="16.5" y="17" width="4" height="7" rx="2" fill="#4c0519"/><rect x="27.5" y="17" width="4" height="7" rx="2" fill="#4c0519"/><path d="M16 29.5q8 7 16 0" stroke="#4c0519" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 15q0-4 4-4" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
    shop: '<svg class="k-ic" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="kdS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5d0fe"/><stop offset="1" stop-color="#d946ef"/></linearGradient></defs><path d="M17 16v-3a7 7 0 0 1 14 0v3" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M9.5 15h29l2.5 23.5a4 4 0 0 1-4 4.5H11a4 4 0 0 1-4-4.5z" fill="url(#kdS)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><circle cx="17" cy="22" r="2.2" fill="#fff"/><circle cx="31" cy="22" r="2.2" fill="#fff"/><path d="M16 30q8 6 16 0" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round"/></svg>',
    profile: '<svg class="k-ic" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="kdP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><circle cx="24" cy="17" r="10" fill="url(#kdP)" stroke="#fff" stroke-width="2.6"/><path d="M7 42c1.5-9 8.5-14 17-14s15.5 5 17 14z" fill="url(#kdP)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M19 12.5q2-2.5 5-2.5" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
  };
  const totalPoints = () => { try { return points().reduce((s, p) => s + (+p.points || 0), 0); } catch (e) { return 0; } };
  /* ---------- Pearls (the site-wide currency, sold on pearls.html; wallet in 'grug.pearls.v1') ---------- */
  const PEARL_KEY = 'grug.pearls.v1';
  const pearlBalance = () => { const w = readJSON(PEARL_KEY, null); return Math.max(0, Math.floor(+(w && w.balance) || 0)); };
  // the Pearls page, with a way back to where the guest is now
  const pearlsUrl = app => /pearls\.html$/.test(location.pathname) ? location.pathname + location.search : url('pearls.html') + '?from=' + encodeURIComponent(location.pathname + location.search + location.hash) + '&app=' + encodeURIComponent(app || 'Grug');
  function chrome(active, opts) {
    opts = opts || {};
    const face = snaps(); const faceImg = face ? '<img class="g-face" alt="" src="' + face.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>';
    const navLabel = (NAV.find(n => n[0] === active) || NAV[0])[1];
    const titleBit = (document.title.split(' · ').find(x => x && x !== 'Grug') || navLabel);
    const pageTitle = opts.title || (/^games made/i.test(titleBit) ? 'Home' : titleBit);
    const top = document.createElement('header'); top.className = 'g-top';
    top.innerHTML = '<a class="g-logo k-glass" href="' + url('') + '" aria-label="Grug home">' + LOGO + '<span>Grug</span></a>' +
      '<div class="g-title k-glass" aria-hidden="true"><small>' + esc(pageTitle === navLabel ? 'Grug' : navLabel) + '</small><b>' + esc(pageTitle) + '</b></div>' +
      '<div class="g-status k-glass"><a class="g-pts" href="' + pearlsUrl() + '" title="Your Pearls · tap to get more" aria-label="Pearls: get more">' + icon('coins') + '<span class="num">' + fmt(pearlBalance()) + '</span><span class="g-plus" aria-hidden="true">+</span></a><span class="g-sep"></span>' +
      '<button type="button" class="g-gear" aria-label="Settings" title="Settings">' + icon('gear-six') + '</button></div>' +
      '<button type="button" class="g-me" aria-label="Your account menu" aria-haspopup="menu" aria-expanded="false"><span class="g-me-name">' + esc(profile.name) + '</span>' + faceImg + '</button>';
    const tabs = document.createElement('nav'); tabs.className = 'g-tabs k-glass'; tabs.setAttribute('aria-label', 'Sections');
    tabs.innerHTML = '<span class="k-sb l" aria-hidden="true">LB</span><span class="k-sb r" aria-hidden="true">RB</span>' +
      NAV.map(n => '<a href="' + url(n[3]) + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + DOCK[n[0]] + '<span>' + n[1] + '</span></a>').join('');
    document.body.prepend(top); document.body.appendChild(tabs);
    document.body.classList.add('g-chrome');
    $('.g-gear', top).addEventListener('click', () => settings());
    // the account menu under the avatar
    const menu = document.createElement('div'); menu.className = 'g-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
    const paintMenu = () => { const f = snaps();
      menu.innerHTML = '<div class="g-menu-h"><img alt="" src="' + f.bust + '"><div><b>' + esc(profile.name) + '</b><small>' + fmt(pearlBalance()) + ' Pearls · ' + fmt(totalPoints()) + ' partner points</small></div></div>' +
        '<a role="menuitem" class="hot" href="' + pearlsUrl() + '">' + icon('coins') + '<span>Buy Pearls</span>' + icon('caret-right') + '</a>' +
        '<a role="menuitem" href="' + url('profile/') + '">' + icon('user') + '<span>Profile</span></a>' +
        '<a role="menuitem" href="' + url('avatar/') + '">' + icon('t-shirt') + '<span>Edit avatar</span></a>' +
        '<a role="menuitem" href="' + url('shop/?mine') + '">' + icon('shopping-bag') + '<span>My closet</span></a>' +
        '<button type="button" role="menuitem" data-m="settings">' + icon('gear-six') + '<span>Settings</span></button>'; };
    document.body.appendChild(menu);
    const meBtn = $('.g-me', top);
    const setMenu = on => { if (on) paintMenu(); menu.hidden = !on; meBtn.setAttribute('aria-expanded', String(on)); if (on) { const f = $('[role=menuitem]', menu); if (f) f.focus({ preventScroll: true }); } };
    meBtn.addEventListener('click', e => { e.stopPropagation(); buzz(); setMenu(menu.hidden); });
    menu.addEventListener('click', e => { const b = e.target.closest('[data-m=settings]'); if (b) { setMenu(false); settings(); } });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); meBtn.focus(); } });
    const paintPearls = () => { const pt = $('.g-pts .num', top); if (pt) pt.textContent = fmt(pearlBalance()); const a = $('.g-pts', top); if (a) a.href = pearlsUrl(); };
    root.addEventListener('storage', e => { if (e.key === PEARL_KEY) paintPearls(); });
    root.addEventListener('pageshow', paintPearls);
    if (!$('#g-toast')) { const t = document.createElement('div'); t.id = 'g-toast'; t.className = 'g-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    root.addEventListener('grug:change', () => {
      const s = snaps(); const el = $('.g-me', top); if (!el) return;
      el.innerHTML = '<span class="g-me-name">' + esc(profile.name) + '</span>' + (s ? '<img class="g-face" alt="" src="' + s.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>');
      paintPearls();
    });
    // LB / RB: Q and E (or a controller's shoulder buttons) step through the dock
    const idx = Math.max(0, NAV.findIndex(n => n[0] === active));
    const go = d => { location.href = url(NAV[(idx + d + NAV.length) % NAV.length][3]); };
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.querySelector('dialog[open]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase(); if (k === 'q') go(-1); else if (k === 'e') go(1);
    });
    root.addEventListener('gamepadconnected', () => {
      let prev = {};
      (function poll() {
        const p = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).find(Boolean);
        if (p) { [[4, -1], [5, 1]].forEach(([i, d]) => { const on = !!(p.buttons[i] && p.buttons[i].pressed); if (on && !prev[i]) go(d); prev[i] = on; }); }
        requestAnimationFrame(poll);
      })();
    }, { once: true });
    speed();
    return top;
  }

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
        document.documentElement.classList.add('g-leave'); setTimeout(() => { location.href = u.href; }, 150);
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
          prefetch: [{ where: { href_matches: base + '*' }, eagerness: 'moderate' }] });
        document.head.appendChild(r); return;
      }
    } catch (e) {}
    // elsewhere: a plain prefetch on hover / touch
    const done = new Set();
    const pre = e => { const a = e.target.closest && e.target.closest('a[href]'); if (!same(a) || done.has(a.href)) return; done.add(a.href);
      const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l); };
    document.addEventListener('pointerover', pre, { passive: true }); document.addEventListener('touchstart', pre, { passive: true });
  }

  /* ---------- appearance: Light / Dark / Auto + themes (used by the gear sheet and Profile) ---------- */
  function appearance(box) {
    const T = root.GrugTheme; if (!T || !box) return;
    const draw = () => {
      const s = T.prefs(), t = T.THEMES[s.theme];
      const L = 'hsl(' + t.h + ' 42% 93%)', D = 'hsl(' + t.h + ' 35% 9%)', LP = '#fff', DP = 'hsl(' + t.h + ' 24% 21%)', acc = 'linear-gradient(90deg,' + t.a + ',' + t.b + ')';
      const pv = m => m === 'light' ? '<span class="pv" style="background:' + L + '"><i style="background:' + LP + '"></i><i style="background:' + acc + '"></i></span>'
        : m === 'dark' ? '<span class="pv" style="background:' + D + '"><i style="background:' + DP + '"></i><i style="background:' + acc + '"></i></span>'
        : '<span class="pv" style="background:linear-gradient(135deg,' + L + ' 50%,' + D + ' 50%)"><i style="background:linear-gradient(135deg,' + LP + ' 50%,' + DP + ' 50%)"></i><i style="background:' + acc + '"></i></span>';
      box.innerHTML =
        '<span class="k-set-h">Light or dark</span><div class="k-modes" role="radiogroup" aria-label="Light or dark">' +
        [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(m => '<button type="button" class="k-mode" role="radio" aria-checked="' + (s.mode === m[0]) + '" data-mode="' + m[0] + '">' + pv(m[0]) + m[1] + '</button>').join('') + '</div>' +
        '<span class="k-set-h">Theme</span><div class="k-themes" role="radiogroup" aria-label="Theme">' +
        Object.keys(T.THEMES).map(k => { const th = T.THEMES[k]; return '<button type="button" class="k-theme" role="radio" aria-checked="' + (s.theme === k) + '" data-theme-id="' + k + '"><span class="sw" style="background:linear-gradient(135deg,' + th.a + ',' + th.b + ')"></span><span class="dots"><i style="background:' + th.a + '"></i><i style="background:' + th.b + '"></i><i style="background:' + th.hotA + '"></i><i style="background:' + th.hotB + '"></i></span><span><b>' + th.name + '</b><br><small>' + th.note + '</small></span></button>'; }).join('') + '</div>' +
        '<div class="g-pref" style="margin-top:8px"><span><b>Moving background</b><small>Slow waves in the backdrop</small></span><button type="button" class="g-switch" role="switch" aria-checked="' + s.backdrop + '" data-k="backdrop" aria-label="Moving background"></button></div>';
    };
    draw();
    box.addEventListener('click', e => {
      const m = e.target.closest('[data-mode]'), th = e.target.closest('[data-theme-id]'), sw = e.target.closest('[data-k]');
      if (m) T.set({ mode: m.dataset.mode }); else if (th) T.set({ theme: th.dataset.themeId }); else if (sw) T.set({ [sw.dataset.k]: !T.prefs()[sw.dataset.k] }); else return;
      buzz(); draw();
    });
  }
  function settings() {
    return dialog({
      title: 'Settings', html: '<div id="kAppear"></div>' +
        '<div class="g-pref"><span><b>Animations</b><small>Celebrations, poses and the moving backdrop</small></span><button type="button" class="g-switch" role="switch" data-pref="motion" aria-checked="' + !!profile.prefs.motion + '" aria-label="Animations"></button></div>' +
        '<div class="g-pref"><span><b>Vibrate on tap</b><small>A light buzz on phones that support it</small></span><button type="button" class="g-switch" role="switch" data-pref="haptics" aria-checked="' + !!profile.prefs.haptics + '" aria-label="Vibrate on tap"></button></div>' +
        '<p class="g-fine" style="margin-top:6px">Saved in your profile, so it comes along when you export it. More in <a href="' + url('profile/') + '" style="color:var(--ember);font-weight:800">Profile</a>.</p>',
      actions: [{ label: 'Done', kind: 'primary', value: true }],
      onOpen: d => {
        d.classList.add('wide'); appearance($('#kAppear', d));
        $$('[data-pref]', d).forEach(b => b.addEventListener('click', () => {
          profile.prefs[b.dataset.pref] = !profile.prefs[b.dataset.pref]; save('prefs'); b.setAttribute('aria-checked', !!profile.prefs[b.dataset.pref]);
          if (root.GrugTheme) root.GrugTheme.apply(); buzz();
        }));
      }
    });
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
  function itemTile(it, ctx) {
    ctx = ctx || {}; const st = itemState(it, ctx); const app = C.APPS[it.get.app] || C.APPS.grug;
    let foot = '';
    if (st === 'wearing') foot = '<span class="g-tag on">' + icon('check') + 'Wearing</span>';
    else if (st === 'owned') foot = '<span class="g-tag">Yours</span>';
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

  /* ---------- public ---------- */
  root.Grug = {
    KEY, ROOT, url, esc, fmt, icon, GAMES, C,
    get profile() { return profile; }, get isNew() { return isNew; }, storageWorks,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    save, setName, setAvatar, equip, unequip, wearing, refreshPictures, owns, grant, track, totals, statValue, progress, checkMilestones, celebrate,
    points, appState, exportData, exportText, exportFilename, download, share, parseImport, applyImport, reset,
    snaps, ensureSnaps, randomName, cleanName, pearlBalance, pearlsUrl,
    ui: { chrome, toast, buzz, dialog, itemTile, itemState, fillThumbs, appearance, settings, avatarPic }
  };
})(window);
