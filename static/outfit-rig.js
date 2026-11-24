/* GrugOutfitRig · puts the player's saved outfit (GrugOutfits, static/outfits.js) on a game's blocky R6 character.

   Needs three.js r128 (window.THREE) and its GLTFLoader (/static/vendor/three-r128-GLTFLoader.js), plus /static/outfits.js.

   const look = await GrugOutfitRig.load()      // the outfit they play as, parsed: { id, name, parts, starter, isDefault }; with none
                                                //   picked it's the default character, Grug (isDefault: true); null only if three/GLTFLoader are missing
   Games keep their own player / NPC names when look.starter or look.isDefault is set (those outfits are named "Grug", "Ranger"…).
   const npcs = await GrugOutfitRig.others(6)   // the player's other saved outfits, for the game's other players / NPCs
   const kit  = await GrugOutfitRig.fromURL('/arcade/outfits/ranger.glb', 'Ranger')   // a character file shipped with the site
   GrugOutfitRig.dress(rig, look)               // dress a rig; returns the new meshes (or [] if look is null)
   GrugOutfitRig.undress(rig)                   // back to the game's own blocks
   Blinking: every dressed head blinks on its own like in the Avatar Studio: its eyes are little planes that squash shut and
   open again every 2.4-5.6 s. A merged mesh (Zombie Zones' zombies) gets them with
   GrugOutfitRig.addEyes(mesh, geometry, GrugOutfitRig.faceParts(faceTexture), headMaterial, headGroup).

   The rig is the classic Grug game rig: a `root` group at the torso centre (the HumanoidRootPart), a `torso` mesh and a
   `head` mesh in it, and four limb pivots `rs`, `ls`, `rh`, `lh` (shoulders / hips) each holding one block mesh.
   1 unit = 1 stud, facing -Z, right arm on +X: the same conventions as the studio's .glb, so parts land where they should.
   The game keeps animating its own pivots; the outfit's parts ride on them. Its blocks stay (invisible), so anything the
   game hangs on them (guns, coils, effects) keeps working. */
(function () {
  'use strict';
  const PARTS = ['Torso', 'Head', 'Right Arm', 'Left Arm', 'Right Leg', 'Left Leg'];
  let hidden = null;
  const cache = {};

  // parse a character .glb (an ArrayBuffer) into the parts a rig can wear
  async function parse(buf, id, name) {
    const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', res, rej));
    const scene = gltf.scene; scene.updateMatrixWorld(true);
    const hrp = scene.getObjectByName('HumanoidRootPart'), inv = new THREE.Matrix4().copy(hrp ? hrp.matrixWorld : new THREE.Matrix4()).invert();
    const parts = {};
    for (const n of PARTS) {
      const o = scene.getObjectByName(n) || scene.getObjectByName(n.replace(/ /g, '_')); if (!o) continue;   // GLTFLoader turns spaces into _
      const mesh = o.isMesh ? o : o.children.find(c => c.isMesh); if (!mesh) continue;
      // plain lit materials, in the same colour space as the rest of a Grug game (no PBR, no environment map needed)
      const src = mesh.material, mat = new THREE.MeshPhongMaterial({ color: src.color ? src.color.clone() : 0xffffff, map: src.map || null,
        normalMap: src.normalMap || null, shininess: 10, specular: 0x111111, transparent: !!src.transparent, alphaTest: src.alphaTest || 0 });
      if (mat.map) { mat.map.encoding = THREE.LinearEncoding; mat.map.needsUpdate = true; }
      parts[n] = { geometry: mesh.geometry, material: mat, rel: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld) };
    }
    return { id, name, parts };
  }

  // ---------------------------------------------------------------- blinking eyes
  // Like the Avatar Studio: the eyes are their own little planes on the face that squash shut and open again every
  // 2.4-5.6 s. They're cut out of the outfit's face picture (the dark marks between the brows and the mouth), the face
  // underneath is painted over with skin, and each eye plane sits at its spot on the head (found through the head's UVs).
  const FACES = new Map();   // face texture -> { eyeless, eyes: [{ tex, u0, v0, u1, v1 }] } or null
  function faceParts(tex) {
    if (!tex || !tex.image) return null; if (FACES.has(tex)) return FACES.get(tex);
    let out = null;
    try {
      const img = tex.image, W = img.width, H = img.height; if (!W || !H) return null;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
      const D = x.getImageData(0, 0, W, H).data, S = Math.max(1, Math.round(Math.max(W, H) / 256)), gw = Math.ceil(W / S), gh = Math.ceil(H / S);
      const px = (i, j) => { const k = ((Math.min(H - 1, j * S)) * W + Math.min(W - 1, i * S)) * 4; return [D[k], D[k + 1], D[k + 2], D[k + 3]]; };
      const hist = new Map(); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const p = px(i, j); if (p[3] < 128) continue; const q = (p[0] >> 4) << 8 | (p[1] >> 4) << 4 | p[2] >> 4; hist.set(q, (hist.get(q) || 0) + 1); }
      let best = 0, bq = 0; hist.forEach((c, q) => { if (c > best) { best = c; bq = q; } });
      const sk = [0, 0, 0]; let skN = 0;   // the exact skin colour: the average of the commonest colour's pixels
      for (let k = 0; k < D.length; k += 4) { if (D[k + 3] < 128 || ((D[k] >> 4) << 8 | (D[k + 1] >> 4) << 4 | D[k + 2] >> 4) !== bq) continue; sk[0] += D[k]; sk[1] += D[k + 1]; sk[2] += D[k + 2]; skN++; }
      for (let q = 0; q < 3; q++) sk[q] = Math.round(sk[q] / Math.max(1, skN));
      const lum = p => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2], skL = lum(sk), far = p => Math.abs(p[0] - sk[0]) + Math.abs(p[1] - sk[1]) + Math.abs(p[2] - sk[2]);
      const mask = new Uint8Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const p = px(i, j); if (p[3] >= 128 && far(p) > 70) mask[j * gw + i] = 1; }
      const comps = [], seen = new Uint8Array(gw * gh), owner = new Int32Array(gw * gh).fill(-1);
      for (let s0 = 0; s0 < mask.length; s0++) {
        if (!mask[s0] || seen[s0]) continue; const st = [s0], cells = []; seen[s0] = 1; let edge = false;
        while (st.length) { const c = st.pop(), i = c % gw, j = (c / gw) | 0; cells.push(c); if (i === 0 || j === 0 || i === gw - 1 || j === gh - 1) edge = true;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= gw || b >= gh) continue; const n = b * gw + a; if (mask[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
        for (const c of cells) owner[c] = s0;
        if (edge || cells.length < 4) continue;   // colour swatches and hair touch the edge
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, dark = 0;
        for (const c of cells) { const i = c % gw, j = (c / gw) | 0; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); if (lum(px(i, j)) < skL * 0.55) dark++; }
        if (dark < cells.length * 0.12) continue;   // blush and freckles aren't eyes
        comps.push({ id: s0, cells, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
      }
      if (comps.length) {
        const mid = gw / 2; let mouth = null; for (const c of comps) if (Math.abs(c.cx - mid) < gw * 0.18 && (!mouth || c.cy > mouth.cy)) mouth = c;
        const rest = comps.filter(c => c !== mouth && (!mouth || c.cy < mouth.y0)).sort((a, b) => a.cy - b.cy), rows = [];
        for (const c of rest) { const r = rows.find(r => Math.abs(r.cy - c.cy) < gh * 0.06); if (r) { r.list.push(c); r.cy = (r.cy + c.cy) / 2; } else rows.push({ cy: c.cy, list: [c] }); }
        const eyes = rows.length ? rows[rows.length - 1].list : [];
        if (eyes.length && eyes.length <= 4) {
          const parts = [];
          for (const e of eyes) {
            // the eye on its own: its pixels, see-through where the skin shows (colour un-mixed from the skin at the edges)
            const pad = 2, X0 = Math.max(0, (e.x0 - pad) * S), Y0 = Math.max(0, (e.y0 - pad) * S), X1 = Math.min(W, (e.x1 + 1 + pad) * S), Y1 = Math.min(H, (e.y1 + 1 + pad) * S), w = X1 - X0, h = Y1 - Y0;
            const ec = document.createElement('canvas'); ec.width = w; ec.height = h; const ex = ec.getContext('2d'), out2 = ex.createImageData(w, h);
            for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
              const gx = Math.floor((X0 + xx) / S), gy = Math.floor((Y0 + yy) / S); let near = false;
              for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) { const a = gx + di, b = gy + dj; if (a >= 0 && b >= 0 && a < gw && b < gh && owner[b * gw + a] === e.id) { near = true; break; } }
              if (!near) continue;
              const k = ((Y0 + yy) * W + X0 + xx) * 4, p = [D[k], D[k + 1], D[k + 2]], a = Math.min(1, Math.max(0, (far(p) - 18) / 90)); if (a <= 0) continue;
              const o = (yy * w + xx) * 4; for (let q = 0; q < 3; q++) out2.data[o + q] = Math.max(0, Math.min(255, Math.round((p[q] - (1 - a) * sk[q]) / a)));
              out2.data[o + 3] = Math.round(a * 255);
            }
            ex.putImageData(out2, 0, 0);
            const et = new THREE.CanvasTexture(ec); et.encoding = tex.encoding; et.flipY = tex.flipY; et.magFilter = tex.magFilter; et.minFilter = THREE.LinearFilter; et.generateMipmaps = false; et.needsUpdate = true;
            parts.push({ tex: et, u0: X0 / W, u1: X1 / W, v0: Y0 / H, v1: Y1 / H });
          }
          // the face without its eyes
          x.fillStyle = `rgb(${sk[0]},${sk[1]},${sk[2]})`;
          for (const e of eyes) for (const c of e.cells) { const i = c % gw, j = (c / gw) | 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= gw || b >= gh) continue; const o = owner[b * gw + a]; if (o !== -1 && o !== e.id) continue; x.fillRect(a * S - 1, b * S - 1, S + 2, S + 2); } }
          const eyeless = new THREE.CanvasTexture(cv); eyeless.encoding = tex.encoding; eyeless.flipY = tex.flipY; eyeless.wrapS = tex.wrapS; eyeless.wrapT = tex.wrapT;
          eyeless.magFilter = tex.magFilter; eyeless.minFilter = tex.minFilter; eyeless.anisotropy = tex.anisotropy; eyeless.needsUpdate = true;
          out = { eyeless, eyes: parts, flipY: tex.flipY };
        }
      }
    } catch (e) { console.warn('blink', e); out = null; }
    FACES.set(tex, out); return out;
  }
  // each eye as its own piece of the head's surface: the head's triangles under that eye (front-facing ones), lifted a hair off
  // the skin, showing the cut-out eye. Built around the eye's centre, so scaling it on Y squashes the eye shut in place.
  const PLACES = new WeakMap();
  function placeEyes(geo, face, group, front) {
    const key = (group ? group.start + ':' : '') + face.eyeless.uuid; let per = PLACES.get(geo); if (!per) PLACES.set(geo, per = {}); if (per[key] !== undefined) return per[key];
    const P = geo.attributes.position, U = geo.attributes.uv; if (!P || !U) return (per[key] = null);
    const I = geo.index, n0 = group ? group.start : 0, n1 = group ? group.start + group.count : (I ? I.count : P.count), idx = k => I ? I.getX(k) : k;
    const c = new THREE.Vector3(); geo.computeBoundingBox(); geo.boundingBox.getCenter(c);
    const F = front || new THREE.Vector3(0, 0, -1), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), out = [];
    for (const e of face.eyes) {
      const v0 = face.flipY ? 1 - e.v1 : e.v0, v1 = face.flipY ? 1 - e.v0 : e.v1, pts = [], uv = [], sum = new THREE.Vector3(), nsum = new THREE.Vector3(); let wsum = 0;
      for (let k = n0; k + 2 < n1; k += 3) {
        const a = idx(k), b = idx(k + 1), d = idx(k + 2), us = [U.getX(a), U.getX(b), U.getX(d)], vs = [U.getY(a), U.getY(b), U.getY(d)];
        if (Math.max(...us) < e.u0 || Math.min(...us) > e.u1 || Math.max(...vs) < v0 || Math.min(...vs) > v1) continue;
        A.fromBufferAttribute(P, a); B.fromBufferAttribute(P, b); C.fromBufferAttribute(P, d);
        const fn = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)); if (fn.lengthSq() < 1e-14) continue; fn.normalize();
        const mid = A.clone().add(B).add(C).divideScalar(3); if (fn.dot(mid.clone().sub(c)) < 0) fn.negate(); if (fn.dot(F) < 0.2) continue;   // the face side only (not the caps)
        nsum.add(fn);
        [[A, a], [B, b], [C, d]].forEach(([p, vi]) => {
          pts.push(p.clone());
          const u = (U.getX(vi) - e.u0) / (e.u1 - e.u0), vv = (U.getY(vi) - v0) / (v1 - v0); uv.push(u, face.flipY ? vv : vv);
        });
        const inside = us.some((u, z) => u >= e.u0 && u <= e.u1 && vs[z] >= v0 && vs[z] <= v1) ? 1 : 0.2; sum.addScaledVector(mid, inside); wsum += inside;
      }
      if (!pts.length) return (per[key] = null);
      // lift every point the same way (the eye's average normal), so neighbouring triangles stay joined: no seams
      const nrm = nsum.normalize(), pivot = sum.divideScalar(wsum), pos = [], nor = [];
      for (const p of pts) { p.addScaledVector(nrm, 0.012).sub(pivot); pos.push(p.x, p.y, p.z); nor.push(nrm.x, nrm.y, nrm.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.push({ geo: g, pivot, tex: e.tex });
    }
    return (per[key] = out);
  }
  const blinkers = new Set(); let last = 0, running = false;
  // put blinking eye planes on a head mesh (a child of it, so they move with it). mat: the head's material (for lighting/colour)
  function addEyes(mesh, geo, face, mat, group, front) {
    const places = placeEyes(geo, face, group, front || new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion.clone().invert())); if (!places || !places.length) return null;
    const eyes = places.map(pl => {
      pl.tex.wrapS = pl.tex.wrapT = THREE.ClampToEdgeWrapping;   // its border is see-through, so outside the eye shows nothing
      const m = new THREE.Mesh(pl.geo, new THREE.MeshPhongMaterial({ map: pl.tex, color: mat && mat.color ? mat.color.clone() : 0xffffff,
        shininess: 10, specular: 0x111111, transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.position.copy(pl.pivot); m.renderOrder = 2; m.userData.keep = true; m.userData.eye = true; mesh.add(m); return m;
    });
    const b = { eyes, owner: mesh, next: 0.6 + Math.random() * 4, t: -1, dur: 0.16, double: false }; blinkers.add(b);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    return b;
  }
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const b of blinkers) {
      if (!b.owner.parent) { if ((b.gone = (b.gone || 0) + dt) > 5) { blinkers.delete(b); continue; } } else b.gone = 0;
      if (b.t >= 0) {
        b.t += dt; const k = b.t / b.dur, s = k >= 1 ? 1 : 1 - 0.9 * Math.sin(Math.PI * k);   // squash shut, then open (the studio's curve)
        for (const e of b.eyes) e.scale.y = s;
        if (k >= 1) { b.t = -1; if (b.double) { b.double = false; b.next = 0.08; } }
      } else if ((b.next -= dt) <= 0) { b.t = 0; b.next = 2.4 + Math.random() * 3.2; b.double = Math.random() < 0.12; }
    }
    if (blinkers.size) requestAnimationFrame(tick); else running = false;
  }
  const ok = () => !!(window.THREE && THREE.GLTFLoader);
  async function loadRecord(rec) {
    if (!ok() || !rec || !rec.glb) return null;
    const k = rec.id + ':' + rec.updated; if (cache[k]) return cache[k];
    try { const L = await parse(await rec.glb.arrayBuffer(), rec.id, rec.name); L.starter = !!rec.starter; return (cache[k] = L); } catch (e) { console.warn('outfit', rec.name, e); return null; }
  }
  // the default character, for anyone who hasn't picked an outfit (never the old blocky one)
  const DEFAULT = '/arcade/outfits/grug.glb';
  async function fallback() { const L = await fromURL(DEFAULT, 'Grug'); if (L) L.isDefault = true; return L; }
  // the outfit the player picked ("Play as"), or the default character
  async function load() {
    // straight from the store, without waiting for the starter outfits to be saved (until then it's the default anyway)
    let rec = null; try { const id = window.GrugOutfits && GrugOutfits.active(); rec = id ? await GrugOutfits.get(id) : null; } catch (e) {}
    return (await loadRecord(rec)) || fallback();
  }
  // the player's other saved outfits (not the one they play as): games dress their other players in these
  async function others(max) {
    if (!window.GrugOutfits) return [];
    let list = []; try { list = await GrugOutfits.list(); } catch (e) { return []; }
    const act = GrugOutfits.active();
    const all = await Promise.all(list.filter(o => o.id !== act).slice(0, max || 8).map(o => GrugOutfits.get(o.id).then(loadRecord).catch(() => null)));
    return all.filter(Boolean);
  }
  // a character .glb from the site (e.g. a game's own outfits in /arcade/outfits/)
  async function fromURL(url, name) {
    if (!ok()) return null; if (cache[url]) return cache[url];
    try { const r = await fetch(url); if (!r.ok) return null; return (cache[url] = await parse(await r.arrayBuffer(), url, name)); } catch (e) { return null; }
  }
  function targets(rig) {
    return { 'Torso': rig.torso, 'Head': rig.head, 'Right Arm': rig.rs && rig.rs.children[0], 'Left Arm': rig.ls && rig.ls.children[0],
      'Right Leg': rig.rh && rig.rh.children[0], 'Left Leg': rig.lh && rig.lh.children[0] };
  }
  function dress(rig, look) {
    undress(rig);
    if (!look || !rig || !rig.root) return [];
    hidden = hidden || new THREE.MeshBasicMaterial({ visible: false });
    const T = targets(rig), pivots = [rig.rs, rig.ls, rig.rh, rig.lh, rig.head, rig.torso].filter(Boolean);
    // measure the blocks in the rest pose
    const saved = pivots.map(p => p.rotation.clone()); pivots.forEach(p => p.rotation.set(0, 0, 0));
    rig.root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(rig.root.matrixWorld).invert(), made = [];
    for (const n of PARTS) {
      const t = T[n], p = look.parts[n]; if (!t || !p) continue;
      const mT = new THREE.Matrix4().multiplyMatrices(rootInv, t.matrixWorld), local = new THREE.Matrix4().copy(mT).invert().multiply(p.rel);
      let own = p.material, face = n === 'Head' ? faceParts(p.material.map) : null;
      if (face) { own = p.eyelessMat || (p.eyelessMat = Object.assign(p.material.clone(), { map: face.eyeless })); }   // the face without its eyes: the eyes are planes that blink
      const m = new THREE.Mesh(p.geometry, own); m.castShadow = true; m.receiveShadow = true; m.name = 'outfit:' + n; m.userData.outfit = true;
      local.decompose(m.position, m.quaternion, m.scale);
      t.userData.outfitMat = t.material; t.material = hidden;
      t.userData.outfitHid = t.children.filter(c => c.visible && !c.userData.keep); t.userData.outfitHid.forEach(c => { c.visible = false; });
      t.add(m); made.push(m);
      if (face) { m.userData.blink = addEyes(m, p.geometry, face, own); if (!m.userData.blink) m.material = p.material; }
    }
    pivots.forEach((p, i) => p.rotation.copy(saved[i]));
    rig.outfit = { id: look.id, name: look.name, meshes: made };
    return made;
  }
  function undress(rig) {
    if (!rig || !rig.outfit) return;
    const T = targets(rig);
    for (const n of PARTS) {
      const t = T[n]; if (!t) continue;
      for (const c of t.children.slice()) if (c.userData.outfit) { if (c.userData.blink) blinkers.delete(c.userData.blink); t.remove(c); }
      if (t.userData.outfitMat) { t.material = t.userData.outfitMat; delete t.userData.outfitMat; }
      (t.userData.outfitHid || []).forEach(c => { c.visible = true; }); delete t.userData.outfitHid;
    }
    rig.outfit = null;
  }
  window.GrugOutfitRig = { load, others, fromURL, loadRecord, dress, undress, DEFAULT, faceParts, addEyes };
})();
