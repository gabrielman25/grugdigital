# Grug

The Grug site: https://grugdigital.pages.dev/ (Cloudflare Pages, deploys on every push to `main`).

The site is being rebuilt from scratch on `main`. The old site is kept, unchanged, on the **`legacy`** branch.

## How the two fit together

- **`main`** is the new site. Right now it is just the home page (`index.html`, "under construction") with a button to
  the old site.
- **`legacy`** is the old site exactly as it was. Cloudflare deploys it to https://legacy.grugdigital.pages.dev.
- **`functions/_middleware.js`** joins them: any address that `main` doesn't have a file for is served from the legacy
  deploy, at the same address, with a banner on top saying it's the legacy version (linking to the new site). So every
  old link, QR code, NFC tag and installed app keeps working, and people keep their saved games, avatar and Pearls.
- The old home page is at **`/legacy`**.

## Building the new site

- Add files to `main` as usual. A file on `main` always wins over the legacy page at the same address, so building a new
  page at an old path (say `games/`) replaces the old one there.
- Until you mean to replace them, avoid the old site's top-level names: `alchemy app assets avatar business coco community
  crafthouse create for games labs links make managers me partners play profile restaurant rewards rodeo shop showcase
  site soluna teahouse tools work`, and `sw.js`, `offline.html`, `pearls.html`, `privacy.html`, `terms.html`,
  `support.html`, `credits.html`. `managers/` is printed on business cards: keep it working.
- The new site's own files so far live in `static/` (the Fredoka font and the background pattern).

## Changing the legacy site

Push to the `legacy` branch. It redeploys to the legacy address and the main address picks it up straight away.
