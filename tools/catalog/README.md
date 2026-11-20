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
| `src/jewelry.js` | **The accessory engine** (`window.GrugJewelry`, `J` in the page). For every department: the design format (`DEF.<dept>`), `validate`, `random`, names, tags, colour families, description, and `build(design) → { root, info, frame, dispose }` (the 3D meshes). Earrings and necklaces first, then a `/* ==== purses */` section, a `/* ==== sandals */` section and a `/* ==== sound */` section. |
| `src/int.js` | **The page integration** (`JM`): the department table `JDEPT`, the editor's starter designs `JSTART`, generated catalog items (`gen`, `byId`, `item`), the item page's detail rows (`specRows`), the editor's tabs and inspector panels (`sandalPanel`, `pursePanel`, `soundPanel`, …), the thumbnail and camera framing, and the maker credits (`byHTML`, player names). |
| `src/closet.js` | **The closet** (`CL`): the page's front door since Nov 2026, the catalog and an avatar editor in one, laid out like Roblox's. See "The closet" below. |
| `src/bake.js` | `bakeSingle(root)`: every download (all 6 formats) is merged into **one mesh with one texture atlas** (Roblox MeshPart). New categories get this for free; just make sure every textured canvas sets `texture.userData.canvas`. |
| `src/patterns.png` | Kenney's Pattern Pack + Extra (CC0), 168 tiles of 64 px in a 14-column sheet, injected as `window.GRUG_PATTERNS`. Read through `J.PAT` (`lum` brightness values, `cols`, `T`). Prints are subtle: `PAT_K = 0.4`. |
| `test/` | Headless Chrome helpers (see Testing). |

The page loads the avatar from **`labs/catalog/vendor/sandy-runtime.js`**: the game kit's newest runtime (the new feet,
Nov 2026). It is a copy of `grug-game-kit/vendor/sandy-runtime.js`; refresh it from there if the kit's avatar changes.
The rest of the site still uses `assets/sandy-classic.js` (old feet).

## The closet (the front door)

`labs/catalog/` opens on the **closet** (`#closet`, `src/closet.js`), laid out like Roblox's avatar editor:

- **Landscape:** the panel on the left, her stage on the right. **Portrait** (`max-aspect-ratio: 1/1`): the stage on top and
  the panel as a sheet below it; drag or tap its grip to pull it up over her (`data-sheet` half / full).
- **Marketplace | Customize** toggle at the top. Marketplace: category tabs (the `DEPTS`), sub-tabs (`SUBS`), search, and a
  filter popover (the catalog's own refine, brand and colour filters: `#fRefine` is moved into it).
- **Both tab rows scroll sideways** when they don't fit (`hScroll` in closet.js): the mouse wheel, a mouse drag, a swipe,
  round arrows at whichever end has more, and a thin accent bar under the row. The picked tab is kept in view.
- **No floor under her:** shoes and sandals clipped through the disc, so the stage is just the blurred picture.
- **The feed is endless** (`FEED`, `newFeed`, `feedFill`): opening a tab (or a sub-tab) starts a fresh random set (a new seed),
  and pieces drawn earlier whose pictures are ready (`genCache` + `thumbs`) are mixed back in, one in three. More cards are
  appended as the sentinel (`.cl-more`) nears the bottom; the grid is never rebuilt while scrolling. Only Hair, Favourites
  and Yours end. Search and filters re-filter with the same seed.
- **An opened piece** (`#item/<id>`) fills the **bottom half of the panel** (`#clDetail`); the feed stays above it and keeps
  scrolling, so another card can be opened straight away. She **tries it on** (`CL.preview`, one piece per slot);
  **Back** or the cross puts her outfit back. **Equip** keeps it and puts it on her; **Add to wardrobe** only keeps it
  (both add it to the wardrobe). On a piece she has on, Equip reads **Unequip**. Tapping a card she has on (in the feed or
  the wardrobe) takes it off; tapping the one she's trying on puts her outfit back.
- **Customize:** Body has three sub-tabs: **Colour** (skin, nails and the hair she has on, each with swatches and a picker for
  any colour; hair keeps its colour per wardrobe piece as `entry.col`, `dyedHair`), **Face** (expression) and **Build** (the
  sliders, then her feet: foot shape, foot and toe length). Then the wardrobe by category: tap to put on or take off, the bin
  removes it. Undo/redo covers the outfit, her body and piece colours.
- **Slots, not departments:** what she wears is keyed by `slotOf(it)` (the department; clothing is three slots,
  `clothing.top|legs|feet`). `clashes()` keeps pieces that can't be worn together apart (an outfit and bottoms, shoes and sandals).
- **She is the classic female avatar in her own colours** here (`look(true)`: each material's own look, kept as
  `userData.grug0` before she's painted grey). Card pictures still use the grey mannequin: `snapScene` switches to
  `look(false)` for the moment a picture is taken. Her skin is the exact colour picked on every part (`applyBody`).
- After a build or foot change, body-fitted pieces (necklace, purse, sandals, sound's cord, swords) are measured again and
  refitted (`refitWorld`). Head items aren't: the build sliders leave her head alone (no head-size sliders, on purpose).
- **Light or dark** follows the site's setting (`profile.prefs.mode` in `grug.profile.v1`, light unless they picked dark),
  read before the page draws (a script in `<head>`). The sun/moon buttons (`[data-mode-btn]`: the stage bar and the editors'
  top bar) change it for the whole site. The accent is soft pink (`data-g-accent="pink"`) and the Grug tile is pink.
- **Her stage** sits on a blurred picture (`assets/closet/stage-bg.jpg`, pre-blurred, about 6 KB). Scrollbars are a thin
  accent pill (webkit rules; `scrollbar-width` only inside `@supports not selector(::-webkit-scrollbar)`).
- **The camera** orbits (drag), zooms (wheel or pinch) and **pans**: drag with the middle mouse button (scroll-wheel press),
  or move two fingers together on a touch screen (`panBy` in `build.py`).
- Saved on the device: `grug.closet.v1` = `{ wardrobe, wearing, body }`. A first visit starts with one hairstyle on.
- The editors (`#edit…`) and the Hair Studio are under the Grug button at the top left of the stage; their Back returns here.
  The old catalog and item pages are still in the file (`#catalog`, `#item`) but nothing routes to them.

## How the page fits together

- **The mannequin** is the classic female Sandy, painted one grey (`applyStatue` in `base.html`). A shared clipping plane
  (`sandy.__cut`) hides her below mid-thigh; `JM.syncDress()` opens it while sandals are on, hides her own flip-flops,
  and sets the foot pose (`J.tiltFeet(sandy, tilt, noToes)`: heels tip the foot, slippers tuck the toes away).
- **Departments:** eyewear and hair come from `base.html`. `earrings`, `necklaces`, `purses`, `sandals` and `sound` are "jewelry"
  departments (`isJ(it)`), with generated ids `ge:` `gn:` `gp:` `gs:` `ga:` `gb:` (back) + seed and saved designs `m:`.
- **Brands:** `grug` and `kimiland` (KIMILAND: all pastel, about 90% pink, pink cards, logo toast to their Roblox group).
  Validation forces pastels for KIMILAND (`kimiEl`, `toPastel`). Generated `grug` items are made by players about a
  third of the time (`makerOf` in `int.js`, names from the site's NAMES lists) and get the item brand `players`.
- **Per-department dispatch:** the `window.GrugJewelry` export at the bottom of `jewelry.js` routes `validate`, `random`,
  `nameFor`, `tagsFor`, `families`, `describe` and `kindOf` by department (`dept === 'sandals' ? validateS(...) : ...`).

## Adding a new category: the checklist

Use **sandals** (`validateS` / `randomS` / `buildSandals`, `JDEPT.sandals`, `sandalPanel`) or **purses** as the model to copy.
Pick a one-letter id prefix (taken: `e n p s a b t j l f u`; `c` was the old clothing).

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
    `/^g[enpsabtjlfu]:/` (and the feed's pool test in closet.js), the item note text, the `route()` regex `(earrings|necklaces|purses|sandals|sound)`, the search placeholder
    and hero text, the Create menu entry and the hero "Roll …" button.

Then rebuild, test, run the offline build, commit and push (see CLAUDE.md: a branch preview link per change).

## Hair is flat colour

Every Grug hairstyle in the catalog is plain colour, no strand texture: `build.py` runs `flatHair` on each style (each texture's
own colour, `TEX_HEX`, is multiplied into the tints). A texture is only a choice in the Hair Studio's editor
(`labs/hair-studio-x8f3k2/`: Colour → Texture → **Use a texture**), which has the same `flatHair` and opens every style flat.
Keep `TEX_HEX` and `flatHair` the same in both. Hairstyles a player saved from the Hair Studio keep whatever they chose.

## Things that already work for every category

- One-texture export (`bake.js`), thumbnails, favourites, "Add to catalog", the brand filter, endless scrolling, the
  KIMILAND card colour and logo, and the "By <logo>" credits.
- Charms and shapes (`EL`, `makeEl`, `CHARMS`, `SHAPES`, themes) and their editor cards (`elCard`, `addGallery`).
- Pattern prints: `sandalTex` (sandals: regions per part, `STRAP_UV` keeps a fixed size along straps) and
  `patternTex` (purses' `print`). The editor picker is `JM.patPicker(parent, label, key, colKey, opts)`.
- Fitting to her body: `bodyField` (neck, chest, dress), `earInfo` (ears), `soundFit` (her head measured for headphones: ears, the
  side of her head, its outline round the band and round her face, cached per head mesh), `sandalFit` (feet: her flip-flop, posed skin,
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

## Back: swords (`/* ==== back */`, `backPanel`)

- Three kinds in `d.kind`: `back1` (one sword across her back, hilt over her right shoulder), `back2` (two, crossed) and `hip`
  (one at her left hip, blade down and back). A strap holds them on: a baldric round her chest (two for `back2`) or a belt.
- Every sword is four parts from the **Modular Sword Kit by MilkAndBanana** (CC0, credited on `credits.html`): `d.blade`,
  `d.guard`, `d.grip`, `d.pommel` index the parts in `assets/swords/swords.bin` (21 blades, 21 guards, 23 grips, 44 pommels;
  loaded by `J.ready()`). The kit's parts share one origin, so they stack as they are (guard at 0, blade up +y).
- `tools/catalog/swords.mjs` makes the `.bin` from the kit's FBX files (only the Steel set; duplicates dropped): positions
  (int16), normals (int8), a region per vertex (0 = the kit's steel, 1 = everything else: a blade's edge, a grip's leather
  wrap, a pommel's gem) and the kit's painted shading (a brightness per vertex, kept as vertex colours under our colours).
  It reads the kit's palette picture (the texture embedded in each FBX) to do that.
- Colours: blade and edge, hilt (guard and pommel), grip, wrap, gem, scabbard, strap. Prints go on the blade, the grip, the
  scabbard and the strap, a fixed size (`BK_TILE` cm) whatever the part. Length 50 to 120 cm, blade width, angle, height.
- World frame, fitted over `bodyField` (`bodyLoop` lays the strap). Pictures of back swords are taken from behind.

## Clothing (`/* ==== clothing */`, `clothPanel`): the Modular Anime Character pack

Five departments: **Tops** (`gt:`), **Jackets** (`gj:`), **Bottoms** (`gl:`), **Shoes** (`gf:`) and **Outfits** (`gu:`),
27 pieces in `CLOTHES` (jewelry.js): `{ id, dept, label, sub, tex, vars, areas, cols, feet }`. The pack's open-toe shoes
(flip-flops, sandals) are left out on purpose: Sandals has its own department. The classic kit's clothes (and her old
ruffled dress) are gone; old wardrobe entries with `dept: 'clothing'` are dropped when the closet loads.

- **She always has something on:** with nothing in a slot she wears `CLOTH_DEFAULT` (the white tee and navy trousers). Card
  pictures paint those two with the mannequin colour (`clothPaint(sandy, css)`; `paintBody` calls it); the closet shows their
  own colours (`look(true)` passes null).
- **Three slots** (`CLOTH_SLOT_OF`): tops, jackets and outfits are `top`, bottoms are `legs`, shoes are `feet`. An outfit
  takes the legs too (and the feet when it has its own boots: `feet: true`, the racing suit). Shoes hide her flip-flops; shoes
  and Sandals push each other off (`clashes()` in closet.js).
- **Design** `d = { v: 2, brand, part, colA, colB, colC, vari, pat, patCol, tiles, charms: [] }`. The pack's colour masks
  mark three regions (red, green, blue channels); each channel's brightness is that region's shading, so a region takes any
  colour and keeps its folds. `areas` names the three per piece ("Shirt", "Tie", "Detail"…); `vars` are pieces with two masks
  (stripes or not). The print tiles over the first region. Normal maps come with the pack.
- **Files:** `assets/clothes/<id>.bin` (the fitted mesh) and `assets/clothes/tex/<key>_m.webp` / `_n.webp` (the mask and the
  normal map, 1024 px WebP made from the pack's `RGBMap` and `Normal` PNGs). Loaded on demand: `J.prep(dept, d)` (a promise)
  before anything is framed or pictured; `clothSync` redraws once a piece arrives.
- **Worn on her:** each piece is a `SkinnedMesh` on her own skeleton (`body.skeleton`, `body.bindMatrix`), so it moves with
  her and with her build. Her skin under it is hidden through the kit's `aHide` attribute (the `.bin` lists those vertices).
  State is `sandy.__wear = { on: {top, legs, feet}, meshes, paint }`; `buildCloth` puts a piece in a slot and gives the slot
  back on dispose.
- **Not downloadable.** The pack has no licence text of its own (it's from the Unity Asset Store, whose licence lets it ship
  inside a product but not be handed out as files), so clothing has no Download button and the studio refuses.

### Fitting a piece (`tools/catalog/clothes/`)

The pack is made for its own body (a CC_Base rig, about 140 cm, A-pose). `fit.mjs` moves every garment vertex onto her:

1. Dump her body from the page: open the catalog, run `clothes/dump-body.js` in the console, save the string as `sandy.json`.
2. `cd tools/catalog/clothes && npm install` (three 0.149.0), then
   `node fit.mjs <pack>/Assets/Meshes sandy.json ../../../assets/clothes [ids…]` (no ids: every piece in `clothes.json`).
3. Per body part (torso; upper and lower arms; thighs, calves, feet) each vertex keeps where along the part it is, which way
   round, and how far out from the pack's skin; that is laid on her matching part (radius grids of both bodies), the move is
   smoothed over the mesh, nothing is left inside her, and it takes the skin weights of her nearest skin. Anything more than
   2.5 cm past the pack's wrist is left out (gloves: her hands are round). Weights always add up to exactly 255.
   **The neck:** the pack's neck is in its head file (not in the pack), so the plain tee's neckline stands in for its surface,
   and round the middle of the neck everything comes down `NECK_DROP` cm (her neck joint is halfway up her throat; the
   pack's is at the base). Without both, necklines floated up her throat and the back of a collar showed through the gap.
4. A new piece: add it to `clothes.json` (id, FBX file), its textures to `assets/clothes/tex/`, and its `CLOTHES` entry.
   Check it on her in the closet (front and side), in its studio, and on a card picture.

## Sound (`/* ==== sound */`, `soundPanel`)

- One department, three kinds in `d.kind`: `over` (headphones: cups in five shapes on cushions, a band on a slider or a fork,
  toppers, an optional boom mic and glow ring), `muffs` (fluffy earmuffs: a bumpy flattened sphere) and `buds` (stem or round).
- **No charms in Sound** (the owner's call): `validateSnd` always empties `d.charms`, and the editor has no Charms tab. The
  glow ring is headphones only. A stem bud's stem and tip are one straight rod of the same radius and sides (a clean seam).
  Settings that don't apply to a kind are kept, not cleared, so switching back restores them (`isWired`, `hasMic`, `topOf`…).
- The model is in her head frame (`frame: 'head'`, a `cm` group like the earrings). Its head parts are in `soundHead`
  (`soundL` / `soundR` per ear for buds; earbud pictures frame `soundL`), the cord in `soundCord`. The cord is laid in world
  space over `bodyField` (`drapeCord`) and converted back to the head frame.
- Cups and their cushion together are at least `EAR_DEPTH` (4.4 cm) deep: her ears stick out that far and must stay covered.
- One 512 px picture per item (`soundTex`): the cups' outer plate (rim, inset, print; the muffs' fur), shell, cushions and
  band. The band's print keeps its size and wraps every `PERIOD` cm, like the sandals' straps.
- Shading is soft on purpose: extruded parts get `smoothNormals` (faces under 62 degrees apart share a normal) and the band
  and its cushion are a rounded section (`roundSweep`), so edges don't catch the light.

## Known limits

- Heavy gladiator, wrap and slipper pairs are about 6,000 to 7,000 triangles, over Roblox's 4,000. The item page says
  "over" honestly. Headphones are about 4,000 (up to 8,000 with cloud cups, a mic, a glow ring and a coiled cord).
- Her toenails stay (removing them broke the toe mesh); `nailAmt = 0` keeps them her grey.
