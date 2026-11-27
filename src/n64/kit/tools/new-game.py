#!/usr/bin/env python3
"""Start a new Grug Nintendo 64 game.

    python3 src/n64/kit/tools/new-game.py <slug> "<Name>"         e.g.  slide-64 "Slide 999 KM 64"

It makes, from Grug Baseplate 64 (the game every other one starts from):
  src/n64/<slug>/game.c         the game: the same engine, with the starter's one area in place of the zoo's
  src/n64/<slug>/host/main.c    its test script (make check)
  src/n64/<slug>/Makefile       three lines; everything else is ../kit/kit.mk
  src/n64/<slug>/README.md      what to write down about the game
  arcade/<slug>/index.html      the page that plays it (the emulator, the keys beside it, Download ROM)
and prints what is left to do by hand (build it, the cover, the Arcade's list). Nothing in the kit or in another game is
touched. Read src/n64/README.md first: it has the rules a Grug 64 game keeps to (250 parts an area, doors between areas)."""
import os, re, sys

if len(sys.argv) != 3: sys.exit(__doc__)
slug, name = sys.argv[1], sys.argv[2]
if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug): sys.exit('The slug is short, lower case, with hyphens: slide-64')
N64 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')); ROOT = os.path.abspath(os.path.join(N64, '..', '..'))
src, page = os.path.join(N64, slug), os.path.join(ROOT, 'arcade', slug)
if os.path.exists(src) or os.path.exists(os.path.join(page, 'index.html')): sys.exit(f'{slug} is already there (src/n64/{slug} or arcade/{slug}/index.html)')
rom, title = slug if slug.endswith('64') else slug + '-64', re.sub(r'[^A-Z0-9 ]', '', name.upper())[:20].strip()
read = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True); open(path, 'w', encoding='utf-8').write(text); print('  wrote', os.path.relpath(path, ROOT))

# ---- game.c: Grug Baseplate 64's, with the starter's areas between the marks and a header of its own
g = read(N64, 'grug-64', 'game.c')
a, b = g.index('static void build_world(void) {'), g.index("/* ======================================================= END of this game's areas")
if not (g.index("THIS GAME'S AREAS") < a < b): sys.exit("grug-64/game.c no longer has the marks round its areas (THIS GAME'S AREAS ... END): put them back first")
g = g[:a] + read(N64, 'kit', 'starter', 'areas.inc').replace('@NAME@', name.upper()) + g[b:]
head_end = g.index('#include <math.h>')
g = f'''/* =====================================================================================================================
   {name.upper()}: a Grug game for the Nintendo 64, started from Grug Baseplate 64 (src/n64/README.md has the rules).

   WHAT THE GAME IS: write it here: what you do, what the areas are, what was left out of the web game it comes from.

   What every Grug 64 game has is all still here: the classic R6 Humanoid physics (kit/phys.c: walk 16, jump 7.2 studs,
   gravity 196.2, 240 Hz), the dodge roll, the swing and the training dummy, health, damage pads and kill bricks, falling
   apart and respawning, jump pads, lifts, trusses, coins, doors between areas, the orbit camera, the 2010 GUI (HEALTH
   squares, the Game Menu with its stress test), the player voices and the two soft sounds, and the outfit the player
   picked on the site. The game itself is between the marks: THIS GAME'S AREAS.

   No title screen: the game starts straight in play, like every Grug game.
   ===================================================================================================================== */
''' + g[head_end:]
write(os.path.join(src, 'game.c'), g)
write(os.path.join(src, 'host', 'main.c'), read(N64, 'kit', 'starter', 'host-main.c').replace('@NAME@', name))
write(os.path.join(src, 'Makefile'), f'# {name}: a Grug game for the Nintendo 64. Everything a Makefile here can do is in ../kit/kit.mk.\nROM   = {rom}\nTITLE = {title}\ninclude ../kit/kit.mk\n')
write(os.path.join(src, 'README.md'), f'''# {name} (`src/n64/{slug}/`)

A Grug game for the Nintendo 64, built on the kit (`../kit/`, and `../README.md` for how and for the rules). The ROM is
served at `arcade/{slug}/{rom}.z64`; `arcade/{slug}/index.html` plays it.

## What it is

Write it here: what you do in it, and which web game it is a version of.

## Areas and parts

| Area | Parts (goal 250) | What is in it |
| --- | ---: | --- |
| BASEPLATE | | the starter's: replace this |

`make check` prints each area's count. If one goes over 250, say here what in it needs the extra.

## Left out of the web game

List it, so nobody thinks it was forgotten.

## Tested

What `make check` covers, what was played in the Arcade's emulator (frames a second from the Game Menu's FPS row at the
busiest spot, studs on), and what was not tried. A real console has not been tried until someone says it has.
''')

# ---- the page that plays it: Grug Baseplate 64's, renamed
p = read(ROOT, 'arcade', 'grug-64', 'index.html')
for old, new in (('grug-baseplate-64.z64', rom + '.z64'), ('grug-64-grug-arcade.jpg', slug + '-grug-arcade.jpg'), ('Grug Baseplate 64', name), ("slug: 'grug-64'", f"slug: '{slug}'"),
                 ('?id=grug-64', '?id=' + slug), ('/arcade/grug-64/', f'/arcade/{slug}/'), ('src/n64/grug-64', 'src/n64/' + slug)):
    p = p.replace(old, new)
if 'grug-64' in p: print('  NOTE: arcade/%s/index.html still says "grug-64" somewhere: look for it' % slug)
write(os.path.join(page, 'index.html'), p)

print(f'''
Next:
  1. Build the game between the marks in src/n64/{slug}/game.c (THIS GAME'S AREAS). 250 parts an area; more areas and
     doors for a bigger game. Keep host/main.c's checks up with it.
  2. cd src/n64/{slug} && make check          (a PC is enough; pictures land in build/shots/)
  3. export N64_INST=... && make install      (the ROM, copied to arcade/{slug}/{rom}.z64: commit it)
  4. Add the game to GAMES in arcade/arcade.js (copy the grug-64 entry: slug '{slug}', cat 'n64', rom '{rom}.z64') and
     to sitemap.xml.
  5. make cover                               (arcade/{slug}/{slug}-grug-arcade.jpg from the test's "cover" shot), then
     list it in src/seo/images.json and run python3 src/seo/tag_images.py and python3 src/seo/seo_head.py (which also
     writes the new page's title and share card: until then they are Grug Baseplate 64's)
  6. Play arcade/{slug}/ from a local server at the repo root, read the Game Menu's FPS row at the busiest spot, and
     fill in src/n64/{slug}/README.md.''')
