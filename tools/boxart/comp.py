from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageChops
import math, random, sys
W,H=1580,950
import os
HERE=os.path.dirname(os.path.abspath(__file__))+'/'
REPO=os.path.abspath(HERE+'../..')+'/'
OUT=REPO+'assets/boxart/'
def cover(im,w,h,fx=.5,fy=.5,zoom=1.0):
    s=max(w/im.width,h/im.height)*zoom; im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    x=round((im.width-w)*fx); y=round((im.height-h)*fy); return im.crop((x,y,x+w,y+h))
def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def burst(size,center,color,alpha=60,rays=18):
    L=Image.new('L',size,0); d=ImageDraw.Draw(L); cx,cy=center; R=2400
    for i in range(rays):
        a0=2*math.pi*i/rays; a1=a0+math.pi/rays*0.9
        d.polygon([(cx,cy),(cx+R*math.cos(a0),cy+R*math.sin(a0)),(cx+R*math.cos(a1),cy+R*math.sin(a1))],fill=alpha)
    # fade with distance
    g=Image.radial_gradient('L').resize((1800,1800)); g=ImageChops.invert(g)
    G=Image.new('L',size,0); G.paste(g,(cx-900,cy-900)); L=ImageChops.multiply(L,G).filter(ImageFilter.GaussianBlur(3))
    col=Image.new('RGB',size,color); return col,L
def star(d,x,y,r,fill):
    pts=[]
    for i in range(8):
        a=math.pi/4*i-math.pi/2; rr=r if i%2==0 else r*0.28; pts.append((x+rr*math.cos(a),y+rr*math.sin(a)))
    d.polygon(pts,fill=fill)
def make(id,bg,pose=None,fx=.5,fy=.5,zoom=1.0,blur=0,accent='#ffffff',side='right',h_av=880,xc=None,bottom=40,sparkle=None,grade=1.08,burst_a=55):
    im=Image.open(bg).convert('RGB'); im=cover(im,W,H,fx,fy,zoom)
    if blur: im=im.filter(ImageFilter.GaussianBlur(blur))
    im=ImageEnhance.Color(im).enhance(grade); im=ImageEnhance.Contrast(im).enhance(1.04)
    base=im.convert('RGBA')
    if pose:
        av=Image.open(pose).convert('RGBA'); av=av.crop(av.getbbox())
        s=h_av/av.height; av=av.resize((round(av.width*s),round(av.height*s)),Image.LANCZOS)
        cx = xc if xc is not None else (int(W*0.70) if side=='right' else int(W*0.30))
        x=cx-av.width//2; y=H-bottom-av.height
        # light burst behind the hero
        col,L=burst((W,H),(cx,y+av.height//3),hexrgb(accent),burst_a)
        base=Image.composite(Image.blend(base.convert('RGB'),col,0.0).convert('RGBA'),base,Image.new('L',(W,H),0))
        lay=Image.new('RGBA',(W,H),(0,0,0,0)); lay.paste(col,(0,0)); lay.putalpha(L); base=Image.alpha_composite(base,lay)
        a=av.split()[3]
        full=Image.new('L',(W,H),0); full.paste(a,(x,y))
        # soft shadow
        sh=full.filter(ImageFilter.GaussianBlur(18)).point(lambda v:int(v*0.45))
        shl=Image.new('RGBA',(W,H),(10,8,20,0)); shl.putalpha(ImageChops.offset(sh,14,16)); base=Image.alpha_composite(base,shl)
        # white sticker outline
        ol=full.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(1.2))
        oll=Image.new('RGBA',(W,H),(255,255,255,0)); oll.putalpha(ol); base=Image.alpha_composite(base,oll)
        # accent glow outside outline
        gl=full.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(14)).point(lambda v:int(v*0.55))
        gll=Image.new('RGBA',(W,H),hexrgb(accent)+(0,)); gll.putalpha(ImageChops.subtract(gl,ol)); base=Image.alpha_composite(base,gll)
        lay=Image.new('RGBA',(W,H),(0,0,0,0)); lay.paste(av,(x,y),av); base=Image.alpha_composite(base,lay)
        if sparkle:
            d=ImageDraw.Draw(base); bb=(x,y); sx,sy=sparkle; px,py=x+int(av.width*sx),y+int(av.height*sy)
            random.seed(3)
            for i in range(14):
                r=random.uniform(10,34); ox=random.gauss(0,70); oy=random.gauss(0,60)
                star(d,px+ox,py+oy,r,random.choice([(255,255,255,235),(255,236,140,235),(216,180,254,235),(249,168,212,235)]))
            for i in range(30):
                ox=random.gauss(0,110); oy=random.gauss(0,90); rr=random.uniform(2,5)
                d.ellipse((px+ox-rr,py+oy-rr,px+ox+rr,py+oy+rr),fill=(255,255,255,200))
    # top-left darkening for the title + vignette
    tl=Image.radial_gradient('L').resize((1700,1100)); tl=ImageChops.invert(tl).point(lambda v:int(v*0.45))
    T=Image.new('L',(W,H),0); T.paste(tl,(-650,-560)); dl=Image.new('RGBA',(W,H),(8,6,18,0)); dl.putalpha(T); base=Image.alpha_composite(base,dl)
    vg=Image.radial_gradient('L').resize((int(W*1.5),int(H*1.6))).crop((int(W*.25),int(H*.3),int(W*.25)+W,int(H*.3)+H)).point(lambda v:max(0,int((v-150)*0.55)))
    vl=Image.new('RGBA',(W,H),(0,0,0,0)); vl.putalpha(vg); base=Image.alpha_composite(base,vl)
    base.convert('RGB').save(OUT+id+'.jpg',quality=88,optimize=True,progressive=True)
    print('ok',id)
C=HERE+'work/'; TH=REPO+'assets/thumbs/'
jobs={
 'teahouse':dict(bg=C+'th2_2.png',pose=C+'pose_sprint.png',accent='#9BE338',fx=.5,fy=.6,zoom=1.0,h_av=700,xc=1120,bottom=70),
 'soluna':dict(bg=C+'so_0.png',fx=.5,fy=.5,zoom=1.0),
 'rodeo':dict(bg=C+'ro2_1.png',pose=C+'pose_lasso.png',accent='#F2A33A',fx=.4,fy=.5,zoom=1.06,h_av=800,xc=1170,bottom=45),
 'runway':dict(bg=C+'rw_0.png',pose=C+'pose_strut.png',accent='#F43F5E',h_av=880,xc=1130),
 'chestquest':dict(bg=C+'cq_1.png',pose=C+'pose_flee.png',accent='#FBBF24',fy=.3,zoom=1.08,h_av=820,xc=1130),
 'glowupspa':dict(bg=C+'gs2_1.png',pose=C+'pose_glam.png',accent='#EC4899',fx=.45,fy=.55,zoom=1.25,h_av=880,xc=1150),
 'petmountainrescue':dict(bg=C+'pm_0.png',pose=C+'pose_climb.png',accent='#f97316',fy=.35,zoom=1.05,h_av=860,xc=1150),
 'alchemy':dict(bg=C+'al_2.png',pose=C+'pose_cast.png',accent='#c084fc',fx=.6,zoom=1.05,h_av=860,xc=1180,sparkle=(0.02,0.12)),
 'mysteryblasters':dict(bg=C+'mb3_1.png',pose=C+'pose_aim.png',accent='#22D3EE',fx=.5,fy=.5,zoom=1.05,h_av=770,xc=1150,bottom=55),
 'crafthouse':dict(bg=C+'ch_bg.jpg',pose=C+'pose_kick.png',accent='#CFAC52',fx=.5,fy=.5,zoom=1.0,h_av=820,xc=1180,bottom=40),
 'takeatea':dict(bg=TH+'teahouse.jpg',pose=C+'pose_serve.png',accent='#F6C445',blur=2.2,h_av=860,xc=1140),
}
only=sys.argv[1:]
for k,v in jobs.items():
    if only and k not in only: continue
    make(k,**v)
