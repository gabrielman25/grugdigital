/* Ambient NPCs (the "ambient-npc" library from the Ambient NPC Zoo, supplied by Grug Digital, Nov 2026), unchanged.
   Brains decide what an NPC does; hands (Ambient.Remix) replay recordings of a real person's keys, camera turns, cursor and
   scroll. vids/ drives a real Grug game with the hands (see vids/index.html). */
/* =====================================================================
   Ambient NPCs  ·  general-purpose wandering "players" for any game
   ---------------------------------------------------------------------
   No renderer in here: plug it into three.js, Babylon, a canvas, a
   server... Everything is in studs and seconds (1 stud ≈ 0.28 m), with
   the physics of a classic Roblox R6 Humanoid on a fresh Baseplate.

   What a host game provides:
     · a World of axis-aligned boxes (or wrap your own collision behind
       World.query / World.raycast)
     · optional points of interest, seats, jump pads, an elevator...
     · a renderer that reads each NPC's state (position, facing, pose,
       chat line, camera, cursor) once a frame

   Quick start
     const world = new Ambient.World();
     world.add({ minX:-256, maxX:256, minY:-20, maxY:0, minZ:-256, maxZ:256 });   // a baseplate
     const nav   = new Ambient.Nav(world, { minX:-100, maxX:100, minZ:-100, maxZ:100 });
     const crowd = new Ambient.Crowd(world, nav, { spawn: { x: 0, y: 1, z: 0 } });
     crowd.setCount(30);
     // every frame:
     crowd.update(dt, [player]);      // other characters the NPCs can see/bump
     for (const n of crowd.npcs) draw(n.ch.x, n.ch.y, n.ch.z, n.ch.faceYaw, n.pose());

   How they feel like players: the brain only decides WHAT to do (wander,
   explore, hang out with people, follow someone, sit, dance, go AFK, try
   the obby...). HOW they press keys, turn the camera, zoom and move the
   cursor is remixed from recordings of a real person (Ambient.Remix),
   see the "hands" section. Demos recorded in Realm Delve or in the zoo
   use the same format.
   ===================================================================== */
(function (root) {
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const wpick = (pairs) => { let t = 0; for (const p of pairs) t += Math.max(0, p[1]); if (t <= 0) return null; let r = Math.random() * t; for (const p of pairs) { r -= Math.max(0, p[1]); if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };

// ---------------------------------------------------------------- settings shared by every character (Humanoid + Workspace)
const CFG = {
  gravity: 196.2, walkSpeed: 16, jumpHeight: 7.2, accel: 40, stepRise: 40, snapDown: 0.35, jumpCooldown: 0,
  fallenPartsHeight: -200, sitCooldown: 1.0, collide: true,
};
// R6, measured from the HumanoidRootPart (torso centre): legs 2, torso 2, head ~1.2
const BODY = { rootToFeet: 3, rootToTorsoBottom: 1, rootToHeadTop: 2.2, radius: 1, floorRadius: 0.8 };

// ---------------------------------------------------------------- the world: axis-aligned parts + a broadphase grid
// part: { minX,maxX,minY,maxY,minZ,maxZ, kind: 'solid'|'kill'|'pad'|'seat'|'button', canCollide (default true),
//         nav (default true), dynamic (moves: give vx, vy, vz), power (pads), name, data }
class World {
  constructor(o = {}) { this.cell = o.cell || 16; this.grid = new Map(); this.parts = []; this.dyn = []; this.stamp = 1; this.version = 0; this.big = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(p) {
    p.id = this.parts.length + 1; if (p.canCollide === undefined) p.canCollide = true; p.kind = p.kind || 'solid';
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.vz = p.vz || 0; p._s = 0;
    this.parts.push(p);
    if (p.dynamic) this.dyn.push(p);
    else if ((p.maxX - p.minX) * (p.maxZ - p.minZ) > this.cell * this.cell * 64) this.big.push(p);   // baseplates etc.
    else this.index(p);
    this.version++; return p;
  }
  index(p) {
    const c = this.cell;
    for (let i = Math.floor(p.minX / c); i <= Math.floor(p.maxX / c); i++) for (let j = Math.floor(p.minZ / c); j <= Math.floor(p.maxZ / c); j++) {
      const k = this.key(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(p);
    }
  }
  remove(p) {
    this.parts = this.parts.filter(x => x !== p); this.dyn = this.dyn.filter(x => x !== p); this.big = this.big.filter(x => x !== p);
    for (const a of this.grid.values()) { const i = a.indexOf(p); if (i >= 0) a.splice(i, 1); }
    this.version++;
  }
  // parts whose XZ footprint touches the rectangle
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0; const s = ++this.stamp, c = this.cell;
    const take = p => { if (p._s !== s && p.maxX >= minX && p.minX <= maxX && p.maxZ >= minZ && p.minZ <= maxZ) { p._s = s; out.push(p); } };
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) { const a = this.grid.get(this.key(i, j)); if (a) for (const p of a) take(p); }
    for (const p of this.big) take(p); for (const p of this.dyn) take(p);
    return out;
  }
  // first part hit by a ray (slab test); filter(part) can skip parts
  raycast(ox, oy, oz, dx, dy, dz, maxT, filter) {
    let best = maxT, hit = null;
    const minX = Math.min(ox, ox + dx * maxT), maxX = Math.max(ox, ox + dx * maxT), minZ = Math.min(oz, oz + dz * maxT), maxZ = Math.max(oz, oz + dz * maxT);
    for (const p of this.query(minX, minZ, maxX, maxZ, this._rq || (this._rq = []))) {
      if (!p.canCollide || (filter && !filter(p))) continue;
      let t0 = 0, t1 = best; const o = [ox, oy, oz], d = [dx, dy, dz], mn = [p.minX, p.minY, p.minZ], mx = [p.maxX, p.maxY, p.maxZ]; let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) { ok = false; break; } continue; }
        let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i]; if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) { best = t0; hit = p; }
    }
    return { t: best, part: hit };
  }
  // move the dynamic parts (elevators, platforms); call once a frame before stepping characters
  moveDynamic(dt) { for (const p of this.dyn) { if (!p.vx && !p.vy && !p.vz) continue; p.minX += p.vx * dt; p.maxX += p.vx * dt; p.minY += p.vy * dt; p.maxY += p.vy * dt; p.minZ += p.vz * dt; p.maxZ += p.vz * dt; } }
}

// ---------------------------------------------------------------- characters
function makeCharacter(x, y, z, o = {}) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false, rising: false, cd: 0, faceYaw: o.yaw || 0, ground: null, sit: null, sitCd: 0,
    dead: false, deadT: 0, spawn: { x, y, z }, padT: 0, lastJumpT: -9, input: { mx: 0, mz: 0, jump: false }, lockYaw: null, near: [], id: o.id || 0, events: [] };
}
function respawn(ch, at) {
  const s = at || ch.spawn;
  Object.assign(ch, { x: s.x + rnd(-3, 3), y: s.y, z: s.z + rnd(-3, 3), vx: 0, vy: 0, vz: 0, grounded: false, rising: false, sit: null, dead: false, deadT: 0, ground: null });
  ch.events.push('respawn');
}
function jumpVelocity() { return Math.sqrt(2 * CFG.gravity * CFG.jumpHeight); }
function circleOverlapsBox(cx, cz, r, b) { const dx = cx - clamp(cx, b.minX, b.maxX), dz = cz - clamp(cz, b.minZ, b.maxZ); return dx * dx + dz * dz < r * r; }

// one fixed step (Roblox steps at 240 Hz). input: { mx, mz } world move direction (length ≤ 1), jump (held)
function stepCharacter(ch, world, dt, near) {
  if (ch.dead) { ch.deadT -= dt; if (ch.deadT <= 0) respawn(ch); return; }
  const input = ch.input, prevY = ch.y;
  ch.sitCd -= dt; ch.padT -= dt;
  // ---- sitting: glued to the seat until you jump
  if (ch.sit) {
    const s = ch.sit;
    ch.x = (s.minX + s.maxX) / 2; ch.z = (s.minZ + s.maxZ) / 2; ch.y = s.maxY + 1.0; ch.vx = ch.vz = ch.vy = 0; ch.grounded = true;
    if (s.data && s.data.yaw !== undefined) ch.faceYaw = s.data.yaw;
    if (input.jump) { s.occupant = null; ch.sit = null; ch.sitCd = CFG.sitCooldown; ch.vy = jumpVelocity(); ch.grounded = false; ch.events.push('unsit'); }
    return;
  }
  // ---- horizontal velocity snaps toward MoveDirection * WalkSpeed (same on the ground and in the air)
  let mx = input.mx || 0, mz = input.mz || 0;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const ws = CFG.walkSpeed * (ch.speedMul || 1);
  const k = 1 - Math.exp(-CFG.accel * dt);
  ch.vx += (mx * ws - ch.vx) * k; ch.vz += (mz * ws - ch.vz) * k;
  if (ch.cd > 0) ch.cd -= dt;
  // AutoRotate: the body turns toward where it walks (or with the camera in shift lock / first person)
  if (ch.lockYaw !== null) ch.faceYaw = ch.lockYaw;
  else if (ml > 0.01) ch.faceYaw += angDiff(ch.faceYaw, Math.atan2(-mx, -mz)) * (1 - Math.exp(-18 * dt));
  // ---- jump
  if (ch.grounded && input.jump && ch.cd <= 0 && !ch.rising) { ch.vy = jumpVelocity(); ch.grounded = false; ch.lastJumpT = performance.now(); ch.jump = { startY: ch.y - 3, peak: ch.y - 3, t: 0, sx: ch.x, sz: ch.z }; ch.events.push('jump'); }
  // ---- carried by a moving platform
  if (ch.grounded && ch.ground && ch.ground.dynamic) { ch.x += ch.ground.vx * dt; ch.z += ch.ground.vz * dt; }
  // ---- horizontal move + walls (torso and head only, like R6)
  ch.x += ch.vx * dt; ch.z += ch.vz * dt;
  const R = BODY.radius, lo = ch.y - BODY.rootToTorsoBottom + 0.01, hi = ch.y + BODY.rootToHeadTop - 0.01;
  for (let it = 0; it < 3; it++) {
    let hit = false;
    for (const b of near) {
      if (!b.canCollide || b.maxY <= lo || b.minY >= hi) continue;
      const px = clamp(ch.x, b.minX, b.maxX), pz = clamp(ch.z, b.minZ, b.maxZ);
      const dx = ch.x - px, dz = ch.z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (b.kind === 'kill') { kill(ch); return; }
      hit = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        ch.x += nx * (R - d); ch.z += nz * (R - d);
        const vn = ch.vx * nx + ch.vz * nz; if (vn < 0) { ch.vx -= vn * nx; ch.vz -= vn * nz; }
      } else {
        const l = ch.x - b.minX, r = b.maxX - ch.x, n = ch.z - b.minZ, f = b.maxZ - ch.z, m = Math.min(l, r, n, f);
        if (m === l) { ch.x = b.minX - R; ch.vx = Math.min(ch.vx, 0); } else if (m === r) { ch.x = b.maxX + R; ch.vx = Math.max(ch.vx, 0); }
        else if (m === n) { ch.z = b.minZ - R; ch.vz = Math.min(ch.vz, 0); } else { ch.z = b.maxZ + R; ch.vz = Math.max(ch.vz, 0); }
      }
    }
    if (!hit) break;
  }
  // ---- vertical (exact for constant gravity, so the peak lands on JumpHeight exactly)
  if (!ch.grounded) { ch.y += ch.vy * dt - 0.5 * CFG.gravity * dt * dt; ch.vy -= CFG.gravity * dt; }
  // ---- ceiling (head bonk)
  if (ch.vy > 0) {
    const prevTop = prevY + BODY.rootToHeadTop, top = ch.y + BODY.rootToHeadTop; let ceil = Infinity;
    for (const b of near) if (b.canCollide && b.minY >= prevTop - 0.01 && b.minY < top && b.minY < ceil && circleOverlapsBox(ch.x, ch.z, R * 0.9, b)) ceil = b.minY;
    if (ceil !== Infinity) { ch.y = ceil - BODY.rootToHeadTop; ch.vy = 0; }
  }
  // ---- floor sensor: highest surface under the body at or below the torso bottom
  const lim = Math.max(ch.y, prevY) - BODY.rootToTorsoBottom + 0.01;
  let floor = -Infinity, fp = null;
  for (const b of near) if (b.canCollide && b.maxY <= lim && b.maxY > floor && circleOverlapsBox(ch.x, ch.z, BODY.floorRadius, b)) { floor = b.maxY; fp = b; }
  const feet = ch.y - BODY.rootToFeet, prevFeet = prevY - BODY.rootToFeet;
  if (ch.jump) { ch.jump.t += dt; if (feet > ch.jump.peak) ch.jump.peak = feet; }
  if (ch.grounded) {
    ch.rising = false;
    if (floor === -Infinity) { ch.grounded = false; ch.ground = null; }
    else {
      const gap = feet - floor; ch.rising = gap < -0.05; ch.ground = fp;
      if (gap < 0) ch.y += Math.min(-gap, CFG.stepRise * dt);
      else if (gap <= CFG.snapDown + (fp.dynamic ? Math.abs(fp.vy) * dt * 2 : 0)) ch.y = floor + BODY.rootToFeet;
      else { ch.grounded = false; ch.ground = null; }
    }
  } else if (floor !== -Infinity && ch.vy <= 0 && feet <= floor) {
    if (prevFeet >= floor - 0.01 - (fp.dynamic ? Math.abs(fp.vy) * dt * 2 : 0)) ch.y = floor + BODY.rootToFeet;
    ch.grounded = true; ch.rising = ch.y - BODY.rootToFeet < floor - 0.05; ch.ground = fp;
    const impact = ch.vy; ch.vy = 0; ch.cd = CFG.jumpCooldown; ch.events.push(impact < -60 ? 'landHard' : 'land');
    if (ch.jump) { ch.last = { height: ch.jump.peak - ch.jump.startY, air: ch.jump.t, dist: Math.hypot(ch.x - ch.jump.sx, ch.z - ch.jump.sz) }; ch.jump = null; }
  }
  // ---- what you stand on does things
  if (ch.grounded && fp) {
    if (fp.kind === 'kill') { kill(ch); return; }
    if (fp.kind === 'pad' && ch.padT <= 0) { ch.vy = fp.power || 120; ch.grounded = false; ch.ground = null; ch.padT = 0.4; ch.events.push('pad'); }
    if (fp.kind === 'seat' && ch.sitCd <= 0 && !fp.occupant && ch.wantSit !== false) { ch.sit = fp; fp.occupant = ch; ch.events.push('sit'); }
    if (fp.kind === 'button') fp.pressedBy = ch;
  }
  if (ch.y - BODY.rootToFeet < CFG.fallenPartsHeight) kill(ch);
}
function kill(ch) { if (ch.dead) return; if (ch.sit) { ch.sit.occupant = null; ch.sit = null; } ch.dead = true; ch.deadT = 3; ch.vx = ch.vy = ch.vz = 0; ch.events.push('died'); }

// step a list of characters at a fixed rate; returns the number of substeps run
function stepAll(chars, world, dt, rate = 240) {
  const h = 1 / rate; let acc = (stepAll._acc || 0) + dt, n = 0;
  // broadphase once per frame, generously sized for this frame's motion
  const reach = 6 + 60 * Math.min(dt, 0.1);
  for (const ch of chars) ch.near = world.query(ch.x - reach, ch.z - reach, ch.x + reach, ch.z + reach, ch.near || []).slice();
  while (acc >= h && n < 40) {
    world.moveDynamic(h);
    for (const ch of chars) { const sx = ch.x, sy = ch.y, sz = ch.z; stepCharacter(ch, world, h, ch.near); ch.px = sx; ch.py = sy; ch.pz = sz; }
    acc -= h; n++;
  }
  stepAll._acc = Math.min(acc, h);
  // players bump into each other (R6 torsos are 2 studs wide)
  if (CFG.collide) separate(chars);
  for (const ch of chars) if (ch.sit && ch.sit.occupant !== ch) ch.sit.occupant = ch;
  return n;
}
function separate(chars) {
  const cell = 4, m = new Map(), K = (i, j) => i * 92821 ^ j;
  for (const c of chars) { if (c.dead || c.sit) continue; const k = K(Math.floor(c.x / cell), Math.floor(c.z / cell)); let a = m.get(k); if (!a) m.set(k, a = []); a.push(c); }
  for (const c of chars) {
    if (c.dead || c.sit) continue;
    const i0 = Math.floor(c.x / cell), j0 = Math.floor(c.z / cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const a = m.get(K(i, j)); if (!a) continue;
      for (const o of a) {
        if (o === c || o.id < c.id || Math.abs(o.y - c.y) > 5) continue;
        const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.9 && d > 1e-4) { const p = (1.9 - d) / 2, nx = dx / d, nz = dz / d; c.x += nx * p; c.z += nz * p; o.x -= nx * p; o.z -= nz * p; }
      }
    }
  }
}

root.AmbientCore = { clamp, rnd, rndi, pick, angDiff, wpick, CFG, BODY, World, makeCharacter, respawn, jumpVelocity, stepCharacter, stepAll, kill };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------------------------------------------------------------------
   Nav: where an R6 body can stand, and how to get there.
   A grid (2 studs) over the area you give it. Every cell keeps the tops
   it could stand on (several when things are stacked: the ground under a
   bridge and the bridge itself), each with 5.4 studs of headroom.
   Moves between neighbouring cells:
     walk    up or down by less than 2 studs (R6 legs step up that much)
     jump    up 2 to 6 studs (JumpHeight 7.2 minus a little)
     drop    down any distance up to 40
     gap     a jump across 4–8 studs of nothing (or of kill bricks) to a
             top no more than 2.5 higher: this is what gets them over obbies
   Kill bricks are never stood on. Moving parts are left out (elevators and
   platforms are ridden by the brain on purpose, not walked through).
   --------------------------------------------------------------------- */
(function (root) {
'use strict';
const { clamp } = root.AmbientCore;

class Heap {
  constructor() { this.a = []; this.p = []; }
  get size() { return this.a.length; }
  push(v, pr) { const a = this.a, p = this.p; a.push(v); p.push(pr); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (p[j] <= pr) break; a[i] = a[j]; p[i] = p[j]; i = j; } a[i] = v; p[i] = pr; }
  pop() {
    const a = this.a, p = this.p, top = a[0], lv = a.pop(), lp = p.pop(); const n = a.length;
    if (n) { let i = 0; while (true) { let l = 2 * i + 1, r = l + 1, m = i; let mp = lp; if (l < n && p[l] < mp) { m = l; mp = p[l]; } if (r < n && p[r] < mp) { m = r; mp = p[r]; } if (m === i) break; a[i] = a[m]; p[i] = p[m]; i = m; } a[i] = lv; p[i] = lp; }
    return top;
  }
}

class Nav {
  constructor(world, o = {}) {
    this.world = world; this.cs = o.cell || 2; this.L = o.layers || 4; this.head = o.headroom || 5.4;
    this.minX = o.minX; this.minZ = o.minZ; this.W = Math.ceil((o.maxX - o.minX) / this.cs); this.H = Math.ceil((o.maxZ - o.minZ) / this.cs);
    this.build();
  }
  build() {
    const W = this.W, H = this.H, L = this.L, cs = this.cs, w = this.world;
    this.h = new Float32Array(W * H * L).fill(NaN); this.n = new Uint8Array(W * H); this.kill = new Uint8Array(W * H * L); this.wall = new Uint8Array(W * H * L);
    const buf = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const cx = this.minX + (i + 0.5) * cs, cz = this.minZ + (j + 0.5) * cs;
      const ps = w.query(cx - 0.01, cz - 0.01, cx + 0.01, cz + 0.01, buf).filter(p => p.canCollide && !p.dynamic);
      const hd = w.query(cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4, []).filter(p => p.canCollide && !p.dynamic);   // headroom: anything over the middle of the cell
      const tops = [];
      for (const p of ps) {
        if (p.nav === false || p.minX > cx || p.maxX < cx || p.minZ > cz || p.maxZ < cz) continue;
        const t = p.maxY;
        if (hd.some(q => q !== p && q.minX < cx + 0.4 && q.maxX > cx - 0.4 && q.minZ < cz + 0.4 && q.maxZ > cz - 0.4 && q.minY < t + this.head && q.maxY > t + 0.05)) continue;
        const ex = tops.find(x => Math.abs(x.h - t) < 0.3); if (ex) { ex.kill = ex.kill && p.kind === 'kill'; continue; }
        tops.push({ h: t, kill: p.kind === 'kill' });
      }
      tops.sort((a, b) => a.h - b.h);
      const k = j * W + i; this.n[k] = Math.min(L, tops.length);
      for (let l = 0; l < this.n[k]; l++) { this.h[k * L + l] = tops[l].h; this.kill[k * L + l] = tops[l].kill ? 1 : 0; }
    }
    // walls between neighbouring cells: anything in the torso/head band (2 to 5.2 studs over the feet) along the step
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < W * H; k++) for (let l = 0; l < this.n[k]; l++) {
      const node = k * L + l, h = this.h[node], [x0, z0] = this.center(k); let bits = 0;
      for (let d = 0; d < 4; d++) {
        const x1 = x0 + D4[d][0] * cs, z1 = z0 + D4[d][1] * cs, m = 0.45;
        const qs = w.query(Math.min(x0, x1) - m, Math.min(z0, z1) - m, Math.max(x0, x1) + m, Math.max(z0, z1) + m, buf);
        for (const p of qs) {
          if (!p.canCollide || p.dynamic || p.maxY <= h + 2.0 || p.minY >= h + 5.2) continue;
          if (p.maxX + m > Math.min(x0, x1) && p.minX - m < Math.max(x0, x1) && p.maxZ + m > Math.min(z0, z1) && p.minZ - m < Math.max(z0, z1)) {
            // the part in this cell itself is what we stand on, not a wall
            if (p.minX <= x0 && p.maxX >= x0 && p.minZ <= z0 && p.maxZ >= z0 && Math.abs(p.maxY - h) < 0.3) continue;
            bits |= 1 << d; break;
          }
        }
      }
      this.wall[node] = bits;
    }
    this.version = w.version;
  }
  // everything you can walk/jump/drop to from a starting point (e.g. the spawn); goals elsewhere are skipped quickly
  computeReach(x, feetY, z) {
    const N = this.W * this.H * this.L, R = this.reach = new Uint8Array(N), s = this.nearestNode(x, feetY, z); if (s < 0) { this.reach = null; return; }
    const q = [s], E = []; R[s] = 1;
    while (q.length) { const n = q.pop(); for (const [m] of this.edges(n, E)) if (!R[m]) { R[m] = 1; q.push(m); } }
  }
  reachable(x, feetY, z) { if (!this.reach) return true; const n = this.nodeAt(x, feetY, z); return n >= 0 && this.reach[n] === 1; }
  inside(x, z) { return x >= this.minX && z >= this.minZ && x < this.minX + this.W * this.cs && z < this.minZ + this.H * this.cs; }
  cellOf(x, z) { return [Math.floor((x - this.minX) / this.cs), Math.floor((z - this.minZ) / this.cs)]; }
  center(k) { const i = k % this.W, j = (k / this.W) | 0; return [this.minX + (i + 0.5) * this.cs, this.minZ + (j + 0.5) * this.cs]; }
  // the surface (node id = cell*L + layer) under a foot height
  nodeAt(x, feetY, z) {
    const [i, j] = this.cellOf(x, z); if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    const k = j * this.W + i, L = this.L; let best = -1, bd = 1e9;
    for (let l = 0; l < this.n[k]; l++) { const h = this.h[k * L + l]; if (this.kill[k * L + l]) continue; const d = feetY + 0.6 - h; if (d >= -1.2 && d < bd) { bd = d; best = k * L + l; } }
    if (best < 0) for (let l = 0; l < this.n[k]; l++) if (!this.kill[k * L + l]) { const d = Math.abs(this.h[k * L + l] - feetY); if (d < bd) { bd = d; best = k * L + l; } }
    return best;
  }
  nearestNode(x, feetY, z, r = 4) {
    let n = this.nodeAt(x, feetY, z); if (n >= 0) return n;
    const [i0, j0] = this.cellOf(x, z);
    for (let rr = 1; rr <= r; rr++) for (let j = j0 - rr; j <= j0 + rr; j++) for (let i = i0 - rr; i <= i0 + rr; i++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== rr || i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
      const c = this.center(j * this.W + i); n = this.nodeAt(c[0], feetY, c[1]); if (n >= 0) return n;
    }
    return -1;
  }
  hOf(node) { return this.h[node]; }
  pos(node) { const k = (node / this.L) | 0, c = this.center(k); return { x: c[0], y: this.h[node], z: c[1] }; }
  // the surface in cell (i,j) reachable from height h by a given kind of move
  layerNear(i, j, h, lo, hi) {
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    const k = j * this.W + i, L = this.L; let best = -1, bd = 1e9;
    for (let l = 0; l < this.n[k]; l++) { const t = this.h[k * L + l], d = t - h; if (d < lo || d > hi) continue; const s = Math.abs(d); if (s < bd) { bd = s; best = k * L + l; } }
    return best;
  }
  blocked(i, j, h) { return this.layerNear(i, j, h, -1.9, 1.9) < 0; }
  // neighbours of a node: [node, cost, kind]
  edges(node, out) {
    out.length = 0;
    const L = this.L, k = (node / L) | 0, i = k % this.W, j = (k / this.W) | 0, h = this.h[node];
    const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let near = 0; for (let d = 0; d < 4; d++) if (this.blocked(i + D8[d][0], j + D8[d][1], h)) near++;
    const wall = near * 0.7;   // keep off walls and edges
    const wb = this.wall[node], dirBit = (di, dj) => di > 0 ? 1 : di < 0 ? 2 : dj > 0 ? 4 : 8;
    for (let d = 0; d < 8; d++) {
      const di = D8[d][0], dj = D8[d][1], diag = di && dj, base = diag ? 1.414 : 1;
      if (diag && (this.blocked(i + di, j, h) || this.blocked(i, j + dj, h) || (wb & dirBit(di, 0)) || (wb & dirBit(0, dj)))) continue;
      let n = this.layerNear(i + di, j + dj, h, -1.9, 1.9);
      if (n >= 0 && !this.kill[n] && (diag || !(wb & dirBit(di, dj)))) { out.push([n, base + wall, 0]); continue; }
      if (diag) continue;
      n = this.layerNear(i + di, j + dj, h, 1.9, 6.0);
      if (n >= 0 && !this.kill[n]) out.push([n, base + 3 + wall, 1]);
      const dn = this.layerNear(i + di, j + dj, h, -40, -1.9);
      if (dn >= 0 && !this.kill[dn]) out.push([dn, base + 1.5 + (h - this.h[dn]) * 0.04, 2]);
      // a gap (nothing, a pit or kill bricks): jump across to a landing 2–4 cells away
      const gapHere = this.layerNear(i + di, j + dj, h, -1.9, 6.0) < 0 || this.kill[this.layerNear(i + di, j + dj, h, -1.9, 1.9)] === 1;
      if (gapHere) for (let s = 2; s <= 4; s++) {
        const g = this.layerNear(i + di * s, j + dj * s, h, -4, 2.5);
        if (g >= 0) { if (!this.kill[g]) out.push([g, base * s + 4, 3]); break; }
      }
    }
    return out;
  }
  // A* from a foot position to another; returns [{x,y,z,kind}] (kind of the move INTO that point) or null
  path(fx, fy, fz, tx, ty, tz, maxNodes = 30000, minH = -1e9) {
    const a = this.nearestNode(fx, fy, fz), b = this.nearestNode(tx, ty, tz); if (a < 0 || b < 0) return null;
    if (a === b) return [Object.assign(this.pos(b), { kind: 0 })];
    if (this.reach && this.reach[a] && !this.reach[b]) return null;   // can't get there from here
    const N = this.W * this.H * this.L;
    if (!this.g || this.g.length !== N) { this.g = new Float32Array(N); this.from = new Int32Array(N); this.kind = new Uint8Array(N); this.seen = new Uint32Array(N); this.gen = 0; }
    const gen = ++this.gen, g = this.g, from = this.from, seen = this.seen, kind = this.kind;
    const bp = this.pos(b), heur = (n) => { const p = this.pos(n); return Math.hypot(p.x - bp.x, p.z - bp.z) / this.cs * 1.05; };
    const open = new Heap(); g[a] = 0; from[a] = -1; seen[a] = gen; open.push(a, heur(a));
    const E = []; let expanded = 0, best = a, bh = heur(a);
    while (open.size) {
      const n = open.pop(); if (n === b) { best = b; break; }
      if (++expanded > maxNodes) break;
      const hn = heur(n); if (hn < bh) { bh = hn; best = n; }
      for (const [m, c, kd] of this.edges(n, E)) {
        if (this.h[m] < minH) continue;
        const ng = g[n] + c;
        if (seen[m] === gen && g[m] <= ng) continue;
        seen[m] = gen; g[m] = ng; from[m] = n; kind[m] = kd; open.push(m, ng + heur(m));
      }
    }
    if (best !== b && bh > 3) return null;
    const out = []; for (let n = best; n >= 0; n = from[n]) { out.push(Object.assign(this.pos(n), { kind: n === a ? 0 : kind[n] })); if (n === a) break; }
    out.reverse();
    return this.simplify(out);
  }
  // can we walk a straight line between two points at about the same level? (no gaps, no walls, no kill bricks)
  walkable(p, q) {
    const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz); if (L < 0.5) return true;
    const steps = Math.ceil(L / (this.cs * 0.5)); let h = p.y;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = p.x + dx * t, z = p.z + dz * t;
      for (const o of [0, 0.9, -0.9]) {   // body width
        const ox = x - dz / L * o, oz = z + dx / L * o; const [i, j] = this.cellOf(ox, oz);
        const n = this.layerNear(i, j, h, -1.9, 1.9); if (n < 0 || this.kill[n]) return false;
        if (o === 0) h = this.h[n];
      }
    }
    if (Math.abs(h - q.y) >= 2) return false;
    for (const y of [Math.max(p.y, q.y) + 2.6, Math.max(p.y, q.y) + 4.6]) for (const o of [0, 0.9, -0.9]) {
      const ox = -dz / L * o, oz = dx / L * o;
      const r = this.world.raycast(p.x + ox, y, p.z + oz, dx / L, 0, dz / L, L, b => !b.dynamic); if (r.part) return false;
    }
    return true;
  }
  // string-pull runs of plain walking
  simplify(pts) {
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) {
      let j = i + 1;
      if (pts[j].kind === 0) { let k = j; while (k + 1 < pts.length && pts[k + 1].kind === 0 && this.walkable(pts[i], pts[k + 1])) k++; j = k; }
      out.push(pts[j]); i = j;
    }
    return out;
  }
  // a random standable spot (optionally near a point), never on kill bricks or moving parts
  randomSpot(cx, cz, r, minH = -1e9, maxH = 1e9) {
    for (let t = 0; t < 60; t++) {
      const x = cx === undefined ? this.minX + Math.random() * this.W * this.cs : cx + (Math.random() * 2 - 1) * r;
      const z = cz === undefined ? this.minZ + Math.random() * this.H * this.cs : cz + (Math.random() * 2 - 1) * r;
      if (!this.inside(x, z)) continue;
      const [i, j] = this.cellOf(x, z), k = j * this.W + i; if (!this.n[k]) continue;
      const l = Math.floor(Math.random() * this.n[k]), h = this.h[k * this.L + l];
      if (this.kill[k * this.L + l] || h < minH || h > maxH || (this.reach && !this.reach[k * this.L + l])) continue;
      if (this.blocked(i + 1, j, h) || this.blocked(i - 1, j, h) || this.blocked(i, j + 1, h) || this.blocked(i, j - 1, h)) continue;
      const c = this.center(k); return { x: c[0], y: h, z: c[1] };
    }
    return null;
  }
}
root.AmbientNav = { Nav, Heap };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------------------------------------------------------------------
   Hands: demos and the Remix library.
   A demo is a recording of a real person's inputs at 60 Hz (same format
   as Realm Delve's INPUT DEMOS, so demos move freely between projects):
     k   bits: W A S D Space LMB RMB, pointer locked, first person, shift
         lock, arrow keys, a CUT flag where the recording jumped
     du dv   raw mouse motion this frame (screen heights)
     cu cv   where the cursor sat (screen heights from the centre, +v down)
     dy dp   how the camera turned (radians)
     z       camera zoom (studs), w scroll notches this frame
   Remix cuts demos into key runs, camera turns, cursor strokes, rests and
   zoom bursts that an NPC replays, mirrored and stretched to fit.
   --------------------------------------------------------------------- */
(function (root) {
'use strict';
const { clamp, rnd, rndi } = root.AmbientCore;
const RBX = { SENS: 0.0055, CAM_MIN: 0.5, CAM_MAX: 128, ZOOM: 1.18, DEF_DIST: 12.5 };
// one scroll notch, exactly like Roblox: x1.18 per notch, snap to first person below 1.3 studs
function notch(c, out) { let t = out ? (c.tdist <= RBX.CAM_MIN + 0.01 ? 1.6 : c.tdist * RBX.ZOOM) : c.tdist / RBX.ZOOM; if (t < 1.3) t = RBX.CAM_MIN; c.tdist = clamp(t, RBX.CAM_MIN, RBX.CAM_MAX); }
const DK = { W: 1, A: 2, S: 4, D: 8, SPACE: 16, LMB: 32, RMB: 64, LOCK: 128, FP: 256, SHIFT: 512, AL: 1024, AR: 2048, CUT: 4096, Q: 8192, F: 16384, E: 32768 };
const Demo = { list: [] };   // the host fills this (see DemoStore)
const KEYBIN = (b) => {
  const f = (b & DK.W ? 1 : 0) - (b & DK.S ? 1 : 0), l = (b & DK.A ? 1 : 0) - (b & DK.D ? 1 : 0);
  if (!f && !l) return 8;
  return ((Math.round(Math.atan2(l, f) / (Math.PI / 4)) % 8) + 8) % 8;
};
const BIN_NAMES = ['W', 'W+A', 'A', 'S+A', 'S', 'S+D', 'D', 'W+D', 'idle'];
const Remix = {
  lib: null, synth: null, ver: 0,
  builtin: null, builtinUse: true,   // a demo the host ships with (used alongside yours; the synthetic hands only when there's nothing else)
  sources() { const use = Demo.list.filter(d => d.use); if (this.builtin && this.builtinUse && !use.some(d => d.id === this.builtin.id)) use.push(this.builtin); return use.length ? use : [this.synthDemo()]; },
  synthDemo() { return this.synth || (this.synth = SynthDemo.make(150)); },
  rebuild() {
    const L = this.analyze(this.sources());
    // a kind of clip your demos never produced is borrowed from the synthetic hands, so every fly can still move
    if (!L.synth) {
      const need = { keys: !L.keys.some(x => x.length), turns: !L.turns.length, strokes: !L.strokes.length, holds: !L.holds.length };
      if (need.keys || need.turns || need.strokes || need.holds) {
        const S = this.analyze([this.synthDemo()]), off = L.demos.length; L.demos.push(...S.demos);
        const mv = arr => arr.map(c => Object.assign({}, c, { d: c.d + off }));
        if (need.keys) { L.keys = S.keys.map(mv); L.borrowed.push('key runs'); }
        if (need.turns) { L.turns = mv(S.turns); L.borrowed.push('camera turns'); }
        if (need.strokes) { L.strokes = mv(S.strokes); L.borrowed.push('cursor flicks'); }
        if (need.holds) L.holds = mv(S.holds);
      }
    }
    this.lib = L; this.ver++;
  },
  demoOf(c) { return c.dm || this.lib.demos[c.d]; },
  analyze(demos) {
    const L = { demos: demos.slice(), synth: demos.every(d => d.synth), borrowed: [], keys: [[], [], [], [], [], [], [], [], []], turns: [], strokes: [], holds: [], zooms: [], jumpHolds: [], clickDelays: [], zC: [], zR: [], fpC: 0, fpR: 0, shC: 0, shR: 0, nC: 0, nR: 0, frames: 0, jumps: 0 };
    demos.forEach((d, di) => {
      const n = d.n, k = d.k; L.frames += n;
      // fighting = left mouse within the last 2 s
      const combat = new Uint8Array(n); let lastL = -1e9;
      for (let i = 0; i < n; i++) { if (k[i] & DK.LMB) lastL = i; combat[i] = i - lastL < 120 ? 1 : 0; }
      // ---- keys: smooth the direction with a 0.3 s majority vote (so a tap stays inside its run), then cut runs
      const raw = new Uint8Array(n); for (let i = 0; i < n; i++) raw[i] = KEYBIN(k[i]);
      const sm = new Uint8Array(n), cnt = new Int32Array(9), R = 9;
      for (let i = 0; i < Math.min(n, R); i++) cnt[raw[i]]++;
      for (let i = 0; i < n; i++) {
        if (i + R < n) cnt[raw[i + R]]++;
        if (i - R - 1 >= 0) cnt[raw[i - R - 1]]--;
        let b = raw[i], bc = cnt[b]; for (let q = 0; q < 9; q++) if (cnt[q] > bc) { bc = cnt[q]; b = q; }
        sm[i] = b;
      }
      let s = 0;
      for (let i = 1; i <= n; i++) {
        if (i === n || sm[i] !== sm[s] || (k[i] & DK.CUT)) {
          let p = s;
          while (i - p >= 12) { const len = Math.min(i - p, 60 + ((p * 7919) % 120)); L.keys[sm[s]].push({ d: di, dm: d, s: p, n: len, bin: sm[s] }); p += len; }
          s = i;
        }
      }
      // ---- camera turns
      const mv = (i) => Math.abs(d.dy[i]) > 0.0058 || Math.abs(d.dp[i]) > 0.0058;
      for (let i = 0; i < n;) {
        if (!mv(i) || Math.abs(d.dy[i]) > 0.6) { i++; continue; }
        let j = i, gap = 0, e = i;
        while (j < n && gap <= 4 && !(j > i && (k[j] & DK.CUT)) && Math.abs(d.dy[j]) <= 0.6) { if (mv(j)) { gap = 0; e = j; } else gap++; j++; }
        const len = e - i + 1;
        if (len >= 3) {
          let Y = 0, P = 0, rmb = 0, lock = 0, arr = 0; for (let q = i; q <= e; q++) { Y += d.dy[q]; P += d.dp[q]; if (k[q] & DK.RMB) rmb++; if (k[q] & DK.LOCK) lock++; if (k[q] & (DK.AL | DK.AR)) arr++; }
          if (Math.abs(Y) > 0.05 || Math.abs(P) > 0.05) L.turns.push({ d: di, dm: d, s: i, n: len, Y, P, how: arr > len / 2 ? 'arrow keys' : rmb > len / 3 ? 'right-drag' : lock > len / 2 ? (k[i] & DK.FP ? 'first-person mouse' : 'shift-lock mouse') : 'mouse', combat: combat[i] });
        }
        i = e + 1;
      }
      // ---- cursor strokes (all mouse motion, rest to rest) and holds (the rest)
      const sp = (i) => Math.hypot(d.du[i], d.dv[i]);
      for (let i = 0; i < n;) {
        if (sp(i) <= 0.0012) {
          let j = i; while (j < n && sp(j) <= 0.0012 && !(j > i && (k[j] & DK.CUT))) j++;
          for (let p = i; j - p >= 18; p += 90) L.holds.push({ d: di, dm: d, s: p, n: Math.min(90, j - p) });
          i = j; continue;
        }
        let j = i, gap = 0, e = i;
        while (j < n && gap <= 3 && !(j > i && (k[j] & DK.CUT))) { if (sp(j) > 0.0012) { gap = 0; e = j; } else gap++; j++; }
        const len = e - i + 1;
        if (len >= 3) {
          let U = 0, V = 0, lock = 0; for (let q = i; q <= e; q++) { U += d.du[q]; V += d.dv[q]; if (k[q] & DK.LOCK) lock++; }
          if (Math.hypot(U, V) > 0.004 && len < 150) L.strokes.push({ d: di, dm: d, s: i, n: len, U, V, lock: lock > len / 2, combat: combat[i] });
        }
        i = e + 1;
      }
      // ---- zoom bursts
      for (let i = 0; i < n; i++) {
        if (!d.w[i]) continue;
        const notches = []; let j = i, last = i;
        while (j < n && j - last <= 21) { if (d.w[j]) { for (let q = 0; q < Math.abs(d.w[j]); q++) notches.push([j - i, Math.sign(d.w[j])]); last = j; } j++; }
        const net = notches.reduce((a, b) => a + b[1], 0);
        if (net) L.zooms.push({ d: di, dm: d, s: i, n: last - i + 1, notches, net });
        i = last;
      }
      // ---- habits: zoom by situation, shift lock / first person, how long Space is held, click timing
      for (let i = 0; i < n; i += 6) {
        const fp = k[i] & DK.FP, sh = k[i] & DK.SHIFT;
        if (combat[i]) { L.nC++; L.zC.push(d.z[i]); if (fp) L.fpC++; if (sh) L.shC++; } else { L.nR++; L.zR.push(d.z[i]); if (fp) L.fpR++; if (sh) L.shR++; }
      }
      for (let i = 0; i < n; i++) {
        if ((k[i] & DK.SPACE) && !(i && (k[i - 1] & DK.SPACE))) { let j = i; while (j < n && (k[j] & DK.SPACE)) j++; L.jumpHolds.push(j - i); L.jumps++; i = j; }
      }
      let lastStrokeEnd = -1e9; for (const st of L.strokes) if (st.d === di) { /* strokes are in order */ }
      const ends = L.strokes.filter(st => st.d === di).map(st => st.s + st.n);
      let ei = 0;
      for (let i = 1; i < n; i++) {
        while (ei < ends.length && ends[ei] <= i) { lastStrokeEnd = ends[ei]; ei++; }
        if ((k[i] & DK.LMB) && !(k[i - 1] & DK.LMB) && i - lastStrokeEnd >= 0 && i - lastStrokeEnd <= 30) L.clickDelays.push(i - lastStrokeEnd);
      }
    });
    return L;
  },
  // ------------------------------------------------------------ picking
  sample(arr, max) { if (arr.length <= max) return arr; const out = []; for (let i = 0; i < max; i++) out.push(arr[(Math.random() * arr.length) | 0]); return out; },
  // a key run that walks in camera-relative direction `bin` (0 = W ... 7 = W+D, 8 = idle)
  pickKeys(bin) {
    const L = this.lib, mir = (b) => b === 8 ? 8 : (8 - b) % 8;
    const opts = [];
    for (const c of L.keys[bin]) opts.push([c, 0, 0]);
    if (bin !== 8 && mir(bin) !== bin) for (const c of L.keys[mir(bin)]) opts.push([c, 1, 0]);
    if (!opts.length && bin !== 8) for (let r = 1; r < 4 && !opts.length; r++) { const sb = ((bin - 2 * r) % 8 + 8) % 8; for (const c of L.keys[sb]) opts.push([c, 0, r]); for (const c of L.keys[mir(sb)]) opts.push([c, 1, r]); }
    if (!opts.length) return null;
    const [c, m, r] = opts[(Math.random() * opts.length) | 0];
    return { c, mirror: m, rot: r, i: 0 };
  },
  keyBits(b, mirror, rot) {
    let w = b & DK.W, a = b & DK.A, s = b & DK.S, d = b & DK.D;
    if (mirror) { const t = a; a = d; d = t; }
    for (let r = 0; r < rot; r++) { const W_ = d, A_ = w, S_ = a, D_ = s; w = W_; a = A_; s = S_; d = D_; }
    return (w ? DK.W : 0) | (a ? DK.A : 0) | (s ? DK.S : 0) | (d ? DK.D : 0) | (b & DK.SPACE);
  },
  // a camera turn of `e` radians of yaw (and, when `ep` is given, that much pitch too)
  pickTurn(e, ep = null, combat = false) {
    const L = this.lib; let best = null, bs = 1e9;
    const pool = combat && L.turns.some(t => t.combat) && Math.random() < 0.7 ? L.turns.filter(t => t.combat) : L.turns;
    for (const t of this.sample(pool, 180)) {
      if (ep === null) {
        if (Math.abs(t.Y) < 0.04) continue;
        const my = Math.sign(e) === Math.sign(t.Y) ? 1 : -1, s = clamp(Math.abs(e / t.Y), 0.65, 1.5);
        const err = Math.abs(Math.abs(e) - s * Math.abs(t.Y)) + 0.25 * Math.abs(Math.log(s)) + Math.random() * 0.04;
        if (err < bs) { bs = err; best = { c: t, my, mp: Math.random() < 0.5 ? 1 : -1, s, i: 0 }; }
      } else {
        const l2 = t.Y * t.Y + t.P * t.P; if (l2 < 1e-5) continue;
        for (const my of [1, -1]) for (const mp of [1, -1]) {
          const u = t.Y * my, v = t.P * mp, s = clamp((u * e + v * ep) / l2, 0.65, 1.5);
          const err = Math.hypot(u * s - e, v * s - ep) + 0.08 * Math.abs(Math.log(s)) + Math.random() * 0.01;
          if (err < bs) { bs = err; best = { c: t, my, mp, s, i: 0 }; }
        }
      }
    }
    return best;
  },
  // a mouse stroke that should carry the cursor by (nu, nv) screen units
  pickStroke(nu, nv, combat = false) {
    const L = this.lib; let best = null, bs = 1e9; const nl = Math.hypot(nu, nv);
    const pool = combat && Math.random() < 0.6 ? L.strokes.filter(t => t.combat) : L.strokes;
    for (const c of this.sample(pool.length ? pool : L.strokes, 220)) {
      const l2 = c.U * c.U + c.V * c.V; if (l2 < 1e-8) continue;
      for (const mx of [1, -1]) for (const my of [1, -1]) {
        const u = c.U * mx, v = c.V * my, s = clamp((u * nu + v * nv) / l2, nl < 0.04 ? 0.35 : 0.7, 1.4);   // small corrections may shrink a recorded flick further
        const err = Math.hypot(u * s - nu, v * s - nv) + 0.12 * nl * Math.abs(Math.log(s)) + Math.random() * 0.003;
        if (err < bs) { bs = err; best = { c, mx, my, s, i: 0, err }; }
      }
    }
    return best;
  },
  pickHold() { const L = this.lib; return L.holds.length ? { c: L.holds[(Math.random() * L.holds.length) | 0], mx: Math.random() < 0.5 ? 1 : -1, my: Math.random() < 0.5 ? 1 : -1, i: 0 } : null; },
  pickZoom(sign) {
    const L = this.lib; if (!L.zooms.length) return null;
    const same = L.zooms.filter(z => Math.sign(z.net) === sign), pool = same.length ? same : L.zooms;
    const z = pool[(Math.random() * pool.length) | 0];
    return { c: z, flip: Math.sign(z.net) !== sign ? -1 : 1, i: 0, done: 0 };
  },
  wantDist(combat) {
    const L = this.lib, arr = combat ? (L.zC.length ? L.zC : L.zR) : (L.zR.length ? L.zR : L.zC);
    return arr.length ? arr[(Math.random() * arr.length) | 0] : RBX.DEF_DIST;
  },
  shiftChance(combat) { const L = this.lib; return combat ? (L.nC ? L.shC / L.nC : 0) : (L.nR ? L.shR / L.nR : 0); },
  jumpHold() { const L = this.lib; return L.jumpHolds.length ? L.jumpHolds[(Math.random() * L.jumpHolds.length) | 0] : 8; },
  clickDelay() { const L = this.lib; return L.clickDelays.length ? L.clickDelays[(Math.random() * L.clickDelays.length) | 0] : 4 + Math.random() * 6; },
  summary() {
    const L = this.lib; if (!L) return '';
    const kc = L.keys.reduce((a, b) => a + b.length, 0), s = Math.round(L.frames / 60);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} of hands · ${kc} key runs · ${L.turns.length} camera turns · ${L.strokes.length} cursor flicks · ${L.jumps} jumps · ${L.zooms.length} zoom bursts`;
  },
};

// ---------------------------------------------------------------- synthetic hands (until you record your own)
const SynthDemo = {
  make(sec) {
    const HZ = 60, n = sec * HZ, h = 1000;
    const k = new Int32Array(n), du = new Float32Array(n), dv = new Float32Array(n), cu = new Float32Array(n), cv = new Float32Array(n), dy = new Float32Array(n), dp = new Float32Array(n), z = new Float32Array(n), w = new Int8Array(n);
    const bell = (q, len) => { const x = (q + 0.5) / len; return 30 * x * x * (1 - x) * (1 - x) / len; };   // minimum-jerk speed profile, sums to ~1
    // keys: walks with sidestep taps, strafe dances, diagonals, backsteps, pauses
    let i = 0; const put = (len, bits) => { for (let j = 0; j < len && i < n; j++, i++) k[i] |= bits; };
    while (i < n) {
      const r = Math.random();
      if (r < 0.42) { const len = rndi(40, 180), s0 = i; put(len, DK.W); for (let t = s0 + rndi(20, 60); t < s0 + len; t += rndi(25, 70)) if (Math.random() < 0.45) { const b = Math.random() < 0.5 ? DK.A : DK.D; for (let q = 0, m = rndi(5, 10); q < m && t + q < n; q++) k[t + q] |= b; } }
      else if (r < 0.62) { let side = Math.random() < 0.5 ? DK.A : DK.D; for (let q = 0, reps = rndi(2, 5); q < reps; q++) { put(rndi(14, 50), side); side = side === DK.A ? DK.D : DK.A; } }
      else if (r < 0.75) put(rndi(25, 90), DK.W | (Math.random() < 0.5 ? DK.A : DK.D));
      else if (r < 0.82) put(rndi(12, 36), DK.S);
      else if (r < 0.86) put(rndi(20, 50), DK.S | (Math.random() < 0.5 ? DK.A : DK.D));
      else i += rndi(18, 80);
    }
    for (let t = rndi(60, 200); t < n; t += rndi(110, 380)) for (let q = 0, m = rndi(5, 14); q < m && t + q < n; q++) k[t + q] |= DK.SPACE;
    // fighting phases: bursts of left clicks; some of them in first person
    const comb = new Uint8Array(n), fpPh = new Uint8Array(n);
    for (let t = 0, c = false; t < n; c = !c) { const len = rndi(c ? 420 : 600, c ? 1100 : 1500); const fp = c && Math.random() < 0.15; for (let q = 0; q < len && t + q < n; q++) { comb[t + q] = c ? 1 : 0; fpPh[t + q] = fp ? 1 : 0; } t += len; }
    for (let t = 0; t < n;) { if (comb[t]) { const on = rndi(15, 110); for (let q = 0; q < on && t + q < n; q++) k[t + q] |= DK.LMB; t += on + rndi(10, 50); } else t += 10; }
    for (let t = 0; t < n; t++) if (fpPh[t]) k[t] |= DK.FP | DK.LOCK;
    // the mouse: right-drag camera turns and cursor flicks (in first person, flicks turn the camera)
    let x = 0, y = -0.02;
    for (let t = rndi(20, 60); t < n;) {
      if (Math.random() < 0.36 && !fpPh[t]) {
        const Y = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.pow(Math.random(), 1.4) * 2.2), P = rnd(-0.12, 0.12);
        const len = Math.round(clamp(12 + Math.abs(Y) * 14, 12, 48) * rnd(0.8, 1.25));
        for (let q = 0; q < len && t + q < n; q++) { const b = bell(q, len), f = t + q; dy[f] += Y * b; dp[f] += P * b; k[f] |= DK.RMB | DK.LOCK; du[f] += -(Y * b) / RBX.SENS / h; dv[f] += (P * b) / RBX.SENS / h; }
        t += len + rndi(30, 200);
      } else {
        const tx = rnd(-0.45, 0.45) * (Math.random() < 0.6 ? 0.6 : 1), ty = rnd(-0.22, 0.22);
        const U = tx - x, V = ty - y, dist = Math.hypot(U, V) || 1e-3, over = 1 + rnd(0.04, 0.14), bul = rnd(-0.08, 0.08) * dist;
        const len = Math.round(clamp(10 + dist * 55, 8, 36) * rnd(0.85, 1.2));
        const emit = (f, a, b) => { if (f >= n) return; if (fpPh[f]) { dy[f] += -a * RBX.SENS * h; dp[f] += b * RBX.SENS * h; } du[f] += a; dv[f] += b; };
        for (let q = 0; q < len; q++) { const b = bell(q, len), xq = (q + 0.5) / len, side = bul * (4 - 8 * xq) / len; emit(t + q, U * over * b + (-V / dist) * side, V * over * b + (U / dist) * side); }
        const cl = rndi(6, 12), cU = -U * (over - 1), cV = -V * (over - 1);
        for (let q = 0; q < cl; q++) { const b = bell(q, cl); emit(t + len + q, cU * b, cV * b); }
        x = tx; y = ty; t += len + cl + rndi(8, 70);
      }
    }
    for (let f = 0; f < n; f++) if (!(k[f] & DK.LOCK)) { du[f] += rnd(-0.0004, 0.0004); dv[f] += rnd(-0.0004, 0.0004); }
    // zoom: little scroll bursts; all the way in for the first-person fights
    const zc = { tdist: 12.5 };
    for (let f = 0; f < n; f++) {
      if (fpPh[f] && !(f && fpPh[f - 1])) { for (let m = 0; zc.tdist > RBX.CAM_MIN + 0.01 && m < 40; m++) { w[Math.min(n - 1, f + m * 3)] -= 1; notch(zc, false); } }
      else if (!fpPh[f] && f && fpPh[f - 1]) { for (let m = 0; m < 14; m++) { w[Math.min(n - 1, f + m * 4)] += 1; notch(zc, true); } }
      else if (!fpPh[f] && Math.random() < 1 / 700) { const out = zc.tdist < 9 ? 1 : zc.tdist > 20 ? -1 : (Math.random() < 0.5 ? 1 : -1); for (let m = 0, c = rndi(1, 4); m < c; m++) { w[Math.min(n - 1, f + m * rndi(4, 9))] += out; notch(zc, out > 0); } }
    }
    let zd = 12.5; const c0 = { tdist: zd };
    for (let f = 0; f < n; f++) { for (let q = 0; q < Math.abs(w[f]); q++) notch(c0, w[f] > 0); if (fpPh[f]) c0.tdist = Math.min(c0.tdist, 0.5); z[f] = c0.tdist; }
    for (let f = 0; f < n; f++) { if (!(k[f] & DK.LOCK)) { x = clamp((f ? cu[f - 1] : 0) + du[f], -0.85, 0.85); y = clamp((f ? cv[f - 1] : -0.02) + dv[f], -0.5, 0.5); } else { x = f ? cu[f - 1] : 0; y = f ? cv[f - 1] : 0; } cu[f] = x; cv[f] = y; }
    k[0] |= DK.CUT;
    return { id: 'synth', name: 'Built-in starter hands (synthetic)', created: 0, hz: HZ, h, champ: 'skye', n, use: true, synth: true, k, du, dv, cu, cv, dy, dp, z, w };
  },
};

// ---------------------------------------------------------------- demo storage (IndexedDB, shared with Realm Delve in the same browser)
const DemoStore = {
  db: null, list: Demo.list,
  open() { return new Promise(res => { try { const rq = indexedDB.open('realm-delve-demos', 1); rq.onupgradeneeded = () => { try { rq.result.createObjectStore('demos', { keyPath: 'id' }); } catch (e) { } }; rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch (e) { res(null); } }); },
  tx(mode, fn) { return new Promise(res => { if (!this.db) return res(null); try { const t = this.db.transaction('demos', mode), rq = fn(t.objectStore('demos')); t.oncomplete = () => res(rq ? rq.result : true); t.onerror = () => res(null); } catch (e) { res(null); } }); },
  valid(e) { return e && e.kind === 'realm-delve-demo' && Array.isArray(e.k) && e.k.length > 10 && ['du', 'dv', 'cu', 'cv', 'dy', 'dp', 'z', 'w'].every(f => Array.isArray(e[f]) && e[f].length === e.k.length); },
  decode(e) { const f = (a, s) => Float32Array.from(a, x => x / s); return { id: e.id, name: e.name, created: e.created, hz: e.hz || 60, h: e.h || 1000, champ: e.champ, n: e.k.length, use: e.use !== false, enc: e, k: Int32Array.from(e.k), du: f(e.du, 1e4), dv: f(e.dv, 1e4), cu: f(e.cu, 1e4), cv: f(e.cv, 1e4), dy: f(e.dy, 1e4), dp: f(e.dp, 1e4), z: f(e.z, 10), w: Int8Array.from(e.w) }; },
  async init() { this.db = await this.open(); const all = (await this.tx('readonly', st => st.getAll())) || []; Demo.list.length = 0; all.filter(e => this.valid(e)).sort((a, b) => b.created - a.created).forEach(e => Demo.list.push(this.decode(e))); Remix.rebuild(); },
  async add(enc) { if (Demo.list.some(d => d.id === enc.id)) enc.id += '_' + Math.random().toString(36).slice(2, 6); await this.tx('readwrite', st => st.put(enc)); Demo.list.unshift(this.decode(enc)); Remix.rebuild(); },
  async remove(id) { await this.tx('readwrite', st => st.delete(id)); const i = Demo.list.findIndex(d => d.id === id); if (i >= 0) Demo.list.splice(i, 1); Remix.rebuild(); },
  async setUse(id, v) { const d = Demo.list.find(x => x.id === id); if (!d) return; d.use = v; d.enc.use = v; await this.tx('readwrite', st => st.put(d.enc)); Remix.rebuild(); },
  download(id) { const d = Demo.list.find(x => x.id === id); if (!d) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d.enc)], { type: 'application/json' })); a.download = d.name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_') + '.rddemo.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); },
  async importFiles(files) { let ok = 0, bad = 0; for (const f of files) { try { const e = JSON.parse(await f.text()); if (!this.valid(e)) { bad++; continue; } e.id = e.id || ('d' + Date.now().toString(36)); e.name = e.name || f.name; e.created = e.created || Date.now(); await this.add(e); ok++; } catch (err) { bad++; } } return { ok, bad }; },
};
// ---------------------------------------------------------------- the recorder (the host calls sample() once a frame with the player's state)
// state: { keys:Set of KeyboardEvent.code, lmb, rmb, locked, fp, shift, cu, cv, camYaw, camPitch, camDist, mdx, mdy (px), wheel (notches), h (screen px), alive }
class Recorder {
  constructor() { this.rec = null; }
  get on() { return !!this.rec; }
  start(label) { this.rec = { k: [], du: [], dv: [], cu: [], cv: [], dy: [], dp: [], z: [], w: [], acc: 0, adu: 0, adv: 0, aw: 0, ady: 0, adp: 0, ly: null, lp: 0, cut: true, h: 0, label: label || 'Zoo', t0: Date.now() }; }
  seconds() { return this.rec ? this.rec.k.length / 60 : 0; }
  sample(dt, s) {
    const r = this.rec; if (!r) return;
    if (!s || !s.alive) { r.cut = true; r.ly = null; r.acc = 0; r.adu = r.adv = r.aw = r.ady = r.adp = 0; return; }
    r.h = s.h || r.h || 1000;
    if (r.ly === null) { r.ly = s.camYaw; r.lp = s.camPitch; }
    let dy = (s.camYaw - r.ly) % (Math.PI * 2); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    r.ady += dy; r.adp += s.camPitch - r.lp; r.ly = s.camYaw; r.lp = s.camPitch;
    r.adu += (s.mdx || 0) / r.h; r.adv += (s.mdy || 0) / r.h; r.aw += s.wheel || 0; r.acc += dt;
    const n = Math.floor(r.acc * 60 + 1e-6); if (n <= 0) return; r.acc -= n / 60;
    const K = s.keys; let b = 0;
    if (K.has('KeyW') || K.has('ArrowUp')) b |= DK.W; if (K.has('KeyA')) b |= DK.A; if (K.has('KeyS') || K.has('ArrowDown')) b |= DK.S; if (K.has('KeyD')) b |= DK.D; if (K.has('Space')) b |= DK.SPACE;
    if (s.lmb) b |= DK.LMB; if (s.rmb) b |= DK.RMB; if (s.locked) b |= DK.LOCK; if (s.fp) b |= DK.FP | DK.LOCK; if (s.shift) b |= DK.SHIFT | DK.LOCK;
    if (K.has('ArrowLeft')) b |= DK.AL; if (K.has('ArrowRight')) b |= DK.AR; if (K.has('KeyQ')) b |= DK.Q; if (K.has('KeyF')) b |= DK.F; if (K.has('KeyE')) b |= DK.E;
    const q = (x, sc) => Math.round(x * sc);
    for (let i = 0; i < n; i++) { r.k.push(b | (r.cut && i === 0 ? DK.CUT : 0)); r.du.push(q(r.adu / n, 1e4)); r.dv.push(q(r.adv / n, 1e4)); r.cu.push(q(s.cu, 1e4)); r.cv.push(q(s.cv, 1e4)); r.dy.push(q(r.ady / n, 1e4)); r.dp.push(q(r.adp / n, 1e4)); r.z.push(q(s.camDist, 10)); r.w.push(i === 0 ? r.aw : 0); }
    r.adu = r.adv = r.aw = r.ady = r.adp = 0; r.cut = false;
  }
  // stop; returns the encoded demo (or null if shorter than 3 s)
  stop() {
    const r = this.rec; this.rec = null; if (!r || r.k.length < 180) return null;
    const s = Math.floor(r.k.length / 60), d = new Date(r.t0);
    const name = `${r.label} · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    return { kind: 'realm-delve-demo', v: 1, id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, created: Date.now(), hz: 60, h: r.h, champ: 'zoo', use: true, k: r.k, du: r.du, dv: r.dv, cu: r.cu, cv: r.cv, dy: r.dy, dp: r.dp, z: r.z, w: r.w };
  }
}
root.AmbientHands = { DK, KEYBIN, BIN_NAMES, Remix, SynthDemo, Demo, DemoStore, Recorder, notch, RBX };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------------------------------------------------------------------
   The crowd: brains (what to do) and hands (how to press the keys).

   They only ever walk, jump and sit: no chat, no emotes.

   BRAIN · each NPC has a personality (a multiplier per activity, drawn
   around the crowd's sliders) and picks one activity at a time:
     wander    walk to a random spot nearby, linger, look around
     explore   go to a point of interest (the obby, a lookout...), hang out
     social    walk up to someone (players count) and stand with them a
               while; often turns into
     follow    tag along behind someone for a while
     idle      stand about, glance around, maybe hop
     afk       hands off everything for a while ("brb")
     jumpy     jump in place, or bunny-hop somewhere
     sit       find a free seat and sit on it
     obby      try the obby (gap jumps over kill bricks); rage-quits
     pad       step on a jump pad
     elevator  ride the elevator up and walk off at the top
     ball      dribble a ball around
     button    stand on a button
   Paths come from Nav (walking, jumping up, dropping, gap jumps); when a
   body gets stuck it hops, then re-plans, then gives up and does
   something else.

   HANDS · the brain only says "move that way, jump now, look at that".
   With hands = 'remix' that becomes the inputs a person would make,
   replayed from demos: key runs (W, W+A... mirrored A↔D) with their
   sidesteps and hops, camera turns (right-drags, mirrored and stretched),
   scroll bursts, a cursor that rests where people rest it and drifts onto
   whoever they're looking at. With hands = 'direct' the brain's wish is
   used as-is (handy to see the difference).
   --------------------------------------------------------------------- */
(function (root) {
'use strict';
const { clamp, rnd, rndi, pick, angDiff, wpick, CFG, BODY, makeCharacter, respawn, stepAll } = root.AmbientCore;
const { DK, BIN_NAMES, Remix, notch, RBX } = root.AmbientHands;

// ---------------------------------------------------------------- names, looks, lines
const NAME_A = ['', '', '', '', 'xX_', 'Its', 'Mr', 'The', 'Lil', 'Real', 'Not'];
const NAME_B = ['Noob', 'Builder', 'Gamer', 'Shadow', 'Pizza', 'Ninja', 'Dragon', 'Bacon', 'Cookie', 'Robo', 'Blox', 'Turbo', 'Frosty', 'Pixel', 'Doge', 'Zombie', 'Lava', 'Speedy', 'Epic', 'Sneaky', 'Banana', 'Kitty', 'Wolf', 'Fox', 'Cyber', 'Toast', 'Taco', 'Panda', 'Rocket', 'Moon', 'Star', 'Slime', 'Potato', 'Waffle', 'Comet', 'Sky', 'Gummy'];
const NAME_C = ['Master', 'Guy', 'Kid', 'Boy', 'Girl', 'Pro', 'King', 'Queen', 'Lord', 'Fan', 'YT', 'Dude', 'Bot', 'Cat', 'Hero', '', '', ''];
function makeName(used) {
  for (let t = 0; t < 50; t++) {
    const a = pick(NAME_A); let n = a + pick(NAME_B) + pick(NAME_C);
    if (Math.random() < 0.55) n += Math.random() < 0.5 ? rndi(1, 99) : rndi(100, 9999);
    if (a === 'xX_') n += '_Xx'; else if (Math.random() < 0.15) n = n.toLowerCase();
    if (!used || !used.has(n)) return n;
  }
  return 'Player' + rndi(1000, 9999);
}
const SKINS = [0xf5cd30, 0xf5cd30, 0xffcc99, 0xeab892, 0xd7a07c, 0xa66f4a, 0x7c4b2e, 0x5a3825, 0xcc8e69];
const SHIRTS = [0x0d69ac, 0xc4281c, 0x4b974b, 0xf2f3f3, 0x1b2a35, 0xda8541, 0x6b327c, 0x27466a, 0xe8bac8, 0xffc0cb, 0x74869d, 0x111111, 0x3a7d8c, 0xb4d2e4];
const PANTS = [0x1b2a35, 0x0d69ac, 0x4b974b, 0x27466a, 0x111111, 0x6b4a2c, 0x7f7f7f, 0x2c2c4a, 0xa34b4b];
const HATS = ['none', 'none', 'cap', 'cap', 'hair', 'hair', 'hair', 'tophat', 'headphones', 'beanie', 'crown', 'horns'];
function makeLook() {
  if (Math.random() < 0.1) return { skin: 0xf5cd30, shirt: 0x0d69ac, pants: 0x4b974b, hat: 'none', hatColor: 0, face: 'smile', noob: true };   // the classic noob
  return { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hat: pick(HATS), hatColor: pick([0x111111, 0x6b4a2c, 0xc4281c, 0x0d69ac, 0xf2f3f3, 0xf5cd30, 0x3a2a20, 0xda8541]), face: pick(['smile', 'smile', 'smile', 'grin', 'cool', 'meh', 'happy']) };
}
const LINES = {
  greet: ['hi', 'hey', 'hello', 'yo', 'sup', 'hii', 'heyy', ':)', 'wsg', 'hi guys', 'o/'],
  social: ['what are you doing', 'nice avatar', 'wanna be friends', 'lol', 'same', 'true', 'omg', 'where r u going', 'follow me', 'race me', 'this game is cool', 'im bored', 'anyone here?', 'who wants to play', 'ok', 'xd', 'how do i get up there', 'did you do the obby?', 'the maze is hard', 'can u give me robux', 'lol same', 'whats ur fav color', 'nice', 'cool'],
  explore: ['going to {p}', 'anyone at {p}?', 'wow', 'cool', 'nice view', 'lol', 'whats this', 'ooh'],
  follow: ['wait for me', 'where are we going', 'coming', 'im following you', 'wait up'],
  obbyWin: ['ez', 'EZ', 'first try', 'gg', 'i did it!!', 'easy'], obbyFail: ['bruh', 'this obby is impossible', 'nooo', 'lag', 'i give up', 'rigged'],
  died: ['oof', 'bruh', 'lol', 'why', 'ow'], afk: ['brb', 'afk', 'brb food'], back: ['back', 'im back', 'k back'], sit: ['comfy', 'nice bench', 'resting'],
  pad: ['WHEEE', 'woah', 'yeet', 'weee'], dance: ['dance party!', 'lets go', 'vibing'], ball: ['goal!!', 'pass it', 'kick it here', 'mine'], button: ['what does this do', 'party!!!', 'ooo'],
  elevator: ['going up', 'elevator music', 'ding'], lost: ['how do i get there', 'im lost', 'uhh'],
};
const say = (k, p) => pick(LINES[k]).replace('{p}', p || 'there');

// ---------------------------------------------------------------- an NPC camera (third person orbit, like Roblox)
function camPose(n, world, collide = true) {
  const c = n.cam, ch = n.ch, fp = c.tdist <= RBX.CAM_MIN + 0.01;
  const cp = Math.cos(c.pitch), dx = Math.sin(c.yaw) * cp, dy = Math.sin(c.pitch), dz = Math.cos(c.yaw) * cp;
  let ox = 0, oz = 0; if (c.shift && !fp) { ox = Math.cos(c.yaw) * 1.75; oz = -Math.sin(c.yaw) * 1.75; }
  const ax = ch.x + ox, ay = ch.y + 1.5, az = ch.z + oz;
  let d = fp ? 0 : Math.max(RBX.CAM_MIN, c.dist);
  if (collide && d > 0) { const r = world.raycast(ax, ay, az, dx, dy, dz, d + 0.3, p => p.kind !== 'seat' && !p.glass); if (r.part && r.t - 0.3 < d) d = Math.max(RBX.CAM_MIN, r.t - 0.3); }
  const P = c.pose || (c.pose = { pos: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 0, z: 0 } });
  if (fp) { P.pos.x = ch.x; P.pos.y = ch.y + 1.6; P.pos.z = ch.z; } else { P.pos.x = ax + dx * d; P.pos.y = ay + dy * d; P.pos.z = az + dz * d; }
  P.fwd.x = -dx; P.fwd.y = -dy; P.fwd.z = -dz; P.right.x = Math.cos(c.yaw); P.right.y = 0; P.right.z = -Math.sin(c.yaw);
  // up = right × fwd
  P.up.x = P.right.y * P.fwd.z - P.right.z * P.fwd.y; P.up.y = P.right.z * P.fwd.x - P.right.x * P.fwd.z; P.up.z = P.right.x * P.fwd.y - P.right.y * P.fwd.x;
  P.d = d; P.fp = fp; P.yaw = c.yaw; P.pitch = c.pitch;
  return P;
}
function project(P, p, tanV) {
  const rx = p.x - P.pos.x, ry = p.y - P.pos.y, rz = p.z - P.pos.z, z = rx * P.fwd.x + ry * P.fwd.y + rz * P.fwd.z; if (z < 0.1) return null;
  const k = 1 / (z * 2 * tanV); return { u: (rx * P.right.x + ry * P.right.y + rz * P.right.z) * k, v: -(rx * P.up.x + ry * P.up.y + rz * P.up.z) * k, z };
}

// ---------------------------------------------------------------- hands
const Hands = {
  src(c) { const d = Remix.demoOf(c); if (!d) return ''; return (d.synth ? 'starter hands' : '“' + d.name + '”') + ' @' + (c.s / 60).toFixed(1) + 's'; },
  mirBin(b) { return b === 8 ? 8 : (8 - b) % 8; },
  effBin(K) { let b = K.c.bin; if (K.mirror) b = this.mirBin(b); if (b !== 8) b = (b + 2 * K.rot) % 8; return b; },
  fresh() { return { key: null, turn: null, stroke: null, hold: null, zoom: null, jump: 0, zoomT: rnd(1, 6), want: 0, modeT: rnd(8, 20), keys: 0, rmb: false, lmb: false, wheelT: 0, wheelDir: 0, restU: 0, restV: -0.03, restT: 0, tapCd: 0, tapN: 0, lab: { keys: '', turn: '', cur: '', zoom: '' } }; },
  drive(n, dt, crowd) {
    const w = n.wish, c = n.cam, ch = n.ch, m = n.motor, L = Remix.lib, inp = ch.input;
    c.dist += (c.tdist - c.dist) * (1 - Math.exp(-14 * dt)); m.wheelT -= dt; m.tapCd -= dt;
    if (ch.dead || n.afk) { inp.mx = inp.mz = 0; inp.jump = false; m.keys = 0; m.rmb = m.lmb = false; ch.lockYaw = null; m.lab.keys = n.afk ? 'AFK: hands off' : 'dead'; return; }
    if (crowd.settings.hands === 'direct' || !L) return this.direct(n, dt);
    const moving = Math.hypot(w.mx, w.mz) > 0.25, moveYaw = moving ? Math.atan2(-w.mx, -w.mz) : null;
    m.modeT -= dt; if (m.modeT <= 0) { m.modeT = rnd(12, 30); c.shift = c.tdist > 0.6 && Math.random() < Remix.shiftChance(false); }
    this.zoom(n, m, c, dt);
    const fp = c.tdist <= RBX.CAM_MIN + 0.01, locked = fp || c.shift;
    ch.lockYaw = locked ? c.yaw : null;
    const bear = p => Math.atan2(-(p.x - ch.x), -(p.z - ch.z));
    let gy = null, thr = 0.4;
    if (moving) { gy = moveYaw; thr = w.precise ? 0.14 : 0.42; }
    else if (w.look) { gy = bear(w.look); thr = locked ? 0.25 : 0.75; }
    this.turn(n, m, c, dt, gy, thr, locked);
    this.keys(n, m, c, dt, moving, moveYaw, w);
    this.cursor(n, m, c, dt, w, locked, crowd);
  },
  direct(n, dt) {
    const w = n.wish, c = n.cam, ch = n.ch, m = n.motor, inp = n.ch.input;
    inp.mx = w.mx; inp.mz = w.mz; inp.jump = !!w.jump; ch.lockYaw = null; c.shift = false;
    const moving = Math.hypot(w.mx, w.mz) > 0.25;
    if (moving) c.yaw += angDiff(c.yaw, Math.atan2(-w.mx, -w.mz)) * (1 - Math.exp(-3 * dt));
    if (!moving && w.face) { const d = angDiff(ch.faceYaw, Math.atan2(-(w.face.x - ch.x), -(w.face.z - ch.z))); ch.faceYaw += d * (1 - Math.exp(-6 * dt)); }
    c.pitch += (0.32 - c.pitch) * (1 - Math.exp(-2 * dt)); c.tdist = RBX.DEF_DIST; c.cu *= 0.9; c.cv *= 0.9;
    m.keys = (moving ? DK.W : 0) | (w.jump ? DK.SPACE : 0); m.rmb = false; m.lab = { keys: 'direct steering (no hands)', turn: '', cur: '', zoom: '' };
  },
  keys(n, m, c, dt, moving, moveYaw, w) {
    const ch = n.ch;
    let bin = 8;
    if (moving) bin = ((Math.round(angDiff(c.yaw, moveYaw) / (Math.PI / 4)) % 8) + 8) % 8;
    // standing but want to face someone: a short tap toward them turns the body, like a person does
    if (!moving && w.face && ch.grounded && !ch.sit && m.tapCd <= 0 && ch.lockYaw === null) {
      const fy = Math.atan2(-(w.face.x - ch.x), -(w.face.z - ch.z));
      if (Math.abs(angDiff(ch.faceYaw, fy)) > 0.8) { bin = ((Math.round(angDiff(c.yaw, fy) / (Math.PI / 4)) % 8) + 8) % 8; m.tapN = rndi(3, 6); m.tapCd = 1.2; m.key = null; }
    }
    if (m.tapN > 0 && !moving) { m.tapN--; if (bin === 8 && m.key) bin = this.effBin(m.key); }
    else if (!moving) m.tapN = 0;
    let K = m.key, swap = !K || K.i >= K.c.n;
    if (K && !swap) {
      const cur = this.effBin(K);
      if (cur !== bin) { const dd = Math.abs(cur - bin) % 8, diff = cur === 8 || bin === 8 ? 4 : Math.min(dd, 8 - dd); if (diff >= 2 || K.i > (w.precise ? 2 : 9)) swap = true; }
    }
    if (swap) { K = m.key = Remix.pickKeys(bin); m.lab.keys = K ? `${BIN_NAMES[this.effBin(K)]} run${K.mirror ? ' · mirrored A↔D' : ''}${K.rot ? ' · rotated ' + K.rot * 90 + '°' : ''} · ${this.src(K.c)}` : (bin === 8 ? 'standing' : BIN_NAMES[bin] + ' (held)'); }
    let bits = 0;
    if (K) {
      const d = Remix.demoOf(K.c); bits = Remix.keyBits(d.k[K.c.s + Math.min(K.c.n - 1, Math.floor(K.i))], K.mirror, K.rot); K.i += dt * 60;
      if (w.precise) { const MAIN = [DK.W, DK.W | DK.A, DK.A, DK.S | DK.A, DK.S, DK.S | DK.D, DK.D, DK.W | DK.D, 0][bin]; bits = (bits & MAIN) | (bits & DK.SPACE ? 0 : 0); if (!bits && bin !== 8) bits = MAIN; }
      if (w.noHop) bits &= ~DK.SPACE;
    } else if (bin !== 8) bits = [DK.W, DK.W | DK.A, DK.A, DK.S | DK.A, DK.S, DK.S | DK.D, DK.D, DK.W | DK.D][bin];
    if (m.tapN === 0 && !moving && !(K && K.c.bin === 8)) { if (!m.tapCd || m.tapCd < 0.9) bits &= DK.SPACE; }
    if (m.jump > 0) { bits |= DK.SPACE; m.jump -= dt * 60; } else if (w.jump) { m.jump = Math.max(4, Remix.jumpHold()); bits |= DK.SPACE; }
    if (w.holdJump) bits |= DK.SPACE;
    const fw = (bits & DK.W ? 1 : 0) - (bits & DK.S ? 1 : 0), st = (bits & DK.D ? 1 : 0) - (bits & DK.A ? 1 : 0), y = c.yaw;
    let mx = -Math.sin(y) * fw + Math.cos(y) * st, mz = -Math.cos(y) * fw - Math.sin(y) * st; const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
    ch.input.mx = mx; ch.input.mz = mz; ch.input.jump = !!(bits & DK.SPACE);
    m.keys = bits;
  },
  turn(n, m, c, dt, gy, thr, locked) {
    let t = m.turn;
    if (t && t.i >= t.c.n) m.turn = t = null;
    if (!t && gy !== null) {
      const e = angDiff(c.yaw, gy);
      if (Math.abs(e) > thr) {
        t = m.turn = Remix.pickTurn(e, null, false);
        if (t) { const P = t.c.P; t.mp = Math.abs(P) < 1e-4 ? 1 : (c.pitch > 0.32 ? -1 : 1) * Math.sign(P); t.ts = rnd(0.9, 1.1); const deg = Math.round(Math.abs(t.c.Y * t.s) * 180 / Math.PI); m.lab.turn = `${deg}° ${t.c.Y * t.my > 0 ? 'left' : 'right'} turn (${locked ? 'mouse, locked' : 'right-drag'}) · from your ${t.c.how}${t.my < 0 ? ' · mirrored' : ''} ×${t.s.toFixed(2)} · ${this.src(t.c)}`; }
      }
    }
    if (t) {
      const d = Remix.demoOf(t.c), i0 = Math.floor(t.i); t.i += dt * 60 * (t.ts || 1); const i1 = Math.min(t.c.n, Math.floor(t.i));
      for (let q = i0; q < i1; q++) { c.yaw += d.dy[t.c.s + q] * t.my * t.s; c.pitch += d.dp[t.c.s + q] * t.mp * t.s; }
      c.pitch = clamp(c.pitch, locked ? -1.3 : -0.25, locked ? 1.3 : 0.85);
      m.rmb = !locked;
    } else m.rmb = false;
  },
  cursor(n, m, c, dt, w, locked, crowd) {
    if (locked) { c.cu = 0; c.cv = 0; m.lab.cur = c.tdist <= RBX.CAM_MIN + 0.01 ? 'first person: cursor locked' : 'shift lock: cursor locked'; return; }
    const asp = crowd.view.aspect, tanV = crowd.view.tanV;
    let goal = null, tol = 0.07;
    if (w.look) { const P = camPose(n, crowd.world, false), s = project(P, w.look, tanV); if (s && Math.abs(s.u) < asp * 0.46 && Math.abs(s.v) < 0.46) { goal = s; tol = Math.max(0.01, 1.2 / (s.z * 2 * tanV) * 0.5); } }
    if (!goal) {
      m.restT -= dt;
      if (m.restT <= 0) { m.restT = rnd(2, 7); const h = Remix.pickHold(); if (h) { const d = Remix.demoOf(h.c); m.restU = clamp(d.cu[h.c.s], -asp * 0.4, asp * 0.4); m.restV = clamp(d.cv[h.c.s], -0.4, 0.4); } }
      goal = { u: m.restU, v: m.restV };
    }
    let s = m.stroke;
    if (s && s.i >= s.c.n) m.stroke = s = null;
    if (!s) {
      const nu = goal.u - c.cu, nv = goal.v - c.cv;
      if (Math.hypot(nu, nv) > tol) { s = m.stroke = Remix.pickStroke(nu, nv, false); if (s) { s.ts = rnd(0.9, 1.12); m.hold = null; m.lab.cur = `flick ${(Math.hypot(s.c.U, s.c.V) * s.s * 100).toFixed(0)}% of the screen${s.mx < 0 || s.my < 0 ? ' · mirrored ' + (s.mx < 0 && s.my < 0 ? '↔↕' : s.mx < 0 ? '↔' : '↕') : ''} ×${s.s.toFixed(2)} · ${w.lookName ? 'onto ' + w.lookName : 'to rest'} · ${this.src(s.c)}`; } }
    }
    if (s) {
      const d = Remix.demoOf(s.c), i0 = Math.floor(s.i); s.i += dt * 60 * s.ts; const i1 = Math.min(s.c.n, Math.floor(s.i));
      for (let q = i0; q < i1; q++) { c.cu += d.du[s.c.s + q] * s.mx * s.s; c.cv += d.dv[s.c.s + q] * s.my * s.s; }
    } else {
      let h = m.hold; if (!h || h.i >= h.c.n) { h = m.hold = Remix.pickHold(); m.lab.cur = w.lookName ? `resting on ${w.lookName}` : 'resting (tremor)'; }
      if (h) { const d = Remix.demoOf(h.c), i0 = Math.floor(h.i); h.i += dt * 60; const i1 = Math.min(h.c.n, Math.floor(h.i)); for (let q = i0; q < i1; q++) { c.cu += d.du[h.c.s + q] * h.mx * 0.6; c.cv += d.dv[h.c.s + q] * h.my * 0.6; } }
    }
    c.cu = clamp(c.cu, -asp / 2, asp / 2); c.cv = clamp(c.cv, -0.5, 0.5);
    m.lmb = !!w.click;
  },
  zoom(n, m, c, dt) {
    m.zoomT -= dt;
    if (m.zoomT <= 0) { m.zoomT = rnd(8, 25); m.want = Remix.wantDist(false); }
    if (!m.zoom && m.want) {
      const r = Math.log(c.tdist / m.want);
      if (Math.abs(r) > Math.log(RBX.ZOOM) * 0.9 && !(m.want <= 0.6 && c.tdist <= RBX.CAM_MIN + 0.01)) { m.zoom = Remix.pickZoom(r > 0 ? -1 : 1); if (m.zoom) m.lab.zoom = `zoom ${r > 0 ? 'in' : 'out'} toward ${m.want <= 0.6 ? 'first person' : m.want.toFixed(0) + ' studs'} · ${m.zoom.c.notches.length} notches${m.zoom.flip < 0 ? ' · reversed' : ''} · ${this.src(m.zoom.c)}`; }
    }
    const z = m.zoom;
    if (z) {
      const prev = z.i; z.i += dt * 60;
      for (const [off, sg] of z.c.notches) {
        if (off < prev || off >= z.i) continue;
        const dir = sg * z.flip; notch(c, dir > 0); m.wheelT = 0.15; m.wheelDir = dir;
        if ((dir > 0 && c.tdist >= m.want * 0.92) || (dir < 0 && c.tdist <= Math.max(RBX.CAM_MIN + 0.01, m.want * 1.08))) { z.i = 1e9; break; }
      }
      if (z.i >= z.c.n) m.zoom = null;
    }
    c.fp = c.tdist <= RBX.CAM_MIN + 0.01; if (c.fp) c.shift = false;
  },
};

// ---------------------------------------------------------------- brain
const ACTS = ['wander', 'explore', 'social', 'follow', 'idle', 'afk', 'jumpy', 'sit', 'obby', 'pad', 'elevator', 'ball', 'button'];
class Brain {
  constructor(n, crowd) {
    this.n = n; this.crowd = crowd; this.act = null; this.route = null; this.hist = [];
    this.reroll();
    this.chatT = rnd(3, 15);
  }
  reroll() { const v = this.crowd.settings.variance; this.P = {}; for (const k of [...ACTS, 'linger', 'patience', 'grit', 'hop', 'crowdy']) this.P[k] = Math.pow(2, v * (Math.random() * 2 - 1) * 1.6); }
  get ch() { return this.n.ch; }
  others() { return this.crowd.everyone().filter(o => o !== this.n && !o.ch.dead); }
  chat() { }   // these NPCs don't talk: their only actions are walking, jumping and sitting
  label() { const a = this.act; if (!a) return 'thinking'; return a.text || a.kind; }
  // ------------------------------------------------------------ choosing
  choose() {
    const S = this.crowd.settings.weights, P = this.P, C = this.crowd, ch = this.ch;
    const others = this.others(), near = others.filter(o => Math.hypot(o.ch.x - ch.x, o.ch.z - ch.z) < this.crowd.settings.social);
    const freeSeat = C.seats.some(s => !s.occupant), w = {};
    for (const k of ACTS) w[k] = (S[k] || 0) * P[k];
    if (!near.length) { w.social = 0; w.follow = 0; }
    if (!freeSeat) w.sit = 0; if (!C.pads.length) w.pad = 0; if (!C.elevators.length) w.elevator = 0; if (!C.balls.length) w.ball = 0; if (!C.buttons.length) w.button = 0; if (!C.obby) w.obby = 0; if (!C.pois.length) w.explore = 0;
    const last = this.hist[this.hist.length - 1]; if (last && w[last] !== undefined && last !== 'wander') w[last] *= 0.35;   // don't do the same thing twice in a row
    const k = wpick(Object.entries(w)) || 'idle';
    this.start(k, near);
  }
  start(kind, near) {
    const n = this.n, ch = this.ch, C = this.crowd, P = this.P; this.hist.push(kind); if (this.hist.length > 6) this.hist.shift();
    this.route = null; n.emote = null; n.afk = false; ch.wantSit = false;
    const a = this.act = { kind, t: 0, step: 0, text: kind };
    switch (kind) {
      case 'wander': { const g = C.nav.randomSpot(ch.x, ch.z, rnd(15, 70), -1, 3) || C.nav.randomSpot(ch.x, ch.z, 40); if (!g) return this.done(); a.goal = g; a.linger = rnd(0.5, 4) * P.linger; a.text = 'wandering'; break; }
      case 'explore': {
        const ps = C.pois.filter(p => Math.hypot(p.x - ch.x, p.z - ch.z) > (p.r || 6) + 4);
        const p = wpick(ps.map(q => [q, (q.weight || 1) / (1 + Math.hypot(q.x - ch.x, q.z - ch.z) / 90)])); if (!p) return this.done();
        if (p.via && p.via.length) { const v = p.via.filter(k => k === 'pad' ? C.pads.length : k === 'elevator' ? C.elevators.length : true); if (v.length) { this.hist.pop(); return this.start(pick(v), near); } }   // somewhere you only get to by jump pad or elevator
        const g = C.nav.randomSpot(p.x, p.z, p.r || 6, p.minH === undefined ? -1e9 : p.minH, p.maxH === undefined ? 1e9 : p.maxH); if (!g) return this.done();
        a.poi = p; a.goal = g; a.linger = rnd(5, 16) * P.linger; a.text = 'exploring ' + p.name; this.chat('explore', p.name, 0.25); break;
      }
      case 'social': case 'follow': {
        const cand = (near && near.length ? near : this.others()).filter(o => o.ch && !o.ch.sit);
        const o = wpick(cand.map(x => [x, (x.isPlayer ? C.settings.playerBias : 1) * (1 + 0.4 * C.crowdAround(x, 10) * P.crowdy) / (1 + Math.hypot(x.ch.x - ch.x, x.ch.z - ch.z) / 20)])); if (!o) return this.done();
        a.who = o; a.text = (kind === 'follow' ? 'following ' : 'hanging out with ') + o.name; a.dur = kind === 'follow' ? rnd(15, 40) * P.patience : rnd(5, 14) * P.linger; a.ang = Math.random() * Math.PI * 2; a.r = rnd(3, 6); break;
      }
      case 'idle': a.dur = rnd(2, 8) * P.linger; a.text = 'idling'; a.hopT = rnd(1, 6); break;
      case 'afk': a.dur = rnd(15, 45); a.text = 'AFK'; this.chat('afk', null, 0.5); n.afk = true; break;
      case 'jumpy': a.mode = Math.random() < 0.5 ? 'spot' : 'hop'; a.dur = rnd(2, 6); if (a.mode === 'hop') { a.goal = C.nav.randomSpot(ch.x, ch.z, rnd(10, 30), -1, 3); if (!a.goal) a.mode = 'spot'; } a.text = a.mode === 'hop' ? 'bunny hopping' : 'jumping around'; break;
      case 'sit': { const seats = C.seats.filter(s => !s.occupant && !s.claim && (Math.abs(s.maxY - (ch.y - 3)) < 4 || C.nav.reachable((s.minX + s.maxX) / 2, s.maxY, (s.minZ + s.maxZ) / 2))); const s = wpick(seats.map(q => [q, 1 / (1 + Math.hypot((q.minX + q.maxX) / 2 - ch.x, (q.minZ + q.maxZ) / 2 - ch.z) / 30)])); if (!s) return this.done(); s.claim = n; a.seat = s; a.goal = { x: (s.minX + s.maxX) / 2, y: s.maxY, z: (s.minZ + s.maxZ) / 2 }; a.dur = rnd(6, 25) * P.patience; a.text = 'going to sit'; break; }
      case 'obby': { const o = C.obby; a.goal = o.start; a.text = 'going to the obby'; a.fails = 0; a.grit = Math.max(1, Math.round(2 * P.grit)); break; }
      case 'pad': { const p = pick(C.pads); a.pad = p; a.goal = { x: (p.minX + p.maxX) / 2, y: p.maxY, z: (p.minZ + p.maxZ) / 2 }; a.text = 'going to a jump pad'; break; }
      case 'elevator': { const e = pick(C.elevators); a.el = e; a.goal = e.wait; a.text = 'taking the elevator'; break; }
      case 'ball': { a.ball = pick(C.balls); a.kicks = rndi(2, 5); a.text = 'playing with the ball'; break; }
      case 'button': { const b = pick(C.buttons); a.btn = b; a.goal = { x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2 }; a.text = 'pressing the button'; this.chat('button', null, 0.3); break; }
    }
  }
  done(next) { const a = this.act; if (a && a.seat) a.seat.claim = null; this.act = null; this.route = null; this.n.emote = null; if (this.n.afk) { this.n.afk = false; this.chat('back', null, 0.4); } this.ch.wantSit = false; this.wait = rnd(0, 1.2); if (next) this.start(next); }
  followWho(who) { this.done(); this.wait = 0; this.hist.push('follow'); this.act = { kind: 'follow', t: 0, who, dur: rnd(15, 40) * this.P.patience, text: 'following ' + who.name }; }
  // hang around where we just got to (the top of something we rode or launched up to)
  lingerHere() { const ch = this.ch, p = this.crowd.pois.find(q => Math.hypot(q.x - ch.x, q.z - ch.z) < (q.r || 6) + 8 && (q.minH === undefined || ch.y - 3 >= q.minH - 1)); this.done(); this.wait = 0; this.hist.push('explore'); this.act = { kind: 'explore', t: 0, arrived: true, t2: 0, linger: rnd(8, 24) * this.P.linger, poi: p, text: 'hanging out at ' + (p ? p.name : 'the top'), goal: { x: ch.x, y: ch.y - 3, z: ch.z } }; if (p) this.chat('explore', p.name, 0.3); }
  command(kind, o) { this.done(); const a = this.act = { kind: 'cmd', t: 0, text: kind }; Object.assign(a, o); a.cmd = kind; }
  onDied() { const a = this.act; this.chat('died', null, 0.5); if (a && a.kind === 'obby') { a.fails++; a.step = 0; this.route = null; if (a.fails >= a.grit) { this.chat('obbyFail', null, 0.9); this.done(); } } else this.done(); }
  // ------------------------------------------------------------ steering along a route
  go(goal, o = {}) {
    const ch = this.ch, C = this.crowd, nav = C.nav;
    let r = this.route;
    if (!r || r.goal !== goal) r = this.route = { goal, path: null, i: 1, repT: 0, stuckT: 0, lx: ch.x, lz: ch.z, stuck: 0, fails: 0 };
    const feet = ch.y - 3;
    r.repT -= this.dt;
    if (!r.path || r.repT <= 0 && r.needRepath) {
      r.needRepath = false; r.repT = 1.5;
      if (C.pathBudget-- <= 0) return 'wait';
      r.path = nav.inside(ch.x, ch.z) && nav.inside(goal.x, goal.z) ? nav.path(ch.x, feet, ch.z, goal.x, goal.y, goal.z, 12000, o.minH === undefined ? -1e9 : o.minH) : [{ x: ch.x, y: feet, z: ch.z, kind: 0 }, Object.assign({ kind: 0 }, goal)];
      r.i = 1; if (!r.path) { r.fails++; return r.fails > 2 ? 'failed' : 'wait'; }
      if (r.path.length < 2) return 'arrived';
    }
    const P = r.path; if (r.i >= P.length) return 'arrived';
    const wp = P[r.i], last = r.i === P.length - 1, dx = wp.x - ch.x, dz = wp.z - ch.z, d = Math.hypot(dx, dz);
    const arriveR = last ? (o.r || 1.6) : (wp.kind === 3 || (P[r.i + 1] && P[r.i + 1].kind === 3) ? 0.9 : 1.6);
    if (d < arriveR && Math.abs(feet - wp.y) < 2.6) { r.i++; if (r.i >= P.length) return 'arrived'; return this.go(goal, o); }
    const w = this.n.wish; w.mx = dx / (d || 1); w.mz = dz / (d || 1);
    // jumps
    if (wp.kind === 1 && d < 3.2 && ch.grounded) w.jump = true;
    if (wp.kind === 3 && ch.grounded) { const tk = P[r.i - 1], td = Math.hypot(tk.x - ch.x, tk.z - ch.z); const past = (ch.x - tk.x) * dx + (ch.z - tk.z) * dz > 0; if (td < 1.0 || past) w.jump = true; }
    w.precise = P.slice(r.i, r.i + 3).some(p => p.kind === 1 || p.kind === 3) || o.precise;
    w.noHop = w.precise;
    // fell off the route: plan again
    if (ch.grounded && feet < wp.y - 3 && wp.kind !== 2 && (!P[r.i - 1] || feet < P[r.i - 1].y - 3)) { r.needRepath = true; r.repT = 0; }
    // stuck: hop, then re-plan, then give up
    r.stuckT += this.dt;
    if (r.stuckT > 1.5) {
      const moved = Math.hypot(ch.x - r.lx, ch.z - r.lz); r.lx = ch.x; r.lz = ch.z; r.stuckT = 0;
      if (moved < 1.2) { r.stuck++; w.jump = true; if (r.stuck >= 2) { r.needRepath = true; r.repT = 0; } if (r.stuck >= 5) return 'failed'; } else r.stuck = 0;
    }
    return 'moving';
  }
  // ------------------------------------------------------------ per frame
  update(dt) {
    this.dt = dt; const n = this.n, ch = this.ch, w = n.wish;
    w.mx = w.mz = 0; w.jump = false; w.precise = false; w.noHop = false; w.holdJump = false; w.face = null; w.click = false;
    if (ch.dead) return;
    // drift the gaze: look at people nearby, things, or ahead
    this.lookT = (this.lookT || 0) - dt;
    if (this.lookT <= 0) { this.lookT = rnd(1.5, 5); const o = this.others().filter(x => Math.hypot(x.ch.x - ch.x, x.ch.z - ch.z) < 25); if (o.length && Math.random() < 0.55) { this.gaze = pick(o); this.gazeP = null; } else { this.gaze = null; this.gazeP = Math.random() < 0.5 ? null : { x: ch.x + rnd(-30, 30), y: ch.y + rnd(-3, 6), z: ch.z + rnd(-30, 30) }; } }
    w.look = this.gaze && !this.gaze.ch.dead ? { x: this.gaze.ch.x, y: this.gaze.ch.y + 1.5, z: this.gaze.ch.z } : this.gazeP; w.lookName = this.gaze ? this.gaze.name : '';
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.act) { this.choose(); if (!this.act) return; }
    const a = this.act; a.t += dt;
    if (a.t > 90 && a.kind !== 'cmd') return this.done();
    this['do_' + (a.kind === 'cmd' ? 'cmd' : a.kind)](a, dt);
  }
  arriveThen(a, fn) { const s = this.go(a.goal, { r: a.r || 1.6 }); if (s === 'failed') { this.chat('lost', null, 0.15); this.done(); return; } if (s === 'arrived') { a.arrived = true; fn(); } }
  lookAround(a) { const w = this.n.wish; if (!this.gaze && Math.random() < this.dt * 0.4) this.lookT = 0; if (this.P.jumpy > 1.4 && Math.random() < this.dt * 0.3) w.jump = true; }
  do_wander(a) { if (!a.arrived) this.arriveThen(a, () => { a.t2 = 0; }); else { a.t2 += this.dt; this.lookAround(a); if (a.t2 > a.linger) this.done(); } if (!a.arrived && this.P.hop > 1.6) this.n.wish.holdJump = Math.random() < 0.3; }
  do_explore(a) { if (!a.arrived) this.arriveThen(a, () => { a.t2 = 0; }); else { a.t2 += this.dt; this.lookAround(a); if (a.t2 > a.linger) this.done(); } }
  do_social(a) {
    const o = a.who, ch = this.ch, w = this.n.wish; if (!o || o.ch.dead) return this.done();
    const d = Math.hypot(o.ch.x - ch.x, o.ch.z - ch.z);
    w.face = o.ch; w.look = { x: o.ch.x, y: o.ch.y + 1.5, z: o.ch.z }; w.lookName = o.name; this.gaze = o;
    if (!a.near) {
      if (d < a.r + 1.5) { a.near = true; a.t2 = 0; return; }
      const g = { x: o.ch.x + Math.cos(a.ang) * a.r, y: o.ch.y - 3, z: o.ch.z + Math.sin(a.ang) * a.r };
      if (!a.g || Math.hypot(g.x - a.g.x, g.z - a.g.z) > 4) a.g = g;
      if (this.go(a.g, { r: 1.5 }) === 'failed' || a.t > 30) return this.done();
      return;
    }
    a.t2 += this.dt;
    if (d > 12) { if (Math.random() < 0.5 * this.P.follow) { this.followWho(o); this.chat('follow', null, 0.4); } else this.done(); return; }
    if (a.t2 > a.dur) { if (Math.random() < 0.3 * this.P.follow) this.followWho(o); else this.done(); }
  }
  do_follow(a) {
    const o = a.who, ch = this.ch, w = this.n.wish; if (!o || o.ch.dead) return this.done();
    const d = Math.hypot(o.ch.x - ch.x, o.ch.z - ch.z); w.look = { x: o.ch.x, y: o.ch.y + 1.5, z: o.ch.z }; w.lookName = o.name; this.gaze = o;
    if (d > 90 || a.t > a.dur) return this.done();
    if (d > 8 || Math.abs(o.ch.y - ch.y) > 4) { const g = { x: o.ch.x, y: o.ch.y - 3, z: o.ch.z }; if (!a.g || Math.hypot(g.x - a.g.x, g.z - a.g.z) > 3 || Math.abs(g.y - a.g.y) > 2) a.g = g; if (this.go(a.g, { r: 4.5 }) === 'failed') return this.done(); if (o.ch.vy > 20 && d < 10 && ch.grounded) w.jump = Math.random() < 0.5; }
    else { this.route = null; w.face = o.ch; if (Math.random() < this.dt * 0.08) this.chat('follow', null, 0.5); }
  }
  do_idle(a) { this.lookAround(a); a.hopT -= this.dt; if (a.hopT <= 0) { a.hopT = rnd(2, 8) / this.P.jumpy; this.n.wish.jump = Math.random() < 0.5; } if (a.t > a.dur) this.done(); }
  do_afk(a) { if (a.t > a.dur) this.done(); }
  do_jumpy(a) { const w = this.n.wish; if (a.mode === 'spot') { w.holdJump = true; if (a.t > a.dur) this.done(); } else { w.holdJump = true; const s = this.go(a.goal); if (s !== 'moving') this.done(); } }
  do_sit(a) {
    const ch = this.ch, s = a.seat;
    if (s.occupant && s.occupant !== ch) return this.done();
    if (ch.sit === s) { a.text = 'sitting'; if (!a.sat) { a.sat = a.t; this.chat('sit', null, 0.15); } this.lookAround(a); if (a.t - a.sat > a.dur) { this.n.wish.jump = true; this.done(); } return; }
    ch.wantSit = true;
    const st = this.go(a.goal, { r: 0.6 }); if (st === 'failed') return this.done();
    if (st === 'arrived' && !ch.sit) { const w = this.n.wish; const dx = a.goal.x - ch.x, dz = a.goal.z - ch.z; if (Math.hypot(dx, dz) > 0.3) { w.mx = dx; w.mz = dz; w.precise = true; } else if (ch.grounded && ch.y - 3 < s.maxY - 0.5) w.jump = true; if (a.t > 25) this.done(); }
  }
  do_obby(a) {
    const o = this.crowd.obby, ch = this.ch;
    if (a.step === 0) { a.goal = o.start; a.text = 'going to the obby'; const s = this.go(o.start, { r: 2 }); if (s === 'arrived') { a.step = 1; this.route = null; a.text = 'doing the obby (fails: ' + a.fails + ')'; } else if (s === 'failed') this.done(); return; }
    if (a.step === 1) { a.goal = o.end; const s = this.go(o.end, { r: 2.5, precise: true, minH: o.minH === undefined ? o.start.y - 1 : o.minH }); this.n.wish.precise = true; if (s === 'arrived') this.done(); else if (s === 'failed') { a.fails++; this.route = null; if (a.fails >= a.grit) { this.chat('obbyFail', null, 0.9); this.done(); } } }
  }
  do_pad(a) { const ch = this.ch; if (!a.launched) { const s = this.go(a.goal, { r: 0.8 }); if (s === 'failed') return this.done(); if (ch.vy > 40) { a.launched = true; a.t = 0; this.chat('pad', null, 0.5); } if (s === 'arrived' && ch.grounded) { const w = this.n.wish; w.mx = a.goal.x - ch.x; w.mz = a.goal.z - ch.z; } } else { const to = a.pad.data && a.pad.data.to; if (to && !ch.grounded) { const w = this.n.wish, dx = to.x - ch.x, dz = to.z - ch.z, d = Math.hypot(dx, dz); if (d > 1.5) { w.mx = dx / d; w.mz = dz / d; } } if (ch.grounded && a.t > 0.5) { if (ch.y - 3 > 4) this.lingerHere(); else { this.chat(pick(['missed lol', 'bruh', 'again!']), null, 0.3); this.done(); } } } }
  do_elevator(a) {
    const e = a.el, ch = this.ch, p = e.part, w = this.n.wish, cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
    if (a.step === 0) { const s = this.go(e.wait, { r: 1.5 }); if (s === 'arrived') { a.step = 1; a.text = 'waiting for the elevator'; } else if (s === 'failed') this.done(); return; }
    if (a.step === 1) { w.look = { x: cx, y: p.maxY, z: cz }; if (Math.abs(p.maxY - e.bottom) < 0.4 && p.vy >= 0) a.step = 2; if (a.t > 40) this.done(); return; }
    if (a.step === 2) { const dx = cx - ch.x, dz = cz - ch.z, d = Math.hypot(dx, dz); if (d > 1) { w.mx = dx / d; w.mz = dz / d; w.precise = true; } if (ch.grounded && ch.ground === p) { a.step = 3; a.text = 'riding the elevator up'; this.chat('elevator', null, 0.3); } else if (p.maxY - e.bottom > 2) { a.step = 1; } return; }
    if (a.step === 3) { if (ch.ground !== p && ch.grounded) { if (ch.y - 3 < e.bottom + 2) a.step = 1; return; } if (Math.abs(p.maxY - e.top) < 0.5) { a.step = 4; this.route = null; } return; }
    if (a.step === 4) { const s = this.go(e.exit, { r: 2 }); a.text = 'getting off at the top'; if (s === 'arrived') this.lingerHere(); else if (s === 'failed') this.done(); }
  }
  do_ball(a) {
    const b = a.ball, ch = this.ch, w = this.n.wish; w.look = { x: b.x, y: b.y, z: b.z }; w.lookName = 'the ball';
    if (!a.dir || a.phase === 'kick' && a.kt > 1.4) { a.dir = Math.random() * Math.PI * 2; a.phase = 'line'; a.kt = 0; if (a.kicks-- <= 0) { this.chat('ball', null, 0.3); return this.done(); } }
    const bx = b.x - Math.cos(a.dir) * 4, bz = b.z - Math.sin(a.dir) * 4;
    if (a.phase === 'line') { const g = { x: bx, y: Math.max(0, b.y - b.r), z: bz }; if (!a.g || Math.hypot(a.g.x - g.x, a.g.z - g.z) > 2) a.g = g; const s = this.go(a.g, { r: 1.5 }); if (s === 'arrived') { a.phase = 'kick'; a.kt = 0; } else if (s === 'failed') this.done(); }
    else { a.kt += this.dt; const dx = b.x - ch.x, dz = b.z - ch.z, d = Math.hypot(dx, dz) || 1; w.mx = dx / d; w.mz = dz / d; }
    if (a.t > 40) this.done();
  }
  do_button(a) { if (!a.arrived) this.arriveThen(a, () => { a.t2 = 0; }); else { a.t2 += this.dt; if (a.t2 > 1.5) this.done(); } }
  do_cmd(a) {
    const ch = this.ch, w = this.n.wish;
    if (a.cmd === 'gather') { if (!a.arrived) { a.goal = a.goal || a.at; this.arriveThen(a, () => { a.t2 = 0; a.text = 'gathered'; }); if (a.t > 40) this.done(); } else { a.t2 += this.dt; this.lookAround(a); if (a.t2 > a.stay) this.done(); } }
    else if (a.cmd === 'scatter') { if (!a.goal) a.goal = this.crowd.nav.randomSpot(ch.x + rnd(-120, 120), ch.z + rnd(-120, 120), 20, -1, 3); if (!a.goal) return this.done(); this.arriveThen(a, () => this.done()); }
    else if (a.cmd === 'follow') { this.act = { kind: 'follow', t: 0, who: a.who, dur: a.dur || 40, text: 'following ' + a.who.name }; }
    else this.done();
  }
}

// ---------------------------------------------------------------- crowd
const DEFAULT_WEIGHTS = { wander: 1.0, explore: 0.9, social: 1.0, follow: 0.35, idle: 0.6, afk: 0.12, jumpy: 0.35, sit: 0.45, obby: 0.35, pad: 0.3, elevator: 0.25, ball: 0.3, button: 0.15 };
let NPC_SEQ = 0;
class Crowd {
  constructor(world, nav, o = {}) {
    this.world = world; this.nav = nav; this.spawn = o.spawn || { x: 0, y: 4, z: 0 };
    this.pois = o.pois || []; this.obby = o.obby || null; this.elevators = o.elevators || []; this.balls = o.balls || [];
    this.seats = world.parts.filter(p => p.kind === 'seat'); this.pads = world.parts.filter(p => p.kind === 'pad' && !p.noAI); this.buttons = world.parts.filter(p => p.kind === 'button');
    this.settings = { weights: Object.assign({}, DEFAULT_WEIGHTS, o.weights || {}), chat: 0, variance: 0.7, hands: 'remix', social: 60, playerBias: 1.5, rate: 240, ...(o.settings || {}) };
    this.npcs = []; this.others = []; this.view = { tanV: Math.tan(35 * Math.PI / 180), aspect: 16 / 9 }; this.time = 0;
    this.onSay = o.onSay || null; this.onAdd = o.onAdd || null; this.onRemove = o.onRemove || null;
    this.timing = { brain: 0, hands: 0, physics: 0, steps: 0 };
    if (!Remix.lib) Remix.rebuild();
    if (o.reach !== false) nav.computeReach(this.spawn.x, this.spawn.y - 3, this.spawn.z);
  }
  everyone() { return this.npcs.concat(this.others); }
  crowdAround(who, r) { let c = 0; for (const o of this.everyone()) if (o !== who && Math.hypot(o.ch.x - who.ch.x, o.ch.z - who.ch.z) < r) c++; return c; }
  add() {
    const used = new Set(this.everyone().map(n => n.name));
    const s = this.spawn, ch = makeCharacter(s.x + rnd(-5, 5), s.y, s.z + rnd(-5, 5), { id: ++NPC_SEQ, yaw: Math.random() * 6.28 });
    ch.spawn = s;
    const n = { id: ch.id, name: makeName(used), ch, look: makeLook(), cam: { yaw: ch.faceYaw, pitch: 0.32, dist: 12.5, tdist: 12.5, fp: false, shift: false, cu: rnd(-0.1, 0.1), cv: rnd(-0.08, 0.04) }, motor: Hands.fresh(), wish: { mx: 0, mz: 0, jump: false }, emote: null, afk: false, chat: null, isNPC: true };
    n.brain = new Brain(n, this); n.brain.wait = rnd(0, 2);
    n.pose = () => poseOf(n);
    this.npcs.push(n); if (this.onAdd) this.onAdd(n);
    return n;
  }
  remove(n) { if (n.ch.sit) { n.ch.sit.occupant = null; } if (n.brain.act && n.brain.act.seat) n.brain.act.seat.claim = null; this.npcs = this.npcs.filter(x => x !== n); for (const o of this.npcs) if (o.brain.act && o.brain.act.who === n) o.brain.done(); if (this.onRemove) this.onRemove(n); }
  setCount(k) { while (this.npcs.length < k) this.add(); while (this.npcs.length > k) this.remove(this.npcs[this.npcs.length - 1]); }
  say(n, text) { n.chat = { text, t: 5 + text.length * 0.08 }; if (this.onSay) this.onSay(n, text); }
  // commands from the host (a sandbox, a quest, a cutscene...)
  gather(at, who) { for (const n of who || this.npcs) n.brain.command('gather', { at: this.nav.randomSpot(at.x, at.z, 8 + Math.sqrt(this.npcs.length) * 1.5, at.y - 3, at.y + 3) || at, stay: rnd(15, 30), text: 'gathering' }); }
  scatter(who) { for (const n of who || this.npcs) n.brain.command('scatter', { text: 'scattering' }); }
  follow(target, who) { for (const n of who || this.npcs) n.brain.command('follow', { who: target, dur: rnd(30, 60) }); }
  respawnAll() { for (const n of this.npcs) { respawn(n.ch); n.brain.done(); } }
  // once a frame. others: [{ name, ch, isPlayer }] (players and anything else the NPCs should notice and bump into)
  update(dt, others = []) {
    this.time += dt; this.others = others; this.pathBudget = 2;
    const t0 = performance.now();
    for (const n of this.npcs) n.brain.update(dt);
    const t1 = performance.now();
    for (const n of this.npcs) Hands.drive(n, dt, this);
    const t2 = performance.now();
    const chars = this.npcs.map(n => n.ch).concat(others.map(o => o.ch));
    const steps = stepAll(chars, this.world, dt, this.settings.rate);
    const t3 = performance.now();
    for (const n of this.npcs) {
      if (n.chat && (n.chat.t -= dt) <= 0) n.chat = null;
      for (const e of n.ch.events) if (e === 'died') n.brain.onDied();
      n.ch.events.length = 0;
    }
    const k = 0.1; this.timing.brain += (t1 - t0 - this.timing.brain) * k; this.timing.hands += (t2 - t1 - this.timing.hands) * k; this.timing.physics += (t3 - t2 - this.timing.physics) * k; this.timing.steps = steps;
  }
}
// what the renderer should show for an NPC (or any character with ch)
function poseOf(n) {
  const ch = n.ch; if (ch.dead) return { kind: 'dead' };
  if (ch.sit) return { kind: 'sit' };
  if (!ch.grounded) return { kind: 'air' };
  const sp = Math.hypot(ch.vx, ch.vz);
  if (sp > 0.5) return { kind: 'walk', speed: sp };
  return { kind: 'idle' };
}

root.Ambient = Object.assign({}, root.AmbientCore, root.AmbientNav, root.AmbientHands, { Crowd, Brain, Hands, camPose, project, poseOf, makeName, makeLook, LINES, DEFAULT_WEIGHTS, ACTS });
})(typeof window !== 'undefined' ? window : globalThis);


