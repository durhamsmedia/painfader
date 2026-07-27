---
name: enp1s0 static IP and boot order
description: enp1s0 has no persistent static IP — causes dnsmasq and painfader to fail at boot
---

## Problem
After every reboot:
- `enp1s0` comes up without an IP (only MAC, no inet)
- `dnsmasq` fails immediately: "unknown interface enp1s0"
- `painfader` pixel socket fails: EADDRNOTAVAIL on 2.0.0.10:6454
- All Gledopto devices are unreachable (no DHCP leases)
- Manual workaround: `ip addr add 2.0.0.10/24 dev enp1s0 && systemctl restart dnsmasq && systemctl restart painfader`

## Fix needed
1. Configure enp1s0 with a persistent static IP via `/etc/network/interfaces` or systemd-networkd:
   - IP: 2.0.0.10/24
   - No gateway (LED-device subnet only)
2. Ensure both `dnsmasq.service` and `painfader.service` start only after enp1s0 has its IP:
   - Add `After=sys-subsystem-net-devices-enp1s0.device Wants=sys-subsystem-net-devices-enp1s0.device`
   - Or rely on `network-online.target` once the static IP is configured persistently.

**Why:** enp1s0 is the LED-device subnet NIC. Without 2.0.0.10 assigned, dnsmasq can't serve DHCP → Gledopto devices never get IPs → nothing responds in the Painfader app.

**How to apply:** Tackle in the next build session before any other boot-reliability work.
