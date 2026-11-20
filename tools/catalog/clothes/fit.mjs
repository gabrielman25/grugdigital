/* Fits the Modular Anime Character pack's clothes to the classic Grug avatar (Sandy). Run in Node:
   node fit.mjs <pack Meshes folder> <sandy.json> <out folder>
   sandy.json is her body in its bind pose (positions, normals, skin weights, bone names and inverses), dumped from the page.
   Each garment vertex is placed on her the way it sat on the pack's own body: per body part (torso, upper and lower arm,
   thigh, calf, foot) it keeps where along the part it is, which way round it is, and how far out from the skin; then the
   offsets are smoothed, nothing is left inside her, and it takes her skin weights so it moves with her. Skin under a garment
   is listed so the page can hide it. */
import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.window = globalThis; globalThis.self = globalThis; URL.createObjectURL = () => 'blob:x';
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
console.warn = () => {};
const [MESHES, SANDY, OUT] = process.argv.slice(2);
const gc = (A, i, k) => A.array[i * A.itemSize + k];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const load = f => { const buf = fs.readFileSync(MESHES + '/' + f); const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ''); g.updateMatrixWorld(true); const ms = []; g.traverse(o => { if (o.isSkinnedMesh) ms.push(o); }); return ms; };
const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

/* ---- her body (bind pose, mesh space = world: bindMatrix is identity) */
const S = JSON.parse(fs.readFileSync(SANDY, 'utf8').split('\n')[0]);
const SP = b64(S.pos, Float32Array), SN = b64(S.nor, Float32Array), SSI = b64(S.si, Float32Array), SSW = b64(S.sw, Float32Array), SIDX = b64(S.idx, Uint32Array), SNV = SP.length / 3;
const SJ = {}; S.bones.forEach((n, i) => { SJ[n] = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(S.inv[i]).invert()); });
const sRegion = n => { const m = /_(L|R)_/.exec(n), sd = m ? m[1] : (/toe\d+_(L|R)/.exec(n) || [])[1]; if (/^leg_[LR]_upr/.test(n)) return 'thigh' + sd; if (/^leg_[LR]_lwr/.test(n)) return 'calf' + sd; if (/^leg_[LR]_(foot|ball)/.test(n) || /^toe/.test(n)) return 'foot' + sd; if (/^arm_[LR]_upr/.test(n)) return 'uarm' + sd; if (/^arm_[LR]_(lwr|wrist)/.test(n) || /^finger_/.test(n)) return 'farm' + sd; return 'torso'; };
const SBR = S.bones.map(sRegion);
const sDom = new Array(SNV); for (let i = 0; i < SNV; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (SSW[i * 4 + k] > bw) { bw = SSW[i * 4 + k]; bi = SSI[i * 4 + k]; } sDom[i] = SBR[bi]; }

/* ---- the pack's body */
const body = load('F_body.fbx'), AJ = {}, AP = [], AR = [];
for (const m of body) {
  const sk = m.skeleton, G = m.geometry, P = G.attributes.position, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, BM = m.bindMatrix;
  sk.bones.forEach((b, i) => { if (!AJ[b.name]) AJ[b.name] = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()); });
  for (let i = 0; i < P.count; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (gc(SW, i, k) > bw) { bw = gc(SW, i, k); bi = gc(SI, i, k); } AP.push(new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM)); AR.push(aRegion(sk.bones[bi].name)); }
}
// The pack's neck is in its head file, which isn't in the pack folder, so its body has no neck at all above the collarbones.
// The plain tee hugs the neck, so its neckline (pulled in by the cloth's thickness) stands in for the neck's surface there.
// Without it every neckline was laid about 5 cm out from her throat, and the back of the collar showed through the gap.
for (const m of load('F_top.001_shirt.fbx')) { const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, BM = m.bindMatrix, NM = new THREE.Matrix3().getNormalMatrix(BM); for (let i = 0; i < P.count; i++) { const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM); if (p.y < 121 || Math.abs(p.x) > 8) continue; p.addScaledVector(new THREE.Vector3().fromBufferAttribute(N, i).applyMatrix3(NM).normalize(), -0.3); AP.push(p); AR.push('torso'); } }
function aRegion(n) { const sd = /(L|R)$/.test(n) ? n.slice(-1) : ''; if (/Thigh/.test(n)) return 'thigh' + sd; if (/Calf/.test(n)) return 'calf' + sd; if (/Foot|ToeBase/.test(n)) return 'foot' + sd; if (/Upperarm/.test(n)) return 'uarm' + sd; if (/Forearm|Hand|Mid\d|Index\d|Ring\d|Pinky\d|Thumb\d/.test(n)) return 'farm' + sd; return 'torso'; }

/* ---- the parts: limbs as segments, the torso as heights round a centre line */
const SEG = {};
for (const sd of ['L', 'R']) {
  SEG['thigh' + sd] = { A: ['CC_BaseThigh' + sd, 'CC_BaseCalf' + sd], S: ['leg_' + sd + '_uprTwist00_jnt', 'leg_' + sd + '_lwrTwist00_jnt'], ref: V(0, 0, 1), t: [-0.4, 1.4] };
  SEG['calf' + sd] = { A: ['CC_BaseCalf' + sd, 'CC_BaseFoot' + sd], S: ['leg_' + sd + '_lwrTwist00_jnt', 'leg_' + sd + '_foot_jnt'], ref: V(0, 0, 1), t: [-0.4, 1.4] };
  SEG['foot' + sd] = { A: ['CC_BaseFoot' + sd, 'CC_BaseToeBase' + sd], S: ['leg_' + sd + '_foot_jnt', 'leg_' + sd + '_ball_jnt'], ref: V(0, 1, 0), t: [-1.2, 2.4] };
  SEG['uarm' + sd] = { A: ['CC_BaseUpperarm' + sd, 'CC_BaseForearm' + sd], S: ['arm_' + sd + '_uprTwist00_jnt', 'arm_' + sd + '_lwrTwist00_jnt'], ref: V(0, 0, 1), t: [-0.5, 1.4] };
  SEG['farm' + sd] = { A: ['CC_BaseForearm' + sd, 'CC_BaseHand' + sd], S: ['arm_' + sd + '_lwrTwist00_jnt', 'arm_' + sd + '_wrist_jnt'], ref: V(0, 0, 1), t: [-0.4, 1.8] };
}
const NT = 64, NTH = 72;
function frame(a, b, ref) { const Y = b.clone().sub(a), L = Y.length(); Y.normalize(); const Z = ref.clone().addScaledVector(Y, -ref.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z); return { a, Y, Z, X, L }; }
function polar(F, p) { const d = p.clone().sub(F.a), t = d.dot(F.Y) / F.L, r = d.addScaledVector(F.Y, -t * F.L), x = r.dot(F.X), z = r.dot(F.Z); return { t, th: Math.atan2(x, z), r: Math.hypot(x, z) }; }
function grid(F, pts, t0, t1) {
  const G = new Float32Array(NT * NTH).fill(-1);
  for (const p of pts) { const q = polar(F, p), it = Math.round((q.t - t0) / (t1 - t0) * (NT - 1)), ih = ((Math.round((q.th + Math.PI) / (2 * Math.PI) * NTH) % NTH) + NTH) % NTH; if (it < 0 || it >= NT) continue; const k = it * NTH + ih; if (q.r > G[k]) G[k] = q.r; }
  fill(G); return G;
}
function fill(G) {
  for (let pass = 0; pass < 60; pass++) { let any = false; const C = G.slice(); for (let it = 0; it < NT; it++) for (let ih = 0; ih < NTH; ih++) { const k = it * NTH + ih; if (C[k] >= 0) continue; let s = 0, c = 0; for (const [a, b] of [[it, ih - 1], [it, ih + 1], [it - 1, ih], [it + 1, ih]]) { if (a < 0 || a >= NT) continue; const v = C[a * NTH + ((b + NTH) % NTH)]; if (v >= 0) { s += v; c++; } } if (c) { G[k] = s / c; any = true; } else any = true; } if (!any) break; }
  for (let k = 0; k < G.length; k++) if (G[k] < 0) G[k] = 0;
  for (let pass = 0; pass < 2; pass++) { const C = G.slice(); for (let it = 0; it < NT; it++) for (let ih = 0; ih < NTH; ih++) { let s = 0, c = 0; for (let a = it - 1; a <= it + 1; a++) for (let b = ih - 1; b <= ih + 1; b++) { if (a < 0 || a >= NT) continue; s += C[a * NTH + ((b + NTH) % NTH)]; c++; } G[it * NTH + ih] = Math.max(C[it * NTH + ih], s / c); } }
}
function look(G, t, th, t0, t1) { const ft = Math.max(0, Math.min(NT - 1, (t - t0) / (t1 - t0) * (NT - 1))), fh = ((th + Math.PI) / (2 * Math.PI) * NTH % NTH + NTH) % NTH, i0 = Math.floor(ft), i1 = Math.min(NT - 1, i0 + 1), h0 = Math.floor(fh) % NTH, h1 = (h0 + 1) % NTH, a = ft - i0, b = fh - Math.floor(fh), g = (i, h) => G[i * NTH + h]; return (g(i0, h0) * (1 - b) + g(i0, h1) * b) * (1 - a) + (g(i1, h0) * (1 - b) + g(i1, h1) * b) * a; }
const sPts = r => { const out = []; for (let i = 0; i < SNV; i++) if (sDom[i] === r) out.push(V(SP[i * 3], SP[i * 3 + 1], SP[i * 3 + 2])); return out; };
for (const [k, s] of Object.entries(SEG)) {
  s.FA = frame(AJ[s.A[0]], AJ[s.A[1]], s.ref); s.FS = frame(SJ[s.S[0]], SJ[s.S[1]], s.ref);
  s.GA = grid(s.FA, AP.filter((p, i) => AR[i] === k), s.t[0], s.t[1]); s.GS = grid(s.FS, sPts(k), s.t[0], s.t[1]);
  s.R = new THREE.Matrix4().makeBasis(s.FS.X, s.FS.Y, s.FS.Z).multiply(new THREE.Matrix4().makeBasis(s.FA.X, s.FA.Y, s.FA.Z).transpose());
}
// the torso: her heights from the pack's (hips, shoulders, neck base line up), and its outline at each height
const TL = [[AJ.CC_BaseThighL.y, SJ.leg_L_uprTwist00_jnt.y], [AJ.CC_BaseUpperarmL.y, SJ.arm_L_uprTwist00_jnt.y], [AJ.CC_Base_NeckTwist01.y, SJ.head_M_neck_01_jnt.y]];
const mapY = y => { const L = TL; let i = 0; if (y >= L[1][0]) i = 1; const [a0, b0] = L[i], [a1, b1] = L[i + 1]; return b0 + (y - a0) * (b1 - b0) / (a1 - a0); };
const TOR = { A: { pts: AP.filter((p, i) => AR[i] === 'torso') }, S: { pts: sPts('torso') } };
for (const s of [TOR.A, TOR.S]) {
  let y0 = 1e9, y1 = -1e9; for (const p of s.pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } s.y0 = y0 - 25; s.y1 = y1 + 10;
  const NB = NT, zc = new Float32Array(NB), zmin = new Float32Array(NB).fill(1e9), zmax = new Float32Array(NB).fill(-1e9);
  for (const p of s.pts) { const b = Math.max(0, Math.min(NB - 1, Math.round((p.y - s.y0) / (s.y1 - s.y0) * (NB - 1)))); if (Math.abs(p.x) < 4) { zmin[b] = Math.min(zmin[b], p.z); zmax[b] = Math.max(zmax[b], p.z); } }
  for (let b = 0; b < NB; b++) zc[b] = zmin[b] < 1e8 ? (zmin[b] + zmax[b]) / 2 : NaN;
  for (let b = 0; b < NB; b++) if (isNaN(zc[b])) { let k = 1; while (k < NB) { if (b - k >= 0 && !isNaN(zc[b - k])) { zc[b] = zc[b - k]; break; } if (b + k < NB && !isNaN(zc[b + k])) { zc[b] = zc[b + k]; break; } k++; } }
  s.zc = y => { const f = Math.max(0, Math.min(NB - 1, (y - s.y0) / (s.y1 - s.y0) * (NB - 1))), i = Math.floor(f), j = Math.min(NB - 1, i + 1); return zc[i] + (zc[j] - zc[i]) * (f - i); };
  s.G = new Float32Array(NT * NTH).fill(-1);
  for (const p of s.pts) { const it = Math.round((p.y - s.y0) / (s.y1 - s.y0) * (NT - 1)), th = Math.atan2(p.x, p.z - s.zc(p.y)), ih = ((Math.round((th + Math.PI) / (2 * Math.PI) * NTH) % NTH) + NTH) % NTH, r = Math.hypot(p.x, p.z - s.zc(p.y)), k = it * NTH + ih; if (r > s.G[k]) s.G[k] = r; }
  fill(s.G);
}
const GAP = 0.35, LEG_GAP = 0.9;   // her thighs and calves have few vertices, so their skin bulges between them: more room there
for (const [k, sg] of Object.entries(SEG)) sg.gap = /^(thigh|calf)/.test(k) ? LEG_GAP : GAP;
// Her neck joint sits halfway up her throat; the pack's sits at the base of its (longer) neck, where its necklines are. So by
// the joints alone every neckline and collar rode up her throat. Round the middle of the neck they come down: NECK_DROP cm at
// the front, less at the back, nothing out at the shoulders (the shoulder seams stay where they are) or below the chest.
const NECK_DROP = { front: 3.5, back: 2 };
const neckDrop = p => { const up = Math.max(0, Math.min(1, (p.y - (TL[1][0] - 4)) / 6)), side = Math.max(0, Math.min(1, (11 - Math.abs(p.x)) / 6)), front = Math.max(0, Math.min(1, (p.z - TOR.A.zc(p.y) + 2) / 4)); return up * side * (NECK_DROP.back + (NECK_DROP.front - NECK_DROP.back) * front); };
function mapTorso(p) { const A = TOR.A, Sx = TOR.S, zA = A.zc(p.y), th = Math.atan2(p.x, p.z - zA), r = Math.hypot(p.x, p.z - zA), h = mapY(p.y) - neckDrop(p), rA = look(A.G, p.y, th, A.y0, A.y1), rS = look(Sx.G, h, th, Sx.y0, Sx.y1), r2 = rS + Math.max(r - rA, GAP); return V(Math.sin(th) * r2, h, Sx.zc(h) + Math.cos(th) * r2); }
function mapSeg(s, p) { const q = polar(s.FA, p), rA = look(s.GA, q.t, q.th, s.t[0], s.t[1]), rS = look(s.GS, q.t, q.th, s.t[0], s.t[1]), r2 = rS + Math.max(q.r - rA, s.gap), F = s.FS; return F.a.clone().addScaledVector(F.Y, q.t * F.L).addScaledVector(F.X, Math.sin(q.th) * r2).addScaledVector(F.Z, Math.cos(q.th) * r2); }

/* ---- her body, for the last checks: a grid of her vertices */
const CELL = 2.5, HASH = new Map(); const hk = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
for (let i = 0; i < SNV; i++) { const k = hk(SP[i * 3], SP[i * 3 + 1], SP[i * 3 + 2]); let a = HASH.get(k); if (!a) HASH.set(k, a = []); a.push(i); }
function nearS(p, n, region) { const out = []; const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL); for (let R = 1; R <= 6 && out.length < n; R++) { out.length = 0; for (let x = cx - R; x <= cx + R; x++) for (let y = cy - R; y <= cy + R; y++) for (let z = cz - R; z <= cz + R; z++) { const a = HASH.get(x + ',' + y + ',' + z); if (!a) continue; for (const i of a) { if (region && sDom[i] !== region && !(region === 'torso' && /thigh|uarm/.test(sDom[i]))) continue; const d = (SP[i * 3] - p.x) ** 2 + (SP[i * 3 + 1] - p.y) ** 2 + (SP[i * 3 + 2] - p.z) ** 2; out.push([d, i]); } } } out.sort((a, b) => a[0] - b[0]); return out.slice(0, n); }

/* ---- one garment */
let SHOE = false;
// each foot: the pack's ankle and toe, hers, and the move from one to the other (turn about the vertical, uniform scale)
const FEET = ['L', 'R'].map(sd => {
  const a0 = AJ['CC_BaseFoot' + sd], t0 = AJ['CC_BaseToeBase' + sd], a1 = SJ['leg_' + sd + '_foot_jnt'], t1 = SJ['leg_' + sd + '_ball_jnt'];
  const h0 = V(t0.x - a0.x, 0, t0.z - a0.z), h1 = V(t1.x - a1.x, 0, t1.z - a1.z), ang = Math.atan2(h1.x, h1.z) - Math.atan2(h0.x, h0.z);
  const M = new THREE.Matrix4().makeRotationY(ang), k = h1.length() / h0.length();
  let soleA = 1e9; for (let i = 0; i < AP.length; i++) if (AR[i] === 'foot' + sd) soleA = Math.min(soleA, AP[i].y);
  let soleS = 1e9; for (let i = 0; i < SNV; i++) if (sDom[i] === 'foot' + sd) soleS = Math.min(soleS, SP[i * 3 + 1]);
  // her sole where the pack's sole lands after the move
  const dy = soleS - (a1.y + (soleA - a0.y) * k);
  if (process.env.FEETDBG) console.log(sd, 'pack ankle', a0.toArray().map(v => v.toFixed(1)), 'hers', a1.toArray().map(v => v.toFixed(1)), 'turn', (ang * 57.3).toFixed(1), 'scale', k.toFixed(2), 'dy', dy.toFixed(2));
  return { sd, a0, a1, M, k, dy, ankY: a0.y, sx: Math.sign(a0.x), bone: S.bones.indexOf('leg_' + sd + '_foot_jnt') };
});
function fit(file) {
  const ms = load(file), parts = [];
  for (const m of ms) {
    const G = m.geometry, sk = m.skeleton, P = G.attributes.position, N = G.attributes.normal, UV = G.attributes.uv, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, n = P.count, BM = m.bindMatrix;
    const BR = sk.bones.map(b => aRegion(b.name)), out = new Float32Array(n * 3), nrm = new Float32Array(n * 3), main = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM), nn = new THREE.Vector3().fromBufferAttribute(N, i), w = {};
      for (let k = 0; k < 4; k++) { const ww = gc(SW, i, k); if (ww > 0) { const r = BR[gc(SI, i, k)]; w[r] = (w[r] || 0) + ww; } }
      let sum = 0, best = 'torso', bw = -1; const acc = V(0, 0, 0), an = V(0, 0, 0);
      for (const [r, ww] of Object.entries(w)) { const q = r === 'torso' || !SEG[r] ? mapTorso(p) : mapSeg(SEG[r], p); acc.addScaledVector(q, ww); an.addScaledVector(r === 'torso' || !SEG[r] ? nn : nn.clone().applyMatrix4(SEG[r].R), ww); sum += ww; if (ww > bw) { bw = ww; best = r; } }
      if (!sum) { acc.copy(mapTorso(p)); an.copy(nn); sum = 1; }
      acc.multiplyScalar(1 / sum); an.normalize(); out.set([acc.x, acc.y, acc.z], i * 3); nrm.set([an.x, an.y, an.z], i * 3); main[i] = best;
      if (!main[i] || main[i] === 'torso') main[i] = 'torso';
    }
    // smooth the move (not the shape): the change from the pack's body to hers, averaged with its neighbours a few times
    const key = new Map(), wid = new Int32Array(n); for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 200) + ',' + Math.round(P.getY(i) * 200) + ',' + Math.round(P.getZ(i) * 200); if (!key.has(k)) key.set(k, key.size); wid[i] = key.get(k); }
    const W = key.size, D = new Float32Array(W * 3), cnt = new Float32Array(W), nb = Array.from({ length: W }, () => new Set());
    for (let i = 0; i < n; i++) { const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM); D[wid[i] * 3] += out[i * 3] - p.x; D[wid[i] * 3 + 1] += out[i * 3 + 1] - p.y; D[wid[i] * 3 + 2] += out[i * 3 + 2] - p.z; cnt[wid[i]]++; }
    for (let k = 0; k < W; k++) for (let c = 0; c < 3; c++) D[k * 3 + c] /= cnt[k];
    for (let t = 0; t < n; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nb[wid[t + a]].add(wid[t + b]);
    for (let pass = 0; pass < 6; pass++) { const C = D.slice(); for (let k = 0; k < W; k++) { let x = 0, y = 0, z = 0, c = 0; for (const j of nb[k]) { x += C[j * 3]; y += C[j * 3 + 1]; z += C[j * 3 + 2]; c++; } if (c) { D[k * 3] = C[k * 3] * 0.5 + x / c * 0.5; D[k * 3 + 1] = C[k * 3 + 1] * 0.5 + y / c * 0.5; D[k * 3 + 2] = C[k * 3 + 2] * 0.5 + z / c * 0.5; } } }
    for (let i = 0; i < n; i++) { const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM); out[i * 3] = p.x + D[wid[i] * 3]; out[i * 3 + 1] = p.y + D[wid[i] * 3 + 1]; out[i * 3 + 2] = p.z + D[wid[i] * 3 + 2]; }
    // Shoes keep their own shape: the foot part is moved whole (turned to her foot's direction, scaled by foot length, its
    // sole on her sole) and her feet are hidden under it. Only a boot's shaft, above the ankle, is fitted round her leg.
    const rigid = new Float32Array(n);
    if (SHOE) for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM), F = FEET[p.x * FEET[0].sx > 0 ? 0 : 1];
      const t = Math.max(0, Math.min(1, (F.ankY + 14 - p.y) / 6)), w = t * t * (3 - 2 * t); rigid[i] = w; if (!w) continue;
      const q = p.clone().sub(F.a0).applyMatrix4(F.M).multiplyScalar(F.k).add(F.a1); q.y += F.dy;
      out[i * 3] += (q.x - out[i * 3]) * w; out[i * 3 + 1] += (q.y - out[i * 3 + 1]) * w; out[i * 3 + 2] += (q.z - out[i * 3 + 2]) * w;
      const nn = new THREE.Vector3().fromBufferAttribute(N, i).applyMatrix4(F.M), cur = V(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]).lerp(nn, w).normalize(); nrm.set([cur.x, cur.y, cur.z], i * 3);
    }
    // nothing inside her: pushed out along her skin's normal; and her skin weights, from her nearest skin
    const si = new Uint16Array(n * 4), sw = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      if (rigid[i] > 0.5) { const F = FEET[out[i * 3] * Math.sign(FEET[0].a1.x) > 0 ? 0 : 1]; si[i * 4] = F.bone; sw[i * 4] = 255; continue; }
      const p = V(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]), near = nearS(p, 6, main[i]); if (!near.length) continue;
      for (let pass = 0; pass < 3; pass++) for (const [, j] of nearS(p, 10, null)) { const b = V(SP[j * 3], SP[j * 3 + 1], SP[j * 3 + 2]), bn = V(SN[j * 3], SN[j * 3 + 1], SN[j * 3 + 2]), dv = p.clone().sub(b), d = dv.dot(bn), tan = dv.addScaledVector(bn, -d).length(); const g = /^(thigh|calf)/.test(sDom[j]) ? LEG_GAP : GAP; if (d < g && d > -6 && tan < 2.2) p.addScaledVector(bn, g - d); }
      out.set([p.x, p.y, p.z], i * 3);
      const acc = new Map(); let tot = 0; for (const [d, j] of near.slice(0, 4)) { const wv = 1 / (Math.sqrt(d) + 0.3); for (let k = 0; k < 4; k++) { const b = SSI[j * 4 + k], ww = SSW[j * 4 + k] * wv; if (ww > 0) { acc.set(b, (acc.get(b) || 0) + ww); tot += ww; } } }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), ts = top.reduce((s, x) => s + x[1], 0) || 1; 
      const qs = top.map(([, ww]) => Math.round(ww / ts * 255)); let over = qs.reduce((x, y) => x + y, 0) - 255; for (let k = 0; over !== 0 && k < qs.length; k++) { const c = over > 0 ? Math.min(over, qs[k]) : over; qs[k] -= c; over -= c; } top.forEach(([b], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = qs[k]; });   // weights always add up to exactly 255 (rounding once wrapped the last one round to 255)
    }
    let groups = G.groups.length ? G.groups.map(g => ({ start: g.start, count: g.count, mi: g.materialIndex })) : [{ start: 0, count: n, mi: 0 }];
    // her hands are round balls, so gloves (the racing suit's) can't fit them: a triangle all on the pack's hand and finger
    // bones is left out
    const HB = sk.bones.map(b => /Hand|Index\d|Mid\d|Ring\d|Pinky\d|Thumb\d/.test(b.name)), hw = i => { let w = 0; for (let k = 0; k < 4; k++) if (HB[gc(SI, i, k)]) w += gc(SW, i, k); return w; };
    const bp = name => { const k = sk.bones.findIndex(b => b.name === name); return k < 0 ? null : V(0, 0, 0).setFromMatrixPosition(sk.boneInverses[k].clone().invert()); };
    const WR = ['L', 'R'].map(sd => { const f = bp('CC_BaseForearm' + sd), h = bp('CC_BaseHand' + sd); return f && h ? { h, dir: h.clone().sub(f).normalize() } : null; }).filter(Boolean);
    const past = i => { if (hw(i) < 0.5) return false; const p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(BM); let best = null, bd = 1e9; for (const w of WR) { const d = p.distanceTo(w.h); if (d < bd) { bd = d; best = w; } } return !!best && p.clone().sub(best.h).dot(best.dir) > 2.5; };
    const keep = t => !(past(t) && past(t + 1) && past(t + 2));
    let dropped = 0; for (let t = 0; t < n; t += 3) if (!keep(t)) dropped++;
    if (dropped) {
      const map = []; const g2 = [];
      for (const gr of groups) { const st = map.length; for (let t = gr.start; t < gr.start + gr.count; t += 3) if (keep(t)) map.push(t, t + 1, t + 2); if (map.length > st) g2.push({ start: st, count: map.length - st, mi: gr.mi }); }
      const pick = (A, k) => { const o = new A.constructor(map.length * k); map.forEach((v, j) => { for (let c = 0; c < k; c++) o[j * k + c] = A[v * k + c]; }); return o; };
      const UVa = new Float32Array(UV.array);
      parts.push({ name: m.name, n: map.length, P: pick(out, 3), N: pick(nrm, 3), UV: pick(UVa, 2), si: pick(si, 4), sw: pick(sw, 4), groups: g2, mats: [].concat(m.material).map(x => x.name) });
      console.error('  ' + m.name + ': left out ' + dropped + ' glove triangles'); continue;
    }
    parts.push({ name: m.name, n, P: out, N: nrm, UV: new Float32Array(UV.array), si, sw, groups, mats: [].concat(m.material).map(x => x.name) });
  }
  return parts;
}
// her skin that a garment covers (a ray out along her normal meets it within 7 cm), shrunk by one ring so no gap shows at a hem
function hideList(parts) {
  const tris = []; for (const pt of parts) for (let t = 0; t < pt.n; t += 3) tris.push([V(pt.P[t * 3], pt.P[t * 3 + 1], pt.P[t * 3 + 2]), V(pt.P[t * 3 + 3], pt.P[t * 3 + 4], pt.P[t * 3 + 5]), V(pt.P[t * 3 + 6], pt.P[t * 3 + 7], pt.P[t * 3 + 8])]);
  const box = new THREE.Box3(); for (const [a, b, c] of tris) box.expandByPoint(a).expandByPoint(b).expandByPoint(c); box.expandByScalar(3);
  const ray = new THREE.Ray(), hit = V(0, 0, 0), cov = new Uint8Array(SNV), TB = tris.map(([a, b, c]) => new THREE.Box3().setFromPoints([a, b, c]));
  for (let i = 0; i < SNV; i++) {
    const p = V(SP[i * 3], SP[i * 3 + 1], SP[i * 3 + 2]); if (!box.containsPoint(p)) continue; const nn = V(SN[i * 3], SN[i * 3 + 1], SN[i * 3 + 2]); ray.set(p.clone().addScaledVector(nn, -3), nn);
    const lim = new THREE.Box3().setFromPoints([p.clone().addScaledVector(nn, -3), p.clone().addScaledVector(nn, 7)]).expandByScalar(0.5);
    for (let t = 0; t < tris.length; t++) { if (!TB[t].intersectsBox(lim)) continue; const [a, b, c] = tris[t]; if (ray.intersectTriangle(a, b, c, false, hit) && hit.distanceTo(p) < 7) { cov[i] = 1; break; } }
  }
  const nbr = Array.from({ length: SNV }, () => []); for (let t = 0; t < SIDX.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nbr[SIDX[t + a]].push(SIDX[t + b]);
  // her own vertices share positions across seams: treat them as one
  // shoes: her whole feet go, and her ankle up to the shoe's rim (the highest point of the shoe close round her ankle), so no
  // skin pokes through the opening
  // (any skin with shoe above it, within a centimetre sideways: a tongue leaning over her shin counts)
  const TOP = new Map(), ck = (x, z) => Math.round(x) + ',' + Math.round(z);
  if (SHOE) for (const pt of parts) for (let t = 0; t < pt.n; t++) { const x = pt.P[t * 3], y = pt.P[t * 3 + 1], z = pt.P[t * 3 + 2]; if (y > 40) continue; const k = ck(x, z); if (!(TOP.get(k) > y)) TOP.set(k, y); }
  const under = i => { if (!SHOE || SP[i * 3 + 1] > 40) return false; const x = SP[i * 3], z = SP[i * 3 + 2]; let top = -1e9; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const v = TOP.get(ck(x + dx, z + dz)); if (v > top) top = v; } return SP[i * 3 + 1] < top - 0.3; };
  const out = [], soft = []; for (let i = 0; i < SNV; i++) { if ((cov[i] && nbr[i].every(j => cov[j])) || (SHOE && /^foot/.test(sDom[i])) || under(i)) out.push(i); else if (cov[i]) soft.push(i); }
  // the ring left at a hem is hidden part of the way (0.8: the skin shader cuts at 0.5), so it can't poke through the cloth
  out.soft = soft; return out;
}
function pack(parts, hide, file) {
  const chunks = [], head = { parts: [], hide: 0 }; let off = 0;
  const push = ta => { const b = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength), pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } chunks.push(b); const o = off; off += b.length; return o; };
  for (const pt of parts) {
    // index it: vertices with the same everything become one
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pt.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(pt.N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(pt.UV, 2)); g.setAttribute('skinIndex', new THREE.BufferAttribute(new Float32Array(pt.si), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(pt.sw), 4));
    const groups = [];
    const idxAll = []; let gm = null;
    for (const gr of pt.groups) { const sub = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(g.attributes)) sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize)); groups.push({ g: mergeVertices(sub, 1e-4), mi: gr.mi }); }
    // join the groups
    let nv = 0; const Pp = [], Nn = [], U = [], SI2 = [], SW2 = [], gl = [];
    for (const { g: m, mi } of groups) { const I = m.index.array, start = idxAll.length; for (const x of I) idxAll.push(x + nv); gl.push({ start, count: I.length, mi }); const A = m.attributes; Pp.push(...A.position.array); Nn.push(...A.normal.array); U.push(...A.uv.array); SI2.push(...A.skinIndex.array); SW2.push(...A.skinWeight.array); nv += A.position.count; }
    const N8 = new Int8Array(Nn.length); for (let k = 0; k < Nn.length; k++) N8[k] = Math.round(Nn[k] * 127);
    const U16 = new Uint16Array(U.length); for (let k = 0; k < U.length; k++) U16[k] = Math.round(Math.min(1, Math.max(0, U[k] - Math.floor(U[k] === 1 ? 0 : U[k]))) * 65535);
    head.parts.push({ name: pt.name, v: nv, i: idxAll.length, groups: gl, mats: pt.mats, pos: push(new Float32Array(Pp)), nor: push(N8), uv: push(U16), si: push(new Uint16Array(SI2)), sw: push(new Uint8Array(SW2)), idx: push(nv > 65535 ? new Uint32Array(idxAll) : new Uint16Array(idxAll)), big: nv > 65535 });
  }
  head.hide = push(new Uint16Array(hide)); head.nhide = hide.length; head.soft = push(new Uint16Array(hide.soft || [])); head.nsoft = (hide.soft || []).length;
  const body = Buffer.concat(chunks); let hj = JSON.stringify(head); while ((hj.length + 4) % 4) hj += ' '; const hl = Buffer.alloc(4); hl.writeUInt32LE(hj.length);
  fs.writeFileSync(file, Buffer.concat([hl, Buffer.from(hj), body]));
  return 4 + hj.length + body.length;
}
const LIST = JSON.parse(fs.readFileSync(new URL('./clothes.json', import.meta.url)));
for (const [id, file] of LIST) {
  if (process.argv[5] && !process.argv.slice(5).includes(id)) continue;
  // the racing suit has its boots built in
  SHOE = /shoes|outfit\.004/i.test(file); const t0 = Date.now(), parts = fit(file), hide = hideList(parts), bytes = pack(parts, hide, OUT + '/' + id + '.bin');
  console.log(id, parts.map(p => p.name + ':' + p.n).join(' '), 'hide', hide.length, 'bytes', bytes, (Date.now() - t0) + 'ms');
}
