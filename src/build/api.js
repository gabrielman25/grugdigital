/* =====================================================================
   window.GrugBuild: the same studio, driven from code (Claude, browser agents)
   ===================================================================== */
async function toImage(src){
  if (src instanceof HTMLImageElement) return src.complete ? src : await new Promise(r => src.onload = () => r(src));
  if (src instanceof HTMLCanvasElement) return loadImageURL(src.toDataURL('image/png'));
  if (src instanceof Blob) return loadImageURL(URL.createObjectURL(src));
  if (typeof src === 'string'){ if (/^[A-Za-z0-9+/=\s]{200,}$/.test(src)) src = 'data:image/png;base64,' + src.replace(/\s+/g, ''); return loadImageURL(src); }
  throw new Error('wear() takes a data: URL, base64 PNG, Blob, image, canvas or same-site URL');
}
const nextStepText = () => {
  if (!AL.img) return 'Describe it (GrugBuild.describe(text)), then paint it in Gemini: click Copy picture and Copy prompt in step 2 (GrugBuild.step(2)), paste both into Gemini, then paste Gemini\'s picture back (Ctrl/⌘+V) or call GrugBuild.wear(image).';
  if (AL.geo !== S.geoVer) return 'The model changed after the picture was made: make a new reference (step 2) and paint it again.';
  if (AL.match < 0.8) return 'The picture doesn\'t line up well (match ' + (AL.match*100).toFixed(0) + '%). Ask Gemini to keep the exact same layout, or adjust in step 3.';
  if (!BK.out) return 'Bake it: await GrugBuild.bake()';
  return 'Done: await GrugBuild.downloadGLB() to save the .glb.';
};
window.GrugBuild = {
  version: 2,
  ready: true,
  whenReady: Promise.resolve(true),
  help(){
    return [
      'GrugBuild: one chunky building + one roof (no overhangs: nothing may hide a wall), painted in Gemini, baked to a retro .glb. Units are metres; front = +z.',
      'Shape:  set({w, d, h, base, roof, rh, ridge}) · get() · preset(name) · options()',
      '        w/d/h: width, depth, wall height (whole numbers) · base: foundation 0-2 · roof: flat|gable|hip|shed · rh: roof height · ridge: "x" (left-right) or "z" (front-back)',
      'Openings: set({floors, door, door2, backDoor, wf, ws, wb}) · door: none|left|center|right · wf/ws/wb: windows per floor on the front / each side / back',
      'Paint:  describe(text, look?) · prompt() · reference() → PNG data URL · downloadReference()',
      '        In step 2 the Copy picture / Copy prompt buttons need real clicks (browsers only let a click write pictures to the clipboard).',
      'Back:   wear(image) → lines up + bakes, returns {match} · match() · autoAlign()',
      'Finish: bake({look, size, deshade, bevel}) · looks() · downloadGLB() · glbBase64() · downloadTexture() · screenshot()',
      'Status: status() → {step, picture, match, baked, next} · step(n) · frame()',
    ].join('\n');
  },
  options(){
    return { params: Object.fromEntries(Object.entries(LIM).map(([k, [a, b, st]]) => [k, { min:a, max:b, step:st }])), roof: Object.keys(ROOFS), ridge:['x','z'], door: Object.keys(DOORS),
      looks: Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, v.label])), textureLooks: Object.fromEntries(Object.entries(FX_PRESETS).map(([k, v]) => [k, v.label])),
      presets: Object.keys(PRESETS), colourKey: { ...Object.fromEntries(ROLE_KEYS.map(k => [k, ROLES[k].hint])), ...Object.fromEntries(MARK_KEYS.map(k => [k, MARKS[k].hint])) } };
  },
  get: () => sceneJSON(),
  set(o = {}){ setParams(o); if (o.desc != null) App.prompt = null; frameAll(); if (App.step !== 1) goStep(1); updateUI(); return sceneJSON(); },
  preset(name){ if (!PRESETS[name]) throw new Error('Presets: ' + Object.keys(PRESETS).join(', ')); loadPreset(name); if (App.step !== 1) goStep(1); return sceneJSON(); },
  describe(text, look){ if (typeof text === 'object' && text){ look = text.look; text = text.desc; } if (text != null) S.desc = String(text); if (look && LOOKS[look]) S.look = look;
    App.prompt = null; save(); if (App.step === 2) enterPaint(); return buildPrompt(); },
  prompt: () => promptText(),
  reference(){ buildReference(); return REF.white.toDataURL('image/png'); },
  async downloadReference(){ downloadBlob(await refBlob(), `${slug()}-reference.png`); return `${slug()}-reference.png`; },
  async wear(src, o = {}){ const img = await toImage(src); const m = await usePicture(img); if (!o.review && m > 0.6) await this.bake(); return { match: +m.toFixed(3), baked: !!BK.out }; },
  match: () => +updateMatch().toFixed(3),
  autoAlign(){ const v = autoAlign(); alChanged(); return +v.toFixed(3); },
  async bake(o = {}){
    if (o.look && FX_PRESETS[o.look]) BK.look = o.look; if (o.size) { BK.size = [1024,2048,4096].includes(+o.size) ? +o.size : 1024; BK.raw = null; }
    if (o.deshade != null){ BK.deshade = clamp(+o.deshade, 0, 1); BK.raw = null; } if (o.bevel != null) BK.bevel = !!o.bevel;
    if (!canGo(4)) throw new Error(nextStepText());
    if (App.step !== 4) goStep(4); await enterFinish(); refinish();
    return { size: BK.size, look: BK.look, texelsPerUnit: BK.raw ? +BK.raw.td.toFixed(1) : 0 };
  },
  looks: () => Object.fromEntries(Object.entries(FX_PRESETS).map(([k, v]) => [k, v.label])),
  async downloadGLB(){ if (!BK.out) await this.bake(); const { bytes, name } = await makeGLB(); downloadBlob(new Blob([bytes], { type:'model/gltf-binary' }), `${name}.glb`); return { file:`${name}.glb`, bytes:bytes.length }; },
  async glbBase64(){ if (!BK.out) await this.bake(); const { bytes } = await makeGLB(); let s = ''; for (let i=0;i<bytes.length;i+=0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000)); return btoa(s); },
  downloadTexture(){ if (BK.out) BK.out.col.toBlob(b => downloadBlob(b, `${slug()}-color.png`)); },
  screenshot(){ App.dirty = true; render(); return viewC.toDataURL('image/png'); },
  step(n){ goStep(n); return this.status(); },
  frame(){ frameAll(); },
  status(){ return { step: App.step, building: sceneJSON(), picture: !!AL.img, pictureMatchesModel: !!AL.img && AL.geo === S.geoVer,
    match: AL.img ? +AL.match.toFixed(3) : null, baked: !!BK.out && BK.out.geo === S.geoVer, look: BK.look, next: nextStepText() }; },
};

/* ---------- boot: ?preset=… or any setting in the address (?w=8&d=6&h=4&roof=gable&rh=3&desc=…), else the last session ---------- */
(function boot(){
  let loaded = false;
  try {
    const q = new URLSearchParams(location.search), o = {};
    for (const [k, v] of q) if (k in DEF || k === 'desc' || k === 'look') o[k] = v;
    if (q.get('preset') && PRESETS[q.get('preset')]){ const P = PRESETS[q.get('preset')]; setParams({ ...P.p, desc: P.desc }); loaded = true; }
    if (Object.keys(o).length){ setParams(o); loaded = true; }
  } catch (e) { console.warn(e); }
  if (!loaded){ try { const s = JSON.parse(localStorage.getItem('grug.build.v2') || 'null'); if (s){ setParams(s); loaded = true; } } catch (e) {} }
  if (!loaded){ const P = PRESETS.cottage; setParams({ ...P.p, desc: P.desc }); }
  buildArrow(); frameAll(); updateUI(); loop();
  figureGLB().then(b => b && loadFigure(R3, b)).then(f => { if (f){ App.fig = f; App.dirty = true; } }).catch(() => {});
})();
