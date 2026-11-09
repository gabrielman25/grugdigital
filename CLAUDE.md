# Notes for Claude sessions working on this repo

The Grug game site (static HTML, Cloudflare Pages, deploys on push to `main`). See `README.md` for the map of the site.

## The look: always dark, blue smoky fog

Every site page (not the games under `play/`) sits on a blue smoky fog with little lights trailing through it, drawn by
`assets/fogbg.js` (theme.js loads it). There is no light mode. A colour theme (Settings → Lights; `THEMES` in
`assets/theme.js`, default `classic`) sets the colours of the lights (`orbs`) and the button accent; the fog and every
neutral stay blue. Cards and bars are dark see-through glass so the fog shows through. Don't add white page backgrounds.

## Games are FOSSIL32 cartridges

Everywhere a game is showcased (the home page games carousel, the Games page, each `games/<id>/` page) it is
shown as a floating 3D **FOSSIL32** cartridge box (Grug Digital's fantasy console). Tapping a box darkens the page and
blurs it out of focus, pulls the cartridge out and shows the game panel; **Play** drops the cartridge into the FOSSIL32
console, zooms into its screen and opens the game. A pool of the game's colour follows the cartridge the whole way.

The **Games page** is a looping vertical carousel of boxes on the left half (`Fossil32.rack`, the page drives
`state.pos`), with the selected game's details on the right (below it on phones). Scroll, swipe, arrow keys or a
controller browse; Play / Enter / tapping the front box calls `Fossil32.launch(id)` (box opens → cartridge → console → game).
The panel shows each game's short `blurb` (the full `long` write-up is on its game page); keep blurbs to a sentence or two.

The **home page** is the one place games show as bare cartridges (no box, no card behind them), in one horizontal
carousel right under the welcome message: `boxTile(g, { kind: 'cart', ribbon })` (`data-f32-kind="cart"`). The
last-played game comes first, centred, glowing in its cartridge colour with a "Last played" ribbon; the rest follow.
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
