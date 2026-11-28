#!/usr/bin/env python3
"""Search and sharing tags for the site's pages, plus sitemap.xml (with images) and robots.txt.

    python3 src/seo/seo_head.py

For each page in PAGES it writes one block in <head>, between <!-- seo --> and <!-- /seo -->: Open Graph and Twitter
cards (the picture other sites, Discord and chats show for a link), and JSON-LD structured data (Grug Digital as the
organisation, the games, the studios, and the promotional images with their creator, credit and copyright). Running it
again replaces the block, so it's safe to re-run, and it must be re-run after src/character/build.py regenerates the two
studio pages (/character/ and /agents/studio/). The games come from GAMES in arcade/arcade.js (read with node), the image texts from images.json.
See src/seo/README.md.
"""
import html, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://grugdigital.com'
TODAY = '2026-11-26'
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
    HOME_T = 'Grug Digital · Free games, an avatar studio for AI agents, and free tools for restaurants'
    P.append(dict(file='index.html', url=SITE + '/', title=HOME_T,
                  desc='Grug Digital has three homes: free blocky games and an avatar maker for players, an avatar studio AI agents can drive for game developers, and a free rewards card, website and dashboard for restaurants.',
                  og=OG['home'], og_alt='Grug Digital characters Ranger, Skater and Grug over Grug City',
                  graph=[{'@type': 'WebSite', '@id': SITE + '/#site', 'url': SITE + '/', 'name': 'Grug Digital', 'alternateName': 'Grug', 'publisher': {'@id': SITE + '/#org'}, 'inLanguage': 'en'},
                         {'@type': 'WebPage', 'url': SITE + '/', 'name': HOME_T, 'isPartOf': {'@id': SITE + '/#site'}, 'about': {'@id': SITE + '/#org'},
                          'keywords': KEYWORDS, 'primaryImageOfPage': img(OG['home']),
                          'hasPart': [{'@type': 'WebPage', 'name': 'Players: the Grug Arcade', 'url': SITE + '/arcade/'}, {'@type': 'WebPage', 'name': 'Game developers: Grug for agents', 'url': SITE + '/agents/'},
                                      {'@type': 'WebPage', 'name': 'Restaurants: Grug for restaurants', 'url': SITE + '/restaurants/'}],
                          'image': [img(f'static/arcade/{c}.webp') for c in ['grug', 'racer', 'snow-rider', 'ranger']]}],
                  images=[OG['home']] + [f'static/arcade/{c}.webp' for c in ['grug', 'racer', 'snow-rider', 'ranger']] + ['static/arcade/grug-digital-logo.png']))
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
                  og_title='Grug Avatar Studio · Make your own character, free',
                  og_desc='The free custom avatar maker from Grug Digital: pick a face and hair, dress up from the wardrobe or paint an outfit of your own, then play as your character in the Grug games or take it to Roblox as a rigged R6 .glb.',
                  graph=[{'@type': 'WebApplication', 'name': 'Grug Avatar Studio', 'url': SITE + '/character/', 'applicationCategory': 'DesignApplication', 'operatingSystem': 'Any (web browser)',
                          'description': 'A free custom avatar maker and Roblox asset creator: make blocky Roblox R6 characters, paint custom shirts and pants, and export a rigged .glb.',
                          'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'}, 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(OG['studio'])]
                          + [img(f'character/looks/{n}/preview.png') for n in ['grug', 'flannel', 'medic', 'racer', 'ranger', 'scavenger', 'skater', 'snow-rider']]}],
                  images=[OG['studio']] + [f'character/looks/{n}/preview.png' for n in ['grug', 'flannel', 'medic', 'racer', 'ranger', 'scavenger', 'skater', 'snow-rider']]))
    cast = [f'static/showcase/grug-digital-avatar-{c}.webp' for c in ['grug', 'ranger', 'skater', 'medic', 'snow-rider', 'racer']]
    P.append(dict(file='agents/index.html', url=SITE + '/agents/', title=None, desc=None, og=OG['studio'],
                  og_alt='Custom Roblox avatars made in the Grug Avatar Studio', og_title='Grug for agents · Roblox characters your AI agent can make',
                  og_desc='Grug Avatar Studio has a version built for AI agents: no sliders, just the steps and an API. Copy a prompt, send it to Claude or any agent that can use a browser, and get a rigged Roblox R6 character back as a .glb.',
                  graph=[{'@type': 'WebPage', 'url': SITE + '/agents/', 'name': 'Grug for agents', 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(c) for c in cast]}],
                  images=cast + ['static/agents/agent-avatar-studio-for-ai-agents.webp', 'static/agents/grug-avatar-studio-for-players.webp']))
    P.append(dict(file='agents/studio/index.html', url=SITE + '/agents/studio/', title=None, desc=None, og=OG['studio'],
                  og_alt='Custom Roblox avatars made in the Grug Avatar Studio', og_title='Grug Avatar Studio for agents · Roblox R6 characters from one prompt',
                  og_desc='The Grug Avatar Studio with the hand controls taken away, for AI agents: set a look with window.GrugStudio, paint a shirt and pants in Gemini, and export a rigged Roblox R6 .glb.',
                  graph=[{'@type': 'WebApplication', 'name': 'Grug Avatar Studio for agents', 'url': SITE + '/agents/studio/', 'applicationCategory': 'DeveloperApplication', 'operatingSystem': 'Any (web browser)',
                          'description': 'The Grug Avatar Studio for AI agents: no pickers or sliders, a JavaScript API (window.GrugStudio) and the steps on the page. Makes rigged Roblox R6 characters with painted outfits.',
                          'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'}, 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS, 'image': [img(OG['studio'])]}],
                  images=[OG['studio'], 'static/agents/agent-avatar-studio-for-ai-agents.webp']))
    P.append(dict(file='packs/index.html', url=SITE + '/packs/', title=None, desc=None, og=OG['home'], og_alt='Grug Digital characters Ranger, Skater and Grug over Grug City',
                  og_title='Asset packs · Low-poly 3D models for Roblox, Unity and Godot · Grug Digital',
                  graph=[{'@type': 'CollectionPage', 'url': SITE + '/packs/', 'name': 'Grug Digital asset packs', 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS,
                          'description': 'Low-poly 3D asset packs for Roblox, Unity, Godot and other engines: characters, pets, hats and props, from the Grug Digital store on itch.io.'}],
                  images=[]))
    P.append(dict(file='store/index.html', url=SITE + '/store/', title=None, desc=None, og=OG['home'], og_alt='Grug Digital',
                  og_title='3D Store · Turn your itch.io page into a 3D shop · Grug Digital',
                  graph=[{'@type': 'WebApplication', 'name': 'Grug 3D Store', 'url': SITE + '/store/', 'applicationCategory': 'DeveloperApplication', 'operatingSystem': 'Any (web browser)',
                          'description': 'Turns an itch.io creator page into a 3D shop customers walk around, with live prices and sales, and an embed for every itch.io page.',
                          'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'}, 'publisher': {'@id': SITE + '/#org'}, 'keywords': KEYWORDS}],
                  images=[]))
    P.append(dict(file='restaurants/index.html', url=SITE + '/restaurants/', title=None, desc=None, og=OG['home'], og_alt='Grug Digital',
                  og_title='Grug for restaurants · A free rewards card, website and dashboard',
                  graph=[{'@type': 'WebPage', 'url': SITE + '/restaurants/', 'name': 'Grug for restaurants', 'publisher': {'@id': SITE + '/#org'},
                          'description': 'Free tools for cafés, bars and restaurants: a stamp card guests scan, a website made from it, and a dashboard for schedules, checklists and temperatures.',
                          'audience': {'@type': 'BusinessAudience', 'name': 'Restaurant, café and bar owners and managers'}}],
                  images=[]))
    for f, u, t, og in [('character/pearls/index.html', '/character/pearls/', 'Pearls · Grug Avatar Studio', OG['studio']), ('support.html', '/support.html', 'Help and contact · Grug Digital', OG['home']),
                        ('privacy.html', '/privacy.html', 'Privacy policy · Grug Digital', OG['home']),
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
