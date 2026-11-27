"""Builds the Grug Starter: arcade/starter/index.html, the bare baseplate new Grug games start from.

    python3 src/starter/build.py                  # the site's copy (loads /static/...)
    python3 src/starter/build.py --single FILE    # also one self-contained file (three.js, the voices, the sounds and the
                                                  # font built in) that plays opened straight from a disk, to send around

The Starter is the Grug Baseplate (arcade/baseplate/index.html: the "zoo" of everything Grug games do) with the stations
taken out: the same engine, light, physics, camera, controls, GUI, sounds and voices on an empty baseplate, with you,
three other players, a damage pad, a kill brick and a training dummy (so every voice line can be heard). Never hand-edit
arcade/starter/index.html: change the Baseplate (the engine) or this file (what the Starter leaves out and adds) and run
it again. Every step checks that the text it replaces is there, so a change to the Baseplate that this file doesn't know
about stops the build instead of making a broken Starter.
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
read = lambda p, mode='r': open(os.path.join(ROOT, p), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})).read()
s = read('arcade/baseplate/index.html')

def sub(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'expected {count} of {old[:80]!r}, found {n}'
    s = s.replace(old, new)

HEAD = '// ' + '=' * 100 + ' '
def section(title):
    """(start, end) of the game script's section whose header line starts with this title."""
    a = s.index(HEAD + title); b = s.index(HEAD, a + len(HEAD))
    return a, b
def replace_section(title, text):
    global s
    a, b = section(title); s = s[:a] + text + s[b:]

# ---------------------------------------------------------------------------------------------------------- the notes
a = s.index('<!--\n' + '=' * 119); b = s.index('-->', a) + 3
s = s[:a] + '''<!--
=======================================================================================================================
  GRUG STARTER: copy this file to start a new Grug Arcade game (read this first, Claude)
-----------------------------------------------------------------------------------------------------------------------
  A bare baseplate with everything a Grug game needs already working: you, three other players, the camera, the
  controls (keyboard, mouse, touch), the classic GUI, the sounds and the player voices. Copy it to
  arcade/<slug>/index.html, change the names (the title, HINT_LINE, Save.key: grug.<slug>.v1), and build your game in
  buildWorld() and the frame loop. Also read arcade/claude.md.
  It is BUILT from the Grug Baseplate (arcade/baseplate/, the "zoo" of every station: obby, seats, truss, jump pads,
  elevator, button and door, coins, a blaster, Message and Hint) by src/starter/build.py: change the engine there, and
  copy a station's code from the Baseplate when your game wants one.

  WHAT'S IN HERE (search for the "// ====" headers in the game script)
    · Renderer, sky and the Grug light: hemisphere 0xfff0e2/0x8a7a6a 0.64, sun 0xffe9d2 0.85 from SUN_DIR, 260 out,
      PCF soft shadows (4096, 2048 on phones), shadow box ±80, near 100, far 460, bias -0.00006, normalBias 0.025.
      Retro: no anti-aliasing, drawn at 0.85 of the screen and blown up with hard pixel edges.
    · Shiny plastic: every matte brick and character gets specular 0x6a6a6a / shininess 40; studded floors a softer
      0x28 / 20 so they aren't blinding. A setting turns it off.
    · Studded parts: part() adds a box to the physics world AND the scene (studs on top, plain sides, inlets under),
      batched into one mesh per colour by flushStatic(). One stud size everywhere (one texture tile = 2 studs).
    · Physics and movement: AmbientCore (the script id="ambient-npc" block). A classic R6 Humanoid on a fresh Baseplate:
      walk 16, jump 7.2 studs, gravity 196.2, stepped at 240 Hz, the Shift dodge roll. Part kinds: solid, kill, pad,
      seat, button, ladder, dynamic (moving platforms / elevators). Off the edge of the plate you fall to your death.
    · Characters on the classic Grug rig (makeRig), animated by hand (animateRig): idle, walk, run, air, sit, climb,
      the dodge roll, the swing, holding a tool, breaking apart on death (breakApart). Never the studio's clips.
    · Everyone wears a character file (wearOutfits): you wear your saved outfit, the others your other saved outfits and
      the arcade's own. Nobody is ever shown as the plain blocky rig on the site (hidden until dressed).
    · The other players (the Ambient crowd): NPCS of them (three). They wander between the places in makeCrowd(), hang
      out, follow you, jump, go AFK, chat in bubbles, and fall apart on the kill brick. updateNpcs() / makeCrowd().
    · A companion that mirrors you (off until the Game Menu turns it on): updateFollowers.
    · Camera: the Roblox orbit cam. Right-drag (or left-drag) / Q E turn it, wheel / I O zoom, into first person.
    · Input: keyboard + mouse, and touch (thumbstick, Jump and Roll buttons, drag to look, pinch to zoom, tap to swing).
    · The 2009-2010 GUI (see the CSS): black panels at 45% with a 2px black edge, flat pure colours, the black buttons
      with the dark red border, the classic Game Menu (Esc / the gear), the top hint bar, name tags and chat bubbles,
      BillboardGuis on parts, damage numbers, the full-screen Message and the Hint bar, a player list, a hotbar, chat.
      Rows of squares for stats (HEALTH = red squares). Never a Pearl balance on screen.
    · VFX: sprite strips (FX.dust, FX.ring, FX.shotHit...), debris chips, beams.
    · Pearls: GrugPearls.start() + GrugPearlPopup on load. Saving: localStorage 'grug.starter.v1' (yours: grug.<slug>.v1).
    · 480p YouTube mode: GrugYT480.attach() + the #mYT button in the Game Menu.

  THE SOUNDS (Snd, "sound" in the game script)
    · Snd.play(kind, x, y, z): a sound from a place in the world (leave x y z out for one that's just "on screen").
      Kinds: jump, hit, swing, shot, pad, chime, door... and the two soft ones every game shares (static/sfx.js,
      window.GrugSfx, tuned in the Voice Lab):
        'click' (or 'tick'), 'open', 'close', 'count'   menus, buttons and countdowns: the soft tap
        'oof'                                           a character falling apart: the soft thud
      Never add a loud ping or plop for these. Snd.ding(kind) is the little rising jingles (gem, kill, bank, buy, sad).

  THE VOICES (Voice, just above Snd; the lines and their tuning are static/voice.js, window.GrugVoice)
    · Voice.say(who, line): who is the player or any character with a .ch and a .name. You speak in your own avatar
      voice; everyone else in a voice picked from their name, from where they stand, quieter with distance.
        'jump'    they jumped                      (the 'jump' physics event: playerUpdate, the crowd loop)
        'dodge'   the dodge roll                   (tryDash)
        'attack'  a swing                          (swing)
        'hurt'    took damage and is still alive   (hurt)
        'death'   fell apart                       (Voice.died, from playerUpdate and updateNpcs)
        'fall'    fell off the world               (Voice.died picks it when they're below the plate)
        'laugh'   got an elimination               (Voice.died(who, killer), and swingStrike for the dummy)
    · How often a line plays, its volume, speed and pitch are GrugVoice's own settings (the owner tunes them in the
      Voice Lab): call Voice.say every time the thing happens and let it decide. Don't add chances or timers here.
    · The Game Menu's Voices button (#mVoice: On / Just mine / Off) is wired by GrugVoice.menuButton. Keep it.

  TRY THEM: Space (jump) · Shift (dodge) · F, a click or a tap (swing; break the dummy for the laugh) · the red pad
  (hurt) · the red brick (death) · walk off the edge of the plate (fall). The other players speak when they do these.
=======================================================================================================================
-->''' + s[b:]

sub('<title>Grug Baseplate · the starting point for every Grug game</title>', '<title>Grug Starter · a bare baseplate to build a Grug game on</title>')

# ---------------------------------------------------------------------------------------------------------- the help
sub('tap to shoot with the blaster out</div>', 'tap to swing</div>')
sub('  <div><b>Sit:</b> walk onto a seat · <b>Space</b> to stand up</div>\n', '')
sub('  <div><b>Climb:</b> walk into the truss · push forward to climb, back to climb down · <b>Space</b> lets go</div>\n', '')
sub('  <div><b>Tools:</b> <b>1</b> (or the slot at the bottom) takes the blaster out and puts it away · click to shoot</div>\n', '  <div><b>Swing:</b> <b>F</b>, a click, or the slot at the bottom · three hits break the training dummy</div>\n')
sub('  <div><b>Pads:</b> the Message and Hint pads show the old full-screen Message and the Hint bar. The Companion pad calls a friend who copies your moves</div>\n', '  <div><b>Voices:</b> you and the other players speak when you jump, roll, swing, get hurt and fall apart. The Game Menu turns them off</div>\n')

# ---------------------------------------------------------------------------------------------------------- the game script
sub("//  GRUG BASEPLATE · the template (see the comment at the top of the file for what's here)", "//  GRUG STARTER · a bare baseplate to build a game on (see the comment at the top of the file for what's here)")
sub("const Save = { coins: 0, plastic: true, npcs: true, comp: false, name: '', key: 'grug.baseplate.v1',", "const Save = { plastic: true, npcs: true, comp: false, name: '', key: 'grug.starter.v1',")
sub("Object.assign(this, { coins: s.coins | 0, plastic: s.plastic !== false,", "Object.assign(this, { plastic: s.plastic !== false,")
sub("JSON.stringify({ coins: this.coins, plastic: this.plastic,", "JSON.stringify({ plastic: this.plastic,")
sub("let HINT_LINE = 'GRUG BASEPLATE · WASD move · Space jump · Shift roll · right-drag or Q/E turn · wheel zoom · 1 blaster · / chat · H help';", "let HINT_LINE = 'GRUG STARTER · WASD move · Space jump · Shift roll · F or click: swing · right-drag or Q/E turn · wheel zoom · / chat · H help';")
sub("'GRUG BASEPLATE · left thumb moves · drag to look · tap to shoot' : innerWidth < 900 ? 'GRUG BASEPLATE · WASD · Space · Shift roll · H help'", "'GRUG STARTER · left thumb moves · drag to look · tap to swing' : innerWidth < 900 ? 'GRUG STARTER · WASD · Space · Shift roll · F swing · H help'")

# the map: just the baseplate, the spawn, and three things to try the voices on
a, b = section('the map: a baseplate and the stations')
i = s.index('function buildWorld() {', a); j = s.index("  // spawn: a SpawnLocation (grey, studs, a plate on top)", i)
keep_top = s[a:j].replace('the map: a baseplate and the stations', 'the map: a baseplate, the spawn, and three things to try the voices on')
assert 'const BP = 512' in keep_top and 'const ground' in keep_top
s = s[:a] + keep_top + '''  // spawn: a SpawnLocation (grey, studs, a plate on top)
  part(0, 0.3, 0, 12, 0.6, 12, 0x6e6e72); part(0, 0.65, 0, 6, 0.1, 6, 0xf2f3f3, { studs: false, deco: true });
  station('SPAWN', 'everyone starts here', 0, 0, 8, 8, 0);
  signPost(['GRUG STARTER', 'your game starts here'], 0, -20, 0, 1, 20, 5, '#ffff00', 6.5);

  // --- danger (west of the spawn): a damage pad (one square of health a second) and a kill brick. Red means danger.
  const KX = -34, KZ = -6;
  ST.hurt = part(KX - 8, 0.2, KZ, 10, 0.4, 10, 0xff0000, { studs: false });
  part(KX + 9, 1, KZ, 6, 2, 6, 0xff0000, { p: { kind: 'kill' } });
  Bills.add('<b>DAMAGE</b><small>-1 health a second</small>', KX - 8, 6, KZ, 120); Bills.add('<b>KILL BRICK</b><small>touch it and you fall apart</small>', KX + 9, 7, KZ, 120);
  station('DANGER', 'red hurts · health is the red squares (top left)', KX, KZ, 16, 9, 0);

  // --- the training dummy (east of the spawn): something to swing at
  ST.dummy = { x: 32, z: -6 };
  part(ST.dummy.x, 0.1, ST.dummy.z, 10, 0.2, 10, 0x27466a, { studs: false, deco: true });
  station('DUMMY', 'F, a click or a tap: swing · three hits break it', ST.dummy.x, ST.dummy.z, 8, 8, 0);

  // decoration: lamps round the spawn, trees round the edge (no collision)
  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) lamp(x, z);
  for (let k = 0; k < 46; k++) { const a = k / 46 * Math.PI * 2, r = rnd(180, 230); TREES.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rnd(0.9, 1.5) }); }
  plantTrees();
}

''' + s[b:]

replace_section('coins: pickups anyone can grab', '')

# the other players: three of them, with a few places to wander between
sub("// They decide WHAT to do (wander, explore the stations, hang out, follow you, sit, the obby, the pads, the lift, the button,\n// go AFK) and press keys like a real person to do it. Their physics is the same as yours.",
    "// They decide WHAT to do (wander between the places below, hang out, follow you, go AFK) and press keys like a real person\n// to do it. Their physics is the same as yours. NPCS is how many: the Game Menu turns them off.\nconst NPCS = 3;\nconst HANGOUTS = [[-46, 34], [46, 34], [0, -52], [-70, -44], [70, -44], [0, 60]];   // places on the plate they wander to (add your game's own)")
a = s.index("const NPC_LINES = ["); b = s.index('\n', a)
s = s[:a] + "const NPC_LINES = ['hi', 'hey', 'lol', 'brb', 'nice hat', 'follow me', 'gg', 'oof', 'this place is cool', 'what are we building', 'race u to the trees', 'dont touch the red', 'anyone wanna race?', 'cool outfit'];" + s[b:]
sub("    const pois = STATIONS.filter(s => s.name !== 'SPAWN' && s.name !== 'SKY DECK').map(s => ({ name: s.name.toLowerCase(), x: s.x, z: s.z, r: Math.min(10, s.hw, s.hd), weight: 1 }));\n    pois.push({ name: 'the sky deck', x: 100, z: 75, r: 8, minH: 28, via: ['elevator', 'pad'] });\n",
    "    const pois = STATIONS.filter(s => s.name !== 'SPAWN').map(s => ({ name: s.name.toLowerCase(), x: s.x, z: s.z, r: Math.min(10, s.hw, s.hd), weight: 1 }));\n    HANGOUTS.forEach(([x, z], i) => pois.push({ name: 'spot ' + (i + 1), x, z, r: 10, weight: 1 }));\n")
sub("{ spawn: { ...SPAWN }, pois, obby: ST.obby, elevators: [ST.lift], settings: { chat: 0 },", "{ spawn: { ...SPAWN }, pois, settings: { chat: 0 },")
sub("n.tag = makeTag(n.name); n.coins = 0; npcs.push(n); },", "n.tag = makeTag(n.name); npcs.push(n); },")
sub("crowd.setCount(Save.npcs ? 10 : 0);", "crowd.setCount(Save.npcs ? NPCS : 0);")
sub("crowd.setCount(on ? 10 : 0);", "crowd.setCount(on ? NPCS : 0);")
sub("    // falling apart and coming back (they die on the obby and the kill brick too)", "    // falling apart and coming back (the kill brick and the edge of the plate get them too)")

# you: no blaster in your hand, no coins, no pads by the spawn, no lift
sub("{ skin: 0xf5cd30, shirt: 0x0d69ac, pants: 0x4b974b }, { gun: true }), name: Save.name, isPlayer: true, hp: MAXHP, hitFx: 0, armed: false, aimPitch: 0, coins: 0 };", "{ skin: 0xf5cd30, shirt: 0x0d69ac, pants: 0x4b974b }), name: Save.name, isPlayer: true, hp: MAXHP, hitFx: 0 };")
sub("  setInput(); updateLift(dt);\n", "  setInput();\n")
a = s.index("  // the pads near the spawn (each fires once per visit)\n"); b = s.index("  Snd.walking(ch.grounded", a)
s = s[:a] + s[b:]
sub("let hurtAcc = 0, padOn = '';", "let hurtAcc = 0;")
replace_section('the lift and the door', '')

# the swing and the training dummy, in place of the blaster range
replace_section('the blaster (a tool) and the dummies', HEAD + '''the swing and the training dummy
// F, a left click or a tap: you swing. The hit lands partway through, on whatever stands in front of you within reach.
// This is where a game's own attack goes (an axe, a sword, a tool): keep the Voice.say(player, 'attack') and the laugh.
const SWING = { T: 0.32, CD: 0.5, REACH: 7.5, DMG: 34, cd: 0, t: 9, hit: true };
function swing() {
  const ch = player && player.ch; if (!ch || menuOpen() || ch.dead || ch.sit || ch.climbing || player.roll || SWING.cd > 0) return;
  SWING.cd = SWING.CD; SWING.t = 0; SWING.hit = false; Snd.play('swing', ch.x, ch.y, ch.z); Voice.say(player, 'attack');
}
function swingStrike() {
  const ch = player.ch, fx = -Math.sin(ch.faceYaw), fz = -Math.cos(ch.faceYaw);
  for (const d of DUMMIES) {
    if (d.hp <= 0) continue; const dx = d.ch.x - ch.x, dz = d.ch.z - ch.z, L = Math.hypot(dx, dz);
    if (L > SWING.REACH || Math.abs(d.ch.y - ch.y) > 5 || (L > 1.5 && (dx * fx + dz * fz) / L < 0.25)) continue;
    d.hp -= SWING.DMG; d.hitFx = 0.15; DmgNum.add(d.ch.x, d.ch.y + 3, d.ch.z, String(SWING.DMG), 'kill', d.ch.y - 3); Snd.play('hit', d.ch.x, d.ch.y, d.ch.z); FX.shotHit(d.ch.x, d.ch.y + 1, d.ch.z, true);
    if (d.hp <= 0) { breakApart(d.rig, 1.4); Snd.play('oof', d.ch.x, d.ch.y, d.ch.z); d.t = 4; Voice.say(player, 'laugh'); }   // an elimination: the laugh
  }
}
function updateSwing(dt) {   // (after animateRig: the swing takes over your right arm while it lasts)
  SWING.cd = Math.max(0, SWING.cd - dt); if (SWING.t > SWING.T) return; SWING.t += dt;
  if (!SWING.hit && SWING.t >= SWING.T * 0.45) { SWING.hit = true; if (!player.ch.dead) swingStrike(); }
  if (!player.ch.dead && !player.roll) { const k = Math.min(1, SWING.t / SWING.T); player.rig.j.rs = 2.9 - 2.6 * k * k; player.rig.rs.rotation.x = player.rig.j.rs; }   // up, then down in front
}
const DUMMIES = [];
function makeDummies() {
  const ch = { x: ST.dummy.x, y: 3, z: ST.dummy.z, vx: 0, vz: 0, faceYaw: Math.PI / 2, grounded: true, sit: null };   // it faces the spawn
  const d = { ch, rig: makeRig(randomLook()), name: 'Dummy', hp: 100, max: 100, hitFx: 0, t: 0 };
  d.tag = makeTag('Dummy', 1); DUMMIES.push(d); dressExtra(d.rig);
}
function updateDummies(dt) {
  for (const d of DUMMIES) {
    if (d.hp <= 0) { d.t -= dt; if (d.t <= 0) { d.hp = d.max; d.rig.root.visible = d.dressed !== false; FX.ring(d.ch.x, 0.5, d.ch.z, 0x9fd8ff); } else continue; }
    animateRig(d, dt, 'idle');
    const k = Math.ceil(d.hp / d.max * 10), key = String(k);
    if (d.tag.hpKey !== key) { d.tag.hpKey = key; d.tag.hp.innerHTML = Array.from({ length: 10 }, (_, i) => `<i${i < k ? '' : ' class="off"'}></i>`).join(''); }
  }
}

''')

# input: F, a click or a tap swings
sub("  if (e.code === 'Digit1' || e.code === 'Numpad1') setTool(!TOOL.on);\n", "  if (e.code === 'KeyF') swing();\n")
sub("if (d.b === 0) shootAt(e.clientX, e.clientY); });", "if (d.b === 0) swing(); });")
sub("&& !menuOpen()) shootAt(L.x, L.y);", "&& !menuOpen()) swing();")

# the HUD: no coins; the hotbar's one slot is the swing
sub("  const ks = [P.name, player.hp, Save.coins, jump, ch.sit ? 1 : 0, ch.climbing ? 1 : 0].join('|');", "  const ks = [P.name, player.hp, jump, ch.sit ? 1 : 0, ch.climbing ? 1 : 0].join('|');")
sub("${cellRow(MAXHP, player.hp, 'h')}<div class=\"cash\">COINS <b>${Save.coins}</b></div><small>${jump}</small>", "${cellRow(MAXHP, player.hp, 'h')}<small>${jump}</small>")
a = s.index("  const rows = [[player.name || 'Player', Save.coins, true],"); b = s.index("function renderHotbar()", a); b2 = s.index('\n', b) + 1
s = s[:a] + '''  const rows = [player.name || 'Player', ...npcs.map(n => n.name)];   // the player list: names only (add a score column when your game has one)
  const kpl = rows.join('|');
  if (kpl !== keyPl) { keyPl = kpl; $('plist').innerHTML = '<div class="ph"><span>Players</span><span></span></div>' + rows.map((n, i) => `<div class="pr${i ? '' : ' me'}"><span></span><span></span></div>`).join(''); $('plist').querySelectorAll('.pr span:first-child').forEach((sp, i) => { sp.textContent = rows[i]; }); }
}
function renderHotbar() { $('hotbar').innerHTML = '<button class="slot ol" id="slot1"><em>F</em>Swing</button>'; $('slot1').addEventListener('click', e => { e.stopPropagation(); Snd.wake(); swing(); }); }
''' + s[b2:]
sub("return best || { name: 'BASEPLATE', sub: 'walk to a sign' }; }", "return best || { name: 'BASEPLATE', sub: 'an empty plate: build your game here' }; }")

# start and the frame loop
sub("buildWorld(); flushStatic(); placeCoins();\n", "buildWorld(); flushStatic();\n")
sub("  stepWorld(dt); syncLift(); updateDoor(dt);\n  playerUpdate(dt); animateRig(player, dt, player.ch.dead ? 'idle' : undefined);\n", "  stepWorld(dt);\n  playerUpdate(dt); animateRig(player, dt, player.ch.dead ? 'idle' : undefined); updateSwing(dt);\n")
sub("  updateComp(dt); updateDummies(dt); updateCoins(dt);\n", "  updateComp(dt); updateDummies(dt);\n")
sub("npcs, DUMMIES, COINS, STATIONS, TOOL, setTool, shootAt, tryDash,", "npcs, DUMMIES, STATIONS, SWING, swing, hurt, Voice, Snd, tryDash,")

for gone in ('ST.lift', 'ST.door', 'ST.spots', 'ST.obby', 'ST.range', 'TOOL', 'COINS', 'Save.coins', 'shootAt', 'placeCoins', 'updateLift', 'padOn', 'GRUG BASEPLATE'):
    assert not re.search(r'(?<![\w.])' + re.escape(gone) + r'(?!\w)', s[s.index("'use strict';\nif (typeof THREE"):]), 'still there: ' + gone

dest = os.path.join(ROOT, 'arcade/starter/index.html'); os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w', encoding='utf-8').write(s); print('wrote', dest, len(s) // 1024, 'KB')

# ---------------------------------------------------------------------------------------------------------- one file
if '--single' in sys.argv:
    out = s
    esc = lambda js: js.replace('</script', '<\\/script')
    def inline(tag_re, body):
        global out
        out, n = re.subn(tag_re, lambda m: body, out); assert n == 1, (tag_re, n)
    # three.js built in (no CDN, so it opens without the internet)
    inline(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/three\.js/r128/three\.min\.js"></script>\n<script>window\.THREE \|\| document\.write\([^\n]*</script>',
           '<script>\n' + esc(read('static/vendor/three-r128.min.js')) + '\n</script>')
    # the voices (the clips as data: URIs) and the soft sounds
    clipdir = os.path.join(ROOT, 'static/voice/player')
    clips = {f[:-4]: 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(clipdir, f), 'rb').read()).decode() for f in sorted(os.listdir(clipdir)) if f.endswith('.mp3')}
    inline(r'<script src="/static/voice\.js"></script>[^\n]*', '<script>window.GRUG_VOICE_SRCS = ' + json.dumps(clips) + ';</script>\n<script>\n' + esc(read('static/voice.js')) + '\n</script>   <!-- window.GrugVoice (static/voice.js), with the clips built in -->')
    inline(r'<script src="/static/sfx\.js"></script>[^\n]*', '<script>\n' + esc(read('static/sfx.js')) + '\n</script>   <!-- window.GrugSfx (static/sfx.js) -->')
    inline(r'<script src="/static/yt480\.js"></script>[^\n]*', '<script>\n' + esc(read('static/yt480.js')) + '\n</script>   <!-- window.GrugYT480 (static/yt480.js) -->')
    # the site's own pieces (the Pearls wallet, saved outfits) stay on the site: off it the game keeps its classic looks
    for name in ('vendor/three-r128-GLTFLoader', 'pearls', 'outfits', 'outfit-rig', 'pearl-popup'):
        out, n = re.subn(r'<script src="/static/' + re.escape(name) + r'\.js"></script>[^\n]*\n', '', out); assert n == 1, name
    # the font
    font = base64.b64encode(read('static/fonts/allo-latin.woff2', 'rb')).decode()
    inline(r'<link rel="preload" href="/static/fonts/allo-latin\.woff2"[^>]*>\n<link rel="stylesheet" href="/static/fonts/allo\.css">',
           '<style>@font-face { font-family: Allo; font-style: normal; font-weight: 100 900; font-display: swap; src: url(data:font/woff2;base64,' + font + ') format("woff2"); }</style>   <!-- Allo (SIL Open Font License 1.1, github.com/joshpuckett/allo) -->')
    out = out.replace('<title>Grug Starter · a bare baseplate to build a Grug game on</title>', '<title>Grug Starter · a bare baseplate to build a Grug game on (single file)</title>\n<!-- SINGLE-FILE COPY (python3 src/starter/build.py --single): three.js, the voices, the soft sounds and the font are built in, so it plays opened\n     straight from a disk. The Pearls wallet and saved outfits are the site\'s, so here everyone wears the classic looks. For a game on the site, start\n     from arcade/starter/index.html instead (it loads the shared /static/ files). -->', 1)
    assert not re.search(r'(src|href)="/static/', out), re.findall(r'(?:src|href)="/static/[^"]*', out)[:5]
    sdest = sys.argv[sys.argv.index('--single') + 1]
    open(sdest, 'w', encoding='utf-8').write(out); print('wrote', sdest, len(out) // 1024, 'KB')
