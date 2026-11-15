import sys
from playwright.sync_api import sync_playwright
t = sys.argv[1]; f = {'tea':'tea-boba-dashboard.html','cafe':'cafe-dashboard.html'}[t]
url = 'file:///home/claude/shopdash/dist/standalone/' + f
routes = sys.argv[2].split(',')
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1366
def setup(pg, name, demo=True, team=()):
    pg.fill('#setupf input[name=name]', name); pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    for n in team: pg.fill('#setupf input[name=person]', n); pg.click('[data-addp]'); pg.wait_for_timeout(100)
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    if demo: pg.check('#setupf input[name=demo]')
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(150)
    pg.click('#setupf button[type=submit]'); pg.wait_for_timeout(600)
if __name__ == '__main__':
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width':W,'height':900})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.goto(url); pg.wait_for_timeout(300)
    for i in range(4): pg.screenshot(path=f'/home/claude/shopdash/test/shots/{t}-setup{i}.png') if False else None
    setup(pg, 'Pearl & Leaf' if t=='tea' else 'Morning Ritual Café')
    pg.screenshot(path=f'/home/claude/shopdash/test/shots/{t}-who.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    for r in routes:
        pg.goto(url + '#/' + r); pg.wait_for_timeout(450)
        v = pg.inner_text('#view'); bad = 'Something went wrong' in v
        print(('BAD ' if bad else 'ok  ') + r.ljust(12), v[:110].replace('\n',' | '))
        pg.screenshot(path=f'/home/claude/shopdash/test/shots/{t}-{r}-{W}.png', full_page=True)
    print('errors:', errs[:10])
    b.close()
