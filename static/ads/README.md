# Ads on itch.io

The ads on https://polysw.itch.io (every public project's description, the profile page and the asset zoos) all send
people to https://grugdigital.com/itch, which gives 275 bonus Pearls (the $4.99 pack) once per wallet
(`GrugPearls.CFG.promos.itch` in `static/pearls.js`).

- `itch-ad.gif` (800×400): the animated ad at the top of every project description and on the profile page, linked to
  `/itch`. The itch pages load it from here, so replacing this file updates every page (itch may cache it for a while).
- `itch-banner.gif` (960×200): the profile banner (uploaded to itch's theme editor, not linked: the URL is in the picture).
- `zoo-ad.js`: the interactive ad inside the asset zoos (the "Asset zoo / Asset preview" HTML uploads). Each zoo's
  `index.html` loads it with `<script src="https://grugdigital.com/static/ads/zoo-ad.js" defer></script>`.

The GIFs are rendered frame by frame from HTML in headless Chrome and encoded with ffmpeg + gifsicle; the sources are
in `src/ads/` (`ad.html`, `banner.html`, `render.py`, `mkgif.sh`).
