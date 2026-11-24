# Grug Building Studio: guide for Claude and other AI agents

The studio: https://grugdigital.com/build/ · finished examples to start from: https://grugdigital.com/build/examples/

This page turns one chunky building into a textured, retro 3D model (.glb) by having Gemini (Nano Banana) paint a
colour-coded reference sheet of it. Someone pasted this link and asked for a building. There's almost no modelling:
set a few numbers, pick a roof, write one description.

## The settings
| Key | Meaning | Range |
| --- | --- | --- |
| `w`, `d`, `h` | width (left–right), depth (front–back), wall height, in metres | whole numbers, 2–24 (h 2–20) |
| `base` | foundation band height | 0–2, steps of 0.5 |
| `roof` | `flat`, `gable`, `hip` or `shed` | |
| `rh` | roof height (for `flat`: roof thickness, 0.5–2) | 0.5–10 |
| `ridge` | `x`: gable ridge runs left–right, shed slopes to the front · `z`: ridge runs front–back, shed slopes to the right | |
| `floors` | storeys (windows are laid out per floor) | 1–5 |
| `door` | front door: `none`, `left`, `center`, `right` · `door2: true` for a double door · `backDoor: true` | |
| `wf`, `ws`, `wb` | windows per floor on the front, on each side, on the back | 0–10 |

The reference sheet is colour-coded and the prompt explains the code to Gemini: light grey = walls, red = roof,
yellow = trim (foundation, fascia and barge boards), blue = doors, cyan = windows.
The sheet has a black background, so any edge pixel that slips through reads as a shadow, not a white seam.

**Scale:** one unit is one metre. The studio shows a 1.8 m figure by the front-left corner (the visitor's saved Grug outfit,
or Grug), and doors are sized from it: a single door is 1.6 m × 2.1 m, a double door 2.4 m wide, so the figure clearly
fits through. A floor needs at least 2.5 m of wall per storey ((h − base) / floors) to get a door.

## The pipeline
1. **Build**: set the numbers (step 1 sliders, or `GrugBuild.set({...})`).
2. **Describe** it in one sentence or two: what it is and what the walls, roof, trim, door and windows look like
   (`GrugBuild.describe(text)`). Gemini designs the details from that.
3. **Paint**: step 2 shows the sheet (BACK view on the left, FRONT view on the right, both at 45° and tilted down) and
   the prompt. Click **Copy picture**, paste it into https://gemini.google.com/app, click **Copy prompt**, paste it after
   the picture and send. Use real clicks: the browser only lets a click put a picture on the clipboard. Fallback:
   `GrugBuild.downloadReference()` and attach the file.
4. **Bring it back**: copy Gemini's picture (its **Copy image** button), click this page and press Ctrl/⌘+V. It lines up
   automatically (silhouette match should be 85% or more). Then bake (step 4) and download the .glb.

```js
GrugBuild.set({ w:8, d:6, h:4, base:0.5, roof:'gable', rh:3, ridge:'x', floors:1, door:'center', wf:2, ws:1, wb:2 })
GrugBuild.describe('A cosy storybook bakery: cream plaster walls with dark timber beams, a mossy thatched roof, a stone foundation, a round green door and leaded windows with flower boxes.')
GrugBuild.status()        // .next always says what's left
await GrugBuild.wear(dataUrlOfGeminiPicture)   // or paste it with Ctrl/⌘+V
await GrugBuild.downloadGLB()
```

## No browser? Send a link
Every setting works in the address, plus `desc` and `look` (`realistic`, `painted`, `cartoon`):
`https://grugdigital.com/build/?w=8&d=6&h=4&roof=gable&rh=3&door=center&wf=2&ws=1&wb=2&desc=A%20cosy%20storybook%20bakery…` or
`?preset=cottage|shop|tower|barn|tavern`. Then tell the person: click **Next: paint it in Gemini**, copy the picture
and the prompt into Gemini, send, copy Gemini's picture back into the page, click **Bake the textures** and download
the .glb.

## Good results
- Roofs sit flush with the walls (no overhang) so every wall is fully visible to both cameras.
- Put awnings, signs, balconies, ivy and so on in the description: they get painted flat onto the walls.
- If Gemini moves or restyles the buildings, ask: "Keep the exact same picture, layout and camera. Only paint the
  surfaces."
