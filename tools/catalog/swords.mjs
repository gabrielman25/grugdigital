// MilkAndBanana Modular Sword Kit (CC0) -> one compact binary for the catalog's Back department
import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PNG } from 'pngjs';
globalThis.window = globalThis; globalThis.self = globalThis; URL.createObjectURL = () => 'blob:x';
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
// usage: node swords.mjs <kit folder> <palette png> <out .bin>   (needs: npm i three@0.149.0 pngjs)
// The kit's parts sit at one shared origin (the guard at 0, the blade up +y), so they stack as they are. Only the Steel set is
// read: our own colours replace the kit's metals. Duplicate shapes are dropped.
const R = process.argv[2].replace(/\/?$/, '/');
const pal = PNG.sync.read(fs.readFileSync(process.argv[3])), PW = pal.width, PH = pal.height;
const texel = (u, v) => { u = u - Math.floor(u); v = v - Math.floor(v); const x = Math.min(PW - 1, Math.floor(u * PW)), y = Math.min(PH - 1, Math.floor((1 - v) * PH)), i = (y * PW + x) * 4; return [pal.data[i], pal.data[i + 1], pal.data[i + 2]]; };
const COLS = 32, ROWS = 6;
const out = [], seen = new Set();
for (const [dir, kind] of [['Blade/Steel/Clean', 'blade'], ['Guard/Steel', 'guard'], ['Grip/Steel', 'grip'], ['Pommel/Steel', 'pommel']]) {
  for (const f of fs.readdirSync(R + dir).sort()) {
    const buf = fs.readFileSync(R + dir + '/' + f), g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
    g.updateMatrixWorld(true); let mesh = null; g.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.scale(0.01, 0.01, 0.01);
    const P = geo.attributes.position, UV = geo.attributes.uv, n = P.count;
    // per triangle: its palette cell (the material) and each corner's brightness within the cell (the kit's painted shading)
    const cellOf = new Int32Array(n), lum = new Float32Array(n), area = new Map();
    for (let t = 0; t < n; t += 3) {
      let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += UV.getX(t + k) / 3; v += UV.getY(t + k) / 3; }
      u -= Math.floor(u); v -= Math.floor(v); const c = Math.floor(u * COLS) + Math.floor((1 - v) * ROWS) * COLS;
      const a = new THREE.Vector3().fromBufferAttribute(P, t), b = new THREE.Vector3().fromBufferAttribute(P, t + 1), cc = new THREE.Vector3().fromBufferAttribute(P, t + 2), ar = b.sub(a).cross(cc.sub(a)).length() / 2;
      area.set(c, (area.get(c) || 0) + ar);
      for (let k = 0; k < 3; k++) { cellOf[t + k] = c; const [r, gg, bb] = texel(UV.getX(t + k), UV.getY(t + k)); lum[t + k] = (0.3 * r + 0.59 * gg + 0.11 * bb) / 255; }
    }
    const ranked = [...area.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const cellCol = c => { const u = ((c % COLS) + 0.5) / COLS, v = 1 - (Math.floor(c / COLS) + 0.5) / ROWS; return texel(u, v); };
    const steel = c => { const [r, gg, bb] = cellCol(c); return Math.abs(r - 0x88) + Math.abs(gg - 0xb1) + Math.abs(bb - 0xd6) < 30; };
    // brightness relative to the part's own range, per cell
    const lo = {}, hi = {}; for (let i = 0; i < n; i++) { const c = cellOf[i]; lo[c] = Math.min(lo[c] ?? 9, lum[i]); hi[c] = Math.max(hi[c] ?? -9, lum[i]); }
    const reg = new Float32Array(n), sh = new Float32Array(n);
        for (let i = 0; i < n; i++) { const c = cellOf[i]; reg[i] = steel(c) ? 0 : 1; const span = hi[c] - lo[c]; sh[i] = span > 0.02 ? (lum[i] - lo[c]) / span : 0.6; }
    geo.deleteAttribute('uv'); geo.setAttribute('reg', new THREE.BufferAttribute(reg, 1)); geo.setAttribute('sh', new THREE.BufferAttribute(sh, 1));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'reg', 'sh'].includes(k)) geo.deleteAttribute(k);
    const m = mergeVertices(geo, 1e-4); m.computeBoundingBox();
    const key = kind + ':' + Array.from(m.attributes.position.array.slice(0, 60)).map(x => x.toFixed(3)).join(',') + ':' + m.attributes.position.count;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ kind, name: f.replace('.fbx', ''), geo: m, cols: ranked.slice(0, 3).map(c => '#' + cellCol(c).map(x => x.toString(16).padStart(2, '0')).join('')), regs: ranked.some(c => !steel(c)) ? 2 : 1 });
  }
}
// pack: header JSON, then per part positions (int16, 1/2000 unit), normals (int8), region (uint8), shade (uint8), indices (uint16)
const Q = 2000; let bytes = []; const head = { q: Q, parts: [] };
const chunks = []; let off = 0;
const push = ta => { const b = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength); const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } chunks.push(b); const o = off; off += b.length; return o; };
for (const p of out) {
  const g = p.geo, P = g.attributes.position, N = g.attributes.normal, n = P.count, I = g.index.array;
  const pos = new Int16Array(n * 3), nor = new Int8Array(n * 3), rs = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = Math.round(P.array[i * 3 + k] * Q); nor[i * 3 + k] = Math.round(N.array[i * 3 + k] * 127); } rs[i * 2] = g.attributes.reg.array[i]; rs[i * 2 + 1] = Math.round(g.attributes.sh.array[i] * 255); }
  const idx = new Uint16Array(I);
  const b = g.boundingBox;
  head.parts.push({ k: p.kind, n: p.name, v: n, i: idx.length, pos: push(pos), nor: push(nor), rs: push(rs), idx: push(idx), box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(x => +x.toFixed(3)), regs: p.regs, cols: p.cols });
}
const body = Buffer.concat(chunks), hj = Buffer.from(JSON.stringify(head)), hl = Buffer.alloc(4); hl.writeUInt32LE(hj.length + ((4 - (hj.length + 4) % 4) % 4));
const hpad = Buffer.alloc((4 - (hj.length + 4) % 4) % 4, 32);
fs.writeFileSync(process.argv[4], Buffer.concat([hl, hj, hpad, body]));
const cnt = {}; out.forEach(p => cnt[p.kind] = (cnt[p.kind] || 0) + 1);
console.log(cnt, 'bytes', 4 + hj.length + body.length, 'verts', out.reduce((s, p) => s + p.geo.attributes.position.count, 0));
const allc={}; for (const p of out) for (const c of p.cols) (allc[p.kind+" "+c]=(allc[p.kind+" "+c]||0)+1); console.log(allc);
