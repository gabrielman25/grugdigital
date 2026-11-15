#!/usr/bin/env python3
"""Grug · the offline list for the two installable apps (app/offline.json).

Run from the repo root after ANY change to the site:   python3 tools/pwa/build.py
(`--check` exits 1 if app/offline.json is out of date, without writing it.)

The service worker (sw.js) reads app/offline.json to know what to keep on the device:

  packs   one pack per thing that can be downloaded: `grug` (the games side's pages and shared files),
          one `game:<id>` per Grug original, `carts` (the Carts feed and every cart) and `daypart`
          (the restaurant side: dashboard, website editor, rewards card, owners' link).
          Each pack lists its files as { "/path": "<fingerprint>" } (first 10 hex of the file's SHA-1).
  apps    which packs each installed app keeps: Grug = grug + carts + every game the player may see,
          Daypart = daypart.
  v       one fingerprint for the whole list: when it changes, something on the site changed.

When the app opens (and every few hours while it stays open) the service worker fetches this file, compares each
fingerprint with the copy it keeps, and downloads only what is new or changed. A new Grug original in assets/games.js
becomes a new pack, so installed apps download it by themselves and say "New game ready to play offline".

How a pack's files are found: its pages (the `entries`), then every path written in those pages and in the scripts,
styles and data they load (followed all the way down). A path is kept only if the file exists. Paths built in code
from pieces ('assets/avatar/skins/' + name + '.png') are caught when the folder ('assets/avatar/skins/') is written
out: the whole folder is kept (small folders only). Anything still missed is saved the first time it loads online.
Add a file by hand to EXTRA if a game needs one this can't see.
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'app', 'offline.json')

# Pages that belong to each side. Paths are from the site root; a folder means its index.html.
GRUG_PAGES = [
    '', '404.html', 'games/', 'games/favorites/', 'games/welcome/', 'me/', 'me/cards/', 'avatar/', 'avatar/classic/',
    'profile/', 'shop/', 'make/', 'links/', 'links/create/', 'links/page/', 'rewards/', 'rewards/create/', 'rewards/card/',
    'create/', 'create/modelkit/', 'pearls.html', 'credits.html', 'privacy.html', 'terms.html', 'support.html',
]
DAYPART_PAGES = [
    'business/', 'business/site/', 'rewards/', 'rewards/create/', 'restaurant/', 'site/',
    'privacy.html', 'terms.html', 'support.html', 'credits.html',
]
# Both apps: the app's own files (the offline page, its script, the manifests and icons).
APP_FILES = ['offline.html', 'app/app.js', 'app/grug.webmanifest', 'app/daypart.webmanifest', 'favicon.png',
             'app/icons/grug-192.png', 'app/icons/daypart-192.png', 'app/icons/grug-180.png', 'app/icons/daypart-180.png']
# Files a pack needs that no page names in a way the scan can see. { pack id: [paths] }
EXTRA = {}
# Folders loaded by a script that builds the file names in code: when the script is in a pack, so is the folder.
COMPANIONS = {
    'assets/fossil32/fossil32.js': ['assets/fossil32/fonts/'],   # the box-title fonts (FontFace(`url(${base}fonts/…)`))
}
# What a pack never keeps, even when a shared script names it (shared scripts mention every game's art).
# Anything left out still works online, and is saved for next time the first time it loads.
EXCLUDE = {
    # the games side: the demonstrations' apps live under play/ (the Grug originals come in their own packs)
    'grug': ['play/', 'assets/oembed/', 'community/'],
    # a game keeps its own play/<dir>/ only; carts keep nothing from play/
    'game': ['play/', 'assets/oembed/', 'community/'],
    'carts': ['play/', 'assets/oembed/', 'community/'],
    # the restaurant side: nothing from the games side
    'daypart': ['play/', 'games/', 'avatar/', 'create/', 'shop/', 'assets/boxart/', 'assets/fossil32/', 'assets/thumbs/',
                'assets/carts/', 'assets/clothing/', 'assets/avatar/', 'assets/oembed/', 'assets/sandy-classic.js',
                'assets/sandy-runtime.js', 'assets/sandy-classic', 'assets/patterns/', 'community/'],
}

# Never kept offline: tools, the demonstrations made for named businesses, the showcase build.
SKIP_DIRS = ('.git/', 'tools/', 'work/', 'showcase/', 'node_modules/', 'grug-game-kit/')
# Folders too broad to keep whole when a path ends at them.
NO_WHOLE_DIR = {'', 'assets', 'play', 'games', 'business', 'create', 'avatar', 'rewards', 'links', 'me', 'app',
                'assets/fonts', 'assets/boxart', 'assets/thumbs', 'assets/clothing'}
WHOLE_DIR_MAX_FILES, WHOLE_DIR_MAX_BYTES = 80, 4 * 1024 * 1024

SCAN_EXT = {'.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg'}
ASSET_EXT = ('js|mjs|css|json|webmanifest|png|jpe?g|webp|gif|svg|ico|avif|glb|gltf|bin|fbx|obj|mtl|ktx2|hdr|'
             'mp3|ogg|wav|m4a|mp4|webm|woff2?|ttf|otf|txt|wasm|csv')
TOKEN = re.compile(r'''(?:["'`(=,]|^)\s*((?:\.{1,2}/|/)?[A-Za-z0-9_@~%.\-][A-Za-z0-9_@~%./\-]*?\.(?:''' + ASSET_EXT +
                   r'''))(?:[?#][^"'`)\s]*)?(?=\s*["'`),]|\s|$)''', re.I | re.M)
DIR_TOKEN = re.compile(r'''["'`]((?:\.{1,2}/)*[A-Za-z0-9_\-][A-Za-z0-9_./\-]*/)["'`]''')


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, '/')


def page_file(p):
    return p + 'index.html' if p == '' or p.endswith('/') else p


# Never in a pack: the list itself and the service worker (the browser fetches that one itself).
NEVER = {'app/offline.json', 'sw.js'}


def ok_file(r):
    return (r and r not in NEVER and not r.startswith('..') and not any(r.startswith(d) for d in SKIP_DIRS)
            and os.path.isfile(os.path.join(ROOT, r)))


def resolve(tok, from_dirs):
    """Every existing site file a path written in the code could mean."""
    if tok.startswith(('http:', 'https:', 'data:', '//', 'blob:')):
        return set()
    tok = tok.split('?')[0].split('#')[0]
    if tok.startswith('/'):
        cands = [tok.lstrip('/')]
    else:
        cands = [os.path.normpath(os.path.join(d, tok)).replace(os.sep, '/') for d in from_dirs]
        stripped = re.sub(r'^(?:\.\.?/)+', '', tok)
        cands.append(stripped)                      # written for a page at another depth
    return {c for c in cands if ok_file(c)}


def resolve_dir(tok, from_dirs):
    out = set()
    stripped = re.sub(r'^(?:\.\.?/)+', '', tok)
    for c in [os.path.normpath(os.path.join(d, tok)).replace(os.sep, '/') for d in from_dirs] + [stripped.rstrip('/')]:
        c = c.rstrip('/')
        full = os.path.join(ROOT, c)
        if c in NO_WHOLE_DIR or c.startswith('..') or any((c + '/').startswith(d) for d in SKIP_DIRS):
            continue
        if not os.path.isdir(full):
            continue
        files = [f for f in os.listdir(full) if os.path.isfile(os.path.join(full, f))]
        size = sum(os.path.getsize(os.path.join(full, f)) for f in files)
        if 0 < len(files) <= WHOLE_DIR_MAX_FILES and size <= WHOLE_DIR_MAX_BYTES:
            out |= {(c + '/' + f) for f in files if re.search(r'\.(%s)$' % ASSET_EXT, f, re.I)}
    return out


def closure(pages, exclude=(), allow=()):
    """Pages plus everything they load, followed through scripts, styles and data files."""
    entries = [page_file(p) for p in pages]
    page_dirs = sorted({os.path.dirname(e) for e in entries})
    seen, queue = set(), [e for e in entries if ok_file(e)]
    while queue:
        f = queue.pop()
        if f in seen or (f not in entries and f.startswith(tuple(exclude)) and not f.startswith(tuple(allow))):
            continue
        seen.add(f)
        for d in COMPANIONS.get(f, []):
            for dp, _, fs in os.walk(os.path.join(ROOT, d)):
                queue += [rel(os.path.join(dp, x)) for x in fs]
        ext = os.path.splitext(f)[1].lower()
        if ext not in SCAN_EXT:
            continue
        try:
            text = open(os.path.join(ROOT, f), encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        if len(text) > 6_000_000:                   # huge bundles: paths only in the first and last parts
            text = text[:1_500_000] + text[-1_500_000:]
        dirs = [os.path.dirname(f)] + page_dirs + ['']
        found = set()
        for m in TOKEN.finditer(text):
            found |= resolve(m.group(1), dirs)
        for m in DIR_TOKEN.finditer(text):
            found |= resolve_dir(m.group(1), dirs)
        for r in found:
            # Pages are only kept when a pack lists them; a link to another page is not a download.
            if r.endswith('.html') and r not in entries:
                continue
            if r not in seen:
                queue.append(r)
    return seen


def fingerprint(r):
    h = hashlib.sha1()
    with open(os.path.join(ROOT, r), 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()[:10]


def url_of(r):
    return '/' + (r[:-len('index.html')] if r.endswith('index.html') else r)


def read_list(js_file, var):
    code = ("global.window=global;require(process.argv[1]);const v=window[process.argv[2]];"
            "process.stdout.write(JSON.stringify(v||[]))")
    out = subprocess.run(['node', '-e', code, os.path.join(ROOT, js_file), var], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def build():
    games = read_list('assets/games.js', 'GRUG_GAMES')
    originals = [g for g in games if g.get('original') and g.get('listed') is not False]

    packs = {}

    def add(pid, title, pages, extra=(), allow=(), **meta):
        excl = EXCLUDE.get(pid, EXCLUDE['game'] if pid.startswith('game:') else ())
        files = closure(pages, excl, allow) | {e for e in extra if ok_file(e)} | {e for e in EXTRA.get(pid, []) if ok_file(e)}
        packs[pid] = dict(title=title, **meta, files={url_of(r): fingerprint(r) for r in sorted(files)})

    add('grug', 'Grug', GRUG_PAGES, APP_FILES)
    add('daypart', 'Daypart', DAYPART_PAGES, APP_FILES)
    for g in originals:
        play = g['play'].rstrip('/') + '/'
        pages = ['games/%s/' % g['id'], play]
        if os.path.isfile(os.path.join(ROOT, play, 'game.html')):
            pages.append(play + 'game.html')
        meta = {'rating': g['rating']} if g.get('rating') else {}
        add('game:' + g['id'], g.get('appTitle') or g.get('title') or g['id'], pages, allow=(play,), **meta)
    carts_dir = os.path.join(ROOT, 'games', 'carts', 'games')
    carts = sorted('games/carts/games/' + f for f in os.listdir(carts_dir) if f.endswith('.html'))
    add('carts', 'Carts', ['games/carts/'] + carts)

    # A file shared by two packs belongs to the first one listed (the shared shell), so each download counts it once.
    owner = {}
    for pid in ['grug', 'daypart'] + [p for p in packs if p not in ('grug', 'daypart')]:
        for u in list(packs[pid]['files']):
            if u in owner and owner[u] != pid and pid.startswith(('game:', 'carts')) and owner[u] == 'grug':
                del packs[pid]['files'][u]
            owner.setdefault(u, pid)

    for p in packs.values():
        p['bytes'] = sum(os.path.getsize(os.path.join(ROOT, (u[1:] + 'index.html') if u.endswith('/') else u[1:]))
                         for u in p['files'])
    apps = {'grug': ['grug', 'carts'] + ['game:' + g['id'] for g in originals], 'daypart': ['daypart']}
    body = {'apps': apps, 'packs': packs}
    v = hashlib.sha1(json.dumps(body, sort_keys=True).encode()).hexdigest()[:12]
    return {'v': v, **body}


def main():
    data = build()
    text = json.dumps(data, indent=1, sort_keys=False) + '\n'
    if '--check' in sys.argv:
        cur = open(OUT).read() if os.path.exists(OUT) else ''
        if cur != text:
            print('app/offline.json is out of date: run python3 tools/pwa/build.py')
            sys.exit(1)
        print('app/offline.json is up to date (v %s)' % data['v'])
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as fh:
        fh.write(text)
    for pid, p in data['packs'].items():
        print('%-24s %4d files %7.1f MB' % (pid, len(p['files']), p['bytes'] / 1e6))
    print('v', data['v'])


if __name__ == '__main__':
    main()
