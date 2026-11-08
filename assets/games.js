/* Grug · the game list
   One entry per game on the site. Pages read this to draw tiles, detail pages and the profile's points list.
   play = the app (its Rewards tab etc. are reached from here); game = where the Play buttons go: straight to the
   game in its full view. storageKey = the localStorage key that partner's rewards app saves to (the app's CONFIG.storageKey).
   Paths are relative to the site root; Grug.url() turns them into links from any page.
   listed: false keeps a game off the Games page and the home page's game tiles (it stays playable in its app).

   FOSSIL32 boxes (assets/fossil32/, see CLAUDE.md "Adding a game"): every listed game is shown as a 3D cartridge box.
   title     = the retro box title (90s / early-2000s style); appTitle = the name the game's own title screen uses.
   subtitle  = the tagline printed under the box title.  features = 3-5 short lines for the game panel.
   box       = { code: catalog number 'GD-xxxx' (unique), shell: cartridge plastic + box accent colour, players, region,
                 font: a title font from assets/fossil32/fossil32.css, fill: [top, bottom] colours of the title gradient,
                 art: assets/boxart/<id>.jpg (1580x950 cover art, the avatar in an action pose, NO title text: the box adds it),
                 shots: up to 3 back-of-box screenshots, 800x450 }
   thumb     = a flat picture for anything that isn't a box (point it at the box art).
*/
window.GRUG_GAMES = [
  {
    // listed: false = kept out of the Games page and the home page's game tiles; it lives on in its rewards app.
    id: 'yoshi', app: 'yoshi', listed: false,
    title: 'Sushi Swap', kind: 'Match-3', status: 'live',
    partner: 'Yoshi Sushi Asian Fusion', place: 'Elyson Falls, Katy',
    blurb: 'Swap sushi to line up three, clear the board and climb the courses before your moves run out.',
    long: 'A fast match-3 built from Yoshi’s real menu. Every course has a target; beat it for bonus moves. Yoshi points buy one-run power-ups: Extra Moves, Double Points, Head Start and the Chef’s Knife. Your avatar stands by the board and cheers every combo.',
    play: 'play/yoshi/', game: 'play/yoshi/#elyson/game', storageKey: 'yoshi-elyson-rewards-v1', old: 'https://gabrielman25.github.io/yoshi-rewards/',
    thumb: 'assets/thumbs/yoshi.jpg', color: '#F26A1B', ink: '#171412',
    avatar: 'Cheers beside the board', earn: 'Eat at Yoshi, tap the tag, 10 points a visit'
  },
  {
    id: 'teahouse', app: 'teahouse',
    title: 'Boba Bandit', appTitle: 'Steal a Sip', subtitle: 'Tea Trail Heist', kind: '3D tycoon', status: 'live',
    partner: 'Teahouse Express', place: 'Katy Mills',
    blurb: 'Grab drinks on the Tea Trail, outrun the Keepers, and run the richest patio shack.',
    long: 'Ride down a winding Tea Trail through six zones, grab sealed Teahouse Express drinks and bring them home to your patio shack, where they brew and customers buy them. Copies stack and earn more, faster rides get you past the Keepers to the rare drinks, and you play as your own avatar. Points from Teahouse Express (or Pearls) buy speed boosts, passes and cash packs in the Store.',
    play: 'play/teahouse/', game: 'play/teahouse/#katy-mills/game', storageKey: 'teahouse-express-rewards-v1', old: 'https://gabrielman25.github.io/teahouse-express/',
    thumb: 'assets/boxart/teahouse.jpg', color: '#1E6B35', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Eat at Teahouse Express, tap the tag, 5 points a visit',
    features: [
      "Ride the six-zone Tea Trail and grab sealed Teahouse Express drinks",
      "Outrun the Keepers to reach the rare brews",
      "Run a patio shack where copies stack and earn faster",
      "Play as your own avatar; spend Teahouse points or Pearls in the Store"
    ],
    box: { code: 'GD-0012', shell: '#2FAE5A', players: '1P', region: 'KATY, TX', font: 'Luckiest Guy', fill: ["#E9FF9A", "#3CC56A"],
           art: 'assets/boxart/teahouse.jpg', shots: ['assets/boxart/shots/teahouse-1.jpg'] }
  },
  {
    // listed: false = kept out of the Games page and the home page's game tiles; it lives on in its rewards app.
    id: 'cielito', app: 'cielito', listed: false,
    title: 'Taco Match', kind: 'Match-3', status: 'live',
    partner: 'Cielito Lindo Taqueria', place: 'FM 529, Katy',
    blurb: 'Match tacos, eggs and chilaquiles from the real breakfast board. Combos score big.',
    long: 'Cielito Lindo’s menu turned into a match-3. Line up three or more, chain combos and reach each course’s target for extra moves. Cielito points buy power-ups for the next run. Your avatar cheers from the sideline.',
    play: 'play/cielito/', game: 'play/cielito/#katy/game', storageKey: 'cielito-lindo-rewards-v1', old: 'https://gabrielman25.github.io/cielito-lindo-rewards/',
    thumb: 'assets/thumbs/cielito.jpg', color: '#F2B544', ink: '#7A3E1B',
    avatar: 'Cheers beside the board', earn: 'Eat at Cielito Lindo, tap the tag, 10 points a visit'
  },
  {
    id: 'soluna', app: 'soluna',
    title: 'Barista Blitz', appTitle: 'Sunrise to Sunset', subtitle: 'Sunrise to Sunset', kind: 'Barista sim', status: 'live',
    partner: 'Soluna Coffee', place: 'Elyson Falls, Katy',
    blurb: 'Open the shop at sunrise, pour the orders and close at sunset. Buy boosts and passes with Pearls or Soluna points.',
    long: 'Soluna’s coffee-shop game, on the Game tab of the Soluna app. You work the bar as your own Grug avatar, and every customer is a Sandy. The Store sells shift boosts, packs and forever passes for Pearls (spent first) or Soluna points.',
    play: 'play/soluna/', game: 'play/soluna/#elyson/game', storageKey: 'soluna-site-v2', old: 'https://gabrielman25.github.io/soluna-coffee/',
    thumb: 'assets/boxart/soluna.jpg', color: '#B08A57', ink: '#5F5C37',
    avatar: 'Plays as your avatar', earn: 'Visit Soluna, enter the board code, 5 points a visit',
    features: [
      "Open the shop at sunrise and work the bar until sunset",
      "Pour every order before the line backs up",
      "Every customer is a Sandy, and you play as your own avatar",
      "Shift boosts, packs and forever passes for Pearls or Soluna points"
    ],
    box: { code: 'GD-0014', shell: '#C8924F', players: '1P', region: 'KATY, TX', font: 'Titan One', fill: ["#FFF1D6", "#E0A35C"],
           art: 'assets/boxart/soluna.jpg', shots: ['assets/boxart/shots/soluna-1.jpg'] }
  },
  {
    // Demo made to pitch Rodeo Express Car Wash: not a live partner yet. The app shows a "Demo" bar on every screen.
    id: 'rodeo', app: 'rodeo',
    title: 'Turbo Suds 2000', appTitle: 'Rodeo Wash Simulator', subtitle: 'Rodeo Express Edition', kind: '3D simulator', status: 'preview',
    partner: 'Rodeo Express Car Wash', place: 'Peek Rd, Katy',
    blurb: 'Hand-wash muddy cars, run the Express Tunnel from the pay station, hire a crew and rebirth for bigger Bucks.',
    long: 'A demo made for Rodeo Express Car Wash, in a blocky voxel world. Hand-wash muddy cars in your bays with a pressure wand (Soft Wash, Triple Foam, Tire Shine and Rodeo Ceramic, the steps of their real menu), and run the Express Tunnel: stand at the pay station to check drivers in, and the conveyor pulls them through the machines. Bucks buy upgrades, bays, packages, attendants and a crew; rebirth for a bigger multiplier. You wear the Rodeo crew tee, or your own shirt from the locker. Tapping the poster at your bay earns Rodeo points and doubles your Bucks for 15 minutes.',
    play: 'play/rodeo/', game: 'play/rodeo/#katy/game', storageKey: 'rodeo-express-rewards-v1', old: '',
    thumb: 'assets/boxart/rodeo.jpg', color: '#E39B32', ink: '#4B3A2C',
    avatar: 'You play as your avatar', earn: 'Wash at Rodeo Express, tap the poster at your bay, 10 points a visit (demo)',
    features: [
      "Hand-wash muddy cars: Soft Wash, Triple Foam, Tire Shine and Rodeo Ceramic",
      "Run the Express Tunnel from the pay station",
      "Hire attendants and a crew, then rebirth for a bigger multiplier",
      "Tap the poster at your bay for Rodeo points and double Bucks"
    ],
    box: { code: 'GD-0021', shell: '#E39B32', players: '1P', region: 'KATY, TX', font: 'Bungee', fill: ["#FFF27A", "#FF9A2E"],
           art: 'assets/boxart/rodeo.jpg', shots: ['assets/boxart/shots/rodeo-1.jpg', 'assets/boxart/shots/rodeo-2.jpg'] }
  },
  {
    // A Grug original: no restaurant behind it (standalone: true). play/runway/ hosts it in place of a rewards app;
    // power-ups cost Pearls only. Its save ('grug-runway-v1') holds power-ups and best score, not partner points,
    // so it has no storageKey here (that field means "partner points live there").
    id: 'runway', app: 'runway', standalone: true,
    title: 'Catwalk Craze', appTitle: 'Runway Ready', subtitle: 'Fashion House Showdown', kind: '3D dress-up', status: 'live',
    partner: 'Grug Original', place: 'Plays anywhere',
    blurb: 'Dress to the theme in a voxel fashion house, then walk the runway against four rivals.',
    long: 'A theme appears (Ocean Blue, Cowgirl, Red Carpet and more). Run through six wardrobe rooms full of pieces from the Grug avatar closet, pick their colours and beat the clock, then strut the runway. Matching the theme earns up to 70 points and the judges add up to 30. Pearls buy Extra Time, Style Hints, Fast Feet and Spotlight, and you play as your own avatar.',
    play: 'play/runway/', game: 'play/runway/', storageKey: '', old: '',
    thumb: 'assets/boxart/runway.jpg', color: '#F43F5E', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Power-ups use Pearls, the Grug currency',
    features: [
      "A new theme every round: Ocean Blue, Cowgirl, Red Carpet and more",
      "Six wardrobe rooms stocked from the Grug avatar closet",
      "Theme checks score up to 70 and the judges add up to 30",
      "Pearl power-ups: Extra Time, Style Hints, Fast Feet and Spotlight"
    ],
    box: { code: 'GD-0030', shell: '#F43F5E', players: '1P', region: 'WORLDWIDE', font: 'Bowlby One', fill: ["#FFE0EA", "#FF4F7B"],
           art: 'assets/boxart/runway.jpg', shots: ['assets/boxart/shots/runway-1.jpg', 'assets/boxart/shots/runway-2.jpg'] }
  },
  {
    // A Grug original (standalone: true): play/chestquest/ hosts it in place of a rewards app; power-ups cost Pearls only.
    // Its save ('grug-chestquest-v1') holds power-ups and best score, not partner points, so no storageKey here.
    id: 'chestquest', app: 'chestquest', standalone: true,
    title: 'Crypt Crawler', appTitle: 'Chest Quest', subtitle: 'The Endless Chest Quest', kind: '3D dungeon roguelike', status: 'live',
    partner: 'Grug Original', place: 'Plays anywhere',
    blurb: "Delve floor after floor of a blocky dungeon, crypt and caves: open every chest, then race back to the stairs while monsters you can't beat hunt you.",
    long: "A Dandy's World-style roguelike. Every floor is a new place (a dungeon, a crypt, caves, catacombs, a library, crystal caves and the ember depths): pick the lock on every chest, grab the gold, then get back to the stairs. Monsters can't be beaten: duck behind a column or a stack of crates, break their line of sight and they give up. Sprint, carry three items, shop with the merchant, and see how deep you can get as your own avatar. Pearls buy power-ups like Extra Heart, Quick Fingers and Second Wind.",
    play: 'play/chestquest/', game: 'play/chestquest/', storageKey: '', old: '',
    thumb: 'assets/boxart/chestquest.jpg', color: '#2A2438', ink: '#FBBF24',
    avatar: 'You play as your avatar', earn: 'Power-ups use Pearls, the Grug currency',
    features: [
      "New places every floor: crypts, caves, catacombs and the ember depths",
      "Pick the lock on every chest, then race back to the stairs",
      "Monsters can't be beaten, so break their line of sight to escape",
      "Carry three items, shop the merchant, and buy power-ups with Pearls"
    ],
    box: { code: 'GD-0031', shell: '#7B5BD6', players: '1P', region: 'WORLDWIDE', font: 'Press Start 2P', fill: ["#FFF3B0", "#F5B20A"],
           art: 'assets/boxart/chestquest.jpg', shots: ['assets/boxart/shots/chestquest-1.jpg', 'assets/boxart/shots/chestquest-2.jpg'] }
  },
  {
    // A Grug original (standalone: true): play/glowupspa/ hosts it in place of a rewards app; Store items cost Pearls only.
    // Its host save ('grug-glowupspa-v1') holds owned items and best cash a second, not partner points, so no storageKey here.
    id: 'glowupspa', app: 'glowupspa', standalone: true,
    title: 'Glamour Spa Deluxe', appTitle: 'Glow Up Spa', subtitle: 'Salon & Pet Tycoon', kind: '3D tycoon', status: 'live',
    partner: 'Grug Original', place: 'Plays anywhere',
    blurb: 'Run a salon and spa, sneak eggs out of the Beauty Store, and hatch pets that earn cash.',
    long: 'Build your own salon and spa: your staff give haircuts, pedicures, hair color and face masks while you grab the cash, add chairs, hire staff and open new rooms. Train your Speed on the treadmill, sneak eggs out of the six-zone Beauty Store mall past the clerks, and hatch pets that roam your field and earn cash on their own. Fuse matching pets to grow them, collect gold, rainbow and colour variants, and rebirth for a bigger multiplier. You play as your own avatar, and Pearls buy speed, passes, boosts and cash packs in the Store.',
    play: 'play/glowupspa/', game: 'play/glowupspa/', storageKey: '', old: '',
    thumb: 'assets/boxart/glowupspa.jpg', color: '#EC4899', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Store items use Pearls, the Grug currency',
    features: [
      "Your staff do haircuts, pedicures, colour and face masks while you collect",
      "Sneak eggs out of the six-zone Beauty Store past the clerks",
      "Hatch, fuse and collect gold and rainbow pets that earn cash",
      "Rebirth for a bigger multiplier; Pearls buy passes, boosts and cash packs"
    ],
    box: { code: 'GD-0032', shell: '#EC4899', players: '1P', region: 'WORLDWIDE', font: 'Titan One', fill: ["#FFE3F3", "#FF5FB0"],
           art: 'assets/boxart/glowupspa.jpg', shots: ['assets/boxart/shots/glowupspa-1.jpg', 'assets/boxart/shots/glowupspa-2.jpg'] }
  },
  {
    // A Grug original (standalone: true): play/petmountainrescue/ hosts it in place of a rewards app; Store items cost Pearls only.
    // Its host save ('grug-petmountainrescue-v1') holds owned items and best height, not partner points, so no storageKey here.
    id: 'petmountainrescue', app: 'petmountainrescue', standalone: true,
    title: 'Peak Pals', appTitle: 'Pet Mountain Rescue', subtitle: 'Mountain Rescue Adventure', kind: '3D climber + pet tycoon', status: 'live',
    partner: 'Grug Original', place: 'Plays anywhere',
    blurb: 'Climb an endless block mountain with a climbing partner, rescue stranded pets, and watch them earn gems at your Pet Haven.',
    long: 'You can’t jump, but your partner can boost you: set her down by a ledge, hop up on her head, then pull her up after you. Pets are stranded all the way up the mountain, rarer the higher you go: lead them to a camp’s Rescue Hut and they move into your Pet Haven, where they settle in and earn gems, even while you’re away. Pick one of three climbing partners (Booster, Pet Whisperer or Scout) who levels up as you climb together, spend gems on climbing and walking upgrades, Haven pads and her wardrobe, and climb as your own avatar. Pearls buy forever passes like x2 Gems and x2 Settle Speed, boosts, gem packs and a camp skip.',
    play: 'play/petmountainrescue/', game: 'play/petmountainrescue/', storageKey: '', old: '',
    thumb: 'assets/boxart/petmountainrescue.jpg', color: '#f97316', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Store items use Pearls, the Grug currency',
    features: [
      "Climb an endless block mountain with a partner who boosts you up",
      "Rescue stranded pets, rarer the higher you go",
      "Your Pet Haven earns gems even while you're away",
      "Three climbing partners who level up as you climb together"
    ],
    box: { code: 'GD-0033', shell: '#F97316', players: '1P', region: 'WORLDWIDE', font: 'Bungee', fill: ["#FFF1A8", "#FF8A1F"],
           art: 'assets/boxart/petmountainrescue.jpg', shots: ['assets/boxart/shots/petmountainrescue-1.jpg', 'assets/boxart/shots/petmountainrescue-2.jpg'] }
  },
  {
    // A Grug original (standalone: true): play/mysteryblasters/ hosts it in place of a rewards app; Store items cost Pearls only.
    // Its host save ('grug-mysteryblasters-v1') holds owned items and best round, not partner points, so no storageKey here.
    id: 'mysteryblasters', app: 'mysteryblasters', standalone: true,
    title: 'Foam Frenzy', appTitle: 'Mystery Blasters', subtitle: 'A Whodunit Party',
    kind: '3D party game', status: 'live',
    partner: 'Grug Original', place: 'Plays anywhere',
    blurb: 'One player is the Murderer, one is the Sheriff: find the Murderer before everyone is tagged, then unbox wild blaster skins and hatch pets.',
    long: 'A Murder Mystery-style party game against eight bots on three blocky maps (Whispering Forest, Moonlit Mansion and Blockrock Prison) with fog of war: you only see the room you’re in, and next door through an open doorway. Be the Murderer, the Sheriff or an Innocent. The Murderer’s foam blaster knocks players down, then she has to walk up and finish them off, or drag the body into a closet. Innocents fix five fuse boxes to open an escape hatch, hide in lockers and boxes (watch your air!), and crawl through vents once they’re down. Every coin you grab goes to blaster crates (millions of skins with colours, patterns, glows, trails and rare mutations) and pet eggs with powers like Dash and Vanish. You play as your own avatar, and Pearls buy role chances, double coins, a VIP pass and more.',
    play: 'play/mysteryblasters/', game: 'play/mysteryblasters/', storageKey: '', old: '',
    thumb: 'assets/boxart/mysteryblasters.jpg', color: '#F43F5E', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Store items use Pearls, the Grug currency',
    features: [
      "Be the Murderer, the Sheriff or an Innocent in two-minute rounds against eight bots",
      "Three blocky maps with fog of war: Whispering Forest, Moonlit Mansion and Blockrock Prison",
      "Fix fuse boxes, hide in lockers and crawl through vents to escape",
      "Unbox blaster skins with millions of looks and hatch pets with powers"
    ],
    box: { code: 'GD-0034', shell: '#22D3EE', players: '1P', region: 'WORLDWIDE', font: 'Righteous', fill: ["#E0FDFF","#22D3EE"],
           art: 'assets/boxart/mysteryblasters.jpg', shots: ['assets/boxart/shots/mysteryblasters-1.jpg', 'assets/boxart/shots/mysteryblasters-2.jpg'] }
  },
  {
    id: 'alchemy', app: 'alchemy',
    title: 'Sugar Sorcery', appTitle: 'Sugar Alchemist', subtitle: 'Alchemy Bake Lab', kind: '3D bakery sim', status: 'live',
    partner: 'Alchemy Bake Lab', place: 'Peek Rd, Katy',
    blurb: 'Run the counter at Alchemy Bake Lab: mix, bake, frost and sparkle treats to match every ticket.',
    long: 'A 3D bakery game in the spirit of Papa’s Pizzeria. Take the order, stir the batter in the flask, pull the tray when it’s golden, frost it, add the sparkle and box it up; the closer it matches the ticket, the bigger the tip. Tips buy oven upgrades and decor for your lab, ranks unlock layer cakes, cake pops, macarons and custom cakes, and you play as your own avatar. Alchemy points (or Pearls) buy boosts, passes and tip packs in the Store. Points are for the game only.',
    play: 'play/alchemy/', game: 'play/alchemy/#katy/game', storageKey: 'alchemy-bake-lab-rewards-v1', old: '',
    thumb: 'assets/boxart/alchemy.jpg', color: '#0B0B0C', ink: '#F7F7F2',
    avatar: 'You play as your avatar', earn: 'Visit Alchemy Bake Lab, tap the tag, 10 points a visit',
    features: [
      "Mix, bake, frost and sparkle treats to match every ticket",
      "The closer you match the order, the bigger the tip",
      "Ranks unlock layer cakes, cake pops, macarons and custom cakes",
      "Alchemy points or Pearls buy boosts, passes and tip packs"
    ],
    box: { code: 'GD-0040', shell: '#A78BFA', players: '1P', region: 'KATY, TX', font: 'Luckiest Guy', fill: ["#FCE7FF", "#C084FC"],
           art: 'assets/boxart/alchemy.jpg', shots: ['assets/boxart/shots/alchemy-1.jpg', 'assets/boxart/shots/alchemy-2.jpg'] }
  },
  {
    // Legacy: the Teahouse app's first game, still playable from the Games page (the app runs it with ?game=takeatea).
    // status 'legacy' = listed on the Games page only, not on the home page. No storageKey: its points are Teahouse's,
    // already listed under Steal a Sip.
    id: 'takeatea', app: 'teahouse',
    title: 'Tea Time Tycoon', appTitle: 'Take a Tea', subtitle: 'The Original Mall Shop', kind: '3D tycoon', status: 'legacy',
    partner: 'Teahouse Express', place: 'Katy Mills',
    blurb: 'The original Teahouse game: run a boba shop in a blocky 3D world, serve customers and race the clock.',
    long: 'The first Teahouse Express game, kept playable as a classic. A third-person tycoon on Grug’s own voxel engine: walk the mall, lock a shop, pour drinks and watch the cash tick up. Teahouse points still buy its five-minute boosts: speed, luck, longer locks, a tip jar and double cash. Your avatar is the character you play as.',
    play: 'play/teahouse/?game=takeatea#katy-mills/game', storageKey: '', old: '',
    thumb: 'assets/boxart/takeatea.jpg', color: '#F6C445', ink: '#1E6B35',
    avatar: 'You play as your avatar', earn: 'Uses your Teahouse Express points',
    features: [
      "The original Teahouse Express game, kept as a classic",
      "Walk the mall, lock a shop and pour drinks",
      "Watch the cash tick up as customers line up",
      "Teahouse points still buy its five-minute boosts"
    ],
    box: { code: 'GD-0011', shell: '#F6C445', players: '1P', region: 'KATY, TX', font: 'Righteous', fill: ["#FFF6C2", "#F6C445"],
           art: 'assets/boxart/takeatea.jpg', shots: ['assets/boxart/shots/takeatea-1.jpg'] }
  }
];
