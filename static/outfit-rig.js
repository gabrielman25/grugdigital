/* GrugOutfitRig · puts the player's saved outfit (GrugOutfits, static/outfits.js) on a game's blocky R6 character.

   Needs three.js r128 (window.THREE) and its GLTFLoader (/static/vendor/three-r128-GLTFLoader.js), plus /static/outfits.js.

   const look = await GrugOutfitRig.load()      // the active outfit, parsed: { id, name, parts } or null (none picked / unavailable)
   const npcs = await GrugOutfitRig.others(6)   // the player's other saved outfits, for the game's other players / NPCs
   const kit  = await GrugOutfitRig.fromURL('/arcade/outfits/ranger.glb', 'Ranger')   // a character file shipped with the site
   GrugOutfitRig.dress(rig, look)               // dress a rig; returns the new meshes (or [] if look is null)
   GrugOutfitRig.undress(rig)                   // back to the game's own blocks

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
  const ok = () => !!(window.THREE && THREE.GLTFLoader);
  async function loadRecord(rec) {
    if (!ok() || !rec || !rec.glb) return null;
    const k = rec.id + ':' + rec.updated; if (cache[k]) return cache[k];
    try { return (cache[k] = await parse(await rec.glb.arrayBuffer(), rec.id, rec.name)); } catch (e) { console.warn('outfit', rec.name, e); return null; }
  }
  // the outfit the player picked ("Play as"), or null
  async function load() {
    if (!window.GrugOutfits) return null;
    let rec; try { rec = await GrugOutfits.activeRecord(); } catch (e) { return null; }
    return loadRecord(rec);
  }
  // the player's other saved outfits (not the one they play as): games dress their other players in these
  async function others(max) {
    if (!window.GrugOutfits) return [];
    let list = []; try { list = await GrugOutfits.list(); } catch (e) { return []; }
    const act = GrugOutfits.active(), out = [];
    for (const o of list.filter(o => o.id !== act).slice(0, max || 8)) { const L = await loadRecord(await GrugOutfits.get(o.id)); if (L) out.push(L); }
    return out;
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
      const m = new THREE.Mesh(p.geometry, p.material); m.castShadow = true; m.receiveShadow = true; m.name = 'outfit:' + n; m.userData.outfit = true;
      local.decompose(m.position, m.quaternion, m.scale);
      t.userData.outfitMat = t.material; t.material = hidden;
      t.userData.outfitHid = t.children.filter(c => c.visible && !c.userData.keep); t.userData.outfitHid.forEach(c => { c.visible = false; });
      t.add(m); made.push(m);
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
      for (const c of t.children.slice()) if (c.userData.outfit) t.remove(c);
      if (t.userData.outfitMat) { t.material = t.userData.outfitMat; delete t.userData.outfitMat; }
      (t.userData.outfitHid || []).forEach(c => { c.visible = true; }); delete t.userData.outfitHid;
    }
    rig.outfit = null;
  }
  window.GrugOutfitRig = { load, others, fromURL, loadRecord, dress, undress };
})();
