"""The "My outfits" layer of the Avatar Studio: save characters for the Grug games and pick who you play as.

    python3 src/character/patch_outfits.py character/index.html      refresh the layer (and the agent API) in place

patch_studio.py calls apply() as its last step, so a full rebuild (build.py) includes it. Run this file on its own to update
an already-built character/index.html when only src/character/outfits.js, agent.js or this file changed (no studio file
needed). Everything it adds sits between <!--go:…--> markers, so running it again replaces the old copy."""
import json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
SHIRT = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c0 1.7-1.8 3-4 3S8 4.7 8 3z"/></svg>')

CSS = r"""<!--go:css--><style id="go-css">
  #toOutfits{gap:.45rem} #toOutfits svg{width:1.15rem;height:1.15rem;flex:none}
  .go-float{position:fixed;z-index:5;left:1.25rem;top:5.9rem;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
  #goCount:not(:empty){min-width:1.3rem;height:1.3rem;padding:0 .35rem;border-radius:99px;background:var(--g-lime,#9BE338);color:#1F1A17;font-size:.78rem;display:inline-grid;place-items:center}
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
    s = strip(s)
    def sub(old, new):
        nonlocal s
        n = s.count(old); assert n == 1, f'expected 1 of {old[:70]!r}, found {n}'
        s = s.replace(old, new)
    sub('<link rel="help" href="/character/claude.md">',
        '<link rel="help" href="/character/claude.md"><!--go:head-->\n<script src="/static/outfits.js"></script><!--/go:head-->')
    sub('</head>', CSS + '</head>')
    sub('<div class="cg-fabs">', f'<!--go:btn--><button id="toOutfits" class="g-btn go-float" title="Save characters for the Grug games and pick who you play as">{SHIRT}My outfits<span id="goCount"></span></button><!--/go:btn--><div class="cg-fabs">')
    sub('<div class="cg-fabs">', f'<div class="cg-fabs"><!--go:fab--><button id="toOutfitsM" class="g-btn cg-fab" title="My outfits">{SHIRT}Outfits</button><!--/go:fab-->')
    i = s.index('<div id="noOutfit"'); j = s.index('</div>', i) + len('</div>')
    s = s[:j] + ('<!--go:finish-->\n    <div class="go-finish"><button id="goSaveF" class="g-btn g-btn--primary"><i data-g-icon="floppy_disk"></i>Save for the Grug games</button>'
                 '<span>Free. Play as this character in the Grug games.</span></div><!--/go:finish-->') + s[j:]
    if agent_js is not None:
        a = s.index('<script id="agent-api">\n') + len('<script id="agent-api">\n'); b = s.index('</script>', a)
        s = s[:a] + agent_js.replace('__LABELS__', json.dumps(labels, ensure_ascii=False)) + s[b:]
    js = (HERE / 'outfits.js').read_text(encoding='utf-8')
    sub('</script>\n</body>\n</html>', '</script>\n<!--go:js-->' + SHEET + '\n<script id="game-outfits">\n' + js + '</script>\n<!--/go:js--></body>\n</html>')
    return s

if __name__ == '__main__':
    path = pathlib.Path(sys.argv[1])
    s = path.read_text(encoding='utf-8')
    s = apply(s, (HERE / 'agent.js').read_text(encoding='utf-8'), json.load(open(HERE / 'labels.json', encoding='utf-8')))
    path.write_text(s, encoding='utf-8'); print('refreshed the outfits layer in', path, len(s))
