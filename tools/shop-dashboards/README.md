# Shop dashboards: Bubble Tea and Café

Two lean, accountless dashboards built from the restaurant dashboard's approach (`business/index.html`, "Daypart"):
static pages, no backend, no login, all data in the browser on that device, export/import as a file. Same
look as the rest of Grug Digital (Fredoka, flat accents with a darker lip, off-black ink on accent fills).

The restaurant dashboard is **not modified**. The new dashboards share code with each other, not with Daypart, so
nothing in `business/index.html` can break.

## Design rule: a new hire on day one can use it without asking anyone

- **Today is a to-do list**, in plain sentences, in order, based on the time of day and the shop's open/close
  times: red "do it now" items first (throw out expired pearls, milk past its date), then opening jobs, fridge
  temps, notes from the last shift, closing jobs, cash-out. When nothing's left it says "You're all caught up".
  Modules add items with `todo()`.
- **No menus to learn.** Every tool is a big tile with a live one-line status (`status()`), grouped as *Every shift*,
  *Stock & ordering*, *For the manager*. A big **Home** button is on every page; phones also get a bottom tab bar.
- **Every page teaches itself.** First visit shows a 3-step "How this works" card (`help.steps`); the **?** button
  brings it back. One main button per page; anything else is under **More**. Old records sit behind "Past …" drawers.
- **Nobody types their name.** "Who's using this?" (remembered for the day on that device) signs every tick,
  log and clock-in. Clocking in also sets it.
- **One question per screen** for the fiddly jobs: setup, cash-out, logging waste, espresso test shots, pastry
  counts (`App.wizard`). Answers come back in sentences: "The drawer is $2.50 short", "Too fast: grind finer".
- **Mistakes are cheap.** Deletes show **Undo**. Double taps are caught (clock-out within a minute, a second pot
  of pearls within 3 minutes). Silly numbers are refused in plain words (a 400° fridge, a 0 amount, a 15-hour
  shift, a roast date in the future). Only truly destructive things (erase, replace from backup) ask you to type
  a word.
- **Owners can switch tools off** (setup step 3, or Settings → Tools you use) so staff only see what the shop uses.
- **Bigger text** option in Settings, and every button is at least 38 px tall (checked by the tests).

## Build and try it

```
python3 tools/shop-dashboards/build.py            # writes business/tea/index.html and business/cafe/index.html
python3 tools/pwa/build.py                        # then, like any site change: the apps' offline list
python3 tools/shop-dashboards/build.py --extras   # also dist/ (gitignored): a single-file copy and a self-hosted PWA folder
node tools/shop-dashboards/test/core.test.js      # unit tests for the pure logic
python3 -m http.server 8766 &                     # from the repo root, then:
python3 tools/shop-dashboards/test/e2e.py         # 143 browser checks
node tools/pwa/check.js                           # the site's offline check (installs all four apps); must end "All good"
```

On the site they are **business/tea/** (the Bubble Tea app) and **business/cafe/** (the Café app). Managers reach them
from the last step of `for/managers/` ("What kind of place is it?"); `?name=` fills in the shop name on the first screen.

First run is four short steps: shop name and hours, who works here, which tools to use (plus starter lists and optional
pretend data to try it out), and three tips. "Remove the pretend data" in Settings → Danger zone clears only the sample.

## Source layout

| File | What it is |
|---|---|
| `src/config.js` | **`PLAY_URL`**: the one place to change (or blank out) the "Play while you wait" link and QR |
| `src/core.js` | Pure logic, no DOM: dates, shifts, rush coverage, hours, tip split, stock/order list, batch timers, pastry suggestion, CSV, schema/migrations, backup read/merge |
| `src/ui.js` | App shell: namespaced storage, routing, forms, dialogs, timer tick + alarm sound, backup/import, PWA wiring |
| `src/modules.js` | Core modules every type gets: Today, schedule (with rush windows), time clock, checklists, shift notes, cash-out & tips, stock counts, order list, waste, cleaning, temperatures, drink specs, customer screen, backup & settings |
| `src/app.css` | Shared styles and the phone / tablet / desktop layouts |
| `src/types/<id>.js` | A business type: name, colours, nav, rush windows, units, wording, starter lists, sample data |
| `src/types/<id>.mods.js` | That type's own modules |
| `src/types/<id>.css` | That type's own styles |
| `src/vendor/` | Fredoka (copied from the site). The QR code comes from the site's `assets/qrcode.js` (MIT, credited on credits.html) |

## Storage keys

One `localStorage` key per collection, under a prefix per dashboard:

| Dashboard | Prefix | Examples |
|---|---|---|
| Restaurant (unchanged) | `daypart:` | `daypart:shifts` |
| Bubble Tea | `grug-tea:` | `grug-tea:settings`, `grug-tea:pearlBatches`, `grug-tea:meta` |
| Café | `grug-cafe:` | `grug-cafe:settings`, `grug-cafe:dialins`, `grug-cafe:meta` |

`<prefix>meta` is device-only (device id, last backup time, "checking as" name, dismissed hints, and on the site the
linked shop's id `shopId` and card name `cardName`) and is not exported. "Erase everything" removes only that dashboard's prefix.

## On the site: the restaurant account, the bottom bar and Contact us

On grugdigital.com a shop dashboard is also a **restaurant account**, like Daypart (`linkShop()` in `src/ui.js`). After
setup it makes the shop a rewards card (kind `cardType` in the type file: `t` for bubble tea, `c` for café; saved in
My creations, `grug.rewards.v1`) and a shop in `grug.business.v1` marked `dash: 'tea' | 'cafe'`, makes it the active
shop and switches to the restaurant account. It never takes over another shop on the device (a name already in use gets
" Bubble Tea" / " Café" added; if that's taken too it stays unlinked). It reads but never changes `daypart:*`.

- **The bottom bar** (`gdock()`, styles at the end of `src/app.css`) is Daypart's: Dashboard · Rewards card · Website,
  the same colours and sizes. Dashboard is this page; the other two are the site's `rewards/` and `business/site/`. On the
  site it replaces the phone tab bar. The site's own dock, logo and account menu send this shop back here (`dash` in
  `assets/business.js`, `dashPath()` in `assets/grug.js`, theme.js's home redirect, `restaurant/`, and Daypart's first
  lines when that browser has no Daypart records).
- **Renaming** the shop in Settings renames its rewards card and website (`renameShop()`); a rename on the card is picked up here.
- **Download** is in the top bar on every page (`data-get-app`), with the card at the end of Today and in Settings.
- **Contact us** (`assets/contact.js`: Discord, Instagram, text, email, in one place) is in the top bar, the footer and
  Settings. The standalone copies inline the same file.

## Export format (schema version 1)

```json
{
  "app": "grug-shop-dashboard",
  "type": "tea",                    // or "cafe"; a backup only imports into its own type
  "typeName": "Bubble Tea",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-15T16:40:00.000Z",
  "deviceId": "…",
  "data": { "settings": {…}, "employees": [ {"id": "…", "updatedAt": "…", …} ], "shifts": [ … ], … }
}
```

Every record has a string `id` and an `updatedAt`. Import checks the app id, the type, the version (refuses files
from a newer version), that settings is an object and that every collection is an array of records with ids. It then
shows what's in the file next to what's on the device and offers **Replace** (typed confirmation when there is data
to lose) or **Merge** (keeps both; the newer copy of any record wins).

**Changing the shape later:** bump `SCHEMA` in `core.js` and add `MIGRATIONS[n]` that upgrades a version-n object to
n+1. Old backups and old on-device data run through the steps on import/load.

CSV exports: weekly hours, every punch, cash-outs, waste, cleaning, temperatures, plus pearl/tea batches (tea) and
dial-in, equipment and pastry counts (café). Cells that start with `= + - @` are escaped.

## Installing (PWA)

**On grugdigital.com** each page sets `window.SHOP_PWA = 'site'` and loads `../../app/app.js`, the site's shared app
system: it gives the page its manifest (`app/tea.webmanifest` / `app/cafe.webmanifest`: own `id`, `start_url`
`/business/<id>/?pwa=<id>`, scope the dashboard's folder), registers the site's service worker (`sw.js`), and fills the
Download card in Settings (`data-app-card="tea|cafe" data-app-status`). Installed, the app keeps its pack
(`tea` / `cafe` in `app/offline.json`) on the device and updates itself whenever the site changes. The top bar's Download
button and a card at the end of Today offer it until it's installed. Icons: `node tools/pwa/icons.js tea cafe`.

**Anywhere else** (`--extras`, `dist/pwa/<folder>/`): its own `manifest.webmanifest`, `sw.js` (precaches the shell,
network-first page with a cached copy and `offline.html` as fallbacks, `VERSION` = hash of `index.html`) and an
"A new version is ready · Update" prompt. The single-file copy (`dist/standalone/`) works without installing.

## Timers

Pearl and tea batches store `startedAt`, `cookMin` and `holdMin`. Discard-by = start + cook + hold. A once-a-second
redraw recomputes everything from those timestamps, so a reload, a closed tab or a sleeping tablet never drifts.
Expired batches turn red, put "⚠ EXPIRED" in the tab title and chime every 12 s until someone taps Discarded or
Silence. Browsers block sound until the first tap, so the top bar shows "Tap to turn on alarm sound" until then.

## Adding a business type

1. Copy `src/types/tea.js` to `src/types/<id>.js`; change `id`, `name`, `storagePrefix` (new and unique), theme,
   `nav`, `tabs`, `hero`, rush windows, wording, `colls` (its extra collections), `starter()` and `demo()`.
2. Write `src/types/<id>.mods.js` with `App.register({ id, title, icon, render(), acts, home(), badge(), csv, timers })`.
   Use `App.stockModule({...})` for count-with-par lists.
3. Add `src/types/<id>.css` (can be empty) and an entry in `TYPES` in `build.py`.
4. `python3 tools/shop-dashboards/build.py <id>`, with a `<folder>` under `business/`.
5. Make it its own app: `app/<id>.webmanifest` (copy `app/tea.webmanifest`; a new `id`), icons in `tools/pwa/icons.js`
   (`node tools/pwa/icons.js <id>`), the name in `NAMES` / `WHAT` / `COPY` and the path in `pageAppOf()` in `app/app.js`,
   the pack in `SHOP_PAGES` in `tools/pwa/build.py` (and in `apps`), a block in `tools/pwa/check.js`, and an entry in
   `KINDS` on `for/managers/` if managers should be able to pick it. Then `python3 tools/pwa/build.py`.

## Before going live

- The starter drink specs, hold times, temperature ranges and cleaning intervals are examples. Every one is editable,
  and the logs say plainly that they're record-keeping templates, not health-code compliance.
