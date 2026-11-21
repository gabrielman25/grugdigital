/* Exports pieces of the site's UGC catalog (labs/catalog/) for the Clothing Studio's Character tab, fitted to the Studio's
   rounded "Roblox" head and its Figure feet.

     node tools/ugc/export.js [count per department]        (the repo served on http://127.0.0.1:8791)

   How: the catalog page is opened in headless Chrome. Her head mesh is swapped for a rounded cylinder shaped like the
   Studio's head (in her head's own frame, eyes at the same height), so every head piece (glasses and goggles, hair,
   headphones and earmuffs) is built by the catalog's own fitting code around THAT head. Each piece is merged into one mesh
   with one texture (the catalog's bakeSingle, the same as its downloads), then moved into the Studio's units:
     head pieces: head frame -> studs (head 1.3 wide, y 4 to 5.25, front +z), drawn on the head;
     sandals:     her posed feet -> the Figure's feet (make/clothing/body/feet.json), one per foot, flat soles only.
   Nothing here changes the Studio's body: the pieces are separate meshes.
   Writes make/clothing/ugc/index.json and one <id>.json (geometry, base64) + <id>.png (texture) + <id>-thumb.png each. */
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), '/home/claude/test'] }));
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'make/clothing/ugc'), N = +(process.argv[2] || 10);

const PAGE = async ({ N }) => {
  const G = window.GrugCatalog, { GE, J, sandy } = G, n3 = sandy.n3, hg = n3.headGroup, V = THREE.Vector3;
  sandy.object3d.updateMatrixWorld(true);
  const hm0 = GE.headModel(sandy);
  // ---- the Studio's head, in her head frame: radius Rh, height H (1.25 / 1.3 of its width), eyes 64% of the way up
  const Rh = 11.6, H = 2 * Rh * 1.25 / 1.3, yb = hm0.eyeY - 0.64 * H, cz = hm0.c.z, rr = Rh * 0.28, prof = [];
  prof.push(new THREE.Vector2(0.001, yb));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; prof.push(new THREE.Vector2(Rh - rr + Math.cos(a) * rr, yb + rr + Math.sin(a) * rr)); }
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; prof.push(new THREE.Vector2(Rh - rr + Math.cos(a) * rr, yb + H - rr + Math.sin(a) * rr)); }
  prof.push(new THREE.Vector2(0.001, yb + H));
  const cyl = new THREE.LatheGeometry(prof, 32); cyl.translate(0, 0, cz);
  const head = n3.headMesh; head.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(hg.matrixWorld); cyl.applyMatrix4(toLocal);
  const g0 = head.geometry; head.geometry = cyl;
  const hm = GE.headModel(sandy);
  // the hair department again, measured on this head (no face mesh: it sticks out past the cylinder)
  const face0 = n3.faceMesh; n3.faceMesh = null; let HD2 = null;
  try { HD2 = window.GrugCatalogHair({ sandy, scene: G.scene, renderer: G.renderer }); } catch (e) { console.warn('hair', e); }
  n3.faceMesh = face0;
  const headToStud = 0.65 / Rh, studOf = p => [p.x * headToStud, 4 + (p.y - yb) * headToStud, (p.z - cz) * headToStud];

  // ---- a little renderer for the card pictures
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setSize(160, 160); tr.outputEncoding = THREE.sRGBEncoding;
  const ts = new THREE.Scene(); ts.add(new THREE.HemisphereLight(0xffffff, 0x666670, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(-0.4, 1, 0.8); ts.add(dl);
  const tc = new THREE.PerspectiveCamera(26, 1, 0.1, 1000);
  function thumb(mesh, back) { const g = new THREE.Group(); g.add(mesh.clone()); ts.add(g); const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new V()), s = b.getSize(new V()).length();
    const dir = new V(back ? 0.5 : -0.55, 0.35, back ? -1 : 1).normalize(); tc.position.copy(c).addScaledVector(dir, s * 1.9); tc.lookAt(c); tr.setClearColor(0x000000, 0); tr.render(ts, tc);
    const url = tr.domElement.toDataURL('image/png'); ts.remove(g); return url; }

  // ---- merge a built piece into one mesh + one texture, in a frame given by `toFrame` (a Matrix4 from the world)
  function grab(root, toFrame, conv) {
    root.updateMatrixWorld(true); const baked = GE.bakeSingle(root, 1024); let mesh = null; baked.traverse(o => { if (o.isMesh) mesh = o; }); if (!mesh) return null;
    const M = new THREE.Matrix4().multiplyMatrices(toFrame, root.matrixWorld), NM = new THREE.Matrix3().getNormalMatrix(M), g = mesh.geometry, P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv;
    const pos = [], nrm = [], uv = [], v = new V();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(M); pos.push(...conv(v)); v.fromBufferAttribute(Nn, i).applyMatrix3(NM).normalize(); nrm.push(v.x, v.y, v.z); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: P.count }, (_, i) => i), m = mesh.material, cv = m.map && (m.map.userData.canvas || m.map.image);
    const tex = cv ? (cv.toDataURL ? cv.toDataURL('image/png') : null) : null;
    return { pos, nrm, uv, idx, tex, alpha: m.alphaTest > 0 ? 'mask' : m.transparent ? 'blend' : null, verts: P.count, baked: mesh };
  }
  const toHead = new THREE.Matrix4().copy(hg.matrixWorld).invert();
  const out = [], seen = new Set(), add = (it, dept, name, r, flipThumb) => { if (!r || !r.tex || r.verts > 65000 || seen.has(it.id)) return; seen.add(it.id); out.push({ id: it.id.replace(/[^a-z0-9]+/gi, '-'), dept, name, ...r, thumb: thumb(r.baked, flipThumb), baked: undefined }); };
  const all = G.allItems();
  // glasses and goggles
  for (const it of all.filter(i => !i.dept && i.d).slice(0, N)) { try { const b = GE.build(it.d, hm, { seed: it.seed }); hg.add(b.root); add(it, 'eyewear', it.name, grab(b.root, toHead, studOf)); hg.remove(b.root); b.dispose(); } catch (e) { console.warn('eyewear', it.id, e.message); } }
  // hair (the department measured on this head)
  if (HD2) { HD2.dress(true); const bases = new Set(); for (const it of HD2.styleItems()) { if (out.filter(o => o.dept === 'hair').length >= N) break; const base = it.base || it.id.split('-')[0]; if (bases.has(base)) continue; bases.add(base); try { const b = await HD2.live(it, 'low'); hg.add(b.root); add(it, 'hair', it.name, grab(b.root, toHead, studOf), true); hg.remove(b.root); b.dispose(); } catch (e) { console.warn('hair', it.id, e.message); } } }
  // headphones and earmuffs (no earbuds: their cords run down her body)
  for (const it of all.filter(i => i.dept === 'sound' && i.d && i.d.kind !== 'buds').slice(0, N)) { try { const d = Object.assign({}, it.d, { wired: false }); await J.prep('sound', d); const b = J.build('sound', d, { sandy, hm }); (b.frame === 'head' ? hg : G.scene).add(b.root); add(it, 'sound', it.name, grab(b.root, toHead, studOf)); b.root.parent.remove(b.root); b.dispose(); } catch (e) { console.warn('sound', it.id, e.message); } }
  // put her head back before the feet
  head.geometry = g0;
  // sandals: flat soles (no heel tilt), no slippers (they tuck her toes away)
  const sand = []; let feetBox = null;
  for (const it of all.filter(i => i.dept === 'sandals' && i.d && i.d.style !== 'slipper').slice(0, N)) {
    try { const d = Object.assign({}, it.d, { heelH: 0 }); await J.prep('sandals', d); const b = J.build('sandals', d, { sandy, hm: hm0 }); G.scene.add(b.root);
      if (!feetBox) { // her posed skin below the ankle, left foot (+x): the box the sandals were fitted to
        const SK = n3.__skinW, F = n3._foot[0], rig = new THREE.Matrix4().multiplyMatrices(F.fb.matrixWorld, F.toFoot), A = F.A.clone().applyMatrix4(rig), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (let k = 0; k < SK.n; k++) { const x = SK.pos[k * 3], y = SK.pos[k * 3 + 1], z = SK.pos[k * 3 + 2]; if (x <= 0 || y > A.y || Math.hypot(x - A.x, z - A.z) > 22) continue; const q = [x, y, z]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], q[a]); mx[a] = Math.max(mx[a], q[a]); } }
        feetBox = { mn, mx, ankle: A.toArray() }; }
      const r = grab(b.root, new THREE.Matrix4(), p => [p.x, p.y, p.z]); if (r) { r.world = true; } add(it, 'sandals', it.name, r);
      G.scene.remove(b.root); b.dispose(); } catch (e) { console.warn('sandals', it.id, e.message); } }
  return { items: out, feetBox, head: { Rh, H, yb, cz } };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 850 } }); const logs = [];
  p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8791/labs/catalog/'); await p.waitForFunction('window.GrugCatalog && window.GrugCatalog.sandy', null, { timeout: 180000 }); await p.waitForTimeout(5000);
  const res = await p.evaluate(PAGE, { N }); await b.close();
  // sandals: her feet -> the Figure's feet (feet.json: left foot, sole y 0, ankle cut y 0.423)
  const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'make/clothing/body/feet.json'))), FB = Buffer.from(FJ.pos, 'base64'), FP = new Float32Array(FB.buffer.slice(FB.byteOffset, FB.byteOffset + FB.length));
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < FP.length; i += 3) if (FP[i] > 0) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], FP[i + a]); mx[a] = Math.max(mx[a], FP[i + a]); }
  const fb = res.feetBox, map = fb ? [0, 1, 2].map(a => ({ s: (mx[a] - mn[a]) / (fb.mx[a] - fb.mn[a]), o: mn[a], f: fb.mn[a] })) : null;
  fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const index = [], b64 = (arr, T) => Buffer.from(new T(arr).buffer).toString('base64');
  for (const it of res.items) {
    let pos = it.pos;
    if (it.world) { if (!map) continue; pos = []; for (let i = 0; i < it.pos.length; i += 3) { const sx = Math.sign(it.pos[i]) || 1; const x = Math.abs(it.pos[i]); pos.push(sx * (map[0].o + (x - map[0].f) * map[0].s), map[1].o + (it.pos[i + 1] - map[1].f) * map[1].s, map[2].o + (it.pos[i + 2] - map[2].f) * map[2].s); } }
    const id = it.dept[0] + '-' + it.id, png = Buffer.from(it.tex.split(',')[1], 'base64'), th = Buffer.from(it.thumb.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, id + '.png'), png); fs.writeFileSync(path.join(OUT, id + '-thumb.png'), th);
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ pos: b64(pos, Float32Array), nrm: b64(it.nrm, Float32Array), uv: b64(it.uv, Float32Array), idx: b64(it.idx, Uint16Array), alpha: it.alpha }));
    index.push({ id, dept: it.dept, name: it.name, file: id + '.json', tex: id + '.png', thumb: id + '-thumb.png', verts: it.verts });
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  console.log(JSON.stringify({ n: index.length, byDept: index.reduce((a, x) => (a[x.dept] = (a[x.dept] || 0) + 1, a), {}), feet: !!map, logs: logs.slice(0, 12) }));
})();
