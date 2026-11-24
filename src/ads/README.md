# Ad sources

`ad.html` (800×400) and `banner.html` (960×200) draw one frame for any time `t` with `render(t)`. To make the GIFs, put
these next to the images they use (`fredoka.woff2`, the `static/showcase/*.webp` renders as PNGs, the arcade covers,
and Avatar Studio screenshots `s01.jpg`…`s12.jpg` taken with `GrugStudio.set`/`wearTop`/`wearBottom`), then:

    ./mkgif.sh ad.html itch-ad.gif 15 15 13.25 800 400 256 60        # fps, seconds, start (the offer first), size, colours, lossy
    ./mkgif.sh banner.html itch-banner.gif 15 8 5.5 960 200 200 50

The loop starts on the offer so people with animated GIFs turned off on itch still see it.
