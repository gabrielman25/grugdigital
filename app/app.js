/* Grug · the installable apps (app/app.js)

   Two apps come from this one site, each with its own icon on the home screen:
     Grug     the games side      app/grug.webmanifest     opens /?pwa=grug
     Daypart  the restaurant side app/daypart.webmanifest  opens /business/?pwa=daypart
   theme.js loads this file on every site page (business/ loads it itself). It:

   - registers the service worker (sw.js) and gives each page the right manifest (Daypart on the restaurant side),
   - offers the install: window.GrugApp.install('grug' | 'daypart') shows the browser's own prompt where there is one
     (Android, desktop Chrome and Edge) and a short how-to everywhere else (iPhone and iPad: Share → Add to Home Screen),
   - inside an installed app, asks the service worker to keep that app's packs on the device (app/offline.json) and checks
     for updates when the app opens, when the connection comes back and every half hour while it stays open. New games and
     updates download by themselves; a note at the bottom says what happened (and offers Refresh when the open page is older),
   - on iPhone and iPad, where an installed app keeps its own save, apart from Safari: "Save a copy" before installing and
     "Load a copy" the first time the app opens. Pearls never move (they stay in the browser they were bought in).

   Download buttons and cards, for any page:
     <button data-get-app="grug" hidden>…<span data-app-ic></span>Download</button>   shown only where the app can be
        downloaded (not inside the installed app, not in shop or partner mode, not once it's installed in this browser);
        a tap downloads it. [data-app-ic] gets the download icon.
     <div data-app-card="grug" hidden></div>   filled with the Download card (what you get, its size, a Download button).
        Add data-app-status and, inside the installed app, it shows instead what is saved, when it last checked for
        updates, and a Check for updates button.

   Installed apps on this device are remembered in localStorage 'grug.apps.v1' ({grug: time, daypart: time}). */
(function () {
  'use strict';
  if (window.GrugApp || window !== window.top) return;
  const me = document.currentScript || document.getElementById('grug-app-js');
  const ROOT = new URL('../', (me && me.src) || location.href).href;          // the site root, with a trailing '/'
  const at = p => new URL(p, ROOT).href;
  const APPS_KEY = 'grug.apps.v1', SAVE_FORMAT = 'grug-device';
  const NAMES = { grug: 'Grug', daypart: 'Daypart' };

  /* ---------- where we are ---------- */
  const mm = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const standalone = () => mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)') || navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ANDROID = /Android/.test(ua), MAC = /Macintosh/.test(ua) && !IOS, FIREFOX = /Firefox|FxiOS/.test(ua);
  const SAFARI = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|FxiOS|OPR/.test(ua);
  const restaurantPage = () => {
    const p = location.pathname.slice(new URL(ROOT).pathname.length);
    return /^(business|restaurant)\//.test(p) || document.documentElement.getAttribute('data-account') === 'business';
  };
  // which app this window is: the start address says (?pwa=), and the tab remembers it
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const q = new URLSearchParams(location.search);
  if (q.has('pwa') && NAMES[q.get('pwa')]) {
    ss.set('grug.pwa', q.get('pwa'));
    q.delete('pwa');
    try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
  }
  const thisApp = () => standalone() ? (ss.get('grug.pwa') || (restaurantPage() ? 'daypart' : 'grug')) : null;

  const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const installed = () => readJSON(APPS_KEY, {}) || {};
  function remember(app) { const a = installed(); if (!a[app]) { a[app] = Date.now(); writeJSON(APPS_KEY, a); } }
  if (thisApp()) remember(thisApp());

  /* ---------- the manifest for this page ---------- */
  function setManifest() {
    const app = thisApp() || (restaurantPage() ? 'daypart' : 'grug');
    let l = document.querySelector('link[rel="manifest"]');
    if (!l) { l = document.createElement('link'); l.rel = 'manifest'; document.head.appendChild(l); }
    l.href = at('app/' + app + '.webmanifest');
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const i = document.createElement('link'); i.rel = 'apple-touch-icon'; i.href = at('app/icons/' + app + '-180.png'); document.head.appendChild(i);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; m.content = NAMES[app]; document.head.appendChild(m);
    }
    return app;
  }
  const pageApp = setManifest();

  /* ---------- the browser's own install prompt (Android, desktop Chrome / Edge) ---------- */
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { remember(pageApp); deferred = null; sync({ force: true }); note(NAMES[pageApp] + ' is on your home screen. It saves itself for offline the first time it opens.'); });

  /* ---------- the service worker ---------- */
  const SW = 'serviceWorker' in navigator && location.protocol !== 'file:';
  let loadedV = null, ready = null; const loadedAt = Date.now();
  if (SW) {
    ready = navigator.serviceWorker.register(at('sw.js'), { scope: ROOT }).then(() => navigator.serviceWorker.ready).catch(() => null);
    navigator.serviceWorker.addEventListener('message', e => onMessage(e.data || {}));
    ready.then(reg => { if (reg && reg.active) reg.active.postMessage({ type: 'status' }); });
  }
  const adult = () => { try { return !!(window.Grug && Grug.age && Grug.age.isAdult()); } catch (e) { return undefined; } };
  async function sync(opts) {
    if (!ready) return;
    const reg = await ready; if (!reg || !reg.active) return;
    const apps = Object.keys(installed()).filter(a => NAMES[a]);
    if (!apps.length) return;
    let a = adult(); if (!(window.Grug && Grug.age)) a = undefined;   // pages without grug.js (the dashboard) keep the last answer
    reg.active.postMessage(Object.assign({ type: 'sync', apps, adult: a }, opts || {}));
  }

  /* ---------- the notes at the bottom ---------- */
  let pill = null, pillT = 0;
  function css() {
    if (document.getElementById('grug-app-css')) return;
    const s = document.createElement('style'); s.id = 'grug-app-css';
    s.textContent = `
.gapp-pill{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + var(--gapp-lift,88px));transform:translate(-50%,12px);opacity:0;z-index:2147483000;
  display:flex;align-items:center;gap:.75rem;max-width:min(92vw,30rem);padding:.7rem .8rem .7rem 1rem;border-radius:999px;background:#1E1B16;color:#fff;
  font:500 .95rem/1.25 Fredoka,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .2s,transform .2s;pointer-events:none}
.gapp-pill.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.gapp-pill .t{flex:1;min-width:0}.gapp-pill .bar{display:block;height:.35rem;margin-top:.4rem;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}
.gapp-pill .bar i{display:block;height:100%;width:0;background:#9BE338;border-radius:99px;transition:width .25s}
.gapp-pill button{flex:none;border:0;border-radius:999px;padding:.45rem .9rem;font:600 .9rem Fredoka,system-ui,sans-serif;cursor:pointer;background:#FFBE1A;color:#1E1B16;box-shadow:0 3px 0 #D99A00}
.gapp-pill button.x{background:transparent;color:#fff;box-shadow:none;padding:.45rem .5rem;opacity:.7}
.gapp-scrim{position:fixed;inset:0;z-index:2147483001;background:rgba(10,10,12,.5);display:flex;align-items:flex-end;justify-content:center;padding:1rem}
@media (min-width:640px){.gapp-scrim{align-items:center}}
.gapp-card{width:min(100%,27rem);max-height:calc(100vh - 2rem);overflow:auto;background:var(--card-solid,#fff);color:var(--ink,#1E1B16);border-radius:1.4rem;padding:1.4rem 1.4rem 1.2rem;
  font:400 1rem/1.4 Fredoka,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.gapp-card .hd{display:flex;align-items:center;gap:.9rem;margin-bottom:.8rem}.gapp-card .hd img{width:3.2rem;height:3.2rem;border-radius:.9rem;flex:none}
.gapp-card h2{margin:0;font:600 1.3rem/1.2 Fredoka,system-ui,sans-serif;text-transform:none;letter-spacing:0;color:inherit}.gapp-card .hd small{display:block;opacity:.7;font-size:.9rem}
.gapp-card ol{margin:.4rem 0 1rem;padding-left:1.3rem}.gapp-card li{margin:.35rem 0}.gapp-card p{margin:.5rem 0}
.gapp-card .box{border:2px solid var(--line,#E4E4E8);border-radius:1rem;padding:.8rem .9rem;margin:.9rem 0}
.gapp-card .box b{display:block;margin-bottom:.2rem}.gapp-card .row{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.9rem}
.gapp-card button{border:0;border-radius:999px;padding:.65rem 1.1rem;font:600 1rem Fredoka,system-ui,sans-serif;cursor:pointer;background:#9BE338;color:#1E1B16;box-shadow:0 3px 0 #6FB31C}
.gapp-card button.q{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px var(--line,#E4E4E8)}
.gapp-card .k{display:inline-block;padding:0 .35rem;border-radius:.4rem;background:rgba(127,127,127,.15);font-weight:600}
.gapp-card .err{color:#C62F2F}
.gapp-ic{width:1.15em;height:1.15em;flex:none;vertical-align:-.18em}
[data-get-app] .gapp-ic{margin-right:.35em}
.gapp-card-box{display:block;margin:18px 0}
.gapp-card-in{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px;padding:18px 20px;border-radius:var(--r,20px);background:var(--card-solid,#fff);
  color:var(--ink,#1E1B16);border:1px solid var(--line,#E6E4DE);border-left:6px solid #FFBE1A;font-family:Fredoka,var(--font,system-ui),sans-serif}
.gapp-card-in>img{width:64px;height:64px;border-radius:16px;flex:none}
.gapp-tx{flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:3px}
.gapp-tx small{font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.6}
.gapp-tx b{font-size:clamp(20px,2.6vw,25px);font-weight:600;line-height:1.15;display:flex;align-items:center;gap:.35em}
.gapp-tx b .gapp-ic{color:#4E9A0E}
.gapp-tx span{font-size:15px;line-height:1.4;opacity:.85}
.gapp-tx .gapp-meta{font-size:13.5px;font-weight:600;opacity:.6}
.gapp-go{flex:none;display:inline-flex;align-items:center;gap:.4em;border:0;border-radius:999px;padding:.8rem 1.4rem;cursor:pointer;
  font:600 1.05rem Fredoka,system-ui,sans-serif;background:#FFBE1A;color:#1E1B16;box-shadow:0 4px 0 #D99A00}
.gapp-go:hover{filter:brightness(1.04)}.gapp-go:active{transform:translateY(2px);box-shadow:0 2px 0 #D99A00}
/* every Download button is Grug yellow (the Shop accent) so it stands out on white and on the section colours */
html [data-get-app]:not(.gapp-go),html .st-nav>[data-get-app].st-apps{background:#FFBE1A!important;color:#1E1B16!important;border-color:transparent!important;box-shadow:0 4px 0 #D99A00!important}
html [data-get-app]:not(.gapp-go):hover{filter:brightness(1.04)}
.gapp-go.q{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px var(--line,#E4E4E8)}
.gapp-go[disabled]{opacity:.55;cursor:default}
@media (max-width:520px){.gapp-go{width:100%;justify-content:center}.gapp-card-in{padding:16px}.gapp-card-in>img{width:48px;height:48px;border-radius:13px;align-self:flex-start}.gapp-tx{flex:1 1 calc(100% - 70px)}}`;
    document.head.appendChild(s);
  }
  function lift() {   // keep the note above the dock where there is one
    const d = document.querySelector('.g-dock,.gdock,.g-pbar');
    const h = d && d.offsetParent !== null ? d.getBoundingClientRect().height + 16 : 24;
    document.documentElement.style.setProperty('--gapp-lift', Math.round(h) + 'px');
  }
  function note(text, opts) {
    opts = opts || {};
    if (!document.body) return;
    css(); lift();
    if (!pill) { pill = document.createElement('div'); pill.className = 'gapp-pill'; pill.setAttribute('role', 'status'); pill.setAttribute('aria-live', 'polite'); document.body.appendChild(pill); }
    pill.innerHTML = '<span class="t"></span>' + (opts.action ? '<button type="button" class="go"></button>' : '') + (opts.stay ? '' : '<button type="button" class="x" aria-label="Close">Close</button>');
    pill.querySelector('.t').textContent = text;
    if (opts.progress != null) { const b = document.createElement('span'); b.className = 'bar'; b.innerHTML = '<i></i>'; b.firstChild.style.width = Math.round(opts.progress * 100) + '%'; pill.querySelector('.t').appendChild(b); }
    if (opts.action) { const g = pill.querySelector('.go'); g.textContent = opts.action; g.onclick = () => { hide(); opts.onAction(); }; }
    const x = pill.querySelector('.x'); if (x) x.onclick = hide;
    requestAnimationFrame(() => pill.classList.add('on'));
    clearTimeout(pillT);
    if (!opts.stay && !opts.action) pillT = setTimeout(hide, opts.ms || 5000);
  }
  function hide() { clearTimeout(pillT); if (pill) pill.classList.remove('on'); }

  /* ---------- what the service worker says ---------- */
  let showing = false;
  function onMessage(d) {
    if (d.type === 'status') { swState = d; paint(); }
    if (d.type === 'progress') { checking = true; paint(); }
    if (d.type === 'synced' || d.type === 'sync-failed') { checking = false; if (d.quiet) askStatus(); }
    const app = thisApp(); if (!app && d.type !== 'status') return;   // a browser tab stays quiet: downloads are the app's business
    const what = app === 'daypart' ? 'Daypart' : 'games';
    if (d.type === 'status') { if (loadedV == null) loadedV = d.v || ''; return; }
    if (d.type === 'synced') askStatus();
    if (d.type === 'progress' && d.total) {
      if (!d.firstTime && d.total < 3) return;   // a file or two: not worth a note
      showing = true;
      note((d.firstTime ? 'Saving ' + what + ' for offline' : 'Downloading an update') + ' · ' + Math.round(100 * d.done / d.total) + '%', { stay: true, progress: d.done / d.total });
      return;
    }
    if (d.type === 'synced') {
      if (d.quiet) { if (loadedV == null) loadedV = d.v; return; }
      // this page is older than what was just downloaded: it came from the device, or it has been open a while (a page
      // that just loaded online is already the newest)
      const older = d.changed > 0 && (window.__grugSaved || (loadedV && loadedV !== d.v && Date.now() - loadedAt > 120e3));
      if (d.added && d.added.length) {
        note('New ' + (d.added.length > 1 ? 'games' : 'game') + ' ready to play offline: ' + d.added.slice(0, 2).join(', ') + (d.added.length > 2 ? ' and ' + (d.added.length - 2) + ' more' : ''),
          older ? { action: 'Refresh', onAction: () => location.reload() } : { ms: 7000 });
      } else if (older) {
        note('An update is ready.', { action: 'Refresh', onAction: () => location.reload() });
      } else if (d.firstTime && d.complete) {
        note(app === 'daypart' ? 'Daypart works offline now.' : 'Ready to play offline.');
      } else if (d.failed && (d.firstTime || showing)) {
        note('Some files didn’t download. They’ll try again next time you’re online.', { ms: 7000 });
      } else if (showing) hide();
      showing = false;
      if (!older) loadedV = d.v;
    }
  }

  /* ---------- inside an installed app: keep it saved and up to date ---------- */
  function startApp() {
    const app = thisApp(); if (!app) return;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
    const saveData = navigator.connection && navigator.connection.saveData;
    const go = () => sync();
    if (saveData && !readJSON('grug.apps.ok', false)) {
      note('Save ' + (app === 'daypart' ? 'Daypart' : 'the games') + ' for offline? It uses data now, then works without a connection.',
        { action: 'Download', onAction: () => { writeJSON('grug.apps.ok', true); sync({ force: true }); } });
    } else setTimeout(go, 1500);
    addEventListener('online', () => sync({ force: true }));
    setInterval(go, 30 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
    if (ready) ready.then(async reg => {   // Chrome can also check in the background, about twice a day
      try { if (reg && reg.periodicSync) await reg.periodicSync.register('grug-sync', { minInterval: 12 * 3600e3 }); } catch (e) {}
    });
    if (IOS) firstRun(app);
  }

  /* ---------- iPhone and iPad: the app keeps its own save ---------- */
  // Everything this site keeps on the device, except Pearls (they never move: pearls.html) and the device's own records.
  const SKIP = k => /pearl/i.test(k) || k === 'grug.storetest' || k === APPS_KEY || k === 'grug.apps.ok' || k === 'grug.apps.welcomed';
  function saveCopy() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !SKIP(k)) keys[k] = localStorage.getItem(k); }
    const text = JSON.stringify({ format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), from: location.origin, keys });
    const name = 'grug-copy-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = (() => { try { return new File([text], name, { type: 'application/json' }); } catch (e) { return null; } })();
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {   // iPhone: the share sheet's Save to Files
      return navigator.share({ files: [file], title: 'Grug copy' }).then(() => true).catch(e => e && e.name === 'AbortError' ? false : download(text, name));
    }
    return Promise.resolve(download(text, name));
  }
  function download(text, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
  }
  function loadCopy(file) {
    return file.text().then(text => {
      let d; try { d = JSON.parse(text); } catch (e) { throw new Error('That isn’t a Grug copy. Pick the .json file you saved before adding the app.'); }
      if (!d || d.format !== SAVE_FORMAT || !d.keys || typeof d.keys !== 'object') throw new Error('That isn’t a Grug copy. Pick the .json file you saved before adding the app.');
      let n = 0;
      for (const [k, v] of Object.entries(d.keys)) { if (SKIP(k) || typeof v !== 'string') continue; try { localStorage.setItem(k, v); n++; } catch (e) {} }
      // open on this app's own account: Grug on the player, Daypart on the restaurant
      const b = readJSON('grug.business.v1', null), app = thisApp();
      if (b && app) { b.mode = app === 'daypart' && b.active ? 'business' : 'player'; writeJSON('grug.business.v1', b); }
      return n;
    });
  }
  // the first time the installed app opens on an iPhone or iPad with nothing saved in it yet
  function firstRun(app) {
    if (readJSON('grug.apps.welcomed', false)) return;
    const has = app === 'daypart' ? !!localStorage.getItem('grug.business.v1') || !!localStorage.getItem('daypart:settings') : !!localStorage.getItem('grug.profile.v1') && !!localStorage.getItem('grug.age.v1');
    writeJSON('grug.apps.welcomed', true);
    if (has) return;
    const go = () => sheet(app, 'welcome');
    if (document.readyState === 'complete') setTimeout(go, 600); else addEventListener('load', () => setTimeout(go, 600));
  }

  /* ---------- the sheet: install how-to, Save a copy, Load a copy ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function sheet(app, mode) {
    css();
    const name = NAMES[app], icon = at('app/icons/' + app + '-192.png');
    const scrim = document.createElement('div'); scrim.className = 'gapp-scrim';
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const pearlsLine = app === 'grug' ? ' Pearls stay where they were bought, so spend those here.' : '';
    let body = '';
    if (mode === 'welcome') {
      body = '<div class="hd"><img alt="" src="' + icon + '"><div><h2>Welcome to ' + name + '</h2><small>On this ' + (/iPad/.test(ua) ? 'iPad' : 'iPhone') + ', the app keeps its own save.</small></div></div>' +
        '<p>Used ' + name + ' in Safari before? Load the copy you saved to bring ' + (app === 'daypart' ? 'your restaurant’s records' : 'your avatar, saves and favorites') + ' over.' + (app === 'grug' ? ' Pearls don’t move: they stay in Safari.' : '') + '</p>' +
        '<p class="err" hidden></p><div class="row"><button type="button" data-a="load">Load a copy</button><button type="button" class="q" data-a="close">Start fresh</button></div>' +
        '<input type="file" accept=".json,application/json" hidden>';
    } else {
      const why = app === 'daypart' ? 'Open your dashboard from the home screen, full screen, and keep working when the Wi-Fi drops. It updates itself.' : 'Every game, the store and your avatar editor on your home screen. Open it once online and it saves everything, then plays with no connection and updates itself.';
      let steps;
      if (IOS) steps = '<ol><li>Tap <span class="k">Share</span> (the square with an arrow' + (SAFARI ? ', at the bottom or top of Safari' : '') + ').</li><li>Scroll down and tap <span class="k">Add to Home Screen</span>.</li><li>Leave <span class="k">Open as Web App</span> on, then tap <span class="k">Add</span>.</li></ol>';
      else if (ANDROID) steps = '<ol><li>Open the browser menu (<span class="k">⋮</span>).</li><li>Tap <span class="k">Install app</span> or <span class="k">Add to Home screen</span>.</li></ol>';
      else if (MAC && SAFARI) steps = '<ol><li>In the menu bar, choose <span class="k">File</span> → <span class="k">Add to Dock</span>.</li></ol>';
      else if (FIREFOX) steps = '<p>Firefox can’t add apps. Open this page in Chrome, Edge or Safari, then tap Download again.</p>';
      else steps = '<ol><li>Click the install button at the right end of the address bar, or open the browser menu.</li><li>Choose <span class="k">Install ' + name + '</span> (in Chrome: <span class="k">Cast, save and share</span> → <span class="k">Install page as app</span>).</li></ol>';
      const keep = IOS ? '<div class="box"><b>Bring your stuff with you</b>On iPhone and iPad the app keeps its own save, apart from Safari. Save a copy first, then open the app and tap Load a copy.' + pearlsLine +
        '<div class="row"><button type="button" data-a="save">Save a copy</button></div></div>' : '';
      body = '<div class="hd"><img alt="" src="' + icon + '"><div><h2>Download ' + name + '</h2><small>Free. No app store, no account.</small></div></div><p>' + why + '</p>' + steps + keep +
        '<div class="row"><button type="button" class="q" data-a="close">Done</button></div>';
    }
    scrim.innerHTML = '<div class="gapp-card" role="dialog" aria-modal="true" aria-label="' + esc(name) + '">' + body + '</div>';
    document.body.appendChild(scrim);
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', async e => {
      if (e.target === scrim) return close();
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') close();
      if (a === 'save') { const ok = await saveCopy(); if (ok) { b.textContent = 'Saved'; b.disabled = true; } }
      if (a === 'load') scrim.querySelector('input[type=file]').click();
    });
    const input = scrim.querySelector('input[type=file]');
    if (input) input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; if (!f) return;
      const err = scrim.querySelector('.err');
      try { await loadCopy(f); close(); location.reload(); }
      catch (e) { err.hidden = false; err.textContent = e.message; }
    });
    const first = scrim.querySelector('button'); if (first) first.focus();
  }

  async function install(app) {
    app = NAMES[app] ? app : pageApp;
    if (standalone() && thisApp() === app) return note('You’re already in the ' + NAMES[app] + ' app.');
    if (deferred && app === pageApp) {
      const d = deferred; deferred = null;
      try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') { remember(app); paint(); return; } } catch (e) {}
      return;
    }
    sheet(app, 'install');
  }

  /* ---------- Download buttons and cards ([data-get-app], [data-app-card]) ---------- */
  let swState = null, checking = false, sizes = null;
  async function askStatus() { const reg = ready && await ready; if (reg && reg.active) reg.active.postMessage({ type: 'status' }); }
  const off = () => { const h = document.documentElement; return h.hasAttribute('data-brand') || h.hasAttribute('data-partner'); };
  const canGet = app => !off() && !standalone() && !installed()[app];
  const inApp = app => standalone() && thisApp() === app;
  const DL = '<svg class="gapp-ic" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0Zm-108.49,8.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0-17-17L140,115V32a12,12,0,0,0-24,0v83L96.49,95.51a12,12,0,0,0-17,17Z"/></svg>';
  const CHECK = '<svg class="gapp-ic" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/></svg>';
  // how big each app's download is, from the offline list (fetched once, only when a card needs it)
  function loadSizes() {
    if (sizes || navigator.onLine === false) return; sizes = {};
    fetch(at('app/offline.json'), { cache: 'no-cache' }).then(r => r.json()).then(ix => {
      const grown = adult() === true;
      for (const a of Object.keys(ix.apps || {})) {
        const ids = ix.apps[a].filter(id => ix.packs[id] && (grown || ix.packs[id].rating !== 'mature'));
        sizes[a] = { bytes: ids.reduce((n, id) => n + (ix.packs[id].bytes || 0), 0), games: ids.filter(id => id.startsWith('game:')).length, carts: ids.includes('carts') };
      }
      paint(true);
    }).catch(() => { sizes = null; });
  }
  const mb = b => b >= 1e6 ? 'About ' + Math.max(1, Math.round(b / 1e6)) + ' MB' : 'Under 1 MB';
  const COPY = {
    grug: { label: 'The Grug app', title: 'Download Grug', text: 'Every game, the game store and your avatar editor, saved on this device. Plays with no Wi-Fi, and updates itself whenever the site does. Free, no app store.' },
    daypart: { label: 'The Daypart app', title: 'Download Daypart', text: 'Your schedule, time clock, temperatures, checklists and paperwork as an app on this device. Keeps working when the Wi-Fi drops, and updates itself. Free, no app store.' },
  };
  function cardHtml(app, el) {
    const c = COPY[app], icon = at('app/icons/' + app + '-192.png');
    if (inApp(app)) {
      if (!el.hasAttribute('data-app-status')) return '';
      const st = swState || {}, w = st.wanted || [], n = w.filter(id => id.startsWith('game:')).length;
      const what = app === 'grug' ? (n ? n + ' games' + (w.includes('carts') ? ', Carts' : '') + ', the store and your avatar editor' : 'The games, the store and your avatar editor') : 'Your dashboard, website editor and rewards card';
      const when = st.at ? new Date(st.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
      const line = checking ? 'Checking for updates…' : st.at ? (st.complete ? 'Up to date. Last checked ' + when + '.' : 'Some files are still downloading. Last tried ' + when + '.') : 'Saving for offline…';
      return '<div class="gapp-card-in"><img alt="" src="' + icon + '"><div class="gapp-tx"><small>' + c.label + '</small><b>' + CHECK + 'Saved on this device</b>' +
        '<span>' + what + ' work with no connection' + (st.bytes ? ' (' + mb(st.bytes).replace('About ', 'about ') + ')' : '') + '.</span><span class="gapp-meta">' + line + '</span></div>' +
        '<button type="button" class="gapp-go q" data-app-check' + (checking ? ' disabled' : '') + '>Check for updates</button></div>';
    }
    if (!canGet(app)) return '';
    const sz = sizes && sizes[app];
    return '<div class="gapp-card-in"><img alt="" src="' + icon + '"><div class="gapp-tx"><small>' + c.label + '</small><b>' + c.title + '</b><span>' + c.text + '</span>' +
      (sz ? '<span class="gapp-meta">' + mb(sz.bytes) + (app === 'grug' ? ' · ' + sz.games + ' games and ' + (sz.carts ? 'every Cart' : 'more') : '') + '</span>' : '') + '</div>' +
      '<button type="button" class="gapp-go" data-get-app="' + app + '">' + DL + 'Download</button></div>';
  }
  let painting = false;
  function paint(force) {
    if (painting || !document.body) return; painting = true;
    try {
      css();
      document.querySelectorAll('[data-get-app]').forEach(b => {
        if (b.closest('[data-app-card]')) return;
        b.hidden = !canGet(b.dataset.getApp);
        const ic = b.querySelector('[data-app-ic]'); if (ic && !ic.firstChild) ic.innerHTML = DL;
      });
      document.querySelectorAll('[data-app-card]').forEach(el => {
        const app = el.dataset.appCard; if (!COPY[app]) return;
        if (!sizes && !inApp(app)) loadSizes();   // the Download card says how big it is; the app's own card doesn't need to
        const html = cardHtml(app, el);
        if (force === true || el.__gapp !== html) { el.__gapp = html; el.innerHTML = html; }
        el.hidden = !html; el.classList.add('gapp-card-box');
      });
    } finally { painting = false; }
  }
  // taps on any Download / Check for updates button, wherever it is
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-get-app]'); if (g) { e.preventDefault(); install(g.dataset.getApp); return; }
    const c = e.target.closest('[data-app-check]'); if (c) { e.preventDefault(); checking = true; paint(); sync({ force: true }); }
  });
  // pages that draw themselves (the dashboard, the Me list) add buttons and cards later: fill those in as they appear
  let paintQueued = false;
  new MutationObserver(muts => {
    if (painting || paintQueued) return;
    if (!muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches('[data-get-app],[data-app-card]') || n.querySelector('[data-get-app],[data-app-card]'))))) return;
    paintQueued = true; requestAnimationFrame(() => { paintQueued = false; paint(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => paint()); else paint();
  addEventListener('load', () => paint());
  addEventListener('appinstalled', () => setTimeout(paint, 50));

  window.GrugApp = {
    install,                                     // GrugApp.install('grug' | 'daypart')
    standalone,                                  // true inside an installed app
    app: thisApp,                                // 'grug' | 'daypart' inside an installed app, else null
    installed: () => Object.keys(installed()),   // the apps opened on this device
    canPrompt: () => !!deferred,
    check: () => sync({ force: true }),          // ask for the newest files now
    paint,                                       // redraw the Download buttons and cards
    saveCopy, loadCopy: f => loadCopy(f),
  };

  if (thisApp()) {
    document.documentElement.classList.add('g-app');
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp); else startApp();
  } else if (Object.keys(installed()).length) setTimeout(() => sync(), 4000);   // a browser tab on a device with the app: keep it current too
})();
