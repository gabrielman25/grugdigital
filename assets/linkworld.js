/* Grug · linkworld.js — a creator's link page as a small 3D world (links/page/ and the preview on links/create/).
   A round plaza with one little room per social in a half circle; each doorway glows in the platform's colour with a
   sign over it. The follower walks with WASD / arrow keys, or taps where to go (tap a room to walk into it). Walking
   into a doorway calls onDoor(link); the page asks before leaving Grug. Needs assets/three.min.js (r159).
   Solid colours only, no textures except the signs' text.

   GrugLinkWorld.mount(el, { cfg, links, preview, onDoor }) → { dispose(), resume() } or null (no WebGL)
     cfg     GrugLinks.normalize(...)    links  GrugLinks.linksOf(cfg)
     preview true = no controls, the camera circles the plaza (the builder's last slide) */
(function (root) {
  'use strict';
  const W = () => root.GrugLinks.WORLDS;

  function sign(T, top, bottom, bg, ink, badge) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
    const x = cv.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 192);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 176, 512, 16);
    let left = 28;
    if (badge) { x.fillStyle = ink; x.beginPath(); x.arc(92, 88, 62, 0, 7); x.fill(); x.fillStyle = bg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '700 ' + (badge.length > 2 ? 40 : 54) + 'px Fredoka, sans-serif'; x.fillText(badge, 92, 92); left = 176; }
    x.fillStyle = ink; x.textAlign = 'left'; x.textBaseline = 'middle';
    const fit = (t, px, max, w) => { do { x.font = w + ' ' + px + 'px Fredoka, sans-serif'; px -= 2; } while (x.measureText(t).width > max && px > 18); };
    fit(top, 58, 512 - left - 24, '700'); x.fillText(top, left, bottom ? 64 : 92);
    if (bottom) { fit(bottom, 38, 512 - left - 24, '600'); x.globalAlpha = .85; x.fillText(bottom, left, 126); x.globalAlpha = 1; }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  function mount(el, o) {
    const T = root.THREE; if (!T || !el) return null;
    let renderer; try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1) * 0.5);   // half resolution: smooth on phones renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.style.touchAction = 'none'; el.insertBefore(cv, el.firstChild);
    const cfg = o.cfg, links = o.links || [], world = W()[cfg.world] || W().c;
    const scene = new T.Scene(); scene.background = new T.Color(world.sky); scene.fog = new T.Fog(world.sky, 22, 46);
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 100);
    const M = (c, x) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, x || {}));
    const textures = [];
    const add = (geo, mat, x, y, z, parent) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; (parent || scene).add(m); return m; };
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);

    scene.add(new T.HemisphereLight(0xffffff, world.ground, cfg.world === 'a' ? .7 : 1.05));
    const sun = new T.DirectionalLight(0xfff4e6, cfg.world === 'a' ? .6 : 1.35); sun.position.set(6, 14, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 }); scene.add(sun);

    /* ground: the world, then the plaza */
    add(new T.CircleGeometry(40, 64).rotateX(-Math.PI / 2), M(world.ground), 0, 0, 0);
    add(new T.CircleGeometry(12.5, 64).rotateX(-Math.PI / 2), M(world.trim), 0, 0.01, 0);
    add(new T.CircleGeometry(11.8, 64).rotateX(-Math.PI / 2), M(world.wall, { roughness: .95 }), 0, 0.02, 0);

    /* one room per link, in a half circle facing the spawn point */
    const R = 10.5, n = Math.max(1, links.length), spread = Math.min(Math.PI * 0.95, n * 0.42), rooms = [];
    links.forEach((L, i) => {
      const a = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1);
      const g = new T.Group(); g.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R); g.rotation.y = -a; scene.add(g);
      const wall = M(world.wall), trim = M(world.trim), col = M(L.color);
      add(box(3.4, 3, 0.3), wall, 0, 1.5, -1.6, g);                       // back
      add(box(0.3, 3, 3.2), wall, -1.55, 1.5, 0, g); add(box(0.3, 3, 3.2), wall, 1.55, 1.5, 0, g);   // sides
      add(box(1.0, 3, 0.3), wall, -1.2, 1.5, 1.6, g); add(box(1.0, 3, 0.3), wall, 1.2, 1.5, 1.6, g); // front, either side of the door
      add(box(1.4, 0.7, 0.3), wall, 0, 2.65, 1.6, g);                    // over the door
      add(box(3.8, 0.35, 3.8), col, 0, 3.15, 0, g);                       // roof in the platform's colour
      add(box(3.4, 0.08, 3.2), trim, 0, 0.04, 0, g);
      // the doorway: a frame and a glowing room behind it
      add(box(0.16, 2.3, 0.4), col, -0.72, 1.15, 1.62, g); add(box(0.16, 2.3, 0.4), col, 0.72, 1.15, 1.62, g); add(box(1.6, 0.16, 0.4), col, 0, 2.32, 1.62, g);
      const glow = new T.Mesh(new T.PlaneGeometry(1.28, 2.24), new T.MeshBasicMaterial({ color: L.color })); glow.position.set(0, 1.12, 1.2); g.add(glow);
      // sign over the door
      const tex = sign(T, L.label, L.handle, L.color, L.ink, L.badge); textures.push(tex);
      const sg = new T.Mesh(new T.PlaneGeometry(2.6, 0.975), new T.MeshBasicMaterial({ map: tex })); sg.position.set(0, 3.9, 1.75); g.add(sg);
      add(box(2.7, 1.07, 0.08), trim, 0, 3.9, 1.7, g);
      // a pad in front of the door
      const pad = new T.Mesh(new T.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: L.color })); pad.position.set(0, 0.04, 2.6); g.add(pad);
      [glow, sg].forEach(m => { m.userData.room = i; });
      g.traverse(m => { if (m.isMesh) m.userData.room = i; });
      const door = new T.Vector3(0, 0, 1.9).applyMatrix4(new T.Matrix4().makeRotationY(-a)).add(g.position);
      const front = new T.Vector3(0, 0, 3.2).applyMatrix4(new T.Matrix4().makeRotationY(-a)).add(g.position);
      rooms.push({ link: L, door, front, pad });
    });

    /* decorations for the world */
    function deco(x, z) {
      if (cfg.world === 'a') { const h = 2 + (Math.abs(x * z) % 2.5); add(box(0.5, h, 0.5), new T.MeshBasicMaterial({ color: (Math.round(x + z) % 2) ? world.accent : '#4FD8FF' }), x, h / 2, z); }
      else if (cfg.world === 'b') {
        const pole = add(new T.CylinderGeometry(.06, .06, 2.2, 8), M('#FFFFFF'), x, 1.1, z);
        const top = add(new T.ConeGeometry(1.2, .6, 8), M((Math.round(x) % 2) ? '#FF5A5A' : world.accent), x, 2.3, z); pole.castShadow = top.castShadow = true;
      } else {
        add(new T.CylinderGeometry(.18, .22, 1, 8), M('#5A3A22'), x, .5, z);
        add(new T.ConeGeometry(1.0, 2.4, 10), M('#2F6B3A'), x, 2.1, z);
      }
    }
    [[-14, 3], [14, 4], [-12, 10], [12, 11], [-17, -6], [17, -7], [-8, 15], [8, 16], [0, 19], [-19, 10], [19, 12]].forEach(p => deco(p[0], p[1]));
    // the welcome sign by the spawn point
    const wtex = sign(T, cfg.n, 'Walk into a room', cfg.color, root.GrugRewards.inkOn(cfg.color), ''); textures.push(wtex);
    const wsign = new T.Group(); wsign.position.set(-2.6, 0, 5.2); wsign.rotation.y = 0.35; scene.add(wsign);
    add(box(.14, 1.8, .14), M(world.trim), 0, .9, 0, wsign);
    const ws = new T.Mesh(new T.PlaneGeometry(2.4, .9), new T.MeshBasicMaterial({ map: wtex })); ws.position.set(0, 2.0, .09); wsign.add(ws);
    add(box(2.5, 1.0, .12), M(world.trim), 0, 2.0, 0, wsign);

    /* the follower: a round little character in the creator's colour */
    const me = new T.Group(); scene.add(me); me.position.set(0, 0, 6.5); me.rotation.y = Math.PI;
    const bodyC = M(cfg.color, { roughness: .6 });
    const body = add(new T.CapsuleGeometry(.42, .55, 6, 16), bodyC, 0, .72, 0, me);
    const head = add(new T.SphereGeometry(.38, 24, 16), M('#F6D9B8', { roughness: .7 }), 0, 1.5, 0, me);
    [-.13, .13].forEach(x => add(new T.SphereGeometry(.055, 10, 8), M('#1E1B16'), x, 1.55, -.33, me));
    const shadow = new T.Mesh(new T.CircleGeometry(.5, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .22 })); shadow.position.y = .03; me.add(shadow);

    /* input */
    const keys = {}, ray = new T.Raycaster(), ptr = new T.Vector2();
    let target = null, cooldown = -1, walking = 0;
    const onKey = (e, d) => { if (o.preview || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return; const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = d; target = null; e.preventDefault(); } };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    if (!o.preview) {
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, cam);
        const hit = ray.intersectObjects(scene.children, true)[0]; if (!hit) return;
        if (hit.object.userData.room != null) { const rm = rooms[hit.object.userData.room]; target = rm.door.clone(); cooldown = -1; }
        else target = new T.Vector3(hit.point.x, 0, hit.point.z);
      });
    }

    function size() { const w = el.clientWidth || 400, h = el.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const ro = root.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(el); size();
    let visible = true, alive = true, raf = 0, last = performance.now(), t = 0;
    const io = root.IntersectionObserver ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && alive && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }) : null; if (io) io.observe(el);
    const camPos = new T.Vector3(0, 8, 15), look = new T.Vector3();
    const dir = new T.Vector3(), SPEED = 5.2, LIMIT = R - 1.35;

    function frame(now) {
      raf = 0; if (!alive || !visible) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      if (o.preview) {
        const a = t * .18; cam.position.set(Math.sin(a) * 17, 8.5, Math.cos(a) * 17); cam.lookAt(0, 1.5, -2);
        rooms.forEach(rm => { rm.pad.scale.setScalar(1 + Math.sin(t * 3) * .08); });
      } else {
        dir.set(0, 0, 0);
        if (keys.w || keys.arrowup) dir.z -= 1; if (keys.s || keys.arrowdown) dir.z += 1; if (keys.a || keys.arrowleft) dir.x -= 1; if (keys.d || keys.arrowright) dir.x += 1;
        if (target && !dir.lengthSq()) { dir.set(target.x - me.position.x, 0, target.z - me.position.z); if (dir.length() < .15) { target = null; dir.set(0, 0, 0); } }
        walking = dir.lengthSq() ? 1 : 0;
        if (walking) {
          dir.normalize(); me.position.addScaledVector(dir, SPEED * dt);
          me.rotation.y = Math.atan2(-dir.x, -dir.z);   // the face is on local -z
          // stay on the plaza; the rooms' doors sit just inside the edge
          const r = Math.hypot(me.position.x, me.position.z); if (r > LIMIT) me.position.multiplyScalar(LIMIT / r);
        }
        body.position.y = .72 + (walking ? Math.abs(Math.sin(t * 10)) * .08 : Math.sin(t * 2) * .02);
        head.position.y = body.position.y + .78;
        // walked into a doorway?
        if (cooldown >= 0) { const away = rooms[cooldown] && me.position.distanceTo(rooms[cooldown].door) > 2.4; if (away) cooldown = -1; }
        else rooms.forEach((rm, i) => { if (cooldown < 0 && me.position.distanceTo(rm.door) < 1.15) { cooldown = i; target = null; Object.keys(keys).forEach(k => { keys[k] = false; }); if (o.onDoor) o.onDoor(rm.link); } });
        rooms.forEach(rm => { rm.pad.scale.setScalar(1 + Math.sin(t * 3) * .08); });
        // camera follows from behind and above
        camPos.set(me.position.x * .85, 7.5, me.position.z + 9.5); cam.position.lerp(camPos, 1 - Math.pow(.02, dt));
        look.set(me.position.x * .9, 1.2, me.position.z - 3); cam.lookAt(look);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      // after a teleport prompt: step back out of the doorway
      back() { if (cooldown >= 0 && rooms[cooldown]) { const rm = rooms[cooldown]; me.position.set(rm.front.x, 0, rm.front.z); const r = Math.hypot(me.position.x, me.position.z); if (r > LIMIT - .6) me.position.multiplyScalar((LIMIT - .6) / r); } },
      resume() { last = performance.now(); if (!raf && alive) raf = requestAnimationFrame(frame); },
      dispose() {
        alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect();
        removeEventListener('keydown', kd); removeEventListener('keyup', ku);
        scene.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); });
        textures.forEach(x => x.dispose()); renderer.dispose(); if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }
  root.GrugLinkWorld = { mount };
})(window);
