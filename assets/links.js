/* Grug · Links: link pages that online creators make for their socials (links/create/), opened by followers
   (links/page/), either as a plain page of buttons or as a small 3D world where each social is a room to walk into
   (assets/linkworld.js). Listed on the Links tab (links/). Needs assets/rewards.js (hashing, link text, Pearls).

   THE LINK. Like the Rewards cards, the whole page rides in the link, nothing on a server:
     links/page/#c=<setup>
     setup = base64url(UTF-8 of '1~<name>~<RRGGBB>~<mode>~<world>~<p:handle>|<p:handle>…')
       mode   g = 3D world · l = plain link page
       world  c Cozy Cabin · a Neon Arcade · b Sunny Boardwalk
       p      x X · ig Instagram · yt YouTube · tt TikTok · tw Twitch · dc Discord (invite code) · web a website
     Only handles are stored (not whole URLs), which keeps the link short and means every button goes where its
     label says. Websites must look like a domain (example.com/path) and always open as https.

   SAVED ON THE PHONE: localStorage 'grug.links.v1' = { v:1, mine: [ { c, at } ], seen: { <id>: { c, at } } }

   PEARLS. A visit adds 10 Pearls once per page per rewards day, through GrugRewards.grantPearls('link-<id>'),
   so link pages and stamp cards share the same 30-a-day cap. */
(function (root) {
  'use strict';
  const RW = root.GrugRewards;
  const KEY = 'grug.links.v1', MAX_LINKS = 7;

  // no brand logos: each platform gets a plain badge in a colour close to its own
  const PLATFORMS = {
    x: { label: 'X', badge: 'X', color: '#2B2B33', ink: '#FFFFFF', ph: 'yourhandle', url: h => 'https://x.com/' + h, show: h => '@' + h },
    ig: { label: 'Instagram', badge: 'IG', color: '#E1306C', ink: '#FFFFFF', ph: 'yourhandle', url: h => 'https://www.instagram.com/' + h, show: h => '@' + h },
    yt: { label: 'YouTube', badge: 'YT', color: '#FF3B3B', ink: '#FFFFFF', ph: 'yourchannel', url: h => 'https://www.youtube.com/@' + h, show: h => '@' + h },
    tt: { label: 'TikTok', badge: 'TT', color: '#25F4EE', ink: '#1E1B16', ph: 'yourhandle', url: h => 'https://www.tiktok.com/@' + h, show: h => '@' + h },
    tw: { label: 'Twitch', badge: 'TV', color: '#9146FF', ink: '#FFFFFF', ph: 'yourchannel', url: h => 'https://www.twitch.tv/' + h, show: h => h },
    dc: { label: 'Discord', badge: 'DC', color: '#5865F2', ink: '#FFFFFF', ph: 'invite code', url: h => 'https://discord.gg/' + h, show: h => 'discord.gg/' + h },
    web: { label: 'Website', badge: 'WWW', color: '#4FD8C4', ink: '#1E1B16', ph: 'yoursite.com', url: h => 'https://' + h, show: h => h.replace(/\/$/, '') }
  };
  const ORDER = ['ig', 'tt', 'yt', 'x', 'tw', 'dc', 'web'];
  const WORLDS = {
    c: { label: 'Cozy Cabin', blurb: 'Warm wood, lanterns and pine trees', sky: '#2B1E16', ground: '#5C4030', wall: '#A86F43', trim: '#6E4A2C', accent: '#FFB86B' },
    a: { label: 'Neon Arcade', blurb: 'Glowing pillars on a midnight floor', sky: '#0E0B1F', ground: '#1B1640', wall: '#2A2160', trim: '#140F33', accent: '#FF4FD8' },
    b: { label: 'Sunny Boardwalk', blurb: 'Sand, palms and beach umbrellas', sky: '#8ED8FF', ground: '#E8C987', wall: '#F4E3B5', trim: '#C9A86B', accent: '#2FAE5A' }
  };
  const COLORS = ['#5AB0FF', '#FF4FD8', '#9146FF', '#FF3B3B', '#FF9F5A', '#FFBE1A', '#2FAE5A', '#4FD8C4', '#E1306C', '#2B2B33'];

  function cleanHandle(p, h) {
    h = String(h || '').trim();
    if (p === 'web') {
      h = h.replace(/^https?:\/\//i, '').replace(/[~|\s<>"'`\\]/g, '').slice(0, 80);
      return /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/.*)?$/.test(h) ? h : '';
    }
    h = h.replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
    h = h.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
    return h;
  }
  function normalize(o) {
    o = o || {};
    const col = String(o.color || '').replace('#', '');
    const seen = new Set(), links = (Array.isArray(o.links) ? o.links : []).map(l => ({ p: l && l.p, h: cleanHandle(l && l.p, l && l.h) }))
      .filter(l => PLATFORMS[l.p] && l.h && !seen.has(l.p) && seen.add(l.p)).slice(0, MAX_LINKS);
    return { n: String(o.n || '').replace(/[~|\s]+/g, ' ').trim().slice(0, 28) || 'My links', color: /^[0-9a-f]{6}$/i.test(col) ? '#' + col.toUpperCase() : COLORS[0],
      mode: o.mode === 'l' ? 'l' : 'g', world: WORLDS[o.world] ? o.world : 'c', links };
  }
  function encode(cfg) { cfg = normalize(cfg); return RW.b64e(['1', cfg.n, cfg.color.slice(1), cfg.mode, cfg.world, cfg.links.map(l => l.p + ':' + l.h).join('|')].join('~')); }
  function decode(c) {
    try {
      const p = RW.b64d(String(c || '')).split('~'); if (p[0] !== '1' || p.length < 6) return null;
      const links = p.slice(5).join('~').split('|').filter(Boolean).map(x => { const i = x.indexOf(':'); return { p: x.slice(0, i), h: x.slice(i + 1) }; });
      const cfg = normalize({ n: p[1], color: p[2], mode: p[3], world: p[4], links });
      return cfg.links.length ? cfg : null;
    } catch (e) { return null; }
  }
  const pageId = cfg => RW.code('links:' + normalize(cfg).n.toLowerCase(), 8).toLowerCase();
  function linksOf(cfg) {
    return normalize(cfg).links.map(l => { const P = PLATFORMS[l.p]; return { p: l.p, label: P.label, badge: P.badge, color: P.color, ink: P.ink, handle: P.show(l.h), url: P.url(l.h) }; });
  }
  function share(cfg) { const c = encode(cfg), base = new URL(Grug.url('links/page/'), location.href).href; return { c, url: base + '#c=' + c, open: Grug.url('links/page/') + '#c=' + c }; }
  const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };

  /* saved on this phone */
  function rd() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function wr(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function load() { const s = rd(); return { v: 1, mine: Array.isArray(s.mine) ? s.mine.filter(m => m && decode(m.c)) : [], seen: s.seen && typeof s.seen === 'object' ? s.seen : {} }; }
  function mine() { return load().mine.map(m => ({ c: m.c, at: m.at, cfg: decode(m.c) })); }
  function saveMine(c, replace) { const s = load(); s.mine = s.mine.filter(m => m.c !== c && m.c !== replace); s.mine.unshift({ c, at: Date.now() }); s.mine = s.mine.slice(0, 20); wr(s); }
  function removeMine(c) { const s = load(); s.mine = s.mine.filter(m => m.c !== c); wr(s); }
  function markSeen(cfg, c) { const s = load(); s.seen[pageId(cfg)] = { c, at: Date.now() }; wr(s); }
  function seen() { const s = load(); return Object.keys(s.seen).map(id => ({ id, at: s.seen[id].at, c: s.seen[id].c, cfg: decode(s.seen[id].c) })).filter(x => x.cfg).sort((a, b) => b.at - a.at); }
  const visitPearls = cfg => RW.grantPearls('link-' + pageId(cfg));

  root.GrugLinks = { KEY, MAX_LINKS, PLATFORMS, ORDER, WORLDS, COLORS, cleanHandle, normalize, encode, decode, pageId, linksOf, share, host,
    load, mine, saveMine, removeMine, markSeen, seen, visitPearls };
})(window);
