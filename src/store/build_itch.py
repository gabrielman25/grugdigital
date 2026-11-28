#!/usr/bin/env python3
"""Grug · the 3D Store as an itch.io HTML game (a zip to upload as "played in the browser").

    python3 src/store/build_itch.py [--user polysw] [--api https://grugdigital.com] [--out /tmp/grug-3d-store-itch.zip]

The zip is the same store page (store/index.html + static/store/store.js + mall.js) with everything it draws built in
next to it: three.js, Kenney's models (only the ones the store uses), the Arcade's sky and stud textures, the Allo font,
and the Grug avatars (/arcade/outfits/*.glb, with small pictures from /character/looks/) that everyone wears there, since
the itch.io page can't see anyone's saved Grug outfits. It runs as the embed version (no site bar). The live parts still
come from the Grug site (--api): the creator's itch.io catalog (/api/itch-store), the covers (/api/itch-img) and the mall
(/api/mall), all served with open CORS. Before the 3D Store is on the main site, build with --api pointing at the
branch preview (https://storefront.grugdigital.pages.dev); afterwards rebuild with the default.
"""
import argparse, io, json, os, re, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AVATARS = ['grug', 'ranger', 'skater', 'medic', 'racer', 'snow-rider', 'scavenger', 'flannel']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--user', default='polysw')
    ap.add_argument('--api', default='https://grugdigital.com')
    ap.add_argument('--site', default=None, help='where "Made with Grug" and other stores link (default: --api)')
    ap.add_argument('--out', default='/tmp/grug-3d-store-itch.zip')
    a = ap.parse_args()
    site = a.site or a.api
    files = {}   # path in the zip -> bytes

    def add(src, dst):
        files[dst] = (ROOT / src).read_bytes()

    add('static/vendor/three-r128.min.js', 'vendor/three-r128.min.js')
    add('static/vendor/three-r128-GLTFLoader.js', 'vendor/three-r128-GLTFLoader.js')
    add('static/outfit-rig.js', 'outfit-rig.js')
    add('static/store/store.js', 'store.js')
    add('static/store/mall.js', 'mall.js')
    for f in (ROOT / 'static/store/look').iterdir():
        add(f.relative_to(ROOT), 'look/' + f.name)
    # Kenney's models: the ones in store.js's PACK list, with their shared texture and the licence
    js = (ROOT / 'static/store/store.js').read_text()
    pack = re.search(r'const PACK = \{(.*?)\};', js, re.S).group(1)
    for name, kit in re.findall(r"'([a-z-]+)': '(mini-(?:shop|arcade))'", pack):
        add(f'static/store/kenney/{kit}/{name}.glb', f'kenney/{kit}/{name}.glb')
    for kit in ('mini-shop', 'mini-arcade'):
        add(f'static/store/kenney/{kit}/Textures/colormap.png', f'kenney/{kit}/Textures/colormap.png')
        add(f'static/store/kenney/{kit}/License.txt', f'kenney/{kit}/License.txt')
    add('static/fonts/allo-latin.woff2', 'fonts/allo-latin.woff2')
    add('static/fonts/OFL.txt', 'fonts/OFL.txt')
    add('favicon.png', 'favicon.png')

    # the Grug avatars, with a small picture of each for the changing room
    looks = {l['id']: l for l in json.loads((ROOT / 'character/looks/looks.json').read_text())}
    avatars = []
    try:
        from PIL import Image
    except ImportError:
        Image = None
    for id_ in AVATARS:
        add(f'arcade/outfits/{id_}.glb', f'avatars/{id_}.glb')
        pic = ROOT / f'character/looks/{id_}/preview.png'
        if Image and pic.exists():
            im = Image.open(pic).convert('RGBA'); im.thumbnail((192, 192))
            buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); files[f'avatars/{id_}.png'] = buf.getvalue()
        elif pic.exists():
            add(pic.relative_to(ROOT), f'avatars/{id_}.png')
        avatars.append({'id': id_, 'name': looks.get(id_, {}).get('name', id_.replace('-', ' ').title()), 'url': f'avatars/{id_}.glb', 'thumb': f'avatars/{id_}.png'})

    # the page: the store's own, run as the embed version, with every address pointing into the zip
    html = (ROOT / 'store/index.html').read_text()
    html = re.sub(r'<!-- seo:.*?<!-- /seo -->\n?', '', html, flags=re.S)
    html = re.sub(r'<link rel="canonical"[^>]*>\n?', '', html)
    html = html.replace('<link rel="preload" href="/static/fonts/allo-latin.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="/static/fonts/allo.css">',
                        '<style>@font-face{font-family:Allo;src:url(fonts/allo-latin.woff2) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}</style>')
    html = html.replace('href="/favicon.png"', 'href="favicon.png"').replace('url(/favicon.png)', 'url(favicon.png)')
    html = html.replace('<script src="/static/vendor/three-r128.min.js"></script>', '<script src="vendor/three-r128.min.js"></script>')
    html = html.replace('<script src="/static/vendor/three-r128-GLTFLoader.js"></script>', '<script src="vendor/three-r128-GLTFLoader.js"></script>')
    html = html.replace('<script src="/static/outfits.js"></script>\n', '')
    html = html.replace('<script src="/static/outfit-rig.js"></script>', '<script src="outfit-rig.js"></script>')
    cfg = {'embed': True, 'user': a.user, 'api': a.api, 'site': site, 'assets': '', 'avatars': avatars}
    html = html.replace('<script src="/static/store/store.js"></script>', '<script>window.GRUG_STORE = ' + json.dumps(cfg) + ';</script>\n<script src="store.js"></script>')
    html = re.sub(r'<title>.*?</title>', '<title>Grug 3D Store</title>', html)
    for bad in ('/static/', '/api/'):
        left = [l.strip()[:120] for l in html.splitlines() if ('"' + bad) in l or ('(' + bad) in l]
        if left: raise SystemExit('still pointing at the site: ' + repr(left))
    files['index.html'] = html.encode()

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with zipfile.ZipFile(a.out, 'w', zipfile.ZIP_DEFLATED) as z:
        for k in sorted(files): z.writestr(k, files[k])
    total = sum(len(v) for v in files.values())
    print(f'{a.out}: {len(files)} files, {total / 1e6:.1f} MB unpacked, {os.path.getsize(a.out) / 1e6:.1f} MB zipped (store: {a.user}, api: {a.api})')


if __name__ == '__main__':
    main()
