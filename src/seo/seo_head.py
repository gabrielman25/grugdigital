#!/usr/bin/env python3
"""Search and sharing tags for the site's pages, plus sitemap.xml (with images) and robots.txt.

    python3 src/seo/seo_head.py

For each page in PAGES it writes one block in <head>, between <!-- seo --> and <!-- /seo -->: Open Graph and Twitter
cards (the picture other sites, Discord and chats show for a link), and JSON-LD structured data (Grug Digital as the
organisation, the games, the studios, and the promotional images with their creator, credit and copyright). Running it
again replaces the block, so it's safe to re-run, and it must be re-run after src/character/build.py or src/build/build.py
regenerates those pages. The games come from GAMES in arcade/arcade.js (read with node), the image texts from images.json.
See src/seo/README.md.
"""
import html, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://grugdigital.com'
TODAY = '2026-11-25'
IMAGES = {k: v for k, v in json.load(open(os.path.join(ROOT, 'src/seo/images.json'), encoding='utf-8')).items() if not k.startswith('_')}
COPYRIGHT = '© 2026 Grug Digital. All rights reserved.'
KEYWORDS = 'Grug Digital, custom avatar, Roblox alternative, Roblox asset creator, free 3D game assets, Roblox avatar maker, R6 avatar, blocky games, browser games, low poly'
ORG = {'@type': 'Organization', '@id': SITE + '/#org', 'name': 'Grug Digital', 'alternateName': 'Grug', 'url': SITE + '/',
       'logo': {'@type': 'ImageObject', 'url': SITE + '/static/arcade/grug-digital-logo.png'},
       'sameAs': ['https://www.youtube.com/@PolySwitchOfficial', 'https://www.instagram.com/grugdigital', 'https://discord.gg/3ENePvNGJy', 'https://polysw.itch.io/']}
OG = {'home': 'static/og/grug-digital-custom-avatars-and-free-games.jpg', 'arcade': 'static/og/grug-arcade-free-blocky-games.jpg',
      'studio': 'static/og/grug-avatar-studio-custom-roblox-avatars.jpg'}


def games():
    js = r"""const fs=require('fs'),vm=require('vm');const w={addEventListener(){},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},location:{pathname:'/'}};
const c={window:w,document:{getElementById:()=>null,querySelector:()=>null,addEventListener(){}},localStorage:w.localStorage,navigator:{},location:w.location,console,setTimeout,addEventListener(){}};
vm.createContext(c);vm.runInContext(fs.readFileSync('arcade/arcade.js','utf8'),c);const A=c.window.GrugArcade;
console.log(JSON.stringify(A.GAMES.map(g=>({slug:g.slug,name:g.name,tag:g.tag,about:g.about||[],alt:g.alt,genres:g.genres.map(A.gname).filter(x=>x!=='All'),coop:!!g.coop,added:g.added,updated:g.updated}))))"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True))


def img(path):
    m = IMAGES[path]
    o = {'@type': 'ImageObject', 'contentUrl': f'{SITE}/{path}', 'url': f'{SITE}/{path}', 'name': m['title'], 'caption': m['description'],
         'description': m['description'], 'creator': {'@id': SITE + '/#org'}, 'creditText': 'Grug Digital', 'copyrightNotice': COPYRIGHT,
         'copyrightHolder': {'@id': SITE + '/#org'}, 'license': SITE + '/terms.html', 'acquireLicensePage': SITE + '/terms.html',
         'keywords': ', '.join(m.get('keywords', []) + ['Grug Digital'])}
    return o


def first_sentences(paras, n=300):
    t = ' '.join(paras)
    if len(t) <= n: return t
    cut = t[:n].rsplit('. ', 1)[0]
    return cut + '.' if not cut.endswith('.') else cut


def build_pages(G):
    P = []
    P.append(dict(file='index.html', url=SITE + '/', title='Grug Digital · Custom avatars, free 3D game assets and blocky games',
                  desc='Grug Digital makes custom avatars, free 3D game assets and blocky games: the free Grug Avatar Studio (a Roblox asset creator for R6 characters), the Building Studio, low-poly asset packs and the Grug Arcade.',
                  og=OG['home'], og_alt='Grug Digital characters Ranger, Skater and Grug over Grug City',
                  graph=[{'@type': 'WebSite', '@id': SITE + '/#site', 'url': SITE + '/', 'name': 'Grug Digital', 'alternateName': 'Grug', 'publisher': {'@id': SITE + '/#org'}, 'inLanguage': 'en'},
                         {'@type': 'WebPage', 'url': SITE + '/', 'name': 'Grug Digital · Custom avatars, free 3D game assets and blocky games', 'isPartOf': {'@id': SITE + '/#site'}, 'about': {'@id': SITE + '/#org'},
                          'keywords': KEYWORDS, 'primaryImageOfPage': img(OG['home']),
                          'image': [img(f'static/showcase/grug-digital-avatar-{c}.webp') for c in ['grug', 'ranger', 'skater', 'medic', 'snow-rider', 'racer']]
                                   + [img(f'static/showcase/slide-999-km-purple-slide-{i}.jpg') for i in range(1, 5)] + [img(f'static/showcase/zombie-zones-desert-houses-{i}.jpg') for i in range(1, 3)]}],
                  images=[OG['home']] + [f'static/showcase/grug-digital-avatar-{c}.webp' for c in ['grug', 'ranger', 'skater', 'medic', 'snow-rider', 'racer']]
                         + [f'static/showcase/slide-999-km-purple-slide-{i}.jpg' for i in range(1, 5)] + [f'static/showcase/zombie-zones-desert-houses-{i}.jpg' for i in range(1, 3)]
                         + ['static/arcade/grug-digital-logo.png']))
    listed = [g for g in G]
    P.append(dict(file='arcade/index.html', url=SITE + '/arcade/', title='Grug Arcade · Free blocky games by Grug Digital',
                  desc='Free blocky games in your browser from Grug Digital, a Roblox alternative with nothing to download: Zone Royale, Slide 999 KM, Zombie Zones, Grug City RP, Brickbound, Grug Kingdom and Pet Zones. Play as your own custom avatar, with friends on one screen.',
                  og=OG['arcade'], og_alt='Grug Digital characters Medic and Racer over Zone Royale',
                  graph=[{'@type': 'CollectionPage', 'url': SITE + '/arcade/', 'name': 'Grug Arcade · Free blocky games by Grug Digital', 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS,
                          'primaryImageOfPage': img(OG['arcade']),
                          'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/arcade/place/?id={g["slug"]}', 'name': g['name'],
                                                                                  'image': f'{SITE}/arcade/{g["slug"]}/{g["slug"]}-grug-arcade.jpg'} for i, g in enumerate(listed)]},
                          'image': [img(f'arcade/{g["slug"]}/{g["slug"]}-grug-arcade.jpg') for g in listed]}],
                  images=[OG['arcade']] + [f'arcade/{g["slug"]}/{g["slug"]}-grug-arcade.jpg' for g in listed]
                         + [f'static/arcade/{n}.jpg' for n in ['grug-city-rp-aerial-view', 'grug-city-rp-ice-cream-shop', 'grug-city-rp-pizza-shop', 'grug-city-rp-salon']]
                         + [f'static/arcade/{c}.webp' for c in ['grug', 'ranger', 'skater', 'medic', 'snow-rider', 'racer']]))
    P.append(dict(file='arcade/place/index.html', url=SITE + '/arcade/place/', title=None, desc=None, og=OG['arcade'], og_alt='Grug Digital characters Medic and Racer over Zone Royale',
                  og_title='Grug Arcade · Free blocky games by Grug Digital', graph=None, images=[], nositemap=True, nocanon=True))   # each game's own address, data and title are set by the page's script
    P.append(dict(file='arcade/motion/index.html', url=SITE + '/arcade/motion/', title=None, desc=None, og=OG['arcade'], og_alt='Grug Digital characters Medic and Racer over Zone Royale',
                  graph=[{'@type': 'WebPage', 'url': SITE + '/arcade/motion/', 'name': 'Motion Controls · Coming soon to the Grug Arcade', 'publisher': {'@id': SITE + '/#org'},
                          'keywords': 'motion controls, motion games, phone camera, party games, ' + KEYWORDS, 'primaryImageOfPage': img(OG['arcade'])}],
                  images=[OG['arcade']] + [f'static/showcase/grug-digital-avatar-{c}.webp' for c in ['racer', 'snow-rider', 'grug']]))   # Motion Controls (coming soon)
    for g in G:
        cover = f'arcade/{g["slug"]}/{g["slug"]}-grug-arcade.jpg'
        url = f'{SITE}/arcade/{g["slug"]}/'
        desc = first_sentences(g['about'] or [g['tag']], 240)
        game = {'@type': 'VideoGame', '@id': url + '#game', 'name': g['name'], 'url': url, 'description': ' '.join(g['about']) or g['tag'],
                'image': img(cover), 'genre': g['genres'], 'gamePlatform': 'Web browser', 'applicationCategory': 'Game', 'operatingSystem': 'Any (web browser)',
                'playMode': ['SinglePlayer'] + (['CoOp', 'MultiPlayer'] if g['coop'] else []), 'isAccessibleForFree': True,
                'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD', 'availability': 'https://schema.org/InStock', 'url': url},
                'author': {'@id': SITE + '/#org'}, 'publisher': {'@id': SITE + '/#org'}, 'datePublished': g['added'][:10], 'dateModified': g['updated'][:10],
                'keywords': f'{g["name"]}, ' + KEYWORDS}
        P.append(dict(file=f'arcade/{g["slug"]}/index.html', url=url, title=f'{g["name"]} · Free in the Grug Arcade by Grug Digital',
                      desc=f'{g["name"]}: {desc} Free in your browser, a Grug Arcade game by Grug Digital.', og=cover, og_w=960, og_h=540,
                      og_alt=f'{g["name"]}, a free game in the Grug Arcade: {g["alt"]}', graph=[game], images=[cover], keep_title=False))
        P.append(dict(sitemap_only=True, url=f'{SITE}/arcade/place/?id={g["slug"]}', images=[cover]))
    P.append(dict(file='character/index.html', url=SITE + '/character/', title=None,
                  desc=None, og=OG['studio'], og_alt='Custom Roblox R6 avatars Snow Rider, Grug and Skater, made in the Grug Avatar Studio',
                  og_title='Grug Avatar Studio · Make a custom Roblox avatar, free',
                  og_desc='The free custom avatar maker from Grug Digital: a Roblox asset creator for R6 characters. Pick hair and a face, paint a shirt and pants with AI, and download the rigged .glb for Roblox, Unity, Godot or Blender.',
                  graph=[{'@type': 'WebApplication', 'name': 'Grug Avatar Studio', 'url': SITE + '/character/', 'applicationCategory': 'DesignApplication', 'operatingSystem': 'Any (web browser)',
                          'description': 'A free custom avatar maker and Roblox asset creator: make blocky Roblox R6 characters, paint custom shirts and pants, and export a rigged .glb.',
                          'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'}, 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(OG['studio'])]
                          + [img(f'character/looks/{n}/preview.png') for n in ['grug', 'flannel', 'medic', 'racer', 'ranger', 'scavenger', 'skater', 'snow-rider']]}],
                  images=[OG['studio']] + [f'character/looks/{n}/preview.png' for n in ['grug', 'flannel', 'medic', 'racer', 'ranger', 'scavenger', 'skater', 'snow-rider']]))
    thumbs = [f'build/examples/{n}-thumb.jpg' for n in ['cafe', 'forge', 'hab', 'house', 'inn', 'tower']]
    P.append(dict(file='build/index.html', url=SITE + '/build/', title=None, desc=None, og='build/examples/inn-thumb.jpg', og_w=None, og_h=None,
                  og_alt='A Tudor inn, a 3D building made in the Grug Building Studio', og_title='Grug Building Studio · Free 3D game assets from Grug Digital',
                  og_desc='Block out a chunky building, paint it with AI and download a textured, retro 3D model (.glb): free 3D game assets from Grug Digital.',
                  graph=[{'@type': 'WebApplication', 'name': 'Grug Building Studio', 'url': SITE + '/build/', 'applicationCategory': 'DesignApplication', 'operatingSystem': 'Any (web browser)',
                          'description': 'Make free 3D game assets: block out a building, paint it with AI and export a textured low-poly .glb.', 'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'},
                          'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(t) for t in thumbs]}],
                  images=thumbs))
    P.append(dict(file='build/examples/index.html', url=SITE + '/build/examples/', title=None, desc=None, og='build/examples/tower-thumb.jpg',
                  og_alt='A stone watchtower, a 3D building made in the Grug Building Studio', og_title='Example buildings · Grug Building Studio',
                  og_desc='Free 3D game assets from Grug Digital: a café, a forge, a habitat, a house, an inn and a tower, each made in the Grug Building Studio.',
                  graph=[{'@type': 'CollectionPage', 'url': SITE + '/build/examples/', 'name': 'Example buildings · Grug Building Studio', 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(t) for t in thumbs]}],
                  images=thumbs))
    for f, u, t, og in [('character/pearls/index.html', '/character/pearls/', 'Pearls · Grug Avatar Studio', OG['studio']), ('privacy.html', '/privacy.html', 'Privacy policy · Grug Digital', OG['home']),
                        ('terms.html', '/terms.html', 'Terms of service · Grug Digital', OG['home'])]:
        P.append(dict(file=f, url=SITE + u, title=None, desc=None, og=og, og_alt='Grug Digital', og_title=t, graph=[{'@type': 'WebPage', 'url': SITE + u, 'name': t, 'publisher': {'@id': SITE + '/#org'}}], images=[]))
    for f, u in [('tizzy/index.html', '/tizzy/'), ('itch/index.html', '/itch/')]:   # promo landing pages (noindex): just the share card
        P.append(dict(file=f, url=SITE + u, title=None, desc=None, og=OG['studio'], og_alt='Custom Roblox avatars made in the Grug Avatar Studio', graph=None, images=[], nositemap=True))
    return P


def esc(s): return html.escape(s, quote=True)


def head_block(p, s):
    m = re.search(r'<title>([^<]*)</title>', s); title = p.get('og_title') or p.get('title') or (html.unescape(m.group(1)) if m else 'Grug Digital')
    d = re.search(r'<meta name="description" content="([^"]*)"', s); desc = p.get('og_desc') or p.get('desc') or (html.unescape(d.group(1)) if d else '')
    og = p['og']; w, h = p.get('og_w', 1200), p.get('og_h', 630)
    if og.startswith('build/'): w = h = None
    L = ['<!-- seo: written by src/seo/seo_head.py (re-run it, don\'t edit by hand) -->',
         '<meta property="og:site_name" content="Grug Digital">', '<meta property="og:type" content="website">',
         f'<meta property="og:title" content="{esc(title)}">', f'<meta property="og:description" content="{esc(desc)}">', f'<meta property="og:url" content="{p["url"]}">',
         f'<meta property="og:image" content="{SITE}/{og}">']
    if w: L += [f'<meta property="og:image:width" content="{w}">', f'<meta property="og:image:height" content="{h}">']
    L += [f'<meta property="og:image:alt" content="{esc(p["og_alt"])}">', '<meta name="twitter:card" content="summary_large_image">',
          f'<meta name="twitter:title" content="{esc(title)}">', f'<meta name="twitter:description" content="{esc(desc)}">', f'<meta name="twitter:image" content="{SITE}/{og}">',
          f'<meta name="twitter:image:alt" content="{esc(p["og_alt"])}">']
    if not p.get('nocanon') and not re.search(r'rel="canonical"', s): L.append(f'<link rel="canonical" href="{p["url"]}">')
    if p.get('desc') is not None and not d: L.append(f'<meta name="description" content="{esc(p["desc"])}">')
    if p.get('graph'):
        data = {'@context': 'https://schema.org', '@graph': [ORG] + p['graph']}
        L.append('<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>')
    L.append('<!-- /seo -->')
    return '\n'.join(L)


def write_page(p):
    f = os.path.join(ROOT, p['file']); s = open(f, encoding='utf-8').read()
    s = re.sub(r'\n?<!-- seo: written by src/seo/seo_head\.py.*?<!-- /seo -->', '', s, flags=re.S)
    if p.get('title'): s = re.sub(r'<title>[^<]*</title>', f'<title>{esc(p["title"])}</title>', s, count=1)
    if p.get('desc') and re.search(r'<meta name="description" content="[^"]*">', s):
        s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(p["desc"])}">', s, count=1)
    block = head_block(p, s)
    i = s.find('</title>'); assert i > 0, p['file']
    j = s.find('\n', i) + 1
    s = s[:j] + block + '\n' + s[j:]
    open(f, 'w', encoding='utf-8').write(s)
    print('head', p['file'])


def sitemap(P):
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<!-- written by src/seo/seo_head.py -->',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    for p in P:
        if p.get('nositemap'): continue
        out.append('  <url>'); out.append(f'    <loc>{esc(p["url"])}</loc>'); out.append(f'    <lastmod>{TODAY}</lastmod>')
        for i in dict.fromkeys(p.get('images', [])): out.append(f'    <image:image><image:loc>{SITE}/{i}</image:loc></image:image>')
        out.append('  </url>')
    out.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write('# Grug Digital (written by src/seo/seo_head.py)\nUser-agent: *\nAllow: /\n\nSitemap: https://grugdigital.com/sitemap.xml\n')
    print('sitemap.xml + robots.txt')


if __name__ == '__main__':
    P = build_pages(games())
    for p in P:
        if not p.get('sitemap_only'): write_page(p)
    sitemap(P)
