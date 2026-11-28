/* Grug · the mall outside a 3D store's front door (loaded by static/store/store.js once the store is standing).

   A wide corridor on the baseplate runs past the door with other creators' storefronts along both sides, built the
   same way as the store: studded plastic bricks, a coloured base course and pillars, the creator's name over the door,
   a few of their covers in the windows, Kenney's door. Shoppers wander up and down, stop at the windows and chat;
   there are planters and benches down the middle. Who's there comes from /api/mall (a pool of real itch.io creators
   from itch's own featured, top-rated and new lists, shuffled by this store's username and the day; Grug's own store,
   polysw, always takes the fifth spot). As you walk up to a storefront it's checked against /api/itch-store: a live
   one gets its creator's display name and covers, a gone one shutters. Walk through a door (or Go in on the bar) to go
   into that store; inside an itch.io embed other stores open in a new tab instead. ?mall=0 leaves the mall out. */
window.GrugMall = function (G) {
  'use strict';
  const { THREE, place, brick, flushBricks, groupOf, PAL, BRIGHT, signBoard, loadImage, makeNpc, wearMore, Mall, USER, EMBED, models, DOOR_W, WALL_H, WALL_T } = G;
  if (new URLSearchParams(location.search).get('mall') === '0') return;
  const CZ = 8, FW = 8, GAP = 1, DEEP = 5;
  const W = G.bounds.maxX - G.bounds.minX;
  const doorX = G.doorX;
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  fetch('/api/mall?user=' + encodeURIComponent(USER)).then(r => r.ok ? r.json() : null).then(d => { if (d && d.neighbours) build(d.neighbours); }).catch(() => {});

  function build(neighbours) {
    // the spots, nearest the door first: across the corridor, then along this side
    const spots = [];
    for (let i = -4; i <= 4; i++) spots.push({ cx: i * (FW + GAP), line: CZ, dir: -1 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) spots.push({ cx: s * (W / 2 + GAP + FW / 2 + i * (FW + GAP)), line: 0, dir: 1 });
    spots.sort((a, b) => Math.hypot(a.cx - doorX, a.line) - Math.hypot(b.cx - doorX, b.line));
    const maxX = Math.max(W / 2 + GAP + 4 * (FW + GAP), 4 * (FW + GAP) + FW / 2 + GAP);
    Mall.bounds = { minX: -maxX, maxX, minZ: 0, maxZ: CZ };

    // the corridor: a light floor on the baseplate, the end walls, planters and benches down the middle
    brick(0, 0, CZ / 2, maxX * 2, 0.08, CZ, 0xc4c6cc);
    for (const sx of [-1, 1]) brick(sx * maxX, WALL_H / 2, CZ / 2, WALL_T, WALL_H, CZ + WALL_T, PAL.grey);
    for (let px = -maxX + 4.5, k = 0; px < maxX - 3; px += (FW + GAP) / 2, k++) {
      if (Math.abs(px - doorX) < 2.5) continue;
      if (k % 2) { place('display-flowers', px, CZ / 2); Mall.solids.push({ minX: px - 0.55, maxX: px + 0.55, minZ: CZ / 2 - 0.55, maxZ: CZ / 2 + 0.55 }); }
      else bench(px, CZ / 2);
    }

    const fronts = [];
    neighbours.forEach((n, i) => { if (spots[i]) fronts.push(storefront(n, spots[i], fronts.length)); });
    for (let i = neighbours.length; i < spots.length; i++) blank(spots[i]);
    flushBricks();
    Mall.fronts = fronts;
    // where shoppers in the mall go: up and down the corridor, and up to the windows
    const wander = [];
    for (let i = 0; i < 14; i++) wander.push({ x: rnd(-maxX + 2, maxX - 2), z: rnd(1.2, CZ - 1.2) });
    for (const f of fronts) for (const o of [-2.6, 2.6]) wander.push({ x: f.dx + o, z: f.line + f.dir * 1.1, face: f.dir > 0 ? Math.PI : 0 });
    Mall.spot = () => pick(wander);
    Mall.ready = true;
    const crowd = []; for (let i = 0; i < 6; i++) crowd.push(makeNpc('mall'));
    wearMore(crowd);
  }

  function bench(x, z) {
    brick(x, 0.36, z, 1.8, 0.12, 0.6, PAL.brown);
    for (const o of [-0.7, 0.7]) brick(x + o, 0.15, z, 0.16, 0.3, 0.5, PAL.dark, { studs: false });
    Mall.solids.push({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.3, maxZ: z + 0.3 });
  }

  // a building's shell: the block and roof behind a storefront (in the front's group, so it hides with it)
  function shell(s, group, col) {
    const z = s.line - s.dir * (DEEP / 2 + WALL_T / 2);
    brick(s.cx, WALL_H / 2, z, FW + GAP, WALL_H, DEEP, PAL.grey, { group });
    brick(s.cx, WALL_H + 0.06, z, FW + GAP + 0.1, 0.12, DEEP + 0.1, col, { group });
  }
  function blank(s) {
    const g = 'blank:' + s.cx + ',' + s.line;
    brick(s.cx, WALL_H / 2, s.line, FW + GAP, WALL_H, WALL_T, PAL.white, { group: g });
    shell(s, g, PAL.dark);
    Mall.blanks = (Mall.blanks || []).concat({ group: groupOf(g), dir: s.dir });
  }

  function poster(cover) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 254;
    const x = c.getContext('2d'); x.fillStyle = '#15171a'; x.fillRect(0, 0, 320, 254);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1 * 254 / 320), new THREE.MeshBasicMaterial({ map: t }));
    m.userData.fill = img => { x.fillStyle = '#15171a'; x.fillRect(0, 0, 320, 254); const s = Math.max(312 / img.width, 246 / img.height); x.save(); x.beginPath(); x.rect(4, 4, 312, 246); x.clip(); x.drawImage(img, 160 - img.width * s / 2, 127 - img.height * s / 2, img.width * s, img.height * s); x.restore(); t.needsUpdate = true; };
    m.userData.cover = cover;
    return m;
  }

  function storefront(n, s, i) {
    const gname = 'front:' + n.user, g = groupOf(gname);
    const col = BRIGHT[hash(n.user) % BRIGHT.length];
    const x0 = s.cx - (FW + GAP) / 2, x1 = s.cx + (FW + GAP) / 2, dx = s.cx;
    // the front: a coloured base course, white wall either side of the doorway, coloured pillars, a header for the sign
    brick(s.cx, 0.19, s.line, FW + GAP, 0.38, WALL_T, col, { group: gname });
    brick((x0 + dx - DOOR_W / 2) / 2, 1.14, s.line, dx - DOOR_W / 2 - x0, 1.52, WALL_T, PAL.white, { group: gname });
    brick((dx + DOOR_W / 2 + x1) / 2, 1.14, s.line, x1 - dx - DOOR_W / 2, 1.52, WALL_T, PAL.white, { group: gname });
    brick(dx, 1.55, s.line, DOOR_W, 0.7, WALL_T, PAL.white, { group: gname });
    brick(s.cx, 2.2, s.line, FW + GAP, 0.6, WALL_T, col, { group: gname });
    for (const px of [x0 + 0.3, x1 - 0.3]) brick(px, 1.25, s.line + s.dir * 0.06, 0.6, 2.5, WALL_T + 0.12, col, { group: gname });
    shell(s, gname, col);
    const dr = place('wall-door-rotate', dx, s.line, s.dir > 0 ? Math.PI : 0, { scale: DOOR_W, parent: g });
    const face = s.line + s.dir * (WALL_T / 2 + 0.01);
    const posters = [];
    const its = n.items || [];
    [-2.75, -1.45, 1.45, 2.75].forEach((o, k) => {
      const it = its[k % Math.max(1, its.length)];
      const p = poster(it && it.cover); p.position.set(dx + o, 0.95, face); p.rotation.y = s.dir > 0 ? 0 : Math.PI;
      g.add(p); posters.push(p);
    });
    const sign = signBoard(n.user, 4.4); sign.position.set(dx, 2.2, s.line + s.dir * (WALL_T / 2 + 0.02)); sign.rotation.y = s.dir > 0 ? 0 : Math.PI; g.add(sign);
    let act = null;
    const clip = THREE.AnimationClip.findByName(models['wall-door-rotate'].animations, 'open');
    if (clip) { const mx = new THREE.AnimationMixer(dr); act = mx.clipAction(clip); act.play(); act.paused = true; act.mx = mx; act.dur = clip.duration; }
    const f = { i, user: n.user, name: n.user, count: 0, house: !!n.house, dir: s.dir, line: s.line, dx, dz: s.line + s.dir * 1.0,
      group: g, posters, sign, act, open: 0, state: 'new', its };
    g.traverse(o => { o.userData.front = i; });
    return f;
  }

  /* checking each storefront as you come near it: a live store gets its creator's name and covers; a gone one shutters */
  let busy = false;
  function check(f) {
    busy = true; f.state = 'checking';
    fetch('/api/itch-store?user=' + encodeURIComponent(f.user)).then(r => r.ok ? r.json() : null).then(d => {
      const list = d && (d.items || []).filter(x => x.type !== 'other');
      if (!list || !list.length) { shutter(f); return; }
      f.state = 'open'; f.name = d.name || f.user; f.count = list.length;
      const old = f.sign; f.sign = signBoard(f.name + '’s store', 4.4); f.sign.position.copy(old.position); f.sign.rotation.copy(old.rotation);
      f.sign.userData.front = f.i; f.group.remove(old); f.group.add(f.sign); old.material.map.dispose();
      const withCovers = list.filter(x => x.cover);
      if (withCovers.length) { f.its = withCovers.slice(0, 4); f.posters.forEach((p, k) => { p.userData.cover = f.its[k % f.its.length].cover; p.userData.done = false; }); }
    }).catch(() => { f.state = 'new'; }).finally(() => { busy = false; });
  }
  function shutter(f) {
    f.state = 'closed';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 1.4), new THREE.MeshPhongMaterial({ color: 0x3a3d44 }));
    m.position.set(f.dx, 0.7, f.line + f.dir * (WALL_T / 2 + 0.03)); m.rotation.y = f.dir > 0 ? 0 : Math.PI; f.group.add(m);
    for (const p of f.posters) p.visible = false;
    Mall.fronts = Mall.fronts.filter(x => x !== f);
    Mall.fronts.forEach((x, k) => { x.i = k; x.group.traverse(o => { o.userData.front = k; }); });
  }

  let pushT = 0;
  Mall.step = (now, dt, me) => {
    if (!Mall.ready) return;
    for (const f of Mall.fronts) {
      const d = Math.hypot(me.x - f.dx, me.z - f.dz);
      if (d < 18) for (const p of f.posters) if (p.userData.cover && !p.userData.done) { p.userData.done = true; loadImage(p.userData.cover).then(img => img && p.userData.fill(img)); }
      if (d < 10 && f.state === 'new' && !busy) check(f);
      if (f.act) { const want = d < 2 ? 1 : 0; f.open += (want - f.open) * Math.min(1, dt * 6); f.act.time = f.open * f.act.dur * 0.999; f.act.mx.update(0); }
    }
    // walking into an open door takes you in (on the site; inside an itch.io embed, use the bar's Go in)
    if (EMBED) return;
    const f = Mall.fronts.find(f => f.state === 'open' && Math.abs(me.x - f.dx) < 0.5 && Math.abs(me.z - (f.line + f.dir * (WALL_T / 2 + 0.31))) < 0.3);
    const toward = f && -Math.cos(me.rot) * f.dir > 0.6 && me.speed > 0.4;
    pushT = toward ? pushT + dt : 0;
    if (f && pushT > 0.3) { pushT = -99; Mall.enter(f); }
  };
  Mall.enter = f => {
    document.getElementById('veilTitle').textContent = 'Going into ' + f.name + '’s store';
    document.getElementById('veilText').textContent = 'Stocking the shelves from itch.io…';
    document.getElementById('prog').hidden = true;
    document.getElementById('veil').classList.remove('gone');
    location.href = Mall.storeUrl(f.user);
  };
  // storefronts between the camera and you step aside
  Mall.walls = (blocks, me) => {
    if (!Mall.ready) return;
    for (const f of Mall.fronts.concat(Mall.blanks || [])) f.group.visible = !(me.z > 0 && blocks(f.dir < 0 ? CZ : 0));
  };
};
