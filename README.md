# Grug

The Grug site: https://grugdigital.com/ (Cloudflare Pages, deploys on every push to `main`; also reachable at grugdigital.pages.dev).

The site is being rebuilt from scratch on `main`. The old site is kept, unchanged, on the **`legacy`** branch.

## How the two fit together

- **`main`** is the new site: the home page (`index.html`: the asset packs from itch.io, the Avatar Studio, a teaser
  for the new gaming platform and engine) plus the Avatar Studio.
- **`legacy`** is the old site exactly as it was. Cloudflare deploys it to https://legacy.grugdigital.pages.dev.
- **`functions/_middleware.js`** joins them: any address that `main` doesn't have a file for is served from the legacy
  deploy, at the same address, with a banner on top saying it's the legacy version (linking to the new site). So every
  old link, QR code, NFC tag and installed app keeps working, and people keep their saved games, avatar and Pearls.
- The old home page is at **`/legacy`**.

## Building the new site

- Add files to `main` as usual. A file on `main` always wins over the legacy page at the same address, so building a new
  page at an old path (say `games/`) replaces the old one there.
- Until you mean to replace them, avoid the old site's top-level names: `alchemy app assets avatar business coco community
  crafthouse create for games labs links make managers me partners play profile restaurant rewards rodeo shop showcase
  site soluna teahouse tools work`, and `sw.js`, `offline.html`, `pearls.html`, `privacy.html`, `terms.html`,
  `support.html`, `credits.html`. `managers/` is printed on business cards: keep it working.
- The new site's own files so far live in `static/` (the Allo font in `static/fonts/`, the Pearls wallet, the itch fallback list).

## Asset packs from itch.io (home page)

The home page lists the asset packs on https://polysw.itch.io/, live, so a new upload shows up on its own (within about
5 minutes; open `/api/itch-assets?refresh=1` to fetch it right away).

- `functions/api/itch-assets.js` serves `/api/itch-assets`: reads itch, keeps a copy in Cloudflare's cache, refreshes it
  every 5 minutes, keeps serving the last good copy if itch is down.
- `src/itch/itch.js` decides what shows: every asset pack on the itch profile (games and tools are left out; hide a
  project from the profile and it leaves the site too). The **categories are itch collections**, listed by number in
  `ITCH.COLLECTIONS` at the top of that file: Avatar Accessories, Characters & Avatars, Pets & Creatures, Game Kits &
  Props. Add a new upload to one of them on itch (the "Add to collection" button on its page) and it moves into that
  category on the site; until then it shows under "All" and "Just added". Renames and reordering on itch carry over.
- `static/itch-assets.json` is the fallback copy the page uses if the live feed can't be reached. Refresh it with
  `NODE_USE_ENV_PROXY=1 node src/itch/snapshot.mjs` (Node 18+; drop the variable if you're not behind a proxy).

## Building Studio (`/build/`)

Textured buildings for games: set a building's size and roof, paint its colour-coded reference sheet in Gemini (Nano
Banana), paste the painting back and download a retro-textured `.glb`. Built for Claude too (paste
https://grugdigital.com/build/ into a chat and describe a building).

- `build/index.html` (the studio), `build/examples/index.html` (the example gallery) and `build/claude.md` (the guide for
  Claude and other agents) are generated: edit `src/build/` and run `python3 src/build/build.py`.
- `build/examples/`: the examples' `.glb` files, thumbnails, Gemini paintings and reference sheets
  (`src/build/designs.json` + `stats.json` describe them).
- The scale figure wears the visitor's active saved outfit (`static/outfits.js`), else Grug (`/arcade/outfits/grug.glb`).

## Avatar Studio (`/character/`)

The Roblox character maker: hair, face, a custom shirt and pants painted with Gemini (Nano Banana), and a rigged R6
`.glb` download. It's built for Claude too: someone can paste https://grugdigital.com/character/ into a Claude
chat, describe a character, and Claude makes it.

- `character/index.html`: the studio. Generated, so don't hand-edit it: see `src/character/README.md`.
- `character/claude.md`: the guide Claude (and other AI agents) follow. Linked from the page and from `/llms.txt`.
- `window.GrugStudio` in the page is the agent API; recipe links like `/character/?hair=ponytail&outfit=…` open the
  studio with a character already set up.
- A new studio version: `python3 src/character/build.py path/to/studio.html`.
- Pearls: `static/pearls.js` (the shared wallet, daily Pearls, the starting balance and the `/tizzy` promo),
  `character/pearls/` (the studio's Pearls page: packs, Grug Gold, daily Pearls), `tizzy/` and `itch/` (the promo landing pages; `itch/` is where the ads on the itch.io pages and zoos land,
  see `static/ads/`).
  R6 exports cost Pearls; making and saving characters is free.
- The Claude skill: `src/skill/` (served as `/character/roblox-characters.zip`).

- Starter outfits: every look in `character/looks/looks.json` (Gemini-painted, with `arcade/outfits/<id>.glb`) is saved
  into a new browser's My outfits once (`GrugOutfits.seed()`); Grug (`default: true`) is who they play as. A new look:
  paint it in the studio, put shirt/pants PNGs in `character/looks/<id>/`, add it to `looks.json`, then build its .glb and
  preview headlessly from the studio (`buildCharacterGLB()`, animation clips stripped).
- The studio's Gemini reference shows the front avatar standing (`src/character/patch_pose.py`; soles and leg tops come
  out black).
- Home page showcase: `static/showcase/` (Blender Cycles renders of the outfits in action poses, transparent WebP, over
  scenes from the games); the slides and their prompts are in the script at the bottom of `index.html`.
- "Stop the Claude slop" (home page): characters Claude made on its own (`static/slop/`, from the owner) next to the
  same showcase renders.
- Saved outfits ("My outfits": save, edit, rename, delete, **Play as**): `static/outfits.js` (`window.GrugOutfits`, an
  IndexedDB store per browser) and the studio layer `src/character/outfits.js`, injected by
  `src/character/patch_outfits.py`. Ready-made game looks: `character/looks/` (`looks.json` + the clothing PNGs).

## Grug Arcade (`/arcade/`)

Browser games in the classic blocky style, each one self-contained: `arcade/slide-999/`, `arcade/zombie-zones/`, and
the list at `arcade/index.html` (with the "Playing as" outfit picker). Every game also has its own page,
`/arcade/place/?id=<slug>` (laid out like a classic place page: screenshot, Play, description, controls, details,
Recommendations); the list's tiles open it. The game data for both is `GAMES` in `arcade/arcade.js`, and their shared look
is `arcade/arcade.css`.

- `static/outfit-rig.js` (`window.GrugOutfitRig`) dresses a game's blocky rig in a saved outfit; the player wears the
  one they picked, other saved outfits become the other players (and, tinted green, Zombie Zones' zombies).
  `arcade/outfits/*.glb` are the games' own outfits (each with its own head shape), built from `character/looks/`.
- Pearls in games: `GrugPearls.reward(game, n, cooldown)` (Slide 999 KM's Rebirth: 2 Pearls, once per 24 hours) and
  `static/pearl-popup.js` (`window.GrugPearlPopup`: the "You got X Pearls" pop-up and the "Buy for X Pearls?" box for
  in-game cash). Games never show a Pearl balance on screen.
- `arcade/claude.md` is the guide for Claude sessions building a game for the site ("push it to the site").

## Grug Studio (`/arcade/grug-studio/`)

A baseplate game that bundles both studios: create your avatar (the Avatar Studio opens over the baseplate, `/character/?embed`)
and make a building (the Building Studio's building, `build/core.js`, changed live with sliders while you walk around it at
true scale). See CLAUDE.md.

## Changing the legacy site

Push to the `legacy` branch. It redeploys to the legacy address and the main address picks it up straight away.
