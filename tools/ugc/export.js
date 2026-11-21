/* Exports pieces of the site's UGC catalog (labs/catalog/) for the Clothing Studio's Character tab, fitted to the Studio's
   rounded "Roblox" head and its Figure feet.

     node tools/ugc/export.js [count per department] [catalog seed]     (the repo served on http://127.0.0.1:8791)
   Keep the seed (default grug-cd50gg): the example looks name pieces by id, and another seed makes other pieces.

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
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'make/clothing/ugc'), N = +(process.argv[2] || 10), SEED = process.argv[3] || 'grug-cd50gg';
// the catalog's random seed is fixed, so the same pieces (and ids: saved looks name them) come out every time

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
  const out = [], seen = new Set(), add = (it, dept, name, r, flipThumb) => { if (r && it.id && it.id.startsWith('kit-')) r.first = true; if (!r || !r.tex || r.verts > 65000 || seen.has(it.id)) return; seen.add(it.id); out.push({ id: it.id.replace(/[^a-z0-9]+/gi, '-'), dept, name, ...r, thumb: thumb(r.baked, flipThumb), baked: undefined }); };
  const all = G.allItems();
  // glasses and goggles
  for (const it of all.filter(i => !i.dept && i.d).slice(0, N)) { try { const b = GE.build(it.d, hm, { seed: it.seed }); hg.add(b.root); add(it, 'eyewear', it.name, grab(b.root, toHead, studOf)); hg.remove(b.root); b.dispose(); } catch (e) { console.warn('eyewear', it.id, e.message); } }
  // hair (the department measured on this head)
  if (HD2) { HD2.dress(true); const bases = new Set(); for (const it of HD2.styleItems()) { if (out.filter(o => o.dept === 'hair').length >= N) break; const base = it.base || it.id.split('-')[0]; if (bases.has(base)) continue; bases.add(base); try { const b = await HD2.live(it, 'low'); hg.add(b.root); add(it, 'hair', it.name, grab(b.root, toHead, studOf), true); hg.remove(b.root); b.dispose(); } catch (e) { console.warn('hair', it.id, e.message); } } }
  // her stock hairstyles (the classic kit's long hair and buns, the best-looking ones), in a few colours: made for her head,
  // so every point that would sit inside the Studio's head (or closer than 0.5) is pushed out along the head's surface normal
  const sdf = p => { const q = [Math.hypot(p.x, p.z - cz) - (Rh - rr), Math.abs(p.y - (yb + H / 2)) - (H / 2 - rr)]; return Math.min(Math.max(q[0], q[1]), 0) + Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0)) - rr; };
  const pushOut = (v, gap) => { for (let it = 0; it < 6; it++) { const d = sdf(v); if (d >= gap) return; const e = 0.05, g = new V(sdf(new V(v.x + e, v.y, v.z)) - sdf(new V(v.x - e, v.y, v.z)), sdf(new V(v.x, v.y + e, v.z)) - sdf(new V(v.x, v.y - e, v.z)), sdf(new V(v.x, v.y, v.z + e)) - sdf(new V(v.x, v.y, v.z - e))).normalize(); v.addScaledVector(g, gap - d); } };
  // seat it on the Studio's head: her skull and this head differ (hers is bigger on top), so a point is moved along the ray
  // from this head's centre by (this head's radius - her skull's radius) there: it keeps its height above the scalp, and
  // the hairline sits on the head instead of floating. Below the jaw (hanging lengths) the shift eases to the one at ear level.
  const C = new V(0, yb + H / 2, cz), SEAT = new Map(), _p = new V();
  const along = (inside, dir) => { let lo = 0, hi = 40; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; _p.copy(C).addScaledVector(dir, m); if (inside(_p)) lo = m; else hi = m; } return (lo + hi) / 2; };
  const shiftAt = dir => { const k = Math.round(Math.atan2(dir.x, dir.z) * 40) + ',' + Math.round(dir.y * 40); let d = SEAT.get(k); if (d === undefined) { d = along(q => sdf(q) < 0, dir) - along(q => hm0.clearance(q) < 0, dir); SEAT.set(k, d); } return d; };
  const _dir = new V(), _lvl = new V();
  const seat = v => { _dir.subVectors(v, C); const l = _dir.length(); if (l < 1e-6) return; _dir.multiplyScalar(1 / l);
    let d; if (_dir.y >= -0.25) d = shiftAt(_dir); else { _lvl.set(_dir.x, -0.25, _dir.z); const h = Math.hypot(_lvl.x, _lvl.z) || 1; _lvl.x *= Math.sqrt(1 - 0.0625) / h; _lvl.z *= Math.sqrt(1 - 0.0625) / h; d = shiftAt(_lvl); }
    v.addScaledVector(_dir, d); };
  if (n3.hairMesh && n3.setHairStyle) {
    const hm0m = n3.hairMesh, st0 = n3.hairStyle, mat0 = hm0m.material, vis0 = hm0m.visible, map0 = (Array.isArray(mat0) ? mat0[0] : mat0).map;
    for (const [kit, kname] of [[0, 'Classic long hair'], [1, 'Classic buns']]) for (const [cname, hex] of [['dark brown', '#2a1a12'], ['black', '#141416'], ['honey blonde', '#b8874a'], ['auburn', '#6e2a17']]) {
      try { n3.setHairStyle(kit); hm0m.visible = true; sandy.object3d.updateMatrixWorld(true);
        const g = hm0m.geometry.clone(), M = new THREE.Matrix4().multiplyMatrices(toHead, hm0m.matrixWorld); g.applyMatrix4(M);
        const P = g.attributes.position, v = new V(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); seat(v); pushOut(v, 0.5); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ map: map0, color: new THREE.Color(hex).convertSRGBToLinear(), side: THREE.DoubleSide, roughness: 0.75 });
        const root = new THREE.Group(); root.add(new THREE.Mesh(g, mat)); hg.add(root);
        add({ id: 'kit-' + kit + '-' + cname }, 'hair', kname + ' (' + cname + ')', grab(root, toHead, studOf), true); hg.remove(root); g.dispose(); mat.dispose();
      } catch (e) { console.warn('kit hair', kit, e.message); } }
    n3.setHairStyle(st0); hm0m.material = mat0; hm0m.visible = vis0;
  }
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
      const r = grab(b.root, new THREE.Matrix4(), p => [p.x, p.y, p.z]);
      if (r) { r.world = true; const SK = n3.__skinW, Fa = [0, 1].map(i => { const F = n3._foot[i], rig = new THREE.Matrix4().multiplyMatrices(F.fb.matrixWorld, F.toFoot); return F.A.clone().applyMatrix4(rig); });
        const ids = [[], []]; for (let k = 0; k < SK.n; k++) { const x = SK.pos[k * 3], y = SK.pos[k * 3 + 1], z = SK.pos[k * 3 + 2]; for (let i = 0; i < 2; i++) { const A = Fa[i]; if (Math.sign(x) === Math.sign(A.x) && y < A.y + 30 && Math.hypot(x - A.x, z - A.z) < 22) ids[i].push(k); } }
        // a smooth spot on her skin under each vertex: the 8 nearest skin points, weighted (one nearest point would make steps)
        r.skin = []; for (let i = 0; i < r.pos.length; i += 3) { const x = r.pos[i], y = r.pos[i + 1], z = r.pos[i + 2], L = ids[Fa[0].x * x > 0 ? 0 : 1], best = [];
          for (const k of L) { const d = (SK.pos[k * 3] - x) ** 2 + (SK.pos[k * 3 + 1] - y) ** 2 + (SK.pos[k * 3 + 2] - z) ** 2; if (best.length < 8 || d < best[best.length - 1][0]) { best.push([d, k]); best.sort((a, b) => a[0] - b[0]); if (best.length > 8) best.pop(); } }
          let ws = 0; const S = [0, 0, 0], Nn = [0, 0, 0]; for (const [d, k] of best) { const w = 1 / (Math.sqrt(d) + 0.3); ws += w; for (let a = 0; a < 3; a++) { S[a] += SK.pos[k * 3 + a] * w; Nn[a] += SK.nrm[k * 3 + a] * w; } }
          for (let a = 0; a < 3; a++) S[a] /= ws; const nl = Math.hypot(...Nn) || 1, dd = ((x - S[0]) * Nn[0] + (y - S[1]) * Nn[1] + (z - S[2]) * Nn[2]) / nl;
          r.skin.push(+S[0].toFixed(3), +S[1].toFixed(3), +S[2].toFixed(3), +dd.toFixed(3)); } }
      add(it, 'sandals', it.name, r);
      G.scene.remove(b.root); b.dispose(); } catch (e) { console.warn('sandals', it.id, e.message); } }
  return { items: out, feetBox, head: { Rh, H, yb, cz } };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 850 } }); const logs = [];
  await p.addInitScript(seed => { try { localStorage.setItem('grug.eyewear.catalog.v1', JSON.stringify(seed)); } catch (e) {} }, SEED);
  p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 700)); });
  await p.goto('http://127.0.0.1:8791/labs/catalog/'); await p.waitForFunction('window.GrugCatalog && window.GrugCatalog.sandy', null, { timeout: 180000 }); await p.waitForTimeout(5000);
  const res = await p.evaluate(PAGE, { N }); await b.close();
  // sandals: her feet -> the Figure's feet (feet.json: left foot, sole y 0, ankle cut y 0.423)
  const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'make/clothing/body/feet.json'))), FB = Buffer.from(FJ.pos, 'base64'), FP = new Float32Array(FB.buffer.slice(FB.byteOffset, FB.byteOffset + FB.length));
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < FP.length; i += 3) if (FP[i] > 0) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], FP[i + a]); mx[a] = Math.max(mx[a], FP[i + a]); }
  const fb = res.feetBox, map = fb ? [0, 1, 2].map(a => ({ s: (mx[a] - mn[a]) / (fb.mx[a] - fb.mn[a]), o: mn[a], f: fb.mn[a] })) : null;
  fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const index = [], b64 = (arr, T) => Buffer.from(new T(arr).buffer).toString('base64');
  // the Figure's left foot: its points and normals (for snugging straps) and its footprint (for the soles)
  const NB = Buffer.from(FJ.nrm, 'base64'), FN = new Float32Array(NB.buffer.slice(NB.byteOffset, NB.byteOffset + NB.length)), foot = [];
  for (let i = 0; i < FP.length; i += 3) if (FP[i] > 0) foot.push([FP[i], FP[i + 1], FP[i + 2], FN[i], FN[i + 1], FN[i + 2]]);
  const fc = [0, 2].map(a => foot.reduce((s, f) => s + f[a], 0) / foot.length), NBIN = 72, footR = new Float32Array(NBIN);
  for (const f of foot) { if (f[1] > 0.12) continue; const a = Math.atan2(f[2] - fc[1], f[0] - fc[0]), b = Math.floor(((a / (2 * Math.PI)) % 1 + 1) % 1 * NBIN); footR[b] = Math.max(footR[b], Math.hypot(f[0] - fc[0], f[2] - fc[1])); }
  const smooth = R => { for (let pass = 0; pass < 3; pass++) { const Q = R.slice(); for (let i = 0; i < NBIN; i++) R[i] = Math.max(Q[i], (Q[(i + 1) % NBIN] + Q[(i + NBIN - 1) % NBIN]) / 2); } return R; };
  smooth(footR);
  const ms = map ? (map[0].s + map[1].s + map[2].s) / 3 : 1, toFootSpace = (x, y, z) => { const sx = Math.sign(x) || 1, ax = Math.abs(x); return [sx * (map[0].o + (ax - map[0].f) * map[0].s), map[1].o + (y - map[1].f) * map[1].s, map[2].o + (z - map[2].f) * map[2].s]; };
  for (const it of res.items) {
    let pos = it.pos;
    if (it.world) { if (!map) continue; pos = [];
      for (let i = 0; i < it.pos.length; i += 3) pos.push(...toFootSpace(it.pos[i], it.pos[i + 1], it.pos[i + 2]));
      // the sole: widened round its outline wherever the Figure's foot is bigger (the heels), by angle round the footprint
      const solR = new Float32Array(NBIN), ang = (x, z) => Math.floor(((Math.atan2(z - fc[1], Math.abs(x) - fc[0]) / (2 * Math.PI)) % 1 + 1) % 1 * NBIN);
      for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] <= 0.02) { const b = ang(pos[i], pos[i + 2]); solR[b] = Math.max(solR[b], Math.hypot(Math.abs(pos[i]) - fc[0], pos[i + 2] - fc[1])); }
      smooth(solR);
      for (let i = 0; i < pos.length; i += 3) { if (pos[i + 1] > 0.02) continue; const b = ang(pos[i], pos[i + 2]), f = solR[b] > 0.05 ? Math.max(1, (footR[b] + 0.035) / solR[b]) : 1, sx = Math.sign(pos[i]) || 1;
        pos[i] = sx * (fc[0] + (Math.abs(pos[i]) - fc[0]) * f); pos[i + 2] = fc[1] + (pos[i + 2] - fc[1]) * f; }
      // the straps (and their buckles, charms): moved onto the Figure's foot at the same height above the skin as on hers
      if (it.skin) for (let i = 0, k = 0; i < pos.length; i += 3, k += 4) { if (pos[i + 1] <= 0.02) continue;
        const sx = Math.sign(pos[i]) || 1, S = toFootSpace(it.skin[k], it.skin[k + 1], it.skin[k + 2]), d = Math.max(0.012, it.skin[k + 3] * ms), q = [Math.abs(S[0]), S[1], S[2]];
        const nb = []; for (const f of foot) { const dd = (f[0] - q[0]) ** 2 + (f[1] - q[1]) ** 2 + (f[2] - q[2]) ** 2; if (nb.length < 10 || dd < nb[nb.length - 1][0]) { nb.push([dd, f]); nb.sort((a, b) => a[0] - b[0]); if (nb.length > 10) nb.pop(); } }
        if (!nb.length || S[1] > 0.6) continue;   // up the leg: left as it is (the pants cut it off in the Studio)
        let ws = 0; const best = [0, 0, 0, 0, 0, 0]; for (const [dd, f] of nb) { const wt = 1 / (Math.sqrt(dd) + 0.02); ws += wt; for (let a = 0; a < 6; a++) best[a] += f[a] * wt; }
        for (let a = 0; a < 6; a++) best[a] /= ws; { const l = Math.hypot(best[3], best[4], best[5]) || 1; best[3] /= l; best[4] /= l; best[5] /= l; }
        // the weighted spot sits a touch inside a curved surface: lift it back out to the nearest point's height along the normal
        { const f0 = nb[0][1], lift = Math.max(0, (f0[0] - best[0]) * best[3] + (f0[1] - best[1]) * best[4] + (f0[2] - best[2]) * best[5]); best[0] += best[3] * lift; best[1] += best[4] * lift; best[2] += best[5] * lift; }
        const w = Math.min(1, Math.max(0, (pos[i + 1] - 0.02) / 0.05));   // ease in just above the sole so the straps stay joined to it
        const nx = [best[0] + best[3] * d, best[1] + best[4] * d, best[2] + best[5] * d];
        pos[i] = sx * (Math.abs(pos[i]) * (1 - w) + nx[0] * w); pos[i + 1] = pos[i + 1] * (1 - w) + nx[1] * w; pos[i + 2] = pos[i + 2] * (1 - w) + nx[2] * w; }
    }
    let nrm = it.nrm, uv = it.uv, idx = it.idx;
    if (it.dept === 'sound') {   // headphones and earmuffs: made exactly symmetric (her left half, mirrored), so the band is even
      const P2 = [], N2 = [], U2 = [], I2 = [], vmap = new Map(), addV = (v, m) => { const key = v * 2 + (m ? 1 : 0); if (vmap.has(key)) return vmap.get(key); const j = P2.length / 3;
        P2.push(m ? -pos[v * 3] : pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N2.push(m ? -nrm[v * 3] : nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); U2.push(uv[v * 2], uv[v * 2 + 1]); vmap.set(key, j); return j; };
      for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (pos[a * 3] + pos[b * 3] + pos[c * 3] < 0) continue;
        I2.push(addV(a, false), addV(b, false), addV(c, false), addV(a, true), addV(c, true), addV(b, true)); }
      if (P2.length / 3 < 65000) { pos = P2; nrm = N2; uv = U2; idx = I2; }
    }
    const id = it.dept[0] + '-' + it.id, png = Buffer.from(it.tex.split(',')[1], 'base64'), th = Buffer.from(it.thumb.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, id + '.png'), png); fs.writeFileSync(path.join(OUT, id + '-thumb.png'), th);
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ pos: b64(pos, Float32Array), nrm: b64(nrm, Float32Array), uv: b64(uv, Float32Array), idx: b64(idx, Uint16Array), alpha: it.alpha }));
    index.push({ id, dept: it.dept, name: it.name, file: id + '.json', tex: id + '.png', thumb: id + '-thumb.png', verts: pos.length / 3, first: it.first || undefined });
  }
  index.sort((a, b) => (b.first ? 1 : 0) - (a.first ? 1 : 0)); index.forEach(e => delete e.first);   // her stock hairstyles first
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  console.log(JSON.stringify({ n: index.length, byDept: index.reduce((a, x) => (a[x.dept] = (a[x.dept] || 0) + 1, a), {}), feet: !!map, logs: logs.slice(0, 12) }));
})();
