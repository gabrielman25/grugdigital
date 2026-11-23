"""Studio fix: the Gemini reference picture shows the front avatar STANDING (legs straight down) instead of sitting, and
the tops of the legs and the soles of the feet (seen in neither view) are painted black in the pants.
Idempotent. apply(s) is run by patch_outfits.py (so by patch_studio.py / build.py too); or run it on its own:
    python3 src/character/patch_pose.py character/index.html"""
import sys

MARK = '/*grug:standing*/'
SUBS = [
  # the front view keeps its legs hanging (no seated leg transforms, no seated occlusion boxes)
  ("VIEWS[0].off = Object.assign({}, NO_OFF, { head: Object.assign([0,0,0], { M: VIEWS[0].headRot }), rleg: Object.assign([0,0,0], { M: SEAT.rleg.M }), lleg: Object.assign([0,0,0], { M: SEAT.lleg.M }), box: { rleg: SEAT.rleg.box, lleg: SEAT.lleg.box } });",
   MARK + " VIEWS[0].pose = null; VIEWS[0].off = Object.assign({}, NO_OFF, { head: Object.assign([0,0,0], { M: VIEWS[0].headRot }) });"),
  ("x.fillText('FRONT VIEW (SITTING)', 343, 24);", "x.fillText('FRONT VIEW (STANDING)', 343, 24);"),
  ("the FRONT VIEW on the left (sitting)", "the FRONT VIEW on the left (standing)"),
  ("In the front view the character is sitting: the two legs lie side by side, pointing towards you, straight out in front of the torso.",
   "In the front view the character is standing: the two legs hang straight down under the torso, side by side."),
  ("including the tops of the legs and the inner sides,", "including the inner sides,"),
  ("and a rubber sole on the bottom end of each leg, which is visible in the sitting view.", "and the edge of a rubber sole along the bottom of each leg."),
  # soles and leg tops: black, since neither view shows them
  ("function runExtract(){\n  const r = extract(alignedData, state.opts);\n  state.rawShirt = r.shirt; state.rawPants = r.pants;\n  state.rawHead = null;",
   "function runExtract(){\n  const r = extract(alignedData, state.opts); " + MARK + " { const x = r.pants.getContext('2d'); x.fillStyle = '#111111'; for (const [px, py] of [[217, 289], [308, 289], [217, 485], [308, 485]]) x.fillRect(px, py, 64, 64); }\n  state.rawShirt = r.shirt; state.rawPants = r.pants;\n  state.rawHead = null;"),
]

def apply(s):
    if MARK in s:
        return s
    for old, new in SUBS:
        n = s.count(old)
        assert n == 1, f'patch_pose: expected 1 of {old[:70]!r}, found {n}'
        s = s.replace(old, new)
    return s

if __name__ == '__main__':
    p = sys.argv[1]; s = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8').write(apply(s)); print('standing pose patched', p)
