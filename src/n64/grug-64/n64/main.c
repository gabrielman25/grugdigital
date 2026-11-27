/* Grug Baseplate 64 on the console (libdragon): the picture, the controller, the sound, the clock.
 * The game itself is game.c; nothing in there knows it is on an N64.
 *
 * One ROM has to play in two very different places:
 *   - a real console (or an accurate emulator), where the RDP draws: fast.
 *   - a browser emulator, which usually only imitates the standard Nintendo microcodes and can't run libdragon's:
 *     there the CPU draws everything itself (rast.c) and mixes the sound itself (audio.c), which works anywhere.
 * So at boot the ROM tests the hardware (n64/hw.c) and picks. The Game Menu can switch when both work. */
#include <libdragon.h>
#include "../game.h"
#include "../audio.h"
#include "hw.h"

static uint16_t zb[SCREEN_W * SCREEN_H];

static void audio_fill(short *buffer, size_t numsamples) { aud_mix(buffer, (int)numsamples); }
static uint32_t clock_us(void) { return (uint32_t)get_ticks_us(); }

static void read_input(Input *in) {
    joypad_poll();
    joypad_inputs_t j = joypad_get_inputs(JOYPAD_PORT_1);
    joypad_buttons_t h = joypad_get_buttons(JOYPAD_PORT_1), p = joypad_get_buttons_pressed(JOYPAD_PORT_1);
    /* a real stick reaches about +-80 at the gate, a little less on the diagonals */
    float sx = j.stick_x / 72.0f, sy = j.stick_y / 72.0f;
    in->sx = sx > 1 ? 1 : sx < -1 ? -1 : sx; in->sy = sy > 1 ? 1 : sy < -1 ? -1 : sy;
#define MAP(J) ((J.a ? BTN_A : 0) | (J.b ? BTN_B : 0) | (J.z ? BTN_Z : 0) | (J.start ? BTN_START : 0) | (J.c_left ? BTN_CL : 0) | (J.c_right ? BTN_CR : 0) | (J.c_up ? BTN_CU : 0) | (J.c_down ? BTN_CD : 0) | \
                (J.l ? BTN_L : 0) | (J.r ? BTN_R : 0) | (J.d_up ? BTN_DU : 0) | (J.d_down ? BTN_DD : 0) | (J.d_left ? BTN_DL : 0) | (J.d_right ? BTN_DR : 0))
    in->held = MAP(h); in->pressed = MAP(p);
#undef MAP
}

int main(void) {
    display_init(RESOLUTION_320x240, DEPTH_16_BPP, 3, GAMMA_NONE, FILTERS_RESAMPLE);
    timer_init();
    joypad_init();

    /* Which way to draw? Hold Z while the console starts to stay in software and never touch the RSP or RDP: the way
       out if the hardware path ever misbehaves on some console or flash cartridge. (A build with -DGRUG_NO_HW does the same.) */
    bool safe = false;
#ifdef GRUG_NO_HW
    safe = true;
#else
    for (int i = 0; i < 6; i++) { wait_ms(17); joypad_poll(); if (joypad_get_buttons(JOYPAD_PORT_1).z) safe = true; }
#endif
    if (!safe && hw_probe_rsp()) {   /* (the probe drives the RSP by hand, so it comes before libdragon takes the RSP over) */
        rdpq_init(); game_hw_ok = hw_probe_rdp(); if (game_hw_ok) hw_init();
    }
    game_use_hw = game_hw_ok;

    game_clock_us = clock_us;
    game_init((uint32_t)TICKS_READ() | 1);
    audio_init(AUD_RATE, 4);
    audio_set_buffer_callback(audio_fill);   /* mixed from the audio interrupt: the sound never waits for a slow frame */

    uint64_t last = get_ticks_us(); float fpsAcc = 0; int fpsN = 0;
    while (1) {
        uint64_t now = get_ticks_us(); float dt = (now - last) / 1e6f; last = now;
        fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5f) { game_fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
        Input in; read_input(&in);
        game_update(&in, dt);

        surface_t *s = display_get();
        Frame f = { s->buffer, zb, SCREEN_W, SCREEN_H, s->stride / 2 };
        if (game_use_hw && game_hw_ok) { gfx = &gfx_hw; hw_set_target(s); } else gfx = &gfx_soft;
        game_draw(&f);
        display_show(s);
    }
}
