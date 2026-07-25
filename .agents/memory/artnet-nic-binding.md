---
name: Art-Net NIC binding
description: Why pixelSourceIp must be passed to socket.bind() on the Giada, not just used for logging
---

## Rule
`socket.bind(6454, pixelSourceIp, callback)` — always bind to the source IP, not just port 6454.

**Why:** The Giada AF208-N97 has two NICs:
- `enp1s0` — 2.0.0.10/24 — Gledopto network (Art-Net target)
- `enp2s0` — default-route NIC (internet/LAN)

When `socket.bind(6454)` is called without an address, Linux routes `255.255.255.255` broadcasts out via the default-route NIC (`enp2s0`). WLED on Gledopto (2.0.0.1 on `enp1s0`) never receives them. No LED response, no error — silent failure.

**Fix:** `socket.bind(6454, '2.0.0.10', callback)` forces the kernel to use `enp1s0` for all sends from this socket, including global broadcasts.

**How to apply:** `pixelSourceIp` in `HardwareConfig` is passed as the bind address for both Art-Net and E1.31. Never omit it on multi-NIC hosts. Confirmed working 2026-07-25.
