/* Grug · theme.js — the kubii look: Light / Dark / Auto and six colour themes.
   The page background is a flat off-white (light) or off-black (dark) tinted with the theme's hue (--bg in grug.css).
   Load it in <head> (no defer) right after grug.css so the theme is set before the first paint.
   Choices live in the profile (grug.profile.v1 → prefs.theme / prefs.mode),
   so they travel with Profile → Export like everything else.
*/
(function (root) {
  'use strict';
  const KEY = 'grug.profile.v1';
  // h = hue for the neutrals; a/b = accent pair; ink = text on the accent; hotA/hotB = secondary pair
  const THEMES = {
    tropical: { name: 'Tropical', note: 'Lime and lagoon', h: 150, a: '#a3e635', b: '#2dd4bf', ink: '#0f2a14', hotA: '#ffb020', hotB: '#ff6b6b' },
    lagoon: { name: 'Lagoon', note: 'Aqua and palm', h: 188, a: '#22d3ee', b: '#a3e635', ink: '#05262e', hotA: '#fb7185', hotB: '#fbbf24' },
    papaya: { name: 'Papaya', note: 'Mango and sun', h: 32, a: '#fdba3b', b: '#fb7c4c', ink: '#3a1704', hotA: '#f43f5e', hotB: '#a3e635' },
    hibiscus: { name: 'Hibiscus', note: 'Pink and coral', h: 338, a: '#f472b6', b: '#fb923c', ink: '#3b0a22', hotA: '#a3e635', hotB: '#22d3ee' },
    orchid: { name: 'Orchid', note: 'Violet and sky', h: 268, a: '#a78bfa', b: '#38bdf8', ink: '#1e1048', hotA: '#f472b6', hotB: '#fb923c' },
    coconut: { name: 'Coconut', note: 'Cream and lime', h: 48, a: '#d9f99d', b: '#a3e635', ink: '#1a2e05', hotA: '#fb923c', hotB: '#f43f5e' },
  };
  const DEFAULTS = { theme: 'tropical', mode: 'light', backdrop: true, motion: true };
  const darkMQ = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  const calmMQ = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function prefs() {
    let p = {};
    try { p = (JSON.parse(localStorage.getItem(KEY) || 'null') || {}).prefs || {}; } catch (e) { }
    if (root.Grug && root.Grug.profile) p = root.Grug.profile.prefs || p;
    return {
      theme: THEMES[p.theme] ? p.theme : DEFAULTS.theme,
      mode: /^(light|dark|auto)$/.test(p.mode) ? p.mode : DEFAULTS.mode,
      backdrop: p.backdrop !== false,
      motion: p.motion !== false,
    };
  }
  const isDark = s => s.mode === 'dark' || (s.mode === 'auto' && !!(darkMQ && darkMQ.matches));
  const isCalm = s => !s.motion || !!(calmMQ && calmMQ.matches);

  // browsers without cross-page View Transitions get a short fade instead (grug.js marks the way out)
  try { if (!('onpagereveal' in root)) { document.documentElement.classList.add('g-fade'); if (sessionStorage.getItem('grug.nav')) { sessionStorage.removeItem('grug.nav'); document.documentElement.classList.add('g-arrive'); } } } catch (e) {}
  // pages with the Grug top bar and dock: draw their skeletons right away (grug.css), so nothing jumps when they arrive
  try { if (!/[?&]mode=viewer/.test(location.search) && !/\/(play|work)\//.test(location.pathname)) document.documentElement.classList.add('g-pre'); } catch (e) {}
  function apply() {
    const s = prefs(), t = THEMES[s.theme], el = document.documentElement, dark = isDark(s);
    el.setAttribute('data-theme', dark ? 'dark' : 'light'); // Auto resolves here, so CSS only needs two palettes
    el.style.setProperty('--h', t.h);
    el.style.setProperty('--sel-a', t.a); el.style.setProperty('--sel-b', t.b); el.style.setProperty('--on-sel', t.ink);
    el.style.setProperty('--hot-a', t.hotA); el.style.setProperty('--hot-b', t.hotB);
    el.classList.toggle('calm', isCalm(s));
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = dark ? `hsl(${t.h} 14% 7%)` : `hsl(${t.h} 24% 95%)`;
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
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', () => { if (prefs().mode === 'auto') apply(); });
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

  root.GrugTheme = { THEMES, prefs, set, apply, isDark: () => isDark(prefs()), kick: () => {} };
})(window);
