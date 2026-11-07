/* Grug single-file loader, shared by the showcase (shell.html) and the offline site (site.html).
   - Storage is memory only: nothing is saved on the device, and closing or reloading starts fresh. Every page,
     app and game frame gets the same in-memory localStorage / sessionStorage from the top window.
   - unpack(): the gzip block with every page, script and picture. unpackEngine(): the 3D avatar engine block.
   - loadPage(key, search, hash): writes a page into a fresh frame (so it keeps its own address, hash routing and
     scripts), with links and `location.href =` routed back through GL.onNav. */
'use strict';
const GL = { pack: null, frame: null, cur: {key: '', search: '', hash: ''}, engineURL: null, engineP: null,
  onNav: null, onLoad: null, toast: m => {} };

/* ---------- memory-only storage ---------- */
function memStorage(){
  const M = new Map();
  return { getItem: k => M.has(String(k)) ? M.get(String(k)) : null, setItem: (k, v) => { M.set(String(k), String(v)); },
    removeItem: k => { M.delete(String(k)); }, clear: () => M.clear(), key: i => Array.from(M.keys())[i] ?? null, get length(){ return M.size; } };
}
window.__grugLS = memStorage(); window.__grugSS = memStorage();
try{
  Object.defineProperty(window, 'localStorage', {configurable: true, get: () => window.__grugLS});
  Object.defineProperty(window, 'sessionStorage', {configurable: true, get: () => window.__grugSS});
}catch(e){}

/* ---------- unpacking ---------- */
async function gunzipB64(id){
  if(!('DecompressionStream' in window)) throw new Error('This browser is too old to open this file. Use a current Chrome, Safari, Edge or Firefox.');
  const bin = atob(document.getElementById(id).textContent.trim()), u8 = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
GL.unpack = async () => { GL.pack = JSON.parse(await gunzipB64('pack')); window.__GRUG_ASSETS = GL.pack.assets; return GL.pack; };
// the 3D engine as a script URL every frame can load; also stands in for assets/sandy-view.js (it contains it)
GL.unpackEngine = () => GL.engineP || (GL.engineP = (async () => {
  const code = await gunzipB64('engine');
  GL.engineURL = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
  window.__grugEngineURL = GL.engineURL;
  if(GL.pack) GL.pack.assets['assets/sandy-view.js'] = GL.engineURL;
  return GL.engineURL;
})());

/* ---------- pages ---------- */
GL.pageByPath = p => Object.entries(GL.pack.pages).find(([k, v]) => v.path === p);
GL.pathKey = path => {
  path = String(path || '').replace(/^\/+/, '').replace(/(^|\/)index\.html$/, '$1');
  const hit = GL.pageByPath(path) || GL.pageByPath(path + '/');
  return hit ? hit[0] : null;
};
GL.pageHTML = (key, search, hash) => {
  const pg = GL.pack.pages[key], L = GL.pack.libs, S = 'scr' + 'ipt';
  const prelude = '<' + S + '>(function(){var P=top;' +
    'try{Object.defineProperty(window,"localStorage",{configurable:true,get:function(){return P.__grugLS}});Object.defineProperty(window,"sessionStorage",{configurable:true,get:function(){return P.__grugSS}})}catch(e){}' +
    'window.__grugShowcase=true;window.GRUG_ASSETS=window.__GRUG_ASSETS=P.__GRUG_ASSETS;' +
    'var VP=' + JSON.stringify('https://grug.local/' + pg.path) + ';' +
    'try{history.replaceState(null,"",location.pathname+' + JSON.stringify(search || '') + '+' + JSON.stringify(hash || '') + ')}catch(e){}' +
    'function go(u){try{u=new URL(String(u),VP)}catch(e){return}' +
      'if(u.hostname==="grug.local"){P.__grugNav(u.pathname.slice(1),u.search,u.hash);return}' +
      'if(/(^|\\.)stripe\\.com$/.test(u.hostname)){P.__grugDemoBuy(u.href,window);return}' +
      'if(/^https?:$/.test(u.protocol))window.open(u.href,"_blank","noopener")}' +
    'window.__grugLoc={set href(u){go(u)},get href(){return location.href},replace:go,assign:go};' +
    'addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||e.defaultPrevented)return;' +
      'var h=a.getAttribute("href");if(!h||h.charAt(0)==="#"||/^(javascript|mailto|tel|sms|data|blob):/i.test(h)||a.hasAttribute("download"))return;' +
      'e.preventDefault();e.stopImmediatePropagation();go(h)},true);' +
    '})();</' + S + '>';
  let html = pg.html.replace(/<!--LIB:([\w.-]+)-->/g, (m, n) => L[n] == null ? '' : n.endsWith('.css') ? '<style>' + L[n] + '</style>' : '<' + S + '>' + L[n] + '</' + S + '>');
  html = html.replace(/<!--ENGINE-->/g, () => GL.engineURL ? '<' + S + ' src="' + GL.engineURL + '"></' + S + '>' : '');
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + prelude) : prelude + html;
};
GL.loadPage = (key, search, hash, box) => {
  const pg = GL.pack.pages[key]; if(!pg) return null;
  GL.cur = {key, search: search || '', hash: hash || ''};
  const f = document.createElement('iframe');
  f.title = 'Grug'; f.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
  if(GL.frame) GL.frame.remove();
  GL.frame = f; box.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(GL.pageHTML(key, search, hash)); d.close();
  if(GL.onLoad) GL.onLoad(key, pg);
  return f;
};
window.__GRUG_ASSETS = null;
// deferred: a link tapped inside a page removes that page, and a frame can't be written from a removed page's event
window.__grugNav = (path, search, hash) => { setTimeout(() => GL.onNav && GL.onNav(path, search || '', hash || ''), 0); };
// Pearl checkout: never opens Stripe here; plays the paid return instead
window.__grugDemoBuy = (link, w) => {
  let packs = null; try{ packs = w.__grugPacks || null; }catch(e){}
  const p = packs && packs.find(x => link.indexOf(x.link) === 0);
  if(!p) return GL.toast('Checkout is turned off in this copy.');
  GL.toast('No payment is taken in this copy. On the live site this opens Stripe.');
  setTimeout(() => GL.onNav('pearls.html', '?pack=' + encodeURIComponent(p.id) + '&cs=cs_demo_' + Math.random().toString(36).slice(2, 12), ''), 900);
};
