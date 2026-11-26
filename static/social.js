/* Grug's socials for any page or game: the links, and live data from /api/social (functions/api/social.js).
   GrugSocial.get()        Promise of { links, discord: { name, icon, members, online, widget, avatars }, youtube: { url, videos } }
                           (fetched once per page, kept a minute in sessionStorage; never rejects: falls back to the links alone)
   GrugSocial.img(url)     a YouTube thumbnail or Discord avatar relayed through our own site, usable as a WebGL texture
   GrugSocial.thumb(id)    a video's thumbnail through the relay;  GrugSocial.watch(id): its YouTube page
   GrugSocial.embed(id, { muted, controls })   the privacy-enhanced (youtube-nocookie) player for a video
   GrugSocial.n(1234)      "1,234" */
(function () {
  const LINKS = { discord: 'https://discord.gg/3ENePvNGJy', instagram: 'https://www.instagram.com/grugdigital', youtube: 'https://www.youtube.com/@PolySwitchOfficial' };
  const EMPTY = { links: LINKS, discord: { name: 'Grug Discord', icon: '', members: 0, online: 0, widget: false, avatars: [] }, youtube: { url: LINKS.youtube, videos: [] } };
  const KEY = 'grug.social.v1';
  const wait = (ms, pr) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  async function discordDirect() {   // the same two public Discord endpoints the server uses, straight from this browser
    const inv = await wait(6000, fetch('https://discord.com/api/v10/invites/3ENePvNGJy?with_counts=true').then(r => r.ok ? r.json() : Promise.reject(r.status)));
    const g = inv.guild || {}, out = { id: g.id || '', name: g.name || 'Grug Discord', icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : '',
      members: inv.approximate_member_count || 0, online: inv.approximate_presence_count || 0, widget: false, avatars: [] };
    if (g.id) try {
      const w = await wait(6000, fetch(`https://discord.com/api/guilds/${g.id}/widget.json`).then(r => r.ok ? r.json() : Promise.reject(r.status)));
      out.widget = true; if (w.presence_count) out.online = Math.max(out.online, w.presence_count);
      out.avatars = (w.members || []).slice(0, 40).map(m => ({ name: m.username || '', avatar: m.avatar_url || '', status: m.status || 'online', game: (m.game && m.game.name) || '' }));
    } catch (e) { }
    return out;
  }
  let p = null;
  function get() {
    if (p) return p;
    try { const c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < 60e3) return (p = Promise.resolve(c.d)); } catch (e) { }
    return (p = fetch('/api/social', { headers: { accept: 'application/json' } }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(async d => {
      d = Object.assign({}, EMPTY, d); d.links = Object.assign({}, LINKS, d.links || {});
      if (!d.discord || d.discord.error || !(d.discord.members || d.discord.online)) d.discord = await discordDirect().catch(() => d.discord);   // Discord often rate-limits our server: ask from the browser instead
      d.discord = Object.assign({}, EMPTY.discord, d.discord && !d.discord.error ? d.discord : {});
      d.youtube = Object.assign({}, EMPTY.youtube, d.youtube && !d.youtube.error ? d.youtube : {}); if (!Array.isArray(d.youtube.videos)) d.youtube.videos = [];
      try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d })); } catch (e) { }
      return d;
    }).catch(() => EMPTY));
  }
  const img = u => u ? '/api/social?img=' + encodeURIComponent(u) : '';
  const n = x => Number(x || 0).toLocaleString('en-US');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* GrugSocial.popup({ onClose }): every social side by side, equally easy to reach (what a banner opens).
     Esc, the X or a click outside closes it. GrugSocial.isOpen() / GrugSocial.close(). */
  const CSS = `#grugSoc{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(10,12,16,.62);font-family:inherit;padding:16px;box-sizing:border-box}
#grugSoc *{box-sizing:border-box}
#grugSoc .box{position:relative;width:min(760px,100%);max-height:100%;overflow:auto;background:#1b1d22;color:#fff;border:2px solid rgba(255,255,255,.35);border-radius:14px;padding:22px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#grugSoc h2{margin:0 0 4px;font-size:24px;font-weight:bold}
#grugSoc p.s{margin:0 0 16px;color:#b9bbbe;font-size:14px}
#grugSoc .x{position:absolute;right:12px;top:10px;width:36px;height:36px;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;font:bold 20px/36px Allo,Arial,sans-serif;cursor:pointer}
#grugSoc .x:hover{background:rgba(255,255,255,.18)}
#grugSoc .row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
#grugSoc a.c{display:flex;flex-direction:column;gap:6px;min-height:200px;padding:16px;border-radius:12px;color:#fff;text-decoration:none;transition:transform .12s}
#grugSoc a.c:hover{transform:translateY(-2px)}
#grugSoc a.c:focus-visible{outline:3px solid #fff;outline-offset:2px}
#grugSoc small{font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
#grugSoc b.t{font-size:21px;line-height:1.1}
#grugSoc span.l{font-size:13px;opacity:.92;line-height:1.35}
#grugSoc i.v{display:block;width:100%;aspect-ratio:16/9;border-radius:8px;background:#000 center/cover no-repeat;margin-top:2px}
#grugSoc em{margin-top:auto;display:block;text-align:center;font-style:normal;font-weight:bold;font-size:15px;padding:9px 10px;border-radius:9px;background:#fff}
#grugSoc .dc{background:linear-gradient(150deg,#6d78f5,#4752c4)} #grugSoc .dc em{color:#4752c4}
#grugSoc .ig{background:linear-gradient(200deg,#f9a03f,#e1306c 50%,#833ab4)} #grugSoc .ig em{color:#c1357a}
#grugSoc .yt{background:linear-gradient(160deg,#ff3d3d,#b80f0a)} #grugSoc .yt em{color:#c4120c}
@media (max-width:640px){#grugSoc .row{grid-template-columns:1fr}#grugSoc a.c{min-height:0}}`;
  let el = null, onClose = null;
  function close() { if (!el) return; el.remove(); el = null; const f = onClose; onClose = null; if (f) f(); }
  function popup(o = {}) {
    close(); onClose = o.onClose || null;
    if (!document.getElementById('grugSocCss')) { const st = document.createElement('style'); st.id = 'grugSocCss'; st.textContent = CSS; document.head.appendChild(st); }
    el = document.createElement('div'); el.id = 'grugSoc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'grugSocT');
    const draw = d => {
      if (!el) return; const D = d.discord, v = d.youtube.videos[0], L = d.links;
      el.innerHTML = `<div class="box"><button class="x" type="button" aria-label="Close">×</button><h2 id="grugSocT">Follow Grug</h2><p class="s">Pick any: new characters, games and builds show up on all three.</p><div class="row">
        <a class="c dc" href="${esc(L.discord)}" target="_blank" rel="noopener"><small>Discord</small><b class="t">Grug Discord</b><span class="l">${D.members ? `<b>${n(D.members)}</b> players, builders and creators. Come say hi.` : 'Players, builders and creators. Come say hi.'}</span><em>Join server</em></a>
        <a class="c ig" href="${esc(L.instagram)}" target="_blank" rel="noopener"><small>Instagram</small><b class="t">@grugdigital</b><span class="l">Characters, builds and behind the scenes.</span><em>Follow</em></a>
        <a class="c yt" href="${esc(L.youtube)}" target="_blank" rel="noopener"><small>YouTube</small><b class="t">PolySwitch</b>${v ? `<i class="v" style="background-image:url('https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg')"></i><span class="l">New: ${esc(v.title || 'the latest video')}</span>` : '<span class="l">Game dev, Roblox builds and the making of Grug.</span>'}<em>Subscribe</em></a>
      </div></div>`;
      el.querySelector('.x').onclick = close;
    };
    el.addEventListener('mousedown', e => { if (e.target === el) close(); });
    draw(EMPTY); document.body.appendChild(el); get().then(draw); setTimeout(() => { const a = el && el.querySelector('a.c'); if (a) a.focus({ preventScroll: true }); }, 30);
  }
  addEventListener('keydown', e => { if (el && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
  window.GrugSocial = {
    LINKS, get, img, popup, close, isOpen: () => !!el,
    thumb: (id, q = 'hqdefault') => img(`https://i.ytimg.com/vi/${id}/${q}.jpg`),
    thumbDirect: (id, q = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`,
    watch: id => 'https://www.youtube.com/watch?v=' + id,
    embed: (id, o = {}) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3` +
      (o.muted ? '&mute=1' : '') + (o.controls === false ? '&controls=0&disablekb=1&fs=0' : '') + (o.loop ? `&loop=1&playlist=${id}` : ''),
    n: x => Number(x || 0).toLocaleString('en-US'),
  };
})();
