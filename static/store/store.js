/* Grug · the 3D store (/store/<itch username>). One creator's public itch.io catalog, stocked into a shop you walk
   round, in the Grug Arcade's 2010 look: a studded baseplate under a sky, studded plastic bricks, the Arcade's light
   and shiny plastic, classic R6 characters wearing outfits, with Kenney's Mini Shop and Mini Arcade furniture
   (static/store/kenney/, CC0) turned to the same plastic. The panels and buttons stay in the site's modern dark look.

   - The catalog comes from /api/itch-store (functions/api/itch-store.js). Covers come through /api/itch-img (itch's
     image server has no CORS, and WebGL needs it to paint them onto the displays).
   - Every product has its own booth by type: an asset pack is a box on a studded plinth (the cover printed on the
     box, the name on its side, a price tag on the plinth); a game is an arcade cabinet (the cover on its screen, the
     name on its marquee) with a poster stand; a tool is a vending machine (the cover behind the glass). The arcade
     is at the back, on a checked floor.
   - You are your own saved character (GrugOutfitRig, as in every Arcade game; /static/outfits.js keeps a library of
     ready-made ones, Grug by default). Shoppers in the other outfits wander between the displays, stop to look, hop and
     chat; a shopkeeper at the counter waves you in. The changing room by the door and the "Your character" button
     open the Avatar Studio over the store (/character/?embed, src/character/embed.js); its Wear it dresses you there.
   - You walk with the thumb stick (touch), WASD or the arrow keys, or by tapping or clicking the floor or a display;
     Space hops. Next to a product the bar at the bottom opens its itch.io page (E on a keyboard). Dragging turns the
     camera; pinching or the wheel zooms; the house button shows the whole store.
   - Out the front door is the mall (static/store/mall.js): other creators' storefronts along a corridor.
   - ?spawn=<project slug> starts you in front of that product with a "You are here" sign (the itch.io embed zips set
     it); ?ref=<itch page address> does the same when itch passes the page's address; ?from=door starts you just inside
     the door (coming in from the mall). ?embed=1 is the version inside an itch.io page: no site bar, a small "Made with
     Grug" badge, and it tells the zip around it that it loaded. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  // window.GRUG_STORE: set by the itch.io build (src/store/build_itch.py), which runs on itch's own servers:
  //   { embed, user, api: where /api/... lives, site: the Grug site, assets: where the models are, avatars: [...] }
  const CFG = window.GRUG_STORE || {};
  const API = CFG.api || '', SITE = CFG.site || '', ASSETS = CFG.assets != null ? CFG.assets : '/static/store/';
  const AVATARS = CFG.avatars || null;   // the Grug avatars built into the itch.io version (no saved outfits there)
  const EMBED = Q.has('embed') || !!CFG.embed;
  const PATH_USER = CFG.user || (location.pathname.match(/^\/store\/([A-Za-z0-9_-]+)\/?$/) || [])[1] || Q.get('u') || '';
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
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  try { if (window.parent !== window) window.parent.postMessage({ grugStore: 'ready', user: USER }, '*'); } catch (e) {}

  if (TOUCH) document.body.classList.add('touch');
  if (EMBED) { $('#madeWith').hidden = false; if (SITE) $('#madeWith').href = SITE + '/store/'; if (document.fullscreenEnabled) $('#fullBtn').hidden = false; }
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

  /* ---------------- three.js: the Arcade's renderer, sky and light ---------------- */
  // retro (2010), as in the Arcade games: no anti-aliasing, drawn a little under screen resolution with hard pixel edges
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  // 3D resolution: 50% by default, as in Sunny Patch (the % button: 50 / 75 / 100%), blown up with hard pixel edges
  const RES_KEY = 'grug.store.res';
  let RES = 0.5; try { const r = +localStorage.getItem(RES_KEY); if ([0.5, 0.75, 1].includes(r)) RES = r; } catch (e) {}
  renderer.setPixelRatio(RES);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  scene.fog = new THREE.Fog(0xf3d2bc, 90, 420);
  const texL = new THREE.TextureLoader();
  const skyTex = texL.load(ASSETS + 'look/sky.jpg'); skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.x = -1;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(440, 48, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -1; scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xfff0e2, 0x8a7a6a, 0.64));
  const SUN_DIR = (() => { const phi = 2 * Math.PI * (1 - 0.92), el = 0.88; return new THREE.Vector3(-Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)).normalize(); })();
  const sun = new THREE.DirectionalLight(0xffe9d2, 0.85);
  sun.castShadow = true;
  const SHADOW_RES = TOUCH ? 1024 : 2048;
  sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 5, far: 120 });
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.012;
  scene.add(sun, sun.target);

  /* ---------------- studded plastic bricks (the Arcade's part(), in this store's units) ---------------- */
  // One stud is S units (an R6 character is 5 studs tall, about one unit here). One texture tile = 2 studs, as in the games.
  const S = 0.19;
  function studTex(u) { const t = texL.load(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  const STUD_A = studTex(ASSETS + 'look/studAlbedo.png'), STUD_N = studTex(ASSETS + 'look/studNormal.png'), STUD_I = studTex(ASSETS + 'look/studInlet.png');
  const SHINE = { shininess: 40, specular: 0x6a6a6a };
  const MATC = {};
  function brickMat(color, studs) {
    const k = color + '|' + studs; if (MATC[k]) return MATC[k];
    if (!studs) return (MATC[k] = new THREE.MeshPhongMaterial(Object.assign({ color }, SHINE)));
    const side = new THREE.MeshPhongMaterial(Object.assign({ color }, SHINE));
    const top = new THREE.MeshPhongMaterial({ color, map: STUD_A, normalMap: STUD_N, normalScale: new THREE.Vector2(0.8, 0.8), shininess: 20, specular: 0x282828 });
    const bottom = new THREE.MeshPhongMaterial(Object.assign({ color, normalMap: STUD_I, normalScale: new THREE.Vector2(0.8, 0.8) }, SHINE));
    return (MATC[k] = [side, side, top, bottom, side, side]);
  }
  const GEOC = {};
  function boxGeo(sx, sy, sz) {
    const key = [sx, sy, sz].map(v => v.toFixed(3)).join(','); if (GEOC[key]) return GEOC[key];
    const g = new THREE.BoxGeometry(sx, sy, sz), uv = g.attributes.uv, dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    const whole = n => n < 0.75 ? 0 : Math.max(1, Math.round(n));   // whole studs only, edge to edge
    for (let f = 0; f < 6; f++) { const nu = whole(dims[f][0] / S / 2), nv = whole(dims[f][1] / S / 2); for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, nu ? uv.getX(i) * nu : 0.03, nv ? uv.getY(i) * nv : 0.03); } }
    return (GEOC[key] = g);
  }
  // bricks are batched into one mesh per colour and group (a group: things that hide together, like one wall of the store)
  const BATCH = new Map(), GROUPS = new Map();
  const PAL = { white: 0xf2f3f3, grey: 0xa3a2a5, dark: 0x635f62, black: 0x1b2a35, sand: 0xd7c59a, blue: 0x0d69ac, green: 0x4b974b,
    yellow: 0xf5cd30, orange: 0xda8541, purple: 0x6b327c, teal: 0x008f9c, pink: 0xff98dc, navy: 0x27466a, brown: 0x7c5c46 };
  const BRIGHT = [PAL.blue, PAL.green, PAL.yellow, PAL.orange, PAL.purple, PAL.teal, PAL.navy, PAL.pink];
  function brick(cx, cy, cz, sx, sy, sz, color, o = {}) {
    const studs = o.studs !== false, cast = o.cast !== false, key = (o.group || '') + '|' + color + '|' + studs + '|' + cast;
    let B = BATCH.get(key); if (!B) BATCH.set(key, B = { color, studs, cast, group: o.group || '', boxes: [] });
    B.boxes.push([cx, cy, cz, sx, sy, sz]);
  }
  function groupOf(name) { let g = GROUPS.get(name); if (!g) { g = new THREE.Group(); g.name = name; scene.add(g); GROUPS.set(name, g); } return g; }
  function flushBricks() {
    for (const B of BATCH.values()) {
      const per = [0, 1, 2, 3, 4, 5].map(() => ({ p: [], n: [], u: [] }));
      for (const [cx, cy, cz, sx, sy, sz] of B.boxes) {
        const g = boxGeo(sx, sy, sz), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index.array;
        for (const gr of g.groups) {
          const q = per[B.studs ? gr.materialIndex : 0];
          for (let i = gr.start; i < gr.start + gr.count; i++) { const v = I[i]; q.p.push(P.getX(v) + cx, P.getY(v) + cy, P.getZ(v) + cz); q.n.push(N.getX(v), N.getY(v), N.getZ(v)); q.u.push(U.getX(v), U.getY(v)); }
        }
      }
      const pos = [], nor = [], uv = [], geo = new THREE.BufferGeometry(); let at = 0;
      per.forEach((q, mi) => { if (!q.p.length) return; for (let i = 0; i < q.p.length; i++) pos.push(q.p[i]); for (let i = 0; i < q.n.length; i++) nor.push(q.n[i]); for (let i = 0; i < q.u.length; i++) uv.push(q.u[i]); const c = q.p.length / 3; if (B.studs) geo.addGroup(at, c, mi); at += c; });
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(geo, brickMat(B.color, B.studs)); m.receiveShadow = true; m.castShadow = B.cast;
      m.matrixAutoUpdate = false; m.updateMatrix();
      (B.group ? groupOf(B.group) : scene).add(m);
    }
    BATCH.clear();
  }
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fc3e9, transparent: true, opacity: 0.38, shininess: 90, specular: 0xffffff, depthWrite: false });

  /* ---------------- Kenney's furniture, in the same shiny plastic ---------------- */
  const PACK = {
    'wall-door-rotate': 'mini-shop', 'cash-register': 'mini-shop', 'shopping-cart': 'mini-shop', 'shopping-basket': 'mini-shop',
    'shelf-boxes': 'mini-shop', 'shelf-bags': 'mini-shop', 'display-flowers': 'mini-shop', 'display-fruit': 'mini-shop',
    'freezers-standing': 'mini-shop', 'gacha-machine': 'mini-shop', 'clothing-rack': 'mini-shop',
    'arcade-machine': 'mini-arcade', 'vending-machine': 'mini-arcade', 'claw-machine': 'mini-arcade',
    'prize-wheel': 'mini-arcade', 'basketball-game': 'mini-arcade', 'ticket-machine': 'mini-arcade', 'air-hockey': 'mini-arcade',
  };
  const loader = new THREE.GLTFLoader();
  const models = {};
  const PLAST = new Map();
  function plastic(m) {
    if (!m) return m; if (PLAST.has(m)) return PLAST.get(m);
    if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.needsUpdate = true; }
    const p = new THREE.MeshPhongMaterial(Object.assign({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null }, SHINE));
    PLAST.set(m, p); return p;
  }
  function loadModels(onStep) {
    const names = Object.keys(PACK); let n = 0;
    return Promise.all(names.map(name => new Promise((res, rej) => {
      loader.load(ASSETS + 'kenney/' + PACK[name] + '/' + name + '.glb', g => {
        g.scene.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(plastic) : plastic(o.material); });
        models[name] = g; onStep(++n / names.length); res();
      }, undefined, rej);
    })));
  }
  const mixers = [];
  // things that never move: work their matrices out once, not every frame
  function freeze(o) { o.updateMatrixWorld(true); o.traverse(c => { c.matrixAutoUpdate = false; c.updateMatrix(); }); }
  const FURN = 1.3;   // Kenney's mini furniture, scaled up to sit right next to R6 characters
  function place(name, x, z, rotY = 0, opts = {}) {
    const g = models[name];
    const o = g.scene.clone(true);
    o.position.set(x, opts.y || 0, z);
    o.rotation.y = rotY;
    o.scale.setScalar(opts.scale || FURN);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (opts.anim && g.animations && g.animations.length) {
      const mx = new THREE.AnimationMixer(o); mx.clipAction(g.animations[0]).play(); mx.update(Math.random() * 3); mixers.push(mx);
    } else if (name !== 'wall-door-rotate') freeze(o);
    (opts.parent || scene).add(o);
    return o;
  }

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
  function drawCover(x, img, X, Y, w, h) {
    if (!img) return false;
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
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
    cover: [512, 406, (x, it, img) => { if (!drawCover(x, img, 0, 0, 512, 406)) placeholder(x, it, 0, 0, 512, 406, 46); salePill(x, it, 16, 16, 34); }],
    spine: [512, 96, (x, it) => {
      x.fillStyle = it.tint || '#3a3f48'; x.fillRect(0, 0, 512, 96);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, 512, 96);
      x.fillStyle = '#fff'; x.font = '700 44px ' + FONT; x.fillText(fitText(x, it.title, 480), 16, 64);
    }],
    tag: [512, 200, (x, it) => {
      x.fillStyle = '#fbfbfd'; roundRect(x, 0, 0, 512, 200, 26); x.fill();
      x.fillStyle = '#15171a'; x.font = '700 46px ' + FONT;
      const ls = wrap(x, it.title, 470, 2); ls.forEach((l, i) => x.fillText(l, 22, 64 + i * 52));
      x.font = '800 48px ' + FONT; x.fillStyle = it.sale ? '#2f7a07' : '#15171a';
      const p = priceText(it), py = ls.length > 1 ? 178 : 140; x.fillText(p, 22, py);
      if (it.sale) { x.font = '800 48px ' + FONT; const pw = x.measureText(p).width; salePill(x, it, 22 + pw + 16, py - 38, 30); }
    }],
    screen: [512, 280, (x, it, img) => { x.fillStyle = '#05060a'; x.fillRect(0, 0, 512, 280); if (!drawCover(x, img, 0, 0, 512, 280)) placeholder(x, it, 0, 0, 512, 280, 40); }],
    marquee: [512, 128, (x, it) => {
      x.fillStyle = '#101216'; x.fillRect(0, 0, 512, 128);
      x.fillStyle = '#fff'; x.font = '800 54px ' + FONT; x.textAlign = 'center'; x.fillText(fitText(x, it.title, 480), 256, 84); x.textAlign = 'left';
    }],
    poster: [512, 560, (x, it, img) => {
      x.fillStyle = '#16181b'; x.fillRect(0, 0, 512, 560);
      if (!drawCover(x, img, 16, 16, 480, 381)) placeholder(x, it, 16, 16, 480, 381, 44);
      salePill(x, it, 30, 30, 32);
      x.fillStyle = '#fff'; x.font = '700 40px ' + FONT;
      const ls = wrap(x, it.title, 470, 2); ls.forEach((l, i) => x.fillText(l, 22, 448 + i * 46));
      x.font = '800 38px ' + FONT; x.fillStyle = it.sale ? '#9be33c' : '#c9ccd1'; x.textAlign = 'right'; x.fillText(priceText(it), 490, ls.length > 1 ? 540 : 500); x.textAlign = 'left';
    }],
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
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.userData = { c, kind };
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
      img.src = API + '/api/itch-img?u=' + encodeURIComponent(url);
    });
  }
  function loadCover(it) {
    return loadImage(it.cover).then(img => {
      if (!img) return;
      try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; it.tint = `rgb(${d[0]},${d[1]},${d[2]})`; } catch (e) {}
      it.img = img; repaint(it);
    });
  }
  const basic = t => new THREE.MeshBasicMaterial({ map: t });
  const shiny = t => new THREE.MeshPhongMaterial(Object.assign({ map: t }, SHINE));

  /* ---------------- the store ---------------- */
  let items = [];             // products in the store, front to back
  let booths = [];            // { item, k, x, z, fx, fz, root, extra, labelY }
  let bounds = null, walls = [], solids = [], doorX = 0, spots = [];
  let creator = { name: USER, profile: 'https://' + USER + '.itch.io/' };
  const CELL_X = 3.1, CELL_Z = 3.5, ENTRY = 4.6, WALL_H = 1.9, WALL_T = 0.38, DOOR_W = 1.4;

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

  function assetBooth(it, x, z, k) {
    const col = BRIGHT[k % BRIGHT.length];
    brick(x, 0.29, z, 1.14, 0.38, 0.76, col);                          // the plinth: a studded brick on a white step
    brick(x, 0.05, z, 1.33, 0.1, 0.95, PAL.white);
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const sp = shiny(tex(it, 'spine')), cv = shiny(tex(it, 'cover'));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.683, 0.19), [sp, sp, sp, sp, cv, cv]);
    box.position.set(0, 0.48 + 0.3415, -0.04); box.rotation.x = -0.05; box.castShadow = true; box.receiveShadow = true;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.281), basic(tex(it, 'tag'))); tag.position.set(0, 0.29, 0.385);
    g.add(box, tag);
    solid(x, z, 0.62, 0.45);
    return { root: g, labelY: 1.45, fz: z + 1.05 };
  }
  function gameBooth(it, x, z) {
    const K = 1.85, cx = x - 0.4;
    const cab = place('arcade-machine', cx, z, 0, { scale: K });
    const sz = frontZ(cab, cx, 0.43 * K, z + 0.3) + 0.004, mz = frontZ(cab, cx, 0.65 * K, z + 0.35) + 0.004;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.29 * K, 0.158 * K), basic(tex(it, 'screen'))); screen.position.set(cx, 0.43 * K, sz);
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(0.37 * K, 0.092 * K), basic(tex(it, 'marquee'))); marq.position.set(cx, 0.65 * K, mz);
    // the poster stand: a board on two posts and a studded foot, turned a little toward the aisle
    const px = x + 0.62, pz = z + 0.2;
    brick(px - 0.3, 0.33, pz, 0.12, 0.66, 0.12, PAL.dark, { studs: false }); brick(px + 0.3, 0.33, pz, 0.12, 0.66, 0.12, PAL.dark, { studs: false });
    brick(px, 0.04, pz, 0.86, 0.08, 0.32, PAL.dark);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.787), basic(tex(it, 'poster'))); board.position.set(px, 0.66 + 0.39, pz + 0.07);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.83, 0.05), brickMat(PAL.dark, false)); back.position.set(px, 0.66 + 0.39, pz + 0.035); back.castShadow = true;
    scene.add(screen, marq, board, back);
    solid(cx, z, 0.42, 0.5); solid(px, pz, 0.45, 0.16);
    return { root: cab, extra: [screen, marq, board, back], labelY: 1.6, fz: z + 1.15 };
  }
  function toolBooth(it, x, z) {
    const K = 1.75, gx = x - 0.036 * K;
    const vm = place('vending-machine', x, z, 0, { scale: K });
    const gz = frontZ(vm, gx, 0.475 * K, z + 0.3) + 0.004;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.33 * K, 0.44 * K), basic(tex(it, 'glass'))); glass.position.set(gx, 0.475 * K, gz);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.281), basic(tex(it, 'tag'))); tag.position.set(x + 0.85, 0.5, z + 0.3); tag.rotation.set(-0.45, -0.3, 0);
    brick(x + 0.85, 0.2, z + 0.24, 0.1, 0.4, 0.1, PAL.dark, { studs: false });
    scene.add(glass, tag);
    solid(x, z, 0.46, 0.44);
    return { root: vm, extra: [glass, tag], labelY: 1.55, fz: z + 1.1 };
  }

  function build(list) {
    const { C, rows } = plan(list);
    const W = Math.ceil(C * CELL_X + 2.2);
    const D = Math.ceil(ENTRY + rows.length * CELL_Z + 1.2);
    const xL = -W / 2, xR = W / 2, zBack = -D;
    bounds = { minX: xL, maxX: xR, minZ: zBack, maxZ: 0 };
    doorX = 0;
    items = []; booths = []; solids = []; walls = []; spots = [];

    // the baseplate everything stands on (classic grey, studded), with the shop's own floor on it
    brick(0, -0.25, zBack / 2 + 5, W + 90, 0.5, D + 90, PAL.grey, { cast: false });
    const gameRow = rows.findIndex(r => r.type === 'game');
    const arcadeZ = gameRow < 0 ? zBack : -(ENTRY + gameRow * CELL_Z) + 0.3;
    brick(0, 0, arcadeZ / 2, W, 0.08, -arcadeZ, PAL.sand, { cast: false });
    if (gameRow >= 0) {   // the arcade: a checked floor
      for (let z0 = arcadeZ, r = 0; z0 > zBack + 0.01; z0 -= 1, r++) {
        const z1 = Math.max(zBack, z0 - 1);
        for (let i = 0; i < W; i++) brick(xL + i + 0.5, 0, (z0 + z1) / 2, 1, 0.08, z0 - z1, (i + r) % 2 ? PAL.black : PAL.dark, { cast: false });
      }
    }

    rows.forEach((row, ri) => {
      const z = -(ENTRY + ri * CELL_Z + CELL_Z / 2) - 0.2;
      row.items.forEach((it, ci) => {
        const x = (ci - (C - 1) / 2) * CELL_X;
        const k = items.length;
        const b = row.type === 'game' ? gameBooth(it, x, z) : row.type === 'tool' ? toolBooth(it, x, z) : assetBooth(it, x, z, k);
        for (const o of [b.root, ...(b.extra || [])]) o.traverse(m => { m.userData.booth = k; });
        items.push(it);
        booths.push({ item: it, k, x, z, fx: x, fz: b.fz, root: b.root, extra: b.extra || [], labelY: b.labelY });
        spots.push({ x, z: b.fz + rnd(0.1, 0.4), face: Math.PI, booth: k });
      });
    });

    // the walls: studded bricks with windows and a coloured base course; a doorway at the front (Kenney's door in it).
    // Each side is its own group so it can step aside when it's between the camera and you
    const wallCol = PAL.white, trim = BRIGHT[USER.length % BRIGHT.length];
    const side = (name, nx, nz) => { walls.push({ obj: groupOf(name), nx, nz }); return name; };
    const gB = side('wall-back', 0, -1), gL = side('wall-left', -1, 0), gR = side('wall-right', 1, 0), gF = side('wall-front', 0, 1);
    const wallRun = (x0, x1, z0, z1, group) => {   // a straight wall between two points, with a window in every other bay
      const horiz = z0 === z1, len = horiz ? x1 - x0 : z1 - z0;
      const n = Math.max(1, Math.round(len / 2.4)), sl = len / n;
      for (let i = 0; i < n; i++) {
        const c = (horiz ? x0 : z0) + i * sl + sl / 2;
        const cx = horiz ? c : x0, cz = horiz ? z0 : c, sx = horiz ? sl : WALL_T, sz = horiz ? WALL_T : sl;
        brick(cx, 0.19, cz, sx, 0.38, sz, trim, { group });
        if (i % 2 === 1 && sl > 1.6) {
          const ww = sl - 1.0;
          brick(cx, 0.64, cz, sx, 0.52, sz, wallCol, { group });
          brick(cx, 1.62, cz, sx, 0.56, sz, wallCol, { group });
          for (const e of [-1, 1]) brick(cx + (horiz ? e * (ww / 2 + 0.25) : 0), 1.11, cz + (horiz ? 0 : e * (ww / 2 + 0.25)), horiz ? 0.5 : WALL_T, 0.46, horiz ? WALL_T : 0.5, wallCol, { group });
          const gl = new THREE.Mesh(new THREE.BoxGeometry(horiz ? ww : 0.06, 0.46, horiz ? 0.06 : ww), glassMat); gl.position.set(cx, 1.11, cz); groupOf(group).add(gl);
        } else brick(cx, 1.14, cz, sx, 1.52, sz, wallCol, { group });
      }
    };
    wallRun(xL, xR, zBack, zBack, gB);
    wallRun(xL, xL, zBack, 0, gL);
    wallRun(xR, xR, zBack, 0, gR);
    wallRun(xL, doorX - DOOR_W / 2, 0, 0, gF);
    wallRun(doorX + DOOR_W / 2, xR, 0, 0, gF);
    brick(doorX, 1.55, 0, DOOR_W, 0.7, WALL_T, wallCol, { group: gF });   // over the door
    for (const [x, z, g] of [[xL, 0, gF], [xR, 0, gF], [xL, zBack, gB], [xR, zBack, gB]]) brick(x, WALL_H / 2 + 0.05, z, 0.62, WALL_H + 0.1, 0.62, trim, { group: g });
    const dr = place('wall-door-rotate', doorX, 0, Math.PI, { scale: DOOR_W, parent: groupOf(gF) });
    door = { obj: dr, x: doorX, open: 0 };
    const clip = THREE.AnimationClip.findByName(models['wall-door-rotate'].animations, 'open');
    if (clip) { door.mx = new THREE.AnimationMixer(dr); door.act = door.mx.clipAction(clip); door.act.play(); door.act.paused = true; door.dur = clip.duration; }
    solids.push({ minX: xL, maxX: doorX - DOOR_W / 2 + 0.05, minZ: -WALL_T, maxZ: WALL_T }, { minX: doorX + DOOR_W / 2 - 0.05, maxX: xR, minZ: -WALL_T, maxZ: WALL_T });
    // the store's own name over the door, outside
    const sign = signBoard(creator.name + '’s store', 4.2); sign.position.set(doorX, 2.25, 0.18); groupOf(gF).add(sign);
    brick(doorX, 2.25, 0.06, 4.4, 0.72, 0.12, PAL.dark, { studs: false, group: gF });

    // by the door: the counter with the shopkeeper behind it on one side, carts on the other, and the changing room
    const cx = xR - 1.7;
    brick(cx, 0.38, -1.9, 0.76, 0.76, 1.9, PAL.brown); brick(cx, 0.8, -1.9, 0.86, 0.08, 2.0, PAL.white, { studs: false });
    place('cash-register', cx, -1.6, -Math.PI / 2, { scale: 1.0, y: 0.84 });
    solid(cx, -1.9, 0.45, 1.0);
    keeperSpot = { x: cx + 0.85, z: -1.9, face: -Math.PI / 2 };
    place('shopping-cart', xL + 1.0, -1.0, 0.4); place('shopping-cart', xL + 1.45, -1.4, 0.25); place('shopping-basket', xL + 0.85, -2.1);
    solid(xL + 1.2, -1.2, 0.6, 0.6);
    changeRoom(xL + 1.3, -3.6);
    place('display-flowers', doorX - 1.9, -0.9); solid(doorX - 1.9, -0.9, 0.5, 0.5);
    place('display-flowers', doorX + 1.9, -0.9); solid(doorX + 1.9, -0.9, 0.5, 0.5);
    // stock along the side walls between the rows
    rows.forEach((row, ri) => {
      if (ri === 0) return;
      const z = -(ENTRY + ri * CELL_Z) - 0.2;
      const d = row.type === 'game' ? ['claw-machine', 'basketball-game', 'prize-wheel', 'ticket-machine', 'air-hockey'] : row.type === 'tool' ? ['gacha-machine', 'freezers-standing'] : ['shelf-boxes', 'shelf-bags', 'freezers-standing', 'display-fruit', 'clothing-rack'];
      for (const [x, rot] of [[xL + 0.75, Math.PI / 2], [xR - 0.75, -Math.PI / 2]]) {
        const name = d[(ri + (rot > 0 ? 0 : 1)) % d.length];
        place(name, x, z, rot, { anim: /claw|wheel|ticket/.test(name) }); solid(x, z, 0.55, 0.65);
      }
    });
    // a few open spots for shoppers to wander to
    for (let i = 0; i < 6; i++) spots.push({ x: rnd(xL + 1.6, xR - 1.6), z: rnd(zBack + 1.5, -2.6) });
    flushBricks();
    for (const b of booths) { freeze(b.root); b.extra.forEach(freeze); }
  }
  let door = null, keeperSpot = null, room = null;
  // the changing room: a booth with a mirror and a sign. Walk up to it to change your character
  function changeRoom(x, z) {
    brick(x, 0.04, z, 1.6, 0.08, 1.4, PAL.purple);
    brick(x - 0.74, 0.95, z, 0.12, 1.9, 1.4, PAL.purple, { studs: false }); brick(x + 0.74, 0.95, z, 0.12, 1.9, 1.4, PAL.purple, { studs: false });
    brick(x, 0.95, z - 0.64, 1.6, 1.9, 0.12, PAL.purple, { studs: false }); brick(x, 1.96, z, 1.7, 0.12, 1.5, PAL.purple);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshPhongMaterial({ color: 0xcfe6ff, shininess: 120, specular: 0xffffff }));
    mirror.position.set(x, 0.95, z - 0.57); scene.add(mirror);
    const sign = signBoard('Change your look', 2.2); sign.position.set(x, 2.25, z + 0.77); scene.add(sign);
    solid(x, z - 0.64, 0.86, 0.1); solid(x - 0.74, z, 0.1, 0.72); solid(x + 0.74, z, 0.1, 0.72);
    room = { x, z, fx: x, fz: z + 0.2, sign };
  }
  function signBoard(text, width) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#1b2a35'; x.fillRect(0, 0, 1024, 160);
    x.fillStyle = '#fff'; x.font = '800 84px ' + FONT; x.textAlign = 'center';
    x.lineWidth = 8; x.strokeStyle = '#000'; const t = fitText(x, text, 960); x.strokeText(t, 512, 110); x.fillText(t, 512, 110);
    const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, width * 160 / 1024), new THREE.MeshBasicMaterial({ map: tx }));
  }

  /* ---------------- characters: the classic Grug rig, dressed in outfits ---------------- */
  // As in every Arcade game: 1 unit = 1 stud inside the rig, facing -Z, right arm on +X; GrugOutfitRig dresses it. The
  // whole rig is scaled by S. Our own retro animations swing the pivots (never the studio's clips).
  const RG = { torso: new THREE.BoxGeometry(2, 2, 1), limb: new THREE.BoxGeometry(1, 2, 1), head: new THREE.BoxGeometry(1.2, 1.2, 1.2) };
  const LMC = {}, lam = c => LMC[c] || (LMC[c] = new THREE.MeshPhongMaterial(Object.assign({ color: c }, SHINE)));
  const randomLook = () => ({ skin: pick([0xf5cd30, 0xe0b48a, 0xa8744a, 0x6a4a32, 0xffd8b8]), shirt: pick([0x0d69ac, 0x4b974b, 0xda8541, 0x6b327c, 0x27466a]), pants: pick([0x1b2a35, 0x27466a, 0x3a3a40]) });
  function makeRig(look) {
    const g = new THREE.Group(), root = new THREE.Group(); root.position.y = 3; g.add(root);
    const M = (geo, m) => { const x = new THREE.Mesh(geo, m); x.castShadow = true; x.receiveShadow = true; return x; };
    const torso = M(RG.torso, lam(look.shirt)); root.add(torso);
    const head = M(RG.head, lam(look.skin)); head.position.y = 1.6; root.add(head);
    const limb = (px, py, m, hang) => { const pv = new THREE.Group(); pv.position.set(px, py, 0); const x = M(RG.limb, m); x.position.y = hang; pv.add(x); root.add(pv); return pv; };
    const rs = limb(1.5, 0.5, lam(look.shirt), -0.5), ls = limb(-1.5, 0.5, lam(look.shirt), -0.5), rh = limb(0.5, -1, lam(look.pants), -1), lh = limb(-0.5, -1, lam(look.pants), -1);
    g.scale.setScalar(S); scene.add(g);
    root.visible = false;   // nobody is shown as the plain blocky rig: hidden until dressed
    return { g, root, torso, head, rs, ls, rh, lh, j: { rs: 0, ls: 0, rh: 0, lh: 0 }, walkT: rnd(0, 6) };
  }
  function animateRig(f, dt) {
    const r = f.rig, j = r.j;
    r.g.position.set(f.x, f.hop || 0, f.z); r.g.rotation.y = f.rot + Math.PI;
    let t, rate = 12;
    if (f.hop > 0.01) { t = { rs: Math.PI, ls: Math.PI, rh: 0, lh: 0 }; rate = 30; r.walkT = 0; }
    else if (f.speed > 0.3) { r.walkT += dt * (0.6 + f.speed / 3.2); const s = Math.sin(r.walkT * 9); t = { rs: s, ls: -s, rh: -s, lh: s }; }
    else if (f.wave > 0) { t = { rs: Math.PI * 0.9 + Math.sin(f.wave * 14) * 0.35, ls: 0, rh: 0, lh: 0 }; rate = 20; }
    else { t = { rs: 0, ls: 0, rh: 0, lh: 0 }; rate = 9; r.walkT = 0; }
    for (const k in j) j[k] += Math.max(-rate * dt, Math.min(rate * dt, t[k] - j[k]));
    r.rs.rotation.x = j.rs; r.ls.rotation.x = j.ls; r.rh.rotation.x = j.rh; r.lh.rotation.x = j.lh;
  }
  // name tags and chat bubbles: the Arcade's, drawn over the picture
  function makeTag(name) {
    const el = document.createElement('div'); el.className = 'ntag'; el.innerHTML = '<div class="bub"></div><div class="nm"></div>';
    $('#tags').appendChild(el);
    const t = { el, bub: el.querySelector('.bub'), nm: el.querySelector('.nm'), on: false };
    t.nm.textContent = name || ''; if (!name) t.nm.style.display = 'none';
    return t;
  }
  function say(f, text) { f.chat = { t: 3.5 + text.length * 0.06 }; f.tag.bub.textContent = text; f.tag.bub.style.display = 'block'; }
  const tv = new THREE.Vector3();
  function placeTag(f) {
    const t = f.tag; if (!t) return;
    tv.set(f.x, (f.hop || 0) + 1.32, f.z); const d = tv.distanceTo(cam.position); tv.project(cam);
    const on = f.rig.root.visible && d < (f.chat ? 16 : 9) && tv.z < 1 && Math.abs(tv.x) < 1.1 && Math.abs(tv.y) < 1.1 && (t.nm.style.display !== 'none' || !!f.chat);
    if (on !== t.on) { t.on = on; t.el.style.display = on ? 'block' : 'none'; }
    if (on) t.el.style.transform = `translate(${((tv.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-tv.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%,-100%)`;
  }
  const SHOP_LINES = ['ooh', 'this one looks cool', 'is this on sale?', 'want', 'nice pack', 'brb buying this', 'lol', 'hi', 'how much is it?',
    'love this shop', 'the arcade is in the back!', 'cool outfit', 'anyone tried this one?', 'adding to my collection', 'so many models', 'gg'];
  const MALL_LINES = ['so many stores', 'hi', 'wheres the arcade?', 'lol', 'this mall is huge', 'brb', 'cool outfit', 'lets go in here'];

  /* ---------------- you ---------------- */
  const me = { x: 0, z: -1, rot: Math.PI, rig: null, speed: 0, dest: null, face: null, hop: 0, vy: 0, wave: 0 };
  const R_ME = 0.24;
  // where you can stand: the store, the mall (when it's there), and the doorway between them
  function areas() { return Mall.ready ? [bounds, Mall.bounds, { minX: doorX - DOOR_W / 2 + 0.05, maxX: doorX + DOOR_W / 2 - 0.05, minZ: -0.8, maxZ: 0.8, door: true }] : [bounds]; }
  function collide(f, inside) {
    const A = inside || areas();
    let best = null, bd = Infinity;
    for (const a of A) {
      const ins = a.door ? R_ME * 0.3 : WALL_T / 2 + 0.05 + R_ME;
      const cx = Math.max(a.minX + ins, Math.min(a.maxX - ins, f.x)), cz = Math.max(a.minZ + (a.door ? 0 : ins), Math.min(a.maxZ - (a.door ? 0 : ins), f.z));
      const d = Math.hypot(cx - f.x, cz - f.z);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    f.x = best[0]; f.z = best[1];
    for (let i = 0, n = solids.length + Mall.solids.length; i < n; i++) {
      const s = i < solids.length ? solids[i] : Mall.solids[i - solids.length];
      const cx = Math.max(s.minX, Math.min(s.maxX, f.x)), cz = Math.max(s.minZ, Math.min(s.maxZ, f.z));
      const dx = f.x - cx, dz = f.z - cz, d = Math.hypot(dx, dz);
      if (d < R_ME) {
        if (d > 1e-5) { f.x = cx + dx / d * R_ME; f.z = cz + dz / d * R_ME; }
        else { const l = f.x - s.minX, r = s.maxX - f.x, fr = s.maxZ - f.z, k = f.z - s.minZ, m = Math.min(l, r, fr, k);
          if (m === l) f.x = s.minX - R_ME; else if (m === r) f.x = s.maxX + R_ME; else if (m === fr) f.z = s.maxZ + R_ME; else f.z = s.minZ - R_ME; }
      }
    }
  }
  function walkTo(x, z, face) {
    me.dest = { x, z }; me.face = face == null ? null : face; hint.hide();
    if (mode === 'overview') follow(700);
  }
  function teleport(k) {
    const b = booths[k];
    me.x = b.fx; me.z = b.fz; me.rot = Math.PI; me.dest = null; me.face = Math.PI; collide(me);
    Object.assign(view, { ...followView(), th: 0, tx: me.x, tz: me.z });
    mode = 'follow'; tween = null;
  }

  /* ---------------- the crowd: shoppers who wander, look, hop and chat ---------------- */
  const npcs = [];
  function makeNpc(where) {
    const n = { x: 0, z: 0, rot: rnd(0, 6.28), speed: 0, rig: makeRig(randomLook()), tag: makeTag(''), where, state: 'idle', wait: rnd(0.5, 4), hop: 0, vy: 0, chat: null, wave: 0 };
    const s = where === 'mall' && Mall.ready ? Mall.spot() : pick(spots);
    n.x = s.x + rnd(-0.3, 0.3); n.z = s.z + rnd(-0.3, 0.3); collide(n, where === 'mall' ? [Mall.bounds] : [bounds]);
    npcs.push(n); return n;
  }
  function updateNpc(n, dt) {
    const A = n.where === 'mall' ? [Mall.bounds] : [bounds];
    if (n.chat && (n.chat.t -= dt) <= 0) { n.chat = null; n.tag.bub.style.display = 'none'; }
    if (n.hop > 0 || n.vy > 0) { n.vy -= 9.8 * dt; n.hop = Math.max(0, n.hop + n.vy * dt); if (n.hop === 0) n.vy = 0; }
    if (n.wave > 0) n.wave -= dt;
    if (n.where === 'keeper') {
      // the shopkeeper: turns to you and waves as you come in, otherwise minds the till
      const d = Math.hypot(me.x - n.x, me.z - n.z);
      const want = d < 3.5 ? Math.atan2(me.x - n.x, me.z - n.z) : n.home.face;
      let dr = want - n.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); n.rot += dr * Math.min(1, dt * 5);
      if (d < 3.2 && !n.greeted) { n.greeted = true; n.wave = 1.6; say(n, pick(['hi! welcome in', 'welcome to ' + creator.name + '’s store!', 'hey! have a look around'])); }
      if (d > 6) n.greeted = false;
      n.speed = 0; return;
    }
    if (n.state === 'walk') {
      const dx = n.to.x - n.x, dz = n.to.z - n.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { n.state = 'look'; n.wait = rnd(2, 7); n.speed = 0; if (n.to.face != null) n.face = n.to.face; if (Math.random() < 0.3) say(n, pick(n.where === 'mall' ? MALL_LINES : SHOP_LINES)); }
      else {
        n.speed += (Math.min(2.4, d * 3 + 0.5) - n.speed) * Math.min(1, dt * 6);
        const px = n.x, pz = n.z; n.x += dx / d * n.speed * dt; n.z += dz / d * n.speed * dt; collide(n, A);
        if (Math.hypot(n.x - px, n.z - pz) < n.speed * dt * 0.2) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 0.6) { n.stuck = 0; n.state = 'idle'; n.wait = 0.3; } }
        let dr = Math.atan2(dx, dz) - n.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); n.rot += dr * Math.min(1, dt * 10);
      }
    } else {
      n.speed *= 0.8;
      if (n.face != null) { let dr = n.face - n.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); n.rot += dr * Math.min(1, dt * 6); }
      if ((n.wait -= dt) <= 0) {
        n.face = null;
        const s = n.where === 'mall' ? Mall.spot() : pick(spots);
        n.to = { x: s.x + rnd(-0.35, 0.35), z: s.z + rnd(-0.2, 0.2), face: s.face }; n.state = 'walk';
      } else if (n.hop === 0 && Math.random() < dt * 0.06) n.vy = 3.6;   // a little hop now and then
    }
  }

  /* ---------------- dressing everyone ---------------- */
  const KIT = ['ranger', 'skater', 'grug', 'medic', 'racer', 'snow-rider', 'scavenger', 'flannel'];
  const GUEST_NAMES = ['Builderman42', 'PixelPal', 'noob_master', 'CoolKid2010', 'BrickFan', 'Shopaholic', 'LuckyStud', 'GameHunter', 'Cubey', 'ObbyQueen'];
  const kitOutfits = () => Promise.all(AVATARS ? AVATARS.map(a => GrugOutfitRig.fromURL(a.url, a.name)) : KIT.map(n => GrugOutfitRig.fromURL('/arcade/outfits/' + n + '.glb', n.replace('-', ' ')))).then(a => a.filter(Boolean));
  // the itch.io version: you wear one of the built-in Grug avatars (the one you picked last time, Grug at first)
  const LOOK_KEY = 'grug.store.look';
  const myAvatar = () => { let id = 'grug'; try { id = localStorage.getItem(LOOK_KEY) || id; } catch (e) {} return AVATARS.find(a => a.id === id) || AVATARS[0]; };
  async function wearAvatar(a) { const o = await GrugOutfitRig.fromURL(a.url, a.name); if (o) { GrugOutfitRig.dress(me.rig, o); me.rig.root.visible = true; } }
  async function wearOutfits() {
    const all = [me, ...npcs];
    const cap = setTimeout(() => all.forEach(c => { c.rig.root.visible = true; }), 8000);
    if (!window.GrugOutfitRig) { clearTimeout(cap); all.forEach(c => { c.rig.root.visible = true; }); return; }
    try {
      if (AVATARS) await wearAvatar(myAvatar());
      else { const look = await GrugOutfitRig.load(); if (look) GrugOutfitRig.dress(me.rig, look); }
      me.rig.root.visible = true;
      const [others, kit] = await Promise.all([AVATARS ? [] : GrugOutfitRig.others(npcs.length), kitOutfits()]);
      const pool = others.concat(kit.sort(() => Math.random() - 0.5));
      npcs.forEach((n, i) => {
        const o = pool[i % Math.max(1, pool.length)];
        if (o) GrugOutfitRig.dress(n.rig, o);
        n.tag.nm.textContent = n.keeper ? 'Shopkeeper' : pick(GUEST_NAMES); n.tag.nm.style.display = '';
        n.rig.root.visible = true;
      });
    } catch (e) { console.warn('outfits', e); }
    clearTimeout(cap); all.forEach(c => { c.rig.root.visible = true; });
  }
  // dress shoppers added later (the mall's)
  async function wearMore(list) {
    list.forEach(n => { n.tag.nm.textContent = pick(GUEST_NAMES); n.tag.nm.style.display = ''; });
    if (!window.GrugOutfitRig) { list.forEach(n => { n.rig.root.visible = true; }); return; }
    try {
      const [others, kit] = await Promise.all([AVATARS ? [] : GrugOutfitRig.others(list.length + 8), kitOutfits()]);
      const pool = others.slice(4).concat(kit.sort(() => Math.random() - 0.5));
      list.forEach((n, i) => { const o = pool[i % Math.max(1, pool.length)]; if (o) GrugOutfitRig.dress(n.rig, o); n.rig.root.visible = true; });
    } catch (e) { list.forEach(n => { n.rig.root.visible = true; }); }
  }
  addEventListener('grug:outfits', async () => { if (window.GrugOutfitRig && me.rig) { const l = await GrugOutfitRig.load(); if (l) GrugOutfitRig.dress(me.rig, l); } });

  /* ---------------- the Avatar Studio over the store ---------------- */
  const Studio = {
    el: null, frame: null, loaded: false,
    open() {
      if (AVATARS) { Looks.open(); return; }
      if (!this.el) { this.el = $('#studio'); this.frame = this.el.querySelector('iframe'); this.frame.src = '/character/?embed'; }
      else if (this.loaded) try { this.frame.contentWindow.postMessage({ grug: 'studio', type: 'open' }, location.origin); } catch (e) {}
      this.el.hidden = false; document.body.classList.add('studio-open');
      hint.hide();
    },
    close() { if (this.el) this.el.hidden = true; document.body.classList.remove('studio-open'); clock.getDelta(); },
  };
  addEventListener('message', async e => {
    if (e.origin !== location.origin || !e.data || e.data.grug !== 'studio') return;
    if (e.data.type === 'ready') { Studio.loaded = true; document.body.classList.add('studio-ready'); }
    if (e.data.type === 'close') Studio.close();
    if (e.data.type === 'wear') {
      Studio.close();
      if (window.GrugOutfitRig) { const l = await GrugOutfitRig.load(); if (l) { GrugOutfitRig.dress(me.rig, l); me.rig.root.visible = true; } }
      me.wave = 1.4; hint.show('Looking good! That’s you now, all over Grug.', 4500);
    }
  });
  // the itch.io version's changing room: the built-in Grug avatars to pick from, and a link to make your own on the site
  const Looks = {
    open() {
      const g = $('#lGrid'), cur = myAvatar();
      g.innerHTML = AVATARS.map(a => `<button class="tile look" type="button" data-id="${esc(a.id)}" aria-pressed="${a.id === cur.id}"><div class="im"><img loading="lazy" src="${esc(a.thumb)}" alt=""></div><div class="tx"><b>${esc(a.name)}</b></div></button>`).join('');
      $('#lMake').href = (SITE || 'https://grugdigital.com') + '/character/';
      Panels.open('looks');
    },
  };
  if (AVATARS) $('#lGrid').addEventListener('click', async e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const a = AVATARS.find(x => x.id === b.dataset.id); if (!a) return;
    try { localStorage.setItem(LOOK_KEY, a.id); } catch (e) {}
    for (const x of $('#lGrid').children) x.setAttribute('aria-pressed', x === b);
    await wearAvatar(a); me.wave = 1.4; Panels.closeAll(); hint.show('Looking good, ' + a.name + '!', 3000);
  });
  $('#meBtn').onclick = () => Studio.open();
  $('#studioClose').onclick = () => Studio.close();

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
    if (document.body.classList.contains('studio-open')) { if (e.key === 'Escape') Studio.close(); return; }
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys.add(k); me.dest = null; hint.hide(); if (k.startsWith('arrow')) e.preventDefault(); if (mode === 'overview') follow(600);
    } else if (k === ' ') { if (!me.hop && !me.vy) me.vy = 4.2; e.preventDefault(); }
    else if ((k === 'e' || k === 'enter') && nearThing && !Panels.cur) activate();
    else if (k === 'escape') Panels.closeAll();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  /* ---------------- camera ---------------- */
  const view = { tx: 0, ty: 0.6, tz: -2, th: 0, ph: 0.8, r: 8 };
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
  function followView() {
    const a = W / Math.max(1, H);
    const r = (a < 0.7 ? 9.5 : a < 1.1 ? 8 : 7) * zoom;
    return { tx: me.x, ty: 0.6, tz: me.z, th: view.th, ph: view.ph, r };
  }
  function follow(ms) { mode = 'follow'; tweenTo({ ...followView(), ph: 0.88 }, ms); }
  function overviewView(ins = hudInsets()) {
    const a = W / H;
    const th = a < 1 ? 0 : a < 1.3 ? 0.7 : 1.22, ph = a < 1 ? 0.98 : a < 1.3 ? 0.88 : 0.8;
    const b = bounds, pts = [];
    for (const x of [b.minX - 0.3, b.maxX + 0.3]) for (const z of [b.minZ - 0.3, b.maxZ + 0.3]) for (const y of [-0.15, WALL_H]) pts.push(new THREE.Vector3(x, y, z));
    const v = { tx: (b.minX + b.maxX) / 2, ty: 0.4, tz: (b.minZ + b.maxZ) / 2, th, ph, r: 10 };
    const save = { ...view }, saveIn = inset;
    Object.assign(view, v); inset = ins;
    const lim = { l: -0.97, r: 0.97 - 2 * ins.right / W, t: 1 - 2 * ins.top / H, b: -1 + 2 * ins.bottom / H };
    let lo = 2, hi = 300;
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
      const to = mode === 'follow' ? { ...tween.to, tx: me.x, tz: me.z } : tween.to;
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
      if (gesture.d > 0) { const f = gesture.d / Math.max(1, d); if (mode === 'follow') zoom = Math.max(0.4, Math.min(2.4, zoom * f)); else view.r = Math.max(3, Math.min(250, view.r * f)); }
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
    if (mode === 'follow') zoom = Math.max(0.4, Math.min(2.4, zoom * f)); else view.r = Math.max(3, Math.min(250, view.r * f));
  }, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function aim(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  function pickThing() {
    const targets = []; for (const b of booths) targets.push(b.root, ...b.extra);
    for (const s of Mall.fronts) targets.push(s.group);
    if (room) targets.push(room.sign);
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      if (o.userData.booth != null) return { booth: o.userData.booth };
      if (o.userData.front != null) return { front: o.userData.front };
      if (room && o === room.sign) return { room: true };
    }
    return null;
  }
  function tap(e) {
    aim(e);
    const t = pickThing();
    if (t && t.booth != null) { const b = booths[t.booth]; walkTo(b.fx, b.fz, Math.PI); return; }
    if (t && t.front != null) { const s = Mall.fronts[t.front]; walkTo(s.dx, s.dz - s.dir * 0.4, s.dir > 0 ? Math.PI : 0); return; }
    if (t && t.room) { walkTo(room.fx, room.fz + 0.6, Math.PI); return; }
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(ground, p) && areas().some(a => p.x > a.minX && p.x < a.maxX && p.z > a.minZ && p.z < a.maxZ)) walkTo(p.x, p.z);
  }
  let hoverT = 0;
  function hover(e) {
    const now = performance.now(); if (now - hoverT < 70) return; hoverT = now;
    aim(e); el.style.cursor = pickThing() ? 'pointer' : 'grab';
  }

  /* ---------------- the bar next to a product, a storefront or the changing room ---------------- */
  let nearThing = null;
  function setNear(t) {
    const key = t ? (t.booth != null ? 'b' + t.booth : t.front != null ? 'f' + t.front : 'room') : '';
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
    } else if (t.front != null) {
      const s = Mall.fronts[t.front];
      $('#nearTitle').textContent = s.name + '’s store';
      $('#nearMeta').textContent = s.count ? s.count + ' project' + (s.count === 1 ? '' : 's') + ' on itch.io' : 'On itch.io';
      go.href = Mall.storeUrl(s.user); go.target = EMBED ? '_blank' : '_self';
      $('#nearLabel').innerHTML = 'Go in' + (TOUCH ? '' : ' <kbd>E</kbd>');
    } else {
      $('#nearTitle').textContent = 'Change your look';
      $('#nearMeta').textContent = AVATARS ? 'Pick who you shop as' : 'Make this character yours';
      go.href = AVATARS ? '#' : '/character/'; go.target = '_self';
      $('#nearLabel').innerHTML = 'Customize' + (TOUCH ? '' : ' <kbd>E</kbd>');
    }
    bar.hidden = false;
  }
  function activate() {
    if (!nearThing) return;
    if (nearThing.booth != null) window.open(items[nearThing.booth].url, '_blank', 'noopener');
    else if (nearThing.room) Studio.open();
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
  $('#bGrid').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; Panels.closeAll(); teleport(+b.dataset.k); });
  $('#openBrowse').onclick = () => Panels.cur === 'browse' ? Panels.closeAll() : Panels.open('browse');
  $('#viewBtn').onclick = () => { if (mode === 'overview') follow(800); else { mode = 'overview'; tweenTo(overviewView(insetForPanels()), 800); } };
  function setRes(r) { RES = r; try { localStorage.setItem(RES_KEY, String(r)); } catch (e) {} renderer.setPixelRatio(r); resize(); $('#resBtn').textContent = Math.round(r * 100) + '%'; }
  $('#resBtn').textContent = Math.round(RES * 100) + '%';
  $('#resBtn').onclick = () => { setRes(RES === 0.5 ? 0.75 : RES === 0.75 ? 1 : 0.5); hint.show('3D resolution: ' + Math.round(RES * 100) + '%' + (RES === 0.5 ? ' (fastest)' : RES === 1 ? ' (sharpest)' : ''), 2200); };
  $('#fullBtn').onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} };
  $('#nearGo').addEventListener('click', e => { if (nearThing && (nearThing.room || (nearThing.front != null && !EMBED))) { e.preventDefault(); activate(); } });

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
  const Mall = { ready: false, bounds: null, solids: [], fronts: [], spot: () => ({ x: 0, z: 3 }), storeUrl: u => SITE + '/store/' + u + '?from=door' };
  const DBG = window.GrugStoreDebug = { me, Mall, view, npcs, draws: 0, get bounds() { return bounds; } };

  /* ---------------- the loop ---------------- */
  const clock = new THREE.Clock();
  let lastZone = '', hereSign = null, lastDraw = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { loopStep(now); } catch (e) { window.GrugLoopErrors = (window.GrugLoopErrors || 0) + 1; if (window.GrugLoopErrors < 5) console.error(e); }
  }
  function loopStep(now) {
    if (!me.rig) { if (bounds) renderer.render(scene, cam); return; }
    if (document.body.classList.contains('studio-open')) return;   // the studio covers everything: nothing to draw
    if (TOUCH && now - lastDraw < 31) return;                        // phones: 30 frames a second is plenty, and the battery lasts
    lastDraw = now;
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
      want = keys.size ? 3.0 : 3.0 * im;
      me.face = null;
    } else if (me.dest) {
      const dx = me.dest.x - me.x, dz = me.dest.z - me.z, d = Math.hypot(dx, dz);
      if (d < 0.07) { me.dest = null; if (me.face != null && me.z > 0.4) tweenTo({ ...followView(), th: me.face + Math.PI }, 700); }
      else { mx = dx / d; mz = dz / d; want = Math.min(3.0, d * 4 + 0.4); }
    }
    me.speed += (want - me.speed) * Math.min(1, dt * 12);
    if (want > 0) {
      const px = me.x, pz = me.z;
      me.x += mx * me.speed * dt; me.z += mz * me.speed * dt;
      collide(me);
      if (me.dest && Math.hypot(me.x - px, me.z - pz) < me.speed * dt * 0.15) me.dest = null;
      let d = Math.atan2(mx, mz) - me.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); me.rot += d * Math.min(1, dt * 14);
    } else if (me.face != null && !me.dest) {
      let d = me.face - me.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); me.rot += d * Math.min(1, dt * 10);
    }
    if (me.hop > 0 || me.vy > 0) { me.vy -= 9.8 * dt; me.hop = Math.max(0, me.hop + me.vy * dt); if (me.hop === 0) me.vy = 0; }
    if (me.wave > 0) me.wave -= dt;
    if (me.z > 0.4 && me.speed > 0.6 && !ptrs.size && !tween) {   // in the mall the camera eases round behind you
      let d = me.rot + Math.PI - view.th; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) view.th += d * Math.min(1, dt * 1.5);
    }
    animateRig(me, dt);
    for (const n of npcs) {
      updateNpc(n, dt);
      // shoppers far from you aren't drawn (they keep walking about)
      const far = Math.abs(n.x - view.tx) + Math.abs(n.z - view.tz) > 24;
      if (n.rig.g.visible === far) n.rig.g.visible = !far;
      if (!far) animateRig(n, dt);
    }

    // what's in reach: a product, the changing room, or a storefront's door
    let best = null, bd = 1.3;
    for (const b of booths) { const d = Math.hypot(me.x - b.fx, me.z - b.fz); if (d < bd) { bd = d; best = { booth: b.k }; } }
    if (!best && room && Math.hypot(me.x - room.fx, me.z - room.fz) < 1.5) best = { room: true };
    if (!best) for (const s of Mall.fronts) { if (Math.hypot(me.x - s.dx, me.z - s.dz) < 1.7) { best = { front: s.i }; break; } }
    setNear(best);

    if (door && door.act) {
      const w = (Math.abs(me.x - door.x) < 1.6 && Math.abs(me.z) < 1.8) || npcs.some(n => Math.abs(n.x - door.x) < 1.2 && Math.abs(n.z) < 1.4) ? 1 : 0;
      if (Math.abs(w - door.open) > 0.002) { door.open += (w - door.open) * Math.min(1, dt * 6); door.act.time = door.open * door.dur * 0.999; door.mx.update(0); }
    }
    Mall.step && Mall.step(now, dt, me);
    const zone = me.z > 0.4 ? 'mall' : 'store';
    if (zone !== lastZone) { if (lastZone && mode === 'follow' && !tween) tweenTo({ ...followView(), ph: zone === 'mall' ? 1.0 : 0.88 }, 900); lastZone = zone; }

    stepCamera(now, dt);
    applyCam();
    sky.position.copy(cam.position);
    const sx = Math.round(view.tx), sz = Math.round(view.tz);
    sun.position.set(sx + SUN_DIR.x * 60, SUN_DIR.y * 60, sz + SUN_DIR.z * 60); sun.target.position.set(sx, 0, sz);
    for (const m of mixers) m.update(dt);
    if (hereSign) { hereSign.rotation.set(-view.ph * 0.6, view.th, 0, 'YXZ'); hereSign.position.y = hereSign.userData.y + Math.sin(now / 420) * 0.03; }
    for (const n of npcs) if (n.rig.g.visible || n.tag.on) placeTag(n);

    // the store's walls between the camera and you step aside (only while you're inside)
    const inside = me.z < 0;
    const dx = cam.position.x - view.tx, dz = cam.position.z - view.tz, dl = Math.hypot(dx, dz) || 1;
    const ux = dx / dl, uz = dz / dl;
    for (const w of walls) {
      const faces = (w.nx * ux + w.nz * uz) > 0.28;
      w.obj.visible = !((inside && faces) || (!inside && w.nz === 1 && blocks(0)));
    }
    Mall.walls && Mall.walls(blocks, me);
    renderer.render(scene, cam);
    DBG.draws++;
  }
  // does a wall along z = z0 (about 2 high) stand between the camera and you?
  function blocks(z0) {
    const cz = cam.position.z;
    if ((z0 - me.z) * (cz - z0) <= 0) return false;
    const t = (z0 - me.z) / (cz - me.z);
    return 0.6 + (cam.position.y - 0.6) * t < 2.6;
  }

  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight);
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.fov = W / H < 0.8 ? 55 : 46; cam.updateProjectionMatrix();
    insetGoal = insetForPanels(); inset = { ...insetGoal };
    if (bounds && mode === 'overview') { Object.assign(view, overviewView(insetGoal)); tween = null; }
  }
  new ResizeObserver(resize).observe(stage);

  function floater(text) {
    const c = document.createElement('canvas'); const x = c.getContext('2d');
    x.font = '700 40px ' + FONT; const w = Math.min(1000, Math.ceil(x.measureText(text).width) + 56);
    c.width = w; c.height = 92; x.font = '700 40px ' + FONT;
    x.fillStyle = '#ffffff'; x.strokeStyle = '#000'; x.lineWidth = 3; roundRect(x, 3, 3, w - 6, 66, 10); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(w / 2 - 14, 68); x.lineTo(w / 2, 88); x.lineTo(w / 2 + 14, 68); x.fill();
    x.fillStyle = '#111'; x.textAlign = 'center'; x.fillText(text, w / 2, 50);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w / 92 * 0.26, 0.26), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }));
    m.renderOrder = 5; scene.add(m); return m;
  }

  /* ---------------- start ---------------- */
  async function start() {
    resize();
    requestAnimationFrame(frame);
    let data;
    try {
      const r = await fetch(API + '/api/itch-store?user=' + encodeURIComponent(USER));
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
    me.rig = makeRig({ skin: 0xf5cd30, shirt: 0x0d69ac, pants: 0x4b974b });
    // the shopkeeper and the shoppers: more in a bigger store
    const keeper = makeNpc('store'); keeper.where = 'keeper'; keeper.keeper = true; keeper.home = keeperSpot;
    keeper.x = keeperSpot.x; keeper.z = keeperSpot.z; keeper.rot = keeperSpot.face;
    const shoppers = Math.max(3, Math.min(TOUCH ? 4 : 6, Math.round(items.length / 4)));
    for (let i = 0; i < shoppers; i++) makeNpc('store');
    wearOutfits();
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
      hereSign = floater('You are here');
      hereSign.userData.y = sp.labelY + 0.35; hereSign.position.set(sp.x, hereSign.userData.y, sp.z);
      hint.show('You’re looking at ' + sp.item.title + '. Walk around to see everything else from ' + creator.name + '.', 8000);
    } else {
      me.x = doorX; me.z = -1.2; me.rot = Math.PI;
      hint.show(TOUCH ? 'Use the stick or tap the floor to walk · Walk up to anything to open it' : 'WASD or click to walk · Space to hop · E opens what you’re next to', 8000);
    }
    collide(me);
    mode = 'overview';
    Object.assign(view, overviewView(insetGoal));
    view.th = 0;
    veil.progress(1); veil.done();
    if (Q.get('from') === 'door') { mode = 'follow'; Object.assign(view, { ...followView(), th: 0, ph: 0.88 }); }
    else setTimeout(() => { mode = 'follow'; tweenTo({ ...followView(), th: 0, ph: 0.88 }, 1500); }, sp ? 350 : 900);
    if (LANDING) setTimeout(() => Panels.open('make'), 2600);
    // a nudge toward the changing room, once, after a little while
    setTimeout(() => { if (!Panels.cur && !document.body.classList.contains('studio-open')) hint.show('Tip: make this character yours. Tap “Your character”, or try the changing room by the door.', 7000); }, 26000);

    // the mall outside the door
    const s = document.createElement('script'); s.src = ASSETS + 'mall.js';
    s.onload = () => window.GrugMall && window.GrugMall({ THREE, scene, cam, API, models, place, brick, flushBricks, groupOf, PAL, BRIGHT, signBoard, loadImage, makeNpc, wearMore, Mall, USER, doorX, DOOR_W, WALL_H, WALL_T, bounds, EMBED });
    document.head.appendChild(s);
  }
  start();
})();
