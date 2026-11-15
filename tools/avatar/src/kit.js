/* ================= SandyKit 2 · the blocky avatar (Kenney "Animated Characters: Protagonists", CC0) =================
   Same API as the classic SandyKit (create, apply, play, update, lookAt, getConfig, randomConfig, merge, DEFAULT,
   CATALOG …) so every game keeps working, but the body is one simple blocky character whose whole look is a skin
   texture (GRUG_AVATAR.skins), plus the classic hats (HATPACK, fitted to the new head).
   - Units: 1 unit = 1 cm, she stands ~185 cm tall on y = 0 and faces +z (her left is +x), like the classic Sandy.
   - The skeleton's joints carry the classic names (spine_M_00_jnt, arm_R_wrist_jnt, leg_L_knee_jnt, head_M_head_jnt …),
     so a game's own posing code finds them by name. Each joint has userData.rwq: its rest rotation in her own frame.
   - Classic avatar: a saved look with classic: true makes create() build the archived classic Sandy instead
     (assets/sandy-classic.js, loaded on demand) from the classic look kept in 'grug.sandy.classic.v1'. Only the
     player's own saved look can carry that flag (randomConfig never does), so bots and NPCs are always the new avatar.
   Built by tools/avatar/build.py into assets/sandy-runtime.js; never edit that file by hand. */
(function () {
  'use strict';
  const T = window.THREE, PACK = window.GRUG_AVATAR;
  if (!T || !PACK) return;
  const me = document.currentScript || Array.from(document.scripts).find(s => /sandy-runtime\.js(\?|$)/.test(s.src));
  const ASSETS = me && me.src ? me.src.replace(/[^/]*$/, '') : '';
  const KEY = 'grug.sandy.v1', CLASSIC_KEY = 'grug.sandy.classic.v1';
  const HEIGHT = 185;                       // cm, top of the head
  const clone = o => JSON.parse(JSON.stringify(o));
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  /* ---------------- the looks ---------------- */
  // body: which classic body a skin stands in for (games ask for {body: 'female'} bots); outfit: the skin's colours, roughly
  const SKINS = [
    { id: 'skaterMaleA', label: 'Skater', body: 'male', outfit: { shirt: '#ef5a42', shorts: '#1a5a84', belt: '#222222' }, swatch: '#ef5a42' },
    { id: 'skaterFemaleA', label: 'Rocker', body: 'female', outfit: { shirt: '#1f1f22', shorts: '#1f1f22', belt: '#888888' }, swatch: '#e8463c' },
    { id: 'cyborgFemaleA', label: 'Cyborg', body: 'female', outfit: { shirt: '#9fb4c8', shorts: '#2d5c8a', belt: '#222222' }, swatch: '#9fb4c8' },
    { id: 'criminalMaleA', label: 'Disco', body: 'male', outfit: { shirt: '#f4f4f4', shorts: '#f4f4f4', belt: '#1a9a7a' }, swatch: '#f4f4f4' }];
  const SKIN = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const HAT_DEF = { type: 'none', colour: '#ffffff', size: 1, up: 0, forward: 0, tilt: 0 };
  const HATS = {};
  (window.HATPACK && window.HATPACK.hats || []).forEach(h => HATS[h.id.replace(/^hat_/, '')] = h);
  // how each hat sits on the blocky head: scale on top of the head fit, and nudges (in the hats' own units)
  const HAT_FIT = {
    beanie: { s: 1, y: 0, z: 0 }, beret: { s: 1, y: 3, z: 0 }, bucketHat: { s: 1, y: 2.5, z: 0 }, cap: { s: 1, y: 5.7, z: 0 },
    cowboyHat: { s: 1, y: 2.2, z: 0 }, sunHat: { s: 1, y: 3.4, z: 0 }, topHat: { s: 1, y: 3, z: 0 }, witchHat: { s: 1, y: 3, z: 0 } };
  const EXPRESSIONS = ['neutral', 'smug', 'happy', 'laugh', 'curious', 'relaxed', 'pout', 'surprised', 'angry', 'wink'];
  // the face is painted on the skin, so an expression shows in how she holds her head: [nod (x), tilt (z)] in radians
  const EXPR_POSE = { pout: [0.3, 0.06], sad: [0.3, 0.06], angry: [0.14, 0], happy: [-0.08, 0.12], laugh: [-0.2, -0.06], surprised: [-0.12, 0], curious: [0.02, 0.2], smug: [-0.05, -0.08], wink: [0, 0.14] };
  // (build: the classic proportion sliders; a few games still read build.height)
  const DEFAULT = { model: 'block', skin: 'skaterMaleA', body: 'male', classic: false, expression: 'neutral', hat: clone(HAT_DEF), outfit: clone(SKINS[0].outfit), build: { height: 1 } };
  const skinOf = c => {
    if (c && SKIN[c.skin]) return c.skin;
    // a classic look (skin was a colour): stand in with the skater of that body
    return c && c.body === 'female' ? 'skaterFemaleA' : 'skaterMaleA';
  };
  function merge(base, patch) {
    const out = clone(base || {}); if (!patch) return out;
    for (const k in patch) { const v = patch[k]; if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') out[k] = Object.assign(out[k], clone(v)); else out[k] = v === undefined ? out[k] : clone(v); }
    return out;
  }
  // a look as the new avatar sees it (any classic fields are kept: they are harmless here)
  function normal(c) {
    c = merge(DEFAULT, c || {});
    c.model = 'block'; c.skin = skinOf(c); const S = SKIN[c.skin];
    c.body = S.body; c.outfit = Object.assign({}, S.outfit);
    c.hat = Object.assign({}, HAT_DEF, c.hat || {}); if (!HATS[c.hat.type]) c.hat.type = 'none';
    return c;
  }

  /* ---------------- the player's saved look (and the one-time move of a classic look) ----------------
     'grug.sandy.v1' holds the new look ({model: 'block', skin, hat, classic}). A look saved before Nov 2026 (no model) is
     the classic one: it moves to 'grug.sandy.classic.v1' and the player gets the new avatar in the skin of that body,
     wearing the same hat. Every reader of the look calls this first (games, the editor, grug.js, sandy-view.js). */
  function migrate() {
    const c = read(KEY);
    if (!c || typeof c !== 'object' || c.model === 'block') return c;
    if (!read(CLASSIC_KEY)) write(CLASSIC_KEY, c);
    const n = { model: 'block', skin: skinOf(c), classic: false, hat: Object.assign({}, HAT_DEF, c.hat || {}) };
    if (!HATS[n.hat.type]) n.hat.type = 'none';
    write(KEY, n);
    return n;
  }
  function player() { return normal(migrate() || {}); }

  /* ---------------- the model, decoded once ---------------- */
  const b64buf = s => { const b = atob(s.slice(s.indexOf(',') + 1)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  let BASE = null;
  function base() {
    if (BASE) return BASE;
    BASE = new Promise((ok, no) => new T.GLTFLoader().parse(b64buf(PACK.glb), '', g => {
      const root = g.scene; root.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(root), k = HEIGHT / (box.max.y - box.min.y);
      ok({ root, clips: Object.fromEntries(g.animations.map(a => [a.name, a])), scale: k, floor: box.min.y });
    }, no));
    return BASE;
  }
  // a skinned copy that shares geometry (SkeletonUtils.clone, condensed)
  function cloneSkinned(src) {
    const out = src.clone(true), sm = new Map(), cm = new Map();
    const walk = (a, b, f) => { f(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i], f); };
    walk(src, out, (a, b) => { sm.set(b, a); cm.set(a, b); });
    out.traverse(o => { if (!o.isSkinnedMesh) return; const s = sm.get(o), sk = s.skeleton; o.skeleton = sk.clone(); o.bindMatrix.copy(s.bindMatrix); o.skeleton.bones = sk.bones.map(b => cm.get(b)); o.bind(o.skeleton, o.bindMatrix); });
    return out;
  }
  const MATS = {}, TEX = {};
  function skinMaterial(id) {
    if (MATS[id]) return MATS[id];
    const t = TEX[id] = loadTex(PACK.skins[id]);
    return (MATS[id] = new T.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 }));
  }
  // textures load by themselves; pictures wait for every one asked for so far (skinReady)
  const PENDING = new Set();
  function loadTex(src) {
    let done; const p = new Promise(ok => { done = ok; setTimeout(ok, 4000); }); PENDING.add(p); p.then(() => PENDING.delete(p));
    const t = new T.TextureLoader().load(src, () => done(), undefined, () => done()); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const skinReady = () => Promise.all(Array.from(PENDING));
  let HAT_TEX = null;
  function hatGeometry(h) {
    if (h._g) return h._g;
    const b = x => { const r = atob(x), u = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u.buffer; };
    const P = new Float32Array(b(h.pos)), N8 = new Int8Array(b(h.nrm)), U = new Uint16Array(b(h.uv)), I = new Uint16Array(b(h.idx)), N = new Float32Array(N8.length), UV = new Float32Array(U.length);
    for (let i = 0; i < N8.length; i++) N[i] = N8[i] / 127; for (let i = 0; i < U.length; i++) UV[i] = U[i] / 65535;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2)); g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere();
    return (h._g = g);
  }

  /* ---------------- animation ---------------- */
  // Layers of extra joint turns on top of the base clip (the classic emotes, same numbers). R(joint, axis, angle) with the
  // axis in her own frame (x: her left, y: up, z: forward); may return {lift: cm}.
  const ANIMS = {
    idle: null, walk: null, run: null, leap: null,
    // a looping hop (the Hop emote, and a quick reaction): crouch, spring, airborne, land, recover
    jump: (t, R) => { const p = (t % 1.5) / 1.5, sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
      const crouch = sm(0, 0.25, p) * (1 - sm(0.28, 0.36, p)) + sm(0.72, 0.8, p) * (1 - sm(0.85, 1, p)), air = p > 0.34 && p < 0.76 ? Math.sin(Math.PI * (p - 0.34) / 0.42) : 0;
      for (const S of ['L', 'R']) { R(`leg_${S}_upr_jnt`, 'x', -0.75 * crouch - 0.25 * air); R(`leg_${S}_knee_jnt`, 'x', 1.4 * crouch + 0.45 * air); R(`leg_${S}_foot_jnt`, 'x', -0.6 * crouch - 0.2 * air); }
      R('spine_M_01_jnt', 'x', 0.35 * crouch); R('arm_L_shldr_jnt', 'z', 1.9 * air); R('arm_R_shldr_jnt', 'z', -1.9 * air); R('arm_L_shldr_jnt', 'x', 0.5 * crouch); R('arm_R_shldr_jnt', 'x', 0.5 * crouch);
      return { lift: -crouch * 11 + air * 26 }; },
    wave: (t, R) => { const k = Math.min(1, t / 0.5), e = k * k * (3 - 2 * k), w = Math.sin(t * Math.PI * 2 * 1.4);
      R('arm_R_shldr_jnt', 'z', -1.95 * e); R('arm_R_shldr_jnt', 'x', -0.35 * e); R('arm_R_elbow_jnt', 'z', (-0.35 + 0.45 * w) * e);
      R('head_M_head_jnt', 'z', -0.08 * e); R('spine_M_03_jnt', 'z', 0.05 * e); return null; },
    dance: (t, R) => { const w = t * Math.PI * 2 * 1.1, s = Math.sin(w), s2 = Math.sin(w * 2);
      R('spine_M_00_jnt', 'z', 0.12 * s); R('spine_M_03_jnt', 'z', -0.16 * s); R('head_M_head_jnt', 'z', 0.1 * s);
      R('arm_L_shldr_jnt', 'z', 1.2 + 0.6 * Math.max(0, s)); R('arm_R_shldr_jnt', 'z', -1.2 - 0.6 * Math.max(0, -s)); R('arm_L_elbow_jnt', 'z', 0.9); R('arm_R_elbow_jnt', 'z', -0.9);
      for (const [S, g] of [['L', 1], ['R', -1]]) { const b = Math.max(0, g * s); R(`leg_${S}_upr_jnt`, 'x', -0.3 * b); R(`leg_${S}_knee_jnt`, 'x', 0.6 * b); }
      return { lift: -2.5 * Math.abs(s2) }; },
    disco: (t, R) => { const w = t * Math.PI * 2, s = Math.sin(w), up = Math.max(0, s), dn = Math.max(0, -s);
      R('arm_R_shldr_jnt', 'z', -(0.5 + 2.5 * up)); R('arm_R_shldr_jnt', 'x', -0.25 * up); R('arm_R_elbow_jnt', 'z', -0.15 - 0.5 * dn);
      R('arm_L_shldr_jnt', 'z', 0.5 + 2.5 * dn); R('arm_L_shldr_jnt', 'x', -0.25 * dn); R('arm_L_elbow_jnt', 'z', 0.15 + 0.5 * up);
      R('spine_M_00_jnt', 'z', 0.16 * s); R('spine_M_03_jnt', 'z', -0.12 * s); R('head_M_head_jnt', 'z', -0.12 * s); R('head_M_head_jnt', 'x', -0.15 * Math.abs(s));
      for (const [S, g] of [['L', 1], ['R', -1]]) { const b = Math.max(0, g * s); R(`leg_${S}_upr_jnt`, 'x', -0.2 * b); R(`leg_${S}_knee_jnt`, 'x', 0.45 * b); }
      return { lift: -3 * Math.abs(Math.sin(w * 2)) }; },
    shuffle: (t, R) => { const w = t * Math.PI * 2 * 1.7, s = Math.sin(w), c = Math.cos(w);
      R('leg_L_upr_jnt', 'x', -0.55 * Math.max(0, s) + 0.15 * Math.max(0, -s)); R('leg_R_upr_jnt', 'x', -0.55 * Math.max(0, -s) + 0.15 * Math.max(0, s));
      R('leg_L_knee_jnt', 'x', 0.9 * Math.max(0, s) + 0.1); R('leg_R_knee_jnt', 'x', 0.9 * Math.max(0, -s) + 0.1);
      R('leg_L_foot_jnt', 'x', -0.3 * Math.max(0, s)); R('leg_R_foot_jnt', 'x', -0.3 * Math.max(0, -s));
      R('arm_L_shldr_jnt', 'x', -0.55 * s); R('arm_R_shldr_jnt', 'x', 0.55 * s); R('arm_L_elbow_jnt', 'z', 0.95); R('arm_R_elbow_jnt', 'z', -0.95);
      R('spine_M_01_jnt', 'x', 0.14); R('spine_M_03_jnt', 'y', 0.08 * s); R('head_M_head_jnt', 'x', -0.1);
      return { lift: -5 * Math.abs(c) }; },
    robot: (t, R) => { const step = Math.floor(t * 2.4), f = t * 2.4 - step, k = Math.min(1, f / 0.18), e = k * k * (3 - 2 * k), q = step % 4, q0 = (step + 3) % 4;
      const P = [[1.3, -1.3, 1.5, -1.5, 0.35, 0], [1.3, -1.3, 0.3, -1.5, -0.35, -0.5], [1.3, -1.3, 1.5, -0.3, 0.35, 0.5], [0.4, -0.4, 1.5, -1.5, -0.35, 0]];
      const a = P[q0], b = P[q], m = i => a[i] + (b[i] - a[i]) * e;
      R('arm_L_shldr_jnt', 'z', m(0)); R('arm_R_shldr_jnt', 'z', m(1)); R('arm_L_elbow_jnt', 'z', m(2)); R('arm_R_elbow_jnt', 'z', m(3));
      R('spine_M_03_jnt', 'y', m(4) * 0.4); R('head_M_head_jnt', 'y', m(5)); R('head_M_head_jnt', 'x', 0.08 * Math.sin(t * 9));
      R('leg_L_knee_jnt', 'x', 0.12); R('leg_R_knee_jnt', 'x', 0.12); return { lift: -1.2 * e }; },
    cheer: (t, R) => { const w = t * Math.PI * 2 * 2.0, p = Math.max(0, Math.sin(w)), s = Math.sin(w);
      R('arm_L_shldr_jnt', 'z', 2.55 + 0.25 * s); R('arm_R_shldr_jnt', 'z', -2.55 + 0.25 * s); R('arm_L_shldr_jnt', 'x', -0.2 + 0.25 * p); R('arm_R_shldr_jnt', 'x', -0.2 + 0.25 * p);
      R('arm_L_elbow_jnt', 'z', 0.35); R('arm_R_elbow_jnt', 'z', -0.35); R('spine_M_01_jnt', 'x', -0.08); R('head_M_head_jnt', 'x', -0.22);
      for (const S of ['L', 'R']) R(`leg_${S}_knee_jnt`, 'x', 0.25 * (1 - p));
      return { lift: -2 + 7 * p }; },
    bow: (t, R) => { const c = t % 2.6, sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }, e = sm(c / 0.55) * (1 - sm((c - 1.55) / 0.55));
      R('spine_M_01_jnt', 'x', 0.55 * e); R('spine_M_03_jnt', 'x', 0.35 * e); R('head_M_head_jnt', 'x', 0.25 * e);
      R('arm_R_shldr_jnt', 'x', -0.9 * e); R('arm_R_shldr_jnt', 'z', -0.25 * e); R('arm_R_elbow_jnt', 'z', -1.6 * e);
      R('arm_L_shldr_jnt', 'x', 0.5 * e); R('arm_L_shldr_jnt', 'z', 0.35 * e); return { lift: -1.5 * e }; },
    flex: (t, R) => { const w = t * Math.PI * 2 * 1.4, p = 0.5 + 0.5 * Math.sin(w);
      R('arm_L_shldr_jnt', 'z', 1.5); R('arm_R_shldr_jnt', 'z', -1.5); R('arm_L_shldr_jnt', 'x', -0.35); R('arm_R_shldr_jnt', 'x', -0.35);
      R('arm_L_elbow_jnt', 'z', 2.0 + 0.25 * p); R('arm_R_elbow_jnt', 'z', -2.0 - 0.25 * p);
      R('spine_M_03_jnt', 'z', 0.06 * Math.sin(w * 0.5)); R('spine_M_01_jnt', 'x', -0.06); R('head_M_head_jnt', 'x', -0.1); R('head_M_head_jnt', 'y', 0.25 * Math.sin(w * 0.5));
      for (const S of ['L', 'R']) R(`leg_${S}_knee_jnt`, 'x', 0.1 + 0.08 * p);
      return { lift: -1.5 * p }; } };
  // which base clip each animation stands on, and how: [clip, timeScale, weight (the rest is idle)]
  // (leap: Kenney's own jump clip, played once and held: for a game that wants the airborne pose)
  const BASE_CLIP = { walk: ['run', 0.78, 0.5], run: ['run', 1, 1], leap: ['jump', 1, 1] };
  const AX = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _v = new T.Vector3(), _v2 = new T.Vector3(), _m = new T.Matrix4();
  const depth = b => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };

  // one clip on one avatar: an interpolant per track; blend(t, f) moves each joint f of the way to the clip's pose
  // (f = 1 for the first clip of the frame, which sets every joint outright)
  class Sampler {
    constructor(clip, bones) {
      this.dur = clip.duration;
      this.tracks = clip.tracks.map(t => { const [bn, prop] = t.name.split('.'); const bone = bones[bn]; return bone ? { bone, prop, it: t.createInterpolant() } : null; }).filter(Boolean);
    }
    blend(t, f) {
      for (const k of this.tracks) {
        const r = k.it.evaluate(t);
        if (k.prop === 'quaternion') { _q3.fromArray(r); if (f >= 1) k.bone.quaternion.copy(_q3); else k.bone.quaternion.slerp(_q3, f); }
        else if (k.prop === 'position') { _v3.fromArray(r); if (f >= 1) k.bone.position.copy(_v3); else k.bone.position.lerp(_v3, f); }
      }
    }
  }
  const _q3 = new T.Quaternion(), _v3 = new T.Vector3();
  let SERIAL = 0;
  class Avatar {
    constructor(B, cfg) {
      this.isBlockAvatar = true; this.i = SERIAL++;
      const G = this.object3d = new T.Group(); G.name = 'Sandy';
      const inner = this._inner = cloneSkinned(B.root); inner.name = 'avatar'; inner.scale.setScalar(B.scale); inner.position.y = -B.floor * B.scale;
      G.add(inner);
      this.mesh = null; inner.traverse(o => { if (o.isSkinnedMesh) { this.mesh = o; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.bones = {}; inner.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
      this.n3 = { root: inner, bones: this.bones };   // the classic rig's names, for tools that reach into it
      // rest rotations in her own frame (classic: bone.userData.rwq), measured in the bind pose
      G.updateMatrixWorld(true); const gi = G.getWorldQuaternion(new T.Quaternion()).invert();
      for (const b of Object.values(this.bones)) b.userData.rwq = b.getWorldQuaternion(new T.Quaternion()).premultiply(gi);
      this.head = this.bones.head_M_head_jnt;
      this._headFrame(B);
      // the base clips, sampled by hand and written to every joint every frame (so a game's own posing never piles up)
      this.clips = {}; for (const n of ['idle', 'run', 'jump']) this.clips[n] = new Sampler(B.clips[n], this.bones);
      this.w = { idle: 1, run: 0, jump: 0 }; this.ct = { idle: (this.i * 0.37) % 1, run: 0, jump: 0 }; this.ts = { idle: 1, run: 1, jump: 1 };
      this._anim = 'idle'; this._animT = 0; this._prevLayer = null; this._prevT = 0; this._mix = 1; this._t = performance.now();
      this.gaze = { yaw: 0, pitch: 0 }; this._gazeTarget = null;
      this.config = normal({});
      this.ready = Promise.resolve(this);
      this.apply(cfg || {}, true);
      this.update(0);
    }
    // the head: a frame on the head joint that turns with it but is level with her body at rest, and the head's size there
    _headFrame() {
      const hf = this._hf = new T.Group(); hf.name = 'headFrame'; this.head.add(hf);
      hf.quaternion.copy(this.head.userData.rwq).invert();
      // undo the joint's scale (the model is in its own units): the frame is in cm
      this.object3d.updateMatrixWorld(true);
      const ws = new T.Vector3(); this.head.getWorldScale(ws); hf.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
      this.object3d.updateMatrixWorld(true);
      // the head's box in that frame: every vertex the head joint mostly moves (bind pose)
      const m = this.mesh, g = m.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
      const hi = m.skeleton.bones.indexOf(this.head), inv = new T.Matrix4().copy(hf.matrixWorld).invert(), box = new T.Box3(), v = new T.Vector3();
      const C = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < P.count; i++) { let bi = 0, bw = 0; for (let j = 0; j < 4; j++) { const w = SW[C[j]](i); if (w > bw) { bw = w; bi = SI[C[j]](i); } } if (bi !== hi) continue; v.fromBufferAttribute(P, i); m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv); box.expandByPoint(v); }
      this.headBox = box;
      // head frame → the body's own geometry space, in the bind pose (for the hat cut below)
      this._hf2geo = new T.Matrix4().copy(m.matrixWorld).invert().multiply(hf.matrixWorld);
    }
    // under a hat, the top of the head above where the hat sits is not drawn, so nothing pokes through it (the hat covers it).
    // The cut is a plane in the body's bind pose, so it turns with the head. The material is this avatar's own while it wears one.
    _cut(plane) {
      const base = skinMaterial(this.config.skin);
      if (!plane) { if (this.mesh.material !== base) { this.mesh.material.dispose(); this.mesh.material = base; } return; }
      let mat = this.mesh.material;
      if (mat === base || mat.userData.skin !== this.config.skin) {
        if (mat !== base) mat.dispose();
        mat = base.clone(); mat.userData.skin = this.config.skin; const U = mat.userData.cutU = { value: new T.Vector4() };
        mat.onBeforeCompile = sh => { sh.uniforms.hatCut = U;
          sh.vertexShader = 'varying vec3 vBindPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;');
          sh.fragmentShader = 'uniform vec4 hatCut;varying vec3 vBindPos;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (dot(vBindPos, hatCut.xyz) > hatCut.w) discard;'); };
        mat.customProgramCacheKey = () => 'grug-hatcut';
        this.mesh.material = mat;
      }
      mat.userData.cutU.value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant * -1);
    }
    apply(patch, force) {
      patch = patch || {}; const old = this.config, c = this.config = normal(merge(old, patch)), ch = k => force || JSON.stringify(old[k]) !== JSON.stringify(c[k]);
      if (ch('skin') && (!this.mesh.material.userData.cutU)) this.mesh.material = skinMaterial(c.skin);
      if (ch('hat') || ch('skin')) this._hat(c.hat);
      return this;
    }
    _hat(h) {
      if (this.hatGroup) { this._hf.remove(this.hatGroup); this.hatGroup = null; }
      h = Object.assign({}, HAT_DEF, h || {}); const H = HATS[h.type]; if (!H) { this._cut(null); return; }
      if (!HAT_TEX) HAT_TEX = loadTex(window.HATPACK.tex);
      const F = HAT_FIT[h.type] || { s: 1, y: 0, z: 0 }, box = this.headBox;
      // The hats were made for a round head (their beanie fits it snugly): about 28 units wide, 28.6 deep and centred at
      // z 2.5, with its crown at y 26. Map that head onto this one's box (wider than tall, and deeper still), a little
      // roomy so nothing of the head shows through, then each hat's own nudge (HAT_FIT).
      const kx = (box.max.x - box.min.x) / 28 * 1.06 * F.s, kz = (box.max.z - box.min.z) / 28.6 * 1.06 * F.s, ky = 1.3 * F.s * (F.sy || 1);
      const mat = new T.MeshStandardMaterial({ map: HAT_TEX, color: new T.Color(h.colour || '#ffffff').convertSRGBToLinear(), roughness: 0.8, metalness: 0, side: T.DoubleSide });
      const seat = new T.Vector3(...H.seat), g = new T.Group(), m = new T.Mesh(hatGeometry(H), mat);
      m.name = 'hat'; m.castShadow = true; m.frustumCulled = false; m.position.copy(seat).negate(); g.add(m);
      g.position.copy(seat).add(new T.Vector3(0, +h.up || 0, +h.forward || 0)); g.rotation.x = +h.tilt || 0; g.scale.setScalar(Math.min(1.6, Math.max(0.6, +h.size || 1)));
      const fit = new T.Group(); fit.add(g); fit.scale.set(kx, ky, kz);
      fit.position.set((box.min.x + box.max.x) / 2, box.max.y + 1.5 - (26 - F.y) * ky, (box.min.z + box.max.z) / 2 - (2.5 - F.z) * kz);
      this._hf.add(fit); this.hatGroup = fit;
      // the cut: where the hat sits (its seat), in the head frame, then in the body's bind pose
      fit.updateMatrix(); g.updateMatrix(); m.updateMatrix();
      const toHead = new T.Matrix4().multiplyMatrices(fit.matrix, g.matrix).multiply(m.matrix);
      const pl = new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(0, 1, 0), new T.Vector3(0, H.seat[1] + (F.cut || 0), H.seat[2]));
      pl.applyMatrix4(toHead).applyMatrix4(this._hf2geo);
      this._cut(pl);
    }
    // 'idle', 'walk', 'run', 'jump', 'wave', 'dance' or an emote (CATALOG.animations); returns this
    play(name) {
      name = Object.prototype.hasOwnProperty.call(ANIMS, name) ? name : 'idle';
      if (name === this._anim) return this;
      const prev = this._anim; this._anim = name; this._animT = 0;
      this._prevLayer = ANIMS[prev] ? prev : null; this._prevT = this._layerT || 0; this._mix = 0;
      const bc = BASE_CLIP[name];
      this.target = bc ? { idle: 1 - bc[2], run: bc[0] === 'run' ? bc[2] : 0, jump: bc[0] === 'jump' ? bc[2] : 0 } : { idle: 1, run: 0, jump: 0 };
      if (bc) { this.ts[bc[0]] = bc[1]; if (bc[0] === 'jump' || this.w[bc[0]] < 0.05) this.ct[bc[0]] = 0; }
      return this;
    }
    get animation() { return this._anim; }
    getConfig() { return clone(this.config); }
    setExpression(name) { this.config.expression = name; return this; }   // the face is painted on the skin: nothing to change yet
    lookAt(p) { this._gazeTarget = p ? (this._gazeTarget || new T.Vector3()).copy(p) : null; return this; }
    update(dt) {
      const now = performance.now(); if (dt == null) dt = Math.min(0.05, (now - this._t) / 1000); this._t = now;
      this._animT += dt; this._mix = Math.min(1, this._mix + dt * 3);
      this._base(dt);
      // emote layer (the outgoing one fades as the new one comes in)
      let lift = 0; const cur = ANIMS[this._anim];
      if (cur) { this._layerT = this._animT; lift += this._layer(cur, this._animT, this._mix); }
      if (this._prevLayer && this._mix < 1) { this._prevT += dt; lift += this._layer(ANIMS[this._prevLayer], this._prevT, 1 - this._mix); }
      this._inner.position.y = this._baseY() + lift;
      this._look(dt);
      return this;
    }
    // the base clips: fade the weights toward the target (a fifth of a second), then sample and blend every joint
    _base(dt) {
      const tg = this.target || { idle: 1, run: 0, jump: 0 }, k = Math.min(1, dt / 0.2), C = this.clips;
      for (const n in this.w) { this.w[n] += (tg[n] - this.w[n]) * k; if (this.w[n] < 1e-3) this.w[n] = 0; }
      for (const n in C) { if (!this.w[n] && n !== 'idle') continue; const d = C[n].dur; this.ct[n] += dt * this.ts[n]; if (n === 'jump') this.ct[n] = Math.min(this.ct[n], d - 1e-4); else this.ct[n] %= d; }
      let acc = 0;
      for (const n of ['idle', 'run', 'jump']) { const w = this.w[n]; if (w <= 0) continue; C[n].blend(this.ct[n], acc === 0 ? 1 : w / (acc + w)); acc += w; }
    }
    _baseY() { return this._by != null ? this._by : (this._by = this._inner.position.y); }
    _layer(f, t, wgt) {
      if (!f || wgt <= 0) return 0;
      const B = this.bones, turns = [];
      const R = (n, axis, a) => { const bn = B[n]; if (bn && a) turns.push([bn, axis, a * wgt]); };
      const out = f(t, R) || {};
      turns.sort((a, b) => depth(a[0]) - depth(b[0]));
      this.object3d.updateMatrixWorld(true); const rootQ = this.object3d.getWorldQuaternion(_q2);
      for (const [bn, axis, a] of turns) { bn.parent.updateMatrixWorld(true); _v.copy(AX[axis]).applyQuaternion(rootQ).applyQuaternion(bn.parent.getWorldQuaternion(_q).invert()); bn.quaternion.premultiply(_q.setFromAxisAngle(_v.normalize(), a)); bn.updateMatrixWorld(true); }
      return (out.lift || 0) * wgt;
    }
    _look(dt) {
      const g = this.gaze, h = this.head; let ty = 0, tp = 0;
      const E = EXPR_POSE[this.config.expression] || [0, 0], ke = Math.min(1, dt * 5); g.ex = (g.ex || 0) + (E[0] - (g.ex || 0)) * ke; g.ez = (g.ez || 0) + (E[1] - (g.ez || 0)) * ke;
      if (this._gazeTarget) {
        this.object3d.updateMatrixWorld(true); h.updateMatrixWorld(true);
        const hp = h.getWorldPosition(_v2), inv = _m.copy(this.object3d.matrixWorld).invert();
        const d = _v.copy(this._gazeTarget).applyMatrix4(inv).sub(hp.applyMatrix4(inv));
        ty = Math.max(-1.0, Math.min(1.0, Math.atan2(d.x, d.z))); tp = Math.max(-0.45, Math.min(0.45, Math.atan2(-d.y, Math.hypot(d.x, d.z))));
        if (d.z < -10 && Math.abs(Math.atan2(d.x, d.z)) > 1.6) { ty = 0; tp = 0; }   // behind her: don't twist round
      }
      const k = Math.min(1, dt * 6); g.yaw += (ty - g.yaw) * k; g.pitch += (tp - g.pitch) * k;
      if (Math.abs(g.yaw) < 1e-4 && Math.abs(g.pitch + g.ex) < 1e-4 && Math.abs(g.ez) < 1e-4) return;
      const rootQ = this.object3d.getWorldQuaternion(_q2);
      for (const [axis, a] of [['y', g.yaw], ['x', g.pitch + g.ex], ['z', g.ez]]) { if (!a) continue; h.parent.updateMatrixWorld(true); _v.copy(AX[axis]).applyQuaternion(rootQ).applyQuaternion(h.parent.getWorldQuaternion(_q).invert()); h.quaternion.premultiply(_q.setFromAxisAngle(_v.normalize(), a)); }
      h.updateMatrixWorld(true);
    }
    dispose() { this.object3d.parent && this.object3d.parent.remove(this.object3d); if (this.hatGroup) this.hatGroup.traverse(o => { if (o.material) o.material.dispose(); }); }
  }
  function build(cfg) { return base().then(B => new Avatar(B, cfg)); }

  /* ---------------- the archived classic avatar (the player only, opt in) ---------------- */
  let CK = null;
  function loadClassic() {
    if (window.SandyClassicKit) return Promise.resolve(window.SandyClassicKit);
    if (CK) return CK;
    CK = new Promise((ok, no) => { const s = document.createElement('script'); s.src = ASSETS + 'sandy-classic.js'; s.onload = () => window.SandyClassicKit ? ok(window.SandyClassicKit) : no(new Error('no classic kit')); s.onerror = () => { CK = null; no(new Error('classic avatar failed to load')); }; document.head.appendChild(s); });
    return CK;
  }
  function classicLook() { const c = read(CLASSIC_KEY); return c && typeof c === 'object' ? c : {}; }
  function create(cfg) {
    if (cfg && cfg.classic === true) {
      return loadClassic().then(K => K.create(K.merge(K.DEFAULT, classicLook()))).then(s => { s.isClassic = true; return s; })
        .catch(e => { console.warn('SandyKit: classic avatar unavailable, using the new one', e); return build(cfg); });
    }
    return build(cfg);
  }

  /* ---------------- random looks (bots, NPCs) ---------------- */
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function randomConfig(seed, opts) {
    const r = seed == null ? Math.random : mulberry(typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7));
    // every look is for everyone: a {body} asked for (the classic avatar's bodies) only matters with {strict: true}
    const want = opts && opts.strict && opts.body, L = SKINS.filter(s => !want || s.body === (want === 'male' ? 'male' : 'female'));
    const s = L[Math.floor(r() * L.length)] || SKINS[0];
    return normal({ skin: s.id, expression: 'neutral', hat: clone(HAT_DEF) });
  }

  const CATALOG = {
    skins: SKINS.map(s => ({ id: s.id, label: s.label, body: s.body, swatch: s.swatch, picture: ASSETS + 'avatar/skins/' + s.id + '.png' })),
    bodies: ['female', 'male'], hairStyles: [], skinTones: [], nailColours: [], neutrals: [], textures: [],
    expressions: EXPRESSIONS.slice(),
    parts: { top: [], legs: [], feet: [], shoulderL: [], shoulderR: [] }, slots: {}, weapons: [],
    animations: Object.keys(ANIMS),
    hats: Object.values(HATS).map(h => ({ id: h.id.replace(/^hat_/, ''), label: h.label, wearer: 'u' }))
  };
  const ready = () => skinReady().then(() => window.SandyClassicKit && window.SandyClassicKit.customReady ? window.SandyClassicKit.customReady() : null);
  window.SandyKit = {
    version: '2.0.0', model: 'block', HEIGHT, KEY, CLASSIC_KEY, CATALOG, DEFAULT: clone(DEFAULT),
    create, randomConfig, merge, normal, migrate, player, loadClassic, classicLook,
    texturesFor: () => [],
    // pictures wait on these: the skin textures (and, for a classic player, the classic kit's own)
    customReady: ready, decalReady: ready,
    encode: cfg => btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    decode: s => JSON.parse(decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))))),
    loadCharacter: src => (typeof src === 'string' && !/^\s*\{/.test(src) ? fetch(src).then(r => r.json()) : Promise.resolve(typeof src === 'string' ? JSON.parse(src) : src)).then(c => { const n = c.name; return build(c).then(a => { a.name = n; return a; }); }),
    readme: () => ''
  };
  migrate();
})();
