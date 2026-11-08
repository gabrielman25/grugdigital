/* Rodeo Express demo: works offline after one visit. Network first (so updates show up right away), the saved copy
   when there's no signal. Only covers play/rodeo/ and the shared files it loads. */
const CACHE = 'rodeo-demo-v5';
const CORE = ['./', './index.html', './game.html', './assets/logo.webp', './assets/westwood.webp', './assets/icon.png',
  '../../assets/catalog.js', '../../assets/icons.js', '../../assets/games.js', '../../assets/grug.js', '../../assets/grug-app.js', '../../assets/grug-app.css', '../../assets/sandy-runtime.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('rodeo-demo-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), fonts = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !fonts) return;
  e.respondWith(fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
