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
- The new site's own files so far live in `static/` (the Fredoka font, the Pearls wallet, the itch fallback list).

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
  `character/pearls/` (the studio's Pearls page: packs, Grug Gold, daily Pearls), `tizzy/` (the promo landing page).
  R6 exports cost Pearls; making and saving characters is free.
- The Claude skill: `src/skill/` (served as `/character/roblox-characters.zip`).

## Changing the legacy site

Push to the `legacy` branch. It redeploys to the legacy address and the main address picks it up straight away.
