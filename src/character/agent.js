/* ===== GrugStudio: a small API so Claude (or any browser agent) can drive the studio from code =====
   The full guide for agents is /agents/studio/claude.md. Every call does what the matching button does, so a person
   watching sees the same thing they'd see if they clicked. Also handles recipe links (?hair=…&outfit=…).
   The same file runs in both versions of the studio: the players' one (/character/, hands on) and the agents' one
   (/agents/studio/, src/character/agent_studio.*: no pickers or sliders, this API and a short console instead). Every
   change it makes is announced as a 'grug:studio' event on window, which the agents' console redraws itself from. */
(() => {
'use strict';
const C = window.__creator, L = __LABELS__;
const $q = s => document.querySelector(s);
const AGENT = document.body.classList.contains('agent');   // the agents' version of the studio (/agents/studio/)
const ping = type => { try { dispatchEvent(new CustomEvent('grug:studio', { detail: { type } })); } catch (e) {} };
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
  if (r.tee != null){ C.wearTee(toHex(r.tee)); outfit.worn = false; }
  if (r.look != null){ await wearLook(r.look); outfit.worn = false; }
  C.touch();
  const view = r.view != null ? r.view : null;
  if (view != null){ const v = VIEWS.find(x => slug(x) === slug(view)); if (!v) throw new Error(`Unknown view "${view}". Options: ${VIEWS.join(', ')}.`); C.setCat(v); }
  else { C.aimCamera(); C.drawPanel(); }
  syncWarn(); ping('set');
  return Object.assign(get(), { next: status().next });
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
const CLICK_NOTE = 'The clipboard needs a real click. Click the "Copy picture" / "Copy prompt" button in the studio instead of calling this from code.';
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);
async function copyTemplate(){
  try { await within(navigator.clipboard.write([new ClipboardItem({ 'image/png': templateBlob() })]), 5000); toast('Picture copied. Paste it into Gemini.'); return true; }
  catch (e) { toast("Couldn't copy here. Use Download instead."); return { copied: false, note: CLICK_NOTE }; }
}
async function copyPrompt(outfit){
  const t = prompt(outfit);
  try { await within(navigator.clipboard.writeText(t), 5000); toast('Prompt copied'); return true; } catch (e) { return { copied: false, note: CLICK_NOTE }; }
}
async function wear(src, o){
  o = o || {};
  const img = await toImage(src);
  setImage(img, img.naturalWidth || img.width, img.naturalHeight || img.height);   // auto-aligns and opens the alignment sheet
  const m = match(); ping('image');
  if (o.review) return { match: m, wearing: false, next: 'Check the outlines on the alignment sheet, then click "Wear it" (or call GrugStudio.wearIt()).' };
  return wearIt();
}
function wearIt(){
  if (!state.img) throw new Error('No painted image yet. Paste the Gemini image into the page first (or call GrugStudio.wear(image)).');
  const m = match(); build(); outfit.worn = outfit.source === 'pasted'; syncWarn(); ping('wear');
  return { match: m, wearing: true, customOutfit: outfit.worn, note: m != null && m < 0.85 ? 'The silhouette match is low: the outfit may be shifted. Check the 3D view; if it looks wrong, ask Gemini again for the same picture with nothing moved, or line it up by hand on the alignment sheet.' : 'Looks lined up.' };
}
async function r6Blob(){ if (!state.shirt) throw new Error('No outfit yet.'); return buildCharacterGLB(); }
const fileName = () => (cleanName($q('#setName').value) || 'Character') + '.glb';
function needOutfit(o){
  if (outfit.worn || (o && o.starterOutfit)) return;
  throw new Error('Not finished: the character is still wearing the ' + (outfit.source === 'demo' ? 'demo' : 'starter') + ' outfit. ' +
    'Painting the custom shirt and pants in Gemini is part of the job. Call GrugStudio.paintOutfit("<garments, colours, materials, shoes>") and follow the steps it returns, ' +
    'then download. (Only if the person explicitly said they want no custom outfit: downloadR6(name, { starterOutfit: true }).)');
}
async function downloadR6(name, o){
  needOutfit(o);
  if (name != null){ const n = $q('#setName'); n.value = String(name).slice(0, 24); n.dispatchEvent(new Event('input')); }
  const paidNow = await payFromApi(o);
  const b = await r6Blob(), f = fileName(); GRUG.download(f, b); ping('download');
  return { file: f, bytes: b.size, pearls: paidNow, note: 'Saved to the browser\'s downloads folder. Import it into Roblox Studio with the 3D Importer and add a Humanoid (R6). If the parts arrive wrapped in Models or without joints, run r6Script() in the Command Bar.' };
}
async function r6Base64(o){ needOutfit(o); await payFromApi(o); const b = await r6Blob(); const u = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); return u.slice(u.indexOf(',') + 1); }
function status(){
  const m = match();
  return {
    ready: api.ready, view: C.UI.tab, customImage: !!state.img, aligning: !$q('#s2').hidden, match: m,
    customOutfit: outfit.worn, file: fileName(), pearls: pearlInfo(),
    next: outfit.worn ? (paidNow() ? 'Done painting, and this character is already paid for: call await GrugStudio.downloadR6() and give the person the .glb.' : 'Done painting. Exporting costs ' + FEE() + ' Pearls (they have ' + P().balance() + '). Ask the person, then call await GrugStudio.downloadR6(null, { spendPearls: true }) and give them the .glb.')
        : !$q('#s2').hidden ? 'The alignment sheet is open with the pasted picture: click "Wear it" (or call GrugStudio.wearIt()), then downloadR6().'
        : 'REQUIRED NEXT: paint the custom shirt and pants in Gemini. Call GrugStudio.paintOutfit("<garments, colours, materials, shoes>") and follow the steps it returns.'
  };
}

const STEPS = [
  'In this studio tab: await GrugStudio.paintOutfit("<garments, colours, materials, shoes>") (already done if you are reading this from it).',
  'CLICK the studio button "Copy picture" (a real click; copying from code does not work). Wait for the toast "Picture copied".',
  'Open https://gemini.google.com/app in a new tab. Click the message box and press Ctrl+V (Cmd+V on a Mac). A thumbnail of two grey blocky avatars appears. If Gemini asks the person to sign in, ask them to.',
  'Back in the studio, CLICK "Copy prompt". In Gemini, click the message box (after the thumbnail) and press Ctrl+V. Do not type the prompt yourself: it has line breaks and Enter would send it too early.',
  'Click Gemini\'s Send button. Wait 20 to 60 seconds for the painted picture. If Gemini answers with text only, reply "Please generate the edited image now."',
  'In Gemini, hover the painted picture and click its "Copy image" button.',
  'Back in the studio, click the 3D view (not a text box) and press Ctrl+V. The alignment sheet opens. GrugStudio.status().match should be 0.85 or more; if it is lower, ask Gemini to keep the exact layout and only paint the clothes, then copy and paste again.',
  'Click "Wear it" (or call GrugStudio.wearIt()). Take a screenshot to check the outfit on the 3D character.',
  'Exporting costs Pearls (GrugStudio.status().pearls has the price and their balance; re-downloading the same character is free). Tell the person the price and ask before spending, then await GrugStudio.downloadR6(null, { spendPearls: true }) saves <Name>.glb. Give it to the person. Never buy Pearls for them.'
];
function paintOutfit(desc){
  if (desc != null){ $q('#outfit').value = String(desc); }
  buildPrompt(); C.setCat('paint');
  const b = $q('#agCopyPic') || $q('#clCopyRef'); b.scrollIntoView({ block: 'center' }); ping('paint');
  return { outfit: $q('#outfit').value || '(empty: pass a description)', steps: STEPS.slice(1).map((t, i) => `${i + 1}. ${t}`),
    note: 'The custom outfit is the point of this studio. Do every step; don\'t download before the painted outfit is worn.' };
}

/* ---------- Pearls: making and saving characters is free; exporting one as an R6 file costs CFG.exportFee ---------- */
const P = () => window.GrugPearls, FEE = () => (P() ? P().CFG.exportFee : 0);
let charIdCache = { key: '', id: '' };
async function charId(){   // the same character (look + painted outfit) gives the same id, whatever it's called
  const F = C.FACE, look = JSON.stringify({ CH: Object.assign({}, C.CH), face: [F.eye.i, F.brow.i, F.mouth.i, F.brow.color], skin: $q('#skin').value, body: V3.body });
  const pix = c => (c && c.toDataURL) ? c.toDataURL('image/png') : '';
  const data = look + '|' + pix(state.shirt) + '|' + pix(state.pants);
  if (charIdCache.key === data) return charIdCache.id;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const id = 'c' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  charIdCache = { key: data, id }; return id;
}
let lastPaidId = null;
const paidNow = () => !!(lastPaidId && P() && P().paid(lastPaidId));
function pearlInfo(){ return P() ? { balance: P().balance(), exportFee: FEE(), paidForThisCharacter: paidNow(), getMore: location.origin + '/character/pearls/' } : null; }
async function payFromApi(o){
  if (!P()) return 0;
  const id = await charId(); lastPaidId = id;
  if (P().paid(id)) return 0;
  const fee = FEE(), have = P().balance();
  if (have < fee) throw new Error(`Not enough Pearls: exporting costs ${fee} and the person has ${have}. They get ${P().CFG.daily} free every day (${P().CFG.dailyGold} with Grug Gold) or can buy more at ${location.origin}/character/pearls/. Tell them; don't buy Pearls for them.`);
  if (!(o && o.spendPearls)) throw new Error(`Exporting this character costs ${fee} Pearls (the person has ${have}; re-downloading the same character later is free). Ask the person whether to spend them, then call again with { spendPearls: true }.`);
  await P().spend(fee, 'R6 export: ' + fileName()); P().markPaid(id); paintPearls(); toast(`${fee} Pearls spent. Enjoy ${fileName().replace(/\.glb$/, '')}!`);
  return fee;
}
/* the price sheet behind the R6 and zip buttons */
function payDialog(){
  return new Promise(async res => {
    const id = await charId(); lastPaidId = id;
    if (!P() || P().paid(id)) return res(true);
    const fee = FEE(), have = P().balance(), short = have < fee, d = $q('#payDlg');
    $q('#payTitle').textContent = short ? 'You need a few more Pearls' : `Export for ${fee} Pearls?`;
    $q('#payText').textContent = short
      ? `Exporting ${fileName().replace(/\.glb$/, '')} as a Roblox R6 character costs ${fee} Pearls, and you have ${have}. You get ${P().CFG.daily} free Pearls every day you visit (${P().CFG.dailyGold} with Grug Gold), or you can get more now.`
      : `Exporting ${fileName().replace(/\.glb$/, '')} as a Roblox R6 character costs ${fee} Pearls. You have ${have}. Downloading this same character again later is free.`;
    $q('#payGo').hidden = short; $q('#payMore').hidden = !short;
    $q('#payGo').textContent = `Export · ${fee} Pearls`;
    d.classList.add('open');
    const done = ok => { d.classList.remove('open'); $q('#payGo').onclick = $q('#payNo').onclick = d.onclick = null; res(ok); };
    $q('#payNo').onclick = () => done(false);
    d.onclick = e => { if (e.target === d) done(false); };
    $q('#payGo').onclick = async () => {
      try { await P().spend(fee, 'R6 export: ' + fileName()); P().markPaid(id); paintPearls(); done(true); }
      catch (e) { toast(e.message); done(false); }
    };
  });
}
const GLB_RAW = $q('#dlGLB').onclick, ZIP_RAW = $q('#dlSet').onclick;
$q('#dlGLB').onclick = async e => { if (!state.shirt) return; if (await payDialog()) return GLB_RAW.call($q('#dlGLB'), e); };
$q('#dlSet').onclick = async e => { if (!state.shirt) return; if (await payDialog()) return ZIP_RAW.call($q('#dlSet'), e); };
function paintPearls(){ const n = $q('#pearlNum'); if (n && P()) n.textContent = P().balance().toLocaleString(); ping('pearls'); }
addEventListener('grug:pearls', paintPearls);
function startPearls(){
  if (!P()) return;
  paintPearls();
  P().start().then(r => {
    paintPearls();
    if (r.welcome) toast(`Welcome! You've got ${r.welcome} Pearls to spend on exports.`);
    else if (r.daily) toast(`+${r.daily} daily Pearls${r.gold ? ' (Grug Gold)' : ''}. See you tomorrow!`);
  }).catch(() => {});
}

const api = window.GrugStudio = {
  version: 1, ready: false, agent: AGENT, guide: '/agents/studio/claude.md',
  options, get, set, random: () => set({ random: true }),
  prompt, copyPrompt, copyTemplate, templateDataURL: () => refWhite.toDataURL('image/png'),
  downloadTemplate: () => { download(refWhite, 'roblox-clothing-reference.png'); return 'roblox-clothing-reference.png'; },
  paintOutfit, openPaint: () => paintOutfit(), steps: () => STEPS.map((t, i) => `${i + 1}. ${t}`),
  wear, wearIt, match, finish: () => { C.setCat('finish'); return status(); },
  downloadR6, r6Base64, downloadZip: async o => { needOutfit(o); await payFromApi(o); return ZIP_RAW(); }, r6Script: () => R6_SETUP_LUA,
  _outfitWorn: custom => { outfit.source = custom ? 'pasted' : 'starter'; outfit.worn = !!custom; syncWarn(); },   // used by the outfits layer (src/character/outfits.js)
  status, help: () => `Grug Avatar Studio agent API v2. Guide: ${location.origin}/agents/studio/claude.md\n` +
    'A character is finished only when it wears a custom shirt and pants painted in Gemini.\n' +
    '1. await GrugStudio.set({name, skin, head, hair, hairColor, eyes, brows, mouth})   (GrugStudio.options() lists the choices)\n' +
    '2. await GrugStudio.paintOutfit("<garments, colours, materials, shoes>") and follow the steps it returns (Gemini round trip)\n' +
    '3. Exporting costs ' + FEE() + ' Pearls (re-downloads of the same character are free). Ask the person first, then await GrugStudio.downloadR6(null, { spendPearls: true })\n' +
    'Also: get() · status() · prompt() · wear(image) · wearIt() · downloadZip() · r6Base64() · r6Script()'
};
/* which outfit is on: the starter tee, a demo, or a picture pasted back from an image editor */
const outfit = { source: 'starter', worn: false, demoClick: false };
const _setImage = window.setImage;
window.setImage = function(){ outfit.source = outfit.demoClick ? 'demo' : 'pasted'; outfit.demoClick = false; outfit.worn = false; const r = _setImage.apply(this, arguments); ping('image'); return r; };
$q('#demo').addEventListener('click', () => { outfit.demoClick = true; }, true);
$q('#build').addEventListener('click', () => { outfit.worn = outfit.source === 'pasted'; syncWarn(); ping('wear'); });
$q('#back1').addEventListener('click', () => setTimeout(() => ping('cancel'), 0));
$q('#exGrid').addEventListener('click', () => { outfit.worn = false; outfit.source = 'starter'; }, true);

/* finish page: remind (people and agents) when the painted outfit is missing */
var warn = $q('#noOutfit');
function syncWarn(){ warn.hidden = $q('#s3').hidden || outfit.worn; }
new MutationObserver(syncWarn).observe($q('#s3'), { attributes: true, attributeFilter: ['hidden'] });
$q('#noOutfitGo').onclick = () => paintOutfit();

startPearls();
api.whenReady = (C.sheetsReady || Promise.resolve()).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => { api.ready = true; ping('ready'); return api; });

/* the template picture's Copy button (step 1 of painting) */
$q('#clCopyRef').onclick = copyTemplate;

/* ---------- recipe links: /character/?hair=ponytail&hairColor=blonde&eyes=lashes&outfit=warm+fall+outfit ---------- */
const KEYS = ['name', 'skin', 'body', 'head', 'headSize', 'hair', 'hairColor', 'hairFlip', 'eyes', 'brows', 'mouth', 'browColor', 'outfit', 'look', 'tee', 'view', 'random'];
const qs = new URLSearchParams(location.search), recipe = {};
qs.forEach((v, k) => { const key = KEYS.find(x => x.toLowerCase() === k.toLowerCase().replace(/[-_]/g, '')); if (key) recipe[key] = (key === 'hairFlip' || key === 'random') ? !/^(0|false|no)$/i.test(v) : v; });
if (recipe.outfit != null && recipe.view == null) recipe.view = 'paint';
if (Object.keys(recipe).length) api.whenReady.then(() => set(recipe)).catch(e => { toast(e.message); console.warn('[GrugStudio]', e.message); });

/* ---------- old links: /character/?claude, #claude, ?skill and #skill opened the "Make with Claude" and skill sheets.
   Those live in the developers' section now: send them there (the players' studio has no agent panels). ---------- */
if (!AGENT && (location.hash === '#claude' || qs.has('claude'))) location.replace('/agents/');
else if (!AGENT && (location.hash === '#skill' || qs.has('skill'))) location.replace('/agents/#skills');
})();
