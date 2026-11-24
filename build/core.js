/* generated from src/build/core.js by src/build/build.py: the Building Studio's building, used by the
   Grug Studio game (/arcade/grug-studio/) as window.GrugBuildCore. App.onChange runs after every change. */
window.GrugBuildCore = (() => {
const App = {}, LOOKS = { realistic: 1 };
'use strict';
/* =====================================================================
   Grug Building Studio
   Block out a chunky building, paint it in Gemini (Nano Banana) from a
   two-view reference sheet, line the picture back up and bake it onto
   the model as a retro texture atlas with a bevel normal map.
   ===================================================================== */

/* ---------- small math ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = vlen(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const D2R = Math.PI / 180;
function m4mul(a, b){ const o = new Float32Array(16); for (let c=0;c<4;c++) for (let r=0;r<4;r++){ let s=0; for (let k=0;k<4;k++) s += a[k*4+r]*b[c*4+k]; o[c*4+r]=s; } return o; }
function m4persp(fy, asp, n, f){ const o = new Float32Array(16), t = 1/Math.tan(fy/2); o[0]=t/asp; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; }
function m4look(eye, tgt, up){
  const f = norm(sub(tgt, eye)), s = norm(cross(f, up)), u = cross(s, f), o = new Float32Array(16);
  o[0]=s[0]; o[4]=s[1]; o[8]=s[2]; o[1]=u[0]; o[5]=u[1]; o[9]=u[2]; o[2]=-f[0]; o[6]=-f[1]; o[10]=-f[2];
  o[12]=-dot(s,eye); o[13]=-dot(u,eye); o[14]=dot(f,eye); o[15]=1; return o;
}
const m3of = m => new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]);
function rowsToM4(r0, r1, r2, r3){ const o = new Float32Array(16); [r0,r1,r2,r3].forEach((r,i) => { for (let c=0;c<4;c++) o[c*4+i] = r[c]; }); return o; }
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function hash2(x, y){ let h = (x*374761393 + y*668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ---------- the building ----------
   One chunky mass: walls (width × depth × height) on an optional foundation band, and one roof (flat, gable, hip
   or shed) with a height and a ridge direction, sitting flush on the walls (no overhang, so nothing hides a wall). Doors and windows are flat colour-coded guides drawn on
   the walls in the reference; Gemini paints the real thing there and it's baked into the wall texture.
   Front of the building = +z. The footprint is centred on the origin. */
const ROLES = {
  wall: { label:'Walls', col:[208,208,208], hint:'light grey', word:'walls' },
  roof: { label:'Roof',  col:[214,74,64],   hint:'red',        word:'the roof' },
  trim: { label:'Trim',  col:[238,192,52],  hint:'yellow',     word:'trim: the foundation, the roof edges and the fascia boards' },
};
const ROLE_KEYS = Object.keys(ROLES);
const MARKS = {
  door:   { label:'Door',   col:[52,92,214],  hint:'blue',  word:'doors' },
  window: { label:'Window', col:[80,210,232], hint:'cyan',  word:'windows' },
};
const MARK_KEYS = Object.keys(MARKS);
const ROOFS = { flat:'Flat', gable:'Gable', hip:'Hip', shed:'Shed' };
const DOORS = { none:'None', left:'Left', center:'Centre', right:'Right' };
const DEF = { w:8, d:6, h:4, base:0.5, roof:'gable', rh:3, ridge:'x', floors:1, door:'center', door2:false, backDoor:false, wf:2, ws:1, wb:2 };
const LIM = { w:[2,24,1], d:[2,24,1], h:[2,20,1], base:[0,2,0.5], rh:[0.5,10,0.5], floors:[1,5,1], wf:[0,10,1], ws:[0,10,1], wb:[0,10,1] };
const FASCIA = 0.5;
const AV = { h: 1.8, w: 1.8*4/5.2 };   // the scale figure: a blocky R6-style person, 1.8 m tall (5.2 studs → metres)

const S = { p: { ...DEF }, desc: '', look: 'realistic', geoVer: 1, marks: [] };
function fixParams(o){
  const p = { ...S.p };
  for (const k in o){ if (o[k] == null) continue;
    if (LIM[k]){ const [a, b, st] = LIM[k], v = +o[k]; if (isNaN(v)) throw new Error(`${k} must be a number`); p[k] = clamp(Math.round(v/st)*st, a, b); }
    else if (k === 'roof'){ if (!ROOFS[o[k]]) throw new Error('roof: ' + Object.keys(ROOFS).join(', ')); p.roof = o[k]; }
    else if (k === 'ridge'){ if (o[k] !== 'x' && o[k] !== 'z') throw new Error('ridge: "x" (runs left–right) or "z" (runs front–back)'); p.ridge = o[k]; }
    else if (k === 'door'){ if (!DOORS[o[k]]) throw new Error('door: ' + Object.keys(DOORS).join(', ')); p.door = o[k]; }
    else if (k === 'door2' || k === 'backDoor') p[k] = !!o[k] && o[k] !== 'false' && o[k] !== '0';
  }
  if (p.base >= p.h - 1) p.base = Math.max(0, p.h - 1.5);
  return p;
}

// Convex parts, each a list of { v:[verts], role } polygons, wound outward
function orient(polys){
  const all = polys.flatMap(q => q.v), C = mul(all.reduce((s,p) => add(s,p), [0,0,0]), 1/all.length), out = [];
  for (const q of polys){
    let P = q.v.filter((p,i) => vlen(sub(p, q.v[(i+1)%q.v.length])) > 1e-6); if (P.length < 3) continue;
    const n = newell(P); if (vlen(n) < 1e-8) continue;
    const pc = mul(P.reduce((s,p) => add(s,p), [0,0,0]), 1/P.length);
    if (dot(n, sub(pc, C)) < 0) P = P.slice().reverse();
    out.push({ v:P, role:q.role });
  }
  return out;
}
function newell(v){ const n = [0,0,0]; for (let i=0;i<v.length;i++){ const a = v[i], b = v[(i+1)%v.length]; n[0] += (a[1]-b[1])*(a[2]+b[2]); n[1] += (a[2]-b[2])*(a[0]+b[0]); n[2] += (a[0]-b[0])*(a[1]+b[1]); } return n; }
const roleBy = fn => P => P.map(v => ({ v, role: fn(norm(newell(v))) }));
function boxPolys(x0, x1, y0, y1, z0, z1){
  return [[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],
          [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]];
}
function prismX(pr, x0, x1){       // profile [[z,y]...] extruded along x
  const P = [pr.map(([z,y]) => [x0,y,z]), pr.map(([z,y]) => [x1,y,z])];
  for (let k=0;k<pr.length;k++){ const [z0,y0] = pr[k], [z1,y1] = pr[(k+1)%pr.length]; P.push([[x0,y0,z0],[x0,y1,z1],[x1,y1,z1],[x1,y0,z0]]); }
  return P;
}
const edgeRole = n => Math.abs(n[1]) < 0.05 ? 'trim' : 'roof';   // roof slabs: vertical strips are fascia / barge boards
function buildParts(p){
  const parts = [], { w, d, h, base, rh } = p, E = h;
  if (base > 0) parts.push(roleBy(() => 'trim')(boxPolys(-w/2, w/2, 0, base, -d/2, d/2)));
  parts.push(roleBy(() => 'wall')(boxPolys(-w/2, w/2, base, E, -d/2, d/2)));
  // roof parts are made with the ridge along x (width W, depth D), then swapped onto z if the ridge runs front–back
  const swap = p.ridge === 'z' && (p.roof === 'gable' || p.roof === 'shed'), W = swap ? d : w, D = swap ? w : d, o = 0, t = FASCIA;   // no overhang: nothing may hide a wall
  const R = [];
  if (p.roof === 'flat'){
    const th = clamp(rh, 0.5, 2);
    R.push(roleBy(n => n[1] > 0.5 || n[1] < -0.5 ? 'roof' : 'trim')(boxPolys(-W/2-o, W/2+o, E, E+th, -D/2-o, D/2+o)));
  } else if (p.roof === 'gable'){
    const k = rh/(D/2);
    R.push(roleBy(() => 'wall')(prismX([[-D/2,E],[D/2,E],[0,E+rh]], -W/2, W/2)));
    for (const s of [1, -1]){
      const pr = [[0,E+rh], [s*(D/2+o), E-o*k], [s*(D/2+o), E-o*k+t], [0,E+rh+t]];
      R.push(roleBy(edgeRole)(prismX(pr, -W/2-o, W/2+o)));
    }
  } else if (p.roof === 'shed'){
    const k = rh/D;
    R.push(roleBy(() => 'wall')(prismX([[-D/2,E],[D/2,E],[-D/2,E+rh]], -W/2, W/2)));
    R.push(roleBy(edgeRole)(prismX([[-D/2-o, E+rh+o*k], [D/2+o, E-o*k], [D/2+o, E-o*k+t], [-D/2-o, E+rh+o*k+t]], -W/2-o, W/2+o)));
  } else {   // hip: fascia band round the eaves, slopes on all four sides
    const k = rh/(Math.min(W,D)/2), e0 = E - o*k, e1 = e0 + t, Wx = W/2+o, Dz = D/2+o, top = E + rh + t;
    const B0 = [[-Wx,e0,-Dz],[Wx,e0,-Dz],[Wx,e0,Dz],[-Wx,e0,Dz]], B1 = B0.map(q => [q[0], e1, q[2]]);
    const r = Math.max(0, Wx - Dz), q = Math.max(0, Dz - Wx), r1 = [-r, top, -q], r2 = [r, top, q];
    const P = [B0, ...[0,1,2,3].map(i => [B0[i], B0[(i+1)%4], B1[(i+1)%4], B1[i]])];
    if (Wx >= Dz) P.push([B1[0],B1[1],r2,r1], [B1[3],B1[2],r2,r1], [B1[0],B1[3],r1], [B1[1],B1[2],r2]);
    else P.push([B1[0],B1[3],r2,r1], [B1[1],B1[2],r2,r1], [B1[0],B1[1],r1], [B1[3],B1[2],r2]);
    R.push(roleBy(n => Math.abs(n[1]) < 0.05 ? 'trim' : 'roof')(P));
  }
  R.forEach(part => parts.push(swap ? part.map(q => ({ v: q.v.map(([x,y,z]) => [z,y,x]), role:q.role })) : part));
  return parts.map(orient);
}

// Doors and windows, laid out evenly per floor on each wall
function buildMarks(p){
  const M = [], fh = (p.h - p.base)/p.floors, winH = fh >= 3 ? 1.5 : 1, winW = 1;
  // doors are sized from the scale figure: a little wider and taller than it, so it clearly fits through
  const doorW = p.door2 ? AV.w*1.75 : AV.w*1.16, doorH = Math.min(AV.h*1.17, fh - 0.4), canDoor = doorH >= AV.h*1.08;
  const walls = [ { axis:'+z', L:p.w, n:p.wf, door: p.door }, { axis:'-z', L:p.w, n:p.wb, door: p.backDoor ? 'center' : 'none' },
                  { axis:'+x', L:p.d, n:p.ws, door:'none' }, { axis:'-x', L:p.d, n:p.ws, door:'none' } ];
  const at = (axis, u, y) => { const n = AXES[axis], r = norm(cross([0,1,0], n)), c = axis[1] === 'z' ? p.d/2 : p.w/2; return add(add(mul(n, c), mul(r, u)), [0, y, 0]); };
  for (const W of walls){
    const dx = { none:null, left:-W.L/4, center:0, right:W.L/4 }[W.door];
    if (dx != null && canDoor) M.push({ kind:'door', axis:W.axis, at: at(W.axis, dx, p.base + doorH/2), size:[doorW, doorH] });
    const n = Math.min(W.n, Math.floor((W.L - 0.5)/(winW + 0.6)));
    for (let f=0; f<p.floors; f++) for (let i=0;i<n;i++){
      const u = W.L*(i+.5)/n - W.L/2;
      if (f === 0 && dx != null && canDoor && Math.abs(u - dx) < doorW/2 + winW/2 + 0.3) continue;
      M.push({ kind:'window', axis:W.axis, at: at(W.axis, u, p.base + f*fh + fh*0.5), size:[winW, winH] });
    }
  }
  return M;
}
const AXES = { '+x':[1,0,0], '-x':[-1,0,0], '+z':[0,0,1], '-z':[0,0,-1] };
function markQuads(m){
  const n = AXES[m.axis], u = norm(cross([0,1,0], n)), [w, h] = m.size;
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,b]) => add(add(add(m.at, mul(u, a)), [0, b, 0]), mul(n, 0.02)));
}

const INFL = 0.0003;   // later parts are a hair bigger, so touching faces never flicker
function partFaces(part, k){
  const all = part.flatMap(q => q.v); let lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
  all.forEach(v => { for (let a=0;a<3;a++){ lo[a] = Math.min(lo[a], v[a]); hi[a] = Math.max(hi[a], v[a]); } });
  const c = mul(add(lo, hi), .5), e = INFL*(k+1), g = [0,1,2].map(a => 1 + e/Math.max(1e-3, (hi[a]-lo[a])/2));
  return part.map(q => { const verts = q.v.map(v => [c[0] + (v[0]-c[0])*g[0], c[1] + (v[1]-c[1])*g[1], c[2] + (v[2]-c[2])*g[2]]), n = norm(newell(verts));
    return { verts, n, d: dot(n, verts[0]), piece: k, pid: k, role: q.role }; });
}

// World cache: every face, plus which faces are buried inside other parts
let W_ = null;
function world(){
  if (W_ && W_.ver === S.geoVer) return W_;
  const faces = [], byPiece = [];
  buildParts(S.p).forEach((part, k) => { const F = partFaces(part, k); byPiece.push(F); F.forEach(f => { f.id = faces.length; faces.push(f); }); });
  let lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
  faces.forEach(f => f.verts.forEach(v => { for (let a=0;a<3;a++){ lo[a] = Math.min(lo[a], v[a]); hi[a] = Math.max(hi[a], v[a]); } }));
  faces.forEach(f => { f.buried = buried(f, byPiece); setupFaceFrame(f); });
  S.marks = buildMarks(S.p);
  W_ = { ver: S.geoVer, faces, byPiece, lo, hi };
  return W_;
}
function insidePiece(p, F, eps = 1e-4){ for (const f of F) if (dot(f.n, p) - f.d > -eps) return false; return true; }
function insideAny(p, byPiece, skip){ for (let k=0;k<byPiece.length;k++) if (k !== skip && insidePiece(p, byPiece[k])) return true; return false; }
function buried(f, byPiece){
  const c = mul(f.verts.reduce((s,p) => add(s,p), [0,0,0]), 1/f.verts.length);
  const pts = [c].concat(f.verts.map(v => add(c, mul(sub(v, c), 0.85))));
  return pts.every(p => insideAny(add(p, mul(f.n, 0.01)), byPiece, f.piece));
}
// Face frame: u = right along the surface, v = down along it (image rows), origin at the top-left
function setupFaceFrame(f){
  const n = f.n;
  let u = Math.abs(n[1]) > 0.98 ? [1,0,0] : norm(cross([0,1,0], n));
  const v = cross(u, n);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  f.verts.forEach(p => { const a = dot(p,u), b = dot(p,v); u0 = Math.min(u0,a); u1 = Math.max(u1,a); v0 = Math.min(v0,b); v1 = Math.max(v1,b); });
  f.u = u; f.v = v; f.uw = u1 - u0; f.vh = v1 - v0;
  f.o = add(add(mul(n, f.d), mul(u, u0)), mul(v, v0));
  f.p2 = f.verts.map(p => [dot(p,u) - u0, dot(p,v) - v0]);
  f.area = 0; for (let i=0;i<f.p2.length;i++){ const a = f.p2[i], b = f.p2[(i+1)%f.p2.length]; f.area += a[0]*b[1] - b[0]*a[1]; }
  f.cw = f.area < 0;   // winding in (u,v) space; (u,v) is left-handed against n so the sign flips
  f.area = Math.abs(f.area)/2;
}
function in2(f, a, b, m = 0){
  const P = f.p2, s = f.cw ? -1 : 1;
  for (let i=0;i<P.length;i++){ const p = P[i], q = P[(i+1)%P.length], ex = q[0]-p[0], ey = q[1]-p[1], L = Math.hypot(ex,ey);
    if (s*(ex*(b-p[1]) - ey*(a-p[0]))/L < m) return false; }
  return true;
}
const faceUV = (f, p) => [dot(p, f.u) - dot(f.o, f.u), dot(p, f.v) - dot(f.o, f.v)];
const facePt = (f, a, b) => add(add(f.o, mul(f.u, a)), mul(f.v, b));
const meshFaces = () => world().faces.filter(f => !f.buried);

/* ---------- changes ---------- */
let saveT = 0;
function changed(){
  S.geoVer++; App.dirty = true; App.meshDirty = true;
  clearTimeout(saveT); saveT = setTimeout(save, 400);
  if (App.onChange) App.onChange();
}
function save(){ try { localStorage.setItem('grug.build.v2', JSON.stringify(sceneJSON())); } catch (e) {} }
function sceneJSON(){ return { ...S.p, desc:S.desc, look:S.look }; }
function setParams(o){ S.p = fixParams(o); if (o.desc != null) S.desc = String(o.desc); if (o.look && LOOKS[o.look]) S.look = o.look; changed(); }
const bname = () => { const w = S.desc.replace(/[^\w\s'-]/g, ' ').trim().split(/\s+/).filter(x => !/^(a|an|the)$/i.test(x)).slice(0, 3).join(' '); return w ? w.replace(/\b\w/g, c => c.toUpperCase()) : 'Building'; };

/* ---------- starters ---------- */
const PRESETS = {
  cottage: { label:'Cottage', p:{ w:8, d:6, h:4, base:0.5, roof:'gable', rh:3, ridge:'x', floors:1, door:'center', door2:false, backDoor:false, wf:2, ws:1, wb:2 },
    desc:'A cosy storybook cottage: cream lime plaster walls with dark oak timber framing, a thick mossy thatched roof, a rough grey fieldstone foundation, a round-topped wooden door and small leaded windows with flower boxes.' },
  shop: { label:'Corner shop', p:{ w:8, d:7, h:7, base:0.5, roof:'flat', rh:1, ridge:'x', floors:2, door:'left', door2:true, backDoor:true, wf:2, ws:2, wb:2 },
    desc:'A cheerful two-storey corner bakery: warm red brick walls, a big shop window with a painted sign and a striped awning painted above it, cream stone cornice and base, tall sash windows upstairs.' },
  tower: { label:'Tower', p:{ w:5, d:5, h:10, base:1, roof:'hip', rh:4, ridge:'x', floors:3, door:'center', door2:false, backDoor:false, wf:1, ws:1, wb:1 },
    desc:"A wizard's stone watchtower: pale sandstone blocks, a blue glazed-tile pyramid roof, dark weathered stone trim, an arched oak door and narrow arched windows." },
  barn: { label:'Barn', p:{ w:7, d:10, h:5, base:0.5, roof:'gable', rh:4, ridge:'z', floors:1, door:'center', door2:true, backDoor:true, wf:0, ws:3, wb:0 },
    desc:'A big red farm barn: red vertical wooden planks with white trim, a weathered grey shingle roof, big white X-braced barn doors and small square loft windows.' },
  tavern: { label:'Tavern', p:{ w:11, d:7, h:6, base:1, roof:'hip', rh:3, ridge:'x', floors:2, door:'center', door2:true, backDoor:false, wf:4, ws:2, wb:3 },
    desc:'A big old timber-framed tavern: whitewashed plaster with dark timber beams, weathered terracotta roof tiles, a grey stone foundation, a heavy double door with a hanging sign painted beside it, and small diamond-paned windows.' },
};

return { App, S, LIM, PRESETS, ROOFS, DOORS, ROLES, MARKS, AV, fixParams, setParams, world, meshFaces, markQuads, save };
})();
