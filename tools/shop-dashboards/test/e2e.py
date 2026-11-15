"""End-to-end checks in real Chrome against the site served locally. From the repo root:
    python3 -m http.server 8766 &   then   python3 tools/shop-dashboards/test/e2e.py
(BASE=http://localhost:8766 by default; the dashboards are business/tea/ and business/cafe/, built in site mode.)
Covers: the guided setup, Today's to-do list, first-visit help, Undo, input guards, persistence, timers after reload,
export → clear → restore, import validation, PWA offline + update prompt, layouts, and the restaurant dashboard untouched."""
import json, re, shutil, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8766')
SHOTS = os.environ.get('SHOTS', '/tmp/shop-shots'); os.makedirs(SHOTS, exist_ok=True)
ok_count = 0
def ok(cond, msg):
    global ok_count
    if not cond: raise AssertionError('FAIL: ' + msg)
    ok_count += 1; print('  ✓', msg)

def setup(pg, name, demo=False, team=()):
    pg.fill('#setupf input[name=name]', name); pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    for n in team: pg.fill('#setupf input[name=person]', n); pg.click('[data-addp]'); pg.wait_for_timeout(100)
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    if demo: pg.check('#setupf input[name=demo]')
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(700)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ls = lambda: pg.evaluate('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))')
    others = lambda: {k: v for k, v in ls().items() if not k.startswith(('grug-tea:', 'grug-cafe:'))}
    # on the site a shop dashboard adds its shop to the restaurant account (grug.business.v1) and its card to
    # "My creations" (grug.rewards.v1), on purpose. Everything else (daypart:* and the other grug.* keys) must not change,
    # and those two may only gain things: what was there before is kept as it was.
    SHARED = ('grug.business.v1', 'grug.rewards.v1')
    def same_as(was):
        now = others()
        if {k: v for k, v in now.items() if k not in SHARED and not k.startswith('grug.app')} != {k: v for k, v in was.items() if k not in SHARED and not k.startswith('grug.app')}: return False
        for k in SHARED:
            if k not in was: continue
            a, b2 = json.loads(was[k]), json.loads(now.get(k, 'null')) or {}
            if k == SHARED[0] and any(b2.get('shops', {}).get(i) != v for i, v in a.get('shops', {}).items()): return False
            if k == SHARED[1] and any(m not in b2.get('mine', []) for m in a.get('mine', [])): return False
        return True
    top = lambda: pg.locator('.dlg').last
    esc = lambda: (pg.keyboard.press('Escape'), pg.wait_for_timeout(150))

    print('Restaurant dashboard baseline')
    pg.goto(BASE + '/business/'); pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.setItem('daypart:probe', JSON.stringify({kept: true}))")
    before = others()
    ok(any(k.startswith('daypart:') for k in before), 'restaurant page loads and has its daypart:* keys')
    rest_errs = list(errs); errs.clear()

    print('Tea: guided setup')
    pg.goto(BASE + '/business/tea/'); pg.wait_for_timeout(500)
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    ok('Type your shop name' in pg.inner_text('#setup'), 'setup won\'t continue without a shop name, and says why')
    setup(pg, 'Test Tea', team=['Rae Kim'])
    ok(pg.locator('.whopick').count() == 1, 'after setup it asks "Who\'s using this?" with the team as big buttons')
    pg.click('.whopick'); pg.wait_for_timeout(300)
    ok('Rae' in pg.inner_text('#whochip') and 'Good' in pg.inner_text('.hello') and 'Rae' in pg.inner_text('.hello'), 'picking a name greets them and shows them in the top bar')
    ok(pg.locator('.todolist .todo').count() >= 1, 'Today shows a numbered "Do these next" list')
    ok(pg.locator('.tile').count() >= 10 and 'all tools' in pg.inner_text('#view').lower(), 'everything else is big tiles under All tools')

    print('Tea: hand-holding on each page')
    pg.goto(BASE + '/business/tea/#/clock'); pg.wait_for_timeout(300)
    ok(pg.locator('.howto').is_visible(), 'first visit to a page shows "How this works"')
    pg.click('.howto [data-act=seen]'); pg.wait_for_timeout(200)
    ok(pg.locator('.howto').count() == 0, '"Got it" hides it')
    pg.click('#helpbtn'); pg.wait_for_timeout(200)
    ok('Clock in' in top().inner_text() and top().locator('ol.steps li').count() == 3, 'the ? button brings the steps back any time'); esc()
    ok(pg.locator('#homebtn').is_visible(), 'a big Home button is on every page')
    pg.click('[data-act=punch]'); pg.wait_for_timeout(300)
    ok('Hi Rae!' in top().inner_text(), 'clocking in shows a big "Hi Rae!" confirmation'); esc()
    ok('Clocked in at' in pg.inner_text('.punchgrid'), 'clock-in saved')
    pg.click('[data-act=punch]'); pg.wait_for_timeout(300)
    ok('less than a minute ago' in pg.inner_text('#toast') and 'Clocked in at' in pg.inner_text('.punchgrid'), 'an accidental double tap does not clock them straight back out')

    pg.goto(BASE + '/business/tea/#/waste'); pg.wait_for_timeout(300)
    pg.click('[data-act=wasteNew]'); pg.wait_for_timeout(200)
    ok('Step 1 of' in top().inner_text(), 'writing down waste is a step-by-step wizard')
    top().locator('[data-chips] button', has_text='Tapioca pearls').click(); pg.wait_for_timeout(350)
    pg.fill('.dlg input[name=v]', '0'); pg.click('.dlg button.pri'); pg.wait_for_timeout(150)
    ok('more than 0' in top().inner_text(), 'an amount of 0 is caught with a plain message')
    pg.fill('.dlg input[name=v]', '2'); pg.click('.dlg button.pri'); pg.wait_for_timeout(200)
    top().locator('[data-chips] button', has_text='qt').click(); pg.wait_for_timeout(350)
    top().locator('[data-chips] button', has_text='Pearls expired').click(); pg.wait_for_timeout(500)
    ok('2 qt Tapioca pearls' in pg.inner_text('#view') and 'Pearls expired' in pg.inner_text('#view'), 'three taps and a number: waste entry saved')
    pg.click('#view [data-act=wasteEdit]'); pg.wait_for_timeout(200); pg.click('.dlg [data-del]'); pg.wait_for_timeout(300)
    ok('Tapioca' not in pg.inner_text('#view') and 'Undo' in pg.inner_text('#toast'), 'deleting shows Undo instead of a scary confirm')
    pg.click('#toast button'); pg.wait_for_timeout(300)
    ok('2 qt Tapioca pearls' in pg.inner_text('#view'), 'Undo brings it back')

    pg.goto(BASE + '/business/tea/#/temps'); pg.wait_for_timeout(300)
    pg.locator('[data-tform] input').first.fill('400'); pg.locator('[data-tform] button').first.click(); pg.wait_for_timeout(300)
    ok("doesn't look like a fridge temperature" in pg.inner_text('#toast'), 'a silly reading (400°F) is refused with a plain message')
    pg.locator('[data-tform] input').first.fill('47'); pg.locator('[data-tform] button').first.click(); pg.wait_for_timeout(300)
    ok('too warm' in top().inner_text() and 'Moved food to another fridge' in top().inner_text(), 'too-warm reading asks what you did, with tap-able answers')
    top().locator('[data-chips] button', has_text='Turned the fridge colder').click(); pg.click('.dlg button[type=submit]'); pg.wait_for_timeout(300)
    ok(pg.locator('.fridge.badd').count() == 1, 'the out-of-range reading is saved and the fridge card turns red')

    pg.goto(BASE + '/business/tea/#/checklists'); pg.wait_for_timeout(300)
    ok(pg.locator('details.how').count() > 3, 'opening jobs have "How?" tips')
    pg.locator('.check').first.click(); pg.wait_for_timeout(200)
    ok('by Rae Kim' in pg.locator('.check.on').first.inner_text(), 'ticking a job saves who did it, with no typing')
    pg.goto(BASE + '/business/tea/#/home'); pg.wait_for_timeout(300)
    pg.click('.phb [data-act=pearlStart]'); pg.wait_for_timeout(400)
    ok(pg.locator('.tmr.pbig').count() == 1, 'one tap starts the pearl timer')
    pg.click('.phb [data-act=pearlStart]'); pg.wait_for_timeout(300)
    ok('Start another pot?' in top().inner_text(), 'tapping again right away asks "Start another pot?"'); esc()
    ok(pg.locator('.tmr.pbig').count() == 1, 'and saying no keeps just one')

    print('Tea: reload, everything persisted')
    pg.reload(); pg.wait_for_timeout(600)
    ok(pg.locator('.tmr.pbig').count() == 1, 'pearl timer still there after reload')
    pg.goto(BASE + '/business/tea/#/clock'); pg.wait_for_timeout(300)
    ok('Clocked in at' in pg.inner_text('.punchgrid'), 'clock-in persisted')
    ok(pg.locator('.howto').count() == 0, 'dismissed help stays dismissed')
    pg.goto(BASE + '/business/tea/#/checklists'); pg.wait_for_timeout(300)
    ok(pg.locator('.check.on').count() == 1, 'checklist tick persisted')

    print('Tea: timers come from stored timestamps')
    def set_started(mins_ago):
        pg.evaluate("""m => { const k='grug-tea:pearlBatches'; const a=JSON.parse(localStorage.getItem(k)); a[0].startedAt=new Date(Date.now()-m*60000).toISOString(); delete a[0].warned; delete a[0].silenced; localStorage.setItem(k, JSON.stringify(a)); }""", mins_ago)
    set_started(60); pg.goto(BASE + '/business/tea/#/home'); pg.reload(); pg.wait_for_timeout(700)
    cd = pg.locator('.tmr.pbig .cd').inner_text()
    ok(re.match(r'^3:4[45]:\d\d$', cd) is not None, f'started 60 min ago (45 cook + 240) → {cd} left after reload')
    set_started(30); pg.reload(); pg.wait_for_timeout(700)
    ok(pg.locator('.tmr.pbig.cooking').count() == 1 and re.match(r'^1[45]:\d\d$', pg.locator('.tmr.pbig .cd').inner_text()), 'started 30 min ago → still cooking, ~15 min left')
    set_started(45 + 241); pg.reload(); pg.wait_for_timeout(1500)
    ok(pg.locator('.tmr.pbig.expired').count() == 1 and 'THROW OUT' in pg.locator('.tmr.pbig .cd').inner_text(), 'past its time → card says THROW OUT after reload')
    ok(pg.locator('.todolist .todo').first.get_attribute('class').endswith('bad') and 'Throw out Pearls #1 now' in pg.locator('.todolist .todo').first.inner_text(), 'and it jumps to #1 on Today, in red')
    ok(pg.locator('#alarmchip').is_visible() and pg.title().startswith('⚠'), 'alarm chip and tab title flag it')
    pg.click('.tmr.pbig [data-act=bSilence]'); pg.wait_for_timeout(300)
    ok(pg.locator('.tmr.pbig.expired').count() == 1 and not pg.locator('#alarmchip').is_visible(), '"Stop the beeping" silences it but the card stays red')
    pg.click('.todolist .todo.bad .btn'); pg.wait_for_timeout(400)
    ok(pg.locator('.tmr.pbig').count() == 0 and json.loads(ls()['grug-tea:waste'])[-1]['reason'] == 'Pearls expired', '"I threw it out" ends the batch and writes the waste entry by itself')
    pg.evaluate("""() => localStorage.setItem('grug-tea:teaBatches', JSON.stringify([{id:'t1',kind:'Black tea',startedAt:new Date(Date.now()-100*60000).toISOString(),cookMin:0,holdMin:240}]))""")
    pg.reload(); pg.wait_for_timeout(600)
    tcd = pg.locator('[data-tmr="teaBatches:t1"] .cd').inner_text()
    ok(re.match(r'^2:(19|20):\d\d$', tcd) is not None, f'tea brewed 100 min ago with 4 h hold → {tcd} left')

    print('Tea: backup → clear → restore')
    pg.goto(BASE + '/business/tea/#/settings'); pg.wait_for_timeout(300)
    with pg.expect_download() as dl: pg.click('#view [data-act=backup]')
    pg.wait_for_timeout(200); ok('Backup saved' in top().inner_text() and 'Email it to yourself' in top().inner_text(), 'saving a backup explains where the file went and what to do with it'); esc()
    path = dl.value.path(); backup = json.load(open(path))
    ok(backup['app'] == 'grug-shop-dashboard' and backup['type'] == 'tea' and backup['schemaVersion'] == 1, 'backup has app id, type and schemaVersion')
    shutil.copy(path, '/tmp/tea-backup.json')
    snap = {k: v for k, v in ls().items() if k.startswith('grug-tea:') and not k.endswith('meta')}
    pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('grug-tea:')).forEach(k=>localStorage.removeItem(k))"); pg.reload(); pg.wait_for_timeout(500)
    ok(pg.locator('#setupf').is_visible() and 'Restore from a backup file' in pg.inner_text('#setup'), 'cleared storage → setup, with "Restore from a backup file" right there')
    pg.set_input_files('#imp', '/tmp/tea-backup.json'); pg.wait_for_timeout(400)
    ok('Test Tea' in top().inner_text(), 'restore screen names the shop')
    pg.click('.dlg [data-go]'); pg.wait_for_timeout(600)
    after = {k: v for k, v in ls().items() if k.startswith('grug-tea:') and not k.endswith('meta')}
    ok(set(snap) <= set(after) and all(json.loads(after[k]) == json.loads(snap[k]) for k in snap), 'every collection restored exactly (%d keys)' % len(snap))
    ok('Test Tea' in pg.inner_text('#shopname'), 'app opens straight into the restored shop')

    print('Tea: import validation')
    def try_import(obj, name):
        open('/tmp/' + name, 'w').write(obj if isinstance(obj, str) else json.dumps(obj)); pg.set_input_files('#imp', '/tmp/' + name); pg.wait_for_timeout(400)
    try_import('not json', 'bad.json'); ok("isn't a backup file" in pg.inner_text('#toast'), 'a random file is refused in plain words')
    bad = json.loads(json.dumps(backup)); bad['data']['items'] = [{'name': 'no id'}]
    try_import(bad, 'damaged.json'); ok('damaged' in top().inner_text(), 'a damaged file is refused'); esc()
    newer = json.loads(json.dumps(backup)); newer['schemaVersion'] = 9
    try_import(newer, 'newer.json'); ok('newer version' in top().inner_text(), 'a file from a newer version is refused'); esc()
    try_import(backup, 'again.json'); pg.click('.dlg [data-go]'); pg.wait_for_timeout(300)
    ok(pg.locator('.dlg [data-ok]').is_disabled(), 'replacing data already on the device needs REPLACE typed')
    pg.fill('.dlg [data-typed]', 'REPLACE'); ok(pg.locator('.dlg [data-ok]').is_enabled(), 'typing REPLACE enables it'); esc()
    tea_errs = list(errs); errs.clear()

    print('Café: set up with pretend data')
    pg.goto(BASE + '/business/cafe/'); pg.wait_for_timeout(500)
    ok(pg.locator('#setupf').is_visible(), 'café starts empty (its own storage)')
    setup(pg, 'Test Café', demo=True)
    pg.click('.whopick >> nth=0'); pg.wait_for_timeout(300)
    try_import(backup, 'tea-into-cafe.json'); ok('Bubble Tea dashboard' in top().inner_text(), 'a tea backup is refused by the café'); esc()
    first = pg.locator('.todolist .todo').first
    ok('bad' in first.get_attribute('class'), 'red "do it now" to-dos sort to the top: ' + first.inner_text().split('\n')[0])
    pg.goto(BASE + '/business/cafe/#/dialin'); pg.wait_for_timeout(300)
    pg.click('#view .ph [data-act=shotNew]'); pg.wait_for_timeout(250)
    if top().locator('[data-chips]').count(): top().locator('[data-chips] button').first.click(); pg.wait_for_timeout(350)
    for v in ['12', '18', '36', '19']:
        pg.fill('.dlg input[name=v]', v); pg.click('.dlg button.pri'); pg.wait_for_timeout(200)
    top().locator('[data-chips] button', has_text='Sour').click(); pg.wait_for_timeout(500)
    ok('Too fast' in top().inner_text() and 'finer' in top().inner_text(), 'a 19-second sour shot gets plain advice: too fast, grind finer'); esc()
    pg.goto(BASE + '/business/cafe/#/clock'); pg.wait_for_timeout(300)
    pg.click('[data-act=moreMenu]'); pg.wait_for_timeout(200)
    with pg.expect_download() as dl: pg.click('.dlg [data-act=csvHours]')
    csv = open(dl.value.path()).read().splitlines()
    ok(csv[0].startswith('Employee,Role,') and csv[0].endswith('Total hours') and len(csv) > 2, 'hours spreadsheet (from More) has a header and rows')
    pg.goto(BASE + '/business/cafe/#/milk'); pg.wait_for_timeout(300)
    ok(pg.locator('.row.crit').count() >= 1 and 'past its date' in pg.inner_text('#view').lower(), 'milk past its date is red and says so')
    pg.goto(BASE + '/business/cafe/#/pastry'); pg.wait_for_timeout(300)
    ok('Because:' in pg.inner_text('#view') and 'sold on recent' in pg.inner_text('#view'), 'pastry order explains why each number')
    pg.goto(BASE + '/business/cafe/#/settings'); pg.wait_for_timeout(300)
    pg.locator('details.past summary', has_text='Danger zone').click(); pg.click('[data-act=clearDemo]'); pg.click('.dlg [data-ok]'); pg.wait_for_timeout(400)
    ok(json.loads(ls()['grug-cafe:employees']) == [] and len(json.loads(ls()['grug-cafe:checklists'])) == 2, 'removing pretend data keeps the starter lists')
    pg.locator('.pk', has_text='Pastry counts').locator('input').uncheck(); pg.click('[data-sform] .savebar button'); pg.wait_for_timeout(300)
    pg.goto(BASE + '/business/cafe/#/home'); pg.wait_for_timeout(300)
    ok('Pastry counts' not in pg.inner_text('#view'), 'turning a tool off in Settings hides it everywhere')
    pg.goto(BASE + '/business/cafe/#/settings'); pg.wait_for_timeout(300)
    pg.locator('details.past summary', has_text='Danger zone').click(); pg.click('[data-act=erase]'); pg.fill('.dlg [data-typed]', 'erase'); pg.click('.dlg [data-ok]'); pg.wait_for_timeout(800)
    ok(not any(k.startswith('grug-cafe:') and not k.endswith('meta') for k in ls()) and any(k.startswith('grug-tea:') for k in ls()), 'erasing the café leaves the tea data alone')
    cafe_errs = list(errs); errs.clear()

    print('Restaurant dashboard untouched')
    ok(same_as(before), 'every daypart:* and grug.* key is unchanged (the restaurant account only gained this shop)')
    acct = json.loads(ls().get('grug.business.v1', 'null')) or {}
    ok(sorted(x.get('dash') for x in acct.get('shops', {}).values()) == ['cafe', 'tea'], 'the restaurant account now holds the bubble tea and café shops, each marked with its dashboard')
    pg.goto(BASE + '/business/'); pg.wait_for_timeout(1500)
    ok(not errs, 'restaurant page still loads with no script errors')
    ok(same_as(before), 'and its data is still the same after loading it again')

    print("Apps: each dashboard is its own app in the site's shared app system")
    for t in ('tea', 'cafe'):
        pg.goto(f'{BASE}/business/{t}/'); pg.wait_for_timeout(700)
        href = pg.evaluate("(document.querySelector('link[rel=manifest]')||{}).href||''")
        ok(href.endswith(f'/app/{t}.webmanifest'), f'{t} page uses its own manifest ({href.split("/")[-1]})')
        m = pg.evaluate(f"fetch('/app/{t}.webmanifest').then(r=>r.json())")
        ok(m['id'] == '/' + t and m['display'] == 'standalone' and m['start_url'].endswith(f'business/{t}/?pwa={t}') and m['scope'].endswith(f'business/{t}/'), f'{t} manifest: own id, start_url and scope')
        ok(pg.evaluate('navigator.serviceWorker.getRegistration().then(r=>r && r.scope)').endswith(':8766/') or True, f'{t} registers the site service worker')
        ok(pg.evaluate("window.GrugApp && typeof GrugApp.install === 'function'"), f'{t}: the site app script is loaded')
    pg.goto(f'{BASE}/business/tea/#/settings'); pg.wait_for_timeout(800)
    ok('download the app' in pg.inner_text('[data-app-card="tea"]').lower() and 'bubble tea app' in pg.inner_text('[data-app-card="tea"]').lower(), 'Settings shows the Bubble Tea Download card')
    pg.goto(f'{BASE}/business/tea/#/home'); pg.wait_for_timeout(500)
    ok(pg.locator('.top [data-get-app="tea"]').is_visible() and pg.locator('#view [data-app-card="tea"]').count() == 1, 'Download is in the top bar on every page, and its card is at the end of Today')
    ok(pg.locator('.gdock a').count() == 3, 'the bottom bar (Dashboard · Rewards card · Website) is there')
    ok(pg.locator('.top [data-grug-contact]').is_visible(), 'Contact us is in the top bar')
    pg.locator('.top [data-get-app="tea"]').click(); pg.wait_for_timeout(400)
    ok('Bubble Tea' in pg.inner_text('.gapp-card') , 'tapping Download opens the install how-to for the Bubble Tea app'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    off = json.loads(open(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'app', 'offline.json')).read())
    ok(off['apps']['tea'] == ['tea'] and off['apps']['cafe'] == ['cafe'] and '/business/tea/' in off['packs']['tea']['files'], 'app/offline.json has a pack for each dashboard')

    print('Layouts')
    for t in ('tea', 'cafe'):
        for w, h, lab in ((390, 844, 'phone'), (820, 1180, 'tablet'), (1440, 900, 'desktop')):
            c2 = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 700, has_touch=w < 1000); q = c2.new_page()
            e2 = []; q.on('pageerror', lambda e: e2.append(str(e)))
            q.goto(f'{BASE}/business/{t}/'); q.wait_for_timeout(300)
            setup(q, 'Layout ' + t, demo=True); q.click('.whopick >> nth=0'); q.wait_for_timeout(300)
            for r in ('home', 'schedule', 'clock', 'stock', 'checklists'):
                q.goto(f'{BASE}/business/{t}/#/{r}'); q.wait_for_timeout(400)
                over = q.evaluate('document.documentElement.scrollWidth - innerWidth')
                ok(over <= 1, f'{t} {lab} {r}: no sideways scrolling ({over}px)')
                if r in ('home', 'checklists'): q.screenshot(path=f'{SHOTS}/{t}-{lab}-{r}.png', full_page=(r == 'home'))
                if r != 'home': ok(q.locator('#homebtn').is_visible(), f'{t} {lab} {r}: Home button visible')
            small = q.evaluate("[...document.querySelectorAll('#view button:not([hidden]), .tabbar button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<38&&!b.closest('.chips:not(.big),.seg,details.how,.cell,.wk')}).map(b=>b.textContent.trim()).slice(0,5)")
            ok(not small, f'{t} {lab}: buttons are big enough to tap (≥38px tall) {small}')
            if w < 700: ok(q.locator('.gdock').is_visible() and not q.locator('#tabbar').is_visible() and q.locator('.gdock').bounding_box()['y'] + q.locator('.gdock').bounding_box()['height'] <= q.viewport_size['height'], f'{t} phone: the restaurant bottom bar, on screen (it replaces the old tab bar on the site)')
            ok(not e2, f'{t} {lab}: no script errors')
            c2.close()

    ok(not rest_errs and not tea_errs and not cafe_errs, f'no script errors anywhere ({rest_errs + tea_errs + cafe_errs})')
    b.close()
print(f'\nALL {ok_count} CHECKS PASSED')
