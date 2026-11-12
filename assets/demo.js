/* Grug · demo.js — the freeze on everything made for a named business
   Every page that carries a business's name or logo (a venue's rewards app, a venue's game, the site while it is
   wrapped in a venue's look, a concept site in work/) is a demonstration for that business's owners to review. Until an
   owner signs off, those pages are frozen:
     - a notice says so the first time the page opens in a tab (and a small chip keeps saying it; tap it to read again)
     - nothing can be earned, bought, spent or redeemed there: no Pearls, no coins, no points, no food or drink
   The pages check GRUG_DEMO.frozen and answer with GRUG_DEMO.off (the one sentence shown when someone tries).
   To thaw a business once it has agreed in writing, add its PARTNERS id to LIVE below (and review its pages first). */
(function (root) {
  'use strict';
  if (root.GRUG_DEMO) return;
  var LIVE = [];   // PARTNERS ids of businesses that have signed off (none yet)
  var doc = document, shown = false;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var seen = function (k) { try { return sessionStorage.getItem(k) === '1'; } catch (e) { return false; } };
  var mark = function (k) { try { sessionStorage.setItem(k, '1'); } catch (e) {} };

  var CSS = '.gd-wrap{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:rgba(17,17,20,.72);font:500 16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.gd-card{max-width:440px;width:100%;max-height:calc(100vh - 40px);overflow:auto;background:#fff;color:#1b1b1f;border-radius:18px;padding:22px 22px 18px;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:left}' +
    '.gd-card h2{margin:0 0 8px;font:700 22px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1b1b1f;letter-spacing:0;text-transform:none}' +
    '.gd-card p{margin:0 0 10px;color:#3a3a42;font-size:15px}' +
    '.gd-card button{display:block;width:100%;margin-top:14px;padding:13px 16px;border:0;border-radius:12px;background:#1b1b1f;color:#fff;font:700 16px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}' +
    '.gd-chip{position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + var(--gd-lift, 8px));z-index:2147483645;max-width:calc(100vw - 16px);padding:6px 10px;border:0;border-radius:999px;background:rgba(27,27,31,.88);color:#fff;font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';

  function style() { if (doc.getElementById('gd-css')) return; var s = doc.createElement('style'); s.id = 'gd-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

  function show(name, source) {
    if (!doc.body || doc.querySelector('.gd-wrap')) return;
    style();
    var n = esc(name || 'this business');
    var w = doc.createElement('div'); w.className = 'gd-wrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'gdTitle');
    w.innerHTML = '<div class="gd-card"><h2 id="gdTitle">Demonstration only</h2>' +
      '<p>Grug Digital made this page to show the owners of ' + n + ' what we could build for them. It isn’t an official app or website of ' + n + ', they didn’t approve or endorse it, and it isn’t part of the main Grug site.</p>' +
      '<p>No rewards are offered here. Nothing can be earned, bought, spent or redeemed, and nothing shown on this page is valid at the business. Menus, prices and photos may be out of date.</p>' +
      (source ? '<p><b>Where this came from:</b> ' + esc(source) + '</p>' : '') +
      '<button type="button">Got it</button></div>';
    var close = function () { if (w.parentNode) w.parentNode.removeChild(w); };
    w.querySelector('button').onclick = close;
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    doc.body.appendChild(w);
    try { w.querySelector('button').focus(); } catch (e) {}
  }

  /* install(name[, id[, source]]): the chip on this page, and the notice once per tab for this business.
     source (optional) says where the business's material on the page came from, e.g. its own website. */
  function install(name, id, source) {
    if (id && LIVE.indexOf(id) >= 0) return;
    var go = function () {
      if (shown) return; shown = true; style();
      var c = doc.createElement('button'); c.type = 'button'; c.className = 'gd-chip'; c.textContent = 'Demo only · not affiliated with ' + (name || 'this business');
      c.onclick = function () { show(name, source); };
      doc.body.appendChild(c);
      var k = 'grug.demo.seen.' + String(id || name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!seen(k)) { mark(k); show(name, source); }
    };
    if (doc.body) go(); else doc.addEventListener('DOMContentLoaded', go);
  }

  root.GRUG_DEMO = {
    frozen: true,
    off: 'Rewards are switched off. This is a demonstration only.',
    isLive: function (id) { return LIVE.indexOf(id) >= 0; },
    install: install, show: show
  };
})(window);
