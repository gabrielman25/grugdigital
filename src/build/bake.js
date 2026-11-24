/* =====================================================================
   Line Gemini's picture up with the reference, then bake it onto the model.
   ===================================================================== */
const AL = { img:null, iw:0, ih:0, mask:null, a:[{dx:0,dy:0,s:1,k:1},{dx:0,dy:0,s:1,k:1}], geo:-1, match:0, target:'both', overlay:'outline', alpha:0.85 };
function place(a){ const f = Math.min(RW/AL.iw, RH/AL.ih), sx = f*a.s*a.k, sy = f*a.s; return { sx, sy, x0: RW/2 + a.dx - AL.iw*sx/2, y0: RH/2 + a.dy - AL.ih*sy/2 }; }

function setImage(img){
  AL.img = img; AL.iw = img.naturalWidth || img.width; AL.ih = img.naturalHeight || img.height; AL.geo = S.geoVer;
  buildReference(); prepMask(); autoAlign();
}
// Foreground of the uploaded picture: anything that isn't the background colour (median of the border)
function prepMask(){
  const sw = 640, sh = Math.max(1, Math.round(AL.ih/AL.iw*sw));
  const c = cnv(sw, sh), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0,0,sw,sh); x.drawImage(AL.img, 0, 0, sw, sh);
  const d = x.getImageData(0,0,sw,sh).data, br = [[],[],[]], push = i => { br[0].push(d[i]); br[1].push(d[i+1]); br[2].push(d[i+2]); };
  for (let X=0;X<sw;X++){ push(X*4); push(((sh-1)*sw+X)*4); }
  for (let Y=0;Y<sh;Y++){ push(Y*sw*4); push((Y*sw+sw-1)*4); }
  const bg = br.map(a => a.sort((p,q) => p-q)[a.length >> 1]), m = new Uint8Array(sw*sh);
  // background = everything connected to the border that stays close to the border colour (so pale walls inside
  // the building's outline still count as building, whatever the background colour)
  const near = new Uint8Array(sw*sh), bgd = i => { const j = i*4; return Math.max(Math.abs(d[j]-bg[0]), Math.abs(d[j+1]-bg[1]), Math.abs(d[j+2]-bg[2])); };
  for (let i=0;i<sw*sh;i++) near[i] = bgd(i) <= 70 ? 1 : 0;
  const step = (i, k) => { const a = i*4, b = k*4; return Math.max(Math.abs(d[a]-d[b]), Math.abs(d[a+1]-d[b+1]), Math.abs(d[a+2]-d[b+2])) <= 5; };
  const seen = new Uint8Array(sw*sh), st = [];
  const go = (i, k) => { if (near[k] && !seen[k] && step(i, k)){ seen[k] = 1; st.push(k); } };
  for (let i=0;i<sw*sh;i++){ const x = i % sw, y = (i/sw)|0; if ((x === 0 || y === 0 || x === sw-1 || y === sh-1) && bgd(i) <= 12){ seen[i] = 1; st.push(i); } }
  while (st.length){ const i = st.pop(), x = i % sw, y = (i/sw)|0; if (x > 0) go(i, i-1); if (x < sw-1) go(i, i+1); if (y > 0) go(i, i-sw); if (y < sh-1) go(i, i+sw); }
  for (let i=0;i<sw*sh;i++) m[i] = seen[i] ? 0 : 1;
  const p = place({dx:0,dy:0,s:1,k:1}), yCut = Math.ceil((TOP - 12 - p.y0)/p.sy*sh/AL.ih);   // ignore the view labels
  for (let y=0;y<Math.min(sh, yCut);y++) for (let X=0;X<sw;X++) m[y*sw+X] = 0;
  AL.mask = { m, sw, sh };
}
function iou(a, R, half){
  const p = place(a), { m, sw, sh } = AL.mask, kx = sw/AL.iw, ky = sh/AL.ih;
  const xa = half === 1 ? R.rw >> 1 : 0, xb = half === 0 ? R.rw >> 1 : R.rw, nRef = half < 0 ? R.n[0] + R.n[1] : R.n[half];
  let inter = 0, up = 0;
  for (let y=0;y<R.rh;y++){
    const v = Math.floor(((y+.5)*RH/R.rh - p.y0)/p.sy*ky); if (v < 0 || v >= sh) continue; const row = v*sw;
    for (let x=xa;x<xb;x++){ const u = Math.floor(((x+.5)*RW/R.rw - p.x0)/p.sx*kx); if (u < 0 || u >= sw || !m[row+u]) continue; up++; if (R.m[y*R.rw+x]) inter++; }
  }
  return inter / (nRef + up - inter + 1e-9);
}
function bboxInit(){
  const { m, sw, sh } = AL.mask, cols = new Uint32Array(sw), rows = new Uint32Array(sh);
  for (let y=0;y<sh;y++) for (let x=0;x<sw;x++) if (m[y*sw+x]){ cols[x]++; rows[y]++; }
  let U0=-1,U1=-1,V0=-1,V1=-1;
  for (let x=0;x<sw;x++) if (cols[x] >= 2){ if (U0 < 0) U0 = x; U1 = x+1; }
  for (let y=0;y<sh;y++) if (rows[y] >= 2){ if (V0 < 0) V0 = y; V1 = y+1; }
  if (U0 < 0 || V0 < 0) return null;
  const kx = AL.iw/sw, ky = AL.ih/sh; U0*=kx; U1*=kx; V0*=ky; V1*=ky;
  const f = Math.min(RW/AL.iw, RH/AL.ih), B = REF.box;
  const sx = (B.x1-B.x0)/((U1-U0)*f), sy = (B.y1-B.y0)/((V1-V0)*f), x0 = B.x0 - U0*f*sx, y0 = B.y0 - V0*f*sy;
  return { dx: x0 - RW/2 + AL.iw*f*sx/2, dy: y0 - RH/2 + AL.ih*f*sy/2, s: sy, k: clamp(sx/sy, .85, 1.18) };
}
function climb(a, R, half, st, minStep){
  let best = iou(a, R, half), it = 0; const lim = { s:[0.4,2.5], k:[0.85,1.18] };
  while (st.dx > minStep && it++ < 700){
    let improved = false;
    for (const key of ['dx','dy','s','k']){
      for (const sg of [1,-1]){ const b = { ...a }; b[key] += sg*st[key]; if (lim[key]) b[key] = clamp(b[key], lim[key][0], lim[key][1]);
        const v = iou(b, R, half); if (v > best + 1e-6){ best = v; a = b; improved = true; break; } }
    }
    if (!improved) for (const key in st) st[key] *= 0.5;
  }
  return { a, v: best };
}
// One fit for the whole picture, then a fine fit per view (Gemini sometimes nudges one building but not the other)
function autoAlign(){
  if (!AL.mask) return 0;
  const R0 = REF.masks[0], R1 = REF.masks[1], starts = [{dx:0,dy:0,s:1,k:1}], bb = bboxInit(); if (bb) starts.push(bb);
  let best = null;
  for (const s0 of starts){
    let r = climb({ ...s0 }, R0, -1, { dx:20, dy:20, s:0.04, k:0.03 }, 1.5);
    r = climb(r.a, R1, -1, { dx:4, dy:4, s:0.01, k:0.008 }, 0.2);
    if (!best || r.v > best.v) best = r;
  }
  AL.a = [0,1].map(h => climb({ ...best.a }, R1, h, { dx:5, dy:5, s:0.012, k:0.008 }, 0.12).a);
  return updateMatch();
}
function updateMatch(){
  if (!AL.mask) return AL.match = 0;
  const R = REF.masks[1], n = R.n;
  AL.match = (iou(AL.a[0], R, 0)*n[0] + iou(AL.a[1], R, 1)*n[1]) / Math.max(1, n[0] + n[1]);
  return AL.match;
}
// The aligned picture, both halves placed with their own fit
function alignedCanvas(){
  const c = cnv(RW, RH), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0,0,RW,RH);
  if (!AL.img) return c;
  x.imageSmoothingQuality = 'high';
  VIEWS.forEach(V => { const p = place(AL.a[V.i]); x.save(); x.beginPath(); x.rect(V.i*RW/2, 0, RW/2, RH); x.clip();
    x.drawImage(AL.img, p.x0, p.y0, AL.iw*p.sx, AL.ih*p.sy); x.restore(); });
  return c;
}

/* ---------- retro looks (the same presets as the Avatar Studio) ---------- */
const B4 = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const hexRgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
const PICO8 = ['000000','1D2B53','7E2553','008751','AB5236','5F574F','C2C3C7','FFF1E8','FF004D','FFA300','FFEC27','00E436','29ADFF','83769C','FF77A8','FFCCAA'].map(h => hexRgb('#'+h));
const GB = ['0f380f','306230','8bac0f','9bbc0f'].map(h => hexRgb('#'+h));
const FX_DEFAULT = { vib:0, div:1, filter:'smooth', bits:8, palette:'off', colors:32, dither:0, bright:0, contrast:0, sat:0, sharpen:0, edge:0, grain:0, lowres:false, wobble:false, ao:0, light:0 };
const FX_PRESETS = {
  grug:     { label:'Grug PS1', fx:{ div:2, filter:'nearest', bits:4, dither:1, contrast:0.14, vib:0.45, sat:0.06, ao:0.65, light:0.4 } },
  original: { label:'Original', fx:{} },
  gdef:     { label:'Grug crunchy', fx:{ div:3, filter:'nearest', bits:3, dither:1, bright:0.09, contrast:0.42, sat:0.31, sharpen:1, ao:1, light:0.85, grain:0.25 } },
  hd:       { label:'HD clean', fx:{ sharpen:0.6, contrast:0.08, sat:0.15, ao:0.3 } },
  shaded:   { label:'Shaded', fx:{ edge:0.75, grain:0.12, sharpen:0.2, contrast:0.05 } },
  n64:      { label:'N64', fx:{ div:4, filter:'n64', bits:5, dither:0.35, sat:0.1, contrast:0.04, lowres:true } },
  ps1:      { label:'PS1', fx:{ div:3, filter:'nearest', bits:4, dither:1, contrast:0.06, lowres:true, wobble:true } },
  snes:     { label:'16-bit', fx:{ div:4, filter:'nearest', palette:'adaptive', colors:24, dither:0.45, sat:0.18, contrast:0.06, lowres:true } },
  pico8:    { label:'PICO-8', fx:{ div:4, filter:'nearest', palette:'pico8', dither:0.6, contrast:0.1, sat:0.1, lowres:true } },
  gameboy:  { label:'Game Boy', fx:{ div:4, filter:'nearest', palette:'gameboy', dither:1, contrast:0.12, lowres:true } },
};
const fxOf = key => ({ ...FX_DEFAULT, ...(FX_PRESETS[key] || FX_PRESETS.grug).fx });

/* ---------- bake ---------- */
const BK = { deshade:0.75, size:1024, look:'grug', bevel:true, raw:null, out:null };
const BEVEL = 0.14;    // bevel width in grid units (normal map only: the silhouette stays a clean block)
const GUT = 2;

function edgeInfo(f, W){
  const K = 6, c = mul(f.verts.reduce((s,p) => add(s,p), [0,0,0]), 1/f.verts.length);
  return f.verts.map((A, i) => {
    const B = f.verts[(i+1) % f.verts.length], dir = norm(sub(B, A));
    let out = norm(cross(dir, f.n)); if (dot(out, sub(mul(add(A,B), .5), c)) < 0) out = mul(out, -1);
    const kinds = [];
    for (let k=0;k<K;k++){
      const q = add(A, mul(sub(B, A), (k+.5)/K)), x = add(q, mul(out, 0.05));
      let kind = 'convex';
      const seam = W.faces.some(g => g !== f && !g.buried && dot(g.n, f.n) > 0.999 && Math.abs(dot(g.n, x) - g.d) < 0.02 && (() => { const [a,b] = faceUV(g, x); return in2(g, a, b, 0); })());
      if (seam) kind = 'seam';
      else { const y = add(add(q, mul(f.n, 0.05)), mul(out, 0.05)); if (y[1] < 0.005 || insideAny(y, W.byPiece, f.piece)) kind = 'concave'; }
      kinds.push(kind);
    }
    return { a: faceUV(f, A), b: faceUV(f, B), kinds, K };
  });
}
// distance (grid units) from a point on the face to the nearest convex and concave edges
function edgeDist(E, a, b){
  let dv = 9, dc = 9;
  for (const e of E){
    const ex = e.b[0]-e.a[0], ey = e.b[1]-e.a[1], L2 = ex*ex + ey*ey || 1;
    const t = clamp(((a-e.a[0])*ex + (b-e.a[1])*ey)/L2, 0, 1), d = Math.hypot(a - e.a[0] - t*ex, b - e.a[1] - t*ey);
    const kind = e.kinds[Math.min(e.K-1, (t*e.K)|0)];
    if (kind === 'convex') dv = Math.min(dv, d); else if (kind === 'concave') dc = Math.min(dc, d);
  }
  return [dv, dc];
}

function packAtlas(F, S_, td){
  const rects = F.map(f => { const t = f.n[1] < -0.5 ? Math.min(td, 4) : td, iw = Math.max(2, Math.ceil(f.uw*t)), ih = Math.max(2, Math.ceil(f.vh*t));
    return { f, iw, ih, w: iw + 2*GUT, h: ih + 2*GUT }; });
  const order = rects.slice().sort((p, q) => q.h - p.h || q.w - p.w);
  let x = 0, y = 0, rowH = 0;
  for (const r of order){
    if (r.w > S_) return null;
    if (x + r.w > S_){ x = 0; y += rowH; rowH = 0; }
    if (y + r.h > S_) return null;
    r.x = x; r.y = y; x += r.w; rowH = Math.max(rowH, r.h);
  }
  return rects;
}

function bilinear(D, w, h, x, y, out){
  x = clamp(x - .5, 0, w - 1.001); y = clamp(y - .5, 0, h - 1.001);
  const x0 = x|0, y0 = y|0, fx = x - x0, fy = y - y0, i = (y0*w + x0)*4, j = i + w*4;
  for (let c=0;c<3;c++) out[c] = (D[i+c]*(1-fx) + D[i+4+c]*fx)*(1-fy) + (D[j+c]*(1-fx) + D[j+4+c]*fx)*fy;
}
function inpaint(c, s, w, h){
  const NB = [[0,-1,1],[0,1,1],[-1,0,1],[1,0,1]];
  let pend = []; for (let i=0;i<w*h;i++) if (!s[i]) pend.push(i);
  while (pend.length){
    const next = [], upd = [];
    for (const i of pend){ const x = i % w, y = (i / w)|0; let n = 0; const acc = [0,0,0];
      for (const [dx,dy,wt] of NB){ const X = x+dx, Y = y+dy; if (X<0||Y<0||X>=w||Y>=h) continue; const j = Y*w+X; if (s[j]){ acc[0]+=c[j*3]*wt; acc[1]+=c[j*3+1]*wt; acc[2]+=c[j*3+2]*wt; n+=wt; } }
      if (n) upd.push([i, acc[0]/n, acc[1]/n, acc[2]/n]); else next.push(i); }
    if (!upd.length) break;
    for (const [i, r, g, b] of upd){ c[i*3]=r; c[i*3+1]=g; c[i*3+2]=b; s[i]=1; }
    pend = next;
  }
}

// Sample Gemini's picture into every face of the model (the slow part: run once per picture/alignment)
function bakeRaw(){
  buildReference();
  const W = world(), F = meshFaces();
  const cap = Math.min(1, 4096/Math.max(AL.iw, AL.ih)), sw = Math.max(1, Math.round(AL.iw*cap)), sh = Math.max(1, Math.round(AL.ih*cap));
  const sc = cnv(sw, sh), sx = sc.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(AL.img, 0, 0, sw, sh);
  const SRC = sx.getImageData(0, 0, sw, sh).data;
  const P = VIEWS.map(V => place(AL.a[V.i]));
  const srcPerUnit = REF.s * cap / Math.min(P[0].sy, P[1].sy);
  const tdMax = clamp(Math.round(srcPerUnit), 10, 128);
  // the biggest texel density that fits the atlas
  const S_ = BK.size; let td = Math.min(tdMax, Math.sqrt(0.78*S_*S_ / Math.max(1, F.reduce((s,f) => s + (f.n[1] < -0.5 ? 0.05 : 1)*f.uw*f.vh, 0)))), rects = null;
  for (let it=0; it<40 && !(rects = packAtlas(F, S_, td)); it++) td *= 0.93;
  if (!rects) throw new Error('The building is too big for this texture size. Pick a bigger texture size.');
  const roleAcc = {}; ROLE_KEYS.forEach(k => roleAcc[k] = [0,0,0,0]);
  const tmp = [0,0,0];
  rects.forEach(R => {
    const f = R.f, w = R.w, h = R.h, c = new Float32Array(w*h*3), s = new Uint8Array(w*h);
    const ranked = VIEWS.filter(V => facing(f, V) > 0.08).sort((A, B) => (facing(f, B) - facing(f, A)) || (B.i - A.i));
    const kV = VIEWS.map(V => 1 + (SNORM/shadeOf(rv(V.R, f.n)) - 1)*BK.deshade);
    let total = 0, got = 0;
    const pass = edge => {
      for (let j=0;j<R.ih;j++) for (let i=0;i<R.iw;i++){
        const idx = (j+GUT)*w + i + GUT; if (s[idx]) continue;
        const a = (i+.5)*f.uw/R.iw, b = (j+.5)*f.vh/R.ih; if (!in2(f, a, b, 0)) continue;
        if (!edge) total++;
        const p = facePt(f, a, b);
        for (const V of ranked){
          const vis = visible(f, V, p); if (vis === 2 || (edge && vis === 1)){
            const [X, Y] = proj(V, p), pl = P[V.i];
            bilinear(SRC, sw, sh, (X - pl.x0)/pl.sx*cap, (Y - pl.y0)/pl.sy*cap, tmp);
            const k = kV[V.i]; c[idx*3] = tmp[0]*k; c[idx*3+1] = tmp[1]*k; c[idx*3+2] = tmp[2]*k; s[idx] = 1; got++; break;
          }
        }
      }
    };
    pass(false); if (!got && f.n[1] > -0.5) pass(true);
    R.c = c; R.s = s; R.total = total; R.got = got; R.cov = total ? got/total : 0;
    if (f.n[1] > -0.5){ const A = roleAcc[f.role]; for (let i=0;i<w*h;i++) if (s[i]){ A[0]+=c[i*3]; A[1]+=c[i*3+1]; A[2]+=c[i*3+2]; A[3]++; } }
  });
  const roleMean = k => { const A = roleAcc[k]; if (A[3]) return [A[0]/A[3], A[1]/A[3], A[2]/A[3]];
    const all = ROLE_KEYS.reduce((s, r) => s.map((v, i) => v + roleAcc[r][i]), [0,0,0,0]); return all[3] ? [all[0]/all[3], all[1]/all[3], all[2]/all[3]] : ROLES[k].col; };
  const cls = f => f.n[1] > 0.7 ? 'up' : Math.abs(f.n[1]) < 0.3 ? 'side' : 'slope';
  // surfaces the cameras barely saw: borrow the texture of a well-seen surface of the same kind, else a flat fill
  rects.forEach(R => {
    const f = R.f, w = R.w, h = R.h;
    if (f.n[1] < -0.5){ const m = roleMean(f.role).map(v => v*0.62); for (let i=0;i<w*h;i++){ R.c[i*3]=m[0]; R.c[i*3+1]=m[1]; R.c[i*3+2]=m[2]; R.s[i]=1; } return; }
    if (R.cov < 0.3){
      const D = rects.filter(Q => Q !== R && Q.f.role === f.role && cls(Q.f) === cls(f) && Q.cov > 0.6).sort((p, q) => q.got - p.got)[0]
             || rects.filter(Q => Q !== R && Q.f.role === f.role && Q.cov > 0.6).sort((p, q) => q.got - p.got)[0];
      if (D){ for (let j=0;j<h;j++) for (let i=0;i<w;i++){ const idx = j*w+i; if (R.s[idx]) continue;
          const di = GUT + (i % D.iw), dj = GUT + (j % D.ih), q = dj*D.w + di; if (!D.s[q]) continue;
          R.c[idx*3]=D.c[q*3]; R.c[idx*3+1]=D.c[q*3+1]; R.c[idx*3+2]=D.c[q*3+2]; R.s[idx]=1; } }
    }
    let any = false; for (let i=0;i<w*h;i++) if (R.s[i]){ any = true; break; }
    if (!any){ const m = roleMean(f.role); for (let i=0;i<w*h;i++){ R.c[i*3]=m[0]; R.c[i*3+1]=m[1]; R.c[i*3+2]=m[2]; R.s[i]=1; } }
    inpaint(R.c, R.s, w, h);
  });
  // edges (for the bevel normal map, the corner shading and the light)
  rects.forEach(R => { const f = R.f; R.E = f.n[1] < -0.5 ? [] : edgeInfo(f, W); });
  BK.raw = { rects, S: S_, td, lo: W.lo, hi: W.hi, geo: S.geoVer };
  return BK.raw;
}

/* Post effects, per face (ported from the Avatar Studio): tone, sharpen, corner shading, baked light, grain,
   then downsample, quantise with a 4x4 Bayer dither and scale back up with nearest filtering */
function processRect(R, fx, raw){
  const { w, h, f } = R, n = w*h, td = R.iw / Math.max(1e-6, f.uw);
  let F = new Float32Array(n*4);
  for (let i=0;i<n;i++){ F[i*4]=R.c[i*3]; F[i*4+1]=R.c[i*3+1]; F[i*4+2]=R.c[i*3+2]; F[i*4+3]=255; }
  if (fx.bright || fx.contrast || fx.sat){ const cm = 1 + fx.contrast, s2 = 1 + fx.sat, br = fx.bright*255;
    for (let p=0;p<n*4;p+=4){ for (let c=0;c<3;c++) F[p+c] = (F[p+c] + br - 128)*cm + 128; const l = 0.299*F[p] + 0.587*F[p+1] + 0.114*F[p+2]; for (let c=0;c<3;c++) F[p+c] = l + (F[p+c]-l)*s2; } }
  if (fx.vib > 0){   // vibrance: lifts dull colours more than ones that are already strong, so buildings pop without going neon
    for (let p=0;p<n*4;p+=4){ const mx = Math.max(F[p],F[p+1],F[p+2]), mn = Math.min(F[p],F[p+1],F[p+2]), k = 1 + fx.vib*(1 - (mx-mn)/255)*sm(8, 60, mx), l = 0.299*F[p] + 0.587*F[p+1] + 0.114*F[p+2];
      for (let c=0;c<3;c++) F[p+c] = l + (F[p+c]-l)*k; } }
  if (fx.sharpen > 0){ const b = new Float32Array(n*4);
    for (let j=0;j<h;j++) for (let i=0;i<w;i++){ const acc = [0,0,0]; let k = 0;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){ const q = (clamp(j+dy,0,h-1)*w + clamp(i+dx,0,w-1))*4; acc[0]+=F[q]; acc[1]+=F[q+1]; acc[2]+=F[q+2]; k++; }
      const d = (j*w+i)*4; b[d]=acc[0]/k; b[d+1]=acc[1]/k; b[d+2]=acc[2]/k; }
    const a = fx.sharpen*1.6; for (let p=0;p<n*4;p+=4) for (let c=0;c<3;c++) F[p+c] += (F[p+c]-b[p+c])*a; }
  const needEdges = (fx.ao > 0 || fx.edge > 0) && R.E.length, Hb = Math.max(1, raw.hi[1] - raw.lo[1]);
  if (needEdges || fx.light > 0 || fx.grain > 0){
    for (let j=0;j<h;j++) for (let i=0;i<w;i++){
      const a = (i - GUT + .5)/td, b = (j - GUT + .5)*f.vh/R.ih, p = (j*w+i)*4; let k = 1;
      if (needEdges){ const [dv, dc] = edgeDist(R.E, a, b);
        if (fx.ao > 0){ if (dv < 0.45) k *= 1 - fx.ao*0.4*Math.pow(1 - dv/0.45, 2); if (dc < 0.9) k *= 1 - fx.ao*0.55*Math.pow(1 - dc/0.9, 2); }
        if (fx.edge > 0 && dv < 0.3) k *= 1 - fx.edge*0.55*Math.pow(1 - dv/0.3, 2); }
      if (fx.light > 0){ const y = facePt(f, a, b)[1], t = 0.62*((y - raw.lo[1])/Hb - 0.5) + (f.n[1] > 0.3 ? 0.12 : 0); k *= 1 + fx.light*0.9*t; }
      F[p]*=k; F[p+1]*=k; F[p+2]*=k;
      if (fx.grain > 0){ const g = (hash2(R.x+i, R.y+j) - 0.5)*fx.grain*46; F[p]+=g; F[p+1]+=g; F[p+2]+=g; }
    }
  }
  const lw = Math.max(1, Math.round(w/fx.div)), lh = Math.max(1, Math.round(h/fx.div));
  let low = F;
  if (lw !== w || lh !== h){ low = new Float32Array(lw*lh*4); const cnt = new Float32Array(lw*lh);
    for (let j=0;j<h;j++){ const J = Math.min(lh-1, (j*lh/h)|0); for (let i=0;i<w;i++){ const I = Math.min(lw-1, (i*lw/w)|0), p = (j*w+i)*4, q = (J*lw+I)*4; low[q]+=F[p]; low[q+1]+=F[p+1]; low[q+2]+=F[p+2]; cnt[J*lw+I]++; } }
    for (let t=0;t<lw*lh;t++){ const q = t*4, c = cnt[t] || 1; low[q]/=c; low[q+1]/=c; low[q+2]/=c; low[q+3] = 255; } }
  for (let p=0;p<low.length;p++) low[p] = clamp(low[p], 0, 255);
  return { R, lw, lh, low };
}
function kmeans(faces, k){
  const pts = []; faces.forEach(F => { for (let p=0;p<F.low.length;p+=4) pts.push([F.low[p],F.low[p+1],F.low[p+2]]); });
  if (!pts.length) return [[0,0,0]];
  const stride = Math.max(1, Math.floor(pts.length/9000)), Sm = pts.filter((_, i) => i % stride === 0); k = Math.min(k, Sm.length);
  const lum = a => a[0]*.3 + a[1]*.59 + a[2]*.11, byL = Sm.slice().sort((a, b) => lum(a) - lum(b));
  let C = Array.from({length:k}, (_, i) => byL[Math.floor((i+.5)*byL.length/k)].slice()); const as = new Int32Array(Sm.length);
  for (let it=0; it<12; it++){
    for (let s=0;s<Sm.length;s++){ let best = 0, bd = 1e18; for (let c=0;c<k;c++){ const dr = Sm[s][0]-C[c][0], dg = Sm[s][1]-C[c][1], db = Sm[s][2]-C[c][2], d = dr*dr*.3 + dg*dg*.59 + db*db*.11; if (d < bd){ bd = d; best = c; } } as[s] = best; }
    const sum = Array.from({length:k}, () => [0,0,0,0]); for (let s=0;s<Sm.length;s++){ const m = sum[as[s]]; m[0]+=Sm[s][0]; m[1]+=Sm[s][1]; m[2]+=Sm[s][2]; m[3]++; }
    C = sum.map((m, i) => m[3] ? [m[0]/m[3], m[1]/m[3], m[2]/m[3]] : C[i]);
  }
  return C;
}
function quantize(Fq, fx, pal, cache){
  const { lw, lh, low } = Fq, d = fx.dither, L = (1 << fx.bits) - 1;
  const spread = pal ? (pal.length <= 4 ? 110 : pal.length <= 16 ? 56 : pal.length <= 64 ? 34 : 20) : 0;
  for (let j=0;j<lh;j++) for (let i=0;i<lw;i++){
    const p = (j*lw+i)*4, t = (B4[(j&3)*4 + (i&3)] + 0.5)/16 - 0.5;
    if (fx.palette === 'gameboy'){ const y = 0.299*low[p] + 0.587*low[p+1] + 0.114*low[p+2], c = GB[clamp(Math.round(y/255*3 + t*d), 0, 3)]; low[p]=c[0]; low[p+1]=c[1]; low[p+2]=c[2]; }
    else if (pal){ const r = clamp(low[p]+t*d*spread,0,255), g = clamp(low[p+1]+t*d*spread,0,255), b = clamp(low[p+2]+t*d*spread,0,255), key = ((r>>3)<<10) | ((g>>3)<<5) | (b>>3);
      let idx = cache[key]; if (idx < 0){ let bd = 1e18; for (let c=0;c<pal.length;c++){ const dr = r-pal[c][0], dg = g-pal[c][1], db = b-pal[c][2], dd = dr*dr*.3 + dg*dg*.59 + db*db*.11; if (dd < bd){ bd = dd; idx = c; } } cache[key] = idx; }
      low[p]=pal[idx][0]; low[p+1]=pal[idx][1]; low[p+2]=pal[idx][2]; }
    else if (fx.bits < 8){ for (let c=0;c<3;c++) low[p+c] = clamp(Math.round(low[p+c]/255*L + t*d), 0, L)*255/L; }
    else if (d > 0){ for (let c=0;c<3;c++) low[p+c] = clamp(low[p+c] + t*d*8, 0, 255); }
  }
}
function upscale(Fq, fx, out, S_){
  const { R, lw, lh, low } = Fq, { w, h } = R, same = lw === w && lh === h, px = (I, J, c) => low[(clamp(J,0,lh-1)*lw + clamp(I,0,lw-1))*4 + c];
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    const o = ((R.y+j)*S_ + R.x + i)*4;
    if (same){ for (let c=0;c<3;c++) out[o+c] = low[(j*lw+i)*4+c]; out[o+3] = 255; continue; }
    if (fx.filter === 'nearest'){ const I = Math.min(lw-1, ((i+.5)*lw/w)|0), J = Math.min(lh-1, ((j+.5)*lh/h)|0); for (let c=0;c<3;c++) out[o+c] = low[(J*lw+I)*4+c]; out[o+3] = 255; continue; }
    const sx = clamp((i+.5)*lw/w - .5, 0, lw-1), sy = clamp((j+.5)*lh/h - .5, 0, lh-1), x0 = Math.floor(sx), y0 = Math.floor(sy), fx_ = sx - x0, fy = sy - y0;
    for (let c=0;c<3;c++){ const c00 = px(x0,y0,c), c10 = px(x0+1,y0,c), c01 = px(x0,y0+1,c), c11 = px(x0+1,y0+1,c);
      out[o+c] = fx.filter === 'n64' ? ((fx_ + fy <= 1) ? c00 + fx_*(c10-c00) + fy*(c01-c00) : c11 + (1-fx_)*(c01-c11) + (1-fy)*(c10-c11)) : (c00*(1-fx_) + c10*fx_)*(1-fy) + (c01*(1-fx_) + c11*fx_)*fy; }
    out[o+3] = 255;
  }
}
// Bevel normal map: rounded convex edges (seams between flush blocks and inside corners stay flat)
function normalRect(R, out, S_){
  const { w, h, f } = R, td = R.iw / Math.max(1e-6, f.uw), tv = R.ih / Math.max(1e-6, f.vh), H = new Float32Array(w*h);
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    const a = (i - GUT + .5)/td, b = (j - GUT + .5)/tv; let v = 1;
    if (R.E.length){ const [dv] = edgeDist(R.E, a, b); if (dv < BEVEL) v = 1 - Math.pow(1 - dv/BEVEL, 2); }
    H[j*w+i] = v;
  }
  const K = BEVEL*0.6;
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    const hu = (H[j*w + Math.min(w-1,i+1)] - H[j*w + Math.max(0,i-1)]) * td/2, hv = (H[Math.min(h-1,j+1)*w + i] - H[Math.max(0,j-1)*w + i]) * tv/2;
    const n = norm([-hu*K, hv*K, 1]), o = ((R.y+j)*S_ + R.x + i)*4;
    out[o] = (n[0]*.5 + .5)*255; out[o+1] = (n[1]*.5 + .5)*255; out[o+2] = (n[2]*.5 + .5)*255; out[o+3] = 255;
  }
}
// Apply the chosen look to the sampled colours: fast enough to run on every slider change
function finishBake(){
  const raw = BK.raw; if (!raw) return null;
  const fx = fxOf(BK.look), S_ = raw.S;
  const col = new Uint8ClampedArray(S_*S_*4), nrm = new Uint8ClampedArray(S_*S_*4);
  for (let i=0;i<S_*S_;i++){ col[i*4+3] = 255; nrm[i*4] = 128; nrm[i*4+1] = 128; nrm[i*4+2] = 255; nrm[i*4+3] = 255; }
  const faces = raw.rects.map(R => processRect(R, fx, raw));
  let pal = null; if (fx.palette === 'adaptive') pal = kmeans(faces, fx.colors); else if (fx.palette === 'pico8') pal = PICO8;
  const cache = new Int16Array(32768).fill(-1);
  faces.forEach(Fq => { quantize(Fq, fx, pal, cache); upscale(Fq, fx, col, S_); });
  if (BK.bevel) raw.rects.forEach(R => normalRect(R, nrm, S_));
  const cc = cnv(S_, S_); cc.getContext('2d').putImageData(new ImageData(col, S_, S_), 0, 0);
  const nc = cnv(S_, S_); nc.getContext('2d').putImageData(new ImageData(nrm, S_, S_), 0, 0);
  // mesh with atlas UVs
  const g = G(), ex = { P:[], N:[], T:[], U:[] };
  raw.rects.forEach(R => { const f = R.f, uvOf = p => { const [a, b] = faceUV(f, p); return [(R.x + GUT + a*R.iw/f.uw)/S_, (R.y + GUT + b*R.ih/f.vh)/S_]; };
    for (let i=1;i<f.verts.length-1;i++) for (const p of [f.verts[0], f.verts[i], f.verts[i+1]]){
      g.P.push(...p); g.N.push(...f.n); g.C.push(1,1,1); g.T.push(...uvOf(p)); g.U.push(...f.u); } });
  BK.out = { col: cc, nrm: nc, g, fx, S: S_, nearest: fx.filter === 'nearest' && fx.div > 1, geo: raw.geo };
  return BK.out;
}

/* ---------- export: binary glTF (.glb) with colour + normal textures ---------- */
async function canvasPNG(c){ const b = await new Promise(r => c.toBlob(r, 'image/png')); return new Uint8Array(await b.arrayBuffer()); }
async function makeGLB(){
  const o = BK.out; if (!o) throw new Error('Nothing baked yet.');
  const W = world(), cx = (W.lo[0] + W.hi[0])/2, cz = (W.lo[2] + W.hi[2])/2, y0 = Math.min(0, W.lo[1]);
  const n = o.g.P.length/3, pos = new Float32Array(n*3), nrm = new Float32Array(o.g.N), uv = new Float32Array(o.g.T), tan = new Float32Array(n*4);
  const lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
  for (let i=0;i<n;i++){ pos[i*3] = o.g.P[i*3] - cx; pos[i*3+1] = o.g.P[i*3+1] - y0; pos[i*3+2] = o.g.P[i*3+2] - cz;
    for (let a=0;a<3;a++){ lo[a] = Math.min(lo[a], pos[i*3+a]); hi[a] = Math.max(hi[a], pos[i*3+a]); }
    tan[i*4] = o.g.U[i*3]; tan[i*4+1] = o.g.U[i*3+1]; tan[i*4+2] = o.g.U[i*3+2]; tan[i*4+3] = 1; }
  const idx = n < 65536 ? new Uint16Array(n) : new Uint32Array(n); for (let i=0;i<n;i++) idx[i] = i;
  const pngC = await canvasPNG(o.col), pngN = BK.bevel ? await canvasPNG(o.nrm) : null;
  const chunks = [], views = []; let off = 0;
  const addView = (u8, target) => { const pad = (4 - off % 4) % 4; if (pad){ chunks.push(new Uint8Array(pad)); off += pad; }
    views.push({ buffer:0, byteOffset:off, byteLength:u8.byteLength, ...(target ? { target } : {}) }); chunks.push(u8); off += u8.byteLength; return views.length - 1; };
  const u8 = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const vP = addView(u8(pos), 34962), vN = addView(u8(nrm), 34962), vT = addView(u8(uv), 34962), vU = addView(u8(tan), 34962), vI = addView(u8(idx), 34963);
  const vC = addView(pngC), vNm = pngN ? addView(pngN) : -1;
  const name = bname().replace(/[^\w\- ]+/g, '').trim() || 'Building';
  const mat = { name: name + 'Material', pbrMetallicRoughness: { baseColorTexture: { index:0 }, metallicFactor:0, roughnessFactor:1 } };
  if (pngN) mat.normalTexture = { index:1, scale:1 };
  const json = { asset:{ version:'2.0', generator:'Grug Building Studio' }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ mesh:0, name }],
    meshes:[{ name, primitives:[{ attributes:{ POSITION:0, NORMAL:1, TEXCOORD_0:2, TANGENT:3 }, indices:4, material:0 }] }],
    materials:[mat],
    samplers:[{ magFilter: o.nearest ? 9728 : 9729, minFilter:9987, wrapS:33071, wrapT:33071 }],
    images:[{ bufferView:vC, mimeType:'image/png', name:name + '_color' }].concat(pngN ? [{ bufferView:vNm, mimeType:'image/png', name:name + '_normal' }] : []),
    textures:[{ sampler:0, source:0 }].concat(pngN ? [{ sampler:0, source:1 }] : []),
    accessors:[
      { bufferView:vP, componentType:5126, count:n, type:'VEC3', min:lo, max:hi },
      { bufferView:vN, componentType:5126, count:n, type:'VEC3' },
      { bufferView:vT, componentType:5126, count:n, type:'VEC2' },
      { bufferView:vU, componentType:5126, count:n, type:'VEC4' },
      { bufferView:vI, componentType: n < 65536 ? 5123 : 5125, count:n, type:'SCALAR' } ],
    bufferViews: views, buffers:[{ byteLength: off }] };
  let js = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - js.length % 4) % 4;
  if (jp){ const t = new Uint8Array(js.length + jp); t.set(js); t.fill(32, js.length); js = t; }
  const bp = (4 - off % 4) % 4, total = 12 + 8 + js.length + 8 + off + bp, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20);
  let p = 20 + js.length; dv.setUint32(p, off + bp, true); dv.setUint32(p+4, 0x004E4942, true); p += 8;
  for (const c of chunks){ out.set(c, p); p += c.byteLength; }
  return { bytes: out, name };
}
