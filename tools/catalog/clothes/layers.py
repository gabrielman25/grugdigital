"""Keeps a two-layer garment's inner layer under its outer one (a tee under an open shirt, a jacket's lining, a shirt under a
vest or blazer): where the inner layer's surface comes through the outer (blotches of the shirt's colour on the jacket), its
vertices are moved in towards her, to just under the outer layer. Which area of the colour mask is the inner layer is read
from the garment itself (the area lying closer to her skin). Works on assets/clothes/<id>.bin in place.
python3 layers.py <sandy.json> <clothes folder> [ids...] [--check]"""
import sys, json, struct, base64, numpy as np
from PIL import Image
from scipy.spatial import cKDTree
args = sys.argv[1:]; SANDY, DIR = args[0], args[1]; CHECK = '--check' in args; IDS = [a for a in args[2:] if not a.startswith('--')]
# the garments made of a top worn under something (cuffs and trims of one-layer tops would be pushed inside them, so only these)
GAP = 0.45   # how far under the outer layer the inner one is kept (cm)
LAYERED = ['jacket', 'openshirt', 'cropjacket', 'cropjacket2', 'blazer', 'vest', 'overalls', 'outfit3']
TEX = {'tee':'top001_a','longsleeve':'top008_a','shirt':'top004','vest':'top005','tie':'top010','openshirt':'top006','sweatshirt':'top003','hoodie':'top009','jacket':'top002','cropjacket':'xtopsmall','cropjacket2':'xtop','blazer':'top011','overalls':'overalls','outfit2':'outfit002','outfit3':'outfit003','racer':'outfit004'}
S = json.load(open(SANDY))
b64 = lambda s, t: np.frombuffer(base64.b64decode(s), dtype=t)
P = b64(S['pos'], np.float32).reshape(-1, 3); N = b64(S['nor'], np.float32).reshape(-1, 3); I = b64(S['idx'], np.uint32).reshape(-1, 3)
# her skin, sampled over its triangles, with the normal there
pts, nrs = [], []
for a, b, c in I:
    A, B, C = P[a], P[b], P[c]; L = max(np.linalg.norm(A-B), np.linalg.norm(B-C), np.linalg.norm(C-A)); m = max(1, int(np.ceil(L / 0.6)))
    for i in range(m + 1):
        for j in range(m + 1 - i):
            u, v = i / m, j / m; w = 1 - u - v
            pts.append(A*w + B*u + C*v); n = N[a]*w + N[b]*u + N[c]*v; nrs.append(n / (np.linalg.norm(n) + 1e-9))
pts = np.array(pts); nrs = np.array(nrs); KT = cKDTree(pts)
def bdist(X):
    d, k = KT.query(X); s = np.einsum('ij,ij->i', X - pts[k], nrs[k]); return s, nrs[k]
def region(id, uv):
    im = np.asarray(Image.open(DIR + '/tex/' + TEX[id] + '_m.webp').convert('RGB')).astype(np.float32) / 255; H, W, _ = im.shape
    x = np.clip((uv[:, 0] % 1) * (W - 1), 0, W - 1).astype(int); y = np.clip((1 - uv[:, 1] % 1) * (H - 1), 0, H - 1).astype(int); c = im[y, x]
    mm = np.maximum(c.max(1), 1e-3); g = c[:, 1] / mm; b = c[:, 2] / mm
    return np.where(b > 0.5, 2, np.where(g > 0.5, 1, 0))
def run(id):
    f = DIR + '/' + id + '.bin'; buf = bytearray(open(f, 'rb').read()); hl = struct.unpack('<I', buf[:4])[0]; head = json.loads(buf[4:4 + hl]); B = 4 + hl
    for p in head['parts']:
        n = p['v']; pos = np.frombuffer(buf, np.float32, n * 3, B + p['pos']).reshape(-1, 3).copy(); uv = np.frombuffer(buf, np.uint16, n * 2, B + p['uv']).reshape(-1, 2) / 65535.0
        reg = region(id, uv); d, nr = bdist(pos)
        # the inner and outer areas: of the two big areas, the one closer to her
        cnt = [(reg == r).sum() for r in range(3)]; big = sorted(range(3), key=lambda r: -cnt[r])[:2]
        if min(cnt[big[0]], cnt[big[1]]) < n * 0.08: print(id, p['name'], 'one layer, left as it is'); continue
        med = {r: float(np.median(d[reg == r])) for r in big}; inner, outer = sorted(big, key=lambda r: med[r])
        if id not in LAYERED: print(id, p['name'], 'areas', {k: round(v, 2) for k, v in med.items()}, 'not layered, left as it is'); continue
        # an inner vertex at the very same place as an outer one is a seam where the two meet: it stays put
        OT = cKDTree(pos[reg == outer]); seam = OT.query(pos, distance_upper_bound=0.05)[0] < 0.05
        od = d[reg == outer]; moved = 0; most = 0.0
        for it in range(3):
            near = OT.query_ball_point(pos, 2.6)
            for i in np.where(reg == inner)[0]:
                if seam[i] or not near[i]: continue
                lim = od[near[i]].min() - GAP
                if d[i] > lim:
                    nd = max(0.15, lim); step = nd - d[i]
                    if step < -0.01: pos[i] += nr[i] * step; d[i] = nd; moved += 1; most = max(most, -step)
        print(id, p['name'], 'inner area', 'ABC'[inner], 'outer', 'ABC'[outer], {('ABC'[k]): round(v, 2) for k, v in med.items()}, '| moved', moved, 'most %.2f cm' % most)
        if not CHECK: buf[B + p['pos']: B + p['pos'] + n * 12] = pos.astype(np.float32).tobytes()
    if not CHECK: open(f, 'wb').write(buf)
for id in IDS or LAYERED: run(id)
