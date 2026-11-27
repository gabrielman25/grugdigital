# Grug Baseplate 64 (`src/n64/grug-64/`)

The Grug Baseplate as a real Nintendo 64 ROM: the first game in the Arcade's **Nintendo 64 Games** category, and the
one new Grug 64 games are copied from. The ROM is served at `arcade/grug-64/grug-baseplate-64.z64`;
`arcade/grug-64/index.html` plays it in an emulator and offers it as a download for real hardware. It is built on the
kit: `../README.md` is how to make a game and the rules; `../kit/README.md` is how the engine works and what was measured.

## What it is

A platformer zoo, to prove the idea and to show everything the kit does: jump blocks from 1 to 10 studs, gap jumps, an
obby over a red floor, a damage pad and a kill brick (health, falling apart, respawning), jump pads, a lift, a truss
to climb, a training dummy, coins, a door to a second area, the orbit camera (into first person), the HEALTH squares
and the Game Menu with its stress test, the player voices and the soft sounds. You wear the outfit you play as on the
site.

## Areas and parts

| Area | Parts (goal 250) | What is in it |
| --- | ---: | --- |
| BASEPLATE | 118 | every station, and the door to the Brick Yard |
| BRICK YARD | 34 | a spiral of steps up a tower, a row of blocks, the door back: the example of a second area |

## Left out of the web Baseplate

The other players, seats, the button and door, the blaster, the companion, chat, hair (every character is bald for
now), Pearls and saving.

## Tested

`make check` plays every station on a PC and checks the physics against the web games' numbers, walks through both
doors, and checks both areas against the part limit. In the Arcade's emulator (headless Chrome): about 26 frames a
second at the spawn with studs on, 35 with them off. Not tried on a real console.
