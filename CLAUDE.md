# Notes for Claude sessions working on this repo

`main` is the **new** Grug site, being built from scratch (static files on Cloudflare Pages, deploys on push to `main`).
The **old** site is on the `legacy` branch, unchanged, with its own long CLAUDE.md: read that one only when working on
the legacy branch. See `README.md` for how the two fit together.

## Three sections, one directory (keep them apart)

The site is three places for three audiences, and the home page (`index.html`) is the directory that sends people to
them: three doors, then every page listed by section. Put a new page in the section it belongs to, link it from that
section's nav and from the directory, and don't cross-sell another section's tools inside it.

| Section | Who | Pages | Look |
| --- | --- | --- | --- |
| **Players** | people who want to play and dress an avatar | `/arcade/` (and every game), `/character/` (the players' Avatar Studio), `/character/pearls/`, the promo pages | **classic** (the 2011 games site, green nav) |
| **Game developers** | people whose AI agent makes characters for their game | `/agents/`, `/agents/studio/` (the agents' Avatar Studio), `/packs/` (the itch.io asset packs) | **modern**, dark (`data-theme="dev"`) |
| **Restaurants** | owners and managers | `/restaurants/`, and the tools it opens on the legacy deploy | **modern**, white and tomato (`data-theme="rest"`) |
| the directory | everyone | `/` (home), `support.html` (Help and contact), `privacy.html`, `terms.html`, `404.html`, `build/` | **modern**, light grey and Grug's green |

- **Only the Arcade side is classic** (the games, and the players' studio and Pearls pages that go with them). Everything
  that isn't about the Arcade wears the modern look (see "The look").
- Every section's top bar names the section and has a way back to **Grug home**. On the Arcade's classic pages that is
  `<li class="sect">` at the start and `<li class="end">` at the end of the green bar (`arcade/arcade.css`); on the modern
  pages it is the brand ("Grug for restaurants", "Grug for agents") and a "Grug home" link in the bar.
- **The only agentic tool is the Avatar Studio.** The Building Studio was retired (below): don't link it, and don't add
  another agent tool without the owner asking.
- The Avatar Studio comes in **two versions built from one file** (below): never add agent or Claude panels to the
  players' one, and never add pickers or sliders to the agents' one.

## The legacy pass-through (don't break it)

`functions/_middleware.js` serves every address `main` has no file for from the legacy deploy
(https://legacy.grugdigital.pages.dev), at the same address, with a "legacy version" banner (the restaurants' tools get a
"Grug for restaurants" bar instead: see that section). That keeps every old link,
printed QR code (`managers/`), NFC tag and installed app working, and keeps people's saved data (it is tied to the address).

- `main` must keep a `404.html`: without one Cloudflare Pages answers unknown paths with the home page (status 200), and the
  middleware would never fall back to the legacy site.
- Never add `sw.js`, `app/` or the old manifests to `main` unless the new site is deliberately taking over the installed
  apps: phones that installed the old apps still load them from those paths.
- `/` is the new home page; the old one is at `/legacy`; `/?pwa=…` (the installed apps' start page) still gets the old one.
- A file on `main` takes over the old page at the same path. Avoid the old top-level names (listed in README.md) until you
  mean to replace them.

## Avatar Studio: two versions of one studio (`/character/` and `/agents/studio/`)

Both pages are generated from the owner's Grug Avatar Studio file plus the layers in `src/character/`. Never hand-edit
them: change the sources and run `python3 src/character/build.py` (add the path to a new studio file when the owner
sends one; without it the layers are refreshed in place). Read `src/character/README.md` first, and run
`python3 src/seo/seo_head.py` afterwards.

- **`/character/`, the players' studio: made for kids and hobbyists.** The owner's studio in the classic look, with the
  My outfits and Wardrobe layers, and `players.css` / `players.js` on top: words under the tab icons, a Back / Next bar
  that walks the tabs in order and ends on "Play in the Arcade", a short hello for first-timers, plain-words copy, and a
  note that the Gemini step needs a grown-up for under-13s. It has **no** "Make with Claude" sheet, skill panel or agent
  instructions (`patch_studio.py` no longer adds them, and `patch_outfits.py` strips them from an older build). Old
  `?claude` and `?skill` links go to `/agents/`.
- **`/agents/studio/`, the agents' studio: clean and minimal.** `agent_studio.py` copies the players' page, sets
  `body.agent`, hides every picker, slider and tab (`agent_studio.css`) and adds one console (`agent_studio.js`): the
  agent's instructions first in `<body>` (an AI that only fetches the link reads them), a **Next** box, and three steps
  that open one at a time: the look as JSON, the Gemini round trip, the export. It wears the `/agents/` look (dark, one
  green), not the classic one. The alignment sheet keeps only the picture, the match and Wear it.
- **`window.GrugStudio` (`agent.js`) is the same on both**, with the same saved characters and Pearls (same address).
  It announces every change as a `grug:studio` event, which the console redraws from. Old prompts and installed skills
  that open `/character/` keep working.
- **The guide** is `claude.md.tmpl`, written by `build.py` to `agents/studio/claude.md` and to `character/claude.md` (the
  address older prompts and skills fetch). Keep it accurate when the studio, the console or the API changes, and test
  the whole flow headless on both pages (set → wear an image → downloadR6) before pushing.

## Building Studio: retired (November 2026)

`/build/` shows a short "retired" page, and `functions/_middleware.js` sends its other old addresses (examples, guide,
skill zip) there. The pages, the example buildings, `build/claude.md`, the `game-buildings` skill and most of `src/build/`
are gone from `main`; the last commit with them is `100f36c`. **`build/core.js` stays**: the Grug Studio game's "Make a
Building" pad uses it (generated from `src/build/core.js` by `python3 src/build/build.py`). Don't link the Building
Studio from anywhere, and don't describe the site as making buildings.

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

## Search and Google Images (`src/seo/`)

Promotional images (game covers, character and building renders, game scenes, the logo, the share pictures) have
descriptive file names, alt text and embedded Grug Digital metadata; pages carry share cards and JSON-LD; `sitemap.xml`
and `robots.txt` list it all. Read `src/seo/README.md` before adding or renaming an image: list new promotional images in
`src/seo/images.json`, run `python3 src/seo/tag_images.py`, then `python3 src/seo/seo_head.py` (also after rebuilding the
Avatar Studio). Renamed images keep their old address through `MOVED` in `functions/_middleware.js`.
Don't tag textures, placeholders or third-party images.

## Grug for agents (`/agents/`): the developers' section

`agents/index.html` is the landing page for people who use AI agents: an "Ask your agent" box with prompts to copy (the
`PROMPTS` object in its script), the agents' studio next to the players' one (screenshots in `static/agents/`: retake them
when either changes), the Claude skill (`src/skill/`) and links to the source on GitHub. It set the modern look the rest of the non-Arcade site now wears (`static/modern.css` was drawn from it): dark, Allo
throughout. It is still one self-contained file with its own copy of those styles, so keep the two in step. Keep its prompts
and facts in step with `agents/studio/claude.md` when the studio or its API changes.

`/packs/` is the section's other page: the itch.io asset pack catalog (it used to be on the home page), in the same dark
look as `/agents/` (`static/modern.css`, `data-theme="dev"`). See "The itch.io asset list" below.

**Links to it:** the home page's Game developers door and directory, the footers ("Game developers"), `/packs/`, the last
page of the players' studio ("Making a game with an AI agent?"), `llms.txt` and the skill. The players' pages don't
advertise it beyond that.

## Grug for restaurants (`/restaurants/`): the restaurants' section

`restaurants/index.html` is the front door for owners and managers, in the modern look (`data-theme="rest"`: white, warm
ink, tomato): a stamp card you can stamp in the opener, the one-tap setup, the three free tools (rewards card, website,
dashboard), how it works, the managers' tour, custom games for restaurants near Katy, and the number to text. Its
pictures are drawn in CSS with a made-up shop ("Rosa's Tacos"): no real business's name, logo or photos (see "Frozen" in the legacy branch's CLAUDE.md, which still applies).

**The tools themselves still live on the legacy deploy** (`/restaurant/`, `/rewards/`, `/business/`, `/managers/`,
`/for/managers/`, `/partners/`), because printed QR codes, NFC tags and the installed Daypart, Bubble Tea and Café apps
open those addresses. The middleware serves them there with a **"Grug for restaurants" bar** linking back to
`/restaurants/` instead of the "legacy version" banner (`REST` and `BAR_REST` in `functions/_middleware.js`), and the pages
a shop's own guests open (`/site/`, `/rewards/card/`: `GUEST`) get no bar at all. Keep this page's facts in step with those
pages, and don't promise a price, a plan or a membership here: send people to `/partners/` or the phone number.

## The font: Allo (`static/fonts/`)

The whole site is set in **Allo** (https://github.com/joshpuckett/allo, SIL Open Font License 1.1: keep
`static/fonts/OFL.txt` next to the files). Every page links it in `<head>`, right after `<meta charset>`:

```html
<link rel="preload" href="/static/fonts/allo-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/static/fonts/allo.css">
```

and every font stack starts with it, the old font kept as the fallback: `font:bold 14px Allo,Arial,Helvetica,sans-serif`,
including canvas text (`ctx.font = 'bold 20px Allo,Arial'`). Monospace stays monospace. A new page or game does the same.

- `allo-latin.woff2` (187 KB, cached for a year) is the variable font cut down to Latin, punctuation, arrows, maths and the
  symbols the site uses (✓ ✕ ★ ▶ ◀ ● ⚠ ⌘ ♥ ↻); `allo.woff2` is the whole font and loads only for characters outside that
  range. If a page starts loading `allo.woff2`, add its character to the range: `static/fonts/allo.css` says how.
- The Avatar Studio (both versions) gets the link and its own font stacks from `src/character/patch_studio.py`
  (and `classic.css`; the agents' console sets Allo in `agent_studio.css`). The legacy banner (`functions/_middleware.js`) adds the stylesheet to the page, since a shadow
  root ignores `@font-face`; the itch.io zoo ad (`static/ads/zoo-ad.js`) loads the Latin file from grugdigital.com
  (`_headers` allows that). `src/ads/` renders its GIFs with it too (copy `allo-latin.woff2` next to the sources).

## Always send the owner a preview link (not just screenshots)

Work on a branch and push it (not `main`, unless the owner says to). Cloudflare Pages builds every pushed branch at
`https://<branch>.grugdigital.pages.dev/` (lower case, anything that isn't a letter or number turned into `-`, cut to 28
characters). Get the exact addresses from the commit's **Cloudflare Pages** check once it finishes:
`gh api repos/gabrielman25/grugdigital/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | {status, conclusion, summary: .output.summary}'`
and link straight to the pages that changed. A preview also falls back to the legacy site, so old pages work there too.

## The look: classic for the Arcade, modern for everything else

**The Arcade side is the only part of the site in the classic look.** Everything that isn't about the Arcade is modern
(the owner's call, November 2026). The players' Avatar Studio and the Pearls pages were left classic with the Arcade
they feed into; ask the owner before changing that.

**Modern** (`static/modern.css`): the home directory, `/restaurants/`, `/packs/`, `support.html`, `privacy.html`, `terms.html`, `404.html`,
`build/index.html`, plus `/agents/` and `/agents/studio/`, which carry their own copies. One system, three palettes set
with `data-theme` on `<html>`: none (light grey, ink, Grug's green: the directory and company pages), `dev` (near-black:
the developers), `rest` (white, warm ink, tomato: the restaurants). A sticky top bar (`.nav`: the mark, the section's
name, its links, one button), full-width bands on a 1120px column (`.sec`, `.sec-head`), left-aligned type in Allo,
bordered strips rather than rows of floating cards (`.facts`, `.steps`), flat buttons (`.btn`, `.btn.go` for the one main
action), the footer (`.foot`). On light pages the brand mark is `.mark` (the lime tile with the dino cut out). Numbered
steps only for a real sequence. Pictures of the restaurants' tools are drawn in CSS. The 88x31 stamps sit in the modern
footers. New non-Arcade pages use this file and add only their own pieces in a `<style>`.

**Classic** (a 2011-style games site): the Arcade (`/arcade/`, its game page and every game), the players' Avatar Studio
(`/character/`), and the Pearls and promo pages (`character/pearls/`, `tizzy/`, `itch/`). A 920px column over slow pans
of Grug City (`.bgfx`), the 728x90 house ad, the logo banner with the R6 crowd, the shiny green nav bar, the orange
announcement strip, dark shiny box tabs (`.StandardBoxHeader`) over light gradient boxes, shiny gradient buttons, the
social skyscrapers in the gutters, and the grey footer. No dark mode there.

In both looks: Allo (with Arial as the fallback, see above), **no coloured dots next to text and no coloured accent lines
or lips** (the owner finds them ugly), and **phones matter**: check every page at 390px wide. Under 940px
`arcade/arcade.css` (bottom block) reflows the classic column into one (scrolling nav, stacked columns, a 2-up tile grid,
the house ad zoomed to fit), and `modern.css` stacks its grids and hides the bar's links (the footer and the page carry them).

- `arcade/arcade.css` + `GrugArcade.chrome()` (`arcade/arcade.js`) are the classic header, background, side ads, Pearls
  button and footer. Keep the players' nav in step across `arcade/index.html` and `arcade/place/index.html` (Games with
  its genre menu, My Avatar, My Outfits, Grug Studio, Pearls, Help, Grug home). `chrome()` copes with a page that has no
  Games menu.
- The modern pages copy their top bar and footer in by hand too: keep the directory's (`index.html`, `support.html`, `privacy.html`,
  `terms.html`, `404.html`, `build/index.html`), the developers' (`agents/index.html`, `packs/index.html`) and the
  restaurants' (`restaurants/index.html`) in step with each other.
- `static/classic.css`: classic pieces outside the Arcade's own stylesheet (`.gbtn` buttons: green, `.gray`, `.claude`,
  `.blue`; `.Sec` tabbed boxes of any width; `.chips`). `static/legal.css`: the privacy/terms document, in the modern look.
- `static/site.css`: the classic look for the players' small card pages (`character/pearls/`, `tizzy/`, `itch/`): the city
  background fading into green, a `.site-top` logo + nav strip, boxes whose first `h2` becomes a dark shiny title bar.
- The players' Avatar Studio's theme is `src/character/classic.css` (the green nav as its top bar, with the logo; two
  rows on phones), put in by `patch_outfits.py`. Rebuild after changing it.
- Keep the nav in step on the small pages too (`.site-top` in `tizzy/`, `itch/`, `character/pearls/`).

## Partners, sponsors and the stamps

- **Warpdrive** (https://warpdrive.team/, an indie console family; our partner): `WDAD` in `arcade/arcade.js` builds their ads
  (styles: the Warpdrive block in `arcade/arcade.css`): a skyscraper on each side (in the rotation), the 728x90 banner and the
  300x250 box (each Warpdrive about half the time, the page's own ad otherwise) on the Arcade's classic pages, and a tile
  among the packs on `/packs/` (modern, written in that page's script).
  Pre-orders aren't open: the ads send people to see it, never "buy". Every link: `target=_blank rel="noopener sponsored"`.
- **KimiLand** (Roblox UGC sponsor): a skyscraper each side on the classic pages, and the sponsor box under the packs on `/packs/`.
- **The 88x31 stamps** (`static/stamps/`: Warpdrive → their site, YouTube and Discord → ours): `GrugArcade.chrome()` puts them
  top right of the banner and in the footer of every classic page; the small card pages have them as `.site-stamps`, and
  the modern pages have them in their footer (`.foot .stamps`).

## The itch.io asset list (`/packs/`)

`/api/itch-assets` (`functions/api/itch-assets.js` + `src/itch/itch.js`) reads https://polysw.itch.io/ and four itch
collections (the categories, by number in `ITCH.COLLECTIONS`). itch answers 429 to bursts: keep the requests one at a
time and cached, never fan out. `static/itch-assets.json` is the fallback; see README.md. itch cover URLs are signed per
size, so only the `315x250` covers itch gives us work: don't rewrite them to other sizes.

## Grug Studio (`/arcade/grug-studio/`): the Avatar Studio and a block builder on one baseplate

An Arcade game built from the Grug Baseplate template (same engine, light, plastic, camera, controls, GUI and NPC players;
the zoo stations swapped for two pads and a plot). You walk around a studded baseplate as your saved outfit. **Create an Avatar** (the green pad, or the top
button) zooms the camera in on you and opens the real Avatar Studio over the baseplate in a frame (`/character/?embed`,
`src/character/embed.js`): it opens the outfit you play as, and its **Wear it** button saves it
(`GrugStudio.saveAndPlay`, the same save as the arcade card) and messages the game, which dresses you and zooms out.
**Make a Building** (the blue pad) spawns the block builder kept from the retired Building Studio (`build/core.js`, generated from
`src/build/core.js` by `build.py`, wrapped as `window.GrugBuildCore` so its names don't clash with the game's), scaled by its figure (1.8 m = 5.2 studs) so it's true to size next to you;
the sliders change it live, and its settings are saved as `grug.build.v2`. The building stays in the game: there is no
painting or download step any more. The game's sky and baseplate match the Avatar Studio's, so the hand-over looks seamless.

## Games that play in your tab (`/arcade/tab/`) and the Arcade's categories

The Arcade has categories (`CATS` in `arcade/arcade.js`): Plays in Your Tab (3D games marked `tab: true`), 3D Games and
Nintendo DS Games (under construction, no games yet). They're listed in the left column of `/arcade/`, and a link
can open one directly (`#plays-in-your-tab`, `#3d-games`, `#ds-games`). (The "What do you feel like playing?" pop-up that
asked on arrival was taken off in November 2026 at the owner's request: don't bring it back unasked.) A tab game keeps going in the browser
tab (favicon + title) on the `GrugTab` engine (`arcade/tab/tab.js`): read section 8 of `arcade/claude.md`. The first is
**Sunny Patch** (`arcade/sunny-patch/`, a Baseplate game: the farm is `window.FarmCore`, saved in `grug.sunny-patch.v1`;
the player's settings in `grug.sunny-patch.player.v1`). It has no other players (just you and Poppy), solid black UI
panels, roofless buildings with interiors (Poppy's home, the Seed Shop, the Upgrade Shed, the Wardrobe) and a 50% default
3D resolution (a Game Settings button: 50 / 75 / 100%). The category's shown name is `TAB_BRAND` in `arcade/arcade.js`.

## Grug Arcade (`/arcade/`)

Games live in `arcade/<slug>/index.html`; follow `arcade/claude.md` (no title screens, flat classic UI, retro
animations, the player wears their saved outfit via `GrugOutfitRig`, Pearls only through `GrugPearls.reward` /
`GrugPearlPopup`, never a Pearl balance on screen). Every game's frame loop asks for the next frame first and catches a
frame's errors (`frameStep`/`loopStep` + a small wrapper, errors counted in `window.GrugLoopErrors`): a loop that scheduled
itself on its last line froze for good on any error while the Game Menu kept working. Keep it that way in new games. Saved outfits are `static/outfits.js` (IndexedDB `grug-outfits`,
active id `grug.outfit.active`); the studio's My outfits layer is `src/character/outfits.js`, put into
`character/index.html` by `patch_outfits.py` (also run by `patch_studio.py`/`build.py`).

## Player voices (`static/voice.js`): in every Arcade game

`window.GrugVoice` plays the voice actress's player lines (`static/voice/player/*.mp3`: jump, dodge, attack, death,
the laugh) for actions: jump, dodge, attack (a swing), hurt, death, fall (fell to death / off the map),
laugh (got an elimination). Each action has a chance, cooldown, delay, priority, volume/speed/pitch ranges and a clip
pool: all in `DEFAULTS` at the top of the file. Players pick their avatar's pitch (and speed) inside a safe zone
(`grug.voice.v1`); other players get a voice from their name (`voiceFor`).

**Every game has them** (November 2026; they started in Zone Royale). A game loads `/static/voice.js`, calls
`GrugVoice.attach(ctx, out)` once its AudioContext exists, and has a small `Voice` object just above `Snd`:
`Voice.say(who, line)` (you: your avatar voice; anyone else: `GrugVoice.say(line, { name, id, dest })`, from where they
stand) and, in most games, `Voice.died(who, killer)` (death or fall, and the killer's laugh). Monsters, zombies, bugs and
dummies don't speak. The Game Menu has a **Voices: On / Just mine / Off** button (`#mVoice`, `GrugVoice.menuButton`; a
`#sVoice` row in Slide 999; Zone Royale keeps its own voice settings rows), kept in `grug.voice.v1` for every game.
A new game gets all of this from the Starter (below): call `Voice.say` where the thing happens and leave the chances,
cooldowns and volumes to `DEFAULTS`.

The owner tunes it in the Voice Lab (`arcade/zone-royale/voice-lab/`, built from `src/voice/` by
`python3 src/voice/build.py`; rebuild after changing `static/voice.js`, `static/sfx.js` or the clips) and sends back its
exported JSON: put those values into `DEFAULTS` (and its `sfx` part into `static/sfx.js`, below). The lab's "Use in the
games" saves `grug.voice.tuning.v1` (and `grug.sfx.tuning.v1`), which override the defaults in that browser until reset
(Zone Royale's Game Settings shows a "Voice Lab tuning" row with the button).
**The voice cinematic** (`/arcade/zone-royale/?cinematic`): `Cine` in Zone Royale directs a hero (your voice and outfit)
and three rivals (names picked for a low, a high and a middle voice) through one shot per action on a clear stretch of the
spawn island; only the shot's action speaks, and every line plays. `python3 src/voice/build.py --cinematic FILE` writes a
single-file copy (voices built in, classic looks) to send around.

## The soft tap and the soft thud (`static/sfx.js`): the menu and falling-apart sounds

Every game used to share two loud sound files: `tick` (a ringing ping, played for menus, buttons and countdowns) and
`fall` (a plop, played when a character fell apart and when you respawned). The owner found them too loud: **both files
are gone from every game** (November 2026), replaced by `window.GrugSfx`, a small synth: `GrugSfx.tap(ctx, dest,
{ kind })` (a short, soft "tok"; kinds `select`, `open`, `close`, `count`, `deny`, `hover` are the same sound at another
pitch and length) and `GrugSfx.thud(ctx, dest)` (a low, soft thump with a puff of air; the voices carry the death
itself). In the games they are `Snd.play('tick' | 'click' | 'open' | 'close' | 'count')` and `Snd.play('oof', x, y, z)`
(`Snd.tap()` / `Snd.thud(v)` in Slide 999). Everything about how they sound is `DEFAULTS` at the top of the file
(volume, note, length, how far the note falls, brightness, the puff), tuned by ear in the Voice Lab's "Menu tap and
falling-apart thud" box, or from the console (`GrugSfx.setConfig({ tap: { volume: 0.06 } })`). Never bring the old files
back, and don't add a loud beep for a menu or a death in a new game.

## The Grug Starter (`/arcade/starter/`): the bare baseplate new games start from

`arcade/starter/index.html` is **generated** by `python3 src/starter/build.py` from the Grug Baseplate
(`arcade/baseplate/index.html`, the zoo of every station): the same engine with the stations taken out, so it is just
the baseplate, you, three other players (`NPCS`), a damage pad, a kill brick and a training dummy to swing at (F, a
click or a tap), which between them play every voice line and both soft sounds. Never hand-edit it: change the Baseplate
(the engine) or `src/starter/build.py` (what the Starter leaves out and adds) and run the build; it stops if the
Baseplate no longer matches what it expects. `--single FILE` also writes one self-contained file (three.js, the voices,
the sounds and the font built in; the Pearls wallet and saved outfits left out, so everyone wears the classic looks)
that plays opened from a disk: that is the file to send the owner when they ask for "the template". New games copy the
Starter (see `arcade/claude.md`, section 0); neither it nor the Baseplate is listed in the Arcade.

## Help and contact (`support.html`)

The modern customer support page (the directory's look), which took over the legacy `/support.html`: where to reach us
(Discord, text 954-459-6301), what to send (the purchase code from the bottom of `/character/pearls/`), common questions
by section (players, game developers, restaurants), the refund policy (`#refunds`: `terms.html` links to it; keep its
wording in step with the terms) and who we are. Every "Help" link on the site goes here.
