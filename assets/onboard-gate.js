/* Grug · onboard-gate.js — the games onboarding's door for pages that don't load grug.js (games/carts/, built by the
   Grug Micro kit). The same check as Grug.onboard.guard() in assets/grug.js: the first time this device opens a games
   page, it goes to games/welcome/ first (character, birthday, top, bottom) and comes back here afterwards.
   Finished = profile.seen.onboarded and a saved birthday (profile.prefs.birthday) in 'grug.profile.v1'.
   Keep the two in step. Load it first thing in <head>:  <script src="../../assets/onboard-gate.js"></script> */
(function () {
  'use strict';
  try {
    if (window.top !== window.self || /[?&]mode=viewer/.test(location.search)) return;
    var k = '__grug_check'; localStorage.setItem(k, '1'); localStorage.removeItem(k);   // nothing can be saved: no loop
    var p = JSON.parse(localStorage.getItem('grug.profile.v1') || 'null') || {};
    if (p.seen && p.seen.onboarded && p.prefs && /^\d{4}-\d{2}-\d{2}$/.test(p.prefs.birthday || '')) return;
    var me = document.currentScript && document.currentScript.src, root = me ? new URL('../', me) : new URL('/', location.href);
    if (location.href.indexOf(root.href) !== 0) return;
    var next = location.href.slice(root.href.length);
    document.documentElement.style.visibility = 'hidden';
    location.replace(root.href + 'games/welcome/?next=' + encodeURIComponent(next));
  } catch (e) {}
})();
