/* Grug · bridge.js — the game side of the "rw:1" bridge when a game is served from another origin (the itch.io builds).
   The protocol is the one documented at "BRIDGE" in every play/<n>/game.html. This file adds what crossing origins needs
   and never replaces a message.

   Who it talks to
   - Only a host on the allowlist below. A message counts only if it comes from an ancestor window (parent, grandparent…)
     whose origin is on the list; replies go to that window at that exact origin (never "*"). The first trusted host to
     speak is the only one heard after that.

   Mode: GrugBridge.mode, the one value everything else reads (gamekit.js as GK.mode, guest.js, the game)
     'pending'   up to 1.5 s while it waits for a host
     'platform'  a trusted host answered with state: the Grug site owns Pearls, inventory, scores and the profile; the game asks
     'guest'     no trusted host answered: the game plays on its own with a local guest (assets/guest.js)
   It is never decided from "am I in an iframe" or the URL (itch's own page frames the game too). A late state from a
   trusted host still switches guest → platform.

   Messages added (on top of hello / state / buy / use / score / needPearls / reply / pause)
     host → game  {t:'host'}              "a Grug host is here": repeated until the game answers (the host can't tell when it's ready)
     game → host  {t:'here'}              the answer (also sent once on load to any trusted ancestor the game can name).
                                          The host replies with a fresh {t:'state'} only: no play is counted until 'hello'.
     game → host  {t:'seen', key}         a tutorial ('tut:<key>') or shared lesson ('skill:<name>') was finished
     game → host  {t:'crate', how, req}   a crate / egg / loot box / daily gift opened: the HOST rolls for a site item
                                          ← {t:'reply', req, ok, item: {id, name, desc} | null, state}
     state gains  sandy (the avatar editor's look) and kit {seen, items, prefs, emotes}, the profile bits gamekit.js uses.

   Layout: itch-builds/<id>/index.html (this file, guest.js and the banner) frames game.html (the game itself, same origin).
   GrugBridge.relay(iframe) passes the game's messages up to the host and the host's down to the game; the game reaches
   this object as parent.GrugBridge.
*/
(function (root) {
  'use strict';
  // The hosts a game listens to. LIVE is the site; TEST is Cloudflare preview URLs and local servers, for testing.
  // When every game is checked, empty TEST and rebuild the zips.
  const LIVE = ['https://grugdigital.pages.dev'];
  const TEST = [/^https:\/\/[a-z0-9-]+\.grugdigital\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/];
  const WAIT = 1500;
  const trusted = o => typeof o === 'string' && (LIVE.indexOf(o) >= 0 || TEST.some(r => r.test(o)));
  const cfg = Object.assign({ id: 'game', title: '', site: LIVE[0] }, root.GRUG_GAME || {});

  const ups = []; try { let w = root; while (w.parent && w.parent !== w && ups.length < 6) { w = w.parent; ups.push(w); } } catch (e) {}
  let mode = 'pending', host = null, state = null, reqN = 0;
  const waits = new Map(), modeFns = [], stateFns = [], downFns = [];
  const send = (win, org, m) => { try { win.postMessage(Object.assign({}, m, { rw: 1 }), org); } catch (e) {} };
  const post = m => { if (host) send(host.win, host.origin, m); };
  function setMode(m) {
    if (mode === m) return; mode = m; document.documentElement.setAttribute('data-grug-mode', m);
    modeFns.slice().forEach(f => { try { f(m); } catch (e) { console.error(e); } });
  }
  function setState(s) {
    if (!s || typeof s !== 'object') return; s = Object.assign({}, s); delete s.t; delete s.rw; state = s;
    stateFns.slice().forEach(f => { try { f(s); } catch (e) { console.error(e); } });
  }
  // true when e is a bridge message from the trusted host (locks onto the first one)
  function accept(e) {
    const d = e.data; if (!d || d.rw !== 1 || typeof d.t !== 'string') return false;
    if (!trusted(e.origin) || ups.indexOf(e.source) < 0) return false;
    if (host) return host.win === e.source && host.origin === e.origin;
    host = { win: e.source, origin: e.origin }; return true;
  }
  root.addEventListener('message', e => {
    if (!accept(e)) return; const d = e.data;
    if (d.t === 'host') { post({ t: 'here' }); return; }
    if (d.t === 'state') { setState(d); setMode('platform'); }
    else if (d.t === 'reply') { if (d.state) setState(d.state); const w = waits.get(String(d.req)); if (w) { waits.delete(String(d.req)); w(d); return; } }
    downFns.forEach(f => f(d));
  });
  // a request of the bridge's own (crate rolls); resolves with the reply, or null if nobody answers
  function ask(m, ms) {
    if (mode !== 'platform' || !host) return Promise.resolve(null);
    const req = 'gb' + (++reqN);
    return new Promise(ok => { waits.set(req, ok); post(Object.assign({}, m, { req })); setTimeout(() => { if (waits.delete(req)) ok(null); }, ms || 6000); });
  }
  // say hello to any trusted ancestor we can name (Chrome and Safari list them; the referrer names the parent)
  (function announce() {
    const ao = location.ancestorOrigins;
    ups.forEach((w, i) => { let o = ao && ao[i]; if (!o && i === 0 && document.referrer) try { o = new URL(document.referrer).origin; } catch (e) {} if (trusted(o)) send(w, o, { t: 'here' }); });
  })();
  setTimeout(() => { if (mode === 'pending') setMode('guest'); }, ups.length ? WAIT : 0);

  // the game in a same-origin frame: its messages go up to the host (only in platform mode), the host's come down
  function relay(frame) {
    let queue = [];
    const inner = () => frame.contentWindow;
    root.addEventListener('message', e => {
      const d = e.data; if (!d || d.rw !== 1 || typeof d.t !== 'string' || e.source !== inner() || e.origin !== location.origin) return;
      if (mode === 'platform') post(d); else if (mode === 'pending') queue.push(d);   // guest: nobody to tell, the game plays its demo
    });
    modeFns.push(m => { if (m === 'platform') queue.forEach(post); queue = []; });
    downFns.push(d => { if (inner()) send(inner(), location.origin, d); });
  }

  root.GrugBridge = {
    cfg, trusted, accept, post, ask, relay,
    get mode() { return mode; }, get state() { return state; }, get host() { return host ? { origin: host.origin } : null; },
    // remote: the host is on another origin, so profile bits come from state and changes go up as messages
    get remote() { return mode === 'platform' && !!host && host.origin !== location.origin; },
    ready() { return mode !== 'pending' ? Promise.resolve(mode) : new Promise(ok => { const f = m => { modeFns.splice(modeFns.indexOf(f), 1); ok(m); }; modeFns.push(f); }); },
    onMode(f) { modeFns.push(f); }, onState(f) { stateFns.push(f); },
    // the player's look: the host's (platform), else the game's own storage; a guest wears the default look
    sandy(local) {
      if (mode === 'platform' && state && state.sandy && typeof state.sandy === 'object') return state.sandy;
      if (mode === 'guest') return root.GrugGuest ? root.GrugGuest.profile().avatar : null;
      return typeof local === 'function' ? local() : null;
    },
    // the name the game shows for the player
    name(fallback) {
      if (mode === 'guest' && root.GrugGuest) return root.GrugGuest.profile().name;
      return (state && state.player) || fallback;
    }
  };
})(window);
