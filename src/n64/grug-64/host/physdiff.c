/* Runs phys.c on a scenario read from stdin and prints where the character is after every frame.
 * tools/physdiff.cjs runs the site's own AmbientCore (arcade/baseplate/index.html) on the same scenario and compares.
 *   box minX maxX minY maxY minZ maxZ kind power      kind: 0 solid, 1 kill, 2 pad
 *   char x y z
 *   run frames mx mz jump                             30 frames a second
 *   dash dx dz                                        the dodge roll: 42 studs a second for 0.3 s                    */
#include <stdio.h>
#include <string.h>
#include "../phys.h"
int main(void) {
    static Part parts[64]; World W; Character ch; char line[256]; world_init(&W, parts, 64); char_init(&ch, 0, 3, 0, 0);
    while (fgets(line, sizeof line, stdin)) {
        float a[8]; int n;
        if (sscanf(line, "box %f %f %f %f %f %f %f %f", a, a + 1, a + 2, a + 3, a + 4, a + 5, a + 6, a + 7) == 8) {
            Part *p = world_add(&W, 0, 0, 0, 0, 0, 0, 0, (uint8_t)a[6], PF_COLLIDE); p->minX = a[0]; p->maxX = a[1]; p->minY = a[2]; p->maxY = a[3]; p->minZ = a[4]; p->maxZ = a[5]; p->power = a[7];
        } else if (sscanf(line, "char %f %f %f", a, a + 1, a + 2) == 3) char_init(&ch, a[0], a[1], a[2], 0);
        else if (sscanf(line, "dash %f %f", a, a + 1) == 2) { ch.dashT = 0.3; ch.dashVx = a[0] * 42; ch.dashVz = a[1] * 42; }
        else if (sscanf(line, "run %d %f %f %f", &n, a, a + 1, a + 2) == 4) {
            for (int i = 0; i < n; i++) { ch.mx = a[0]; ch.mz = a[1]; ch.jump = a[2] != 0; phys_step(&ch, &W, 1.0f / 30); ch.events = 0; printf("%.4f %.4f %.4f %d %d\n", (double)ch.x, (double)ch.y, (double)ch.z, ch.grounded, ch.dead); if (ch.dead) break; }
        }
    }
    return 0;
}
