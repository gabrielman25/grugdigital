/* ==========================================================================
   Shop dashboards · core.js
   Pure logic shared by every business type (Tea & Boba, Café, …).
   No DOM here, so it can be unit-tested in Node:  node test/core.test.js
   ========================================================================== */
const Core = (() => {
  'use strict';

  /* ---------- schema ----------
     Bump SCHEMA when the saved shape changes and add a step to MIGRATIONS
     (MIGRATIONS[n] upgrades a version-n data object to version n+1). */
  const SCHEMA = 1;
  const APP_ID = 'grug-shop-dashboard';

  /* collections every business type has */
  const BASE_COLLS = ['employees', 'shifts', 'punches', 'checklists', 'checkRuns', 'handoffs', 'cashouts',
    'items', 'suppliers', 'orders', 'waste', 'cleanTasks', 'cleanLogs', 'tempUnits', 'tempLogs', 'recipes'];

  /* ---------- small helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const [a, b, c] = String(s).split('-').map(Number); return new Date(a, b - 1, c); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = s => parseYmd(s).getDay();
  const weekStart = (s, ws) => addDays(s, -((dow(s) - (ws || 0) + 7) % 7));
  const weekDates = st => Array.from({ length: 7 }, (_, i) => addDays(st, i));
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const fromMin = m => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DNL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtT = t => { let [h, m] = String(t).split(':').map(Number); const ap = h < 12 ? 'a' : 'p'; h = h % 12 || 12; return h + (m ? ':' + pad(m) : '') + ap; };
  const fmtDay = s => { const x = parseYmd(s); return DN[x.getDay()] + ' ' + MON[x.getMonth()] + ' ' + x.getDate(); };
  const fmtClock = ms => { const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + pad(d.getMinutes()) + ' ' + ap; };
  const fmtWhen = (iso, today) => { const d = new Date(iso); const day = ymd(d); return (day === today ? 'Today' : fmtDay(day)) + ' ' + fmtClock(d.getTime()); };
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const money = n => (n < 0 ? '−$' : '$') + Math.abs(r2(n)).toFixed(2);
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const clone = o => JSON.parse(JSON.stringify(o));

  /* durations: "1:05:09", "12:04", or "2h 5m" for long ones */
  function fmtDur(ms, long) {
    const neg = ms < 0; ms = Math.abs(ms);
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (long) return (neg ? '−' : '') + (h ? h + 'h ' : '') + m + 'm';
    return (neg ? '−' : '') + (h ? h + ':' + pad(m) : m) + ':' + pad(sec);
  }

  /* ---------- shifts ---------- */
  const span = sh => { const s = toMin(sh.start); let e = toMin(sh.end); if (e <= s) e += 1440; return [s, e]; };
  const shiftHours = sh => { const [s, e] = span(sh); return Math.max(0, (e - s - (+sh.breakMin || 0)) / 60); };

  /* How many people are on during a rush window on one date.
     Returns the lowest head-count at any 15-minute step inside the window. */
  function peakCoverage(shifts, date, peak) {
    const ps = toMin(peak.start); let pe = toMin(peak.end); if (pe <= ps) pe += 1440;
    const day = shifts.filter(s => s.date === date);
    let min = Infinity;
    for (let t = ps; t < pe; t += 15) {
      const n = day.filter(s => { const [a, b] = span(s); return a <= t && b > t; }).length;
      if (n < min) min = n;
    }
    return min === Infinity ? 0 : min;
  }
  const peakOnDay = (peak, date) => !peak.days || !peak.days.length || peak.days.includes(dow(date));
  const shiftHitsPeak = (sh, peak) => { const [a, b] = span(sh); const ps = toMin(peak.start); let pe = toMin(peak.end); if (pe <= ps) pe += 1440; return a < pe && b > ps; };

  /* ---------- punches / hours ---------- */
  const punchHours = (p, now) => { const a = Date.parse(p.in), b = p.out ? Date.parse(p.out) : (now || Date.now()); return Math.max(0, (b - a) / 36e5); };

  /* one row per employee: hours worked on each day of the week (by clock-in date) */
  function weekHours(D, dates) {
    const set = new Set(dates);
    return D.employees.map(e => {
      const per = dates.map(() => 0);
      for (const p of D.punches) {
        if (p.empId !== e.id || !p.out) continue;
        const d = ymd(new Date(p.in)); if (!set.has(d)) continue;
        per[dates.indexOf(d)] += punchHours(p);
      }
      return { emp: e, per: per.map(r2), total: r2(per.reduce((a, b) => a + b, 0)) };
    });
  }
  function hoursCsvRows(D, dates) {
    const rows = [['Employee', 'Role', ...dates.map(d => fmtDay(d)), 'Total hours']];
    for (const r of weekHours(D, dates)) if (r.total > 0) rows.push([r.emp.name, r.emp.role || '', ...r.per, r.total]);
    return rows;
  }
  function punchCsvRows(D, dates) {
    const set = new Set(dates), rows = [['Employee', 'Date', 'Clock in', 'Clock out', 'Hours', 'Note']];
    const name = id => (D.employees.find(e => e.id === id) || {}).name || '(removed)';
    D.punches.filter(p => set.has(ymd(new Date(p.in)))).sort((a, b) => a.in < b.in ? -1 : 1)
      .forEach(p => rows.push([name(p.empId), ymd(new Date(p.in)), fmtClock(Date.parse(p.in)), p.out ? fmtClock(Date.parse(p.out)) : '(still in)', p.out ? r2(punchHours(p)) : '', p.note || '']));
    return rows;
  }

  /* ---------- tips: split a pool by hours ---------- */
  function splitTips(total, people) {
    const H = people.reduce((a, p) => a + (+p.hours || 0), 0);
    if (!people.length) return [];
    let out = people.map(p => ({ ...p, amount: H > 0 ? Math.floor((total * (+p.hours || 0) / H) * 100) / 100 : Math.floor(total / people.length * 100) / 100 }));
    /* hand out leftover cents so the split adds up exactly */
    let left = Math.round((total - out.reduce((a, p) => a + p.amount, 0)) * 100);
    for (let i = 0; left > 0 && out.length; i = (i + 1) % out.length, left--) out[i].amount = r2(out[i].amount + 0.01);
    return out;
  }
  function cashSummary(c) {
    const expected = (+c.float || 0) + (+c.cashSales || 0);
    const overShort = c.counted === '' || c.counted == null ? null : r2((+c.counted || 0) - expected);
    const tips = r2((+c.cashTips || 0) + (+c.cardTips || 0));
    return { expected: r2(expected), overShort, tips, sales: r2((+c.cashSales || 0) + (+c.cardSales || 0)) };
  }

  /* ---------- stock ---------- */
  const isLow = it => it.par > 0 && (+it.count || 0) < +it.par;
  const isCritical = it => it.par > 0 && (+it.count || 0) <= +it.par / 2;
  const needQty = it => Math.max(0, r2((+it.par || 0) - (+it.count || 0)));
  /* order list: below-par items + manual lines, grouped by supplier id ('' = no supplier) */
  function orderGroups(D) {
    const g = {};
    const add = (sid, line) => (g[sid || ''] = g[sid || ''] || []).push(line);
    for (const it of D.items) if (isLow(it)) add(it.supplierId, { kind: 'auto', id: it.id, name: it.name, qty: needQty(it), unit: it.unit || '', done: !!it.orderedAt, item: it });
    for (const o of D.orders) add(o.supplierId, { kind: 'manual', id: o.id, name: o.name, qty: o.qty, unit: o.unit || '', done: !!o.done, note: o.note || '', source: o.source || '' });
    return g;
  }

  /* ---------- timers: everything comes from stored timestamps ---------- */
  /* A batch: {startedAt ISO, cookMin, holdMin, endedAt?}. Cooking runs cookMin from the start;
     the hold clock starts when cooking ends; discard-by = start + cook + hold. */
  function batchState(b, now, warnMin) {
    now = now == null ? Date.now() : now;
    const start = Date.parse(b.startedAt), cookEnd = start + (+b.cookMin || 0) * 6e4, discardAt = cookEnd + (+b.holdMin || 0) * 6e4;
    if (b.endedAt) return { phase: 'ended', start, cookEnd, discardAt };
    if (now < cookEnd) return { phase: 'cooking', start, cookEnd, discardAt, left: cookEnd - now, pct: (now - start) / Math.max(1, cookEnd - start) };
    if (now < discardAt) { const left = discardAt - now; return { phase: left <= (warnMin || 0) * 6e4 ? 'soon' : 'holding', start, cookEnd, discardAt, left, pct: 1 - left / Math.max(1, discardAt - cookEnd) }; }
    return { phase: 'expired', start, cookEnd, discardAt, over: now - discardAt, pct: 1 };
  }

  /* date-only "use by" helpers (milk, beans, seasonal) */
  const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);

  /* Pastry: suggest tomorrow's bake from what actually sold (baked − left).
     Uses the last 4 counts on the same weekday; falls back to the last 7 counts. */
  function bakeSuggestion(counts, itemId, forDate, par) {
    const mine = counts.filter(c => c.itemId === itemId && c.baked !== '' && c.left !== '' && c.date < forDate).sort((a, b) => a.date < b.date ? 1 : -1);
    let use = mine.filter(c => dow(c.date) === dow(forDate)).slice(0, 4), basis = 'same';
    if (use.length < 2) { use = mine.slice(0, 7); basis = 'recent'; }
    if (!use.length) return { qty: +par || 0, basis: 'par', n: 0 };
    const sold = use.map(c => Math.max(0, (+c.baked || 0) - (+c.left || 0)));
    const avg = sold.reduce((a, b) => a + b, 0) / sold.length;
    const soldOut = use.filter(c => +c.left === 0).length;
    /* sold out on more than half of those days: demand may be higher than what we saw, nudge up */
    const qty = Math.max(1, Math.ceil(avg * (soldOut > use.length / 2 ? 1.15 : 1.05)));
    return { qty, basis, n: use.length, avg: r2(avg), soldOut };
  }

  /* ---------- CSV ---------- */
  function csv(rows) {
    const cell = v => { if (typeof v === 'number') return String(v); let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- PIN (light: keeps honest people honest on a shared tablet) ---------- */
  function hashPin(s, salt) { let h = 0x811c9dc5; const t = (salt || 'shop') + ':' + String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

  /* ---------- schema, migrations, backup ---------- */
  const MIGRATIONS = {
    /* 0 → 1: files from before versioning (none shipped yet); make sure every collection exists */
    0: (d, colls) => { for (const c of colls) if (!Array.isArray(d[c])) d[c] = []; d.settings = d.settings || {}; return d; }
  };
  function migrate(data, colls, steps, target) {
    steps = steps || MIGRATIONS; target = target || SCHEMA;
    let d = clone(data), v = +d.schemaVersion || 0;
    if (v > target) throw new Error('This file was made by a newer version of the dashboard. Update this page first (reload it), then try again.');
    while (v < target) { const f = steps[v]; if (!f) throw new Error('No upgrade step from version ' + v + '.'); d = f(d, colls); v++; d.schemaVersion = v; }
    for (const c of colls) if (!Array.isArray(d[c])) d[c] = [];
    return d;
  }
  function makeBackup(D, type, colls, meta) {
    const data = { settings: D.settings }; for (const c of colls) data[c] = D[c];
    return { app: APP_ID, type: type.id, typeName: type.name, schemaVersion: SCHEMA, appVersion: type.version, exportedAt: new Date().toISOString(), deviceId: meta && meta.deviceId, data };
  }
  /* returns {data, summary} or {error} */
  function readBackup(obj, type, colls) {
    try {
      if (!obj || typeof obj !== 'object') return { error: "This file isn't a dashboard backup." };
      if (obj.app === 'daypart-backup') return { error: 'This is a backup from the restaurant dashboard (Daypart). Import it there instead.' };
      if (obj.app !== APP_ID || !obj.data || typeof obj.data !== 'object') return { error: "This file isn't a dashboard backup. Choose a .json file saved from Backup → Save backup file." };
      if (obj.type !== type.id) return { error: 'This backup is from the ' + (obj.typeName || obj.type) + ' dashboard, not ' + type.name + '. Open that dashboard to import it.' };
      if (typeof obj.schemaVersion !== 'number') return { error: 'This backup file is missing its version number.' };
      const raw = { ...obj.data, schemaVersion: obj.schemaVersion };
      if (raw.settings !== undefined && (typeof raw.settings !== 'object' || raw.settings === null || Array.isArray(raw.settings))) return { error: 'This backup file is damaged (settings could not be read).' };
      for (const c of colls) {
        if (raw[c] === undefined) continue;
        if (!Array.isArray(raw[c]) || raw[c].some(r => !r || typeof r !== 'object' || typeof r.id !== 'string')) return { error: 'This backup file is damaged (' + c + ' could not be read).' };
      }
      const data = migrate(raw, colls);
      const summary = colls.map(c => [c, data[c].length]).filter(x => x[1] > 0);
      return { data, summary, exportedAt: obj.exportedAt || null };
    } catch (e) { return { error: e.message || 'This file could not be read.' }; }
  }
  /* merge: keep everything on both sides; where the same record is in both, keep the newer one */
  function mergeData(cur, inc, colls) {
    const out = { schemaVersion: cur.schemaVersion, settings: (inc.settings && (inc.settings.updatedAt || '') > (cur.settings.updatedAt || '')) ? inc.settings : cur.settings };
    for (const c of colls) {
      const m = new Map(cur[c].map(r => [r.id, r]));
      for (const r of inc[c] || []) { const x = m.get(r.id); if (!x || (r.updatedAt || '') > (x.updatedAt || '')) m.set(r.id, r); }
      out[c] = [...m.values()];
    }
    return out;
  }

  return {
    SCHEMA, APP_ID, BASE_COLLS, MIGRATIONS, pad, ymd, parseYmd, addDays, dow, weekStart, weekDates, toMin, fromMin, DN, DNL, MON,
    fmtT, fmtDay, fmtClock, fmtWhen, fmtDur, r2, money, uid, clone, span, shiftHours, peakCoverage, peakOnDay, shiftHitsPeak,
    punchHours, weekHours, hoursCsvRows, punchCsvRows, splitTips, cashSummary, isLow, isCritical, needQty, orderGroups,
    batchState, daysBetween, bakeSuggestion, csv, hashPin, migrate, makeBackup, readBackup, mergeData
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
