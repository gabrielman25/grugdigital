// Grug Arcade: local multiplayer (couch co-op on one screen, no split screen).
//
// Player 1 plays with the keyboard, mouse or touch as always. Gamepads add more players:
//   - the first controller that's used asks "Player 1 or Player 2?". Player 1: it drives your own character (and the
//     camera, with the right stick). Player 2: it gets a new character next to yours.
//   - every controller after that joins straight away as the next free player (3, 4, 5...).
//   - the extra players move relative to Player 1's camera (push up = away from the camera), have the same abilities as
//     Player 1, and aim with a crosshair of their own on the screen (right stick). A game teleports them back to Player 1
//     when they get too far away.
//   - Xbox Wireless Controllers are the ones we recommend and test with, but any controller the browser can see is accepted, standard or not. One that isn't a standard layout (a bootleg pad, a
//     USB SNES pad, an arcade stick...) asks once: use the default controls, or set up its buttons one by one. The answer
//     is kept in this browser (localStorage 'grug.gamepads.v1'); "Controllers" in the Game Menu changes it later.
//
// A game wires it up with one object (see GrugLocalMP.init below) and calls GrugLocalMP.frame(dt) at the start of
// each frame (reads the pads, spawns or removes players, runs the game's own per-player code) and GrugLocalMP.draw()
// after the camera has been placed (crosshairs and the P2/P3... tags over heads).
(() => {
  if (window.GrugLocalMP) return;
  const KEY = 'grug.gamepads.v1', MAXP = 8, DEAD = 0.2;
  const COLORS = ['#ffe36b', '#ffe36b', '#4aa8ff', '#ff5a4a', '#5fd35a', '#c46cff', '#ff9a2a', '#2ad6c8', '#ff6ad0'];
  const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  const PRETTY = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', back: 'Back / Select', start: 'Start', ls: 'Left stick click', rs: 'Right stick click', up: 'D-pad up', down: 'D-pad down', left: 'D-pad left', right: 'D-pad right' };
  const STD = { lx: { a: 0, s: 1 }, ly: { a: 1, s: 1 }, rx: { a: 2, s: 1 }, ry: { a: 3, s: 1 } };
  NAMES.forEach((n, i) => { STD[n] = { b: i }; });
  // Chrome/Edge report a DirectInput hat switch as one axis: these are its values (-1 up, going round clockwise)
  const HAT = [[-1, 'up'], [-0.714, 'up right'], [-0.429, 'right'], [-0.143, 'down right'], [0.143, 'down'], [0.429, 'down left'], [0.714, 'left'], [1, 'up left']];

  let store = { pads: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.pads) store = s; } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } };

  const G = { cfg: null, pads: new Map(), slots: new Map(), queue: [], dlg: null, panel: null, asked: false, t: 0, els: {}, navFocus: null, navT: 0 };
  // ---------------------------------------------------------------- reading a pad through its mapping
  const raw = () => { try { return Array.from((navigator.getGamepads && navigator.getGamepads()) || []); } catch (e) { return []; } };
  function bval(gp, bind) {
    if (!bind || !gp) return 0;
    if (bind.b !== undefined) { const b = gp.buttons[bind.b]; return b ? (typeof b === 'object' ? Math.max(b.value || 0, b.pressed ? 1 : 0) : b) : 0; }
    if (bind.a !== undefined) { const v = gp.axes[bind.a]; if (v === undefined) return 0; const r = bind.r || 0; return Math.max(0, Math.min(1, (v - r) * bind.s / (bind.span || 1))); }
    if (bind.h !== undefined) { const v = gp.axes[bind.h]; if (v === undefined || Math.abs(v) > 1.05) return 0; return hatDirs(v).includes(bind.d) ? 1 : 0; }
    return 0;
  }
  function hatDirs(v) { let best = null, bd = 0.12; for (const [hv, d] of HAT) { const e = Math.abs(v - hv); if (e < bd) { bd = e; best = d; } } return best ? best.split(' ') : []; }
  function aval(gp, bind) { if (!bind || bind.a === undefined || !gp) return 0; const v = gp.axes[bind.a]; return v === undefined ? 0 : Math.max(-1, Math.min(1, v * bind.s)); }
  // a guess at a non-standard pad's layout: buttons in the usual order, sticks on the axes that rest at 0, a hat switch as the d-pad
  function guessMap(gp) {
    const m = {}, rest = gp.axes.map(v => v);
    const n = gp.buttons.length; NAMES.forEach((k, i) => { if (i < n && i < 12) m[k] = { b: i }; });
    if (n >= 16) for (let i = 12; i < 16; i++) m[NAMES[i]] = { b: i };
    const sticks = [], hats = [], trig = [];
    rest.forEach((v, i) => { if (Math.abs(v) > 1.05) hats.push(i); else if (Math.abs(v) > 0.85) trig.push(i); else sticks.push(i); });
    if (sticks.length >= 2) { m.lx = { a: sticks[0], s: 1 }; m.ly = { a: sticks[1], s: 1 }; }
    if (sticks.length >= 4) { m.rx = { a: sticks[2], s: 1 }; m.ry = { a: sticks[3], s: 1 }; }
    else if (sticks.length === 3 && gp.axes.length >= 6) { m.rx = { a: sticks[2], s: 1 }; m.ry = { a: 5, s: 1 }; }
    if (hats.length && !m.up) { const h = hats[0]; for (const d of ['up', 'down', 'left', 'right']) m[d] = { h, d }; }
    // pads with no buttons 12-15 and only two axes (USB SNES / NES pads): the d-pad *is* axes 0,1, already the left stick
    if (trig.length >= 2 && (!m.lt || !m.rt || n < 8)) { m.lt = { a: trig[0], s: 1, r: -1, span: 2 }; m.rt = { a: trig[1], s: 1, r: -1, span: 2 }; }
    return m;
  }
  const unusual = gp => gp.mapping !== 'standard';
  function mapFor(P) {
    const saved = store.pads[P.id];
    if (saved && saved.map && saved.choice === 'custom') return saved.map;
    return P.std ? STD : (P.guess || STD);
  }
  // ---------------------------------------------------------------- the per-player state the games read
  class PadState {
    constructor(slot) { this.slot = slot; this.color = COLORS[slot] || '#fff'; this.label = 'P' + slot; this.v = {}; this.p = {}; this.lx = this.ly = this.rx = this.ry = 0; this.cursor = null; this.handle = null; this.pad = null; this.hasRight = true; this.idle = 0; }
    down(n) { return (this.v[n] || 0) > 0.5; }
    hit(n) { return (this.v[n] || 0) > 0.5 && !((this.p[n] || 0) > 0.5); }
    up(n) { return !((this.v[n] || 0) > 0.5) && (this.p[n] || 0) > 0.5; }
    val(n) { return this.v[n] || 0; }
    get any() { return NAMES.some(n => this.hit(n)); }
  }
  function readPad(P, gp, S) {
    const m = mapFor(P);
    S.p = S.v; S.v = {};
    for (const n of NAMES) S.v[n] = bval(gp, m[n]);
    let lx = aval(gp, m.lx), ly = aval(gp, m.ly), rx = aval(gp, m.rx), ry = aval(gp, m.ry);
    const dz = (x, y) => { const l = Math.hypot(x, y); if (l < DEAD) return [0, 0]; const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l; return [x * k, y * k]; };
    [lx, ly] = dz(lx, ly); [rx, ry] = dz(rx, ry);
    // the d-pad moves too when the stick is still (pads with no sticks, and for anyone who prefers it)
    if (!lx && !ly) { lx = S.v.right - S.v.left; ly = S.v.down - S.v.up; const l = Math.hypot(lx, ly); if (l > 1) { lx /= l; ly /= l; } }
    S.lx = lx; S.ly = ly; S.rx = rx; S.ry = ry; S.hasRight = !!m.rx;
    S.idle = (lx || ly || rx || ry || NAMES.some(n => S.v[n] > 0.5)) ? 0 : S.idle + G.dt;
  }
  // ---------------------------------------------------------------- pads coming and going
  function poll() {
    const list = raw(), seen = new Set();
    for (const gp of list) {
      if (!gp || gp.connected === false) continue; seen.add(gp.index);
      let P = G.pads.get(gp.index);
      if (P && P.id !== gp.id) { drop(P, true); P = null; }
      if (!P) { P = { index: gp.index, id: gp.id || 'Controller', std: !unusual(gp), slot: 0, state: null, live: false, rest: gp.axes.slice(), guess: null }; P.guess = P.std ? null : guessMap(gp); G.pads.set(gp.index, P); }
      P.gp = gp;
      if (!P.live) {   // it only counts once something is pressed (some devices show up as pads but never are)
        const pressed = gp.buttons.some(b => b && (b.pressed || b.value > 0.6)) || gp.axes.some((v, i) => Math.abs(v - (P.rest[i] || 0)) > 0.6 && Math.abs(v) <= 1.05);
        if (pressed) { P.live = true; P.rest = P.rest.map((v, i) => i < gp.axes.length ? (Math.abs(v) > 1.05 ? v : P.rest[i]) : v); if (!P.guess && !P.std) P.guess = guessMap(gp); if (!G.queue.includes(P)) G.queue.push(P); }
      }
    }
    for (const P of [...G.pads.values()]) if (!seen.has(P.index)) drop(P, false);
  }
  function drop(P, silent) {
    G.pads.delete(P.index); G.queue = G.queue.filter(q => q !== P);
    if (G.dlg && G.dlg.P === P) closeDlg();
    if (P.slot === 1) { const S = G.slots.get(1); if (S) { S.pad = null; G.slots.delete(1); callCfg('p1Release', S); } if (!silent) toast('Player 1\'s controller disconnected: back to the keyboard'); }
    else if (P.slot > 1) { removeSlot(P.slot); if (!silent) toast(`Player ${P.slot}'s controller disconnected`); }
    P.slot = 0; renderPanel();
  }
  function freeSlot() { for (let s = 2; s <= MAXP; s++) if (!G.slots.has(s)) return s; return 0; }
  function assign(P, slot) {
    if (!slot) { toast('Every player slot is taken'); return; }
    if (slot === 1) { const old = G.slots.get(1); if (old && old.pad && old.pad !== P) { old.pad.slot = 0; G.queue.push(old.pad); } }
    P.slot = slot; const S = new PadState(slot); S.pad = P; G.slots.set(slot, S);
    if (slot === 1) { callCfg('p1Grab', S); toast('Controller is now Player 1'); }
    else { spawnSlot(S); toast(`Player ${slot} joined! (${shortName(P.id)})`); }
    rumble(P, 0.25, 160); renderPanel();
  }
  function spawnSlot(S) {
    S.cursor = { x: innerWidth / 2 + ((S.slot % 2) ? 60 : -60) * Math.ceil((S.slot - 1) / 2), y: innerHeight / 2 };
    try { S.handle = G.cfg.spawn(S); } catch (e) { console.error('Local multiplayer: spawn failed', e); S.handle = null; }
    ensureEls(S);
  }
  function removeSlot(slot) {
    const S = G.slots.get(slot); if (!S) return; G.slots.delete(slot);
    try { if (S.handle) G.cfg.despawn(S.handle, S); } catch (e) { console.error('Local multiplayer: despawn failed', e); }
    const E = G.els[slot]; if (E) { E.xh.remove(); E.tag.remove(); delete G.els[slot]; }
  }
  const shortName = id => String(id).replace(/\(.*?Vendor.*?\)/i, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Controller';
  function rumble(P, k, ms) { try { const a = P.gp && P.gp.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: k, weakMagnitude: k }).catch(() => { }); } catch (e) { } }
  function callCfg(n, ...a) { try { if (G.cfg && G.cfg[n]) return G.cfg[n](...a); } catch (e) { console.error('Local multiplayer: ' + n, e); } }

  // ---------------------------------------------------------------- the classic-look boxes: dialogs, the Controllers panel, toasts
  const CSS = `
  .lmp-box { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9000; width: min(360px, 92vw); max-height: 90vh; overflow-y: auto; box-sizing: border-box; padding: 8px 16px 12px; background: rgba(25,25,25,.92); border: 1px solid #8a8a8a; border-radius: 3px; color: #fff; font: bold 13px/1.35 Arial, Helvetica, sans-serif; text-align: center; user-select: none; }
  .lmp-box .lmp-t { font-size: 19px; padding: 2px 0 8px; margin-bottom: 6px; border-bottom: 1px solid #555; }
  .lmp-box p { margin: 6px 0; font-size: 13px; color: #ddd; } .lmp-box p small { color: #aaa; font-size: 11px; }
  .lmp-box button { display: block; width: 100%; margin: 7px 0; padding: 7px 6px; font: bold 14px Arial, sans-serif; color: #fff; border-radius: 3px; background: #1b1b1b; border: 2px solid #d0d0d0; cursor: pointer; }
  .lmp-box button:hover, .lmp-box button.lmp-f, .lmp-nav { background: #4a1010 !important; border-color: #d8281f !important; }
  .lmp-box .lmp-row { display: flex; gap: 6px; } .lmp-box .lmp-row button { flex: 1; }
  .lmp-box .lmp-pad { text-align: left; margin: 8px 0; padding: 6px 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.2); }
  .lmp-box .lmp-pad b { font-size: 14px; } .lmp-box .lmp-pad small { display: block; color: #bbb; font-size: 11px; margin: 2px 0 4px; word-break: break-word; }
  .lmp-box .lmp-pad .lmp-row button { margin: 3px 0; padding: 4px; font-size: 12px; }
  .lmp-box .lmp-help { text-align: left; font-size: 12px; font-weight: normal; color: #ddd; line-height: 1.5; } .lmp-box .lmp-help b { color: #fff; }
  .lmp-big { font-size: 22px; margin: 10px 0; color: #ffe36b; }
  .lmp-ol { text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; }
  .lmp-toast { position: fixed; left: 50%; top: 30%; transform: translateX(-50%); z-index: 8999; padding: 6px 14px; background: rgba(0,0,0,.6); color: #fff; font: bold 16px Arial, sans-serif; pointer-events: none; white-space: nowrap; transition: opacity .4s; }
  .lmp-xh { position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 30; pointer-events: none; }
  .lmp-xh i { position: absolute; left: -13px; top: -13px; width: 22px; height: 22px; border: 2px solid currentColor; border-radius: 50%; box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #000; }
  .lmp-xh i::before, .lmp-xh i::after { content: ''; position: absolute; background: currentColor; box-shadow: 0 0 0 1px #000; }
  .lmp-xh i::before { left: 10px; top: 4px; width: 2px; height: 14px; } .lmp-xh i::after { top: 10px; left: 4px; height: 2px; width: 14px; }
  .lmp-xh b { position: absolute; left: 14px; top: 8px; font: bold 13px Arial, sans-serif; }
  .lmp-xh.off { opacity: .35; }
  .lmp-tag { position: fixed; left: 0; top: 0; z-index: 29; pointer-events: none; font: bold 15px Arial, sans-serif; white-space: nowrap; }
  .lmp-tag { text-align: center; } .lmp-tag.edge span::after { content: ' \\25B2'; }
  .lmp-tag i { display: block; width: 44px; height: 5px; margin: 1px auto 0; background: rgba(0,0,0,.55); border: 1px solid #000; } .lmp-tag i u { display: block; height: 100%; background: #5ad15a; }
  .lmp-tag i.lo u { background: #ff5a4a; }
  .lmp-veil { position: fixed; inset: 0; z-index: 8998; background: rgba(0,0,0,.25); }
  `;
  function ensureCSS() { if (document.getElementById('lmp-css')) return; const s = document.createElement('style'); s.id = 'lmp-css'; s.textContent = CSS; document.head.appendChild(s); }
  let toastEl = null, toastT = 0;
  function toast(t, sec = 2.6) {
    ensureCSS(); if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'lmp-toast lmp-ol'; document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, sec * 1000);
  }
  function ensureEls(S) {
    ensureCSS(); if (G.els[S.slot]) return;
    const xh = document.createElement('div'); xh.className = 'lmp-xh'; xh.style.color = S.color; xh.innerHTML = `<i></i><b class="lmp-ol">${S.label}</b>`;
    const tag = document.createElement('div'); tag.className = 'lmp-tag lmp-ol'; tag.style.color = S.color; tag.innerHTML = `<span>${S.label}</span><i><u></u></i>`;
    document.body.append(xh, tag); G.els[S.slot] = { xh, tag };
  }
  // a dialog: buttons navigable with the pad that asked (stick / d-pad, any face button picks), the mouse, touch or Enter
  function openDlg(P, html, buttons, onPick) {
    closeDlg(); ensureCSS();
    const veil = document.createElement('div'); veil.className = 'lmp-veil';
    const box = document.createElement('div'); box.className = 'lmp-box lmp-ol'; box.innerHTML = html;
    const wrap = document.createElement('div'); wrap.className = buttons.length === 2 ? 'lmp-row' : '';
    const btns = buttons.map((b, i) => { const e = document.createElement('button'); e.className = 'lmp-ol'; e.textContent = b; e.addEventListener('click', () => { closeDlg(); onPick(i); }); wrap.appendChild(e); return e; });
    box.appendChild(wrap); document.body.append(veil, box);
    G.dlg = { P, box, veil, btns, sel: 0, onPick, wait: true }; markSel(); return G.dlg;
  }
  function markSel() { const D = G.dlg; if (!D) return; D.btns.forEach((b, i) => b.classList.toggle('lmp-f', i === D.sel)); }
  function closeDlg() { const D = G.dlg; if (!D) return; D.box.remove(); D.veil.remove(); if (D.timer) clearInterval(D.timer); G.dlg = null; }
  function dlgInput() {
    const D = G.dlg; if (!D || !D.P || !D.P.gp || D.remap) return;
    const gp = D.P.gp, anyBtn = gp.buttons.some(b => b && (b.pressed || b.value > 0.6));
    const ax = gp.axes.find((v, i) => Math.abs(v) <= 1.05 && Math.abs(v - (D.P.rest[i] || 0)) > 0.6);
    const hat = gp.axes.find(v => Math.abs(v) <= 1.05 && hatDirs(v).length && D.P.rest.some(r => Math.abs(r) > 1.05));
    if (D.wait) { if (!anyBtn && ax === undefined) D.wait = false; return; }   // let go of whatever woke it up first
    if (ax !== undefined || hat !== undefined) { if (!D.moved) { D.moved = true; D.sel = (D.sel + ((ax !== undefined ? ax : 1) > 0 ? 1 : D.btns.length - 1)) % D.btns.length; markSel(); rumble(D.P, 0.1, 40); } }
    else D.moved = false;
    if (anyBtn) { const i = D.sel, f = D.onPick; closeDlg(); f(i); }
  }
  // ---------------------------------------------------------------- the questions
  function nextQuestion() {
    if (G.dlg || G.panel || !G.queue.length || !G.cfg) return;
    const P = G.queue.shift(); if (!G.pads.has(P.index) || P.slot) return;
    const name = shortName(P.id);
    if (!P.std && !store.pads[P.id]) {
      openDlg(P, `<div class="lmp-t">New controller</div><p>${esc(name)}</p><p>This controller doesn't use a standard layout. Play with the default controls, or set its buttons up one at a time?</p><p><small>Xbox Wireless Controllers work best: they need no setup.</small></p><p><small>You can change this any time: Game Menu › Controllers.</small></p>`,
        ['Use default controls', 'Set up buttons'], i => {
          if (i === 0) { store.pads[P.id] = { choice: 'default' }; save(); G.queue.unshift(P); }
          else remap(P, () => G.queue.unshift(P));
        });
      return;
    }
    const p1Pad = G.slots.get(1);
    if (!G.asked && !p1Pad) {
      G.asked = true;
      openDlg(P, `<div class="lmp-t">Controller connected</div><p>${esc(name)}</p><p>Who's playing with it?</p><p><small><b>Player 1</b>: it controls your character and the camera.<br><b>Player 2</b>: a second player joins next to you. Player 1 keeps the keyboard, mouse or touch.</small></p>`,
        ['Player 1', 'Player 2'], i => assign(P, i === 0 ? 1 : freeSlot()));
      return;
    }
    assign(P, freeSlot());
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ---------------------------------------------------------------- setting a pad's buttons up, one at a time
  function remapSteps() {
    const L = (G.cfg && G.cfg.labels) || {};
    const lab = n => L[n] ? ` <small>(${esc(L[n])})</small>` : '';
    return [
      ['ly', -1, 'Push the <b>left stick UP</b>' + (L.move ? ` <small>(${esc(L.move)})</small>` : '')], ['lx', 1, 'Push the <b>left stick RIGHT</b>'],
      ['ry', -1, 'Push the <b>right stick UP</b>' + (L.aim ? ` <small>(${esc(L.aim)})</small>` : '')], ['rx', 1, 'Push the <b>right stick RIGHT</b>'],
      ...['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'].map(n => [n, 0, `Press <b>${PRETTY[n]}</b>${lab(n)}`]),
    ];
  }
  function remap(P, done) {
    closeDlg(); ensureCSS();
    const steps = remapSteps(), map = {}, gp0 = () => P.gp;
    let i = 0, base = null, armed = false, left = 8;
    const veil = document.createElement('div'); veil.className = 'lmp-veil';
    const box = document.createElement('div'); box.className = 'lmp-box lmp-ol'; document.body.append(veil, box);
    const D = G.dlg = { P, box, veil, btns: [], remap: true };
    const snap = () => { const g = gp0(); return g ? { b: g.buttons.map(b => b ? (b.pressed || b.value > 0.5) : false), a: g.axes.slice() } : null; };
    const show = () => {
      if (i >= steps.length) return finish();
      box.innerHTML = `<div class="lmp-t">Set up buttons</div><p>${esc(shortName(P.id))}</p><div class="lmp-big">${steps[i][2]}</div><p><small>Step ${i + 1} of ${steps.length} · Skipping in <span id="lmpLeft">${left}</span> s if nothing is pressed</small></p>`;
      const row = document.createElement('div'); row.className = 'lmp-row';
      const sk = document.createElement('button'); sk.className = 'lmp-ol'; sk.textContent = 'Skip'; sk.onclick = () => next(null);
      const st = document.createElement('button'); st.className = 'lmp-ol'; st.textContent = 'Stop here'; st.onclick = () => finish();
      row.append(sk, st); box.appendChild(row);
    };
    const next = bind => { if (bind) map[steps[i][0]] = bind; i++; left = 8; armed = false; base = null; show(); };
    function finish() {
      clearInterval(D.timer); D.box.remove(); D.veil.remove(); G.dlg = null;
      const full = Object.assign({}, P.std ? STD : (P.guess || STD), map);
      if (map.ly && !map.lx) delete full.lx; if (map.ry && !map.rx) delete full.rx;
      store.pads[P.id] = { choice: 'custom', map: full }; save(); toast('Controller set up'); renderPanel();
      if (done) done();
    }
    D.timer = setInterval(() => { if (--left <= 0) next(null); else { const e = document.getElementById('lmpLeft'); if (e) e.textContent = left; } }, 1000);
    D.step = () => {
      const g = gp0(); if (!g) return; const cur = snap();
      if (!base) { // wait until everything's let go, then take the resting state
        const busy = cur.b.some(Boolean) || cur.a.some((v, k) => Math.abs(v) <= 1.05 && Math.abs(v - (P.rest[k] || 0)) > 0.35);
        if (!busy) { base = cur; armed = true; } return;
      }
      if (!armed) return;
      const [name, sgn] = steps[i];
      const bi = cur.b.findIndex((p, k) => p && !base.b[k]);
      let best = -1, bd = 0.6; cur.a.forEach((v, k) => { const d = Math.abs(v - base.a[k]); if (Math.abs(base.a[k]) > 1.05 ? Math.abs(v) <= 1.05 : d > bd) { if (d > bd || Math.abs(base.a[k]) > 1.05) { bd = d; best = k; } } });
      if (best >= 0) {
        const v = cur.a[best], b0 = base.a[best];
        if (Math.abs(b0) > 1.05) { const d = hatDirs(v)[0]; if (d) { left = 8; return next(sgn ? null : { h: best, d: ({ up: 'up', down: 'down', left: 'left', right: 'right' })[d] || d }); } return; }
        if (sgn) return next({ a: best, s: Math.sign(v - b0) * sgn });
        if (Math.abs(b0) > 0.85) return next({ a: best, s: Math.sign(v - b0), r: b0, span: 2 });   // a trigger that rests at -1
        return next({ a: best, s: Math.sign(v - b0) });
      }
      if (bi >= 0) return next(sgn ? null : { b: bi });
    };
    show();
  }
  // ---------------------------------------------------------------- the Controllers panel (Game Menu › Controllers)
  function openPanel() {
    ensureCSS(); closePanel();
    const veil = document.createElement('div'); veil.className = 'lmp-veil'; veil.onclick = closePanel;
    const box = document.createElement('div'); box.className = 'lmp-box lmp-ol'; document.body.append(veil, box);
    G.panel = { box, veil }; renderPanel(); callCfg('panel', true);
  }
  function closePanel() { if (!G.panel) return; G.panel.box.remove(); G.panel.veil.remove(); G.panel = null; callCfg('panel', false); }
  function renderPanel() {
    if (!G.panel) return; const box = G.panel.box, L = (G.cfg && G.cfg.help) || '';
    const pads = [...G.pads.values()].filter(P => P.live).sort((a, b) => (a.slot || 99) - (b.slot || 99));
    box.innerHTML = `<div class="lmp-t">Controllers</div>` + (pads.length ? '' : `<p>No controllers yet. Connect an Xbox Wireless Controller (USB cable or Bluetooth) and press any button on it.</p>`) + `<p><small>Controller not showing up? Steam can hold on to controllers while it's open: quit Steam, or turn off Steam Input for that controller, then press a button again. Other controllers often work too; Xbox ones work best.</small></p>`;
    for (const P of pads) {
      const d = document.createElement('div'); d.className = 'lmp-pad';
      const kind = P.std ? 'standard layout' : (store.pads[P.id] && store.pads[P.id].choice === 'custom' ? 'your button setup' : 'default controls (unusual layout)');
      d.innerHTML = `<b style="color:${COLORS[P.slot] || '#fff'}">${P.slot ? 'Player ' + P.slot : 'Not playing'}</b><small>${esc(shortName(P.id))} · ${kind}</small>`;
      const row = document.createElement('div'); row.className = 'lmp-row';
      const mk = (t, f) => { const b = document.createElement('button'); b.className = 'lmp-ol'; b.textContent = t; b.onclick = f; row.appendChild(b); };
      if (P.slot !== 1) mk('Make Player 1', () => { const s = P.slot; if (s > 1) removeSlot(s); P.slot = 0; assign(P, 1); renderPanel(); });
      else mk('Make Player 2', () => { G.slots.delete(1); callCfg('p1Release'); P.slot = 0; assign(P, freeSlot()); renderPanel(); });
      if (!P.slot) mk('Join', () => assign(P, freeSlot()));
      mk('Set up buttons', () => { closePanel(); remap(P, () => openPanel()); });
      if (!P.std && store.pads[P.id] && store.pads[P.id].choice === 'custom') mk('Default', () => { store.pads[P.id] = { choice: 'default' }; save(); renderPanel(); });
      d.appendChild(row); box.appendChild(d);
    }
    if (L) { const h = document.createElement('div'); h.className = 'lmp-help'; h.innerHTML = L; box.appendChild(h); }
    const c = document.createElement('button'); c.className = 'lmp-ol'; c.textContent = 'Back'; c.onclick = closePanel; box.appendChild(c);
  }
  // ---------------------------------------------------------------- driving the page's own menus with a pad (any pad)
  function navUI() {
    const root = G.panel ? G.panel.box : popupRoot() || callCfg('uiRoot'); if (!root || G.dlg) { clearNav(); return; }
    const btns = [...root.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled && getComputedStyle(b).visibility !== 'hidden');
    if (!btns.length) return;
    if (!btns.includes(G.navFocus)) setNav(btns.find(b => /focus|lmp-f/.test(b.className)) || btns[0]);
    for (const S of padStates()) {
      let dx = 0, dy = 0;
      if (S.hit('up') || (S.ly < -0.6 && !(S.p._ny < -0.6))) dy = -1; else if (S.hit('down') || (S.ly > 0.6 && !(S.p._ny > 0.6))) dy = 1;
      else if (S.hit('left') || (S.lx < -0.6 && !(S.p._nx < -0.6))) dx = -1; else if (S.hit('right') || (S.lx > 0.6 && !(S.p._nx > 0.6))) dx = 1;
      S.v._nx = S.lx; S.v._ny = S.ly;
      if (dx || dy) { const n = nearest(G.navFocus, btns, dx, dy); if (n) setNav(n); }
      if (S.hit('a') && G.navFocus) { const b = G.navFocus; setTimeout(() => b.click(), 0); }
      if (S.hit('b') || S.hit('start')) { if (G.panel) closePanel(); else callCfg('back'); }
    }
  }
  function nearest(from, list, dx, dy) {
    const r0 = from.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2; let best = null, bs = 1e9;
    for (const b of list) { if (b === from) continue; const r = b.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy; const along = x * dx + y * dy; if (along <= 2) continue; const s = along + Math.abs(x * dy + y * dx) * 2.5; if (s < bs) { bs = s; best = b; } }
    if (!best) { const i = list.indexOf(from); best = list[(i + (dx + dy > 0 ? 1 : list.length - 1)) % list.length]; }
    return best;
  }
  function setNav(b) { clearNav(); G.navFocus = b; if (b) { b.classList.add('lmp-nav'); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { } } }
  function clearNav() { if (G.navFocus) G.navFocus.classList.remove('lmp-nav'); G.navFocus = null; }
  // the site's own pop-ups ("You got 80 Pearls", "Buy for 5 Pearls?") are on top of everything: a pad can answer them too
  const popupRoot = () => { const v = [...document.querySelectorAll('.gpp-veil')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none'); return v.length ? v[v.length - 1] : null; };
  const padStates = () => [...G.slots.values()].filter(S => S.pad);
  // ---------------------------------------------------------------- the menu button
  function addMenuButton() {
    const C = G.cfg; let host = C.menuButtonAfter ? (typeof C.menuButtonAfter === 'string' ? document.querySelector(C.menuButtonAfter) : C.menuButtonAfter) : null;
    if (!host) { const gm = document.getElementById('gm'); if (gm) host = [...gm.querySelectorAll('button')].find(b => /^\s*(Game )?Settings\s*$/i.test(b.textContent)) || [...gm.querySelectorAll('button')].find(b => /Help/i.test(b.textContent)); }
    if (!host || document.getElementById('lmpMenuBtn')) return;
    const b = document.createElement('button'); b.id = 'lmpMenuBtn'; b.className = host.className.replace(/\bfocus\b/, '').trim(); b.textContent = 'Controllers';
    b.addEventListener('click', e => { e.preventDefault(); openPanel(); });
    host.insertAdjacentElement('afterend', b);
  }
  // ---------------------------------------------------------------- the frame
  const V3 = () => (window.THREE ? new THREE.Vector3() : null); let tv = null;
  function frame(dt) {
    if (!G.cfg) return; G.dt = dt = Math.min(dt || 0.016, 0.1); G.t += dt;
    poll();
    for (const S of G.slots.values()) if (S.pad && S.pad.gp) readPad(S.pad, S.pad.gp, S);
    if (G.dlg) { if (G.dlg.remap) { if (G.dlg.step) G.dlg.step(); } else dlgInput(); }
    else nextQuestion();
    const uiOpen = !!(G.panel || G.dlg || popupRoot() || callCfg('uiRoot'));
    if (uiOpen) navUI(); else clearNav();
    // Start on any pad opens the Game Menu
    if (!uiOpen) for (const S of padStates()) if (S.hit('start')) { callCfg('menu'); break; }
    const P1 = G.slots.get(1);
    if (P1 && P1.pad) callCfg('p1', P1, dt, uiOpen);
    for (const S of G.slots.values()) {
      if (S.slot < 2) continue;
      if (!S.handle) { try { S.handle = G.cfg.spawn(S); } catch (e) { } if (!S.handle) continue; }
      if (S.cursor) {   // the right stick moves this player's crosshair round the screen
        const k = 1100 * Math.max(innerWidth, innerHeight) / 1400 * dt;
        if (!uiOpen) { S.cursor.x += S.rx * Math.abs(S.rx) * k + S.rx * k * 0.25; S.cursor.y += S.ry * Math.abs(S.ry) * k + S.ry * k * 0.25; }
        S.cursor.x = Math.max(8, Math.min(innerWidth - 8, S.cursor.x)); S.cursor.y = Math.max(8, Math.min(innerHeight - 8, S.cursor.y));
      }
      try { G.cfg.update(S.handle, S, dt, uiOpen); } catch (e) { const k = String(e && e.stack || e).slice(0, 200); if (!G.errs) G.errs = new Set(); if (!G.errs.has(k)) { G.errs.add(k); console.error('Local multiplayer: update', e); } }
    }
  }
  function draw() {
    if (!G.cfg) return; const cam = callCfg('camera'); if (!tv) tv = V3();
    const hideAll = !!callCfg('hidden');
    for (const S of G.slots.values()) {
      if (S.slot < 2) continue; const E = G.els[S.slot]; if (!E) continue;
      const showX = !hideAll && S.handle && G.cfg.crosshair !== false && !(G.cfg.crosshairFor && !G.cfg.crosshairFor(S.handle, S));
      E.xh.style.display = showX ? '' : 'none';
      if (showX && S.cursor) { E.xh.style.transform = `translate(${S.cursor.x.toFixed(1)}px, ${S.cursor.y.toFixed(1)}px)`; E.xh.classList.toggle('off', !!(G.cfg.dead && G.cfg.dead(S.handle))); }
      const hp = !hideAll && S.handle && cam && tv && G.cfg.headPos ? G.cfg.headPos(S.handle, S) : null;
      if (!hp) { E.tag.style.display = 'none'; continue; }
      tv.set(hp.x, hp.y, hp.z).project(cam);
      let x = (tv.x * 0.5 + 0.5) * innerWidth, y = (-tv.y * 0.5 + 0.5) * innerHeight; const behind = tv.z > 1;
      if (behind) { x = innerWidth - x; y = innerHeight - 30; }
      const ex = Math.max(20, Math.min(innerWidth - 20, x)), ey = Math.max(40, Math.min(innerHeight - 20, y)), edge = behind || ex !== x || ey !== y;
      E.tag.style.display = ''; E.tag.classList.toggle('edge', edge);
      const hpk = G.cfg.hp ? G.cfg.hp(S.handle, S) : null, bar = E.tag.querySelector('i');
      if (hpk === null || hpk === undefined) bar.style.display = 'none'; else { bar.style.display = ''; const w = Math.round(Math.max(0, Math.min(1, hpk)) * 100); if (bar._w !== w) { bar._w = w; bar.firstChild.style.width = w + '%'; bar.classList.toggle('lo', w < 30); } }
      E.tag.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  // ---------------------------------------------------------------- helpers for the games
  const API = {
    init(cfg) {
      G.cfg = Object.assign({ update() { }, spawn() { return null; }, despawn() { } }, cfg); ensureCSS();
      const go = () => { addMenuButton(); };
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
      addEventListener('gamepadconnected', () => poll());
      return API;
    },
    frame, draw, toast, openPanel, closePanel,
    get players() { return [...G.slots.values()].filter(S => S.slot > 1 && S.handle); },
    get p1() { const S = G.slots.get(1); return S && S.pad ? S : null; },
    get uiOpen() { return !!(G.panel || G.dlg); },
    colors: COLORS,
    // camera-relative movement: push up = away from the camera. Returns [mx, mz] (length up to 1) or null
    move(S, yaw) { const fw = -S.ly, st = S.lx; if (!fw && !st) return null; const mx = -Math.sin(yaw) * fw + Math.cos(yaw) * st, mz = -Math.cos(yaw) * fw - Math.sin(yaw) * st, l = Math.hypot(mx, mz); return l > 1 ? [mx / l, mz / l] : [mx, mz]; },
    // the crosshair as normalised device coordinates (-1..1), for THREE.Raycaster.setFromCamera
    ndc(S) { const c = S.cursor || { x: innerWidth / 2, y: innerHeight / 2 }; return { x: c.x / innerWidth * 2 - 1, y: -(c.y / innerHeight * 2 - 1) }; },
    // where the crosshair points: a ray from the camera through it
    ray(S, camera) { const n = API.ndc(S); const o = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), d = new THREE.Vector3(n.x, n.y, 0.5).unproject(camera).sub(o).normalize(); return { o, d }; },
    // put the crosshair on a world point (used when a player has no right stick: it follows their target)
    aimAt(S, camera, x, y, z) { if (!tv) tv = V3(); tv.set(x, y, z).project(camera); if (tv.z > 1) return; const tx = (tv.x * 0.5 + 0.5) * innerWidth, ty = (-tv.y * 0.5 + 0.5) * innerHeight; S.cursor.x += (tx - S.cursor.x) * 0.25; S.cursor.y += (ty - S.cursor.y) * 0.25; },
    // P1 on a controller: press and release the game's own keys
    key(code, down) { try { const k = { Space: ' ', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', ShiftLeft: 'Shift' }[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code); (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'INPUT' ? document.activeElement : document.body).dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: k, bubbles: true, cancelable: true })); } catch (e) { } },
    // P1: hold key `code` while button `btn` is held (sends the key down / up on the edges)
    hold(S, btn, code) { if (S.hit(btn)) API.key(code, true); else if (S.up(btn)) API.key(code, false); },
    tap(code) { API.key(code, true); setTimeout(() => API.key(code, false), 30); },
    rumble(S, k = 0.4, ms = 120) { if (S && S.pad) rumble(S.pad, k, ms); },
  };
  window.GrugLocalMP = API;
})();
