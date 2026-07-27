# Painfader — Stable Versions

Jede Version hier ist per **einem Befehl** auf dem Giada wiederherstellbar.

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
