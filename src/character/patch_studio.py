"""Build /character/index.html from the Grug Avatar Studio file: add the "Make with Claude" sheet, the agent guide text,
and the GrugStudio agent API. Usage: python3 patch_studio.py SRC.html OUT.html"""
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
    '<meta name="description" content="Make a blocky Roblox R6 character: pick hair and a face, paint a custom shirt and pants with an AI image editor, '
    'and download the rigged .glb. Works with Claude: paste this page\'s link into a Claude chat and ask for the character you want.">\n'
    '<link rel="icon" href="/favicon.png">\n'
    '<link rel="alternate" type="text/markdown" href="/character/claude.md" title="How AI agents (Claude) use this studio">\n'
    '<link rel="help" href="/character/claude.md">')

# ---- styles for the topbar button and the sheet
CSS = r"""
<style id="claude-sheet">
  #toClaude{gap:.45rem}
  #toClaude svg{width:1.15rem;height:1.15rem;flex:none}
  .cg-wrap{position:fixed;inset:0;z-index:40;display:none;place-items:center;padding:1.25rem;background:rgba(31,26,23,.34)}
  .cg-wrap.open{display:grid}
  .cg{position:relative;width:min(35rem,100%);max-height:100%;overflow:auto;padding:1.6rem 1.6rem 1.3rem;border-radius:1.25rem}
  .cg .cg-tag{display:inline-flex;align-items:center;gap:.4rem;font-weight:600;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--g-muted,#6E6B66);margin-bottom:.35rem}
  .cg h2{margin:0 0 .45rem;font:600 1.55rem/1.15 var(--g-font,'Fredoka',system-ui,sans-serif);padding-right:2.4rem}
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
  .cg details{margin-top:1rem;border-top:1px solid var(--g-line,#D9D9D2);padding-top:.8rem}
  .cg summary{cursor:pointer;font-weight:600}
  .cg-agent{font-size:.85rem;line-height:1.5;color:var(--g-text-2,#47443F)}
  .cg-agent code{font-size:.8rem;background:var(--g-surface-2,#F0F0EC);padding:.05rem .3rem;border-radius:.3rem}
  .cg-agent ol{padding-left:1.2rem;margin:.5rem 0}
  .cg-fab{display:none}
  @media (max-width:820px){
    #toClaude{display:none}
    .cg-fab{display:inline-flex;position:fixed;z-index:5;right:.75rem;top:4.4rem;gap:.35rem;min-height:2.3rem;padding:0 .85rem;font-size:.9rem;
      border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
    .cg-fab svg{width:1rem;height:1rem}
  }
</style>
</head>"""
sub('</style>\n</head>', '</style>' + CSS)

SPARK = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 4.6 2.4 6.9 7 7.5-4.6.6-6.5 2.9-7 7.5-.5-4.6-2.4-6.9-7-7.5 '
         '4.6-.6 6.5-2.9 7-7.5z"/><path d="M19 15.5c.25 2 1 2.9 3 3.2-2 .3-2.75 1.2-3 3.2-.25-2-1-2.9-3-3.2 2-.3 2.75-1.2 3-3.2z"/></svg>')

# ---- the sheet, first thing in <body> so page-to-text readers (an AI fetching the link) see the agent guide first
SHEET = f'''<body class="g-root flat" data-cat="head">
<section id="claudeGuide" class="cg-wrap" aria-labelledby="cgTitle">
  <div class="cg box" role="dialog" aria-modal="true">
    <button id="cgClose" class="g-btn g-btn--ghost g-btn--icon g-btn--sm cg-x" aria-label="Close"><i data-g-icon="cross"></i></button>
    <div class="cg-tag">{SPARK.replace('<svg ', '<svg width="16" height="16" ')}Works with Claude</div>
    <h2 id="cgTitle">Let Claude make your avatar</h2>
    <p>Need a character for your Roblox game? Tell Claude what you want. It opens this studio, picks hair and a face,
      paints the outfit with Gemini (Nano Banana), puts it on your character and hands you the Roblox R6 file.</p>
    <label class="cg-field" for="cgIdea">Describe your character</label>
    <input id="cgIdea" class="g-input" type="text" value="a female character wearing a warm fall outfit" autocomplete="off">
    <div class="cg-quote" id="cgPrompt">Use https://grugdigital.pages.dev/character/ to make a female character wearing a warm fall outfit. Download the Roblox R6 file for me.</div>
    <div class="cg-row">
      <button id="cgCopy" class="g-btn g-btn--primary"><i data-g-icon="clipboard"></i>Copy prompt</button>
      <a id="cgOpen" class="g-btn" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude<i data-g-icon="arrow_right"></i></a>
    </div>
    <ol class="cg-how">
      <li><b>1</b><span>Paste the prompt into a Claude chat.</span></li>
      <li><b>2</b><span>Claude builds the character here and paints the outfit in Gemini.</span></li>
      <li><b>3</b><span>You get a rigged R6 <code>.glb</code>, ready for Roblox Studio's 3D Importer.</span></li>
    </ol>
    <p class="cg-need">Claude needs a browser it can use (Claude in Chrome) to do this for you, and for custom outfits you need to be
      signed in to Gemini in that browser. Without one, Claude gives you a link that opens this studio with your character already set up.</p>
    <details>
      <summary>Instructions for Claude and other AI agents</summary>
      <div class="cg-agent" id="forAgents">
        <p><b>AI agent reading this page:</b> this is a browser app (WebGL), so you need a real browser to use it (Claude in Chrome,
          computer use, or Playwright). Read the full guide first: <a href="https://grugdigital.pages.dev/character/claude.md">https://grugdigital.pages.dev/character/claude.md</a>.</p>
        <ol>
          <li>Open this page and wait for <code>GrugStudio.ready</code> (or <code>await GrugStudio.whenReady</code>).</li>
          <li><code>GrugStudio.options()</code> lists every choice. Apply a look with
            <code>GrugStudio.set({{name, skin, head, hair, hairColor, eyes, brows, mouth, outfit}})</code>.</li>
          <li>Outfit: <code>GrugStudio.openPaint()</code>, click <b>Copy</b> under the template picture and paste it into
            Gemini (gemini.google.com), then paste <code>GrugStudio.prompt()</code> (or click <b>Copy prompt</b>) and send.</li>
          <li>Copy Gemini's finished image, come back to this tab and press Ctrl/⌘+V (or call <code>GrugStudio.wear(image)</code>).
            Check the silhouette match, then click <b>Wear it</b>.</li>
          <li><code>await GrugStudio.downloadR6()</code> saves <code>&lt;Name&gt;.glb</code>, the rigged Roblox R6 character.
            Give that file to the person.</li>
        </ol>
        <p>No browser? Send the person a recipe link instead, e.g.
          <code>https://grugdigital.pages.dev/character/?name=Maple&amp;hair=wavy-long&amp;hairColor=chestnut&amp;eyes=lashes&amp;outfit=cozy+fall+sweater</code>,
          and walk them through the Gemini step.</p>
      </div>
    </details>
  </div>
</section>'''
sub('<body class="g-root flat" data-cat="head">', SHEET)

# ---- topbar button
sub('<button id="toFinish" class="g-btn g-btn--primary">',
    f'<button id="toClaude" class="g-btn" title="Let Claude make your avatar">{SPARK}Make with Claude</button>\n  <button id="toFinish" class="g-btn g-btn--primary">')
sub('<div id="say" class="say box" hidden></div>',
    f'<div id="say" class="say box" hidden></div>\n<button id="toClaudeM" class="g-btn cg-fab" title="Let Claude make your avatar">{SPARK}Claude</button>')

# ---- share a few more of the creator's internals with the agent API
sub('window.__creator = { CH, HAIR, HEADS, PT, get FACE(){ return FACE; }, setCat,',
    'window.__creator = { CH, HAIR, HEADS, PT, get FACE(){ return FACE; }, D, pickPart, touch, wearTee, resetAll, TEES, HAIRCOL, sheetsReady, say, setCat,')

# ---- the agent API, after the creator
agent = open(here / 'agent.js', encoding='utf-8').read().replace('__LABELS__', json.dumps(labels, ensure_ascii=False))
sub('</script>\n</body>\n</html>', '</script>\n<script id="agent-api">\n' + agent + '</script>\n</body>\n</html>')

open(out, 'w', encoding='utf-8').write(s)
print('wrote', out, len(s))
