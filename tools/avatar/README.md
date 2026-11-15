# The avatar (`assets/sandy-runtime.js`)

Since Nov 2026 every game's avatar is one simple blocky character: **Animated Characters: Protagonists** by Kenney
(kenney.nl, CC0, licence in `model/Kenney-License.txt`). Its whole look is one 1024 px skin texture (four skins:
`model/<skin>.png`), plus a hat from the classic hats (Chibi Hats by PaperPluto, `vendor/hatpack.js`).

The old 3D avatar (Sandy: two bodies, hair, faces, the closet clothes) is **archived** in `assets/sandy-classic.js`
and its editor in `avatar/classic/`. It is only ever the *player's own* character, and only when they switch on
Avatar → Classic. Runway Ready (Catwalk Craze) is the one game that still dresses everyone in the classic clothes, so it
loads the classic kit for all its characters (see the note in its AVATARS block).

## Build

    python3 tools/avatar/build.py      # writes assets/sandy-runtime.js (~1.7 MB)

`build.py` puts together `vendor/three-r149-gltf.js` (three.js r149 + GLTFLoader, split out of the classic runtime),
`vendor/hatpack.js`, `model/avatar.glb`, the skins and `src/kit.js` (SandyKit 2). Never edit the built file.

`model/avatar.glb` comes from Kenney's FBX files with `convert.html` (put the FBX files in `source/`, serve this folder,
open the page). It renames the joints to the classic names and keeps the idle, run and jump clips.

## The API (unchanged for games)

`SandyKit.create(config)` → Promise of an avatar: `object3d` (185 cm tall, feet on y = 0, facing +z), `play(name)`,
`update(dt)`, `lookAt(v3 | null)`, `setExpression(name)` (the face is painted on, so an expression is a head pose),
`apply(patch)`, `getConfig()`, `dispose()`. Joints keep the classic names (`spine_M_00_jnt`, `head_M_head_jnt`,
`arm_R_wrist_jnt`, `leg_L_knee_jnt` …) and each has `userData.rwq` (its rest rotation in her own frame).

- Animations: `idle`, `walk` (the run clip at 78 % speed, half weight), `run`, `jump` (a looping hop), `leap` (Kenney's
  jump, held), `wave`, `dance` and the emotes (`disco`, `shuffle`, `robot`, `cheer`, `bow`, `flex`).
- A look: `{ model: 'block', skin, hat: {type, colour, size, up, forward, tilt}, classic }`. `skin` is one of
  `CATALOG.skins` (skaterMaleA, skaterFemaleA, cyborgFemaleA, criminalMaleA). Classic fields in a config are ignored.
- `randomConfig(seed)` picks a skin (any skin: `{body}` only counts with `{strict: true}`); bots never get `classic`.
- `SandyKit.player()` reads the saved look ('grug.sandy.v1'), moving a look saved before the change (no `model`) to
  'grug.sandy.classic.v1' first (`migrate()`). `create({classic: true})` builds the archived classic avatar from that
  key instead (`loadClassic()` loads `sandy-classic.js`, ~15 MB, once).

## Hats

Each hat is fitted to the blocky head by its box (`_hat` in `src/kit.js`): the hats were made for a round head about
28 units wide, so they are stretched to this head's width and depth, then nudged per hat (`HAT_FIT`). Under a hat the
top of the head above the hat's seat is cut away in the shader (in the bind pose, so it turns with the head), so nothing
pokes through. Check a change with front, side and back renders of all eight hats.

## Customising the look (later)

Each skin texture is laid out in regions (head and face top left, shirt bottom left, trousers bottom right, shoes top
right), so recolouring a region or painting a design on the shirt is a texture job: no new geometry needed.
