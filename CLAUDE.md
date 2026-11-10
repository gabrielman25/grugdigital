# Notes for Claude sessions working on this repo

The Grug game site (static HTML, Cloudflare Pages, deploys on push to `main`). See `README.md` for the map of the site.

## The look: Model Kit's theme, one accent per section

The site uses the same look as **Model Kit** (Grug Digital's editor, `create/modelkit/`): flat neutral greys, **Fredoka**
for all text, flat solid accents with a darker "lip" shadow (no gradients), and `#1E1B16` text on anything filled with an
accent. **Light mode is the default** (`#F3F3F5` page, white cards); dark (`#17171A` page, `#232327`/`#26262B` cards) is
picked with the sun/moon button in the top bar, Settings or Profile (`profile.prefs.mode`). Colours come from variables
in `grug.css` (`--page`, `--card-solid`, `--card`, `--ink`, `--line` …): never hard-code a dark or light surface.
`--mode-text` is the accent nudged to read on the current background (theme.js), for accent text and focus rings.

- **Each section owns one accent** (`SECTIONS` in `assets/theme.js`, picked from the URL): Home `#9BE338`, Games
  `#7EE081`, Rewards `#FF9F5A`, Links `#5AB0FF`, Create `#4FD8C4`, Avatar `#C59BFF`, Shop `#FFBE1A`, Profile `#FF8FC2` (Pearls uses purple). theme.js sets
  `--mode` / `--mode-lo` and points the old `--sel-a` / `--sel-b` pair at the same colour, so older gradient rules come
  out solid. The dock's tab for each section uses the same colour, and the current tab fills with it.
- **Backgrounds:** every site page sits on a **very faint, static pixel pattern** (a PatternMix tile tinted with the
  section's accent at alpha 7/255, `assets/patterns/<section>.png`, 96px). Keep it faint so text always reads clearly.
  The **Rewards** and **Links** sections are the exception: solid `#17171A`, no pattern (`solid: true` in `SECTIONS`), and its pages use
  solid colours only (no gradients, blur or decoration).
- **The blue smoky fog (`assets/fogbg.js`) is only for the Games section** (`games/` and `games/<id>/`), where the
  FOSSIL32 boxes float in it, with small solid 3D cubes in Grug colours tumbling through it (no glowing orbs). It stays a
  dark stage in light mode, but the top bar, dock and menus stay white there (`html.g-chrome-light`).
- **All 3D renders at half resolution** (device pixel ratio × 0.5, capped at 2): FOSSIL32 (`RES` in its source), the
  avatar editor, the asset library previews, Model Kit's 3D views, the rewards/links builders and the fog cubes.
  Keep it that way for anything new.

## The dock: Home, Games, Me, Make

Four tabs for everyone (the role in Settings → I'm a… only changes what the home page shows first). **Me** and **Make**
are groups: tapping one opens a tray of its pages, and each has its own page (`me/`, `make/`), a plain Linktree-style
list (`Grug.ui.hub`) whose picked row fills with its colour and slides on. Me = Avatar, Shop, Profile. Make = Link page
(`links/`), Rewards card (`rewards/`), 3D models (`create/`). `DOCK_GROUPS` / `NAV` in `assets/grug.js`.
Swiping sideways anywhere (not on sliders, canvases or sideways-scrolling rows; mark others `data-noswipe`) or Q / E /
LB / RB steps Home ↔ Games ↔ Me ↔ Make, and the next page slides in from that side (`grug.swipe` → `html.g-swipe-*`).

## Shop mode (Ziosk-style)

A guest who arrives from a shop's rewards card link (`rewards/card/#c=…`, its QR or NFC sticker) sees the whole site in
that shop's name, emoji, colour and font while they browse and play (`theme.js`, sessionStorage `grug.brand.v1`,
`html[data-brand]`). A refresh, opening the site normally, or Settings → Leave ends it. Hide pitch-to-restaurants bits in
shop mode with `data-hide-brand`; `data-only-brand` shows something only then. The shop's font is picked in the card
builder (`FONTS` in `assets/rewards.js`, files in `assets/fonts/shop/`, `assets/shop-fonts.css`) and rides in the link as
an optional 9th field; in shop mode it sets `--display` (headings). Keep any new font easy to read on a phone.

## Games are FOSSIL32 cartridges

Everywhere a game is showcased (the home page games carousel, the Games page, each `games/<id>/` page) it is
shown as a floating 3D **FOSSIL32** cartridge box (Grug Digital's fantasy console). Tapping a box darkens the page and
blurs it out of focus, pulls the cartridge out and shows the game panel; **Play** drops the cartridge into the FOSSIL32
console, zooms into its screen and opens the game. A pool of the game's colour follows the cartridge the whole way.

The **Games page** is a looping vertical carousel of boxes on the left half (`Fossil32.rack`, the page drives
`state.pos`), with the selected game's details on the right (below it on phones). Scroll, swipe, arrow keys or a
controller browse; Play / Enter / tapping the front box calls `Fossil32.launch(id)` (box opens → cartridge → console → game).
The panel shows each game's short `blurb` (the full `long` write-up is on its game page); keep blurbs to a sentence or two.

The **home page** is the one place games show as bare cartridges (no box, no card and no glow behind them), in one
horizontal carousel right under the welcome message: `boxTile(g, { kind: 'cart', ribbon })` (`data-f32-kind="cart"`). The
last-played game comes first, centred, with a "Last played" ribbon; the rest follow.
Tapping a cartridge glides it straight to the game panel.

- Code: `tools/fossil32/src/fossil32.js` → bundled to `assets/fossil32/fossil32.js` (`cd tools/fossil32 && npm install && npm run build`).
  Never edit the bundle by hand. Styles: `assets/fossil32/fossil32.css`. Tiles come from `Grug.ui.boxTile(game)` in `assets/grug.js`.
- Cartridge/console models and textures are in `assets/fossil32/` (cartridge model: Pavel Kutejnikov, CC BY 4.0, keep the credit).
- The overlay's text (title, description, features) uses the site's header font in plain white on the dark stage.
  The retro lettering and colours belong on the box art only.

## Adding a game (do all of this, every time)

When a new game is added to `assets/games.js` and listed, also make its box. Don't wait to be asked.

1. **Retro title.** Give the game a box title that sounds like it came out in the 90s or early 2000s
   ("Boba Bandit", "Turbo Suds 2000", "Crypt Crawler", "Peak Pals") plus a short tagline. Put it in `title` and
   `subtitle`; keep the in-game name in `appTitle`. Don't reuse words already used by another title.
2. **Box settings** in the entry (format documented at the top of `assets/games.js`):
   - `box.code`: next free catalog number `GD-xxxx`
   - `box.shell`: the cartridge plastic colour, which also sets the box accents and the console trim. Pick one that suits the
     game and is distinct from the other games' colours.
   - `box.font`: one of Bungee, Luckiest Guy, Press Start 2P, Titan One, Bowlby One, Righteous (pick what fits the genre)
   - `box.fill`: `[top, bottom]` colours for the title's two-tone gradient on the box
   - `box.players`, `box.region` (`KATY, TX` for partner games, `WORLDWIDE` for Grug originals)
   - `features`: 3–5 short lines (what you do, what's special, how Pearls/points are used)
3. **Box art** with the avatar in an **action pose** that shows what the game is about: follow
   `tools/boxart/README.md` (capture a HUD-free background from the game, pose a Sandy avatar, composite to
   `assets/boxart/<id>.jpg`, 1580 × 950, no text). Rules: female avatar, long hair or buns only, no hats.
   Also save 1–3 back-of-box screenshots to `assets/boxart/shots/`.
4. Point `thumb` at the box art too, and add a `games/<id>/index.html` like the others (it calls `GrugGamePage('<id>')`).
5. Check it in a browser: the box on the Games page, the unbox, the panel, and Play (cartridge → console → game).

## Create tab and Model Kit

**Make → 3D models** (`create/`, cube icon) is a marketplace-style **asset library** (category list, search with
suggestions and `#tags`, genre / theme / type / triangle filters, sorting, favourites, item pages with Get, all kept in the URL;
`create/market.js`) of free preset models and scenes, made with **Model Kit**
(Grug Digital's pixel-to-3D editor, `create/modelkit/index.html`, a single prebuilt file). Previews and downloads are
built in the browser by `create/modelkit-core.js`, the editor's own mesher. Presets live in `tools/modelkit/presets/`.
After changing them, run `make-presets.js` and `thumbs.js` (see `tools/modelkit/README.md`). "Model Kit" is a working name.

## Site-wide game layer (`assets/gamekit.js`)

Every `play/<name>/game.html` loads `../../assets/gamekit.js` before its own script and gets, with no code: the UI size
zoom (Settings → UI size), the kit's `#banner` / `#toast` moved to just below dead centre and shaken in whenever they
appear or change, folded "how to play" blocks, and the Free Shop Token timer. Games call into `window.GK` for the rest:
`GK.tutorial(key, steps)` (tag shared lessons with `skill: 'move'` / `'sprint'` so they show once site-wide),
`GK.stamina` (`wantRun()`, `set(frac)`, `show(on, {button:true})`), `GK.emotes.install({canEmote})` + `GK.emotes.anim(moving)`
in the player's animation pick, `GK.crate(game)` whenever a crate, egg, loot box or daily gift opens, `GK.lockedCube` for
plots that aren't open yet (never a blank plate), `GK.prop` for low-key ≤ 1-block props with no collision, and `GK.pet`
for a flashy pet on one or two bots. Players land straight in the game: no lobby screen. The power-up shop opens from a
Shop button in the HUD / pause menu (`lobby()` in run mode) and from the run-over screen.

