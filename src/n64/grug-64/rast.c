/* Grug 64: the software rasterizer. Flat-coloured convex polygons, a 16-bit depth buffer, integer inner loops.
 * It only needs the CPU and the framebuffer the VI shows, so it runs on any emulator and on the console alike
 * (the console's own rasterizer is much faster: see n64/hw.c, which the ROM picks when the hardware answers).
 *
 * This is what a browser emulator runs, and it runs it on an interpreted CPU, so every instruction counts:
 * no library calls per polygon, edges stepped in fixed point into a span table, pixels in tight loops. */
#include <string.h>
#include "gfx.h"

const GfxBackend *gfx = &gfx_soft;
Frame *gfx_frame;

static inline int iceil(float v) { int i = (int)v; return i + (v > (float)i); }

/* a run of pixels, 8 bytes at a time where it can */
static void fill16(uint16_t *p, uint16_t c, int n) {
    const uint64_t c4 = (uint64_t)c * 0x0001000100010001ULL;
    while (n > 0 && ((uintptr_t)p & 7)) { *p++ = c; n--; }
    uint64_t *q = (uint64_t *)(void *)p;
    for (; n >= 16; n -= 16, q += 4) { q[0] = c4; q[1] = c4; q[2] = c4; q[3] = c4; }
    for (; n >= 4; n -= 4) *q++ = c4;
    p = (uint16_t *)(void *)q;
    while (n-- > 0) *p++ = c;
}

/* clear: the sky down to the horizon, the far ground below it, and the depth buffer to "nothing here yet" */
static void soft_begin(Frame *f, uint16_t sky, uint16_t ground, int horizon) {
    gfx_frame = f;
    if (horizon < 0) horizon = 0;
    if (horizon > f->h) horizon = f->h;
    for (int y = 0; y < f->h; y++) {
        fill16(f->fb + y * f->stride, y < horizon ? sky : ground, f->w);
        fill16(f->zb + y * f->stride, 0, f->w);
    }
}

/* ---------------------------------------------------------------- studs
   One tile is one stud (2 studs of width on a part), 16 x 16 texels of: 0 the face's colour, 1 its lit edge, 2 its shaded
   edge. An embossed circle, lit from where the sun is (SUN in render.c: from -x, +z). Two versions: a crisp rim for up
   close, and soft half-moons (3, 4: a gentler lit and shaded) for further off, where a thin rim would only shimmer and a
   strong one would be busy. Beyond that a top is plain. */
static uint8_t studNear[256], studFar[256]; static bool studsMade;
static void make_studs(void) {
    for (int tv = 0; tv < 16; tv++) for (int tu = 0; tu < 16; tu++) {
        float ex = tu - 7.5f, ez = tv - 7.5f, d2 = ex * ex + ez * ez, lit = ex * -0.876f + ez * 0.482f;   /* (lit: not divided by d: compared against k d below) */
        float d = 0; for (int k = 0; k < 9 && d * d < d2; k++) d += 1.0f;   /* a whole-number root is enough here */
        uint8_t n = 0, f = 0;
        if (d2 >= 3.4f * 3.4f && d2 <= 6.1f * 6.1f) n = lit > 0.3f * d ? 1 : lit < -0.3f * d ? 2 : 0;
        if (d2 <= 5.6f * 5.6f) f = lit > 0.3f * d ? 3 : lit < -0.3f * d ? 4 : 0;   /* (3, 4: the softer pair) */
        studNear[tv * 16 + tu] = n; studFar[tv * 16 + tu] = f;
    }
    studsMade = true;
}
/* texel straight to colour, kept for the colours in use (the baseplate's two, the blocks' handful): one lookup a pixel, not two */
typedef struct { uint16_t key[5]; bool used; uint16_t near[256], far[256]; } StudTab;
#define STUD_TABS 32   /* (a place for each colour by its number: a world with more colours of studded part than this in view re-makes tables as it draws) */
static StudTab studTab[STUD_TABS];
static const StudTab *stud_tab(const StudFace *sf) {
    StudTab *t = &studTab[(sf->pal[0] ^ (sf->pal[0] >> 5) ^ (sf->pal[0] >> 10)) & (STUD_TABS - 1)];
    if (t->used && !memcmp(t->key, sf->pal, sizeof sf->pal)) return t;
    t->used = true; memcpy(t->key, sf->pal, sizeof sf->pal);
    for (int i = 0; i < 256; i++) { t->near[i] = sf->pal[studNear[i]]; t->far[i] = sf->pal[studFar[i]]; }
    return t;
}
#define STUD_NEAR 0.17f   /* studs of world to a pixel along a row: under this the crisp rim, */
#define STUD_FAR  0.34f   /* under this the half-moons, over it nothing */

/* where each scanline of the polygon being drawn starts and ends: x on the row of pixel centres, 16.16 fixed point */
static int32_t spanL[SCREEN_H], spanR[SCREEN_H];

/* the polygon's scanlines: which rows it covers (y0..y1), where each starts and ends (spanL, spanR), and how its depth
   changes across the screen (a plane: d = d(v[0]) + ddx (x - v[0].x) + ddy (y - v[0].y)). False: nothing to draw. */
static bool scan(const SVert *v, int n, int *py0, int *py1, float *pddx, float *pddy) {
    Frame *f = gfx_frame;
    /* the top and bottom of the polygon */
    float ymin = v[0].y, ymax = v[0].y;
    for (int i = 1; i < n; i++) { if (v[i].y < ymin) ymin = v[i].y; if (v[i].y > ymax) ymax = v[i].y; }
    int y0 = iceil(ymin - 0.5f), y1 = iceil(ymax - 0.5f) - 1;
    if (y0 < 0) y0 = 0;
    if (y1 >= f->h) y1 = f->h - 1;
    if (y0 > y1) return false;
    /* depth is a plane over the screen: d = d0 + ddx (x - x0) + ddy (y - y0). Take the widest triangle of the fan. */
    float ddx = 0, ddy = 0, best = 0;
    for (int i = 1; i + 1 < n; i++) {
        float ax = v[i].x - v[0].x, ay = v[i].y - v[0].y, ad = v[i].d - v[0].d, bx = v[i + 1].x - v[0].x, by = v[i + 1].y - v[0].y, bd = v[i + 1].d - v[0].d;
        float area = ax * by - ay * bx, aa = area < 0 ? -area : area, ab = best < 0 ? -best : best;
        if (aa > ab) { best = area; float inv = 1.0f / area; ddx = (ad * by - ay * bd) * inv; ddy = (ax * bd - ad * bx) * inv; }
    }
    if (best < 0.01f && best > -0.01f) return false;
    /* every edge once, stepped down its scanlines: the leftmost and rightmost x on each */
    for (int y = y0; y <= y1; y++) { spanL[y] = 0x7fffffff; spanR[y] = -0x7fffffff; }
    for (int i = 0; i < n; i++) {
        const SVert *p = &v[i], *q = &v[i + 1 == n ? 0 : i + 1];
        if (p->y > q->y) { const SVert *t = p; p = q; q = t; }
        int ya = iceil(p->y - 0.5f), yb = iceil(q->y - 0.5f) - 1;
        if (ya < y0) ya = y0;
        if (yb > y1) yb = y1;
        if (ya > yb) continue;
        float slope = (q->x - p->x) / (q->y - p->y);
        float x = p->x + slope * (ya + 0.5f - p->y);
        if (slope > 16000) slope = 16000; else if (slope < -16000) slope = -16000;   /* (an edge that flat covers one line: the step is never used) */
        if (x < -64) x = -64; else if (x > SCREEN_W + 64) x = SCREEN_W + 64;
        int32_t xf = (int32_t)(x * 65536.0f); const int32_t sf = (int32_t)(slope * 65536.0f);
        for (int y = ya; y <= yb; y++, xf += sf) { if (xf < spanL[y]) spanL[y] = xf; if (xf > spanR[y]) spanR[y] = xf; }
    }
    *py0 = y0; *py1 = y1; *pddx = ddx; *pddy = ddy;
    return true;
}

static void raster(const SVert *v, int n, uint16_t color, int mode, const StudFace *sf) {
    Frame *f = gfx_frame; int y0, y1; float ddx, ddy;
    if (!scan(v, n, &y0, &y1, &ddx, &ddy)) return;
    const StudTab *tab = 0;
    const int32_t iddx = (int32_t)(ddx * 65536.0f);
    const bool steep = ddx > 16.0f || ddx < -16.0f;          /* depth changes fast along a line: watch the 16-bit range */
    float drow = v[0].d + ddy * (y0 + 0.5f - v[0].y) - ddx * v[0].x;   /* the depth at x = 0 on this line */
    for (int y = y0; y <= y1; y++, drow += ddy) {
        int xs = (spanL[y] + 0x7fff) >> 16, xe = (spanR[y] + 0x7fff) >> 16;   /* pixels whose centres are inside */
        if (xs < 0) xs = 0;
        if (xe > f->w) xe = f->w;
        if (xs >= xe) continue;
        uint16_t *px = f->fb + y * f->stride + xs, *pe = px + (xe - xs);
        /* a studded top: where this row lies on the face. One tile is 16 texels, so the fraction of a tile, 16 bits of it, is
           the texel in 4.12, and it wraps by itself. Across in the low half of one word and along in the high half: one add
           a pixel moves both. (A carry from the low half nudges the high one by a 4096th of a texel: nothing.) */
        const uint16_t *tex = 0; uint32_t uv = 0, duv = 0;
        if (sf) {
            float wx, wz, wdx, wdz;
            if (r_row(sf->y, y, &wx, &wz, &wdx, &wdz)) {
                float step2 = wdx * wdx + wdz * wdz;
                if (step2 < STUD_FAR * STUD_FAR) {
                    if (!tab) tab = stud_tab(sf);
                    tex = step2 < STUD_NEAR * STUD_NEAR ? tab->near : tab->far;
                    const int32_t uu = (int32_t)((wx + wdx * xs - sf->ox) * sf->su * 65536.0f), du = (int32_t)(wdx * sf->su * 65536.0f);
                    const int32_t vv = (int32_t)((wz + wdz * xs - sf->oz) * sf->sv * 65536.0f), dv = (int32_t)(wdz * sf->sv * 65536.0f);
                    uv = ((uint32_t)vv << 16) | ((uint32_t)uu & 0xffff); duv = ((uint32_t)dv << 16) + ((uint32_t)du & 0xffff);
                }
            }
        }
#define TEXEL() tex[((uv >> 24) & 0xF0) | ((uv >> 12) & 0x0F)]
        if (mode == GM_BACK) {
            if (tex) {
                /* the baseplate: most of the screen, so the pattern is looked up once for every two pixels and both written
                   at once (half the work; the studs come out a little chunkier, which suits the machine) */
                if (((uintptr_t)px & 2) && px < pe) { *px++ = TEXEL(); uv += duv; }
                uint32_t *q = (uint32_t *)(void *)px, *qe = q + ((pe - px) >> 1); const uint32_t duv2 = duv << 1;
                for (; q < qe; q++, uv += duv2) { const uint32_t c = TEXEL(); *q = (c << 16) | c; }
                px = (uint16_t *)(void *)q; if (px < pe) *px = TEXEL();
            } else fill16(px, color, xe - xs);
            continue;
        }
        float ds = drow + ddx * (xs + 0.5f);
        if (ds < 1) ds = 1; else if (ds > 65534) ds = 65534;
        int32_t step = iddx;
        if (steep && xe - xs > 1) {   /* keep the far end of the span inside 16 bits too */
            float de = ds + ddx * (xe - 1 - xs);
            if (de < 1 || de > 65534) { de = de < 1 ? 1 : 65534; step = (int32_t)((de - ds) / (xe - 1 - xs) * 65536.0f); }
        }
        uint32_t d = (uint32_t)(int32_t)(ds * 32768.0f) << 1;   /* (through a signed conversion: the FPU has no unsigned one) */
        uint16_t *pz = f->zb + y * f->stride + xs;
        if (mode == GM_OPAQUE && tex) {
            for (; px < pe; px++, pz++, uv += duv) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { *pz = dz; *px = TEXEL(); } d += step; }
        } else if (mode == GM_OPAQUE) {
            for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { *pz = dz; *px = color; } d += step; }
        } else if (mode == GM_BASE) {   /* the first thing drawn: nothing to test against */
            for (; px < pe; px++, pz++) { *pz = (uint16_t)(d >> 16); *px = color; d += step; }
        } else {   /* GM_SHADOW: three quarters of what is there */
            for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { const uint16_t c = *px; *px = (uint16_t)((((c & 0xF7BD) >> 1) + ((c & 0xE739) >> 2)) | 1); } d += step; }
        }
    }
}

#undef TEXEL

/* a face wearing a picture. Where the picture lies is worked out exactly at both ends of every run of up to 32 pixels (two
   divisions) and stepped straight in between: close enough that the eye can't tell, at a fraction of the cost. */
#define TEX_RUN 32
static void raster_tex(const SVert *v, int n, const TexFace *tf) {
    Frame *f = gfx_frame; int y0, y1; float ddx, ddy;
    if (!scan(v, n, &y0, &y1, &ddx, &ddy)) return;
    const uint8_t *tex = tf->tex; const uint16_t *pal = tf->pal; const int shift = tf->shift;
    const int32_t iddx = (int32_t)(ddx * 65536.0f);
    const bool steep = ddx > 16.0f || ddx < -16.0f;
    float drow = v[0].d + ddy * (y0 + 0.5f - v[0].y) - ddx * v[0].x;
    float urow = tf->ub * y0 + tf->uc, vrow = tf->vb * y0 + tf->vc, wrow = tf->wb * y0 + tf->wc;
    for (int y = y0; y <= y1; y++, drow += ddy, urow += tf->ub, vrow += tf->vb, wrow += tf->wb) {
        int xs = (spanL[y] + 0x7fff) >> 16, xe = (spanR[y] + 0x7fff) >> 16;
        if (xs < 0) xs = 0;
        if (xe > f->w) xe = f->w;
        if (xs >= xe) continue;
        float ds = drow + ddx * (xs + 0.5f);
        if (ds < 1) ds = 1; else if (ds > 65534) ds = 65534;
        int32_t step = iddx;
        if (steep && xe - xs > 1) { float de = ds + ddx * (xe - 1 - xs); if (de < 1 || de > 65534) { de = de < 1 ? 1 : 65534; step = (int32_t)((de - ds) / (xe - 1 - xs) * 65536.0f); } }
        uint32_t d = (uint32_t)(int32_t)(ds * 32768.0f) << 1;
        uint16_t *px = f->fb + y * f->stride + xs, *pz = f->zb + y * f->stride + xs;
        /* the picture at the start of the row */
#define AT(x_, u_, v_) do { const float w_ = tf->wa * (x_) + wrow, i_ = (w_ > 1e-12f || w_ < -1e-12f) ? 1.0f / w_ : 0; float a_ = (tf->ua * (x_) + urow) * i_, b_ = (tf->va * (x_) + vrow) * i_; \
            a_ = a_ < tf->umin ? tf->umin : a_ > tf->umax ? tf->umax : a_; b_ = b_ < tf->vmin ? tf->vmin : b_ > tf->vmax ? tf->vmax : b_; u_ = (int32_t)(a_ * 65536.0f); v_ = (int32_t)(b_ * 65536.0f); } while (0)
        int32_t u, vv; AT(xs, u, vv);
        for (int x = xs; x < xe; ) {
            int run = xe - x; if (run > TEX_RUN) run = TEX_RUN;
            int32_t u1, v1, du = 0, dv = 0;
            if (run > 1) { AT(x + run - 1, u1, v1); du = (u1 - u) / (run - 1); dv = (v1 - vv) / (run - 1); } else { u1 = u; v1 = vv; }
            uint16_t *pe = px + run; int32_t uu = u, vt = vv;
            for (; px < pe; px++, pz++, uu += du, vt += dv) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { *pz = dz; *px = pal[tex[((vt >> 16) << shift) + (uu >> 16)]]; } d += step; }
            x += run; if (x < xe) AT(x, u, vv);
        }
#undef AT
    }
}
static void soft_tex(const SVert *v, int n, const TexFace *tf) { raster_tex(v, n, tf); }
static void soft_poly(const SVert *v, int n, uint16_t color, int mode) { raster(v, n, color, mode, 0); }
static void soft_studs(const SVert *v, int n, const StudFace *sf, int mode) { if (!studsMade) make_studs(); raster(v, n, sf->pal[0], mode, sf); }
static void soft_end3d(void) {}

const GfxBackend gfx_soft = { "Software", soft_begin, soft_poly, soft_studs, soft_tex, soft_end3d };
