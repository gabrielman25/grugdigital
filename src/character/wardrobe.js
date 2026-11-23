/* ===== Wardrobe: ready-made tops and bottoms (painted in Gemini, in /character/wardrobe/), mix and match =====
   Tops and bottoms are picked separately. With a top on, "Mix arms" swaps the right or left sleeve for one from any
   other top. Built by src/character/wardrobe.py; put into character/index.html by patch_outfits.py. */
(() => {
'use strict';
const $q = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = m => { try { GRUG.toast(m); } catch (e) {} };
const BASE = '/character/wardrobe/';
const anchor = $q('#toPaint'); if (!anchor) return;

const card = document.createElement('div'); card.className = 'g-card card wd'; card.id = 'wdCard';
card.innerHTML = `<div class="wd-head"><h2 class="ttl"><i data-g-icon="pants"></i>Wardrobe</h2><span class="wd-count" id="wdCount"></span></div>
  <div class="wd-tabs" role="tablist"><button role="tab" data-k="top" class="on" aria-selected="true">Tops</button><button role="tab" data-k="bottom" aria-selected="false">Bottoms</button></div>
  <div class="wd-chips" id="wdChips"></div>
  <div class="wd-arms" id="wdArms" hidden>
    <div class="wd-seg" id="wdSeg"><button data-m="whole" class="on">Whole top</button><button data-m="right">Right arm</button><button data-m="left">Left arm</button></div>
    <p class="wd-mix" id="wdMix"></p>
  </div>
  <div class="wd-grid" id="wdGrid"><p class="wd-empty">Loading the wardrobe…</p></div>`;
anchor.insertAdjacentElement('afterend', card);
try { GRUG.hydrate(card); } catch (e) {}

let items = [], themes = [], tab = 'top', theme = 'All', mode = 'whole';
const cur = { top: null, right: null, left: null, bottom: null };
const cache = new Map();
const byId = id => items.find(i => i.id === id);
const src = (it, part) => it.look ? `/character/looks/${it.look}/${part}.png` : `${BASE}${it.id}/${part}.webp`;
const load = u => { if (!cache.has(u)) cache.set(u, new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = cnv(TW, TH); c.getContext('2d').drawImage(i, 0, 0); res(c); }; i.onerror = () => { cache.delete(u); rej(new Error('Could not load ' + u)); }; i.src = u; })); return cache.get(u); };
const LIMB_RECTS = L => Object.values(L);

async function composeTop(){
  const t = byId(cur.top); if (!t) return null;
  const out = cnv(TW, TH), x = out.getContext('2d');
  x.drawImage(await load(src(t, 'shirt')), 0, 0);
  for (const [side, L] of [['right', RLIMB], ['left', LLIMB]]) {
    const o = cur[side] && byId(cur[side]); if (!o) continue;
    const s = await load(src(o, 'shirt'));
    for (const [a, b, w, h] of LIMB_RECTS(L)) { x.clearRect(a, b, w, h); x.drawImage(s, a, b, w, h, a, b, w, h); }
  }
  return out;
}
async function apply(){
  const t = cur.top && byId(cur.top), b = cur.bottom && byId(cur.bottom);
  const shirt = t ? await composeTop() : state.rawShirt || (b && await load(src(b, 'shirt')));
  const pants = b ? await load(src(b, 'pants')) : state.rawPants || (t && await load(src(t, 'pants')));
  // a fresh copy each time, so later edits to the studio's canvases never touch the cached pictures
  const copy = c => { const o = cnv(TW, TH); o.getContext('2d').drawImage(c, 0, 0); return o; };
  state.rawShirt = copy(shirt); state.rawPants = copy(pants); alignedData = null; state.built = true; applyFX();
  if (GrugStudio._outfitWorn) GrugStudio._outfitWorn(true);
  document.querySelectorAll('#exGrid .ex').forEach(o => o.classList.remove('on'));
}

function mixText(){
  const n = id => esc((byId(id) || {}).name || '');
  if (!cur.top) return 'Pick a top first, then swap its sleeves.';
  const parts = [`Top: <b>${n(cur.top)}</b>`];
  parts.push(`Right arm: <b>${cur.right ? n(cur.right) : 'same'}</b>`);
  parts.push(`Left arm: <b>${cur.left ? n(cur.left) : 'same'}</b>`);
  return parts.join(' · ') + ((cur.right || cur.left) ? ' <button class="wd-link" data-a="resetArms">Reset arms</button>' : '');
}
function render(){
  card.querySelectorAll('.wd-tabs button').forEach(b => { const on = b.dataset.k === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const counts = { All: items.length }; items.forEach(i => { counts[i.theme] = (counts[i.theme] || 0) + 1; });
  $q('#wdChips').innerHTML = ['All'].concat(themes.filter(t => counts[t])).map(t => `<button class="wd-chip${t === theme ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  const arms = $q('#wdArms'); arms.hidden = tab !== 'top';
  card.querySelectorAll('#wdSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  $q('#wdMix').innerHTML = mixText();
  const list = items.filter(i => theme === 'All' || i.theme === theme);
  $q('#wdCount').textContent = `${items.length} tops · ${items.length} bottoms`;
  const sel = id => tab === 'bottom' ? id === cur.bottom : mode === 'whole' ? id === cur.top : id === cur[mode];
  $q('#wdGrid').innerHTML = list.map(i => {
    const tags = tab === 'top' ? [cur.right === i.id && 'R', cur.left === i.id && 'L'].filter(Boolean) : [];
    return `<button class="wd-item${sel(i.id) ? ' on' : ''}" data-id="${esc(i.id)}" title="${esc(i.desc)}">
      <img loading="lazy" alt="" src="${BASE}${esc(i.id)}/${tab}.webp">
      ${tags.length ? `<span class="wd-tag">${tags.join(' ')}</span>` : ''}
      <b>${esc(i.name)}</b><small>${esc(i.theme)}</small></button>`; }).join('') || '<p class="wd-empty">Nothing here yet.</p>';
}

card.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || !card.contains(b)) return;
  e.stopPropagation();
  if (b.dataset.k){ tab = b.dataset.k; return render(); }
  if (b.dataset.t){ theme = b.dataset.t; return render(); }
  if (b.dataset.m){ mode = b.dataset.m; if (mode !== 'whole' && !cur.top) { mode = 'whole'; say('Pick a top first'); } return render(); }
  if (b.dataset.a === 'resetArms'){ cur.right = cur.left = null; mode = 'whole'; render(); return apply().catch(() => say("Couldn't change the arms")); }
  const id = b.dataset.id; if (!id) return;
  const it = byId(id);
  if (tab === 'bottom') cur.bottom = id;
  else if (mode === 'whole') { cur.top = id; cur.right = cur.left = null; }
  else cur[mode] = id === cur.top ? null : id;
  render();
  try { await apply(); say(tab === 'bottom' ? `Wearing the ${it.name} bottoms` : mode === 'whole' ? `Wearing the ${it.name} top` : `${mode === 'right' ? 'Right' : 'Left'} arm: ${it.name}`); }
  catch (x) { console.error(x); say("Couldn't open that piece"); }
});

fetch(BASE + 'wardrobe.json').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(w => {
  items = w.items || []; themes = w.themes || [];
  if (typeof EXAMPLES !== 'undefined') for (const i of items) if (!i.look) EXAMPLES.push({ name: i.name, shirt: src(i, 'shirt'), pants: src(i, 'pants') });   // GrugStudio.set({ look: 'Knight' })
  render();
}).catch(() => { $q('#wdGrid').innerHTML = '<p class="wd-empty">The wardrobe didn\'t load.</p>'; });

// for agents
if (window.GrugStudio) Object.assign(window.GrugStudio, {
  wardrobe: () => items.map(i => ({ id: i.id, name: i.name, theme: i.theme, desc: i.desc })),
  wearTop: async (id, o) => { o = o || {}; const f = v => { if (v == null) return null; const i = items.find(i => i.id === v || slugish(i.name) === slugish(v)); if (!i) throw new Error(`No top "${v}". GrugStudio.wardrobe() lists them.`); return i.id; };
    cur.top = f(id); cur.right = f(o.rightArm); cur.left = f(o.leftArm); tab = 'top'; render(); await apply(); return { top: cur.top, rightArm: cur.right || cur.top, leftArm: cur.left || cur.top }; },
  wearBottom: async id => { const i = items.find(i => i.id === id || slugish(i.name) === slugish(id)); if (!i) throw new Error(`No bottoms "${id}". GrugStudio.wardrobe() lists them.`); cur.bottom = i.id; tab = 'bottom'; render(); await apply(); return { bottom: cur.bottom }; },
});
function slugish(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
})();
