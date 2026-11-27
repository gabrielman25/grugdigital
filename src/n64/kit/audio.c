/* Grug 64: the mixer and the voice rules. */
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "audio.h"
#include "phys.h"   /* frand */

#define MASTER   1.5f      /* the site plays through a 0.55 master into a loud browser; a TV wants a bit more */
#define NCHAN    8
#define CH_VOICE 0         /* the player's voice: one line at a time */
#define CH_WALK  1

typedef struct { const int16_t *pcm; uint32_t len; uint32_t pos, step; int32_t vl, vr; bool loop, on; } Chan;   /* pos, step: 16.16 */
static Chan ch[NCHAN];
static int16_t *pcm[SND_COUNT];
static int32_t walkVol, walkTarget;
bool aud_voices_on = true;
float aud_voice_pitch = 0;

static const int16_t STEPS[89] = { 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
    253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871,
    5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767 };
static const int8_t INDEX[8] = { -1, -1, -1, -1, 2, 4, 6, 8 };

void aud_init(void) {
    for (int s = 0; s < SND_COUNT; s++) {
        const SndInfo *in = &SND_INFO[s]; const uint8_t *src = SND_ADPCM + in->offset;
        int16_t *dst = pcm[s] = malloc((in->samples + 1) * sizeof(int16_t));
        int pred = 0, idx = 0;
        for (uint32_t i = 0; i < in->samples; i++) {
            int code = (i & 1) ? (src[i >> 1] >> 4) : (src[i >> 1] & 15), step = STEPS[idx], d = step >> 3;
            if (code & 4) d += step; if (code & 2) d += step >> 1; if (code & 1) d += step >> 2;
            pred += (code & 8) ? -d : d; if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
            idx += INDEX[code & 7]; if (idx < 0) idx = 0; else if (idx > 88) idx = 88;
            dst[i] = (int16_t)pred;
        }
        dst[in->samples] = 0;
    }
    memset(ch, 0, sizeof ch);
    ch[CH_WALK].pcm = pcm[S_WALK]; ch[CH_WALK].len = SND_INFO[S_WALK].samples; ch[CH_WALK].step = 65536; ch[CH_WALK].loop = true; ch[CH_WALK].on = true;
}

static void start(int c, int snd, float vol, float semis, float pan) {
    float g = vol * SND_INFO[snd].gain * MASTER, l = 1, r = 1;
    if (pan < 0) r = 1 + pan; else if (pan > 0) l = 1 - pan;
    Chan *k = &ch[c];
    k->on = false;   /* (the mixer runs from the audio interrupt on the console: never let it see half a channel) */
    k->pcm = pcm[snd]; k->len = SND_INFO[snd].samples; k->pos = 0; k->loop = false;
    k->step = (uint32_t)(65536.0f * powf(2.0f, semis / 12.0f));
    k->vl = (int32_t)(g * l * 4096); k->vr = (int32_t)(g * r * 4096);
    k->on = true;
}
void aud_play(int snd, float vol, float semis, float pan) {
    int c = -1; uint32_t most = 0;
    for (int i = 2; i < NCHAN; i++) if (!ch[i].on) { c = i; break; }
    if (c < 0) for (int i = 2; i < NCHAN; i++) if (ch[i].pos >= most) { most = ch[i].pos; c = i; }   /* all busy: the one nearest its end */
    start(c, snd, vol, semis, pan);
}
void aud_tap(int snd) { aud_play(snd, 1, snd == S_THUD ? frange(-THUD_JITTER, THUD_JITTER) : frange(-TAP_JITTER, TAP_JITTER), 0); }
void aud_walk(bool on) { walkTarget = on ? (int32_t)(SND_INFO[S_WALK].gain * MASTER * 4096) : 0; }

/* ---------------------------------------------------------------- the player's voice (GrugVoice.play) */
static float clock_s, lastAt[VE_COUNT], speakEnd, pendingT;
static int lastClip[VE_COUNT], speakPri, pendingSnd = -1;
static float pendingVol, pendingSemis;
static bool inited;

bool aud_say(int ev) {
    if (!inited) { for (int i = 0; i < VE_COUNT; i++) { lastAt[i] = -1e9f; lastClip[i] = -1; } inited = true; }
    const VoiceEvent *E = &VOICE_EVENTS[ev];
    if (!aud_voices_on || E->nclips == 0) return false;
    if (E->cooldown > 0 && clock_s - lastAt[ev] < E->cooldown) return false;
    if (frand() >= E->chance) return false;
    if (VOICE_ONE_AT_A_TIME && speakEnd > clock_s && E->priority < speakPri) return false;
    /* pick a clip (not the same one twice in a row, if there's a choice) */
    int id;
    do { id = E->clips[(int)(frand() * E->nclips) % E->nclips]; } while (VOICE_NO_REPEAT && E->nclips > 1 && id == lastClip[ev]);
    lastClip[ev] = id;
    float semis = frange(E->pitch[0], E->pitch[1]) + aud_voice_pitch, vol = frange(E->vol[0], E->vol[1]);
    /* the clip was stretched for the middle of the action's pitch range: play it at the pitch asked for */
    float rate = powf(2.0f, semis / 12.0f), dur = SND_INFO[id].samples / (float)SND_RATE / rate;
    lastAt[ev] = clock_s; speakPri = E->priority; speakEnd = clock_s + E->delay + dur;
    if (E->delay > 0) { pendingSnd = id; pendingT = E->delay; pendingVol = vol; pendingSemis = semis; }
    else { pendingSnd = -1; start(CH_VOICE, id, vol, semis, 0); }
    return true;
}
void aud_update(float dt) {
    clock_s += dt;
    if (pendingSnd >= 0 && (pendingT -= dt) <= 0) { start(CH_VOICE, pendingSnd, pendingVol, pendingSemis, 0); pendingSnd = -1; }
}

void aud_mix(int16_t *out, int frames) {
    static int32_t acc[2 * 512];
    while (frames > 0) {
        int n = frames > 512 ? 512 : frames;
        memset(acc, 0, sizeof(int32_t) * 2 * n);
        /* the footsteps fade in and out (the site: a 40 ms time constant) */
        walkVol += (walkTarget - walkVol) / 4; if (walkTarget == 0 && walkVol < 8) walkVol = 0;
        ch[CH_WALK].vl = ch[CH_WALK].vr = walkVol;
        for (int c = 0; c < NCHAN; c++) {
            Chan *k = &ch[c]; if (!k->on || (k->vl == 0 && k->vr == 0 && c == CH_WALK)) continue;
            const int16_t *p = k->pcm; uint32_t pos = k->pos; const uint32_t step = k->step, end = k->len << 16; const int32_t vl = k->vl, vr = k->vr;
            int32_t *a = acc;
            for (int i = 0; i < n; i++, a += 2) {
                if (pos >= end) { if (k->loop) pos -= end; else { k->on = false; break; } }
                const uint32_t ix = pos >> 16; const int32_t fr = (pos >> 4) & 0xfff;
                const int32_t s = p[ix] + (((p[ix + 1] - p[ix]) * fr) >> 12);   /* linear between samples */
                a[0] += s * vl; a[1] += s * vr; pos += step;
            }
            k->pos = pos;
        }
        for (int i = 0; i < 2 * n; i++) { int32_t v = acc[i] >> 12; out[i] = (int16_t)(v > 32767 ? 32767 : v < -32768 ? -32768 : v); }
        out += 2 * n; frames -= n;
    }
}
