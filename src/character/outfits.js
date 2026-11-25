/* ===== My outfits: save characters for the Grug games and pick who you play as =====
   Uses the shared store in /static/outfits.js (GrugOutfits). Saving is free: the .glb stays in this browser for the
   games to read (nothing is downloaded, so no Pearls). The games use their own retro animations and only borrow the
   character's parts and textures. */
(() => {
'use strict';
const O = window.GrugOutfits, $q = s => document.querySelector(s);
if (!O) return;
const sheet = $q('#goSheet'), grid = $q('#goList'), urls = [];
let editing = null;   // { id, name } of the outfit opened for editing
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const png = c => c ? new Promise(r => c.toBlob(r, 'image/png')) : Promise.resolve(null);
const say = m => { try { GRUG.toast(m); } catch (e) {} };

async function snapshot(){
  if (!state.shirt){ try { build(); } catch (e) {} }
  const look = GrugStudio.get(); delete look.face;
  const glb = await buildCharacterGLB();
  return { name: (look.name || 'My character').slice(0, 40), look, glb, preview: await png(renderThumb()),
    shirt: await png(state.rawShirt), pants: await png(state.rawPants), custom: !!GrugStudio.status().customOutfit };
}
async function save(asNew){
  const btns = [$q('#goSave'), $q('#goSaveF')].filter(Boolean); btns.forEach(b => { b.disabled = true; });
  try {
    const snap = await snapshot(), keep = !asNew && editing ? await O.get(editing.id) : null;
    const id = await O.put(Object.assign(keep ? { id: keep.id, created: keep.created } : {}, snap));
    if (!O.active() || /^starter-/.test(O.active())) O.setActive(id);   // your first own character replaces the default
    editing = { id, name: snap.name };
    say(keep ? `Saved changes to ${snap.name}` : `${snap.name} saved for the games`);
    await render(); open();
    return id;
  } catch (e) { console.error(e); say("Couldn't save the outfit here"); throw e; }
  finally { btns.forEach(b => { b.disabled = false; }); }
}
async function edit(id){
  const r = await O.get(id); if (!r) return;
  await GrugStudio.set(Object.assign({}, r.look, { reset: true }));
  if (r.shirt && r.pants){
    const toC = async b => { const bm = await createImageBitmap(b), c = cnv(TW, TH); c.getContext('2d').drawImage(bm, 0, 0); return c; };
    state.rawShirt = await toC(r.shirt); state.rawPants = await toC(r.pants); alignedData = null; state.built = true; applyFX();
    if (GrugStudio._outfitWorn) GrugStudio._outfitWorn(!!r.custom);
  }
  editing = { id: r.id, name: r.name }; close(); say(`Editing ${r.name}. Save it again from My outfits.`);
}
async function render(){
  urls.splice(0).forEach(u => URL.revokeObjectURL(u));
  let list = []; try { list = await O.list(); } catch (e) { grid.innerHTML = `<p class="go-empty">${esc(e.message)}</p>`; return; }
  const act = O.active();
  $q('#goCount').textContent = list.length ? String(list.length) : '';
  $q('#goSaveNew').hidden = !editing;
  $q('#goSave').lastChild.textContent = editing ? `Save changes to ${editing.name}` : 'Save this character';
  if (!list.length){ grid.innerHTML = '<p class="go-empty">No outfits yet. Make a character, then save it here to play as it in the Grug games.</p>'; return; }
  grid.innerHTML = list.map(o => { const u = o.preview ? URL.createObjectURL(o.preview) : ''; if (u) urls.push(u);
    return `<div class="go-card${o.id === act ? ' on' : ''}" data-id="${o.id}">
      ${u ? `<img src="${u}" alt="">` : '<div class="go-noimg"></div>'}
      <b title="${esc(o.name)}">${esc(o.name)}</b>
      ${o.id === act ? '<span class="go-badge">Playing as</span>' : `<button class="g-btn g-btn--primary g-btn--sm" data-a="play">Play as</button>`}
      <div class="go-acts"><button class="g-btn g-btn--sm" data-a="edit">Edit</button><button class="g-btn g-btn--sm" data-a="ren">Rename</button><button class="g-btn g-btn--sm" data-a="del">Delete</button></div>
    </div>`; }).join('') + (act ? '<button class="g-btn g-btn--sm go-none" data-a="none">Play as Grug (the default)</button>' : '');
}
grid.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const card = b.closest('.go-card'), id = card && card.dataset.id, a = b.dataset.a;
  if (a === 'none'){ O.setActive(''); say('You\'ll play as Grug, the default character'); }
  if (a === 'play'){ O.setActive(id); say('You\'ll play as this character in the Grug games'); }
  if (a === 'edit') return edit(id);
  if (a === 'ren'){
    const b2 = card.querySelector('b'), inp = document.createElement('input'); inp.className = 'g-input go-ren'; inp.value = b2.textContent; inp.maxLength = 40; b2.replaceWith(inp); inp.focus(); inp.select();
    const done = async ok => { if (inp.done) return; inp.done = true; if (ok && inp.value.trim()) await O.rename(id, inp.value.trim()); render(); };
    inp.addEventListener('keydown', k => { if (k.key === 'Enter') done(true); if (k.key === 'Escape') done(false); }); inp.addEventListener('blur', () => done(true)); return;
  }
  if (a === 'del'){
    if (!b.dataset.sure){ b.dataset.sure = '1'; b.textContent = 'Sure?'; setTimeout(() => { if (b.isConnected){ delete b.dataset.sure; b.textContent = 'Delete'; } }, 3000); return; }
    await O.remove(id); if (editing && editing.id === id) editing = null; say('Outfit deleted');
  }
  render();
});
function open(){ sheet.classList.add('open'); render(); }
function close(){ sheet.classList.remove('open'); }
$q('#goClose').addEventListener('click', close);
sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('open')) close(); });
for (const id of ['toOutfits', 'toOutfitsM']) { const b = $q('#' + id); if (b) b.addEventListener('click', open); }
$q('#goSave').addEventListener('click', () => save(false).catch(() => {}));
$q('#goSaveNew').addEventListener('click', () => save(true).catch(() => {}));
const f = $q('#goSaveF'); if (f) f.addEventListener('click', () => save(!editing).catch(() => {}));
addEventListener('grug:outfits', () => { if (sheet.classList.contains('open')) render(); else O.list().then(l => { $q('#goCount').textContent = l.length ? String(l.length) : ''; }).catch(() => {}); });
O.list().then(l => { $q('#goCount').textContent = l.length ? String(l.length) : ''; }).catch(() => {});
if (/[?&]outfits\b/.test(location.search) || location.hash === '#outfits') setTimeout(open, 400);

// ---- outfits made for the Grug games (painted in Gemini, in /character/looks/): wearable on anyone's avatar, listed with the ready-made looks
fetch('/character/looks/looks.json').then(r => r.ok ? r.json() : []).then(kit => {
  const grid = $q('#exGrid'); if (!grid || !Array.isArray(kit)) return;
  const toC = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = cnv(TW, TH); c.getContext('2d').drawImage(i, 0, 0); res(c); }; i.onerror = rej; i.src = src; });
  for (const k of kit.filter(k => !k.builtin)) {   // builtin: already one of the studio's own looks
    const shirt = `/character/looks/${k.id}/shirt.png`, pants = `/character/looks/${k.id}/pants.png`;
    if (typeof EXAMPLES !== 'undefined') EXAMPLES.push({ name: k.name, shirt, pants });   // so GrugStudio.set({ look: 'Ranger' }) works too
    const b = document.createElement('button'); b.className = 'ex'; b.innerHTML = `<img alt=""><span>${esc(k.name)}</span><small>from ${esc(k.game)}</small>`; b.querySelector('img').src = shirt;
    b.addEventListener('click', async e => {
      e.stopPropagation();
      try { state.rawShirt = await toC(shirt); state.rawPants = await toC(pants); alignedData = null; state.built = true; applyFX();
        if (GrugStudio._outfitWorn) GrugStudio._outfitWorn(true); grid.querySelectorAll('.ex').forEach(o => o.classList.toggle('on', o === b)); say('Wearing the ' + k.name + ' outfit'); }
      catch (x) { say("Couldn't open that outfit"); }
    });
    grid.prepend(b);
  }
  grid.parentElement.hidden = false;
}).catch(() => {});

// ---- save this character (or find it already saved, or update the one being edited) and play as it: the arcade card and the
//      Grug Studio game (embed.js) both use this
const same = async (a, b) => { if (!a || !b) return !a && !b; if (a.size !== b.size) return false; const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]); const u = new Uint8Array(x), v = new Uint8Array(y); for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false; return true; };
async function saved(snap) {   // an outfit already saved exactly like this one (so trying it twice doesn't fill My outfits with copies)
  const L = JSON.stringify(snap.look);
  for (const o of await O.list()) { const r = await O.get(o.id); if (r && JSON.stringify(r.look) === L && await same(r.shirt, snap.shirt) && await same(r.pants, snap.pants)) return r.id; }
  return null;
}
async function saveAndPlay(){
  try {
    const snap = await snapshot(); let id = null;
    const keep = editing && !/^starter-/.test(editing.id) ? await O.get(editing.id) : null;
    if (keep) id = await O.put(Object.assign({ id: keep.id, created: keep.created }, snap));   // the outfit you're editing: saved with your changes
    else id = (await saved(snap)) || await O.put(snap);
    O.setActive(id); editing = { id, name: snap.name };
    return id;
  } catch (e) { console.error(e); say("Couldn't save the outfit here"); throw e; }
}
// open the outfit they play as, to carry on changing it (a starter look is loaded as a new character, so it's never overwritten)
async function openActive(){
  const a = O.active() || ((await O.get('starter-grug')) ? 'starter-grug' : ''); if (!a) return false;   // nobody picked: Grug, the default
  await edit(a); if (/^starter-/.test(a)) editing = null;
  return true;
}

// ---- Try this avatar out in the arcade (bottom left): save it (or find it already saved), play as it, off to the Arcade
const arc = $q('#toArcade');
if (arc) {
  const SLIDES = [['grug-city-rp-ice-cream-shop', ['skater', 'racer']], ['grug-city-rp-pizza-shop', ['grug', 'ranger']], ['grug-city-rp-salon', ['snow-rider', 'medic']], ['grug-city-rp-aerial-view', ['racer', 'grug', 'skater']]];
  const POS = [['left:4%', 'right:2%'], ['left:6%', 'right:6%'], ['left:2%', 'right:4%'], ['left:-2%', 'left:31%', 'right:-3%']];
  arc.insertAdjacentHTML('afterbegin', SLIDES.map(([bg, figs], i) => `<span class="sl${i ? '' : ' on'}"><span class="bg" style="background-image:url('/static/arcade/${bg}.jpg')"></span>` +
    figs.map((f, k) => `<img src="/static/arcade/${f}.webp" alt="" style="${POS[i][k]}${figs.length > 2 && k === 1 ? ';height:80%' : ''}" loading="lazy">`).join('') + '</span>').join(''));
  // portrait: sit just above the editor panel, wherever its top is
  const panel = $q('#panel'), place = () => { if (!panel || innerWidth > 820) return; const t = panel.getBoundingClientRect().top; arc.style.setProperty('--arc-top', Math.max(70, t - arc.offsetHeight - 10) + 'px'); };
  place(); addEventListener('resize', place); if (panel && window.ResizeObserver) new ResizeObserver(place).observe(panel);
  const sl = [...arc.querySelectorAll('.sl')]; let at = 0;
  setInterval(() => { if (document.hidden || arc.disabled) return; sl[at].classList.remove('on'); at = (at + 1) % sl.length; sl[at].classList.add('on'); }, 3800);
  arc.addEventListener('click', async () => {
    if (arc.disabled) return; arc.disabled = true; arc.classList.add('busy');
    try { await saveAndPlay(); location.href = '/arcade/'; }
    catch (e) { arc.disabled = false; arc.classList.remove('busy'); }
  });
}

// for agents: GrugStudio.saveForGames(), .outfits(), .playAs(id)
if (window.GrugStudio) Object.assign(window.GrugStudio, {
  saveForGames: async name => { if (name != null){ const n = $q('#setName'); n.value = String(name).slice(0, 24); n.dispatchEvent(new Event('input')); } editing = null; const id = await save(true); return { id, playingAs: O.active() === id }; },
  outfits: async () => (await O.list()).map(o => ({ id: o.id, name: o.name, playingAs: o.id === O.active() })),
  playAs: id => { O.setActive(id || ''); return { playingAs: O.active() }; },
  openOutfits: open,
  saveAndPlay, openActive,
});
})();
