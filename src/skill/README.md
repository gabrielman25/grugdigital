# Claude skill: roblox-characters

`roblox-characters/SKILL.md` teaches Claude to use the Avatar Studio whenever someone's Roblox game needs characters or
NPCs, and to bring the `.glb` files into their game. It's offered as a download at `/character/roblox-characters.zip`
(linked from the home page, the studio's "Make with Claude" panel, `character/claude.md` and `/llms.txt`).

After editing `SKILL.md`, rebuild the zip (the skill folder must be the zip's root, and the description must stay
within 200 characters):

```
cd src/skill && rm -f ../../character/roblox-characters.zip && zip -X -r ../../character/roblox-characters.zip roblox-characters
```

Keep its studio steps in line with `src/character/claude.md.tmpl` and `GrugStudio.steps()`.

# Claude skill: game-buildings

`game-buildings/SKILL.md` does the same for the Building Studio: it's offered at `/build/game-buildings.zip` (linked from
`/agents/` and `/llms.txt`). Rebuild the zip after editing it, and keep its steps in line with `src/build/guide.md`:

```
cd src/skill && rm -f ../../build/game-buildings.zip && zip -X -r ../../build/game-buildings.zip game-buildings
```
