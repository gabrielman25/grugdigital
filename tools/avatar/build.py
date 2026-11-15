#!/usr/bin/env python3
"""Builds assets/sandy-runtime.js: three.js r149 + GLTFLoader, the hats, the blocky avatar (model + skins) and SandyKit 2.
   python3 tools/avatar/build.py
   Sources: vendor/three-r149-gltf.js, vendor/hatpack.js (the classic hats), model/avatar.glb (made by convert.html from
   Kenney's characterMedium.fbx and its idle/run/jump animations), model/<skin>.png, src/kit.js."""
import base64, json, os
H = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(H))
rd = lambda *p: open(os.path.join(H, *p), encoding='utf-8').read()
b64 = lambda *p: base64.b64encode(open(os.path.join(H, *p), 'rb').read()).decode()
SKINS = ['skaterMaleA', 'skaterFemaleA', 'cyborgFemaleA', 'criminalMaleA']
pack = {'glb': 'data:model/gltf-binary;base64,' + b64('model', 'avatar.glb'),
        'skins': {s: 'data:image/png;base64,' + b64('model', s + '.png') for s in SKINS}}
out = '''/* Grug · sandy-runtime.js — the 3D avatar runtime: three.js r149, GLTFLoader, the blocky avatar (Kenney "Animated
   Characters: Protagonists", CC0) with its four skins, the hats, and window.SandyKit (version 2, the same API as before).
   BUILT FILE: edit tools/avatar/src/kit.js and run python3 tools/avatar/build.py. The archived classic avatar is
   assets/sandy-classic.js, which this loads on demand for a player who picked "Classic avatar". See tools/avatar/README.md. */
''' + rd('vendor', 'three-r149-gltf.js') + '\n;\n' + rd('vendor', 'hatpack.js').strip() + '\n;\nwindow.GRUG_AVATAR=' + json.dumps(pack) + ';\n' + rd('src', 'kit.js')
open(os.path.join(ROOT, 'assets', 'sandy-runtime.js'), 'w', encoding='utf-8').write(out)
print('assets/sandy-runtime.js', len(out) // 1024, 'KB')
