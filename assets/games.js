/* Grug · the game list
   One entry per game on the site. Pages read this to draw tiles, detail pages and the profile's points list.
   play = the app (its Rewards tab etc. are reached from here); game = where the Play buttons go: straight to the
   game in its full view. storageKey = the localStorage key that partner's rewards app saves to (the app's CONFIG.storageKey).
   Paths are relative to the site root; Grug.url() turns them into links from any page.
*/
window.GRUG_GAMES = [
  {
    id: 'yoshi', app: 'yoshi',
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
    title: 'Steal a Sip', kind: '3D tycoon', status: 'live',
    partner: 'Teahouse Express', place: 'Katy Mills',
    blurb: 'Grab drinks on the Tea Trail, outrun the Keepers, and run the richest patio shack.',
    long: 'Ride down a winding Tea Trail through six zones, grab sealed Teahouse Express drinks and bring them home to your patio shack, where they brew and customers buy them. Copies stack and earn more, faster rides get you past the Keepers to the rare drinks, and you play as your own avatar. Points from Teahouse Express (or Pearls) buy speed boosts, passes and cash packs in the Store.',
    play: 'play/teahouse/', game: 'play/teahouse/#katy-mills/game', storageKey: 'teahouse-express-rewards-v1', old: 'https://gabrielman25.github.io/teahouse-express/',
    thumb: 'assets/thumbs/stealasip.jpg', color: '#1E6B35', ink: '#FFFFFF',
    avatar: 'You play as your avatar', earn: 'Eat at Teahouse Express, tap the tag, 5 points a visit'
  },
  {
    id: 'cielito', app: 'cielito',
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
    title: 'Sunrise to Sunset', kind: 'Barista sim', status: 'live',
    partner: 'Soluna Coffee', place: 'Elyson Falls, Katy',
    blurb: 'Open the shop at sunrise, pour the orders and close at sunset. Buy boosts and passes with Pearls or Soluna points.',
    long: 'Soluna’s coffee-shop game, on the Game tab of the Soluna app. You work the bar as your own Grug avatar, and every customer is a Sandy. The Store sells shift boosts, packs and forever passes for Pearls (spent first) or Soluna points.',
    play: 'play/soluna/', game: 'play/soluna/#elyson/game', storageKey: 'soluna-site-v2', old: 'https://gabrielman25.github.io/soluna-coffee/',
    thumb: 'assets/thumbs/soluna.jpg', color: '#B08A57', ink: '#5F5C37',
    avatar: 'Plays as your avatar', earn: 'Visit Soluna, enter the board code, 5 points a visit'
  },
  {
    // Demo made to pitch Rodeo Express Car Wash: not a live partner yet. The app shows a "Demo" bar on every screen.
    id: 'rodeo', app: 'rodeo',
    title: 'Rodeo Wash Simulator', kind: '3D simulator', status: 'preview',
    partner: 'Rodeo Express Car Wash', place: 'Peek Rd, Katy',
    blurb: 'Spray muddy cars clean, open more bays and wash packages, hire a crew and rebirth for bigger Bucks.',
    long: 'A demo made for Rodeo Express Car Wash. Cars pull into your bays covered in mud, and you walk around each one with a pressure wand: Soft Wash, Triple Foam, Tire Shine and Rodeo Ceramic, the steps of their real wash menu. Bucks buy upgrades, bays, bigger packages and a crew; rebirth for a bigger multiplier. At the wash, tapping the poster at your bay earns Rodeo points for passes and boosts, and doubles your Bucks for 15 minutes.',
    play: 'play/rodeo/', game: 'play/rodeo/#katy/game', storageKey: 'rodeo-express-rewards-v1', old: '',
    thumb: 'assets/thumbs/rodeo.jpg', color: '#E39B32', ink: '#4B3A2C',
    avatar: 'You play as your avatar', earn: 'Wash at Rodeo Express, tap the poster at your bay, 10 points a visit (demo)'
  },
  {
    id: 'alchemy', app: 'alchemy',
    title: 'Sugar Alchemist', kind: 'Bakery sim', status: 'preview',
    partner: 'Alchemy Bake Lab', place: 'Katy',
    blurb: 'Take the order, mix it, frost it, serve it. Play one day of the cupcake shop while the full game is in the works.',
    long: 'A cupcake-shop game in the spirit of Papa’s Pizzeria, made with the owner of Alchemy Bake Lab. The one-day demo is playable now; finishing a day unlocks the Alchemist toque, the whisk and the cupcake tee.',
    play: 'work/alchemy/site.html', storageKey: '', old: '',
    thumb: 'assets/thumbs/alchemy.jpg', color: '#FF8FB1', ink: '#3B2314',
    avatar: 'Unlocks closet items', earn: 'Finish a day to unlock closet items'
  },
  {
    // Legacy: the Teahouse app's first game, still playable from the Games page (the app runs it with ?game=takeatea).
    // status 'legacy' = listed on the Games page only, not on the home page. No storageKey: its points are Teahouse's,
    // already listed under Steal a Sip.
    id: 'takeatea', app: 'teahouse',
    title: 'Take a Tea', kind: '3D tycoon', status: 'legacy',
    partner: 'Teahouse Express', place: 'Katy Mills',
    blurb: 'The original Teahouse game: run a boba shop in a blocky 3D world, serve customers and race the clock.',
    long: 'The first Teahouse Express game, kept playable as a classic. A third-person tycoon on Grug’s own voxel engine: walk the mall, lock a shop, pour drinks and watch the cash tick up. Teahouse points still buy its five-minute boosts: speed, luck, longer locks, a tip jar and double cash. Your avatar is the character you play as.',
    play: 'play/teahouse/?game=takeatea#katy-mills/game', storageKey: '', old: '',
    thumb: 'assets/thumbs/teahouse.jpg', color: '#F6C445', ink: '#1E6B35',
    avatar: 'You play as your avatar', earn: 'Uses your Teahouse Express points'
  }
];
