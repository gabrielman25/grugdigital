# Avatar Studio build

Two pages are built here from the owner's Grug Avatar Studio file: `character/index.html`, **the players' studio** (made
for kids and hobbyists), and `agents/studio/index.html`, **the agents' studio** (the same page with every picker and
slider hidden and a console in their place). Don't hand-edit either: change the files here and run

```
python3 src/character/build.py [path/to/new-studio.html]     # then: python3 src/seo/seo_head.py
```

Without a path it refreshes the layers in the page that's already built (the owner's studio file isn't in the repo).

| File | What it is |
| --- | --- |
| `patch_studio.py` | From a new studio file: the page head, Allo, the Pearls chip and price sheet, and the `GrugStudio` API. Asserts every anchor it patches, so it fails loudly if a new studio version moved something. (It no longer adds the "Make with Claude" sheet or the skill panel: agents have their own page.) |
| `agent.js` | `window.GrugStudio`, the same on both pages: options/get/set, prompt, copyTemplate, wear, downloadR6 and friends; recipe links (`?hair=…&outfit=…`); the template **Copy** button. Sends a `grug:studio` event after every change. |
| `players.css`, `players.js` | The kids-and-hobbyists layer of the players' studio: words under the tab icons, the Back / Next bar, the hello for first-timers, plain-words copy. Put in by `patch_outfits.py`. |
| `agent_studio.py`, `agent_studio.css`, `agent_studio.js` | The agents' studio: copies `character/index.html`, sets `body.agent`, hides the hand controls and adds the console (instructions, a Next box, three steps). |
| `labels.json` | Plain-words labels for the 45 eyes, 18 brows and 12 mouths (the studio only has pictures of them) and named hair colours. If a new studio adds face parts, add labels in the same order. |
| `outfits.js`, `patch_outfits.py` | The **My outfits** layer (save for the Grug games, Play as, Edit, the game looks). `python3 src/character/patch_outfits.py character/index.html` re-injects it (and the agent API) without a full rebuild; `patch_studio.py` runs it too. |
| `wardrobe.js`, `wardrobe.py` | The **Wardrobe** on the outfit page: ready-made tops and bottoms by theme, picked separately, with left/right sleeve swapping. `wardrobe.py <folder of Gemini pictures> <outfits.json>` lines each picture up in the studio (headless, needs the repo served on localhost:8765), writes `character/wardrobe/<id>/` (shirt/pants templates as WebP plus top/bottom avatar previews) and `wardrobe.json`; pictures that match below 0.75 are skipped. The outfit list it was made from is `character/wardrobe/outfits.json`. |
| `claude.md.tmpl` | The agent guide. `build.py` fills in the option tables from the live studio and writes it to `agents/studio/claude.md` and `character/claude.md`. |
| `build.py` | Runs everything: the players' page, the agents' page, the guide. |

## A new studio version

```
python3 src/character/build.py path/to/grug-avatar-studio11.html
```

Then try the flow on both pages. `/agents/studio/`: `GrugStudio.set({...})`, `GrugStudio.paintOutfit('…')`, Copy picture,
paste an image back (Ctrl/⌘+V), Wear it, Download. `/character/`: Next through the tabs, Outfit › Paint my own outfit ›
Copy picture, paste an image back, Wear it, Done › Roblox R6 character (.glb).

The API reaches into the studio through `window.__creator` (extended by `patch_studio.py`) and the studio's own
top-level functions (`setImage`, `build`, `buildCharacterGLB`, `refWhite`, `state`, …). If those are renamed in a new
version, `agent.js` needs the same change.
