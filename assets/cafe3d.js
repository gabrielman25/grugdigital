/* Grug · cafe3d.js — the last slide of rewards/create/: the owner's printed card standing in a clear table holder on a
   café table, with a phone scanning it, so "print this and put it on your tables" is obvious at a glance.
   Needs assets/three.min.js (r159) first. Solid colours only: no textures except the card itself.

   GrugCafe3D.mount(el, { card: <canvas of the printed card>, color: '#RRGGBB' }) → { dispose() } or null (no WebGL).
   Drag sideways to turn the table; it sways gently on its own otherwise. Stops drawing while off screen. */
(function (root) {
  'use strict';
  function mount(el, o) {
    const T = root.THREE; if (!T || !el) return null;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1) * 0.5);   // half resolution: smooth on phones
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    el.insertBefore(renderer.domElement, el.firstChild);

    const scene = new T.Scene(); scene.background = new T.Color('#3A2C24');
    const cam = new T.PerspectiveCamera(36, 1, 0.05, 60);
    const M = (c, x) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, x || {}));
    const add = (geo, mat, x, y, z, opts) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !(opts && opts.noCast); m.receiveShadow = true; scene.add(m); return m; };
    const box = (w, h, d) => new T.BoxGeometry(w, h, d), cyl = (rt, rb, h, s) => new T.CylinderGeometry(rt, rb, h, s || 40);

    /* light: a warm room and one lamp over the table */
    scene.add(new T.HemisphereLight(0xfff1dd, 0x3a2a20, 1.15));
    const sun = new T.DirectionalLight(0xffe2c0, 1.5); sun.position.set(2.5, 5, 3.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 12 }); sun.shadow.bias = -0.0008;
    scene.add(sun);
    const lamp = new T.PointLight(0xffc98a, 3.5, 5, 2); lamp.position.set(0.1, 2.0, 0.25); scene.add(lamp);

    /* the room */
    add(new T.PlaneGeometry(24, 24).rotateX(-Math.PI / 2), M('#5A3E2A'), 0, 0, 0, { noCast: true });
    add(box(16, 6, 0.1), M('#D9C7A8'), 0, 3, -3.2, { noCast: true });
    add(box(16, 1.0, 0.12), M('#7A5236'), 0, 0.5, -3.14, { noCast: true });
    add(box(1.9, 1.3, 0.06), M('#F4E9D6'), 1.7, 2.0, -3.12, { noCast: true });          // window frame
    add(box(1.7, 1.1, 0.07), M('#BFE3F2', { emissive: '#7FB8D0', emissiveIntensity: 0.35 }), 1.7, 2.0, -3.1, { noCast: true });
    add(box(0.05, 1.1, 0.08), M('#F4E9D6'), 1.7, 2.0, -3.08, { noCast: true });
    add(box(1.5, 1.0, 0.06), M('#2B2B2E'), -1.7, 2.1, -3.12, { noCast: true });         // menu board
    [0.25, 0.05, -0.15, -0.35].forEach((dy, i) => add(box(i ? 1.0 : 1.1, i ? 0.05 : 0.08, 0.02), M(i ? '#CFCFC8' : '#FFBE1A'), -1.7, 2.1 + dy, -3.08, { noCast: true }));
    add(cyl(0.012, 0.012, 1.0, 8), M('#2A2A2E'), 0.1, 2.75, 0.25, { noCast: true });   // lamp cord + shade
    add(cyl(0.12, 0.3, 0.26), M(o.color || '#FF9F5A'), 0.1, 2.15, 0.25, { noCast: true });

    /* a table and two chairs further back, so it reads as a restaurant */
    function table(x, z, r) {
      add(cyl(r, r, 0.06), M('#B98552'), x, 0.76, z);
      add(cyl(r * 1.005, r * 1.005, 0.02), M('#8E5F36'), x, 0.73, z);
      add(cyl(0.05, 0.05, 0.72), M('#2A2A2E'), x, 0.37, z);
      add(cyl(0.32, 0.36, 0.03), M('#2A2A2E'), x, 0.015, z);
    }
    function chair(x, z, rot) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
      const part = (geo, mat, px, py, pz) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); };
      const wood = M('#6E4A2C');
      part(box(0.42, 0.05, 0.42), wood, 0, 0.46, 0); part(box(0.42, 0.45, 0.04), wood, 0, 0.7, -0.19);
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => part(box(0.04, 0.46, 0.04), wood, a, 0.23, b));
    }
    table(0, 0, 0.62); table(-2.3, -1.9, 0.5);
    chair(-2.3, -1.25, Math.PI); chair(-2.3, -2.55, 0); chair(0.95, -0.35, -Math.PI / 2);

    /* the printed card in a clear stand */
    const top = 0.79;
    const tex = new T.CanvasTexture(o.card); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const cw = 0.25, ch = cw * 1.4;
    const card = new T.Group(); card.position.set(0, top + 0.03, -0.08); card.rotation.x = -0.16; scene.add(card);
    const paper = new T.Mesh(box(cw, ch, 0.004), [M('#FFFFFF'), M('#FFFFFF'), M('#FFFFFF'), M('#FFFFFF'), new T.MeshBasicMaterial({ map: tex }), M('#F2EFE8')]);
    paper.position.y = ch / 2; paper.castShadow = true; card.add(paper);
    const acrylic = new T.MeshStandardMaterial({ color: '#E6F4F8', transparent: true, opacity: 0.35, roughness: 0.1 });
    const pane = new T.Mesh(box(cw + 0.02, ch + 0.015, 0.003), acrylic); pane.position.set(0, ch / 2, 0.006); card.add(pane);
    add(box(cw + 0.06, 0.03, 0.1), new T.MeshStandardMaterial({ color: '#DCEFF4', transparent: true, opacity: 0.55, roughness: 0.15 }), 0, top + 0.015, -0.07);

    /* things on the table: a coffee and a donut */
    const white = M('#FAFAF7', { roughness: 0.4 });
    add(cyl(0.085, 0.085, 0.012), white, 0.3, top + 0.006, 0.18);
    add(cyl(0.05, 0.04, 0.085), white, 0.3, top + 0.055, 0.18);
    add(cyl(0.046, 0.046, 0.004), M('#5B3420', { roughness: 0.3 }), 0.3, top + 0.096, 0.18, { noCast: true });
    const handle = add(new T.TorusGeometry(0.022, 0.006, 8, 20), white, 0.355, top + 0.058, 0.18); handle.rotation.y = Math.PI / 2;
    add(cyl(0.12, 0.11, 0.014), white, -0.3, top + 0.007, 0.16);
    const dough = add(new T.TorusGeometry(0.045, 0.024, 14, 30), M('#D9A066'), -0.3, top + 0.035, 0.16); dough.rotation.x = Math.PI / 2;
    const icing = add(new T.TorusGeometry(0.045, 0.02, 14, 30), M('#FF8FC2', { roughness: 0.5 }), -0.3, top + 0.045, 0.16); icing.rotation.x = Math.PI / 2;

    /* a phone scanning the card */
    const phone = new T.Group(); scene.add(phone);
    const body = new T.Mesh(box(0.075, 0.15, 0.009), M('#1B1B1F', { roughness: 0.4 })); body.castShadow = true; phone.add(body);
    const screen = new T.Mesh(new T.PlaneGeometry(0.066, 0.138), new T.MeshBasicMaterial({ color: '#9BE338' })); screen.position.z = -0.0051; screen.rotation.y = Math.PI; phone.add(screen);
    const frame = new T.Mesh(new T.RingGeometry(0.02, 0.024, 4, 1, Math.PI / 4), new T.MeshBasicMaterial({ color: '#1E1B16' })); frame.position.z = -0.0055; frame.rotation.y = Math.PI; phone.add(frame);
    const cardCentre = new T.Vector3(0, top + 0.03 + ch / 2, -0.06);

    /* camera: sways around the table, drag to turn */
    const target = new T.Vector3(0, top + 0.16, -0.02);
    let drag = null, yawOff = 0, t0 = performance.now(), raf = 0, visible = true, alive = true;
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y0: yawOff }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (drag) yawOff = Math.max(-1.1, Math.min(1.1, drag.y0 - (e.clientX - drag.x) / 160)); });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function size() { const w = el.clientWidth || 400, h = el.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const ro = root.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(el); size();
    const io = root.IntersectionObserver ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && alive && !raf) raf = requestAnimationFrame(frameFn); }) : null; if (io) io.observe(el);
    const calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frameFn(now) {
      raf = 0; if (!alive || !visible) return;
      const t = (now - t0) / 1000;
      const yaw = 0.42 + (calm ? 0 : Math.sin(t * 0.35) * 0.32) + yawOff, el2 = 0.34, r = 1.3;
      cam.position.set(target.x + Math.sin(yaw) * Math.cos(el2) * r, target.y + Math.sin(el2) * r, target.z + Math.cos(yaw) * Math.cos(el2) * r);
      cam.lookAt(target);
      // the phone floats in front of the card, aimed at it, a little bob
      const bob = calm ? 0 : Math.sin(t * 1.6) * 0.012;
      phone.position.set(0.17, top + 0.32 + bob, 0.32); phone.lookAt(cardCentre); phone.rotateZ(0.12);
      screen.material.color.set((Math.floor(t * 1.2) % 2) ? '#9BE338' : '#B8F06A');
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frameFn);
    }
    raf = requestAnimationFrame(frameFn);
    return {
      dispose() {
        alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect();
        scene.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); });
        tex.dispose(); renderer.dispose(); if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }
  root.GrugCafe3D = { mount };
})(window);
