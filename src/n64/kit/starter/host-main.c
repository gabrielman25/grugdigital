/* @NAME@ on a PC: its test script (the harness is ../kit/host/harness.h).   make check
 * This is the starter's: it checks that the things every Grug game has still work here. Add your game's own checks (can
 * the course be finished? does the door lead where it should?) and a shot called "cover" for the Arcade's cover picture. */
#include "harness.h"

int main(int argc, char **argv) {
    GameDebug d;
    harness_begin(argc, argv);
    game_init(64);
    run(0.6f, 0, 0, 0); shot("01-spawn");
    game_debug(&d); check("standing: root height over the spawn plate", d.y, 3.59f, 3.61f); check("standing: grounded", d.grounded, 1, 1);
    /* the physics every Grug game shares: a jump lifts your feet 7.2 studs, you walk 16 studs a second */
    run(0.1f, 0, 0, BTN_A); run(1.25f, 0, 0, 0); game_debug(&d); check("standing jump height (JumpHeight 7.2)", d.lastHeight, 7.15f, 7.25f);
    game_teleport(60, 3.3f, 60, 0); run(0.5f, 0, 0, 0); game_debug(&d); float z0 = d.z; run(2.0f, 0, 1, 0); game_debug(&d);
    check("walk speed, studs a second (WalkSpeed 16)", (z0 - d.z) / 2.0f, 15.5f, 16.1f);
    /* danger: the damage pad takes a square a second; the kill brick breaks you apart; you respawn with full health */
    game_teleport(-18, 3.3f, 20, 0); run(2.6f, 0, 0, 0); shot("02-damage-pad"); game_debug(&d); check("health after 2.6 s on the damage pad (of 5)", d.hp, 2, 2);
    game_teleport(-6.5f, 3.3f, 20, -1.5708f); run(0.2f, 0, 0, 0); run(0.5f, 0, 1, 0); game_debug(&d); check("the kill brick kills", d.dead, 1, 1); shot("03-fell-apart");
    run(3.2f, 0, 0, 0); game_debug(&d); check("respawned", d.dead, 0, 0); check("full health again", d.hp, 5, 5);
    /* the Game Menu opens and closes */
    run(0.1f, 0, 0, BTN_START); run(0.2f, 0, 0, 0); shot("04-game-menu"); run(0.1f, 0, 0, BTN_START); run(0.3f, 0, 0, 0); game_debug(&d); check("START closes the menu", d.menu, 0, 0);
    /* every area: inside the part limit? */
    harness_areas();
    /* the Arcade's cover picture: no HUD (make cover crops and enlarges it) */
    game_init(64); game_hide_hud = true; game_camera(-0.5f, 0.15f, 12); run(0.5f, 0, 0, 0); run(0.1f, 0, 0, BTN_A); run(0.2f, 0, 0, 0); shot("cover"); game_hide_hud = false;
    return harness_end();
}
