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
     localStorage 'grug.outfit.active' = the id the player plays as ('' or missing = the game's own default character).

   API (all async except active/setActive)
     GrugOutfits.list()            [{ id, name, created, updated, preview }]  newest first (no glb: cheap to list)
     GrugOutfits.get(id)           the full record or null
     GrugOutfits.put(rec)          save (id is made if missing); returns the id
     GrugOutfits.rename(id, name)  GrugOutfits.remove(id)
     GrugOutfits.active()          the active id or ''          GrugOutfits.setActive(id | '')
     GrugOutfits.activeRecord()    the full active record or null
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

  async function list() {
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
  async function activeRecord() { const id = active(); if (!id) return null; try { return await get(id); } catch (e) { return null; } }

  addEventListener('storage', e => { if (e.key === AKEY || e.key === 'grug.outfit.ping') try { dispatchEvent(new CustomEvent('grug:outfits')); } catch (x) {} });
  window.GrugOutfits = { list, get, put, rename, remove, active, setActive, activeRecord, DB, STORE };
})();
