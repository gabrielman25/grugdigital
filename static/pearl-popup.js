/* GrugPearlPopup · the in-game "You got X Pearls" box.

   Games don't show a Pearl balance on screen. When the player gets Pearls (a reward, today's daily Pearls), show this:
   a box in the centre of the screen with "You got X Pearls", the account's total under it, and an OK button.

     await GrugPearlPopup.show(2)                  // n Pearls just added; the total is read from GrugPearls
     await GrugPearlPopup.show(5, { title: 'Daily Pearls' })
   Resolves when the player clicks OK (or presses Enter / Esc). Several calls queue up one after another.

   Buying in-game currency with Pearls (always asks first, shows the balance, handles "not enough"):
     const ok = await GrugPearlPopup.buy({ pearls: 5, label: '$1,000', what: 'Slide 999 KM: $1,000' })
     if (ok) giveCash(1000)
   Resolves true only if the Pearls were spent. Short of Pearls: the box says so and offers a "Get Pearls" link.
   Flat, classic-game look (no gradients) so it fits any Grug game; it sits above everything. */
(function () {
  'use strict';
  let q = Promise.resolve(), css = false;
  const PEARL = '<svg viewBox="0 0 16 16" width="34" height="34" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#d16be8" stroke="#000" stroke-width=".8"/><path d="M7.657 3.414c-.78-.781-2.364-.464-3.536.707-1.171 1.172-1.488 2.755-.707 3.536s2.365.465 3.536-.707c1.172-1.171 1.488-2.755.707-3.536" fill="#f6d8fb"/></svg>';
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.gpp-veil{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
.gpp{min-width:260px;max-width:90vw;padding:14px 22px 16px;text-align:center;background:rgba(25,25,25,.92);border:1px solid #8a8a8a;color:#fff;font:bold 14px Arial,Helvetica,sans-serif;
  text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000}
.gpp svg{display:block;margin:2px auto 6px}.gpp b{display:block;font-size:24px;color:#f0c4ff;margin-bottom:6px}.gpp small{display:block;font-size:13px;color:#ddd;margin-bottom:12px}
.gpp-row{display:flex;gap:8px;justify-content:center}.gpp-row a{display:inline-block;min-width:96px;padding:7px 14px;font:bold 15px Arial,Helvetica,sans-serif;color:#fff;background:#1b1b1b;border:2px solid #c8c8c8;border-radius:3px;text-decoration:none}
.gpp button{min-width:120px;padding:7px 18px;font:bold 15px Arial,Helvetica,sans-serif;color:#fff;background:#1b1b1b;border:2px solid #c8c8c8;border-radius:3px;cursor:pointer;
  text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000}.gpp button:hover{background:#4a1010;border-color:#d8281f}`;
    document.head.appendChild(s);
  }
  function box(html, buttons) {
    return new Promise(res => {
      style();
      const v = document.createElement('div'); v.className = 'gpp-veil';
      v.innerHTML = `<div class="gpp" role="dialog" aria-modal="true">${html}<div class="gpp-row">${buttons.map((b, i) => b.href ? `<a href="${b.href}" target="_blank" rel="noopener" data-i="${i}">${b.text}</a>` : `<button type="button" data-i="${i}">${b.text}</button>`).join('')}</div></div>`;
      const done = v2 => { removeEventListener('keydown', key, true); v.remove(); res(v2); };
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(buttons[buttons.length - 1].value); } };
      v.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) done(buttons[+b.dataset.i].value); });
      for (const t of ['mousedown', 'pointerdown', 'touchstart']) v.addEventListener(t, e => e.stopPropagation());
      addEventListener('keydown', key, true); document.body.appendChild(v); const last = v.querySelector('button:last-of-type'); if (last) last.focus();
    });
  }
  async function buy(o) {
    const P = window.GrugPearls, n = Math.max(1, Math.floor(+o.pearls || 0));
    if (!P) { await box(`${PEARL}<b style="font-size:18px">Pearls work on grugdigital.com</b><small>Play this game there to spend Pearls.</small>`, [{ text: 'OK', value: false }]); return false; }
    const have = P.balance();
    if (have < n) { await box(`${PEARL}<b style="font-size:18px">Not enough Pearls</b><small>${esc(o.label)} costs ${n} Pearls. You have ${have.toLocaleString()}.</small>`, [{ text: 'Get Pearls', href: '/character/pearls/', value: false }, { text: 'OK', value: false }]); return false; }
    const go = await box(`${PEARL}<b style="font-size:18px">Buy ${esc(o.label)} for ${n} Pearl${n === 1 ? '' : 's'}?</b><small>You have ${have.toLocaleString()} Pearls.</small>`, [{ text: 'Cancel', value: false }, { text: 'Buy', value: true }]);
    if (!go) return false;
    try { await P.spend(n, o.what || o.label); return true; }
    catch (e) { await box(`${PEARL}<b style="font-size:18px">Couldn't buy that</b><small>${esc(e.message)}</small>`, [{ text: 'OK', value: false }]); return false; }
  }
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function one(n, o) {
    return new Promise(res => {
      style();
      const total = window.GrugPearls ? GrugPearls.balance() : null, v = document.createElement('div');
      v.className = 'gpp-veil';
      v.innerHTML = `<div class="gpp" role="dialog" aria-modal="true">${PEARL}${o.title ? `<small style="margin:0 0 4px;color:#bbb">${o.title}</small>` : ''}<b>You got ${n} Pearl${n === 1 ? '' : 's'}!</b>` +
        (total != null ? `<small>You have ${total.toLocaleString()} Pearls</small>` : '<small></small>') + '<button type="button">OK</button></div>';
      const done = () => { removeEventListener('keydown', key, true); v.remove(); res(); };
      const key = e => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); done(); } };
      v.querySelector('button').addEventListener('click', done);
      for (const t of ['mousedown', 'pointerdown', 'touchstart']) v.addEventListener(t, e => e.stopPropagation());
      addEventListener('keydown', key, true);
      document.body.appendChild(v); v.querySelector('button').focus();
    });
  }
  window.GrugPearlPopup = { show: (n, o) => (q = q.then(() => one(n, o || {}))), buy };
})();
