/* Grug · hostbridge.js — the site side of the "rw:1" bridge for a game host page (play/<id>/index.html).
   Loads after games.js, grug.js and grug-app.js. The host keeps its own handler for the game's messages (hello, buy, use,
   score, needPearls); this file picks where the game comes from and does the cross-origin part around it.

   - Where the game comes from: the game's entry in assets/games.js. With itch: { embedUrl, origin } set, the frame opens
     the itch.io build; without it (or with embedUrl cleared) it opens the local game.html, as before.
   - Origins: messages count only from the game's frame (or a frame inside it: itch's embed page frames the game) AND from
     the itch build's exact origin or this site's own origin (the local game.html). Every message to the game goes to the
     window that spoke and its exact origin, never "*".
   - Messages it answers itself (docs: assets/bridge.js):
       'here'   → a fresh state (no play counted)
       'seen'   → saves profile.seen['tut:<key>' | 'skill:<name>'] (checked: short keys of letters, digits, - and _)
       'crate'  → the host rolls Grug.crateRoll() for a site item (at most one roll every 3 s, 40 a visit) and replies
   - Until the game speaks it sends {t:'host'} to the frame and the frames inside it, so a game on another origin finds us.

   GrugHost.connect({ frame, id, local: 'game.html', state: () => ({…}), onMessage(d, reply, e) })
     → { toGame(m), itch: true | false, origin }
*/
(function (root) {
  'use strict';
  const SEEN = /^(tut|skill):[a-z0-9_-]{1,40}$/i;
  function originOf(u) { try { return new URL(u, location.href).origin; } catch (e) { return null; } }

  function connect(o) {
    const G = root.Grug, f = o.frame;
    const entry = (root.GRUG_GAMES || []).find(g => g.id === o.id) || {};
    const it = entry.itch && entry.itch.embedUrl ? entry.itch : null;
    const itchOrigin = it ? originOf(it.origin || it.embedUrl) : null;
    const allowed = [location.origin]; if (itchOrigin && allowed.indexOf(itchOrigin) < 0) allowed.push(itchOrigin);
    let gameWin = null, gameOrigin = null, pingT = 0, pingStart = 0, crateAt = 0, crates = 0;

    // the frame's window and the frames inside it (itch's embed page → the game)
    function wins() {
      const a = [], w = f.contentWindow; if (!w) return a; a.push(w);
      try { for (let i = 0; i < Math.min(w.length, 6); i++) { const k = w[i]; a.push(k); for (let j = 0; j < Math.min(k.length, 3); j++) a.push(k[j]); } } catch (e) {}
      return a;
    }
    function toGame(m) { if (gameWin) try { gameWin.postMessage(Object.assign({}, m, { rw: 1 }), gameOrigin); } catch (e) {} }
    const sendState = () => toGame(Object.assign({ t: 'state' }, o.state()));
    function ping() {
      clearTimeout(pingT); if (gameWin) return;
      wins().forEach(w => allowed.forEach(org => { try { w.postMessage({ rw: 1, t: 'host' }, org); } catch (e) {} }));
      pingT = setTimeout(ping, Date.now() - pingStart < 10000 ? 250 : 1000);   // keep listening (itch can show a "Run game" button first)
    }
    f.addEventListener('load', () => { gameWin = null; gameOrigin = null; pingStart = Date.now(); ping(); });

    root.addEventListener('message', e => {
      const d = e.data; if (!d || d.rw !== 1 || typeof d.t !== 'string') return;
      if (allowed.indexOf(e.origin) < 0 || wins().indexOf(e.source) < 0) return;
      if (!gameWin || d.t === 'here' || d.t === 'hello') { gameWin = e.source; gameOrigin = e.origin; clearTimeout(pingT); }
      else if (e.source !== gameWin || e.origin !== gameOrigin) return;
      const reply = r => toGame(Object.assign({ t: 'reply', req: String(d.req || '').slice(0, 40), state: o.state() }, r));
      if (d.t === 'here') { sendState(); return; }
      if (d.t === 'host') return;
      if (d.t === 'seen') {
        const k = String(d.key || ''); if (!SEEN.test(k) || !G || !G.profile) return;
        if (!G.profile.seen[k]) { G.profile.seen[k] = Date.now(); G.save('seen'); }
        return;
      }
      if (d.t === 'crate') {
        const now = Date.now();
        if (!G || now - crateAt < 3000 || crates >= 40) { reply({ ok: false, item: null }); return; }
        crateAt = now; crates++;
        const won = G.crateRoll(String(d.how || o.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || o.id);
        reply({ ok: true, item: won ? { id: won.id, name: won.name, desc: won.desc } : null });
        return;
      }
      o.onMessage(d, reply, e);
    });
    // the avatar editor saved a new look in another tab: send it to the game
    root.addEventListener('storage', e => { if (e.key === 'grug.sandy.v1') sendState(); });

    f.src = it ? it.embedUrl : (o.local || 'game.html');
    return { toGame, sendState, itch: !!it, origin: itchOrigin || location.origin };
  }

  root.GrugHost = { connect };
})(window);
