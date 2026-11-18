# Notes for Claude sessions working on this repo

The Grug game site (static HTML, Cloudflare Pages, deploys on push to `main`). See `README.md` for the map of the site.

## Always send the owner a preview link (not just screenshots)

Whenever a session changes the website, the owner wants a **link to a live page they can open and click through**, not
only screenshots. Screenshots are a nice extra, never the substitute.

- Work on a branch and push it (not `main`, unless the owner says to). Cloudflare Pages builds every pushed branch:
  - **Branch preview:** `https://<branch>.grugdigital.pages.dev/` (the branch name in lower case, anything that isn't a
    letter or number turned into `-`, cut to 28 characters). It always shows the newest push to that branch.
  - **Commit preview:** `https://<first 8 of the deploy id>.grugdigital.pages.dev/`, fixed to one build.
- Get the exact addresses from the commit's **Cloudflare Pages** check once it finishes (a minute or two after the push):
  `gh api repos/gabrielman25/grugdigital/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | {status, conclusion, summary: .output.summary}'`
  (the summary holds "Preview URL" and "Branch Preview URL"). Wait for `conclusion: success`; if it fails, say so and
  include the "View logs" link instead.
- In the final summary, link **straight to the pages that changed** on the branch preview (for example
  `https://my-branch.grugdigital.pages.dev/games/welcome/`), one link per thing to try, with a few words on what to look at.
- A preview is its own web address, so its saved data starts empty: first-visit flows (the games onboarding, Start over,
  a fresh closet) show as they would for a brand new player. Say so when it matters.

## Browser caching on grugdigital.com

Cloudflare → Caching → Browser Cache TTL is set to **Respect Existing Headers** (since Nov 2026), so browsers get Pages'
own `max-age=0` and check for new files on every visit. Before that it kept scripts and pictures for 4 hours, which is
why the shared scripts and the default avatar pictures carry `?v=av2`. The tags are harmless; leave them. If that
setting is ever changed back, bump the tag across the site whenever a shared script or picture changes.

## The apps: Grug, Daypart, Bubble Tea and Café (they update themselves with the site: keep it that way)

The site installs as four apps from one address, each with its own home-screen icon: **Grug** (the whole games side:
home, the game store, every game the store lists, the Carts, the avatar editor with the classic editor and closet,
the games onboarding, Me and Make; `app/grug.webmanifest`, opens `/?pwa=grug`) and **Daypart** (the restaurant side:
dashboard, website editor, rewards card, owners' link; `app/daypart.webmanifest`, opens `/business/?pwa=daypart`).
Both cover the whole site (scope `/`), so the dock's tabs stay inside the app. **Bubble Tea** and **Café** are the shop
dashboards (`business/tea/`, `business/cafe/`; `app/tea.webmanifest`, `app/cafe.webmanifest`, opening
`/business/<id>/?pwa=<id>`, scope their own folder): see "The shop dashboards" below. The owner wants the installed apps to
**always get every update to the site, and every new game**, without anyone doing anything on the phone.

**How an update reaches an installed app**
1. You change the site and run `python3 tools/pwa/build.py`. It writes `app/offline.json`: every file each app keeps on
   the device, grouped in packs (`grug`; one `game:<id>` per game the store lists; `carts`; `daypart`; `tea`; `cafe`), each file with a
   fingerprint of its contents. Commit `app/offline.json` **in the same commit** as the change.
2. Safety net: the **Offline list** GitHub Action (`.github/workflows/offline-list.yml`) runs the same build on every
   push and commits `app/offline.json` back if it was stale. If it did, your next push is rejected as behind: run
   `git pull --rebase` and push again. Running the build yourself first avoids that.
3. Cloudflare Pages deploys. The installed app's service worker (`sw.js`) fetches `app/offline.json` when the app opens,
   when the connection comes back and every half hour, then downloads only the files whose fingerprint changed, adds new
   packs (a new game: "New game ready to play offline") and drops files no pack lists. An open page that is now older
   offers **Refresh**. Online, every page and file comes from the site first anyway, so nobody ever sees a stale version.

**Rules**
- **Never edit `app/offline.json` by hand.** `python3 tools/pwa/build.py --check` says whether it's current.
- **A new game:** add it to `assets/games.js` as usual (original, listed) and it becomes its own pack by itself. The
  build downloads exactly what the store lists on the main site, using the same rule as `partnerOk()` in grug.js (Grug
  originals; a business's game is a demonstration and never in a pack). If that rule changes, change the build to match.
- **A game that builds file names in code** (`'sounds/' + name + '.mp3'`): the build finds paths written in pages,
  scripts, styles and data, and whole small folders when a path ends at the folder. If it still can't see a file, add it
  to `EXTRA` (or the folder to `COMPANIONS`) in `tools/pwa/build.py`. Anything missed still works online and is saved the
  first time it loads, but it won't be there offline before that.
- **A new page on the games side:** add it to `GRUG_PAGES` in `tools/pwa/build.py` (restaurant side: `DAYPART_PAGES`).
- **Check it** after changing `sw.js`, `app/app.js`, the build, a page's or a game's loading: `node tools/pwa/check.js`
  (Playwright + Chrome) installs both apps in headless Chrome, turns the network off, opens every page, presses Play on
  every game from its store page, opens every cart, and tests the update check. It must end "All good".
- Never rename `app/offline.json`, `sw.js` or the cache names in `sw.js`, and never change a manifest's `id`: installed
  apps on people's phones depend on them.

**The Download buttons** (`app/app.js`): `<button data-get-app="grug|daypart|tea|cafe" hidden><span data-app-ic></span>Download</button>`
and `<div data-app-card="grug|daypart|tea|cafe" hidden></div>` (the card: what you get, its size, Download). Both hide inside the
installed app, in shop and partner mode, and once the app is installed in that browser. With `data-app-status`, the
card shows inside the app what's saved, when it last checked, and **Check for updates**. They are on the home page (hero
and under the games), the store's top row, Me (with status), the dashboard's Home and Settings (with status), and the
account menus. Download opens the browser's own install prompt where there is one, and a short how-to elsewhere
(iPhone and iPad: Share → Add to Home Screen).

- **iPhone and iPad keep an installed app's save apart from Safari.** The how-to offers **Save a copy** (every
  `localStorage` key except Pearls, as a `grug-device` file) and the app's first launch offers **Load a copy**.
  **Pearls never move**, and `pearls.html` turns purchases off inside the iPhone/iPad app (Stripe's checkout opens
  outside it, so the Pearls could land in Safari): buy them in Safari. Keep both rules unless the owner decides otherwise.
- Mature games download only when the device's birthday is 18+. Opening the Grug app always switches to the player
  account (theme.js reads `?pwa=grug`); Daypart opens the dashboard, which switches to the restaurant account.
- `offline.html` is what a page that was never saved shows with no connection. Icons: `app/icons/`
  (`node tools/pwa/icons.js [names]` redraws them: the Grug dino on green; the dashboard's four tiles on ink; a boba cup on
  taro purple; a coffee cup on caramel. Name only the apps you changed so the others keep their exact bytes).

## Frozen: everything made for a named business is a demonstration (read this first)

No business has signed off on its pages yet, so **every page that carries a business's name, logo, menu or photos is a
demonstration only**, kept apart from the main site. This overrides anything further down that says otherwise (venue
coins paying in games, Pearls in a wrap, check-ins stamping visits, "partners", the Rewards apps button…). Keep it this
way until the owner says a business has agreed in writing.

- **`assets/demo.js`** is the freeze: `GRUG_DEMO.install(name, id)` shows a "Demonstration only" notice once per tab and a
  chip that stays on the page. `LIVE` in that file is the (empty) list of businesses that have signed off.
- **Nothing is earned, bought, spent or redeemed on a branded page.** No Pearls, no coins, no points, no food, drinks or
  discounts, no memberships. Where it is enforced: `FROZEN` in `tools/partner-app/src/app.html` (rebuild the apps after
  editing it), in `play/crafthouse/`, in the older apps (`play/yoshi|cielito|pera/`, `work/another-round|citrino|fuji-tea|
  yan-tea-cafe/`: their Rewards / Membership / Store / Live tabs are shown but inert), and in `assets/gamehost.js` (a game
  with `brand`, or any game opened inside a wrap, refuses every purchase and shows no Pearls or coins).
- **The main site never shows a business's game or app.** `Grug.partnerAllows` lists only Grug originals outside a wrap;
  a wrap lists its own games plus the originals. The Rewards apps button stays hidden, the Pearls page is not reachable
  from a wrap, and closet designs tied to a business (`frozen` in `assets/catalog.js`) can't be earned.
- **Wording:** never call a business a "partner" or say a game was "made with" it on the main site. The demonstrations
  are reached from `partners/` (the "For restaurants" page), which carries the disclaimer.
- **Never promise a membership, a Pass or a price** for something that isn't on sale (Grug Gold on `pearls.html` is
  the one membership on sale, see "Grug Gold" below; the Pass was removed from `partners/`).
- **No PeerJS and no connection between browsers.** The live menu board link and Sunrise to Sunset's "Together" are off.
- **Say where a business's material came from.** `GRUG_DEMO.install(name, id, source)` adds a "Where this came from"
  line to the notice: the partner apps pass `copy.menuCredit`, a wrap and a venue's game pass `source` from its `PARTNERS`
  entry (Coco's names cococrepes.com). Give any new business the same.

## Money rules for the Grug originals

- **Nothing random is ever paid for.** Pearls never buy a crate, an egg, a loot box, better odds, or the in-game
  currency that crates and eggs cost (no coin packs, coin doublers or coin passes for Pearls in a game whose coins buy
  crates). A role or item bought with Pearls is a sure thing, never a chance. The Carts follow the same rule: the copies in
  `games/carts/` were patched by hand for it, so **make the same change in `grug-game-kit/micro` before the next build**
  (Egg Heist: no `cash2`, no `double_away`; Smash: no `coins2`; Pizza: the parrot costs coins, not Pearls).
- The Discord feed (`Grug.announce`) says "A player", never the display name. The privacy policy promises that.
- When a page starts loading anything from another host, storing something new, or the host changes, update
  `privacy.html` in the same change. Third-party work is credited on `credits.html`.
- The picture prints (`assets/prints/`: the 10 quick prints and the icon pack) were removed; the avatar's chest prints are
  the drawn shapes only. Don't bring picture prints back without a licence on file.

## Grug Gold, the membership (`pearls.html`, `CLUB` in its script)

- Sold on Gumroad as a monthly membership (grug3d.gumroad.com/l/tsbrmm, $3 a month, no free trial). Gumroad gives
  each member a **license key**; they paste it on the Pearls page, which asks Gumroad's public license check
  (`api.gumroad.com/v2/licenses/verify`, called from the browser, no secret) whether it's active. No server.
- Active means not refunded, charged back or disputed, and `subscription_cancelled_at` / `_failed_at` / `_ended_at` empty
  or still in the future. It is checked again every 12 hours on the Pearls page and right before monthly Pearls are claimed;
  an answer older than 4 days switches the perks off until the next check. One key works on `maxPhones` phones (uses count).
- **`assets/gold.js` (`GrugGold`)** holds `CLUB` (product, price, trial, perks), the Gumroad check and the member test,
  shared by every page with a perk. `GrugGold.ensure()` right before handing out a perk (it asks Gumroad again when the
  last answer is over 12 hours old); `GrugGold.offer(what)` is the "that's a Grug Gold perk" dialog.
- Perks (one card each on the Pearls page, `PERKS` in its script): `monthly` Pearls once per calendar month (claimed on the
  page, starting after `trialDays` so a free week can't be cashed in), `+bonus`% on every Pearl pack, **OBJ, STL and
  project downloads in the 3D models library** (`create/market.js`, `FMTS`; GLB stays free for everyone), a member badge.
  If the price, trial or perks change on Gumroad, change `CLUB` to match, and the terms ("Grug Gold membership") if the
  rules change. `productId: ''` hides it all again.
- **Only the 3D library is sold.** The closet's clothing is free to download for everyone, member or not (the owner isn't
  sure the clothing can be sold): every design's template, and the garment in 3D as GLB / OBJ / STL
  (`assets/export3d.js`, which builds it with the classic kit; the garment meshes are CC0). Hats are not downloadable:
  Chibi Hats by PaperPluto has no licence on file for handing out the files.
- The Model Kit editor (`create/modelkit/`) can still export any preset in every format; it isn't gated.
- It never reaches a branded page: no memberships there (the freeze above).

## Mature games and the games onboarding

- **What's allowed:** a game may be rated mature for violence, horror, strong language or suggestive themes only.
  Sexually explicit games are never accepted on this site (Stripe, GitHub and age-verification laws). The age check is
  a neutral age screen on the device, not ID verification. There is still no server and no account.
- **Rating fields** (`assets/games.js`, documented at its top; `assets/carts.js` takes the same): `rating: 'mature'` and
  `contains: ['Violence', ...]`. Everything goes through **`Grug.age`** in `assets/grug.js` (`birthday()`, `isAdult()`,
  `canSee(g)`, `tag(g)`, `setBirthday(s)`); never do age maths anywhere else. `Grug.partnerAllows(g)` includes `canSee`,
  so every list that already uses it (store rows, featured, Discovery Queue, Browse all and search, Favorites, the home
  carousel, recommendations, the stamp card page) hides mature games where they can't be shown.
- **Adults** see a mature game everywhere like any other, with an **18+ tag** (`Grug.age.tag`, `.g-rated`: a plain label,
  never imagery) on its card, box (the 3D box draws its own plain "18+" label, `tools/fossil32/src/fossil32.js`) and game
  page, which also lists `contains`. **Under 18**, or with no birthday, it is hidden everywhere, and its `games/<id>/` and
  `play/<id>/` pages show "This game isn't available" with a way back to the store (`Grug.ui.unavailable`); the game frame
  never loads. **Shop mode and partner mode never show one**, whatever the age (the partner apps' shelf filters them too:
  `tools/partner-app/src/app.html`). The Discord feed (`Grug.announce`) and the link previews (`tools/og/build.js`) never
  feature one.
- **The birthday** lives in `profile.prefs.birthday` ('YYYY-MM-DD') on the device only. Settings (and Profile) show it and
  change it (`Grug.ui.birthdayHtml`). **The change rule:** a birthday under 18 can be raised to 18+ once per device (for
  typos); after that it can only go down until the site's data is cleared. Lowering is always allowed. The per-device record
  is `grug.age.v1` (`{bd, raised}`), which Start over and a profile import don't reset (Start over keeps the birthday; an
  import that would raise it a second time is put back). Change the rule in `setBirthday` / `syncAge` in grug.js.
- **The games onboarding** (`games/welcome/?next=…`): the first time a device opens anything games-related (`games/` and
  everything under it, a game's `play/<dir>/`, a shared direct link, the home page's Play buttons, the dock's Games tab), it
  goes through four screens first: the player's own birthday first (required; no default year, nothing said about what it
  unlocks), then their character (the avatar's four skins, pictures in `assets/avatar/skins/`), a hat or none (pictures in
  `assets/avatar/hats/`), then on to where they were going (the store by default). Character and hat each have **Skip**, and
  **Skip all** goes straight on: only the birthday is required. A pick changes the saved avatar straight away
  (`Grug.setLook`). Finished =
  `profile.seen.onboarded` plus a birthday; it never shows again. Settings → Your character → **Set up again** replays it
  (`&redo=1`). `Grug.onboard` (grug.js) has the gate; `fossil32.js` asks it before a Play boots the console. Pages inside a
  frame (the showcase) skip it. `games/carts/` has no grug.js, so it loads `assets/onboard-gate.js` (the same check): that
  line was patched into the built feed by hand, **add it to `grug-game-kit/micro` before the next build**.
- **Clothing fit** (classic avatar only: the custom-clothing block at the end of `assets/sandy-classic.js`): pants made from a closet design
  ease out 0.6 cm all over so no body shows through (the male body's thighs did), and their waistband tucks in only above
  the hem of a T-shirt or long-sleeve tee worn over them (`hemOf`). With no shirt over the waist it is never tucked:
  that sank it into the body and showed skin at the waist. Check any change to that block with renders of both bodies in
  shorts and pants, with no top, the T-shirt and the long-sleeve tee.
- **The placeholder** `placeholder18` (games.js, `games/placeholder18/`, `play/placeholder18/`, `assets/boxart/placeholder18.jpg`)
  is a blank 18+ game for previewing all of this. Remove those four before launch.

## Contact us (`assets/contact.js`)

Grug Digital's own contact details (Discord, Instagram, text number, email) live in `GRUG_CONTACT` at the top of
`assets/contact.js`, and only there. Every dashboard has a **Contact us** button in its top bar (Daypart, Bubble Tea, Café;
not on a locked staff kiosk), and the restaurant account's menu has it on the site's pages. An empty field is left out.
The site says texts only, no calls: keep the text row a text (`sms:`).

## The restaurant dashboard's notices (`business/index.html`)

- `LEGAL` holds one plain warning per record-keeping app (schedule, clock, team, temps, checklists, expirations,
  recipes), shown as a yellow banner at the top of that app's main view, never on the locked staff kiosk. A new app
  that keeps records, pay or safety information gets an entry.
- `legalGate()` is a one-time "Before you start" screen: it shows after setup until the owner ticks the box and taps
  Continue (`meta.legalAckAt`). The tour waits for it. Home ends with a one-line "record-keeping aid" footer.

## The showcase (`showcase/index.html`)

Built by `python3 tools/showcase/build.py showcase showcase/index.html`; never edit the output. The build lags the site:
it doesn't pack FOSSIL32 (`assets/fossil32/`) or load the cursors, so the 3D cartridges don't appear inside it. Rebuild it
after any change to the pages it packs.

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
- **The cursor** is the restaurant dashboard's drawn outline set (Kenney Cursor Pack) on every page and game:
  `assets/cursors.js`, loaded once by theme.js, grug.js or gamekit.js (and by the partner app template). It swaps only the
  plain cursors (default, pointer, not-allowed, grab, grabbing, wait) in stylesheets and in code (`el.style.cursor = …`), so
  a page or game that picks its own cursor (an image, `none`, crosshair…) keeps it. Write `cursor:pointer` as usual.
  Left out on purpose: shops' own websites (`site/`, `work/`), which aren't Grug pages.
- **Scrollbars** are a thin rounded pill everywhere (grug.css; cursors.js for games and partner apps; a shop's website uses its
  own colour). Don't set `scrollbar-width` / `scrollbar-color` except inside `@supports not selector(::-webkit-scrollbar)`:
  Chrome drops the custom bar when they're set.
- **The blue smoky fog (`assets/fogbg.js`) is only for the Games section** (`games/` and `games/<id>/`) **in dark mode**,
  where the FOSSIL32 boxes float in it, with small solid 3D cubes in Grug colours tumbling in the fog (no glowing orbs).
  In light mode (and partner mode) the Games pages are a plain white page with black text and nothing floating: the
  cubes don't read on white.
- **All 3D renders at half resolution** (device pixel ratio × 0.5, capped at 2): FOSSIL32 (`RES` in its source), the
  avatar editor, the asset library previews, Model Kit's 3D views, the rewards/links builders and the fog cubes.
  Keep it that way for anything new. Two exceptions render at full resolution: the avatar editor's stage (a still picture,
  redrawn only when the look changes) and the Games page's rack of FOSSIL32 boxes while they sit in it (`RACK_RES`; the
  boxes are cheap on geometry). The unbox, cartridge and console overlay stay at half.

## Keep friction low

Simplicity is a goal in itself: no dead ends (carousels loop, nothing hits a hard stop), no scrolling inside panels that
should be static, and nothing on screen that doesn't help the person do the next thing. **Icons are one flat style
everywhere** (`Grug.icon`: the @icons simple set, then Phosphor bold); there are no colourful icon pictures and no emoji in
the interface. The top bar shows only the logo, the page name, the Pearls count, a full screen button and the person's avatar (no name;
a page can drop the name with `noTitle` or the Pearls with `noPearls`, as Home and the restaurants pitch do); Settings
and the dark-mode switch live in the account menu under the avatar.

## The dock: Home, Games, Me, Make

Four tabs for everyone (the role in Settings → I'm a… only changes what the home page shows first; nobody is asked it on arrival).
The dock's LB / RB badges only show once a controller is plugged in (`html.g-pad`). **Games**, **Me** and
**Make** are groups: tapping one opens a tray of its pages. Games = Games (the store, `games/`) and Carts (`games/carts/`,
see below). Me and Make also have their own page (`me/`, `make/`), a plain Linktree-style list (`Grug.ui.hub`) whose
picked row fills with its colour and slides on. Me = Avatar, Stamp cards (`me/cards/`: the guest's stamp cards and Pearls), Profile. Make = Link page (`links/`), Rewards card
(`rewards/`), 3D models (`create/`). `DOCK_GROUPS` / `NAV` in `assets/grug.js`.
Swiping sideways anywhere (not on sliders, canvases or sideways-scrolling rows; mark others `data-noswipe`) or Q / E /
LB / RB steps Home ↔ Games ↔ Me ↔ Make, and the next page slides in from that side (`grug.swipe` → `html.g-swipe-*`).

## Carts (`games/carts/`)

**Carts** are quick 1–3 minute 3D games played with one input (tap, or hold), shown one per screen in a vertical swipe
feed like Reels: swipe up for the next. They are built with the **Grug Micro** kit (`grug-game-kit/micro`, its own
README): `python3 build.py` there writes `dist/index.html` (the feed) and `dist/games/<id>.html` (each cart); copy them to
`games/carts/index.html` and `games/carts/games/`. Never edit those copies by hand. The feed has its own top bar
(Games | Carts: Games goes back to the store), right rail (favourite, best, restart, share) and Shop button; each cart's
shop has an **Inventory** tab where owned skins and pets are equipped. Coins are earned by playing; Pearls are the site's
wallet (`grug.pearls.v1`); crates are coins only (no paid random rewards). Saves: `grug.micro.v1`.
`assets/carts.js` (`GRUG_CARTS`) lists them for the store: they show in Browse all (a Type filter: Games / Carts), the
search box and a "Carts" row, each with its cover (`assets/carts/<id>.jpg`, 1580 × 950: a HUD-free shot of the cart
with its title and a GRUG CART tag). They are not FOSSIL32 boxes and are not in Favorites or the Discovery Queue;
tapping one opens `games/carts/#<id>`. A new cart needs its entry in `carts.js` and a cover.

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
- Every standalone game is listed (`Grug.partnerAllows`), with the partner's own games first (a "From <venue>" row and
  the front of the featured carousel on `games/`, the front of the app's shelf). The one exception is a game that still
  lives inside its venue's app (`inApp: true`, CraftHouse's sports games): only that venue's wrap lists it, since a wrap
  never leads into another partner's rewards app. Allowed pages: `games/` (and those games' pages), `avatar/`, `pearls`,
  `rewards/card/`; every other address goes to the game list (theme.js), and so do `inApp` games of other partners
  (grug.js). A game host's back button (`#rrBack`) returns to the list.
- Money in a wrap: Pearls pay in every game, and the venue's own coins also pay in its own games (25 coins to a point,
  `wallet.rate`; `assets/gamehost.js`). The game's bar shows the venue's coin balance next to the Pearls.
- The account menu is just Buy Pearls, Edit avatar and Settings; Settings has no Leave and no dark mode.
- The whole site stays in the partner's light look (no dark fog on Games), with its typeface and a faint gingham;
  the game panel and game page are centred.
- It survives a refresh and ends only when the tab closes or the site is opened normally.
- Opening the partner's app on the site (`play/<id>/`, however it was reached) starts partner mode by itself. Whatever
  page launches a game (the app, the game list, a game page) notes itself in sessionStorage `grug.partner.back` on
  `fossil32:play`, and the game's Back button (`#rrBack`, set by theme.js) returns there, so a guest who played from the
  app lands back in the app.
- The partner app's Home (on the site) opens with the site's game shelf: the partner's own games, then every other
  standalone game, as floating FOSSIL32 cartridges in one looping row (`Shelf` in the app).

Partners live in `PARTNERS` in `assets/theme.js` (`GrugTheme.partner()`); `html[data-partner]` is set while it's on.
A partner's look on the site comes from its entry: `colors` become `--p-accent` / `--p-deep` / `--p-cream` / `--p-page`,
`coin` is the top bar's coin, `font` becomes "Partner Font" and the optional `fontDisplay` "Partner Display" (headings)
(never hard-code one partner's look in grug.css). Partners so far: `crafthouse/`, `coco/`, `teahouse/`, `soluna/`,
`rodeo/` and `alchemy/`.

## Every game is a standalone game

Games are their own thing, not a tab inside a venue's rewards app. Each lives at `play/<dir>/`: `game.html` (built with the
game kit) under a thin `index.html` that calls `GrugGameHost({...})` from **`assets/gamehost.js`** (the bar with Back, the
game's name and the Pearls / coins, the game frame, and the game kit's messages; the protocol is at the top of that file).
The game's Store, save key (`grug-<dir>-v1`) and venue are in that call. A game made with a venue names it (`venue` in
`assets/games.js`, `brand` in the host call): the venue's coins pay there while the site is wrapped in it. Grug originals
(`original: true`, no venue) are paid in Pearls only. The venue games and their folders: Steal a Sip `play/stealasip/`,
Take a Tea `play/takeatea/` (Teahouse Express), Sunrise to Sunset `play/sunrise/` (Soluna), Rodeo Wash Simulator
`play/rodeowash/` (Rodeo Express), Sugar Alchemist `play/sugaralchemist/` (Alchemy Bake Lab). The first time a guest opens
one, the host brings over what the venue's older app kept for it (`migrate`: owned items, best, runs).
Each venue's rewards app stays at `play/<venue>/` (the address its QR codes and NFC tags use): an NFC link (`?tap=`)
stamps today's visit, and the old app's game links (`#…/game`, `?game=takeatea`) forward to the standalone game
(`oldLinks` in the venue's config.json). The Games page's **Rewards apps** button (top of the store, beside Favorites)
opens a list of every venue's app; it's hidden in partner mode.

## Making a partner rewards app (use the CraftHouse template)

Every partner rewards app (a coffee shop, a bar, a car wash…) is built the same way as Coco Crepes', Teahouse Express',
Soluna's, Rodeo Express' and Alchemy Bake Lab's, from **`tools/partner-app/`**: the shared app (`src/`), one folder per
partner (`partners/<id>/config.json`, `quiz.json` + menu data: a website scraper and `make_data.py` like Coco's, or a
hand-written `menu.json` and `python3 tools/partner-app/make_menu.py <id>`), and `python3 tools/partner-app/build.py <id>`
→ `play/<id>/index.html` (never edit that file by hand). Then the site side: a `PARTNERS` entry, the `<id>/` short
address, and (once it has one) the venue's game as a standalone game with its FOSSIL32 box. Follow the step-by-step and
the browser checklist in `tools/partner-app/README.md`. **The template has no game room and no sports games**: its games
are the site's standalone games, the partner's own first. **Every reward in a partner app is digital** (coins, app themes, power-ups in the partner's own game): never free
food, drinks or discounts. The checklist includes "open the app directly, play from its shelf, press Back: you must land
back in the app".

## Games are FOSSIL32 cartridges

Wherever a game is showcased on its own (the home page games carousel, Favorites, each `games/<id>/` page) it is
shown as a floating 3D **FOSSIL32** cartridge box (Grug Digital's fantasy console). The store (`games/`) is the one
place that browses them as flat box art, like a big PC game store. Tapping a box darkens the page and
blurs it out of focus, pulls the cartridge out and shows the game panel; **Play** drops the cartridge into the FOSSIL32
console, zooms into its screen and opens the game. A pool of the game's colour follows the cartridge the whole way.

The **Games page** (`games/`) is the **store**, laid out like a big PC game store in the site's own look: a featured
carousel (hover a screenshot to see it big), rows of capsules (Keep playing, Grug originals, Made with Katy restaurants),
categories (the games' `tags`), the **Discovery Queue** (step through games picked from what you play and favorite: heart
or ignore each one) and a tabbed list with a preview beside it. **Browse all** (`games/#search?…`) is its search page:
sort, tag include / exclude with live counts, Your library / Made for / Status filters and removable chips, all kept in the
address. Every heart (store, queue, game page) adds the game to Favorites (`Grug.favs` in `grug.js`: favourites and the
ignore list, saved on this device). Only real numbers appear (your runs and best scores): never made-up ratings, reviews
or player counts. The old `games/#g/<id>` address goes to that game's page.

**Favorites** (`games/favorites/`) is a looping vertical carousel of the hearted boxes, in the order they were added,
on the left half (`Fossil32.rack`, the page drives `state.pos`), with the selected game's details on the right (below it
on phones). With nothing hearted it shows a card pointing to the store and the Discovery Queue (no dead end). Scroll, swipe, arrow keys or a
controller browse; Play / Enter / tapping the front box calls `Fossil32.launch(id)` (box opens → cartridge → console → game).
The panel shows only the game's name, the business it was made for, its short `blurb` (the full `long` write-up is
on its game page; keep blurbs to a sentence or two), its `features` and Play. No catalog codes, tags or Live/Demo
badges, and the panel never scrolls: only the boxes do.

The **home page** puts games first: the avatar hello with Play (the last game played), then the games, then a row of
quick games (the Carts, `assets/carts.js`), then a slim strip with two doors (restaurant owners → `restaurant/`, online
creators → `links/`; hidden in shop mode). Someone whose role is owner or creator sees that door first, full width. It
has no page-name pill in the top bar (`chrome('home', { noTitle: true })`). The games are the one place they show as bare cartridges (no
box, no card and no glow behind them), in one horizontal carousel: `boxTile(g, { kind: 'cart', ribbon })`
(`data-f32-kind="cart"`). It loops endlessly (the list three times over, quietly re-centred on the middle copy). The
last-played game comes first, with a "Last played" ribbon. Closet picks are hidden: players dress up when they choose to.
Tapping a cartridge glides it straight to the game panel.

- Code: `tools/fossil32/src/fossil32.js` → bundled to `assets/fossil32/fossil32.js` (`cd tools/fossil32 && npm install && npm run build`).
  Never edit the bundle by hand (`npm install` needs only the npm registry). Styles: `assets/fossil32/fossil32.css`. Tiles come from `Grug.ui.boxTile(game)` in `assets/grug.js`.
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
   `tools/boxart/README.md` (capture a HUD-free background from the game, pose the avatar, composite to
   `assets/boxart/<id>.jpg`, 1580 × 950, no text). Rules: the blocky avatar (`tools/boxart/pose.html` loads it), no hats.
   The box art made before Nov 2026 still shows the classic avatar: redo it with the new one when there is time.
   Also save 1–3 back-of-box screenshots to `assets/boxart/shots/`.
4. Point `thumb` at the box art too, and add a `games/<id>/index.html` like the others (it calls `GrugGamePage('<id>')`).
   The game itself goes in `play/<dir>/game.html` with a thin host `index.html` copied from another game (it calls
   `GrugGameHost`); set `play`, `game` and `save` in its `games.js` entry, and `venue` (or `original: true`).
5. **Store tags:** 3-5 genre words in `tags` (reuse the words other games already have where they fit). They drive the
   store's categories, tag filters and recommendations.
6. **Link previews** (Grug originals only): run `node tools/og/build.js`. It writes the Discord / iMessage / Slack preview
   tags (title, blurb, genre / players / tags lines, the box art as the big picture, the game's `color` as the stripe)
   into `games/<id>/` and `play/<dir>/`, plus `assets/oembed/<id>.json`. Rerun it whenever a title, blurb, tags or box art
   changes; never edit the `grug:og` block by hand. A business's game gets no preview while it is a demonstration.
7. Check it in a browser: the game in the store (capsules, search, the queue), heart it, then its box on Favorites, the
   unbox, the panel, and Play (cartridge → console → game).

## The avatar (`assets/sandy-runtime.js`, Nov 2026)

Every game's avatar is one simple blocky character (Kenney "Animated Characters: Protagonists", CC0): four **skins**
(Skater, Rocker, Cyborg, Disco) and the classic **hats**, fitted to its head. `window.SandyKit` keeps the old API, so a game
just loads `assets/sandy-runtime.js` (~1.7 MB, built by `tools/avatar/build.py`; read `tools/avatar/README.md` before
changing it). Joints keep the classic names. The look is 'grug.sandy.v1' = `{model: 'block', skin, hat, classic}`.
Choosing your own colours is not built yet: the skins are laid out in regions so it can be a texture job later.

- **The classic avatar is archived**, opt-in and **only ever the player's own character**: Avatar → Classic → "Play as my
  classic avatar" sets `classic: true`, and then `SandyKit.create(the player's look)` builds the old Sandy
  (`assets/sandy-classic.js`, ~15 MB, loaded on demand) from 'grug.sandy.classic.v1'. Bots, NPCs, customers and
  everyone else are always the new avatar (`randomConfig` never sets `classic`). A look saved before the change (no
  `model`) is moved to the classic key once (`SandyKit.migrate`, `migrateLook` in grug.js, `SandyView.config`) and the
  player gets the new avatar in the skin of that body, wearing the same hat.
- **The classic feet** (Nov 2026, the same file as `grug-game-kit/vendor/sandy-runtime.js`, made by one patch there):
  both bodies wear the new feet model, with nails marked per vertex (`_nail`, painted in the look's `nails` colour),
  their own normal map (creases on the soles, `FEET_NMAP`) and fully matte roughness. `footShape` in a classic look is
  `'none'` (as modelled) or a preset `'a'`–`'l'` (`FOOT_SHAPES`, bone scales and toe angles; `CATALOG.footShapes`), and
  `randomConfig` gives every random classic look its own (Runway Ready's crowd); `randomConfig(seed, {footShape})` picks
  one. With flip-flops on, the toes bend down onto the sole and the strap is refitted to the posed foot (`fitToes`,
  `fitStraps`). The lower legs taper gradually to the knee and the front of the ankle is rounded. Don't hand-edit the
  `SANDY_GLB` models or the `ARMORPACK` vertex tables: they are generated together, and the tables follow the mesh.
- **The pose debugger** (`debug/pose/`): a standalone page for the classic avatar (pose limbs and each toe, pick a foot
  shape and expression, randomize the look, line up all 12 foot shapes). It is deliberately **not linked from anywhere on
  the site** and is `noindex`: keep it unlinked and out of `tools/pwa/build.py`. The same page is `grug-game-kit/tools/pose/`.
- **The closet** (`shop/`, "Classic closet") and every clothing design dress the classic look only (`Grug.equip` writes
  'grug.sandy.classic.v1'). It's off the dock; the editor's Classic section and the account menu (while classic is on)
  link to it. **Runway Ready** is a dress-up game built on those clothes, so it loads the classic kit for everyone in it
  until the new avatar can be dressed (see its AVATARS block).
- **Pictures** (`grug.sandy.snaps.v1`, `assets/sandy-view.js`) are of the player's avatar: the classic one while it's
  on. The classic editor stamps the player's look (`classicAt`) whenever the classic look changes, so they are retaken.

## Avatar editor (`avatar/`)

Four sections as tabs: **Look** (the skins), **Hat** (none or one of eight, any colour, a size slider), **Emotes** (the
loadout for the emote wheel, previewed on her) and **Classic** (the switch, Edit classic avatar → `avatar/classic/`,
Classic closet). The stage is a **still picture**, redrawn when the look changes, with two arrows that turn her 45 degrees
at a time; an emote preview plays live at half resolution for a few seconds, then it goes still. While classic is on, the
stage shows the classic avatar and Look / Hat are greyed with a way back.

`avatar/classic/` is the old editor, archived as it was (still picture, `nav.js` screens, wardrobe, custom clothing), under a
bar with the same switch and a link back. It edits 'grug.sandy.classic.v1' through `window.SandyClassicKit`.

## The restaurant account (`assets/business.js`)

Next to the Grug player profile, each device can hold a **restaurant account** (`localStorage 'grug.business.v1'`: which
account is in use, the active shop, and each shop's card text and website fields). Finishing a rewards card makes one
(`GrugBusiness.fromCard` in the card builder's last step). There is no server and no login, the same as everywhere else.

- **Switching:** the account menu under the avatar has "Switch to <shop>" (player) / "Switch to <player>" (restaurant);
  the home page's owners' door becomes "Switch to your restaurant". `Grug.business.setAccount(mode)` saves it and opens
  that account's home. Shop mode and partner mode always show the player account.
- **In the restaurant account** the dock is Dashboard · Rewards card · Website (`BIZ_TABS` in grug.js; no Games), the top
  bar's picture is the shop's icon on its colour, and `html[data-account="business"]` is set (theme.js). It has no home
  page: the site's home (and the Grug logo) opens the dashboard instead (theme.js);
  `[data-only-account="business"|"player"]` shows a part to one account only.
- **Dashboard** (`business/`): the Daypart app, standalone with its own look and its own `daypart:*` storage. It reads the
  restaurant account (the shop's name, which only changes on the card), lists **Mural** (website) and **Totem** (rewards
  card) as apps that open the Grug pages, and its menu switches back to the player account. Opening it switches to the
  restaurant account. It is not built from a tool: edit the file directly.
  - It draws the restaurant dock itself (`GDOCK` / `gdock()`, same look and order as the site's), pinned on every
    dashboard page so nothing is out of reach; Q / E step to the other tabs. A locked time clock (staff kiosk) hides it.
  - Home groups its apps (`APP_GROUPS`) in drop-downs, all closed at first, each with an icon from the site's simple set
    (`GROUP_IC`) and the count of things that need you inside: Your team (Henge, Stomp, Clan), Kitchen (Notch, Mammoth,
    Hearth), Your guests (Mural, Totem), Paperwork (Conch, Fossil). A new app goes in a group there, or it shows under "More".
- **Website** (`business/site/`, the Website section, accent `#5AB0FF`): the editor, with a live preview. The site itself
  is drawn by `GrugBusiness.siteParts` from the card (name, colour, icon, lettering, reward) plus the owner's fields;
  empty fields are left off the page. Its public address is `site/#s=<payload>` (the whole site rides in the link,
  deflated), and **Download** gives one self-contained `index.html` (Google Fonts) for any web host.
- Profile export carries `grug.business.v1` and the dashboard's `daypart:*` keys.
- **The owners' link** (`restaurant/`, the one to hand restaurant owners): one screen asks the restaurant's name and what it
  serves while their rewards card and website draw live beside it, and one tap makes the card, the website and the restaurant
  account, then opens the dashboard with example data in every app and a **tour** (`tourSteps()` in `business/index.html`:
  one stop per part, ending on the menu; "Take the tour" in the menu replays it, `?tour=1` starts it). Optional
  `?name=…&type=c|t|b|f|k|o&owner=<first name>` fills it in and builds straight away (`?c=<card code>` uses a whole card).
  An owner who already has a restaurant account on the device goes straight to the dashboard. When a dashboard part is
  added or renamed, update the tour.
- **The business card path** (managers first, owners second): the printed card's QR and address go to `managers/` →
  `for/managers/?from=card` (the managers' walkthrough, "Thanks for scanning") → the owners' link → the dashboard.
  The walkthrough's last step asks **What kind of place is it?** (Restaurant / Bubble tea / Café, `KINDS` in its script;
  `?kind=tea|cafe` picks one ahead of time): Restaurant goes through the owners' link to Daypart as before, Bubble tea
  and Café open their own dashboards (`business/tea/?name=…`, `business/cafe/?name=…`), each its own app. The
  dashboard's Home ends with one door to the owners' pitch (`.gamedoor` → `partners/`, "A rewards app that brings guests back"; the game is the bonus, so lead with the rewards app),
  with its own tour stop. **`managers/` is printed on paper: never move or remove it.**

## The shop dashboards: Bubble Tea and Café (`tools/shop-dashboards/`)

Two lean dashboards made for a bubble tea shop and a café, each its own installable app (Bubble Tea, Café). Same look as
Daypart, but a separate build: **`python3 tools/shop-dashboards/build.py`** writes `business/tea/index.html` and
`business/cafe/index.html` (one file each, everything inline); never edit those by hand. Then run `python3 tools/pwa/build.py`.
Read `tools/shop-dashboards/README.md` before changing them.

- **The design rule is "a new hire on day one can use it without asking anyone".** Today is a numbered to-do list in plain
  sentences, timed from the shop's open and close times (red "do it now" items first, "You're all caught up" when done);
  every other tool is a big tile with a one-line status; every page shows a 3-step "How this works" the first time (the
  **?** brings it back); one main button per page, the rest under More; "Who's using this?" signs every tick and log for
  the day; fiddly jobs are one question per screen; deletes offer Undo; silly numbers are refused in plain words. Keep it.
- **Storage:** `grug-tea:*` and `grug-cafe:*` (one key per collection, `<prefix>meta` is device-only). They don't use the
  restaurant account (`grug.business.v1`) and never touch `daypart:*`. Each has its own backup file (JSON with
  `schemaVersion`; add a step to `MIGRATIONS` in `src/core.js` when the shape changes) and CSV exports. Profile export
  carries their keys too (grug.js).
- **On the site** (`SHOP_PWA = 'site'`) each page loads `app/app.js`, which gives it its manifest, the Download card
  (Settings, with status) and the site's service worker. Download sits in the top bar on every page
  (and a card at the end of Today) until it's installed. Pearl and tea timers are stored timestamps, never counters, so they stay right after a reload or a sleeping tablet.
- Temperature, cleaning and timer settings are editable record-keeping templates and say so: never claim health-code
  compliance. Hold times, ranges and intervals are the owner's settings.
- **One account with the rest of the restaurant side:** on the site each shop dashboard makes its shop a rewards card and
  a restaurant account shop (`grug.business.v1`) marked `dash: 'tea' | 'cafe'`, and draws Daypart's bottom bar
  (Dashboard · Rewards card · Website). Everything that opens "the dashboard" (the site dock, the logo, the account menu,
  the home page, `restaurant/`) goes to the shop's own one through `dash` (`GrugBusiness.dashPath`, `dashPath()` in grug.js).
  A shop with no `dash` is Daypart's, unchanged.
- **Play while you wait:** `PLAY_URL` in `tools/shop-dashboards/src/config.js` (the footer link and the customer screen's QR).
- Tests: `node tools/shop-dashboards/test/core.test.js`, and with the site served on :8766
  `python3 tools/shop-dashboards/test/e2e.py` (143 browser checks, including that the restaurant dashboard's data is untouched).

## Rewards card builder (`rewards/create/`)

It should feel like talking to a top-of-the-line AI (there is no AI): the assistant (the Grug stegosaurus, `Grug.LOGO`)
"thinks", then streams each question with a live 3D preview in its newest answer; answers are tiles in a tray docked at the
bottom, picked like choosing a photo (typing is matched to a tile), and the shop's name goes in an AI-style prompt bar.
Each question is a `STEPS` entry (`say`, `tiles`, `pick`, `att`/`answer`); styles in `assets/cardchat.css`.

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

