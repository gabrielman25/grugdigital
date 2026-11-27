# The boot stage Grug's Nintendo 64 ROMs use (`src/n64/boot/`)

Every N64 ROM starts with a small boot program (IPL3) that wakes the memory chips up and loads the game. libdragon
ships an open one (public domain). Grug's ROMs use **libdragon's development build of it with one small patch**:
`ipl3_dev_grug.z64`. Each game's Makefile passes it to the ROM tool (`N64_ROM_HEADER`).

## Why it is patched

Without the patch a libdragon ROM does not boot in the browser emulator the Arcade uses (EmulatorJS's
mupen64plus-next core): the page logged `couldn't allocate memory for cached interpreter` and stayed black. The same
happens to libdragon's own example ROMs.

The boot program numbers the memory chips one at a time. It first parks them all at device ID 511, then gives the first
one that answers ID 0, the next ID 2, and so on. That emulator core decodes a stored device ID from the wrong byte for
IDs of 64 and above, so after the chips are parked at 511 it never finds one again: the boot program counts **zero
chips** and jumps into memory that isn't there. (Newer versions of the core fixed this; the web build predates it.)

`grug-ipl3.patch` changes `boot/rdram.c` in two places, both of which only matter on that emulator:

1. If the stock procedure finds **zero** chips (a real console always has at least two), it runs once more with
   parking IDs under 64 (62 and 60), which the emulator and the hardware decode alike.
2. In that second pass only, a current calibration that comes out as zero is accepted. The calibration expects memory
   to misbehave at the lowest drive current; the emulator's memory is perfect at every setting.

**On a real console the first pass succeeds, so the sequence is exactly libdragon's.** The first 4 KB of the file (the
part a console's lockout chip checks) is byte-for-byte libdragon's `ipl3_dev.z64`.

It is the *development* build because that one can be rebuilt without re-signing: it starts with a small trampoline
libdragon already signed. The production build would have to be signed again (hours of GPU work) after any change. The
development build is a few KB bigger and logs its progress (`IS64:` lines in an emulator's debug log), which is how this
was found.

## Rebuilding it

```sh
git clone https://github.com/DragonMinded/libdragon && cd libdragon     # made against trunk at e356bf3
git apply /path/to/grugdigital/src/n64/boot/grug-ipl3.patch
export N64_INST=/path/to/libdragon/install
make -C boot                                                            # writes boot/bin/ipl3_dev.z64
cmp -n 4096 boot/bin/ipl3_dev.z64 <(git show HEAD:boot/bin/ipl3_dev.z64)  # the signed part must not have changed
cp boot/bin/ipl3_dev.z64 /path/to/grugdigital/src/n64/boot/ipl3_dev_grug.z64
```

Not tested on a real console (see `src/n64/grug-64/README.md`). If a console ever fails to boot a Grug ROM, build once
with libdragon's own boot stage (`make N64_ROM_HEADER=`) to tell the two apart.
