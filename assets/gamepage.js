/* Grug · gamepage.js — draws a game's detail page. Each games/<id>/index.html calls GrugGamePage('<id>'). */
window.GrugGamePage = function (id) {
  const G = Grug, C = GrugCatalog, $ = s => document.querySelector(s);
  const g = G.GAMES.find(x => x.id === id);
  if (!g) { document.body.innerHTML = '<p style="padding:40px;font:600 18px sans-serif">That game isn’t on the list. <a href="' + G.url('games/') + '">All games</a></p>'; return; }
  document.title = g.title + ' · Grug';
  G.ui.chrome('games');
  G.ensureSnaps();
  const p = G.points().find(x => x.game.id === g.id);
  const st = G.profile.stats;
  const plays = +(st.plays[g.app] || 0), best = Math.max(+(st.best[g.app] || 0), p ? p.best : 0);
  const items = C.forApp(g.app);
  const live = g.status === 'live' || g.status === 'legacy', legacy = g.status === 'legacy';
  const main = document.createElement('main'); main.className = 'wrap gp';
  main.innerHTML =
    '<a class="gp-back" href="' + G.url('games/') + '">' + G.icon('arrow-left') + 'All games</a>' +
    '<section class="gp-hero">' +
      // the cover is the game's FOSSIL32 box (assets/fossil32/): tap it to pull out the cartridge
      '<div class="gp-cover f32-tile" data-f32="' + g.id + '" role="button" tabindex="0" aria-label="Open the ' + G.esc(g.title) + ' cartridge"><div class="f32-stage"><span class="badge ' + (legacy ? 'legacy' : live ? 'live' : 'soon') + '"' + (legacy ? ' style="background:#6b7280;color:#fff"' : '') + '>' + (legacy ? 'Classic' : live ? 'Live' : 'Demo') + '</span><img class="f32-flat" src="' + G.url((g.box && g.box.art) || g.thumb) + '" alt=""></div></div>' +
      '<div class="gp-head">' +
        '<h1>' + G.esc(g.title) + '</h1>' + (g.subtitle ? '<p class="gp-sub">' + G.esc(g.subtitle) + '</p>' : '') +
        '<div class="row mut"><span class="g-chip">' + G.icon(g.standalone ? 'sparkle' : 'storefront') + G.esc(g.partner) + '</span><span class="g-chip">' + G.icon('game-controller') + G.esc(g.kind) + '</span><span class="g-chip">' + G.icon('map-pin') + G.esc(g.place) + '</span></div>' +
        '<p class="lead">' + G.esc(g.blurb) + '</p>' +
        '<div class="row"><a class="g-btn primary big" id="playBtn" href="' + G.url(g.game || g.play) + '">' + G.icon('play') + (live ? 'Play' : 'Try the demo') + '</a>' +
        (g.storageKey ? '<a class="g-btn" href="' + G.url(g.play) + '#' + (G.appState(g) && G.appState(g).store ? G.esc(G.appState(g).store) + '/rewards' : '') + '">' + G.icon('coins') + 'Rewards</a>' : '') + '</div>' +
        '<div class="gp-stats">' +
          (p ? '<div><b>' + G.fmt(p.points) + '</b><span>' + G.esc(C.APPS[g.app].short) + ' points</span></div>' : '') +
          '<div><b>' + G.fmt(best) + '</b><span>your best</span></div>' +
          '<div><b>' + G.fmt(plays || (p ? p.runs : 0)) + '</b><span>runs played</span></div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="g-section"><div class="g-section-h"><h2>About</h2></div><p class="gp-long">' + G.esc(g.long) + '</p>' +
      (g.features && g.features.length ? '<ul class="gp-feats">' + g.features.map(f => '<li>' + G.esc(f) + '</li>').join('') + '</ul>' : '') +
      '<div class="gp-facts"><div>' + G.icon('smiley') + '<span><b>Your avatar</b>' + G.esc(g.avatar) + '</span></div><div>' + G.icon(g.standalone ? 'pearl' : 'coins') + '<span><b>' + (g.standalone ? 'Power-ups' : 'Earning points') + '</b>' + G.esc(g.earn) + '</span></div></div></section>' +
    (items.length ? '<section class="g-section"><div class="g-section-h"><h2>Custom clothing from ' + G.esc(C.APPS[g.app].short) + '</h2><a href="' + G.url('shop/') + '">Shop</a></div><div class="g-items" id="gpItems">' + items.map(it => G.ui.itemTile(it)).join('') + '</div></section>' : '');
  document.body.insertBefore(main, document.querySelector('.g-tabs'));
  if (!document.querySelector('link[href*="fossil32.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = G.url('assets/fossil32/fossil32.css'); document.head.appendChild(l); }
  if (!document.querySelector('script[src*="fossil32.js"]')) { const m = document.createElement('script'); m.type = 'module'; m.src = G.url('assets/fossil32/fossil32.js'); document.head.appendChild(m); }
  // Play: the cartridge goes into the FOSSIL32 console, then the game opens (plain link if 3D isn't available)
  $('#playBtn').addEventListener('click', e => { if (window.Fossil32 && window.Fossil32.ok && !e.metaKey && !e.ctrlKey) { e.preventDefault(); window.Fossil32.boot(g.id); } });
  main.querySelector('.gp-cover').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && window.Fossil32 && window.Fossil32.ok) { e.preventDefault(); window.Fossil32.open(g.id, e.currentTarget); } });
  G.ui.fillThumbs($('#gpItems'));
  main.addEventListener('click', e => {
    const b = e.target.closest('[data-item]'); if (!b) return;
    location.href = G.url('shop/') + '#' + b.dataset.item;
  });
};
