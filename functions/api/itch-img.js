/* GET /api/itch-img?u=<an img.itch.zone address> · an itch.io picture, passed through with open CORS.

   itch's image server sends no CORS headers, so a page can show its pictures but can't paint them onto 3D surfaces
   (WebGL refuses "tainted" images). The 3D store (/store/) loads its shelf and cabinet covers through here. Only
   img.itch.zone addresses are passed on, only pictures come back, and each one is kept in Cloudflare's cache for a day
   (the addresses are signed and never change in place). */
const MAX = 6 * 1024 * 1024;

export async function onRequestGet(ctx) {
  const raw = new URL(ctx.request.url).searchParams.get('u') || '';
  let src;
  try { src = new URL(raw); } catch (e) { return new Response('bad address', { status: 400 }); }
  if (src.protocol !== 'https:' || src.hostname !== 'img.itch.zone') return new Response('only img.itch.zone pictures', { status: 400 });

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://grugdigital.com/__cache/itch-img/v1?u=' + encodeURIComponent(src.href));
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }

  let r;
  try { r = await fetch(src.href, { headers: { 'user-agent': 'GrugDigital/1.0 (+https://grugdigital.com/store/)' }, cf: { cacheTtl: 86400, cacheEverything: true } }); }
  catch (e) { return new Response('itch.io could not be reached', { status: 502 }); }
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/^image\//i.test(type)) return new Response('not a picture', { status: r.ok ? 415 : r.status });
  const len = +r.headers.get('content-length') || 0;
  if (len > MAX) return new Response('picture too large', { status: 413 });

  const out = new Response(r.body, { headers: {
    'content-type': type,
    'cache-control': 'public, max-age=86400',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  } });
  if (cache) ctx.waitUntil(cache.put(key, out.clone()).catch(() => {}));
  return out;
}
