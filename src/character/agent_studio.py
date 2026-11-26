"""Build /agents/studio/index.html, the agents' version of the Avatar Studio, from the players' one.

    python3 src/character/agent_studio.py            (after character/index.html is built or refreshed)

Same studio, same window.GrugStudio, same saved data (it's the same site address): the page gets body.agent, loses the
players' layer, and gains the console (agent_studio.css / agent_studio.js) with the agent's instructions first in <body>,
so an AI that only fetches the link reads them. No pickers, sliders or tabs are shown. build.py and patch_outfits.py's
callers run this after refreshing /character/. Re-run src/seo/seo_head.py afterwards (it writes this page's share card)."""
import pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
URL = 'https://grugdigital.com/agents/studio/'

CONSOLE = '''<aside id="agent" aria-label="Agent console">
  <header class="ag-top">
    <a class="ag-brand" href="/agents/" title="Grug for agents"><img src="/favicon.png" alt="">Grug <span>for agents</span></a>
    <nav aria-label="Agent links"><a href="/agents/studio/claude.md">Guide</a><a href="/agents/#skills">Skill</a><a href="/character/">Players' studio</a></nav>
  </header>
  <div class="ag-scroll">
  <section class="ag-brief" id="forAgents">
    <h1>Avatar Studio for agents</h1>
    <p><b>AI agent reading this page:</b> make a rigged Roblox R6 character in three steps, all required: the look, a shirt and
      pants painted in Gemini, the <code>.glb</code> export. Use <code>window.GrugStudio</code> (after <code>await GrugStudio.whenReady</code>)
      or the fields below; they do the same thing. It needs a real browser, ideally the person's own Chrome, where they are signed in to Gemini.
      Guide: <a href="https://grugdigital.com/agents/studio/claude.md">https://grugdigital.com/agents/studio/claude.md</a></p>
  </section>
  <div class="ag-next" id="agNext" aria-live="polite"><small>Next</small><p>Loading the studio. Run <code>await GrugStudio.whenReady</code>.</p></div>

  <details class="ag-step" id="agLook" open>
    <summary><b>1</b>Look<code>await GrugStudio.set({…})</code></summary>
    <div class="in">
      <label for="agJson">The character as JSON. Edit it and apply; only the keys you keep are changed.</label>
      <textarea id="agJson" rows="13" spellcheck="false" autocomplete="off"></textarea>
      <div class="ag-row">
        <button type="button" class="ag-btn go" id="agApply">Apply</button>
        <button type="button" class="ag-btn" id="agRandom">Random</button>
        <button type="button" class="ag-btn" id="agViewFace">Face view</button>
        <button type="button" class="ag-btn" id="agViewBody">Body view</button>
      </div>
      <p class="ag-msg" id="agLookMsg"></p>
      <details><summary>Every choice</summary><div id="agOptions"></div></details>
    </div>
  </details>

  <details class="ag-step" id="agOutfit">
    <summary><b>2</b>Outfit<code>await GrugStudio.paintOutfit("…")</code></summary>
    <div class="in">
      <label for="agDesc">Garments, colours, materials and shoes. Be concrete.</label>
      <input id="agDesc" type="text" autocomplete="off" placeholder="rust-orange chunky knit sweater, dark-wash jeans, brown suede ankle boots">
      <div class="ag-row">
        <button type="button" class="ag-btn" id="agCopyPic">Copy picture</button>
        <button type="button" class="ag-btn" id="agCopyPrompt">Copy prompt</button>
        <a class="ag-btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Open Gemini</a>
      </div>
      <ol class="ag-how">
        <li>Click <b>Copy picture</b> (a real click), then paste it into Gemini's message box.</li>
        <li>Click <b>Copy prompt</b>, paste it after the picture, and send. Don't type the prompt: it has line breaks.</li>
        <li>Copy Gemini's painted picture, click the 3D view here and press Ctrl+V (Cmd+V on a Mac), or choose the file.</li>
        <li>Click <b>Wear it</b> on the sheet that opens. A match of 0.85 or more means it lined up.</li>
      </ol>
      <div class="ag-row"><button type="button" class="ag-btn" id="agFile">Choose the painted picture</button></div>
      <p class="ag-msg" id="agOutfitMsg">No painted picture yet.</p>
    </div>
  </details>

  <details class="ag-step" id="agExport">
    <summary><b>3</b>Export<code>await GrugStudio.downloadR6(null, { spendPearls: true })</code></summary>
    <div class="in">
      <p class="ag-msg" id="agPearls" style="margin-top:0"></p>
      <div class="ag-row">
        <button type="button" class="ag-btn go" id="agDownload">Download .glb</button>
        <button type="button" class="ag-btn" id="agScript">Copy R6 setup script</button>
      </div>
      <p class="ag-msg" id="agExportMsg"></p>
    </div>
  </details>

  <details class="ag-ref"><summary>The API in one screen</summary><pre id="agHelp">GrugStudio.help()</pre></details>
  </div>
</aside>
'''

def build():
    s = (ROOT / 'character' / 'index.html').read_text(encoding='utf-8')
    def sub(old, new):
        nonlocal s
        n = s.count(old); assert n == 1, f'expected 1 of {old[:70]!r}, found {n}'
        s = s.replace(old, new)
    # the players' own layer and its note for agents don't belong here; the share card is rewritten by src/seo/seo_head.py
    s = re.sub(r'<!--go:(note|players)-->.*?<!--/go:\1-->', '', s, flags=re.S)
    s = re.sub(r'\n?<!-- seo: written by src/seo/seo_head\.py.*?<!-- /seo -->', '', s, flags=re.S)
    s, n = re.subn(r'<title>[^<]*</title>', '<title>Grug Avatar Studio for agents · Roblox R6 characters from one prompt</title>', s, count=1); assert n == 1
    s, n = re.subn(r'<meta name="description" content="[^"]*">',
                   '<meta name="description" content="The Grug Avatar Studio with the hand controls taken away, for AI agents: set a look with window.GrugStudio, '
                   'paint a shirt and pants in Gemini, and export a rigged Roblox R6 .glb. No pickers or sliders, and the steps are on the page.">', s, count=1); assert n == 1
    sub('<link rel="canonical" href="https://grugdigital.com/character/">', f'<link rel="canonical" href="{URL}">')
    sub('</head>', '<style id="agent-studio">\n' + (HERE / 'agent_studio.css').read_text(encoding='utf-8') + '</style>\n</head>')
    sub('<body class="g-root flat" data-cat="head">', '<body class="g-root flat agent" data-cat="head">\n' + CONSOLE)
    sub('<!--/go:js--></body>', '<!--/go:js--><script id="agent-studio-js">\n' + (HERE / 'agent_studio.js').read_text(encoding='utf-8') + '</script>\n</body>')
    out = ROOT / 'agents' / 'studio' / 'index.html'; out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(s, encoding='utf-8'); print('wrote', out.relative_to(ROOT), len(s))

if __name__ == '__main__':
    build()
