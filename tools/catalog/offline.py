#!/usr/bin/env python3
"""Packs the avatar editor (the closet) as an offline copy that opens straight from a folder, no server and no internet:
   python3 tools/catalog/offline.py [out.zip]        (default: grug-avatar-editor-offline.zip in the current folder)

   The zip holds GrugAvatarEditor/ with the catalog page (labs/catalog/index.html, as built), the Hair Studio, the avatar
   runtimes and every file the pages build names for in code (clothes, swords, charm icons, brand logos). A page opened from
   disk (file://) can't fetch() and WebGL won't take pictures from disk, so assets/offline-pack.js carries those files inside
   a script and answers the pages' fetch() and picture loads from it. Double-click "Open the Avatar Editor.html".
   What's saved lives in the browser that opens it (localStorage for file:// pages), apart from the site's."""
import base64, os, sys, zipfile, mimetypes, json
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'grug-avatar-editor-offline.zip')
TOP = 'GrugAvatarEditor/'
# files the pages load by name (script tags, CSS): copied as they are
COPY = ['assets/sandy-runtime.js', 'assets/sandy-classic.js', 'assets/closet/stage-bg.jpg', 'favicon.png']
# files built from names in code (fetch, pictures): packed into offline-pack.js as well as copied
PACK_DIRS = ['assets/clothes', 'assets/swords', 'assets/events-icons', 'assets/brands']
SHIM = r"""/* offline-pack.js: the avatar editor's files, for a copy opened from disk (file://). fetch() and picture loads of anything
   under assets/ that is in here are answered from it (a page from disk can't fetch, and WebGL won't take pictures from disk). */
(function () {
  var M = window.GRUG_OFFLINE = __MAP__;
  var key = function (u) { try { u = new URL(String(u), location.href).href; } catch (e) { return null; } var i = u.lastIndexOf('/assets/'); return i < 0 ? null : decodeURIComponent(u.slice(i + 8).split('?')[0].split('#')[0]); };
  var bytes = function (b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', bin: 'application/octet-stream' };
  var mime = function (k) { return MIME[k.split('.').pop().toLowerCase()] || 'application/octet-stream'; };
  var f0 = window.fetch;
  window.fetch = function (u, o) {
    var k = key(typeof u === 'string' ? u : u && u.url);
    if (k && M[k]) return Promise.resolve(new Response(bytes(M[k]), { status: 200, headers: { 'Content-Type': mime(k) } }));
    return f0.apply(this, arguments);
  };
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: true, get: function () { return d.get.call(this); },
    set: function (v) { var k = key(v); if (k && M[k]) v = 'data:' + mime(k) + ';base64,' + M[k]; d.set.call(this, v); } });
})();
"""
pack = {}
for d in PACK_DIRS:
    for root, _, files in os.walk(os.path.join(REPO, d)):
        for f in files:
            p = os.path.join(root, f); rel = os.path.relpath(p, os.path.join(REPO, 'assets')).replace(os.sep, '/')
            pack[rel] = base64.b64encode(open(p, 'rb').read()).decode()
shim = SHIM.replace('__MAP__', json.dumps(pack, separators=(',', ':')))
TAG = '<script src="../../assets/offline-pack.js"></script>'
def page(rel):
    s = open(os.path.join(REPO, rel), encoding='utf-8').read()
    i = s.find('<meta charset="utf-8">'); i = s.find('>', i) + 1 if i >= 0 else s.find('<head>') + 6
    return s[:i] + '\n' + TAG + s[i:]
OPEN = """<!doctype html><meta charset="utf-8"><title>Grug avatar editor (offline)</title>
<meta http-equiv="refresh" content="0; url=labs/catalog/index.html"><a href="labs/catalog/index.html">Open the avatar editor</a>"""
README = """Grug avatar editor, offline copy
=================================
Double-click "Open the Avatar Editor.html" (Chrome or Edge works best). Nothing needs installing and no internet is needed.

- It's the closet as it is on grugdigital.com/avatar/ (Marketplace, Customize, the studios), saved in this browser only:
  what you make here doesn't reach the site, and the site's wardrobe doesn't show here.
- The Hair Studio opens from the closet's menu (labs/hair-studio-x8f3k2/).
- The site's own dock and links to other pages need the site; they won't work from here.
- To rebuild a newer copy: python3 tools/catalog/offline.py in the grugdigital repo.
"""
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    z.writestr(TOP + 'Open the Avatar Editor.html', OPEN)
    z.writestr(TOP + 'README.txt', README)
    z.writestr(TOP + 'labs/catalog/index.html', page('labs/catalog/index.html'))
    z.writestr(TOP + 'labs/hair-studio-x8f3k2/index.html', page('labs/hair-studio-x8f3k2/index.html'))
    z.writestr(TOP + 'assets/offline-pack.js', shim)
    for rel in COPY: z.write(os.path.join(REPO, rel), TOP + rel)
    for d in PACK_DIRS:
        for root, _, files in os.walk(os.path.join(REPO, d)):
            for f in files: p = os.path.join(root, f); z.write(p, TOP + os.path.relpath(p, REPO).replace(os.sep, '/'))
print(OUT, round(os.path.getsize(OUT) / 1e6, 1), 'MB,', len(pack), 'files packed')
