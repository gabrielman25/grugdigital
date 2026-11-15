/* Grug · the offline check for the two installable apps. Run from the repo root:

     node tools/pwa/check.js            (needs Playwright and Chrome: npm i playwright; CHROME=path if not /usr/bin/google-chrome)

   It serves the site on localhost, then for each app (Grug, Daypart):
     1. opens it the way the installed app does (?pwa=…, display-mode standalone) and waits for the downloads,
     2. checks every file in the app's packs is on the device,
     3. turns the network off and opens every page and game, failing on any file that couldn't load,
   then, for Grug, the update check: a changed file and a new game pack on the "server" must reach the device and
   show "New game ready to play offline". It restores app/offline.json afterwards. Exit code 1 if anything failed. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const LIST = path.join(ROOT, 'app/offline.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.obj': 'text/plain',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain' };
let listOverride = null;   // the update test serves its own offline list

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/app/offline.json' && listOverride) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(listOverride); }
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'max-age=0' });
  fs.createReadStream(f).pipe(res);
});

const fails = [];
const fail = (where, what) => { fails.push(where + ': ' + what); console.log('  FAIL', where, what); };

// The installed app, as far as the page can tell: display-mode standalone. A 12-year-old player who has been through
// the games onboarding, so game pages open straight away (and the mature placeholder game stays hidden).
const standalone = () => {
  const mm = window.matchMedia.bind(window);
  window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q);
};
const player = () => {
  try {
    const bd = '2013-04-02';
    if (!localStorage.getItem('grug.age.v1')) localStorage.setItem('grug.age.v1', JSON.stringify({ bd, raised: false }));
    const p = JSON.parse(localStorage.getItem('grug.profile.v1') || 'null');
    if (p && !(p.seen && p.seen.onboarded)) { p.seen = p.seen || {}; p.seen.onboarded = Date.now(); p.prefs = p.prefs || {}; p.prefs.birthday = bd; localStorage.setItem('grug.profile.v1', JSON.stringify(p)); }
  } catch (e) {}
};

async function waitSynced(page, timeout = 240000) {
  return page.evaluate(t => new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('no "synced" from the service worker in ' + t / 1000 + 's')), t);
    navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.type === 'synced' && !d.quiet) { clearTimeout(to); res(d); } });
  }), timeout);
}
async function cachedFiles(page) {
  return page.evaluate(async () => { const c = await caches.open('grug-files-v1'); return (await c.keys()).map(r => new URL(r.url).pathname); });
}

async function openOffline(ctx, base, url, label, check) {
  const page = await ctx.newPage(), bad = [];
  // a file that isn't on the site at all is a fallback some games try first (it fails online too): only real files count
  const real = p => { const f = path.join(ROOT, decodeURIComponent(p)); return fs.existsSync(f) && fs.statSync(f).isFile() || fs.existsSync(path.join(f, 'index.html')); };
  page.on('requestfailed', r => { const u = new URL(r.url()); if (u.origin === base && real(u.pathname)) bad.push(u.pathname + ' (' + (r.failure() || {}).errorText + ')'); });
  page.on('response', r => { const u = new URL(r.url()); if (u.origin === base && r.status() >= 400 && real(u.pathname)) bad.push(u.pathname + ' (' + r.status() + ')'); });
  page.on('frameattached', () => {});
  try {
    await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    const title = await page.title();
    if (/offline/i.test(title) && !/unknown page/.test(label)) fail(label, 'showed the offline page');
    if (check) { const why = await check(page); if (why) fail(label, why); }
  } catch (e) { fail(label, e.message.split('\n')[0]); }
  if (bad.length) fail(label, 'files that did not load offline: ' + [...new Set(bad)].join(', '));
  else console.log('  ok  ', label);
  await page.close();
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const index = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

  /* ---------- Grug ---------- */
  console.log('Grug (games)');
  let ctx = await browser.newContext();
  await ctx.addInitScript(standalone); await ctx.addInitScript(player);
  let page = await ctx.newPage();
  const notes = [];
  await page.exposeFunction('__note', t => notes.push(t));
  await page.addInitScript(() => { new MutationObserver(() => { const p = document.querySelector('.gapp-pill .t'); if (p && p.textContent !== window.__lastNote) { window.__lastNote = p.textContent; window.__note(p.textContent); } }).observe(document, { subtree: true, childList: true, characterData: true }); });
  await page.goto(base + '/?pwa=grug');
  const first = await waitSynced(page);
  console.log('  first download:', first.downloaded, 'files,', first.failed, 'failed');
  if (first.failed) fail('grug download', first.failed + ' files failed');
  const want = index.apps.grug.filter(id => index.packs[id].rating !== 'mature').flatMap(id => Object.keys(index.packs[id].files));
  const have = new Set(await cachedFiles(page));
  const missing = [...new Set(want)].filter(u => !have.has(u));
  if (missing.length) fail('grug packs', 'not on the device: ' + missing.join(', '));
  if (have.has('/play/placeholder18/game.html')) fail('grug packs', 'a mature game was downloaded for a 12-year-old');
  await page.waitForTimeout(800);
  if (!notes.some(t => /Ready to play offline/.test(t))) fail('grug note', 'never said "Ready to play offline" (saw: ' + notes.join(' | ') + ')');
  await page.close();

  await ctx.setOffline(true);
  const games = index.apps.grug.filter(id => id.startsWith('game:') && index.packs[id].rating !== 'mature').map(id => id.slice(5));
  const gameStarted = async p => {
    const f = p.frames().find(fr => /game\.html/.test(fr.url()));
    if (!f) return 'the game frame never loaded';
    const txt = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
    if (/needs the Grug avatar runtime/i.test(txt)) return 'the game could not load the avatar runtime';
    const canvas = await f.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
    return canvas ? null : 'no game canvas';
  };
  // the whole games side: home, the store, the avatar editor (and the classic one, its closet), the onboarding, Me, Make
  const pages = ['/', '/games/', '/games/favorites/', '/games/welcome/', '/me/', '/me/cards/', '/avatar/', '/avatar/classic/', '/shop/', '/profile/',
    '/make/', '/links/', '/links/create/', '/rewards/', '/rewards/create/', '/create/', '/create/modelkit/', '/pearls.html', '/games/carts/'];
  for (const u of pages) await openOffline(ctx, base, u, 'offline ' + u);
  // Play from a game's page, the way a player does: cartridge → console → game, all with no connection
  const launched = async p => {
    await p.waitForFunction(() => window.Fossil32 && window.Fossil32.launch, null, { timeout: 15000 }).catch(() => {});
    const id = new URL(p.url()).pathname.split('/').filter(Boolean)[1];
    await p.evaluate(id => window.Fossil32.launch(id), id).catch(() => {});
    for (let i = 0; i < 20 && !p.frames().some(f => /game\.html/.test(f.url())); i++) await p.waitForTimeout(1000);
    await p.waitForTimeout(3000);
    return gameStarted(p);
  };
  for (const g of games) {
    await openOffline(ctx, base, '/games/' + g + '/', 'offline Play from the store ' + g, launched);
    await openOffline(ctx, base, '/play/' + g + '/', 'offline play ' + g, gameStarted);
  }
  for (const c of fs.readdirSync(path.join(ROOT, 'games/carts/games')).filter(f => f.endsWith('.html')))
    await openOffline(ctx, base, '/games/carts/games/' + c, 'offline cart ' + c, async p => (await p.evaluate(() => !!document.querySelector('canvas'))) ? null : 'no game canvas');
  await openOffline(ctx, base, '/never-saved-page/', 'offline unknown page', async p => /offline/i.test(await p.title()) ? null : 'did not show the offline page');

  /* ---------- the update check ---------- */
  console.log('Update check');
  await ctx.setOffline(false);
  const next = JSON.parse(JSON.stringify(index));
  const changed = '/assets/gamekit.js';
  for (const id in next.packs) if (next.packs[id].files[changed]) next.packs[id].files[changed] = 'changed0001';
  next.packs['game:testgame'] = { title: 'Test Game', files: { '/games/runway/': 'testgame01' }, bytes: 1 };
  next.apps.grug.push('game:testgame'); next.v = 'test-update';
  listOverride = JSON.stringify(next);
  page = await ctx.newPage();
  const notes2 = [];
  await page.exposeFunction('__note', t => notes2.push(t));
  await page.addInitScript(() => { new MutationObserver(() => { const p = document.querySelector('.gapp-pill .t'); if (p && p.textContent !== window.__lastNote) { window.__lastNote = p.textContent; window.__note(p.textContent); } }).observe(document, { subtree: true, childList: true, characterData: true }); });
  await page.goto(base + '/games/');
  await page.waitForFunction(() => window.GrugApp);
  const upd = page.evaluate(() => new Promise(res => navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'synced' && !e.data.quiet) res(e.data); })));
  await page.evaluate(() => GrugApp.check());
  const u = await upd;
  console.log('  update:', JSON.stringify({ added: u.added, changed: u.changed, downloaded: u.downloaded }));
  const v = await page.evaluate(async c => { const r = await (await caches.open('grug-files-v1')).match(c); return r && r.headers.get('x-grug-v'); }, base + changed);
  if (v !== 'changed0001') fail('update', 'the changed file was not downloaded again (has ' + v + ')');
  if (!(u.added || []).includes('Test Game')) fail('update', 'the new game was not reported');
  await page.waitForTimeout(800);
  if (!notes2.some(t => /New game ready to play offline: Test Game/.test(t))) fail('update note', 'no "New game ready" note (saw: ' + notes2.join(' | ') + ')');
  else console.log('  ok   note:', notes2.find(t => /New game/.test(t)));
  listOverride = null;
  await ctx.close();

  /* ---------- Daypart ---------- */
  console.log('Daypart (restaurant)');
  ctx = await browser.newContext();
  await ctx.addInitScript(standalone);
  page = await ctx.newPage();
  // a restaurant made the way the owners' link makes one
  await page.goto(base + '/restaurant/?name=Test%20Tacos&type=f&owner=Rosa');
  await page.waitForTimeout(4000);
  await page.goto(base + '/business/?pwa=daypart');
  const d1 = await waitSynced(page);
  console.log('  first download:', d1.downloaded, 'files,', d1.failed, 'failed');
  const dwant = Object.keys(index.packs.daypart.files), dhave = new Set(await cachedFiles(page));
  const dmiss = dwant.filter(u => !dhave.has(u));
  if (dmiss.length) fail('daypart packs', 'not on the device: ' + dmiss.join(', '));
  await page.close();
  await ctx.setOffline(true);
  for (const u of ['/business/', '/business/site/', '/rewards/', '/rewards/create/'])
    await openOffline(ctx, base, u, 'offline ' + u, u === '/business/' ? async p => (await p.evaluate(() => !!window.__ready)) ? null : 'the dashboard did not start' : null);
  await ctx.close();

  await browser.close(); server.close();
  console.log(fails.length ? '\n' + fails.length + ' problem(s)' : '\nAll good');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
