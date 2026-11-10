/* Grug · fogbg.js — the site background: a blue smoky fog (think an old console's boot screen) with little balls of light
   that wander around trailing comet tails, and a few dim boxes drifting in the haze.
   theme.js loads this on every site page (not inside the games under play/ or work/).
   The fog is always blue, with lights in Grug colours (ORBS in theme.js). It is only drawn in the Games section.
   Still frame when Animations are off or the system asks for reduced motion. Paused while the tab is hidden or a
   FOSSIL32 cartridge is open over the page (html.f32-lock).
*/
(function () {
  'use strict';
  if (window.__grugFog) return; window.__grugFog = true;
  const doc = document, html = doc.documentElement;

  /* ---------- layers ---------- */
  const wrap = doc.createElement('div'); wrap.id = 'g-fog'; wrap.setAttribute('aria-hidden', 'true');
  const fogCv = doc.createElement('canvas'); fogCv.className = 'g-fog-smoke';
  const fxCv = doc.createElement('canvas'); fxCv.className = 'g-fog-fx';
  wrap.appendChild(fogCv); wrap.appendChild(fxCv);
  const mount = () => { if (!wrap.isConnected) doc.body.prepend(wrap); };
  if (doc.body) mount(); else doc.addEventListener('DOMContentLoaded', mount);

  /* ---------- the fog (WebGL, drawn at half size: smoke doesn't need sharp pixels) ---------- */
  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = [
    'precision mediump float;',
    'uniform vec2 res;uniform float t;',
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-.5*res)/min(res.x,res.y);',
    '  uv.y-=.04;',
    '  float r=length(uv);',
    '  vec2 dir=uv/max(r,.001);',
    // slow domain-warped smoke
    '  vec2 q=vec2(fbm(uv*1.5+vec2(t*.021,-t*.017)),fbm(uv*1.5+vec2(-t*.019,t*.023)+5.2));',
    '  float cloud=fbm(uv*2.1+q*1.7+vec2(t*.012,-t*.008));',
    // streaks bursting out of the middle, drifting outward
    '  float rays=fbm(dir*3.2+q*.45+vec2(t*.01));',
    '  float push=fbm(vec2(rays*4.,r*2.4-t*.09)+q);',
    '  float core=smoothstep(1.25,.0,r);',
    '  float d=cloud*core*1.05+pow(rays,2.2)*push*smoothstep(1.05,.08,r)*1.25;',
    '  d+=smoothstep(.55,.0,r)*.18;',
    '  d=clamp(d,0.,1.4);',
    '  vec3 deep=vec3(.004,.006,.03),mid=vec3(.03,.06,.30),hi=vec3(.16,.26,.86);',
    '  vec3 col=mix(deep,mid,smoothstep(.12,.75,d));',
    '  col+=hi*pow(smoothstep(.45,1.15,d),2.)*.9;',
    '  col*=1.-smoothstep(.55,1.35,r)*.75;',
    '  col+=(h(gl_FragCoord.xy+t)-.5)*.012;',  // a little grain so the gradient never bands
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  let gl = null, uRes, uT;
  try {
    gl = fogCv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (gl) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(pr, 'res'); uT = gl.getUniformLocation(pr, 't');
    }
  } catch (e) { gl = null; }
  if (!gl) wrap.classList.add('nogl');   // grug.css keeps a still gradient underneath for this case

  /* ---------- colours of the lights ---------- */
  const hex = c => { c = String(c || '#fff').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const v = parseInt(c, 16) || 0; return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  function themeColors() {
    const T = window.GrugTheme; let list = null;
    try { list = T.ORBS; } catch (e) {}
    return (list && list.length ? list : ['#9be338', '#ffd23f', '#5ab0ff', '#e8f0ff']).map(hex);
  }

  /* ---------- the lights ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, DPR = 1, orbs = [], boxes = [];
  const fx = fxCv.getContext('2d');
  function makeOrbs() {
    const cols = themeColors(), n = W < 700 ? 5 : 7;
    orbs = [];
    for (let i = 0; i < n; i++) {
      const z = rnd(.6, 1), c = cols[i % cols.length];
      orbs.push({ x: rnd(.1, .9) * W, y: rnd(.12, .88) * H, z, a: rnd(0, Math.PI * 2), turn: 0, sp: rnd(38, 70) * z * (W < 700 ? .8 : 1),
        col: c.slice(), to: c.slice(), trail: [], phase: rnd(0, 9) });
    }
  }
  function recolor() {
    const cols = themeColors();
    orbs.forEach((o, i) => { o.to = cols[i % cols.length].slice(); });
    if (still) paintStill();
  }
  function makeBoxes() {
    const n = W < 700 ? 3 : 5; boxes = [];
    for (let i = 0; i < n; i++) boxes.push({ x: rnd(.04, .96), y: rnd(.08, .92), s: rnd(.05, .11) * Math.min(W, H * 1.4) + 30, z: rnd(.4, 1),
      rx: rnd(0, 6), ry: rnd(0, 6), vx: rnd(-.08, .08), vy: rnd(-.1, .1), dx: rnd(-.004, .004), dy: rnd(-.003, .003) });
  }

  // a wandering heading: the turn rate itself drifts, so paths curve and loop like the old boot screen's sparks
  function stepOrb(o, dt) {
    o.turn += (Math.random() - .5) * 5.5 * dt - o.turn * 1.4 * dt;
    o.a += o.turn * dt * 1.6;
    const m = Math.min(W, H) * .1, cx = W / 2, cy = H / 2;
    if (o.x < m || o.x > W - m || o.y < m || o.y > H - m) {      // near an edge: lean back towards the middle
      const want = Math.atan2(cy - o.y, cx - o.x); let d = want - o.a;
      d = Math.atan2(Math.sin(d), Math.cos(d)); o.a += d * Math.min(1, dt * 1.8);
    }
    const sp = o.sp * (1 + Math.sin(o.phase + performance.now() / 1700) * .25);
    o.x += Math.cos(o.a) * sp * dt; o.y += Math.sin(o.a) * sp * dt;
    for (let k = 0; k < 3; k++) o.col[k] += (o.to[k] - o.col[k]) * Math.min(1, dt * 3);
    o.trail.unshift(o.x, o.y);
    const max = Math.round(46 * (W < 700 ? .8 : 1)) * 2;
    if (o.trail.length > max) o.trail.length = max;
  }
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  function drawOrb(o) {
    const r = 5.2 * o.z * (W < 700 ? .9 : 1), tr = o.trail, n = tr.length / 2;
    fx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const k = 1 - i / n;
      fx.strokeStyle = rgba(o.col, .75 * k * k);
      fx.lineWidth = Math.max(.6, r * 1.5 * k);
      fx.beginPath(); fx.moveTo(tr[i * 2 - 2], tr[i * 2 - 1]); fx.lineTo(tr[i * 2], tr[i * 2 + 1]); fx.stroke();
    }
    const halo = fx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 9);
    halo.addColorStop(0, rgba(o.col, .32)); halo.addColorStop(1, rgba(o.col, 0));
    fx.fillStyle = halo; fx.beginPath(); fx.arc(o.x, o.y, r * 9, 0, 7); fx.fill();
    const g = fx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, rgba(o.col, 1)); g.addColorStop(1, rgba(o.col, 0));
    fx.fillStyle = g; fx.beginPath(); fx.arc(o.x, o.y, r * 2.2, 0, 7); fx.fill();
  }

  // dim boxes floating in the fog (plain 3D → 2D, back faces culled)
  const CUBE = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const FACES = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
  function drawBox(b, dt) {
    b.rx += b.vx * dt; b.ry += b.vy * dt; b.x += b.dx * dt; b.y += b.dy * dt;
    if (b.x < -.1) b.x = 1.1; if (b.x > 1.1) b.x = -.1; if (b.y < -.1) b.y = 1.1; if (b.y > 1.1) b.y = -.1;
    const cx = Math.cos(b.rx), sx = Math.sin(b.rx), cy = Math.cos(b.ry), sy = Math.sin(b.ry), s = b.s / 2;
    const P = CUBE.map(([x, y, z]) => { const y1 = y * cx - z * sx, z1 = y * sx + z * cx, x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
      const k = 4 / (4 + z2 * .9); return [b.x * W + x2 * s * k, b.y * H + y1 * s * k * .62 + 0, z2]; });
    fx.lineJoin = 'round';
    FACES.forEach(f => {
      const [a, c, d] = [P[f[0]], P[f[1]], P[f[2]]];
      if ((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]) <= 0) return;
      const lit = .5 + .5 * Math.max(0, -(a[2] + c[2] + d[2]) / 3);
      fx.beginPath(); f.forEach((i, j) => fx[j ? 'lineTo' : 'moveTo'](P[i][0], P[i][1])); fx.closePath();
      fx.fillStyle = 'rgba(' + (14 + lit * 16 | 0) + ',' + (20 + lit * 22 | 0) + ',' + (70 + lit * 50 | 0) + ',' + (.2 * b.z).toFixed(3) + ')'; fx.fill();
      fx.strokeStyle = 'rgba(90,120,230,' + (.1 * b.z).toFixed(3) + ')'; fx.lineWidth = 1.2; fx.stroke();
    });
  }

  /* ---------- size, loop ---------- */
  let fogW = 0, fogH = 0;
  function size() {
    W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 1.75);
    fxCv.width = Math.round(W * DPR); fxCv.height = Math.round(H * DPR);
    const k = Math.min(.5, 900 / Math.max(W, 1));
    fogW = Math.max(2, Math.round(W * k)); fogH = Math.max(2, Math.round(H * k));
    fogCv.width = fogW; fogCv.height = fogH;
    if (!orbs.length) makeOrbs(); else orbs.forEach(o => { o.x = Math.min(o.x, W - 10); o.y = Math.min(o.y, H - 10); o.trail.length = 0; });
    makeBoxes();
  }
  function drawFog(t) {
    if (!gl) return;
    gl.viewport(0, 0, fogW, fogH); gl.uniform2f(uRes, fogW, fogH); gl.uniform1f(uT, t + 40); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawFx(dt, advance) {
    fx.setTransform(DPR, 0, 0, DPR, 0, 0); fx.clearRect(0, 0, W, H);
    fx.globalCompositeOperation = 'source-over';
    boxes.forEach(b => drawBox(b, advance ? dt : 0));
    fx.globalCompositeOperation = 'lighter';
    orbs.forEach(o => { if (advance) stepOrb(o, dt); drawOrb(o); });
    fx.globalCompositeOperation = 'source-over';
  }

  const calm = () => html.classList.contains('calm');
  const held = () => doc.hidden || html.classList.contains('f32-lock');
  let still = false, raf = 0, last = 0, t0 = performance.now(), frame = 0;
  function paintStill() {
    // run the lights forward a moment so they have tails, then draw once
    orbs.forEach(o => { o.trail.length = 0; for (let i = 0; i < 45; i++) stepOrb(o, 1 / 60); o.col = o.to.slice(); });
    drawFog(12); drawFx(0, false);
  }
  function tick(now) {
    raf = 0;
    if (held()) return;
    if (calm()) { still = true; paintStill(); return; }
    still = false;
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (frame++ % 2 === 0) drawFog((now - t0) / 1000);   // the smoke moves slowly: half the frames is plenty
    drawFx(dt, true);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  size(); recolor();
  drawFog(0);
  addEventListener('resize', () => { size(); if (still || held()) paintStill(); });
  doc.addEventListener('visibilitychange', start);
  addEventListener('grug:change', recolor);
  doc.addEventListener('grug:theme', () => { recolor(); start(); });
  new MutationObserver(start).observe(html, { attributes: true, attributeFilter: ['class'] });
  addEventListener('pageshow', start);
  start();
})();
