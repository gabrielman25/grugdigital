#!/usr/bin/env python3
"""Put the outfit slot into a Grug 64 ROM: pad the file to 1 MB and write the 128 KB slot there (outfit.h has the layout).

    python3 tools/mkslot.py ROM.z64 SLOT.fit

Run by `make` after the ROM is linked; running it again just writes the slot again. The ROM reads the slot from this fixed
place when it starts, and static/outfit64.js writes a player's outfit to the same place."""
import sys
OFFSET, SIZE = 0x100000, 0x20000
rom_path, slot_path = sys.argv[1], sys.argv[2]
rom, slot = bytearray(open(rom_path, 'rb').read()), open(slot_path, 'rb').read()
if len(slot) != SIZE or slot[:8] != b'GRUGFIT1': sys.exit(f'{slot_path}: not an outfit slot (make assets builds it)')
if len(rom) >= OFFSET + SIZE and rom[OFFSET:OFFSET + 8] == b'GRUGFIT1': rom = rom[:OFFSET]   # already there: write it again
elif len(rom) > OFFSET: sys.exit(f'{rom_path}: the program is {len(rom)} bytes, past the slot at {OFFSET}: move SLOT_ROM_OFFSET (outfit.h, outfit64.js, here)')
rom += b'\xff' * (OFFSET - len(rom)) + slot
open(rom_path, 'wb').write(rom)
print(f'{rom_path}: outfit slot at {OFFSET:#x}, {len(rom)} bytes in all')
