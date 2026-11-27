/* A Grug 64 game on a PC: the same game code as the ROM, driven by a script, writing pictures and sound to files and
 * checking what the script checks. A game's host/main.c includes this and is just its script:
 *
 *     #include "harness.h"
 *     int main(int argc, char **argv) {
 *         harness_begin(argc, argv);          // OUTDIR [SLOT]: where the shots go, and the outfit slot to wear
 *         game_init(64);
 *         run(0.6f, 0, 0, 0); shot("01-spawn");                      // play 0.6 s with nothing held, then a picture
 *         run(0.1f, 0, 0, BTN_A); run(1.2f, 0, 0, 0);                // a jump
 *         GameDebug d; game_debug(&d); check("jump height", d.lastHeight, 7.15f, 7.25f);
 *         harness_areas();                    // every area: inside the part limit? (prints each against the goal)
 *         return harness_end();
 *     }
 *
 * make check builds and runs it. Shots are OUTDIR/NAME.ppm (320 x 240); the sound is OUTDIR/audio.wav. */
#ifndef GRUG64_HARNESS_H
#define GRUG64_HARNESS_H
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "game.h"
#include "audio.h"
#include "outfit.h"

static uint16_t h_fb[SCREEN_W * SCREEN_H], h_zb[SCREEN_W * SCREEN_H];
static Frame h_frame = { h_fb, h_zb, SCREEN_W, SCREEN_H, SCREEN_W };
static const char *h_out = ".";
static FILE *h_wav; static long h_wavBytes; static float h_audAcc;
static int h_fails;
static float camX, camY;   /* the camera stick, held by the script */

/* a picture of the game as it is now */
static void shot(const char *name) {
    char path[512]; snprintf(path, sizeof path, "%s/%s.ppm", h_out, name);
    game_draw(&h_frame);
    FILE *f = fopen(path, "wb"); if (!f) { perror(path); exit(1); }
    fprintf(f, "P6\n%d %d\n255\n", SCREEN_W, SCREEN_H);
    for (int i = 0; i < SCREEN_W * SCREEN_H; i++) { uint16_t c = h_fb[i]; uint8_t rgb[3] = { (uint8_t)(((c >> 11) & 31) * 255 / 31), (uint8_t)(((c >> 6) & 31) * 255 / 31), (uint8_t)(((c >> 1) & 31) * 255 / 31) }; fwrite(rgb, 1, 3, f); }
    fclose(f);
}
/* play for a while at 30 frames a second with this held: the stick (-1..1, up is +y) and BTN_* buttons */
static void run(float seconds, float sx, float sy, unsigned held) {
    static unsigned prev = 0; const float dt = 1.0f / 30; int n = (int)(seconds / dt + 0.5f);
    for (int i = 0; i < n; i++) {
        Input in = { sx, sy, (uint16_t)held, (uint16_t)(held & ~prev), camX, camY }; prev = held;
        game_update(&in, dt);
        h_audAcc += dt * AUD_RATE; int fr = (int)h_audAcc; h_audAcc -= fr;
        static int16_t buf[4096 * 2]; if (fr > 4096) fr = 4096; aud_mix(buf, fr); if (h_wav) { fwrite(buf, 4, fr, h_wav); h_wavBytes += fr * 4; }
    }
}
/* a number the game should give */
static void check(const char *what, float got, float lo, float hi) { bool ok = got >= lo && got <= hi; printf("  %-52s %8.3f  (want %g..%g)  %s\n", what, (double)got, (double)lo, (double)hi, ok ? "ok" : "FAIL"); if (!ok) h_fails++; }
static void h_wav_header(FILE *f, long bytes) {
    unsigned char h[44] = "RIFF"; unsigned v;
#define PUT(o, x, n) do { v = (unsigned)(x); memcpy(h + (o), &v, n); } while (0)
    PUT(4, 36 + bytes, 4); memcpy(h + 8, "WAVEfmt ", 8); PUT(16, 16, 4); PUT(20, 1, 2); PUT(22, 2, 2); PUT(24, AUD_RATE, 4); PUT(28, AUD_RATE * 4, 4); PUT(32, 4, 2); PUT(34, 16, 2); memcpy(h + 36, "data", 4); PUT(40, bytes, 4);
#undef PUT
    fseek(f, 0, SEEK_SET); fwrite(h, 1, 44, f);
}
/* every area of the game: built, and inside the part limit? Over the goal is allowed (it says so); parts left out is a failure. */
static void harness_areas(void) {
    GameDebug d;
    for (int a = 0; a < game_areas(); a++) {
        game_area(a); run(0.2f, 0, 0, 0); game_debug(&d);
        char what[96]; snprintf(what, sizeof what, "area %d (%s): parts, of %d at most", a, game_area_name(a), PART_LIMIT); check(what, (float)d.parts, 1, PART_LIMIT);
        snprintf(what, sizeof what, "area %d (%s): parts left out", a, game_area_name(a)); check(what, (float)d.over, 0, 0);
        if (d.parts > PART_GOAL) printf("  NOTE: area %d (%s) has %d parts, %d over the goal of %d. Fine if something in it needs them: say what in the game's README.\n", a, game_area_name(a), d.parts, d.parts - PART_GOAL, PART_GOAL);
    }
    game_area(0); run(0.2f, 0, 0, 0);
}
static void harness_begin(int argc, char **argv) {
    static uint8_t slot[SLOT_SIZE];
    if (argc > 1) h_out = argv[1];
    char path[512]; snprintf(path, sizeof path, "%s/audio.wav", h_out); h_wav = fopen(path, "wb"); if (!h_wav) { perror(path); exit(1); } h_wav_header(h_wav, 0);
    const char *sp = argc > 2 ? argv[2] : "../kit/assets/outfit-default.fit"; FILE *sf = fopen(sp, "rb"); size_t got = sf ? fread(slot, 1, SLOT_SIZE, sf) : 0; if (sf) fclose(sf);
    if (got == SLOT_SIZE) game_slot(slot, SLOT_SIZE); else printf("  (no outfit slot at %s: plain colours)\n", sp);
}
static int harness_end(void) {
    h_wav_header(h_wav, h_wavBytes); fclose(h_wav);
    printf("%s\n", h_fails ? "SOME CHECKS FAILED" : "all checks passed");
    return h_fails ? 1 : 0;
}
#endif
