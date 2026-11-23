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
    '<link rel="canonical" href="https://grugdigital.com/character/">\n'
    '<script src="/static/pearls.js"></script>\n'
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
  .sk-tabs button{flex:1;min-height:2.3rem;border:0;border-radius:.6rem;background:transparent;font:600 .92rem var(--g-font,'Fredoka',system-ui,sans-serif);color:var(--g-text-2,#47443F);cursor:pointer}
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
    <div class="cg-quote" id="cgPrompt">Use https://grugdigital.com/character/ to make a female character wearing a warm fall outfit. Paint the outfit in Gemini, then download the Roblox R6 file for me.</div>
    <div class="cg-row">
      <button id="cgCopy" class="g-btn g-btn--primary"><i data-g-icon="clipboard"></i>Copy prompt</button>
      <a id="cgOpen" class="g-btn" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude<i data-g-icon="arrow_right"></i></a>
    </div>
    <ol class="cg-how">
      <li><b>1</b><span>Paste the prompt into a Claude chat.</span></li>
      <li><b>2</b><span>Claude builds the character here and paints the outfit in Gemini.</span></li>
      <li><b>3</b><span>You get a rigged R6 <code>.glb</code>, ready for Roblox Studio's 3D Importer. Exporting costs 25 Pearls; Claude asks you first.</span></li>
    </ol>
    <p class="cg-need">Claude needs a browser it can use (Claude in Chrome) to do this for you, and for custom outfits you need to be
      signed in to Gemini in that browser. Without one, Claude gives you a link that opens this studio with your character already set up.</p>
    <div class="cg-skill">
      <div class="cg-skill-h">{PUZZLE}<div><b>Building a Roblox game?</b><span>Add the Grug skill to Claude, and Claude makes your
        NPCs here whenever your game needs characters.</span></div></div>
      <div class="cg-row">
        <a class="g-btn g-btn--primary" href="/character/roblox-characters.zip" download>{DOWNLOAD}Download the skill</a>
        <button type="button" class="g-btn" id="cgSkillHow">How to install</button>
      </div>
    </div>
    <details>
      <summary>Instructions for Claude and other AI agents</summary>
      <div class="cg-agent" id="forAgents">
        <p><b>AI agent reading this page:</b> you were asked to make a Roblox character with this studio. The job has three
          parts and <b>all three are required</b>: (1) hair and face, (2) a custom shirt and pants painted in Gemini
          (Nano Banana), (3) the R6 <code>.glb</code> download, which costs Pearls (the site's currency): tell the person the price and ask before spending. A character in the starter tee is not finished, and
          <code>downloadR6()</code> refuses until a painted outfit is worn. This is a browser app (WebGL): use a real
          browser (Claude in Chrome, computer use or Playwright), in the person's own Chrome if you can, since that is
          where they are signed in to Gemini. Full guide: <a href="https://grugdigital.com/character/claude.md">https://grugdigital.com/character/claude.md</a>.</p>
        <ol>
          <li>Open this page in a tab and run <code>await GrugStudio.whenReady</code>.</li>
          <li>Choose a look that fits the request (don't quiz the person):
            <code>await GrugStudio.set({{name, skin, head, hair, hairColor, eyes, brows, mouth}})</code>.
            <code>GrugStudio.options()</code> lists every choice.</li>
          <li>Turn the request into a concrete outfit and open the painting steps:
            <code>await GrugStudio.paintOutfit('rust-orange chunky knit sweater, mustard plaid scarf, dark-wash jeans, brown suede ankle boots')</code>.</li>
          <li><b>Click</b> the studio's <b>Copy picture</b> button (a real click: copying from code doesn't work).</li>
          <li>Open <code>https://gemini.google.com/app</code> in a new tab, click the message box and press Ctrl+V (Cmd+V on a Mac).
            A thumbnail of two grey blocky avatars appears.</li>
          <li>Back in the studio, <b>click Copy prompt</b>. In Gemini, click the message box and press Ctrl+V.
            Don't type the prompt: it has line breaks and Enter would send it early.</li>
          <li>Click Gemini's Send button and wait 20 to 60 seconds for the painted picture.</li>
          <li>Hover the painted picture in Gemini and click its <b>Copy image</b> button.</li>
          <li>Back in the studio, click the 3D view and press Ctrl+V. The alignment sheet opens;
            <code>GrugStudio.status().match</code> should be 0.85 or more.</li>
          <li>Click <b>Wear it</b> and take a screenshot to check.</li>
          <li>Exporting costs Pearls (25; re-downloading the same character is free). <code>GrugStudio.status().pearls</code>
            has the price and their balance. <b>Tell the person the price and ask before spending.</b> Then
            <code>await GrugStudio.downloadR6(null, {{ spendPearls: true }})</code> saves <code>&lt;Name&gt;.glb</code>.
            Give it to the person (it lands in their Downloads folder). Short of Pearls? Tell them; they get free Pearls
            every day or can buy more at <code>/character/pearls/</code>. Never buy Pearls for them.</li>
        </ol>
        <p>No browser at all? Send the person a recipe link instead, e.g.
          <code>https://grugdigital.com/character/?name=Maple&amp;hair=wavy-long&amp;hairColor=chestnut&amp;eyes=lashes&amp;outfit=cozy+fall+sweater</code>,
          and walk them through steps 4 to 11.</p>
      </div>
    </details>
  </div>
</section>
<section id="skillGuide" class="cg-wrap" aria-labelledby="skTitle">
  <div class="cg box" role="dialog" aria-modal="true">
    <button id="skClose" class="g-btn g-btn--ghost g-btn--icon g-btn--sm cg-x" aria-label="Close"><i data-g-icon="cross"></i></button>
    <div class="cg-tag">{PUZZLE.replace('<svg ', '<svg width="16" height="16" ')}Claude skill</div>
    <h2 id="skTitle">Add the Grug skill to Claude</h2>
    <p>With this skill, Claude knows to come here whenever your Roblox game needs characters. Ask for a castle full of
      guards or a town of shopkeepers, and Claude plans the cast, makes each one in this studio, paints their outfits in
      Gemini, and helps you bring the R6 files into Roblox Studio.</p>
    <a class="g-btn g-btn--primary sk-dl" href="/character/roblox-characters.zip" download>{DOWNLOAD}Download the skill</a>
    <p class="sk-file">roblox-characters.zip · a small zip with one SKILL.md inside</p>
    <div class="sk-tabs" role="tablist">
      <button type="button" role="tab" id="skTabApp" aria-selected="true">Claude app</button>
      <button type="button" role="tab" id="skTabCode" aria-selected="false">Claude Code</button>
    </div>
    <ol class="cg-how" id="skApp">
      <li><b>1</b><span>Download the skill above. Keep it zipped.</span></li>
      <li><b>2</b><span>In Claude (web or desktop), open <strong>Customize › Skills</strong>.</span></li>
      <li><b>3</b><span>Click <strong>+</strong>, then <strong>Create skill › Upload a skill</strong>, and choose <code>roblox-characters.zip</code>.</span></li>
      <li><b>4</b><span>Make sure it's switched on. Claude uses it by itself when your game needs characters.</span></li>
    </ol>
    <ol class="cg-how" id="skCode" hidden>
      <li><b>1</b><span>Download the skill above.</span></li>
      <li><b>2</b><span>Unzip it into <code>~/.claude/skills/</code> (or your project's <code>.claude/skills/</code>), so you have <code>~/.claude/skills/roblox-characters/SKILL.md</code>.</span></li>
      <li><b>3</b><span>Start a new Claude Code session. It picks the skill up automatically.</span></li>
    </ol>
    <label class="cg-field" style="margin-top:1rem">Then try asking Claude</label>
    <div class="cg-quote" id="skTry">I'm making a medieval castle-building game in Roblox. Make me a king, two castle guards and a blacksmith as NPCs.</div>
    <div class="cg-row"><button type="button" class="g-btn" id="skCopy"><i data-g-icon="clipboard"></i>Copy this prompt</button></div>
    <p class="cg-need">Claude needs a browser it can use (Claude in Chrome) to run the studio, and you signed in to Gemini there for
      the outfits. Each R6 export costs 25 Pearls, and Claude asks you before spending any.</p>
  </div>
</section>'''
sub('<body class="g-root flat" data-cat="head">', SHEET)

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
    f'<button id="toSkill" class="g-btn" title="Get the Claude skill for your Roblox game">{PUZZLE}Claude skill</button>\n  '
    f'<button id="toClaude" class="g-btn" title="Let Claude make your avatar">{SPARK}Make with Claude</button>\n  <button id="toFinish" class="g-btn g-btn--primary">')
sub('<div id="say" class="say box" hidden></div>',
    f'<div id="say" class="say box" hidden></div>\n<div class="cg-fabs"><button id="toSkillM" class="g-btn cg-fab" title="Get the Claude skill">{PUZZLE}Skill</button><button id="toClaudeM" class="g-btn cg-fab" title="Let Claude make your avatar">{SPARK}Claude</button></div>')

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
