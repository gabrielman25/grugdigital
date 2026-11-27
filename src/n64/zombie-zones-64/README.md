# Zombie Zones 64 (`src/n64/zombie-zones-64/`)

A Grug game for the Nintendo 64, built on the kit (`../kit/`, and `../README.md` for how and for the rules). The ROM is
served at `arcade/zombie-zones-64/zombie-zones-64.z64`; `arcade/zombie-zones-64/index.html` plays it.

## What it is

The Nintendo 64 version of **Zombie Zones** (`arcade/zombie-zones/`), cut down to its heart: the **Supply Run**, for one
player. You are on the Blue team. Zone 1 is a town full of zombies and red supply crates: walk near a crate and it flies
to you (10 at most), take it home through the BLUE BASE door and walk onto your pad to store it. Every crate stored is a
point. The other three teams (White, Orange, Black) play off the screen: their totals climb on the scoreboard at their
own pace. The most supply when the five minutes are up wins; ten seconds later the next round starts, everyone home and
the town restocked.

- **The rifle** (the web game's): 20 a hit, 15 a magazine, a shot every 0.11 s, 85 studs, never runs out. It reloads
  when empty or after 2 s without firing. A shot goes where the camera looks, and hits the zombie nearest that line in
  sight (the web game's aim assist: all the aiming a stick and a 320 x 240 screen allow).
- **The bash**: with a zombie right in front of you, B is a bash instead: 35, and a shove of about 7 studs.
- **Zombies**: Walkers, Runners (faster than you) and Tanks, with the web game's health, damage, reach and swing timing,
  scaled by the area's tier (the web game's `TIER`). They rise away from you, shamble about, come for you within 70
  studs (400 once you have hit one), steer round walls and swing when close. They can't get into your base (its doorways
  are closed to them) and don't go for you in there.
- **Health**: 100, the HUD's five squares are 20 each. It comes back at 6 a second after 4 s without a hit, 40 a second
  in your base. Go down and you drop what you carry (it lies there a minute), then start again at the back of your base.

**No controls in the ROM** (the owner's call): no start-up hints, no Help screen, no line of controls under the Game
Menu. They are all in the play page's sidebar (`KEYS` in `arcade/zombie-zones-64/index.html`, with what each is on an
N64 pad) and in `controls` in the game's `GAMES` entry (`arcade/arcade.js`). Keep those two in step with `game.c`.

## Areas and parts

| Area | Parts (goal 250) | What is in it |
| --- | ---: | --- |
| BLUE SIDE | 68 | your base (walls, the doorways zombies can't pass, the supply pad, flag stand, banners), four houses, six cover blocks, the yellow edge of Zone 1, two doors; 3 slow walkers (tier 1) |
| ZONE 1: OLD TOWN | 99 | two roads and a plaza, 12 roofless houses (2 crates each), 8 cover blocks, 8 crates in the open, two doors; 7 zombies (tier 2, a quarter Runners) |
| ZONE 1: THE MARKET | 115 | the same town plan with 14 houses, market stalls on the plaza, 12 crates in the open; 9 zombies (tier 3: Runners and up to two Tanks) |

Zombies are drawn as six plain boxes (and two eyes up close), not as a textured outfit, so each costs about 6 to 13 boxes
rather than the 40 parts of a dressed character: nine in view came to 467 polygons on the PC build.

## Left out of the web game

The other modes (capture the flag, deathmatch, survival), the other players and the bots (their teams are a score
only), Jumpers and Spitters, the other guns, loot and gun skins, ammo boxes and special rounds, breakable blocks
(the cover blocks are solid), house windows, the quest log, XP and saving, the Voice Lab settings, the trees outside the
walls. The map is smaller: Zone 1 is two areas of 256 x 256 studs instead of one of 424, and the base's side is one area.

Changed: you walk at the kit's 16 studs a second (the web game walks at 24, and the kit's physics are never tuned in a
game), so every zombie's speed is scaled by 16 / 24 to keep the chase the same. The outer walls are 12 studs high, not 20
(fewer pixels to fill). Zombies move on the flat ground with a push out of every wall rather than the full physics: they
don't jump. The rifle's shot is a quieter kit sound (`S_TAP_DENY`, pitched down): the ROM has no gunshot yet, and new
sounds go through `kit/tools/mkaudio.py`. The supply crates are red, as in the web game ("red crates"); they are the one
red thing that isn't danger.

## Tested

- `make check`: all checks pass. The shared physics (jump 7.2, walk 16), every door, a crate pulled in, the rifle
  dropping a walker 30 studs off, the bash (35 and a shove), a walker's swings hurting you and health coming back, a
  zombie getting round a cover block to you, zombies rising in the Market, storing on the pad, a zombie kept out of the
  base, going down (supply dropped, back at the base with full health), the round ending and the next starting, the
  other teams' totals climbing, every area inside the part limit, and the cover shot.
- `kit/tools/play-test.py zombie-zones-64 --outfit starter-racer`: boots in the Arcade's emulator, wears the outfit, sound
  comes out. At the start (the base): **20.9 frames a second** (studs on, headless).
- **The busiest spot, the Market with its zombies up, shooting: 20.4 to 21.4 frames a second** (studs on, headless,
  console time; about 320 polygons, world 33 ms, characters 8 ms, HUD 4 ms). Measured by starting at the page's
  `?view=30,-102,0,0.32,22` (in front of THE MARKET door), walking in and holding fire.
- **Not tried on a real console.**
