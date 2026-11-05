/* Grug · chef.js — the player's avatar inside a game (loaded by the game document, next to three.min.js, catalog.js and avatar3d.js).
   GrugChef.setAvatar(avatar, name)  the rewards app sends the avatar with every state message
   GrugChef.place('lobby' | 'play')  moves the avatar box into #chefSlot (lobby) or the HUD rail (#chefHost)
   GrugChef.react(pose, text, ms)    plays a pose (wave, happy, cheer, sad, dance, think) with an optional speech bubble
   Without an avatar (the game opened on its own) nothing is shown. */
(function (root) {
  'use strict';
  let view = null, avatar = null, name = '', box = null, bubble = null, bubbleT = 0, where = '';
  const css = document.createElement('style');
  css.textContent = `
.chef{position:relative;flex:none;width:72px;height:92px;display:none}
.chef.on{display:block}
.chef.chef-big{width:104px;height:128px}
.chef-say{position:absolute;left:80%;bottom:72%;background:#fff;color:#1F1A17;font:700 13px/1.15 "Fredoka","Baloo 2",system-ui,sans-serif;padding:6px 9px;border-radius:12px;border-bottom-left-radius:3px;white-space:nowrap;opacity:0;transform:translateY(6px) scale(.9);transition:.18s;pointer-events:none;z-index:6;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.chef-say.show{opacity:1;transform:none}
.lobby-head{display:flex;align-items:flex-start;gap:8px}
.lobby-head>div:first-child{flex:1;min-width:0}
#chefSlot{margin-top:-6px}
.rail .chef{align-self:flex-end}`;
  document.head.appendChild(css);

  function ensure() {
    if (box) return box;
    box = document.createElement('div'); box.className = 'chef';
    bubble = document.createElement('div'); bubble.className = 'chef-say'; box.appendChild(bubble);
    box.addEventListener('click', () => react('wave', '', 1400));
    return box;
  }
  function mount() {
    if (view || !avatar || !root.GrugAvatar || !box || !box.isConnected) return;
    try { view = root.GrugAvatar.mount(box, avatar, { orbit: false, yaw: 0.45, zoom: 1.12, ground: false }); box.appendChild(bubble); } catch (e) { console.warn('chef mount failed', e); }
  }
  function setAvatar(a, n) {
    avatar = a || null; name = n || '';
    if (!avatar) { if (box) box.classList.remove('on'); return; }
    ensure(); box.classList.add('on');
    if (view) view.setAvatar(avatar); else mount();
  }
  function place(w) {
    ensure(); where = w;
    const host = document.getElementById(w === 'play' ? 'chefHost' : 'chefSlot');
    if (!host) return;
    box.classList.toggle('chef-big', w !== 'play');
    if (box.parentNode !== host) host.appendChild(box);
    if (!view) mount();
    if (view) view.renderer.setSize(box.clientWidth || 72, box.clientHeight || 92, false);
  }
  function react(pose, text, ms) {
    if (!view) return;
    view.play(pose, { ms: ms || 1200 });
    if (text) { bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bubbleT); bubbleT = setTimeout(() => bubble.classList.remove('show'), Math.max(900, (ms || 1200) - 200)); }
  }
  root.GrugChef = { setAvatar, place, react, get name() { return name; } };
})(window);
