/* window.GrugSfx: the two soft sounds every game shares, made with a small synth instead of sound files.
 *
 *   GrugSfx.tap(ctx, dest, { kind })    menus and buttons: a short, soft "tok". It replaced the old "tick" file (a loud,
 *                                       ringing ping) and the square-wave click.
 *   GrugSfx.thud(ctx, dest, { pitch })  a character falling apart: a low, soft thump with a little puff of air. It
 *                                       replaced the old "fall" file (a loud plop). The player voices (static/voice.js)
 *                                       carry the death itself; this is only the body hitting the floor.
 *
 * ctx is the game's AudioContext and dest the node to play into (the game's master gain, or a positional chain for a
 * sound that comes from somewhere in the world). Nothing plays unless ctx is running.
 *
 * Everything about how they sound is DEFAULTS below, so they can be turned up, down, higher, lower, longer or duller
 * without touching a game:
 *   - edit DEFAULTS here for everyone (the Voice Lab, /arcade/zone-royale/voice-lab/, has a slider for each value and
 *     exports them as the "sfx" part of its JSON), or
 *   - try values live from the browser console: GrugSfx.setConfig({ tap: { volume: 0.06, pitch: 3 } })   (this visit)
 *     GrugSfx.setConfig({ thud: { length: 0.4 } }, true)   (kept in this browser: localStorage 'grug.sfx.tuning.v1')
 *     GrugSfx.resetConfig()   back to DEFAULTS;   GrugSfx.demo(ctx)   hear every kind in a row.
 * A call can also bend one sound: { pitch: semitones, gain: 0..1, length: multiplier }. The kinds of tap are the same
 * sound at a different pitch and length (tap.kinds), so a menu opening, closing and counting down are told apart by
 * ear without any of them being loud.
 */
(function () {
  'use strict';
  const DEFAULTS = {
    version: 1,
    master: 1,            // both sounds, 0..1.5
    tap: {
      volume: 0.085,      // peak level before the game's own master gain (the old tick peaked near 0.16 and rang for 0.46 s)
      note: 440,          // Hz: the pitch of a plain "select" tap
      pitch: 0,           // semitones added to every tap
      jitter: 0.6,        // semitones of random variation, so a row of taps isn't a machine gun
      length: 0.1,        // seconds from the attack to silence
      attack: 0.006,      // seconds to fade in (no click at the start)
      drop: 5,            // semitones the note falls as it fades: this is what makes it a "tok" and not a "ping"
      bright: 1700,       // Hz: low-pass over the whole tap; lower is duller and softer
      body: 0.35,         // 0..1: how much of the hollow second voice (an octave up) is mixed in
      kinds: {            // pitch in semitones, volume and length as multipliers
        select: { pitch: 0 },
        open: { pitch: 4 },
        close: { pitch: -3 },
        count: { pitch: 7, length: 1.3 },
        deny: { pitch: -9, length: 1.5, volume: 1.1 },
        hover: { pitch: 9, volume: 0.5, length: 0.7 },
      },
    },
    thud: {
      volume: 0.3,        // the old fall file peaked near 0.66
      note: 138,          // Hz at the start of the thump
      pitch: 0,           // semitones added to every thud
      jitter: 1.5,
      length: 0.26,       // seconds
      attack: 0.014,
      drop: 14,           // semitones the thump falls
      puff: 0.3,          // 0..1: the puff of air on top (filtered noise)
      puffTone: 520,      // Hz: low-pass on the puff
    },
  };
  const KEY = 'grug.sfx.tuning.v1';
  const clone = o => JSON.parse(JSON.stringify(o));
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, b[k]); else a[k] = b[k]; } return a; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const semi = s => Math.pow(2, s / 12);
  const noise = new WeakMap();   // one short noise buffer per AudioContext
  function noiseOf(c) {
    let b = noise.get(c); if (b) return b;
    const n = Math.round(c.sampleRate * 0.3); b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noise.set(c, b); return b;
  }
  const live = c => c && c.state === 'running';

  const S = {
    DEFAULTS, KEY, config: merge(clone(DEFAULTS), lsGet() || {}), tuned: !!lsGet(), lastTap: 0,

    setConfig(c, save) { merge(this.config, c || {}); if (save) { try { localStorage.setItem(KEY, JSON.stringify(this.config)); this.tuned = true; } catch (e) { } } return this.config; },
    resetConfig() { try { localStorage.removeItem(KEY); } catch (e) { } this.tuned = false; this.config = clone(DEFAULTS); return this.config; },

    tap(c, dest, o = {}) {
      if (!live(c)) return false; const C = this.config, T = C.tap, K = T.kinds[o.kind] || T.kinds.select || {};
      const now = c.currentTime; if (now - this.lastTap < 0.02) return false; this.lastTap = now;   // two in the same frame are one
      const vol = T.volume * (K.volume ?? 1) * (o.gain ?? 1) * C.master; if (!(vol > 0)) return false;
      const f = T.note * semi(T.pitch + (K.pitch || 0) + (o.pitch || 0) + rnd(-T.jitter, T.jitter));
      const len = Math.max(0.03, T.length * (K.length ?? 1) * (o.length ?? 1)), a = Math.min(T.attack, len / 3);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = T.bright; lp.Q.value = 0.4;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(vol, now + a); g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      const voice = (type, mult, level) => {
        const osc = c.createOscillator(), og = c.createGain(); osc.type = type; og.gain.value = level;
        osc.frequency.setValueAtTime(f * mult * semi(T.drop), now); osc.frequency.exponentialRampToValueAtTime(f * mult, now + len * 0.7);
        osc.connect(og); og.connect(lp); osc.start(now); osc.stop(now + len + 0.03);
      };
      voice('sine', 1, 1); if (T.body > 0) voice('triangle', 2, T.body);
      lp.connect(g); g.connect(dest || c.destination);
      return true;
    },

    thud(c, dest, o = {}) {
      if (!live(c)) return false; const C = this.config, D = C.thud;
      const vol = D.volume * (o.gain ?? 1) * C.master; if (!(vol > 0)) return false;
      const now = c.currentTime, f = D.note * semi(D.pitch + (o.pitch || 0) + rnd(-D.jitter, D.jitter)), len = Math.max(0.08, D.length * (o.length ?? 1)), a = Math.min(D.attack, len / 3);
      const out = dest || c.destination;
      const osc = c.createOscillator(), g = c.createGain(); osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now); osc.frequency.exponentialRampToValueAtTime(f / semi(D.drop), now + len * 0.8);
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(vol, now + a); g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + len + 0.03);
      if (D.puff > 0) {
        const s = c.createBufferSource(), lp = c.createBiquadFilter(), ng = c.createGain(), pl = Math.min(len * 0.6, 0.18);
        s.buffer = noiseOf(c); lp.type = 'lowpass'; lp.frequency.value = D.puffTone; lp.Q.value = 0.3;
        ng.gain.setValueAtTime(0.0001, now); ng.gain.linearRampToValueAtTime(vol * D.puff, now + a); ng.gain.exponentialRampToValueAtTime(0.0001, now + pl);
        s.connect(lp); lp.connect(ng); ng.connect(out); s.start(now); s.stop(now + pl + 0.03);
      }
      return true;
    },

    // hear them all: every kind of tap, then a thud
    demo(c, dest) {
      if (!live(c)) return; const kinds = Object.keys(this.config.tap.kinds);
      kinds.forEach((k, i) => setTimeout(() => { this.lastTap = 0; this.tap(c, dest, { kind: k }); }, i * 350));
      setTimeout(() => this.thud(c, dest), kinds.length * 350 + 200);
    },
  };
  window.GrugSfx = S;
})();
