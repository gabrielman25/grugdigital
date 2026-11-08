// node pose.js poses.json [only]  -> writes cap/pose_<name>.png
const { chromium } = require('playwright'); const fs = require('fs'); fs.mkdirSync('work', { recursive: true });
(async () => {
  const poses = JSON.parse(fs.readFileSync(process.argv[2]));
  const only = process.argv[3];
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log(m.text().slice(0, 200)); });
  await p.goto('http://localhost:' + (process.env.PORT || 8765) + '/tools/boxart/pose.html');
  await p.waitForFunction(() => window.studioReady && window.SandyKit, null, { timeout: 90000 });
  for (const [name, o] of Object.entries(poses)) {
    if (only && !only.split(',').includes(name)) continue;
    const url = await p.evaluate(o => render(o), o);
    fs.writeFileSync('work/pose_' + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', name);
  }
  await b.close();
})();
