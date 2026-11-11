# Partner rewards apps: the template

R&R CraftHouse Grill is the first **partner rewards app** and the reference for every one after it (a coffee shop, a
bar, another grill). A partner gets two things that work as one app:

1. **Its own rewards app** at `play/<id>/`. This is a single HTML file built from this folder. It has the full menu with
   photos, a "What should I order?" quiz, the coin welcome (strike a coin with the venue's logo), a visit-based Season
   Pass, a coin store ("added to your check", for show only), a game room, and on Home the site's FOSSIL32 cartridge
   shelf.
2. **Partner mode on the Grug site** (`assets/theme.js` `PARTNERS`). The site wears the partner's look and the app's top
   bar and tab bar, lists only the partner's own game and the Grug originals, and never leads to the standard Grug site
   or to another partner's app. The rules for it are in `CLAUDE.md` under "Partner mode".

Never edit `play/<id>/index.html` by hand: change `src/` or `partners/<id>/` and run the build.

```
tools/partner-app/
  build.py                    python3 tools/partner-app/build.py <id>   ->  play/<id>/index.html
  src/app.html                the app (shared by every partner); {{tokens}} come from the partner's config.json
  src/arena.js, src/sports.js the 3D voxel game room (stadium, court, crowd) and its three swipe sports games
  shared/icons.json           the icon pack (MIT, Voxybuns: ICONS-LICENSE.txt), only the icons used get inlined
  shared/atlas.json           the voxel block atlas (from the Grug Game Kit)
  vendor/three-r149.min.js    three.js r149 (MIT), inlined as the app's own copy
  partners/<id>/config.json   names, address, links, coin name, colours, Season Pass tiers, featured dishes
  partners/<id>/data.json     menu + menu photos + square logo (for the coin) + font, made by make_data.py
  partners/<id>/logow.json    the wide logo for the top bar: {"logo_wide": "data:image/png;base64,..."}
```

## How the pieces connect (keep these working for every partner)

- **One app, everywhere.** The top bar (`.ptb`: logo with a Demo tag, the app's coin balance, full screen, avatar) and
  the tab bar are the same in the app and on every site page. On the site, `theme.js` builds them from `PARTNERS[id]`
  before the first paint. The coin balance is read from the app's own save (`wallet.key` / `wallet.field`), so the
  numbers always match.
- **Opening the app starts partner mode.** The app writes `grug.brand.v1` = `{p: id}` to sessionStorage, so however a
  guest reaches it (QR, bookmark, shared link, the site's tab bar), the whole site follows in the partner's look for
  that tab.
- **Leaving a game returns to where it started.** Whatever launches a game (the app's cartridge shelf, the game list, a
  game page) stores itself in sessionStorage `grug.partner.back` on the `fossil32:play` event. The game's Back button
  (`#rrBack`, set by `theme.js`) goes there. Without it, Back goes to the game list, still in partner mode.
- **The Play tab** in the app goes to the site's game list (`games/?partner=<id>`). The app's own game opens with
  `play/<id>/#game`.
- **The avatar** is the site's saved one everywhere (`grug.sandy.snaps.v1`, else `assets/sandy/bust.png`). The app
  never makes its own.
- **The Grug Digital link** stays hidden until the guest finishes a game. It shows on the game-over screen, then on Home.

## Making a new partner app (example: a coffee shop, id `beanbar`)

1. **Config.** Copy `partners/crafthouse/` to `partners/beanbar/` and edit `config.json`:

   | field | what it is | CraftHouse |
   |---|---|---|
   | `id` | folder name and address (`play/<id>/`, `<id>/`, `?partner=<id>`) | `crafthouse` |
   | `name` | full venue name | `R&R CraftHouse Grill` |
   | `brand` | how the venue calls itself ("Get the R&R app") | `R&R` |
   | `short` | short name ("Only at CraftHouse", "Every CraftHouse coin…") | `CraftHouse` |
   | `label` | the venue line under its cartridge on the shelf | `R&R CraftHouse` |
   | `place`, `address`, `website` | city, street address on Home, website (menu credit) | |
   | `appStore` | the venue's own ordering app ("Get the … app" button) | Play Store link |
   | `appTitle`, `welcomeEyebrow` | the app's name in the tab title, the first onboarding line | `Game Day` |
   | `coin` | the coins' name | `Craft Coins` |
   | `storageKey` | the app's save key; must be new for every partner | `rr-crafthouse-gameday-v1` |
   | `color` | `accent` (buttons, coin gold), `accentDark`, `accentLight`, `deep` (dark panels), `deepDark`, `cream` | gold and slate |
   | `pass` | Season Pass tiers: `v` visits, `name`, `reward` (`{coin}` = the coin name), `coins`, `perk`, `skin` | 5 tiers |
   | `quizPicks`, `menuPicks` | dish names whose photos decorate the quiz and menu tiles on Home | |

2. **Menu data.** Put `menu_raw.json`, `img_data.json` (photos), `logo-square.png` and `font.woff2` in the folder. Edit
   `TAGS` in `make_data.py` for the quiz, then run `python3 partners/beanbar/make_data.py` to get `data.json`. Then make
   `logow.json` from the wide logo (a PNG about 96 px tall, as a data URL).
3. **Games.** The game room (`src/sports.js` + `src/arena.js`) is three one-minute swipe games in a voxel stadium:
   football, soccer, basketball. That fits a sports grill. For a venue that wants different games, add them to `GAMES`
   / `SPORT` in `sports.js` and make the list the app offers a config field. Every partner shares the same three games
   until then.
4. **Build.** Run `python3 tools/partner-app/build.py beanbar`. It stops and names any `{{token}}` the config is
   missing.
5. **Site.**
   - Add `PARTNERS.beanbar` in `assets/theme.js`. Copy the CraftHouse entry. It holds the name, logos, `app: 'play/beanbar/'`,
     `game`, `demo`, `wallet` (the same `storageKey`), `coin`, `font`, `colors` (`accent`, `deep`, `cream`, `page`),
     and the tab bar `bar`.
   - Put the venue's files in `play/beanbar/`: `logo.png`, `logo-bar.png` (top bar, about 218 × 96), `coin.png` (about
     132 px, the struck coin on a clear background) and the font file named in `PARTNERS.beanbar.font`.
   - Copy `crafthouse/index.html` to `beanbar/index.html` and change the id. This short address is the one to share:
     it forwards to `games/?partner=beanbar`.
   - Add the venue's game to `assets/games.js` and give it its FOSSIL32 box. Follow "Adding a game" in `CLAUDE.md`
     every time: retro title, box settings, box art, `games/beanbar/index.html`.
6. **Check it in a browser**, on a phone-sized window:
   - `beanbar/` opens the game list in the venue's look, with the venue's top bar and tab bar. Home opens the app.
   - Open `play/beanbar/` directly in a fresh tab, start a Grug original from the cartridge shelf, and press Back. It
     must land back in the app. Start one from the game list: Back returns to the list.
   - Typing the site's Home, Make or another venue's address bounces to the game list. A refresh stays in partner mode.
   - The top bar's coin count matches the app's.
