/* Grug · sandy-view.js — the 3D avatar for the rest of the site.
   The look is saved on the phone by the avatar editor (localStorage 'grug.sandy.v1': {model: 'block', skin, hat, classic}).
   With classic: true the player's pictures are of the archived classic avatar (its look is in 'grug.sandy.classic.v1').
   Pictures of it are cached in 'grug.sandy.snaps.v1' so pages can show the avatar without loading the 3D runtime;
   grug.js serves those through Grug.snaps(). Pages that want her in 3D call SandyView.load() first (15 MB, cached).

   SandyView.config()            the saved look (or null)
   SandyView.load()              Promise: loads assets/sandy-runtime.js once (THREE r149 + SandyKit, ~1.7 MB)
   SandyView.snaps()             cached pictures {bust, full, happy, sad, cheer} of the saved look, or the defaults
   SandyView.makeSnaps(cfg, o)   Promise: renders and caches the pictures (call after the look changes); o = {step, cancelled}
   SandyView.DEFAULT_SNAPS       picture URLs of the default look, shipped in assets/sandy/ */
(function (root) {
  'use strict';
  const KEY = 'grug.sandy.v1', SNAP_KEY = 'grug.sandy.snaps.v1';
  const me = document.currentScript || Array.from(document.scripts).find(s => /sandy-view\.js(\?|$)/.test(s.src));
  const ASSETS = me ? me.src.replace(/sandy-view\.js.*$/, '') : '';
  const DEF = ASSETS + 'sandy/';
  const DEFAULT_SNAPS = { def: true, bust: DEF + 'bust.png?v=av2', full: DEF + 'full.png?v=av2', happy: DEF + 'happy.png?v=av2', sad: DEF + 'sad.png?v=av2', cheer: DEF + 'cheer.png?v=av2' };
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const CLASSIC_KEY = 'grug.sandy.classic.v1';
  const hash = (o) => { const s = JSON.stringify(o || null); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

  // a look saved before the blocky avatar (no model) is the classic one: it moves to CLASSIC_KEY and the player gets the
  // new avatar in the skin of that body, with the same hat (the runtime does the same: SandyKit.migrate)
  function config() {
    const c = read(KEY); if (!c || typeof c !== 'object') return null;
    if (c.model === 'block') return c;
    if (!read(CLASSIC_KEY)) write(CLASSIC_KEY, c);
    const n = { model: 'block', skin: c.body === 'female' ? 'skaterFemaleA' : 'skaterMaleA', classic: false, hat: Object.assign({ type: 'none', colour: '#ffffff', size: 1, up: 0, forward: 0, tilt: 0 }, c.hat || {}) };
    write(KEY, n); return n;
  }
  function snaps() { const s = read(SNAP_KEY), c = config(); return s && s.bust && (!c || s.hash === hash(c)) ? s : DEFAULT_SNAPS; }

  let loading = null;
  function load() {
    if (root.SandyKit) return Promise.resolve(root.SandyKit);
    if (loading) return loading;
    loading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = ASSETS + 'sandy-runtime.js?v=av2'; s.onload = () => root.SandyKit ? ok(root.SandyKit) : no(new Error('SandyKit missing')); s.onerror = no; document.head.appendChild(s); });
    return loading;
  }

  /* one offscreen renderer and one Sandy, re-dressed for each picture */
  let R = null;
  async function rig() {
    if (R) return R;
    const K = await load(), T = root.THREE;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputEncoding = T.sRGBEncoding; renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, 5, 5000);
    scene.add(new T.HemisphereLight(0xfff4e0, 0x3a3456, 0.8));
    const key = new T.DirectionalLight(0xfff0dc, 1.05); key.position.set(160, 320, 240); scene.add(key);
    const rim = new T.DirectionalLight(0x9fc4ff, 0.5); rim.position.set(-200, 180, -260); scene.add(rim);
    const fill = new T.DirectionalLight(0xffd6b0, 0.3); fill.position.set(-260, 80, 180); scene.add(fill);
    R = { K, T, renderer, scene, cam, sandy: null };
    return R;
  }
  // where the camera looks for each picture: the blocky avatar (185 cm, a big head) and the classic one
  const FRAMES = {
    bust: { w: 192, h: 192, t: [0, 150, 0], d: 235, yaw: 0.3, pitch: 0.04 },
    full: { w: 300, h: 420, t: [0, 100, 0], d: 500, yaw: 0.35, pitch: 0.05 },
    shirt: { w: 240, h: 240, t: [0, 95, 0], d: 260, yaw: 0.3, pitch: 0.06 },
    pants: { w: 240, h: 240, t: [0, 45, 0], d: 280, yaw: 0.3, pitch: 0.06 },
    hat: { w: 192, h: 192, t: [0, 170, 0], d: 255, yaw: 0.45, pitch: 0.1 }   // hat tiles (the editor)
  };
  const FRAMES_CLASSIC = {
    bust: { w: 192, h: 192, t: [0, 174, 0], d: 168, yaw: 0.3, pitch: 0.04 },
    full: { w: 300, h: 420, t: [0, 102, 0], d: 470, yaw: 0.35, pitch: 0.05 },
    shirt: { w: 240, h: 240, t: [0, 122, 0], d: 250, yaw: 0.3, pitch: 0.06 },   // closet tiles
    pants: { w: 240, h: 240, t: [0, 68, 0], d: 300, yaw: 0.3, pitch: 0.06 }
  };
  async function picture(cfg, frame, o) {
    const r = await rig(), c = r.K.merge(r.K.DEFAULT, cfg || {}), classic = c.classic === true;
    if (o && o.expression) c.expression = o.expression;
    // classic: the archived Sandy in the classic look (create() builds it), re-dressed in that look for each picture
    if (r.sandy && !!r.sandy.isClassic !== classic) { r.scene.remove(r.sandy.object3d); try { r.sandy.dispose(); } catch (e) {} r.sandy = null; }
    if (!r.sandy) { r.sandy = await r.K.create(c); r.scene.add(r.sandy.object3d); }
    else if (r.sandy.isClassic) { const CK = root.SandyClassicKit, cc = CK.merge(CK.DEFAULT, r.K.classicLook()); if (o && o.expression) cc.expression = o.expression; r.sandy.apply(cc, true); if (r.sandy.ready) await r.sandy.ready; }
    else r.sandy.apply(c, true);
    const F = (r.sandy.isClassic ? FRAMES_CLASSIC : FRAMES)[frame];
    if (r.K.customReady) await r.K.customReady();   // skin textures (and classic clothing templates) still loading
    if (r.K.decalReady) await r.K.decalReady();
    // the classic male body's face is a picture that loads by itself: wait for it (up to 2 s), or the first shot of him has no face
    if (r.sandy.isClassic && typeof root.faceTexture === 'function') { const t = root.faceTexture('male'); for (let k = 0; k < 80 && t && !t.image; k++) await new Promise(ok => setTimeout(ok, 25)); }
    r.sandy.play((o && o.anim) || 'idle');
    for (let i = 0; i < 40; i++) r.sandy.update(((o && o.animT) || 0.6) / 40);   // settle the pose
    r.renderer.setSize(F.w, F.h, false); r.cam.aspect = F.w / F.h; r.cam.updateProjectionMatrix();
    const T = r.T, tg = new T.Vector3(...F.t), yaw = o && o.yaw != null ? o.yaw : F.yaw;
    r.cam.position.set(tg.x + Math.sin(yaw) * Math.cos(F.pitch) * F.d, tg.y + Math.sin(F.pitch) * F.d, tg.z + Math.cos(yaw) * Math.cos(F.pitch) * F.d); r.cam.lookAt(tg);
    r.renderer.render(r.scene, r.cam);
    return r.renderer.domElement.toDataURL('image/png');
  }
  // o.step: give the page a moment between pictures (so taps and slider drags aren't blocked for the whole set)
  // o.cancelled(): return true to stop early (the look changed again); nothing is saved then and it resolves to null
  const breather = () => new Promise(ok => (root.requestIdleCallback ? root.requestIdleCallback(() => ok(), { timeout: 400 }) : setTimeout(ok, 30)));
  async function makeSnaps(cfg, o) {
    cfg = cfg || config() || {}; o = o || {};
    const shots = [['bust', 'bust'], ['full', 'full'], ['happy', 'bust', { expression: 'happy' }], ['sad', 'bust', { expression: 'pout' }], ['cheer', 'full', { expression: 'laugh', anim: 'wave', animT: 0.7 }]];
    const s = { hash: hash(cfg), at: Date.now() };
    for (const [k, frame, opt] of shots) {
      if (o.step) await breather();
      if (o.cancelled && o.cancelled()) return null;
      s[k] = await picture(cfg, frame, opt);
    }
    if (o.cancelled && o.cancelled()) return null;
    write(SNAP_KEY, s);
    try { root.dispatchEvent(new CustomEvent('grug-sandy-snaps', { detail: s })); } catch (e) {}
    return s;
  }
  root.addEventListener('storage', e => { if (e.key === SNAP_KEY) try { root.dispatchEvent(new CustomEvent('grug-sandy-snaps', { detail: snaps() })); } catch (x) {} });

  root.SandyView = { KEY, SNAP_KEY, CLASSIC_KEY, ASSETS, DEFAULT_SNAPS, config, snaps, load, makeSnaps, picture, hash };
})(window);
