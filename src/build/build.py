"""Builds the Grug Building Studio pages from the sources in this folder.

  python3 src/build/build.py                 # the site: build/index.html, build/examples/index.html, build/claude.md
  python3 src/build/build.py --standalone D  # also single-file copies (everything embedded) in folder D

Sources: core.js (the building + scene), gl.js (WebGL renderer, scale figure), reference.js (the Gemini reference sheet
and prompt), bake.js (line-up, bake, retro looks, .glb export), app.js (UI), api.js (window.GrugBuild + startup),
page.html / gallery.html (markup), guide.md (the guide for Claude), designs.json + stats.json (the examples).
The examples' files (.glb, thumbnails, Gemini paintings, reference sheets) live in build/examples/.
"""
import base64, html, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTFITS = '<script src="/static/outfits.js"></script>\n'


def fill(page, pairs):
    for k, v in pairs:
        assert page.count(k) == 1, k
        page = page.replace(k, v)
    return page


def studio(site):
    js = '\n'.join((HERE / f).read_text() for f in ['core.js', 'gl.js', 'reference.js', 'bake.js', 'app.js', 'api.js'])
    assert '</script' not in js
    return fill((HERE / 'page.html').read_text(), [
        ('/*FONT*/', (HERE / 'font.b64').read_text().strip()), ('/*MARK*/', (HERE / 'mark.txt').read_text().strip()),
        ('/*GUIDE*/', html.escape((HERE / 'guide.md').read_text())), ('/*HEADSCRIPTS*/', OUTFITS if site else ''), ('/*JS*/', js),
        ('/*CLASSIC*/', (HERE / 'classic.css').read_text())])


def gallery(site):
    core = (HERE / 'core.js').read_text()
    math, gljs = core[:core.index('/* ---------- the building')], (HERE / 'gl.js').read_text()
    designs, stats = json.loads((HERE / 'designs.json').read_text()), json.loads((HERE / 'stats.json').read_text())
    ex = ROOT / 'build' / 'examples'
    b64 = lambda p: base64.b64encode(p.read_bytes()).decode()
    data = []
    for x in designs:
        i = x['id']
        e = {'id': i, 'title': x['title'], 'era': x['era'], 'desc': x['desc'], 'p': x['p'], 'match': stats[i]['match'],
             'kb': (ex / f'{i}.glb').stat().st_size // 1024}
        if site:
            e.update(glbUrl=f'/build/examples/{i}.glb', ref=f'/build/examples/{i}-reference.png',
                     gemini=f'/build/examples/{i}-gemini.jpg', thumb=f'/build/examples/{i}-thumb.jpg')
        else:
            e.update(glb=b64(ex / f'{i}.glb'), ref='data:image/png;base64,' + b64(ex / f'{i}-reference.png'),
                     gemini='data:image/jpeg;base64,' + b64(ex / f'{i}-gemini.jpg'), thumb='data:image/jpeg;base64,' + b64(ex / f'{i}-thumb.jpg'))
        data.append(e)
    assert '</script' not in math + gljs
    return fill((HERE / 'gallery.html').read_text(), [
        ('/*FONT*/', (HERE / 'font.b64').read_text().strip()), ('/*MARK*/', (HERE / 'mark.txt').read_text().strip()),
        ('/*HEADSCRIPTS*/', OUTFITS if site else ''), ('/*MATH*/', math), ('/*GL*/', gljs),
        ('/*STUDIO*/', "'/build/' || " if site else ''), ('/*DATA*/', json.dumps(data).replace('<', '\\u003c')),
        ('/*CLASSIC*/', (HERE / 'classic.css').read_text())])


def main():
    out = ROOT / 'build'
    (out / 'index.html').write_text(studio(True))
    (out / 'examples' / 'index.html').write_text(gallery(True))
    (out / 'claude.md').write_text((HERE / 'guide.md').read_text())
    # the Building Studio's building, for the Grug Studio game (/arcade/grug-studio/): wrapped so its names stay its own
    (out / 'core.js').write_text('/* generated from src/build/core.js by src/build/build.py: the Building Studio\'s building, used by the\n'
        '   Grug Studio game (/arcade/grug-studio/) as window.GrugBuildCore. App.onChange runs after every change. */\n'
        'window.GrugBuildCore = (() => {\nconst App = {}, LOOKS = { realistic: 1 };\n' + (HERE / 'core.js').read_text() +
        '\nreturn { App, S, LIM, PRESETS, ROOFS, DOORS, ROLES, MARKS, AV, fixParams, setParams, world, meshFaces, markQuads, save };\n})();\n')
    print('site:', out / 'index.html', out / 'examples' / 'index.html', out / 'claude.md')
    if '--standalone' in sys.argv:
        d = pathlib.Path(sys.argv[sys.argv.index('--standalone') + 1]); d.mkdir(parents=True, exist_ok=True)
        (d / 'grug-building-studio.html').write_text(studio(False))
        (d / 'grug-building-examples.html').write_text(gallery(False))
        print('standalone:', d)


if __name__ == '__main__':
    main()
