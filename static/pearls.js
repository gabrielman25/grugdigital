/* GrugPearls · the Pearls wallet on the new site.
   It is the SAME wallet the legacy pages use (localStorage 'grug.pearls.v1': {v, balance, code, buys, club, …}); the new site
   and the legacy pages share one address, so Pearls bought, won or spent anywhere show up everywhere. Fields this file adds to
   the wallet: started, promo, promosUsed, daily (the last day the daily Pearls were claimed), spends, r6 (characters already exported),
   rewards ({game: when it last paid out}, so clearing a game's own save can't skip its cooldown), earns (a log, like spends).

   GrugPearls.CFG            the numbers: starting balance, promo balances, daily Pearls (free / Grug Gold), R6 export fee
   GrugPearls.start(promo)   run once on page load: makes a new player's wallet (80 Pearls, or the promo's amount) and then
                             hands out today's daily Pearls. Promise of {welcome, promo, promoRefused, daily, gold, balance}
   GrugPearls.balance()      the current balance
   GrugPearls.spend(n, what) take n Pearls (throws an Error with .code 'short' if there aren't enough)
   GrugPearls.paid(id) / markPaid(id)   a character already exported (re-downloads are free)
   GrugPearls.reward(game, n, cooldownMs, what)   a game pays out n Pearls, at most once per cooldown for that game
                             (Promise of {balance, next}; throws an Error with .code 'cooldown' and .next if it's too soon)
   GrugPearls.rewardStatus(game, cooldownMs)      {ready, last, next} without paying anything
   GrugPearls.gold()         Promise of the Grug Gold tier (via /assets/gold.js, the site's Gumroad check) or null
   A 'grug:pearls' event goes out on window whenever the balance changes (also when another tab changes it).
   There is no server: like everywhere on Grug, the wallet lives in this browser on this device. */
(function () {
  'use strict';
  const CFG = {
    start: 80,                      // a new player's first balance
    promos: { tizzy: 600, itch: 275 }, // grugdigital.com/<promo>: bonus Pearls (600 = the $9.99 pack, 275 = the $4.99 one), for new players on top of
                                    // the starting 80, for existing wallets added to the balance. Once per wallet (w.promosUsed).
                                    // itch = the ads on the polysw.itch.io pages (grugdigital.com/itch).
    daily: 5,                       // Pearls once per calendar day for everyone
    dailyGold: 20,                  // … and for Grug Gold members (instead of 5)
    exportFee: 25                   // exporting a character as a Roblox R6 file (.glb / the whole set)
  };
  const WKEY = 'grug.pearls.v1';
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const today = (t) => { const d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const raw = () => { try { const w = JSON.parse(localStorage.getItem(WKEY) || 'null'); return w && typeof w === 'object' ? w : null; } catch (e) { return null; } };
  function wallet() {
    const w = raw() || { v: 1 };
    w.v = 1; w.balance = Math.max(0, Math.floor(+w.balance || 0)); w.buys = Array.isArray(w.buys) ? w.buys.slice(0, 50) : [];
    if (typeof w.code !== 'string' || !/^GR-[A-Z0-9]{8}$/.test(w.code)) w.code = 'GR-' + Array.from({ length: 8 }, () => A[Math.floor(Math.random() * 32)]).join('');
    return w;
  }
  function save(w) {
    try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) { return false; }
    try { dispatchEvent(new CustomEvent('grug:pearls', { detail: { balance: w.balance } })); } catch (e) {}
    return true;
  }
  const balance = () => wallet().balance;
  // one tab at a time for anything that adds or takes Pearls
  const locked = fn => (navigator.locks && navigator.locks.request) ? navigator.locks.request('grug-pearls', fn) : Promise.resolve().then(fn);

  // Grug Gold: the site's own module (legacy /assets/gold.js, served at the same address) asks Gumroad when the answer is old
  let goldJs = null;
  function loadGold() {
    if (window.GrugGold) return Promise.resolve(window.GrugGold);
    return goldJs || (goldJs = new Promise(res => { const s = document.createElement('script'); s.src = '/assets/gold.js'; s.onload = () => res(window.GrugGold || null); s.onerror = () => res(null); document.head.appendChild(s); }));
  }
  async function gold() { try { const G = await loadGold(); return G ? await G.ensure() : null; } catch (e) { return null; } }

  async function start(promo) {
    promo = String(promo || '').toLowerCase();
    return locked(async () => {
      const out = { welcome: 0, promo: null, promoRefused: false, daily: 0, gold: null };
      let w = raw();
      if (!w) {   // a new player on this device
        const n = CFG.start + (CFG.promos[promo] != null ? CFG.promos[promo] : 0);
        w = wallet(); w.balance = n; w.started = Date.now(); w.daily = today();   // the welcome Pearls count as today's
        if (CFG.promos[promo] != null) { w.promo = promo; w.promosUsed = [promo]; out.promo = promo; }
        save(w); out.welcome = n;
      } else {
        w = wallet();
        // a promo link works for existing players too, once per wallet
        if (promo && CFG.promos[promo] != null) {
          const used = Array.isArray(w.promosUsed) ? w.promosUsed : (w.promo ? [w.promo] : []);
          if (used.includes(promo)) out.promoRefused = true;
          else { const n = CFG.promos[promo]; w.balance += n; w.promosUsed = used.concat(promo); save(w); out.promo = promo; out.bonus = n; }
        }
        if (!/^GR-/.test(raw().code || '')) save(w);   // an older wallet without a purchase code gets one (the Pearls pages need it)
        if (w.daily !== today()) {
          const t = await gold(); out.gold = t;
          w = wallet();   // re-read: the Gumroad check may have updated the wallet
          if (w.daily !== today()) { const n = t ? CFG.dailyGold : CFG.daily; w.balance += n; w.daily = today(); save(w); out.daily = n; }
        }
      }
      out.balance = balance();
      return out;
    });
  }
  function spend(n, what) {
    return locked(() => {
      const w = wallet();
      if (w.balance < n) { const e = new Error('Not enough Pearls: this costs ' + n + ' and you have ' + w.balance + '.'); e.code = 'short'; e.need = n; e.have = w.balance; throw e; }
      w.balance -= n; w.spends = [{ at: Date.now(), n, what: String(what || '').slice(0, 80) }].concat(Array.isArray(w.spends) ? w.spends : []).slice(0, 50);
      save(w); return w.balance;
    });
  }
  // game rewards (the arcade: /arcade/…). The cooldown is kept in the wallet, per game.
  function rewardStatus(game, cooldown) {
    const w = raw() || {}, last = +((w.rewards && w.rewards[game]) || 0), next = last ? last + (+cooldown || 0) : 0;
    return { ready: Date.now() >= next, last, next };
  }
  function reward(game, n, cooldown, what) {
    game = String(game || '').slice(0, 40); n = Math.max(0, Math.floor(+n || 0));
    return locked(() => {
      const w = wallet(); w.rewards = (w.rewards && typeof w.rewards === 'object' && !Array.isArray(w.rewards)) ? w.rewards : {};
      const last = +w.rewards[game] || 0, next = last + (+cooldown || 0);
      if (last && Date.now() < next) { const e = new Error('That reward is on cooldown.'); e.code = 'cooldown'; e.next = next; throw e; }
      if (!w.started) w.started = Date.now();
      w.balance += n; w.rewards[game] = Date.now();
      w.earns = [{ at: Date.now(), n, what: String(what || game).slice(0, 80) }].concat(Array.isArray(w.earns) ? w.earns : []).slice(0, 50);
      save(w); return { balance: w.balance, next: Date.now() + (+cooldown || 0) };
    });
  }
  const paid = id => { const w = wallet(); return Array.isArray(w.r6) && w.r6.indexOf(id) >= 0; };
  function markPaid(id) { const w = wallet(); w.r6 = [id].concat((Array.isArray(w.r6) ? w.r6 : []).filter(x => x !== id)).slice(0, 300); save(w); }
  // the next daily Pearls: local midnight
  const nextDaily = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d; };

  addEventListener('storage', e => { if (e.key === WKEY) try { dispatchEvent(new CustomEvent('grug:pearls', { detail: { balance: balance() } })); } catch (x) {} });
  window.GrugPearls = { CFG, start, balance, spend, reward, rewardStatus, paid, markPaid, gold, loadGold, wallet, today, nextDaily, claimedToday: () => (raw() || {}).daily === today() };
})();
