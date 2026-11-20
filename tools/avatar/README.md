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
- `randomConfig(seed, opts)` picks a skin (any skin: `{body}` only counts with `{strict: true}`); bots never get `classic`.
  About half get `catalogSeed` instead: `create()` then builds a catalog NPC (the female body in a random catalog look, the
  classic long hair or buns) through the closet runtime. `{catalog: true | false}` forces one kind; strict male bots never are.
- `SandyKit.player()` reads the saved look ('grug.sandy.v1'), moving a look saved before the change (no `model`) to
  'grug.sandy.classic.v1' first (`migrate()`). `create({classic: true})` builds the archived classic avatar from that
  key instead (`loadClassic()` loads `sandy-classic.js`, ~15 MB, once).
- `create({closet: true})` builds the **closet avatar** (the player's look once they've used the closet at `avatar/`): the
  classic kit, then `assets/closet-runtime.js` (`loadCloset()`, built by `tools/catalog/build.py`) dresses her from
  'grug.closet.v1'. If either fails to load, the player gets the blocky avatar instead.

## Hats

Each hat is fitted to the blocky head by its box (`_hat` in `src/kit.js`): the hats were made for a round head about
28 units wide, so they are stretched to this head's width and depth, then nudged per hat (`HAT_FIT`). Under a hat the
top of the head above the hat's seat is cut away in the shader (in the bind pose, so it turns with the head), so nothing
pokes through. Check a change with front, side and back renders of all eight hats.

## Customising the look (later)

Each skin texture is laid out in regions (head and face top left, shirt bottom left, trousers bottom right, shoes top
right), so recolouring a region or painting a design on the shirt is a texture job: no new geometry needed.

## The classic avatar's feet (`tools/avatar/feet/rebake.py`)

The two classic bodies inside `assets/sandy-classic.js` (`SANDY_GLB`, `SANDY_GLB_MALE`) carry the feet model (feet.obj)
grafted onto the legs. When the owner hands over a new or cleaner copy of the same model, run

    python3 tools/avatar/feet/rebake.py path/to/feet.obj

It keeps the join (the ankle ring, triangles, skin weights, `_SRC`, `_FOOT`, `_FUV`) and takes every foot vertex's position and
normal from the OBJ again, so the feet are the model as made; the nail mark (`_NAIL`) becomes a plain 0 or 1. Needs numpy and
scipy. The OBJ itself is not kept in the repo. The feet are drawn as modelled: `footShape.off` / `soleOff` (the old run-time
"fuller feet" push along the normals) are 0, and `TOES_TO_SOLE` (toes bent down to rest on a flip-flop) is off, because both
distorted the toes and nails. After a re-bake, look at both bodies barefoot and in flip-flops, then copy
`assets/sandy-classic.js` to the game kit's `vendor/`.
