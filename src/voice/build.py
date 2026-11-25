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
