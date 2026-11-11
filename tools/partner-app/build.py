#!/usr/bin/env python3
"""Build a partner's rewards app from the shared template.

    python3 tools/partner-app/build.py crafthouse            -> play/crafthouse/index.html
    python3 tools/partner-app/build.py crafthouse --out x.html

Inputs (see README.md):
  src/app.html                                  the app itself (shared by every partner)
  shared/icons.json                             the icon pack (MIT, Voxybuns)
  partners/<id>/config.json                     names, colours, coin name, pass tiers, themes, copy ({{tokens}} in app.html)
  partners/<id>/quiz.json                       the "What should I order?" questions
  partners/<id>/data.json                       menu + menu photos (base64) + logo (for the coin) + font(s) (base64)
  partners/<id>/logow.json                      the wide logo for the top bar, {"logo_wide": "data:image/png;base64,..."}

The app has no game room of its own: its games are the Grug site's (the partner's own game, once it has one, and the
Grug originals), shown on Home as FOSSIL32 cartridges and on the site's game list.
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
    quiz = json.load(open(os.path.join(P, 'quiz.json'), encoding='utf-8'))
    icon_pack = json.load(open(os.path.join(HERE, 'shared', 'icons.json')))
    src = lambda n: open(os.path.join(HERE, 'src', n), encoding='utf-8').read()
    t = src('app.html')

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
    TOK = r'\{\{([A-Za-z][A-Za-z0-9.]*(?:\|(?:js|json))?)\}\}'
    t = re.sub(TOK, fill, t)

    # only the icons the app uses
    used = set(re.findall(r'ic\("([a-z_0-9]+)"', t) + re.findall(r'data-ic="([a-z_0-9]+)"', t) +
               ['house', 'controller', 'trophy', 'coins', 'speaker', 'speaker_mute', cfg['menuIcon']] + [u[0] for u in cfg['coinUses']])
    missing = sorted(n for n in used if n not in icon_pack)
    if missing:
        print('missing icons (not in shared/icons.json):', ', '.join(missing))
    icons = {n: icon_pack[n] for n in sorted(used) if n in icon_pack}

    t = t.replace('__LOGOW__', logow).replace('__FONT__', data['font']).replace('__LOGO__', data['logo'])
    t = t.replace('__FONT_DISPLAY__', data.get('font_display') or data['font'])   # a second face for headings, if the partner has one
    t = t.replace('__QUIZ__', json.dumps(quiz, ensure_ascii=False, separators=(',', ':')))
    t = t.replace('__MENU__', json.dumps(data['menu'], ensure_ascii=False, separators=(',', ':')))
    t = t.replace('__IMGS__', json.dumps(data['imgs'], separators=(',', ':')))
    t = t.replace('__ICONS__', json.dumps(icons, separators=(',', ':')))
    left = sorted(set(re.findall(r'\{\{[A-Za-z][^}]*\}\}|__[A-Z_]+__', t)))
    if left:
        sys.exit('unfilled placeholders: ' + ', '.join(left))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(t)
    print('built %s (%d KB, %d icons)' % (os.path.relpath(out, SITE), len(t.encode()) // 1024, len(icons)))


if __name__ == '__main__':
    main()
