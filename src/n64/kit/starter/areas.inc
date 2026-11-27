static void build_world(void) {
    base_plate();
    /* spawn: a SpawnLocation (grey, a plate on top) */
    { Part *sp = part(0, 0.3f, 0, 12, 0.6f, 12, 0x6e6e72); sp->tag = T_SPAWN; sp->flags |= PF_STUDS; } deco(0, 0.65f, 0, 6, 0.1f, 6, 0xf2f3f3)->flags |= PF_FLAT;
    station("SPAWN", "everyone starts here", 0, 0, 0, 8, 8, 0);
    bill("@NAME@", "your game starts here", 0, 9, -18, 120);

    /* danger: a damage pad (one square of health a second) and a kill brick. Red means danger, and only danger is red. */
    hurtPad = part(-18, 0.2f, 20, 10, 0.4f, 10, 0xff0000); hurtPad->tag = T_HURT;
    world_add(&W, -1, 1, 20, 6, 2, 6, 0xff0000, K_KILL, PF_COLLIDE | PF_STUDS);
    bill("DAMAGE", "-1 health a second", -18, 5.5f, 20, 90); bill("KILL BRICK", "touch it and you fall apart", -1, 6.5f, 20, 90);
    station("DANGER", "red hurts - health is the red squares", 0, -10, 20, 17, 10, 0);

    /* something to jump onto (a jump lifts your feet 7.2 studs), with a coin on it */
    part(0, 2, -22, 8, 4, 8, 0x0d69ac); coin(0, 4, -22);

    /* the training dummy: something to swing at */
    deco(24, 0.1f, 0, 10, 0.2f, 10, 0x27466a);
    station("DUMMY", "B: swing - three hits break it", "F or click: swing - three hits break it", 24, 0, 8, 8, 0);
    dummyAt.on = true; dummyAt.x = 24; dummyAt.z = 0; dummyAt.yaw = PI_F / 2;

    /* A bigger game is several areas, each with its own 250 parts, joined by doors:
         door(0, 40, true, "THE CAVE", 1, 0, 0, 0);            a doorway at (0, 40) into area 1, arriving at (0, 0)
       with a build_cave() of its own and { "THE CAVE", build_cave } added to AREAS below. Put the door back beside
       where you arrive, not behind it (Grug Baseplate 64's Brick Yard is the example). */
}
static const Area AREAS[] = { { "BASEPLATE", build_world } };
#define N_AREAS ((int)(sizeof AREAS / sizeof AREAS[0]))

