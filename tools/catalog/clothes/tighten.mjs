/* Pulls a fitted garment's waist back onto her (the fitter left the tops of trousers, shorts and skirts, and some hems,
   standing out from her waist like a flared collar). Works on the fitted .bin files in assets/clothes/ directly:
   node tools/catalog/clothes/tighten.mjs <sandy.json> assets/clothes [ids…] [--check]   (sandy.json: dump-body.js; see the README)
   Her waist and hips (y 84 to 128 cm, bind pose) are measured as an outline round her centre line at every height, from her
   skin's triangles. Each garment's inner layer there (the least distance out from her, over a small neighbourhood, so a
   waistband's thickness and a pocket's layers are kept) may be no more than TARGET cm out; anything more is taken off every
   layer at that spot alike, smoothed, and faded out below her hips (where her legs part) and above her ribs. Nothing else
   about the garment changes: its triangles, texture, skin weights and the skin it hides are as they were. */
import fs from 'fs';
const [SANDY, DIR, ...rest] = process.argv.slice(2), CHECK = rest.includes('--check'), IDS = rest.filter(x => !x.startsWith('--'));
const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const S = JSON.parse(fs.readFileSync(SANDY, 'utf8').split('\n')[0]);
const P = b64(S.pos, Float32Array), SI = b64(S.si, Float32Array), SW = b64(S.sw, Float32Array), IDX = b64(S.idx, Uint32Array);
const armBone = S.bones.map(n => /^(arm_|finger|thumb|hand)/i.test(n));
const isArm = i => { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (SW[i * 4 + k] > bw) { bw = SW[i * 4 + k]; bi = SI[i * 4 + k]; } return armBone[bi]; };
const Y0 = 80, Y1 = 132, DY = 0.75, NY = Math.round((Y1 - Y0) / DY) + 1, NT = 120, TAU = Math.PI * 2;
// her skin, sampled every ~0.5 cm over her triangles
const samp = []; for (let t = 0; t < IDX.length; t += 3) {
  const a = IDX[t], b = IDX[t + 1], c = IDX[t + 2]; if (isArm(a) || isArm(b) || isArm(c)) continue;
  const A = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], B = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], C = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]];
  if (Math.max(A[1], B[1], C[1]) < Y0 - 2 || Math.min(A[1], B[1], C[1]) > Y1 + 2) continue;
  const L = Math.max(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]), Math.hypot(B[0] - C[0], B[1] - C[1], B[2] - C[2]), Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2])), m = Math.max(1, Math.ceil(L / 0.5));
  for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) { const u = i / m, v = j / m, w = 1 - u - v; samp.push([A[0] * w + B[0] * u + C[0] * v, A[1] * w + B[1] * u + C[1] * v, A[2] * w + B[2] * u + C[2] * v]); }
}
const keep = samp.filter(p => p[1] >= Y0 - 1 && p[1] <= Y1 + 1 && Math.abs(p[0]) < 28);
// her centre line (front to back middle at each height), then her outline round it
const zc = new Float32Array(NY); { const lo = new Float32Array(NY).fill(1e9), hi = new Float32Array(NY).fill(-1e9); for (const p of keep) { if (Math.abs(p[0]) > 4) continue; const k = Math.round((p[1] - Y0) / DY); if (k < 0 || k >= NY) continue; lo[k] = Math.min(lo[k], p[2]); hi[k] = Math.max(hi[k], p[2]); } for (let k = 0; k < NY; k++) zc[k] = lo[k] < 1e8 ? (lo[k] + hi[k]) / 2 : NaN; for (let k = 0; k < NY; k++) if (isNaN(zc[k])) { let d = 1; while (isNaN(zc[k])) { if (k - d >= 0 && !isNaN(zc[k - d])) zc[k] = zc[k - d]; else if (k + d < NY && !isNaN(zc[k + d])) zc[k] = zc[k + d]; d++; } } }
const zAt = y => { const f = Math.max(0, Math.min(NY - 1, (y - Y0) / DY)), i = Math.floor(f), j = Math.min(NY - 1, i + 1); return zc[i] + (zc[j] - zc[i]) * (f - i); };
const polar = (x, y, z) => { const dz = z - zAt(y); return [Math.atan2(x, dz), Math.hypot(x, dz)]; };
const cell = (y, th) => [Math.round((y - Y0) / DY), ((Math.round((th + Math.PI) / TAU * NT) % NT) + NT) % NT];
const RS = new Float32Array(NY * NT).fill(-1);
for (const p of keep) { const [th, r] = polar(p[0], p[1], p[2]), [iy, it] = cell(p[1], th); if (iy < 0 || iy >= NY) continue; const k = iy * NT + it; if (r > RS[k]) RS[k] = r; }
for (let pass = 0; pass < 40; pass++) { let left = 0; const C = RS.slice(); for (let iy = 0; iy < NY; iy++) for (let it = 0; it < NT; it++) { const k = iy * NT + it; if (C[k] >= 0) continue; let s = 0, c = 0; for (const [a, b] of [[iy, it - 1], [iy, it + 1], [iy - 1, it], [iy + 1, it]]) { if (a < 0 || a >= NY) continue; const v = C[a * NT + ((b + NT) % NT)]; if (v >= 0) { s += v; c++; } } if (c) RS[k] = s / c; else left++; } if (!left) break; }
const rsAt = (y, th) => { const fy = Math.max(0, Math.min(NY - 1, (y - Y0) / DY)), ft = ((th + Math.PI) / TAU * NT % NT + NT) % NT, y0 = Math.floor(fy), y1 = Math.min(NY - 1, y0 + 1), t0 = Math.floor(ft) % NT, t1 = (t0 + 1) % NT, a = fy - y0, b = ft - Math.floor(ft), g = (i, j) => RS[i * NT + j]; return (g(y0, t0) * (1 - b) + g(y0, t1) * b) * (1 - a) + (g(y1, t0) * (1 - b) + g(y1, t1) * b) * a; };
// how far a garment's inner layer may stand out from her (cm), per garment
const LEGS = ['pants', 'shorts', 'skirt', 'skinny', 'longshorts', 'loosepants'], TOPS = ['tee', 'sweatshirt', 'shirt', 'vest', 'openshirt', 'longsleeve', 'hoodie', 'tie', 'jacket', 'cropjacket', 'cropjacket2', 'blazer'], OUTFITS = ['overalls', 'outfit2', 'outfit3', 'racer'];
const TARGET = id => LEGS.includes(id) ? 0.5 : OUTFITS.includes(id) ? 0.7 : /jacket|blazer|openshirt/.test(id) ? 3 : /hoodie|sweatshirt/.test(id) ? 2.4 : 1.6;
// trousers and outfits only: past this far out (belts, loops, a lip at the top), what's left is pressed in (a quarter of it
// stays), so nothing at the waist stands off her; layers keep their order. Tops hang from her chest, so they're left be.
const CAP = id => LEGS.includes(id) ? 1.6 : OUTFITS.includes(id) ? 1.9 : 0;
// an outfit in two pieces (the racing suit): the one that reaches higher is worn over the other at the waist
const OVER = 0.8;
// where it applies: from just below where her legs part (fading in) to her ribs (fading out)
const fade = y => Math.max(0, Math.min(1, (y - 87) / 6)) * Math.max(0, Math.min(1, (126 - y) / 5));
function run(id) {
  const file = DIR + '/' + id + '.bin', buf = fs.readFileSync(file), hl = buf.readUInt32LE(0), head = JSON.parse(buf.slice(4, 4 + hl).toString()), B = 4 + hl, T = TARGET(id);
  const pos = head.parts.map(p => new Float32Array(buf.buffer, buf.byteOffset + B + p.pos, p.v * 3));
  // a sleeve (weighted to her arm) is left alone: only what's round her body is measured and moved
  const arm = head.parts.map(p => { const si = new Uint16Array(buf.buffer.slice(buf.byteOffset + B + p.si, buf.byteOffset + B + p.si + p.v * 8)), sw = new Uint8Array(buf.buffer.slice(buf.byteOffset + B + p.sw, buf.byteOffset + B + p.sw + p.v * 4)), out = new Uint8Array(p.v); for (let i = 0; i < p.v; i++) { let w = 0; for (let k = 0; k < 4; k++) if (armBone[si[i * 4 + k]]) w += sw[i * 4 + k]; out[i] = w > 64 ? 1 : 0; } return out; });
  const stat = { before: [], after: [] }; let moved = 0, most = 0;
  const tops = head.parts.map((p, pi) => { let m = -1e9; const A = pos[pi]; for (let i = 1; i < A.length; i += 3) m = Math.max(m, A[i]); return m; }), hi = Math.max(...tops);
  pos.forEach((A0, pj) => {
  const T2 = T + (head.parts.length > 1 && tops[pj] === hi ? OVER : 0), C2 = CAP(id) ? CAP(id) + (T2 - T) : 0;
  // each vertex's excess over the target, then the inner layer's excess round each spot of the outline grid
  const EX = new Float32Array(NY * NT).fill(1e9);
  const verts = []; [A0].forEach((A, q) => { const pi = pj; for (let i = 0; i < A.length / 3; i++) { if (arm[pi][i]) continue; const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2]; if (y < Y0 || y > Y1 || Math.abs(x) > 28 || !fade(y)) continue; const [th, r] = polar(x, y, z), e = r - rsAt(y, th) - T2, [iy, it] = cell(y, th); verts.push([pi, i, th, r, y]); if (iy >= 0 && iy < NY && e < EX[iy * NT + it]) EX[iy * NT + it] = e; } });
  // the least over a neighbourhood (one step up and down, 6 degrees round): the inner layer
  const W = new Float32Array(NY * NT).fill(1e9), RY = 1, RT = Math.round(NT * 6 / 360);
  for (let iy = 0; iy < NY; iy++) for (let it = 0; it < NT; it++) { let m = 1e9; for (let a = Math.max(0, iy - RY); a <= Math.min(NY - 1, iy + RY); a++) for (let b = it - RT; b <= it + RT; b++) { const v = EX[a * NT + ((b + NT) % NT)]; if (v < m) m = v; } W[iy * NT + it] = m >= 1e8 ? 0 : Math.max(0, m); }
  // smoothed so the change is gentle
  let D = W; for (let pass = 0; pass < 6; pass++) { const C = D.slice(); for (let iy = 0; iy < NY; iy++) for (let it = 0; it < NT; it++) { let s = 0, c = 0; for (let a = iy - 1; a <= iy + 1; a++) for (let b = it - 1; b <= it + 1; b++) { if (a < 0 || a >= NY) continue; s += C[a * NT + ((b + NT) % NT)]; c++; } D[iy * NT + it] = s / c; } }
  const dAt = (y, th) => { const fy = Math.max(0, Math.min(NY - 1, (y - Y0) / DY)), ft = ((th + Math.PI) / TAU * NT % NT + NT) % NT, y0 = Math.floor(fy), y1 = Math.min(NY - 1, y0 + 1), t0 = Math.floor(ft) % NT, t1 = (t0 + 1) % NT, a = fy - y0, b = ft - Math.floor(ft), g = (i, j) => D[i * NT + j]; return (g(y0, t0) * (1 - b) + g(y0, t1) * b) * (1 - a) + (g(y1, t0) * (1 - b) + g(y1, t1) * b) * a; };
  for (const [pi, i, th, r, y] of verts) {
    const A = pos[pi], rs = rsAt(y, th), f = fade(y); let d = Math.min(dAt(y, th) * f, r - rs - 0.25); stat.before.push(r - rs);
    if (C2) { const r1 = r - Math.max(0, d), over = r1 - rs - C2; if (over > 0) d = Math.max(0, d) + over * 0.75 * f; }
    if (d > 0.02) { const k = (r - d) / r, z0 = zAt(y); A[i * 3] *= k; A[i * 3 + 2] = z0 + (A[i * 3 + 2] - z0) * k; moved++; most = Math.max(most, d); }
    stat.after.push(r - Math.max(0, d) - rs);
  }
  });
  const q = a => { a.sort((x, y) => x - y); return a.length ? `median ${a[a.length >> 1].toFixed(2)} · 90% ${a[Math.floor(a.length * 0.9)].toFixed(2)} · max ${a[a.length - 1].toFixed(2)}` : '-'; };
  console.log(id.padEnd(12), 'target', T, 'cap', CAP(id), '| out from her before:', q(stat.before), '| after:', q(stat.after), '| moved', moved, 'most', most.toFixed(2), 'cm');
  if (!CHECK) fs.writeFileSync(file, buf);
}
for (const id of IDS.length ? IDS : LEGS.concat(TOPS, OUTFITS)) run(id);
