/* ==========================================================================
   Café tools: espresso check (with the "bar check" card on Today), coffee beans, opened milk,
   machine cleaning, pastry counts with tomorrow's suggestion, and the count list.
   ========================================================================== */
(() => {
  'use strict';
  const A = App, C = A.C, esc = A.esc, ic = A.ic, ui = A.ui, S = () => A.D.settings, today = A.today, nowISO = A.nowISO, nowMin = A.nowMin;
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
  const openM = () => C.toMin(S().openAt || A.T.hours[0]), closeM = () => { const c = C.toMin(S().closeAt || A.T.hours[1]); return c <= openM() ? c + 1440 : c; };
  const beans = () => A.D.items.filter(i => i.kind === 'bean');
  const espBeans = () => beans().filter(b => /espresso|decaf/i.test(b.cat || '') || A.D.dialins.some(d => d.beanId === b.id));

  /* ================= ESPRESSO CHECK (dial-in) ================= */
  const ratio = s => s.dose ? (s.yield / s.dose) : 0;
  const shotsFor = beanId => A.D.dialins.filter(d => d.beanId === beanId).sort((a, b) => a.at < b.at ? 1 : -1);
  const current = beanId => { const s = shotsFor(beanId); return s.find(x => x.keeper) || s[0]; };
  const dialedToday = b => shotsFor(b.id).some(s => C.ymd(new Date(s.at)) === today());
  const timeCls = t => { const s = S(); return !t ? '' : (t < s.shotMin || t > s.shotMax) ? 'warn' : 'ok'; };
  /* plain advice a first-week barista can follow */
  function advice(v) {
    const s = S(); if (!v.time) return '';
    const msgs = [];
    if (v.time < s.shotMin) msgs.push(`<b>Too fast</b> (${v.time}s). Make the grind <b>finer</b> (a lower number on most grinders) and try again.`);
    else if (v.time > s.shotMax) msgs.push(`<b>Too slow</b> (${v.time}s). Make the grind <b>coarser</b> (a higher number on most grinders) and try again.`);
    else msgs.push(`<b>Time is good</b> (${v.time}s, aim for ${s.shotMin}–${s.shotMax}).`);
    if (v.taste === 'Sour') msgs.push('Sour usually means grind a bit finer.'); if (v.taste === 'Bitter') msgs.push('Bitter usually means grind a bit coarser.');
    if (v.time >= s.shotMin && v.time <= s.shotMax && (v.taste === 'Tastes good' || !v.taste)) msgs.push('If it tastes good, this is the one!');
    return msgs.join(' ');
  }
  function shotWizard(beanId) {
    const bs = espBeans().length ? espBeans() : beans(); if (!bs.length) return A.toast('Add your coffee beans first (Coffee beans page).');
    const b0 = beanId ? A.find('items', beanId) : bs[0], last = b0 && current(b0.id);
    A.wizard({
      title: 'Log a test shot', doneLabel: 'Save shot',
      values: { beanId: b0 ? b0.id : '', grind: last ? last.grind : '', dose: last ? last.dose : 18, yield: last ? last.yield : 36 },
      steps: [
        { k: 'beanId', q: 'Which coffee?', type: 'chips', opts: bs.map(b => [b.id, b.name]), skipIf: () => bs.length < 2 },
        { k: 'grind', q: 'What number is the grinder on?', hint: last ? `Last time it was <b>${esc(last.grind)}</b>.` : 'The number on the grinder dial.', type: 'text' },
        { k: 'dose', q: 'Coffee in: how many grams?', hint: 'Weigh the ground coffee in the basket.', type: 'number', unit: 'g', max: 40 , positive: true },
        { k: 'yield', q: 'Coffee out: how many grams?', hint: 'Put the cup on the scale and weigh the shot.', type: 'number', unit: 'g', max: 120 , positive: true },
        { k: 'time', q: 'How many seconds did it take?', hint: 'From pressing the button to stopping it.', type: 'number', unit: 'sec', max: 90 , positive: true },
        { k: 'taste', q: 'How does it taste?', type: 'chips', opts: ['Tastes good', 'Sour', 'Bitter', 'Watery', 'Not sure'] }
      ],
      onDone(v) {
        const b = A.find('items', v.beanId) || b0, good = v.time >= S().shotMin && v.time <= S().shotMax && v.taste === 'Tastes good';
        if (good) for (const x of A.D.dialins) if (x.beanId === b.id && x.keeper && C.ymd(new Date(x.at)) === today()) { x.keeper = false; x.updatedAt = nowISO(); }
        const rec = A.upsert('dialins', { beanId: b.id, beanName: b.name, grind: v.grind, dose: +v.dose, yield: +v.yield, time: +v.time, taste: v.taste, keeper: good, by: A.by(), at: nowISO() }); A.save('dialins');
        return `<h2 class="q">${good ? 'That\'s the one! ✓' : 'Shot saved'}</h2><div class="verdict ${good ? 'ok' : 'warn'}">${ic(good ? 'check' : 'drop')}<div><b>${rec.dose}g in → ${rec.yield}g out in ${rec.time}s</b><small>${advice(rec)}</small></div></div>
          ${good ? '<p>Everyone will see this recipe on Today.</p>' : `<p>Change the grinder a little, pull another shot, and log it.</p><div class="acts"><button class="btn pri lg" data-close data-act="shotNew" data-b="${b.id}">${ic('plus')} Log another shot</button></div>`}`;
      }
    });
  }
  function shotForm(s) {
    A.openForm({
      title: 'Change this shot', values: s,
      fields: [{ k: 'grind', label: 'Grinder number', req: true }, { k: 'dose', label: 'Coffee in (g)', type: 'number', min: 0, max: 40, req: true }, { k: 'yield', label: 'Coffee out (g)', type: 'number', min: 0, max: 120, req: true }, { k: 'time', label: 'Seconds', type: 'number', min: 0, max: 90, req: true }, { k: 'taste', label: 'Taste', type: 'chips', opts: ['Tastes good', 'Sour', 'Bitter', 'Watery', 'Not sure'] }, { k: 'keeper', label: 'Use this recipe today', type: 'check' }, { k: 'notes', label: 'Notes', full: true }],
      onSave(v) { A.upsert('dialins', { ...s, ...v }); }, del: { coll: 'dialins', id: s.id, label: 'Shot deleted' }
    });
  }
  const dialRows = () => [['When', 'Coffee', 'Grinder', 'In g', 'Out g', 'Ratio', 'Seconds', 'Taste', 'Used', 'Notes', 'By']].concat(A.D.dialins.slice().sort((a, b) => a.at < b.at ? -1 : 1).map(d => [C.fmtWhen(d.at, ''), d.beanName || '', d.grind, d.dose, d.yield, C.r2(ratio(d)), d.time, d.taste || '', d.keeper ? 'yes' : '', d.notes || '', d.by || '']));

  const milkState = m => { const d = C.daysBetween(today(), m.useBy); return d < 0 ? ['Past its date: throw out', 'bad', d] : d === 0 ? ['Use it today', 'warn', d] : d === 1 ? ['Use by tomorrow', 'warn', d] : ['Good for ' + d + ' more days', 'ok', d]; };
  const openMilks = () => A.D.milks.filter(m => m.status === 'open').sort((a, b) => a.useBy < b.useBy ? -1 : 1);
  const eqState = e => { if (!e.lastDone) return ['Not done yet', 'bad', -1]; const due = C.addDays(C.ymd(new Date(e.lastDone)), +e.everyDays || 1), d = C.daysBetween(today(), due); return d < 0 ? ['Late by ' + plural(-d, 'day'), 'bad', d] : d === 0 ? ['Due today', 'warn', d] : ['Next one ' + (d === 1 ? 'tomorrow' : 'in ' + d + ' days'), 'ok', d]; };
  const eqDueNow = e => { const s = eqState(e); return s[2] < 0 || (s[2] === 0 && (+e.everyDays > 1 || nowMin() >= closeM() - 90)); };
  function hero() {
    const bs = espBeans().filter(b => +b.count > 0 || shotsFor(b.id).length);
    const espCards = bs.map(b => { const s = current(b.id), dt = dialedToday(b); return `<div class="shot ${dt ? '' : 'stale'}"><small>${esc(b.name)}</small>${s ? `<div class="rec num">${s.dose}<i>g in</i> → ${s.yield}<i>g out</i></div><div class="meta"><span class="tag ${timeCls(s.time)}">${s.time} seconds</span><span class="tag mode">Grinder on ${esc(s.grind)}</span></div><p class="small">${dt ? 'Checked ' + C.fmtClock(Date.parse(s.at)) + (s.by ? ' by ' + esc(s.by) : '') : '<b>Not checked yet today.</b> Pull a test shot first.'}</p>` : '<p class="small" style="margin:.5rem 0">No shots logged yet.</p>'}<button class="btn ${dt ? '' : 'pri'}" data-act="shotNew" data-b="${b.id}">${ic('plus')} Log a test shot</button></div>`; }).join('');
    const ms = openMilks().filter(m => milkState(m)[2] <= 1), eq = A.D.equipment.filter(eqDueNow);
    return `<section class="barhero" aria-label="Bar check"><div class="bh"><div><small>Bar check</small><h3>Today's espresso</h3></div></div>
      <div class="bgrid">${espCards || `<div class="shot"><p>Add your espresso beans to start.</p><button class="btn pri" data-go="beans">Add beans</button></div>`}
      <div class="side2"><button class="mini ${ms.some(m => milkState(m)[1] === 'bad') ? 'bad' : ms.length ? 'warn' : 'ok'}" data-go="milk">${ic('milk')}<span><b>${ms.length ? plural(ms.length, 'milk') + ' to use or throw out' : 'Milk is all good'}</b><small>${ms.slice(0, 3).map(m => esc(m.kind) + ': ' + milkState(m)[0].toLowerCase()).join('<br>') || plural(openMilks().length, 'open carton')}</small></span></button>
      <button class="mini ${eq.some(e => eqState(e)[1] === 'bad') ? 'bad' : eq.length ? 'warn' : 'ok'}" data-go="equipment">${ic('wrench')}<span><b>${eq.length ? plural(eq.length, 'machine job') + ' to do' : 'Machines are clean'}</b><small>${eq.slice(0, 3).map(e => esc(e.name)).join('<br>')}</small></span></button></div></div></section>`;
  }
  A.register({
    id: 'dialin', title: 'Espresso check', short: 'Espresso', icon: 'drop',
    help: { what: 'Check the espresso tastes right before you serve it. This is called "dialing in".', steps: ['Pull a test shot. Weigh the coffee going in and the espresso coming out, and time it.', 'Tap <b>Log a test shot</b> and answer the questions.', 'The app says if it\'s too fast or too slow and what to change. When it\'s right, everyone sees the recipe on Today.'], tip: 'Do this every morning, and whenever you open a new bag of beans.' },
    status() { const n = espBeans().filter(b => +b.count > 0 && !dialedToday(b)).length; return { text: n ? 'Not checked yet today' : 'Checked today ✓', level: n && nowMin() >= openM() ? 'warn' : '' }; },
    todo() { return espBeans().filter(b => +b.count > 0 && !dialedToday(b)).map(b => nowMin() >= openM() - 60 ? { key: 'dial' + b.id, pri: 1, level: 'go', icon: 'drop', text: 'Check the espresso: ' + b.name, sub: 'Pull a test shot and log it. The app tells you if the grinder needs changing.', btn: 'Log a shot', act: 'shotNew', data: { b: b.id } } : null).filter(Boolean).concat(espBeans().some(dialedToday) ? [{ done: true, text: 'Espresso check' }] : []); },
    hero,
    render() {
      const days = ui.dRange == null ? 1 : ui.dRange, hist = A.D.dialins.filter(d => A.inRange(d.at, days)).sort((a, b) => a.at < b.at ? 1 : -1);
      return A.page({
        title: 'Espresso check', what: 'Pull a test shot, then log it. The app tells you what to change.',
        primary: `<button class="btn pri lg" data-act="shotNew">${ic('plus')} Log a test shot</button>`,
        more: [{ label: 'Spreadsheet of all shots', icon: 'download', act: 'dialCsv' }],
        body: hero() + A.past('Shots logged', `<div class="bar">${A.rangeSeg('dRange', 1)}</div><ul class="list">${hist.map(d => `<li><button class="row" data-act="shotEdit" data-id="${d.id}">${ic('drop')}<span class="grow"><b>${d.dose}g → ${d.yield}g in ${d.time}s</b>${d.keeper ? ' <span class="tag ok">used</span>' : ''}<small>${esc(d.beanName || '')} · grinder ${esc(d.grind)} · ${esc(d.taste || '')} · ${C.fmtWhen(d.at, today())}${d.by ? ' · ' + esc(d.by) : ''}</small></span></button></li>`).join('') || '<li class="row mute">None in this time.</li>'}</ul>`)
      });
    },
    acts: { shotNew: el => A.needWho(() => shotWizard(el.dataset.b)), shotEdit: el => shotForm(A.find('dialins', el.dataset.id)), dialCsv: () => A.csvDownload('espresso-shots', dialRows()) },
    csv: [['Espresso shots', () => ['espresso-shots', dialRows()]]]
  });

  /* ================= COFFEE BEANS ================= */
  const beanState = b => { if (!b.roastDate) return ['No roast date', '', null, '']; const d = C.daysBetween(b.roastDate, today()), s = S(); return [plural(d, 'day') + ' since roasting', d < s.beanRestDays ? 'warn' : d > s.beanPeakDays ? 'bad' : 'ok', d, d < s.beanRestDays ? 'Too fresh: wait a few days' : d > s.beanPeakDays ? 'Getting old: use it up' : 'Great to use']; };
  function beanForm(b) {
    const isNew = !b.id;
    A.openForm({
      title: isNew ? 'Add a coffee' : 'Change ' + b.name, values: { unit: '5 lb bags', cat: 'Espresso', count: 1, par: 2, ...b },
      fields: [{ k: 'name', label: 'Coffee name', req: true, full: true, ph: 'House espresso blend' }, { k: 'cat', label: 'Used for', type: 'chips', opts: ['Espresso', 'Drip', 'Decaf', 'Cold brew', 'To sell'] }, { k: 'roastDate', label: 'Roast date (printed on the bag)', type: 'date' },
        { k: 'count', label: 'Bags on the shelf', type: 'stepper', min: 0 }, { k: 'par', label: 'Keep at least', type: 'stepper', min: 0, hint: 'bags' }, { k: 'unit', label: 'Bag size', list: ['5 lb bags', '2 lb bags', '1 kg bags', '12 oz bags'] }, { k: 'supplierId', label: 'Roaster', type: 'select', blank: 'Not sure', opts: () => A.D.suppliers.map(s => [s.id, s.name]) }, { k: 'note', label: 'Tasting notes', full: true }],
      onSave(v) { if (v.roastDate && v.roastDate > today()) return 'The roast date is in the future. Check the bag.'; const rec = { ...b, ...v, kind: 'bean', par: +v.par || 0, count: +v.count || 0 }; if (v.count !== b.count) rec.countedAt = nowISO(); if (!C.isLow(rec)) rec.orderedAt = null; A.upsert('items', rec); },
      del: isNew ? null : { coll: 'items', id: b.id, label: b.name + ' removed' }
    });
  }
  A.register({
    id: 'beans', title: 'Coffee beans', short: 'Beans', icon: 'bean',
    help: { what: 'How fresh each coffee is, and how many bags are left.', steps: ['When you open a new bag, tap <b>New bag opened</b> and type the roast date from the bag.', 'Use + and − to keep the bag count right.', 'Green = great to use. Yellow = too fresh, wait. Red = getting old, use it up.'] },
    status() { const low = beans().filter(C.isLow).length, old = beans().filter(b => beanState(b)[1] === 'bad' && +b.count > 0).length; return { text: low ? plural(low, 'coffee') + ' running low' : old ? plural(old, 'coffee') + ' getting old' : beans().length ? 'All good' : 'None added', level: low || old ? 'warn' : '' }; },
    render() {
      const bs = beans().sort((a, b) => (a.cat || '').localeCompare(b.cat || '') || a.name.localeCompare(b.name));
      return A.page({
        title: 'Coffee beans', what: 'Opened a new bag? Tap New bag opened and type the roast date.',
        more: [{ label: 'Add a coffee', icon: 'plus', act: 'beanNew' }],
        body: bs.length ? `<div class="grid">${bs.map(b => { const [lab, cls, , word] = beanState(b); return `<div class="card"><h3>${ic('bean')} ${esc(b.name)}</h3><p class="small mute" style="margin:-.3rem 0 .6rem">${esc(b.cat || '')}</p>
            ${word ? `<p><span class="tag ${cls}">${esc(word)}</span> <span class="small">${esc(lab)}</span></p>` : '<p class="small mute">No roast date yet.</p>'}
            <div class="kv" style="align-items:center;margin-top:.5rem"><span>Bags on the shelf${C.isLow(b) ? ' <span class="tag warn">Low</span>' : ''}</span><span class="step big"><button data-act="cnt" data-id="${b.id}" data-d="-1" aria-label="One less bag">−</button><input type="number" min="0" step="any" value="${+b.count || 0}" data-change="cntSet" data-id="${b.id}" aria-label="${esc(b.name)} bags"><button data-act="cnt" data-id="${b.id}" data-d="1" aria-label="One more bag">+</button></span></div>
            <div class="cardacts"><button class="btn pri" data-act="beanRoast" data-id="${b.id}">${ic('plus')} New bag opened</button><button class="btn ghost" data-act="beanEdit" data-id="${b.id}">${ic('edit')} Change</button></div></div>`; }).join('')}</div>`
          : A.empty('No coffees added yet.', `<button class="btn pri lg" data-act="beanNew">${ic('plus')} Add a coffee</button>`)
      });
    },
    acts: {
      beanNew: () => beanForm({}), beanEdit: el => beanForm(A.find('items', el.dataset.id)),
      beanRoast: el => { const b = A.find('items', el.dataset.id); A.openForm({ title: 'New bag of ' + b.name, intro: 'Look on the bag for the roast date.', values: { roastDate: today() }, fields: [{ k: 'roastDate', label: 'Roast date on the bag', type: 'date', req: true }], saveLabel: 'Save', onSave(v) { if (v.roastDate > today()) return 'That date is in the future. Check the bag.'; b.roastDate = v.roastDate; A.upsert('items', b); A.toast('Got it. Remember to log a test shot with the new bag.', 5000); } }); }
    }
  });

  /* ================= OPENED MILK ================= */
  function milkForm(m) {
    A.openForm({
      title: m.id ? 'Change ' + m.kind : 'Opened milk', intro: 'If the date printed on the carton is sooner, use that date.', values: m,
      fields: [{ k: 'kind', label: 'Which milk', type: 'chips', opts: (S().milkTypes || []).map(t => t.name), req: true }, { k: 'openedAt', label: 'Opened at', type: 'datetime', req: true, past: true }, { k: 'useBy', label: 'Use by', type: 'date', req: true }],
      onSave(v) { if (v.useBy < C.ymd(new Date(v.openedAt))) return 'The use-by date is before it was opened.'; A.upsert('milks', { status: 'open', by: A.by(), ...m, ...v }); }, del: m.id ? { coll: 'milks', id: m.id, label: 'Removed' } : null
    });
  }
  A.register({
    id: 'milk', title: 'Opened milk', short: 'Milk', icon: 'milk',
    help: { what: 'Keeps track of when each milk carton was opened, so nothing old gets served.', steps: ['When you open a carton, tap its name at the top. The use-by date is filled in for you.', 'Red means past its date: throw it out and tap <b>Thrown out</b>.', 'When a carton is empty, tap <b>Used up</b>.'], tip: 'If the date printed on the carton is sooner, tap Change and use that date.' },
    status() { const ms = openMilks(), bad = ms.filter(m => milkState(m)[2] < 0).length, soon = ms.filter(m => milkState(m)[2] <= 1).length; return { text: bad ? plural(bad, 'milk') + ' past date!' : soon ? plural(soon, 'milk') + ' to use today/tomorrow' : plural(ms.length, 'open carton'), level: bad ? 'bad' : soon ? 'warn' : '' }; },
    todo() { return openMilks().filter(m => milkState(m)[2] < 0).map(m => ({ key: 'milk' + m.id, pri: 0, level: 'bad', icon: 'milk', text: `Throw out the ${m.kind.toLowerCase()} opened ${C.fmtDay(C.ymd(new Date(m.openedAt))).slice(0, 3)}`, sub: 'It\'s past its use-by date (' + C.fmtDay(m.useBy) + ').', btn: 'I threw it out', act: 'milkClose', data: { id: m.id, s: 'tossed' } })); },
    render() {
      const ms = openMilks(), closed = A.D.milks.filter(m => m.status !== 'open' && A.inRange(m.closedAt, 7)).sort((a, b) => a.closedAt < b.closedAt ? 1 : -1);
      return A.page({
        title: 'Opened milk', what: 'Just opened a carton? Tap which one.',
        more: [{ label: 'Opened one earlier', sub: 'Pick the time and date yourself', icon: 'clock', act: 'milkCustom' }, { label: 'Change the milk list', sub: 'Names and days they keep', icon: 'gear', act: 'milkTypes' }],
        body: `<div class="card" style="margin-bottom:1rem"><h3>${ic('plus')} I just opened…</h3><div class="chips big">${(S().milkTypes || []).map((t, i) => `<button data-act="milkOpen" data-i="${i}">${esc(t.name)}</button>`).join('')}</div></div>
          ${ms.length ? `<h3 class="sec">Open cartons (oldest first)</h3><ul class="list">${ms.map(m => { const [lab, cls] = milkState(m); return `<li class="row milkrow ${cls === 'bad' ? 'crit' : cls === 'warn' ? 'low' : ''}">${ic('milk')}<span class="grow"><b>${esc(m.kind)}</b> <span class="tag ${cls}">${esc(lab)}</span><small>Opened ${C.fmtWhen(m.openedAt, today())} · use by ${C.fmtDay(m.useBy)}</small></span><span class="rowacts">${cls === 'bad' ? `<button class="btn dark" data-act="milkClose" data-id="${m.id}" data-s="tossed">${ic('trash')} Thrown out</button>` : `<button class="btn" data-act="milkClose" data-id="${m.id}" data-s="used">Used up</button><button class="btn ghost" data-act="milkClose" data-id="${m.id}" data-s="tossed">Thrown out</button>`}<button class="ib" data-act="milkEdit" data-id="${m.id}" aria-label="Change">${ic('edit')}</button></span></li>`; }).join('')}</ul>` : `<div class="caught">${ic('check')}<div><b>No open cartons.</b><small>Tap a milk above when you open one.</small></div></div>`}
          ${closed.length ? A.past('Finished this week', `<ul class="list">${closed.map(m => `<li class="row"><span class="grow">${esc(m.kind)}<small>${m.status === 'tossed' ? 'Thrown out' : 'Used up'} ${C.fmtWhen(m.closedAt, today())}</small></span></li>`).join('')}</ul>`) : ''}
          ${A.legal('How many days milk keeps is your setting.', 'Follow the carton date, your supplier and local health rules, whichever is soonest.')}`
      });
    },
    acts: {
      milkOpen: el => A.needWho(() => { const t = S().milkTypes[+el.dataset.i]; const m = A.upsert('milks', { kind: t.name, openedAt: nowISO(), useBy: C.addDays(today(), +t.days || 7), status: 'open', by: A.by() }); A.render(); A.toast(`${t.name}: use by ${C.fmtDay(m.useBy)}.`, 7000, { label: 'Carton says sooner?', fn: () => milkForm(A.find('milks', m.id)) }); }),
      milkCustom: () => milkForm({ openedAt: nowISO(), useBy: C.addDays(today(), 7) }),
      milkEdit: el => milkForm(A.find('milks', el.dataset.id)),
      milkClose: el => { const m = A.find('milks', el.dataset.id); m.status = el.dataset.s; m.closedAt = nowISO(); A.upsert('milks', m); let w = null; if (m.status === 'tossed') w = A.upsert('waste', { item: m.kind, amount: 1, unit: 'cartons', reason: 'Milk past date', by: A.by(), at: nowISO() }); A.render(); A.toast(m.status === 'tossed' ? 'Thrown out, and written in the thrown-out log.' : 'Marked as used up.', 6000, { label: 'Undo', fn: () => { m.status = 'open'; delete m.closedAt; A.upsert('milks', m); if (w) A.remove('waste', w.id); A.render(); } }); },
      milkTypes: () => A.openForm({ title: 'Milk list', intro: 'One per line: the milk\'s name, then how many days it keeps once opened.', values: { t: (S().milkTypes || []).map(x => x.name + ', ' + x.days).join('\n') }, fields: [{ k: 't', label: 'Milks', type: 'textarea' }], onSave(v) { const l = v.t.split('\n').map(l => l.split(',')).filter(p => p[0].trim()).map(([n, d]) => ({ name: n.trim(), days: +d || 7 })); if (!l.length) return 'Add at least one milk.'; A.setSettings({ milkTypes: l }); } })
    }
  });

  /* ================= MACHINE CLEANING ================= */
  const every = n => +n === 1 ? 'Every day' : +n === 7 ? 'Every week' : 'Every ' + n + ' days';
  const eqRows = () => [['When', 'Job', 'By', 'Note']].concat(A.D.equipLogs.slice().sort((a, b) => a.at < b.at ? -1 : 1).map(l => [C.fmtWhen(l.at, ''), l.name, l.by || '', l.note || '']));
  function eqForm(e) {
    A.openForm({
      title: e.id ? 'Change this job' : 'Add a machine job', values: { everyDays: 1, ...e },
      fields: [{ k: 'name', label: 'The job', req: true, full: true, ph: 'Backflush the espresso machine' }, { k: 'everyDays', label: 'How often', type: 'chips', opts: [[1, 'Every day'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month'], [90, 'Every 3 months'], [180, 'Every 6 months']], req: true }, { k: 'note', label: 'How to do it', full: true }],
      onSave(v) { A.upsert('equipment', { ...e, ...v, everyDays: +v.everyDays || 1 }); }, del: e.id ? { coll: 'equipment', id: e.id, label: 'Job removed' } : null
    });
  }
  A.register({
    id: 'equipment', title: 'Machine cleaning', short: 'Machines', icon: 'wrench',
    help: { what: 'Cleaning jobs for the espresso machine, grinders, steam wands and ice machine.', steps: ['Jobs at the top are due now (red = late).', 'Do the job, then tap <b>Done</b>.', 'Not sure how? Tap "How?" under the job, or ask your shift lead.'] },
    status() { const n = A.D.equipment.filter(eqDueNow).length; return { text: n ? plural(n, 'job') + ' to do' : 'All clean ✓', level: A.D.equipment.some(e => eqState(e)[2] < 0) ? 'warn' : n ? 'warn' : '' }; },
    todo() { const due = A.D.equipment.filter(eqDueNow); return due.length ? [{ key: 'eq', pri: 2, level: 'go', icon: 'wrench', text: due.length === 1 ? due[0].name : 'Do ' + plural(due.length, 'machine cleaning job'), sub: due.length === 1 ? eqState(due[0])[0] : due.slice(0, 2).map(e => e.name).join(', ') + (due.length > 2 ? '…' : ''), btn: 'See jobs' }] : []; },
    render() {
      const list = A.D.equipment.slice().sort((a, b) => eqState(a)[2] - eqState(b)[2]), hist = A.D.equipLogs.filter(l => A.inRange(l.at, ui.eRange == null ? 7 : ui.eRange)).sort((a, b) => a.at < b.at ? 1 : -1);
      return A.page({
        title: 'Machine cleaning', what: 'Do the job, then tap Done.',
        more: [{ label: 'Add a machine job', icon: 'plus', act: 'eqNew' }, { label: 'Spreadsheet', icon: 'download', act: 'eqCsv' }],
        body: (list.length ? `<ul class="list">${list.map(e => { const [lab, cls] = eqState(e), now = eqDueNow(e); return `<li class="checkwrap"><div class="row ${cls === 'bad' ? 'crit' : now ? 'low' : ''}" style="flex-wrap:wrap">${ic('wrench')}<button class="grow link plain" data-act="eqEdit" data-id="${e.id}" style="min-width:12rem"><b>${esc(e.name)}</b><small>${every(e.everyDays)} · ${esc(lab)}${e.lastDone ? ' · last done ' + C.fmtWhen(e.lastDone, today()) : ''}</small></button><button class="btn ${now ? 'pri' : ''}" data-act="eqDone" data-id="${e.id}">${ic('check')} Done</button></div>${e.note ? `<details class="how"><summary>How?</summary><p>${esc(e.note)}</p></details>` : ''}</li>`; }).join('')}</ul>`
          : A.empty('No machine jobs yet.', `<button class="btn pri lg" data-act="eqNew">Add a job</button>`))
          + A.past('Who did what', `<div class="bar">${A.rangeSeg('eRange', 7)}</div><ul class="list">${hist.map(l => `<li class="row"><span class="grow">${esc(l.name)}<small>${C.fmtWhen(l.at, today())}${l.by ? ' · ' + esc(l.by) : ''}</small></span></li>`).join('') || '<li class="row mute">Nothing in this time.</li>'}</ul>`)
          + A.legal('How often is a starting point.', 'Follow the machine maker\'s instructions and your local health rules.')
      });
    },
    acts: {
      eqNew: () => eqForm({}), eqEdit: el => eqForm(A.find('equipment', el.dataset.id)), eqCsv: () => A.csvDownload('machine-cleaning', eqRows()),
      eqDone: el => A.needWho(() => { const e = A.find('equipment', el.dataset.id), prev = e.lastDone, t = nowISO(); const r = A.upsert('equipLogs', { equipId: e.id, name: e.name, by: A.by(), at: t }); e.lastDone = t; A.upsert('equipment', e); A.render(); A.toast('✓ ' + e.name + '. ' + eqState(e)[0] + '.', 6000, { label: 'Undo', fn: () => { A.remove('equipLogs', r.id); e.lastDone = prev; A.upsert('equipment', e); A.render(); } }); })
    },
    csv: [['Machine cleaning', () => ['machine-cleaning', eqRows()]]]
  });

  /* ================= PASTRY COUNTS ================= */
  const pcount = (date, itemId) => A.D.pastryCounts.find(c => c.date === date && c.itemId === itemId);
  const tomorrowFor = date => A.D.pastries.map(p => ({ p, s: C.bakeSuggestion(A.D.pastryCounts, p.id, C.addDays(date, 1), p.par) }));
  const basisText = (s, date) => s.basis === 'same' ? `about ${Math.round(s.avg)} sold on recent ${C.DNL[C.dow(C.addDays(date, 1))]}s${s.soldOut > s.n / 2 ? ', often sold out' : ''}` : s.basis === 'recent' ? `about ${Math.round(s.avg)} sold a day lately` : 'your usual amount';
  const missing = (date, f) => A.D.pastries.filter(p => { const c = pcount(date, p.id); return !c || c[f] === '' || c[f] == null; });
  const pastryRows = () => [['Date', 'Pastry', 'Came in', 'Left at close', 'Sold']].concat(A.D.pastryCounts.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(c => { const p = A.find('pastries', c.itemId) || {}; return [c.date, p.name || '', c.baked, c.left, c.baked !== '' && c.left !== '' ? Math.max(0, c.baked - c.left) : '']; }));
  A.register({
    id: 'pastry', title: 'Pastry counts', short: 'Pastry', icon: 'croissant',
    help: { what: 'Count pastries in the morning and what\'s left at closing. The app works out how many to order for tomorrow.', steps: ['Morning: type how many of each pastry came in.', 'Closing: type how many are left.', 'Tomorrow\'s order is worked out from what actually sold. Copy it or add it to the order list.'] },
    status() { const nm = nowMin(); if (nm >= closeM() - 60 && missing(today(), 'left').length) return { text: 'Count what\'s left', level: 'warn' }; if (missing(today(), 'baked').length) return { text: 'Count what came in', level: nm >= openM() ? 'warn' : '' }; return { text: 'Counted today ✓' }; },
    todo() {
      if (!A.D.pastries.length) return []; const nm = nowMin(), out = [];
      if (missing(today(), 'baked').length && nm >= openM() - 120 && nm < closeM() - 60) out.push({ key: 'pin', pri: 2, level: 'go', icon: 'croissant', text: 'Count the pastries that came in', sub: plural(missing(today(), 'baked').length, 'pastry', 'pastries') + ' to count.', btn: 'Count', act: 'paStep', data: { f: 'baked' } });
      if (nm >= closeM() - 60) { if (missing(today(), 'left').length) out.push({ key: 'pleft', pri: 1, level: 'go', icon: 'croissant', text: 'Count the leftover pastries', sub: 'This decides how many to order for tomorrow.', btn: 'Count', act: 'paStep', data: { f: 'left' } }); else out.push({ done: true, text: 'Pastry count' }); }
      return out;
    },
    render() {
      const date = ui.paDate || today(), t = tomorrowFor(date), f = nowMin() >= closeM() - 90 ? 'left' : 'baked';
      return A.page({
        title: 'Pastry counts', what: f === 'left' ? 'Closing time: type how many of each are left.' : 'Morning: type how many of each came in.',
        primary: `<button class="btn pri lg" data-act="paStep" data-f="${f}">${ic('croissant')} ${f === 'left' ? 'Count what\'s left' : 'Count what came in'}</button>`,
        more: [{ label: 'Add a pastry', icon: 'plus', act: 'paNew' }, { label: 'See yesterday', icon: 'left', act: 'paDay', data: { d: -1 } }, { label: 'Spreadsheet', icon: 'download', act: 'paCsv' }],
        body: (date !== today() ? `<div class="note warn">${ic('calendar')}<div class="grow"><b>You're looking at ${C.fmtDay(date)}.</b><button class="link" data-act="paDay" data-d="0">Back to today</button></div></div>` : '')
          + (A.D.pastries.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Pastry</th><th class="n">Came in</th><th class="n">Left at close</th><th class="n">Sold</th></tr>${A.D.pastries.map(p => { const c = pcount(date, p.id) || {}; const sold = c.baked !== '' && c.baked != null && c.left !== '' && c.left != null ? Math.max(0, c.baked - c.left) : ''; return `<tr><td><button class="link plain" data-act="paEdit" data-id="${p.id}">${esc(p.name)}</button></td><td class="n"><input type="number" min="0" step="1" value="${c.baked ?? ''}" data-change="paSet" data-id="${p.id}" data-f="baked" class="cellin" aria-label="${esc(p.name)} came in"></td><td class="n"><input type="number" min="0" step="1" value="${c.left ?? ''}" data-change="paSet" data-id="${p.id}" data-f="left" class="cellin" aria-label="${esc(p.name)} left"></td><td class="n"><b>${sold}</b>${c.left === 0 ? ' <span class="tag warn">sold out</span>' : ''}</td></tr>`; }).join('')}</table></div>
          <h3 class="sec">Order for ${C.fmtDay(C.addDays(date, 1))}</h3>
          <div class="grid">${t.map(({ p, s }) => `<div class="card" style="display:flex;align-items:center;gap:1rem"><div class="big">${s.qty}</div><div><b>${esc(p.name)}</b><small class="mute" style="display:block">Because: ${esc(basisText(s, date))}</small></div></div>`).join('')}</div>
          <div class="cardacts" style="margin-top:1rem"><button class="btn pri" data-act="paOrder">${ic('truck')} Add to order list</button><button class="btn" data-act="paCopy">${ic('copy')} Copy the list</button></div>`
          : A.empty('Add the pastries you sell.', `<button class="btn pri lg" data-act="paNew">${ic('plus')} Add a pastry</button>`))
      });
    },
    acts: {
      paStep: el => { const f = el.dataset.f, date = today(); A.wizard({ title: f === 'left' ? 'Count what\'s left' : 'Count what came in', doneLabel: 'Save counts', steps: A.D.pastries.map(p => ({ k: p.id, q: `${p.name}: how many ${f === 'left' ? 'are left' : 'came in'}?`, hint: f === 'left' ? 'Count what\'s still in the case. 0 if sold out.' : `Usually about ${p.par}.`, type: 'number', max: 999, def: (pcount(date, p.id) || {})[f] ?? '' })), onDone(v) { for (const p of A.D.pastries) { const c = pcount(date, p.id) || { date, itemId: p.id, baked: '', left: '' }; c[f] = v[p.id] === '' ? '' : Math.round(+v[p.id]); A.upsert('pastryCounts', c); } A.toast('Counts saved. Thanks!'); return ''; } }); },
      paDay: el => { const d = +el.dataset.d; ui.paDate = d ? C.addDays(ui.paDate || today(), d) : null; if (ui.paDate && ui.paDate >= today()) ui.paDate = null; A.render(); },
      paSet: el => { const date = ui.paDate || today(); const c = pcount(date, el.dataset.id) || { date, itemId: el.dataset.id, baked: '', left: '' }; c[el.dataset.f] = el.value === '' ? '' : Math.max(0, Math.round(+el.value)); if (c.left !== '' && c.baked !== '' && c.left > c.baked) A.toast('More left than came in? Check the numbers.', 5000); A.upsert('pastryCounts', c); A.render(); },
      paNew: () => A.openForm({ title: 'Add a pastry', values: { par: 10 }, fields: [{ k: 'name', label: 'Name', req: true, full: true }, { k: 'par', label: 'How many you usually get', type: 'stepper', min: 0 }], onSave(v) { A.upsert('pastries', { ...v, par: +v.par || 0 }); } }),
      paEdit: el => { const p = A.find('pastries', el.dataset.id); A.openForm({ title: 'Change ' + p.name, values: p, fields: [{ k: 'name', label: 'Name', req: true, full: true }, { k: 'par', label: 'How many you usually get', type: 'stepper', min: 0 }], onSave(v) { A.upsert('pastries', { ...p, ...v, par: +v.par || 0 }); }, del: { coll: 'pastries', id: p.id, label: p.name + ' removed' } }); },
      paCsv: () => A.csvDownload('pastry-counts', pastryRows()),
      paCopy: () => { const date = ui.paDate || today(); const txt = `Pastry order for ${C.fmtDay(C.addDays(date, 1))} (${S().shopName}):\n` + tomorrowFor(date).map(({ p, s }) => `- ${p.name}: ${s.qty}`).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => A.toast('Copied. Paste it into a text or email to the bakery.'), () => A.toast('Copying is blocked here.')); },
      paOrder: () => { const date = ui.paDate || today(), sup = A.D.suppliers.find(s => /bak/i.test(s.name)); let n = 0; for (const { p, s } of tomorrowFor(date)) { const src = 'Pastry for ' + C.fmtDay(C.addDays(date, 1)); if (A.D.orders.some(o => o.source === src && o.name === p.name)) continue; A.D.orders.push({ id: C.uid(), name: p.name, qty: s.qty, unit: 'each', supplierId: sup ? sup.id : '', source: src, updatedAt: nowISO() }); n++; } A.save('orders'); A.toast(n ? plural(n, 'pastry', 'pastries') + ' added to What to order.' : 'Already on the order list.', 5000, { label: 'Open it', fn: () => A.go('orders') }); }
    },
    csv: [['Pastry counts', () => ['pastry-counts', pastryRows()]]]
  });

  /* ================= COUNT LIST ================= */
  A.stockModule({ id: 'stock', title: 'Count supplies', short: 'Stock', icon: 'box', countWord: 'supplies', kinds: ['ingredient', 'supply'], cats: ['Milk & alt-milk', 'Syrups & sauces', 'Tea & other', 'Cups & lids', 'Counter', 'Cleaning', 'Other'], what: 'Count milk, syrups, cups, lids and cleaning supplies. (Beans have their own page.)' });
})();
