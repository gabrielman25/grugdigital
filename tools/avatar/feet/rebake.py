#!/usr/bin/env python3
"""Re-bake the avatar's feet from a clean copy of feet.obj.

    python3 tools/avatar/feet/rebake.py path/to/feet.obj [assets/sandy-classic.js ...]

The two classic bodies (window.SANDY_GLB / SANDY_GLB_MALE in assets/sandy-classic.js) carry the feet model grafted onto the
legs: same triangles and UVs as feet.obj (kept in _FUV), joined to the leg at the ankle. This script keeps everything that
join needed (which vertices exist, the triangles, the skin weights, _SRC, _FOOT, the ankle ring) and replaces only what the
feet look like, straight from the OBJ:

  positions  each foot vertex = the foot's placement (one affine map per foot, measured from the mesh as it is) applied to
             the OBJ vertex, plus a smooth offset. The offset is what the ankle ring needs to meet the leg exactly (the ring
             is pinned where it is) and melts away within a few centimetres: the rest of the foot is the OBJ as modelled.
             Vertices that share a place in the OBJ (UV seams) land on the same point, so nothing cracks.
  normals    recomputed on the welded mesh (angle weighted), blended with the OBJ's own normals away from the ankle,
             identical across UV seams.
  _NAIL      the per-vertex nail mark, made a plain 0 or 1 (each nail is its own island of vertices in the OBJ, so the
             edge follows the nail as modelled).

Needs numpy and scipy. Run it again whenever feet.obj changes; it is safe to run twice (the second run changes almost nothing).
"""
import sys, re, json, struct, base64
import numpy as np
from scipy.sparse import coo_matrix, diags, identity
from scipy.sparse.linalg import spsolve

CT = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
FADE = 0.1       # how fast the ankle fit melts into the foot (bigger = shorter)


def read_obj(path):
    v, vt, vn, f = [], [], [], []
    for l in open(path):
        if l.startswith('v '): v.append(l.split()[1:4])
        elif l.startswith('vt '): vt.append(l.split()[1:3])
        elif l.startswith('vn '): vn.append(l.split()[1:4])
        elif l.startswith('f '):
            t = [[int(x) for x in c.split('/')] for c in l.split()[1:]]
            assert len(t) == 3 and all(c[0] == c[1] == c[2] for c in t), 'feet.obj: expected triangles with one index per corner'
            f.append([c[0] - 1 for c in t])
    return np.array(v, float), np.array(vt, float), np.array(vn, float), np.array(f)


class Glb:
    def __init__(s, b):
        s.raw = bytearray(b)
        jl = struct.unpack('<I', b[12:16])[0]
        s.j = json.loads(bytes(b[20:20 + jl])); s.jl = jl
        s.bo = 20 + jl + 8
    def _span(s, i):
        a = s.j['accessors'][i]; bv = s.j['bufferViews'][a['bufferView']]
        n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
        assert not bv.get('byteStride') or bv['byteStride'] == dt.itemsize * n, 'interleaved buffers are not supported'
        return s.bo + bv.get('byteOffset', 0) + a.get('byteOffset', 0), a['count'], n, dt
    def get(s, i):
        o, c, n, dt = s._span(i)
        return np.frombuffer(bytes(s.raw[o:o + c * n * dt.itemsize]), dtype=dt).reshape(c, n).copy()
    def put(s, i, arr):
        o, c, n, dt = s._span(i); arr = np.ascontiguousarray(arr, dtype=dt).reshape(c, n)
        s.raw[o:o + c * n * dt.itemsize] = arr.tobytes()
        a = s.j['accessors'][i]
        if 'min' in a: a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
    def bytes(s):
        js = json.dumps(s.j, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        body = bytes(s.raw[20 + s.jl:])
        out = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + len(body)) + struct.pack('<I', len(js)) + b'JSON' + js + body)
        return bytes(out)


def vertex_normals(P, tri, weld):
    """angle-weighted normals on the welded mesh; returns one normal per welded id"""
    n = weld.max() + 1; acc = np.zeros((n, 3))
    a, b, c = P[tri[:, 0]], P[tri[:, 1]], P[tri[:, 2]]
    fn = np.cross(b - a, c - a); fl = np.linalg.norm(fn, axis=1, keepdims=True); fn = fn / np.maximum(fl, 1e-12)
    for k, (p, q, r) in enumerate(((a, b, c), (b, c, a), (c, a, b))):
        u = q - p; w = r - p
        ang = np.arccos(np.clip((u * w).sum(1) / np.maximum(np.linalg.norm(u, axis=1) * np.linalg.norm(w, axis=1), 1e-12), -1, 1))
        np.add.at(acc, weld[tri[:, k]], fn * ang[:, None])
    return acc / np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)


def rebake(glb_bytes, obj, label=''):
    v, vt, vn, F = obj
    g = Glb(glb_bytes); prim = g.j['meshes'][0]['primitives'][0]; A = prim['attributes']
    for k in ('_FUV', '_FOOT', '_NAIL'): assert k in A, 'this body has no grafted feet (%s missing)' % k
    P0 = g.get(A['POSITION']).astype(float); N0 = g.get(A['NORMAL']).astype(float)
    foot = g.get(A['_FOOT'])[:, 0]; fuv = g.get(A['_FUV']); nail0 = g.get(A['_NAIL'])[:, 0]
    tri = g.get(prim['indices']).reshape(-1, 3).astype(int)
    fm = foot != 0; full = np.abs(foot) >= 0.999; idx = np.where(fm)[0]
    # ---- which OBJ vertex is each foot vertex (by its UV; the two feet are told apart by the side they are on) ----
    byuv = {}
    for i, u in enumerate(vt.astype('f4')): byuv.setdefault((u[0], u[1]), []).append(i)
    zmid = (v[:, 2].min() + v[:, 2].max()) / 2; oside = v[:, 2] > zmid          # the OBJ's two feet sit side by side along z
    cand = [byuv.get((fuv[i, 0], fuv[i, 1])) for i in idx]
    assert all(cand), 'a foot vertex has a UV that is not in feet.obj: is this the same model?'
    M = {}
    for sd in (True, False):
        pr = [(i, c[0]) for i, c in zip(idx, cand) if len(c) == 1 and oside[c[0]] == sd and full[i]]
        a = np.array([p[0] for p in pr]); b = np.array([p[1] for p in pr])
        M[sd] = np.linalg.lstsq(np.c_[v[b], np.ones(len(b))], P0[a], rcond=None)[0]
    mp = np.full(len(P0), -1)
    for i, c in zip(idx, cand):
        mp[i] = min(c, key=lambda o: np.linalg.norm(np.r_[v[o], 1] @ M[bool(oside[o])] - P0[i]))
    side = np.zeros(len(P0), bool); side[idx] = oside[mp[idx]]
    # same triangles as the OBJ?
    wo = {}; wobj = np.array([wo.setdefault(tuple(np.round(p, 5)), len(wo)) for p in v])
    tf = fm[tri].all(1)
    so = set(tuple(sorted(t)) for t in wobj[F]); sg = set(tuple(sorted(t)) for t in wobj[mp[tri[tf]]])
    assert sg <= so, 'the grafted feet no longer have feet.obj\'s triangles'
    # ---- welded ids: foot vertices by their OBJ place, everything else by where it is ----
    weld = np.zeros(len(P0), int); ids = {}
    for i in range(len(P0)):
        k = ('f', wobj[mp[i]]) if fm[i] else ('b',) + tuple(np.round(P0[i] * 200).astype(int))
        weld[i] = ids.setdefault(k, len(ids))
    nW = len(ids)
    # ---- positions ----
    tf = fm[tri].all(1); mixed = fm[tri].any(1) & ~tf
    pin = np.zeros(len(P0), bool); pin[np.unique(tri[mixed])] = True; pin |= fm & ~full; pin &= fm
    fw = np.unique(weld[idx]); loc = np.full(nW, -1); loc[fw] = np.arange(len(fw)); n = len(fw)
    pw = np.zeros(n, bool); pw[loc[weld[idx[pin[idx]]]]] = True
    E = np.vstack([tri[tf][:, [0, 1]], tri[tf][:, [1, 2]], tri[tf][:, [2, 0]]]); E = loc[weld[E]]
    E = np.unique(np.sort(E, axis=1), axis=0); E = E[E[:, 0] != E[:, 1]]
    W = coo_matrix((np.ones(len(E) * 2), (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n)).tocsr()
    deg = np.asarray(W.sum(1)).ravel(); L = diags(deg) - W
    lam = np.where(pw, 1e4, FADE); A_ = (L + diags(lam)).tocsc()
    reach = spsolve(A_, np.where(pw, lam, 0.0))[loc[weld]]        # 1 at the ankle ring, melting to 0: how far the ankle fit reaches
    # each foot's placement, measured again from the part of it the ankle fit reaches least (so a second run finds the same placement)
    for sd in (True, False):
        a = np.where(fm & (side == sd))[0]; a = a[reach[a] <= np.quantile(reach[a], 0.4)]
        M[sd] = np.linalg.lstsq(np.c_[v[mp[a]], np.ones(len(a))], P0[a], rcond=None)[0]
    base = P0.copy()
    for sd in (True, False):
        a = np.where(fm & (side == sd))[0]; base[a] = np.c_[v[mp[a]], np.ones(len(a))] @ M[sd]
    D = P0 - base                                           # what the old mesh added to the OBJ (the ankle fit, and its flaws)
    cnt = np.zeros(n); Dw = np.zeros((n, 3))
    np.add.at(cnt, loc[weld[idx]], 1); np.add.at(Dw, loc[weld[idx]], D[idx]); Dw /= cnt[:, None]
    # the offset is the ankle ring's own (pinned) and melts away into the foot: beyond a few centimetres it is the OBJ as modelled
    S = np.column_stack([spsolve(A_, np.where(pw, lam, 0) * Dw[:, k]) for k in range(3)])
    P = P0.copy(); P[idx] = base[idx] + S[loc[weld[idx]]]
    # ---- normals ----
    near = np.zeros(len(P0), bool); near[np.unique(tri[fm[tri].any(1)])] = True
    tn = tri[near[tri].all(1) | fm[tri].any(1)]
    Nw = vertex_normals(P, tn, weld)
    Ncalc = Nw[weld]
    # the OBJ's own normals, carried by each foot's map (inverse transpose), averaged over welded copies
    Nobj = np.zeros_like(P)
    for sd in (True, False):
        a = np.where(fm & (side == sd))[0]; q = vn[mp[a]] @ np.linalg.inv(M[sd][:3]).T
        Nobj[a] = q / np.linalg.norm(q, axis=1, keepdims=True)
    accn = np.zeros((nW, 3)); np.add.at(accn, weld[idx], Nobj[idx]); Nobj[idx] = (accn / np.maximum(np.linalg.norm(accn, axis=1, keepdims=True), 1e-12))[weld[idx]]
    # trust the OBJ's normals where the foot is as modelled, the computed ones where the ankle fit bent it (|offset gradient| large)
    Sg = np.zeros(n); g2 = np.linalg.norm(S[E[:, 0]] - S[E[:, 1]], axis=1)
    np.maximum.at(Sg, E[:, 0], g2); np.maximum.at(Sg, E[:, 1], g2)
    t = np.clip((Sg - 0.02) / 0.06, 0, 1)[loc[weld[idx]]][:, None]
    Nn = N0.copy(); q = Nobj[idx] * (1 - t) + Ncalc[idx] * t; Nn[idx] = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-12)
    # ---- nails: each nail is its own little island in the OBJ, so a plain 0 / 1 mark gives a crisp edge along its modelled border ----
    nail = nail0.copy(); nail[idx] = (nail0[idx] > 0.5).astype(float)
    # ---- report ----
    mv = np.linalg.norm(P - P0, axis=1)[idx]
    ang = np.degrees(np.arccos(np.clip((Nn[idx] * N0[idx]).sum(1), -1, 1)))
    el = np.linalg.norm(P[tri[tf][:, 0]] - P[tri[tf][:, 1]], axis=1)
    print('%s: %d foot vertices (%d pinned at the ankle), %d triangles' % (label, len(idx), pin.sum(), tf.sum()))
    print('   moved: mean %.3f cm, 95%% %.3f, most %.3f (pinned %.4f)   normals turned: mean %.1f deg, 95%% %.1f' % (mv.mean(), np.percentile(mv, 95), mv.max(), np.linalg.norm(P - P0, axis=1)[pin].max(), ang.mean(), np.percentile(ang, 95)))
    print('   away from the OBJ shape: mean %.3f cm, most %.3f   nail vertices %d -> %d (>= 0.5)' % (np.linalg.norm(S, axis=1)[~pw].mean(), np.linalg.norm(S, axis=1)[~pw].max(), (nail0 > 0.5).sum(), (nail >= 0.5).sum()))
    g.put(A['POSITION'], P); g.put(A['NORMAL'], Nn); g.put(A['_NAIL'], nail)
    return g.bytes()


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    obj = read_obj(sys.argv[1]); files = sys.argv[2:] or ['assets/sandy-classic.js']
    for path in files:
        s = open(path, encoding='utf-8').read(); done = 0
        for name in ('SANDY_GLB', 'SANDY_GLB_MALE'):
            m = re.search(r'(window\.' + name + r'="data:model/gltf-binary;base64,)([^"]+)(")', s)
            if not m: continue
            out = rebake(base64.b64decode(m.group(2)), obj, path + ' ' + name)
            s = s[:m.start(2)] + base64.b64encode(out).decode() + s[m.end(2):]; done += 1
        assert done, path + ': no body found'
        open(path, 'w', encoding='utf-8', newline='').write(s)

if __name__ == '__main__': main()
