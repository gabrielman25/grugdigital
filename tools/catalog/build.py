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

# ---- script
# the catalog wears the game kit's newest runtime (the new feet, Nov 2026), shipped next to it in labs/catalog/vendor/
rep("if (/\\/labs\\//.test(location.pathname)) RUNTIME.unshift(RUNTIME.splice(RUNTIME.indexOf('../../assets/sandy-runtime.js'), 1)[0]);","if (/\\/labs\\//.test(location.pathname)) RUNTIME.unshift(RUNTIME.splice(RUNTIME.indexOf('vendor/sandy-runtime.js'), 1)[0]);")
rep("const ON_SITE = !!(K && K.model === 'block');","const ON_SITE = !!(K && K.model === 'block'), ON_LABS = /\\/labs\\//.test(location.pathname);")
rep("renderer.setPixelRatio(ON_SITE ?","renderer.setPixelRatio(ON_SITE || ON_LABS ?")
# the mannequin's nails: no polish, the same grey as her skin (the new feet mark their nails per vertex and tint them)
rep("    hideFaceHair();\n  }\n  function hideFaceHair()","    { const NU = sandy.n3._nailU; if (NU) { NU.nailAmt.value = 0; } }\n    hideFaceHair();\n  }\n  function hideFaceHair()")
# ---- hair: flat-colour dyes (no hair texture, just colour; one colour, a fade, or a rainbow) and a few of them on every style
rep("  const DYES = {\n", """  const DYES = {
    flatpink: { name: 'Flat pink', plain: true, tex: 'white', tint: '#ff8fc2', sw: '#ff8fc2', tags: ['pink', 'flat colour', 'colourful'] },
    flatlilac: { name: 'Flat lilac', plain: true, tex: 'white', tint: '#b79cff', sw: '#b79cff', tags: ['purple', 'lavender', 'flat colour', 'pastel', 'colourful'] },
    flatmint: { name: 'Flat mint', plain: true, tex: 'white', tint: '#7fe0b4', sw: '#7fe0b4', tags: ['green', 'mint', 'flat colour', 'pastel', 'colourful'] },
    flatsky: { name: 'Flat sky', plain: true, tex: 'white', tint: '#7cc4ff', sw: '#7cc4ff', tags: ['blue', 'flat colour', 'colourful'] },
    flatred: { name: 'Flat red', plain: true, tex: 'white', tint: '#e2383f', sw: '#e2383f', tags: ['red', 'flat colour', 'colourful'] },
    flatblack: { name: 'Flat black', plain: true, tex: 'white', tint: '#26262c', sw: '#26262c', tags: ['black', 'flat colour', 'dark'] },
    flatwhite: { name: 'Flat white', plain: true, tex: 'white', tint: '#f4f2f0', sw: '#f4f2f0', tags: ['white', 'flat colour', 'light'] },
    flatlemon: { name: 'Flat lemon', plain: true, tex: 'white', tint: '#ffe066', sw: '#ffe066', tags: ['yellow', 'blonde', 'flat colour', 'colourful'] },
    flatsunset: { name: 'Flat sunset', plain: true, tex: 'white', tint: '#ff9a3c', tip: '#ff4f9a', tipMix: 1, tipStart: 0.3, sw: 'linear-gradient(#ff9a3c,#ff4f9a)', tags: ['orange', 'pink', 'ombre', 'two tone', 'flat colour', 'colourful'] },
    flatcandy: { name: 'Flat cotton candy', plain: true, tex: 'white', tint: '#ff9dcf', tip: '#8ccfff', tipMix: 1, tipStart: 0.3, sw: 'linear-gradient(#ff9dcf,#8ccfff)', tags: ['pink', 'blue', 'ombre', 'pastel', 'two tone', 'flat colour', 'colourful'] },
    flatocean: { name: 'Flat ocean', plain: true, tex: 'white', tint: '#2b62d9', tip: '#4fd8e0', tipMix: 1, tipStart: 0.35, sw: 'linear-gradient(#2b62d9,#4fd8e0)', tags: ['blue', 'teal', 'ombre', 'two tone', 'flat colour', 'colourful'] },
    flatrainbow: { name: 'Flat rainbow', plain: true, tex: 'white', rainbow: 0.95, sw: 'conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#7c3aed,#f43f5e)', tags: ['rainbow', 'flat colour', 'colourful', 'multicolour'] },
""")
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
rep("const deptOf = it => (it && it.dept) || 'eyewear';","const deptOf = it => (it && it.dept) || 'eyewear';\n  const isJ = it => !!it && (it.dept === 'earrings' || it.dept === 'necklaces' || it.dept === 'purses' || it.dept === 'sandals');")
rep("  /* ---------------------------------------------------------------- routing */\n  let toldControls","  await J.ready(); J.init({ sandy, hm, env: envTex });\n"+integ+"\n  /* ---------------------------------------------------------------- routing */\n  let toldControls")

# ---- camera centre
rep("const headCentre = () => headGroup.localToWorld(new THREE.Vector3(0, hm.eyeY + 2.5, 1));","const headCentre = () => JM.on ? JM.centre() : headGroup.localToWorld(new THREE.Vector3(0, hm.eyeY + 2.5, 1));")

# ---- card colours (KIMILAND soft blue card, lilac mannequin)
rep("const cardColour = it => `hsl(${Math.round(cardHue(it))} 78% 72%)`;","const cardColour = it => it.brand === 'kimiland' ? KIMI_CARD : `hsl(${Math.round(cardHue(it))} 78% 72%)`;")
rep("const mannequinColour = it => `hsl(${Math.round((cardHue(it) + 120) % 360)}, 62%, 80%)`;","const mannequinColour = it => it.brand === 'kimiland' ? KIMI_MANN : `hsl(${Math.round((cardHue(it) + 120) % 360)}, 62%, 80%)`;")
rep("    if (deptOf(it) === 'hair') { const [h, s] = GE.util.hsl(it.hex);","    if (isJ(it)) { const e = (it.d.seq || it.d.items || it.d.charms)[0] || { col: it.d.body || it.d.strapCol }; return ((GE.util.hsl(e.col)[1] > 0.2 ? GE.util.hsl(e.col)[0] : GE.util.hash(it.id) % 360) + 180) % 360; }\n    if (deptOf(it) === 'hair') { const [h, s] = GE.util.hsl(it.hex);")

# ---- thumbs job
rep("url = hair ? await thumbHair(j.it, mannequinColour(j.it)) : j.mode === 'worn'","url = isJ(j.it) ? thumbJewel(j.it, mannequinColour(j.it)) : hair ? await thumbHair(j.it, mannequinColour(j.it)) : j.mode === 'worn'")

# ---- data: generated, itemById, mine, fav
rep("""    const d = GE.random(seed), it = { id: 'g:' + seed, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: i, stamp: 0, gen: true };
    genCache.set(seed, it); return it;""","""    const kg = genEyewear(seed), d = kg.d, it = { id: 'g:' + seed, seed, d, name: kg.name, kind: GE.classify(d), by: brandBy(kg.brand), brand: kg.brand, order: i, stamp: 0, gen: true };
    genCache.set(seed, it); return it;""")
rep("""const d = GE.random(seed); const it = { id, seed, d, name: GE.nameFor(d, seed), kind: GE.classify(d), by: 'Grug Digital', order: 0, stamp: 0, gen: true }; genCache.set(seed, it); return it; }""","""const kg = genEyewear(seed), d = kg.d; const it = { id, seed, d, name: kg.name, kind: GE.classify(d), by: brandBy(kg.brand), brand: kg.brand, order: 0, stamp: 0, gen: true }; genCache.set(seed, it); return it; }""")
rep("  function itemById(id) {\n","  function itemById(id) {\n    if (/^g[enps]:/.test(id)) return JM.byId(id);\n")
rep("function mineItems() { return mine().map((m, i) => ({ id: 'm:' + m.id, seed: m.seed || m.id, d: GE.validate(m.d).d, name: m.name, kind: GE.classify(GE.validate(m.d).d), by: 'You', order: -1000 + i, stamp: m.when || 0, mine: true, saved: m })); }",
    "function mineItems() { return mine().map((m, i) => m.dept ? JM.fromMine(m, i) : ({ id: 'm:' + m.id, seed: m.seed || m.id, d: GE.validate(m.d).d, name: m.name, kind: GE.classify(GE.validate(m.d).d), by: 'You', brand: m.brand || 'grug', order: -1000 + i, stamp: m.when || 0, mine: true, saved: m })); }")
rep("{ id: it.id, seed: it.seed, name: it.name, d: it.d, by: it.by, when: Date.now() });","{ id: it.id, seed: it.seed, name: it.name, d: it.d, by: it.by, dept: isJ(it) ? it.dept : undefined, brand: it.brand, when: Date.now() });")
rep("    const d = GE.validate(f.d).d; return { id: f.id, seed: f.seed, d, name: f.name, kind: GE.classify(d), by: f.by || 'Grug Digital',","    if (f.dept === 'earrings' || f.dept === 'necklaces' || f.dept === 'purses' || f.dept === 'sandals') return JM.fromFav(f);\n    const d = GE.validate(f.d).d; return { id: f.id, seed: f.seed, d, name: f.name, kind: GE.classify(d), brand: f.brand || 'grug', by: f.by || 'Grug Digital',")
rep("    if (deptOf(it) === 'hair') f = HD.families(it);\n","    if (isJ(it)) f = JM.families(it);\n    else if (deptOf(it) === 'hair') f = HD.families(it);\n")

# ---- catalog departments and filters
rep("const REFINE_KEYS = ['worn', 'lens', 'logo', 'texture', 'vibe'];","const REFINE_KEYS = ['worn', 'lens', 'logo', 'texture', 'vibe', 'theme', 'cord', 'mount', 'pattern'];")
rep("lens: 'any', logo: 'any', texture: 'any', vibe: 'any', colour: 'any',","lens: 'any', logo: 'any', texture: 'any', vibe: 'any', theme: 'any', cord: 'any', mount: 'any', pattern: 'any', brand: 'any', colour: 'any',")
rep("['hair', 'Hair', 'hair', 'var(--g-pink)'], ['favs'","['hair', 'Hair', 'hair', 'var(--g-pink)'], ['earrings', 'Earrings', 'diamond', 'var(--g-purple)'], ['necklaces', 'Necklaces', 'flower', 'var(--g-orange)'], ['purses', 'Purses', 'shopping_bag', 'var(--g-pink)'], ['sandals', 'Sandals', 'sun', 'var(--g-blue)'], ['favs'")
rep("const SUBS = { eyewear: [['glasses', 'Glasses'], ['shades', 'Shades'], ['goggles', 'Goggles']], hair: HD ? HD.SUB : [] };","const SUBS = { eyewear: [['glasses', 'Glasses'], ['shades', 'Shades'], ['goggles', 'Goggles']], hair: HD ? HD.SUB : [], earrings: [['studs', 'Studs'], ['drops', 'Drops'], ['danglers', 'Danglers'], ['hoops', 'Hoops']], necklaces: [['choker', 'Chokers'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']], sandals: [['slide', 'Slides'], ['thong', 'Thongs'], ['ankle', 'Ankle straps'], ['gladiator', 'Gladiators'], ['wrap', 'Wraps'], ['slipper', 'Slippers']], purses: [['satchel', 'Satchels'], ['tote', 'Totes'], ['bucket', 'Buckets'], ['round', 'Rounds'], ['heart', 'Hearts'], ['clutch', 'Clutches']] };")
rep("  const REFINE = {\n","""  const F_THEME = [['any', 'Any theme', 'sparkle_dummy'], ['Christmas', 'Christmas', null], ['Halloween', 'Halloween', null], ["Valentine's Day", "Valentine's Day", null], ['Shapes', 'Plain shapes', null]];
  const F_BRAND = [['any', 'Any brand'], ['grug', 'Grug Digital'], ['kimiland', 'KIMILAND'], ['players', 'Made by players']];
  const REFINE = {
    earrings: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['mount', 'Mount', [['any', 'Any mount', null], ['Stud', 'Studs', null], ['Hook', 'Hooks', null]]]],
    necklaces: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['cord', 'Cord', [['any', 'Any cord', null], ['Chain', 'Chain', null], ['Cord', 'Cord', null], ['Ribbon', 'Ribbon', null], ['Beads', 'Beads', null], ['Pearls', 'Pearls', null]]]],
    sandals: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['mount', 'Sole', [['any', 'Any sole', null], ['Flat', 'Flat', null], ['Platform', 'Platform', null], ['Wedge', 'Wedge', null], ['Block', 'Block heel', null]]], ['pattern', 'Colour', [['any', 'Any colour style', null], ['Solid', 'Solid colour', null], ['Gradient', 'Gradient', null], ['Patterned', 'Patterned', null]]]],
    purses: [['theme', 'Theme', F_THEME.map(x => [x[0], x[1], null])], ['cord', 'Strap', [['any', 'Any strap', null], ['Chain', 'Chain', null], ['Strap', 'Strap', null], ['Wide strap', 'Wide strap', null], ['Cord', 'Cord', null], ['Beads', 'Beads', null], ['Pearls', 'Pearls', null]]], ['pattern', 'Pattern', [['any', 'Any pattern', null], ['Gingham', 'Gingham', null], ['Stripes', 'Stripes', null], ['Polka dots', 'Polka dots', null], ['Quilted', 'Quilted', null], ['Checks', 'Checks', null], ['Print', 'Prints', null]]]],
""")
# passes
rep("    if (f.dept === 'eyewear' || f.dept === 'hair') {\n      if (dp !== f.dept) return false;\n      if (f.sub !== 'all') { if (dp === 'eyewear' ? it.kind !== f.sub : !(it.length === f.sub || it.tags.includes(f.sub))) return false; }\n    }",
    "    if (f.brand !== 'any' && (it.brand || 'grug') !== f.brand) return false;\n    if (f.dept === 'eyewear' || f.dept === 'hair' || f.dept === 'earrings' || f.dept === 'necklaces' || f.dept === 'purses' || f.dept === 'sandals') {\n      if (dp !== f.dept) return false;\n      if (f.sub !== 'all') { if (dp === 'eyewear' || isJ(it) ? it.kind !== f.sub : !(it.length === f.sub || it.tags.includes(f.sub))) return false; }\n    }")
rep("    } else if (dp === 'hair') {\n      if (f.texture","    } else if (isJ(it)) {\n      const tg = J.tagsFor(dp, it.d); if (f.theme !== 'any' && !tg.includes(f.theme)) return false; if (f.cord !== 'any' && !tg.includes(f.cord)) return false; if (f.mount !== 'any' && !tg.includes(f.mount)) return false; if (f.pattern !== 'any' && !tg.includes(f.pattern)) return false;\n    } else if (dp === 'hair') {\n      if (f.texture")
rep("it._q || (it._q = (deptOf(it) === 'hair' ? [it.name,","it._q || (it._q = (isJ(it) ? JM.text(it) : deptOf(it) === 'hair' ? [it.name,")
rep(".join(' ').toLowerCase().replace(/colour/g, 'color')",".join(' ').concat(it.brand === 'kimiland' ? ' kimiland pastel' : it.brand === 'players' ? ' ' + it.by + ' player' : ' grug digital').toLowerCase().replace(/colour/g, 'color')")
# allItems
rep("    out.push(...hairItems());\n","    out.push(...hairItems());\n    for (let i = 0; i < cat.count; i++) { const a = JM.gen('earrings', catSeed + '-' + i), b = JM.gen('necklaces', catSeed + '-' + i), c = JM.gen('purses', catSeed + '-' + i), e2 = JM.gen('sandals', catSeed + '-' + i); a.order = i * 5 + 1.3; b.order = i * 5 + 2.3; c.order = i * 5 + 3.3; e2.order = i * 5 + 4.3; out.push(a, b, c, e2); }\n")
# brand group in filters (after refine, before colour)
rep("    const g = el('div', '', '<div class=\"g-label\">Colour</div>'), grid = el('div', 'swgrid');","""    { const g = el('div', '', '<div class="g-label">Brand</div>'), nav = el('nav'); g.append(nav); rb.append(g);
      for (const [v, l] of F_BRAND) { const n = count({ brand: v }); if (!n && v !== 'any' && cat.brand !== v) continue; btn(nav, l, null, null, n, cat.brand === v, 'plain', () => { cat.brand = v; renderCatalog(); }); } }
    const g = el('div', '', '<div class="g-label">Colour</div>'), grid = el('div', 'swgrid');""")
rep("const RESET = () => Object.fromEntries(REFINE_KEYS.map(k => [k, 'any']));","const RESET = () => Object.fromEntries(REFINE_KEYS.map(k => [k, 'any']));")
rep("$('#catMore').parentElement.hidden = total <= items.length && cat.dept !== 'all' && cat.dept !== 'eyewear';","$('#catMore').parentElement.hidden = total <= items.length && cat.dept !== 'all' && cat.dept !== 'eyewear' && cat.dept !== 'earrings' && cat.dept !== 'necklaces' && cat.dept !== 'purses' && cat.dept !== 'sandals';")
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
rep("    // the same hairstyle in its other colours\n","    if (isJ(it)) $('#itNote').textContent = it.dept === 'sandals' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to fit her feet (a pair, in one mesh). Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart.' : it.dept === 'purses' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to hang across her body. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.' : it.dept === 'earrings' ? 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres for her head. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.' : 'Pick a format: GLB, FBX, OBJ, glTF, STL or PLY. Sized in centimetres to sit on her neck and chest. Everything is baked into one mesh with one texture (up to 1024 px), ready for a Roblox MeshPart. Charms are flat pictures on a card.';\n    // the same hairstyle in its other colours\n")
rep("      $('#itSpecs').innerHTML = specRows(it.d);\n      showItemModel();","      $('#itSpecs').innerHTML = isJ(it) ? JM.specRows(it) : specRows(it.d);\n      showItemModel();")
rep("    } else {\n      const arch = { glasses:","    } else if (isJ(it)) { jewelLike(like, it);\n    } else {\n      const arch = { glasses:")
# itEdit
rep("    loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false }); commit(); location.hash = '#edit';","    if (isJ(it)) { JM.load(it.dept, it.d, { name: it.name, seed: it.seed, autoName: false }); JM.on = false; store.set(JKEY(it.dept), { d: JM.st.d, name: JM.st.name, seed: JM.st.seed, autoName: false }); JM.st = null; location.hash = '#edit/' + it.dept; return; }\n    loadDesign(it.d, { name: it.name, seed: it.seed, autoName: false, brand: it.brand }); commit(); location.hash = '#edit';")
rep("$('#itRemove').onclick = () => { const it = viewer.item; if (!it || !it.mine || deptOf(it) === 'hair') return;","$('#itRemove').onclick = () => { const it = viewer.item; if (!it || !it.mine || deptOf(it) === 'hair') return;")
# download
rep("if (deptOf(w) === 'hair') downloadHair(w, b.dataset.fmt); else downloadAs(w.d, w.seed, w.name, b.dataset.fmt); };","if (deptOf(w) === 'hair') downloadHair(w, b.dataset.fmt); else if (isJ(w)) JM.download(w, b.dataset.fmt); else downloadAs(w.d, w.seed, w.name, b.dataset.fmt); };")
rep("formatMenu($('#bExport'), $('#edFormats'), () => ({ d: state.d, seed: state.seed, name: state.name }));","formatMenu($('#bExport'), $('#edFormats'), () => JM.on ? { dept: JM.dept, d: JM.st.d, seed: JM.st.seed, name: JM.st.name } : ({ d: state.d, seed: state.seed, name: state.name }));")

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
rep("function route() { hoverEnd(); const h = location.hash; if (/^#edit/.test(h)) enterEditor();","function route() { hoverEnd(); const h = location.hash, jm = /^#edit\\/(earrings|necklaces|purses|sandals)/.exec(h); if (!jm) JM.leave(); if (/^#edit/.test(h)) { enterEditor(); if (jm) JM.enter(jm[1]); }")
# hero + create menu + search text
rep("Search glasses, shades, goggles and hair","Search glasses, hair, earrings, necklaces, purses, sandals and brands")
rep("Glasses, shades, goggles and hair, all made from scratch. Open anything","Glasses, shades, goggles, hair, earrings, necklaces, purses and sandals, all made from scratch. Open anything")
rep('<a role="menuitem" id="createHair" href="#">','<a role="menuitem" href="#edit/earrings"><i data-g-icon="diamond"></i><span><b>Earrings editor</b><span>Stack charms and shapes into a pair</span></span></a><a role="menuitem" href="#edit/necklaces"><i data-g-icon="flower"></i><span><b>Necklace editor</b><span>Any length, with charms and shapes on the cord</span></span></a><a role="menuitem" href="#edit/purses"><i data-g-icon="shopping_bag"></i><span><b>Purse editor</b><span>Bag shapes, straps, patterns and keychains</span></span></a><a role=\"menuitem\" href=\"#edit/sandals\"><i data-g-icon=\"sun\"></i><span><b>Sandal editor</b><span>Soles, straps, gradients and strap charms</span></span></a><a role="menuitem" id="createHair" href="#">')
rep('<button class="g-btn" id="heroShuffle"','<button class="g-btn" id="heroEar" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="diamond"></i><span>Roll earrings</span></button><button class="g-btn" id="heroNeck" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="flower"></i><span>Roll a necklace</span></button><button class="g-btn" id="heroPurse" style="background:rgba(255,255,255,.1);color:var(--g-snow)"><i data-g-icon="shopping_bag"></i><span>Roll a purse</span></button><button class=\"g-btn\" id=\"heroSandal\" style=\"background:rgba(255,255,255,.1);color:var(--g-snow)\"><i data-g-icon=\"sun\"></i><span>Roll sandals</span></button><button class="g-btn" id="heroShuffle"')
rep("  $('#heroRoll').onclick = () => { roll('all'); location.hash = '#edit'; };","  $('#heroRoll').onclick = () => { roll('all'); location.hash = '#edit'; };\n  for (const [id, dept] of [['#heroEar', 'earrings'], ['#heroNeck', 'necklaces'], ['#heroPurse', 'purses'], ['#heroSandal', 'sandals']]) $(id).onclick = () => { if (location.hash === '#edit/' + dept) return; JM.dept = dept; location.hash = '#edit/' + dept; setTimeout(() => JM.roll('all'), 60); };")
# exporter alpha mask
rep("      if (m.transparent) M.alphaMode = 'BLEND';","      if (m.transparent) M.alphaMode = 'BLEND'; else if (m.alphaTest > 0) { M.alphaMode = 'MASK'; M.alphaCutoff = m.alphaTest; }")
rep("    hideFaceHair();\n    if (hover.a) {","    hideFaceHair(); JM.syncDress();\n    if (hover.a) {")
# tweak
rep("window.EyewearStudio = window.GrugCatalog = { HD,","window.EyewearStudio = window.GrugCatalog = { J, JM, isJ, genEyewear, kimiEye, HD,")

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
rep("</style>\n</head>", css+"</style>\n</head>") if s.count("</style>\n</head>")==1 else None
open(os.path.join(REPO,'labs','catalog','index.html'),'w').write(s)
print('ok',len(s))
