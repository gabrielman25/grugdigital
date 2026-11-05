/* Grug · grug.js — the shared core
   One local profile for the whole site (no accounts): name, avatar, closet, stats and settings live in this
   browser's localStorage under grug.profile.v1. Partner rewards apps keep their own points under their own keys;
   the profile export bundles all of them so a player can move to another phone.

   Load order on a page:  three.min.js (optional) → catalog.js → icons.js → games.js → avatar3d.js (optional) → grug.js
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
  function equip(id) {
    const it = C.get(id); if (!it || !owns(id)) return false;
    profile.avatar[it.slot] = id; profile.avatar = C.normalize(profile.avatar); save('avatar'); return true;
  }
  function unequip(slot) { if (slot === 'face' || slot === 'shirt' || slot === 'pants') return false; profile.avatar[slot] = null; save('avatar'); return true; }
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
    return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), site: ROOT, profile, apps };
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
    return { ok: true, data: { profile: p, apps }, summary: { name: p.name, items: p.inventory.length, exportedAt: d.exportedAt || '', points: pts } };
  }
  // Replace everything on this device with the file's contents.
  function applyImport(data) {
    const p = normalize(data.profile); p.updated = Date.now();
    GAMES.forEach(g => { if (g.storageKey && data.apps[g.storageKey] && typeof data.apps[g.storageKey] === 'object') writeJSON(g.storageKey, data.apps[g.storageKey]); });
    profile = p; writeJSON(KEY, profile); try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
    emit('import'); return true;
  }
  function reset(alsoPoints) {
    if (alsoPoints) GAMES.forEach(g => { if (g.storageKey) try { localStorage.removeItem(g.storageKey); } catch (e) {} });
    try { localStorage.removeItem(KEY); localStorage.removeItem(SNAP_KEY); } catch (e) {}
    profile = fresh(); writeJSON(KEY, profile); emit('reset');
  }

  /* ---------- avatar snapshots (PNG data URLs, cached per look) ---------- */
  function snaps() { const s = readJSON(SNAP_KEY, null); return s && C && s.hash === C.hash(profile.avatar) ? s : null; }
  function ensureSnaps(force) {
    const A = root.GrugAvatar; if (!A) return snaps();
    const cur = snaps(); if (cur && !force) return cur;
    try {
      const a = profile.avatar;
      const s = { hash: C.hash(a), at: Date.now(),
        bust: A.snapshot(a, { size: 160, bust: true, yaw: 0.3 }),
        full: A.snapshot(a, { size: 200, height: 260, yaw: 0.35 }),
        happy: A.snapshot(a, { size: 160, bust: true, yaw: 0.3, pose: 'happy' }),
        sad: A.snapshot(a, { size: 160, bust: true, yaw: 0.3, pose: 'sad' }),
        cheer: A.snapshot(a, { size: 200, height: 260, yaw: 0.2, pose: 'cheer' }) };
      writeJSON(SNAP_KEY, s); emit('snaps'); return s;
    } catch (e) { console.warn('snapshot failed', e); return null; }
  }

  /* ---------- icons ---------- */
  function icon(name, cls) { const d = ICONS[name]; return '<svg class="gi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="' + (d || ICONS.question || '') + '"/></svg>'; }

  /* ---------- UI chrome: header + tab bar ---------- */
  const NAV = [
    ['home', 'Home', 'house', ''], ['games', 'Games', 'game-controller', 'games/'], ['avatar', 'Avatar', 't-shirt', 'avatar/'],
    ['shop', 'Shop', 'storefront', 'shop/'], ['profile', 'Profile', 'user', 'profile/']
  ];
  function chrome(active, opts) {
    opts = opts || {};
    const face = snaps(); const faceImg = face ? '<img class="g-face" alt="" src="' + face.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>';
    const top = document.createElement('header'); top.className = 'g-top';
    top.innerHTML = '<a class="g-logo" href="' + url('') + '" aria-label="Grug home">' + LOGO + '<span>Grug</span></a>' +
      '<nav class="g-nav" aria-label="Site">' + NAV.map(n => '<a href="' + url(n[3]) + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span></a>').join('') + '</nav>' +
      '<a class="g-me" href="' + url('profile/') + '" aria-label="Your profile"><span class="g-me-name">' + esc(profile.name) + '</span>' + faceImg + '</a>';
    const tabs = document.createElement('nav'); tabs.className = 'g-tabs'; tabs.setAttribute('aria-label', 'Sections');
    tabs.innerHTML = NAV.map(n => '<a href="' + url(n[3]) + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span></a>').join('');
    document.body.prepend(top); document.body.appendChild(tabs);
    document.body.classList.add('g-chrome');
    if (!$('#g-toast')) { const t = document.createElement('div'); t.id = 'g-toast'; t.className = 'g-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    root.addEventListener('grug:change', () => { const s = snaps(); const el = $('.g-me', top); if (!el) return; el.innerHTML = '<span class="g-me-name">' + esc(profile.name) + '</span>' + (s ? '<img class="g-face" alt="" src="' + s.bust + '">' : '<span class="g-face g-face-empty">' + icon('smiley') + '</span>'); });
    return top;
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
    if (profile.avatar[it.slot] === it.id) return 'wearing';
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
  // fill data-thumb placeholders with renders of the current avatar wearing each item, a few per frame
  function fillThumbs(container, avatar) {
    const A = root.GrugAvatar; if (!A) return;
    const els = $$('[data-thumb]', container).filter(el => !el.dataset.done);
    let i = 0;
    function step() {
      const t0 = performance.now();
      while (i < els.length && performance.now() - t0 < 24) {
        const el = els[i++]; const id = el.dataset.thumb; const it = C.get(id); if (!it) continue;
        const a = Object.assign({}, avatar || profile.avatar);
        try { el.style.backgroundImage = 'url(' + A.thumb(id, a, 128) + ')'; el.dataset.done = '1'; } catch (e) { el.dataset.done = 'x'; }
      }
      if (i < els.length) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- public ---------- */
  root.Grug = {
    KEY, ROOT, url, esc, fmt, icon, GAMES, C,
    get profile() { return profile; }, get isNew() { return isNew; }, storageWorks,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    save, setName, setAvatar, equip, unequip, owns, grant, track, totals, statValue, progress, checkMilestones, celebrate,
    points, appState, exportData, exportText, exportFilename, download, share, parseImport, applyImport, reset,
    snaps, ensureSnaps, randomName, cleanName,
    ui: { chrome, toast, buzz, dialog, itemTile, itemState, fillThumbs }
  };
})(window);
