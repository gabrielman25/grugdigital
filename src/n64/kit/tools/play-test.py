#!/usr/bin/env python3
"""Play a Grug 64 game in the Arcade's own emulator, headless, and report what it did. The "measure it" step of
src/n64/README.md: run it after `make install`, before pushing.

    python3 src/n64/kit/tools/play-test.py <slug> [--outfit starter-racer] [--stress N] [--base URL] [--out DIR]

It serves the repo root itself (or plays --base, a deployed preview), opens arcade/<slug>/, presses Play, walks, jumps
and turns the camera, and prints: frames a second in the console's time, the time a frame takes in each part, polygons,
parts in the area, whether the outfit slot was worn, and the loudest sound at the emulator's output. Screenshots go to
DIR (default /tmp/grug64-play). It fails (exit 1) if the game never started, made no sound, or the page threw errors.

Needs: pip install playwright, and Chrome (it launches channel 'chrome'; set GRUG_CHANNEL=chromium for Playwright's
own). Outbound requests go through $HTTPS_PROXY when set (the emulator loads from cdn.emulatorjs.org).
The numbers come from game_stat (kit/game.h), found in the emulator's memory by its marker. Headless machines run the
emulator slower than a desktop, so read the frames a second as "at least"."""
import argparse, asyncio, functools, http.server, os, sys, threading, time

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('slug'); ap.add_argument('--outfit', help='an outfit id to wear (the starters: starter-grug, starter-racer, starter-skater, ...)')
ap.add_argument('--stress', help='start in the stress test with this many bricks (or "sweep")'); ap.add_argument('--base', help='play this site instead of serving the repo')
ap.add_argument('--out', default='/tmp/grug64-play'); ap.add_argument('--wait', type=float, default=14, help='seconds to let the emulator load')
A = ap.parse_args()
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
os.makedirs(A.out, exist_ok=True)

STAT = r'''() => { const M = window.EJS_emulator && window.EJS_emulator.Module, H = M && M.HEAPU8; if (!H) return null;
  if (window.__statAt === undefined || window.__statAt < 0 || H.buffer !== window.__statBuf) {   /* (look again until the game has written it) */ window.__statBuf = H.buffer; window.__statAt = -1; const pat = [0x47, 0x55, 0x52, 0x47, 0x31, 0x41, 0x54, 0x53];
    outer: for (let i = 0; i + 8 <= H.length; i += 4) { if (H[i] !== 0x47 || H[i + 1] !== 0x55) continue; for (let k = 2; k < 8; k++) if (H[i + k] !== pat[k]) continue outer; window.__statAt = i; break; } }
  if (window.__statAt < 0) return null; const u = new Uint32Array(H.buffer, window.__statAt, 14);
  return { frames: u[2], fps: u[3] / 100, parts: u[4], polys: u[5], ms: { update: u[6] / 10, world: u[7] / 10, characters: u[8] / 10, hud: u[9] / 10 }, outfit: !!u[10], stress: u[11] }; }'''
AUDIO = r'''window.GRUG_AUDIO_PEAK = 0;
(() => { const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...a) {
    try { if (dest && dest === this.context.destination && !this.__tapped) { this.__tapped = true; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an);
      const buf = new Float32Array(2048); setInterval(() => { an.getFloatTimeDomainData(buf); let p = 0; for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i])); if (p > window.GRUG_AUDIO_PEAK) window.GRUG_AUDIO_PEAK = p; }, 50); } } catch (e) {}
    return orig.call(this, dest, ...a); }; })();'''

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT)); threading.Thread(target=s.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{s.server_address[1]}'

async def main():
    from playwright.async_api import async_playwright
    base = (A.base or serve()).rstrip('/'); q = f'?stress={A.stress}' if A.stress else ''; url = f'{base}/arcade/{A.slug}/{q}'
    errs, fails = [], []
    async with async_playwright() as p:
        kw = dict(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        if os.environ.get('GRUG_CHANNEL', 'chrome') != 'chromium': kw['channel'] = 'chrome'
        if os.environ.get('HTTPS_PROXY'): kw['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}
        b = await p.chromium.launch(**kw); pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); await pg.add_init_script(AUDIO)
        await pg.goto(url, wait_until='load'); await pg.wait_for_timeout(1500)
        if A.outfit:
            await pg.evaluate("async id => { await GrugOutfits.list(); GrugOutfits.setActive(id); }", A.outfit)
            await pg.goto(url, wait_until='load'); await pg.wait_for_timeout(2500)
        side = await pg.evaluate("() => ({ title: document.title, rom: !!document.getElementById('rom'), wear: (document.getElementById('wear') || {}).textContent || '' })")
        print(f'page: {url}\n  title: {side["title"]}\n  Download ROM button: {"yes" if side["rom"] else "MISSING"}' + (f'\n  {side["wear"]}' if side['wear'] else ''))
        if not side['rom']: fails.append('no Download ROM button')
        await pg.click('#play'); t0 = time.time(); st = None
        clicked = False
        while time.time() - t0 < A.wait + 30:
            await pg.wait_for_timeout(1000); st = await pg.evaluate(STAT)
            if not clicked and time.time() - t0 > 8: clicked = True; await pg.mouse.click(760, 300)   # (the emulator waits for a click on it before it runs)
            if st and st['frames'] > 30 and time.time() - t0 > A.wait: break
        if not st:
            await pg.screenshot(path=f'{A.out}/0-never-started.png')
            fails.append('the game never started (no game_stat in the emulator\'s memory)')
        else:
            await pg.mouse.click(760, 300); await pg.wait_for_timeout(800); await pg.screenshot(path=f'{A.out}/1-start.png')
            async def hold(k, ms): await pg.keyboard.down(k); await pg.wait_for_timeout(ms); await pg.keyboard.up(k); await pg.wait_for_timeout(150)
            await hold('w', 1200); await hold('Space', 150); await pg.wait_for_timeout(500); await hold('a', 700); await hold('f', 150)
            if await pg.evaluate("!!window.GrugN64"): await pg.evaluate('GrugN64.look(300, -10)')
            await pg.wait_for_timeout(2500); await pg.screenshot(path=f'{A.out}/2-moved.png')
            st = await pg.evaluate(STAT); peak = await pg.evaluate('window.GRUG_AUDIO_PEAK')
            ms = st['ms']; print(f'  frames a second (console time): {st["fps"]:.1f}   (aim for 20 or better at the busiest spot; headless runs slower than a desktop)')
            print(f'  a frame: update {ms["update"]} ms, world {ms["world"]} ms, characters {ms["characters"]} ms, HUD {ms["hud"]} ms;  {st["polys"]} polygons')
            print(f'  parts in this area: {st["parts"]}' + ('' if st['stress'] else '  (goal 250, limit 300)') + (f'   [stress test: {st["stress"]} bricks]' if st['stress'] else ''))
            print(f'  outfit slot worn: {"yes" if st["outfit"] else "NO"}   loudest sound: {peak:.3f}' + ('' if peak > 0.01 else '  (SILENT)'))
            if peak <= 0.01: fails.append('no sound reached the emulator\'s output')
            if not st['outfit']: fails.append('the outfit slot was not worn')
        await b.close()
    if errs: fails.append('page errors: ' + ' | '.join(errs[:3]))
    print(f'  screenshots: {A.out}/1-start.png, 2-moved.png')
    print('OK' if not fails else 'FAILED: ' + '; '.join(fails)); sys.exit(1 if fails else 0)

asyncio.run(main())
