---
name: game-buildings
description: Use when a game needs buildings, houses or shops. Makes textured low-poly buildings (.glb) painted in Gemini using Grug Building Studio, then puts them in the game.
---

# Game buildings with Grug Building Studio

When someone is building a game and it needs buildings (a blacksmith, a row of shops, a tavern, a watchtower, a
sci-fi habitat, a starter house), use **Grug Building Studio** at https://grugdigital.com/build/ to make them. Don't
stack untextured boxes in a script or generate a mesh with flat colours. The studio gives each building:

- one chunky building mass and one roof (flat, gable, hip or shed), at true scale: one unit is one metre,
- doors and windows placed per wall and per floor, with doors sized for a 1.8 m figure,
- textures painted by Gemini (Nano Banana) from a one or two sentence description, baked onto the model in a retro
  look, with a bevel normal map,
- a single `.glb` file that Roblox Studio, Unity, Godot and Blender can import.

The studio's own guide is the source of truth and is kept up to date: https://grugdigital.com/build/claude.md. Read
it if anything below doesn't match what you see. Finished examples to start from:
https://grugdigital.com/build/examples/.

## 1. Plan the buildings

Work out which buildings the game needs from what the person is making. A medieval village might want a forge, an
inn, three cottages and a watchtower. For each one, choose a size, a roof and a description that covers the walls,
roof, trim, door and windows, for example *"A medieval blacksmith's forge: rough grey fieldstone walls with dark oak
timber beams, a sooty dark slate roof, a heavy stone foundation, a wide double plank door with iron straps and small
shuttered windows."* Keep one era and art style across the set.

If the request is clear, choose sensible sizes yourself and show the person. If there are many buildings (more than
about four) or the style is unclear, confirm the list in one short message first: each building is a separate Gemini
round trip.

## 2. Make each building

The studio is a browser app (WebGL), so you need a browser you can drive: Claude in Chrome (best, because the
person's Chrome is signed in to Gemini), computer use, or similar.

The settings:

| Key | Meaning | Range |
| --- | --- | --- |
| `w`, `d`, `h` | width, depth and wall height in metres | whole numbers, 2–24 (h 2–20) |
| `base` | foundation band height | 0–2, steps of 0.5 |
| `roof` | `flat`, `gable`, `hip` or `shed` | |
| `rh` | roof height (for `flat`: roof thickness, 0.5–2) | 0.5–10 |
| `ridge` | `x`: ridge runs left–right · `z`: ridge runs front–back | |
| `floors` | storeys | 1–5 |
| `door` | `none`, `left`, `center`, `right` · `door2: true` for a double door · `backDoor: true` | |
| `wf`, `ws`, `wb` | windows per floor on the front, each side and the back | 0–10 |

A floor needs at least 2.5 m of wall per storey, (h − base) / floors, to get a door.

For each building:

1. Open https://grugdigital.com/build/.
2. Set the shape and describe it:
   ```js
   GrugBuild.set({ w:8, d:6, h:4, base:1, roof:'gable', rh:3, ridge:'x', floors:1, door:'center', door2:true, wf:2, ws:1, wb:1 })
   GrugBuild.describe("A medieval blacksmith's forge: rough grey fieldstone walls with dark oak timber beams, a sooty dark slate roof, a heavy stone foundation, a wide double plank door with iron straps and small shuttered windows.")
   ```
3. Paint it. Step 2 in the studio shows the colour-coded reference sheet (back view on the left, front view on the
   right) and the prompt.
   1. **Click** the studio's **Copy picture** button. It must be a real click: the browser only lets a click put a
      picture on the clipboard. If that fails, `GrugBuild.downloadReference()` saves the sheet to attach instead.
   2. Open https://gemini.google.com/app in a new chat, click the message box and press Ctrl+V (Cmd+V on a Mac). If
      Gemini needs a sign-in, ask the person to sign in; never type passwords.
   3. In the studio **click Copy prompt**, paste it after the picture and send.
   4. When the painted picture arrives, click Gemini's **Copy image** button.
   5. Back in the studio, click the page and press Ctrl+V. It lines the painting up on its own; the silhouette
      match should be 85% or more. If Gemini moved or restyled the buildings, ask it: "Keep the exact same picture,
      layout and camera. Only paint the surfaces." Then copy and paste again.
4. Bake the textures (step 4 in the studio), take a screenshot and check the result.
5. Download it: `await GrugBuild.downloadGLB()` saves the `.glb` to the browser's Downloads folder.

`GrugBuild.status().next` always says what's left.

Awnings, signs, balconies and ivy go in the description: they are painted flat onto the walls. Roofs sit flush with
the walls, with no overhang, so both views can see every wall.

**No browser?** Build a link that opens the studio with the building set up, then walk the person through the
painting steps. Every setting works in the address, plus `desc` and `look` (`realistic`, `painted`, `cartoon`), or
`?preset=cottage|shop|tower|barn|tavern`:
`https://grugdigital.com/build/?w=8&d=6&h=4&roof=gable&rh=3&door=center&wf=2&ws=1&wb=1&desc=A%20medieval%20blacksmith%27s%20forge`

## 3. Put the buildings in the game

Get the files first. If you can reach the person's Downloads folder (a connected folder), take the `.glb` files from
there into their project. Otherwise tell them which files to look for.

- **Roblox Studio:** each `.glb` goes in through the 3D Importer (**Import 3D**). The importer is a Studio window, so
  ask the person to do it, or use computer use if you have it. The model is in metres; the studio's 1.8 m figure
  stands 5.2 studs tall in Grug's games, so scale by about 2.9 studs per metre to match an R6 character. Anchor the
  model, then move it to where the game keeps its map (for example `workspace.Map.Buildings`).
- **Godot and Blender:** both import `.glb` directly. Put the file in the project folder (Godot) or use File ›
  Import › glTF 2.0 (Blender).
- **Unity:** add a glTF importer package (for example glTFast) if the project has none, then put the `.glb` in
  `Assets/`.

The building is a painted shell with no interior and no collision setup beyond its mesh. If the game needs people to
walk inside, say so and build the interior separately.

## 4. Check

Show the person each building in the game next to a character for scale. If a door looks too small, the wall height
per floor is under 2.5 m; raise `h` or lower `floors` and paint it again.

Characters for the same game: Grug Avatar Studio, https://grugdigital.com/character/ (guide:
https://grugdigital.com/character/claude.md), or the `roblox-characters` skill. Both skills, and prompts for other
agents: https://grugdigital.com/agents/.
