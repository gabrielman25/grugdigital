/* Grug · gamehost.js — the standalone game host
   Every game on the site is a standalone game: play/<game>/index.html is a thin page that loads this script and calls
   GrugGameHost({...}). It opens play/<game>/game.html full screen under a slim bar (Back, the game's name, the wallet)
   and answers the game kit's messages (window.postMessage, every message carries rw:1):

     game → host  {t:'hello'}               ← {t:'state', points, pearls, pearlName, standalone, inv, best, runs, shop, title, collectible, runSeconds, brand, store, …}
                  {t:'buy', id, req}        ← {t:'reply', req, ok, reason?, state}   (Pearls first, then the brand's coins; inv[id] + 1)
                  {t:'use', ids:[…], req}   ← {t:'reply', req, ok, reason?, state}   (inv - 1 each; passes are kept)
                  {t:'score', score, …}       keeps the best score and counts the run (and the Grug milestones)
                  {t:'needPearls', id}        offers the Pearls page, then comes straight back here
                  {t:'club', active, since, rev}   (Barista Blitz) joined or left the club in the game
     host → game  {t:'pause'} when the tab is hidden; a fresh {t:'state'} whenever Pearls or coins change.

   Money: Pearls (the site-wide wallet 'grug.pearls.v1') buy everything, in every game, everywhere.
   A game made with a venue names it in `brand` (a PARTNERS id in theme.js). While the site is wrapped in that brand
   (partner mode), the venue's own coins (its rewards app's wallet) also pay, after Pearls: `rate` coins make one point
   (PARTNERS[brand].wallet.rate, 25 by default), so a shop item that costs 5 costs 5 Pearls or 125 coins.

   GAME = {
     id, app            the games.js id, and the Grug app id for stats and milestones (GrugApp.onScore)
     title, src         the game's own name; its file (game.html next to the host page, or a path with ?query)
     collectible, runSeconds, storageKey ('grug-<id>-v1': owned items, best, runs, club)
     shop: [{id, name, desc, cost, effect, amount, …}]     prices in Pearls (= points)
     brand              optional PARTNERS id whose coins work here in partner mode
     store, colors      optional: the venue line and colours the game shows (state.store, state.brand)
     extra()            optional: more fields for the state (Turbo Suds' rank from visits, say)
     migrate: {key, game}   optional: the old rewards app's save that held this game's items, best and runs
     passes: true       optional: items with effect 'pass' are kept forever (buying one twice is refused)
   }
*/
(function (root) {
  'use strict';
  const INV_MAX = 99, WKEY = 'grug.pearls.v1';
  const readJSON = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  root.GrugGameHost = function (GAME) {
    const G = root.Grug, $ = id => document.getElementById(id);
    const T = root.GrugTheme, partner = T && T.partner && T.partner();
    const P = GAME.brand && T && T.PARTNERS ? T.PARTNERS[GAME.brand] : null;
    // the venue's coins pay here only while the site is wrapped in that venue
    const W = P && P.wallet && partner && partner.p === GAME.brand ? Object.assign({ rate: 25, field: 'coins' }, P.wallet) : null;

    /* ---------- this game's own save: owned items, best, runs ---------- */
    function load() {
      let s = readJSON(GAME.storageKey);
      if (!s && GAME.migrate) {   // first time here: bring over what the old rewards app kept for this game
        const o = readJSON(GAME.migrate.key);
        if (o) { const g = o[GAME.migrate.game || 'game'] || {}, ids = (GAME.shop || []).map(it => it.id), inv = {};
          Object.entries(o.inv || {}).forEach(([k, v]) => { if (ids.includes(k)) inv[k] = v; });   // (the old app's bag was shared by two games)
          s = { v: 1, inv, game: { best: +g.best || 0, runs: +g.runs || 0 }, club: o.club, moved: Date.now() }; writeJSON(GAME.storageKey, s); }
      }
      s = s || {};
      const inv = {}; Object.entries(s.inv && typeof s.inv === 'object' ? s.inv : {}).forEach(([k, v]) => { if (+v > 0) inv[k] = Math.min(INV_MAX, Math.floor(+v)); });
      return { v: 1, inv, game: Object.assign({ best: 0, runs: 0 }, s.game || {}), club: s.club && typeof s.club === 'object' ? s.club : { active: false, since: 0, rev: 0 } };
    }
    let st = load();
    const save = () => writeJSON(GAME.storageKey, st);

    /* ---------- Pearls: the site-wide wallet ---------- */
    const wRaw = () => readJSON(WKEY) || { v: 1 };
    const pearls = () => Math.max(0, Math.floor(+wRaw().balance || 0));
    function pearlsChange(d) { const w = wRaw(); w.v = 1; w.balance = Math.max(0, Math.floor(+w.balance || 0) + d); writeJSON(WKEY, w); paint(); }
    /* ---------- the venue's coins (partner mode only) ---------- */
    const coins = () => { if (!W) return 0; const s = readJSON(W.key); return Math.max(0, Math.floor(+(s && s[W.field]) || 0)); };
    const points = () => W ? Math.floor(coins() / W.rate) : 0;
    function coinsChange(d) { if (!W) return; const s = readJSON(W.key) || {}; s[W.field] = Math.max(0, Math.floor(+s[W.field] || 0) + d); writeJSON(W.key, s); paint(); }
    const pearlsLink = () => G.pearlsUrl(GAME.title);
    function paint() {
      const a = $('rrPearls'); if (a) { a.innerHTML = G.icon('pearl') + '<b>' + G.fmt(pearls()) + '</b><i>+</i>'; a.href = pearlsLink(); }
      const c = $('rrCoins'); if (c) { c.hidden = !W; if (W) c.innerHTML = '<i class="rr-coin"></i><b>' + G.fmt(coins()) + '</b>'; }
    }

    /* ---------- the page: the bar and the game frame ---------- */
    document.title = GAME.title + ' · Grug';
    const css = document.createElement('style'), bg = GAME.bg || '#0b0e14';
    css.textContent = 'html,body{margin:0;height:100%;overflow:hidden;background:' + bg + '}' +
      '.rr-bar{position:fixed;left:0;right:0;top:0;height:calc(52px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 10px 0;display:flex;align-items:center;gap:8px;background:#fff;z-index:2;box-sizing:border-box}' +
      '.rr-bar a{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:#111827;font:700 16px/1 var(--g-font, system-ui, sans-serif)}' +
      '.rr-back{width:42px;height:42px;border-radius:50%;justify-content:center;background:#ebedf2;flex:none}' +
      '.rr-back svg,.rr-pl svg{width:20px;height:20px}' +
      '.rr-t{flex:1;min-width:0;font:700 18px/1.1 var(--g-font, system-ui, sans-serif);color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rr-pl{height:42px;padding:0 14px 0 10px;border-radius:999px;background:#ebedf2;flex:none}' +
      '.rr-pl b{font-weight:700}.rr-pl i{font-style:normal;color:#6b7280;font-weight:700}' +
      '.rr-pl .rr-coin{width:22px;height:22px;border-radius:50%;background:var(--rr-coin) center/cover no-repeat,#e5bd2f}' +
      '#rrFrame{position:fixed;left:0;right:0;bottom:0;top:calc(52px + env(safe-area-inset-top));width:100%;height:calc(100% - 52px - env(safe-area-inset-top));border:0;display:block;background:' + bg + '}' +
      '@media (max-width:380px){.rr-t{font-size:16px}.rr-pl{padding:0 10px 0 8px}}';
    document.head.appendChild(css);
    const bar = document.createElement('div'); bar.className = 'rr-bar';
    bar.innerHTML = '<a class="rr-back" id="rrBack" href="' + G.url('games/' + GAME.id + '/') + '" aria-label="Back to the game page">' + G.icon('arrow-left') + '</a>' +
      '<div class="rr-t">' + G.esc(GAME.title) + '</div>' +
      (W ? '<a class="rr-pl rr-coins" id="rrCoins" href="' + G.url(P.app + (W.to || '')) + '" aria-label="' + G.esc(W.label) + '"></a>' : '') +
      '<a class="rr-pl" id="rrPearls" href="' + pearlsLink() + '" aria-label="Your Pearls: get more"></a>';
    const f = document.createElement('iframe'); f.id = 'rrFrame'; f.title = GAME.title; f.allow = 'autoplay *; fullscreen *; gamepad *; accelerometer; gyroscope'; f.setAttribute('allowfullscreen', '');
    document.body.prepend(bar); document.body.appendChild(f);
    if (W && P.coin) document.documentElement.style.setProperty('--rr-coin', 'url("' + G.url(P.coin) + '")');
    paint();   // (in partner mode theme.js points Back at wherever the game was started: the venue's app or the game list)

    /* ---------- the store ---------- */
    const shop = (GAME.shop || []).filter(it => it && it.id && +it.cost > 0), item = id => shop.find(it => it.id === id);
    const isPass = it => GAME.passes && it.effect === 'pass';
    function state() {
      return Object.assign({ points: points(), pearls: pearls(), pearlName: 'Pearls', standalone: !W, inv: st.inv, best: st.game.best, runs: st.game.runs, shop, title: GAME.title,
        collectible: GAME.collectible, runSeconds: GAME.runSeconds, club: st.club,
        brand: { name: P ? P.n : 'Grug', colors: GAME.colors || ['#f43f5e', '#111827'] }, store: GAME.store || 'A Grug original', storeId: '' },
        GAME.extra ? GAME.extra() : {}, root.GrugApp ? GrugApp.gameExtras() : {});
    }
    const toGame = m => { try { f.contentWindow.postMessage(Object.assign({ rw: 1 }, m), '*'); } catch (e) {} };
    const sendState = () => toGame(Object.assign({ t: 'state' }, state()));
    const wallet = () => pearls() + points();
    const moneyName = () => W ? 'Pearls or ' + W.label : 'Pearls';
    function buy(id) {
      const it = item(id); if (!it) return { ok: false, reason: 'That isn’t in the Store.' };
      if (isPass(it) && st.inv[id] > 0) return { ok: false, reason: 'You already have ' + it.name + '.' };
      if ((st.inv[id] || 0) >= INV_MAX) return { ok: false, reason: 'You already have ' + INV_MAX + ' of those.' };
      if (G.freeShop && G.freeShop()) { st.inv[id] = (st.inv[id] || 0) + 1; save(); return { ok: true, free: true }; }   // Free Shop Token: everything is free
      if (wallet() < it.cost) return { ok: false, reason: 'You need ' + (it.cost - wallet()) + ' more ' + moneyName() + ' for ' + it.name + '.', short: it.cost - wallet(), item: it.name };
      const fromPl = Math.min(pearls(), it.cost), fromPts = it.cost - fromPl;   // Pearls first, then the venue's coins
      if (fromPl) pearlsChange(-fromPl);
      if (fromPts) coinsChange(-fromPts * W.rate);
      st.inv[id] = (st.inv[id] || 0) + 1; save(); return { ok: true };
    }
    function use(ids) {
      ids = Array.isArray(ids) ? [...new Set(ids.map(String))] : [];
      const miss = ids.find(id => !item(id) || !(st.inv[id] > 0));
      if (miss) return { ok: false, reason: 'You’re out of ' + ((item(miss) || {}).name || 'that') + '.' };
      ids.forEach(id => { if (isPass(item(id))) return; st.inv[id]--; if (!st.inv[id]) delete st.inv[id]; }); save(); return { ok: true };
    }
    // an item the player can't afford: pause, and offer the Pearls page (which brings them straight back here)
    async function offerPearls(short, name) {
      toGame({ t: 'pause' });
      const go = await G.ui.dialog({ title: short + ' Pearls short for ' + name, html: '<p>Get Pearls on the Grug Pearls page. They work in every Grug game, and you’ll come straight back here.</p>',
        actions: [{ label: 'Not now', kind: 'quiet', value: null }, { label: 'Get Pearls', kind: 'primary', value: 'go' }] });
      if (go === 'go') location.href = pearlsLink();
    }
    addEventListener('message', e => {
      const d = e.data; if (!d || d.rw !== 1 || typeof d.t !== 'string' || e.source !== f.contentWindow) return;
      const reply = r => toGame(Object.assign({ t: 'reply', req: String(d.req || ''), state: state() }, r));
      if (d.t === 'hello') { sendState(); if (root.GrugApp) { GrugApp.onPlay(); GrugApp.onLogon(); } }
      else if (d.t === 'buy') { const r = buy(String(d.id)); reply(r); if (r.short) offerPearls(r.short, r.item); }
      else if (d.t === 'needPearls') { const it = item(String(d.id)); if (it && wallet() < it.cost) offerPearls(it.cost - wallet(), it.name); }
      else if (d.t === 'use') reply(use(d.ids));
      else if (d.t === 'score') { const s = Math.max(0, Math.floor(+d.score || 0)); st.game.runs++; if (s > st.game.best) st.game.best = s; save(); if (root.GrugApp) GrugApp.onScore(d, { play: false }); }
      else if (d.t === 'club') { const rev = +d.rev || 0; if (rev > (+st.club.rev || 0)) { st.club = { active: !!d.active, since: d.active ? (+d.since || Date.now()) : 0, rev }; save(); } }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) toGame({ t: 'pause' }); });
    addEventListener('storage', e => { if (e.key === WKEY || (W && e.key === W.key)) { paint(); sendState(); } if (e.key === GAME.storageKey) { st = load(); sendState(); } });
    addEventListener('pageshow', e => { paint(); if (e.persisted) sendState(); });

    if (root.GrugApp) GrugApp.init({ app: GAME.app || GAME.id, get: () => st, save, sendGameState: sendState, buzz: () => {} });
    f.src = GAME.src || 'game.html';
    return { state, sendState };
  };
})(window);
