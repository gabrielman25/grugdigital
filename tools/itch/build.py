#!/usr/bin/env python3
"""Grug · itch.io build: python3 tools/itch/build.py <id>  →  itch-builds/<id>/ and itch-builds/<id>.zip

The itch.io copies are standalone: separate from the site (which keeps hosting its own games in play/<id>/), never
talking to it, there for visibility and to send players to the site. Every player on itch is a guest.

The zip is what gets uploaded to itch.io (Kind = HTML). Inside it:
  index.html     the wrapper: the guest banner + one-time welcome pop-up (guest.js, both link to the site in a new tab),
                 and a frame for the game below the banner, so the banner never covers the game's UI
  game.html      a copy of play/<id>/game.html with a few small patches (below); play/<id>/game.html is never changed
  guestmode.js   always 'guest': the local GuestNNNN player in the default look (tools/itch/guestmode.js)
  guest.js, gamekit.js (the site's, unchanged), fredoka.woff2, CREDITS.txt
The avatar runtime (sandy-runtime.js, 15 MB) is not bundled: it loads from https://grugdigital.pages.dev/assets/.

Patches to the game copy (every Grug original shares the same template Bridge, so most are the same for all):
  - scripts load from the zip's root; the runtime from the site only
  - Bridge: never posts to "*" (only its own origin) and starts its demo at once (GRUGB = the wrapper's guest mode)
  - the player wears the default look and, where the game shows a name, is called GuestNNNN
  - boot waits for the welcome pop-up to close before the run starts
Per-game patches (name spots, boot lines) are in GAMES below.
"""
import os, re, shutil, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITE = 'https://grugdigital.pages.dev'
RUNTIME = SITE + '/assets/sandy-runtime.js'

GRUGB = ("/* itch build: the wrapper page's guest mode (guestmode.js), or null when this file runs on its own */\n"
         "const GRUGB = (() => { try { return window.parent !== window && window.parent.GrugBridge || null; } catch (e) { return null; } })();\n")
READY = "  if (GRUGB) await GRUGB.ready();\n"
GATE = "if (GRUGB) { await GRUGB.ready(); if (window.parent.GrugGuest) await window.parent.GrugGuest.gate(); }"

COMMON = [
    ('<script src="../../assets/gamekit.js"></script>', '<script src="gamekit.js"></script>'),
    (re.compile(r"runtime: \[[^\]]*sandy-runtime\.js'\]"), "runtime: ['" + RUNTIME + "']"),
    ('const Bridge = (() => {\n', GRUGB + 'const Bridge = (() => {\n'),
    ('  const embedded = window.parent && window.parent !== window;',
     '  let embedded = window.parent && window.parent !== window;'),
    ("const post = m => { try { window.parent.postMessage(Object.assign({ rw: 1 }, m), '*'); } catch (e) {} };",
     "const post = m => { try { window.parent.postMessage(Object.assign({ rw: 1 }, m), location.origin); } catch (e) {} };   // the wrapper (same origin)"),
    ("if (!d || d.rw !== 1 || e.source !== window.parent) return;",
     "if (!d || d.rw !== 1 || e.source !== window.parent || e.origin !== location.origin) return;"),
    ("  function start() {\n    if (embedded) post({ t: 'hello' });",
     "  function start() {\n    if (GRUGB) embedded = false;   // standalone guest copy: no host to ask, demo at once\n    window.GRUG_STARTED = true;\n    if (embedded) post({ t: 'hello' });"),
    ("function playerConfig() { let c = null; try { c = JSON.parse(localStorage.getItem('grug.sandy.v1') || 'null'); } catch (e) {} return",
     "function playerConfig() { const own = () => { try { return JSON.parse(localStorage.getItem('grug.sandy.v1') || 'null'); } catch (e) { return null; } }; const c = GRUGB ? GRUGB.sandy(own) : own(); return"),
]

GAMES = {
    'runway': {
        'title': 'Runway Ready', 'bg': '#efe9e2',
        'patches': [
            ("  await Game.setup();\n  load.classList.add('done'); Bridge.start();",
             READY + "  await Game.setup();\n  " + GATE + "\n  load.classList.add('done'); Bridge.start();"),
            ("html: esc(c.isPlayer ? (Bridge.state && Bridge.state.player) || 'You' : c.name)",
             "html: esc(c.isPlayer ? (GRUGB ? GRUGB.name((Bridge.state && Bridge.state.player) || 'You') : (Bridge.state && Bridge.state.player) || 'You') : c.name)"),
        ],
    },
    # The other originals call the player "You" (as they do on the site) and never show a profile name, so only boot changes.
    'chestquest': {
        'title': 'Crypt Crawler', 'bg': '#0b0e14',
        'patches': [
            ("  makeWorld(atlas); await Game.setup();\n  load.classList.add('done'); Bridge.start();",
             "  makeWorld(atlas);\n" + READY + "  await Game.setup();\n  " + GATE + "\n  load.classList.add('done'); Bridge.start();"),
        ],
    },
    'petmountainrescue': {
        'title': 'Peak Pals', 'bg': '#8fd0ff',
        'patches': [
            ("  makeWorld(atlas); await Game.setup();\n  load.classList.add('done'); Bridge.start();",
             "  makeWorld(atlas);\n" + READY + "  await Game.setup();\n  " + GATE + "\n  load.classList.add('done'); Bridge.start();"),
        ],
    },
    'glowupspa': {
        'title': 'Glamour Spa Deluxe', 'bg': '#5cc8ff',
        'patches': [
            ("  await Game.setup();\n  Bridge.start();\n  load.classList.add('done');",
             READY + "  await Game.setup();\n  " + GATE + "\n  Bridge.start();\n  load.classList.add('done');"),
        ],
    },
    'mysteryblasters': {
        'title': 'Foam Frenzy', 'bg': '#0b0e14',
        'patches': [
            ("  await Game.setup(txt);\n  Bridge.start();",
             READY + "  await Game.setup(txt);\n  " + GATE + "\n  Bridge.start();"),
        ],
    },
}

WRAPPER = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>{title} · Grug</title>
<!-- Grug itch.io build (tools/itch/build.py): a standalone copy, separate from the Grug site. The game is game.html,
     framed below the guest banner; it never talks to any other page. -->
<style>
html,body{{margin:0;height:100%;overflow:hidden;background:{bg}}}
#wrap{{position:fixed;inset:0;display:flex;flex-direction:column}}
#game{{flex:1;min-height:0;width:100%;border:0;display:block;background:{bg}}}
</style>
<script>window.GRUG_GAME = {{ id: '{id}', title: '{title}' }};</script>
<script src="guestmode.js"></script>
<script src="guest.js"></script>
</head>
<body>
<div id="wrap"><iframe id="game" title="{title}" allow="autoplay; fullscreen; gamepad" src="game.html"></iframe></div>
<script>
(function () {{
  'use strict';
  var f = document.getElementById('game');
  var focusGame = function () {{ try {{ f.focus(); f.contentWindow.focus(); }} catch (e) {{}} }};
  GrugGuest.mount({{
    into: document.getElementById('wrap'),
    // the pop-up opened after the run started: pause it (the game's own 'pause' message, same origin)
    pause: function () {{ try {{ if (f.contentWindow.GRUG_STARTED) f.contentWindow.postMessage({{ rw: 1, t: 'pause' }}, location.origin); }} catch (e) {{}} }},
    focus: focusGame
  }});
  f.addEventListener('load', function () {{ if (!GrugGuest.open) focusGame(); }});
  document.addEventListener('pointerdown', function (e) {{ if (!e.target.closest('a,button,.gg-pop')) setTimeout(focusGame, 0); }});
}})();
</script>
</body>
</html>
"""

CREDITS = """Grug · {title}
A Grug original by Grug Digital. Play it with your own avatar on {site}/games/{id}/

Fredoka (fredoka.woff2): SIL Open Font License 1.1, https://openfontlicense.org
three.js (in the avatar runtime, loaded from {site}): MIT License
"""


def patch(src, pairs, gid):
    for a, b in pairs:
        if isinstance(a, re.Pattern):
            src, n = a.subn(b, src)
        else:
            n = src.count(a); src = src.replace(a, b)
        if n != 1:
            sys.exit('%s: patch matched %d times: %s' % (gid, n, (a.pattern if isinstance(a, re.Pattern) else a)[:90]))
    return src


def build(gid):
    g = GAMES[gid]
    out = os.path.join(ROOT, 'itch-builds', gid)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    src = open(os.path.join(ROOT, 'play', gid, 'game.html'), encoding='utf-8').read()
    src = patch(src, COMMON + g['patches'], gid)
    if re.search(r"postMessage\([^;]*['\"]\*['\"]\)", src):
        sys.exit(gid + ': a "*" postMessage target is left')
    open(os.path.join(out, 'game.html'), 'w', encoding='utf-8').write(src)
    shutil.copy(os.path.join(ROOT, 'assets', 'gamekit.js'), os.path.join(out, 'gamekit.js'))
    for f in ('guestmode.js', 'guest.js'):
        shutil.copy(os.path.join(ROOT, 'tools', 'itch', f), os.path.join(out, f))
    shutil.copy(os.path.join(ROOT, 'assets', 'fonts', 'fredoka.woff2'), os.path.join(out, 'fredoka.woff2'))
    for extra in g.get('copy', []):
        shutil.copy(os.path.join(ROOT, 'play', gid, extra), os.path.join(out, extra))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(WRAPPER.format(id=gid, title=g['title'], bg=g['bg']))
    open(os.path.join(out, 'CREDITS.txt'), 'w', encoding='utf-8').write(CREDITS.format(id=gid, title=g['title'], site=SITE))
    zpath = os.path.join(ROOT, 'itch-builds', gid + '.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(os.listdir(out)):
            z.write(os.path.join(out, f), f)
    files = sorted(os.listdir(out))
    sizes = {f: os.path.getsize(os.path.join(out, f)) for f in files}
    big = max(sizes, key=sizes.get)
    print('%s: %d files, %.1f KB total, largest %s (%.1f KB), zip %.1f KB' % (gid, len(files), sum(sizes.values()) / 1024, big, sizes[big] / 1024, os.path.getsize(zpath) / 1024))


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in GAMES:
        sys.exit('usage: build.py <%s>' % '|'.join(GAMES))
    build(sys.argv[1])
