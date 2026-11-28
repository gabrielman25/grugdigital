/* Grug · the 3D store (/store/<itch username>). One creator's public itch.io catalog, stocked into a little shop built
   from Kenney's Mini Shop and Mini Arcade (static/store/kenney/, CC0), that customers walk around as a character.

   - The catalog comes from /api/itch-store (functions/api/itch-store.js). Covers come through /api/itch-img (itch's
     image server has no CORS, and WebGL needs it to paint them onto the displays).
   - Every product has its own booth, and the display depends on what it is: an asset pack is a boxed product on a
     plinth (the cover printed on the box, the name on its side, a 3D price tag on the plinth); a game is an arcade
     cabinet (the cover on its screen, the name on its marquee) with a poster stand; a tool is a vending machine (the
     cover behind the glass). The arcade is at the back, on its own floor.
   - You walk with the thumb stick (touch), WASD or the arrow keys, or by tapping or clicking the floor or a display.
     Next to a product a bar shows its name and price, and Open (or E) opens its itch.io page in a new tab.
     Dragging turns the camera; pinching or the wheel zooms; the house button shows the whole store.
   - Out the front door is the mall (static/store/mall.js): other creators' storefronts along a corridor.
   - ?spawn=<project slug> starts you in front of that product with a "You are here" sign (the itch.io embed zips set
     it, one per page); ?ref=<itch page address> does the same when itch passes the page's address; ?from=door starts
     you just inside the door (coming in from the mall). ?embed=1 is the version inside an itch.io page: no site bar,
     a small "Made with Grug" badge, and it tells the zip around it that it loaded (the zip shows a link to the
     creator's itch page instead if that never happens). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  const EMBED = Q.has('embed');
  const PATH_USER = (location.pathname.match(/^\/store\/([A-Za-z0-9_-]+)\/?$/) || [])[1] || Q.get('u') || '';
  const DEMO = 'polysw';
  const USER = (PATH_USER || DEMO).toLowerCase();
  const LANDING = !PATH_USER && !EMBED;
  let SPAWN = (Q.get('spawn') || '').toLowerCase();
  const REF = Q.get('ref') || '';
  if (!SPAWN && REF) {
    const m = REF.match(new RegExp('^https?://' + USER.replace(/-/g, '\\-') + '\\.itch\\.io/([^/?#]+)', 'i'));
    if (m) SPAWN = m[1].toLowerCase();
  }
  const TOUCH = matchMedia('(hover: none)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONT = 'Allo, Arial, Helvetica, sans-serif';
  const free = it => !it.price || /^free$/i.test(it.price) || /^\D*0(\.00)?$/.test(it.price);
  const priceText = it => free(it) ? 'Free' : it.price;

  try { if (window.parent !== window) window.parent.postMessage({ grugStore: 'ready', user: USER }, '*'); } catch (e) {}

  if (TOUCH) document.body.classList.add('touch');
  if (EMBED) { $('#madeWith').hidden = false; if (document.fullscreenEnabled) $('#fullBtn').hidden = false; }
  else { $('#sbar').hidden = false; document.body.classList.add('has-bar'); }

  /* ---------------- loading veil ---------------- */
  const veil = {
    progress(f) { $('#prog i').style.width = Math.round(Math.min(1, f) * 100) + '%'; },
    fail(title, text, withForm) {
      $('#veilTitle').textContent = title;
      $('#veilText').textContent = text;
      $('#prog').hidden = true;
      const a = $('#veilActs');
      a.hidden = false;
      a.innerHTML = (withForm && !EMBED ? '<button class="btn go big wide" id="vMake" type="button">Try another username</button>' : '') +
        '<button class="btn wide" id="vRetry" type="button">Try again</button>' +
        (EMBED ? '<a class="btn wide" target="_blank" rel="noopener" href="https://' + esc(USER) + '.itch.io/">Open the itch.io page</a>' : '');
      $('#vRetry').onclick = () => location.reload();
      if ($('#vMake')) $('#vMake').onclick = () => { $('#veil').classList.add('gone'); Panels.open('make'); $('#userIn').focus(); };
    },
    done() { $('#veil').classList.add('gone'); },
  };

  /* ---------------- the models ---------------- */
  const PACK = {
    'floor-wood': 'mini-shop', 'wall': 'mini-shop', 'wall-window': 'mini-shop', 'wall-door-rotate': 'mini-shop', 'column': 'mini-shop',
    'cash-register': 'mini-shop', 'shopping-cart': 'mini-shop', 'shopping-basket': 'mini-shop', 'character-employee': 'mini-shop',
    'shelf-boxes': 'mini-shop', 'shelf-bags': 'mini-shop', 'display-flowers': 'mini-shop', 'display-fruit': 'mini-shop',
    'freezers-standing': 'mini-shop', 'gacha-machine': 'mini-shop', 'floor': 'mini-shop',
    'arcade-machine': 'mini-arcade', 'vending-machine': 'mini-arcade', 'claw-machine': 'mini-arcade',
    'prize-wheel': 'mini-arcade', 'basketball-game': 'mini-arcade', 'character-gamer': 'mini-arcade', 'ticket-machine': 'mini-arcade',
  };
  const ARCADE_FLOOR = 'arcade-floor';
  const loader = new THREE.GLTFLoader();
  const models = {};
  function loadModels(onStep) {
    const list = Object.keys(PACK).map(n => [n, PACK[n] + '/' + n]).concat([[ARCADE_FLOOR, 'mini-arcade/floor']]);
    let n = 0;
    return Promise.all(list.map(([name, file]) => new Promise((res, rej) => {
      loader.load('/static/store/kenney/' + file + '.glb', g => { models[name] = g; onStep(++n / list.length); res(); }, undefined, rej);
    })));
  }
  const mixers = [];
  function place(name, x, z, rotY = 0, opts = {}) {
    const g = models[name];
    const o = opts.original ? g.scene : g.scene.clone(true);
    o.position.set(x, opts.y || 0, z);
    o.rotation.y = rotY;
    if (opts.scale) o.scale.setScalar(opts.scale);
    o.traverse(m => { if (m.isMesh) { m.castShadow = !opts.flat; m.receiveShadow = true; } });
    if (opts.anim && g.animations && g.animations.length) {
      const mx = new THREE.AnimationMixer(o);
      mx.clipAction(g.animations[0]).play(); mx.update(Math.random() * 3); mixers.push(mx);
    }
    (opts.parent || scene).add(o);
    return o;
  }

  /* ---------------- three.js ---------------- */
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOUCH ? 1.75 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x3b3f48, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  /* ---------------- product textures (painted on a canvas, repainted when the cover arrives) ---------------- */
  function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function fitText(x, text, max) { if (x.measureText(text).width <= max) return text; let t = text; while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
  function wrap(x, text, max, lines) {
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/)) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
    if (out.length > lines) { out.length = lines; out[lines - 1] = fitText(x, out[lines - 1] + ' …', max); }
    return out;
  }
  function drawCover(x, img, X, Y, w, h, contain) {
    if (!img) return false;
    const s = (contain ? Math.min : Math.max)(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip(); x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih); x.restore();
    return true;
  }
  function placeholder(x, it, X, Y, w, h, size) {
    x.fillStyle = it.tint || '#3a3f48'; x.fillRect(X, Y, w, h);
    x.fillStyle = '#fff'; x.font = '700 ' + size + 'px ' + FONT; x.textAlign = 'center';
    const ls = wrap(x, it.title, w - size, 3);
    ls.forEach((l, i) => x.fillText(l, X + w / 2, Y + h / 2 + (i - (ls.length - 1) / 2) * size * 1.15 + size * 0.35));
    x.textAlign = 'left';
  }
  function salePill(x, it, X, Y, size) {
    if (!it.sale) return;
    x.font = '800 ' + size + 'px ' + FONT; const t = '-' + it.sale + '%', tw = x.measureText(t).width;
    x.fillStyle = '#9be33c'; roundRect(x, X, Y, tw + size * 0.8, size * 1.45, size * 0.72); x.fill();
    x.fillStyle = '#10200a'; x.fillText(t, X + size * 0.4, Y + size * 1.08);
  }
  const PAINT = {
    // the front and back of an asset pack's box: the cover, with the sale sticker
    cover: [512, 406, (x, it, img) => { if (!drawCover(x, img, 0, 0, 512, 406)) placeholder(x, it, 0, 0, 512, 406, 46); salePill(x, it, 16, 16, 34); }],
    // the box's sides and top: the name along the spine
    spine: [512, 96, (x, it) => {
      x.fillStyle = it.tint || '#3a3f48'; x.fillRect(0, 0, 512, 96);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, 512, 96);
      x.fillStyle = '#fff'; x.font = '700 44px ' + FONT; x.fillText(fitText(x, it.title, 480), 16, 64);
    }],
    // the price tag on the plinth (and next to the machines)
    tag: [512, 200, (x, it) => {
      x.fillStyle = '#fbfbfd'; roundRect(x, 0, 0, 512, 200, 26); x.fill();
      x.fillStyle = '#15171a'; x.font = '700 46px ' + FONT;
      const ls = wrap(x, it.title, 470, 2); ls.forEach((l, i) => x.fillText(l, 22, 64 + i * 52));
      x.font = '800 48px ' + FONT; x.fillStyle = it.sale ? '#2f7a07' : '#15171a';
      const p = priceText(it), py = ls.length > 1 ? 178 : 140; x.fillText(p, 22, py);
      if (it.sale) { x.font = '800 48px ' + FONT; const pw = x.measureText(p).width; salePill(x, it, 22 + pw + 16, py - 38, 30); }
    }],
    // an arcade cabinet's screen
    screen: [512, 280, (x, it, img) => { x.fillStyle = '#05060a'; x.fillRect(0, 0, 512, 280); if (!drawCover(x, img, 0, 0, 512, 280)) placeholder(x, it, 0, 0, 512, 280, 40); }],
    // a cabinet's marquee: the name
    marquee: [512, 128, (x, it) => {
      x.fillStyle = '#101216'; x.fillRect(0, 0, 512, 128);
      x.fillStyle = '#fff'; x.font = '800 54px ' + FONT; x.textAlign = 'center'; x.fillText(fitText(x, it.title, 480), 256, 84); x.textAlign = 'left';
    }],
    // the poster stand next to a cabinet: cover, name, price
    poster: [512, 560, (x, it, img) => {
      x.fillStyle = '#16181b'; x.fillRect(0, 0, 512, 560);
      if (!drawCover(x, img, 16, 16, 480, 381)) placeholder(x, it, 16, 16, 480, 381, 44);
      salePill(x, it, 30, 30, 32);
      x.fillStyle = '#fff'; x.font = '700 40px ' + FONT;
      const ls = wrap(x, it.title, 470, 2); ls.forEach((l, i) => x.fillText(l, 22, 448 + i * 46));
      x.font = '800 38px ' + FONT; x.fillStyle = it.sale ? '#9be33c' : '#c9ccd1'; x.textAlign = 'right'; x.fillText(priceText(it), 490, ls.length > 1 ? 540 : 500); x.textAlign = 'left';
    }],
    // behind a vending machine's glass
    glass: [300, 400, (x, it, img) => {
      x.fillStyle = '#0c0d10'; x.fillRect(0, 0, 300, 400);
      if (!drawCover(x, img, 0, 40, 300, 238)) placeholder(x, it, 0, 40, 300, 238, 30);
      x.fillStyle = '#fff'; x.font = '700 30px ' + FONT;
      wrap(x, it.title, 270, 2).forEach((l, i) => x.fillText(l, 14, 316 + i * 34));
      x.font = '800 30px ' + FONT; x.fillStyle = it.sale ? '#9be33c' : '#c9ccd1'; x.fillText(priceText(it), 14, 32);
    }],
  };
  function tex(it, kind) {
    it.tex = it.tex || {};
    if (it.tex[kind]) return it.tex[kind];
    const [w, h, fn] = PAINT[kind];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), it, it.img || null);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO;
    t.userData = { c, kind };
    it.tex[kind] = t;
    return t;
  }
  function repaint(it) {
    for (const k in it.tex || {}) { const t = it.tex[k], c = t.userData.c, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); PAINT[k][2](x, it, it.img); t.needsUpdate = true; }
  }
  function loadImage(url) {
    return new Promise(res => {
      if (!url) return res(null);
      const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = '/api/itch-img?u=' + encodeURIComponent(url);
    });
  }
  function loadCover(it) {
    return loadImage(it.cover).then(img => {
      if (!img) return;
      try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; it.tint = `rgb(${d[0]},${d[1]},${d[2]})`; } catch (e) {}
      it.img = img; repaint(it);
    });
  }
  const basic = t => new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const lit = t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });

  /* ---------------- the store ---------------- */
  let items = [];             // products in the store, front to back
  let booths = [];            // { item, k, x, z, fx, fz, root, extra, labelY }
  let bounds = null, walls = [], solids = [], doorX = 0;
  let creator = { name: USER, profile: 'https://' + USER + '.itch.io/' };
  const CELL_X = 2.3, CELL_Z = 2.8, ENTRY = 3.2;

  function plan(list) {
    const by = { asset: [], tool: [], game: [] };
    for (const it of list) (by[it.type] || by.asset).push(it);
    const C = list.length > 36 ? 4 : 3;
    const rows = [];
    for (const type of ['asset', 'tool', 'game']) for (let i = 0; i < by[type].length; i += C) rows.push({ type, items: by[type].slice(i, i + C) });
    return { C, rows };
  }
  const solid = (x, z, hw, hd) => { const s = { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd }; solids.push(s); return s; };
  function frontZ(obj, x, y, fallback) {
    obj.updateMatrixWorld(true);
    const r = new THREE.Raycaster(new THREE.Vector3(x, y, obj.position.z + 3), new THREE.Vector3(0, 0, -1));
    const h = r.intersectObject(obj, true)[0];
    return h ? h.point.z : fallback;
  }

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x8c90bd, roughness: 0.8 });
  const plinthTop = new THREE.MeshStandardMaterial({ color: 0xeceef6, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6 });

  function assetBooth(it, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.56), plinthMat); body.position.y = 0.21;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.05, 0.64), plinthTop); top.position.y = 0.445;
    const sp = lit(tex(it, 'spine')), cv = lit(tex(it, 'cover'));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.587, 0.17), [sp, sp, sp, sp, cv, cv]);
    box.position.set(0, 0.47 + 0.2935, -0.02); box.rotation.x = -0.06;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.242), basic(tex(it, 'tag'))); tag.position.set(0, 0.235, 0.282); tag.rotation.x = -0.12;
    for (const m of [body, top, box]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(body, top, box, tag);
    solid(x, z, 0.5, 0.36);
    return { root: g, labelY: 1.25, fz: z + 0.95 };
  }
  function gameBooth(it, x, z) {
    const S = 1.42, cx = x - 0.32;
    const cab = place('arcade-machine', cx, z, 0, { scale: S });
    const sz = frontZ(cab, cx, 0.43 * S, z + 0.2) + 0.004, mz = frontZ(cab, cx, 0.65 * S, z + 0.25) + 0.004;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.29 * S, 0.158 * S), basic(tex(it, 'screen'))); screen.position.set(cx, 0.43 * S, sz);
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(0.37 * S, 0.092 * S), basic(tex(it, 'marquee'))); marq.position.set(cx, 0.65 * S, mz);
    // the poster stand: a board on two legs, turned a little toward the aisle
    const stand = new THREE.Group(); stand.position.set(x + 0.42, 0, z + 0.12); stand.rotation.y = -0.3;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.656, 0.03), [darkMat, darkMat, darkMat, darkMat, basic(tex(it, 'poster')), darkMat]);
    board.position.y = 0.36 + 0.328; board.rotation.x = -0.08; board.castShadow = true;
    for (const lx of [-0.24, 0.24]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.4, 0.035), darkMat); leg.position.set(lx, 0.2, -0.02); leg.castShadow = true; stand.add(leg); }
    stand.add(board);
    scene.add(screen, marq, stand);
    solid(cx, z, 0.32, 0.4); solid(x + 0.42, z + 0.12, 0.34, 0.14);
    return { root: cab, extra: [screen, marq, stand], labelY: 1.35, fz: z + 1.0 };
  }
  function toolBooth(it, x, z) {
    const S = 1.35, gx = x - 0.036 * S;
    const vm = place('vending-machine', x, z, 0, { scale: S });
    const gz = frontZ(vm, gx, 0.475 * S, z + 0.25) + 0.004;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.33 * S, 0.44 * S), basic(tex(it, 'glass'))); glass.position.set(gx, 0.475 * S, gz);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.242), basic(tex(it, 'tag'))); tag.position.set(x + 0.66, 0.34, z + 0.25); tag.rotation.set(-0.5, -0.25, 0);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.04), darkMat); post.position.set(x + 0.66, 0.13, z + 0.2);
    scene.add(glass, tag, post);
    solid(x, z, 0.36, 0.34);
    return { root: vm, extra: [glass, tag, post], labelY: 1.3, fz: z + 0.95 };
  }

  function build(list) {
    const { C, rows } = plan(list);
    const W = Math.ceil(C * CELL_X + 1.4);
    const D = Math.ceil(ENTRY + rows.length * CELL_Z + 0.8);
    const xL = -W / 2, xR = W / 2, zBack = -D;
    bounds = { minX: xL, maxX: xR, minZ: zBack, maxZ: 0 };
    doorX = W % 2 ? 0 : 0.5;
    items = []; booths = []; solids = []; walls = [];

    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.3, D + 0.6), new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.9 }));
    base.position.set(0, -0.151, zBack / 2); base.receiveShadow = true; scene.add(base);

    const gameRow = rows.findIndex(r => r.type === 'game');
    const arcadeZ = gameRow < 0 ? -1e9 : -(ENTRY + gameRow * CELL_Z) + 0.2;
    for (let z = -0.5; z > zBack; z -= 1) for (let x = xL + 0.5; x < xR; x += 1) place(z < arcadeZ ? ARCADE_FLOOR : 'floor-wood', x, z, 0, { flat: true });

    rows.forEach((row, ri) => {
      const z = -(ENTRY + ri * CELL_Z + CELL_Z / 2) - 0.25;
      row.items.forEach((it, ci) => {
        const x = (ci - (C - 1) / 2) * CELL_X;
        const k = items.length;
        const b = row.type === 'game' ? gameBooth(it, x, z) : row.type === 'tool' ? toolBooth(it, x, z) : assetBooth(it, x, z);
        for (const o of [b.root, ...(b.extra || [])]) o.traverse(m => { m.userData.booth = k; });
        items.push(it);
        booths.push({ item: it, k, x, z, fx: x, fz: b.fz, root: b.root, extra: b.extra || [], labelY: b.labelY });
      });
    });

    // walls round the store (the front one has the door, which opens onto the mall), columns on the corners
    const wallAt = (name, x, z, rot, nx, nz) => { const o = place(name, x, z, rot); walls.push({ obj: o, nx, nz }); return o; };
    for (let x = xL + 0.5, i = 0; x < xR; x += 1, i++) {
      wallAt(i % 2 ? 'wall-window' : 'wall', x, zBack, 0, 0, -1);
      const isDoor = Math.abs(x - doorX) < 0.01;
      const o = wallAt(isDoor ? 'wall-door-rotate' : (i % 2 ? 'wall-window' : 'wall'), x, 0, Math.PI, 0, 1);
      if (isDoor) {
        door = { obj: o, x, open: 0 };
        const clip = THREE.AnimationClip.findByName(models['wall-door-rotate'].animations, 'open');
        if (clip) { door.mx = new THREE.AnimationMixer(o); door.act = door.mx.clipAction(clip); door.act.play(); door.act.paused = true; door.dur = clip.duration; }
      }
    }
    for (let z = -0.5, i = 0; z > zBack; z -= 1, i++) {
      wallAt(i % 3 === 1 ? 'wall-window' : 'wall', xL, z, Math.PI / 2, -1, 0);
      wallAt(i % 3 === 1 ? 'wall-window' : 'wall', xR, z, -Math.PI / 2, 1, 0);
    }
    for (const [x, z, nx, nz] of [[xL, 0, -1, 1], [xR, 0, 1, 1], [xL, zBack, -1, -1], [xR, zBack, 1, -1]]) {
      const o = place('column', x, z); o.scale.set(0.62, 1.04, 0.62); walls.push({ obj: o, nx, nz, corner: true });
    }

    // by the door: the counter and the shopkeeper on one side, carts on the other; stock along the walls
    const cx = xR - 1.3;
    place('cash-register', cx, -1.5, -Math.PI / 2); solid(cx, -1.5, 0.45, 0.5);
    const keeper = place('character-employee', cx + 0.62, -1.5, -Math.PI / 2, { original: true });
    playClip(keeper, models['character-employee'], 'idle');
    place('shopping-cart', xL + 0.8, -0.9, 0.4); place('shopping-cart', xL + 1.15, -1.25, 0.25); place('shopping-basket', xL + 0.7, -1.7);
    solid(xL + 0.95, -1.1, 0.45, 0.45);
    place('display-flowers', xL + 0.6, -2.6); solid(xL + 0.6, -2.6, 0.4, 0.4);
    rows.forEach((row, ri) => {
      if (ri === 0) return;
      const z = -(ENTRY + ri * CELL_Z) - 0.15;
      const d = row.type === 'game' ? ['claw-machine', 'basketball-game', 'prize-wheel', 'ticket-machine'] : row.type === 'tool' ? ['gacha-machine', 'freezers-standing'] : ['shelf-boxes', 'shelf-bags', 'freezers-standing', 'display-fruit'];
      for (const [x, rot] of [[xL + 0.45, Math.PI / 2], [xR - 0.45, -Math.PI / 2]]) {
        const name = d[(ri + (rot > 0 ? 0 : 1)) % d.length];
        place(name, x, z, rot, { anim: /claw|wheel|ticket/.test(name) }); solid(x, z, 0.42, 0.5);
      }
    });
    // the front wall is solid except at the door
    solids.push({ minX: xL, maxX: doorX - 0.42, minZ: -0.3, maxZ: 0.3 }, { minX: doorX + 0.42, maxX: xR, minZ: -0.3, maxZ: 0.3 });
    // the store's own name over the door, outside
    const sign = signBoard(creator.name + '’s store', 3.2);
    sign.position.set(doorX, 1.32, 0.33); scene.add(sign); walls.push({ obj: sign, nx: 0, nz: 1 });
    lightUp(W, D);
  }
  // the sun's shadows cover the area round you (the sun moves with you; see the loop)
  function lightUp() {
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  let door = null;
  function playClip(obj, gltf, name) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name); if (!clip) return null;
    const mx = new THREE.AnimationMixer(obj); const a = mx.clipAction(clip); a.play(); mixers.push(mx); return { mx, a };
  }
  // a shop sign: white letters on a dark board
  function signBoard(text, width) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#15171a'; roundRect(x, 0, 0, 1024, 160, 30); x.fill();
    x.fillStyle = '#fff'; x.font = '800 84px ' + FONT; x.textAlign = 'center'; x.fillText(fitText(x, text, 960), 512, 110);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, width * 160 / 1024), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
  }

  /* ---------------- labels that float over what you're next to, and "You are here" ---------------- */
  function floater(text, dark) {
    const c = document.createElement('canvas'); const x = c.getContext('2d');
    x.font = '700 40px ' + FONT; const w = Math.min(1000, Math.ceil(x.measureText(text).width) + 56);
    c.width = w; c.height = 92;
    x.font = '700 40px ' + FONT;
    x.fillStyle = dark ? '#15171a' : '#ecedef'; roundRect(x, 2, 2, w - 4, 70, 35); x.fill();
    x.beginPath(); x.moveTo(w / 2 - 14, 70); x.lineTo(w / 2, 88); x.lineTo(w / 2 + 14, 70); x.fill();
    x.fillStyle = dark ? '#ecedef' : '#15171a'; x.textAlign = 'center'; x.fillText(text, w / 2, 50);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w / 92 * 0.22, 0.22), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthTest: false }));
    m.renderOrder = 5; scene.add(m); return m;
  }
  let hereSign = null, nearSign = null, nearSignFor = null, lastZone = '';

  /* ---------------- you ---------------- */
  const me = { x: 0, z: -1, rot: Math.PI, obj: null, act: {}, cur: 'idle', speed: 0, dest: null, face: null };
  function makePlayer() {
    const g = models['character-gamer'];
    me.obj = g.scene; scene.add(me.obj);
    me.obj.traverse(m => { if (m.isMesh) m.castShadow = true; });
    me.obj.scale.setScalar(1.05);
    me.mx = new THREE.AnimationMixer(me.obj); mixers.push(me.mx);
    for (const n of ['idle', 'walk', 'sprint']) { const c = THREE.AnimationClip.findByName(g.animations, n); if (c) me.act[n] = me.mx.clipAction(c); }
    me.act.idle.play();
  }
  function setAnim(n) {
    if (me.cur === n || !me.act[n]) return;
    const from = me.act[me.cur], to = me.act[n];
    to.reset().play(); if (from) to.crossFadeFrom(from, 0.18, false);
    me.cur = n;
  }
  const R_ME = 0.24;
  // where you can stand: the store, the mall (when it's there), and the doorway between them
  function areas() { return Mall.ready ? [bounds, Mall.bounds, { minX: doorX - 0.42, maxX: doorX + 0.42, minZ: -0.6, maxZ: 0.6, door: true }] : [bounds]; }
  function collide() {
    // stay inside one of the walkable areas
    const A = areas();
    let best = null, bd = Infinity;
    for (const a of A) {
      const inset = a.door ? R_ME * 0.2 : 0.36 + R_ME;
      const cx = Math.max(a.minX + inset, Math.min(a.maxX - inset, me.x)), cz = Math.max(a.minZ + (a.door ? 0 : inset), Math.min(a.maxZ - (a.door ? 0 : inset), me.z));
      const d = Math.hypot(cx - me.x, cz - me.z);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    me.x = best[0]; me.z = best[1];
    for (const s of solids.concat(Mall.solids)) {
      const cx = Math.max(s.minX, Math.min(s.maxX, me.x)), cz = Math.max(s.minZ, Math.min(s.maxZ, me.z));
      const dx = me.x - cx, dz = me.z - cz, d = Math.hypot(dx, dz);
      if (d < R_ME) {
        if (d > 1e-5) { me.x = cx + dx / d * R_ME; me.z = cz + dz / d * R_ME; }
        else { const l = me.x - s.minX, r = s.maxX - me.x, f = s.maxZ - me.z, k = me.z - s.minZ, m = Math.min(l, r, f, k);
          if (m === l) me.x = s.minX - R_ME; else if (m === r) me.x = s.maxX + R_ME; else if (m === f) me.z = s.maxZ + R_ME; else me.z = s.minZ - R_ME; }
      }
    }
  }
  function walkTo(x, z, face) {
    me.dest = { x, z }; me.face = face == null ? null : face; hint.hide();
    if (mode === 'overview') follow(700);
  }
  function teleport(k) {
    const b = booths[k];
    me.x = b.fx; me.z = b.fz; me.rot = Math.PI; me.dest = null; me.face = Math.PI; collide();
    Object.assign(view, { ...followView(), th: 0, tx: me.x, tz: me.z });
    mode = 'follow'; tween = null;
  }

  /* ---------------- input: the thumb stick, keys ---------------- */
  const stick = { x: 0, y: 0, id: null };
  const keys = new Set();
  if (TOUCH) {
    const joy = $('#joy'), knob = joy.querySelector('i');
    joy.hidden = false;
    const move = e => {
      const r = joy.getBoundingClientRect(), R = r.width / 2 - 8;
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      stick.x = dx / R; stick.y = dy / R;
    };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); joy.setPointerCapture(e.pointerId); stick.id = e.pointerId; move(e); me.dest = null; hint.hide(); if (mode === 'overview') follow(600); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === stick.id) move(e); });
    const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  }
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea')) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      keys.add(k); me.dest = null; hint.hide(); if (k.startsWith('arrow')) e.preventDefault(); if (mode === 'overview' && k !== 'shift') follow(600);
    } else if ((k === 'e' || k === 'enter') && nearThing && !Panels.cur) activate();
    else if (k === 'escape') Panels.closeAll();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  /* ---------------- camera ---------------- */
  const view = { tx: 0, ty: 0.5, tz: -2, th: 0, ph: 0.8, r: 6 };
  let inset = { top: 0, bottom: 0, right: 0 }, insetGoal = { top: 0, bottom: 0, right: 0 };
  let tween = null, mode = 'follow', zoom = 1;
  let W = 1, H = 1;
  function hudInsets() {
    const bar = EMBED ? 0 : $('#sbar').offsetHeight;
    return H < 520 ? { top: bar + 8, bottom: 8, right: 0 } : { top: bar + 62, bottom: TOUCH ? 150 : 80, right: 0 };
  }
  function applyCam() {
    const cp = Math.cos(view.ph);
    cam.position.set(view.tx + view.r * cp * Math.sin(view.th), view.ty + view.r * Math.sin(view.ph), view.tz + view.r * cp * Math.cos(view.th));
    cam.lookAt(view.tx, view.ty, view.tz);
    cam.setViewOffset(W, H, Math.round(inset.right / 2), Math.round((inset.bottom - inset.top) / 2), W, H);
    cam.updateMatrixWorld();
  }
  // behind you, high enough to see over the displays; further back on a narrow screen
  function followView() {
    const a = W / Math.max(1, H);
    const r = (a < 0.7 ? 8.2 : a < 1.1 ? 6.8 : 6) * zoom;
    return { tx: me.x, ty: 0.55, tz: me.z, th: view.th, ph: view.ph, r };
  }
  function follow(ms) { mode = 'follow'; tweenTo({ ...followView(), ph: 0.9 }, ms); }
  function overviewView(ins = hudInsets()) {
    const a = W / H;
    const th = a < 1 ? 0 : a < 1.3 ? 0.7 : 1.22, ph = a < 1 ? 0.98 : a < 1.3 ? 0.88 : 0.8;
    const b = bounds, pts = [];
    for (const x of [b.minX - 0.3, b.maxX + 0.3]) for (const z of [b.minZ - 0.3, b.maxZ + 0.3]) for (const y of [-0.15, 1.3]) pts.push(new THREE.Vector3(x, y, z));
    const v = { tx: (b.minX + b.maxX) / 2, ty: 0.4, tz: (b.minZ + b.maxZ) / 2, th, ph, r: 10 };
    const save = { ...view }, saveIn = inset;
    Object.assign(view, v); inset = ins;
    const lim = { l: -0.97, r: 0.97 - 2 * ins.right / W, t: 1 - 2 * ins.top / H, b: -1 + 2 * ins.bottom / H };
    let lo = 2, hi = 200;
    for (let i = 0; i < 28; i++) {
      view.r = (lo + hi) / 2; applyCam();
      const ok = pts.every(p => { const q = p.clone().project(cam); return q.x >= lim.l && q.x <= lim.r && q.y <= lim.t && q.y >= lim.b && q.z < 1; });
      if (ok) hi = view.r; else lo = view.r;
    }
    v.r = hi; Object.assign(view, save); inset = saveIn;
    return v;
  }
  function tweenTo(v, ms = 750) {
    const from = { ...view };
    let dth = v.th - from.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    tween = { from, to: { ...v, th: from.th + dth }, t0: performance.now(), ms, inFrom: { ...inset } };
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function stepCamera(now, dt) {
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.ms), e = ease(t);
      const to = mode === 'follow' ? { ...tween.to, tx: me.x, tz: me.z } : tween.to;   // while following, chase where you are now
      for (const k in to) view[k] = tween.from[k] + (to[k] - tween.from[k]) * e;
      for (const k of ['top', 'bottom', 'right']) inset[k] = tween.inFrom[k] + (insetGoal[k] - tween.inFrom[k]) * e;
      if (t >= 1) tween = null;
      return;
    }
    for (const k of ['top', 'bottom', 'right']) inset[k] += (insetGoal[k] - inset[k]) * 0.2;
    if (mode === 'follow') {
      const f = followView(), k = 1 - Math.exp(-dt * 7);
      view.tx += (f.tx - view.tx) * k; view.tz += (f.tz - view.tz) * k; view.ty += (f.ty - view.ty) * k; view.r += (f.r - view.r) * k;
    }
  }

  /* ---------------- dragging the camera, pinching, tapping ---------------- */
  const el = renderer.domElement;
  const ptrs = new Map();
  let gesture = null;
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    tween = null; hint.hide();
    gesture = ptrs.size === 1 ? 'one' : (() => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) }; })();
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (!TOUCH) hover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1 && gesture === 'one') {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < 6) return;
      view.th -= dx * 0.0068; view.ph = Math.max(0.3, Math.min(1.35, view.ph + dy * 0.005));
    } else if (ptrs.size === 2 && typeof gesture === 'object') {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.d > 0) { const f = gesture.d / Math.max(1, d); if (mode === 'follow') zoom = Math.max(0.45, Math.min(2.2, zoom * f)); else view.r = Math.max(3, Math.min(150, view.r * f)); }
      gesture.d = d;
    }
  });
  const up = e => {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (!p) return;
    if (gesture === 'one' && e.type === 'pointerup' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8 && performance.now() - p.t0 < 500) tap(e);
    gesture = ptrs.size ? 'none' : null;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => {
    e.preventDefault(); hint.hide();
    const f = Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0022);
    if (mode === 'follow') zoom = Math.max(0.45, Math.min(2.2, zoom * f)); else view.r = Math.max(3, Math.min(150, view.r * f));
  }, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function aim(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  function pickThing() {
    const targets = []; for (const b of booths) targets.push(b.root, ...b.extra);
    for (const s of Mall.fronts) targets.push(s.group);
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      if (o.userData.booth != null) return { booth: o.userData.booth };
      if (o.userData.front != null) return { front: o.userData.front };
    }
    return null;
  }
  function tap(e) {
    aim(e);
    const t = pickThing();
    if (t && t.booth != null) { const b = booths[t.booth]; walkTo(b.fx, b.fz, Math.PI); return; }
    if (t && t.front != null) { const s = Mall.fronts[t.front]; walkTo(s.dx, s.dz - s.dir * 0.4, s.dir > 0 ? Math.PI : 0); return; }
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(ground, p) && areas().some(a => p.x > a.minX && p.x < a.maxX && p.z > a.minZ && p.z < a.maxZ)) walkTo(p.x, p.z);
  }
  let hoverT = 0;
  function hover(e) {
    const now = performance.now(); if (now - hoverT < 70) return; hoverT = now;
    aim(e); el.style.cursor = pickThing() ? 'pointer' : 'grab';
  }

  /* ---------------- the bar next to a product or a storefront ---------------- */
  let nearThing = null;
  function setNear(t) {
    const key = t ? (t.booth != null ? 'b' + t.booth : 'f' + t.front) : '';
    if (key === (nearThing ? nearThing.key : '')) return;
    nearThing = t ? { ...t, key } : null;
    const bar = $('#near'), go = $('#nearGo');
    if (!t) { bar.hidden = true; return; }
    if (t.booth != null) {
      const it = items[t.booth];
      $('#nearTitle').textContent = it.title;
      const kind = { asset: 'Asset pack', tool: 'Tool', game: 'Game' }[it.type] || 'Project';
      $('#nearMeta').innerHTML = (it.sale ? `<em>${esc(priceText(it))} · -${it.sale}%</em>` : esc(priceText(it))) + ' · ' + esc(kind) + (it.slug.toLowerCase() === SPAWN ? ' · You’re on this page' : '');
      go.href = it.url; go.target = '_blank';
      $('#nearLabel').innerHTML = (it.type === 'game' && it.web ? 'Play' : 'Open') + (TOUCH ? '' : ' <kbd>E</kbd>');
    } else {
      const s = Mall.fronts[t.front];
      $('#nearTitle').textContent = s.name + '’s store';
      $('#nearMeta').textContent = s.count ? s.count + ' project' + (s.count === 1 ? '' : 's') + ' on itch.io' : 'On itch.io';
      go.href = Mall.storeUrl(s.user); go.target = EMBED ? '_blank' : '_self';
      $('#nearLabel').innerHTML = 'Go in' + (TOUCH ? '' : ' <kbd>E</kbd>');
    }
    bar.hidden = false;
  }
  function activate() {
    if (!nearThing) return;
    if (nearThing.booth != null) window.open(items[nearThing.booth].url, '_blank', 'noopener');
    else if (EMBED) window.open(Mall.storeUrl(Mall.fronts[nearThing.front].user), '_blank', 'noopener');
    else Mall.enter(Mall.fronts[nearThing.front]);
  }

  /* ---------------- panels: browse everything, make your own ---------------- */
  const Panels = {
    cur: null,
    open(id) {
      for (const p of document.querySelectorAll('.panel')) p.classList.toggle('open', p.id === id);
      this.cur = id;
      requestAnimationFrame(() => { insetGoal = insetForPanels(); if (mode === 'overview') tweenTo(overviewView(insetGoal), 500); });
    },
    closeAll() {
      for (const p of document.querySelectorAll('.panel')) p.classList.remove('open');
      this.cur = null; insetGoal = insetForPanels();
      if (mode === 'overview') tweenTo(overviewView(insetGoal), 500);
    },
  };
  function insetForPanels() {
    const base = hudInsets();
    const p = Panels.cur && document.getElementById(Panels.cur);
    if (!p) return base;
    const top = p.offsetTop, left = p.offsetLeft, bottom = top + p.offsetHeight;
    if ((top > 2 && bottom < H - 2) || left > W * 0.3) return { top: base.top, bottom: 20, right: W - left + 8 };
    return { top: (EMBED ? 0 : $('#sbar').offsetHeight) + 10, bottom: Math.max(base.bottom, H - top + 8), right: 0 };
  }
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => Panels.closeAll());

  let bFilter = 'all';
  function renderBrowse() {
    const q = ($('#bFind').value || '').trim().toLowerCase();
    const list = items.map((it, k) => ({ it, k })).filter(({ it }) => (bFilter === 'all' || it.type === bFilter) && (!q || (it.title + ' ' + it.text).toLowerCase().includes(q)));
    $('#bGrid').innerHTML = list.length ? list.map(({ it, k }) => `<button class="tile" type="button" data-k="${k}">
      <div class="im">${it.cover ? `<img loading="lazy" src="${esc(it.cover)}" alt="">` : ''}${it.sale ? `<span class="pill">-${it.sale}%</span>` : ''}</div>
      <div class="tx"><b>${esc(it.title)}</b><span>${esc(priceText(it))}</span></div></button>`).join('') : '<p class="empty">Nothing matches that.</p>';
  }
  function setupBrowse() {
    const counts = { all: items.length };
    for (const it of items) counts[it.type] = (counts[it.type] || 0) + 1;
    const names = { all: 'All', asset: 'Asset packs', game: 'Games', tool: 'Tools' };
    const keys = ['all', 'asset', 'game', 'tool'].filter(k => counts[k]);
    $('#bFilters').innerHTML = keys.length > 2 ? keys.map(k => `<button type="button" data-f="${k}" aria-pressed="${k === bFilter}">${names[k]} ${counts[k]}</button>`).join('') : '';
    $('#bFind').hidden = items.length < 13;
    $('#bTitle').textContent = 'Everything from ' + creator.name;
    renderBrowse();
  }
  $('#bFilters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; bFilter = b.dataset.f; for (const x of $('#bFilters').children) x.setAttribute('aria-pressed', x === b); renderBrowse(); });
  $('#bFind').addEventListener('input', renderBrowse);
  // picking something in the list takes you to stand in front of it
  $('#bGrid').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; Panels.closeAll(); teleport(+b.dataset.k); });
  $('#openBrowse').onclick = () => Panels.cur === 'browse' ? Panels.closeAll() : Panels.open('browse');
  $('#viewBtn').onclick = () => { if (mode === 'overview') follow(800); else { mode = 'overview'; tweenTo(overviewView(insetForPanels()), 800); } };
  $('#fullBtn').onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} };
  $('#nearGo').addEventListener('click', e => { if (nearThing && nearThing.front != null && !EMBED) { e.preventDefault(); activate(); } });

  if (!EMBED) {
    $('#openMake').onclick = () => Panels.open('make');
    $('#userForm').addEventListener('submit', e => {
      e.preventDefault();
      const u = $('#userIn').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.itch\.io.*$/, '').replace(/[/?#].*$/, '');
      const err = $('#userErr');
      if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(u)) { err.hidden = false; err.textContent = 'That doesn’t look like an itch.io username. It’s the part before .itch.io in your page’s address.'; return; }
      location.href = '/store/' + u;
    });
    const opts = () => ({ mall: $('#mallChk').checked });
    $('#dlOne').onclick = () => exporter().then(x => x.one(USER, creator.name, items.find(i => i.slug === $('#spawnSel').value) || null, opts()));
    $('#dlAll').onclick = () => exporter().then(x => x.all(USER, creator.name, items, opts()));
  }
  let exp = null;
  function exporter() {
    if (!exp) exp = new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/static/store/export.js'; s.onload = () => res(window.GrugStoreExport); s.onerror = rej; document.head.appendChild(s); });
    return exp;
  }
  function setupMake() {
    if (EMBED) return;
    $('#userIn').value = LANDING ? '' : USER;
    $('#itchSec').hidden = LANDING;
    $('#spawnSel').innerHTML = '<option value="">The door</option>' + items.map(it => `<option value="${esc(it.slug)}">${esc(it.title)}</option>`).join('');
    if (SPAWN) $('#spawnSel').value = SPAWN;
  }

  const hint = {
    t: 0,
    show(text, ms = 6500) { const h = $('#hint'); h.textContent = text; h.classList.remove('gone'); clearTimeout(this.t); this.t = setTimeout(() => this.hide(), ms); },
    hide() { $('#hint').classList.add('gone'); },
  };

  /* ---------------- the mall: filled in by static/store/mall.js once the store is up ---------------- */
  const Mall = { ready: false, bounds: null, solids: [], fronts: [], storeUrl: u => '/store/' + u + '?from=door' };
  window.GrugStoreDebug = { me, Mall, view, get bounds() { return bounds; } };

  /* ---------------- the loop ---------------- */
  const clock = new THREE.Clock();
  let idleSince = performance.now(), lastFrame = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { loopStep(now); } catch (e) { window.GrugLoopErrors = (window.GrugLoopErrors || 0) + 1; if (window.GrugLoopErrors < 5) console.error(e); }
  }
  function loopStep(now) {
    if (!me.obj) { if (bounds) renderer.render(scene, cam); return; }
    const moving = me.speed > 0.01 || tween || ptrs.size || stick.id != null || keys.size;
    if (moving) idleSince = now;
    if (!moving && now - idleSince > 4000 && now - lastFrame < 48) return;   // idle: 20 frames a second
    lastFrame = now;
    const dt = Math.min(0.05, clock.getDelta());

    // where you want to go: the stick or keys (relative to the camera), else the spot you tapped
    let ix = stick.x, iy = stick.y;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('w') || keys.has('arrowup')) iy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iy += 1;
    let mx = 0, mz = 0, want = 0;
    const im = Math.min(1, Math.hypot(ix, iy));
    if (im > 0.12) {
      const c = Math.cos(view.th), s = Math.sin(view.th), l = Math.hypot(ix, iy);
      mx = (c * ix + s * iy) / l; mz = (-s * ix + c * iy) / l;
      want = keys.size ? (keys.has('shift') ? 3.4 : 2.4) : im * (im > 0.92 ? 3.2 : 2.4);
      me.face = null;
    } else if (me.dest) {
      const dx = me.dest.x - me.x, dz = me.dest.z - me.z, d = Math.hypot(dx, dz);
      if (d < 0.07) { me.dest = null; if (me.face != null && me.z > 0.4) tweenTo({ ...followView(), th: me.face + Math.PI }, 700); }
      else { mx = dx / d; mz = dz / d; want = Math.min(2.8, d * 4 + 0.4); }
    }
    me.speed += (want - me.speed) * Math.min(1, dt * 12);
    if (want > 0) {
      const px = me.x, pz = me.z;
      me.x += mx * me.speed * dt; me.z += mz * me.speed * dt;
      collide();
      if (me.dest && Math.hypot(me.x - px, me.z - pz) < me.speed * dt * 0.15) me.dest = null;   // stuck against something
      let d = Math.atan2(mx, mz) - me.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); me.rot += d * Math.min(1, dt * 14);
    } else if (me.face != null && !me.dest) {
      let d = me.face - me.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); me.rot += d * Math.min(1, dt * 10);
    }
    me.obj.position.set(me.x, 0, me.z); me.obj.rotation.y = me.rot;
    // in the mall the camera eases round behind you as you walk (not when you walk back toward it)
    if (me.z > 0.4 && me.speed > 0.6 && !ptrs.size && !tween) {
      let d = me.rot + Math.PI - view.th; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) view.th += d * Math.min(1, dt * 1.5);
    }
    setAnim(me.speed > 2.9 ? 'sprint' : me.speed > 0.25 ? 'walk' : 'idle');

    // what's in reach: a product, or a storefront's door
    let best = null, bd = 1.15;
    for (const b of booths) { const d = Math.hypot(me.x - b.fx, me.z - b.fz); if (d < bd) { bd = d; best = { booth: b.k }; } }
    if (!best) for (const b of booths) { if (Math.hypot(me.x - b.x, me.z - b.z) < 1.35 && me.z > b.z) { best = { booth: b.k }; break; } }
    if (!best) for (const s of Mall.fronts) { const d = Math.hypot(me.x - s.dx, me.z - s.dz); if (d < 1.5 && d < bd + 0.4) { bd = d; best = { front: s.i }; } }
    setNear(best);
    const key = best ? (best.booth != null ? 'b' + best.booth : 'f' + best.front) : '';
    if (key !== nearSignFor) {
      if (nearSign) { scene.remove(nearSign); nearSign.geometry.dispose(); nearSign.material.map.dispose(); nearSign = null; }
      nearSignFor = key;
      if (best && best.booth != null && !(hereSign && items[best.booth].slug.toLowerCase() === SPAWN)) {
        const b = booths[best.booth];
        nearSign = floater(items[best.booth].title + ' · ' + priceText(items[best.booth]), true);
        nearSign.position.set(b.x, b.labelY + 0.25, b.z);
      }
    }
    // the door swings open when you're near it
    if (door) {
      const want = Math.hypot(me.x - door.x, me.z) < 1.6 ? 1 : 0;
      door.open += (want - door.open) * Math.min(1, dt * 6);
      if (door.act) { door.act.time = door.open * door.dur * 0.999; door.mx.update(0); }
    }
    Mall.step && Mall.step(now, dt, me);
    // out in the mall the camera looks down more steeply, so both sides of the corridor are in view
    const zone = me.z > 0.4 ? 'mall' : 'store';
    if (zone !== lastZone) { if (lastZone && mode === 'follow' && !tween) tweenTo({ ...followView(), ph: zone === 'mall' ? 1.02 : 0.9 }, 900); lastZone = zone; }

    stepCamera(now, dt);
    applyCam();
    const sx = Math.round(view.tx), sz = Math.round(view.tz);
    sun.position.set(sx + 5, 11, sz + 6); sun.target.position.set(sx, 0, sz);
    for (const m of mixers) m.update(dt);
    for (const f of [hereSign, nearSign]) if (f) f.rotation.set(-view.ph * 0.6, view.th, 0, 'YXZ');
    if (hereSign) hereSign.position.y = hereSign.userData.y + Math.sin(now / 420) * 0.03;

    // the store's walls between the camera and you step aside (only while you're inside)
    const inside = me.z < 0;
    const dx = cam.position.x - view.tx, dz = cam.position.z - view.tz, dl = Math.hypot(dx, dz) || 1;
    const ux = dx / dl, uz = dz / dl;
    for (const w of walls) {
      const faces = w.corner ? (w.nx * ux > 0.25 || w.nz * uz > 0.25) : (w.nx * ux + w.nz * uz) > 0.28;
      w.obj.visible = !((inside && faces) || (!inside && w.nz === 1 && blocks(0)));
    }
    Mall.walls && Mall.walls(blocks, me);
    renderer.render(scene, cam);
  }

  // does a wall along z = z0 (about 1.6 high) stand between the camera and you?
  function blocks(z0) {
    const cz = cam.position.z;
    if ((z0 - me.z) * (cz - z0) <= 0) return false;
    const t = (z0 - me.z) / (cz - me.z);
    return 0.5 + (cam.position.y - 0.5) * t < 1.7;
  }

  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight);
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.fov = W / H < 0.8 ? 50 : 42; cam.updateProjectionMatrix();
    insetGoal = insetForPanels(); inset = { ...insetGoal };
    if (bounds && mode === 'overview') { Object.assign(view, overviewView(insetGoal)); tween = null; }
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------------- start ---------------- */
  async function start() {
    resize();
    requestAnimationFrame(frame);
    let data;
    try {
      const r = await fetch('/api/itch-store?user=' + encodeURIComponent(USER));
      data = await r.json().catch(() => ({}));
      if (r.status === 404 || r.status === 400) return veil.fail('No itch.io page called “' + USER + '”', 'Check the spelling: it’s the part before .itch.io in the page’s address.', true);
      if (!r.ok) throw new Error(data.error || 'status ' + r.status);
    } catch (e) {
      return veil.fail('The store couldn’t open', 'itch.io didn’t answer. Try again in a minute.', false);
    }
    creator = { name: data.name || USER, profile: data.profile || creator.profile };
    const list = (data.items || []).filter(it => it.type !== 'other');
    if (!list.length) return veil.fail(creator.name + ' has nothing public yet', 'Once there’s a project on the itch.io page, it’ll be in the store here.', true);

    document.title = creator.name + '’s 3D store' + (EMBED ? '' : ' · Grug Digital');
    $('#barName').textContent = LANDING ? '3D Store' : creator.name + '’s store';
    $('.sbar .ttl span').textContent = LANDING ? 'Example: ' + creator.name + '’s store' : USER + '.itch.io · 3D store';
    if (EMBED) { const w = $('#who'); w.hidden = false; w.href = creator.profile; $('#whoName').textContent = creator.name + '’s store'; $('#whoImg').remove(); w.style.paddingLeft = '14px'; }

    try {
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 40px Allo'), new Promise(r => setTimeout(r, 1500))]);
      await loadModels(f => veil.progress(f * 0.85));
    } catch (e) {
      return veil.fail('The store couldn’t open', 'Some of the store’s furniture didn’t load. Try again.', false);
    }
    build(list);
    makePlayer();
    setupBrowse();
    setupMake();

    // covers: the ones nearest where you start first, four at a time
    const sp = booths.find(b => b.item.slug.toLowerCase() === SPAWN);
    const order = booths.slice().sort((a, b) => sp ? Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z) : b.z - a.z);
    let i = 0; const next = () => { const b = order[i++]; if (b) loadCover(b.item).then(next); };
    for (let n = 0; n < 4; n++) next();

    resize();
    if (sp) {
      me.x = sp.fx; me.z = sp.fz; me.rot = Math.PI; me.face = Math.PI;
      hereSign = floater('You are here', false);
      hereSign.userData.y = sp.labelY + 0.3; hereSign.position.set(sp.x, hereSign.userData.y, sp.z);
      hint.show('You’re looking at ' + sp.item.title + '. Walk around to see everything else from ' + creator.name + '.', 8000);
    } else {
      me.x = doorX; me.z = -0.9; me.rot = Math.PI;
      hint.show(TOUCH ? 'Use the stick or tap the floor to walk · Walk up to anything to open it' : 'WASD or click to walk · Drag to look around · E opens what you’re next to', 8000);
    }
    collide();
    mode = 'overview';
    Object.assign(view, overviewView(insetGoal));
    view.th = 0; me.obj.position.set(me.x, 0, me.z); me.obj.rotation.y = me.rot;
    veil.progress(1); veil.done();
    // the opening shot: the whole store, then down to you (straight to you when you came in from the mall)
    if (Q.get('from') === 'door') { mode = 'follow'; Object.assign(view, { ...followView(), th: 0, ph: 0.9 }); }
    else setTimeout(() => { mode = 'follow'; tweenTo({ ...followView(), th: 0, ph: 0.9 }, 1500); }, sp ? 350 : 900);
    if (LANDING) setTimeout(() => Panels.open('make'), 2600);

    // the mall outside the door
    const s = document.createElement('script'); s.src = '/static/store/mall.js';
    s.onload = () => window.GrugMall && window.GrugMall({ THREE, scene, cam, models, place, signBoard, loadImage, roundRect, fitText, FONT, Mall, USER, DEMO, doorX, bounds, EMBED, mixers, playClip, lightUp });
    document.head.appendChild(s);
  }
  start();
})();
