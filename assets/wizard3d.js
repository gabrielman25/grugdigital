/* Grug · wizard3d.js — the 3D pictures beside each question of the rewards card builder (rewards/create/).
   One renderer for the whole survey (moved from slide to slide), two scenes:
     'shop'  name, kind, colour, icon: the owner's storefront. The sign shows the name and icon, the awning and door take
             the brand colour, and the kind of place adds a prop (café tables, a giant boba cup, barrels, a menu easel,
             a giant donut, a star).
     'phone' stamps, reward, welcome: a phone showing their stamp card filling up, the reward floating beside it and
             ten Pearls circling it (Pearls come with every card).
   Renders at half resolution (pixel ratio × 0.5) so it runs smoothly on phones, and stops while off screen.
   Needs assets/three.min.js (r159). Solid colours only.

   GrugWizard3D.mount(el) → { show(scene, cfg, step), update(cfg, step), dispose() } or null (no WebGL)
   cfg = GrugRewards.normalize(...) (+ named: false shows "Your shop" on the sign) */
(function (root) {
  'use strict';
  const RES = 0.5;   // render scale: half the screen's pixels
  const EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function mount(el) {
    const T = root.THREE; if (!T || !el) return null;
    let renderer; try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1) * RES);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    const cv = renderer.domElement; el.appendChild(cv);
    const RW = root.GrugRewards;
    const M = (c, x) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, x || {}));
    const box = (w, h, d) => new T.BoxGeometry(w, h, d), cyl = (a, b, h, s) => new T.CylinderGeometry(a, b, h, s || 32);
    function put(parent, geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
    function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
    function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
    function fit(x, text, w, px, max) { do { x.font = w + ' ' + px + 'px Fredoka, ' + EMO + ', sans-serif'; px -= 2; } while (x.measureText(text).width > max && px > 14); }
    // the shop's name in the lettering it picked (RW.FONTS)
    function fitName(x, cfg, px, max) { const F = RW.fontOf(cfg), t = nameOf(cfg); px = Math.round(px * F.size); do { x.font = F.w + ' ' + px + 'px "' + F.css + '", Fredoka, ' + EMO + ', sans-serif'; px -= 2; } while (x.measureText(t).width > max && px > 14); }
    const fontIn = cfg => { const F = RW.fontOf(cfg); try { return document.fonts.check(F.w + ' 40px "' + F.css + '"'); } catch (e) { return true; } };
    const nameOf = cfg => cfg.named === false ? 'Your shop' : cfg.n;

    /* ======================= the storefront ======================= */
    function shopScene() {
      const scene = new T.Scene(); scene.background = new T.Color('#9FD3F0');
      const cam = new T.PerspectiveCamera(38, 1, .1, 80);
      scene.add(new T.HemisphereLight(0xffffff, 0x8a7a66, 1.1));
      const sun = new T.DirectionalLight(0xfff2dc, 1.5); sun.position.set(-4, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(512, 512);
      Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4 }); scene.add(sun);
      put(scene, new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), M('#4A4A52'), 0, 0, 4);       // street
      put(scene, box(30, .16, 3), M('#CFC6B8'), 0, .08, 1.5);                                         // sidewalk
      put(scene, box(30, .18, .2), M('#A79E90'), 0, .09, 3.0);
      // the neighbours
      put(scene, box(4, 4.4, 2.4), M('#B9C7D8'), -4.6, 2.2, -1.3); put(scene, box(4, 3.4, 2.4), M('#D8B9B9'), 4.6, 1.7, -1.3);
      [-4.6, 4.6].forEach(x => put(scene, box(2.6, 1.2, .1), M('#DCEFF6', { emissive: '#9CC9DA', emissiveIntensity: .25 }), x, 1.8, -.04));
      // the shop
      const shop = new T.Group(); scene.add(shop);
      put(shop, box(4.4, 3.6, 2.4), M('#F1E6D6'), 0, 1.8, -1.2);
      put(shop, box(4.5, .35, 2.5), M('#8E7B66'), 0, .175, -1.2);
      put(shop, box(2.3, 1.4, .1), M('#DCEFF6', { emissive: '#A9D6E8', emissiveIntensity: .35 }), -.85, 1.45, .02);
      put(shop, box(2.5, .12, .16), M('#FFFFFF'), -.85, .7, .05);
      const door = put(shop, box(.95, 1.9, .12), M('#C8924F'), 1.35, 1.12, .03);
      put(shop, new T.SphereGeometry(.05, 10, 8), M('#F5D58A', { metalness: .6, roughness: .3 }), 1.0, 1.1, .12);
      const awning = put(shop, box(4.6, .1, 1.1), M('#C8924F'), 0, 2.48, .45); awning.rotation.x = .38;
      const scallops = [];
      for (let i = 0; i < 9; i++) { const s = put(shop, cyl(.26, .26, .08, 16, 1), M('#C8924F'), -2.05 + i * .512, 2.24, .94); s.rotation.x = Math.PI / 2; s.scale.z = 1; scallops.push(s); }
      // the sign (its picture is redrawn when the name, icon or colour changes)
      const signMat = new T.MeshBasicMaterial(); const sign = put(shop, box(3.7, .82, .14), [M('#6E5A46'), M('#6E5A46'), M('#6E5A46'), M('#6E5A46'), signMat, M('#6E5A46')], 0, 3.18, .1);
      sign.castShadow = false;
      // the prop for the kind of place
      const props = {}; let kind = '';
      function prop(k) {
        if (props[k]) return props[k];
        const g = new T.Group(); g.visible = false; scene.add(g); props[k] = g;
        const brand = M('#C8924F'); g.userData.brand = [brand];
        if (k === 'c') {           // a café table with an umbrella
          [-3.0].forEach(x => { put(g, cyl(.45, .45, .06), M('#FFFFFF'), x, .95, 1.6); put(g, cyl(.05, .05, .9), M('#2A2A2E'), x, .5, 1.6);
            put(g, cyl(.035, .035, 2.2), M('#FFFFFF'), x, 1.6, 1.6); put(g, new T.ConeGeometry(1.15, .5, 10), brand, x, 2.75, 1.6);
            [[-.7, 0], [.7, 0]].forEach(([dx]) => { put(g, box(.42, .06, .42), M('#6E4A2C'), x + dx, .55, 1.6); put(g, box(.42, .5, .05), M('#6E4A2C'), x + dx * 1.3, .8, 1.6).rotation.y = Math.PI / 2; }); });
        } else if (k === 't') {    // a giant boba cup on the roof
          put(g, cyl(.7, .55, 1.6), M('#E9D3B0'), 0, 4.4, -1.2); put(g, cyl(.72, .72, .12), brand, 0, 5.25, -1.2);
          put(g, cyl(.08, .08, 1.0), brand, .25, 5.7, -1.2).rotation.z = -.2;
          for (let i = 0; i < 8; i++) put(g, new T.SphereGeometry(.13, 10, 8), M('#3A2418'), Math.cos(i) * .4, 3.75 + (i % 2) * .15, -1.2 + Math.sin(i) * .4 + .5);
        } else if (k === 'b') {    // barrels and a row of lights
          [[-3.0, .0], [-2.25, .25]].forEach(([x, z]) => { put(g, cyl(.42, .42, .95, 18), M('#8B5A2B'), x, .63, 1.4 + z); put(g, cyl(.44, .44, .08, 18), M('#3A3A3E'), x, .85, 1.4 + z); put(g, cyl(.44, .44, .08, 18), M('#3A3A3E'), x, .4, 1.4 + z); });
          for (let i = 0; i < 9; i++) put(g, new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({ color: '#FFD98A' }), -2 + i * .5, 2.72 - Math.sin(i / 8 * Math.PI) * .18, .98);
        } else if (k === 'f') {    // a menu easel and a planter
          const e = put(g, box(.9, 1.2, .06), M('#2B2B2E'), -2.9, .85, 1.7); e.rotation.x = -.18;
          [[.32], [.12], [-.08], [-.28]].forEach(([y], i) => put(g, box(i ? .55 : .65, .05, .02), M(i ? '#CFCFC8' : '#FFBE1A'), -2.9, .85 + y, 1.75).rotation.x = -.18);
          put(g, box(.9, .5, .5), M('#8E7B66'), 3.0, .41, 1.0); put(g, new T.SphereGeometry(.45, 12, 10), M('#3F8A4A'), 3.0, .95, 1.0);
        } else if (k === 'k') {    // a giant donut on the roof
          const d = put(g, new T.TorusGeometry(.75, .36, 16, 32), M('#D9A066'), 0, 4.55, -1.2);
          const ic = put(g, new T.TorusGeometry(.75, .3, 16, 32), brand, 0, 4.6, -1.08); ic.scale.set(1, 1, .5); d.rotation.x = ic.rotation.x = 0;
        } else {                   // a star on the roof
          const s = put(g, new T.OctahedronGeometry(.8, 0), brand, 0, 4.5, -1.2); s.scale.set(1, 1, .4); g.userData.spin = s;
        }
        return g;
      }
      let key = '';
      function update(cfg) {
        const col = cfg.color, dark = RW.lo(col);
        [awning, ...scallops].forEach(m => m.material.color.set(col)); door.material.color.set(dark);
        if (kind !== cfg.t) { if (props[kind]) props[kind].visible = false; kind = cfg.t; prop(kind).visible = true; }
        prop(kind).userData.brand.forEach(m => m.color.set(col));
        const k2 = nameOf(cfg) + '|' + cfg.i + '|' + col + '|' + cfg.f + '|' + fontIn(cfg);
        if (k2 !== key) {
          key = k2; if (signMat.map) signMat.map.dispose();
          signMat.map = canvasTex(740, 164, (x, w, h) => {
            x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = dark; x.fillRect(0, h - 12, w, 12);
            rr(x, 18, 18, 116, 116, 26); x.fillStyle = dark; x.fill();
            x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '74px ' + EMO; x.fillText(cfg.i, 76, 80);
            x.textAlign = 'left'; x.fillStyle = RW.inkOn(col); fitName(x, cfg, 70, w - 180); x.fillText(nameOf(cfg), 158, 80);
          });
          signMat.needsUpdate = true;
        }
      }
      function frame(t, aspect) {
        const yaw = Math.sin(t * .25) * .16, back = aspect < 1 ? 12 / Math.max(.55, aspect) : 9.6;
        cam.position.set(Math.sin(yaw) * back, 2.5 + (aspect < 1 ? 1 : 0), 1.5 + Math.cos(yaw) * back * .95); cam.lookAt(0, 2.35, -.6);
        Object.values(props).forEach(g => { if (g.userData.spin) g.userData.spin.rotation.y = t; });
      }
      return { scene, cam, update, frame };
    }

    /* ======================= the phone and the reward ======================= */
    function phoneScene() {
      const scene = new T.Scene(); scene.background = new T.Color('#2A2420');
      const cam = new T.PerspectiveCamera(36, 1, .1, 60);
      scene.add(new T.HemisphereLight(0xfff3e6, 0x2a2033, 1.2));
      const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(3, 5, 6); scene.add(key);
      const rim = new T.DirectionalLight(0xffb87a, .6); rim.position.set(-5, 2, -3); scene.add(rim);
      const phone = new T.Group(); scene.add(phone);
      put(phone, box(1.62, 3.3, .16), M('#1B1B1F', { roughness: .35 }), 0, 0, 0);
      const screenMat = new T.MeshBasicMaterial(); const screen = new T.Mesh(new T.PlaneGeometry(1.5, 3.12), screenMat); screen.position.z = .085; phone.add(screen);
      // the reward floats beside the phone
      const reward = new T.Group(); reward.position.set(1.85, -.2, .4); scene.add(reward);
      const pearls = new T.Group(); scene.add(pearls);
      const pearlMat = M('#C59BFF', { roughness: .25, metalness: .1, emissive: '#6E4BB0', emissiveIntensity: .25 });
      for (let i = 0; i < 10; i++) { const p = new T.Mesh(new T.SphereGeometry(.13, 18, 14), pearlMat); p.userData.a = i / 10 * Math.PI * 2; pearls.add(p); }
      let shownReward = '', st = { cfg: null, step: '', fill: 0, timer: 0, lastFill: -1 };
      function buildReward(cfg) {
        const r = /^p\d+$/.test(cfg.r) ? 'p' : cfg.r; const k = r + '|' + cfg.color + '|' + cfg.r;
        if (k === shownReward) return; shownReward = k;
        while (reward.children.length) { const c = reward.children.pop(); c.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
        const white = M('#FAFAF7', { roughness: .4 }), brand = M(cfg.color);
        const cup = (x, z) => { put(reward, cyl(.36, .27, .9), white, x, 0, z); put(reward, cyl(.39, .39, .1), brand, x, .5, z); put(reward, cyl(.04, .04, .7), brand, x + .1, .85, z).rotation.z = -.2; put(reward, cyl(.37, .3, .3), brand, x, -.05, z); };
        if (r === 'n') { reward.visible = false; return; }
        reward.visible = true;
        if (r === 'd') cup(0, 0);
        else if (r === 'b') { cup(-.35, 0); cup(.45, -.3); }
        else if (r === 'f') { put(reward, cyl(.7, .62, .06), white, 0, -.4, 0); put(reward, new T.SphereGeometry(.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#D9A066'), 0, .02, 0); put(reward, cyl(.44, .44, .1), M('#6B3A20'), 0, -.06, 0); put(reward, cyl(.46, .46, .05), M('#4FA84A'), 0, -.13, 0); put(reward, cyl(.42, .42, .1), M('#D9A066'), 0, -.22, 0); }
        else if (r === 's') { const c = put(reward, cyl(.6, .6, .6, 3, 1), M('#F6E2C8'), 0, 0, 0); c.scale.z = .8; const f = put(reward, cyl(.62, .62, .14, 3, 1), M('#FF8FC2'), 0, .36, 0); f.scale.z = .8; put(reward, new T.SphereGeometry(.12, 12, 10), M('#E5484D'), -.1, .52, .05); }
        else {
          const tag = put(reward, box(1.1, .66, .06), brand, 0, 0, 0); tag.rotation.z = .25;
          const tex = canvasTex(256, 154, (x, w, h) => { x.fillStyle = cfg.color; x.fillRect(0, 0, w, h); x.fillStyle = RW.inkOn(cfg.color); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 64px Fredoka, sans-serif'; x.fillText(cfg.r.slice(1) + '%', w / 2, 58); x.font = '700 34px Fredoka, sans-serif'; x.fillText('OFF', w / 2, 116); });
          const face = new T.Mesh(new T.PlaneGeometry(1.08, .64), new T.MeshBasicMaterial({ map: tex })); face.position.z = .035; tag.add(face);
          put(reward, new T.TorusGeometry(.07, .025, 8, 16), M('#FFFFFF'), -.42, .14, .05);
        }
      }
      // the phone's screen: the guest's card with `have` stamps
      function drawScreen(cfg, have, note) {
        if (screenMat.map) screenMat.map.dispose();
        screenMat.map = canvasTex(400, 832, (x, w, h) => {
          x.fillStyle = '#17171A'; x.fillRect(0, 0, w, h);
          x.fillStyle = '#9BE338'; rr(x, 24, 40, 34, 34, 9); x.fill(); x.fillStyle = '#F2F2F4'; x.font = '700 26px Fredoka, sans-serif'; x.textBaseline = 'middle'; x.fillText('Grug', 68, 58);
          // the card
          rr(x, 20, 100, w - 40, 470, 26); x.fillStyle = '#FFFFFF'; x.fill();
          x.save(); rr(x, 20, 100, w - 40, 470, 26); x.clip(); x.fillStyle = cfg.color; x.fillRect(20, 100, w - 40, 104); x.fillStyle = RW.lo(cfg.color); x.fillRect(20, 196, w - 40, 8); x.restore();
          rr(x, 38, 118, 68, 68, 16); x.fillStyle = RW.lo(cfg.color); x.fill();
          x.textAlign = 'center'; x.font = '42px ' + EMO; x.fillText(cfg.i, 72, 154);
          x.textAlign = 'left'; x.fillStyle = RW.inkOn(cfg.color); fitName(x, cfg, 30, 250); x.fillText(nameOf(cfg), 120, 144);
          x.font = '600 18px Fredoka, sans-serif'; x.globalAlpha = .85; x.fillText('Rewards card', 120, 174); x.globalAlpha = 1;
          const n = cfg.s, cols = (n === 6 || n === 9) ? 3 : (n === 5 || n === 10) ? 5 : 4, rows = Math.ceil(n / cols);
          const cell = Math.min((w - 80) / cols, 280 / rows), r = cell * .42, gx = (w - cell * cols) / 2;
          for (let i = 0; i < n; i++) {
            const cx = gx + (i % cols + .5) * cell, cy = 225 + (Math.floor(i / cols) + .5) * cell;
            x.beginPath(); x.arc(cx, cy, r, 0, 7);
            if (i < have) { x.fillStyle = cfg.color; x.fill(); x.textAlign = 'center'; x.font = Math.round(r * 1.05) + 'px ' + EMO; x.fillText(cfg.i, cx, cy + 2); }
            else { x.fillStyle = '#F6F2EC'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#E6DED2'; x.stroke(); x.fillStyle = '#B0A898'; x.textAlign = 'center'; x.font = (i === n - 1 ? Math.round(r) + 'px ' + EMO : '700 ' + Math.round(r * .6) + 'px Fredoka, sans-serif'); x.fillText(i === n - 1 ? '🎁' : String(i + 1), cx, cy + 2); }
          }
          x.textAlign = 'center'; x.fillStyle = '#1E1B16'; fit(x, RW.pearlsOnly(cfg.r) ? 'Every visit: +10 Pearls' : 'Collect ' + n + ' → ' + RW.rewardText(cfg.r), '700', 24, w - 70);
          x.fillText(RW.pearlsOnly(cfg.r) ? 'Every visit: +10 Pearls' : 'Collect ' + n + ' → ' + RW.rewardText(cfg.r), w / 2, 540);
          // the Pearls row
          rr(x, 20, 590, w - 40, 86, 20); x.fillStyle = '#2F2A3D'; x.fill();
          x.beginPath(); x.arc(64, 633, 20, 0, 7); x.fillStyle = '#C59BFF'; x.fill();
          x.textAlign = 'left'; x.fillStyle = '#F2F2F4'; x.font = '700 24px Fredoka, sans-serif'; x.fillText('+10 Pearls every visit', 100, 622); x.fillStyle = '#B9B4C8'; x.font = '600 17px Fredoka, sans-serif'; x.fillText('On the house, for any game', 100, 650);
          if (note) { rr(x, 60, 706, w - 120, 64, 32); x.fillStyle = '#FF9F5A'; x.fill(); x.fillStyle = '#1E1B16'; x.textAlign = 'center'; x.font = '700 24px Fredoka, sans-serif'; x.fillText(note, w / 2, 739); }
        });
        screenMat.needsUpdate = true;
      }
      function update(cfg, step) {
        const changed = !st.cfg || st.step !== step || ['n', 'i', 'color', 's', 'r', 'j', 't'].some(k => st.cfg[k] !== cfg[k]) || st.cfg.named !== cfg.named;
        st.cfg = Object.assign({}, cfg); if (st.step !== step) { st.fill = 0; st.timer = 0; } st.step = step;
        buildReward(cfg);
        if (changed) { st.lastFill = -1; tickFill(0); }
      }
      // stamps fill up one by one, then start over
      function tickFill(dt) {
        const cfg = st.cfg; if (!cfg) return;
        st.timer += dt;
        const target = st.step === 'welcome' ? (cfg.j ? 2 : 1) : st.step === 'reward' ? cfg.s : cfg.s;
        if (st.timer > (st.fill >= target ? 1.6 : .5)) { st.timer = 0; st.fill = st.fill >= target ? (st.step === 'welcome' ? 0 : Math.max(0, cfg.s - 4)) : st.fill + 1; }
        if (st.fill !== st.lastFill) { st.lastFill = st.fill;
          drawScreen(cfg, st.fill, st.step === 'welcome' && st.fill > 0 ? (cfg.j && st.fill >= 1 ? 'First scan: +2 stamps!' : '+1 stamp') : st.step === 'reward' && st.fill >= cfg.s && !RW.pearlsOnly(cfg.r) ? 'Reward ready!' : ''); }
      }
      function frame(t, aspect, dt) {
        tickFill(dt);
        phone.rotation.y = -.22 + Math.sin(t * .6) * .1; phone.position.y = Math.sin(t * 1.2) * .06;
        reward.rotation.y = t * .8; reward.position.y = -.2 + Math.sin(t * 1.5 + 1) * .1;
        pearls.children.forEach((p, i) => { const a = p.userData.a + t * .7; p.position.set(Math.cos(a) * 1.6, Math.sin(a * 2 + i) * .25 + .2, Math.sin(a) * .9); });
        const portrait = aspect < 1;
        reward.position.x = portrait ? 1.2 : 1.6; reward.scale.setScalar(portrait ? .7 : .9);
        cam.position.set(.3, .2, portrait ? 6.6 / Math.max(.6, aspect) * .75 : 5.9); cam.lookAt(.3, -.05, 0);
      }
      return { scene, cam, update, frame };
    }

    /* ======================= the stage ======================= */
    const scenes = {}; let cur = null, curName = '';
    const make = n => scenes[n] || (scenes[n] = n === 'shop' ? shopScene() : phoneScene());
    function size() { const w = el.clientWidth || 400, h = el.clientHeight || 300; renderer.setSize(w, h, false); [scenes.shop, scenes.phone].forEach(s => { if (s) { s.cam.aspect = w / h; s.cam.updateProjectionMatrix(); } }); }
    const ro = root.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(el);
    let visible = true, alive = true, raf = 0, last = performance.now(), t = 0;
    const io = root.IntersectionObserver ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && alive && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }) : null; if (io) io.observe(el);
    const calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function loop(now) {
      raf = 0; if (!alive || !visible || !cur) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += calm ? 0 : dt;
      cur.frame(t, (el.clientWidth || 4) / (el.clientHeight || 3), dt);
      renderer.render(cur.scene, cur.cam);
      raf = requestAnimationFrame(loop);
    }
    return {
      show(name, cfg, step) { const s = make(name); if (curName !== name) { curName = name; cur = s; size(); } s.update(cfg, step); if (!raf && alive && visible) { last = performance.now(); raf = requestAnimationFrame(loop); } },
      update(cfg, step) { if (cur) cur.update(cfg, step); },
      kick() { size(); if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(loop); } },
      dispose() {
        alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect();
        Object.values(scenes).forEach(s => s.scene.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); }));
        renderer.dispose(); if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }
  root.GrugWizard3D = { mount, RES };
})(window);
