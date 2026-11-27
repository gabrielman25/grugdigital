/* window.GrugVoice: the player voice lines (jump, dodge roll, axe swing, death, falling off, the elimination laugh).
 *
 * First tried in Zone Royale, now in every Arcade game. A game uses it like this:
 *   GrugVoice.attach(audioContext, outputNode)   // once the game's AudioContext exists (loads the clips)
 *   GrugVoice.say('jump', { mine: true })                                   // you: your own avatar voice, not positional
 *   GrugVoice.say('death', { name: bot.name, id: bot.id, dest: () => makePannerGain() })   // someone else, from where they stand
 *   GrugVoice.menuButton(buttonElement)          // the Game Menu's "Voices: On / Just mine / Off" button
 * (say() is play() with the usual choices made; play() takes everything: see below.) Each game keeps a small Voice
 * object that turns its own characters into those calls. The actions: jump, dodge, attack, hurt, death, fall, laugh.
 *
 * Tuning (volumes, speed, pitch ranges, how often each line plays, which clips each action uses, the avatar pitch safe
 * zone) is DEFAULTS below. The Voice Lab (/arcade/zone-royale/voice-lab/) edits it and exports it as JSON; on this site
 * its "Use in Zone Royale" button saves it to localStorage 'grug.voice.tuning.v1', which wins over DEFAULTS until reset.
 * The player's own pick (their avatar's pitch and speed, voices on/off) is localStorage 'grug.voice.v1'.
 *
 * Pitch and speed are independent ("independent" mode): a clip is time-stretched (WSOLA) and then resampled, so a
 * higher voice isn't also a faster one. "tape" mode links them like a record (cheaper, more cartoony).
 */
(function () {
  'use strict';
  const SCRIPT = document.currentScript && document.currentScript.src;
  const BASE = (() => { try { return new URL('voice/player/', SCRIPT || location.href).href; } catch (e) { return '/static/voice/player/'; } })();

  const CLIPS = {
    'jump-1': 'Jump 1', 'jump-2': 'Jump 2', 'jump-3': 'Jump 3', 'jump-4': 'Jump 4', 'jumpdodge-1': 'Jump / Dodge',
    'dodge-1': 'Dodge 1', 'dodge-2': 'Dodge 2', 'dodge-3': 'Dodge 3', 'dodge-4': 'Dodge 4',
    'attack-1': 'Attack', 'death-1': 'Death 1', 'death-2': 'Death 2', 'death-3': 'Death 3', 'death-4': 'Death 4',
    'laugh-1': 'Devious laugh',
  };

  // tuned by the owner in the Voice Lab (Nov 25 2026)
  const DEFAULTS = {
    version: 1,
    master: { volume: 1, pitchMode: "independent", oneAtATime: true, noRepeat: true },
    others: { enabled: true, volume: 0.75, range: 90 },
    avatar: { pitchMin: -4, pitchMax: 4, pitchDefault: 0, speedMin: 0.92, speedMax: 1.1, speedDefault: 1, botSpread: 0.85 },
    clips: {
      'jump-1': { gain: 1 },
      'jump-2': { gain: 1 },
      'jump-3': { gain: 1 },
      'jump-4': { gain: 1 },
      'jumpdodge-1': { gain: 1 },
      'dodge-1': { gain: 1 },
      'dodge-2': { gain: 1 },
      'dodge-3': { gain: 1 },
      'dodge-4': { gain: 1 },
      'attack-1': { gain: 1 },
      'death-1': { gain: 1 },
      'death-2': { gain: 1 },
      'death-3': { gain: 1 },
      'death-4': { gain: 1 },
      'laugh-1': { gain: 1 },
    },
    events: {
      jump: { label: "Jump", on: true, chance: 1, cooldown: 0, delay: 0, priority: 1, volume: [0.05, 0.11], speed: [1.67, 2], pitch: [-1.8, 1], clips: ['jump-2', 'jump-1', 'jump-3', 'attack-1'] },
      dodge: { label: "Dodge roll", on: true, chance: 1, cooldown: 0, delay: 0, priority: 1, volume: [0.05, 0.22], speed: [0.97, 1.05], pitch: [-1.8, 1.3], clips: ['dodge-1', 'dodge-2', 'dodge-3', 'jumpdodge-1'] },
      attack: { label: "Axe swing", on: true, chance: 1, cooldown: 0, delay: 0, priority: 1, volume: [0.02, 0.14], speed: [1.24, 1.5], pitch: [-1, 1], clips: ['jump-3', 'jump-4'] },
      hurt: { label: "Hurt (took damage)", on: true, chance: 0.5, cooldown: 1.5, delay: 0, priority: 1, volume: [0.4, 0.5], speed: [1.12, 1.2], pitch: [0, 1], clips: ['death-1', 'death-2', 'jumpdodge-1', 'dodge-2'] },
      death: { label: "Death", on: true, chance: 1, cooldown: 0, delay: 0, priority: 3, volume: [0.44, 0.59], speed: [0.5, 0.62], pitch: [-2.4, -0.2], clips: ['death-1', 'death-2', 'death-3', 'death-4', 'dodge-4'] },
      fall: { label: "Fell off / fell to death", on: true, chance: 1, cooldown: 0, delay: 0, priority: 3, volume: [0.9, 0.95], speed: [0.9, 0.95], pitch: [-0.5, 0], clips: ['death-3', 'death-4'] },
      laugh: { label: "Got an elimination", on: true, chance: 0.5, cooldown: 6, delay: 0.35, priority: 2, volume: [0.08, 0.19], speed: [0.98, 1.04], pitch: [0.8, 2.2], clips: ['laugh-1'] },
    },
  };

  const TUNE_KEY = 'grug.voice.tuning.v1', MINE_KEY = 'grug.voice.v1';
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  // a config with every field present: the defaults, with whatever the given one has laid over them
  function normalize(c) {
    const out = clone(DEFAULTS); if (!c || typeof c !== 'object') return out;
    for (const s of ['master', 'others', 'avatar']) if (c[s]) Object.assign(out[s], c[s]);
    if (c.clips) for (const k in c.clips) out.clips[k] = Object.assign({ gain: 1 }, out.clips[k], c.clips[k]);
    if (c.events) for (const k in c.events) out.events[k] = Object.assign({}, out.events[k] || DEFAULTS.events.jump, c.events[k]);
    return out;
  }

  // ------------------------------------------------------------ WSOLA: change a clip's length, keep its pitch
  function stretch(x, f, sr) {
    const W = 2 * Math.round(sr * 0.0125), Hs = W / 2, Ha = Hs / f, tol = Math.round(sr * 0.006);
    const N = x.length, pad = new Float32Array(N + W * 2); pad.set(x, Hs);
    const win = new Float32Array(W); for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / W);
    const outN = Math.round(N * f), M = outN + W * 2, y = new Float32Array(M), nrm = new Float32Array(M);
    const maxStart = pad.length - W;
    const corr = (a, b, step) => { let s = 0; for (let i = 0; i < Hs; i += step) s += pad[a + i] * pad[b + i]; return s; };
    let prev = 0;
    for (let k = 0; ; k++) {
      const o = k * Hs; if (o > outN + Hs) break;
      let pos = Math.round(k * Ha);
      if (k > 0) {
        const tgt = prev + Hs; let best = clamp(pos, 0, maxStart);
        if (tgt <= maxStart) {
          const lo = clamp(pos - tol, 0, maxStart), hi = clamp(pos + tol, 0, maxStart); let bv = -Infinity;
          for (let c = lo; c <= hi; c += 4) { const v = corr(c, tgt, 3); if (v > bv) { bv = v; best = c; } }
          const c0 = best; for (let c = Math.max(lo, c0 - 3); c <= Math.min(hi, c0 + 3); c++) { const v = corr(c, tgt, 1); if (v > bv) { bv = v; best = c; } }
        }
        pos = best;
      }
      pos = clamp(pos, 0, maxStart);
      for (let i = 0; i < W && o + i < M; i++) { y[o + i] += pad[pos + i] * win[i]; nrm[o + i] += win[i]; }
      prev = pos;
    }
    const out = new Float32Array(outN);
    for (let j = 0; j < outN; j++) { const n = nrm[j + Hs]; out[j] = n > 0.05 ? y[j + Hs] / n : 0; }
    const fd = Math.min(outN, Math.round(sr * 0.004)); for (let i = 0; i < fd; i++) out[outN - 1 - i] *= i / fd;
    return out;
  }

  const V = {
    CLIPS, DEFAULTS, BASE, TUNE_KEY, MINE_KEY,
    ctx: null, out: null, buf: {}, ready: false, config: normalize(lsGet(TUNE_KEY)), tuned: !!lsGet(TUNE_KEY),
    last: {}, lastClip: {}, speaking: {}, cache: new Map(), onplay: null,

    attach(ctx, out, srcs) {
      if (!ctx) return; this.ctx = ctx; this.out = out || ctx.destination;
      if (this._loading) return; this._loading = true; this.load(srcs);
    },
    load(srcs) {   // srcs: { id: url or data: URI }; by default the mp3s next to this script
      const c = this.ctx; if (!c) return Promise.resolve();
      const list = Object.keys(CLIPS).map(id => {
        const url = (srcs && srcs[id]) || (window.GRUG_VOICE_SRCS && window.GRUG_VOICE_SRCS[id]) || BASE + id + '.mp3';   // GRUG_VOICE_SRCS: a page with the clips built in
        return fetch(url).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).then(b => { this.buf[id] = b; }).catch(e => console.warn('GrugVoice: could not load', id, e));
      });
      return Promise.all(list).then(() => { this.ready = true; this.cache.clear(); });
    },

    // ---------------------------------------------------------- config
    setConfig(c, save) { this.config = normalize(c); if (save) { lsSet(TUNE_KEY, this.config); this.tuned = true; } },
    resetConfig() { lsSet(TUNE_KEY, null); this.tuned = false; this.config = normalize(null); },
    exportJSON() { return JSON.stringify(this.config, null, 2); },
    normalize,

    // ---------------------------------------------------------- the player's own voice (their avatar), kept in the safe zone
    mine() {
      const A = this.config.avatar, m = lsGet(MINE_KEY) || {};
      return { pitch: clamp(m.pitch ?? A.pitchDefault, A.pitchMin, A.pitchMax), speed: clamp(m.speed ?? A.speedDefault, A.speedMin, A.speedMax), on: m.on !== false, others: m.others !== false };
    },
    setMine(p) { lsSet(MINE_KEY, Object.assign(lsGet(MINE_KEY) || {}, p)); },
    others() { return this.config.others.enabled && this.mine().others; },
    // another player's voice: the same name always sounds the same, somewhere inside the safe zone
    voiceFor(seed) {
      const A = this.config.avatar; let h = 2166136261; const s = String(seed || '');
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      const u1 = ((h >>> 0) % 10007) / 10006, u2 = ((h >>> 8) % 9973) / 9972, sp = clamp(A.botSpread, 0, 1);
      const pm = (A.pitchMin + A.pitchMax) / 2, sm = (A.speedMin + A.speedMax) / 2;
      return { pitch: lerp(pm, lerp(A.pitchMin, A.pitchMax, u1), sp), speed: lerp(sm, lerp(A.speedMin, A.speedMax, u2), sp) };
    },

    // ---------------------------------------------------------- a clip at a pitch (semitones) and speed
    variant(id, semis, speed) {
      const b = this.buf[id]; if (!b) return null;
      const p = Math.pow(2, Math.round(semis * 10) / 120), s = Math.round(speed * 100) / 100;
      if (this.config.master.pitchMode === 'tape') return { buffer: b, rate: p * s };
      const f = Math.round(p / s * 200) / 200;
      if (Math.abs(f - 1) < 0.004) return { buffer: b, rate: p };
      const key = id + '|' + f; let nb = this.cache.get(key);
      if (!nb) {
        const d = stretch(b.getChannelData(0), f, b.sampleRate); nb = this.ctx.createBuffer(1, d.length, b.sampleRate); nb.getChannelData(0).set(d);
        this.cache.set(key, nb); if (this.cache.size > 160) this.cache.delete(this.cache.keys().next().value);
      } else { this.cache.delete(key); this.cache.set(key, nb); }
      return { buffer: nb, rate: p };
    },

    // ---------------------------------------------------------- play an action's line (or not: chance, cooldown, a line already playing)
    // opts: who (who's speaking; cooldowns are per speaker), mine (your own voice), voice ({pitch, speed}), dest (AudioNode or
    // a function returning one, called only if it plays), gain, force (ignore chance and cooldown, for tests), others (another player)
    play(ev, opts = {}) {
      const info = { event: ev, who: opts.who || 'me', played: false, reason: '', forced: !!opts.force }, c = this.ctx, C = this.config, E = C.events[ev];
      const done = r => { info.reason = r; if (this.onplay) this.onplay(info); return info; };
      if (!c || c.state !== 'running') return done('sound not started');
      if (!E) return done('no such event');
      if (!opts.force && !E.on) return done('event off');
      const mine = opts.mine ? this.mine() : null;
      if (mine && !mine.on && !opts.force) return done('your voice is off');
      const pool = (E.clips || []).filter(id => this.buf[id]); if (!pool.length) return done(this.ready ? 'no clips picked' : 'clips still loading');
      const now = c.currentTime, ck = info.who + '|' + ev;
      if (!opts.force && E.cooldown > 0 && now - (this.last[ck] ?? -1e9) < E.cooldown) return done('cooldown');
      if (!opts.force && Math.random() >= E.chance) return done('chance');
      const cur = this.speaking[info.who];
      if (C.master.oneAtATime && cur && cur.end > now && !opts.force && (E.priority || 1) < cur.priority) return done('already talking');
      // pick a clip (not the same one twice in a row, if there's a choice)
      let choices = pool; const lk = ev + '|' + info.who;
      if (C.master.noRepeat && pool.length > 1) choices = pool.filter(id => id !== this.lastClip[lk]);
      const id = choices[Math.floor(Math.random() * choices.length)]; this.lastClip[lk] = id;
      const vo = mine || opts.voice || { pitch: 0, speed: 1 };
      const semis = rnd(E.pitch[0], E.pitch[1]) + (vo.pitch || 0), speed = rnd(E.speed[0], E.speed[1]) * (vo.speed || 1);
      const vol = rnd(E.volume[0], E.volume[1]) * ((C.clips[id] && C.clips[id].gain) ?? 1) * C.master.volume * (opts.others ? C.others.volume : 1) * (opts.gain ?? 1);
      const v = this.variant(id, semis, speed); if (!v) return done('clip not loaded');
      let dest = typeof opts.dest === 'function' ? opts.dest() : opts.dest; if (opts.dest && !dest) return done('too far');
      dest = dest || this.out;
      const t0 = now + Math.max(0, E.delay || 0);
      if (cur && cur.end > now && C.master.oneAtATime) { try { cur.g.gain.setTargetAtTime(0, t0, 0.012); cur.src.stop(t0 + 0.08); } catch (e) { } }
      const src = c.createBufferSource(), g = c.createGain(); src.buffer = v.buffer; src.playbackRate.value = v.rate; g.gain.value = vol;
      src.connect(g); g.connect(dest); src.start(t0);
      const dur = v.buffer.duration / v.rate;
      this.speaking[info.who] = { src, g, priority: E.priority || 1, end: t0 + dur };
      src.onended = () => { try { g.disconnect(); } catch (e) { } if (this.speaking[info.who] && this.speaking[info.who].src === src) delete this.speaking[info.who]; };
      this.last[ck] = now;
      Object.assign(info, { played: true, clip: id, label: CLIPS[id], pitch: semis, speed, volume: vol, duration: dur });
      return done('');
    },
    // ---------------------------------------------------------- what a game calls: who is speaking, and from where
    // o.mine: you (your own avatar voice, straight to the output). Otherwise someone else: o.name gives them a voice of
    // their own (the same name always sounds the same), o.id keeps their cooldowns apart, and o.dest is a node to play
    // into (or a function returning one, or null when they're out of earshot). o.force: ignore chance and cooldown.
    say(ev, o = {}) {
      if (o.mine) return this.play(ev, { who: 'me', mine: true, force: o.force, gain: o.gain });
      if (!this.others() && !o.force) return { event: ev, played: false, reason: "others' voices are off" };
      return this.play(ev, { who: 'f' + (o.id ?? o.name ?? ''), voice: this.voiceFor(o.name), others: true, force: o.force, gain: o.gain, dest: o.dest });
    },
    // the Game Menu's button: one press steps through everyone's voices on, just your own, and off (kept for every game)
    menuLabel() { const m = this.mine(); return 'Voices: ' + (!m.on ? 'Off' : m.others ? 'On' : 'Just mine'); },
    menuButton(el, after) {
      if (!el) return; el.style.display = ''; el.textContent = this.menuLabel();
      el.addEventListener('click', e => {
        e.stopPropagation(); const m = this.mine();
        this.setMine(m.on && m.others ? { on: true, others: false } : m.on ? { on: false, others: false } : { on: true, others: true });
        el.textContent = this.menuLabel(); if (this.mine().on) this.play('jump', { who: 'me', mine: true, force: true });
        if (after) after();
      });
    },
    // just hear a clip (the Voice Lab's clip list)
    preview(id, semis = 0, speed = 1, vol = 0.9) {
      const c = this.ctx; if (!c || !this.buf[id]) return; const v = this.variant(id, semis, speed); const s = c.createBufferSource(), g = c.createGain();
      s.buffer = v.buffer; s.playbackRate.value = v.rate; g.gain.value = vol * ((this.config.clips[id] && this.config.clips[id].gain) ?? 1); s.connect(g); g.connect(this.out); s.start();
    },
  };
  window.GrugVoice = V;
})();
