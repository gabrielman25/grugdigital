/* =====================================================================
   App: sliders, 3D view, steps
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let toastT = 0;
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

const App = { person: true, step: 1, drag: null, cam: { yaw: 38*D2R, pitch: 28*D2R, dist: 30, tgt: [0, 2, 0] }, dirty: true, meshDirty: true, mode: 'edit', prompt: null };
const viewC = $('#view');
const R3 = new GLR(viewC, { aa:false });
const gl = R3.gl;

/* ---------- camera ---------- */
function camBasis(){
  const c = App.cam, d = [Math.sin(c.yaw)*Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw)*Math.cos(c.pitch)];
  const eye = add(c.tgt, mul(d, c.dist)), f = norm(sub(c.tgt, eye)), r = norm(cross(f, [0,1,0])), u = cross(r, f);
  return { eye, f, r, u };
}
const FOV = 40*D2R;
function frameAll(){
  const W = world(), c = mul(add(W.lo, W.hi), .5), r = Math.max(4, vlen(sub(W.hi, W.lo))/2);
  App.cam.tgt = [c[0], Math.max(1, c[1]*0.85), c[2]]; App.cam.dist = clamp(r/Math.sin(FOV/2)*1.25, 10, 160); App.dirty = true;
}
function viewProj(asp){ const B = camBasis(), V = m4look(B.eye, App.cam.tgt, [0,1,0]), P = m4persp(FOV, asp, 1, 600); return { M: m4mul(P, V), R: m3of(V) }; }
function screenOf(p){
  const b = viewC.getBoundingClientRect(), x = viewProj(b.width/Math.max(1,b.height)).M;
  const X = x[0]*p[0]+x[4]*p[1]+x[8]*p[2]+x[12], Y = x[1]*p[0]+x[5]*p[1]+x[9]*p[2]+x[13], Wc = x[3]*p[0]+x[7]*p[1]+x[11]*p[2]+x[15];
  return Wc > 0 ? [(X/Wc*.5+.5)*b.width, (1 - (Y/Wc*.5+.5))*b.height] : null;
}

/* ---------- meshes ---------- */
const LIME = [155,227,56];
let MESH = {};
function buildEditMesh(){
  ['faces','lines','marks'].forEach(k => R3.free(MESH[k]));
  const W = world(), g = G(), L = G(), mk = G();
  W.faces.forEach(f => { if (f.buried) return; pushPoly(g, f.verts, f.n, c01(ROLES[f.role].col));
    for (let i=0;i<f.verts.length;i++) pushLine(L, f.verts[i], f.verts[(i+1)%f.verts.length], c01([70,70,80])); });
  S.marks.forEach(m => pushPoly(mk, markQuads(m), AXES[m.axis], c01(MARKS[m.kind].col)));
  MESH.faces = R3.mesh(g); MESH.lines = R3.mesh(L, true); MESH.marks = R3.mesh(mk);
  App.meshDirty = false;
}
function buildGrid(){
  const L = G(), N = 30;
  for (let i=-N;i<=N;i++){ const c = c01(i % 4 === 0 ? [196,196,206] : [214,214,222]); pushLine(L, [i,0.001,-N], [i,0.001,N], c); pushLine(L, [-N,0.001,i], [N,0.001,i], c); }
  MESH.grid = R3.mesh(L, true);
  const g = G(); pushPoly(g, [[-N,0,-N],[-N,0,N],[N,0,N],[N,0,-N]], [0,1,0], c01([246,246,249])); MESH.floor = R3.mesh(g);
}
buildGrid();
function buildArrow(){
  R3.free(MESH.arrow); const W = world(), z = W.hi[2] + 1.2, g = G(), y = 0.01;
  pushPoly(g, [[-0.9,y,z],[0,y,z+1.2],[0.9,y,z]].reverse(), [0,1,0], c01(LIME));
  pushPoly(g, [[-0.35,y,z-1],[-0.35,y,z],[0.35,y,z],[0.35,y,z-1]].reverse(), [0,1,0], c01(LIME));
  MESH.arrow = R3.mesh(g); App.arrowAt = [0, 0, z + 2.3];
  App.figAt = [W.lo[0] - 1.1, 0, W.hi[2] + 0.9];   // the scale figure stands by the front-left corner
  R3.free(MESH.person); MESH.person = R3.mesh(avatarGeo(App.figAt[0], App.figAt[2]));
}

/* ---------- render ---------- */
let TEXGL = null;
function render(){
  if (!App.dirty) return; App.dirty = false;
  const fx = App.mode === 'tex' && BK.out ? BK.out.fx : null, lo = !!(fx && fx.lowres);
  const bw = viewC.clientWidth, bh = viewC.clientHeight, sc = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
  const ch = lo ? 300 : Math.round(bh*sc), cw = lo ? Math.round(300*bw/Math.max(1,bh)) : Math.round(bw*sc);
  if (viewC.width !== cw || viewC.height !== ch){ viewC.width = cw; viewC.height = ch; }
  viewC.classList.toggle('pix', lo);
  gl.viewport(0, 0, cw, ch); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const V = viewProj(cw/Math.max(1, ch));
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  R3.draw(MESH.floor, { M:V.M, mode:1 }); R3.draw(MESH.grid, { M:V.M, mode:1 }); R3.draw(MESH.arrow, { M:V.M, mode:1 });
  if (App.person){ if (App.fig) drawFigure(R3, App.fig, V.M, V.R, App.figAt); else R3.draw(MESH.person, { M:V.M, R:V.R, mode:0, amb:0.62, dif:0.48 }); }
  if (App.mode === 'tex' && TEXGL && fx){
    R3.draw(TEXGL.mesh, { M:V.M, R:V.R, mode:2, tex:TEXGL.col, nmap:TEXGL.nrm, nstr: BK.bevel ? 1 : 0, spec: BK.bevel ? 0.35 : 0, amb:0.62, dif:0.48, L:norm([-0.35,0.55,0.76]),
      affine: fx.wobble ? 1 : 0, snap: fx.wobble ? 70 : 0 });
  } else {
    if (App.meshDirty) buildEditMesh();
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    R3.draw(MESH.faces, { M:V.M, R:V.R, mode:0 });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    R3.draw(MESH.marks, { M:V.M, R:V.R, mode:0, amb:0.85, dif:0.2 });
    [[0,0],[2/cw,0],[0,2/ch],[2/cw,2/ch]].forEach(off => R3.draw(MESH.lines, { M:V.M, mode:1, zb:0.00025, off }));
  }
  const tag = $('#frontTag'), s = App.arrowAt && screenOf(App.arrowAt);
  tag.hidden = !s || App.step === 2 || App.step === 3; if (s){ tag.style.left = s[0] + 'px'; tag.style.top = s[1] + 'px'; }
}
function loop(){ render(); requestAnimationFrame(loop); }

/* ---------- camera input ---------- */
const ptrs = new Map();
viewC.addEventListener('contextmenu', e => e.preventDefault());
viewC.addEventListener('pointerdown', e => {
  viewC.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; App.drag = { kind:'pinch', d: Math.hypot(a.x-b.x, a.y-b.y), m:[(a.x+b.x)/2, (a.y+b.y)/2], dist: App.cam.dist, tgt: App.cam.tgt.slice() }; return; }
  const pan = e.button === 2 || e.button === 1 || e.shiftKey;
  App.drag = { x0:e.clientX, y0:e.clientY, kind: pan ? 'pan' : 'orbit', tgt: App.cam.tgt.slice(), yaw:App.cam.yaw, pitch:App.cam.pitch };
});
viewC.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  const d = App.drag; if (!d) return;
  if (d.kind === 'pinch' && ptrs.size === 2){ const [a, b] = [...ptrs.values()], dd = Math.hypot(a.x-b.x, a.y-b.y), m = [(a.x+b.x)/2, (a.y+b.y)/2];
    App.cam.dist = clamp(d.dist*d.d/Math.max(20, dd), 6, 160); const B = camBasis(), k = App.cam.dist*0.0016;
    App.cam.tgt = add(d.tgt, add(mul(B.r, -(m[0]-d.m[0])*k), mul(B.u, (m[1]-d.m[1])*k))); App.dirty = true; return; }
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (d.kind === 'orbit'){ App.cam.yaw = d.yaw - dx*0.008; App.cam.pitch = clamp(d.pitch + dy*0.006, 4*D2R, 88*D2R); }
  else if (d.kind === 'pan'){ const B = camBasis(), k = App.cam.dist*0.0016; App.cam.tgt = add(d.tgt, add(mul(B.r, -dx*k), mul(B.u, dy*k))); }
  App.dirty = true;
});
const endDrag = e => { ptrs.delete(e.pointerId); App.drag = null; };
viewC.addEventListener('pointerup', endDrag); viewC.addEventListener('pointercancel', endDrag);
viewC.addEventListener('wheel', e => { e.preventDefault(); App.cam.dist = clamp(App.cam.dist*Math.exp(e.deltaY*0.0012), 6, 160); App.dirty = true; }, { passive:false });
window.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select')) return; if (e.key === 'f' || e.key === 'F') frameAll(); });

/* ---------- step 1: sliders ---------- */
const CTL = [];
function slider(host, key, label, fmt){
  const [a, b, st] = LIM[key], d = document.createElement('div'); d.className = 'sl';
  d.innerHTML = `<label>${label}<output></output></label><input type="range" min="${a}" max="${b}" step="${st}">`;
  const inp = d.querySelector('input'), out = d.querySelector('output'), f = fmt || (v => v);
  inp.oninput = () => { setParams({ [key]: +inp.value }); out.textContent = f(S.p[key]); };
  d.sync = () => { inp.value = S.p[key]; out.textContent = f(S.p[key]); };
  host.appendChild(d); CTL.push(d); return d;
}
const u = v => `${v} m`;
slider($('#bldCtls'), 'w', 'Width', u); slider($('#bldCtls'), 'd', 'Depth', u); slider($('#bldCtls'), 'h', 'Wall height', u);
slider($('#bldCtls'), 'base', 'Foundation', v => v ? u(v) : 'none');
const rhCtl = slider($('#roofCtls'), 'rh', 'Roof height', u);
slider($('#dwCtls'), 'floors', 'Floors'); slider($('#dwCtls'), 'wf', 'Front windows per floor'); slider($('#dwCtls'), 'ws', 'Side windows per floor'); slider($('#dwCtls'), 'wb', 'Back windows per floor');
function seg(host, items, key){ host.innerHTML = Object.entries(items).map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('');
  host.querySelectorAll('button').forEach(b => b.onclick = () => setParams({ [key]: b.dataset.v })); }
seg($('#roofSeg'), ROOFS, 'roof'); seg($('#doorSeg'), DOORS, 'door');
$$('#ridgeSeg button').forEach(b => b.onclick = () => setParams({ ridge: b.dataset.v }));
$('#door2').onchange = e => setParams({ door2: e.target.checked }); $('#backDoor').onchange = e => setParams({ backDoor: e.target.checked });
$('#key').innerHTML = ROLE_KEYS.map(k => `<span><i style="background:rgb(${ROLES[k].col})"></i>${ROLES[k].label}</span>`).join('') + MARK_KEYS.map(k => `<span><i style="background:rgb(${MARKS[k].col})"></i>${MARKS[k].label}s</span>`).join('');
Object.entries(PRESETS).forEach(([k, p]) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.label; b.onclick = () => loadPreset(k); $('#presetChips').appendChild(b); });
function loadPreset(k){ const P = PRESETS[k]; S.p = { ...DEF }; setParams({ ...P.p, desc: P.desc }); App.prompt = null; frameAll(); }
App.onChange = () => { buildArrow(); updateUI(); };

/* ---------- steps ---------- */
$$('#steps button').forEach(b => b.onclick = () => goStep(+b.dataset.step));
$('#toPaint').onclick = () => goStep(2);
$('#toFinish').onclick = () => goStep(4);
$('#backBuild').onclick = () => goStep(1);
function canGo(n){ if (n >= 3 && !AL.img) return false; if (n === 4 && AL.geo !== S.geoVer) return false; return true; }
function goStep(n){
  if (!canGo(n)){ if (!AL.img) toast("Paste Gemini's picture first"); else toast('The building changed since that picture: make a new one'); return; }
  App.step = n; App.mode = n === 4 ? 'tex' : 'edit';
  $('#sheetWrap').hidden = !(n === 2 || n === 3); viewC.style.visibility = n === 2 || n === 3 ? 'hidden' : ''; $('#viewBtns').hidden = n === 2 || n === 3;
  $$('.panel').forEach(p => p.hidden = +p.dataset.for !== n);
  if (n === 2) enterPaint(); if (n === 3) drawSheet(); if (n === 4) enterFinish();
  App.dirty = true; updateUI();
}
function updateUI(){
  $$('#steps button').forEach(b => { const s = +b.dataset.step; b.classList.toggle('on', s === App.step); b.disabled = !canGo(s); });
  $('#hint').textContent = App.step === 4 ? 'Drag to look around · scroll to zoom' : 'Drag to orbit · right-drag to pan · scroll to zoom'; $('#hint').hidden = App.step === 2 || App.step === 3;
  CTL.forEach(c => c.sync());
  $$('#roofSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.p.roof));
  $$('#doorSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.p.door));
  $$('#ridgeSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.p.ridge));
  const dir = S.p.roof === 'gable' || S.p.roof === 'shed'; $('#ridgeRow').hidden = !dir;
  $('#ridgeLbl').textContent = S.p.roof === 'shed' ? 'Slopes down toward' : 'Ridge runs';
  const rb = $$('#ridgeSeg button'); rb[0].textContent = S.p.roof === 'shed' ? 'The front' : 'Left to right'; rb[1].textContent = S.p.roof === 'shed' ? 'The right side' : 'Front to back';
  rhCtl.querySelector('label').firstChild.textContent = S.p.roof === 'flat' ? 'Roof thickness' : 'Roof height';
  $('#door2').checked = S.p.door2; $('#backDoor').checked = S.p.backDoor;
}
$('#frameBtn').onclick = frameAll;
$('#personBtn').onclick = () => { App.person = !App.person; $('#personBtn').classList.toggle('on', App.person); App.dirty = true; };
$('#personBtn').classList.add('on');
$('#frontBtn').onclick = () => { App.cam.yaw = 45*D2R; App.cam.pitch = 25*D2R; App.dirty = true; };
$('#helpBtn').onclick = () => $('#help').showModal(); $('#helpClose').onclick = () => $('#help').close();
window.addEventListener('resize', () => { App.dirty = true; });

/* ---------- step 2: paint ---------- */
const sheet = $('#sheet'), sx = sheet.getContext('2d');
$('#look').innerHTML = Object.entries(LOOKS).map(([k, l]) => `<option value="${k}">${l.label}</option>`).join('');
function enterPaint(){
  buildReference(); sx.drawImage(REF.white, 0, 0); sheet.classList.remove('drag');
  $('#desc').value = S.desc; $('#look').value = S.look;
  if (App.prompt == null) $('#prompt').value = buildPrompt();
  const w = $('#covWarn'); w.className = REF.hidden ? 'warn' : ''; w.innerHTML = REF.hidden ? `<b>${REF.hidden} surface${REF.hidden > 1 ? 's are' : ' is'} mostly hidden from both cameras</b> and will borrow the texture of a similar surface.` : '';
}
function promptChanged(){ save(); if (App.prompt == null) $('#prompt').value = buildPrompt(); }
$('#desc').oninput = e => { S.desc = e.target.value; promptChanged(); };
$('#look').onchange = e => { S.look = e.target.value; promptChanged(); };
$('#prompt').oninput = e => { App.prompt = e.target.value; };
$('#resetPrompt').onclick = () => { App.prompt = null; $('#prompt').value = buildPrompt(); };
const promptText = () => App.prompt != null ? App.prompt : buildPrompt();
$('#copyPrompt').onclick = () => copyText(promptText(), 'Prompt copied');
const refBlob = () => new Promise(r => { buildReference(); REF.white.toBlob(r, 'image/png'); });
$('#copyPic').onclick = async () => {
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': refBlob() })]); toast('Picture copied'); }
  catch (e) { toast("This browser won't copy pictures here: use Download and attach it in Gemini"); }
};
function downloadBlob(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const slug = () => bname().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'building';
$('#dlPic').onclick = async () => downloadBlob(await refBlob(), `${slug()}-reference.png`);

/* ---------- picture in: paste, drop, upload ---------- */
const fileIn = $('#file');
$('#drop').onclick = () => fileIn.click(); $('#newPic').onclick = () => fileIn.click();
fileIn.onchange = () => { if (fileIn.files[0]) loadFile(fileIn.files[0]); fileIn.value = ''; };
const dz = $('#drop'); dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', () => dz.classList.remove('over'));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/')); if (f) loadFile(f); });
window.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('textarea,input')) { const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (!it) return; }
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (it){ e.preventDefault(); loadFile(it.getAsFile()); }
});
function loadImageURL(url){ return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error("Couldn't read that picture")); im.src = url; }); }
async function loadFile(f){ const url = URL.createObjectURL(f); try { await usePicture(await loadImageURL(url)); } catch (e) { toast(e.message); } }
async function usePicture(img){
  setImage(img); BK.raw = null; BK.out = null; AL.ver = (AL.ver || 0) + 1;
  goStep(3);
  toast(AL.match > 0.88 ? 'Lined up' : AL.match > 0.75 ? 'Best guess: check the outlines' : "That doesn't match the reference well");
  return AL.match;
}

/* ---------- step 3: line up ---------- */
const ALS = [];
function alSlider(label, key, min, max, step, fmt){
  const d = document.createElement('div'); d.className = 'sl'; d.innerHTML = `<label>${label}<output></output></label><input type="range" min="${min}" max="${max}" step="${step}">`;
  const inp = d.querySelector('input'), out = d.querySelector('output');
  const tgt = () => AL.target === 'both' ? [0,1] : [+AL.target];
  let base = null;
  inp.addEventListener('pointerdown', () => base = null);
  inp.oninput = () => { const v = +inp.value, ts = tgt(), cur = AL.a[ts[0]][key]; ts.forEach(i => AL.a[i][key] = key === 's' || key === 'k' ? AL.a[i][key]*(v/cur) : AL.a[i][key] + (v - cur)); alChanged(); out.textContent = fmt(v); };
  d.sync = () => { const v = AL.a[tgt()[0]][key]; inp.value = v; out.textContent = fmt(v); };
  $('#alignCtls').appendChild(d); ALS.push(d);
}
alSlider('Horizontal', 'dx', -300, 300, 0.5, v => `${(+v).toFixed(1)} px`);
alSlider('Vertical', 'dy', -300, 300, 0.5, v => `${(+v).toFixed(1)} px`);
alSlider('Scale', 's', 0.5, 2, 0.002, v => `${(v*100).toFixed(1)}%`);
alSlider('Width', 'k', 0.85, 1.18, 0.001, v => `${(v*100).toFixed(1)}%`);
$$('#target button').forEach(b => b.onclick = () => { AL.target = b.dataset.t; $$('#target button').forEach(o => o.classList.toggle('on', o === b)); ALS.forEach(s => s.sync()); });
$$('#overlay button').forEach(b => b.onclick = () => { AL.overlay = b.dataset.m; $$('#overlay button').forEach(o => o.classList.toggle('on', o === b)); drawSheet(); });
$('#ovA').value = AL.alpha; $('#ovOut').textContent = Math.round(AL.alpha*100) + '%';
$('#ovA').oninput = e => { AL.alpha = +e.target.value; $('#ovOut').textContent = Math.round(AL.alpha*100) + '%'; drawSheet(); };
$('#autoAlign').onclick = () => { autoAlign(); alChanged(); toast(AL.match > 0.88 ? 'Lined up' : 'Best guess: check the outlines'); };
$('#resetAlign').onclick = () => { AL.a = [{dx:0,dy:0,s:1,k:1},{dx:0,dy:0,s:1,k:1}]; alChanged(); };
let mT = 0;
function alChanged(){ AL.ver = (AL.ver || 0) + 1; drawSheet(); clearTimeout(mT); mT = setTimeout(() => { updateMatch(); showMatch(); }, 50); }
function showMatch(){ const v = AL.match, b = $('#match'); b.className = 'badge ' + (v > 0.88 ? 'good' : v > 0.75 ? 'ok' : 'bad');
  b.textContent = `Silhouette match ${(v*100).toFixed(1)}%` + (v > 0.88 ? '' : v > 0.75 ? ' · check the edges' : ' · needs adjusting'); }
function drawSheet(){
  if (App.step === 2){ sx.drawImage(REF.white, 0, 0); return; }
  if (App.step !== 3) return;
  sheet.classList.add('drag'); $('#geoWarn').hidden = AL.geo === S.geoVer;
  sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.drawImage(alignedCanvas(), 0, 0);
  const a = AL.alpha;
  if (AL.overlay === 'outline'){ sx.globalAlpha = a; sx.drawImage(REF.edges, 0, 0); }
  else if (AL.overlay === 'ghost'){ sx.globalAlpha = a*0.6; sx.drawImage(REF.white, 0, 0); }
  else { sx.globalAlpha = a; sx.globalCompositeOperation = 'difference'; sx.drawImage(REF.white, 0, 0); }
  sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over';
  ALS.forEach(s => s.sync()); showMatch();
}
(() => {
  let d = null;
  const scale = () => RW / sheet.getBoundingClientRect().width;
  const tgts = x => AL.target === 'both' ? [0,1] : [+AL.target];
  sheet.addEventListener('pointerdown', e => { if (App.step !== 3) return; sheet.setPointerCapture(e.pointerId); d = { x:e.clientX, y:e.clientY, a: AL.a.map(o => ({ ...o })) }; });
  sheet.addEventListener('pointermove', e => { if (!d) return; const k = scale(); tgts().forEach(i => { AL.a[i].dx = d.a[i].dx + (e.clientX - d.x)*k; AL.a[i].dy = d.a[i].dy + (e.clientY - d.y)*k; }); alChanged(); });
  sheet.addEventListener('pointerup', () => d = null);
  sheet.addEventListener('wheel', e => { if (App.step !== 3) return; e.preventDefault(); tgts().forEach(i => AL.a[i].s = clamp(AL.a[i].s*Math.exp(-e.deltaY*0.0006), 0.4, 2.5)); alChanged(); }, { passive:false });
})();

/* ---------- step 4: finish ---------- */
Object.entries(FX_PRESETS).forEach(([k, p]) => { const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k; b.textContent = p.label; b.onclick = () => { BK.look = k; refinish(); }; $('#lookChips').appendChild(b); });
$('#deshade').value = BK.deshade; $('#dsOut').textContent = Math.round(BK.deshade*100) + '%';
$('#deshade').oninput = e => { $('#dsOut').textContent = Math.round(e.target.value*100) + '%'; };
$('#deshade').onchange = e => { BK.deshade = +e.target.value; BK.raw = null; enterFinish(); };
$('#bevel').onchange = e => { BK.bevel = e.target.checked; refinish(); };
$('#texSize').onchange = e => { BK.size = +e.target.value; BK.raw = null; enterFinish(); };
function syncFinishUI(){ $$('#lookChips .chip').forEach(b => b.classList.toggle('on', b.dataset.k === BK.look)); $('#bevel').checked = BK.bevel; $('#texSize').value = BK.size; }
function busy(on){ $('#busy').hidden = !on; }
function enterFinish(){
  syncFinishUI();
  if (!AL.img || AL.geo !== S.geoVer){ $('#bakeWarn').hidden = false; $('#bakeWarn').textContent = 'Paint and line up a picture first.'; return Promise.resolve(); }
  $('#bakeWarn').hidden = true;
  if (BK.raw && BK.raw.geo === S.geoVer && BK.raw.al === AL.ver && BK.raw.S === BK.size && TEXGL){ App.dirty = true; return Promise.resolve(); }
  busy(true);
  return new Promise(res => setTimeout(() => { try { const raw = bakeRaw(); raw.al = AL.ver; refinish(); } catch (e) { toast(e.message); } busy(false); res(); }, 30));
}
function refinish(){
  syncFinishUI(); if (!BK.raw) return;
  const o = finishBake();
  if (TEXGL){ R3.free(TEXGL.mesh); gl.deleteTexture(TEXGL.col); gl.deleteTexture(TEXGL.nrm); }
  TEXGL = { mesh: R3.mesh(o.g), col: R3.tex(o.col, { nearest:o.nearest, mip:true }), nrm: R3.tex(o.nrm, { mip:true }) };
  App.dirty = true;
}
$('#dlGlb').onclick = async () => { try { const { bytes, name } = await makeGLB(); downloadBlob(new Blob([bytes], { type:'model/gltf-binary' }), `${name}.glb`); toast(`${name}.glb downloaded`); } catch (e) { toast(e.message); } };
$('#dlTex').onclick = () => BK.out && BK.out.col.toBlob(b => downloadBlob(b, `${slug()}-color.png`));
$('#dlNrm').onclick = () => BK.out && BK.out.nrm.toBlob(b => downloadBlob(b, `${slug()}-normal.png`));
$('#dlCode').onclick = () => downloadBlob(new Blob([JSON.stringify(sceneJSON(), null, 2)], { type:'application/json' }), `${slug()}.json`);
