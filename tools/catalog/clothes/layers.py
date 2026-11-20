#!/usr/bin/env python3
"""Keep a garment's under-layer under it: the shirt inside a jacket (or a blazer) poked through the jacket after fit.mjs.

  python3 tools/catalog/clothes/layers.py [ids…]      (no ids: every layered piece in TEX; writes assets/clothes/<id>.bin in place)

Each piece's colour mask says which layer a vertex is on (LAYER: usually red = the first area, the shirt under it; green = the jacket over it).
Every vertex is measured from her body: its nearest point on her spine (a vertical line through her chest, up into her neck)
or on an arm (a line fitted to the sleeves). For each shirt vertex, the jacket vertices in the same direction from that point
(within ANG degrees and ALONG cm along the line) give the jacket's nearest distance there; if the shirt is not at least GAP cm
inside it, the shirt vertex is pulled in to that depth. The pull is spread a little over its neighbours so the dent is
smooth. Skin weights don't change. Running it again changes nothing (nothing pokes out any more)."""
import json, struct, sys, os, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', '..', '..', 'assets', 'clothes')
TEX = {'jacket': 'top002', 'cropjacket': 'xtopsmall', 'cropjacket2': 'xtop', 'blazer': 'top011', 'openshirt': 'top006', 'vest': 'top005', 'overalls': 'overalls'}
# which colour area is under which (0 = red, the first area; 1 = green, the second). Overalls: the tee (second) under the bib
LAYER = {'overalls': (1, 0)}
GAP, ANG, ALONG, MAXD = 0.45, 11.0, 1.6, 3.0   # MAXD: deeper than this is a fold or a mismatch, not a poke: left alone
DEEP = {'blazer': 7.5, 'vest': 7.5}   # a blazer's collar hugs her neck: its shirt collar may go further in (never nearer her spine than FLOOR)
FLOOR = 6.0

def fix(id_):
    path = os.path.join(D, id_ + '.bin'); b = bytearray(open(path, 'rb').read())
    hl = struct.unpack('<I', b[:4])[0]; h = json.loads(bytes(b[4:4 + hl])); B = 4 + hl; moved = 0
    for p in h['parts']:
        v = p['v']; pos = np.frombuffer(bytes(b[B + p['pos']:B + p['pos'] + v * 12]), np.float32).reshape(-1, 3).copy()
        uv = np.frombuffer(bytes(b[B + p['uv']:B + p['uv'] + v * 4]), np.uint16).reshape(-1, 2).astype(np.float32) / 65535
        it = np.uint32 if p.get('big') else np.uint16; idx = np.frombuffer(bytes(b[B + p['idx']:B + p['idx'] + p['i'] * np.dtype(it).itemsize]), it).reshape(-1, 3)
        im = np.asarray(Image.open(os.path.join(D, 'tex', TEX[id_] + '_m.webp')).convert('RGB')).astype(np.float32); H, W, _ = im.shape
        px = np.clip((uv[:, 0] * (W - 1)).round().astype(int), 0, W - 1); py = np.clip(((1 - uv[:, 1]) * (H - 1)).round().astype(int), 0, H - 1)
        reg = im[py, px].argmax(1); li, lo = LAYER.get(id_, (0, 1)); inner = reg == li; outer = reg == lo
        # her lines: the spine through her chest and into her neck, and one line per arm (fitted to the sleeves)
        cz = float(np.median(pos[inner & (np.abs(pos[:, 0]) < 8), 2])) if (inner & (np.abs(pos[:, 0]) < 8)).any() else float(np.median(pos[:, 2]))
        segs = [(np.array([0, pos[:, 1].min() - 5, cz]), np.array([0, pos[:, 1].max() + 10, cz]))]
        for sd in (1, -1):
            m = pos[:, 0] * sd > 20
            if m.sum() > 20:
                P = pos[m]; c = P.mean(0); u = np.linalg.svd(P - c)[2][0]; u = u * np.sign(u[0] * sd); t = (P - c) @ u
                segs.append((c + u * (t.min() - 14), c + u * (t.max() + 4)))
        def near(P):   # for each point: its segment, distance along it, the point on it
            best = None
            for k, (a, e) in enumerate(segs):
                d = e - a; L = np.linalg.norm(d); u = d / L; t = np.clip((P - a) @ u, 0, L); Q = a + t[:, None] * u; r = np.linalg.norm(P - Q, axis=1)
                if k: r = np.where(np.abs(P[:, 0]) < 15, np.inf, r)   # her chest belongs to the spine
                rec = (np.full(len(P), k), t, Q, r)
                best = rec if best is None else tuple(np.where(rec[3] < best[3], x, y) if np.ndim(x) == 1 else np.where((rec[3] < best[3])[:, None], x, y) for x, y in zip(rec, best))
            return best
        seg, t, Q, r = near(pos); dirn = (pos - Q) / (r[:, None] + 1e-6)
        cosA = np.cos(np.radians(ANG)); need = np.zeros(v)
        oi = np.where(outer)[0]
        for i in np.where(inner)[0]:
            c = oi[(seg[oi] == seg[i]) & (np.abs(t[oi] - t[i]) < ALONG)]
            if not len(c): continue
            c = c[(dirn[c] @ dirn[i]) > cosA]
            if not len(c): continue
            lim = r[c].min() - GAP
            if r[i] > lim and r[i] - lim < DEEP.get(id_, MAXD): need[i] = r[i] - lim
        # spread the pull to its neighbours (a smooth dent, no spikes), never less than a vertex needs
        nb = [[] for _ in range(v)]
        for a, c2, d2 in idx: nb[a] += [c2, d2]; nb[c2] += [a, d2]; nb[d2] += [a, c2]
        pull = need.copy()
        for _ in range(3):
            sm = np.array([max([pull[j] for j in nb[i] if inner[j]] or [0]) * 0.6 for i in range(v)])
            pull = np.where(inner, np.maximum(pull, sm), 0)
        floor = np.where(seg == 0, np.minimum(r, FLOOR), 0.3)
        pull = np.minimum(np.minimum(pull, DEEP.get(id_, MAXD)), np.maximum(r - floor, 0))   # never through the line itself
        pos -= dirn * pull[:, None]; moved += int((pull > 1e-4).sum())
        print(f'{id_}: {int((need > 0).sum())} shirt points poked out (worst {need.max():.2f} cm); {int((pull > 1e-4).sum())} moved')
        b[B + p['pos']:B + p['pos'] + v * 12] = pos.astype(np.float32).tobytes()
    open(path, 'wb').write(bytes(b)); return moved

if __name__ == '__main__':
    for id_ in (sys.argv[1:] or list(TEX)): fix(id_)
