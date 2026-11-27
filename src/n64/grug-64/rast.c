/* Grug 64: the software rasterizer. Flat-coloured convex polygons, a 16-bit depth buffer, integer inner loops.
 * It only needs the CPU and the framebuffer the VI shows, so it runs on any emulator and on the console alike
 * (the console's own rasterizer is much faster: see n64/hw.c, which the ROM picks when the hardware answers). */
#include <string.h>
#include <math.h>
#include "gfx.h"

const GfxBackend *gfx = &gfx_soft;
Frame *gfx_frame;

static void soft_begin(Frame *f, uint16_t sky) {
    gfx_frame = f;
    const uint32_t two = ((uint32_t)sky << 16) | sky;
    for (int y = 0; y < f->h; y++) {
        uint32_t *row = (uint32_t *)(void *)(f->fb + y * f->stride);
        for (int x = 0; x < f->w / 2; x++) row[x] = two;
        memset(f->zb + y * f->stride, 0, (size_t)f->w * 2);
    }
}

static void soft_poly(const SVert *v, int n, uint16_t color, int mode) {
    Frame *f = gfx_frame;
    /* the top and bottom of the polygon */
    float ymin = v[0].y, ymax = v[0].y;
    for (int i = 1; i < n; i++) { if (v[i].y < ymin) ymin = v[i].y; if (v[i].y > ymax) ymax = v[i].y; }
    int y0 = (int)ceilf(ymin - 0.5f), y1 = (int)ceilf(ymax - 0.5f) - 1;
    if (y0 < 0) y0 = 0; if (y1 >= f->h) y1 = f->h - 1; if (y0 > y1) return;
    /* depth is a plane over the screen: d = d0 + ddx (x - x0) + ddy (y - y0). Take the widest triangle of the fan. */
    float ddx = 0, ddy = 0, best = 0;
    for (int i = 1; i + 1 < n; i++) {
        float ax = v[i].x - v[0].x, ay = v[i].y - v[0].y, ad = v[i].d - v[0].d, bx = v[i + 1].x - v[0].x, by = v[i + 1].y - v[0].y, bd = v[i + 1].d - v[0].d;
        float area = ax * by - ay * bx;
        if (fabsf(area) > fabsf(best)) { best = area; ddx = (ad * by - ay * bd) / area; ddy = (ax * bd - ad * bx) / area; }
    }
    if (fabsf(best) < 0.01f) return;
    const int32_t iddx = (int32_t)(ddx * 65536.0f);
    /* every edge once: where it starts, how far x moves per line, the lines it covers */
    float ex[12], ey[12], es[12], elo[12], ehi[12]; int ne = 0;
    for (int i = 0; i < n && ne < 12; i++) {
        const SVert *p = &v[i], *q = &v[(i + 1) % n];
        float dy = q->y - p->y; if (dy > -1e-6f && dy < 1e-6f) continue;
        ex[ne] = p->x; ey[ne] = p->y; es[ne] = (q->x - p->x) / dy;
        if (dy > 0) { elo[ne] = p->y; ehi[ne] = q->y; } else { elo[ne] = q->y; ehi[ne] = p->y; }
        ne++;
    }
    for (int y = y0; y <= y1; y++) {
        const float yc = y + 0.5f;
        float xl = 1e9f, xr = -1e9f;
        for (int e = 0; e < ne; e++) {
            if (yc < elo[e] || yc >= ehi[e]) continue;
            float x = ex[e] + es[e] * (yc - ey[e]);
            if (x < xl) xl = x; if (x > xr) xr = x;
        }
        if (xl > xr) continue;
        int xs = (int)ceilf(xl - 0.5f), xe = (int)ceilf(xr - 0.5f);   /* pixels whose centres are inside */
        if (xs < 0) xs = 0; if (xe > f->w) xe = f->w;
        if (xs >= xe) continue;
        float ds = v[0].d + ddx * (xs + 0.5f - v[0].x) + ddy * (yc - v[0].y);
        if (ds < 1) ds = 1; else if (ds > 65534) ds = 65534;
        int32_t step = iddx;
        if (xe - xs > 1) {   /* keep the far end of the span inside 16 bits too */
            float de = ds + ddx * (xe - 1 - xs);
            if (de < 1 || de > 65534) { de = de < 1 ? 1 : 65534; step = (int32_t)((de - ds) / (xe - 1 - xs) * 65536.0f); }
        }
        uint32_t d = (uint32_t)(ds * 65536.0f);
        uint16_t *px = f->fb + y * f->stride + xs, *pe = f->fb + y * f->stride + xe, *pz = f->zb + y * f->stride + xs;
        if (mode == GM_OPAQUE) {
            if (step == 0) { const uint16_t dz = (uint16_t)(d >> 16); for (; px < pe; px++, pz++) if (dz >= *pz) { *pz = dz; *px = color; } }
            else for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { *pz = dz; *px = color; } d += step; }
        } else if (mode == GM_BACK) {
            for (; px < pe; px++) *px = color;
        } else {   /* GM_SHADOW: three quarters of what is there */
            for (; px < pe; px++, pz++) { const uint16_t dz = (uint16_t)(d >> 16); if (dz >= *pz) { const uint16_t c = *px; *px = (uint16_t)((((c & 0xF7BD) >> 1) + ((c & 0xE739) >> 2)) | 1); } d += step; }
        }
    }
}

static void soft_end3d(void) {}

const GfxBackend gfx_soft = { "Software", soft_begin, soft_poly, soft_end3d };
