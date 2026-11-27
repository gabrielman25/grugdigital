/* Grug 64: the physics of a classic R6 Humanoid on a Baseplate.
 *
 * A straight port of AmbientCore (the <script id="ambient-npc"> block in arcade/baseplate/index.html): the same
 * numbers, the same order of operations, the same fixed 240 Hz step. Everything is in studs and seconds.
 * If the Baseplate's physics change, change this file to match (CFG, BODY and phys_step_character).
 */
#ifndef GRUG64_PHYS_H
#define GRUG64_PHYS_H

#include <stdint.h>
#include <stdbool.h>

/* ---- settings shared by every character (Humanoid + Workspace): CFG in AmbientCore */
#define CFG_GRAVITY      196.2f
#define CFG_WALKSPEED    16.0f
#define CFG_JUMPHEIGHT   7.2f
#define CFG_ACCEL        40.0f
#define CFG_STEPRISE     40.0f
#define CFG_SNAPDOWN     0.35f
#define CFG_CLIMBSPEED   14.0f
#define CFG_FALLEN_Y     (-200.0f)
#define PHYS_RATE        240

/* ---- R6, measured from the HumanoidRootPart (torso centre): BODY in AmbientCore */
#define BODY_ROOT_TO_FEET         3.0f
#define BODY_ROOT_TO_TORSO_BOTTOM 1.0f
#define BODY_ROOT_TO_HEAD_TOP     2.2f
#define BODY_RADIUS               1.0f
#define BODY_FLOOR_RADIUS         0.8f

enum { K_SOLID = 0, K_KILL, K_PAD, K_LADDER, K_BUTTON };

/* part flags */
#define PF_COLLIDE  0x01   /* characters stand on it and bump into it */
#define PF_DYNAMIC  0x02   /* it moves (vx, vy, vz): lifts and moving platforms */
#define PF_NOCAM    0x04   /* the camera looks straight through it */
#define PF_HIDDEN   0x08   /* in the physics world, never drawn */
#define PF_FLAT     0x10   /* a thin thing lying on the ground: drawn right after the baseplate (see render.c) */
#define PF_DECO     0x20   /* drawn, but not in the physics world */

typedef struct Part {
    float minX, maxX, minY, maxY, minZ, maxZ;
    float vx, vy, vz;            /* dynamic parts */
    float power;                 /* pads */
    float nx, nz, fx, fz, hw;    /* ladders: unit normal pointing into the wall, a point on the wall, half width */
    uint32_t color;              /* 0xRRGGBB */
    uint8_t kind, flags;
    uint16_t tag;                /* what the game calls it (T_HURT, T_LIFT, ...) */
} Part;

/* events a character raised this frame (ch.events in AmbientCore) */
#define EV_JUMP      0x001
#define EV_LAND      0x002
#define EV_LANDHARD  0x004
#define EV_PAD       0x008
#define EV_DIED      0x010
#define EV_RESPAWN   0x020
#define EV_GRAB      0x040

#define NEAR_MAX 64

typedef struct Character {
    float x, y, z, vx, vy, vz;
    float faceYaw;
    bool grounded, rising, dead, climbing, pj;
    float cd, deadT, padT, ladCd;
    const Part *ground, *ladder;
    float lockX, lockZ; int climbDir;
    double dashT;                /* (a double, like the site's: the roll ends on a rounding edge, and it has to end on the same step) */
    float dashVx, dashVz;
    float spawnX, spawnY, spawnZ;
    /* input: world move direction (length <= 1) and jump (held) */
    float mx, mz; bool jump;
    /* the jump being measured, and the last one that landed */
    bool jumping; float jStartY, jPeak, jT, jSx, jSz;
    bool hasLast; float lastHeight, lastAir, lastDist;
    uint32_t events;
    const Part *near[NEAR_MAX]; int nNear;
} Character;

typedef struct World {
    Part *parts; int n, cap;
} World;

void  world_init(World *w, Part *storage, int cap);
Part *world_add(World *w, float cx, float cy, float cz, float sx, float sy, float sz, uint32_t color, uint8_t kind, uint8_t flags);
void  world_move_dynamic(World *w, float dt);
/* first collidable part hit by a ray (slab test). Returns the distance (maxT if nothing) and the part in *hit. skip: flags to ignore */
float world_raycast(const World *w, float ox, float oy, float oz, float dx, float dy, float dz, float maxT, uint8_t skipFlags, const Part **hit);

void  char_init(Character *ch, float x, float y, float z, float yaw);
void  char_respawn(Character *ch);
void  char_kill(Character *ch);
float phys_jump_velocity(void);
/* step one character by dt seconds of real time at the fixed rate; returns the number of substeps run */
int   phys_step(Character *ch, World *w, float dt);

/* small helpers shared with the game */
float frand(void);                       /* 0..1 */
float frange(float a, float b);
void  rng_seed(uint32_t s);
float ang_diff(float a, float b);

#endif
