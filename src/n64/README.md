# Grug games for the Nintendo 64 (`src/n64/`): start here

Real Nintendo 64 ROMs, written in C, that play in the Arcade in an emulator and on a real console. The plan is a simple
N64 version of each of the site's games, and in time for those to be the main ones. This is how to make one, and the
rules it keeps to. (`kit/README.md` is the reference for the engine: how it works and what was measured.)

| Folder | What |
| --- | --- |
| `kit/` | What every game is built from: physics, renderer, sound, outfit slot, console and PC ends, tools. Shared: a fix there reaches every game at its next build. |
| `grug-64/` | **Grug Baseplate 64**, the first game: a zoo of everything the kit does, in two areas. New games are copied from it. |
| `<slug>/` | A game: `game.c`, its test script `host/main.c`, a three-line `Makefile`, a `README.md`. |
| `boot/` | The boot stage every ROM starts with (libdragon's, patched for the browser emulator). Leave it alone. |

## Starting a game

```sh
bash src/n64/kit/tools/setup-toolchain.sh                           # once: the console's compiler and libdragon, into ~/n64
python3 src/n64/kit/tools/new-game.py slide-64 "Slide 999 KM 64"    # makes src/n64/slide-64/ and arcade/slide-64/index.html
cd src/n64/slide-64
make check                                   # builds it for a PC, plays its test script, writes pictures to build/shots/
export N64_INST=~/n64/toolchain/opt/libdragon && make install   # the ROM, into arcade/slide-64/ (commit it: it isn't built on deploy)
python3 ../kit/tools/play-test.py slide-64   # plays the real page in the Arcade's emulator, headless, and reports
```

The script prints what is left to do by hand (the Arcade's list, the cover). What you get is the whole of Grug
Baseplate 64 with one small area in place of the zoo: it already runs, and already has everything in the table below.
**The game is what you write between the two marks in `game.c`** (`THIS GAME'S AREAS` ... `END`): a function that
builds each area out of parts. Outside the marks is the same in every game; change it only for something the game
really needs, and if it would help every game, change `grug-64/game.c` too so the next game starts with it.

## Porting a game from the site: step by step

This is what to do when asked to "make a Nintendo 64 version of <a game on the site>". Work on a branch, as always.

1. **Set up the tools.** `make check` needs only a C compiler. Building the ROM needs libdragon and its MIPS
   toolchain: `bash src/n64/kit/tools/setup-toolchain.sh` puts both in `~/n64` (no root, about a minute) and prints the
   `export N64_INST=...` line. It downloads about 105 MB from GitHub (libdragon's own releases and source), so **ask the
   owner before running it** the first time in a session. The headless play test needs `pip install playwright` and
   Chrome (the cloud sessions have both).
2. **Read the web game.** It is one file, `arcade/<slug>/index.html`, built on the same engine as the Baseplate. Find
   (a) how its world is built: the `part(...)` / `addPart` calls, the map or level functions, the sizes and colours;
   (b) the one thing you do in it: the loop of play, how you win or score; (c) what else it has (enemies, vehicles,
   shops, rounds). Its entry in `GAMES` (`arcade/arcade.js`) and its section in `arcade/claude.md` or `CLAUDE.md` say
   what it is for. Play it if you can (serve the repo root, open `/arcade/<slug>/`).
3. **Plan it on paper before building.** Write in the new game's README: the heart you are keeping, what you are
   leaving out (and why), and the areas with a rough part count each. A web map bigger than 250 parts becomes several
   areas joined by doors: its spawn or lobby, then a door to each region or level. Count the doors (4 parts each) and
   every character on screen (40 each) in the area's 250.
4. **Start it.** `python3 src/n64/kit/tools/new-game.py <slug>-64 "<Name> 64"` (the slug and name of the web game
   with 64 on the end, so the two can live side by side in the Arcade). It runs straight away.
5. **Build the world, area by area**, between the marks in `game.c` (`THIS GAME'S AREAS`). Copy sizes and colours
   from the web game, then merge and drop parts until each area is under 250. `make check` after each area: it prints
   the counts, and a picture of each shot lands in `build/shots/` (look at them: the Read tool shows a `.ppm` once it is
   converted, `python3 -c "from PIL import Image; Image.open('x.ppm').save('x.png')"`).
6. **Add the game's own rules** (a score, a timer, a goal, a simple enemy) in `game.c`, outside the marks if they
   need code: `game_update` is where everything moves, `draw_hud` the 2010 GUI, `station(...)` the bar along the
   bottom. Copy how the zoo does a thing before inventing a new way (the dummy is an enemy that doesn't move; the lift
   is anything that does). Any text that names a control needs both wordings (`KB(...)`). If something would help every
   game (an enemy that walks, a timer on the HUD), put it in the kit and in `grug-64/game.c`, and say so in the commit.
7. **Check what it does.** Add checks to `host/main.c` for the game's own rules (can each area be reached, does the
   goal count, does each door lead where it should), plus a shot called `cover`. `make check` must say
   "all checks passed".
8. **Build the ROM and play it.** `make install`, then
   `python3 src/n64/kit/tools/play-test.py <slug>-64 --outfit starter-racer`: it plays the real page in the Arcade's
   emulator and prints frames a second, polygons, parts, whether the outfit was worn and whether sound came out. Stand
   in the busiest spot (`?view=x,z,turn,tilt,distance` on the page starts you there) and aim for 20 frames a second or
   better. Write the number in the README.
9. **Put it in the Arcade.** Its `GAMES` entry in `arcade/arcade.js` (copy `grug-64`'s: `cat: 'n64'`, `rom`, the
   `controls` list, a `tag`, an `about` that says it is the Nintendo 64 version of the web game), `sitemap.xml`, the
   cover (`make cover`, then `src/seo/images.json`, `python3 src/seo/tag_images.py`, `python3 src/seo/seo_head.py`).
   It lands in the experimental section with its warning on its own.
10. **Push the branch and send the owner the preview link** to the play page (`/arcade/<slug>-64/`), with what was
    kept, what was left out, the frames a second, and that it has not been tried on a real console.

### What the kit doesn't have yet

Enemies that walk and chase, other players or NPCs that move, projectiles, vehicles, pets, shops, saving, multiplayer.
A port that needs one of these builds a simple version in its `game.c` (an enemy is a few boxes drawn with
`draw_rig` that moves towards you and calls the damage code the kill brick uses). Keep it small, and say in the
README what it does and doesn't do. Saving and Pearls stay out of ROMs.

### A prompt the owner can use

> Make a Nintendo 64 version of <game> from the Grug site. Follow "Porting a game from the site" in src/n64/README.md
> step by step. You may run the toolchain setup. Push a branch and send me the preview link.

## What is already there (don't rebuild it)

| In a web game (the Starter) | In a Grug 64 game |
| --- | --- |
| `part(cx, cy, cz, sx, sy, sz, color, o)` | `part(cx, cy, cz, sx, sy, sz, 0xRRGGBB)`: solid, studs on top. `deco(...)`: nothing to bump into. |
| kinds: kill, pad, ladder | `world_add(&W, ..., K_KILL / K_PAD / K_LADDER, flags)`: copy a line from the zoo (the kill brick, the jump pads, the truss). |
| a moving platform | a part with `PF_DYNAMIC` and a speed (`lift` and `update_lift`). Up to 16 an area. |
| AmbientCore (walk 16, jump 7.2, 240 Hz) | `kit/phys.c`: the same physics, checked line against line. Never tune it in a game. |
| the rig, walk / jump / roll / swing, falling apart | the same, in every game. |
| the player's saved outfit (`GrugOutfitRig`) | worn automatically: the page writes it into the ROM (shirt, pants, face, head shape). Bald, and unlit, for now. |
| `Voice.say(who, line)`, `Snd.play(name)` | `aud_say(VE_JUMP ...)`, `aud_play(S_COIN ...)`, `aud_tap(...)`: the same clips and rules, baked into the kit. |
| HEALTH squares, damage numbers, BillboardGuis | the stats panel, `dmg_add`, `bill(line, small line, x, y, z, range)`. |
| the hint bar, a place's name | `station(name, line, line for a keyboard, x, z, half width, half depth, sign height)`: the bar along the bottom. |
| the Game Menu | the same rows in every game (Resume, Reset, Voices, pitch, Studs, FPS, Stress test, Help). |
| coins, a damage pad, a finish, a training dummy | `coin(x, y, z)`, `hurtPad = part(...)`, `finish = part(...)`, `dummyAt`. |
| another map, a lobby, a level | **an area**, and a `door(...)` to it (below). |
| Pearls, saving, chat, the other players | not on a console yet: leave them out, and say so in the game's README. |

Any text that names a control needs both wordings, `KB("A: jump", "Space: jump")`: in the Arcade the player has a
keyboard and a mouse.

## The rules

They are about speed. In the Arcade the ROM draws every pixel on an emulated CPU, and what it costs is what is on the
screen: about 20 ms a frame before anything is drawn, then about 45 microseconds a polygon. The numbers behind each
rule are in `kit/README.md` ("The stress test").

1. **250 parts an area.** That is the goal (`PART_GOAL`), and it is what plays at the speed of Grug Baseplate 64. A few
   more are allowed when something that has to be there needs them (a model that takes 30 parts, say): up to 300
   (`PART_LIMIT`), and past that parts are left out and the test fails. `make check` prints every area's count; if one
   is over 250, say what needs the extra in the game's README.
2. **A big game is several areas, not one big one.** Each area is a world of its own with its own 250 parts, built when
   you walk in: only the one you are in is in memory or on screen. Join them with **doors**:
   `door(x, z, alongX, "THE CAVE", area, arriveX, arriveZ, facing)` is a doorway (4 parts) you walk into. A lobby with a
   door for each level, rooms off a corridor, a course in stages: split it wherever a web game would have you walk a
   long way. Put the door back beside where you arrive, not behind it (the camera sits 22 studs behind you). The zoo's
   Brick Yard is the example.
3. **Make one part do the work of several.** One long wall, not a row of bricks; one slab, not tiles. Leave out
   anything under a stud across: it is a pixel or two on a 320 x 240 screen. Count what an idea costs before building it.
4. **Keep what can be seen at once small.** A part out of view costs almost nothing, so a wall or a tower between two
   busy places is worth its parts. An open field of 250 parts all in view is the slow case: test from there.
5. **A character costs about as much as 40 parts.** The player is always there. Count each other character on screen
   against the area's 250.
6. **Studs only where they show.** `part()` puts them on tops you can stand on. Thin things on the ground, far-off
   scenery and tiny tops stay plain (`deco`, or clear `PF_STUDS`). About a quarter of a frame is studs.
7. **Flat colours.** No see-through parts, no pictures on the world (pictures are for characters), no particles. The
   blob shadow is the only thing that blends.
8. **Keep the HUD as it is.** The panel, the bar and a few signs cost 4 to 5 ms already. Write a line of text only when
   it changes (`snprintf` into a `static` buffer), never every frame.
9. **Fixed memory.** Static arrays with a count, as the kit does. No `malloc` in a game, and no new sounds without
   `kit/tools/mkaudio.py` (the ROM has about 150 KB of them, shared by every game).
10. **Measure, then say what you measured.** Play it in the Arcade's emulator (`kit/tools/play-test.py`), stand in the busiest spot with studs on, and read the Game Menu's FPS row: aim for 20 frames a second or
    better there, and put the number in the game's README. `?stress=500` on the play page shows what more parts would
    cost on the same machine.

Simpler is the point. Port the heart of the web game (the one thing you do in it), not every feature: fewer enemies,
one mode, smaller maps, areas instead of distance.

## Checking a game

- `make check`: the game's own script (`host/main.c`: `run`, `shot`, `check`, see `kit/host/harness.h`), every area
  against the part limit, and the physics against the site's own. Add checks for what your game adds (can the course be
  finished, does each door lead where it should).
- Then the real thing: serve the repo root, open `arcade/<slug>/`, press Play. The Arcade's rules still hold inside a
  ROM: no title screen, the 2010 GUI, red means danger and only danger is red, a Game Menu.
- Nobody has run a Grug ROM on a real console yet. Say "not tried on a console" until someone has.
