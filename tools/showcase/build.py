#!/usr/bin/env python3
"""Grug showcase: packs the site, every rewards app and its game into ONE html file for demos.

    python3 tools/showcase/build.py site [out.html]       the site itself, one-to-one, in one offline file (dist/grug-offline.html)
    python3 tools/showcase/build.py showcase [out.html]   the guided showcase around it (dist/grug-showcase.html)
    python3 tools/showcase/build.py site --extra DIR      also pack the rewards-app previews in DIR (offline copy only):
        every DIR/<Place name>/<slug>-rewards.html becomes local/<slug>/ and gets a card under the Games page list.
        They are kept out of this repo so they never appear on the live site.

Both keep everything in memory only: nothing is saved on the device, and reloading starts fresh.

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
ARGS = sys.argv[1:]
EXTRA = None
if '--extra' in ARGS: i = ARGS.index('--extra'); EXTRA = ARGS[i + 1]; del ARGS[i:i + 2]
MODE = ARGS[0] if ARGS and ARGS[0] in ('site', 'showcase') else 'showcase'
OUT = [a for a in ARGS if a not in ('site', 'showcase')]
OUT = OUT[0] if OUT else os.path.join(REPO, 'dist', 'grug-offline.html' if MODE == 'site' else 'grug-showcase.html')
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

for d, mx, fmt, q in [('assets/thumbs', 720, 'JPEG', 78), ('assets/boxart', 720, 'JPEG', 78), ('assets/clothing/thumbs', 240, 'WEBP', 82), ('assets/sandy', None, 'WEBP', 88),
                      ('community', 900, 'JPEG', 72), ('play/soluna/assets/photos', 900, 'JPEG', 74), ('work/alchemy', 900, 'JPEG', 74)]:
    for f in sorted(os.listdir(os.path.join(REPO, d))):
        if re.search(r'\.(jpe?g|png|webp)$', f, re.I): img(d + '/' + f, mx, fmt, q)
img('assets/backdrop.jpg', None, 'JPEG', 85)
if MODE == 'site':   # full clothing templates: the avatar editor dresses the 3D character with them
    for f in sorted(os.listdir(os.path.join(REPO, 'assets/clothing'))):
        if f.endswith('.png'): img('assets/clothing/' + f, None, 'WEBP', 92)
img('favicon.png', 128, 'WEBP', 90)
# (the picture prints in assets/prints/ were removed: the avatar has only its drawn shapes)

# ---------- shared scripts and styles (kept once, put back into each page in the browser) ----------
def font_data(css, base):
    def sub(m):
        p = os.path.normpath(os.path.join(base, m.group(1)))
        return "url(data:font/woff2;base64,%s)" % base64.b64encode(open(os.path.join(REPO, p), 'rb').read()).decode()
    return re.sub(r"url\(['\"]?([^'\")]+\.woff2)['\"]?\)", sub, css)

libs = {}
for f in ['catalog.js', 'icons.js', 'games.js', 'grug.js', 'grug-app.js', 'theme.js', 'chef.js', 'gamepage.js', 'demo.js', 'cursors.js']:
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
g = patch(g, "const d = url('assets/sandy/');\n    return { def: true, bust: d + 'bust.png', full: d + 'full.png', happy: d + 'happy.png', sad: d + 'sad.png', cheer: d + 'cheer.png' };",
          "const d = n => url('assets/sandy/' + n + '.png');   // showcase: each picture by its own path, so the packed copies are found\n    return { def: true, bust: d('bust'), full: d('full'), happy: d('happy'), sad: d('sad'), cheer: d('cheer') };")
# (the colourful icon pictures are gone from grug.js, so there is nothing to switch off here any more)
g = g.replace("'<div class=\"g-pref\"><span><b>Colorful icons</b>", "'<div class=\"g-pref\" hidden><span><b>Colorful icons</b>")
libs['grug.js'] = g
# (theme.js no longer loads an image backdrop: the faint pixel patterns replaced it, so there is nothing to patch there)
for k in libs:
    if '</script' in libs[k].lower(): raise SystemExit(k + ' contains </script')

# ---------- pages ----------
PAGES = [('index.html', 'home'), ('games/index.html', 'games'), ('shop/index.html', 'shop'), ('profile/index.html', 'profile'),
         ('pearls.html', 'pearls'), ('partners/index.html', 'partners'), ('privacy.html', 'privacy'), ('terms.html', 'terms'), ('support.html', 'support'),
         ('play/yoshi/index.html', 'app-yoshi'), ('play/teahouse/index.html', 'app-teahouse'), ('play/cielito/index.html', 'app-cielito'),
         ('play/soluna/index.html', 'app-soluna'), ('work/alchemy/site.html', 'app-alchemy')]
for gid in ['yoshi', 'teahouse', 'cielito', 'soluna', 'alchemy']: PAGES.append(('games/%s/index.html' % gid, 'game-' + gid))
if MODE == 'site': PAGES.append(('avatar/index.html', 'avatar'))

LIB_RE = re.compile(r'<script\s+src="(?:\.\./)*assets/([\w.-]+\.js)"\s*>\s*</script>', re.I)
CSS_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="(?:\.\./)*assets/([\w.-]+\.css)"\s*/?>', re.I)

def pack_page(path):
    s = rd(path); base = os.path.dirname(path)
    s = LIB_RE.sub(lambda m: '<!--LIB:%s-->' % m.group(1) if m.group(1) in libs else m.group(0), s)
    s = CSS_RE.sub(lambda m: '<!--LIB:%s-->' % m.group(1) if m.group(1) in libs else m.group(0), s)
    s = re.sub(r'<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>', '', s)
    # the 3D engine (avatar editor): one script URL made in the browser; sandy-view.js is inside it
    s = re.sub(r'<script\s+src="(?:\.\./)*assets/sandy-runtime\.js"\s*>\s*</script>', '<!--ENGINE-->', s)
    s = re.sub(r'<script\s+src="(?:\.\./)*assets/sandy-view\.js"\s*>\s*</script>', '', s)
    # games inside the apps run in their own frame: same memory storage, same 3D engine
    s = re.sub(r'(<script type="text/x-game" id="gameSource">.*?<head[^>]*>)', lambda m: m.group(1) +
        '<script>try{var __T=top;Object.defineProperty(window,"localStorage",{configurable:true,get:function(){return __T.__grugLS}});Object.defineProperty(window,"sessionStorage",{configurable:true,get:function(){return __T.__grugSS}})}catch(e){}<\\/script>', s, count=1, flags=re.S)
    s = s.replace("s.src = '../../assets/sandy-runtime.js'", "s.src = (top.__grugEngineURL || '../../assets/sandy-runtime.js')")
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

# ---------- rewards-app previews (offline copy only) ----------
previews = []
if EXTRA and MODE == 'site':
    for place in sorted(os.listdir(EXTRA)):
        d = os.path.join(EXTRA, place)
        if place.startswith('_') or not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('-rewards.html'): continue
            slug = re.sub(r'[^a-z0-9-]+', '-', f[:-len('-rewards.html')].lower()).strip('-')
            raw = open(os.path.join(d, f), encoding='utf-8').read()
            vpath = 'local/%s/' % slug
            tmp = os.path.join(REPO, vpath + 'index.html')   # pack_page reads from the repo; give it the file without keeping it
            os.makedirs(os.path.dirname(tmp), exist_ok=True); open(tmp, 'w', encoding='utf-8').write(raw)
            try: pages['local-' + slug] = {'path': vpath, 'html': pack_page(vpath + 'index.html')}
            finally: os.remove(tmp); os.rmdir(os.path.dirname(tmp)); os.path.isdir(os.path.join(REPO, 'local')) and not os.listdir(os.path.join(REPO, 'local')) and os.rmdir(os.path.join(REPO, 'local'))
            cfg = raw[raw.find('const CONFIG = {'):][:200000]
            col = re.search(r'"colors"\s*:\s*\{[^}]*?"brand"\s*:\s*"(#[0-9a-fA-F]{3,8})"', cfg)
            logo = re.search(r'"logoImage"\s*:\s*"data:image/[a-z+]+;base64,([A-Za-z0-9+/=]+)"', cfg)
            short = re.search(r'"short"\s*:\s*"([^"]+)"', cfg)
            lsrc = ''
            if logo:   # the app's own logo, shrunk for the card
                try:
                    im = Image.open(io.BytesIO(base64.b64decode(logo.group(1)))); im.load(); im.thumbnail((240, 240), Image.LANCZOS)
                    b = io.BytesIO(); im.save(b, 'WEBP', quality=88, method=6); lsrc = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
                except Exception: lsrc = ''
            previews.append({'slug': slug, 'name': place, 'short': short.group(1) if short else place, 'color': col.group(1) if col else '#5F5C37', 'logo': lsrc})
    if previews:   # cards under the live games, in the Games page's own tile style
        def tile(p):
            ini = ''.join(w[0] for w in re.findall(r'[A-Za-z0-9&]+', p['name'])[:2]).upper()
            face = ('<img src="%s" alt="" style="width:72%%;height:72%%;object-fit:contain">' % p['logo']) if p['logo'] else ini
            return ('<div class="g-tile"><a class="pic" href="../local/%s/" style="background:%s;display:grid;place-items:center;color:#fff;font:600 44px/1 var(--display)" aria-label="%s">%s'
                    '<span class="badge soon">Preview</span></a><div class="body"><div class="title">%s</div><div class="meta">Rewards app preview</div>'
                    '<div class="acts"><a class="g-btn primary sm" href="../local/%s/">Open the app</a></div></div></div>') % (p['slug'], p['color'], p['name'], face, p['name'], p['slug'])
        sec = ('<div class="gl-head" style="margin-top:26px"><h2>Rewards app previews</h2><p>Working rewards apps built for more Katy spots. '
               'These are only in this offline copy.</p></div><div class="gl" id="previews">' + ''.join(tile(p) for p in previews) + '</div>')
        gh = pages['games']['html']
        if '<div class="gl" id="list"></div>' not in gh: raise SystemExit('games page anchor missing')
        pages['games']['html'] = gh.replace('<div class="gl" id="list"></div>', '<div class="gl" id="list"></div>' + sec, 1)

# ---------- app facts for the restaurant cards ----------
games_js = libs['games.js']
games = json.loads(os.popen("node -e 'global.window={};eval(require(\"fs\").readFileSync(process.argv[1],\"utf8\"));console.log(JSON.stringify(window.GRUG_GAMES))' " + os.path.join(REPO, 'assets/games.js')).read())
facts = json.load(open(os.path.join(HERE, 'appdata.json')))
presets = json.load(open(os.path.join(HERE, 'presets.json')))
for p in presets:   # pictures as webp (much smaller than the rendered png)
    for k, v in p['snaps'].items():
        im = Image.open(io.BytesIO(base64.b64decode(v.split(',', 1)[1]))); b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6)
        p['snaps'][k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

# (the icon pack of prints was removed, so the 3D editor gets none)
PACK_PRINTS = []
for pid in PACK_PRINTS:
    if os.path.exists(os.path.join(REPO, 'assets/prints/pack/%s.webp' % pid)): img('assets/prints/pack/%s.webp' % pid, 192, 'WEBP', 90)
pack_prints = [p for p in PACK_PRINTS if 'assets/prints/pack/%s.webp' % p in assets]

# the 3D avatar engine: its own block, unpacked only when the Avatar tab opens
rt = rd('assets/sandy-runtime.js')
rt = re.sub(r"function decalUrl\(img\)\{.*?\n", "function decalUrl(img){const A=window.__GRUG_ASSETS||{};let m=/^print:([a-z0-9-]{1,32})$/.exec(img);if(m)return A['assets/prints/'+m[1]+'.png']||SR_BASE+'prints/'+m[1]+'.png';m=/^pack:([a-z0-9-]{1,48})$/.exec(img);if(m)return A['assets/prints/pack/'+m[1]+'.webp']||SR_BASE+'prints/pack/'+m[1]+'.webp';return img}\n", rt, count=1, flags=re.S)
if "window.__GRUG_ASSETS" not in rt: raise SystemExit('runtime decal patch failed')
rt = patch(rt, "function src(t) { return /^shop:/.test(t) ? ASSETS + 'clothing/' + t.slice(5).replace(/[^\\w-]/g, '') + '.png' : t; }",
           "function src(t) { if (!/^shop:/.test(t)) return t; const id = t.slice(5).replace(/[^\\w-]/g, ''); return (window.__GRUG_ASSETS && window.__GRUG_ASSETS['assets/clothing/' + id + '.png']) || ASSETS + 'clothing/' + id + '.png'; }")
engine = base64.b64encode(gzip.compress((rt + '\n;\n' + rd('assets/sandy-view.js')).encode(), 9)).decode()

payload = {'libs': libs, 'pages': pages, 'assets': assets, 'presets': presets}
raw = json.dumps(payload, separators=(',', ':')).encode()
packed = base64.b64encode(gzip.compress(raw, 9)).decode()

shell = open(os.path.join(HERE, 'site.html' if MODE == 'site' else 'shell.html'), encoding='utf-8').read()
shell = shell.replace('/*@LOADER@*/', open(os.path.join(HERE, 'loader.js'), encoding='utf-8').read())
meta = {'games': games, 'facts': facts, 'logo': re.search(r"const LOGO = '(<svg.*?</svg>)'", libs['grug.js'], re.S).group(1),
        'icons': json.loads(re.search(r'window\.GRUG_ICONS_SIMPLE = (\{.*?\});', libs['icons.js'], re.S).group(1)),
        'thumbs': {g['id']: assets.get(g['thumb'], '') for g in games}, 'presets': [{'id': p['id'], 'label': p['label'], 'bust': p['snaps']['bust'], 'full': p['snaps']['full']} for p in presets]}
fonts = '\n'.join(m.group(0) for m in re.finditer(r'@font-face\s*\{[^}]*\}', libs['grug.css']))
meta['packPrints'] = pack_prints
shell = shell.replace('@ENGINE@', engine).replace('/*@FONTS@*/', fonts).replace('@LOGO@', meta['logo']).replace('@FAVICON@', assets.get('favicon.png', '')).replace('"@META@"', json.dumps(meta, separators=(',', ':')).replace('</', '<\\/')).replace('@PACK@', packed)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(shell)
print('previews: %d' % len(previews)) if previews else None
print('pages %d, images %d, raw %.1f MB, packed %.1f MB, 3D engine %.1f MB -> %s (%.1f MB)' % (len(pages), len(assets), len(raw) / 1e6, len(packed) / 1e6, len(engine) / 1e6, OUT, os.path.getsize(OUT) / 1e6))
