/* GET /api/mall?user=<itch username> · the neighbours in the mall outside a creator's 3D store (/store/<user>).

   itch.io has no "random creator" lookup, so the mall draws from a pool: the creators in itch's own public lists of
   featured, top-rated and new projects (POOL_FEEDS, read one at a time and kept for an hour). Being in one of those
   lists means the creator has a live profile with public projects, so every storefront is a real store; the store
   page checks each one again (/api/itch-store) as you walk up to it, and shutters any that has gone.

   The neighbours are a shuffle of that pool seeded by the store's username and the day, so a store keeps the same
   neighbours all day and gets new ones tomorrow. The house store (HOUSE, Grug's own) always takes the fifth spot,
   about five storefronts from the door, in every mall but its own. */
const POOL_FEEDS = ['game-assets/featured', 'game-assets/top-rated', 'game-assets/newest', 'games/featured', 'games/top-rated', 'tools/featured'];
const HOUSE = 'polysw';
const NEIGHBOURS = 13;
const HOUSE_SPOT = 4;
const POOL_FRESH = 3600;
const POOL_KEY = 'https://grugdigital.com/__cache/mall-pool/v1';
const USER_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

const decode = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const tagOf = (xml, t) => decode((xml.match(new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>')) || [])[1]);

export function parseFeed(xml) {
  const out = [];
  for (const m of String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], link = tagOf(it, 'link');
    const u = (link.match(/^https:\/\/([a-z0-9_-]+)\.itch\.io\/[^/]+/i) || [])[1];
    if (!u) continue;
    out.push({ user: u.toLowerCase(), title: tagOf(it, 'plainTitle') || tagOf(it, 'title'), cover: tagOf(it, 'imageurl'), price: tagOf(it, 'price'), url: link });
  }
  return out;
}

async function loadPool() {
  const by = new Map();
  for (const f of POOL_FEEDS) {
    try {
      const r = await fetch('https://itch.io/' + f + '.xml', { headers: { 'user-agent': 'GrugDigital/1.0 (+https://grugdigital.com/store/)', accept: 'application/xml' } });
      if (!r.ok) continue;
      for (const it of parseFeed(await r.text())) {
        if (!USER_RE.test(it.user)) continue;
        const c = by.get(it.user) || { user: it.user, items: [] };
        if (!c.items.some(x => x.url === it.url)) c.items.push({ title: it.title, cover: it.cover, price: it.price, url: it.url });
        by.set(it.user, c);
      }
    } catch (e) {}
  }
  // the shop windows only need a few covers (the small 315x250 ones first: the "original" ones can be huge gifs)
  return [...by.values()].map(c => ({ user: c.user, items: c.items.sort((a, b) => /\/original\//.test(a.cover) - /\/original\//.test(b.cover)).slice(0, 3) }))
    .sort((a, b) => a.user < b.user ? -1 : 1);
}

function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function onRequestGet(ctx) {
  const user = (new URL(ctx.request.url).searchParams.get('user') || '').trim().toLowerCase();
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': s === 200 ? 'public, max-age=600' : 'no-store', 'access-control-allow-origin': '*' } });
  if (!USER_RE.test(user)) return json({ error: 'bad username' }, 400);

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  let pool = null, age = Infinity, cached = null;
  if (cache) { try { cached = await cache.match(POOL_KEY); if (cached) { age = (Date.now() - +cached.headers.get('x-fetched')) / 1000; pool = await cached.clone().json(); } } catch (e) { pool = null; } }
  const refresh = async () => {
    const p = await loadPool();
    if (p.length && cache) await cache.put(POOL_KEY, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800', 'x-fetched': String(Date.now()) } }));
    return p;
  };
  if (!pool) { try { pool = await refresh(); } catch (e) { pool = []; } }
  else if (age > POOL_FRESH) ctx.waitUntil(refresh().catch(() => {}));

  const day = new Date().toISOString().slice(0, 10);
  const rnd = seeded(user + '|' + day);
  const others = pool.filter(c => c.user !== user && c.user !== HOUSE);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const neighbours = others.slice(0, NEIGHBOURS);
  if (user !== HOUSE) neighbours.splice(Math.min(HOUSE_SPOT, neighbours.length), 0, { user: HOUSE, items: [], house: true });
  return json({ user, day, neighbours });
}
