/* GrugTab: the Grug Arcade's engine for games that play in the browser tab (the 'Plays in Your Tab' category; Sunny Patch).
   A tab game lives in the browser tab: the favicon (16x16) and the page title ARE the game. The page itself shows the
   same tab, drawn big, as a 4:3 screen: a tab-shaped strip of 16x16 tiles (the first tile is the favicon, pixel for pixel),
   the title text after it, and the game's shop / settings UI underneath.

   Tab games are idle games. They must be happy to sit in a background tab for hours:
   - the loop runs on setInterval (requestAnimationFrame stops in background tabs) and steps the game by real elapsed
     time, so browser throttling (1 tick a second, or a minute in Chrome after a while) only makes the steps coarser;
   - progress carries on while the page is closed (up to maxOffline, 24 hours by default), worked out when it's opened again;
   - never nag: no flashing titles, no "come back!", no sounds, no notifications. A quiet "while you were away" note at most.

   Use:
     const scr = GrugTab.screen(document.getElementById('game'), { tiles: 9, url: location.host + location.pathname });
       scr.strip: a <canvas> 16*tiles x 16 (draw your tiles on it; tile 0 is the favicon)
       scr.setTitle(text): the text after the strip on the screen (the real tab title is GrugTab.title)
       scr.body: the element under the tab for your shop UI
     GrugTab.favicon(canvas16)                 set the real favicon from a 16x16 canvas (deduped, crisp at 2x)
     GrugTab.title(text)                       set the real tab title (deduped)
     GrugTab.run({ key, step(dt), render(visible), save() -> object, load(object), snapshot() -> stats, away(before, after, secs),
                 stepSize: 0.5, tick: 250, maxOffline: 86400 })
     GrugTab.menu({ screen: scr, help: html, settings: [{ label, get(), set(v) }], reset() })   the Game Menu (Esc / Menu button)
     GrugTab.fmt(n)                            1234 -> "1.23K"
     GrugTab.outline(ctx, x, y, w, h, color)   adds a 1px outline around the drawn pixels in a box (keeps favicons readable)
*/
(() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- numbers ---------- */
  function fmt(n) {
    n = Math.floor(+n || 0);
    if (Math.abs(n) < 10000) return n.toLocaleString('en-US');
    const U = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = -1; let v = n;
    while (Math.abs(v) >= 1000 && i < U.length - 1) { v /= 1000; i++; }
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1') + U[i];
  }
  function dur(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h) return h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
    return m + 'm' + (s % 60 && m < 10 ? ' ' + (s % 60) + 's' : '');
  }

  /* ---------- pixels ---------- */
  function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; return { cv, ctx }; }
  function outline(ctx, x0, y0, w, h, color) {
    const d = ctx.getImageData(x0, y0, w, h), a = d.data, out = [];
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 40;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) out.push([x, y]);
    ctx.fillStyle = color; for (const [x, y] of out) ctx.fillRect(x0 + x, y0 + y, 1, 1);
  }

  /* ---------- the real tab: favicon and title ---------- */
  let iconLink = null, lastIcon = '', lastTitle = '';
  const big = canvas(32, 32);
  function favicon(cv16) {
    big.ctx.clearRect(0, 0, 32, 32); big.ctx.imageSmoothingEnabled = false; big.ctx.drawImage(cv16, 0, 0, 16, 16, 0, 0, 32, 32);
    const url = big.cv.toDataURL('image/png');
    if (url === lastIcon) return; lastIcon = url;
    if (!iconLink) {
      document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove());
      iconLink = document.createElement('link'); iconLink.rel = 'icon'; iconLink.type = 'image/png'; document.head.appendChild(iconLink);
    }
    iconLink.href = url;
  }
  function title(t) { if (t !== lastTitle) { lastTitle = t; document.title = t; } }

  /* ---------- the 4:3 screen, laid out like the tab ---------- */
  let cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
.tb-wrap{position:fixed;inset:0;display:grid;place-items:center;background:#f4e6ef;overflow:hidden}
.tb-screen{--ink:#4a3a4f;--soft:#8a7590;--line:#e6cfdc;--panel:#fff9f4;--panel2:#fcefe6;--head:#9b6b93;--pink:#ffc2d4;--mint:#bfe8b4;--sky:#cfe4ff;--sun:#ffe7a3;
  position:relative;width:min(100vw,133.333vh,1100px);aspect-ratio:4/3;display:flex;flex-direction:column;background:var(--panel);color:var(--ink);
  font:bold 14px Arial,Helvetica,sans-serif;container-type:size;box-shadow:0 0 0 1px #d9bfcf;overflow:hidden;user-select:none;-webkit-user-select:none}
.tb-screen *{box-sizing:border-box}
.tb-tabbar{flex:none;display:flex;align-items:flex-end;gap:6px;padding:8px 10px 0;background:#f2d3e0}
.tb-tab{position:relative;display:flex;align-items:center;gap:max(6px,1.2cqw);min-width:0;padding:max(6px,1.1cqw) max(10px,1.6cqw);background:var(--panel);border-radius:10px 10px 0 0;flex:0 1 auto}
.tb-strip{display:block;height:max(26px,5.6cqw);image-rendering:pixelated;image-rendering:crisp-edges;flex:none}
.tb-ttl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:max(13px,2.3cqw);color:var(--ink);min-width:0}
.tb-x{flex:none;font-size:max(12px,1.8cqw);color:var(--soft);padding:0 2px}
.tb-plus{flex:none;align-self:center;margin-bottom:6px;font-size:max(14px,2cqw);color:#b08aa8}
.tb-bar{flex:none;display:flex;align-items:center;gap:10px;padding:5px 10px;background:var(--panel);border-bottom:1px solid var(--line);font-size:max(11px,1.5cqw);color:var(--soft)}
.tb-bar .tb-nav{letter-spacing:6px} .tb-url{flex:1;min-width:0;padding:4px 12px;border-radius:999px;background:var(--panel2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:normal}
.tb-menu{flex:none;padding:4px 12px;border:2px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);font:bold max(11px,1.5cqw) Arial,Helvetica,sans-serif;cursor:pointer}
.tb-menu:hover{border-color:#d88aa6}
.tb-body{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
/* the Game Menu (2012 style, in the game's soft colours) */
.tb-gm{position:absolute;inset:0;z-index:50;display:none;place-items:center;background:rgba(74,58,79,.45)}
.tb-gm.on{display:grid}
.tb-gm .box{width:min(92%,380px);max-height:94%;overflow:auto;padding:14px 18px 12px;background:rgba(58,44,62,.94);color:#fff;text-align:center;border-radius:4px}
.tb-gm h2{margin:0 0 12px;font:bold 22px Arial,Helvetica,sans-serif}
.tb-gm button{display:block;width:100%;margin:0 0 8px;padding:9px;border:2px solid #e9dcea;border-radius:4px;background:transparent;color:#fff;font:bold 15px Arial,Helvetica,sans-serif;cursor:pointer}
.tb-gm button:hover,.tb-gm button.first{border-color:#ff6b6b}
.tb-gm .pane{display:none;text-align:left;font:13px/1.45 Arial,Helvetica,sans-serif;margin:0 0 10px}
.tb-gm .pane.on{display:block}
.tb-gm .pane label{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.15);font-weight:bold}
.tb-gm .logo{display:block;width:150px;margin:10px auto 0;opacity:.9}
`;
    document.head.appendChild(s);
  }
  function screen(root, o) {
    css(); o = o || {};
    const tiles = o.tiles || 9;
    root.classList.add('tb-wrap');
    root.innerHTML = `<div class="tb-screen" role="application" aria-label="${esc(o.label || 'Tab game')}">
      <div class="tb-tabbar"><div class="tb-tab"><canvas class="tb-strip" width="${16 * tiles}" height="16" aria-hidden="true"></canvas><span class="tb-ttl"></span><span class="tb-x" aria-hidden="true">✕</span></div><span class="tb-plus" aria-hidden="true">＋</span></div>
      <div class="tb-bar"><span class="tb-nav" aria-hidden="true">‹ › ↻</span><span class="tb-url">${esc(o.url || location.host + location.pathname)}</span><button class="tb-menu" type="button">Menu</button></div>
      <div class="tb-body"></div></div>`;
    const el = root.firstElementChild, strip = el.querySelector('.tb-strip'), ttl = el.querySelector('.tb-ttl');
    const sctx = strip.getContext('2d'); sctx.imageSmoothingEnabled = false;
    let lt = '';
    return { el, strip, ctx: sctx, body: el.querySelector('.tb-body'), menuBtn: el.querySelector('.tb-menu'),
      setTitle(t) { if (t !== lt) { lt = t; ttl.textContent = t; } } };
  }

  /* ---------- the Game Menu ---------- */
  function menu(o) {
    const scr = o.screen, gm = document.createElement('div');
    gm.className = 'tb-gm'; gm.setAttribute('role', 'dialog'); gm.setAttribute('aria-label', 'Game Menu');
    gm.innerHTML = `<div class="box"><h2>Game Menu</h2>
      <button type="button" class="first" data-a="resume">Resume Game</button>
      <button type="button" data-a="settings">Game Settings</button><div class="pane" data-p="settings"></div>
      <button type="button" data-a="help">Help</button><div class="pane" data-p="help">${o.help || ''}</div>
      ${o.reset ? '<button type="button" data-a="reset">Start Over</button>' : ''}
      <button type="button" data-a="leave">Leave Game</button>
      <img class="logo" src="/static/arcade/grug-digital-logo.png" alt="Grug Digital"></div>`;
    scr.el.appendChild(gm);
    const pane = n => gm.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.p === n && !p.classList.contains('on')));
    const fill = () => {
      gm.querySelector('[data-p="settings"]').innerHTML = (o.settings || []).map((s, i) => `<label>${esc(s.label)}<input type="checkbox" data-s="${i}"${s.get() ? ' checked' : ''}></label>`).join('') || 'Nothing to set.';
    };
    const open = on => { gm.classList.toggle('on', on); if (on) { fill(); gm.querySelectorAll('.pane').forEach(p => p.classList.remove('on')); gm.querySelector('[data-a="resume"]').focus(); } };
    gm.addEventListener('change', e => { const i = e.target.dataset.s; if (i != null) o.settings[i].set(e.target.checked); });
    gm.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) { if (e.target === gm) open(false); return; }
      const k = a.dataset.a;
      if (k === 'resume') open(false);
      else if (k === 'settings' || k === 'help') pane(k);
      else if (k === 'reset') { if (confirm('Start your whole game over from the beginning? This can\'t be undone.')) { o.reset(); open(false); } }
      else if (k === 'leave') location.href = '/arcade/';
    });
    scr.menuBtn.addEventListener('click', () => open(!gm.classList.contains('on')));
    addEventListener('keydown', e => { if (e.key === 'Escape') open(!gm.classList.contains('on')); });
    return { open, close: () => open(false) };
  }

  /* ---------- the loop (keeps going in background tabs; catches up after the page was closed) ---------- */
  if (!window.GrugLoopErrors) window.GrugLoopErrors = 0;   // (a 3D game replaces it with its own Map of frame errors: both are counted)
  function run(o) {
    const stepSize = o.stepSize || 0.5, tickMs = o.tick || 250, maxOffline = o.maxOffline == null ? 86400 : o.maxOffline;
    const KEY = o.key; let seen = 0, lastErr = '';
    const fail = (e, where) => { const G = window.GrugLoopErrors; if (G instanceof Map) G.set('GrugTab ' + where, (G.get('GrugTab ' + where) || 0) + 1); else window.GrugLoopErrors = (G | 0) + 1; const m = String(e && e.stack || e); if (m !== lastErr) { lastErr = m; console.error('GrugTab ' + where + ' error (the game keeps running):', e); } };
    const simulate = secs => { let left = secs; while (left > 1e-6) { const h = Math.min(stepSize, left); try { o.step(h); } catch (e) { fail(e, 'step'); } left -= h; } };
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: o.save() })); } catch (e) {} };
    let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (saved && saved.data) { try { o.load(saved.data); } catch (e) { fail(e, 'load'); } }
    let last = Date.now();
    // progress while the page was closed
    if (saved && saved.at) {
      const secs = Math.min(maxOffline, Math.max(0, (Date.now() - saved.at) / 1000));
      if (secs > 2) { const before = o.snapshot ? o.snapshot() : null; simulate(secs); if (o.away && secs >= 30) try { o.away(before, o.snapshot(), secs, true); } catch (e) { fail(e, 'away'); } }
    }
    // a tab left in the background: the same quiet note when you look again
    let hiddenAt = 0, hiddenSnap = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); hiddenSnap = o.snapshot ? o.snapshot() : null; write(); }
      else if (hiddenAt) { tick(); const secs = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; if (o.away && secs >= 60) try { o.away(hiddenSnap, o.snapshot(), secs, false); } catch (e) { fail(e, 'away'); } }
    });
    addEventListener('pagehide', write);
    function tick() {
      const now = Date.now(); let dt = (now - last) / 1000; last = now;
      if (dt < 0) dt = 0; if (dt > maxOffline) dt = maxOffline;
      simulate(dt);
      try { o.render(!document.hidden); } catch (e) { fail(e, 'render'); }
      if (now - seen > 5000) { seen = now; write(); }
    }
    setInterval(tick, tickMs);
    tick();
    return { save: write, tick, wipe() { try { localStorage.removeItem(KEY); } catch (e) {} } };
  }

  window.GrugTab = { fmt, dur, esc, canvas, outline, favicon, title, screen, menu, run };
})();
