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
  // her saved characters: a look (what she has on and her body) under a name, with a pose for its picture
  { const s = store.get(CL_KEY, null); CL.characters = s && Array.isArray(s.characters) ? s.characters.filter(c => c && c.wearing && c.body) : []; }
  // the classic avatar's own long hair and buns (her stock hairstyles 0 and 1), in every wardrobe from the start (once: a player
  // can still remove them). Worn, her own hair takes that style in its colour (entry.col); the game runtime does the same
  const KIT_HAIR = [['kit:long', 0, 'Classic long hair', 'long'], ['kit:buns', 1, 'Classic buns', 'medium']], KIT_HAIR_COL = '#2a1a12';
  const kitHairItem = (id, col) => { const k = KIT_HAIR.find(x => x[0] === id); if (!k) return null; const c = col || KIT_HAIR_COL;
    return { id, dept: 'hair', kit: k[1], name: k[2], by: 'Grug Digital', brand: 'grug', length: k[3], style: 'Classic', tags: ['classic', k[3]], sw: c, hex: c, colour: J.colourName(c), desc: 'The classic avatar\'s own ' + (k[1] ? 'buns' : 'long hair') + ', in any colour.', base: id, stamp: col || 0, order: 0 }; };
  { const s = store.get(CL_KEY, null); if (!(s && s.kitHair)) { for (const [id, , name] of KIT_HAIR) if (!CL.wardrobe.some(e => e.id === id)) CL.wardrobe.push({ id, dept: 'hair', name, by: 'Grug Digital' }); CL.kitHair = 1; } else CL.kitHair = 1; }
  // the classic kit's clothing is gone (the Modular Anime Character pack replaced it): its pieces leave the wardrobe
  CL.wardrobe = CL.wardrobe.filter(e => e.dept !== 'clothing'); delete CL.wearing.clothing;
  for (const k of Object.keys(CL.wearing)) if (!CL.wardrobe.some(e => e.id === CL.wearing[k])) delete CL.wearing[k];
  // she is the player's avatar in games: the saved look ('grug.sandy.v1') says closet: true, stamped each time she changes
  // so the site's pictures of her are retaken (sandy-runtime.js builds her from 'grug.closet.v1' with assets/closet-runtime.js)
  function playAsCloset() {
    try {
      const K = 'grug.sandy.v1', CK = 'grug.sandy.classic.v1'; let c = JSON.parse(localStorage.getItem(K) || 'null');
      if (c && typeof c === 'object' && c.model !== 'block') { if (!localStorage.getItem(CK)) localStorage.setItem(CK, JSON.stringify(c)); c = null; }
      c = Object.assign({ model: 'block', skin: 'skaterFemaleA', hat: { type: 'none' } }, c || {}, { closet: true, classic: false, closetAt: Date.now(), avatarV: 2 });
      localStorage.setItem(K, JSON.stringify(c));
    } catch (e) {}
  }
  const clSave = () => { if (!store.set(CL_KEY, { wardrobe: CL.wardrobe, wearing: CL.wearing, body: CL.body, kitHair: 1, characters: CL.characters })) GRUG.toast('Your browser is out of room for your wardrobe'); clearTimeout(clSave.t); clSave.t = setTimeout(playAsCloset, 400); };

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
    endPose();
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
  const entryOf = it => { const dp = deptOf(it); return dp === 'hair' ? Object.assign({ id: it.id, dept: 'hair', name: it.name, by: it.by }, it._col ? { col: it._col } : {}) : { id: it.id, dept: dp, seed: it.seed, d: JSON.parse(JSON.stringify(it.d)), name: it.name, by: it.by, brand: it.brand }; };
  const owned = id => CL.wardrobe.some(e => e.id === id);
  const entryFor = id => CL.wardrobe.find(e => e.id === id);
  // her hair in any colour: every strand group, its tips and the scalp, in one flat colour
  function dyedHair(h, col) {
    if (!h || !col) return h;
    return Object.assign({}, h, { sw: col, hex: col, hex2: null, stamp: col, make: () => { const m = h.make(); for (const g of m.groups) { if (!g) continue; Object.assign(g, { tex: 'white', tint: col, tip: col, tipMix: 0, rainbow: 0, hlAmount: 0, hlTex: null, plain: true }); if (g.twinTex || g.twinTint) { g.twinTex = null; g.twinTint = col; } } if (m.scalp) Object.assign(m.scalp, { tex: 'white', tint: col, twinTex: null, twinTint: m.scalp.twinTint ? col : null, plain: true }); return m; } });
  }
  function itemOf(e) {
    if (!e) return null;
    if (e.dept === 'hair') { if (/^kit:/.test(e.id)) return kitHairItem(e.id, e.col); const h = HD ? HD.byId(e.id) : null; return e.col ? dyedHair(h, e.col) : h; }
    if (e.dept === 'eyewear') { const d = GE.validate(e.d).d; return { id: e.id, seed: e.seed, d, name: e.name, kind: GE.classify(d), by: e.by || 'Grug Digital', brand: e.brand || 'grug', order: 0, stamp: e.stamp || 0 }; }
    return JM.item(e.dept, e.id, e.seed, e.d, { name: e.name, by: e.by, brand: e.brand || (e.d && e.d.brand) || 'grug', gen: false, stamp: e.stamp || 0 });
  }
  const wardrobeItems = dept => CL.wardrobe.filter(e => !dept || dept === 'all' || e.dept === dept).map(e => { const it = itemOf(e); if (it) it._entry = e; return it; }).filter(Boolean);
  const wornItem = slot => { const id = CL.wearing[slot]; return id ? itemOf(entryFor(id)) : null; };
  const wornSig = it => it ? it.id + '|' + (it.stamp || 0) : '';
  // a classic hairstyle on her: her own hair mesh in that style, in its colour (card pictures hide it, as they hide all hair)
  function kitHairOn(it) {
    const n3 = sandy.n3, m = n3.hairMesh; if (!m) return { root: new THREE.Group(), dispose() {} };
    m.material = greyMat; n3.setHairStyle(it.kit);
    const mat = new THREE.MeshStandardMaterial({ map: greyMat.map, color: new THREE.Color(it.hex).convertSRGBToLinear(), side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
    m.material = mat; setHair(false);
    return { root: new THREE.Group(), dispose() { if (m.material === mat) { m.material = greyMat; setHair(true); } mat.dispose(); } };
  }
  // its card picture: the style on the mannequin's head, in the mannequin's colour
  { const th0 = thumbHair; thumbHair = async function (it, bodyColour) {
    if (it.kit == null) return th0(it, bodyColour);
    const n3 = sandy.n3, m = n3.hairMesh, st0 = n3.hairStyle, mat0 = m.material; m.material = greyMat; n3.setHairStyle(it.kit);
    const back = soloItem(null); sandy.object3d.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m).union(new THREE.Box3().setFromObject(n3.headMesh)); frameOn(box, 0.5, 0.12, thumbCam, 26, 1.0);
    const url = snapScene(bodyColour, false); back(); n3.setHairStyle(st0); m.material = mat0; return url;
  }; }
  async function mountSlot(slot, it) {
    const tok = (CL.tok[slot] = (CL.tok[slot] || 0) + 1); unmountSlot(slot); if (!it) return; let b;
    try {
      if (slot === 'eyewear') { b = GE.build(it.d, hm, { seed: it.seed }); b.root.userData.catalogItem = true; headGroup.add(b.root); }
      else if (slot === 'hair' && it.kit != null) b = kitHairOn(it);
      else if (slot === 'hair') { b = await HD.live(it, 'low'); if (tok !== CL.tok[slot] || !CL.on) { b.dispose(); return; } headGroup.add(b.root); }
      else { await J.prep(deptOf(it), it.d); if (tok !== CL.tok[slot] || !CL.on) return; b = JM.mountItem(it); }
    } catch (e) { console.warn('wear', slot, e); return; }
    if (tok !== CL.tok[slot] || !CL.on) { if (isJ(it)) JM.unmount(b); else { if (b.root.parent) b.root.parent.remove(b.root); b.dispose(); } return; }
    CL.mounted[slot] = { it, b, sig: wornSig(it) };
  }
  // her own hair mesh shows only while a classic hairstyle (kit:long, kit:buns) is on; a Marketplace hairstyle (or none) hides
  // it. Anything that flips it for a moment (card pictures, the editors) must leave it as this says: re-entering the closet
  // used to hide it outright, so the classic hair vanished whenever a piece was opened
  function hairSync() { const m = CL.mounted.hair; setHair(!(m && m.it.kit != null)); }
  function unmountSlot(slot) { const m = CL.mounted[slot]; if (!m) return; delete CL.mounted[slot]; if (isJ(m.it)) JM.unmount(m.b); else { if (m.b.root.parent) m.b.root.parent.remove(m.b.root); m.b.dispose(); } }
  // what she has on, with the piece being tried on in its place; clothes first, and anything fitted to her body after them again
  async function syncOutfit() {
    endPose();
    const want = {}; for (const s of SLOTS) want[s] = wornItem(s);
    if (CL.preview) { const ps = slotOf(CL.preview); want[ps] = CL.preview; for (const [a, b] of clashes(ps, CL.preview)) if (a === 'drop') want[b] = null; }
    let clothes = false;
    for (const s of SLOT_ORDER) { const it = want[s], m = CL.mounted[s]; if ((it && m && m.sig === wornSig(it)) || (!it && !m)) continue; if (s.startsWith('clothing.')) clothes = true; await mountSlot(s, it); }
    if (clothes) { look(CL.on); await refitWorld(); }
    if (CL.on) hairSync();
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
  function takeOff(it) { const s = slotOf(it); if (CL.wearing[s] === it.id) delete CL.wearing[s]; if (CL.view && CL.view.id === it.id) closeDetail(true); clSave(); remember(); syncOutfit().then(() => focus(null)); clRender(); GRUG.toast('Unequipped'); }
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


  /* ---- characters: her look saved under a name, with a pose. Tap one to wear it (she strikes its pose); the pencil puts it
     on and lets you rename it, change its pose or save what she has on into it. Characters she isn't wearing turn up as
     people in the games (src/dress.js reads 'grug.closet.v1'.characters). */
  const POSES = [['idle', 'Stand'], ['wave', 'Wave'], ['cheer', 'Cheer'], ['flex', 'Flex'], ['bow', 'Bow'], ['dance', 'Dance'], ['robot', 'Robot'], ['disco', 'Disco']];
  const CHAR_MAX = 30;
  const sortedObj = o => Object.keys(o || {}).sort().map(k => [k, o[k]]);
  const lookSig = (wearing, body) => JSON.stringify([sortedObj(wearing), body || {}]);
  const curSig = () => lookSig(CL.wearing, CL.body);
  // pose her: the pieces laid over her body are pinned to the bone under them (as in games) so they move with her, the clip
  // runs to a good moment, and the returned function puts every bone and piece back exactly where it was
  function boneUnder(c) {
    const b = n => sandy.object3d.getObjectByName(n), sd = c.x > 0 ? 'L' : 'R';
    if (c.y < 22) return b('leg_' + sd + '_foot_jnt'); if (c.y < 60) return b('leg_' + sd + '_lwrTwist00_jnt') || b('spine_M_00_jnt');
    if (c.y < 108) return b('spine_M_00_jnt'); return b('spine_M_04_jnt') || b('spine_M_03_jnt') || b('spine_M_00_jnt');
  }
  function poseHer(pose, secs) {
    if (!pose || pose === 'idle' || !sandy.play) return () => {};
    const o3 = sandy.object3d, bones = [], st = { a: sandy._anim, p: sandy._animPrev, t: sandy._animT, m: sandy._animMix, pos: o3.position.clone(), q: o3.quaternion.clone() };
    o3.traverse(o => { bones.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });   // her joints are plain objects, not only bones: keep every transform
    o3.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o3.matrixWorld).invert(), pinned = [];
    for (const [slot, m] of Object.entries(CL.mounted)) {
      if (slot.startsWith('clothing.') || slot === 'hair' || slot === 'eyewear' || slot === 'earrings') continue;
      const ms = []; m.b.root.traverse(x => { if (x.isMesh && !x.isSkinnedMesh) { let p = x.parent, head = false; while (p) { if (p === headGroup) { head = true; break; } p = p.parent; } if (!head) ms.push(x); } });
      for (const x of ms) { const c = new THREE.Box3().setFromObject(x).getCenter(new THREE.Vector3()).applyMatrix4(inv), bone = boneUnder(c); if (bone) { pinned.push([x, x.parent, x.position.clone(), x.quaternion.clone(), x.scale.clone()]); bone.attach(x); } }
    }
    sandy.play(pose); const n = Math.round((secs == null ? 0.75 : secs) / 0.05); for (let i = 0; i < n; i++) sandy.update(0.05);
    o3.updateMatrixWorld(true);
    let done = false;
    return () => {
      if (done) return; done = true;
      for (const [x, p, ps, q, sc] of pinned) { p.add(x); x.position.copy(ps); x.quaternion.copy(q); x.scale.copy(sc); }   // back under its own piece, as it was
      for (const [b, p, q, sc] of bones) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }
      o3.position.copy(st.pos); o3.quaternion.copy(st.q); Object.assign(sandy, { _anim: st.a, _animPrev: st.p, _animT: st.t, _animMix: st.m });
      o3.updateMatrixWorld(true);
    };
  }
  // a live pose on the stage for a moment: she plays it, then stands again
  let livePose = null;
  function endPose() { if (!livePose) return; const lp = livePose; livePose = null; cancelAnimationFrame(lp.raf); lp.back(); }
  function strikePose(pose) {
    endPose(); if (!pose || pose === 'idle' || !CL.on) return;
    const back = poseHer(pose, 0.05), lp = { back, t0: performance.now(), last: performance.now(), raf: 0 }; livePose = lp;
    const step = now => { if (livePose !== lp) return; const dt = Math.min(0.05, (now - lp.last) / 1000); lp.last = now; sandy.update(dt); if (now - lp.t0 > 2600) { endPose(); return; } lp.raf = requestAnimationFrame(step); };
    lp.raf = requestAnimationFrame(step);
  }
  // its picture: her whole body, in her own colours, in its pose
  function charPic(pose) {
    endPose(); const back = poseHer(pose); let url = '';
    try {
      sandy.object3d.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(sandy.n3.headMesh); for (const d of ['hair', 'sound', 'eyewear']) if (CL.mounted[d]) hb.union(new THREE.Box3().setFromObject(CL.mounted[d].b.root));
      const box = new THREE.Box3(new THREE.Vector3(-36, -3, -16), new THREE.Vector3(36, hb.max.y + 6, 16)); frameOn(box, 0.32, 0.05, thumbCam, 26, 0.86);
      renderer.setRenderTarget(rt()); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, thumbCam); url = readRT(TS, TS); renderer.setRenderTarget(null);
    } catch (e) { console.warn('character picture', e); renderer.setRenderTarget(null); }
    finally { back(); }
    return url;
  }
  // what a character keeps: what she has on (the pieces themselves, so it still works if one leaves the wardrobe) and her body
  function lookNow() {
    const wearing = JSON.parse(JSON.stringify(CL.wearing)), pieces = [];
    for (const id of new Set(Object.values(wearing))) { const e = entryFor(id); if (e) pieces.push(JSON.parse(JSON.stringify(e))); }
    return { wearing, pieces, body: JSON.parse(JSON.stringify(CL.body)) };
  }
  async function saveCharacter(f) {
    const name = (f.name || '').trim().slice(0, 24) || 'Character ' + (CL.characters.length + 1);
    await (applying || Promise.resolve()); await syncOutfit();
    const c = Object.assign(f.id ? CL.characters.find(x => x.id === f.id) || {} : { id: 'ch' + Date.now().toString(36) }, lookNow(), { name, pose: f.pose || 'idle', at: Date.now() });
    c.pic = charPic(c.pose);
    if (!CL.characters.includes(c)) { if (CL.characters.length >= CHAR_MAX) { GRUG.toast('You have ' + CHAR_MAX + ' characters: delete one to make room'); return; } CL.characters.unshift(c); }
    CL.charForm = null; clSave(); clRender(); strikePose(c.pose); GRUG.toast(f.id ? 'Saved' : 'Saved as ' + name);
  }
  async function wearCharacter(c, pose) {
    for (const pc of c.pieces || []) { const e = entryFor(pc.id); if (!e) CL.wardrobe.unshift(JSON.parse(JSON.stringify(pc))); else { for (const k of ['d', 'col', 'stamp', 'seed']) { if (pc[k] != null) e[k] = JSON.parse(JSON.stringify(pc[k])); else if (k === 'col') delete e.col; } } }
    CL.wearing = JSON.parse(JSON.stringify(c.wearing)); for (const k of Object.keys(CL.wearing)) if (!entryFor(CL.wearing[k])) delete CL.wearing[k];
    const bodyChanged = JSON.stringify(c.body) !== JSON.stringify(CL.body); CL.body = Object.assign(BODY0(), JSON.parse(JSON.stringify(c.body))); CL.body.build = Object.assign({}, CL.body.build || {});
    clSave(); remember(); clRender(); if (bodyChanged) { applying = applyBody(); await applying; } await syncOutfit(); focus(null);
    if (pose !== false) strikePose(c.pose);
  }
  function charsPanel(box) {
    const cur = curSig(), f = CL.charForm;
    if (f) {
      const form = el('div', 'cl-cform'), editing = f.id && CL.characters.find(x => x.id === f.id);
      form.append(el('div', 'g-label', editing ? 'Change ' + esc(editing.name) : 'Save this look as a character'));
      const inp = el('input', 'g-input'); inp.maxLength = 24; inp.value = f.name; inp.placeholder = 'Name'; inp.setAttribute('aria-label', 'Name'); inp.oninput = () => { f.name = inp.value; }; inp.onkeydown = e => { if (e.key === 'Enter') saveCharacter(f); };
      form.append(inp, el('div', 'cl-note', 'Pose'));
      const row = el('div', 'cl-chips'); for (const [k, l] of POSES) { const b = el('button', f.pose === k ? 'on' : '', esc(l)); b.onclick = () => { f.pose = k; for (const x of row.children) x.classList.toggle('on', x === b); strikePose(k); }; row.append(b); }
      form.append(row);
      if (editing) form.append(el('div', 'cl-note', 'Saving keeps what she has on now in this character.'));
      const acts = el('div', 'cl-acts2'), sv = el('button', 'g-btn g-btn--primary', `${ic('floppy_disk')}<span>Save</span>`), cn = el('button', 'g-btn g-btn--ghost', `<span>Cancel</span>`);
      sv.onclick = () => saveCharacter(f); cn.onclick = () => { CL.charForm = null; clRender(); }; acts.append(sv, cn); form.append(acts); box.append(form);
      setTimeout(() => { if (!editing) inp.focus(); inp.select(); }, 30);
    }
    const grid = el('div', 'cl-chars');
    if (!f) { const add = el('button', 'cl-char add', `<span class="cl-cpic">${ic('plus')}</span><b>Save this look</b>`); add.onclick = () => { CL.charForm = { id: null, name: 'Character ' + (CL.characters.length + 1), pose: 'wave' }; clRender(); strikePose('wave'); }; grid.append(add); }
    for (const c of CL.characters) {
      const on = lookSig(c.wearing, c.body) === cur, a = el('div', 'cl-char' + (on ? ' on' : '') + (f && f.id === c.id ? ' editing' : ''));
      const pic = el('button', 'cl-cpic'); pic.style.backgroundImage = c.pic ? `url(${c.pic})` : ''; pic.setAttribute('aria-label', 'Wear ' + c.name); pic.dataset.gTip = on ? 'She has this on' : 'Wear ' + c.name;
      pic.onclick = () => { if (on) strikePose(c.pose); else wearCharacter(c); };
      a.append(pic, el('b', '', esc(c.name)));
      if (on) a.append(el('span', 'g-pill g-pill--solid tag wtag', 'Wearing'));
      const ed = el('button', 'cl-cbtn', ic('pencil')); ed.setAttribute('aria-label', 'Change ' + c.name); ed.dataset.gTip = 'Rename, pose or update';
      ed.onclick = async () => { CL.charForm = { id: c.id, name: c.name, pose: c.pose || 'idle' }; if (!on) await wearCharacter(c, false); clRender(); strikePose(c.pose); };
      const rm = el('button', 'cl-cbtn rm', ic('trash_can')); rm.setAttribute('aria-label', 'Delete ' + c.name); rm.dataset.gTip = 'Delete';
      rm.onclick = () => { if (!rm.classList.contains('sure')) { rm.classList.add('sure'); rm.dataset.gTip = 'Tap again to delete'; setTimeout(() => rm.classList.remove('sure'), 2600); return; } CL.characters = CL.characters.filter(x => x !== c); if (CL.charForm && CL.charForm.id === c.id) CL.charForm = null; clSave(); clRender(); GRUG.toast('Deleted ' + c.name); };
      a.append(el('div', 'cl-cbtns'), ''); a.querySelector('.cl-cbtns').append(ed, rm); grid.append(a);
    }
    box.append(grid);
    box.append(el('p', 'cl-note cl-cnote', CL.characters.length ? 'Characters she isn\'t wearing show up as people in the games.' : 'Dress her up, then save the look as a character. Characters she isn\'t wearing show up as people in the games.'));
    GRUG.hydrate(box);
  }
  $('#clSaveChar').onclick = () => { if (CL.mode !== 'custom') setMode('custom'); CL.cdept = 'chars'; if (!CL.charForm) CL.charForm = { id: null, name: 'Character ' + (CL.characters.length + 1), pose: 'wave' }; if (CL.sheet === 'full' && portrait()) setSheet('half'); clRender(); clBody.scrollTop = 0; strikePose(CL.charForm.pose); };

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
  function setMode(m) { CL.mode = m; CL.filters = false; $$('#clMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === m)); if (CL.view) { closeDetail(); if (location.hash) history.replaceState(null, '', location.pathname + location.search); } clRender(); clBody.scrollTop = 0; }
  $$('#clMode button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  function tabBtn(box, v, label, on, go, icon) { const b = el('button', on ? 'on' : '', (icon ? ic(icon) : '') + `<span>${esc(label)}</span>`); b.onclick = go; box.append(b); return b; }
  function clTabs() {
    const t = $('#clTabs'), s = $('#clSubs'); t.innerHTML = ''; s.innerHTML = '';
    if (CL.mode === 'market') {
      for (const [v, label] of DEPTS) { if (v === 'yours' && !mineItems().length) continue; tabBtn(t, v, v === 'all' ? 'All' : label, cat.dept === v, () => { Object.assign(cat, RESET()); cat.dept = v; cat.sub = 'all'; CL.filters = false; closeDetail(); newFeed(true); clRender(); clBody.scrollTop = 0; }); }
      const subs = SUBS[cat.dept] || []; s.hidden = !subs.length;
      if (subs.length) { tabBtn(s, 'all', 'All', cat.sub === 'all', () => { cat.sub = 'all'; newFeed(true); clRender(); clBody.scrollTop = 0; }); for (const [sv, sl] of subs) tabBtn(s, sv, sl, cat.sub === sv, () => { cat.sub = sv; newFeed(true); clRender(); clBody.scrollTop = 0; }); }
    } else {
      tabBtn(t, 'chars', 'Characters', CL.cdept === 'chars', () => { CL.cdept = 'chars'; clRender(); clBody.scrollTop = 0; });
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
    const h = /^kit:/.test(e.id) ? kitHairItem(e.id) : HD.byId(e.id), g = grp2(box, 'Hair colour', h ? h.name : ''), orig = el('button', 'cl-sw cl-orig' + (e.col ? '' : ' on'), '<span>Original</span>'); orig.style.background = h ? (String(h.sw).includes('gradient') ? h.sw : h.hex) : '#888';
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
  /* the opened piece: pictures only, so it reads without reading. The big picture on the left is what she had on in that slot
     (or a cross: nothing); then the piece that was tapped and colour versions of it. Tapping a picture puts it on her, and it
     stays on when the panel closes; tapping the left picture puts back what she had. Everything written (name, maker, price,
     favourite, download, edit, tags, description, details, more like this) is under "More Information". */
  const VAR_N = 5;
  function variantsOf(it) {
    const dp = deptOf(it), out = [];
    try {
      if (dp === 'hair') {
        const own = String(it.hex || '').toLowerCase(), cols = HAIR_SW.filter(c => c !== own), r = rng('hairvar:' + it.id), pick = [];
        while (pick.length < VAR_N && cols.length) pick.push(cols.splice(Math.floor(r() * cols.length), 1)[0]);
        for (const c of pick) { const v = it.kit != null ? kitHairItem(it.id, c) : dyedHair(it, c); if (v) { v._col = c; out.push(v); } }
      } else if (isJ(it)) {
        // the beads and charms take new colours; the chain or cord (necklaces) and the metal (earrings) change too, so each reads apart
        const METAL = ['#d4af37', '#c8ccd2', '#e0a68f', '#26272b', '#c3743e', '#50555c'].filter(c => c !== String(it.d.metal || it.d.cordCol || '').toLowerCase()), CORD = ['#e8344f', '#2b62d9', '#16161a', '#9be338', '#ff6fa8', '#f5d21f'];
        for (let i = 0; i < VAR_N; i++) { const seed = it.seed + '~c' + i, d = J.random(dp, seed, { keep: 'shape', base: it.d, brand: it.d.brand || it.brand });
          if (dp === 'earrings') d.metal = METAL[i % METAL.length]; if (dp === 'necklaces') { d.cordCol = d.cord === 'chain' ? METAL[i % METAL.length] : CORD[i % CORD.length]; }
          out.push(JM.item(dp, it.id + '~c' + i, seed, d, { by: it.by, brand: it.brand || d.brand })); }
      } else {
        for (let i = 0; i < VAR_N; i++) { const seed = it.seed + '~c' + i, d = GE.random(seed, { base: it.d, keep: 'shape' }); out.push({ id: it.id + '~c' + i, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: it.by || 'Grug Digital', brand: it.brand || 'grug', order: i, stamp: 0, gen: true }); }
      }
    } catch (e) { console.warn('variants', e); }
    return out;
  }
  // what she keeps on: the piece goes in her wardrobe (a hairstyle keeps its colour) and on her
  function keepOn(it) {
    if (!it) return; let e = entryFor(it.id);
    if (!e) { e = entryOf(it); CL.wardrobe.unshift(e); }
    else if (deptOf(it) === 'hair') { if (it._col) e.col = it._col; else delete e.col; }
    wearOn(it); clSave(); remember();
  }
  // the left picture: her as she was before this piece, framed on its slot (her last trousers, her bare face…), taken from the
  // stage the moment the piece is opened, in her own colours. Kept while pieces of the same slot are opened one after another
  function slotBox(slot) {
    sandy.object3d.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(sandy.n3.headMesh), V = (x, y, z) => new THREE.Vector3(x, y, z);
    if (['hair', 'eyewear', 'earrings', 'sound'].includes(slot)) { for (const d of ['hair', 'sound']) if (CL.mounted[d]) hb.union(new THREE.Box3().setFromObject(CL.mounted[d].b.root)); return hb.expandByScalar(1); }
    const top = hb.min.y;
    if (slot === 'necklaces') return new THREE.Box3(V(-16, top - 34, -10), V(16, top + 4, 12));
    if (slot === 'clothing.top' || slot === 'back') return new THREE.Box3(V(-30, top - 62, -14), V(30, top + 2, 14));
    if (slot === 'purses') return new THREE.Box3(V(-34, top - 80, -14), V(34, top - 20, 14));
    if (slot === 'clothing.legs') return new THREE.Box3(V(-24, 18, -14), V(24, top - 44, 14));
    return new THREE.Box3(V(-22, -3, -14), V(22, 30, 18));   // shoes, sandals
  }
  function beforeShot(slot) {
    if (CL.beforeShot && CL.beforeShot.slot === slot) return CL.beforeShot.url; let url = '';
    try {
      endPose(); const b = slotBox(slot), yaw = slot === 'back' ? Math.PI - 0.4 : slot === 'earrings' ? 0.9 : slot === 'purses' ? 0.3 : 0.35;
      frameOn(b, yaw, ['clothing.feet', 'sandals'].includes(slot) ? 0.3 : 0.08, thumbCam, 26, 1.0);
      renderer.setRenderTarget(rt()); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, thumbCam); url = readRT(TS, TS); renderer.setRenderTarget(null);
    } catch (e) { console.warn('before', e); renderer.setRenderTarget(null); }
    CL.beforeShot = { slot, url }; return url;
  }
  function pickTile(it, before) {
    const t = el('button', 'cl-pick' + (before ? ' before' : '')); t.type = 'button';
    t.style.backgroundColor = it ? cardColour(it) : ''; t.append(el('span', 'wait'));
    if (before) t.append(el('span', 'cl-pbadge', ic('arrow_uturn_left_down')));
    t.append(el('span', 'cl-pon', ic('star')));
    if (before) { t.classList.add('her'); t.querySelector('.wait').remove(); const u = CL.beforeShot && CL.beforeShot.url; if (u) t.style.backgroundImage = `url(${u})`; }
    else { const cb = u => { t.style.backgroundImage = `url(${u})`; const w = t.querySelector('.wait'); if (w) w.remove(); }; cb.alive = () => document.body.contains(t); queueThumb(it, 'worn', cb, true); }
    const name = it ? it.name : 'nothing there'; t.setAttribute('aria-label', before ? 'Put back what she had on: ' + name : name); t.dataset.gTip = before ? 'Put back what she had on' : name;
    return t;
  }
  function selectTile(it) {
    CL.preview = it; for (const t of clDet.querySelectorAll('.cl-pick')) t.classList.toggle('on', t._it === (it || null));
    syncOutfit().then(() => { if (CL.view) focus(it || CL.view); });
  }
  function itemPanel(box, it) {
    const dp = deptOf(it), hair = dp === 'hair', mineIt = owned(it.id);
    const kind = hair ? it.length.charAt(0).toUpperCase() + it.length.slice(1) : isJ(it) ? J.KIND_LABEL[it.kind] || it.kind : GE.CLASS_LABEL[it.kind];
    const tags = hair ? it.tags.filter(t => t !== 'yours').map(t => t.charAt(0).toUpperCase() + t.slice(1)) : isJ(it) ? J.tagsFor(dp, it.d) : GE.tagsFor(it.d);
    const v = el('div', 'cl-item');
    v.innerHTML = `<button class="cl-round sm cl-x" data-back aria-label="Close" data-g-tip="Close">${ic('cross')}</button>
      <div class="cl-picks"><div class="cl-pbefore"></div><div class="cl-vars"></div></div>
      <details class="cl-info"><summary><span>More Information</span><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M3 6l5 5 5-5"/></svg></summary>
      <div class="cl-iinfo"><div class="crumbs"><span>${esc(deptLabel(dp))}</span><i class="sep">›</i><span>${esc(kind || '')}</span></div><h2 class="g-h3">${esc(it.name)}</h2><div class="cl-by">${byHTML(it)}</div><div class="cl-price">Free</div>
      <div class="cl-acts2"><button class="g-btn g-btn--sm" data-add${mineIt ? ' disabled' : ''}>${mineIt ? ic('star') + '<span>In your wardrobe</span>' : ic('plus_in_circle') + '<span>Add to wardrobe</span>'}</button><button class="g-btn g-btn--sm favbtn${isFav(it.id) ? ' on' : ''}" data-fav>${ic('star')}<span>${isFav(it.id) ? 'Favorited' : 'Favorite'}</span></button>${J.isCloth(dp) ? '' : `<span class="rollbtn"><button class="g-btn g-btn--sm" data-dl>${ic('file_arrow_down')}<span>Download</span>${ic('dropdown')}</button><div class="rollmenu fmtmenu" hidden></div></span>`}<button class="g-btn g-btn--sm g-btn--ghost" data-edit>${ic('pencil')}<span>${hair ? 'Edit in the Hair Studio' : 'Edit'}</span></button></div></div>
      <div class="chips">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <p class="cl-desc">${esc(hair ? it.desc : isJ(it) ? J.describe(dp, it.d) : GE.describe(it.d))}</p><div class="g-label">Details</div><dl class="specs">${hair ? [['Style', esc(it.style)], ['Length', esc(kind)], ['Colour', swatch(it.sw) + esc(it.colour)]].map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') : isJ(it) ? JM.specRows(it) : specRows(it.d)}</dl>
      <h3 class="g-h4 cl-like-h">More like this</h3><div class="cgrid cl-grid" data-like></div></details>`;
    box.append(v);
    // the pictures: what she had on, then this piece and its colours
    const was = wornItem(slotOf(it)), bt = pickTile(was, true); bt._it = null; bt.onclick = () => selectTile(null); v.querySelector('.cl-pbefore').append(bt);
    const vars = v.querySelector('.cl-vars');
    for (const x of CL.vars || [it]) { const t = pickTile(x, false); t._it = x; t.onclick = () => selectTile(x); vars.append(t); }
    for (const t of v.querySelectorAll('.cl-pick')) t.classList.toggle('on', t._it === (CL.preview || null));
    for (const b of v.querySelectorAll('[data-back]')) b.onclick = () => { location.hash = ''; };
    v.querySelector('[data-add]').onclick = () => { if (!mineIt) addToWardrobe(it, false); };
    v.querySelector('[data-fav]').onclick = () => { toggleFav(it); clDetail(); };
    if (it.kit != null) for (const q of v.querySelectorAll('[data-edit],.rollbtn')) q.remove();   // the classic hairstyles: no studio, no files
    if (v.querySelector('[data-dl]')) formatMenu(v.querySelector('[data-dl]'), v.querySelector('.fmtmenu'), () => CL.preview || it);
    const ed = v.querySelector('[data-edit]'); if (ed) ed.onclick = () => openStudio(CL.preview || it);
    const det = v.querySelector('.cl-info'), like = v.querySelector('[data-like]'); det.open = false;
    const fillLike = () => { if (like.childElementCount) return; for (const li of likeOf(it)) { const a = card(li, 'worn', { gen: -1 }); like.append(a); a._thumb(); } GRUG.hydrate(like); };
    det.addEventListener('toggle', () => { if (det.open) fillLike(); });
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
    else if (CL.cdept === 'chars') charsPanel(box);
    else wardrobeGrid(box, CL.cdept);
    if (CL.mode !== 'market') $('#clFilters').hidden = true;
    GRUG.hydrate(box); box.scrollTop = top; clDetail();
  }
  // a piece opened from the marketplace: she tries it on (one per slot, so it takes that slot's place)
  async function clOpen(id) {
    const it = itemById(id); if (!it) { location.hash = ''; return; }
    if (deptOf(it) === 'hair') { viewer.token++; for (const k of Object.keys(viewer.vr)) HD.disposeVersion(viewer.vr[k]); viewer.vr = {}; viewer.vp = {}; viewer.item = it; viewer.level = 'low'; }
    if (CL.view && CL.preview && slotOf(CL.preview) !== slotOf(it)) { keepOn(CL.preview); CL.beforeShot = null; await syncOutfit(); }
    if (!CL.view) CL.beforeShot = null;
    if (!CL.beforeShot || CL.beforeShot.slot !== slotOf(it)) { await syncOutfit(); beforeShot(slotOf(it)); }
    CL.view = it; CL.vars = [it].concat(variantsOf(it)); CL.preview = it;
    if (!clBody.childElementCount) clRender(); else clDetail();
    if (CL.sheet === 'full' && portrait()) setSheet('half');
    await syncOutfit(); if (CL.view === it) focus(it);
  }
  function closeDetail(drop) { const was = CL.view; if (!was) return; const pick = CL.preview; CL.view = null; CL.preview = null; CL.vars = null; CL.beforeShot = null; if (pick && !drop) { keepOn(pick); clRender(); } if (deptOf(was) === 'hair') viewer.item = null; if (/^#item\//.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); syncOutfit(); focus(null); clDetail(); }
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

  /* ---- the back arrow: to the page they came from (the site has no bottom bar here) */
  { let from = ''; try { const r = document.referrer && new URL(document.referrer); if (r && r.origin === location.origin && !/\/(avatar|labs\/catalog)\//.test(r.pathname)) { from = r.href; sessionStorage.setItem('grug.avatar.from', from); } else from = sessionStorage.getItem('grug.avatar.from') || ''; } catch (e) {}
    const home = location.pathname.replace(/(avatar|labs\/catalog)\/[^/]*$/, '');   // the site's home page
    $('#clBack').onclick = () => { location.href = from || home; }; }

  /* ---- in and out */
  let clReady = false;
  async function clEnter(hash) {
    if (!CL.on && !store.get(CL_KEY, null)) clSave(); else if (!CL.on) { try { const c = JSON.parse(localStorage.getItem('grug.sandy.v1') || 'null'); if (!c || !c.closet) playAsCloset(); } catch (e) {} }
    const first = !CL.on; CL.on = true; showPage('closet'); look(true); if (worn) worn.root.visible = false; hairSync();
    if (canvas.parentElement !== $('#clStage')) { canvas.classList.remove('hovercv'); $('#clStage').prepend(canvas); resize(); }
    ZOOM[0] = 40; ZOOM[1] = 560; floor.visible = true; spin.on = false;
    if (first) { const tq = new URLSearchParams(location.search).get('tab'); if (tq === 'custom' || tq === 'chars') { CL.mode = 'custom'; if (tq === 'chars') CL.cdept = 'chars'; $$('#clMode button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === 'custom')); } }
    if (first) { if (!FEED.seed) newFeed(true); if (!clReady) { clReady = true; await applyBody(false); remember(); } else look(true); }
    $('#clLoading').classList.add('gone');
    if (/^#item\//.test(hash)) { if (first) clRender(); await clOpen(decodeURIComponent(hash.slice(6))); if (first) { CL.goal = CL.goal || fullBody(); } return; }
    if (CL.view) clClose(); else { clRender(); await syncOutfit(); if (first) { CL.goal = fullBody(); Object.assign(cam, { yaw: CL.goal.yaw, pitch: CL.goal.pitch, dist: CL.goal.dist }); cam.target.copy(CL.goal.target); } }
  }
  function clLeave() {
    if (!CL.on) return; endPose(); if (CL.view && CL.preview) keepOn(CL.preview); CL.on = false; CL.view = null; CL.preview = null; CL.vars = null; for (const s of SLOTS) unmountSlot(s); for (const k of Object.keys(CL.tok)) CL.tok[k]++;
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
  Object.assign(CL, { applyBody, look, focus, syncOutfit, clRender, newFeed, FEED, setSiteMode, saveCharacter, wearCharacter, charPic, strikePose, endPose, keepOn, selectTile });
