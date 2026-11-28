/* Grug · the mall outside a 3D store's front door (loaded by static/store/store.js once the store is standing).

   A corridor runs past the door with other creators' storefronts along both sides: the creator's name over the door,
   a few of their covers in the shop windows, and a building behind. Who's there comes from /api/mall (a pool of real
   itch.io creators from itch's own featured, top-rated and new lists, shuffled by this store's username and the day;
   Grug's own store, polysw, is always about five storefronts from the door). As you walk up to a storefront it's
   checked against /api/itch-store: a live one gets its creator's display name and project count, a gone one shutters.
   Walk through a door (or Go in on the bar) to go into that store. Inside an itch.io embed, other stores open in a
   new tab instead, so the creator's own page stays where it is. ?mall=0 leaves the mall out. */
window.GrugMall = function (G) {
  'use strict';
  const { THREE, scene, place, signBoard, loadImage, roundRect, fitText, FONT, Mall, USER, EMBED, cam, models } = G;
  if (new URLSearchParams(location.search).get('mall') === '0') return;
  const CZ = 6.4, FW = 7, GAP = 1, DEEP = 5;
  const W = G.bounds.maxX - G.bounds.minX;
  const doorX = G.doorX;

  fetch('/api/mall?user=' + encodeURIComponent(USER)).then(r => r.ok ? r.json() : null).then(d => { if (d && d.neighbours) build(d.neighbours); }).catch(() => {});

  function build(neighbours) {
    // the spots, nearest the door first: across the corridor, then along this side
    const spots = [];
    for (let i = -4; i <= 4; i++) spots.push({ cx: i * (FW + GAP), line: CZ, dir: -1 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) spots.push({ cx: s * (W / 2 + GAP + FW / 2 + i * (FW + GAP)), line: 0, dir: 1 });
    spots.sort((a, b) => Math.hypot(a.cx - doorX, a.line) - Math.hypot(b.cx - doorX, b.line));
    const maxX = W / 2 + GAP + 4 * (FW + GAP) - GAP + 0.5;
    Mall.bounds = { minX: -maxX, maxX, minZ: 0, maxZ: CZ };

    // the corridor floor, its base, and the end walls
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = '#8f93a0'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#80838f'; x.fillRect(0, 0, 128, 5); x.fillRect(0, 0, 5, 128);
    const ft = new THREE.CanvasTexture(c); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(maxX * 2, CZ); ft.encoding = THREE.sRGBEncoding; ft.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX * 2, CZ), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, CZ / 2); floor.receiveShadow = true; scene.add(floor);
    const base = new THREE.Mesh(new THREE.BoxGeometry(maxX * 2 + 0.6, 0.3, CZ + 2 * DEEP + 0.6), new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.9 }));
    base.position.set(0, -0.151, CZ / 2); base.receiveShadow = true; scene.add(base);
    for (const sx of [-1, 1]) for (let z = 0.5; z < CZ; z += 1) place('wall', sx * maxX, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    // planters down the middle
    for (let px = -maxX + 4; px < maxX - 2; px += FW + GAP) if (Math.abs(px - doorX) > 2) { place('display-flowers', px, CZ / 2); Mall.solids.push({ minX: px - 0.42, maxX: px + 0.42, minZ: CZ / 2 - 0.42, maxZ: CZ / 2 + 0.42 }); }

    const fronts = [];
    neighbours.forEach((n, i) => { if (spots[i]) fronts.push(storefront(n, spots[i], fronts.length)); });
    // the spots nobody took get a plain wall and building
    for (let i = neighbours.length; i < spots.length; i++) blank(spots[i]);
    // across the corridor past the last spots, and along this side between the store and its neighbours
    Mall.fronts = fronts;
    Mall.ready = true;
    queue = fronts.slice();
  }

  const bldMat = new THREE.MeshStandardMaterial({ color: 0x3a3e47, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x30333b, roughness: 0.95 });
  function shell(s, group) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(FW + GAP, 1.04, DEEP), [bldMat, bldMat, roofMat, bldMat, bldMat, bldMat]);
    b.position.set(s.cx, 0.52, s.line - s.dir * (DEEP / 2 + 0.3)); b.receiveShadow = true; group.add(b);
  }
  function blank(s) {
    const g = new THREE.Group(); scene.add(g);
    for (let k = 0; k < FW + GAP; k++) place('wall', s.cx - (FW + GAP) / 2 + 0.5 + k, s.line, s.dir > 0 ? Math.PI : 0, { parent: g });
    shell(s, g);
    Mall.blanks = (Mall.blanks || []).concat({ group: g, dir: s.dir });
  }

  function poster(item, w) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 254;
    const x = c.getContext('2d'); x.fillStyle = '#15171a'; x.fillRect(0, 0, 320, 254);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 254 / 320), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.userData.fill = img => { x.fillStyle = '#15171a'; x.fillRect(0, 0, 320, 254); const s = Math.max(312 / img.width, 246 / img.height); x.save(); x.beginPath(); x.rect(4, 4, 312, 246); x.clip(); x.drawImage(img, 160 - img.width * s / 2, 127 - img.height * s / 2, img.width * s, img.height * s); x.restore(); t.needsUpdate = true; };
    if (item && item.cover) m.userData.cover = item.cover;
    return m;
  }

  function storefront(n, s, i) {
    const g = new THREE.Group(); scene.add(g);
    const rot = s.dir > 0 ? Math.PI : 0;
    const x0 = s.cx - (FW + GAP) / 2 + 0.5;
    let doorObj = null;
    for (let k = 0; k < FW + GAP; k++) {
      const wx = x0 + k, isDoor = Math.abs(wx - s.cx) < 0.01 || (Math.abs(wx - s.cx - 0.5) < 0.01 && (FW + GAP) % 2 === 0);
      const o = place(isDoor && !doorObj ? 'wall-door-rotate' : (k % 3 === 2 ? 'wall-window' : 'wall'), wx, s.line, rot, { parent: g });
      if (isDoor && !doorObj) { doorObj = o; s.doorX = wx; }
    }
    shell(s, g);
    const face = s.line + s.dir * 0.32;
    // three covers in the windows either side of the door
    const posters = [];
    const spotsX = [-2.6, -1.55, 1.55, 2.6].map(v => s.doorX + v).slice(0, 4);
    const its = n.items || [];
    spotsX.forEach((px, k) => {
      const it = its[k % Math.max(1, its.length)];
      const p = poster(it, 0.86); p.position.set(px, 0.5, face + s.dir * 0.004); p.rotation.y = rot === Math.PI ? 0 : Math.PI;
      g.add(p); posters.push(p);
    });
    const sign = signBoard(n.user, 3.4); sign.position.set(s.doorX, 1.3, face + s.dir * 0.01); sign.rotation.y = rot === Math.PI ? 0 : Math.PI; g.add(sign);
    g.traverse(o => { o.userData.front = i; });
    let act = null;
    if (doorObj) {
      const clip = THREE.AnimationClip.findByName(models['wall-door-rotate'].animations, 'open');
      if (clip) { const mx = new THREE.AnimationMixer(doorObj); act = mx.clipAction(clip); act.play(); act.paused = true; act.mx = mx; act.dur = clip.duration; }
    }
    return { i, user: n.user, name: n.user, count: 0, house: !!n.house, dir: s.dir, line: s.line, dx: s.doorX, dz: s.line + s.dir * 0.85,
      group: g, posters, sign, act, open: 0, state: 'new', its };
  }

  /* checking each storefront as you come near it: a live store gets its creator's name and its covers; a gone one shutters */
  let queue = [], busy = false;
  function check(f) {
    busy = true; f.state = 'checking';
    fetch('/api/itch-store?user=' + encodeURIComponent(f.user)).then(r => r.ok ? r.json() : null).then(d => {
      const list = d && (d.items || []).filter(x => x.type !== 'other');
      if (!list || !list.length) { shutter(f); return; }
      f.state = 'open'; f.name = d.name || f.user; f.count = list.length;
      const old = f.sign; f.sign = signBoard(f.name + '’s store', 3.4); f.sign.position.copy(old.position); f.sign.rotation.copy(old.rotation);
      f.sign.userData.front = f.i; f.group.remove(old); f.group.add(f.sign); old.material.map.dispose();
      if (list.some(x => x.cover)) { f.its = list.filter(x => x.cover).slice(0, 4); f.posters.forEach((p, k) => { p.userData.cover = f.its[k % f.its.length].cover; p.userData.done = false; }); }
    }).catch(() => { f.state = 'new'; }).finally(() => { busy = false; });
  }
  function shutter(f) {
    f.state = 'closed';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x23252b }));
    m.position.set(f.dx, 0.46, f.line + f.dir * 0.33); m.rotation.y = f.dir > 0 ? 0 : Math.PI; f.group.add(m);
    for (const p of f.posters) p.visible = false;
    Mall.fronts = Mall.fronts.filter(x => x !== f);
    Mall.fronts.forEach((x, k) => { x.i = k; x.group.traverse(o => { o.userData.front = k; }); });
  }

  let pushT = 0;
  Mall.step = (now, dt, me) => {
    if (!Mall.ready) return;
    for (const f of Mall.fronts) {
      const d = Math.hypot(me.x - f.dx, me.z - f.dz);
      // covers load as you get near; the store gets checked a little nearer
      if (d < 16) for (const p of f.posters) if (p.userData.cover && !p.userData.done) { p.userData.done = true; loadImage(p.userData.cover).then(img => img && p.userData.fill(img)); }
      if (d < 9 && f.state === 'new' && !busy) check(f);
      if (f.act) { const want = d < 1.7 ? 1 : 0; f.open += (want - f.open) * Math.min(1, dt * 6); f.act.time = f.open * f.act.dur * 0.999; f.act.mx.update(0); }
    }
    // walking into an open door takes you in (on the site; inside an itch.io embed, use the bar's Go in)
    if (EMBED) return;
    const f = Mall.fronts.find(f => f.state === 'open' && Math.abs(me.x - f.dx) < 0.4 && Math.abs(me.z - (f.line + f.dir * 0.62)) < 0.32);
    const toward = f && -Math.cos(me.rot) * f.dir > 0.6 && me.speed > 0.4;
    pushT = toward ? pushT + dt : 0;
    if (f && pushT > 0.3) { pushT = -99; Mall.enter(f); }
  };
  Mall.enter = f => {
    const v = document.getElementById('veil');
    document.getElementById('veilTitle').textContent = 'Going into ' + f.name + '’s store';
    document.getElementById('veilText').textContent = 'Stocking the shelves from itch.io…';
    v.classList.remove('gone');
    location.href = Mall.storeUrl(f.user);
  };
  // storefronts between the camera and you step aside
  Mall.walls = (blocks, me) => {
    if (!Mall.ready) return;
    for (const f of Mall.fronts.concat(Mall.blanks || [])) f.group.visible = !(me.z > 0 && blocks(f.dir < 0 ? CZ : 0));
  };
};
