#!/usr/bin/env python3
"""The Arcade cover for Grug Baseplate 64, from the game itself: build/host/grug64-host writes cover.ppm (320 x 240, no
HUD); this crops it to 16:9 and enlarges it three times with hard pixel edges, so it looks like what you will play.

    make host && ./build/host/grug64-host /tmp/g64 && python3 tools/mkcover.py /tmp/g64/cover.ppm
Then tag it: python3 src/seo/tag_images.py (it is listed in src/seo/images.json)."""
import sys, os
from PIL import Image
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'arcade', 'grug-64', 'grug-64-grug-arcade.jpg')
im = Image.open(src).convert('RGB').crop((0, 30, 320, 210)).resize((960, 540), Image.NEAREST)
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out, quality=90)
print(os.path.normpath(out), im.size)
