/* =====================================================================
   Reference sheet: the same grey-box building twice, orthographic, 45° yaw, tilted down.
   Left: BACK view (back wall + left side). Right: FRONT view (front wall + right side).
   ===================================================================== */
const RW = 1536, RH = 1024, TOP = 64, PADX = 56, PADB = 44, SSR = 2;
const PITCH = 25 * D2R;
function viewRot(yaw, pitch){
  const c = Math.cos(-yaw), s = Math.sin(-yaw), ry = [[c,0,s],[0,1,0],[-s,0,c]];
  const cp = Math.cos(pitch), sp = Math.sin(pitch), rx = [[1,0,0],[0,cp,-sp],[0,sp,cp]];
  return rx.map(r => [0,1,2].map(k => r[0]*ry[0][k] + r[1]*ry[1][k] + r[2]*ry[2][k]));
}
const rv = (R, p) => [dot(R[0],p), dot(R[1],p), dot(R[2],p)];
const VIEWS = [
  { i:0, key:'back',  label:'BACK VIEW',  yaw:225*D2R },
  { i:1, key:'front', label:'FRONT VIEW', yaw:45*D2R },
];
VIEWS.forEach(V => { V.R = viewRot(V.yaw, PITCH); V.cam = V.R[2]; V.R3 = new Float32Array([V.R[0][0],V.R[1][0],V.R[2][0], V.R[0][1],V.R[1][1],V.R[2][1], V.R[0][2],V.R[1][2],V.R[2][2]]); });
// Shading the reference used on a wall seen square-ish: the bake divides each face's shading back out to this level
const SNORM = (shadeOf(rv(VIEWS[1].R, [0,0,1])) + shadeOf(rv(VIEWS[1].R, [1,0,0]))) / 2;

const REF = { s: 1, geo: -1, mk: -1 };
function frameViews(){
  const F = meshFaces(); let s = 1e9;
  VIEWS.forEach(V => {
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
    F.forEach(f => f.verts.forEach(p => { const v = rv(V.R, p); x0=Math.min(x0,v[0]); x1=Math.max(x1,v[0]); y0=Math.min(y0,v[1]); y1=Math.max(y1,v[1]); z0=Math.min(z0,v[2]); z1=Math.max(z1,v[2]); }));
    if (!F.length){ x0=y0=z0=-1; x1=y1=z1=1; }
    V.c = [(x0+x1)/2, (y0+y1)/2]; V.zc = (z0+z1)/2; V.zr = (z1-z0)/2 + 2;
    s = Math.min(s, (RW/2 - 2*PADX)/Math.max(1e-3, x1-x0), (RH - TOP - PADB)/Math.max(1e-3, y1-y0));
    V.cx = RW/4 + V.i*RW/2; V.cy = TOP + (RH - TOP - PADB)/2;
  });
  REF.s = s;
  VIEWS.forEach(V => {
    const a = 2*s/RW, b = 2*s/RH;
    V.M = rowsToM4([a*V.R[0][0], a*V.R[0][1], a*V.R[0][2], (2/RW)*(V.cx - s*V.c[0]) - 1],
                   [b*V.R[1][0], b*V.R[1][1], b*V.R[1][2], 1 - (2/RH)*(V.cy + s*V.c[1])],
                   [-V.R[2][0]/V.zr, -V.R[2][1]/V.zr, -V.R[2][2]/V.zr, V.zc/V.zr], [0,0,0,1]);
  });
}
const proj = (V, p) => { const v = rv(V.R, p); return [V.cx + REF.s*(v[0]-V.c[0]), V.cy - REF.s*(v[1]-V.c[1])]; };

function refGL(){
  if (REF.r) return REF.r;
  REF.c = cnv(RW*SSR, RH*SSR);
  REF.r = new GLR(REF.c, { aa:false, preserve:true });
  return REF.r;
}
function buildReference(force){
  if (!force && REF.geo === S.geoVer && REF.white) return REF;
  const r = refGL(), gl = r.gl, F = meshFaces();
  frameViews();
  // colour mesh: role tints
  const g = G(), gid = G();
  world(); S.marks.forEach(m => pushPoly(g, markQuads(m), AXES[m.axis], c01(MARKS[m.kind].col)));
  F.forEach(f => { pushPoly(g, f.verts, f.n, c01(ROLES[f.role].col));
    const id = f.id + 1; pushPoly(gid, f.verts, f.n, [(id & 255)/255, ((id >> 8) & 255)/255, ((id >> 16) & 255)/255]); });
  const mc = r.mesh(g), mi = r.mesh(gid);
  gl.viewport(0, 0, RW*SSR, RH*SSR);
  // 1. face ids (which face owns every pixel): occlusion for the bake
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LESS);
  VIEWS.forEach(V => r.draw(mi, { M:V.M, mode:1 }));
  const w = RW*SSR, h = RH*SSR, buf = new Uint8Array(w*h*4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const ids = new Int32Array(w*h);
  for (let y=0;y<h;y++){ const src = (h-1-y)*w*4, dst = y*w; for (let x=0;x<w;x++){ const o = src + x*4; ids[dst+x] = buf[o] | (buf[o+1] << 8) | (buf[o+2] << 16); } }
  REF.ids = ids;
  // 2. the picture
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LEQUAL);
  VIEWS.forEach(V => r.draw(mc, { M:V.M, R:V.R3, mode:0 }));
  r.free(mc); r.free(mi);
  const clear = cnv(RW, RH), cx = clear.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(REF.c, 0, 0, RW, RH);
  REF.clear = clear;
  const white = cnv(RW, RH), wx = white.getContext('2d'); wx.fillStyle = '#000'; wx.fillRect(0,0,RW,RH); wx.drawImage(clear, 0, 0);   // black: any edge pixel that slips through reads as a shadow, not a white seam
  wx.textAlign = 'center'; wx.textBaseline = 'middle'; wx.fillStyle = '#bbb'; wx.font = '700 24px system-ui, Arial, sans-serif';
  VIEWS.forEach(V => wx.fillText(V.label, V.cx, 34));
  REF.white = white;
  REF.alpha = cx.getImageData(0, 0, RW, RH).data;
  // outline overlay for lining up: every place the owning face changes
  const ec = cnv(RW, RH), ex = ec.getContext('2d'), ed = ex.createImageData(RW, RH), o = ed.data, at = (x, y) => ids[(y*SSR)*w + x*SSR];
  for (let y=0;y<RH-1;y++) for (let x=0;x<RW-1;x++){ const a = at(x,y); if (a !== at(x+1,y) || a !== at(x,y+1)){ const i = (y*RW+x)*4; o[i]=70; o[i+1]=110; o[i+2]=235; o[i+3]=255; } }
  ex.putImageData(ed, 0, 0); REF.edges = ec;
  REF.masks = [refMask(220), refMask(620)];
  let bx0=RW,bx1=0,by0=RH,by1=0; for (let y=0;y<RH;y++) for (let x=0;x<RW;x++) if (REF.alpha[(y*RW+x)*4+3] > 128){ bx0=Math.min(bx0,x); bx1=Math.max(bx1,x+1); by0=Math.min(by0,y); by1=Math.max(by1,y+1); }
  REF.box = { x0:bx0, x1:bx1, y0:by0, y1:by1 };
  REF.geo = S.geoVer;
  computeCoverage();
  return REF;
}
function refMask(rw){
  const rh = Math.round(rw*RH/RW), m = new Uint8Array(rw*rh), n = [0,0];
  for (let y=0;y<rh;y++) for (let x=0;x<rw;x++){ const X = Math.min(RW-1, ((x+.5)*RW/rw)|0), Y = Math.min(RH-1, ((y+.5)*RH/rh)|0);
    if (REF.alpha[(Y*RW+X)*4+3] > 128){ m[y*rw+x] = 1; n[x < rw/2 ? 0 : 1]++; } }
  return { m, rw, rh, n };
}
const idAt2 = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= RW*SSR || y >= RH*SSR) return 0; return REF.ids[y*RW*SSR + x]; };
const NB8 = [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
// 0: hidden · 1: only at an edge (anti-aliased, don't trust) · 2: clearly visible
function visible(f, V, p){
  const [X, Y] = proj(V, p), x = X*SSR, y = Y*SSR, id = f.id + 1;
  if (idAt2(x, y) !== id) return 0;
  const e = 1.6*SSR; for (const [a,b] of NB8) if (idAt2(x + a*e, y + b*e) !== id) return 1;
  // near the silhouette, keep further in: Gemini's edges wander a few pixels, and the inpaint bleeds the face's colour out to cover them
  const eb = 4.5*SSR; for (const [a,b] of NB8) if (idAt2(x + a*eb, y + b*eb) === 0) return 1;
  return 2;
}
const facing = (f, V) => dot(f.n, V.cam);

// How much of every surface the two cameras actually see (red in the editor when it's mostly hidden)
function computeCoverage(){
  const W = world(), td = 4;
  let hidden = 0;
  W.faces.forEach(f => {
    f.cov = 1; if (f.buried || f.n[1] < -0.3) { f.cov = -1; return; }
    const iw = Math.max(2, Math.ceil(f.uw*td)), ih = Math.max(2, Math.ceil(f.vh*td)); let tot = 0, ok = 0;
    for (let j=0;j<ih;j++) for (let i=0;i<iw;i++){
      const a = (i+.5)*f.uw/iw, b = (j+.5)*f.vh/ih; if (!in2(f, a, b, 0.02)) continue;
      const p = facePt(f, a, b); if (insideAny(add(p, mul(f.n, 0.02)), W.byPiece, f.piece)) continue;
      tot++; if (VIEWS.some(V => facing(f, V) > 0.08 && visible(f, V, p) === 2)) ok++;
    }
    f.cov = tot ? ok/tot : -1;
    if (f.cov >= 0 && f.cov < 0.3 && f.area > 0.5) hidden++;
  });
  REF.hidden = hidden;
}

/* ---------- the Gemini prompt ---------- */
const LOOKS = {
  realistic: { label:'Realistic', say:'Use realistic, photo-like materials (real brick, stone, plaster, wood grain, roof tiles, weathering and dirt), like a high-quality game texture.' },
  painted:   { label:'Hand-painted', say:'Use a hand-painted, stylised fantasy-game look: rich colours, visible painted brush texture and clear, readable shapes.' },
  cartoon:   { label:'Cartoon', say:'Use a bright, clean cartoon look with simple colours, soft gradients and bold, readable details.' },
};
function buildPrompt(){
  const desc = S.desc.trim() || 'A charming small building that fits a cosy fantasy village.';
  world();
  const roles = ROLE_KEYS.filter(k => meshFaces().some(f => f.role === k && f.n[1] > -0.5));
  const kinds = MARK_KEYS.filter(k => S.marks.some(m => m.kind === k));
  const L = [];
  L.push('Texture this blocky 3D building model.');
  L.push('');
  L.push(`What it is: ${desc}`);
  L.push('');
  L.push(`The picture shows the same colour-coded building twice, from two camera angles, with the camera tilted down so the roof is visible. The LEFT one is the BACK view: its left wall is the back of the building and its right wall is the left side. The RIGHT one is the FRONT view: its left wall is the front of the building and its right wall is the right side. It's one building, so paint both views consistently: the same materials, colours and style, and the roof must match in both.`);
  L.push('');
  L.push('The flat colours are only a code that tells you what each surface is. Replace every one of them with real materials, so that none of the code colours is left anywhere in the picture (no flat red, yellow, blue or cyan stripes, edges or patches; the roof ridge and every roof edge get real materials too):');
  roles.forEach(k => L.push(`- ${ROLES[k].hint} = ${ROLES[k].word}`));
  if (kinds.includes('door')) L.push('- blue rectangles = doors: paint a door exactly inside each one');
  if (kinds.includes('window')) L.push('- cyan rectangles = windows: paint a window with its frame and sill exactly inside each one');
  L.push('The code colours say nothing about the real colours: paint the door, windows, roof and trim in the materials described above, never in flat blue, cyan, red or yellow.');
  L.push('');
  L.push(`Paint every detail flat onto the surfaces, as if printed on (frames, shutters, beams, planks, bricks, stones, roof tiles, gutters, lamps, signs, cracks, moss), so nothing sticks out and the outline of the building does not change at all. ${kinds.length ? 'Don\'t add doors or windows anywhere else.' : 'Put the main entrance door on the front wall and add windows where they make sense.'}`);
  L.push('');
  L.push(`${(LOOKS[S.look] || LOOKS.realistic).say} Keep the lighting soft and even, with no strong shadows.`);
  L.push('');
  L.push('Keep everything else exactly the same: the same camera angles, the same size and position of both buildings, the same blocky shapes and silhouette, and the plain black background. Don\'t add ground, grass, plants, people, sky, shadows on the ground, text labels or anything outside the building.');
  return L.join('\n');
}
