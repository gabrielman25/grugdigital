import sys,json
from playwright.sync_api import sync_playwright
out=sys.argv[1]; specs=json.loads(sys.argv[2]); views=json.loads(sys.argv[3]) if len(sys.argv)>3 else [[0.6,0.2,75,[6,12,0]]]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1280,'height':850}); logs=[]
    pg.on('console',lambda m:logs.append(m.type+': '+m.text[:250]) if m.type in('error','warning') and 'GPU stall' not in m.text else None); pg.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)[:400]))
    pg.goto('http://localhost:8766/labs/catalog/#edit/sandals'); pg.wait_for_function('window.GrugCatalog&&window.GrugCatalog.sandy',timeout=120000); pg.wait_for_timeout(3000)
    for i,sp in enumerate(specs):
        info=pg.evaluate("(sp)=>{const C=window.GrugCatalog,J=C.J,JM=C.JM;let d=J.random('sandals',sp.seed||'x',{kind:sp.kind,brand:sp.brand});Object.assign(d,sp.set||{});d=J.validate('sandals',d,d.brand).d;JM.load('sandals',d,{seed:'t',name:'t'});JM.rebuild(true);return JSON.stringify(JM.built.info)+' '+d.style+' soleH '+d.soleH.toFixed(1)+' heel '+d.heelType+d.heelH.toFixed(1)}",sp)
        print(i,info)
        for v,(yaw,pitch,dist,tg) in enumerate(views):
            pg.evaluate("([y,p,d,t])=>{const C=window.GrugCatalog;C.cam.yaw=y;C.cam.pitch=p;C.cam.dist=d;C.cam.target.set(...t)}",[yaw,pitch,dist,tg]); pg.wait_for_timeout(1200)
            pg.screenshot(path=f'{out}{i}_{v}.png',clip={'x':280,'y':56,'width':650,'height':794})
    for l in logs[:15]: print(l)
    b.close()
