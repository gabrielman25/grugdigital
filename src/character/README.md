# Avatar Studio build

`character/index.html` is the Grug Avatar Studio file with a layer on top that lets Claude (or any browser agent) use
it. Don't hand-edit `character/index.html`: change the files here and rebuild.

| File | What it is |
| --- | --- |
| `patch_studio.py` | Adds the "Make with Claude" button and sheet (with the agent instructions first in the page, so an AI fetching the link reads them), the page description and the link to the guide. Asserts every anchor it patches, so it fails loudly if a new studio version moved something. |
| `agent.js` | `window.GrugStudio`: options/get/set, prompt, copyTemplate, wear, downloadR6 and friends; recipe links (`/character/?hair=…&outfit=…`); the sheet's behaviour; the template **Copy** button. |
| `labels.json` | Plain-words labels for the 45 eyes, 18 brows and 12 mouths (the studio only has pictures of them) and named hair colours. If a new studio adds face parts, add labels in the same order. |
| `outfits.js`, `patch_outfits.py` | The **My outfits** layer (save for the Grug games, Play as, Edit, the game looks). `python3 src/character/patch_outfits.py character/index.html` re-injects it (and the agent API) without a full rebuild; `patch_studio.py` runs it too. |
| `claude.md.tmpl` | The agent guide. `build.py` fills in the option tables from the live studio. |
| `build.py` | Runs both steps. |

## A new studio version

```
python3 src/character/build.py path/to/grug-avatar-studio11.html
```

Then open `/character/` and try the flow: `GrugStudio.set({...})`, Outfit › Create outfit with Claude › Copy, paste an
image back (Ctrl/⌘+V), Wear it, Save / Finish › Roblox R6 character (.glb).

The API reaches into the studio through `window.__creator` (extended by `patch_studio.py`) and the studio's own
top-level functions (`setImage`, `build`, `buildCharacterGLB`, `refWhite`, `state`, …). If those are renamed in a new
version, `agent.js` needs the same change.
