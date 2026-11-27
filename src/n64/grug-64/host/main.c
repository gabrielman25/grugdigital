/* Grug Baseplate 64 on a PC: the same game code, driven by a script, writing pictures and sound to files.
 * For checking the physics and the picture without a console:  make -C src/n64/grug-64 host && ./build/host/grug64-host OUTDIR [SLOT]
 * It writes OUTDIR/NAME.ppm for each shot, OUTDIR/audio.wav, and prints the measurements the tests check.
 * SLOT is the outfit slot to wear (assets/outfit-default.fit if not given: what the ROM carries). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "../game.h"
#include "../audio.h"
#include "../outfit.h"

static uint16_t fb[SCREEN_W * SCREEN_H], zb[SCREEN_W * SCREEN_H];
static Frame frame = { fb, zb, SCREEN_W, SCREEN_H, SCREEN_W };
static const char *outdir = ".";
static FILE *wav; static long wavBytes; static float audAcc;
static int fails;
static float camX, camY;   /* the camera stick, held by the script */

static void shot(const char *name) {
    char path[512]; snprintf(path, sizeof path, "%s/%s.ppm", outdir, name);
    game_draw(&frame);
    FILE *f = fopen(path, "wb"); if (!f) { perror(path); exit(1); }
    fprintf(f, "P6\n%d %d\n255\n", SCREEN_W, SCREEN_H);
    for (int i = 0; i < SCREEN_W * SCREEN_H; i++) { uint16_t c = fb[i]; uint8_t rgb[3] = { (uint8_t)(((c >> 11) & 31) * 255 / 31), (uint8_t)(((c >> 6) & 31) * 255 / 31), (uint8_t)(((c >> 1) & 31) * 255 / 31) }; fwrite(rgb, 1, 3, f); }
    fclose(f);
}
/* run the game for a while at 30 frames a second with this input held */
static void run(float seconds, float sx, float sy, unsigned held) {
    static unsigned prev = 0; const float dt = 1.0f / 30; int n = (int)(seconds / dt + 0.5f);
    for (int i = 0; i < n; i++) {
        Input in = { sx, sy, (uint16_t)held, (uint16_t)(held & ~prev), camX, camY }; prev = held;
        game_update(&in, dt);
        audAcc += dt * AUD_RATE; int fr = (int)audAcc; audAcc -= fr;
        static int16_t buf[4096 * 2]; if (fr > 4096) fr = 4096; aud_mix(buf, fr); fwrite(buf, 4, fr, wav); wavBytes += fr * 4;
    }
}
static void check(const char *what, float got, float lo, float hi) { bool ok = got >= lo && got <= hi; printf("  %-44s %8.3f  (want %g..%g)  %s\n", what, (double)got, (double)lo, (double)hi, ok ? "ok" : "FAIL"); if (!ok) fails++; }
static void wav_header(FILE *f, long bytes) {
    unsigned char h[44] = "RIFF"; unsigned v;
#define PUT(o, x, n) do { v = (unsigned)(x); memcpy(h + (o), &v, n); } while (0)
    PUT(4, 36 + bytes, 4); memcpy(h + 8, "WAVEfmt ", 8); PUT(16, 16, 4); PUT(20, 1, 2); PUT(22, 2, 2); PUT(24, AUD_RATE, 4); PUT(28, AUD_RATE * 4, 4); PUT(32, 4, 2); PUT(34, 16, 2); memcpy(h + 36, "data", 4); PUT(40, bytes, 4);
    fseek(f, 0, SEEK_SET); fwrite(h, 1, 44, f);
}

int main(int argc, char **argv) {
    if (argc > 1) outdir = argv[1];
    char path[512]; snprintf(path, sizeof path, "%s/audio.wav", outdir); wav = fopen(path, "wb"); if (!wav) { perror(path); return 1; } wav_header(wav, 0);
    GameDebug d;
    static uint8_t slot[SLOT_SIZE];
    { const char *sp = argc > 2 ? argv[2] : "assets/outfit-default.fit"; FILE *sf = fopen(sp, "rb"); size_t got = sf ? fread(slot, 1, SLOT_SIZE, sf) : 0; if (sf) fclose(sf);
      if (got == SLOT_SIZE) game_slot(slot, SLOT_SIZE); else printf("  (no outfit slot at %s: plain colours)\n", sp); }
    game_init(64);
    game_debug(&d); check("the slot's outfit is worn", d.outfit, 1, 1);
    run(0.6f, 0, 0, 0); shot("01-spawn");
    game_debug(&d); check("standing: root height over the spawn plate", d.y, 3.59f, 3.61f); check("standing: grounded", d.grounded, 1, 1);

    /* a standing jump: how high? (7.2 studs) */
    run(0.1f, 0, 0, BTN_A); run(0.25f, 0, 0, 0); shot("02-jump"); run(1.0f, 0, 0, 0);
    game_debug(&d); check("standing jump height (JumpHeight 7.2)", d.lastHeight, 7.15f, 7.25f);
    /* walking: 16 studs a second */
    game_teleport(-100, 3.3f, 60, 0); run(0.5f, 0, 0, 0); game_debug(&d); float z0 = d.z; run(2.0f, 0, 1, 0); game_debug(&d);
    check("walk speed, studs a second (WalkSpeed 16)", (z0 - d.z) / 2.0f, 15.5f, 16.1f); shot("03-track");
    /* a running jump: how far? (about 8.6 studs) */
    run(0.3f, 0, 1, 0); run(0.1f, 0, 1, BTN_A); run(1.0f, 0, 1, 0); game_debug(&d); check("running jump length", d.lastDist, 8.0f, 9.4f);
    /* the dodge roll: 42 studs a second for 0.3 s */
    run(0.5f, 0, 0, 0); game_debug(&d); z0 = d.z; run(0.04f, 0, 1, BTN_Z); run(0.14f, 0, 1, 0); shot("04-roll"); run(0.12f, 0, 1, 0); game_debug(&d);
    check("dodge roll distance in 0.3 s", z0 - d.z, 11.5f, 13.5f);

    /* jump heights: walk up to a block, then jump at it. Feet go 7.2 up and legs don't collide, so 9 is the last block you can get onto */
    static const struct { int h; float want; } BLOCKS[] = { { 7, 10 }, { 9, 12 }, { 10, 3 } };
    for (int i = 0; i < 3; i++) {
        game_teleport(-49.5f + (BLOCKS[i].h - 1) * 11, 3.3f, -30, 0); run(0.4f, 0, 0, 0); if (i == 0) shot("05-jump-heights"); run(0.6f, 0, 1, 0); run(0.7f, 0, 1, BTN_A); run(0.8f, 0, 0, 0); game_debug(&d);
        char what[64]; snprintf(what, sizeof what, "jumping at the %d stud block (root y)", BLOCKS[i].h); check(what, d.y, BLOCKS[i].want - 0.1f, BLOCKS[i].want + 0.1f);
    }
    /* gap jumps: a running jump crosses the 7 stud gap; the 13 stud gap needs a roll in the air */
    game_teleport(-66 + 28 - 2.5f, 7.3f, -74, -1.5708f); run(0.3f, 0, 0, 0); shot("06-gap-jumps");
    run(0.26f, 0, 1, 0); run(0.1f, 0, 1, BTN_A); run(0.5f, 0, 1, 0); run(0.5f, 0, 0, 0); game_debug(&d); check("a running jump crosses the 7 stud gap (root y)", d.y, 6.9f, 7.1f);
    game_teleport(-66 + 84 - 2.5f, 7.3f, -74, -1.5708f); run(0.3f, 0, 0, 0);
    run(0.26f, 0, 1, 0); run(0.1f, 0, 1, BTN_A); run(0.6f, 0, 1, 0); run(0.5f, 0, 0, 0); game_debug(&d); check("a running jump falls short of the 13 stud gap (root y)", d.y, 2.9f, 3.1f);
    game_teleport(-66 + 84 - 2.5f, 7.3f, -74, -1.5708f); run(0.3f, 0, 0, 0);
    run(0.26f, 0, 1, 0); run(0.1f, 0, 1, BTN_A); run(0.1f, 0, 1, 0); run(0.05f, 0, 1, BTN_Z); run(0.45f, 0, 1, 0); run(0.5f, 0, 0, 0); game_debug(&d); check("...but a roll in the air crosses it (root y)", d.y, 6.9f, 7.1f);

    /* danger: the damage pad takes a square a second; the kill brick breaks you apart; you respawn with full health */
    game_teleport(-58, 3.3f, 26, 0); run(2.6f, 0, 0, 0); shot("07-damage-pad"); game_debug(&d); check("health after 2.6 s on the damage pad (of 5)", d.hp, 2, 2);
    game_teleport(-45.5f, 3.3f, 26, -1.5708f); run(0.2f, 0, 0, 0); run(0.4f, 0, 1, 0); game_debug(&d); check("the kill brick kills", d.dead, 1, 1); shot("08-fell-apart");
    run(3.2f, 0, 0, 0); game_debug(&d); check("respawned", d.dead, 0, 0); check("full health again", d.hp, 5, 5);

    /* the obby: the red floor kills */
    game_teleport(-46, 5.3f, -108, -1.5708f); run(0.5f, 0, 0, 0); shot("09-obby"); run(1.0f, 0, 1, 0); game_debug(&d); check("the obby floor kills", d.dead, 1, 1); run(3.3f, 0, 0, 0);

    /* the dummy: three swings break it */
    game_teleport(27, 3.3f, -6, -1.5708f); run(0.3f, 0, 0, 0); run(0.2f, 1, 0, 0); run(0.2f, 0, 0, 0);
    run(0.1f, 0, 0, BTN_B); run(0.1f, 0, 0, 0); shot("10-swing"); run(0.5f, 0, 0, 0); run(0.1f, 0, 0, BTN_B); run(0.6f, 0, 0, 0); run(0.1f, 0, 0, BTN_B); run(0.3f, 0, 0, 0); shot("11-dummy-broken"); run(1.5f, 0, 0, 0);

    /* the sky deck: a jump pad throws you about 37 studs up; the lift; the truss */
    game_teleport(84, 3.3f, 44, 3.14159f); run(0.3f, 0, 0, 0); shot("12-sky-deck"); run(0.6f, 0, -1, 0);
    float top = 0; for (int i = 0; i < 40; i++) { run(0.05f, 0, 0, 0); game_debug(&d); if (d.y > top) top = d.y; if (i == 12) shot("13-jump-pad"); }
    check("jump pad: how high the feet go (about 37)", top - 3, 35.5f, 38.5f);
    game_teleport(84 + 18.5f, 3.3f, 70, 1.5708f); run(0.3f, 0, 0, 0); run(1.2f, 0, 1, 0); shot("14-truss"); run(1.6f, 0, 1, 0); game_debug(&d);
    check("climbing the truss (root y, at the top)", d.y, 32.9f, 33.1f);
    run(0.1f, 0, 1, BTN_A); run(1.0f, 0, 1, 0); game_debug(&d); check("jumped off the truss onto the deck (root y)", d.y, 32.9f, 33.1f); shot("15-on-the-deck");
    /* off the edge of the world */
    game_teleport(0, 3.3f, 124, 3.14159f); run(0.3f, 0, 0, 0); run(1.0f, 0, 1, 0); shot("16-off-the-edge"); run(1.2f, 0, 1, 0); game_debug(&d); check("fell off the edge: dead", d.dead, 1, 1); run(3.2f, 0, 0, 0);
    /* the Game Menu */
    run(0.1f, 0, 0, BTN_START); run(0.2f, 0, 0, 0); shot("17-game-menu"); run(0.1f, 0, -1, 0); run(0.2f, 0, 0, 0); run(0.1f, 0, -1, 0); run(0.2f, 0, 0, 0); run(0.1f, 0, 0, BTN_A); run(0.3f, 0, 0, 0);
    run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); game_debug(&d); check("START closes the menu", d.menu, 0, 0);
    /* the camera stick: right over for half a second turns the camera 3 radians (6 a second) */
    game_debug(&d); float yaw0 = d.camYaw; camX = 1; run(0.5f, 0, 0, 0); camX = 0; game_debug(&d); check("camera stick: radians turned in half a second", yaw0 - d.camYaw, 2.9f, 3.1f);
    game_kbd = true; run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); shot("17b-menu-keyboard"); run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); game_kbd = false;
    /* first person */
    for (int i = 0; i < 30; i++) { run(0.04f, 0, 0, BTN_R); run(0.04f, 0, 0, 0); } run(0.5f, 0, 0, 0); shot("18-first-person");

    /* the outfit, close up: front, back, each side, from above, and falling apart */
    game_init(64); game_hide_hud = true;
    game_teleport(0, 3.6f, 20, 0); run(0.4f, 0, 0, 0);
    game_camera(3.14159f, 0.12f, 7); run(0.2f, 0, 0, 0); shot("20-outfit-front");
    game_camera(0, 0.12f, 7); run(0.2f, 0, 0, 0); shot("21-outfit-back");
    game_camera(1.5708f + 0.5f, 0.25f, 7); run(0.2f, 0, 0, 0); shot("22-outfit-side");
    game_camera(3.14159f - 0.6f, 0.6f, 5); run(0.2f, 0, 0, 0); shot("23-outfit-above");
    game_camera(3.14159f + 0.5f, 0.05f, 3.2f); run(0.2f, 0, 0, 0); shot("24-outfit-face");
    game_camera(3.14159f - 0.4f, 0.2f, 16); run(0.1f, 0, 0, 0); run(0.5f, 0.3f, -1, 0); shot("25-outfit-walking");
    game_hide_hud = false;
    /* the stress test: 1000 bricks, from the spawn and from above; you can stand on one */
    game_stress(1000); run(0.5f, 0, 0, 0); game_debug(&d); check("stress test: parts in the world", d.parts, 1003, 1003); shot("30-stress-1000");
    game_camera(0, 1.1f, 90); run(0.3f, 0, 0, 0); shot("31-stress-1000-above");
    game_stress(4000); run(0.5f, 0, 0, 0); game_debug(&d); check("stress test: 4000 bricks", d.parts, 4003, 4003); game_camera(0.6f, 0.5f, 60); run(0.3f, 0, 0, 0); shot("32-stress-4000");
    game_teleport(20, 40, 4, 0); run(2.0f, 0, 0, 0); game_debug(&d); check("stress test: landed on a brick, not through it (root y)", d.y, 3.9f, 40); check("stress test: standing", d.grounded, 1, 1);
    game_stress(0); run(0.3f, 0, 0, 0); game_debug(&d); check("back to the zoo", d.stress, 0, 0);

    /* the Arcade's cover picture: Grug mid-jump in front of the jump heights, no HUD (tools/mkcover.py crops and enlarges it) */
    game_init(64); game_hide_hud = true;
    game_teleport(-8, 3.3f, -29, 0); game_camera(-0.55f, 0.1f, 10.5f); run(0.5f, 0, 0, 0); run(0.45f, -0.2f, -1, 0); run(0.1f, -0.2f, -1, BTN_A); run(0.17f, -0.2f, -1, 0); shot("cover");
    game_hide_hud = false;

    wav_header(wav, wavBytes); fclose(wav);
    printf("%s\n", fails ? "SOME CHECKS FAILED" : "all checks passed");
    return fails ? 1 : 0;
}
