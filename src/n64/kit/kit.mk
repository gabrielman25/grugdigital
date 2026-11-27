# The Grug 64 kit: what every Grug Nintendo 64 game is built from. A game's Makefile is three lines and this:
#
#     ROM   = my-game-64            the ROM's file name (it is served as arcade/<its folder's name>/<ROM>.z64)
#     TITLE = MY GAME 64            its name inside the ROM (20 letters at most, capitals)
#     include ../kit/kit.mk
#
#   make            the ROM (needs libdragon and its toolchain: export N64_INST=/path/to/libdragon/install)
#   make install    the ROM, copied to where the Arcade serves it
#   make host       the same game for a PC, for testing: build/host/game-host OUTDIR [SLOT] plays the game's own script
#                   (host/main.c), writes pictures and sound, and checks what the script checks
#   make check      make host, then run it, then check the physics against the site's own
#   make cover      the Arcade's cover picture from the test's "cover" shot
#   make assets     (in any game: it re-bakes the kit's own) sounds.c / sounds.h from static/voice.js, static/sfx.js and
#                   the voice clips, font.h, and the ROM's default outfit (Grug, from arcade/outfits/grug.glb: needs node)
#
# The ROM file is padded to 1 MB and the outfit slot put after it (tools/mkslot.py): what you wear, which the Arcade's
# pages swap for the player's own outfit (static/outfit64.js). Read ../README.md before starting a game.
KIT := ../kit
GAME := $(notdir $(CURDIR))
BUILD_DIR = build
SITE = ../../../arcade/$(GAME)
KIT_CORE = phys.c render.c rast.c ui.c audio.c sounds.c outfit.c
HOSTCC ?= cc

ifneq ($(N64_INST),)
SOURCE_DIR = ..
include $(N64_INST)/include/n64.mk
N64_CFLAGS += -O2 -I$(KIT) -Wno-misleading-indentation -Wno-missing-field-initializers -Wno-unused-function
objs = $(BUILD_DIR)/$(GAME)/game.o $(BUILD_DIR)/kit/n64/main.o $(BUILD_DIR)/kit/n64/hw.o $(KIT_CORE:%.c=$(BUILD_DIR)/kit/%.o)

all: $(ROM).z64 slot
$(BUILD_DIR)/$(ROM).elf: $(objs)
# the boot stage: libdragon's, patched so the ROM also boots in the browser emulator (see ../boot/README.md)
N64_ROM_HEADER ?= ../boot/ipl3_dev_grug.z64
$(ROM).z64: N64_ROM_TITLE = "$(TITLE)"
$(ROM).z64: N64_ROM_REGIONFREE = true
slot: $(ROM).z64
	python3 $(KIT)/tools/mkslot.py $(ROM).z64 $(KIT)/assets/outfit-default.fit

install: all
	mkdir -p $(SITE) && cp $(ROM).z64 $(SITE)/$(ROM).z64
-include $(wildcard $(BUILD_DIR)/kit/*.d) $(wildcard $(BUILD_DIR)/kit/n64/*.d) $(wildcard $(BUILD_DIR)/$(GAME)/*.d)
else
all:
	@echo "Set N64_INST to your libdragon install to build the ROM (see ../README.md). 'make host' needs only a C compiler."
endif

host:
	mkdir -p $(BUILD_DIR)/host $(KIT)/build/host
	$(HOSTCC) -O2 -g -Wall -Wextra -Wno-misleading-indentation -Wno-unused-parameter -Wno-missing-field-initializers -Wno-unused-function -std=gnu11 -I$(KIT) -I$(KIT)/host -o $(BUILD_DIR)/host/game-host host/main.c game.c $(KIT_CORE:%=$(KIT)/%) -lm
	$(HOSTCC) -O2 -Wall -std=gnu11 -I$(KIT) -o $(KIT)/build/host/physdiff $(KIT)/host/physdiff.c $(KIT)/phys.c -lm

check: host
	mkdir -p $(BUILD_DIR)/shots
	./$(BUILD_DIR)/host/game-host $(BUILD_DIR)/shots $(KIT)/assets/outfit-default.fit
	node $(KIT)/tools/physdiff.cjs | tail -1

cover: check
	python3 $(KIT)/tools/mkcover.py $(BUILD_DIR)/shots/cover.ppm $(GAME)

assets:
	python3 $(KIT)/tools/mkaudio.py
	python3 $(KIT)/tools/mkfont.py /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf 9
	node $(KIT)/tools/mkoutfit.cjs

clean:
	rm -rf $(BUILD_DIR) $(ROM).z64

.PHONY: all host check cover assets clean install slot
