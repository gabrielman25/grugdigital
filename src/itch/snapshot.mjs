// Writes static/itch-assets.json: the copy of the itch asset list the home page shows if /api/itch-assets can't be
// reached. The live feed is what keeps the site current; refresh this now and then so the fallback isn't too old.
//   node src/itch/snapshot.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAssets } from './itch.js';

const data = await loadAssets(fetch);
if (data.errors.length) console.warn('warnings:', data.errors);
const out = fileURLToPath(new URL('../../static/itch-assets.json', import.meta.url));
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`${data.items.length} packs in ${data.collections.length} collections → static/itch-assets.json`);
for (const c of data.collections) console.log(`  ${c.title}: ${c.items.length}`);
const loose = data.items.filter(i => !i.cats.length);
if (loose.length) console.log('  not in a collection yet:', loose.map(i => i.title).join(', '));
