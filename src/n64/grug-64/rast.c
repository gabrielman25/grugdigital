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

/* where each scanline of the polygon being drawn starts and ends: x on the row of pixel centres, 16.16 fixed point */
static int32_t spanL[SCREEN_H], spanR[SCREEN_H];

static void soft_poly(const SVert *v, int n, uint16_t color, int mode) {
    Frame *f = gfx_frame;
    /* the top and bottom of the polygon */
    float ymin = v[0].y, ymax = v[0].y;
    for (int i = 1; i < n; i++) { if (v[i].y < ymin) ymin = v[i].y; if (v[i].y > ymax) ymax = v[i].y; }
    int y0 = iceil(ymin - 0.5f), y1 = iceil(ymax - 0.5f) - 1;
    if (y0 < 0) y0 = 0;
    if (y1 >= f->h) y1 = f->h - 1;
    if (y0 > y1) return;
    /* depth is a plane over the screen: d = d0 + ddx (x - x0) + ddy (y - y0). Take the widest triangle of the fan. */
    float ddx = 0, ddy = 0, best = 0;
    for (int i = 1; i + 1 < n; i++) {
        float ax = v[i].x - v[0].x, ay = v[i].y - v[0].y, ad = v[i].d - v[0].d, bx = v[i + 1].x - v[0].x, by = v[i + 1].y - v[0].y, bd = v[i + 1].d - v[0].d;
        float area = ax * by - ay * bx, aa = area < 0 ? -area : area, ab = best < 0 ? -best : best;
        if (aa > ab) { best = area; float inv = 1.0f / area; ddx = (ad * by - ay * bd) * inv; ddy = (ax * bd - ad * bx) * inv; }
    }
    if (best < 0.01f && best > -0.01f) return;
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
    const int32_t iddx = (int32_t)(ddx * 65536.0f);
    const bool steep = ddx > 16.0f || ddx < -16.0f;          /* depth changes fast along a line: watch the 16-bit range */
    float drow = v[0].d + ddy * (y0 + 0.5f - v[0].y) - ddx * v[0].x;   /* the depth at x = 0 on this line */
    for (int y = y0; y <= y1; y++, drow += ddy) {
        int xs = (spanL[y] + 0x7fff) >> 16, xe = (spanR[y] + 0x7fff) >> 16;   /* pixels whose centres are inside */
        if (xs < 0) xs = 0;
        if (xe > f->w) xe = f->w;
        if (xs >= xe) continue;
        uint16_t *px = f->fb + y * f->stride + xs, *pe = px + (xe - xs);
        if (mode == GM_BACK) { fill16(px, color, xe - xs); continue; }
        float ds = drow + ddx * (xs + 0.5f);
        if (ds < 1) ds = 1; else if (ds > 65534) ds = 65534;
        int32_t step = iddx;
        if (steep && xe - xs > 1) {   /* keep the far end of the span inside 16 bits too */
            float de = ds + ddx * (xe - 1 - xs);
            if (de < 1 || de > 65534) { de = de < 1 ? 1 : 65534; step = (int32_t)((de - ds) / (xe - 1 - xs) * 65536.0f); }
        }
        uint32_t d = (uint32_t)(int32_t)(ds * 32768.0f) << 1;   /* (through a signed conversion: the FPU has no unsigned one) */
        uint16_t *pz = f->zb + y * f->stride + xs;
        if (mode == GM_OPAQUE) {
            for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { *pz = dz; *px = color; } d += step; }
        } else if (mode == GM_BASE) {   /* the first thing drawn: nothing to test against */
            for (; px < pe; px++, pz++) { *pz = (uint16_t)(d >> 16); *px = color; d += step; }
        } else {   /* GM_SHADOW: three quarters of what is there */
            for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { const uint16_t c = *px; *px = (uint16_t)((((c & 0xF7BD) >> 1) + ((c & 0xE739) >> 2)) | 1); } d += step; }
        }
    }
}

static void soft_end3d(void) {}

const GfxBackend gfx_soft = { "Software", soft_begin, soft_poly, soft_end3d };
