/* Grug · Rewards: free stamp cards that shops make themselves (rewards/create/), collected by guests (rewards/card/)
   and listed on the Rewards tab (rewards/).

   THE LINK. Nothing is stored on a server: a shop's whole setup rides in its link, kept short on purpose.
     rewards/card/#c=<setup>&k=<check>      the printed QR / NFC sticker: adds a stamp (once a day) and 10 Pearls
     rewards/card/#c=<setup>                 share link: opens the card without a stamp
     setup = base64url(UTF-8 of '2~<name>~<type>~<RRGGBB>~<icon>~<stamps>~<reward>~<welcome>[~<font>]')
       type    c café · t boba & tea · b bar · f restaurant · k bakery · o other
       reward  n Pearls only (the default: 10 Pearls a visit, nothing at the counter) · d free drink · f free food item
               s free dessert · b buy one get one · p<N> N% off an item
       welcome 1 = new guests start with a free stamp
       font    the card's lettering (FONTS below; left off for Fredoka, so older links still read the same)
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
    c: { label: 'Café', i: 'coffee', s: 8, r: 'n', color: '#C8924F', font: 'l' },
    t: { label: 'Boba & tea', i: 'pint-glass', s: 8, r: 'n', color: '#2FAE5A', font: 'b' },
    b: { label: 'Bar', i: 'beer-stein', s: 6, r: 'n', color: '#F2B544', font: 'o', note: 'For bars: one stamp per visit, not per drink. Each guest in a group scans with their own phone.' },
    f: { label: 'Restaurant', i: 'fork-knife', s: 8, r: 'n', color: '#F26A1B', font: 'b' },
    k: { label: 'Bakery', i: 'bread', s: 10, r: 'n', color: '#FF8FC2', font: 'h' },
    o: { label: 'Other', i: 'star', s: 8, r: 'n', color: '#4FD8C4', font: 'f' }
  };
  /* lettering a shop can pick for its card (and, in shop mode, the site's headings). Easy to read first, then a style each:
     css = the family in assets/shop-fonts.css, w = its one weight, size = how big it sets next to Fredoka */
  const FONTS = {
    f: { label: 'Friendly', sub: 'Round and easygoing (our house font)', css: 'Fredoka', w: 600, size: 1 },
    l: { label: 'Café', sub: 'A warm serif for coffee and brunch', css: 'Shop Lora', w: 600, size: .96 },
    h: { label: 'Bakery', sub: 'Neat handwriting, like a chalkboard', css: 'Shop Patrick Hand', w: 400, size: 1.1 },
    o: { label: 'Bar & pub', sub: 'Tall sign lettering', css: 'Shop Oswald', w: 600, size: 1 },
    p: { label: 'Fine dining', sub: 'An elegant, classic serif', css: 'Shop Playfair', w: 700, size: .95 },
    b: { label: 'Bold & fun', sub: 'Chunky and cheerful, for tacos and boba', css: 'Shop Lilita', w: 400, size: 1 },
    r: { label: 'Retro diner', sub: 'A 50s neon-sign feel', css: 'Shop Righteous', w: 400, size: .94 },
    m: { label: 'Modern', sub: 'Clean and geometric', css: 'Shop Outfit', w: 700, size: .96 }
  };
  const fontOf = cfg => FONTS[cfg && cfg.f] || FONTS.f;
  const fontStack = cfg => { const F = fontOf(cfg); return '"' + F.css + '", Fredoka, system-ui, sans-serif'; };
  // the stylesheet with the shop fonts, added to the page the first time a card needs it
  let fontsCss = null;
  function loadFonts() {
    if (fontsCss) return fontsCss;
    const have = document.getElementById('g-shop-fonts');
    if (have) return (fontsCss = have.sheet ? Promise.resolve() : new Promise(ok => { have.addEventListener('load', ok); have.addEventListener('error', ok); setTimeout(ok, 3000); }));
    const me = Array.from(document.scripts).find(x => /rewards\.js(\?|$)/.test(x.src)); if (!me) return (fontsCss = Promise.resolve());
    const l = document.createElement('link'); l.id = 'g-shop-fonts'; l.rel = 'stylesheet'; l.href = me.src.replace(/rewards\.js.*$/, 'shop-fonts.css');
    fontsCss = new Promise(ok => { l.onload = l.onerror = ok; setTimeout(ok, 3000); }); document.head.appendChild(l); return fontsCss;
  }
  // the stylesheet first (so the browser knows the font), then the font file itself
  async function fontReady(cfg) { await loadFonts(); const F = fontOf(cfg); try { await document.fonts.load(F.w + ' 40px "' + F.css + '"', cfg.n || 'Aa'); } catch (e) {} }
  /* a shop's icon: one of the site's flat icons (Phosphor bold, 'sh-<id>' in assets/icons.js). Links made before these
     carried an emoji; OLD maps each one to the closest icon, so those cards keep working. */
  const ICONS = ['coffee', 'tea-bag', 'pint-glass', 'beer-stein', 'wine', 'martini', 'pizza', 'hamburger', 'bowl-steam', 'fish', 'pepper', 'fork-knife',
    'cake', 'cookie', 'bread', 'ice-cream', 'orange-slice', 'leaf', 'storefront', 'scissors', 'paw-print', 'barbell', 'flower-tulip', 'star'];
  const OLD = { '☕': 'coffee', '🧋': 'pint-glass', '🍵': 'tea-bag', '🍺': 'beer-stein', '🍷': 'wine', '🍸': 'martini', '🌮': 'pepper', '🍕': 'pizza', '🍔': 'hamburger',
    '🍣': 'fish', '🍜': 'bowl-steam', '🥗': 'leaf', '🍩': 'cookie', '🥐': 'bread', '🧁': 'cake', '🍦': 'ice-cream', '⭐': 'star' };
  const iconId = v => { v = String(v || ''); return ICONS.includes(v) ? v : OLD[v] || OLD[v.replace(/\uFE0F/g, '')] || ''; };
  // the icon as an inline SVG (on the card, in lists), or drawn onto a canvas (the printed card, the 3D builder)
  const iconSvg = (id, cls) => { const d = root.GRUG_ICONS && root.GRUG_ICONS['sh-' + iconId(id)] || (root.GRUG_ICONS && root.GRUG_ICONS[id]) || '';
    return '<svg class="gi rw-svg' + (cls ? ' ' + cls : '') + '" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + d + '"/></svg>'; };
  function drawIcon(x, id, cx, cy, size, color) {
    const d = root.GRUG_ICONS && (root.GRUG_ICONS['sh-' + iconId(id)] || root.GRUG_ICONS[id]); if (!d) return;
    x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 256, size / 256); x.fillStyle = color; x.fill(new Path2D(d)); x.restore();
  }
  const COLORS = ['#C8924F', '#2FAE5A', '#F2B544', '#F26A1B', '#E5484D', '#FF8FC2', '#C59BFF', '#4FD8C4', '#3B82F6', '#2B2B33'];
  const REWARDS = { d: 'A free drink', f: 'A free food item', s: 'A free dessert', b: 'Buy one, get one free' };
  const PCTS = [5, 10, 15, 20, 25, 30, 40, 50];
  const pearlsOnly = r => r === 'n';
  const rewardText = r => r === 'n' ? '+' + TAP_PEARLS + ' Pearls a visit' : /^p\d+$/.test(r) ? r.slice(1) + '% off an item' : (REWARDS[r] || REWARDS.f);

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
    else if (!REWARDS[r] && r !== 'n') r = d.r;
    const col = String(o.color || '').replace('#', '');
    return { n: clip(o.n, 28, 'Your shop'), t, color: /^[0-9a-f]{6}$/i.test(col) ? '#' + col.toUpperCase() : d.color,
      i: iconId(o.i) || d.i, s: Math.max(4, Math.min(12, parseInt(o.s, 10) || d.s)), r, j: o.j ? 1 : 0, f: FONTS[o.f] ? o.f : 'f' };
  }
  function encode(cfg) { cfg = normalize(cfg); return b64e(['2', cfg.n, cfg.t, cfg.color.slice(1), cfg.i, cfg.s, cfg.r, cfg.j].concat(cfg.f !== 'f' ? [cfg.f] : []).join('~')); }
  function decode(c) {
    try {
      const p = b64d(String(c || '')).split('~'); if (p[0] !== '2' || p.length < 8) return null;
      return normalize({ n: p[1], t: p[2], color: p[3], i: p[4], s: p[5], r: p[6], j: p[7] === '1', f: p[8] });
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

  /* ---------- a still picture of a card (the builder's preview, the Rewards tab's sample) ---------- */
  function passVars(c) { return '--a:' + c + ';--a-lo:' + lo(c) + ';--a-ink:' + inkOn(c) + ';--a-soft:' + mix(c, '#FFFFFF', .8) + ';--a-tint:' + mix(c, '#FFFFFF', .94); }
  function passHtml(cfg, have) {
    cfg = normalize(cfg); loadFonts(); const esc = Grug.esc, n = cfg.s; have = Math.max(0, Math.min(n, have || 0));
    let g = '';
    for (let i = 0; i < n; i++) { const on = i < have, last = i === n - 1; g += '<div class="rw-slot' + (on ? ' on' : '') + (last ? ' gift' : '') + '">' + (on ? iconSvg(cfg.i) : last ? iconSvg('gift') : (i + 1)) + '</div>'; }
    return '<div class="rw-pass" style="' + passVars(cfg.color) + '"><div class="rw-band"><span class="rw-ic">' + iconSvg(cfg.i) + '</span><div class="rw-who"><b>' + esc(cfg.n) + '</b><small>Rewards card</small></div><b class="rw-count">' + have + '/' + n + '</b></div>' +
      '<div class="rw-pass-body"><div class="rw-grid" style="grid-template-columns:repeat(' + ((n === 6 || n === 9) ? 3 : (n === 5 || n === 10) ? 5 : 4) + ',1fr)">' + g + '</div>' +
      '<p class="rw-goal">' + (pearlsOnly(cfg.r) ? 'Every visit: <b>+' + TAP_PEARLS + ' Pearls</b> for any game on Grug' : 'Collect ' + n + ' <span class="rw-emo">' + iconSvg(cfg.i) + '</span> → <b>' + esc(rewardText(cfg.r)) + '</b>') + '</p></div></div>';
  }

  /* ---------- the printable counter card as a PDF ----------
     cardCanvas draws a 5×7 in card at 200 dpi (the QR holds the stamp link); cardPdf puts it on a US Letter page with
     cut marks. Written by hand (one JPEG image + a few lines of text), so no PDF library is needed. */
  async function cardCanvas(cfg, link) {
    cfg = normalize(cfg);
    try { await Promise.all(['500 34px', '600 64px', '700 64px'].map(f => document.fonts.load(f + ' Fredoka'))); } catch (e) {}
    await fontReady(cfg);
    const W = 1000, H = 1400, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"';
    const font = (w, px) => w + ' ' + px + 'px Fredoka, ' + EMO + ', sans-serif';
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    const fit = (text, w, px, max) => { do { x.font = font(w, px); px -= 2; } while (x.measureText(text).width > max && px > 20); };
    const ink = inkOn(cfg.color), dark = lo(cfg.color);
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
    // the shop's band
    x.fillStyle = cfg.color; x.fillRect(0, 0, W, 250); x.fillStyle = dark; x.fillRect(0, 236, W, 14);
    rr(60, 52, 132, 132, 32); x.fillStyle = dark; x.fill();
    drawIcon(x, cfg.i, 126, 118, 80, inkOn(dark));
    const SF = fontOf(cfg), nameFit = (px) => { do { x.font = SF.w + ' ' + Math.round(px * SF.size) + 'px "' + SF.css + '", Fredoka, ' + EMO + ', sans-serif'; px -= 2; } while (x.measureText(cfg.n).width > 720 && px > 20); };
    x.textAlign = 'left'; x.fillStyle = ink; nameFit(66); x.fillText(cfg.n, 224, 100);   // the shop's name in its own lettering
    x.globalAlpha = .85; x.font = font('600', 34); x.fillText('Rewards card', 224, 160); x.globalAlpha = 1;
    // heading + QR
    x.textAlign = 'center'; x.fillStyle = '#1E1B16'; fit('Scan for your stamp', '600', 66, 880); x.fillText('Scan for your stamp', W / 2, 335);
    const q = root.qrcode(0, 'M'); q.addData(link); q.make(); const n = q.getModuleCount();
    const box = 560, bx = (W - box) / 2, by = 400;
    rr(bx, by, box, box, 40); x.fillStyle = cfg.color; x.fill(); rr(bx + 14, by + 14, box - 28, box - 28, 28); x.fillStyle = '#FFFFFF'; x.fill();
    const pad = 30, qs = box - 28 - 2 * pad, cell = qs / n, qx = bx + 14 + pad, qy = by + 14 + pad;
    x.fillStyle = '#1E1B16';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(Math.floor(qx + c * cell), Math.floor(qy + r * cell), Math.ceil(cell) + 1, Math.ceil(cell) + 1);
    // the reward + how it works
    const goal = pearlsOnly(cfg.r) ? 'Every visit: +' + TAP_PEARLS + ' Pearls for your games' : 'Collect ' + cfg.s + ' stamps  →  ' + rewardText(cfg.r);
    x.fillStyle = '#1E1B16'; fit(goal, '600', 46, 880); x.fillText(goal, W / 2, 1040);
    const lines = ['Point your phone camera at the code', 'One stamp per visit, once a day', pearlsOnly(cfg.r) ? 'Spend Pearls in any game on Grug' : '+' + TAP_PEARLS + ' Pearls for any game on Grug'].concat(cfg.j ? ['First scan? Your welcome stamp is on us'] : []);
    x.fillStyle = '#55514A'; x.font = font('500', 33); lines.forEach((t, i) => x.fillText(t, W / 2, 1110 + i * 48));
    x.fillStyle = '#EEE9E0'; x.fillRect(0, 1318, W, 3);
    x.fillStyle = '#8A857C'; x.font = font('600', 27); x.textAlign = 'left'; x.fillText('No app needed', 50, 1362); x.textAlign = 'right'; x.fillText('Made with Grug', W - 50, 1362);
    return cv;
  }
  async function cardPdf(cfg, link) {
    const cv = await cardCanvas(cfg, link);
    const jpg = new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/jpeg', .93))).arrayBuffer());
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const add = d => { const b = typeof d === 'string' ? enc.encode(d) : d; parts.push(b); len += b.length; };
    const obj = (i, body) => { offs[i] = len; add(i + ' 0 obj\n'); (Array.isArray(body) ? body : [body]).forEach(add); add('\nendobj\n'); };
    const pdfText = s => String(s).replace(/[^\x20-\x7E]/g, '').replace(/([()\\])/g, '\\$1');
    // page 612×792 pt; the card 360×504 pt (5×7 in) in the middle; cut marks at its corners
    const cw = 360, ch = 504, x0 = 126, y0 = 160, m = 18, gap = 6;
    let ops = 'q ' + cw + ' 0 0 ' + ch + ' ' + x0 + ' ' + y0 + ' cm /Im1 Do Q\n0.55 0.55 0.55 RG 0.6 w\n';
    [[x0, y0], [x0 + cw, y0], [x0, y0 + ch], [x0 + cw, y0 + ch]].forEach(([X, Y], i) => {
      const sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1;
      ops += (X + sx * gap) + ' ' + Y + ' m ' + (X + sx * (gap + m)) + ' ' + Y + ' l S\n' + X + ' ' + (Y + sy * gap) + ' m ' + X + ' ' + (Y + sy * (gap + m)) + ' l S\n';
    });
    ops += 'BT /F1 11 Tf 0.35 0.35 0.35 rg ' + x0 + ' ' + (y0 - 40) + ' Td (' + pdfText('Cut along the marks. Fits a 5 x 7 in frame or table stand.') + ') Tj ET\n';
    ops += 'BT /F1 9 Tf 0.5 0.5 0.5 rg ' + x0 + ' ' + (y0 - 56) + ' Td (' + pdfText(cfg.n + ' rewards card - made with Grug') + ') Tj ET\n';
    add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));   // the binary-file marker line
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>');
    obj(4, ['<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n', jpg, '\nendstream']);
    const cs = enc.encode(ops); obj(5, ['<< /Length ' + cs.length + ' >>\nstream\n', cs, '\nendstream']);
    obj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const xref = len;
    add('xref\n0 7\n0000000000 65535 f \n' + [1, 2, 3, 4, 5, 6].map(i => String(offs[i]).padStart(10, '0') + ' 00000 n \n').join(''));
    add('trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function downloadPdf(cfg, link) {
    const blob = await cardPdf(cfg, link), u = URL.createObjectURL(blob);
    const name = (normalize(cfg).n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'shop') + '-rewards-card.pdf';
    const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000);
    return name;
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
      R.icon.innerHTML = iconSvg(cfg.i); R.name.textContent = cfg.n; loadFonts();
      R.name.style.fontFamily = fontStack(cfg); R.name.style.fontWeight = fontOf(cfg).w; R.name.style.fontSize = fontOf(cfg).size + 'em';
      const n = cfg.s, have = Math.min(st.stamps, n), full = have >= n;
      R.count.textContent = have + '/' + n;
      R.grid.style.gridTemplateColumns = 'repeat(' + ((n === 6 || n === 9) ? 3 : (n === 5 || n === 10) ? 5 : 4) + ',1fr)';
      let g = '';
      for (let i = 0; i < n; i++) {
        const on = i < have, last = i === n - 1, isNew = fresh && i >= fresh[0] && i < fresh[1];
        g += '<div class="rw-slot' + (on ? ' on' : '') + (last ? ' gift' : '') + (isNew ? ' new' : '') + '"' + (isNew ? ' style="animation-delay:' + ((i - fresh[0]) * .12) + 's"' : '') + '>' + (on ? iconSvg(cfg.i) : last ? iconSvg('gift') : (i + 1)) + '</div>';
      }
      R.grid.innerHTML = g;
      const rw = rewardText(cfg.r);
      if (pearlsOnly(cfg.r)) R.goal.innerHTML = full ? 'Card full! You\u2019re a regular here. Your next visit starts a new card.' : 'Every visit: <b>+' + TAP_PEARLS + ' Pearls</b> for any game on Grug';
      else R.goal.innerHTML = full ? 'Card full! <b>' + esc(rw) + '</b> is yours.' : 'Collect ' + n + ' <span class="rw-emo">' + iconSvg(cfg.i) + '</span> → <b>' + esc(rw) + '</b>';
      R.redeem.hidden = !full || pearlsOnly(cfg.r); R.redeem.textContent = 'Redeem: ' + rw;
      const today = dayKey(now());
      if (!st.joined) R.msg.innerHTML = '<span class="i">' + Grug.icon('hand-waving') + '</span><span><b>Welcome to ' + esc(cfg.n) + '</b>Scan the QR or tap the tag at the counter to get your ' + (cfg.j ? 'first stamps (one is on us).' : 'first stamp.') + '</span>';
      else if (st.lastDay === today) R.msg.innerHTML = '<span class="i">' + Grug.icon('check-circle') + '</span><span><b>Stamped today</b>Your next stamp unlocks after ' + RESET_HOUR + ' AM tomorrow.</span>';
      else R.msg.innerHTML = '<span class="i">' + Grug.icon('map-pin') + '</span><span><b>Here today?</b>Scan the QR or tap the tag at the counter for your stamp.</span>';
      R.bal.innerHTML = G.fmt(o.pearls.balance()) + '<small>yours</small>';
    }
    function toast(icon, title, sub, kind) {
      R.tI.innerHTML = Grug.icon(icon); R.tB.textContent = title; R.tS.textContent = sub || '';
      R.toast.className = 'rw-toast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { R.toast.className = 'rw-toast'; }, 3600);
    }
    function scan(k) {
      if (k !== check(c)) { toast('warning-circle', 'This QR isn’t for ' + cfg.n, 'Ask the staff for the current card.', 'err'); return { ok: false, why: 'bad' }; }
      const today = dayKey(now());
      if (st.lastDay === today) { toast('hourglass', 'Already stamped today', 'Come back after ' + RESET_HOUR + ' AM for the next one.', 'warn'); return { ok: false, why: 'today' }; }
      const first = !st.joined, before = Math.min(st.stamps, cfg.s);
      st.joined = true; st.lastDay = today; st.visits++; st.seen = Date.now(); if (!st.first) st.first = st.seen;
      const pl = o.pearls.grant(); st.pearls = (st.pearls || 0) + pl;
      const plText = pl ? ' +' + pl + ' Pearls.' : '';
      if (before >= cfg.s && pearlsOnly(cfg.r)) { st.stamps = 1; st.rewards++; save(); render([0, 1]); toast(cfg.i, 'New card started!', 'You filled your last one.' + plText); return { ok: true, pearls: pl }; }
      if (before >= cfg.s) { save(); render(); toast('gift', 'Your card is full!', 'Redeem your reward at the counter.' + plText); return { ok: true, pearls: pl }; }
      const add = 1 + (first && cfg.j ? 1 : 0);
      st.stamps = Math.min(cfg.s, before + add); save(); render([before, st.stamps]);
      if (st.stamps >= cfg.s) toast('confetti', 'Card complete!', (pearlsOnly(cfg.r) ? 'You\u2019re a regular here.' : rewardText(cfg.r) + ' is ready.') + plText);
      else toast(cfg.i, (first ? 'Welcome! +' : '+') + add + ' stamp' + (add > 1 ? 's' : ''), (pearlsOnly(cfg.r) ? '' : (cfg.s - st.stamps) + ' more for ' + rewardText(cfg.r).toLowerCase() + '.') + plText);
      return { ok: true, pearls: pl, first };
    }
    R.redeem.addEventListener('click', async () => {
      const go = await G.ui.dialog({ title: 'Are you at the counter?', html: '<p>Tap <b>Show my reward</b> in front of the staff. It stays open for ' + VOUCHER_MIN + ' minutes, and your card starts over.</p>',
        actions: [{ label: 'Not yet', kind: 'quiet', value: null }, { label: 'Show my reward', kind: 'primary', value: 'go' }] });
      if (go !== 'go') return;
      st.stamps = Math.max(0, st.stamps - cfg.s); st.rewards++; st.voucher = { r: rewardText(cfg.r), until: Date.now() + VOUCHER_MIN * 60e3 };
      save(); render(); openVoucher();
    });
    function openVoucher() { if (!st.voucher) return; R.vIcon.innerHTML = iconSvg(cfg.i); R.vReward.textContent = st.voucher.r; R.vShop.textContent = 'at ' + cfg.n; R.voucher.hidden = false; tick(); clearInterval(vT); vT = setInterval(tick, 250); }
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

  root.GrugRewards = { iconId, iconSvg, drawIcon, FONTS, fontOf, fontStack, fontReady, loadFonts,
    KEY, TAP_PEARLS, DAY_CAP, RESET_HOUR, VOUCHER_MIN, KINDS, ICONS, COLORS, REWARDS, PCTS,
    rewardText, pearlsOnly, normalize, encode, decode, check, shopId, links, cardBase, code, b64e, b64d,
    load, cards, cardStore, removeCard, mine, saveMine, removeMine,
    dayKey, balance, grantPearls, inkOn, lo, mix, themeVars, bandStyle, qrSvg, mountCard, passHtml, cardCanvas, cardPdf, downloadPdf
  };
})(window);
