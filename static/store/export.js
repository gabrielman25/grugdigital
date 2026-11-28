/* Grug · the 3D store's itch.io zips (loaded by static/store/store.js when someone downloads one).

   A zip holds one small index.html that shows the creator's live store from this site in a frame, starting in front of
   one product (?spawn=<slug>), so it's uploaded once and never goes stale. If the store doesn't answer within 15
   seconds (this site down, a blocked network), the page shows a link to the creator's itch.io profile instead of a
   blank box. "One for every product" is a zip of those zips, named after each product, plus a README.
   The zips are written here, in the browser (stored, not compressed: they're tiny), with no library. */
(function () {
  'use strict';
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  function zip(files) {
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const out = new Uint8Array(offset + cdSize + 22);
    let p = 0; for (const b of [...parts, ...central, new Uint8Array(end.buffer)]) { out.set(b, p); p += b.length; }
    return out;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const origin = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /\.pages\.dev$/.test(location.hostname) ? location.origin : 'https://grugdigital.com';

  function page(user, name, item, opts = {}) {
    const o = origin();
    const src = o + '/store/' + encodeURIComponent(user) + '?embed=1' + (item ? '&spawn=' + encodeURIComponent(item.slug) : '') + (opts.mall === false ? '&mall=0' : '');
    const title = name + '’s store';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<!-- ${esc(name)}'s 3D store, live from ${o}/store/${esc(user)} (made with Grug Digital's 3D Store). This file never needs re-uploading: the store updates itself. -->
<style>
html,body{margin:0;height:100%;overflow:hidden;background:#0d0e10}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block}
#fallback{position:fixed;inset:0;display:none;place-items:center;padding:24px;text-align:center;background:#0d0e10;color:#ecedef;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
#fallback a{display:inline-block;margin-top:14px;padding:12px 18px;border-radius:12px;background:#9be33c;color:#10200a;font-weight:600;text-decoration:none}
</style>
</head>
<body>
<iframe id="store" title="${esc(title)}" allow="fullscreen"></iframe>
<div id="fallback"><div><b>${esc(title)}</b><br>The 3D store couldn’t load right now.<br><a href="https://${esc(user)}.itch.io/" target="_blank" rel="noopener">See everything on itch.io</a></div></div>
<script>
(function () {
  var src = ${JSON.stringify(src)}, ok = false, fb = document.getElementById('fallback');
  try { if (document.referrer) src += '&ref=' + encodeURIComponent(document.referrer); } catch (e) {}
  document.getElementById('store').src = src;
  addEventListener('message', function (e) { if (e.origin === ${JSON.stringify(o)} && e.data && e.data.grugStore) { ok = true; fb.style.display = 'none'; } });
  setTimeout(function () { if (!ok) fb.style.display = 'grid'; }, 15000);
})();
</script>
</body>
</html>
`;
  }

  function save(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const safe = s => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'store';

  const zipFor = (user, name, item, opts) => zip([{ name: 'index.html', data: page(user, name, item, opts) }]);

  window.GrugStoreExport = {
    zipFor, page, zip,
    one(user, name, item, opts) { save(zipFor(user, name, item, opts), 'grug-store-' + safe(user) + '-' + (item ? safe(item.slug) : 'door') + '.zip'); },
    all(user, name, items, opts) {
      const files = [{ name: 'store-door.zip', data: zipFor(user, name, null, opts) }];
      for (const it of items) files.push({ name: 'store-' + safe(it.slug) + '.zip', data: zipFor(user, name, it, opts) });
      files.push({ name: 'README.txt', data: [
        name + "'s 3D store: one zip for each itch.io page.",
        '',
        'Each store-<page>.zip starts customers in front of that product. Upload each one to its own page:',
        '  1. On itch.io, open the page and choose Edit.',
        '  2. Kind of project: HTML (your downloadable files stay on the page).',
        '  3. Upload the zip and tick "This file will be played in the browser".',
        '  4. Embed options: viewport 960 x 640, tick Mobile friendly, Fullscreen button and Automatically start on page load.',
        '  5. Save.',
        '',
        'store-door.zip starts at the door with the whole store in view: use it on a devlog, a jam page or your own site.',
        'You never need to upload these again: the store updates itself from your itch.io page.',
        '',
        'Made with Grug Digital: https://grugdigital.com/store/' + user,
        '',
      ].join('\r\n') });
      save(zip(files), 'grug-store-' + safe(user) + '-every-page.zip');
    },
  };
})();
