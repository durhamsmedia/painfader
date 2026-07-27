---
name: Stable versions policy
description: How stable/restorable versions are tracked for this project
---

## Policy
User wants per-button-press restorable versions at all times.
After any confirmed-working state, add an entry to STABLE_VERSIONS.md (in repo root) and commit+push.

## Trigger
User says: "Das funktioniert — als stable-N speichern" → immediately add commit hash + description to STABLE_VERSIONS.md and push.

## Restore command (run on Giada)
```bash
cd /opt/painfader && git fetch && git checkout <commit> && pnpm install && pnpm build && systemctl restart painfader
```

## Current stable entries
- "Schmerzband Haube NSAR Band OPIAT BAND Funktionieren 270726": 4245a83 — alle 4 Bänder OK, NSAR 240px GPIO16, Opiat 125px IO2
- "27.07. SCHMERZBAND UND HAUBEN": bd86f17 — Haube + Schmerz DDP voll, socket retry on boot
- stable-1: 55d0523 — Haube Art-Net + Schmerz DDP (gledopto2 noch Art-Net broadcast)

**Why:** User explicitly demanded always-available one-command restore. Non-negotiable requirement.
