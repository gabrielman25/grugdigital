# Claude skill: roblox-characters

`roblox-characters/SKILL.md` teaches Claude to use the Avatar Studio for agents (`/agents/studio/`) whenever someone's
Roblox game needs characters or NPCs, and to bring the `.glb` files into their game. It's offered as a download at
`/character/roblox-characters.zip` (linked from `/agents/`, the guide and `/llms.txt`; the address is kept from before the
site had sections, because installed copies and old links point at it).

After editing `SKILL.md`, rebuild the zip (the skill folder must be the zip's root, and the description must stay
within 200 characters):

```
cd src/skill && rm -f ../../character/roblox-characters.zip && zip -X -r ../../character/roblox-characters.zip roblox-characters
```

Keep its studio steps in line with `src/character/claude.md.tmpl` and `GrugStudio.steps()`.

The `game-buildings` skill went with the Building Studio when it was retired (November 2026).
