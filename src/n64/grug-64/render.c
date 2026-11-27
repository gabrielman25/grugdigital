/* Grug 64: the 3D pipeline. World space in, flat-coloured screen polygons out (gfx->poly).
 * The light is the Grug light from the Baseplate (hemisphere 0xfff0e2 / 0x8a7a6a at 0.64, sun 0xffe9d2 at 0.85 from
 * SUN_DIR), worked out per face instead of per pixel. */
#include <math.h>
#include "gfx.h"

#define NEAR_Z 0.5f
int r_polys;
bool r_studs = true;

/* ---------------------------------------------------------------- small 3x3 matrices */
void m3_identity(Mat3 *m) { for (int i = 0; i < 9; i++) m->m[i] = (i % 4 == 0) ? 1.0f : 0.0f; }
void m3_rot_x(Mat3 *m, float a) { float c = cosf(a), s = sinf(a); m3_identity(m); m->m[4] = c; m->m[5] = -s; m->m[7] = s; m->m[8] = c; }
void m3_rot_y(Mat3 *m, float a) { float c = cosf(a), s = sinf(a); m3_identity(m); m->m[0] = c; m->m[2] = s; m->m[6] = -s; m->m[8] = c; }
void m3_axis_angle(Mat3 *m, float x, float y, float z, float a) {
    float c = cosf(a), s = sinf(a), t = 1 - c;
    m->m[0] = t * x * x + c;     m->m[1] = t * x * y - s * z; m->m[2] = t * x * z + s * y;
    m->m[3] = t * x * y + s * z; m->m[4] = t * y * y + c;     m->m[5] = t * y * z - s * x;
    m->m[6] = t * x * z - s * y; m->m[7] = t * y * z + s * x; m->m[8] = t * z * z + c;
}
void m3_mul(Mat3 *o, const Mat3 *a, const Mat3 *b) {
    Mat3 r;
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) r.m[i * 3 + j] = a->m[i * 3] * b->m[j] + a->m[i * 3 + 1] * b->m[3 + j] + a->m[i * 3 + 2] * b->m[6 + j];
    *o = r;
}
void m3_euler(Mat3 *m, float rx, float ry, float rz) {   /* three.js order XYZ: M = Rx Ry Rz */
    Mat3 x, y, z; m3_rot_x(&x, rx); m3_rot_y(&y, ry);
    float c = cosf(rz), s = sinf(rz); m3_identity(&z); z.m[0] = c; z.m[1] = -s; z.m[3] = s; z.m[4] = c;
    m3_mul(m, &x, &y); m3_mul(m, m, &z);
}
void m3_apply(const Mat3 *m, const float v[3], float o[3]) {
    float x = v[0], y = v[1], z = v[2];
    o[0] = m->m[0] * x + m->m[1] * y + m->m[2] * z; o[1] = m->m[3] * x + m->m[4] * y + m->m[5] * z; o[2] = m->m[6] * x + m->m[7] * y + m->m[8] * z;
}

/* ---------------------------------------------------------------- camera */
static struct { float px, py, pz; float rx, ry, rz, ux, uy, uz, fx, fy, fz; float tanH, tanV, kx, ky, sH, sV, ikx, iky; } C;

void r_camera(float px, float py, float pz, float tx, float ty, float tz, float fovY) {
    float fx = tx - px, fy = ty - py, fz = tz - pz, l = sqrtf(fx * fx + fy * fy + fz * fz); if (l < 1e-6f) { fz = -1; l = 1; }
    fx /= l; fy /= l; fz /= l;
    float rx = -fz, rz = fx, rl = sqrtf(rx * rx + rz * rz);   /* right = forward x up(0,1,0) */
    if (rl < 1e-5f) { rx = 1; rz = 0; rl = 1; }
    rx /= rl; rz /= rl;
    C.px = px; C.py = py; C.pz = pz; C.fx = fx; C.fy = fy; C.fz = fz; C.rx = rx; C.ry = 0; C.rz = rz;
    C.ux = C.ry * fz - C.rz * fy; C.uy = C.rz * fx - C.rx * fz; C.uz = C.rx * fy - C.ry * fx;   /* up = right x forward */
    C.tanV = tanf(fovY * 0.5f * 3.14159265f / 180.0f); C.tanH = C.tanV * (4.0f / 3.0f);   /* a 4:3 picture whatever the buffer */
    C.sH = sqrtf(1 + C.tanH * C.tanH); C.sV = sqrtf(1 + C.tanV * C.tanV);
    C.kx = (SCREEN_W * 0.5f) / C.tanH; C.ky = (SCREEN_H * 0.5f) / C.tanV; C.ikx = 1.0f / C.kx; C.iky = 1.0f / C.ky;
    r_polys = 0;
}
static inline void to_view(const float w[3], float v[3]) {
    float x = w[0] - C.px, y = w[1] - C.py, z = w[2] - C.pz;
    v[0] = x * C.rx + y * C.ry + z * C.rz; v[1] = x * C.ux + y * C.uy + z * C.uz; v[2] = x * C.fx + y * C.fy + z * C.fz;
}

/* ---------------------------------------------------------------- the Grug light, per face */
static const float SUN[3] = { -0.5584f, 0.7707f, 0.3070f };
uint16_t r_shade(uint32_t color, float nx, float ny, float nz) {
    float h = (ny + 1) * 0.5f, s = nx * SUN[0] + ny * SUN[1] + nz * SUN[2]; if (s < 0) s = 0; s *= 0.85f;
    float lr = (0.541f + (1.000f - 0.541f) * h) * 0.64f + s * 1.000f;
    float lg = (0.478f + (0.941f - 0.478f) * h) * 0.64f + s * 0.914f;
    float lb = (0.416f + (0.886f - 0.416f) * h) * 0.64f + s * 0.824f;
    int r = (int)(((color >> 16) & 255) * lr), g = (int)(((color >> 8) & 255) * lg), b = (int)((color & 255) * lb);
    return rgb5551(r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
}

/* ---------------------------------------------------------------- clip (view space) and project */
#define MAXV 24
static int clip_plane(float in[][3], int n, float out[][3], int plane) {
    /* 0: near, 1: left, 2: right, 3: bottom, 4: top. Inside when dist >= 0. */
    float d[MAXV]; int m = 0;
    for (int i = 0; i < n; i++) {
        const float *v = in[i];
        switch (plane) {
            case 0: d[i] = v[2] - NEAR_Z; break;
            case 1: d[i] = v[0] + v[2] * C.tanH; break;
            case 2: d[i] = -v[0] + v[2] * C.tanH; break;
            case 3: d[i] = v[1] + v[2] * C.tanV; break;
            default: d[i] = -v[1] + v[2] * C.tanV; break;
        }
    }
    for (int i = 0; i < n && m < MAXV - 1; i++) {
        int j = (i + 1) % n;
        if (d[i] >= 0) { out[m][0] = in[i][0]; out[m][1] = in[i][1]; out[m][2] = in[i][2]; m++; }
        if ((d[i] >= 0) != (d[j] >= 0)) {
            float t = d[i] / (d[i] - d[j]);
            out[m][0] = in[i][0] + (in[j][0] - in[i][0]) * t; out[m][1] = in[i][1] + (in[j][1] - in[i][1]) * t; out[m][2] = in[i][2] + (in[j][2] - in[i][2]) * t; m++;
        }
    }
    return m;
}
/* a convex polygon in view space -> the backend */
static void emit(float v[][3], int n, uint16_t color, int mode, float bias, const StudFace *sf, const TexFace *tf) {
    float a[MAXV][3], b[MAXV][3];
    /* outcodes: all inside (no clipping), or all outside one plane (gone) */
    int all = 0x1f, any = 0;
    for (int i = 0; i < n; i++) {
        const float *p = v[i]; int o = 0;
        if (p[2] < NEAR_Z) o |= 1; if (p[0] < -p[2] * C.tanH) o |= 2; if (p[0] > p[2] * C.tanH) o |= 4; if (p[1] < -p[2] * C.tanV) o |= 8; if (p[1] > p[2] * C.tanV) o |= 16;
        all &= o; any |= o;
    }
    if (all) return;
    float (*cur)[3] = v;
    if (any) {
        float (*dst)[3] = a;
        for (int pl = 0; pl < 5; pl++) {
            if (!(any & (1 << pl))) continue;
            n = clip_plane(cur, n, dst, pl); if (n < 3) return;
            cur = dst; dst = (dst == a) ? b : a;
        }
    }
    SVert s[MAXV];
    for (int i = 0; i < n; i++) {
        float iz = 1.0f / cur[i][2];
        s[i].x = SCREEN_W * 0.5f + cur[i][0] * iz * C.kx; s[i].y = SCREEN_H * 0.5f - cur[i][1] * iz * C.ky;
        s[i].d = DEPTH_SCALE * NEAR_Z * iz + DEPTH_BIAS + bias;
    }
    r_polys++;
    if (tf) gfx->tex(s, n, tf); else if (sf) gfx->studs(s, n, sf, mode); else gfx->poly(s, n, color, mode);
}

void r_quad(const float p[4][3], uint16_t color, int mode, float bias) {
    float v[MAXV][3];
    for (int i = 0; i < 4; i++) to_view(p[i], v[i]);
    emit(v, 4, color, mode, bias, 0, 0);
}

void r_ngon_flat(float cx, float y, float cz, float radius, int sides, uint16_t color, int mode) {
    float v[MAXV][3]; if (sides > MAXV - 6) sides = MAXV - 6;
    for (int i = 0; i < sides; i++) { float a = i * 6.2831853f / sides, w[3] = { cx + cosf(a) * radius, y, cz + sinf(a) * radius }; to_view(w, v[i]); }
    emit(v, sides, color, mode, 24, 0, 0);
}

bool r_project(float x, float y, float z, int *sx, int *sy, float *dist) {
    float w[3] = { x, y, z }, v[3]; to_view(w, v);
    if (v[2] < NEAR_Z) return false;
    float iz = 1.0f / v[2];
    *sx = (int)(SCREEN_W * 0.5f + v[0] * iz * C.kx); *sy = (int)(SCREEN_H * 0.5f - v[1] * iz * C.ky);
    if (dist) *dist = v[2];
    return true;
}

/* the horizon: a level ray is this far up the screen (the camera never rolls, so it is a straight line across) */
int r_horizon(void) {
    float h = sqrtf(1 - C.fy * C.fy); if (h < 0.02f) return C.fy < 0 ? -1 : SCREEN_H + 1;
    float y = SCREEN_H * 0.5f + C.ky * (C.fy / h);
    return y < -1 ? -1 : y > SCREEN_H + 1 ? SCREEN_H + 1 : (int)y;
}

/* corner i of a box: bit 0 = +x, bit 1 = +y, bit 2 = +z. The faces, wound so they read the same from outside. */
static const uint8_t FACE[6][4] = { { 1, 3, 7, 5 }, { 0, 4, 6, 2 }, { 2, 6, 7, 3 }, { 0, 1, 5, 4 }, { 4, 5, 7, 6 }, { 0, 2, 3, 1 } };   /* +x -x +y -y +z -z */
static const float FN[6][3] = { { 1, 0, 0 }, { -1, 0, 0 }, { 0, 1, 0 }, { 0, -1, 0 }, { 0, 0, 1 }, { 0, 0, -1 } };

/* an axis-aligned box. skipTop: 1 leaves the top face out (the baseplate's top is drawn as tiles) */
/* studs: the face's colour, a lit edge and a shaded edge, and how the stud tiles sit on the face (whole studs edge to
   edge, one every 2 studs of width, as on the web: a face narrower than about a stud and a half is plain) */
static bool stud_face(StudFace *sf, float minX, float minZ, float maxX, float maxZ, float y, uint32_t color) {
    float sx = maxX - minX, sz = maxZ - minZ; int nu = (int)(sx * 0.5f + 0.5f), nv = (int)(sz * 0.5f + 0.5f);
    if (!r_studs || sx < 1.5f || sz < 1.5f || nu < 1 || nv < 1) return false;
    /* the five tones only depend on the colour (a top always faces up): kept for the colours in use, not worked out per face */
    static struct { uint32_t color; uint16_t pal[5]; bool used; } tones[64];
    const unsigned slot = (color ^ (color >> 7) ^ (color >> 15)) & 63;
    if (!tones[slot].used || tones[slot].color != color) {
        const int cr = (color >> 16) & 255, cg = (color >> 8) & 255, cb = color & 255;
#define TONE(k) ((uint32_t)((cr * (k) / 100 > 255 ? 255 : cr * (k) / 100) << 16 | (cg * (k) / 100 > 255 ? 255 : cg * (k) / 100) << 8 | (cb * (k) / 100 > 255 ? 255 : cb * (k) / 100)))
        uint16_t *q = tones[slot].pal; tones[slot].color = color; tones[slot].used = true;
        q[0] = r_shade(color, 0, 1, 0); q[1] = r_shade(TONE(118), 0, 1, 0); q[2] = r_shade(TONE(74), 0, 1, 0); q[3] = r_shade(TONE(107), 0, 1, 0); q[4] = r_shade(TONE(88), 0, 1, 0);
#undef TONE
    }
    for (int i = 0; i < 5; i++) sf->pal[i] = tones[slot].pal[i];
    sf->y = y; sf->ox = minX; sf->oz = minZ; sf->su = nu / sx; sf->sv = nv / sz;
    return true;
}
void r_top(float minX, float minZ, float maxX, float maxZ, float y, uint32_t color, int mode) {
    const float p[4][3] = { { minX, y, minZ }, { maxX, y, minZ }, { maxX, y, maxZ }, { minX, y, maxZ } };
    float v[MAXV][3]; for (int i = 0; i < 4; i++) to_view(p[i], v[i]);
    StudFace sf;
    if (stud_face(&sf, minX, minZ, maxX, maxZ, y, color)) emit(v, 4, sf.pal[0], mode, 0, &sf, 0); else emit(v, 4, r_shade(color, 0, 1, 0), mode, 0, 0, 0);
}
/* where a screen row meets a level plane. The camera never rolls, so along a row the world position moves in a straight
   line at a steady pace: this is what makes studs cheap (the trick old games used for floors). */
bool r_row(float planeY, int sy, float *x0, float *z0, float *dx, float *dz) {
    float dyv = (SCREEN_H * 0.5f - (sy + 0.5f)) * C.iky, diry = C.uy * dyv + C.fy;
    if (diry > -1e-5f && diry < 1e-5f) return false;
    float t = (planeY - C.py) / diry; if (t <= 0) return false;
    const float ikx = C.ikx, dxv = (0.5f - SCREEN_W * 0.5f) * ikx;
    *x0 = C.px + t * (C.rx * dxv + C.ux * dyv + C.fx); *z0 = C.pz + t * (C.rz * dxv + C.uz * dyv + C.fz);
    *dx = t * C.rx * ikx; *dz = t * C.rz * ikx;
    return true;
}

/* the light on each of the six ways an upright box's faces point: worked out once */
static float boxLight[6][3]; static bool boxLit;
static inline uint16_t box_shade(uint32_t color, int f) {
    if (!boxLit) { boxLit = true; for (int i = 0; i < 6; i++) { const float h = (FN[i][1] + 1) * 0.5f; float sn = FN[i][0] * SUN[0] + FN[i][1] * SUN[1] + FN[i][2] * SUN[2]; if (sn < 0) sn = 0; sn *= 0.85f;
        boxLight[i][0] = (0.541f + (1.000f - 0.541f) * h) * 0.64f + sn * 1.000f; boxLight[i][1] = (0.478f + (0.941f - 0.478f) * h) * 0.64f + sn * 0.914f; boxLight[i][2] = (0.416f + (0.886f - 0.416f) * h) * 0.64f + sn * 0.824f; } }
    const int r = (int)(((color >> 16) & 255) * boxLight[f][0]), g = (int)(((color >> 8) & 255) * boxLight[f][1]), b = (int)((color & 255) * boxLight[f][2]);
    return rgb5551(r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
}
/* studs can only be seen this close: further off a stud is smaller than a pixel (STUD_FAR in rast.c is the same 0.34 studs a pixel) */
#define STUD_REACH (0.34f * C.kx)

void r_box(float minX, float minY, float minZ, float maxX, float maxY, float maxZ, uint32_t color, int top) {
    /* which faces can the camera see? */
    int vis = 0;
    if (C.px > maxX) vis |= 1; if (C.px < minX) vis |= 2; if (C.py > maxY && top != R_TOP_NONE) vis |= 4; if (C.py < minY) vis |= 8; if (C.pz > maxZ) vis |= 16; if (C.pz < minZ) vis |= 32;
    if (!vis) return;
    /* the whole box against the view volume (its bounding sphere) */
    float cz, cr; bool inside;
    { float c[3] = { (minX + maxX) * 0.5f, (minY + maxY) * 0.5f, (minZ + maxZ) * 0.5f }, v[3]; to_view(c, v);
      float hx = (maxX - minX) * 0.5f, hy = (maxY - minY) * 0.5f, hz = (maxZ - minZ) * 0.5f, r = sqrtf(hx * hx + hy * hy + hz * hz);
      if (v[2] < -r || v[0] - v[2] * C.tanH > r * C.sH || -v[0] - v[2] * C.tanH > r * C.sH || v[1] - v[2] * C.tanV > r * C.sV || -v[1] - v[2] * C.tanV > r * C.sV) return;
      cz = v[2]; cr = r;
      /* wholly inside it? Then nothing needs clipping, and the corners can be put on the screen once for all the faces */
      inside = v[2] - r > NEAR_Z && v[0] - v[2] * C.tanH < -r * C.sH && -v[0] - v[2] * C.tanH < -r * C.sH && v[1] - v[2] * C.tanV < -r * C.sV && -v[1] - v[2] * C.tanV < -r * C.sV; }
    const bool studs = top == R_TOP_STUDS && cz - cr < STUD_REACH;
    float cv[8][3];
    for (int i = 0; i < 8; i++) { float w[3] = { (i & 1) ? maxX : minX, (i & 2) ? maxY : minY, (i & 4) ? maxZ : minZ }; to_view(w, cv[i]); }
    if (inside) {
        SVert sc[8];
        for (int i = 0; i < 8; i++) { const float iz = 1.0f / cv[i][2]; sc[i].x = SCREEN_W * 0.5f + cv[i][0] * iz * C.kx; sc[i].y = SCREEN_H * 0.5f - cv[i][1] * iz * C.ky; sc[i].d = DEPTH_SCALE * NEAR_Z * iz + DEPTH_BIAS; }
        for (int f = 0; f < 6; f++) {
            if (!(vis & (1 << f))) continue;
            const SVert q[4] = { sc[FACE[f][0]], sc[FACE[f][1]], sc[FACE[f][2]], sc[FACE[f][3]] };
            StudFace sf; r_polys++;
            if (f == 2 && studs && stud_face(&sf, minX, minZ, maxX, maxZ, maxY, color)) gfx->studs(q, 4, &sf, GM_OPAQUE); else gfx->poly(q, 4, box_shade(color, f), GM_OPAQUE);
        }
        return;
    }
    for (int f = 0; f < 6; f++) {
        if (!(vis & (1 << f))) continue;
        float v[MAXV][3];
        for (int k = 0; k < 4; k++) { const float *s = cv[FACE[f][k]]; v[k][0] = s[0]; v[k][1] = s[1]; v[k][2] = s[2]; }
        StudFace sf;
        if (f == 2 && studs && stud_face(&sf, minX, minZ, maxX, maxZ, maxY, color)) emit(v, 4, sf.pal[0], GM_OPAQUE, 0, &sf, 0);
        else emit(v, 4, box_shade(color, f), GM_OPAQUE, 0, 0, 0);
    }
}

/* a box at any angle: centre c, rotation m, half sizes. white: drawn flat white (the flash when something is hit) */
void r_obox(const float c[3], const Mat3 *m, float hx, float hy, float hz, uint32_t color, bool white) {
    float cv[8][3], cw[8][3];
    for (int i = 0; i < 8; i++) {
        float l[3] = { (i & 1) ? hx : -hx, (i & 2) ? hy : -hy, (i & 4) ? hz : -hz }, w[3]; m3_apply(m, l, w);
        cw[i][0] = w[0] + c[0]; cw[i][1] = w[1] + c[1]; cw[i][2] = w[2] + c[2]; to_view(cw[i], cv[i]);
    }
    for (int f = 0; f < 6; f++) {
        float n[3]; m3_apply(m, FN[f], n);
        const float *p = cw[FACE[f][0]];
        if (n[0] * (C.px - p[0]) + n[1] * (C.py - p[1]) + n[2] * (C.pz - p[2]) <= 0) continue;
        float v[MAXV][3];
        for (int k = 0; k < 4; k++) { const float *s = cv[FACE[f][k]]; v[k][0] = s[0]; v[k][1] = s[1]; v[k][2] = s[2]; }
        emit(v, 4, white ? rgb5551(255, 242, 242) : r_shade(color, n[0], n[1], n[2]), GM_OPAQUE, 0, 0, 0);
    }
}

/* ---------------------------------------------------------------- pictures on faces
   A picture is lit by the face it is on, like a flat colour is: its 256 colours are multiplied by the face's light. Doing
   that for every face every frame would cost more than drawing them, so the light is rounded to one of 32 steps and each
   step's palette is made once, the first time a face needs it. */
#define LIT_STEPS 32
static uint16_t litPal[TEX_MAX][LIT_STEPS][256]; static uint8_t litHave[TEX_MAX][LIT_STEPS];
void r_tex_reset(void) { for (int i = 0; i < TEX_MAX; i++) for (int k = 0; k < LIT_STEPS; k++) litHave[i][k] = 0; }
static const uint16_t *lit_palette(const Tex *t, float nx, float ny, float nz) {
    float h = (ny + 1) * 0.5f, s = nx * SUN[0] + ny * SUN[1] + nz * SUN[2]; if (s < 0) s = 0;
    float lr = (0.541f + (1.000f - 0.541f) * h) * 0.64f + s * 0.85f;                  /* the red of r_shade's light: 0.35 in shade .. 1.3 in the sun */
    int q = (int)((lr - 0.3f) * (LIT_STEPS - 1) / 1.05f + 0.5f); if (q < 0) q = 0; if (q >= LIT_STEPS) q = LIT_STEPS - 1;
    uint16_t *p = litPal[t->id][q];
    if (!litHave[t->id][q]) {
        litHave[t->id][q] = 1;
        /* the step's light, with the green and blue that go with that much red (the light is warm: less of them) */
        float r = 0.3f + q * 1.05f / (LIT_STEPS - 1), g, b;
        if (r <= 0.64f) { float hh = (r / 0.64f - 0.541f) / 0.459f; if (hh < 0) hh = 0; g = (0.478f + 0.463f * hh) * 0.64f; b = (0.416f + 0.470f * hh) * 0.64f; }
        else { g = 0.941f * 0.64f + (r - 0.64f) * 0.914f; b = 0.886f * 0.64f + (r - 0.64f) * 0.824f; }
        const int ir = (int)(r * 256), ig = (int)(g * 256), ib = (int)(b * 256);
        for (int i = 0; i < 256; i++) {
            const uint16_t c = t->pal[i]; int cr = (((c >> 11) & 31) * ir) >> 8, cg = (((c >> 6) & 31) * ig) >> 8, cb = (((c >> 1) & 31) * ib) >> 8;
            p[i] = (uint16_t)(((cr > 31 ? 31 : cr) << 11) | ((cg > 31 ? 31 : cg) << 6) | ((cb > 31 ? 31 : cb) << 1) | 1);
        }
    }
    return p;
}
/* which copy of the picture: the biggest that isn't squeezed to much less than a pixel a texel at this distance */
static int tex_level(const Tex *t, float viewZ) {
    float k = t->density * (viewZ < NEAR_Z ? NEAR_Z : viewZ) * C.iky; int l = 0;
    while (k > 1.5f && l < t->nlv - 1) { k *= 0.5f; l++; }
    return l;
}
/* Where the picture lies on a flat face, as the three lines the backend steps across the screen. The face is
   P = O + a Su + b Sv (view space), and the picture's texel there is (u0 + a du, v0 + b dv). A pixel's ray r meets the
   face at t r, t = (O.n) / (r.n), and a = (P - O).(Sv x n) / n.n, b = (P - O).(n x Su) / n.n: so a (r.n) and b (r.n) are
   straight lines in r, which is straight in the pixel's column and row. */
static bool tex_plane(TexFace *tf, const float O[3], const float Su[3], const float Sv[3], float u0, float du, float v0, float dv) {
    const float n[3] = { Su[1] * Sv[2] - Su[2] * Sv[1], Su[2] * Sv[0] - Su[0] * Sv[2], Su[0] * Sv[1] - Su[1] * Sv[0] }, n2 = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
    if (n2 < 1e-12f) return false;
    const float A[3] = { Sv[1] * n[2] - Sv[2] * n[1], Sv[2] * n[0] - Sv[0] * n[2], Sv[0] * n[1] - Sv[1] * n[0] }, B[3] = { n[1] * Su[2] - n[2] * Su[1], n[2] * Su[0] - n[0] * Su[2], n[0] * Su[1] - n[1] * Su[0] };
    const float On = O[0] * n[0] + O[1] * n[1] + O[2] * n[2], OA = O[0] * A[0] + O[1] * A[1] + O[2] * A[2], OB = O[0] * B[0] + O[1] * B[1] + O[2] * B[2], k = 1.0f / n2;
    float cu[3], cv[3];
    for (int i = 0; i < 3; i++) { cu[i] = du * (On * A[i] - OA * n[i]) * k + u0 * n[i]; cv[i] = dv * (On * B[i] - OB * n[i]) * k + v0 * n[i]; }
#define LINE(c, a_, b_, c_) do { a_ = c[0] * C.ikx; b_ = -c[1] * C.iky; c_ = c[0] * C.ikx * (0.5f - SCREEN_W * 0.5f) + c[1] * C.iky * (SCREEN_H * 0.5f - 0.5f) + c[2]; } while (0)
    LINE(cu, tf->ua, tf->ub, tf->uc); LINE(cv, tf->va, tf->vb, tf->vc); LINE(n, tf->wa, tf->wb, tf->wc);
#undef LINE
    return true;
}

/* which corners of a box a face's picture hangs from: its top-left, the end of its top edge, the corner under the first
   (the same table as CORNERS in arcade/grug-64/outfit64.js, which cuts the pictures out) */
static const uint8_t TEXC[6][3] = { { 7, 3, 5 }, { 2, 6, 0 }, { 7, 6, 3 }, { 1, 0, 5 }, { 6, 7, 4 }, { 3, 2, 1 } };
void r_obox_tex(const float c[3], const Mat3 *m, float hx, float hy, float hz, const Tex *t, const TexRect face[6]) {
    float cv[8][3], cw[8][3], vc[3];
    for (int i = 0; i < 8; i++) {
        float l[3] = { (i & 1) ? hx : -hx, (i & 2) ? hy : -hy, (i & 4) ? hz : -hz }, w[3]; m3_apply(m, l, w);
        cw[i][0] = w[0] + c[0]; cw[i][1] = w[1] + c[1]; cw[i][2] = w[2] + c[2]; to_view(cw[i], cv[i]);
    }
    to_view(c, vc); const int lv = tex_level(t, vc[2]);
    for (int f = 0; f < 6; f++) {
        float n[3]; m3_apply(m, FN[f], n);
        const float *p = cw[FACE[f][0]];
        if (n[0] * (C.px - p[0]) + n[1] * (C.py - p[1]) + n[2] * (C.pz - p[2]) <= 0) continue;
        float v[MAXV][3];
        for (int k = 0; k < 4; k++) { const float *s = cv[FACE[f][k]]; v[k][0] = s[0]; v[k][1] = s[1]; v[k][2] = s[2]; }
        const float *O = cv[TEXC[f][0]], *U = cv[TEXC[f][1]], *V = cv[TEXC[f][2]], Su[3] = { U[0] - O[0], U[1] - O[1], U[2] - O[2] }, Sv[3] = { V[0] - O[0], V[1] - O[1], V[2] - O[2] };
        const float x = (float)(face[f].x >> lv), y = (float)(face[f].y >> lv), w = (float)(face[f].w >> lv), h = (float)(face[f].h >> lv);
        TexFace tf; tf.tex = t->lv[lv]; tf.shift = t->wshift - lv; tf.pal = lit_palette(t, n[0], n[1], n[2]);
        tf.umin = x; tf.umax = x + w - 0.02f; tf.vmin = y; tf.vmax = y + h - 0.02f;
        tf.flat = tf.pal[tf.tex[((int)(y + h * 0.5f) << tf.shift) + (int)(x + w * 0.5f)]];
        if (!tex_plane(&tf, O, Su, Sv, x, w, y, h)) continue;
        emit(v, 4, tf.flat, GM_OPAQUE, 0, 0, &tf);
    }
}

/* a head: bands of flat faces between its rings, a flat top and bottom. The faces across the front wear the face picture.
   (R_HEAD_HAIR draws a cap instead: the same shape a little bigger, over the top, down the back and half down the sides,
   in one colour. It stands in for the outfit's real hair, which the ROM doesn't have yet.) */
void r_head(const float c[3], const Mat3 *m, const HeadMesh *h, const Tex *face, uint32_t color, int how) {
    static float sn[HEAD_SEGS + 1], cs[HEAD_SEGS + 1]; static int trig;
    const int R = h->rings, S = h->segs; if (R < 2 || S < 3 || S > HEAD_SEGS) return;
    if (trig != S) { trig = S; for (int k = 0; k <= S; k++) { sn[k] = sinf(k * 6.2831853f / S); cs[k] = cosf(k * 6.2831853f / S); } }
    const bool hair = how == R_HEAD_HAIR; const float bot = h->y[0], tall = h->y[R - 1] - bot;
    int hem[HEAD_SEGS + 1];   /* hair: the lowest ring it reaches at each point round the head (the fringe stops above the brows) */
    if (hair) for (int k = 0; k <= S; k++) { const int kk = k % S, off = kk * 8 > S * 4 ? S - kk : kk; const float want = off * 8 <= S ? 0.86f : off * 8 <= S * 2 ? 0.6f : 0.25f;
        float best = 9; hem[k] = R - 2; for (int r = 0; r < R - 1; r++) { float d = (h->y[r] - bot) - want * tall; if (d < 0) d = -d; if (d < best) { best = d; hem[k] = r; } } }   /* (the ring nearest that height) */
    float pw[HEAD_RINGS][HEAD_SEGS + 1][3], pv[HEAD_RINGS][HEAD_SEGS + 1][3];
    for (int r = 0; r < R; r++) {
        for (int k = 0; k < S; k++) {
            const float rad = h->r[r][k] * (hair ? (r <= hem[k] ? 1.02f : 1.1f) : 1.0f), l[3] = { sn[k] * rad, h->y[r] + (hair ? 0.05f : 0), -cs[k] * rad }; float w[3]; m3_apply(m, l, w);
            pw[r][k][0] = w[0] + c[0]; pw[r][k][1] = w[1] + c[1]; pw[r][k][2] = w[2] + c[2]; to_view(pw[r][k], pv[r][k]);
        }
        for (int i = 0; i < 3; i++) { pw[r][S][i] = pw[r][0][i]; pv[r][S][i] = pv[r][0][i]; }
    }
    float vc[3]; to_view(c, vc);
    const bool pic = face && how == R_HEAD_SKIN; const int lv = pic ? tex_level(face, vc[2]) : 0;
    const float tw = pic ? (float)(face->w >> lv) : 0, th = pic ? (float)(face->h >> lv) : 0;
    const uint16_t WHITE = rgb5551(255, 242, 242);
    float fwd[3]; { const float f0[3] = { 0, 0, -1.3f }; m3_apply(m, f0, fwd); }
    for (int r = 0; r + 1 < R; r++) for (int k = 0; k < S; k++) {
        if (hair && (r < hem[k] || r < hem[k + 1])) continue;
        const float *A = pw[r][k], *B = pw[r][k + 1], *D = pw[r + 1][k];
        const float e1[3] = { D[0] - A[0], D[1] - A[1], D[2] - A[2] }, e2[3] = { B[0] - A[0], B[1] - A[1], B[2] - A[2] };
        float n[3] = { e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0] };   /* outwards */
        if (n[0] * (C.px - A[0]) + n[1] * (C.py - A[1]) + n[2] * (C.pz - A[2]) <= 0) continue;
        const float nl = sqrtf(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]); if (nl < 1e-9f) continue; n[0] /= nl; n[1] /= nl; n[2] /= nl;
        const float *q[4] = { pv[r][k], pv[r][k + 1], pv[r + 1][k + 1], pv[r + 1][k] };
        float v[MAXV][3];
        const bool front = pic && (k * 4 < S || k * 4 >= S * 3);   /* the quarter either side of the front */
        if (!front) {
            for (int i = 0; i < 4; i++) { v[i][0] = q[i][0]; v[i][1] = q[i][1]; v[i][2] = q[i][2]; }
            emit(v, 4, how == R_HEAD_WHITE ? WHITE : r_shade(color, n[0], n[1], n[2]), GM_OPAQUE, 0, 0, 0); continue;
        }
        /* the picture runs from the right arm's side (the left of the picture) round the front to the other side */
        const float a0 = (k * 4 < S ? k : k - S) / (float)S, a1 = a0 + 1.0f / S, u[4] = { (0.5f - a0 * 2) * tw, (0.5f - a1 * 2) * tw, (0.5f - a1 * 2) * tw, (0.5f - a0 * 2) * tw }, t[4] = { h->t[r] * th, h->t[r] * th, h->t[r + 1] * th, h->t[r + 1] * th };
        /* lit as if it faced a little more to the front than it does: the face is one picture across four flat faces, and
           lit each by its own angle it would be in four shades, with a crease down the nose */
        float ln[3] = { n[0] + fwd[0], n[1] + fwd[1], n[2] + fwd[2] }; const float ll = sqrtf(ln[0] * ln[0] + ln[1] * ln[1] + ln[2] * ln[2]); if (ll > 1e-6f) { ln[0] /= ll; ln[1] /= ll; ln[2] /= ll; }
        TexFace tf; tf.tex = face->lv[lv]; tf.shift = face->wshift - lv; tf.pal = lit_palette(face, ln[0], ln[1], ln[2]);
        tf.umin = u[1] < 0 ? 0 : u[1]; tf.umax = u[0] > tw - 0.02f ? tw - 0.02f : u[0]; tf.vmin = t[2] < t[0] ? t[2] : t[0]; tf.vmax = t[2] < t[0] ? t[0] : t[2]; if (tf.vmax > th - 0.02f) tf.vmax = th - 0.02f;
        tf.flat = r_shade(color, ln[0], ln[1], ln[2]);
        /* two triangles: a band that narrows is not a slanted rectangle, and each triangle carries the picture exactly */
        for (int tri = 0; tri < 2; tri++) {
            const int i0 = 0, i1 = tri ? 2 : 1, i2 = tri ? 3 : 2;
            const float du1 = u[i1] - u[i0], du2 = u[i2] - u[i0], dv1 = t[i1] - t[i0], dv2 = t[i2] - t[i0], det = du1 * dv2 - du2 * dv1;
            for (int i = 0; i < 3; i++) { v[0][i] = q[i0][i]; v[1][i] = q[i1][i]; v[2][i] = q[i2][i]; }
            if (det > -1e-6f && det < 1e-6f) { emit(v, 3, tf.flat, GM_OPAQUE, 0, 0, 0); continue; }   /* (a band of no height in the picture) */
            float Su[3], Sv[3], O[3];
            for (int i = 0; i < 3; i++) { const float e1v = q[i1][i] - q[i0][i], e2v = q[i2][i] - q[i0][i]; Su[i] = (e1v * dv2 - e2v * dv1) / det; Sv[i] = (e2v * du1 - e1v * du2) / det; O[i] = q[i0][i] - u[i0] * Su[i] - t[i0] * Sv[i]; }
            if (!tex_plane(&tf, O, Su, Sv, 0, 1, 0, 1)) continue;
            emit(v, 3, tf.flat, GM_OPAQUE, 0, 0, &tf);
        }
    }
    /* the top and the bottom */
    for (int end = 0; end < 2; end++) {
        if (hair && !end) continue;
        const int r = end ? R - 1 : 0; float up[3] = { 0, end ? 1.0f : -1.0f, 0 }, n[3]; m3_apply(m, up, n);
        const float *A = pw[r][0]; if (n[0] * (C.px - A[0]) + n[1] * (C.py - A[1]) + n[2] * (C.pz - A[2]) <= 0) continue;
        float v[MAXV][3]; for (int k = 0; k < S; k++) { const float *s = pv[r][end ? S - 1 - k : k]; v[k][0] = s[0]; v[k][1] = s[1]; v[k][2] = s[2]; }
        emit(v, S, how == R_HEAD_WHITE ? WHITE : r_shade(color, n[0], n[1], n[2]), GM_OPAQUE, 0, 0, 0);
    }
}
