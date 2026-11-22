#!/usr/bin/env node
/* The Clothing Studio's sandals: one pair of flip-flops (tools/ugc/flipflops/: FlipFlops.obj + one texture per colour),
   fitted to the Figure's real feet (make/clothing/body/feet.json) and written to make/clothing/ugc/ as catalog pieces
   (dept "sandals", one entry per colour, all sharing one geometry file). The catalog's own sandals are no longer used.

     node tools/ugc/flipflops.js        (export.js runs it too)

   How it fits: each flip-flop is in the model's own units (toes +z, sole top y 0.03). The sole is mapped onto the foot's
   footprint (a little bigger all round, then widened by angle wherever the foot sticks out) and thinned; the toe post
   is moved to the gap between the big toe and the next; the Y strap is laid over the top of the foot: every strap point
   moves by the same amount as its neighbours (so the band keeps its thickness) until the band's inside rests just on the
   skin. The model's right flip-flop is used for the right foot (x < 0), its left for the left foot. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), SRC = path.join(__dirname, 'flipflops'), OUT = path.join(ROOT, 'make/clothing/ugc');
const COLOURS = [['Pink', 'Pink'], ['White', 'White'], ['Black', 'Black'], ['Blue', 'Sky blue'], ['BlueDark', 'Navy'], ['Tirquoise', 'Turquoise'],
  ['Green', 'Green'], ['Yellow', 'Yellow'], ['Orange', 'Orange'], ['Purple', 'Purple']];

// ---- the Figure's left foot (x > 0): points, normals, footprint
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'make/clothing/body/feet.json')));
const f32 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const FP = f32(FJ.pos), FN = f32(FJ.nrm), foot = [];
for (let i = 0; i < FP.length; i += 3) if (FP[i] > 0) foot.push([FP[i], FP[i + 1], FP[i + 2], FN[i], FN[i + 1], FN[i + 2]]);
const fmn = [1e9, 1e9, 1e9], fmx = [-1e9, -1e9, -1e9]; for (const f of foot) for (let a = 0; a < 3; a++) { fmn[a] = Math.min(fmn[a], f[a]); fmx[a] = Math.max(fmx[a], f[a]); }
const fc = [(fmn[0] + fmx[0]) / 2, (fmn[2] + fmx[2]) / 2], NBIN = 90, ang = (x, z) => Math.floor(((Math.atan2(z - fc[1], x - fc[0]) / (2 * Math.PI)) % 1 + 1) % 1 * NBIN);
const smooth = R => { for (let pass = 0; pass < 3; pass++) { const Q = R.slice(); for (let i = 0; i < NBIN; i++) R[i] = Math.max(Q[i], (Q[(i + 1) % NBIN] + Q[(i + NBIN - 1) % NBIN]) / 2); } return R; };
const footR = new Float32Array(NBIN); for (const f of foot) if (f[1] < 0.12) { const b = ang(f[0], f[2]); footR[b] = Math.max(footR[b], Math.hypot(f[0] - fc[0], f[2] - fc[1])); } smooth(footR);
// the gap between the big toe and the next: the lowest point of the toes' front edge, a little inward of the second toe
const toeGap = (() => { const front = foot.filter(f => f[2] > fmx[2] - 0.28 && f[1] < 0.2), cols = new Map();
  for (const f of front) { const k = Math.round(f[0] * 40); cols.set(k, Math.max(cols.get(k) || -1e9, f[2])); }
  const ks = [...cols.keys()].sort((a, b) => a - b), xs = ks.map(k => k / 40), zs = ks.map(k => cols.get(k));
  // the big toe is the innermost (smallest x) bump: walk out from it to the first dip
  let i = 0; while (i < zs.length - 1 && zs[i + 1] >= zs[i] - 1e-4) i++;   // up to the big toe's tip
  let j = i; while (j < zs.length - 1 && zs[j + 1] <= zs[j] + 1e-4) j++;     // down into the gap
  return [xs[j], zs[j] - 0.09]; })();
const near = (q, n) => { const nb = []; for (const f of foot) { const d = (f[0] - q[0]) ** 2 + (f[1] - q[1]) ** 2 + (f[2] - q[2]) ** 2; if (nb.length < n || d < nb[nb.length - 1][0]) { nb.push([d, f]); nb.sort((a, b) => a[0] - b[0]); if (nb.length > n) nb.pop(); } } return nb; };
// signed height of q above the skin, and the skin's normal there (10 nearest points, weighted)
const skinAt = q => { const nb = near(q, 10); let ws = 0; const s = [0, 0, 0, 0, 0, 0]; for (const [d, f] of nb) { const w = 1 / (Math.sqrt(d) + 0.02); ws += w; for (let a = 0; a < 6; a++) s[a] += f[a] * w; }
  for (let a = 0; a < 6; a++) s[a] /= ws; const l = Math.hypot(s[3], s[4], s[5]) || 1; const n = [s[3] / l, s[4] / l, s[5] / l];
  const f0 = nb[0][1], lift = Math.max(0, (f0[0] - s[0]) * n[0] + (f0[1] - s[1]) * n[1] + (f0[2] - s[2]) * n[2]);
  const p = [s[0] + n[0] * lift, s[1] + n[1] * lift, s[2] + n[2] * lift]; return { h: (q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1] + (q[2] - p[2]) * n[2], n }; };

// ---- the model
const V = [], T = [], F = [];
for (const line of fs.readFileSync(path.join(SRC, 'FlipFlops.obj'), 'utf8').split('\n')) {
  const w = line.trim().split(/\s+/);
  if (w[0] === 'v') V.push([+w[1], +w[2], +w[3]]); else if (w[0] === 'vt') T.push([+w[1], +w[2]]);
  else if (w[0] === 'f') { const c = w.slice(1).map(s => s.split('/').map(n => +n - 1)); for (let k = 1; k < c.length - 1; k++) F.push([c[0], c[k], c[k + 1]]); }
}
const SOLE_TOP = 0.03, SOLE_BOT = Math.min(...V.map(v => v[1]));
const half = V.filter(v => v[0] > 0), mn = [0, 1, 2].map(a => Math.min(...half.map(v => v[a]))), mx = [0, 1, 2].map(a => Math.max(...half.map(v => v[a])));
// the toe post: the strap's front end (the highest points near the front, then straight down)
const postXZ = (() => { const P = half.filter(v => v[1] > 0.1 && v[1] < 0.35 && v[2] > 0.3); return [P.reduce((s, v) => s + v[0], 0) / P.length, P.reduce((s, v) => s + v[2], 0) / P.length]; })();
const M = 0.035, sx = (fmx[0] - fmn[0] + 2 * M) / (mx[0] - mn[0]), sz = (fmx[2] - fmn[2] + 2 * M) / (mx[2] - mn[2]), sy = (sx + sz) / 2;
const SOLE_T = 0.045;   // the sole's thickness on the Figure (the model's is thicker than suits her)
const toFoot = v => [fmn[0] - M + (v[0] - mn[0]) * sx, v[1] >= SOLE_TOP - 1e-4 ? 0.012 + (v[1] - SOLE_TOP) * sy : 0.012 - SOLE_T * (SOLE_TOP - v[1]) / (SOLE_TOP - SOLE_BOT), fmn[2] - M + (v[2] - mn[2]) * sz];
const post0 = toFoot([postXZ[0], 0.2, postXZ[1]]), postShift = [toeGap[0] - post0[0], toeGap[1] - post0[2]];

const P = V.map(v => toFoot([Math.abs(v[0]), v[1], v[2]]));
// the sole: widened by angle wherever the foot would stick out
const isSole = i => V[i][1] <= SOLE_TOP + 0.002;
const solR = new Float32Array(NBIN); P.forEach((p, i) => { if (isSole(i)) { const b = ang(p[0], p[2]); solR[b] = Math.max(solR[b], Math.hypot(p[0] - fc[0], p[2] - fc[1])); } }); smooth(solR);
P.forEach((p, i) => { if (!isSole(i)) return; const b = ang(p[0], p[2]), f = solR[b] > 0.05 ? Math.max(1, (footR[b] + 0.03) / solR[b]) : 1; p[0] = fc[0] + (p[0] - fc[0]) * f; p[2] = fc[1] + (p[2] - fc[1]) * f; });
// the toe post and the strap's front: slid to the toe gap, fading out over the strap's length
const pr = 0.06 * sx / 0.45; P.forEach((p, i) => { if (isSole(i)) return; const d = Math.hypot(p[0] - post0[0], p[2] - post0[2]), w = Math.max(0, 1 - d / 0.55); p[0] += postShift[0] * w; p[2] += postShift[1] * w; });
// the strap: each point moves with its neighbours so the band's inside rests on the skin (gap G); the post stays upright
const G = 0.008, strap = P.map((p, i) => i).filter(i => !isSole(i));
const info = new Map(strap.map(i => [i, skinAt(P[i])]));
const R = 0.035, disp = new Map();
for (const i of strap) { const p = P[i]; let lo = 1e9; for (const j of strap) { const q = P[j]; if (Math.abs(q[0] - p[0]) > R || Math.abs(q[1] - p[1]) > R || Math.abs(q[2] - p[2]) > R) continue; lo = Math.min(lo, info.get(j).h); }
  disp.set(i, G - lo); }
for (let pass = 0; pass < 3; pass++) { const D2 = new Map(); for (const i of strap) { const p = P[i]; let s = 0, n = 0; for (const j of strap) { const q = P[j]; if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 0.03) { s += disp.get(j); n++; } } D2.set(i, s / n); } for (const i of strap) disp.set(i, D2.get(i)); }
for (const i of strap) { const p = P[i], { n } = info.get(i), w = Math.min(1, Math.max(0, (p[1] - 0.012) / 0.06)), d = disp.get(i) * w;
  // near the post the band only rises or sinks (no sideways push into the toes)
  const dp = Math.hypot(p[0] - toeGap[0], p[2] - toeGap[1]), side = Math.min(1, dp / 0.08);
  p[0] += n[0] * d * side; p[1] += n[1] * d + (1 - side) * 0; p[2] += n[2] * d * side; }

// ---- unweld (one vertex per position + uv), both feet, normals from the faces
const pos = [], uv = [], idx = [], key = new Map();
const vert = (c, side) => { const k = c[0] + ':' + c[1]; if (key.has(k)) return key.get(k); const p = P[c[0]], t = T[c[1]] || [0, 0];
  pos.push(side * p[0], p[1], p[2]); uv.push(t[0], t[1]); const j = pos.length / 3 - 1; key.set(k, j); return j; };
for (const f of F) { const side = Math.sign(V[f[0][0]][0] + V[f[1][0]][0] + V[f[2][0]][0]) || 1; idx.push(vert(f[0], side), vert(f[1], side), vert(f[2], side)); }
const nrm = new Float32Array(pos.length);
for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(k => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  for (const k of [idx[t], idx[t + 1], idx[t + 2]]) for (let e = 0; e < 3; e++) nrm[k * 3 + e] += n[e]; }
for (let k = 0; k < nrm.length; k += 3) { const l = Math.hypot(nrm[k], nrm[k + 1], nrm[k + 2]) || 1; nrm[k] /= l; nrm[k + 1] /= l; nrm[k + 2] /= l; }

// ---- write: one geometry file, one texture per colour; the old sandals are dropped from the index
const b64 = (a, Ty) => Buffer.from(new Ty(a).buffer).toString('base64');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'f-flipflops.json'), JSON.stringify({ pos: b64(pos, Float32Array), nrm: b64(Array.from(nrm), Float32Array), uv: b64(uv, Float32Array), idx: b64(idx, Uint16Array), alpha: 'opaque' }));
const ixPath = path.join(OUT, 'index.json'), index = fs.existsSync(ixPath) ? JSON.parse(fs.readFileSync(ixPath)) : [];
for (const e of index.filter(e => e.dept === 'sandals' && !e.id.startsWith('f-'))) for (const f of [e.file, e.tex, e.thumb]) { try { fs.unlinkSync(path.join(OUT, f)); } catch (err) {} }
const keep = index.filter(e => e.dept !== 'sandals');
for (const [src, name] of COLOURS) { const id = 'f-flipflops-' + src.toLowerCase();
  fs.copyFileSync(path.join(SRC, 'flipFlops' + src + '_Text.png'), path.join(OUT, id + '.png'));
  keep.push({ id, dept: 'sandals', name: name + ' flip-flops', file: 'f-flipflops.json', tex: id + '.png', thumb: id + '-thumb.png', verts: pos.length / 3 }); }
fs.writeFileSync(ixPath, JSON.stringify(keep, null, 1));
// thumbnails: tools/ugc/thumb.html in headless Chrome (needs the repo served on :8791, like export.js)
(async () => { let chromium; try { ({ chromium } = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }))); } catch (e) { console.warn('no playwright: thumbnails not redrawn'); return; }
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader'] }), pg = await br.newPage();
  try { await pg.goto('http://127.0.0.1:8791/tools/ugc/thumb.html'); await pg.waitForFunction('window.render');
    const { execFileSync } = require('child_process');
    for (const e of keep.filter(e => e.id.startsWith('f-'))) { const url = await pg.evaluate(([f, t]) => render(f, t), [e.file, e.tex]), big = path.join(OUT, e.thumb);
      fs.writeFileSync(big, Buffer.from(url.split(',')[1], 'base64'));
      try { execFileSync('python3', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.resize((160,160),Image.LANCZOS).save(sys.argv[1])', big]); } catch (err) {} }
  } catch (e) { console.warn('thumbnails:', e.message); } await br.close(); })();
console.log(JSON.stringify({ verts: pos.length / 3, tris: idx.length / 3, toeGap, post0: post0.map(v => +v.toFixed(3)), scale: [sx, sz].map(v => +v.toFixed(3)), dispRange: [Math.min(...disp.values()), Math.max(...disp.values())].map(v => +v.toFixed(3)) }));
