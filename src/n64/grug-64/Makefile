# Grug Baseplate 64: the Grug Baseplate as a Nintendo 64 ROM.
#
#   make            the ROM (needs libdragon and its toolchain: export N64_INST=/path/to/libdragon/install)
#   make install    the ROM, copied to where the Arcade serves it (arcade/grug-64/grug-baseplate-64.z64)
#   make host       the same game for a PC, for testing: build/host/grug64-host OUTDIR writes pictures and sound, and
#                   node tools/physdiff.cjs checks the physics against the site's own (arcade/baseplate/index.html)
#   make assets     re-bake sounds.c / sounds.h (from static/voice.js, static/sfx.js, the voice clips) and font.h
BUILD_DIR = build
ROM = grug-baseplate-64
SITE = ../../../arcade/grug-64
CORE = game.c phys.c render.c rast.c ui.c audio.c sounds.c
HOSTCC ?= cc

ifneq ($(N64_INST),)
include $(N64_INST)/include/n64.mk
N64_CFLAGS += -O2 -Wno-misleading-indentation -Wno-missing-field-initializers
src = n64/main.c n64/hw.c $(CORE)

all: $(ROM).z64
$(BUILD_DIR)/$(ROM).elf: $(src:%.c=$(BUILD_DIR)/%.o)
$(ROM).z64: N64_ROM_TITLE = "GRUG BASEPLATE 64"
$(ROM).z64: N64_ROM_REGIONFREE = true

install: $(ROM).z64
	mkdir -p $(SITE) && cp $(ROM).z64 $(SITE)/$(ROM).z64
-include $(wildcard $(BUILD_DIR)/*.d) $(wildcard $(BUILD_DIR)/n64/*.d)
else
all:
	@echo "Set N64_INST to your libdragon install to build the ROM (see README.md). 'make host' needs only a C compiler."
endif

host:
	mkdir -p $(BUILD_DIR)/host
	$(HOSTCC) -O2 -g -Wall -Wextra -Wno-misleading-indentation -Wno-unused-parameter -Wno-missing-field-initializers -std=gnu11 -o $(BUILD_DIR)/host/grug64-host host/main.c $(CORE) -lm
	$(HOSTCC) -O2 -Wall -std=gnu11 -o $(BUILD_DIR)/host/physdiff host/physdiff.c phys.c -lm

assets:
	python3 tools/mkaudio.py
	python3 tools/mkfont.py /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf 9

clean:
	rm -rf $(BUILD_DIR) $(ROM).z64

.PHONY: all host assets clean install
