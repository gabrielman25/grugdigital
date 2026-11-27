/* =====================================================================================================================
   GRUG BASEPLATE 64: the Grug Baseplate (arcade/baseplate/index.html), small enough for a 1996 console.

   A walk-around zoo of what every Grug game does, to prove the idea: the classic R6 Humanoid physics (phys.c, a port
   of AmbientCore: walk 16, jump 7.2 studs, gravity 196.2, 240 Hz), the dodge roll, the swing and the training dummy,
   health, the damage pad and the kill brick, falling apart and respawning, jump pads, a lift, a truss to climb, coins,
   the Roblox orbit camera, the 2010 GUI (HEALTH squares, the Game Menu), the player voices and the two soft sounds.

   THE STATIONS (build_world): Spawn - Walk & Run track - Jump heights - Gap jumps - Obby (red = danger) - Danger
   (damage pad, kill brick) - Dummy - Sky deck (lift, truss, jump pads) - coins everywhere.

   Left for later (they are in the Baseplate): the other players, seats, the button and door, the blaster, the
   companion, chat, saved outfits (you play as Grug), Pearls and saving.

   No title screen: the game starts straight in play, like every Grug game.
   ===================================================================================================================== */
#include <math.h>
#include <string.h>
#include <stdio.h>
#include "game.h"
#include "phys.h"
#include "audio.h"

#define PI_F 3.14159265358979f
static inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
static inline float approach(float v, float t, float step) { return v + clampf(t - v, -step, step); }

bool game_hw_ok, game_use_hw, game_hide_hud;
float game_fps;
uint32_t (*game_clock_us)(void);
static uint32_t prof[4], profT;   /* ms x 10: update, world, characters, HUD */
#define PROF_BEGIN() do { if (game_clock_us) profT = game_clock_us(); } while (0)
#define PROF_END(i) do { if (game_clock_us) { uint32_t n_ = game_clock_us(); prof[i] = (prof[i] * 7 + (n_ - profT) / 100) / 8; profT = n_; } } while (0)

/* ---------------------------------------------------------------- the world */
enum { T_NONE = 0, T_BASE, T_HURT, T_LIFT, T_FINISH, T_SPAWN };
#define MAX_PARTS 176
static Part parts[MAX_PARTS];
static World W;
#define BP 256.0f          /* the baseplate: 256 x 256 studs (the web one is 512), in 32-stud checks */
#define BT 32.0f

static const struct { float x, y, z; } SPAWN = { 0, 3.6f, 0 };

typedef struct { const char *name, *sub; float x, z, hw, hd; } Station;
static Station stations[12]; static int nStations;
typedef struct { const char *a, *b; float x, y, z, range; int st; } Bill;   /* st: the station it names (-1: none) */
static Bill bills[40]; static int nBills;
static char numText[16][4];

static struct { Part *part; float bottom, top, t, speed; int phase; } lift;   /* phase: 0 down, 1 rising, 2 up, 3 falling */
static Part *hurtPad, *finish;

#define SOLID (PF_COLLIDE)
static Part *part(float cx, float cy, float cz, float sx, float sy, float sz, uint32_t col) { return world_add(&W, cx, cy, cz, sx, sy, sz, col, K_SOLID, PF_COLLIDE | (sy <= 0.6f && cy < 1 ? PF_FLAT : 0)); }
static Part *deco(float cx, float cy, float cz, float sx, float sy, float sz, uint32_t col) { return world_add(&W, cx, cy, cz, sx, sy, sz, col, K_SOLID, PF_DECO | (sy <= 0.6f && cy < 1 ? PF_FLAT : 0)); }
static void station(const char *name, const char *sub, float x, float z, float hw, float hd, float billY) {
    if (nStations < 12) stations[nStations++] = (Station){ name, sub, x, z, hw, hd };
    if (billY > 0 && nBills < 40) bills[nBills++] = (Bill){ name, sub, x, billY, z, 130, nStations - 1 };
}
static void bill(const char *a, const char *b, float x, float y, float z, float range) { if (nBills < 40) bills[nBills++] = (Bill){ a, b, x, y, z, range, -1 }; }

/* ---------------------------------------------------------------- coins: pickups */
typedef struct { float x, y, z, t; } Coin;
static Coin coins[24]; static int nCoins;
static void coin(float x, float y, float z) { if (nCoins < 24) coins[nCoins++] = (Coin){ x, y + 2.4f, z, 0 }; }

static void build_world(void) {
    world_init(&W, parts, MAX_PARTS); nStations = nBills = nCoins = 0;
    /* the baseplate (drawn as grey checks: cool colours, so the red bits stand out), and far below it, where you fall to your death */
    Part *b = world_add(&W, 0, -1, 0, BP, 2, BP, 0xa3a2a5, K_SOLID, PF_COLLIDE | PF_NOCAM); b->tag = T_BASE;
    world_add(&W, 0, -30, 0, 8000, 20, 8000, 0, K_KILL, PF_COLLIDE | PF_NOCAM | PF_HIDDEN);

    /* spawn: a SpawnLocation (grey, a plate on top) */
    part(0, 0.3f, 0, 12, 0.6f, 12, 0x6e6e72)->tag = T_SPAWN; deco(0, 0.65f, 0, 6, 0.1f, 6, 0xf2f3f3)->flags |= PF_FLAT;
    station("SPAWN", "everyone starts here", 0, 0, 8, 8, 0);
    bill("GRUG BASEPLATE 64", "a zoo of what every Grug game does", 0, 9, -18, 120);

    /* the walk & run track: 16 studs a second, white lines every 16 studs */
    const float TX = -100;
    part(TX, 0.1f, 0, 12, 0.2f, 180, 0x27466a);
    for (int k = 0; k <= 10; k++) deco(TX, 0.21f, 80 - k * 16, 12, 0.02f, 0.6f, 0xf2f3f3);
    station("WALK & RUN", "16 studs a second - Z: dodge roll", TX, 0, 8, 92, 0);
    bill("WALK & RUN", "lines every 16 studs = a second of walking", TX, 10, 84, 150);

    /* jump heights: blocks 1 to 10 studs tall. A jump lifts your feet 7.2 studs, and R6 legs don't collide, so the torso
       (2 studs above the feet) clears anything up to 9.2: the 9 block is the last you can get onto. (The web Baseplate's
       sign says 8 is too high; its physics, which these are, say otherwise: tools/physdiff.cjs checks both.) */
    for (int h = 1; h <= 10; h++) {
        float x = -49.5f + (h - 1) * 11, z = -40;
        part(x, h / 2.0f, z, 8, h, 8, h == 10 ? 0x6b327c : 0x0d69ac);
        snprintf(numText[h], 4, "%d", h); bill(numText[h], h == 10 ? "too high!" : "studs", x, h + 3.5f, z, 60);
    }
    station("JUMP HEIGHTS", "A: jump 7.2 studs, legs clear 9 - 10 is too high", 0, -40, 56, 10, 17);
    /* gap jumps: two ledges 4 studs up with gaps from 4 to 16 studs (a running jump crosses about 9; roll in the air for more) */
    static const int GAPS[5] = { 4, 7, 10, 13, 16 };
    for (int k = 0; k < 5; k++) {
        float x0 = -66 + k * 28, g = GAPS[k];
        part(x0, 2, -74, 6, 4, 8, 0x4b974b); part(x0 + 6 + g, 2, -74, 6, 4, 8, 0x4b974b);
        snprintf(numText[11 + k], 4, "%d", GAPS[k]); bill(numText[11 + k], "stud gap", x0 + 3 + g / 2, 7.5f, -74, 60);
    }
    station("GAP JUMPS", "jump at the edge - roll in the air to go further", 0, -74, 72, 10, 13);

    /* the obby: red is danger (kill bricks): a run of platforms over a red floor, a finish at the end */
    const float OX = -40, OZ = -108;
    part(OX - 6, 1, OZ, 10, 2, 10, 0x9c9b9e);   /* start */
    { Part *lava = world_add(&W, OX + 41, 0.25f, OZ, 76, 0.5f, 26, 0xff0000, K_KILL, PF_COLLIDE | PF_FLAT); (void)lava; }   /* the floor is lava */
    static const float STEPS[11][3] = { { 34, 0, 2 }, { 41, 3, 3 }, { 48, -3, 4 }, { 55, 2, 4 }, { 62, -2, 5 }, { 69, 3, 4 }, { 76, 0, 3 }, { 83, -3, 4 }, { 90, 2, 5 }, { 97, -1, 4 }, { 104, 1, 4 } };
    for (int i = 0; i < 11; i++) part(OX - 30 + STEPS[i][0], STEPS[i][2] / 2 + 0.5f, OZ + STEPS[i][1], 4, STEPS[i][2], 4, 0x0d69ac);
    finish = part(OX + 84, 2.5f, OZ, 10, 5, 10, 0xf5cd30); finish->tag = T_FINISH;
    part(OX + 41, 1.5f, OZ - 13.5f, 76, 3, 1, 0x3a3a3e); part(OX + 41, 1.5f, OZ + 13.5f, 76, 3, 1, 0x3a3a3e);   /* side rails */
    station("OBBY", "red kills you - reach the yellow block", OX + 42, OZ, 52, 15, 13);
    coin(OX + 84, 5, OZ);

    /* danger: a damage pad (one square of health a second) and a kill brick */
    const float KX = -50, KZ = 26;
    hurtPad = part(KX - 8, 0.2f, KZ, 10, 0.4f, 10, 0xff0000); hurtPad->tag = T_HURT;
    world_add(&W, KX + 9, 1, KZ, 6, 2, 6, 0xff0000, K_KILL, PF_COLLIDE);
    bill("DAMAGE", "-1 health a second", KX - 8, 5.5f, KZ, 90); bill("KILL BRICK", "touch it and you fall apart", KX + 9, 6.5f, KZ, 90);
    station("DANGER", "red hurts - health is the red squares", KX, KZ, 17, 10, 0);

    /* the training dummy: something to swing at */
    deco(32, 0.1f, -6, 10, 0.2f, 10, 0x27466a);
    station("DUMMY", "B: swing - three hits break it", 32, -6, 8, 8, 0);

    /* the sky deck: a lift (west side), a truss to climb (east side), jump pads in front */
    const float DX = 84, DZ = 62, DH = 30;
    part(DX, DH / 2, DZ, 30, DH, 30, 0x7b7d80);   /* the tower */
    part(DX, DH + 0.75f, DZ - 14.5f, 30, 1.5f, 1, 0x3a3a3e); part(DX, DH + 0.75f, DZ + 14.5f, 30, 1.5f, 1, 0x3a3a3e);   /* railings (gaps where the lift and the truss arrive) */
    part(DX - 14.5f, DH + 0.75f, DZ + 6, 1, 1.5f, 18, 0x3a3a3e); part(DX + 14.5f, DH + 0.75f, DZ - 8, 1, 1.5f, 14, 0x3a3a3e);
    const float EX = DX - 19;
    lift.part = world_add(&W, EX, 0.5f, DZ - 6, 8, 1, 8, 0xf5cd30, K_SOLID, PF_COLLIDE | PF_DYNAMIC); lift.part->tag = T_LIFT;
    lift.bottom = 1; lift.top = DH; lift.t = 2; lift.speed = 9; lift.phase = 0;
    deco(EX - 5, DH / 2 + 1, DZ - 11, 1, DH + 2, 1, 0x3a3a3e); deco(EX - 5, DH / 2 + 1, DZ - 1, 1, DH + 2, 1, 0x3a3a3e);   /* the shaft's posts */
    const float LX = DX + 15, LZ = DZ + 8;
    { Part *l = world_add(&W, LX + 0.8f, DH / 2, LZ, 1.6f, DH, 4, 0, K_LADDER, PF_HIDDEN | PF_NOCAM); l->nx = -1; l->nz = 0; l->fx = LX; l->fz = LZ; l->hw = 2; }
    deco(LX + 0.8f, DH / 2, LZ - 1.6f, 0.6f, DH, 0.6f, 0x8a8a8a); deco(LX + 0.8f, DH / 2, LZ + 1.6f, 0.6f, DH, 0.6f, 0x8a8a8a);
    for (int y = 1; y < DH; y += 2) deco(LX + 0.8f, y, LZ, 0.5f, 0.4f, 3.2f, 0x8a8a8a)->flags &= ~PF_FLAT;
    for (int k = -1; k <= 1; k++) { Part *p = world_add(&W, DX + k * 9, 0.2f, DZ - 26, 6, 0.4f, 6, 0x00ff00, K_PAD, PF_COLLIDE | PF_FLAT); p->power = 120; }   /* about 37 studs up */
    station("SKY DECK", "ride the lift - climb the truss - or take a jump pad", DX, DZ - 6, 28, 34, DH + 7);
    bill("JUMP PADS", "steer while you fly", DX, 6, DZ - 26, 90); bill("LIFT", 0, EX, DH + 5, DZ - 6, 150); bill("TRUSS", "walk into it to climb", LX + 3, 9, LZ, 90);
    coin(DX, DH, DZ); coin(DX - 6, DH, DZ - 7); coin(DX + 6, DH, DZ + 7);

    /* coins: on the way to things */
    coin(0, 0, -20); coin(10, 0, -20); coin(-10, 0, -20); coin(-16.5f, 4, -40); coin(16.5f, 7, -40);
    coin(TX, 0, 40); coin(TX, 0, 0); coin(TX, 0, -40); coin(40, 0, 20); coin(-30, 0, 40); coin(20, 0, -60);

    /* decoration: trees round the edge (no collision) */
    for (int k = 0; k < 10; k++) {
        float a = k / 10.0f * PI_F * 2 + 0.3f, r = 118, x = cosf(a) * r, z = sinf(a) * r, s = 0.9f + (k * 37 % 10) * 0.06f;
        deco(x, 4 * s, z, 2 * s, 8 * s, 2 * s, 0x6b4a2c); deco(x, 11 * s, z, 8 * s, 7 * s, 8 * s, 0x3f7f3a); deco(x, 16 * s, z, 5 * s, 4 * s, 5 * s, 0x4b974b);
    }
}

static void update_lift(float dt) {
    Part *p = lift.part;
    if (lift.phase == 0 || lift.phase == 2) { p->vy = 0; lift.t -= dt; if (lift.t <= 0) lift.phase = lift.phase == 0 ? 1 : 3; }   /* waiting at an end */
    else {
        int dir = lift.phase == 1 ? 1 : -1; p->vy = dir * lift.speed;
        if (dir > 0 && p->maxY >= lift.top) { p->vy = 0; float o = p->maxY - lift.top; p->minY -= o; p->maxY -= o; lift.phase = 2; lift.t = 3; aud_play(S_CHIME, 0.5f, 0, 0); }
        if (dir < 0 && p->maxY <= lift.bottom) { p->vy = 0; float o = lift.bottom - p->maxY; p->minY += o; p->maxY += o; lift.phase = 0; lift.t = 3; }
    }
}

/* ---------------------------------------------------------------- characters: the classic Grug rig, in flat colours
   root (the torso centre) > torso 2x2x1, head at y 1.6, shoulder pivots (+-1.5, 0.5), hip pivots (+-0.5, -1); facing -Z, right arm on +X.
   You play as Grug (character/looks: the lime hoodie, charcoal jeans, white sneakers, a brown crop). */
typedef struct { uint32_t skin, shirt, pants, shoes, hair; } Look;
static const Look GRUG = { 0xeab892, 0x9ccb3b, 0x3d3d42, 0xf2f3f3, 0x4a2c1a };
static const Look DUMMY_LOOK = { 0xf5cd30, 0x0d69ac, 0x27466a, 0x1b2a35, 0x1b2a35 };
typedef struct { float rs, ls, rh, lh; } Joints;
typedef struct { Joints j; float walkT; } Rig;

#define MAXHP 5
static struct {
    Character ch; Rig rig; int hp, coinCount; float hitFx; bool wasDead; float hurtAcc;
    bool rolling; float rollT, rollFx, rollFz;
    float dashCd, swingCd, swingT; bool swingHit;
    bool onFinish;
} player;
static struct { float x, y, z, yaw; Rig rig; int hp; float hitFx, t; } dummy;
static const struct { float T, V, CD; } DASH = { 0.3f, 42, 0.75f };            /* the dodge roll (Zombie Zones' speed, time and wait) */
static const struct { float T, CD, REACH; int DMG; } SWING = { 0.32f, 0.5f, 7.5f, 34 };

/* falling apart (the classic death): every body part comes off and tumbles */
typedef struct { float p[3], v[3], e[3], w[3], h[3], t, floor; Mat3 m0; uint32_t color; } Piece;
static Piece pieces[12]; static int nPieces;

/* damage numbers, announcements */
typedef struct { float x, y, z, t; char s[6]; } DmgNum;
static DmgNum dmg[6];
static struct { const char *big, *small; uint16_t color; float t; } ann;
static float hintT = 9, gclock;

/* ---------------------------------------------------------------- the camera: the Roblox orbit cam */
static struct { float yaw, pitch, dist, tdist, fx, fy, fz; bool init; float px, py, pz; float zoomRep; } cam = { 0, 0.32f, 22, 22, 0, 4, 0, false, 0, 0, 0, 0 };
static void zoom_step(int out) { cam.tdist *= out ? 1.18f : 1 / 1.18f; if (!out && cam.tdist < 1.6f) cam.tdist = 0.5f; if (out && cam.tdist < 1.6f) cam.tdist = 1.6f; cam.tdist = clampf(cam.tdist, 0.5f, 90); }
static void place_camera(float dt) {
    const Character *ch = &player.ch; float ax = ch->x, ay = ch->y + 1.5f, az = ch->z;
    float k = cam.init ? 1 - expf(-40 * dt) : 1; cam.init = true;
    cam.fx += (ax - cam.fx) * k; cam.fy += (ay - cam.fy) * k; cam.fz += (az - cam.fz) * k;
    cam.dist += (cam.tdist - cam.dist) * (1 - expf(-8 * dt));
    float cp = cosf(cam.pitch), dx = sinf(cam.yaw) * cp, dy = sinf(cam.pitch), dz = cosf(cam.yaw) * cp, d = cam.dist;
    const Part *hit; float t = world_raycast(&W, cam.fx, cam.fy, cam.fz, dx, dy, dz, d + 0.4f, PF_NOCAM, &hit);
    if (hit && t - 0.4f < d) d = t - 0.4f < 0.5f ? 0.5f : t - 0.4f;
    cam.px = cam.fx + dx * d; cam.py = cam.fy + dy * d; cam.pz = cam.fz + dz * d;
    if (cam.py < 0.4f && fabsf(cam.px) < BP / 2 && fabsf(cam.pz) < BP / 2) cam.py = 0.4f;   /* never under the plate */
}

/* ---------------------------------------------------------------- the Game Menu (the 2012 one, in miniature) */
enum { MI_RESUME, MI_RESET, MI_VOICES, MI_PITCH, MI_RENDER, MI_FPS, MI_HELP, MI_COUNT };
static struct { bool open, help, fps; int sel; float rep; } menu;
static bool menu_item_shown(int i) { return i != MI_RENDER || game_hw_ok; }

/* ---------------------------------------------------------------- start */
void game_init(uint32_t seed) {
    rng_seed(seed);
    build_world();
    memset(&player, 0, sizeof player);
    char_init(&player.ch, SPAWN.x, SPAWN.y, SPAWN.z, 0); player.hp = MAXHP; player.hurtAcc = 0.6f;
    dummy.x = 32; dummy.y = 3; dummy.z = -6; dummy.yaw = PI_F / 2; dummy.hp = 100; dummy.t = 0; dummy.hitFx = 0;   /* it faces the spawn */
    nPieces = 0; memset(dmg, 0, sizeof dmg); ann.t = 0; hintT = 9; gclock = 0;
    cam.yaw = 0; cam.pitch = 0.32f; cam.dist = cam.tdist = 22; cam.init = false;
    memset(&menu, 0, sizeof menu);
    aud_init();
}

static void announce(const char *big, const char *small, uint16_t color, float t) { ann.big = big; ann.small = small; ann.color = color; ann.t = t; }
static void dmg_add(float x, float y, float z, int n, bool minus) {
    int best = 0; for (int i = 0; i < 6; i++) if (dmg[i].t <= 0) { best = i; break; } else if (dmg[i].t < dmg[best].t) best = i;
    dmg[best] = (DmgNum){ x, y, z, 0.9f, "" }; snprintf(dmg[best].s, sizeof dmg[best].s, minus ? "-%d" : "%d", n);
}
/* a sound from somewhere in the world: quieter with distance (the site's panner: inverse, ref 30, rolloff 1.1), and to one side */
static void world_sound(int snd, float x, float y, float z, float vol) {
    float dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz, d = sqrtf(dx * dx + dy * dy + dz * dz);
    float g = d > 30 ? 30 / (30 + 1.1f * (d - 30)) : 1;
    float side = d > 1 ? (dx * cosf(cam.yaw) - dz * sinf(cam.yaw)) / d : 0;
    aud_play(snd, vol * g, 0, clampf(side * 0.6f, -0.6f, 0.6f));
}

/* ---------------------------------------------------------------- the rig: where every block is, for drawing and for falling apart */
typedef struct { float c[3]; Mat3 m; float h[3]; uint32_t color; int group; } Block;   /* group: 0 torso, 1 head, 2 right arm, 3 left arm, 4 right leg, 5 left leg */
static int rig_blocks(Block *out, float x, float y, float z, float yaw, const Rig *r, const Look *L, bool rolling, float rollK, float rollFx, float rollFz, bool detail) {
    Mat3 root; m3_rot_y(&root, yaw); float ry = y; int n = 0;
    if (rolling) {   /* the dodge roll: a tucked somersault the way you're rolling */
        float c = cosf(yaw), s = sinf(yaw), lx = rollFx * c - rollFz * s, lz = rollFx * s + rollFz * c, l = sqrtf(lx * lx + lz * lz); if (l < 1e-4f) { lz = -1; lx = 0; l = 1; }
        Mat3 roll; m3_axis_angle(&roll, lz / l, 0, -lx / l, PI_F * 2 * (rollK * rollK * (3 - 2 * rollK))); m3_mul(&root, &root, &roll);
        ry = y - 1.3f * sinf(PI_F * rollK);
    }
#define BLK(lx_, ly_, lz_, M, hx_, hy_, hz_, col, grp) do { float l_[3] = { lx_, ly_, lz_ }, w_[3]; m3_apply(&root, l_, w_); Block *b_ = &out[n++]; \
        b_->c[0] = x + w_[0]; b_->c[1] = ry + w_[1]; b_->c[2] = z + w_[2]; b_->m = (M); b_->h[0] = hx_; b_->h[1] = hy_; b_->h[2] = hz_; b_->color = col; b_->group = grp; } while (0)
    BLK(0, 0, 0, root, 1, 1, 0.5f, L->shirt, 0);
    BLK(0, 1.6f, 0, root, 0.6f, 0.6f, 0.6f, L->skin, 1);
    if (detail) {
        BLK(0, 2.13f, 0.03f, root, 0.66f, 0.15f, 0.66f, L->hair, 1); BLK(0, 1.78f, 0.56f, root, 0.66f, 0.42f, 0.12f, L->hair, 1);
        BLK(0.22f, 1.68f, -0.61f, root, 0.07f, 0.11f, 0.02f, 0x1d1d1f, 1); BLK(-0.22f, 1.68f, -0.61f, root, 0.07f, 0.11f, 0.02f, 0x1d1d1f, 1); BLK(0, 1.4f, -0.61f, root, 0.2f, 0.04f, 0.02f, 0x1d1d1f, 1);
    }
    const float ang[4] = { r->j.rs, r->j.ls, r->j.rh, r->j.lh }, px[4] = { 1.5f, -1.5f, 0.5f, -0.5f }, py[4] = { 0.5f, 0.5f, -1, -1 };
    for (int i = 0; i < 4; i++) {
        Mat3 lr, m; m3_rot_x(&lr, ang[i]); m3_mul(&m, &root, &lr);
        const bool arm = i < 2; const float top = arm ? 0.5f : 0, split = arm ? -1.1f : -1.55f, bot = arm ? -1.5f : -2;   /* sleeve + hand, jeans + shoe */
        for (int s = 0; s < 2; s++) {
            float a = s ? split : top, b2 = s ? bot : split, lc[3] = { 0, (a + b2) / 2, 0 }, o[3]; m3_apply(&lr, lc, o);
            BLK(px[i] + o[0], py[i] + o[1], o[2], m, 0.5f, (a - b2) / 2, 0.5f, s ? (arm ? L->skin : L->shoes) : (arm ? L->shirt : L->pants), 2 + i);
            if (!detail) { out[n - 1].c[0] = 0; n--; s = 1; float lc2[3] = { 0, (top + bot) / 2, 0 }; m3_apply(&lr, lc2, o); BLK(px[i] + o[0], py[i] + o[1], o[2], m, 0.5f, (top - bot) / 2, 0.5f, arm ? L->shirt : L->pants, 2 + i); }
        }
    }
#undef BLK
    return n;
}
/* the animations: our own retro ones, swinging the pivots (animateRig in the Baseplate) */
static void animate_rig(Rig *r, int pose, int climbDir, float dt) {
    Joints t = { 0, 0, 0, 0 }; float rate = 12;
    if (pose == 1) { t.rs = t.ls = PI_F; rate = 30; r->walkT = 0; }                                   /* air */
    else if (pose == 2) { r->walkT += dt; float s = sinf(r->walkT * 9); t.rs = s; t.ls = -s; t.rh = -s; t.lh = s; rate = 12; }   /* walk */
    else if (pose == 3) { if (climbDir) r->walkT += dt * climbDir; float s = sinf(r->walkT * 9); t.rs = PI_F * 0.75f + s * 0.45f; t.ls = PI_F * 0.75f - s * 0.45f; t.rh = -0.5f - s * 0.5f; t.lh = -0.5f + s * 0.5f; rate = 20; }   /* climb */
    else { rate = 9; r->walkT = 0; }                                                                 /* idle */
    r->j.rs = approach(r->j.rs, t.rs, rate * dt); r->j.ls = approach(r->j.ls, t.ls, rate * dt); r->j.rh = approach(r->j.rh, t.rh, rate * dt); r->j.lh = approach(r->j.lh, t.lh, rate * dt);
}
static float ground_below(float x, float y, float z) { const Part *h; float t = world_raycast(&W, x, y, z, 0, -1, 0, 200, 0, &h); return h ? y - t : 0; }
static void break_apart(float x, float y, float z, float yaw, const Rig *r, const Look *L, float fling) {
    Block b[16]; int n = rig_blocks(b, x, y, z, yaw, r, L, false, 0, 0, 0, false);
    for (int i = 0; i < n && nPieces < 12; i++) {
        Piece *p = &pieces[nPieces++]; memcpy(p->p, b[i].c, sizeof p->p); memcpy(p->h, b[i].h, sizeof p->h); p->m0 = b[i].m; p->color = b[i].color;
        float dx = b[i].c[0] - x, dz = b[i].c[2] - z, d = sqrtf(dx * dx + dz * dz); if (d < 1e-3f) { dx = frange(-1, 1); dz = frange(-1, 1); d = sqrtf(dx * dx + dz * dz) + 1e-3f; }
        p->v[0] = dx / d * frange(4, 10) * fling + frange(-3, 3); p->v[1] = frange(8, 18) * fling; p->v[2] = dz / d * frange(4, 10) * fling + frange(-3, 3);
        for (int k = 0; k < 3; k++) { p->w[k] = frange(-6, 6); p->e[k] = 0; }
        p->t = 3; p->floor = ground_below(p->p[0], p->p[1], p->p[2]) + 0.5f;
    }
}
static void update_pieces(float dt) {
    for (int i = nPieces - 1; i >= 0; i--) {
        Piece *p = &pieces[i]; p->t -= dt; p->v[1] -= CFG_GRAVITY * 0.5f * dt;
        for (int k = 0; k < 3; k++) { p->p[k] += p->v[k] * dt; p->e[k] += p->w[k] * dt; }
        if (p->p[1] < p->floor) { p->p[1] = p->floor; p->v[1] *= -0.25f; p->v[0] *= 0.5f; p->v[2] *= 0.5f; for (int k = 0; k < 3; k++) p->w[k] *= 0.5f; }
        if (p->t <= 0) pieces[i] = pieces[--nPieces];
    }
}

/* ---------------------------------------------------------------- you */
static void hurt(int n) {   /* health: a square at a time */
    Character *ch = &player.ch; if (ch->dead) return;
    player.hp -= n; if (player.hp < 0) player.hp = 0; player.hitFx = 0.3f;
    dmg_add(ch->x, ch->y + 3, ch->z, n, true); aud_play(S_HIT, 1, 0, 0);
    if (player.hp > 0) aud_say(VE_HURT); else char_kill(ch);
}
static bool walk_dir(const Input *in, float *ox, float *oz) {
    float st = in->sx, fw = in->sy;
    if (in->held & BTN_DU) fw = 1; if (in->held & BTN_DD) fw = -1; if (in->held & BTN_DR) st = 1; if (in->held & BTN_DL) st = -1;
    float l = sqrtf(st * st + fw * fw); if (l < 0.15f) return false;
    if (l > 1) { st /= l; fw /= l; }
    *ox = -sinf(cam.yaw) * fw + cosf(cam.yaw) * st; *oz = -cosf(cam.yaw) * fw - sinf(cam.yaw) * st;
    return true;
}
static void try_dash(const Input *in) {   /* Z: the dodge roll */
    Character *ch = &player.ch; if (ch->dead || ch->climbing || player.dashCd > 0) return;
    float dx, dz; if (walk_dir(in, &dx, &dz)) { float l = sqrtf(dx * dx + dz * dz); dx /= l; dz /= l; } else { dx = -sinf(ch->faceYaw); dz = -cosf(ch->faceYaw); }
    ch->dashT = 0.3; ch->dashVx = dx * DASH.V; ch->dashVz = dz * DASH.V; player.dashCd = DASH.CD; ch->faceYaw = atan2f(-dx, -dz);
    player.rolling = true; player.rollT = 0; player.rollFx = dx; player.rollFz = dz;
    aud_play(S_SWING, 1, 0, 0); aud_say(VE_DODGE);
}
static void swing(void) {   /* B: you swing. The hit lands partway through, on whatever stands in front of you within reach */
    Character *ch = &player.ch; if (ch->dead || ch->climbing || player.rolling || player.swingCd > 0) return;
    player.swingCd = SWING.CD; player.swingT = 0; player.swingHit = false; aud_play(S_SWING, 1, 0, 0); aud_say(VE_ATTACK);
}
static void swing_strike(void) {
    Character *ch = &player.ch; float fx = -sinf(ch->faceYaw), fz = -cosf(ch->faceYaw);
    if (dummy.hp <= 0) return;
    float dx = dummy.x - ch->x, dz = dummy.z - ch->z, L = sqrtf(dx * dx + dz * dz);
    if (L > SWING.REACH || fabsf(dummy.y - ch->y) > 5 || (L > 1.5f && (dx * fx + dz * fz) / L < 0.25f)) return;
    dummy.hp -= SWING.DMG; dummy.hitFx = 0.15f; dmg_add(dummy.x, dummy.y + 3, dummy.z, SWING.DMG, false); world_sound(S_HIT, dummy.x, dummy.y, dummy.z, 1);
    if (dummy.hp <= 0) { break_apart(dummy.x, dummy.y, dummy.z, dummy.yaw, &dummy.rig, &DUMMY_LOOK, 1.4f); world_sound(S_THUD, dummy.x, dummy.y, dummy.z, 1); dummy.t = 4; aud_say(VE_LAUGH); }   /* an elimination: the laugh */
}

static void menu_update(const Input *in, float dt) {
    int dir = 0; float sy = in->sy; menu.rep -= dt;
    bool up = (in->held & BTN_DU) || sy > 0.5f, down = (in->held & BTN_DD) || sy < -0.5f;
    if (!up && !down) menu.rep = 0; else if (menu.rep <= 0) { dir = up ? -1 : 1; menu.rep = 0.22f; }
    if (menu.help) { if (in->pressed & (BTN_A | BTN_B | BTN_START)) { menu.help = false; aud_tap(S_TAP_CLOSE); } return; }
    if (dir) { do { menu.sel = (menu.sel + dir + MI_COUNT) % MI_COUNT; } while (!menu_item_shown(menu.sel)); aud_tap(S_TAP_SELECT); }
    int lr = ((in->pressed & (BTN_DR | BTN_CR)) ? 1 : 0) - ((in->pressed & (BTN_DL | BTN_CL)) ? 1 : 0);
    if (in->pressed & (BTN_B | BTN_START)) { menu.open = false; aud_tap(S_TAP_CLOSE); return; }
    if (menu.sel == MI_PITCH && lr) { aud_voice_pitch = clampf(aud_voice_pitch + lr, VOICE_PITCH_MIN, VOICE_PITCH_MAX); float c = VOICE_EVENTS[VE_JUMP].chance; (void)c; aud_voices_on = true; aud_say(VE_JUMP); }
    if (in->pressed & BTN_A) {
        switch (menu.sel) {
            case MI_RESUME: menu.open = false; aud_tap(S_TAP_CLOSE); break;
            case MI_RESET: menu.open = false; aud_tap(S_TAP_CLOSE); char_kill(&player.ch); break;
            case MI_VOICES: aud_voices_on = !aud_voices_on; aud_tap(S_TAP_SELECT); if (aud_voices_on) aud_say(VE_JUMP); break;
            case MI_PITCH: aud_voice_pitch = aud_voice_pitch >= VOICE_PITCH_MAX ? VOICE_PITCH_MIN : aud_voice_pitch + 1; aud_voices_on = true; aud_say(VE_JUMP); break;
            case MI_RENDER: game_use_hw = !game_use_hw; aud_tap(S_TAP_SELECT); break;
            case MI_FPS: menu.fps = !menu.fps; aud_tap(S_TAP_SELECT); break;
            case MI_HELP: menu.help = true; aud_tap(S_TAP_OPEN); break;
        }
    }
}

void game_update(const Input *inRaw, float dt) {
    if (dt > 0.1f) dt = 0.1f; if (dt <= 0) return;
    PROF_BEGIN();
    gclock += dt;
    Input in = *inRaw; Character *ch = &player.ch;
    if (in.pressed & BTN_START && !menu.open) { menu.open = true; menu.help = false; menu.sel = MI_RESUME; aud_tap(S_TAP_OPEN); in.pressed = 0; }
    if (menu.open) { menu_update(&in, dt); memset(&in, 0, sizeof in); }
    if (hintT > 0 && (in.held || fabsf(in.sx) + fabsf(in.sy) > 0.3f)) hintT = hintT > 4 ? 4 : hintT;
    if (hintT > 0) hintT -= dt;

    /* ---- the camera: C left / right turn it, C up / down tilt it, R / L zoom (all the way in = first person) */
    if (in.held & BTN_CL) cam.yaw += 300 * 0.0055f * dt; if (in.held & BTN_CR) cam.yaw -= 300 * 0.0055f * dt;
    if (in.held & BTN_CU) cam.pitch = clampf(cam.pitch + 1.3f * dt, -1.2f, 1.396f); if (in.held & BTN_CD) cam.pitch = clampf(cam.pitch - 1.3f * dt, -1.2f, 1.396f);
    if (in.held & (BTN_L | BTN_R)) { cam.zoomRep -= dt; if (cam.zoomRep <= 0) { zoom_step((in.held & BTN_L) != 0); cam.zoomRep = (in.pressed & (BTN_L | BTN_R)) ? 0.3f : 0.09f; } } else cam.zoomRep = 0;

    /* ---- input -> the physics, then the world steps */
    float mx, mz; if (walk_dir(&in, &mx, &mz)) { ch->mx = mx; ch->mz = mz; } else ch->mx = ch->mz = 0;
    ch->jump = (in.held & BTN_A) != 0;
    if (in.pressed & BTN_Z) try_dash(&in);
    if (in.pressed & BTN_B) swing();
    update_lift(dt);
    phys_step(ch, &W, dt);

    /* ---- what happened */
    player.dashCd = player.dashCd > dt ? player.dashCd - dt : 0;
    if (ch->events & EV_JUMP) { aud_play(S_JUMP, 1, 0, 0); aud_say(VE_JUMP); }
    if (ch->events & EV_PAD) aud_play(S_PAD, 1, 0, 0);
    if (ch->events & EV_GRAB) aud_tap(S_TAP_SELECT);
    ch->events = 0;
    /* dying and respawning: the death (kill brick, health at 0, falling off the edge) is the physics' (ch.dead, 3 s), the look is ours */
    if (ch->dead && !player.wasDead) {
        player.wasDead = true; player.rolling = false; break_apart(ch->x, ch->y, ch->z, ch->faceYaw, &player.rig, &GRUG, 1);
        world_sound(S_THUD, ch->x, ch->y, ch->z, 1); aud_say(ch->y < -10 ? VE_FALL : VE_DEATH); player.hp = 0;
    } else if (!ch->dead && player.wasDead) { player.wasDead = false; player.hp = MAXHP; cam.init = false; }
    /* the damage pad: one square of health a second while you stand on it */
    if (!ch->dead && ch->grounded && ch->ground == hurtPad) { player.hurtAcc += dt; if (player.hurtAcc >= 1) { player.hurtAcc -= 1; hurt(1); } } else player.hurtAcc = 0.6f;
    /* the end of the obby */
    { bool on = !ch->dead && ch->grounded && ch->ground == finish; if (on && !player.onFinish) { aud_play(S_WIN, 1, 0, 0); announce("OBBY COMPLETE!", "you reached the yellow block", rgb5551(255, 255, 0), 2.4f); } player.onFinish = on; }
    aud_walk(ch->grounded && !ch->dead && !menu.open && sqrtf(ch->vx * ch->vx + ch->vz * ch->vz) > 1);
    if (cam.dist < 1.4f && !ch->dead) ch->faceYaw = cam.yaw;   /* first person: you face where you look */

    /* ---- animation */
    if (!ch->dead) {
        int pose = ch->climbing ? 3 : !ch->grounded ? 1 : sqrtf(ch->vx * ch->vx + ch->vz * ch->vz) > 0.5f ? 2 : 0;
        animate_rig(&player.rig, pose, ch->climbDir, dt);
        if (player.rolling) { player.rollT += dt; if (player.rollT >= DASH.T) player.rolling = false; else { player.rig.j.rh = player.rig.j.lh = -1.2f; player.rig.j.rs = player.rig.j.ls = 2.2f; } }
        player.swingCd = player.swingCd > dt ? player.swingCd - dt : 0;
        if (player.swingT <= SWING.T) {   /* the swing takes over your right arm while it lasts: up, then down in front */
            player.swingT += dt;
            if (!player.swingHit && player.swingT >= SWING.T * 0.45f) { player.swingHit = true; swing_strike(); }
            if (!player.rolling) { float k = player.swingT / SWING.T; if (k > 1) k = 1; player.rig.j.rs = 2.9f - 2.6f * k * k; }
        }
    }
    if (player.hitFx > 0) player.hitFx -= dt;
    /* the dummy */
    if (dummy.hp <= 0) { dummy.t -= dt; if (dummy.t <= 0) { dummy.hp = 100; memset(&dummy.rig, 0, sizeof dummy.rig); } }
    else animate_rig(&dummy.rig, 0, 0, dt);
    if (dummy.hitFx > 0) dummy.hitFx -= dt;
    update_pieces(dt);
    /* coins */
    for (int i = 0; i < nCoins; i++) {
        Coin *c = &coins[i]; if (c->t > 0) { c->t -= dt; continue; }
        float dx = ch->x - c->x, dy = ch->y - 1 - c->y, dz = ch->z - c->z;
        if (!ch->dead && dx * dx + dy * dy + dz * dz < 2.6f * 2.6f) { c->t = 12; player.coinCount++; aud_play(S_COIN, 1, frange(0, 1.6f), 0); }
    }
    for (int i = 0; i < 6; i++) if (dmg[i].t > 0) { dmg[i].t -= dt; dmg[i].y += 5 * dt; }
    if (ann.t > 0) ann.t -= dt;
    place_camera(dt);
    aud_update(dt);
    PROF_END(0);
}

/* ---------------------------------------------------------------- drawing */
static void draw_rig(float x, float y, float z, float yaw, const Rig *r, const Look *L, bool rolling, float rollK, float fx, float fz, bool white) {
    float dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz; bool detail = dx * dx + dy * dy + dz * dz < 60 * 60;
    Block b[16]; int n = rig_blocks(b, x, y, z, yaw, r, L, rolling, rollK, fx, fz, detail);
    for (int i = 0; i < n; i++) r_obox(b[i].c, &b[i].m, b[i].h[0], b[i].h[1], b[i].h[2], b[i].color, white);
}
static void draw_world(void) {
    /* the baseplate: big grey checks on top, a plain slab underneath. Seen from above its top can't hide anything (whatever is
       behind it is under it), so it is painted with no depth at all: the cheapest pixels there are, and it is half the screen. */
    const uint16_t ca = r_shade(0xa3a2a5, 0, 1, 0), cb = r_shade(0x9c9b9e, 0, 1, 0); const int N = (int)(BP / BT);
    if (cam.py > 0) for (int i = 0; i < N; i++) for (int j = 0; j < N; j++) {
        float x0 = -BP / 2 + BT * i, z0 = -BP / 2 + BT * j; const float p[4][3] = { { x0, 0, z0 }, { x0 + BT, 0, z0 }, { x0 + BT, 0, z0 + BT }, { x0, 0, z0 + BT } };
        r_quad(p, (i + j) % 2 ? ca : cb, GM_BACK, 0);
    }
    r_box(-BP / 2, -2, -BP / 2, BP / 2, 0, BP / 2, 0x9c9b9e, 1);
    /* thin things lying on the ground first (they win ties with the plate), then everything else */
    for (int pass = 0; pass < 2; pass++) for (int i = 0; i < W.n; i++) {
        const Part *p = &W.parts[i];
        if ((p->flags & PF_HIDDEN) || p->tag == T_BASE || ((p->flags & PF_FLAT) != 0) != (pass == 0)) continue;
        r_box(p->minX, p->minY, p->minZ, p->maxX, p->maxY, p->maxZ, p->color, 0);
    }
}
static void draw_shadow(float x, float y, float z, float r) {
    const Part *h; float t = world_raycast(&W, x, y, z, 0, -1, 0, 60, 0, &h); if (!h || h->kind == K_KILL) { if (!h) return; }
    float k = 1 - t / 60; r_ngon_flat(x, y - t + 0.04f, z, r * (0.6f + 0.4f * k), 8, 0, GM_SHADOW);
}
/* labels over things (BillboardGuis). On a 320 x 240 screen they would pile up, so: the nearest first, and one that would
   land on another label or on the HUD is left out. The second line shows only when you are close. */
typedef struct { int x0, y0, x1, y1; } Box;
static Box taken[48]; static int nTaken;
static bool box_free(int x0, int y0, int x1, int y1) { for (int i = 0; i < nTaken; i++) if (x0 < taken[i].x1 && x1 > taken[i].x0 && y0 < taken[i].y1 && y1 > taken[i].y0) return false; return true; }
static void box_take(int x0, int y0, int x1, int y1) { if (nTaken < 48) taken[nTaken++] = (Box){ x0, y0, x1, y1 }; }
static bool label(float x, float y, float z, float range, const char *a, const char *b, uint16_t col) {
    int sx, sy; float d; if (!r_project(x, y, z, &sx, &sy, &d) || d > range) return false;
    const int FH = ui_font_h(); if (b && d > 38) b = 0;
    int wa = ui_text_w(a, 0), wb = b ? ui_text_w(b, 0) : 0, w = wa > wb ? wa : wb, x0 = sx - w / 2 - 2, y0 = sy - FH, x1 = sx + w / 2 + 2, y1 = sy + (b ? FH : 0);
    if (x1 < 0 || x0 > SCREEN_W || y1 < 0 || y0 > SCREEN_H || !box_free(x0, y0, x1, y1)) return false;
    box_take(x0, y0, x1, y1);
    ui_text(sx, sy - FH, a, col, UI_CENTER); if (b) ui_text(sx, sy, b, rgb5551(235, 235, 235), UI_CENTER);
    return true;
}

static const char *MENU_LABEL(int i, char *buf) {
    switch (i) {
        case MI_RESUME: return "Resume Game";
        case MI_RESET: return "Reset Character";
        case MI_VOICES: return aud_voices_on ? "Voices: On" : "Voices: Off";
        case MI_PITCH: snprintf(buf, 32, "Voice pitch: %+d", (int)aud_voice_pitch); return buf;
        case MI_RENDER: return game_use_hw ? "Drawn by: the console" : "Drawn by: software";
        case MI_FPS: return menu.fps ? "Show FPS: On" : "Show FPS: Off";
        default: return "Help";
    }
}
static void draw_hud(void) {
    const Character *ch = &player.ch; char buf[64];
    const uint16_t WHITE = rgb5551(255, 255, 255), YEL = rgb5551(255, 255, 0), RED = rgb5551(255, 0, 0), BLACK = 1;
    const int FH = ui_font_h();
    /* where you are (the station's rectangle you stand in) */
    const Station *P = 0; float ba = 1e9f;
    for (int i = 0; i < nStations; i++) { const Station *s = &stations[i]; if (fabsf(ch->x - s->x) > s->hw + 4 || fabsf(ch->z - s->z) > s->hd + 4) continue; float a = s->hw * s->hd; if (a < ba) { ba = a; P = s; } }
    const char *pname = P ? P->name : "BASEPLATE", *psub = P ? P->sub : "walk to a sign";
    const int X = 16, Y = 14;
    /* labels: damage numbers and the dummy first, then the signs from the nearest out (never under the HUD) */
    nTaken = 0; box_take(X - 2, Y - 2, X + 118, Y + 47); box_take(14, SCREEN_H - 46, SCREEN_W - 14, SCREEN_H - 14);
    if (hintT > 0 && !menu.open) box_take(40, SCREEN_H - 64 - FH, SCREEN_W - 40, SCREEN_H - 46);
    if (menu.open) box_take(40, 30, SCREEN_W - 40, SCREEN_H - 30);
    for (int i = 0; i < 6; i++) if (dmg[i].t > 0) { int sx, sy; float d; if (r_project(dmg[i].x, dmg[i].y, dmg[i].z, &sx, &sy, &d)) ui_text(sx, sy - FH, dmg[i].s, RED, UI_CENTER); }
    if (dummy.hp > 0) { int sx, sy; float d; if (r_project(dummy.x, dummy.y + 4.2f, dummy.z, &sx, &sy, &d) && d < 70 && box_free(sx - 18, sy - FH - 6, sx + 18, sy)) { box_take(sx - 18, sy - FH - 6, sx + 18, sy); ui_text(sx, sy - FH - 5, "Dummy", WHITE, UI_CENTER); ui_rect(sx - 16, sy - 4, 32, 4, BLACK); ui_rect(sx - 15, sy - 3, 30 * dummy.hp / 100, 2, RED); } }
    { int order[40]; float dist[40]; int n = 0;
      for (int i = 0; i < nBills; i++) {
          if (bills[i].st >= 0 && P == &stations[bills[i].st]) continue;   /* the bar along the bottom already says where you are */
          float dx = bills[i].x - cam.px, dy = bills[i].y - cam.py, dz = bills[i].z - cam.pz, d = dx * dx + dy * dy + dz * dz; if (d > bills[i].range * bills[i].range) continue;
          int k = n++; while (k > 0 && dist[k - 1] > d) { dist[k] = dist[k - 1]; order[k] = order[k - 1]; k--; } dist[k] = d; order[k] = i;
      }
      for (int k = 0; k < n; k++) { const Bill *b = &bills[order[k]]; label(b->x, b->y, b->z, b->range, b->a, b->b, WHITE); } }
    /* the stats panel: HEALTH = red squares, coins, the last jump (inside the TV-safe area) */
    ui_dim(X, Y, 116, 45); ui_frame(X, Y, 116, 45, BLACK, 1);
    ui_text(X + 5, Y + 2, "HEALTH", WHITE, 0);
    for (int k = 0; k < MAXHP; k++) { ui_rect(X + 52 + k * 11, Y + 4, 9, 9, BLACK); ui_rect(X + 53 + k * 11, Y + 5, 7, 7, k < player.hp ? RED : rgb5551(70, 20, 20)); }
    { static char coinsT[16] = "COINS 0"; static int coinsN; if (coinsN != player.coinCount) { coinsN = player.coinCount; snprintf(coinsT, sizeof coinsT, "COINS %d", coinsN); } ui_text(X + 5, Y + 2 + FH + 1, coinsT, YEL, 0); }
    { static char jump[40] = "Jump: how high?"; static float jh = -1, jd = -1;   /* (written only when it changes: printing decimals is slow on a console) */
      if (ch->hasLast && ch->lastHeight > 0.5f && (ch->lastHeight != jh || ch->lastDist != jd)) { jh = ch->lastHeight; jd = ch->lastDist; int a = (int)(jh * 10 + 0.5f), b = (int)(jd * 10 + 0.5f); snprintf(jump, sizeof jump, "Jump %d.%d up %d.%d far", a / 10, a % 10, b / 10, b % 10); }
      ui_text(X + 5, Y + 2 + (FH + 1) * 2, ch->climbing ? "Climbing: A lets go" : jump, WHITE, 0); }
    /* the place bar along the bottom */
    ui_dim(16, SCREEN_H - 44, SCREEN_W - 32, 28); ui_frame(16, SCREEN_H - 44, SCREEN_W - 32, 28, BLACK, 1);
    ui_text(SCREEN_W / 2, SCREEN_H - 43, pname, YEL, UI_CENTER); ui_text(SCREEN_W / 2, SCREEN_H - 43 + FH, psub, WHITE, UI_CENTER);
    if (hintT > 0 && !menu.open) { ui_text(SCREEN_W / 2, SCREEN_H - 62 - FH, "Stick move - A jump - Z roll - B swing", WHITE, UI_CENTER); ui_text(SCREEN_W / 2, SCREEN_H - 62, "C buttons: camera - START: Game Menu", WHITE, UI_CENTER); }
    if (ann.t > 0 && ann.big) { ui_text(SCREEN_W / 2, 70, ann.big, ann.color, UI_CENTER | UI_X2); if (ann.small) ui_text(SCREEN_W / 2, 70 + FH * 2 + 2, ann.small, WHITE, UI_CENTER); }
    if (ch->dead) ui_text(SCREEN_W / 2, 96, "You fell apart!", WHITE, UI_CENTER);
    if (menu.fps) {
        snprintf(buf, sizeof buf, "%d fps %s", (int)(game_fps + 0.5f), gfx->name); ui_text(SCREEN_W - 18, 14, buf, WHITE, UI_RIGHT);
        if (game_clock_us) { char buf[112]; snprintf(buf, sizeof buf, "ms: game %d world %d you %d hud %d (%d polys)", (int)prof[0] / 10, (int)prof[1] / 10, (int)prof[2] / 10, (int)prof[3] / 10, r_polys); ui_text(SCREEN_W - 18, 14 + FH, buf, WHITE, UI_RIGHT); }
    }
    /* the Game Menu: a centred dark box, Resume Game first */
    if (menu.open && !menu.help) {
        int rows = 0; for (int i = 0; i < MI_COUNT; i++) if (menu_item_shown(i)) rows++;
        const int w = 168, rh = FH + 6, h = 26 + rows * rh + 8, x = (SCREEN_W - w) / 2, y = (SCREEN_H - h) / 2; int ry = y + 24;
        ui_rect(x, y, w, h, rgb5551(34, 34, 38)); ui_frame(x, y, w, h, BLACK, 2); ui_text(SCREEN_W / 2, y + 6, "Game Menu", WHITE, UI_CENTER);
        for (int i = 0; i < MI_COUNT; i++) {
            if (!menu_item_shown(i)) continue; const bool sel = i == menu.sel;
            ui_rect(x + 12, ry, w - 24, rh - 2, sel ? rgb5551(170, 30, 30) : BLACK); ui_frame(x + 12, ry, w - 24, rh - 2, sel ? rgb5551(255, 80, 80) : rgb5551(200, 200, 200), 1);
            ui_text(SCREEN_W / 2, ry + 2, MENU_LABEL(i, buf), WHITE, UI_CENTER); ry += rh;
        }
    } else if (menu.open) {
        static const char *HELP[] = { "Control Stick  move", "A  jump (hold to keep hopping)", "Z  dodge roll (in the air too)", "B  swing", "C left / right  turn the camera", "C up / down  tilt the camera",
                                      "R / L  zoom in / out", "START  Game Menu", "", "Red means danger.", "Walk into the truss to climb it." };
        const int n = sizeof HELP / sizeof *HELP, w = 216, h = 26 + n * (FH + 1) + 8, x = (SCREEN_W - w) / 2, y = (SCREEN_H - h) / 2;
        ui_rect(x, y, w, h, rgb5551(34, 34, 38)); ui_frame(x, y, w, h, BLACK, 2); ui_text(SCREEN_W / 2, y + 6, "Help", YEL, UI_CENTER);
        for (int i = 0; i < n; i++) ui_text(x + 14, y + 24 + i * (FH + 1), HELP[i], WHITE, 0);
    }
}

void game_draw(Frame *f) {
    const Character *ch = &player.ch;
    PROF_BEGIN();
    r_camera(cam.px, cam.py, cam.pz, cam.fx, cam.fy, cam.fz, 70);
    /* the sky, and far below the plate the ground that goes on for ever: its edge is the horizon */
    gfx->begin(f, hex5551(0x8fc6ef), r_shade(0x6f8a48, 0, 1, 0), cam.py > -30 ? r_horizon() : SCREEN_H);
    draw_world();
    PROF_END(1);
    const bool fp = cam.dist < 1.4f;   /* first person: zoomed all the way in, your body's hidden (as in Roblox) */
    if (!ch->dead) { draw_shadow(ch->x, ch->y - 1, ch->z, 1.5f); if (!fp) draw_rig(ch->x, ch->y, ch->z, ch->faceYaw, &player.rig, &GRUG, player.rolling, player.rollT / DASH.T, player.rollFx, player.rollFz, player.hitFx > 0.08f); }
    if (dummy.hp > 0) { draw_shadow(dummy.x, dummy.y - 1, dummy.z, 1.5f); draw_rig(dummy.x, dummy.y, dummy.z, dummy.yaw, &dummy.rig, &DUMMY_LOOK, false, 0, 0, 0, dummy.hitFx > 0.04f); }
    for (int i = 0; i < nPieces; i++) { Piece *p = &pieces[i]; Mat3 e, m; m3_euler(&e, p->e[0], p->e[1], p->e[2]); m3_mul(&m, &e, &p->m0); r_obox(p->p, &m, p->h[0], p->h[1], p->h[2], p->color, false); }
    for (int i = 0; i < nCoins; i++) {   /* coins: they spin and bob */
        const Coin *c = &coins[i]; if (c->t > 0) continue;
        float dx = c->x - cam.px, dz = c->z - cam.pz; if (dx * dx + dz * dz > 150 * 150) continue;
        Mat3 m; m3_rot_y(&m, gclock * 3 + c->x); const float p[3] = { c->x, c->y + sinf(gclock * 2 + c->x) * 0.3f, c->z };
        r_obox(p, &m, 0.95f, 0.95f, 0.16f, 0xffd23a, false);
    }
    gfx->end3d();
    PROF_END(2);
    if (!game_hide_hud) draw_hud();
    PROF_END(3);
}

void game_debug(GameDebug *d) {
    const Character *ch = &player.ch;
    *d = (GameDebug){ ch->x, ch->y, ch->z, ch->vy, cam.yaw, cam.pitch, cam.dist, player.hp, player.coinCount, ch->grounded, ch->dead, menu.open, ch->lastHeight, ch->lastDist };
}
void game_teleport(float x, float y, float z, float camYaw) { Character *ch = &player.ch; ch->x = x; ch->y = y; ch->z = z; ch->vx = ch->vy = ch->vz = 0; ch->grounded = false; cam.yaw = camYaw; cam.init = false; }
void game_camera(float yaw, float pitch, float dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = cam.tdist = dist; cam.init = false; }
