/* Tab title: a Braille spinner on both sides of a very short label, e.g. "⠋ Arcade ⠋", so the tab still reads when a
   browser window is full of tabs. Every page loads this (the <script> tag is written by src/seo/seo_head.py; 404.html has
   it by hand). The real <title> in each page's HTML stays long and descriptive for search engines and share cards; this
   only changes what the open tab shows.

   Add a page: put its short label in LABELS below (one word, 10 characters or fewer is best).
   A page that knows its label only after loading (the game page) sets window.GrugTabLabel = 'Name' (or calls GrugTab.setLabel). */
(function () {
  if (window.GrugTab || window.top !== window.self) return;   // once per page; not inside the studios' embed frames

  var FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  var STEP_MS = 100, MAX = 10;

  var LABELS = {
    '': 'Home',
    'arcade': 'Arcade',
    'arcade/place': 'Game',
    'arcade/baseplate': 'Baseplate',
    'arcade/brickbound': 'Brickbound',
    'arcade/grug-city': 'Grug City',
    'arcade/grug-kingdom': 'Kingdom',
    'arcade/grug-studio': 'Studio',
    'arcade/pet-zones': 'Pet Zones',
    'arcade/slide-999': 'Slide 999',
    'arcade/zombie-zones': 'Zombies',
    'arcade/zone-royale': 'Royale',
    'build': 'Build',
    'build/examples': 'Examples',
    'character': 'Avatar',
    'character/pearls': 'Pearls',
    'itch': 'Itch',
    'tizzy': 'Welcome',
    'privacy': 'Privacy',
    'privacy.html': 'Privacy',
    'terms': 'Terms',
    'terms.html': 'Terms',
    'support.html': 'Help',
    'legacy': 'Legacy'
  };

  var original = document.title;
  function short(s) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > MAX ? s.slice(0, MAX - 1).trimEnd() + '…' : s; }

  function pick() {
    var path = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '').replace(/^index\.html$/, '').toLowerCase();
    if (path === 'character' && /(^|[?&])outfits\b/.test(location.search)) return 'My Grug';
    if (path === 'arcade/place') {   // the game page: look the game up by its id, like its own folder
      var id = (new URLSearchParams(location.search).get('id') || location.hash.slice(1) || '').toLowerCase();
      if (LABELS.hasOwnProperty('arcade/' + id)) return LABELS['arcade/' + id];
      return short(window.GrugTabLabel) || 'Game';
    }
    if (LABELS.hasOwnProperty(path)) return LABELS[path];
    if (/not found/i.test(original)) return 'Lost';
    return short(original.split(/\s[·|–—-]\s/)[0]) || 'Grug';   // unknown page: the first part of its own title
  }

  var label = pick(), i = 0, timer = null;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint() {
    var f = FRAMES[i % FRAMES.length];
    document.title = f + ' ' + label + ' ' + f;
    i++;
  }

  function start() {
    paint();
    if (still) return;
    // A background tab slows setInterval to about once a second; a Worker's timer isn't slowed, so the spinner keeps turning.
    try {
      var w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},' + STEP_MS + ')'], { type: 'text/javascript' })));
      w.onmessage = paint; timer = w;
    } catch (e) { timer = setInterval(paint, STEP_MS); }
  }

  window.GrugTab = {
    setLabel: function (text) { label = short(text) || label; paint(); },
    stop: function () { if (timer) { timer.terminate ? timer.terminate() : clearInterval(timer); timer = null; } document.title = original; }
  };

  start();
})();
