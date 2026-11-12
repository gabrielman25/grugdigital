/* Grug · the Carts: quick 1–3 minute 3D games played one tap (or one hold) at a time, in a vertical swipe feed like
   Reels (games/carts/). They are built with the Grug Micro kit (grug-game-kit/micro: build.py writes the feed and every
   game; copy dist/index.html → games/carts/index.html and dist/games/*.html → games/carts/games/).
   The store lists them in its search (games/#search, the search box, a "Carts" row), each with its cover art
   (assets/carts/<id>.jpg, 1580 x 950, the title and a GRUG CART tag on a HUD-free shot of the game).
   Their saves live in the feed's own record (localStorage 'grug.micro.v1': bests, coins, owned items, favourites);
   Pearls are the site's (grug.pearls.v1). Tapping one opens the feed on it: games/carts/#<id>.
   controls: 'tap' | 'hold' (the only input); len = how long a run takes. */
window.GRUG_CARTS = [
  { id: 'heist', title: 'Egg Heist', controls: 'hold', len: '2–3 min', color: '#f59e0b', tags: ['Heist', 'Pets', 'Collecting', 'Quick Runs'],
    blurb: 'Hold to head out, let go by an egg and tap the ring. Get home before its guardian wakes up and catches you.' },
  { id: 'parry', title: 'Parry Ball', controls: 'tap', len: '1 min', color: '#ef4444', tags: ['Arcade', 'Reflex', 'Competitive', 'Quick Runs'],
    blurb: 'Tap to parry the ball when it comes for you. Every hit makes it faster.' },
  { id: 'stack', title: 'Waffle Stack', controls: 'tap', len: '1 min', color: '#f59e0b', tags: ['Arcade', 'Food & Drink', 'Quick Runs'],
    blurb: 'Tap to drop each waffle right on top and build the tallest stack.' },
  { id: 'redlight', title: 'Red Light', controls: 'hold', len: '1 min', color: '#10b981', tags: ['Party', 'Time Pressure', 'Quick Runs'],
    blurb: 'Hold to run, let go when the watcher turns. Ride the platforms across the pits.' },
  { id: 'bounce', title: 'Bao Bounce', controls: 'hold', len: '1–2 min', color: '#14b8a6', tags: ['Platformer', 'Food & Drink', 'Quick Runs'],
    blurb: 'Hold to power up, let go to jump to the next tower.' },
  { id: 'obby', title: 'Obby Dash', controls: 'tap', len: '1–2 min', color: '#f43f5e', tags: ['Platformer', 'Reflex', 'Quick Runs'],
    blurb: 'Tap to jump. Don’t touch the red blocks.' },
  { id: 'zigzag', title: 'Matcha Zigzag', controls: 'tap', len: '1 min', color: '#4d9e3f', tags: ['Arcade', 'Reflex', 'Food & Drink', 'Quick Runs'],
    blurb: 'Tap to turn. Stay on the path as long as you can.' },
  { id: 'pizza', title: 'Pizza Rush', controls: 'tap', len: '1–2 min', color: '#f97316', tags: ['Cooking', 'Food & Drink', 'Pets', 'Quick Runs'],
    blurb: 'Tap to drop each topping onto the pizza sliding past.' },
  { id: 'catch', title: 'Chopstick Catch', controls: 'tap', len: '1 min', color: '#e11d48', tags: ['Reflex', 'Food & Drink', 'Quick Runs'],
    blurb: 'Tap to snap the chopsticks shut as a dumpling falls through.' },
  { id: 'smash', title: 'Pet Smash', controls: 'tap', len: '1 min', color: '#eab308', tags: ['Pets', 'Collecting', 'Simulator', 'Quick Runs'],
    blurb: 'Your pets smash coin piles by themselves, even while you’re away. Tap to hit and speed them up; hatch eggs and open new zones.' },
  { id: 'colordrop', title: 'Color Drop', controls: 'hold', len: '1–2 min', color: '#3b82f6', tags: ['Party', 'Pets', 'Time Pressure', 'Quick Runs'],
    blurb: 'Hold to walk round the ring and stop on the colour that’s called before the floor drops.' },
  { id: 'quest', title: 'Block Quest', controls: 'tap', len: '2–3 min', color: '#6366f1', tags: ['RPG', 'Dungeon', 'Quick Runs'],
    blurb: 'A turn-based quest in one tap: pick a command, then tap on the beat to hit harder and to block.' },
  { id: 'rocket', title: 'Catch That Rocket!', controls: 'hold', len: '1–2 min', color: '#ef4444', tags: ['Time Pressure', 'Exploration', 'Quick Runs'],
    blurb: 'Run for the launch pad before the countdown ends, then blast off to a random planet that changes you for the run.' },
  { id: 'giant', title: 'Go Giant!', controls: 'tap', len: '1 min', color: '#16a34a', tags: ['Arcade', 'Simulator', 'Quick Runs'],
    blurb: 'Smash the buildings in reach. Every block makes you bigger, so taller ones come into reach.' },
  { id: 'dive', title: 'Dive Exam!', controls: 'hold', len: '1–3 min', color: '#0284c7', tags: ['Exploration', 'Simulator', 'Collecting', 'Quick Runs'],
    blurb: 'Hold to dive, let go to float up for air. Swim through the rings and reach the depth to earn your next license.' }
];
