// node bg.js <game> <outprefix> '<json opts>'
const { chromium } = require('playwright'); require('fs').mkdirSync('work', { recursive: true });
(async () => {
  const [g, out, js] = process.argv.slice(2); const o = JSON.parse(js || '{}');
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: o.w || 1580, height: o.h || 950 } });
  if (o.ls) await p.addInitScript(ls => { for (const k in ls) localStorage.setItem(k, JSON.stringify(ls[k])); }, o.ls);
  p.on('pageerror', e => console.log('ERR', e.message.slice(0, 150)));
  await p.goto('http://localhost:' + (process.env.PORT || 8765) + '/' + (o.url || ('play/' + g + '/game.html')));
  await p.waitForTimeout(o.w1 || 6000);
  for (const sel of (o.clicks || ['#goBtn', '#goBtn'])) { const el = await p.$(sel); if (el) { await el.click().catch(() => {}); await p.waitForTimeout(2500); } }
  for (const [k, ms] of (o.keys || [])) { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); }
  await p.waitForTimeout(o.w2 || 4000);
  if (o.pre) await p.evaluate(o.pre);
  const shots = o.shots || [{}];
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    await p.evaluate(s => { if (typeof CAM !== 'undefined') Object.assign(CAM, s.cam || {}); if (s.camAdd && typeof CAM !== 'undefined') for (const k in s.camAdd) CAM[k] += s.camAdd[k]; }, s);
    await p.waitForTimeout(s.wait || 2500);
    await p.evaluate(hide => {
      const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      document.querySelectorAll('body *').forEach(e => { if (!e.contains(cv) && e !== cv) e.style.visibility = 'hidden'; });
      if (hide && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        const roots = new Set(); scene.traverse(m => { if (m.isSkinnedMesh) { let r = m; while (r.parent && r.parent !== scene) r = r.parent; roots.add(r); } });
        let best = null, bd = 1e12; const v = new THREE.Vector3();
        for (const r of roots) { r.getWorldPosition(v); const rel = v.clone().sub(camera.position); const along = rel.dot(dir); if (along < 0) continue; const perp = rel.clone().sub(dir.clone().multiplyScalar(along)).length(); const sc = perp + Math.abs(along - (typeof CAM !== 'undefined' && CAM.dist ? CAM.dist : 500)) * 0.3; if (sc < bd) { bd = sc; best = r; } }
        if (best) { best.visible = false; window.__hidden = best; best.traverse(c => c.visible = false); }
      }
    }, !!o.hidePlayer);
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'work/' + out + '_' + i + '.png' });
    if (o.hidePlayer) await p.evaluate(() => { if (window.__hidden) window.__hidden.traverse(c => c.visible = true); });
    console.log('shot', out, i, await p.evaluate(() => typeof CAM !== 'undefined' ? JSON.stringify(CAM) : ''));
  }
  await b.close();
})();
