/* ===== GrugStudio: a small API so Claude (or any browser agent) can drive the studio from code =====
   The full guide for agents is /character/claude.md. Every call does what the matching button does, so a person
   watching sees the same thing they'd see if they clicked. Also handles recipe links (?hair=…&outfit=…) and the
   "Make with Claude" sheet. */
(() => {
'use strict';
const C = window.__creator, L = __LABELS__;
const $q = s => document.querySelector(s);
const slug = s => String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const SKIN_LIST = SKINS.map(([name, rgb]) => ({ name, hex: rgbHex(rgb) }));
const HAIR_NAMES = () => C.HAIR.map(h => h.name), HEAD_NAMES = () => C.HEADS.map(h => h.name);
const VIEWS = ['head', 'hair', 'hairShape', 'hairTuft', 'brow', 'eye', 'mouth', 'shirt', 'paint', 'anim', 'finish'];
const bodies = () => [...document.querySelectorAll('#bodyType button')].map(b => b.dataset.v).filter(v => v && v !== 'figure');
const looks = () => (typeof EXAMPLES !== 'undefined' ? EXAMPLES : []).map(e => e.name);

function toHex(v, names){
  const s = String(v).trim(); let m = s.match(/^#?([0-9a-f]{6})$/i);
  if (m) return '#' + m[1].toLowerCase();
  if ((m = s.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i))) return ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase();
  if (names){ const k = Object.keys(names).find(n => slug(n) === slug(s)); if (k) return names[k]; }
  throw new Error(`Unknown colour "${v}". Use a hex like #7a4b2a${names ? ' or one of: ' + Object.keys(names).join(', ') : ''}.`);
}
function pick(list, v, what){
  if (typeof v === 'number' || /^\s*\d+\s*$/.test(String(v))){
    const i = +v; if (i >= 0 && i < list.length) return i;
    throw new Error(`${what} ${v} is out of range (0 to ${list.length - 1}).`);
  }
  const s = slug(v), words = s.split('-').filter(Boolean);
  let i = list.findIndex(n => slug(n) === s);
  if (i < 0) i = list.findIndex(n => slug(n).includes(s));
  if (i < 0 && words.length) i = list.findIndex(n => words.every(w => slug(n).includes(w)));
  if (i < 0) throw new Error(`Unknown ${what} "${v}". Options: ${list.map((n, k) => k + ' ' + n).join('; ')}.`);
  return i;
}
const loadImg = (src, cors) => new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't load that image")); i.src = src; });
async function toImage(src){
  if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap)) return src;
  if (src instanceof Blob){ const u = URL.createObjectURL(src); try { return await loadImg(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 4000); } }
  if (typeof src === 'string'){
    const s = src.trim();
    if (/^(data:|blob:)/.test(s)) return loadImg(s);
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(s)) return loadImg('data:image/png;base64,' + s.replace(/\s+/g, ''));
    return loadImg(new URL(s, location.href).href, true);
  }
  throw new Error('wear() takes a data: URL, an image URL, a base64 PNG, a Blob/File, an <img> or a <canvas>.');
}
const match = () => (state.img && typeof upMask !== 'undefined' && upMask) ? +iou(state.align, RM[1]).toFixed(3) : null;
const label = (list, i) => list[i] != null ? `${i} (${list[i]})` : String(i);

function options(){
  return {
    hair: HAIR_NAMES(), hairColors: L.hairColors, heads: HEAD_NAMES(), headSize: { min: 0.8, max: 1.3, default: 1.1 },
    eyes: L.eyes, brows: L.brows, mouths: L.mouths, browColors: 'same names as hairColors, or any hex',
    skins: SKIN_LIST, bodies: bodies(), looks: looks(), tees: C.TEES, views: VIEWS,
    note: 'Eyes, brows and mouth take an index or a few words of the description. Colours take a name or a hex. ' +
          'set() applies only the keys you pass.'
  };
}
function get(){
  const CH = C.CH, F = C.FACE;
  return {
    name: $q('#setName').value, skin: $q('#skin').value, body: V3.body, head: HEAD_NAMES()[CH.head], headSize: CH.headSize,
    hair: CH.hairStyle >= 0 ? HAIR_NAMES()[CH.hairStyle] : 'custom', hairColor: CH.hairColor,
    eyes: F.eye.i, brows: F.brow.i, mouth: F.mouth.i, browColor: F.brow.color, outfit: $q('#outfit').value,
    face: `eyes ${label(L.eyes, F.eye.i)}, brows ${label(L.brows, F.brow.i)}, mouth ${label(L.mouths, F.mouth.i)}`
  };
}
async function set(r){
  r = r || {};
  const CH = C.CH, F = C.FACE;
  if (r.reset) C.resetAll();
  if (r.random) C.randomize();
  if (r.name != null){ const n = $q('#setName'); n.value = String(r.name).slice(0, 24); n.dispatchEvent(new Event('input')); }
  if (r.skin != null){ const k = SKIN_LIST.findIndex(s => slug(s.name) === slug(r.skin)); const hex = k >= 0 ? SKIN_LIST[k].hex : toHex(r.skin); $q('#skin').value = hex; setSkin(hexRgb(hex)); }
  if (r.body != null){
    const v = slug(r.body); if (!bodies().includes(v)) throw new Error(`Unknown body "${r.body}". Options: ${bodies().join(', ')}.`);
    const b = $q(`#bodyType button[data-v="${v}"]`); if (b) await b.onclick();
  }
  if (r.head != null){ CH.head = pick(HEAD_NAMES(), r.head, 'head'); C.rebuildHead(); }
  if (r.headSize != null){ CH.headSize = clamp(+r.headSize || 1.1, 0.8, 1.3); C.aimCamera(); }
  if (r.hair != null) C.setHairStyle(pick(HAIR_NAMES(), r.hair, 'hair style'));
  if (r.hairFlip && CH.hair && CH.hair.on){ C.flipHair(CH.hair); C.hairTouch(); }
  if (r.hairColor != null){ const hex = toHex(r.hairColor, L.hairColors), same = F.brow.color === CH.hairColor; CH.hairColor = hex; if (same && r.browColor == null) F.brow.color = hex; C.ANIM.hairPop = 0; }
  if (r.eyes != null) C.pickPart('eye', pick(L.eyes, r.eyes, 'eyes'));
  if (r.brows != null) C.pickPart('brow', pick(L.brows, r.brows, 'brows'));
  if (r.mouth != null) C.pickPart('mouth', pick(L.mouths, r.mouth, 'mouth'));
  if (r.browColor != null) F.brow.color = toHex(r.browColor, L.hairColors);
  if (r.outfit != null){ $q('#outfit').value = String(r.outfit); buildPrompt(); }
  if (r.tee != null) C.wearTee(toHex(r.tee));
  if (r.look != null) await wearLook(r.look);
  C.touch();
  const view = r.view != null ? r.view : null;
  if (view != null){ const v = VIEWS.find(x => slug(x) === slug(view)); if (!v) throw new Error(`Unknown view "${view}". Options: ${VIEWS.join(', ')}.`); C.setCat(v); }
  else { C.aimCamera(); C.drawPanel(); }
  return get();
}
async function wearLook(name){
  const list = typeof EXAMPLES !== 'undefined' ? EXAMPLES : [], e = list[pick(list.map(x => x.name), name, 'look')];
  const toC = im => { const c = cnv(TW, TH); c.getContext('2d').drawImage(im, 0, 0); return c; };
  state.rawShirt = toC(await loadImg(e.shirt)); state.rawPants = toC(await loadImg(e.pants));
  alignedData = null; state.built = true; applyFX();
  document.querySelectorAll('#exGrid .ex').forEach(b => b.classList.toggle('on', b.textContent.startsWith(e.name)));
  return e.name;
}
function prompt(outfit){ if (outfit != null){ $q('#outfit').value = String(outfit); } buildPrompt(); return $q('#prompt').value; }
const templateBlob = () => new Promise(res => refWhite.toBlob(res, 'image/png'));
async function copyTemplate(){
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': templateBlob() })]); toast('Picture copied. Paste it into Gemini.'); return true; }
  catch (e) { toast("Couldn't copy here. Use Download instead."); return false; }
}
async function copyPrompt(outfit){
  const t = prompt(outfit);
  try { await navigator.clipboard.writeText(t); toast('Prompt copied'); return true; } catch (e) { return false; }
}
async function wear(src, o){
  o = o || {};
  const img = await toImage(src);
  setImage(img, img.naturalWidth || img.width, img.naturalHeight || img.height);   // auto-aligns and opens the alignment sheet
  const m = match();
  if (o.review) return { match: m, wearing: false, next: 'Check the outlines on the alignment sheet, then click "Wear it" (or call GrugStudio.wearIt()).' };
  return wearIt();
}
function wearIt(){
  if (!state.img) throw new Error('No painted image yet. Paste the Gemini image into the page first (or call GrugStudio.wear(image)).');
  const m = match(); build();
  return { match: m, wearing: true, note: m != null && m < 0.85 ? 'The silhouette match is low: the outfit may be shifted. Check the 3D view; if it looks wrong, ask Gemini again for the same picture with nothing moved, or line it up by hand on the alignment sheet.' : 'Looks lined up.' };
}
async function r6Blob(){ if (!state.shirt) throw new Error('No outfit yet.'); return buildCharacterGLB(); }
const fileName = () => (cleanName($q('#setName').value) || 'Character') + '.glb';
async function downloadR6(name){
  if (name != null){ const n = $q('#setName'); n.value = String(name).slice(0, 24); n.dispatchEvent(new Event('input')); }
  const b = await r6Blob(), f = fileName(); GRUG.download(f, b);
  return { file: f, bytes: b.size, note: 'Saved to the browser\'s downloads folder. Import it into Roblox Studio with the 3D Importer and add a Humanoid (R6). If the parts arrive wrapped in Models or without joints, run r6Script() in the Command Bar.' };
}
async function r6Base64(){ const b = await r6Blob(); const u = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); return u.slice(u.indexOf(',') + 1); }
function status(){
  const m = match();
  return {
    ready: api.ready, view: C.UI.tab, customImage: !!state.img, aligning: !$q('#s2').hidden, match: m,
    wearing: !!state.built, canDownload: !!state.shirt, file: fileName(),
    next: !state.img ? 'Pick hair and a face, then paint an outfit (Outfit > Create outfit with Claude) or call set({look}).'
        : !$q('#s2').hidden ? 'Alignment sheet is open: click "Wear it" or call wearIt().' : 'Ready: call downloadR6() or click Save / Finish > Roblox R6 character (.glb).'
  };
}

const api = window.GrugStudio = {
  version: 1, ready: false, guide: '/character/claude.md',
  options, get, set, random: () => set({ random: true }),
  prompt, copyPrompt, copyTemplate, templateDataURL: () => refWhite.toDataURL('image/png'),
  downloadTemplate: () => { download(refWhite, 'roblox-clothing-reference.png'); return 'roblox-clothing-reference.png'; },
  openPaint: () => { C.setCat('paint'); return 'Outfit painting steps are open.'; },
  wear, wearIt, match, finish: () => { C.setCat('finish'); return status(); },
  downloadR6, r6Base64, downloadZip: () => $q('#dlSet').onclick(), r6Script: () => R6_SETUP_LUA,
  status, help: () => `Grug Avatar Studio agent API v1. Guide: ${location.origin}/character/claude.md\n` +
    'GrugStudio.options() · set({name, skin, body, head, headSize, hair, hairColor, hairFlip, eyes, brows, mouth, browColor, outfit, look, tee, view})\n' +
    'prompt(outfit) · copyTemplate() · copyPrompt(outfit) · downloadTemplate() · wear(image) · wearIt() · status() · downloadR6(name) · r6Base64() · downloadZip()'
};
api.whenReady = (C.sheetsReady || Promise.resolve()).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => { api.ready = true; return api; });

/* the template picture's Copy button (step 1 of painting) */
$q('#clCopyRef').onclick = copyTemplate;

/* ---------- recipe links: /character/?hair=ponytail&hairColor=blonde&eyes=lashes&outfit=warm+fall+outfit ---------- */
const KEYS = ['name', 'skin', 'body', 'head', 'headSize', 'hair', 'hairColor', 'hairFlip', 'eyes', 'brows', 'mouth', 'browColor', 'outfit', 'look', 'tee', 'view', 'random'];
const qs = new URLSearchParams(location.search), recipe = {};
qs.forEach((v, k) => { const key = KEYS.find(x => x.toLowerCase() === k.toLowerCase().replace(/[-_]/g, '')); if (key) recipe[key] = (key === 'hairFlip' || key === 'random') ? !/^(0|false|no)$/i.test(v) : v; });
if (recipe.outfit != null && recipe.view == null) recipe.view = 'paint';
if (Object.keys(recipe).length) api.whenReady.then(() => set(recipe)).catch(e => { toast(e.message); console.warn('[GrugStudio]', e.message); });

/* ---------- "Make with Claude": the sheet people copy their Claude prompt from ---------- */
const sheet = $q('#claudeGuide'), idea = $q('#cgIdea'), out = $q('#cgPrompt'), open = $q('#cgOpen');
const CANON = 'https://grugdigital.pages.dev/character/';
const here = () => location.protocol.startsWith('http') && location.hostname !== 'grugdigital.pages.dev' ? location.origin + '/character/' : CANON;
const words = () => `Use ${here()} to make ${(idea.value.trim() || 'a character wearing a cool outfit').replace(/[.\s]+$/, '')}. Download the Roblox R6 file for me.`;
function syncSheet(){ const t = words(); out.textContent = t; open.href = 'https://claude.ai/new?q=' + encodeURIComponent(t); }
function showSheet(on){ sheet.classList.toggle('open', on); if (on){ syncSheet(); setTimeout(() => idea.focus(), 30); } }
idea.addEventListener('input', syncSheet);
$q('#toClaude').onclick = $q('#toClaudeM').onclick = () => showSheet(true);
$q('#cgClose').onclick = () => showSheet(false);
sheet.addEventListener('click', e => { if (e.target === sheet) showSheet(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('open')) showSheet(false); });
$q('#cgCopy').onclick = async () => { try { await navigator.clipboard.writeText(words()); toast('Copied. Paste it into Claude.'); } catch (e) { const r = document.createRange(); r.selectNodeContents(out); getSelection().removeAllRanges(); getSelection().addRange(r); } };
syncSheet();
if (location.hash === '#claude' || qs.has('claude')) showSheet(true);
})();
