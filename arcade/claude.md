# Putting a game on grugdigital.com (Grug Arcade): guide for Claude sessions

You are helping build a browser game for **Grug** (https://grugdigital.com). When the owner says "push it to the site",
this is how the game goes into the **Grug Arcade** at `https://grugdigital.com/arcade/`. Read it all before you start
building, so the game is ready for the site from the beginning. The live copy of this guide is
https://grugdigital.com/arcade/claude.md.

## 0. Start from the Grug Baseplate

**Every new game starts as a copy of `arcade/baseplate/index.html`** (live: https://grugdigital.com/arcade/baseplate/).
It's a walk-around zoo of everything Grug games share, already built the Grug way: the renderer and the Grug light,
shiny plastic, studded parts and the physics world (AmbientCore: a classic R6 Humanoid at 240 Hz, with kill bricks, jump
pads, seats, buttons, ladders and moving platforms), the classic rig and its hand-made animations (walk, jump, sit, climb,
the dodge roll, holding a tool, falling apart on death), outfits on everyone, NPC players (the Ambient crowd: they
wander, explore, follow you, sit, run the obby, ride the lift, chat), a companion that mirrors your moves, the Roblox orbit
camera (into first person), touch controls, sound, VFX, the 2009-2010 GUI (Game Menu, hint bar, name tags, chat bubbles,
BillboardGuis, damage numbers, the full-screen Message, a player list, a hotbar, chat, HEALTH squares), Pearls and saving.
The comment at the top of that file lists where everything is. Copy it to `arcade/<slug>/index.html`, change the save
key and the title, delete the stations you don't need in `buildWorld`, and build your game on top.

## 1. What a Grug Arcade game is

- **One self-contained HTML file**: `arcade/<slug>/index.html` in the repo `gabrielman25/grugdigital` (static files on
  Cloudflare Pages). Inline the CSS, JS, sounds and textures (data: URIs) like the existing games do. `<slug>` is short,
  lower case, hyphens (`slide-999`, `zombie-zones`). Plus a `cover.jpg` (16:9, about 960×540, no HUD) next to it.
- **The look:** classic 2008–2012 blocky-game style. Arial bold with a black outline, flat translucent grey panels,
  studded bricks, **flat colours only, no gradients**, simple boxes. Builds are clean: arches are two pillars plus a
  header that sits on them, signs stand on posts, nothing overhangs. One stud size everywhere (see the studded material
  in the existing games: one texture tile = 2 studs, on every part, moving parts included).
- **No title screen.** The game starts straight in play. (Zombie Zones drops you into a battle already in progress;
  Slide 999 KM starts you in its lobby.) Sound starts on the first key or click.
- **A Game Menu** (Esc and a top-left Menu button), styled like the 2012 one: a centred dark box titled "Game Menu",
  buttons with a light 2px border that go red on hover, **Resume Game** first (red-outlined), Reset Character, Game
  Settings, Help, **Leave Game** (goes to `/arcade/`), and the Grug Digital logo at the bottom. Copy it from
  `arcade/slide-999/index.html` (`#gm`).
- **Red means danger** wherever it can kill you; keep floors and safe parts in cool colours so the red stands out.
- **Three.js r128** (the version both games use):
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>window.THREE || document.write('<script src="/static/vendor/three-r128.min.js"><\/script>');</script>
  ```

**The look of the light (every arcade game, from Pet Zones):** a `HemisphereLight(0xfff0e2, 0x8a7a6a, 0.64)` and a sun
`DirectionalLight(0xffe9d2, 0.85)` from Pet Zones' `SUN_DIR`, 260 studs out; `PCFSoftShadowMap` shadows, 4096 on a big screen and
2048 on phones, the shadow camera ±80, near 100, far 460, bias -0.00006, normalBias 0.025; and shiny plastic (specular 0x6a6a6a,
shininess 40 on every matte brick and character; see `PLASTIC` in any game). **480p YouTube mode:** after making the renderer,
`if (window.GrugYT480) GrugYT480.attach(renderer.domElement, renderer);` and put `<button id="mYT" style="display:none">480p YouTube mode: Off</button>`
in the Game Menu's settings (the script shows and wires it).

## 2. The site scripts (outfits and Pearls)

Add these right after three.js. On grugdigital.com they give you the player's saved characters and the Pearls wallet.
Anywhere else (a preview, a local file) they simply don't load, so **always check they exist** and let the game run
without them.

```html
<script src="/static/vendor/three-r128-GLTFLoader.js"></script>
<script src="/static/pearls.js"></script>      <!-- window.GrugPearls: the wallet -->
<script src="/static/outfits.js"></script>     <!-- window.GrugOutfits: saved characters -->
<script src="/static/outfit-rig.js"></script>  <!-- window.GrugOutfitRig: puts a saved character on your rig -->
<script src="/static/pearl-popup.js"></script> <!-- window.GrugPearlPopup: "You got X Pearls" and "Buy for X Pearls?" -->
<script src="/static/yt480.js"></script>       <!-- window.GrugYT480: the "480p YouTube mode" setting -->
```

## 3. Play as your own character (required)

Players make characters in the Avatar Studio (`/character/`), save them with **My outfits › Save for the Grug games**
and pick one with **Play as**. Every browser starts with a library of ready-made outfits already saved (Grug, the default, plus the
games' own outfits: the looks in `character/looks/looks.json`), so there is always someone to play as and dress NPCs in.
**Nobody in a Grug game is ever the plain blocky rig**: the player, every NPC and every enemy wears a character file. Every Grug game dresses the player in it, and dresses the other players / NPCs in the
player's *other* saved outfits.

**Build your characters on the classic Grug rig** so outfits fit (1 unit = 1 stud, facing −Z, right arm on +X):

```js
// g (Group, world placement) > root (Group at y = 3: the torso centre / HumanoidRootPart)
//   torso: Mesh 2×2×1 at (0, 0, 0)          head: Mesh at (0, 1.6, 0) (a 1.2 cube or a cylinder)
//   rs / ls: Group pivots at (±1.5, 0.5, 0), each with one 1×2×1 Mesh at (0, -0.5, 0)   (shoulders; rs = right, +X)
//   rh / lh: Group pivots at (±0.5, -1, 0),  each with one 1×2×1 Mesh at (0, -1, 0)     (hips)
// return { g, root, torso, head, rs, ls, rh, lh, ... }
```

Animate it with **your own retro animations** (swing the pivots, as both games do). Never use the studio's animation
clips. Then:

```js
async function wearOutfits() {
  if (!window.GrugOutfitRig) return;                       // not on grugdigital.com: keep the game's own look
  const all = [player, ...npcs];
  all.forEach(c => { c.rig.root.visible = false; });         // nobody is ever shown blocky: hidden until dressed
  const cap = setTimeout(() => all.forEach(c => { c.rig.root.visible = true; }), 8000);
  const me = await GrugOutfitRig.load();                    // the outfit they play as (Grug, the default, if none)
  if (me) { GrugOutfitRig.dress(player.rig, me); if (!me.starter && !me.isDefault) player.name = me.name; }
  player.rig.root.visible = true;                           // you first, then the others as they load
  const [others, kit] = await Promise.all([
    GrugOutfitRig.others(npcs.length),                      // their other saved outfits
    Promise.all(['ranger', 'skater', 'grug'].map(n => GrugOutfitRig.fromURL('/arcade/outfits/' + n + '.glb', n))).then(a => a.filter(Boolean))]);
  others.forEach((o, i) => { GrugOutfitRig.dress(npcs[i].rig, o); if (!o.starter) npcs[i].name = o.name; });
  // everyone left wears the game's own outfits (character files in /arcade/outfits/, see section 6): never a blocky NPC
  for (let i = others.length, k = 0; i < npcs.length && kit.length; i++, k++) GrugOutfitRig.dress(npcs[i].rig, kit[k % kit.length]);
  clearTimeout(cap); all.forEach(c => { c.rig.root.visible = true; });
}
wearOutfits();
addEventListener('grug:outfits', () => { /* they picked another outfit in another tab: load() and dress() again */ });
```

`dress()` hides your block meshes (keeps them, invisible, so anything you hang on them still works) and adds the
outfit's parts as their children. If you break a character apart on death, use the outfit part when there is one:
`const m = block.children.find(c => c.userData.outfit) || block`. Outline/highlight meshes you add to a block: set
`userData.keep = true` so they stay visible. `GrugOutfitRig.undress(rig)` goes back to the blocks.

**Enemies can wear them too.** Zombie Zones' zombies wear the game's survival outfits and the player's other saved
outfits, head shapes and all, tinted zombie green with their arms out (see `zombieOutfit()` there: each look is merged
into one mesh per outfit and kind, so a crowd stays cheap). Every outfit keeps the studio's head shape, so give your
game's own outfits different heads (`head: 'Jaw'`, `'Egg'`, `'Square'`…) to make a crowd read as different people.

## 4. Pearls (the site's currency)

- On load: `GrugPearls.start()` (new players get their welcome Pearls, everyone gets daily Pearls). If it reports
  some, show the pop-up: `r.welcome` → `GrugPearlPopup.show(r.welcome, { title: 'Welcome to Grug!' })`, `r.daily` →
  `GrugPearlPopup.show(r.daily, { title: 'Daily Pearls' })`.
- **Never show a Pearl balance on the game screen.** When the player gets Pearls, show `GrugPearlPopup.show(n)`:
  a centred box "You got n Pearls", their total under it, and OK.
- **Rewards** (the owner decides which; ask). Always with a cooldown, kept in the wallet per game:
  ```js
  const st = GrugPearls.rewardStatus('mygame-daily', 24 * 3600e3);   // { ready, next }
  try { await GrugPearls.reward('mygame-daily', 2, 24 * 3600e3, 'My Game: what for'); GrugPearlPopup.show(2); }
  catch (e) { if (e.code === 'cooldown') /* show when it's ready again: e.next */; }
  ```
  Example: Slide 999 KM's **Rebirth** (after getting admin: 2 Pearls, start the whole game again, once per 24 hours).
- **Buying in-game currency with Pearls**: `if (await GrugPearlPopup.buy({ pearls: 5, label: '$1,000', what: 'My Game: $1,000' })) giveCash(1000);`
  It asks first, shows their balance, and handles "not enough Pearls" with a link to buy more. Never spend Pearls
  without that confirmation. Never buy Pearls for the player.

## 5. Saving

Each game keeps its own save in `localStorage` under its own key (`grug.<slug>.v1`), wrapped in try/catch. Never
touch `grug.pearls.v1` (the wallet) except through `GrugPearls`, and never `grug.outfit.active` or the
`grug-outfits` database except through `GrugOutfits`.

## 6. Your game's own outfits (optional)

Outfits made for a game (painted in Gemini through the Avatar Studio, see https://grugdigital.com/character/claude.md)
go in two places: the clothing in `character/looks/<id>/shirt.png`, `pants.png`, `preview.png` plus an entry in
`character/looks/looks.json` (so anyone can wear them in the studio's Ready-made looks), and a character file
`arcade/outfits/<id>.glb` (built by the studio's `buildCharacterGLB()`; strip its animation clips) for your NPCs.

## 7. Pushing it to the site

When the owner says "push it to the site":

1. Clone `gabrielman25/grugdigital` (shallow is fine) and read its `CLAUDE.md`. Work on a **branch**, never `main`
   unless the owner says so.
2. Add `arcade/<slug>/index.html` and `arcade/<slug>/cover.jpg` (16:9). Add an entry for it to `GAMES` in
   `arcade/arcade.js` (name, genres, the red tag line, two hover stats, dates, players, an `about` description and, if
   you can, `controls`). That puts a tile in the list at `/arcade/` and gives the game its own page at
   `/arcade/place/?id=<slug>`, whose Play button starts it.
3. Don't use the old site's top-level names (README.md lists them); everything lives under `/arcade/`.
4. Test headless (Playwright + Chrome, `--use-angle=swiftshader`) from a local server at the repo root
   (`python3 -m http.server`, so `/static/…` resolves): no page errors; it starts straight in play; the Game Menu
   works; with an outfit saved in `/character/` (`GrugStudio.saveForGames()`), the player wears it; Pearls rewards and
   purchases show the pop-ups.
5. Commit, push the branch, and send the owner the preview link for the new page
   (`https://<branch>.grugdigital.pages.dev/arcade/<slug>/`, exact address from the commit's Cloudflare Pages check;
   see `CLAUDE.md`). Merge to `main` only when the owner says so.
