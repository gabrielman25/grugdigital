"""The block builder in the Grug Studio game (/arcade/grug-studio/): writes build/core.js from core.js.

    python3 src/build/build.py

The Building Studio (/build/: paint a building with Gemini, download a textured .glb, the example gallery, its agent
guide and its Claude skill) was retired in November 2026. What's left is its building geometry, core.js, which the game's
"Make a Building" pad still uses to grow a building on the plot at true scale. Here it is wrapped as
window.GrugBuildCore so its names stay its own. /build/ now shows a short "retired" page (build/index.html, written by
hand), and functions/_middleware.js sends the studio's other old addresses there. The whole studio is in the repository's
history (the last commit with it: 100f36c) if it is ever wanted back.
"""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def main():
    out = ROOT / 'build' / 'core.js'
    out.write_text('/* generated from src/build/core.js by src/build/build.py: the block builder kept from the retired Building Studio,\n'
        '   used by the Grug Studio game (/arcade/grug-studio/) as window.GrugBuildCore. App.onChange runs after every change. */\n'
        'window.GrugBuildCore = (() => {\nconst App = {}, LOOKS = { realistic: 1 };\n' + (HERE / 'core.js').read_text() +
        '\nreturn { App, S, LIM, PRESETS, ROOFS, DOORS, ROLES, MARKS, AV, fixParams, setParams, world, meshFaces, markQuads, save };\n})();\n')
    print('wrote', out.relative_to(ROOT))


if __name__ == '__main__':
    main()
