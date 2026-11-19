# The accessory catalog (`labs/catalog/`): how it's built, and how to add a category

Read this before touching the catalog. It tells you where everything is, so you don't have to read the
1.3 MB built page to find out.

**Live branch preview:** `https://accessories-earrings-necklac.grugdigital.pages.dev/labs/catalog/` (branch
`accessories-earrings-necklaces`). The catalog is unlisted: nothing on the main site links to it yet.

## The one rule: never edit `labs/catalog/index.html`

It is a **generated** single file. Edit the sources here, then rebuild:

```
python3 tools/catalog/build.py          # prints "ok <bytes>" and writes labs/catalog/index.html
python3 tools/pwa/build.py              # then the offline list, committed in the same commit (see CLAUDE.md)
```

| File | What it is |
| --- | --- |
| `base.html` | The game kit's original catalog (eyewear + hair). **Treat it as read-only.** Every change to it is a `rep(old, new)` in `build.py`. |
| `build.py` | Patches `base.html` with exact string replacements (`rep` asserts the old text occurs exactly once), injects the scripts below and writes the page. The department lists, filters, routes, cards and item page are wired here. |
| `src/jewelry.js` | **The accessory engine** (`window.GrugJewelry`, `J` in the page). For every department: the design format (`DEF.<dept>`), `validate`, `random`, names, tags, colour families, description, and `build(design) → { root, info, frame, dispose }` (the 3D meshes). Earrings and necklaces first, then a `/* ==== purses */` section, then a `/* ==== sandals */` section. |
| `src/int.js` | **The page integration** (`JM`): the department table `JDEPT`, the editor's starter designs `JSTART`, generated catalog items (`gen`, `byId`, `item`), the item page's detail rows (`specRows`), the editor's tabs and inspector panels (`sandalPanel`, `pursePanel`, …), the thumbnail and camera framing, and the maker credits (`byHTML`, player names). |
| `src/bake.js` | `bakeSingle(root)`: every download (all 6 formats) is merged into **one mesh with one texture atlas** (Roblox MeshPart). New categories get this for free; just make sure every textured canvas sets `texture.userData.canvas`. |
| `src/patterns.png` | Kenney's Pattern Pack + Extra (CC0), 168 tiles of 64 px in a 14-column sheet, injected as `window.GRUG_PATTERNS`. Read through `J.PAT` (`lum` brightness values, `cols`, `T`). Prints are subtle: `PAT_K = 0.4`. |
| `test/` | Headless Chrome helpers (see Testing). |

The page loads the avatar from **`labs/catalog/vendor/sandy-runtime.js`**: the game kit's newest runtime (the new feet,
Nov 2026). It is a copy of `grug-game-kit/vendor/sandy-runtime.js`; refresh it from there if the kit's avatar changes.
The rest of the site still uses `assets/sandy-classic.js` (old feet).

## How the page fits together

- **The mannequin** is the classic female Sandy, painted one grey (`applyStatue` in `base.html`). A shared clipping plane
  (`sandy.__cut`) hides her below mid-thigh; `JM.syncDress()` opens it while sandals are on, hides her own flip-flops,
  and sets the foot pose (`J.tiltFeet(sandy, tilt, noToes)`: heels tip the foot, slippers tuck the toes away).
- **Departments:** eyewear and hair come from `base.html`. `earrings`, `necklaces`, `purses` and `sandals` are "jewelry"
  departments (`isJ(it)`), with generated ids `ge:` `gn:` `gp:` `gs:` + seed and saved designs `m:`.
- **Brands:** `grug` and `kimiland` (KIMILAND: all pastel, about 90% pink, pink cards, logo toast to their Roblox group).
  Validation forces pastels for KIMILAND (`kimiEl`, `toPastel`). Generated `grug` items are made by players about a
  third of the time (`makerOf` in `int.js`, names from the site's NAMES lists) and get the item brand `players`.
- **Per-department dispatch:** the `window.GrugJewelry` export at the bottom of `jewelry.js` routes `validate`, `random`,
  `nameFor`, `tagsFor`, `families`, `describe` and `kindOf` by department (`dept === 'sandals' ? validateS(...) : ...`).

## Adding a new category: the checklist

Use **sandals** (`validateS` / `randomS` / `buildSandals`, `JDEPT.sandals`, `sandalPanel`) or **purses** as the model to copy.
Pick a one-letter id prefix (taken: `e n p s`).

**`src/jewelry.js`** (a new `/* ==== <dept> */` section, before `const build =`)
1. `DEF.<dept>`, a limits table, `LIMITS.<dept> = { n: <max charms> }`, and the kind list (like `STYLES`) with labels.
   Add the kind labels to `KIND_LABEL`.
2. `validate<X>(src, brand)`: clamp every number, `isHex` every colour, `cleanEl` the charms, and the KIMILAND pastel rule.
3. `random<X>(seed, o)`: honour `o.kind`, `o.brand`, `o.keep` ('shape' or 'colours') and `o.base`, like `randomS`.
4. `name<X>`, `tags<X>`, `families<X>`, `describe<X>`.
5. `build<X>(d, ctx)`: return `{ root, d, info: { tris }, frame: 'world' | 'head', dispose }`. Mark the root
   `root.userData.jewel = { dept, design: d }`. Put every geometry and material in `own` so `dispose` frees them.
6. Route it everywhere in the dispatch (`build`, and every function in the `window.GrugJewelry` export), and export
   any new constants that the editor needs.

**`src/int.js`**
7. `JDEPT.<dept>` (label, icon, colour, studio name), and `JSTART.<dept>` (starters; include a KIMILAND one or two).
8. `JM.isJ`, `JM.list`, `gen` (the id prefix), the `byId` regex, `specRows`, `frameBox`, the editor tabs and roll
   menu in `enter`, `cam` distances, the `elCard` position wording, and the inspector: `if (dept === ...) this.<x>Panel(box, tab)`.
9. `thumbJewel` and `jewelShow` framing numbers.

**`build.py`** (search for `sandals` to find every spot)
10. The `isJ` line, the departments list (`['sandals', 'Sandals', 'sun', 'var(--g-blue)']`), `SUBS`, the `REFINE` filters,
    the department filter in the filter function, `allItems` (`JM.gen(<dept>, …)` in the generation loop), `itemById`'s
    `/^g[enps]:/`, the item note text, the `route()` regex `(earrings|necklaces|purses|sandals)`, the search placeholder
    and hero text, the Create menu entry and the hero "Roll …" button.

Then rebuild, test, run the offline build, commit and push (see CLAUDE.md: a branch preview link per change).

## Things that already work for every category

- One-texture export (`bake.js`), thumbnails, favourites, "Add to catalog", the brand filter, endless scrolling, the
  KIMILAND card colour and logo, and the "By <logo>" credits.
- Charms and shapes (`EL`, `makeEl`, `CHARMS`, `SHAPES`, themes) and their editor cards (`elCard`, `addGallery`).
- Pattern prints: `sandalTex` (sandals: regions per part, `STRAP_UV` keeps a fixed size along straps) and
  `patternTex` (purses' `print`). The editor picker is `JM.patPicker(parent, label, key, colKey, opts)`.
- Fitting to her body: `bodyField` (neck, chest, dress), `earInfo` (ears), `sandalFit` (feet: her flip-flop, posed skin,
  `skinAt`, `toWorld`, `footPt`), `GE.headModel` (head, in `base.html`).

## Testing

Serve the repo on port 8766 (`python3 -m http.server 8766` from the repo root), then:

```
python3 tools/catalog/test/shot.py "#edit/sandals" out.png "<js to run>" 1280     # load a page, run JS, screenshot
python3 tools/catalog/test/sty.py out_ '[{"kind":"slipper","seed":"a"}]' '[[0.6,0.2,75,[6,12,0]]]'   # sandal designs from set camera angles
python3 tools/catalog/test/shot.py "#edit/sandals" x.png "$(cat tools/catalog/test/random-batch.js)"   # 40 random sandals: errors, max triangles
```

The page exposes `window.GrugCatalog` = `{ J, JM, GE, sandy, scene, camera, cam, renderer, … }`. They use headless Chrome
with software WebGL (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). The
first load takes 20 to 40 seconds.

## Known limits

- Heavy gladiator, wrap and slipper pairs are about 6,000 to 7,000 triangles, over Roblox's 4,000. The item page says
  "over" honestly.
- Her toenails stay (removing them broke the toe mesh); `nailAmt = 0` keeps them her grey.
