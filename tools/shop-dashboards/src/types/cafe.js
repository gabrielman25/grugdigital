/* ==========================================================================
   Business type: Coffee shop / café
   Names, colours, nav, rush windows and starter lists. Extra modules (espresso dial-in, beans,
   milk, equipment cleaning, pastry counts) are in cafe.mods.js.
   ========================================================================== */
window.SHOP_TYPE = {
  id: 'cafe', name: 'Café', kind: 'coffee shop', version: '1.0.0',
  storagePrefix: 'grug-cafe:',
  cardType: 'c',   // the rewards card's kind (assets/rewards.js KINDS) when the shop gets one on the site
  icon: 'coffee',
  tagline: 'Dial-in notes, bean freshness, milk dates, machine cleaning and the morning rush, plus the daily paperwork.',
  namePh: 'Morning Ritual Coffee',
  starterNote: 'Opening and closing checklists, a cleaning schedule for the espresso machine, grinders, steam wands and ice machine, milk types, cups and lids with par levels, pastry pars, fridge ranges and a few example drink specs.',
  theme: { mode: '#E9B872', lo: '#C08A3E', bg: '#F6F1EA', accent2: '#8FD3B6', accent2lo: '#4E9E7E' },
  colls: ['dialins', 'milks', 'equipment', 'equipLogs', 'pastries', 'pastryCounts'],
  collLabels: { employees: 'Team members', shifts: 'Shifts', punches: 'Time clock punches', checklists: 'Checklists', checkRuns: 'Checklist tick-offs', handoffs: 'Shift notes', cashouts: 'Cash-outs', items: 'Stock items & beans', suppliers: 'Suppliers & roasters', orders: 'Order lines', waste: 'Waste entries', cleanTasks: 'Cleaning tasks', cleanLogs: 'Cleaning entries', tempUnits: 'Fridges', tempLogs: 'Temperature readings', recipes: 'Drink specs', dialins: 'Dial-in shots', milks: 'Milk cartons', equipment: 'Equipment tasks', equipLogs: 'Equipment cleanings', pastries: 'Pastries', pastryCounts: 'Pastry counts' },
  groups: [['Every shift', ['dialin', 'checklists', 'clock', 'milk', 'pastry', 'equipment', 'temps', 'cleaning', 'waste', 'handoff', 'recipes']], ['Stock & ordering', ['stock', 'beans', 'orders']], ['For the manager', ['schedule', 'cashout', 'customer', 'settings']]],
  hours: ['07:00', '16:00'],
  tabs: ['home', 'dialin', 'clock', 'checklists'],
  hero: 'dialin',
  stockHome: 'stock',
  peaks: [
    { id: 'pk-morning', label: 'Morning rush', start: '07:00', end: '09:30', days: [1, 2, 3, 4, 5], minStaff: 3 },
    { id: 'pk-lunch', label: 'Lunch', start: '11:30', end: '13:30', days: [1, 2, 3, 4, 5], minStaff: 2 },
    { id: 'pk-brunch', label: 'Weekend brunch', start: '08:30', end: '12:30', days: [0, 6], minStaff: 3 }
  ],
  
  rushIntro: 'Cafés get slammed in the morning and at weekend brunch. Tell the app when, and how many people you want working then. The schedule turns red if there aren\'t enough.',
  defaultShift: ['06:30', '14:30'],
  stations: ['Bar', 'Register', 'Pastry case', 'Floor', 'Dish'],
  roles: ['Shift lead', 'Barista', 'Cashier', 'Baker', 'Trainee'],
  units: ['bags', 'lb', 'kg', 'cases', 'sleeves', 'packs', 'boxes', 'cartons', 'gal', 'half gal', 'qt', 'bottles', 'jars', 'each', 'dozen', 'shots', 'cups', 'oz'],
  kindLabels: { ingredient: 'Ingredient', supply: 'Cups & supplies', bean: 'Coffee beans' },
  wasteReasons: ['Dialing in', 'Remade drink', 'Milk past date', 'Pastry left at close', 'Spilled', 'Spoiled', 'Customer return', 'Other'],
  wasteItems: ['Espresso shots', 'A made drink', 'Milk', 'Oat milk', 'Drip coffee', 'Pastry'],
  wasteUnits: ['shots', 'drinks', 'cartons', 'gal', 'each', 'cups'],
  notePh: 'New bag of house espresso opened, dialed at grind 12. Oat milk delivery is short two cases. Steam wand 2 is spitting.',
  specTitle: 'Drink specs', specWord: 'drink spec',
  specIntro: 'One card per drink: cup size, shots, milk, syrup and the steps. New baristas can quiz themselves in Training mode.',
  recipeCats: ['Espresso', 'Milk drinks', 'Brewed', 'Cold', 'Tea & other', 'Seasonal'],
  sizesPh: '8 oz · 12 oz · 16 oz', buildPh: 'Espresso · 1 shot / 2 / 2\nSteamed milk · to 8 / 12 / 16 oz\nMicrofoam · 1 cm',
  custLine: 'Thanks for waiting! Your coffee is on its way.',
  custArt: '<svg viewBox="0 0 120 70" width="140" aria-hidden="true" fill="none" stroke="#1E1B16" stroke-width="5" stroke-linecap="round"><path d="M25 30h55v12a22 22 0 0 1-22 22h-11a22 22 0 0 1-22-22z" fill="#fff"/><path d="M80 34h7a9 9 0 0 1 0 18h-7"/>' + [40, 55, 70].map((x, i) => `<path d="M${x - 5} 22c0-6 6-6 6-12"><animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="${i * .5}s" repeatCount="indefinite"/></path>`).join('') + '</svg>',
  settings: {
    beanRestDays: 7, beanPeakDays: 30, ratioTarget: 2, shotMin: 25, shotMax: 32,
    milkTypes: [{ name: 'Whole milk', days: 7 }, { name: '2% milk', days: 7 }, { name: 'Half & half', days: 7 }, { name: 'Heavy cream', days: 7 }, { name: 'Oat milk', days: 7 }, { name: 'Almond milk', days: 7 }, { name: 'Soy milk', days: 7 }]
  },
  settingsFields: [{ k: 'beanRestDays', label: 'Let new beans rest for', type: 'number', min: 0, step: 1, hint: 'days after roasting' }, { k: 'beanPeakDays', label: 'Beans are best until', type: 'number', min: 1, step: 1, hint: 'days after roasting' }],

  starter(D, C, today) {
    const id = C.uid, it2 = ([text, note]) => ({ id: id(), text, note });
    D.checklists.push(
      { id: id(), name: 'Opening', when: 'open', order: 0, items: [['Turn on the espresso machine and let it heat up', 'It takes about 20 minutes. Do it first.'], ['Flush the group heads and steam wands', 'Run water through each group head for 2 seconds. Open each steam wand for a second.'], ['Dial in the espresso', 'Pull a test shot and tap Log a shot on Today. The app tells you if it\'s too fast or slow.'], ['Brew the drip coffee', ''], ['Check the fridge temperatures', 'Today → Check the fridge temperatures. Type the number from each thermometer.'], ['Check the milk dates', 'Open Opened milk. Throw out anything red.'], ['Put out the pastries and count them', 'Open Pastry counts and type how many came in.'], ['Fill up cups, lids, sleeves and stir sticks', ''], ['Count the cash drawer', 'It should match the starting cash. Tell the manager if it doesn\'t.'], ['Read the notes from the last shift', 'They\'re on Today, or in Notes for next shift.'], ['Unlock the door', '']].map(it2) },
      { id: id(), name: 'Closing', when: 'close', order: 1, items: [['Backflush the espresso machine', 'Then tap Done on it in Machine cleaning.'], ['Soak the portafilters, baskets and steam tips', ''], ['Clean the grinders', 'Brush out the grounds and wipe the hopper.'], ['Empty and rinse the coffee brewers', ''], ['Count the leftover pastries', 'Open Pastry counts and type how many are left. It helps decide tomorrow\'s order.'], ['Wipe and sanitize the bar', ''], ['Put the milk away. Throw out anything past its date', 'In Opened milk, tap Thrown out on anything red.'], ['Fill up cups and lids for the morning', ''], ['Count the cash and split tips', 'Go to Today → Count the cash drawer. The app asks one question at a time.'], ['Leave a note for the morning person', 'Notes for next shift. What ran out? Anything broken?'], ['Floors, trash, lights off', ''], ['Save a backup', 'Settings & backup → Save a backup.']].map(it2) }
    );
    const sup = { roast: id(), dairy: id(), paper: id(), bake: id() };
    D.suppliers.push({ id: sup.roast, name: 'Coffee roaster', orderDays: 'Order Mon, roasted & shipped Wed', note: 'Change to your roaster' }, { id: sup.dairy, name: 'Dairy & alt-milk', orderDays: 'Tue & Fri' }, { id: sup.paper, name: 'Paper goods supplier', orderDays: 'Order Thu, arrives Mon' }, { id: sup.bake, name: 'Bakery', orderDays: 'Daily by 6:30 AM', note: 'Order by 2 PM for tomorrow' });
    const beans = [['Espresso', 'House espresso blend', 6], ['Filter', 'Single origin (drip)', 3], ['Decaf', 'Decaf espresso', 2], ['Cold brew', 'Cold brew blend', 2]];
    for (const [cat, name, par] of beans) D.items.push({ id: id(), kind: 'bean', cat, name, unit: '5 lb bags', par, count: par, supplierId: sup.roast, roastDate: C.addDays(today, -9) });
    const ing = [['Milk & alt-milk', 'Whole milk', 'gal', 12, sup.dairy], ['Milk & alt-milk', 'Oat milk', 'cartons', 12, sup.dairy], ['Milk & alt-milk', 'Almond milk', 'cartons', 6, sup.dairy], ['Milk & alt-milk', 'Half & half', 'qt', 6, sup.dairy],
      ['Syrups & sauces', 'Vanilla syrup', 'bottles', 3, ''], ['Syrups & sauces', 'Caramel sauce', 'bottles', 2, ''], ['Syrups & sauces', 'Chocolate sauce', 'bottles', 2, ''], ['Tea & other', 'Chai concentrate', 'cartons', 4, ''], ['Tea & other', 'Matcha', 'tins', 2, ''], ['Tea & other', 'Loose-leaf tea assortment', 'tins', 4, '']];
    for (const [cat, name, unit, par, supplierId] of ing) D.items.push({ id: id(), kind: 'ingredient', cat, name, unit, par, count: par, supplierId });
    const sp = [['Cups & lids', 'Hot cups 8 oz', 'sleeves', 4], ['Cups & lids', 'Hot cups 12 oz', 'sleeves', 8], ['Cups & lids', 'Hot cups 16 oz', 'sleeves', 8], ['Cups & lids', 'Hot lids', 'sleeves', 10], ['Cups & lids', 'Cold cups 16 oz', 'sleeves', 6], ['Cups & lids', 'Cold lids', 'sleeves', 4],
      ['Counter', 'Cup sleeves', 'packs', 4], ['Counter', 'Stir sticks', 'boxes', 2], ['Counter', 'Napkins', 'packs', 4], ['Counter', 'Pastry bags', 'packs', 3], ['Counter', 'Paper straws', 'boxes', 2], ['Cleaning', 'Espresso machine detergent', 'tubs', 1], ['Cleaning', 'Grinder cleaning tablets', 'packs', 1], ['Cleaning', 'Milk system cleaner', 'bottles', 1]];
    for (const [cat, name, unit, par] of sp) D.items.push({ id: id(), kind: 'supply', cat, name, unit, par, count: par, supplierId: sup.paper });
    const eq = [['Backflush the espresso machine', 1, 'Put the blind basket in, add a little detergent, run the group 5 times for 10 seconds, then rinse with water.'], ['Scrub the group heads and shower screens', 1, 'Use the group-head brush while water runs.'], ['Clean the steam wands', 1, 'Purge and wipe after every drink. At close, soak the tips.'], ['Soak the portafilters and baskets', 1, ''], ['Brush out the grinder', 1, 'Brush the grounds out of the chute and wipe the hopper.'], ['Run cleaning tablets through the grinder', 7, 'Follow the instructions on the tablet pack.'],
      ['Clean the drip coffee brewer', 1, 'Wash the spray head and baskets.'], ['Change the espresso group gaskets and screens', 90, 'Check your machine manual, or ask the manager.'], ['Replace the water filter', 180, 'Or when it hits its gallon limit.'], ['Clean and sanitize the ice machine', 30, 'Follow the maker\'s steps.'], ['Descale the brewers and kettles', 30, '']];
    for (const [name, everyDays, note] of eq) D.equipment.push({ id: id(), name, everyDays, note, lastDone: '' });
    const pas = [['Butter croissant', 18], ['Chocolate croissant', 12], ['Blueberry muffin', 10], ['Banana bread (slices)', 10], ['Morning bun', 8], ['Scone', 8], ['Breakfast sandwich', 12], ['Cookie', 12]];
    for (const [name, par] of pas) D.pastries.push({ id: id(), name, par });
    D.tempUnits.push({ id: id(), name: 'Under-bar milk fridge', min: 33, max: 41 }, { id: id(), name: 'Pastry case', min: 33, max: 41 }, { id: id(), name: 'Back fridge', min: 33, max: 41 }, { id: id(), name: 'Freezer', min: '', max: 0 });
    const cl = [['Sanitize counters and bar', 'Bar', 'During shift'], ['Wipe the condiment station', 'Front', 'During shift'], ['Clean the pastry case glass', 'Front', 'Closing'], ['Wash and sanitize pitchers and tools', 'Back', 'Closing'], ['Mop floors and take out trash', 'Whole shop', 'Closing'], ['Clean bathroom', 'Restroom', 'Closing'], ['Wipe fridge gaskets and shelves', 'Back', 'Weekly'], ['Deep-clean the drip trays and drains', 'Bar', 'Weekly']];
    for (const [name, area, when] of cl) D.cleanTasks.push({ id: id(), name, area, when });
    const rc = [
      ['Latte', 'Milk drinks', '8 oz · 12 oz · 16 oz', 'Espresso · 1 shot / 2 / 2\nSteamed milk · to 8 / 12 / 16 oz\nMicrofoam · about 1 cm', 'Pull shots into the cup\nSteam milk to 140–150°F with fine microfoam\nPour, finish with latte art'],
      ['Cappuccino', 'Milk drinks', '6 oz · 8 oz', 'Espresso · 2 shots\nSteamed milk with thick foam · half and half', 'Stretch more air than for a latte\nPour so foam is about 2 cm deep'],
      ['Americano', 'Espresso', '12 oz · 16 oz', 'Hot water · to the line\nEspresso · 2 shots / 3', 'Water first, then shots on top to keep the crema'],
      ['Flat white', 'Milk drinks', '6 oz', 'Espresso · 2 shots (ristretto if you do)\nSteamed milk · thin, glossy microfoam', 'Very little foam; pour low and fast'],
      ['Cold brew', 'Cold', '12 oz · 16 oz', 'Cold brew concentrate · 4 oz / 5 oz\nWater · 4 oz / 5 oz\nIce to the line', 'Ice, concentrate, water. Stir.'],
      ['Chai latte', 'Tea & other', '12 oz · 16 oz', 'Chai concentrate · 6 oz / 8 oz\nSteamed milk · to the line', 'Steam concentrate and milk together, pour']
    ];
    for (const [name, cat, sizes, ingredients, steps] of rc) D.recipes.push({ id: id(), name, cat, sizes, ingredients, steps, notes: 'Example spec: change to match your shop.' });
  },

  demo(D, C, today) {
    const id = C.uid, at = (off, hm) => { const d = C.parseYmd(C.addDays(today, off)); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const ago = min => new Date(Date.now() - min * 6e4).toISOString();
    const E = [['Alex Rivera', 'Shift lead', '#E9B872'], ['Sofia Park', 'Barista', '#8FD3B6'], ['Theo Brooks', 'Barista', '#8AA8FF'], ['Nina Patel', 'Cashier', '#FF8FC2'], ['Omar Haddad', 'Baker', '#FF9F5A']].map(([name, role, color]) => ({ id: id(), name, role, color, demo: true }));
    D.employees.push(...E);
    const wk = C.weekDates(C.weekStart(today, 1));
    const plan = [[0, '06:00', '14:00'], [1, '06:30', '13:00'], [2, '07:30', '15:30'], [3, '11:00', '18:00'], [4, '05:00', '11:00']];
    wk.forEach((d, i) => plan.forEach(([e, s, en], j) => { if ((i + j) % 5 === 3) return; D.shifts.push({ id: id(), empId: E[e].id, date: d, start: s, end: en, station: ['Bar', 'Bar', 'Register', 'Floor', 'Pastry case'][j], demo: true }); }));
    for (let off = -4; off <= -1; off++) for (const [e, s, en] of plan.slice(0, 4)) D.punches.push({ id: id(), empId: E[e].id, in: new Date(Date.parse(at(off, s)) + (Math.random() * 8 - 4) * 6e4).toISOString(), out: new Date(Date.parse(at(off, en)) + Math.random() * 10 * 6e4).toISOString(), demo: true });
    D.punches.push({ id: id(), empId: E[0].id, in: ago(200), demo: true }, { id: id(), empId: E[1].id, in: ago(170), demo: true });
    D.cashouts.push({ id: id(), date: C.addDays(today, -1), by: 'Alex Rivera', float: 200, counted: 538, cashSales: 341, cardSales: 2210.5, cashTips: 72, cardTips: 186.25, split: [], demo: true });
    D.handoffs.push({ id: id(), at: ago(1000), author: 'Theo Brooks', forWhom: 'Opening', text: 'Steam wand 2 is spitting at the start, purge it twice. Oat milk delivery was short two cases.', pinned: true, demo: true });
    const esp = D.items.find(i => i.name === 'House espresso blend'), dec = D.items.find(i => i.name === 'Decaf espresso');
    if (esp) { esp.roastDate = C.addDays(today, -11); esp.count = 2; }
    if (dec) dec.roastDate = C.addDays(today, -38);
    const sh = (off, hm, bean, grind, dose, yld, time, taste, keep) => D.dialins.push({ id: id(), at: at(off, hm), beanId: bean.id, beanName: bean.name, grind, dose, yield: yld, time, taste, keeper: !!keep, by: 'Alex Rivera', demo: true });
    if (esp) { sh(-1, '06:15', esp, '12', 18, 36, 26, 'Balanced', true); sh(0, '06:10', esp, '12', 18, 38, 22, 'Sour'); sh(0, '06:14', esp, '11.5', 18, 37, 25, 'Sour'); sh(0, '06:18', esp, '11', 18, 36, 28, 'Balanced', true); }
    if (dec) sh(0, '06:30', dec, '9', 18, 34, 30, 'Bitter', true);
    const mt = [['Whole milk', -2, 5], ['Whole milk', -1, 6], ['Oat milk', -6, 1], ['Oat milk', -8, -1], ['Almond milk', -3, 4], ['Half & half', -5, 2]];
    for (const [kind, opened, left] of mt) D.milks.push({ id: id(), kind, openedAt: at(opened, '06:20'), useBy: C.addDays(today, left), status: 'open', by: 'Alex Rivera', demo: true });
    for (const e of D.equipment) { const ago2 = e.everyDays === 1 ? -1 : e.everyDays === 7 ? -9 : e.everyDays === 30 ? -20 : -40; e.lastDone = at(ago2, '15:00'); D.equipLogs.push({ id: id(), equipId: e.id, name: e.name, at: e.lastDone, by: 'Theo Brooks', demo: true }); }
    for (const p of D.pastries) for (let off = -28; off <= -1; off++) { const dw = C.dow(C.addDays(today, off)); const base = p.par * (dw === 0 || dw === 6 ? 1.2 : 0.9); const baked = Math.round(base), sold = Math.min(baked, Math.round(base * (0.7 + Math.random() * 0.35))); D.pastryCounts.push({ id: id(), date: C.addDays(today, off), itemId: p.id, baked, left: baked - sold, demo: true }); }
    for (const p of D.pastries) D.pastryCounts.push({ id: id(), date: today, itemId: p.id, baked: p.par, left: '', demo: true });
    D.waste.push({ id: id(), at: at(0, '06:18'), item: 'Espresso shots', amount: 3, unit: 'shots', reason: 'Dialing in', by: 'Alex Rivera', demo: true }, { id: id(), at: at(-1, '17:30'), item: 'Butter croissant', amount: 4, unit: 'each', reason: 'Pastry left at close', by: 'Nina Patel', demo: true }, { id: id(), at: at(-2, '09:10'), item: 'Oat milk', amount: 0.5, unit: 'cartons', reason: 'Milk past date', by: 'Sofia Park', demo: true });
    for (const u of D.tempUnits) for (let off = -3; off <= 0; off++) { if (off === 0 && u.name === 'Back fridge') continue; const v = u.max === 0 ? -3 + Math.round(Math.random() * 2) : 35 + Math.round(Math.random() * 4); D.tempLogs.push({ id: id(), unitId: u.id, unitName: u.name, temp: v, scale: '°F', ok: true, at: at(off, '06:25'), by: 'Alex Rivera', demo: true }); }
    for (const t of D.cleanTasks.filter(x => x.when === 'Closing')) for (let off = -3; off <= -1; off++) D.cleanLogs.push({ id: id(), taskId: t.id, task: t.name, at: at(off, '17:45'), by: off % 2 ? 'Nina Patel' : 'Theo Brooks', demo: true });
    const ck = D.checklists.find(l => l.when === 'open'); if (ck) { const done = {}; ck.items.slice(0, 7).forEach((x, i) => done[x.id] = { at: at(0, '06:' + String(5 + i * 4).padStart(2, '0')), by: 'Alex Rivera' }); D.checkRuns.push({ id: id(), listId: ck.id, date: today, done, demo: true }); }
    const low = { 'Oat milk': 4, 'Hot cups 12 oz': 3, 'Hot lids': 4, 'Cup sleeves': 1 };
    for (const i of D.items) if (low[i.name] != null) { i.count = low[i.name]; i.countedAt = at(0, '06:40'); }
  }
};
