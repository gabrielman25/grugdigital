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
- **The blue smoky fog (`assets/fogbg.js`) is only for the Games section** (`games/` and `games/<id>/`) **in dark mode**,
  where the FOSSIL32 boxes float in it. In light mode the Games pages are a plain white page with black text. The small
  solid 3D cubes in Grug colours tumble on the Games pages in both modes (no glowing orbs).
- **All 3D renders at half resolution** (device pixel ratio × 0.5, capped at 2): FOSSIL32 (`RES` in its source), the
  avatar editor, the asset library previews, Model Kit's 3D views, the rewards/links builders and the fog cubes.
  Keep it that way for anything new. The one exception is the avatar editor's stage: it's a still picture (redrawn only
  when the look changes), so it renders at full resolution.

## Keep friction low

Simplicity is a goal in itself: no dead ends (carousels loop, nothing hits a hard stop), no scrolling inside panels that
should be static, and nothing on screen that doesn't help the person do the next thing. **Icons are one flat style
everywhere** (`Grug.icon`: the @icons simple set, then Phosphor bold); there are no colourful icon pictures and no emoji in
the interface. The top bar shows only the logo, the page name, the Pearls count, a full screen button and the person's avatar (no name); Settings
and the dark-mode switch live in the account menu under the avatar.

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

## Partner mode (CraftHouse mode)

A full partner can have its own branded, closed version of the site. Its address (`crafthouse/`, which forwards to
`games/?partner=crafthouse`; any page takes `?partner=<id>`) starts **partner mode**, which must feel like one app and
must never lead to the standard Grug site or another partner's rewards app:

- The top bar is the partner app's own bar, identical on every page and in the app (`.ptb`: logo with Demo tag, the app's
  coin balance, full screen, avatar). theme.js puts it and the tab bar into the page the moment `<body>` exists, so there is
  no skeleton swap; grug.js only wires them up. The avatar picture everywhere (site and app) is the site's saved one
  (`grug.sandy.snaps.v1`, else `assets/sandy/bust.png`). The `.ptb` CSS block is duplicated in the app: keep both identical.
- The Grug dock is hidden; the partner app's own tab bar (`bar` in its PARTNERS entry, `.g-pbar`) is the only navigation,
  on every page (a rail on the right in short landscape; `--sab` grows by its height so layouts make room). Its Play tab is
  the site's game list; the app's own Play tab goes there too.
- Only the partner's own game and the Grug originals (`standalone: true`) are listed (`Grug.partnerAllows`). Allowed pages:
  `games/` (and those games' pages), `avatar/`, `pearls`, `rewards/card/`; every other address goes to the game list
  (theme.js), and so do other partners' game pages (grug.js). A game host's back button (`#rrBack`) returns to the list.
- The account menu is just Buy Pearls, Edit avatar and Settings; Settings has no Leave and no dark mode.
- The whole site stays in the partner's light look (no dark fog on Games), with its typeface and a faint gingham;
  the game panel and game page are centred.
- It survives a refresh and ends only when the tab closes or the site is opened normally.

Partners live in `PARTNERS` in `assets/theme.js` (`GrugTheme.partner()`); `html[data-partner]` is set while it's on.

## Games are FOSSIL32 cartridges

Everywhere a game is showcased (the home page games carousel, the Games page, each `games/<id>/` page) it is
shown as a floating 3D **FOSSIL32** cartridge box (Grug Digital's fantasy console). Tapping a box darkens the page and
blurs it out of focus, pulls the cartridge out and shows the game panel; **Play** drops the cartridge into the FOSSIL32
console, zooms into its screen and opens the game. A pool of the game's colour follows the cartridge the whole way.

The **Games page** is a looping vertical carousel of boxes on the left half (`Fossil32.rack`, the page drives
`state.pos`), with the selected game's details on the right (below it on phones). Scroll, swipe, arrow keys or a
controller browse; Play / Enter / tapping the front box calls `Fossil32.launch(id)` (box opens → cartridge → console → game).
The panel shows only the game's name, the business it was made for, its short `blurb` (the full `long` write-up is
on its game page; keep blurbs to a sentence or two), its `features` and Play. No catalog codes, tags or Live/Demo
badges, and the panel never scrolls: only the boxes do.

The **home page** opens with two half-width doors side by side (restaurant owners → `rewards/`, online creators →
`links/`; hidden in shop mode), then the avatar hello, then the games: the one place they show as bare cartridges (no
box, no card and no glow behind them), in one horizontal carousel: `boxTile(g, { kind: 'cart', ribbon })`
(`data-f32-kind="cart"`). It loops endlessly (the list three times over, quietly re-centred on the middle copy). The
last-played game comes first, with a "Last played" ribbon. Closet picks are hidden: players dress up when they choose to.
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

## Avatar editor (`avatar/`)

The stage is a **still picture**, not a live 3D view: the editor redraws it only when a slider is let go, a piece goes
on or comes off, an emote or view is picked, or the page resizes (`STILL`, `bump()`, `window.SANDY_STILL`), and nothing
sits on top of it. The only things on it are two arrows that turn her 45 degrees at a time (eight still pictures). Where the camera looks is
the **View** section (Full / Face / Feet), emotes are a **Wardrobe → Emotes** category, and "Watch her animate" (in both)
opens the **animation page**: just her, full screen and live (at half resolution), with a hotbar of animations along the
bottom; Back (or the phone's back button, `#animate`) returns to the still picture. `?mode=viewer` embeds stay live and animated.

No scrolling: `avatar/nav.js` + `nav.css` move the editor's own controls (the SANDY EDITOR script, wired by id) into
screens. A row of section icons (Body, Face, Hair, Wardrobe, Shoes, View, Save) sits over a strip you swipe through;
buttons open screens on top (Wardrobe's categories, the sliders), screens with more than fits become pages with dots, and
lists of pieces run sideways in as many rows as fit. A piece's colours, fabric and fit show only once a piece is picked.
Only a person's own swipe changes the section (the browser re-snapping after a resize doesn't). Add new controls to the
editor's markup as before, then place them in a section in `nav.js`.

## Rewards cards: icons and fonts

A shop's icon is an id from `ICONS` in `assets/rewards.js`, drawn from the flat `sh-<id>` Phosphor icons in
`assets/icons.js` (`RW.iconSvg` in the page, `RW.drawIcon` on canvases: the print, the 3D builder). Links from before
carried an emoji; `OLD` maps those to the closest icon so old cards keep working. Never put emoji back on a card.

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

