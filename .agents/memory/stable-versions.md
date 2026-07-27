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
- stable-2: d2ac66e — Haube Art-Net + Schmerz DDP voll, gledopto2 DDP unicast 2.0.0.157, socket retry on boot
- stable-1: 55d0523 — Haube Art-Net + Schmerz DDP (gledopto2 noch Art-Net broadcast, kann Schmerz stören)

**Why:** User explicitly demanded always-available one-command restore. Non-negotiable requirement.
