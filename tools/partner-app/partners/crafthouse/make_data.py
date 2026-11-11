"""Makes data.json for a partner's app (run it from anywhere: python3 make_data.py). A copy of this lives in each
partner folder; for a new partner, copy it and change TAGS and the inputs.

Inputs, next to this file:
  menu_raw.json    [{"cat": "Burgers", "items": [{"n": name, "d": description, "p": "$12.99", "img": photo key?}]}]
  img_data.json    {photo key: "data:image/jpeg;base64,..."}  (menu photos, about 480 px wide, JPEG quality ~70)
  logo-square.png  the venue's logo, square, for the struck coin (turned grey and embossed in the app)
  font.woff2       the app's typeface (CraftHouse: Bricolage Grotesque, OFL)
TAGS below tags each dish for the "What should I order?" quiz: name|course|protein(s)|heat 0-2|form|style|sweet
(course: app/main/soup/dessert/kids; form: share/hand/bowl/fork; style: classic/cajun/southwest; sweet: fruit/choc/cream).
Dishes without tags are still on the menu, just not in the quiz. Items whose description says "top seller" or
"guest favorite" are starred as crowd favourites.
(CraftHouse's img_data.json, logo and font are already baked into its data.json and aren't kept separately.)
"""
import json, base64, io, os, re, sys
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__)) + '/'
menu = json.load(open(W + 'menu_raw.json'))
imgd = json.load(open(W + 'img_data.json'))

# name | course | protein(s) | heat | form | style | extra
TAGS = """
Crafthouse Balls|app|beef|1|share|classic
Cheesy Bites|app|veg|1|share|classic
Cheesy Bites - Buffalo Style|app|veg|2|share|classic
Big Rings|app|veg|0|share|classic
Pretzel Sticks|app|veg|0|share|classic
Basket Fries|app|veg|0|share|classic
BYOB - Burger|main|beef|0|hand|classic
Caroline|main|beef|0|hand|classic
Freddy|main|beef,pork|1|hand|cajun
Newton|main|beef|0|hand|classic
Pablo|main|beef|1|hand|southwest
Bubba|main|beef|1|hand|southwest
Peppe|main|beef|2|hand|southwest
BOM - Buffalo Mac Chicken Sandwich|main|chicken|2|hand|classic
Boudin Balls|app|pork|1|share|cajun
Boudin Balls Pepper Jack|app|pork|1|share|cajun
LRG Cajun Club Poboy|main|beef,pork|1|hand|cajun
LRG Evelyn's Boudin Poboy|main|pork|1|hand|cajun
Gumbo|soup|chicken,pork|1|bowl|cajun
Red Beans & Saus w/Rice|main|pork|1|bowl|cajun
Chicken Pesto|main|chicken|0|fork|classic
Chicken Poblano|main|chicken|1|fork|southwest
5 Tender Basket|main|chicken|0|hand|classic
3 Tender Basket|main|chicken|0|hand|classic
Apple Cobbler|dessert|veg|0|fork|classic|fruit
Jeanne's White Chocolate Bread Pudding|dessert|veg|0|fork|cajun|choc
Chocolate Molten Lava|dessert|veg|0|fork|classic|choc
Ice Cream|dessert|veg|0|bowl|classic|cream
Chicky|main|chicken|0|hand|southwest
Margherita|main|veg|0|hand|classic
Dachshund|main||0|hand|classic
Hound Dog|main||0|hand|classic
Kids Chick Tenders|kids|chicken|0|hand|classic
Kid Burger|kids|beef|0|hand|classic
Mac N Cheese|kids|veg|0|bowl|classic
Mini Corn Dogs|kids||0|hand|classic
Big Wedge|main||0|fork|classic
Summer Salad|main|veg|0|fork|classic
Cypress Salad|main|veg|0|fork|classic
LRG Maria's Cuban|main|pork|0|hand|classic
LRG Philly Cheesesteak|main|beef|0|hand|classic
Victorian BLT|main|pork|0|hand|classic
Lexington Pulled Pork|main|pork|0|hand|classic
LRG Shrimp Poboy|main|seafood|1|hand|cajun
Grilled Cheese|main|veg|0|hand|classic
Grilled Salmon|main|seafood|0|fork|classic
Chipotle Blackened Salmon|main|seafood|1|fork|southwest
Fish & Chips|main|seafood|0|fork|classic
Chipotle Shrimp|main|seafood|1|fork|southwest
Nola's Shrimp|main|seafood|1|fork|cajun
Chicken Tortilla|soup|chicken|0|bowl|southwest
Chili|soup|beef|1|bowl|southwest
Potato Soup|soup|veg|0|bowl|classic
Tomato Basil|soup|veg|0|bowl|classic
Crafthouse Ribeye|main|beef|0|fork|classic
South American Filet|main|beef|1|fork|southwest
Sirloin|main|beef|0|fork|classic
Texas Pork Chop|main|pork|0|fork|classic
Dixie Tacos|main|pork|0|hand|classic
Monterey Tacos|main|chicken|0|hand|southwest
Lavaca Bay Tacos|main|seafood|1|hand|southwest
Cypress Yard Bird Tacos|main|chicken|2|hand|classic
Grilled Shrimp Tacos|main|seafood|0|hand|southwest
"""
tags = {}
for l in TAGS.strip().split('\n'):
    p = l.split('|')
    tags[p[0]] = {'c': p[1], 'pr': [x for x in p[2].split(',') if x], 'h': int(p[3]), 'f': p[4], 's': p[5]}
    if len(p) > 6: tags[p[0]]['sw'] = p[6]

imgs = []; idx = {}
out = []
used = set()
for c in menu:
    items = []
    for it in c['items']:
        o = {'n': it['n'], 'd': it['d'], 'p': it['p']}
        if 'img' in it:
            if it['img'] not in idx:
                idx[it['img']] = len(imgs); imgs.append(imgd[it['img']])
            o['i'] = idx[it['img']]
        if it['n'] in tags:
            o['t'] = tags[it['n']]; used.add(it['n'])
        d = it['d'].lower()
        if 'top sell' in d or 'top-sell' in d or 'guest favorite' in d or 'customers rave' in d: o['top'] = 1
        items.append(o)
    out.append({'cat': c['cat'], 'items': items})
missing = set(tags) - used
if missing: print('UNUSED TAGS', missing)

logo = Image.open(W + 'logo-square.png').convert('L').resize((384, 384), Image.LANCZOS)
b = io.BytesIO(); logo.save(b, 'PNG', optimize=True)
logo_url = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
font = base64.b64encode(open(W + 'font.woff2', 'rb').read()).decode()


json.dump({'menu':out,'imgs':imgs,'logo':logo_url,'font':font},open(W+'data.json','w'))
print('data ok', len(out))
