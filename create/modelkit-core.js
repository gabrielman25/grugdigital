/*!
 * ShapeForge core — shapes, model format, z-fight-free mesher and exporters.
 * Shared verbatim by ShapeForge.html (browser) and claude-kit/shapeforge.js (Node).
 * No dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const LIMITS = { maxSize: 64, maxColors: 32, minDepth: 1, maxDepth: 8 };
  // Default: UFO 50 (32 colours, lospec.com/palette-list/ufo-50)
  const DEFAULT_PALETTE = ["#FFFFFF", "#A48080", "#FEB854", "#E8EA4A", "#58F5B1", "#64A4A4", "#CC68E4", "#FE626E", "#C8C8C8", "#E03C32", "#FE7000", "#63B31D", "#A4F022", "#27BADB", "#FE48DE", "#D10F4C", "#707070", "#991515", "#CA4A00", "#A3A324", "#008456", "#006AB4", "#9600DC", "#861650", "#000000", "#4C0000", "#783450", "#8A6042", "#003D10", "#202040", "#340058", "#4430BA"];
  // Classic 16-colour palette (CC0)
  const KENNEY_PALETTE = [
    '#D47D53', '#F7BB8D', '#914D35', '#3A232F', '#DD871E', '#FFE051', '#04746B', '#27C67B',
    '#920C38', '#E92A55', '#173D8C', '#2C6DC1', '#475C72', '#A1B8D1', '#292D31', '#DDE5EE'
  ];
  const ALIGNMENTS = ['center', 'back', 'front'];

  // ---------------------------------------------------------------------------
  // Shapes. Unit cell, y pointing DOWN (row direction), rotation 0.
  // Rotation k = k * 90deg clockwise as seen from the front.
  // 'A' = circular arc to (x,y) around centre (cx,cy), shortest way: ['A', cx, cy, x, y]
  // 22 tile shapes (ids 0..21) with exact arcs.
  // ---------------------------------------------------------------------------
  const S3 = Math.sqrt(3);
  const SHAPES = [
    { name: 'square', code: '#', label: 'Square', c: [['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['L', 0, 1]] },
    { name: 'corner', code: 'C', label: 'Corner (diagonal half)', c: [['M', 0, 0], ['L', 1, 1], ['L', 0, 1]] },
    { name: 'cornerRounded', code: 'R', label: 'Rounded corner (quarter disc)', c: [['M', 0, 0], ['A', 0, 1, 1, 1], ['L', 0, 1]] },
    { name: 'cornerRoundedInner', code: 'U', label: 'Cove (concave quarter)', c: [['M', 0, 0], ['L', 0, 1], ['L', 1, 1], ['A', 1, 0, 0, 0]] },
    { name: 'cornerRoundedInnerSmall', code: 'u', label: 'Small cove (square with round bite)', c: [['M', 0, 0], ['L', 0.5, 0], ['A', 1, 0, 1, 0.5], ['L', 1, 1], ['L', 0, 1]] },
    { name: 'cornerSmall', code: 'B', label: 'Bevel (chamfered square)', c: [['M', 0, 0], ['L', 0.5, 0], ['L', 1, 0.5], ['L', 1, 1], ['L', 0, 1]] },
    { name: 'endEdge', code: 'E', label: 'Pointed end', c: [['M', 0, 0], ['L', 0.5, 0], ['L', 1, 0.5], ['L', 0.5, 1], ['L', 0, 1]] },
    { name: 'endRounded', code: 'D', label: 'Rounded end', c: [['M', 0, 0], ['L', 0.5, 0], ['A', 0.5, 0.5, 1, 0.5], ['A', 0.5, 0.5, 0.5, 1], ['L', 0, 1]] },
    { name: 'half', code: 'H', label: 'Half', c: [['M', 0, 0], ['L', 0.5, 0], ['L', 0.5, 1], ['L', 0, 1]] },
    { name: 'halfCornerInner', code: 'L', label: 'L (three quarters)', c: [['M', 0, 0], ['L', 0.5, 0], ['L', 0.5, 0.5], ['L', 1, 0.5], ['L', 1, 1], ['L', 0, 1]] },
    { name: 'spike', code: 'S', label: 'Spike', c: [['M', 0, 0.5], ['L', 1, 0], ['L', 0.5, 1], ['L', 0, 1]] },
    { name: 'triangle', code: 'T', label: 'Triangle (pointing)', c: [['M', 0, 0], ['L', 1, 0.5], ['L', 0, 1]] },
    { name: 'slantLeftTop', code: 'N', label: 'Slant trapezoid A', c: [['M', 1, 0], ['L', 0, 0], ['L', 0.5, 1], ['L', 1, 1]] },
    { name: 'slantRightTop', code: 'n', label: 'Slant trapezoid B', c: [['M', 1, 0], ['L', 0, 0], ['L', 0, 1], ['L', 0.5, 1]] },
    { name: 'slantLeftBottom', code: 'V', label: 'Slant tip A', c: [['M', 1, 1], ['L', 1, 0], ['L', 0.5, 0]] },
    { name: 'slantRightBottom', code: 'v', label: 'Slant tip B', c: [['M', 0, 0], ['L', 0, 1], ['L', 0.5, 0]] },
    { name: 'circleLeftBottom', code: '(', label: 'Arch side A (radius 2)', c: [['M', 0, 1], ['L', 1, 1], ['L', 1, 0], ['L', 2 - S3, 0], ['A', 2, 1, 0, 1]] },
    { name: 'circleRightBottom', code: ')', label: 'Arch side B (radius 2)', c: [['M', 0, 0], ['L', 0, 1], ['L', 1, 1], ['A', -1, 1, S3 - 1, 0]] },
    { name: 'circleTop', code: '*', label: 'Arch tip (radius 2)', c: [['M', 0, 1], ['L', S3 - 1, 1], ['A', -1, 2, 0, 2 - S3]] },
    { name: 'quarter', code: 'Q', label: 'Quarter square', c: [['M', 0, 0.5], ['L', 0.5, 0.5], ['L', 0.5, 1], ['L', 0, 1]] },
    { name: 'edgeOuter', code: '>', label: 'Notch wedge', c: [['M', 0, 0], ['L', 0.5, 0.5], ['L', 0, 1]] },
    { name: 'edgeInner', code: 'K', label: 'Notched square', c: [['M', 0.5, 0.5], ['L', 1, 0], ['L', 0, 0], ['L', 0, 1], ['L', 1, 1]] }
  ];
  const CODE_TO_SHAPE = {};
  SHAPES.forEach((s, i) => { s.id = i; CODE_TO_SHAPE[s.code] = i; });

  const EPS = 1e-7;
  const SIDES = ['left', 'right', 'bottom', 'top']; // y-up local frame
  const OPP = { left: 'right', right: 'left', bottom: 'top', top: 'bottom' };

  function rotDown(x, y, k) { for (let i = 0; i < k; i++) { const nx = 1 - y; y = x; x = nx; } return [x, y]; }

  // Tessellate a shape at rotation `angle` into a CCW polygon in a y-UP unit cell.
  // Returns { pts:[[x,y]..], arc:[center|null per edge i (pts[i]->pts[i+1])] }
  function tessellate(shapeId, angle, segPer90) {
    const def = SHAPES[shapeId].c;
    const seg = segPer90 || 8;
    const pts = [], arc = [];
    let cur = null;
    for (const cmd of def) {
      if (cmd[0] === 'M' || cmd[0] === 'L') {
        const p = [cmd[1], cmd[2]];
        if (cmd[0] === 'L') arc.push(null);
        pts.push(p); cur = p;
      } else if (cmd[0] === 'A') {
        const cx = cmd[1], cy = cmd[2], tx = cmd[3], ty = cmd[4];
        const r = Math.hypot(cur[0] - cx, cur[1] - cy);
        const a0 = Math.atan2(cur[1] - cy, cur[0] - cx), a1 = Math.atan2(ty - cy, tx - cx);
        let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
        const n = Math.max(2, Math.ceil(Math.abs(d) / (Math.PI / 2) * seg));
        for (let i = 1; i <= n; i++) {
          const a = a0 + d * i / n;
          const p = i === n ? [tx, ty] : [cx + r * Math.cos(a), cy + r * Math.sin(a)];
          arc.push([cx, cy]); pts.push(p);
        }
        cur = [tx, ty];
      }
    }
    arc.push(null); // closing edge
    // drop duplicate closing point
    const f = pts[0], l = pts[pts.length - 1];
    if (pts.length > 1 && Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) {
      pts.pop(); arc.splice(arc.length - 1, 1); // edge from l->f (zero length) removed; arc of edge before stays
    }
    // rotate (y-down) and convert to y-up; rotate arc centres too
    let P = pts.map(p => { const r = rotDown(p[0], p[1], angle & 3); return [r[0], 1 - r[1]]; });
    let A = arc.map(c => { if (!c) return null; const r = rotDown(c[0], c[1], angle & 3); return [r[0], 1 - r[1]]; });
    // orientation -> CCW (y-up)
    let area = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) {
      const n = P.length, RP = [], RA = [];
      for (let j = 0; j < n; j++) RP.push(P[n - 1 - j]);
      for (let j = 0; j < n; j++) RA.push(A[((n - 2 - j) % n + n) % n]);
      P = RP; A = RA;
    }
    // snap tiny float noise to grid values
    P = P.map(p => p.map(v => { const r = Math.round(v * 1e6) / 1e6; return Math.abs(r - Math.round(r * 2) / 2) < 1e-9 ? Math.round(r * 2) / 2 : r; }));
    return { pts: P, arc: A, area: Math.abs(area) / 2 };
  }

  function edgeSide(a, b) {
    if (Math.abs(a[0]) < EPS && Math.abs(b[0]) < EPS) return 'left';
    if (Math.abs(a[0] - 1) < EPS && Math.abs(b[0] - 1) < EPS) return 'right';
    if (Math.abs(a[1]) < EPS && Math.abs(b[1]) < EPS) return 'bottom';
    if (Math.abs(a[1] - 1) < EPS && Math.abs(b[1] - 1) < EPS) return 'top';
    return null;
  }
  function mergeIntervals(list) {
    list.sort((p, q) => p[0] - q[0]);
    const out = [];
    for (const iv of list) {
      if (out.length && iv[0] <= out[out.length - 1][1] + EPS) out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]);
      else out.push([iv[0], iv[1]]);
    }
    return out;
  }

  // Cache of tessellations + border coverage + triangulation per (shape, angle, quality)
  const _geoCache = new Map();
  function shapeGeo(shapeId, angle, segPer90) {
    const key = shapeId * 4 + (angle & 3) + ':' + (segPer90 || 8);
    let g = _geoCache.get(key);
    if (g) return g;
    const t = tessellate(shapeId, angle, segPer90);
    const cov = { left: [], right: [], bottom: [], top: [] };
    const edges = [];
    for (let i = 0; i < t.pts.length; i++) {
      const a = t.pts[i], b = t.pts[(i + 1) % t.pts.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) continue;
      const side = edgeSide(a, b);
      edges.push({ a, b, side, arc: t.arc[i] });
      if (side) {
        const k = (side === 'left' || side === 'right') ? 1 : 0;
        cov[side].push([Math.min(a[k], b[k]), Math.max(a[k], b[k])]);
      }
    }
    for (const s of SIDES) cov[s] = mergeIntervals(cov[s]);
    g = { pts: t.pts, edges, cov, tris: earClip(t.pts), area: t.area };
    _geoCache.set(key, g);
    return g;
  }

  // Ear clipping for a simple CCW polygon. Returns index triples into pts.
  function earClip(pts) {
    let idx = [];
    for (let i = 0; i < pts.length; i++) idx.push(i);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    // remove collinear vertices
    let changed = true;
    while (changed && idx.length > 3) {
      changed = false;
      for (let i = 0; i < idx.length; i++) {
        const p = pts[idx[(i + idx.length - 1) % idx.length]], c = pts[idx[i]], n = pts[idx[(i + 1) % idx.length]];
        if (Math.abs(cross(p, c, n)) < 1e-10) { idx.splice(i, 1); changed = true; break; }
      }
    }
    const tris = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 1000) {
      let found = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if (cross(a, b, c) <= 1e-12) continue; // reflex
        let inside = false;
        for (const j of idx) {
          if (j === ia || j === ib || j === ic) continue;
          const p = pts[j];
          if (cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12) { inside = true; break; }
        }
        if (inside) continue;
        tris.push([ia, ib, ic]); idx.splice(i, 1); found = true; break;
      }
      if (!found) break;
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }

  function pointInPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // Raster masks (y-down) used for mirror lookup tables
  function shapeMask(shapeId, angle, N) {
    const g = shapeGeo(shapeId, angle, 16), m = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m[y * N + x] = pointInPoly(g.pts, (x + 0.5) / N, 1 - (y + 0.5) / N) ? 1 : 0;
    return m;
  }
  let _mirror = null;
  // mirror tables: mirror.h[shape*4+angle] = [shape', angle'] for left-right mirroring; mirror.v for top-bottom
  function mirrorTables() {
    if (_mirror) return _mirror;
    const N = 24, masks = [];
    for (let s = 0; s < SHAPES.length; s++) for (let a = 0; a < 4; a++) masks.push(shapeMask(s, a, N));
    const find = (mapFn) => {
      const out = [];
      for (let k = 0; k < masks.length; k++) {
        const src = masks[k], mm = new Uint8Array(N * N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const [mx, my] = mapFn(x, y); mm[my * N + mx] = src[y * N + x]; }
        let best = k, bestScore = -1;
        for (let j = 0; j < masks.length; j++) {
          let inter = 0, uni = 0; const m2 = masks[j];
          for (let i = 0; i < mm.length; i++) { inter += mm[i] & m2[i]; uni += mm[i] | m2[i]; }
          const sc = uni ? inter / uni : 1;
          if (sc > bestScore + 1e-9) { bestScore = sc; best = j; }
        }
        out.push([best >> 2, best & 3]);
      }
      return out;
    };
    _mirror = { h: find((x, y) => [N - 1 - x, y]), v: find((x, y) => [x, N - 1 - y]) };
    return _mirror;
  }
  function mirrorShape(shape, angle, axis) {
    if (shape === 0) return [0, 0];
    return mirrorTables()[axis === 'v' ? 'v' : 'h'][shape * 4 + (angle & 3)].slice();
  }

  // ---------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------
  function createModel(W, H, opts) {
    opts = opts || {};
    W = Math.max(1, Math.min(LIMITS.maxSize, W | 0)); H = Math.max(1, Math.min(LIMITS.maxSize, H | 0));
    const n = W * H;
    const m = {
      name: opts.name || 'untitled', W, H,
      palette: (opts.palette || DEFAULT_PALETTE).slice(0, LIMITS.maxColors),
      align: opts.align || 'center', depthScale: opts.depthScale || 1,
      color: new Int8Array(n).fill(-1), shape: new Uint8Array(n), angle: new Uint8Array(n),
      depth: new Uint8Array(n).fill(1), backColor: new Int8Array(n).fill(-1), backDepth: new Uint8Array(n)
    };
    return m;
  }
  function cloneModel(m) {
    return Object.assign({}, m, {
      palette: m.palette.slice(), color: m.color.slice(), shape: m.shape.slice(), angle: m.angle.slice(),
      depth: m.depth.slice(), backColor: m.backColor.slice(), backDepth: m.backDepth.slice()
    });
  }
  const LAYERS = ['color', 'shape', 'angle', 'depth', 'backColor', 'backDepth'];
  function resizeModel(m, W, H, anchor) {
    // anchor: 'center' | 'topleft' | 'bottom'
    const out = createModel(W, H, m);
    out.name = m.name;
    let ox = 0, oy = 0;
    if (anchor !== 'topleft') { ox = Math.floor((out.W - m.W) / 2); oy = anchor === 'bottom' ? out.H - m.H : Math.floor((out.H - m.H) / 2); }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= out.W || ny >= out.H) continue;
      const i = y * m.W + x, j = ny * out.W + nx;
      for (const L of LAYERS) out[L][j] = m[L][i];
    }
    return out;
  }
  function cellZ(m, i) {
    const k = m.depthScale || 1;
    const df = m.depth[i], db = m.backDepth[i] || df;
    let hi = df * k / 2, lo = -db * k / 2, split = 0;
    if (m.align === 'back') { const s = db * k / 2; hi += s; lo += s; split += s; }
    else if (m.align === 'front') { const s = -df * k / 2; hi += s; lo += s; split += s; }
    return { lo, hi, split };
  }

  // ---------------------------------------------------------------------------
  // Mesher — every face is either a cap (z = cell lo/hi, facing +-z, covering only
  // that cell's own footprint) or a wall (vertical, on a polygon edge, covering only the
  // z-range NOT occupied by the neighbour across that edge). Footprints never overlap and
  // wall ranges are set-differences, so no two faces can ever be coplanar AND overlapping.
  // ---------------------------------------------------------------------------
  function buildMesh(m, opts) {
    opts = opts || {};
    const optimize = opts.optimize !== false;
    const seg = opts.curveSegments || 8;
    const smooth = opts.smoothCurves !== false;
    const W = m.W, H = m.H;
    const pos = [], nrm = [], col = [], idx = [];
    const addV = (x, y, z, nx, ny, nz, c) => { pos.push(x, y, z); nrm.push(nx, ny, nz); col.push(c); return col.length - 1; };
    const wx = (gx, lx) => gx + lx - W / 2;
    const wy = (gy, ly) => (H - gy - 1) + ly - H / 2;
    const occ = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.color[y * W + x] >= 0;

    function quad(P, Q, z0, z1, c, n, nP, nQ) {
      // P,Q are xy points; ensure outward winding matches n
      const dx = Q[0] - P[0], dy = Q[1] - P[1];
      if (dy * n[0] - dx * n[1] < 0) { const t = P; P = Q; Q = t; const tn = nP; nP = nQ; nQ = tn; }
      nP = nP || n; nQ = nQ || n;
      const a = addV(P[0], P[1], z0, nP[0], nP[1], 0, c), b = addV(Q[0], Q[1], z0, nQ[0], nQ[1], 0, c);
      const cc = addV(Q[0], Q[1], z1, nQ[0], nQ[1], 0, c), d = addV(P[0], P[1], z1, nP[0], nP[1], 0, c);
      idx.push(a, b, cc, a, cc, d);
    }
    function wall(P, Q, z0, z1, cell, n, nP, nQ) {
      if (z1 - z0 < 1e-9) return;
      const { split } = cell.z;
      if (cell.cf === cell.cb) return quad(P, Q, z0, z1, cell.cf, n, nP, nQ);
      if (z1 <= split + 1e-9) return quad(P, Q, z0, z1, cell.cb, n, nP, nQ);
      if (z0 >= split - 1e-9) return quad(P, Q, z0, z1, cell.cf, n, nP, nQ);
      quad(P, Q, z0, split, cell.cb, n, nP, nQ); quad(P, Q, split, z1, cell.cf, n, nP, nQ);
    }
    function subtract(a0, a1, b0, b1) {
      const out = [];
      if (b1 <= a0 + 1e-9 || b0 >= a1 - 1e-9) return [[a0, a1]];
      if (b0 > a0 + 1e-9) out.push([a0, b0]);
      if (b1 < a1 - 1e-9) out.push([b1, a1]);
      return out;
    }

    const cells = new Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (m.color[i] < 0) continue;
      const shape = m.shape[i] < SHAPES.length ? m.shape[i] : 0;
      cells[i] = {
        x, y, i, shape, angle: shape === 0 ? 0 : m.angle[i] & 3,
        geo: shapeGeo(shape, shape === 0 ? 0 : m.angle[i] & 3, seg), z: cellZ(m, i),
        cf: m.color[i], cb: m.backColor[i] >= 0 ? m.backColor[i] : m.color[i]
      };
    }
    // --- caps
    const capRects = new Map(); // key -> Uint8Array grid for full squares (optimize)
    for (const c of cells) {
      if (!c) continue;
      const full = c.shape === 0;
      if (optimize && full) {
        for (const face of ['f', 'b']) {
          const key = face + '|' + (face === 'f' ? c.z.hi : c.z.lo) + '|' + (face === 'f' ? c.cf : c.cb);
          let g = capRects.get(key); if (!g) { g = new Uint8Array(W * H); capRects.set(key, g); }
          g[c.i] = 1;
        }
        continue;
      }
      const g = c.geo;
      for (const face of ['f', 'b']) {
        const z = face === 'f' ? c.z.hi : c.z.lo, nz = face === 'f' ? 1 : -1, colr = face === 'f' ? c.cf : c.cb;
        const base = col.length;
        for (const p of g.pts) addV(wx(c.x, p[0]), wy(c.y, p[1]), z, 0, 0, nz, colr);
        for (const t of g.tris) { if (face === 'f') idx.push(base + t[0], base + t[1], base + t[2]); else idx.push(base + t[0], base + t[2], base + t[1]); }
      }
    }
    for (const [key, g] of capRects) {
      const [face, zs, cs] = key.split('|'); const z = +zs, colr = +cs, nz = face === 'f' ? 1 : -1;
      const used = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (!g[i] || used[i]) continue;
        let w = 1; while (x + w < W && g[i + w] && !used[i + w]) w++;
        let h = 1;
        outer: while (y + h < H) { for (let k = 0; k < w; k++) { const j = (y + h) * W + x + k; if (!g[j] || used[j]) break outer; } h++; }
        for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) used[(y + yy) * W + x + k] = 1;
        const x0 = wx(x, 0), x1 = wx(x + w - 1, 1), y1 = wy(y, 1), y0 = wy(y + h - 1, 0);
        const a = addV(x0, y0, z, 0, 0, nz, colr), b = addV(x1, y0, z, 0, 0, nz, colr), c2 = addV(x1, y1, z, 0, 0, nz, colr), d = addV(x0, y1, z, 0, 0, nz, colr);
        if (nz > 0) idx.push(a, b, c2, a, c2, d); else idx.push(a, c2, b, a, d, c2);
      }
    }
    // --- walls
    const NB = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
    const NRM = { left: [-1, 0], right: [1, 0], top: [0, 1], bottom: [0, -1] };
    const buckets = new Map(); // optimize: merge collinear border walls
    function borderPiece(c, side, t0, t1, z0, z1, colr) {
      if (z1 - z0 < 1e-9 || t1 - t0 < 1e-9) return;
      // global line coordinate + param
      let line, g0, g1;
      if (side === 'left' || side === 'right') { line = c.x + (side === 'right' ? 1 : 0); g0 = (H - c.y - 1) + t0; g1 = (H - c.y - 1) + t1; }
      else { line = (H - c.y - 1) + (side === 'top' ? 1 : 0); g0 = c.x + t0; g1 = c.x + t1; }
      if (!optimize) return emitBorder(side, line, g0, g1, z0, z1, colr);
      const key = side + '|' + line + '|' + z0 + '|' + z1 + '|' + colr;
      let b = buckets.get(key); if (!b) { b = []; buckets.set(key, b); }
      b.push([g0, g1]);
    }
    function emitBorder(side, line, g0, g1, z0, z1, colr) {
      let P, Q;
      if (side === 'left' || side === 'right') { const X = line - W / 2; P = [X, g0 - H / 2]; Q = [X, g1 - H / 2]; }
      else { const Y = line - H / 2; P = [g0 - W / 2, Y]; Q = [g1 - W / 2, Y]; }
      quad(P, Q, z0, z1, colr, NRM[side]);
    }
    function borderWall(c, side, t0, t1, z0, z1) {
      const { split } = c.z;
      if (c.cf === c.cb) return borderPiece(c, side, t0, t1, z0, z1, c.cf);
      if (z1 <= split + 1e-9) return borderPiece(c, side, t0, t1, z0, z1, c.cb);
      if (z0 >= split - 1e-9) return borderPiece(c, side, t0, t1, z0, z1, c.cf);
      borderPiece(c, side, t0, t1, z0, split, c.cb); borderPiece(c, side, t0, t1, split, z1, c.cf);
    }
    for (const c of cells) {
      if (!c) continue;
      for (const e of c.geo.edges) {
        if (!e.side) {
          const P = [wx(c.x, e.a[0]), wy(c.y, e.a[1])], Q = [wx(c.x, e.b[0]), wy(c.y, e.b[1])];
          const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = Math.hypot(dx, dy);
          const n = [dy / L, -dx / L];
          let nP = null, nQ = null;
          if (e.arc && smooth) {
            const rn = (p) => { const vx = p[0] - e.arc[0], vy = p[1] - e.arc[1], l = Math.hypot(vx, vy); return [vx / l, vy / l]; };
            const ra = rn(e.a), rb = rn(e.b);
            const s = (ra[0] + rb[0]) * n[0] + (ra[1] + rb[1]) * n[1] >= 0 ? 1 : -1;
            nP = [ra[0] * s, ra[1] * s]; nQ = [rb[0] * s, rb[1] * s];
          }
          wall(P, Q, c.z.lo, c.z.hi, c, n, nP, nQ);
          continue;
        }
        const k = (e.side === 'left' || e.side === 'right') ? 1 : 0;
        const t0 = Math.min(e.a[k], e.b[k]), t1 = Math.max(e.a[k], e.b[k]);
        const nx = c.x + NB[e.side][0], ny = c.y + NB[e.side][1];
        const nb = occ(nx, ny) ? cells[ny * W + nx] : null;
        if (!nb) { borderWall(c, e.side, t0, t1, c.z.lo, c.z.hi); continue; }
        // split [t0,t1] by neighbour coverage of the shared border
        const cov = nb.geo.cov[OPP[e.side]];
        let t = t0;
        for (const iv of cov) {
          const s0 = Math.max(t0, iv[0]), s1 = Math.min(t1, iv[1]);
          if (s1 - s0 < 1e-9) continue;
          if (s0 > t + 1e-9) borderWall(c, e.side, t, s0, c.z.lo, c.z.hi);
          for (const r of subtract(c.z.lo, c.z.hi, nb.z.lo, nb.z.hi)) borderWall(c, e.side, s0, s1, r[0], r[1]);
          t = s1;
        }
        if (t1 > t + 1e-9) borderWall(c, e.side, t, t1, c.z.lo, c.z.hi);
      }
    }
    if (optimize) {
      for (const [key, list] of buckets) {
        const parts = key.split('|');
        const side = parts[0], line = +parts[1], z0 = +parts[2], z1 = +parts[3], colr = +parts[4];
        for (const iv of mergeIntervals(list)) emitBorder(side, line, iv[0], iv[1], z0, z1, colr);
      }
    }
    return finalizeMesh(m, pos, nrm, col, idx, opts);
  }

  function finalizeMesh(m, pos, nrm, col, idx, opts) {
    // weld identical vertices
    const map = new Map(), P = [], N = [], C = [], remap = new Int32Array(col.length);
    for (let i = 0; i < col.length; i++) {
      const key = pos[i * 3].toFixed(5) + ',' + pos[i * 3 + 1].toFixed(5) + ',' + pos[i * 3 + 2].toFixed(5) + '|' +
        nrm[i * 3].toFixed(4) + ',' + nrm[i * 3 + 1].toFixed(4) + ',' + nrm[i * 3 + 2].toFixed(4) + '|' + col[i];
      let j = map.get(key);
      if (j === undefined) { j = C.length; map.set(key, j); P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); C.push(col[i]); }
      remap[i] = j;
    }
    // drop degenerate tris, group by colour
    const byColor = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
      if (a === b || b === c || a === c) continue;
      const k = C[a];
      if (!byColor.has(k)) byColor.set(k, []);
      byColor.get(k).push(a, b, c);
    }
    const groups = [], I = [];
    for (const k of [...byColor.keys()].sort((a, b) => a - b)) {
      const list = byColor.get(k); groups.push({ color: k, start: I.length, count: list.length });
      for (const v of list) I.push(v);
    }
    const positions = new Float32Array(P), normals = new Float32Array(N);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]); }
    if (!positions.length) { min.fill(0); max.fill(0); }
    return {
      positions, normals, colorIndex: new Uint8Array(C), indices: new Uint32Array(I), groups,
      palette: m.palette.slice(), name: m.name, bounds: { min, max },
      vertexCount: C.length, triangleCount: I.length / 3
    };
  }

  // Transform a mesh copy (scale + pivot) for export
  function transformMesh(mesh, opts) {
    opts = opts || {};
    const s = opts.scale != null ? opts.scale : 1;
    const pivot = opts.pivot || 'center';
    const { min, max } = mesh.bounds;
    let ox = 0, oy = 0, oz = 0;
    if (pivot === 'bottom') { oy = -min[1]; }
    else if (pivot === 'bottom-back') { oy = -min[1]; oz = -min[2]; }
    else if (pivot === 'bounds-center') { ox = -(min[0] + max[0]) / 2; oy = -(min[1] + max[1]) / 2; oz = -(min[2] + max[2]) / 2; }
    const p = new Float32Array(mesh.positions.length);
    for (let i = 0; i < p.length; i += 3) { p[i] = (mesh.positions[i] + ox) * s; p[i + 1] = (mesh.positions[i + 1] + oy) * s; p[i + 2] = (mesh.positions[i + 2] + oz) * s; }
    const out = Object.assign({}, mesh, { positions: p });
    out.bounds = { min: [(min[0] + ox) * s, (min[1] + oy) * s, (min[2] + oz) * s], max: [(max[0] + ox) * s, (max[1] + oy) * s, (max[2] + oz) * s] };
    return out;
  }

  // ---------------------------------------------------------------------------
  // Z-fighting audit — independent check on any triangle soup.
  // Flags: coplanar overlapping same-facing tris (z-fighting) and coplanar overlapping
  // opposite-facing tris (zero-thickness sheets).
  // ---------------------------------------------------------------------------
  function auditMesh(mesh) {
    const P = mesh.positions, I = mesh.indices, groups = new Map();
    const tri = (t) => [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]].map(v => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const nT = I.length / 3;
    for (let t = 0; t < nT; t++) {
      const [a, b, c] = tri(t);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const L = Math.hypot(n[0], n[1], n[2]); if (L < 1e-12) continue;
      n = n.map(q => q / L);
      // canonical sign
      let sgn = 1; for (const q of n) { if (Math.abs(q) > 1e-6) { sgn = q > 0 ? 1 : -1; break; } }
      const cn = n.map(q => q * sgn), d = cn[0] * a[0] + cn[1] * a[1] + cn[2] * a[2];
      const key = cn.map(q => Math.round(q * 1e4)).join(',') + '|' + Math.round(d * 1e4);
      if (!groups.has(key)) groups.set(key, { n: cn, list: [] });
      groups.get(key).list.push({ t, facing: sgn, pts: [a, b, c] });
    }
    const issues = [];
    for (const g of groups.values()) {
      if (g.list.length < 2) continue;
      const ax = Math.abs(g.n[0]) > Math.abs(g.n[1]) ? (Math.abs(g.n[0]) > Math.abs(g.n[2]) ? 0 : 2) : (Math.abs(g.n[1]) > Math.abs(g.n[2]) ? 1 : 2);
      const ia = ax === 0 ? 1 : 0, ib = ax === 2 ? 1 : 2;
      const T = g.list.map(o => { const p = o.pts.map(q => [q[ia], q[ib]]); return { o, p, minx: Math.min(p[0][0], p[1][0], p[2][0]), maxx: Math.max(p[0][0], p[1][0], p[2][0]), miny: Math.min(p[0][1], p[1][1], p[2][1]), maxy: Math.max(p[0][1], p[1][1], p[2][1]) }; });
      T.sort((p, q) => p.minx - q.minx);
      for (let i = 0; i < T.length; i++) {
        for (let j = i + 1; j < T.length && T[j].minx < T[i].maxx - 1e-6; j++) {
          if (T[j].miny >= T[i].maxy - 1e-6 || T[i].miny >= T[j].maxy - 1e-6) continue;
          if (triOverlap(T[i].p, T[j].p)) {
            issues.push({ type: T[i].o.facing === T[j].o.facing ? 'z-fighting' : 'zero-thickness', a: T[i].o.t, b: T[j].o.t, at: T[i].o.pts[0] });
            if (issues.length > 200) return { ok: false, issues };
          }
        }
      }
    }
    return { ok: issues.length === 0, issues, triangles: nT };
  }
  function triOverlap(A, B) {
    const axes = [];
    for (const T of [A, B]) for (let i = 0; i < 3; i++) { const p = T[i], q = T[(i + 1) % 3]; axes.push([q[1] - p[1], p[0] - q[0]]); }
    for (const ax of axes) {
      const L = Math.hypot(ax[0], ax[1]); if (L < 1e-12) continue;
      const pa = A.map(p => (p[0] * ax[0] + p[1] * ax[1]) / L), pb = B.map(p => (p[0] * ax[0] + p[1] * ax[1]) / L);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-5 || Math.max(...pb) <= Math.min(...pa) + 1e-5) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Text model format (.shape.json) — the format Claude writes and the editor saves.
  // ---------------------------------------------------------------------------
  const HEX = '0123456789abcdefghijklmnopqrstuv'; // palette index digits (base 32)
  function toText(m) {
    const rows = (fn) => { const out = []; for (let y = 0; y < m.H; y++) { let s = ''; for (let x = 0; x < m.W; x++) s += fn(y * m.W + x); out.push(s); } return out; };
    const has = (fn) => { for (let i = 0; i < m.W * m.H; i++) if (m.color[i] >= 0 && fn(i)) return true; return false; };
    const o = {
      format: 'shapeforge', version: 1, name: m.name, width: m.W, height: m.H,
      palette: m.palette.slice(), alignment: m.align, depthScale: m.depthScale,
      layers: {
        color: rows(i => m.color[i] < 0 ? '.' : HEX[m.color[i]]),
        shape: rows(i => m.color[i] < 0 ? '.' : SHAPES[m.shape[i]].code),
        rotation: rows(i => m.color[i] < 0 || m.shape[i] === 0 ? '.' : String(m.angle[i] & 3)),
        depth: rows(i => m.color[i] < 0 ? '.' : String(m.depth[i]))
      }
    };
    if (has(i => m.backColor[i] >= 0)) o.layers.backColor = rows(i => m.color[i] < 0 ? '.' : (m.backColor[i] >= 0 ? HEX[m.backColor[i]] : '='));
    if (has(i => m.backDepth[i] > 0)) o.layers.backDepth = rows(i => m.color[i] < 0 ? '.' : (m.backDepth[i] > 0 ? String(m.backDepth[i]) : '='));
    // compact JSON: one row per line
    const json = JSON.stringify(o, null, 2);
    return json.replace(/\[\s+("[^\]]*?")\s+\]/g, (all, inner) => '[\n' + inner.split(/,\s+/).map(s => '      ' + s).join(',\n') + '\n    ]')
      .replace(/"palette": \[[^\]]*\]/, '"palette": ' + JSON.stringify(o.palette));
  }

  // Parse + validate. Returns { model, errors:[], warnings:[] } (model null on errors).
  function fromText(input) {
    const errors = [], warnings = [];
    let o = input;
    if (typeof input === 'string') { try { o = JSON.parse(input); } catch (e) { return { model: null, errors: ['Invalid JSON: ' + e.message], warnings }; } }
    if (!o || typeof o !== 'object') return { model: null, errors: ['Not an object'], warnings };
    const L = o.layers || {};
    if (!Array.isArray(L.color)) return { model: null, errors: ['layers.color (array of row strings) is required'], warnings };
    const H = o.height || L.color.length, W = o.width || (L.color[0] || '').length;
    if (W < 1 || H < 1) errors.push('Model is empty.');
    if (W > LIMITS.maxSize || H > LIMITS.maxSize) errors.push(`Size ${W}x${H} exceeds the ${LIMITS.maxSize}x${LIMITS.maxSize} limit.`);
    const palette = Array.isArray(o.palette) && o.palette.length ? o.palette.slice() : DEFAULT_PALETTE.slice();
    if (palette.length > LIMITS.maxColors) errors.push(`Palette has ${palette.length} colours; the limit is ${LIMITS.maxColors}.`);
    palette.forEach((c, i) => { if (!/^#[0-9a-fA-F]{6}$/.test(c)) errors.push(`palette[${i}] "${c}" must be #RRGGBB.`); });
    const align = o.alignment || 'center';
    if (!ALIGNMENTS.includes(align)) errors.push(`alignment must be one of ${ALIGNMENTS.join(', ')}.`);
    const ds = o.depthScale == null ? 1 : +o.depthScale;
    if (!(ds > 0 && ds <= 4)) errors.push('depthScale must be > 0 and <= 4.');
    if (errors.length) return { model: null, errors, warnings };
    const m = createModel(W, H, { name: o.name || 'untitled', palette, align, depthScale: ds });
    const grid = (name, required) => {
      const g = L[name];
      if (g == null) { if (required) errors.push(`layers.${name} is required.`); return null; }
      if (typeof g === 'number' || typeof g === 'string' && g.length === 1) return { uniform: String(g) };
      if (!Array.isArray(g)) { errors.push(`layers.${name} must be an array of ${H} strings.`); return null; }
      if (g.length !== H) errors.push(`layers.${name} has ${g.length} rows; expected ${H}.`);
      g.forEach((r, y) => { if (typeof r !== 'string' || [...r].length !== W) errors.push(`layers.${name} row ${y} has length ${typeof r === 'string' ? [...r].length : '?'}; expected ${W}: "${r}"`); });
      return { rows: g.map(r => [...String(r)]) };
    };
    const get = (g, x, y) => !g ? null : g.uniform != null ? g.uniform : (g.rows[y] || [])[x];
    const gc = grid('color', true), gs = grid('shape'), gr = grid('rotation'), gd = grid('depth'), gbc = grid('backColor'), gbd = grid('backDepth');
    if (errors.length) return { model: null, errors, warnings };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, at = `(x=${x}, y=${y})`;
      const c = get(gc, x, y);
      if (c === '.' || c === ' ' || c == null) continue;
      const ci = HEX.indexOf(String(c).toLowerCase());
      if (ci < 0) { errors.push(`color ${at}: "${c}" is not a palette index (0-9, a-v) or "."`); continue; }
      if (ci >= palette.length) { errors.push(`color ${at}: index ${c} but palette has only ${palette.length} colours.`); continue; }
      m.color[i] = ci;
      const s = get(gs, x, y);
      if (s != null && s !== '.') {
        if (!(s in CODE_TO_SHAPE)) errors.push(`shape ${at}: unknown shape code "${s}". Valid: ${SHAPES.map(q => q.code).join(' ')}`);
        else m.shape[i] = CODE_TO_SHAPE[s];
      }
      const r = get(gr, x, y);
      if (r != null && r !== '.') { if (!/^[0-3]$/.test(r)) errors.push(`rotation ${at}: "${r}" must be 0-3.`); else m.angle[i] = +r; }
      if (m.shape[i] === 0) m.angle[i] = 0;
      const d = get(gd, x, y);
      if (d != null && d !== '.') { if (!/^[1-8]$/.test(d)) errors.push(`depth ${at}: "${d}" must be 1-8.`); else m.depth[i] = +d; }
      const bc = get(gbc, x, y);
      if (bc != null && bc !== '.' && bc !== '=') {
        const bi = HEX.indexOf(String(bc).toLowerCase());
        if (bi < 0 || bi >= palette.length) errors.push(`backColor ${at}: "${bc}" must be "=" or a palette index.`); else m.backColor[i] = bi === ci ? -1 : bi;
      }
      const bd = get(gbd, x, y);
      if (bd != null && bd !== '.' && bd !== '=') { if (!/^[1-8]$/.test(bd)) errors.push(`backDepth ${at}: "${bd}" must be "=" or 1-8.`); else m.backDepth[i] = +bd === m.depth[i] ? 0 : +bd; }
    }
    // stray data in empty cells
    for (const [nm, g] of [['shape', gs], ['depth', gd]]) {
      if (!g || g.uniform != null) continue;
      let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = get(g, x, y); if (m.color[y * W + x] < 0 && v && v !== '.' && v !== ' ') n++; }
      if (n) warnings.push(`${n} cell(s) in layers.${nm} have values where the color layer is empty; they are ignored.`);
    }
    if (errors.length) return { model: null, errors: errors.slice(0, 60).concat(errors.length > 60 ? [`...and ${errors.length - 60} more`] : []), warnings };
    const parts = islands(m);
    if (parts > 1) warnings.push(`Model has ${parts} disconnected parts (cells not sharing an edge). That is allowed but they will float separately.`);
    let used = 0; for (let i = 0; i < W * H; i++) if (m.color[i] >= 0) used++;
    if (!used) warnings.push('Model has no filled cells.');
    return { model: m, errors, warnings };
  }
  function islands(m) {
    const seen = new Uint8Array(m.W * m.H); let n = 0;
    for (let s = 0; s < m.W * m.H; s++) {
      if (m.color[s] < 0 || seen[s]) continue; n++;
      const st = [s]; seen[s] = 1;
      while (st.length) { const i = st.pop(), x = i % m.W, y = (i / m.W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H) continue; const j = ny * m.W + nx; if (!seen[j] && m.color[j] >= 0) { seen[j] = 1; st.push(j); } } }
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Binary helpers: CRC32, PNG (stored-deflate by default), ZIP (stored)
  // ---------------------------------------------------------------------------
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(buf, crc) { crc = (crc === undefined ? 0xFFFFFFFF : crc ^ 0xFFFFFFFF) >>> 0; for (let i = 0; i < buf.length; i++) crc = CRC_T[(crc ^ buf[i]) & 255] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
  function zlibStored(data) {
    const nb = Math.max(1, Math.ceil(data.length / 65535)), out = new Uint8Array(2 + data.length + nb * 5 + 4);
    out[0] = 0x78; out[1] = 0x01; let o = 2;
    for (let b = 0; b < nb; b++) {
      const s = b * 65535, len = Math.min(65535, data.length - s);
      out[o++] = b === nb - 1 ? 1 : 0; out[o++] = len & 255; out[o++] = len >> 8; out[o++] = ~len & 255; out[o++] = (~len >> 8) & 255;
      out.set(data.subarray(s, s + len), o); o += len;
    }
    let a = 1, b2 = 0; for (let i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b2 = (b2 + a) % 65521; }
    out[o++] = b2 >> 8; out[o++] = b2 & 255; out[o++] = a >> 8; out[o++] = a & 255;
    return out;
  }
  function encodePNG(w, h, rgba, deflate) {
    const raw = new Uint8Array((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
    const z = (deflate || zlibStored)(raw);
    const chunks = [];
    const chunk = (type, data) => {
      const c = new Uint8Array(12 + data.length), dv = new DataView(c.buffer);
      dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
      c.set(data, 8); dv.setUint32(8 + data.length, crc32(c.subarray(4, 8 + data.length))); chunks.push(c);
    };
    const ih = new Uint8Array(13), dv = new DataView(ih.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ih[8] = 8; ih[9] = 6;
    chunk('IHDR', ih); chunk('IDAT', z instanceof Uint8Array ? z : new Uint8Array(z)); chunk('IEND', new Uint8Array(0));
    return concatBytes([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])].concat(chunks));
  }
  function concatBytes(list) { let n = 0; for (const a of list) n += a.length; const o = new Uint8Array(n); let p = 0; for (const a of list) { o.set(a, p); p += a.length; } return o; }
  const enc = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  function makeZip(files) { // files: [{name, data:Uint8Array|string}]
    const locals = [], centrals = []; let off = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? enc(f.data) : f.data, name = enc(f.name), crc = crc32(data);
      const lh = new Uint8Array(30 + name.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(12, 33, true); dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); lh.set(name, 30);
      const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(14, 33, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); ch.set(name, 46);
      locals.push(lh, data); centrals.push(ch); off += lh.length + data.length;
    }
    const cd = concatBytes(centrals), end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cd.length, true); ev.setUint32(16, off, true);
    return concatBytes(locals.concat([cd, end]));
  }

  // ---------------------------------------------------------------------------
  // Exporters
  // ---------------------------------------------------------------------------
  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const s2l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  // Palette atlas: 8x4 blocks of 16px (128x64) — UVs sample block centres
  function paletteAtlas(palette) {
    const CW = 8, CH = Math.max(4, Math.ceil(palette.length / 8)), B = 16, SW = CW * B, SH = CH * B, px = new Uint8Array(SW * SH * 4);
    for (let i = 0; i < CW * CH; i++) {
      const rgb = hexRGB(palette[i] || '#FF00FF'), bx = (i % CW) * B, by = ((i / CW) | 0) * B;
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const o = ((by + y) * SW + bx + x) * 4; px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255; }
    }
    return { width: SW, height: SH, rgba: px, uv: (i) => [((i % CW) + 0.5) / CW, (((i / CW) | 0) + 0.5) / CH] };
  }
  const safeName = (s) => String(s || 'model').replace(/[^A-Za-z0-9_\-]+/g, '_');

  function toOBJ(mesh, opts) {
    opts = opts || {};
    const name = safeName(mesh.name), atlas = opts.texture === 'atlas' ? paletteAtlas(mesh.palette) : null;
    const P = mesh.positions, N = mesh.normals, C = mesh.colorIndex;
    let s = `# Model Kit ${VERSION} by Grug Digital\n# ${mesh.vertexCount} vertices, ${mesh.triangleCount} triangles\nmtllib ${name}.mtl\no ${name}\n`;
    for (let i = 0; i < C.length; i++) {
      s += `v ${+P[i * 3].toFixed(5)} ${+P[i * 3 + 1].toFixed(5)} ${+P[i * 3 + 2].toFixed(5)}`;
      if (opts.vertexColors) { const c = hexRGB(mesh.palette[C[i]]); s += ` ${(c[0] / 255).toFixed(4)} ${(c[1] / 255).toFixed(4)} ${(c[2] / 255).toFixed(4)}`; }
      s += '\n';
    }
    for (let i = 0; i < C.length; i++) s += `vn ${+N[i * 3].toFixed(4)} ${+N[i * 3 + 1].toFixed(4)} ${+N[i * 3 + 2].toFixed(4)}\n`;
    if (atlas) for (let i = 0; i < C.length; i++) { const uv = atlas.uv(C[i]); s += `vt ${uv[0]} ${1 - uv[1]}\n`; }
    let mtl = `# Model Kit ${VERSION}\n`;
    if (atlas) { s += `usemtl palette\n`; mtl += `newmtl palette\nKd 1 1 1\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\nmap_Kd ${name}_palette.png\n`; }
    for (const g of mesh.groups) {
      if (!atlas) {
        s += `usemtl color_${g.color}\n`;
        const c = hexRGB(mesh.palette[g.color]);
        mtl += `newmtl color_${g.color}\nKd ${(c[0] / 255).toFixed(4)} ${(c[1] / 255).toFixed(4)} ${(c[2] / 255).toFixed(4)}\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\n`;
      }
      for (let t = g.start; t < g.start + g.count; t += 3) {
        const f = [0, 1, 2].map(k => { const v = mesh.indices[t + k] + 1; return atlas ? `${v}/${v}/${v}` : `${v}//${v}`; });
        s += `f ${f.join(' ')}\n`;
      }
    }
    const files = [{ name: name + '.obj', data: s }, { name: name + '.mtl', data: mtl }];
    if (atlas) files.push({ name: name + '_palette.png', data: encodePNG(atlas.width, atlas.height, atlas.rgba, opts.deflate) });
    return files;
  }

  function buildGLTF(mesh, opts) {
    opts = opts || {};
    const atlas = opts.texture === 'atlas' ? paletteAtlas(mesh.palette) : null;
    const nV = mesh.vertexCount, big = nV > 65535;
    const parts = [], views = [], accessors = [];
    let byteLen = 0;
    const pushView = (bytes, target) => {
      const pad = (4 - (byteLen % 4)) % 4; if (pad) { parts.push(new Uint8Array(pad)); byteLen += pad; }
      const v = { buffer: 0, byteOffset: byteLen, byteLength: bytes.length }; if (target) v.target = target;
      views.push(v); parts.push(bytes); byteLen += bytes.length; return views.length - 1;
    };
    const u8 = (ta) => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
    const posView = pushView(u8(mesh.positions), 34962);
    accessors.push({ bufferView: posView, componentType: 5126, count: nV, type: 'VEC3', min: mesh.bounds.min, max: mesh.bounds.max });
    const nrmView = pushView(u8(mesh.normals), 34962);
    accessors.push({ bufferView: nrmView, componentType: 5126, count: nV, type: 'VEC3' });
    const attrs = { POSITION: 0, NORMAL: 1 };
    if (atlas) {
      const uv = new Float32Array(nV * 2); for (let i = 0; i < nV; i++) { const q = atlas.uv(mesh.colorIndex[i]); uv[i * 2] = q[0]; uv[i * 2 + 1] = q[1]; }
      accessors.push({ bufferView: pushView(u8(uv), 34962), componentType: 5126, count: nV, type: 'VEC2' }); attrs.TEXCOORD_0 = accessors.length - 1;
    }
    if (opts.vertexColors) {
      const vc = new Float32Array(nV * 4);
      for (let i = 0; i < nV; i++) { const c = hexRGB(mesh.palette[mesh.colorIndex[i]]); vc[i * 4] = s2l(c[0]); vc[i * 4 + 1] = s2l(c[1]); vc[i * 4 + 2] = s2l(c[2]); vc[i * 4 + 3] = 1; }
      accessors.push({ bufferView: pushView(u8(vc), 34962), componentType: 5126, count: nV, type: 'VEC4' }); attrs.COLOR_0 = accessors.length - 1;
    }
    const materials = [], primitives = [];
    const idxAcc = (arr) => {
      const ta = big ? Uint32Array.from(arr) : Uint16Array.from(arr);
      accessors.push({ bufferView: pushView(u8(ta), 34963), componentType: big ? 5125 : 5123, count: ta.length, type: 'SCALAR' });
      return accessors.length - 1;
    };
    const json = { asset: { version: '2.0', generator: 'Model Kit ' + VERSION + ' by Grug Digital' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: safeName(mesh.name), mesh: 0 }] };
    if (atlas) {
      const png = encodePNG(atlas.width, atlas.height, atlas.rgba, opts.deflate);
      const iv = pushView(png);
      json.images = [{ bufferView: iv, mimeType: 'image/png', name: 'palette' }];
      json.samplers = [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }];
      json.textures = [{ sampler: 0, source: 0 }];
      materials.push({ name: 'palette', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } });
      primitives.push({ attributes: attrs, indices: idxAcc(mesh.indices), material: 0, mode: 4 });
    } else {
      for (const g of mesh.groups) {
        const c = hexRGB(mesh.palette[g.color]);
        materials.push({ name: 'color_' + g.color, pbrMetallicRoughness: { baseColorFactor: [s2l(c[0]), s2l(c[1]), s2l(c[2]), 1], metallicFactor: 0, roughnessFactor: 1 } });
        primitives.push({ attributes: attrs, indices: idxAcc(mesh.indices.subarray(g.start, g.start + g.count)), material: materials.length - 1, mode: 4 });
      }
    }
    json.meshes = [{ name: safeName(mesh.name), primitives }];
    json.materials = materials; json.accessors = accessors; json.bufferViews = views;
    const bin = concatBytes(parts);
    json.buffers = [{ byteLength: bin.length }];
    return { json, bin };
  }
  function toGLB(mesh, opts) {
    const { json, bin } = buildGLTF(mesh, opts);
    let js = enc(JSON.stringify(json)); const jp = (4 - js.length % 4) % 4;
    if (jp) { const t = new Uint8Array(js.length + jp); t.set(js); t.fill(0x20, js.length); js = t; }
    const bp = (4 - bin.length % 4) % 4, binP = new Uint8Array(bin.length + bp); binP.set(bin);
    const total = 12 + 8 + js.length + 8 + binP.length, out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20);
    dv.setUint32(20 + js.length, binP.length, true); dv.setUint32(24 + js.length, 0x004E4942, true); out.set(binP, 28 + js.length);
    return out;
  }
  function toGLTF(mesh, opts) {
    const { json, bin } = buildGLTF(mesh, opts);
    let b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(bin).toString('base64');
    else { let s = ''; for (let i = 0; i < bin.length; i += 0x8000) s += String.fromCharCode.apply(null, bin.subarray(i, i + 0x8000)); b64 = btoa(s); }
    json.buffers = [{ byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + b64 }];
    return JSON.stringify(json);
  }
  function toSTL(mesh) {
    const nT = mesh.triangleCount, out = new Uint8Array(84 + nT * 50), dv = new DataView(out.buffer);
    const hdr = enc('Model Kit ' + VERSION + ' binary STL'); out.set(hdr.subarray(0, 80));
    dv.setUint32(80, nT, true);
    const P = mesh.positions, I = mesh.indices; let o = 84;
    for (let t = 0; t < nT; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz) || 1;
      // STL convention: Z up -> swap Y/Z (keeping handedness)
      const w = [nx / L, -nz / L, ny / L];
      for (let k = 0; k < 3; k++) dv.setFloat32(o + k * 4, w[k], true); o += 12;
      for (const v of [a, b, c]) { dv.setFloat32(o, P[v * 3], true); dv.setFloat32(o + 4, -P[v * 3 + 2], true); dv.setFloat32(o + 8, P[v * 3 + 1], true); o += 12; }
      o += 2;
    }
    return out;
  }
  function toPLY(mesh) {
    const P = mesh.positions, N = mesh.normals, C = mesh.colorIndex;
    let s = `ply\nformat ascii 1.0\ncomment Model Kit ${VERSION}\nelement vertex ${C.length}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${mesh.triangleCount}\nproperty list uchar int vertex_indices\nend_header\n`;
    for (let i = 0; i < C.length; i++) { const c = hexRGB(mesh.palette[C[i]]); s += `${+P[i * 3].toFixed(5)} ${+P[i * 3 + 1].toFixed(5)} ${+P[i * 3 + 2].toFixed(5)} ${+N[i * 3].toFixed(4)} ${+N[i * 3 + 1].toFixed(4)} ${+N[i * 3 + 2].toFixed(4)} ${c[0]} ${c[1]} ${c[2]}\n`; }
    for (let t = 0; t < mesh.indices.length; t += 3) s += `3 ${mesh.indices[t]} ${mesh.indices[t + 1]} ${mesh.indices[t + 2]}\n`;
    return s;
  }
  function toDAE(mesh) {
    const name = safeName(mesh.name), P = mesh.positions, N = mesh.normals;
    const f = (a) => Array.from(a, v => +v.toFixed(5)).join(' ');
    let effects = '', mats = '', bind = '', tris = '';
    for (const g of mesh.groups) {
      const c = hexRGB(mesh.palette[g.color]), id = 'color_' + g.color;
      effects += `<effect id="${id}-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${(c[0] / 255).toFixed(4)} ${(c[1] / 255).toFixed(4)} ${(c[2] / 255).toFixed(4)} 1</color></diffuse></lambert></technique></profile_COMMON></effect>\n`;
      mats += `<material id="${id}" name="${id}"><instance_effect url="#${id}-fx"/></material>\n`;
      bind += `<instance_material symbol="${id}" target="#${id}"/>`;
      const ids = []; for (let t = g.start; t < g.start + g.count; t++) ids.push(mesh.indices[t], mesh.indices[t]);
      tris += `<triangles material="${id}" count="${g.count / 3}"><input semantic="VERTEX" source="#${name}-v" offset="0"/><input semantic="NORMAL" source="#${name}-n" offset="1"/><p>${ids.join(' ')}</p></triangles>\n`;
    }
    return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><authoring_tool>Model Kit ${VERSION}</authoring_tool></contributor><unit name="meter" meter="1"/><up_axis>Y_UP</up_axis></asset>
<library_effects>${effects}</library_effects>
<library_materials>${mats}</library_materials>
<library_geometries><geometry id="${name}-mesh" name="${name}"><mesh>
<source id="${name}-p"><float_array id="${name}-p-a" count="${P.length}">${f(P)}</float_array><technique_common><accessor source="#${name}-p-a" count="${P.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>
<source id="${name}-n"><float_array id="${name}-n-a" count="${N.length}">${f(N)}</float_array><technique_common><accessor source="#${name}-n-a" count="${N.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>
<vertices id="${name}-v"><input semantic="POSITION" source="#${name}-p"/></vertices>
${tris}</mesh></geometry></library_geometries>
<library_visual_scenes><visual_scene id="Scene" name="Scene"><node id="${name}" name="${name}"><instance_geometry url="#${name}-mesh"><bind_material><technique_common>${bind}</technique_common></bind_material></instance_geometry></node></visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>`;
  }
  // MagicaVoxel .vox — `res` voxels per cell (depth is sampled at the same resolution)
  function toVOX(m, opts) {
    const res = (opts && opts.resolution) || 2;
    const vox = [];
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < m.W * m.H; i++) if (m.color[i] >= 0) { const z = cellZ(m, i); zmin = Math.min(zmin, z.lo); zmax = Math.max(zmax, z.hi); }
    if (zmin === Infinity) { zmin = 0; zmax = 1; }
    const SX = m.W * res, SZ = m.H * res, SY = Math.max(1, Math.ceil((zmax - zmin) * res - 1e-6));
    if (SX > 256 || SY > 256 || SZ > 256) throw new Error('Voxel model exceeds 256 voxels; lower the resolution.');
    for (let gy = 0; gy < m.H; gy++) for (let gx = 0; gx < m.W; gx++) {
      const i = gy * m.W + gx; if (m.color[i] < 0) continue;
      const g = shapeGeo(m.shape[i], m.shape[i] ? m.angle[i] : 0, 8), z = cellZ(m, i), cb = m.backColor[i] >= 0 ? m.backColor[i] : m.color[i];
      for (let sy = 0; sy < res; sy++) for (let sx = 0; sx < res; sx++) {
        const lx = (sx + 0.5) / res, ly = (sy + 0.5) / res; // ly y-up local
        if (!pointInPoly(g.pts, lx, ly)) continue;
        for (let k = 0; k < SY; k++) {
          const zc = zmin + (k + 0.5) / res;
          if (zc < z.lo || zc > z.hi) continue;
          vox.push([gx * res + sx, k, (m.H - gy - 1) * res + sy, (zc >= z.split ? m.color[i] : cb) + 1]);
        }
      }
    }
    const chunk = (id, content, children) => {
      children = children || new Uint8Array(0);
      const h = new Uint8Array(12), dv = new DataView(h.buffer);
      for (let i = 0; i < 4; i++) h[i] = id.charCodeAt(i); dv.setUint32(4, content.length, true); dv.setUint32(8, children.length, true);
      return concatBytes([h, content, children]);
    };
    const size = new Uint8Array(12), sv = new DataView(size.buffer); sv.setUint32(0, SX, true); sv.setUint32(4, SY, true); sv.setUint32(8, SZ, true);
    const xyzi = new Uint8Array(4 + vox.length * 4), xv = new DataView(xyzi.buffer); xv.setUint32(0, vox.length, true);
    vox.forEach((v, j) => { xyzi.set([v[0], v[1], v[2], v[3]], 4 + j * 4); });
    const rgba = new Uint8Array(1024);
    for (let i = 0; i < 255; i++) { const c = hexRGB(m.palette[i] || '#000000'); rgba.set([c[0], c[1], c[2], 255], i * 4); }
    const main = chunk('MAIN', new Uint8Array(0), concatBytes([chunk('SIZE', size), chunk('XYZI', xyzi), chunk('RGBA', rgba)]));
    const hdr = new Uint8Array(8); hdr.set(enc('VOX ')); new DataView(hdr.buffer).setUint32(4, 150, true);
    return concatBytes([hdr, main]);
  }

  // ---------------------------------------------------------------------------
  // Assemblies ("bash" scenes): placed, rotated, scaled copies of models.
  // { format:'shapeforge-bash', version:1, name, parts:{ id: <.shape.json object> }, instances:[{ part, pos:[x,y,z], rot:[rx,ry,rz] (deg), scale:[sx,sy,sz] }] }
  // ---------------------------------------------------------------------------
  function instMatrix(inst) {
    const d = Math.PI / 180, r = inst.rot || [0, 0, 0], sc = inst.scale || [1, 1, 1], p = inst.pos || [0, 0, 0];
    const [cx, sx] = [Math.cos(r[0] * d), Math.sin(r[0] * d)], [cy, sy] = [Math.cos(r[1] * d), Math.sin(r[1] * d)], [cz, sz] = [Math.cos(r[2] * d), Math.sin(r[2] * d)];
    // R = Rz * Ry * Rx  (row-major 3x3)
    const Rm = [
      cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
      sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
      -sy, cy * sx, cy * cx];
    return { R: Rm, S: sc, T: p };
  }
  function xformPoint(X, x, y, z) {
    const R = X.R, s = X.S; x *= s[0]; y *= s[1]; z *= s[2];
    return [R[0] * x + R[1] * y + R[2] * z + X.T[0], R[3] * x + R[4] * y + R[5] * z + X.T[1], R[6] * x + R[7] * y + R[8] * z + X.T[2]];
  }
  function xformNormal(X, x, y, z) {
    const R = X.R, s = X.S; x /= s[0]; y /= s[1]; z /= s[2];
    const a = R[0] * x + R[1] * y + R[2] * z, b = R[3] * x + R[4] * y + R[5] * z, c = R[6] * x + R[7] * y + R[8] * z, L = Math.hypot(a, b, c) || 1;
    return [a / L, b / L, c / L];
  }
  const _partCache = new Map();
  function partMesh(text, opts) {
    const key = (typeof text === 'string' ? text : JSON.stringify(text)) + '|' + JSON.stringify(opts || {});
    let m = _partCache.get(key);
    if (!m) {
      const r = fromText(text); if (!r.model) throw new Error(r.errors[0]);
      m = buildMesh(r.model, opts); _partCache.set(key, m);
      if (_partCache.size > 200) _partCache.delete(_partCache.keys().next().value);
    }
    return m;
  }
  function validateAssembly(a) {
    const errors = [];
    if (!a || a.format !== 'shapeforge-bash') errors.push('format must be "shapeforge-bash".');
    if (!a || typeof a.parts !== 'object') errors.push('parts must be an object of { id: model }.');
    if (!a || !Array.isArray(a.instances)) errors.push('instances must be an array.');
    if (errors.length) return errors;
    for (const [k, v] of Object.entries(a.parts)) { const r = fromText(v); if (!r.model) errors.push(`part "${k}": ${r.errors.slice(0, 3).join(' ')}`); }
    a.instances.forEach((it, i) => {
      if (!(it.part in a.parts)) errors.push(`instances[${i}]: unknown part "${it.part}".`);
      for (const f of ['pos', 'rot', 'scale']) if (it[f] != null && (!Array.isArray(it[f]) || it[f].length !== 3 || it[f].some(v => typeof v !== 'number' || !isFinite(v)))) errors.push(`instances[${i}].${f} must be [x, y, z] numbers.`);
      if (it.scale && it.scale.some(v => Math.abs(v) < 1e-3)) errors.push(`instances[${i}].scale must not be 0.`);
    });
    return errors;
  }
  function buildAssemblyMesh(a, opts) {
    const P = [], N = [], C = [], I = [], pal = [], palIdx = new Map();
    for (const inst of a.instances) {
      if (inst.hidden) continue;
      const mesh = partMesh(a.parts[inst.part], opts), X = instMatrix(inst);
      const det = (inst.scale || [1, 1, 1]).reduce((p, v) => p * Math.sign(v), 1);
      const base = C.length, map = mesh.palette.map(h => { h = h.toUpperCase(); if (!palIdx.has(h)) { palIdx.set(h, pal.length); pal.push(h); } return palIdx.get(h); });
      const mp = mesh.positions, mn = mesh.normals;
      for (let i = 0; i < mesh.vertexCount; i++) {
        const q = xformPoint(X, mp[i * 3], mp[i * 3 + 1], mp[i * 3 + 2]), n = xformNormal(X, mn[i * 3], mn[i * 3 + 1], mn[i * 3 + 2]);
        P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]); C.push(map[mesh.colorIndex[i]]);
      }
      const mi = mesh.indices;
      for (let t = 0; t < mi.length; t += 3) { if (det < 0) I.push(base + mi[t], base + mi[t + 2], base + mi[t + 1]); else I.push(base + mi[t], base + mi[t + 1], base + mi[t + 2]); }
    }
    return finalizeMesh({ palette: pal, name: a.name || 'assembly' }, P, N, C, I, opts || {});
  }

  function stats(m) {
    let cells = 0; const used = new Set();
    for (let i = 0; i < m.W * m.H; i++) if (m.color[i] >= 0) { cells++; used.add(m.color[i]); if (m.backColor[i] >= 0) used.add(m.backColor[i]); }
    return { cells, colorsUsed: used.size };
  }

  return {
    VERSION, LIMITS, DEFAULT_PALETTE, KENNEY_PALETTE, ALIGNMENTS, SHAPES, CODE_TO_SHAPE,
    tessellate, shapeGeo, pointInPoly, mirrorShape, mirrorTables,
    createModel, cloneModel, resizeModel, cellZ, LAYERS, islands, stats,
    buildMesh, transformMesh, auditMesh, buildAssemblyMesh, validateAssembly, instMatrix, xformPoint, partMesh,
    toText, fromText,
    crc32, zlibStored, encodePNG, makeZip, hexRGB, paletteAtlas,
    toOBJ, toGLB, toGLTF, toSTL, toPLY, toDAE, toVOX, safeName
  };
});
