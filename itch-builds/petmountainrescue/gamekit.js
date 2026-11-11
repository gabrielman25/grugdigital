/* Grug · gamekit.js — the site-wide layer inside every game (play/<name>/game.html loads it before its own script).
   Nothing here depends on the game's code: it reads the Grug profile from localStorage (same origin) and gives the game
   a small API on window.GK. Everything is optional; a game that never calls GK still gets the UI size, the centred
   banners and the free-shop timer.

   What it does on its own
   - UI size (Settings → UI size): zooms the game's UI layers (never the 3D canvas or world-anchored tags).
   - Important text (the kit's #banner and #toast, plus a game's own hint elements: GK.center(selectors)) sits just below
     dead centre and shakes or flashes in when it appears or changes.
   - Lobby text: "how to play" blocks fold into a toggle and long leads clamp, so the first screen is short.
   - The Free Shop Token timer at the top when one is running (GK.free() says whether prices are 0 right now).

   What a game calls
   - GK.hint(text, {ms, anim:'shake'|'flash', sub})          a centred, animated message (the default anim is shake)
   - GK.stamina.show(on) / GK.stamina.set(frac, state)        a stamina bar for games where you walk around
   - GK.tutorial(key, steps, {force})                          hand-holding steps with Next and Skip; steps: {text, target?, until?}
   - GK.crate(how)                                             roll a site item drop when a crate / egg / loot box opens
   - GK.emotes.install({play(anim), onStop?})                  the emote wheel (B key, or the button); GK.emotes.anim(moving) each frame
   - GK.free()                                                 true while the Free Shop Token runs (prices are 0)
   - GK.lockedCube(THREE, {size, text, color})                 a solid "LOCKED" / "COMING SOON" cube for a plot that isn't open yet
   - GK.prop(THREE, kind, seed)                                a small (≤ 1 block), low-key, no-collision prop for a sparse spot
   - GK.pet(THREE, seed)                                       a flashy little pet for a bot (returns {group, update(dt, pos)})
*/
(function (root) {
  'use strict';
  const KEY = 'grug.profile.v1', BOOST_KEY = 'grug.boost.v1';
  const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const readJSON = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // the Grug profile (grug.js makes it on every site page; a game opened on its own before any site page gets a bare one, which grug.js fills in later)
  const profile = () => { const p = readJSON(KEY, null); return p && typeof p === 'object' && p.v ? p : { v: 1, created: Date.now(), seen: {}, items: {}, prefs: {} }; };
  const prefs = () => Object.assign({ motion: true, haptics: true, uiScale: 1 }, profile().prefs || {});
  const GAME = (location.pathname.match(/\/play\/([a-z0-9]+)\//) || [])[1] || 'game';
  const reduce = () => !prefs().motion || (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let gestured = false; ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { gestured = true; }, { once: true, capture: true, passive: true }));
  const buzz = p => { if (gestured && prefs().haptics && navigator.vibrate) try { navigator.vibrate(p || 8); } catch (e) {} };   // browsers refuse a vibration before the first tap
  const SPEC = { 'free-shop': { name: 'Free Shop Token', hue: '#f59e0b', max: 1, minutes: 3, desc: 'Everything in every shop is free for 3 minutes' } };
  const DROP = 0.06;

  /* ---------- styles ---------- */
  const css = document.createElement('style'); css.id = 'gk-css';
  css.textContent = `
:root{--gk-ui:1}
/* UI size: the UI layers zoom, the canvas and the world-anchored tags don't */
html.gk-scaled body>*:not(canvas):not(#tags):not(#floaters):not(#veil):not(.vign):not(.flash):not(.stick):not(#gk-free):not(.gk-nozoom):not(script):not(style){zoom:var(--gk-ui)}
/* important text: just below dead centre, animated in */
#banner.banner,.gk-center{top:57%!important;bottom:auto!important;transform:translate(-50%,-50%)!important;left:50%!important}
#toast.toast,.gk-center-toast{top:66%!important;bottom:auto!important;left:50%!important;transform:translateX(-50%)!important}
body.menu-open #toast.toast{top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 18px)!important}
.gk-pop{animation:gk-shake .55s cubic-bezier(.36,.07,.19,.97) both!important}
.gk-pop.gk-flash,.gk-center.gk-flash.gk-pop{animation:gk-shake .55s cubic-bezier(.36,.07,.19,.97) both,gk-flash .9s ease-out both!important}
@keyframes gk-shake{0%{transform:translate(-50%,-50%) translateX(0) scale(.92)}12%{transform:translate(-50%,-50%) translateX(-9px) scale(1.04)}25%{transform:translate(-50%,-50%) translateX(8px)}37%{transform:translate(-50%,-50%) translateX(-6px)}50%{transform:translate(-50%,-50%) translateX(5px)}62%{transform:translate(-50%,-50%) translateX(-3px)}75%{transform:translate(-50%,-50%) translateX(2px)}100%{transform:translate(-50%,-50%) translateX(0) scale(1)}}
#toast.toast.gk-pop{animation:gk-shake-x .55s cubic-bezier(.36,.07,.19,.97) both!important}
@keyframes gk-shake-x{0%{transform:translateX(-50%) scale(.92)}12%{transform:translateX(calc(-50% - 9px)) scale(1.04)}25%{transform:translateX(calc(-50% + 8px))}37%{transform:translateX(calc(-50% - 6px))}50%{transform:translateX(calc(-50% + 5px))}62%{transform:translateX(calc(-50% - 3px))}100%{transform:translateX(-50%) scale(1)}}
@keyframes gk-flash{0%,30%,60%{filter:brightness(1.6) saturate(1.3)}15%,45%,100%{filter:none}}
@media (prefers-reduced-motion:reduce){.gk-pop{animation:none!important}}
/* GK.hint */
#gk-hint{position:fixed;left:50%;top:57%;transform:translate(-50%,-50%);z-index:60;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 26px;border-radius:22px;background:#fff;color:#111827;font:700 26px/1.15 "Fredoka","Arial Rounded MT Bold",system-ui,sans-serif;text-align:center;max-width:min(560px,calc(100% - 40px));opacity:0;transition:opacity .25s;box-shadow:0 14px 40px rgba(0,0,0,.35)}
#gk-hint small{font-size:16px;color:#6b7280;font-weight:600}
#gk-hint.on{opacity:1}
#gk-hint.good{background:#10b981;color:#fff}#gk-hint.good small{color:#d1fae5}
#gk-hint.bad{background:#f43f5e;color:#fff}#gk-hint.bad small{color:#ffe4e6}
#gk-hint.gold{background:linear-gradient(135deg,#f59e0b,#f97316);color:#1a1205}#gk-hint.gold small{color:#5a3d05}
@media (max-width:520px){#gk-hint{font-size:21px;padding:12px 20px}}
/* lobby text: fold the how-to, clamp the lead */
.gk-fold{margin:14px 0 0}
.gk-fold>button{appearance:none;border:0;background:#ebedf2;color:#111827;font:700 15px/1 inherit;min-height:42px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.gk-fold>button::before{content:"▸";transition:transform .2s}.gk-fold.open>button::before{transform:rotate(90deg)}
.gk-fold>div{display:none}.gk-fold.open>div{display:block}
.gk-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}
.gk-clamp.open{display:block;-webkit-line-clamp:unset}
/* stamina */
#gk-stam{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);transform:translateX(-50%);width:min(300px,56vw);height:20px;border-radius:999px;background:#ffffffe6;padding:4px;z-index:30;pointer-events:none;display:none;box-shadow:0 6px 18px rgba(0,0,0,.25)}
#gk-stam.on{display:block}
#gk-stam i{display:block;height:100%;border-radius:999px;background:#10b981;width:100%;transition:width .12s linear,background .2s}
#gk-stam i.low{background:#f59e0b}#gk-stam i.out{background:#f43f5e;animation:gk-blink .5s steps(2) infinite}#gk-stam i.boost{background:#0ea5e9}
#gk-stam b{position:absolute;inset:0;display:grid;place-items:center;font:700 12px/1 "Fredoka",system-ui,sans-serif;color:#111827;letter-spacing:.06em}
@keyframes gk-blink{50%{opacity:.5}}
body.touch #gk-stam{left:calc((100% - 112px) / 2);width:190px;bottom:calc(env(safe-area-inset-bottom) + 118px)}
#gk-run{position:fixed;right:calc(env(safe-area-inset-right) + 112px);bottom:calc(env(safe-area-inset-bottom) + 24px);width:64px;height:64px;border-radius:50%;border:0;background:#ffffffe6;color:#111827;font-size:28px;line-height:1;display:none;place-items:center;z-index:30;box-shadow:0 6px 18px rgba(0,0,0,.25);padding:0;touch-action:none}
#gk-run.show{display:grid}#gk-run.on{background:#10b981}
body.menu-open #gk-run{display:none!important}
/* free-shop timer */
#gk-free{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 10px);transform:translateX(-50%);z-index:70;display:none;align-items:center;gap:8px;padding:8px 16px 8px 12px;border-radius:999px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#1a1205;font:800 15px/1 "Fredoka",system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 10px 28px rgba(245,158,11,.5);pointer-events:none}
#gk-free.on{display:flex;animation:gk-drop .5s cubic-bezier(.34,1.56,.64,1) both}
#gk-free .t{font-variant-numeric:tabular-nums;font-size:17px}
#gk-free.low{animation:gk-drop .5s both,gk-glow .8s ease-in-out infinite}
@keyframes gk-drop{from{transform:translate(-50%,-24px) scale(.8);opacity:0}to{transform:translate(-50%,0) scale(1);opacity:1}}
@keyframes gk-glow{50%{filter:brightness(1.35)}}
/* crate drop celebration */
#gk-drop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6);z-index:80;display:none;flex-direction:column;align-items:center;gap:6px;padding:22px 34px;border-radius:28px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#1a1205;font:700 18px/1.2 "Fredoka",system-ui,sans-serif;text-align:center;box-shadow:0 20px 60px rgba(245,158,11,.55),0 0 0 6px #fff8;pointer-events:none;opacity:0}
#gk-drop.on{display:flex;animation:gk-dropin .6s cubic-bezier(.34,1.56,.64,1) forwards}
#gk-drop b{font-size:30px;line-height:1}#gk-drop small{font-size:14px;color:#5a3d05;font-weight:600}
#gk-drop .ic{font-size:48px;line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25));animation:gk-spin 1.2s ease-in-out infinite}
@keyframes gk-dropin{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes gk-spin{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg) scale(1.08)}}
/* tutorial */
#gk-tut{position:fixed;inset:0;z-index:75;pointer-events:none}
#gk-tut.on{display:block}#gk-tut:not(.on){display:none}
#gk-tut .spot{position:fixed;border-radius:22px;box-shadow:0 0 0 9999px rgba(8,10,18,.55),0 0 0 4px #fff,0 0 30px 6px #fde047aa;transition:all .3s cubic-bezier(.4,0,.2,1);pointer-events:none}
#gk-tut .spot.none{box-shadow:0 0 0 9999px rgba(8,10,18,.45)}
#gk-tut .card{position:fixed;left:50%;top:58%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 32px));padding:20px 22px 16px;border-radius:26px;background:#fff;color:#111827;font:600 17px/1.35 "Fredoka","Arial Rounded MT Bold",system-ui,sans-serif;pointer-events:auto;box-shadow:0 18px 50px rgba(0,0,0,.4)}
#gk-tut .card.gk-pop{animation:gk-shake .55s cubic-bezier(.36,.07,.19,.97) both}
#gk-tut .step{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;font-weight:700;margin-bottom:6px}
#gk-tut .tx{font-size:19px;line-height:1.3}
#gk-tut .tx kbd{display:inline-block;min-width:24px;padding:2px 7px;border-radius:8px;background:#111827;color:#fff;font:700 15px "Fredoka",system-ui,sans-serif;text-align:center;margin:0 2px}
#gk-tut .btns{display:flex;gap:10px;margin-top:16px;align-items:center}
#gk-tut button{appearance:none;border:0;cursor:pointer;font:700 17px/1 "Fredoka",system-ui,sans-serif;min-height:48px;padding:0 20px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center}
#gk-tut .next{background:#10b981;color:#fff;flex:1}
#gk-tut .skip{background:#ebedf2;color:#111827}
#gk-tut .hand{position:fixed;font-size:40px;line-height:1;pointer-events:none;transform:translate(-50%,-50%);animation:gk-hand 1s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
@keyframes gk-hand{0%,100%{margin-top:0}50%{margin-top:-14px}}
/* emotes */
#gk-emo{position:fixed;right:calc(env(safe-area-inset-right) + 14px);top:46%;width:52px;height:52px;border-radius:50%;border:0;background:#ffffffe6;color:#111827;display:none;place-items:center;cursor:pointer;z-index:35;box-shadow:0 6px 18px rgba(0,0,0,.25);font-size:26px;line-height:1;padding:0}
#gk-emo.on{display:grid}
#gk-wheel{position:fixed;inset:0;z-index:72;display:none;background:rgba(8,10,18,.35);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#gk-wheel.on{display:block}
#gk-wheel .ring{position:absolute;left:50%;top:50%;width:0;height:0}
#gk-wheel .em{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;border:0;background:#fff;color:#111827;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font:700 12px/1 "Fredoka",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:gk-emin .35s cubic-bezier(.34,1.56,.64,1) both;--c:#3b82f6}
#gk-wheel .em i{width:40px;height:40px;border-radius:50%;background:var(--c);display:grid;place-items:center;font-size:22px;font-style:normal;color:#fff}
#gk-wheel .em kbd{position:absolute;top:4px;left:8px;font:700 11px "Fredoka",system-ui,sans-serif;color:#9ca3af}
#gk-wheel .em:active{transform:scale(.94)}
#gk-wheel .x{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:0;background:#111827;color:#fff;font:700 20px/1 "Fredoka",system-ui,sans-serif;cursor:pointer}
#gk-wheel .tip{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 24px);transform:translateX(-50%);color:#fff;font:600 15px "Fredoka",system-ui,sans-serif;text-align:center;opacity:.85;white-space:nowrap}
@keyframes gk-emin{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
body.menu-open #gk-emo,body.menu-open #gk-stam{display:none!important}
`;
  document.head.appendChild(css);

  /* ---------- UI size ---------- */
  function applyScale() {
    const z = +prefs().uiScale || 1;
    document.documentElement.style.setProperty('--gk-ui', String(z));
    document.documentElement.classList.toggle('gk-scaled', z !== 1);
  }
  applyScale();
  root.addEventListener('storage', e => { if (e.key === KEY) { applyScale(); emotes.reload(); } if (e.key === BOOST_KEY) freeTick(); });

  /* ---------- centred, animated important text ---------- */
  const popped = new WeakMap();
  function pop(el, flash) {
    if (!el) return; el.classList.remove('gk-pop', 'gk-flash'); void el.offsetWidth; el.classList.add('gk-pop'); if (flash) el.classList.add('gk-flash');
    clearTimeout(popped.get(el)); popped.set(el, setTimeout(() => el.classList.remove('gk-pop', 'gk-flash'), 1000));
  }
  // watch an element: whenever it becomes visible or its text changes, it shakes in
  function watch(el, flash) {
    if (!el || el.__gk) return; el.__gk = true;
    const visible = () => { const cs = getComputedStyle(el); return el.offsetParent !== null || cs.position === 'fixed'; };
    let lastText = el.textContent, lastOn = el.classList.contains('on') || el.classList.contains('show');
    new MutationObserver(() => {
      const on = el.classList.contains('on') || el.classList.contains('show') || (!el.hidden && el.style.display !== 'none' && (el.style.opacity === '' || +el.style.opacity > 0));
      const t = el.textContent;
      if ((on && !lastOn) || (on && t !== lastText && t.trim())) pop(el, flash);
      lastOn = on; lastText = t;
    }).observe(el, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], childList: true, characterData: true, subtree: true });
  }
  // a game's own "important" elements: move them to the centre and animate them (selectors)
  function center(sels, opts) {
    opts = opts || {};
    $$(Array.isArray(sels) ? sels.join(',') : sels).forEach(el => { el.classList.add(opts.toast ? 'gk-center-toast' : 'gk-center'); watch(el, opts.flash !== false); });
  }
  function autoWatch() {
    const b = $('#banner'); if (b) watch(b, true);
    const t = $('#toast'); if (t) watch(t, false);
  }
  // GK.hint(text, {sub, ms, kind:'good'|'bad'|'gold', anim:'shake'|'flash'})
  let hintT = 0;
  function hint(text, o) {
    o = o || {}; let el = $('#gk-hint'); if (!el) { el = document.createElement('div'); el.id = 'gk-hint'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = o.kind || ''; el.innerHTML = esc(text) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '');
    el.classList.add('on'); pop(el, o.anim !== 'shake'); buzz(o.kind === 'bad' ? [20, 30, 20] : 10);
    clearTimeout(hintT); if (o.ms !== 0) hintT = setTimeout(() => el.classList.remove('on'), o.ms || 2600);
    return el;
  }

  /* ---------- lobby text: fold the how-to, clamp the lead ---------- */
  function compact(rootEl) {
    $$('.howto', rootEl).forEach(h => {
      if (h.closest('.gk-fold')) return;
      const f = document.createElement('div'); f.className = 'gk-fold';
      f.innerHTML = '<button type="button">How to play</button><div></div>';
      h.parentNode.insertBefore(f, h); f.lastElementChild.appendChild(h);
      f.firstElementChild.addEventListener('click', () => f.classList.toggle('open'));
    });
    // the first lead in a lobby (the tagline): two lines, tap for the rest
    $$('.sheet .lead', rootEl).forEach(p => {
      if (p.classList.contains('gk-clamp') || p.classList.contains('gk-nocl') || p.textContent.length < 110) return;
      p.classList.add('gk-clamp'); p.title = 'Tap to read more';
      p.addEventListener('click', () => p.classList.toggle('open'));
    });
  }
  function watchLobbies() {
    compact(document);
    new MutationObserver(ms => { let any = false; ms.forEach(m => { if (m.addedNodes.length) any = true; }); if (any) compact(document); }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- stamina bar ---------- */
  const stamina = {
    el: null, btn: null, shift: false, toggle: false, pad: false,
    // show(on, {button:true}) also adds a Run button for touch screens (toggles sprinting); Shift or a gamepad's left stick click sprint too
    show(on, o) {
      if (!this.el) { this.el = document.createElement('div'); this.el.id = 'gk-stam'; this.el.innerHTML = '<i></i><b>STAMINA</b>'; document.body.appendChild(this.el);
        document.addEventListener('keydown', e => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = true; });
        document.addEventListener('keyup', e => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = false; });
        root.addEventListener('blur', () => { this.shift = false; }); }
      this.el.classList.toggle('on', !!on);
      if (o && o.button && !this.btn) { const b = document.createElement('button'); b.id = 'gk-run'; b.type = 'button'; b.setAttribute('aria-label', 'Run'); b.textContent = '🏃'; document.body.appendChild(b);
        b.addEventListener('pointerdown', e => { e.preventDefault(); this.toggle = !this.toggle; b.classList.toggle('on', this.toggle); buzz(6); }); this.btn = b; }
      if (this.btn) this.btn.classList.toggle('show', !!on && (document.body.classList.contains('touch') || matchMedia('(pointer:coarse)').matches));
    },
    wantRun() { if (navigator.getGamepads) { try { const p = Array.from(navigator.getGamepads()).find(Boolean); this.pad = !!(p && p.buttons[10] && p.buttons[10].pressed); } catch (e) {} } return this.shift || this.toggle || this.pad; },
    stopRun() { this.toggle = false; if (this.btn) this.btn.classList.remove('on'); },
    // frac 0..1; state '' | 'low' | 'out' | 'boost' (low/out picked for you when state is omitted)
    set(frac, state) { if (!this.el) this.show(true); const i = this.el.firstElementChild; frac = Math.max(0, Math.min(1, +frac || 0)); i.style.width = (frac * 100).toFixed(1) + '%';
      i.className = state != null ? state : frac <= 0.02 ? 'out' : frac < 0.3 ? 'low' : ''; this.el.lastElementChild.textContent = frac <= 0.02 ? 'TIRED' : 'STAMINA'; }
  };

  /* ---------- the Free Shop Token timer ---------- */
  let freeT = 0;
  function freeLeft() { const b = readJSON(BOOST_KEY, null) || {}; return Math.max(0, Math.floor((+b.freeShopUntil || 0) - Date.now())); }
  const free = () => freeLeft() > 0;
  function freeTick() {
    let el = $('#gk-free'); const left = freeLeft();
    if (!left) { if (el) el.classList.remove('on'); clearTimeout(freeT); freeT = 0; return; }
    if (!el) { el = document.createElement('div'); el.id = 'gk-free'; el.innerHTML = '<span>🎟️</span><b>FREE SHOP</b><span class="t"></span>'; document.body.appendChild(el); }
    el.classList.add('on'); const s = Math.ceil(left / 1000); el.querySelector('.t').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.classList.toggle('low', s <= 20);
    clearTimeout(freeT); freeT = setTimeout(freeTick, 250);
  }

  /* ---------- crate drops: the site-wide items ---------- */
  function itemCount(id) { const p = profile(); return +(((p.items || {})[id] || {}).n) || 0; }
  function grant(id, how) {
    const p = profile(); if (!p.v) return false; p.items = p.items && typeof p.items === 'object' ? p.items : {};
    const spec = SPEC[id]; const cur = p.items[id] || { n: 0 }; if (cur.n >= spec.max) return false;
    cur.n++; cur.at = Date.now(); cur.how = how || GAME; p.items[id] = cur; p.updated = Date.now(); return writeJSON(KEY, p);
  }
  let dropT = 0;
  function showDrop(spec) {
    let el = $('#gk-drop'); if (!el) { el = document.createElement('div'); el.id = 'gk-drop'; document.body.appendChild(el); }
    el.innerHTML = '<span class="ic">🎟️</span><small>SITE ITEM!</small><b>' + esc(spec.name) + '</b><small>' + esc(spec.desc) + '. Use it from Settings.</small>';
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); buzz([14, 50, 14, 50, 30]);
    clearTimeout(dropT); dropT = setTimeout(() => el.classList.remove('on'), 4200);
  }
  // a crate, egg or loot box opened: roll for a site item (one at a time: a token that's held means no roll). Returns the item or null.
  function crate(how) {
    for (const id in SPEC) { if (itemCount(id) >= SPEC[id].max) continue; if (Math.random() < DROP) { if (grant(id, how)) { showDrop(SPEC[id]); return Object.assign({ id }, SPEC[id]); } } }
    return null;
  }

  /* ---------- tutorials: hand-holding steps with Next and Skip ---------- */
  const tut = { el: null, steps: null, i: 0, key: '', raf: 0, done: null };
  function tutDom() {
    if (tut.el) return tut.el;
    const el = document.createElement('div'); el.id = 'gk-tut';
    el.innerHTML = '<div class="spot none"></div><div class="hand" hidden>👆</div><div class="card"><div class="step"></div><div class="tx"></div><div class="btns"><button type="button" class="skip">Skip tutorial</button><button type="button" class="next">Next</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('.skip').addEventListener('click', () => endTut(true));
    el.querySelector('.next').addEventListener('click', () => stepTut(tut.i + 1));
    tut.el = el; return el;
  }
  function seen(key) { return !!((profile().seen || {})['tut:' + key]); }
  function markSeen(key) { const p = profile(); if (!p.v) return; p.seen = p.seen || {}; p.seen['tut:' + key] = Date.now(); writeJSON(KEY, p); }
  /* Shared lessons: a step tagged skill: 'move' | 'sprint' | 'camera' | 'jump' | 'emotes' (any name) is the same lesson in every
     game, so once a player has done it anywhere it is skipped everywhere else. Done = advanced past it (Next, or its `until`),
     or the whole tutorial skipped. Tracked in the profile as seen['skill:<name>'], site-wide. */
  const skillSeen = name => !!((profile().seen || {})['skill:' + name]);
  function markSkill(name) { if (!name || skillSeen(name)) return; const p = profile(); if (!p.v) return; p.seen = p.seen || {}; p.seen['skill:' + name] = Date.now(); writeJSON(KEY, p); }
  function tutorial(key, steps, opts) {
    opts = opts || {}; steps = (steps || []).filter(Boolean);
    if (!opts.force) steps = steps.filter(st => !(st.skill && skillSeen(st.skill)));   // basic lessons already learnt in another game
    if (!steps.length || (!opts.force && seen(key))) { if (steps.length === 0 && !seen(key)) markSeen(key); return Promise.resolve(false); }
    if (tut.steps) endTut(false);
    return new Promise(res => { tut.done = res; tut.key = key; tut.steps = steps; tutDom().classList.add('on'); stepTut(0); });
  }
  function stepTut(i) {
    if (!tut.steps) return;
    if (i > 0 && tut.steps[i - 1]) markSkill(tut.steps[i - 1].skill);   // the lesson just passed counts as learnt, everywhere
    if (i >= tut.steps.length) return endTut(true);
    tut.i = i; const s = tut.steps[i], el = tut.el, card = el.querySelector('.card');
    el.querySelector('.step').textContent = (s.title || 'Tutorial') + ' · ' + (i + 1) + ' / ' + tut.steps.length;
    el.querySelector('.tx').innerHTML = s.html || esc(s.text || '');
    el.querySelector('.next').textContent = i === tut.steps.length - 1 ? (s.doneLabel || 'Got it!') : (s.nextLabel || 'Next');
    el.querySelector('.next').hidden = !!s.until && s.hideNext;
    pop(card, true); buzz(8);
    if (s.on) try { s.on(); } catch (e) {}
    cancelAnimationFrame(tut.raf);
    const spot = el.querySelector('.spot'), hand = el.querySelector('.hand');
    const tick = () => {
      if (!tut.steps || tut.i !== i) return;
      const target = typeof s.target === 'function' ? s.target() : s.target ? $(s.target) : null;
      const r = target && target.getBoundingClientRect(); const ok = r && r.width > 4 && r.height > 4 && !(target.hidden);
      if (ok) { const pad = s.pad == null ? 10 : s.pad; spot.classList.remove('none'); spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px'; spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
        hand.hidden = s.hand === false; hand.style.left = (r.left + r.width / 2) + 'px'; hand.style.top = (r.bottom + 30) + 'px';
        // the card moves out of the way of a target in the middle
        const low = r.top < innerHeight * 0.72 && r.bottom > innerHeight * 0.38; card.style.top = low ? '82%' : '58%';
      } else { spot.classList.add('none'); spot.style.left = spot.style.top = '50%'; spot.style.width = spot.style.height = '0'; hand.hidden = true; card.style.top = '58%'; }
      if (s.until) { let d = false; try { d = !!s.until(); } catch (e) {} if (d) { stepTut(i + 1); return; } }
      tut.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function endTut(mark) {
    cancelAnimationFrame(tut.raf); if (tut.el) tut.el.classList.remove('on');
    if (mark && tut.key) { markSeen(tut.key); (tut.steps || []).forEach(st => markSkill(st.skill)); }   // skipped or finished: its shared lessons are done too
    const done = tut.done; tut.steps = null; tut.done = null; if (done) done(!!mark);
  }

  /* ---------- emotes ---------- */
  const EM_ICON = { wave: '👋', dance: '💃', disco: '🕺', shuffle: '👟', robot: '🤖', cheer: '🎉', bow: '🙇', flex: '💪', jump: '🐰' };
  const EM_ALL = [
    { id: 'wave', name: 'Wave', anim: 'wave', hue: '#3b82f6', ms: 2600 }, { id: 'dance', name: 'Groove', anim: 'dance', hue: '#ec4899', ms: 0 },
    { id: 'disco', name: 'Disco', anim: 'disco', hue: '#a855f7', ms: 0 }, { id: 'shuffle', name: 'Shuffle', anim: 'shuffle', hue: '#22c55e', ms: 0 },
    { id: 'robot', name: 'Robot', anim: 'robot', hue: '#06b6d4', ms: 0 }, { id: 'cheer', name: 'Cheer', anim: 'cheer', hue: '#f59e0b', ms: 3000 },
    { id: 'bow', name: 'Bow', anim: 'bow', hue: '#f43f5e', ms: 2700 }, { id: 'flex', name: 'Flex', anim: 'flex', hue: '#f97316', ms: 3200 }, { id: 'jump', name: 'Hop', anim: 'jump', hue: '#14b8a6', ms: 3000 }
  ];
  const emotes = {
    cfg: null, list: [], cur: null, until: 0, btn: null, wheel: null,
    reload() { const p = profile(); const ids = Array.isArray(p.emotes) && p.emotes.length ? p.emotes : ['wave', 'dance', 'cheer', 'bow']; this.list = ids.map(id => EM_ALL.find(e => e.id === id)).filter(Boolean).slice(0, 6); if (this.wheel && this.wheel.classList.contains('on')) this.open(); },
    // cfg: {play(anim, emote), onStop(), canEmote(): bool}
    install(cfg) {
      this.cfg = cfg || {}; this.reload();
      if (!this.btn) {
        const b = document.createElement('button'); b.id = 'gk-emo'; b.type = 'button'; b.setAttribute('aria-label', 'Emotes'); b.title = 'Emotes (B)'; b.textContent = '😀'; document.body.appendChild(b);
        b.addEventListener('click', () => this.toggle()); this.btn = b;
        const w = document.createElement('div'); w.id = 'gk-wheel'; w.innerHTML = '<div class="ring"></div><button type="button" class="x" aria-label="Close">✕</button><div class="tip">Tap an emote · B closes · moving stops it</div>'; document.body.appendChild(w);
        w.addEventListener('click', e => { const em = e.target.closest('[data-em]'); if (em) { this.play(em.dataset.em); this.close(); } else if (e.target.closest('.x') || e.target === w) this.close(); });
        this.wheel = w;
        document.addEventListener('keydown', e => {
          if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
          const k = e.key.toLowerCase();
          if (k === 'b') { this.toggle(); e.preventDefault(); }
          else if (w.classList.contains('on')) { if (e.key === 'Escape') this.close(); const n = +e.key; if (n >= 1 && n <= this.list.length) { this.play(this.list[n - 1].id); this.close(); e.preventDefault(); } }
        });
      }
      // the button shows only while the game says an emote is possible (in a run, not on a menu)
      clearInterval(this._vis); this._vis = setInterval(() => this.show(!this.cfg.canEmote || this.cfg.canEmote()), 400);
    },
    show(on) { if (this.btn) this.btn.classList.toggle('on', !!on && !!(this.cfg)); if (!on && this.wheel && this.wheel.classList.contains('on')) this.close(); },
    toggle() { if (!this.wheel) return; if (this.wheel.classList.contains('on')) this.close(); else this.open(); },
    open() {
      if (!this.cfg || (this.cfg.canEmote && !this.cfg.canEmote())) return;
      const ring = this.wheel.querySelector('.ring'), n = this.list.length, R = Math.min(150, Math.min(innerWidth, innerHeight) * 0.3);
      ring.innerHTML = this.list.map((e, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / n, x = Math.cos(a) * R, y = Math.sin(a) * R;
        return '<button type="button" class="em" data-em="' + e.id + '" style="left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px;--c:' + e.hue + ';animation-delay:' + (i * 35) + 'ms"><kbd>' + (i + 1) + '</kbd><i>' + (EM_ICON[e.id] || '✨') + '</i>' + esc(e.name) + '</button>'; }).join('');
      this.wheel.classList.add('on'); buzz(6);
    },
    close() { if (this.wheel) this.wheel.classList.remove('on'); },
    play(id) {
      const e = EM_ALL.find(x => x.id === id); if (!e || !this.cfg) return;
      this.cur = e; this.until = e.ms ? performance.now() + e.ms : Infinity; buzz(10);
      try { this.cfg.play && this.cfg.play(e.anim, e); } catch (x) {}
    },
    stop() { if (!this.cur) return; this.cur = null; this.until = 0; try { this.cfg && this.cfg.onStop && this.cfg.onStop(); } catch (x) {} },
    // call each frame: the animation to play instead of idle, or null. Moving (or anything else the game decides) stops it.
    anim(moving) { if (!this.cur) return null; if (moving || performance.now() > this.until) { this.stop(); return null; } return this.cur.anim; },
    active() { return !!this.cur; }
  };

  /* ---------- 3D helpers (pass the game's THREE) ---------- */
  // a solid block for a plot that isn't open yet, with LOCKED / COMING SOON on every side. size in the game's units (a vec3-like {x,y,z} or a number)
  function lockedCube(THREE, o) {
    o = o || {}; const sz = typeof o.size === 'number' ? { x: o.size, y: o.size, z: o.size } : Object.assign({ x: 100, y: 100, z: 100 }, o.size || {});
    const text = (o.text || 'LOCKED').toUpperCase(), col = o.color || '#2a2f3a', ink = o.ink || '#f8fafc', accent = o.accent || '#fbbf24';
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 512, 512);
    // a soft bevel and a stripe
    const grad = g.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 498);
    g.fillStyle = accent; g.fillRect(0, 196, 512, 120);
    g.fillStyle = '#1a1205'; g.font = '900 ' + (text.length > 8 ? 72 : 100) + 'px "Fredoka","Arial Rounded MT Bold",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 256);
    if (o.sub) { g.fillStyle = ink; g.font = '700 40px "Fredoka",system-ui,sans-serif'; g.fillText(String(o.sub).toUpperCase(), 256, 380); }
    // a padlock glyph on top
    g.fillStyle = ink; g.font = '96px system-ui,sans-serif'; g.fillText(text.indexOf('SOON') >= 0 ? '🚧' : '🔒', 256, 110);
    const tex = new THREE.CanvasTexture(cv); if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else if ('encoding' in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const top = new THREE.MeshLambertMaterial({ color: new THREE.Color(col).offsetHSL(0, 0, 0.08) });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), [mat, mat, top, top, mat, mat]);
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.locked = true; mesh.name = 'gk-locked';
    return mesh;
  }
  // a tiny prop for a sparse spot: one block or smaller, no collision (the game never adds it to its collision), muted colours.
  // kinds: 'crate', 'barrel', 'plant', 'rock', 'sign', 'lamp', 'bench', 'cone', 'bag', 'box', 'mushroom', 'bones', 'bucket', 'stool', 'flower'
  const PROP_KINDS = { dungeon: ['crate', 'barrel', 'bones', 'rock', 'mushroom', 'bucket'], cave: ['rock', 'mushroom', 'bones', 'crystal'], town: ['plant', 'bench', 'lamp', 'sign', 'cone', 'bag', 'box', 'flower'],
    mall: ['plant', 'bench', 'sign', 'bag', 'box', 'stool'], garden: ['plant', 'flower', 'rock', 'stool', 'bucket'], shop: ['box', 'bag', 'stool', 'plant', 'sign'], outdoor: ['rock', 'plant', 'flower', 'cone', 'crate', 'barrel'] };
  function rng(seed) { let a = (typeof seed === 'number' ? seed : [...String(seed || 'p')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function prop(THREE, kind, seed, o) {
    o = o || {}; const r = rng(seed); const B = o.block || 100;   // one block, in the game's units
    const mats = {}; const M = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
    const g = new THREE.Group(); g.name = 'gk-prop'; g.userData.prop = kind; g.userData.noCollide = true;
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * B, h * B, d * B), M(c)); m.position.set((x || 0) * B, (y || h / 2) * B, (z || 0) * B); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    const cyl = (rt, rb, h, c, x, y, z, n) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt * B, rb * B, h * B, n || 10), M(c)); m.position.set((x || 0) * B, (y || h / 2) * B, (z || 0) * B); m.castShadow = true; g.add(m); return m; };
    const pick = a => a[Math.floor(r() * a.length)];
    if (Array.isArray(kind)) kind = pick(kind); if (PROP_KINDS[kind]) kind = pick(PROP_KINDS[kind]);
    const wood = pick(['#7a5a3a', '#6b4e30', '#8a6a44']), leaf = pick(['#3f8a4a', '#4a9a52', '#2f7a3f']), pot = pick(['#9a5a3a', '#6b6b78', '#b8865b']);
    switch (kind) {
      case 'crate': { const s = 0.55 + r() * 0.35; box(s, s, s, wood); box(s + 0.02, 0.06, 0.08, '#5a3f26', 0, s / 2, 0); box(0.08, s + 0.02, 0.06, '#5a3f26', 0, s / 2, 0); break; }
      case 'barrel': { const h = 0.6 + r() * 0.3; cyl(0.26, 0.26, h, wood, 0, h / 2, 0, 12); cyl(0.275, 0.275, 0.06, '#3a3a40', 0, h * 0.22, 0, 12); cyl(0.275, 0.275, 0.06, '#3a3a40', 0, h * 0.78, 0, 12); break; }
      case 'plant': { cyl(0.2, 0.15, 0.3, pot, 0, 0.15, 0, 10); const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, m = box(0.08, 0.42, 0.08, leaf, Math.cos(a) * 0.07, 0.5, Math.sin(a) * 0.07); m.rotation.z = (r() - 0.5) * 0.7; m.rotation.x = (r() - 0.5) * 0.7; } break; }
      case 'flower': { const c = pick(['#f472b6', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa']); box(0.05, 0.3, 0.05, '#3f8a4a', 0, 0.15, 0); box(0.16, 0.12, 0.16, c, 0, 0.34, 0); box(0.06, 0.06, 0.06, '#fde68a', 0, 0.41, 0); break; }
      case 'rock': { const s = 0.3 + r() * 0.5; const m = box(s, s * 0.6, s * 0.8, pick(['#6b7280', '#7c7f88', '#5b616e'])); m.rotation.y = r() * Math.PI; m.position.y = s * 0.3 * B; break; }
      case 'crystal': { const c = pick(['#67e8f9', '#c084fc', '#fde047']); const m = new THREE.Mesh(new THREE.ConeGeometry(0.12 * B, 0.5 * B, 5), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 })); m.position.y = 0.25 * B; m.rotation.z = (r() - 0.5) * 0.4; g.add(m); break; }
      case 'sign': { box(0.08, 0.7, 0.08, wood, 0, 0.35, 0); box(0.6, 0.3, 0.06, '#d9c9a3', 0, 0.78, 0); box(0.42, 0.04, 0.07, '#5a4a30', 0, 0.8, 0); box(0.3, 0.04, 0.07, '#5a4a30', -0.03, 0.72, 0); break; }
      case 'lamp': { box(0.16, 0.08, 0.16, '#3a3a40', 0, 0.04, 0); cyl(0.03, 0.04, 0.72, '#3a3a40', 0, 0.42, 0, 8); const m = box(0.18, 0.18, 0.18, '#fde68a', 0, 0.86, 0); m.material = new THREE.MeshLambertMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 0.6 }); break; }
      case 'bench': { box(0.9, 0.08, 0.3, wood, 0, 0.42, 0); box(0.08, 0.4, 0.26, '#3a3a40', -0.38, 0.2, 0); box(0.08, 0.4, 0.26, '#3a3a40', 0.38, 0.2, 0); break; }
      case 'cone': { cyl(0.04, 0.16, 0.5, '#f97316', 0, 0.27, 0, 10); box(0.36, 0.04, 0.36, '#f97316', 0, 0.02, 0); cyl(0.09, 0.12, 0.08, '#ffffff', 0, 0.3, 0, 10); break; }
      case 'bag': { const c = pick(['#f472b6', '#60a5fa', '#fbbf24', '#34d399']); box(0.36, 0.42, 0.22, c, 0, 0.21, 0); box(0.3, 0.05, 0.03, c, 0, 0.46, 0); break; }
      case 'box': { const s = 0.4 + r() * 0.3; box(s, s * 0.7, s, pick(['#c89b6a', '#b98a5c'])); box(s + 0.02, 0.05, 0.1, '#8a6a44', 0, s * 0.35, 0); break; }
      case 'mushroom': { cyl(0.06, 0.08, 0.26, '#e7e0cf', 0, 0.13, 0, 8); const m = cyl(0.02, 0.22, 0.14, pick(['#dc2626', '#a16207', '#c084fc']), 0, 0.32, 0, 10); m.castShadow = true; break; }
      case 'bones': { const m = box(0.5, 0.06, 0.07, '#e7e0cf', 0, 0.04, 0); m.rotation.y = r() * Math.PI; box(0.16, 0.14, 0.14, '#e7e0cf', 0.22, 0.08, 0.1); break; }
      case 'bucket': { cyl(0.16, 0.13, 0.3, '#4b5563', 0, 0.15, 0, 10); const m = box(0.34, 0.03, 0.03, '#374151', 0, 0.32, 0); m.rotation.y = r() * Math.PI; break; }
      case 'stool': { cyl(0.18, 0.18, 0.06, wood, 0, 0.4, 0, 12); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; cyl(0.025, 0.025, 0.38, wood, Math.cos(a) * 0.12, 0.19, Math.sin(a) * 0.12, 6); } break; }
      default: { box(0.4, 0.4, 0.4, pick(['#9ca3af', '#a1a1aa'])); }
    }
    g.rotation.y = r() * Math.PI * 2; g.scale.setScalar(o.scale || 0.85 + r() * 0.15);
    return g;
  }
  // a flashy pet for a bot: a glowing little critter that trails behind. Returns {group, update(dt, ownerPos, ownerYaw)}
  const PET_LOOKS = [
    { body: '#f472b6', glow: '#ff7ac6', eyes: '#1f2937', ear: true, halo: true, name: 'Neon Bunny' }, { body: '#fbbf24', glow: '#ffd166', eyes: '#1f2937', wings: true, name: 'Gold Finch' },
    { body: '#a78bfa', glow: '#c4b5fd', eyes: '#ffffff', halo: true, name: 'Void Kitten' }, { body: '#34d399', glow: '#6ee7b7', eyes: '#064e3b', wings: true, name: 'Jade Duck' },
    { body: '#22d3ee', glow: '#67e8f9', eyes: '#0c4a6e', ear: true, name: 'Frost Fox' }, { body: '#f87171', glow: '#fca5a5', eyes: '#111827', halo: true, wings: true, name: 'Ember Pup' }
  ];
  function pet(THREE, seed, o) {
    o = o || {}; const r = rng(seed), B = o.block || 100, L = PET_LOOKS[Math.floor(r() * PET_LOOKS.length)];
    const g = new THREE.Group(); g.name = 'gk-pet'; g.userData.pet = L.name;
    const bodyM = new THREE.MeshLambertMaterial({ color: L.body, emissive: L.glow, emissiveIntensity: 0.45 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28 * B, 0.24 * B, 0.3 * B), bodyM); body.position.y = 0.3 * B; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22 * B, 0.2 * B, 0.2 * B), bodyM); head.position.set(0, 0.5 * B, 0.08 * B); g.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: L.eyes });
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04 * B, 0.05 * B, 0.02 * B), eyeM); e.position.set(s * 0.06 * B, 0.52 * B, 0.19 * B); g.add(e); });
    if (L.ear) [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05 * B, 0.18 * B, 0.05 * B), bodyM); e.position.set(s * 0.07 * B, 0.68 * B, 0.06 * B); e.rotation.z = -s * 0.15; g.add(e); });
    const wings = [];
    if (L.wings) [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.22 * B, 0.03 * B, 0.14 * B), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: L.glow, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 })); w.position.set(s * 0.2 * B, 0.4 * B, -0.02 * B); w.userData.s = s; g.add(w); wings.push(w); });
    let halo = null;
    if (L.halo) { halo = new THREE.Mesh(new THREE.TorusGeometry(0.13 * B, 0.02 * B, 6, 18), new THREE.MeshBasicMaterial({ color: L.glow })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.76 * B; g.add(halo); }
    const sparkM = new THREE.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.9 });
    const sparks = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04 * B, 0.04 * B, 0.04 * B), sparkM); s.userData.p = r(); s.userData.a = r() * Math.PI * 2; g.add(s); sparks.push(s); }
    const light = o.light === false ? null : new THREE.PointLight(L.glow, 0.6, 2.2 * B); if (light) { light.position.y = 0.4 * B; g.add(light); }
    let t = r() * 10, yaw = 0; const target = new THREE.Vector3(), tmp = new THREE.Vector3();
    g.userData.update = function (dt, owner, ownerYaw) {
      t += dt;
      if (owner) {
        // trail behind and a little to the side of the owner
        const back = ownerYaw == null ? 0 : ownerYaw;
        target.set(owner.x - Math.sin(back) * 0.9 * B + Math.cos(back) * 0.5 * B, owner.y, owner.z - Math.cos(back) * 0.9 * B - Math.sin(back) * 0.5 * B);
        tmp.copy(target).sub(g.position); const d = tmp.length();
        if (d > 0.05 * B) { const sp = Math.min(d, (0.6 * B + d * 3) * dt); g.position.addScaledVector(tmp.normalize(), sp); yaw = Math.atan2(tmp.x, tmp.z); }
        g.rotation.y += (yaw - g.rotation.y) * Math.min(1, dt * 8);
      }
      const hop = Math.abs(Math.sin(t * 6)) * 0.08 * B; body.position.y = (0.3 + (L.wings ? 0.25 : 0)) * B + hop; head.position.y = body.position.y + 0.2 * B;
      wings.forEach(w => { w.position.y = body.position.y + 0.1 * B; w.rotation.z = w.userData.s * Math.sin(t * 14) * 0.7; });
      if (halo) { halo.position.y = head.position.y + 0.26 * B + Math.sin(t * 3) * 0.02 * B; halo.rotation.z = t; }
      sparks.forEach(s => { const p = (s.userData.p + t * 0.35) % 1; const a = s.userData.a + t * 1.5; s.position.set(Math.cos(a) * 0.3 * B, (0.15 + p * 0.7) * B, Math.sin(a) * 0.3 * B); s.scale.setScalar(1 - p * 0.8); s.rotation.y = t * 3; });
      if (light) light.intensity = 0.45 + Math.sin(t * 5) * 0.15;
    };
    return { group: g, update: g.userData.update, look: L };
  }

  /* ---------- boot ---------- */
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(() => { autoWatch(); watchLobbies(); freeTick(); });

  root.GK = { GAME, profile, prefs, hint, center, watch, pop, compact, stamina, tutorial, skillSeen, markSkill, crate, free, freeLeft, emotes, lockedCube, prop, pet, PROP_KINDS, buzz, reduce, rng,
    // the kit's bridge state (set by games that want GK to know the app's state)
    state: null };
})(window);
