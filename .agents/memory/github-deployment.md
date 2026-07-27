---
name: GitHub repo and deployment network
description: GitHub remote URL and Giada network topology for the Painfader installation
---

## GitHub repo
- URL: https://github.com/durhamsmedia-netizen/painfader.git
- Remote `origin` configured and pushed

## Giada AF208-N97 network topology (updated: Netgear switch on LAN1)
- enp1s0 (LAN1) → Netgear switch → 2.0.0.0/24 subnet via dnsmasq on Giada
  - Giada: 2.0.0.10
  - Gledopto GL-C-618WL #1 (Haube): 2.0.0.1, MAC 70:4b:ca:5b:c5:ab
  - Gledopto Elite 2D (Schmerz): 2.0.0.158, MAC 1c:c3:ab:a0:aa:a7
  - Netgear WNR2000v5 switch: 2.0.0.146
- enp2s0 (LAN2) → upstream network (10.21.101.x)
- Gledopto #2 (NSAR/Opiat): not yet connected physically

**Why:** Switch added to allow multiple Gledopto devices on same subnet.
**How to apply:** All Art-Net/DDP targets are in 2.0.0.0/24. Elite 2D uses DDP (not Art-Net).
