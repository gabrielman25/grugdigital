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
  const live = g.status === 'live';
  const main = document.createElement('main'); main.className = 'wrap gp';
  main.innerHTML =
    '<a class="gp-back" href="' + G.url('games/') + '">' + G.icon('arrow-left') + 'All games</a>' +
    '<section class="gp-hero">' +
      '<div class="gp-cover" style="background-image:url(' + G.url(g.thumb) + ')"><span class="badge ' + (live ? 'live' : 'soon') + '">' + (live ? 'Live' : 'Preview') + '</span></div>' +
      '<div class="gp-head">' +
        '<h1>' + G.esc(g.title) + '</h1>' +
        '<div class="row mut"><span class="g-chip">' + G.icon('storefront') + G.esc(g.partner) + '</span><span class="g-chip">' + G.icon('game-controller') + G.esc(g.kind) + '</span><span class="g-chip">' + G.icon('map-pin') + G.esc(g.place) + '</span></div>' +
        '<p class="lead">' + G.esc(g.blurb) + '</p>' +
        '<div class="row"><a class="g-btn primary big" id="playBtn" href="' + G.url(g.play) + '">' + G.icon('play') + (live ? 'Play' : 'Try the demo') + '</a>' +
        (g.storageKey ? '<a class="g-btn" href="' + G.url(g.play) + '#' + (G.appState(g) && G.appState(g).store ? G.esc(G.appState(g).store) + '/rewards' : '') + '">' + G.icon('coins') + 'Rewards</a>' : '') + '</div>' +
        '<div class="gp-stats">' +
          (p ? '<div><b>' + G.fmt(p.points) + '</b><span>' + G.esc(C.APPS[g.app].short) + ' points</span></div>' : '') +
          '<div><b>' + G.fmt(best) + '</b><span>your best</span></div>' +
          '<div><b>' + G.fmt(plays || (p ? p.runs : 0)) + '</b><span>runs played</span></div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="g-section"><div class="g-section-h"><h2>About</h2></div><p class="gp-long">' + G.esc(g.long) + '</p>' +
      '<div class="gp-facts"><div>' + G.icon('smiley') + '<span><b>Your avatar</b>' + G.esc(g.avatar) + '</span></div><div>' + G.icon('coins') + '<span><b>Earning points</b>' + G.esc(g.earn) + '</span></div></div></section>' +
    (items.length ? '<section class="g-section"><div class="g-section-h"><h2>Closet items from ' + G.esc(C.APPS[g.app].short) + '</h2><a href="' + G.url('shop/') + '">Shop</a></div><div class="g-items" id="gpItems">' + items.map(it => G.ui.itemTile(it)).join('') + '</div></section>' : '');
  document.body.insertBefore(main, document.querySelector('.g-tabs'));
  G.ui.fillThumbs($('#gpItems'));
  main.addEventListener('click', e => {
    const b = e.target.closest('[data-item]'); if (!b) return;
    location.href = G.url('shop/') + '#' + b.dataset.item;
  });
};
