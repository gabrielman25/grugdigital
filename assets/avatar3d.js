/* Grug · avatar3d.js
   Builds and animates the blocky Grug avatar with three.js (window.THREE, assets/three.min.js).
   Needs assets/catalog.js (window.GrugCatalog) for item definitions.

   GrugAvatar.mount(el, avatar, opts)  → live viewer in an element (drag to spin). Returns a viewer: {setAvatar, play, destroy}
   GrugAvatar.snapshot(avatar, opts)   → PNG data URL (bust or full body, any pose)
   GrugAvatar.thumb(itemId, avatar, size) → data URL of the avatar wearing one item (for shop tiles)
   GrugAvatar.build(avatar)            → a rig {group, set, pose, update, dispose} for your own scene

   The avatar object is the one stored in the Grug profile:
   { skin, face, hair, hairColor, hat, hatColor, shirt, shirtColor, pants, pantsColor, back, backColor, hand }
   Proportions are R6 studs: legs 1x2x1, torso 2x2x1, arms 1x2x1, head 1.2 cube. Feet stand on y=0.
*/
(function (root) {
  'use strict';
  const T = root.THREE, C = root.GrugCatalog;
  if (!T || !C) { console.warn('GrugAvatar: three.js and catalog.js must load first'); return; }

  const INK = '#1F1A17';
  const PI = Math.PI;

  /* ---------------- geometry helpers ---------------- */
  // A box with softly rounded edges: a segmented BoxGeometry with its vertices pushed to a rounded shell.
  const geoCache = new Map();
  function rbox(w, h, d, r, seg) {
    r = r == null ? 0.07 : r; seg = seg || 3;
    const key = [w, h, d, r, seg].join(',');
    if (geoCache.has(key)) return geoCache.get(key);
    const g = new T.BoxGeometry(w, h, d, seg, seg, seg);
    const p = g.attributes.position, n = g.attributes.normal;
    const ix = Math.max(0, w / 2 - r), iy = Math.max(0, h / 2 - r), iz = Math.max(0, d / 2 - r);
    const v = new T.Vector3(), q = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
      v.sub(q);
      if (v.lengthSq() > 1e-9) { v.normalize(); n.setXYZ(i, v.x, v.y, v.z); v.multiplyScalar(r).add(q); p.setXYZ(i, v.x, v.y, v.z); }
    }
    p.needsUpdate = true; n.needsUpdate = true;
    geoCache.set(key, g);
    return g;
  }
  const cyl = (rt, rb, h, seg, open) => new T.CylinderGeometry(rt, rb, h, seg || 20, 1, !!open);
  const sph = (r, seg) => new T.SphereGeometry(r, seg || 18, seg ? Math.round(seg * 0.7) : 12);

  /* ---------------- materials & textures ---------------- */
  function mat(color, opts) {
    const m = new T.MeshLambertMaterial(Object.assign({ color: new T.Color(color) }, opts || {}));
    return m;
  }
  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function texMat(w, h, draw, opts) { return new T.MeshLambertMaterial(Object.assign({ map: tex(w, h, draw) }, opts || {})); }
  function shade(hex, k) { // darken (k<1) or lighten (k>1) a hex color
    const c = new T.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
    return '#' + c.getHexString();
  }

  /* ---------------- faces (drawn on a transparent plane in front of the head) ---------------- */
  const FACES = {
    smile(x) { eyes(x); mouth(x, 'smile'); },
    grin(x) { eyes(x); mouth(x, 'grin'); },
    happy(x) { eyes(x, 'closed'); mouth(x, 'smile'); },
    surprised(x) { eyes(x, 'big'); mouth(x, 'o'); },
    wink(x) { eyes(x, 'wink'); mouth(x, 'smirk'); },
    serious(x) { eyes(x); brows(x, 'angry'); mouth(x, 'flat'); },
    sleepy(x) { eyes(x, 'half'); mouth(x, 'small'); },
    silly(x) { eyes(x, 'cross'); mouth(x, 'tongue'); },
    cat(x) { eyes(x, 'big'); mouth(x, 'cat'); },
    mustache(x) { eyes(x); mouth(x, 'smile'); stache(x); }
  };
  function eyes(x, kind) {
    const y = 108, L = 86, R = 170, r = 17;
    x.fillStyle = INK; x.strokeStyle = INK; x.lineCap = 'round'; x.lineWidth = 11;
    const dot = (cx, big) => { x.beginPath(); x.arc(cx, y, big ? r + 5 : r, 0, PI * 2); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 6, y - 6, big ? 7 : 5, 0, PI * 2); x.fill(); x.fillStyle = INK; };
    const arc = (cx) => { x.beginPath(); x.arc(cx, y + 6, r + 2, PI * 1.15, PI * 1.85); x.stroke(); };
    const half = (cx) => { x.fillStyle = INK; x.beginPath(); x.arc(cx, y, r, 0, PI); x.fill(); x.beginPath(); x.moveTo(cx - r - 3, y - 2); x.lineTo(cx + r + 3, y - 2); x.stroke(); };
    const cross = (cx) => { x.beginPath(); x.moveTo(cx - 12, y - 12); x.lineTo(cx + 12, y + 12); x.moveTo(cx + 12, y - 12); x.lineTo(cx - 12, y + 12); x.stroke(); };
    if (kind === 'closed') { arc(L); arc(R); }
    else if (kind === 'big') { dot(L, true); dot(R, true); }
    else if (kind === 'wink') { dot(L); arc(R); }
    else if (kind === 'half') { half(L); half(R); }
    else if (kind === 'cross') { cross(L); cross(R); }
    else { dot(L); dot(R); }
  }
  function brows(x, kind) {
    x.strokeStyle = INK; x.lineWidth = 11; x.lineCap = 'round';
    if (kind === 'angry') { x.beginPath(); x.moveTo(60, 66); x.lineTo(108, 82); x.moveTo(196, 66); x.lineTo(148, 82); x.stroke(); }
  }
  function mouth(x, kind) {
    x.strokeStyle = INK; x.fillStyle = INK; x.lineWidth = 11; x.lineCap = 'round';
    if (kind === 'smile') { x.beginPath(); x.arc(128, 150, 36, PI * 0.15, PI * 0.85); x.stroke(); }
    else if (kind === 'smirk') { x.beginPath(); x.moveTo(96, 168); x.quadraticCurveTo(140, 190, 168, 158); x.stroke(); }
    else if (kind === 'grin') {
      x.beginPath(); x.moveTo(80, 158); x.quadraticCurveTo(128, 222, 176, 158); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(92, 164); x.lineTo(164, 164); x.lineTo(160, 178); x.lineTo(96, 178); x.closePath(); x.fill();
    }
    else if (kind === 'o') { x.beginPath(); x.ellipse(128, 170, 16, 20, 0, 0, PI * 2); x.fill(); }
    else if (kind === 'flat') { x.beginPath(); x.moveTo(98, 172); x.lineTo(158, 172); x.stroke(); }
    else if (kind === 'small') { x.beginPath(); x.moveTo(114, 172); x.lineTo(142, 172); x.stroke(); }
    else if (kind === 'tongue') {
      x.beginPath(); x.moveTo(90, 160); x.quadraticCurveTo(128, 200, 166, 160); x.stroke();
      x.fillStyle = '#FF6B8B'; x.beginPath(); x.ellipse(140, 186, 16, 22, -0.3, 0, PI * 2); x.fill();
    }
    else if (kind === 'cat') { x.beginPath(); x.moveTo(92, 160); x.quadraticCurveTo(110, 186, 128, 164); x.quadraticCurveTo(146, 186, 164, 160); x.stroke(); }
  }
  function stache(x) {
    x.fillStyle = '#3B2314'; x.beginPath();
    x.moveTo(128, 140); x.quadraticCurveTo(100, 118, 66, 140); x.quadraticCurveTo(84, 160, 128, 150); x.quadraticCurveTo(172, 160, 190, 140); x.quadraticCurveTo(156, 118, 128, 140); x.fill();
  }
  function faceTexture(kind) {
    const draw = FACES[kind] || FACES.smile;
    return tex(256, 256, x => { x.clearRect(0, 0, 256, 256); draw(x); });
  }

  /* ---------------- emblems (printed on tees) ---------------- */
  const EMBLEMS = {
    grug(x, s) { // a chunky wooden club
      x.save(); x.translate(s / 2, s / 2); x.rotate(-0.6); x.fillStyle = '#9BE338';
      x.beginPath(); x.moveTo(-s * .08, s * .34); x.lineTo(s * .08, s * .34); x.lineTo(s * .17, -s * .18); x.quadraticCurveTo(s * .2, -s * .4, 0, -s * .4); x.quadraticCurveTo(-s * .2, -s * .4, -s * .17, -s * .18); x.closePath(); x.fill();
      x.fillStyle = '#F6F1E7'; x.beginPath(); x.arc(s * .06, -s * .22, s * .035, 0, PI * 2); x.arc(-s * .05, -s * .1, s * .03, 0, PI * 2); x.fill(); x.restore();
    },
    fish(x, s) {
      x.save(); x.translate(s / 2, s / 2); x.fillStyle = '#F26A1B';
      x.beginPath(); x.ellipse(-s * .04, 0, s * .3, s * .17, 0, 0, PI * 2); x.fill();
      x.beginPath(); x.moveTo(s * .2, 0); x.lineTo(s * .4, -s * .18); x.lineTo(s * .4, s * .18); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(-s * .18, -s * .04, s * .05, 0, PI * 2); x.fill();
      x.fillStyle = INK; x.beginPath(); x.arc(-s * .17, -s * .04, s * .025, 0, PI * 2); x.fill(); x.restore();
    },
    taco(x, s) {
      x.save(); x.translate(s / 2, s / 2); x.fillStyle = '#F2B544'; x.beginPath(); x.arc(0, s * .1, s * .32, PI, 0); x.closePath(); x.fill();
      x.fillStyle = '#7A3E1B'; x.beginPath(); x.arc(0, s * .1, s * .25, PI, 0); x.closePath(); x.fill();
      x.fillStyle = '#2F9E44'; [-.2, -.08, .06, .18].forEach(k => { x.beginPath(); x.arc(k * s, -s * .06, s * .055, 0, PI * 2); x.fill(); });
      x.fillStyle = '#E03131'; [-.14, .12].forEach(k => { x.beginPath(); x.arc(k * s, -s * .02, s * .035, 0, PI * 2); x.fill(); }); x.restore();
    },
    boba(x, s) {
      x.save(); x.translate(s / 2, s / 2); x.fillStyle = '#F6C445';
      x.beginPath(); x.moveTo(-s * .2, -s * .3); x.lineTo(s * .2, -s * .3); x.lineTo(s * .15, s * .32); x.lineTo(-s * .15, s * .32); x.closePath(); x.fill();
      x.fillStyle = '#1E6B35'; [[-.08, .2], [.06, .22], [-.02, .1]].forEach(p => { x.beginPath(); x.arc(p[0] * s, p[1] * s, s * .045, 0, PI * 2); x.fill(); });
      x.strokeStyle = '#1E6B35'; x.lineWidth = s * .05; x.beginPath(); x.moveTo(s * .05, -s * .3); x.lineTo(s * .14, -s * .46); x.stroke(); x.restore();
    },
    sun(x, s) {
      x.save(); x.translate(s / 2, s / 2); x.fillStyle = '#B08A57'; x.beginPath(); x.arc(0, s * .05, s * .18, PI, 0); x.closePath(); x.fill();
      x.strokeStyle = '#B08A57'; x.lineWidth = s * .05; x.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const a = PI + i * PI / 6; x.beginPath(); x.moveTo(Math.cos(a) * s * .25, s * .05 + Math.sin(a) * s * .25); x.lineTo(Math.cos(a) * s * .36, s * .05 + Math.sin(a) * s * .36); x.stroke(); }
      x.beginPath(); x.moveTo(-s * .36, s * .12); x.lineTo(s * .36, s * .12); x.stroke(); x.restore();
    },
    cupcake(x, s) {
      x.save(); x.translate(s / 2, s / 2); x.fillStyle = '#C96A3C'; x.beginPath(); x.moveTo(-s * .22, 0); x.lineTo(s * .22, 0); x.lineTo(s * .16, s * .3); x.lineTo(-s * .16, s * .3); x.closePath(); x.fill();
      x.fillStyle = '#FFF4E8'; x.beginPath(); x.arc(-s * .12, -s * .04, s * .11, 0, PI * 2); x.arc(s * .12, -s * .04, s * .11, 0, PI * 2); x.arc(0, -s * .16, s * .13, 0, PI * 2); x.fill();
      x.fillStyle = '#E03131'; x.beginPath(); x.arc(0, -s * .3, s * .05, 0, PI * 2); x.fill(); x.restore();
    }
  };

  /* ---------------- part textures ---------------- */
  // A torso front: base color, optional emblem, optional details by kind.
  function torsoFront(kind, colors, emblem) {
    return tex(256, 256, (x, w, h) => {
      x.fillStyle = colors[0]; x.fillRect(0, 0, w, h);
      if (kind === 'jersey') { x.fillStyle = colors[1]; for (let y = 0; y < h; y += 64) x.fillRect(0, y + 16, w, 32); }
      if (kind === 'hoodie') { x.fillStyle = shade(colors[0], 0.8); x.fillRect(48, 150, 160, 70); x.strokeStyle = shade(colors[0], 0.6); x.lineWidth = 6; x.beginPath(); x.moveTo(100, 20); x.lineTo(100, 110); x.moveTo(156, 20); x.lineTo(156, 110); x.stroke(); }
      if (kind === 'jacket') { x.fillStyle = colors[1]; x.fillRect(0, 0, w, 26); x.fillStyle = shade(colors[0], 0.7); x.fillRect(124, 26, 8, 230); x.fillStyle = colors[1]; x.fillRect(16, 236, 224, 20); }
      if (kind === 'chefcoat') {
        x.fillStyle = colors[1]; x.fillRect(0, 0, w, 22);
        x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 4; x.beginPath(); x.moveTo(128, 22); x.lineTo(128, 256); x.stroke();
        x.fillStyle = colors[1]; [60, 110, 160, 210].forEach(y => { x.beginPath(); x.arc(92, y, 9, 0, PI * 2); x.arc(164, y, 9, 0, PI * 2); x.fill(); });
      }
      if (kind === 'apron') { x.fillStyle = colors[0]; }
      if (emblem && EMBLEMS[emblem]) { x.save(); x.translate(40, 48); EMBLEMS[emblem](x, 176); x.restore(); }
    });
  }
  // Side faces of an arm: top part sleeve, rest skin (tee), or all sleeve.
  function armTexture(kind, colors, skin) {
    return tex(64, 128, (x, w, h) => {
      x.fillStyle = skin; x.fillRect(0, 0, w, h);
      const sleeve = kind === 'tee' || kind === 'apron' ? 0.36 : 1;
      const col = kind === 'jacket' ? colors[1] : colors[0];
      x.fillStyle = col; x.fillRect(0, 0, w, Math.round(h * sleeve));
      if (kind === 'jersey') { x.fillStyle = colors[1]; for (let y = 0; y < h; y += 32) x.fillRect(0, y + 8, w, 16); }
      if (kind === 'chefcoat') { x.fillStyle = colors[1]; x.fillRect(0, h - 14, w, 14); }
    });
  }
  function legTexture(kind, colors, skin, side) {
    return tex(64, 128, (x, w, h) => {
      x.fillStyle = skin; x.fillRect(0, 0, w, h);
      const len = kind === 'shorts' ? 0.52 : 1;
      x.fillStyle = colors[0]; x.fillRect(0, 0, w, Math.round(h * len));
      if (kind === 'jeans') { x.strokeStyle = shade(colors[0], 1.35); x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke(); x.strokeRect(10, 6, 20, 18); }
      if (kind === 'checker') { x.fillStyle = colors[1]; for (let yy = 0; yy < h; yy += 16) for (let xx = 0; xx < w; xx += 16) if (((xx + yy) / 16) % 2) x.fillRect(xx, yy, 16, 16); }
      if (kind === 'track' && side === 'outer') { x.fillStyle = colors[1]; x.fillRect(w / 2 - 6, 0, 12, h); }
    });
  }

  /* ---------------- the rig ---------------- */
  const SKINNED = { hair: 'hairColor', hat: 'hatColor', shirt: 'shirtColor', pants: 'pantsColor', back: 'backColor' };
  function itemColors(it, avatar) {
    if (!it) return ['#888888'];
    if (it.colors) return it.colors.slice();
    if (it.recolor) return [avatar[SKINNED[it.slot]] || '#888888'];
    return ['#888888'];
  }

  function build(avatar) {
    avatar = C.normalize(avatar);
    const group = new T.Group();
    const pivots = {};
    const disposables = [];
    const track = o => { disposables.push(o); return o; };
    const mesh = (geo, m, px, py, pz) => { const me = new T.Mesh(geo, m); if (px != null) me.position.set(px, py, pz); track(m); return me; };

    // pivots: root (0,0,0 at feet), torso, head (y=4), shoulders (y=4), hips (y=2)
    const root = new T.Group(); group.add(root);
    const torsoP = new T.Group(); torsoP.position.set(0, 2, 0); root.add(torsoP);
    const headP = new T.Group(); headP.position.set(0, 2, 0); torsoP.add(headP);          // world y=4
    const armLP = new T.Group(); armLP.position.set(-1.5, 2, 0); torsoP.add(armLP);      // left shoulder
    const armRP = new T.Group(); armRP.position.set(1.5, 2, 0); torsoP.add(armRP);
    const legLP = new T.Group(); legLP.position.set(-0.5, 2, 0); root.add(legLP);        // hips at world y=2
    const legRP = new T.Group(); legRP.position.set(0.5, 2, 0); root.add(legRP);
    Object.assign(pivots, { root, torsoP, headP, armLP, armRP, legLP, legRP });
    [torsoP, headP, armLP, armRP, legLP, legRP].forEach(p => { p.userData.pivot = true; });

    function clearParts() {
      disposables.forEach(o => { try { if (o.map) o.map.dispose(); o.dispose && o.dispose(); } catch (e) {} });
      disposables.length = 0;
      [torsoP, headP, armLP, armRP, legLP, legRP].forEach(p => { for (let i = p.children.length - 1; i >= 0; i--) { const c = p.children[i]; if (!c.userData.pivot) p.remove(c); } });
    }

    function set(a) {
      avatar = C.normalize(a);
      clearParts();
      const skin = avatar.skin;
      const shirt = C.get(avatar.shirt), pants = C.get(avatar.pants), hair = C.get(avatar.hair), hat = C.get(avatar.hat), back = C.get(avatar.back), hand = C.get(avatar.hand), face = C.get(avatar.face);
      const sc = itemColors(shirt, avatar), pc = itemColors(pants, avatar);
      const skinM = () => track(mat(skin));

      /* torso */
      const tk = shirt ? shirt.kind : 'tee';
      const torsoSide = track(mat(tk === 'jersey' ? sc[0] : (tk === 'jacket' ? sc[0] : sc[0])));
      const torsoFrontM = track(new T.MeshLambertMaterial({ map: torsoFront(tk, sc, shirt && shirt.emblem) }));
      const torsoBackM = track(mat(sc[0]));
      const torsoTop = track(mat(tk === 'chefcoat' || tk === 'jacket' ? sc[1] : sc[0]));
      const torso = new T.Mesh(rbox(2, 2, 1, 0.08), [torsoSide, torsoSide, torsoTop, track(mat(pc[0])), torsoFrontM, torsoBackM]);
      torso.position.set(0, 1, 0); torsoP.add(torso);
      if (tk === 'hoodie') { const hood = mesh(rbox(1.5, 0.55, 1.1, 0.12), mat(sc[0]), 0, 2.05, -0.25); hood.rotation.x = 0.25; torsoP.add(hood); }
      if (tk === 'apron') {
        const am = track(mat(sc[1]));
        torsoP.add(new T.Mesh(rbox(1.1, 0.9, 0.08, 0.03), am).translateY(1.5).translateZ(0.56));
        torsoP.add(new T.Mesh(rbox(1.9, 1.0, 0.08, 0.03), am).translateY(0.55).translateZ(0.56));
        const strapM = track(mat(shade(sc[1], 0.75)));
        [-0.45, 0.45].forEach(x => { torsoP.add(new T.Mesh(rbox(0.12, 0.55, 0.14, 0.02), strapM).translateX(x).translateY(2.0).translateZ(0.5)); });
      }

      /* head + face */
      const headM = skinM();
      const head = new T.Mesh(rbox(1.2, 1.2, 1.2, 0.1), headM); head.position.set(0, 0.6, 0); headP.add(head);
      const faceM = track(new T.MeshBasicMaterial({ map: faceTexture(face ? face.kind : 'smile'), transparent: true, depthWrite: false }));
      const fp = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), faceM); fp.position.set(0, 0.6, 0.603); fp.renderOrder = 2; headP.add(fp);

      /* arms (left arm mesh hangs from shoulder) */
      const armT = armTexture(tk, sc, skin);
      const armSide = track(new T.MeshLambertMaterial({ map: armT }));
      const armTop = track(mat(tk === 'tee' || tk === 'apron' ? sc[0] : (tk === 'jacket' ? sc[1] : sc[0])));
      const armBottom = skinM();
      const armMats = [armSide, armSide, armTop, armBottom, armSide, armSide];
      [armLP, armRP].forEach(p => { const a = new T.Mesh(rbox(1, 2, 1, 0.08), armMats); a.position.set(0, -1, 0); p.add(a); });

      /* legs */
      const pk = pants ? pants.kind : 'pants';
      const legIn = track(new T.MeshLambertMaterial({ map: legTexture(pk, pc, skin, 'inner') }));
      const legOut = track(new T.MeshLambertMaterial({ map: legTexture(pk, pc, skin, 'outer') }));
      const legTop = track(mat(pc[0])), legBottom = track(mat(pk === 'shorts' ? skin : shade(pc[0], 0.8)));
      const legL = new T.Mesh(rbox(1, 2, 1, 0.08), [legIn, legOut, legTop, legBottom, legIn, legIn]); legL.position.set(0, -1, 0); legLP.add(legL);
      const legR = new T.Mesh(rbox(1, 2, 1, 0.08), [legOut, legIn, legTop, legBottom, legIn, legIn]); legR.position.set(0, -1, 0); legRP.add(legR);

      /* hair (the top is hidden under hats that cover it) */
      if (hair) addHair(headP, hair.kind, avatar.hairColor, track, !!(hat && COVERS.has(hat.kind)));
      /* hat */
      if (hat) addHat(headP, hat.kind, itemColors(hat, avatar), track);
      /* back */
      if (back) addBack(torsoP, back.kind, itemColors(back, avatar), track);
      /* hand (right hand, swings with the arm) */
      if (hand) addHand(armRP, hand.kind, track);
    }

    /* ---- poses ---- */
    const J = { torsoY: 0, torsoRy: 0, torsoRx: 0, headRx: 0, headRz: 0, headRy: 0, alx: 0, alz: 0, arx: 0, arz: 0, llx: 0, lrx: 0, handWag: 0 };
    const target = Object.assign({}, J);
    let animName = 'idle', animT = 0, animUntil = 0, animOpts = {};
    const anims = {
      idle(t, o) { o.torsoY = 0.03 * Math.sin(t * 2.1); o.alz = 0.06 * Math.sin(t * 2.1); o.arz = -0.06 * Math.sin(t * 2.1); o.headRy = 0.08 * Math.sin(t * 0.7); o.headRz = 0.02 * Math.sin(t * 1.3); o.llx = o.lrx = 0; o.torsoRx = 0; o.headRx = 0; o.torsoRy = 0; o.alx = o.arx = 0; },
      wave(t, o) { anims.idle(t, o); o.arz = -2.5 + 0.1 * Math.sin(t * 2); o.arx = 0.2; o.handWag = 0.35 * Math.sin(t * 9); o.headRz = -0.08; },
      cheer(t, o) { o.alz = 2.9; o.arz = -2.9; o.alx = o.arx = 0.15 * Math.sin(t * 10); o.torsoY = 0.35 * Math.abs(Math.sin(t * 5.5)); o.llx = -0.2 * Math.abs(Math.sin(t * 5.5)); o.lrx = -0.2 * Math.abs(Math.sin(t * 5.5)); o.headRx = -0.15; o.headRy = 0; o.headRz = 0; o.torsoRx = 0; o.torsoRy = 0; },
      happy(t, o) { anims.idle(t, o); o.alz = 0.9 + 0.1 * Math.sin(t * 6); o.arz = -0.9 - 0.1 * Math.sin(t * 6); o.alx = o.arx = -0.5; o.torsoY = 0.12 * Math.abs(Math.sin(t * 6)); o.headRx = -0.1; },
      sad(t, o) { o.torsoY = -0.05; o.torsoRx = 0.18; o.headRx = 0.45; o.headRz = 0.12 * Math.sin(t * 0.8); o.headRy = 0; o.alx = o.arx = 0.25; o.alz = 0.08; o.arz = -0.08; o.llx = o.lrx = 0; o.torsoRy = 0; },
      think(t, o) { anims.idle(t, o); o.arz = -0.6; o.arx = -1.9; o.headRz = 0.18; o.headRx = -0.05; },
      dance(t, o) { o.torsoY = 0.12 * Math.abs(Math.sin(t * 6)); o.torsoRy = 0.3 * Math.sin(t * 3); o.alz = 1.2 + 1.2 * Math.sin(t * 6); o.arz = -1.2 + 1.2 * Math.sin(t * 6); o.alx = o.arx = -0.3; o.llx = 0.3 * Math.sin(t * 6); o.lrx = -0.3 * Math.sin(t * 6); o.headRz = 0.15 * Math.sin(t * 3); o.headRx = 0; o.headRy = 0; o.torsoRx = 0; },
      walk(t, o) { o.torsoY = 0.05 * Math.abs(Math.sin(t * 7)); o.alx = 0.7 * Math.sin(t * 7); o.arx = -0.7 * Math.sin(t * 7); o.llx = -0.7 * Math.sin(t * 7); o.lrx = 0.7 * Math.sin(t * 7); o.alz = o.arz = 0; o.headRx = 0; o.headRy = 0; o.headRz = 0; o.torsoRx = 0.05; o.torsoRy = 0; },
      sit(t, o) { o.torsoY = -1.0; o.llx = o.lrx = -1.5; o.alx = o.arx = -0.3; o.alz = o.arz = 0; o.headRy = 0.1 * Math.sin(t * 0.7); o.headRx = 0; o.headRz = 0; o.torsoRx = 0; o.torsoRy = 0; }
    };
    function play(name, opts) { animName = anims[name] ? name : 'idle'; animOpts = opts || {}; animUntil = animOpts.ms ? performance.now() + animOpts.ms : 0; }
    let wing = null;
    function update(dt, now) {
      animT += dt;
      if (animUntil && performance.now() > animUntil) { animName = 'idle'; animUntil = 0; }
      (anims[animName] || anims.idle)(animT, target);
      const k = 1 - Math.exp(-dt * 12);
      for (const key in J) J[key] += (target[key] - J[key]) * k;
      root.position.y = J.torsoY; torsoP.rotation.set(J.torsoRx, J.torsoRy, 0);
      headP.rotation.set(J.headRx, J.headRy, J.headRz);
      armLP.rotation.set(J.alx, 0, J.alz); armRP.rotation.set(J.arx, J.handWag, J.arz);
      legLP.rotation.set(J.llx, 0, 0); legRP.rotation.set(J.lrx, 0, 0);
      root.traverse(o => { if (o.userData.flap) o.rotation.y = o.userData.flap * (0.35 + 0.25 * Math.sin(animT * 4)); if (o.userData.flame) { o.scale.y = 1 + 0.18 * Math.sin(animT * 17); o.scale.x = o.scale.z = 1 + 0.1 * Math.sin(animT * 13 + 1); } });
    }
    function dispose() { clearParts(); }
    set(avatar);
    return { group, pivots, set, play, update, dispose, get avatar() { return avatar; }, get anim() { return animName; } };
  }

  /* ---------------- hair ---------------- */
  const COVERS = new Set(['cap', 'beanie', 'cowboy', 'toque', 'bobahat', 'tacohat', 'party']); // hats that hide the top of the hair
  function addHair(headP, kind, color, track, covered) {
    const m = track(mat(color)), md = track(mat(shade(color, 0.85)));
    const add = (geo, mm, x, y, z, rx, ry, rz) => { const me = new T.Mesh(geo, mm || m); me.position.set(x, y, z); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); headP.add(me); return me; };
    const top = () => { if (!covered) add(rbox(1.3, 0.4, 1.3, 0.1), m, 0, 1.12, 0); };
    const back = (h, d) => add(rbox(1.3, h, d || 0.22, 0.08), md, 0, 1.2 - h / 2, -0.62);
    const bangs = (h) => add(rbox(1.3, h || 0.16, 0.14, 0.04), m, 0, 1.0, 0.6);
    if (kind === 'short') { top(); back(0.6); bangs(); }
    else if (kind === 'bob') { top(); back(1.05, 0.24); [-0.66, 0.66].forEach(x => add(rbox(0.22, 1.0, 1.25, 0.06), md, x, 0.7, -0.05)); bangs(0.22); }
    else if (kind === 'long') { top(); back(2.1, 0.3); [-0.66, 0.66].forEach(x => add(rbox(0.22, 1.9, 1.2, 0.06), md, x, 0.2, -0.1)); bangs(0.22); }
    else if (kind === 'spiky') { top(); back(0.5); if (!covered) [[-0.35, 0.25, -0.35], [0.0, 0.5, 0], [0.38, 0.2, 0.32], [-0.3, 0.35, 0.3], [0.3, 0.3, -0.3]].forEach(p => add(rbox(0.3, 0.55, 0.3, 0.1), m, p[0], 1.35 + p[1] * 0.3, p[2], p[2] * 0.6, 0, -p[0] * 0.9)); }
    else if (kind === 'buns') { top(); back(0.5); if (!covered) [-0.58, 0.58].forEach(x => add(sph(0.3, 14), m, x, 1.45, -0.05)); bangs(); }
    else if (kind === 'curly') { if (covered) { back(0.8, 0.3); [-0.7, 0.7].forEach(x => add(sph(0.26, 10), md, x, 0.75, -0.2)); } else { add(rbox(1.6, 1.0, 1.42, 0.3), m, 0, 1.0, -0.08); [[-0.75, 1.3, 0.3], [0.78, 1.35, -0.2], [0.3, 1.55, 0.5], [-0.4, 1.6, -0.5], [0.72, 0.7, 0.4], [-0.78, 0.6, -0.4]].forEach(p => add(sph(0.24, 10), md, p[0], p[1], p[2])); } }
    else if (kind === 'ponytail') { top(); back(0.7); bangs(); add(rbox(0.36, 1.2, 0.36, 0.14), md, 0, 0.45, -0.85, -0.25, 0, 0); add(rbox(0.5, 0.2, 0.5, 0.08), track(mat(shade(color, 0.6))), 0, 1.0, -0.72); }
    else if (kind === 'mohawk') { if (!covered) { add(rbox(0.34, 0.6, 1.3, 0.1), m, 0, 1.45, 0); add(rbox(1.26, 0.12, 1.26, 0.04), md, 0, 1.2, 0); } }
  }

  /* ---------------- hats ---------------- */
  function addHat(headP, kind, colors, track) {
    const c0 = colors[0], c1 = colors[1] || shade(colors[0], 0.8);
    const m = track(mat(c0)), m1 = track(mat(c1));
    const add = (geo, mm, x, y, z, rx, ry, rz) => { const me = new T.Mesh(geo, mm || m); me.position.set(x, y, z); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); headP.add(me); return me; };
    if (kind === 'cap') { add(rbox(1.36, 0.55, 1.36, 0.22), m, 0, 1.3, 0); add(rbox(1.2, 0.09, 0.62, 0.04), m1, 0, 1.12, 0.9, -0.08); add(sph(0.08, 8), m1, 0, 1.6, 0); }
    else if (kind === 'beanie') { add(rbox(1.38, 0.78, 1.38, 0.28), m, 0, 1.38, 0); add(rbox(1.46, 0.26, 1.46, 0.08), m1, 0, 1.1, 0); add(sph(0.2, 12), m1, 0, 1.85, 0); }
    else if (kind === 'headband') {
      add(rbox(1.34, 0.24, 1.34, 0.05), m, 0, 0.98, 0);
      const em = track(texMat(64, 64, x => { x.fillStyle = c0; x.fillRect(0, 0, 64, 64); x.fillStyle = c1; x.beginPath(); x.arc(32, 32, 14, 0, PI * 2); x.fill(); }));
      add(new T.PlaneGeometry(0.4, 0.24), em, 0, 0.98, 0.675);
      [-0.15, 0.15].forEach((x, i) => add(rbox(0.12, 0.7, 0.06, 0.02), m, x, 0.7, -0.7, 0.15, 0, i ? -0.25 : 0.25));
    }
    else if (kind === 'tacohat') {
      // a half cylinder lying front-to-back with the curve underneath: a taco shell resting on the head, open side up
      const shellG = new T.CylinderGeometry(0.82, 0.82, 1.5, 24, 1, false, PI * 1.5, PI).rotateX(PI / 2);
      add(shellG, track(new T.MeshLambertMaterial({ color: '#F2B544', side: T.DoubleSide })), 0, 1.8, 0);
      add(rbox(1.2, 0.34, 1.3, 0.1), track(mat('#7A3E1B')), 0, 1.4, 0);
      add(rbox(1.3, 0.18, 1.4, 0.08), track(mat('#2F9E44')), 0, 1.62, 0);
      [[-0.4, 0.2], [0.3, -0.25], [0.1, 0.35]].forEach(p => add(sph(0.1, 8), track(mat('#E03131')), p[0], 1.62, p[1]));
      [[-0.1, -0.1], [0.45, 0.2]].forEach(p => add(sph(0.08, 8), track(mat('#FFD43B')), p[0], 1.62, p[1]));
    }
    else if (kind === 'bobahat') {
      const cup = track(mat('#F6C445')); add(cyl(0.5, 0.4, 0.95, 20), cup, 0, 1.68, 0);
      add(cyl(0.54, 0.54, 0.16, 20), track(mat('#F6F1E7')), 0, 2.2, 0);
      add(sph(0.52, 18), track(mat('#F6F1E7')), 0, 2.25, 0).scale.set(1, 0.4, 1);
      [[0.25, 1.33, 0.3], [-0.2, 1.3, 0.35], [0.1, 1.5, 0.42], [-0.3, 1.5, 0.3], [0.35, 1.6, 0.25]].forEach(p => add(sph(0.08, 8), track(mat('#1E2A21')), p[0], p[1], p[2]));
      add(cyl(0.05, 0.05, 1.0, 10), track(mat('#1E6B35')), 0.15, 2.6, 0, 0.18, 0, -0.2);
    }
    else if (kind === 'leafcrown') {
      add(new T.TorusGeometry(0.7, 0.07, 10, 28), track(mat('#2E8B57')), 0, 1.02, 0, PI / 2, 0, 0);
      const leaf = track(mat('#5BB763'));
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; add(rbox(0.42, 0.06, 0.2, 0.04), leaf, Math.cos(a) * 0.72, 1.12, Math.sin(a) * 0.72, 0, -a, 0.6); }
    }
    else if (kind === 'toque') { const w = track(mat('#F6F1E7')); add(cyl(0.58, 0.58, 0.3, 24), w, 0, 1.32, 0); add(cyl(0.6, 0.5, 0.9, 24), w, 0, 1.9, 0); add(sph(0.7, 20), w, 0, 2.3, 0).scale.set(1, 0.6, 1); }
    else if (kind === 'cowboy') { const b = track(mat('#8B5A2B')); const brim = add(cyl(1.2, 1.2, 0.08, 28), b, 0, 1.22, 0); brim.scale.set(1, 1, 0.85); add(rbox(1.1, 0.75, 1.05, 0.18), b, 0, 1.6, 0); add(rbox(1.16, 0.16, 1.11, 0.03), track(mat('#2B2B2B')), 0, 1.36, 0); }
    else if (kind === 'crown') {
      const g = track(mat('#FFD447')); add(cyl(0.72, 0.68, 0.45, 24, true), track(new T.MeshLambertMaterial({ color: '#FFD447', side: T.DoubleSide })), 0, 1.45, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; add(new T.ConeGeometry(0.16, 0.42, 4), g, Math.cos(a) * 0.68, 1.85, Math.sin(a) * 0.68, 0, -a + PI / 4, 0); }
      ['#E03131', '#2D9BF0', '#2E8B57'].forEach((c, i) => { const a = i / 3 * PI * 2 + 0.5; add(sph(0.07, 8), track(mat(c)), Math.cos(a) * 0.72, 1.45, Math.sin(a) * 0.72); });
    }
    else if (kind === 'headphones') {
      const b = track(mat('#2B2B2B')); add(new T.TorusGeometry(0.78, 0.08, 10, 24, PI), b, 0, 0.62, 0);
      [-0.72, 0.72].forEach(x => { add(cyl(0.3, 0.3, 0.22, 18), b, x, 0.6, 0, 0, 0, PI / 2); add(cyl(0.22, 0.22, 0.06, 16), track(mat('#FF7A1A')), x * 1.17, 0.6, 0, 0, 0, PI / 2); });
    }
    else if (kind === 'party') {
      const pm = track(texMat(64, 64, x => { x.fillStyle = '#FF5CA8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#FFD447'; for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64); }));
      add(new T.ConeGeometry(0.42, 1.05, 20), pm, 0, 1.72, 0); add(sph(0.12, 10), track(mat('#9BE338')), 0, 2.28, 0);
    }
  }

  /* ---------------- back items ---------------- */
  function addBack(torsoP, kind, colors, track) {
    const add = (geo, mm, x, y, z, rx, ry, rz) => { const me = new T.Mesh(geo, mm); me.position.set(x, y, z); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); torsoP.add(me); return me; };
    if (kind === 'backpack') { const m = track(mat(colors[0])), d = track(mat(shade(colors[0], 0.75))); add(rbox(1.3, 1.5, 0.55, 0.14), m, 0, 1.0, -0.82); add(rbox(0.9, 0.6, 0.2, 0.08), d, 0, 0.7, -1.15); [-0.5, 0.5].forEach(x => add(rbox(0.16, 1.4, 0.1, 0.03), d, x, 1.2, 0.52)); }
    else if (kind === 'maki') {
      const nori = track(mat('#1E2A21'));
      const r = add(cyl(0.6, 0.6, 1.5, 20), nori, 0, 1.0, -0.95, 0, 0, PI / 2);
      const end = track(texMat(128, 128, x => { x.fillStyle = '#F6F1E7'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#FF8FB1'; x.beginPath(); x.arc(64, 64, 26, 0, PI * 2); x.fill(); x.fillStyle = '#5BB763'; x.fillRect(44, 44, 14, 40); x.fillStyle = '#FFD43B'; x.fillRect(66, 50, 16, 16); }));
      [-0.78, 0.78].forEach((x, i) => { const e = add(new T.CircleGeometry(0.58, 20), end, x, 1.0, -0.95, 0, i ? PI / 2 : -PI / 2, 0); });
      [-0.5, 0.5].forEach(x => add(rbox(0.16, 1.4, 0.1, 0.03), nori, x, 1.2, 0.52));
    }
    else if (kind === 'chili') {
      const red = track(mat('#E03131'));
      const body = add(sph(0.32, 16), red, 1.5, 2.45, -0.1); body.scale.set(0.85, 1.25, 0.85); body.rotation.z = -0.3;
      add(cyl(0.05, 0.08, 0.3, 8), track(mat('#2E8B57')), 1.62, 2.95, -0.1, 0, 0, -0.4);
      const faceM = track(new T.MeshBasicMaterial({ map: tex(64, 64, x => { x.fillStyle = INK; x.beginPath(); x.arc(22, 26, 5, 0, PI * 2); x.arc(42, 26, 5, 0, PI * 2); x.fill(); x.strokeStyle = INK; x.lineWidth = 3; x.beginPath(); x.arc(32, 36, 9, 0.2, PI - 0.2); x.stroke(); }), transparent: true }));
      add(new T.PlaneGeometry(0.4, 0.4), faceM, 1.5, 2.5, 0.2);
    }
    else if (kind === 'pearl') { const p = track(mat('#1E2A21')); const b = add(sph(0.8, 24), p, 0, 1.0, -1.1); add(sph(0.14, 10), track(mat('#F6F1E7')), -0.3, 1.45, -1.6); [-0.5, 0.5].forEach(x => add(rbox(0.16, 1.4, 0.1, 0.03), p, x, 1.2, 0.52)); }
    else if (kind === 'cape') { const m = track(mat(colors[0])), d = track(mat(shade(colors[0], 0.8))); const cp = add(rbox(2.2, 2.8, 0.08, 0.04), m, 0, 0.75, -0.72, 0.1, 0, 0); add(rbox(2.3, 0.3, 0.3, 0.1), d, 0, 2.05, -0.45); }
    else if (kind === 'wings') {
      const wm = track(texMat(128, 64, x => { const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#FF7A1A'); g.addColorStop(1, '#FFD447'); x.fillStyle = g; x.fillRect(0, 0, 128, 64); x.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 20; i < 128; i += 26) x.fillRect(i, 0, 4, 64); }));
      [-1, 1].forEach(s => { const pivot = new T.Group(); pivot.position.set(s * 0.3, 1.6, -0.6); pivot.userData.flap = s; torsoP.add(pivot); const w = new T.Mesh(rbox(1.7, 1.0, 0.06, 0.03), wm); w.position.set(s * 0.85, 0.1, -0.1); w.rotation.z = s * 0.35; pivot.add(w); const w2 = new T.Mesh(rbox(1.1, 0.7, 0.06, 0.03), wm); w2.position.set(s * 1.0, -0.55, -0.12); w2.rotation.z = s * 0.1; pivot.add(w2); });
    }
  }

  /* ---------------- hand items (attached to the right arm pivot; hand is at y=-2 of the pivot) ---------------- */
  function addHand(armP, kind, track) {
    const h = new T.Group(); h.position.set(0, -1.9, 0); armP.add(h);
    const add = (geo, mm, x, y, z, rx, ry, rz) => { const me = new T.Mesh(geo, mm); me.position.set(x, y, z); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); h.add(me); return me; };
    if (kind === 'club') { add(cyl(0.3, 0.13, 1.5, 12), track(mat('#8B5A2B')), 0.1, 0.55, 0.55, 1.2, 0, 0); [[0.02, 0.9, 0.86], [-0.1, 1.05, 0.6], [0.14, 1.2, 0.72]].forEach(p => add(sph(0.08, 8), track(mat('#5C3A21')), p[0], p[1], p[2])); }
    else if (kind === 'chopsticks') { const w = track(mat('#E8C98C')); [-0.06, 0.06].forEach(x => add(cyl(0.025, 0.04, 1.3, 8), w, x, 0.2, 0.5, 1.3, 0, 0)); }
    else if (kind === 'taco') { add(new T.CylinderGeometry(0.34, 0.34, 0.62, 16, 1, false, PI, PI).rotateZ(PI / 2), track(new T.MeshLambertMaterial({ color: '#F2B544', side: T.DoubleSide })), 0, 0.2, 0.5); add(rbox(0.5, 0.16, 0.44, 0.05), track(mat('#7A3E1B')), 0, 0.1, 0.5); add(rbox(0.55, 0.08, 0.5, 0.04), track(mat('#2F9E44')), 0, 0.22, 0.5); add(sph(0.06, 8), track(mat('#E03131')), 0.12, 0.28, 0.55); }
    else if (kind === 'bobacup') { add(cyl(0.23, 0.18, 0.6, 16), track(mat('#F6C445')), 0, 0.1, 0.45); add(cyl(0.25, 0.25, 0.08, 16), track(mat('#F6F1E7')), 0, 0.42, 0.45); add(cyl(0.03, 0.03, 0.5, 8), track(mat('#1E6B35')), 0.06, 0.65, 0.45, 0, 0, -0.15); [[0.08, -0.12, 0.62], [-0.07, -0.08, 0.6], [0.02, -0.15, 0.3]].forEach(p => add(sph(0.045, 8), track(mat('#1E2A21')), p[0], p[1], p[2])); }
    else if (kind === 'coffeecup') { add(cyl(0.22, 0.17, 0.62, 16), track(mat('#F6F1E7')), 0, 0.1, 0.45); add(cyl(0.235, 0.21, 0.26, 16), track(mat('#5F5C37')), 0, 0.08, 0.45); add(cyl(0.24, 0.22, 0.08, 16), track(mat('#2B2B2B')), 0, 0.44, 0.45); }
    else if (kind === 'whisk') { const s = track(mat('#9E9E9E')); add(cyl(0.05, 0.05, 0.7, 8), track(mat('#C0392B')), 0, 0.1, 0.5, 1.5, 0, 0); for (let i = 0; i < 3; i++) add(new T.TorusGeometry(0.2, 0.015, 6, 16), s, 0, 0.35, 0.95, 0, i * PI / 3, 0).scale.set(1, 1.6, 1); }
    else if (kind === 'torch') { add(cyl(0.07, 0.09, 1.1, 8), track(mat('#8B5A2B')), 0, 0.3, 0.5, 1.45, 0, 0); const f = add(new T.ConeGeometry(0.2, 0.55, 10), track(mat('#FF7A1A')), 0, 0.95, 0.65); f.userData.flame = 1; add(sph(0.12, 8), track(mat('#FFD447')), 0, 0.85, 0.65); }
  }

  /* ---------------- scenes, lights, renderers ---------------- */
  function lights(scene) {
    scene.add(new T.HemisphereLight(0xffffff, 0x6a5a48, 1.1));
    const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(3, 7, 5); scene.add(key);
    const rim = new T.DirectionalLight(0xffe9c9, 0.5); rim.position.set(-4, 4, -5); scene.add(rim);
    const fill = new T.DirectionalLight(0xdfe9ff, 0.35); fill.position.set(-5, 2, 4); scene.add(fill);
  }
  function groundBlob() {
    const m = new T.MeshBasicMaterial({ map: tex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 60); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false });
    const p = new T.Mesh(new T.PlaneGeometry(3.6, 3.6), m); p.rotation.x = -PI / 2; p.position.y = 0.005; p.renderOrder = -1; return p;
  }
  // frame: 'full' | 'bust' (head + hat) | 'torso' (shirt) | 'legs' (pants) | 'hand' (right hand) | true (= bust)
  function frameCamera(cam, frame, aspect) {
    if (frame === true) frame = 'bust';
    if (frame === 'bust') { cam.position.set(0, 5.25, 5.7); cam.lookAt(0, 4.95, 0); cam.fov = 30; }
    else if (frame === 'torso') { cam.position.set(0, 3.6, 8.2); cam.lookAt(0, 3.3, 0); cam.fov = 30; }
    else if (frame === 'legs') { cam.position.set(0, 1.6, 8.2); cam.lookAt(0, 1.4, 0); cam.fov = 30; }
    else if (frame === 'hand') { cam.position.set(0.9, 2.6, 7.6); cam.lookAt(0.9, 2.3, 0); cam.fov = 30; }
    else { cam.position.set(0, 3.7, 13.2); cam.lookAt(0, 3.25, 0); cam.fov = 34; }
    cam.aspect = aspect; cam.updateProjectionMatrix();
  }

  /* live viewer */
  function mount(el, avatar, opts) {
    opts = opts || {};
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;outline:none';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const scene = new T.Scene(); lights(scene);
    if (opts.ground !== false && !opts.bust) scene.add(groundBlob());
    const rig = build(avatar); scene.add(rig.group);
    const cam = new T.PerspectiveCamera(32, 1, 0.1, 100);
    let yaw = opts.yaw || 0, pitch = 0, vel = 0, dragging = false, lastX = 0, lastY = 0, idleSpin = opts.autoRotate ? 0.25 : 0, raf = 0, last = 0, alive = true;
    const zoom = opts.zoom || 1;
    function resize() { const w = el.clientWidth || 200, h = el.clientHeight || 260; renderer.setSize(w, h, false); frameCamera(cam, opts.frame || (opts.bust ? 'bust' : 'full'), w / h); cam.position.multiplyScalar(1 / zoom); }
    resize();
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(el);
    const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0; renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(e.pointerId); };
    const onMove = e => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; yaw += dx * 0.012; vel = dx * 0.012; pitch = Math.max(-0.35, Math.min(0.35, pitch + dy * 0.004)); };
    const onUp = () => { dragging = false; };
    if (opts.orbit !== false) { renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointercancel', onUp); renderer.domElement.addEventListener('pointerleave', onUp); }
    if (opts.onTap) renderer.domElement.addEventListener('click', e => { if (Math.abs(vel) < 0.02) opts.onTap(e); });
    let visible = true;
    const io = root.IntersectionObserver ? new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0 }) : null; if (io) io.observe(el);
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (!visible || document.hidden) return;
      if (!dragging) { yaw += vel; vel *= 0.92; yaw += idleSpin * dt; pitch *= 0.95; }
      rig.group.rotation.y = yaw; rig.group.rotation.x = pitch;
      rig.update(dt, now); renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);
    const api = {
      rig, renderer, scene, camera: cam,
      setAvatar(a) { rig.set(a); },
      play(name, o) { rig.play(name, o); },
      spinTo(y) { yaw = y; },
      destroy() { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); rig.dispose(); renderer.dispose(); try { el.removeChild(renderer.domElement); } catch (e) {} }
    };
    el.__grugView = api;
    return api;
  }

  /* still images: one shared offscreen renderer */
  let snapR = null, snapScene = null, snapCam = null;
  function snapshot(avatar, opts) {
    opts = opts || {};
    const size = opts.size || 256, w = size, h = opts.height || size;
    if (!snapR) {
      snapR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      snapR.setPixelRatio(1); snapR.outputColorSpace = T.SRGBColorSpace;
      snapScene = new T.Scene(); lights(snapScene);
      snapCam = new T.PerspectiveCamera(32, 1, 0.1, 100);
    }
    snapR.setSize(w, h, false);
    const rig = build(avatar); snapScene.add(rig.group);
    rig.play(opts.pose || 'idle');
    for (let i = 0; i < 40; i++) rig.update(1 / 30, i * 33); // settle the pose
    rig.group.rotation.y = opts.yaw == null ? 0.35 : opts.yaw;
    frameCamera(snapCam, opts.frame || (opts.bust ? 'bust' : 'full'), w / h);
    if (opts.zoom) snapCam.position.multiplyScalar(1 / opts.zoom);
    snapR.setClearColor(0x000000, 0);
    snapR.render(snapScene, snapCam);
    const url = snapR.domElement.toDataURL('image/png');
    snapScene.remove(rig.group); rig.dispose();
    return url;
  }
  const thumbCache = new Map();
  function thumb(itemId, avatar, size) {
    const it = C.get(itemId); if (!it) return '';
    const a = C.normalize(avatar); a[it.slot] = itemId;
    if (it.recolor) { const key = SKINNED[it.slot]; if (key && !a[key]) a[key] = '#2D9BF0'; }
    const key = itemId + '|' + C.hash(a) + '|' + (size || 160);
    if (thumbCache.has(key)) return thumbCache.get(key);
    const frame = { hat: 'bust', hair: 'bust', face: 'bust', shirt: 'torso', pants: 'legs', hand: 'hand', back: 'full' }[it.slot] || 'full';
    const url = snapshot(a, { size: size || 160, frame, yaw: it.slot === 'back' ? PI * 0.82 : (it.slot === 'hand' ? -0.2 : 0.35) });
    if (thumbCache.size > 300) thumbCache.clear();
    thumbCache.set(key, url);
    return url;
  }
  function skinThumb(hex, size) {
    const a = C.normalize({ skin: hex, hair: null, hat: null, face: 'face-smile' });
    return snapshot(a, { size: size || 96, frame: 'bust', yaw: 0.25 });
  }

  root.GrugAvatar = { build, mount, snapshot, thumb, skinThumb, FACES: Object.keys(FACES) };
})(typeof window !== 'undefined' ? window : globalThis);
