import sys,json
from playwright.sync_api import sync_playwright
hash_=sys.argv[1]; out=sys.argv[2]; js=sys.argv[3] if len(sys.argv)>3 else None; w=int(sys.argv[4]) if len(sys.argv)>4 else 1280
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':w,'height':850}); logs=[]
    pg.on('console',lambda m:logs.append(m.type+': '+m.text[:250]) if m.type in('error','warning') and 'GPU stall' not in m.text else None); pg.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)[:400]))
    pg.goto('http://localhost:8766/labs/catalog/'+hash_); pg.wait_for_function('window.GrugCatalog&&window.GrugCatalog.sandy',timeout=120000); pg.wait_for_timeout(4000)
    if js: print(pg.evaluate(js)); pg.wait_for_timeout(2500)
    pg.screenshot(path=out)
    for l in logs[:15]: print(l)
    b.close()
