/* Grug · grug-app.js — the Grug layer inside a partner rewards app (play/<name>/index.html)
   Loads after catalog.js, icons.js, games.js and grug.js. The app's own script calls GrugApp.init(...) at the end
   and a few hooks: GrugApp.onScore(msg), GrugApp.onCheckin(), GrugApp.gameExtras() (added to the game state).
   three.js + avatar3d.js are loaded on demand (closet thumbnails, avatar chip) so the app stays light. */
(function (root) {
  'use strict';
  const G = root.Grug, C = root.GrugCatalog;
  const ROOT = G.ROOT;
  const $ = s => document.querySelector(s);
  let A = null;        // app bridge given by init()
  let threeReady = null;

  function loadThree() {
    if (root.GrugAvatar) return Promise.resolve();
    if (threeReady) return threeReady;
    threeReady = new Promise((ok, no) => {
      const add = (src, cb) => { const s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = () => no(new Error('failed ' + src)); document.head.appendChild(s); };
      add(ROOT + 'assets/three.min.js', () => add(ROOT + 'assets/avatar3d.js', () => ok()));
    });
    return threeReady;
  }

  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="16" fill="#9BE338"/><path d="M19.8 51C19.5 50.9 18.9 50.9 18.4 50.9C17.2 50.9 17.1 50.7 17 48.6C16.8 46.5 17 45.5 17.9 43.8C18.1 43.3 18.3 42.8 18.3 42.8C18.3 42.6 19 41.2 19.3 40.7C19.8 39.8 19.8 39.8 19.7 39.6C19.5 38.9 19.2 38.3 18.8 37.8C17.9 36.4 17.6 35.3 17.7 34C17.8 32.5 18.1 32 19.1 31.1C19.5 30.8 19.9 30.5 20 30.5C20.5 30 21.2 29.7 21.7 29.7C22.5 29.7 22.8 29.4 22.8 28.8C22.8 27.9 23.5 28.4 23.6 29.3C23.6 30 23.1 30.5 21.7 30.8C20.7 31 20.2 33 21 33.9C21.9 35 25.6 34.7 26.6 33.5C26.6 33.4 26.7 33.4 26.7 33.4C26.8 33.4 27 33.3 27.3 33.2C27.5 33.1 28 32.9 28.2 32.8C29.5 32.4 29.8 32.4 30 32.4C30 32.4 30.3 32.3 30.5 32.2C31 32.1 31.5 32 33 31.9C34.8 31.8 35.5 31.7 35.8 31.6C35.9 31.5 36.2 31.4 36.4 31.4C37.8 31 38.2 30.7 39 29.2C39.6 28.1 39.6 25.4 39 24.6C38.9 24.5 38.8 24.4 38.8 24.4C38.8 24.3 38.1 23 37.9 22.8C37.8 22.7 37.3 22.4 36.8 22.1C36.3 21.8 35.8 21.5 35.7 21.5C35.3 21.2 33.8 20.9 32.9 20.9C32.5 20.9 32 20.9 31.9 20.8C31.8 20.8 31.5 20.7 31.3 20.7C30.3 20.5 30 20.3 29.2 19.5C28 18.3 27.9 17.7 28.3 15.9C28.4 15.7 28.5 15.4 28.5 15.3C28.6 15.2 28.7 15 28.7 14.9C29.1 14.2 29.8 13.4 30.4 13.3C31.1 13.1 31.3 13.1 32.3 13C33.2 13 34.1 13.1 34.9 13.3C35.2 13.3 35.6 13.4 35.8 13.5C36.7 13.6 37.3 13.8 38.7 14.4C39.5 14.7 40.5 15.4 41.3 16.1C41.5 16.2 41.9 16.5 42.1 16.6C42.2 16.8 42.5 17 42.6 17.1C42.7 17.3 42.9 17.5 43 17.6C43.3 18 43.8 18.7 44 19.2C44.1 19.5 44.3 19.9 44.5 20.1C44.6 20.3 44.8 20.6 44.8 20.9C44.9 21.1 45.1 21.4 45.3 21.7C45.5 21.9 45.6 22.2 45.7 22.3C45.7 22.4 45.8 22.7 45.8 22.9C45.9 23.1 46 23.6 46.1 23.9C46.2 24.2 46.4 24.6 46.4 24.7C46.6 25.2 46.8 26.3 46.9 26.8C46.9 27 47 27.4 47 27.7C47.1 28.3 47.1 32.1 46.9 32.4C46.9 32.5 46.9 33.2 46.9 34C46.9 34.8 46.9 35.6 46.8 35.8C46.8 36 46.7 36.3 46.7 36.5C46.6 36.9 46.5 37.4 46.4 37.7C46.3 37.8 46.3 38.1 46.2 38.3C46.2 38.6 46.1 38.9 46.1 39C46 39.1 46 39.3 45.9 39.5C45.6 40.7 45.3 41.5 45 42.3C45 42.4 44.9 42.7 44.8 43C44.7 43.4 44.5 43.9 44.3 44.3C44.1 44.7 43.9 45.2 43.8 45.5C43.7 45.8 43.6 46.1 43.5 46.2C43.5 46.2 43.5 46.3 43.5 46.3C43.5 46.4 43.4 46.5 43.3 46.7C43.2 46.8 43.1 47.1 43 47.2C43 47.3 42.9 47.5 42.8 47.7C42.6 47.9 42.4 48.3 42.3 48.6C41.1 50.8 41.2 50.8 38.3 50.8C34.9 50.8 34.8 50.7 34.8 49.5C34.8 49 34.8 48.8 34.7 48.6C33.3 46.1 32.8 45.5 31.8 45.2C31.6 45.1 31.3 45 31.1 45C30.4 44.8 29.9 44.9 28.2 45.4C27.2 45.7 26 46.8 26 47.5C26 47.6 26 47.7 26 47.7C25.9 47.8 25.9 48 25.8 48.2C25.8 48.4 25.6 48.8 25.4 49.1C25.3 49.4 25.2 49.7 25.2 49.7C25.2 50.3 24.3 50.8 23.4 50.8C23 50.9 22.5 50.9 22.3 50.9C22 51 20.6 51 19.8 51Z" fill="#1F1A17"/></svg>';

  /* ---------- top bar chips ---------- */
  function chips() {
    const bar = $('#topbar'); if (bar && !bar.querySelector('.grug-home')) {
      const a = document.createElement('a'); a.className = 'grug-home press'; a.href = ROOT; a.setAttribute('aria-label', 'Grug home'); a.innerHTML = LOGO;
      bar.insertBefore(a, bar.firstChild);
      const r = bar.querySelector('.tb-r'); const me = document.createElement('a'); me.className = 'grug-chip press'; me.href = ROOT + 'avatar/'; me.setAttribute('aria-label', 'Your avatar'); me.innerHTML = LOGO;
      (r || bar).appendChild(me);
    }
    const pick = $('#vPick'); if (pick && !pick.querySelector('.grug-pickbar')) {
      const d = document.createElement('div'); d.className = 'grug-pickbar';
      d.innerHTML = '<a href="' + ROOT + '">' + LOGO.replace('<svg ', '<svg style="width:26px;height:26px" ') + '<span>Grug</span></a><span class="sp"></span><a href="' + ROOT + 'avatar/">' + (G.icon ? G.icon('t-shirt') : '') + '<span>Avatar</span></a>';
      pick.insertBefore(d, pick.firstChild);
    }
    paintChip();
  }
  function paintChip() {
    const me = $('.grug-chip'); if (!me) return;
    const s = G.snaps(); me.innerHTML = s ? '<img alt="" src="' + s.bust + '">' : LOGO;
    const f = $('.grug-me-face'); if (f && s) { if (f.tagName === 'IMG') f.src = s.bust; else { const im = document.createElement('img'); im.className = 'grug-me-face'; im.alt = ''; im.src = s.bust; f.replaceWith(im); } }
  }

  /* ---------- closet ---------- */
  function closetHTML() {
    const s = G.snaps();
    return '<div class="rw-h"><h2>Closet</h2><small>Clothes for your Grug avatar,<br>earned right here</small></div>' +
      '<div class="grug-me card">' + (s ? '<img class="grug-me-face" alt="" src="' + s.bust + '">' : '<span class="grug-me-face empty">' + LOGO + '</span>') + '<div class="tx"><b>' + G.esc(G.profile.name) + '</b><span>Wear what you earn here in every Grug game</span></div><a class="btn press" href="' + ROOT + 'avatar/">Dress up</a></div>' +
      '<div class="g-items" id="closetItems"></div>';
  }
  function renderCloset() {
    const box = $('#closet'); if (!box || !A) return;
    const items = C.forApp(A.app);
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    if (!box.querySelector('#closetItems')) box.innerHTML = closetHTML();
    else { const b = box.querySelector('.grug-me .tx b'); if (b) b.textContent = G.profile.name; }
    const st = A.get();
    const grid = box.querySelector('#closetItems');
    grid.innerHTML = items.map(it => G.ui.itemTile(it, { canBuy: true })).join('');
    loadThree().then(() => { G.ensureSnaps(); paintChip(); G.ui.fillThumbs(grid); }).catch(() => {});
  }
  async function openItem(id) {
    const it = C.get(id); if (!it || !A) return;
    const st = A.get(), owned = G.owns(id), wearing = G.profile.avatar[it.slot] === id, pr = G.progress(it);
    const short = C.APPS[A.app].short;
    let how, actions = [{ label: 'Close', kind: 'quiet', value: null }];
    if (owned) { how = wearing ? 'You’re wearing it.' : 'It’s yours. Put it on?'; if (!wearing) actions.push({ label: 'Wear it', kind: 'primary', value: 'wear' }); }
    else if (it.get.type === 'points') {
      const can = st.points >= it.get.cost;
      how = '<b>' + it.get.cost + ' ' + G.esc(short) + ' points</b>. You have ' + G.fmt(st.points) + '.' + (can ? '' : ' Check in on your next visit to earn more.');
      actions.push({ label: 'Unlock for ' + it.get.cost, kind: 'primary', value: can ? 'buy' : null, disabled: !can });
    } else { how = G.esc(it.get.text) + (pr ? ' <span class="mut">(' + G.fmt(pr.have) + ' of ' + G.fmt(pr.need) + ' so far)</span>' : ''); }
    let thumb = '';
    try { await loadThree(); thumb = root.GrugAvatar.thumb(id, G.profile.avatar, 160); } catch (e) {}
    const pick = await G.ui.dialog({ title: it.name, html: '<div class="row"><span style="width:104px;height:104px;flex:none;border-radius:14px;background:var(--g-card2) center/cover no-repeat;background-image:url(' + thumb + ')"></span><div><div class="g-tag" style="margin-bottom:8px">' + G.esc(C.slotName(it.slot)) + '</div><div>' + how + '</div>' + (pr && !owned ? '<div class="g-prog" style="margin-top:10px"><i style="width:' + pr.pct + '%"></i></div>' : '') + '</div></div>', actions: actions.filter(a => !a.disabled) });
    if (pick === 'wear') { G.equip(id); G.ensureSnaps(true); G.ui.toast('Wearing ' + it.name, { icon: 'check' }); A.buzz && A.buzz(); renderCloset(); paintChip(); A.sendGameState && A.sendGameState(); }
    else if (pick === 'buy') {
      const s2 = A.get(); if (s2.points < it.get.cost) return G.ui.toast('Not enough points yet', { icon: 'warning-circle' });
      s2.points -= it.get.cost; A.hist && A.hist('Closet · ' + it.name, -it.get.cost); A.save(); G.grant(id, 'points');
      A.renderPoints && A.renderPoints(true); A.renderRewards && A.renderRewards(); A.buzz && A.buzz([10, 40, 18]); A.sendGameState && A.sendGameState();
      G.ui.toast('Unlocked: ' + it.name, { icon: 'confetti', ms: 3500 });
      const wear = await G.ui.dialog({ title: 'Unlocked!', html: '<b>' + G.esc(it.name) + '</b> is in your closet. Wear it now?', actions: [{ label: 'Later', kind: 'quiet', value: null }, { label: 'Wear it', kind: 'primary', value: 'wear' }] });
      if (wear === 'wear') { G.equip(id); G.ensureSnaps(true); paintChip(); A.sendGameState && A.sendGameState(); }
      renderCloset();
    }
  }

  /* ---------- stats hooks ---------- */
  function onScore(d, opts) {
    if (!A) return;
    const won = [];
    if (!opts || opts.play !== false) won.push(...G.track(A.app, 'plays', 1));
    const score = Math.max(0, Math.floor(+d.score || 0)); if (score) won.push(...G.track(A.app, 'best', score, 'max'));
    if (d.level) won.push(...G.track(A.app, 'course', +d.level || 0, 'max'));
    if (won.length) { G.celebrate(won); renderCloset(); A.sendGameState && A.sendGameState(); }
  }
  function onCheckin() {
    if (!A) return;
    const won = G.track(A.app, 'checkins', 1);
    if (won.length) { setTimeout(() => G.celebrate(won), 1500); renderCloset(); }
  }
  // Players who used the app before Grug: count what they already did, once.
  function backfill() {
    const key = 'backfill-' + A.app; if (G.profile.seen[key]) return;
    const st = A.get() || {};
    const runs = +(st.game && st.game.runs) || 0, best = +(st.game && st.game.best) || 0;
    const visits = Array.isArray(st.history) ? st.history.filter(h => h && h.pts > 0).length : 0;
    const s = G.profile.stats;
    if (runs > (+s.plays[A.app] || 0)) s.plays[A.app] = runs;
    if (best > (+s.best[A.app] || 0)) s.best[A.app] = best;
    if (visits > (+s.checkins[A.app] || 0)) s.checkins[A.app] = visits;
    G.profile.seen[key] = Date.now();
    const won = G.checkMilestones(); G.save('backfill');
    if (won.length) setTimeout(() => G.celebrate(won), 1200);
  }
  function gameExtras() { return { avatar: G.profile.avatar, player: G.profile.name, look: look(), grug: ROOT }; }
  // A flat, catalog-free version of the look for games that draw their own character (Take a Tea's voxel rig)
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function look() {
    const a = G.profile.avatar, it = s => C.get(a[s]);
    const sh = it('shirt'), pa = it('pants'), ha = it('hat'), hr = it('hair'), bk = it('back'), hd = it('hand');
    return {
      skin: hexRgb(a.skin), shirt: hexRgb(sh && sh.colors ? sh.colors[0] : a.shirtColor), pants: hexRgb(pa && pa.colors ? pa.colors[0] : a.pantsColor),
      hair: hr ? { kind: hr.kind, color: hexRgb(a.hairColor) } : null,
      hat: ha ? { kind: ha.kind, colors: (ha.colors || [a.hatColor]).map(hexRgb) } : null,
      back: bk ? { kind: bk.kind, color: hexRgb(bk.colors ? bk.colors[0] : a.backColor) } : null,
      hand: hd ? hd.kind : null, name: G.profile.name
    };
  }
  function onPlay() { if (!A) return; const won = G.track(A.app, 'plays', 1); if (won.length) { G.celebrate(won); renderCloset(); A.sendGameState && A.sendGameState(); } }

  function init(bridge) {
    A = bridge; chips(); backfill(); renderCloset();
    document.addEventListener('click', e => { const b = e.target.closest('#closet [data-item]'); if (b) { e.preventDefault(); openItem(b.dataset.item); } });
    root.addEventListener('grug:change', e => { const w = e.detail && e.detail.what; if (w === 'external' || w === 'import' || w === 'reset') { renderCloset(); paintChip(); A.sendGameState && A.sendGameState(); } if (w === 'snaps') paintChip(); });
    if (!$('#g-toast')) { const t = document.createElement('div'); t.id = 'g-toast'; t.className = 'g-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  }

  root.GrugApp = { init, onScore, onPlay, onCheckin, gameExtras, look, renderCloset, loadThree, avatar: () => G.profile.avatar, name: () => G.profile.name };
})(window);
