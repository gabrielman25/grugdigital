/* Create page: the asset library (a marketplace-style catalog) and the Model Kit call to action.
   Data: window.MK_PRESETS (presets.js) with category / genres / themes / tags per item. 3D + downloads: window.MK (create.js).
   Everything the shopper picks lives in the URL (?q=&cat=&genre=&theme=&type=&tri=&fav=&sort=, #item=model:knight),
   so searches and items can be shared and the back button works. Favourites are kept on this device. */
(function () {
  const G = Grug, P = MK_PRESETS, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = G.esc, I = window.MK_ICONS || {};
  const ic = (n, c) => '<svg class="gi gi-s' + (c ? ' ' + c : '') + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' + (I[n] || '') + '</svg>';
  G.ui.chrome('create');

  /* ---------- the catalogue ---------- */
  const ITEMS = [...P.scenes.map(p => ({ kind: 'scene', ...p })), ...P.models.map(p => ({ kind: 'model', ...p }))];
  // newest first: scenes were added after the models, and later models after earlier ones
  ITEMS.forEach((it, i) => { it.key = it.kind + ':' + it.id; it.added = it.kind === 'scene' ? 1000 - it.order : 500 - it.order; it.featured = i; });
  ITEMS.forEach(it => { try { Object.assign(it, MK.stats(it.kind, it.id)); } catch (e) { it.tris = 0; it.w = it.h = it.d = 0; } it.parts = it.kind === 'scene' ? Object.keys(it.data.parts).length : 1; });
  const uniq = a => [...new Set(a)];
  const CATS = ['Characters', 'Weapons', 'Items', 'Nature', 'Buildings', 'Vehicles', 'Terrain', 'Scenes'].filter(c => ITEMS.some(i => i.category === c));
  ITEMS.forEach(i => { if (!CATS.includes(i.category)) CATS.push(i.category); });
  const CAT_IC = { Characters: 'characters', Weapons: 'weapons', Items: 'items', Nature: 'nature', Buildings: 'buildings', Vehicles: 'vehicles', Terrain: 'terrain', Scenes: 'scenes' };
  const GENRES = uniq(ITEMS.flatMap(i => i.genres)).sort(), THEMES = uniq(ITEMS.flatMap(i => i.themes)).sort(), TAGS = uniq(ITEMS.flatMap(i => i.tags)).sort();
  const TRI = [['any', 'Any'], ['low', 'Under 800'], ['mid', '800 – 2,000'], ['high', 'Over 2,000']];
  const triOk = (t, r) => r === 'any' || (r === 'low' ? t < 800 : r === 'mid' ? t >= 800 && t <= 2000 : t > 2000);
  const thumb = it => 'thumbs/' + (it.kind === 'scene' ? 'scene-' : '') + it.id + '.webp?v=1';
  const size = it => it.w + ' × ' + it.h + ' × ' + it.d;

  /* ---------- favourites (this device) ---------- */
  const FKEY = 'grug.create.favs.v1';
  let favs = new Set(); try { favs = new Set(JSON.parse(localStorage.getItem(FKEY) || '[]')); } catch (e) {}
  const isFav = it => favs.has(it.key);
  function toggleFav(it) { favs.has(it.key) ? favs.delete(it.key) : favs.add(it.key); try { localStorage.setItem(FKEY, JSON.stringify([...favs])); } catch (e) {}
    G.ui.buzz(); G.ui.toast(isFav(it) ? 'Added to favourites' : 'Removed from favourites', { icon: 'heart' }); }

  /* ---------- state <-> URL ---------- */
  const S = { q: '', cat: 'all', genres: new Set(), themes: new Set(), type: 'all', tri: 'any', fav: false, sort: 'relevance' };
  function readURL() {
    const u = new URLSearchParams(location.search);
    S.q = u.get('q') || ''; S.cat = CATS.includes(u.get('cat')) ? u.get('cat') : 'all';
    S.genres = new Set((u.get('genre') || '').split(',').filter(g => GENRES.includes(g)));
    S.themes = new Set((u.get('theme') || '').split(',').filter(t => THEMES.includes(t)));
    S.type = ['model', 'scene'].includes(u.get('type')) ? u.get('type') : 'all';
    S.tri = TRI.some(t => t[0] === u.get('tri')) ? u.get('tri') : 'any';
    S.fav = u.get('fav') === '1'; S.sort = $('#mkSort option[value="' + u.get('sort') + '"]') ? u.get('sort') : 'relevance';
  }
  function writeURL(push) {
    const u = new URLSearchParams();
    if (S.q) u.set('q', S.q); if (S.cat !== 'all') u.set('cat', S.cat);
    if (S.genres.size) u.set('genre', [...S.genres].join(',')); if (S.themes.size) u.set('theme', [...S.themes].join(','));
    if (S.type !== 'all') u.set('type', S.type); if (S.tri !== 'any') u.set('tri', S.tri); if (S.fav) u.set('fav', '1'); if (S.sort !== 'relevance') u.set('sort', S.sort);
    const url = location.pathname + (u.toString() ? '?' + u : '') + location.hash;
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (e) {}
  }

  /* ---------- search ---------- */
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9#\- ]+/g, ' ');
  const toks = q => norm(q).split(/\s+/).filter(Boolean);
  function score(it, terms) {
    if (!terms.length) return 1;
    let total = 0;
    for (const t of terms) {
      let s = 0;
      if (t[0] === '#') { const tag = t.slice(1); if (!tag) continue; s = it.tags.some(x => x === tag) ? 6 : it.tags.some(x => x.startsWith(tag)) ? 4 : 0; }
      else {
        const title = norm(it.title);
        if (title.split(' ').some(w => w === t)) s = 10; else if (title.includes(t)) s = 7;
        else if (it.tags.some(x => x === t)) s = 6; else if (it.tags.some(x => x.startsWith(t))) s = 4;
        else if ([it.category, ...it.genres, ...it.themes].some(x => norm(x).startsWith(t))) s = 3;
        else if (norm(it.blurb).includes(t)) s = 1;
        else if (t.length > 3 && t.endsWith('s') && score(it, [t.slice(0, -1)])) s = 2;   // plurals: "swords" finds "sword"
      }
      if (!s) return 0; total += s;
    }
    return total;
  }
  function results() {
    const terms = toks(S.q);
    let list = ITEMS.map(it => ({ it, s: score(it, terms) })).filter(x => x.s > 0).map(x => (x.it._s = x.s, x.it));
    list = list.filter(it => (S.cat === 'all' || it.category === S.cat) && (S.type === 'all' || it.kind === S.type) &&
      (!S.genres.size || it.genres.some(g => S.genres.has(g))) && (!S.themes.size || it.themes.some(t => S.themes.has(t))) &&
      triOk(it.tris, S.tri) && (!S.fav || isFav(it)));
    const by = { relevance: (a, b) => (b._s - a._s) || (a.featured - b.featured), newest: (a, b) => b.added - a.added, az: (a, b) => a.title.localeCompare(b.title),
      lowpoly: (a, b) => a.tris - b.tris, detail: (a, b) => b.tris - a.tris, size: (a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d) }[S.sort];
    return list.sort(by);
  }

  /* ---------- rendering ---------- */
  const card = it => '<button type="button" class="mk-card" data-key="' + it.key + '" aria-label="' + esc(it.title) + ', free">' +
    '<span class="pic"><img src="' + thumb(it) + '" alt="" loading="lazy" decoding="async" draggable="false">' + (it.kind === 'scene' ? '<span class="kind">Scene</span>' : '') +
    '<span class="mk-fav" role="button" tabindex="-1" data-fav="' + it.key + '" aria-pressed="' + isFav(it) + '" title="Favourite">' + ic('heart') + '</span></span>' +
    '<span class="name">' + esc(it.title) + '</span><span class="mk-by">By Grug Digital<span class="chk" title="Verified creator">' + ic('check') + '</span></span><span class="mk-price">Free</span></button>';
  const count = (pred) => ITEMS.filter(pred).length;
  function filtersHTML() {
    const chips = (list, set, key) => '<div class="mk-checks">' + list.map(v => '<button type="button" data-' + key + '="' + esc(v) + '" aria-pressed="' + set.has(v) + '">' + esc(v) + '</button>').join('') + '</div>';
    const one = (list, cur, key) => '<div class="mk-checks">' + list.map(([v, l]) => '<button type="button" data-' + key + '="' + v + '" aria-pressed="' + (cur === v) + '">' + l + '</button>').join('') + '</div>';
    return '<div class="mk-fgroup"><h3>Category</h3><div class="mk-catlist">' +
      [['all', 'All', 'all', ITEMS.length], ...CATS.map(c => [c, c, CAT_IC[c] || 'cube', count(i => i.category === c)])].map(([v, l, i, n]) =>
        '<button type="button" data-cat="' + esc(v) + '" aria-pressed="' + (S.cat === v) + '">' + ic(i) + esc(l) + '<small>' + n + '</small></button>').join('') + '</div></div>' +
      '<div class="mk-fgroup"><h3>Type</h3>' + one([['all', 'All'], ['model', 'Models'], ['scene', 'Scenes']], S.type, 'type') + '</div>' +
      '<div class="mk-fgroup"><h3>Genre</h3>' + chips(GENRES, S.genres, 'genre') + '</div>' +
      '<div class="mk-fgroup"><h3>Theme</h3>' + chips(THEMES, S.themes, 'theme') + '</div>' +
      '<div class="mk-fgroup"><h3>Triangles</h3>' + one(TRI, S.tri, 'tri') + '</div>' +
      '<div class="mk-fgroup"><h3>Saved</h3><div class="mk-checks"><button type="button" data-favonly="1" aria-pressed="' + S.fav + '">' + ic('heart') + ' Favourites only (' + favs.size + ')</button></div></div>';
  }
  function activeFilters() {
    const a = [];
    if (S.q) a.push(['q', '', '“' + S.q + '”']);
    if (S.cat !== 'all') a.push(['cat', '', S.cat]);
    if (S.type !== 'all') a.push(['type', '', S.type === 'model' ? 'Models' : 'Scenes']);
    S.genres.forEach(g => a.push(['genre', g, g])); S.themes.forEach(t => a.push(['theme', t, t]));
    if (S.tri !== 'any') a.push(['tri', '', TRI.find(t => t[0] === S.tri)[1] + ' tris']);
    if (S.fav) a.push(['fav', '', 'Favourites']);
    return a;
  }
  function render() {
    const list = results(), act = activeFilters();
    $('#mkGrid').innerHTML = list.length ? list.map(card).join('') :
      '<div class="mk-empty" style="grid-column:1/-1"><b>Nothing matches that</b>Try another word, a #tag like <button type="button" class="mk-clear" data-try="#sword">#sword</button>, or <button type="button" class="mk-clear" data-clearall="1">clear the filters</button>.</div>';
    $('#mkStatus').innerHTML = '<span class="mk-count">' + list.length + (list.length === 1 ? ' result' : ' results') + '</span>' +
      act.map(([k, v, l]) => '<button type="button" class="mk-pill" data-rm="' + k + '" data-v="' + esc(v) + '">' + esc(l) + '<span aria-label="Remove">' + ic('x') + '</span></button>').join('') +
      (act.length > 1 ? '<button type="button" class="mk-clear" data-clearall="1">Clear all</button>' : '');
    $('#mkSide').innerHTML = filtersHTML();
    $('#mkCatsChips').innerHTML = [['all', 'All'], ...CATS.map(c => [c, c])].map(([v, l]) => '<button type="button" data-cat="' + esc(v) + '" aria-pressed="' + (S.cat === v) + '">' + esc(l) + '</button>').join('');
    const nf = act.filter(a => a[0] !== 'q' && a[0] !== 'cat').length;
    $('#mkFiltersN').hidden = !nf; $('#mkFiltersN').textContent = nf;
    $('#mkQ').value !== S.q && ($('#mkQ').value = S.q); $('#mkClr').hidden = !S.q; $('#mkSort').value = S.sort;
    const dlgSide = $('dialog .mk-filters-dlg'); if (dlgSide) dlgSide.innerHTML = filtersHTML();
  }
  function update(push) { writeURL(push); render(); }

  /* filters: one handler for the sidebar, the phone chips, the filter sheet and the active-filter pills */
  function onFilterClick(e) {
    const b = e.target.closest('button'); if (!b) return false;
    const d = b.dataset;
    if (d.cat) S.cat = d.cat;
    else if (d.type) S.type = d.type;
    else if (d.tri) S.tri = d.tri;
    else if (d.genre) S.genres.has(d.genre) ? S.genres.delete(d.genre) : S.genres.add(d.genre);
    else if (d.theme) S.themes.has(d.theme) ? S.themes.delete(d.theme) : S.themes.add(d.theme);
    else if (d.favonly) S.fav = !S.fav;
    else if (d.rm) { ({ q: () => S.q = '', cat: () => S.cat = 'all', type: () => S.type = 'all', tri: () => S.tri = 'any', fav: () => S.fav = false, genre: () => S.genres.delete(d.v), theme: () => S.themes.delete(d.v) })[d.rm](); }
    else if (d.clearall) { S.q = ''; S.cat = 'all'; S.type = 'all'; S.tri = 'any'; S.fav = false; S.genres.clear(); S.themes.clear(); }
    else if (d.try) S.q = d.try;
    else return false;
    G.ui.buzz(); update(true); return true;
  }
  ['#mkSide', '#mkCatsChips', '#mkStatus', '#mkGrid'].forEach(s => $(s).addEventListener('click', e => { if (!e.target.closest('.mk-card')) onFilterClick(e); }));
  $('#mkSort').addEventListener('change', () => { S.sort = $('#mkSort').value; update(true); });
  $('#mkFiltersBtn').addEventListener('click', () => {
    G.ui.dialog({ title: 'Filters', html: '<div class="mk-filters-dlg"></div>', actions: [{ label: 'Clear all', kind: 'quiet', value: 'clear' }, { label: 'Show results', kind: 'primary', value: true }],
      onOpen: d => { $('.mk-filters-dlg', d).innerHTML = filtersHTML(); $('.mk-filters-dlg', d).addEventListener('click', e => { if (onFilterClick(e)) e.preventDefault(); }); } })
      .then(v => { if (v === 'clear') onFilterClick({ target: Object.assign(document.createElement('button'), { dataset: { clearall: '1' } }) }); });
  });

  /* ---------- search box with suggestions ---------- */
  const q = $('#mkQ'), sugg = $('#mkSugg'); let sel = -1, opts = [];
  $('#mkSearchIc').outerHTML = ic('search'); $('#mkFiltersIc').outerHTML = ic('sliders'); $('#mkClr').innerHTML = ic('x');
  function suggest() {
    const v = q.value.trim(), t = norm(v).replace(/^#/, '');
    if (!t) { sugg.classList.remove('on'); q.parentElement.setAttribute('aria-expanded', 'false'); opts = []; return; }
    const its = ITEMS.map(it => ({ it, s: score(it, toks(v)) })).filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 5).map(x => ({ type: 'item', it: x.it }));
    const facets = [...CATS.map(c => ['cat', c, 'Category']), ...GENRES.map(g => ['genre', g, 'Genre']), ...THEMES.map(x => ['theme', x, 'Theme']), ...TAGS.map(x => ['tag', x, 'Tag'])]
      .filter(f => norm(f[1]).startsWith(t)).slice(0, 4).map(f => ({ type: f[0], v: f[1], label: f[2] }));
    opts = [...facets, ...its]; sel = -1;
    sugg.innerHTML = opts.length ? opts.map((o, i) => o.type === 'item'
      ? '<button type="button" role="option" data-i="' + i + '"><img src="' + thumb(o.it) + '" alt="">' + esc(o.it.title) + '<small>' + esc(o.it.category) + '</small></button>'
      : '<button type="button" role="option" data-i="' + i + '"><span class="k">' + (o.type === 'tag' ? '#' : ic(o.type === 'cat' ? (CAT_IC[o.v] || 'cube') : 'tag')) + '</span>' + esc(o.v) + '<small>' + o.label + '</small></button>').join('')
      : '<button type="button" disabled style="color:var(--mut)">No matches. Press Enter to search anyway</button>';
    sugg.classList.add('on'); q.parentElement.setAttribute('aria-expanded', 'true');
  }
  function pick(o) {
    sugg.classList.remove('on');
    if (!o) { S.q = q.value.trim(); update(true); return; }
    if (o.type === 'item') { openItem(o.it); return; }
    if (o.type === 'tag') S.q = '#' + o.v; else { S.q = ''; if (o.type === 'cat') S.cat = o.v; else if (o.type === 'genre') S.genres.add(o.v); else if (o.type === 'theme') S.themes.add(o.v); }
    q.value = S.q; update(true); q.blur();
  }
  let qT = 0;
  q.addEventListener('input', () => { suggest(); clearTimeout(qT); qT = setTimeout(() => { S.q = q.value.trim(); update(false); }, 160); });
  q.addEventListener('focus', suggest);
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!opts.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; $$('[role=option]', sugg).forEach((b, i) => b.setAttribute('aria-selected', String(i === sel))); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel >= 0 ? opts[sel] : null); q.blur(); }
    else if (e.key === 'Escape') { sugg.classList.remove('on'); q.blur(); }
  });
  sugg.addEventListener('pointerdown', e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); pick(opts[+b.dataset.i]); } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.mk-search')) sugg.classList.remove('on'); });
  $('#mkClr').addEventListener('click', () => { S.q = ''; q.value = ''; update(true); q.focus(); });
  // "/" jumps to the search box, like most marketplaces
  document.addEventListener('keydown', e => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); q.focus(); } });

  /* ---------- cards ---------- */
  $('#mkGrid').addEventListener('click', e => {
    const f = e.target.closest('[data-fav]');
    if (f) { e.stopPropagation(); const it = ITEMS.find(i => i.key === f.dataset.fav); toggleFav(it); f.setAttribute('aria-pressed', String(isFav(it))); if (S.fav) render(); else $('#mkSide').innerHTML = filtersHTML(); return; }
    const c = e.target.closest('.mk-card'); if (c) openItem(ITEMS.find(i => i.key === c.dataset.key));
  });

  /* ---------- item page ---------- */
  const FMTS = [['glb', 'GLB', 'Unity, Godot, Unreal, Blender and most engines.'], ['obj', 'OBJ', 'A .zip with the .obj and its .mtl colours.'], ['stl', 'STL', 'For 3D printing (no colours).'], ['project', 'Project', 'Open it in Model Kit to change it.']];
  let fmt = 'glb';
  try { const f = localStorage.getItem('grug.create.fmt'); if (FMTS.some(x => x[0] === f)) fmt = f; } catch (e) {}
  function similar(it) {
    return ITEMS.filter(o => o !== it).map(o => ({ o, s: (o.category === it.category ? 3 : 0) + o.tags.filter(t => it.tags.includes(t)).length * 2 + o.themes.filter(t => it.themes.includes(t)).length + o.genres.filter(g => it.genres.includes(g)).length }))
      .filter(x => x.s > 1).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.o);
  }
  async function openItem(it) {
    if (!it) return;
    sugg.classList.remove('on');
    try { history.replaceState(null, '', location.pathname + location.search + '#item=' + it.key); } catch (e) {}
    let v = null, next = null, closeTo = null;
    const proj = it.kind === 'scene' ? '.bash.json' : '.shape.json';
    const link = (k, val) => '<button type="button" data-go="' + k + '" data-v="' + esc(val) + '">' + esc(val) + '</button>';
    const more = similar(it);
    const html = '<div class="mk-ip"><div class="mk-view"><canvas></canvas><span class="hint">Drag to turn</span></div><div class="mk-info">' +
      '<h2>' + esc(it.title) + '</h2><div class="mk-by">By Grug Digital<span class="chk" title="Verified creator">' + ic('check') + '</span></div>' +
      '<div class="mk-buy"><span class="p">Free</span><button type="button" class="g-btn primary" data-get="1">' + ic('download') + 'Get</button></div>' +
      '<div class="mk-fmt" role="radiogroup" aria-label="Download format">' + FMTS.map(f => '<button type="button" role="radio" data-fmt="' + f[0] + '" aria-pressed="' + (fmt === f[0]) + '">' + f[1] + '</button>').join('') + '</div>' +
      '<p class="mk-fmt-note">' + esc((FMTS.find(f => f[0] === fmt) || FMTS[0])[2]) + (fmt === 'project' ? ' (' + proj + ')' : '') + '</p>' +
      '<div class="mk-row"><a class="g-btn" href="modelkit/#' + (it.kind === 'scene' ? 'scene' : 'model') + '=' + it.id + '">' + ic('cube') + 'Edit in Model Kit</a><button type="button" class="g-btn mk-heart" data-heart="1" aria-pressed="' + isFav(it) + '" aria-label="Favourite" title="Favourite">' + ic('heart') + '</button></div>' +
      (it.blurb ? '<p class="mk-desc">' + esc(it.blurb) + '</p>' : '') +
      '<dl class="mk-dets"><dt>Type</dt><dd>' + (it.kind === 'scene' ? 'Scene (' + it.parts + ' parts)' : 'Model') + '</dd>' +
      '<dt>Category</dt><dd>' + link('cat', it.category) + '</dd>' +
      '<dt>Genre</dt><dd>' + it.genres.map(g => link('genre', g)).join(', ') + '</dd>' +
      '<dt>Theme</dt><dd>' + it.themes.map(t => link('theme', t)).join(', ') + '</dd>' +
      '<dt>Size</dt><dd>' + size(it) + ' blocks</dd><dt>Triangles</dt><dd>' + G.fmt(it.tris) + '</dd><dt>Price</dt><dd>Free to use in your games</dd></dl>' +
      '<div class="mk-tags">' + it.tags.map(t => '<button type="button" data-tag="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div></div></div>' +
      (more.length ? '<div class="mk-more"><h3>More like this</h3><div class="mk-grid">' + more.map(card).join('') + '</div></div>' : '');
    await G.ui.dialog({ html, actions: [{ label: 'Close', kind: 'quiet', value: null }], onOpen: d => {
      d.classList.add('mk-item');
      const c = $('.mk-view canvas', d);
      v = new MK.Viewer(c, { spin: 0.45, drag: true });
      if (v.ok) { v.set(MK.mesh(it.kind, it.id)); v.run(); } else c.outerHTML = '<img src="' + thumb(it) + '" alt="">';
      d.addEventListener('click', e => {
        const b = e.target.closest('button, a'); if (!b) return;
        if (b.dataset.get) { MK.download(it.kind, it.id, fmt); G.ui.toast('Downloading ' + it.title + ' (' + (FMTS.find(f => f[0] === fmt) || [])[1] + ')', { icon: 'download-simple' }); G.ui.buzz(); }
        else if (b.dataset.fmt) { e.preventDefault(); fmt = b.dataset.fmt; try { localStorage.setItem('grug.create.fmt', fmt); } catch (x) {}
          $$('[data-fmt]', d).forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('.mk-fmt-note', d).textContent = FMTS.find(f => f[0] === fmt)[2] + (fmt === 'project' ? ' (' + proj + ')' : ''); }
        else if (b.dataset.heart) { e.preventDefault(); toggleFav(it); b.setAttribute('aria-pressed', String(isFav(it))); render(); }
        else if (b.dataset.fav) { e.preventDefault(); e.stopPropagation(); const o = ITEMS.find(i => i.key === b.dataset.fav); toggleFav(o); b.setAttribute('aria-pressed', String(isFav(o))); render(); }
        else if (b.classList.contains('mk-card')) { e.preventDefault(); next = ITEMS.find(i => i.key === b.dataset.key); d.close(''); }
        else if (b.dataset.tag || b.dataset.go) { e.preventDefault(); closeTo = b.dataset.tag ? ['tag', b.dataset.tag] : [b.dataset.go, b.dataset.v]; d.close(''); }
      });
    } });
    if (v) v.stop();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (next) return openItem(next);
    if (closeTo) {
      const [k, val] = closeTo;
      if (k === 'tag') { S.q = '#' + val; } else if (k === 'cat') { S.q = ''; S.cat = val; } else if (k === 'genre') { S.q = ''; S.genres = new Set([val]); } else if (k === 'theme') { S.q = ''; S.themes = new Set([val]); }
      update(true); $('#market').scrollIntoView({ behavior: 'smooth' });
    }
  }

  /* ---------- hero: the knight scene turning slowly (drag to spin it) ---------- */
  const hero = new MK.Viewer($('#heroGL'), { spin: 0.35, drag: true, yaw: 0.5, pitch: 0.28 });
  const knight = ITEMS.find(i => i.key === 'scene:knight') || ITEMS[0];
  if (hero.ok) { hero.set(MK.mesh(knight.kind, knight.id)); hero.run(); } else $('.mk-hero .stage').innerHTML = '<img src="' + thumb(knight) + '" alt="" style="width:100%;height:100%;object-fit:contain">';
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) $('#kitNote').hidden = true;

  /* ---------- boot ---------- */
  readURL(); render();
  addEventListener('popstate', () => { readURL(); render(); });
  const deep = /^#item=(model|scene):([\w-]+)/.exec(location.hash);
  if (deep) setTimeout(() => openItem(ITEMS.find(i => i.key === deep[1] + ':' + deep[2])), 150);
})();
