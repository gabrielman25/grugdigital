/* Grug · chef.js — the player's avatar inside a game (loaded by the game document).
   Shows pictures of the player's 3D avatar (made by the avatar editor and cached on this phone in
   'grug.sandy.snaps.v1'; the shipped default pictures in assets/sandy/ otherwise), so games stay light.
   GrugChef.setAvatar(avatar, name)  the rewards app sends this with every state message; any avatar turns the chef on
   GrugChef.place('lobby' | 'play')  moves the avatar box into #chefSlot (lobby) or the HUD rail (#chefHost)
   GrugChef.react(pose, text, ms)    plays a pose (wave, happy, cheer, sad, dance, think, idle) with an optional speech bubble
   Without an avatar (the game opened on its own) nothing is shown. */
(function (root) {
  'use strict';
  const me = document.currentScript || Array.from(document.scripts).find(s => /chef\.js(\?|$)/.test(s.src));
  const DEF = (me && me.src ? me.src.replace(/chef\.js.*$/, '') : '../../assets/') + 'sandy/';
  const DEFAULTS = { bust: DEF + 'bust.png', full: DEF + 'full.png', happy: DEF + 'happy.png', sad: DEF + 'sad.png', cheer: DEF + 'cheer.png' };
  const hash = (o) => { const s = JSON.stringify(o || null); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  function pics() { const s = read('grug.sandy.snaps.v1'), c = read('grug.sandy.v1'); return s && s.full && (!c || s.hash === hash(c)) ? s : DEFAULTS; }

  let on = false, name = '', box = null, img = null, bubble = null, bubbleT = 0, poseT = 0;
  const css = document.createElement('style');
  css.textContent = `
.chef{position:relative;flex:none;width:72px;height:92px;display:none;cursor:pointer}
.chef.on{display:block}
.chef.chef-big{width:104px;height:128px}
.chef img{position:absolute;left:0;right:0;bottom:0;margin:auto;height:100%;width:auto;max-width:none;transform-origin:50% 100%;filter:drop-shadow(0 6px 8px rgba(0,0,0,.3));animation:chef-breathe 3.6s ease-in-out infinite;pointer-events:none}
.chef.hop img{animation:chef-hop .55s cubic-bezier(.3,1.6,.5,1)}
.chef.dance img{animation:chef-dance .5s ease-in-out infinite}
.chef.sad img{animation:chef-sad .9s ease-out forwards}
.chef.think img{animation:chef-think 2.4s ease-in-out infinite}
@keyframes chef-breathe{50%{transform:translateY(-1.5%) scaleY(1.01)}}
@keyframes chef-hop{0%{transform:none}35%{transform:translateY(-12%) scale(1.04)}70%{transform:translateY(1%) scaleY(.96)}100%{transform:none}}
@keyframes chef-dance{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg) translateY(-4%)}75%{transform:rotate(6deg) translateY(-4%)}}
@keyframes chef-sad{to{transform:translateY(3%) scaleY(.95) rotate(-2deg)}}
@keyframes chef-think{50%{transform:rotate(3deg)}}
@media (prefers-reduced-motion:reduce){.chef img{animation:none!important}}
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
    img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.src = pics().full; box.appendChild(img);
    bubble = document.createElement('div'); bubble.className = 'chef-say'; box.appendChild(bubble);
    box.addEventListener('click', () => react('wave', '', 1400));
    return box;
  }
  function rest() { if (!box) return; box.classList.remove('hop', 'dance', 'sad', 'think'); img.src = pics().full; }
  function setAvatar(a, n) {
    on = !!a; name = n || '';
    if (!on) { if (box) box.classList.remove('on'); return; }
    ensure(); box.classList.add('on');
    if (!box.className.match(/hop|dance|sad|think/)) img.src = pics().full;
  }
  function place(w) {
    ensure();
    const host = document.getElementById(w === 'play' ? 'chefHost' : 'chefSlot');
    if (!host) return;
    box.classList.toggle('chef-big', w !== 'play');
    if (box.parentNode !== host) host.appendChild(box);
  }
  function react(pose, text, ms) {
    if (!on || !box) return;
    ms = ms || 1200;
    const p = pics(); clearTimeout(poseT);
    box.classList.remove('hop', 'dance', 'sad', 'think'); void box.offsetWidth;
    if (pose === 'idle') { rest(); }
    else {
      img.src = pose === 'sad' || pose === 'think' || pose === 'happy' ? p.full : p.cheer;
      box.classList.add(pose === 'dance' ? 'dance' : pose === 'sad' ? 'sad' : pose === 'think' ? 'think' : 'hop');
      poseT = setTimeout(rest, ms);
    }
    if (text) { bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bubbleT); bubbleT = setTimeout(() => bubble.classList.remove('show'), Math.max(900, ms - 200)); }
  }
  root.addEventListener('storage', e => { if (e.key === 'grug.sandy.snaps.v1') rest(); });
  root.GrugChef = { setAvatar, place, react, get name() { return name; } };
})(window);
