/* Retired. The earlier Rodeo Express app (before it was rebuilt on tools/partner-app/) registered this service worker to
   work offline. The new app doesn't use one, so a phone that still has the old worker installed fetches this file on its
   next visit, clears the old cache, lets go of the page and reloads it fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.startsWith('rodeo-demo-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(c => { try { c.navigate(c.url); } catch (e) {} });
  })());
});
