#!/usr/bin/env python3
"""Embed Grug Digital's photo metadata (IPTC + XMP) in the site's promotional images, for Google Images and other sites.

    python3 src/seo/tag_images.py            # tag every image listed in src/seo/images.json
    python3 src/seo/tag_images.py --check    # list what each file carries now, change nothing

Google Images shows an image's Creator, Credit Line and Copyright Notice from embedded IPTC photo metadata, and reads the
title, description and keywords too (see src/seo/README.md). Only the images in images.json are tagged: game screenshots,
character renders, building renders and the logo. Textures, reference sheets, placeholders, sponsor and third-party images
are left alone on purpose. Needs exiftool (apt install libimage-exiftool-perl). Run it again after replacing an image.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://grugdigital.com'
CREATOR = 'Grug Digital'
CREDIT = 'Grug Digital (grugdigital.com)'
COPYRIGHT = '© 2026 Grug Digital. All rights reserved.'
TERMS = SITE + '/terms.html'
# every image carries these as well as its own keywords
KEYWORDS = ['Grug Digital', 'Grug', 'custom avatar', 'Roblox alternative', 'Roblox asset creator', 'free 3D game assets',
            'blocky', 'low poly']


def tags(path, meta):
    kw = list(dict.fromkeys(meta.get('keywords', []) + KEYWORDS))
    url = SITE + '/' + path
    t = ['-overwrite_original', '-P', '-m', '-sep', ';',
         # XMP (every format): Dublin Core, Photoshop, IPTC Core and rights
         f'-XMP-dc:Title={meta["title"]}', f'-XMP-dc:Description={meta["description"]}',
         f'-XMP-dc:Creator={CREATOR}', f'-XMP-dc:Rights={COPYRIGHT}', f'-XMP-dc:Subject={";".join(kw)}',
         f'-XMP-photoshop:Credit={CREDIT}', f'-XMP-photoshop:Headline={meta["title"]}', '-XMP-photoshop:Source=grugdigital.com',
         f'-XMP-xmpRights:WebStatement={TERMS}', '-XMP-xmpRights:Marked=True', f'-XMP-xmpRights:UsageTerms={COPYRIGHT}',
         f'-XMP-iptcCore:CreatorWorkURL={SITE}/', f'-XMP-plus:LicensorURL={TERMS}', f'-XMP-xmp:Identifier={url}']
    if path.lower().endswith(('.jpg', '.jpeg')):   # the older IPTC (IIM) block and EXIF, which some tools read first
        t += [f'-IPTC:ObjectName={meta["title"][:64]}', f'-IPTC:Caption-Abstract={meta["description"]}', f'-IPTC:By-line={CREATOR}',
              f'-IPTC:Credit={CREDIT}', f'-IPTC:CopyrightNotice={COPYRIGHT}', '-IPTC:Source=grugdigital.com',
              f'-IPTC:Keywords={";".join(k[:64] for k in kw)}', '-IPTC:CodedCharacterSet=UTF8',
              f'-EXIF:Artist={CREATOR}', f'-EXIF:Copyright={COPYRIGHT}', f'-EXIF:ImageDescription={meta["description"]}']
    return t


def main():
    manifest = json.load(open(os.path.join(ROOT, 'src/seo/images.json'), encoding='utf-8'))
    items = [(p, m) for p, m in manifest.items() if not p.startswith('_')]
    check = '--check' in sys.argv
    missing = [p for p, _ in items if not os.path.exists(os.path.join(ROOT, p))]
    if missing:
        sys.exit('missing files (fix images.json): ' + ', '.join(missing))
    for p, m in items:
        f = os.path.join(ROOT, p)
        if check:
            out = subprocess.run(['exiftool', '-s', '-XMP-dc:Title', '-XMP-dc:Creator', '-XMP-photoshop:Credit', '-XMP-dc:Rights', f],
                                 capture_output=True, text=True).stdout.strip().replace('\n', ' | ')
            print(f'{p}: {out or "(no metadata)"}')
            continue
        before = os.path.getsize(f)
        r = subprocess.run(['exiftool'] + tags(p, m) + [f], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f'{p}: {r.stderr.strip()}')
        print(f'{p}: tagged ({before} -> {os.path.getsize(f)} bytes)')


if __name__ == '__main__':
    main()
