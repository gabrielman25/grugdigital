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
} Input;

void game_init(uint32_t seed);
void game_update(const Input *in, float dt);
void game_draw(Frame *f);

/* the platform tells the game what it found; the Game Menu lets the player switch */
extern bool  game_hw_ok;      /* the console's own rasterizer answered at boot */
extern bool  game_use_hw;     /* which one to draw with (the platform swaps gfx when this changes) */
extern float game_fps;        /* measured by the platform, shown when the menu's FPS row is on */

/* for the host test harness */
typedef struct GameDebug { float x, y, z, vy, camYaw, camPitch, camDist; int hp, coins; bool grounded, dead, menu; float lastHeight, lastDist; } GameDebug;
void game_debug(GameDebug *d);
void game_teleport(float x, float y, float z, float camYaw);
void game_camera(float yaw, float pitch, float dist);
extern bool game_hide_hud;   /* the cover picture has no HUD */

#endif
