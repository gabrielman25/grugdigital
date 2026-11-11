/* Grug · avatar/nav.js — the avatar editor without scrolling.
   The editor's own controls (built by the SANDY EDITOR script above, wired by id and data attributes) are moved into
   screens; nothing about how they work changes. The panel is:
     - a row of section icons (Body, Face, Hair, Wardrobe, Shoes, Emotes, Save) over a strip of sections you swipe through
     - buttons in a section open a screen of their own on top (with a back arrow): Wardrobe's categories, the sliders
     - a screen that holds more than fits is split into pages you swipe through, with dots
     - lists of pieces (tops, legs, boots, prints, emotes) run sideways in as many rows as fit
     - colours, fabrics and sliders for a piece only show once a piece is picked
   Icons are the site's flat set (Grug.icon). */
(function () {
  'use strict';
  if (/[?&]mode=viewer/.test(location.search) || !window.Grug) return;
  const G = Grug, $ = id => document.getElementById(id), panel = $('panel'), pages = $('pages');
  if (!panel || !pages) return;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  // a group (.grp) of the old tabbed panel, by its page and heading
  const grp = (page, title) => [...$(page).querySelectorAll(':scope > .grp')].find(g => { const h = g.querySelector('h2'); return h && h.textContent.trim().toLowerCase() === title.toLowerCase(); });
  const sliders = g => [...g.querySelectorAll(':scope > .row')].filter(r => r.querySelector('input[type=range],input[type=checkbox]'));
  // slider rows in pages of n
  function sliderPages(rows, n) { const out = []; for (let i = 0; i < rows.length; i += n) { const p = el('div', 'ed-page'); rows.slice(i, i + n).forEach(r => p.appendChild(r)); out.push(p); } return out; }
  // a group's sliders on a screen of their own, in pages of four; they go back to the group when it closes
  function sliderScreen(grpEl) { const rows = sliders(grpEl); const sc = screen(sliderPages(rows, 4)); sc._home = () => rows.forEach(r => grpEl.appendChild(r)); return sc; }
  const page = (...nodes) => { const p = el('div', 'ed-page'); nodes.flat().filter(Boolean).forEach(n => p.appendChild(n)); return p; };
  const label = t => el('p', 'ed-lab', G.esc(t));
  const open = (txt, icon, fn) => { const b = el('button', 'ed-open', G.icon(icon) + '<span>' + G.esc(txt) + '</span>' + G.icon('caret-right')); b.type = 'button'; b.addEventListener('click', fn); return b; };

  /* ---------- the groups we'll need, taken out of the old pages ---------- */
  const g = {
    body: grp('pLook', 'Body'), face: grp('pLook', 'Face'), ears: grp('pLook', 'Ears'), hat: grp('pLook', 'Hat'), rings: grp('pLook', 'Earrings'),
    skin: grp('pLook', 'Skin'), hair: grp('pLook', 'Hair'), nails: grp('pLook', 'Nails'), build: grp('pLook', 'Build'),
    basics: grp('pClothes', 'Shirt and shorts'), print: grp('pClothes', 'Chest print'),
    top: $('pClothes').querySelector('.kit[data-slot=top]'), legs: $('pClothes').querySelector('.kit[data-slot=legs]'),
    shL: $('pClothes').querySelector('.kit[data-slot=shoulderL]'), shR: $('pClothes').querySelector('.kit[data-slot=shoulderR]'),
    ccShirt: $('pCustom').querySelector('[data-cc=shirt]'), ccPants: $('pCustom').querySelector('[data-cc=pants]'),
    feet: $('feetType') && $('feetType').closest('.grp'), ff: $('ffGrp'), boots: $('bootGrp'), bootH: $('bootHGrp'),
    emotes: $('emoGrid') && $('emoGrid').closest('.grp'),
    save: grp('pSave', 'Character file'), json: grp('pSave', 'This Sandy'), share: grp('pSave', 'Share and embed')
  };

  [g.face, g.ears, g.hat, g.rings, g.hair, g.build].forEach(x => x && x.classList.add('ed-hideslide'));   // their sliders open on a screen of their own

  /* ---------- the new panel ---------- */
  document.body.classList.add('ed-nav');
  panel.setAttribute('data-noswipe', '');   // sideways swipes here move between sections, not between the site's tabs
  const top = $('panelTop'), h1 = top.querySelector('h1');
  $('bRandom').innerHTML = G.icon('shuffle'); $('bRandom').setAttribute('aria-label', 'Randomize'); $('bRandom').title = 'Randomize';
  $('bReset').innerHTML = G.icon('arrow-counter-clockwise'); $('bReset').setAttribute('aria-label', 'Reset'); $('bReset').title = 'Reset';
  const back = el('button', 'btn px ed-back', G.icon('arrow-left')); back.type = 'button'; back.setAttribute('aria-label', 'Back'); back.hidden = true;
  top.insertBefore(back, h1);
  $('tabs').hidden = true; pages.hidden = true;

  const bar = el('div', 'ed-bar'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Sections');
  const strip = el('div', 'ed-strip');   // the sections, side by side
  const stack = el('div', 'ed-stack');   // screens opened on top
  const view = el('div', 'ed-view'); view.appendChild(strip); view.appendChild(stack);
  const dots = el('div', 'ed-dots'); dots.setAttribute('aria-hidden', 'true');
  panel.appendChild(bar); panel.appendChild(view); panel.appendChild(dots);

  /* a screen: a column, or pages side by side when it has more than one */
  function screen(pagesList, opts) {
    opts = opts || {};
    const s = el('div', 'ed-screen' + (opts.cls ? ' ' + opts.cls : ''));
    if (pagesList.length > 1) { const pg = el('div', 'ed-pager'); pagesList.forEach(p => pg.appendChild(p)); s.appendChild(pg); s.dataset.pages = pagesList.length; pg.addEventListener('scroll', () => paintDots(), { passive: true }); }
    else if (pagesList[0]) { pagesList[0].classList.add('solo'); s.appendChild(pagesList[0]); }
    return s;
  }

  /* ---------- screens opened on top (the stack) ---------- */
  const opened = [];
  function push(title, s) {
    const holder = el('div', 'ed-push'); holder.appendChild(s); stack.appendChild(holder);
    opened.push({ title, holder }); paintTop(); fit(holder); requestAnimationFrame(() => holder.classList.add('in')); paintDots();
    setTimeout(() => fit(holder), 260);   // again once it has slid in and anything it loads has arrived
  }
  function pop() {
    const o = opened.pop(); if (!o) return;
    o.holder.classList.remove('in'); o.holder.classList.add('out');
    setTimeout(() => { const s = o.holder.firstChild; if (s && s._home) s._home(); o.holder.remove(); }, 220);
    paintTop(); paintDots();
  }
  back.addEventListener('click', () => { pop(); G.ui.buzz(); });
  // a screen made of groups that live elsewhere: they go back to a hidden shelf when it closes, so they can open again
  const shelf = el('div'); shelf.hidden = true; document.body.appendChild(shelf);
  function lend(build) { return () => { const s = build(), prev = s._home; s._home = () => { if (prev) prev(); [...s.querySelectorAll('[data-lent]')].forEach(n => { n.removeAttribute('data-lent'); shelf.appendChild(n); }); }; return s; }; }
  const lent = n => { if (n) n.setAttribute('data-lent', ''); return n; };

  /* ---------- the sections ---------- */
  const SECTIONS = [];
  function section(id, name, icon, build) { SECTIONS.push({ id, name, icon, build }); }

  section('body', 'Body', 'person', () => screen([page(g.body, g.skin, g.nails, open('Body shape', 'arrows-out', () => push('Body shape', sliderScreen(g.build))))]));
  section('face', 'Face', 'smiley', () => screen([page(g.face,
    open('Face shape', 'smiley', () => push('Face shape', sliderScreen(g.face))),
    open('Ears', 'hand', () => push('Ears', sliderScreen(g.ears))))]));
  section('hair', 'Hair', 'scissors', () => screen([page(g.hair, open('Size and position', 'arrows-out', () => push('Hair size and position', sliderScreen(g.hair))))]));
  section('wardrobe', 'Wardrobe', 't-shirt', () => {
    // the categories: tap one for its own screen
    const cats = [
      ['Tops', 't-shirt', () => itemScreen(g.top)], ['Legs', 'pants', () => itemScreen(g.legs)],
      ['Hats', 'baseball-cap', () => chipScreen(g.hat)], ['Earrings', 'sparkle', () => chipScreen(g.rings)],
      ['Prints', 'image', printScreen], ['Shoulders', 'crown-simple', () => screen([page(lent(g.shL)), page(lent(g.shR))], { cls: 'ed-kits' })],
      ['Custom', 'paint-brush', () => screen([page(lent(g.ccShirt)), page(lent(g.ccPants))], { cls: 'ed-cc' })], ['Basics', 'palette', () => screen([page(lent(g.basics))])]
    ];
    const grid = el('div', 'ed-cats');
    cats.forEach(([name, icon, build]) => { const b = el('button', 'ed-cat', '<span class="ic">' + G.icon(icon) + '</span><span>' + name + '</span>'); b.type = 'button';
      b.addEventListener('click', () => { G.ui.buzz(); push(name, lend(build)()); }); grid.appendChild(b); });
    return screen([page(grid)]);
  });
  section('shoes', 'Shoes', 'sneaker', () => screen([page(g.feet, g.ff, open('Choose boots', 'sneaker', () => push('Boots', lend(() => screen([page(lent(g.boots)), page(lent(g.bootH))], { cls: 'ed-kits' }))())))], { cls: 'ed-shoes' }));
  section('emotes', 'Emotes', 'hand-waving', () => screen([page(g.emotes)], { cls: 'ed-emotes' }));
  section('save', 'Save', 'floppy-disk', () => screen([page(g.save, g.share, open('Edit as JSON', 'clipboard-text', () => push('JSON', lend(() => screen([page(lent(g.json))]))())))]));

  // a kit slot (tops, legs …): its pieces run sideways; fabric and tint show once a piece is on
  function itemScreen(kit) { const s = screen([page(lent(kit))], { cls: 'ed-kit1' }); return s; }
  // hats and earrings: the styles, then colour and fit once one is on
  function chipScreen(grpEl) {
    const s = screen([page(lent(grpEl))], { cls: 'ed-chip1' });
    const adj = open('Size and fit', 'arrows-out', () => push('Size and fit', sliderScreen(grpEl)));
    adj.classList.add('ed-after'); grpEl.appendChild(adj);
    s._home = () => adj.remove();
    return s;
  }
  // prints: the whole pack sideways, a search, upload; size and place once one is on
  function printScreen() {
    const pk = $('pk'); if (pk && pk.hidden) $('pkOpen').click();   // loads the print pack
    // more of the pack loads as the row nears its end (no "Show more" button)
    const grid = $('pkGrid'); if (grid && !grid.dataset.more) { grid.dataset.more = '1'; grid.addEventListener('scroll', () => { const m = $('pkMore'); if (m && !m.hidden && grid.scrollLeft + grid.clientWidth > grid.scrollWidth - 200) m.click(); }, { passive: true }); }
    return screen([page(lent(g.print))], { cls: 'ed-print' });
  }

  /* build the strip and the icon bar */
  SECTIONS.forEach((s, i) => {
    const b = el('button', 'ed-tab', G.icon(s.icon) + '<span>' + s.name + '</span>'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.i = i;
    b.addEventListener('click', () => { G.ui.buzz(); go(i); }); bar.appendChild(b);
    const sc = s.build(); sc.classList.add('ed-sec'); sc.dataset.sec = s.id; strip.appendChild(sc);
  });
  let cur = 0;
  // a tapped icon glides the strip there; until it arrives, the sections it passes don't count as picked
  let gliding = -1, glideT = 0;
  function go(i, instant) {
    while (opened.length) pop(); cur = Math.max(0, Math.min(SECTIONS.length - 1, i));
    gliding = instant ? -1 : cur; clearTimeout(glideT); glideT = setTimeout(() => { gliding = -1; }, 700);
    strip.scrollTo({ left: cur * strip.clientWidth, behavior: instant ? 'instant' : 'smooth' }); paint();
  }
  function paint() {
    [...bar.children].forEach((b, k) => b.setAttribute('aria-selected', String(k === cur))); paintTop(); paintDots();
    const t = bar.children[cur]; if (t && bar.scrollWidth > bar.clientWidth) { const l = t.offsetLeft - bar.clientWidth / 2 + t.offsetWidth / 2; bar.scrollLeft = l; }
  }
  function paintTop() { const o = opened[opened.length - 1]; h1.textContent = o ? o.title : SECTIONS[cur].name; back.hidden = !o; bar.classList.toggle('dim', !!o); }
  strip.addEventListener('scroll', () => {
    if (resizing || strip.clientWidth < 40 || strip.clientWidth !== lastW) return;   // hidden or mid-resize: not a swipe
    const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    if (gliding >= 0) { if (i === gliding) gliding = -1; return; }
    // only a finger, mouse or wheel changes the section; the browser re-snapping after a layout change doesn't
    if (!touching && performance.now() - lastTouch > 900) { if (Math.abs(strip.scrollLeft - cur * strip.clientWidth) > 2) strip.scrollLeft = cur * strip.clientWidth; return; }
    if (i !== cur) { cur = i; paint(); }
  }, { passive: true });
  let touching = false, lastTouch = -1e9;
  const down = () => { touching = true; lastTouch = performance.now(); }, up = () => { touching = false; lastTouch = performance.now(); };
  strip.addEventListener('touchstart', down, { passive: true }); strip.addEventListener('pointerdown', down);
  addEventListener('touchend', up, { passive: true }); addEventListener('touchcancel', up, { passive: true }); addEventListener('pointerup', up);
  strip.addEventListener('wheel', () => { lastTouch = performance.now(); }, { passive: true });
  // the dots under a screen that has pages
  function paintDots() {
    const o = opened[opened.length - 1], s = o ? o.holder.firstChild : strip.children[cur], pg = s && s.querySelector(':scope > .ed-pager');
    if (!pg) { dots.innerHTML = ''; dots.hidden = true; return; }
    const n = pg.children.length, k = Math.round(pg.scrollLeft / Math.max(1, pg.clientWidth)); dots.hidden = false;
    dots.innerHTML = Array.from({ length: n }, (_, j) => '<i' + (j === k ? ' class="on"' : '') + '></i>').join('');
  }

  /* ---------- lists of pieces run sideways in as many rows as fit ---------- */
  const ROWS = '.kitgrid,.ccg,#pkGrid,.emogrid';
  function fit(root) {
    for (const grid of (root || panel).querySelectorAll(ROWS)) {
      // rows as tall as fit (pieces are square pictures with a name under them, so a row's height sets their width)
      const cell = grid.matches('.emogrid') ? 98 : grid.matches('#pkGrid') ? 58 : grid.matches('.kitgrid') ? 112 : 104, lab = grid.matches('#pkGrid') ? 0 : grid.matches('.emogrid') ? 0 : 34;
      const h = grid.clientHeight; if (h < 20) continue;
      const rows = Math.max(1, Math.floor((h + 8) / cell)), rh = Math.floor((h - 6 * (rows - 1) - 4) / rows);
      grid.style.setProperty('--rows', rows); grid.style.setProperty('--rh', rh + 'px');
      if (lab) grid.style.setProperty('--cw', Math.max(60, Math.min(118, rh - lab)) + 'px');
      else if (grid.matches('#pkGrid')) grid.style.setProperty('--cw', Math.max(48, Math.min(96, rh)) + 'px');   // prints are square
    }
  }
  // a resize (rotating the phone, its address bar sliding away) keeps the same section: scrolls caused by the new size
  // don't count as a swipe
  let resizing = false, lastW = 0;
  const ro = new ResizeObserver(() => { if (strip.clientWidth < 40) { lastW = -1; return; } resizing = true; lastW = strip.clientWidth; fit(); strip.scrollLeft = cur * strip.clientWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => { strip.scrollLeft = cur * strip.clientWidth; resizing = false; })); });
  ro.observe(view);

  /* ---------- a piece's colours, fabric and fit only once a piece is on ---------- */
  function picked() {
    for (const k of panel.querySelectorAll('.kit,[data-cc]')) {
      const on = !!k.querySelector('[data-part]:not([data-part=""])[aria-pressed=true],.seg [data-g]:not([data-g=""])[aria-pressed=true]');
      k.classList.toggle('has', on);
    }
    requestAnimationFrame(() => fit());
    [[g.hat, '#hats'], [g.rings, '#rings']].forEach(([gr, sel]) => { if (!gr) return; const b = gr.querySelector(sel + ' [aria-pressed=true]'); gr.classList.toggle('has', !!b && !/^none$/i.test(b.dataset.h || b.dataset.r || '')); });
    if (g.print) { const b = g.print.querySelector('[data-d][aria-pressed=true]'); g.print.classList.toggle('has', !!b && b.dataset.d !== 'none'); }
  }
  new MutationObserver(picked).observe(panel, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'], childList: true });
  new MutationObserver(picked).observe(shelf, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  picked();

  // the emote screen's icons: flat ones instead of emoji
  const EMO = { wave: 'hand-waving', dance: 'confetti', disco: 'star', shuffle: 'sneaker', robot: 'cube', cheer: 'confetti', bow: 'hand', flex: 'lightning', jump: 'rocket' };
  function flatEmotes() { for (const b of panel.querySelectorAll('[data-emote] i,#emoLoad span i')) { if (b.dataset.flat) continue; const id = (b.closest('[data-emote]') || {}).dataset; const k = id && id.emote; b.dataset.flat = '1'; b.innerHTML = G.icon(EMO[k] || 'sparkle'); } }
  new MutationObserver(flatEmotes).observe($('emoGrid'), { childList: true }); new MutationObserver(flatEmotes).observe($('emoLoad'), { childList: true }); flatEmotes();

  // #emotes in the address opens that section
  const start = /emotes/i.test(location.hash) ? SECTIONS.findIndex(s => s.id === 'emotes') : 0;
  requestAnimationFrame(() => { go(start, true); fit(); });
})();
