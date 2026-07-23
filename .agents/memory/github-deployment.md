---
name: GitHub repo and deployment network
description: GitHub remote URL and Giada network topology for the Painfader installation
---

## GitHub repo
- URL: https://github.com/durhamsmedia-netizen/painfader.git
- Remote `origin` configured and pushed

## Giada AF208-N97 network topology (no switch)
- eth0 → Gledopto #1, Giada static `2.0.0.10/24`, Gledopto IP `2.0.0.1`
- eth1 → Gledopto #2, Giada static `2.0.1.10/24`, Gledopto IP `2.0.1.1`
- No gateway on either port — fully offline, point-to-point Art-Net only
- Hardware config `gledopto2.host` must be set to `2.0.1.1` (default in code is `2.0.0.2`)

**Why:** No network switch available on site; two NICs serve as isolated Art-Net links.
**How to apply:** When writing /etc/network/interfaces or any deployment docs, use this topology.
