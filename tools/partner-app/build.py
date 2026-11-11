#!/usr/bin/env python3
"""Build a partner's rewards app from the shared template.

    python3 tools/partner-app/build.py crafthouse            -> play/crafthouse/index.html
    python3 tools/partner-app/build.py crafthouse --out x.html

Inputs (see README.md):
  src/app.html, src/arena.js, src/sports.js     the app itself (shared by every partner)
  shared/icons.json, shared/atlas.json          the icon pack (MIT, Voxybuns) and the voxel block atlas
  vendor/three-r149.min.js                      three.js r149 (MIT), inlined as the app's own copy
  partners/<id>/config.json                     names, colours, coin name, pass tiers, links ({{tokens}} in app.html)
  partners/<id>/data.json                       menu + menu photos (base64) + logo (for the coin) + font (base64)
  partners/<id>/logow.json                      the wide logo for the top bar, {"logo_wide": "data:image/png;base64,..."}
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    pid = args[0]
    out = args[args.index('--out') + 1] if '--out' in args else os.path.join(SITE, 'play', pid, 'index.html')
    P = os.path.join(HERE, 'partners', pid)
    cfg = json.load(open(os.path.join(P, 'config.json'), encoding='utf-8'))
    data = json.load(open(os.path.join(P, 'data.json'), encoding='utf-8'))
    logow = json.load(open(os.path.join(P, 'logow.json'), encoding='utf-8'))['logo_wide']
    atlas = json.load(open(os.path.join(HERE, 'shared', 'atlas.json')))
    icon_pack = json.load(open(os.path.join(HERE, 'shared', 'icons.json')))
    src = lambda n: open(os.path.join(HERE, 'src', n), encoding='utf-8').read()
    t, sports = src('app.html'), src('sports.js')

    # {{key}} = HTML-escaped text, {{key|js}} = inside a "double-quoted" JS string, {{key|json}} = a JS value.
    # Dotted keys reach into objects ({{color.accent}}).
    def value(key):
        v = cfg
        for k in key.split('.'):
            if not isinstance(v, dict) or k not in v:
                sys.exit('config.json is missing "%s" (used as {{%s}} in src/app.html)' % (key, key))
            v = v[k]
        return v

    def fill(m):
        key, _, kind = m.group(1).partition('|')
        v = value(key)
        if kind == 'json':
            return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
        if kind == 'js':
            return json.dumps(str(v), ensure_ascii=False)[1:-1]
        return html.escape(str(v), quote=True)
    t = re.sub(r'\{\{([A-Za-z][A-Za-z0-9.]*(?:\|(?:js|json))?)\}\}', fill, t)

    # only the icons the app uses
    used = set(re.findall(r'ic\("([a-z_0-9]+)"', t) + re.findall(r'data-ic="([a-z_0-9]+)"', t) +
               re.findall(r"icon:\s*'([a-z_0-9]+)'", sports) +
               ['house', 'meat', 'controller', 'trophy', 'coins', 'american_football', 'football', 'basketball', 'speaker', 'speaker_mute'])
    missing = sorted(n for n in used if n not in icon_pack)
    if missing:
        print('missing icons (not in shared/icons.json):', ', '.join(missing))
    icons = {n: icon_pack[n] for n in sorted(used) if n in icon_pack}

    t = t.replace('__ARENA__', src('arena.js')).replace('__SPORTS__', sports)
    t = t.replace('__LOGOW__', logow).replace('__FONT__', data['font']).replace('__LOGO__', data['logo'])
    t = t.replace('__MENU__', json.dumps(data['menu'], ensure_ascii=False, separators=(',', ':')))
    t = t.replace('__IMGS__', json.dumps(data['imgs'], separators=(',', ':')))
    t = t.replace('__ICONS__', json.dumps(icons, separators=(',', ':')))
    t = t.replace('__ATLAS_URL__', atlas['url']).replace('__ATLAS_CELLS__', json.dumps(atlas['cells']))
    left = sorted(set(re.findall(r'\{\{[A-Za-z][^}]*\}\}|__[A-Z_]+__', t)) - {'__THREE__'})
    if left:
        sys.exit('unfilled placeholders: ' + ', '.join(left))
    assert t.count('__THREE__') == 1
    t = t.replace('__THREE__', open(os.path.join(HERE, 'vendor', 'three-r149.min.js'), encoding='utf-8').read())
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(t)
    print('built %s (%d KB, %d icons)' % (os.path.relpath(out, SITE), len(t.encode()) // 1024, len(icons)))


if __name__ == '__main__':
    main()
