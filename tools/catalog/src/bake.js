  /* ---------------------------------------------------------------- one texture
     Roblox takes one mesh with one texture. Whatever a piece is made of (flat colours, charm pictures, a bag's pattern,
     hair's vertex colours and fades, a lens' tint) is merged into ONE mesh and painted into ONE atlas picture (at most
     1024 x 1024), with every part's texture coordinates moved to match. Every export format goes through this. */
  function bakeSingle(root, maxSize) {
    maxSize = maxSize || 1024; root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = [];
    root.traverse(o => {
      if (!o.isMesh || !o.visible || !o.geometry.attributes.position) return;
      const g = o.geometry, Mx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), Nx = new THREE.Matrix3().getNormalMatrix(Mx), P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, n = P.count, v = new THREE.Vector3();
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i).applyMatrix4(Mx); pos.set([v.x, v.y, v.z], i * 3); if (N) { v.fromBufferAttribute(N, i).applyMatrix3(Nx).normalize(); nor.set([v.x, v.y, v.z], i * 3); } else nor.set([0, 1, 0], i * 3); if (UV) { uv[i * 2] = UV.getX(i); uv[i * 2 + 1] = UV.getY(i); } }
      const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i), m = Array.isArray(o.material) ? o.material[0] : o.material;
      parts.push({ n, pos, nor, uv, idx, m, hasUV: !!UV, vc: m.vertexColors && g.attributes.color ? g.attributes.color : null });
    });
    if (!parts.length) return root;
    // what each part needs in the atlas
    const cells = [], swatch = new Map(), srgb = c => { const k = c.clone().convertLinearToSRGB(); return [Math.round(k.r * 255), Math.round(k.g * 255), Math.round(k.b * 255)]; };
    let needMask = false, needBlend = false, metal = 0, rough = 0, wsum = 0;
    const cellFor = (w, h, draw) => { const c = { w, h, draw, x: 0, y: 0 }; cells.push(c); return c; };
    const solid = (rgb, a) => { const key = rgb.join(',') + ',' + a.toFixed(2); if (swatch.has(key)) return swatch.get(key); const c = cellFor(4, 4, (x, cv) => { x.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; x.clearRect(0, 0, 4, 4); x.fillRect(0, 0, 4, 4); }); c.solid = true; swatch.set(key, c); return c; };
    const canvasCells = new Map(), texSet = new Set(); for (const p of parts) { const cv0 = p.m.map && p.m.map.userData && p.m.map.userData.canvas; if (cv0 && p.hasUV) texSet.add(cv0); } const capTex = texSet.size > 1 ? 128 : 512;
    for (const p of parts) {
      const m = p.m, a = m.transparent ? (m.opacity == null ? 1 : m.opacity) : 1, cv = m.map && m.map.userData && m.map.userData.canvas;
      p.alpha = a; if (m.transparent && a < 0.99) needBlend = true; if (m.alphaTest > 0) needMask = true;
      metal += (m.metalness || 0) * p.n; rough += (m.roughness == null ? 1 : m.roughness) * p.n; wsum += p.n;
      let tiled = false; if (cv && p.hasUV) { let mx = 0, mn = 0; for (let i = 0; i < p.n * 2; i++) { mx = Math.max(mx, p.uv[i]); mn = Math.min(mn, p.uv[i]); } tiled = mx > 1.02 || mn < -0.02; }
      if (cv && p.hasUV && !tiled) {
        let c = canvasCells.get(cv); if (!c) { const s = Math.min(cv.width, cv.__big ? 512 : capTex); let c0 = null; c = c0 = cellFor(s, Math.max(1, Math.round(s * cv.height / cv.width)), (x, tcv, W, H) => { x.clearRect(0, 0, W, H); x.drawImage(cv, 0, 0, W, H); if (c.tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${c.tint.join(',')})`; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'destination-in'; x.drawImage(cv, 0, 0, W, H); x.globalCompositeOperation = 'source-over'; } }); c.cv = cv; canvasCells.set(cv, c); }
        p.kind = 'tex'; p.cell = c; if (!c.tint && m.color && !(m.color.r > 0.995 && m.color.g > 0.995 && m.color.b > 0.995)) c.tint = srgb(m.color);
      } else if (cv && tiled) {
        // a repeating texture (a chain's links) can't share an atlas: use its average colour
        let k = cv.__avg; if (!k) { const t = document.createElement('canvas'); t.width = t.height = 1; const x = t.getContext('2d'); x.drawImage(cv, 0, 0, 1, 1); k = x.getImageData(0, 0, 1, 1).data; cv.__avg = k; }
        const mc = m.color ? srgb(m.color) : [255, 255, 255]; p.kind = 'solid'; p.cell = solid([Math.round(k[0] * mc[0] / 255), Math.round(k[1] * mc[1] / 255), Math.round(k[2] * mc[2] / 255)], a);
      } else if (p.vc) {
        // vertex colours (hair): colours along a gradient go in a row sorted so neighbours are alike, and each vertex points at its own cell
        const bits = 5, q = new Map(), mc = m.color || new THREE.Color(1, 1, 1), tmp = new THREE.Color(); p.vcol = new Array(p.n);
        for (let i = 0; i < p.n; i++) { tmp.setRGB(p.vc.getX(i) * mc.r, p.vc.getY(i) * mc.g, p.vc.getZ(i) * mc.b); const s = srgb(tmp), k = s.map(x => Math.min(255, (x >> (8 - bits)) << (8 - bits) | (1 << (7 - bits)))), key = k.join(','); if (!q.has(key)) q.set(key, k); p.vcol[i] = key; }
        let list = Array.from(q.entries()); if (list.length > 96) { // too many: coarser
          const q2 = new Map(); for (const [key, k] of list) { const k2 = k.map(x => (x >> 6) << 6 | 32); q2.set(k2.join(','), k2); } const remap = new Map(); for (const [key, k] of list) remap.set(key, k.map(x => (x >> 6) << 6 | 32).join(',')); p.vcol = p.vcol.map(k => remap.get(k)); list = Array.from(q2.entries()); }
        // order along the main direction of the colours
        const mean = [0, 0, 0]; list.forEach(([, k]) => k.forEach((x, j) => mean[j] += x / list.length));
        let dir = [1, 1, 1]; for (let it = 0; it < 6; it++) { const nd = [0, 0, 0]; for (const [, k] of list) { const d = k.reduce((s, x, j) => s + (x - mean[j]) * dir[j], 0); k.forEach((x, j) => nd[j] += (x - mean[j]) * d); } const l = Math.hypot(...nd) || 1; dir = nd.map(x => x / l); }
        list.sort((A, B) => A[1].reduce((s, x, j) => s + (x - mean[j]) * dir[j], 0) - B[1].reduce((s, x, j) => s + (x - mean[j]) * dir[j], 0));
        const row = cellFor(list.length * 4, 4, (x) => { list.forEach(([, k], i) => { x.fillStyle = `rgb(${k[0]},${k[1]},${k[2]})`; x.fillRect(i * 4, 0, 4, 4); }); }); row.order = new Map(list.map(([key], i) => [key, i])); p.kind = 'row'; p.cell = row;
      } else { const c = m.color ? srgb(m.color) : [255, 255, 255]; p.kind = 'solid'; p.cell = solid(c, a); }
    }
    // pack the cells into a power-of-two square, shrinking pictures if it won't fit
    const PAD = 2; let scale = 1, W = 64, H = 64, placed = false;
    for (let attempt = 0; attempt < 6 && !placed; attempt++) {
      const items = cells.map(c => ({ c, w: c.solid ? 4 + 2 : (c.cv ? Math.max(4, Math.round(c.w * scale)) : c.w) + PAD * 2 + (c.cv ? 0 : 0), h: c.solid ? 4 + 2 : (c.cv ? Math.max(4, Math.round(c.h * scale)) : c.h) + PAD * 2 })).sort((a, b) => b.h - a.h || b.w - a.w);
      for (let size = 64; size <= maxSize && !placed; size *= 2) {
        let x = 0, y = 0, rowH = 0, ok = true; for (const it of items) { if (x + it.w > size) { x = 0; y += rowH; rowH = 0; } if (y + it.h > size || it.w > size) { ok = false; break; } it.x = x; it.y = y; x += it.w; rowH = Math.max(rowH, it.h); }
        if (ok) { placed = true; W = H = size; for (const it of items) { it.c.x = it.x + (it.c.solid ? 1 : PAD); it.c.y = it.y + (it.c.solid ? 1 : PAD); it.c.dw = it.w - (it.c.solid ? 2 : PAD * 2); it.c.dh = it.h - (it.c.solid ? 2 : PAD * 2); it.c.box = { x: it.x, y: it.y, w: it.w, h: it.h }; } }
      }
      if (!placed) scale *= 0.5;
    }
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; const X = cvs.getContext('2d');
    for (const c of cells) {
      if (c.solid) { const b = c.box; X.save(); X.beginPath(); X.rect(b.x, b.y, b.w, b.h); X.clip(); X.translate(b.x, b.y); X.scale(b.w / 4, b.h / 4); c.draw(X); X.restore(); continue; }
      const tmp = document.createElement('canvas'); tmp.width = c.dw; tmp.height = c.dh; const T = tmp.getContext('2d'); c.draw(T, tmp, c.dw, c.dh);
      // a little edge bleed so filtering never pulls in a neighbour's colour
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) X.drawImage(tmp, c.x + dx, c.y + dy);
      X.drawImage(tmp, c.x, c.y);
    }
    // a tinted picture (colour times its texture) is painted over after the fact
    const out = { pos: [], nor: [], uv: [], idx: [], col: [] }, anyVC = parts.some(p => p.kind === 'tex' && p.vc); let vo = 0;
    for (const p of parts) {
      const c = p.cell; let u, v;
      for (let i = 0; i < p.n; i++) {
        if (p.kind === 'tex') { const uu = Math.min(1, Math.max(0, p.uv[i * 2])), vv = Math.min(1, Math.max(0, p.uv[i * 2 + 1])); u = (c.x + uu * c.dw) / W; v = 1 - (c.y + (1 - vv) * c.dh) / H; }
        else if (p.kind === 'row') { const k = c.order.get(p.vcol[i]); u = (c.x + k * 4 + 2) / W; v = 1 - (c.y + 2) / H; }
        else { u = (c.x + 2) / W; v = 1 - (c.y + 2) / H; }
        out.uv.push(u, v); if (anyVC) { if (p.kind === 'tex' && p.vc) out.col.push(p.vc.getX(i), p.vc.getY(i), p.vc.getZ(i)); else out.col.push(1, 1, 1); }
      }
      for (let i = 0; i < p.pos.length; i++) { out.pos.push(p.pos[i]); out.nor.push(p.nor[i]); }
      for (let i = 0; i < p.idx.length; i++) out.idx.push(p.idx[i] + vo); vo += p.n;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2)); if (anyVC) geo.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3)); geo.setIndex(out.idx.length > 65535 ? new THREE.Uint32BufferAttribute(out.idx, 1) : new THREE.Uint32BufferAttribute(out.idx, 1));
    const tex = new THREE.CanvasTexture(cvs); tex.encoding = THREE.sRGBEncoding; tex.userData.canvas = cvs;
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: wsum ? Math.min(1, rough / wsum) : 0.5, metalness: wsum ? Math.min(1, metal / wsum) * 0.5 : 0, side: THREE.DoubleSide, vertexColors: anyVC });
    if (needMask) mat.alphaTest = 0.4; else if (needBlend) mat.transparent = true;
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'model'; const grp = new THREE.Group(); grp.name = 'model'; grp.add(mesh); grp.userData.baked = { w: W, h: H, cells: cells.length }; return grp;
  }
