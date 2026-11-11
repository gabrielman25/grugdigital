/* =====================================================================================
   ARENA: the 3D voxel sports world (three.js r149, captured as T3)
   Blocks come from the Grug kit atlas (padded copy, so mipmaps never bleed). Lighting is baked into vertex colours
   (face shade + ambient occlusion) like the kit's block shader; the ball, posts and rim are lit by two lights.
   Units are metres. The goal or hoop sits at z = 0 and the player shoots toward -z.
   ===================================================================================== */
const Arena = (() => {
  const T = T3;
  let R = null, cam = null, ATL = null, ready = null;
  const worlds = {};
  const CELL = ATLAS_CELLS;
  const uvOf = name => { const i = CELL[name]; if (i == null) throw new Error('cell ' + name); const c = i % 8, r = (i / 8) | 0; return [(c * 32 + 8) / 256, 1 - (r * 32 + 24) / 256, (c * 32 + 24) / 256, 1 - (r * 32 + 8) / 256]; };
  const BLOCKS = {};
  const defB = (n, t, s, b, o) => (BLOCKS[n] = Object.assign({ t: uvOf(t), s: uvOf(s || t), b: uvOf(b || s || t) }, o || {}));
  function initBlocks() {
    defB('grass', 'grassTop', 'grassSide', 'dirt'); defB('dirt', 'dirt'); defB('stone', 'stone'); defB('cobble', 'cobble');
    defB('smooth', 'smooth'); defB('bricks', 'bricks'); defB('planks', 'planks'); defB('spruce', 'spruce'); defB('darkPlanks', 'darkPlanks');
    defB('log', 'logTop', 'logSide'); defB('gold', 'gold'); defB('leaves', 'leaves', null, null, { cut: true }); defB('glow', 'glow', null, null, { glow: true });
    defB('lantern', 'lantern', null, null, { glow: true }); defB('stonebricks', 'stonebricks'); defB('mossy', 'mossy'); defB('quartz', 'quartz', 'quartzSide');
    defB('hay', 'hayTop', 'haySide');
    ['white', 'orange', 'yellow', 'lime', 'gray', 'lightgray', 'cyan', 'blue', 'brown', 'green', 'red', 'black', 'slate', 'gold'].forEach(c => defB('c_' + c, 'c_' + c));
    ['white', 'orange', 'yellow', 'gray', 'lightgray', 'blue', 'brown', 'red', 'black'].forEach(c => defB('w_' + c, 'w_' + c));
  }

  /* ---------- voxel mesher: culled faces, per-vertex AO, baked face shade ---------- */
  const FACES = [
    { n: [1, 0, 0], a: 0, u: 2, v: 1, sh: .80, k: 's' }, { n: [-1, 0, 0], a: 0, u: 2, v: 1, sh: .72, k: 's' },
    { n: [0, 1, 0], a: 1, u: 0, v: 2, sh: 1.0, k: 't' }, { n: [0, -1, 0], a: 1, u: 0, v: 2, sh: .5, k: 'b' },
    { n: [0, 0, 1], a: 2, u: 0, v: 1, sh: .9, k: 's' }, { n: [0, 0, -1], a: 2, u: 0, v: 1, sh: .66, k: 's' }];
  const AO = [.52, .7, .86, 1];
  const key = (x, y, z) => ((x + 1024) * 2048 + (y + 256)) * 2048 + (z + 1024);
  function Vox() {
    const m = new Map();
    const api = {
      set(x, y, z, b) { if (b) m.set(key(x, y, z), { x, y, z, b: typeof b === 'string' ? BLOCKS[b] : b }); else m.delete(key(x, y, z)); },
      get(x, y, z) { const e = m.get(key(x, y, z)); return e && e.b; },
      box(x0, y0, z0, x1, y1, z1, b) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) api.set(x, y, z, typeof b === 'function' ? b(x, y, z) : b); },
      meshes() {
        const out = { o: { P: [], U: [], C: [], I: [] }, c: { P: [], U: [], C: [], I: [] } };
        const solid = (x, y, z) => { const b = api.get(x, y, z); return b && !b.cut; };
        for (const e of m.values()) {
          const B = e.b, G = B.cut ? out.c : out.o;
          for (const f of FACES) {
            const nx = e.x + f.n[0], ny = e.y + f.n[1], nz = e.z + f.n[2];
            const nb = api.get(nx, ny, nz); if (nb && !nb.cut) continue; if (nb && B.cut && nb.cut) continue;
            const uv = f.k === 't' ? B.t : f.k === 'b' ? B.b : B.s;
            const base = G.P.length / 3, ao = [];
            for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
              const p = [e.x, e.y, e.z]; if (f.n[f.a] > 0) p[f.a] += 1; p[f.u] += cu; p[f.v] += cv;
              G.P.push(p[0], p[1], p[2]);
              G.U.push(cu ? uv[2] : uv[0], cv ? uv[3] : uv[1]);
              let lv = 3;
              if (!B.glow) {
                const q = [nx, ny, nz], s1 = q.slice(), s2 = q.slice(); s1[f.u] += cu ? 1 : -1; s2[f.v] += cv ? 1 : -1; const c3 = s1.slice(); c3[f.v] += cv ? 1 : -1;
                const a1 = solid(...s1) ? 1 : 0, a2 = solid(...s2) ? 1 : 0, a3 = solid(...c3) ? 1 : 0;
                lv = a1 && a2 ? 0 : 3 - (a1 + a2 + a3);
              }
              ao.push(lv);
              const k = B.glow ? 1.25 : f.sh * AO[lv] * (B.dim || 1);
              G.C.push(k, k, k);
            }
            // orientation check
            const P = G.P, i0 = base * 3, e1 = [P[i0 + 3] - P[i0], P[i0 + 4] - P[i0 + 1], P[i0 + 5] - P[i0 + 2]], e3 = [P[i0 + 9] - P[i0], P[i0 + 10] - P[i0 + 1], P[i0 + 11] - P[i0 + 2]];
            const cr = [e1[1] * e3[2] - e1[2] * e3[1], e1[2] * e3[0] - e1[0] * e3[2], e1[0] * e3[1] - e1[1] * e3[0]];
            const ok = cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] > 0;
            const flip = ao[0] + ao[2] < ao[1] + ao[3];
            let tris = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            if (!ok) tris = [tris[0], tris[2], tris[1], tris[3], tris[5], tris[4]];
            for (const t of tris) G.I.push(base + t);
          }
        }
        return out;
      }
    };
    return api;
  }
  function geoFrom(G) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(G.P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(G.U, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(G.C, 3)); g.setIndex(G.I); g.computeBoundingSphere(); return g;
  }
  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      o: new T.MeshBasicMaterial({ map: ATL, vertexColors: true }),
      c: new T.MeshBasicMaterial({ map: ATL, vertexColors: true, alphaTest: .5, side: T.DoubleSide })
    };
    return MAT;
  }
  function addVox(w, vox) {
    const o = vox.meshes(); const M = mats();
    if (o.o.I.length) w.scene.add(new T.Mesh(geoFrom(o.o), M.o));
    if (o.c.I.length) w.scene.add(new T.Mesh(geoFrom(o.c), M.c));
  }

  /* ---------- painted canvases (field, court, boards, jumbotron) ---------- */
  let atlasImg = null;
  function tileDraw(cx, name, x, y, s) { const i = CELL[name], c = i % 8, r = (i / 8) | 0; cx.drawImage(atlasImg, c * 32 + 8, r * 32 + 8, 16, 16, x, y, s, s); }
  let logoMasks = {};
  function logoMask(hex) {
    if (logoMasks[hex]) return logoMasks[hex];
    const im = LOGO_IMG, s = 384, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, s, s); const d = x.getImageData(0, 0, s, s), p = d.data; const col = new T.Color(hex);
    for (let i = 0; i < p.length; i += 4) { const l = p[i] / 255; p[i + 3] = Math.max(0, Math.min(255, (1 - l) * 1.25 * 255)); p[i] = col.r * 255; p[i + 1] = col.g * 255; p[i + 2] = col.b * 255; }
    x.putImageData(d, 0, 0); return (logoMasks[hex] = c);
  }
  function canvasTex(c, opt) {
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = R ? Math.min(8, R.capabilities.getMaxAnisotropy()) : 1;
    if (opt && opt.px) { t.magFilter = T.NearestFilter; t.minFilter = T.LinearMipmapLinearFilter; }
    return t;
  }
  function pixelText(cx, text, x, y, h, color, align) {
    // render small, then scale up with no smoothing: blocky lettering like the rest of the world
    const sc = 4, t = document.createElement('canvas'), tx = t.getContext('2d'); const fs = Math.max(8, Math.round(h / sc));
    tx.font = `800 ${fs}px Bricolage, sans-serif`; const w = Math.ceil(tx.measureText(text).width) + 4; t.width = w; t.height = fs + 4;
    tx.font = `800 ${fs}px Bricolage, sans-serif`; tx.fillStyle = color; tx.textBaseline = 'top'; tx.fillText(text, 2, 1);
    cx.imageSmoothingEnabled = false; const dw = w * sc, dh = (fs + 4) * sc;
    cx.drawImage(t, align === 'center' ? x - dw / 2 : x, y, dw, dh); cx.imageSmoothingEnabled = true;
  }
  // a grass field: one 16 px grass tile per metre, mowing stripes, white lines from paint(cx, toPx)
  function fieldTex(wm, hm, x0, z0, stripe, paint) {
    const ppm = 16, c = document.createElement('canvas'); c.width = wm * ppm; c.height = hm * ppm; const cx = c.getContext('2d');
    for (let i = 0; i < wm; i++) for (let j = 0; j < hm; j++) {
      const z = z0 + j + .5; const band = stripe ? Math.floor(z / stripe) & 1 : 0;
      tileDraw(cx, band ? 'grassTop2' : 'grassTop', i * ppm, j * ppm, ppm);
      const n = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1; cx.fillStyle = n > 0 ? `rgba(255,255,255,${n * .05})` : `rgba(0,0,0,${-n * .06})`; cx.fillRect(i * ppm, j * ppm, ppm, ppm);
    }
    const P = (x, z) => [(x - x0) * ppm, (z - z0) * ppm];
    cx.imageSmoothingEnabled = false; paint(cx, P, ppm);
    return c;
  }
  function plane(w, tex, x0, z0, wm, hm, y) {
    const g = new T.PlaneGeometry(wm, hm); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: canvasTex(tex, { px: true }) }));
    m.position.set(x0 + wm / 2, y || 0, z0 + hm / 2); w.scene.add(m); return m;
  }
  function ledTex(msgs) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#0b0f10'; x.fillRect(0, 0, 2048, 64);
    let px = 20; x.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) for (const [m, col] of msgs) { x.font = '800 34px Bricolage, sans-serif'; x.fillStyle = col; x.fillText(m, px, 34); px += x.measureText(m).width + 60; x.fillStyle = '#cfac52'; x.fillRect(px - 38, 28, 12, 12); }
    // LED dot mask
    x.globalCompositeOperation = 'destination-in'; const d = document.createElement('canvas'); d.width = 4; d.height = 4; const dx = d.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 3, 3);
    x.fillStyle = x.createPattern(d, 'repeat'); x.fillRect(0, 0, 2048, 64); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#050707'; x.fillRect(0, 0, 2048, 64);
    const t = canvasTex(c); t.wrapS = T.RepeatWrapping; t.repeat.set(.5, 1); return t;
  }
  const LED_MSGS = [['R&R CRAFTHOUSE GRILL', '#ffffff'], ['GAME DAY AT THE CRAFTHOUSE', '#cfac52'], ['ORDER AHEAD IN THE R&R APP', '#ffffff'], ['TRY THE NEWTON BURGER', '#f3e2ad'], ['BOUDIN BALLS · GUMBO · PO’BOYS', '#ffffff']];
  function adBoard(w, x0, x1, z, face, y) {
    const len = Math.abs(x1 - x0), g = new T.BoxGeometry(len, 1, .25);
    const t = ledTex(LED_MSGS); t.repeat.set(len / 40, 1);
    const front = new T.MeshBasicMaterial({ map: t }), dark = new T.MeshBasicMaterial({ color: 0x15191a });
    const m = new T.Mesh(g, [dark, dark, dark, dark, front, dark]);
    m.position.set((x0 + x1) / 2, (y || 0) + .5, z); if (face === 'x+') { m.rotation.y = Math.PI / 2; } if (face === 'x-') { m.rotation.y = -Math.PI / 2; }
    w.scene.add(m); w.leds.push(t); return m;
  }
  function jumbotron(w, x, y, z, ww, hh, title) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 384; const tex = canvasTex(c);
    const m = new T.Mesh(new T.PlaneGeometry(ww, hh), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set(x, y, z); w.scene.add(m);
    const J = { c, tex, title, score: 0, flash: '', t: 0, draw() {
      const x = c.getContext('2d'); x.fillStyle = '#081012'; x.fillRect(0, 0, 768, 384);
      x.fillStyle = '#0f1d21'; x.fillRect(10, 10, 748, 364);
      if (J.flash) {
        x.fillStyle = J.flashCol || '#cfac52'; x.fillRect(10, 10, 748, 364);
        pixelText(x, J.flash, 384, 120, 120, '#14110a', 'center');
      } else {
        x.drawImage(logoMask('#ffffff'), 18, 30, 320, 320);
        pixelText(x, J.title.toUpperCase(), 556, 52, 44, '#cfac52', 'center');
        pixelText(x, String(J.score).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 556, 140, 132, '#ffffff', 'center');
        pixelText(x, J.sub || 'GAME DAY', 556, 300, 40, '#8fa3a9', 'center');
      }
      // LED dots
      x.globalCompositeOperation = 'multiply'; x.fillStyle = J.pat || (J.pat = (() => { const d = document.createElement('canvas'); d.width = d.height = 6; const q = d.getContext('2d'); q.fillStyle = '#555'; q.fillRect(0, 0, 6, 6); q.fillStyle = '#fff'; q.fillRect(0, 0, 5, 5); return x.createPattern(d, 'repeat'); })());
      x.fillRect(0, 0, 768, 384); x.globalCompositeOperation = 'source-over'; tex.needsUpdate = true;
    } };
    J.draw(); w.jumbo = J; return J;
  }
  function glowSprite(w, x, y, z, s, col, op) {
    if (!glowSprite.tex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); glowSprite.tex = new T.CanvasTexture(c); }
    const sp = new T.Sprite(new T.SpriteMaterial({ map: glowSprite.tex, color: col || 0xfff1c8, transparent: true, opacity: op || .8, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); w.scene.add(sp); return sp;
  }
  function sky(w, top, mid, hor, sunDir) {
    const g = new T.SphereGeometry(600, 32, 16);
    const m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { a: { value: new T.Color(top) }, b: { value: new T.Color(mid) }, c: { value: new T.Color(hor) }, s: { value: new T.Vector3(...sunDir).normalize() } },
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 a,b,c,s;varying vec3 vP;void main(){float y=vP.y;vec3 col=mix(c,b,smoothstep(0.,.18,y));col=mix(col,a,smoothstep(.18,.7,y));float sd=max(dot(vP,s),0.);col+=vec3(1.,.75,.45)*pow(sd,24.)*.55+vec3(1.,.9,.7)*pow(sd,400.)*1.2;gl_FragColor=vec4(col,1.);}' });
    const sk = new T.Mesh(g, m); w.scene.add(sk); sk.renderOrder = -1;
    // voxel clouds
    const cg = new T.BoxGeometry(1, 1, 1), cm = new T.MeshBasicMaterial({ color: 0xfff6ea, fog: false, transparent: true, opacity: .92 });
    const N = 14, inst = new T.InstancedMesh(cg, cm, N * 4), M = new T.Matrix4(); let k = 0; let seed = 7;
    const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI * .9 + rr() * Math.PI * .8 - Math.PI * .1, d = 230 + rr() * 140, cx = Math.cos(a) * d, cz = Math.sin(a) * d - 60, cy = 70 + rr() * 60;
      for (let j = 0; j < 4; j++) { const sx = 18 + rr() * 26, sz = 10 + rr() * 16; M.compose(new T.Vector3(cx + (rr() - .5) * 30, cy + j * 3.5 * (rr() > .5 ? 1 : 0), cz + (rr() - .5) * 18), new T.Quaternion(), new T.Vector3(sx, 4, sz)); inst.setMatrixAt(k++, M); }
    }
    w.scene.add(inst);
  }

  /* ---------- the crowd: one instanced mesh, cheering in the vertex shader ---------- */
  function crowd(w, spots) {
    const P = [], C = [], H = [], A = [];
    const box = (x0, y0, z0, x1, y1, z1, head, arm) => {
      const v = (i, j, k) => [i ? x1 : x0, j ? y1 : y0, k ? z1 : z0];
      const q = (a, b, c, d, sh) => { for (const p of [a, b, c, a, c, d]) { P.push(...p); C.push(sh, sh, sh); H.push(head); A.push(arm); } };
      q(v(0, 1, 1), v(1, 1, 1), v(1, 1, 0), v(0, 1, 0), 1); q(v(1, 0, 1), v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), .78); q(v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0), .7);
      q(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1), .92); q(v(1, 0, 0), v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), .62);
    };
    box(-.32, 0, -.22, .32, .78, .22, 0, 0); box(-.22, .78, -.2, .22, 1.2, .2, 1, 0); box(-.47, .2, -.1, -.33, .74, .1, 0, 1); box(.33, .2, -.1, .47, .74, .1, 0, 1);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setAttribute('aHead', new T.Float32BufferAttribute(H, 1)); g.setAttribute('aArm', new T.Float32BufferAttribute(A, 1));
    const n = spots.length, body = new Float32Array(n * 3), skin = new Float32Array(n * 3), ph = new Float32Array(n);
    const BODY = ['#cfac52', '#24383f', '#f1efe9', '#1d1d1d', '#b8402f', '#cfac52', '#3a6ea5', '#e07b39', '#24383f', '#ffffff'], SKIN = ['#f1c9a5', '#e0b08a', '#c68c63', '#9c6845', '#6e4630'];
    const col = new T.Color();
    spots.forEach((s, i) => { col.set(BODY[(i * 7 + (i >> 3)) % BODY.length]).convertSRGBToLinear(); body.set([col.r, col.g, col.b], i * 3); col.set(SKIN[(i * 13) % SKIN.length]).convertSRGBToLinear(); skin.set([col.r, col.g, col.b], i * 3); ph[i] = (Math.sin(i * 91.7) * .5 + .5); });
    g.setAttribute('aBody', new T.InstancedBufferAttribute(body, 3)); g.setAttribute('aSkin', new T.InstancedBufferAttribute(skin, 3)); g.setAttribute('aPh', new T.InstancedBufferAttribute(ph, 1));
    const U = { uT: { value: 0 }, uC: { value: 0 } };
    const m = new T.MeshBasicMaterial({ vertexColors: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = U.uT; sh.uniforms.uC = U.uC;
      sh.vertexShader = 'attribute float aHead,aArm,aPh;attribute vec3 aBody,aSkin;uniform float uT,uC;varying vec3 vTint;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vTint=mix(aBody,aSkin,aHead); float c=clamp(uC*(.6+.8*aPh),0.,1.); transformed.y+=c*abs(sin(uT*(8.+aPh*4.)+aPh*6.28))*.42+.04*sin(uT*1.3+aPh*30.); transformed.y+=aArm*c*.62;');
      sh.fragmentShader = 'varying vec3 vTint;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb*=vTint;');
    };
    const im = new T.InstancedMesh(g, m, n), M4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    spots.forEach((s, i) => { q.setFromAxisAngle(up, s.r); M4.compose(new T.Vector3(s.x, s.y, s.z), q, new T.Vector3(1, 1, 1)); im.setMatrixAt(i, M4); });
    im.frustumCulled = false; w.scene.add(im); w.crowdU = U;
  }

  /* ---------- voxel balls ---------- */
  function voxModel(n, inside, colorAt, size) {
    const grid = new Map(), k = (x, y, z) => x + ',' + y + ',' + z, h = (n - 1) / 2;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) { const p = [(x - h) / h, (y - h) / h, (z - h) / h]; if (inside(...p)) grid.set(k(x, y, z), colorAt(...p)); }
    const P = [], N = [], C = [], col = new T.Color();
    for (const [kk, c] of grid) {
      const [x, y, z] = kk.split(',').map(Number); col.set(c).convertSRGBToLinear();
      for (const f of FACES) {
        if (grid.has(k(x + f.n[0], y + f.n[1], z + f.n[2]))) continue;
        const cs = [];
        for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const p = [x, y, z]; if (f.n[f.a] > 0) p[f.a] += 1; p[f.u] += cu; p[f.v] += cv; cs.push(p.map(t => (t - n / 2) * size / n)); }
        const e1 = cs[1].map((t, i) => t - cs[0][i]), e3 = cs[3].map((t, i) => t - cs[0][i]); const cr = [e1[1] * e3[2] - e1[2] * e3[1], e1[2] * e3[0] - e1[0] * e3[2], e1[0] * e3[1] - e1[1] * e3[0]];
        const ord = (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] > 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const i of ord) { P.push(...cs[i]); N.push(...f.n); C.push(col.r, col.g, col.b); }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
  }
  const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]; return v.map(p => { const l = Math.hypot(...p); return p.map(q => q / l); }); })();
  function ballMesh(kind, gold) {
    if (kind === 'football') {
      const base = gold ? '#e8b84a' : '#8b4a24', dk = gold ? '#c8962e' : '#6e381a', wh = gold ? '#fff4c8' : '#f4efe6';
      return voxModel(13, (x, y, z) => x * x + (y * y + z * z) / .36 <= 1.02, (x, y, z) => {
        if (y > .32 && Math.abs(z) < .1 && Math.abs(x) < .38) return wh;
        if (y > .4 && Math.abs(x) < .34 && Math.abs(x * 100 % 17) < 5) return wh;
        if (Math.abs(Math.abs(x) - .66) < .07) return wh;
        return ((x * 7 + y * 3 + z * 5) % 1 > .5) ? base : dk;
      }, .46);
    }
    if (kind === 'soccer') {
      return voxModel(11, (x, y, z) => x * x + y * y + z * z <= 1.05, (x, y, z) => {
        const l = Math.hypot(x, y, z) || 1; let best = -2; for (const c of ICO) best = Math.max(best, (x * c[0] + y * c[1] + z * c[2]) / l);
        return best > .9 ? (gold ? '#7a5a12' : '#1c1c1c') : (gold ? '#f0c75a' : '#f7f6f2');
      }, .3);
    }
    return voxModel(11, (x, y, z) => x * x + y * y + z * z <= 1.05, (x, y, z) => {
      const l = Math.hypot(x, y, z) || 1, nx = x / l, ny = y / l, nz = z / l;
      if (Math.abs(nx) < .1 || Math.abs(ny) < .1 || Math.abs(Math.abs(nz) - .72 - .2 * nx * nx) < .07) return gold ? '#6b4c0c' : '#2a1608';
      return gold ? '#efc14f' : ((x * 5 + y * 7) % 1 > .5 ? '#e06f28' : '#d1601f');
    }, .3);
  }
  function coinMesh(r) {
    const c = document.createElement('canvas'); c.width = c.height = 256; Coin.draw(c.getContext('2d'), -14, -14, 284, 0, 0, 1, .25, -9);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const face = new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .4 }), side = new T.MeshLambertMaterial({ color: 0xc99a35, emissive: 0x3a2808 });
    const g = new T.CylinderGeometry(r, r, r * .16, 40); const m = new T.Mesh(g, [side, face, face]); m.rotation.x = Math.PI / 2;
    const grp = new T.Group(); grp.add(m); return grp;
  }

  /* ---------- particles: voxel confetti + coins ---------- */
  function particles(w) {
    const N = 320, g = new T.BoxGeometry(.16, .16, .16), m = new T.MeshBasicMaterial({ vertexColors: false });
    const im = new T.InstancedMesh(g, m, N); im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false;
    const cols = ['#cfac52', '#f3e2ad', '#ffffff', '#24383f', '#b8402f', '#2f5e49', '#ffd65a'].map(h => new T.Color(h));
    const ps = []; const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), S0 = new T.Vector3(0, 0, 0);
    for (let i = 0; i < N; i++) { im.setColorAt(i, cols[i % cols.length]); M4.compose(new T.Vector3(), Q, S0); im.setMatrixAt(i, M4); ps.push({ life: 0 }); }
    w.scene.add(im); let head = 0;
    w.fx = {
      burst(p, n, power, up) { for (let i = 0; i < n; i++) { const o = ps[head]; head = (head + 1) % N; o.life = 1.6 + Math.random(); o.t = 0; o.p = p.clone(); const a = Math.random() * Math.PI * 2, s = (power || 8) * (.4 + Math.random() * .6); o.v = new T.Vector3(Math.cos(a) * s * .6, (up || 6) + Math.random() * s * .8, Math.sin(a) * s * .6); o.r = new T.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6); o.s = .6 + Math.random() * .9; } },
      step(dt) {
        for (let i = 0; i < N; i++) {
          const o = ps[i]; if (o.life <= 0) continue; o.t += dt; o.life -= dt;
          o.v.y -= 9.8 * dt * .7; o.v.multiplyScalar(1 - dt * .9); o.p.addScaledVector(o.v, dt); if (o.p.y < .08) { o.p.y = .08; o.v.y *= -.3; o.v.x *= .6; o.v.z *= .6; }
          E.set(o.r.x * o.t, o.r.y * o.t, o.r.z * o.t); Q.setFromEuler(E); const s = o.s * Math.min(1, o.life * 2);
          M4.compose(o.p, Q, new T.Vector3(s, s, s)); im.setMatrixAt(i, M4); if (o.life <= 0) { M4.compose(o.p, Q, S0); im.setMatrixAt(i, M4); }
        }
        im.instanceMatrix.needsUpdate = true;
      }
    };
  }
  // trail + aim dots: small cubes
  function dots(w, n, color, size) {
    const im = new T.InstancedMesh(new T.BoxGeometry(size, size, size), new T.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, fog: false }), n);
    im.frustumCulled = false; const M4 = new T.Matrix4(), S0 = new T.Vector3(0, 0, 0), Q = new T.Quaternion();
    for (let i = 0; i < n; i++) { M4.compose(new T.Vector3(), Q, S0); im.setMatrixAt(i, M4); } w.scene.add(im);
    return { im, set(list) { for (let i = 0; i < n; i++) { const p = list[i]; if (p) { const s = p.s == null ? 1 : p.s; M4.compose(p, Q, new T.Vector3(s, s, s)); } else M4.compose(S0, Q, S0); im.setMatrixAt(i, M4); } im.instanceMatrix.needsUpdate = true; } };
  }
  function shadowBlob(w) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64);
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; w.scene.add(m); return m;
  }
  function lights(w) {
    w.scene.add(new T.HemisphereLight(0xfff3df, 0x58703a, .62));
    const d = new T.DirectionalLight(0xffe6c0, .72); d.position.set(-30, 40, 25); w.scene.add(d);
  }
  const litBox = (w, sx, sy, sz, x, y, z, col, em) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), new T.MeshLambertMaterial({ color: col, emissive: em || 0x000000 })); m.position.set(x, y, z); w.scene.add(m); return m; };

  /* ---------- a stadium (football + soccer) ---------- */
  function stadium(w, o) {
    const vox = Vox(), spots = [];
    const E = o.endZ;                 // first row of the end stand
    const SX = o.sideX;               // first column of the side stands
    // ground around the field (one block below y = 0)
    vox.box(-SX - 1, -1, E + 1, SX + 1, 0, o.farZ, (x, y, z) => Math.abs(x) >= o.fieldHalf + 1 || z < o.fieldZ0 ? 'grass' : null);
    // end stand behind the goal: steps rising away from the field
    const rows = 13;
    for (let r = 0; r < rows; r++) {
      const z = E - r;
      for (let x = -SX - 6; x <= SX + 5; x++) {
        for (let y = 0; y <= r; y++) vox.set(x, y, z, y === r ? ((Math.abs(x) % 12 === 0) ? 'c_lightgray' : (r % 2 ? 'c_gray' : 'c_slate')) : 'stonebricks');
        if (Math.abs(x) % 12 !== 0 && ((x * 31 + r * 17) % 10) < 8) spots.push({ x: x + .5, y: r + 1, z: z + .5, r: 0 });
      }
    }
    // back wall + gold band
    for (let x = -SX - 6; x <= SX + 5; x++) for (let y = 0; y < rows + 4; y++) vox.set(x, y, E - rows, y === rows + 3 ? 'gold' : (y > rows ? 'c_slate' : 'stonebricks'));
    // side stands
    for (const sgn of [-1, 1]) {
      for (let r = 0; r < 10; r++) {
        const x = sgn > 0 ? SX + r : -SX - 1 - r;
        for (let z = E + 1; z < o.farZ; z++) {
          for (let y = 0; y <= r; y++) vox.set(x, y, z, y === r ? ((Math.abs(z) % 12 === 0) ? 'c_lightgray' : (r % 2 ? 'c_gray' : 'c_slate')) : 'stonebricks');
          if (Math.abs(z) % 12 !== 0 && ((z * 13 + r * 29 + (sgn > 0 ? 3 : 0)) % 10) < 7) spots.push({ x: x + .5, y: r + 1, z: z + .5, r: sgn > 0 ? -Math.PI / 2 : Math.PI / 2 });
        }
      }
      // corner wall
      for (let y = 0; y < 13; y++) for (let z = E - rows; z <= E; z++) vox.set(sgn > 0 ? SX + 10 : -SX - 11, y, z, 'stonebricks');
    }
    // light towers
    for (const [tx, tz] of [[-SX - 8, E - rows - 2], [SX + 7, E - rows - 2], [-SX - 12, o.farZ - 30], [SX + 11, o.farZ - 30]]) {
      for (let y = 0; y < 30; y++) vox.set(tx, y, tz, 'smooth');
      for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 3; dy++) vox.set(tx + dx, 30 + dy, tz, (dx + dy) % 2 ? 'glow' : 'lantern');
      for (let dx = -2; dx <= 2; dx++) vox.set(tx + dx, 29, tz, 'c_black');
      glowSprite(w, tx + .5, 32, tz + 1.4, 26, 0xfff0c8, .75);
    }
    // jumbotron frame
    const jw = 18, jy = rows + 4;
    for (let x = -jw / 2 - 1; x <= jw / 2; x++) for (let y = jy; y < jy + 11; y++) vox.set(x, y, E - rows, (x === -jw / 2 - 1 || x === jw / 2 || y === jy || y === jy + 10) ? 'c_black' : 'c_black');
    for (let x = -1; x <= 0; x++) for (let y = rows + 4; y < jy; y++) vox.set(x, y, E - rows, 'c_black');
    jumbotron(w, 0, jy + 5.5, E - rows + 1.02, jw - 1, 9, o.title);
    // pennants along the top of the side stands
    for (const sgn of [-1, 1]) for (let z = E + 3; z < o.farZ; z += 6) { const x = sgn > 0 ? SX + 10 : -SX - 11; for (let y = 10; y < 13; y++) vox.set(x, y, z, 'log'); vox.set(x, 13, z, (z / 6 | 0) % 2 ? 'c_gold' : 'c_slate'); }
    addVox(w, vox); crowd(w, spots);
  }
  function grassBeyond(w) {
    // a far ring of grass blocks and trees so the horizon never shows a gap
    const vox = Vox();
    let seed = 3; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const a = rr() * Math.PI * 2, d = 90 + rr() * 50, x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d) - 20, h = 5 + (rr() * 4 | 0);
      for (let y = 0; y < h; y++) vox.set(x, y, z, 'log');
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy < 3; dy++) if (Math.abs(dx) + Math.abs(dz) + dy < 5) vox.set(x + dx, h - 1 + dy, z + dz, 'leaves');
    }
    addVox(w, vox);
    const g = new T.PlaneGeometry(900, 900); g.rotateX(-Math.PI / 2); const gm = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x4f9a33 })); gm.position.y = -1.01; w.scene.add(gm);
  }

  /* ---------- worlds ---------- */
  function newWorld(id) {
    const w = { id, scene: new T.Scene(), leds: [], t: 0 };
    w.scene.fog = new T.Fog(0xf2c99a, 110, 330);
    lights(w); particles(w);
    w.trail = dots(w, 18, 0xfff1c8, .1); w.aim = dots(w, 34, 0xffffff, .12);
    w.shadow = shadowBlob(w);
    return w;
  }
  const BUILD = {
    football(w) {
      sky(w, '#3c79d8', '#8fb6ea', '#ffd7a8', [-.3, .12, -1]);
      stadium(w, { endZ: -16, sideX: 33, fieldHalf: 31, fieldZ0: -16, farZ: 96, title: 'Field Goal Frenzy' });
      grassBeyond(w);
      const tex = fieldTex(64, 112, -32, -16, 4.572, (cx, P, ppm) => {
        const Y = .9144;
        // end zone paint (goal line at z = 9.144)
        const [ex0, ez0] = P(-24.4, 0), [ex1, ez1] = P(24.4, 9.144);
        cx.fillStyle = 'rgba(36,56,63,.82)'; cx.fillRect(ex0, ez0, ex1 - ex0, ez1 - ez0);
        cx.globalAlpha = .95; cx.drawImage(logoMask('#cfac52'), (ex0 + ex1) / 2 - 72, ez0 + 2, 144, 144); cx.globalAlpha = 1;
        pixelText(cx, 'R&R', ex0 + 140, ez0 + 46, 56, 'rgba(255,255,255,.85)', 'center'); pixelText(cx, 'R&R', ex1 - 140, ez0 + 46, 56, 'rgba(255,255,255,.85)', 'center');
        cx.fillStyle = 'rgba(255,255,255,.92)';
        const line = (x0, z0, x1, z1, wd) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); cx.fillRect(Math.min(a, c), Math.min(b, d), Math.max(wd, Math.abs(c - a)), Math.max(wd, Math.abs(d - b))); };
        line(-24.4, 0, 24.4, 0, 3); line(-24.4, 9.144, 24.4, 9.144, 4); line(-24.4, 0, -24.4, 96, 3); line(24.4, 0, 24.4, 96, 3);
        for (let yd = 5; yd <= 90; yd += 5) {
          const z = 9.144 + yd * Y; line(-24.4, z, 24.4, z, 2);
          if (yd % 10 === 0) { const num = String(yd <= 50 ? yd : 100 - yd); pixelText(cx, num, P(-18, 0)[0], P(0, z - 1.4)[1], 40, 'rgba(255,255,255,.9)', 'center'); pixelText(cx, num, P(18, 0)[0], P(0, z - 1.4)[1], 40, 'rgba(255,255,255,.9)', 'center'); }
        }
        for (let yd = 1; yd < 90; yd++) { const z = 9.144 + yd * Y; for (const x of [-2.82, 2.82, -21.5, 21.5]) line(x - .3, z, x + .3, z, 2); }
        // midfield logo
        const [lx, lz] = P(0, 9.144 + 50 * Y); cx.globalAlpha = .9; cx.drawImage(logoMask('#ffffff'), lx - 160, lz - 160, 320, 320); cx.globalAlpha = 1;
      });
      plane(w, tex, -32, -16, 64, 112, 0);
      adBoard(w, -26, 26, -10, null, 0); adBoard(w, 5, 96, 26.5, 'x+', 0).position.set(-26.5, .5, 50); adBoard(w, 5, 96, 26.5, 'x-', 0).position.set(26.5, .5, 50);
      // the goalposts (gold, lit)
      const G = new T.Group(), Y = 0xf3c63c;
      const mk = (sx, sy, sz) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), new T.MeshLambertMaterial({ color: Y, emissive: 0x3a2a00 })); G.add(m); return m; };
      const base = mk(.32, 3.05, .32); base.position.set(0, 1.525, -1.6);
      const pad = new T.Mesh(new T.BoxGeometry(.6, 1.9, .6), new T.MeshLambertMaterial({ color: 0x24383f })); pad.position.set(0, .95, -1.6); G.add(pad);
      const neck = mk(.24, .24, 1.6); neck.position.set(0, 3.05, -.8);
      const bar = mk(1, .22, .22); bar.position.set(0, 3.05, 0);
      const upL = mk(.18, 6.15, .18), upR = mk(.18, 6.15, .18); upL.position.y = upR.position.y = 3.05 + 3.075;
      const flagM = new T.MeshBasicMaterial({ color: 0xb8402f, side: T.DoubleSide });
      const fL = new T.Mesh(new T.PlaneGeometry(.9, .45, 4, 1), flagM), fR = new T.Mesh(new T.PlaneGeometry(.9, .45, 4, 1), flagM);
      G.add(fL, fR); w.scene.add(G);
      w.posts = { G, bar, upL, upR, fL, fR, setW(h) { bar.scale.x = h * 2 + .18; upL.position.x = -h; upR.position.x = h; fL.position.set(-h + .45, 9.0, 0); fR.position.set(h + .45, 9.0, 0); } };
      w.posts.setW(2.82);
      w.coin = coinMesh(.85); w.scene.add(w.coin); w.coinGlow = glowSprite(w, 0, 0, 0, 3.4, 0xffe08a, .55);
    },
    soccer(w) {
      sky(w, '#3c79d8', '#8fb6ea', '#ffd7a8', [.4, .12, -1]);
      stadium(w, { endZ: -9, sideX: 33, fieldHalf: 31, fieldZ0: -9, farZ: 80, title: 'Penalty Kings' });
      grassBeyond(w);
      const tex = fieldTex(64, 96, -32, -9, 5, (cx, P) => {
        cx.fillStyle = 'rgba(255,255,255,.92)';
        const line = (x0, z0, x1, z1, wd) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); cx.fillRect(Math.min(a, c), Math.min(b, d), Math.max(wd, Math.abs(c - a)), Math.max(wd, Math.abs(d - b))); };
        line(-30, 0, 30, 0, 3); line(-30, 0, -30, 80, 3); line(30, 0, 30, 80, 3);
        line(-20.16, 0, -20.16, 16.5, 3); line(20.16, 0, 20.16, 16.5, 3); line(-20.16, 16.5, 20.16, 16.5, 3);
        line(-9.16, 0, -9.16, 5.5, 3); line(9.16, 0, 9.16, 5.5, 3); line(-9.16, 5.5, 9.16, 5.5, 3);
        const [sx, sz] = P(0, 11); cx.fillRect(sx - 3, sz - 3, 6, 6);
        cx.strokeStyle = 'rgba(255,255,255,.92)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(sx, sz, 9.15 * 16, Math.asin(5.5 / 9.15) + .02, Math.PI - Math.asin(5.5 / 9.15) - .02); cx.stroke();
        line(-30, 52.5, 30, 52.5, 3); const [cxp, czp] = P(0, 52.5); cx.beginPath(); cx.arc(cxp, czp, 9.15 * 16, 0, 7); cx.stroke();
        cx.globalAlpha = .85; cx.drawImage(logoMask('#ffffff'), cxp - 120, czp - 120, 240, 240); cx.globalAlpha = 1;
        pixelText(cx, 'R&R CRAFTHOUSE', P(0, 0)[0], P(0, 23)[1], 64, 'rgba(255,255,255,.55)', 'center');
      });
      plane(w, tex, -32, -9, 64, 96, 0);
      adBoard(w, -22, 22, -5.5, null, 0);
      // goal: posts, bar, net
      const hw = 3.66, gh = 2.44, white = new T.MeshLambertMaterial({ color: 0xf6f6f2, emissive: 0x202020 });
      const G = new T.Group(); const bx = (sx, sy, sz, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), white); m.position.set(x, y, z); G.add(m); return m; };
      const pL = bx(.12, gh + .06, .12, -hw, gh / 2, 0), pR = bx(.12, gh + .06, .12, hw, gh / 2, 0), bar = bx(1, .12, .12, 0, gh, 0);
      const net = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })); G.add(net); w.scene.add(G);
      w.goal = { G, pL, pR, bar, net, hw, gh, bulge: null, setW(h) { this.hw = h; pL.position.x = -h; pR.position.x = h; bar.scale.x = 2 * h + .12; this.buildNet(); },
        buildNet() {
          const P = [], h = this.hw, D = 2, b = this.bulge; const at = (x, y, z) => { if (b && b.a > 0) { const d = Math.hypot(x - b.x, y - b.y); const k = Math.exp(-d * d / 1.4) * b.a; z -= k * .9; } return [x, y, z]; };
          const seg = (a, c) => P.push(...a, ...c); const s = .35;
          for (let x = -h; x <= h + .01; x += s) { for (let y = 0; y < gh; y += s) seg(at(x, y, -D + .4 * (y / gh)), at(x, Math.min(gh, y + s), -D + .4 * (Math.min(gh, y + s) / gh))); seg(at(x, gh, -D + .4), at(x, gh, 0)); }
          for (let y = 0; y <= gh + .01; y += s) { for (let x = -h; x < h; x += s) seg(at(x, y, -D + .4 * (y / gh)), at(Math.min(h, x + s), y, -D + .4 * (y / gh))); for (const sx of [-h, h]) seg(at(sx, y, -D + .4 * (y / gh)), at(sx, y, 0)); }
          for (let z = -D + .4; z <= 0.01; z += s) seg(at(-h, gh, z), at(h, gh, z));
          this.net.geometry.dispose(); this.net.geometry = new T.BufferGeometry(); this.net.geometry.setAttribute('position', new T.Float32BufferAttribute(P, 3));
        } };
      w.goal.buildNet();
      // the sliding training wall (padded board)
      const c = document.createElement('canvas'); c.width = 256; c.height = 220; const x = c.getContext('2d'); x.fillStyle = '#24383f'; x.fillRect(0, 0, 256, 220); x.fillStyle = '#2f4a52'; for (let i = 0; i < 4; i++) x.fillRect(8, 8 + i * 52, 240, 44); x.globalAlpha = .9; x.drawImage(logoMask('#cfac52'), 48, 30, 160, 160);
      const wallT = canvasTex(c); const wm = new T.MeshLambertMaterial({ map: wallT }), wdark = new T.MeshLambertMaterial({ color: 0x1b2a2f });
      w.blocker = new T.Mesh(new T.BoxGeometry(1.7, 1.9, .3), [wdark, wdark, wdark, wdark, wm, wdark]); w.scene.add(w.blocker);
      w.coin = coinMesh(.5); w.scene.add(w.coin); w.coinGlow = glowSprite(w, 0, 0, 0, 2, 0xffe08a, .5);
    },
    basketball(w) {
      sky(w, '#3c79d8', '#94bdf0', '#ffd2a0', [-.6, .15, -1]);
      w.scene.fog = new T.Fog(0xf2c99a, 70, 260);
      const vox = Vox(), spots = [];
      // ground: grass around the court
      vox.box(-30, -1, -14, 30, 0, 40, (x, y, z) => (Math.abs(x) < 9 && z > -4 && z < 16) ? null : 'grass');
      // back wall (brick) with a gold cap and string lights
      for (let x = -18; x < 18; x++) for (let y = 0; y < 10; y++) vox.set(x, y, -6, y === 9 ? 'gold' : (y === 0 ? 'stonebricks' : 'bricks'));
      for (let x = -18; x < 18; x++) for (let y = 0; y < 10; y++) vox.set(x, y, -7, 'bricks');
      // side bleachers
      for (const sgn of [-1, 1]) for (let r = 0; r < 6; r++) {
        const x = sgn > 0 ? 10 + r : -11 - r;
        for (let z = -4; z < 18; z++) { for (let y = 0; y <= r; y++) vox.set(x, y, z, y === r ? (r % 2 ? 'spruce' : 'planks') : 'stonebricks'); if (((z * 7 + r * 11 + (sgn > 0 ? 1 : 0)) % 10) < 7) spots.push({ x: x + .5, y: r + 1, z: z + .5, r: sgn > 0 ? -Math.PI / 2 : Math.PI / 2 }); }
      }
      // trees behind the wall
      let seed = 5; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 9; i++) { const x = -26 + i * 6 + (rr() * 3 | 0), z = -10 - (rr() * 4 | 0), h = 8 + (rr() * 4 | 0); for (let y = 0; y < h; y++) vox.set(x, y, z, 'log'); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy < 4; dy++) if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 1) < 5) vox.set(x + dx, h - 1 + dy, z + dz, 'leaves'); }
      // lamp posts
      for (const [lx, lz] of [[-9, -3], [9, -3], [-9, 15], [9, 15]]) { for (let y = 0; y < 9; y++) vox.set(lx, y, lz, 'c_black'); vox.set(lx, 9, lz, 'glow'); glowSprite(w, lx + .5, 9.5, lz + .5, 7, 0xffe7b0, .7); }
      addVox(w, vox); crowd(w, spots); grassBeyond(w);
      // court floor (planks, painted)
      const ppm = 16, c = document.createElement('canvas'); c.width = 18 * ppm; c.height = 20 * ppm; const cx = c.getContext('2d');
      for (let i = 0; i < 18; i++) for (let j = 0; j < 20; j++) tileDraw(cx, 'planks', i * ppm, j * ppm, ppm);
      const P = (x, z) => [(x + 9) * ppm, (z + 4) * ppm];
      cx.fillStyle = 'rgba(184,64,47,.62)'; { const [a, b] = P(-2.45, -1.575), [d, e] = P(2.45, 4.225); cx.fillRect(a, b, d - a, e - b); }
      cx.strokeStyle = 'rgba(255,255,255,.92)'; cx.lineWidth = 3;
      { const [a, b] = P(-2.45, -1.575), [d, e] = P(2.45, 4.225); cx.strokeRect(a, b, d - a, e - b); }
      { const [a, b] = P(0, 4.225); cx.beginPath(); cx.arc(a, b, 1.8 * ppm, 0, Math.PI); cx.stroke(); }
      { const [a, b] = P(0, 0), r = 6.75 * ppm, ang = Math.asin(6.6 / 6.75); cx.beginPath(); cx.arc(a, b, r, Math.PI / 2 - ang, Math.PI / 2 + ang); cx.stroke(); const z1 = 6.75 * Math.cos(ang); for (const s of [-1, 1]) { const [p, q] = P(s * 6.6, -1.575), [p2, q2] = P(s * 6.6, z1); cx.beginPath(); cx.moveTo(p, q); cx.lineTo(p2, q2); cx.stroke(); } }
      { const [a, b] = P(-8.5, -1.575), [d] = P(8.5, 0); cx.beginPath(); cx.moveTo(a, b); cx.lineTo(d, b); cx.stroke(); }
      for (const s of [-1, 1]) { const [a, b] = P(s * 8.5, -1.575), [, e] = P(0, 16); cx.beginPath(); cx.moveTo(a, b); cx.lineTo(a, e); cx.stroke(); }
      { const [a, b] = P(0, 10); cx.globalAlpha = .85; cx.drawImage(logoMask('#cfac52'), a - 64, b - 64, 128, 128); cx.globalAlpha = 1; }
      plane(w, c, -9, -4, 18, 20, 0);
      jumbotron(w, 0, 7.15, -4.97, 6, 3, 'Buzzer Beater');
      for (let i = 0; i <= 34; i++) { const x = -17 + i, y = 9.6 - Math.sin((i % 6) / 6 * Math.PI) * .45; glowSprite(w, x, y, -4.7, .55, i % 3 ? 0xffe2a0 : 0xffffff, .95); }
      { const P = []; for (let i = 0; i < 34 * 6; i++) { const f = i / 6, f2 = (i + 1) / 6; P.push(-17 + f, 9.6 - Math.sin((f % 6) / 6 * Math.PI) * .45, -4.72, -17 + f2, 9.6 - Math.sin((f2 % 6) / 6 * Math.PI) * .45, -4.72); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); w.scene.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x222222 }))); }
      // hoop
      const gray = 0x3b4448;
      litBox(w, .28, 3.4, .28, 0, 1.7, -2.2, gray); litBox(w, .5, 1.6, .5, 0, .8, -2.2, 0xcfac52);
      litBox(w, .18, .18, 1.75, 0, 3.32, -1.35, gray);
      const bc = document.createElement('canvas'); bc.width = 366; bc.height = 214; const bxc = bc.getContext('2d'); bxc.fillStyle = '#f4f4f0'; bxc.fillRect(0, 0, 366, 214); bxc.strokeStyle = '#b8402f'; bxc.lineWidth = 8; bxc.strokeRect(4, 4, 358, 206); bxc.strokeRect(124, 108, 118, 90); bxc.globalAlpha = .9; bxc.drawImage(logoMask('#24383f'), 138, 6, 90, 90);
      const bt = canvasTex(bc), bm = new T.MeshLambertMaterial({ map: bt, emissive: 0x222222 }), bs = new T.MeshLambertMaterial({ color: 0xdedede });
      const board = new T.Mesh(new T.BoxGeometry(1.83, 1.07, .05), [bs, bs, bs, bs, bm, bs]); board.position.set(0, 2.9 + .535, -.40); w.scene.add(board);
      const rim = new T.Mesh(new T.TorusGeometry(.2286, .018, 8, 32), new T.MeshLambertMaterial({ color: 0xf06a1a, emissive: 0x401400 })); rim.rotation.x = Math.PI / 2; rim.position.set(0, 3.05, 0); w.scene.add(rim);
      litBox(w, .12, .05, .16, 0, 3.05, -.3, 0xf06a1a);
      const net = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 })); w.scene.add(net);
      w.hoop = { rim, net, R: .2286, kick: 0, sway: 0, build(dt) {
        const R = this.R, P = [], n = 12, rings = [[0, R], [-.17, R * .86], [-.34, R * .74], [-.46, R * .66]];
        this.kick = Math.max(0, this.kick - dt * 2.2); const k = this.kick;
        const pt = (i, j) => { const a = (i + (j % 2) * .5) / n * Math.PI * 2, [dy, r] = rings[j]; const rr = r * (1 - k * .25 * (j / 3)); return [Math.cos(a) * rr, 3.05 + dy * (1 + k * .55) + Math.sin(a * 2 + k * 8) * .01 * k, Math.sin(a) * rr]; };
        for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) { P.push(...pt(i, j), ...pt(i, j + 1)); P.push(...pt(i + 1, j), ...pt(i, j + 1)); }
        net.geometry.dispose(); net.geometry = new T.BufferGeometry(); net.geometry.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      }, setR(r) { this.R = r; rim.scale.set(r / .2286, r / .2286, 1); this.build(0); } };
      w.hoop.build(0);
    }
  };

  function world(id) {
    if (worlds[id]) return worlds[id];
    const w = newWorld(id); BUILD[id](w);
    w.balls = { n: ballMesh(id, false), g: ballMesh(id, true) }; w.ball = new T.Group(); w.ball.add(w.balls.n, w.balls.g); w.balls.g.visible = false; w.scene.add(w.ball);
    w.scene.matrixAutoUpdate = true;
    return (worlds[id] = w);
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      initBlocks();
      atlasImg = new Image(); atlasImg.src = ATLAS_URL; await atlasImg.decode();
      ATL = new T.Texture(atlasImg); ATL.magFilter = T.NearestFilter; ATL.minFilter = T.NearestMipmapLinearFilter; ATL.encoding = T.sRGBEncoding; ATL.anisotropy = 4; ATL.needsUpdate = true;
      try { await document.fonts.load('800 20px Bricolage'); } catch (e) { }
      const cv = $('#gcv');
      R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.setClearColor(0x87b4ea);
      cam = new T.PerspectiveCamera(60, 1, .1, 1200);
      return true;
    })();
    return ready;
  }
  const PR = { low: 1, medium: 1.5, high: 2 };
  function size(wd, ht) {
    R.setPixelRatio(Math.min(devicePixelRatio || 1, PR[S.gfx || 'medium'] || 1.5)); R.setSize(wd, ht, false);
    const asp = wd / ht; cam.aspect = asp;
    const vf = 2 * Math.atan(Math.tan((36 / 2) * Math.PI / 180) / asp) * 180 / Math.PI; cam.fov = Math.max(46, Math.min(72, vf)); cam.updateProjectionMatrix();
  }
  function render(w) { R.render(w.scene, cam); }
  function snapshot(id, setup, wd, ht) {
    const w = world(id); size(wd, ht); setup(w, cam); R.render(w.scene, cam); return R.domElement.toDataURL('image/jpeg', .82);
  }
  return { init, world, size, render, snapshot, get cam() { return cam; }, get R() { return R; }, T };
})();
