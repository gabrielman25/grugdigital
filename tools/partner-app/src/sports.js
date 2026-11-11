/* =====================================================================================
   GAMES: three swipe-to-shoot games on the Arena worlds
   Each sport gives: reset (place the ball for this level), vel (swipe -> launch velocity), step (physics + judging),
   camera poses, and a shop that uses the Grug kit's shop shape {id,name,desc,cost,effect,amount,icon}.
   ===================================================================================== */
const GAMES = {
  football: { name: 'Field Goal Frenzy', short: 'Football', icon: 'american_football', line: 'Swipe up to kick it through the uprights.', unit: 'Kick',
    shop: [
      { id: 'wide', name: 'Wide Uprights', desc: 'Posts sit 35% farther apart', cost: 60, effect: 'wide', amount: 1.35, icon: 'expand' },
      { id: 'calm', name: 'Calm Skies', desc: 'No wind for the whole run', cost: 40, effect: 'calm', amount: 1, icon: 'wind' },
      { id: 'boot', name: 'Golden Boot', desc: 'Every kick scores double', cost: 90, effect: 'mult', amount: 2, icon: 'stars' },
      { id: 'time', name: 'Overtime', desc: '15 extra seconds on the clock', cost: 50, effect: 'time', amount: 15, icon: 'stopwatch' }] },
  soccer: { name: 'Penalty Kings', short: 'Soccer', icon: 'football', line: 'Swipe to shoot. Curve your swipe to bend it.', unit: 'Spot',
    shop: [
      { id: 'wide', name: 'Wide Goal', desc: 'The goal is 25% wider', cost: 60, effect: 'wide', amount: 1.25, icon: 'expand' },
      { id: 'guide', name: 'Aim Guide', desc: 'See where your shot will go', cost: 50, effect: 'guide', amount: 1, icon: 'reticle' },
      { id: 'boot', name: 'Golden Boot', desc: 'Every goal scores double', cost: 90, effect: 'mult', amount: 2, icon: 'stars' },
      { id: 'time', name: 'Overtime', desc: '15 extra seconds on the clock', cost: 50, effect: 'time', amount: 15, icon: 'stopwatch' }] },
  basketball: { name: 'Buzzer Beater', short: 'Basketball', icon: 'basketball', line: 'Swipe up to shoot. Stop the meter in the green.', unit: 'Spot',
    shop: [
      { id: 'wide', name: 'Big Rim', desc: 'The rim is 20% wider', cost: 60, effect: 'wide', amount: 1.2, icon: 'expand' },
      { id: 'guide', name: 'Aim Guide', desc: 'See the arc before you shoot', cost: 50, effect: 'guide', amount: 1, icon: 'reticle' },
      { id: 'boot', name: 'Hot Hand', desc: 'Every basket scores double', cost: 90, effect: 'mult', amount: 2, icon: 'fire' },
      { id: 'time', name: 'Overtime', desc: '15 extra seconds on the clock', cost: 50, effect: 'time', amount: 15, icon: 'stopwatch' }] }
};
const GAME_IDS = ['football', 'soccer', 'basketball'];

const SPORT = (() => {
  const T = T3, V = (x, y, z) => new T.Vector3(x, y, z), DEG = Math.PI / 180, g = 9.8;
  const B = { p: V(0, 0, 0), v: V(0, 0, 0), live: false, judged: false, r: .14, spin: 0, t: 0 };
  const lerpV = (a, b, t) => a.clone().lerp(b, t);
  function heading(fromX, fromZ, off) { const base = Math.atan2(-fromX, fromZ); return base + off; }   // 0 = straight at -z
  const dirOf = (yaw) => V(Math.sin(yaw), 0, -Math.cos(yaw));

  const football = {
    reset(w, G) {
      G.yards = Math.min(55, 20 + 5 * G.level); const D = G.yards * .9144;
      const bx = G.level >= 3 ? [-3, 0, 3][G.shots % 3] : 0;
      G.hw = 2.82 * (G.pu.wide ? 1.35 : 1); w.posts.setW(G.hw);
      const mx = Math.min(3.4, .5 + .32 * G.level); G.wind = G.pu.calm ? 0 : Math.round((Math.random() * 2 - 1) * mx * 10) / 10;
      G.ring = null; if (G.shots >= 2 && Math.random() < .6) { G.ring = { x: (Math.random() * 2 - 1) * (G.hw - 1.1), y: 4.4 + Math.random() * 2.4, mv: G.level >= 4 ? .8 + Math.random() * .8 : 0, ph: Math.random() * 6 }; G.ring.x0 = G.ring.x; }
      B.r = .14; B.p.set(bx, .2, D); B.v.set(0, 0, 0);
      G.home = { pos: V(bx * .55, 2.35, D + 5.6), look: V(bx * .08, 4.5, 0) };
      return G.yards + ' yd';
    },
    vel(sw, G) {
      const p = clamp(sw.len / (sw.H * .42), .15, 1.1), v = 13 + p * 18, el = 38 * DEG; G.pow = p;
      const yaw = heading(B.p.x, B.p.z, clamp(sw.ang * .55, -.5, .5)), d = dirOf(yaw);
      return V(d.x * v * Math.cos(el), v * Math.sin(el), d.z * v * Math.cos(el));
    },
    accel(G, v, out) { out.set(G.wind * 1.15, -g, 0); return out; },
    step(dt, w, G, ev) {
      const n = 4, h = dt * 1.15 / n, a = V(0, 0, 0);
      for (let i = 0; i < n; i++) {
        const pz = B.p.z, px = B.p.x, py = B.p.y;
        this.accel(G, B.v, a); B.v.addScaledVector(a, h); B.p.addScaledVector(B.v, h);
        if (!B.judged && pz > 0 && B.p.z <= 0) { const f = pz / (pz - B.p.z); judge(lerp(px, B.p.x, f), lerp(py, B.p.y, f)); }
        if (B.p.z < -15) { const top = Math.floor(-15 - B.p.z) + 1; if (B.p.y < top + B.r) { B.p.y = top + B.r; B.v.multiplyScalar(.25); B.v.y = Math.abs(B.v.y); } }
        if (B.p.y < B.r) { B.p.y = B.r; if (!B.judged) ev.miss('SHORT', 'Needs more leg'); if (Math.abs(B.v.y) > 1) ev.bounce(); B.v.y = Math.abs(B.v.y) * .35; B.v.x *= .6; B.v.z *= .6; }
      }
      function judge(x, y) {
        const hw = G.hw, BAR = 3.05;
        const up = Math.abs(Math.abs(x) - hw) < .26 && y > BAR - .15 && y < 9.3, bar = Math.abs(y - BAR) < .26 && Math.abs(x) < hw + .2;
        if (up || bar) { B.v.z *= -.28; B.v.x = (x > 0 ? 1 : -1) * (2 + Math.random() * 3) * (up ? 1 : .3); B.v.y = bar ? Math.abs(B.v.y) * .5 : B.v.y * .5; ev.doink(V(x, y, 0)); ev.miss('DOINK!', 'Off the ' + (bar ? 'crossbar' : 'upright')); return; }
        if (Math.abs(x) < hw && y > BAR) {
          const bull = G.ring && Math.hypot(x - G.ring.x, y - G.ring.y) < 1.0;
          ev.make({ label: bull ? 'BULLSEYE!' : "IT'S GOOD!", base: 100 + (G.yards - 20) * 6, bull, at: V(x, y, 0), jumbo: bull ? 'BULLSEYE' : "IT'S GOOD" });
        } else ev.miss(y <= BAR ? 'NO GOOD' : x < 0 ? 'WIDE LEFT' : 'WIDE RIGHT', y <= BAR ? 'Under the bar' : '');
      }
    },
    camFly(G, out) {   // chase the ball, but never past the 10 m mark so the posts stay in view
      const z = Math.max(12, G.home.pos.z - 9, Math.min(G.home.pos.z, B.p.z + 7));
      out.pos.set(lerp(G.home.pos.x, B.p.x, .5), Math.max(G.home.pos.y, B.p.y * .55 + 1.6), z);
      out.look.copy(lerpV(G.home.look, B.p, .25));
    },
    animate(dt, w, G, t) {
      const fl = [w.posts.fL, w.posts.fR], k = clamp(G.wind / 3.4, -1, 1);
      fl.forEach((f, i) => { f.rotation.y = (k >= 0 ? 0 : Math.PI) + Math.sin(t * 6 + i) * .15 * (1 - Math.abs(k) * .5); f.rotation.z = -(1 - Math.abs(k)) * .9 + Math.sin(t * 9 + i) * .05; });
      if (G.ring) { const r = G.ring; if (r.mv) r.x = r.x0 + Math.sin(t * r.mv + r.ph) * Math.min(1.2, Math.max(.3, G.hw - 1.1 - Math.abs(r.x0))); w.coin.visible = w.coinGlow.visible = !r.hit; w.coin.position.set(r.x, r.y, 0); w.coinGlow.position.set(r.x, r.y, -.1); w.coin.rotation.y = Math.sin(t * 1.8) * .5; }
      else w.coin.visible = w.coinGlow.visible = false;
    }
  };

  const SOC_SPOTS = [[0, 11], [-5, 13], [5, 13], [0, 17], [-9, 16], [9, 16], [0, 21], [-13, 19], [13, 19], [0, 25]];
  const soccer = {
    reset(w, G) {
      const s = SOC_SPOTS[Math.min(G.level, SOC_SPOTS.length - 1)]; G.spotI = G.level;
      G.hw = 3.66 * (G.pu.wide ? 1.25 : 1); w.goal.setW(G.hw); w.goal.bulge = null; w.goal.buildNet();
      B.r = .11; B.p.set(s[0], .11, s[1]); B.v.set(0, 0, 0); G.curve = 0;
      G.blk = G.level >= 2 ? { x0: (Math.random() * 2 - 1) * (G.hw - 1.2), amp: Math.min(G.hw - .9, 1.2 + G.level * .25), sp: .7 + G.level * .12, ph: Math.random() * 6, z: .9 } : null;
      w.blocker.visible = !!G.blk;
      G.ring = null; if (G.shots >= 1 && Math.random() < .75) { const sx = Math.random() < .5 ? -1 : 1; G.ring = { x: sx * (1.5 + Math.random() * (G.hw - 2.2)), y: .7 + Math.random() * 1.2 }; }
      const d = V(s[0], 0, s[1]).normalize();
      G.home = { pos: V(s[0] + d.x * 4.4, 1.75, s[1] + d.z * 4.4), look: V(s[0] * .1, 1.15, 0) };
      return Math.round(Math.hypot(s[0], s[1]) * 1.094) + ' yd';
    },
    vel(sw, G) {
      const p = clamp(sw.len / (sw.H * .5), 0, 1.1), el = (2 + p * 19) * DEG, v = 24; G.pow = p;
      const yaw = heading(B.p.x, B.p.z, clamp(sw.ang * .7, -.6, .6)), d = dirOf(yaw);
      G.curveNext = clamp(sw.curve * 1.6, -.5, .5);
      return V(d.x * v * Math.cos(el), v * Math.sin(el), d.z * v * Math.cos(el));
    },
    accel(G, v, out) { const vh = Math.hypot(v.x, v.z) || 1, c = (G.flyCurve != null ? G.flyCurve : G.curveNext) * 26; out.set(-v.z / vh * c, -g, v.x / vh * c); if (v.z > -1) out.x = out.z = 0; return out; },
    launched(G) { G.flyCurve = G.curveNext; },
    step(dt, w, G, ev) {
      const n = 4, h = dt / n, a = V(0, 0, 0), hw = G.hw, gh = 2.44, r = B.r;
      for (let i = 0; i < n; i++) {
        const pz = B.p.z, px = B.p.x, py = B.p.y;
        if (B.p.y > r + .01) { this.accel(G, B.v, a); B.v.addScaledVector(a, h); } else { B.v.x *= 1 - .7 * h; B.v.z *= 1 - .7 * h; }
        B.p.addScaledVector(B.v, h);
        if (G.blk && !B.judged && pz > G.blk.z && B.p.z <= G.blk.z) { const f = (pz - G.blk.z) / (pz - B.p.z), x = lerp(px, B.p.x, f), y = lerp(py, B.p.y, f); if (Math.abs(x - G.blk.x) < .85 + r && y < 1.9 + r) { B.v.z = Math.abs(B.v.z) * .35; B.v.x *= .4; ev.thud(); ev.miss('BLOCKED', 'The wall got it'); } }
        if (!B.judged && pz > 0 && B.p.z <= 0) {
          const f = pz / (pz - B.p.z), x = lerp(px, B.p.x, f), y = lerp(py, B.p.y, f);
          if (Math.abs(Math.abs(x) - hw) < r + .07 && y < gh + .06) { B.v.z = Math.abs(B.v.z) * .4; B.v.x = -B.v.x * .4 - Math.sign(x) * 2; ev.doink(V(x, y, 0)); ev.miss('OFF THE POST', 'So close'); }
          else if (Math.abs(y - gh) < r + .07 && Math.abs(x) < hw) { B.v.z = Math.abs(B.v.z) * .4; B.v.y = -Math.abs(B.v.y) * .4; ev.doink(V(x, y, 0)); ev.miss('OFF THE BAR', 'So close'); }
          else if (Math.abs(x) < hw - r && y < gh - r) { const bull = G.ring && Math.hypot(x - G.ring.x, y - G.ring.y) < .62; G.inNet = true; ev.make({ label: bull ? 'TOP BINS!' : 'GOAL!', base: 100 + G.level * 45, bull, at: V(x, y, 0), jumbo: bull ? 'TOP BINS' : 'GOAL!' }); }
          else ev.miss(y >= gh ? 'OVER THE BAR' : 'WIDE', '');
        }
        if (G.inNet && B.p.z < -1.55) { w.goal.bulge = { x: B.p.x, y: B.p.y, a: 1 }; B.p.z = -1.55; B.v.set(B.v.x * .1, Math.min(0, B.v.y) * .3, Math.abs(B.v.z) * .05); G.inNet = false; ev.net(); }
        if (B.p.z < -5.2 && B.p.y < 1.1) { B.p.z = -5.2; B.v.z = Math.abs(B.v.z) * .3; }
        if (B.p.y < r) { B.p.y = r; if (Math.abs(B.v.y) > 1.5) { B.v.y = Math.abs(B.v.y) * .45; ev.bounce(); } else B.v.y = 0; }
      }
    },
    camFly(G, out) { out.pos.copy(G.home.pos).lerp(V(B.p.x * .6, 1.8, Math.max(B.p.z + 4, 7)), .35); out.look.copy(lerpV(G.home.look, B.p, .2)); },
    animate(dt, w, G, t) {
      if (G.blk) { G.blk.x = G.blk.x0 + Math.sin(t * G.blk.sp + G.blk.ph) * G.blk.amp; G.blk.x = clamp(G.blk.x, -G.hw + .85, G.hw - .85); w.blocker.position.set(G.blk.x, .95, G.blk.z); }
      if (G.ring) { w.coin.visible = w.coinGlow.visible = !G.ring.hit; w.coin.position.set(G.ring.x, G.ring.y, .08); w.coinGlow.position.set(G.ring.x, G.ring.y, -.05); w.coin.rotation.y = Math.sin(t * 2) * .5; } else w.coin.visible = w.coinGlow.visible = false;
      const b = w.goal.bulge; if (b && b.a > 0) { b.a = Math.max(0, b.a - dt * 1.6); w.goal.buildNet(); }
    }
  };

  const BB_SPOTS = [[2.6, 0, 'Close'], [4.2, 0, 'Free throw'], [4.6, -35, 'Elbow'], [4.6, 35, 'Elbow'], [5.6, -62, 'Wing'], [5.6, 62, 'Wing'], [6.75, 0, 'Three'], [6.75, -45, 'Three'], [6.75, 45, 'Three'], [6.6, -84, 'Corner 3'], [6.6, 84, 'Corner 3']];
  const RIM = V(0, 3.05, 0), REL_Y = 1.75; let AIMZ = .03;
  const basketball = {
    reset(w, G) {
      const s = BB_SPOTS[Math.min(G.level, BB_SPOTS.length - 1)], a = s[1] * DEG, d = s[0];
      const sx = d * Math.sin(a), sz = d * Math.cos(a);
      G.R = .2286 * (G.pu.wide ? 1.2 : 1); w.hoop.setR(G.R);
      G.money = G.shots % 5 === 4; G.touch = 0; G.board = 0; G.peak = false; G.flyT = 0;
      const toward = V(-sx, 0, -sz).normalize();
      B.r = .12; B.p.set(sx + toward.x * .3, REL_Y, sz + toward.z * .3); B.v.set(0, 0, 0);
      G.home = { pos: V(sx - toward.x * 2.5, 2.05, sz - toward.z * 2.5), look: V(0, 2.75, 0) };
      G.spotName = s[2]; G.dist = d;
      return s[2];
    },
    need() {   // speed that drops the ball into the middle of the rim at 52 degrees
      const dx = -B.p.x, dz = -B.p.z - AIMZ, d = Math.hypot(dx, dz), hgt = RIM.y + .02 - B.p.y, th = this.th() * DEG;
      return Math.sqrt(g * d * d / (2 * Math.cos(th) ** 2 * (d * Math.tan(th) - hgt)));
    },
    vel(sw, G) {
      const p = clamp(sw.len / (sw.H * .46), 0, 1.15); G.pow = p;
      const f = 1 + (p - .51) * .18, v = this.need() * f, th = this.th() * DEG;
      let a = sw.ang; a = Math.abs(a) < .07 ? 0 : (a - Math.sign(a) * .07) * .35;
      const yaw = heading(B.p.x, B.p.z, clamp(a, -.4, .4)), d = dirOf(yaw);
      return V(d.x * v * Math.cos(th), v * Math.sin(th), d.z * v * Math.cos(th));
    },
    th() { return Math.hypot(B.p.x, B.p.z) < 3.5 ? 62 : 53; },
    sweet: [.45, .57],
    accel(G, v, out) { return out.set(0, -g, 0); },
    step(dt, w, G, ev) {
      const n = 8, h = dt / n, R = G.R, r = B.r, tube = .018, bz = -.375;
      G.flyT += dt;
      for (let i = 0; i < n; i++) {
        const py = B.p.y;
        B.v.y -= g * h; B.p.addScaledVector(B.v, h);
        if (B.v.y < 0) G.peak = true;
        // rim: closest point on the ring
        const vx = B.p.x - RIM.x, vz = B.p.z - RIM.z, hl = Math.hypot(vx, vz) || 1e-6;
        const q = V(RIM.x + vx / hl * R, RIM.y, RIM.z + vz / hl * R), dd = B.p.clone().sub(q), dist = dd.length();
        if (dist < r + tube) {
          const nn = dd.divideScalar(dist || 1); B.p.copy(q).addScaledVector(nn, r + tube);
          const vn = B.v.dot(nn); if (vn < 0) { B.v.addScaledVector(nn, -(1 + .5) * vn); B.v.multiplyScalar(.86); if (G.touch < 6 && -vn > .6) ev.rim(); G.touch++; }
        }
        // backboard
        if (B.p.z - r < bz && B.p.z > bz - .25 && Math.abs(B.p.x) < .915 && B.p.y > 2.9 && B.p.y < 3.97 && B.v.z < 0) { B.p.z = bz + r; B.v.z = -B.v.z * .55; G.board++; ev.thud(); }
        // through the hoop
        if (!B.judged && py >= RIM.y && B.p.y < RIM.y && Math.hypot(B.p.x, B.p.z) < R - .02) {
          const swish = !G.touch && !G.board;
          B.v.x *= .35; B.v.z *= .35; B.v.y *= .55; w.hoop.kick = 1; ev.net();
          ev.make({ label: swish ? 'SWISH!' : G.board ? 'BANK!' : 'BUCKET!', base: Math.round(100 + G.dist * 28), extra: swish ? 1.25 : 1, money: G.money, at: RIM.clone(), jumbo: swish ? 'SWISH' : 'BUCKET' });
        }
        if (B.p.y < r) { B.p.y = r; if (Math.abs(B.v.y) > 1) { B.v.y = Math.abs(B.v.y) * .62; ev.bounce(); } else B.v.y = 0; B.v.x *= .9; B.v.z *= .9; }
      }
      if (!B.judged && ((G.peak && B.p.y < 2.45) || G.flyT > 3.2)) ev.miss(G.touch || G.board ? 'RIMMED OUT' : (B.p.z < 0 ? 'TOO LONG' : 'AIR BALL'), G.touch ? 'So close' : (G.pow < this.sweet[0] ? 'A bit more power' : G.pow > this.sweet[1] ? 'A bit less power' : 'Line it up'));
    },
    camFly(G, out) { out.pos.copy(G.home.pos); out.look.copy(G.home.look).lerp(B.p, .12); },
    animate(dt, w, G) { w.hoop.build(dt); w.coin && (w.coin.visible = false); }
  };
  return { B, football, soccer, basketball };
})();
