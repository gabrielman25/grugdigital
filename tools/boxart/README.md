# FOSSIL32 box art

Every listed game on the site is a FOSSIL32 cartridge box (`assets/fossil32/`). The box frame, spines, back, barcode and
cartridge are drawn automatically from the game's entry in `assets/games.js`. What each game needs made by hand is its
**cover art**: `assets/boxart/<id>.jpg`, **1580 × 950**, no title text (the box prints the retro title on top-left).

The house style (keep it consistent):

- **Background:** a clean, HUD-free shot from the game itself, at full resolution.
- **Hero:** a Grug avatar in a big **action pose that says what the game is about** (sprinting off with a drink, climbing,
  casting with a wand, posing on the runway…), with a white sticker outline, a soft drop shadow and a burst of light in
  the game's accent colour. The hero stands on the **right**; the top-left stays clear for the title.
- **Avatar rules:** female body only; hair style **0 (long) or 1 (buns)** only; **no hats** (they clip through the hair).
  Vary skin tone, hair colour and outfit between games; dress her for the game (dress for runway, boots for climbing…).
  Hand props: `weapon: { name: "Wand" | "Sword" | … }` (see `SandyKit.CATALOG.weapons`).
- One or two games can be pure scenery (Barista Blitz is) when the setting itself is the star.

## Tools (all in this folder)

Serve the repo root first: `python3 -m http.server 8765` (from the repo root). Needs Node + Playwright (Chromium) and Python + Pillow.
Output goes to `tools/boxart/work/` (git-ignored). Run everything from this folder.

1. **Background**: `node bg.js <game> <name> '<json>'` opens `play/<game>/game.html`, presses Start, hides every
   HTML overlay and screenshots the 3D view at 1580 × 950. Useful options:
   - `"hidePlayer": true` hides the character the camera follows (do this when the hero will be pasted in front)
   - `"shots": [{}, {"camAdd": {"yaw": 2.4}}, {"cam": {"pitch": 0.25}}]` several angles in one run (the template games
     expose a global `CAM` with `yaw / pitch / dist / height`)
   - `"keys": [["w", 6000]]` hold keys first (walk somewhere nicer)
   - `"ls": {"<view key>": {"layout": "full", "quality": "high"}}` preset localStorage (some games default to a framed,
     narrow view: e.g. `steal-a-sip.view.v2`, `glow-up-spa.view.v1`)
   - `"clicks": ["#goBtn"]`, `"url": "…"` for games with a different start
   Example: `node bg.js runway rw '{"hidePlayer":true,"shots":[{},{"camAdd":{"yaw":2.6}}]}'`
2. **Pose**: add an entry to `poses.json` and run `node pose.js poses.json <name>` → `work/pose_<name>.png` (transparent).
   An entry is the avatar config (`cfg`, same format as the avatar editor saves) plus `pose`: a list of
   `[bone, axis, radians]` turns (same convention as SandyKit's built-in animations):
   - `arm_R_shldr_jnt z` −: right arm up (−2.4 ≈ straight up) · `arm_L_shldr_jnt z` +: left arm up
   - `arm_*_shldr_jnt x` −: arm forward, +: back · `arm_*_elbow_jnt` bends the elbow
   - hand on hip: right `arm_R_shldr_jnt z −0.85` + `arm_R_elbow_jnt z +1.9`; left `arm_L_shldr_jnt z +0.85` + `arm_L_elbow_jnt z −1.9`
   - `leg_*_upr_jnt x` −: thigh forward · `leg_*_knee_jnt x` +: bend · `spine_M_01_jnt x` +: lean forward
   - `head_M_head_jnt y`: turn the head · `yaw`: turn the whole body · `lift`: raise her (mid-jump)
   Check every pose by eye before using it (look for arms through the face, feet through the floor).
3. **Composite**: add a line to `jobs` in `comp.py` (background, pose, accent colour, hero size `h_av`, centre `xc`,
   optional `sparkle=(x,y)` for magic, `blur` for low-res backgrounds) and run `python3 comp.py <id>`
   → writes `assets/boxart/<id>.jpg`. Look at the result.
4. Back-of-box screenshots: 1–3 more HUD-free shots, 800 × 450 JPEG, in `assets/boxart/shots/<id>-1.jpg` …

The poses and jobs for every current game are in `poses.json` and `comp.py`; copy the closest one as a starting point.
