/* Grug · sandy-view.js — the new 3D avatar (Sandy) for the rest of the site.
   The look is saved on the phone by the avatar editor (localStorage 'grug.sandy.v1').
   Pictures of it are cached in 'grug.sandy.snaps.v1' so pages can show the avatar without loading the 3D runtime;
   grug.js serves those through Grug.snaps(). Pages that want her in 3D call SandyView.load() first (15 MB, cached).

   SandyView.config()            the saved look (or null)
   SandyView.load()              Promise: loads assets/sandy-runtime.js once (THREE r149 + SandyKit)
   SandyView.snaps()             cached pictures {bust, full, happy, sad, cheer} of the saved look, or the defaults
   SandyView.makeSnaps(cfg, o)   Promise: renders and caches the pictures (call after the look changes); o = {step, cancelled}
   SandyView.DEFAULT_SNAPS       picture URLs of the default look, shipped in assets/sandy/ */
(function (root) {
  'use strict';
  const KEY = 'grug.sandy.v1', SNAP_KEY = 'grug.sandy.snaps.v1';
  const me = document.currentScript || Array.from(document.scripts).find(s => /sandy-view\.js(\?|$)/.test(s.src));
  const ASSETS = me ? me.src.replace(/sandy-view\.js.*$/, '') : '';
  const DEF = ASSETS + 'sandy/';
  const DEFAULT_SNAPS = { def: true, bust: DEF + 'bust.png', full: DEF + 'full.png', happy: DEF + 'happy.png', sad: DEF + 'sad.png', cheer: DEF + 'cheer.png' };
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const hash = (o) => { const s = JSON.stringify(o || null); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

  function config() { const c = read(KEY); return c && typeof c === 'object' ? c : null; }
  function snaps() { const s = read(SNAP_KEY), c = config(); return s && s.bust && (!c || s.hash === hash(c)) ? s : DEFAULT_SNAPS; }

  let loading = null;
  function load() {
    if (root.SandyKit) return Promise.resolve(root.SandyKit);
    if (loading) return loading;
    loading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = ASSETS + 'sandy-runtime.js'; s.onload = () => root.SandyKit ? ok(root.SandyKit) : no(new Error('SandyKit missing')); s.onerror = no; document.head.appendChild(s); });
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
  const FRAMES = {
    bust: { w: 192, h: 192, t: [0, 174, 0], d: 168, yaw: 0.3, pitch: 0.04 },
    full: { w: 300, h: 420, t: [0, 102, 0], d: 470, yaw: 0.35, pitch: 0.05 },
    shirt: { w: 240, h: 240, t: [0, 122, 0], d: 250, yaw: 0.3, pitch: 0.06 },   // closet tiles
    pants: { w: 240, h: 240, t: [0, 68, 0], d: 300, yaw: 0.3, pitch: 0.06 }
  };
  async function picture(cfg, frame, o) {
    const r = await rig(), F = FRAMES[frame], c = r.K.merge(r.K.DEFAULT, cfg || {});
    if (o && o.expression) c.expression = o.expression;
    if (!r.sandy) { r.sandy = await r.K.create(c); r.scene.add(r.sandy.object3d); } else { r.sandy.apply(c, true); if (r.sandy.ready) await r.sandy.ready; }
    if (r.K.customReady) await r.K.customReady();   // custom clothing templates still loading
    if (r.K.decalReady) await r.K.decalReady();     // chest print images still loading
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

  root.SandyView = { KEY, SNAP_KEY, ASSETS, DEFAULT_SNAPS, config, snaps, load, makeSnaps, picture, hash };
})(window);
