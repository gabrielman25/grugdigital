  /* ================================================================ the closet: the catalog and the avatar editor in one
     Laid out like Roblox's avatar editor. Her stage on one side (landscape: right; portrait: on top, with the panel as a
     sheet that drags up over her), and the panel with two modes:
       Marketplace  every department's items in an endless feed; open one and she tries it on while its details fill the
                    bottom half of the panel (the feed stays above it, still scrolling): Back, or Add to wardrobe
       Customize    the wardrobe (one piece per slot on her at a time; clothing has three slots: top, bottoms, shoes) and her
                    body: colour (skin, nails, the hair she has on: any colour), face, and build (with her feet)
     She is the classic female avatar in her own colours here; card pictures still show the grey mannequin (look(false)
     while a picture is taken). Saved on this device: 'grug.closet.v1' = { wardrobe, wearing, body }.
     The page follows the site's light or dark setting (profile.prefs.mode in 'grug.profile.v1'; light unless they picked
     dark) and the sun/moon button changes it for the whole site. */
  const CL_KEY = 'grug.closet.v1', PROFILE_KEY = 'grug.profile.v1';
  // clothing (the Modular Anime Character pack, src/jewelry.js) is five departments worn in three slots: tops, jackets and
  // outfits are a top, bottoms are legs, shoes are feet. With nothing in a slot she has the default tee and trousers on.
  const CL_DEPTS = [['tops', 'Tops', 'shirt'], ['jackets', 'Jackets', 'jacket'], ['bottoms', 'Bottoms', 'pants'], ['shoes', 'Shoes', 'shoe'], ['outfits', 'Outfits', 'outfit'], ['eyewear', 'Eyewear', 'glasses'], ['hair', 'Hair', 'hair'], ['earrings', 'Earrings', 'diamond'], ['necklaces', 'Necklaces', 'flower'], ['purses', 'Purses', 'shopping_bag'], ['sandals', 'Sandals', 'sun'], ['sound', 'Sound', 'note'], ['back', 'Back', 'sword']].filter(x => x[0] !== 'hair' || HD);
  const CL_DLABEL = Object.fromEntries(CL_DEPTS.map(x => [x[0], x[1]]));
  // what she wears, one piece per slot: every department is a slot, and clothing is three (top, bottoms, shoes)
  const slotOf = it => { const dp = deptOf(it); return J.isCloth(dp) ? 'clothing.' + J.CLOTH_SLOT_OF[dp] : dp; };
  const SLOTS = ['clothing.top', 'clothing.legs', 'clothing.feet'].concat(CL_DEPTS.filter(([d]) => !J.isCloth(d)).map(([d]) => d));
  const SLOT_ORDER = ['clothing.top', 'clothing.legs', 'clothing.feet'].concat(SLOTS.filter(s => !s.startsWith('clothing.')));   // clothes first: the rest is fitted over them
  const BUILD_SL = [['height', 'Height', 0.9, 1.1], ['shoulders', 'Shoulders', 0.8, 1.25], ['upperTorso', 'Upper body', 0.85, 1.2], ['lowerTorso', 'Lower body', 0.85, 1.2], ['hips', 'Hips', 0.8, 1.3], ['neck', 'Neck', 0.8, 1.3],
    ['upperArm', 'Upper arms', 0.8, 1.25], ['forearm', 'Forearms', 0.8, 1.25], ['handSize', 'Hands', 0.8, 1.3], ['thigh', 'Thighs', 0.8, 1.3], ['shin', 'Lower legs', 0.8, 1.25], ['footLength', 'Foot length', 0.85, 1.2], ['toeLength', 'Toe length', 0.7, 1.3]];
  const EXPR_LABEL = e => e.charAt(0).toUpperCase() + e.slice(1);
  const BODY0 = () => ({ skin: '#d9a67e', nails: '', expression: 'smug', footShape: 'none', build: {} });
  const CL = {
    on: false, mode: 'market', cdept: 'body', bsub: 'colour', view: null, preview: null, q: '', filters: false,
    wardrobe: [], wearing: {}, body: BODY0(), mounted: {}, tok: {}, goal: null, hist: { stack: [], i: -1 }, sheet: 'half', real: false, shapeKey: ''
  };
  { const s = store.get(CL_KEY, null); if (s) { CL.wardrobe = Array.isArray(s.wardrobe) ? s.wardrobe : []; CL.wearing = s.wearing || {}; CL.body = Object.assign(BODY0(), s.body || {}); CL.body.build = Object.assign({}, (s.body && s.body.build) || {}); } else if (HD && HD.byId('h:long')) { const h = HD.byId('h:long'); CL.wardrobe = [{ id: h.id, dept: 'hair', name: h.name, by: h.by }]; CL.wearing = { hair: h.id }; } }
  // the classic kit's clothing is gone (the Modular Anime Character pack replaced it): its pieces leave the wardrobe
  CL.wardrobe = CL.wardrobe.filter(e => e.dept !== 'clothing'); delete CL.wearing.clothing;
  for (const k of Object.keys(CL.wearing)) if (!CL.wardrobe.some(e => e.id === CL.wearing[k])) delete CL.wearing[k];
  // she is the player's avatar in games: the saved look ('grug.sandy.v1') says closet: true, stamped each time she changes
  // so the site's pictures of her are retaken (sandy-runtime.js builds her from 'grug.closet.v1' with assets/closet-runtime.js)
  function playAsCloset() {
    try {
      const K = 'grug.sandy.v1', CK = 'grug.sandy.classic.v1'; let c = JSON.parse(localStorage.getItem(K) || 'null');
      if (c && typeof c === 'object' && c.model !== 'block') { if (!localStorage.getItem(CK)) localStorage.setItem(CK, JSON.stringify(c)); c = null; }
      c = Object.assign({ model: 'block', skin: 'skaterFemaleA', hat: { type: 'none' } }, c || {}, { closet: true, classic: false, closetAt: Date.now() });
      localStorage.setItem(K, JSON.stringify(c));
    } catch (e) {}
  }
  const clSave = () => { if (!store.set(CL_KEY, { wardrobe: CL.wardrobe, wearing: CL.wearing, body: CL.body })) GRUG.toast('Your browser is out of room for your wardrobe'); clearTimeout(clSave.t); clSave.t = setTimeout(playAsCloset, 400); };

  /* ---- light or dark: the site's own setting */
  const siteMode = () => { try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return p && p.prefs && p.prefs.mode === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } };
  function showMode(m) { document.documentElement.setAttribute('data-g-theme', m); for (const b of $$('[data-mode-btn]')) { b.setAttribute('aria-label', m === 'dark' ? 'Light mode' : 'Dark mode'); b.dataset.gTip = m === 'dark' ? 'Light mode' : 'Dark mode'; } }
  function setSiteMode(m) {
    try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || {}; p.prefs = Object.assign({}, p.prefs || {}, { mode: m }); localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
    showMode(m); GRUG.toast(m === 'dark' ? 'Dark mode, across the site' : 'Light mode, across the site');
  }
  showMode(siteMode());
  for (const b of $$('[data-mode-btn]')) b.onclick = () => setSiteMode(siteMode() === 'dark' ? 'light' : 'dark');
  window.addEventListener('storage', e => { if (e.key === PROFILE_KEY) showMode(siteMode()); });

  /* ---- her two looks: the grey mannequin (card pictures, editors) or her own colours (the closet) */
  const CLM = []; sandy.object3d.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.userData.grug0 && !CLM.some(x => x.m === m)) CLM.push({ m, o: m.userData.grug0 }); });
  const realRec = new Map(), _lin = h => new THREE.Color(h).convertSRGBToLinear(), near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.05;
  function look(real) {
    CL.real = real; const grey = _lin(bodyPaint);
    for (const { m, o } of CLM) {
      if (real) { const r = realRec.get(m); m.map = r ? r.map : o.map; m.vertexColors = r ? r.vc : o.vc; m.roughness = o.rough; m.metalness = o.metal; m.color.copy(r ? r.color : o.color); }
      else { m.map = o.map ? WHITE : null; m.vertexColors = false; m.color.copy(grey); m.roughness = 0.62; m.metalness = 0; }
      m.needsUpdate = true;
    }
    if (sandy.n3.faceMesh) sandy.n3.faceMesh.visible = real;
    paintBody.real = real; J.clothPaint(sandy, real ? null : bodyPaint);
    const NU = sandy.n3._nailU; if (NU && NU.nailAmt) NU.nailAmt.value = real && CL.body.nails ? 1 : 0;
  }
  // her settings onto her (the kit recolours her skin itself); then the colours she shows here are kept for look(true)
  let applying = null;
  async function applyBody(refit) {
    const b = CL.body, c = JSON.parse(JSON.stringify(sandy.getConfig())), key = JSON.stringify([b.footShape, b.build]);
    Object.assign(c, { skin: b.skin, nails: b.nails || b.skin, expression: b.expression, footShape: b.footShape });
    if (!sandy.__wear || !sandy.__wear.on.feet) c.feet = Object.assign({}, c.feet, { type: 'flipflops', sole: '#f2efe6', strap: '#d9d2c4' });
    c.build = Object.assign({}, c.build); for (const [k] of BUILD_SL) c.build[k] = b.build[k] == null ? 1 : b.build[k];
    const reshape = key !== CL.shapeKey; if (reshape && CL.shapeKey) J.tiltFeet(sandy, 0, false); CL.shapeKey = key;
    for (const { m, o } of CLM) { m.map = o.map; m.vertexColors = o.vc; m.color.copy(o.color); m.needsUpdate = true; }
    const r = sandy.apply(c); if (r && r.then) await r; for (let i = 0; i < 3; i++) sandy.update(0.016);
    // her skin in exactly the colour picked, every part alike: the kit warms her head and hands and multiplies her body's
    // texture and vertex colours in, so they never matched. Her flip-flops off-white.
    const s0 = _lin(SKIN0), s1 = _lin('#d18f73'), g0 = _lin(GREY), skin = _lin(b.skin); realRec.clear();
    for (const { m, o } of CLM) {
      if (near(o.color, s0) || near(o.color, s1)) realRec.set(m, { map: o.map ? WHITE : null, vc: false, color: skin.clone() });
      else realRec.set(m, { map: o.map, vc: o.vc, color: near(o.color, g0) ? _lin('#f2efe6') : m.color.clone() });
    }
    if (sandy.__wear) J.clothSync(sandy);
    look(CL.on);
    if (reshape && refit !== false) await refitWorld();
  }
  const bodyLater = () => { clearTimeout(bodyLater.t); bodyLater.t = setTimeout(() => { applying = applyBody().catch(e => console.warn('body', e)); }, 120); };
  // pieces laid over her body (cords, straps, the swords) are fitted to its shape: after her build or her clothes change, again
  async function refitWorld() { delete sandy.__jfield; delete sandy.__jsnd; const n3 = sandy.n3; n3.__skinW = null; n3.__rest0 = null; for (const s of ['necklaces', 'purses', 'sandals', 'sound', 'back']) if (CL.mounted[s]) { const it = CL.mounted[s].it; unmountSlot(s); await mountSlot(s, it); } }

  /* ---- the wardrobe and what she has on */
  const entryOf = it => { const dp = deptOf(it); return dp === 'hair' ? { id: it.id, dept: 'hair', name: it.name, by: it.by } : { id: it.id, dept: dp, seed: it.seed, d: JSON.parse(JSON.stringify(it.d)), name: it.name, by: it.by, brand: it.brand }; };
  const owned = id => CL.wardrobe.some(e => e.id === id);
  const entryFor = id => CL.wardrobe.find(e => e.id === id);
  // her hair in any colour: every strand group, its tips and the scalp, in one flat colour
  function dyedHair(h, col) {
    if (!h || !col) return h;
    return Object.assign({}, h, { sw: col, hex: col, hex2: null, stamp: col, make: () => { const m = h.make(); for (const g of m.groups) { if (!g) continue; Object.assign(g, { tex: 'white', tint: col, tip: col, tipMix: 0, rainbow: 0, hlAmount: 0, hlTex: null, plain: true }); if (g.twinTex || g.twinTint) { g.twinTex = null; g.twinTint = col; } } if (m.scalp) Object.assign(m.scalp, { tex: 'white', tint: col, twinTex: null, twinTint: m.scalp.twinTint ? col : null, plain: true }); return m; } });
  }
  function itemOf(e) {
    if (!e) return null;
    if (e.dept === 'hair') { const h = HD ? HD.byId(e.id) : null; return e.col ? dyedHair(h, e.col) : h; }
    if (e.dept === 'eyewear') { const d = GE.validate(e.d).d; return { id: e.id, seed: e.seed, d, name: e.name, kind: GE.classify(d), by: e.by || 'Grug Digital', brand: e.brand || 'grug', order: 0, stamp: e.stamp || 0 }; }
    return JM.item(e.dept, e.id, e.seed, e.d, { name: e.name, by: e.by, brand: e.brand || (e.d && e.d.brand) || 'grug', gen: false, stamp: e.stamp || 0 });
  }
  const wardrobeItems = dept => CL.wardrobe.filter(e => !dept || dept === 'all' || e.dept === dept).map(e => { const it = itemOf(e); if (it) it._entry = e; return it; }).filter(Boolean);
  const wornItem = slot => { const id = CL.wearing[slot]; return id ? itemOf(entryFor(id)) : null; };
  const wornSig = it => it ? it.id + '|' + (it.stamp || 0) : '';
  async function mountSlot(slot, it) {
    const tok = (CL.tok[slot] = (CL.tok[slot] || 0) + 1); unmountSlot(slot); if (!it) return; let b;
    try {
      if (slot === 'eyewear') { b = GE.build(it.d, hm, { seed: it.seed }); b.root.userData.catalogItem = true; headGroup.add(b.root); }
      else if (slot === 'hair') { b = await HD.live(it, 'low'); if (tok !== CL.tok[slot] || !CL.on) { b.dispose(); return; } headGroup.add(b.root); }
      else { await J.prep(deptOf(it), it.d); if (tok !== CL.tok[slot] || !CL.on) return; b = JM.mountItem(it); }
    } catch (e) { console.warn('wear', slot, e); return; }
    if (tok !== CL.tok[slot] || !CL.on) { if (isJ(it)) JM.unmount(b); else { if (b.root.parent) b.root.parent.remove(b.root); b.dispose(); } return; }
    CL.mounted[slot] = { it, b, sig: wornSig(it) };
  }
  function unmountSlot(slot) { const m = CL.mounted[slot]; if (!m) return; delete CL.mounted[slot]; if (isJ(m.it)) JM.unmount(m.b); else { if (m.b.root.parent) m.b.root.parent.remove(m.b.root); m.b.dispose(); } }
  // what she has on, with the piece being tried on in its place; clothes first, and anything fitted to her body after them again
  async function syncOutfit() {
    const want = {}; for (const s of SLOTS) want[s] = wornItem(s);
    if (CL.preview) { const ps = slotOf(CL.preview); want[ps] = CL.preview; for (const [a, b] of clashes(ps, CL.preview)) if (a === 'drop') want[b] = null; }
    let clothes = false;
    for (const s of SLOT_ORDER) { const it = want[s], m = CL.mounted[s]; if ((it && m && m.sig === wornSig(it)) || (!it && !m)) continue; if (s.startsWith('clothing.')) clothes = true; await mountSlot(s, it); }
    if (clothes) { look(CL.on); await refitWorld(); }
  }
  // pieces that can't be worn together: an outfit and bottoms (and shoes, when the outfit has its own), shoes and sandals
  const outfitOf = it => it && J.CLOTH_BY[it.d && it.d.part] && J.CLOTH_BY[it.d.part].dept === 'outfits' ? J.CLOTH_BY[it.d.part] : null;
  function clashes(slot, it) {
    const out = [], o = slot === 'clothing.top' ? outfitOf(it) : null, worn = outfitOf(wornItem('clothing.top'));
    if (o) { out.push(['drop', 'clothing.legs']); if (o.feet) out.push(['drop', 'clothing.feet'], ['drop', 'sandals']); }
    if (slot === 'clothing.legs' && worn) out.push(['drop', 'clothing.top']);
    if ((slot === 'clothing.feet' || slot === 'sandals') && worn && worn.feet) out.push(['drop', 'clothing.top']);
    if (slot === 'clothing.feet') out.push(['drop', 'sandals']);
    if (slot === 'sandals') out.push(['drop', 'clothing.feet']);
    return out;
  }
  function wearOn(it) { const s = slotOf(it); CL.wearing[s] = it.id; for (const [a, b] of clashes(s, it)) if (a === 'drop') delete CL.wearing[b]; }
  function clWear(it, on) { const s = slotOf(it); if (on) wearOn(it); else if (CL.wearing[s] === it.id) delete CL.wearing[s]; clSave(); remember(); syncOutfit().then(() => focus(on ? it : null)); clRender(); }
  // Add to wardrobe keeps it; Equip keeps it and puts it on her. Equip again (or tapping a piece she has on) takes it off.
  function addToWardrobe(it, wear) { const had = owned(it.id); if (!had) CL.wardrobe.unshift(entryOf(it)); if (wear) wearOn(it); clSave(); remember(); GRUG.toast(wear ? (had ? 'Equipped' : 'Equipped and added to your wardrobe') : 'Added to your wardrobe'); syncOutfit(); clRender(); }
  function takeOff(it) { const s = slotOf(it); if (CL.wearing[s] === it.id) delete CL.wearing[s]; if (CL.view && CL.view.id === it.id) closeDetail(); clSave(); remember(); syncOutfit().then(() => focus(null)); clRender(); GRUG.toast('Unequipped'); }
  function removeFromWardrobe(it) { CL.wardrobe = CL.wardrobe.filter(e => e.id !== it.id); for (const s of Object.keys(CL.wearing)) if (CL.wearing[s] === it.id) delete CL.wearing[s]; clSave(); remember(); syncOutfit(); clRender(); GRUG.toast('Removed from your wardrobe'); }
  // a wardrobe piece changed (a colour, a print): it shows on her and gets a new picture
  function entryChanged(e, now) { e.stamp = Date.now(); clSave(); clearTimeout(entryChanged.t); entryChanged.t = setTimeout(() => { syncOutfit(); if (now !== false) { remember(); clRender(); } }, now === false ? 140 : 0); }
  // undo / redo of what she has on, her body and the colours of her pieces
  const snapOf = () => JSON.stringify({ wearing: CL.wearing, body: CL.body, looks: CL.wardrobe.filter(e => e.col || e.stamp).map(e => [e.id, e.col || '', e.d || null, e.stamp || 0]) });
  function remember() { const h = CL.hist, j = snapOf(); if (h.stack[h.i] === j) return; h.stack = h.stack.slice(0, h.i + 1); h.stack.push(j); if (h.stack.length > 80) h.stack.shift(); h.i = h.stack.length - 1; undoState(); }
  async function restoreSnap(j) {
    const s = JSON.parse(j), bodyChanged = JSON.stringify(s.body) !== JSON.stringify(CL.body); CL.wearing = s.wearing; CL.body = s.body;
    for (const [id, col, d, st] of s.looks || []) { const e = entryFor(id); if (!e) continue; if (col) e.col = col; else delete e.col; if (d) e.d = JSON.parse(JSON.stringify(d)); e.stamp = st; }
    clSave(); if (bodyChanged) await applyBody(); await syncOutfit(); clRender(); undoState();
  }
  function undoState() { const h = CL.hist; $('#clUndo').disabled = h.i <= 0; $('#clRedo').disabled = h.i >= h.stack.length - 1; }
  $('#clUndo').onclick = () => { const h = CL.hist; if (h.i > 0) { h.i--; restoreSnap(h.stack[h.i]); } };
  $('#clRedo').onclick = () => { const h = CL.hist; if (h.i < h.stack.length - 1) { h.i++; restoreSnap(h.stack[h.i]); } };

  /* ---- the camera: her whole body, or close on a piece; it glides there */
  // no floor under her: shoes and sandals clipped through it, so the stage is just the blurred picture
  const floor = { visible: false };
  function goalFor(box, yaw, pitch, fill) {
    const sph = box.getBoundingSphere(new THREE.Sphere()), size = box.getSize(new THREE.Vector3()), t = Math.tan(15 * Math.PI / 180), asp = Math.max(0.3, camera.aspect || 1);
    const d = Math.max(size.y / 2 / t, Math.max(size.x, size.z) / 2 / (t * asp), sph.radius * 0.9 / t) * (fill || 1.12);
    return { target: sph.center.clone(), dist: d, yaw, pitch };
  }
  function fullBody() { sandy.object3d.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(sandy.n3.headMesh); for (const d of ['hair', 'sound', 'eyewear']) if (CL.mounted[d]) hb.union(new THREE.Box3().setFromObject(CL.mounted[d].b.root)); const top = hb.max.y + (portrait() ? 16 : 8), box = new THREE.Box3(new THREE.Vector3(-30, -3, -14), new THREE.Vector3(30, top, 14)); return goalFor(box, 0.32, 0.04, 1.1); }
  function focus(it) {
    if (!it) { CL.goal = fullBody(); return; } const m = CL.mounted[slotOf(it)]; if (!m) { CL.goal = fullBody(); return; }
    sandy.object3d.updateMatrixWorld(true); let box;
    if (isJ(it)) box = JM.frameBox(m.b.root, it); else box = new THREE.Box3().setFromObject(m.b.root).union(new THREE.Box3().setFromObject(sandy.n3.headMesh));
    const dp = deptOf(it); if (dp === 'necklaces' || dp === 'purses') box.expandByVector(new THREE.Vector3(6, 6, 6)); if (dp === 'sandals') box.expandByVector(new THREE.Vector3(8, 8, 8));
    const cl = J.isCloth(dp), back = dp === 'back' && it.d.kind !== 'hip', yaw = dp === 'earrings' ? 0.9 : dp === 'purses' ? 0.3 : back ? 2.7 : dp === 'back' ? 1.2 : cl ? 0.35 : 0.55;
    if (dp === 'shoes') box.expandByVector(new THREE.Vector3(8, 8, 8));
    const g = goalFor(box, yaw, dp === 'sandals' || dp === 'shoes' ? 0.28 : 0.08, dp === 'back' ? 1.15 : 1.35); g.dist = Math.max(g.dist, dp === 'necklaces' || dp === 'purses' || dp === 'sandals' || dp === 'shoes' ? 90 : dp === 'back' || cl ? 120 : 75); CL.goal = g;
  }
  $('#clReset').onclick = () => focus(null);
  let clLast = performance.now();
  (function glide(now) {
    const dt = Math.min(0.05, (now - clLast) / 1000); clLast = now;
    if (CL.on && CL.goal && !drag) { const g = CL.goal, k = 1 - Math.exp(-dt * 7); cam.target.lerp(g.target, k); cam.dist += (g.dist - cam.dist) * k; let dy = g.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * k; cam.pitch += (g.pitch - cam.pitch) * k; if (Math.abs(g.dist - cam.dist) < 0.3 && Math.abs(dy) < 0.003 && cam.target.distanceTo(g.target) < 0.2) CL.goal = null; }
    requestAnimationFrame(glide);
  })(clLast);
  canvas.addEventListener('pointerdown', () => { if (CL.on) CL.goal = null; });
  canvas.addEventListener('wheel', () => { if (CL.on) CL.goal = null; }, { passive: true });

  /* ---- the page around her */
  const clEl = $('#closet'), clBody = $('#clBody'), clDet = $('#clDetail');
  function setMode(m) { CL.mode = m; CL.filters = false; $$('#clMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === m)); if (CL.view) { CL.view = null; CL.preview = null; syncOutfit(); focus(null); if (location.hash) history.replaceState(null, '', location.pathname + location.search); } clRender(); clBody.scrollTop = 0; }
  $$('#clMode button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  function tabBtn(box, v, label, on, go, icon) { const b = el('button', on ? 'on' : '', (icon ? ic(icon) : '') + `<span>${esc(label)}</span>`); b.onclick = go; box.append(b); return b; }
  function clTabs() {
    const t = $('#clTabs'), s = $('#clSubs'); t.innerHTML = ''; s.innerHTML = '';
    if (CL.mode === 'market') {
      for (const [v, label] of DEPTS) { if (v === 'yours' && !mineItems().length) continue; tabBtn(t, v, v === 'all' ? 'All' : label, cat.dept === v, () => { Object.assign(cat, RESET()); cat.dept = v; cat.sub = 'all'; CL.filters = false; closeDetail(); newFeed(true); clRender(); clBody.scrollTop = 0; }); }
      const subs = SUBS[cat.dept] || []; s.hidden = !subs.length;
      if (subs.length) { tabBtn(s, 'all', 'All', cat.sub === 'all', () => { cat.sub = 'all'; newFeed(true); clRender(); clBody.scrollTop = 0; }); for (const [sv, sl] of subs) tabBtn(s, sv, sl, cat.sub === sv, () => { cat.sub = sv; newFeed(true); clRender(); clBody.scrollTop = 0; }); }
    } else {
      tabBtn(t, 'body', 'Body', CL.cdept === 'body', () => { CL.cdept = 'body'; clRender(); }); tabBtn(t, 'all', 'All', CL.cdept === 'all', () => { CL.cdept = 'all'; clRender(); });
      for (const [v, label] of CL_DEPTS) tabBtn(t, v, label, CL.cdept === v, () => { CL.cdept = v; clRender(); clBody.scrollTop = 0; });
      s.hidden = CL.cdept !== 'body';
      if (CL.cdept === 'body') for (const [v, l] of [['colour', 'Colour'], ['face', 'Face'], ['build', 'Build']]) tabBtn(s, v, l, CL.bsub === v, () => { CL.bsub = v; clRender(); });
    }
    $('#clTools').hidden = CL.mode !== 'market';
    GRUG.hydrate(t); hsTabs(); hsSubs();
  }
  // the category rows scroll sideways when they don't fit: the mouse wheel, a drag, a swipe, the arrows at their ends, and a
  // thin bar under them. The picked tab is kept in view.
  function hScroll(nav) {
    const wrap = el('div', 'cl-hs'); nav.parentNode.insertBefore(wrap, nav); wrap.append(nav); nav.setAttribute('data-noswipe', '');
    const chev = d => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
    const arrow = (cls, label, dir, d) => { const b = el('button', 'cl-hsb ' + cls, chev(d)); b.type = 'button'; b.setAttribute('aria-label', label); b.onclick = () => nav.scrollBy({ left: dir * Math.max(120, nav.clientWidth * 0.7), behavior: 'smooth' }); wrap.append(b); };
    arrow('l', 'Scroll left', -1, 'M10 3 5 8l5 5'); arrow('r', 'Scroll right', 1, 'M6 3l5 5-5 5');
    const upd = () => { const max = nav.scrollWidth - nav.clientWidth; wrap.classList.toggle('can-l', nav.scrollLeft > 2); wrap.classList.toggle('can-r', nav.scrollLeft < max - 2); };
    nav.addEventListener('scroll', upd, { passive: true }); new ResizeObserver(upd).observe(nav);
    nav.addEventListener('wheel', e => { if (nav.scrollWidth <= nav.clientWidth + 1) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return; e.preventDefault(); nav.scrollLeft += e.deltaMode === 1 ? d * 30 : d; }, { passive: false });
    let drag = null;
    nav.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, s: nav.scrollLeft, moved: false }; });
    addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) drag.moved = true; if (drag.moved) nav.scrollLeft = drag.s - dx; });
    addEventListener('pointerup', () => { if (drag && drag.moved) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; nav.addEventListener('click', stop, true); setTimeout(() => nav.removeEventListener('click', stop, true), 0); } drag = null; });
    return () => { const on = nav.querySelector('button.on'); if (on) { const l = on.offsetLeft - nav.offsetLeft, r = l + on.offsetWidth; if (l < nav.scrollLeft + 24) nav.scrollLeft = l - 24; else if (r > nav.scrollLeft + nav.clientWidth - 24) nav.scrollLeft = r - nav.clientWidth + 24; } requestAnimationFrame(upd); };
  }
  const hsTabs = hScroll($('#clTabs')), hsSubs = hScroll($('#clSubs'));
  // the marketplace's search box and filters (the catalog's own refine, brand and colour filters, moved in here)
  $('#clSearch').oninput = e => { cat.q = e.target.value; clearTimeout(clTabs.q); clTabs.q = setTimeout(() => { newFeed(false); clRender(); }, 160); };
  $('#clFilterBtn').onclick = () => { CL.filters = !CL.filters; clRender(); };
  $('#clSort').onchange = e => { cat.sort = e.target.value; newFeed(false); clRender(); };
  function sortItems(items) {
    if (cat.sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (cat.sort === 'yours') items.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
    else if (cat.dept === 'favs') { const at = id => favs.findIndex(f => f.id === id); items.sort((a, b) => at(a.id) - at(b.id)); }
    return items;
  }

  /* ---- the endless feed: a fresh, random set each time a tab is opened. Pieces drawn earlier (their pictures are ready)
     are mixed back in, one in three, so a reopened tab is part new and part familiar. It never stops: there's always
     another piece to make (Hair, Favourites and Yours are the only lists that end) */
  const GEN_DEPTS = ['tops', 'eyewear', 'bottoms', 'earrings', 'jackets', 'necklaces', 'shoes', 'purses', 'outfits', 'sandals', 'sound', 'back'];
  const FEED = { key: '', seed: '', items: [], seen: new Set(), pool: [], hairQ: [], gi: 0, n: 0, done: false, finite: false };
  const shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const feedKey = () => [cat.dept, cat.sub, cat.q, cat.sort, cat.colour, cat.brand].concat(REFINE_KEYS.map(k => cat[k])).join('|');
  function newFeed(fresh) {
    if (fresh || !FEED.seed) FEED.seed = 'cl' + Math.random().toString(36).slice(2, 7);
    Object.assign(FEED, { key: feedKey(), items: [], seen: new Set(), gi: 0, n: 0, done: false, finite: cat.dept === 'favs' || cat.dept === 'yours' || cat.dept === 'hair' });
    const top = cat.dept === 'favs' ? sortItems(allItems().filter(it => passes(it))) : mineItems().filter(it => passes(it));
    for (const it of top) { FEED.seen.add(it.id); FEED.items.push(it); }
    FEED.pool = cat.dept === 'favs' || cat.dept === 'yours' ? [] : shuffled(Array.from(genCache.values()).filter(it => it && it.id && /^g[enpsabtjlfu]?:/.test(it.id) && thumbs.has(tkey(it, 'worn')) && passes(it)));
    FEED.hairQ = HD && (cat.dept === 'hair' || cat.dept === 'all') ? shuffled(hairItems().filter(h => !h.mine || cat.dept === 'hair')) : [];
    if (FEED.finite && cat.dept !== 'hair') FEED.done = true;
    feedFill(48);
  }
  // the next new piece: in turn from every department (All), or this one; undefined = skip, null = nothing left
  function nextGen() {
    if (cat.dept === 'hair') return FEED.hairQ.length ? FEED.hairQ.pop() : null;
    const list = cat.dept === 'all' ? GEN_DEPTS.concat(FEED.hairQ.length ? ['hair'] : []) : [cat.dept];
    const d = list[FEED.gi % list.length], seed = FEED.seed + '-' + (FEED.gi++);
    if (d === 'hair') return FEED.hairQ.pop();
    return d === 'eyewear' ? itemById('g:' + seed) : JM.gen(d, seed);
  }
  function feedFill(k) {
    const want = FEED.items.length + k; let guard = 0;
    while (FEED.items.length < want && !FEED.done && guard++ < k * 60) {
      const it = FEED.n++ % 3 === 2 && FEED.pool.length ? FEED.pool.pop() : nextGen();
      if (it === null) { FEED.done = !FEED.pool.length; continue; } if (!it) continue;
      if (FEED.seen.has(it.id) || !passes(it)) continue; FEED.seen.add(it.id); FEED.items.push(it);
    }
    if (cat.sort === 'name') sortItems(FEED.items);
  }
  let clGen = 0;
  const marketCard = it => { const a = card(it, 'worn', { gen: clGen }); if (CL.wearing[slotOf(it)] === it.id) a.classList.add('wearing');
    // tapping a piece she has on takes it off; tapping the one she's trying on puts it back
    a.addEventListener('click', e => { if (e.target.closest('.fav') || e.metaKey || e.ctrlKey) return; if (CL.wearing[slotOf(it)] === it.id) { e.preventDefault(); takeOff(it); } else if (CL.view && CL.view.id === it.id) { e.preventDefault(); closeDetail(); } }); if (CL.view && CL.view.id === it.id) a.classList.add('viewing'); if (owned(it.id)) a.querySelector('.ct').append(el('span', 'g-pill g-pill--solid tag own', 'Owned')); seen.observe(a); return a; };
  const more = new IntersectionObserver(es => {
    if (!(CL.on && CL.mode === 'market' && es.some(e => e.isIntersecting))) return;
    const grid = clBody.querySelector('.cl-grid'), n0 = FEED.items.length; if (!grid || FEED.done) return;
    feedFill(24); if (cat.sort === 'name') { const top = clBody.scrollTop; clRender(); clBody.scrollTop = top; return; }
    for (const it of FEED.items.slice(n0)) grid.append(marketCard(it));
    const s = clBody.querySelector('.cl-more'); if (s) { more.unobserve(s); if (FEED.done) s.remove(); else { clBody.querySelector('.cl-feed').append(s); more.observe(s); } }
  }, { root: clBody, rootMargin: '600px' });
  function marketGrid(box) {
    clGen++; jobs.length = 0;
    if (FEED.key !== feedKey()) newFeed(false);
    const fp = $('#clFilters'); fp.hidden = !CL.filters; $('#clFilterBtn').classList.toggle('on', CL.filters || REFINE_KEYS.some(k => cat[k] !== 'any') || cat.colour !== 'any' || cat.brand !== 'any');
    if (CL.filters) { renderFilters(allItems()); fp.append($('#fRefine')); $('#clSort').value = cat.sort; GRUG.hydrate(fp); }
    const feed = el('div', 'cl-feed'); box.append(feed);
    if (FEED.finite) feed.append(el('div', 'cl-count', `${FEED.items.length.toLocaleString()} ${FEED.items.length === 1 ? 'item' : 'items'}`));
    const grid = el('div', 'cgrid cl-grid'); feed.append(grid);
    if (!FEED.items.length) grid.append(el('div', 'cload', cat.dept === 'favs' && !favs.length ? 'No favourites yet. Tap the star on anything to start a collection.' : 'Nothing matches that. Try another filter.'));
    for (const it of FEED.items) grid.append(marketCard(it));
    if (!FEED.done) { const s = el('div', 'cl-more'); feed.append(s); more.observe(s); }
  }
  /* ---- Customize: the wardrobe, with the colours of what she has on right above it */
  function wardrobeGrid(box, dept) {
    if (dept === 'hair' || J.isCloth(dept) || dept === 'all') looksPanel(box, dept);
    const items = wardrobeItems(dept), grid = el('div', 'cgrid cl-grid'); box.append(grid);
    if (!items.length) {
      const e = el('div', 'cl-empty', `<b>${dept === 'all' ? 'Your wardrobe is empty' : 'No ' + esc((CL_DLABEL[dept] || '').toLowerCase()) + ' yet'}</b><span>Find something in the Marketplace, then Add to wardrobe.</span>`), b = el('button', 'g-btn g-btn--primary', `${ic('shopping_bag')}<span>Go to the Marketplace</span>`);
      b.onclick = () => { if (dept !== 'all') { Object.assign(cat, RESET()); cat.dept = dept; cat.sub = 'all'; newFeed(true); } setMode('market'); }; e.append(b); grid.append(e); GRUG.hydrate(e); return;
    }
    for (const it of items) {
      const on = CL.wearing[slotOf(it)] === it.id, a = card(it, 'worn', { gen: -1 }); a.removeAttribute('href'); a.classList.toggle('wearing', on); a.setAttribute('role', 'button'); a.setAttribute('aria-pressed', on ? 'true' : 'false');
      a.addEventListener('click', e => { if (e.target.closest('.fav,.cl-rm')) return; e.preventDefault(); clWear(it, !(CL.wearing[slotOf(it)] === it.id)); });
      const rm = el('button', 'cl-rm', ic('trash_can')); rm.setAttribute('aria-label', 'Remove from your wardrobe'); rm.setAttribute('data-g-tip', 'Remove from your wardrobe'); rm.onclick = e => { e.preventDefault(); e.stopPropagation(); removeFromWardrobe(it); };
      a.querySelector('.ct').append(rm, el('span', 'g-pill g-pill--solid tag wtag', on ? 'Wearing' : 'Wear')); grid.append(a); a._thumb();
    }
    GRUG.hydrate(grid);
  }
  // a row of colours: swatches and a picker for any colour (onset(hex, final))
  const HAIR_SW = ['#1d1f26', '#4a2a22', '#80523c', '#ab9168', '#e2b98a', '#efe2c3', '#f1f2f4', '#9ea6b4', '#c42a2a', '#d0622a', '#ee8fb0', '#ff3f9e', '#c598e0', '#7a3dd6', '#8dcce0', '#2f6fe0', '#6fd2bf', '#1f9d55'];
  const CLOTH_SW = ['#f4f4f2', '#16161a', '#3a3b40', '#c8ccd2', '#e8344f', '#ff6fa8', '#ffc2d6', '#f2801f', '#f5d21f', '#9be338', '#2e9b48', '#14a3a0', '#4fd8e0', '#2b62d9', '#1b2a55', '#7d3fc4', '#6b4428', '#c9a27e'];
  function colourRow(parent, val, list, onset, extra) {
    const row = el('div', 'cl-sws');
    if (extra) row.append(extra);
    for (const c of list) { const s = el('button', 'cl-sw' + ((val || '').toLowerCase() === c ? ' on' : '')); s.style.background = c; s.setAttribute('aria-label', J.colourName(c)); s.setAttribute('data-g-tip', J.colourName(c)); s.onclick = () => onset(c, true); row.append(s); }
    const inp = el('input'); inp.type = 'color'; inp.value = /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#888888'; inp.setAttribute('aria-label', 'Any colour'); inp.oninput = () => onset(inp.value, false); inp.onchange = () => onset(inp.value, true);
    const pk = el('label', 'cl-pickw' + (val && !list.includes((val || '').toLowerCase()) ? ' on' : ''), ic('palette')); pk.setAttribute('data-g-tip', 'Any colour'); pk.style.setProperty('--pick', /^#[0-9a-f]{6}$/i.test(val || '') ? val : 'transparent'); pk.append(inp); row.append(pk); parent.append(row); return row;
  }
  const grp2 = (box, label, note) => { const g = el('div', 'cl-grp', `<div class="g-label">${esc(label)}</div>`); if (note) g.append(el('div', 'cl-note', esc(note))); box.append(g); return g; };
  // the hair she has on, in any colour
  function hairColour(box) {
    const id = CL.wearing.hair, e = id && entryFor(id); if (!e) return;
    const h = HD.byId(e.id), g = grp2(box, 'Hair colour', h ? h.name : ''), orig = el('button', 'cl-sw cl-orig' + (e.col ? '' : ' on'), '<span>Original</span>'); orig.style.background = h ? (String(h.sw).includes('gradient') ? h.sw : h.hex) : '#888';
    orig.setAttribute('data-g-tip', 'Its own colours'); orig.onclick = () => { delete e.col; entryChanged(e); };
    colourRow(g, e.col, HAIR_SW, (c, f) => { e.col = c; entryChanged(e, f); }, orig);
  }
  // a piece of clothing she has on: its style, its three colours and its print
  function clothEditor(box, e) {
    const d = e.d, c = J.CLOTH_BY[d.part], card = el('div', 'cl-look'); if (!c) return; box.append(card);
    card.append(el('div', 'cl-lookh', `<span class="g-label">${esc(J.CLOTH_DEPT_LABEL[e.dept] || '')}</span><b>${esc(e.name)}</b>`));
    const set = (patch, f) => { Object.assign(d, patch); e.d = J.validate(e.dept, d, d.brand).d; entryChanged(e, f); };
    if (c.vars) { const row = el('div', 'cl-chips'); c.vars.forEach((v, i) => { const t = el('button', d.vari === i ? 'on' : '', esc(v)); t.onclick = () => set({ vari: i }); row.append(t); }); card.append(el('div', 'cl-note', 'Style'), row); }
    c.areas.forEach((a, i) => { const k = ['colA', 'colB', 'colC'][i]; card.append(el('div', 'cl-note', esc(a))); colourRow(card, d[k], CLOTH_SW, (v, f) => set({ [k]: v }, f)); });
    const n = J.PAT_N, row = el('div', 'patrow'), pv = document.createElement('canvas'); pv.width = pv.height = 44; pv.className = 'patpv';
    { const x = pv.getContext('2d'); x.fillStyle = d.colA; x.fillRect(0, 0, 44, 44);
      if (d.pat >= 0 && J.PAT.img) { const T = J.PAT.T, ox = (d.pat % J.PAT.cols) * T, oy = Math.floor(d.pat / J.PAT.cols) * T, im = x.getImageData(0, 0, 44, 44), A = new THREE.Color(d.colA), B = new THREE.Color(d.patCol); for (let yy = 0; yy < 44; yy++) for (let xx = 0; xx < 44; xx++) { const L = 1 - (1 - J.PAT.lum[(oy + Math.floor(yy * T / 44)) * J.PAT.w + ox + Math.floor(xx * T / 44)] / 255) * J.PAT_K, q = (yy * 44 + xx) * 4; im.data[q] = (B.r + (A.r - B.r) * L) * 255; im.data[q + 1] = (B.g + (A.g - B.g) * L) * 255; im.data[q + 2] = (B.b + (A.b - B.b) * L) * 255; } x.putImageData(im, 0, 0); } }
    const btn = (html, title, fn) => { const t = el('button', 'g-btn g-btn--sm g-btn--ghost', html); t.title = title; t.setAttribute('aria-label', title); t.onclick = fn; return t; };
    row.append(pv, el('span', 'lb', `Print<small>${d.pat >= 0 ? 'Pattern ' + (d.pat + 1) + ' of ' + n : 'No print'}</small>`), btn('&lsaquo;', 'Previous print', () => set({ pat: d.pat <= 0 ? n - 1 : d.pat - 1 })), btn('&rsaquo;', 'Next print', () => set({ pat: (d.pat + 1) % n })), btn(ic('dice'), 'A random print', () => set({ pat: Math.floor(Math.random() * n) })), btn(ic('cross'), 'No print', () => set({ pat: -1 })));
    card.append(row);
    if (d.pat >= 0) { card.append(el('div', 'cl-note', 'Print colour')); colourRow(card, d.patCol, CLOTH_SW, (v, f) => set({ patCol: v }, f)); }
    const ed = el('button', 'g-btn g-btn--sm g-btn--ghost', `${ic('pencil')}<span>Open in the ${esc(J.CLOTH_DEPT_LABEL[e.dept] || 'clothing')} studio</span>`); ed.onclick = () => openStudio(itemOf(e)); card.append(ed);
  }
  function looksPanel(box, dept) {
    const wrap = el('div', 'cl-looks'); let any = false;
    if ((dept === 'hair' || dept === 'all') && CL.wearing.hair && HD) { hairColour(wrap); any = true; }
    if (J.isCloth(dept) || dept === 'all') for (const s of ['clothing.top', 'clothing.legs', 'clothing.feet']) { const e = CL.wearing[s] && entryFor(CL.wearing[s]); if (e && e.d && (dept === 'all' || e.dept === dept)) { clothEditor(wrap, e); any = true; } }
    if (any) { box.append(wrap); GRUG.hydrate(wrap); }
  }
  function bodyPanel(box) {
    const b = CL.body, change = (patch, now) => { Object.assign(b, patch); clSave(); if (now) { applying = applyBody(); remember(); clRender(); } else bodyLater(); };
    if (CL.bsub === 'colour') {
      const g = grp2(box, 'Skin tone');
      colourRow(g, b.skin, K.CATALOG.skinTones.filter(x => x !== '#ffffff').concat(['#f7dcc8', '#e8b48f', '#c98d63', '#a46c46', '#6f4428', '#3f2718']), (c, f) => change({ skin: c }, f));
      const g2 = grp2(box, 'Nails'), nat = el('button', 'cl-sw cl-orig' + (b.nails ? '' : ' on'), '<span>Natural</span>'); nat.style.background = b.skin; nat.setAttribute('data-g-tip', 'Natural'); nat.onclick = () => change({ nails: '' }, true);
      colourRow(g2, b.nails, ['#e3101c', '#ff6fb0', '#ffc2d6', '#121212', '#7d3fc4', '#2b62d9', '#4fd8e0', '#9be338', '#f5d21f', '#f2801f', '#f4f4f2', '#d4af37'], (c, f) => change({ nails: c }, f), nat);
      if (CL.wearing.hair && HD) hairColour(box); else grp2(box, 'Hair colour', 'Put on a hairstyle (Hair, in your wardrobe) to colour it here.');
    } else if (CL.bsub === 'face') {
      const g = grp2(box, 'Expression'), row = el('div', 'cl-chips');
      for (const x of K.CATALOG.expressions) { const s = el('button', b.expression === x ? 'on' : '', esc(EXPR_LABEL(x))); s.onclick = () => change({ expression: x }, true); row.append(s); }
      g.append(row);
    } else {
      const g = grp2(box, 'Build', 'Her head stays the same size, so everything she wears on it still fits.'); for (const s of BUILD_SL.filter(x => x[0] !== 'footLength' && x[0] !== 'toeLength')) slider(g, s);
      const g2 = grp2(box, 'Feet', 'Sandals and boots are fitted to whichever feet she has.'), row = el('div', 'cl-chips');
      K.CATALOG.footShapes.forEach((x, i) => { const s = el('button', b.footShape === x ? 'on' : '', i ? 'Shape ' + i : 'Natural'); s.onclick = () => change({ footShape: x }, true); row.append(s); });
      g2.append(row); for (const k of ['footLength', 'toeLength']) slider(g2, BUILD_SL.find(x => x[0] === k));
      const r = el('button', 'g-btn g-btn--sm', `${ic('arrow_counterclockwise')}<span>Reset her build</span>`); r.onclick = () => { b.build = {}; b.footShape = 'none'; change({}, true); }; box.append(r);
    }
    function slider(g, [k, label, lo, hi]) {
      const v = b.build[k] == null ? 1 : b.build[k], row = el('label', 'cl-sl', `<span class="lb">${esc(label)}</span><span class="val">${Math.round(v * 100)}%</span>`), r = el('input', 'g-range'); r.type = 'range'; r.min = lo; r.max = hi; r.step = 0.01; r.value = v;
      r.oninput = () => { row.querySelector('.val').textContent = Math.round(+r.value * 100) + '%'; b.build[k] = +r.value; bodyLater(); }; r.onchange = () => { b.build[k] = +r.value; change({}, false); remember(); };
      row.append(r); g.append(row);
    }
    GRUG.hydrate(box);
  }
  // a piece opened in its studio (eyewear, the jewelry studios, swords, clothing) or the Hair Studio
  function openStudio(it) {
    const dp = deptOf(it);
    if (dp === 'hair') { location.href = HAIR_STUDIO + '#item/' + encodeURIComponent(it.studioId); return; }
    if (isJ(it)) { JM.load(dp, it.d, { name: it.name, seed: it.seed, autoName: false }); JM.on = false; store.set(JKEY(dp), { d: JM.st.d, name: JM.st.name, seed: JM.st.seed, autoName: false }); JM.st = null; location.hash = '#edit/' + dp; return; }
    loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false, brand: it.brand }); commit(); location.hash = '#edit';
  }
  // the opened piece, in the bottom half of the panel (the feed stays above it); she tries it on in the stage
  const likeOf = it => {
    const dp = deptOf(it), r = rng('like:' + it.id);
    if (dp === 'hair') { const pool = HD.styleItems().filter(x => x.id !== it.id); return pool.filter(x => x.base === it.base).slice(0, 3).concat(pool.filter(x => x.base !== it.base && x.length === it.length).slice(0, 3)); }
    if (isJ(it)) return Array.from({ length: 6 }, (_, i) => JM.gen(dp, 'like-' + it.seed + '-' + i));
    const arch = { glasses: ['classic', 'wire', 'rose', 'readers', 'browline'], shades: ['shades', 'aviators', 'catshades', 'party', 'sport'], goggles: ['goggles', 'ski', 'steampunk'] }[it.kind] || ['classic'];
    return Array.from({ length: 6 }, (_, i) => { const seed = 'like-' + it.seed + '-' + i; if (genCache.has(seed)) return genCache.get(seed); const d = GE.random(seed, { arch: r.pick(arch) }), li = { id: 'g:' + seed, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: i, stamp: 0, gen: true }; genCache.set(seed, li); return li; });
  };
  function itemPanel(box, it) {
    const dp = deptOf(it), hair = dp === 'hair', mineIt = owned(it.id), on = CL.wearing[slotOf(it)] === it.id;
    const kind = hair ? it.length.charAt(0).toUpperCase() + it.length.slice(1) : isJ(it) ? J.KIND_LABEL[it.kind] || it.kind : GE.CLASS_LABEL[it.kind];
    const tags = hair ? it.tags.filter(t => t !== 'yours').map(t => t.charAt(0).toUpperCase() + t.slice(1)) : isJ(it) ? J.tagsFor(dp, it.d) : GE.tagsFor(it.d);
    const v = el('div', 'cl-item');
    v.innerHTML = `<div class="cl-ihead"><div class="crumbs"><span>${esc(deptLabel(dp))}</span><i class="sep">›</i><span>${esc(kind || '')}</span></div><button class="cl-round sm cl-x" data-back aria-label="Close" data-g-tip="Close">${ic('cross')}</button></div>
      <div class="cl-iwrap"><div class="cl-ipic" style="background-color:${cardColour(it)}"><span class="wait"></span></div>
      <div class="cl-iinfo"><h2 class="g-h3">${esc(it.name)}</h2><div class="cl-by">${byHTML(it)}</div><div class="cl-price">Free</div>
      <div class="cl-acts"><button class="g-btn g-btn--primary" data-equip>${on ? ic('cross') + '<span>Unequip</span>' : '<span>Equip</span>'}</button><button class="g-btn" data-add${mineIt ? ' disabled' : ''}>${mineIt ? ic('star') + '<span>In your wardrobe</span>' : ic('plus_in_circle') + '<span>Add to wardrobe</span>'}</button><button class="g-btn" data-back>${ic('arrow_left')}<span>Back</span></button></div>
      <div class="cl-acts2"><button class="g-btn g-btn--sm favbtn${isFav(it.id) ? ' on' : ''}" data-fav>${ic('star')}<span>${isFav(it.id) ? 'Favorited' : 'Favorite'}</span></button>${J.isCloth(dp) ? '' : `<span class="rollbtn"><button class="g-btn g-btn--sm" data-dl>${ic('file_arrow_down')}<span>Download</span>${ic('dropdown')}</button><div class="rollmenu fmtmenu" hidden></div></span>`}<button class="g-btn g-btn--sm g-btn--ghost" data-edit>${ic('pencil')}<span>${hair ? 'Edit in the Hair Studio' : 'Edit'}</span></button></div></div></div>
      <div class="chips">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <p class="cl-desc">${esc(hair ? it.desc : isJ(it) ? J.describe(dp, it.d) : GE.describe(it.d))}</p><div class="g-label">Details</div><dl class="specs">${hair ? [['Style', esc(it.style)], ['Length', esc(kind)], ['Colour', swatch(it.sw) + esc(it.colour)]].map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') : isJ(it) ? JM.specRows(it) : specRows(it.d)}</dl>
      <h3 class="g-h4 cl-like-h">More like this</h3><div class="cgrid cl-grid" data-like></div>`;
    box.append(v);
    const pic = v.querySelector('.cl-ipic'), cb = u => { pic.style.backgroundImage = `url(${u})`; const w = pic.querySelector('.wait'); if (w) w.remove(); }; cb.alive = () => document.body.contains(pic); queueThumb(it, 'worn', cb, true);
    for (const b of v.querySelectorAll('[data-back]')) b.onclick = () => { location.hash = ''; };
    v.querySelector('[data-equip]').onclick = () => { if (on) takeOff(it); else addToWardrobe(it, true); };
    v.querySelector('[data-add]').onclick = () => { if (!mineIt) addToWardrobe(it, false); };
    v.querySelector('[data-fav]').onclick = () => { toggleFav(it); clDetail(); };
    if (v.querySelector('[data-dl]')) formatMenu(v.querySelector('[data-dl]'), v.querySelector('.fmtmenu'), () => it);
    v.querySelector('[data-edit]').onclick = () => openStudio(it);
    const like = v.querySelector('[data-like]'); for (const li of likeOf(it)) { const a = card(li, 'worn', { gen: -1 }); like.append(a); a._thumb(); }
    GRUG.hydrate(v);
  }
  function clDetail() {
    const it = CL.view; clEl.classList.toggle('viewing', !!it); clDet.hidden = !it; clDet.innerHTML = ''; if (!it) return;
    itemPanel(clDet, it); clDet.scrollTop = 0;
    for (const a of clBody.querySelectorAll('.ccard')) a.classList.toggle('viewing', a.dataset.id === it.id);
  }
  function clRender() {
    if (!CL.on) return; clTabs(); const box = clBody, top = box.scrollTop; box.innerHTML = ''; clEl.dataset.mode = CL.mode;
    if (CL.mode === 'market') marketGrid(box);
    else if (CL.cdept === 'body') bodyPanel(box);
    else wardrobeGrid(box, CL.cdept);
    if (CL.mode !== 'market') $('#clFilters').hidden = true;
    GRUG.hydrate(box); box.scrollTop = top; clDetail();
  }
  // a piece opened from the marketplace: she tries it on (one per slot, so it takes that slot's place)
  async function clOpen(id) {
    const it = itemById(id); if (!it) { location.hash = ''; return; }
    if (deptOf(it) === 'hair') { viewer.token++; for (const k of Object.keys(viewer.vr)) HD.disposeVersion(viewer.vr[k]); viewer.vr = {}; viewer.vp = {}; viewer.item = it; viewer.level = 'low'; }
    CL.view = it; CL.preview = it;
    if (!clBody.childElementCount) clRender(); else clDetail();
    if (CL.sheet === 'full' && portrait()) setSheet('half');
    await syncOutfit(); if (CL.view === it) focus(it);
  }
  function closeDetail() { const was = CL.view; if (!was) return; CL.view = null; CL.preview = null; if (deptOf(was) === 'hair') viewer.item = null; if (/^#item\//.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); syncOutfit(); focus(null); clDetail(); }
  function clClose() { closeDetail(); }

  /* ---- the stage and the sheet (portrait: the panel is a sheet that drags up over her) */
  const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
  function setSheet(s) { CL.sheet = s; clEl.dataset.sheet = s; setTimeout(() => { resize(); if (!CL.view) focus(null); }, 260); }
  { const grip = $('#clGrip'); let y0 = null, h0 = 0, moved = false;
    grip.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = $('#clPanel').getBoundingClientRect().top; moved = false; grip.setPointerCapture(e.pointerId); clEl.classList.add('dragging'); });
    grip.addEventListener('pointermove', e => { if (y0 == null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 4) moved = true; clEl.style.setProperty('--sheet-top', Math.max(window.innerHeight * 0.06, Math.min(window.innerHeight * 0.7, h0 + dy)) + 'px'); });
    const up = e => { if (y0 == null) return; clEl.classList.remove('dragging'); const top = parseFloat(clEl.style.getPropertyValue('--sheet-top')) || 0; clEl.style.removeProperty('--sheet-top'); y0 = null; if (!moved) setSheet(CL.sheet === 'full' ? 'half' : 'full'); else setSheet(top < window.innerHeight * 0.32 ? 'full' : 'half'); };
    grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up); }
  new ResizeObserver(() => { if (CL.on && canvas.parentElement === $('#clStage')) { resize(); if (!CL.goal && !CL.view) focus(null); } }).observe($('#clStage'));
  // the menu under the Grug button: the editors and the Hair Studio
  $('#clMenuBtn').onclick = e => { e.stopPropagation(); const m = $('#clMenu'), open = m.hidden; $$('.rollmenu').forEach(x => x.hidden = true); m.hidden = !open; };
  { const m = $('#clMenu'); m.innerHTML = [['#edit', 'glasses', 'Eyewear editor'], [HAIR_STUDIO, 'hair', 'Hair Studio'], ['#edit/earrings', 'diamond', 'Earrings editor'], ['#edit/necklaces', 'flower', 'Necklace editor'], ['#edit/purses', 'shopping_bag', 'Purse editor'], ['#edit/sandals', 'sun', 'Sandal editor'], ['#edit/sound', 'note', 'Sound editor'], ['#edit/back', 'sword', 'Sword studio'], ['#edit/tops', 'shirt', 'Tops studio'], ['#edit/jackets', 'jacket', 'Jackets studio'], ['#edit/bottoms', 'pants', 'Bottoms studio'], ['#edit/shoes', 'shoe', 'Shoes studio'], ['#edit/outfits', 'outfit', 'Outfits studio']].filter(x => x[0] !== HAIR_STUDIO || HD).map(([h, i, l]) => `<a role="menuitem" href="${h}">${ic(i)}<span><b>${esc(l)}</b></span></a>`).join(''); GRUG.hydrate(m); }

  /* ---- in and out */
  let clReady = false;
  async function clEnter(hash) {
    if (!CL.on && !store.get(CL_KEY, null)) clSave(); else if (!CL.on) { try { const c = JSON.parse(localStorage.getItem('grug.sandy.v1') || 'null'); if (!c || !c.closet) playAsCloset(); } catch (e) {} }
    const first = !CL.on; CL.on = true; showPage('closet'); look(true); if (worn) worn.root.visible = false; setHair(true);
    if (canvas.parentElement !== $('#clStage')) { canvas.classList.remove('hovercv'); $('#clStage').prepend(canvas); resize(); }
    ZOOM[0] = 40; ZOOM[1] = 560; floor.visible = true; spin.on = false;
    if (first) { if (!FEED.seed) newFeed(true); if (!clReady) { clReady = true; await applyBody(false); remember(); } else look(true); }
    $('#clLoading').classList.add('gone');
    if (/^#item\//.test(hash)) { if (first) clRender(); await clOpen(decodeURIComponent(hash.slice(6))); if (first) { CL.goal = CL.goal || fullBody(); } return; }
    if (CL.view) clClose(); else { clRender(); await syncOutfit(); if (first) { CL.goal = fullBody(); Object.assign(cam, { yaw: CL.goal.yaw, pitch: CL.goal.pitch, dist: CL.goal.dist }); cam.target.copy(CL.goal.target); } }
  }
  function clLeave() {
    if (!CL.on) return; CL.on = false; CL.view = null; CL.preview = null; for (const s of SLOTS) unmountSlot(s); for (const k of Object.keys(CL.tok)) CL.tok[k]++;
    look(false); paintBody(GREY); floor.visible = false; ZOOM[0] = 45; ZOOM[1] = 210; if (worn) worn.root.visible = true; setHair(false); JM.syncDress(); clBody.innerHTML = ''; clDet.innerHTML = '';
  }
  // card pictures always show the grey mannequin, and no floor
  // ... and only the piece being pictured: her own clothes come off for the moment (the basic outfit, in the mannequin's colour)
  { const snap0 = snapScene; snapScene = function (c, h) {
    const real = CL.real, fv = floor.visible, w = CL.on && sandy.__wear, keep = w && w.on, solo = w && Object.fromEntries(Object.entries(keep).filter(([, d]) => d.__pic));
    const strip = w && Object.keys(keep).length !== Object.keys(solo).length; if (strip) { w.on = solo; J.clothSync(sandy); }
    if (real) look(false); floor.visible = false;
    try { return snap0(c, h); } finally { floor.visible = fv; if (strip) { for (const k of Object.keys(solo)) keep[k] = w.on[k] || keep[k]; for (const k of Object.keys(keep)) if (keep[k].__pic && !w.on[k]) delete keep[k]; w.on = keep; J.clothSync(sandy); } if (real) look(true); }
  }; }
  { const hf0 = hideFaceHair; hideFaceHair = function () { hf0(); if (CL.real && sandy.n3.faceMesh) sandy.n3.faceMesh.visible = true; }; }
  { const sd0 = JM.syncDress; JM.syncDress = function () { sd0.call(JM); if (CL.on && sandy.__cut) sandy.__cut.constant = 1e5; }; }
  // routing: the closet is the catalog now (#item/… opens a piece in it); the editors are unchanged
  route = function () {
    hoverEnd(); const h = location.hash, jm = /^#edit\/(earrings|necklaces|purses|sandals|sound|back|tops|jackets|bottoms|shoes|outfits)/.exec(h);
    if (/^#edit/.test(h)) { clLeave(); if (!jm) JM.leave(); enterEditor(); if (jm) JM.enter(jm[1]); return; }
    JM.leave(); clEnter(h);
  };
  // the old catalog's renderer draws the closet's grid when the closet is showing (its filters call it)
  { const rc0 = renderCatalog; renderCatalog = function () { if (CL.on) { newFeed(false); return clRender(); } return rc0(); }; }
  Object.assign(CL, { applyBody, look, focus, syncOutfit, clRender, newFeed, FEED, setSiteMode });
