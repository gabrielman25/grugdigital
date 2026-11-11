# Partner rewards apps: the template

Every **partner rewards app** (a grill, a coffee shop, a crêperie…) is built from this folder. R&R CraftHouse Grill was
the first and Coco Crepes, Waffles & Coffee (`partners/coco/`) is the reference for a venue built on the current
template. A partner gets two things that work as one app:

1. **Its own rewards app** at `play/<id>/`. This is a single HTML file built from this folder. It has the full menu with
   photos, a "What should I order?" quiz, the coin welcome (strike a coin with the venue's logo), a visit-based Season
   Pass, a coin store ("added to your check", for show only) with app themes to spend coins on, and on Home the site's
   FOSSIL32 cartridge shelf.
2. **Partner mode on the Grug site** (`assets/theme.js` `PARTNERS`). The site wears the partner's look and the app's top
   bar and tab bar, lists only the partner's own game and the Grug originals, and never leads to the standard Grug site
   or to another partner's app. The rules for it are in `CLAUDE.md` under "Partner mode".

**The template has no game room of its own and no sports games.** The games are the Grug site's standard library: the
Grug originals (`standalone: true` in `assets/games.js`), plus the partner's own game once it has one (a normal entry in
`games.js` with its FOSSIL32 box, named by `game` in its `PARTNERS` entry). Home shows them as cartridges; the Play tab is
the site's game list. A partner without a game of its own (Coco, for now) simply lists the Grug originals.

Never edit `play/<id>/index.html` by hand: change `src/` or `partners/<id>/` and run the build.

```
tools/partner-app/
  build.py                    python3 tools/partner-app/build.py <id>   ->  play/<id>/index.html
  src/app.html                the app (shared by every partner); {{tokens}} come from the partner's config.json
  shared/icons.json           the icon pack (MIT, Voxybuns: ICONS-LICENSE.txt), only the icons used get inlined
  partners/<id>/config.json   names, address, links, coin name, colours, copy, themes, Season Pass tiers, featured dishes
  partners/<id>/quiz.json     the "What should I order?" questions
  partners/<id>/data.json     menu + menu photos + square logo (for the coin) + font(s), made by make_data.py
  partners/<id>/logow.json    the wide logo for the top bar: {"logo_wide": "data:image/png;base64,..."}
```

(`play/crafthouse/index.html` was built from the older template, which had a voxel stadium with three swipe sports
games; it is left as it is. Rebuilding CraftHouse now gives the library-only version: its config and quiz are up to
date. The old game room is in git history before the Coco commit.)

## How the pieces connect (keep these working for every partner)

- **Rewards are digital only.** Never offer free food, drinks, discounts or anything that costs the venue money. Season
  Pass tiers give coins and app themes. Coins buy app themes in the Coins tab (and power-ups in the partner's own game,
  once it has one). Coins a guest buys are added to their check, which brings the venue money.
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
- **The Play tab** in the app goes to the site's game list (`games/?partner=<id>`). Opened as a single file off the
  site, Home and Play show a card that opens the site instead.
- **The avatar** is the site's saved one everywhere (`grug.sandy.snaps.v1`, else `assets/sandy/bust.png`). The app
  never makes its own.
- **The Grug Digital link** stays hidden until the guest starts a game from the shelf; then it shows on Home.

## Making a new partner app (example: a coffee shop, id `beanbar`)

1. **Config.** Copy `partners/coco/` to `partners/beanbar/` and edit `config.json`:

   | field | what it is | Coco |
   |---|---|---|
   | `id` | folder name and address (`play/<id>/`, `<id>/`, `?partner=<id>`) | `coco` |
   | `name` | full venue name | `Coco Crepes, Waffles & Coffee` |
   | `brand`, `short` | how the venue calls itself; the short name ("Every Coco coin…") | `Coco` |
   | `label` | the venue line under its cartridge on the shelf | `Coco Crepes` |
   | `place`, `address`, `website` | city, street address on Home, website | |
   | `appStore` | where "order ahead" goes (the venue's ordering app or site) | Toast online ordering |
   | `appTitle`, `welcomeEyebrow` | the app's name in the tab title, the first onboarding line | `Crêpe Club` |
   | `coin` | the coins' name | `Coco Coins` |
   | `storageKey` | the app's save key; must be new for every partner | `coco-crepes-crepeclub-v1` |
   | `menuIcon` | the Menu tab's icon (from `shared/icons.json`; add the same one to `PBAR_ICONS` in theme.js) | `cup` |
   | `color` | `accent` (buttons, coin gold), `accentDark` (eyebrows), `accentLight`, `deep` (dark panels), `deepDark`, `cream` | gold and chocolate |
   | `copy` | the venue's wording: `welcomeTitle`, `welcomeSub`, `passLabel`, `passDone`, `favTitle`, `favLabel`, `quizCta`, `menuCredit`, `orderTitle`, `orderSub`, `mintLine`, `staff` ("your server", "the team"), `bill` ("check", "order") | |
   | `themes` | app themes: `id`, `name`, `deep`, `deepDark`, optional `accent`, `line`, and `price` in coins (no price = Season Pass only). The first is the starting look. | 5 themes |
   | `pass` | Season Pass tiers: `v` visits, `name`, `reward` text (`{coin}` = the coin name) and what it gives: `coins`, `theme` (an id from `themes`) | 5 tiers |
   | `coinUses` | the "What coins do" cards: `[icon, title, text]` | 2 cards |
   | `quizPicks`, `menuPicks` | dish names whose photos decorate the quiz and menu tiles on Home | |

2. **Menu data.** `make_data.py` needs `menu_raw.json`, `img_data.json` (photos), `logo-square.png` (the logo, dark on
   white, for the coin), `font.woff2` and optionally `font-display.woff2` (a heading face). Coco's `fetch_menu.py` makes
   the first two from the venue's website (its menu page carries every dish and photo as JSON-LD); write one like it for
   the next venue. Tag the dishes in `TAGS` in `make_data.py` (free-form `key=value` tags), write the questions in
   `quiz.json` against those tags (the format is at the top of the Quiz in `src/app.html`), then run
   `python3 partners/beanbar/make_data.py` to get `data.json`. Make `logow.json` from the wide logo (a PNG 96 px tall,
   as a data URL). `img_data.json` isn't kept in git.
3. **Build.** Run `python3 tools/partner-app/build.py beanbar`. It stops and names any `{{token}}` the config is
   missing.
4. **Site.**
   - Add `PARTNERS.beanbar` in `assets/theme.js`. Copy the Coco entry. It holds the name, logos, `app: 'play/beanbar/'`,
     `game` (only once the venue has its own game), `demo`, `wallet` (the same `storageKey`), `coin`, `font`, optional
     `fontDisplay`, `colors` (`accent`, `deep`, `cream`, `page`), and the tab bar `bar`.
   - Put the venue's files in `play/beanbar/`: `logo.png`, `logo-bar.png` (top bar, 96 px tall, about 220–260 px wide so
     the bar fits a 375 px phone), `coin.png` (132 px, the struck coin on a clear background: read it from the app's
     `--coin` CSS variable once the coin is struck) and the font files named in `PARTNERS.beanbar`.
   - Copy `coco/index.html` to `beanbar/index.html` and change the id and names. This short address is the one to
     share: it forwards to `games/?partner=beanbar`.
   - When the venue gets its own game: add it to `assets/games.js` with its FOSSIL32 box (follow "Adding a game" in
     `CLAUDE.md` every time: retro title, box settings, box art, `games/beanbar/index.html`) and set `game` in its
     `PARTNERS` entry. It then leads the shelf with an "Only at …" ribbon.
5. **Check it in a browser**, on a phone-sized window:
   - `beanbar/` opens the game list in the venue's look, with the venue's top bar and tab bar. Home opens the app.
   - Open `play/beanbar/` directly in a fresh tab, start a Grug original from the cartridge shelf, and press Back. It
     must land back in the app. Start one from the game list: Back returns to the list.
   - Following a link to the site's Home, Make or another venue's game bounces to the game list. A refresh stays in
     partner mode.
   - The top bar's coin count matches the app's.
