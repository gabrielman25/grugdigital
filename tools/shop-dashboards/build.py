#!/usr/bin/env python3
"""Build the shop dashboards (Bubble Tea and Café). Run from anywhere:

    python3 tools/shop-dashboards/build.py              # writes business/tea/index.html and business/cafe/index.html
    python3 tools/shop-dashboards/build.py tea          # just one
    python3 tools/shop-dashboards/build.py --extras     # also the copies for use outside grugdigital.com (dist/, not committed)

On the site (business/<folder>/index.html) each dashboard is installed and kept up to date by the site's shared app
system: it loads ../../app/app.js, which gives it its manifest (app/<id>.webmanifest), the Download card and the site's
service worker (sw.js, packs in app/offline.json). After building, run python3 tools/pwa/build.py like any site change.

--extras also writes, into tools/shop-dashboards/dist/ (gitignored):
  dist/standalone/<file>.html       one self-contained page (open it straight from disk to try it)
  dist/pwa/<folder>/                 the same app with its own manifest, service worker, icons and offline page, for any
                                     other web host

Everything a type needs lives in src/types/<id>.js (config + starter data), src/types/<id>.mods.js (its own
modules) and src/types/<id>.css (its own styles). Shared code is src/core.js, src/ui.js, src/modules.js, src/app.css.
"""
import hashlib, json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(ROOT, '..', '..'))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')

# id, folder on the site, standalone file name, app name, short name, theme colour, background
TYPES = {
    'tea':  dict(folder='tea',  file='tea-boba-dashboard.html', name='Daypart Bubble Tea', short='Bubble Tea', theme='#C59BFF', bg='#F7F4FA', icon='boba'),
    'cafe': dict(folder='cafe', file='cafe-dashboard.html',     name='Daypart Café', short='Café',      theme='#E9B872', bg='#F6F1EA', icon='coffee'),
}

def read(*p):
    with open(os.path.join(SRC, *p), encoding='utf-8') as f:
        return f.read()

ICON_SVG = {
    'boba': '<path d="M5 7h14l-1.6 13.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8z"/><path d="M4 7h16M13 7l2-5"/><circle cx="9.5" cy="17" r=".9"/><circle cx="12.5" cy="18" r=".9"/><circle cx="14.6" cy="15.8" r=".9"/>',
    'coffee': '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3"/>',
}

def icon_svg(t, size=512, pad=0.0, round_=True):
    """App icon: the type's mark in off-black on its accent colour (the site's flat style)."""
    c = TYPES[t]
    r = size * 0.22 if round_ else 0
    inner = size * (1 - 2 * pad)
    s = inner / 24 * 0.62
    off = (size - 24 * s) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}" rx="{r}" fill="{c["theme"]}"/>'
            f'<g transform="translate({off} {off}) scale({s})" fill="none" stroke="#1E1B16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICON_SVG[c["icon"]]}</g></svg>')

def site_read(*p):
    with open(os.path.join(SITE, *p), encoding='utf-8') as f:
        return f.read()

def page(t, pwa):
    c = TYPES[t]
    css = read('vendor', 'fredoka.css') + '\n' + read('app.css') + '\n' + read('types', t + '.css')
    fav = 'data:image/svg+xml,' + icon_svg(t, 64).replace('#', '%23').replace('"', "'")
    head_pwa = ''
    if pwa is True:
        head_pwa = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
                    '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
                    f'<meta name="apple-mobile-web-app-title" content="{c["short"]}">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">')
    scripts = [read('config.js'), site_read('assets', 'qrcode.js'), read('core.js'), read('types', t + '.js'), read('ui.js'), read('modules.js'), read('types', t + '.mods.js')]
    body = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="{c["theme"]}">
<meta name="color-scheme" content="light">
<meta name="description" content="{c["name"]} by Grug Digital: scheduling, time clock, checklists, timers, stock and logs for your shop. No account; data stays on your device.">
<title>{c["name"]} · Grug Digital</title>
<link rel="icon" href="{fav}">
{head_pwa}
<style>{css}</style>
</head>
<body>
<div id="app">
  <div class="mainc">
    <header class="top">
      <button class="homebtn" id="homebtn" data-go="home" hidden></button>
      <span class="brandtop" id="brandtop"><span class="logo" id="brandlogo"></span><b id="shopname"></b></span>
      <h1 id="pagetitle"></h1><span class="sp"></span>
      <button class="chip bad" id="alarmchip" data-act="alarmGo" hidden></button>
      <button class="chip warn" id="soundchip" data-act="soundOn" hidden></button>
      <span class="chip" id="offchip" hidden>No internet · still works</span>
      <button class="chip" id="installchip" data-act="install" hidden></button>
      {'<button class="chip dl" title="Download the app" aria-label="Download the app" data-get-app="' + t + '" hidden><span data-app-ic></span><span class="lbl">Download</span></button>' if pwa == 'site' else ''}
      <span class="clock" id="clock"></span>
      <span id="contactslot"></span>
      <button class="chip who" id="whochip" data-act="who" aria-label="Who's using this?"></button>
      <button class="ib helpbtn" id="helpbtn" data-act="help" title="Help"></button>
    </header>
    <main id="view"></main>
    <footer class="foot noprint"><a id="playfoot" class="playlink" target="_blank" rel="noopener" hidden></a><span>Need help? <a href="#" data-grug-contact>Contact us</a> · Everything is saved on this device · <a href="#/settings">Save a backup</a></span></footer>
  </div>
  <nav class="tabbar" id="tabbar" aria-label="Quick links"></nav>
</div>
<div id="toast" role="status" aria-live="polite"></div>
<input type="file" id="imp" accept=".json,application/json" hidden>
<script>window.SHOP_PWA = {"'site'" if pwa == 'site' else ('true' if pwa else 'false')};</script>
''' + ('<script id="grug-app-js" src="../../app/app.js"></script>\n<script src="../../assets/rewards.js"></script>\n<script src="../../assets/business.js"></script>\n<script src="../../assets/contact.js"></script>\n' if pwa == 'site' else '<script>\n' + site_read('assets', 'contact.js') + '\n</script>\n') + ''.join(f'<script>\n{s}\n</script>\n' for s in scripts) + '<script>App.start();</script>\n</body>\n</html>\n'
    return body

OFFLINE = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · {name}</title><style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:{bg};font:16px/1.5 system-ui,sans-serif;color:#1E1B16;padding:1.5rem;text-align:center}}
.c{{max-width:26rem;background:#fff;border-radius:1rem;padding:1.6rem;box-shadow:0 .5rem 1.4rem rgba(30,27,22,.11)}}h1{{font-size:1.4rem;margin:.6rem 0}}
button{{font:inherit;font-weight:700;border:0;border-radius:.55rem;background:{theme};padding:.8rem 1.3rem;margin-top:1rem;cursor:pointer}}</style></head>
<body><div class="c">{icon}<h1>You're offline</h1><p>The dashboard couldn't load because this device has no internet and the app hasn't been saved for offline use yet.
Once it has loaded once with a connection, it works offline. Your saved data is safe on this device.</p><button onclick="location.href='./'">Try again</button></div></body></html>'''

SW = '''/* Service worker for the {name}. Caches the app shell so it opens offline.
   VERSION changes whenever index.html changes, which makes the page offer "A new version is ready". */
const VERSION = '{prefix}{hash}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './offline.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {{
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('{prefix}') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('message', e => {{ if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); }});
self.addEventListener('fetch', e => {{
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {{
    /* the app: network first (so updates arrive), fall back to the cached copy, then the offline page */
    e.respondWith(fetch(req).then(r => {{ if (r.ok) {{ const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }} return r; }})
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html'))));
    return;
  }}
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {{ if (r.ok && url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) {{ const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }} return r; }})));
}});
'''

def render_png(svgs):
    """svg strings -> png files, using headless Chrome via Playwright (already used for testing)."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page()
        for path, svg, size in svgs:
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            pg.locator('svg').screenshot(path=path, omit_background=True)
        b.close()

def build_site(t):
    c = TYPES[t]
    out = os.path.join(SITE, 'business', c['folder'])
    os.makedirs(out, exist_ok=True)
    html = page(t, 'site')
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'built {t}: business/{c["folder"]}/index.html ({len(html)//1024} KB)')

def build(t):
    c = TYPES[t]
    os.makedirs(os.path.join(DIST, 'standalone'), exist_ok=True)
    with open(os.path.join(DIST, 'standalone', c['file']), 'w', encoding='utf-8') as f:
        f.write(page(t, False))
    out = os.path.join(DIST, 'pwa', c['folder'])
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    html = page(t, True)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    manifest = {
        'name': c['name'], 'short_name': c['short'], 'id': './', 'start_url': './', 'scope': './',
        'display': 'standalone', 'background_color': c['bg'], 'theme_color': c['theme'], 'orientation': 'any',
        'description': 'Schedule, time clock, checklists, timers, stock and logs for your shop. No account; data stays on this device.',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
                  {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
                  {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
    }
    with open(os.path.join(out, 'manifest.webmanifest'), 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    h = hashlib.sha256(html.encode()).hexdigest()[:10]
    with open(os.path.join(out, 'sw.js'), 'w') as f:
        f.write(SW.format(name=c['name'], prefix='grug-' + t + '-shell-', hash=h))
    with open(os.path.join(out, 'offline.html'), 'w') as f:
        f.write(OFFLINE.format(name=c['name'], bg=c['bg'], theme=c['theme'], icon=icon_svg(t, 96)))
    render_png([(os.path.join(out, 'icon-192.png'), icon_svg(t, 192), 192), (os.path.join(out, 'icon-512.png'), icon_svg(t, 512), 512),
                (os.path.join(out, 'icon-maskable-512.png'), icon_svg(t, 512, pad=0.12, round_=False), 512), (os.path.join(out, 'apple-touch-icon.png'), icon_svg(t, 180, round_=False), 180)])
    print(f'built {t}: standalone {len(html)//1024} KB, pwa folder dist/pwa/{c["folder"]}/ (shell {h})')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for t in (args or TYPES):
        build_site(t)
        if '--extras' in sys.argv:
            build(t)
