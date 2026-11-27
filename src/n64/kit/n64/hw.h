#ifndef GRUG64_HW_H
#define GRUG64_HW_H
#include <libdragon.h>
#include "../gfx.h"
bool hw_probe_rsp(void);
bool hw_probe_rdp(void);
void hw_init(void);
void hw_set_target(surface_t *s);
extern const GfxBackend gfx_hw;
#endif
