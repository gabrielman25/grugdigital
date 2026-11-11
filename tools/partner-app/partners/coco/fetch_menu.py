"""Makes menu_raw.json and img_data.json for Coco Crepes from the menu on cococrepes.com (python3 fetch_menu.py).

The site's menu page carries every dish with its photo as schema.org JSON-LD; the dine-in menu has no prices online,
so "p" is left empty (the app hides an empty price). Catering is left out. Then run make_data.py.
"""
import base64, io, json, os, re, urllib.request
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__)) + '/'
URL = 'https://www.cococrepes.com/menus/'
UA = {'User-Agent': 'Mozilla/5.0'}

html = urllib.request.urlopen(urllib.request.Request(URL, headers=UA)).read().decode('utf-8')
menus = [j for j in (json.loads(b) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S))
         if j.get('@type') == 'Menu']
L = lambda x: x if isinstance(x, list) else [x]

# the app's sections, in order: (title, [(menu, section) pairs from the site]); '' = the site's unnamed section
CATS = [
    ('Sweet Crêpes', [('Crêpes & Waffles', 'Sweet Crêpes')]),
    ('Savory Crêpes', [('Crêpes & Waffles', 'Savory Crêpes')]),
    ('Waffles', [('Crêpes & Waffles', 'Waffles'), ('Crêpes & Waffles', '')]),
    ('Build Your Own', [('Create Your Own Crêpes & Waffles', 'Savory'), ('Create Your Own Crêpes & Waffles', 'Sweet')]),
    ('Paninis', [('Paninis', '')]),
    ('Soups & Salads', [('Soups & Salads', '')]),
    ('Coffee & Espresso', [('Beverages', 'Coffee Espresso'), ('Beverages', 'Coffee Specialties'), ('Beverages', 'Cococcinos')]),
    ('Smoothies', [('Beverages', 'Smoothies')]),
    ('Gelato & Sorbet', [('Beverages', 'Gelato + Sorbet')]),
    ('Tea, Lemonade & Cocoa', [('Beverages', 'Classic Favorites')]),
]
# names that appear twice on the menu get the section in their name, so every dish is unique in the app
RENAME = {('Paninis', n): n + ' Panini' for n in ['Roasted Pesto Chicken', 'Merguez Moroccan Sausage', 'Caprese', 'Mediterranean', 'Smoked Salmon']}
RENAME.update({('Build Your Own', 'Savory', 'Crêpe'): 'Build a Savory Crêpe', ('Build Your Own', 'Sweet', 'Crêpe'): 'Build a Sweet Crêpe',
               ('Build Your Own', 'Sweet', 'Waffle'): 'Build a Sweet Waffle'})
# the build-your-own lists (the site keeps them as separate "items" without photos)
BYO = {
    'Savory': 'Pick two: olives, eggs, spinach, greens, mushrooms, red onion capers, roasted veggies, tomatoes, almonds, onions, '
              'red peppers, five cheeses, pesto chicken, Merguez sausage, turkey, ham or smoked salmon. Then one sauce.',
    'Sweet': 'Pick two: Nutella, strawberries, Oreo, dulce de leche, cinnamon butter cream, peanut butter, chocolate chips, bananas, '
             'cinnamon apples, almonds, marshmallows, cheesecake, white chocolate mousse, crème brûlée, tres leches or lemon curd. '
             'Then one sauce.',
}

def clean(n):
    n = n.replace('’', "'").strip()
    flags = []
    if '*' in n: flags.append('contains nuts')
    if '†' in n: flags.append('protein enhanced')
    n = n.replace('*', '').replace('†', '').strip()
    extra = ''
    m = re.match(r'(.*?)\s*\|\s*(Spicy|Vegetarian)$', n)
    if m: n, extra = m.group(1).strip(), m.group(2).lower()
    return n, flags, extra

out, imgs = [], {}
for title, srcs in CATS:
    items = []
    for mname, sname in srcs:
        menu = next(m for m in menus if m['name'] == mname)
        for it in [i for s in L(menu['hasMenuSection']) if (s.get('name') or '') == sname for i in L(s.get('hasMenuItem', []))]:
            if not it.get('image'):
                continue   # the build-your-own ingredient lists
            n, flags, extra = clean(it['name'])
            n = RENAME.get((title, sname, n)) or RENAME.get((title, n)) or n
            d = (it.get('description') or '').strip()
            if d == 'None': d = ''
            if title == 'Build Your Own': d = BYO[sname] + ' ' + ('Original, whole wheat or gluten-free.')
            notes = [x for x in [extra] + flags if x]
            if notes: d = (d + (' · ' if d else '') + ', '.join(notes)).strip()
            key = 'img/%02d.bin' % len(imgs)
            imgs[key] = it['image']['url'].split('?')[0]
            items.append({'n': n, 'd': d, 'p': '', 'img': key})
    out.append({'cat': title, 'items': items})

json.dump(out, open(W + 'menu_raw.json', 'w'), ensure_ascii=False, indent=1)
data = {}
for k, u in imgs.items():
    raw = urllib.request.urlopen(urllib.request.Request(u + '?w=480&h=480&fit=crop&fm=jpg&q=72', headers=UA)).read()
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    b = io.BytesIO(); im.save(b, 'JPEG', quality=70, optimize=True, progressive=True)
    data[k] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
json.dump(data, open(W + 'img_data.json', 'w'))
print('menu ok:', sum(len(c['items']) for c in out), 'dishes,', len(data), 'photos')
