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
| `../boot/` | The boot stage every Grug ROM starts with: libdragon's, patched for the browser emulator. |

Nothing outside `n64/` knows it is on a console, so almost everything is tested on a PC.

**One ROM, two ways to draw.** A real console draws with its graphics chip (the RDP), driven by libdragon's own
microcode. Most browser emulators only imitate Nintendo's standard microcodes and can't run that, so the ROM also
carries a software renderer. At boot `n64/hw.c` runs four instructions on the RSP by hand and fills a small surface
with the RDP; only if both really happened does it use the hardware. The Game Menu shows "Drawn by" when both work.
The sound is mixed by the CPU for the same reason. **Hold Z while the console starts** to stay in software and skip
the hardware tests altogether: the way out if the hardware path ever misbehaves.

## What has been tested, and what has not

- **Tested:** the game logic and the software renderer on a PC (`host/`), the physics against the site's own, and the
  ROM itself in the Arcade's emulator through `arcade/grug-64/index.html` in headless Chrome: it boots, draws, takes
  the keyboard and the mouse's camera stick, and sound comes out (measured at the emulator's output, not listened to).
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
  about 38 at 1 (with studs off; about 24 with them on). It costs the visitor's computer more; on one that can't keep up the game runs slow rather than
  dropping frames. `?cpo=2` on the play page puts the core's default back to compare, `?oc=1` overclocks further.
  EmulatorJS only passes saved settings to the core at start-up, so the page seeds them (see the comment there).

## Building

```sh
make host                                   # the PC build: needs only a C compiler
./build/host/grug64-host /tmp/g64           # plays a script: writes pictures and audio.wav, checks the physics
node tools/physdiff.cjs                     # phys.c against the site's own AmbientCore, frame by frame

export N64_INST=/path/to/libdragon          # the ROM: needs libdragon (https://libdragon.dev) and its MIPS toolchain
make install                                # builds grug-baseplate-64.z64 and copies it to arcade/grug-64/
```

The ROM is built on Grug's patched boot stage, `../boot/ipl3_dev_grug.z64` (`make N64_ROM_HEADER=` uses libdragon's own).
It was last built with libdragon trunk at `e356bf3` and GCC 16.2. After a build, open `/arcade/grug-64/` from a local
server at the repo root and play it: the page is the test.

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

They are not free. In the browser about two thirds of the screen is studded ground: roughly **24 frames a second with
them against 38 without** (console time, `CountPerOp` 1). So the baseplate looks the pattern up once per two pixels,
and the Game Menu has **Studs: On / Off (faster)**. The hardware path (`n64/hw.c`) draws plain tops for now.

## Sound on the console

`n64/main.c` queues its own buffers on the audio interface (`snd_feed`, from the audio interrupt) rather than using
libdragon's audio queue, for two reasons found the hard way: with a fill callback libdragon never queues the first
buffer, so there is silence; and it gives the hardware the buffer's uncached address (`0xA0......`), which a console
masks to 24 bits and the browser emulator's core does not: it indexes memory with it and crashes. Keep the address
physical.
