/* Grug 64: 2D on the finished picture. The classic GUI in miniature: black panels at 45%, flat pure colours,
 * white text with a black outline. Always drawn by the CPU, whichever backend drew the 3D. */
#include <stdint.h>
#include "gfx.h"
#include "font.h"

static inline bool clip(int *x, int *y, int *w, int *h) {
    Frame *f = gfx_frame;
    if (*x < 0) { *w += *x; *x = 0; } if (*y < 0) { *h += *y; *y = 0; }
    if (*x + *w > f->w) *w = f->w - *x; if (*y + *h > f->h) *h = f->h - *y;
    return *w > 0 && *h > 0;
}
void ui_rect(int x, int y, int w, int h, uint16_t color) {
    if (!clip(&x, &y, &w, &h)) return;
    for (int j = 0; j < h; j++) { uint16_t *p = gfx_frame->fb + (y + j) * gfx_frame->stride + x; for (int i = 0; i < w; i++) p[i] = color; }
}
void ui_dim(int x, int y, int w, int h) {   /* black at about 45%: half of what is there, plus a sixteenth. Two pixels at a time. */
    if (!clip(&x, &y, &w, &h)) return;
    for (int j = 0; j < h; j++) {
        uint16_t *p = gfx_frame->fb + (y + j) * gfx_frame->stride + x; int n = w;
        if ((uintptr_t)p & 2) { const uint16_t c = *p; *p++ = (uint16_t)((((c & 0xF7BD) >> 1) + ((c & 0x8420) >> 4)) | 1); n--; }
        uint32_t *q = (uint32_t *)(void *)p;
        for (; n >= 2; n -= 2, q++) { const uint32_t c = *q; *q = (((c & 0xF7BCF7BCu) >> 1) + ((c & 0x84208420u) >> 4)) | 0x00010001u;   /* (0xF7BC: each pixel's lowest bit must not slide into its neighbour) */ }
        if (n) { p = (uint16_t *)(void *)q; const uint16_t c = *p; *p = (uint16_t)((((c & 0xF7BD) >> 1) + ((c & 0x8420) >> 4)) | 1); }
    }
}
void ui_frame(int x, int y, int w, int h, uint16_t color, int t) {
    ui_rect(x, y, w, t, color); ui_rect(x, y + h - t, w, t, color); ui_rect(x, y, t, h, color); ui_rect(x + w - t, y, t, h, color);
}
int ui_font_h(void) { return FONT_ROWS; }
int ui_text_w(const char *s, int flags) {
    int w = 0; for (; *s; s++) { unsigned c = (unsigned char)*s; if (c < FONT_FIRST || c >= FONT_FIRST + FONT_COUNT) c = '?'; w += FONT[c - FONT_FIRST].adv; }
    return (flags & UI_X2) ? w * 2 : w;
}
void ui_text(int x, int y, const char *s, uint16_t color, int flags) {
    Frame *f = gfx_frame; const int sc = (flags & UI_X2) ? 2 : 1; const uint16_t black = 1;
    if (flags & UI_CENTER) x -= ui_text_w(s, flags) / 2; else if (flags & UI_RIGHT) x -= ui_text_w(s, flags);
    for (; *s; s++) {
        unsigned c = (unsigned char)*s; if (c < FONT_FIRST || c >= FONT_FIRST + FONT_COUNT) c = '?';
        const Glyph *g = &FONT[c - FONT_FIRST];
        if (sc == 1 && x >= 1 && x + 16 < f->w && y >= 0 && y + FONT_ROWS <= f->h) {
            /* the usual case, wholly on screen: no checks per pixel, and only as far as each row has ink */
            uint16_t *row = f->fb + y * f->stride + x - 1;
            for (int r = 0; r < FONT_ROWS; r++, row += f->stride) {
                uint32_t fm = g->fill[r], rm = (flags & UI_NOLINE) ? 0 : g->ring[r]; uint16_t *p = row;
                for (; fm | rm; fm = (fm << 1) & 0xffff, rm = (rm << 1) & 0xffff, p++) { if (fm & 0x8000) *p = color; else if (rm & 0x8000) *p = black; }
            }
        } else for (int r = 0; r < FONT_ROWS; r++) {
            uint16_t fm = g->fill[r], rm = (flags & UI_NOLINE) ? 0 : g->ring[r]; if (!(fm | rm)) continue;
            for (int sy = 0; sy < sc; sy++) {
                int py = y + r * sc + sy; if (py < 0 || py >= f->h) continue;
                uint16_t *row = f->fb + py * f->stride;
                int b = 0;
                for (uint16_t m = fm | rm; m; m = (uint16_t)(m << 1), b++) {
                    if (!(m & 0x8000)) continue;
                    const uint16_t col = (fm & (0x8000 >> b)) ? color : black;
                    for (int sx = 0; sx < sc; sx++) { int px = x + (b - 1) * sc + sx; if (px >= 0 && px < f->w) row[px] = col; }
                }
            }
        }
        x += g->adv * sc;
    }
}
