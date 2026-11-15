/* Grug · the two apps' icons (app/icons/). Run from the repo root: node tools/pwa/icons.js
   Needs Playwright and Chrome (npm i playwright; it uses /usr/bin/google-chrome, or set CHROME=path).
   Grug: the Grug dino (Grug.LOGO in assets/grug.js) on Grug green. Daypart: the dashboard's four tiles in green on ink.
   The *-maskable-512.png versions keep the picture inside Android's round safe zone. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const logo = fs.readFileSync(path.join(root, 'assets/grug.js'), 'utf8').match(/LOGO = '(<svg.*?<\/svg>)'/)[1];
const dino = logo.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<rect[^>]*\/>/, '');   // the dino path(s) only
const ink = '#1E1B16', green = '#9BE338';
// Grug: the dino on Grug green. `pad` shrinks it for the maskable safe zone.
const grug = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${green}"/><g transform="translate(32 33) scale(${pad}) translate(-32 -32)">${dino}</g></svg>`;
// Daypart: the dashboard's four tiles in Grug green on ink.
const tiles = '<rect x="1" y="1" width="6" height="8" rx="1.5"/><rect x="9" y="1" width="6" height="5" rx="1.5"/><rect x="1" y="11" width="6" height="4" rx="1.5"/><rect x="9" y="8" width="6" height="7" rx="1.5"/>';
const daypart = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${ink}"/><g fill="${green}" transform="translate(32 32) scale(${2.0 * pad}) translate(-8 -8)">${tiles}</g></svg>`;
const out = path.join(root, 'app/icons') + '/';
const jobs = [];
for (const [name, fn] of [['grug', grug], ['daypart', daypart]]) {
  jobs.push([name + '-192.png', fn(1.15), 192], [name + '-512.png', fn(1.15), 512], [name + '-180.png', fn(1.15), 180],
            [name + '-maskable-512.png', fn(0.92), 512]);
  fs.writeFileSync(out + name + '.svg', fn(1.15));
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const p = await b.newPage();
  for (const [file, svg, size] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: out + file, omitBackground: false });
  }
  await b.close();
})();
