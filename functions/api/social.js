/* GET /api/social · Grug's socials, live, for the banners, billboards and TVs.

   { links, discord: { name, icon, members, online, widget, avatars: [{ name, avatar, status }] },
     youtube: { channelId, url, videos: [{ id, title, published }] }, updated }

   Discord: the invite (member and online counts, no setup needed) plus the server widget (who is online, with avatars),
   which only answers once "Enable Server Widget" is on in the server's settings. Read at most once a minute.
   YouTube: the channel page for @PolySwitchOfficial gives the channel id; its feed gives the newest videos. Read at most
   every 3 hours. Either part keeps its last good copy (for a week) if the site can't be reached.

   GET /api/social?img=<url> relays a YouTube thumbnail or a Discord avatar/icon (only those hosts), so the 3D games can
   draw it onto a billboard or a TV (a picture straight from another site can't be used in WebGL). */

const INVITE = '3ENePvNGJy';
const YT_HANDLE = 'PolySwitchOfficial';
const LINKS = {
  discord: 'https://discord.gg/' + INVITE,
  instagram: 'https://www.instagram.com/grugdigital',
  youtube: 'https://www.youtube.com/@' + YT_HANDLE,
};
const KEEP = 7 * 24 * 3600;
const DISCORD_FRESH = 60, YOUTUBE_FRESH = 3 * 3600;
const IMG_HOSTS = /^(i\d?\.ytimg\.com|img\.youtube\.com|cdn\.discordapp\.com|media\.discordapp\.net)$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const json = (body, extra = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30', 'access-control-allow-origin': '*', ...extra },
});

async function cached(key, fresh, load, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null, K = 'https://grugdigital.com/__cache/social/' + key;
  let hit = null, age = Infinity;
  if (cache) { try { hit = await cache.match(K); if (hit) age = (Date.now() - +hit.headers.get('x-fetched')) / 1000; } catch (e) { hit = null; } }
  const store = async () => {
    const data = await load(), body = JSON.stringify(data);
    if (cache) await cache.put(K, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + KEEP, 'x-fetched': String(Date.now()) } }));
    return data;
  };
  if (hit && age < fresh) return hit.json();
  if (hit) { ctx.waitUntil(store().catch(() => {})); return hit.json(); }   // serve the old copy now, refresh behind the scenes
  try { return await store(); } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
}

async function loadDiscord() {
  const r = await fetch(`https://discord.com/api/v10/invites/${INVITE}?with_counts=true`, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error('discord invite ' + r.status);
  const inv = await r.json(), g = inv.guild || {};
  const out = {
    id: g.id || '', name: g.name || 'Grug Discord', icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : '',
    members: inv.approximate_member_count || 0, online: inv.approximate_presence_count || 0, widget: false, avatars: [],
  };
  if (g.id) {
    try {
      const w = await fetch(`https://discord.com/api/guilds/${g.id}/widget.json`, { headers: { 'user-agent': UA } });
      if (w.ok) {
        const d = await w.json();
        out.widget = true;
        if (d.presence_count) out.online = Math.max(out.online, d.presence_count);
        out.avatars = (d.members || []).slice(0, 40).map(m => ({ name: m.username || '', avatar: m.avatar_url || '', status: m.status || 'online', game: (m.game && m.game.name) || '' }));
      }
    } catch (e) { }
  }
  return out;
}

const unxml = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
async function loadYouTube() {
  const H = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' };
  const page = await fetch(`https://www.youtube.com/@${YT_HANDLE}/videos`, { headers: H });
  const html = page.ok ? await page.text() : '';
  const cid = ((html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/"channelId":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/) || [])[1]) || '';
  const videos = [], seen = new Set();
  if (cid) {
    const f = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, { headers: H });
    if (f.ok) {
      const xml = await f.text();
      for (const e of xml.split('<entry>').slice(1)) {
        const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1]; if (!id || seen.has(id)) continue;
        seen.add(id); videos.push({ id, title: unxml((e.match(/<title>([^<]*)<\/title>/) || [, ''])[1]), published: (e.match(/<published>([^<]*)<\/published>/) || [, ''])[1] });
      }
    }
  }
  // older uploads listed on the channel page, for more variety on the TVs (titles when the page has them)
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) {
    const id = m[1]; if (seen.has(id)) continue; seen.add(id);
    const near = html.slice(m.index, m.index + 1500), t = near.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) || near.match(/"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
    videos.push({ id, title: t ? JSON.parse('"' + t[1] + '"') : '', published: '' });
    if (videos.length >= 40) break;
  }
  if (!cid && !videos.length) throw new Error('youtube channel not found');
  return { channelId: cid, url: LINKS.youtube, videos };
}

async function relayImage(src, ctx) {
  let u; try { u = new URL(src); } catch (e) { return new Response('bad url', { status: 400 }); }
  if (u.protocol !== 'https:' || !IMG_HOSTS.test(u.hostname)) return new Response('host not allowed', { status: 403 });
  const cache = typeof caches !== 'undefined' ? caches.default : null, K = 'https://grugdigital.com/__cache/social-img/' + encodeURIComponent(u.href);
  if (cache) { const hit = await cache.match(K); if (hit) return hit; }
  const r = await fetch(u.href, { headers: { 'user-agent': UA } });
  if (!r.ok) return new Response('image unavailable', { status: 502 });   // never 404: the middleware would fall back to the legacy site
  const type = r.headers.get('content-type') || 'image/jpeg';
  if (!/^image\//.test(type)) return new Response('not an image', { status: 415 });
  const res = new Response(await r.arrayBuffer(), { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' } });
  if (cache) ctx.waitUntil(cache.put(K, res.clone()));
  return res;
}

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  if (url.searchParams.has('img')) return relayImage(url.searchParams.get('img'), ctx);
  const [discord, youtube] = await Promise.all([cached('discord-v1', DISCORD_FRESH, loadDiscord, ctx), cached('youtube-v1', YOUTUBE_FRESH, loadYouTube, ctx)]);
  return json({ links: LINKS, discord, youtube: Object.assign({ url: LINKS.youtube, videos: [] }, youtube), updated: new Date().toISOString() });
}
