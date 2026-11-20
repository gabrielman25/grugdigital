# Handoff: adding the next accessory categories

Start here if you're a new session asked to add accessory categories to the closet. Read this, then `README.md` in this
folder (the map of the catalog and the checklist for a new category), then the closet part of the repo's `CLAUDE.md`.

## Where things are (Nov 2026)

- **The closet is live** as the site's Avatar section: `avatar/` (and the same page at `labs/catalog/`). It's one built page:
  edit `tools/catalog/` (`base.html`, `build.py`, `src/jewelry.js`, `src/int.js`, `src/closet.js`, `src/dress.js`) and run
  `python3 tools/catalog/build.py`, which writes `labs/catalog/index.html`, `avatar/index.html` and
  `assets/closet-runtime.js`. Never edit those three by hand.
- **Departments so far:** Tops, Jackets, Bottoms, Shoes, Outfits (the Modular Anime Character pack, refitted to her by
  `clothes/fit.mjs`), Eyewear, Hair, Earrings, Necklaces, Purses, Sandals, Sound (headphones, earmuffs, earbuds) and Back
  (swords). Each is a slot on her; clothing is three slots (top, legs, feet).
- **Games use it:** the player wears their closet avatar in every game that builds the player from `grug.sandy.v1`, and about
  half of all NPCs are random catalog looks (`src/dress.js`; see CLAUDE.md). A new category that sits on her body must
  move with her in a game: see checklist steps 12–13 in README.md.

## How to add a category

Follow "Adding a new category: the checklist" in `README.md`, start to finish. Copy the closest existing department:
**sandals** or **purses** for a simple world-frame piece, **earrings** or **sound** for something on her head, **back**
(swords) for a piece built from a model kit's parts, **clothing** (`/* ==== clothing */`) for a skinned garment from a pack.
Take the next free one-letter id prefix (taken: `e n p s a b t j l f u`; `c` was the old clothing).

## How the owner works

- Asset packs come from the owner's computer (for example `C:\Users\20vel\OneDrive\Desktop\<pack>`): stage them through the
  device bridge. Work on the repo itself from GitHub, not their folder. Credit every pack on `credits.html`; if a pack's
  licence doesn't allow handing out its files (like the clothing pack), its pieces get no Download.
- Work on a branch, push it, and send the branch preview links (CLAUDE.md, top). The owner says when it goes live; then
  fast-forward `main` to the branch.
- Check every piece by looking at it: renders of her from the front, side and back in the closet, its card picture, its
  studio, and her in a game (headless Chrome with `--use-angle=swiftshader` renders WebGL fine). The owner catches
  clipping from screenshots, so look closely at hems, necks, feet and hands before sending.
- One rule of the catalog's look: every new piece takes any colour (swatches plus a picker) and, where it makes sense, a
  print; KIMILAND pieces stay pastel.

## Known open items

- Toenail polish shows with no polish set in some views (not found yet; the owner was asked for a screenshot).
- In partner mode (`avatar/?partner=…`) the closet doesn't wear the partner's own bar.
- `shop/` (the classic closet) and `avatar/look.html` (the old blocky editor: skins, hats, emotes) are still there. Picking a
  skin or hat there switches the player back to the blocky avatar in games.
