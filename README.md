# Grug

The Grug game site: https://grugdigital.pages.dev/

Games built with Katy restaurants, one local profile (no accounts), a 3D avatar that shows up in every game, and a closet of clothes earned by playing or by eating at a partner. Hosted on Cloudflare Pages (deploys automatically on every push to `main`); everything is static HTML. The old GitHub Pages address forwards here.

## Map

- `index.html` — home (game tiles, your avatar). `games/` lists them; `games/<id>/` is each game's page. Every game is shown as a 3D **FOSSIL32** cartridge box (see below).
- `avatar/` — the 3D avatar editor. `shop/` — every closet item and how to earn it. `profile/` — name, stats, points at each partner, settings, **export / import** of the profile as JSON (moves everything, points included, to another phone).
- `partners/` — the "for restaurants" pitch, our work and contact (the old front page).
- `play/<name>/` — the partner rewards apps, moved here from their own repos: `yoshi`, `cielito`, `teahouse`, `soluna`. Each old URL redirects here and keeps `?tap=` NFC links and `#store/tab` hashes.
- `play/runway/` — Runway Ready, a Grug original with no restaurant: a slim host page stands in for a rewards app (Pearls only, no partner points). Games like this have `standalone: true` in `assets/games.js`; copy the folder to host another one.
- `work/` — concept sites, screenshots and pitch packs. `community/` — neighborhood photos and the map.

## Shared code (`assets/`)

- `catalog.js` — the closet: every item, its slot, how it's earned (free / partner points / milestone). Add items here.
- `avatar3d.js` — builds and animates the blocky avatar with three.js (`three.min.js`, r159, MIT). Used by the site pages, the closet thumbnails and the match-3 games' "chef".
- `grug.css` + `theme.js` — the kubii look: a flat off-white (light) or off-black (dark) background tinted by the theme, Light / Dark / Auto and six colour themes (Tropical, Lagoon, Papaya, Hibiscus, Orchid, Coconut). Load `theme.js` in `<head>` right after `grug.css` so the theme is set before first paint. The choices are saved in the profile's `prefs` and change from the gear in the top bar or from Profile → Appearance.
- `grug.js` — the local profile (`localStorage` key `grug.profile.v1`), milestones, points reader, export/import, shared header + tab bar. `games.js` is the game list.
- `grug-app.js` / `grug-app.css` — the Grug layer inside a partner app (closet section, avatar chip, milestone hooks). `chef.js` — the avatar inside the match-3 games.
- `icons.js` — Phosphor Icons 2.1.1 (MIT), bold weight.
- `fossil32/` — the FOSSIL32 boxes: `fossil32.js` (built from `tools/fossil32/src/`, three.js r170 bundled in) turns every `[data-f32="<id>"]` tile into a floating 3D cartridge box. Tapping one fades to white, pulls the cartridge out and shows the game panel; Play puts the cartridge in the console, zooms into the screen and opens the game. `Grug.ui.boxTile(game)` writes the tile. Rebuild with `cd tools/fossil32 && npm install && npm run build`.
- `boxart/` — each game's 1580×950 cover art (the avatar in an action pose over a shot of the game) and back-of-box screenshots. Made with `tools/boxart/` (see its README).

## Adding a game or partner app

1. Drop the app at `play/<name>/index.html` and add it to `assets/games.js` (title, partner, `storageKey`, thumbnail). Give it its FOSSIL32 box: a retro title and tagline, `features`, `box` (catalog code, cartridge colour, title font) and box art with the avatar in an action pose. The full checklist is in `CLAUDE.md` → "Adding a game", and the art tools in `tools/boxart/README.md`.
2. Load the Grug scripts in the app and call `GrugApp.init({...})` at the end of its script; call `GrugApp.onCheckin()` on check-ins and `GrugApp.onScore({score, level})` when a run ends. Add a `<div id="closet" class="grug-closet" hidden></div>` in the Rewards tab. The match-3 and Teahouse apps show the pattern.
3. Add its closet items to `assets/catalog.js` with `get: {type:'points', app:'<name>', cost}` or `{type:'milestone', app:'<name>', stat, value, text}`.

## Credits

three.js (MIT), Phosphor Icons (MIT), Baloo 2 (OFL, Google Fonts). FOSSIL32 cartridge model: "Game Cartridge" by Pavel Kutejnikov (Drumdorf), CC BY 4.0, modified. Box title fonts (OFL, via Fontsource): Bungee, Luckiest Guy, Press Start 2P, Titan One, Bowlby One, Righteous; Outfit and JetBrains Mono for box text. Neighborhood photos: Unsplash. Map © OpenStreetMap contributors. Shop photos and logos belong to each shop.
