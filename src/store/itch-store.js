/* Grug · the 3D store's catalog: every public project on any creator's itch.io profile, as plain JSON.

   Used by functions/api/itch-store.js (GET /api/itch-store?user=<itch username>), which caches it.

   - The list is the creator's profile page (https://<user>.itch.io/): what they chose to show publicly, in their order.
   - Each project gets a type, for which fixture it goes on in the store: 'game' (arcade cabinets), 'asset' (shop
     shelves), 'tool' (vending and ticket machines) or 'other' (donations and the like: left out of the store). The type
     comes from, in order: the price tag's wording ("…for this asset pack"), itch's per-category feeds
     (itch.io/<category>/by-<user>.xml, which list the creator's games, game assets and tools), then the genre (only
     games have one), else 'asset'.
   - itch answers 429 to bursts: everything here is one request at a time (four per creator), and the caller caches.
   - Cover URLs are signed per size: only the 315x250 ones itch gives us work, so they're passed on as they are.
     Screenshots, tags and sale end dates aren't here: the store page reads them from the project's own data.json
     (itch serves that with open CORS) when a customer opens a product, so this stays to four requests. */

const UA = 'GrugDigital/1.0 (+https://grugdigital.com/store/)';
export const USER_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

const decode = s => String(s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').trim();
const attr = (tag, name) => { const m = tag && tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? decode(m[1]) : ''; };

const sleep = ms => new Promise(r => setTimeout(r, ms));
export class NotFound extends Error {}

async function fetchText(url, fetcher, accept = 'text/html') {
  for (let tries = 0; ; tries++) {
    const r = await fetcher(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow' });
    if (r.ok) return { text: await r.text(), url: r.url || url };
    if (r.status === 404) throw new NotFound(url + ' answered 404');
    if (r.status === 429 && tries < 2) { await sleep(1500 * (tries + 1)); continue; }
    throw new Error(url + ' answered ' + r.status);
  }
}

/* The game cells itch draws on a profile page. The price tag is an <a> during a sale and a <div> otherwise, and the
   attribute order varies, so every piece is matched on its own. */
export function parseProfile(html) {
  const out = [];
  for (const c of String(html || '').split(/data-game_id="/).slice(1)) {
    const id = +c.slice(0, c.indexOf('"'));
    if (!id || out.some(x => x.id === id)) continue;
    const titleA = c.match(/<a\b[^>]*class="title game_link"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleA) continue;
    const aTag = titleA[0].slice(0, titleA[0].indexOf('>') + 1);
    const url = attr(aTag, 'href');
    const img = c.match(/<img\b[^>]*>/);
    const priceTag = c.match(/<(?:a|div)\b[^>]*class="price_tag[^"]*"[^>]*>/);
    const price = c.match(/class="price_value">([^<]*)</);
    const sale = c.match(/class="sale_tag">\s*-?(\d+)%/);
    const text = c.match(/<div\b[^>]*class="game_text"[^>]*>([\s\S]*?)<\/div>/);
    const gif = c.match(/data-gif="([^"]+)"/);
    let slug = '';
    try { slug = new URL(url).pathname.replace(/^\/+|\/+$/g, ''); } catch (e) {}
    if (!slug) continue;
    out.push({
      id, slug, url,
      title: decode(titleA[1]),
      cover: img ? (attr(img[0], 'data-lazy_src') || attr(img[0], 'src')) : '',
      gif: gif ? decode(gif[1]) : '',
      price: price ? decode(price[1]) : 'Free',
      sale: sale ? +sale[1] : 0,
      kind: priceTag ? attr(priceTag[0], 'title') : '',   // "Pay $3.99 or more for this asset pack"
      text: text ? decode(text[1]) : '',
      genre: decode((c.match(/class="game_genre">([^<]*)</) || [])[1]),
      web: /class="web_flag"/.test(c),
    });
  }
  return out;
}

const feedLinks = xml => new Set([...String(xml || '').matchAll(/<link>([^<]+)<\/link>/g)].map(m => decode(m[1]).replace(/\/+$/, '')));

function typeFromKind(kind) {
  const k = kind.toLowerCase();
  if (!k) return '';
  if (/donation/.test(k)) return 'other';
  if (/asset|sprite|tileset|model|texture|sound|music|font|bundle|kit|pack/.test(k)) return 'asset';
  if (/software|tool|plugin|add-?on|extension/.test(k)) return 'tool';
  if (/game|demo/.test(k)) return 'game';
  return '';
}

export async function loadStore(user, fetcher = fetch) {
  if (!USER_RE.test(user)) throw new NotFound('not an itch.io username');
  const profileUrl = 'https://' + user.toLowerCase() + '.itch.io/';
  const page = await fetchText(profileUrl, fetcher);
  // an unknown username lands on itch's front page or a 404 page, not a profile
  if (!/^https:\/\/[^/]+\.itch\.io\/?$/i.test(page.url.replace(/[?#].*$/, ''))) throw new NotFound('no itch.io profile called ' + user);
  const cells = parseProfile(page.text);
  const name = decode((page.text.match(/<title>([\s\S]*?)<\/title>/) || [])[1]).replace(/\s*[-·|]\s*itch\.?io\s*$/i, '') || user;

  const feeds = {};
  for (const [cat, type] of [['games', 'game'], ['game-assets', 'asset'], ['tools', 'tool']]) {
    try { feeds[type] = feedLinks((await fetchText('https://itch.io/' + cat + '/by-' + user.toLowerCase() + '.xml', fetcher, 'application/xml')).text); }
    catch (e) { feeds[type] = new Set(); }
  }

  const items = cells.map(({ kind, ...c }) => {
    const u = c.url.replace(/\/+$/, '');
    const type = typeFromKind(kind)
      || (feeds.asset.has(u) ? 'asset' : feeds.tool.has(u) ? 'tool' : feeds.game.has(u) ? 'game' : '')
      || (c.genre ? 'game' : 'asset');
    return { ...c, type };
  });

  return { user: user.toLowerCase(), name, profile: profileUrl, updated: new Date().toISOString(), items };
}
