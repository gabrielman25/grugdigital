// Grug Arcade: "480p YouTube mode", a just-for-fun setting in every arcade game.
// Each frame the game draws (about 30 a second, like a video), a copy of the 3D view is squeezed down to 480 lines,
// saved as a low-quality JPEG (so the blocks, ringing and smeared colour are real compression, not a filter) and
// stretched back up over the game. The HUD stays sharp on top. One setting for every game, saved in this browser.
//
//   GrugYT480.attach(renderer.domElement, renderer)   // once, after making the renderer
//   a button with id "mYT" (Game Menu: "480p YouTube mode: On/Off") or "sYT" (a settings row: "On/Off") is wired up here
(() => {
  if (window.GrugYT480) return;
  const KEY = 'grug.yt480.v1', LINES = 480, FPS = 30;
  let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (e) { }
  const S = { canvas: null, ov: null, oc: null, small: null, sc: null, busy: false, queued: false, last: 0, q: 0.16, shown: false };
  const subs = new Set();

  function overlay() {
    if (S.ov || !S.canvas) return;
    const ov = S.ov = document.createElement('canvas');
    ov.setAttribute('aria-hidden', 'true');
    // just over the game's canvas (the next thing after it), under everything else; clicks go straight through
    ov.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;display:none;image-rendering:auto;filter:saturate(.9) contrast(.95) brightness(1.02)';
    const z = getComputedStyle(S.canvas).zIndex; if (z && z !== 'auto') ov.style.zIndex = z;
    S.canvas.insertAdjacentElement('afterend', ov);
    S.oc = ov.getContext('2d');
    S.small = document.createElement('canvas'); S.sc = S.small.getContext('2d');
  }
  function place() {
    const r = S.canvas.getBoundingClientRect(), st = S.ov.style;
    st.left = r.left + 'px'; st.top = r.top + 'px'; st.width = r.width + 'px'; st.height = r.height + 'px';
  }
  function show(v) { if (S.ov) S.ov.style.display = v ? 'block' : 'none'; S.shown = v; }

  function grab() {
    if (!on || !S.canvas || S.busy) return;
    const now = performance.now(); if (now - S.last < 1000 / FPS - 2) return; S.last = now;
    const W = S.canvas.width, H = S.canvas.height; if (!W || !H) return;
    overlay();
    const h = Math.min(LINES, H), w = Math.max(2, Math.round(h * W / H / 2) * 2);
    if (S.small.width !== w || S.small.height !== h) { S.small.width = w; S.small.height = h; }
    S.sc.imageSmoothingEnabled = true; S.sc.imageSmoothingQuality = 'low';
    S.sc.drawImage(S.canvas, 0, 0, w, h);   // (straight after the game drew it: the picture is still there)
    // the bitrate wanders; now and then it starves for a moment and everything goes to blocks, like a busy scene on a slow upload
    S.q = Math.min(0.24, Math.max(0.07, S.q + (Math.random() - 0.5) * 0.05));
    const q = Math.random() < 0.015 ? 0.02 : S.q;
    S.busy = true;
    S.small.toBlob(blob => {
      if (!blob || !on) { S.busy = false; return; }
      createImageBitmap(blob).then(bmp => {
        S.busy = false; if (!on) { bmp.close && bmp.close(); return; }
        if (S.ov.width !== bmp.width || S.ov.height !== bmp.height) { S.ov.width = bmp.width; S.ov.height = bmp.height; }
        S.oc.drawImage(bmp, 0, 0); bmp.close && bmp.close();
        place(); if (!S.shown) show(true);
      }, () => { S.busy = false; });
    }, 'image/jpeg', q);
  }

  function attach(canvas, renderer) {
    if (!canvas) return;
    S.canvas = canvas;
    if (renderer && !renderer.__grugYT) {
      renderer.__grugYT = true;
      const r0 = renderer.render;
      renderer.render = function (scene, camera) {
        r0.call(this, scene, camera);
        // once the frame's done (a game may draw the screen in more than one pass): microtasks run before the page is shown
        if (on && !S.queued && this.getRenderTarget() === null) { S.queued = true; queueMicrotask(() => { S.queued = false; grab(); }); }
      };
    }
  }
  function set(v) {
    on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { }
    if (!on) show(false); S.last = 0;
    for (const f of subs) try { f(on); } catch (e) { }
  }

  // the settings buttons
  function wire() {
    const menuBtn = document.getElementById('mYT'), rowBtn = document.getElementById('sYT');
    const label = () => {
      if (menuBtn) { menuBtn.textContent = '480p YouTube mode: ' + (on ? 'On' : 'Off'); menuBtn.classList.toggle('on', on); }
      if (rowBtn) { rowBtn.textContent = on ? 'On' : 'Off'; rowBtn.classList.toggle('on', on); }
    };
    for (const b of [menuBtn, rowBtn]) if (b) {
      b.style.display = ''; const row = b.closest('[data-yt-row]'); if (row) row.style.display = '';
      b.addEventListener('click', e => { e.stopPropagation(); set(!on); });
    }
    subs.add(label); label();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  window.GrugYT480 = { attach, set, toggle: () => set(!on), get on() { return on; }, onChange: f => subs.add(f) };
})();
