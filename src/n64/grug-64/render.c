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
#define MAXV 12
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
static void emit(float v[][3], int n, uint16_t color, int mode, float bias, const StudFace *sf) {
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
    if (sf) gfx->studs(s, n, sf, mode); else gfx->poly(s, n, color, mode);
}

void r_quad(const float p[4][3], uint16_t color, int mode, float bias) {
    float v[MAXV][3];
    for (int i = 0; i < 4; i++) to_view(p[i], v[i]);
    emit(v, 4, color, mode, bias, 0);
}

void r_ngon_flat(float cx, float y, float cz, float radius, int sides, uint16_t color, int mode) {
    float v[MAXV][3]; if (sides > MAXV - 4) sides = MAXV - 4;
    for (int i = 0; i < sides; i++) { float a = i * 6.2831853f / sides, w[3] = { cx + cosf(a) * radius, y, cz + sinf(a) * radius }; to_view(w, v[i]); }
    emit(v, sides, color, mode, 24, 0);
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
    int cr = (color >> 16) & 255, cg = (color >> 8) & 255, cb = color & 255;
#define TONE(k) ((uint32_t)((cr * (k) / 100 > 255 ? 255 : cr * (k) / 100) << 16 | (cg * (k) / 100 > 255 ? 255 : cg * (k) / 100) << 8 | (cb * (k) / 100 > 255 ? 255 : cb * (k) / 100)))
    sf->pal[0] = r_shade(color, 0, 1, 0); sf->pal[1] = r_shade(TONE(118), 0, 1, 0); sf->pal[2] = r_shade(TONE(74), 0, 1, 0);
    sf->pal[3] = r_shade(TONE(107), 0, 1, 0); sf->pal[4] = r_shade(TONE(88), 0, 1, 0);
#undef TONE
    sf->y = y; sf->ox = minX; sf->oz = minZ; sf->su = nu / sx; sf->sv = nv / sz;
    return true;
}
void r_top(float minX, float minZ, float maxX, float maxZ, float y, uint32_t color, int mode) {
    const float p[4][3] = { { minX, y, minZ }, { maxX, y, minZ }, { maxX, y, maxZ }, { minX, y, maxZ } };
    float v[MAXV][3]; for (int i = 0; i < 4; i++) to_view(p[i], v[i]);
    StudFace sf;
    if (stud_face(&sf, minX, minZ, maxX, maxZ, y, color)) emit(v, 4, sf.pal[0], mode, 0, &sf); else emit(v, 4, r_shade(color, 0, 1, 0), mode, 0, 0);
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

void r_box(float minX, float minY, float minZ, float maxX, float maxY, float maxZ, uint32_t color, int top) {
    /* which faces can the camera see? */
    int vis = 0;
    if (C.px > maxX) vis |= 1; if (C.px < minX) vis |= 2; if (C.py > maxY && top != R_TOP_NONE) vis |= 4; if (C.py < minY) vis |= 8; if (C.pz > maxZ) vis |= 16; if (C.pz < minZ) vis |= 32;
    if (!vis) return;
    /* the whole box against the view volume (its bounding sphere) */
    { float c[3] = { (minX + maxX) * 0.5f, (minY + maxY) * 0.5f, (minZ + maxZ) * 0.5f }, v[3]; to_view(c, v);
      float hx = (maxX - minX) * 0.5f, hy = (maxY - minY) * 0.5f, hz = (maxZ - minZ) * 0.5f, r = sqrtf(hx * hx + hy * hy + hz * hz);
      if (v[2] < -r || v[0] - v[2] * C.tanH > r * C.sH || -v[0] - v[2] * C.tanH > r * C.sH || v[1] - v[2] * C.tanV > r * C.sV || -v[1] - v[2] * C.tanV > r * C.sV) return; }
    float cv[8][3];
    for (int i = 0; i < 8; i++) { float w[3] = { (i & 1) ? maxX : minX, (i & 2) ? maxY : minY, (i & 4) ? maxZ : minZ }; to_view(w, cv[i]); }
    for (int f = 0; f < 6; f++) {
        if (!(vis & (1 << f))) continue;
        float v[MAXV][3];
        for (int k = 0; k < 4; k++) { const float *s = cv[FACE[f][k]]; v[k][0] = s[0]; v[k][1] = s[1]; v[k][2] = s[2]; }
        StudFace sf;
        if (f == 2 && top == R_TOP_STUDS && stud_face(&sf, minX, minZ, maxX, maxZ, maxY, color)) emit(v, 4, sf.pal[0], GM_OPAQUE, 0, &sf);
        else emit(v, 4, r_shade(color, FN[f][0], FN[f][1], FN[f][2]), GM_OPAQUE, 0, 0);
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
        emit(v, 4, white ? rgb5551(255, 242, 242) : r_shade(color, n[0], n[1], n[2]), GM_OPAQUE, 0, 0);
    }
}
