/* node test/core.test.js */
const C = require('../src/core.js');
const assert = require('assert');
let n = 0; const t = (name, f) => { f(); n++; };

t('batchState phases from timestamps', () => {
  const s = Date.parse('2026-11-15T12:00:00');
  const b = { startedAt: new Date(s).toISOString(), cookMin: 45, holdMin: 240 };
  assert.equal(C.batchState(b, s + 10 * 6e4).phase, 'cooking');
  assert.equal(C.batchState(b, s + 60 * 6e4, 15).phase, 'holding');
  assert.equal(C.batchState(b, s + (45 + 230) * 6e4, 15).phase, 'soon');
  const ex = C.batchState(b, s + (45 + 241) * 6e4, 15);
  assert.equal(ex.phase, 'expired'); assert.equal(ex.discardAt, s + 285 * 6e4);
  assert.equal(C.batchState({ ...b, endedAt: 'x' }, s).phase, 'ended');
});
t('peak coverage counts the thinnest moment', () => {
  const sh = [{ date: '2026-11-16', start: '14:00', end: '18:00' }, { date: '2026-11-16', start: '15:00', end: '17:00' }, { date: '2026-11-16', start: '16:00', end: '22:00' }];
  assert.equal(C.peakCoverage(sh, '2026-11-16', { start: '15:00', end: '18:00' }), 2);
  assert.equal(C.peakCoverage(sh, '2026-11-16', { start: '16:00', end: '17:00' }), 3);
  assert.equal(C.peakCoverage(sh, '2026-11-17', { start: '16:00', end: '17:00' }), 0);
});
t('overnight shift hours', () => assert.equal(C.shiftHours({ start: '20:00', end: '02:00' }), 6));
t('tip split adds up exactly', () => {
  const out = C.splitTips(100, [{ hours: 3 }, { hours: 3 }, { hours: 3 }]);
  assert.equal(C.r2(out.reduce((a, p) => a + p.amount, 0)), 100);
  const eq = C.splitTips(10, [{ hours: 0 }, { hours: 0 }, { hours: 0 }]);
  assert.equal(C.r2(eq.reduce((a, p) => a + p.amount, 0)), 10);
});
t('cash summary', () => { const s = C.cashSummary({ float: 150, cashSales: 300, counted: 445, cashTips: 20, cardTips: 30 }); assert.equal(s.overShort, -5); assert.equal(s.tips, 50); });
t('bake suggestion uses same weekday', () => {
  const counts = [];
  for (let w = 1; w <= 4; w++) counts.push({ itemId: 'a', date: C.addDays('2026-11-17', -7 * w), baked: 12, left: 2 });
  const s = C.bakeSuggestion(counts, 'a', '2026-11-17', 10);
  assert.equal(s.basis, 'same'); assert.equal(s.qty, 11);
  assert.equal(C.bakeSuggestion([], 'a', '2026-11-17', 9).qty, 9);
});
t('csv escapes formulas and quotes', () => assert.equal(C.csv([['=1+1', 'a,"b"']]), "'=1+1,\"a,\"\"b\"\"\"\r\n"));
const colls = C.BASE_COLLS.concat(['pearlBatches']);
const type = { id: 'tea', name: 'Bubble Tea', version: '1.0.0' };
t('backup round trip + validation', () => {
  const D = { schemaVersion: 1, settings: { shopName: 'X' } }; for (const c of colls) D[c] = [];
  D.items.push({ id: 'i1', name: 'Cups', par: 10, count: 2 });
  const b = JSON.parse(JSON.stringify(C.makeBackup(D, type, colls, {})));
  const r = C.readBackup(b, type, colls); assert(!r.error, r.error); assert.equal(r.data.items[0].name, 'Cups');
  assert(C.readBackup(b, { id: 'cafe', name: 'Café' }, colls).error.includes('Bubble Tea'));
  assert(C.readBackup({ app: 'daypart-backup' }, type, colls).error.includes('restaurant'));
  assert(C.readBackup({ ...b, schemaVersion: 99 }, type, colls).error.includes('newer'));
  const bad = JSON.parse(JSON.stringify(b)); bad.data.items = [{ name: 'no id' }];
  assert(C.readBackup(bad, type, colls).error.includes('damaged'));
  const old = JSON.parse(JSON.stringify(b)); old.schemaVersion = 0; delete old.data.orders;
  const m = C.readBackup(old, type, colls); assert(!m.error); assert.deepEqual(m.data.orders, []); assert.equal(m.data.schemaVersion, 1);
});
t('merge keeps newer', () => {
  const a = { schemaVersion: 1, settings: { updatedAt: '1' } }, b = { schemaVersion: 1, settings: { updatedAt: '2', shopName: 'B' } };
  for (const c of colls) { a[c] = []; b[c] = []; }
  a.items = [{ id: '1', n: 'old', updatedAt: '2026-01-01' }, { id: '2' }]; b.items = [{ id: '1', n: 'new', updatedAt: '2026-02-01' }, { id: '3' }];
  const m = C.mergeData(a, b, colls); assert.equal(m.items.length, 3); assert.equal(m.items.find(x => x.id === '1').n, 'new'); assert.equal(m.settings.shopName, 'B');
});
t('order groups', () => {
  const D = { items: [{ id: 'a', name: 'Cups', par: 10, count: 4, supplierId: 's1' }, { id: 'b', name: 'Lids', par: 10, count: 12 }], orders: [{ id: 'o', name: 'Mango', qty: 2, supplierId: '' }] };
  const g = C.orderGroups(D); assert.equal(g.s1[0].qty, 6); assert.equal(g[''].length, 1);
});
console.log('core tests passed:', n);
