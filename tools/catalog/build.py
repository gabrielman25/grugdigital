"""Builds labs/catalog/index.html: base.html (the game kit's catalog) + src/jewelry.js, src/int.js, src/bake.js, src/patterns.png
   and the patches below. Run: python3 tools/catalog/build.py   (never edit labs/catalog/index.html by hand). See README.md."""
import re,sys
import os
HERE=os.path.dirname(os.path.abspath(__file__)); REPO=os.path.dirname(os.path.dirname(HERE))
src=open(os.path.join(HERE,'base.html')).read()
s=src
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n, (c, old[:90])
    s=s.replace(old,new)
jew=open(os.path.join(HERE,'src','jewelry.js')).read()
integ=open(os.path.join(HERE,'src','int.js')).read()
closet=open(os.path.join(HERE,'src','closet.js')).read()

# ---- script
# on the site the catalog loads the site's runtime, which loads the classic kit (assets/sandy-classic.js: the only copy, with
# the new feet); the vendor/ copies it once carried (old and new feet side by side) are gone
rep("const ON_SITE = !!(K && K.model === 'block');","const ON_SITE = !!(K && K.model === 'block'), ON_LABS = /\\/labs\\//.test(location.pathname);")
rep("renderer.setPixelRatio(ON_SITE ?","renderer.setPixelRatio(ON_SITE || ON_LABS ?")
# the mannequin's nails: no polish, the same grey as her skin (the new feet mark their nails per vertex and tint them)
rep("    hideFaceHair();\n  }\n  function hideFaceHair()","    { const NU = sandy.n3._nailU; if (NU) { NU.nailAmt.value = 0; } }\n    hideFaceHair();\n  }\n  function hideFaceHair()")
# ---- hair: every catalog hairstyle is flat colour (no strand texture: flatHair below); a texture is only a choice in the Hair
#      Studio's editor. Plus a few extra plain colours (one colour, a fade, or a rainbow) on every style.
rep("  const DYES = {\n", """  const DYES = {
    flatpink: { name: 'Bubblegum', plain: true, tex: 'white', tint: '#ff8fc2', sw: '#ff8fc2', tags: ['pink', 'colourful'] },
    flatlilac: { name: 'Lilac', plain: true, tex: 'white', tint: '#b79cff', sw: '#b79cff', tags: ['purple', 'lavender', 'pastel', 'colourful'] },
    flatmint: { name: 'Mint green', plain: true, tex: 'white', tint: '#7fe0b4', sw: '#7fe0b4', tags: ['green', 'mint', 'pastel', 'colourful'] },
    flatsky: { name: 'Sky', plain: true, tex: 'white', tint: '#7cc4ff', sw: '#7cc4ff', tags: ['blue', 'colourful'] },
    flatred: { name: 'Cherry', plain: true, tex: 'white', tint: '#e2383f', sw: '#e2383f', tags: ['red', 'colourful'] },
    flatblack: { name: 'Jet black', plain: true, tex: 'white', tint: '#26262c', sw: '#26262c', tags: ['black', 'dark'] },
    flatwhite: { name: 'Snow white', plain: true, tex: 'white', tint: '#f4f2f0', sw: '#f4f2f0', tags: ['white', 'light'] },
    flatlemon: { name: 'Lemon', plain: true, tex: 'white', tint: '#ffe066', sw: '#ffe066', tags: ['yellow', 'blonde', 'colourful'] },
    flatsunset: { name: 'Sunset', plain: true, tex: 'white', tint: '#ff9a3c', tip: '#ff4f9a', tipMix: 1, tipStart: 0.3, sw: 'linear-gradient(#ff9a3c,#ff4f9a)', tags: ['orange', 'pink', 'ombre', 'two tone', 'colourful'] },
    flatcandy: { name: 'Cotton candy', plain: true, tex: 'white', tint: '#ff9dcf', tip: '#8ccfff', tipMix: 1, tipStart: 0.3, sw: 'linear-gradient(#ff9dcf,#8ccfff)', tags: ['pink', 'blue', 'ombre', 'pastel', 'two tone', 'colourful'] },
    flatocean: { name: 'Ocean', plain: true, tex: 'white', tint: '#2b62d9', tip: '#4fd8e0', tipMix: 1, tipStart: 0.35, sw: 'linear-gradient(#2b62d9,#4fd8e0)', tags: ['blue', 'teal', 'ombre', 'two tone', 'colourful'] },
    flatrainbow: { name: 'Bright rainbow', plain: true, tex: 'white', rainbow: 0.95, sw: 'conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#7c3aed,#f43f5e)', tags: ['rainbow', 'colourful', 'multicolour'] },
""")
# every Grug hairstyle in the catalog is flat colour: the strand texture's own colour is multiplied into the tints (the Hair
# Studio does the same, labs/hair-studio-x8f3k2: keep TEX_HEX and flatHair the same in both)
rep("  const OWN = (name, tags, sw) => ({ own: true, name, tags, sw });", """  const TEX_HEX = { black: '#1d1f26', blonde: '#e2b98a', blue: '#8dcce0', 'dark blue': '#22357e', 'dark brown': '#4a2a22', green: '#8fdc8b', 'light brown': '#80523c', 'lime green': '#c8dc8b', magenta: '#c598e0', orange: '#de9f8d', pink: '#ee8fb0', purple: '#8d91de', sunset: '#e89369', teal: '#6fd2bf', 'vibrant orange': '#f2a496', white: '#f6f6f6' };
  const hexMul = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(/^#[0-9a-f]{6}$/i.test(a || '') ? a : '#9a9a9a'), B = p(/^#[0-9a-f]{6}$/i.test(b || '') ? b : '#ffffff'); return '#' + A.map((v, i) => Math.round(v * B[i] / 255).toString(16).padStart(2, '0')).join(''); };
  function flatHair(groups) {
    for (const g of groups) {
      if (!g || g.plain) continue; const base = TEX_HEX[g.tex] || '#9a9a9a';
      g.tint = hexMul(base, g.tint); g.tip = hexMul(base, g.tip);
      if (g.twinTex || g.twinTint) { g.twinTint = hexMul(TEX_HEX[g.twinTex || g.tex] || base, g.twinTint || '#ffffff'); g.twinTex = null; }
      if (g.hlAmount > 0 || g.hlTex) g.hlColour = hexMul(TEX_HEX[g.hlTex || g.tex] || base, g.hlColour || '#ffffff'); g.hlTex = null;
      g.plain = true;
    }
    return groups;
  }
  const OWN = (name, tags, sw) => ({ own: true, name, tags, sw });""")
rep("try { const gs = makeStyle(id, { tex: 'dark brown', tint: '#ffffff' }); if (dy) applyDye(gs, dy); return gs; } finally { H.seed(null); }",
    "try { const gs = makeStyle(id, { tex: 'dark brown', tint: '#ffffff' }); if (dy) applyDye(gs, dy); return flatHair(gs); } finally { H.seed(null); }")
# pictures cached on the device from before (textured hair) are taken again
rep("const THUMB_V = 'c1:';", "const THUMB_V = 'c2:';")
rep("      g.hlAmount = 0; g.hlTex = null; g.variety = 0;", "      g.hlAmount = 0; g.hlTex = null; g.variety = 0; g.plain = !!d.plain;")
rep("slots: [g.tex, g.twinTex || g.tex, g.hlTex || g.tex]", "slots: g.plain ? [null, null, null] : [g.tex, g.twinTex || g.tex, g.hlTex || g.tex]")
rep("if (scalp) parts.push({ geo: H.buildScalp(fit, scalp, { lod: L, atlas }), slots: [scalp.tex]", "if (scalp) parts.push({ geo: H.buildScalp(fit, scalp, { lod: L, atlas }), slots: [scalp.plain ? null : scalp.tex]")
rep("for (let i = 0; i < want; i++) { const m = H.material(g); m.map = texes[i];", "for (let i = 0; i < want; i++) { const m = H.material(g); m.map = g.plain ? null : texes[i];")
rep("return { tex: g.tex, tint: g.tint, line: sc.line || 0, shine: 0.3, twinTex: g.mirror ? g.twinTex : null, twinTint: g.mirror ? g.twinTint : null };", "return { tex: g.tex, plain: !!g.plain, tint: g.tint, line: sc.line || 0, shine: 0.3, twinTex: g.mirror ? g.twinTex : null, twinTint: g.mirror ? g.twinTint : null };")
rep("      [first].concat(more).forEach((spec, vi) => {", "      const FLAT = ['flatpink', 'flatlilac', 'flatmint', 'flatsky', 'flatred', 'flatblack', 'flatwhite', 'flatlemon', 'flatsunset', 'flatcandy', 'flatocean', 'flatrainbow'], flat = [FLAT[(bi * 5) % FLAT.length], FLAT[(bi * 7 + 3) % FLAT.length]].filter((x, i, a) => a.indexOf(x) === i);\n      [first].concat(more, flat).forEach((spec, vi) => {")
# the card's maker line: logos for the brands, a player's name otherwise
rep('<span class="cb">By <b>${esc(it.by)}</b>${it.mine ? \'\' : VERIFIED}</span>', '<span class="cb">${byHTML(it)}</span>')
# more items load by themselves as you reach the bottom (the button stays as the trigger, out of sight)
rep("  { const io = new IntersectionObserver(es => { if (appMode === 'catalog' && es.some(e => e.isIntersecting) && cat.count < 480 && $('#catGrid').children.length > 8) { cat.count += 24; renderCatalog(); } }, { root: $('#catalog'), rootMargin: '200px' }); io.observe($('#catMore')); }",
"""  { const more = $('#catMore'), near = () => { if (more.parentElement.hidden) return false; const r = more.getBoundingClientRect(), R = $('#catalog').getBoundingClientRect(); return r.top < R.bottom + 600; };
    let idle = 0, lastN = -1; const grow = () => { if (!window.GrugCatalog || appMode !== 'catalog' || !near() || cat.count >= 4000) return; const n0 = $('#catGrid').children.length; if (n0 === lastN) { if (++idle > 12) return; } else idle = 0; lastN = n0; const top = $('#catalog').scrollTop; cat.count += 24; renderCatalog(); $('#catalog').scrollTop = top; requestAnimationFrame(() => setTimeout(grow, 60)); };
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) grow(); }, { root: $('#catalog'), rootMargin: '600px' }); io.observe(more); $('#catalog').addEventListener('scroll', () => { if (near()) grow(); }, { passive: true }); }""")
rep("cut = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutY)];","cut = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutY)]; sandy.__cut = cut[0];")

rep('FORMATS, exportModel,','FORMATS, exportModel, bakeSingle,')
bake=open(os.path.join(HERE,'src','bake.js')).read()
rep("  async function exportModel(root, fmt, opts) { const f = FORMATS.find(x => x.id === fmt) || FORMATS[0]; return { blob: await f.run(root, opts || {}), ext: f.ext }; }","\n"+bake+"\n  async function exportModel(root, fmt, opts) { opts = opts || {}; const f = FORMATS.find(x => x.id === fmt) || FORMATS[0]; return { blob: await f.run(opts.single === false ? root : bakeSingle(root), opts), ext: f.ext }; }")
import base64
pat_src='data:image/png;base64,'+base64.b64encode(open(os.path.join(HERE,'src','patterns.png'),'rb').read()).decode()
rep('<script id="catalog-app">','<script id="grug-patterns">window.GRUG_PATTERNS={src:"'+pat_src+'",n:168,cols:14,tile:64};</script>\n<script id="grug-jewelry">\n'+jew+'\n</script>\n<script id="catalog-app">')
rep("const GE = window.GrugEyewear, { clamp, lerp, rng, mix } = GE.util;","const GE = window.GrugEyewear, { clamp, lerp, rng, mix } = GE.util, J = window.GrugJewelry;")
rep("const deptOf = it => (it && it.dept) || 'eyewear';","const deptOf = it => (it && it.dept) || 'eyewear';\n  const isJ = it => !!it && (it.dept === 'hats' || it.dept === 'earrings' || it.dept === 'necklaces' || it.dept === 'purses' || it.dept === 'sandals' || it.dept === 'back' || it.dept === 'sound' || it.dept === 'tops' || it.dept === 'jackets' || it.dept === 'bottoms' || it.dept === 'shoes' || it.dept === 'outfits');")
rep("  /* ---------------------------------------------------------------- routing */\n  let toldControls","  await J.ready(); J.init({ sandy, hm, env: envTex }); await J.clothInit(sandy);\n"+integ+"\n"+closet+"\n  /* ---------------------------------------------------------------- routing */\n  let toldControls")


# ---- the closet (src/closet.js): the catalog and the avatar editor in one, now the page's front door. Her materials' own
#      looks are kept before she's painted grey, so the closet can show her in her own colours
rep("for (const m of dress) for (const mat of [].concat(m.material)) { if (!mat || !mat.color) continue; if (!mat.userData.grugMap)",
    "for (const m of dress) for (const mat of [].concat(m.material)) { if (!mat || !mat.color) continue; if (!mat.userData.grug0) mat.userData.grug0 = { map: mat.map, vc: !!mat.vertexColors, color: mat.color.clone(), rough: mat.roughness, metal: mat.metalness }; if (!mat.userData.grugMap)")
rep("          if (!m.userData.grugSkin) m.userData.grugSkin = { map: m.map, vc: !!m.vertexColors };",
    "          if (!m.userData.grug0) m.userData.grug0 = { map: m.map, vc: !!m.vertexColors, color: m.color.clone(), rough: m.roughness, metal: m.metalness };\n          if (!m.userData.grugSkin) m.userData.grugSkin = { map: m.map, vc: !!m.vertexColors };")
CLOSET_HTML = r'''
  <!-- 0. the closet: the catalog and the avatar editor in one (Marketplace | Customize), laid out like Roblox's avatar editor -->
  <section id="closet" class="page cl" data-sheet="half" data-mode="market" hidden>
    <div class="cl-stage" id="clStage">
      <div class="cl-stagebar">
        <div class="rollbtn cl-menuwrap"><button class="cl-round" id="clMenuBtn" aria-label="Make your own" data-g-tip="Make your own" aria-haspopup="menu"><span data-g-logo="tile" class="tile"></span></button><div class="rollmenu createmenu cl-menu" id="clMenu" role="menu" hidden></div></div>
        <div class="cl-pillbox"><button class="cl-round" id="clUndo" aria-label="Undo" data-g-tip="Undo" disabled><i data-g-icon="arrow_counterclockwise"></i></button><button class="cl-round" id="clRedo" aria-label="Redo" data-g-tip="Redo" disabled><i data-g-icon="arrow_clockwise"></i></button></div>
        <button class="cl-round" id="clReset" aria-label="See all of her" data-g-tip="See all of her"><i data-g-icon="person"></i></button>
        <button class="cl-round" id="clModeBtn" data-mode-btn aria-label="Dark mode" data-g-tip="Dark mode"><i data-g-icon="sun_moon"></i></button>
      </div>
      <div class="cl-pose" id="clPose" hidden></div>
      <div class="cl-loading" id="clLoading"><span class="g-brandmark"></span><span>Getting her ready…</span></div>
    </div>
    <div class="cl-resize" id="clResize" role="separator" aria-orientation="vertical" aria-label="Drag to make the catalog wider or narrower" data-g-tip="Drag to resize" tabindex="0"></div>
    <div class="g-seg cl-mode" id="clMode"><button data-mode="market" class="is-on">Marketplace</button><button data-mode="custom">Customize</button></div>
    <div class="cl-panel" id="clPanel">
      <div class="cl-grip" id="clGrip" role="button" aria-label="Drag the panel up or down"></div>
      <div class="cl-tabrow"><nav class="cl-tabs" id="clTabs"></nav>
        <div class="cl-tools" id="clTools"><label class="cl-search"><i data-g-icon="magnifying_glass"></i><input id="clSearch" type="search" placeholder="Try: Christmas" aria-label="Search the marketplace" autocomplete="off"></label><button class="cl-round sm" id="clFilterBtn" aria-label="Filters" data-g-tip="Filters"><i data-g-icon="sliders"></i></button></div></div>
      <nav class="cl-subs" id="clSubs"></nav>
      <div class="cl-filters" id="clFilters" hidden><div class="cl-sortrow"><span class="g-label">Sort</span><select id="clSort" class="g-input"><option value="featured">Featured</option><option value="name">Name, A to Z</option><option value="yours">Yours first</option></select></div></div>
      <div class="cl-body" id="clBody"></div>
      <div class="cl-detail" id="clDetail" hidden></div>
    </div>
  </section>
'''
rep("  <!-- 3. the editor -->", CLOSET_HTML.strip("\n") + "\n\n  <!-- 3. the editor -->")
rep("  function showPage(p) { appMode = p; for (const id of ['catalog', 'item', 'editor']) document.getElementById(id).hidden = id !== p; }\n  showPage(/^#edit/.test(location.hash) ? 'editor' : /^#item\\//.test(location.hash) ? 'item' : 'catalog');",
    "  function showPage(p) { appMode = p; for (const id of ['catalog', 'item', 'editor', 'closet']) document.getElementById(id).hidden = id !== p; }\n  showPage(/^#edit/.test(location.hash) ? 'editor' : 'closet');")

# ---- camera centre
rep("const headCentre = () => headGroup.localToWorld(new THREE.Vector3(0, hm.eyeY + 2.5, 1));","const headCentre = () => JM.on ? JM.centre() : headGroup.localToWorld(new THREE.Vector3(0, hm.eyeY + 2.5, 1));")

# ---- card colours (KIMILAND soft blue card, lilac mannequin)
rep("const cardColour = it => `hsl(${Math.round(cardHue(it))} 78% 72%)`;","const cardColour = it => it.brand === 'kimiland' ? KIMI_CARD : `hsl(${Math.round(cardHue(it))} 78% 72%)`;")
rep("const mannequinColour = it => `hsl(${Math.round((cardHue(it) + 120) % 360)}, 62%, 80%)`;","const mannequinColour = it => it.brand === 'kimiland' ? KIMI_MANN : `hsl(${Math.round((cardHue(it) + 120) % 360)}, 62%, 80%)`;")
rep("    if (deptOf(it) === 'hair') { const [h, s] = GE.util.hsl(it.hex);","    if (isJ(it)) { const e = it.dept === 'sound' ? { col: it.d.cupCol } : it.dept === 'back' ? { col: it.d.sheath ? it.d.sheathCol : it.d.hiltCol } : J.isCloth(it.dept) ? { col: it.d.colA } : it.dept === 'hats' ? { col: it.d.col } : (it.d.seq || it.d.items || it.d.charms)[0] || { col: it.d.body || it.d.strapCol }; return ((GE.util.hsl(e.col)[1] > 0.2 ? GE.util.hsl(e.col)[0] : GE.util.hash(it.id) % 360) + 180) % 360; }\n    if (deptOf(it) === 'hair') { const [h, s] = GE.util.hsl(it.hex);")

# ---- thumbs job
rep("url = hair ? await thumbHair(j.it, mannequinColour(j.it)) : j.mode === 'worn'","url = isJ(j.it) ? (await J.prep(j.it.dept, j.it.d), thumbJewel(j.it, mannequinColour(j.it))) : hair ? await thumbHair(j.it, mannequinColour(j.it)) : j.mode === 'worn'")

# ---- data: generated, itemById, mine, fav
rep("""    const d = GE.random(seed), it = { id: 'g:' + seed, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: i, stamp: 0, gen: true };
    genCache.set(seed, it); return it;""","""    const kg = genEyewear(seed), d = kg.d, it = { id: 'g:' + seed, seed, d, name: kg.name, kind: GE.classify(d), by: brandBy(kg.brand), brand: kg.brand, order: i, stamp: 0, gen: true };
    genCache.set(seed, it); return it;""")
rep("""const d = GE.random(seed); const it = { id, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: 0, stamp: 0, gen: true }; genCache.set(seed, it); return it; }""","""const kg = genEyewear(seed), d = kg.d; const it = { id, seed, d, name: kg.name, kind: GE.classify(d), by: brandBy(kg.brand), brand: kg.brand, order: 0, stamp: 0, gen: true }; genCache.set(seed, it); return it; }""")
rep("  function itemById(id) {\n","  function itemById(id) {\n    if (/^g[enpsabtjlfuk]:/.test(id)) return JM.byId(id);\n")
rep("function mineItems() { return mine().map((m, i) => ({ id: 'm:' + m.id, seed: m.seed || m.id, d: GE.validate(m.d).d, name: m.name, kind: GE.classify(GE.validate(m.d).d), by: 'You', order: -1000 + i, stamp: m.when || 0, mine: true, saved: m })); }",
    "function mineItems() { return mine().map((m, i) => m.dept ? JM.fromMine(m, i) : ({ id: 'm:' + m.id, seed: m.seed || m.id, d: GE.validate(m.d).d, name: m.name, kind: GE.classify(GE.validate(m.d).d), by: 'You', brand: m.brand || 'grug', order: -1000 + i, stamp: m.when || 0, mine: true, saved: m })); }")
rep("{ id: it.id, seed: it.seed, name: it.name, d: it.d, by: it.by, when: Date.now() });","{ id: it.id, seed: it.seed, name: it.name, d: it.d, by: it.by, dept: isJ(it) ? it.dept : undefined, brand: it.brand, when: Date.now() });")
rep("    const d = GE.validate(f.d).d; return { id: f.id, seed: f.seed, d, name: f.name, kind: GE.classify(d), by: f.by || 'Grug Digital',","    if (f.dept === 'hats' || f.dept === 'earrings' || f.dept === 'necklaces' || f.dept === 'purses' || f.dept === 'sandals' || f.dept === 'sound' || f.dept === 'back' || J.isCloth(f.dept)) return JM.fromFav(f);\n    const d = GE.validate(f.d).d; return { id: f.id, seed: f.seed, d, name: f.name, kind: GE.classify(d), brand: f.brand || 'grug', by: f.by || 'Grug Digital',")
rep("    if (deptOf(it) === 'hair') f = HD.families(it);\n","    if (isJ(it)) f = JM.families(it);\n    else if (deptOf(it) === 'hair') f = HD.families(it);\n")

# ---- catalog departments and filters
rep("const REFINE_KEYS = ['worn', 'lens', 'logo', 'texture', 'vibe'];","const REFINE_KEYS = ['worn', 'lens', 'logo', 'texture', 'vibe', 'theme', 'cord', 'mount', 'pattern'];")
rep("lens: 'any', logo: 'any', texture: 'any', vibe: 'any', colour: 'any',","lens: 'any', logo: 'any', texture: 'any', vibe: 'any', theme: 'any', cord: 'any', mount: 'any', pattern: 'any', brand: 'any', colour: 'any',")
rep("['all', 'All items', 'shopping_bag', 'var(--g-lime)'], ['eyewear'","['all', 'All items', 'shopping_bag', 'var(--g-lime)'], ['tops', 'Tops', 'shirt', 'var(--g-yellow)'], ['jackets', 'Jackets', 'jacket', 'var(--g-orange)'], ['bottoms', 'Bottoms', 'pants', 'var(--g-blue)'], ['shoes', 'Shoes', 'shoe', 'var(--g-red)'], ['outfits', 'Outfits', 'outfit', 'var(--g-purple)'], ['hats', 'Hats', 'hat', 'var(--g-lime)'], ['eyewear'")
rep("['hair', 'Hair', 'hair', 'var(--g-pink)'], ['favs'","['hair', 'Hair', 'hair', 'var(--g-pink)'], ['earrings', 'Earrings', 'diamond', 'var(--g-purple)'], ['necklaces', 'Necklaces', 'flower', 'var(--g-orange)'], ['purses', 'Purses', 'shopping_bag', 'var(--g-pink)'], ['sandals', 'Sandals', 'sun', 'var(--g-blue)'], ['sound', 'Sound', 'note', 'var(--g-teal)'], ['back', 'Back', 'sword', 'var(--g-red)'], ['favs'")
rep("const SUBS = { eyewear: [['glasses', 'Glasses'], ['shades', 'Shades'], ['goggles', 'Goggles']], hair: HD ? HD.SUB : [] };","const SUBS = { eyewear: [['glasses', 'Glasses'], ['shades', 'Shades'], ['goggles', 'Goggles']], hair: HD ? HD.SUB : [], hats: J.HAT_KINDS.map(([k]) => [k, J.KIND_LABEL[k]]), earrings: [['studs', 'Studs'], ['drops', 'Drops'], ['danglers', 'Danglers'], ['hoops', 'Hoops']], necklaces: [['choker', 'Chokers'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']], sandals: [['slide', 'Slides'], ['thong', 'Thongs'], ['ankle', 'Ankle straps'], ['gladiator', 'Gladiators'], ['wrap', 'Wraps'], ['slipper', 'Slippers']], purses: [['satchel', 'Satchels'], ['tote', 'Totes'], ['bucket', 'Buckets'], ['round', 'Rounds'], ['heart', 'Hearts'], ['clutch', 'Clutches']], sound: [['over', 'Headphones'], ['muffs', 'Earmuffs'], ['buds', 'Earbuds']], back: [['back1', 'One on the back'], ['back2', 'Two on the back'], ['hip', 'At the hip']], tops: J.CLOTH_SUBS.tops, jackets: J.CLOTH_SUBS.jackets, bottoms: J.CLOTH_SUBS.bottoms, shoes: J.CLOTH_SUBS.shoes, outfits: J.CLOTH_SUBS.outfits };")
rep("  const REFINE = {\n","""  const F_THEME = [['any', 'Any theme', 'sparkle_dummy'], ['Christmas', 'Christmas', null], ['Halloween', 'Halloween', null], ["Valentine's Day", "Valentine's Day", null], ['Shapes', 'Plain shapes', null]];
  const F_BRAND = [['any', 'Any brand'], ['grug', 'Grug Digital'], ['kimiland', 'KIMILAND'], ['players', 'Made by players']];
  const REFINE = {
    earrings: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['mount', 'Mount', [['any', 'Any mount', null], ['Stud', 'Studs', null], ['Hook', 'Hooks', null]]]],
    necklaces: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['cord', 'Cord', [['any', 'Any cord', null], ['Chain', 'Chain', null], ['Cord', 'Cord', null], ['Ribbon', 'Ribbon', null], ['Beads', 'Beads', null], ['Pearls', 'Pearls', null]]]],
    sandals: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['mount', 'Sole', [['any', 'Any sole', null], ['Flat', 'Flat', null], ['Platform', 'Platform', null], ['Wedge', 'Wedge', null], ['Block', 'Block heel', null]]], ['pattern', 'Colour', [['any', 'Any colour style', null], ['Solid', 'Solid colour', null], ['Gradient', 'Gradient', null], ['Patterned', 'Patterned', null]]]],
    purses: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['cord', 'Strap', [['any', 'Any strap', null], ['Chain', 'Chain', null], ['Strap', 'Strap', null], ['Wide strap', 'Wide strap', null], ['Cord', 'Cord', null], ['Beads', 'Beads', null], ['Pearls', 'Pearls', null]]], ['pattern', 'Pattern', [['any', 'Any pattern', null], ['Gingham', 'Gingham', null], ['Stripes', 'Stripes', null], ['Polka dots', 'Polka dots', null], ['Quilted', 'Quilted', null], ['Checks', 'Checks', null], ['Print', 'Prints', null]]]],
    back: [['mount', 'Blade', [['any', 'Bare or sheathed', null], ['Bare blade', 'Bare blade', null], ['Sheathed', 'Sheathed', null]]], ['pattern', 'Extras', [['any', 'Any extras', null], ['Patterned', 'Patterned', null], ['Gem', 'Gem in the pommel', null], ['Strap', 'With a strap', null], ['Belt', 'With a belt', null]]]],
    hats: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    tops: [['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    jackets: [['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    bottoms: [['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    shoes: [['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    outfits: [['pattern', 'Print', [['any', 'Any print', null], ['Solid colour', 'Solid colour', null], ['Patterned', 'Patterned', null]]]],
    sound: [['cord', 'Cord', [['any', 'Wired or wireless', null], ['Wired', 'Wired', null], ['Wireless', 'Wireless', null]]], ['mount', 'On top', [['any', 'Anything on top', null], ['Cat ears', 'Cat ears', null], ['Bunny ears', 'Bunny ears', null], ['Bear ears', 'Bear ears', null], ['Devil horns', 'Devil horns', null], ['Bow', 'Bow', null]]], ['pattern', 'Extras', [['any', 'Any extras', null], ['Patterned', 'Patterned', null], ['Glow', 'Glowing ring', null], ['Mic', 'Boom mic', null], ['Coiled cord', 'Coiled cord', null], ['Remote', 'Inline remote', null]]]],
""")
# passes
rep("    if (f.dept === 'eyewear' || f.dept === 'hair') {\n      if (dp !== f.dept) return false;\n      if (f.sub !== 'all') { if (dp === 'eyewear' ? it.kind !== f.sub : !(it.length === f.sub || it.tags.includes(f.sub))) return false; }\n    }",
    "    if (f.brand !== 'any' && (it.brand || 'grug') !== f.brand) return false;\n    if (f.dept === 'eyewear' || f.dept === 'hair' || f.dept === 'hats' || f.dept === 'earrings' || f.dept === 'necklaces' || f.dept === 'purses' || f.dept === 'sandals' || f.dept === 'sound' || f.dept === 'back' || J.isCloth(f.dept)) {\n      if (dp !== f.dept) return false;\n      if (f.sub !== 'all') { if (dp === 'eyewear' || isJ(it) ? it.kind !== f.sub : !(it.length === f.sub || it.tags.includes(f.sub))) return false; }\n    }")
rep("    } else if (dp === 'hair') {\n      if (f.texture","    } else if (isJ(it)) {\n      const tg = J.tagsFor(dp, it.d); if (f.theme !== 'any' && !tg.includes(f.theme)) return false; if (f.cord !== 'any' && !tg.includes(f.cord)) return false; if (f.mount !== 'any' && !tg.includes(f.mount)) return false; if (f.pattern !== 'any' && !tg.includes(f.pattern)) return false;\n    } else if (dp === 'hair') {\n      if (f.texture")
rep("it._q || (it._q = (deptOf(it) === 'hair' ? [it.name,","it._q || (it._q = (isJ(it) ? JM.text(it) : deptOf(it) === 'hair' ? [it.name,")
rep(".join(' ').toLowerCase().replace(/colour/g, 'color')",".join(' ').concat(it.brand === 'kimiland' ? ' kimiland pastel' : it.brand === 'players' ? ' ' + it.by + ' player' : ' grug digital').toLowerCase().replace(/colour/g, 'color')")
# search: the closet's search (synonyms, plurals, charm themes, colours; src/closet.js) once it's there
rep("    if (q) { const t = searchText(it); if (!q.split(/\\s+/).every(w => t.includes(w))) return false; }",
    "    if (q) { const t = searchText(it); if (window.__clq ? !window.__clq.match(t + ' ' + window.__clq.extra(it), q, f.qany) : !q.split(/\\s+/).every(w => t.includes(w))) return false; }")
# allItems
rep("    out.push(...hairItems());\n","    out.push(...hairItems());\n    for (let i = 0; i < cat.count; i++) { const a = JM.gen('earrings', catSeed + '-' + i), b = JM.gen('necklaces', catSeed + '-' + i), c = JM.gen('purses', catSeed + '-' + i), e2 = JM.gen('sandals', catSeed + '-' + i), f2 = JM.gen('sound', catSeed + '-' + i), g2 = JM.gen('back', catSeed + '-' + i); a.order = i * 6 + 1.3; b.order = i * 6 + 2.3; c.order = i * 6 + 3.3; e2.order = i * 6 + 4.3; f2.order = i * 6 + 5.3; g2.order = i * 6 + 5.6; out.push(a, b, c, e2, f2, g2); J.CLOTH_DEPTS.forEach((dp, k) => { const x = JM.gen(dp, catSeed + '-' + i); x.order = i * 6 + 5.65 + k * 0.06; out.push(x); }); if (J.hasHats()) { const h2 = JM.gen('hats', catSeed + '-' + i); h2.order = i * 6 + 5.98; out.push(h2); } }\n")
# brand group in filters (after refine, before colour)
rep("    const g = el('div', '', '<div class=\"g-label\">Colour</div>'), grid = el('div', 'swgrid');","""    { const g = el('div', '', '<div class="g-label">Brand</div>'), nav = el('nav'); g.append(nav); rb.append(g);
      for (const [v, l] of F_BRAND) { const n = count({ brand: v }); if (!n && v !== 'any' && cat.brand !== v) continue; btn(nav, l, null, null, n, cat.brand === v, 'plain', () => { cat.brand = v; renderCatalog(); }); } }
    const g = el('div', '', '<div class="g-label">Colour</div>'), grid = el('div', 'swgrid');""")
rep("const RESET = () => Object.fromEntries(REFINE_KEYS.map(k => [k, 'any']));","const RESET = () => Object.fromEntries(REFINE_KEYS.map(k => [k, 'any']));")
rep("$('#catMore').parentElement.hidden = total <= items.length && cat.dept !== 'all' && cat.dept !== 'eyewear';","$('#catMore').parentElement.hidden = total <= items.length && cat.dept !== 'all' && cat.dept !== 'eyewear' && cat.dept !== 'hats' && cat.dept !== 'earrings' && cat.dept !== 'necklaces' && cat.dept !== 'purses' && cat.dept !== 'sandals' && cat.dept !== 'sound' && cat.dept !== 'back' && !J.isCloth(cat.dept);")
# card: KIMILAND tag
rep("${it.mine ? '<span class=\"g-pill g-pill--solid tag\">Yours</span>' : ''}</span><span class=\"cn\">","${it.mine ? '<span class=\"g-pill g-pill--solid tag\">Yours</span>' : it.brand === 'kimiland' ? '<button class=\"kimilogo tag\" aria-label=\"KIMILAND\"><img src=\"../../assets/brands/kimiland-logo.png\" alt=\"\"></button>' : ''}</span><span class=\"cn\">")

rep("    a.querySelector('.fav').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleFav(it); });","    a.querySelector('.fav').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleFav(it); });\n    { const kb = a.querySelector('.kimilogo'); if (kb) kb.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); kimiAsk(); }); }")
rep("    syncFavBtn(); $('#itRemove').hidden","    for (const x of $$('#itemView .kimilogo')) x.remove(); if (it.brand === 'kimiland') $('#itemView').append(kimiLogoBtn());\n    syncFavBtn(); $('#itRemove').hidden")
# ---- hover
rep("    else { b = GE.build(it.d, hm, { seed: it.seed }); b.root.userData.catalogItem = true; }\n    hover.a = a;","    else if (isJ(it)) { b = JM.mountItem(it); }\n    else { b = GE.build(it.d, hm, { seed: it.seed }); b.root.userData.catalogItem = true; }\n    hover.a = a;")
rep("    headGroup.add(b.root); paintBody(mannequinColour(it)); setHair(hair); sandy.object3d.updateMatrixWorld(true);\n    const sph = new THREE.Box3().setFromObject(b.root).union(new THREE.Box3().setFromObject(sandy.n3.headMesh)).getBoundingSphere(new THREE.Sphere());\n    hover.c = sph.center; hover.dist = sph.radius / Math.sin(13 * Math.PI / 180); hover.pitch = hair ? 0.12 : 0.14 + it.d.tilt * 0.1;",
    "    if (!isJ(it)) headGroup.add(b.root); paintBody(mannequinColour(it)); setHair(hair || isJ(it)); sandy.object3d.updateMatrixWorld(true);\n    const sph = (isJ(it) ? JM.frameBox(b.root, it) : new THREE.Box3().setFromObject(b.root).union(new THREE.Box3().setFromObject(sandy.n3.headMesh))).getBoundingSphere(new THREE.Sphere());\n    hover.c = sph.center; hover.dist = sph.radius / Math.sin(13 * Math.PI / 180); hover.pitch = isJ(it) ? 0.1 : hair ? 0.12 : 0.14 + it.d.tilt * 0.1;")
rep("    headGroup.remove(hover.b.root); hover.b.dispose(); hover.b = null;","    if (hover.b.root.parent) hover.b.root.parent.remove(hover.b.root); hover.b.dispose(); hover.b = null;")

# ---- item page
rep("    if (deptOf(it) === 'hair') { if (viewer.shown) place(viewer.shown); if (worn) worn.root.visible = false; frameItem(); return; }\n    if (viewer.built)","    if (isJ(it)) return jewelShow();\n    if (deptOf(it) === 'hair') { if (viewer.shown) place(viewer.shown); if (worn) worn.root.visible = false; frameItem(); return; }\n    if (viewer.built)")
rep("`<dt>Triangles</dt><dd>${viewer.built.info.tris.toLocaleString()} · under Roblox's ${GE.TRI_LIMIT.toLocaleString()} limit</dd>`","`<dt>Triangles</dt><dd>${viewer.built.info.tris.toLocaleString()} · ${viewer.built.info.tris <= GE.TRI_LIMIT ? 'under' : 'over'} Roblox's ${GE.TRI_LIMIT.toLocaleString()} limit</dd>`")
rep("$('#itDesc').textContent = hair ? it.desc : GE.describe(it.d);","$('#itDesc').textContent = hair ? it.desc : isJ(it) ? J.describe(it.dept, it.d) : GE.describe(it.d);")
rep("""    $('#itCrumbs').innerHTML = `<a href="#" data-go="${hair ? 'hair' : 'eyewear'}">${hair ? 'Hair' : 'Eyewear'}</a><i class="sep">›</i><span>${esc(hair ? it.length.charAt(0).toUpperCase() + it.length.slice(1) : GE.CLASS_LABEL[it.kind])}</span>`;""",
    """    $('#itCrumbs').innerHTML = isJ(it) ? `<a href="#" data-go="${it.dept}">${JDEPT[it.dept].label}</a><i class="sep">›</i><span>${esc(J.KIND_LABEL[it.kind] || it.kind)}</span>` : `<a href="#" data-go="${hair ? 'hair' : 'eyewear'}">${hair ? 'Hair' : 'Eyewear'}</a><i class="sep">›</i><span>${esc(hair ? it.length.charAt(0).toUpperCase() + it.length.slice(1) : GE.CLASS_LABEL[it.kind])}</span>`;""")
rep("$('#itByRow').innerHTML = 'By <b id=\"itBy\">' + esc(it.by) + '</b>' + (it.mine ? '' : VERIFIED);","$('#itByRow').innerHTML = byHTML(it, true);")
rep("for (const t of hair ? it.tags.filter(t => t !== 'yours').map(t => t.charAt(0).toUpperCase() + t.slice(1)) : GE.tagsFor(it.d)) tg.append","for (const t of hair ? it.tags.filter(t => t !== 'yours').map(t => t.charAt(0).toUpperCase() + t.slice(1)) : isJ(it) ? J.tagsFor(it.dept, it.d) : GE.tagsFor(it.d)) tg.append")
rep("$('#itTry').classList.toggle('is-on', viewer.tryOn);\n    $('#itEdit').querySelector('span').textContent = hair ? 'Edit in the Hair Studio' : 'Edit this pair';","$('#itTry').classList.toggle('is-on', viewer.tryOn); $('#itTry').hidden = isJ(it);\n    $('#itEdit').querySelector('span').textContent = hair ? 'Edit in the Hair Studio' : isJ(it) ? 'Edit these' : 'Edit this pair';")
# note text for jewelry
rep("    // the same hairstyle in its other colours\n","    if (isJ(it)) $('#itNote').textContent = it.dept === 'hats' ? 'Hats are to wear here, not to download. Change their colours, print and charms in the Hat studio.' : J.isCloth(it.dept) ? 'Clothing is to wear here, not to download. Change its colours and print in its studio.' : it.dept === 'back' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres for her back or hip. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Sword parts: Modular Sword Kit by MilkAndBanana (CC0).' : it.dept === 'sound' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres for her head (and her chest, when it has a cord). Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.' : it.dept === 'sandals' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to fit her feet (a pair, in one mesh). Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart.' : it.dept === 'purses' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to hang across her body. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.' : it.dept === 'earrings' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres for her head. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.' : 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to sit on her neck and chest. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.';\n    // the same hairstyle in its other colours\n")
rep("      $('#itSpecs').innerHTML = specRows(it.d);\n      showItemModel();","      $('#itSpecs').innerHTML = isJ(it) ? JM.specRows(it) : specRows(it.d);\n      showItemModel();")
rep("    } else {\n      const arch = { glasses:","    } else if (isJ(it)) { jewelLike(like, it);\n    } else {\n      const arch = { glasses:")
# itEdit
rep("    loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false }); commit(); location.hash = '#edit';","    if (isJ(it)) { JM.load(it.dept, it.d, { name: it.name, seed: it.seed, autoName: false }); JM.on = false; store.set(JKEY(it.dept), { d: JM.st.d, name: JM.st.name, seed: JM.st.seed, autoName: false }); JM.st = null; location.hash = '#edit/' + it.dept; return; }\n    loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false, brand: it.brand }); commit(); location.hash = '#edit';")
rep("$('#itRemove').onclick = () => { const it = viewer.item; if (!it || !it.mine || deptOf(it) === 'hair') return;","$('#itRemove').onclick = () => { const it = viewer.item; if (!it || !it.mine || deptOf(it) === 'hair') return;")
# download
rep("if (deptOf(w) === 'hair') downloadHair(w, b.dataset.fmt); else downloadAs(w.d, w.seed, w.name, b.dataset.fmt); };","if (deptOf(w) === 'hair') downloadHair(w, b.dataset.fmt); else if (isJ(w)) JM.download(w, b.dataset.fmt); else downloadAs(w.d, w.seed, w.name, b.dataset.fmt); };")
rep("formatMenu($('#bExport'), $('#edFormats'), () => ({ d: state.d, seed: state.seed, name: state.name }));","formatMenu($('#bExport'), $('#edFormats'), () => JM.on ? { dept: JM.dept, d: JM.st.d, seed: JM.st.seed, name: JM.st.name } : ({ d: state.d, seed: state.seed, name: state.name }));")

# ---- the look: the site's light or dark setting (light unless they picked dark), a soft pink accent and a pink Grug tile
rep('<html lang="en" data-g-theme="dark" data-g-accent="lime">', '<html lang="en" data-g-theme="light" data-g-accent="pink">')
rep('<meta charset="utf-8">', """<meta charset="utf-8">
<script>try{var gp=JSON.parse(localStorage.getItem('grug.profile.v1')||'null');document.documentElement.setAttribute('data-g-theme',gp&&gp.prefs&&gp.prefs.mode==='dark'?'dark':'light')}catch(e){}</script>""")
rep('<div id="app" data-g-accent="lime">', '<div id="app" data-g-accent="pink">')
rep('<div id="editor" class="page" data-g-theme="dark" hidden>', '<div id="editor" class="page" hidden>')
rep('<section id="catalog" class="page shop" data-g-theme="light" hidden>', '<section id="catalog" class="page shop" hidden>')
rep('<section id="item" class="page shop" data-g-theme="light" hidden>', '<section id="item" class="page shop" hidden>')
rep("    auto:    {tile:'#9BE338', mark:'#1F1A17', word:'var(--g-brand-text,#1A2410)', solo:'var(--g-text,#1F1A17)'},\n    light:   {tile:'#9BE338', mark:'#1F1A17', word:'#1A2410', solo:'#1F1A17'},\n    dark:    {tile:'#9BE338', mark:'#1F1A17', word:'#F0F0F3', solo:'#9BE338'},",
    "    auto:    {tile:'#FF8FC2', mark:'#1F1A17', word:'var(--g-brand-text,#1A2410)', solo:'var(--g-text,#1F1A17)'},\n    light:   {tile:'#FF8FC2', mark:'#1F1A17', word:'#1A2410', solo:'#1F1A17'},\n    dark:    {tile:'#FF8FC2', mark:'#1F1A17', word:'#F0F0F3', solo:'#FF8FC2'},")
rep("#loading .g-brandmark{width:3.2rem;height:4rem;color:var(--g-lime);", "#loading .g-brandmark{width:3.2rem;height:4rem;color:var(--g-pink);")
rep('        <button class="g-btn g-btn--ghost g-btn--icon g-btn--sm" id="bRedo"', '        <button class="g-btn g-btn--ghost g-btn--icon g-btn--sm" data-mode-btn aria-label="Dark mode" data-g-tip="Dark mode"><i data-g-icon="sun_moon"></i></button>\n        <button class="g-btn g-btn--ghost g-btn--icon g-btn--sm" id="bRedo"')

# ---- three icons the site's set doesn't have yet (a sword, a shirt, light/dark), added before the page draws its icons
rep('<script id="grug-colors">', '<script id="grug-icons-extra">Object.assign(window.GRUG_DATA.icons, { sword: [\'<path fill="currentColor" d="M14.6 1.4 14.3 3.3 7.4 10.2 5.8 8.6 12.7 1.7zM3.3 8.7l1.1-1.1 4 4-1.1 1.1zM5 11l.9.9-3 3q-.5.4-1 0l-.8-.8q-.4-.5 0-1z"/>\', \'sword blade weapon back\'], shirt: [\'<path fill="currentColor" d="M5.5 2 2 3.6.8 7l2.4 1 .4-1v7h8.8V7l.4 1 2.4-1L14 3.6 10.5 2Q8 4 5.5 2z"/>\', \'shirt top clothing tee\'], jacket: [\'<path fill="currentColor" d="M5.5 1.6 2.2 3.2 1 8.8 1.6 14h3V7.5L5.5 6V14H8V4.2zM10.5 1.6 13.8 3.2 15 8.8 14.4 14h-3V7.5l-.9-1.5V14H8V4.2z"/>\', \'jacket coat clothing\'], pants: [\'<path fill="currentColor" d="M4 1.5h8l.8 13H9.6L8 6.5 6.4 14.5H3.2z"/>\', \'pants trousers bottoms clothing\'], shoe: [\'<path fill="currentColor" d="M1.5 5h4.2l1.2 2.2 4.6 1.6q3 .8 3 3.2v1.5H1.5zM1.5 12.6h13v.9h-13z"/>\', \'shoe sneaker boot clothing\'], outfit: [\'<path fill="currentColor" d="M5.5 1.5 3 3l-1 4 1.8.6.6-1.6V9L3.6 15h3.6L8 11l.8 4h3.6L11.6 9V6l.6 1.6L14 7l-1-4-2.5-1.5Q8 3 5.5 1.5"/>\', \'outfit overalls suit clothing\'], sun_moon: [\'<path fill="currentColor" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1m0 2v10a5 5 0 0 1 0-10"/>\', \'light dark theme mode\'], hat: [\'<path fill="currentColor" d="M4.6 2.2h6.8l.7 8.4H3.9zM.8 11.3q7.2-1.9 14.4 0v1.6q-7.2-1.5-14.4 0z"/>\', \'hat cap beanie headwear\'], check: [\'<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2.6 8.6 6.4 12.2 13.4 4.2"/>\', \'check done tick equip\'], sparkle: [\'<path fill="currentColor" d="M8 .8 9.6 6.4 15.2 8 9.6 9.6 8 15.2 6.4 9.6.8 8 6.4 6.4z"/>\', \'sparkle shine new\'] });</script>\n<script id="grug-colors">')

# ---- the camera pans too: middle mouse button (or scroll-wheel press) drag on a computer, two fingers on a touch screen
rep("""  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; canvas.setPointerCapture(e.pointerId); spin.on = false; renderSpin(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    cam.yaw = drag.yaw - dx * 0.008; cam.pitch = clamp(drag.pitch + dy * 0.006, -0.3, 1.25);
  });""", """  // a screen-space move of (dx, dy) pixels slides the point she's framed on, so she follows the pointer
  function panBy(from, dx, dy) {
    const h = Math.max(1, canvas.clientHeight), k = 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / h;
    camera.updateMatrixWorld(); const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    cam.target.copy(from).addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    cam.target.x = clamp(cam.target.x, -70, 70); cam.target.y = clamp(cam.target.y, -20, 210); cam.target.z = clamp(cam.target.z, -70, 70);
  }
  canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, pan: e.pointerType === 'mouse' && e.button === 1, t: cam.target.clone() }; if (drag.pan) e.preventDefault(); canvas.setPointerCapture(e.pointerId); spin.on = false; renderSpin(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.pan) { panBy(drag.t, dx, dy); return; }
    cam.yaw = drag.yaw - dx * 0.008; cam.pitch = clamp(drag.pitch + dy * 0.006, -0.3, 1.25);
  });""")
rep("""  { const pts = new Map(); let base = 0, d0 = 0; canvas.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = Array.from(pts.values()); base = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = cam.dist; drag = null; } });
    canvas.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && base) { const [a, b] = Array.from(pts.values()); cam.dist = clamp(d0 * base / Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), ZOOM[0], ZOOM[1]); } });""",
"""  { const pts = new Map(); let base = 0, d0 = 0, c0 = null, t0 = null; canvas.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = Array.from(pts.values()); base = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = cam.dist; c0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; t0 = cam.target.clone(); drag = null; } });
    canvas.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && base) { const [a, b] = Array.from(pts.values()); cam.dist = clamp(d0 * base / Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), ZOOM[0], ZOOM[1]); panBy(t0, (a[0] + b[0]) / 2 - c0[0], (a[1] + b[1]) / 2 - c0[1]); } });""")

# ---- editor dispatch
rep("  function undo() { if (hist.i > 0)","  function undo() { if (JM.on) return JM.undo(); if (hist.i > 0)")
rep("  function redo() { if (hist.i < hist.stack.length - 1)","  function redo() { if (JM.on) return JM.redo(); if (hist.i < hist.stack.length - 1)")
rep("  function rebuild(now) {\n","  function rebuild(now) {\n    if (JM.on) return JM.rebuild(now);\n")
rep("  function roll(how) {\n","  function roll(how) {\n    if (JM.on) return JM.roll(how);\n")
rep("  function renderInspector() {\n","  function renderInspector() {\n    if (JM.on) return JM.inspector();\n")
rep("  function renderRolls() {\n","  function renderRolls() {\n    if (JM.on) return JM.renderRolls();\n")
rep("  function renderStarters() {\n","  function renderStarters() {\n    if (JM.on) return JM.renderStarters();\n")
rep("$('#docName').oninput = e => { state.name = e.target.value; state.autoName = false; };\n  $('#docName').onchange = () => commit();","$('#docName').oninput = e => { if (JM.on) { JM.st.name = e.target.value; JM.st.autoName = false; return; } state.name = e.target.value; state.autoName = false; };\n  $('#docName').onchange = () => JM.on ? JM.commit() : commit();")
rep("  $('#bName').onclick = () => { state.seed","  $('#bName').onclick = () => { if (JM.on) return JM.rename(); state.seed")
rep("  $('#bPublish').onclick = () => { const list = mine(); list.unshift({ id: Date.now().toString(36), seed: state.seed, name: state.name || 'My eyewear', d: state.d, when: Date.now() });","  $('#bPublish').onclick = () => { if (JM.on) return JM.publish(); const list = mine(); list.unshift({ id: Date.now().toString(36), seed: state.seed, name: state.name || 'My eyewear', d: state.d, brand: state.brand, when: Date.now() });")
rep("function persist() { if (store.set(KEY,","function persist() { if (JM.on) return JM.persist(); if (store.set(KEY,")

# ---- eyewear brand: state, snap, restore, loadDesign, set, roll
rep("let state = { d: GE.DEF(), name: '', seed: '', autoName: true };","let state = { d: GE.DEF(), name: '', seed: '', autoName: true, brand: 'grug' };")
rep("const snap = () => JSON.stringify({ d: state.d, name: state.name, seed: state.seed, autoName: state.autoName });","const snap = () => JSON.stringify({ d: state.d, name: state.name, seed: state.seed, autoName: state.autoName, brand: state.brand });")
rep("state = { d: GE.validate(s.d).d, name: s.name, seed: s.seed, autoName: s.autoName }; rebuild(true); renderInspector(); }","state = { d: GE.validate(s.d).d, name: s.name, seed: s.seed, autoName: s.autoName, brand: s.brand || 'grug' }; rebuild(true); renderInspector(); }")
rep("function loadDesign(d, o) { o = o || {}; state.d = GE.validate(d).d;","function loadDesign(d, o) { o = o || {}; state.brand = o.brand || (o.keepBrand === false ? 'grug' : state.brand) || 'grug'; state.d = GE.validate(state.brand === 'kimiland' ? kimiEye(d) : d).d;")
rep("    Object.assign(state.d, patch); state.d = GE.validate(state.d).d;\n    if (state.autoName && final) state.name = GE.nameFor(state.d, state.seed);","    Object.assign(state.d, patch); state.d = GE.validate(state.brand === 'kimiland' ? kimiEye(state.d) : state.d).d;\n    if (state.autoName && final) state.name = state.brand === 'kimiland' ? kimiName(GE.nameFor(state.d, state.seed), state.seed) : GE.nameFor(state.d, state.seed);")
rep("    const d = GE.random(seed, opts);\n    if (state.d.logoArt","    let d = GE.random(seed, opts); if (state.brand === 'kimiland') d = GE.validate(opts.keep ? kimiEye(d) : kimiEyeRandom(d, seed)).d;\n    if (state.d.logoArt")
rep("    state = { d, seed, autoName: true, name: GE.nameFor(d, seed) };\n    rebuild(true); renderInspector(); commit();\n    rolls =","    state = { d, seed, autoName: true, brand: state.brand, name: state.brand === 'kimiland' ? kimiName(GE.nameFor(d, seed), seed) : GE.nameFor(d, seed) };\n    rebuild(true); renderInspector(); commit();\n    rolls =")
# eyewear brand control on the Fit tab (Name group)
rep("      const g3 = grp(box, 'Name');\n      const nr","      const gb = grp(box, 'Brand'); { const w = el('div', 'segwrap c2'); for (const [v, l] of J.BRANDS) { const b = el('button', state.brand === v ? 'on' : '', `<span>${esc(l)}</span>`); b.onclick = () => { state.brand = v; if (v === 'kimiland') state.d = GE.validate(kimiEye(state.d)).d; if (state.autoName) state.name = v === 'kimiland' ? kimiName(GE.nameFor(state.d, state.seed), state.seed) : GE.nameFor(state.d, state.seed); rebuild(true); commit(); renderInspector(); }; w.append(b); } gb.append(w); if (state.brand === 'kimiland') gb.append(el('div', 'note', 'KIMILAND pieces are always pastel. Whatever colour you pick is softened to the nearest pastel.')); }\n      const g3 = grp(box, 'Name');\n      const nr")

# ---- start: restore eyewear brand
rep("if (saved && saved.d) { state = { d: GE.validate(saved.d).d, name: saved.name || '', seed: saved.seed || 'saved', autoName: saved.autoName !== false };","if (saved && saved.d) { state = { d: GE.validate(saved.d).d, name: saved.name || '', seed: saved.seed || 'saved', autoName: saved.autoName !== false, brand: saved.brand || 'grug' };")
# ---- routing
rep("function route() { hoverEnd(); const h = location.hash; if (/^#edit/.test(h)) enterEditor();","function route() { hoverEnd(); const h = location.hash, jm = /^#edit\\/(hats|earrings|necklaces|purses|sandals|sound|back|tops|jackets|bottoms|shoes|outfits)/.exec(h); if (!jm) JM.leave(); if (/^#edit/.test(h)) { enterEditor(); if (jm) JM.enter(jm[1]); }")
# hero + create menu + search text
rep("Search glasses, shades, goggles and hair","Search glasses, hair, earrings, necklaces, purses, sandals, headphones and brands")
rep("Glasses, shades, goggles and hair, all made from scratch. Open anything","Glasses, shades, goggles, hair, earrings, necklaces, purses, sandals, headphones, earmuffs and earbuds, all made from scratch. Open anything")
rep('<a role="menuitem" id="createHair" href="#">','<a role="menuitem" href="#edit/earrings"><i data-g-icon="diamond"></i><span><b>Earrings editor</b><span>Stack charms and shapes into a pair</span></span></a><a role="menuitem" href="#edit/necklaces"><i data-g-icon="flower"></i><span><b>Necklace editor</b><span>Any length, with charms and shapes on the cord</span></span></a><a role="menuitem" href="#edit/purses"><i data-g-icon="shopping_bag"></i><span><b>Purse editor</b><span>Bag shapes, straps, patterns and keychains</span></span></a><a role=\"menuitem\" href=\"#edit/sandals\"><i data-g-icon=\"sun\"></i><span><b>Sandal editor</b><span>Soles, straps, gradients and strap charms</span></span></a><a role=\"menuitem\" href=\"#edit/sound\"><i data-g-icon=\"note\"></i><span><b>Sound editor</b><span>Headphones, earmuffs and earbuds, wired or wireless</span></span></a><a role=\"menuitem\" href=\"#edit/back\"><i data-g-icon=\"sword\"></i><span><b>Sword studio</b><span>Swords for her back or hip, from modular parts</span></span></a><a role=\"menuitem\" href=\"#edit/tops\"><i data-g-icon=\"shirt\"></i><span><b>Tops studio</b><span>Tees, shirts, hoodies: three colours and a print</span></span></a><a role=\"menuitem\" href=\"#edit/jackets\"><i data-g-icon=\"jacket\"></i><span><b>Jackets studio</b><span>Zip jackets and blazers</span></span></a><a role=\"menuitem\" href=\"#edit/bottoms\"><i data-g-icon=\"pants\"></i><span><b>Bottoms studio</b><span>Trousers, jeans, shorts and skirts</span></span></a><a role=\"menuitem\" href=\"#edit/shoes\"><i data-g-icon=\"shoe\"></i><span><b>Shoes studio</b><span>Sneakers and boots</span></span></a><a role=\"menuitem\" href=\"#edit/outfits\"><i data-g-icon=\"outfit\"></i><span><b>Outfits studio</b><span>Whole looks in one piece</span></span></a><a role="menuitem" id="createHair" href="#">')
rep('<button class="g-btn" id="heroShuffle"','<button class="g-btn" id="heroEar" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="diamond"></i><span>Roll earrings</span></button><button class="g-btn" id="heroNeck" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="flower"></i><span>Roll a necklace</span></button><button class="g-btn" id="heroPurse" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="shopping_bag"></i><span>Roll a purse</span></button><button class=\"g-btn\" id=\"heroSandal\" style=\"background:rgba(255,255,255,.1);color:var(--g-snow)\"><i data-g-icon=\"sun\"></i><span>Roll sandals</span></button><button class=\"g-btn\" id=\"heroSound\" style=\"background:rgba(255,255,255,.1);color:var(--g-snow)\"><i data-g-icon=\"note\"></i><span>Roll headphones</span></button><button class="g-btn" id="heroShuffle"')
rep("  $('#heroRoll').onclick = () => { roll('all'); location.hash = '#edit'; };","  $('#heroRoll').onclick = () => { roll('all'); location.hash = '#edit'; };\n  for (const [id, dept] of [['#heroEar', 'earrings'], ['#heroNeck', 'necklaces'], ['#heroPurse', 'purses'], ['#heroSandal', 'sandals'], ['#heroSound', 'sound']]) $(id).onclick = () => { if (location.hash === '#edit/' + dept) return; JM.dept = dept; location.hash = '#edit/' + dept; setTimeout(() => JM.roll('all'), 60); };")
# exporter alpha mask
rep("      if (m.transparent) M.alphaMode = 'BLEND';","      if (m.transparent) M.alphaMode = 'BLEND'; else if (m.alphaTest > 0) { M.alphaMode = 'MASK'; M.alphaCutoff = m.alphaTest; }")
rep("    hideFaceHair();\n    if (hover.a) {","    hideFaceHair(); JM.syncDress();\n    if (hover.a) {")
# tweak
rep("window.EyewearStudio = window.GrugCatalog = { HD,","window.EyewearStudio = window.GrugCatalog = { J, JM, CL, isJ, genEyewear, kimiEye, HD,")

# ---- CSS
css = """
/* jewelry editor, brand */
.kimilogo{all:unset;box-sizing:border-box;cursor:pointer;background:none;display:grid;place-items:center;z-index:3;filter:drop-shadow(0 1px 3px rgba(0,0,0,.25))}
.kimilogo img{height:3rem;width:auto;display:block}.kimilogo:hover{transform:scale(1.06)}
.ccard .ct .kimilogo.tag{position:absolute;right:.45rem;top:.45rem}
#itemView .kimilogo{position:absolute;right:1rem;top:1rem}#itemView .kimilogo img{height:4.4rem}
.kimitoast{position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 2rem);padding:.7rem .9rem;border-radius:1rem;background:#1f1a17;color:#fff;font:600 .9rem/1.3 var(--g-font);box-shadow:0 8px 30px rgba(0,0,0,.35)}
.kimitoast img{height:1.8rem;background:#fff;border-radius:.4rem;padding:.15rem .3rem}
#itByRow{display:flex;align-items:center;gap:.4rem;min-height:2.6rem}
#itByRow .blogo-k{height:2.4rem;width:auto}
#itByRow .blogo-g{height:1.15rem;width:auto}
.ccard .cb{display:flex;align-items:center;gap:.3rem;min-height:2rem;margin:.15rem 0}
.ccard .cb .blogo-k{height:1.9rem;width:auto}
.ccard .cb .blogo-g{height:.9rem;width:auto}
.ccard .cb .verified{flex:none}
#catMore{visibility:hidden}
/* the closet: Roblox-style avatar editor + catalog. Landscape: panel left, her stage right. Portrait: stage on top, the panel a sheet */
#closet{position:fixed;inset:0;overflow:hidden;background:var(--g-bg);--panel-w:clamp(22rem,58vw,calc(100vw - 20rem));--sheet-top:52vh}
#closet .cl-stage{position:absolute;top:0;bottom:0;right:0;left:var(--panel-w);background:#7fc9e6 url(../../assets/closet/stage-bg.jpg) center/cover no-repeat;overflow:hidden}
#closet .cl-stage>canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block;touch-action:none;cursor:grab}
#closet .cl-stage>canvas:active{cursor:grabbing}
#closet .cl-panel{position:absolute;top:0;bottom:0;left:0;width:var(--panel-w);display:flex;flex-direction:column;background:var(--g-surface);padding-top:3.6rem;box-shadow:1px 0 0 var(--g-line);z-index:2}
#closet .cl-mode{position:absolute;top:.65rem;left:calc(var(--panel-w) / 2);transform:translateX(-50%);z-index:6;box-shadow:var(--g-sh-1);background:var(--g-surface)}
#closet .cl-mode button{white-space:nowrap}
#closet .cl-mode{display:flex;flex-wrap:nowrap;width:max-content;gap:.15rem}
/* the site's dock (avatar/): room under the lists so nothing hides behind it */
body.g-chrome #closet .cl-body,body.g-chrome #closet .cl-detail{padding-bottom:6.5rem}
#closet .cl-grip{display:none}
#closet .cl-tabrow{display:flex;align-items:center;gap:.6rem;padding:0 1rem;border-bottom:1px solid var(--g-line)}
#closet .cl-tabs,#closet .cl-subs{display:flex;gap:.15rem;overflow-x:auto;overflow-y:hidden;flex:1;min-width:0;scroll-behavior:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
#closet .cl-tabs::-webkit-scrollbar,#closet .cl-subs::-webkit-scrollbar{height:5px}
#closet .cl-tabs::-webkit-scrollbar-thumb,#closet .cl-subs::-webkit-scrollbar-thumb{border:0;min-height:0;background:color-mix(in srgb,var(--g-accent) 70%,transparent)}
#closet .cl-hs{position:relative;display:flex;flex:1;min-width:0}
#closet .cl-hs:has(> .cl-subs){flex:none}
#closet .cl-hs:has(> .cl-subs[hidden]){display:none}
#closet .cl-hsb{all:unset;box-sizing:border-box;position:absolute;top:0;bottom:5px;width:2.4rem;display:none;align-items:center;cursor:pointer;color:var(--g-text);z-index:2}
#closet .cl-hsb.l{left:0;justify-content:flex-start;padding-left:.15rem;background:linear-gradient(90deg,var(--g-surface) 55%,transparent)}
#closet .cl-hsb.r{right:0;justify-content:flex-end;padding-right:.15rem;background:linear-gradient(270deg,var(--g-surface) 55%,transparent)}
#closet .cl-hs:has(> .cl-subs) .cl-hsb.l{background:linear-gradient(90deg,var(--g-bg) 55%,transparent)}
#closet .cl-hs:has(> .cl-subs) .cl-hsb.r{background:linear-gradient(270deg,var(--g-bg) 55%,transparent)}
#closet .cl-hsb svg{width:1.6rem;height:1.6rem;padding:.3rem;border-radius:50%;background:var(--g-surface);box-shadow:var(--g-sh-1)}
#closet .cl-hsb:hover svg{background:var(--g-accent);color:var(--g-ink)}
#closet .cl-hs.can-l .cl-hsb.l,#closet .cl-hs.can-r .cl-hsb.r{display:flex}
#closet .cl-tabs button{all:unset;box-sizing:border-box;padding:.8rem .7rem .7rem;font:700 var(--g-fs-md)/1 var(--g-font);color:var(--g-muted);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}
#closet .cl-tabs button:hover{color:var(--g-text)}
#closet .cl-tabs button.on{color:var(--g-text);border-bottom-color:var(--g-text)}
#closet .cl-subs{flex:1;padding:0 1rem;background:var(--g-bg)}
#closet .cl-hs:has(> .cl-subs){background:var(--g-bg)}
#closet .cl-subs[hidden]{display:none}
#closet .cl-subs button{all:unset;box-sizing:border-box;padding:.65rem .7rem;font:600 var(--g-fs-sm)/1 var(--g-font);color:var(--g-muted);cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
#closet .cl-subs button:hover{color:var(--g-text)}
#closet .cl-subs button.on{color:var(--g-text);border-bottom-color:var(--g-text-2)}
#closet .cl-tools{display:flex;align-items:center;gap:.4rem;flex:none}
#closet .cl-tools[hidden]{display:none}
#closet .cl-search{display:flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:var(--g-r-pill);background:var(--g-bg);color:var(--g-muted);width:9.5rem}
#closet .cl-search input{all:unset;min-width:0;flex:1;font:500 var(--g-fs-sm)/1.2 var(--g-font);color:var(--g-text)}
#closet .cl-round{all:unset;box-sizing:border-box;width:2.7rem;height:2.7rem;border-radius:50%;background:var(--g-surface);display:grid;place-items:center;box-shadow:var(--g-sh-1);cursor:pointer;color:var(--g-text);font-size:1.15rem}
#closet .cl-round.sm{width:2.2rem;height:2.2rem;box-shadow:none;background:var(--g-bg);font-size:1rem}
#closet .cl-round.on{background:var(--g-accent);color:var(--g-ink)}
#closet .cl-round:disabled{color:var(--g-faint);cursor:default}
#closet .cl-round .tile{width:1.7rem;height:1.7rem;display:block;line-height:0;padding:0;margin:0;border:0;background:none;box-shadow:none}
#closet .cl-round .tile svg{width:1.7rem;height:1.7rem;display:block;margin:0;padding:0;border-radius:0;gap:0}   /* the site's .g-logo (grug.css) pads its pill: not here */
/* the panel's edge: drag it wider or narrower (landscape) */
#closet .cl-resize{position:absolute;top:0;bottom:0;left:var(--panel-w);width:14px;transform:translateX(-50%);z-index:5;cursor:ew-resize;touch-action:none}
#closet .cl-resize::after{content:'';position:absolute;left:50%;top:50%;width:6px;height:3.4rem;border-radius:9px;transform:translate(-50%,-50%);background:var(--g-surface);box-shadow:0 0 0 1px var(--g-line),var(--g-sh-1);opacity:.85;transition:opacity var(--g-dur-1),height var(--g-dur-1)}
#closet .cl-resize:hover::after,#closet .cl-resize:focus-visible::after,#closet.resizing .cl-resize::after{opacity:1;height:5rem;background:var(--g-accent)}
#closet.resizing{cursor:ew-resize;user-select:none}
#closet.resizing .cl-stage>canvas{pointer-events:none}
/* Equip: big, Grug lime, a tick and a little sparkle, so it reads without reading */
#closet .cl-equip{all:unset;box-sizing:border-box;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:.7rem;width:100%;min-height:5.2rem;padding:.9rem 1.4rem;border-radius:1.3rem;background:#9BE338;color:#1E1B16;font:700 1.55rem/1 var(--g-font);letter-spacing:.01em;cursor:pointer;box-shadow:0 5px 0 #5f9e1a;transition:transform .12s var(--g-ease),box-shadow .12s var(--g-ease),filter .12s;margin:.3rem 0 .5rem}
#closet .cl-equip:hover{filter:brightness(1.05)}
#closet .cl-equip:active{transform:translateY(4px);box-shadow:0 1px 0 #5f9e1a}
#closet .cl-equip:focus-visible{outline:3px solid var(--g-text);outline-offset:3px}
#closet .cl-equip .ic{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;background:#1E1B16;color:#9BE338;font-size:1.35rem;flex:none}
#closet .cl-equip .ic svg{width:1.4rem;height:1.4rem}
#closet .cl-equip::after{content:'';position:absolute;top:-20%;bottom:-20%;left:-40%;width:32%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-18deg);animation:clShine 2.8s ease-in-out infinite;pointer-events:none}
#closet .cl-equip .spk{position:absolute;color:#fff;font-size:.9rem;pointer-events:none;animation:clTwinkle 1.8s ease-in-out infinite;opacity:0}
#closet .cl-equip .spk svg{width:1em;height:1em;display:block;filter:drop-shadow(0 0 3px rgba(255,255,255,.9))}
#closet .cl-equip .s1{top:14%;left:9%;font-size:1.05rem}
#closet .cl-equip .s2{top:20%;right:11%;animation-delay:.6s}
#closet .cl-equip .s3{bottom:16%;right:24%;font-size:.75rem;animation-delay:1.2s}
@keyframes clShine{0%,55%{left:-40%}100%{left:130%}}
@keyframes clTwinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
#closet .cl-equip.is-on{background:var(--g-bg);color:var(--g-text);box-shadow:0 0 0 2px #9BE338 inset,0 5px 0 color-mix(in srgb,#9BE338 60%,var(--g-line))}
#closet .cl-equip.is-on .ic{background:var(--g-text-2);color:var(--g-surface)}
#closet .cl-equip.is-on::after{display:none}
@media (prefers-reduced-motion:reduce){#closet .cl-equip::after,#closet .cl-equip .spk{animation:none}#closet .cl-equip .spk{opacity:.8}}
#closet .cl-quick{display:flex;flex-direction:column;gap:.45rem;margin-bottom:.4rem}
#closet .cl-quickh{display:flex;align-items:baseline;gap:.6rem}
#closet .cl-quick .cl-sws{gap:.4rem}
#closet .cl-quick .cl-sw,#closet .cl-quick .cl-pickw{width:2.1rem;height:2.1rem}
/* a hat's pose: Position / Rotation / Size, and X, Y, Z sliders, over the top of her stage */
#closet .cl-pose{position:absolute;top:.9rem;left:4.6rem;right:.9rem;margin:0 auto;max-width:24rem;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .7rem;padding:.6rem .8rem;border-radius:1.1rem;background:color-mix(in srgb,var(--g-surface) 92%,transparent);box-shadow:var(--g-sh-1);backdrop-filter:blur(6px)}
#closet .cl-pose[hidden]{display:none}
#closet .cl-posemode{display:flex;flex-wrap:nowrap;gap:.15rem}
#closet .cl-posemode button{white-space:nowrap}
#closet .cl-posesl{display:flex;flex-direction:column;gap:.15rem;flex:1 1 100%;order:3}
#closet .cl-posereset{order:2;margin-left:auto}
#closet .cl-posemode{order:1}
#closet .cl-posel{display:grid;grid-template-columns:1.1rem 1fr 3.2rem;align-items:center;gap:.5rem;font:700 var(--g-fs-sm)/1 var(--g-font)}
#closet .cl-posel .val{font:600 var(--g-fs-xs)/1 var(--g-font);color:var(--g-muted);text-align:right;font-variant-numeric:tabular-nums}
#closet .cl-guess{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;padding:.75rem 1rem;margin:0 0 .9rem;border-radius:var(--g-r-lg);background:color-mix(in srgb,#9BE338 22%,var(--g-bg));font:500 var(--g-fs-sm)/1.35 var(--g-font);color:var(--g-text-2)}
#closet .cl-guess b{color:var(--g-text)}
#closet .cl-guess>span{flex:1;min-width:0}
#closet .cl-guess>svg{flex:none}
#closet .cl-stagebar{position:absolute;left:.9rem;top:.9rem;display:flex;flex-direction:column;align-items:flex-start;gap:.55rem;z-index:5}
#closet .cl-pillbox{display:flex;flex-direction:column;border-radius:var(--g-r-pill);background:var(--g-surface);box-shadow:var(--g-sh-1)}
#closet .cl-pillbox .cl-round{box-shadow:none;background:none}
#closet .cl-menuwrap{position:relative}
#closet .cl-menu{left:0;right:auto;min-width:14rem}
#closet .cl-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8rem;font:600 var(--g-fs-sm)/1.2 var(--g-font);color:var(--g-muted);background:#e8e9ee;z-index:4}
#closet .cl-loading.gone{display:none}
#closet .cl-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:1rem 1.1rem 2rem}
#closet .cl-count{font:600 var(--g-fs-xs)/1 var(--g-font);color:var(--g-muted);margin:0 0 .7rem}
#closet .cl-grid{grid-template-columns:repeat(auto-fill,minmax(8.4rem,1fr));gap:1.1rem .8rem}
#closet .cl-more{height:1px}
#closet .ccard.wearing .ct{box-shadow:0 0 0 3px var(--g-text)}
#closet .ccard .ct .tag.own,#closet .ccard .ct .wtag{position:absolute;left:.45rem;bottom:.45rem;top:auto;right:auto}
#closet .ccard:not(.wearing) .ct .wtag{background:rgba(255,255,255,.85);color:var(--g-ink)}
#closet .ccard .cl-rm{all:unset;box-sizing:border-box;position:absolute;right:.4rem;top:.4rem;width:1.9rem;height:1.9rem;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.85);color:var(--g-text-2);cursor:pointer;opacity:0;transition:opacity var(--g-dur-1)}
#closet .ccard:hover .cl-rm,#closet .ccard .cl-rm:focus-visible{opacity:1}
@media (hover:none){#closet .ccard .cl-rm{opacity:1}}
#closet .cl-empty{grid-column:1/-1;display:flex;flex-direction:column;align-items:flex-start;gap:.6rem;padding:1.4rem;border-radius:var(--g-r-lg);background:var(--g-bg)}
#closet .cl-empty span{color:var(--g-text-2)}
#closet .cl-filters{padding:.8rem 1.1rem 1rem;border-bottom:1px solid var(--g-line);max-height:42vh;overflow:auto;display:flex;flex-direction:column;gap:1rem;background:var(--g-surface)}
#closet .cl-filters[hidden]{display:none}
#closet .cl-sortrow{display:flex;align-items:center;gap:.6rem}
#closet .cl-sortrow select{max-width:14rem}
#closet .cl-filters .refine{display:flex;flex-direction:column;gap:.9rem}
#closet .cl-filters .refine .g-label{color:var(--g-muted);margin:0 0 .4rem}
#closet .cl-filters nav{display:flex;flex-wrap:wrap;gap:.3rem}
#closet .cl-filters nav button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:.4rem;padding:.4rem .7rem;border-radius:var(--g-r-pill);background:var(--g-bg);font:600 var(--g-fs-xs)/1.2 var(--g-font);color:var(--g-text-2);cursor:pointer}
#closet .cl-filters nav button.on{background:var(--g-accent);color:var(--g-ink)}
#closet .cl-filters nav button .n{color:var(--g-faint);font-variant-numeric:tabular-nums}
#closet .cl-filters nav button.on .n{color:rgba(31,26,23,.6)}
#closet .cl-filters nav button .dot{display:none}
#closet .cl-filters .swgrid{grid-template-columns:repeat(auto-fill,1.9rem);padding:0}
#closet .cl-ihead{display:flex;align-items:center;gap:.8rem;margin-bottom:.9rem;flex-wrap:wrap}
#closet .cl-ihead .crumbs{font:600 var(--g-fs-sm)/1.2 var(--g-font);color:var(--g-muted);display:flex;gap:.4rem;align-items:center}
#closet .cl-iwrap{display:grid;grid-template-columns:minmax(9rem,15rem) minmax(0,1fr);gap:1.2rem;align-items:start}
#closet .cl-ipic{position:relative;aspect-ratio:1;border-radius:var(--g-r-lg);background:var(--g-surface-3) center/88% no-repeat}
#closet .cl-iinfo{display:flex;flex-direction:column;gap:.55rem;min-width:0}
#closet .cl-iinfo h2{margin:0}
#closet .cl-by{display:flex;align-items:center;gap:.35rem;min-height:2rem;font-size:var(--g-fs-sm)}
#closet .cl-by .blogo-k{height:2rem;width:auto}#closet .cl-by .blogo-g{height:1rem;width:auto}
#closet .cl-price{font:700 var(--g-fs-lg)/1 var(--g-font)}
#closet .cl-acts,#closet .cl-acts2{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
#closet .cl-acts2 .rollbtn{position:relative}
#closet .cl-acts2 .fmtmenu{left:0;right:auto;min-width:15rem}
#closet .favbtn.on{background:var(--g-yellow);color:var(--g-ink)}
#closet .cl-desc{margin:1.1rem 0 .7rem;color:var(--g-text-2);line-height:1.45}
#closet .cl-like-h{margin:1.4rem 0 .8rem}
#closet .cl-grp{display:flex;flex-direction:column;gap:.65rem;margin-bottom:1.4rem;max-width:34rem}
#closet .cl-note{font-size:var(--g-fs-sm);color:var(--g-muted)}
#closet .cl-sws{display:flex;flex-wrap:wrap;gap:.55rem;align-items:center}
#closet .cl-sw{all:unset;box-sizing:border-box;width:2.5rem;height:2.5rem;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
#closet .cl-sw.on{box-shadow:0 0 0 3px var(--g-surface),0 0 0 5px var(--g-text)}
#closet .cl-pick{width:2.5rem;height:2.5rem;border:0;padding:0;background:none;cursor:pointer}
#closet .cl-chips{display:flex;flex-wrap:wrap;gap:.4rem}
#closet .cl-chips button{all:unset;box-sizing:border-box;padding:.55em 1em;border-radius:var(--g-r-pill);background:var(--g-bg);font:600 var(--g-fs-sm)/1.2 var(--g-font);color:var(--g-text-2);cursor:pointer}
#closet .cl-chips button:hover{color:var(--g-text)}
#closet .cl-chips button.on{background:var(--g-accent);color:var(--g-ink)}
#closet .cl-sl{display:grid;grid-template-columns:1fr auto;gap:.15rem .6rem;font:600 var(--g-fs-sm)/1.2 var(--g-font)}
#closet .cl-sl .val{color:var(--g-muted);font-variant-numeric:tabular-nums}
#closet .cl-sl input{grid-column:1/-1}
@media (max-aspect-ratio: 1/1){
  #closet .cl-stage{left:0;right:0;bottom:auto;height:var(--sheet-top);transition:height .25s var(--g-ease)}
  #closet[data-sheet="full"]{--sheet-top:4.2rem}
  #closet .cl-panel{left:0;right:0;width:auto;top:var(--sheet-top);padding-top:0;border-radius:1.1rem 1.1rem 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.08);transition:top .25s var(--g-ease)}
  #closet.dragging .cl-stage,#closet.dragging .cl-panel{transition:none}
  #closet .cl-grip{display:block;flex:none;height:1.3rem;cursor:grab;touch-action:none;position:relative}
  #closet .cl-grip::after{content:'';position:absolute;left:50%;top:.5rem;width:2.4rem;height:.28rem;border-radius:9px;background:var(--g-line);transform:translateX(-50%)}
  #closet .cl-mode{left:50%}
  #closet[data-sheet="full"] .cl-stagebar{display:none}
  #closet .cl-search{width:7rem}
  #closet .cl-resize{display:none}
}
@media (max-width: 640px){
  /* phones: the search gets its own row under the tabs (it was squeezed to nothing) */
  #closet .cl-tabrow{flex-wrap:wrap;row-gap:0}
  #closet .cl-tools{order:2;flex:1 1 100%;padding:.1rem 0 .55rem}
  #closet .cl-search{flex:1;width:auto}
  #closet[data-sheet="full"] .cl-pose{display:none}
  #closet .cl-pose{left:4.2rem;right:.6rem;top:3.9rem;padding:.45rem .6rem}
  #closet .cl-equip{min-height:4.4rem;font-size:1.35rem}
  #closet .cl-iwrap{grid-template-columns:7.5rem minmax(0,1fr);gap:.9rem}
  #closet .cl-grid{grid-template-columns:repeat(auto-fill,minmax(7.2rem,1fr))}
}
@media (max-width:520px){#closet .cl-tools .cl-search{display:flex}}   /* phones keep the search (its own row: see the 640px rule) */
/* an opened piece fills the bottom half of the panel; the feed keeps scrolling above it */
#closet .cl-detail{flex:0 0 auto;height:min(54%,36rem);min-height:15rem;overflow-y:auto;overflow-x:hidden;padding:.75rem 1.1rem 1.6rem;border-top:1px solid var(--g-line);background:var(--g-surface);box-shadow:0 -10px 26px rgba(0,0,0,.08);border-radius:1rem 1rem 0 0;position:relative;z-index:2;animation:clUp .22s var(--g-ease)}
#closet .cl-detail[hidden]{display:none}
@keyframes clUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
#closet .cl-detail .cl-ihead{justify-content:space-between;margin-bottom:.6rem}
#closet .cl-detail .cl-iwrap{grid-template-columns:minmax(7rem,11rem) minmax(0,1fr);gap:1rem}
#closet .cl-detail .chips{margin-top:.8rem}
#closet .cl-detail .cl-desc{margin:.7rem 0 .6rem}
#closet .ccard.viewing .ct{box-shadow:0 0 0 3px var(--g-accent)}
#closet .cl-round.cl-x{flex:none}
/* colour rows: swatches, an "original" chip and a picker for any colour */
#closet .cl-sws{gap:.45rem}
#closet .cl-sw{width:2.2rem;height:2.2rem}
#closet .cl-orig{width:auto;min-width:4.6rem;padding:0 .7rem;border-radius:var(--g-r-pill);display:inline-grid;place-items:center}
#closet .cl-orig span{font:700 var(--g-fs-xs)/1 var(--g-font);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)}
#closet .cl-pickw{position:relative;width:2.2rem;height:2.2rem;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:var(--g-text);background:conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#7c3aed,#f43f5e);box-shadow:inset 0 0 0 3px var(--g-surface)}
#closet .cl-pickw.on{box-shadow:inset 0 0 0 3px var(--g-surface),0 0 0 3px var(--g-surface),0 0 0 5px var(--g-text)}
#closet .cl-pickw .g-icon{width:1rem;height:1rem;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
#closet .cl-pickw input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:0;padding:0}
#closet .cl-looks{display:flex;flex-direction:column;gap:.8rem;margin-bottom:1.2rem}
#closet .cl-looks .cl-grp{margin-bottom:0}
#closet .cl-look{display:flex;flex-direction:column;gap:.55rem;padding:.8rem .9rem;border-radius:var(--g-r-lg);background:var(--g-bg);max-width:36rem}
#closet .cl-lookh{display:flex;align-items:baseline;gap:.6rem}
#closet .cl-lookh .g-label{margin:0;color:var(--g-muted)}
#closet .cl-look .patrow{display:flex;align-items:center;gap:.35rem}
#closet .cl-look .patrow .lb{flex:1;display:flex;flex-direction:column;font:600 var(--g-fs-sm)/1.2 var(--g-font)}
#closet .cl-look .patrow .lb small{color:var(--g-muted);font-weight:500}
#closet .cl-look .patpv{width:2.6rem;height:2.6rem;border-radius:.6rem;flex:none}
#closet .cl-look>.g-btn{align-self:flex-start}
/* her stage: the blurred picture behind her, a soft floor */
#closet .cl-stage::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,255,255,0) 55%,rgba(255,255,255,.18));pointer-events:none}
[data-g-theme=dark] #closet .cl-stage{filter:saturate(.9) brightness(.86)}
/* scrollbars: a thin rounded pill in the accent, on every scrolling part of the page */
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--g-accent) 55%,transparent);border-radius:99px;border:3px solid transparent;background-clip:padding-box;min-height:40px}
::-webkit-scrollbar-thumb:hover{background:var(--g-accent);background-clip:padding-box;border:2px solid transparent}
::-webkit-scrollbar-corner{background:transparent}
@supports not selector(::-webkit-scrollbar){*{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--g-accent) 60%,transparent) transparent}}

#editor[data-jm] #topright #bSpin{display:inline-grid}
#editor[data-jm] .quick{display:none}
.jel{border:1px solid var(--g-line,rgba(255,255,255,.12));border-radius:var(--g-r-md,12px);padding:.6rem;margin:.5rem 0;display:flex;flex-direction:column;gap:.35rem}
.jel .jtop{display:flex;align-items:center;gap:.4rem}
.jel .jpic{flex:none;width:2.4rem;height:2.4rem;border-radius:.6rem;background:rgba(255,255,255,.08) center/contain no-repeat;display:grid;place-items:center}
.jel .jpic b{width:1.2rem;height:1.2rem;border-radius:50%;display:block}
.jel .jtop select{flex:1;min-width:0}
.jel .jacts{display:flex;gap:.1rem}
.jgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin:.4rem 0}
.jgrid button{all:unset;box-sizing:border-box;text-align:center;padding:.5rem .3rem;border-radius:.6rem;background:rgba(255,255,255,.07);font:600 var(--g-fs-sm,.8rem)/1.1 var(--g-font);cursor:pointer}
.jgrid button:hover{background:rgba(255,255,255,.16)}.jgrid button:disabled{opacity:.35;cursor:not-allowed}
.jgrid.charms{grid-template-columns:repeat(5,1fr)}
.jgrid.charms button{padding:.2rem;aspect-ratio:1}
.jgrid.charms i{display:block;width:100%;height:100%;background:center/contain no-repeat}
.patrow{display:flex;align-items:center;gap:.35rem;margin:.35rem 0}
.patrow .patpv{width:2.6rem;height:2.6rem;border-radius:.5rem;flex:none;background:#fff}
.patrow .lb{flex:1;min-width:0;display:flex;flex-direction:column;font-weight:600}
.patrow .lb small{opacity:.6;font-weight:500}
"""
# clothing: the Modular Anime Character pieces (src/jewelry.js). Her old ruffled dress is gone; she wears the pack's tee and
# trousers by default, painted with the mannequin on card pictures
rep("    top: { part: 'mh_toigo_strapless_ruffle_top_dress', texture: 'mh_toigo_strapless_ruffle_top_dress', colour: '#ffffff' }, feet:", "    top: null, legs: null, feet:")
rep("  function paintBody(css) { bodyPaint = css || GREY; _c.set(bodyPaint).convertSRGBToLinear(); for (const m of bodyMats) m.color.copy(_c); }", "  function paintBody(css) { bodyPaint = css || GREY; _c.set(bodyPaint).convertSRGBToLinear(); for (const m of bodyMats) m.color.copy(_c); if (sandy.__wear && !paintBody.real) J.clothPaint(sandy, bodyPaint); }")
rep("</style>\n</head>", css+"</style>\n</head>") if s.count("</style>\n</head>")==1 else None
open(os.path.join(REPO,'labs','catalog','index.html'),'w').write(s)

# The closet is the site's Avatar section: the same page at avatar/ (one folder up from the assets, the Hair Studio in labs/)
av = s.replace("'../../assets/", "'../assets/").replace('"../../assets/', '"../assets/').replace('(../../assets/', '(../assets/')
av = av.replace("/\\/labs\\//.test(location.pathname)", "/\\/(labs|avatar)\\//.test(location.pathname)")
av = av.replace("const HAIR_STUDIO = /\\/(labs|avatar)\\//.test(location.pathname) ? '../hair-studio-x8f3k2/'", "const HAIR_STUDIO = /\\/avatar\\//.test(location.pathname) ? '../labs/hair-studio-x8f3k2/' : /\\/labs\\//.test(location.pathname) ? '../hair-studio-x8f3k2/'")
# the site's dock (Home, Games, Me, Make) under the closet: the site's styles first (the page's own win), then its scripts
av = av.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<link rel="stylesheet" href="../assets/grug.css">\n<script src="../assets/theme.js?v=av2"></script>', 1)
av = av.replace('</body>', '<script src="../assets/sandy-view.js?v=av2"></script>\n<script src="../assets/icons.js"></script>\n<script src="../assets/grug.js?v=av2"></script>\n<script>try { Grug.ui.chrome(\'avatar\', { dockOnly: true }); } catch (e) { console.warn(\'dock\', e); }</script>\n</body>', 1)
assert '../../' not in av, [m for m in __import__('re').findall(r".{30}\.\./\.\./.{30}", av)][:5]
open(os.path.join(REPO,'avatar','index.html'),'w').write(av)

# The closet runtime for games (sandy-runtime.js loads it for a player whose look has closet: true): the catalog's eyewear,
# hair, pattern and jewelry engines as they are on the page, then src/dress.js
import re as _re
blocks = {m.group(1): m.group(2) for m in _re.finditer(r'<script id="([\w-]+)">(.*?)</script>', s, _re.S)}
rt = ['/* Grug · closet-runtime.js: the player\'s closet avatar for games. BUILT FILE: tools/catalog/build.py from the catalog\'s',
      '   engines (eyewear, hair, patterns, jewelry and clothing) and tools/catalog/src/dress.js. Loaded by sandy-runtime.js. */',
      "window.GRUG_ASSETS = window.GRUG_ASSETS || ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');"]
for k in ['grug-eyewear', 'hair-textures', 'grug-hair', 'catalog-hair', 'grug-patterns', 'grug-jewelry']:
    rt.append(';\n/* ---- ' + k + ' */\n' + blocks[k])
rt.append(';\n' + open(os.path.join(HERE,'src','dress.js')).read())
open(os.path.join(REPO,'assets','closet-runtime.js'),'w').write('\n'.join(rt))
print('avatar/index.html', len(av), '· assets/closet-runtime.js', sum(map(len, rt)))
print('ok',len(s))
