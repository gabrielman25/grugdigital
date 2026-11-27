#!/usr/bin/env python3
"""Bake Grug 64's sounds into sounds.c / sounds.h (run from anywhere; needs ffmpeg, node, numpy, scipy).

    python3 src/n64/grug-64/tools/mkaudio.py

Everything comes from the site, squeezed down for a cartridge:
  · the player voices: static/voice/player/*.mp3, with the tuning in static/voice.js (DEFAULTS: which clips each action
    uses, how often, how loud, the speed and pitch ranges). The site time-stretches a clip and then resamples it, so a
    higher voice isn't a faster one; a console can't afford that live, so each (action, clip) pair is stretched HERE,
    with the same WSOLA as voice.js, to the middle of its speed range, and the game only bends the pitch.
  · the soft tap and the soft thud: rendered from static/sfx.js (DEFAULTS), every kind of tap.
  · the game's own sounds: the jump and footsteps files and the little synth in arcade/baseplate/index.html (Snd).
All of it is mono, 22.05 kHz, 4-bit IMA ADPCM (a quarter the size of 16-bit); the game decodes it into RAM at boot.
Re-run this after the owner sends new Voice Lab numbers or new clips, then rebuild the ROM.
"""
import os, re, sys, json, base64, subprocess, tempfile
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SR = 22050
rng = np.random.default_rng(64)

# ---------------------------------------------------------------- the site's tuning (voice.js and sfx.js DEFAULTS)
def site_defaults():
    js = r"""
const vm = require('vm'), fs = require('fs');
const sb = { document: { currentScript: null }, location: { href: 'http://x/' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  URL, console, setTimeout, fetch() { return Promise.reject(); } };
sb.window = sb;
for (const f of process.argv.slice(2)) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sb);
process.stdout.write(JSON.stringify({ voice: sb.GrugVoice.DEFAULTS, sfx: sb.GrugSfx.DEFAULTS }));
"""
    with tempfile.NamedTemporaryFile('w', suffix='.cjs', delete=False) as t: t.write(js)
    try: return json.loads(subprocess.check_output(['node', t.name, os.path.join(ROOT, 'static', 'voice.js'), os.path.join(ROOT, 'static', 'sfx.js')]))
    finally: os.unlink(t.name)

def decode(path_or_bytes, ext='mp3'):
    """any audio file -> mono float32 at SR"""
    if isinstance(path_or_bytes, bytes):
        with tempfile.NamedTemporaryFile(suffix='.' + ext, delete=False) as t: t.write(path_or_bytes)
        p = t.name
    else: p = path_or_bytes
    try:
        raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    finally:
        if isinstance(path_or_bytes, bytes): os.unlink(p)
    return np.frombuffer(raw, dtype='<f4').astype(np.float64)

def trim(x, thr=0.004):
    """drop the silence an mp3 leaves at each end"""
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0: return x
    a, b = max(0, idx[0] - 40), min(len(x), idx[-1] + 200)
    y = x[a:b].copy(); n = min(60, len(y)); y[:n] *= np.linspace(0, 1, n); y[-n:] *= np.linspace(1, 0, n)
    return y

# ---------------------------------------------------------------- WSOLA: change a clip's length, keep its pitch (voice.js stretch())
def stretch(x, f, sr=SR):
    W = 2 * round(sr * 0.0125); Hs = W // 2; Ha = Hs / f; tol = round(sr * 0.006)
    N = len(x); pad = np.zeros(N + W * 2); pad[Hs:Hs + N] = x
    win = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(W) / W)
    outN = round(N * f); M = outN + W * 2; y = np.zeros(M); nrm = np.zeros(M)
    maxStart = len(pad) - W
    corr = lambda a, b, step: float(np.dot(pad[a:a + Hs:step], pad[b:b + Hs:step]))
    cl = lambda v: max(0, min(maxStart, v))
    prev = 0; k = 0
    while True:
        o = k * Hs
        if o > outN + Hs: break
        pos = round(k * Ha)
        if k > 0:
            tgt = prev + Hs; best = cl(pos)
            if tgt <= maxStart:
                lo, hi = cl(pos - tol), cl(pos + tol); bv = -np.inf
                for c in range(lo, hi + 1, 4):
                    v = corr(c, tgt, 3)
                    if v > bv: bv, best = v, c
                c0 = best
                for c in range(max(lo, c0 - 3), min(hi, c0 + 3) + 1):
                    v = corr(c, tgt, 1)
                    if v > bv: bv, best = v, c
            pos = best
        pos = cl(pos)
        n = min(W, M - o)
        y[o:o + n] += pad[pos:pos + n] * win[:n]; nrm[o:o + n] += win[:n]
        prev = pos; k += 1
    out = np.where(nrm[Hs:Hs + outN] > 0.05, y[Hs:Hs + outN] / np.maximum(nrm[Hs:Hs + outN], 1e-9), 0)
    fd = min(outN, round(sr * 0.004))
    if fd: out[outN - fd:] *= np.arange(fd, 0, -1) / fd
    return out

# ---------------------------------------------------------------- the little synths (Web Audio, by hand)
semi = lambda s: 2 ** (s / 12)
def cf(v):   # a number as a C float literal
    t = repr(float(v)); return (t if ('.' in t or 'e' in t) else t + '.0') + 'f'
def exp_ramp(v0, v1, n): return v0 * (v1 / v0) ** (np.arange(n) / max(1, n))
def osc(kind, freq):   # freq: an array of Hz per sample
    ph = np.cumsum(freq) / SR
    if kind == 'sine': return np.sin(2 * np.pi * ph)
    if kind == 'square': return np.where((ph % 1) < 0.5, 1.0, -1.0)
    if kind == 'triangle': return 2 * np.abs(2 * ((ph + 0.25) % 1) - 1) - 1
    raise ValueError(kind)
def biquad_lowpass(x, f, q_db):   # Web Audio's lowpass: Q is in dB
    q = 10 ** (q_db / 20); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
    b = np.array([(1 - c) / 2, 1 - c, (1 - c) / 2]); a = np.array([1 + al, -2 * c, 1 - al])
    return signal.lfilter(b / a[0], a / a[0], x)
def bandpass_sweep(x, f0, f1, q):   # a band-pass whose centre slides from f0 to f1 over the sound
    y = np.zeros_like(x); n = len(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        if i % 16 == 0:
            f = f0 * (f1 / f0) ** (i / n); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
            b0, b2, a0, a1, a2 = al, -al, 1 + al, -2 * c, 1 - al
        v = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, v; y[i] = v
    return y
def tone(kind, f0, f1, dur, v, t0=0.0):   # Snd.play's tone(): the note slides, the level jumps up and dies away
    n = int(dur * SR); a = max(1, int(0.01 * SR))
    env = np.concatenate([exp_ramp(0.0001, v, a), exp_ramp(v, 0.001, n - a)])
    return np.concatenate([np.zeros(int(t0 * SR)), osc(kind, exp_ramp(f0, f1, n)) * env])
def hiss(f0, f1, dur, v, q=1.0):          # Snd.play's hiss(): band-passed noise that slides and dies away
    n = int(dur * SR)
    return bandpass_sweep(rng.uniform(-1, 1, n), f0, f1, q) * exp_ramp(v, 0.001, n)
def mix(*parts):
    n = max(len(p) for p in parts); y = np.zeros(n)
    for p in parts: y[:len(p)] += p
    return y
def tap(T, kind):                          # static/sfx.js tap(), without the random jitter (the game adds it as pitch)
    K = T['kinds'][kind]
    f = T['note'] * semi(T['pitch'] + K.get('pitch', 0)); ln = max(0.03, T['length'] * K.get('length', 1)); a = min(T['attack'], ln / 3)
    vol = T['volume'] * K.get('volume', 1)
    n = int((ln + 0.03) * SR); nr = int(ln * 0.7 * SR)
    def voice(kind_, mult, level):
        fr = np.full(n, f * mult); fr[:nr] = exp_ramp(f * mult * semi(T['drop']), f * mult, nr)
        return osc(kind_, fr) * level
    x = voice('sine', 1, 1) + (voice('triangle', 2, T['body']) if T['body'] > 0 else 0)
    x = biquad_lowpass(x, T['bright'], 0.4)
    na = max(1, int(a * SR)); nl = int(ln * SR)
    env = np.zeros(n); env[:na] = np.linspace(0.0001, vol, na); env[na:nl] = exp_ramp(vol, 0.0001, nl - na)
    return x * env
def thud(D):                               # static/sfx.js thud()
    f = D['note'] * semi(D['pitch']); ln = max(0.08, D['length']); a = min(D['attack'], ln / 3); vol = D['volume']
    n = int((ln + 0.03) * SR); nr = int(ln * 0.8 * SR); na = max(1, int(a * SR)); nl = int(ln * SR)
    fr = np.full(n, f / semi(D['drop'])); fr[:nr] = exp_ramp(f, f / semi(D['drop']), nr)
    env = np.zeros(n); env[:na] = np.linspace(0.0001, vol, na); env[na:nl] = exp_ramp(vol, 0.0001, nl - na)
    y = osc('sine', fr) * env
    if D['puff'] > 0:
        pl = min(ln * 0.6, 0.18); npf = int(pl * SR)
        e = np.zeros(n); e[:na] = np.linspace(0.0001, vol * D['puff'], na); e[na:npf] = exp_ramp(vol * D['puff'], 0.0001, npf - na)
        y += biquad_lowpass(rng.uniform(-1, 1, n), D['puffTone'], 0.3) * e
    return y
def ding(notes, base, vol, kind='sine', gap=0.06, dur=0.09):   # Snd.ding()
    parts = []
    for i, st in enumerate(notes):
        n = int(dur * SR); a = max(1, int(0.008 * SR)); f = base * semi(st)
        env = np.concatenate([exp_ramp(0.0001, vol, a), exp_ramp(vol, 0.0001, n - a)])
        parts.append(np.concatenate([np.zeros(int(i * gap * SR)), osc(kind, np.full(n, f)) * env]))
    return mix(*parts)

# ---------------------------------------------------------------- IMA ADPCM (4 bits a sample)
STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371,
         408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132,
         7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767]
INDEX = [-1, -1, -1, -1, 2, 4, 6, 8]
def adpcm(pcm):
    pred, idx, out = 0, 0, bytearray(); nib = []
    for s in pcm:
        step = STEPS[idx]; diff = int(s) - pred; code = 0
        if diff < 0: code = 8; diff = -diff
        d = step >> 3
        if diff >= step: code |= 4; diff -= step; d += step
        if diff >= step >> 1: code |= 2; diff -= step >> 1; d += step >> 1
        if diff >= step >> 2: code |= 1; d += step >> 2
        pred = max(-32768, min(32767, pred - d if code & 8 else pred + d))
        idx = max(0, min(88, idx + INDEX[code & 7])); nib.append(code)
    if len(nib) & 1: nib.append(0)
    for i in range(0, len(nib), 2): out.append(nib[i] | (nib[i + 1] << 4))
    return bytes(out)

# ---------------------------------------------------------------- gather
cfg = site_defaults(); V = cfg['voice']; S = cfg['sfx']
sounds = []   # (name, float array, gain)
def add(name, x, gain=None):
    """store a sound at full scale, and remember how loud it really was (the game multiplies it back)"""
    peak = float(np.max(np.abs(x))) or 1.0
    sounds.append((name, x / peak * 0.92, (peak / 0.92) if gain is None else gain * peak / 0.92)); return len(sounds) - 1

# the voices: one stretched copy per (action, clip)
raw = {}
for cid in V['clips']:
    raw[cid] = trim(decode(os.path.join(ROOT, 'static', 'voice', 'player', cid + '.mp3')))
EVENTS = ['jump', 'dodge', 'attack', 'hurt', 'death', 'fall', 'laugh']
ev_rows = []
for ev in EVENTS:
    E = V['events'][ev]; p0 = semi((E['pitch'][0] + E['pitch'][1]) / 2); s0 = (E['speed'][0] + E['speed'][1]) / 2
    f0 = round(p0 / s0 * 200) / 200
    ids = []
    for cid in E['clips']:
        x = raw[cid] if abs(f0 - 1) < 0.004 else stretch(raw[cid], f0)
        ids.append(add('V_%s_%s' % (ev.upper(), cid.upper().replace('-', '_')), x, V['clips'][cid].get('gain', 1) * V['master']['volume']))
    ev_rows.append((ev, E, ids, p0))

# the game's sound files (inside the Baseplate), and its synth
html = open(os.path.join(ROOT, 'arcade', 'baseplate', 'index.html'), encoding='utf-8').read()
files = {m.group(1): (m.group(2), base64.b64decode(m.group(3))) for m in re.finditer(r'"(\w+)":"data:audio/(\w+);base64,([A-Za-z0-9+/=]+)"', html)}
ext = lambda t: 'wav' if t == 'wav' else 'mp3'
add('S_JUMP', trim(decode(files['jump'][1], ext(files['jump'][0]))), 0.6)
walk = decode(files['walk'][1], ext(files['walk'][0])); walk = walk[int(0.03 * SR):len(walk) - int(0.03 * SR)]
add('S_WALK', walk, 0.45)
T, D = S['tap'], S['thud']
for kind in ['select', 'open', 'close', 'count', 'deny']: add('S_TAP_' + kind.upper(), tap(T, kind), S['master'])
add('S_THUD', thud(D), S['master'])
add('S_SWING', hiss(900, 2400, 0.12, 0.35, 2))
add('S_HIT', tone('square', 260, 120, 0.09, 0.22))
add('S_CHIME', tone('square', 523, 1046, 0.3, 0.18))
add('S_PAD', mix(tone('sine', 300, 1200, 0.3, 0.25), hiss(600, 2400, 0.25, 0.25, 2)))
add('S_DOOR', mix(tone('triangle', 200, 120, 0.35, 0.3), hiss(400, 200, 0.3, 0.2, 1)))
add('S_COIN', ding([0, 7], 1240, 0.06))
add('S_WIN', ding([0, 4, 7, 12, 16], 523, 0.16, 'triangle', 0.06, 0.32))

# ---------------------------------------------------------------- write sounds.h / sounds.c
blob = bytearray(); rows = []
for name, x, gain in sounds:
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype(np.int32)
    rows.append((name, len(blob), len(pcm), gain)); blob += adpcm(pcm)
h = ['/* Generated by tools/mkaudio.py from static/voice.js, static/sfx.js and the Baseplate: do not edit. */',
     '#ifndef GRUG64_SOUNDS_H', '#define GRUG64_SOUNDS_H', '#include <stdint.h>', '#define SND_RATE %d' % SR,
     'enum { ' + ', '.join(r[0] for r in rows) + ', SND_COUNT };',
     'typedef struct { uint32_t offset, samples; float gain; } SndInfo;   /* offset into SND_ADPCM; gain: how loud it plays at volume 1 */',
     'extern const SndInfo SND_INFO[SND_COUNT];', 'extern const uint8_t SND_ADPCM[%d];' % len(blob),
     'enum { ' + ', '.join('VE_' + e.upper() for e in EVENTS) + ', VE_COUNT };',
     '#define VE_MAXCLIPS %d' % max(len(r[2]) for r in ev_rows),
     '/* a voice line, as tuned in the Voice Lab. basePitch: the pitch (as a rate) the stored clips were stretched for. */',
     'typedef struct { float chance, cooldown, delay; int priority; float vol[2], pitch[2], basePitch; int nclips; uint8_t clips[VE_MAXCLIPS]; } VoiceEvent;',
     'extern const VoiceEvent VOICE_EVENTS[VE_COUNT];',
     '#define VOICE_ONE_AT_A_TIME %d' % (1 if V['master']['oneAtATime'] else 0), '#define VOICE_NO_REPEAT %d' % (1 if V['master']['noRepeat'] else 0),
     '#define VOICE_PITCH_MIN (%s)' % cf(V['avatar']['pitchMin']), '#define VOICE_PITCH_MAX (%s)' % cf(V['avatar']['pitchMax']),
     '#define TAP_JITTER (%s)' % cf(T['jitter']), '#define THUD_JITTER (%s)' % cf(D['jitter']), '#endif', '']
open(os.path.join(OUT, 'sounds.h'), 'w').write('\n'.join(h))
c = ['/* Generated by tools/mkaudio.py: do not edit. */', '#include "sounds.h"', 'const SndInfo SND_INFO[SND_COUNT] = {']
c += ['  { %d, %d, %.5ff },   /* %s */' % (o, n, g, nm) for nm, o, n, g in rows] + ['};', 'const VoiceEvent VOICE_EVENTS[VE_COUNT] = {']
for ev, E, ids, p0 in ev_rows:
    on = 1 if E.get('on', True) else 0
    c.append('  { %s, %s, %s, %d, { %s, %s }, { %s, %s }, %.5ff, %d, { %s } },   /* %s */' % (
        cf(E['chance'] * on), cf(E['cooldown']), cf(E['delay']), E['priority'], cf(E['volume'][0]), cf(E['volume'][1]), cf(E['pitch'][0]), cf(E['pitch'][1]), p0, len(ids), ', '.join(map(str, ids)), ev))
c += ['};', 'const uint8_t SND_ADPCM[%d] = {' % len(blob)]
for i in range(0, len(blob), 32): c.append(' ' + ','.join(str(b) for b in blob[i:i + 32]) + ',')
c += ['};', '']
open(os.path.join(OUT, 'sounds.c'), 'w').write('\n'.join(c))
secs = sum(r[2] for r in rows) / SR
print('%d sounds, %.1f s, %d KB of ADPCM (from %d KB of mp3 voices)' % (len(rows), secs, len(blob) // 1024, sum(os.path.getsize(os.path.join(ROOT, 'static', 'voice', 'player', k + '.mp3')) for k in V['clips']) // 1024))
for nm, o, n, g in rows: print('  %-28s %5.2f s  gain %.3f' % (nm, n / SR, g))
