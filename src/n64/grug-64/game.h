/* Grug Baseplate 64: the game, with nothing console-specific in it (n64/main.c and host/main.c both run it). */
#ifndef GRUG64_GAME_H
#define GRUG64_GAME_H

#include <stdint.h>
#include <stdbool.h>
#include "gfx.h"

enum { BTN_A = 0x0001, BTN_B = 0x0002, BTN_Z = 0x0004, BTN_START = 0x0008,
       BTN_CL = 0x0010, BTN_CR = 0x0020, BTN_CU = 0x0040, BTN_CD = 0x0080,
       BTN_L = 0x0100, BTN_R = 0x0200, BTN_DU = 0x0400, BTN_DD = 0x0800, BTN_DL = 0x1000, BTN_DR = 0x2000 };

typedef struct Input {
    float sx, sy;            /* the stick, -1..1 (up is +y) */
    uint16_t held, pressed;  /* BTN_*: down now, went down this frame */
    float cx, cy;            /* the camera stick, -1..1: a second controller's stick on a console, the mouse in the Arcade */
} Input;

void game_slot(const uint8_t *slot, int size);   /* the ROM's outfit slot (outfit.h), before game_init: what you wear, and the test settings. It must stay in memory. */
void game_init(uint32_t seed);
void game_update(const Input *in, float dt);
void game_draw(Frame *f);

/* the platform tells the game what it found; the Game Menu lets the player switch */
extern bool  game_hw_ok;      /* the console's own rasterizer answered at boot */
extern bool  game_use_hw;     /* which one to draw with (the platform swaps gfx when this changes) */
extern bool  game_kbd;        /* played on a keyboard and mouse (the Arcade's page says so): name keys, not controller buttons */
extern float game_fps;        /* measured by the platform, shown when the menu's FPS row is on */
extern uint32_t (*game_clock_us)(void);   /* the platform's clock, if it has one: the FPS row then also shows where a frame's time goes */

/* The numbers a test reads out of a running game. In the Arcade the emulator's memory is the page's to look at, and this
   block is found by its first two words ("GRUG", "STA1", written when the game starts so that they are nowhere in the ROM file). */
typedef struct GameStat {
    uint32_t m0, m1, frames, fps100, parts, polys, ms10[4];      /* ms10: tenths of a millisecond in update, world, characters, HUD */
    uint32_t outfit, stress, sweepAt, sweepDone;                 /* outfit: 1 when the slot's outfit is worn; sweepAt: the step the sweep is on */
    uint32_t sweepFps[32], sweepPolys[32], sweepMs[32];          /* per step: frames a second x 100, polygons, tenths of a ms drawing the world */
} GameStat;
extern GameStat game_stat;
#define SWEEP_COUNTS 7     /* the sweep: the zoo as it is, then 100 to 4000 bricks, each from two places and with studs on and off */

/* for the host test harness */
typedef struct GameDebug { float x, y, z, vy, camYaw, camPitch, camDist; int hp, coins; bool grounded, dead, menu; float lastHeight, lastDist; int parts, stress; bool outfit; } GameDebug;
void game_stress(int bricks);   /* the stress test's world with this many bricks (0: the zoo) */
void game_debug(GameDebug *d);
void game_teleport(float x, float y, float z, float camYaw);
void game_camera(float yaw, float pitch, float dist);
extern bool game_hide_hud;   /* the cover picture has no HUD */

#endif
