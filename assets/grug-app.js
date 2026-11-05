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

  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="16" fill="#9BE338"/><path d="M27 50 L37 50 L43 22 Q45 12 34 12 Q23 12 25 22 Z" fill="#1F1A17"/><circle cx="35" cy="18" r="2.4" fill="#9BE338"/><circle cx="30" cy="26" r="2" fill="#9BE338"/></svg>';

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
