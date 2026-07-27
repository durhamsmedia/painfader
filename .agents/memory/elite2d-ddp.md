---
name: Gledopto Elite 2D — DDP only
description: Elite 2D (2.0.0.158, WLED 0.15.3) does not support Art-Net (port 6454 unreachable), uses DDP on port 4048.
---

# Gledopto Elite 2D — Protocol

**Device:** Gledopto Elite 2D, IP 2.0.0.158 (DHCP via dnsmasq), MAC 1c:c3:ab:a0:aa:a7, WLED 0.15.3

**Result:** Art-Net (port 6454) returns ICMP unreachable — not compiled in firmware. E1.31 (port 5568) also did not trigger live mode. DDP (port 4048) works reliably.

**Rule:** schmerzController must use `protocol: "ddp"` in hardware config. The GledoptoConfig interface now has an optional `protocol` field; when set, it overrides the global `pixelProtocol` for that device in `sendPixelBuffer`.

**Why:** Gledopto ships custom WLED builds. Elite 2D firmware omits Art-Net. DDP is byte-offset-based so no universe alignment issues.

**How to apply:** Any new Gledopto device that doesn't respond to Art-Net — check port 6454 with tcpdump, if ICMP unreachable try DDP on 4048. Set `protocol: "ddp"` in the device config block.

**LED config:** IO2 (pin [2]) configured as the only WLED output, len=1280 (5×256 WS2812B). Universe mapping irrelevant for DDP.
