/* Grug Digital · the ad in the itch.io asset zoos (the "Asset preview" pages embedded on polysw.itch.io).
   Each zoo's index.html loads this file with one line before </body>:
     <script src="https://grugdigital.com/static/ads/zoo-ad.js" defer></script>
   so the ad lives here and changes everywhere at once. It adds:
   - a "275 free Pearls" button in the corner and makes the Grug Digital mark a link,
   - an animated, interactive ad card that slides into the carousel: every AD_EVERY steps through the models, and when a
     set wraps around. Next/Previous (or the arrow keys) on the card carry on browsing.
   Every link goes to LINK (grugdigital.com/itch: the 275 bonus Pearls, see static/pearls.js) in a new tab.
   It stays out of the zoo's capture mode (?capture=1, used to render turntables) and never touches the 3D view. */
(function () {
  'use strict';
  if (window.__grugZooAd) return; window.__grugZooAd = true;
  if (/[?&]capture=/.test(location.search) || document.body.classList.contains('cap')) return;
  const LINK = 'https://grugdigital.com/itch?utm_source=itch&utm_medium=zoo';
  const IMG = 'https://grugdigital.com/static/showcase/';
  const LOOKS = [['skater', 'Skater'], ['ranger', 'Ranger'], ['racer', 'Racer'], ['medic', 'Medic'], ['snow-rider', 'Snow Rider'], ['grug', 'Grug']];
  const ENGINES = ['Roblox', 'Unity', 'Godot', 'Blender', 'Three.js'];
  const AD_EVERY = 5;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = `
  .gza-pill{position:fixed;right:12px;top:12px;z-index:5;display:flex;align-items:center;gap:7px;padding:6px 12px 6px 6px;border-radius:999px;
    background:#9BE338;color:#1E1B16;font:700 13px/1 Fredoka,system-ui,sans-serif;text-decoration:none;box-shadow:0 3px 0 rgba(0,0,0,.35);
    animation:gza-nudge 4s ease-in-out infinite}
  .gza-pill:hover{filter:brightness(1.06)}
  .gza-pearl{flex:none;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff 0 9%,#f3c4ff 16%,#d16be8 42%,#9b36b8 78%,#6d1f86 100%)}
  .gza-pill .gza-pearl{width:20px;height:20px}
  @keyframes gza-nudge{0%,82%,100%{transform:none}86%{transform:scale(1.08) rotate(-3deg)}90%{transform:scale(1.08) rotate(3deg)}94%{transform:none}}
  #top .lock,#top img{pointer-events:auto;cursor:pointer}
  .gza{position:fixed;inset:0;z-index:1;display:grid;place-items:center;padding:70px 70px 64px;background:rgba(23,23,26,.78);
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s}
  .gza.on{opacity:1;pointer-events:auto}
  .gza-card{position:relative;width:min(640px,100%);max-height:100%;display:grid;grid-template-columns:minmax(150px,.8fr) 1.2fr;align-items:center;
    gap:8px;padding:22px 24px;border-radius:22px;background:#1E1B16;color:#F4F4F6;font-family:Fredoka,system-ui,sans-serif;
    box-shadow:0 18px 40px rgba(0,0,0,.5);overflow:hidden;transform:translateX(60px) scale(.96);transition:transform .35s cubic-bezier(.2,1.4,.4,1)}
  .gza.on .gza-card{transform:none}
  .gza-ad{position:absolute;left:14px;top:10px;font-size:11px;font-weight:600;color:#6b6b73;letter-spacing:.06em}
  .gza-stage{position:relative;height:230px;display:grid;place-items:end center;cursor:pointer}
  .gza-disc{position:absolute;left:50%;bottom:22px;width:190px;height:190px;margin-left:-95px;border-radius:50%;background:#9BE338}
  .gza-stage img{position:relative;height:225px;max-width:100%;object-fit:contain;filter:drop-shadow(0 10px 12px rgba(0,0,0,.45));animation:gza-bob 2.4s ease-in-out infinite}
  .gza-stage img.pop{animation:gza-pop .45s cubic-bezier(.2,1.6,.4,1),gza-bob 2.4s ease-in-out .45s infinite}
  @keyframes gza-bob{50%{transform:translateY(-7px)}}
  @keyframes gza-pop{0%{transform:scale(.2) translateY(60px)}100%{transform:none}}
  .gza-shuf{position:absolute;left:50%;bottom:0;transform:translateX(-50%);white-space:nowrap;border:0;border-radius:10px;padding:6px 12px;
    background:#2c2c31;color:#F4F4F6;font:600 13px/1 Fredoka,system-ui,sans-serif;cursor:pointer}
  .gza-shuf:hover{background:#3a3a40}
  .gza-k{font-size:12px;font-weight:700;letter-spacing:.08em;color:#9BE338;text-transform:uppercase}
  .gza-h{font-size:30px;line-height:1.05;font-weight:700;margin:4px 0 8px}
  .gza-h em{font-style:normal;color:#9BE338}
  .gza-p{font-size:14px;line-height:1.4;color:#b9b9c2;margin:0 0 10px}
  .gza-eng{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 14px}
  .gza-eng span{font-size:12px;font-weight:600;padding:4px 9px;border-radius:8px;background:#2c2c31;color:#a3a3ad;transition:background .2s,color .2s}
  .gza-eng span.lit{background:#9BE338;color:#1E1B16}
  .gza-cta{display:inline-flex;align-items:center;gap:10px;padding:11px 16px 11px 11px;border-radius:14px;background:#9BE338;color:#1E1B16;
    font-weight:700;font-size:17px;text-decoration:none;box-shadow:0 4px 0 #6FB31C;animation:gza-pulse 1.6s ease-in-out infinite}
  .gza-cta:hover{filter:brightness(1.06)}
  .gza-cta .gza-pearl{width:28px;height:28px}
  .gza-cta small{display:block;font-size:12px;font-weight:600;opacity:.75}
  @keyframes gza-pulse{50%{transform:scale(1.04)}}
  .gza-skip{display:block;margin-top:10px;font-size:12px;color:#8a8a93}
  .gza-x{position:absolute;right:10px;top:8px;width:28px;height:28px;border:0;border-radius:8px;background:none;color:#8a8a93;font:400 20px/1 system-ui;cursor:pointer}
  .gza-x:hover{background:#2c2c31;color:#fff}
  @media (max-width:560px),(max-height:380px){.gza{padding:58px 62px 54px}.gza-card{grid-template-columns:1fr;padding:26px 16px 16px}.gza-stage{display:none}.gza-h{font-size:24px}}
  @media (max-width:700px){.gza-pill{top:auto;bottom:74px;right:10px}}
  @media (prefers-reduced-motion:reduce){.gza-pill,.gza-stage img,.gza-cta{animation:none!important}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // the corner button and the logo link
  const pill = document.createElement('a');
  pill.className = 'gza-pill'; pill.href = LINK; pill.target = '_blank'; pill.rel = 'noopener';
  pill.innerHTML = '<span class="gza-pearl"></span>275 free Pearls';
  pill.title = 'Make an avatar and export it to any engine: 275 free Pearls (a $5 pack) for itch.io devs';
  document.body.appendChild(pill);
  const lock = document.querySelector('#top .lock') || document.querySelector('#top img');
  if (lock) { lock.title = 'Grug Digital: make an avatar, export it to any engine'; lock.addEventListener('click', () => open(LINK, '_blank', 'noopener')); }

  // the ad card
  const wrap = document.createElement('div'); wrap.className = 'gza'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Grug Digital: 275 free Pearls');
  wrap.innerHTML = `<div class="gza-card">
      <span class="gza-ad">GRUG DIGITAL</span><button class="gza-x" type="button" aria-label="Close">×</button>
      <div class="gza-stage" title="Tap for another look"><div class="gza-disc"></div><img alt=""><button class="gza-shuf" type="button">Another look ↻</button></div>
      <div>
        <div class="gza-k">For game devs</div>
        <div class="gza-h">Make an avatar.<br>Export it to <em>any engine</em>.</div>
        <p class="gza-p">Build a blocky hero for free in the Grug Avatar Studio, then download it as a rigged, animated .glb.</p>
        <div class="gza-eng">${ENGINES.map(e => `<span>${e}</span>`).join('')}</div>
        <a class="gza-cta" href="${LINK}" target="_blank" rel="noopener"><span class="gza-pearl"></span><span>Claim 275 free Pearls<small>a $5 pack, free · grugdigital.com/itch</small></span></a>
        <span class="gza-skip">Use the arrows to keep browsing</span>
      </div></div>`;
  document.body.appendChild(wrap);
  const img = wrap.querySelector('img'), eng = [...wrap.querySelectorAll('.gza-eng span')];
  let look = Math.floor(Math.random() * LOOKS.length), litT = 0;
  function showLook(pop) {
    img.src = IMG + LOOKS[look][0] + '.webp'; img.alt = LOOKS[look][1];
    if (pop && !reduce) { img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop'); }
  }
  LOOKS.forEach(l => { const i = new Image(); i.src = IMG + l[0] + '.webp'; });   // warm the cache
  wrap.querySelector('.gza-stage').addEventListener('click', e => { e.stopPropagation(); look = (look + 1) % LOOKS.length; showLook(true); });
  function lightEngines() {
    clearInterval(litT); eng.forEach(s => s.classList.remove('lit')); let i = 0;
    if (reduce) { eng.forEach(s => s.classList.add('lit')); return; }
    litT = setInterval(() => { if (i < eng.length) eng[i++].classList.add('lit'); else clearInterval(litT); }, 260);
  }
  let shown = false, steps = 0;
  function show() { shown = true; look = (look + 1) % LOOKS.length; showLook(true); wrap.classList.add('on'); lightEngines(); }
  function hide() { shown = false; wrap.classList.remove('on'); }
  wrap.querySelector('.gza-x').addEventListener('click', hide);
  wrap.addEventListener('click', e => { if (e.target === wrap) hide(); });

  // slot the card into the carousel: intercept a step (arrows, keys) before the zoo sees it
  function onStep(dir) {
    if (shown) { hide(); return true; }          // the step after the card carries on browsing: swallow it, the card was the slide
    steps++;
    if (steps % AD_EVERY === 0) { show(); return true; }
    return false;
  }
  // two kinds of zoo: the asset previews (#prev/#next, set tabs) and the walk-around zoos (#btnPrev/#btnNext)
  const prev = document.getElementById('prev') || document.getElementById('btnPrev'), next = document.getElementById('next') || document.getElementById('btnNext');
  [[prev, -1], [next, 1]].forEach(([b, d]) => b && b.addEventListener('click', e => { if (onStep(d)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true));
  // the zoo's own handlers sit on the buttons (onclick) and on window (keydown): capture at window first
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && shown) { hide(); return; }
    const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
    if (d && onStep(d)) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  // a set's tab: the card shows up once when someone switches sets the first time
  let setSwitches = 0;
  const sets = document.getElementById('sets');
  if (sets) sets.addEventListener('click', e => { if (e.target.closest('button') && ++setSwitches === 2) setTimeout(show, 900); });
  // someone who just watches the turntable sees it once after a while
  let idle = setTimeout(() => { if (!shown && steps === 0) show(); }, 25000);
  addEventListener('pointerdown', () => { clearTimeout(idle); idle = setTimeout(() => { if (!shown) show(); }, 60000); }, { passive: true });
})();
