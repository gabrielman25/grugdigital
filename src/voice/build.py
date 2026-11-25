"""Builds the Voice Lab: arcade/zone-royale/voice-lab/index.html, one self-contained file.

    python3 src/voice/build.py [--out FILE]

It takes src/voice/voice-lab.html and puts in the voice engine (static/voice.js) and every clip in
static/voice/player/ (as data: URIs), so the same file works on the site and opened straight from a disk.
Rebuild after changing static/voice.js, the clips, or the lab. The lab's "Use in Zone Royale" button only reaches the
game when the lab is opened from the site (same address: localStorage 'grug.voice.tuning.v1').
"""
import base64, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open(os.path.join(ROOT, 'src/voice/voice-lab.html'), encoding='utf-8').read()
js = open(os.path.join(ROOT, 'static/voice.js'), encoding='utf-8').read()
clipdir = os.path.join(ROOT, 'static/voice/player')
clips = {f[:-4]: 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(clipdir, f), 'rb').read()).decode()
         for f in sorted(os.listdir(clipdir)) if f.endswith('.mp3')}
out = src.replace('<!--VOICE_JS-->', '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>', 1)
out = out.replace('/*CLIP_SRCS*/null', json.dumps(clips), 1)
dest = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'arcade/zone-royale/voice-lab/index.html')
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w', encoding='utf-8').write(out)
print('wrote', dest, len(out) // 1024, 'KB,', len(clips), 'clips')

# --cinematic FILE: also a single-file copy of Zone Royale that opens on the voice cinematic (?cinematic), with the voice
# engine and the clips built in, to send around. Without the site its characters wear the game's classic looks.
if '--cinematic' in sys.argv:
    PREVIEW = 'https://voice-lines-zone-royale.grugdigital.pages.dev/arcade/zone-royale/'
    game = open(os.path.join(ROOT, 'arcade/zone-royale/index.html'), encoding='utf-8').read()
    tag = '<script src="/static/voice.js"></script>'
    assert tag in game
    inline = ('<script>window.ZR_CINEMATIC = true; window.GRUG_VOICE_SRCS = ' + json.dumps(clips) + ';</script>\n<script>\n'
              + js.replace('</script', '<\\/script') + '\n</script>')
    game = game.replace(tag, inline, 1).replace('id="cineGame" class="ol" href="./"', 'id="cineGame" class="ol" href="' + PREVIEW + '" target="_blank"').replace('id="cineLab" class="ol" href="voice-lab/"', 'id="cineLab" class="ol" href="' + PREVIEW + 'voice-lab/" target="_blank"')
    cdest = sys.argv[sys.argv.index('--cinematic') + 1]
    open(cdest, 'w', encoding='utf-8').write(game)
    print('wrote', cdest, len(game) // 1024, 'KB')
