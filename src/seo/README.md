# Search and Google Images (`src/seo/`)

How Grug Digital's pages and promotional images are set up to show up in Google (and Google Images) for "Grug Digital",
and to look right when a link is shared on Discord, X, iMessage and other sites.

## What's in place

- **Descriptive file names** for the promotional images: `arcade/<slug>/<slug>-grug-arcade.jpg` (game covers),
  `static/showcase/grug-digital-avatar-<id>.webp` (character renders), `static/showcase/slide-999-km-…jpg` and
  `zombie-zones-…jpg` (game scenes), `static/arcade/grug-city-rp-…jpg` (Grug City), `static/og/…jpg` (share pictures).
  The old names (`cover.jpg`, `bg-slide-1.jpg`, `grug.webp`…) still work: `functions/_middleware.js` (`MOVED`)
  answers them with a permanent redirect, so old embeds and the itch.io ads already out there keep working.
- **Alt text** on every image that means something, saying what it shows and naming Grug Digital / the Grug Arcade /
  the Avatar Studio where that's true. Purely decorative copies (the crowd in the page banners, the hero art marked
  `aria-hidden`) keep `alt=""` on purpose, so screen readers don't read the same figures on every page.
- **Embedded photo metadata** (IPTC + XMP) in the promotional images only: title, description, keywords (each image's
  own plus "Grug Digital", "custom avatar", "Roblox alternative", "Roblox asset creator", "free 3D game assets"),
  Creator "Grug Digital", Credit Line "Grug Digital (grugdigital.com)", Copyright Notice and a link to the terms.
  Google Images shows the creator, credit and copyright from these. Textures, reference sheets, placeholders, the
  "before" figures in `static/slop/`, sponsor and third-party images are deliberately not tagged.
  `images.json` lists the tagged files and their texts; `python3 src/seo/tag_images.py` writes them (needs `exiftool`),
  `--check` shows what each file carries.
- **Share cards and structured data** in each page's `<head>`, between `<!-- seo -->` and `<!-- /seo -->`: Open Graph +
  Twitter cards, and JSON-LD (Grug Digital as the Organization with its logo and socials, the games as `VideoGame`,
  the two studios as `WebApplication`, and the promotional images as `ImageObject`s with creator, credit and copyright).
  The game page (`/arcade/place/?id=…`) adds its own canonical address and `VideoGame` data from its script.
- **`sitemap.xml`** (every page, with its images) and **`robots.txt`** pointing to it.

`python3 src/seo/seo_head.py` writes the head blocks, the sitemap and robots.txt. It's safe to re-run.

## When you…

- **add a game:** name its cover `<slug>-grug-arcade.jpg`, add the cover to `images.json`, run `tag_images.py`, then
  `seo_head.py` (it reads `GAMES` from `arcade/arcade.js`).
- **add or replace a promotional image:** give it a descriptive file name, add it to `images.json`, run `tag_images.py`
  (and `seo_head.py` if a page should list it).
- **rebuild the Avatar Studio or the Building Studio** (`src/character/build.py`, `src/build/build.py`): run
  `seo_head.py` again afterwards, since those pages are regenerated without the block.

After a deploy: submit `https://grugdigital.com/sitemap.xml` in Google Search Console, and check a page with the Rich
Results Test. Google re-crawls on its own schedule, so new images can take days to weeks to appear in Google Images.
