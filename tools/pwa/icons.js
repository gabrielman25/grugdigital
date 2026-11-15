/* Grug · the apps' icons (app/icons/). Run from the repo root: node tools/pwa/icons.js [grug daypart tea cafe]
   (no names = all four; name only the ones you changed so the others keep their exact bytes).
   Needs Playwright and Chrome (npm i playwright; it uses /usr/bin/google-chrome, or set CHROME=path).
   Grug: the Grug dino (Grug.LOGO in assets/grug.js) on Grug green. Daypart: the dashboard's four tiles in green on ink.
   Bubble Tea: a boba cup in ink on taro purple. Café: a coffee cup in ink on caramel (the dashboards' own accents).
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
// Bubble Tea and Café: the dashboards' own line icons (tools/shop-dashboards/src/ui.js), in ink on their accent.
const line = (paths, bg) => (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><g fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" transform="translate(32 32) scale(${1.55 * pad}) translate(-12 -12)">${paths}</g></svg>`;
const tea = line('<path d="M5 7h14l-1.6 13.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8z"/><path d="M4 7h16M13 7l2-5"/><circle cx="9.5" cy="17" r=".9" fill="' + ink + '"/><circle cx="12.5" cy="18" r=".9" fill="' + ink + '"/><circle cx="14.6" cy="15.8" r=".9" fill="' + ink + '"/>', '#C59BFF');
const cafe = line('<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3"/>', '#E9B872');
const out = path.join(root, 'app/icons') + '/';
const ALL = { grug, daypart, tea, cafe }, pick = process.argv.slice(2).filter(n => ALL[n]);
const jobs = [];
for (const [name, fn] of Object.entries(ALL).filter(([n]) => !pick.length || pick.includes(n))) {
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
