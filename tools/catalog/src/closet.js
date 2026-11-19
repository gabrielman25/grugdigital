  /* ================================================================ the closet: the catalog and the avatar editor in one
     Laid out like Roblox's avatar editor. Her stage on one side (landscape: right; portrait: on top, with the panel as a
     sheet that drags up over her), and the panel with two modes:
       Marketplace  every department's items; open one and she tries it on while its details show (Back, or Add to wardrobe)
       Customize    the wardrobe (one piece per category on her at a time) and her body: skin, face, feet and build
     She is the classic female avatar in her own colours here; card pictures still show the grey mannequin (look(false)
     while a picture is taken). Saved on this device: 'grug.closet.v1' = { wardrobe, wearing, body }. */
  const CL_KEY = 'grug.closet.v1';
  const CL_DEPTS = [['eyewear', 'Eyewear', 'glasses'], ['hair', 'Hair', 'hair'], ['earrings', 'Earrings', 'diamond'], ['necklaces', 'Necklaces', 'flower'], ['purses', 'Purses', 'shopping_bag'], ['sandals', 'Sandals', 'sun'], ['sound', 'Sound', 'note']].filter(x => x[0] !== 'hair' || HD);
  const CL_DLABEL = Object.fromEntries(CL_DEPTS.map(x => [x[0], x[1]]));
  const BUILD_SL = [['height', 'Height', 0.9, 1.1], ['shoulders', 'Shoulders', 0.8, 1.25], ['upperTorso', 'Upper body', 0.85, 1.2], ['lowerTorso', 'Lower body', 0.85, 1.2], ['hips', 'Hips', 0.8, 1.3], ['neck', 'Neck', 0.8, 1.3],
    ['upperArm', 'Upper arms', 0.8, 1.25], ['forearm', 'Forearms', 0.8, 1.25], ['handSize', 'Hands', 0.8, 1.3], ['thigh', 'Thighs', 0.8, 1.3], ['shin', 'Lower legs', 0.8, 1.25], ['footLength', 'Foot length', 0.85, 1.2], ['toeLength', 'Toe length', 0.7, 1.3]];
  const EXPR_LABEL = e => e.charAt(0).toUpperCase() + e.slice(1);
  const BODY0 = () => ({ skin: '#d9a67e', nails: '', expression: 'smug', footShape: 'none', build: {} });
  const CL = {
    on: false, mode: 'market', mdept: 'all', cdept: 'body', bsub: 'skin', view: null, preview: null, q: '', filters: false,
    wardrobe: [], wearing: {}, body: BODY0(), mounted: {}, tok: {}, goal: null, hist: { stack: [], i: -1 }, sheet: 'half', real: false, shapeKey: ''
  };
  { const s = store.get(CL_KEY, null); if (s) { CL.wardrobe = Array.isArray(s.wardrobe) ? s.wardrobe : []; CL.wearing = s.wearing || {}; CL.body = Object.assign(BODY0(), s.body || {}); CL.body.build = Object.assign({}, (s.body && s.body.build) || {}); } else if (HD && HD.byId('h:long')) { const h = HD.byId('h:long'); CL.wardrobe = [{ id: h.id, dept: 'hair', name: h.name, by: h.by }]; CL.wearing = { hair: h.id }; } }
  const clSave = () => { if (!store.set(CL_KEY, { wardrobe: CL.wardrobe, wearing: CL.wearing, body: CL.body })) GRUG.toast('Your browser is out of room for your wardrobe'); };

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
    const NU = sandy.n3._nailU; if (NU && NU.nailAmt) NU.nailAmt.value = real && CL.body.nails ? 1 : 0;
  }
  // her settings onto her (the kit recolours her skin itself); then the colours she shows here are kept for look(true)
  let applying = null;
  async function applyBody(refit) {
    const b = CL.body, c = JSON.parse(JSON.stringify(sandy.getConfig())), key = JSON.stringify([b.footShape, b.build]);
    Object.assign(c, { skin: b.skin, nails: b.nails || b.skin, expression: b.expression, footShape: b.footShape, feet: Object.assign({}, c.feet, { type: 'flipflops', sole: '#f2efe6', strap: '#d9d2c4' }) });
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
    if (CL.on) look(true);
    if (!CL.on) look(false);
    if (reshape && refit !== false) { delete sandy.__jfield; delete sandy.__jsnd; const n3 = sandy.n3; n3.__skinW = null; n3.__rest0 = null; for (const d of ['necklaces', 'purses', 'sandals', 'sound']) if (CL.mounted[d]) { const it = CL.mounted[d].it; unmountDept(d); await mountDept(d, it); } }
  }
  const bodyLater = () => { clearTimeout(bodyLater.t); bodyLater.t = setTimeout(() => { applying = applyBody().catch(e => console.warn('body', e)); }, 120); };

  /* ---- the wardrobe and what she has on */
  const entryOf = it => { const dp = deptOf(it); return dp === 'hair' ? { id: it.id, dept: 'hair', name: it.name, by: it.by } : { id: it.id, dept: dp, seed: it.seed, d: it.d, name: it.name, by: it.by, brand: it.brand }; };
  const owned = id => CL.wardrobe.some(e => e.id === id);
  function itemOf(e) {
    if (!e) return null;
    if (e.dept === 'hair') return HD ? HD.byId(e.id) : null;
    if (e.dept === 'eyewear') { const d = GE.validate(e.d).d; return { id: e.id, seed: e.seed, d, name: e.name, kind: GE.classify(d), by: e.by || 'Grug Digital', brand: e.brand || 'grug', order: 0, stamp: 0 }; }
    return JM.item(e.dept, e.id, e.seed, e.d, { name: e.name, by: e.by, brand: e.brand || (e.d && e.d.brand) || 'grug', gen: false });
  }
  const wardrobeItems = dept => CL.wardrobe.filter(e => !dept || dept === 'all' || e.dept === dept).map(e => { const it = itemOf(e); if (it) it._entry = e; return it; }).filter(Boolean);
  const wornItem = dept => { const id = CL.wearing[dept]; return id ? itemOf(CL.wardrobe.find(e => e.id === id)) : null; };
  async function mountDept(dept, it) {
    const tok = (CL.tok[dept] = (CL.tok[dept] || 0) + 1); unmountDept(dept); if (!it) return; let b;
    try {
      if (dept === 'eyewear') { b = GE.build(it.d, hm, { seed: it.seed }); b.root.userData.catalogItem = true; headGroup.add(b.root); }
      else if (dept === 'hair') { b = await HD.live(it, 'low'); if (tok !== CL.tok[dept] || !CL.on) { b.dispose(); return; } headGroup.add(b.root); }
      else b = JM.mountItem(it);
    } catch (e) { console.warn('wear', dept, e); return; }
    if (tok !== CL.tok[dept] || !CL.on) { if (isJ(it)) JM.unmount(b); else { if (b.root.parent) b.root.parent.remove(b.root); b.dispose(); } return; }
    CL.mounted[dept] = { it, b };
  }
  function unmountDept(dept) { const m = CL.mounted[dept]; if (!m) return; delete CL.mounted[dept]; if (isJ(m.it)) JM.unmount(m.b); else { if (m.b.root.parent) m.b.root.parent.remove(m.b.root); m.b.dispose(); } }
  // put on what she's wearing, with the piece being tried on in its place
  async function syncOutfit() {
    const want = {}; for (const [d] of CL_DEPTS) want[d] = wornItem(d); if (CL.preview) want[deptOf(CL.preview)] = CL.preview;
    await Promise.all(CL_DEPTS.map(([d]) => { const it = want[d], m = CL.mounted[d]; if ((it && m && m.it.id === it.id) || (!it && !m)) return null; return mountDept(d, it); }));
  }
  function clWear(it, on) { const dp = deptOf(it); if (on) CL.wearing[dp] = it.id; else if (CL.wearing[dp] === it.id) delete CL.wearing[dp]; clSave(); remember(); syncOutfit().then(() => focus(on ? it : null)); clRender(); }
  function addToWardrobe(it) { if (!owned(it.id)) CL.wardrobe.unshift(entryOf(it)); CL.wearing[deptOf(it)] = it.id; clSave(); remember(); GRUG.toast('Added to your wardrobe'); clRender(); }
  function removeFromWardrobe(it) { CL.wardrobe = CL.wardrobe.filter(e => e.id !== it.id); for (const d of Object.keys(CL.wearing)) if (CL.wearing[d] === it.id) delete CL.wearing[d]; clSave(); remember(); syncOutfit(); clRender(); GRUG.toast('Removed from your wardrobe'); }
  // undo / redo of what she has on and her body
  const snapOf = () => JSON.stringify({ wearing: CL.wearing, body: CL.body });
  function remember() { const h = CL.hist, j = snapOf(); if (h.stack[h.i] === j) return; h.stack = h.stack.slice(0, h.i + 1); h.stack.push(j); if (h.stack.length > 80) h.stack.shift(); h.i = h.stack.length - 1; undoState(); }
  async function restoreSnap(j) { const s = JSON.parse(j), bodyChanged = JSON.stringify(s.body) !== JSON.stringify(CL.body); CL.wearing = s.wearing; CL.body = s.body; clSave(); if (bodyChanged) await applyBody(); await syncOutfit(); clRender(); undoState(); }
  function undoState() { const h = CL.hist; $('#clUndo').disabled = h.i <= 0; $('#clRedo').disabled = h.i >= h.stack.length - 1; }
  $('#clUndo').onclick = () => { const h = CL.hist; if (h.i > 0) { h.i--; restoreSnap(h.stack[h.i]); } };
  $('#clRedo').onclick = () => { const h = CL.hist; if (h.i < h.stack.length - 1) { h.i++; restoreSnap(h.stack[h.i]); } };

  /* ---- the camera: her whole body, or close on a piece; it glides there */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d9dbe1').convertSRGBToLinear() }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.2; floor.userData.catalogItem = true; floor.visible = false; scene.add(floor);
  function goalFor(box, yaw, pitch, fill) {
    const sph = box.getBoundingSphere(new THREE.Sphere()), size = box.getSize(new THREE.Vector3()), t = Math.tan(15 * Math.PI / 180), asp = Math.max(0.3, camera.aspect || 1);
    const d = Math.max(size.y / 2 / t, Math.max(size.x, size.z) / 2 / (t * asp), sph.radius * 0.9 / t) * (fill || 1.12);
    return { target: sph.center.clone(), dist: d, yaw, pitch };
  }
  function fullBody() { sandy.object3d.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(sandy.n3.headMesh); for (const d of ['hair', 'sound', 'eyewear']) if (CL.mounted[d]) hb.union(new THREE.Box3().setFromObject(CL.mounted[d].b.root)); const top = hb.max.y + (portrait() ? 16 : 8), box = new THREE.Box3(new THREE.Vector3(-30, -3, -14), new THREE.Vector3(30, top, 14)); return goalFor(box, 0.32, 0.04, 1.1); }
  function focus(it) {
    if (!it) { CL.goal = fullBody(); return; } const m = CL.mounted[deptOf(it)]; if (!m) { CL.goal = fullBody(); return; }
    sandy.object3d.updateMatrixWorld(true); let box;
    if (isJ(it)) box = JM.frameBox(m.b.root, it); else box = new THREE.Box3().setFromObject(m.b.root).union(new THREE.Box3().setFromObject(sandy.n3.headMesh));
    const dp = deptOf(it); if (dp === 'necklaces' || dp === 'purses') box.expandByVector(new THREE.Vector3(6, 6, 6)); if (dp === 'sandals') box.expandByVector(new THREE.Vector3(8, 8, 8));
    const g = goalFor(box, dp === 'earrings' ? 0.9 : dp === 'purses' ? 0.3 : 0.55, dp === 'sandals' ? 0.25 : 0.08, 1.35); g.dist = Math.max(g.dist, dp === 'necklaces' || dp === 'purses' || dp === 'sandals' ? 90 : 75); CL.goal = g;
  }
  $('#clReset').onclick = () => focus(null);
  let clLast = performance.now();
  (function glide(now) {
    const dt = Math.min(0.05, (now - clLast) / 1000); clLast = now;
    if (CL.on && CL.goal && !drag) { const g = CL.goal, k = 1 - Math.exp(-dt * 7); cam.target.lerp(g.target, k); cam.dist += (g.dist - cam.dist) * k; let dy = g.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * k; cam.pitch += (g.pitch - cam.pitch) * k; if (Math.abs(g.dist - cam.dist) < 0.3 && Math.abs(dy) < 0.003) CL.goal = null; }
    requestAnimationFrame(glide);
  })(clLast);
  canvas.addEventListener('pointerdown', () => { if (CL.on) CL.goal = null; });
  canvas.addEventListener('wheel', () => { if (CL.on) CL.goal = null; }, { passive: true });

  /* ---- the page around her */
  const clEl = $('#closet'), clBody = $('#clBody');
  function setMode(m) { CL.mode = m; CL.filters = false; $$('#clMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === m)); if (CL.view) { location.hash = ''; return; } clRender(); clBody.scrollTop = 0; }
  $$('#clMode button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  function tabBtn(box, v, label, on, go, icon) { const b = el('button', on ? 'on' : '', (icon ? ic(icon) : '') + `<span>${esc(label)}</span>`); b.onclick = go; box.append(b); return b; }
  function clTabs() {
    const t = $('#clTabs'), s = $('#clSubs'); t.innerHTML = ''; s.innerHTML = '';
    if (CL.mode === 'market') {
      for (const [v, label] of DEPTS) { if (v === 'yours' && !mineItems().length) continue; tabBtn(t, v, v === 'all' ? 'All' : label, cat.dept === v, () => { if (cat.dept !== v) Object.assign(cat, RESET()); cat.dept = v; cat.sub = 'all'; cat.count = 48; CL.filters = false; if (CL.view) location.hash = ''; else { clRender(); clBody.scrollTop = 0; } }); }
      const subs = SUBS[cat.dept] || []; s.hidden = !subs.length || !!CL.view;
      if (subs.length) { tabBtn(s, 'all', 'All', cat.sub === 'all', () => { cat.sub = 'all'; clRender(); }); for (const [sv, sl] of subs) tabBtn(s, sv, sl, cat.sub === sv, () => { cat.sub = sv; cat.count = 48; clRender(); clBody.scrollTop = 0; }); }
    } else {
      tabBtn(t, 'body', 'Body', CL.cdept === 'body', () => { CL.cdept = 'body'; clRender(); }); tabBtn(t, 'all', 'All', CL.cdept === 'all', () => { CL.cdept = 'all'; clRender(); });
      for (const [v, label] of CL_DEPTS) tabBtn(t, v, label, CL.cdept === v, () => { CL.cdept = v; clRender(); clBody.scrollTop = 0; });
      s.hidden = CL.cdept !== 'body';
      if (CL.cdept === 'body') for (const [v, l] of [['skin', 'Skin'], ['face', 'Face'], ['feet', 'Feet'], ['build', 'Build']]) tabBtn(s, v, l, CL.bsub === v, () => { CL.bsub = v; clRender(); });
    }
    $('#clTools').hidden = CL.mode !== 'market' || !!CL.view;
    GRUG.hydrate(t);
  }
  // the marketplace's search box and filters (the catalog's own refine, brand and colour filters, moved in here)
  $('#clSearch').oninput = e => { cat.q = e.target.value; cat.count = 48; clRender(); };
  $('#clFilterBtn').onclick = () => { CL.filters = !CL.filters; clRender(); };
  $('#clSort').onchange = e => { cat.sort = e.target.value; clRender(); };
  function sortItems(items) {
    if (cat.sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (cat.sort === 'yours') items.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || a.order - b.order);
    else if (cat.dept === 'favs') { const at = id => favs.findIndex(f => f.id === id); items.sort((a, b) => at(a.id) - at(b.id)); }
    else items.sort((a, b) => a.order - b.order);
    return items;
  }
  let clGen = 0;
  const more = new IntersectionObserver(es => { if (CL.on && CL.mode === 'market' && !CL.view && es.some(e => e.isIntersecting) && cat.count < 2000) { cat.count += 24; const top = clBody.scrollTop; clRender(); clBody.scrollTop = top; } }, { root: clBody, rootMargin: '500px' });
  function marketGrid(box) {
    clGen++; jobs.length = 0;
    const all = allItems(); let items = sortItems(all.filter(it => passes(it)));
    const fp = $('#clFilters'); fp.hidden = !CL.filters; $('#clFilterBtn').classList.toggle('on', CL.filters || REFINE_KEYS.some(k => cat[k] !== 'any') || cat.colour !== 'any' || cat.brand !== 'any');
    if (CL.filters) { renderFilters(all); fp.append($('#fRefine')); $('#clSort').value = cat.sort; GRUG.hydrate(fp); }
    const total = items.length; items = items.slice(0, Math.max(60, cat.count * 2));
    box.append(el('div', 'cl-count', `${total.toLocaleString()} ${total === 1 ? 'item' : 'items'}`));
    const grid = el('div', 'cgrid cl-grid'); box.append(grid);
    if (!items.length) grid.append(el('div', 'cload', cat.dept === 'favs' && !favs.length ? 'No favourites yet. Tap the star on anything to start a collection.' : 'Nothing matches that. Try another filter.'));
    for (const it of items) { const a = card(it, 'worn', { gen: clGen }); if (CL.wearing[deptOf(it)] === it.id) a.classList.add('wearing'); if (owned(it.id)) a.querySelector('.ct').append(el('span', 'g-pill g-pill--solid tag own', 'Owned')); grid.append(a); seen.observe(a); }
    if (total > items.length) { const s = el('div', 'cl-more'); box.append(s); more.observe(s); }
  }
  function wardrobeGrid(box, dept) {
    const items = wardrobeItems(dept), grid = el('div', 'cgrid cl-grid'); box.append(grid);
    if (!items.length) {
      const e = el('div', 'cl-empty', `<b>${dept === 'all' ? 'Your wardrobe is empty' : 'No ' + esc((CL_DLABEL[dept] || '').toLowerCase()) + ' yet'}</b><span>Find something in the Marketplace, then Add to wardrobe.</span>`), b = el('button', 'g-btn g-btn--primary', `${ic('shopping_bag')}<span>Go to the Marketplace</span>`);
      b.onclick = () => { if (dept !== 'all') { Object.assign(cat, RESET()); cat.dept = dept; cat.sub = 'all'; } setMode('market'); }; e.append(b); grid.append(e); GRUG.hydrate(e); return;
    }
    for (const it of items) {
      const on = CL.wearing[deptOf(it)] === it.id, a = card(it, 'worn', { gen: -1 }); a.removeAttribute('href'); a.classList.toggle('wearing', on); a.setAttribute('role', 'button'); a.setAttribute('aria-pressed', on ? 'true' : 'false');
      a.addEventListener('click', e => { if (e.target.closest('.fav,.cl-rm')) return; e.preventDefault(); clWear(it, !(CL.wearing[deptOf(it)] === it.id)); });
      const rm = el('button', 'cl-rm', ic('trash_can')); rm.setAttribute('aria-label', 'Remove from your wardrobe'); rm.setAttribute('data-g-tip', 'Remove from your wardrobe'); rm.onclick = e => { e.preventDefault(); e.stopPropagation(); removeFromWardrobe(it); };
      a.querySelector('.ct').append(rm, el('span', 'g-pill g-pill--solid tag wtag', on ? 'Wearing' : 'Wear')); grid.append(a); a._thumb();
    }
    GRUG.hydrate(grid);
  }
  function bodyPanel(box) {
    const b = CL.body, grp2 = (label, note) => { const g = el('div', 'cl-grp', `<div class="g-label">${esc(label)}</div>`); if (note) g.append(el('div', 'cl-note', esc(note))); box.append(g); return g; };
    const change = (patch, now) => { Object.assign(b, patch); clSave(); if (now) { applying = applyBody(); remember(); clRender(); } else bodyLater(); };
    if (CL.bsub === 'skin') {
      const g = grp2('Skin tone'), row = el('div', 'cl-sws');
      for (const c of K.CATALOG.skinTones.filter(x => x !== '#ffffff').concat(['#f7dcc8', '#e8b48f', '#c98d63', '#a46c46', '#6f4428', '#3f2718'])) { const s = el('button', 'cl-sw' + (b.skin.toLowerCase() === c ? ' on' : '')); s.style.background = c; s.setAttribute('aria-label', 'Skin ' + c); s.onclick = () => change({ skin: c }, true); row.append(s); }
      const inp = el('input'); inp.type = 'color'; inp.value = b.skin; inp.className = 'cl-pick'; inp.setAttribute('aria-label', 'Any skin colour'); inp.oninput = () => { b.skin = inp.value; bodyLater(); }; inp.onchange = () => change({ skin: inp.value }, true); row.append(inp); g.append(row);
      const g2 = grp2('Nails'), row2 = el('div', 'cl-sws');
      for (const [c, l] of [['', 'Natural'], ['#e3101c', 'Red'], ['#ff6fb0', 'Pink'], ['#121212', 'Black'], ['#7d3fc4', 'Purple'], ['#4fd8e0', 'Aqua'], ['#f4f4f2', 'White']]) { const s = el('button', 'cl-sw' + ((b.nails || '') === c ? ' on' : '')); s.style.background = c || b.skin; s.setAttribute('aria-label', l); s.setAttribute('data-g-tip', l); s.onclick = () => change({ nails: c }, true); row2.append(s); }
      g2.append(row2);
    } else if (CL.bsub === 'face') {
      const g = grp2('Expression'), row = el('div', 'cl-chips');
      for (const x of K.CATALOG.expressions) { const s = el('button', b.expression === x ? 'on' : '', esc(EXPR_LABEL(x))); s.onclick = () => change({ expression: x }, true); row.append(s); }
      g.append(row);
    } else if (CL.bsub === 'feet') {
      const g = grp2('Foot shape', 'Sandals are fitted to whichever feet she has.'), row = el('div', 'cl-chips');
      K.CATALOG.footShapes.forEach((x, i) => { const s = el('button', b.footShape === x ? 'on' : '', i ? 'Shape ' + i : 'Natural'); s.onclick = () => change({ footShape: x }, true); row.append(s); });
      g.append(row);
      const g2 = grp2('Size'); for (const k of ['footLength', 'toeLength']) slider(g2, BUILD_SL.find(x => x[0] === k));
    } else {
      const g = grp2('Build', 'Her head stays the same size, so everything she wears on it still fits.'); for (const s of BUILD_SL.filter(x => x[0] !== 'footLength' && x[0] !== 'toeLength')) slider(g, s);
      const r = el('button', 'g-btn g-btn--sm', `${ic('arrow_counterclockwise')}<span>Reset her build</span>`); r.onclick = () => { b.build = {}; change({}, true); }; g.append(r);
    }
    function slider(g, [k, label, lo, hi]) {
      const v = b.build[k] == null ? 1 : b.build[k], row = el('label', 'cl-sl', `<span class="lb">${esc(label)}</span><span class="val">${Math.round(v * 100)}%</span>`), r = el('input', 'g-range'); r.type = 'range'; r.min = lo; r.max = hi; r.step = 0.01; r.value = v;
      r.oninput = () => { row.querySelector('.val').textContent = Math.round(+r.value * 100) + '%'; b.build[k] = +r.value; bodyLater(); }; r.onchange = () => { b.build[k] = +r.value; change({}, false); remember(); };
      row.append(r); g.append(row);
    }
    GRUG.hydrate(box);
  }
  // the enlarged item, in the panel; she tries it on in the stage
  const likeOf = it => {
    const dp = deptOf(it), r = rng('like:' + it.id);
    if (dp === 'hair') { const pool = HD.styleItems().filter(x => x.id !== it.id); return pool.filter(x => x.base === it.base).slice(0, 3).concat(pool.filter(x => x.base !== it.base && x.length === it.length).slice(0, 3)); }
    if (isJ(it)) return Array.from({ length: 6 }, (_, i) => JM.gen(dp, 'like-' + it.seed + '-' + i));
    const arch = { glasses: ['classic', 'wire', 'rose', 'readers', 'browline'], shades: ['shades', 'aviators', 'catshades', 'party', 'sport'], goggles: ['goggles', 'ski', 'steampunk'] }[it.kind] || ['classic'];
    return Array.from({ length: 6 }, (_, i) => { const seed = 'like-' + it.seed + '-' + i; if (genCache.has(seed)) return genCache.get(seed); const d = GE.random(seed, { arch: r.pick(arch) }), li = { id: 'g:' + seed, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: i, stamp: 0, gen: true }; genCache.set(seed, li); return li; });
  };
  function itemPanel(box, it) {
    const dp = deptOf(it), hair = dp === 'hair', mineIt = owned(it.id), on = CL.wearing[dp] === it.id;
    const kind = hair ? it.length.charAt(0).toUpperCase() + it.length.slice(1) : isJ(it) ? J.KIND_LABEL[it.kind] || it.kind : GE.CLASS_LABEL[it.kind];
    const tags = hair ? it.tags.filter(t => t !== 'yours').map(t => t.charAt(0).toUpperCase() + t.slice(1)) : isJ(it) ? J.tagsFor(dp, it.d) : GE.tagsFor(it.d);
    const v = el('div', 'cl-item');
    v.innerHTML = `<div class="cl-ihead"><button class="g-btn g-btn--ghost g-btn--sm" data-back>${ic('arrow_left')}<span>Back</span></button><div class="crumbs"><span>${esc(deptLabel(dp))}</span><i class="sep">›</i><span>${esc(kind || '')}</span></div></div>
      <div class="cl-iwrap"><div class="cl-ipic" style="background-color:${cardColour(it)}"><span class="wait"></span></div>
      <div class="cl-iinfo"><h2 class="g-h3">${esc(it.name)}</h2><div class="cl-by">${byHTML(it)}</div><div class="chips">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div><div class="cl-price">Free</div>
      <div class="cl-acts"><button class="g-btn g-btn--primary g-btn--lg" data-add>${mineIt ? ic('star') + '<span>' + (on ? 'In your wardrobe, wearing it' : 'In your wardrobe') + '</span>' : ic('plus_in_circle') + '<span>Add to wardrobe</span>'}</button><button class="g-btn g-btn--lg" data-back>${ic('arrow_left')}<span>Back</span></button></div>
      <div class="cl-acts2"><button class="g-btn g-btn--sm favbtn${isFav(it.id) ? ' on' : ''}" data-fav>${ic('star')}<span>${isFav(it.id) ? 'Favorited' : 'Favorite'}</span></button><span class="rollbtn"><button class="g-btn g-btn--sm" data-dl>${ic('file_arrow_down')}<span>Download</span>${ic('dropdown')}</button><div class="rollmenu fmtmenu" hidden></div></span><button class="g-btn g-btn--sm g-btn--ghost" data-edit>${ic('pencil')}<span>${hair ? 'Edit in the Hair Studio' : 'Edit'}</span></button></div></div></div>
      <p class="cl-desc">${esc(hair ? it.desc : isJ(it) ? J.describe(dp, it.d) : GE.describe(it.d))}</p><div class="g-label">Details</div><dl class="specs">${hair ? [['Style', esc(it.style)], ['Length', esc(kind)], ['Colour', swatch(it.sw) + esc(it.colour)]].map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') : isJ(it) ? JM.specRows(it) : specRows(it.d)}</dl>
      <h3 class="g-h4 cl-like-h">More like this</h3><div class="cgrid cl-grid" data-like></div>`;
    box.append(v);
    const pic = v.querySelector('.cl-ipic'), cb = u => { pic.style.backgroundImage = `url(${u})`; const w = pic.querySelector('.wait'); if (w) w.remove(); }; cb.alive = () => document.body.contains(pic); queueThumb(it, 'worn', cb, true);
    for (const b of v.querySelectorAll('[data-back]')) b.onclick = () => { location.hash = ''; };
    v.querySelector('[data-add]').onclick = () => { if (!mineIt) addToWardrobe(it); else if (!on) { CL.wearing[dp] = it.id; clSave(); remember(); clRender(); } };
    v.querySelector('[data-fav]').onclick = () => { toggleFav(it); clRender(); };
    formatMenu(v.querySelector('[data-dl]'), v.querySelector('.fmtmenu'), () => it);
    v.querySelector('[data-edit]').onclick = () => {
      if (hair) { location.href = HAIR_STUDIO + '#item/' + encodeURIComponent(it.studioId); return; }
      if (isJ(it)) { JM.load(dp, it.d, { name: it.name, seed: it.seed, autoName: false }); JM.on = false; store.set(JKEY(dp), { d: JM.st.d, name: JM.st.name, seed: JM.st.seed, autoName: false }); JM.st = null; location.hash = '#edit/' + dp; return; }
      loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false, brand: it.brand }); commit(); location.hash = '#edit';
    };
    const like = v.querySelector('[data-like]'); for (const li of likeOf(it)) { const a = card(li, 'worn', { gen: -1 }); like.append(a); a._thumb(); }
    GRUG.hydrate(v);
  }
  function clRender() {
    if (!CL.on) return; clTabs(); const box = clBody; box.innerHTML = ''; clEl.dataset.mode = CL.mode; clEl.classList.toggle('viewing', !!CL.view);
    if (CL.view) itemPanel(box, CL.view);
    else if (CL.mode === 'market') marketGrid(box);
    else if (CL.cdept === 'body') bodyPanel(box);
    else wardrobeGrid(box, CL.cdept);
    if (CL.mode !== 'market' || CL.view) $('#clFilters').hidden = true;
    GRUG.hydrate(box);
  }
  // a piece opened from the marketplace: she tries it on (one per category, so it takes that category's place)
  async function clOpen(id) {
    const it = itemById(id); if (!it) { location.hash = ''; return; }
    if (deptOf(it) === 'hair') { viewer.token++; for (const k of Object.keys(viewer.vr)) HD.disposeVersion(viewer.vr[k]); viewer.vr = {}; viewer.vp = {}; viewer.item = it; viewer.level = 'low'; }
    CL.mode = CL.mode || 'market'; $$('#clMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === CL.mode));
    CL.view = it; CL.preview = it; clRender(); clBody.scrollTop = 0; if (CL.sheet === 'full' && portrait()) setSheet('half');
    await syncOutfit(); if (CL.view === it) focus(it);
  }
  function clClose() { const was = CL.view; CL.view = null; CL.preview = null; if (deptOf(was || {}) === 'hair') viewer.item = null; syncOutfit(); focus(null); clRender(); }

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
  { const m = $('#clMenu'); m.innerHTML = [['#edit', 'glasses', 'Eyewear editor'], [HAIR_STUDIO, 'hair', 'Hair Studio'], ['#edit/earrings', 'diamond', 'Earrings editor'], ['#edit/necklaces', 'flower', 'Necklace editor'], ['#edit/purses', 'shopping_bag', 'Purse editor'], ['#edit/sandals', 'sun', 'Sandal editor'], ['#edit/sound', 'note', 'Sound editor']].filter(x => x[0] !== HAIR_STUDIO || HD).map(([h, i, l]) => `<a role="menuitem" href="${h}">${ic(i)}<span><b>${esc(l)}</b></span></a>`).join(''); GRUG.hydrate(m); }

  /* ---- in and out */
  let clReady = false;
  async function clEnter(hash) {
    const first = !CL.on; CL.on = true; showPage('closet'); look(true); if (worn) worn.root.visible = false; setHair(true);
    if (canvas.parentElement !== $('#clStage')) { canvas.classList.remove('hovercv'); $('#clStage').prepend(canvas); resize(); }
    ZOOM[0] = 40; ZOOM[1] = 560; floor.visible = true; spin.on = false;
    if (first) { look(true); if (!clReady) { clReady = true; await applyBody(false); remember(); } else look(true); }
    $('#clLoading').classList.add('gone');
    if (/^#item\//.test(hash)) { await clOpen(decodeURIComponent(hash.slice(6))); return; }
    if (CL.view) clClose(); else { clRender(); await syncOutfit(); if (first) { CL.goal = fullBody(); Object.assign(cam, { yaw: CL.goal.yaw, pitch: CL.goal.pitch, dist: CL.goal.dist }); cam.target.copy(CL.goal.target); } }
  }
  function clLeave() {
    if (!CL.on) return; CL.on = false; CL.view = null; CL.preview = null; for (const [d] of CL_DEPTS) unmountDept(d); for (const k of Object.keys(CL.tok)) CL.tok[k]++;
    look(false); paintBody(GREY); floor.visible = false; ZOOM[0] = 45; ZOOM[1] = 210; if (worn) worn.root.visible = true; setHair(false); JM.syncDress();
  }
  // card pictures always show the grey mannequin, and no floor
  { const snap0 = snapScene; snapScene = function (c, h) { const real = CL.real; if (real) look(false); try { return snap0(c, h); } finally { if (real) look(true); } }; }
  { const hf0 = hideFaceHair; hideFaceHair = function () { hf0(); if (CL.real && sandy.n3.faceMesh) sandy.n3.faceMesh.visible = true; }; }
  { const sd0 = JM.syncDress; JM.syncDress = function () { sd0.call(JM); if (CL.on && sandy.__cut) sandy.__cut.constant = 1e5; }; }
  // routing: the closet is the catalog now (#item/… opens a piece in it); the editors are unchanged
  route = function () {
    hoverEnd(); const h = location.hash, jm = /^#edit\/(earrings|necklaces|purses|sandals|sound)/.exec(h);
    if (/^#edit/.test(h)) { clLeave(); if (!jm) JM.leave(); enterEditor(); if (jm) JM.enter(jm[1]); return; }
    JM.leave(); clEnter(h);
  };
  // the old catalog's renderer draws the closet's grid when the closet is showing (its filters call it)
  { const rc0 = renderCatalog; renderCatalog = function () { if (CL.on) return clRender(); return rc0(); }; }
