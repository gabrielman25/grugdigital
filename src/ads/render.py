import asyncio, sys, os
from playwright.async_api import async_playwright
# render.py page.html outdir fps seconds [W H] | or "keys t1,t2,..."
async def main():
    page, out, fps, secs = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    W = int(sys.argv[5]) if len(sys.argv)>5 else 800; H = int(sys.argv[6]) if len(sys.argv)>6 else 400
    keys = os.environ.get('KEYS')
    os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = await b.new_page(viewport={'width':W,'height':H})
        await pg.goto('file://'+os.path.abspath(page)); await pg.evaluate('window.READY')
        ts = [float(x) for x in keys.split(',')] if keys else [i/fps for i in range(int(round(fps*secs)))]
        for i,t in enumerate(ts):
            await pg.evaluate(f'render({t})')
            await pg.locator('#ad').screenshot(path=f'{out}/f{i:04d}.png')
        await b.close()
asyncio.run(main())
