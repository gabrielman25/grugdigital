/* Zombie Zones 64: what its test script (host/main.c) can ask of the game beyond the kit's GameDebug. */
#ifndef ZZ_H
#define ZZ_H
typedef struct { int area, supply, stored, kills, mag, zombies, spotsOn, roundState, score[4]; float hp, roundLeft, z0x, z0z, z0hp; } ZZDebug;
void zz_debug(ZZDebug *d);
void zz_zombie(int i, float x, float z, int kind);   /* put zombie i up at (x, z), awake: 0 walker, 1 runner, 2 Tank */
void zz_clear_zombies(void);                         /* none up, and none rising (for checks that want the area quiet) */
void zz_round_time(float left);                      /* skip the round's clock to this many seconds left */
#endif
