/* Grug · Rewards: free stamp cards that shops make themselves (rewards/create/), collected by guests (rewards/card/)
   and listed on the Rewards tab (rewards/).

   THE LINK. Nothing is stored on a server: a shop's whole setup rides in its link, kept short on purpose.
     rewards/card/#c=<setup>&k=<check>      the printed QR / NFC sticker: adds a stamp (once a day) and 10 Pearls
     rewards/card/#c=<setup>                 share link: opens the card without a stamp
     setup = base64url(UTF-8 of '2~<name>~<type>~<RRGGBB>~<icon>~<stamps>~<reward>~<welcome>')
       type    c café · t boba & tea · b bar · f restaurant · k bakery · o other
       reward  d free drink · f free food item · s free dessert · b buy one get one · p<N> N% off an item
       welcome 1 = new guests start with a free stamp
     check = 6 characters from the same cyrb53 hash the partner apps use for their ?tap= links (on the setup text),
     so a hand-edited link won't stamp. It stops casual edits, not someone who reads this file.

   THE GUEST'S CARDS live on their phone in localStorage 'grug.rewards.v1' (and travel with Profile → Export):
     { v:1, cards: { <shopId>: { c, joined, stamps, lastDay, visits, rewards, pearls, voucher, first, seen } },
       mine: [ { c, at } ] }        mine = the cards this person made on rewards/create/ ("My creations")

   PEARLS. Each stamp also adds TAP_PEARLS to the site-wide wallet 'grug.pearls.v1', once per shop per rewards day
   (resets at 4 AM), with the cooldown kept in the wallet itself (w.taps['starter:<shopId>']), the same way Teahouse
   Express does its NFC tap Pearls. Stamp cards together can add at most DAY_CAP Pearls a day (w.starter), because
   anyone can make a card and Pearls are sold for real money on pearls.html. */
(function (root) {
  'use strict';
  const KEY = 'grug.rewards.v1', WKEY = 'grug.pearls.v1';
  const RESET_HOUR = 4, TAP_PEARLS = 10, DAY_CAP = 30, VOUCHER_MIN = 10;

  const KINDS = {
    c: { label: 'Café', i: '☕', s: 8, r: 'd', color: '#C8924F' },
    t: { label: 'Boba & tea', i: '🧋', s: 8, r: 'd', color: '#2FAE5A' },
    b: { label: 'Bar', i: '🍺', s: 6, r: 'd', color: '#F2B544', note: 'For bars: one stamp per visit, not per drink. Each guest in a group scans with their own phone.' },
    f: { label: 'Restaurant', i: '🌮', s: 8, r: 'f', color: '#F26A1B' },
    k: { label: 'Bakery', i: '🍩', s: 10, r: 's', color: '#FF8FC2' },
    o: { label: 'Other', i: '⭐', s: 8, r: 'f', color: '#4FD8C4' }
  };
  const ICONS = ['☕', '🧋', '🍵', '🍺', '🍷', '🍸', '🌮', '🍕', '🍔', '🍣', '🍜', '🥗', '🍩', '🥐', '🧁', '🍦'];
  const COLORS = ['#C8924F', '#2FAE5A', '#F2B544', '#F26A1B', '#E5484D', '#FF8FC2', '#C59BFF', '#4FD8C4', '#3B82F6', '#2B2B33'];
  const REWARDS = { d: 'A free drink', f: 'A free food item', s: 'A free dessert', b: 'Buy one, get one free' };
  const PCTS = [5, 10, 15, 20, 25, 30, 40, 50];
  const rewardText = r => /^p\d+$/.test(r) ? r.slice(1) + '% off an item' : (REWARDS[r] || REWARDS.f);

  /* ---------- hashing: cyrb53 + base-32, as in the partner apps' tapCheck ---------- */
  const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function h53(str) {
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function code(str, n) { let v = h53(str), s = ''; for (let i = 0; i < n; i++) { s = ABC[v % 32] + s; v = Math.floor(v / 32); } return s; }

  /* ---------- the setup <-> the short link text ---------- */
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));
  function normalize(o) {
    o = o || {};
    const t = KINDS[o.t] ? o.t : 'o', d = KINDS[t];
    const clip = (v, n, dv) => { v = String(v == null ? '' : v).replace(/[~\s]+/g, ' ').trim().slice(0, n); return v || dv; };
    let r = String(o.r || d.r);
    if (/^p\d+$/.test(r)) r = 'p' + PCTS.reduce((a, b) => Math.abs(b - +r.slice(1)) < Math.abs(a - +r.slice(1)) ? b : a, 10);
    else if (!REWARDS[r]) r = d.r;
    const col = String(o.color || '').replace('#', '');
    return { n: clip(o.n, 28, 'Your shop'), t, color: /^[0-9a-f]{6}$/i.test(col) ? '#' + col.toUpperCase() : d.color,
      i: clip(o.i, 8, d.i), s: Math.max(4, Math.min(12, parseInt(o.s, 10) || d.s)), r, j: o.j ? 1 : 0 };
  }
  function encode(cfg) { cfg = normalize(cfg); return b64e(['2', cfg.n, cfg.t, cfg.color.slice(1), cfg.i, cfg.s, cfg.r, cfg.j].join('~')); }
  function decode(c) {
    try {
      const p = b64d(String(c || '')).split('~'); if (p[0] !== '2' || p.length < 8) return null;
      return normalize({ n: p[1], t: p[2], color: p[3], i: p[4], s: p[5], r: p[6], j: p[7] === '1' });
    } catch (e) { return null; }
  }
  const check = c => code(String(c) + ':stamp', 6);
  const shopId = cfg => code('shop:' + normalize(cfg).n.toLowerCase(), 8).toLowerCase();
  const cardBase = () => new URL(Grug.url('rewards/card/'), location.href).href;
  function links(cfg) { const c = encode(cfg), k = check(c), base = cardBase(); return { c, k, stamp: base + '#c=' + c + '&k=' + k, join: base + '#c=' + c, open: Grug.url('rewards/card/') + '#c=' + c }; }

  /* ---------- the guest's saved cards ---------- */
  function rd(k) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function load() { const s = rd(KEY) || {}; return { v: 1, cards: s.cards && typeof s.cards === 'object' ? s.cards : {}, mine: Array.isArray(s.mine) ? s.mine.filter(m => m && decode(m.c)) : [] }; }
  const blankCard = c => ({ c, joined: false, stamps: 0, lastDay: '', visits: 0, rewards: 0, pearls: 0, voucher: null, first: 0, seen: 0 });
  function cardStore(id, c) {
    return {
      get() { const s = load().cards[id]; return s ? Object.assign(blankCard(c), s) : null; },
      set(st) { const s = load(); s.cards[id] = Object.assign({}, st, { c: c || st.c }); wr(KEY, s); },
      clear() { const s = load(); delete s.cards[id]; wr(KEY, s); }
    };
  }
  // every saved card, newest visit first: [{id, cfg, st}]
  function cards() {
    const s = load();
    return Object.keys(s.cards).map(id => { const st = s.cards[id], cfg = decode(st && st.c); return cfg ? { id, cfg, st: Object.assign(blankCard(st.c), st) } : null; })
      .filter(Boolean).filter(x => x.st.joined).sort((a, b) => (b.st.seen || 0) - (a.st.seen || 0));
  }
  function removeCard(id) { const s = load(); delete s.cards[id]; wr(KEY, s); }
  // My creations
  function mine() { return load().mine.map(m => ({ c: m.c, at: m.at, cfg: decode(m.c) })); }
  function saveMine(c, replace) {
    const s = load(); const at = Date.now();
    s.mine = s.mine.filter(m => m.c !== c && m.c !== replace);
    s.mine.unshift({ c, at }); s.mine = s.mine.slice(0, 30); wr(KEY, s);
  }
  function removeMine(c) { const s = load(); s.mine = s.mine.filter(m => m.c !== c); wr(KEY, s); }

  /* ---------- Pearls ---------- */
  const dayKey = t => { const d = new Date(t - RESET_HOUR * 3600e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const wallet = () => rd(WKEY) || { v: 1 };
  const balance = () => Math.max(0, Math.floor(+wallet().balance || 0));
  // add today's tap Pearls for one shop; returns how many were added (0 if already today, or the daily cap is reached)
  function grantPearls(id) {
    const w = wallet(), day = dayKey(Date.now()), k = 'starter:' + id;
    w.taps = w.taps && typeof w.taps === 'object' ? w.taps : {};
    Object.keys(w.taps).forEach(x => { if (x.indexOf('starter:') === 0 && w.taps[x] !== day) delete w.taps[x]; });   // keep the wallet small
    if (w.taps[k] === day) return 0;
    w.starter = w.starter && w.starter.day === day ? w.starter : { day, n: 0 };
    if (w.starter.n + TAP_PEARLS > DAY_CAP) return 0;
    w.v = 1; w.taps[k] = day; w.starter.n += TAP_PEARLS; w.balance = Math.max(0, Math.floor(+w.balance || 0)) + TAP_PEARLS;
    if (!wr(WKEY, w)) return 0;
    const back = wallet(); if (!back.taps || back.taps[k] !== day) return 0;   // only count it if the wallet really saved
    try { root.dispatchEvent(new StorageEvent('storage', { key: WKEY })); } catch (e) {}   // the top bar's Pearls count
    return TAP_PEARLS;
  }

  /* ---------- colours ---------- */
  function rgb(h) { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) { const c = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  const inkOn = h => lum(h) > .2 ? '#1E1B16' : '#FFFFFF';
  function mix(h, t, a) { const x = rgb(h), y = rgb(t); return '#' + x.map((v, i) => Math.round(v * (1 - a) + y[i] * a).toString(16).padStart(2, '0')).join(''); }
  const lo = h => mix(h, '#000000', lum(h) > .2 ? .3 : .45);
  function themeVars(el, c) {
    el.style.setProperty('--a', c); el.style.setProperty('--a-lo', lo(c)); el.style.setProperty('--a-ink', inkOn(c));
    el.style.setProperty('--a-soft', mix(c, '#FFFFFF', .8)); el.style.setProperty('--a-tint', mix(c, '#FFFFFF', .94));
  }
  const bandStyle = c => 'background:' + c + ';color:' + inkOn(c) + ';--a:' + c + ';--a-lo:' + lo(c) + ';--a-ink:' + inkOn(c);

  /* ---------- QR (assets/qrcode.js) as a crisp SVG ---------- */
  function qrSvg(text) {
    const q = root.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (q.isDark(r, c)) { const s = c; while (c < n && q.isDark(r, c)) c++; d += 'M' + s + ' ' + r + 'h' + (c - s) + 'v1h-' + (c - s) + 'z'; } else c++; } }
    return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#1E1B16"/></svg>';
  }

  /* ---------- the guest's card on screen ----------
     mountCard(root, { cfg, c, store, pearls: { grant() → n, balance() → n }, now, inPhone, onChange })
     → { scan(k), setConfig(cfg), reset(), refresh(), state() }
     Used live on rewards/card/ and inside the phone preview on rewards/create/ (with a pretend store and wallet). */
  function mountCard(host, o) {
    const G = Grug, esc = G.esc;
    let cfg = normalize(o.cfg), c = o.c || encode(cfg);
    const now = o.now || (() => Date.now());
    let st = Object.assign(blankCard(c), o.store.get() || {});
    let toastT = 0, vT = 0;
    host.innerHTML =
      '<div class="rw-app' + (o.inPhone ? ' rw-in-phone' : '') + '">' +
        '<div class="rw-pass"><div class="rw-band"><span class="rw-ic" data-r="icon"></span><div class="rw-who"><b data-r="name"></b><small>Rewards card</small></div><b class="rw-count" data-r="count"></b></div>' +
          '<div class="rw-pass-body"><div class="rw-grid" data-r="grid"></div><p class="rw-goal" data-r="goal"></p><button type="button" class="rw-redeem" data-r="redeem" hidden></button></div></div>' +
        '<div class="rw-msg" data-r="msg"></div>' +
        '<div class="rw-earn"><span class="rw-earn-ic">' + G.icon('pearl') + '</span><div><b>+' + TAP_PEARLS + ' Pearls every visit</b><span>Grug’s premium currency. Spend them in any game on Grug.</span></div><b class="rw-bal" data-r="bal"></b></div>' +
        '<div class="rw-toast" data-r="toast" role="status" aria-live="polite"><span class="i" data-r="tI"></span><span><b data-r="tB"></b><span data-r="tS"></span></span></div>' +
        '<div class="rw-voucher" data-r="voucher" hidden><div class="rw-ring"><div class="c" data-r="vIcon"></div></div><span class="k">Reward</span><h3 data-r="vReward"></h3><span class="shop" data-r="vShop"></span><div class="rw-clock" data-r="vClock"></div><span class="rw-left" data-r="vLeft"></span><p class="f">Staff: the ring spins and the clock ticks. A screenshot can’t.</p><button type="button" class="rw-vdone" data-r="vDone">Done</button></div>' +
      '</div>';
    const R = {}; host.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
    const app = host.firstElementChild;
    const save = () => { st.c = c; o.store.set(st); if (o.onChange) o.onChange(st); };

    function render(fresh) {
      themeVars(app, cfg.color);
      R.icon.textContent = cfg.i; R.name.textContent = cfg.n;
      const n = cfg.s, have = Math.min(st.stamps, n), full = have >= n;
      R.count.textContent = have + '/' + n;
      R.grid.style.gridTemplateColumns = 'repeat(' + ((n === 6 || n === 9) ? 3 : (n === 5 || n === 10) ? 5 : 4) + ',1fr)';
      let g = '';
      for (let i = 0; i < n; i++) {
        const on = i < have, last = i === n - 1, isNew = fresh && i >= fresh[0] && i < fresh[1];
        g += '<div class="rw-slot' + (on ? ' on' : '') + (last ? ' gift' : '') + (isNew ? ' new' : '') + '"' + (isNew ? ' style="animation-delay:' + ((i - fresh[0]) * .12) + 's"' : '') + '>' + (on ? esc(cfg.i) : last ? '🎁' : (i + 1)) + '</div>';
      }
      R.grid.innerHTML = g;
      const rw = rewardText(cfg.r);
      R.goal.innerHTML = full ? 'Card full! <b>' + esc(rw) + '</b> is yours.' : 'Collect ' + n + ' <span class="rw-emo">' + esc(cfg.i) + '</span> → <b>' + esc(rw) + '</b>';
      R.redeem.hidden = !full; R.redeem.textContent = 'Redeem: ' + rw;
      const today = dayKey(now());
      if (!st.joined) R.msg.innerHTML = '<span class="i">👋</span><span><b>Welcome to ' + esc(cfg.n) + '</b>Scan the QR or tap the tag at the counter to get your ' + (cfg.j ? 'first stamps (one is on us).' : 'first stamp.') + '</span>';
      else if (st.lastDay === today) R.msg.innerHTML = '<span class="i">✅</span><span><b>Stamped today</b>Your next stamp unlocks after ' + RESET_HOUR + ' AM tomorrow.</span>';
      else R.msg.innerHTML = '<span class="i">📍</span><span><b>Here today?</b>Scan the QR or tap the tag at the counter for your stamp.</span>';
      R.bal.innerHTML = G.fmt(o.pearls.balance()) + '<small>yours</small>';
    }
    function toast(icon, title, sub, kind) {
      R.tI.textContent = icon; R.tB.textContent = title; R.tS.textContent = sub || '';
      R.toast.className = 'rw-toast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { R.toast.className = 'rw-toast'; }, 3600);
    }
    function scan(k) {
      if (k !== check(c)) { toast('⚠️', 'This QR isn’t for ' + cfg.n, 'Ask the staff for the current card.', 'err'); return { ok: false, why: 'bad' }; }
      const today = dayKey(now());
      if (st.lastDay === today) { toast('🕓', 'Already stamped today', 'Come back after ' + RESET_HOUR + ' AM for the next one.', 'warn'); return { ok: false, why: 'today' }; }
      const first = !st.joined, before = Math.min(st.stamps, cfg.s);
      st.joined = true; st.lastDay = today; st.visits++; st.seen = Date.now(); if (!st.first) st.first = st.seen;
      const pl = o.pearls.grant(); st.pearls = (st.pearls || 0) + pl;
      const plText = pl ? ' +' + pl + ' Pearls.' : '';
      if (before >= cfg.s) { save(); render(); toast('🎁', 'Your card is full!', 'Redeem your reward at the counter.' + plText); return { ok: true, pearls: pl }; }
      const add = 1 + (first && cfg.j ? 1 : 0);
      st.stamps = Math.min(cfg.s, before + add); save(); render([before, st.stamps]);
      if (st.stamps >= cfg.s) toast('🎉', 'Card complete!', rewardText(cfg.r) + ' is ready.' + plText);
      else toast(cfg.i, (first ? 'Welcome! +' : '+') + add + ' stamp' + (add > 1 ? 's' : ''), (cfg.s - st.stamps) + ' more for ' + rewardText(cfg.r).toLowerCase() + '.' + plText);
      return { ok: true, pearls: pl, first };
    }
    R.redeem.addEventListener('click', async () => {
      const go = await G.ui.dialog({ title: 'Are you at the counter?', html: '<p>Tap <b>Show my reward</b> in front of the staff. It stays open for ' + VOUCHER_MIN + ' minutes, and your card starts over.</p>',
        actions: [{ label: 'Not yet', kind: 'quiet', value: null }, { label: 'Show my reward', kind: 'primary', value: 'go' }] });
      if (go !== 'go') return;
      st.stamps = Math.max(0, st.stamps - cfg.s); st.rewards++; st.voucher = { r: rewardText(cfg.r), until: Date.now() + VOUCHER_MIN * 60e3 };
      save(); render(); openVoucher();
    });
    function openVoucher() { if (!st.voucher) return; R.vIcon.textContent = cfg.i; R.vReward.textContent = st.voucher.r; R.vShop.textContent = 'at ' + cfg.n; R.voucher.hidden = false; tick(); clearInterval(vT); vT = setInterval(tick, 250); }
    function tick() {
      if (!st.voucher) return closeVoucher();
      const t = Date.now(), left = Math.max(0, st.voucher.until - t);
      R.vClock.textContent = new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
      R.vLeft.textContent = 'Open for ' + Math.floor(left / 60e3) + ':' + String(Math.floor(left / 1e3) % 60).padStart(2, '0');
      if (!left) closeVoucher();
    }
    function closeVoucher() { clearInterval(vT); R.voucher.hidden = true; if (st.voucher) { st.voucher = null; save(); } }
    R.vDone.addEventListener('click', closeVoucher);

    render();
    if (st.voucher && st.voucher.until > Date.now()) openVoucher(); else if (st.voucher) { st.voucher = null; if (st.joined) save(); }
    return {
      scan,
      setConfig(nc) { cfg = normalize(nc); c = encode(cfg); render(); },
      reset() { closeVoucher(); o.store.clear(); st = blankCard(c); if (o.onChange) o.onChange(st); render(); },
      refresh() { render(); },
      fill() { st.joined = true; st.stamps = cfg.s; st.visits = Math.max(st.visits, cfg.s); save(); render([0, cfg.s]); },
      state: () => st
    };
  }

  root.GrugRewards = {
    KEY, TAP_PEARLS, DAY_CAP, RESET_HOUR, VOUCHER_MIN, KINDS, ICONS, COLORS, REWARDS, PCTS,
    rewardText, normalize, encode, decode, check, shopId, links, cardBase,
    load, cards, cardStore, removeCard, mine, saveMine, removeMine,
    dayKey, balance, grantPearls, inkOn, lo, mix, themeVars, bandStyle, qrSvg, mountCard
  };
})(window);
