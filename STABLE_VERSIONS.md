# Painfader — Stable Versions

Jede Version hier ist per **einem Befehl** auf dem Giada wiederherstellbar.

---

## ✅ Alle LEDs DDP + Motor MKS + Ventilator — `8db5f0d` (2026-07-28)

**Status:** Haube DDP ✅ · Schmerz DDP ✅ · NSAR DDP ✅ · Opiat DDP ✅ · Ventilator ✅ · Motor MKS verbunden ✅

**Controller (alle DDP, WLED 16.0.1, statische IPs):**
- Haube (2×256px) → 2.0.0.156, DDP
- Schmerz (5×256px) → 2.0.0.158, DDP
- NSAR (240px) + Opiat (125px) → 2.0.0.157, DDP

**Restore:**
```bash
python3 /opt/painfader/scripts/restore-giada-motor.py
```

---

## ✅ Alle LEDs Art-Net + Motor MKS + Ventilator — `44f1164` (2026-07-28)

**Status:** Haube Art-Net ✅ · Schmerz Art-Net ✅ · NSAR Art-Net ✅ · Opiat Art-Net ✅ · Ventilator ✅ · Motor MKS verbunden ✅

**Controller (alle Art-Net, WLED 16.0.1):**
- Haube (2×256px) → 2.0.0.156, Universe 0–3
- Schmerz (5×256px) → 2.0.0.158, Universe 0–7
- NSAR (240px) + Opiat (125px) → 2.0.0.157, Universe 0–2

**Motor:** MKS Servo57CPCBA auf `/dev/ttyACM0`, 38400 baud — Encoder „Magnet Loss" noch zu lösen (Hardware).

**Restore:**
```bash
python3 /opt/painfader/scripts/restore-giada-motor.py
```

---

## ✅ MKS Motor + alle LEDs + Ventilator — `ca09264` (2026-07-27)

**Status:** Haube Art-Net ✅ · Schmerz DDP ✅ · NSAR 240 LEDs ✅ · Opiat 125 LEDs ✅ · Ventilator DMX CH1 ✅ · **Motor MKS UART ✅**

**Was funktioniert:**
- MKS Servo57CPCBA über UTS-T01 auf `/dev/ttyACM0` verbunden
- Protokoll: 38400 baud, UART (0xF3 enable / 0xF6 run / 0xF7 stop, XOR-CRC)
- `motorUpPosition` / `motorDownPosition` = Zeit in ms (CW / CCW)
- `motorMaxSpeed` = RPM (0–3000)
- Dashboard-Änderungen an Motor-Config werden live übernommen (Motor neu initialisiert)

**Defaults:** UP=3000 ms · DOWN=3000 ms · Speed=200 RPM — noch zu kalibrieren!

**Bekanntes Problem:** dnsmasq + enp1s0 IP nicht persistent → nach Reboot:
```bash
ip addr add 2.0.0.10/24 dev enp1s0 && systemctl restart dnsmasq
```

**⚠️ Hinweis:** GitHub-Push schlägt fehl (kein Token). Diese Version lebt nur im  
Replit-Workspace und als direkt gepatchter Quellcode auf dem Giada.  
Restore über das Python-Skript unten.

### Restore-Befehl

```bash
python3 /opt/painfader/scripts/restore-giada-motor.py
```

> Schreibt `hardware-config.ts`, `stepper-motor.ts`, patcht `dmx.ts` + `Dashboard.tsx`, baut neu und startet den Dienst.  
> Prüfen mit: `journalctl -u painfader -n 5 | grep -i motor`

---

## ✅ Haube + NSAR + Schmerz + Opiat + Ventilator — `5833739` (2026-07-27)
**Status:** Haube Art-Net ✅ · Schmerz DDP ✅ · NSAR 240 LEDs ✅ · Opiat 125 LEDs ✅ · Ventilator DMX CH1 ✅  
**Beschreibung:** Alle vier LED-Bänder + Ventilator über Enttec OpenDMX USB bestätigt funktionierend.  
**Bekanntes Problem:** dnsmasq + enp1s0 IP nicht persistent — nach Reboot ggf. `ip addr add 2.0.0.10/24 dev enp1s0 && systemctl restart dnsmasq` nötig.

```bash
cd /opt/painfader && git fetch && git checkout 5833739 && pnpm install && pnpm build && systemctl restart painfader
```

---

## ✅ Schmerzband Haube NSAR Band OPIAT BAND Funktionieren 270726 — `4245a83` (2026-07-27)
**Status:** Haube Art-Net ✅ · Schmerz DDP voll ✅ · NSAR 240 LEDs ✅ · Opiat 125 LEDs ✅  
**Beschreibung:** Alle vier Bänder bestätigt funktionierend. NSAR GPIO16, Opiat IO2, korrekte DDP Byte-Offsets.

```bash
cd /opt/painfader && git fetch && git checkout 4245a83 && pnpm install && pnpm build && systemctl restart painfader
```

---

## ✅ 27.07. SCHMERZBAND UND HAUBEN — `bd86f17` (2026-07-27)
**Status:** Haube Art-Net ✅ · Schmerz DDP voll ✅ · Socket-Retry bei Boot ✅  
**Beschreibung:** Bestätigter Stabilitätspunkt. gledopto2 DDP-Unicast zu 2.0.0.157 — kein Art-Net-Broadcast der Schmerz stört.

```bash
cd /opt/painfader && git fetch && git checkout bd86f17 && pnpm install && pnpm build && systemctl restart painfader
```

---

## ✅ stable-2 — `d2ac66e` (2026-07-27)
**Status:** Haube Art-Net ✅ · Schmerz DDP voll ✅ · NSAR/Opiat DDP (Pixelzahl noch offen)  
**Änderung:** gledopto2 als DDP-Unicast zu 2.0.0.157 — kein Art-Net-Broadcast mehr der Schmerz stört. Socket-Retry bei Boot.

```bash
cd /opt/painfader && git fetch && git checkout d2ac66e && pnpm install && pnpm build && systemctl restart painfader
```

---

## ✅ stable-1 — `55d0523` (2026-07-27, früh)
**Status:** Haube Art-Net ✅ · Schmerz DDP ✅ (wenn kein gledopto2-Broadcast aktiv)  
**Hinweis:** gledopto2 sendet noch Art-Net-Broadcasts → kann Schmerz stören wenn WLED auf 2.0.0.158 Art-Net empfängt

```bash
cd /opt/painfader && git fetch && git checkout 55d0523 && pnpm install && pnpm build && systemctl restart painfader
```

---

## Neue stabile Version nach Abnahme sichern

Nach dem Testen und Bestätigen dass alles funktioniert, bitte sagen:
> **"Das funktioniert — als stable-N speichern"**

Dann trage ich den aktuellen Commit sofort hier ein.
