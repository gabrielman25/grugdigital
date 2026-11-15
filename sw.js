/* Grug · the service worker (sw.js, at the site root so it covers every page)

   It does three things, for both installable apps (Grug: the games side; Daypart: the restaurant side):

   1. Every page and file still comes from the network first, so the site is always the newest version when there is a
      connection. If the network fails (or takes longer than a few seconds), the copy kept on the device is used, and a
      page that was never saved shows offline.html.
   2. Downloads (app/offline.json): an installed app asks this worker to keep its packs on the device (app/app.js sends
      {type: 'sync', apps, adult}). The worker fetches app/offline.json fresh, compares each file's fingerprint with the
      copy it keeps, downloads only what is new or changed, and drops files no pack lists any more. A new Grug original
      is a new pack, so it downloads by itself. Progress and the result go back to the open pages as messages
      ({type: 'progress' | 'synced' | 'sync-failed'}); app/app.js turns them into the little notes at the bottom.
   3. Anything else the person opens online is saved too (the RUNTIME cache, capped), so it works offline next time.

   Caches: FILES (the packs' files, each with its fingerprint in the 'x-grug-v' header), RUNTIME (everything else that
   was opened), META (the offline list last used, what the apps asked for, offline.html). Bump nothing by hand:
   app/offline.json carries the versions. Rebuild that list after changing the site: python3 tools/pwa/build.py */
'use strict';

const FILES = 'grug-files-v1', RUNTIME = 'grug-runtime-v1', META = 'grug-meta-v1';
const KEEP = [FILES, RUNTIME, META];
const RUNTIME_MAX = 400;                        // files kept from browsing (oldest go first)
const NAV_WAIT = 3500, FILE_WAIT = 8000;        // ms to wait for the network before using the saved copy
const CHECK_EVERY = 10 * 60e3;                  // don't fetch the offline list more often than this
const SCOPE = self.registration.scope;          // ends in '/'
const at = p => new URL(String(p).replace(/^\//, ''), SCOPE).href;
const LIST = at('app/offline.json'), OFFLINE = at('offline.html');

/* ---------- install / activate ---------- */
self.addEventListener('install', e => {
  self.skipWaiting();
  // (Cloudflare Pages answers /offline.html with a redirect to /offline: keep a clean copy, which can be served to a page load)
  e.waitUntil(fetch(OFFLINE, { cache: 'no-cache' }).then(async r => { if (r.ok) await (await caches.open(META)).put(OFFLINE, await clean(r)); }).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('grug-') && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
    await loadIndex();
  })());
});

/* ---------- what the packs hold (the offline list last used) ---------- */
let INDEX = null;          // { v, apps, packs } from app/offline.json
let PACKED = new Set();    // every file URL the wanted packs hold
async function readMeta(key) { try { const r = await (await caches.open(META)).match(at('__' + key)); return r ? await r.json() : null; } catch (e) { return null; } }
async function writeMeta(key, val) { const c = await caches.open(META); await c.put(at('__' + key), new Response(JSON.stringify(val), { headers: { 'content-type': 'application/json' } })); }
async function loadIndex() {
  if (INDEX) return INDEX;
  INDEX = await readMeta('index');
  const st = await readMeta('state');
  PACKED = new Set();
  if (INDEX && st && st.wanted) for (const id of st.wanted) for (const u of Object.keys((INDEX.packs[id] || {}).files || {})) PACKED.add(at(u));
  return INDEX;
}

/* ---------- serving ---------- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                                   // other hosts: the browser's business
  if (url.href === at('sw.js') || url.href.split('?')[0] === LIST) return;            // always fresh
  e.respondWith(serve(req, url, req.mode === 'navigate'));
});

// The address a saved copy may be kept under: a folder and its index.html, a page with and without '.html'.
function keysFor(url) {
  const base = url.origin + url.pathname, out = [base];
  if (base.endsWith('/index.html')) out.push(base.slice(0, -10));
  else if (base.endsWith('/')) out.push(base + 'index.html');
  else if (base.endsWith('.html')) out.push(base.slice(0, -5));
  else if (!/\.[a-z0-9]+$/i.test(url.pathname)) out.push(base + '/', base + '.html');
  return out;
}
async function saved(url) {
  for (const k of keysFor(url)) {
    for (const name of [FILES, RUNTIME]) {
      const r = await (await caches.open(name)).match(k, { ignoreSearch: true });
      if (r) return r;
    }
  }
  return null;
}
// A copy that can be served for any request: no 'redirected' flag, and its own status.
async function clean(r, extra) {
  const h = new Headers(r.headers); if (extra) for (const k in extra) h.set(k, extra[k]);
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: h });
}
// Mark a page that came from the device, so app/app.js can offer a refresh once a newer one is downloaded.
async function markSaved(r) {
  if (!/text\/html/.test(r.headers.get('content-type') || '')) return r;
  const text = (await r.text()).replace(/<head([^>]*)>/i, '<head$1><script>window.__grugSaved=1</script>');
  const h = new Headers(r.headers); h.delete('content-length');
  return new Response(text, { status: r.status, statusText: r.statusText, headers: h });
}
async function offlinePage() {
  const r = await (await caches.open(META)).match(OFFLINE) || await saved(new URL(OFFLINE));
  return r || new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p style="font-family:sans-serif;padding:2rem">You’re offline, and this page isn’t saved on this device yet.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
async function keepRuntime(req, res) {
  try {
    await loadIndex();
    const url = new URL(req.url), key = url.origin + url.pathname;
    if (PACKED.has(key) || res.status !== 200 || res.type !== 'basic') return;
    const c = await caches.open(RUNTIME);
    await c.put(key, await clean(res));
    const keys = await c.keys();
    for (let i = 0; i < keys.length - RUNTIME_MAX; i++) await c.delete(keys[i]);
  } catch (e) {}
}
function serve(req, url, nav) {
  const fromDevice = async () => { const r = await saved(url); return r ? (nav ? markSaved(r) : r) : null; };
  if (self.navigator && self.navigator.onLine === false) {
    return fromDevice().then(r => r || fetch(req)).catch(() => nav ? offlinePage() : Response.error());
  }
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const net = fetch(req);
    const t = setTimeout(async () => { const r = await fromDevice(); if (r) finish(r); }, nav ? NAV_WAIT : FILE_WAIT);
    net.then(res => {
      clearTimeout(t);
      if (res.ok) { const copy = res.clone(); keepRuntime(req, copy); }
      finish(res);
    }).catch(async () => {
      clearTimeout(t);
      if (done) return;
      const r = await fromDevice();
      finish(r || (nav ? await offlinePage() : Response.error()));
    });
  });
}

/* ---------- downloads: keep the wanted packs on the device ---------- */
let running = null;
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'sync') e.waitUntil(sync(d));
  if (d.type === 'status') e.waitUntil(status(e.source));
});
self.addEventListener('periodicsync', e => { if (e.tag === 'grug-sync') e.waitUntil(sync({ background: true })); });

async function tell(msg) { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg); }
async function status(to) {
  const st = await readMeta('state') || {};
  if (to) to.postMessage({ type: 'status', ...st });
}

// Which packs the installed apps want: Grug = its shell, Carts and every game (mature ones only for adults),
// Daypart = the restaurant side. `apps` and `adult` come from the page and are remembered for background checks.
function wantedPacks(index, apps, adult) {
  const out = [];
  for (const a of apps) for (const id of (index.apps[a] || [])) {
    const p = index.packs[id]; if (!p || out.includes(id)) continue;
    if (p.rating === 'mature' && !adult) continue;
    out.push(id);
  }
  return out;
}

function sync(opts) {
  if (running) return running;
  running = (async () => {
    try { return await doSync(opts || {}); }
    catch (err) { await tell({ type: 'sync-failed', error: String(err && err.message || err) }); }
    finally { running = null; }
  })();
  return running;
}

async function doSync(opts) {
  const old = await readMeta('state') || {};
  const apps = opts.apps ? [...new Set([...(old.apps || []), ...opts.apps])] : (old.apps || []);
  const adult = opts.adult === undefined ? !!old.adult : !!opts.adult;
  if (!apps.length) return;
  if (!opts.force && old.at && Date.now() - old.at < CHECK_EVERY && old.complete
      && String(old.apps) === String(apps) && old.adult === adult) {
    await tell({ type: 'synced', v: old.v, quiet: true, complete: true });
    return;
  }
  const res = await fetch(LIST, { cache: 'no-store' });
  if (!res.ok) throw new Error('offline list: ' + res.status);
  const index = await res.json();
  const prevIndex = await readMeta('index');
  const wanted = wantedPacks(index, apps, adult);

  // every file the wanted packs hold, with its fingerprint
  const want = new Map();
  for (const id of wanted) for (const [u, v] of Object.entries(index.packs[id].files)) want.set(at(u), v);

  const files = await caches.open(FILES);
  const todo = [];
  for (const [u, v] of want) {
    const r = await files.match(u);
    if (!r || r.headers.get('x-grug-v') !== v) todo.push([u, v, !!r]);
  }
  const firstTime = !old.complete;
  const total = todo.length;
  let done = 0, failed = 0, changed = 0, lastTell = 0;
  const progress = async (force) => {
    if (!force && Date.now() - lastTell < 250) return;
    lastTell = Date.now();
    await tell({ type: 'progress', done, total, firstTime });
  };
  if (total) await progress(true);

  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const [u, v, had] = queue.shift();
      try {
        const r = await fetch(u, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        await files.put(u, await clean(r, { 'x-grug-v': v }));
        if (had) changed++;
      } catch (e) { failed++; }
      done++;
      await progress();
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  // drop what no wanted pack lists any more, and browsing copies of files that are now in a pack
  for (const req of await files.keys()) if (!want.has(req.url)) await files.delete(req);
  const rt = await caches.open(RUNTIME);
  for (const req of await rt.keys()) if (want.has(req.url.split('?')[0])) await rt.delete(req);

  // games that weren't in the last list this device used
  const added = [];
  if (old.wanted && prevIndex) for (const id of wanted) {
    if (id.startsWith('game:') && !old.wanted.includes(id) && !(prevIndex.packs && prevIndex.packs[id])) added.push(index.packs[id].title);
  }

  const state = { v: index.v, apps, adult, wanted, at: Date.now(), complete: failed === 0, failed,
                  bytes: wanted.reduce((n, id) => n + (index.packs[id].bytes || 0), 0) };
  await writeMeta('index', index);
  await writeMeta('state', state);
  INDEX = index; PACKED = new Set(want.keys());
  await tell({ type: 'synced', v: index.v, firstTime, added, changed, downloaded: total - failed, failed, complete: state.complete,
               background: !!opts.background });
}
