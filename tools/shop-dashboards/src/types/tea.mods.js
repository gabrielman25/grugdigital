/* ==========================================================================
   Tea & Boba tools: pearl & tea timers (the big card on Today), toppings to make, seasonal drinks,
   and the two count lists (ingredients; cups & straws).
   ========================================================================== */
(() => {
  'use strict';
  const A = App, C = A.C, esc = A.esc, ic = A.ic, ui = A.ui, S = () => A.D.settings, today = A.today, nowISO = A.nowISO, nowMin = A.nowMin;
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
  const openM = () => C.toMin(S().openAt || A.T.hours[0]), closeM = () => { const c = C.toMin(S().closeAt || A.T.hours[1]); return c <= openM() ? c + 1440 : c; };

  /* ================= PEARL & TEA TIMERS ================= */
  const activePearls = () => A.D.pearlBatches.filter(b => !b.endedAt).sort((a, b) => a.startedAt < b.startedAt ? -1 : 1);
  const activeTeas = () => A.D.teaBatches.filter(b => !b.endedAt).sort((a, b) => a.startedAt < b.startedAt ? -1 : 1);
  const pearlLabel = b => `Pearls #${b.no || 1}${b.kind && b.kind !== 'Tapioca pearls' ? ' · ' + b.kind : ''}`;
  const teaLabel = b => b.kind;
  const stateOf = b => C.batchState(b, Date.now(), +S().warnMin || 0);
  const PHASE = { cooking: ['Cooking', 'mode'], holding: ['Ready to use', 'ok'], soon: ['Throw out soon', 'warn'], expired: ['Throw out now', 'bad'] };

  function pearlBig(b) {
    const st = stateOf(b), tx = A.timerText(st);
    const span = Math.max(1, st.discardAt - st.start), cookW = (st.cookEnd - st.start) / span * 100, nowP = Math.max(0, Math.min(1, (Date.now() - st.start) / span)) * 100;
    const [pl, pc] = PHASE[st.phase];
    return `<div class="tmr pbig ${st.phase}" data-tmr="pearlBatches:${b.id}" data-phase="${st.phase}">
      <div class="ring">${A.ringSvg(st.phase === 'cooking' ? st.pct : 1 - (st.pct == null ? 1 : st.pct))}<div class="mid">${ic(st.phase === 'cooking' ? 'flame' : 'pearl')}</div></div>
      <div class="info"><div class="name"><span class="tag ${pc}">${pl}</span> ${esc(pearlLabel(b))}</div>
        <div class="cd">${esc(tx.cd)}</div><div class="by">${esc(tx.sub)}</div>
        <div class="life" aria-hidden="true"><i class="ck" style="width:${cookW}%"></i><i class="hd" style="left:${cookW}%;right:0"></i><b data-now style="left:${nowP}%"></b></div>
        <div class="lifel"><span>Started ${C.fmtClock(st.start)}</span><span>Ready ${C.fmtClock(st.cookEnd)}</span><span>Throw out ${C.fmtClock(st.discardAt)}</span></div>
        <div class="acts">${st.phase === 'expired' ? `<button class="btn lg" data-act="bDiscard" data-c="pearlBatches" data-id="${b.id}">${ic('trash')} I threw them out</button>${b.silenced ? '' : `<button class="btn dark" data-act="bSilence" data-c="pearlBatches" data-id="${b.id}">${ic('mute')} Stop the beeping</button>`}`
          : `<button class="btn" data-act="bUsed" data-c="pearlBatches" data-id="${b.id}">${ic('check')} All used up</button><button class="btn ghost" data-act="bMore" data-c="pearlBatches" data-id="${b.id}">${ic('more')} More</button>`}</div></div></div>`;
  }
  const teaActs = b => st => st.phase === 'expired'
    ? `<button class="btn sm" data-act="bDiscard" data-c="teaBatches" data-id="${b.id}">${ic('trash')} Thrown out</button>${b.silenced ? '' : `<button class="btn sm dark" data-act="bSilence" data-c="teaBatches" data-id="${b.id}" aria-label="Stop the beeping">${ic('mute')}</button>`}`
    : `<button class="btn sm" data-act="bUsed" data-c="teaBatches" data-id="${b.id}">All used</button><button class="btn sm ghost" data-act="bMore" data-c="teaBatches" data-id="${b.id}" aria-label="More">${ic('more')}</button>`;

  function hero() {
    const ps = activePearls(), ts = activeTeas(), s = S();
    const teaBtns = (s.teaTypes || []).map((t, i) => `<button class="btn" data-act="teaBrew" data-i="${i}">${ic('plus')} ${esc(t.name)}</button>`).join('');
    return `<section class="pearlhero" aria-label="Pearl timer">
      <div class="phh"><div class="pearls" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="t"><small>Pearl timer</small><h3>${ps.length ? (ps.length === 1 ? '1 pot of pearls' : ps.length + ' pots of pearls') : 'No pearls yet'}</h3><p>${ps.length ? 'Just put more pearls in the pot? Tap the button.' : 'Put pearls in the pot, then tap the button. The app tells you when they\'re ready and when to throw them out.'}</p></div>
        <div class="phb"><button class="btn lg dark" data-act="pearlStart">${ic('pearl')} I just started pearls</button></div></div>
      ${ps.length ? `<div class="pgrid">${ps.map(pearlBig).join('')}</div>` : ''}
      <div class="teas"><div class="teah"><b>${ic('leaf')} Brewed tea</b><span class="mute small">Just brewed one? Tap it:</span></div><div class="teabtns">${teaBtns}<button class="btn ghost" data-act="teaCustom">Other…</button></div>
        ${ts.length ? `<div class="timers" style="margin-top:.9rem">${ts.map(b => A.timerCard({ coll: 'teaBatches', b, label: teaLabel(b), icon: 'leaf' }, { actions: teaActs(b) })).join('')}</div>` : ''}
      </div></section>`;
  }

  function batchForm(coll, b) {
    const isPearl = coll === 'pearlBatches', isNew = !b.id, s = S();
    const v = isNew ? (isPearl ? { kind: s.pearlKind, size: s.pearlSize, cookMin: s.pearlCookMin, holdMin: s.pearlHoldMin, startedAt: nowISO() } : { kind: (s.teaTypes[0] || {}).name, cookMin: 0, holdMin: (s.teaTypes[0] || {}).holdMin || 240, startedAt: nowISO() }) : b;
    A.openForm({
      title: isNew ? (isPearl ? 'Pearls started earlier' : 'Add a tea') : 'Change ' + (isPearl ? pearlLabel(b) : teaLabel(b)),
      intro: isPearl ? 'Forgot to tap the button? Set the time they went in the pot.' : 'Set what you brewed and when.', values: v,
      fields: [{ k: 'kind', label: isPearl ? 'Kind of pearls' : 'Which tea', list: isPearl ? ['Tapioca pearls', 'Brown sugar pearls', 'Mini pearls', 'Crystal boba'] : (s.teaTypes || []).map(t => t.name), req: true },
        { k: 'startedAt', label: isPearl ? 'Went in the pot at' : 'Brewed at', type: 'datetime', req: true, past: true }].concat(isPearl ? [{ k: 'cookMin', label: 'Cooking time', type: 'stepper', min: 0, step: 5, unit: 'min' }] : [])
        .concat([{ k: 'holdMin', label: isPearl ? 'Good for, once cooked' : 'Good for', type: 'stepper', min: 15, step: 15, unit: 'min', req: true, hint: '240 min = 4 hours' }]),
      onSave(x) {
        const rec = { ...b, ...x, cookMin: isPearl ? +x.cookMin || 0 : 0, holdMin: +x.holdMin, by: b.by || A.by() };
        if (isNew && isPearl) rec.no = A.D.pearlBatches.filter(p => C.ymd(new Date(p.startedAt)) === C.ymd(new Date(x.startedAt))).length + 1;
        delete rec.warned; delete rec.silenced; A.upsert(coll, rec); A.toast('Saved. Throw out at ' + C.fmtClock(C.batchState(rec).discardAt) + '.');
      },
      del: isNew ? null : { coll, id: b.id, label: 'Timer deleted' }
    });
  }
  function endBatch(coll, id, outcome) {
    const b = A.find(coll, id); b.endedAt = nowISO(); b.outcome = outcome; A.upsert(coll, b);
    if (outcome === 'discarded') A.upsert('waste', { item: coll === 'pearlBatches' ? (b.kind || 'Tapioca pearls') : 'Brewed ' + b.kind.toLowerCase(), amount: 1, unit: 'batches', reason: coll === 'pearlBatches' ? 'Pearls expired' : 'Tea expired', by: A.by(), at: nowISO(), note: 'Started ' + C.fmtClock(Date.parse(b.startedAt)) });
    A.render();
    A.toast(outcome === 'discarded' ? 'Thrown out, and written in the thrown-out log. Thanks!' : 'Marked as used up.', 6000, { label: 'Undo', fn: () => { delete b.endedAt; delete b.outcome; A.upsert(coll, b); if (outcome === 'discarded') { const w = A.D.waste[A.D.waste.length - 1]; if (w) A.remove('waste', w.id); } A.render(); } });
  }
  function timerSettings() {
    const s = S();
    A.openForm({
      title: 'Timer settings', intro: 'Use the times your recipe and your local health rules say.', values: { ...s, teaTypesText: (s.teaTypes || []).map(t => t.name + ', ' + t.holdMin).join('\n') },
      fields: [{ k: 'pearlCookMin', label: 'Pearls: cooking time', type: 'stepper', min: 0, step: 5, unit: 'min' }, { k: 'pearlHoldMin', label: 'Pearls: good for, once cooked', type: 'stepper', min: 15, step: 15, unit: 'min', hint: '240 min = 4 hours' },
        { k: 'warnMin', label: 'Warn me this long before', type: 'stepper', min: 0, step: 5, unit: 'min' }, { k: 'sound', label: 'Beep when something needs throwing out', type: 'check' }, { k: 'teaTypesText', label: 'Teas, and minutes each is good for (one per line)', type: 'textarea', ph: 'Black tea, 240\nJasmine green, 240' }],
      onSave(v) {
        const teaTypes = v.teaTypesText.split('\n').map(l => l.split(',')).filter(p => p[0].trim()).map(([n, h]) => ({ name: n.trim(), holdMin: +h || 240 }));
        if (!teaTypes.length) return 'Add at least one tea.';
        A.setSettings({ pearlCookMin: +v.pearlCookMin || 0, pearlHoldMin: +v.pearlHoldMin || 240, warnMin: +v.warnMin || 0, sound: v.sound, teaTypes });
      }
    });
  }
  const batchRows = () => [['Type', 'Kind', 'Started', 'Cook min', 'Good for min', 'Throw out at', 'Ended', 'What happened', 'By']].concat(
    [...A.D.pearlBatches.map(b => ['Pearls', b]), ...A.D.teaBatches.map(b => ['Tea', b])].sort((a, b) => a[1].startedAt < b[1].startedAt ? -1 : 1).map(([t, b]) => { const st = C.batchState(b, Date.now()); return [t, b.kind, C.fmtWhen(b.startedAt, ''), b.cookMin || 0, b.holdMin, C.fmtClock(st.discardAt), b.endedAt ? C.fmtWhen(b.endedAt, '') : '', b.outcome === 'discarded' ? 'thrown out' : b.outcome === 'used' ? 'used up' : 'still going', b.by || '']; }));

  A.register({
    id: 'batches', title: 'Pearl & tea timers', short: 'Timers', icon: 'pearl',
    help: { what: 'Times your pearls and teas, and tells you when to throw them out.', steps: ['When pearls go in the pot, tap <b>I just started pearls</b>. When you brew tea, tap the tea\'s name.', 'Watch the countdown. Yellow = throw out soon. Red + beeping = throw it out now.', 'When it\'s gone, tap <b>All used up</b> or <b>I threw them out</b>.'], tip: 'The timer keeps going even if you close the app or the tablet goes to sleep.' },
    timers: () => activePearls().map(b => ({ coll: 'pearlBatches', b, label: pearlLabel(b), icon: 'pearl' })).concat(activeTeas().map(b => ({ coll: 'teaBatches', b, label: teaLabel(b), icon: 'leaf' }))),
    status() { const all = [...activePearls(), ...activeTeas()], ex = all.filter(b => stateOf(b).phase === 'expired'); if (ex.length) return { text: plural(ex.length, 'batch', 'batches') + ' to throw out!', level: 'bad' }; const ps = activePearls(); if (!ps.length) return { text: 'No pearls going' }; return { text: 'Next throw-out ' + C.fmtClock(Math.min(...all.map(b => stateOf(b).discardAt))) }; },
    todo() {
      const out = [], nm = nowMin();
      for (const [coll, b, lab] of [...activePearls().map(b => ['pearlBatches', b, pearlLabel(b)]), ...activeTeas().map(b => ['teaBatches', b, teaLabel(b)])]) {
        const st = stateOf(b);
        if (st.phase === 'expired') out.push({ key: 'ex' + b.id, pri: 0, level: 'bad', icon: coll === 'pearlBatches' ? 'pearl' : 'leaf', text: `Throw out ${lab} now`, sub: `It was only good until ${C.fmtClock(st.discardAt)}.`, btn: 'I threw it out', act: 'bDiscard', data: { c: coll, id: b.id } });
        else if (st.phase === 'soon') out.push({ key: 'soon' + b.id, pri: 0, level: 'warn', icon: coll === 'pearlBatches' ? 'pearl' : 'leaf', text: `${lab}: throw out at ${C.fmtClock(st.discardAt)}`, sub: 'Start a fresh batch soon so you don\'t run out.', btn: 'See timers' });
      }
      const goodPearls = activePearls().filter(b => ['cooking', 'holding'].includes(stateOf(b).phase));
      if (!goodPearls.length && nm >= openM() - 60 && nm < closeM() - 60) out.push({ key: 'start', pri: 1, level: 'go', icon: 'pearl', text: 'Start cooking pearls', sub: 'There are no good pearls right now. Put some in the pot, then tap the button.', btn: 'I started pearls', act: 'pearlStart' });
      return out;
    },
    hero,
    render() {
      const days = ui.bRange == null ? 1 : ui.bRange;
      const past = [...A.D.pearlBatches.map(b => ['pearlBatches', b]), ...A.D.teaBatches.map(b => ['teaBatches', b])].filter(([, b]) => b.endedAt && A.inRange(b.startedAt, days)).sort((a, b) => a[1].startedAt < b[1].startedAt ? 1 : -1);
      return A.page({
        title: 'Pearl & tea timers', what: 'Tap when pearls go in the pot or tea is brewed. The app tells you when to throw them out.',
        more: [{ label: 'Pearls started earlier', sub: 'Forgot to tap the button? Set the time.', icon: 'clock', act: 'pearlCustom' }, { label: 'Timer settings', sub: 'Cooking time, how long things are good for, teas', icon: 'gear', act: 'timerSettings' }, { label: 'Spreadsheet of batches', icon: 'download', act: 'batchCsv' }],
        body: hero() + A.past('Finished batches', `<div class="bar">${A.rangeSeg('bRange', 1)}</div><ul class="list">${past.map(([c, b]) => { const st = C.batchState({ ...b, endedAt: null }, 0); return `<li class="row">${ic(c === 'pearlBatches' ? 'pearl' : 'leaf')}<span class="grow"><b>${esc(c === 'pearlBatches' ? pearlLabel(b) : teaLabel(b))}</b><small>Started ${C.fmtWhen(b.startedAt, today())} · good until ${C.fmtClock(st.discardAt)} · ${b.outcome === 'discarded' ? 'thrown out' : 'used up'} ${C.fmtClock(Date.parse(b.endedAt))}</small></span></li>`; }).join('') || '<li class="row mute">None in this time.</li>'}</ul>`)
          + A.legal('The times are your settings, not a food-safety rule.', 'Use what your recipe and local health rules say. The timer reminds you; a person still has to throw it out.')
      });
    },
    acts: {
      pearlStart: () => {
        A.Sound.unlock(); const s = S();
        const recent = activePearls().find(b => Date.now() - Date.parse(b.startedAt) < 3 * 6e4);
        const go = () => { const no = A.D.pearlBatches.filter(p => C.ymd(new Date(p.startedAt)) === today()).length + 1; const b = A.upsert('pearlBatches', { kind: s.pearlKind, size: s.pearlSize, startedAt: nowISO(), cookMin: +s.pearlCookMin || 0, holdMin: +s.pearlHoldMin || 240, by: A.by(), no }); A.render(); A.toast(`Timer started. Ready at ${C.fmtClock(C.batchState(b).cookEnd)}, throw out at ${C.fmtClock(C.batchState(b).discardAt)}.`, 7000, { label: 'Undo', fn: () => { A.remove('pearlBatches', b.id); A.render(); } }); };
        if (recent) A.confirmBox({ title: 'Start another pot?', body: `You started ${pearlLabel(recent)} ${C.fmtDur(Date.now() - Date.parse(recent.startedAt), true)} ago. Did you really start a second pot?`, ok: 'Yes, a second pot' }).then(y => y && go()); else go();
      },
      pearlCustom: () => batchForm('pearlBatches', {}),
      teaBrew: el => { A.Sound.unlock(); const t = S().teaTypes[+el.dataset.i]; const b = A.upsert('teaBatches', { kind: t.name, startedAt: nowISO(), cookMin: 0, holdMin: +t.holdMin || 240, by: A.by() }); A.render(); A.toast(`${t.name} timer started. Throw out at ${C.fmtClock(C.batchState(b).discardAt)}.`, 7000, { label: 'Undo', fn: () => { A.remove('teaBatches', b.id); A.render(); } }); },
      teaCustom: () => batchForm('teaBatches', {}),
      bMore: el => { const c = el.dataset.c, id = el.dataset.id; A.modal(`<h2>${esc(c === 'pearlBatches' ? pearlLabel(A.find(c, id)) : teaLabel(A.find(c, id)))}<span class="sp"></span>${A.xBtn}</h2><div class="menu"><button class="row" data-close data-act="bDiscard" data-c="${c}" data-id="${id}">${ic('trash')}<span class="grow"><b>Threw it out early</b><small>e.g. it got dropped or went bad</small></span></button><button class="row" data-close data-act="bEdit" data-c="${c}" data-id="${id}">${ic('edit')}<span class="grow"><b>Fix the start time</b></span></button></div>`).querySelector('[data-x]').onclick = () => A.closeModal(); },
      bEdit: el => batchForm(el.dataset.c, A.find(el.dataset.c, el.dataset.id)),
      bUsed: el => endBatch(el.dataset.c, el.dataset.id, 'used'),
      bDiscard: el => endBatch(el.dataset.c, el.dataset.id, 'discarded'),
      bSilence: el => { const b = A.find(el.dataset.c, el.dataset.id); b.silenced = nowISO(); A.upsert(el.dataset.c, b); A.render(); A.toast('Beeping stopped. It stays red until you tap I threw it out.'); },
      timerSettings, batchCsv: () => A.csvDownload('pearl-and-tea-batches', batchRows())
    },
    csv: [['Pearl & tea batches', () => ['pearl-and-tea-batches', batchRows()]]]
  });

  /* ================= TOPPINGS TO MAKE (prep) ================= */
  const prepRun = date => A.D.prepRuns.find(r => r.date === date);
  const prepLeft = () => { const r = prepRun(today()); return A.D.prepItems.filter(p => !(r && r.done[p.id])); };
  function prepItemForm(p) {
    A.openForm({
      title: p.id ? 'Change ' + p.name : 'Add something to make', values: { amount: 1, ...p },
      fields: [{ k: 'name', label: 'What', req: true, full: true, ph: 'Lychee jelly' }, { k: 'group', label: 'Group', type: 'chips', opts: ['Jellies', 'Popping boba', 'Fruit', 'Syrups', 'Cream & foam', 'Puddings & pastes', 'Other'] }, { k: 'amount', label: 'Make this much each day', type: 'stepper', min: 0 }, { k: 'unit', label: 'Unit', list: A.T.units, ph: 'qt' }, { k: 'note', label: 'How to make it, or how long it keeps', full: true }],
      onSave(v) { A.upsert('prepItems', { ...p, ...v }); }, del: p.id ? { coll: 'prepItems', id: p.id, label: p.name + ' removed' } : null
    });
  }
  A.register({
    id: 'prep', title: 'Toppings to make', short: 'Toppings', icon: 'jar',
    help: { what: 'Today\'s list of toppings, syrups and foams to make, and how much.', steps: ['Make each thing on the list.', 'When it\'s made and in the fridge, tap it to tick it off.', 'Tap "How?" if you\'re not sure how to make it.'] },
    status() { const n = prepLeft().length; return { text: !A.D.prepItems.length ? 'Nothing on the list' : n ? n + ' left to make' : 'All made today ✓' }; },
    todo() { if (!A.D.prepItems.length) return []; const n = prepLeft().length; if (!n) return [{ done: true, text: 'Toppings' }]; return nowMin() >= openM() - 120 && nowMin() < closeM() - 120 ? [{ key: 'prep', pri: 2, level: 'go', text: 'Make today\'s toppings', sub: `${n} of ${A.D.prepItems.length} left: ${prepLeft().slice(0, 3).map(p => p.name.toLowerCase()).join(', ')}${n > 3 ? '…' : ''}`, btn: n < A.D.prepItems.length ? 'Keep going' : 'Start' }] : []; },
    render() {
      const date = today(), r = prepRun(date), g = {}; for (const p of A.D.prepItems) (g[p.group || 'Other'] = g[p.group || 'Other'] || []).push(p);
      const n = A.D.prepItems.length, done = n - prepLeft().length;
      return A.page({
        title: 'Toppings to make', what: 'Make it, put it in the fridge, then tap it.',
        more: [{ label: 'Add something to make', icon: 'plus', act: 'prAdd' }, { label: 'Change the list', sub: 'Tap an item\'s pencil to change it', icon: 'edit', act: 'prEditMode' }, { label: 'Print the list', icon: 'print', act: 'print' }],
        body: n ? `<div class="card listcard" style="margin-bottom:1rem"><div class="lh"><div class="prog" style="flex:1"><i style="width:${done / n * 100}%"></i></div><b class="num">${done} of ${n} made</b></div></div>
          ${done === n ? `<div class="caught">${ic('party')}<div><b>Everything is made!</b><small>Nice work.</small></div></div>` : ''}
          <div class="grid g2">${Object.entries(g).map(([grp, items]) => `<div class="card"><h3>${esc(grp)}</h3>${items.map(p => { const d = r && r.done[p.id]; return `<div class="checkwrap"><div style="display:flex;align-items:center"><button class="check ${d ? 'on' : ''}" data-act="prToggle" data-id="${p.id}"><span class="box">${ic('check')}</span><span class="lbl grow"><b>${esc(p.name)}</b> · ${esc(p.amount)} ${esc(p.unit || '')}${d ? `<small>Made ${C.fmtClock(Date.parse(d.at))}${d.by ? ' by ' + esc(d.by) : ''}</small>` : ''}</span></button>${ui.prEdit ? `<button class="ib" data-act="prEdit" data-id="${p.id}" aria-label="Change ${esc(p.name)}">${ic('edit')}</button>` : ''}</div>${p.note && !d ? `<details class="how"><summary>How?</summary><p>${esc(p.note)}</p></details>` : ''}</div>`; }).join('')}</div>`).join('')}</div>
          ${ui.prEdit ? `<div class="savebar"><button class="btn pri lg" data-act="prEditMode">${ic('check')} Done changing</button></div>` : ''}`
          : A.empty('Nothing on the list yet.', `<button class="btn pri lg" data-act="prAdd">${ic('plus')} Add something to make</button>`)
      });
    },
    acts: {
      prToggle: el => A.needWho(() => { const date = today(); let r = prepRun(date) || { date, done: {} }; const p = A.find('prepItems', el.dataset.id); if (r.done[p.id]) delete r.done[p.id]; else r.done[p.id] = { at: nowISO(), by: A.by(), amount: p.amount }; A.upsert('prepRuns', r); A.render(); }),
      prAdd: () => prepItemForm({}), prEdit: el => prepItemForm(A.find('prepItems', el.dataset.id)), prEditMode: () => { ui.prEdit = !ui.prEdit; A.render(); }
    }
  });

  /* ================= SEASONAL DRINKS ================= */
  const parseIng = s => String(s || '').split('\n').map(l => l.split(',').map(x => x.trim())).filter(p => p[0]).map(([name, qty, unit]) => ({ name, qty: qty || '', unit: unit || '' }));
  const seasonStatus = x => { const t = today(); if (x.end && x.end < t) return ['Finished', '', 0]; if (x.start && x.start > t) { const d = C.daysBetween(t, x.start); return ['Starts in ' + plural(d, 'day'), d <= 7 ? 'warn' : '', 1]; } const left = x.end ? C.daysBetween(t, x.end) : null; return [left == null ? 'On the menu now' : left === 0 ? 'Last day today' : 'On the menu · ends in ' + plural(left, 'day'), left != null && left <= 3 ? 'warn' : 'ok', 2]; };
  const ordered = x => A.D.orders.some(o => o.source === 'Seasonal: ' + x.name);
  function seasonForm(x) {
    A.openForm({
      title: x.id ? 'Change ' + x.name : 'Add a seasonal drink', values: x, cls: 'wide',
      fields: [{ k: 'name', label: 'Drink name', req: true, full: true }, { k: 'start', label: 'First day', type: 'date' }, { k: 'end', label: 'Last day', type: 'date' }, { k: 'ingredients', label: 'What to order for it (one per line: item, amount, unit)', type: 'textarea', ph: 'Pumpkin purée, 6, cans\nCinnamon, 1, jar' }, { k: 'notes', label: 'Notes', full: true }],
      onSave(v) { if (v.start && v.end && v.end < v.start) return 'The last day is before the first day.'; A.upsert('seasonal', { ...x, ...v }); }, del: x.id ? { coll: 'seasonal', id: x.id, label: 'Removed' } : null
    });
  }
  A.register({
    id: 'seasonal', title: 'Seasonal drinks', short: 'Seasonal', icon: 'star',
    help: { what: 'Plan special drinks: when they start and end, and what to order first.', steps: ['Add the drink with its first and last day.', 'List what you need to order for it.', 'Tap Add to order list a week or two before it starts.'] },
    status() { const live = A.D.seasonal.filter(x => seasonStatus(x)[2] === 2).length, soon = A.D.seasonal.filter(x => seasonStatus(x)[1] === 'warn').length; return { text: soon ? plural(soon, 'drink') + ' starting or ending soon' : live ? live + ' on the menu now' : 'None right now', level: soon ? 'warn' : '' }; },
    todo() { return A.D.seasonal.filter(x => seasonStatus(x)[2] === 1 && seasonStatus(x)[1] === 'warn' && parseIng(x.ingredients).length && !ordered(x)).map(x => ({ key: 'sea' + x.id, pri: 3, level: 'go', icon: 'star', text: `Order for ${x.name}`, sub: seasonStatus(x)[0] + '. Nothing ordered for it yet.', btn: 'See it' })); },
    render() {
      const xs = A.D.seasonal.slice().sort((a, b) => (seasonStatus(b)[2] - seasonStatus(a)[2]) || ((a.start || '') < (b.start || '') ? -1 : 1));
      return A.page({
        title: 'Seasonal drinks', what: 'Specials, their dates, and what to order before they start.',
        primary: `<button class="btn pri lg" data-act="seaAdd">${ic('plus')} Add a drink</button>`,
        body: xs.length ? `<div class="grid g2">${xs.map(x => { const [lab, cls] = seasonStatus(x), ing = parseIng(x.ingredients); return `<div class="card"><h3>${esc(x.name)}</h3><p><span class="tag ${cls}">${esc(lab)}</span></p><p class="small mute" style="margin:.4rem 0">${x.start ? C.fmtDay(x.start) : '…'} to ${x.end ? C.fmtDay(x.end) : '…'}${x.notes ? ' · ' + esc(x.notes) : ''}</p>
            ${ing.length ? `<b class="small">Needs:</b><ul style="margin:.2rem 0 .5rem;padding-left:1.1rem">${ing.map(i => `<li>${esc(i.name)} <span class="mute">${esc(i.qty)} ${esc(i.unit)}</span></li>`).join('')}</ul>` : ''}
            <div class="cardacts">${ing.length && lab !== 'Finished' ? (ordered(x) ? '<span class="tag ok">On the order list ✓</span>' : `<button class="btn pri" data-act="seaOrder" data-id="${x.id}">${ic('truck')} Add to order list</button>`) : ''}<button class="btn ghost" data-act="seaEdit" data-id="${x.id}">${ic('edit')} Change</button></div></div>`; }).join('')}</div>`
          : A.empty('No seasonal drinks yet.', `<button class="btn pri lg" data-act="seaAdd">${ic('plus')} Add a drink</button>`)
      });
    },
    acts: {
      seaAdd: () => seasonForm({ start: C.addDays(today(), 14) }), seaEdit: el => seasonForm(A.find('seasonal', el.dataset.id)),
      seaOrder: el => { const x = A.find('seasonal', el.dataset.id); let n = 0; for (const i of parseIng(x.ingredients)) { if (A.D.orders.some(o => o.source === 'Seasonal: ' + x.name && o.name === i.name)) continue; const inv = A.D.items.find(it => it.name.toLowerCase() === i.name.toLowerCase()); A.D.orders.push({ id: C.uid(), name: i.name, qty: i.qty, unit: i.unit, supplierId: inv ? inv.supplierId || '' : '', source: 'Seasonal: ' + x.name, updatedAt: nowISO() }); n++; } A.save('orders'); A.render(); A.toast(n ? plural(n, 'thing') + ' added to What to order.' : 'Already on the order list.', 5000, { label: 'Open it', fn: () => A.go('orders') }); }
    }
  });

  /* ================= COUNT LISTS ================= */
  A.stockModule({ id: 'stock', title: 'Count ingredients', short: 'Stock', icon: 'box', countWord: 'ingredients', kinds: ['ingredient'], cats: ['Tea', 'Toppings', 'Dairy & creamer', 'Sweeteners & syrups', 'Powders', 'Fruit & purée', 'Other'], what: 'Count the tea, toppings, milk and syrups on the shelf.' });
  A.stockModule({ id: 'consumables', title: 'Count cups & straws', short: 'Cups', icon: 'cup', countWord: 'cups, lids and straws', kinds: ['consumable'], cats: ['Cups', 'Lids & film', 'Straws', 'Bags & carriers', 'Other'], what: 'Count cups, lids, wide straws, sealing film and bags.' });
})();
