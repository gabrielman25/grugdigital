/* Grug 64: physics. A port of AmbientCore's World, stepCharacter and stepAll (arcade/baseplate/index.html). */
#include <math.h>
#include <string.h>
#include "phys.h"

#define PI_F 3.14159265358979f

static uint32_t rng_state = 0x1234567u;
void rng_seed(uint32_t s) { rng_state = s ? s : 1u; }
float frand(void) { rng_state ^= rng_state << 13; rng_state ^= rng_state >> 17; rng_state ^= rng_state << 5; return (float)(rng_state >> 8) * (1.0f / 16777216.0f); }
float frange(float a, float b) { return a + frand() * (b - a); }
float ang_diff(float a, float b) { float d = fmodf(b - a, PI_F * 2); if (d > PI_F) d -= PI_F * 2; if (d < -PI_F) d += PI_F * 2; return d; }
static inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }

/* ---------------------------------------------------------------- the world: axis-aligned parts */
void world_init(World *w, Part *storage, int cap) { w->parts = storage; w->n = 0; w->cap = cap; w->nDyn = 0; }

Part *world_add(World *w, float cx, float cy, float cz, float sx, float sy, float sz, uint32_t color, uint8_t kind, uint8_t flags) {
    static Part overflow;
    Part *p = w->n < w->cap ? &w->parts[w->n++] : &overflow;
    memset(p, 0, sizeof *p);
    p->minX = cx - sx / 2; p->maxX = cx + sx / 2; p->minY = cy - sy / 2; p->maxY = cy + sy / 2; p->minZ = cz - sz / 2; p->maxZ = cz + sz / 2;
    p->color = color; p->kind = kind; p->flags = flags;
    if ((flags & PF_DYNAMIC) && p != &overflow && w->nDyn < DYN_MAX) w->dyn[w->nDyn++] = p;
    return p;
}

void world_move_dynamic(World *w, float dt) {
    for (int i = 0; i < w->nDyn; i++) {
        Part *p = w->dyn[i];
        if (p->vx == 0 && p->vy == 0 && p->vz == 0) continue;
        p->minX += p->vx * dt; p->maxX += p->vx * dt; p->minY += p->vy * dt; p->maxY += p->vy * dt; p->minZ += p->vz * dt; p->maxZ += p->vz * dt;
    }
}

float world_raycast(const World *w, float ox, float oy, float oz, float dx, float dy, float dz, float maxT, uint8_t skipFlags, const Part **hit) {
    float best = maxT; const Part *h = 0;
    const float o[3] = { ox, oy, oz }, d[3] = { dx, dy, dz };
    /* the box the whole ray lies in: a part outside it can't be hit (most of a big world, at the cost of six comparisons each) */
    const float ex = ox + dx * maxT, ey = oy + dy * maxT, ez = oz + dz * maxT, lox = ox < ex ? ox : ex, hix = ox < ex ? ex : ox, loy = oy < ey ? oy : ey, hiy = oy < ey ? ey : oy, loz = oz < ez ? oz : ez, hiz = oz < ez ? ez : oz;
    for (int i = 0; i < w->n; i++) {
        const Part *p = &w->parts[i];
        if (p->minX > hix || p->maxX < lox || p->minZ > hiz || p->maxZ < loz || p->minY > hiy || p->maxY < loy) continue;
        if (!(p->flags & PF_COLLIDE) || (p->flags & skipFlags) || p->kind == K_LADDER) continue;
        const float mn[3] = { p->minX, p->minY, p->minZ }, mx[3] = { p->maxX, p->maxY, p->maxZ };
        float t0 = 0, t1 = best; bool ok = true;
        for (int a = 0; a < 3; a++) {
            if (fabsf(d[a]) < 1e-9f) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } continue; }
            float ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a]; if (ta > tb) { float t = ta; ta = tb; tb = t; }
            if (ta > t0) t0 = ta;
            if (tb < t1) t1 = tb;
            if (t0 > t1) { ok = false; break; }
        }
        if (ok && t0 < best) { best = t0; h = p; }
    }
    if (hit) *hit = h;
    return best;
}

/* ---------------------------------------------------------------- characters */
void char_init(Character *ch, float x, float y, float z, float yaw) {
    memset(ch, 0, sizeof *ch);
    ch->x = ch->spawnX = x; ch->y = ch->spawnY = y; ch->z = ch->spawnZ = z; ch->faceYaw = yaw;
}
void char_respawn(Character *ch) {
    ch->x = ch->spawnX + frange(-3, 3); ch->y = ch->spawnY; ch->z = ch->spawnZ + frange(-3, 3);
    ch->vx = ch->vy = ch->vz = 0; ch->grounded = false; ch->rising = false; ch->dead = false; ch->deadT = 0;
    ch->ground = 0; ch->ladder = 0; ch->climbing = false; ch->climbDir = 0; ch->dashT = 0; ch->jumping = false;
    ch->events |= EV_RESPAWN;
}
void char_kill(Character *ch) {
    if (ch->dead) return;
    ch->ladder = 0; ch->climbing = false; ch->dead = true; ch->deadT = 3; ch->vx = ch->vy = ch->vz = 0; ch->dashT = 0;
    ch->events |= EV_DIED;
}
float phys_jump_velocity(void) { return sqrtf(2 * CFG_GRAVITY * CFG_JUMPHEIGHT); }

static inline bool circle_overlaps_box(float cx, float cz, float r, const Part *b) {
    float dx = cx - clampf(cx, b->minX, b->maxX), dz = cz - clampf(cz, b->minZ, b->maxZ);
    return dx * dx + dz * dz < r * r;
}
#define COLLIDES(b) ((b)->flags & PF_COLLIDE)

/* e^(-k/240) for the two rates the step uses, worked out once (dt never changes) */
static float K_ACCEL, K_TURN, STEP_DT;
static void consts(void) { if (STEP_DT == 0) { STEP_DT = 1.0f / PHYS_RATE; K_ACCEL = 1 - expf(-CFG_ACCEL * STEP_DT); K_TURN = 1 - expf(-18 * STEP_DT); } }

/* one fixed step (Roblox steps at 240 Hz) */
static void step_character(Character *ch, float dt) {
    if (ch->dead) { ch->deadT -= dt; if (ch->deadT <= 0) char_respawn(ch); return; }
    const float prevY = ch->y;
    const Part **near = ch->near; const int nn = ch->nNear;
    ch->padT -= dt;
    /* ---- horizontal velocity snaps toward MoveDirection * WalkSpeed (same on the ground and in the air) */
    float mx = ch->mx, mz = ch->mz;
    float ml = sqrtf(mx * mx + mz * mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const float ws = CFG_WALKSPEED;
    ch->vx += (mx * ws - ch->vx) * K_ACCEL; ch->vz += (mz * ws - ch->vz) * K_ACCEL;
    if (ch->dashT > 0 && !ch->ladder) { ch->dashT -= 1.0 / PHYS_RATE; ch->vx = ch->dashVx; ch->vz = ch->dashVz; }
    if (ch->cd > 0) ch->cd -= dt;
    /* ---- ladders: walk into one to grab it; push toward the wall to climb, pull away to climb down, jump to let go */
    ch->ladCd -= dt;
    if (!ch->ladder && ch->ladCd <= 0) {
        const float feet = ch->y - BODY_ROOT_TO_FEET;
        for (int i = 0; i < nn; i++) {
            const Part *b = near[i];
            if (b->kind != K_LADDER || feet >= b->maxY - 0.25f || ch->y + 2 <= b->minY || !circle_overlaps_box(ch->x, ch->z, 1.35f, b)) continue;
            float front = -((ch->x - b->fx) * b->nx + (ch->z - b->fz) * b->nz); if (front < 0.2f || front > 2.8f) continue;
            if (mx * b->nx + mz * b->nz <= 0.3f) continue;
            float tx = -b->nz, tz = b->nx, hw = (b->hw > 0 ? b->hw : 1.5f) - 0.9f, along = clampf((ch->x - b->fx) * tx + (ch->z - b->fz) * tz, -hw, hw);
            ch->ladder = b; ch->lockX = b->fx - b->nx * (BODY_RADIUS + 0.05f) + tx * along; ch->lockZ = b->fz - b->nz * (BODY_RADIUS + 0.05f) + tz * along;
            ch->vx = ch->vz = ch->vy = 0; ch->grounded = false; ch->ground = 0; ch->rising = false; ch->jumping = false; ch->events |= EV_GRAB; break;
        }
    }
    const bool jumpEdge = ch->jump && !ch->pj; ch->pj = ch->jump;
    if (ch->ladder) {
        const Part *b = ch->ladder;
        if (jumpEdge) { ch->ladder = 0; ch->climbing = false; ch->ladCd = 0.35f; ch->vy = phys_jump_velocity(); ch->climbDir = 0; ch->events |= EV_JUMP; }
        else {
            ch->x = ch->lockX; ch->z = ch->lockZ; ch->vx = ch->vz = ch->vy = 0; ch->grounded = false; ch->ground = 0; ch->climbing = true;
            ch->faceYaw = atan2f(-b->nx, -b->nz);
            float push = mx * b->nx + mz * b->nz; int dir = push > 0.3f ? 1 : push < -0.3f ? -1 : 0; float y0 = ch->y;
            ch->y = fminf(ch->y + dir * CFG_CLIMBSPEED * dt, b->maxY + BODY_ROOT_TO_FEET);
            if (dir < 0) {   /* reached the floor: step off */
                float floor = -1e30f; const Part *fp = 0;
                for (int i = 0; i < nn; i++) { const Part *p = near[i]; if (COLLIDES(p) && p->maxY <= y0 - BODY_ROOT_TO_FEET + 0.05f && p->maxY > floor && circle_overlaps_box(ch->x, ch->z, BODY_FLOOR_RADIUS, p)) { floor = p->maxY; fp = p; } }
                if (fp && ch->y - BODY_ROOT_TO_FEET <= floor) { ch->y = floor + BODY_ROOT_TO_FEET; ch->ladder = 0; ch->climbing = false; ch->ladCd = 0.4f; ch->grounded = true; ch->ground = fp; ch->events |= EV_LAND; }
            }
            ch->climbDir = ch->y != y0 ? dir : 0;
            return;
        }
    }
    ch->climbing = false;
    /* AutoRotate: the body turns toward where it walks */
    if (ml > 0.01f) ch->faceYaw += ang_diff(ch->faceYaw, atan2f(-mx, -mz)) * K_TURN;
    /* ---- jump */
    if (ch->grounded && ch->jump && ch->cd <= 0 && !ch->rising) {
        ch->vy = phys_jump_velocity(); ch->grounded = false;
        ch->jumping = true; ch->jStartY = ch->jPeak = ch->y - 3; ch->jT = 0; ch->jSx = ch->x; ch->jSz = ch->z; ch->events |= EV_JUMP;
    }
    /* ---- carried by a moving platform */
    if (ch->grounded && ch->ground && (ch->ground->flags & PF_DYNAMIC)) { ch->x += ch->ground->vx * dt; ch->z += ch->ground->vz * dt; }
    /* ---- horizontal move + walls (torso and head only, like R6) */
    ch->x += ch->vx * dt; ch->z += ch->vz * dt;
    const float R = BODY_RADIUS, lo = ch->y - BODY_ROOT_TO_TORSO_BOTTOM + 0.01f, hi = ch->y + BODY_ROOT_TO_HEAD_TOP - 0.01f;
    for (int it = 0; it < 3; it++) {
        bool hit = false;
        for (int i = 0; i < nn; i++) {
            const Part *b = near[i];
            if (!COLLIDES(b) || b->maxY <= lo || b->minY >= hi) continue;
            float px = clampf(ch->x, b->minX, b->maxX), pz = clampf(ch->z, b->minZ, b->maxZ);
            float dx = ch->x - px, dz = ch->z - pz, d2 = dx * dx + dz * dz;
            if (d2 >= R * R) continue;
            if (b->kind == K_KILL) { char_kill(ch); return; }
            hit = true;
            if (d2 > 1e-10f) {
                float d = sqrtf(d2), nx = dx / d, nz = dz / d;
                ch->x += nx * (R - d); ch->z += nz * (R - d);
                float vn = ch->vx * nx + ch->vz * nz; if (vn < 0) { ch->vx -= vn * nx; ch->vz -= vn * nz; }
            } else {
                float l = ch->x - b->minX, r = b->maxX - ch->x, n = ch->z - b->minZ, f = b->maxZ - ch->z, m = fminf(fminf(l, r), fminf(n, f));
                if (m == l) { ch->x = b->minX - R; ch->vx = fminf(ch->vx, 0); } else if (m == r) { ch->x = b->maxX + R; ch->vx = fmaxf(ch->vx, 0); }
                else if (m == n) { ch->z = b->minZ - R; ch->vz = fminf(ch->vz, 0); } else { ch->z = b->maxZ + R; ch->vz = fmaxf(ch->vz, 0); }
            }
        }
        if (!hit) break;
    }
    /* ---- vertical (exact for constant gravity, so the peak lands on JumpHeight exactly) */
    if (!ch->grounded) { ch->y += ch->vy * dt - 0.5f * CFG_GRAVITY * dt * dt; ch->vy -= CFG_GRAVITY * dt; }
    /* ---- ceiling (head bonk) */
    if (ch->vy > 0) {
        float prevTop = prevY + BODY_ROOT_TO_HEAD_TOP, top = ch->y + BODY_ROOT_TO_HEAD_TOP, ceil = 1e30f;
        for (int i = 0; i < nn; i++) { const Part *b = near[i]; if (COLLIDES(b) && b->minY >= prevTop - 0.01f && b->minY < top && b->minY < ceil && circle_overlaps_box(ch->x, ch->z, R * 0.9f, b)) ceil = b->minY; }
        if (ceil < 1e29f) { ch->y = ceil - BODY_ROOT_TO_HEAD_TOP; ch->vy = 0; }
    }
    /* ---- floor sensor: highest surface under the body at or below the torso bottom */
    const float lim = fmaxf(ch->y, prevY) - BODY_ROOT_TO_TORSO_BOTTOM + 0.01f;
    float floor = -1e30f; const Part *fp = 0;
    for (int i = 0; i < nn; i++) { const Part *b = near[i]; if (COLLIDES(b) && b->maxY <= lim && b->maxY > floor && circle_overlaps_box(ch->x, ch->z, BODY_FLOOR_RADIUS, b)) { floor = b->maxY; fp = b; } }
    const float feet = ch->y - BODY_ROOT_TO_FEET, prevFeet = prevY - BODY_ROOT_TO_FEET;
    if (ch->jumping) { ch->jT += dt; if (feet > ch->jPeak) ch->jPeak = feet; }
    if (ch->grounded) {
        ch->rising = false;
        if (!fp) { ch->grounded = false; ch->ground = 0; }
        else {
            float gap = feet - floor; ch->rising = gap < -0.05f; ch->ground = fp;
            if (gap < 0) ch->y += fminf(-gap, CFG_STEPRISE * dt);
            else if (gap <= CFG_SNAPDOWN + ((fp->flags & PF_DYNAMIC) ? fabsf(fp->vy) * dt * 2 : 0)) ch->y = floor + BODY_ROOT_TO_FEET;
            else { ch->grounded = false; ch->ground = 0; }
        }
    } else if (fp && ch->vy <= 0 && feet <= floor) {
        if (prevFeet >= floor - 0.01f - ((fp->flags & PF_DYNAMIC) ? fabsf(fp->vy) * dt * 2 : 0)) ch->y = floor + BODY_ROOT_TO_FEET;
        ch->grounded = true; ch->rising = ch->y - BODY_ROOT_TO_FEET < floor - 0.05f; ch->ground = fp;
        float impact = ch->vy; ch->vy = 0; ch->cd = 0; ch->events |= impact < -60 ? EV_LANDHARD : EV_LAND;
        if (ch->jumping) { ch->hasLast = true; ch->lastHeight = ch->jPeak - ch->jStartY; ch->lastAir = ch->jT; ch->lastDist = sqrtf((ch->x - ch->jSx) * (ch->x - ch->jSx) + (ch->z - ch->jSz) * (ch->z - ch->jSz)); ch->jumping = false; }
    }
    /* ---- what you stand on does things */
    if (ch->grounded && fp) {
        if (fp->kind == K_KILL) { char_kill(ch); return; }
        if (fp->kind == K_PAD && ch->padT <= 0) { ch->vy = fp->power > 0 ? fp->power : 120; ch->grounded = false; ch->ground = 0; ch->padT = 0.4f; ch->events |= EV_PAD; }
    }
    if (ch->y - BODY_ROOT_TO_FEET < CFG_FALLEN_Y) char_kill(ch);
}

/* step a character at the fixed rate (stepAll in AmbientCore) */
int phys_step(Character *ch, World *w, float dt) {
    static float acc = 0;
    consts();
    const float h = STEP_DT; int n = 0;
    acc += dt;
    /* broadphase once per frame, generously sized for this frame's motion */
    float reach = 6 + 60 * (dt < 0.1f ? dt : 0.1f) + 12;   /* (+12: a jump pad throws you up fast, and lifts move) */
    ch->nNear = 0;
    for (int i = 0; i < w->n && ch->nNear < NEAR_MAX; i++) {
        const Part *p = &w->parts[i];
        if (p->maxX >= ch->x - reach && p->minX <= ch->x + reach && p->maxZ >= ch->z - reach && p->minZ <= ch->z + reach) ch->near[ch->nNear++] = p;
    }
    while (acc >= h && n < 40) { world_move_dynamic(w, h); step_character(ch, h); acc -= h; n++; }
    if (acc > h) acc = h;
    return n;
}
