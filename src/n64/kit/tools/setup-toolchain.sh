#!/usr/bin/env bash
# Set up what it takes to build a Grug 64 ROM: libdragon's MIPS toolchain and libdragon itself, at the version the
# games were last built with. No root needed: everything goes under one folder (default ~/n64).
#
#     bash src/n64/kit/tools/setup-toolchain.sh [FOLDER]
#     export N64_INST=FOLDER/toolchain/opt/libdragon        (it prints the exact line)
#
# It downloads about 105 MB from GitHub (the toolchain .deb from libdragon's releases, and libdragon's source).
# A Claude session asks the owner before running it: it downloads and builds code from outside the repo.
# `make check` (the tests) needs none of this: only a C compiler.
set -euo pipefail
DIR="${1:-$HOME/n64}"
LIBDRAGON_COMMIT=e356bf3        # the libdragon the games were last built with (kit/README.md); change both together
DEB_URL=https://github.com/DragonMinded/libdragon/releases/download/toolchain-continuous-prerelease/gcc-toolchain-mips64-amd64.deb
mkdir -p "$DIR/dl" "$DIR/toolchain"
export N64_INST="$DIR/toolchain/opt/libdragon"

if [ ! -x "$N64_INST/bin/mips64-elf-gcc" ]; then
  echo "== the MIPS toolchain (GCC for the console's CPU)"
  [ -s "$DIR/dl/toolchain.deb" ] || curl -fL --retry 3 -o "$DIR/dl/toolchain.deb" "$DEB_URL"
  dpkg-deb -x "$DIR/dl/toolchain.deb" "$DIR/toolchain"        # unpacked, not installed: no root
fi
"$N64_INST/bin/mips64-elf-gcc" --version | head -1

if [ ! -f "$N64_INST/mips64-elf/lib/libdragon.a" ]; then
  echo "== libdragon at $LIBDRAGON_COMMIT"
  [ -d "$DIR/libdragon/.git" ] || git clone -q https://github.com/DragonMinded/libdragon "$DIR/libdragon"
  git -C "$DIR/libdragon" fetch -q origin trunk || true
  git -C "$DIR/libdragon" checkout -q "$LIBDRAGON_COMMIT"
  make -C "$DIR/libdragon" -j"$(nproc)" install tools-install >/dev/null
fi
echo
echo "Ready. Before make install in a game's folder:"
echo "  export N64_INST=$N64_INST"
