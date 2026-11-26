/* ===== The agents' Avatar Studio (/agents/studio/): the console =====
   The page is /character/ with body.agent: no pickers, sliders or tabs (agent_studio.css hides them), and this console in
   their place. It adds nothing an agent can't already do with window.GrugStudio; it puts the same three steps on the page
   as plain fields and buttons, for agents that work from screenshots, and says what to do next. It redraws itself from the
   'grug:studio' events agent.js sends after every change. */
(() => {
'use strict';
if (!document.body.classList.contains('agent')) return;
const S = window.GrugStudio, C = window.__creator, $q = s => document.querySelector(s);
if (!S || !C || !$q('#agent')) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KEYS = ['name', 'skin', 'body', 'head', 'headSize', 'hair', 'hairColor', 'eyes', 'brows', 'mouth', 'browColor'];
const ta = $q('#agJson'), desc = $q('#agDesc');
const say = (el, text, kind) => { el.textContent = text; el.className = 'ag-msg' + (kind ? ' ' + kind : ''); };
let dirty = false;   // the look was edited by hand and not applied yet: don't overwrite it
let started = false; // a look has been set (by the API, a recipe link or Apply): until then, "next" is step 1
const STEPS = ['agLook', 'agOutfit', 'agExport'];
const open = id => STEPS.forEach(s => { $q('#' + s).open = s === id; });   // one step open at a time; any can be opened by hand

function look() {
  const g = S.get(), o = {};
  KEYS.forEach(k => { if (g[k] != null && !(k === 'hair' && g[k] === 'custom')) o[k] = g[k]; });
  return o;
}
function draw() {
  if (!S.ready) return;
  if (!dirty && document.activeElement !== ta) ta.value = JSON.stringify(look(), null, 2);
  const st = S.status(), g = S.get();
  if (document.activeElement !== desc && g.outfit && !desc.value) desc.value = g.outfit;
  const fresh = !started && !st.customOutfit && !st.aligning && !st.customImage;
  $q('#agNext p').textContent = fresh ? 'Start with the look: await GrugStudio.set({ name, skin, head, hair, hairColor, eyes, brows, mouth }), or edit the JSON in step 1 and click Apply. GrugStudio.options() lists every choice.' : st.next;
  $q('#agLook').classList.toggle('done', started);
  $q('#agOutfit').classList.toggle('done', !!st.customOutfit);
  say($q('#agOutfitMsg'),
    st.aligning ? `Painted picture loaded, silhouette match ${st.match == null ? 'unknown' : st.match}${st.match != null && st.match < 0.85 ? ' (low: ask Gemini to keep the exact layout)' : ''}. Click "Wear it" on the sheet over the 3D view.`
      : st.customOutfit ? 'Wearing the painted outfit.' : 'No painted picture yet.',
    st.customOutfit ? 'ok' : '');
  const p = st.pearls;
  $q('#agPearls').textContent = !p ? '' : p.paidForThisCharacter ? `This character is paid for: downloading it again is free. Balance: ${p.balance} Pearls.`
    : `Exporting costs ${p.exportFee} Pearls, once per character. Balance: ${p.balance}. Tell the person the price and ask before spending.`;
  $q('#agDownload').textContent = `Download ${st.file}`;
}
addEventListener('grug:studio', e => {
  const t = e.detail && e.detail.type;
  if (t === 'set') started = true;
  if (t === 'paint' || t === 'image' || (t === 'set' && S.status().view === 'paint')) open('agOutfit');   // a recipe link with outfit= lands on step 2
  if (t === 'wear' && S.status().customOutfit) open('agExport');
  draw();
});
addEventListener('grug:pearls', draw);

/* ---------- 1. the look ---------- */
ta.addEventListener('input', () => { dirty = true; });
$q('#agApply').addEventListener('click', async () => {
  let o; try { o = JSON.parse(ta.value); } catch (e) { return say($q('#agLookMsg'), 'Not valid JSON: ' + e.message, 'err'); }
  try { await S.set(o); dirty = false; draw(); say($q('#agLookMsg'), 'Applied.', 'ok'); } catch (e) { say($q('#agLookMsg'), e.message, 'err'); }
});
$q('#agRandom').addEventListener('click', async () => { dirty = false; await S.random(); say($q('#agLookMsg'), 'Random look applied.', 'ok'); });
$q('#agViewFace').addEventListener('click', () => C.setCat('head'));
$q('#agViewBody').addEventListener('click', () => C.setCat('shirt'));

/* ---------- 2. the outfit: Gemini paints it, the picture comes back by paste or as a file ---------- */
desc.addEventListener('input', () => { started = true; S.prompt(desc.value); });
const needDesc = () => { if (desc.value.trim()) return true; say($q('#agOutfitMsg'), 'Describe the outfit first: garments, colours, materials, shoes.', 'err'); desc.focus(); return false; };
$q('#agCopyPic').addEventListener('click', async () => { const r = await S.copyTemplate(); say($q('#agOutfitMsg'), r === true ? 'Picture copied. Paste it into Gemini.' : "Couldn't copy here: the clipboard needs a real click in a focused tab.", r === true ? 'ok' : 'err'); });
$q('#agCopyPrompt').addEventListener('click', async () => { if (!needDesc()) return; const r = await S.copyPrompt(desc.value); say($q('#agOutfitMsg'), r === true ? 'Prompt copied. Paste it into Gemini after the picture, then send.' : "Couldn't copy here: the clipboard needs a real click in a focused tab.", r === true ? 'ok' : 'err'); });
$q('#agFile').addEventListener('click', () => $q('#file').click());

/* ---------- 3. the export ---------- */
$q('#agDownload').addEventListener('click', () => {
  if (!S.status().customOutfit) return say($q('#agExportMsg'), 'Not finished: paint the outfit first (step 2). The character is still in the starter outfit.', 'err');
  say($q('#agExportMsg'), '');
  $q('#dlGLB').click();   // the studio's own button: shows the price and asks before spending Pearls
});
$q('#agScript').addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.r6Script()); say($q('#agExportMsg'), 'R6 setup script copied: run it in Roblox Studio\'s Command Bar with the model selected.', 'ok'); } catch (e) { say($q('#agExportMsg'), "Couldn't copy here. Call GrugStudio.r6Script() instead.", 'err'); } });

/* ---------- the choices and the API, as text ---------- */
S.whenReady.then(() => {
  const o = S.options(), list = a => a.map((n, i) => i + ' ' + esc(n)).join(' · ');
  $q('#agOptions').innerHTML =
    `<p><b>hair</b>${list(o.hair)}</p><p><b>hairColor / browColor (a name or any hex)</b>${Object.keys(o.hairColors).map(esc).join(' · ')}</p>` +
    `<p><b>head</b>${list(o.heads)}</p><p><b>headSize</b>${o.headSize.min} to ${o.headSize.max} (default ${o.headSize.default})</p>` +
    `<p><b>skin (a name or any hex)</b>${o.skins.map(s => esc(s.name) + ' ' + s.hex).join(' · ')}</p>` +
    `<p><b>eyes</b>${list(o.eyes)}</p><p><b>brows</b>${list(o.brows)}</p><p><b>mouth</b>${list(o.mouths)}</p><p><b>body</b>${o.bodies.map(esc).join(' · ')}</p>`;
  $q('#agHelp').textContent = S.help();
  if (S.status().view === 'head' && !/[?&]view=/i.test(location.search)) C.setCat('shirt');   // start on the whole character
  draw();
});
})();
