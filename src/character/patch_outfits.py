"""The "My outfits" layer of the Avatar Studio: save characters for the Grug games and pick who you play as.

    python3 src/character/patch_outfits.py character/index.html      refresh the layer (and the agent API) in place

patch_studio.py calls apply() as its last step, so a full rebuild (build.py) includes it. Run this file on its own to update
an already-built character/index.html when only src/character/outfits.js, agent.js or this file changed (no studio file
needed). Everything it adds sits between <!--go:…--> markers, so running it again replaces the old copy."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent))
import json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
SHIRT = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c0 1.7-1.8 3-4 3S8 4.7 8 3z"/></svg>')

CSS = r"""<!--go:css--><style id="go-css">
  #toOutfits{gap:.45rem} #toOutfits svg{width:1.15rem;height:1.15rem;flex:none}
  .go-back{flex:none;width:2.5rem;min-width:0;height:2.5rem;padding:0!important;display:grid;place-items:center;border-radius:.8rem}
  .go-back svg{width:1.2rem;height:1.2rem}
  #match > i{display:none}
  @media (max-width:1500px) and (min-width:761px){.topbar > h1{display:none}}   /* room for the Back button and every tab */
  .go-float{position:fixed;z-index:5;left:1.25rem;top:5.9rem;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
  #goCount:not(:empty){color:var(--g-muted,#6E6B66);font-weight:500}
  .go-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.7rem;margin-top:1rem}
  .go-card{display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.6rem;border-radius:1rem;background:var(--g-surface-2,#F0F0EC);border:2px solid transparent;text-align:center}
  .go-card.on{border-color:var(--g-lime-500,#7FC423);background:var(--g-lime-50,#F3FCE6)}
  .go-card img,.go-noimg{width:100%;aspect-ratio:1;border-radius:.7rem;object-fit:cover;background:#fff}
  .go-card b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .go-card .g-btn{justify-content:center}
  .go-badge{font-weight:600;font-size:.85rem;color:var(--g-lime-600,#6FB31C);min-height:2rem;display:grid;place-items:center}
  .go-acts{display:flex;gap:.25rem;flex-wrap:wrap;justify-content:center} .go-acts .g-btn{padding-inline:.55rem;font-size:.8rem}
  .go-ren{width:100%;text-align:center}
  .go-empty{grid-column:1/-1;color:var(--g-muted,#6E6B66);text-align:center;margin:1rem 0}
  .go-none{grid-column:1/-1;justify-self:center}
  .go-finish{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem;margin:0 0 .9rem}
  .go-finish span{font-size:.88rem;color:var(--g-muted,#6E6B66)}
  @media (max-width:820px){ #toOutfits{display:none} }
  /* Try this avatar out in the arcade: bottom left, a slideshow of Grug renders in Grug City */
  .go-arc{position:fixed;z-index:5;left:1.25rem;bottom:1.25rem;width:19.5rem;height:11.75rem;padding:0;border:0;border-radius:1.25rem;overflow:hidden;cursor:pointer;
    background:#2a4a1a;color:#fff;font:inherit;text-align:left;box-shadow:0 8px 26px rgba(0,0,0,.28);transition:transform .18s,box-shadow .18s}
  .go-arc:hover{transform:translateY(-3px) scale(1.015);box-shadow:0 12px 32px rgba(0,0,0,.34)} .go-arc:disabled{cursor:progress}
  .go-arc .sl{position:absolute;inset:0;opacity:0;transition:opacity 1.1s ease}
  .go-arc .sl.on{opacity:1}
  .go-arc .bg{position:absolute;inset:-8%;background-size:cover;background-position:center;transform:scale(1.04)}
  .go-arc .sl.on .bg{animation:goPan 7s ease-in-out both}
  .go-arc .sl img{position:absolute;bottom:-6%;height:92%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))}
  .go-arc .sl.on img{animation:goHop .9s cubic-bezier(.3,1.5,.6,1) both}
  .go-arc .sl.on img + img{animation-delay:.12s} .go-arc .sl.on img + img + img{animation-delay:.24s}
  .go-arc .sh{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78) 0,rgba(0,0,0,.25) 42%,rgba(0,0,0,0) 62%)}
  .go-arc .tx{position:absolute;left:1rem;right:.85rem;bottom:.85rem;display:flex;align-items:center;justify-content:space-between;gap:.7rem;
    font-weight:700;font-size:1.08rem;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.55)}
  .go-arc .tx i{flex:none;width:2.4rem;height:2.4rem;border-radius:999px;background:#9BE338;color:#1a1a1a;display:grid;place-items:center;text-shadow:none;transition:transform .18s}
  .go-arc .tx i svg{width:1.2rem;height:1.2rem}
  .go-arc:hover .tx i{transform:translateX(3px)}
  .go-arc.busy .tx i{animation:goSpin .9s linear infinite}
  @keyframes goPan{from{transform:scale(1.04) translateX(-2.5%)}to{transform:scale(1.12) translateX(2.5%)}}
  @keyframes goHop{from{transform:translateY(28%);opacity:0}to{transform:none;opacity:1}}
  @keyframes goSpin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.go-arc .sl.on .bg,.go-arc .sl.on img,.go-arc.busy .tx i{animation:none}}
  @media (max-width:820px){   /* portrait: a smaller card at the left, just above the editor panel (outfits.js sets --arc-top) */
    .go-arc{left:.75rem;bottom:auto;top:var(--arc-top,58vh);width:11.5rem;height:6.9rem;border-radius:1rem}
    .go-arc .tx{left:.6rem;right:.5rem;bottom:.5rem;gap:.4rem;font-size:.82rem}
    .go-arc .tx i{width:1.8rem;height:1.8rem} .go-arc .tx i svg{width:.95rem;height:.95rem}
  }
  @media (max-height:560px) and (min-width:821px){ .go-arc{width:14rem;height:8.4rem;left:.9rem;bottom:.9rem} .go-arc .tx{font-size:.9rem} }
  /* wardrobe (src/character/wardrobe.js) */
  .g-card:has(> #exGrid){display:none}
  .wd-head{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem}
  .wd-count{font-size:.8rem;color:var(--g-muted,#6E6B66)}
  .wd-tabs{display:grid;grid-template-columns:1fr 1fr;gap:.3rem;padding:.25rem;border-radius:.9rem;background:var(--g-surface-2,#F0F0EC);margin:.2rem 0 .6rem}
  .wd-tabs button,.wd-seg button,.wd-chip{all:unset;cursor:pointer;text-align:center;font-weight:600;font-size:.92rem;border-radius:.7rem;padding:.5rem .6rem}
  .wd-tabs button.on{background:var(--g-lime-500,#9BE338);color:#1a1a1a}
  .wd-chips{display:flex;gap:.35rem;overflow-x:auto;padding-bottom:.35rem;margin-bottom:.4rem;scrollbar-width:thin}
  .wd-chip{flex:none;font-size:.82rem;padding:.35rem .7rem;border-radius:999px;background:var(--g-surface-2,#F0F0EC)}
  .wd-chip.on{background:var(--g-text,#1F1A17);color:var(--g-surface,#fff)}
  .wd-arms{margin:0 0 .6rem}
  .wd-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:.25rem;padding:.2rem;border-radius:.8rem;background:var(--g-surface-2,#F0F0EC)}
  .wd-seg button{font-size:.8rem;padding:.4rem .3rem}
  .wd-seg button.on{background:var(--g-surface,#fff);box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .wd-mix{font-size:.8rem;color:var(--g-muted,#6E6B66);margin:.45rem .1rem 0;line-height:1.45}
  .wd-mix b{color:var(--g-text,#1a1a1a);font-weight:600}
  .wd-link{all:unset;cursor:pointer;text-decoration:underline;margin-left:.3rem;color:var(--g-text,#1a1a1a)}
  .wd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:.5rem}
  .wd-item{all:unset;cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:center;gap:.1rem;padding:.35rem .35rem .5rem;border-radius:.9rem;background:var(--g-surface-2,#F0F0EC);border:2px solid transparent;text-align:center;transition:transform .12s}
  .wd-item:hover{transform:translateY(-2px)}
  .wd-item.on{border-color:var(--g-lime-500,#9BE338);background:var(--g-lime-50,#F3FCE6)}
  .wd-item img{width:100%;aspect-ratio:1;object-fit:contain}
  .wd-item b{font-size:.8rem;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wd-item small{font-size:.7rem;color:var(--g-muted,#6E6B66)}
  .wd-tag{position:absolute;top:.35rem;right:.35rem;font-size:.68rem;font-weight:700;padding:.1rem .35rem;border-radius:.4rem;background:var(--g-text,#1F1A17);color:var(--g-surface,#fff)}
  .wd-empty{grid-column:1/-1;color:var(--g-muted,#6E6B66);text-align:center;margin:1rem 0}
  .flat .wd-item{background:var(--off,#F0F0EC);box-shadow:inset 0 0 0 1px var(--edge,transparent)}
</style><!--/go:css-->"""

SHEET = f"""<!--go:sheet--><section id="goSheet" class="cg-wrap" aria-labelledby="goTitle">
  <div class="cg box" role="dialog" aria-modal="true" style="width:min(44rem,100%)">
    <button id="goClose" class="g-btn g-btn--ghost g-btn--icon g-btn--sm cg-x" aria-label="Close"><i data-g-icon="cross"></i></button>
    <div class="cg-tag">{SHIRT.replace('<svg ', '<svg width="16" height="16" ')}For the Grug games</div>
    <h2 id="goTitle">My outfits</h2>
    <p>Save your characters here and pick who you play as in the Grug games. Your other outfits show up as the other
      players. Saving is free, and they stay in this browser.</p>
    <div class="cg-row">
      <button id="goSave" class="g-btn g-btn--primary"><i data-g-icon="floppy_disk"></i>Save this character</button>
      <button id="goSaveNew" class="g-btn" hidden>Save as a new outfit</button>
      <a class="g-btn" href="/arcade/">Play the games<i data-g-icon="arrow_right"></i></a>
    </div>
    <div id="goList" class="go-grid"></div>
  </div>
</section><!--/go:sheet-->"""

def strip(s):
    return re.sub(r'<!--go:(\w+)-->.*?<!--/go:\1-->', '', s, flags=re.S)

def apply(s, agent_js=None, labels=None):
    """Add (or replace) the outfits layer. agent_js/labels: also refresh the agent API block from source."""
    import patch_pose; s = patch_pose.apply(s)   # the standing reference picture (and black soles / leg tops)
    s = strip(s)
    def sub(old, new):
        nonlocal s
        n = s.count(old); assert n == 1, f'expected 1 of {old[:70]!r}, found {n}'
        s = s.replace(old, new)
    sub('<link rel="help" href="/character/claude.md">',
        '<link rel="help" href="/character/claude.md"><!--go:head-->\n<script src="/static/outfits.js"></script><!--/go:head-->')
    sub('</head>', CSS + '</head>')
    # a Back button at the start of the top bar: to the page they came from on this site, or the home page
    sub('<header class="topbar box">\n  <span class="g-brandmark"', '<header class="topbar box">\n  <!--go:back--><a id="goBack" class="g-btn go-back" href="/" title="Back" aria-label="Back to the previous page">'
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></a>'
        '<script>document.getElementById("goBack").addEventListener("click", e => { let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin && new URL(document.referrer).pathname !== location.pathname; } catch (x) {} if (same && history.length > 1) { e.preventDefault(); history.back(); } });</script>\n  <!--/go:back--><span class="g-brandmark"')
    sub('<div class="cg-fabs">', f'<!--go:btn--><button id="toOutfits" class="g-btn go-float" title="Save characters for the Grug games and pick who you play as">{SHIRT}My outfits<span id="goCount"></span></button><!--/go:btn--><div class="cg-fabs">')
    sub('<div class="cg-fabs">', f'<div class="cg-fabs"><!--go:fab--><button id="toOutfitsM" class="g-btn cg-fab" title="My outfits">{SHIRT}Outfits</button><!--/go:fab-->')
    # Try this avatar out in the arcade: saves it, plays as it, opens the Arcade (the slides are filled in by outfits.js)
    sub('<!--go:btn-->', '<!--go:arc--><button id="toArcade" class="go-arc" type="button" title="Save this character, play as it, and open the Grug Arcade">'
        '<span class="sh"></span><span class="tx"><span>Try this avatar out in the arcade</span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></i></span></button><!--/go:arc--><!--go:btn-->')
    i = s.index('<div id="noOutfit"'); j = s.index('</div>', i) + len('</div>')
    s = s[:j] + ('<!--go:finish-->\n    <div class="go-finish"><button id="goSaveF" class="g-btn g-btn--primary"><i data-g-icon="floppy_disk"></i>Save for the Grug games</button>'
                 '<span>Free. Play as this character in the Grug games.</span></div><!--/go:finish-->') + s[j:]
    if agent_js is not None:
        a = s.index('<script id="agent-api">\n') + len('<script id="agent-api">\n'); b = s.index('</script>', a)
        s = s[:a] + agent_js.replace('__LABELS__', json.dumps(labels, ensure_ascii=False)) + s[b:]
    js = (HERE / 'outfits.js').read_text(encoding='utf-8')
    wd = (HERE / 'wardrobe.js').read_text(encoding='utf-8')
    sub('</script>\n</body>\n</html>', '</script>\n<!--go:js-->' + SHEET + '\n<script id="game-outfits">\n' + js + '</script>\n<script id="wardrobe">\n' + wd + '</script>\n<!--/go:js--></body>\n</html>')
    return s

if __name__ == '__main__':
    path = pathlib.Path(sys.argv[1])
    s = path.read_text(encoding='utf-8')
    s = apply(s, (HERE / 'agent.js').read_text(encoding='utf-8'), json.load(open(HERE / 'labels.json', encoding='utf-8')))
    path.write_text(s, encoding='utf-8'); print('refreshed the outfits layer in', path, len(s))
