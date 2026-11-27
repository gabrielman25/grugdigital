/* The Grug Arcade's shared data and page furniture, used by the games list (/arcade/) and the game pages (/arcade/place/?id=<slug>).
   GAMES: one entry per game in arcade/<slug>/ (with its cover, <slug>-grug-arcade.jpg). added / updated are the dates in the repo's history; "tag" is the
   red line under the name; "about" and "controls" fill the game's page (coop: true adds the Local Multiplayer box: static/local-mp.js is wired in). Plays and favourites are kept per browser
   (localStorage 'grug.arcade.v1'), like the rest of Grug: there's no server, so there are no global visit counts.
   CATS: the Arcade's categories (the pop-up on /arcade/ and the Categories filter), each with match(game). Games have a cat
   (default '3d'); tab: true marks a game that also plays in the browser tab (arcade/tab/tab.js), listed under TAB_BRAND.
   cat: 'n64' is a Nintendo 64 game (src/n64/): rom is its ROM file in arcade/<slug>/, which the game's page offers as a
   download and arcade/<slug>/index.html plays in an emulator (see CLAUDE.md, "Nintendo 64 games"). */
(() => {
  const $ = id => document.getElementById(id), O = window.GrugOutfits, P = window.GrugPearls;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* the same genres as the classic page */
  const GENRES = [
    ['all', 'All'], ['town-and-city', 'Town and City'], ['medieval', 'Fantasy'], ['sci-fi', 'Sci-Fi'], ['ninja', 'Ninja'], ['scary', 'Scary'],
    ['pirate', 'Pirate'], ['adventure', 'Adventure'], ['sports', 'Sports'], ['funny', 'Funny'], ['wild-west-cowboy', 'Wild West'], ['war', 'War'],
    ['skatepark', 'Skate Park'], ['gametutorials', 'Tutorial'], ['idle', 'Idle & Cozy']];

  const TAB_BRAND = 'Plays in Your Tab';   // games with tab: true keep going in the browser tab (/arcade/tab/tab.js): the favicon and title show the game
  const CATS = [
    { id: 'tab', name: TAB_BRAND, hash: 'plays-in-your-tab', match: g => !!g.tab, blurb: "3D games that keep going in your browser tab. Start one, then go do your thing: the little picture and title on the tab show how it's going." },
    { id: '3d', name: '3D Games', hash: '3d-games', match: g => (g.cat || '3d') === '3d', blurb: 'Blocky worlds you explore as your own character: dress up, build, farm, adventure and play with friends.' },
    { id: 'n64', name: 'Nintendo 64 Games', hash: 'n64-games', match: g => g.cat === 'n64', blurb: 'Real Nintendo 64 games made by Grug: play them here in your browser, or download the ROM and play on a real console.' },
    { id: 'ds', name: 'Nintendo DS Games', hash: 'ds-games', soon: true, match: g => g.cat === 'ds', blurb: 'Coming soon: DS games you can play right here in your browser.' }];
  const catOf = g => g.cat || '3d';
  const inCat = (g, id) => { const c = CATS.find(c => c.id === id); return c ? c.match(g) : true; };
  const gname = id => (GENRES.find(g => g[0] === id) || [, 'All'])[1];

  const GAMES = [
    { slug: 'sunny-patch', tab: true, solo: true, name: 'Sunny Patch', genres: ['idle', 'town-and-city'], tag: 'Cozy farm · plays in your tab', featured: true,
      added: '2026-11-25T08:00:00Z', updated: '2026-11-25T08:00:00Z', alt: 'Poppy the farmer in a sun hat beside rows of voxel crops on a fenced blocky farm, with the farm shown in a browser tab above',
      stats: ['Poppy farms while you browse', '47 seeds and a whole wardrobe'], players: '1 (and Poppy)',
      about: ['A cozy blocky farm that keeps going in your browser tab. Walk around Sunny Patch as your own character while Poppy, the farmer, plants and picks everything on her own. The little picture on your browser tab is Poppy, and the tab\'s title shows her plots and your money, so you can switch tabs and still see how the farm is doing.',
        'Give her orders: what to grow on each plot (or let her pick the best crop), and what to buy when there\'s enough money: new plots, new seeds, upgrades and clothes from her wish list. Unlock 47 vegetables, fruits, flowers and trees and grow up to 8 plots. Want to help? Click a plot, or stand on it and press E.',
        'Dress Poppy up in sun hats, flower crowns, bows, dresses, overalls, rain boots and more: her whole outfit shows on your tab, and her hat shows on her in the farm. There\'s nothing to lose and nothing to rush: leave the tab in the background, or close it, and she keeps farming for up to a day.'],
      controls: [['WASD / arrows', 'Walk'], ['Click / tap a plot', 'Help Poppy: pick, plant, or buy the plot'], ['E', 'Help at the plot or shop you\'re standing at'], ['1-5', 'The farm window: Garden, Orders, Seeds, Upgrades, Wardrobe'], ['Drag / Q E', 'Turn the camera'], ['Mouse wheel', 'Zoom'], ['Esc', 'Game Menu']] },
    { slug: 'grug-studio', name: 'Grug Studio', genres: ['gametutorials', 'town-and-city'], tag: 'Make your avatar · build at true scale', featured: true,
      added: '2026-11-25T02:00:00Z', updated: '2026-11-25T02:00:00Z', alt: 'A player beside a two-storey building on a studded baseplate, with the Avatar and Building pads',
      stats: ['Create your avatar, then walk around', 'Change a building live, at real size'], players: '1',
      about: ['A baseplate for trying things out. Walk onto the green pad (or press Create an Avatar) and the camera zooms in on you while the Avatar Studio opens: change your hair, face and outfit, press Wear it, and you are back on the baseplate wearing your new look.',
        'Walk onto the blue pad (or press Make a Building) and a building spawns on the plot. Change its size, roof, doors, floors and windows with the sliders while you walk around it. You are the real size of a Roblox character, so you see exactly how big it will be in a game.'],
      controls: [['WASD / arrows', 'Walk'], ['Space', 'Jump'], ['Drag', 'Turn the camera'], ['Mouse wheel', 'Zoom'], ['Phone', 'Left side walks, right side turns, pinch to zoom'], ['Esc', 'Game Menu']] },
    { slug: 'zone-royale', coop: true, name: 'Zone Royale', genres: ['war', 'adventure'], tag: '100 players · battle royale', featured: true,
      added: '2026-11-24T22:00:00Z', updated: '2026-11-24T23:30:00Z', alt: 'A player gliding down into a blocky city on a big island',
      stats: ['Drop, loot, outlast the storm', 'Solo or squads of four'], players: '100 (you and 99 bots)',
      about: ['A 100-player battle royale on a huge brick island. Warm up on the spawn island, board the plane, then jump and glide down anywhere: 15 named places, from the towers of Pixel Plaza to the barns of Blox Farm.',
        'Loot chests for guns from grey to gold, ammo, bandages, medkits and shield potions. There is no building: your pickaxe breaks through walls instead. The storm closes in every half minute, so keep moving. Be the last one standing for a Victory Royale.',
        'Play Solo, or Squads: you drop with three teammates who follow you, loot beside you and fight for you, against 24 other squads of four. Switch modes in the Game Menu on the spawn island.'],
      controls: [['WASD', 'Move'], ['Mouse', 'Look (click the game to lock the mouse)'], ['Left click', 'Shoot / swing'], ['Right click', 'Aim down sights'], ['Space', 'Jump · jump out of the plane · open the glider'], ['Shift', 'Sprint'], ['C / Ctrl', 'Dodge roll'], ['E', 'Open a chest, pick up'], ['F', 'Pickaxe'], ['R', 'Reload'], ['1-6 / wheel', 'Pick a slot'], ['M', 'Map'], ['Esc', 'Game Menu']] },
    { slug: 'slide-999', coop: true, name: 'Slide 999 KM for FREE ADMIN!!', genres: ['adventure', 'funny'], tag: 'Obby slide · free admin', featured: true,
      added: '2026-11-23T10:47:46-06:00', updated: '2026-11-23T11:38:37-06:00', alt: 'A cart flying down a blocky sky slide',
      stats: ['999 km of slide and obbies', 'Rebirth: 2 Pearls a day'], players: '1',
      about: ['Slide all the way down: 999 KM of sky slide. There is a checkpoint every 111 KM, so if you fall off (or touch anything red) you start again from the last one. Yellow arrows boost you, cyan pads bounce you and blue strips push you sideways.',
        'Between slides there are obbies to walk and jump across, each with a green $ ledge that needs a Speed or Gravity Coil. Reach the bottom and walk through the golden door for FREE ADMIN.'],
      controls: [['A / D or ← / →', 'Steer'], ['W / S', 'Push / brake'], ['Space', 'Jump'], ['On foot: WASD', 'Walk'], ['Shift', 'Dodge roll'], ['Right-drag', 'Turn the camera'], ['E', 'Fire the Rocket Booster'], ['1-3', 'Equip gear'], ['Esc', 'Game Menu']] },
    { slug: 'zombie-zones', coop: true, name: 'Zombie Zones', genres: ['scary', 'war'], tag: '4 teams · 4 modes',
      added: '2026-11-23T10:47:46-06:00', updated: '2026-11-23T11:38:37-06:00', alt: 'A blocky survivor with a blaster in a battle',
      stats: ['Supply runs, flags, deathmatch', 'Dodge roll and loot guns'], players: '4 teams',
      about: ['Four teams fight it out in a blocky town, round after round. Play supply runs, capture the flag or deathmatch, change mode or team from the Game Menu, loot better guns and dodge roll out of trouble.'] },
    { slug: 'grug-city', coop: true, name: 'Grug City RP', genres: ['town-and-city'], tag: '16 jobs · cops and robbers', featured: true,
      added: '2026-11-23T13:48:26-06:00', updated: '2026-11-23T14:19:58-06:00', alt: 'A police cruiser at a crossroads in a blocky city',
      stats: ['Cars and free mansions', 'Get caught wanted: jail'], players: 'A city full of roleplayers',
      about: ['A sandbox city to roleplay in. Pick one of 16 jobs, from shopkeeper to police officer, drive the cars, move into a free mansion and shop at the two-floor mall. Play cops and robbers: get caught while wanted and it is off to jail.'] },
    { slug: 'brickbound', coop: true, name: 'Brickbound', genres: ['medieval', 'adventure'], tag: 'Side-scrolling brawler · 4 zones', featured: true,
      added: '2026-11-24T12:00:00-06:00', updated: '2026-11-24T12:00:00-06:00', alt: 'A hero and a friend fight goblins and an ogre in a blocky meadow',
      stats: ['Combos, juggles and a companion', 'Rolling HP like EarthBound'], players: '1 (and a companion)',
      about: ['An action RPG brawler across four zones. Fight goblins, archers and ogres with combos and juggles, a magic bubble and a four-spell magic ring, with a companion at your side. Your HP rolls down like in EarthBound, so finish the fight before it hits zero.'] },
    { slug: 'grug-kingdom', coop: true, name: 'Grug Kingdom', genres: ['medieval', 'adventure'], tag: '5 zones · 5 bosses', featured: true,
      added: '2026-11-23T23:52:31Z', updated: '2026-11-23T23:52:31Z', alt: 'A hero with a sword faces the giant Goblin King',
      stats: ['12 swords and loot chests', 'Level up at the forge'], players: '1',
      about: ['A blocky sword RPG. Fight through five zones and five bosses, all the way to the giant Goblin King. Find 12 swords in loot chests, keep them in your backpack and level up at the forge back in town.'] },
    { slug: 'pet-zones', name: 'Pet Zones', genres: ['sci-fi', 'adventure'], tag: 'Catch pets on a grid · endless zones', featured: true,
      added: '2026-11-24T16:06:59Z', updated: '2026-11-24T17:38:06Z', alt: 'A player zapping cube pets on a grassy grid with a deck of move cards',
      stats: ['Drive a car or boat between huge zones', 'Build a 15-card deck, grab provisions'], players: '1 (and your pets)',
      about: ['Turn-based pet catching on a grid. Build a 15-card deck of moves, grab provisions, and zap wild cube pets until they join you. Drive a car or a boat between huge zones and towns full of shops, side quests, loot crates and trades.'] },
    { slug: 'grug-64', cat: 'n64', rom: 'grug-baseplate-64.z64', solo: true, outfit: false, name: 'Grug Baseplate 64', genres: ['gametutorials', 'adventure'], tag: 'A real Nintendo 64 game · play here or on a console',
      added: '2026-11-26T18:00:00Z', updated: '2026-11-26T18:00:00Z', alt: 'Grug in his lime hoodie on a grey checked baseplate in front of blue jump blocks, drawn in chunky Nintendo 64 pixels',
      stats: ['A real N64 ROM, running in your browser', 'Download it and play on a real console'], players: '1',
      about: ['The Grug Baseplate, rebuilt as a real Nintendo 64 game. It plays right here in an emulator, and the very same ROM can be downloaded and played on a real console from a flash cartridge.',
        'It is a small platformer zoo with the same jumping physics as the other Grug games: blocks from 1 to 10 studs to jump onto, gaps to clear (roll in the air to go further), an obby over a red floor, a damage pad and a kill brick, jump pads, a lift, a truss to climb, a training dummy to swing at and coins to grab.',
        'Grug speaks with the same voice as in the rest of the Arcade when he jumps, rolls, swings, gets hurt and falls apart: every clip is squeezed down to fit on a cartridge.'],
      controls: [['W A S D', 'Move (Control Stick)'], ['Space', 'Jump (A button)'], ['Shift', 'Dodge roll, in the air too (Z)'], ['F', 'Swing (B button)'], ['Q / E', 'Turn the camera (C left / right)'], ['\u2191 / \u2193', 'Tilt the camera (C up / down)'], ['I / O', 'Zoom in / out (R / L)'], ['Enter', 'Game Menu (START)']] }
  ];

  const ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000), u = [[31536e3, 'year'], [2592e3, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    for (const [n, w] of u) if (s >= n) { const k = Math.floor(s / n); return k + ' ' + w + (k > 1 ? 's' : '') + ' ago'; }
    return 'just now';
  };
  const place = slug => `/arcade/place/?id=${encodeURIComponent(slug)}`;   // the game's own page (its Play button starts it)

  function tile(g) {
    const href = place(g.slug);
    return `<div class="Cell" title="${esc(g.name)}"><div class="GameItem">
      <div class="AlwaysShown">
        <a class="thumb" href="${href}"><img src="/arcade/${g.slug}/${g.slug}-grug-arcade.jpg" alt="${esc(g.name)}, a free game in the Grug Arcade: ${esc(g.alt)}" loading="lazy" width="160" height="100"></a>
        <div class="GameName"><a href="${href}">${esc(g.name)}</a></div>
        <div class="PlayerCount">${esc(g.tag)}</div>
      </div>
      <div class="HoverShown">${g.stats.map(s => `<div>${esc(s)}</div>`).join('')}<div>Updated ${ago(g.updated)}</div></div>
    </div></div>`;
  }

  /* this browser's plays and favourites */
  const KEY = 'grug.arcade.v1';
  const rec = () => { let r = null; try { r = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} r = r && typeof r === 'object' ? r : {}; r.plays = r.plays || {}; r.fav = r.fav || {}; r.last = r.last || {}; return r; };
  const saveRec = r => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} };

  /* Warpdrive (https://warpdrive.team/): our partner, an indie console family. Their ads, in every sponsor slot, all going to
     their site: the side skyscrapers (in the rotation below), the 728x90 banner and the 300x250 box (each shows Warpdrive
     about half the time), a tile in the home page's catalog, and their 88x31 stamp. Pre-orders aren't open yet, so the ads
     never say "buy": they send people to see it. */
  const WD = 'https://warpdrive.team/';
  const wdStamp = w => `<img class="wdst" src="/static/stamps/warpdrive.gif" alt="Release your dream game on Warpdrive" width="${w}" height="${Math.round(w * 31 / 88)}">`;
  const wdA = (cls, html, label) => `<a class="${cls}" href="${WD}" target="_blank" rel="noopener sponsored" aria-label="${esc(label)}"><span class="stars"></span><span class="spn">SPONSOR</span>${html}</a>`;
  const wdWord = '<b class="wdw">WARPDRIVE</b>';
  const WDAD = {
    leader: () => wdA('lb wd', `${wdStamp(132)}<span class="t">${wdWord}<span>A console family built for indie culture</span>
      <span class="exp"><i class="k">90% to devs</i><i>Web + native engines</i><i>Buy once, play everywhere</i></span></span><span class="go">See Warpdrive ›</span>`, 'Warpdrive: a console family built for indie culture (sponsor)'),
    rect: () => wdA('rect wd', `<span class="t">${wdStamp(176)}${wdWord}<span class="s">the indie console family · web and native games are equals · devs keep 90%</span></span>
      <span class="bar"><span class="go">See the hardware ›</span></span>`, 'Warpdrive: release your dream game on it (sponsor)'),
    skyA: () => wdA('ad sp wd', `${wdWord}<div class="k">◆ 2026 ◆</div><div class="h">A console family built for indie culture.</div>
      ${wdStamp(140)}<ul><li>Web games and native games, equal on the shelf</li><li>One handheld, one home console, one library</li><li>Buy once, play everywhere</li></ul>
      <div class="cta">See Warpdrive ›</div>`, 'Warpdrive: a console family built for indie culture (sponsor)'),
    skyB: () => wdA('ad sp wd', `<div class="h" style="margin-top:30px">Your game.<br>Your cut.</div><div class="big">90%</div><div class="sub">of every sale goes to the developer</div>
      <div class="sub" style="margin-top:14px">Made a browser game? Warpdrive puts it on a real console.</div>${wdStamp(140)}${wdWord}
      <div class="cta">Visit Warpdrive ›</div>`, 'Warpdrive: your game, your cut (sponsor)'),
    tile: () => `<div class="Cell wdt" title="Warpdrive"><div class="GameItem"><div class="AlwaysShown">
        <a class="thumb wd" href="${WD}" target="_blank" rel="noopener sponsored" aria-label="Warpdrive, an indie console family (sponsor)"><span class="stars"></span>${wdStamp(120)}${wdWord}<span class="new spn">SPONSOR</span></a>
        <div class="GameName"><a href="${WD}" target="_blank" rel="noopener sponsored">Warpdrive: an indie console</a></div>
        <div class="PlayerCount"><b>90% to devs</b> <span>· warpdrive.team</span></div></div>
      <div class="HoverShown"><p>A console family built for indie culture: web and native engines are equals, and you buy once and play everywhere.</p></div></div></div>`,
  };

  /* the header, background, side ads, Pearls button, footer and "Playing as" box, the same on every Arcade page */
  function chrome() {
    const onList = !!$('PlayTabs');
    // pages outside the players' section (the home directory, the developers' and restaurants' pages) have no Games menu
    if ($('dropGenres')) $('dropGenres').innerHTML = GENRES.map(([id, t]) => `<a href="/arcade/#${id}" data-genre="${id}">${esc(t)}</a>`).join('');
    if (!onList) document.querySelectorAll('.dropdown [data-sort],.dropdown [data-search]').forEach(a => { a.removeAttribute('data-sort'); a.removeAttribute('data-search'); a.href = '/arcade/'; });
    if ($('seoGenres')) $('seoGenres').innerHTML = GENRES.slice(1).map(([id, t]) => `<a href="/arcade/#${id}" data-genre="${id}" title="${esc(t)} Games">${esc(t)}</a>`).join('&nbsp;|&nbsp;');
    /* the 88x31 stamps: top right of the banner, and in the footer */
    const STAMPS = [[WD, 'warpdrive', 'Warpdrive: release your dream game on it (our partner)', 'noopener sponsored'],
      ['https://www.youtube.com/@PolySwitchOfficial', 'youtube', 'Grug on YouTube (PolySwitch): subscribe', 'noopener'],
      ['https://discord.gg/3ENePvNGJy', 'discord', 'Join the Grug Discord', 'noopener']];
    const stamps = STAMPS.map(([h, n, t, r]) => `<a href="${h}" target="_blank" rel="${r}" title="${esc(t)}"><img src="/static/stamps/${n}.gif" alt="${esc(t)}" width="88" height="31"></a>`).join('');
    if ($('Banner') && !$('Stamps')) $('Banner').insertAdjacentHTML('beforeend', `<div id="Stamps">${stamps}</div>`);
    const lg = document.querySelector('#Footer .Legalese'); if (lg && !document.querySelector('#Footer .Stamps')) lg.insertAdjacentHTML('beforebegin', `<div class="FooterNav Stamps">${stamps}</div>`);
    /* our partner in the 728x90 banner and the 300x250 box about half the time (the page's own ad the rest) */
    const lbBox = $('Leaderboard'); if (lbBox && Math.random() < 0.5) lbBox.innerHTML = WDAD.leader();
    const rect = document.querySelector('#GamePageAdDiv .rect'); if (rect && Math.random() < 0.5) { rect.outerHTML = WDAD.rect(); const n = document.querySelector('#GamePageAdDiv .rect-note'); if (n) n.textContent = 'Our partner: an indie console family'; }
    const drop = $('dropNav'), tog = $('gamesMenuToggle');
    if (drop && tog) {
      const setDrop = on => { drop.classList.toggle('open', on); tog.setAttribute('aria-expanded', on); };
      tog.addEventListener('click', e => { e.stopPropagation(); setDrop(!drop.classList.contains('open')); });
      document.addEventListener('click', e => { if (!drop.contains(e.target) || e.target.closest('a')) setDrop(false); });
    }

    /* the background: each shot pans one way, then crossfades into the next, panning the other way */
    (() => {
      const box = $('bgfx'), SHOTS = ['aerial', 'icecream', 'salon', 'pizza'], CITY_SHOT = { aerial: 'grug-city-rp-aerial-view', icecream: 'grug-city-rp-ice-cream-shop', pizza: 'grug-city-rp-pizza-shop', salon: 'grug-city-rp-salon' }, LIFT = [0, -300, -360, -420], HOLD = 11000, PAN = 14000;   // LIFT: raise the street shots so their buildings sit behind the header, not their sky
      const els = SHOTS.map((n, i) => { const d = document.createElement('div'); d.className = 'sh'; if (i === 0) d.style.backgroundImage = `url(/static/arcade/${CITY_SHOT[n]}.jpg)`; box.appendChild(d); return d; });
      const load = i => { const d = els[i]; if (!d.style.backgroundImage) d.style.backgroundImage = `url(/static/arcade/${CITY_SHOT[SHOTS[i]]}.jpg)`; };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { els[0].classList.add('on'); return; }
      let cur = -1;
      function show(i) {
        const d = els[i], dir = i % 2 ? 1 : -1; load(i); load((i + 1) % els.length);
        if (d.animate) d.animate([{ transform: `translateY(${LIFT[i]}px) scale(1.14) translateX(${dir * -5}%)` }, { transform: `translateY(${LIFT[i]}px) scale(1.14) translateX(${dir * 5}%)` }], { duration: PAN, easing: 'linear', fill: 'forwards' });
        d.classList.add('on'); if (cur >= 0) els[cur].classList.remove('on'); cur = i;
        setTimeout(() => show((i + 1) % els.length), HOLD);
      }
      show(0);
    })();
    /* side skyscrapers: three different ads a side, crossfading; the two sides never show the same site at once */
    (() => {
      const S = window.GrugSocial; if (!S) return;
      const L = $('skyL'), R = $('skyR');
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
      const ad = (cls, href, html, label) => `<a class="ad ${cls}" href="${href}" target="_blank" rel="noopener" aria-label="${esc(label)}">${html}</a>`;
      const R6 = n => `/static/arcade/${n}.webp`;
      function build(d) {
        const D = d.discord, V = d.youtube.videos, k = S.links || S.LINKS, LK = d.links;
        const vids = shuffle(V.slice()), v0 = V[0], live = '<span class="live">COME SAY HI</span>';
        const avs = D.avatars.slice(0, 12);
        const ads = {
          discordLive: ad('dc', LK.discord, `<div class="k">Join the</div><div class="h">Grug Discord</div>
            ${D.members ? `<div class="big">${S.n(D.members)}</div><div class="sub">members: players, builders and creators</div>` : '<div class="sub" style="margin-top:14px">Players, builders and creators</div>'}
            <div class="figs"><img src="${R6('grug')}" alt="" style="left:-8px;z-index:1"><img src="${R6('medic')}" alt="" style="right:-10px;height:126px"></div>
            <div class="cta">Join server ›</div>`, 'Join the Grug Discord'),
          discordWho: ad('dk', LK.discord, `<div class="k" style="color:#b9bbbe">Discord</div><div class="h" style="font-size:21px">Who's hanging out</div>${live}
            <div class="av">${avs.length ? avs.map(a => `<img src="${esc(a.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('') : ['G', 'R', 'U', 'G', '+', '+'].map(c => `<i>${c}</i>`).join('')}</div>
            ${avs.length ? `<div class="names">${avs.slice(0, 6).map(a => `<b>${esc(a.name)}</b>${a.game ? ` · ${esc(a.game)}` : ''}`).join('<br>')}</div>` : `<div class="names">Trade outfits, show off your characters, find people to play the Arcade with.</div>`}
            <div class="cta">Hop in ›</div>`, 'Hang out on the Grug Discord'),
          ytLatest: ad('yt', v0 ? S.watch(v0.id) : LK.youtube, `<div class="k">New on YouTube</div><div class="h">PolySwitch</div>
            ${v0 ? `<div class="thumb" style="background-image:url('${S.thumbDirect(v0.id)}')"></div><div class="tt">${esc(v0.title || 'Watch the newest video')}</div>` : `<div class="figs" style="bottom:180px"><img src="${R6('racer')}" alt="" style="left:10px"></div>`}
            <div class="figs" style="height:120px"><img src="${R6('skater')}" alt="" style="left:6px;height:118px"><img src="${R6('ranger')}" alt="" style="right:4px;height:110px"></div>
            <div class="cta">Watch now ›</div>`, 'Watch PolySwitch on YouTube'),
          ytStack: ad('yk', LK.youtube, `<div class="k" style="color:#aaa">YouTube</div><div class="h">Watch PolySwitch</div>
            <div class="stack">${(vids.length ? vids.slice(0, 3) : []).map(v => `<div class="thumb" style="background-image:url('${S.thumbDirect(v.id)}')"></div>`).join('') || `<div class="sub" style="margin-top:30px">Game dev, Roblox builds and the making of Grug.</div>`}</div>
            <div class="sub" style="margin-top:10px">${vids.length ? 'Game dev, builds and more' : ''}</div>
            <div class="cta">Subscribe ›</div>`, 'Subscribe to PolySwitch on YouTube'),
          igGrid: ad('ig', LK.instagram, `<div class="k">Instagram</div><div class="h">@grugdigital</div>
            <div class="grid">${['grug-city-rp-aerial-view.jpg', 'grug.webp', 'grug-city-rp-ice-cream-shop.jpg', 'skater.webp', 'grug-city-rp-salon.jpg', 'snow-rider.webp'].map(n => `<span style="background-image:url('/static/arcade/${n}');${n.endsWith('webp') ? 'background-size:contain;background-color:#fff3' : ''}"></span>`).join('')}</div>
            <div class="sub" style="margin-top:12px">Characters, builds and behind the scenes</div>
            <div class="cta">Follow ›</div>`, 'Follow @grugdigital on Instagram'),
          igChars: ad('cr', LK.instagram, `<div class="k" style="color:#c1357a">Follow along</div><div class="h" style="color:#3a2a4a;text-shadow:none">See what we make next</div>
            <div class="sub" style="margin-top:8px"><b>@grugdigital</b> on Instagram</div>
            <div class="figs" style="height:300px;bottom:60px"><img src="${R6('snow-rider')}" alt="" style="left:-14px;bottom:130px;height:130px"><img src="${R6('racer')}" alt="" style="right:-16px;bottom:120px;height:130px"><img src="${R6('grug')}" alt="" style="left:12px;height:150px;z-index:1"></div>
            <div class="cta">Follow ›</div>`, 'Follow @grugdigital on Instagram'),
        };
        const KIMI = 'https://www.roblox.com/communities/5835899/KimiLand#!/store';   // Grug's official Roblox UGC sponsor
        const sp = (cls, html, label) => `<a class="ad sp ${cls}" href="${KIMI}" target="_blank" rel="noopener sponsored" aria-label="${esc(label)}"><span class="spn">SPONSOR</span>${html}</a>`;
        const kimiA = sp('kl', `<img src="/static/sponsor/kimiland-logo.png" alt="KimiLand" style="width:136px;margin-top:22px">
            <div class="k" style="color:#d14d8b;margin-top:8px">Official Roblox</div><div class="h" style="color:#3a3a6a;text-shadow:none;font-size:22px">UGC sponsor</div>
            <div class="sub" style="margin-top:8px">Shop the KimiLand store on Roblox</div>
            <div class="figs" style="height:150px"><img src="${R6('snow-rider')}" alt="" style="left:-6px;height:128px"><img src="${R6('skater')}" alt="" style="right:-8px;height:136px"></div>
            <div class="cta">Shop KimiLand ›</div>`, 'Shop KimiLand UGC on Roblox (sponsor)');
        const kimiB = sp('kb', `<div class="k" style="margin-top:24px">Our sponsor</div><div class="h" style="font-size:28px">KIMILAND</div>
            <img src="/static/sponsor/kimiland-kl.png" alt="" style="width:118px;margin-top:14px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.2))">
            <div class="sub" style="margin-top:10px;color:#3a3a6a">Roblox UGC for your avatar</div>
            <div class="figs" style="height:120px"><img src="${R6('grug')}" alt="" style="left:50%;translate:-50% 0;height:116px"></div>
            <div class="cta">Shop on Roblox ›</div>`, 'KimiLand on Roblox (sponsor)');
        return { L: [ads.discordLive, WDAD.skyA(), ads.igGrid, kimiA, ads.ytLatest], R: [ads.ytStack, ads.discordWho, WDAD.skyB(), ads.igChars, kimiB] };
      }
      function run(box, list, delay) {
        box.innerHTML = list.join(''); const els = [...box.children]; let i = 0; els[0].classList.add('on');
        if (els.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        setTimeout(() => setInterval(() => { if (document.hidden) return; els[i].classList.remove('on'); i = (i + 1) % els.length; els[i].classList.add('on'); }, 9000), delay);
      }
      S.get().then(d => { const b = build(d); run(L, b.L, 0); run(R, b.R, 4500); });
      // "Users online" over the games list: the Grug Discord's live count (hidden until there is one), a link to join
      const uo = $('UsersOnline'), online = d => { const n = d && d.discord && d.discord.online; if (!uo) return; uo.href = (d.links && d.links.discord) || uo.href; if (n) { uo.querySelector('b').textContent = S.n(n); uo.hidden = false; } };
      S.get().then(online); setInterval(() => S.get().then(online), 90000);
      for (const box of [L, R]) box.addEventListener('click', e => { if (!e.target.closest('a.ad') || e.target.closest('a.sp') || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return; e.preventDefault(); S.popup(); });   // a banner opens every social, side by side
    })();
    /* Pearls (the small green button where the classic page had Login) */
    function pearls() { if (!P) return; $('pearls').hidden = false; $('pearlN').textContent = P.balance().toLocaleString(); }
    if (P) { P.start().then(pearls).catch(pearls); addEventListener('grug:pearls', pearls); }
    /* Playing as: the saved outfit every game dresses you in (static/outfits.js) */
    const urls = [];
    async function me() {
      urls.splice(0).forEach(u => URL.revokeObjectURL(u));
      let L = []; try { L = O ? await O.list() : []; } catch (e) {}
      const act = O ? O.active() : '', cur = L.find(o => o.id === act);
      const src = o => { if (!o || !o.preview) return ''; const u = URL.createObjectURL(o.preview); urls.push(u); return u; };
      $('mePic').innerHTML = `<img src="${src(cur) || '/character/looks/grug/preview.png'}" alt="The character you play as, made in the Grug Avatar Studio">`;
      $('meT').textContent = cur ? cur.name : 'Grug (the default)';
      $('meP').textContent = cur ? (L.length > 1 ? `Your ${L.length - 1} other outfit${L.length > 2 ? 's show' : ' shows'} up as other players.` : 'Save more outfits and they show up as the other players.')
        : L.length ? 'Pick one of your outfits to play as it.' : 'Make a character and save it for the games to play as yourself.';
      const sel = $('meSel'); sel.hidden = !L.length;
      sel.innerHTML = (L.some(o => o.id === 'starter-grug') ? '' : `<option value=""${act ? '' : ' selected'}>Grug</option>`) +
        L.map(o => `<option value="${esc(o.id)}"${o.id === act ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
    }
    if ($('mePic')) { $('meSel').addEventListener('change', e => { if (O) O.setActive(e.target.value); }); addEventListener('grug:outfits', me); me(); }
  }

  window.GrugArcade = { GENRES, GAMES, CATS, TAB_BRAND, catOf, inCat, gname, esc, ago, tile, place, rec, saveRec, chrome, WDAD };
})();
