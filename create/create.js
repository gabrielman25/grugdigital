/* Create page: preset gallery for Model Kit.
   Needs modelkit-core.js (window.SFCore, the editor's own mesher and exporters) and presets.js (window.MK_PRESETS).
   Every preview and download is built in the browser from the preset's .shape.json / .bash.json, exactly as the editor would. */
(function () {
  const SF = window.SFCore, P = window.MK_PRESETS;

  /* ---------- meshes (cached) ---------- */
  const cache = {};
  function preset(kind, id) { return (kind === 'scene' ? P.scenes : P.models).find(p => p.id === id); }
  function mesh(kind, id) {
    const k = kind + ':' + id; if (cache[k]) return cache[k];
    const p = preset(kind, id); let m;
    if (kind === 'scene') m = SF.buildAssemblyMesh(JSON.parse(JSON.stringify(p.data)), { optimize: true, curveSegments: 10 });
    else { const r = SF.fromText(p.data); if (!r.model) throw new Error('bad preset ' + id); m = SF.buildMesh(r.model, { optimize: true, curveSegments: 10 }); }
    return (cache[k] = m);
  }
  function stats(kind, id) { const m = mesh(kind, id), b = m.bounds; return { tris: m.triangleCount, w: Math.round(b.max[0] - b.min[0]), h: Math.round(b.max[1] - b.min[1]), d: Math.round(b.max[2] - b.min[2]) }; }

  /* ---------- downloads (same settings as the editor's Export tab, pivot at the bottom for game engines) ---------- */
  function save(name, data, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function download(kind, id, fmt) {
    const p = preset(kind, id), base = SF.safeName(p.id);
    if (fmt === 'project') {
      if (kind === 'scene') return save(base + '.bash.json', JSON.stringify(p.data), 'application/json');
      return save(base + '.shape.json', typeof p.data === 'string' ? p.data : JSON.stringify(p.data), 'application/json');
    }
    const m = SF.transformMesh(mesh(kind, id), { scale: 1, pivot: 'bottom' });
    if (fmt === 'glb') save(base + '.glb', SF.toGLB(m, {}), 'model/gltf-binary');
    else if (fmt === 'obj') save(base + '_obj.zip', SF.makeZip(SF.toOBJ(m, {})), 'application/zip');
    else if (fmt === 'stl') save(base + '.stl', SF.toSTL(m), 'model/stl');
  }

  /* ---------- a small WebGL2 viewer (the editor's shader and Studio light) ---------- */
  const VS = `#version 300 es
in vec3 aP; in vec3 aN; in vec3 aC; uniform mat4 uVP; uniform mat3 uV; out vec3 vN; out vec3 vC;
void main(){ vN = uV * aN; vC = aC; gl_Position = uVP * vec4(aP,1.0); }`;
  const FS = `#version 300 es
precision highp float; in vec3 vN; in vec3 vC; out vec4 o;
uniform vec3 uL; uniform vec3 uLC; uniform vec3 uAC; uniform float uRim;
void main(){
  vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
  float d = max(dot(n, normalize(uL)), 0.0), dz = max(n.z, 0.0), h = 0.5 + 0.5*n.y;
  vec3 c = vC*(uAC*(0.40 + 0.06*h) + uLC*(0.42*d + 0.22*dz)) + uRim*pow(1.0 - max(n.z, 0.0), 3.0)*uLC*0.6;
  o = vec4(c, 1.0);
}`;
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function trans(x, y, z) { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; o[12] = x; o[13] = y; o[14] = z; return o; }
  function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; }

  function Viewer(canvas, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.keep });
    if (!gl) { this.ok = false; return; }
    this.ok = true; this.gl = gl; this.c = canvas; this.yaw = opts.yaw == null ? 0.65 : opts.yaw; this.pitch = opts.pitch == null ? 0.32 : opts.pitch; this.spin = opts.spin || 0;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aN'); gl.bindAttribLocation(p, 2, 'aC'); gl.linkProgram(p);
    this.p = p; this.u = {}; ['uVP', 'uV', 'uL', 'uLC', 'uAC', 'uRim'].forEach(n => this.u[n] = gl.getUniformLocation(p, n));
    this.vao = gl.createVertexArray(); this.bufs = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()];
    if (opts.drag) this.wireDrag();
  }
  Viewer.prototype.set = function (m) {
    const gl = this.gl; if (!gl) return;
    const pal = m.palette.map(hex), n = m.colorIndex.length, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = pal[m.colorIndex[i]] || [1, 0, 1]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    gl.bindVertexArray(this.vao);
    [[0, m.positions], [1, m.normals], [2, col]].forEach(([loc, data]) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[loc]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufs[3]); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.count = m.indices.length;
    const b = m.bounds; this.ctr = [0, 1, 2].map(k => (b.min[k] + b.max[k]) / 2);
    this.rad = Math.max(0.5, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2);
  };
  Viewer.prototype.draw = function () {
    const gl = this.gl; if (!gl || !this.count) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1) * 0.5 /* 3D at half resolution */, W = Math.max(1, Math.round(this.c.clientWidth * dpr)), H = Math.max(1, Math.round(this.c.clientHeight * dpr));
    if (!this.fixed && (this.c.width !== W || this.c.height !== H)) { this.c.width = W; this.c.height = H; }
    gl.viewport(0, 0, this.c.width, this.c.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const fov = 30 * Math.PI / 180, dist = this.rad / Math.sin(fov / 2) * 1.04;
    // camera orbits the model: view = translate(0,0,-dist) · rotX(pitch) · rotY(-yaw) · translate(-centre)
    const V = mul(trans(0, 0, -dist), mul(rotX(this.pitch), mul(rotY(-this.yaw), trans(-this.ctr[0], -this.ctr[1], -this.ctr[2]))));
    const VP = mul(persp(fov, this.c.width / this.c.height, dist * 0.05, dist * 4), V);
    gl.useProgram(this.p);
    gl.uniformMatrix4fv(this.u.uVP, false, VP);
    gl.uniformMatrix3fv(this.u.uV, false, new Float32Array([V[0], V[1], V[2], V[4], V[5], V[6], V[8], V[9], V[10]]));
    const az = -30 * Math.PI / 180, el = 40 * Math.PI / 180;   // Studio preset
    gl.uniform3f(this.u.uL, Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    gl.uniform3fv(this.u.uLC, hex('#fff4e2').map(v => v * 1.12)); gl.uniform3fv(this.u.uAC, hex('#dde6ff').map(v => v * 0.96)); gl.uniform1f(this.u.uRim, 0.25);
    gl.bindVertexArray(this.vao); gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
  };
  Viewer.prototype.wireDrag = function () {
    let d = null;
    this.c.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.c.setPointerCapture(e.pointerId); this.held = true; });
    this.c.addEventListener('pointermove', e => { if (!d) return; this.yaw = d.yaw - (e.clientX - d.x) * 0.012; this.pitch = Math.max(-1.2, Math.min(1.35, d.pitch + (e.clientY - d.y) * 0.01)); });
    const up = () => { d = null; this.held = false; this.idleAt = performance.now(); };
    this.c.addEventListener('pointerup', up); this.c.addEventListener('pointercancel', up);
  };
  Viewer.prototype.run = function () {
    let last = performance.now();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (t) => {
      if (this.dead) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.spin && !this.held && !still && (!this.idleAt || t - this.idleAt > 1500)) this.yaw += this.spin * dt;
      this.draw(); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };
  Viewer.prototype.stop = function () { this.dead = true; cancelAnimationFrame(this.raf); const e = this.gl && this.gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); };

  /* thumbnails: one offscreen viewer renders every preset to a PNG (tools/modelkit/thumbs.js saves them to create/thumbs/) */
  function thumb(kind, id, size, type) {
    const c = document.createElement('canvas'); c.width = c.height = size || 512; c.style.width = c.style.height = (size || 512) + 'px';
    const v = new Viewer(c, { keep: true }); if (!v.ok) return null; v.fixed = true;
    v.set(mesh(kind, id)); v.draw(); const url = c.toDataURL(type || 'image/png', 0.92); v.stop(); return url;
  }

  window.MK = { Viewer, mesh, stats, download, thumb, preset };
})();
