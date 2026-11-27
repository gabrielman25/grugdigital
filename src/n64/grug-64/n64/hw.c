/* Grug Baseplate 64: drawing with the console's own rasterizer (the RDP), through libdragon's rdpq.
 *
 * Same polygons as rast.c (gfx_poly: screen space, a depth per vertex), sent to the hardware as z-buffered flat
 * triangles. A real console and an accurate emulator draw these far faster than the CPU can. An emulator that only
 * imitates the common Nintendo microcodes can't run them at all, so main.c asks the hardware two questions at boot
 * (hw_probe_rsp, hw_probe_rdp) and only uses this backend when both come back right. */
#include <libdragon.h>
#include "../gfx.h"
#include "hw.h"

static surface_t zsurf, *csurf;
static int cur_mode = -1;
static uint16_t cur_color; static bool have_color;

/* ---- is the RSP really there? Run four instructions on it by hand and see if they happened.
   (An emulator with a high-level RSP looks for a known microcode instead of running the code, so nothing changes.)
   Must run before rspq_init: this drives the RSP directly. */
bool hw_probe_rsp(void) {
    for (int i = 0; i < 16; i++) SP_DMEM[0xFC0 / 4 + i] = 0;       /* no task header: nothing for a high-level RSP to recognise */
    SP_DMEM[0] = 0;
    SP_IMEM[0] = 0x34081234;                                       /* ori  t0, zero, 0x1234 */
    SP_IMEM[1] = 0xAC080000;                                       /* sw   t0, 0(zero)      */
    SP_IMEM[2] = 0x0000000D;                                       /* break                 */
    SP_IMEM[3] = 0x00000000;                                       /* nop                   */
    *SP_PC = 0;
    *SP_STATUS = SP_WSTATUS_CLEAR_HALT | SP_WSTATUS_CLEAR_BROKE | SP_WSTATUS_CLEAR_INTR | SP_WSTATUS_CLEAR_INTR_BREAK;
    uint32_t t0 = TICKS_READ();
    while (!(*SP_STATUS & SP_STATUS_HALTED) && TICKS_SINCE(t0) < TICKS_PER_SECOND / 20) {}
    *SP_STATUS = SP_WSTATUS_SET_HALT | SP_WSTATUS_CLEAR_BROKE | SP_WSTATUS_CLEAR_INTR;
    return SP_DMEM[0] == 0x1234;
}

/* ---- does the RDP really draw into memory? Fill a little surface and look at it. (Call after rdpq_init.)
   The HUD is drawn by the CPU on top of the RDP's picture, so the picture has to be in RAM, at once. */
bool hw_probe_rdp(void) {
    surface_t t = surface_alloc(FMT_RGBA16, 32, 8);
    uint16_t *px = t.buffer; for (int i = 0; i < 32 * 8; i++) px[i] = 0;
    rdpq_attach(&t, NULL);
    rdpq_set_mode_fill(RGBA32(0, 255, 0, 255));
    rdpq_fill_rectangle(0, 0, 32, 8);
    rdpq_detach();
    rspq_syncpoint_t sp = rspq_syncpoint_new(); rspq_flush();
    uint32_t t0 = TICKS_READ(); bool reached = false;
    while (TICKS_SINCE(t0) < TICKS_PER_SECOND / 4) { if (rspq_syncpoint_check(sp)) { reached = true; break; } }
    bool ok = false;
    if (reached) { t0 = TICKS_READ(); while (TICKS_SINCE(t0) < TICKS_PER_SECOND / 50) { if (px[4 * 32 + 16] != 0) { ok = true; break; } } }
    if (reached) surface_free(&t);   /* (if the RSP never got there, leave the surface alone: it may still be written) */
    return ok;
}

void hw_init(void) { zsurf = surface_alloc(FMT_RGBA16, SCREEN_W, SCREEN_H); }
void hw_set_target(surface_t *s) { csurf = s; }

static inline color_t unpack(uint16_t c) { return RGBA32(((c >> 11) & 31) << 3, ((c >> 6) & 31) << 3, ((c >> 1) & 31) << 3, 255); }

static void set_mode(int mode) {
    if (mode == cur_mode) return; cur_mode = mode; have_color = false;
    rdpq_set_mode_standard();
    rdpq_mode_combiner(RDPQ_COMBINER_FLAT);
    if (mode == GM_OPAQUE) rdpq_mode_zbuf(true, true);
    else if (mode == GM_BACK) rdpq_mode_zbuf(false, false);
    else { rdpq_mode_zbuf(true, false); rdpq_mode_blender(RDPQ_BLENDER_MULTIPLY); }   /* GM_SHADOW: three quarters of what is there */
}
static void hw_begin(Frame *f, uint16_t sky) {
    gfx_frame = f; cur_mode = -1;
    rdpq_attach(csurf, &zsurf);
    rdpq_clear(unpack(sky)); rdpq_clear_z(ZBUF_MAX);
}
static void hw_poly(const SVert *v, int n, uint16_t color, int mode) {
    set_mode(mode);
    if (mode == GM_SHADOW) { if (!have_color) { rdpq_set_prim_color(RGBA32(0, 0, 0, 64)); have_color = true; } }
    else if (!have_color || color != cur_color) { rdpq_set_prim_color(unpack(color)); cur_color = color; have_color = true; }
    /* the RDP's depth: 0 is nearest, 1 is furthest (ours is the other way up, in 16 bits) */
    float p[12][3]; if (n > 12) n = 12;
    for (int i = 0; i < n; i++) { p[i][0] = v[i].x; p[i][1] = v[i].y; float z = 1.0f - v[i].d * (1.0f / 65535.0f); p[i][2] = z < 0 ? 0 : z > 1 ? 1 : z; }
    for (int i = 1; i + 1 < n; i++) rdpq_triangle(&TRIFMT_ZBUF, p[0], p[i], p[i + 1]);
}
static void hw_end3d(void) { rdpq_detach_wait(); }   /* the picture is in memory: the CPU draws the HUD on it */

const GfxBackend gfx_hw = { "Console", hw_begin, hw_poly, hw_end3d };
