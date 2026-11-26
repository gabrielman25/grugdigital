/* ===== The players' Avatar Studio: made for kids and hobbyists (/character/) =====
   The studio comes in two versions built from the same file: this one, for people making a character by hand, and the
   agents' one (/agents/studio/, body.agent), which has no pickers at all. This layer is what makes the hand-made one
   friendly: words under the tab icons, a Back / Next bar that walks the tabs in order, a short hello for first-timers and
   plain-words copy. Everything is looked up by id and skipped if a new studio version moved it. */
(() => {
'use strict';
if (document.body.classList.contains('agent')) return;
const $q = s => document.querySelector(s), S = window.GrugStudio, C = window.__creator;
if (!S || !C) return;
const embed = /[?&]embed\b/.test(location.search);
document.body.classList.add('players');
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

/* ---------- words under the tab icons ---------- */
const NAMES = { head: 'Head', hair: 'Hair', hairShape: 'Cut', hairTuft: 'Tufts', brow: 'Brows', eye: 'Eyes', mouth: 'Mouth', shirt: 'Outfit', anim: 'Moves' };
document.querySelectorAll('#cats .cat').forEach(b => { const n = NAMES[b.dataset.c]; if (n && !b.querySelector('span')) { const s = document.createElement('span'); s.textContent = n; b.appendChild(s); } });

/* ---------- plain words ---------- */
const words = (sel, text) => { const e = $q(sel); if (e) e.textContent = text; };
const label = (sel, text) => {   // a button with an icon: change its words, keep the icon
  const e = $q(sel); if (!e) return;
  const t = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).pop();
  if (t) t.textContent = text; else e.append(text);
};
label('#toFinish', 'Done');
words('#pgShirt .pg-head p', 'Pick clothes from the wardrobe, or paint an outfit of your own.');
label('#toPaint', 'Paint my own outfit');
words('#pgPaint .pg-head p', 'Three steps: copy the picture, ask an AI art tool to dress it, and bring it back.');
{ const h = $q('#pgPaint .pg-head'); if (h && !h.querySelector('.kid-help')) { const p = document.createElement('p'); p.className = 'kid-help'; p.textContent = 'This part uses Gemini, which needs its own account. Under 13? Ask a grown-up to do this step with you.'; h.appendChild(p); } }
words('#s3 .pg-head p', 'Play as your character in the Grug games, or take it to Roblox.');
{ const t = $q('#headCard .ttl'); if (t) label('#headCard .ttl', 'Take it to Roblox'); }
words('#pgAnim .pg-head p', 'See how your character moves.');

/* ---------- the last page: a pointer for people who came for the agents' version ---------- */
{ const r = $q('#restart'); if (r && !embed && !$q('.kid-dev')) { const p = document.createElement('p'); p.className = 'kid-dev'; p.innerHTML = 'Making a game with an AI agent? <a href="/agents/studio/">Use the agents\' studio</a>.'; r.after(p); } }

/* ---------- Back / Next: walks the tabs in order, then on to the games ---------- */
const ORDER = ['head', 'hair', 'brow', 'eye', 'mouth', 'shirt', 'finish'];
const STEP = { head: 'Head', hair: 'Hair', brow: 'Eyebrows', eye: 'Eyes', mouth: 'Mouth', shirt: 'Outfit', finish: 'Done' };
const here = () => { const v = S.status().view; return v === 'hairShape' || v === 'hairTuft' ? 'hair' : v === 'paint' || v === 'anim' ? 'shirt' : v; };
const panel = $q('#panel');
if (panel && !$q('.kid-steps')) {
  const bar = document.createElement('div'); bar.className = 'kid-steps';
  bar.innerHTML = `<button id="kidBack" class="g-btn" type="button" aria-label="Back one step">${BACK}</button><small id="kidCount" aria-hidden="true"></small><button id="kidNext" class="g-btn g-btn--primary" type="button"></button>`;
  panel.appendChild(bar);
  const back = $q('#kidBack'), next = $q('#kidNext'), count = $q('#kidCount');
  const draw = () => {
    const i = Math.max(0, ORDER.indexOf(here())), last = i === ORDER.length - 1;
    back.disabled = i === 0; back.style.visibility = i === 0 ? 'hidden' : '';
    count.textContent = (i + 1) + ' of ' + ORDER.length;
    next.innerHTML = last ? (embed ? 'Looks good' : 'Play in the Arcade' + ARROW) : 'Next: ' + STEP[ORDER[i + 1]] + ARROW;
    next.hidden = last && embed;
  };
  back.addEventListener('click', () => { const i = ORDER.indexOf(here()); if (i > 0) C.setCat(ORDER[i - 1]); });
  next.addEventListener('click', () => {
    const i = ORDER.indexOf(here());
    if (i < ORDER.length - 1) return C.setCat(ORDER[Math.max(0, i) + 1]);
    const a = $q('#toArcade'); if (a) a.click();   // saves the character, plays as it, opens the Arcade (outfits.js)
  });
  new MutationObserver(draw).observe(document.body, { attributes: true, attributeFilter: ['data-cat'] });
  addEventListener('grug:studio', draw);
  draw();
}

/* ---------- a short hello, until it's closed once ---------- */
const KEY = 'grug.studio.hello.v1';
let seen = false; try { seen = !!localStorage.getItem(KEY); } catch (e) {}
const first = $q('#pgCreate');
if (first && !seen && !embed) {
  const d = document.createElement('div'); d.className = 'kid-hi'; d.setAttribute('role', 'note');
  d.innerHTML = '<b>Make your own Grug character!</b>Go tab by tab with <b style="display:inline;font-size:inherit">Next</b>, or roll the dice for a surprise. When you like it, play as it in every Grug game.<button type="button" aria-label="Close this tip" title="Got it">×</button>';
  first.prepend(d);
  const done = () => { d.remove(); try { localStorage.setItem(KEY, '1'); } catch (e) {} };
  d.querySelector('button').addEventListener('click', done);
  const n = $q('#kidNext'); if (n) n.addEventListener('click', done, { once: true });
}
})();
