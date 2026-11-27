/* The ROM's own outfit: Grug, made from the same file the site's games dress him from (arcade/outfits/grug.glb), by the
 * same code the Arcade's page uses to put a player's outfit into the ROM (static/outfit64.js).
 *
 *   node tools/mkoutfit.cjs [character.glb] [name] [out.fit] [--pictures DIR]
 *
 * Writes assets/outfit-default.fit: the whole 128 KB slot, which tools/mkslot.py puts into the ROM. --pictures also
 * writes the atlases as .ppm files, to look at. Run it again (make assets) when Grug's look changes. */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..', '..', '..'), O = require(path.join(ROOT, 'static', 'outfit64.js'));

// a PNG as pixels: 8 bits a channel, not interlaced, which is what a browser's canvas writes
function decodePNG(buf) {
  buf = Buffer.from(buf); if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, depth = 0, type = 0, lace = 0, plte = null, trns = null; const idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), tag = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (tag === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; lace = d[12]; } else if (tag === 'PLTE') plte = d; else if (tag === 'tRNS') trns = d; else if (tag === 'IDAT') idat.push(d); else if (tag === 'IEND') break; }
  if (depth !== 8 || lace) throw new Error('this PNG is ' + depth + '-bit' + (lace ? ', interlaced' : '') + ': not one this tool reads');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], raw = zlib.inflateSync(Buffer.concat(idat)), line = w * ch, px = Buffer.alloc(h * line);
  for (let y = 0; y < h; y++) { const f = raw[y * (line + 1)], s = y * (line + 1) + 1;
    for (let x = 0; x < line; x++) { const a = x >= ch ? px[y * line + x - ch] : 0, b = y ? px[(y - 1) * line + x] : 0, c = x >= ch && y ? px[(y - 1) * line + x - ch] : 0; let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * line + x] = v & 255; } }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const k = i * ch; let r, g, b, a = 255;
    if (type === 0) r = g = b = px[k]; else if (type === 4) { r = g = b = px[k]; a = px[k + 1]; } else if (type === 3) { const p = px[k]; r = plte[p * 3]; g = plte[p * 3 + 1]; b = plte[p * 3 + 2]; a = trns && p < trns.length ? trns[p] : 255; } else { r = px[k]; g = px[k + 1]; b = px[k + 2]; if (ch === 4) a = px[k + 3]; }
    data.set([r, g, b, a], i * 4); }
  return { w, h, data };
}

(async () => {
  const args = process.argv.slice(2), pi = args.indexOf('--pictures'), pics = pi >= 0 ? args.splice(pi, 2)[1] : null;
  const glb = args[0] || path.join(ROOT, 'arcade', 'outfits', 'grug.glb'), name = args[1] || 'Grug', out = args[2] || path.join(__dirname, '..', 'assets', 'outfit-default.fit');
  const fit = await O.build(new Uint8Array(fs.readFileSync(glb)), { name, decode: async bytes => decodePNG(bytes) });
  fs.writeFileSync(out, O.write(O.blank(), { outfit: fit }));
  console.log(`${path.relative(process.cwd(), out)}: "${fit.name}", ${fit.used} of ${fit.bytes.length} bytes of outfit; head: ${fit.info.rings} rings from ${fit.info.headTriangles} triangles (${fit.info.hairTriangles} of hair left out); colours: ${fit.info.colours.join(', ')}; skin ${fit.info.skin}, hair ${fit.info.hair}`);
  if (pics) { fs.mkdirSync(pics, { recursive: true });
    for (const [k, q, w, h] of [['shirt', fit.pictures.shirt, O.BODY.w, O.BODY.h], ['pants', fit.pictures.pants, O.BODY.w, O.BODY.h], ['face', fit.pictures.face, O.FACE.w, O.FACE.h]])
      q.levels.forEach((l, i) => { const W = w >> i, H = h >> i, b = Buffer.alloc(W * H * 3); for (let p = 0; p < W * H; p++) { const c = q.pal[l[p]]; b[p * 3] = ((c >> 11) & 31) * 255 / 31; b[p * 3 + 1] = ((c >> 6) & 31) * 255 / 31; b[p * 3 + 2] = ((c >> 1) & 31) * 255 / 31; }
        fs.writeFileSync(path.join(pics, `${k}-${i}.ppm`), Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), b])); }); }
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
