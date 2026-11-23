"""Build the Avatar Studio wardrobe (/character/wardrobe/): tops and bottoms with avatar previews.

    python3 src/character/wardrobe.py <folder of Gemini pictures> [outfits.json]

The folder holds one painted picture per outfit, named <id>.png (or .jpg/.webp), made in Gemini from the studio's
reference picture and prompt. outfits.json lists {id, name, theme, desc} for each (default: wardrobe/outfits.json in the
folder, else character/wardrobe/outfits.json). For every picture this runs the studio headless (serve the repo on
localhost:8765 first: `python3 -m http.server 8765` from the repo root), lines the picture up with GrugStudio.wear(),
and writes character/wardrobe/<id>/shirt.webp + pants.webp (the Roblox 585x559 templates) and top.webp + bottom.webp
(a Grug wearing just the top, or just the bottoms, over plain basics). The game looks in character/looks/ are added too.
character/wardrobe/wardrobe.json is the catalog the studio reads (src/character/wardrobe.js)."""
import asyncio, base64, io, json, pathlib, sys
from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'character' / 'wardrobe'
URL = 'http://localhost:8765/character/'
LOOK = dict(reset=True, name='Grug', skin='#eab892', head='Heart', hair='Crop', hairColor='#4a2c1a', eyes=6, brows=2, mouth=6)
MIN_MATCH = 0.75
THEMES = ['Casual', 'Streetwear', 'Sports', 'Work', 'Formal', 'Fantasy', 'Sci-Fi', 'Spooky', 'Outdoors', 'Retro', 'Grug games']

SETUP = r"""() => {
  // plain basics worn under a single piece in its preview: a light grey tee, charcoal trousers with dark shoes
  const fill = (c, rects, col) => { const x = c.getContext('2d'); x.fillStyle = col; rects.forEach(([a, b, w, h]) => x.fillRect(a, b, w, h)); };
  const tee = cnv(TW, TH), arms = r => [r.F, r.B, r.L, r.R].map(([a, b, w, h]) => [a, b, w, h * 0.42]).concat([r.U]);
  fill(tee, Object.values(TORSO), '#d8d8d2'); fill(tee, arms(RLIMB).concat(arms(LLIMB)), '#d8d8d2');
  const jeans = cnv(TW, TH); fill(jeans, Object.values(RLIMB).concat(Object.values(LLIMB)), '#4b4f58');
  fill(jeans, [RLIMB, LLIMB].flatMap(r => [r.F, r.B, r.L, r.R].map(([a, b, w, h]) => [a, b + h - 18, w, 18])).concat([RLIMB.D, LLIMB.D]), '#24252a');
  window.__basic = { tee, jeans };
  window.__shot = () => {   // renderThumb() with a see-through background
    renderThumb();
    const gl = thumbR.gl, rgb = hexRgb($('#skin').value), comp = composites(state.shirt, state.pants, rgb, { shirt: true, pants: true });
    const tx = { upper: thumbR.tex(comp.upper), legs: thumbR.tex(comp.legs), head: thumbR.tex(state.head ? state.head.open : headTex(rgb)), tint: [1,1,1], skin: rgb.map(v => v/255) };
    gl.viewport(0, 0, 480, 480); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = m4persp(30*D2R, 1, 0.1, 100), mv = m4mul(m4T(0, 0, -11.5), m4mul(m4RX(0.16), m4mul(m4RY(-0.55), m4T(0, -2.6, 0))));
    thumbR.drawChar(mv, P, tx); [tx.upper, tx.legs, tx.head].forEach(t => gl.deleteTexture(t));
    return thumbC.toDataURL('image/png');
  };
  window.__load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = cnv(TW, TH); c.getContext('2d').drawImage(i, 0, 0); res(c); }; i.onerror = rej; i.src = src; });
  window.__wearPair = (s, p) => { state.rawShirt = s; state.rawPants = p; alignedData = null; state.built = true; applyFX(); };
  window.__previews = async (shirtSrc, pantsSrc) => {
    const s = await __load(shirtSrc), p = await __load(pantsSrc);
    __wearPair(s, __basic.jeans); const top = __shot();
    __wearPair(__basic.tee, p); const bottom = __shot();
    return { top, bottom };
  };
}"""

def b64img(d):
    return Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1])))

def save_preview(im, path):
    im = im.convert('RGBA'); box = im.getchannel('A').getbbox()
    if box:
        l, t, r, b = box; pad = 10; side = max(r - l, b - t) + 2 * pad; cx, cy = (l + r) // 2, (t + b) // 2
        im = im.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))
    im.resize((300, 300), Image.LANCZOS).save(path, 'WEBP', quality=88, method=6)

def save_tex(im, path):
    im.convert('RGBA').save(path, 'WEBP', quality=92, method=6)

async def main(src, spec):
    items = json.loads(spec.read_text()) if spec and spec.exists() else []
    old = json.loads((OUT / 'wardrobe.json').read_text()) if (OUT / 'wardrobe.json').exists() else {'items': []}
    done = {i['id']: i for i in old['items']}
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await br.new_page(viewport={'width': 1300, 'height': 900})
        await pg.goto(URL); await pg.evaluate('GrugStudio.whenReady')
        await pg.evaluate(f'GrugStudio.set({json.dumps(LOOK)})'); await pg.evaluate(SETUP)
        for it in items:
            pic = next((src / f"{it['id']}{e}" for e in ('.png', '.jpg', '.jpeg', '.webp') if (src / f"{it['id']}{e}").exists()), None)
            if not pic: continue
            d = OUT / it['id']
            if (d / 'shirt.webp').exists() and (d / 'shirt.webp').stat().st_mtime > pic.stat().st_mtime and it['id'] in done: continue   # already built
            d.mkdir(parents=True, exist_ok=True)
            mime = 'image/png' if pic.suffix == '.png' else 'image/jpeg' if pic.suffix in ('.jpg', '.jpeg') else 'image/webp'
            data = f'data:{mime};base64,' + base64.b64encode(pic.read_bytes()).decode()
            r = await pg.evaluate('async d => { const r = await GrugStudio.wear(d); return { match: r.match, shirt: state.rawShirt.toDataURL(), pants: state.rawPants.toDataURL() }; }', data)
            if (r['match'] or 0) < MIN_MATCH:   # Gemini moved the blocks: leave it out (repaint it and run again)
                print(f"{it['id']:16} match {r['match']:.3f}  SKIPPED (below {MIN_MATCH})", flush=True); done.pop(it['id'], None); continue
            save_tex(b64img(r['shirt']), d / 'shirt.webp'); save_tex(b64img(r['pants']), d / 'pants.webp')
            pv = await pg.evaluate('([s, p]) => __previews(s, p)', [r['shirt'], r['pants']])
            save_preview(b64img(pv['top']), d / 'top.webp'); save_preview(b64img(pv['bottom']), d / 'bottom.webp')
            done[it['id']] = {'id': it['id'], 'name': it['name'], 'theme': it['theme'], 'desc': it['desc'], 'match': round(r['match'] or 0, 3)}
            print(f"{it['id']:16} match {r['match']:.3f}", flush=True)
        # the game looks (character/looks/): already templates, just need previews
        for k in json.loads((ROOT / 'character/looks/looks.json').read_text()):
            lid = 'look-' + k['id']; d = OUT / lid; d.mkdir(parents=True, exist_ok=True)
            pv = await pg.evaluate('([s, p]) => __previews(s, p)', [f"/character/looks/{k['id']}/shirt.png", f"/character/looks/{k['id']}/pants.png"])
            save_preview(b64img(pv['top']), d / 'top.webp'); save_preview(b64img(pv['bottom']), d / 'bottom.webp')
            done[lid] = {'id': lid, 'name': k['name'], 'theme': 'Grug games', 'desc': k['look'].get('outfit', ''), 'look': k['id']}
        await br.close()
    order = {t: i for i, t in enumerate(THEMES)}
    out = sorted(done.values(), key=lambda i: (order.get(i['theme'], 99), [x['id'] for x in items].index(i['id']) if i['id'] in [x['id'] for x in items] else 0))
    (OUT / 'wardrobe.json').write_text(json.dumps({'themes': THEMES, 'items': out}, indent=1, ensure_ascii=False) + '\n')
    print(len(out), 'items in', OUT / 'wardrobe.json')

if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
    spec = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else (src / 'outfits.json' if (src / 'outfits.json').exists() else OUT / 'outfits.json')
    asyncio.run(main(src, spec))
