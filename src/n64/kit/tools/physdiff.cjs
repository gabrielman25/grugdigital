#!/usr/bin/env node
/* Is phys.c still the same physics as the site? Runs the real AmbientCore (cut out of arcade/baseplate/index.html) and
 * the C port (build/host/physdiff) on the same scripted scenarios and compares where the character is, frame by frame.
 *   make -C src/n64/grug-64 check     (or: make host there, then node src/n64/kit/tools/physdiff.cjs)                                           */
const fs = require('fs'), vm = require('vm'), path = require('path'), { execFileSync } = require('child_process');
const HERE = __dirname, ROOT = path.join(HERE, '..', '..', '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'arcade', 'baseplate', 'index.html'), 'utf8');
const m = [...html.matchAll(/<script id="ambient-npc">([\s\S]*?)<\/script>/g)].find(x => x[1].includes('class World'));
const sb = { console, performance: { now: () => 0 }, setTimeout }; sb.window = sb; sb.globalThis = sb;
vm.runInNewContext(m[1], sb);
const A = sb.Ambient || Object.values(sb).find(v => v && v.World && v.stepAll);
const PLATE = 'box -128 128 -2 0 -128 128 0 0';
const block = h => `box -4 4 0 ${h} -44 -36 0 0`;
const SCN = {
  'standing jump': [PLATE, 'char 0 3.3 0', 'run 15 0 0 0', 'run 3 0 0 1', 'run 40 0 0 0'],
  'walk 3 s': [PLATE, 'char 0 3.3 0', 'run 90 0 -1 0'],
  'walk diagonally, stop': [PLATE, 'char 0 3.3 0', 'run 45 0.7 -0.7 0', 'run 30 0 0 0'],
  'running jump': [PLATE, 'char 0 3.3 0', 'run 30 0 -1 0', 'run 3 0 -1 1', 'run 40 0 -1 0'],
  'held jump (hopping)': [PLATE, 'char 0 3.3 0', 'run 120 0 -1 1'],
  'dodge roll': [PLATE, 'char 0 3.3 0', 'run 10 0 0 0', 'dash 0 -1', 'run 30 0 -1 0'],
  'roll in the air': [PLATE, 'char 0 3.3 0', 'run 20 0 -1 0', 'run 3 0 -1 1', 'run 3 0 -1 0', 'dash 0 -1', 'run 40 0 -1 0'],
  'jump pad (power 120)': [PLATE, 'box -3 3 0 0.4 -13 -7 2 120', 'char 0 3.3 0', 'run 150 0 -1 0'],
  'into a wall at an angle': [PLATE, 'box -40 40 0 12 -22 -20 0 0', 'char 0 3.3 0', 'run 90 0.5 -1 0'],
  'head bonk under a ceiling': [PLATE, 'box -8 8 8 9 -8 8 0 0', 'char 0 3.3 0', 'run 10 0 0 0', 'run 40 0 0 1'],
  'off a ledge': [PLATE, 'box -4 4 0 6 -4 4 0 0', 'char 0 9.3 0', 'run 60 0 -1 0'],
  'kill brick': [PLATE, 'box -3 3 0 2 -13 -7 1 0', 'char 0 3.3 0', 'run 60 0 -1 0'],
};
for (const h of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) SCN[`jump at a ${h} stud block`] = [PLATE, block(h), 'char 0 3.3 -30', 'run 12 0 0 0', 'run 18 0 -1 0', 'run 21 0 -1 1', 'run 24 0 0 0'];

function js(lines) {
  const W = new A.World(); let ch = A.makeCharacter(0, 3, 0, { id: 1 }); const out = [];
  for (const l of lines) {
    const t = l.split(' '), n = t.slice(1).map(Number);
    if (t[0] === 'box') W.add({ minX: n[0], maxX: n[1], minY: n[2], maxY: n[3], minZ: n[4], maxZ: n[5], kind: ['solid', 'kill', 'pad'][n[6]], power: n[7] || undefined });
    else if (t[0] === 'char') ch = A.makeCharacter(n[0], n[1], n[2], { id: 1 });
    else if (t[0] === 'dash') { ch.dashT = 0.3; ch.dashVx = n[0] * 42; ch.dashVz = n[1] * 42; }
    else if (t[0] === 'run') for (let i = 0; i < n[0]; i++) { ch.input.mx = n[1]; ch.input.mz = n[2]; ch.input.jump = !!n[3]; A.stepAll._acc = A.stepAll._acc || 0; A.stepAll([ch], W, 1 / 30); ch.events.length = 0; out.push([ch.x, ch.y, ch.z, ch.grounded ? 1 : 0, ch.dead ? 1 : 0]); if (ch.dead) break; }
  }
  return out;
}
let bad = 0; const bin = path.join(HERE, '..', 'build', 'host', 'physdiff');
for (const [name, lines] of Object.entries(SCN)) {
  if (A.stepAll._acc !== undefined) A.stepAll._acc = 0;
  const a = js(lines), b = execFileSync(bin, { input: lines.join('\n') + '\n' }).toString().trim().split('\n').map(l => l.split(' ').map(Number));
  let worst = 0, flags = 0; const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(a[i][k] - b[i][k])); if (a[i][3] !== b[i][3] || a[i][4] !== b[i][4]) flags++; }
  const ok = a.length === b.length && worst < 0.02 && flags <= 1, e = a[a.length - 1];
  if (!ok) bad++;
  console.log(`${ok ? 'same  ' : 'DIFFER'}  ${name.padEnd(28)} ${String(a.length).padStart(4)} frames, furthest apart ${worst.toFixed(4)} studs, ends at (${e[0].toFixed(2)}, ${e[1].toFixed(2)}, ${e[2].toFixed(2)})${e[4] ? ' dead' : ''}`);
}
console.log(bad ? `${bad} scenario(s) differ` : 'phys.c matches the site\'s AmbientCore on every scenario');
process.exit(bad ? 1 : 0);
