"""Rebuild both versions of the Avatar Studio and the agent guide.

    python3 src/character/build.py path/to/grug-avatar-studio.html     a new studio file from the owner
    python3 src/character/build.py                                     no new studio: only the layers in this folder changed

1. The players' studio, character/index.html: from a new studio file (patch_studio.py: head, Pearls, window.GrugStudio,
   then the outfits, wardrobe, classic and players layers), or refreshed in place (patch_outfits.py) when no file is given.
2. The agents' studio, agents/studio/index.html: the same page with the console instead of the pickers (agent_studio.py).
3. The guide: opens the agents' studio in headless Chrome (Playwright), reads GrugStudio.options() and fills
   claude.md.tmpl, so its option tables always match the studio. Written to agents/studio/claude.md, and to
   character/claude.md, the address older prompts and installed skills still fetch.
Then run python3 src/seo/seo_head.py (the share cards live in the pages' heads and are rewritten by it).
Needs: python3, playwright (pip install playwright) and a local Chrome or Chromium."""
import json, pathlib, subprocess, sys, threading, functools, http.server, asyncio, shutil

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
if len(sys.argv) > 1:
    src = pathlib.Path(sys.argv[1]).resolve()
    subprocess.run([sys.executable, str(HERE / 'patch_studio.py'), str(src), str(ROOT / 'character' / 'index.html')], check=True)
else:
    subprocess.run([sys.executable, str(HERE / 'patch_outfits.py'), str(ROOT / 'character' / 'index.html')], check=True)
import agent_studio; agent_studio.build()

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{srv.server_address[1]}/agents/studio/'

async def read_options():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        chrome = shutil.which('google-chrome') or shutil.which('chromium')
        b = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
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
for out in ['agents/studio/claude.md', 'character/claude.md']: (ROOT / out).write_text(t, encoding='utf-8')
print('wrote character/index.html, agents/studio/index.html and the guide (agents/studio/claude.md, character/claude.md)')
