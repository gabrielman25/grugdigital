"""Rebuild the Avatar Studio page and its agent guide from a new studio file.

    python3 src/character/build.py path/to/grug-avatar-studio.html

1. Patches the studio (patch_studio.py): "Make with Claude" sheet, agent instructions, window.GrugStudio, recipe links.
   Writes character/index.html.
2. Opens the result in headless Chrome (Playwright), reads GrugStudio.options() and writes character/claude.md from
   claude.md.tmpl, so the guide's option tables always match the studio.
Needs: python3, playwright (pip install playwright && playwright install chromium) or a local Chrome."""
import json, pathlib, subprocess, sys, threading, functools, http.server, asyncio, shutil

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
src = pathlib.Path(sys.argv[1]).resolve()
subprocess.run([sys.executable, str(HERE / 'patch_studio.py'), str(src), str(ROOT / 'character' / 'index.html')], check=True)

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{srv.server_address[1]}/character/'

async def read_options():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        chrome = shutil.which('google-chrome') or shutil.which('chromium')
        b = await p.chromium.launch(executable_path=chrome, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url); await pg.evaluate('GrugStudio.whenReady')
        o = await pg.evaluate('GrugStudio.options()')
        await b.close()
        if errs: print('page errors:', *errs, sep='\n  ')
        return o
o = asyncio.run(read_options())
srv.shutdown()

def numbered(lst):
    return '| # | Name |\n| --- | --- |\n' + '\n'.join(f'| {i} | {n} |' for i, n in enumerate(lst))
rep = {
    'HAIR': numbered(o['hair']),
    'HAIRCOLORS': '| Name | Hex |\n| --- | --- |\n' + '\n'.join(f'| {k} | `{v}` |' for k, v in o['hairColors'].items()),
    'HEADS': numbered(o['heads']),
    'SKINS': '| # | Name | Hex |\n| --- | --- | --- |\n' + '\n'.join(f"| {i} | {s['name']} | `{s['hex']}` |" for i, s in enumerate(o['skins'])),
    'EYES': numbered(o['eyes']) + '\n\nWith noticeable lashes (a common pick for a female character): 2, 4, 5, 10, 11, 15, 22, 27, 37. '
            'Simple: 6, 9, 21. Silly: 31, 33, 41, 42.',
    'BROWS': numbered(o['brows']),
    'MOUTHS': numbered(o['mouths']),
    'BODIES': ', '.join(f'`{b}`' for b in o['bodies']),
    'LOOKS': ', '.join(f'`{l}`' for l in o['looks']),
    'VIEWS': ', '.join(f'`{v}`' for v in o['views']),
}
t = (HERE / 'claude.md.tmpl').read_text(encoding='utf-8')
for k, v in rep.items(): t = t.replace('{{' + k + '}}', v)
assert '{{' not in t, 'unfilled placeholder in claude.md.tmpl'
(ROOT / 'character' / 'claude.md').write_text(t, encoding='utf-8')
print('wrote character/index.html and character/claude.md')
