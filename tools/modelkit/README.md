# Model Kit on the site

The **Create** tab (`create/`) shows free preset models and scenes, and opens **Model Kit**, Grug Digital's
pixel-to-3D model editor, at `create/modelkit/`.

- `create/modelkit/index.html`: the editor, one self-contained file. It's built outside this repo (from the
  ShapeForge source folder) and dropped in as is. One local change to keep when dropping in a new build: its 3D views render at half resolution
  (`DPR() * 0.5` in the viewer's draw and the flip preview; search for "Grug: 3D at half resolution"). On the site its menu gets a "Back to Grug" item, and it opens a
  preset straight away from a link: `modelkit/#model=<id>` or `modelkit/#scene=<id>`.
- `create/modelkit-core.js`: the editor's own core (shapes, mesher, exporters), copied from the same build. The
  Create page uses it, so previews and downloads are made exactly the way the editor makes them.
- `create/presets.js`: generated. Don't edit by hand.
- `create/thumbs/`: generated card pictures (512px WebP).

## Adding or changing a preset

1. Put the model in `tools/modelkit/presets/<id>.shape.json`, or a scene in `presets/scenes/<id>.bash.json`
   (make them in Model Kit: Menu → Save project, or Export → Project in the Bash tab).
2. Give it a title, a one-line blurb, a category, genres, themes and search tags in `META` / `SCENES` at the top of
   `make-presets.js` (the library's filters and search are built from these).
3. `node tools/modelkit/make-presets.js` then `node tools/modelkit/thumbs.js` (needs Playwright with Chromium).
4. Also add the same file to the editor build's examples, so "Edit in Model Kit" can open it.
