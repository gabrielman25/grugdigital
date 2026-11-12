/* Grug · the restaurant account (business.js)

   A second account on the same device, next to the Grug player profile. Making a rewards card (rewards/create/) makes
   one; the person switches between the two from the account menu (or the dashboard's own menu). Nothing goes to a
   server: like the cards, it lives in this browser.

     localStorage 'grug.business.v1' = {
       v: 1,
       mode: 'player' | 'business',     // which account is in use right now
       active: <shopId> | '',           // the shop the dashboard, website and menus are about
       shops: { <shopId>: { id, c, created, updated, site } }
     }
     c     = the shop's rewards card setup, the same text as its card link (GrugRewards.encode)
     site  = what the shop's website shows beyond the card (SITE_FIELDS below); empty fields are left off the page

   THE WEBSITE. A one-page site for the shop, drawn from its card (name, colour, icon, lettering, reward) plus `site`.
     site/#s=<payload>          the public address: the whole site rides in the link, like a card link
     payload = 'z' + base64url(deflate-raw(JSON)) where the browser can compress, else 'j' + base64url(JSON)
     GrugBusiness.siteHtml(...)  the same page as one self-contained .html file the owner can put on any host

   The dashboard (business/, a standalone app) reads this key directly, so keep the shape simple.
   Load after rewards.js on pages that make or edit shops (it needs GrugRewards for the card). */
(function (root) {
  'use strict';
  const KEY = 'grug.business.v1';
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];   // hours[0] is Monday
  const SITE_FIELDS = ['tagline', 'about', 'address', 'phone', 'email', 'hours', 'menu', 'order', 'ig', 'tt', 'fb', 'rewards'];
  const RW = () => root.GrugRewards;

  const rd = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  const wr = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function load() {
    const s = rd() || {};
    const out = { v: 1, mode: s.mode === 'business' ? 'business' : 'player', active: typeof s.active === 'string' ? s.active : '', shops: {} };
    if (s.shops && typeof s.shops === 'object') Object.keys(s.shops).forEach(id => { const x = s.shops[id]; if (x && typeof x.c === 'string') out.shops[id] = { id, c: x.c, created: +x.created || 0, updated: +x.updated || 0, site: cleanSite(x.site) }; });
    if (!out.shops[out.active]) out.active = Object.keys(out.shops).sort((a, b) => out.shops[b].updated - out.shops[a].updated)[0] || '';
    if (!out.active) out.mode = 'player';
    return out;
  }
  function emit(what) { try { root.dispatchEvent(new CustomEvent('grug:business', { detail: { what } })); } catch (e) {} }
  function save(s, what) { const ok = wr(s); emit(what || 'save'); return ok; }

  /* ---------- the website's own fields ---------- */
  const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const para = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  const handle = v => str(v, 60).replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|facebook\.com)\/@?/i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  const webUrl = v => { v = str(v, 300); if (!v) return ''; if (!/^https?:\/\//i.test(v)) v = 'https://' + v; try { const u = new URL(v); return /^https?:$/.test(u.protocol) && /\./.test(u.hostname) ? u.href : ''; } catch (e) { return ''; } };
  function cleanSite(o) {
    o = o && typeof o === 'object' ? o : {};
    const hours = Array.isArray(o.hours) ? o.hours.slice(0, 7).map(h => str(h, 40)) : [];
    while (hours.length < 7) hours.push('');
    const menu = (Array.isArray(o.menu) ? o.menu : []).slice(0, 40).map(m => m && typeof m === 'object' ? { n: str(m.n, 60), p: str(m.p, 12), d: str(m.d, 140) } : null).filter(m => m && (m.n || m.p || m.d));
    return { tagline: str(o.tagline, 90), about: para(o.about, 600), address: str(o.address, 120), phone: str(o.phone, 24), email: str(o.email, 80).replace(/\s/g, ''),
      hours, menu, order: webUrl(o.order), ig: handle(o.ig), tt: handle(o.tt), fb: handle(o.fb), rewards: o.rewards !== false };
  }
  // what a new website says before the owner writes anything: true for any shop of that kind, nothing made up
  const STARTERS = {
    c: ['Good coffee and a seat that’s yours for as long as you like.', 'We’re a neighbourhood café. Come in for a cup, stay for a chat, and collect a stamp every time you visit.'],
    t: ['Boba, tea and something sweet, made fresh to order.', 'Pick your tea, your toppings and your sweetness. We make every drink to order, and every visit earns a stamp on our rewards card.'],
    b: ['Cold drinks, good company and a seat at the bar.', 'Pull up a stool. Our regulars collect a stamp every visit on our free rewards card.'],
    f: ['Real food, made in our kitchen, served with a smile.', 'Come hungry. Everything on our menu is made in our own kitchen, and every visit earns a stamp on our free rewards card.'],
    k: ['Baked fresh every morning, gone by the afternoon.', 'We bake every morning, so come early for the best pick. Every visit earns a stamp on our free rewards card.'],
    o: ['Your neighbourhood favourite.', 'Thanks for stopping by. Every visit earns a stamp on our free rewards card.']
  };
  const starterSite = cfg => { const s = STARTERS[cfg && cfg.t] || STARTERS.o; return cleanSite({ tagline: s[0], about: s[1], rewards: true }); };

  /* ---------- accounts ---------- */
  const shopIdOf = c => { const cfg = RW() && RW().decode(c); return cfg ? RW().shopId(cfg) : ''; };
  // a card was made or changed: make or update its shop (prev = the card's text before this edit, if it was edited)
  function fromCard(c, prev) {
    if (!RW() || !RW().decode(c)) return null;
    const s = load(), id = shopIdOf(c), now = Date.now();
    let x = s.shops[id];
    if (!x && prev) { const old = Object.values(s.shops).find(o => o.c === prev); if (old) { x = old; delete s.shops[old.id]; } }   // renamed: keep the website it had
    const isNew = !x;
    x = x || { id, c, created: now, updated: now, site: starterSite(RW().decode(c)) };
    x.id = id; x.c = c; x.updated = now; s.shops[id] = x; s.active = id;
    save(s, isNew ? 'new' : 'card');
    return { shop: x, isNew };
  }
  function setMode(mode) { const s = load(); if (mode === 'business' && !s.active) return false; s.mode = mode === 'business' ? 'business' : 'player'; save(s, 'mode'); return true; }
  function setActive(id) { const s = load(); if (!s.shops[id]) return false; s.active = id; save(s, 'active'); return true; }
  function saveSite(id, site) { const s = load(), x = s.shops[id]; if (!x) return false; x.site = cleanSite(site); x.updated = Date.now(); return save(s, 'site'); }
  function remove(id) { const s = load(); delete s.shops[id]; if (s.active === id) s.active = ''; save(s, 'remove'); }
  const shops = () => { const s = load(); return Object.values(s.shops).sort((a, b) => b.updated - a.updated).map(x => Object.assign({ cfg: RW() ? RW().decode(x.c) : null }, x)); };
  const active = () => { const s = load(), x = s.shops[s.active]; return x ? Object.assign({ cfg: RW() ? RW().decode(x.c) : null }, x) : null; };
  const has = () => !!load().active;
  const on = () => { const s = load(); return s.mode === 'business' && !!s.active; };

  /* ---------- the site link ---------- */
  const b64e = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const b64d = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  async function pipe(bytes, stream) { const r = new Blob([bytes]).stream().pipeThrough(stream); return new Uint8Array(await new Response(r).arrayBuffer()); }
  // only what's filled in rides in the link, with short keys
  function packSite(c, site) {
    site = cleanSite(site); const o = { c };
    if (site.tagline) o.t = site.tagline; if (site.about) o.a = site.about; if (site.address) o.ad = site.address; if (site.phone) o.ph = site.phone; if (site.email) o.em = site.email;
    if (site.hours.some(Boolean)) o.h = site.hours; if (site.menu.length) o.m = site.menu.map(m => [m.n, m.p, m.d]);
    if (site.order) o.o = site.order; if (site.ig) o.ig = site.ig; if (site.tt) o.tt = site.tt; if (site.fb) o.fb = site.fb; if (!site.rewards) o.r = 0;
    return o;
  }
  function unpackSite(o) {
    return { c: String(o.c || ''), site: cleanSite({ tagline: o.t, about: o.a, address: o.ad, phone: o.ph, email: o.em, hours: o.h, menu: Array.isArray(o.m) ? o.m.map(m => ({ n: m[0], p: m[1], d: m[2] })) : [],
      order: o.o, ig: o.ig, tt: o.tt, fb: o.fb, rewards: o.r !== 0 }) };
  }
  async function encodeSite(c, site) {
    const raw = new TextEncoder().encode(JSON.stringify(packSite(c, site)));
    if (root.CompressionStream) { try { return 'z' + b64e(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) {} }
    return 'j' + b64e(raw);
  }
  async function decodeSite(p) {
    try {
      p = String(p || ''); let bytes = b64d(p.slice(1));
      if (p[0] === 'z') { if (!root.DecompressionStream) return { error: 'old' }; bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); }
      else if (p[0] !== 'j') return null;
      const o = unpackSite(JSON.parse(new TextDecoder().decode(bytes)));
      return RW() && RW().decode(o.c) ? o : null;
    } catch (e) { return null; }
  }
  const siteBase = () => new URL((root.Grug ? root.Grug.url('site/') : '../site/'), location.href).href;
  async function siteUrl(shop) { return siteBase() + '#s=' + await encodeSite(shop.c, shop.site); }

  /* ---------- the website itself ----------
     One page, left-aligned, set in the shop's own lettering. The thing people remember is the rewards card, drawn as
     a real card with its stamp holes. Everything comes from the card plus `site`; empty parts are simply left out. */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GOOGLE = { f: 'Fredoka:wght@400;500;600', l: 'Lora:wght@600', h: 'Patrick+Hand', o: 'Oswald:wght@600', p: 'Playfair+Display:wght@700', b: 'Lilita+One', r: 'Righteous', m: 'Outfit:wght@700' };
  const FAMILY = { f: 'Fredoka', l: 'Lora', h: 'Patrick Hand', o: 'Oswald', p: 'Playfair Display', b: 'Lilita One', r: 'Righteous', m: 'Outfit' };
  const svgPath = (d, cls) => d ? '<svg class="' + (cls || 'ic') + '" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>' : '';
  const I = n => svgPath(root.GRUG_ICONS && root.GRUG_ICONS[n]);
  // the three socials, drawn simply (one flat shape each, no brand logos)
  const SOCIAL = {
    ig: ['Instagram', h => 'https://instagram.com/' + encodeURIComponent(h), '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>'],
    tt: ['TikTok', h => 'https://tiktok.com/@' + encodeURIComponent(h), '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'],
    fb: ['Facebook', h => 'https://facebook.com/' + encodeURIComponent(h), '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4A20 20 0 0 0 15.3 4c-2.4 0-4 1.4-4 4.1v2.4H8.7v3h2.6V21z" fill="currentColor"/></svg>']
  };
  // opts: { stampLink (the card's join link), fonts: 'google' (the download) or local files: fontsHref (shop-fonts.css) + fredokaUrl, today (0 = Monday) }
  function siteParts(c, site, opts) {
    opts = opts || {}; const R = RW(), cfg = R.decode(c); if (!cfg) return null;
    site = cleanSite(site);
    const col = cfg.color, ink = R.inkOn(col), lo = R.lo(col), paper = R.mix(col, '#FFFFFF', .92), wash = R.mix(col, '#FFFFFF', .82);
    // accent text has to read on paper: darken light brand colours
    const text = R.lum(col) > .32 ? R.mix(col, '#000000', .45) : R.lum(col) > .18 ? R.mix(col, '#000000', .25) : col;
    const F = R.fontOf(cfg), fam = opts.fonts === 'google' ? (FAMILY[cfg.f] || 'Fredoka') : F.css;
    const today = opts.today != null ? opts.today : (new Date().getDay() + 6) % 7;
    const tel = site.phone.replace(/[^\d+]/g, '');
    const map = site.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(cfg.n + ', ' + site.address) : '';
    const tgt = ' target="_blank" rel="noopener"';
    const acts = [site.order && '<a class="btn pri" href="' + esc(site.order) + '"' + tgt + '>' + I('shopping-bag') + 'Order online</a>',
      tel && '<a class="btn' + (site.order ? '' : ' pri') + '" href="tel:' + esc(tel) + '">' + I('phone') + 'Call us</a>',
      map && '<a class="btn" href="' + esc(map) + '"' + tgt + '>' + I('map-pin') + 'Directions</a>'].filter(Boolean).join('');
    const hasHours = site.hours.some(Boolean);
    const stampCount = cfg.s, filled = Math.min(cfg.s - 1, cfg.j ? 2 : 1);
    const holes = Array.from({ length: stampCount }, (_, i) => '<i class="' + (i < filled ? 'on' : '') + '">' + (i < filled ? R.iconSvg(cfg.i, 'st') : '') + '</i>').join('');
    const prize = R.rewardText(cfg.r).toLowerCase();
    const rewardLine = R.pearlsOnly(cfg.r) ? 'Every visit also earns you 10 Pearls to spend in games on Grug.' : 'Your reward for a full card: ' + prize + '. Every visit also earns you 10 Pearls to spend in games on Grug.';
    const rewardHead = R.pearlsOnly(cfg.r) ? 'Collect a stamp every visit' : stampCount + ' stamps, then ' + prize;
    const socials = ['ig', 'tt', 'fb'].filter(k => site[k]).map(k => '<a href="' + esc(SOCIAL[k][1](site[k])) + '"' + tgt + ' aria-label="' + SOCIAL[k][0] + '">' + SOCIAL[k][2] + '<span>@' + esc(site[k]) + '</span></a>').join('');
    const body =
      '<header class="hero"><div class="in">' +
        '<span class="mark">' + R.iconSvg(cfg.i, 'mk') + '</span>' +
        '<h1>' + esc(cfg.n) + '</h1>' +
        (site.tagline ? '<p class="tag">' + esc(site.tagline) + '</p>' : '') +
        (acts ? '<div class="acts">' + acts + '</div>' : '') +
      '</div></header>' +
      '<main>' +
      (site.about ? '<section class="about"><p>' + esc(site.about).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p></section>' : '') +
      (site.menu.length ? '<section class="menu"><h2>Menu</h2><ul>' + site.menu.map(m => '<li><div class="mt"><b>' + esc(m.n) + '</b>' + (m.p ? '<span class="pr">' + esc(/^\d/.test(m.p) ? '$' + m.p : m.p) + '</span>' : '') + '</div>' + (m.d ? '<p>' + esc(m.d) + '</p>' : '') + '</li>').join('') + '</ul></section>' : '') +
      (site.rewards ? '<section class="card"><h2>' + esc(rewardHead) + '</h2><p>' + esc(rewardLine) + (cfg.j ? ' New guests start with a free stamp.' : '') + '</p>' +
        '<div class="pass" aria-hidden="true"><div class="ph"><span>' + esc(cfg.n) + '</span>' + R.iconSvg(cfg.i, 'pi') + '</div><div class="holes" style="--n:' + (stampCount <= 6 ? stampCount : Math.ceil(stampCount / 2)) + '">' + holes + '</div></div>' +
        (opts.stampLink ? '<a class="btn pri" href="' + esc(opts.stampLink) + '"' + tgt + '>' + I('gift') + 'Save our rewards card</a><p class="fine">Scan the QR code at our counter to collect your stamp.</p>' : '') + '</section>' : '') +
      (hasHours || site.address || tel || site.email ? '<section class="visit"><h2>Visit us</h2><div class="cols">' +
        (hasHours ? '<table class="hours">' + DAYS.map((d, i) => '<tr' + (i === today ? ' class="now"' : '') + '><th scope="row">' + d + (i === today ? ' <small>today</small>' : '') + '</th><td>' + esc(site.hours[i] || 'Closed') + '</td></tr>').join('') + '</table>' : '') +
        '<div class="where">' + (site.address ? '<p class="addr">' + I('map-pin') + '<span>' + esc(site.address) + (map ? '<br><a href="' + esc(map) + '"' + tgt + '>Open in Maps</a>' : '') + '</span></p>' : '') +
        (tel ? '<p>' + I('phone') + '<a href="tel:' + esc(tel) + '">' + esc(site.phone) + '</a></p>' : '') +
        (site.email ? '<p>' + I('chat-circle') + '<a href="mailto:' + esc(site.email) + '">' + esc(site.email) + '</a></p>' : '') + '</div></div></section>' : '') +
      '</main>' +
      '<footer>' + (socials ? '<div class="soc">' + socials + '</div>' : '') +
        '<p>© ' + new Date().getFullYear() + ' ' + esc(cfg.n) + '. <a href="https://grugdigital.pages.dev/rewards/"' + tgt + '>Free website and rewards card by Grug</a></p></footer>';
    const css =
      ':root{--c:' + col + ';--lo:' + lo + ';--on:' + ink + ';--paper:' + paper + ';--wash:' + wash + ';--text:' + text + ';--ink:#1E1B16;--mut:#5E5850;' +
        '--disp:"' + fam + '",Fredoka,system-ui,sans-serif;--dw:' + F.w + ';--ds:' + F.size + '}' +
      '*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}' +
      'body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 Fredoka,system-ui,sans-serif}' +
      'a{color:inherit}a:focus-visible,.btn:focus-visible{outline:3px solid var(--ink);outline-offset:3px;border-radius:12px}' +
      '.ic{width:1.15em;height:1.15em;flex:none;vertical-align:-.18em}' +
      'h1,h2{font-family:var(--disp);font-weight:var(--dw);line-height:1.02;margin:0;letter-spacing:-.01em}' +
      '.hero{background:var(--c);color:var(--on);padding:clamp(28px,7vw,72px) 0 clamp(36px,8vw,84px)}' +
      '.in,main,footer{max-width:804px;margin:0 auto;padding-left:22px;padding-right:22px}' +
      '.mark{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:20px;background:var(--on);color:var(--c);margin-bottom:22px}.mark .mk{width:38px;height:38px}' +
      '.hero h1{font-size:calc(clamp(52px,13vw,112px)*var(--ds));overflow-wrap:anywhere}' +
      '.tag{font-size:clamp(19px,2.6vw,24px);line-height:1.35;margin:16px 0 0;max-width:30ch;opacity:.92}' +
      '.acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}' +
      '.btn{display:inline-flex;align-items:center;gap:9px;min-height:50px;padding:0 20px;border-radius:14px;font:600 17px/1 Fredoka,system-ui,sans-serif;text-decoration:none;' +
        'background:rgba(255,255,255,.18);color:inherit;box-shadow:inset 0 0 0 2px currentColor}' +
      '.hero .btn.pri{background:var(--on);color:var(--c);box-shadow:none}' +
      'section{padding:clamp(40px,7vw,64px) 0 0}' +
      'h2{font-size:calc(clamp(30px,5vw,42px)*var(--ds));color:var(--text);margin-bottom:18px}' +
      '.about p{font-size:clamp(19px,2.3vw,22px);line-height:1.55;max-width:34em;margin:0 0 .8em}' +
      '.menu ul{list-style:none;margin:0;padding:0;max-width:36em}.menu li{padding:14px 0;border-bottom:2px dotted color-mix(in srgb,var(--c) 45%,transparent)}' +
      '.mt{display:flex;align-items:baseline;gap:16px}.mt b{flex:1;font-weight:600;font-size:19px}.pr{font-weight:600;font-variant-numeric:tabular-nums;color:var(--text)}' +
      '.menu li p{margin:4px 0 0;color:var(--mut);font-size:16px;line-height:1.45}' +
      '.card{max-width:36em}.card>p{margin:0 0 22px;color:var(--mut)}' +
      '.pass{background:#fff;border-radius:22px;padding:18px 18px 22px;margin:0 0 22px;max-width:420px;box-shadow:0 2px 0 var(--lo),0 14px 30px -18px rgba(30,27,22,.5);transform:rotate(-1.5deg)}' +
      '.ph{display:flex;align-items:center;gap:10px;font:var(--dw) calc(22px*var(--ds))/1.1 var(--disp);color:var(--text);margin-bottom:16px}.ph span{flex:1}.ph .pi{width:28px;height:28px}' +
      '.holes{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:10px}' +
      '.holes i{aspect-ratio:1;border-radius:50%;border:2.5px dashed color-mix(in srgb,var(--c) 60%,#999);display:grid;place-items:center}' +
      '.holes i.on{background:var(--c);border:0;color:var(--on)}.holes .st{width:56%;height:56%}' +
      '.card .btn.pri{background:var(--c);color:var(--on);box-shadow:0 3px 0 var(--lo)}.fine{font-size:14px;color:var(--mut);margin:10px 0 0}' +
      '.cols{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:28px 40px;align-items:start}@media(max-width:640px){.cols{grid-template-columns:1fr}}' +
      '.hours{border-collapse:collapse;width:100%;font-size:17px}.hours th,.hours td{text-align:left;padding:9px 0;border-bottom:1px solid var(--wash);font-weight:400}' +
      '.hours td{text-align:right;font-variant-numeric:tabular-nums}.hours small{font-size:12px;color:var(--mut)}.hours tr.now th,.hours tr.now td{font-weight:600;color:var(--text)}' +
      '.where p{display:flex;gap:10px;margin:0 0 14px;align-items:flex-start}.where .ic{margin-top:.25em;color:var(--text)}.where a{color:var(--text);font-weight:600}' +
      'footer{padding-top:56px;padding-bottom:40px;color:var(--mut);font-size:15px}footer p{margin:0}footer a{color:var(--mut)}' +
      '.soc{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:22px}.soc a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:600;color:var(--ink)}.soc .ic{width:22px;height:22px}' +
      '::-webkit-scrollbar{width:12px;height:12px}::-webkit-scrollbar-track{background:var(--paper)}::-webkit-scrollbar-corner{background:transparent}' +
      '::-webkit-scrollbar-thumb{background:var(--c);border-radius:99px;border:3px solid var(--paper);min-height:40px}::-webkit-scrollbar-thumb:hover{background:var(--lo)}' +
      '@supports not selector(::-webkit-scrollbar){html{scrollbar-width:thin;scrollbar-color:var(--c) var(--paper)}}' +
      '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
    const fontLink = opts.fonts === 'google'
      ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + GOOGLE.f + (cfg.f !== 'f' && GOOGLE[cfg.f] ? '&family=' + GOOGLE[cfg.f] : '') + '&display=swap">'
      : (opts.fontsHref ? '<link rel="stylesheet" href="' + esc(opts.fontsHref) + '">' : '') +
        (opts.fredokaUrl ? '<style>@font-face{font-family:Fredoka;font-weight:300 700;font-display:swap;src:url(' + esc(opts.fredokaUrl) + ') format("woff2")}</style>' : '');
    const title = cfg.n + (site.tagline ? ' – ' + site.tagline : '');
    const desc = site.about || site.tagline || cfg.n;
    return { cfg, title, desc, css, body, fontLink, color: col };
  }
  // the whole page as one file (the download, and the preview inside the editor)
  function siteHtml(c, site, opts) {
    const p = siteParts(c, site, opts); if (!p) return '';
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(p.title) + '</title>\n<meta name="description" content="' + esc(p.desc.slice(0, 160)) + '">\n<meta name="theme-color" content="' + p.color + '">\n' +
      p.fontLink + '\n<style>' + p.css + '</style>\n</head>\n<body>\n' + p.body + '\n</body>\n</html>\n';
  }

  root.GrugBusiness = { KEY, DAYS, SITE_FIELDS, load, has, on, shops, active, fromCard, setMode, setActive, saveSite, remove, cleanSite, starterSite,
    encodeSite, decodeSite, siteUrl, siteBase, siteParts, siteHtml, webUrl };
})(typeof window !== 'undefined' ? window : globalThis);
