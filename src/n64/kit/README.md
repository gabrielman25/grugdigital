# The Grug 64 kit (`src/n64/kit/`)

What every Grug Nintendo 64 game is built from: the physics, the renderer, the sound, the outfit slot, the console and
PC ends, and the tools. A game is one `game.c` beside it (`../grug-64/` is the first, and the one new games are copied
from). **Start with `../README.md`**: how to start a game and the rules it keeps to. This file is the reference for the
kit itself: how it works, what was measured, and why things are the way they are.

## How it is put together

| File | What |
| --- | --- |
| `phys.c` | The physics: a port of AmbientCore from `arcade/baseplate/index.html` (walk 16, jump 7.2, gravity 196.2, 240 Hz), line for line. |
| `../<game>/game.c` | A game: its areas between the marks (`THIS GAME'S AREAS`), and round them the player, the rig and its animations, the camera, the HUD, the Game Menu, the same in every game. |
| `game.h` | What the console and PC ends ask of a game (`game_init`, `game_update`, `game_draw`), the part limit, the numbers a test reads. |
| `render.c` | The 3D pipeline: the Grug light per face, clipping, projection, boxes that wear pictures, heads. Ends in polygons with a depth. |
| `rast.c` | Those polygons drawn by the CPU (a z-buffered span filler: flat, studded or textured). Works on any emulator. |
| `outfit.c`, `outfit.h` | The outfit slot: what you wear, read from a fixed place in the ROM file. `outfit.h` has the layout. |
| `n64/hw.c` | Those polygons drawn by the console's own rasterizer (libdragon's rdpq). Fast on a real console. |
| `n64/main.c` | The console: picture, controller, sound, clock. Picks `rast.c` or `hw.c` at boot. |
| `ui.c`, `font.h` | Boxes and outlined text, drawn by the CPU on the finished picture. |
| `audio.c`, `sounds.c` | A software mixer and the voice rules from `static/voice.js`; the baked sounds. |
| `host/harness.h` | A game on a PC, driven by the game's own script (`../<game>/host/main.c`), for tests: `make check`. |
| `kit.mk` | The makefile every game includes. |
| `starter/` | What `tools/new-game.py` puts in a new game: one small area and a test script. |
| `tools/` | `setup-toolchain.sh` (libdragon and its compiler, into ~/n64), `new-game.py` (starts a game), `play-test.py` (plays a game's page headless and reports), `mkaudio.py`, `mkfont.py`, `mkcover.py`, `physdiff.cjs`, `mkoutfit.cjs` (the ROM's own outfit), `mkslot.py` (puts the slot in the ROM file). |
| `assets/outfit-default.fit` | The slot the ROM is built with: Grug, from `arcade/outfits/grug.glb`. |
| `../../../static/outfit64.js` | Makes a slot from any saved outfit and writes it into a ROM: used by the Arcade's pages and by `mkoutfit.cjs`. |
| `../boot/` | The boot stage every Grug ROM starts with: libdragon's, patched for the browser emulator. |

Nothing outside `n64/` knows it is on a console, so almost everything is tested on a PC.
Where this file says "the game" and gives numbers, it means Grug Baseplate 64, the game they were measured in.

**One ROM, two ways to draw.** A real console draws with its graphics chip (the RDP), driven by libdragon's own
microcode. Most browser emulators only imitate Nintendo's standard microcodes and can't run that, so the ROM also
carries a software renderer. At boot `n64/hw.c` runs four instructions on the RSP by hand and fills a small surface
with the RDP; only if both really happened does it use the hardware. The Game Menu shows "Drawn by" when both work.
The sound is mixed by the CPU for the same reason. **Hold Z while the console starts** to stay in software and skip
the hardware tests altogether: the way out if the hardware path ever misbehaves.

## What has been tested, and what has not

- **Tested:** the game logic and the software renderer on a PC (`host/`), the physics against the site's own, and the
  ROM itself in the Arcade's emulator through the play page in headless Chrome: it boots, draws, takes
  the keyboard and the mouse's camera stick, sound comes out (measured at the emulator's output, not listened to),
  it reads its outfit slot from the cartridge, and it wears another saved outfit when the page writes one in.
- **Not tested: anything on a real console.** That means the hardware drawing path (`n64/hw.c`: the browser emulator
  has no low-level RSP or RDP, so the ROM always chooses software there), the boot stage on real memory chips
  (`../boot/README.md`), the audio driver, a second controller as the camera stick, the sound to the ear, and the speed. Test in ares (https://ares-emu.net, an accurate
  emulator) first, then on a console. If the picture is wrong, hold Z at start and tell us what "Drawn by" said.

## In the browser

The Arcade's emulator (EmulatorJS's mupen64plus-next core) is why three things are the way they are:

- **The boot stage is patched** (`../boot/`): a stock libdragon ROM does not boot in that core.
- **Everything is drawn in software there**, on an interpreted CPU. `rast.c` is written for that: edges stepped in
  fixed point, no library calls per polygon, the baseplate's top painted with no depth work, panels dimmed two pixels
  at a time. The FPS row in the Game Menu shows where a frame's time goes (game, world, you, HUD).
- **The page sets the core's `CountPerOp` to 1** (`OPTIONS` in the play page). The core paces an unknown ROM's CPU at 2
  counts an instruction, which is half speed for this game: about 19 frames a second in the console's own time, against
  about 35 at 1 (with studs off; about 26 with them on). It costs the visitor's computer more; on one that can't keep up the game runs slow rather than
  dropping frames. `?cpo=2` on the play page puts the core's default back to compare, `?oc=1` overclocks further.
  EmulatorJS only passes saved settings to the core at start-up, so the page seeds them (see the comment there).

## Building

In a game's folder (`../grug-64/`, say). `kit.mk` has the full list.

```sh
make check                                  # the PC build (needs only a C compiler), the game's test script (pictures in
                                            # build/shots/, the sound in audio.wav), and phys.c against the site's own
export N64_INST=~/n64/toolchain/opt/libdragon   # the ROM: needs libdragon and its MIPS toolchain (tools/setup-toolchain.sh)
make install                                # builds the ROM and copies it to arcade/<game>/
make cover                                  # the Arcade's cover from the test's "cover" shot
```

A ROM is built on Grug's patched boot stage, `../boot/ipl3_dev_grug.z64` (`make N64_ROM_HEADER=` uses libdragon's own).
Grug Baseplate 64 was last built with libdragon trunk at `e356bf3` and GCC 16.2 (what `tools/setup-toolchain.sh` sets
up; change the commit there when moving to a newer libdragon). The ROM file carries the build folder's path in its debug
names, so a build from another folder differs in those bytes only. After a build, open `/arcade/grug-64/` from a local
server at the repo root and play it: the page is the test.

`make assets` re-bakes `sounds.c` / `sounds.h`, `font.h` and `assets/outfit-default.fit` (needs node). Run it after the
owner sends new Voice Lab numbers (`static/voice.js`, `static/sfx.js`), new voice clips or a new look for Grug, then
rebuild the ROM.

`make` ends with `tools/mkslot.py`: the ROM file is padded to 1 MB and the 128 KB outfit slot goes after it, so the
file is 1,179,648 bytes whatever the program's size (until the program passes 1 MB: the tool says so).

## The sounds, squeezed

`tools/mkaudio.py` reads the tuning straight out of `static/voice.js` and `static/sfx.js` (it runs them in node), so the
ROM follows the Voice Lab. The 15 voice mp3s become 22 clips (one per action and clip, time-stretched with the same
WSOLA as `voice.js` to the middle of the action's speed range, so the game only has to bend the pitch), the tap and
thud are rendered from `sfx.js`, and the jump, footsteps and synth sounds come from the Baseplate. Everything is mono,
22.05 kHz, 4-bit IMA ADPCM: about 150 KB for 14 seconds, decoded into RAM at boot.

## Keeping the physics honest

`phys.c` must stay the same physics as the web games. `tools/physdiff.cjs` cuts AmbientCore out of
`arcade/baseplate/index.html`, runs it and the C port on the same 22 scripted scenarios, and compares positions every
frame (they agree to a thousandth of a stud). If the Baseplate's physics change, change `phys.c` and run it again.

One thing it turned up: the web Baseplate's sign says an 8 stud block is too high. Its physics disagree: a jump lifts
the feet 7.2 studs and R6 legs don't collide, so the torso clears anything up to 9.2. This game's blocks go to 10 and
say so.

## Controls

| Console | Keyboard and mouse (in the Arcade) | |
| --- | --- | --- |
| Control Stick | W A S D | Move |
| A | Space | Jump (hold to keep hopping) |
| Z | Shift | Dodge roll, in the air too |
| B | F, or a click | Swing |
| A second controller's Control Stick | The mouse (click the game to lock it, Esc lets go) | Look around, as far and as fast as you push |
| C buttons | Arrows, or Q / E | Turn and tilt the camera |
| R / L | The wheel, or I / O | Zoom in / out |
| START | Enter | Game Menu |

**The camera stick.** The ROM turns its camera by how far the stick of the controller in **port 2** is pushed
(`CAM_STICK` in `game.c`: 6 radians a second right over). On a console that is a second controller held as a camera
stick; the C buttons still work without one. In the Arcade the page drives that stick from the mouse: every movement
adds to what is still to be turned, and each frame the stick is pushed just hard enough to turn it away (`the mouse` in
`arcade/grug-64/index.html`; its `CAM_STICK` must match). That is why the core's stick dead zone is set to 0 there.

**Keys or buttons in the game's own words.** The page holds L + R + Z on the controller in port 4; the ROM takes that
to mean a keyboard (`game_kbd`) and names keys in its hints, its signs, its Help and under the Game Menu. `KB(n64, kbd)`
in `game.c` picks the wording. Not on a phone, where EmulatorJS shows its own N64 pad.

The keyboard column is `KEYS` in `arcade/grug-64/index.html`; keep it, `controls` in `arcade/arcade.js` and the Help
text in `game.c` in step.

## Studs

Studded tops as on the web (one stud every 2 studs of width, whole studs edge to edge, lit from the sun's side), without
a texture unit: the camera never rolls, so along a screen row a level face moves through the stud grid in a straight
line at a steady pace (`r_row` in `render.c`), and each pixel is one lookup in a 16 x 16 pattern (`rast.c`). A crisp rim
up close, soft half-moons further off, plain beyond. Parts get them with `PF_STUDS` (`part()` gives it to everything
but thin things on the ground).

They are not free. In the browser about two thirds of the screen is studded ground: roughly **26 frames a second with
them against 35 without** (console time, `CountPerOp` 1). So the baseplate looks the pattern up once per two pixels,
and the Game Menu has **Studs: On / Off (faster)**. The hardware path (`n64/hw.c`) draws plain tops for now.

## What you wear: the outfit slot

The character is the site's R6 rig, and what it wears comes from **one 128 KB block at a fixed place in the ROM file**
(1 MB in; `outfit.h` has the layout). The ROM reads it from the cartridge when it starts (`read_slot` in `n64/main.c`)
and wears what it finds; with no valid slot it falls back to plain colours.

- **The handshake.** `assets/outfit-default.fit` (Grug) is in every ROM file on the site. Before the game starts, the Arcade's
  page reads the outfit the player plays as (`GrugOutfits`, the same store every Grug game dresses you from), makes a
  slot from its `.glb` and writes it over Grug's in a copy of the ROM in the tab (`GrugOutfit64.wear` in
  `static/outfit64.js`). The emulator plays that copy, and the **Download ROM** buttons hand out the same copy,
  so a real console gets the outfit too. No outfit is shipped in the ROM but the default; nothing is sent anywhere.
- **Body.** Torso, arms and legs are boxes; each face's picture is cut out of the outfit's own textures by reading the
  `.glb`'s mesh (no template is assumed) into a 256 x 160 atlas with 256 colours: 64 texels across a torso, half the
  studio's detail. Torso and arms use the shirt's atlas, legs the pants'. Each atlas has two smaller copies, and a
  face picks the copy that suits its distance (`tex_level`), so a far-off character doesn't shimmer.
- **Head.** The studio's head is 512 smooth triangles with the hair merged in. The hair is left out (it is told apart
  by where it sits in the texture) and the head is measured again as **up to 9 rings of 8 points**, the last the crown: rays from its axis
  find how wide it is at each height and angle, and the rings that hold the shape best are kept. About 100 triangles,
  any head shape and size, and no list of shapes in the ROM. The face is the front half of the head's texture,
  128 x 80, on the four faces either side of the nose.
- **No hair, and no light on characters.** Every character is bald for now: the head runs smoothly up to a point at
  the crown. And characters are drawn unlit (`CHAR_HOW` in a game's `game.c`): every face in its own colour whichever
  way it points. Lit, each flat face of a head and each side of a limb is another shade, which at this size reads as
  facets; unlit, a head is one smooth shape. The pictures have their own painted shading. `R_LIT` puts the light back.
- **Drawing.** `r_obox_tex` and `r_head` (`render.c`) hand `rast.c` a face and three lines across the screen that say
  where the picture lies on it; the span filler works the picture out exactly at both ends of every 32 pixels and
  steps straight in between. When they are lit (`R_LIT`), pictures are lit per face like flat colours, from 32 ready-made palettes each.
  **The hardware path draws one colour a face for now** (`hw_tex` in `n64/hw.c`).
- **Checking it.** `./build/host/game-host OUT [SLOT]` wears a slot on the PC build (in Grug Baseplate 64, shots 20 to
  25 are the outfit close up). `node ../kit/tools/mkoutfit.cjs some.glb Name out.fit --pictures DIR` makes a slot from any character file and
  writes its atlases as pictures.

Change the layout in `outfit64.js` and `outfit.c` / `outfit.h` together, bump the version in both, and re-run
`make assets`: a ROM ignores a slot of another version, and the page refuses to write into one.

## The stress test: how many bricks?

Game Menu, **Stress test**: the zoo is swapped for a world of bricks (4 x 4 studs, 1 to 6 tall, studded, solid, spread
evenly over the plate; past 900 they stack) and the FPS row comes on. Each press is more: 100, 250, 500, 1000, 2000,
4000. `?stress=500` on the play page starts there, and `?stress=sweep` runs every count from two places with studs on
and off and leaves the results in `game_stat`, which a test reads out of the emulator's memory (`GameStat` in `game.h`).

Measured in the Arcade's emulator (software renderer, `CountPerOp` 1, frames a second in the console's own time):

| Bricks on the plate | From the spawn, studs on | studs off | From high above, studs on | studs off |
| ---: | ---: | ---: | ---: | ---: |
| the zoo (114 parts) | 26 | 35 | 33 | 36 |
| 100 | 32 | 48 | 38 | 45 |
| 250 | 26 | 35 | 26 | 29 |
| 500 | 20 | 25 | 17 | 18 |
| 1000 | 13 | 16 | 10 | 10 |
| 2000 | 8 | 9 | 6 | 6 |
| 4000 | 5 | 5 | 3 | 3 |

- **What it costs is what is on the screen.** A frame costs about 20 ms before any brick (sky and baseplate, you, the
  HUD) and then about 45 microseconds for every polygon drawn, and a brick in view is two or three. Bricks out of view
  cost almost nothing to draw (a few comparisons each).
- **So, in the browser:** a place the size of the zoo (100 to 250 parts) plays at the zoo's speed; 500 parts is about
  20 frames a second; past 1000 it is a slideshow. A bigger world is fine if most of it is out of sight at any moment.
- **So an area of a game has 250 parts** (`PART_GOAL` in `game.h`; `PART_LIMIT`, 300, is where parts start being left
  out), and a bigger game is several areas joined by doors (`../README.md`).
- **Other ceilings, all far off:** the part table is 4224 for the stress test (68 bytes a part; the console's 4 MB would hold
  tens of thousands); the physics looks at the 192 parts nearest you (`NEAR_MAX`: more than that within about 20 studs
  and some are missed); raycasts for the camera and the shadows touch every part, about 1 ms a frame per 1000.
- **A real console is another question.** There the graphics chip draws, not the CPU. That path has never been run
  (see above), so there is no number for it yet.

## Sound on the console

`n64/main.c` queues its own buffers on the audio interface (`snd_feed`, from the audio interrupt) rather than using
libdragon's audio queue, for two reasons found the hard way: with a fill callback libdragon never queues the first
buffer, so there is silence; and it gives the hardware the buffer's uncached address (`0xA0......`), which a console
masks to 24 bits and the browser emulator's core does not: it indexes memory with it and crashes. Keep the address
physical.
