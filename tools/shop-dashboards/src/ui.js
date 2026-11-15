/* ==========================================================================
   Shop dashboards · ui.js
   The app shell shared by every business type. Design rule: a new hire on their first day can use it
   without asking anyone. So: Today is a to-do list in plain sentences, every page explains itself the first
   time, one big main button per page, Undo instead of scary confirms, and nobody types their name twice.
   Modules (shared ones in modules.js, business ones in types/<id>.mods.js) register with App.register().
   Needs: Core (core.js), window.SHOP_TYPE (types/<id>.js), optional window.qrcode.
   ========================================================================== */
const App = (() => {
  'use strict';
  const C = Core, T = window.SHOP_TYPE;
  const PLAY_URL = (window.SHOP_CONFIG && window.SHOP_CONFIG.PLAY_URL) || '';
  const COLLS = C.BASE_COLLS.concat(T.colls || []);
  const PRE = T.storagePrefix;               /* e.g. "grug-tea:" — every key this dashboard writes starts with it */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => C.ymd(new Date());
  const nowISO = () => new Date().toISOString();
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  /* SHOP_PWA: false = single-file preview, true = its own folder with its own service worker,
     'site' = on grugdigital.com, installed and kept up to date by the site's shared app system (app/app.js, sw.js) */
  const SITE = window.SHOP_PWA === 'site';
  const siteApp = () => SITE && window.GrugApp ? window.GrugApp : null;

  /* ---------- icons (24×24 line icons, take currentColor) ---------- */
  const IC = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>', timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    pearl: '<circle cx="7.5" cy="16" r="2.6"/><circle cx="15.5" cy="16.5" r="2.6"/><circle cx="11.5" cy="9" r="2.6"/><circle cx="18" cy="9" r="2"/>',
    boba: '<path d="M5 7h14l-1.6 13.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8z"/><path d="M4 7h16M13 7l2-5"/><circle cx="9.5" cy="17" r=".9"/><circle cx="12.5" cy="18" r=".9"/><circle cx="14.6" cy="15.8" r=".9"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
    coffee: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>', cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', sparkle: '<path d="M12 3l2 5.5 5.5 2-5.5 2L12 18l-2-5.5-5.5-2 5.5-2z"/><path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 10v6"/>', book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', jar: '<path d="M7 3h10M8 3v3L6 9v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9l-2-3V3"/><path d="M6 13h12"/>',
    cup: '<path d="M6 8h12l-1.5 12.2a1 1 0 0 1-1 .8h-7a1 1 0 0 1-1-.8z"/><path d="M5 5h14v3H5zM9 5V3h6v2"/>',
    bean: '<ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(35 12 12)"/><path d="M8 18c1.5-3 6.5-6 8-12"/>', milk: '<path d="M7 8l2-5h6l2 5v13H7z"/><path d="M7 8h10M12 3v5"/>',
    wrench: '<path d="M15 4a5 5 0 0 0-5.6 6.6L3 17l4 4 6.4-6.4A5 5 0 0 0 20 9l-3 3-3-1-1-3z"/>', croissant: '<path d="M3 15c2-6 6-9 9-9s7 3 9 9c-2 1-4 0-5-2-1 3-3 4-4 4s-3-1-4-4c-1 2-3 3-5 2z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M5 15l7-7 7 7"/>', down: '<path d="M5 9l7 7 7-7"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', vol: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', game: '<path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 11h.01"/>',
    pin: '<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    party: '<path d="M4 20l4-12 8 8z"/><path d="M14 4v2M19 9h2M17 6l1.5-1.5M12 8c1-1 2-1 3 0"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'
  };
  const ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

  /* ---------- storage: one localStorage key per collection, all under this dashboard's prefix ---------- */
  const Store = {
    mode: 'local', mem: {},
    init() { try { localStorage.setItem(PRE + '_t', '1'); localStorage.removeItem(PRE + '_t'); } catch (e) { this.mode = 'memory'; } },
    get(k) { if (this.mode !== 'local') return this.mem[k]; const v = localStorage.getItem(PRE + k); if (v == null) return undefined; try { return JSON.parse(v); } catch (e) { return undefined; } },
    set(k, v) { if (this.mode !== 'local') { this.mem[k] = v; return true; } try { localStorage.setItem(PRE + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    keys() { if (this.mode !== 'local') return Object.keys(this.mem); const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PRE)) out.push(k.slice(PRE.length)); } return out; },
    clear() { for (const k of this.keys()) { if (this.mode === 'local') localStorage.removeItem(PRE + k); else delete this.mem[k]; } },
    bytes() { let n = 0; if (this.mode === 'local') for (const k of this.keys()) n += (localStorage.getItem(PRE + k) || '').length + PRE.length + k.length; return n * 2; }
  };

  let D = null, meta = {}, saveFailed = false;
  const blankSettings = () => ({ shopName: '', tempUnit: 'F', weekStart: 1, backupEveryDays: 7, sound: true, showPlay: true, warnMin: 15, bigText: false, off: [], openAt: T.hours[0], closeAt: T.hours[1], peaks: C.clone(T.peaks || []), ...C.clone(T.settings || {}) });
  function loadAll() {
    D = { schemaVersion: Store.get('schemaVersion') || C.SCHEMA, settings: { ...blankSettings(), ...(Store.get('settings') || {}) } };
    for (const c of COLLS) D[c] = Store.get(c) || [];
    meta = Store.get('meta') || {};
    if (!meta.deviceId) { meta.deviceId = C.uid(); Store.set('meta', meta); }
  }
  function save(...colls) {
    let ok = true;
    if (!colls.length) colls = ['settings', ...COLLS];
    for (const c of colls) ok = Store.set(c, c === 'settings' ? D.settings : D[c]) && ok;
    ok = Store.set('schemaVersion', C.SCHEMA) && ok;
    if (!ok && !saveFailed) toast("This device couldn't save that. Go to Settings and tap Save a backup now.", 8000);
    saveFailed = !ok; return ok;
  }
  const saveMeta = () => Store.set('meta', meta);
  function upsert(coll, rec) {
    rec.updatedAt = nowISO(); if (!rec.id) rec.id = C.uid();
    const i = D[coll].findIndex(r => r.id === rec.id); if (i < 0) D[coll].push(rec); else D[coll][i] = rec;
    save(coll); return rec;
  }
  function remove(coll, id) { D[coll] = D[coll].filter(r => r.id !== id); save(coll); }
  /* delete with an Undo button instead of an "are you sure?" box */
  function removeUndo(coll, id, label) {
    const i = D[coll].findIndex(r => r.id === id); if (i < 0) return; const rec = D[coll][i];
    remove(coll, id); render();
    toast((label || 'Deleted') + '.', 7000, { label: 'Undo', fn: () => { D[coll].splice(Math.min(i, D[coll].length), 0, rec); save(coll); render(); toast('Back again.'); } });
  }
  function setSettings(patch) { Object.assign(D.settings, patch, { updatedAt: nowISO() }); save('settings'); applyLook(); }
  const find = (coll, id) => D[coll].find(r => r.id === id);
  const staff = (all) => D.employees.filter(e => all || !e.archived).sort((a, b) => a.name.localeCompare(b.name));
  const empName = id => (find('employees', id) || {}).name || '';
  /* "who's using this device" — remembered for today only (shared counter tablets change hands) */
  const by = () => meta.meDay === today() ? (meta.me || '') : '';
  const rememberBy = n => { n = (n || '').trim(); if (n && (n !== meta.me || meta.meDay !== today())) { meta.me = n; meta.meDay = today(); saveMeta(); refreshChrome(); } };

  /* ---------- modules & routing ----------
     A module: { id, title, short, icon, help:{what, steps:[…], tip}, status() → {text, level},
                 todo() → [{key, pri, level, icon, text, sub, btn, go, p, act, data, done}], render(param), after(el),
                 acts, hero(), timers(), csv, core (can't be switched off), visible() } */
  const MODS = {}, ACTS = {}, TIMERS = [], CSVS = [];
  function register(m) { if (!m.id.startsWith('_')) MODS[m.id] = m; if (m.acts) Object.assign(ACTS, m.acts); if (m.timers) TIMERS.push(m.timers); if (m.csv) CSVS.push(...m.csv.map(x => [...x, m.id])); }
  const act = (name, fn) => { ACTS[name] = fn; };
  const isOn = id => !!MODS[id] && (MODS[id].core || !(D.settings.off || []).includes(id)) && (!MODS[id].visible || MODS[id].visible());
  let route = 'home', param = '';
  const ui = {}; /* view state that isn't saved (filters, selected week…) */
  function go(id, p) { location.hash = '#/' + id + (p ? '/' + encodeURIComponent(p) : ''); }
  function readHash() {
    const m = location.hash.match(/^#\/([\w-]+)(?:\/(.*))?/);
    route = m && MODS[m[1]] && isOn(m[1]) ? m[1] : 'home'; param = m && m[2] ? decodeURIComponent(m[2]) : '';
  }

  /* ---------- toast ---------- */
  function toast(msg, ms, action) {
    const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${action.label === 'Undo' ? ic('undo') : ''}${esc(action.label)}</button>` : ''}`;
    if (action) t.querySelector('button').onclick = () => { t.classList.remove('on'); action.fn(); };
    t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms || 3000);
  }

  /* ---------- dialogs ---------- */
  let modalStack = [];
  function modal(html, opts) {
    opts = opts || {};
    const s = document.createElement('div'); s.className = 'scrim';
    s.innerHTML = `<div class="dlg ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    s.addEventListener('pointerdown', e => { if (e.target === s && !opts.sticky) closeModal(); });
    document.body.appendChild(s); modalStack.push({ el: s, onClose: opts.onClose });
    setTimeout(() => { const f = s.querySelector('[autofocus]') || (matchMedia('(min-width:700px)').matches && s.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea')); if (f) f.focus(); }, 40);
    return s.firstChild;
  }
  function closeModal() { const m = modalStack.pop(); if (!m) return; m.el.remove(); if (m.onClose) m.onClose(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalStack.length) closeModal(); });
  const xBtn = `<button class="ib" data-x aria-label="Close">${ic('x')}</button>`;
  function confirmBox({ title, body, ok, danger, typed }) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      const d = modal(`<h2>${esc(title)}</h2><p>${body || ''}</p>${typed ? `<label class="f"><span>To be sure, type <b>${esc(typed)}</b></span><input type="text" data-typed autocomplete="off"></label>` : ''}
        <div class="acts"><button class="btn" data-x>No, go back</button><span class="sp"></span><button class="btn ${danger ? 'danger' : 'pri'}" data-ok ${typed ? 'disabled' : ''}>${esc(ok || 'Yes')}</button></div>`, { onClose: () => fin(false) });
      if (typed) d.querySelector('[data-typed]').oninput = e => { d.querySelector('[data-ok]').disabled = e.target.value.trim().toUpperCase() !== typed.toUpperCase(); };
      d.querySelector('[data-x]').onclick = () => closeModal();
      d.querySelector('[data-ok]').onclick = () => { fin(true); closeModal(); };
    });
  }

  /* ---------- form builder ----------
     field: {k, label, type: text|number|date|time|datetime|select|textarea|chips|days|check|color|hidden|stepper,
             opts, req, ph, hint, step, min, max, full, list (suggestions), unit} */
  const toLocalDT = iso => { if (!iso) return ''; const d = new Date(iso); return C.ymd(d) + 'T' + C.pad(d.getHours()) + ':' + C.pad(d.getMinutes()); };
  const fromLocalDT = v => v ? new Date(v).toISOString() : '';
  const optsOf = f => (typeof f.opts === 'function' ? f.opts() : f.opts || []).map(o => Array.isArray(o) ? o : [o, o]);
  const COLORS = ['#FF8FC2', '#C59BFF', '#8AA8FF', '#4FD8C4', '#7EE081', '#9BE338', '#FFBE1A', '#FF9F5A', '#FF7A6B', '#B9A48F'];
  function fieldHtml(f, v) {
    const id = 'f-' + f.k, lab = `<span>${esc(f.label || '')}${f.hint ? ` <em>${esc(f.hint)}</em>` : ''}</span>`;
    const cls = 'f' + (f.full || ['textarea', 'chips', 'days', 'color', 'check'].includes(f.type) ? ' full' : '');
    const val = v == null ? '' : v;
    const common = `name="${f.k}" id="${id}" ${f.req ? 'required' : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}`;
    switch (f.type) {
      case 'hidden': return `<input type="hidden" name="${f.k}" value="${esc(val)}">`;
      case 'textarea': return `<label class="${cls}">${lab}<textarea ${common}>${esc(val)}</textarea></label>`;
      case 'select': return `<label class="${cls}">${lab}<select ${common}>${f.blank !== false ? `<option value="">${esc(f.blank || 'Choose…')}</option>` : ''}${optsOf(f).map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(val) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
      case 'chips': return `<div class="${cls}">${lab}<input type="hidden" name="${f.k}" value="${esc(val)}"><div class="chips big" data-chips="${f.k}">${optsOf(f).map(([a, b]) => `<button type="button" data-v="${esc(a)}" class="${String(a) === String(val) ? 'on' : ''}">${esc(b)}</button>`).join('')}</div></div>`;
      case 'days': { const on = new Set(val || []); return `<div class="${cls}">${lab}<div class="chips big" data-days="${f.k}">${C.DN.map((d, i) => `<button type="button" data-v="${i}" class="${on.has(i) ? 'on' : ''}">${d}</button>`).join('')}</div></div>`; }
      case 'color': return `<div class="${cls}">${lab}<input type="hidden" name="${f.k}" value="${esc(val || COLORS[0])}"><div class="chips" data-chips="${f.k}">${COLORS.map(c => `<button type="button" data-v="${c}" class="${c === (val || COLORS[0]) ? 'on' : ''}" style="background:${c};width:2.6rem;padding:0" aria-label="colour ${c}">${c === (val || COLORS[0]) ? ic('check') : ''}</button>`).join('')}</div></div>`;
      case 'check': return `<label class="ckrow ${cls}"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''}> ${esc(f.label)}</label>`;
      case 'datetime': return `<label class="${cls}">${lab}<input type="datetime-local" ${common} value="${esc(toLocalDT(val))}"></label>`;
      case 'stepper': return `<div class="${cls}">${lab}<div class="step big"><button type="button" data-stp="${f.k}" data-d="-${f.step || 1}" aria-label="Less">−</button><input type="number" inputmode="decimal" step="any" ${f.min != null ? `min="${f.min}"` : ''} ${common} value="${esc(val)}"><button type="button" data-stp="${f.k}" data-d="${f.step || 1}" aria-label="More">+</button>${f.unit ? `<b class="unit">${esc(f.unit)}</b>` : ''}</div></div>`;
      case 'number': return `<label class="${cls}">${lab}<input type="number" inputmode="decimal" step="${f.step || 'any'}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${common} value="${esc(val)}"></label>`;
      default: return `<label class="${cls}">${lab}<input type="${f.type || 'text'}" ${common} value="${esc(val)}" ${f.list ? `list="${id}-l"` : ''} autocomplete="off">${f.list ? `<datalist id="${id}-l">${(typeof f.list === 'function' ? f.list() : f.list).map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}</label>`;
    }
  }
  function formHtml(fields, vals) { return `<div class="fgrid">${fields.map(f => fieldHtml(f, vals[f.k])).join('')}</div>`; }
  function wireForm(root) {
    $$('[data-chips]', root).forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const inp = root.querySelector(`input[name="${g.dataset.chips}"]`);
      const isColor = !!b.style.background;
      $$('button', g).forEach(x => { x.classList.toggle('on', x === b); if (isColor) x.innerHTML = x === b ? ic('check') : ''; });
      inp.value = b.dataset.v; inp.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    $$('[data-days]', root).forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); }));
    $$('[data-stp]', root).forEach(b => b.addEventListener('click', () => { const inp = root.querySelector(`input[name="${b.dataset.stp}"]`); const v = Math.max(+inp.min || 0, C.r2((+inp.value || 0) + +b.dataset.d)); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }));
  }
  function readForm(root, fields) {
    const out = {};
    for (const f of fields) {
      if (f.type === 'days') { out[f.k] = $$(`[data-days="${f.k}"] button.on`, root).map(b => +b.dataset.v); continue; }
      const el = root.querySelector(`[name="${f.k}"]`); if (!el) continue;
      if (f.type === 'check') out[f.k] = el.checked;
      else if (f.type === 'number' || f.type === 'stepper') out[f.k] = el.value === '' ? '' : +el.value;
      else if (f.type === 'datetime') out[f.k] = fromLocalDT(el.value);
      else out[f.k] = el.value.trim();
    }
    return out;
  }
  /* sanity checks shared by every form: required, number limits, no future log times */
  function checkFields(fields, v) {
    for (const f of fields) {
      const x = v[f.k];
      if (f.req && (x === '' || x == null || (Array.isArray(x) && !x.length))) return (f.label || f.k) + ': this one is needed.';
      if ((f.type === 'number' || f.type === 'stepper') && x !== '' && x != null) {
        if (isNaN(x)) return (f.label || f.k) + ': type a number.';
        if (f.min != null && x < f.min) return (f.label || f.k) + ' can\'t be less than ' + f.min + '.';
        if (f.max != null && x > f.max) return (f.label || f.k) + ' looks too big. Check the number.';
      }
      if (f.type === 'datetime' && f.past && x && Date.parse(x) > Date.now() + 5 * 6e4) return (f.label || f.k) + ' is in the future. Check the time.';
    }
    return '';
  }
  /* openForm: a dialog with fields; onSave(values) may return a message to keep it open.
     del: {coll, id, label} gives a Delete button with Undo. */
  function openForm({ title, intro, fields, values, onSave, onDelete, del, saveLabel, cls, extra, onInput }) {
    const vals = values || {};
    const d = modal(`<h2>${esc(title)}<span class="sp"></span>${xBtn}</h2>${intro ? `<p>${intro}</p>` : ''}<form novalidate>${formHtml(fields, vals)}${extra || ''}<p class="ferr" data-err role="alert"></p>
      <div class="acts">${onDelete || del ? `<button type="button" class="btn danger sm" data-del>${ic('trash')} Delete</button>` : ''}<span class="sp"></span><button type="submit" class="btn pri lg">${ic('check')} ${esc(saveLabel || 'Save')}</button></div></form>`, { cls });
    const form = d.querySelector('form'); wireForm(form);
    if (onInput) { form.addEventListener('input', () => onInput(readForm(form, fields), form)); onInput(readForm(form, fields), form); }
    d.querySelector('[data-x]').onclick = () => closeModal();
    if (del) d.querySelector('[data-del]').onclick = () => { closeModal(); removeUndo(del.coll, del.id, del.label); };
    else if (onDelete) d.querySelector('[data-del]').onclick = async () => { if (await confirmBox({ title: 'Delete this?', body: 'It will be gone for good.', ok: 'Delete', danger: true })) { closeModal(); onDelete(); render(); } };
    form.onsubmit = e => {
      e.preventDefault(); const v = readForm(form, fields);
      const err = checkFields(fields, v) || onSave(v, form);
      if (err) { const el = d.querySelector('[data-err]'); el.textContent = err; el.scrollIntoView({ block: 'nearest' }); return; }
      closeModal(); render();
    };
    return d;
  }

  /* ---------- wizard: one question per screen, big input, Back / Next ----------
     steps: [{k, q, hint, type: money|number|text|chips|time|date, opts, def, optional, min, max, unit, skipIf(vals)}]
     onDone(vals) may return HTML for a final "here's the result" screen. */
  function wizard({ title, steps, onDone, doneLabel, values }) {
    const vals = { ...(values || {}) }; let i = 0;
    for (const s of steps) if (vals[s.k] === undefined && s.def !== undefined) vals[s.k] = typeof s.def === 'function' ? s.def(vals) : s.def;
    const d = modal('', { cls: 'wiz', sticky: true });
    const live = () => steps.filter(s => !s.skipIf || !s.skipIf(vals));
    const draw = () => {
      const L = live(), s = L[i], n = L.length;
      const inp = s.type === 'chips' ? `<input type="hidden" name="v" value="${esc(vals[s.k] ?? '')}"><div class="chips big" data-chips="v">${optsOf(s).map(([a, b]) => `<button type="button" data-v="${esc(a)}" class="${String(a) === String(vals[s.k]) ? 'on' : ''}">${esc(b)}</button>`).join('')}</div>`
        : `<div class="wizin">${s.type === 'money' ? '<b>$</b>' : ''}<input name="v" type="${s.type === 'text' ? 'text' : s.type === 'time' ? 'time' : s.type === 'date' ? 'date' : 'number'}" ${s.type === 'money' || s.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(vals[s.k] ?? '')}" placeholder="${esc(s.ph || (s.type === 'money' ? '0.00' : ''))}" autofocus>${s.unit ? `<b>${esc(s.unit)}</b>` : ''}</div>`;
      d.innerHTML = `<div class="wizh"><span>${esc(title)}</span><span class="sp"></span><span class="mute small">Step ${i + 1} of ${n}</span>${xBtn}</div>
        <div class="dots">${L.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
        <form novalidate><h2 class="q">${esc(s.q)}</h2>${s.hint ? `<p class="hint">${s.hint}</p>` : ''}${inp}<p class="ferr" data-err role="alert"></p>
        <div class="acts">${i ? `<button type="button" class="btn lg" data-back>${ic('left')} Back</button>` : ''}<span class="sp"></span>${s.optional ? `<button type="button" class="btn ghost" data-skip>Skip</button>` : ''}<button class="btn pri lg">${i === n - 1 ? ic('check') + ' ' + esc(doneLabel || 'Finish') : 'Next ' + ic('right')}</button></div></form>`;
      const f = d.querySelector('form'); wireForm(f);
      if (s.type === 'chips') f.querySelector('[data-chips]').addEventListener('click', () => setTimeout(() => f.requestSubmit(), 180));
      d.querySelector('[data-x]').onclick = () => closeModal();
      const b = d.querySelector('[data-back]'); if (b) b.onclick = () => { i--; draw(); };
      const sk = d.querySelector('[data-skip]'); if (sk) sk.onclick = () => { vals[s.k] = ''; next(); };
      f.onsubmit = e => {
        e.preventDefault(); let v = f.v.value.trim();
        if (s.type === 'money' || s.type === 'number') { if (v === '') { if (!s.optional) return err('Type a number (0 is fine).'); } else { v = +v; if (isNaN(v) || v < 0) return err('That doesn\'t look like a number.'); if (s.max != null && v > s.max) return err('That looks too big. Check it again.'); if (s.positive && v <= 0) return err('It has to be more than 0.'); } }
        else if (!v && !s.optional) return err(s.type === 'chips' ? 'Tap one.' : 'This one is needed.');
        vals[s.k] = v; next();
      };
      setTimeout(() => { const x = d.querySelector('input[name=v]:not([type=hidden])'); if (x) x.focus(); }, 30);
    };
    const err = m => { d.querySelector('[data-err]').textContent = m; };
    const next = () => {
      const L = live(); if (i < L.length - 1) { i++; draw(); return; }
      const res = onDone(vals);
      if (res) { d.innerHTML = `<div class="wizh"><span>${esc(title)}</span><span class="sp"></span>${xBtn}</div>${res}<div class="acts"><span class="sp"></span><button class="btn pri lg" data-x2>${ic('check')} Done</button></div>`; d.querySelector('[data-x]').onclick = d.querySelector('[data-x2]').onclick = () => { closeModal(); render(); }; }
      else { closeModal(); render(); }
    };
    draw();
  }

  /* ---------- who's using this device ---------- */
  function whoPicker(then) {
    const ss = staff();
    const d = modal(`<h2>Who's using this?<span class="sp"></span>${xBtn}</h2><p>Tap your name. Anything you check off or write down today will say it was you.</p>
      <div class="whogrid">${ss.map(e => { const f = e.name.split(' ')[0], dup = ss.filter(x => x.name.split(' ')[0] === f).length > 1; return `<button class="whopick" data-n="${esc(e.name)}">${avatar(e, 'lg')}<b>${esc(dup ? e.name : f)}</b></button>`; }).join('')}</div>
      <form data-other style="display:flex;gap:.5rem;margin-top:.8rem"><input type="text" name="n" placeholder="${ss.length ? 'Not on the list? Type your name' : 'Type your name'}"><button class="btn pri">OK</button></form>`);
    const pick = n => { rememberBy(n); closeModal(); toast('Hi ' + n.split(' ')[0] + '!'); render(); if (then) then(n); };
    d.querySelector('[data-x]').onclick = () => closeModal();
    $$('[data-n]', d).forEach(b => b.onclick = () => pick(b.dataset.n));
    d.querySelector('[data-other]').onsubmit = e => { e.preventDefault(); const n = e.target.n.value.trim(); if (n) pick(n); };
  }
  act('who', () => whoPicker());

  /* ---------- sound: a short chime made with Web Audio (no files) ---------- */
  const Sound = {
    ctx: null, unlocked: false,
    unlock() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); this.unlocked = this.ctx.state === 'running'; } catch (e) { } },
    play(kind) {
      if (!D || !D.settings.sound) return; this.unlock(); const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
      const notes = kind === 'alarm' ? [880, 660, 880, 660, 880] : [660, 880];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + i * 0.22;
        o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(kind === 'alarm' ? 0.5 : 0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.22);
      });
      if (kind === 'alarm' && navigator.vibrate) navigator.vibrate([300, 120, 300]);
    }
  };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (!Sound.unlocked) { Sound.unlock(); if (Sound.unlocked && D) refreshChrome(); } }, { passive: true }));

  /* ---------- timers: a once-a-second redraw that reads stored timestamps ----------
     Modules give App.register({timers: () => [{coll, b, label, icon}]}). Nothing is counted down in memory:
     every tick recomputes from startedAt/cookMin/holdMin, so reloads, closed tabs and sleeping tablets stay right. */
  let lastAlarm = 0;
  function activeTimers() { const out = []; for (const f of TIMERS) out.push(...f()); return out; }
  function ringSvg(pct) { const r = 40, c = 2 * Math.PI * r; return `<svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="${r}"/><circle class="fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, pct)))).toFixed(1)}"/></svg>`; }
  function timerText(st) {
    if (st.phase === 'cooking') return { cd: C.fmtDur(st.left), sub: 'Still cooking. Ready at ' + C.fmtClock(st.cookEnd) + '.' };
    if (st.phase === 'expired') return { cd: 'THROW OUT', sub: 'It was good until ' + C.fmtClock(st.discardAt) + ' (' + C.fmtDur(st.over, true) + ' ago).' };
    return { cd: C.fmtDur(st.left), sub: 'Good until ' + C.fmtClock(st.discardAt) + '. Then throw it out.' };
  }
  function tick() {
    if (!D || !D.settings.shopName) return;
    const now = Date.now(), warn = +D.settings.warnMin || 0;
    let expired = [], rerender = false;
    for (const t of activeTimers()) {
      const st = C.batchState(t.b, now, warn);
      if (st.phase === 'expired' && !t.b.silenced) expired.push(t);
      if (st.phase === 'soon' && !t.b.warned) { t.b.warned = nowISO(); upsert(t.coll, t.b); Sound.play('soft'); toast(t.label + ': only ' + C.fmtDur(st.left, true) + ' left. Then throw it out.', 6000); }
      for (const el of $$(`[data-tmr="${t.coll}:${t.b.id}"]`)) {
        if (el.dataset.phase !== st.phase) { rerender = true; continue; }
        const tx = timerText(st); const cd = el.querySelector('.cd'), sub = el.querySelector('.by');
        if (cd) cd.textContent = tx.cd; if (sub) sub.textContent = tx.sub;
        const nw = el.querySelector('[data-now]'); if (nw) nw.style.left = (Math.max(0, Math.min(1, (now - st.start) / Math.max(1, st.discardAt - st.start))) * 100).toFixed(2) + '%';
        const fg = el.querySelector('.fg'); if (fg) { const c = 2 * Math.PI * 40; fg.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, st.phase === 'cooking' ? st.pct : 1 - st.pct)))).toFixed(1)); }
      }
    }
    if (expired.length && now - lastAlarm > 12000) { lastAlarm = now; Sound.play('alarm'); }
    document.title = expired.length ? '⚠ THROW OUT: ' + expired.map(t => t.label).join(', ') : (D.settings.shopName || T.name) + ' · ' + T.name;
    const ck = $('#clock'); if (ck) ck.textContent = C.fmtClock(now);
    const al = $('#alarmchip'); if (al) { al.hidden = !expired.length; al.innerHTML = expired.length ? `${ic('alert')} Throw out ${expired.length === 1 ? expired[0].label.split('·')[0].trim() : expired.length + ' batches'}` : ''; }
    const sc = $('#soundchip'); if (sc) sc.hidden = !(D.settings.sound && !Sound.unlocked && activeTimers().length);
    if (rerender && !modalStack.length) render();
    if (ui.day !== today()) { ui.day = today(); if (!modalStack.length) render(); }  /* midnight: lists and "today" roll over */
    if (route === 'home' && ui.homeMin !== nowMin() && nowMin() % 5 === 0 && !modalStack.length) { ui.homeMin = nowMin(); render(); } /* to-dos follow the clock */
  }
  function timerCard(t, opts) {
    const st = C.batchState(t.b, Date.now(), +D.settings.warnMin || 0), tx = timerText(st);
    const pct = st.phase === 'cooking' ? st.pct : 1 - st.pct;
    return `<div class="tmr ${st.phase}" data-tmr="${t.coll}:${t.b.id}" data-phase="${st.phase}">
      <div class="ring">${ringSvg(pct)}<div class="mid">${ic(st.phase === 'cooking' ? 'flame' : (t.icon || 'timer'))}</div></div>
      <div class="info"><div class="name">${esc(t.label)}</div><div class="cd">${esc(tx.cd)}</div><div class="by">${esc(tx.sub)}</div>
      <div class="acts">${(opts && opts.actions ? opts.actions(st) : '')}</div></div></div>`;
  }

  /* ---------- CSV / download ---------- */
  function download(name, text, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const slug = () => (D.settings.shopName || T.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || T.id;
  const csvDownload = (name, rows) => { download(slug() + '-' + name + '-' + today() + '.csv', C.csv(rows), 'text/csv'); toast('Spreadsheet saved to your downloads. It opens in Excel or Google Sheets.', 4500); };
  const inRange = (iso, days) => days === 'all' || !iso || Date.parse(iso) >= Date.now() - days * 864e5 || C.ymd(new Date(iso)) === today();

  /* ---------- backup ---------- */
  function backupDue() {
    const set = D.settings.backupEveryDays; if (set === 0 || set === '0') return false; const every = +set || 7;
    const has = COLLS.some(c => D[c].some(r => !r.demo)); if (!has) return false;
    if (!meta.lastBackupAt) return Date.now() - Date.parse(D.settings.createdAt || 0) > Math.min(every, 1) * 864e5;
    return Date.now() - Date.parse(meta.lastBackupAt) > every * 864e5;
  }
  function exportBackup() {
    const b = C.makeBackup(D, T, COLLS, meta);
    download(slug() + '-backup-' + today() + '.json', JSON.stringify(b, null, 1), 'application/json');
    meta.lastBackupAt = nowISO(); saveMeta();
    modal(`<h2>${ic('check')} Backup saved<span class="sp"></span>${xBtn}</h2><p>A file called <b>${esc(slug())}-backup-${today()}.json</b> is in your downloads.</p>
      <ol class="steps"><li>Email it to yourself, or put it in Google Drive / iCloud / Dropbox.</li><li>That's it. If this tablet ever breaks, open the dashboard on a new one and tap <b>Restore from a backup file</b>.</li></ol>
      <div class="acts"><span class="sp"></span><button class="btn pri lg" data-ok>Got it</button></div>`).querySelector('[data-ok]').onclick = () => { closeModal(); render(); };
    $$('.dlg [data-x]').forEach(x => x.onclick = () => { closeModal(); render(); });
  }
  act('backup', exportBackup);

  /* ---------- page frame: big title, one sentence, one main button, extra actions under "More" ---------- */
  function page({ title, what, primary, more, body, noHelp }) {
    const m = MODS[route], h = m && m.help;
    ui._more = more || [];
    const seen = (meta.seen || {})[route];
    const how = h && !seen && !noHelp ? `<div class="howto noprint"><div class="hh">${ic('help')}<b>How this works</b><span class="sp"></span><button class="btn sm" data-act="seen">Got it</button></div><ol class="steps">${h.steps.map(s => `<li>${s}</li>`).join('')}</ol>${h.tip ? `<p class="small mute">${h.tip}</p>` : ''}</div>` : '';
    return `<div class="ph"><div class="t"><h2>${esc(title)}</h2>${what ? `<p>${what}</p>` : ''}</div>${primary || more ? `<div class="acts noprint">${primary || ''}${more && more.length ? `<button class="btn ghost" data-act="moreMenu">${ic('more')} More</button>` : ''}</div>` : ''}</div>${how}${body || ''}`;
  }
  act('seen', () => { meta.seen = { ...(meta.seen || {}), [route]: 1 }; saveMeta(); render(); });
  act('moreMenu', () => {
    const items = ui._more || [];
    modal(`<h2>More<span class="sp"></span>${xBtn}</h2><div class="menu">${items.map(it => `<button class="row" data-close data-act="${it.act}" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${ic(it.icon || 'right')}<span class="grow"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}</div>`)
      .querySelector('[data-x]').onclick = () => closeModal();
  });
  function helpSheet() {
    const m = MODS[route]; if (route === 'home') return homeHelp();
    const h = m.help || {};
    modal(`<h2>${ic(m.icon)} ${esc(m.title)}<span class="sp"></span>${xBtn}</h2>${h.what ? `<p>${h.what}</p>` : ''}${h.steps ? `<ol class="steps">${h.steps.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}${h.tip ? `<div class="note soft small">${ic('star')}<div>${h.tip}</div></div>` : ''}
      <div class="acts"><span class="sp"></span><button class="btn pri lg" data-ok>Got it</button></div>`).querySelector('[data-ok]').onclick = () => closeModal();
    $('.dlg [data-x]').onclick = () => closeModal();
  }
  function homeHelp() {
    modal(`<h2>${ic('home')} How to use this app<span class="sp"></span>${xBtn}</h2><ol class="steps">
      <li><b>Tap your name</b> at the top so your work is marked as yours.</li>
      <li><b>Look at "Do these next".</b> Work from the top down. Tap the big button on each one.</li>
      <li>When the list says <b>"All caught up"</b>, you're good.</li>
      <li>Need something else? Scroll down to <b>All tools</b>.</li>
      <li>Lost? Tap <b>Home</b> at the top left. Not sure what a page does? Tap the <b>?</b>.</li></ol>
      <div class="acts"><span class="sp"></span><button class="btn pri lg" data-ok>Got it</button></div>`).querySelector('[data-ok]').onclick = () => closeModal();
    $('.dlg [data-x]').onclick = () => closeModal();
  }
  act('help', helpSheet);

  const legal = (b, s) => `<p class="legal noprint">${ic('shield')}<span><b>${esc(b)}</b> ${esc(s)}</span></p>`;
  const empty = (msg, btn) => `<div class="empty"><p>${msg}</p>${btn || ''}</div>`;
  const past = (title, body) => `<details class="past"><summary>${esc(title)}</summary><div>${body}</div></details>`;
  const rangeSeg = (key, def) => { const v = ui[key] == null ? def : ui[key]; return `<div class="seg" role="group">${[[1, 'Today'], [7, 'This week'], [30, 'This month'], ['all', 'Everything']].map(([d, l]) => `<button data-act="setui" data-k="${key}" data-v="${d}" data-num="1" class="${String(v) === String(d) ? 'on' : ''}">${l}</button>`).join('')}</div>`; };
  act('setui', el => { const v = el.dataset.v; ui[el.dataset.k] = v === 'all' ? 'all' : (el.dataset.num ? +v : v); render(); });
  const staffOpts = () => staff().map(e => [e.id, e.name]);
  const staffNames = () => staff().map(e => e.name);
  const initials = n => String(n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (e, sz) => `<span class="av ${sz || ''}" style="background:${esc(e.color || COLORS[0])}">${esc(initials(e.name))}</span>`;
  const meAvatar = () => { const n = by(), e = D.employees.find(x => x.name === n); return e ? avatar(e) : `<span class="av" style="background:var(--field)">${n ? esc(initials(n)) : ic('user')}</span>`; };

  /* ---------- Today: "Do these next" + the hero + all tools ---------- */
  function todos() {
    const out = [];
    for (const id in MODS) { if (!isOn(id) || !MODS[id].todo) continue; try { out.push(...MODS[id].todo().map(t => ({ ...t, mod: id }))); } catch (e) { console.error(e); } }
    if (backupDue()) out.push({ key: 'backup', pri: 2, level: 'go', icon: 'shield', text: 'Save a backup of this app', sub: 'Takes 5 seconds. Protects everything if this tablet breaks or gets reset.', btn: 'Save backup', act: 'backup' });
    return out;
  }
  function todoRow(t) {
    const attrs = t.act ? `data-act="${t.act}" ${Object.entries(t.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}` : `data-go="${t.go || t.mod}" ${t.p ? `data-p="${esc(t.p)}"` : ''}`;
    return `<li class="todo ${t.level || 'go'}"><span class="tic">${ic(t.icon || MODS[t.mod].icon)}</span><span class="grow"><b>${esc(t.text)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span><button class="btn ${t.level === 'bad' ? 'dark' : 'pri'}" ${attrs}>${esc(t.btn || 'Start')} ${ic('right')}</button></li>`;
  }
  function tile(id) {
    const m = MODS[id]; let s = null; try { s = m.status ? m.status() : null; } catch (e) { }
    return `<button class="tile ${s && s.level ? s.level : ''}" data-go="${id}"><span class="ti">${ic(m.icon)}</span><b>${esc(m.title)}</b>${s && s.text ? `<small>${esc(s.text)}</small>` : ''}</button>`;
  }
  register({
    id: 'home', title: 'Today', short: 'Today', icon: 'home', core: true,
    render() {
      const d = new Date(), hr = d.getHours(), me = by();
      const hi = (hr < 11 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (me ? ', ' + me.split(' ')[0] : '');
      const LV = { bad: 0, warn: 1, go: 2 }, all = todos().filter(t => !t.done).sort((a, b) => (a.pri - b.pri) || ((LV[a.level] ?? 2) - (LV[b.level] ?? 2))), done = todos().filter(t => t.done);
      const show = ui.allTodos ? all : all.slice(0, 5);
      const hero = T.hero && isOn(T.hero) && MODS[T.hero].hero ? MODS[T.hero].hero() : '';
      const whoNudge = !me && staff().length ? `<button class="whobar" data-act="who">${ic('user')}<span class="grow"><b>Who's using this?</b><small>Tap to pick your name. It goes on everything you do today.</small></span>${ic('right')}</button>` : '';
      const groups = T.groups.map(([g, ids, sub]) => { const on = ids.filter(isOn); return on.length ? `<h3 class="sec">${esc(g)}${sub ? `<span class="mute small" style="text-transform:none;letter-spacing:0;font-weight:500">${esc(sub)}</span>` : ''}</h3><div class="tiles">${on.map(tile).join('')}</div>` : ''; }).join('');
      return `<div class="hello"><div><h2>${esc(hi)}</h2><p>${C.DNL[d.getDay()]}, ${C.MON[d.getMonth()]} ${d.getDate()}</p></div></div>
        ${whoNudge}${installHint()}
        <section class="todos" aria-label="Do these next"><h3 class="sec">Do these next</h3>
        ${all.length ? `<ol class="todolist">${show.map(todoRow).join('')}</ol>${all.length > show.length ? `<button class="btn ghost block" data-act="setui" data-k="allTodos" data-v="1">Show ${all.length - show.length} more</button>` : ''}`
          : `<div class="caught">${ic('party')}<div><b>You're all caught up!</b><small>Nothing needs doing right now. Check back later, or help a customer.</small></div></div>`}
        ${done.length ? `<p class="donecount">${ic('check')} Done today: ${done.map(t => esc(t.text)).join(' · ')}</p>` : ''}</section>
        ${hero}
        <h3 class="sec" style="margin-top:2rem">All tools</h3>${groups.replace('<h3 class="sec">', '<h3 class="sec" style="margin-top:.6rem">')}
        ${SITE ? `<div class="noprint" data-app-card="${T.id}" hidden></div>` : ''}`;
    }
  });

  /* ---------- the restaurant account (site only) ----------
     On grugdigital.com the shop is also a "restaurant account" (assets/business.js, 'grug.business.v1'), marked
     dash: 'tea' | 'cafe', so it gets a rewards card (rewards/) and a website (business/site/) like any restaurant, and
     the site's dock and menus open this dashboard. The card's name is the shop's name. */
  const BIZ = () => SITE && window.GrugBusiness && window.GrugRewards ? window.GrugBusiness : null;
  function linkShop() {
    const B = BIZ(); if (!B || !D || !D.settings.shopName) return null;
    try {
      let s = B.load(), id = meta.shopId && s.shops[meta.shopId] ? meta.shopId : '';
      if (!id) id = Object.keys(s.shops).find(k => s.shops[k].dash === T.id) || '';
      if (!id) {
        const RW = window.GrugRewards; let cfg = RW.normalize({ n: D.settings.shopName, t: T.cardType, j: 1 });
        // a shop's id comes from its name: never take over another shop on this device (a restaurant with the same name)
        if (s.shops[RW.shopId(cfg)]) cfg = RW.normalize({ ...cfg, n: (D.settings.shopName + ' ' + T.name).slice(0, 28) });
        if (s.shops[RW.shopId(cfg)]) return null;
        const code = RW.encode(cfg);
        try { RW.saveMine(code); } catch (e) { }
        const r = B.fromCard(code); if (!r) return null;
        id = r.shop.id; B.setDash(id, T.id);
      }
      if (meta.shopId !== id) { meta.shopId = id; saveMeta(); }
      s = B.load();
      if (s.active !== id) B.setActive(id);
      if (s.mode !== 'business') B.setMode('business');   // using a dashboard means using the restaurant account, like Daypart
      // renamed on the rewards card since we last looked? use that name here too
      const cfg = window.GrugRewards.decode(B.load().shops[id].c);
      if (cfg && cfg.n && cfg.n !== meta.cardName) { if (meta.cardName) { D.settings.shopName = cfg.n; save('settings'); } meta.cardName = cfg.n; saveMeta(); }
      return id;
    } catch (e) { console.error(e); return null; }
  }
  // the shop was renamed here: rename its rewards card and website too (they keep everything else)
  function renameShop(name) {
    const B = BIZ(), id = meta.shopId; if (!B || !id) return;
    try {
      const RW = window.GrugRewards, s = B.load(), x = s.shops[id]; if (!x) return;
      const cfg = RW.decode(x.c); if (!cfg || cfg.n === name) return;
      const code = RW.encode(Object.assign({}, cfg, { n: name })), r = B.fromCard(code, x.c);
      try { RW.saveMine(code, x.c); } catch (e) { }
      if (r) { B.setDash(r.shop.id, T.id); meta.shopId = r.shop.id; meta.cardName = name; saveMeta(); }
    } catch (e) { console.error(e); }
  }
  const DOCK = [['dashboard', 'Dashboard', './', '#9BE338', '#6FB31C', '<rect x="1" y="1" width="6" height="8" rx="1.5"></rect><rect x="9" y="1" width="6" height="5" rx="1.5"></rect><rect x="1" y="11" width="6" height="4" rx="1.5"></rect><rect x="9" y="8" width="6" height="7" rx="1.5"></rect>'],
    ['rewards', 'Rewards card', '../../rewards/', '#FF9F5A', '#E0782F', '<path d="M7 15H3a1 1 0 0 1-1-1V9h5zM14 14a1 1 0 0 1-1 1H9V9h5zM7 8H1V6a1 1 0 0 1 1-1h5zM14 5a1 1 0 0 1 1 1v2H9V5zM4.282 1.312a1.784 1.784 0 0 1 2.242.212L8 3l1.238-1.352c.605-.66 1.6-.781 2.345-.285l.06.04A1.75 1.75 0 0 1 12 4H4c-.776-.776-.63-2.08.282-2.688"></path>'],
    ['website', 'Website', '../site/', '#5AB0FF', '#2F86D6', '<path fill-rule="evenodd" d="M13 1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zM3 6v7h10V6z" clip-rule="evenodd"></path>']];
  function gdock() {
    if (document.querySelector('.gdock') || !meta.shopId) return;
    const n = document.createElement('nav'); n.className = 'gdock noprint'; n.setAttribute('aria-label', 'Your shop');
    n.innerHTML = DOCK.map(([id, name, href, c, lo, svg], i) => `<a href="${href}" style="--tab:${c};--tab-lo:${lo}"${i ? '' : ' aria-current="page" data-act="dockHome"'}><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${svg}</svg><span>${name}</span></a>`).join('');
    document.body.appendChild(n); document.documentElement.classList.add('gd-docked');
  }
  act('dockHome', () => { if (route !== 'home') go('home'); else window.scrollTo({ top: 0, behavior: 'smooth' }); });
  act('toPlayer', () => { const B = BIZ(); if (B) B.setMode('player'); location.href = '../../'; });
  function siteLinks() { if (!SITE) return; if (linkShop()) gdock(); }

  /* ---------- shell ---------- */
  function tabsHtml() {
    return T.tabs.filter(isOn).map(id => { const m = MODS[id]; let s = null; try { s = m.status && m.status(); } catch (e) { } return `<button data-go="${id}" ${route === id ? 'aria-current="page"' : ''}>${ic(m.icon)}<span>${esc(m.short || m.title)}</span>${s && s.level === 'bad' ? '<span class="cnt">!</span>' : ''}</button>`; }).join('');
  }
  let installEvt = null;
  function refreshChrome() {
    if (!D || !D.settings.shopName) return;
    $('#tabbar').innerHTML = tabsHtml();
    const home = route === 'home';
    $('#homebtn').hidden = home; $('#brandtop').hidden = !home;
    $('#shopname').textContent = D.settings.shopName || T.name;
    $('#pagetitle').textContent = home ? '' : MODS[route].title;
    $('#whochip').innerHTML = meAvatar() + `<span>${by() ? esc(by().split(' ')[0]) : 'Who are you?'}</span>`;
    $('#installchip').hidden = !installEvt;
    $('#offchip').hidden = navigator.onLine !== false;
    const p = $('#playfoot'); if (p) p.hidden = !(PLAY_URL && D.settings.showPlay);
  }
  function applyLook() { document.documentElement.style.setProperty('--ui', D.settings.bigText ? '1.14' : '1'); }
  function render() {
    if (!D.settings.shopName) return renderSetup();
    const su = $('#setup'); if (su) { su.remove(); $('#app').hidden = false; }
    readHash(); const m = MODS[route];
    const v = $('#view'); const y = ui._route === route ? window.scrollY : 0; ui._route = route;
    try { v.innerHTML = m.render(param); } catch (e) { console.error(e); v.innerHTML = `<div class="note bad">${ic('alert')}<div><b>Something went wrong on this page.</b>Tap Home and try again. (${esc(e.message)})</div></div>`; }
    wireForm(v); if (m.after) m.after(v);
    refreshChrome(); window.scrollTo(0, y);
    clearTimeout(render._t); render._t = setTimeout(tick, 0);  /* alarm chip and title follow at once */
  }

  /* ---------- first run: four short steps ---------- */
  function renderSetup() {
    $('#app').hidden = true;
    let s = $('#setup'); if (!s) { s = document.createElement('div'); s.id = 'setup'; document.body.appendChild(s); }
    const st = ui.setup = ui.setup || { step: 0, name: (new URLSearchParams(location.search).get('name') || '').trim().slice(0, 28), open: T.hours[0], close: T.hours[1], team: [], off: T.offByDefault ? T.offByDefault.slice() : [], starter: true, demo: false };
    const opt = T.groups.flatMap(g => g[1]).filter(id => MODS[id] && !MODS[id].core && (!MODS[id].visible || MODS[id].visible() !== false));
    const N = 4, dots = `<div class="dots">${Array.from({ length: N }, (_, j) => `<i class="${j <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const back = st.step ? `<button type="button" class="btn lg" data-back>${ic('left')} Back</button>` : '';
    let body = '';
    if (st.step === 0) body = `<div class="brand" style="padding:0 0 .6rem"><span class="logo">${ic(T.icon)}</span><span><small>Grug Digital</small><b>${esc(T.name)} dashboard</b></span></div>
      <h2 class="q">Hi! What's your shop called?</h2><p class="hint">${esc(T.tagline)}</p>
      <label class="f"><span>Shop name</span><input type="text" name="name" maxlength="28" value="${esc(st.name)}" placeholder="${esc(T.namePh)}" autofocus></label>
      <div class="fgrid"><label class="f"><span>We open at</span><input type="time" name="open" value="${st.open}"></label><label class="f"><span>We close at</span><input type="time" name="close" value="${st.close}"></label></div>
      <p class="small mute">The app uses these to know when to remind you about opening and closing jobs.</p>`;
    if (st.step === 1) body = `<h2 class="q">Who works here?</h2><p class="hint">Type each person's name and tap Add. Just first names are fine. You can add more later.</p>
      <div style="display:flex;gap:.5rem"><input type="text" name="person" placeholder="e.g. Maya" autofocus><button type="button" class="btn pri" data-addp>${ic('plus')} Add</button></div>
      <div class="chips big" style="margin:.9rem 0">${st.team.map((n, i) => `<button type="button" data-rmp="${i}" aria-label="Remove ${esc(n)}">${esc(n)} ${ic('x')}</button>`).join('') || '<span class="mute">No one yet.</span>'}</div>`;
    if (st.step === 2) body = `<h2 class="q">What do you want to use?</h2><p class="hint">Turn off anything you don't need. Fewer buttons = easier for everyone. You can change this any time in Settings.</p>
      <div class="pick">${opt.map(id => { const m = MODS[id]; return `<label class="pk ${st.off.includes(id) ? '' : 'on'}"><input type="checkbox" data-mod="${id}" ${st.off.includes(id) ? '' : 'checked'}><span class="ti">${ic(m.icon)}</span><span class="grow"><b>${esc(m.title)}</b><small>${esc((m.help && m.help.what) || '')}</small></span></label>`; }).join('')}</div>
      <label class="ckrow" style="margin-top:1rem"><input type="checkbox" name="starter" ${st.starter ? 'checked' : ''}> Fill in starter lists for a ${esc(T.kind)} (you can change them)</label>
      <label class="ckrow"><input type="checkbox" name="demo" ${st.demo ? 'checked' : ''}> Add pretend staff and entries so I can try it out first</label>`;
    if (st.step === 3) body = `<div class="bigicon">${ic('party')}</div><h2 class="q">You're ready, ${esc(st.name)}!</h2><p class="hint">Three things to know:</p>
      <ol class="steps"><li><b>Start on Today.</b> It lists what to do next, in order. Do the top one, then the next.</li><li><b>Tap ? on any page</b> if you're not sure what it's for.</li><li><b>Everything stays on this device.</b> Once a week the app will ask you to save a backup file. Please do it!</li></ol>
      <div class="note soft small">${ic('shield')}<div>Temperature and cleaning logs are for your own records. Your local health department's rules always come first.</div></div>`;
    s.innerHTML = `<div class="scrim setup" style="background:var(--bg)"><div class="dlg wiz">${dots}<form id="setupf" novalidate>${body}<p class="ferr" data-err role="alert"></p>
      <div class="acts">${back}<span class="sp"></span><button class="btn pri lg" type="submit">${st.step === 3 ? 'Start using it ' + ic('right') : 'Next ' + ic('right')}</button></div></form>
      ${st.step === 0 ? `<p class="small" style="text-align:center;margin-top:1rem">Already used this on another device? <label class="link" for="imp" style="cursor:pointer">Restore from a backup file</label></p>` : ''}</div></div>`;
    const f = $('#setupf'), err = m => { s.querySelector('[data-err]').textContent = m; };
    const keep = () => { if (f.name) st.name = f.name.value.trim(); if (f.open) { st.open = f.open.value || st.open; st.close = f.close.value || st.close; } if (f.starter) { st.starter = f.starter.checked; st.demo = f.demo.checked; } };
    const addp = () => { const n = f.person.value.trim(); if (!n) return; if (!st.team.includes(n)) st.team.push(n); renderSetup(); setTimeout(() => $('#setupf [name=person]').focus(), 20); };
    if (f.person) { s.querySelector('[data-addp]').onclick = addp; f.person.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addp(); } }); }
    $$('[data-rmp]', s).forEach(b => b.onclick = () => { st.team.splice(+b.dataset.rmp, 1); renderSetup(); });
    $$('[data-mod]', s).forEach(c => c.onchange = () => { const id = c.dataset.mod; st.off = c.checked ? st.off.filter(x => x !== id) : st.off.concat(id); c.closest('.pk').classList.toggle('on', c.checked); });
    const b = s.querySelector('[data-back]'); if (b) b.onclick = () => { keep(); st.step--; renderSetup(); };
    f.onsubmit = e => {
      e.preventDefault(); keep();
      if (st.step === 0 && !st.name) return err('Type your shop name first.');
      if (st.step === 1 && f.person.value.trim()) { addp(); return; }
      if (st.step < 3) { st.step++; renderSetup(); return; }
      D.settings.shopName = st.name; D.settings.openAt = st.open; D.settings.closeAt = st.close; D.settings.off = st.off; D.settings.updatedAt = nowISO(); D.settings.createdAt = nowISO();
      if (st.starter) T.starter(D, C, today());
      if (st.demo) T.demo(D, C, today());
      st.team.forEach((n, i) => { if (!D.employees.some(e => e.name.toLowerCase() === n.toLowerCase())) D.employees.push({ id: C.uid(), name: n, color: COLORS[(i + 3) % COLORS.length] }); });
      for (const c of COLLS) for (const r of D[c]) { if (!r.id) r.id = C.uid(); if (!r.updatedAt) r.updatedAt = nowISO(); }
      save(); ui.setup = null; siteLinks(); go('home'); render();
      if (staff().length) setTimeout(() => whoPicker(), 300);
    };
  }

  /* ---------- import ---------- */
  function importFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let obj; try { obj = JSON.parse(rd.result); } catch (e) { return toast("That isn't a backup file. Pick the .json file the app saved.", 6000); }
      const r = C.readBackup(obj, T, COLLS);
      if (r.error) { const d = modal(`<h2>This file won't work<span class="sp"></span>${xBtn}</h2><p>${esc(r.error)}</p><div class="acts"><span class="sp"></span><button class="btn pri" data-ok>OK</button></div>`); d.querySelector('[data-ok]').onclick = d.querySelector('[data-x]').onclick = () => closeModal(); return; }
      const lab = c => (T.collLabels && T.collLabels[c]) || c;
      const hasData = D.settings.shopName || COLLS.some(c => D[c].length);
      const d = modal(`<h2>Restore this backup?<span class="sp"></span>${xBtn}</h2><p>It's from <b>${esc(r.data.settings.shopName || '?')}</b>${r.exportedAt ? ', saved ' + esc(C.fmtWhen(r.exportedAt, today())) : ''}.</p>
        <details class="past"><summary>What's in it</summary><div class="tbl-wrap" style="max-height:14rem"><table class="tbl"><tr><th>What</th><th class="n">In the file</th><th class="n">On this device</th></tr>
        ${r.summary.map(([c, n]) => `<tr><td>${esc(lab(c))}</td><td class="n">${n}</td><td class="n">${D[c].length}</td></tr>`).join('')}</table></div></details>
        ${hasData ? `<div class="seg" style="margin:.8rem 0 .4rem"><button class="on" data-m="replace">Use the backup instead</button><button data-m="merge">Combine both</button></div><p class="small mute" data-mh>What's on this device now gets swapped for the backup.</p>` : ''}
        <div class="acts"><span class="sp"></span><button class="btn pri lg" data-go>${ic('upload')} Restore</button></div>`);
      let mode = 'replace';
      const sg = d.querySelector('.seg'); if (sg) sg.onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; $$('.seg button', d).forEach(x => x.classList.toggle('on', x === b)); d.querySelector('[data-mh]').textContent = mode === 'replace' ? "What's on this device now gets swapped for the backup." : 'Keeps everything here and adds what\'s new in the backup.'; };
      d.querySelector('[data-x]').onclick = () => closeModal();
      d.querySelector('[data-go]').onclick = async () => {
        closeModal();
        if (mode === 'replace' && hasData && !(await confirmBox({ title: 'Swap everything for the backup?', body: 'What\'s on this device now for <b>' + esc(D.settings.shopName) + '</b> will be replaced. You can\'t undo this.', ok: 'Yes, replace', danger: true, typed: 'REPLACE' }))) return;
        const next = mode === 'replace' ? r.data : C.mergeData(D, r.data, COLLS);
        D = { schemaVersion: C.SCHEMA, settings: { ...blankSettings(), ...next.settings } }; for (const c of COLLS) D[c] = next[c] || [];
        ui.setup = null; save(); applyLook(); siteLinks(); render(); toast('Backup restored. Everything is back.', 4000);
      };
    };
    rd.readAsText(file);
  }

  /* ---------- PWA: service worker, update prompt, install ---------- */
  function setupPwa() {
    window.addEventListener('online', () => refreshChrome()); window.addEventListener('offline', () => refreshChrome());
    if (SITE) return;   /* app/app.js registers the site's service worker, offers the install and brings updates */
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; refreshChrome(); });
    window.addEventListener('appinstalled', () => { installEvt = null; refreshChrome(); toast('Installed! Open it from your home screen.'); });
    if (!window.SHOP_PWA || !('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = w => toast('A new version is ready.', 60000, { label: 'Update', fn: () => w.postMessage({ type: 'SKIP_WAITING' }) });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
      setInterval(() => reg.update().catch(() => { }), 60 * 60 * 1000);
    }).catch(() => { });
    let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  act('install', () => { const g = siteApp(); if (g) return g.install(T.id); if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; refreshChrome(); }); } });
  act('iosHintX', () => { meta.iosHintDismissed = true; saveMeta(); render(); });
  act('soundOn', () => { Sound.unlock(); refreshChrome(); tick(); toast(Sound.unlocked ? 'Sound is on. You\'ll hear a beep when something needs throwing out.' : 'Your browser is still blocking sound. Tap again, and check the volume.'); });
  act('alarmGo', () => go(T.hero || 'home'));
  function installHint() {
    if (!window.SHOP_PWA || SITE || isStandalone() || !isIOS() || meta.iosHintDismissed) return '';
    return `<div class="note soft noprint">${ic('download')}<div class="grow"><b>Make this an app on your home screen</b>In Safari, tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>.</div><button class="ib" data-act="iosHintX" aria-label="Dismiss">${ic('x')}</button></div>`;
  }

  /* ---------- start ---------- */
  function start() {
    Store.init(); loadAll(); applyLook();
    const R = document.documentElement.style;
    R.setProperty('--mode', T.theme.mode); R.setProperty('--lo', T.theme.lo); R.setProperty('--bg', T.theme.bg); R.setProperty('--accent-2', T.theme.accent2); R.setProperty('--accent-2-lo', T.theme.accent2lo);
    $('#brandlogo').innerHTML = ic(T.icon);
    $('#homebtn').innerHTML = ic('home') + '<span>Home</span>'; $('#helpbtn').innerHTML = ic('help') + '<span class="sr">Help</span>';
    $('#soundchip').innerHTML = ic('vol') + ' <span class="lbl">Tap to turn on sound</span>'; $('#soundchip').title = 'Tap to turn on sound'; $('#soundchip').setAttribute('aria-label', 'Turn on sound');
    $('#installchip').innerHTML = ic('download') + ' Install app';
    if (window.GrugContact) $('#contactslot').outerHTML = GrugContact.button();   // assets/contact.js: Discord, Instagram, text, email
    if (PLAY_URL) { const p = $('#playfoot'); p.href = PLAY_URL; p.innerHTML = `<span class="dot">${ic('game')}</span> Play while you wait`; }
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g && !g.closest('.dlg')) { go(g.dataset.go, g.dataset.p); return; }
      const a = e.target.closest('[data-act]'); if (a && ACTS[a.dataset.act]) { e.preventDefault(); if (a.hasAttribute('data-close')) closeModal(); ACTS[a.dataset.act](a, e); }
    });
    document.addEventListener('change', e => { const a = e.target.closest('[data-change]'); if (a && ACTS[a.dataset.change]) ACTS[a.dataset.change](a, e); });
    window.addEventListener('hashchange', () => { ui.allTodos = false; render(); window.scrollTo(0, 0); });
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith(PRE)) { loadAll(); if (!modalStack.length) render(); } }); /* another tab changed data */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    $('#imp').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
    siteLinks(); ui.day = today(); render(); setupPwa(); setInterval(tick, 1000); tick();
    if (Store.mode !== 'local') toast("This browser won't let the app save. Open it in a normal (not private) window.", 9000);
  }

  return {
    C, T, PLAY_URL, COLLS, PRE, Store, $, $$, esc, ic, IC, today, nowISO, nowMin, register, act, go, render, refreshChrome, toast, modal, closeModal, confirmBox, xBtn,
    openForm, formHtml, wireForm, readForm, fieldHtml, wizard, whoPicker, Sound, timerCard, ringSvg, timerText, download, csvDownload, inRange, backupDue, exportBackup,
    page, legal, empty, past, rangeSeg, staffOpts, staffNames, staff, empName, avatar, initials, COLORS, upsert, remove, removeUndo, find, save, setSettings,
    by, rememberBy, ui, MODS, CSVS, installHint, SITE, renameShop, linkShop, isIOS, isStandalone, activeTimers, start, importFile, isOn,
    get D() { return D; }, get meta() { return meta; }, saveMeta, get installEvt() { return installEvt; }, get route() { return route; }
  };
})();
