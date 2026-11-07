#!/usr/bin/env python3
"""Grug showcase: packs the site, every rewards app and its game into ONE html file for demos.

    python3 tools/showcase/build.py [out.html]

What goes in
  - site pages (home, games, game pages, shop, profile, Pearls, partners, terms/privacy/support)
  - the rewards apps in play/ and the Alchemy preview (each already carries its game inside)
  - shared scripts/styles once (grug.js, icons.js, ...), images as data URLs (resized)
  - six ready-made avatar looks (tools/showcase/presets.json; pictures only, no 3D engine)
Everything is gzip-compressed into one base64 block; shell.html unpacks it in the browser and writes
each page into a frame (so it keeps its own address, hash routing and storage, all offline).

Showcase-only changes made to the packed copies (the live site is untouched):
  grug.js        links point at https://grug.local/ (caught by the shell), asset paths read the packed images,
                 colourful icons off (their pictures aren't packed)
  theme.js       backdrop from the packed images
  every page     `location.href =` / `location.replace(` go through the shell
  pearls.html    the Stripe checkout is never opened: the shell fakes a paid return instead
"""
import base64, gzip, io, json, os, re, sys
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'dist', 'grug-showcase.html')
rd = lambda p: open(os.path.join(REPO, p), encoding='utf-8').read()

# ---------- images: path (from the site root) -> data URL ----------
assets = {}
def img(path, max_px=None, fmt='WEBP', q=80):
    full = os.path.join(REPO, path)
    if not os.path.exists(full): return
    im = Image.open(full); im.load()
    if max_px and max(im.size) > max_px: im.thumbnail((max_px, max_px), Image.LANCZOS)
    b = io.BytesIO()
    if fmt == 'JPEG': im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True); mime = 'image/jpeg'
    else: im.save(b, 'WEBP', quality=q, method=6); mime = 'image/webp'
    assets[path] = 'data:%s;base64,%s' % (mime, base64.b64encode(b.getvalue()).decode())

for d, mx, fmt, q in [('assets/thumbs', 720, 'JPEG', 78), ('assets/clothing/thumbs', 240, 'WEBP', 82), ('assets/sandy', None, 'WEBP', 88),
                      ('community', 900, 'JPEG', 72), ('play/soluna/assets/photos', 900, 'JPEG', 74), ('work/alchemy', 900, 'JPEG', 74)]:
    for f in sorted(os.listdir(os.path.join(REPO, d))):
        if re.search(r'\.(jpe?g|png|webp)$', f, re.I): img(d + '/' + f, mx, fmt, q)
img('assets/backdrop.jpg', None, 'JPEG', 85)
img('favicon.png', 128, 'WEBP', 90)
for f in os.listdir(os.path.join(REPO, 'assets/prints')):
    if f.endswith('.png'): img('assets/prints/' + f, 192, 'WEBP', 88)

# ---------- shared scripts and styles (kept once, put back into each page in the browser) ----------
def font_data(css, base):
    def sub(m):
        p = os.path.normpath(os.path.join(base, m.group(1)))
        return "url(data:font/woff2;base64,%s)" % base64.b64encode(open(os.path.join(REPO, p), 'rb').read()).decode()
    return re.sub(r"url\(['\"]?([^'\")]+\.woff2)['\"]?\)", sub, css)

libs = {}
for f in ['catalog.js', 'icons.js', 'games.js', 'grug.js', 'grug-app.js', 'theme.js', 'chef.js', 'gamepage.js']:
    libs[f] = rd('assets/' + f)
for f in ['grug.css', 'grug-app.css', 'gamepage.css']:
    libs[f] = font_data(rd('assets/' + f), 'assets')

def patch(src, old, new, count=1):
    n = src.count(old)
    if n < 1: raise SystemExit('showcase patch failed, not found: ' + old[:80])
    return src.replace(old, new) if count is None else src.replace(old, new, count)

g = libs['grug.js']
g = re.sub(r"const ROOT = [^\n]*;", "const ROOT = 'https://grug.local/';   // showcase: the shell catches links to this host", g, count=1)
g = patch(g, "const url = p => ROOT + String(p || '').replace(/^\\/+/, '');",
          "const url = p => { const k = String(p || '').replace(/^\\/+/, ''); return (root.GRUG_ASSETS && root.GRUG_ASSETS[k.split(/[?#]/)[0]]) || ROOT + k; };")
g = patch(g, "const colorful = () => !!(profile && profile.prefs && profile.prefs.colorIcons);", "const colorful = () => false;   // showcase: colourful icon pictures aren't packed")
g = g.replace("'<div class=\"g-pref\"><span><b>Colorful icons</b>", "'<div class=\"g-pref\" hidden><span><b>Colorful icons</b>")
libs['grug.js'] = g
libs['theme.js'] = patch(libs['theme.js'], "img.src = me ? me.src.replace(/theme\\.js.*$/, 'backdrop.jpg') : 'assets/backdrop.jpg';",
                         "img.src = (window.GRUG_ASSETS && window.GRUG_ASSETS['assets/backdrop.jpg']) || 'assets/backdrop.jpg';")
for k in libs:
    if '</script' in libs[k].lower(): raise SystemExit(k + ' contains </script')

# ---------- pages ----------
PAGES = [('index.html', 'home'), ('games/index.html', 'games'), ('shop/index.html', 'shop'), ('profile/index.html', 'profile'),
         ('pearls.html', 'pearls'), ('partners/index.html', 'partners'), ('privacy.html', 'privacy'), ('terms.html', 'terms'), ('support.html', 'support'),
         ('play/yoshi/index.html', 'app-yoshi'), ('play/teahouse/index.html', 'app-teahouse'), ('play/cielito/index.html', 'app-cielito'),
         ('play/soluna/index.html', 'app-soluna'), ('work/alchemy/site.html', 'app-alchemy')]
for gid in ['yoshi', 'teahouse', 'cielito', 'soluna', 'alchemy']: PAGES.append(('games/%s/index.html' % gid, 'game-' + gid))

LIB_RE = re.compile(r'<script\s+src="(?:\.\./)*assets/([\w.-]+\.js)"\s*>\s*</script>', re.I)
CSS_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="(?:\.\./)*assets/([\w.-]+\.css)"\s*/?>', re.I)

def pack_page(path):
    s = rd(path); base = os.path.dirname(path)
    s = LIB_RE.sub(lambda m: '<!--LIB:%s-->' % m.group(1) if m.group(1) in libs else m.group(0), s)
    s = CSS_RE.sub(lambda m: '<!--LIB:%s-->' % m.group(1) if m.group(1) in libs else m.group(0), s)
    s = re.sub(r'<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>', '', s)
    # images referenced by a path in the page (attributes and JS strings): packed copy, if there is one
    def asset(m):
        p = os.path.normpath(os.path.join(base, m.group(2))).replace('\\', '/')
        return m.group(1) + assets[p] if p in assets else m.group(0)
    s = re.sub(r'''(["'(])((?:\.\./)*(?:assets|community)/[\w./-]+\.(?:jpe?g|png|webp))''', asset, s)
    # showcase hooks inside the app's own scope (its code is wrapped, so the shell can't reach it otherwise)
    if 'function tapCheck(id)' in s:
        s = re.sub(r'(\n)(function tapCheck\(id\)\{[^\n]*\n)', lambda m: m.group(1) + m.group(2) +
            "window.__grugTap = () => STORES[0] ? '?tap=' + STORES[0].id + '-' + tapCheck(STORES[0].id) : '';\n"
            "window.__grugStore = () => STORES[0] ? STORES[0].id : '';\n"
            "window.__grugAddPts = n => { try{ st.points = (+st.points || 0) + n; save(); return true; }catch(e){ return false; } };\n", s, count=1)
    if path == 'pearls.html':
        s = re.sub(r'(const PACKS = \[.*?\n\];\n)', lambda m: m.group(1) + 'window.__grugPacks = PACKS;\n', s, count=1, flags=re.S)
        if '__grugPacks' not in s: raise SystemExit('pearls hook failed')
    # page changes made from code go through the shell
    s = re.sub(r'\blocation\.href\s*=(?!=)', '__grugLoc.href =', s)
    s = re.sub(r'(?<![\w.])location\.replace\(', '__grugLoc.replace(', s)
    s = re.sub(r'(?<![\w.])location\.assign\(', '__grugLoc.assign(', s)
    return s

pages = {}
for path, key in PAGES:
    vpath = re.sub(r'index\.html$', '', path)
    pages[key] = {'path': vpath, 'html': pack_page(path)}

# ---------- app facts for the restaurant cards ----------
games_js = libs['games.js']
games = json.loads(os.popen("node -e 'global.window={};eval(require(\"fs\").readFileSync(process.argv[1],\"utf8\"));console.log(JSON.stringify(window.GRUG_GAMES))' " + os.path.join(REPO, 'assets/games.js')).read())
facts = json.load(open(os.path.join(HERE, 'appdata.json')))
presets = json.load(open(os.path.join(HERE, 'presets.json')))
for p in presets:   # pictures as webp (much smaller than the rendered png)
    for k, v in p['snaps'].items():
        im = Image.open(io.BytesIO(base64.b64decode(v.split(',', 1)[1]))); b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6)
        p['snaps'][k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

payload = {'libs': libs, 'pages': pages, 'assets': assets, 'presets': presets}
raw = json.dumps(payload, separators=(',', ':')).encode()
packed = base64.b64encode(gzip.compress(raw, 9)).decode()

shell = open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
meta = {'games': games, 'facts': facts, 'logo': re.search(r"const LOGO = '(<svg.*?</svg>)'", libs['grug.js'], re.S).group(1),
        'icons': json.loads(re.search(r'window\.GRUG_ICONS_SIMPLE = (\{.*?\});', libs['icons.js'], re.S).group(1)),
        'thumbs': {g['id']: assets.get(g['thumb'], '') for g in games}, 'presets': [{'id': p['id'], 'label': p['label'], 'bust': p['snaps']['bust'], 'full': p['snaps']['full']} for p in presets]}
fonts = '\n'.join(m.group(0) for m in re.finditer(r'@font-face\s*\{[^}]*\}', libs['grug.css']))
shell = shell.replace('/*@FONTS@*/', fonts).replace('"@META@"', json.dumps(meta, separators=(',', ':')).replace('</', '<\\/')).replace('@PACK@', packed)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(shell)
print('pages %d, images %d, raw %.1f MB, packed %.1f MB -> %s (%.1f MB)' % (len(pages), len(assets), len(raw) / 1e6, len(packed) / 1e6, OUT, os.path.getsize(OUT) / 1e6))
