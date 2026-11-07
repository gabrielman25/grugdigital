/* Grug · theme.js — the kubii look: Light / Dark / Auto, six colour themes and the wavy backdrop.
   Load it in <head> (no defer) right after grug.css so the theme is set before the first paint.
   Choices live in the profile (grug.profile.v1 → prefs.theme / prefs.mode / prefs.backdrop),
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
  const BG_HUE = 31; // median hue of backdrop.jpg (orange); hue-rotate moves it to each theme
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
  const hexHue = hex => { const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };

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
    m.content = dark ? `hsl(${t.h} 35% 7%)` : `hsl(${t.h} 42% 93%)`;
    Backdrop.retint(); Backdrop.kick();
    return s;
  }

  /* ---------- the wavy backdrop ----------
     A 192×108 canvas, recoloured once per theme (hue-rotate + saturate + brightness applied to the pixels),
     then redrawn ~25×/s from sine-offset strips. Scaled up it reads as soft liquid colour. It pauses when the
     tab is hidden, when a dialog is open, when Animations are off, or when the visitor prefers reduced motion. */
  const BG_CACHE = 'grug.bg.v1';
  const Backdrop = (function () {
    const W = 192, H = 108, M = 10;
    let cv, ctx, src, sx, buf, bx, img, ok = false, raf = 0, last = 0;
    function mount() {
      if (cv || !document.body) return;
      const wrap = document.createElement('div'); wrap.className = 'k-bg'; wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = '<canvas class="k-wave" width="' + W + '" height="' + H + '"></canvas><div class="k-scrim"></div>';
      document.body.prepend(wrap);
      cv = wrap.firstChild; ctx = cv.getContext('2d');
      // carry the backdrop over from the last page: its last frame shows at once, and the drift keeps its place in time
      try { const c = JSON.parse(localStorage.getItem(BG_CACHE) || 'null'), s0 = prefs(); if (c && c.k === s0.theme + '|' + isDark(s0) && /^data:image\//.test(c.u)) cv.style.background = 'url(' + c.u + ') center/100% 100% no-repeat'; } catch (e) {}
      cv.style.animationDelay = -((Date.now() / 1000) % 80).toFixed(2) + 's';
      root.addEventListener('pagehide', saveFrame);
      src = document.createElement('canvas'); sx = src.getContext('2d', { willReadFrequently: true });
      buf = document.createElement('canvas'); buf.width = W; buf.height = H; bx = buf.getContext('2d');
      img = new Image();
      img.onload = () => { ok = true; src.width = img.width; src.height = img.height; retint(); kick(); setTimeout(saveFrame, 400); };
      const me = document.querySelector('script[src*="theme.js"]');
      img.src = me ? me.src.replace(/theme\.js.*$/, 'backdrop.jpg') : 'assets/backdrop.jpg';
    }
    function retint() {
      if (!ok) return;
      const s = prefs(), t = THEMES[s.theme], dark = isDark(s);
      const a = (hexHue(t.a) - BG_HUE) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      const sat = dark ? 1.25 : .95, bri = dark ? .62 : 1.05;
      const h = [.213 + co * .787 - si * .213, .715 - co * .715 - si * .715, .072 - co * .072 + si * .928,
        .213 - co * .213 + si * .143, .715 + co * .285 + si * .140, .072 - co * .072 - si * .283,
        .213 - co * .213 - si * .787, .715 - co * .715 + si * .715, .072 + co * .928 + si * .072];
      const S = [.213 + .787 * sat, .715 - .715 * sat, .072 - .072 * sat, .213 - .213 * sat, .715 + .285 * sat, .072 - .072 * sat, .213 - .213 * sat, .715 - .715 * sat, .072 + .928 * sat];
      const m = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => (S[r * 3] * h[c] + S[r * 3 + 1] * h[3 + c] + S[r * 3 + 2] * h[6 + c]) * bri));
      sx.drawImage(img, 0, 0);
      try {
        const d = sx.getImageData(0, 0, src.width, src.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i], g = p[i + 1], b = p[i + 2];
          p[i] = m[0] * r + m[1] * g + m[2] * b; p[i + 1] = m[3] * r + m[4] * g + m[5] * b; p[i + 2] = m[6] * r + m[7] * g + m[8] * b;
        }
        sx.putImageData(d, 0, 0); cv.style.filter = '';
      } catch (e) { // opened from disk: the browser won't let us read the pixels, so let CSS do the recolour
        cv.style.filter = 'hue-rotate(' + Math.round(a * 180 / Math.PI) + 'deg) saturate(' + sat + ') brightness(' + bri + ')';
      }
      draw(performance.now());
    }
    function saveFrame() { if (!ok || !cv) return; try { const s0 = prefs(); localStorage.setItem(BG_CACHE, JSON.stringify({ k: s0.theme + '|' + isDark(s0), u: cv.toDataURL('image/jpeg', 0.75) })); } catch (e) {} }
    function draw(ts) {
      if (!ok) return;
      const s = ((performance.timeOrigin || 0) + ts) / 1000 % 100000, iw = src.width, ih = src.height;   // wall-clock time, so every page is in step
      bx.clearRect(0, 0, W, H);
      for (let y = 0; y < H; y += 2) {
        const dx = Math.sin(s * .55 + y * .055) * 3.2 + Math.sin(s * .31 + y * .02) * 2.4;
        bx.drawImage(src, 0, y / H * ih, iw, 2 / H * ih + .4, -M + dx, y, W + 2 * M, 2.4);
      }
      ctx.clearRect(0, 0, W, H);
      for (let x = 0; x < W; x += 2) {
        const dy = Math.sin(s * .47 + x * .042) * 2.6 + Math.sin(s * .23 + x * .014) * 2.4;
        ctx.drawImage(buf, x, 0, 2, H, x, -M + dy, 2.4, H + 2 * M);
      }
    }
    function frame(ts) {
      raf = 0;
      const s = prefs();
      if (!s.backdrop || isCalm(s) || document.hidden || document.querySelector('dialog[open]')) return;
      if (ts - last > 40) { last = ts; draw(ts); }
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (cv && !raf) raf = requestAnimationFrame(frame); }
    document.addEventListener('visibilitychange', kick);
    return { mount, retint, kick };
  })();

  function set(patch) {
    if (root.Grug && root.Grug.profile) { Object.assign(root.Grug.profile.prefs, patch); root.Grug.save('prefs'); }
    else { try { const p = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; p.prefs = Object.assign(p.prefs || {}, patch); localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { } }
    apply();
  }

  apply();
  if (document.body) Backdrop.mount(); else document.addEventListener('DOMContentLoaded', Backdrop.mount);
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', () => { if (prefs().mode === 'auto') apply(); });
  // another tab changed the profile (theme picked elsewhere) → follow it
  root.addEventListener('storage', e => { if (e.key === KEY) apply(); });
  root.addEventListener('grug:change', e => { const w = e.detail && e.detail.what; if (w === 'import' || w === 'reset' || w === 'external' || w === 'prefs') apply(); });

  root.GrugTheme = { THEMES, prefs, set, apply, isDark: () => isDark(prefs()), kick: () => Backdrop.kick() };
})(window);
