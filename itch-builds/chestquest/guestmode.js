/* Grug · guestmode.js — the itch.io copies are standalone: they never talk to the Grug site or any other page.
   This stands in for a bridge so guest.js and the patched game.html have one place to ask "who is playing":
   the mode is always 'guest', the player is the local guest (guest.js) and wears the default look.
   The game keeps its own demo wallet, power-ups and progress in this origin's localStorage, as it does when opened alone. */
(function (root) {
  'use strict';
  const cfg = Object.assign({ id: 'game', title: '' }, root.GRUG_GAME || {});
  document.documentElement.setAttribute('data-grug-mode', 'guest');
  root.GrugBridge = {
    cfg, mode: 'guest', state: null, host: null, remote: false,
    ready() { return Promise.resolve('guest'); },
    onMode() {}, onState() {}, relay() {}, post() {}, ask() { return Promise.resolve(null); },
    sandy() { return root.GrugGuest ? root.GrugGuest.profile().avatar : null; },
    name(fallback) { return root.GrugGuest ? root.GrugGuest.profile().name : fallback; }
  };
})(window);
