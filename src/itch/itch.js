/* Grug · the asset packs on itch.io (https://polysw.itch.io/), read live so the home page always matches itch.

   Used by functions/api/itch-assets.js (the live feed the home page reads) and by src/itch/snapshot.mjs (writes
   static/itch-assets.json, the fallback the page shows if the live feed can't be reached).

   What shows up, and where:
   - Every project on the itch profile page that is an asset pack shows up, newest first. A project counts as an asset
     when its price tag says "asset pack"/"asset kit", or it's in one of the COLLECTIONS below, or its itch page files it
     under "Game assets" (that covers free packs, which have no price tag). Games and tools on the profile are left out.
     Hide a project from the itch profile and it leaves the site too.
   - COLLECTIONS are the categories (the filter chips on the site), in this order. Their titles and the order of the
     packs inside them come from itch, so rename or reorder a collection on itch and the site follows. An asset that
     isn't in any of them yet still shows (under "All" and "Just added").
   - To add a category: make a public collection on itch, add its number (itch.io/c/<number>/…) here, push. */

export const ITCH = {
  user: 'polysw',
  profile: 'https://polysw.itch.io/',
  COLLECTIONS: [
    8515954, // Avatar Accessories   https://itch.io/c/8515954/avatar-accessories
    8550309, // Characters & Avatars https://itch.io/c/8550309/characters-avatars
    8550318, // Pets & Creatures     https://itch.io/c/8550318/pets-creatures
    8550322, // Game Kits & Props    https://itch.io/c/8550322/game-kits-props
  ],
  newest: 3, // the newest few packs get a "New" badge
};

const UA = 'GrugDigital/1.0 (+https://grugdigital.com/)';

const decode = s => String(s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').trim();
const attr = (tag, name) => { const m = tag && tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? decode(m[1]) : ''; };

/* The game cells itch draws on profile, collection and browse pages (the same markup everywhere, attribute order varies). */
export function parseCells(html) {
  const out = [];
  const chunks = String(html || '').split(/data-game_id="/).slice(1);
  for (const c of chunks) {
    const id = +c.slice(0, c.indexOf('"'));
    if (!id || out.some(x => x.id === id)) continue;
    const titleA = c.match(/<a\b[^>]*class="title game_link"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleA) continue;
    const aTag = titleA[0].slice(0, titleA[0].indexOf('>') + 1);
    const img = c.match(/<img\b[^>]*>/);
    const priceTag = c.match(/<div\b[^>]*class="price_tag[^"]*"[^>]*>/);
    const price = c.match(/class="price_value">([^<]*)</);
    const text = c.match(/<div\b[^>]*class="game_text"[^>]*>([\s\S]*?)<\/div>/);
    const gif = c.match(/data-gif="([^"]+)"/);
    out.push({
      id,
      title: decode(titleA[1]),
      url: attr(aTag, 'href'),
      cover: img ? (attr(img[0], 'data-lazy_src') || attr(img[0], 'src')) : '',
      gif: gif ? decode(gif[1]) : '',
      price: price ? decode(price[1]) : 'Free',
      kind: priceTag ? attr(priceTag[0], 'title') : '',   // "Pay $3.99 or more for this asset pack"
      text: text ? decode(text[1]) : '',
      genre: decode((c.match(/class="game_genre">([^<]*)</) || [])[1]),
      web: /class="web_flag"/.test(c),
    });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// itch answers 429 to bursts, so callers go one request at a time, and a 429 gets one more try after a pause
async function fetchOk(url, fetcher, accept = 'text/html') {
  for (let tries = 0; ; tries++) {
    const r = await fetcher(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow' });
    if (r.ok) return r;
    if (r.status === 429 && tries < 2) { await sleep(1500 * (tries + 1)); continue; }
    throw new Error(url + ' answered ' + r.status);
  }
}
const get = async (url, fetcher) => (await fetchOk(url, fetcher)).text();

async function collection(id, fetcher) {
  // itch redirects /c/<id>/<anything> to the collection's real address, so a renamed collection keeps working
  const r = await fetchOk('https://itch.io/c/' + id + '/x', fetcher);
  const html = await r.text();
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]).replace(/\s*-\s*Collection by[\s\S]*$/, '');
  const url = /\/c\/\d+\/[^/?#]+$/.test(r.url || '') ? r.url : 'https://itch.io/c/' + id;
  const items = parseCells(html);
  // the page holds the first 30 or so; a long collection loads the rest from itch's infinite-scroll feed
  for (let p = 2; items.length >= 15 && p <= 10; p++) {
    const j = JSON.parse(await (await fetchOk(url + '?format=json&page=' + p, fetcher, 'application/json')).text());
    const cells = parseCells(j.content).filter(c => !items.some(x => x.id === c.id));
    items.push(...cells);
    if (cells.length < 15) break;
  }
  return { id, title: title || 'Collection', url, items };
}

/* Is this project filed under "Game assets" on its own itch page? (free packs have no price tag to tell by) */
async function isAssetPage(url, fetcher) {
  try { return /"name":"Game assets"/.test(await get(url, fetcher)); } catch (e) { return false; }
}

/* Everything the home page needs, as plain JSON. fetcher defaults to fetch (Workers, Node 18+). */
export async function loadAssets(fetcher = fetch) {
  const profileHtml = await get(ITCH.profile, fetcher);
  const cols = [];
  for (const id of ITCH.COLLECTIONS) cols.push(await collection(id, fetcher).catch(e => ({ id, error: String(e.message || e), items: [] })));
  const profile = parseCells(profileHtml);
  if (!profile.length) throw new Error('the itch profile page had no projects on it (itch may have changed its markup)');
  const inCol = new Map();
  for (const c of cols) for (const it of c.items) if (!inCol.has(it.id)) inCol.set(it.id, it);

  const unsure = profile.filter(p => !/asset/i.test(p.kind) && !inCol.has(p.id));
  const checked = [];
  for (const p of unsure) checked.push(await isAssetPage(p.url, fetcher));
  const assetIds = new Set(profile.filter(p => /asset/i.test(p.kind) || inCol.has(p.id)).map(p => p.id));
  unsure.forEach((p, i) => { if (checked[i]) assetIds.add(p.id); });

  // the profile's own copy of each pack, plus any pack put in a collection without being on the profile
  const byId = new Map();
  for (const p of profile) if (assetIds.has(p.id)) byId.set(p.id, p);
  for (const [id, it] of inCol) if (!byId.has(id)) byId.set(id, it);

  const items = [...byId.values()].sort((a, b) => b.id - a.id).map(({ kind, genre, web, ...it }, i) => ({
    ...it, cats: cols.filter(c => c.items.some(x => x.id === it.id)).map(c => c.id), new: i < ITCH.newest,
  }));
  return {
    updated: new Date().toISOString(),
    profile: ITCH.profile,
    collections: cols.filter(c => !c.error && c.items.length).map(c => ({ id: c.id, title: c.title, url: c.url, items: c.items.map(x => x.id).filter(id => byId.has(id)) })),
    items,
    errors: cols.filter(c => c.error).map(c => c.error),
  };
}
