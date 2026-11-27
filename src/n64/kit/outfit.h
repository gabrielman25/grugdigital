/* Grug 64: the outfit slot. 128 KB at a fixed place in the ROM file that says what the character you play as wears:
 * a shirt, pants and face picture and the shape of the head. The file on the site has Grug in it; the Arcade's page
 * writes the outfit the player picked over it before the game starts (static/outfit64.js makes both, and is
 * where the layout is explained). The same block carries a few settings for testing (the stress test).
 *
 *   0   "GRUGFIT1"        8   size of the slot (u32)     12  version (u16)      14  flags (u16): 1 = there is an outfit
 *   16  stress test: bricks to add (u16; 0xFFFF: run the sweep)                 18  1 = start somewhere else, looking another way:
 *   20  x, z (studs), camera turn, tilt (degrees), distance (studs): five i16   32  the outfit's name, 32 bytes
 *   64  the outfit: skin r g b, 1 = has hair, hair r g b (kept for later: nothing draws hair yet), -, rings, points a ring, -, -,
 *       up to 9 rings (the last may be the crown: a point) of { height above the torso's centre (i16, 1/1024 stud), face row (u8, 0..255), -, how far out at each point (u16 x 8) },
 *       at 192 three palettes of 256 colours (shirt, pants, face), then the pictures, every level of each in turn:
 *       shirt 256x160 128x80 64x40, pants the same, face 128x80 64x40 32x20 16x10. Everything is big-endian. */
#ifndef GRUG64_OUTFIT_H
#define GRUG64_OUTFIT_H

#include "gfx.h"

#define SLOT_ROM_OFFSET 0x100000
#define SLOT_SIZE       0x20000

typedef struct Outfit {
    bool ok; char name[32];
    uint32_t skin, hair; bool hasHair;
    Tex shirt, pants, face;       /* shirt: torso and arms; pants: legs */
    HeadMesh head; float headY;   /* the head's middle, above the torso's centre */
} Outfit;

typedef struct SlotConfig { int stress; bool sweep, view; float x, z, yaw, pitch, dist; } SlotConfig;

/* read a slot (it must stay in memory while the outfit is worn: the pictures are used where they are) */
bool slot_read(const uint8_t *slot, int size, Outfit *o, SlotConfig *cfg);

/* where each face of the torso and of a limb is in a body picture (+x -x +y -y +z -z); a picture holds two limbs */
extern const TexRect FIT_TORSO[6], FIT_LIMB_A[6], FIT_LIMB_B[6];

#endif
