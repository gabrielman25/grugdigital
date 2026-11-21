/* Grug · vid-shim.js: the first script in every Grug original's game.html. It does nothing unless the game is opened by
   the Vids page (vids/, ?vid=…). Keep it the first script: some games run big inline scripts (models, the avatar runtime)
   before gamekit.js, and they must already see the throwaway storage. Add the same line to the game kit's template. */
/* Vids (vids/): a game opened with ?vid=… inside the Vids page is played by an NPC, never the player. Before
   anything else runs it gets its own throwaway storage (seeded by the page: the NPC's look, name and settings), so nothing
   the NPC does (coins, saves, tutorials, Pearls) ever touches the player's real data; and its sound goes through one
   volume the page controls (muted to start). */
(function () {
  if (!/[?&]vid=/.test(location.search) || window.GK_VID) return;
  let seed = null; try { seed = window.frameElement && window.frameElement.__vidStore; } catch (e) {}
  if (!seed) return;
  const mk = m => ({ getItem: k => m.has(String(k)) ? m.get(String(k)) : null, setItem: (k, v) => { m.set(String(k), String(v)); }, removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(), key: i => Array.from(m.keys())[i] == null ? null : Array.from(m.keys())[i], get length() { return m.size; } });
  const ls = mk(new Map(Object.entries(seed))), ss = mk(new Map());
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: () => ls }); Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => ss }); } catch (e) {}
  const M = window.GK_VID = { vol: 0, gains: [], media: new Set(), setVolume(v) { M.vol = v; for (const g of M.gains) try { g.gain.value = v; } catch (e) {} for (const a of M.media) a.muted = !v; } };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    class VidAudio extends AC { constructor(...a) { super(...a); const g = super.createGain(); g.gain.value = M.vol; g.connect(super.destination); this.__out = g; M.gains.push(g); } get destination() { return this.__out || super.destination; } }
    window.AudioContext = VidAudio; if (window.webkitAudioContext) window.webkitAudioContext = VidAudio;
  }
  // the NPC's mouse is synthetic: pointer capture has no real pointer to hold, so it's a quiet no-op here
  for (const k of ['setPointerCapture', 'releasePointerCapture']) { const f = Element.prototype[k]; Element.prototype[k] = function () { try { return f.apply(this, arguments); } catch (e) {} }; }
  const play0 = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { M.media.add(this); this.muted = !M.vol; return play0.apply(this, arguments); };
})();
