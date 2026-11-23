/* GET /api/itch-assets · the asset packs on itch.io, live (see src/itch/itch.js for what shows up and how it's sorted).

   itch is read at most once every FRESH seconds; in between, everyone gets the copy kept in Cloudflare's cache. Once
   that copy is older than FRESH, the next visitor still gets it straight away and a fresh one is fetched behind the
   scenes, so a new upload on itch shows on the site within a few minutes. If itch can't be reached, the last good copy
   keeps being served (for up to a week); the home page falls back to static/itch-assets.json if there is none at all.

   /api/itch-assets?refresh=1 skips the wait (for right after an upload): it fetches from itch now, at most once a minute. */
import { loadAssets } from '../../src/itch/itch.js';

const FRESH = 300;            // seconds a copy counts as current
const KEEP = 7 * 24 * 3600;   // how long a copy is kept to fall back on
const KEY = 'https://grugdigital.com/__cache/itch-assets/v1';

const json = (body, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*', ...extra },
});

export async function onRequestGet(ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const url = new URL(ctx.request.url);
  const wantRefresh = url.searchParams.has('refresh');

  let cached = null, age = Infinity;
  if (cache) {
    try {
      cached = await cache.match(KEY);
      if (cached) age = (Date.now() - +cached.headers.get('x-fetched')) / 1000;
    } catch (e) { cached = null; }
  }

  async function refresh() {
    const data = await loadAssets(fetch);
    const body = JSON.stringify(data);
    if (cache) {
      await cache.put(KEY, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + KEEP, 'x-fetched': String(Date.now()) } }));
    }
    return body;
  }

  if (cached && (age < FRESH || (wantRefresh && age < 60))) return json(await cached.text(), { 'x-itch-age': String(Math.round(age)) });

  if (cached && !wantRefresh) {
    ctx.waitUntil(refresh().catch(() => {}));   // serve the old copy now, fetch the new one behind the scenes
    return json(await cached.text(), { 'x-itch-age': String(Math.round(age)), 'x-itch-refreshing': '1' });
  }

  try {
    return json(await refresh(), { 'x-itch-age': '0' });
  } catch (e) {
    if (cached) return json(await cached.text(), { 'x-itch-age': String(Math.round(age)), 'x-itch-error': String(e.message || e).slice(0, 200) });
    return new Response(JSON.stringify({ error: 'itch.io could not be reached', detail: String(e.message || e) }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
