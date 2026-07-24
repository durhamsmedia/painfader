---
name: Gledopto WLED Setup
description: GL-C-618WL Ethernet/Art-Net Konfiguration für Painfader
---

## Gledopto GL-C-618WL (WLED-Controller)

**Firmware:** WLED 0.15.4 (ESP32_Ethernet) — 0.15.3 hatte Ethernet-Bug für Gledopto, 0.15.4 ist der Fix

**WLED 0.15.3 → 0.15.4 OTA:** Funktioniert direkt. 0.15.3 → 16.x schlägt fehl wegen geänderter Partition-Tabelle.

**Ethernet-Aktivierung in WLED:**
- Config → WiFi Setup → Ethernet Type: **"Gledopto"** (Wert 13)
- Static IP: `2.0.0.1`, Subnet: `255.255.255.0`, Gateway: `0.0.0.0`
- **WLED ignoriert die statische IP und macht DHCP** — Static IP-Feld in WLED WiFi Setup hat keinen Effekt für Ethernet

**Lösung: dnsmasq DHCP-Server auf Giada:**
- Gledopto MAC: `70:4b:ca:5b:c5:ab`
- Config: `/etc/dnsmasq.d/painfader.conf`
  ```
  interface=enp1s0
  bind-interfaces
  dhcp-range=2.0.0.100,2.0.0.200,255.255.255.0,12h
  dhcp-host=70:4b:ca:5b:c5:ab,2.0.0.1
  ```
- `systemctl start dnsmasq` → Gledopto bekommt 2.0.0.1 via DHCP

**dnsmasq persistent machen:** Nach Reboot des Giada muss dnsmasq laufen (`systemctl enable dnsmasq`)

**Art-Net in WLED (Sync-Einstellungen):**
- Network DMX Input: Art-Net
- Universe: 0
- Multicast: Nein
- DMX Start Address: 1
- DMX Mode: Multiple RGB
- Disable realtime gamma: Ja

**LED Output:**
- Output 1 → GPIO 16 (physisches Klemmbrett CH1 am Gledopto)
- WLED Config → LED Preferences: WS2812b, GPIO 16, korrekte LED-Anzahl setzen
- Painfader sendet Universe 0 (Haube 512px) und folgende Universes für Schmerz-Band

**TODO morgen:**
- WLED LED Preferences konfigurieren (GPIO16, LED-Typ, Anzahl)
- LED-Matrix physisch an Output 1 / CH1 anschließen
- Zweiten Gledopto (#2, 2.0.0.2) konfigurieren — dessen MAC noch unbekannt
- `systemctl enable dnsmasq` für Persistenz nach Reboot
