/* GrugOutfit64 · what a Grug Nintendo 64 ROM wears.

   A Grug 64 ROM carries one "outfit slot": 128 KB at a fixed place in the file (1 MB in), holding the shirt, the pants, the
   face and the head shape of the character you play as, small enough for the console. The ROM reads it when it starts.
   The file on the site has Grug in it. This script makes the same block from any outfit saved on the site (the rigged
   .glb the Avatar Studio exports: static/outfits.js) and writes it into a copy of the ROM, so the game in the Arcade, and
   the ROM you download for a real console, start with the outfit you play as. Nothing else in the ROM changes.

   It runs in the page (an N64 game's play page, and its page in the Arcade) and in node (src/n64/kit/tools/mkoutfit.cjs, which makes the
   ROM's own default from arcade/outfits/grug.glb): one piece of code, so the two can't drift apart.

     const worn = await GrugOutfit64.wear('/arcade/grug-64/x.z64')      // in a page: { name, url } = a copy of the ROM wearing the
                                                                        //   outfit you play as (null: the ROM as it comes)
     const fit = await GrugOutfit64.build(glbBytes, { name, decode })   // { name, bytes: the outfit block, info }
     GrugOutfit64.write(romBytes, { outfit: fit, stress, view })         // in place; throws if the ROM has no slot
     GrugOutfit64.blank()                                               // an empty slot (the build tool fills it)

   decode(bytes, mime) -> { w, h, data: RGBA } turns a picture file into pixels. In a browser it's built in.

   WHAT IS MADE (the ROM's side of this is src/n64/kit/outfit.h; keep the two in step)
   · Body: the torso, arms and legs are boxes, and each of their faces is cut out of the outfit's own textures by reading
     the .glb's mesh (so it follows whatever layout the studio uses) and packed into a 256 x 160 atlas, 64 texels across a
     torso: half the studio's detail. Torso and arms come from the shirt's texture, legs from the pants'. Each atlas has
     256 colours of its own and two smaller copies (128 x 80, 64 x 40) for when the character is further off.
   · Head: the studio's head is a smooth 512-triangle shape with the hair merged in. The hair is left out (it has its own
     colour swatch in the texture: that is how it is told apart; the ROM's characters are bald for now), and the head is
     measured again as a few rings of 8 points, up to a point at the crown: rays from its axis find how wide it is at each
     height and angle, and the rings that matter most are kept. About 100 triangles, any head shape or size, with no list
     of shapes in the ROM.
   · Face: the front half of the head's texture, 128 x 80 with 256 colours and three smaller copies. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GrugOutfit64 = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SLOT = { offset: 0x100000, size: 0x20000, magic: 'GRUGFIT1', version: 2, name: 32, outfit: 64 };
  const BODY = { w: 256, h: 160, levels: 3 }, FACE = { w: 128, h: 80, levels: 4 };
  const RINGS = 9, SEGS = 8;   // the most rings a head keeps (the last is the crown: a point), and the points round each
  // where a box's faces go in the atlas: [x, y, w, h], faces in the order +x -x +y -y +z -z (the character faces -z, its right arm is on +x)
  const TILES = {
    torso: [[128, 0, 32, 64], [160, 0, 32, 64], [192, 0, 64, 32], [192, 32, 64, 32], [64, 0, 64, 64], [0, 0, 64, 64]],
    limbA: [[64, 64, 32, 64], [96, 64, 32, 64], [0, 128, 32, 32], [32, 128, 32, 32], [32, 64, 32, 64], [0, 64, 32, 64]],
    limbB: [[192, 64, 32, 64], [224, 64, 32, 64], [64, 128, 32, 32], [96, 128, 32, 32], [160, 64, 32, 64], [128, 64, 32, 64]],
  };
  // a face's picture: its top-left corner, the corner at the end of its top edge, the corner below the first. Corners are numbered
  // bit 0 = +x, bit 1 = +y, bit 2 = +z. Sides are upright seen from outside; the top's far edge is the back, the bottom's the front.
  const CORNERS = [[7, 3, 5], [2, 6, 0], [7, 6, 3], [1, 0, 5], [6, 7, 4], [3, 2, 1]];
  const AXIS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

  // ---------------------------------------------------------------------------------------------------- the .glb
  function parseGLB(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a .glb file');
    let off = 12, json = null, bin = null;
    while (off + 8 <= u8.length) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), chunk = u8.subarray(off + 8, off + 8 + len);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk)); else if (type === 0x004E4942) bin = chunk;
      off += 8 + len + ((4 - len % 4) % 4);
    }
    if (!json || !bin) throw new Error('the .glb has no data');
    const bdv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const accessor = i => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
      const base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || size * n, out = a.componentType === 5126 ? new Float32Array(a.count * n) : new Uint32Array(a.count * n);
      for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const p = base + k * stride + c * size;
        out[k * n + c] = a.componentType === 5126 ? bdv.getFloat32(p, true) : a.componentType === 5125 ? bdv.getUint32(p, true) : a.componentType === 5123 ? bdv.getUint16(p, true) : bdv.getUint8(p); }
      return out;
    };
    // where each node is, measured from the scene (the studio only moves parts, but a turn or a scale is followed too)
    const mul = (a, b) => { const o = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
    const local = n => { if (n.matrix) return n.matrix.slice(); const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], [x, y, z, w] = q;
      return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
        2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
    const world = {}; const walk = (i, m) => { const n = json.nodes[i], w = mul(m, local(n)); world[i] = w; (n.children || []).forEach(c => walk(c, w)); };
    const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    ((json.scenes && json.scenes[json.scene || 0] || {}).nodes || json.nodes.map((n, i) => i).filter(i => !json.nodes.some(n => (n.children || []).includes(i)))).forEach(i => walk(i, I4));
    const part = name => {
      const i = json.nodes.findIndex(n => n.name === name || n.name === name.replace(/ /g, '_')); if (i < 0) return null;
      const node = json.nodes[i]; let mi = node.mesh; if (mi === undefined) { const c = (node.children || []).find(c => json.nodes[c].mesh !== undefined); if (c === undefined) return null; mi = json.nodes[c].mesh; }
      const pr = json.meshes[mi].primitives[0], pos = accessor(pr.attributes.POSITION), uv = accessor(pr.attributes.TEXCOORD_0), idx = pr.indices !== undefined ? accessor(pr.indices) : Uint32Array.from({ length: pos.length / 3 }, (v, k) => k);
      const mat = json.materials[pr.material] || {}, tex = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
      return { name, pos, uv, idx, world: world[i], image: tex ? json.textures[tex.index].source : -1 };
    };
    const image = i => { const im = json.images[i], bv = json.bufferViews[im.bufferView]; return { bytes: bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), mime: im.mimeType || 'image/png' }; };
    return { json, part, image, world };
  }

  // ---------------------------------------------------------------------------------------------------- pictures
  const decodeBrowser = async (bytes, mime) => {
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime || 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, data: x.getImageData(0, 0, bmp.width, bmp.height).data };
  };
  // the colour at (u, v) of a picture (0..1, v down), over `under` where the picture is see-through
  function texel(img, u, v, under, out) {
    const x = Math.min(img.w - 1, Math.max(0, Math.floor(u * img.w))), y = Math.min(img.h - 1, Math.max(0, Math.floor(v * img.h))), k = (y * img.w + x) * 4, a = img.data[k + 3] / 255;
    out[0] = img.data[k] * a + under[0] * (1 - a); out[1] = img.data[k + 1] * a + under[1] * (1 - a); out[2] = img.data[k + 2] * a + under[2] * (1 - a);
  }
  // a picture as the ROM keeps it: each level half the one before, every level drawn from the same 256 colours
  function newLevels(w, h, n) { const L = []; for (let i = 0; i < n; i++) L.push({ w: w >> i, h: h >> i, rgb: new Float32Array((w >> i) * (h >> i) * 3), used: new Uint8Array((w >> i) * (h >> i)) }); return L; }
  function shrink(L) {
    for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i];
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { let n = 0, r = 0, g = 0, bl = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const k = (y * 2 + dy) * a.w + x * 2 + dx; if (!a.used[k]) continue; n++; r += a.rgb[k * 3]; g += a.rgb[k * 3 + 1]; bl += a.rgb[k * 3 + 2]; }
        if (n) { const k = y * b.w + x; b.used[k] = 1; b.rgb[k * 3] = r / n; b.rgb[k * 3 + 1] = g / n; b.rgb[k * 3 + 2] = bl / n; } } }
  }
  // 256 colours for a picture (median cut over the console's 15-bit colours), and every texel as one of them
  function quantize(L) {
    const hist = new Uint32Array(32768), key = (r, g, b) => (Math.min(31, Math.round(r / 255 * 31)) << 10) | (Math.min(31, Math.round(g / 255 * 31)) << 5) | Math.min(31, Math.round(b / 255 * 31));
    for (const l of L) for (let k = 0; k < l.used.length; k++) if (l.used[k]) hist[key(l.rgb[k * 3], l.rgb[k * 3 + 1], l.rgb[k * 3 + 2])]++;
    const cols = []; for (let c = 0; c < 32768; c++) if (hist[c]) cols.push(c);
    const ch = (c, a) => (c >> (10 - a * 5)) & 31;
    const mk = list => { const lo = [31, 31, 31], hi = [0, 0, 0]; let n = 0; for (const c of list) { n += hist[c]; for (let a = 0; a < 3; a++) { const v = ch(c, a); if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; } }
      const ax = [0, 1, 2].sort((p, q) => (hi[q] - lo[q]) - (hi[p] - lo[p]))[0]; return { list, n, ax, range: hi[ax] - lo[ax] }; };
    let boxes = cols.length ? [mk(cols)] : [];
    while (boxes.length < 256) {
      let bi = -1, best = 0; boxes.forEach((b, i) => { if (b.list.length > 1 && b.range > 0) { const s = b.range * Math.sqrt(b.n); if (s > best) { best = s; bi = i; } } });
      if (bi < 0) break; const b = boxes[bi]; b.list.sort((p, q) => ch(p, b.ax) - ch(q, b.ax));
      let acc = 0, cut = 1; for (let i = 0; i < b.list.length - 1; i++) { acc += hist[b.list[i]]; if (acc >= b.n / 2) { cut = i + 1; break; } cut = i + 1; }
      boxes.splice(bi, 1, mk(b.list.slice(0, cut)), mk(b.list.slice(cut)));
    }
    const pal = new Uint16Array(256), prgb = [], map = new Uint8Array(32768);
    boxes.forEach((b, i) => { let r = 0, g = 0, bl = 0; for (const c of b.list) { r += ch(c, 0) * hist[c]; g += ch(c, 1) * hist[c]; bl += ch(c, 2) * hist[c]; }
      const p = [Math.round(r / b.n), Math.round(g / b.n), Math.round(bl / b.n)]; prgb.push(p); pal[i] = (p[0] << 11) | (p[1] << 6) | (p[2] << 1) | 1; for (const c of b.list) map[c] = i; });
    const levels = L.map(l => { const o = new Uint8Array(l.w * l.h); for (let k = 0; k < o.length; k++) if (l.used[k]) o[k] = map[key(l.rgb[k * 3], l.rgb[k * 3 + 1], l.rgb[k * 3 + 2])]; return o; });
    return { pal, levels, colours: boxes.length };
  }

  // ---------------------------------------------------------------------------------------------------- the body: boxes
  // A part's box, found from its mesh: for each of the six directions, the flat face with the most area (so the peg on a shoulder,
  // or anything else small the studio adds, doesn't count), and the triangles that make it.
  function boxOf(p) {
    const plane = [], tris = [[], [], [], [], [], []], area = [{}, {}, {}, {}, {}, {}], nt = p.idx.length / 3, T = [];
    for (let t = 0; t < nt; t++) {
      const a = p.idx[t * 3] * 3, b = p.idx[t * 3 + 1] * 3, c = p.idx[t * 3 + 2] * 3, P = p.pos;
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-9) { T.push(null); continue; }
      let f = -1; for (let k = 0; k < 6; k++) if (n[AXIS[k][0]] / l * AXIS[k][1] > 0.99) f = k;
      T.push(f < 0 ? null : { f, t, at: Math.round(P[a + AXIS[f][0]] * 1000) / 1000, area: l / 2 });
      if (f >= 0) area[f][T[t].at] = (area[f][T[t].at] || 0) + l / 2;
    }
    for (let f = 0; f < 6; f++) { let best = -1; for (const k in area[f]) if (area[f][k] > best) { best = area[f][k]; plane[f] = +k; } if (best < 0) throw new Error(p.name + ': not a box'); }
    for (const x of T) if (x && Math.abs(x.at - plane[x.f]) < 2e-3) tris[x.f].push(x.t);
    return { min: [plane[1], plane[3], plane[5]], max: [plane[0], plane[2], plane[4]], tris };
  }
  // paint one box into an atlas (level 0): every texel is the average of four points on the face
  function bakeBox(p, img, tiles, L0, skin) {
    const box = boxOf(p), P = p.pos, U = p.uv, col = [0, 0, 0];
    const corner = i => [(i & 1) ? box.max[0] : box.min[0], (i & 2) ? box.max[1] : box.min[1], (i & 4) ? box.max[2] : box.min[2]];
    for (let f = 0; f < 6; f++) {
      const [tx, ty, tw, th] = tiles[f], o = corner(CORNERS[f][0]), pu = corner(CORNERS[f][1]), pv = corner(CORNERS[f][2]), ax = AXIS[f][0], a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
      // the face's triangles, flattened onto the two axes the face lies along
      const tri = box.tris[f].map(t => { const i = [p.idx[t * 3], p.idx[t * 3 + 1], p.idx[t * 3 + 2]];
        const x = i.map(k => P[k * 3 + a1]), y = i.map(k => P[k * 3 + a2]), d = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]); return { i, x, y, d }; }).filter(t => Math.abs(t.d) > 1e-12);
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
        let r = 0, g = 0, b = 0;
        for (let s = 0; s < 4; s++) {
          const fu = (i + 0.25 + 0.5 * (s & 1)) / tw, fv = (j + 0.25 + 0.5 * (s >> 1)) / th, q = [0, 1, 2].map(k => o[k] + (pu[k] - o[k]) * fu + (pv[k] - o[k]) * fv), x = q[a1], y = q[a2];
          let best = null, bw = -1e9, w0 = 0, w1 = 0;
          for (const t of tri) { const l0 = ((t.y[1] - t.y[2]) * (x - t.x[2]) + (t.x[2] - t.x[1]) * (y - t.y[2])) / t.d, l1 = ((t.y[2] - t.y[0]) * (x - t.x[2]) + (t.x[0] - t.x[2]) * (y - t.y[2])) / t.d, m = Math.min(l0, l1, 1 - l0 - l1);
            if (m > bw) { bw = m; best = t; w0 = l0; w1 = l1; if (m >= 0) break; } }
          if (!best) { r += skin[0]; g += skin[1]; b += skin[2]; continue; }
          const w2 = 1 - w0 - w1, [i0, i1, i2] = best.i;
          texel(img, U[i0 * 2] * w0 + U[i1 * 2] * w1 + U[i2 * 2] * w2, U[i0 * 2 + 1] * w0 + U[i1 * 2 + 1] * w1 + U[i2 * 2 + 1] * w2, skin, col); r += col[0]; g += col[1]; b += col[2];
        }
        const k = (ty + j) * L0.w + tx + i; L0.used[k] = 1; L0.rgb[k * 3] = r / 4; L0.rgb[k * 3 + 1] = g / 4; L0.rgb[k * 3 + 2] = b / 4;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------- the head
  function bakeHead(p, img, root) {
    // into the character's own space (the torso's centre is the origin), and the hair told apart: every corner of a hair
    // triangle is in the texture's hair-colour swatch, the bottom-left corner of the picture
    const m = p.world, r = root, n = p.pos.length / 3, P = new Float32Array(n * 3), U = p.uv;
    for (let i = 0; i < n; i++) { const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2];
      P[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12] - r[12]; P[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] - r[13]; P[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] - r[14]; }
    const swatch = i => U[i * 2] < 0.127 && U[i * 2 + 1] > 0.832, tris = [], hairTris = [];
    for (let t = 0; t < p.idx.length; t += 3) { const a = p.idx[t], b = p.idx[t + 1], c = p.idx[t + 2]; (swatch(a) && swatch(b) && swatch(c) ? hairTris : tris).push([a, b, c]); }
    if (!tris.length) throw new Error('the head has no shape');
    const hair = [0, 0, 0], skin = [0, 0, 0], none = [0, 0, 0];
    if (hairTris.length) { const [a, b, c] = hairTris[0]; texel(img, (U[a * 2] + U[b * 2] + U[c * 2]) / 3, (U[a * 2 + 1] + U[b * 2 + 1] + U[c * 2 + 1]) / 3, none, hair); }
    let y0 = 1e9, y1 = -1e9, top = 0; for (const t of tris) for (const i of t) { const y = P[i * 3 + 1]; if (y < y0) y0 = y; if (y > y1) { y1 = y; top = i; } }
    texel(img, U[top * 2], U[top * 2 + 1], none, skin);   // the crown is bare skin
    // a ray out from the head's axis at height y, at an angle round from the front (-z) towards the right arm (+x): how far out
    // the surface is, and where in the texture that spot is
    const ray = (y, ang) => {
      const dx = Math.sin(ang), dz = -Math.cos(ang); let far = 0, hit = null;
      for (const [a, b, c] of tris) {
        const ax = P[a * 3], ay = P[a * 3 + 1] - y, az = P[a * 3 + 2], e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - y - ay, e1z = P[b * 3 + 2] - az, e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - y - ay, e2z = P[c * 3 + 2] - az;
        if ((ay > 0 && e1y + ay > 0 && e2y + ay > 0) || (ay < 0 && e1y + ay < 0 && e2y + ay < 0)) continue;   // all above or all below
        const px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const u = (-ax * px - ay * py - az * pz) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
        const qx = -ay * e1z + az * e1y, qy = -az * e1x + ax * e1z, qz = -ax * e1y + ay * e1x, v = (dx * qx + dz * qz) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) / det; if (t <= far) continue;
        const w = 1 - u - v, nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, nl = Math.hypot(nx, ny, nz) || 1;
        far = t; hit = { r: t, u: U[a * 2] * w + U[b * 2] * u + U[c * 2] * v, v: U[a * 2 + 1] * w + U[b * 2 + 1] * u + U[c * 2 + 1] * v, steep: Math.abs(ny / nl) };
      }
      return hit || { r: 0, u: 0, v: 0, steep: 1 };
    };
    // measure it at many heights, then keep the few rings that hold the shape (the straight line between two kept rings is
    // never far from the rings left out: the ring that is furthest off is the next one kept)
    const N = 72, ang = k => k * 2 * Math.PI / SEGS, rows = [];
    for (let i = 0; i < N; i++) { const y = y0 + (y1 - y0) * (i + 0.5) / N, hits = []; for (let k = 0; k < SEGS; k++) hits.push(ray(y, ang(k))); rows.push({ y, hits, r: hits.map(h => h.r) }); }
    const widest = Math.max(...rows.map(w => Math.max(...w.r))), wide = w => Math.min(...w.r) >= 0.45 * widest;
    // from the lowest ring that is wide (under it is the neck's flat end, on the torso) right up to the crown, which is a point:
    // the head is round on top, not cut off flat
    rows.push({ y: y1, hits: rows[N - 1].hits.map(h => Object.assign({}, h)), r: new Array(SEGS).fill(0) });
    const lo = rows.findIndex(wide), hi = rows.length - 1; if (lo < 0 || hi <= lo) throw new Error('the head is too thin to measure');
    const keep = [lo, hi];
    while (keep.length < RINGS) {
      let worst = 0, wi = -1;
      for (let s = 0; s + 1 < keep.length; s++) { const a = rows[keep[s]], b = rows[keep[s + 1]];
        for (let i = keep[s] + 1; i < keep[s + 1]; i++) { const f = (rows[i].y - a.y) / (b.y - a.y); let e = 0; for (let k = 0; k < SEGS; k++) e = Math.max(e, Math.abs(rows[i].r[k] - (a.r[k] + (b.r[k] - a.r[k]) * f))); if (e > worst) { worst = e; wi = i; } } }
      if (wi < 0 || worst < 0.012) break; keep.push(wi); keep.sort((a, b) => a - b);
    }
    const rings = keep.map(i => rows[i]);
    // the face: the front half of the head's texture. Round the head the picture runs from the right arm's side (the left of
    // the crop) to the other; down the head it runs from the top of the head's side to the bottom of it.
    const mid = rows[(lo + N) >> 1], uR = mid.hits[SEGS / 4].u, uL = mid.hits[SEGS * 3 / 4].u, uF = mid.hits[0].u, onFace = w => Math.abs(w.hits[0].u - uF) < 0.02 && w.hits[0].r > 0;   // (the crown has its own patch of the texture)
    const vs = rows.filter(onFace).map(w => w.hits[0].v), v0 = Math.min(...vs), v1 = Math.max(...vs);
    if (!(Math.abs(uL - uR) > 0.05) || !(v1 - v0 > 0.02)) throw new Error('the face is not where it was expected in the head\'s texture');
    const L = newLevels(FACE.w, FACE.h, FACE.levels), col = [0, 0, 0];
    for (let j = 0; j < FACE.h; j++) for (let i = 0; i < FACE.w; i++) { let rr = 0, g = 0, b = 0;
      for (let s = 0; s < 9; s++) { texel(img, uR + (uL - uR) * (i + (s % 3 + 0.5) / 3) / FACE.w, v0 + (v1 - v0) * (j + ((s / 3 | 0) + 0.5) / 3) / FACE.h, skin, col); rr += col[0]; g += col[1]; b += col[2]; }
      const k = j * FACE.w + i; L[0].used[k] = 1; L[0].rgb[k * 3] = rr / 9; L[0].rgb[k * 3 + 1] = g / 9; L[0].rgb[k * 3 + 2] = b / 9; }
    shrink(L);
    return { rings: rings.map(w => ({ y: w.y, r: w.r, t: onFace(w) ? Math.min(1, Math.max(0, (w.hits[0].v - v0) / (v1 - v0))) : (w.y > mid.y ? 0 : 1) })), face: quantize(L), skin, hair, hasHair: hairTris.length > 0,
      triangles: tris.length, hairTriangles: hairTris.length };
  }

  // ---------------------------------------------------------------------------------------------------- the block
  async function build(glb, opts) {
    opts = opts || {}; const decode = opts.decode || (typeof createImageBitmap === 'function' ? decodeBrowser : null); if (!decode) throw new Error('no way to read pictures here: pass { decode }');
    const g = parseGLB(glb), parts = {}; for (const n of ['Torso', 'Head', 'Right Arm', 'Left Arm', 'Right Leg', 'Left Leg']) { parts[n] = g.part(n); if (!parts[n] || parts[n].image < 0) throw new Error('the character has no ' + n); }
    const imgs = {}, img = async i => imgs[i] || (imgs[i] = await decode(g.image(i).bytes, g.image(i).mime));
    const rootI = g.json.nodes.findIndex(n => n.name === 'HumanoidRootPart'), root = rootI >= 0 ? g.world[rootI] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const head = bakeHead(parts.Head, await img(parts.Head.image), root);
    const shirt = newLevels(BODY.w, BODY.h, BODY.levels), pants = newLevels(BODY.w, BODY.h, BODY.levels);
    bakeBox(parts.Torso, await img(parts.Torso.image), TILES.torso, shirt[0], head.skin);
    bakeBox(parts['Right Arm'], await img(parts['Right Arm'].image), TILES.limbA, shirt[0], head.skin); bakeBox(parts['Left Arm'], await img(parts['Left Arm'].image), TILES.limbB, shirt[0], head.skin);
    bakeBox(parts['Right Leg'], await img(parts['Right Leg'].image), TILES.limbA, pants[0], head.skin); bakeBox(parts['Left Leg'], await img(parts['Left Leg'].image), TILES.limbB, pants[0], head.skin);
    shrink(shirt); shrink(pants); const qs = quantize(shirt), qp = quantize(pants);
    // ---- write it: big-endian, as the console reads
    const out = new Uint8Array(SLOT.size - SLOT.outfit), dv = new DataView(out.buffer); let o = 0;
    out.set(head.skin.map(Math.round), 0); out[3] = head.hasHair ? 1 : 0; out.set(head.hair.map(Math.round), 4);
    out[8] = head.rings.length; out[9] = SEGS; o = 12;
    for (let i = 0; i < RINGS; i++) { const w = head.rings[i]; if (w) { dv.setInt16(o, Math.round(w.y * 1024)); out[o + 2] = Math.round(w.t * 255); for (let k = 0; k < SEGS; k++) dv.setUint16(o + 4 + k * 2, Math.round(w.r[k] * 1024)); } o += 4 + SEGS * 2; }
    o = 192; for (const q of [qs, qp, head.face]) { for (let i = 0; i < 256; i++) dv.setUint16(o + i * 2, q.pal[i]); o += 512; }
    for (const q of [qs, qp, head.face]) for (const l of q.levels) { out.set(l, o); o += l.length; }
    if (o > out.length) throw new Error('the outfit does not fit its slot');
    return { name: String(opts.name || 'Grug').slice(0, SLOT.name - 1), bytes: out, used: o,
      info: { rings: head.rings.length, headTriangles: head.triangles, hairTriangles: head.hairTriangles, colours: [qs.colours, qp.colours, head.face.colours], skin: head.skin.map(Math.round), hair: head.hasHair ? head.hair.map(Math.round) : null },
      pictures: { shirt: qs, pants: qp, face: head.face, body: BODY, faceSize: FACE } };
  }

  const ascii = s => Array.from(String(s), c => { const k = c.charCodeAt(0); return k >= 32 && k < 127 ? k : 63; });
  // an empty slot (no outfit in it: a ROM that finds one plays in its plain colours)
  function blank() { const s = new Uint8Array(SLOT.size), dv = new DataView(s.buffer); s.set(ascii(SLOT.magic), 0); dv.setUint32(8, SLOT.size); dv.setUint16(12, SLOT.version); return s; }
  // write into a ROM's slot, or into a slot on its own (in place). opts: { outfit (from build), stress, view: { x, z, yaw, pitch, dist } }
  function write(bytes, opts) {
    const at = bytes.length === SLOT.size ? 0 : SLOT.offset, dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < at + SLOT.size || String.fromCharCode(...bytes.subarray(at, at + 8)) !== SLOT.magic) throw new Error('this ROM has no outfit slot');
    if (dv.getUint16(at + 12) !== SLOT.version) throw new Error('this ROM\'s outfit slot is another version');
    opts = opts || {};
    if (opts.outfit) { bytes.fill(0, at + SLOT.name, at + SLOT.size); bytes.set(ascii(opts.outfit.name).slice(0, SLOT.name - 1), at + SLOT.name); bytes.set(opts.outfit.bytes, at + SLOT.outfit); dv.setUint16(at + 14, dv.getUint16(at + 14) | 1); }
    if (opts.stress !== undefined) dv.setUint16(at + 16, opts.stress === 'sweep' ? 0xFFFF : Math.max(0, Math.min(60000, opts.stress | 0)));
    if (opts.view) { const v = opts.view; dv.setUint16(at + 18, 1); [v.x, v.z, v.yaw, v.pitch, v.dist].forEach((n, i) => dv.setInt16(at + 20 + i * 2, Math.round(n || 0))); }
    return bytes;
  }
  const has = bytes => bytes.length >= SLOT.offset + SLOT.size && String.fromCharCode(...bytes.subarray(SLOT.offset, SLOT.offset + 8)) === SLOT.magic;

  // In a page: the ROM at romUrl wearing the outfit the player plays as on this site (GrugOutfits: static/outfits.js).
  // Gives { name, url } (url: a copy of the ROM in this tab, to play or to download; name: '' if only test settings went in),
  // or null when the ROM is right as it comes: nothing saved, or the starter Grug, which is what the file already has.
  // opts.stress / opts.view: the test settings (see write). Throws if the ROM or the outfit can't be read.
  async function wear(romUrl, opts) {
    opts = opts || {}; const store = typeof window !== 'undefined' && window.GrugOutfits, test = opts.stress !== undefined || !!opts.view; let rec = null;
    try { rec = store ? await store.activeRecord() : null; } catch (e) { }
    const own = rec && rec.glb && !(rec.starter && rec.id === 'starter-grug');
    if (!own && !test) return null;
    const r = await fetch(romUrl); if (!r.ok) throw new Error('ROM ' + r.status);
    const bytes = new Uint8Array(await r.arrayBuffer()); let name = '';
    if (!has(bytes)) throw new Error('this ROM has no outfit slot');
    if (own) { const fit = await build(new Uint8Array(await rec.glb.arrayBuffer()), { name: rec.name }); write(bytes, { outfit: fit }); name = fit.name; }
    if (test) write(bytes, { stress: opts.stress, view: opts.view });
    return { name, id: own ? rec.id : '', url: URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })) };
  }

  return { SLOT, BODY, FACE, TILES, CORNERS, parseGLB, build, blank, write, has, wear };
});
