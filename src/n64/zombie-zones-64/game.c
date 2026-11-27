/* =====================================================================================================================
   ZOMBIE ZONES 64: a Grug game for the Nintendo 64, started from Grug Baseplate 64 (src/n64/README.md has the rules).

   WHAT THE GAME IS: Zombie Zones (arcade/zombie-zones/) in its first mode, the Supply Run, for one player. You are on
   the Blue team. Zone 1 is a town full of zombies and red supply crates: walk near a crate to pull it in (10 at most),
   take it home and walk onto your base's pad to store it. Every crate stored is a point; the most points when the five
   minutes are up wins. The other three teams' runners are not on the screen, but their totals climb on the scoreboard.
   B fires your rifle at the zombie you are facing (it never runs out, it reloads); up close B is a bash that knocks the
   zombie back. Zombies can't get into your base, and you heal fast in there. Go down and you drop what you carry, and
   start again at your base.

   THE AREAS: BLUE SIDE (your base, its yard and pad, a few houses and three slow zombies) - ZONE 1: OLD TOWN (twelve
   roofless houses, walkers and runners) - ZONE 1: THE MARKET (deeper: more supply, more zombies, Tanks). Doors join them.

   Left out of the web game (see README.md): the other modes (capture the flag, deathmatch, survival), the other players
   and bots, jumpers and spitters, the other guns, loot, special rounds and ammo boxes, breakable blocks, windows, the
   quest log, XP and saving. Walking is the kit's 16 studs a second (the web game walks at 24), so the zombies are slowed
   to match.

   What every Grug 64 game has is all still here: the classic R6 Humanoid physics (kit/phys.c: walk 16, jump 7.2 studs,
   gravity 196.2, 240 Hz), the dodge roll, the swing and the training dummy, health, damage pads and kill bricks, falling
   apart and respawning, jump pads, lifts, trusses, coins, doors between areas, the orbit camera, the 2010 GUI (HEALTH
   squares, the Game Menu with its stress test), the player voices and the two soft sounds, and the outfit the player
   picked on the site. The game itself is between the marks: THIS GAME'S AREAS.

   No title screen: the game starts straight in play, like every Grug game.
   ===================================================================================================================== */
#include <math.h>
#include <string.h>
#include <stdio.h>
#include "game.h"
#include "phys.h"
#include "audio.h"
#include "outfit.h"

#define PI_F 3.14159265358979f
static inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
static inline float approach(float v, float t, float step) { return v + clampf(t - v, -step, step); }

bool game_hw_ok, game_use_hw, game_hide_hud, game_kbd;
GameStat game_stat;
static Outfit fit;            /* what you wear (the ROM's outfit slot) */
static SlotConfig cfg;
void game_slot(const uint8_t *slot, int size) { slot_read(slot, size, &fit, &cfg); r_tex_reset(); }
float game_fps;
uint32_t (*game_clock_us)(void);
static uint32_t prof[4], profT;   /* ms x 10: update, world, characters, HUD */
#define PROF_BEGIN() do { if (game_clock_us) profT = game_clock_us(); } while (0)
#define PROF_END(i) do { if (game_clock_us) { uint32_t n_ = game_clock_us(); prof[i] = (prof[i] * 7 + (n_ - profT) / 100) / 8; profT = n_; } } while (0)

/* ---------------------------------------------------------------- the world */
enum { T_NONE = 0, T_BASE, T_HURT, T_LIFT, T_FINISH, T_SPAWN };
#define MAX_PARTS 4224     /* (room for the stress test's bricks. An area of the game itself has PART_GOAL, at most PART_LIMIT: game.h) */
static Part parts[MAX_PARTS];
static World W;
#define BP 256.0f          /* the baseplate: 256 x 256 studs (the web one is 512), in 32-stud checks */
#define BT 32.0f

static const struct { float x, y, z; } SPAWN = { 0, 3.6f, 74 };   /* the back of your base's yard (HOME in the areas) */

typedef struct { const char *name, *sub, *subK; float x, z, hw, hd; } Station;   /* subK: the same line for a keyboard (0: the same) */
#define KB(n64, kbd) (game_kbd && (kbd) ? (kbd) : (n64))
static Station stations[12]; static int nStations;
typedef struct { const char *a, *b, *bK; float x, y, z, range; int st; } Bill;   /* st: the station it names (-1: none) */
static Bill bills[40]; static int nBills;

static struct { Part *part; float bottom, top, t, speed; int phase; } lift;   /* phase: 0 down, 1 rising, 2 up, 3 falling */
static Part *hurtPad, *finish;

#define SOLID (PF_COLLIDE)
/* a solid part: studs on top unless it is a thin thing lying on the ground (the track, the pads: plain, as on the web) */
static Part *part(float cx, float cy, float cz, float sx, float sy, float sz, uint32_t col) { const bool flat = sy <= 0.6f && cy < 1; return world_add(&W, cx, cy, cz, sx, sy, sz, col, K_SOLID, PF_COLLIDE | (flat ? PF_FLAT : PF_STUDS)); }
static Part *deco(float cx, float cy, float cz, float sx, float sy, float sz, uint32_t col) { return world_add(&W, cx, cy, cz, sx, sy, sz, col, K_SOLID, PF_DECO | (sy <= 0.6f && cy < 1 ? PF_FLAT : 0)); }
static void station(const char *name, const char *sub, const char *subK, float x, float z, float hw, float hd, float billY) {
    if (nStations < 12) stations[nStations++] = (Station){ name, sub, subK, x, z, hw, hd };
    if (billY > 0 && nBills < 40) bills[nBills++] = (Bill){ name, sub, subK, x, billY, z, 130, nStations - 1 };
}
static void bill(const char *a, const char *b, float x, float y, float z, float range) { if (nBills < 40) bills[nBills++] = (Bill){ a, b, 0, x, y, z, range, -1 }; }

/* ---------------------------------------------------------------- coins: pickups */
typedef struct { float x, y, z, t; } Coin;
static Coin coins[24]; static int nCoins;
static void coin(float x, float y, float z) { if (nCoins < 24) coins[nCoins++] = (Coin){ x, y + 2.4f, z, 0 }; }

/* ---------------------------------------------------------------- areas and doors
   A game is one or more AREAS. Each is a world of its own with its own part budget (PART_GOAL), built by its own function
   when you walk in, so a big game is several small places rather than one big one: only the area you are in is in memory
   or on the screen. You go between them through doors: a doorway you walk into, which puts you down in another area. */
typedef struct { const char *name; void (*build)(void); } Area;
typedef struct { float minX, maxX, minZ, maxZ, minY, maxY; int to; float tx, tz, tyaw; } Door;
static Door doors[8]; static int nDoors, area;
static struct { float x, z, yaw; bool on; } dummyAt;
/* every area starts with these two: the baseplate (drawn as grey checks: cool colours, so the red bits stand out), and far
   below it, where you fall to your death */
static void base_plate(void) {
    Part *b = world_add(&W, 0, -1, 0, BP, 2, BP, 0xa3a2a5, K_SOLID, PF_COLLIDE | PF_NOCAM); b->tag = T_BASE;
    world_add(&W, 0, -30, 0, 8000, 20, 8000, 0, K_KILL, PF_COLLIDE | PF_NOCAM | PF_HIDDEN);
}
/* a doorway standing on the ground at (cx, cz): two posts, a header and a dark opening 6 studs wide and 8 tall (4 parts).
   alongX: the doorway runs along x (you walk through it along z). Walking into the opening takes you to area `to`, standing at
   (tx, tz) and facing tyaw (0: towards -z, like the spawn; the camera comes round behind you). Put the arrival so that the
   door back is beside it, not behind it: the camera sits 22 studs behind you, and would be looking through the doorway. */
static void door(float cx, float cz, bool alongX, const char *label, int to, float tx, float tz, float tyaw) {
    const float px = alongX ? 3.5f : 0, pz = alongX ? 0 : 3.5f;
    part(cx - px, 4.5f, cz - pz, 1, 9, 1, 0x3a3a3e); part(cx + px, 4.5f, cz + pz, 1, 9, 1, 0x3a3a3e);
    part(cx, 9.5f, cz, alongX ? 8 : 1, 1, alongX ? 1 : 8, 0x3a3a3e);
    deco(cx, 4, cz, alongX ? 6 : 0.4f, 8, alongX ? 0.4f : 6, 0x101014);
    bill(label, "walk in", cx, 12.5f, cz, 110);
    if (nDoors < 8) doors[nDoors++] = (Door){ cx - (alongX ? 3 : 1.4f), cx + (alongX ? 3 : 1.4f), cz - (alongX ? 1.4f : 3), cz + (alongX ? 1.4f : 3), 0, 8, to, tx, tz, tyaw };
}

/* =====================================================================================================================
   THIS GAME'S AREAS: from here to the END mark below is the game itself: what is in each area. Everything outside these
   marks is the same in every Grug 64 game (kit/tools/new-game.py copies this file and swaps what is between the marks for
   a starter's: a spawn, a damage pad, a kill brick, a block, a coin and a dummy).

   The helpers: part(cx, cy, cz, sx, sy, sz, colour) a solid block (studs on top unless it is thin and on the ground);
   deco(...) the same, with nothing to bump into; world_add(&W, ..., K_KILL / K_PAD / K_LADDER, flags) for the other kinds;
   station(name, line, line for a keyboard, x, z, half width, half depth, sign height) names a place for the bar along the
   bottom; bill(line, small line, x, y, z, range) a sign in the air; coin(x, y, z); door(...) to another area.
   Zombie Zones adds wall(...), house(...), crate(x, z) (a supply spot), zfield(...) and zoneZ (the area's zombies).
   An area sets hurtPad, finish, lift.part and dummyAt if it has them. Count the parts: PART_GOAL (game.h) is 250 an area.
   ===================================================================================================================== */

/* ---------------------------------------------------------------- Zombie Zones: the teams, the floor, the crates
   The four teams of the web game (TEAMS there): you are Blue. The others play off the screen: their totals climb on
   the scoreboard as their runners would bring supply home. */
enum { T_DEPOT = 20, T_ZWALL };
#define TEAM_YOU 3
static const struct { const char *name; uint32_t shirt, wall, pad, mark; } TEAMS[4] = {
    { "White", 0xf2f3f3, 0xdedfe2, 0xffffff, 0xffffff }, { "Orange", 0xff8a1a, 0xe07a1e, 0xff8a1a, 0xff9a3a },
    { "Black", 0x1d1d21, 0x2c2c31, 0x26262b, 0x8a8a94 }, { "Blue", 0x1f6fe0, 0x2a64c4, 0x2f7cf0, 0x4a9bff } };
static uint32_t floorA = 0xa3a2a5, floorB = 0x9c9b9e;      /* the area's floor, in 32-stud checks */
/* the zombies an area has: how many are up at once, how tough (the web game's tier), and the mix (walkers, runners, Tanks) */
static struct { int want, tier; float runner, tank; bool base; } zoneZ;
#define BASE_MINX (-60.0f)
#define BASE_MAXX 60.0f
#define BASE_MINZ (-6.0f)
#define BASE_MAXZ 86.0f
static const struct { float x, z, yaw; } HOME = { 0, 74, 0 };   /* where you start, and start again: the back of the yard */
#define AREA_MAX 4
/* supply: red crates on spots that grow back. The spots are put down by the area's build; what is on them is kept here
   while you are in another area, so a crate you took stays taken. */
#define MAX_SPOTS 40
typedef struct { float x, z, t, px, py, pz; bool on, pull; } Spot;
static Spot spots[AREA_MAX][MAX_SPOTS]; static int nSpots[AREA_MAX], buildSpot; static bool spotsSet[AREA_MAX];
static void crate(float x, float z) { if (buildSpot < MAX_SPOTS) { Spot *s = &spots[area][buildSpot++]; s->x = x; s->z = z; } }
/* a wall: solid, no studs (its top is a stud wide: rule 6) */
static Part *wall(float cx, float cy, float cz, float sx, float sy, float sz, uint32_t col) { return world_add(&W, cx, cy, cz, sx, sy, sz, col, K_SOLID, PF_COLLIDE); }
/* a field only zombies bump into (the base's doorways): nothing to see but a pale strip on the floor */
static void zfield(float cx, float cz, float sx, float sz) {
    Part *f = world_add(&W, cx, 6, cz, sx, 12, sz, 0, K_SOLID, PF_HIDDEN | PF_NOCAM); f->tag = T_ZWALL;
    deco(cx, 0.22f, cz, sx < 2 ? 2 : sx, 0.04f, sz < 2 ? 2 : sz, 0x7fc8ff);
}
/* a roofless house (the web game's houses, without the windows): a floor, walls 9 studs high, a doorway 7 wide in the
   middle of one side (side 0: -z, 1: +z, 2: -x, 3: +x), and two crates inside. 6 parts. */
static void house(float cx, float cz, float w, float d, int side, uint32_t col, bool food) {
    const float H = 9, T = 1, DW = 7;
    deco(cx, 0.1f, cz, w, 0.2f, d, 0x8a7a64);
    for (int s = 0; s < 4; s++) {
        const bool alongX = s < 2; const float c = s == 0 ? cz - d / 2 + T / 2 : s == 1 ? cz + d / 2 - T / 2 : s == 2 ? cx - w / 2 + T / 2 : cx + w / 2 - T / 2;
        const float lo = alongX ? cx - w / 2 : cz - d / 2 + T, hi = alongX ? cx + w / 2 : cz + d / 2 - T, m = (lo + hi) / 2;
        if (s != side) { alongX ? wall(m, H / 2, c, hi - lo, H, T, col) : wall(c, H / 2, m, T, H, hi - lo, col); continue; }
        const float a0 = lo, a1 = m - DW / 2, b0 = m + DW / 2, b1 = hi;
        if (alongX) { wall((a0 + a1) / 2, H / 2, c, a1 - a0, H, T, col); wall((b0 + b1) / 2, H / 2, c, b1 - b0, H, T, col); }
        else { wall(c, H / 2, (a0 + a1) / 2, T, H, a1 - a0, col); wall(c, H / 2, (b0 + b1) / 2, T, H, b1 - b0, col); }
    }
    if (food) { const bool wide = w >= d; crate(cx - (wide ? w / 4 : 0), cz - (wide ? 0 : d / 4)); crate(cx + (wide ? w / 4 : 0), cz + (wide ? 0 : d / 4)); }
}
/* the wall round the whole area */
static void outer_walls(void) {
    const uint32_t c = 0x8e9096; const float E = BP / 2 - 2;   /* (12 studs, not the web's 20: a tall wall right across the screen is pixels the emulator has to fill) */
    wall(0, 6, -E, BP, 12, 4, c); wall(0, 6, E, BP, 12, 4, c); wall(-E, 6, 0, 4, 12, BP - 8, c); wall(E, 6, 0, 4, 12, BP - 8, c);
}


/* BLUE SIDE: your team's side of the map. The base (the web game's: a walled yard 120 x 92, open toward Zone 1 and on
   both flanks, the openings closed to zombies), the pad you store supply on, the flag stand, and out front the road to
   Zone 1 with a door into each part of the town. */
static void build_base(void) {
    base_plate(); floorA = 0x45a243; floorB = 0x4ba84a; outer_walls();
    const uint32_t col = TEAMS[TEAM_YOU].wall;
    deco(0, 0.1f, 40, BASE_MAXX - BASE_MINX - 2, 0.2f, BASE_MAXZ - BASE_MINZ - 2, 0x9a9ca2);   /* the yard's floor */
    wall(-38, 6, BASE_MINZ, 46, 12, 2, col); wall(38, 6, BASE_MINZ, 46, 12, 2, col); zfield(0, BASE_MINZ, 30, 1);   /* the front, open toward Zone 1 */
    wall(0, 6, BASE_MAXZ, 122, 12, 2, col);                                                                          /* the back */
    for (int sx = -1; sx <= 1; sx += 2) { wall(sx * 60, 6, 13, 2, 12, 36, col); wall(sx * 60, 6, 67, 2, 12, 36, col); zfield(sx * 60, 40, 1, 18); }   /* the flanks */
    { Part *pad = part(0, 0.2f, 30, 24, 0.3f, 24, TEAMS[TEAM_YOU].pad); pad->tag = T_DEPOT; }
    station("SUPPLY PAD", "walk on with supply to store it", 0, 0, 30, 12, 12, 0);
    bill("SUPPLY PAD", "store supply here", 0, 6, 30, 120);
    part(0, 0.5f, 62, 5, 1, 5, 0x5e5c5a); deco(0, 6, 62, 0.6f, 10, 0.6f, 0x5e5c5a); deco(1.9f, 9.6f, 62, 3.2f, 2, 0.3f, TEAMS[TEAM_YOU].shirt);   /* the flag stand */
    for (int sx = -1; sx <= 1; sx += 2) { deco(sx * 46, 14, 80, 1.2f, 28, 1.2f, 0x5e5c5a); deco(sx * 46, 24, 79, 10, 7, 0.6f, TEAMS[TEAM_YOU].shirt); }   /* banners in the back corners */
    bill("BLUE BASE", "zombies can't get in", 0, 20, 80, 220);
    { Part *sp = part(HOME.x, 0.3f, HOME.z, 12, 0.6f, 12, 0x6e6e72); sp->tag = T_SPAWN; sp->flags |= PF_STUDS; }
    station("BLUE BASE", "zombies can't get in - you heal fast here", 0, 0, 40, 60, 46, 0);
    /* out front: a few houses for cover, cover blocks, the edge of Zone 1, and the doors into it */
    house(-92, 30, 24, 20, 3, 0xc9b38a, false); house(92, 30, 24, 20, 2, 0x8a9fb5, false);
    house(-90, -50, 20, 24, 3, 0xd8d8d8, false); house(90, -50, 22, 22, 2, 0xb5a27a, false);
    static const float BLK[6][2] = { { -38, -36 }, { 44, -30 }, { -66, -84 }, { 70, -86 }, { 0, -62 }, { -100, -10 } };
    for (int i = 0; i < 6; i++) part(BLK[i][0], 5, BLK[i][1], 10, 10, 10, 0x9a6b45);
    deco(0, 0.06f, -98, BP - 8, 0.12f, 2, 0xffd24a)->flags |= PF_FLAT;
    bill("ZONE 1", "supply - zombies", 0, 9, -98, 200);
    door(-30, -114, true, "OLD TOWN", 1, -6, 104, 0);
    door(30, -114, true, "THE MARKET", 2, -6, 104, 0);
    station("BLUE SIDE", "Zone 1 is through the doors to the north", 0, 0, 0, 128, 128, 0);
    zoneZ.want = 3; zoneZ.tier = 1; zoneZ.runner = 0; zoneZ.tank = 0; zoneZ.base = true;
}

/* ZONE 1: the town. A plate of grey streets round two clear roads, roofless houses on the lots between with supply in
   every one, crates lying about in the open, and cover blocks. The two parts are built the same way from their own
   numbers (a fixed seed each, so a part is the same every time you walk in). */
static uint32_t lot_seed;
static float lot_rnd(void) { lot_seed = lot_seed * 1103515245u + 12345u; return ((lot_seed >> 9) & 0xffff) / 65536.0f; }
static void town(uint32_t seed, int otherArea, const char *otherName, int extra) {
    static const uint32_t WALLS[6] = { 0xc9b38a, 0xa34b4b, 0xd8d8d8, 0x8a9fb5, 0x9a6b45, 0xb5a27a };
    base_plate(); floorA = 0x5d5f63; floorB = 0x63656a; outer_walls(); lot_seed = seed;
    deco(0, 0.06f, 0, 24, 0.12f, BP - 8, 0x4a4b4f)->flags |= PF_FLAT; deco(0, 0.07f, 0, BP - 8, 0.12f, 24, 0x4a4b4f)->flags |= PF_FLAT;   /* the two roads */
    part(0, 0.15f, 0, 30, 0.3f, 30, 0x8e9096);   /* the plaza where they cross */
    /* the lots: three rows a side of the north-south road, two south of the east-west one (the arrival lane stays clear) */
    static const float LX[4] = { -92, -46, 46, 92 }, LZ[4] = { -96, -48, 44, 88 };
    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
        if (j == 3 && (i == 1 || i == 2)) continue;           /* the lane from the doors */
        if (j == 3 && extra < 2) continue;
        const float x = LX[i] + (lot_rnd() - 0.5f) * 8, z = LZ[j] + (lot_rnd() - 0.5f) * 8;
        const float w = 20 + 2 * (int)(lot_rnd() * 5), d = 18 + 2 * (int)(lot_rnd() * 5);
        const int side = fabsf(x) <= fabsf(z) ? (x < 0 ? 3 : 2) : (z < 0 ? 1 : 0);   /* the door faces the nearer road */
        house(x, z, w, d, side, WALLS[(int)(lot_rnd() * 6)], true);
    }
    /* cover blocks beside the roads, and supply in the open */
    static const float BLK[8][2] = { { 18, -66 }, { -18, -72 }, { 18, 60 }, { -18, 54 }, { -66, 18 }, { -72, -18 }, { 64, -18 }, { 72, 18 } };
    for (int i = 0; i < 8; i++) part(BLK[i][0], 5, BLK[i][1], 10, 10, 10, WALLS[1]);
    static const float OPEN[10][2] = { { 0, -60 }, { 8, -110 }, { -60, 0 }, { 60, 6 }, { -110, -4 }, { 110, 0 }, { -6, 30 }, { 30, -30 }, { -30, 32 }, { 0, 70 } };
    for (int i = 0; i < 6 + extra * 2; i++) crate(OPEN[i][0], OPEN[i][1]);
    /* where you come in, and the doors out (beside where you arrive: the camera sits behind you) */
    deco(-6, 0.25f, 104, 10, 0.5f, 10, 0x6e6e72); deco(34, 0.25f, 104, 10, 0.5f, 10, 0x6e6e72);
    door(-20, 114, true, "BLUE BASE", 0, -16, -104, PI_F);
    door(20, 114, true, otherName, otherArea, 34, 104, 0);
}
static void build_old_town(void) {
    town(0x2611u, 2, "THE MARKET", 1);
    bill("OLD TOWN", "supply in every house", 0, 12, 0, 220);
    station("ZONE 1: OLD TOWN", "grab red crates - take them home to the pad", 0, 0, 0, 128, 128, 0);
    zoneZ.want = 7; zoneZ.tier = 2; zoneZ.runner = 0.25f; zoneZ.tank = 0; zoneZ.base = false;
}
static void build_market(void) {
    town(0x1122u, 1, "OLD TOWN", 2);
    for (int k = 0; k < 4; k++) { const float a = k * PI_F / 2 + PI_F / 4; part(cosf(a) * 9, 1.5f, sinf(a) * 9, 6, 3, 4, 0x9a6b45); }   /* the market stalls on the plaza */
    crate(0, 0); crate(-3, 4);
    bill("THE MARKET", "deeper in: more supply, Tanks", 0, 12, 0, 220);
    station("ZONE 1: THE MARKET", "more supply - and Tanks: keep moving", 0, 0, 0, 128, 128, 0);
    zoneZ.want = 9; zoneZ.tier = 3; zoneZ.runner = 0.3f; zoneZ.tank = 0.18f; zoneZ.base = false;
}
static const Area AREAS[] = { { "BLUE SIDE", build_base }, { "ZONE 1: OLD TOWN", build_old_town }, { "ZONE 1: THE MARKET", build_market } };
#define N_AREAS ((int)(sizeof AREAS / sizeof AREAS[0]))

/* ======================================================= END of this game's areas ======================================= */

/* ---------------------------------------------------------------- the stress test: how many bricks can there be?
   A world of nothing but bricks: 4 x 4 studs each, 1 to 6 tall, studs on top, solid, on an 8-stud grid over the whole
   plate, spread evenly however many there are (the next 900 stack on the first). The Game Menu picks how many and the FPS
   row says what it costs. */
static int stressN; static char stressSub[48];
static const int STRESS_STEPS[SWEEP_COUNTS] = { 0, 100, 250, 500, 1000, 2000, 4000 };
static void build_stress(int n) {
    world_init(&W, parts, MAX_PARTS); nStations = nBills = nCoins = nDoors = 0; lift.part = 0; hurtPad = finish = 0; dummyAt.on = false;
    base_plate(); floorA = 0xa3a2a5; floorB = 0x9c9b9e; zoneZ.want = 0; zoneZ.base = false; nSpots[area] = 0;
    { Part *sp = part(0, 0.3f, 0, 12, 0.6f, 12, 0x6e6e72); sp->tag = T_SPAWN; sp->flags |= PF_STUDS; }
    if (n > MAX_PARTS - 8) n = MAX_PARTS - 8;
    snprintf(stressSub, sizeof stressSub, "%d bricks - Game Menu: more or fewer", n);
    station("STRESS TEST", stressSub, 0, 0, 0, 400, 400, 0);
    static const uint32_t COLS[8] = { 0x0d69ac, 0x4b974b, 0xf5cd30, 0xc4281c, 0xda8541, 0x6b327c, 0xf2f3f3, 0x1b2a35 };
    static uint8_t top[900]; memset(top, 0, sizeof top);
    for (int k = 0, put = 0; put < n && k < 900 * 12; k++) {
        const int cell = (k % 900) * 577 % 900, cx = cell % 30, cz = cell / 30; const float x = -116 + cx * 8.0f, z = -116 + cz * 8.0f;
        if (fabsf(x) < 14 && fabsf(z) < 14) continue;   /* room to stand at the spawn */
        const uint32_t hsh = (uint32_t)(k * 2654435761u) >> 8; const int h = 1 + hsh % 6;
        part(x, top[cell] + h * 0.5f, z, 4, h, 4, COLS[(hsh >> 5) % 8]); top[cell] += h; put++;
    }
}

static void update_lift(float dt) {
    Part *p = lift.part; if (!p) return;
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
typedef struct { uint32_t skin, shirt, pants, shoes, hair; const Outfit *fit; } Look;   /* fit: the outfit it wears (0: the plain colours) */
static Look GRUG = { 0xeab892, 0x9ccb3b, 0x3d3d42, 0xf2f3f3, 0x4a2c1a, 0 };
static const Look DUMMY_LOOK = { 0xf5cd30, 0x0d69ac, 0x27466a, 0x1b2a35, 0x1b2a35, 0 };
typedef struct { float rs, ls, rh, lh; } Joints;
typedef struct { Joints j; float walkT; } Rig;

#define MAXHP 100   /* health, as on the web (the HUD's five squares are 20 each) */
#define BAG 10
static struct {
    Character ch; Rig rig; float hp; int coinCount; float hitFx; bool wasDead; float hurtAcc;
    int supply, stored, kills, mag; float fireCd, reloadT, idleT, aimT, aimYaw, sinceHit, protect;
    bool rolling; float rollT, rollFx, rollFz;
    float dashCd, swingCd, swingT; bool swingHit;
    bool onFinish;
} player;
static struct { float x, y, z, yaw; Rig rig; int hp; float hitFx, t; } dummy;
static const struct { float T, V, CD; } DASH = { 0.3f, 42, 0.75f };            /* the dodge roll (Zombie Zones' speed, time and wait) */
static const struct { float T, CD, REACH; int DMG; } SWING = { 0.32f, 0.5f, 7.5f, 34 };
static const struct { float T, CD, REACH; int DMG; float KNOCK; } BASH = { 0.32f, 0.7f, 7.5f, 35, 40 };   /* up close, B bashes (the web game's V): 35, and a shove */
/* the rifle (the web game's: 20 a hit, 15 a magazine, 1.8 s to reload, a shot every 0.11 s, 85 studs). It never runs out. */
static const struct { float DMG, CD, RELOAD, RANGE; int MAG; } RIFLE = { 20, 0.11f, 1.8f, 85, 15 };

/* ---------------------------------------------------------------- Zombie Zones: the zombies
   A simple version of the web game's: they rise out of the ground away from you, shamble about, and once you are within
   70 studs (400 once you have shot one) they come for you, round walls, and swing when they are close. They can't get
   into your base and they don't go for you in there. Walkers, Runners (faster than you) and Tanks (big, slow and hard
   to put down), at the web game's speeds slowed by 16 / 24, since you walk at the kit's 16 and not the web game's 24.
   They move on the flat ground with a push out of every wall, not the full physics: they don't jump. */
enum { ZK_WALKER, ZK_RUNNER, ZK_TANK };
static const struct { const char *name; float hp, dmg, speed, atkCd, reach, scale; uint32_t skin; } ZKIND[3] = {
    { "Zombie", 50, 10, 11, 1.1f, 3.8f, 1, 0x7fa65a }, { "Runner", 35, 8, 20, 0.8f, 3.6f, 0.92f, 0x9bb86a }, { "Tank", 260, 30, 8, 1.6f, 4.9f, 1.45f, 0x5d7f45 } };
#define ZSPEED (16.0f / 24.0f)
#define MAX_Z 10
typedef struct {
    int state, kind;                  /* state: 0 down (t: till it rises again), 1 rising, 2 up */
    float x, z, yaw, s, hp, maxHp, dmg, speed, t;
    float atkT, atkCd, angryT, hitFx, kx, kz, knockT, wx, wz, wanderT, thinkT, sdx, sdz, side, sideT;
    bool atkHit, chase; Rig rig; Look look;
} Zombie;
static Zombie zs[MAX_Z];

/* falling apart (the classic death): every body part comes off and tumbles */
typedef struct { float p[3], v[3], e[3], w[3], h[3], t, floor; Mat3 m0; uint32_t color; const Tex *tex; const TexRect *rects; const Outfit *head; } Piece;
static Piece pieces[12]; static int nPieces;

/* damage numbers, announcements */
typedef struct { float x, y, z, t; char s[6]; } DmgNum;
static DmgNum dmg[6];
static struct { const char *big, *small; uint16_t color; float t; } ann;
static float hintT = 9, gclock;

/* ---------------------------------------------------------------- the camera: the Roblox orbit cam */
static struct { float yaw, pitch, dist, tdist, fx, fy, fz; bool init; float px, py, pz; float zoomRep; } cam = { 0, 0.32f, 22, 22, 0, 4, 0, false, 0, 0, 0, 0 };
#define CAM_STICK 6.0f   /* radians a second with the camera stick right over (keep CAM_STICK in arcade/grug-64/index.html the same) */
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
enum { MI_RESUME, MI_RESET, MI_VOICES, MI_PITCH, MI_STUDS, MI_RENDER, MI_FPS, MI_STRESS, MI_HELP, MI_COUNT };
static struct { bool open, help, fps; int sel; float rep; } menu;
static bool menu_item_shown(int i) { return i != MI_HELP && (i != MI_RENDER || game_hw_ok); }   /* (no Help row: the controls are on the Arcade's page) */

/* ---------------------------------------------------------------- start */
static void announce(const char *big, const char *small, uint16_t color, float t);
/* a world to play in: the zoo, or the stress test's bricks. You start at the spawn. */
static bool dummyOn;
/* build an area (or the stress test's bricks) in place of the world there was. Whoever is in it must be put somewhere after. */
static float doorCd;
static void zombies_reset(void);
static void load_area(int a, int bricks) {
    area = a; stressN = bricks;
    if (bricks > 0) build_stress(bricks);
    else {
        world_init(&W, parts, PART_LIMIT); nStations = nBills = nCoins = nDoors = 0; lift.part = 0; hurtPad = finish = 0; dummyAt.on = false;
        buildSpot = 0; AREAS[a].build(); nSpots[a] = buildSpot;
        if (!spotsSet[a]) { spotsSet[a] = true; for (int i = 0; i < nSpots[a]; i++) { Spot *s = &spots[a][i]; s->on = frand() < 0.85f; s->t = frange(2, 12); } }   /* most of them full at the start of a round */
        for (int i = 0; i < nSpots[a]; i++) spots[a][i].pull = false;
    }
    zombies_reset();
    dummyOn = dummyAt.on; dummy.x = dummyAt.x; dummy.y = 3; dummy.z = dummyAt.z; dummy.yaw = dummyAt.yaw; dummy.hp = dummyOn ? 100 : 0; dummy.t = 0; dummy.hitFx = 0; memset(&dummy.rig, 0, sizeof dummy.rig);
    Character *ch = &player.ch; ch->ground = 0; ch->ladder = 0; ch->climbing = false; ch->grounded = false; ch->nNear = 0;   /* (they pointed into the old world) */
    nPieces = 0; memset(dmg, 0, sizeof dmg);
    game_stat.parts = (uint32_t)W.n; game_stat.stress = (uint32_t)bricks;
}
/* through a door: the other area is built and you are stood in it, as you were (health, coins), and respawn there from now on */
static float ground_below(float x, float y, float z);
static void go_area(int a, float x, float z, float yaw) {
    if (a < 0 || a >= N_AREAS) return;
    load_area(a, 0);
    Character *ch = &player.ch; ch->x = ch->spawnX = x; ch->z = ch->spawnZ = z; ch->y = ch->spawnY = ground_below(x, 200, z) + BODY_ROOT_TO_FEET + 0.05f;
    ch->vx = ch->vy = ch->vz = 0; ch->dashT = 0; ch->faceYaw = yaw; player.rolling = false; player.onFinish = false;
    cam.yaw = yaw; cam.init = false; doorCd = 0.6f; aud_tap(S_TAP_OPEN);
}
static void enter_world(int bricks) {
    load_area(0, bricks);
    memset(&player, 0, sizeof player);
    char_init(&player.ch, SPAWN.x, SPAWN.y, SPAWN.z, 0); player.hp = MAXHP; player.hurtAcc = 0.6f; player.mag = RIFLE.MAG;
    ann.t = 0;
    cam.yaw = 0; cam.pitch = 0.32f; cam.dist = cam.tdist = 22; cam.init = false;
}
int game_areas(void) { return N_AREAS; }
const char *game_area_name(int a) { return a >= 0 && a < N_AREAS ? AREAS[a].name : ""; }
void game_area(int a) { go_area(a, SPAWN.x, SPAWN.z, 0); }
void game_stress(int bricks) { enter_world(bricks); }

/* the sweep (a test asks for it through the outfit slot): every brick count, from the spawn and from high above, with studs
   and without. Each step settles for a second, then counts frames for three; the results go in game_stat. */
static struct { bool on; int step; float t, time; int frames; uint32_t polys, ms; } sweep;
#define SWEEP_STEPS (SWEEP_COUNTS * 4)
static void sweep_step(void) {
    const int i = sweep.step, n = STRESS_STEPS[i % SWEEP_COUNTS], view = (i / SWEEP_COUNTS) & 1, plain = i / (SWEEP_COUNTS * 2);
    enter_world(n); r_studs = !plain; menu.fps = true;
    if (view) { cam.pitch = 1.1f; cam.dist = cam.tdist = 90; }
    sweep.t = 0; sweep.time = 0; sweep.frames = 0; sweep.polys = 0; sweep.ms = 0; game_stat.sweepAt = (uint32_t)i;
}
static void sweep_update(float rawDt) {
    sweep.t += rawDt; if (sweep.t < 1) return;
    sweep.time += rawDt; sweep.frames++; sweep.polys += (uint32_t)r_polys; sweep.ms += prof[1];
    if (sweep.time < 3) return;
    game_stat.sweepFps[sweep.step] = (uint32_t)(sweep.frames / sweep.time * 100 + 0.5f); game_stat.sweepPolys[sweep.step] = sweep.polys / (uint32_t)sweep.frames; game_stat.sweepMs[sweep.step] = sweep.ms / (uint32_t)sweep.frames;
    if (++sweep.step >= SWEEP_STEPS) { sweep.on = false; game_stat.sweepDone = 1; r_studs = true; enter_world(0); } else sweep_step();
}

/* ---------------------------------------------------------------- start */
static void zz_reset(void); static void round_start(void);
void game_init(uint32_t seed) {
    rng_seed(seed);
    GRUG.fit = fit.ok ? &fit : 0; if (fit.ok) { GRUG.skin = fit.skin; GRUG.hair = fit.hair; }
    memset(&menu, 0, sizeof menu); memset(&sweep, 0, sizeof sweep);
    hintT = 0; gclock = 0;   /* (no hints on the screen: the controls are on the Arcade's page, beside the game) */
    zz_reset();
    enter_world(cfg.stress);
    if (cfg.view) { player.ch.x = player.ch.spawnX = cfg.x; player.ch.z = player.ch.spawnZ = cfg.z; cam.yaw = cfg.yaw; cam.pitch = clampf(cfg.pitch, -1.2f, 1.396f); if (cfg.dist > 0) cam.dist = cam.tdist = clampf(cfg.dist, 0.5f, 90); }
    if (cfg.stress || cfg.sweep) menu.fps = true;
    if (cfg.sweep) { sweep.on = true; sweep_step(); }
    game_stat.m0 = 0x47525547; game_stat.m1 = 0x53544131; game_stat.outfit = fit.ok; game_stat.frames = 0; game_stat.sweepDone = 0;
    aud_init();
    round_start();
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
typedef struct { float c[3]; Mat3 m; float h[3]; uint32_t color; int group; const Tex *tex; const TexRect *rects; const Outfit *head; } Block;   /* group: 0 torso, 1 head, 2 right arm, 3 left arm, 4 right leg, 5 left leg. tex + rects: the picture it wears; head: it is this outfit's head */
static int rig_blocks(Block *out, float x, float y, float z, float yaw, const Rig *r, const Look *L, bool rolling, float rollK, float rollFx, float rollFz, bool detail) {
    Mat3 root; m3_rot_y(&root, yaw); float ry = y; int n = 0;
    if (rolling) {   /* the dodge roll: a tucked somersault the way you're rolling */
        float c = cosf(yaw), s = sinf(yaw), lx = rollFx * c - rollFz * s, lz = rollFx * s + rollFz * c, l = sqrtf(lx * lx + lz * lz); if (l < 1e-4f) { lz = -1; lx = 0; l = 1; }
        Mat3 roll; m3_axis_angle(&roll, lz / l, 0, -lx / l, PI_F * 2 * (rollK * rollK * (3 - 2 * rollK))); m3_mul(&root, &root, &roll);
        ry = y - 1.3f * sinf(PI_F * rollK);
    }
#define BLK(lx_, ly_, lz_, M, hx_, hy_, hz_, col, grp) do { float l_[3] = { lx_, ly_, lz_ }, w_[3]; m3_apply(&root, l_, w_); Block *b_ = &out[n++]; \
        b_->c[0] = x + w_[0]; b_->c[1] = ry + w_[1]; b_->c[2] = z + w_[2]; b_->m = (M); b_->h[0] = hx_; b_->h[1] = hy_; b_->h[2] = hz_; b_->color = col; b_->group = grp; b_->tex = 0; b_->rects = 0; b_->head = 0; } while (0)
    const Outfit *o = L->fit;
    BLK(0, 0, 0, root, 1, 1, 0.5f, L->shirt, 0); if (o) { out[n - 1].tex = &o->shirt; out[n - 1].rects = FIT_TORSO; }
    if (o && detail) { BLK(0, o->headY, 0, root, 0.7f, 0.7f, 0.7f, L->skin, 1); out[n - 1].head = o; }   /* the outfit's own head (far off: a block, below) */
    else BLK(0, 1.6f, 0, root, 0.6f, 0.6f, 0.6f, L->skin, 1);
    if (detail && !o) {
        BLK(0.22f, 1.68f, -0.61f, root, 0.07f, 0.11f, 0.02f, 0x1d1d1f, 1); BLK(-0.22f, 1.68f, -0.61f, root, 0.07f, 0.11f, 0.02f, 0x1d1d1f, 1); BLK(0, 1.4f, -0.61f, root, 0.2f, 0.04f, 0.02f, 0x1d1d1f, 1);
    }
    const float ang[4] = { r->j.rs, r->j.ls, r->j.rh, r->j.lh }, px[4] = { 1.5f, -1.5f, 0.5f, -0.5f }, py[4] = { 0.5f, 0.5f, -1, -1 };
    for (int i = 0; i < 4; i++) {
        Mat3 lr, m; m3_rot_x(&lr, ang[i]); m3_mul(&m, &root, &lr);
        const bool arm = i < 2; const float top = arm ? 0.5f : 0, split = arm ? -1.1f : -1.55f, bot = arm ? -1.5f : -2;   /* sleeve + hand, jeans + shoe */
        if (o) {   /* one block a limb: the picture has the hand and the shoe on it */
            float lc[3] = { 0, (top + bot) / 2, 0 }, q[3]; m3_apply(&lr, lc, q);
            BLK(px[i] + q[0], py[i] + q[1], q[2], m, 0.5f, (top - bot) / 2, 0.5f, arm ? L->shirt : L->pants, 2 + i); out[n - 1].tex = arm ? &o->shirt : &o->pants; out[n - 1].rects = (i & 1) ? FIT_LIMB_B : FIT_LIMB_A;
            continue;
        }
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
    Block b[16]; int n = rig_blocks(b, x, y, z, yaw, r, L, false, 0, 0, 0, L->fit != 0);
    for (int i = 0; i < n && nPieces < 12; i++) {
        Piece *p = &pieces[nPieces++]; memcpy(p->p, b[i].c, sizeof p->p); memcpy(p->h, b[i].h, sizeof p->h); p->m0 = b[i].m; p->color = b[i].color; p->tex = b[i].tex; p->rects = b[i].rects; p->head = b[i].head;
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
static void hurt(float n) {   /* health: 100, drawn as five squares of 20 */
    Character *ch = &player.ch; if (ch->dead || player.protect > 0) return;
    player.hp -= n; if (player.hp < 0) player.hp = 0; player.hitFx = 0.3f; player.sinceHit = 0;
    dmg_add(ch->x, ch->y + 3, ch->z, (int)(n + 0.5f), true); aud_play(S_HIT, 1, 0, 0);
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
/* ---------------------------------------------------------------- Zombie Zones: the zombies at work */
static bool in_base(float x, float z) { return zoneZ.base && x > BASE_MINX && x < BASE_MAXX && z > BASE_MINZ && z < BASE_MAXZ; }
static bool zblocks(const Part *p) { return ((p->flags & PF_COLLIDE) && p->maxY > 1.2f && p->minY < 6) || p->tag == T_ZWALL; }   /* walls, blocks, the base's doorways: what a zombie bumps into */
static bool zone_free(float x, float z, float r) {
    for (int i = 0; i < W.n; i++) { const Part *p = &W.parts[i]; if (zblocks(p) && x + r > p->minX && x - r < p->maxX && z + r > p->minZ && z - r < p->maxZ) return false; }
    return true;
}
static int zombies_up(int *tanks) { int n = 0; if (tanks) *tanks = 0; for (int i = 0; i < MAX_Z; i++) if (zs[i].state) { n++; if (tanks && zs[i].kind == ZK_TANK) (*tanks)++; } return n; }
static void zombie_rise(Zombie *q, float x, float z, int kind) {
    static const uint32_t SHIRTS[7] = { 0x5a4a3a, 0x4a5560, 0x6b4040, 0x3e4f3a, 0x7a6a55, 0x58506a, 0x8a8070 }, PANTS[4] = { 0x2c2c3a, 0x3a3226, 0x26303a, 0x403a30 };
    const float t = (float)zoneZ.tier;
    memset(q, 0, sizeof *q); q->state = 1; q->t = 0.5f; q->kind = kind; q->x = x; q->z = z; q->yaw = frange(0, 6.28f); q->s = ZKIND[kind].scale;
    q->maxHp = q->hp = ZKIND[kind].hp * (1 + 0.3f * (t - 1)); q->dmg = ZKIND[kind].dmg * (1 + 0.22f * (t - 1)); q->speed = ZKIND[kind].speed * ZSPEED * (1 + 0.025f * (t - 1));
    q->atkT = -1; q->atkCd = frange(0.3f, 1); q->wanderT = 0; q->side = frand() < 0.5f ? 1 : -1;
    const uint32_t sk = ZKIND[kind].skin + (uint32_t)(frand() * 3) * 0x060a06;
    q->look = (Look){ sk, kind == ZK_TANK ? 0x3a3226 : SHIRTS[(int)(frand() * 7)], PANTS[(int)(frand() * 4)], 0x2a2620, 0, 0 };
}
/* a spot for a zombie to rise: in the area, away from you, out of your base, not in a wall */
static bool zombie_spot(float *ox, float *oz) {
    const Character *ch = &player.ch;
    for (int k = 0; k < 14; k++) {
        const float x = frange(-110, 110), z = frange(-110, 110), dx = x - ch->x, dz = z - ch->z;
        if (dx * dx + dz * dz < 50 * 50) continue;
        if (zoneZ.base && x > BASE_MINX - 24 && x < BASE_MAXX + 24 && z > BASE_MINZ - 24 && z < BASE_MAXZ + 24) continue;
        if (!zone_free(x, z, 3)) continue;
        *ox = x; *oz = z; return true;
    }
    return false;
}
static int zone_kind(void) { int tanks; zombies_up(&tanks); const float r = frand(); return r < zoneZ.tank && tanks < 2 ? ZK_TANK : r < zoneZ.tank + zoneZ.runner ? ZK_RUNNER : ZK_WALKER; }
static void zombies_reset(void) { for (int i = 0; i < MAX_Z; i++) { memset(&zs[i], 0, sizeof zs[i]); zs[i].t = i < zoneZ.want ? frange(0.2f, 2.5f) : 1e9f; } }
static void zombie_hurt(Zombie *q, float amt, bool shove, float fx, float fz) {
    if (q->state != 2) return;
    q->hp -= amt; q->hitFx = 0.15f; q->angryT = 8; q->chase = true;
    const float y = 3 * q->s; dmg_add(q->x, y + 3 * q->s, q->z, (int)(amt + 0.5f), false); world_sound(S_HIT, q->x, y, q->z, 0.8f);
    if (shove) { q->kx = fx * BASH.KNOCK; q->kz = fz * BASH.KNOCK; q->knockT = 0.4f; q->atkT = -1; }
    else if (q->knockT <= 0) { q->kx = fx * 14; q->kz = fz * 14; q->knockT = 0.07f; }
    if (q->hp <= 0) {   /* it falls apart, and another rises somewhere else a while later */
        Rig r = q->rig; break_apart(q->x, y, q->z, q->yaw, &r, &q->look, 1.2f);
        world_sound(S_THUD, q->x, y, q->z, 1); q->state = 0; q->t = frange(1.5f, 3.5f); player.kills++;
    }
}
/* where a zombie goes: straight for (gx, gz) if nothing is in the way, else round it (it keeps to one side for a while) */
static void zombie_steer(Zombie *q, float gx, float gz) {
    float dx = gx - q->x, dz = gz - q->z, d = sqrtf(dx * dx + dz * dz); if (d < 0.01f) { q->sdx = q->sdz = 0; return; }
    dx /= d; dz /= d; const float look = 5 * q->s + 2, reach = d < look ? d : look; const Part *h;
    static const float TURN[4] = { 0, 0.7f, 1.4f, 2.1f };
    for (int k = 0; k < 7; k++) {
        const float a = k == 0 ? 0 : TURN[(k + 1) / 2] * ((k & 1) ? q->side : -q->side), c = cosf(a), s = sinf(a), ux = dx * c - dz * s, uz = dx * s + dz * c;
        const float w = 1.1f * q->s; bool hit = false;   /* a path as wide as the zombie: a ray down each side of it */
        for (int e = -1; e <= 1 && !hit; e += 2) { world_raycast(&W, q->x - uz * w * e, 1.5f, q->z + ux * w * e, ux, 0, uz, reach, PF_NOCAM, &h); hit = h != 0; }
        if (!hit) { q->sdx = ux; q->sdz = uz; if (k && q->sideT <= 0) { q->side = (k & 1) ? q->side : -q->side; q->sideT = 0.8f; } return; }
    }
    q->sdx = -dz * q->side; q->sdz = dx * q->side;   /* boxed in: along the wall */
}
static void zombies_update(float dt) {
    Character *ch = &player.ch; const bool you = !ch->dead && !in_base(ch->x, ch->z);
    int up = zombies_up(0);
    for (int i = 0; i < MAX_Z; i++) {
        Zombie *q = &zs[i];
        if (q->state == 0) {
            if (i >= zoneZ.want || (q->t -= dt) > 0 || up >= zoneZ.want) continue;
            float x, z; if (zombie_spot(&x, &z)) { zombie_rise(q, x, z, zone_kind()); up++; } else q->t = 0.5f;
            continue;
        }
        if (q->state == 1) { if ((q->t -= dt) <= 0) q->state = 2; continue; }
        q->atkCd -= dt; q->angryT -= dt; q->hitFx -= dt; q->thinkT -= dt; q->sideT -= dt;
        const float px = ch->x - q->x, pz = ch->z - q->z, pd = sqrtf(px * px + pz * pz) + 1e-4f, aggro = q->angryT > 0 ? 400 : 70;
        q->chase = you && pd < aggro;
        float mx = 0, mz = 0, sp = q->speed;
        if (q->knockT > 0) { q->knockT -= dt; q->x += q->kx * dt; q->z += q->kz * dt; q->kx *= 1 - 4 * dt; q->kz *= 1 - 4 * dt; }
        else if (q->atkT >= 0) {   /* mid-swing: the wind-up, the hit at 0.38 s, done at 0.72 */
            q->atkT += dt; q->yaw = atan2f(-px, -pz);
            if (!q->atkHit && q->atkT >= 0.38f) { q->atkHit = true; world_sound(S_SWING, q->x, 3, q->z, 0.7f); if (!ch->dead && pd < ZKIND[q->kind].reach * q->s + 1.4f && fabsf(ch->y - 3) < 5 && !in_base(ch->x, ch->z)) hurt(q->dmg); }
            if (q->atkT >= 0.72f) q->atkT = -1;
        } else if (q->chase) {
            if (pd <= ZKIND[q->kind].reach * (q->s > 1 ? 1.15f : 1)) { q->yaw = atan2f(-px, -pz); if (q->atkCd <= 0) { q->atkT = 0; q->atkHit = false; q->atkCd = ZKIND[q->kind].atkCd; } }
            else { if (q->thinkT <= 0) { q->thinkT = 0.15f; zombie_steer(q, ch->x, ch->z); } mx = q->sdx; mz = q->sdz; }
        } else {   /* nobody about: shamble round the area */
            if ((q->wanderT -= dt) <= 0) { q->wanderT = frange(4, 9); q->wx = frange(-100, 100); q->wz = frange(-100, 100); if (frand() < 0.3f) { q->wx = q->x; q->wz = q->z; } }
            const float wx = q->wx - q->x, wz = q->wz - q->z;
            if (wx * wx + wz * wz > 9) { if (q->thinkT <= 0) { q->thinkT = 0.25f; zombie_steer(q, q->wx, q->wz); } mx = q->sdx; mz = q->sdz; sp *= 0.45f; }
        }
        if (mx || mz) { q->x += mx * sp * dt; q->z += mz * sp * dt; float ty = atan2f(-mx, -mz), dy = ang_diff(q->yaw, ty); q->yaw += clampf(dy, -8 * dt, 8 * dt); }
        /* bump out of walls, out of you, and out of each other */
        const float r = 1.1f * q->s;
        for (int k = 0; k < W.n; k++) {
            const Part *p = &W.parts[k]; if (!zblocks(p) || q->x + r < p->minX || q->x - r > p->maxX || q->z + r < p->minZ || q->z - r > p->maxZ) continue;
            const float cx = clampf(q->x, p->minX, p->maxX), cz = clampf(q->z, p->minZ, p->maxZ), ex = q->x - cx, ez = q->z - cz, e2 = ex * ex + ez * ez;
            if (e2 > 1e-6f) { const float e = sqrtf(e2); if (e < r) { q->x += ex / e * (r - e); q->z += ez / e * (r - e); } }
            else { const float l = q->x - p->minX, rr = p->maxX - q->x, n = q->z - p->minZ, f = p->maxZ - q->z, m = fminf(fminf(l, rr), fminf(n, f));
                   if (m == l) q->x = p->minX - r; else if (m == rr) q->x = p->maxX + r; else if (m == n) q->z = p->minZ - r; else q->z = p->maxZ + r; }
        }
        if (!ch->dead) { const float ex = q->x - ch->x, ez = q->z - ch->z, e = sqrtf(ex * ex + ez * ez), m = r + 1.0f; if (e < m && e > 1e-3f && fabsf(ch->y - 3) < 5) { q->x += ex / e * (m - e); q->z += ez / e * (m - e); } }
        for (int k = 0; k < MAX_Z; k++) { Zombie *o = &zs[k]; if (k == i || o->state != 2) continue; const float ex = q->x - o->x, ez = q->z - o->z, e = sqrtf(ex * ex + ez * ez), m = r + 1.1f * o->s; if (e < m && e > 1e-3f) { q->x += ex / e * (m - e) * 0.5f; q->z += ez / e * (m - e) * 0.5f; } }
        q->x = clampf(q->x, -122, 122); q->z = clampf(q->z, -122, 122);
        /* the look: arms out, a shamble, and a swing that comes down on you */
        Joints *j = &q->rig.j; const bool moving = mx || mz || q->knockT > 0;
        if (moving) q->rig.walkT += dt * sp / 8; const float s = moving ? sinf(q->rig.walkT * 9) : 0;
        j->rh = s * 0.7f; j->lh = -s * 0.7f; j->rs = PI_F / 2 - 0.12f + s * 0.15f; j->ls = PI_F / 2 - 0.04f - s * 0.15f;
        if (q->atkT >= 0) { const float k = q->atkT < 0.38f ? q->atkT / 0.38f : 1 - (q->atkT - 0.38f) / 0.34f; j->rs = j->ls = PI_F / 2 + k * 1.0f; }
    }
}

/* ---------------------------------------------------------------- Zombie Zones: the rifle and the bash */
static struct { float a[3], b[3], t; } tracers[4]; static int nextTracer;
static Zombie *bash_target(void) {   /* a zombie right in front of you: B is a bash, not a shot */
    const Character *ch = &player.ch; const float fx = -sinf(ch->faceYaw), fz = -cosf(ch->faceYaw), cx = -sinf(cam.yaw), cz = -cosf(cam.yaw);
    Zombie *best = 0; float bd = 1e9f;
    for (int i = 0; i < MAX_Z; i++) {
        Zombie *q = &zs[i]; if (q->state != 2) continue;
        const float dx = q->x - ch->x, dz = q->z - ch->z, L = sqrtf(dx * dx + dz * dz), reach = BASH.REACH + (q->s - 1) * 1.5f;
        if (L > reach || fabsf(ch->y - 3) > 5) continue;
        if (L > 1.5f && (dx * fx + dz * fz) / L < 0.25f && (dx * cx + dz * cz) / L < 0.25f) continue;
        if (L < bd) { bd = L; best = q; }
    }
    return best;
}
static void swing(void) {   /* B, up close: the bash. The hit lands partway through, on the zombie in front of you */
    Character *ch = &player.ch; if (ch->dead || ch->climbing || player.rolling || player.swingCd > 0) return;
    Zombie *q = bash_target(); if (q) ch->faceYaw = atan2f(-(q->x - ch->x), -(q->z - ch->z));
    player.swingCd = BASH.CD; player.swingT = 0; player.swingHit = false; aud_play(S_SWING, 1, 0, 0); aud_say(VE_ATTACK);
}
static void swing_strike(void) {
    Character *ch = &player.ch; Zombie *q = bash_target(); if (!q) return;
    float dx = q->x - ch->x, dz = q->z - ch->z, L = sqrtf(dx * dx + dz * dz) + 1e-4f;
    zombie_hurt(q, BASH.DMG, true, dx / L, dz / L);
}
/* B, further off: a shot. It goes where the camera looks, and a zombie close to that line (and in sight) is the one it
   hits: the web game's aim assist, which is all the aiming a stick and a 320 x 240 screen allow. */
static void fire(void) {
    Character *ch = &player.ch; const float ox = ch->x, oy = ch->y + 0.6f, oz = ch->z;
    float dx = -sinf(cam.yaw), dz = -cosf(cam.yaw); Zombie *best = 0; float bs = 1e9f;
    for (int i = 0; i < MAX_Z; i++) {
        Zombie *q = &zs[i]; if (q->state != 2) continue;
        const float vx = q->x - ox, vz = q->z - oz, along = vx * dx + vz * dz; if (along < 1 || along > RIFLE.RANGE) continue;
        const float lat = fabsf(vx * dz - vz * dx); if (lat > 2.2f * q->s + along * 0.12f) continue;
        const float L = sqrtf(vx * vx + vz * vz), cy = 3 * q->s + 0.5f, dy = cy - oy; const Part *h;
        float t = world_raycast(&W, ox, oy, oz, vx / L, dy / L, vz / L, L, PF_NOCAM, &h); if (h && t < L - 1.2f) continue;
        if (lat / along < bs) { bs = lat / along; best = q; }
    }
    float end[3];
    if (best) { const float vx = best->x - ox, vz = best->z - oz, L = sqrtf(vx * vx + vz * vz) + 1e-4f; dx = vx / L; dz = vz / L; end[0] = best->x - dx * 0.6f * best->s; end[1] = 3 * best->s + 0.5f; end[2] = best->z - dz * 0.6f * best->s; zombie_hurt(best, RIFLE.DMG, false, dx, dz); }
    else { const Part *h; float t = world_raycast(&W, ox, oy, oz, dx, 0, dz, RIFLE.RANGE, PF_NOCAM, &h); end[0] = ox + dx * t; end[1] = oy; end[2] = oz + dz * t; }
    ch->faceYaw = atan2f(-dx, -dz); player.aimYaw = ch->faceYaw; player.aimT = 0.5f;
    tracers[nextTracer].a[0] = ox + dx * 1.6f; tracers[nextTracer].a[1] = oy; tracers[nextTracer].a[2] = oz + dz * 1.6f; memcpy(tracers[nextTracer].b, end, sizeof end); tracers[nextTracer].t = 0.06f; nextTracer = (nextTracer + 1) & 3;
    aud_play(S_TAP_DENY, 1.0f, -5, 0);
    player.fireCd = RIFLE.CD; player.idleT = 0; if (--player.mag <= 0) { player.mag = 0; player.reloadT = RIFLE.RELOAD; aud_tap(S_TAP_COUNT); }
}
static void rifle_update(const Input *in, float dt) {
    Character *ch = &player.ch;
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.reloadT > 0) { player.reloadT -= dt; if (player.reloadT <= 0) { player.mag = RIFLE.MAG; aud_tap(S_TAP_SELECT); } }
    if ((player.idleT += dt) > 2 && player.mag < RIFLE.MAG && player.reloadT <= 0) player.reloadT = RIFLE.RELOAD;   /* a breather tops the magazine up */
    if (ch->dead || ch->climbing || player.rolling) return;
    if ((in->pressed & BTN_B) && bash_target()) { swing(); return; }
    if ((in->held & BTN_B) && player.swingT > SWING.T && player.fireCd <= 0 && player.reloadT <= 0 && player.mag > 0) fire();
}

/* ---------------------------------------------------------------- Zombie Zones: supply */
#define MAGNET 11.0f
static struct { int area; float x, z, life; int n; } drops[6];   /* what you dropped when you went down (it lies there a minute) */
static const char *bar_line;   /* a line for the bar along the bottom, in place of the place's own */
static void supply_update(float dt) {
    Character *ch = &player.ch; static char storedT[48];
    for (int a = 0; a < N_AREAS; a++) for (int i = 0; i < nSpots[a]; i++) {   /* the spots grow back, in every area */
        Spot *s = &spots[a][i]; if (s->on) continue;
        if ((s->t -= dt) > 0) continue;
        if (a == area && fabsf(ch->x - s->x) < 10 && fabsf(ch->z - s->z) < 10) s->t = 2; else { s->on = true; s->pull = false; }
    }
    const bool can = !ch->dead && player.supply < BAG;
    for (int i = 0; i < nSpots[area]; i++) {   /* walk near and it flies to you */
        Spot *s = &spots[area][i]; if (!s->on) continue;
        if (!s->pull) {
            const float dx = ch->x - s->x, dz = ch->z - s->z;
            if (can && dx * dx + dz * dz < MAGNET * MAGNET && ch->y < 9) { s->pull = true; s->px = s->x; s->py = 0.7f; s->pz = s->z; }
            continue;
        }
        if (!can) { s->pull = false; continue; }
        const float dx = ch->x - s->px, dy = ch->y - s->py, dz = ch->z - s->pz, d = sqrtf(dx * dx + dy * dy + dz * dz) + 1e-4f, sp = 35 + 50 * fmaxf(0, 1 - d / MAGNET);
        s->px += dx / d * sp * dt; s->py += dy / d * sp * dt; s->pz += dz / d * sp * dt;
        if (d < 2.6f) {
            s->on = false; s->pull = false; s->t = frange(12, 26); player.supply++; aud_play(S_COIN, 0.8f, frange(0, 1.6f), 0);
            if (player.supply >= BAG) announce("BAG FULL!", "take it home and walk onto your pad", rgb5551(255, 210, 74), 2.2f);
        }
    }
    for (int i = 0; i < 6; i++) if (drops[i].n > 0) {
        if ((drops[i].life -= dt) <= 0) { drops[i].n = 0; continue; }
        const float dx = ch->x - drops[i].x, dz = ch->z - drops[i].z;
        if (drops[i].area == area && can && dx * dx + dz * dz < 4 * 4) { int k = BAG - player.supply; if (k > drops[i].n) k = drops[i].n; player.supply += k; drops[i].n -= k; aud_play(S_COIN, 0.8f, 2, 0); }
    }
    /* home: walk onto the pad and it is stored, a point a crate */
    if (area == 0 && !ch->dead && player.supply > 0 && ch->grounded && ch->ground && ch->ground->tag == T_DEPOT) {
        extern void round_score(int team, int n); round_score(TEAM_YOU, player.supply);
        player.stored += player.supply; player.supply = 0; aud_play(S_CHIME, 1, 0, 0); aud_play(S_WIN, 0.5f, 0, 0);
        extern int round_points(int team); snprintf(storedT, sizeof storedT, "Supply stored - Blue has %d", round_points(TEAM_YOU)); announce(0, storedT, 0, 2.5f);
    }
    bar_line = 0;
    if (player.supply >= BAG) bar_line = area == 0 ? "Bag full! Walk onto the pad to store it" : "Bag full! Take it home: the BLUE BASE door";
    else if (player.supply > 0 && area == 0) bar_line = "Walk onto the blue pad to store your supply";
}
static void drop_supply(void) {   /* you went down: what you carried lies where you fell */
    if (player.supply <= 0) return;
    int k = 0; for (int i = 0; i < 6; i++) if (drops[i].n <= 0) { k = i; break; } else if (drops[i].life < drops[k].life) k = i;
    drops[k].area = area; drops[k].x = player.ch.x; drops[k].z = player.ch.z; drops[k].life = 60; drops[k].n = player.supply; player.supply = 0;
}

/* ---------------------------------------------------------------- Zombie Zones: the round (the Supply Run, five minutes) */
#define ROUND_T 300.0f
static struct { int state; float t, overT; int score[4]; float next[4], pace[4]; int warned, winner; } rnd_;   /* state: 1 playing, 2 over */
void round_score(int team, int n) { if (rnd_.state == 1) rnd_.score[team] += n; }
int round_points(int team) { return rnd_.score[team]; }
static void round_start(void) {
    memset(&rnd_, 0, sizeof rnd_); rnd_.state = 1; rnd_.winner = -1;
    for (int k = 0; k < 4; k++) if (k != TEAM_YOU) { rnd_.pace[k] = frange(11, 17); rnd_.next[k] = rnd_.pace[k] * frange(0.6f, 1.6f); }
    announce("SUPPLY RUN", "You're on Blue: bring red crates home to your pad", hex5551(TEAMS[TEAM_YOU].mark), 4.5f);
}
static void zz_reset(void) { memset(spotsSet, 0, sizeof spotsSet); memset(drops, 0, sizeof drops); memset(tracers, 0, sizeof tracers); }
static void round_update(float dt) {
    static char bigT[24], smallT[64];
    if (rnd_.state == 1) {
        rnd_.t += dt;
        for (int k = 0; k < 4; k++) if (k != TEAM_YOU && (rnd_.next[k] -= dt) <= 0) { rnd_.score[k]++; rnd_.next[k] = rnd_.pace[k] * frange(0.6f, 1.4f); }   /* their runners, off the screen */
        const float left = ROUND_T - rnd_.t;
        if (left <= 60 && rnd_.warned < 1) { rnd_.warned = 1; announce("1 MINUTE LEFT", "Get your supply home!", rgb5551(255, 210, 74), 2.5f); }
        if (left <= 10 && rnd_.warned < 2) { rnd_.warned = 2; aud_tap(S_TAP_COUNT); }
        if (left <= 0) {
            int top = 0, n = 0; for (int k = 0; k < 4; k++) if (rnd_.score[k] > top) top = rnd_.score[k];
            for (int k = 0; k < 4; k++) if (rnd_.score[k] == top) { n++; rnd_.winner = k; }
            if (n > 1) rnd_.winner = -1;
            rnd_.state = 2; rnd_.overT = 10;
            if (rnd_.winner < 0) snprintf(bigT, sizeof bigT, "A DRAW"); else snprintf(bigT, sizeof bigT, "%s WINS!", rnd_.winner == TEAM_YOU ? "BLUE" : TEAMS[rnd_.winner].name);
            for (char *c = bigT; *c; c++) if (*c >= 'a' && *c <= 'z') *c -= 32;
            snprintf(smallT, sizeof smallT, "Blue stored %d - the next round starts in 10 s", rnd_.score[TEAM_YOU]);
            announce(bigT, smallT, rnd_.winner == TEAM_YOU ? hex5551(TEAMS[TEAM_YOU].mark) : rgb5551(255, 255, 255), 10);
            aud_play(rnd_.winner == TEAM_YOU ? S_WIN : S_CHIME, 1, 0, 0);
        }
    } else if (rnd_.state == 2 && (rnd_.overT -= dt) <= 0) {   /* a new round: everyone home, the town as new */
        for (int a = 0; a < AREA_MAX; a++) spotsSet[a] = false;
        memset(drops, 0, sizeof drops); player.supply = 0; player.hp = MAXHP;
        if (!player.ch.dead) go_area(0, HOME.x, HOME.z, HOME.yaw);
        round_start();
    }
}

static void menu_update(const Input *in, float dt) {
    int dir = 0; float sy = in->sy; menu.rep -= dt;
    bool up = (in->held & BTN_DU) || sy > 0.5f, down = (in->held & BTN_DD) || sy < -0.5f;
    if (!up && !down) menu.rep = 0; else if (menu.rep <= 0) { dir = up ? -1 : 1; menu.rep = 0.22f; }
    if (menu.help) { if (in->pressed & (BTN_A | BTN_B | BTN_START)) { menu.help = false; aud_tap(S_TAP_CLOSE); } return; }
    if (dir) { do { menu.sel = (menu.sel + dir + MI_COUNT) % MI_COUNT; } while (!menu_item_shown(menu.sel)); aud_tap(S_TAP_SELECT); }
    int lr = ((in->pressed & (BTN_DR | BTN_CR)) ? 1 : 0) - ((in->pressed & (BTN_DL | BTN_CL)) ? 1 : 0);
    if (in->pressed & (BTN_B | BTN_START)) { menu.open = false; aud_tap(S_TAP_CLOSE); return; }
    if (menu.sel == MI_STRESS && (lr || (in->pressed & BTN_A))) {   /* more or fewer bricks (the menu stays open: the FPS row is the answer) */
        int at = 0; for (int i = 0; i < SWEEP_COUNTS; i++) if (STRESS_STEPS[i] == stressN) at = i;
        at = (at + (lr < 0 ? SWEEP_COUNTS - 1 : 1)) % SWEEP_COUNTS; enter_world(STRESS_STEPS[at]); menu.fps = true; aud_tap(S_TAP_SELECT); return;
    }
    if (menu.sel == MI_PITCH && lr) { aud_voice_pitch = clampf(aud_voice_pitch + lr, VOICE_PITCH_MIN, VOICE_PITCH_MAX); float c = VOICE_EVENTS[VE_JUMP].chance; (void)c; aud_voices_on = true; aud_say(VE_JUMP); }
    if (in->pressed & BTN_A) {
        switch (menu.sel) {
            case MI_RESUME: menu.open = false; aud_tap(S_TAP_CLOSE); break;
            case MI_RESET: menu.open = false; aud_tap(S_TAP_CLOSE); char_kill(&player.ch); break;
            case MI_VOICES: aud_voices_on = !aud_voices_on; aud_tap(S_TAP_SELECT); if (aud_voices_on) aud_say(VE_JUMP); break;
            case MI_PITCH: aud_voice_pitch = aud_voice_pitch >= VOICE_PITCH_MAX ? VOICE_PITCH_MIN : aud_voice_pitch + 1; aud_voices_on = true; aud_say(VE_JUMP); break;
            case MI_STUDS: r_studs = !r_studs; aud_tap(S_TAP_SELECT); break;
            case MI_RENDER: game_use_hw = !game_use_hw; aud_tap(S_TAP_SELECT); break;
            case MI_FPS: menu.fps = !menu.fps; aud_tap(S_TAP_SELECT); break;
            case MI_HELP: menu.help = true; aud_tap(S_TAP_OPEN); break;
        }
    }
}

void game_update(const Input *inRaw, float dt) {
    if (dt <= 0) return;
    if (sweep.on) sweep_update(dt);
    game_stat.frames++; game_stat.fps100 = (uint32_t)(game_fps * 100); game_stat.polys = (uint32_t)r_polys; for (int i = 0; i < 4; i++) game_stat.ms10[i] = prof[i];
    if (dt > 0.1f) dt = 0.1f;
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
    /* ...and the camera stick turns and tilts it by how far it is pushed (the mouse, in the Arcade: the page turns its movement into this) */
    cam.yaw -= in.cx * CAM_STICK * dt; cam.pitch = clampf(cam.pitch - in.cy * CAM_STICK * dt, -1.2f, 1.396f);
    if (in.held & (BTN_L | BTN_R)) { cam.zoomRep -= dt; if (cam.zoomRep <= 0) { zoom_step((in.held & BTN_L) != 0); cam.zoomRep = (in.pressed & (BTN_L | BTN_R)) ? 0.3f : 0.09f; } } else cam.zoomRep = 0;

    /* ---- input -> the physics, then the world steps */
    float mx, mz; if (walk_dir(&in, &mx, &mz)) { ch->mx = mx; ch->mz = mz; } else ch->mx = ch->mz = 0;
    ch->jump = (in.held & BTN_A) != 0;
    if (in.pressed & BTN_Z) try_dash(&in);
    rifle_update(&in, dt);
    update_lift(dt);
    phys_step(ch, &W, dt);
    if (player.aimT > 0 && !ch->dead) { player.aimT -= dt; ch->faceYaw = player.aimYaw; }   /* you face where you shot */

    /* ---- what happened */
    player.dashCd = player.dashCd > dt ? player.dashCd - dt : 0;
    if (ch->events & EV_JUMP) { aud_play(S_JUMP, 1, 0, 0); aud_say(VE_JUMP); }
    if (ch->events & EV_PAD) aud_play(S_PAD, 1, 0, 0);
    if (ch->events & EV_GRAB) aud_tap(S_TAP_SELECT);
    ch->events = 0;
    /* dying and respawning: the death (kill brick, health at 0, falling off the edge) is the physics' (ch.dead, 3 s), the look is ours */
    if (ch->dead && !player.wasDead) {
        player.wasDead = true; player.rolling = false; break_apart(ch->x, ch->y, ch->z, ch->faceYaw, &player.rig, &GRUG, 1);
        world_sound(S_THUD, ch->x, ch->y, ch->z, 1); aud_say(ch->y < -10 ? VE_FALL : VE_DEATH); player.hp = 0; drop_supply();
    } else if (!ch->dead && player.wasDead) {   /* up again: at the back of your base, whichever area you went down in */
        player.wasDead = false; player.hp = MAXHP; player.protect = 2.5f; player.mag = RIFLE.MAG; player.reloadT = 0;
        go_area(0, HOME.x, HOME.z, HOME.yaw); cam.init = false;
    }
    /* health comes back: 6 a second once you have gone 4 s without a hit, 40 a second in your own base */
    if (!ch->dead) { player.sinceHit += dt; if (player.protect > 0) player.protect -= dt;
        const float rate = in_base(ch->x, ch->z) ? 40 : player.sinceHit > 4 ? 6 : 0; player.hp = fminf(MAXHP, player.hp + rate * dt); }
    zombies_update(dt); supply_update(dt); round_update(dt);
    for (int i = 0; i < 4; i++) if (tracers[i].t > 0) tracers[i].t -= dt;
    /* doors: walk into the opening and you are in the other area */
    if (doorCd > 0) doorCd -= dt;
    else if (!ch->dead) for (int i = 0; i < nDoors; i++) { const Door *d = &doors[i];
        if (ch->x > d->minX && ch->x < d->maxX && ch->z > d->minZ && ch->z < d->maxZ && ch->y - BODY_ROOT_TO_FEET < d->maxY && ch->y > d->minY) { go_area(d->to, d->tx, d->tz, d->tyaw); break; } }
    /* the damage pad: one square of health a second while you stand on it */
    if (!ch->dead && ch->grounded && ch->ground == hurtPad) { player.hurtAcc += dt; if (player.hurtAcc >= 1) { player.hurtAcc -= 1; hurt(20); } } else player.hurtAcc = 0.6f;
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
    if (!dummyOn) dummy.hp = 0;
    else if (dummy.hp <= 0) { dummy.t -= dt; if (dummy.t <= 0) { dummy.hp = 100; memset(&dummy.rig, 0, sizeof dummy.rig); } }
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
/* one block of a character: its head, a box wearing a picture, or a plain box. white: the flash when it is hit */
/* Characters are drawn unlit (CHAR_HOW): every face in its own colour whichever way it points. Lit, each flat face of a
   head and each side of a limb is a different shade, and at this size that reads as facets, not as a shape. The pictures
   they wear have their own painted shading, and the blob shadow under them says where they stand. R_LIT puts the light back. */
#define CHAR_HOW R_UNLIT
static void draw_block(const float c[3], const Mat3 *m, const float h[3], uint32_t color, const Tex *tex, const TexRect *rects, const Outfit *head, bool white) {
    const int how = white ? R_WHITE : CHAR_HOW;
    if (head) r_head(c, m, &head->head, &head->face, head->skin, how);
    else if (tex && !white) r_obox_tex(c, m, h[0], h[1], h[2], tex, rects, how);
    else r_obox(c, m, h[0], h[1], h[2], color, how);
}
static void draw_rig(float x, float y, float z, float yaw, const Rig *r, const Look *L, bool rolling, float rollK, float fx, float fz, bool white) {
    float dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz; bool detail = dx * dx + dy * dy + dz * dz < 60 * 60;
    Block b[16]; int n = rig_blocks(b, x, y, z, yaw, r, L, rolling, rollK, fx, fz, detail);
    for (int i = 0; i < n; i++) draw_block(b[i].c, &b[i].m, b[i].h, b[i].color, b[i].tex, b[i].rects, b[i].head, white);
}
static void draw_shadow(float x, float y, float z, float r);
/* a zombie: the rig in its colours, scaled (a Tank is half as big again), with dark eyes up close */
static void draw_zombie(const Zombie *q) {
    const float s = q->state == 1 ? q->s * (1 - q->t) : q->s, y = 3 * s;   /* rising: it grows out of the ground */
    float dx = q->x - cam.px, dz = q->z - cam.pz; const float d2 = dx * dx + dz * dz; if (d2 > 130 * 130) return;
    draw_shadow(q->x, y - 1 * s, q->z, 1.5f * s);
    Block b[16]; int n = rig_blocks(b, 0, 0, 0, q->yaw, &q->rig, &q->look, false, 0, 0, 0, false);
    const bool white = q->hitFx > 0.05f;
    for (int i = 0; i < n; i++) { float c[3] = { q->x + b[i].c[0] * s, y + b[i].c[1] * s, q->z + b[i].c[2] * s }, h[3] = { b[i].h[0] * s, b[i].h[1] * s, b[i].h[2] * s }; draw_block(c, &b[i].m, h, b[i].color, 0, 0, 0, white); }
    if (d2 < 40 * 40 && !white) {
        Mat3 m; m3_rot_y(&m, q->yaw);
        for (int e = -1; e <= 1; e += 2) { float l[3] = { e * 0.25f, 1.7f, -0.61f }, w[3]; m3_apply(&m, l, w); const float c[3] = { q->x + w[0] * s, y + w[1] * s, q->z + w[2] * s }; r_obox(c, &m, 0.12f * s, 0.12f * s, 0.03f * s, 0x1a1d14, R_UNLIT); }
    }
}
static void draw_world(void) {
    /* the baseplate: big grey studded checks on top, a plain slab underneath. Seen from above its top can't hide anything
       (whatever is behind it is under it), so it is painted with no depth at all: the cheapest pixels there are, and it is
       half the screen. */
    const int N = (int)(BP / BT);
    if (cam.py > 0) for (int i = 0; i < N; i++) for (int j = 0; j < N; j++) {
        float x0 = -BP / 2 + BT * i, z0 = -BP / 2 + BT * j;
        r_top(x0, z0, x0 + BT, z0 + BT, 0, (i + j) % 2 ? floorA : floorB, GM_BACK);
    }
    r_box(-BP / 2, -2, -BP / 2, BP / 2, 0, BP / 2, floorB, R_TOP_NONE);
    /* thin things lying on the ground first (they win ties with the plate), then everything else */
    for (int pass = 0; pass < 2; pass++) for (int i = 0; i < W.n; i++) {
        const Part *p = &W.parts[i];
        if ((p->flags & PF_HIDDEN) || p->tag == T_BASE || ((p->flags & PF_FLAT) != 0) != (pass == 0)) continue;
        r_box(p->minX, p->minY, p->minZ, p->maxX, p->maxY, p->maxZ, p->color, (p->flags & PF_STUDS) ? R_TOP_STUDS : R_TOP_PLAIN);
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
        case MI_STUDS: return r_studs ? "Studs: On" : "Studs: Off (faster)";
        case MI_RENDER: return game_use_hw ? "Drawn by: the console" : "Drawn by: software";
        case MI_FPS: return menu.fps ? "Show FPS: On" : "Show FPS: Off";
        case MI_STRESS: if (!stressN) return "Stress test: Off"; snprintf(buf, 32, "Stress test: %d bricks", stressN); return buf;
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
    const char *pname = P ? P->name : stressN ? "STRESS TEST" : AREAS[area].name, *psub = bar_line && !stressN ? bar_line : P ? KB(P->sub, P->subK) : "walk to a sign";
    const int X = 16, Y = 14;
    /* labels: damage numbers and the dummy first, then the signs from the nearest out (never under the HUD) */
    nTaken = 0; box_take(X - 2, Y - 2, X + 118, Y + 47); box_take(144, Y - 2, 296, Y + FH * 2 + 8); box_take(14, SCREEN_H - 46, SCREEN_W - 14, SCREEN_H - 14);
    const bool note = ann.t > 0 && !ann.big && ann.small && !menu.open; const int noteY = SCREEN_H - 66 - FH * 2;   /* a one-line note ("Playing as ..."): above the hints, and no sign is drawn under it */
    if (note) box_take(60, noteY - 1, SCREEN_W - 60, noteY + FH + 1);
    if (menu.open) box_take(40, 30, SCREEN_W - 40, SCREEN_H - 30);
    for (int i = 0; i < 6; i++) if (dmg[i].t > 0) { int sx, sy; float d; if (r_project(dmg[i].x, dmg[i].y, dmg[i].z, &sx, &sy, &d)) ui_text(sx, sy - FH, dmg[i].s, RED, UI_CENTER); }
    for (int i = 0; i < MAX_Z; i++) {   /* zombies: a health bar once hurt, and the name of the tougher kinds */
        const Zombie *q = &zs[i]; if (q->state != 2 || (q->hp >= q->maxHp && q->kind == ZK_WALKER)) continue;
        int sx, sy; float d; if (!r_project(q->x, 6.4f * q->s, q->z, &sx, &sy, &d) || d > 70 || !box_free(sx - 18, sy - FH - 6, sx + 18, sy)) continue;
        box_take(sx - 18, sy - FH - 6, sx + 18, sy);
        if (q->kind != ZK_WALKER) ui_text(sx, sy - FH - 5, ZKIND[q->kind].name, rgb5551(190, 230, 120), UI_CENTER);
        if (q->hp < q->maxHp) { ui_rect(sx - 16, sy - 4, 32, 4, BLACK); ui_rect(sx - 15, sy - 3, (int)(30 * q->hp / q->maxHp + 0.5f), 2, RED); }
    }
    if (dummy.hp > 0) { int sx, sy; float d; if (r_project(dummy.x, dummy.y + 4.2f, dummy.z, &sx, &sy, &d) && d < 70 && box_free(sx - 18, sy - FH - 6, sx + 18, sy)) { box_take(sx - 18, sy - FH - 6, sx + 18, sy); ui_text(sx, sy - FH - 5, "Dummy", WHITE, UI_CENTER); ui_rect(sx - 16, sy - 4, 32, 4, BLACK); ui_rect(sx - 15, sy - 3, 30 * dummy.hp / 100, 2, RED); } }
    { int order[40]; float dist[40]; int n = 0;
      for (int i = 0; i < nBills; i++) {
          if (bills[i].st >= 0 && P == &stations[bills[i].st]) continue;   /* the bar along the bottom already says where you are */
          float dx = bills[i].x - cam.px, dy = bills[i].y - cam.py, dz = bills[i].z - cam.pz, d = dx * dx + dy * dy + dz * dz; if (d > bills[i].range * bills[i].range) continue;
          int k = n++; while (k > 0 && dist[k - 1] > d) { dist[k] = dist[k - 1]; order[k] = order[k - 1]; k--; } dist[k] = d; order[k] = i;
      }
      for (int k = 0; k < n; k++) { const Bill *b = &bills[order[k]]; label(b->x, b->y, b->z, b->range, b->a, KB(b->b, b->bK), WHITE); } }
    /* the stats panel: HEALTH = red squares, coins, the last jump (inside the TV-safe area) */
    ui_dim(X, Y, 116, 45); ui_frame(X, Y, 116, 45, BLACK, 1);
    ui_text(X + 5, Y + 2, "HEALTH", WHITE, 0);
    for (int k = 0; k < 5; k++) { const float f = clampf((player.hp - k * 20) / 20, 0, 1); const int w = (int)(7 * f + 0.99f);
        ui_rect(X + 52 + k * 11, Y + 4, 9, 9, BLACK); ui_rect(X + 53 + k * 11, Y + 5, 7, 7, rgb5551(70, 20, 20)); if (w > 0) ui_rect(X + 53 + k * 11, Y + 5, w, 7, RED); }
    { static char supT[16] = "SUPPLY 0/10"; static int supN; if (supN != player.supply) { supN = player.supply; snprintf(supT, sizeof supT, "SUPPLY %d/%d", supN, BAG); }
      ui_text(X + 5, Y + 2 + FH + 1, supT, player.supply >= BAG ? rgb5551(255, 210, 74) : YEL, 0); }
    { static char gunT[24] = "RIFLE 15/15"; static int gunN = -1; if (gunN != player.mag) { gunN = player.mag; snprintf(gunT, sizeof gunT, "RIFLE %d/%d", gunN, RIFLE.MAG); }
      ui_text(X + 5, Y + 2 + (FH + 1) * 2, player.reloadT > 0 ? "RIFLE reloading..." : gunT, WHITE, 0); }
    /* the round: its clock, and the four teams' supply stored (yours framed) */
    { static char clockT[32]; static int clockS = -1; const int left = rnd_.state == 1 ? (int)(ROUND_T - rnd_.t + 0.99f) : 0;
      if (left != clockS) { clockS = left; snprintf(clockT, sizeof clockT, "SUPPLY RUN  %d:%02d", left / 60, left % 60); }
      static char scoreT[4][6]; static int scoreN[4] = { -1, -1, -1, -1 };
      const int bw = 34, bx = 150, by = Y + FH + 2;
      ui_dim(bx - 4, Y, bw * 4 + 8, FH * 2 + 6); ui_frame(bx - 4, Y, bw * 4 + 8, FH * 2 + 6, BLACK, 1);
      ui_text(bx + bw * 2, Y + 1, clockT, rnd_.state == 1 && left <= 60 ? rgb5551(255, 210, 74) : WHITE, UI_CENTER);
      for (int k = 0; k < 4; k++) {
          if (scoreN[k] != rnd_.score[k]) { scoreN[k] = rnd_.score[k]; snprintf(scoreT[k], sizeof scoreT[k], "%d", scoreN[k]); }
          const int x = bx + k * bw; ui_rect(x + 1, by, bw - 2, FH + 1, hex5551(TEAMS[k].shirt));
          if (k == TEAM_YOU) ui_frame(x, by - 1, bw, FH + 3, rgb5551(255, 227, 107), 1);
          ui_text(x + bw / 2, by, scoreT[k], k == 0 ? BLACK : WHITE, UI_CENTER | (k == 0 ? UI_NOLINE : 0));
      } }
    /* the place bar along the bottom */
    if (!menu.open) {   /* (the Game Menu is tall enough to reach it) */
        ui_dim(16, SCREEN_H - 44, SCREEN_W - 32, 28); ui_frame(16, SCREEN_H - 44, SCREEN_W - 32, 28, BLACK, 1);
        ui_text(SCREEN_W / 2, SCREEN_H - 43, pname, YEL, UI_CENTER); ui_text(SCREEN_W / 2, SCREEN_H - 43 + FH, psub, WHITE, UI_CENTER);
    }
    if (ann.t > 0 && ann.big) { ui_text(SCREEN_W / 2, 70, ann.big, ann.color, UI_CENTER | UI_X2); if (ann.small) ui_text(SCREEN_W / 2, 70 + FH * 2 + 2, ann.small, WHITE, UI_CENTER); }
    else if (note) ui_text(SCREEN_W / 2, noteY, ann.small, YEL, UI_CENTER);
    if (ch->dead) { ui_text(SCREEN_W / 2, 96, "You went down!", WHITE, UI_CENTER); ui_text(SCREEN_W / 2, 96 + FH, "Back to your base in a moment", WHITE, UI_CENTER); }
    if (menu.fps) {
        const int FY = 14 + FH * 2 + 8;
        snprintf(buf, sizeof buf, "%d fps %s", (int)(game_fps + 0.5f), gfx->name); ui_text(SCREEN_W - 18, FY, buf, WHITE, UI_RIGHT);
        if (game_clock_us) { snprintf(buf, sizeof buf, "ms: game %d world %d", (int)prof[0] / 10, (int)prof[1] / 10); ui_text(SCREEN_W - 18, FY + FH, buf, WHITE, UI_RIGHT);
            snprintf(buf, sizeof buf, "you %d hud %d", (int)prof[2] / 10, (int)prof[3] / 10); ui_text(SCREEN_W - 18, FY + FH * 2, buf, WHITE, UI_RIGHT); }
        if (W.over) snprintf(buf, sizeof buf, "%d parts, %d LEFT OUT", W.n, W.over); else snprintf(buf, sizeof buf, "%d polys %d parts", r_polys, W.n); ui_text(SCREEN_W - 18, FY + FH * (game_clock_us ? 3 : 1), buf, WHITE, UI_RIGHT);
    }
    /* the Game Menu: a centred dark box, Resume Game first */
    if (menu.open && !menu.help) {
        int rows = 0; for (int i = 0; i < MI_COUNT; i++) if (menu_item_shown(i)) rows++;
        const int w = 216, rh = FH + 6, h = 26 + rows * rh + 6, x = (SCREEN_W - w) / 2, y = (SCREEN_H - h) / 2; int ry = y + 24;
        ui_rect(x, y, w, h, rgb5551(34, 34, 38)); ui_frame(x, y, w, h, BLACK, 2); ui_text(SCREEN_W / 2, y + 6, "Game Menu", WHITE, UI_CENTER);
        for (int i = 0; i < MI_COUNT; i++) {
            if (!menu_item_shown(i)) continue; const bool sel = i == menu.sel;
            ui_rect(x + 12, ry, w - 24, rh - 2, sel ? rgb5551(170, 30, 30) : BLACK); ui_frame(x + 12, ry, w - 24, rh - 2, sel ? rgb5551(255, 80, 80) : rgb5551(200, 200, 200), 1);
            ui_text(SCREEN_W / 2, ry + 2, MENU_LABEL(i, buf), WHITE, UI_CENTER); ry += rh;
        }
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
    for (int i = 0; i < nPieces; i++) { Piece *p = &pieces[i]; Mat3 e, m; m3_euler(&e, p->e[0], p->e[1], p->e[2]); m3_mul(&m, &e, &p->m0); draw_block(p->p, &m, p->h, p->color, p->tex, p->rects, p->head, false); }
    for (int i = 0; i < MAX_Z; i++) if (zs[i].state) draw_zombie(&zs[i]);
    for (int i = 0; i < nSpots[area]; i++) {   /* supply: red crates, as in the web game (and flying to you once you are near) */
        const Spot *s = &spots[area][i]; if (!s->on) continue;
        const float p[3] = { s->pull ? s->px : s->x, s->pull ? s->py : 0.7f, s->pull ? s->pz : s->z }, dx = p[0] - cam.px, dz = p[2] - cam.pz; if (dx * dx + dz * dz > 140 * 140) continue;
        Mat3 m; m3_rot_y(&m, s->pull ? gclock * 8 : s->x * 0.7f + s->z); r_obox(p, &m, 0.7f, 0.7f, 0.7f, 0xe02020, R_LIT);
    }
    for (int i = 0; i < 6; i++) if (drops[i].n > 0 && drops[i].area == area) {   /* what you dropped: a little stack */
        Mat3 m; m3_rot_y(&m, drops[i].x); const float p[3] = { drops[i].x, 0.7f, drops[i].z }, q[3] = { drops[i].x + 0.3f, 2.1f, drops[i].z - 0.2f };
        r_obox(p, &m, 0.7f, 0.7f, 0.7f, 0xe02020, R_LIT); if (drops[i].n > 1) r_obox(q, &m, 0.7f, 0.7f, 0.7f, 0xe02020, R_LIT);
    }
    for (int i = 0; i < 4; i++) if (tracers[i].t > 0) {   /* a shot: a thin streak, turned to face the camera */
        const float *a = tracers[i].a, *b = tracers[i].b; float d[3] = { b[0] - a[0], b[1] - a[1], b[2] - a[2] }, v[3] = { a[0] - cam.px, a[1] - cam.py, a[2] - cam.pz };
        float o[3] = { d[1] * v[2] - d[2] * v[1], d[2] * v[0] - d[0] * v[2], d[0] * v[1] - d[1] * v[0] }, l = sqrtf(o[0] * o[0] + o[1] * o[1] + o[2] * o[2]); if (l < 1e-5f) continue;
        for (int k = 0; k < 3; k++) o[k] *= 0.12f / l;
        const float P[4][3] = { { a[0] - o[0], a[1] - o[1], a[2] - o[2] }, { a[0] + o[0], a[1] + o[1], a[2] + o[2] }, { b[0] + o[0], b[1] + o[1], b[2] + o[2] }, { b[0] - o[0], b[1] - o[1], b[2] - o[2] } };
        r_quad(P, rgb5551(255, 227, 107), GM_OPAQUE, 0);
    }
    for (int i = 0; i < nCoins; i++) {   /* coins: they spin and bob */
        const Coin *c = &coins[i]; if (c->t > 0) continue;
        float dx = c->x - cam.px, dz = c->z - cam.pz; if (dx * dx + dz * dz > 150 * 150) continue;
        Mat3 m; m3_rot_y(&m, gclock * 3 + c->x); const float p[3] = { c->x, c->y + sinf(gclock * 2 + c->x) * 0.3f, c->z };
        r_obox(p, &m, 0.95f, 0.95f, 0.16f, 0xffd23a, R_LIT);
    }
    gfx->end3d();
    PROF_END(2);
    if (!game_hide_hud) draw_hud();
    PROF_END(3);
}

void game_debug(GameDebug *d) {
    const Character *ch = &player.ch;
    *d = (GameDebug){ ch->x, ch->y, ch->z, ch->vy, cam.yaw, cam.pitch, cam.dist, player.hp, player.coinCount, ch->grounded, ch->dead, menu.open, ch->lastHeight, ch->lastDist, W.n, stressN, GRUG.fit != 0, area, W.over };
}
void game_teleport(float x, float y, float z, float camYaw) { Character *ch = &player.ch; ch->x = x; ch->y = y; ch->z = z; ch->vx = ch->vy = ch->vz = 0; ch->grounded = false; cam.yaw = camYaw; cam.init = false; }
void game_camera(float yaw, float pitch, float dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = cam.tdist = dist; cam.init = false; }

/* ---------------------------------------------------------------- for Zombie Zones 64's test script (zz.h) */
#include "zz.h"
void zz_debug(ZZDebug *d) {
    memset(d, 0, sizeof *d); d->area = area; d->supply = player.supply; d->stored = player.stored; d->kills = player.kills; d->mag = player.mag; d->hp = player.hp;
    d->zombies = zombies_up(0); for (int i = 0; i < nSpots[area]; i++) d->spotsOn += spots[area][i].on;
    d->z0x = zs[0].x; d->z0z = zs[0].z; d->z0hp = zs[0].state == 2 ? zs[0].hp : 0; d->roundState = rnd_.state; d->roundLeft = ROUND_T - rnd_.t; for (int k = 0; k < 4; k++) d->score[k] = rnd_.score[k];
}
void zz_zombie(int i, float x, float z, int kind) { if (i < 0 || i >= MAX_Z) return; zombie_rise(&zs[i], x, z, kind); zs[i].state = 2; zs[i].angryT = 30; }
void zz_clear_zombies(void) { for (int i = 0; i < MAX_Z; i++) { zs[i].state = 0; zs[i].t = 1e9f; } }
void zz_round_time(float left) { rnd_.t = ROUND_T - left; }
