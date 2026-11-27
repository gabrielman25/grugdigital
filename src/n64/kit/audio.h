/* Grug 64: sound. A small software mixer (the CPU mixes, so it works on any emulator and on the console alike) and
 * the player voice rules from static/voice.js (chance, cooldown, delay, priority, one line at a time, no repeats). */
#ifndef GRUG64_AUDIO_H
#define GRUG64_AUDIO_H

#include <stdint.h>
#include <stdbool.h>
#include "sounds.h"

#define AUD_RATE SND_RATE      /* the mixer's output rate (stereo, 16-bit) */

void aud_init(void);                                         /* decode every sound into RAM */
void aud_play(int snd, float vol, float semis, float pan);   /* vol: 1 = as loud as on the site; pan -1..1 */
void aud_tap(int snd);                                       /* a menu tap (with the site's little pitch jitter) */
void aud_walk(bool on);                                      /* the footsteps loop */
bool aud_say(int event);                                     /* the player's voice line for an action (VE_*) */
void aud_update(float dt);                                   /* once a frame: cooldowns, delayed lines, fades */
void aud_mix(int16_t *out, int frames);                      /* fill frames of interleaved stereo */

extern bool  aud_voices_on;     /* the Game Menu's Voices button */
extern float aud_voice_pitch;   /* the player's avatar pitch, in semitones (the site's safe zone) */

#endif
