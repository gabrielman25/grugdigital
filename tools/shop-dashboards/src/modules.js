/* ==========================================================================
   Shop dashboards · modules.js
   The tools every business type gets. Each one has: plain-words help (shown the first time and under ?),
   a one-line status for its tile, and to-dos for the Today list.
   ========================================================================== */
(() => {
  'use strict';
  const A = App, C = A.C, T = A.T, esc = A.esc, ic = A.ic, ui = A.ui;
  const S = () => A.D.settings;
  const today = A.today, nowISO = A.nowISO, nowMin = A.nowMin;
  const openM = () => C.toMin(S().openAt || T.hours[0]), closeM = () => { const c = C.toMin(S().closeAt || T.hours[1]); return c <= openM() ? c + 1440 : c; };
  const weekOf = key => { if (!ui[key]) ui[key] = C.weekStart(today(), S().weekStart); return ui[key]; };
  const weekNav = key => { const ws = weekOf(key), ds = C.weekDates(ws); return `<div class="seg"><button data-act="wk" data-k="${key}" data-d="-7" aria-label="Week before">${ic('left')}</button><button data-act="wk" data-k="${key}" data-d="0">${ws === C.weekStart(today(), S().weekStart) ? 'This week' : C.fmtDay(ds[0]).slice(4) + ' – ' + C.fmtDay(ds[6]).slice(4)}</button><button data-act="wk" data-k="${key}" data-d="7" aria-label="Week after">${ic('right')}</button></div>`; };
  A.act('wk', el => { const k = el.dataset.k, d = +el.dataset.d; ui[k] = d ? C.addDays(weekOf(k), d) : C.weekStart(today(), S().weekStart); A.render(); });
  const tint = (c, p) => `color-mix(in srgb,${c} ${p || 40}%,#fff)`;
  const nameOf = e => e ? e.name : '(no longer here)';
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
  /* ask who's using the device before saving something with their name on it */
  const needWho = fn => { if (!A.by() && A.staff().length) A.whoPicker(() => fn()); else fn(); };
  A.needWho = needWho;

  /* ================= SCHEDULE ================= */
  const peaksFor = date => (S().peaks || []).filter(p => C.peakOnDay(p, date));
  const shortPeaks = date => peaksFor(date).filter(p => p.minStaff && C.peakCoverage(A.D.shifts, date, p) < p.minStaff);
  function coverageHtml(date) {
    return peaksFor(date).map(p => { const n = C.peakCoverage(A.D.shifts, date, p), need = +p.minStaff || 0, low = need && n < need; return `<span class="${low ? 'low' : 'ok'}" title="${esc(p.label)} ${C.fmtT(p.start)}–${C.fmtT(p.end)}"><i style="font-style:normal">${esc(p.label)}</i><b>${low ? 'need ' + (need - n) + ' more' : '✓ ' + n}</b></span>`; }).join('');
  }
  function weekGrid(ds) {
    const emps = A.staff(), t = today();
    let h = `<div class="tbl-wrap"><div class="wk"><div class="hd emp" style="z-index:2">Person</div>${ds.map(d => `<div class="hd ${d === t ? 'today' : ''}">${d === t ? 'Today' : C.fmtDay(d)}<div class="cov">${coverageHtml(d)}</div></div>`).join('')}`;
    for (const e of emps) {
      const mine = A.D.shifts.filter(s => s.empId === e.id && ds.includes(s.date));
      const hrs = mine.reduce((a, s) => a + C.shiftHours(s), 0);
      h += `<div class="emp">${A.avatar(e)}<span>${esc(e.name)}<small class="mute" style="display:block;font-weight:500">${C.r2(hrs)} hours</small></span></div>`;
      for (const d of ds) {
        const sh = mine.filter(s => s.date === d).sort((a, b) => C.toMin(a.start) - C.toMin(b.start));
        h += `<div class="cell ${d === t ? 'today' : ''}" data-act="addShift" data-emp="${e.id}" data-date="${d}" title="Tap to add a shift">${sh.map(s => `<button class="sh" data-act="editShift" data-id="${s.id}" style="background:${tint(e.color || '#ddd', 45)}">${C.fmtT(s.start)}–${C.fmtT(s.end)}${s.station ? `<small>${esc(s.station)}</small>` : ''}</button>`).join('') || '<span class="addhint">+</span>'}</div>`;
      }
    }
    return h + '</div></div>';
  }
  function dayTimeline(date) {
    const day = A.D.shifts.filter(s => s.date === date), pks = peaksFor(date);
    let lo = 6 * 60, hi = 23 * 60;
    for (const s of day) { const [a, b] = C.span(s); lo = Math.min(lo, a); hi = Math.max(hi, b); }
    for (const p of pks) { lo = Math.min(lo, C.toMin(p.start)); hi = Math.max(hi, C.toMin(p.end)); }
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60; const W = hi - lo;
    const x = m => ((m - lo) / W * 100).toFixed(3), pos = m => `calc(8rem + (100% - 8rem) * ${(m - lo) / W})`;
    let axis = ''; for (let m = lo; m <= hi; m += 60 * (W > 15 * 60 ? 2 : 1)) axis += `<span style="left:${x(m)}%">${C.fmtT(C.fromMin(m))}</span>`;
    const emps = A.staff().filter(e => day.some(s => s.empId === e.id));
    const rows = emps.map(e => `<div class="tl-row"><b>${esc(e.name)}</b><div class="tl-track">${day.filter(s => s.empId === e.id).map(s => { const [a, b] = C.span(s); return `<button class="tl-bar" data-act="editShift" data-id="${s.id}" style="left:${x(a)}%;width:${x(lo + (b - a))}%;background:${tint(e.color || '#ddd', 55)}">${C.fmtT(s.start)}–${C.fmtT(s.end)}</button>`; }).join('')}</div></div>`).join('');
    const nm = nowMin();
    const bands = pks.map(p => { const a = C.toMin(p.start); let b = C.toMin(p.end); if (b <= a) b += 1440; const n = C.peakCoverage(A.D.shifts, date, p); return `<div class="tl-peak" style="left:${pos(a)};width:calc((100% - 8rem) * ${(b - a) / W})"><b>${esc(p.label)} · ${n} of ${p.minStaff || 0}</b></div>`; }).join('');
    return `<div class="tl"><div class="tl-in"><div class="tl-axis">${axis}</div>${rows || '<p class="mute" style="margin:1rem 0 0 8rem">Nobody is working this day.</p>'}${bands}${date === today() && nm >= lo && nm <= hi ? `<div class="tl-now" style="left:${pos(nm)}"></div>` : ''}</div></div>`;
  }
  A.register({
    id: 'schedule', title: 'Work schedule', short: 'Schedule', icon: 'calendar',
    help: { what: 'Who works when, for the whole week.', steps: ['Tap an empty square to put someone on that day.', 'Tap a shift to change or delete it.', 'The coloured labels at the top of each day show your busy times. Red means you need more people then.'], tip: 'Tap More → Copy last week to start from last week\'s schedule.' },
    status() { const n = A.D.shifts.filter(s => s.date === today()).length, sh = shortPeaks(today()); return sh.length ? { text: sh[0].label + ' needs more people', level: 'warn' } : { text: n ? plural(n, 'person', 'people') + ' working today' : 'Nobody scheduled today' }; },
    todo() {
      const out = [], sh = shortPeaks(today());
      if (sh.length) out.push({ key: 'short', pri: 3, level: 'warn', text: `Today's ${sh[0].label.toLowerCase()} needs ${sh[0].minStaff - C.peakCoverage(A.D.shifts, today(), sh[0])} more ${sh[0].minStaff - C.peakCoverage(A.D.shifts, today(), sh[0]) === 1 ? 'person' : 'people'}`, sub: `${C.fmtT(sh[0].start)}–${C.fmtT(sh[0].end)}. Call someone in or move a shift.`, btn: 'See schedule' });
      const nextWk = C.weekDates(C.addDays(C.weekStart(today(), S().weekStart), 7));
      if (new Date().getDay() >= 4 && A.staff().length && !A.D.shifts.some(s => nextWk.includes(s.date))) out.push({ key: 'nextwk', pri: 4, level: 'go', text: "Make next week's schedule", sub: 'Nothing is on it yet. More → Copy last week is the quick way.', btn: 'Open', act: 'goNextWeek' });
      return out;
    },
    render() {
      const ws = weekOf('wk'), ds = C.weekDates(ws), view = ui.schedView || (matchMedia('(max-width:699px)').matches ? 'day' : 'week');
      if (!ui.schedDay || !ds.includes(ui.schedDay)) ui.schedDay = ds.includes(today()) ? today() : ds[0];
      const thin = []; for (const d of ds) for (const p of shortPeaks(d)) thin.push((d === today() ? 'Today' : C.fmtDay(d).slice(0, 3)) + ' ' + p.label.toLowerCase());
      const more = [{ label: 'People on the team', sub: 'Add, rename, or set a clock-in PIN', icon: 'users', act: 'team' }, { label: 'Busy times', sub: 'When you need extra people', icon: 'flame', act: 'peaks' }, { label: 'Copy last week', sub: 'Start from last week\'s shifts', icon: 'copy', act: 'copyWeek' }, { label: 'Print this week', icon: 'print', act: 'print' }];
      if (!A.staff().length) return A.page({ title: 'Work schedule', what: 'Who works when.', more, body: A.empty('First, add the people who work here.', `<button class="btn pri lg" data-act="addEmp">${ic('plus')} Add a person</button>`) });
      return A.page({
        title: 'Work schedule', what: `Tap an empty square to add a shift. ${C.r2(A.D.shifts.filter(s => ds.includes(s.date)).reduce((a, s) => a + C.shiftHours(s), 0))} hours planned this week.`,
        primary: `<button class="btn pri lg" data-act="addShift">${ic('plus')} Add a shift</button>`, more,
        body: `<div class="bar">${weekNav('wk')}<div class="seg"><button data-act="setui" data-k="schedView" data-v="week" class="${view === 'week' ? 'on' : ''}">Whole week</button><button data-act="setui" data-k="schedView" data-v="day" class="${view === 'day' ? 'on' : ''}">One day</button></div></div>
          ${thin.length ? `<div class="note warn">${ic('flame')}<div class="grow"><b>Not enough people at busy times</b>${esc(thin.slice(0, 5).join(', '))}${thin.length > 5 ? ' and more' : ''}.</div></div>` : ''}
          ${view === 'week' ? weekGrid(ds) : `<div class="chips big" style="margin-bottom:.8rem">${ds.map(d => `<button data-act="setui" data-k="schedDay" data-v="${d}" class="${d === ui.schedDay ? 'on' : ''}">${d === today() ? 'Today' : C.fmtDay(d).slice(0, 10)}</button>`).join('')}</div>${dayTimeline(ui.schedDay)}`}`
      });
    },
    acts: {
      addShift: el => shiftForm({ empId: el.dataset.emp || '', date: el.dataset.date || (ui.schedDay || today()), start: T.defaultShift[0], end: T.defaultShift[1] }),
      editShift: el => shiftForm(A.find('shifts', el.dataset.id)),
      goNextWeek: () => { ui.wk = C.addDays(C.weekStart(today(), S().weekStart), 7); A.go('schedule'); },
      print: () => print(),
      copyWeek: async () => {
        const ws = weekOf('wk'), prev = C.weekDates(C.addDays(ws, -7)), src = A.D.shifts.filter(s => prev.includes(s.date));
        if (!src.length) return A.toast('The week before has no shifts to copy.');
        if (!(await A.confirmBox({ title: 'Copy last week?', body: `This puts the ${src.length} shifts from the week of ${C.fmtDay(prev[0])} onto this week. Shifts already here stay.`, ok: 'Copy them' }))) return;
        const added = []; for (const s of src) { const date = C.addDays(s.date, 7); if (A.D.shifts.some(x => x.empId === s.empId && x.date === date && x.start === s.start)) continue; const r = { ...s, id: C.uid(), date, updatedAt: nowISO() }; A.D.shifts.push(r); added.push(r.id); }
        A.save('shifts'); A.render(); A.toast(plural(added.length, 'shift') + ' copied.', 7000, { label: 'Undo', fn: () => { A.D.shifts = A.D.shifts.filter(s => !added.includes(s.id)); A.save('shifts'); A.render(); } });
      },
      team: () => teamDialog(), addEmp: () => empForm({}),
      peaks: () => peaksDialog()
    }
  });
  function shiftForm(s) {
    const isNew = !s.id;
    if (!A.staff().length) return empForm({});
    A.openForm({
      title: isNew ? 'Add a shift' : 'Change this shift', values: s,
      fields: [{ k: 'empId', label: 'Who', type: 'chips', opts: A.staffOpts, req: true }, { k: 'date', label: 'Day', type: 'date', req: true }, { k: 'start', label: 'Starts', type: 'time', req: true }, { k: 'end', label: 'Ends', type: 'time', req: true },
        { k: 'station', label: 'Job (optional)', list: T.stations, ph: T.stations[0] }, { k: 'note', label: 'Note (optional)', full: true }],
      onSave(v) {
        if (v.start === v.end) return 'The start and end times are the same.';
        const cand = { ...s, ...v }, [a, b] = C.span(cand);
        if ((b - a) / 60 > 14) return 'That shift is over 14 hours. Check the times (AM vs PM?).';
        const clash = A.D.shifts.find(x => x.id !== s.id && x.empId === v.empId && x.date === v.date && (() => { const [c, d] = C.span(x); return a < d && c < b; })());
        if (clash) return A.empName(v.empId) + ' already works then (' + C.fmtT(clash.start) + '–' + C.fmtT(clash.end) + ').';
        A.upsert('shifts', cand); A.toast('Shift saved.');
      },
      del: isNew ? null : { coll: 'shifts', id: s.id, label: 'Shift deleted' }
    });
  }
  function teamDialog() {
    const all = A.staff(true);
    const d = A.modal(`<h2>People on the team<span class="sp"></span>${A.xBtn}</h2><p>Tap someone to change their name, colour or PIN.</p>
      <ul class="list" style="margin-bottom:1rem">${all.map(e => `<li><button class="row" data-emp="${e.id}">${A.avatar(e)}<span class="grow"><b>${esc(e.name)}</b><small>${esc(e.role || '')}${e.pin ? ' · has a PIN' : ''}${e.archived ? ' · no longer works here' : ''}</small></span>${ic('edit')}</button></li>`).join('') || '<li class="row mute">Nobody yet.</li>'}</ul>
      <div class="acts"><span class="sp"></span><button class="btn pri lg" data-add>${ic('plus')} Add a person</button></div>`);
    d.querySelector('[data-x]').onclick = () => A.closeModal();
    d.querySelector('[data-add]').onclick = () => { A.closeModal(); empForm({}); };
    d.querySelectorAll('[data-emp]').forEach(b => b.onclick = () => { A.closeModal(); empForm(A.find('employees', b.dataset.emp)); });
  }
  A.teamDialog = teamDialog;
  function empForm(e) {
    const isNew = !e.id;
    A.openForm({
      title: isNew ? 'Add a person' : 'Change ' + e.name, values: { ...e, pin: '' },
      fields: [{ k: 'name', label: 'Name', req: true, full: true, ph: 'Maya' }, { k: 'role', label: 'Job (optional)', list: T.roles, ph: T.roles[1] }, { k: 'pin', label: 'Clock-in PIN (optional)', type: 'password', hint: isNew ? '4 to 6 numbers. Stops people clocking in for each other.' : (e.pin ? 'Leave empty to keep it. Type 0 to remove it.' : '4 to 6 numbers.') },
        { k: 'color', label: 'Colour', type: 'color' }].concat(isNew ? [] : [{ k: 'archived', label: 'Doesn\'t work here any more (keeps their past hours)', type: 'check' }]),
      onSave(v) {
        if (A.D.employees.some(x => x.id !== e.id && x.name.toLowerCase() === v.name.toLowerCase())) return 'Someone is already called ' + v.name + '. Add a last name or initial.';
        const rec = { ...e, name: v.name, role: v.role, color: v.color, archived: !!v.archived };
        if (!rec.color) rec.color = A.COLORS[A.D.employees.length % A.COLORS.length];
        if (v.pin === '0') { delete rec.pin; delete rec.pinLen; }
        else if (v.pin) { if (!/^\d{4,6}$/.test(v.pin)) return 'The PIN should be 4 to 6 numbers, nothing else.'; rec.salt = rec.salt || C.uid().slice(0, 8); rec.pin = C.hashPin(v.pin, rec.salt); rec.pinLen = v.pin.length; }
        A.upsert('employees', rec); A.toast(isNew ? v.name + ' added.' : 'Saved.');
      }
    });
  }
  A.empForm = empForm;
  function peaksDialog() {
    const ps = S().peaks || [];
    const d = A.modal(`<h2>Busy times<span class="sp"></span>${A.xBtn}</h2><p>${esc(T.rushIntro)}</p>
      <ul class="list" style="margin-bottom:1rem">${ps.map((p, i) => `<li><button class="row" data-i="${i}"><span class="swatch" style="background:var(--accent-2)"></span><span class="grow"><b>${esc(p.label)}</b><small>${C.fmtT(p.start)}–${C.fmtT(p.end)} · ${p.days && p.days.length && p.days.length < 7 ? p.days.map(x => C.DN[x]).join(' ') : 'every day'} · want ${p.minStaff || 0} people</small></span>${ic('edit')}</button></li>`).join('') || '<li class="row mute">No busy times set.</li>'}</ul>
      <div class="acts"><span class="sp"></span><button class="btn pri lg" data-add>${ic('plus')} Add a busy time</button></div>`);
    d.querySelector('[data-x]').onclick = () => A.closeModal();
    const edit = i => {
      A.closeModal(); const p = i == null ? { label: '', start: '15:00', end: '18:00', days: [1, 2, 3, 4, 5], minStaff: 3 } : ps[i];
      A.openForm({
        title: i == null ? 'Add a busy time' : 'Change busy time', values: p,
        fields: [{ k: 'label', label: 'Name', req: true, ph: 'After school', full: true }, { k: 'start', label: 'From', type: 'time', req: true }, { k: 'end', label: 'To', type: 'time', req: true }, { k: 'minStaff', label: 'People you want working', type: 'stepper', min: 0, step: 1 }, { k: 'days', label: 'Which days', type: 'days', req: true }],
        onSave(v) { const next = ps.slice(); const rec = { id: p.id || C.uid(), ...v, minStaff: +v.minStaff || 0 }; if (i == null) next.push(rec); else next[i] = rec; A.setSettings({ peaks: next }); },
        onDelete: i == null ? null : () => A.setSettings({ peaks: ps.filter((_, j) => j !== i) })
      });
    };
    d.querySelector('[data-add]').onclick = () => edit(null);
    d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => edit(+b.dataset.i));
  }

  /* ================= CLOCK IN / OUT ================= */
  function bigHello(html) { const d = A.modal(`<div class="hello-big">${html}</div><div class="acts"><span class="sp"></span><button class="btn pri lg" data-ok>OK</button></div>`); d.querySelector('[data-ok]').onclick = () => A.closeModal(); const t = setTimeout(() => { if (document.body.contains(d)) A.closeModal(); }, 4000); d.addEventListener('click', () => clearTimeout(t)); }
  function doPunch(e) {
    const open = A.D.punches.find(p => p.empId === e.id && !p.out), first = e.name.split(' ')[0];
    A.rememberBy(e.name);
    if (open) {
      if (Date.now() - Date.parse(open.in) < 60000) { A.toast(first + ' just clocked in less than a minute ago. Tap again if you really meant to clock out.'); open.confirmOut = (open.confirmOut || 0) + 1; if (open.confirmOut < 2) return; }
      open.out = nowISO(); delete open.confirmOut; A.upsert('punches', open);
      bigHello(`${A.avatar(e, 'xl')}<h2>Bye ${esc(first)}!</h2><p>You clocked out at <b>${C.fmtClock(Date.now())}</b>.<br>You worked <b>${C.fmtDur(Date.parse(open.out) - Date.parse(open.in), true)}</b> this shift.</p>`);
    } else {
      A.upsert('punches', { empId: e.id, in: nowISO() });
      const sh = A.D.shifts.find(s => s.empId === e.id && s.date === today());
      bigHello(`${A.avatar(e, 'xl')}<h2>Hi ${esc(first)}!</h2><p>You're clocked in at <b>${C.fmtClock(Date.now())}</b>.${sh ? `<br>Your shift today: ${C.fmtT(sh.start)}–${C.fmtT(sh.end)}.` : ''}</p><p class="small mute">Next: go to Today to see what needs doing.</p>`);
    }
    A.render();
  }
  function pinPad(e, then) {
    let v = '';
    const d = A.modal(`<h2>${A.avatar(e)} ${esc(e.name)}<span class="sp"></span>${A.xBtn}</h2><p style="text-align:center">Type your PIN</p><div class="pindots">${'<i></i>'.repeat(e.pinLen || 4)}</div><p class="ferr" style="text-align:center" data-err></p>
      <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div><p class="small mute" style="text-align:center">Forgot it? Ask your manager to change it in Work schedule → More → People.</p>`);
    d.querySelector('[data-x]').onclick = () => A.closeModal();
    const draw = () => d.querySelectorAll('.pindots i').forEach((x, i) => x.classList.toggle('on', i < v.length));
    const press = k => {
      if (k === 'Clear') v = ''; else if (k === '⌫') v = v.slice(0, -1); else if (v.length < (e.pinLen || 4)) v += k;
      draw();
      if (v.length === (e.pinLen || 4)) { if (C.hashPin(v, e.salt) === e.pin) { A.closeModal(); then(); } else { d.querySelector('[data-err]').textContent = "That's not the right PIN. Try again."; v = ''; setTimeout(draw, 250); } }
    };
    d.querySelector('.pinpad').onclick = ev => { const b = ev.target.closest('button'); if (b) press(b.dataset.k); };
    d.addEventListener('keydown', ev => { if (/^\d$/.test(ev.key)) press(ev.key); if (ev.key === 'Backspace') press('⌫'); });
    d.tabIndex = -1; d.focus();
  }
  function punchForm(p) {
    const isNew = !p.id;
    A.openForm({
      title: isNew ? 'Add a missed clock-in' : 'Fix this clock-in', intro: 'For when someone forgot to clock in or out.', values: p,
      fields: [{ k: 'empId', label: 'Who', type: 'chips', opts: () => A.staff(true).map(e => [e.id, e.name]), req: true }, { k: 'in', label: 'Clocked in at', type: 'datetime', req: true, past: true }, { k: 'out', label: 'Clocked out at', type: 'datetime', hint: 'Leave empty if they\'re still here', past: true }, { k: 'note', label: 'Why it was fixed', full: true, ph: 'Forgot to clock out' }],
      onSave(v) { if (v.out && Date.parse(v.out) <= Date.parse(v.in)) return 'Clock-out has to be after clock-in.'; if (v.out && (Date.parse(v.out) - Date.parse(v.in)) > 16 * 36e5) return 'That\'s over 16 hours. Check the date and AM/PM.'; const rec = { ...p, ...v, edited: nowISO() }; if (!v.out) delete rec.out; A.upsert('punches', rec); A.toast('Saved.'); },
      del: isNew ? null : { coll: 'punches', id: p.id, label: 'Clock-in deleted' }
    });
  }
  A.register({
    id: 'clock', title: 'Clock in / out', short: 'Clock in', icon: 'clock',
    help: { what: 'Clock in when you start work and out when you leave.', steps: ['Find your name and tap it.', 'Green means you\'re clocked in. Tap it again when you leave to clock out.', 'Forgot? Tell your manager, or use More → Add a missed clock-in.'] },
    status() { const n = A.D.punches.filter(p => !p.out).length; return { text: n ? plural(n, 'person', 'people') + ' clocked in' : 'Nobody clocked in' }; },
    todo() {
      const out = [], me = A.by(), e = A.D.employees.find(x => x.name === me), nm = nowMin();
      if (e && !A.D.punches.some(p => p.empId === e.id && !p.out)) { const sh = A.D.shifts.find(s => s.empId === e.id && s.date === today() && C.toMin(s.start) - 15 <= nm && C.span(s)[1] > nm); if (sh) out.push({ key: 'in', pri: 0, level: 'go', text: `Clock in, ${e.name.split(' ')[0]}`, sub: `Your shift is ${C.fmtT(sh.start)}–${C.fmtT(sh.end)}.`, btn: 'Clock in', act: 'punch', data: { id: e.id } }); }
      for (const p of A.D.punches.filter(p => !p.out && Date.now() - Date.parse(p.in) > 14 * 36e5)) out.push({ key: 'stale' + p.id, pri: 1, level: 'warn', text: `${nameOf(A.find('employees', p.empId)).split(' ')[0]} is still clocked in from ${C.fmtWhen(p.in, today())}`, sub: 'They probably forgot to clock out. Fix the time so their hours are right.', btn: 'Fix it', act: 'editPunch', data: { id: p.id } });
      return out;
    },
    render() {
      const open = A.D.punches.filter(p => !p.out);
      const grid = A.staff().map(e => { const o = open.find(p => p.empId === e.id); return `<button class="punch ${o ? 'in' : ''}" data-act="punch" data-id="${e.id}">${A.avatar(e, 'lg')}<span><b>${esc(e.name)}</b><small>${o ? '✓ Clocked in at ' + C.fmtClock(Date.parse(o.in)) : 'Tap to clock in'}</small></span></button>`; }).join('');
      const ws = weekOf('hw'), ds = C.weekDates(ws), rows = C.weekHours(A.D, ds).filter(r => r.total > 0 || !r.emp.archived);
      const recent = A.D.punches.slice().sort((a, b) => a.in < b.in ? 1 : -1).slice(0, 20);
      return A.page({
        title: 'Clock in / out', what: 'Tap your name. Tap it again when you leave.',
        more: [{ label: 'Add a missed clock-in', sub: 'Someone forgot to clock in or out', icon: 'plus', act: 'addPunch' }, { label: 'People on the team', icon: 'users', act: 'team' }, { label: 'Hours spreadsheet (this week)', sub: 'For payroll', icon: 'download', act: 'csvHours' }, { label: 'Every clock-in (this week)', icon: 'download', act: 'csvPunches' }],
        body: (A.staff().length ? `<div class="punchgrid">${grid}</div>` : A.empty('Nobody is on the team yet.', `<button class="btn pri lg" data-act="addEmp">${ic('plus')} Add a person</button>`))
          + A.past('Hours worked this week', `<div class="bar">${weekNav('hw')}</div><div class="tbl-wrap"><table class="tbl"><tr><th>Name</th>${ds.map(d => `<th class="n">${C.fmtDay(d).slice(0, 3)}</th>`).join('')}<th class="n">Total</th></tr>
            ${rows.map(r => `<tr><td>${esc(r.emp.name)}</td>${r.per.map(h => `<td class="n">${h ? h.toFixed(1) : '–'}</td>`).join('')}<td class="n"><b>${r.total.toFixed(2)}</b></td></tr>`).join('') || `<tr><td colspan="9" class="mute">No hours yet.</td></tr>`}</table></div>`)
          + A.past('Recent clock-ins (tap one to fix it)', `<ul class="list">${recent.map(p => `<li><button class="row" data-act="editPunch" data-id="${p.id}"><span class="grow"><b>${esc(nameOf(A.find('employees', p.empId)))}</b><small>${C.fmtWhen(p.in, today())} → ${p.out ? C.fmtClock(Date.parse(p.out)) : 'still here'}${p.edited ? ' · fixed' : ''}${p.note ? ' · ' + esc(p.note) : ''}</small></span><span class="num">${C.r2(C.punchHours(p)).toFixed(2)} h</span></button></li>`).join('') || '<li class="row mute">None yet.</li>'}</ul>`)
          + A.legal('Hours here are a record, not payroll.', 'Check them before paying anyone. Overtime and break rules depend on where you are.')
      });
    },
    acts: {
      punch: el => { const e = A.find('employees', el.dataset.id); if (!e) return; if (e.pin) pinPad(e, () => doPunch(e)); else doPunch(e); },
      addPunch: () => punchForm({ in: nowISO() }), editPunch: el => punchForm(A.find('punches', el.dataset.id)),
      csvHours: () => A.csvDownload('hours-week-of-' + weekOf('hw'), C.hoursCsvRows(A.D, C.weekDates(weekOf('hw')))),
      csvPunches: () => A.csvDownload('clock-ins-week-of-' + weekOf('hw'), C.punchCsvRows(A.D, C.weekDates(weekOf('hw'))))
    },
    csv: [['Hours worked this week', () => ['hours-week-of-' + C.weekStart(today(), S().weekStart), C.hoursCsvRows(A.D, C.weekDates(C.weekStart(today(), S().weekStart)))]],
      ['Every clock-in this week', () => ['clock-ins-week-of-' + C.weekStart(today(), S().weekStart), C.punchCsvRows(A.D, C.weekDates(C.weekStart(today(), S().weekStart)))]]]
  });

  /* ================= OPENING & CLOSING LISTS ================= */
  const lists = () => A.D.checklists.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const runOf = (listId, date) => A.D.checkRuns.find(r => r.listId === listId && r.date === date);
  const progress = (l, date) => { const r = runOf(l.id, date), n = l.items.length, done = l.items.filter(it => r && r.done && r.done[it.id]).length; return { n, done, pct: n ? done / n : 0, left: n - done }; };
  const listFor = when => lists().find(l => l.when === when);
  A.register({
    id: 'checklists', title: 'Opening & closing', short: 'Lists', icon: 'checklist',
    help: { what: 'Step-by-step lists for opening and closing the shop.', steps: ['Pick Opening or Closing at the top.', 'Do each job, then tap it to tick it off. Your name and the time are saved.', 'Not sure how to do a job? Tap "How?" under it.'], tip: 'Ticked something by mistake? Tap it again to untick.' },
    status() { const o = listFor('open'), c = listFor('close'), nm = nowMin(); const l = nm >= closeM() - 120 ? c : o; if (!l) return null; const p = progress(l, today()); return { text: `${l.name}: ${p.done === p.n ? 'all done ✓' : p.done + ' of ' + p.n + ' done'}` }; },
    todo() {
      const out = [], nm = nowMin(), o = listFor('open'), c = listFor('close');
      if (o && o.items.length) { const p = progress(o, today()); if (p.left === 0) out.push({ done: true, text: 'Opening list' }); else if (nm < closeM() - 120) out.push({ key: 'open', pri: nm > openM() + 30 ? 0 : 1, level: nm > openM() + 30 ? 'warn' : 'go', text: p.done ? 'Finish opening the shop' : 'Open the shop', sub: `${p.done} of ${p.n} opening jobs done.${nm > openM() + 30 ? ' The shop opened at ' + C.fmtT(C.fromMin(openM())) + '.' : ''}`, btn: p.done ? 'Keep going' : 'Start', go: 'checklists', p: o.id }); }
      if (c && c.items.length && nm >= closeM() - 90) { const p = progress(c, today()); if (p.left === 0) out.push({ done: true, text: 'Closing list' }); else out.push({ key: 'close', pri: 1, level: 'go', text: p.done ? 'Finish closing the shop' : 'Start closing the shop', sub: `${p.done} of ${p.n} closing jobs done.`, btn: p.done ? 'Keep going' : 'Start', go: 'checklists', p: c.id }); }
      return out;
    },
    render(p) {
      const ls = lists(); if (p && ls.some(l => l.id === p)) { ui.ckList = p; ui.ckDate = null; }
      if (!ls.length) return A.page({ title: 'Opening & closing', what: 'Step-by-step lists.', body: A.empty('There are no lists yet.', `<button class="btn pri lg" data-act="ckNewList">${ic('plus')} Make a list</button>`) });
      const l = ls.find(x => x.id === ui.ckList) || ls.find(x => x.when === (nowMin() >= closeM() - 120 ? 'close' : 'open')) || ls[0]; ui.ckList = l.id;
      const date = ui.ckDate || today(), r = runOf(l.id, date), pr = progress(l, date), edit = ui.ckEdit;
      const tabs = `<div class="seg big" style="margin-bottom:1rem">${ls.map(x => { const q = progress(x, date); return `<button data-act="setui" data-k="ckList" data-v="${x.id}" class="${x.id === l.id ? 'on' : ''}">${esc(x.name)} <span class="mute">${q.done}/${q.n}</span></button>`; }).join('')}</div>`;
      let body;
      if (edit) {
        body = `<div class="note soft">${ic('edit')}<div class="grow"><b>Changing the "${esc(l.name)}" list</b>Type to change a job. The arrows move it up or down. Changes save by themselves.</div></div><div class="card"><label class="f"><span>Name of this list</span><input type="text" value="${esc(l.name)}" data-change="ckRename"></label>
          <label class="f"><span>When it's used</span><select data-change="ckWhen">${[['open', 'When opening'], ['close', 'When closing'], ['other', 'Any time']].map(([a, b]) => `<option value="${a}" ${l.when === a ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <ul class="list" style="box-shadow:none;background:var(--field);margin-bottom:.8rem">${l.items.map((it, i) => `<li class="row" style="gap:.4rem;flex-wrap:wrap"><input type="text" value="${esc(it.text)}" data-change="ckItemText" data-id="${it.id}" aria-label="Job ${i + 1}" style="background:#fff;flex:1;min-width:12rem"><input type="text" value="${esc(it.note || '')}" data-change="ckItemNote" data-id="${it.id}" placeholder="How to do it (optional)" style="background:#fff;flex:1;min-width:12rem"><span><button class="ib" data-act="ckMove" data-id="${it.id}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">${ic('up')}</button><button class="ib" data-act="ckMove" data-id="${it.id}" data-d="1" ${i < l.items.length - 1 ? '' : 'disabled'} aria-label="Move down">${ic('down')}</button><button class="ib del" data-act="ckDelItem" data-id="${it.id}" aria-label="Delete">${ic('trash')}</button></span></li>`).join('')}</ul>
          <form data-ckadd style="display:flex;gap:.5rem"><input type="text" name="t" placeholder="Add a job, e.g. Wipe the counters"><button class="btn pri">${ic('plus')} Add</button></form>
          <div class="acts" style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap"><button class="btn danger sm" data-act="ckDelList">${ic('trash')} Delete this whole list</button><span style="flex:1"></span><button class="btn pri lg" data-act="ckEditDone">${ic('check')} Done changing</button></div></div>`;
      } else {
        body = (date !== today() ? `<div class="note warn">${ic('calendar')}<div class="grow"><b>You're looking at ${C.fmtDay(date)}, not today.</b><button class="link" data-act="ckDay" data-d="0">Go back to today</button></div></div>` : '')
          + `<div class="card listcard"><div class="lh"><div class="prog" style="flex:1"><i style="width:${pr.pct * 100}%"></i></div><b class="num">${pr.done} of ${pr.n}</b></div>
          ${l.items.map(it => { const dn = r && r.done && r.done[it.id]; return `<div class="checkwrap"><button class="check ${dn ? 'on' : ''}" data-act="ckToggle" data-id="${it.id}"><span class="box">${ic('check')}</span><span class="lbl grow">${esc(it.text)}${dn ? `<small>Done ${C.fmtClock(Date.parse(dn.at))}${dn.by ? ' by ' + esc(dn.by) : ''}</small>` : ''}</span></button>${it.note && !dn ? `<details class="how"><summary>How?</summary><p>${esc(it.note)}</p></details>` : ''}</div>`; }).join('') || '<p class="mute" style="padding:.5rem">This list is empty. Tap More → Change this list to add jobs.</p>'}</div>
          ${pr.n && pr.done === pr.n ? `<div class="caught">${ic('party')}<div><b>${esc(l.name)} list finished!</b><small>Nice work${A.by() ? ', ' + esc(A.by().split(' ')[0]) : ''}.</small></div></div>${l.when === 'close' ? `<div class="note warn">${ic('shield')}<div class="grow"><b>Last thing: save a backup</b>It keeps today's work safe if this tablet ever breaks.<div class="cardacts"><button class="btn pri" data-act="backup">${ic('download')} Save backup</button></div></div></div>` : ''}` : ''}`;
      }
      return A.page({
        title: 'Opening & closing', what: edit ? '' : 'Do each job, then tap it to tick it off.',
        more: [{ label: 'Change this list', sub: 'Add, rename or reorder jobs', icon: 'edit', act: 'ckEdit' }, { label: 'Make a new list', sub: 'e.g. a mid-shift reset', icon: 'plus', act: 'ckNewList' }, { label: 'See yesterday', icon: 'left', act: 'ckDay', data: { d: -1 } }],
        body: tabs + body
      });
    },
    after(v) {
      const f = v.querySelector('[data-ckadd]'); if (f) f.onsubmit = e => { e.preventDefault(); const t = f.t.value.trim(); if (!t) return; const l = A.find('checklists', ui.ckList); l.items.push({ id: C.uid(), text: t }); A.upsert('checklists', l); A.render(); setTimeout(() => { const g = document.querySelector('[data-ckadd] input'); g && g.focus(); }, 0); };
    },
    acts: {
      ckToggle: el => needWho(() => {
        const l = A.find('checklists', ui.ckList), date = ui.ckDate || today(); let r = runOf(l.id, date);
        if (!r) r = { listId: l.id, date, done: {} };
        if (r.done[el.dataset.id]) delete r.done[el.dataset.id]; else r.done[el.dataset.id] = { at: nowISO(), by: A.by() };
        A.upsert('checkRuns', r); A.render();
      }),
      ckDay: el => { const d = +el.dataset.d; ui.ckDate = d ? C.addDays(ui.ckDate || today(), d) : today(); if (ui.ckDate >= today()) ui.ckDate = null; A.render(); },
      ckEdit: () => { ui.ckEdit = true; A.render(); }, ckEditDone: () => { ui.ckEdit = false; A.render(); A.toast('List saved.'); },
      ckRename: el => { const l = A.find('checklists', ui.ckList); l.name = el.value.trim() || l.name; A.upsert('checklists', l); },
      ckWhen: el => { const l = A.find('checklists', ui.ckList); l.when = el.value; A.upsert('checklists', l); },
      ckItemText: el => { const l = A.find('checklists', ui.ckList), it = l.items.find(x => x.id === el.dataset.id); if (it && el.value.trim()) { it.text = el.value.trim(); A.upsert('checklists', l); } },
      ckItemNote: el => { const l = A.find('checklists', ui.ckList), it = l.items.find(x => x.id === el.dataset.id); if (it) { it.note = el.value.trim(); A.upsert('checklists', l); } },
      ckMove: el => { const l = A.find('checklists', ui.ckList), i = l.items.findIndex(x => x.id === el.dataset.id), j = i + +el.dataset.d; if (j < 0 || j >= l.items.length) return; [l.items[i], l.items[j]] = [l.items[j], l.items[i]]; A.upsert('checklists', l); A.render(); },
      ckDelItem: el => { const l = A.find('checklists', ui.ckList), i = l.items.findIndex(x => x.id === el.dataset.id), it = l.items[i]; l.items.splice(i, 1); A.upsert('checklists', l); A.render(); A.toast('Job removed.', 6000, { label: 'Undo', fn: () => { l.items.splice(i, 0, it); A.upsert('checklists', l); A.render(); } }); },
      ckDelList: async () => { const l = A.find('checklists', ui.ckList); if (await A.confirmBox({ title: 'Delete the whole "' + l.name + '" list?', body: 'The list and its past tick-offs will be gone.', ok: 'Delete it', danger: true })) { A.remove('checklists', l.id); A.D.checkRuns = A.D.checkRuns.filter(r => r.listId !== l.id); A.save('checkRuns'); ui.ckList = null; ui.ckEdit = false; A.render(); } },
      ckNewList: () => A.openForm({ title: 'Make a new list', fields: [{ k: 'name', label: 'Name', req: true, ph: 'Mid-shift reset', full: true }, { k: 'when', label: 'When it\'s used', type: 'chips', opts: [['other', 'Any time'], ['open', 'When opening'], ['close', 'When closing']] }], values: { when: 'other' }, onSave(v) { const l = A.upsert('checklists', { ...v, items: [], order: A.D.checklists.length }); ui.ckList = l.id; ui.ckEdit = true; } })
    }
  });

  /* ================= NOTES FOR THE NEXT SHIFT ================= */
  const unread = () => A.D.handoffs.filter(h => !h.done && Date.now() - Date.parse(h.at) < 864e5 && !(A.meta.readNotes || []).includes(h.id) && h.author !== A.by());
  A.register({
    id: 'handoff', title: 'Notes for next shift', short: 'Notes', icon: 'note',
    help: { what: 'Leave a message for whoever works next.', steps: ['Type what they need to know: what ran out, what\'s half done, who called.', 'Tap Post note. Your name is added for you.', 'The next person sees "Read the notes" on their Today list.'] },
    status() { const n = unread().length; return { text: n ? plural(n, 'new note') : 'No new notes', level: n ? 'warn' : '' }; },
    todo() { const n = unread(); return n.length ? [{ key: 'read', pri: 1, level: 'go', text: `Read ${n.length === 1 ? 'the note' : n.length + ' notes'} from the last shift`, sub: '"' + n[0].text.slice(0, 70) + (n[0].text.length > 70 ? '…"' : '"'), btn: 'Read' }] : []; },
    render() {
      A.meta.readNotes = A.D.handoffs.map(h => h.id).slice(-200); A.saveMeta();
      const days = ui.hoRange == null ? 7 : ui.hoRange;
      const ns = A.D.handoffs.filter(h => h.pinned || A.inRange(h.at, days)).sort((a, b) => (b.pinned - a.pinned) || (a.at < b.at ? 1 : -1));
      return A.page({
        title: 'Notes for next shift', what: 'Tell the next person what they need to know.',
        body: `<form class="card" data-hoform style="margin-bottom:1rem"><label class="f"><span>Your note</span><textarea name="text" placeholder="${esc(T.notePh)}"></textarea></label>
          <div class="f"><span>Who is it for?</span><input type="hidden" name="forWhom" value="Next shift"><div class="chips big" data-chips="forWhom">${['Next shift', 'Opening', 'Closing', 'Manager', 'Everyone'].map((x, i) => `<button type="button" data-v="${x}" class="${i ? '' : 'on'}">${x}</button>`).join('')}</div></div>
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap"><label class="ckrow"><input type="checkbox" name="pinned"> Important: keep it at the top</label><span style="flex:1"></span><button class="btn pri lg">${ic('plus')} Post note</button></div></form>
          <div class="bar"><h3 class="sec" style="margin:0">Notes</h3><span style="flex:1"></span>${A.rangeSeg('hoRange', 7)}</div>
          <div class="stack">${ns.map(h => `<div class="card notecard ${h.done ? 'dim' : ''}"><div class="nh">${h.pinned ? `<span class="tag warn">${ic('pin')} Important</span>` : ''}<small class="mute grow"><b style="color:var(--ink)">${esc(h.author || 'Someone')}</b> for ${esc((h.forWhom || 'next shift').toLowerCase())} · ${C.fmtWhen(h.at, today())}${h.done ? ' · handled' : ''}</small>
            <button class="btn sm" data-act="hoDone" data-id="${h.id}">${h.done ? 'Not handled yet' : ic('check') + ' Handled'}</button><button class="ib del" data-act="hoDel" data-id="${h.id}" aria-label="Delete note">${ic('trash')}</button></div><div class="nt">${esc(h.text)}</div></div>`).join('') || A.empty('No notes in this time range.')}</div>`
      });
    },
    after(v) { const f = v.querySelector('[data-hoform]'); if (f) f.onsubmit = e => { e.preventDefault(); const x = A.readForm(f, [{ k: 'text' }, { k: 'forWhom' }, { k: 'pinned', type: 'check' }]); if (!x.text) return A.toast('Type your note first.'); needWho(() => { A.upsert('handoffs', { ...x, author: A.by() || 'Someone', at: nowISO() }); A.render(); A.toast('Note posted. The next shift will see it.'); }); }; },
    acts: {
      hoDone: el => { const h = A.find('handoffs', el.dataset.id); h.done = !h.done; if (h.done) h.pinned = false; A.upsert('handoffs', h); A.render(); },
      hoDel: el => A.removeUndo('handoffs', el.dataset.id, 'Note deleted')
    }
  });

  /* ================= END-OF-DAY CASH & TIPS ================= */
  const hoursOn = date => { const hrs = {}; for (const p of A.D.punches) { if (C.ymd(new Date(p.in)) !== date) continue; hrs[p.empId] = (hrs[p.empId] || 0) + C.punchHours(p); } return hrs; };
  function drawerSentence(s) {
    if (s.overShort == null) return '';
    const d = s.overShort;
    if (Math.abs(d) < 0.005) return `<div class="verdict ok">${ic('check')}<div><b>The drawer is exactly right.</b><small>Expected ${C.money(s.expected)}, counted ${C.money(s.expected)}.</small></div></div>`;
    const big = Math.abs(d) > 5;
    return `<div class="verdict ${big ? 'bad' : 'warn'}">${ic('alert')}<div><b>The drawer is ${C.money(Math.abs(d))} ${d < 0 ? 'short' : 'over'}.</b><small>It should have ${C.money(s.expected)}. ${big ? 'That\'s a lot. Count it again, and if it\'s still off, tell the manager.' : 'A little off happens. Write a note if you know why.'}</small></div></div>`;
  }
  function splitHtml(split, tips) {
    if (!tips) return '<p class="mute">No tips to split today.</p>';
    if (!split.length) return '<p class="mute">Nobody clocked in today, so the app can\'t split tips by hours. A manager can enter hours under Cash-out → past days.</p>';
    return `<ul class="list">${split.map(p => `<li class="row"><span class="grow"><b>${esc(p.name)}</b><small>${C.r2(p.hours)} hours worked</small></span><b class="big" style="font-size:1.4rem">${C.money(p.amount)}</b></li>`).join('')}</ul>`;
  }
  function cashWizard() {
    const last = A.D.cashouts.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
    A.wizard({
      title: 'Close out the day', doneLabel: 'See results',
      values: { float: last ? last.float : (S().defaultFloat || '') },
      steps: [
        { k: 'counted', q: 'How much cash is in the register drawer?', hint: 'Count every bill and coin in the drawer. <b>Don\'t</b> count the tip jar.', type: 'money', max: 100000 },
        { k: 'float', q: 'How much cash did the drawer start with today?', hint: 'This is the "starting cash". It\'s usually the same every day.' + (last ? ` Last time it was ${C.money(last.float)}.` : ''), type: 'money', max: 100000 },
        { k: 'cashSales', q: 'Cash sales today?', hint: 'Print or open your register\'s end-of-day report and find <b>Cash</b>.', type: 'money', max: 100000 },
        { k: 'cardSales', q: 'Card sales today?', hint: 'Same report. Look for <b>Card</b> or <b>Credit</b>.', type: 'money', max: 1000000 },
        { k: 'cashTips', q: 'How much is in the tip jar?', hint: 'Count the cash tips. Type 0 if there are none.', type: 'money', max: 100000 },
        { k: 'cardTips', q: 'Card tips today?', hint: 'On the register report, look for <b>Tips</b> or <b>Gratuity</b>. Type 0 if none.', type: 'money', max: 100000 }
      ],
      onDone(v) {
        const date = today(), hrs = hoursOn(date), people = Object.keys(hrs).map(id => ({ empId: id, name: A.empName(id) || '(someone)', hours: C.r2(hrs[id]) }));
        const s = C.cashSummary(v), split = C.splitTips(s.tips, people.filter(p => p.hours > 0));
        A.upsert('cashouts', { date, by: A.by(), ...v, split: people.map(p => ({ ...p, amount: (split.find(x => x.empId === p.empId) || {}).amount || 0 })) });
        return `<h2 class="q">Here's today</h2>${drawerSentence(s)}<div class="kv"><span>Total sales</span><b>${C.money(s.sales)}</b></div><div class="kv"><span>Tips to share</span><b>${C.money(s.tips)}</b></div>
          <h3 class="sec">Each person's tips</h3>${splitHtml(split, s.tips)}<p class="small mute" style="margin-top:.6rem">Split by hours on the time clock today. Saved. You can find it again in End-of-day cash.</p>
          <div class="note warn" style="margin-top:1rem">${ic('shield')}<div class="grow"><b>Before you go: save a backup</b><div class="cardacts"><button class="btn pri" data-act="backup" data-close>${ic('download')} Save backup</button></div></div></div>`;
      }
    });
  }
  function cashForm(c) {
    let people = (c.split || []).map(x => ({ ...x }));
    if (!people.length) { const h = hoursOn(c.date); people = Object.keys(h).map(id => ({ empId: id, name: A.empName(id), hours: C.r2(h[id]) })); }
    const fields = [{ k: 'date', label: 'Day', type: 'date', req: true }, { k: 'counted', label: 'Cash in drawer', type: 'number', min: 0 }, { k: 'float', label: 'Starting cash', type: 'number', min: 0 }, { k: 'cashSales', label: 'Cash sales', type: 'number', min: 0 }, { k: 'cardSales', label: 'Card sales', type: 'number', min: 0 }, { k: 'cashTips', label: 'Tip jar', type: 'number', min: 0 }, { k: 'cardTips', label: 'Card tips', type: 'number', min: 0 }, { k: 'note', label: 'Note', full: true }];
    const extra = `<div data-sum></div><h3 class="sec">Tip split</h3><p class="small mute">Change hours if the time clock was wrong. 0 leaves someone out.</p><table class="tbl"><tr><th>Name</th><th class="n">Hours</th><th class="n">Gets</th></tr>${people.map((p, i) => `<tr><td>${esc(p.name)}</td><td class="n"><input type="number" step="any" min="0" data-h="${i}" value="${p.hours}" style="width:5.5rem;min-height:2.4rem;margin-left:auto;text-align:right"></td><td class="n" data-amt="${i}"></td></tr>`).join('') || '<tr><td colspan="3" class="mute">Nobody clocked in that day.</td></tr>'}</table>`;
    const recalc = (v, form) => {
      people.forEach((p, i) => { const inp = form.querySelector(`[data-h="${i}"]`); if (inp) p.hours = +inp.value || 0; });
      const s = C.cashSummary(v), split = C.splitTips(s.tips, people.filter(p => p.hours > 0));
      people.forEach((p, i) => { const x = split.find(y => y.empId === p.empId); const td = form.querySelector(`[data-amt="${i}"]`); if (td) td.textContent = x ? C.money(x.amount) : '–'; });
      form.querySelector('[data-sum]').innerHTML = drawerSentence(s); return split;
    };
    A.openForm({
      title: 'Cash-out for ' + C.fmtDay(c.date), values: c, fields, extra, cls: 'wide', onInput: recalc,
      onSave(v, form) { const split = recalc(v, form); A.upsert('cashouts', { ...c, ...v, split: people.map(p => ({ ...p, amount: (split.find(x => x.empId === p.empId) || {}).amount || 0 })) }); A.toast('Saved.'); },
      del: { coll: 'cashouts', id: c.id, label: 'Cash-out deleted' }
    });
  }
  const cashRows = () => [['Date', 'Counted by', 'Starting cash', 'Cash in drawer', 'Cash sales', 'Card sales', 'Over/short', 'Tip jar', 'Card tips', 'Tip split', 'Note']].concat(A.D.cashouts.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(c => { const s = C.cashSummary(c); return [c.date, c.by || '', +c.float || 0, +c.counted || 0, +c.cashSales || 0, +c.cardSales || 0, s.overShort == null ? '' : s.overShort, +c.cashTips || 0, +c.cardTips || 0, (c.split || []).filter(p => p.amount).map(p => p.name + ' ' + p.amount.toFixed(2)).join('; '), c.note || '']; }));
  A.register({
    id: 'cashout', title: 'End-of-day cash', short: 'Cash', icon: 'cash',
    help: { what: 'Count the register at closing and split the tips.', steps: ['Tap Close out the day.', 'Answer each question. Numbers come from counting the drawer and from your register\'s end-of-day report.', 'The app tells you if the drawer is right, and how much tip money each person gets.'] },
    status() { const c = A.D.cashouts.find(x => x.date === today()); return c ? { text: 'Done today ✓' } : { text: 'Not done today' }; },
    todo() { if (A.D.cashouts.some(x => x.date === today())) return [{ done: true, text: 'Cash-out' }]; return nowMin() >= closeM() - 45 ? [{ key: 'cash', pri: 1, level: 'go', text: 'Count the cash drawer and split tips', sub: 'About 5 minutes. The app walks you through it.', btn: 'Start', act: 'cashNew' }] : []; },
    render() {
      const list = A.D.cashouts.slice().sort((a, b) => a.date < b.date ? 1 : -1), td = list.find(c => c.date === today());
      return A.page({
        title: 'End-of-day cash', what: 'Count the drawer and split the tips. The app walks you through it.',
        primary: td ? '' : `<button class="btn pri lg" data-act="cashNew">${ic('cash')} Close out the day</button>`,
        more: [{ label: 'Spreadsheet of all cash-outs', icon: 'download', act: 'cashCsv' }].concat(td ? [{ label: 'Count again', sub: 'Start over for today', icon: 'cash', act: 'cashNew' }] : []),
        body: (td ? (() => { const s = C.cashSummary(td); return `<div class="card"><h3>${ic('check')} Today is done</h3>${drawerSentence(s)}<div class="kv"><span>Total sales</span><b>${C.money(s.sales)}</b></div><div class="kv"><span>Tips</span><b>${C.money(s.tips)}</b></div>${splitHtml((td.split || []).filter(p => p.amount), s.tips)}<button class="btn sm" style="margin-top:.6rem" data-act="cashEdit" data-id="${td.id}">${ic('edit')} Fix a number</button></div>`; })() : '')
          + A.past('Past days', `<div class="tbl-wrap"><table class="tbl"><tr><th>Day</th><th>By</th><th class="n">Sales</th><th class="n">Drawer</th><th class="n">Tips</th></tr>${list.map(c => { const s = C.cashSummary(c); return `<tr class="click" data-act="cashEdit" data-id="${c.id}"><td>${C.fmtDay(c.date)}</td><td>${esc(c.by || '')}</td><td class="n">${C.money(s.sales)}</td><td class="n">${s.overShort == null ? '–' : Math.abs(s.overShort) < .005 ? 'right' : C.money(Math.abs(s.overShort)) + (s.overShort < 0 ? ' short' : ' over')}</td><td class="n">${C.money(s.tips)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="mute">None yet.</td></tr>'}</table></div>`)
          + A.legal('This helps you count. It isn\'t payroll or tax advice.', 'Tip-sharing rules depend on your state and city.')
      });
    },
    acts: { cashNew: () => needWho(cashWizard), cashEdit: el => cashForm(A.find('cashouts', el.dataset.id)), cashCsv: () => A.csvDownload('cash-outs', cashRows()) },
    csv: [['Cash-outs & tips', () => ['cash-outs', cashRows()]]]
  });

  /* ================= STOCK COUNTS (with "keep at least") ================= */
  const supName = id => (A.find('suppliers', id) || {}).name || '';
  function itemForm(it, kinds, cats) {
    const isNew = !it.id;
    A.openForm({
      title: isNew ? 'Add something to count' : 'Change ' + it.name, values: { kind: kinds[0], ...it },
      fields: [{ k: 'name', label: 'What is it?', req: true, full: true, ph: 'Mango purée' }, kinds.length > 1 ? { k: 'kind', label: 'Type', type: 'chips', opts: kinds.map(k => [k, T.kindLabels[k] || k]) } : { k: 'kind', type: 'hidden' },
        { k: 'cat', label: 'Group', list: cats, ph: cats[0] }, { k: 'unit', label: 'Counted in', list: T.units, ph: 'bags, boxes, bottles…' }, { k: 'par', label: 'Keep at least', type: 'stepper', min: 0, hint: 'When you have less than this, it goes on the order list.' }, { k: 'count', label: 'How many now', type: 'stepper', min: 0 },
        { k: 'supplierId', label: 'Bought from', type: 'select', blank: 'Not sure', opts: () => A.D.suppliers.map(s => [s.id, s.name]) }, { k: 'note', label: 'Note', full: true, ph: 'Comes in cases of 6' }],
      onSave(v) { const rec = { ...it, ...v, par: +v.par || 0, count: v.count === '' ? 0 : +v.count }; if (v.count !== it.count) rec.countedAt = nowISO(); if (!C.isLow(rec)) rec.orderedAt = null; A.upsert('items', rec); A.toast('Saved.'); },
      del: isNew ? null : { coll: 'items', id: it.id, label: it.name + ' removed' }
    });
  }
  function stockModule(o) {
    const items = () => A.D.items.filter(i => o.kinds.includes(i.kind));
    A.register({
      id: o.id, title: o.title, short: o.short, icon: o.icon,
      help: { what: o.what, steps: ['Go to the shelf. For each thing, count how many you have.', 'Tap + or − (or type the number) until it matches.', 'Anything below "keep at least" turns yellow and goes on What to order by itself.'], tip: 'Counting once a week is plenty for most things.' },
      status() { const low = items().filter(C.isLow); return low.length ? { text: plural(low.length, 'thing') + ' running low', level: low.some(C.isCritical) ? 'warn' : 'warn' } : { text: items().length ? 'Nothing running low' : 'Nothing added yet' }; },
      todo() {
        const all = items(); if (!all.length) return [];
        const last = all.map(i => i.countedAt || '').sort().pop();
        return (!last || Date.now() - Date.parse(last) > 7 * 864e5) && nowMin() < closeM() - 90 ? [{ key: 'count', pri: 3, level: 'go', text: `Count the ${o.countWord}`, sub: last ? 'Last counted ' + C.fmtDay(C.ymd(new Date(last))) + '. About 5 minutes.' : 'Not counted yet. About 5 minutes.', btn: 'Count' }] : [];
      },
      render() {
        const all = items(), cats = [...new Set(all.map(i => i.cat || 'Other'))], f = ui[o.id + 'Cat'] || 'All';
        let list = all.filter(i => (f === 'All' || (i.cat || 'Other') === f));
        const groups = {}; for (const i of list.sort((a, b) => a.name.localeCompare(b.name))) (groups[i.cat || 'Other'] = groups[i.cat || 'Other'] || []).push(i);
        const nLow = all.filter(C.isLow).length;
        return A.page({
          title: o.title, what: 'Count what\'s on the shelf. Tap + or − until the number matches.',
          primary: nLow ? `<button class="btn alt lg" data-go="orders">${ic('truck')} ${plural(nLow, 'thing')} to order</button>` : '',
          more: [{ label: 'Add something to count', icon: 'plus', act: 'itemNew', data: { m: o.id } }, { label: 'Only show what\'s running low', icon: 'search', act: 'setui', data: { k: o.id + 'Cat', v: '__low' } }],
          body: (all.length > 8 ? `<div class="bar"><div class="chips">${['All', ...cats].map(c => `<button data-act="setui" data-k="${o.id}Cat" data-v="${esc(c)}" class="${c === f ? 'on' : ''}">${esc(c)}</button>`).join('')}</div><span style="flex:1"></span><input type="text" placeholder="Find…" data-search style="max-width:12rem;min-height:2.6rem"></div>` : '')
            + (f === '__low' ? (list = all.filter(C.isLow), `<div class="note soft">${ic('search')}<div class="grow"><b>Showing only what's running low</b><button class="link" data-act="setui" data-k="${o.id}Cat" data-v="All">Show everything</button></div></div>`) : '')
            + ((f === '__low' ? [['Running low', list]] : Object.entries(groups)).length && list.length ? (f === '__low' ? [['Running low', list]] : Object.entries(groups)).map(([g, gi]) => `<h3 class="sec">${esc(g)}</h3><ul class="list">${gi.map(i => `<li class="row count ${C.isLow(i) ? 'low' : ''}" data-name="${esc(i.name.toLowerCase())}"><button class="grow link plain" data-act="itemEdit" data-id="${i.id}" data-m="${o.id}"><b>${esc(i.name)}</b><small>${C.isLow(i) ? `<span class="tag warn">Low</span> ` : ''}Keep at least ${i.par || 0} ${esc(i.unit || '')}${i.countedAt ? ' · counted ' + C.fmtWhen(i.countedAt, today()) : ''}</small></button>
              <span class="step big"><button data-act="cnt" data-id="${i.id}" data-d="-1" aria-label="One less ${esc(i.name)}">−</button><input type="number" inputmode="decimal" min="0" step="any" value="${+i.count || 0}" data-change="cntSet" data-id="${i.id}" aria-label="${esc(i.name)}: how many"><button data-act="cnt" data-id="${i.id}" data-d="1" aria-label="One more ${esc(i.name)}">+</button></span></li>`).join('')}</ul>`).join('')
              : A.empty(all.length ? 'Nothing here.' : 'Nothing to count yet.', all.length ? '' : `<button class="btn pri lg" data-act="itemNew" data-m="${o.id}">${ic('plus')} Add something to count</button>`))
        });
      },
      after(v) { const s = v.querySelector('[data-search]'); if (s) s.oninput = () => { const q = s.value.trim().toLowerCase(); v.querySelectorAll('[data-name]').forEach(li => li.hidden = q && !li.dataset.name.includes(q)); }; }
    });
    stockModule.defs[o.id] = o;
  }
  stockModule.defs = {};
  const setCount = (id, n) => { const it = A.find('items', id); if (n > 9999) return A.toast('That number looks too big. Check it.'); const wasLow = C.isLow(it); it.count = Math.max(0, C.r2(n)); it.countedAt = nowISO(); if (!C.isLow(it)) it.orderedAt = null; A.upsert('items', it); if (!wasLow && C.isLow(it)) A.toast(it.name + ' is running low. Added to What to order.'); A.render(); };
  A.act('cnt', el => { const it = A.find('items', el.dataset.id); setCount(it.id, (+it.count || 0) + +el.dataset.d); });
  A.act('cntSet', el => setCount(el.dataset.id, +el.value || 0));
  A.act('itemNew', el => { const o = stockModule.defs[el.dataset.m]; itemForm({}, o.kinds, o.cats); });
  A.act('itemEdit', el => { const o = stockModule.defs[el.dataset.m]; itemForm(A.find('items', el.dataset.id), o.kinds, o.cats); });
  A.stockModule = stockModule;

  /* ================= WHAT TO ORDER ================= */
  function orderText(sid, lines) { return `Order for ${S().shopName}${sid ? ' from ' + supName(sid) : ''} (${C.fmtDay(today())}):\n` + lines.filter(l => !l.done).map(l => `- ${l.name}: ${l.qty} ${l.unit}`.trim()).join('\n'); }
  function supplierForm(s) {
    const isNew = !s.id;
    A.openForm({
      title: isNew ? 'Add a supplier' : 'Change ' + s.name, values: s,
      fields: [{ k: 'name', label: 'Company name', req: true, full: true }, { k: 'contact', label: 'Person to talk to' }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email' }, { k: 'orderDays', label: 'When to order', ph: 'Order Monday, arrives Wednesday' }, { k: 'note', label: 'Note', full: true, ph: 'Minimum order $150' }],
      onSave(v) { A.upsert('suppliers', { ...s, ...v }); }, onDelete: isNew ? null : () => { A.remove('suppliers', s.id); for (const i of A.D.items) if (i.supplierId === s.id) i.supplierId = ''; A.save('items'); }
    });
  }
  const openLines = () => Object.values(C.orderGroups(A.D)).flat().filter(l => !l.done);
  A.register({
    id: 'orders', title: 'What to order', short: 'Orders', icon: 'truck',
    help: { what: 'A shopping list that fills itself in.', steps: ['When a count drops below "keep at least", the item shows up here, grouped by who you buy it from.', 'Order it (call, email, or the website), then tap the box to tick it off.', 'It disappears once someone counts it again and there\'s enough.'] },
    status() { const n = openLines().length; return { text: n ? plural(n, 'thing') + ' to order' : 'Nothing to order', level: n ? 'warn' : '' }; },
    todo() { const n = openLines().length; return n ? [{ key: 'order', pri: 3, level: 'go', text: 'Order ' + plural(n, 'thing') + ' that ' + (n === 1 ? 'is' : 'are') + ' running low', sub: openLines().slice(0, 3).map(l => l.name).join(', ') + (n > 3 ? '…' : ''), btn: 'See list' }] : []; },
    render() {
      const g = C.orderGroups(A.D), ids = Object.keys(g).sort((a, b) => !a ? 1 : !b ? -1 : supName(a).localeCompare(supName(b)));
      const card = sid => { const s = A.find('suppliers', sid) || {}, lines = g[sid]; const txt = orderText(sid, lines);
        return `<div class="card"><h3>${ic('truck')} ${esc(sid ? s.name : 'Not sure where from')}</h3>
          ${s.orderDays || s.note ? `<p class="small mute" style="margin:-.3rem 0 .5rem">${esc([s.orderDays, s.note].filter(Boolean).join(' · '))}</p>` : ''}
          ${lines.map(l => `<button class="check ${l.done ? 'on' : ''}" data-act="ordToggle" data-k="${l.kind}" data-id="${l.id}"><span class="box">${ic('check')}</span><span class="lbl grow"><b>${esc(l.name)}</b> · ${l.qty} ${esc(l.unit)}<small>${l.done ? 'Ordered ✓' : l.kind === 'auto' ? `Have ${+l.item.count || 0}, keep at least ${l.item.par}` : esc(l.source || 'Added by hand')}${l.note ? ' · ' + esc(l.note) : ''}</small></span></button>`).join('')}
          <div class="cardacts">${s.phone ? `<a class="btn sm" href="tel:${esc(s.phone)}">Call</a>` : ''}${s.email ? `<a class="btn sm" href="mailto:${esc(s.email)}?subject=${encodeURIComponent('Order from ' + S().shopName)}&body=${encodeURIComponent(txt)}">Email the order</a>` : ''}<button class="btn sm" data-act="ordCopy" data-s="${sid}">${ic('copy')} Copy the list</button></div></div>`; };
      return A.page({
        title: 'What to order', what: 'Tap the box when you\'ve ordered it.',
        more: [{ label: 'Add something by hand', icon: 'plus', act: 'ordAdd' }, { label: 'Suppliers', sub: 'Who you buy from, phone numbers', icon: 'users', act: 'suppliers' }, { label: 'Clear the ticked lines', icon: 'check', act: 'ordClear' }],
        body: ids.length ? `<div class="grid g2">${ids.map(card).join('')}</div>` : `<div class="caught">${ic('check')}<div><b>Nothing to order right now.</b><small>Things show up here when a count drops below "keep at least".</small></div></div>`
      });
    },
    acts: {
      ordToggle: el => { if (el.dataset.k === 'auto') { const it = A.find('items', el.dataset.id); it.orderedAt = it.orderedAt ? null : nowISO(); A.upsert('items', it); } else { const o = A.find('orders', el.dataset.id); o.done = !o.done; A.upsert('orders', o); } A.render(); },
      ordClear: () => { const gone = A.D.orders.filter(o => o.done); A.D.orders = A.D.orders.filter(o => !o.done); A.save('orders'); A.render(); A.toast('Cleared.', 6000, { label: 'Undo', fn: () => { A.D.orders.push(...gone); A.save('orders'); A.render(); } }); },
      ordCopy: el => { const sid = el.dataset.s, t = orderText(sid, C.orderGroups(A.D)[sid] || []); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => A.toast('Copied. Paste it into a text or email.'), () => { const d = A.modal(`<h2>Order list<span class="sp"></span>${A.xBtn}</h2><textarea style="min-height:12rem">${esc(t)}</textarea>`); d.querySelector('[data-x]').onclick = () => A.closeModal(); }); },
      ordAdd: () => A.openForm({ title: 'Add to the order list', fields: [{ k: 'name', label: 'What', req: true, full: true, list: () => A.D.items.map(i => i.name) }, { k: 'qty', label: 'How many', type: 'stepper', min: 0 }, { k: 'unit', label: 'Unit', list: T.units }, { k: 'supplierId', label: 'From', type: 'select', blank: 'Not sure', opts: () => A.D.suppliers.map(s => [s.id, s.name]) }, { k: 'note', label: 'Note', full: true }], values: { qty: 1 }, onSave(v) { A.upsert('orders', { ...v, source: 'Added by hand' }); } }),
      suppliers: () => {
        const d = A.modal(`<h2>Suppliers<span class="sp"></span>${A.xBtn}</h2><ul class="list" style="margin-bottom:1rem">${A.D.suppliers.map(s => `<li><button class="row" data-s="${s.id}"><span class="grow"><b>${esc(s.name)}</b><small>${esc([s.contact, s.phone, s.orderDays].filter(Boolean).join(' · '))}</small></span>${ic('edit')}</button></li>`).join('') || '<li class="row mute">None yet.</li>'}</ul><div class="acts"><span class="sp"></span><button class="btn pri lg" data-add>${ic('plus')} Add a supplier</button></div>`);
        d.querySelector('[data-x]').onclick = () => A.closeModal(); d.querySelector('[data-add]').onclick = () => { A.closeModal(); supplierForm({}); };
        d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { A.closeModal(); supplierForm(A.find('suppliers', b.dataset.s)); });
      }
    }
  });

  /* ================= THROWN-OUT LOG (waste) ================= */
  const wasteRows = (days) => [['When', 'Item', 'Amount', 'Unit', 'Reason', 'By', 'Note']].concat(A.D.waste.filter(w => A.inRange(w.at, days)).sort((a, b) => a.at < b.at ? -1 : 1).map(w => [C.fmtWhen(w.at, ''), w.item, w.amount, w.unit || '', w.reason || '', w.by || '', w.note || '']));
  function wasteForm(w) {
    const isNew = !w.id;
    A.openForm({
      title: isNew ? 'Write down what was thrown out' : 'Change this entry', values: { at: nowISO(), by: A.by(), amount: 1, ...w },
      fields: [{ k: 'item', label: 'What', req: true, full: true, list: () => [...new Set(A.D.items.map(i => i.name).concat(A.D.recipes.map(r => r.name), T.wasteItems || []))] }, { k: 'amount', label: 'How much', type: 'stepper', min: 0, req: true }, { k: 'unit', label: 'Unit', list: T.units, ph: 'cups, bottles…' },
        { k: 'reason', label: 'Why', type: 'chips', opts: T.wasteReasons, req: true }, { k: 'by', label: 'Your name', list: A.staffNames }, { k: 'at', label: 'When', type: 'datetime', past: true }, { k: 'note', label: 'Note (optional)', full: true }],
      onSave(v) { if (!(+v.amount > 0)) return 'How much: type a number bigger than 0.'; A.rememberBy(v.by); A.upsert('waste', { ...w, ...v }); A.toast('Written down. Thanks!'); },
      del: isNew ? null : { coll: 'waste', id: w.id, label: 'Entry deleted' }
    });
  }
  A.wasteForm = wasteForm;
  function wasteWizard() {
    const common = [...new Set((T.wasteItems || []).concat(A.D.waste.slice(-20).map(w => w.item)))].slice(0, 9);
    A.wizard({
      title: 'Write down what was thrown out', doneLabel: 'Save',
      steps: [
        { k: 'pick', q: 'What did you throw out?', type: 'chips', opts: common.concat(['Something else']) },
        { k: 'other', q: 'What was it?', type: 'text', ph: 'e.g. Taro milk tea', skipIf: v => v.pick !== 'Something else' },
        { k: 'amount', q: 'How much?', hint: 'A rough guess is fine.', type: 'number', def: 1, max: 9999, positive: true },
        { k: 'unit', q: 'Counted in…', type: 'chips', opts: T.wasteUnits || ['cups', 'drinks', 'qt', 'gal', 'bottles', 'each', 'batches'] },
        { k: 'reason', q: 'Why was it thrown out?', type: 'chips', opts: T.wasteReasons }
      ],
      onDone(v) { A.upsert('waste', { item: v.pick === 'Something else' ? v.other : v.pick, amount: +v.amount, unit: v.unit, reason: v.reason, by: A.by(), at: nowISO() }); A.toast('Written down. Thanks!'); return ''; }
    });
  }
  A.register({
    id: 'waste', title: 'Thrown-out log', short: 'Waste', icon: 'trash',
    help: { what: 'Write down anything that gets thrown away, and why.', steps: ['Tap Write one down.', 'Tap what it was, how much, and why. Three taps.', 'The owner uses this to make less of what gets wasted.'] },
    status() { const n = A.D.waste.filter(w => C.ymd(new Date(w.at)) === today()).length; return { text: n ? plural(n, 'thing') + ' today' : 'Nothing today' }; },
    render() {
      const days = ui.wRange == null ? 7 : ui.wRange, list = A.D.waste.filter(w => A.inRange(w.at, days)).sort((a, b) => a.at < b.at ? 1 : -1);
      const byR = {}; for (const w of list) byR[w.reason || 'Other'] = (byR[w.reason || 'Other'] || 0) + 1;
      return A.page({
        title: 'Thrown-out log', what: 'Threw something away? Write it down here. Three taps.',
        primary: `<button class="btn pri lg" data-act="wasteNew">${ic('plus')} Write one down</button>`,
        more: [{ label: 'Spreadsheet', icon: 'download', act: 'wasteCsv' }],
        body: `<div class="bar">${A.rangeSeg('wRange', 7)}<span style="flex:1"></span>${Object.entries(byR).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<span class="tag">${esc(r)}: ${n}</span>`).join(' ')}</div>
          <ul class="list">${list.map(w => `<li><button class="row" data-act="wasteEdit" data-id="${w.id}">${ic('trash')}<span class="grow"><b>${esc(w.amount)} ${esc(w.unit || '')} ${esc(w.item)}</b><small>${esc(w.reason || '')} · ${C.fmtWhen(w.at, today())}${w.by ? ' · ' + esc(w.by) : ''}${w.note ? ' · ' + esc(w.note) : ''}</small></span></button></li>`).join('') || '<li class="row mute">Nothing written down in this time.</li>'}</ul>`
      });
    },
    acts: { wasteNew: () => needWho(wasteWizard), wasteEdit: el => wasteForm(A.find('waste', el.dataset.id)), wasteCsv: () => A.csvDownload('thrown-out', wasteRows(ui.wRange == null ? 7 : ui.wRange)) },
    csv: [['Thrown-out log', () => ['thrown-out', wasteRows('all')]]]
  });

  /* ================= CLEANING LOG ================= */
  const WHEN = ['Opening', 'During shift', 'Closing', 'Weekly', 'Monthly'];
  const cleanRows = days => [['When', 'Job', 'Area', 'Done by', 'Note']].concat(A.D.cleanLogs.filter(l => A.inRange(l.at, days)).sort((a, b) => a.at < b.at ? -1 : 1).map(l => [C.fmtWhen(l.at, ''), l.task, (A.find('cleanTasks', l.taskId) || {}).area || '', l.by || '', l.note || '']));
  const lastClean = id => A.D.cleanLogs.filter(l => l.taskId === id).sort((a, b) => a.at < b.at ? 1 : -1)[0];
  const cleanDue = x => { const l = lastClean(x.id); if (!l) return true; const d = C.daysBetween(C.ymd(new Date(l.at)), today()); return x.when === 'Weekly' ? d >= 7 : x.when === 'Monthly' ? d >= 30 : d >= 1; };
  A.register({
    id: 'cleaning', title: 'Cleaning', short: 'Cleaning', icon: 'sparkle',
    help: { what: 'The cleaning jobs, and a record of who did them.', steps: ['Do a cleaning job.', 'Tap Done next to it. Your name and the time are saved.', 'Jobs that are due show in yellow.'], tip: 'Not sure how? Ask a shift lead the first time. The job names say what to clean.' },
    status() { const due = A.D.cleanTasks.filter(x => ['Closing', 'Weekly', 'Monthly'].includes(x.when) && cleanDue(x) && (x.when !== 'Closing' || nowMin() >= closeM() - 60)).length; return { text: due ? plural(due, 'job') + ' due' : 'Up to date', level: due ? 'warn' : '' }; },
    todo() {
      const out = [], cl = A.D.cleanTasks.filter(x => x.when === 'Closing' && cleanDue(x));
      if (cl.length && nowMin() >= closeM() - 60) out.push({ key: 'cclose', pri: 2, level: 'go', text: 'Do the closing cleaning', sub: plural(cl.length, 'job') + ' left: ' + cl.slice(0, 2).map(x => x.name.toLowerCase()).join(', ') + (cl.length > 2 ? '…' : ''), btn: 'See jobs' });
      const lg = A.D.cleanTasks.filter(x => ['Weekly', 'Monthly'].includes(x.when) && cleanDue(x));
      if (lg.length) out.push({ key: 'cweek', pri: 3, level: 'go', text: lg.length === 1 ? lg[0].name : plural(lg.length, 'weekly/monthly cleaning job') + ' due', sub: lg.length === 1 ? (lg[0].when + ' job') : lg.map(x => x.name).slice(0, 2).join(', '), btn: 'See jobs' });
      return out;
    },
    render() {
      const tasks = A.D.cleanTasks, days = ui.clRange == null ? 7 : ui.clRange, t = today();
      const hist = A.D.cleanLogs.filter(l => A.inRange(l.at, days)).sort((a, b) => a.at < b.at ? 1 : -1);
      const groups = WHEN.map(w => [w, tasks.filter(x => (x.when || 'Closing') === w)]).filter(g => g[1].length);
      return A.page({
        title: 'Cleaning', what: 'Do the job, then tap Done.',
        more: [{ label: 'Change the cleaning jobs', icon: 'edit', act: 'clTasks' }, { label: 'Spreadsheet', icon: 'download', act: 'clCsv' }],
        body: (groups.length ? `<div class="grid g2">${groups.map(([w, ts]) => `<div class="card"><h3>${esc(w)}</h3>${ts.map(x => { const l = lastClean(x.id), dt = l && C.ymd(new Date(l.at)) === t, due = cleanDue(x) && x.when !== 'During shift' && x.when !== 'Opening'; return `<div class="row ${due ? 'low' : ''}" style="padding:.5rem .4rem"><span class="grow"><b>${esc(x.name)}</b><small>${dt ? '✓ Done ' + C.fmtClock(Date.parse(l.at)) + (l.by ? ' by ' + esc(l.by) : '') : l ? 'Last done ' + C.fmtWhen(l.at, t) : 'Not done yet'}${x.note ? ' · ' + esc(x.note) : ''}</small></span><button class="btn ${dt ? '' : 'pri'}" data-act="clLog" data-id="${x.id}">${ic('check')} Done</button></div>`; }).join('')}</div>`).join('')}</div>`
          : A.empty('No cleaning jobs yet.', `<button class="btn pri lg" data-act="clTasks">Add cleaning jobs</button>`))
          + A.past('Who cleaned what', `<div class="bar">${A.rangeSeg('clRange', 7)}</div><div class="tbl-wrap"><table class="tbl"><tr><th>When</th><th>Job</th><th>By</th><th>Note</th></tr>${hist.map(l => `<tr><td>${C.fmtWhen(l.at, t)}</td><td>${esc(l.task)}</td><td>${esc(l.by || '')}</td><td>${esc(l.note || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="mute">Nothing in this time.</td></tr>'}</table></div>`)
          + A.legal('This is your own record, not a health-code checklist.', 'Your local health department and your sanitizer label decide what to clean and how often. Change these jobs to match.')
      });
    },
    acts: {
      clLog: el => needWho(() => { const x = A.find('cleanTasks', el.dataset.id); const r = A.upsert('cleanLogs', { taskId: x.id, task: x.name, at: nowISO(), by: A.by() }); A.render(); A.toast('✓ ' + x.name, 6000, { label: 'Undo', fn: () => { A.remove('cleanLogs', r.id); A.render(); } }); }),
      clCsv: () => A.csvDownload('cleaning', cleanRows(ui.clRange == null ? 7 : ui.clRange)),
      clTasks: () => {
        const d = A.modal(`<h2>Cleaning jobs<span class="sp"></span>${A.xBtn}</h2><ul class="list" style="margin-bottom:1rem">${A.D.cleanTasks.map(x => `<li><button class="row" data-t="${x.id}"><span class="grow"><b>${esc(x.name)}</b><small>${esc([x.when, x.area].filter(Boolean).join(' · '))}</small></span>${ic('edit')}</button></li>`).join('') || '<li class="row mute">None.</li>'}</ul><div class="acts"><span class="sp"></span><button class="btn pri lg" data-add>${ic('plus')} Add a job</button></div>`);
        const form = x => { A.closeModal(); A.openForm({ title: x.id ? 'Change this job' : 'Add a cleaning job', values: x, fields: [{ k: 'name', label: 'The job', req: true, full: true, ph: 'Wipe the fridge handles' }, { k: 'when', label: 'How often', type: 'chips', opts: WHEN, req: true }, { k: 'area', label: 'Where (optional)' }, { k: 'note', label: 'How to do it (optional)', full: true }], onSave(v) { A.upsert('cleanTasks', { ...x, ...v }); }, del: x.id ? { coll: 'cleanTasks', id: x.id, label: 'Job removed' } : null }); };
        d.querySelector('[data-x]').onclick = () => A.closeModal(); d.querySelector('[data-add]').onclick = () => form({ when: 'Closing' });
        d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => form(A.find('cleanTasks', b.dataset.t)));
      }
    },
    csv: [['Cleaning log', () => ['cleaning', cleanRows('all')]]]
  });

  /* ================= FRIDGE TEMPERATURES ================= */
  const tScale = () => S().tempUnit === 'C' ? '°C' : '°F';
  const okT = (u, t) => (u.min === '' || u.min == null || t >= +u.min) && (u.max === '' || u.max == null || t <= +u.max);
  const rangeTxt = u => (u.min !== '' && u.min != null && u.max !== '' && u.max != null) ? `${u.min} to ${u.max}${tScale()}` : (u.max !== '' && u.max != null) ? `${u.max}${tScale()} or colder` : `${u.min}${tScale()} or warmer`;
  const tempRows = days => [['When', 'Fridge', 'Reading', 'Scale', 'OK?', 'What was done', 'By']].concat(A.D.tempLogs.filter(l => A.inRange(l.at, days)).sort((a, b) => a.at < b.at ? -1 : 1).map(l => [C.fmtWhen(l.at, ''), l.unitName, l.temp, l.scale || '', l.ok ? 'yes' : 'NO', l.action || '', l.by || '']));
  const notToday = () => A.D.tempUnits.filter(u => !A.D.tempLogs.some(l => l.unitId === u.id && C.ymd(new Date(l.at)) === today()));
  function saveTemp(u, temp, extra) { A.upsert('tempLogs', { unitId: u.id, unitName: u.name, temp, scale: tScale(), ok: okT(u, temp), at: nowISO(), by: A.by(), ...extra }); }
  A.register({
    id: 'temps', title: 'Fridge temperatures', short: 'Temps', icon: 'thermo',
    help: { what: 'Check that the fridges are cold enough, once a day.', steps: ['Open each fridge and read the thermometer inside.', 'Type the number in the box next to that fridge, then tap Save.', 'If it\'s too warm, the app asks what you did about it. Tell a manager too.'] },
    status() { const n = notToday().length; return { text: !A.D.tempUnits.length ? 'No fridges added' : n ? plural(n, 'fridge') + ' to check' : 'All checked today ✓', level: n && nowMin() >= openM() ? 'warn' : '' }; },
    todo() { if (!A.D.tempUnits.length) return []; const n = notToday(); if (!n.length) return [{ done: true, text: 'Fridge temps' }]; return nowMin() >= openM() - 60 ? [{ key: 'temps', pri: 2, level: 'go', text: 'Check the fridge temperatures', sub: plural(n.length, 'fridge') + ' to check. Takes 2 minutes.', btn: 'Check' }] : []; },
    render() {
      const days = ui.tRange == null ? 7 : ui.tRange, t = today(), hist = A.D.tempLogs.filter(l => A.inRange(l.at, days)).sort((a, b) => a.at < b.at ? 1 : -1);
      return A.page({
        title: 'Fridge temperatures', what: 'Read the thermometer inside each fridge. Type the number. Tap Save.',
        more: [{ label: 'Change the fridges', sub: 'Names and the OK range', icon: 'edit', act: 'tUnits' }, { label: 'Spreadsheet', icon: 'download', act: 'tCsv' }],
        body: (A.D.tempUnits.length ? `<div class="grid">${A.D.tempUnits.map(u => { const l = A.D.tempLogs.filter(x => x.unitId === u.id).sort((a, b) => a.at < b.at ? 1 : -1)[0]; const td = l && C.ymd(new Date(l.at)) === t; return `<div class="card fridge ${td ? (l.ok ? 'okd' : 'badd') : ''}"><h3>${ic('thermo')} ${esc(u.name)}</h3><p class="small mute">Should be ${rangeTxt(u)}</p>
            ${td ? `<p class="done">${l.ok ? ic('check') : ic('alert')} <b>${l.temp}${esc(l.scale || '')}</b> at ${C.fmtClock(Date.parse(l.at))}${l.by ? ' by ' + esc(l.by) : ''}</p>` : ''}
            <form data-tform="${u.id}" class="tform"><input type="number" inputmode="decimal" step="0.1" name="t" placeholder="${td ? 'Check again' : 'Type number'}" aria-label="${esc(u.name)} temperature"><span class="unit">${tScale()}</span><button class="btn pri">${ic('check')} Save</button></form></div>`; }).join('')}</div>`
          : A.empty('No fridges added yet.', `<button class="btn pri lg" data-act="tUnits">Add a fridge</button>`))
          + A.past('Past readings', `<div class="bar">${A.rangeSeg('tRange', 7)}</div><div class="tbl-wrap"><table class="tbl"><tr><th>When</th><th>Fridge</th><th class="n">Reading</th><th>What was done</th><th>By</th></tr>${hist.map(l => `<tr class="${l.ok ? '' : 'bad'}"><td>${C.fmtWhen(l.at, t)}</td><td>${esc(l.unitName)}</td><td class="n">${l.temp}${esc(l.scale || '')}</td><td>${esc(l.action || '')}</td><td>${esc(l.by || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">None in this time.</td></tr>'}</table></div>`)
          + A.legal('The OK ranges are starting points you can change.', 'Set them to what your local health department requires. This log is your own record.')
      });
    },
    after(v) {
      v.querySelectorAll('[data-tform]').forEach(f => f.onsubmit = e => {
        e.preventDefault(); const u = A.find('tempUnits', f.dataset.tform), raw = f.t.value.trim(); if (raw === '') return A.toast('Type the number from the thermometer first.');
        const temp = +raw, F = S().tempUnit !== 'C';
        if (isNaN(temp) || temp < (F ? -40 : -40) || temp > (F ? 130 : 55)) return A.toast("That doesn't look like a fridge temperature. Check the thermometer again.", 5000);
        needWho(() => {
          if (okT(u, temp)) { saveTemp(u, temp); A.render(); A.toast(u.name + ': ' + temp + tScale() + '. That\'s fine ✓'); return; }
          A.openForm({
            title: `${u.name} is ${temp > +u.max ? 'too warm' : 'too cold'} (${temp}${tScale()})`, intro: `It should be ${rangeTxt(u)}. Check the thermometer again. If it's really ${temp}${tScale()}, do something about it, then tap what you did. <b>Tell a manager.</b>`, saveLabel: 'Save reading',
            fields: [{ k: 'what', label: 'What did you do?', type: 'chips', req: true, opts: ['Moved food to another fridge', 'Turned the fridge colder', 'Closed the door properly', 'Will check again in 30 min', 'Threw food out', 'Told the manager'] }, { k: 'more', label: 'Anything else? (optional)', full: true }],
            onSave(x) { saveTemp(u, temp, { action: [x.what, x.more].filter(Boolean).join('. ') }); A.toast('Saved. Don\'t forget to tell a manager.', 5000); }
          });
        });
      });
    },
    acts: {
      tCsv: () => A.csvDownload('fridge-temperatures', tempRows(ui.tRange == null ? 7 : ui.tRange)),
      tUnits: () => {
        const d = A.modal(`<h2>Fridges & freezers<span class="sp"></span>${A.xBtn}</h2><ul class="list" style="margin-bottom:1rem">${A.D.tempUnits.map(u => `<li><button class="row" data-u="${u.id}"><span class="grow"><b>${esc(u.name)}</b><small>OK: ${rangeTxt(u)}</small></span>${ic('edit')}</button></li>`).join('') || '<li class="row mute">None yet.</li>'}</ul><div class="acts"><span class="sp"></span><button class="btn pri lg" data-add>${ic('plus')} Add a fridge</button></div>`);
        const form = u => { A.closeModal(); A.openForm({ title: u.id ? 'Change ' + u.name : 'Add a fridge or freezer', values: u, fields: [{ k: 'name', label: 'Name', req: true, full: true, ph: 'Milk fridge' }, { k: 'min', label: 'Coldest that\'s OK (' + tScale() + ')', type: 'number' }, { k: 'max', label: 'Warmest that\'s OK (' + tScale() + ')', type: 'number' }], onSave(v) { if (v.min !== '' && v.max !== '' && v.min > v.max) return 'The coldest number is bigger than the warmest. Swap them?'; A.upsert('tempUnits', { ...u, ...v }); }, del: u.id ? { coll: 'tempUnits', id: u.id, label: 'Fridge removed' } : null }); };
        d.querySelector('[data-x]').onclick = () => A.closeModal(); d.querySelector('[data-add]').onclick = () => form({});
        d.querySelectorAll('[data-u]').forEach(b => b.onclick = () => form(A.find('tempUnits', b.dataset.u)));
      }
    },
    csv: [['Fridge temperatures', () => ['fridge-temperatures', tempRows('all')]]]
  });

  /* ================= DRINK RECIPES (with practice mode) ================= */
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const specHtml = r => `<div class="rc"><span class="cat">${esc(r.cat || '')}</span><h4>${esc(r.name)}</h4>${r.sizes ? `<p class="small"><b>Sizes:</b> ${esc(r.sizes)}</p>` : ''}
    ${lines(r.ingredients).length ? `<div><b>What goes in</b><ul>${lines(r.ingredients).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${lines(r.steps).length ? `<div><b>How to make it</b><ol>${lines(r.steps).map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    ${r.notes ? `<p class="small"><b>Tip:</b> ${esc(r.notes)}</p>` : ''}${r.allergens ? `<p class="small"><span class="tag warn">Allergens</span> ${esc(r.allergens)}</p>` : ''}</div>`;
  function recipeForm(r) {
    const isNew = !r.id;
    A.openForm({
      title: isNew ? 'Add a recipe' : 'Change ' + r.name, values: r, cls: 'wide',
      fields: [{ k: 'name', label: 'Drink name', req: true }, { k: 'cat', label: 'Type', list: T.recipeCats }, { k: 'sizes', label: 'Sizes', full: true, ph: T.sizesPh },
        { k: 'ingredients', label: 'What goes in (one per line)', type: 'textarea', ph: T.buildPh }, { k: 'steps', label: 'How to make it (one step per line)', type: 'textarea' }, { k: 'notes', label: 'Tip for new people', full: true }, { k: 'allergens', label: 'Allergens', full: true, ph: 'Milk, soy…' }],
      onSave(v) { A.upsert('recipes', { ...r, ...v }); A.toast('Recipe saved.'); }, del: isNew ? null : { coll: 'recipes', id: r.id, label: 'Recipe deleted' }
    });
  }
  A.register({
    id: 'recipes', title: 'Drink recipes', short: 'Recipes', icon: 'book',
    help: { what: 'How to make every drink. Great for learning.', steps: ['Tap a drink to see what goes in it and how to make it.', 'New here? Tap Practice. It shows a drink name; say how you\'d make it, then tap to check.', 'Recipe wrong? Tell a manager. They can change it.'] },
    status() { return { text: plural(A.D.recipes.length, 'drink') }; },
    render(p) {
      const all = A.D.recipes.slice().sort((a, b) => a.name.localeCompare(b.name)), cats = [...new Set(all.map(r => r.cat || 'Other'))], f = ui.rcCat || 'All';
      const list = all.filter(r => f === 'All' || (r.cat || 'Other') === f);
      if (p === 'train') {
        if (!list.length) return A.page({ title: 'Practice', body: A.empty('No recipes to practise yet.') });
        const i = ((ui.trI || 0) % list.length + list.length) % list.length, r = list[i];
        return A.page({ title: 'Practice', what: `Drink ${i + 1} of ${list.length}. Say how you'd make it, then tap the card to check.`, noHelp: true, primary: `<button class="btn lg" data-go="recipes">${ic('check')} I'm done</button>`,
          body: `<div class="card flash" data-act="trFlip">${ui.trFlip ? specHtml(r) : `<div><span class="tag mode">${esc(r.cat || '')}</span><h4 style="margin-top:.6rem">${esc(r.name)}</h4><p class="mute" style="margin-top:.6rem">${r.sizes ? esc(r.sizes) + '<br>' : ''}Tap to see the answer</p></div>`}</div>
          <div style="display:flex;justify-content:space-between;margin-top:1rem"><button class="btn lg" data-act="trStep" data-d="-1">${ic('left')} Back</button><button class="btn pri lg" data-act="trStep" data-d="1">Next drink ${ic('right')}</button></div>` });
      }
      return A.page({
        title: 'Drink recipes', what: 'Tap a drink to see how to make it.',
        primary: all.length ? `<button class="btn pri lg" data-go="recipes" data-p="train">${ic('star')} Practice</button>` : '',
        more: [{ label: 'Add a recipe', icon: 'plus', act: 'rcNew' }, { label: 'Print all recipes', icon: 'print', act: 'print' }],
        body: (cats.length > 1 ? `<div class="chips big noprint" style="margin-bottom:1rem">${['All', ...cats].map(c => `<button data-act="setui" data-k="rcCat" data-v="${esc(c)}" class="${c === f ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>` : '')
          + (list.length ? `<div class="grid">${list.map(r => `<button class="card tile2" data-act="rcView" data-id="${r.id}"><span class="cat">${esc(r.cat || '')}</span><b>${esc(r.name)}</b><small>${esc(r.sizes || '')}</small></button>`).join('')}</div>` : A.empty('No recipes yet.', `<button class="btn pri lg" data-act="rcNew">${ic('plus')} Add a recipe</button>`))
      });
    },
    acts: {
      rcNew: () => recipeForm({}),
      rcView: el => { const r = A.find('recipes', el.dataset.id); const d = A.modal(`<div style="display:flex"><span class="sp" style="flex:1"></span>${A.xBtn}</div>${specHtml(r)}<div class="acts"><button class="btn sm ghost" data-e>${ic('edit')} Change recipe</button><span class="sp"></span><button class="btn pri lg" data-ok>Close</button></div>`); d.querySelector('[data-x]').onclick = d.querySelector('[data-ok]').onclick = () => A.closeModal(); d.querySelector('[data-e]').onclick = () => { A.closeModal(); recipeForm(r); }; },
      trFlip: () => { ui.trFlip = !ui.trFlip; A.render(); }, trStep: el => { ui.trI = (ui.trI || 0) + +el.dataset.d; ui.trFlip = false; A.render(); }
    }
  });

  /* ================= CUSTOMER SCREEN: Play while you wait ================= */
  function qrSvg(url) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'QR code for ' + url }); } catch (e) { return ''; } }
  A.qrSvg = qrSvg;
  A.register({
    id: 'customer', title: 'Screen for customers', short: 'Customers', icon: 'qr',
    help: { what: 'A full-screen sign with a QR code customers can scan to play games while they wait.', steps: ['Open this on a spare tablet or screen facing customers.', 'Tap Close (top right) to go back.'] },
    visible: () => !!A.PLAY_URL,
    status() { return { text: 'QR code for customers' }; },
    render() {
      if (!A.PLAY_URL || !S().showPlay) return A.page({ title: 'Screen for customers', body: A.empty('This is turned off in Settings.') });
      return `<div class="cust"><button class="btn x noprint" data-go="home">${ic('x')} Close</button><div class="in">${T.custArt || ''}<h1>${esc(S().shopName)}</h1><p>${esc(T.custLine)}</p>
        <div class="qr">${qrSvg(A.PLAY_URL)}</div><p><b>Play while you wait</b><br>Point your phone camera here. Free games, nothing to download.</p><span class="url">${esc(A.PLAY_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span></div></div>`;
    }
  });

  /* ================= SETTINGS & BACKUP ================= */
  A.register({
    id: 'settings', title: 'Settings & backup', short: 'Settings', icon: 'gear', core: true,
    help: { what: 'Save a backup, change your shop\'s details, and pick which tools show up.', steps: ['Tap Save a backup once a week. Keep the file somewhere safe, like your email.', 'Turn off tools you don\'t use so the app stays simple.', 'Lost everything? Tap Restore from a backup file.'] },
    status() { const m = A.meta; return { text: m.lastBackupAt ? 'Backed up ' + C.fmtWhen(m.lastBackupAt, today()).replace(/ \d+:\d+ [AP]M/, '') : 'Never backed up', level: A.backupDue() ? 'warn' : '' }; },
    render() {
      const s = S(), m = A.meta, demoN = A.COLLS.reduce((n, c) => n + A.D[c].filter(r => r.demo).length, 0);
      const opt = T.groups.flatMap(g => g[1]).filter(id => A.MODS[id] && !A.MODS[id].core && (!A.MODS[id].visible || A.MODS[id].visible()));
      const shopF = [{ k: 'shopName', label: 'Shop name', req: true, full: true, max: 28 }, { k: 'openAt', label: 'We open at', type: 'time' }, { k: 'closeAt', label: 'We close at', type: 'time' }, { k: 'tempUnit', label: 'Temperatures in', type: 'chips', opts: [['F', '°F'], ['C', '°C']] }, { k: 'bigText', label: 'Bigger text and buttons', type: 'check' }, { k: 'sound', label: 'Beep when something needs throwing out', type: 'check' }];
      const advF = [{ k: 'weekStart', label: 'Week starts on', type: 'select', blank: false, opts: C.DNL.map((d, i) => [i, d]) }, { k: 'backupEveryDays', label: 'Remind me to back up every', type: 'number', min: 0, step: 1, hint: 'days (0 = never)' },
        { k: 'warnMin', label: 'Warn before throw-out time', type: 'number', min: 0, step: 1, hint: 'minutes' }].concat(A.PLAY_URL ? [{ k: 'showPlay', label: 'Show "Play while you wait" for customers', type: 'check' }] : []).concat(T.settingsFields || []);
      A.ui._sf = shopF.concat(advF);
      const sa = A.isStandalone();
      return A.page({
        title: 'Settings & backup', what: '',
        body: `<div class="card backupcard ${A.backupDue() ? 'due' : ''}"><h3>${ic('shield')} Backup</h3><p>Everything is saved on this device only. If it breaks or the browser gets cleared, a backup file is the only way to get it back.</p>
          <p class="small"><b>Last backup:</b> ${m.lastBackupAt ? esc(C.fmtWhen(m.lastBackupAt, today())) : 'never'}</p>
          <div class="cardacts"><button class="btn pri lg" data-act="backup">${ic('download')} Save a backup</button><label class="btn lg" for="imp">${ic('upload')} Restore from a backup file</label></div></div>
          <form data-sform><h3 class="sec">Your shop</h3><div class="card">${A.formHtml(shopF, s)}</div>
          <h3 class="sec">Tools you use</h3><div class="card"><p class="small mute" style="margin-bottom:.6rem">Turn off what you don't need. It disappears from the app (nothing is deleted).</p><div class="pick">${opt.map(id => { const mm = A.MODS[id], on = !(s.off || []).includes(id); return `<label class="pk ${on ? 'on' : ''}"><input type="checkbox" data-mod="${id}" ${on ? 'checked' : ''}><span class="ti">${ic(mm.icon)}</span><span class="grow"><b>${esc(mm.title)}</b><small>${esc((mm.help && mm.help.what) || '')}</small></span></label>`; }).join('')}</div></div>
          ${A.past('More settings', `<div class="card">${A.formHtml(advF, s)}</div>`)}
          <div class="savebar"><button class="btn pri lg">${ic('check')} Save settings</button></div></form>
          ${A.SITE && A.meta.shopId ? `<h3 class="sec">Your shop on Grug</h3><div class="card"><p class="small">This dashboard, your <a href="../../rewards/">rewards card</a> and your <a href="../site/">website</a> are your shop's account on Grug. The bar at the bottom moves between them.</p><div class="cardacts"><button class="btn" data-act="toPlayer">Switch to your player account</button></div></div>` : ''}
          ${window.GrugContact && GrugContact.rows().length ? `<h3 class="sec">Help from the people who made this</h3><div class="card"><p class="small">Setting it up, a question, or something not working? We answer. The <b>Contact us</b> button at the top is always there too.</p><div class="cardacts">${GrugContact.rows().map(([k, title, sub, href]) => `<a class="btn" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(title)}</a>`).join('')}</div></div>` : ''}
          <h3 class="sec">People</h3><div class="card"><p>${A.staff().map(e => esc(e.name)).join(', ') || 'Nobody added yet.'}</p><button class="btn" data-act="team">${ic('users')} Add or change people</button></div>
          <h3 class="sec">Put it on your home screen</h3>${window.SHOP_PWA === 'site' ? `<div data-app-card="${T.id}" data-app-status hidden></div>` : ''}<div class="card">${sa ? '<p>✓ It\'s already installed as an app.</p>' : `<p class="small">${window.SHOP_PWA ? 'Then it opens like an app and works without internet.' : 'This is the single-file preview. Once it\'s on your website you can install it as an app.'}</p>
            ${A.installEvt ? `<button class="btn pri" data-act="install" style="margin:.6rem 0">${ic('download')} Install app</button>` : ''}
            <ul class="small" style="margin:.6rem 0 0;padding-left:1.1rem"><li><b>iPhone / iPad:</b> open in Safari → Share button → <b>Add to Home Screen</b>.</li><li><b>Android:</b> Chrome menu ⋮ → <b>Install app</b>.</li><li><b>Computer:</b> Chrome or Edge → install icon in the address bar.</li></ul>`}</div>
          ${A.past('Spreadsheets (for payroll or your accountant)', `<div class="card">${A.CSVS.filter(x => A.isOn(x[2])).map(([label], i) => `<button class="row" data-act="csvAny" data-i="${A.CSVS.findIndex(y => y[0] === label)}">${ic('download')}<span class="grow">${esc(label)}</span></button>`).join('')}</div>`)}
          ${A.past('Danger zone', `<div class="card"><p class="small">Saved under keys starting with <code>${esc(A.PRE)}</code>, separate from your other Grug dashboards. ${(A.Store.bytes() / 1024).toFixed(0)} KB used.</p><div class="cardacts">${demoN ? `<button class="btn" data-act="clearDemo">Remove the pretend data (${demoN})</button>` : ''}<button class="btn danger" data-act="erase">${ic('trash')} Erase everything</button></div></div>`)}`
      });
    },
    after(v) {
      const f = v.querySelector('[data-sform]'); if (!f) return;
      v.querySelectorAll('[data-mod]').forEach(c => c.onchange = () => c.closest('.pk').classList.toggle('on', c.checked));
      f.onsubmit = e => {
        e.preventDefault(); const x = A.readForm(f, A.ui._sf); if (!x.shopName) return A.toast('The shop needs a name.');
        const old = S().tempUnit; x.weekStart = +x.weekStart; x.backupEveryDays = x.backupEveryDays === '' ? 7 : +x.backupEveryDays; x.warnMin = +x.warnMin || 0;
        x.off = [...v.querySelectorAll('[data-mod]')].filter(c => !c.checked).map(c => c.dataset.mod);
        if (x.tempUnit && x.tempUnit !== old) { const cv = t => t === '' || t == null ? t : C.r2(x.tempUnit === 'C' ? (t - 32) * 5 / 9 : t * 9 / 5 + 32); for (const u of A.D.tempUnits) { u.min = cv(u.min); u.max = cv(u.max); u.updatedAt = A.nowISO(); } A.save('tempUnits'); }
        const renamed = x.shopName !== S().shopName;
        A.setSettings(x); if (renamed) A.renameShop(x.shopName); ui.wk = ui.hw = null; A.render(); A.toast(renamed && A.SITE ? 'Saved. Your rewards card and website use the new name too.' : 'Settings saved.');
      };
    },
    acts: {
      csvAny: el => { const [, fn] = A.CSVS[+el.dataset.i]; const [name, rows] = fn(); A.csvDownload(name, rows); },
      clearDemo: async () => { if (!(await A.confirmBox({ title: 'Remove the pretend data?', body: 'This removes the pretend people, shifts and entries. Your own entries and starter lists stay.', ok: 'Remove it' }))) return; for (const c of A.COLLS) A.D[c] = A.D[c].filter(r => !r.demo); A.save(); A.render(); A.toast('Pretend data removed. Ready for real use!'); },
      erase: async () => { if (!(await A.confirmBox({ title: 'Erase everything?', body: 'Every schedule, clock-in, log and setting for <b>' + esc(S().shopName) + '</b> on this device will be deleted. Save a backup first if you might need it.', ok: 'Erase', danger: true, typed: 'ERASE' }))) return; A.Store.clear(); location.hash = ''; location.reload(); }
    }
  });
})();
