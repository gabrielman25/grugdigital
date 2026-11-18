/* Grug · 3D downloads of the classic closet designs (free for everyone).
   A closet design is a Roblox-style shirt or pants template; the classic avatar (assets/sandy-classic.js) wraps it onto
   its T-shirt or pants. This builds that garment exactly as the avatar wears it (the classic kit is loaded on demand,
   ~15 MB, once), then writes it as a file. The garment meshes are CC0 (Quaternius, MakeHuman community assets):
   see credits.html. Hats are left out: Chibi Hats by PaperPluto has no licence on file for handing out the files.

   GrugExport3D.FORMATS            [[id, label, one line], ...]
   GrugExport3D.garment(item)      Promise of a model for a GrugCatalog item ({slot, template, id, name})
   GrugExport3D.save(model, fmt)   download it: 'glb' (texture inside), 'obj' (.zip: .obj + .mtl + .png), 'stl' (shape, mm)
   A model: {name, positions (Float32Array, metres), normals, uvs (v up, as three.js), indices (Uint32Array), image (canvas)} */
(function () {
  'use strict';
  const FORMATS = [
    ['glb', 'GLB', 'Blender, Unity, Godot, Unreal and most 3D apps, with the design on it.'],
    ['obj', 'OBJ', 'A .zip with the .obj, its .mtl and the design as a picture.'],
    ['stl', 'STL', 'For 3D printing: the shape only, in millimetres.']
  ];
  const me = document.currentScript || Array.from(document.scripts).find(s => /assets\/export3d\.js(\?|$)/.test(s.src));
  const ASSETS = me && me.src ? me.src.replace(/[^/]*$/, '') : 'assets/';
  const enc = new TextEncoder();

  /* ---------- the garment ---------- */
  const script = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load ' + src)); document.head.appendChild(s); });
  let kit = null;
  function classicKit() {
    if (kit) return kit;
    return (kit = (window.SandyKit ? Promise.resolve() : script(ASSETS + 'sandy-runtime.js?v=av2'))
      .then(() => window.SandyClassicKit || window.SandyKit.loadClassic())
      .catch(e => { kit = null; throw e; }));
  }
  async function garment(it) {
    const C = window.GrugCatalog; if (!C || !it || !it.template) throw new Error('not a closet design');
    const K = await classicKit(), key = C.CFG_KEY[it.slot], G0 = C.GARMENTS[it.slot], g = G0[it.slot === 'shirt' ? 0 : 1];   // T-shirt or pants, as Wear it picks
    const look = { [key]: { part: g.part, texture: g.texture, colour: '#ffffff', template: it.template } };
    const s = await K.create(K.merge(K.DEFAULT, look));
    try { if (K.customReady) await K.customReady(); } catch (e) {}
    const M = s.M && s.M.armorMeshes, mesh = M && (it.slot === 'shirt' ? (M.body || M.top) : M.legs);
    if (!mesh || !mesh.material || !mesh.material.map) { try { s.dispose(); } catch (e) {} throw new Error('no garment'); }
    s.object3d.updateMatrixWorld(true);
    const geo = mesh.geometry, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, n = P.count;
    const T = window.THREE, mw = mesh.matrixWorld, nm = new T.Matrix3().getNormalMatrix(mw), v = new T.Vector3();
    const positions = new Float32Array(n * 3), normals = N ? new Float32Array(n * 3) : null, uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(mw); positions[i * 3] = v.x / 100; positions[i * 3 + 1] = v.y / 100; positions[i * 3 + 2] = v.z / 100;   // cm → m
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); normals[i * 3] = v.x; normals[i * 3 + 1] = v.y; normals[i * 3 + 2] = v.z; }
      if (U) { uvs[i * 2] = U.getX(i); uvs[i * 2 + 1] = U.getY(i); }
    }
    let indices;
    if (geo.index) indices = Uint32Array.from(geo.index.array); else { indices = new Uint32Array(n); for (let i = 0; i < n; i++) indices[i] = i; }
    const src = mesh.material.map.image, image = document.createElement('canvas');
    image.width = src.width || 585; image.height = src.height || 559; image.getContext('2d').drawImage(src, 0, 0);
    try { s.dispose(); } catch (e) {}
    const id = String(it.id).replace(/[^\w-]/g, ''), name = (/^grug-/.test(id) ? id : 'grug-' + id) + '-' + (it.slot === 'shirt' ? 'tshirt' : 'pants');
    return { name, positions, normals, uvs, indices, image };
  }

  /* ---------- writers ---------- */
  const pngOf = c => new Promise(ok => c.toBlob(b => b.arrayBuffer().then(a => ok(new Uint8Array(a))), 'image/png'));
  const pad4 = n => (n + 3) & ~3;

  function glb(m, png) {
    const parts = [], views = [];
    const add = (bytes, target) => { const off = parts.reduce((a, p) => a + p.length, 0); const b = new Uint8Array(pad4(bytes.byteLength)); b.set(new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength)); parts.push(b); const vw = { buffer: 0, byteOffset: off, byteLength: bytes.byteLength }; if (target) vw.target = target; views.push(vw); return views.length - 1; };
    const n = m.positions.length / 3, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const x = m.positions[i * 3 + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x; }
    const uv = new Float32Array(m.uvs.length); for (let i = 0; i < uv.length; i += 2) { uv[i] = m.uvs[i]; uv[i + 1] = 1 - m.uvs[i + 1]; }   // glTF's v runs down
    const acc = [], attrs = {};
    attrs.POSITION = acc.push({ bufferView: add(m.positions, 34962), componentType: 5126, count: n, type: 'VEC3', min, max }) - 1;
    if (m.normals) attrs.NORMAL = acc.push({ bufferView: add(m.normals, 34962), componentType: 5126, count: n, type: 'VEC3' }) - 1;
    attrs.TEXCOORD_0 = acc.push({ bufferView: add(uv, 34962), componentType: 5126, count: n, type: 'VEC2' }) - 1;
    const ind = acc.push({ bufferView: add(m.indices, 34963), componentType: 5125, count: m.indices.length, type: 'SCALAR' }) - 1;
    const img = add(png);
    const bin = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { bin.set(p, o); o += p.length; }
    const json = {
      asset: { version: '2.0', generator: 'Grug Digital' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: m.name }],
      meshes: [{ name: m.name, primitives: [{ attributes: attrs, indices: ind, material: 0 }] }],
      materials: [{ name: m.name, doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.82 } }],
      textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
      images: [{ bufferView: img, mimeType: 'image/png' }], accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length }]
    };
    let js = enc.encode(JSON.stringify(json)); const jl = pad4(js.length); const jp = new Uint8Array(jl).fill(0x20); jp.set(js); js = jp;
    const out = new Uint8Array(12 + 8 + jl + 8 + bin.length), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
    dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20);
    dv.setUint32(20 + jl, bin.length, true); dv.setUint32(24 + jl, 0x004E4942, true); out.set(bin, 28 + jl);
    return out;
  }
  function objText(m) {
    const L = ['# ' + m.name + ' · Grug Digital (grugdigital.com)', 'mtllib ' + m.name + '.mtl', 'o ' + m.name], n = m.positions.length / 3, f = x => +x.toFixed(5);
    for (let i = 0; i < n; i++) L.push('v ' + f(m.positions[i * 3]) + ' ' + f(m.positions[i * 3 + 1]) + ' ' + f(m.positions[i * 3 + 2]));
    for (let i = 0; i < n; i++) L.push('vt ' + f(m.uvs[i * 2]) + ' ' + f(m.uvs[i * 2 + 1]));
    if (m.normals) for (let i = 0; i < n; i++) L.push('vn ' + f(m.normals[i * 3]) + ' ' + f(m.normals[i * 3 + 1]) + ' ' + f(m.normals[i * 3 + 2]));
    L.push('usemtl ' + m.name);
    const I = m.indices, w = i => (i + 1) + '/' + (i + 1) + (m.normals ? '/' + (i + 1) : '');
    for (let t = 0; t < I.length; t += 3) L.push('f ' + w(I[t]) + ' ' + w(I[t + 1]) + ' ' + w(I[t + 2]));
    return L.join('\n') + '\n';
  }
  function stl(m) {
    const I = m.indices, tri = I.length / 3, out = new ArrayBuffer(84 + tri * 50), dv = new DataView(out), P = m.positions;
    new Uint8Array(out, 0, 80).set(enc.encode(('Grug Digital ' + m.name).slice(0, 80)));
    dv.setUint32(80, tri, true);
    for (let t = 0; t < tri; t++) {
      const o = 84 + t * 50, a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
      [a, b, c].forEach((i, k) => { for (let j = 0; j < 3; j++) dv.setFloat32(o + 12 + k * 12 + j * 4, P[i + j] * 1000, true); });   // m → mm
    }
    return new Uint8Array(out);
  }
  // a plain (stored) .zip
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const chunks = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
    }
    const cs = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    const all = chunks.concat(central, [new Uint8Array(e.buffer)]), out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of all) { out.set(b, o); o += b.length; }
    return out;
  }
  function file(name, data, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function build(m, fmt) {
    if (fmt === 'stl') return { name: m.name + '.stl', data: stl(m), type: 'model/stl' };
    const png = await pngOf(m.image);
    if (fmt === 'obj') return { name: m.name + '_obj.zip', type: 'application/zip', data: zip([
      { name: m.name + '.obj', data: enc.encode(objText(m)) },
      { name: m.name + '.mtl', data: enc.encode('# Grug Digital\nnewmtl ' + m.name + '\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nd 1\nillum 1\nmap_Kd ' + m.name + '.png\n') },
      { name: m.name + '.png', data: png }]) };
    return { name: m.name + '.glb', data: glb(m, png), type: 'model/gltf-binary' };
  }
  async function save(m, fmt) { const f = await build(m, fmt); file(f.name, f.data, f.type); return f; }

  window.GrugExport3D = { FORMATS, garment, save, build };
})();
