/* Grug 64: reading the outfit slot (see outfit.h). */
#include <string.h>
#include "outfit.h"

const TexRect FIT_TORSO[6]  = { { 128, 0, 32, 64 }, { 160, 0, 32, 64 }, { 192, 0, 64, 32 }, { 192, 32, 64, 32 }, { 64, 0, 64, 64 }, { 0, 0, 64, 64 } };
const TexRect FIT_LIMB_A[6] = { { 64, 64, 32, 64 }, { 96, 64, 32, 64 }, { 0, 128, 32, 32 }, { 32, 128, 32, 32 }, { 32, 64, 32, 64 }, { 0, 64, 32, 64 } };
const TexRect FIT_LIMB_B[6] = { { 192, 64, 32, 64 }, { 224, 64, 32, 64 }, { 64, 128, 32, 32 }, { 96, 128, 32, 32 }, { 160, 64, 32, 64 }, { 128, 64, 32, 64 } };

static inline int be16(const uint8_t *p) { return (p[0] << 8) | p[1]; }
static inline int be16s(const uint8_t *p) { return (int16_t)((p[0] << 8) | p[1]); }

static const uint8_t *picture(Tex *t, const uint8_t *p, const uint8_t *pal, int w, int h, int wshift, int levels, float density, int id) {
    memset(t, 0, sizeof *t); t->w = w; t->h = h; t->wshift = wshift; t->nlv = levels; t->density = density; t->id = id;
    for (int i = 0; i < 256; i++) t->pal[i] = (uint16_t)be16(pal + i * 2);
    for (int l = 0; l < levels; l++) { t->lv[l] = p; p += (w >> l) * (h >> l); }
    return p;
}

bool slot_read(const uint8_t *s, int size, Outfit *o, SlotConfig *cfg) {
    memset(o, 0, sizeof *o); memset(cfg, 0, sizeof *cfg);
    if (!s || size < SLOT_SIZE || memcmp(s, "GRUGFIT1", 8) != 0 || be16(s + 12) != 2) return false;
    const int stress = be16(s + 16);
    cfg->sweep = stress == 0xFFFF; cfg->stress = cfg->sweep ? 0 : stress;
    if (be16(s + 18) & 1) { cfg->view = true; cfg->x = be16s(s + 20); cfg->z = be16s(s + 22); cfg->yaw = be16s(s + 24) * (3.14159265f / 180); cfg->pitch = be16s(s + 26) * (3.14159265f / 180); cfg->dist = be16s(s + 28); }
    if (!(be16(s + 14) & 1)) return true;
    memcpy(o->name, s + 32, 31); o->name[31] = 0;
    const uint8_t *f = s + 64;
    o->skin = (uint32_t)f[0] << 16 | f[1] << 8 | f[2]; o->hasHair = f[3] & 1; o->hair = (uint32_t)f[4] << 16 | f[5] << 8 | f[6];
    const int rings = f[8], segs = f[9]; if (rings < 2 || rings > HEAD_RINGS || segs != 8) return true;   /* (an outfit this ROM can't wear: its plain colours instead) */
    float lo = 0, hi = 0;
    for (int r = 0; r < rings; r++) { const uint8_t *q = f + 12 + r * 20; const float y = be16s(q) / 1024.0f; if (!r || y < lo) lo = y; if (!r || y > hi) hi = y; }
    o->head.rings = rings; o->head.segs = segs; o->headY = (lo + hi) * 0.5f;
    for (int r = 0; r < rings; r++) { const uint8_t *q = f + 12 + r * 20; o->head.y[r] = be16s(q) / 1024.0f - o->headY; o->head.t[r] = q[2] / 255.0f; for (int k = 0; k < segs; k++) o->head.r[r][k] = be16(q + 4 + k * 2) / 1024.0f; }
    /* texels to a stud: a torso is 2 studs and 64 texels across; the face's 128 go half way round a head about 1.4 studs wide */
    const uint8_t *p = f + 192 + 3 * 512;
    p = picture(&o->shirt, p, f + 192, 256, 160, 8, 3, 32, 0);
    p = picture(&o->pants, p, f + 192 + 512, 256, 160, 8, 3, 32, 1);
    p = picture(&o->face, p, f + 192 + 1024, 128, 80, 7, 4, 58, 2);
    if (p - s > size) return true;
    o->ok = true;
    return true;
}
