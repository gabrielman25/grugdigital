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
#include "../outfit.h"
#include "hw.h"

static uint16_t zb[SCREEN_W * SCREEN_H];

/* ---------------------------------------------------------------- sound: straight to the audio interface
   libdragon's own audio queue gives the AI the buffer's uncached address (0xA0......). A console only looks at the low
   24 bits; the browser emulator's core uses all of it as an index into memory and crashes. So this queues the buffers
   itself, by physical address. Two can be queued at once: the audio interrupt comes as each one ends, and mixes the next
   (so the sound never waits for a slow frame). */
#define AI_ADDR    (*(volatile uint32_t *)0xA4500000)
#define AI_LEN     (*(volatile uint32_t *)0xA4500004)
#define AI_CTRL    (*(volatile uint32_t *)0xA4500008)
#define AI_STATUS  (*(volatile uint32_t *)0xA450000C)
#define AI_DACRATE (*(volatile uint32_t *)0xA4500010)
#define AI_BITRATE (*(volatile uint32_t *)0xA4500014)
#define AI_FULL    0x80000000u
#define SND_FRAMES 736                    /* a thirtieth of a second (x4 bytes: a multiple of 8, as the AI wants) */
#define SND_BUFS   3                      /* one playing, one queued, one being mixed */
static int16_t *sndbuf[SND_BUFS]; static int sndnext;
static void snd_feed(void) {
    for (int i = 0; i < 2 && !(AI_STATUS & AI_FULL); i++) {
        int16_t *b = sndbuf[sndnext]; sndnext = (sndnext + 1) % SND_BUFS;
        aud_mix(b, SND_FRAMES);
        AI_ADDR = PhysicalAddr(b); AI_LEN = SND_FRAMES * 4; AI_CTRL = 1;
    }
}
static void snd_init(void) {
    const int clock = get_tv_type() == TV_PAL ? 49656530 : get_tv_type() == TV_MPAL ? 48628316 : 48681812;
    int dacrate = ((2 * clock / AUD_RATE) + 1) / 2, bitrate = dacrate / 66; if (bitrate > 16) bitrate = 16;
    AI_DACRATE = dacrate - 1; AI_BITRATE = bitrate - 1;
    for (int i = 0; i < SND_BUFS; i++) {
        uint8_t *p = malloc_uncached_aligned(16, SND_FRAMES * 4 + 16);
        if ((((uint32_t)p + SND_FRAMES * 4) & 0x1FFF) == 0) p += 16;   /* (a buffer that ends on an 8 KB boundary trips a fault in the AI's address counter) */
        sndbuf[i] = (int16_t *)p;
    }
    register_AI_handler(snd_feed); set_AI_interrupt(1);
    disable_interrupts(); snd_feed(); enable_interrupts();   /* the interrupt only comes when a buffer ends: queue the first two */
}
static uint32_t clock_us(void) { return (uint32_t)get_ticks_us(); }

/* the outfit slot: read from its fixed place in the cartridge (tools/mkslot.py puts it there; the Arcade's page writes the
   player's outfit over it). The game uses the pictures where they are, so it stays. */
static uint8_t slot[SLOT_SIZE] __attribute__((aligned(16)));
static void read_slot(void) {
    data_cache_hit_writeback_invalidate(slot, SLOT_SIZE);
    dma_read(slot, 0x10000000 + SLOT_ROM_OFFSET, SLOT_SIZE);
    game_slot(slot, SLOT_SIZE);
}

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
    /* the camera stick: a second controller's Control Stick (the C buttons still work without one) */
    joypad_inputs_t j2 = joypad_get_inputs(JOYPAD_PORT_2);
    float cx = j2.stick_x / 80.0f, cy = j2.stick_y / 80.0f;
    in->cx = cx > 1 ? 1 : cx < -1 ? -1 : cx; in->cy = cy > 1 ? 1 : cy < -1 ? -1 : cy;
    /* the Arcade's page holds L + R + Z on a fourth controller to say "this is a keyboard": the game then names keys */
    joypad_buttons_t h4 = joypad_get_buttons(JOYPAD_PORT_4);
    if (h4.l && h4.r && h4.z) game_kbd = true;
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
    read_slot();
    game_init((uint32_t)TICKS_READ() | 1);
    snd_init();

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
