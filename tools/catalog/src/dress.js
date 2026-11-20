/* =====================================================================================
   Grug · closet runtime: the player's closet avatar, for games.
   BUILT into assets/closet-runtime.js by tools/catalog/build.py (with the catalog's eyewear, hair, patterns and jewelry
   engines). sandy-runtime.js loads it on demand when the player's look ('grug.sandy.v1') has closet: true, and calls
   GrugClosetRuntime.create(SandyClassicKit) → Promise of the classic Sandy in her closet colours (skin, nails, face, build,
   feet), wearing what she has on in the closet ('grug.closet.v1': { wardrobe, wearing, body }).
   - Clothes are skinned to her skeleton, and hair, eyewear, earrings and headphones sit on her head, so they move with her.
     Pieces laid in the world (necklaces, purses, sandals, swords, cords) are fitted to her standing pose, then each mesh is
     attached to the bone nearest where it sits (a foot, her hips, her chest), so it follows her too.
   - Nothing here writes to storage. The closet (labs/catalog, avatar/) is the only thing that changes 'grug.closet.v1'.
   ===================================================================================== */
window.GrugClosetRuntime = (function () {
  'use strict';
  const CL_KEY = 'grug.closet.v1', SKIN0 = '#e3e0da', GREY = '#9a9da3';
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lin = h => new THREE.Color(h).convertSRGBToLinear(), near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.05;
  const BUILD = ['height', 'shoulders', 'upperTorso', 'lowerTorso', 'hips', 'neck', 'upperArm', 'forearm', 'handSize', 'thigh', 'shin', 'footLength', 'toeLength'];
  const SLOT_ORDER = ['clothing.top', 'clothing.legs', 'clothing.feet'];
  // her hair in any colour (the closet's dyedHair)
  function dyedHair(h, col) {
    if (!h || !col) return h;
    return Object.assign({}, h, { make: () => { const m = h.make(); for (const g of m.groups) { if (!g) continue; Object.assign(g, { tex: 'white', tint: col, tip: col, tipMix: 0, rainbow: 0, hlAmount: 0, hlTex: null, plain: true }); if (g.twinTex || g.twinTint) { g.twinTex = null; g.twinTint = col; } } if (m.scalp) Object.assign(m.scalp, { tex: 'white', tint: col, twinTex: null, twinTint: m.scalp.twinTint ? col : null, plain: true }); return m; } });
  }
  const WHITE = () => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; };
  // the bone a piece laid in the world follows: by where it sits on her
  function boneFor(sandy, c) {
    const b = n => sandy.object3d.getObjectByName(n), sd = c.x > 0 ? 'L' : 'R';
    if (c.y < 22) return b('leg_' + sd + '_foot_jnt');
    if (c.y < 60) return b('leg_' + sd + '_lwrTwist00_jnt') || b('spine_M_00_jnt');
    if (c.y < 108) return b('spine_M_00_jnt');
    return b('spine_M_04_jnt') || b('spine_M_03_jnt') || b('spine_M_00_jnt');
  }
  function pin(sandy, root) {
    sandy.object3d.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const meshes = []; root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
    for (const m of meshes) {
      const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(sandy.object3d.matrixWorld).invert());
      const bone = boneFor(sandy, c); if (bone) bone.attach(m);
    }
  }
  /* ---- a random catalog look for an NPC: always the female body (the catalog's), any skin, hair from the catalog, clothes,
     shoes or sandals, sometimes jewelry or glasses. cfg (the game's config) lends its shirt and shorts colours, so team and
     uniform colours carry over. */
  const TONES = ['#f7dcc8', '#f0cfb4', '#e8b48f', '#d9a67e', '#c98d63', '#b98059', '#a46c46', '#8a5a3c', '#6f4428', '#5e3b26', '#3f2718'];
  const NAILS = ['', '', '#e3101c', '#ff6fb0', '#ffc2d6', '#121212', '#7d3fc4', '#2b62d9', '#f4f4f2', '#d4af37'];
  const EXPR = ['neutral', 'happy', 'smug', 'curious', 'laugh', 'wink'];
  const HAIR_COL = ['#1d1f26', '#2a1a12', '#4a2a22', '#80523c', '#ab9168', '#e2b98a', '#c42a2a', '#d0622a', '#ee8fb0', '#7a3dd6', '#2f6fe0', '#efe2c3'];
  function rnd(seed) { let a = [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* ---- her colours: one scheme per NPC, so everything she wears goes together. A base hue, then one of: one colour in
     several shades, neighbouring colours, a colour and its opposite as an accent, or neutrals with one accent. Every colour on
     every piece (clothes, shoes, sandals, jewelry, glasses) is drawn from it; white, black, greys and metal tones are kept. */
  const hexOf = (h, s, l) => { const c = new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))); return '#' + c.getHexString(); };
  const hslOf = h => { const o = {}; new THREE.Color(h).getHSL(o); return o; };
  const NEUTRALS = ['#f4f4f2', '#16161a', '#3a3b40', '#c8ccd2', '#e9dfcf', '#1b2a55', '#6b4428'];
  function palette(r, base) {
    const pick = a => a[Math.floor(r() * a.length) % a.length];
    const b = base ? hslOf(base) : null, h = b ? b.h * 360 : r() * 360, sat = b ? Math.max(0.35, b.s) : 0.45 + r() * 0.4, k = r();
    const n1 = pick(NEUTRALS), n2 = pick(NEUTRALS.filter(x => x !== n1));
    let main, second, accent, scheme;
    if (k < 0.25) { scheme = 'mono'; main = hexOf(h, sat, 0.5); second = hexOf(h, sat * 0.8, 0.28); accent = hexOf(h, sat * 0.6, 0.78); }
    else if (k < 0.5) { scheme = 'analogous'; main = hexOf(h, sat, 0.52); second = hexOf(h + 32, sat, 0.45); accent = hexOf(h - 30, sat, 0.6); }
    else if (k < 0.75) { scheme = 'complementary'; main = hexOf(h, sat, 0.5); second = hexOf(h, sat * 0.7, 0.3); accent = hexOf(h + 180, sat, 0.55); }
    else { scheme = 'neutral'; main = n1; second = n2; accent = hexOf(h, sat, 0.52); }
    if (base) main = base;
    return { scheme, main, second, accent, n1, n2, list: [main, second, accent] };
  }
  // every colour in a design onto the palette (neutral and metal tones stay as they are)
  function recolour(d, P, r) {
    const keep = h => { const o = hslOf(h); return o.s < 0.14 || o.l > 0.92 || o.l < 0.1 || (o.h * 360 > 38 && o.h * 360 < 56 && o.s > 0.45 && o.l > 0.38 && o.l < 0.7); };
    const walk = v => { if (Array.isArray(v)) return v.map(walk); if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = walk(v[k]); return o; } if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && !keep(v)) return P.list[Math.floor(r() * P.list.length) % P.list.length]; return v; };
    return walk(d);
  }
  function randomState(seed, cfg, team) {
    const J = window.GrugJewelry, r = rnd(seed), pick = a => a[Math.floor(r() * a.length) % a.length];
    const wardrobe = [], wearing = {}, put = (slot, dept, d, extra) => { const id = 'npc:' + slot + ':' + seed; wardrobe.push(Object.assign({ id, dept, seed: seed + '-' + slot, d }, extra || {})); wearing[slot] = id; };
    const hex = h => /^#[0-9a-f]{6}$/i.test(h || '') ? h : null, T = team || {};
    const body = { skin: pick(TONES), nails: pick(NAILS), expression: pick(EXPR), footShape: 'none', build: { height: 0.96 + r() * 0.08, hips: 0.92 + r() * 0.16, shoulders: 0.94 + r() * 0.1 } };
    // a team or uniform colour (the game changed her shirt) is the base of her scheme and the colour of her top
    const P = palette(r, hex(T.shirt)), cl = (d, a, b, c) => Object.assign(d, { colA: a, colB: b, colC: c, patCol: r() < 0.5 ? P.n1 : P.accent });
    const tk = r(), topDept = tk < 0.62 ? 'tops' : tk < 0.85 ? 'jackets' : 'outfits', top = J.random(topDept, seed + '-top');
    cl(top, P.main, r() < 0.5 ? P.second : P.n1, P.accent); put('clothing.top', topDept, top);
    if (topDept !== 'outfits') { const b = J.random('bottoms', seed + '-legs'); cl(b, hex(T.shorts) || (r() < 0.6 ? P.n2 : P.second), P.n1, P.accent); put('clothing.legs', 'bottoms', b); }
    const fk = r();
    if (fk < 0.55) { const sh = J.random('shoes', seed + '-feet'); cl(sh, r() < 0.5 ? P.accent : P.n1, P.n2, P.main); put('clothing.feet', 'shoes', sh); }
    else if (fk < 0.85) put('sandals', 'sandals', recolour(J.random('sandals', seed + '-feet'), P, r));
    if (r() < 0.3) put('earrings', 'earrings', recolour(J.random('earrings', seed + '-ear'), P, r));
    if (r() < 0.22) put('necklaces', 'necklaces', recolour(J.random('necklaces', seed + '-neck'), P, r));
    if (r() < 0.18) { const GE = window.GrugEyewear; put('eyewear', 'eyewear', recolour(GE.random(seed + '-eye'), P, r)); }
    // her hair is the classic kit's own: long or buns (style 0 or 1), in any colour
    return { wardrobe, wearing, body, palette: P.scheme, kitHair: { style: r() < 0.5 ? 0 : 1, colour: pick(HAIR_COL), size: 1, up: 0, forward: 0 } };
  }
  /* ---- the player's own characters as NPCs: looks saved in the closet ('grug.closet.v1'.characters) that she isn't wearing
     right now. A catalog NPC is one of them a little over half the time, each character at most once per page (so a game
     never fills with copies), picked by the NPC's seed. A team or uniform colour still colours her top and bottoms. */
  const USED = new Set();
  const sortedObj = o => Object.keys(o || {}).sort().map(k => [k, o[k]]);
  const lookSig = (wearing, body) => JSON.stringify([sortedObj(wearing), body || {}]);
  function characterFor(seed, team) {
    const st = read(CL_KEY), all = st && Array.isArray(st.characters) ? st.characters : [];
    if (!all.length) return null;
    const now = lookSig(st.wearing, st.body), free = all.filter(c => c && c.wearing && c.body && !USED.has(c.id) && lookSig(c.wearing, c.body) !== now);
    const r = rnd('char:' + seed); if (!free.length || r() >= 0.6) return null;
    const c = free[Math.floor(r() * free.length) % free.length]; USED.add(c.id);
    const pieces = JSON.parse(JSON.stringify(c.pieces || [])), wearing = JSON.parse(JSON.stringify(c.wearing)), T = team || {};
    const hex = h => /^#[0-9a-f]{6}$/i.test(h || '') ? h : null;
    const tint = (slot, col) => { const e = col && pieces.find(p => p.id === wearing[slot]); if (e && e.d) e.d.colA = col; };
    tint('clothing.top', hex(T.shirt)); tint('clothing.legs', hex(T.shorts));
    return { wardrobe: pieces, wearing, body: JSON.parse(JSON.stringify(c.body)), name: c.name, charId: c.id };
  }
  /* create(K, opts): opts.random = a seed (an NPC) with opts.cfg the game's config; opts.bare = her body, face and hair only
     (a game that dresses her itself: Runway Ready), with opts.cfg the classic config it dresses her in. No opts: the player. */
  async function create(K, opts) {
    opts = opts || {};
    const J0 = window.GrugJewelry; if (opts.random != null) await J0.ready();
    const st = opts.random != null ? ((!opts.bare && opts.chars !== false && characterFor(opts.random, opts.team)) || randomState(opts.random, opts.cfg, opts.team)) : (read(CL_KEY) || {}), wardrobe = Array.isArray(st.wardrobe) ? st.wardrobe : [], wearing = st.wearing || {}, bare = !!opts.bare;
    const body = Object.assign({ skin: '#d9a67e', nails: '', expression: 'smug', footShape: 'none', build: {} }, st.body || {});
    // a classic hairstyle she wears in the closet (kit:long, kit:buns): her own hair in that style and colour
    { const hw = wearing.hair && wardrobe.find(e => e.id === wearing.hair); if (hw && /^kit:/.test(hw.id)) st.kitHair = { style: hw.id === 'kit:buns' ? 1 : 0, colour: hw.col || '#2a1a12', size: 1, up: 0, forward: 0 }; }
    // made in the catalog's colours first, so each part of her can be told apart, then given hers (as the closet does)
    const hat = opts.cfg && opts.cfg.hat && opts.cfg.hat.type && opts.cfg.hat.type !== 'none' ? opts.cfg.hat : { type: 'none' };
    const base = bare ? Object.assign(JSON.parse(JSON.stringify(opts.cfg || {})), { body: 'female', skin: SKIN0, nails: SKIN0 }) : { body: 'female', skin: SKIN0, nails: SKIN0, expression: 'neutral', earrings: { type: 'none' }, hat, top: null, legs: null, feet: { type: 'flipflops', sole: GREY, strap: GREY } };
    // (the closet also saves kitHair: 1 as a flag; only an object is a hairstyle. A flag here broke her whole build, so a player
    // in a Marketplace hairstyle got the blocky avatar in games)
    if (st.kitHair && typeof st.kitHair === 'object') base.hair = st.kitHair;
    const sandy = await K.create(K.merge(K.DEFAULT, base));
    sandy.update(0.016);
    const orig = []; sandy.object3d.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.color && !orig.some(x => x.m === m)) orig.push({ m, color: m.color.clone(), map: m.map, vc: !!m.vertexColors }); });
    const c = JSON.parse(JSON.stringify(sandy.getConfig())); Object.assign(c, { skin: body.skin, nails: body.nails || body.skin, expression: body.expression, footShape: body.footShape });
    c.build = Object.assign({}, c.build); for (const k of BUILD) c.build[k] = body.build[k] == null ? 1 : body.build[k];
    const r = sandy.apply(c); if (r && r.then) await r; for (let i = 0; i < 3; i++) sandy.update(0.016);
    // her skin in exactly the colour picked on every part; her flip-flops off-white
    const s0 = lin(SKIN0), s1 = lin('#d18f73'), g0 = lin(GREY), skin = lin(body.skin), white = WHITE();
    const colours = () => {
      for (const { m, color, map } of orig) {
        if (near(color, s0) || near(color, s1)) { m.map = map ? white : null; m.vertexColors = false; m.color.copy(skin); m.needsUpdate = true; }
        else if (near(color, g0)) { m.color.copy(lin('#f2efe6')); m.needsUpdate = true; }
      }
      const NU = sandy.n3 && sandy.n3._nailU; if (NU && NU.nailAmt) NU.nailAmt.value = body.nails ? 1 : 0;
    };
    colours();
    sandy.object3d.updateMatrixWorld(true);
    // the engines, set up on her
    const GE = window.GrugEyewear, J = window.GrugJewelry, headGroup = sandy.n3.headGroup;
    const HD = (() => { try { return window.GrugCatalogHair ? window.GrugCatalogHair({ sandy, scene: new THREE.Scene(), renderer: null }) : null; } catch (e) { console.warn('closet hair', e); return null; } })();
    const hm = sandy.n3.hairMesh ? GE.headModel(sandy, { also: [sandy.n3.hairMesh] }) : GE.headModel(sandy); hm.skin = GE.headModel(sandy);
    await J.ready(); J.init({ sandy, hm, env: null }); if (!bare) await J.clothInit(sandy);
    const extra = [], entry = id => wardrobe.find(e => e.id === id);
    const slots = SLOT_ORDER.concat(Object.keys(wearing).filter(s => !SLOT_ORDER.includes(s)));
    let hairOn = false;
    for (const slot of slots) {
      const e = wearing[slot] && entry(wearing[slot]); if (!e) continue;
      if (bare && e.dept !== 'hair') continue;
      try {
        if (e.dept === 'hair') {
          if (!HD) continue; const h = HD.byId(e.id), it = e.col ? dyedHair(h, e.col) : h; if (!it) continue; hairOn = true;
          const b = await HD.live(it, 'low'); HD.dress(true); headGroup.add(b.root); extra.push(b);
        } else if (e.dept === 'eyewear') {
          const b = GE.build(GE.validate(e.d).d, hm, { seed: e.seed }); headGroup.add(b.root); extra.push(b);
        } else if (e.d) {
          const d = J.validate(e.dept, e.d, e.d.brand).d; await J.prep(e.dept, d);
          const b = J.build(e.dept, d);
          // clothes draw themselves on her skeleton (clothSync); head pieces ride her head; the rest is pinned to bones
          if (!J.isCloth(e.dept)) { if (b.frame === 'head') headGroup.add(b.root); else { sandy.object3d.add(b.root); pin(sandy, b.root); } }
          extra.push(b);
        }
      } catch (err) { console.warn('closet piece', slot, err); }
    }
    if (!bare) J.clothSync(sandy);
    sandy.isCloset = true; sandy.__expr0 = body.expression;
    if (st.charId) { sandy.characterName = st.name; sandy.characterId = st.charId; }
    // anything a game re-applies (an expression is a whole apply in the classic kit) puts back her colours and her clothes'
    // hidden skin (the kit resets that on every apply)
    const a0 = sandy.apply.bind(sandy), after = () => { colours(); if (hairOn) { HD.dress(true); } if (!bare) J.clothSync(sandy); };
    sandy.apply = function (patch, full) { const r = a0(patch, full); if (r && r.then) return r.then(v => { after(); return v; }); after(); return r; };
    const d0 = sandy.dispose ? sandy.dispose.bind(sandy) : null;
    sandy.dispose = function () { for (const b of extra) { try { if (b.root && b.root.parent) b.root.parent.remove(b.root); b.dispose && b.dispose(); } catch (e) {} } if (d0) d0(); };
    return sandy;
  }
  return { create, randomState, characterFor, KEY: CL_KEY };
})();
