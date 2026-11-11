/* Grug · guest.js — guest mode for a Grug game played off the site (the itch.io builds). Needs bridge.js first.
   It only ever acts when GrugBridge.mode is 'guest' (no trusted Grug host answered). In platform mode nothing appears.

   - Guest profile: localStorage 'grug.guest.v1' on this device only, never sent anywhere:
       { v:1, name:'Guest' + 4 digits, avatar:null (null = the avatar runtime's default look), created, welcomed }
     The game's wallet and power-ups stay in its existing demo save, as before.
   - Welcome pop-up: once per browser (welcomed), before play starts. "Make my character" opens the avatar editor on the
     site in a new tab; "Play as guest", Escape or a tap outside closes it. GrugGuest.gate() resolves once it's closed, so
     the game can wait for it before the run starts; if play has already started, opts.pause() is called instead.
   - Banner: a slim bar across the top with the guest's name and a "Play on Grug" link (new tab). The game sits below it
     (the wrapper page lays them out in a column), so it never covers the game's UI. Players can't hide it.

   GrugGuest.mount({ into: element the banner goes first in, id, title, pause() })
*/
(function (root) {
  'use strict';
  const KEY = 'grug.guest.v1';
  const SITE = 'https://grugdigital.pages.dev';
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="16" fill="#9BE338"/><path d="M19.8 51C19.5 50.9 18.9 50.9 18.4 50.9C17.2 50.9 17.1 50.7 17 48.6C16.8 46.5 17 45.5 17.9 43.8C18.1 43.3 18.3 42.8 18.3 42.8C18.3 42.6 19 41.2 19.3 40.7C19.8 39.8 19.8 39.8 19.7 39.6C19.5 38.9 19.2 38.3 18.8 37.8C17.9 36.4 17.6 35.3 17.7 34C17.8 32.5 18.1 32 19.1 31.1C19.5 30.8 19.9 30.5 20 30.5C20.5 30 21.2 29.7 21.7 29.7C22.5 29.7 22.8 29.4 22.8 28.8C22.8 27.9 23.5 28.4 23.6 29.3C23.6 30 23.1 30.5 21.7 30.8C20.7 31 20.2 33 21 33.9C21.9 35 25.6 34.7 26.6 33.5C26.6 33.4 26.7 33.4 26.7 33.4C26.8 33.4 27 33.3 27.3 33.2C27.5 33.1 28 32.9 28.2 32.8C29.5 32.4 29.8 32.4 30 32.4C30 32.4 30.3 32.3 30.5 32.2C31 32.1 31.5 32 33 31.9C34.8 31.8 35.5 31.7 35.8 31.6C35.9 31.5 36.2 31.4 36.4 31.4C37.8 31 38.2 30.7 39 29.2C39.6 28.1 39.6 25.4 39 24.6C38.9 24.5 38.8 24.4 38.8 24.4C38.8 24.3 38.1 23 37.9 22.8C37.8 22.7 37.3 22.4 36.8 22.1C36.3 21.8 35.8 21.5 35.7 21.5C35.3 21.2 33.8 20.9 32.9 20.9C32.5 20.9 32 20.9 31.9 20.8C31.8 20.8 31.5 20.7 31.3 20.7C30.3 20.5 30 20.3 29.2 19.5C28 18.3 27.9 17.7 28.3 15.9C28.4 15.7 28.5 15.4 28.5 15.3C28.6 15.2 28.7 15 28.7 14.9C29.1 14.2 29.8 13.4 30.4 13.3C31.1 13.1 31.3 13.1 32.3 13C33.2 13 34.1 13.1 34.9 13.3C35.2 13.3 35.6 13.4 35.8 13.5C36.7 13.6 37.3 13.8 38.7 14.4C39.5 14.7 40.5 15.4 41.3 16.1C41.5 16.2 41.9 16.5 42.1 16.6C42.2 16.8 42.5 17 42.6 17.1C42.7 17.3 42.9 17.5 43 17.6C43.3 18 43.8 18.7 44 19.2C44.1 19.5 44.3 19.9 44.5 20.1C44.6 20.3 44.8 20.6 44.8 20.9C44.9 21.1 45.1 21.4 45.3 21.7C45.5 21.9 45.6 22.2 45.7 22.3C45.7 22.4 45.8 22.7 45.8 22.9C45.9 23.1 46 23.6 46.1 23.9C46.2 24.2 46.4 24.6 46.4 24.7C46.6 25.2 46.8 26.3 46.9 26.8C46.9 27 47 27.4 47 27.7C47.1 28.3 47.1 32.1 46.9 32.4C46.9 32.5 46.9 33.2 46.9 34C46.9 34.8 46.9 35.6 46.8 35.8C46.8 36 46.7 36.3 46.7 36.5C46.6 36.9 46.5 37.4 46.4 37.7C46.3 37.8 46.3 38.1 46.2 38.3C46.2 38.6 46.1 38.9 46.1 39C46 39.1 46 39.3 45.9 39.5C45.6 40.7 45.3 41.5 45 42.3C45 42.4 44.9 42.7 44.8 43C44.7 43.4 44.5 43.9 44.3 44.3C44.1 44.7 43.9 45.2 43.8 45.5C43.7 45.8 43.6 46.1 43.5 46.2C43.5 46.2 43.5 46.3 43.5 46.3C43.5 46.4 43.4 46.5 43.3 46.7C43.2 46.8 43.1 47.1 43 47.2C43 47.3 42.9 47.5 42.8 47.7C42.6 47.9 42.4 48.3 42.3 48.6C41.1 50.8 41.2 50.8 38.3 50.8C34.9 50.8 34.8 50.7 34.8 49.5C34.8 49 34.8 48.8 34.7 48.6C33.3 46.1 32.8 45.5 31.8 45.2C31.6 45.1 31.3 45 31.1 45C30.4 44.8 29.9 44.9 28.2 45.4C27.2 45.7 26 46.8 26 47.5C26 47.6 26 47.7 26 47.7C25.9 47.8 25.9 48 25.8 48.2C25.8 48.4 25.6 48.8 25.4 49.1C25.3 49.4 25.2 49.7 25.2 49.7C25.2 50.3 24.3 50.8 23.4 50.8C23 50.9 22.5 50.9 22.3 50.9C22 51 20.6 51 19.8 51Z" fill="#1F1A17"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  let mem = null;   // if storage is blocked (some privacy modes), the guest lives for this visit only
  function digits() { try { const a = new Uint16Array(1); crypto.getRandomValues(a); return 1000 + (a[0] % 9000); } catch (e) { return 1000 + Math.floor(Math.random() * 9000); } }
  function profile() {
    let p = read() || mem;
    if (!p || !/^Guest\d{4}$/.test(p.name)) { p = { v: 1, name: 'Guest' + digits(), avatar: null, created: Date.now(), welcomed: 0 }; write(p); }
    mem = p; return p;
  }
  function update(f) { const p = profile(); f(p); mem = p; write(p); }

  const CSS = `
@font-face{font-family:"Fredoka";font-weight:400 700;font-display:swap;src:url(fredoka.woff2) format("woff2")}
:root{--gg-page:#F3F3F5;--gg-card:#FFFFFF;--gg-ink:#1E1B16;--gg-mut:#75727C;--gg-tile:#ECECEF;--gg-acc:#7EE081;--gg-lip:#4FB356;--gg-line:rgba(20,20,30,.09)}
.gg-bar{flex:none;display:flex;align-items:center;gap:10px;min-height:32px;padding:5px 10px;background:var(--gg-card);color:var(--gg-ink);border-bottom:1px solid var(--gg-line);font:500 13px/1.25 "Fredoka",system-ui,sans-serif;z-index:5}
.gg-bar .gg-mk{flex:none;width:20px;height:20px}.gg-bar .gg-mk svg{width:100%;height:100%;display:block}
.gg-bar .gg-tx{flex:1;min-width:0}
.gg-bar b{font-weight:700}
.gg-bar .gg-short{display:none}
.gg-bar a{flex:none;display:inline-flex;align-items:center;min-height:26px;padding:0 12px;border-radius:999px;background:var(--gg-acc);box-shadow:0 2px 0 var(--gg-lip);color:var(--gg-ink);font-weight:700;text-decoration:none;white-space:nowrap}
.gg-bar a:focus-visible,.gg-pop button:focus-visible,.gg-pop a:focus-visible{outline:3px solid var(--gg-ink);outline-offset:2px}
@media (max-width:640px){.gg-bar .gg-long{display:none}.gg-bar .gg-short{display:inline}}
.gg-pop{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(20,20,30,.5);font-family:"Fredoka",system-ui,sans-serif}
.gg-pop[hidden]{display:none}
.gg-card{width:min(380px,100%);background:var(--gg-card);color:var(--gg-ink);border-radius:24px;padding:22px 22px 18px;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:center;animation:gg-in .28s cubic-bezier(.34,1.56,.64,1) both}
@keyframes gg-in{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.gg-card{animation:none}}
.gg-card .gg-mk{width:52px;height:52px;margin:0 auto 10px}.gg-card .gg-mk svg{width:100%;height:100%;display:block}
.gg-card h2{margin:0 0 8px;font:700 23px/1.15 "Fredoka",system-ui,sans-serif}
.gg-card p{margin:0 0 6px;font:500 15.5px/1.35 "Fredoka",system-ui,sans-serif;color:var(--gg-ink)}
.gg-card p.gg-free{color:var(--gg-mut);font-size:14px;margin-bottom:16px}
.gg-card .gg-go,.gg-card .gg-x{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:14px;font:700 17px/1 "Fredoka",system-ui,sans-serif;cursor:pointer;text-decoration:none;box-sizing:border-box}
.gg-card .gg-go{background:var(--gg-acc);box-shadow:0 4px 0 var(--gg-lip);color:var(--gg-ink);margin-bottom:12px}
.gg-card .gg-go:active{transform:translateY(2px);box-shadow:0 2px 0 var(--gg-lip)}
.gg-card .gg-x{background:var(--gg-tile);color:var(--gg-ink)}
`;

  let pop = null, opts = {}, gates = [], lastFocus = null;
  const open = () => !!pop && !pop.hidden;
  function url(path) { return SITE + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'ref=itch' + '&game=' + encodeURIComponent(opts.id || 'game'); }
  function style() { if (document.getElementById('gg-css')) return; const s = document.createElement('style'); s.id = 'gg-css'; s.textContent = CSS; document.head.appendChild(s); }

  function banner() {
    if (document.querySelector('.gg-bar')) return;
    const p = profile(), href = SITE + '/games/' + encodeURIComponent(opts.id || '') + '/?ref=itch';
    const b = document.createElement('div'); b.className = 'gg-bar'; b.setAttribute('role', 'note');
    b.innerHTML = '<span class="gg-mk">' + LOGO + '</span><span class="gg-tx">'
      + '<span class="gg-long">Playing as <b>' + esc(p.name) + '</b>. To customize your character and save your inventory, play on Grug.</span>'
      + '<span class="gg-short">Playing as <b>' + esc(p.name) + '</b>. Customize your character on Grug.</span>'
      + '</span><a href="' + esc(href) + '" target="_blank" rel="noopener">Play on Grug</a>';
    (opts.into || document.body).insertBefore(b, (opts.into || document.body).firstChild);
  }

  function close() {
    if (!open()) return; pop.hidden = true; update(p => { p.welcomed = Date.now(); });
    document.removeEventListener('keydown', onKey, true);
    const g = gates; gates = []; g.forEach(f => f());
    if (opts.focus) try { opts.focus(); } catch (e) {}
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); } }
  function welcome() {
    if (pop || profile().welcomed) return;
    pop = document.createElement('div'); pop.className = 'gg-pop';
    pop.innerHTML = '<div class="gg-card" role="dialog" aria-modal="true" aria-labelledby="gg-h">'
      + '<div class="gg-mk">' + LOGO + '</div>'
      + '<h2 id="gg-h">Make your own character!</h2>'
      + '<p>The free Grug site lets you build a 3D avatar that shows up in every Grug game, and keeps your items.</p>'
      + '<p class="gg-free">No account or sign-up needed.</p>'
      + '<a class="gg-go" href="' + esc(url('/avatar/')) + '" target="_blank" rel="noopener">Make my character</a>'
      + '<button type="button" class="gg-x">Play as guest</button></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', e => { if (!e.target.closest('.gg-card') || e.target.closest('.gg-x') || e.target.closest('.gg-go')) close(); });
    document.addEventListener('keydown', onKey, true);
    if (opts.pause) try { opts.pause(); } catch (e) {}
    lastFocus = document.activeElement; setTimeout(() => { const a = pop.querySelector('.gg-go'); if (a && open()) a.focus(); }, 60);
  }

  function start() { style(); profile(); banner(); welcome(); }
  function hide() { const b = document.querySelector('.gg-bar'); if (b) b.remove(); if (open()) { pop.hidden = true; const g = gates; gates = []; g.forEach(f => f()); } }

  root.GrugGuest = {
    KEY, profile,
    mount(o) {
      opts = Object.assign({}, root.GRUG_GAME || {}, o || {});
      const B = root.GrugBridge; if (!B) { start(); return; }
      B.onMode(m => { if (m === 'guest') start(); else hide(); });   // a late trusted host takes it back to platform mode
      if (B.mode === 'guest') start();
    },
    gate() { return open() ? new Promise(ok => gates.push(ok)) : Promise.resolve(); },
    get open() { return open(); }, close
  };
})(window);
