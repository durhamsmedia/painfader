# Painfader — Stable Versions

Jede Version hier ist per **einem Befehl** auf dem Giada wiederherstellbar.

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
