# Grug Avatar Studio: guide for Claude

This page is for Claude (and other AI agents). Someone pasted
**https://grugdigital.pages.dev/character/** into a chat and asked for a Roblox character, something like
*"Use this site to make a female character wearing a warm fall outfit."* Here is how to make it and hand them the file.

**What you hand over:** a rigged Roblox R6 character, `<Name>.glb` (HumanoidRootPart, Torso, Head, Right/Left Arm,
Right/Left Leg, hair mesh, face, studs, and a set of animations), painted with a custom shirt and pants. Optionally a
`.zip` with the same `.glb` plus `shirt.png` and `pants.png` (585 × 559 classic Roblox clothing templates), the face
texture, a preview and a Studio setup script.

**How it works:** the studio runs in the browser (WebGL). You pick the hair and face, then copy the studio's template
picture (two grey blocky avatars) into Gemini (Nano Banana) with a prompt the studio writes for you. Gemini paints the
outfit onto the picture. You paste Gemini's picture back into the studio, it lines it up and cuts it into Roblox
textures, the character wears them, and you download the R6 file.

## Choose your route

- **You can use a browser** (Claude in Chrome, computer use, Playwright or similar): follow **The full route**. Use the
  person's own browser where you can, since it's where they are signed in to Gemini.
- **You can only fetch pages** (no browser): follow **No browser: send a recipe link**.

Don't quiz the person about every option. Read their description, choose a look that fits, show it to them (a
screenshot if you can), and change it if they ask. Ask only if something important is missing and you can't make a
sensible choice.

## The full route

### 1. Open the studio

Open `https://grugdigital.pages.dev/character/` in a new tab. If you can run JavaScript in the page, wait until it's ready:

```js
await GrugStudio.whenReady   // then GrugStudio.ready === true
GrugStudio.help()            // one-line summary of every call
```

Everything below can also be done by clicking: the top bar has the categories (Head, Hair styles, Hair shape, Hair
tufts, Eyebrows, Eyes, Mouth, Outfit, Animations) and **Save / Finish**. The API calls do the same as the buttons, so the
person watching sees the same thing.

### 2. Build the look

Pick everything that fits the description in one call. Every key is optional; anything you leave out stays as it is.
Names are matched loosely (`'wavy long'` finds *Wavy & long*), and numbers work too.

```js
await GrugStudio.set({
  name: 'Maple',                       // shown in the studio and used for the file name: Maple.glb
  skin: 'Light orange',                // a skin tone name below, or any hex
  head: 'Egg',                         // head shape
  hair: 'Wavy & long', hairColor: 'chestnut',
  eyes: 'long glam lashes', brows: 'thin arch', mouth: 'simple smile line',
  outfit: 'a cozy fall outfit: rust-orange chunky knit sweater, mustard plaid scarf, dark-wash jeans and brown suede ankle boots'
})
```

It returns the current look (`GrugStudio.get()` gives the same at any time). An unknown value throws an error that lists
the valid options. Take a screenshot to check the face and hair look right.

Tips:

- **outfit** goes into the Gemini prompt word for word, so be concrete: each garment, colours, materials, patterns and
  shoes. "Warm fall outfit" → *"rust-orange chunky knit sweater, mustard plaid scarf, dark-wash jeans, brown suede ankle
  boots"*.
- Painted clothes cover the torso, arms and legs only. Hats and accessories can't be painted on (they'd break the
  silhouette); hair is a 3D mesh chosen here.
- The eyebrows follow the hair colour unless you set `browColor`.
- `hairFlip: true` mirrors a side-swept style. `headSize` runs from 0.8 to 1.3 (default 1.1).
- `body`: leave it as `classic` unless asked. Don't use the locked "Figure" body type (the API won't set it).

### 3. Paint the outfit in Gemini

1. `GrugStudio.openPaint()` opens the painting steps (or click the shirt icon, then **Create outfit with Claude**).
2. Copy the template picture: click **Copy** under *Grab the reference picture* (a real click works best, since the
   clipboard wants a user gesture; `await GrugStudio.copyTemplate()` also works and returns `true` on success). Wait for
   the "Picture copied" toast, which can take a second or two.
   *If copying fails:* `GrugStudio.downloadTemplate()` saves `roblox-clothing-reference.png` to Downloads; attach that
   file in Gemini with its upload button instead.
3. Open **https://gemini.google.com/app** in a new tab. If it asks the person to sign in, ask them to do it (never type a
   password for them). Click the message box and paste (Ctrl+V, or ⌘+V on a Mac) to attach the picture. Wait for the
   thumbnail.
4. Get the prompt: `GrugStudio.prompt()` returns the full text with the outfit in it. Type or paste it into Gemini's
   message box after the picture (or click **Copy prompt** in the studio and paste; attach the picture first, because the
   clipboard holds one thing at a time). Send it.
5. Gemini should answer with an edited picture. If it replies with text only, or asks a question, reply: *"Please
   generate the edited image now, keeping the picture exactly the same apart from the clothes."* If Gemini shows an image
   tool switch ("Create image" / Nano Banana), turn it on.
6. Check Gemini's picture: the same two avatars in the same places and poses, on white, with no hair, hats or props
   added. If it moved, rotated, cropped or restyled them, ask again: *"Keep the exact same picture, layout and camera.
   Only paint the clothes onto the blocks."*
7. Copy Gemini's picture: hover over it and use its **Copy image** button (or right-click › Copy image).
   *Or:* use Gemini's download button (full size), then in the studio click the *Drop the dressed image* box and upload
   the downloaded file.

### 4. Bring it back and wear it

1. Switch to the studio tab, click on the 3D view (not inside a text box) and paste (Ctrl/⌘+V). The alignment sheet
   opens and shows **Silhouette match NN%**.
2. 90% or more: click **Wear it**. Between 78% and 90%: click **Auto-align**, check that the blue outlines sit on the
   painted avatars, then **Wear it**. Below 78%: Gemini probably moved the figures or it's the wrong image; go back to
   Gemini and ask again.
3. With JavaScript: `GrugStudio.status()` reports `match` (0–1) and what to do next, and `GrugStudio.wearIt()` is the
   same as **Wear it**.
4. Shortcut, if you already have the painted picture inside the studio page as a `data:` URL, base64 PNG, Blob or
   same-site URL: `await GrugStudio.wear(image)` pastes, aligns and wears it in one go and returns `{ match }`.
   (Gemini's own image addresses usually can't be read from another site, so the clipboard is the reliable way across.)
5. Take a screenshot and check the character in 3D. If the clothes look shifted or smeared, the alignment was off: paste
   again and line it up, or regenerate in Gemini.

No Gemini at all? The studio can still dress the character: `set({ look: 'Flannel & jeans' })` wears a ready-made
outfit, and `set({ tee: '#ff9f3a' })` wears a plain tee in that colour with jeans and sneakers. Say that's what you did.

### 5. Download the R6 file

```js
await GrugStudio.downloadR6()     // → { file: 'Maple.glb', bytes: … }, saved by the browser
await GrugStudio.downloadZip()    // optional: the whole set (.glb, shirt.png, pants.png, face, setup script, preview)
```

By clicking: **Save / Finish** → **Roblox R6 character (.glb)** (or **Download the whole set (.zip)**).

`await GrugStudio.r6Base64()` returns the `.glb` as base64 if you need the bytes themselves (it's around 1 MB, so only
do this when you can write it straight to a file, as with Playwright).

### 6. Hand it over

- The file is in the browser's downloads folder, usually `~/Downloads/<Name>.glb`. If you can reach files on the
  person's computer, take it from there and send it to them in the chat. If not, tell them the file name and where it is.
- Tell them how to use it in **Roblox Studio**: import the `.glb` with the **3D Importer** and add a Humanoid (rig type
  R6). If the parts arrive wrapped in Models or without joints, select the model, open View › Command Bar, paste the
  setup script and press Enter. The script is in the `.zip` as `R6-setup.lua`, behind **Copy the Studio R6 setup
  script** on the finish page, and returned by `GrugStudio.r6Script()`.
- For a classic avatar instead, upload `shirt.png` as a Shirt and `pants.png` as Pants in the Creator Hub (Avatar Items).

## No browser: send a recipe link

If you can't use a browser, build a link that opens the studio with the character already set up and the Gemini prompt
already written, then walk the person through steps 3 to 6 themselves. Every key from `set()` works as a URL parameter
(colours as names or hex without the `#`). With `outfit=` the studio opens straight on the painting steps.

```
https://grugdigital.pages.dev/character/?name=Maple&skin=light-orange&head=egg&hair=wavy-long&hairColor=chestnut&eyes=long-glam-lashes&brows=thin-arch&mouth=simple-smile-line&outfit=rust-orange+chunky+knit+sweater%2C+mustard+plaid+scarf%2C+dark-wash+jeans+and+brown+suede+ankle+boots
```

Then tell them: click **Copy** under the picture and paste it into Gemini, click **Copy prompt** and paste that too, send,
copy Gemini's picture, paste it back into the studio (Ctrl/⌘+V), click **Wear it**, then **Save / Finish** › **Roblox
R6 character (.glb)**.

## The options

All of these come from `GrugStudio.options()`. Use the name (or a few words of it) or the number.

### Hair styles (`hair`)

| # | Name |
| --- | --- |
| 0 | None |
| 1 | Swept & long |
| 2 | Bob & fringe |
| 3 | Swoop & flick |
| 4 | Buzz |
| 5 | Crop |
| 6 | Side part |
| 7 | Spiky |
| 8 | Bowl |
| 9 | Puff |
| 10 | Curtains |
| 11 | Choppy bob |
| 12 | Long & straight |
| 13 | Wavy & long |
| 14 | Pigtails |
| 15 | Twin tails |
| 16 | Ponytail |
| 17 | High pony & fringe |
| 18 | Top bun |
| 19 | Twin buns |
| 20 | Braids |
| 21 | Sprout |
| 22 | Mohawk |

### Hair colours (`hairColor`, `browColor`)

| Name | Hex |
| --- | --- |
| black | `#1b1b1f` |
| dark brown | `#2a1d18` |
| brown | `#5a3a22` |
| chestnut | `#7a4b2a` |
| caramel | `#a8703a` |
| golden | `#d9a441` |
| blonde | `#f1d27a` |
| red | `#c2452d` |
| ginger | `#e8743b` |
| grey | `#8e8e96` |
| white | `#ece8df` |
| pink | `#ff8fc2` |
| blue | `#8aa8ff` |
| teal | `#4fd8c4` |
| lime | `#9be338` |
| lavender | `#c59bff` |

### Head shapes (`head`)

| # | Name |
| --- | --- |
| 0 | Classic |
| 1 | Round |
| 2 | Egg |
| 3 | Heart |
| 4 | Square |
| 5 | Chubby |
| 6 | Slim |
| 7 | Pear |
| 8 | Diamond |
| 9 | Chin |
| 10 | Bell |
| 11 | Jaw |

### Skin tones (`skin`)

| # | Name | Hex |
| --- | --- | --- |
| 0 | Pastel brown | `#ffcc99` |
| 1 | Light orange | `#eab892` |
| 2 | Nougat | `#cc8e69` |
| 3 | Dark orange | `#a05f35` |
| 4 | Brown | `#7c5c46` |
| 5 | Reddish brown | `#694028` |
| 6 | Bright yellow | `#f5cd30` |
| 7 | Medium stone grey | `#a3a2a5` |

### Eyes (`eyes`)

| # | Name |
| --- | --- |
| 0 | small dot with lashes |
| 1 | big round eye, lashes |
| 2 | big white eye, lashes |
| 3 | side glance, lashes |
| 4 | big heavy-lidded eye, lashes |
| 5 | upper and lower lashes |
| 6 | simple dot |
| 7 | sleepy line |
| 8 | tiny sparkle dot |
| 9 | white almond eye |
| 10 | white almond eye, lashes |
| 11 | long glam lashes |
| 12 | huge round stare |
| 13 | wink squint |
| 14 | shocked wide eye |
| 15 | cute dot, lashes |
| 16 | angry squint |
| 17 | side glance, curled lashes |
| 18 | closed line |
| 19 | closed thick line |
| 20 | sleepy double line |
| 21 | half-lidded dot |
| 22 | half-lidded, lashes |
| 23 | white half-moon eye |
| 24 | dreamy closed, lashes |
| 25 | closed bold |
| 26 | bored half-lid |
| 27 | closed happy, lashes |
| 28 | looking up |
| 29 | tired small, lashes |
| 30 | bored white eye |
| 31 | goofy |
| 32 | tall oval |
| 33 | dizzy spiral |
| 34 | tiny squint |
| 35 | huge cartoon eye |
| 36 | squeezed shut (>_<) |
| 37 | white eye, lashes |
| 38 | raised small dot |
| 39 | tilted white eye |
| 40 | tired, eye bags |
| 41 | buzzing flies (silly) |
| 42 | blocky F (silly) |
| 43 | happy closed ^ |
| 44 | happy closed U |

With noticeable lashes (a common pick for a female character): 2, 4, 5, 10, 11, 15, 22, 27, 37. Simple: 6, 9, 21. Silly: 31, 33, 41, 42.

### Eyebrows (`brows`)

| # | Name |
| --- | --- |
| 0 | soft arch |
| 1 | thin arch |
| 2 | bold thick arch |
| 3 | bold thick slant |
| 4 | thin gentle curve |
| 5 | flat straight |
| 6 | short flat |
| 7 | high arch (surprised) |
| 8 | curled hook |
| 9 | dashed thin |
| 10 | peaked thin |
| 11 | bold sharp slant |
| 12 | flat squared |
| 13 | scar cut |
| 14 | deep U (worried) |
| 15 | wavy |
| 16 | long flat taper |
| 17 | wavy arch |

### Mouths (`mouth`)

| # | Name |
| --- | --- |
| 0 | smile with a tooth |
| 1 | small open o, dimples |
| 2 | big open laugh |
| 3 | smirk |
| 4 | shocked open |
| 5 | lopsided smirk |
| 6 | simple smile line |
| 7 | tongue out |
| 8 | small o |
| 9 | buck-tooth grin |
| 10 | stitched |
| 11 | wide toothy grimace |

### Other keys

| Key | Values |
| --- | --- |
| `name` | up to 24 characters; also the file name |
| `headSize` | 0.8 to 1.3 (default 1.1) |
| `hairFlip` | `true` mirrors the hair |
| `body` | `classic`, `smooth`, `brick`, `slender` |
| `outfit` | free text for the Gemini prompt |
| `look` | ready-made outfit: `Flannel & jeans` |
| `tee` | a plain tee in any colour (hex), with jeans and sneakers |
| `view` | which panel to show: `head`, `hair`, `hairShape`, `hairTuft`, `brow`, `eye`, `mouth`, `shirt`, `paint`, `anim`, `finish` |
| `random` | `true` for a random character (then adjust) |
| `reset` | `true` to start from the default character |

## API reference (`window.GrugStudio`)

| Call | What it does |
| --- | --- |
| `whenReady` / `ready` | Promise / flag: the studio has loaded |
| `options()` | every choice, as above |
| `get()` | the current look |
| `set(look)` | apply any of the keys above; returns `get()` |
| `random()` | a random character |
| `openPaint()` | show the outfit painting steps |
| `prompt(outfit?)` | the Gemini prompt (sets the outfit text first if given) |
| `copyTemplate()` | copy the template picture to the clipboard |
| `copyPrompt(outfit?)` | copy the prompt to the clipboard |
| `downloadTemplate()` | save `roblox-clothing-reference.png` |
| `templateDataURL()` | the template picture as a PNG data URL |
| `wear(image, { review })` | load a painted picture, auto-align, and wear it (`review: true` stops at the alignment sheet) |
| `wearIt()` | same as **Wear it** on the alignment sheet |
| `match()` | silhouette match 0–1 for the pasted picture |
| `status()` | where things stand and what to do next |
| `finish()` | open the finish page |
| `downloadR6(name?)` | download `<Name>.glb` (rigged Roblox R6) |
| `downloadZip()` | download the whole set |
| `r6Base64()` | the `.glb` as base64 |
| `r6Script()` | the Roblox Studio R6 setup script |

## Good manners

- Send Gemini only the template picture and the prompt.
- Leave signing in to the person. Never type passwords or payment details.
- Don't open the studio's Library (it asks for folder access on the person's computer) unless they ask you to.
- Tell the person what you made and where the file is. If a step didn't work and you fell back to something else (a
  ready-made outfit, a recipe link), say so.
