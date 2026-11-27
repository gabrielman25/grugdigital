/* Grug 64: drawing.
 *
 *   render.c  the 3D pipeline (camera, lighting, clipping, projection). It ends in gfx_poly(): flat-coloured convex
 *             polygons in screen space with a depth per vertex. Portable C.
 *   rast.c    gfx_poly() in software: a z-buffered span filler straight into the 16-bit framebuffer. This is what an
 *             emulator without low-level RSP/RDP emulation sees, and what the host test harness uses.
 *   n64/      gfx_poly() on the console's own rasterizer (the RDP), picked at boot when the hardware answers.
 *   ui.c      2D: boxes and outlined text, always drawn by the CPU on top of the finished 3D picture.
 */
#ifndef GRUG64_GFX_H
#define GRUG64_GFX_H

#include <stdint.h>
#include <stdbool.h>

#define SCREEN_W 320
#define SCREEN_H 240

typedef struct { float x, y, d; } SVert;          /* screen pixels; d: depth, bigger is nearer (DEPTH_* below) */

enum { GM_OPAQUE = 0,   /* z-tested, z-written */
       GM_SHADOW,       /* z-tested, darkens what is there (blob shadows) */
       GM_BACK };       /* no z at all: the far ground, drawn first */

/* depth = DEPTH_SCALE * NEAR / viewZ + DEPTH_BIAS, kept inside 16 bits with room either side for rounding */
#define DEPTH_SCALE 64000.0f
#define DEPTH_BIAS  512.0f

typedef struct Frame {
    uint16_t *fb;            /* RGBA 5551, what the VI shows */
    uint16_t *zb;            /* software depth buffer (unused by the hardware backend) */
    int w, h, stride;        /* stride in pixels */
} Frame;

typedef struct GfxBackend {
    const char *name;
    void (*begin)(Frame *f, uint16_t sky);                       /* clear colour and depth */
    void (*poly)(const SVert *v, int n, uint16_t color, int mode);
    void (*end3d)(void);                                         /* the 3D picture is finished: the CPU may draw on fb */
} GfxBackend;

extern const GfxBackend *gfx;        /* the backend in use */
extern const GfxBackend gfx_soft;    /* rast.c */
extern Frame *gfx_frame;             /* the frame being drawn */

static inline uint16_t rgb5551(int r, int g, int b) { return (uint16_t)(((r >> 3) << 11) | ((g >> 3) << 6) | ((b >> 3) << 1) | 1); }
static inline uint16_t hex5551(uint32_t c) { return rgb5551((c >> 16) & 255, (c >> 8) & 255, c & 255); }

/* ---------------------------------------------------------------- render.c: the 3D pipeline */
typedef struct { float m[9]; } Mat3;                 /* row-major: v' = M v */
void  m3_identity(Mat3 *m);
void  m3_rot_x(Mat3 *m, float a);
void  m3_rot_y(Mat3 *m, float a);
void  m3_axis_angle(Mat3 *m, float ax, float ay, float az, float a);
void  m3_euler(Mat3 *m, float rx, float ry, float rz);
void  m3_mul(Mat3 *out, const Mat3 *a, const Mat3 *b);
void  m3_apply(const Mat3 *m, const float v[3], float out[3]);

void  r_camera(float px, float py, float pz, float tx, float ty, float tz, float fovYdeg);
void  r_box(float minX, float minY, float minZ, float maxX, float maxY, float maxZ, uint32_t color, int skipTop);
void  r_obox(const float c[3], const Mat3 *m, float hx, float hy, float hz, uint32_t color, bool white);
void  r_quad(const float p[4][3], uint16_t color, int mode, float bias);     /* any world-space convex quad */
void  r_ngon_flat(float cx, float y, float cz, float radius, int sides, uint16_t color, int mode);
bool  r_project(float x, float y, float z, int *sx, int *sy, float *dist);   /* a world point on the screen */
uint16_t r_shade(uint32_t color, float nx, float ny, float nz);
extern int r_polys;                                  /* polygons sent to the backend this frame */

/* ---------------------------------------------------------------- ui.c: 2D on the finished picture */
#define UI_CENTER  1
#define UI_RIGHT   2
#define UI_X2      4      /* double size */
#define UI_NOLINE  8      /* no black outline */
void  ui_rect(int x, int y, int w, int h, uint16_t color);
void  ui_dim(int x, int y, int w, int h);                 /* the classic panel: black at 45% */
void  ui_frame(int x, int y, int w, int h, uint16_t color, int t);
int   ui_text_w(const char *s, int flags);
void  ui_text(int x, int y, const char *s, uint16_t color, int flags);
int   ui_font_h(void);

#endif
