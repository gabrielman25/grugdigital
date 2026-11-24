/* ===== The Avatar Studio inside the Grug Studio game (/arcade/grug-studio/) =====
   /character/?embed opens the studio as the game's "Create an avatar" mode, in a frame over the baseplate. It opens the
   character you play as; "Wear it" saves it (GrugStudio.saveAndPlay, the arcade card's save) and tells the game, which dresses
   you in it and zooms back out; the arrow at the start of the top bar goes back to the game without saving.
   Messages to the game (window.parent, same origin): { grug: 'studio', type: 'ready' | 'wear' | 'close', id }.
   The game can send { grug: 'studio', type: 'open' } to reload the character you play as (each time the mode opens). */
(() => {
'use strict';
if (!/[?&]embed\b/.test(location.search)) return;
const $q = s => document.querySelector(s), S = window.GrugStudio;
document.body.classList.add('embed');
const tell = (type, extra) => { try { parent.postMessage(Object.assign({ grug: 'studio', type }, extra || {}), location.origin); } catch (e) {} };
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

const bar = $q('.topbar'), fin = $q('#toFinish');
const back = document.createElement('button'); back.id = 'toGame'; back.className = 'g-btn'; back.title = 'Back to the baseplate (without saving)'; back.setAttribute('aria-label', back.title); back.innerHTML = BACK;
bar.prepend(back);
const wear = document.createElement('button'); wear.id = 'toWear'; wear.className = 'g-btn g-btn--primary'; wear.title = 'Save this character and wear it on the baseplate'; wear.innerHTML = CHECK + 'Wear it';
if (fin) { fin.before(wear); fin.classList.remove('g-btn--primary'); } else bar.append(wear);

back.addEventListener('click', () => tell('close'));
wear.addEventListener('click', async () => {
  if (wear.disabled || !S || !S.saveAndPlay) return;
  wear.disabled = true; const label = wear.lastChild.textContent; wear.lastChild.textContent = 'Saving…';
  try { const id = await S.saveAndPlay(); tell('wear', { id }); }
  catch (e) { /* the studio already said it couldn't save */ }
  finally { wear.disabled = false; wear.lastChild.textContent = label; }
});

async function open() { try { if (S && S.openActive) await S.openActive(); } catch (e) { console.warn(e); } }
addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.grug === 'studio' && e.data.type === 'open') open(); });
Promise.resolve(S && S.whenReady).then(open).then(() => tell('ready'));
})();
