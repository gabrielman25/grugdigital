# Grug

The Grug game site: https://grugdigital.pages.dev/

Games built with Katy restaurants, one local profile (no accounts), a 3D avatar that shows up in every game, and a closet of clothes earned by playing or by eating at a partner. Hosted on Cloudflare Pages (deploys automatically on every push to `main`); everything is static HTML. The old GitHub Pages address forwards here.

## Map

- `index.html` — home (Roblox-style game tiles, your avatar). `games/` lists them; `games/<id>/` is each game's page.
- `avatar/` — the 3D avatar editor. `shop/` — every closet item and how to earn it. `profile/` — name, stats, points at each partner, settings, **export / import** of the profile as JSON (moves everything, points included, to another phone).
- `partners/` — the "for restaurants" pitch, our work and contact (the old front page).
- `play/<name>/` — the partner rewards apps, moved here from their own repos: `yoshi`, `cielito`, `teahouse`, `soluna`. Each old URL redirects here and keeps `?tap=` NFC links and `#store/tab` hashes.
- `play/runway/` — Runway Ready, a Grug original with no restaurant: a slim host page stands in for a rewards app (Pearls only, no partner points). Games like this have `standalone: true` in `assets/games.js`; copy the folder to host another one.
- `work/` — concept sites, screenshots and pitch packs. `community/` — neighborhood photos and the map.

## Shared code (`assets/`)

- `catalog.js` — the closet: every item, its slot, how it's earned (free / partner points / milestone). Add items here.
- `avatar3d.js` — builds and animates the blocky avatar with three.js (`three.min.js`, r159, MIT). Used by the site pages, the closet thumbnails and the match-3 games' "chef".
- `grug.css` + `theme.js` — the kubii look: frosted glass over a slow wavy backdrop (`backdrop.jpg`, recoloured per theme), Light / Dark / Auto and six colour themes (Tropical, Lagoon, Papaya, Hibiscus, Orchid, Coconut). Load `theme.js` in `<head>` right after `grug.css` so the theme is set before first paint. The choices are saved in the profile's `prefs` and change from the gear in the top bar or from Profile → Appearance.
- `grug.js` — the local profile (`localStorage` key `grug.profile.v1`), milestones, points reader, export/import, shared header + tab bar. `games.js` is the game list.
- `grug-app.js` / `grug-app.css` — the Grug layer inside a partner app (closet section, avatar chip, milestone hooks). `chef.js` — the avatar inside the match-3 games.
- `icons.js` — Phosphor Icons 2.1.1 (MIT), bold weight.

## Adding a game or partner app

1. Drop the app at `play/<name>/index.html` and add it to `assets/games.js` (title, partner, `storageKey`, thumbnail).
2. Load the Grug scripts in the app and call `GrugApp.init({...})` at the end of its script; call `GrugApp.onCheckin()` on check-ins and `GrugApp.onScore({score, level})` when a run ends. Add a `<div id="closet" class="grug-closet" hidden></div>` in the Rewards tab. The match-3 and Teahouse apps show the pattern.
3. Add its closet items to `assets/catalog.js` with `get: {type:'points', app:'<name>', cost}` or `{type:'milestone', app:'<name>', stat, value, text}`.

## Credits

three.js (MIT), Phosphor Icons (MIT), Baloo 2 (OFL, Google Fonts). Neighborhood photos: Unsplash. Map © OpenStreetMap contributors. Shop photos and logos belong to each shop.
