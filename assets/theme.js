/* Grug · theme.js — the look, matched to Model Kit: dark #17171A with a static pixel pattern, and each section of the
   site owns one accent colour (like Model Kit's modes): Home lime, Games green, Create teal, Avatar purple, Shop yellow,
   Profile pink, Rewards orange. The accent fills the active dock tab, primary buttons, switches and highlights, and tints the pattern.
   Text on an accent is always #1E1B16. The blue smoky fog (fogbg.js) is only for the Games section.
   Load it in <head> (no defer) right after grug.css so the look is set before the first paint.
   Choices live in the profile (grug.profile.v1 → prefs), so they travel with Profile → Export like everything else.
*/
(function (root) {
  'use strict';
  const KEY = 'grug.profile.v1';
  const HUE = 228;   // the fog's blue (Games only)
  const INK = '#1E1B16';
  // a = accent, lo = its pressed/shadow shade, pattern = assets/patterns/<id>.png (pre-tinted, 96px), fog = Games
  const SECTIONS = {
    home: { name: 'Home', a: '#9BE338', lo: '#6FB31C' },
    games: { name: 'Games', a: '#7EE081', lo: '#4FB357', fog: true },
    create: { name: 'Create', a: '#4FD8C4', lo: '#25A893' },
    avatar: { name: 'Avatar', a: '#C59BFF', lo: '#9A6FE0' },
    shop: { name: 'Shop', a: '#FFBE1A', lo: '#D99A00' },
    profile: { name: 'Profile', a: '#FF8FC2', lo: '#E0669E' },
    // solid: plain #17171A behind the page, no pattern tile
    rewards: { name: 'Rewards', a: '#FF9F5A', lo: '#E0782F', solid: true },
    pearls: { name: 'Pearls', a: '#C59BFF', lo: '#9A6FE0' }
  };
  // the lights that drift through the Games fog
  const ORBS = ['#9be338', '#ffd23f', '#5ab0ff', '#e8f0ff', '#7EE081', '#ffd23f', '#5ab0ff'];
  const DEFAULTS = { backdrop: true, motion: true };
  const calmMQ = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function prefs() {
    let p = {};
    try { p = (JSON.parse(localStorage.getItem(KEY) || 'null') || {}).prefs || {}; } catch (e) { }
    if (root.Grug && root.Grug.profile) p = root.Grug.profile.prefs || p;
    return { mode: 'dark', backdrop: p.backdrop !== false, motion: p.motion !== false };
  }
  const isCalm = s => !s.motion || !!(calmMQ && calmMQ.matches);
  function sectionOf(path) {
    if (/\/rewards(\/|$)/.test(path)) return 'rewards';   // before the others: rewards/create/ is not the Create tab
    const m = /\/(games|create|avatar|shop|profile)(\/|$)/.exec(path); if (m) return m[1];
    if (/\/pearls(\.html)?$/.test(path)) return 'pearls';
    return 'home';
  }
  let section = 'home';
  try { section = sectionOf(location.pathname); } catch (e) {}

  // browsers without cross-page View Transitions get a short fade instead (grug.js marks the way out)
  try { if (!('onpagereveal' in root)) { document.documentElement.classList.add('g-fade'); if (sessionStorage.getItem('grug.nav')) { sessionStorage.removeItem('grug.nav'); document.documentElement.classList.add('g-arrive'); } } } catch (e) {}
  // pages with the Grug top bar and dock: draw their skeletons right away (grug.css), so nothing jumps when they arrive
  try { if (!/[?&]mode=viewer/.test(location.search) && !/\/(play|work)\//.test(location.pathname)) document.documentElement.classList.add('g-pre'); } catch (e) {}
  // backdrop: the fog for the Games section, a pixel pattern everywhere else (not the games themselves or embedded viewers)
  let sitePage = false;
  try { sitePage = !/[?&]mode=viewer/.test(location.search) && !/\/(play|work|tools|showcase)\//.test(location.pathname); } catch (e) {}
  const me = (document.currentScript && document.currentScript.src) || '';
  if (sitePage && SECTIONS[section].fog) {
    document.documentElement.classList.add('g-fogged');
    try { if (me) { const s = document.createElement('script'); s.src = me.replace(/theme\.js(\?.*)?$/, 'fogbg.js'); s.defer = true; document.head.appendChild(s); } } catch (e) {}
  } else if (sitePage && !SECTIONS[section].solid) {
    document.documentElement.classList.add('g-patterned');
    try { if (me) document.documentElement.style.setProperty('--pattern', 'url("' + me.replace(/theme\.js(\?.*)?$/, 'patterns/' + section + '.png?v=2') + '")'); } catch (e) {}
  }
  function apply() {
    const s = prefs(), t = SECTIONS[section], el = document.documentElement;
    el.setAttribute('data-theme', 'dark'); el.setAttribute('data-section', section);
    el.style.setProperty('--h', HUE);
    el.style.setProperty('--sel-a', t.a); el.style.setProperty('--sel-b', t.a); el.style.setProperty('--on-sel', INK);
    el.style.setProperty('--mode', t.a); el.style.setProperty('--mode-lo', t.lo);
    el.style.setProperty('--hot-a', '#FFBE1A'); el.style.setProperty('--hot-b', '#FF8FC2');
    el.classList.toggle('calm', isCalm(s));
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = t.fog ? '#03050f' : '#17171A';
    try { document.dispatchEvent(new CustomEvent('grug:theme', { detail: { section } })); } catch (e) {}
    return s;
  }

  // the old wavy image backdrop is gone: drop its cached frame
  try { localStorage.removeItem('grug.bg.v1'); } catch (e) {}

  function set(patch) {
    if (root.Grug && root.Grug.profile) { Object.assign(root.Grug.profile.prefs, patch); root.Grug.save('prefs'); }
    else { try { const p = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; p.prefs = Object.assign(p.prefs || {}, patch); localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { } }
    apply();
  }

  apply();
  // another tab changed the profile (theme picked elsewhere) → follow it
  root.addEventListener('storage', e => { if (e.key === KEY) apply(); });
  root.addEventListener('grug:change', e => { const w = e.detail && e.detail.what; if (w === 'import' || w === 'reset' || w === 'external' || w === 'prefs') apply(); });

  /* ---------- the page scrollbar: a slim themed bar that floats over the page (the system one is hidden in grug.css),
     so content stays centred on the whole screen. Shows while scrolling or when the pointer is near; drag it or click its track. */
  function scrollbar() {
    if (document.querySelector('.k-sbar') || !document.body) return;
    const bar = document.createElement('div'); bar.className = 'k-sbar'; bar.setAttribute('aria-hidden', 'true');
    const th = document.createElement('i'); bar.appendChild(th); document.body.appendChild(bar);
    const se = document.scrollingElement || document.documentElement;
    let hideT = 0, drag = null, raf = 0;
    const geo = () => { const H = se.scrollHeight, V = innerHeight, T = bar.clientHeight, h = Math.max(36, T * V / Math.max(H, 1)); return { H, V, T, h, max: Math.max(1, H - V) }; };
    function paint() { raf = 0; const g = geo(), need = g.H > g.V + 2; bar.classList.toggle('need', need); th.style.display = need ? '' : 'none'; if (!need) return;
      th.style.height = g.h + 'px'; th.style.top = ((g.T - g.h) * (se.scrollTop / g.max)) + 'px'; }
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const show = () => { bar.classList.add('on'); clearTimeout(hideT); hideT = setTimeout(() => bar.classList.remove('on'), 900); };
    addEventListener('scroll', () => { queue(); show(); }, { passive: true });
    addEventListener('resize', queue); new ResizeObserver(queue).observe(document.body);
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && innerWidth - e.clientX < 22) show(); }, { passive: true });
    const jump = y => se.scrollTo({ top: y, behavior: 'instant' });
    th.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = { y: e.clientY, top: se.scrollTop }; bar.classList.add('hold'); th.setPointerCapture(e.pointerId); });
    th.addEventListener('pointermove', e => { if (!drag) return; const g = geo(); jump(drag.top + (e.clientY - drag.y) * g.max / Math.max(1, g.T - g.h)); });
    const end = () => { drag = null; bar.classList.remove('hold'); show(); };
    th.addEventListener('pointerup', end); th.addEventListener('pointercancel', end);
    bar.addEventListener('pointerdown', e => { if (e.target !== bar) return; const g = geo(), r = bar.getBoundingClientRect(), f = (e.clientY - r.top - g.h / 2) / Math.max(1, g.T - g.h); se.scrollTo({ top: f * g.max, behavior: 'smooth' }); show(); });
    paint();
  }
  if (document.body) scrollbar(); else document.addEventListener('DOMContentLoaded', scrollbar);

  root.GrugTheme = { SECTIONS, ORBS, section: () => section, sectionOf, prefs, set, apply, isDark: () => true, kick: () => {} };
})(window);
