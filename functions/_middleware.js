/* Grug · the legacy pass-through (Cloudflare Pages Functions middleware, runs on every request)

   The old site lives on the `legacy` branch, which Cloudflare deploys to https://legacy.grugdigital.pages.dev.
   This branch (main) is the new site. Every address keeps working on the main address like this:

   1. A file that exists on main is served as usual (the new site always wins).
   2. Anything main doesn't have is fetched from the legacy deploy and served at the SAME address, so every old link,
      QR code, NFC tag and installed app keeps working, and people keep their saved data (it is tied to the address).
      Legacy pages get a banner at the top saying they're the legacy version, with a link to the new site.
   3. `/` is the new home page. The old home page is at `/legacy`. The installed apps open `/?pwa=…`, which still gets
      the old home page so they keep working.

   To retire an old page, make a page at the same path on main: it takes over that address. */

const LEGACY_ORIGIN = 'https://legacy.grugdigital.pages.dev';

// images renamed to descriptive names (for Google Images, src/seo/README.md): the old addresses still work (old embeds,
// the itch.io ads already out there, other sites linking them) with a permanent redirect to the new name
const MOVED = {
  '/arcade/brickbound/cover.jpg': '/arcade/brickbound/brickbound-grug-arcade.jpg',
  '/arcade/grug-city/cover.jpg': '/arcade/grug-city/grug-city-grug-arcade.jpg',
  '/arcade/grug-kingdom/cover.jpg': '/arcade/grug-kingdom/grug-kingdom-grug-arcade.jpg',
  '/arcade/grug-studio/cover.jpg': '/arcade/grug-studio/grug-studio-grug-arcade.jpg',
  '/arcade/pet-zones/cover.jpg': '/arcade/pet-zones/pet-zones-grug-arcade.jpg',
  '/arcade/slide-999/cover.jpg': '/arcade/slide-999/slide-999-grug-arcade.jpg',
  '/arcade/zombie-zones/cover.jpg': '/arcade/zombie-zones/zombie-zones-grug-arcade.jpg',
  '/arcade/zone-royale/cover.jpg': '/arcade/zone-royale/zone-royale-grug-arcade.jpg',
  '/static/arcade/city-aerial.jpg': '/static/arcade/grug-city-rp-aerial-view.jpg',
  '/static/arcade/city-icecream.jpg': '/static/arcade/grug-city-rp-ice-cream-shop.jpg',
  '/static/arcade/city-pizza.jpg': '/static/arcade/grug-city-rp-pizza-shop.jpg',
  '/static/arcade/city-salon.jpg': '/static/arcade/grug-city-rp-salon.jpg',
  '/static/showcase/bg-slide-1.jpg': '/static/showcase/slide-999-km-purple-slide-1.jpg',
  '/static/showcase/bg-slide-2.jpg': '/static/showcase/slide-999-km-purple-slide-2.jpg',
  '/static/showcase/bg-slide-3.jpg': '/static/showcase/slide-999-km-purple-slide-3.jpg',
  '/static/showcase/bg-slide-4.jpg': '/static/showcase/slide-999-km-purple-slide-4.jpg',
  '/static/showcase/bg-zombie-1.jpg': '/static/showcase/zombie-zones-desert-houses-1.jpg',
  '/static/showcase/bg-zombie-2.jpg': '/static/showcase/zombie-zones-desert-houses-2.jpg',
  '/static/showcase/grug.webp': '/static/showcase/grug-digital-avatar-grug.webp',
  '/static/showcase/ranger.webp': '/static/showcase/grug-digital-avatar-ranger.webp',
  '/static/showcase/skater.webp': '/static/showcase/grug-digital-avatar-skater.webp',
  '/static/showcase/medic.webp': '/static/showcase/grug-digital-avatar-medic.webp',
  '/static/showcase/snow-rider.webp': '/static/showcase/grug-digital-avatar-snow-rider.webp',
  '/static/showcase/racer.webp': '/static/showcase/grug-digital-avatar-racer.webp',
};

export async function onRequest(ctx) {
  const { request, next, env } = ctx;
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const url = new URL(request.url);
  const legacy = new URL((env && env.LEGACY_ORIGIN) || LEGACY_ORIGIN);
  const path = url.pathname;

  if (MOVED[path]) return Response.redirect(url.origin + MOVED[path] + url.search, 301);
  // the old home page
  if (path === '/legacy' || path === '/legacy/index.html') return fromLegacy(ctx, legacy, '/', url, null);
  // /legacy/<page> is just <page> (the old pages stay at their own addresses); /legacy/ is the old home page
  if (path.startsWith('/legacy/')) return Response.redirect(url.origin + (path === '/legacy/' ? '/legacy' : path.slice(7)) + url.search, 302);
  // installed apps (Grug, Daypart, Bubble Tea, Café) start at /?pwa=…: keep them on the old home page
  if ((path === '/' || path === '/index.html') && url.searchParams.has('pwa')) return fromLegacy(ctx, legacy, '/', url, null);

  // promo links get typed by hand: /Tizzy, /TIZZY/, /ITCH… all land on /tizzy/ or /itch/
  const promo = /^\/(tizzy|itch)\/?$/i.exec(path);
  if (promo && path !== '/' + promo[1].toLowerCase() + '/' && path !== '/' + promo[1].toLowerCase()) return Response.redirect(url.origin + '/' + promo[1].toLowerCase() + '/' + url.search, 302);

  const res = await next();
  if (res.status !== 404) return res;
  return fromLegacy(ctx, legacy, path, url, res);
}

async function fromLegacy(ctx, legacy, path, url, fallback) {
  const { request } = ctx;
  const target = new URL(path + url.search, legacy);
  let r;
  try {
    r = await fetch(target.href, { method: request.method, headers: request.headers, redirect: 'manual' });
  } catch (e) {
    return fallback || new Response('The legacy site could not be reached. Please try again in a moment.', { status: 502 });
  }
  const out = new Response(r.body, r);
  // branch deploys are marked noindex; the legacy pages lived on the main address and stay indexable as they were
  out.headers.delete('x-robots-tag');
  // keep redirects (Pages' pretty URLs: /offline.html → /offline) on the main address
  const loc = out.headers.get('location');
  if (loc) {
    try {
      const u = new URL(loc, target);
      if (u.origin === legacy.origin) out.headers.set('location', url.origin + u.pathname + u.search + u.hash);
    } catch (e) {}
  }
  const type = out.headers.get('content-type') || '';
  if (!/text\/html/i.test(type) || request.method === 'HEAD' || (out.status >= 300 && out.status < 400)) return out;
  return addBanner(out);
}

/* ---------- the banner on legacy pages ---------- */
// One inline script, drawn in a shadow root so the old pages' styles can't touch it and it can't touch them. It only
// shows on the outer page (games run in a frame), and × hides it for the rest of the visit (this tab).
const BANNER = `<script data-grug-legacy>(function(){
  var ss; try { ss = sessionStorage; } catch (e) {}
  function get(k) { try { return ss && ss.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { ss && ss.setItem(k, v); } catch (e) {} }
  if (window.top !== window.self) return;
  // the new home page sends anyone who taps an old Home button or logo back to /legacy: it needs the page they left
  function note() { set('grug.legacy.from', location.href.split('#')[0]); }
  note(); addEventListener('pagehide', note); addEventListener('beforeunload', note);
  if (get('grug.legacy.bar') === 'hidden') return;
  // the old site's own pages place their top bar below var(--sat) (the phone's notch): grow it by the banner's height so
  // the banner sits above their top bar instead of over it. Pages that don't use it get the banner on top, with ×.
  var H = 38;
  function offset(on) {
    var st = document.getElementById('grug-legacy-offset');
    if (!on) { if (st) st.remove(); return; }
    if (st || !document.head) return;
    st = document.createElement('style'); st.id = 'grug-legacy-offset';
    st.textContent = 'html:root{--sat:calc(env(safe-area-inset-top,0px) + ' + H + 'px)!important}';
    document.head.appendChild(st);
  }
  function draw() {
    if (document.getElementById('grug-legacy-bar') || !document.body) return;
    // Allo, the site's font: @font-face doesn't work inside the shadow root, so the page itself loads it
    if (!document.querySelector('link[href="/static/fonts/allo.css"]') && document.head) {
      var lf = document.createElement('link'); lf.rel = 'stylesheet'; lf.href = '/static/fonts/allo.css'; document.head.appendChild(lf);
    }
    var host = document.createElement('div');
    host.id = 'grug-legacy-bar';
    host.setAttribute('style', 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;display:block');
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>'
      + ':host{all:initial}'
      + '.bar{box-sizing:border-box;display:flex;align-items:center;gap:10px;height:calc(' + H + 'px + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) 6px 0 14px;'
      + 'background:#1E1B16;color:#F3F3F5;font:500 14px/1.2 Allo,system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 2px 0 #9BE338;-webkit-font-smoothing:antialiased}'
      + '.stripe{flex:none;width:14px;height:14px;border-radius:4px;background:repeating-linear-gradient(45deg,#1E1B16 0 3px,#9BE338 3px 6px);border:1px solid #9BE338}'
      + '.msg{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.short{display:none}'
      + 'a{flex:none;display:inline-flex;align-items:center;height:27px;padding:0 12px;border-radius:9px;background:#9BE338;color:#1E1B16;font:600 13px/1 Allo,system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 0 #6FB31C;white-space:nowrap}'
      + 'a:hover{filter:brightness(1.05)}a:focus-visible,button:focus-visible{outline:2px solid #fff;outline-offset:2px}'
      + 'button{flex:none;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:#A3A3AD;font:400 20px/1 Allo,system-ui,sans-serif;cursor:pointer;padding:0}'
      + 'button:hover{background:#2E2A24;color:#fff}'
      + '@media (max-width:600px){.long{display:none}.short{display:inline}.bar{font-size:13px;gap:8px;padding-left:10px}a{padding:0 10px}}'
      + '</style>'
      + '<div class="bar" role="region" aria-label="Legacy site notice"><span class="stripe" aria-hidden="true"></span>'
      + '<span class="msg"><span class="long">You\\u2019re using the legacy version of Grug. It\\u2019s no longer supported.</span>'
      + '<span class="short">Legacy version \\u00b7 no longer supported</span></span>'
      + '<a href="/"><span class="long">Go to the new site</span><span class="short">New site</span></a>'
      + '<button type="button" aria-label="Hide this notice" title="Hide">\\u00d7</button></div>';
    root.querySelector('a').addEventListener('click', function () { set('grug.legacy.leaving', '1'); });
    root.querySelector('button').addEventListener('click', function () { set('grug.legacy.bar', 'hidden'); offset(false); host.remove(); });
    document.body.appendChild(host);
  }
  offset(true);
  if (document.body) draw(); else document.addEventListener('DOMContentLoaded', function () { offset(true); draw(); });
})();</script>`;

function addBanner(res) {
  let done = false;
  const put = (el, how) => { if (done) return; done = true; el[how](BANNER, { html: true }); };
  return new HTMLRewriter()
    .on('head', { element(el) { put(el, 'append'); } })
    .on('body', { element(el) { put(el, 'prepend'); } })
    .onDocument({ end(end) { if (!done) { done = true; end.append(BANNER, { html: true }); } } })
    .transform(res);
}
