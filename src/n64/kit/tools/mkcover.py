#!/usr/bin/env python3
"""The Arcade cover for a Grug 64 game, from the game itself: its test script takes a shot called "cover" (320 x 240, no
HUD: game_hide_hud); this crops it to 16:9 and enlarges it three times with hard pixel edges, so it looks like what you
will play. Written to arcade/<game>/<game>-grug-arcade.jpg.

    make cover                 (in the game's folder: runs the test, then this)
    python3 ../kit/tools/mkcover.py build/shots/cover.ppm <game>
Then list it in src/seo/images.json and tag it: python3 src/seo/tag_images.py."""
import sys, os
from PIL import Image
src = sys.argv[1]
game = sys.argv[2] if len(sys.argv) > 2 else 'grug-64'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'arcade', game, game + '-grug-arcade.jpg')
im = Image.open(src).convert('RGB').crop((0, 30, 320, 210)).resize((960, 540), Image.NEAREST)
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out, quality=90)
print(os.path.normpath(out), im.size)
