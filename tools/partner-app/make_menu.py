#!/usr/bin/env python3
"""Make data.json for a partner from a hand-written menu.json (no website scraping needed).

    python3 tools/partner-app/make_menu.py <id>        -> tools/partner-app/partners/<id>/data.json

Used by the venues that came over from the older rewards apps (teahouse, soluna, rodeo, alchemy). Coco and CraftHouse
have their own make_data.py (their menus come from their websites).

Inputs in partners/<id>/:
  menu.json            {"sections": [{"cat": "Milk teas", "icon": "cup", "items": [
                           {"n": name, "d": description, "p": price text, "t": "k=milk fl=creamy", "top": 1,
                            "photo": "a path from the repo root (optional)"}]}]}
                       t = the quiz tags (space-separated key=value, a comma means any of these; see quiz.json).
                       top = a house signature (shown on Home, and the quiz's "signature" question).
  logo-square.png      the wordmark, dark on white, for the struck coin
  font.woff2           body text (a variable font, or one weight)
  font-display.woff2   headings (optional)
  config.json          its color.deep / color.accent paint the menu cards

The quiz only picks dishes with a picture, so every dish gets one: its photo when it has one, otherwise a menu card
drawn in the partner's colours (the section's icon from shared/icons.json and the dish name in the heading face),
rendered with headless Chrome (playwright). Cards and photos are 600 x 480 JPEGs inlined as data URLs.
"""
import asyncio, base64, io, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))
W, H = 600, 480


def parse(s):
    t = {}
    for kv in (s or '').split():
        k, v = kv.split('=')
        vs = [int(x) if x.isdigit() else x for x in v.split(',')]
        t[k] = vs if len(vs) > 1 else vs[0]
    return t


def jpeg(im, q=74):
    im = im.convert('RGB')
    r = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    b = io.BytesIO(); im.crop((x, y, x + W, y + H)).save(b, 'JPEG', quality=q, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


async def cards(jobs, cfg, display_b64):
    """jobs: [(name, icon svg body)] -> [data url]"""
    from playwright.async_api import async_playwright
    c = cfg['color']
    css = ('@font-face{font-family:D;src:url(data:font/woff2;base64,%s) format("woff2");font-weight:200 800}'
           'html,body{margin:0}.k{position:relative;width:%dpx;height:%dpx;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;'
           'background:%s;background-image:radial-gradient(circle at 50%% 38%%,rgba(255,255,255,.10),rgba(255,255,255,0) 60%%),'
           'repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 14px,transparent 14px 28px)}'
           '.k svg{width:120px;height:120px;color:%s}'
           '.k b{font:700 46px/1.05 D,system-ui,sans-serif;color:#fff;text-align:center;padding:0 40px;letter-spacing:-.01em;max-width:100%%;box-sizing:border-box}'
           '.k i{position:absolute;left:0;right:0;bottom:0;height:14px;background:%s}') % (display_b64, W, H, c['deep'], c['accent'], c['accent'])
    body = ''.join('<div class="k" id="k%d"><svg viewBox="0 0 16 16" fill="none">%s</svg><b>%s</b><i></i></div>' % (i, svg, html_esc(n)) for i, (n, svg) in enumerate(jobs))
    out = []
    async with async_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        b = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        await pg.set_content('<html><head><style>%s</style></head><body>%s</body></html>' % (css, body))
        await pg.evaluate('document.fonts.ready')
        for i in range(len(jobs)):
            png = await pg.locator('#k%d' % i).screenshot()
            out.append(jpeg(Image.open(io.BytesIO(png)), 80))
        await b.close()
    return out


def html_esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pid = sys.argv[1]
    P = os.path.join(HERE, 'partners', pid) + '/'
    menu = json.load(open(P + 'menu.json', encoding='utf-8'))
    cfg = json.load(open(P + 'config.json', encoding='utf-8'))
    icons = json.load(open(os.path.join(HERE, 'shared', 'icons.json')))
    b64 = lambda f: base64.b64encode(open(f, 'rb').read()).decode()
    font = b64(P + 'font.woff2')
    display = b64(P + 'font-display.woff2') if os.path.exists(P + 'font-display.woff2') else font

    out, imgs, jobs, slots = [], [], [], []
    for sec in menu['sections']:
        items = []
        for it in sec['items']:
            o = {'n': it['n'], 'd': it.get('d', ''), 'p': it.get('p', '')}
            o['i'] = len(imgs)
            if it.get('photo'):
                imgs.append(jpeg(Image.open(os.path.join(SITE, it['photo']))))
            else:
                imgs.append(None); jobs.append((it['n'], icons[sec.get('icon', 'star')])); slots.append(o['i'])
            if it.get('t'):
                o['t'] = parse(it['t'])
            if it.get('top'):
                o['top'] = 1
            items.append(o)
        out.append({'cat': sec['cat'], 'items': items})
    for i, url in zip(slots, asyncio.run(cards(jobs, cfg, display)) if jobs else []):
        imgs[i] = url

    logo = Image.open(P + 'logo-square.png').convert('L').resize((384, 384), Image.LANCZOS)
    b = io.BytesIO(); logo.save(b, 'PNG', optimize=True)
    data = {'menu': out, 'imgs': imgs, 'logo': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), 'font': font}
    if os.path.exists(P + 'font-display.woff2'):
        data['font_display'] = display
    json.dump(data, open(P + 'data.json', 'w'), separators=(',', ':'))
    n = sum(len(s['items']) for s in out)
    print('data ok: %d sections, %d dishes (%d in the quiz), %d photos, %d menu cards, %d KB' % (
        len(out), n, sum(1 for s in out for i in s['items'] if 't' in i), n - len(jobs), len(jobs), os.path.getsize(P + 'data.json') // 1024))


if __name__ == '__main__':
    main()
