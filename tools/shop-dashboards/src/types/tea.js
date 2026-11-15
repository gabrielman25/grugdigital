/* ==========================================================================
   Business type: Bubble tea (tea & boba) shop
   Everything that makes this dashboard a boba shop's: names, colours, nav, rush windows, starter lists.
   The extra modules (pearl & tea timers, prep sheet, seasonal menu) are in tea.mods.js.
   ========================================================================== */
window.SHOP_TYPE = {
  id: 'tea', name: 'Bubble Tea', kind: 'bubble tea shop', version: '1.0.0',
  storagePrefix: 'grug-tea:',
  cardType: 't',   // the rewards card's kind (assets/rewards.js KINDS) when the shop gets one on the site
  icon: 'boba',
  tagline: 'Pearl timers, prep sheets, staffing for the after-school rush, and the daily paperwork, all in one place.',
  namePh: 'Pearl & Leaf Tea Bar',
  starterNote: 'Opening and closing checklists, topping and syrup prep, cups, lids, straws and sealing film with par levels, tea types, cleaning tasks, fridge ranges and a few example drink specs.',
  theme: { mode: '#C59BFF', lo: '#9A6FE0', bg: '#F7F4FA', accent2: '#F0B26E', accent2lo: '#C9833A' },
  colls: ['pearlBatches', 'teaBatches', 'prepItems', 'prepRuns', 'seasonal'],
  collLabels: { employees: 'Team members', shifts: 'Shifts', punches: 'Time clock punches', checklists: 'Checklists', checkRuns: 'Checklist tick-offs', handoffs: 'Shift notes', cashouts: 'Cash-outs', items: 'Stock items', suppliers: 'Suppliers', orders: 'Order lines', waste: 'Waste entries', cleanTasks: 'Cleaning tasks', cleanLogs: 'Cleaning entries', tempUnits: 'Fridges', tempLogs: 'Temperature readings', recipes: 'Drink specs', pearlBatches: 'Pearl batches', teaBatches: 'Tea batches', prepItems: 'Prep items', prepRuns: 'Prep tick-offs', seasonal: 'Seasonal items' },
  groups: [['Every shift', ['batches', 'checklists', 'clock', 'prep', 'temps', 'cleaning', 'waste', 'handoff', 'recipes']], ['Stock & ordering', ['stock', 'consumables', 'orders']], ['For the manager', ['schedule', 'cashout', 'seasonal', 'customer', 'settings']]],
  hours: ['11:00', '21:00'],
  tabs: ['home', 'batches', 'clock', 'checklists'],
  hero: 'batches',
  stockHome: 'stock',
  peaks: [
    { id: 'pk-school', label: 'After school', start: '15:00', end: '18:00', days: [1, 2, 3, 4, 5], minStaff: 3 },
    { id: 'pk-evening', label: 'Evening', start: '19:00', end: '21:30', days: [0, 1, 2, 3, 4, 5, 6], minStaff: 2 },
    { id: 'pk-weekend', label: 'Weekend afternoon', start: '13:00', end: '18:00', days: [0, 6], minStaff: 3 }
  ],
  
  rushIntro: 'Boba shops get slammed when school lets out and again in the evening. Tell the app when, and how many people you want working then. The schedule turns red if there aren\'t enough.',
  defaultShift: ['14:00', '20:00'],
  stations: ['Bar', 'Register', 'Pearls & prep', 'Sealer', 'Float'],
  roles: ['Shift lead', 'Tea maker', 'Cashier', 'Prep', 'Trainee'],
  units: ['bags', 'boxes', 'cases', 'sleeves', 'rolls', 'packs', 'tubs', 'cans', 'jugs', 'bottles', 'gal', 'qt', 'L', 'kg', 'lb', 'each', 'cups', 'oz', 'batches'],
  kindLabels: { ingredient: 'Ingredient', consumable: 'Cups & supplies' },
  wasteReasons: ['Pearls expired', 'Tea expired', 'Remade drink', 'Spilled', 'Spoiled', 'Over-prepped', 'Customer return', 'Other'],
  wasteItems: ['Tapioca pearls', 'Brewed tea', 'A made drink', 'Toppings', 'Milk', 'Fruit'],
  wasteUnits: ['drinks', 'cups', 'qt', 'gal', 'bottles', 'bags', 'batches'],
  notePh: 'Pearls cooked at 3:10, second batch soaking. Mango purée running low. New roll of sealing film is on the shelf.',
  specTitle: 'Drink specs', specWord: 'drink spec',
  specIntro: 'One card per drink with sizes, build and steps. New hires can quiz themselves in Training mode.',
  recipeCats: ['Milk tea', 'Fruit tea', 'Brewed tea', 'Slush & smoothie', 'Specialty', 'Toppings'],
  sizesPh: 'M 16 oz · L 24 oz', buildPh: 'Black tea · 8 oz / 12 oz\nCreamer · 1.5 scoops / 2\nBrown sugar syrup · 1 oz / 1.5 oz',
  custLine: 'Thanks for waiting! Your drink is being shaken up.',
  custArt: '<svg viewBox="0 0 120 60" width="150" aria-hidden="true"><g fill="#1E1B16">' + [10, 28, 46, 64, 82, 100].map((x, i) => `<circle cx="${x + 5}" cy="${30 + (i % 2 ? 10 : -6)}" r="9"><animate attributeName="cy" values="${30 + (i % 2 ? 10 : -6)};${30 + (i % 2 ? -6 : 10)};${30 + (i % 2 ? 10 : -6)}" dur="${1.6 + i * .2}s" repeatCount="indefinite"/></circle>`).join('') + '</g></svg>',
  settings: {
    pearlCookMin: 45, pearlHoldMin: 240, pearlKind: 'Tapioca pearls', pearlSize: '1 batch',
    teaTypes: [{ name: 'Black tea', holdMin: 240 }, { name: 'Jasmine green', holdMin: 240 }, { name: 'Oolong', holdMin: 240 }, { name: 'Thai tea', holdMin: 240 }]
  },

  /* starter lists: the owner can edit or delete any of it */
  starter(D, C, today) {
    const id = C.uid, it2 = ([text, note]) => ({ id: id(), text, note });
    D.checklists.push(
      { id: id(), name: 'Opening', when: 'open', order: 0, items: [['Turn on the lights, music, register and menu screens', ''], ['Check the fridge temperatures', 'Go to Today → Check the fridge temperatures. Read the thermometer in each fridge and type the number.'], ['Start cooking the first pearls', 'Put the pearls in the pot, then tap Start a batch on the Today screen. The app times it for you.'], ['Brew the teas', 'After you brew each tea, tap its name under Brewed tea on Today so the app knows when to throw it out.'], ['Make brown sugar and simple syrup', 'See Drink recipes, or ask your shift lead the first time.'], ['Make the toppings on the Toppings list', 'Open Toppings to make. It says what and how much.'], ['Fill up cups, lids, wide straws and sealing film', ''], ['Count the cash drawer', 'It should match the starting cash. Tell the manager if it doesn\'t.'], ['Wipe the counters and turn on the sealer', 'The sealer needs a few minutes to heat up.'], ['Read the notes from the last shift', 'They\'re on Today, or in Notes for next shift.'], ['Unlock the door and flip the sign to Open', '']].map(it2) },
      { id: id(), name: 'Closing', when: 'close', order: 1, items: [['Throw out leftover pearls and tea', 'On the Timers screen, tap Thrown out on each batch. The app writes it down for you.'], ['Cover, label and put away the toppings', 'Write today\'s date on the label.'], ['Wash and sanitize shakers, jiggers and pitchers', ''], ['Clean the sealer machine', 'Unplug it first. Wipe the plate when it\'s cool.'], ['Clean the blenders', ''], ['Fill up cups, lids, straws and film for the morning', ''], ['Count the cash and split tips', 'Go to Today → Count the cash drawer. The app asks one question at a time.'], ['Leave a note for the morning person', 'Notes for next shift. What ran out? Anything broken?'], ['Floors, trash, lights off', ''], ['Save a backup', 'Settings & backup → Save a backup.']].map(it2) }
    );
    const prep = [['Jellies', 'Lychee jelly', 2, 'qt'], ['Jellies', 'Grass jelly', 1, 'qt'], ['Jellies', 'Coconut jelly', 1, 'qt'], ['Popping boba', 'Strawberry popping boba', 1, 'qt'], ['Popping boba', 'Mango popping boba', 1, 'qt'],
      ['Fruit', 'Strawberries, sliced', 2, 'qt'], ['Fruit', 'Mango, diced', 2, 'qt'], ['Fruit', 'Passion fruit pulp', 1, 'qt'], ['Syrups', 'Brown sugar syrup', 2, 'qt'], ['Syrups', 'Simple syrup', 2, 'qt'], ['Syrups', 'Honey syrup', 1, 'qt'],
      ['Cream & foam', 'Cheese foam', 1, 'qt'], ['Cream & foam', 'Sea salt cream', 1, 'qt'], ['Puddings & pastes', 'Egg pudding', 12, 'cups'], ['Puddings & pastes', 'Taro paste', 1, 'qt']];
    for (const [group, name, amount, unit] of prep) D.prepItems.push({ id: id(), group, name, amount, unit });
    const sup = { tea: id(), paper: id(), dairy: id() };
    D.suppliers.push({ id: sup.tea, name: 'Tea & boba supplier', orderDays: 'Order Mon, arrives Wed', note: 'Change to your distributor' }, { id: sup.paper, name: 'Paper goods supplier', orderDays: 'Order Thu, arrives Mon' }, { id: sup.dairy, name: 'Dairy delivery', orderDays: 'Tue & Fri' });
    const ing = [['Tea', 'Black tea leaves', 'bags', 4, sup.tea], ['Tea', 'Jasmine green tea leaves', 'bags', 3, sup.tea], ['Tea', 'Oolong leaves', 'bags', 2, sup.tea], ['Tea', 'Thai tea mix', 'bags', 2, sup.tea],
      ['Toppings', 'Tapioca pearls (uncooked)', 'bags', 8, sup.tea], ['Toppings', 'Lychee jelly', 'cans', 4, sup.tea], ['Toppings', 'Popping boba, strawberry', 'tubs', 3, sup.tea], ['Toppings', 'Popping boba, mango', 'tubs', 3, sup.tea],
      ['Dairy & creamer', 'Non-dairy creamer', 'bags', 3, sup.tea], ['Dairy & creamer', 'Whole milk', 'gal', 6, sup.dairy], ['Dairy & creamer', 'Oat milk', 'cartons', 6, sup.dairy], ['Dairy & creamer', 'Heavy cream', 'qt', 4, sup.dairy],
      ['Sweeteners & syrups', 'Brown sugar', 'bags', 3, sup.tea], ['Sweeteners & syrups', 'Fructose syrup', 'jugs', 2, sup.tea], ['Powders', 'Taro powder', 'bags', 2, sup.tea], ['Powders', 'Matcha powder', 'bags', 2, sup.tea],
      ['Fruit & purée', 'Mango purée', 'bottles', 3, sup.tea], ['Fruit & purée', 'Strawberry purée', 'bottles', 3, sup.tea], ['Fruit & purée', 'Passion fruit purée', 'bottles', 2, sup.tea]];
    for (const [cat, name, unit, par, supplierId] of ing) D.items.push({ id: id(), kind: 'ingredient', cat, name, unit, par, count: par, supplierId });
    const con = [['Cups', 'Cups 16 oz (cold)', 'sleeves', 10], ['Cups', 'Cups 24 oz (cold)', 'sleeves', 12], ['Cups', 'Hot cups 12 oz', 'sleeves', 4], ['Lids & film', 'Sealing film', 'rolls', 3], ['Lids & film', 'Dome lids', 'sleeves', 4], ['Lids & film', 'Flat lids (hot)', 'sleeves', 3],
      ['Straws', 'Wide boba straws', 'boxes', 4], ['Straws', 'Regular straws', 'boxes', 2], ['Bags & carriers', 'Single-cup bags', 'packs', 4], ['Bags & carriers', 'Double-cup bags', 'packs', 4], ['Bags & carriers', '4-cup carriers', 'packs', 2], ['Other', 'Napkins', 'packs', 4], ['Other', 'Receipt paper', 'rolls', 6]];
    for (const [cat, name, unit, par] of con) D.items.push({ id: id(), kind: 'consumable', cat, name, unit, par, count: par, supplierId: sup.paper });
    D.tempUnits.push({ id: id(), name: 'Topping fridge', min: 33, max: 41 }, { id: id(), name: 'Milk & dairy fridge', min: 33, max: 41 }, { id: id(), name: 'Back fridge', min: 33, max: 41 }, { id: id(), name: 'Freezer', min: '', max: 0 });
    const cl = [['Sanitize bar counters', 'Bar', 'During shift'], ['Empty and rinse shaker station', 'Bar', 'During shift'], ['Clean and sanitize the sealer machine', 'Bar', 'Closing'], ['Wash and sanitize shakers, jiggers, pitchers', 'Back', 'Closing'], ['Clean blenders', 'Bar', 'Closing'], ['Clean tea brewers and urns', 'Back', 'Closing'], ['Clean the pearl pot and strainers', 'Back', 'Closing'],
      ['Mop floors and take out trash', 'Whole shop', 'Closing'], ['Wipe fridge gaskets and shelves', 'Back', 'Weekly'], ['Descale the hot water dispenser', 'Back', 'Weekly'], ['Clean and sanitize the ice machine', 'Back', 'Monthly']];
    for (const [name, area, when] of cl) D.cleanTasks.push({ id: id(), name, area, when });
    const rc = [
      ['Classic milk tea', 'Milk tea', 'Black tea · 8 oz / 12 oz\nCreamer · 1.5 scoops / 2\nFructose · 1 oz / 1.5 oz (adjust for sweetness)\nIce to the line\nPearls · 1 scoop', 'Add creamer and sweetener to the shaker\nAdd tea and stir until creamer dissolves\nAdd ice, cap and shake 10 times\nPearls in the cup, pour, seal'],
      ['Brown sugar boba milk', 'Milk tea', 'Warm brown sugar pearls · 1.5 scoops\nBrown sugar syrup · 1 oz to coat the cup\nWhole milk · 10 oz / 14 oz\nIce to the line', 'Swirl syrup around the inside of the cup for the tiger stripes\nAdd warm pearls, then ice\nPour milk slowly over the ice\nSeal and serve unshaken'],
      ['Taro milk tea', 'Milk tea', 'Taro powder · 2 scoops / 3\nHot water · 2 oz to dissolve\nBlack or jasmine tea · 6 oz / 9 oz\nCreamer · 1 scoop\nIce to the line', 'Dissolve taro powder in hot water\nAdd tea and creamer, stir\nAdd ice, shake, pour and seal'],
      ['Mango green tea', 'Fruit tea', 'Jasmine green tea · 10 oz / 14 oz\nMango purée · 1.5 oz / 2 oz\nFructose · 0.5 oz / 1 oz\nIce to the line\nMango popping boba (optional)', 'Purée and sweetener in the shaker\nAdd tea and ice, shake hard\nPour over toppings and seal'],
      ['Passion fruit green tea', 'Fruit tea', 'Jasmine green tea · 10 oz / 14 oz\nPassion fruit purée · 1.5 oz\nPassion fruit pulp · 1 spoon\nIce to the line', 'Build in the shaker, shake hard, pour and seal'],
      ['Thai tea', 'Milk tea', 'Thai tea · 8 oz / 12 oz\nCondensed milk · 1 oz / 1.5 oz\nIce to the line\nHalf & half float · 1 oz', 'Stir condensed milk into the tea\nIce, pour, float half & half on top, seal']
    ];
    for (const [name, cat, ingredients, steps] of rc) D.recipes.push({ id: id(), name, cat, sizes: 'M 16 oz · L 24 oz', ingredients, steps, notes: 'Example spec: change amounts to match your shop.' });
  },

  /* sample team and entries so the owner can look around (all marked demo:true; removable in settings) */
  demo(D, C, today) {
    const id = C.uid, at = (off, hm) => { const d = C.parseYmd(C.addDays(today, off)); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const ago = min => new Date(Date.now() - min * 6e4).toISOString();
    const E = [['Maya Chen', 'Shift lead', '#C59BFF'], ['Jordan Lee', 'Tea maker', '#4FD8C4'], ['Lin Nguyen', 'Tea maker', '#FF8FC2'], ['Sam Ortiz', 'Cashier', '#FFBE1A'], ['Priya Shah', 'Prep', '#8AA8FF']].map(([name, role, color]) => ({ id: id(), name, role, color, demo: true }));
    D.employees.push(...E);
    const ws = C.weekStart(today, 1), wk = C.weekDates(ws);
    const plan = [[0, '11:00', '19:00'], [1, '14:00', '21:30'], [2, '15:00', '21:30'], [3, '15:30', '20:00'], [4, '10:00', '15:00']];
    wk.forEach((d, i) => plan.forEach(([e, s, en], j) => { if ((i + j) % 5 === 4) return; if (i === 2 && j === 3) return; D.shifts.push({ id: id(), empId: E[e].id, date: d, start: s, end: en, station: ['Bar', 'Bar', 'Sealer', 'Register', 'Pearls & prep'][j], demo: true }); }));
    for (let off = -4; off <= -1; off++) for (const [e, s, en] of plan.slice(0, 4)) { const pin = at(off, s), out = at(off, en); D.punches.push({ id: id(), empId: E[e].id, in: new Date(Date.parse(pin) + (Math.random() * 8 - 4) * 6e4).toISOString(), out: new Date(Date.parse(out) + Math.random() * 10 * 6e4).toISOString(), demo: true }); }
    D.punches.push({ id: id(), empId: E[0].id, in: ago(140), demo: true });
    D.cashouts.push({ id: id(), date: C.addDays(today, -1), by: 'Maya Chen', float: 150, counted: 612.5, cashSales: 465, cardSales: 1830.25, cashTips: 64, cardTips: 118.4, split: [], demo: true });
    D.handoffs.push({ id: id(), at: ago(600), author: 'Jordan Lee', forWhom: 'Opening', text: 'Mango purée is down to the last bottle, put it on the order. Sealer is sticking a bit on 24 oz cups; wipe the plate before use.', pinned: true, demo: true },
      { id: id(), at: ago(90), author: 'Maya Chen', forWhom: 'Closing', text: 'Second pearl batch is going. Grass jelly is prepped for tonight.', demo: true });
    const pearlCook = 45;
    D.pearlBatches.push({ id: id(), kind: 'Tapioca pearls', size: '1 batch', startedAt: ago(pearlCook + 240 - 12), cookMin: pearlCook, holdMin: 240, by: 'Maya Chen', no: 1, demo: true },
      { id: id(), kind: 'Tapioca pearls', size: '1 batch', startedAt: ago(20), cookMin: pearlCook, holdMin: 240, by: 'Maya Chen', no: 2, demo: true },
      { id: id(), kind: 'Tapioca pearls', size: '1 batch', startedAt: at(-1, '14:00'), cookMin: pearlCook, holdMin: 240, by: 'Jordan Lee', no: 1, endedAt: at(-1, '18:40'), outcome: 'discarded', demo: true });
    D.teaBatches.push({ id: id(), kind: 'Black tea', size: '2 gal', startedAt: ago(150), cookMin: 0, holdMin: 240, by: 'Maya Chen', demo: true }, { id: id(), kind: 'Jasmine green', size: '2 gal', startedAt: ago(70), cookMin: 0, holdMin: 240, by: 'Maya Chen', demo: true });
    D.waste.push({ id: id(), at: at(-1, '18:40'), item: 'Tapioca pearls', amount: 1.5, unit: 'qt', reason: 'Pearls expired', by: 'Jordan Lee', demo: true }, { id: id(), at: at(-2, '16:15'), item: 'Taro milk tea', amount: 1, unit: 'cups', reason: 'Remade drink', by: 'Sam Ortiz', note: 'Wrong sweetness', demo: true }, { id: id(), at: at(-3, '21:10'), item: 'Brewed jasmine green tea', amount: 0.5, unit: 'gal', reason: 'Tea expired', by: 'Lin Nguyen', demo: true });
    for (const u of D.tempUnits) for (let off = -3; off <= 0; off++) { if (off === 0 && u.name === 'Back fridge') continue; const v = u.max === 0 ? -4 + Math.round(Math.random() * 3) : 36 + Math.round(Math.random() * 3); D.tempLogs.push({ id: id(), unitId: u.id, unitName: u.name, temp: v, scale: '°F', ok: true, at: at(off, '10:05'), by: 'Maya Chen', demo: true }); }
    for (const t of D.cleanTasks.filter(x => x.when === 'Closing')) for (let off = -3; off <= -1; off++) D.cleanLogs.push({ id: id(), taskId: t.id, task: t.name, at: at(off, '21:40'), by: off % 2 ? 'Lin Nguyen' : 'Jordan Lee', demo: true });
    const ck = D.checklists.find(l => l.when === 'open'); if (ck) { const done = {}; ck.items.slice(0, 6).forEach((x, i) => done[x.id] = { at: at(0, '10:' + String(10 + i * 4)), by: 'Maya Chen' }); D.checkRuns.push({ id: id(), listId: ck.id, date: today, done, demo: true }); }
    const pr = {}; D.prepItems.slice(0, 7).forEach((x, i) => pr[x.id] = { at: at(0, '10:' + String(20 + i * 5)), by: 'Priya Shah', amount: x.amount }); D.prepRuns.push({ id: id(), date: today, done: pr, demo: true });
    const low = { 'Mango purée': 1, 'Wide boba straws': 1, 'Sealing film': 1, 'Cups 24 oz (cold)': 5, 'Tapioca pearls (uncooked)': 5 };
    for (const i of D.items) if (low[i.name] != null) { i.count = low[i.name]; i.countedAt = at(0, '10:30'); }
    D.seasonal.push({ id: id(), name: 'Brown sugar ginger milk tea', start: C.addDays(today, 5), end: C.addDays(today, 50), notes: 'Winter special', ingredients: 'Fresh ginger, 5, lb\nBrown sugar, 2, bags\nGinger syrup, 2, bottles', demo: true },
      { id: id(), name: 'Pumpkin cream cold foam tea', start: C.addDays(today, -40), end: C.addDays(today, 2), notes: 'Fall special, ends soon', ingredients: 'Pumpkin purée, 6, cans\nPumpkin spice, 1, jar', demo: true });
  }
};
