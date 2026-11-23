/* GrugOutfits · characters saved for the Grug games.

   The Avatar Studio (/character/) saves a character here with "Save for games"; every game on grugdigital.com reads the
   outfit the player picked ("Play as") and dresses its player in it. Like the Pearls wallet, it lives in this browser on
   this device (there is no server), and every page on the same address shares it.

   Storage
     IndexedDB 'grug-outfits' (v1), object store 'outfits' (keyPath 'id'). A record:
       { id, name, created, updated,
         glb:     Blob   the rigged R6 character (.glb): HumanoidRootPart > Torso > Head, Right/Left Arm, Right/Left Leg,
                         1 unit = 1 stud, facing -Z, origin at the torso centre (exactly what the studio exports)
         preview: Blob   a PNG portrait
         look:    {}     GrugStudio.get() at save time (name, skin, head, hair, hairColor, eyes, brows, mouth, …)
         shirt, pants: Blob   the raw painted clothing (so the studio can open the outfit again to edit it) }
     localStorage 'grug.outfit.active' = the id the player plays as ('' or missing = the default character, Grug).

   Starter outfits: the first time a browser uses this, the looks marked "starter" in /character/looks/looks.json (Grug,
   the default, plus a few game outfits) are saved here as ordinary outfits (ids 'starter-<id>', starter: true), and
   Grug becomes the one they play as unless they already picked one. Each look is added once (localStorage
   'grug.outfit.starters'); deleting one is fine, it doesn't come back. Bump a look's "v" in looks.json after repainting it
   and browsers swap in the new version, unless they edited their copy.

   API (all async except active/setActive)
     GrugOutfits.list()            [{ id, name, created, updated, preview }]  newest first (no glb: cheap to list)
     GrugOutfits.get(id)           the full record or null
     GrugOutfits.put(rec)          save (id is made if missing); returns the id
     GrugOutfits.rename(id, name)  GrugOutfits.remove(id)
     GrugOutfits.active()          the active id or ''          GrugOutfits.setActive(id | '')
     GrugOutfits.activeRecord()    the full active record or null
     GrugOutfits.seed()            add the starter outfits if this browser hasn't had them yet (list/activeRecord call it)
   A 'grug:outfits' event goes out on window whenever something changes (also when another tab changes it). */
(function () {
  'use strict';
  const DB = 'grug-outfits', STORE = 'outfits', AKEY = 'grug.outfit.active';
  let dbp = null;
  function open() {
    if (!window.indexedDB) return Promise.reject(new Error('This browser has no IndexedDB, so outfits can\'t be saved here.'));
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
    }));
  }
  function tx(mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), st = t.objectStore(STORE); let out;
      Promise.resolve(fn(st, v => { out = v; })).catch(rej);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const ping = () => { try { dispatchEvent(new CustomEvent('grug:outfits')); } catch (e) {} try { localStorage.setItem('grug.outfit.ping', String(Date.now())); } catch (e) {} };
  const newId = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // the starter outfits (see the top of this file). localStorage 'grug.outfit.starters' remembers which looks this browser
  // has had, and at which version ({ id: v }; looks.json gives each look a "v", 1 if missing). A look this browser never had
  // is added; a newer version replaces the saved copy only while it's still untouched (starter: true; editing it in the
  // studio saves a record without that flag). Deleted ones don't come back.
  const SKEY = 'grug.outfit.starters';
  let seeding = null, checked = false;
  function seenMap() {
    let raw = null; try { raw = localStorage.getItem(SKEY); } catch (e) { return null; }
    if (!raw) return {};
    if (raw === '1') return { grug: 1, skater: 1, ranger: 1, scavenger: 1, medic: 1, racer: 1, 'snow-rider': 1, flannel: 1 };   // the first release
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function seed() {
    if (checked || !window.fetch) return Promise.resolve();
    const seen = seenMap(); if (!seen) return Promise.resolve();
    return seeding || (seeding = (async () => {
      const r = await fetch('/character/looks/looks.json'); if (!r.ok) throw new Error('looks.json ' + r.status);
      const L = (await r.json()).filter(k => k.starter), now = Date.now();
      const todo = L.filter(k => !(k.id in seen) || seen[k.id] < (k.v || 1));
      if (todo.length) {
        const blob = u => fetch(u).then(x => x.ok ? x.blob() : null).catch(() => null);
        const recs = await Promise.all(todo.map(async k => {
          const id = 'starter-' + k.id, old = k.id in seen ? await get(id) : null;
          if (k.id in seen && !(old && old.starter)) return { skip: k };   // deleted or edited: leave it be
          const [glb, preview, shirt, pants] = await Promise.all([`/arcade/outfits/${k.id}.glb`, `/character/looks/${k.id}/preview.png`, `/character/looks/${k.id}/shirt.png`, `/character/looks/${k.id}/pants.png`].map(blob));
          if (!glb) throw new Error('starter ' + k.id);
          const t = old ? old.updated : now - L.indexOf(k) * 1000;   // new ones keep the list order (the default first); updates keep their place
          return { k, rec: { id, name: old ? old.name : k.name, created: old ? old.created : t, updated: t, glb, preview, shirt, pants, look: Object.assign({}, k.look, { name: old ? old.name : k.name }), custom: true, starter: true } };
        }));
        await tx('readwrite', st => Promise.all(recs.filter(x => x.rec).map(x => req(st.put(x.rec)))));
        recs.forEach(x => { const k = x.k || x.skip; seen[k.id] = k.v || 1; });
      }
      const def = L.find(k => k.default);
      try { if (def && !localStorage.getItem(AKEY) && !localStorage.getItem(SKEY)) localStorage.setItem(AKEY, 'starter-' + def.id); localStorage.setItem(SKEY, JSON.stringify(seen)); } catch (e) {}
      checked = true;
      if (todo.length) ping();
    })().catch(e => { console.warn('starter outfits', e); }).then(() => { seeding = null; }));
  }

  async function list() {
    await seed();
    const all = await tx('readonly', (st, set) => req(st.getAll()).then(set));
    return (all || []).map(r => ({ id: r.id, name: r.name, created: r.created, updated: r.updated, preview: r.preview || null }))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }
  const get = id => id ? tx('readonly', (st, set) => req(st.get(id)).then(v => set(v || null))) : Promise.resolve(null);
  async function put(rec) {
    const now = Date.now(), r = Object.assign({}, rec);
    r.id = r.id || newId(); r.name = String(r.name || 'My character').slice(0, 40); r.created = r.created || now; r.updated = now;
    await tx('readwrite', st => req(st.put(r))); ping(); return r.id;
  }
  async function rename(id, name) { const r = await get(id); if (!r) return false; r.name = String(name || r.name).slice(0, 40); await put(r); return true; }
  async function remove(id) { await tx('readwrite', st => req(st.delete(id))); if (active() === id) setActive(''); else ping(); return true; }
  function active() { try { return localStorage.getItem(AKEY) || ''; } catch (e) { return ''; } }
  function setActive(id) { try { if (id) localStorage.setItem(AKEY, id); else localStorage.removeItem(AKEY); } catch (e) {} ping(); }
  async function activeRecord() { await seed(); const id = active(); if (!id) return null; try { return await get(id); } catch (e) { return null; } }

  addEventListener('storage', e => { if (e.key === AKEY || e.key === 'grug.outfit.ping') try { dispatchEvent(new CustomEvent('grug:outfits')); } catch (x) {} });
  window.GrugOutfits = { list, get, put, rename, remove, active, setActive, activeRecord, seed, DB, STORE };
})();
