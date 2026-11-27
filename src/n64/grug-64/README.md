# Grug Baseplate 64 (`src/n64/grug-64/`)

The Grug Baseplate as a real Nintendo 64 ROM: the first game in the Arcade's **Nintendo 64 Games** category. The ROM is
served at `arcade/grug-64/grug-baseplate-64.z64`; `arcade/grug-64/index.html` plays it in an emulator and offers it as
a download for real hardware. See CLAUDE.md, "Nintendo 64 games".

## What is in it

A platformer zoo, to prove the idea: jump blocks from 1 to 10 studs, gap jumps, an obby over a red floor, a damage pad
and a kill brick (health, falling apart, respawning), jump pads, a lift, a truss to climb, a training dummy, coins,
the orbit camera (into first person), the HEALTH squares and the Game Menu, the player voices and the soft sounds.
Left for later: the other players, seats, the button and door, the blaster, saved outfits (you play as Grug), saving.

## How it is put together

| File | What |
| --- | --- |
| `phys.c` | The physics: a port of AmbientCore from `arcade/baseplate/index.html` (walk 16, jump 7.2, gravity 196.2, 240 Hz), line for line. |
| `game.c` | The world (`build_world`), the player, the rig and its animations, the camera, the HUD, the Game Menu. |
| `render.c` | The 3D pipeline: the Grug light per face, clipping, projection. Ends in flat polygons with a depth. |
| `rast.c` | Those polygons drawn by the CPU (a z-buffered span filler). Works on any emulator. |
| `n64/hw.c` | Those polygons drawn by the console's own rasterizer (libdragon's rdpq). Fast on a real console. |
| `n64/main.c` | The console: picture, controller, sound, clock. Picks `rast.c` or `hw.c` at boot. |
| `ui.c`, `font.h` | Boxes and outlined text, drawn by the CPU on the finished picture. |
| `audio.c`, `sounds.c` | A software mixer and the voice rules from `static/voice.js`; the baked sounds. |
| `host/` | The same game on a PC, driven by a script, for tests. |
| `tools/` | `mkaudio.py`, `mkfont.py`, `mkcover.py`, `physdiff.cjs`. |

Nothing outside `n64/` knows it is on a console, so almost everything is tested on a PC.

**One ROM, two ways to draw.** A real console draws with its graphics chip (the RDP), driven by libdragon's own
microcode. Most browser emulators only imitate Nintendo's standard microcodes and can't run that, so the ROM also
carries a software renderer. At boot `n64/hw.c` runs four instructions on the RSP by hand and fills a small surface
with the RDP; only if both really happened does it use the hardware. The Game Menu shows "Drawn by" when both work.
The sound is mixed by the CPU for the same reason.

## Building

```sh
make host                                   # the PC build: needs only a C compiler
./build/host/grug64-host /tmp/g64           # plays a script: writes pictures and audio.wav, checks the physics
node tools/physdiff.cjs                     # phys.c against the site's own AmbientCore, frame by frame

export N64_INST=/path/to/libdragon          # the ROM: needs libdragon (https://libdragon.dev) and its MIPS toolchain
make install                                # builds grug-baseplate-64.z64 and copies it to arcade/grug-64/
```

`make assets` re-bakes `sounds.c` / `sounds.h` and `font.h`. Run it after the owner sends new Voice Lab numbers
(`static/voice.js`, `static/sfx.js`) or new voice clips, then rebuild the ROM.

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

| Console | Keyboard (in the Arcade) | |
| --- | --- | --- |
| Control Stick | W A S D | Move |
| A | Space | Jump (hold to keep hopping) |
| Z | Shift | Dodge roll, in the air too |
| B | F | Swing |
| C left / right | Q / E | Turn the camera |
| C up / down | Up / Down | Tilt the camera |
| R / L | I / O | Zoom in / out |
| START | Enter | Game Menu |

The keyboard column is `KEYS` in `arcade/grug-64/index.html`; keep it, `controls` in `arcade/arcade.js` and the Help
text in `game.c` in step.
