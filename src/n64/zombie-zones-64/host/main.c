/* Zombie Zones 64 on a PC: its test script (the harness is ../kit/host/harness.h).   make check
 * The physics every Grug game shares, then the game's own rules: the doors between the base and the town, grabbing
 * supply, the rifle and the bash, zombies that hurt you and can't get into your base, storing supply on the pad, going
 * down (you drop what you carry and start again at home), the end of a round, every area against the part limit, and
 * the Arcade's cover. */
#include "harness.h"
#include "../zz.h"

static void face(float yaw) { game_camera(yaw, 0.32f, 22); }

int main(int argc, char **argv) {
    GameDebug d; ZZDebug z;
    harness_begin(argc, argv);
    game_init(64);
    game_debug(&d); check("the slot's outfit is worn", d.outfit, 1, 1);
    zz_clear_zombies();
    run(0.6f, 0, 0, 0); shot("01-base");
    game_debug(&d); check("standing at home: root height over the spawn plate", d.y, 3.59f, 3.61f); check("standing: grounded", d.grounded, 1, 1);
    zz_debug(&z); check("a round is on (Supply Run)", z.roundState, 1, 1); check("...five minutes of it", z.roundLeft, 298, 300);
    /* the physics every Grug game shares: a jump lifts your feet 7.2 studs, you walk 16 studs a second */
    run(0.1f, 0, 0, BTN_A); run(1.25f, 0, 0, 0); game_debug(&d); check("standing jump height (JumpHeight 7.2)", d.lastHeight, 7.15f, 7.25f);
    game_teleport(114, 3.3f, 60, 0); run(0.5f, 0, 0, 0); game_debug(&d); float z0 = d.z; run(2.0f, 0, 1, 0); game_debug(&d);
    check("walk speed, studs a second (WalkSpeed 16)", (z0 - d.z) / 2.0f, 15.5f, 16.1f);

    /* out of the base and through the door into the town */
    game_teleport(0, 3.3f, 10, 0); run(0.3f, 0, 0, 0); shot("02-base-front");
    game_teleport(-30, 3.3f, -104, 0); face(0); run(0.3f, 0, 0, 0); shot("03-doors"); run(1.0f, 0, 1, 0); zz_debug(&z); game_debug(&d);
    check("the OLD TOWN door leads to area 1", z.area, 1, 1); check("...where it puts you (x)", d.x, -7, -5);
    zz_clear_zombies(); run(0.6f, 0, 0, 0); shot("04-old-town");
    zz_debug(&z); check("Old Town has supply on its spots", z.spotsOn, 12, 40);
    /* grab supply: walk near a crate (one lies in the road at 0, -60) and it flies to you */
    game_teleport(0, 3.3f, -50, 0); face(0); run(0.25f, 0, 0, 0); shot("05-crate-pull"); run(1.0f, 0, 0, 0); zz_debug(&z); check("walked near a crate: carrying it", z.supply, 1, 3);
    /* the rifle: a walker 30 studs ahead goes down to B held */
    zz_clear_zombies(); zz_zombie(0, 2, -92, 0); run(0.2f, 0, 0, 0); zz_debug(&z); const int k0 = z.kills;
    run(0.15f, 0, 0, BTN_B); shot("06-shooting"); run(1.6f, 0, 0, BTN_B); run(0.4f, 0, 0, 0); zz_debug(&z);
    check("the rifle drops a walker 30 studs off", z.kills - k0, 1, 1); check("...and used rounds from the magazine", z.mag, 0, 14);
    /* the bash: up close, B shoves the zombie back and hurts it */
    zz_clear_zombies(); zz_zombie(0, 0, -56, 0); run(0.05f, 0, 0, 0); zz_debug(&z); float hp0 = z.z0hp, zb = z.z0z;
    run(0.05f, 0, 0, BTN_B); run(0.15f, 0, 0, 0); shot("07-bash"); run(0.3f, 0, 0, 0); zz_debug(&z);
    check("the bash hurts it (35)", hp0 - z.z0hp, 34, 36); check("...and shoves it back (studs)", zb - z.z0z, 6, 30);
    /* a zombie at your side swings at you */
    zz_clear_zombies(); zz_zombie(0, 3, -50, 0); run(2.5f, 0, 0, 0); zz_debug(&z); check("a walker's swings hurt you", z.hp, 1, 90); shot("08-hurt");
    zz_clear_zombies(); run(5.0f, 0, 0, 0); zz_debug(&z); check("health comes back after 4 s without a hit", z.hp, z.hp, 100);
    /* zombies go round walls: one behind a cover block still reaches you */
    zz_clear_zombies(); game_teleport(18, 3.3f, -52, 0); zz_zombie(0, 18, -82, 0); run(6.0f, 0, 0, 0); zz_debug(&z); game_debug(&d);
    { float dx = z.z0x - d.x, dz = z.z0z - d.z; check("a zombie got round the cover block to you (studs off)", sqrtf(dx * dx + dz * dz), 0, 6); }
    zz_clear_zombies(); run(5, 0, 0, 0);

    /* the market: through Old Town's other door */
    game_teleport(20, 3.3f, 106, 3.14159f); face(3.14159f); run(0.3f, 0, 0, 0); run(1.0f, 0, 1, 0); zz_debug(&z); check("Old Town's other door leads to the Market (area 2)", z.area, 2, 2);
    run(3.0f, 0, 0, 0); zz_debug(&z); check("...and zombies rise there", z.zombies, 1, 9);
    game_teleport(0, 3.3f, 40, 0); face(0); run(0.5f, 0, 0, 0); shot("09-market");
    printf("  (market shot: %d polygons)\n", r_polys);
    zz_clear_zombies(); for (int i = 0; i < 9; i++) zz_zombie(i, -30 + (i % 3) * 30, -10 - (i / 3) * 25, i < 2 ? 2 : i < 5 ? 1 : 0);
    run(0.1f, 0, 0, 0); shot("10-market-horde"); printf("  (nine zombies in view: %d polygons)\n", r_polys);
    check("nine zombies in view: polygons drawn", r_polys, 100, 1400);
    zz_clear_zombies();
    /* home again with the supply: the Market's BLUE BASE door, then onto the pad */
    game_teleport(-20, 3.3f, 106, 3.14159f); face(3.14159f); run(0.3f, 0, 0, 0); run(1.0f, 0, 1, 0); zz_debug(&z); game_debug(&d);
    check("the BLUE BASE door leads home (area 0)", z.area, 0, 0); check("...beside the doors (z)", d.z, -110, -95);
    zz_debug(&z); const int carry = z.supply, s0 = z.score[3];
    game_teleport(0, 3.6f, 30, 0); run(0.6f, 0, 0, 0); shot("11-pad"); zz_debug(&z);
    check("stored on the pad: Blue's score goes up by what you carried", z.score[3] - s0, carry, carry); check("...and the bag is empty", z.supply, 0, 0);
    /* zombies can't get into your base */
    game_teleport(0, 3.3f, 20, 0); zz_zombie(0, 0, -30, 0); run(6.0f, 0, 0, 0); zz_debug(&z);
    check("a zombie at the front doorway stays outside (z)", z.z0z, -40, -6.5f); check("...and you are not hurt in there", z.hp, 100, 100); shot("12-base-safe");
    zz_clear_zombies();

    /* going down: you drop what you carry, and start again at home */
    game_teleport(-30, 3.3f, -104, 0); run(1.0f, 0, 1, 0); zz_clear_zombies(); game_teleport(0, 3.3f, -50, 0); run(1.2f, 0, 0, 0); zz_debug(&z); const int had = z.supply;
    check("(carrying something to drop)", had, 1, 10);
    run(0.1f, 0, 0, BTN_START); run(0.1f, 0, -1, 0); run(0.15f, 0, 0, 0); run(0.1f, 0, 0, BTN_A); run(0.3f, 0, 0, 0); shot("13-went-down"); zz_debug(&z); game_debug(&d);
    check("Reset Character: down", d.dead, 1, 1); check("...and the supply dropped", z.supply, 0, 0);
    run(3.2f, 0, 0, 0); zz_debug(&z); game_debug(&d); check("up again in your base (area 0)", z.area, 0, 0); check("...at the back of the yard (z)", d.z, 70, 78); check("...with full health", z.hp, 100, 100);

    /* the end of a round, and the next one */
    zz_round_time(62); run(3, 0, 0, 0); shot("14-one-minute");
    zz_round_time(1); run(1.5f, 0, 0, 0); zz_debug(&z); check("the round ends when the clock runs out", z.roundState, 2, 2); shot("15-round-over");
    run(10.5f, 0, 0, 0); zz_debug(&z); check("...and a new one starts", z.roundState, 1, 1); check("...with the scores back at 0", z.score[0] + z.score[1] + z.score[2] + z.score[3], 0, 0);
    run(30, 0, 0, 0); zz_debug(&z); check("the other teams' totals climb in 30 s", z.score[0] + z.score[1] + z.score[2], 2, 12);
    /* the Game Menu, the keyboard's wording */
    game_kbd = true; run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); shot("16-menu-keyboard"); run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); game_kbd = false;
    game_debug(&d); check("START closes the menu", d.menu, 0, 0);

    /* every area: inside the part limit? */
    harness_areas();

    /* the Arcade's cover picture: in Old Town, shooting into a few zombies, no HUD (make cover crops and enlarges it) */
    game_init(64); game_hide_hud = true; zz_clear_zombies();
    game_teleport(-30, 3.3f, -104, 0); run(1.0f, 0, 1, 0); zz_clear_zombies();
    game_teleport(-6, 3.3f, -30, 0); zz_zombie(0, -2, -52, 0); zz_zombie(1, -14, -60, 1); zz_zombie(2, 8, -66, 2); zz_zombie(3, -24, -74, 0);
    game_camera(0.35f, 0.18f, 12); run(0.4f, 0, 0, 0); run(0.12f, 0, 0, BTN_B); shot("cover");
    game_hide_hud = false;
    return harness_end();
}
