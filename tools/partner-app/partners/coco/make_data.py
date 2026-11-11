"""Makes data.json for Coco Crepes' app (python3 make_data.py). Run fetch_menu.py first.

Inputs, next to this file:
  menu_raw.json       [{"cat": "Sweet Crêpes", "items": [{"n": name, "d": description, "p": price or "", "img": photo key}]}]
  img_data.json       {photo key: "data:image/jpeg;base64,..."}  (made by fetch_menu.py, not kept in git)
  logo-square.png     the wordmark, dark on white, for the struck coin
  font.woff2          body text: Montserrat (OFL), the site's body face
  font-display.woff2  headings: Frank Ruhl Libre (OFL), the site's heading face (and the logo's serif)

TAGS tags each dish for the "What should I order?" quiz (questions in quiz.json): space-separated key=value pairs, a
comma means "any of these". Keys used here:
  k   what it is: sweet, savory, coffee, smoothie, gelato, sip (tea, lemonade, cocoa)
  f   form: crepe, waffle, panini, salad, soup
  fl  sweet flavour: choc, fruit, caramel, creamy, cinnamon
  pr  filling: chicken, sausage, ham, salmon, beef, turkey, egg, veg
  h   heat 0/1 (harissa, jalapeño)        b   breakfast 1
  tp  hot / iced                          cs  coffee style: bold, milky, sweet      sm  smoothie: fruity, protein, green
A missing number counts as 0. Dishes without tags are on the menu but not in the quiz.
SIGNATURE dishes are marked as house signatures (the Coco-named and Moroccan dishes), shown on Home.
"""
import json, base64, io, os
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__)) + '/'
menu = json.load(open(W + 'menu_raw.json'))
imgd = json.load(open(W + 'img_data.json'))

S, SV, CF = 'k=sweet', 'k=savory', 'k=coffee'
TAGS = {
    # sweet crêpes
    'Nutella': S + ' f=crepe fl=choc',
    'Cinnamon Roll Crêpe': S + ' f=crepe fl=cinnamon',
    "Coco's Crêpe": S + ' f=crepe fl=fruit,choc,caramel',
    "S'mores": S + ' f=crepe fl=choc',
    'White Chocolate Raspberry': S + ' f=crepe fl=choc,fruit',
    'Dulce de Leche': S + ' f=crepe fl=caramel',
    'Bananas Foster': S + ' f=crepe fl=caramel,fruit',
    'Crème Brûlée': S + ' f=crepe fl=creamy,caramel',
    'Cheesecake': S + ' f=crepe fl=creamy,fruit',
    'Tres Leches': S + ' f=crepe fl=creamy,fruit',
    'French Toast': S + ' f=crepe fl=cinnamon,creamy b=1',
    'Pistachio Butter Crêpe': S + ' f=crepe fl=caramel,creamy',
    'Tiramisu Crêpe': S + ' f=crepe fl=creamy,choc',
    # waffles
    'Sugar Waffle': S + ' f=waffle fl=caramel b=1',
    'Waffle Gelato Sandwich': S + ' f=waffle fl=choc,caramel',
    'Tuscan Waffle': SV + ' f=waffle pr=egg,veg h=1 b=1',
    'Avocado Toast Waffle': SV + ' f=waffle pr=veg b=1',
    # savory crêpes
    'Chicken + Spinach': SV + ' f=crepe pr=chicken',
    'Merguez Moroccan Sausage': SV + ' f=crepe pr=sausage',
    'Smoked Salmon': SV + ' f=crepe pr=salmon',
    'Beef Bourguignon': SV + ' f=crepe pr=beef',
    'Breakfast Crêpe': SV + ' f=crepe pr=egg,turkey,ham,chicken,sausage b=1',
    'Chicken + Avocado': SV + ' f=crepe pr=chicken h=1',
    'La Galette': SV + ' f=crepe pr=veg',
    'La Jardiniere': SV + ' f=crepe pr=veg',
    'Ham + Mozzarella': SV + ' f=crepe pr=ham h=1',
    'Mediterranean': SV + ' f=crepe pr=chicken h=1',
    'Turkey + Cheddar': SV + ' f=crepe pr=turkey',
    'Roasted Eggplant Crêpe': SV + ' f=crepe pr=veg h=1',
    'Wild Mushroom Crêpe': SV + ' f=crepe pr=veg',
    # paninis
    'Roasted Pesto Chicken Panini': SV + ' f=panini pr=chicken',
    'Merguez Moroccan Sausage Panini': SV + ' f=panini pr=sausage',
    'Caprese Panini': SV + ' f=panini pr=veg',
    'Mediterranean Panini': SV + ' f=panini pr=chicken h=1',
    'Smoked Salmon Panini': SV + ' f=panini pr=salmon',
    'Breakfast Sandwich': SV + ' f=panini pr=egg,turkey,ham,chicken,sausage b=1',
    'Croque Monsieur': SV + ' f=panini pr=ham,turkey,chicken,sausage h=1',
    # salads
    "Coco's House Salad": SV + ' f=salad pr=veg',
    'Caesar Salad': SV + ' f=salad pr=veg',
    # coffee
    'Double Shot': CF + ' cs=bold tp=hot',
    'Espresso Macchiato': CF + ' cs=bold tp=hot',
    'Espresso Con Panna': CF + ' cs=bold,sweet tp=hot',
    'Espresso Affogato': CF + ' cs=sweet tp=iced',
    'Moroccan Cortado': CF + ' cs=milky tp=hot',
    'Flat White': CF + ' cs=milky tp=hot',
    'Coco Addiction': CF + ' cs=sweet tp=iced',
    'Americano': CF + ' cs=bold tp=hot,iced',
    'Cappuccino': CF + ' cs=milky tp=hot',
    'Cafe Latte': CF + ' cs=milky tp=hot,iced',
    'Caramel Crisp': CF + ' cs=sweet tp=hot,iced',
    'Mocha': CF + ' cs=sweet tp=hot,iced',
    'House Coffee': CF + ' cs=bold tp=hot',
    'Cold Brew Coffee': CF + ' cs=bold tp=iced',
    'Organic Chai Tea Latte': CF + ' cs=milky tp=hot,iced',
    'Cococcino': CF + ' cs=sweet tp=iced',
    # smoothies
    'Coco Loco': 'k=smoothie sm=fruity',
    'Apple Crisp': 'k=smoothie sm=fruity',
    'Power Up': 'k=smoothie sm=protein',
    'Skinny Mini': 'k=smoothie sm=fruity,protein',
    'The Daily Fix': 'k=smoothie sm=protein',
    'Berry Berry': 'k=smoothie sm=fruity',
    'Tropical Kiss': 'k=smoothie sm=fruity',
    'Coco Green': 'k=smoothie sm=green',
    # gelato
    'Single Scoop': 'k=gelato',
    'Double Scoop': 'k=gelato',
    # tea, lemonade, cocoa
    'Lemonade': 'k=sip tp=iced',
    'Hot Dark Chocolate': 'k=sip tp=hot',
    'Sweet Moroccan Mint Tea': 'k=sip tp=hot',
    'Loose-Leaf Tea': 'k=sip tp=hot',
    'Fresh Brewed Iced Tea': 'k=sip tp=iced',
}
SIGNATURE = ["Coco's Crêpe", 'Cococcino', 'Coco Addiction', 'Coco Loco', "Coco's House Salad", 'Moroccan Cortado',
             'Merguez Moroccan Sausage', 'Sweet Moroccan Mint Tea']


def parse(s):
    t = {}
    for kv in s.split():
        k, v = kv.split('=')
        vs = [int(x) if x.isdigit() else x for x in v.split(',')]
        t[k] = vs if len(vs) > 1 else vs[0]
    return t


imgs, idx, out, used = [], {}, [], set()
for c in menu:
    items = []
    for it in c['items']:
        o = {'n': it['n'], 'd': it['d'], 'p': it['p']}
        if 'img' in it:
            if it['img'] not in idx:
                idx[it['img']] = len(imgs); imgs.append(imgd[it['img']])
            o['i'] = idx[it['img']]
        if it['n'] in TAGS:
            o['t'] = parse(TAGS[it['n']]); used.add(it['n'])
        if it['n'] in SIGNATURE:
            o['top'] = 1
        items.append(o)
    out.append({'cat': c['cat'], 'items': items})
missing = (set(TAGS) | set(SIGNATURE)) - used - {i['n'] for c in out for i in c['items']}
if missing: print('NAMES NOT ON THE MENU', missing)

logo = Image.open(W + 'logo-square.png').convert('L').resize((384, 384), Image.LANCZOS)
b = io.BytesIO(); logo.save(b, 'PNG', optimize=True)
font = lambda n: base64.b64encode(open(W + n, 'rb').read()).decode()
json.dump({'menu': out, 'imgs': imgs, 'logo': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(),
           'font': font('font.woff2'), 'font_display': font('font-display.woff2')}, open(W + 'data.json', 'w'))
print('data ok:', len(out), 'sections,', len(used), 'dishes in the quiz,', len(imgs), 'photos')
