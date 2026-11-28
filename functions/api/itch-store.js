/* GET /api/itch-store?user=<itch username> · one creator's public itch.io catalog, for the 3D store (/store/<user>).

   What's in it and how projects get their type: src/store/itch-store.js. Caching works like /api/itch-assets: itch is
   read at most once every FRESH seconds per creator; an older copy is served at once while a fresh one is fetched
   behind the scenes, and the last good copy keeps being served (for a week) if itch can't be reached. Unknown
   usernames are remembered for a few minutes too, so nobody can make the site hammer itch with made-up names.

   ?refresh=1 skips the wait (for right after an upload), at most once a minute per creator. */
import { loadStore, NotFound, USER_RE } from '../../src/store/itch-store.js';

const FRESH = 600;
const KEEP = 7 * 24 * 3600;
const MISS = 300;
const keyFor = user => 'https://grugdigital.com/__cache/itch-store/v1/' + user;

const json = (body, status = 200, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store', 'access-control-allow-origin': '*', ...extra },
});

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const user = (url.searchParams.get('user') || '').trim().toLowerCase();
  if (!USER_RE.test(user)) return json({ error: 'Type an itch.io username (the part before .itch.io).' }, 400);

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const KEY = keyFor(user);
  let cached = null, age = Infinity;
  if (cache) {
    try {
      cached = await cache.match(KEY);
      if (cached) age = (Date.now() - +cached.headers.get('x-fetched')) / 1000;
    } catch (e) { cached = null; }
  }
  const missing = cached && cached.headers.get('x-missing') === '1';
  if (missing && age < MISS) return json({ error: 'No itch.io profile called ' + user + '.' }, 404);

  const wantRefresh = url.searchParams.has('refresh');
  async function refresh() {
    let body, miss = false;
    try { body = JSON.stringify(await loadStore(user, fetch)); }
    catch (e) { if (!(e instanceof NotFound)) throw e; miss = true; body = '{}'; }
    if (cache) {
      await cache.put(KEY, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + (miss ? MISS : KEEP), 'x-fetched': String(Date.now()), 'x-missing': miss ? '1' : '0' } }));
    }
    if (miss) throw new NotFound(user);
    return body;
  }

  if (cached && !missing && (age < FRESH || (wantRefresh && age < 60))) return json(await cached.text(), 200, { 'x-itch-age': String(Math.round(age)) });
  if (cached && !missing && !wantRefresh) {
    ctx.waitUntil(refresh().catch(() => {}));
    return json(await cached.text(), 200, { 'x-itch-age': String(Math.round(age)), 'x-itch-refreshing': '1' });
  }
  try {
    return json(await refresh(), 200, { 'x-itch-age': '0' });
  } catch (e) {
    if (e instanceof NotFound) return json({ error: 'No itch.io profile called ' + user + '.' }, 404);
    if (cached && !missing) return json(await cached.text(), 200, { 'x-itch-age': String(Math.round(age)), 'x-itch-error': String(e.message || e).slice(0, 200) });
    return json({ error: 'itch.io could not be reached. Try again in a minute.', detail: String(e.message || e) }, 502);
  }
}
