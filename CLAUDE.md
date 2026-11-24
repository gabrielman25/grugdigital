# Notes for Claude sessions working on this repo

`main` is the **new** Grug site, being built from scratch (static files on Cloudflare Pages, deploys on push to `main`).
The **old** site is on the `legacy` branch, unchanged, with its own long CLAUDE.md: read that one only when working on
the legacy branch. See `README.md` for how the two fit together.

## The legacy pass-through (don't break it)

`functions/_middleware.js` serves every address `main` has no file for from the legacy deploy
(https://legacy.grugdigital.pages.dev), at the same address, with a "legacy version" banner. That keeps every old link,
printed QR code (`managers/`), NFC tag and installed app working, and keeps people's saved data (it is tied to the address).

- `main` must keep a `404.html`: without one Cloudflare Pages answers unknown paths with the home page (status 200), and the
  middleware would never fall back to the legacy site.
- Never add `sw.js`, `app/` or the old manifests to `main` unless the new site is deliberately taking over the installed
  apps: phones that installed the old apps still load them from those paths.
- `/` is the new home page; the old one is at `/legacy`; `/?pwa=…` (the installed apps' start page) still gets the old one.
- A file on `main` takes over the old page at the same path. Avoid the old top-level names (listed in README.md) until you
  mean to replace them.

## Avatar Studio (`/character/`)

`character/index.html` is generated from the owner's Grug Avatar Studio file plus the Claude layer in `src/character/`
(the "Make with Claude" sheet, the agent instructions, `window.GrugStudio`, recipe links). Edit the sources there and run
`python3 src/character/build.py <studio.html>`; read `src/character/README.md` first. `character/claude.md` is the guide
other Claude sessions follow when someone pastes the studio's link into a chat, so keep it accurate when the studio or
the API changes, and test the whole flow headless (set → wear an image → downloadR6) before pushing.

## Building Studio (`/build/`)

`build/index.html`, `build/examples/index.html` and `build/claude.md` are generated from `src/build/` by
`python3 src/build/build.py` (add `--standalone DIR` for single-file copies with everything embedded). Read the
docstring there first. The pipeline: one building mass + one roof, flush (no overhangs, so nothing hides a wall),
doors and windows as colour-coded guides; a black two-view reference sheet (back view left, front view right, 45°,
25° down); Gemini's painting is lined up by silhouette (border flood fill, one fit per view) and projected back
through a face-id buffer, with a wider margin at the silhouette that the inpaint bleeds over; then the Avatar Studio's
retro looks (Grug PS1 by default, with vibrance) and a bevel normal map. Keep `build/claude.md` accurate when the
settings or `window.GrugBuild` change, and test headless (set → wear an image → bake → glbBase64) before pushing.
New examples: paint them, put the files in `build/examples/`, add them to `designs.json` + `stats.json`, rebuild.

## Pearls on the new site (`static/pearls.js`)

The new pages share the legacy site's Pearls wallet (`localStorage 'grug.pearls.v1'`, same address, so the same data):
never rename it or drop fields you don't know (the legacy pages keep `buys`, `code`, `club`, `ret` there). The numbers
live in `CFG` at the top of `static/pearls.js`: new players start with 80, `/tizzy` (any capitalisation, see the middleware)
gives 600 bonus Pearls (the $9.99 pack) on top: new players start at 680, existing wallets get +600; `/itch` (the
landing page for the ads on the polysw.itch.io pages and asset zoos, `static/ads/`) gives 275 (the $4.99 pack) the same
way. Each promo works once per wallet (`promosUsed`); everyone gets 5 Pearls once per calendar day they visit (20 for Grug Gold members,
checked with the legacy `/assets/gold.js`), no cap. In the Avatar Studio, making and saving characters is free and an R6
export (`.glb` or the zip) costs 25 Pearls once per character (re-downloads are free); the shirt/pants/face PNGs stay
free. `character/pearls/` sells the same Stripe packs as the legacy `/pearls.html`; Stripe returns buyers to
`/pearls.html` (set per link in Stripe), which credits the wallet and links back. Keep the packs in step with it. There's
no server: the wallet is per browser, like the rest of Grug. Claude sessions must ask the person before spending Pearls
(`downloadR6(null, { spendPearls: true })`) and never buy Pearls for them.

## Always send the owner a preview link (not just screenshots)

Work on a branch and push it (not `main`, unless the owner says to). Cloudflare Pages builds every pushed branch at
`https://<branch>.grugdigital.pages.dev/` (lower case, anything that isn't a letter or number turned into `-`, cut to 28
characters). Get the exact addresses from the commit's **Cloudflare Pages** check once it finishes:
`gh api repos/gabrielman25/grugdigital/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | {status, conclusion, summary: .output.summary}'`
and link straight to the pages that changed. A preview also falls back to the legacy site, so old pages work there too.

## The look

Every page outside the studios wears the Grug Arcade's classic look (a 2011-style games site): a fixed 920px column over
slow pans of Grug City (`.bgfx`), the 728x90 house ad, the logo banner with the R6 crowd, the shiny green nav bar, the
orange announcement strip, dark shiny box tabs (`.StandardBoxHeader`) over light gradient boxes, shiny gradient buttons,
Arial, the social skyscrapers in the gutters, and the grey Verdana footer. No dark mode. No coloured dots next to text and
no coloured accent lines or lips (the owner finds them ugly).

- `arcade/arcade.css` + `GrugArcade.chrome()` (`arcade/arcade.js`) are the shared header, background, side ads, Pearls
  button and footer. The home page, `privacy.html` and `terms.html` use them too, with the same header/footer markup
  copied in (keep the nav in step across `index.html`, `arcade/index.html`, `arcade/place/index.html`, `privacy.html`, `terms.html`).
- `static/classic.css`: the pieces those pages add on top (`.gbtn` buttons: green, `.gray`, `.claude`, `.blue`; `.Sec`
  tabbed boxes of any width; `.chips`). `static/legal.css`: the privacy/terms document inside its box.
- `static/site.css`: the same look for the small card pages (`character/pearls/`, `tizzy/`, `itch/`, `404.html`): the city
  background fading into green, a `.site-top` logo + nav strip, boxes whose first `h2` becomes a dark shiny title bar.
- Not restyled (yet): the Avatar Studio and Building Studio themselves (generated, see below).

## The itch.io asset list (home page)

`/api/itch-assets` (`functions/api/itch-assets.js` + `src/itch/itch.js`) reads https://polysw.itch.io/ and four itch
collections (the categories, by number in `ITCH.COLLECTIONS`). itch answers 429 to bursts: keep the requests one at a
time and cached, never fan out. `static/itch-assets.json` is the fallback; see README.md. itch cover URLs are signed per
size, so only the `315x250` covers itch gives us work: don't rewrite them to other sizes.

## Grug Arcade (`/arcade/`)

Games live in `arcade/<slug>/index.html`; follow `arcade/claude.md` (no title screens, flat classic UI, retro
animations, the player wears their saved outfit via `GrugOutfitRig`, Pearls only through `GrugPearls.reward` /
`GrugPearlPopup`, never a Pearl balance on screen). Saved outfits are `static/outfits.js` (IndexedDB `grug-outfits`,
active id `grug.outfit.active`); the studio's My outfits layer is `src/character/outfits.js`, put into
`character/index.html` by `patch_outfits.py` (also run by `patch_studio.py`/`build.py`).
