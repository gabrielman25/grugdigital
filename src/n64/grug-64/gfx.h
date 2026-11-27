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
       GM_BACK,         /* no z at all */
       GM_BASE };       /* z-written without a test: the baseplate's top, the first thing drawn */

/* depth = DEPTH_SCALE * NEAR / viewZ + DEPTH_BIAS, kept inside 16 bits with room either side for rounding */
#define DEPTH_SCALE 64000.0f
#define DEPTH_BIAS  512.0f

/* a studded top: a level face at height y, drawn with the stud pattern. (ox, oz) is the corner the studs are counted
   from, (su, sv) how many stud tiles there are to a world unit each way (about half: one stud every 2 studs). */
typedef struct StudFace { uint16_t pal[5]; float y, ox, oz, su, sv; } StudFace;   /* pal: the face's colour, its lit edge, its shaded edge, and a softer lit and shaded for studs further off */

/* a picture a part wears: 256 colours, and smaller copies of itself for when it is further off (each half the one before).
   Rows are a power of two wide, so a texel is lv[level][(v << (wshift - level)) + u]. */
#define TEX_LEVELS 4
#define TEX_MAX 4                                 /* how many pictures can be in use (each keeps its lit palettes: see render.c) */
typedef struct Tex {
    const uint8_t *lv[TEX_LEVELS]; int nlv, wshift, w, h;
    float density;                                /* texels to a stud at level 0: picks the level */
    uint16_t pal[256]; int id;                    /* id: 0..TEX_MAX-1 */
} Tex;
typedef struct TexRect { uint8_t x, y, w, h; } TexRect;   /* a face's part of the picture, in level 0 texels */

/* a textured polygon for the backend. Across the screen, u = (ua x + ub y + uc) / (wa x + wb y + wc) and the same for v
   (x, y: the pixel's column and row), which is exact for a flat face seen in perspective. u and v are in texels of `tex`
   and stay inside [umin, umax] x [vmin, vmax]. */
typedef struct TexFace {
    const uint8_t *tex; const uint16_t *pal; int shift;       /* texel = pal[tex[(v << shift) + u]] */
    float ua, ub, uc, va, vb, vc, wa, wb, wc, umin, umax, vmin, vmax;
    uint16_t flat;                                            /* one colour for the whole face: what a backend with no textures draws */
} TexFace;

/* a head: rings of points round an upright axis, measured from the studio's own head shape (arcade/grug-64/outfit64.js) */
#define HEAD_RINGS 8
#define HEAD_SEGS 16
typedef struct HeadMesh { int rings, segs; float y[HEAD_RINGS], t[HEAD_RINGS], r[HEAD_RINGS][HEAD_SEGS]; } HeadMesh;   /* y: from the head's middle; t: the face picture's row there, 0..1; r: how far out, from the front round towards +x */

typedef struct Frame {
    uint16_t *fb;            /* RGBA 5551, what the VI shows */
    uint16_t *zb;            /* software depth buffer (unused by the hardware backend) */
    int w, h, stride;        /* stride in pixels */
} Frame;

typedef struct GfxBackend {
    const char *name;
    void (*begin)(Frame *f, uint16_t sky, uint16_t ground, int horizon);   /* clear depth; sky above the horizon line, far ground below */
    void (*poly)(const SVert *v, int n, uint16_t color, int mode);
    void (*studs)(const SVert *v, int n, const StudFace *sf, int mode);    /* a studded top (mode: GM_OPAQUE or GM_BACK) */
    void (*tex)(const SVert *v, int n, const TexFace *tf);                 /* a textured face (z-tested, z-written) */
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
void  r_box(float minX, float minY, float minZ, float maxX, float maxY, float maxZ, uint32_t color, int top);   /* top: R_TOP_* */
enum { R_TOP_PLAIN = 0, R_TOP_NONE, R_TOP_STUDS };
void  r_top(float minX, float minZ, float maxX, float maxZ, float y, uint32_t color, int mode);   /* a studded top on its own (the baseplate's checks) */
bool  r_row(float planeY, int sy, float *x0, float *z0, float *dx, float *dz);   /* where screen row sy meets a level plane: world x, z at the first pixel, and the step per pixel */
void  r_obox(const float c[3], const Mat3 *m, float hx, float hy, float hz, uint32_t color, bool white);
void  r_obox_tex(const float c[3], const Mat3 *m, float hx, float hy, float hz, const Tex *t, const TexRect face[6]);   /* the same box wearing a picture: face[] in the order +x -x +y -y +z -z */
enum { R_HEAD_SKIN = 0, R_HEAD_WHITE, R_HEAD_HAIR };
void  r_head(const float c[3], const Mat3 *m, const HeadMesh *h, const Tex *face, uint32_t color, int how);   /* a head; how: R_HEAD_* (HAIR: a cap of `color` over the top and back) */
void  r_tex_reset(void);                             /* the pictures changed: forget their lit palettes */
void  r_quad(const float p[4][3], uint16_t color, int mode, float bias);     /* any world-space convex quad */
void  r_ngon_flat(float cx, float y, float cz, float radius, int sides, uint16_t color, int mode);
bool  r_project(float x, float y, float z, int *sx, int *sy, float *dist);   /* a world point on the screen */
int   r_horizon(void);                               /* the screen line where the far ground meets the sky */
uint16_t r_shade(uint32_t color, float nx, float ny, float nz);
extern bool r_studs;                                 /* draw studs on studded tops (the Game Menu can turn them off) */
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
