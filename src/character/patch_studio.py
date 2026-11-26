"""Build /character/index.html (the players' Avatar Studio) from the Grug Avatar Studio file: the page head, Allo, the Pearls
chip and price sheet, and the GrugStudio API. Usage: python3 patch_studio.py SRC.html OUT.html

The "Make with Claude" sheet, the skill panel and their top bar buttons used to be added here. They are gone: agents have
their own version of the studio at /agents/studio/ (agent_studio.py builds it from this file's output), and the players'
studio carries no agent panels. patch_outfits.py also strips them from a page built before that change."""
import json, sys, pathlib

src, out = sys.argv[1], sys.argv[2]
here = pathlib.Path(__file__).parent
s = open(src, encoding='utf-8').read()
labels = json.load(open(here / 'labels.json'))

def sub(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'expected {count} of {old[:70]!r}, found {n}'
    s = s.replace(old, new)

# ---- head: title, description, icon, pointer to the agent guide
sub('<title>Grug Avatar Studio · Grug Digital</title>',
    '<title>Grug Avatar Studio · Make a Roblox character</title>\n'
    '<meta name="description" content="Make your own blocky character: pick a face and hair, dress it from the wardrobe or paint an outfit of your own, '
    'then play as it in the Grug games or take it to Roblox as a rigged R6 .glb. Free to make.">\n'
    '<link rel="icon" href="/favicon.png">\n'
    '<link rel="canonical" href="https://grugdigital.com/character/">\n'
    '<script src="/static/pearls.js"></script>\n'
    '<link rel="alternate" type="text/markdown" href="/agents/studio/claude.md" title="How AI agents (Claude) use this studio">\n'
    '<link rel="help" href="/character/claude.md">\n'
    '<link rel="preload" href="/static/fonts/allo-latin.woff2" as="font" type="font/woff2" crossorigin>\n'
    '<link rel="stylesheet" href="/static/fonts/allo.css">')

# ---- Allo, the site's font (static/fonts/allo.css), first in the studio's own font stacks (classic.css sets --g-font too)
sub("--g-font:'Fredoka',ui-rounded,", "--g-font:Allo,'Fredoka',ui-rounded,")
sub("x.font = '700 22px system-ui, Arial, sans-serif'", "x.font = '700 22px Allo, system-ui, Arial, sans-serif'")
sub("x.font = 'bold 11px system-ui'", "x.font = 'bold 11px Allo, system-ui'")

# ---- styles for the topbar button and the sheet
CSS = r"""
<style id="claude-sheet">
  #toClaude{gap:.45rem}
  #toClaude svg{width:1.15rem;height:1.15rem;flex:none}
  .cg-wrap{position:fixed;inset:0;z-index:40;display:none;place-items:center;padding:1.25rem;background:rgba(31,26,23,.34)}
  .cg-wrap.open{display:grid}
  .cg{position:relative;width:min(35rem,100%);max-height:100%;overflow:auto;padding:1.6rem 1.6rem 1.3rem;border-radius:1.25rem}
  .cg .cg-tag{display:inline-flex;align-items:center;gap:.4rem;font-weight:600;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--g-muted,#6E6B66);margin-bottom:.35rem}
  .cg h2{margin:0 0 .45rem;font:600 1.55rem/1.15 var(--g-font,Allo,system-ui,sans-serif);padding-right:2.4rem}
  .cg p{margin:0 0 1rem;line-height:1.45;color:var(--g-text-2,#47443F)}
  .cg-x{position:absolute;top:.9rem;right:.9rem}
  .cg label.cg-field{display:block;font-weight:600;font-size:.9rem;color:var(--g-text-2,#47443F);margin-bottom:.35rem}
  .cg-quote{margin:.75rem 0 .9rem;padding:.85rem 1rem;border-radius:.85rem;background:var(--g-lime-50,#F3FCE6);border:1px dashed var(--g-lime-500,#7FC423);
    font-weight:500;line-height:1.4;word-break:break-word;user-select:all}
  .cg-row{display:flex;gap:.6rem;flex-wrap:wrap}
  .cg-row .g-btn{flex:1 1 10rem;justify-content:center}
  .cg-how{margin:1.1rem 0 0;padding:0;list-style:none;display:grid;gap:.55rem}
  .cg-how li{display:grid;grid-template-columns:1.7rem 1fr;gap:.6rem;align-items:start;line-height:1.4;color:var(--g-text-2,#47443F)}
  .cg-how b{display:grid;place-items:center;width:1.7rem;height:1.7rem;border-radius:.55rem;background:var(--g-lime,#9BE338);color:#1F1A17;font-weight:700}
  .cg .cg-need{margin:1rem 0 0;font-size:.88rem;color:var(--g-muted,#6E6B66);line-height:1.45}
  .cg .cg-need a{color:inherit;font-weight:600}
  .cg .cg-need b{color:var(--g-text-2,#47443F)}
  .cg details{margin-top:1rem;border-top:1px solid var(--g-line,#D9D9D2);padding-top:.8rem}
  .cg summary{cursor:pointer;font-weight:600}
  .cg-agent{font-size:.85rem;line-height:1.5;color:var(--g-text-2,#47443F)}
  .cg-agent code{font-size:.8rem;background:var(--g-surface-2,#F0F0EC);padding:.05rem .3rem;border-radius:.3rem}
  .cg-agent ol{padding-left:1.2rem;margin:.5rem 0}
  .cg-warn{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .75rem;margin:0 0 .9rem;padding:.8rem .95rem;border-radius:.9rem;
    background:#FFF6DA;border:1px solid #F0D27A;color:#5B4708;font-size:.92rem;line-height:1.35}
  .cg-warn[hidden]{display:none}
  .pearl-chip{gap:.4rem;font-variant-numeric:tabular-nums;text-decoration:none}
  .pearl-chip svg{width:1.15rem;height:1.15rem;flex:none}
  #toSkill{gap:.45rem}
  #toSkill svg{width:1.1rem;height:1.1rem;flex:none}
  .cg-skill{margin:1.1rem 0 0;padding:1rem;border-radius:1rem;background:var(--g-surface-2,#F0F0EC)}
  .cg-skill-h{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.8rem;line-height:1.4}
  .cg-skill-h svg{width:1.5rem;height:1.5rem;flex:none;color:var(--g-lime-600,#6FB31C);margin-top:.1rem}
  .cg-skill-h b{display:block}
  .cg-skill-h span{color:var(--g-text-2,#47443F);font-size:.92rem}
  .cg .g-btn svg{flex:none}
  .sk-dl{width:100%;justify-content:center;gap:.5rem;min-height:3.1rem;font-size:1.02rem}
  .sk-file{margin:.45rem 0 0 !important;text-align:center;font-size:.82rem;color:var(--g-muted,#6E6B66) !important}
  .sk-tabs{display:flex;gap:.3rem;margin:1rem 0 .2rem;padding:.25rem;border-radius:.8rem;background:var(--g-surface-2,#F0F0EC)}
  .sk-tabs button{flex:1;min-height:2.3rem;border:0;border-radius:.6rem;background:transparent;font:600 .92rem var(--g-font,Allo,system-ui,sans-serif);color:var(--g-text-2,#47443F);cursor:pointer}
  .sk-tabs button[aria-selected=true]{background:var(--g-surface,#fff);color:var(--g-ink,#1F1A17);box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .cg-how code{font-size:.82rem;background:var(--g-surface-2,#F0F0EC);padding:.05rem .3rem;border-radius:.3rem;word-break:break-all}
  .cg-fabs{display:none}
  .cg-fab{display:none}
  @media (max-width:820px){
    #toClaude{display:none}
    .pearl-chip{padding-inline:.7rem}
    #toSkill{display:none}
    .cg-fabs{display:flex;gap:.4rem;position:fixed;z-index:5;right:.75rem;top:4.4rem}
    .cg-fab{display:inline-flex;gap:.35rem;min-height:2.3rem;padding:0 .85rem;font-size:.9rem;
      border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
    .cg-fab svg{width:1rem;height:1rem}
  }
</style>
</head>"""
sub('</style>\n</head>', '</style>' + CSS)

# the site's own Pearl icon (legacy assets/icons.js 'pearl', in the top bar's purple #d16be8)
PEARL = ('<svg viewBox="0 0 16 16" fill="#d16be8" aria-hidden="true"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1m-.343 2.414c-.78-.781-2.364-.464-3.536.707-1.171 1.172-1.488 2.755-.707 3.536s2.365.465 3.536-.707c1.172-1.171 1.488-2.755.707-3.536"/></svg>')
PUZZLE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
          '<path d="M9 3h4a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 3 0V4a1 1 0 0 1 1-1h1a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 0 0 0 3H20a1 1 0 0 1 1 1v4a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-1.5a1.5 1.5 0 0 0-3 0V20a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-4a1 1 0 0 1 1-1h1.5a1.5 1.5 0 0 0 0-3H4a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2z"/></svg>')
DOWNLOAD = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18">'
            '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>')
SPARK = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.4 6.9 7 7.5-4.6.6-6.5 2.9-7 7.5-.5-4.6-2.4-6.9-7-7.5 '
         '4.6-.6 6.5-2.9 7-7.5z"/><path d="M19 15.5c.25 2 1 2.9 3 3.2-2 .3-2.75 1.2-3 3.2-.25-2-1-2.9-3-3.2 2-.3 2.75-1.2 3-3.2z"/></svg>')

# ---- clearer label on the template picture's copy button
sub('<button id="clCopyRef" class="g-btn"><i data-g-icon="clipboard"></i>Copy</button>',
    '<button id="clCopyRef" class="g-btn"><i data-g-icon="clipboard"></i>Copy picture</button>')

# ---- finish page: point out when the starter outfit is still on
sub('<div class="pg-head"><h2 id="doneTitle">All done!</h2><p>Download everything for Roblox, or tweak the look.</p></div>',
    '<div class="pg-head"><h2 id="doneTitle">All done!</h2><p>Download everything for Roblox, or tweak the look.</p></div>\n'
    '    <div id="noOutfit" class="cg-warn" hidden><b>Still in the starter outfit.</b> Paint a custom shirt and pants in three steps.'
    '<button id="noOutfitGo" class="g-btn g-btn--primary g-btn--sm"><i data-g-icon="magic_wand"></i>Paint an outfit</button></div>')

# ---- topbar button
sub('<button id="toFinish" class="g-btn g-btn--primary">',
    f'<a id="pearlChip" class="g-btn pearl-chip" href="/character/pearls/" title="Your Pearls: tap for more">{PEARL}<span id="pearlNum">0</span></a>\n  '
    '<button id="toFinish" class="g-btn g-btn--primary">')
# (the phone row of floating buttons: patch_outfits.py puts the My outfits button in it)
sub('<div id="say" class="say box" hidden></div>', '<div id="say" class="say box" hidden></div>\n<div class="cg-fabs"></div>')

# ---- share a few more of the creator's internals with the agent API
sub('window.__creator = { CH, HAIR, HEADS, PT, get FACE(){ return FACE; }, setCat,',
    'window.__creator = { CH, HAIR, HEADS, PT, get FACE(){ return FACE; }, D, pickPart, touch, wearTee, resetAll, TEES, HAIRCOL, sheetsReady, say, setCat,')

# ---- the agent API, after the creator
agent = open(here / 'agent.js', encoding='utf-8').read().replace('__LABELS__', json.dumps(labels, ensure_ascii=False))
PAY = f'''<section id="payDlg" class="cg-wrap" aria-labelledby="payTitle">
  <div class="cg box" role="dialog" aria-modal="true">
    <div class="cg-tag">{PEARL.replace('<svg ', '<svg width="16" height="16" ')}Pearls</div>
    <h2 id="payTitle">Export for 25 Pearls?</h2>
    <p id="payText"></p>
    <div class="cg-row">
      <button id="payNo" class="g-btn">Not now</button>
      <button id="payGo" class="g-btn g-btn--primary">Export</button>
      <a id="payMore" class="g-btn g-btn--primary" href="/character/pearls/" hidden>Get Pearls</a>
    </div>
    <p class="cg-need">Making and saving characters is always free. Pearls are only for exporting an R6 character.</p>
  </div>
</section>
'''
sub('</script>\n</body>\n</html>', '</script>\n' + PAY + '<script id="agent-api">\n' + agent + '</script>\n</body>\n</html>')

# ---- the "My outfits" layer (save characters for the Grug games): src/character/patch_outfits.py
sys.path.insert(0, str(here)); import patch_outfits
s = patch_outfits.apply(s)

open(out, 'w', encoding='utf-8').write(s)
print('wrote', out, len(s))
