/* Grug Gold · the monthly membership (sold on Gumroad), shared by every page that has a member perk.
   The member pastes their Gumroad license key on pearls.html; the answer is kept in the Pearls wallet
   (localStorage 'grug.pearls.v1' → club: {key, tier, active, checkedAt, ends, started, granted}).
   Gumroad's public license check (api.gumroad.com/v2/licenses/verify) needs no secret, so it is called from the browser.

   GrugGold.CLUB          the membership's settings (product, price, trial, perks)
   GrugGold.member()      the member's tier, or null (not a member, stopped paying, or no answer from Gumroad for 4 days)
   GrugGold.ensure()      Promise of member(), asking Gumroad again first when the last answer is over 12 hours old.
                          Use it right before handing out a perk, so a membership that just stopped can't use it.
   GrugGold.verify(key, count)  one call to Gumroad: {ok, missing, active, tier, started, uses, ends}
   GrugGold.recheck(force)      ask Gumroad about the saved key and save the answer (true if Gumroad answered)
   GrugGold.offer(what)   the "that's a Grug Gold perk" dialog, with a way to the Pearls page (needs grug.js)
   GrugGold.url           the Pearls page, where the membership is sold
   A page that cares listens for the 'grug:gold' event, sent whenever the saved answer changes. */
(function () {
  'use strict';
  const CLUB = {
    name: 'Grug Gold',
    productId: 'TUUlwtm5rYzLF6hPfY6zXQ==',          // Gumroad → the product → Content → License key module
    link: 'https://grug3d.gumroad.com/l/tsbrmm',
    trialDays: 7,                                   // the free trial set on Gumroad (0 if none)
    maxPhones: 2,                                   // one membership works on this many phones
    tiers: [
      { id: 'gold', name: 'Gold', price: '$3', monthly: 200, bonus: 10 }
    ]
  };
  const WKEY = 'grug.pearls.v1', H12 = 12 * 3600e3, D4 = 4 * 864e5;
  const me = document.currentScript || Array.from(document.scripts).find(s => /assets\/gold\.js(\?|$)/.test(s.src));
  const SITE = me && me.src ? me.src.replace(/assets\/gold\.js.*$/, '') : '/';
  const ONE = CLUB.tiers.length === 1;

  const wallet = () => { try { const w = JSON.parse(localStorage.getItem(WKEY) || 'null'); return w && typeof w === 'object' ? w : { v: 1 }; } catch (e) { return { v: 1 }; } };
  const setWallet = w => { try { localStorage.setItem(WKEY, JSON.stringify(w)); return true; } catch (e) { return false; } };
  const future = v => !v || new Date(v).getTime() > Date.now();

  function member(w) {
    const c = (w || wallet()).club;
    if (!CLUB.productId || !c || !c.key || !c.active || Date.now() - (+c.checkedAt || 0) > D4) return null;
    return CLUB.tiers.find(t => t.id === c.tier) || null;
  }
  async function verify(key, count) {
    const body = new URLSearchParams({ product_id: CLUB.productId, license_key: key, increment_uses_count: count ? 'true' : 'false' });
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!j || !j.success) return { ok: false, missing: r.status === 404 };
    const pu = j.purchase || {}, v = String(pu.variants || '').toLowerCase();
    const tier = ONE ? CLUB.tiers[0] : CLUB.tiers.find(t => v.indexOf(t.name.toLowerCase()) >= 0) || CLUB.tiers.find(t => Math.round(parseFloat(t.price.replace(/[^0-9.]/g, '')) * 100) === +pu.price) || null;
    const active = !pu.refunded && !pu.chargebacked && !pu.disputed && future(pu.subscription_ended_at) && future(pu.subscription_cancelled_at) && future(pu.subscription_failed_at);
    const started = new Date(pu.sale_timestamp || pu.created_at || 0).getTime() || Date.now();
    return { ok: true, active, tier, started, uses: +j.uses || 0, ends: pu.subscription_cancelled_at || pu.subscription_ended_at || null };
  }
  let busy = null;
  function recheck(force) {
    const c = wallet().club; if (!c || !c.key || !CLUB.productId) return Promise.resolve(false);
    if (!force && Date.now() - (+c.checkedAt || 0) < H12) return Promise.resolve(true);
    if (busy) return busy;
    busy = (async () => {
      try {
        const g = await verify(c.key, false); if (!g.ok && !g.missing) return false;   // offline: keep the last answer for now
        const w = wallet(); if (!w.club || w.club.key !== c.key) return true;
        w.club = Object.assign({}, w.club, { active: !!(g.ok && g.active && g.tier), tier: g.tier ? g.tier.id : w.club.tier, checkedAt: Date.now(), ends: g.ends || null, started: g.started || w.club.started });
        setWallet(w); try { dispatchEvent(new CustomEvent('grug:gold', { detail: { tier: member(w) } })); } catch (e) {}
        return true;
      } catch (e) { return false; } finally { busy = null; }
    })();
    return busy;
  }
  const ensure = () => recheck(false).then(() => member(), () => member());

  // "That's a Grug Gold perk": a short dialog with the way to the Pearls page
  async function offer(what) {
    const G = window.Grug, t = CLUB.tiers[0], trial = CLUB.trialDays ? 'Your first ' + (CLUB.trialDays === 7 ? 'week' : CLUB.trialDays + ' days') + ' is free, then ' + t.price + ' a month. ' : t.price + ' a month. ';
    const text = (what ? what + ' ' + (/s$/.test(what) ? 'are' : 'is') + ' a ' + CLUB.name + ' perk. ' : '') + CLUB.name + ' also gives you ' + t.monthly + ' Pearls every month and +' + t.bonus + '% on every Pearl pack. ' + trial + 'Cancel any time.';
    if (!G || !G.ui || !G.ui.dialog) { if (confirm(text + '\n\nSee ' + CLUB.name + '?')) location.href = SITE + 'pearls.html'; return; }
    const pick = await G.ui.dialog({ title: CLUB.name + ' perk', html: '<p>' + G.esc(text) + '</p>', actions: [{ label: 'Not now', kind: 'quiet', value: null }, { label: 'See ' + CLUB.name, kind: 'primary', value: 'go' }] });
    if (pick === 'go') location.href = G.pearlsUrl ? G.pearlsUrl(document.title.replace(/ ·.*$/, '')) : SITE + 'pearls.html';
  }

  window.GrugGold = { CLUB, member, ensure, verify, recheck, offer, wallet, setWallet, url: SITE + 'pearls.html' };
  // a page with a perk on it keeps the answer fresh by itself
  if (wallet().club) setTimeout(() => recheck(false), 1500);
})();
