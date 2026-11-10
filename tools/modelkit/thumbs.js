// Renders create/thumbs/<id>.webp and scene-<id>.webp for every preset, using the Create page's own viewer.
// Needs Playwright with Chromium: run from the repo root with  node tools/modelkit/thumbs.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const root = path.join(__dirname, '../..'), out = path.join(root, 'create/thumbs'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(root, 'create/index.html')); await p.waitForFunction(() => window.MK && window.MK_PRESETS);
  const list = await p.evaluate(() => [...MK_PRESETS.scenes.map(s => ['scene', s.id]), ...MK_PRESETS.models.map(m => ['model', m.id])]);
  for (const [kind, id] of list) {
    const url = await p.evaluate(([k, i]) => MK.thumb(k, i, 512, 'image/webp'), [kind, id]);
    if (!url) throw new Error('WebGL unavailable');
    const f = path.join(out, (kind === 'scene' ? 'scene-' : '') + id + '.webp');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(path.relative(root, f), (fs.statSync(f).size / 1024 | 0) + ' KB');
  }
  if (errs.length) console.log('page errors:', errs);
  await b.close();
})();
