---
name: MKS Motor restore workflow
description: How to restore MKS motor patches to Giada since git push fails
---

## Situation
GitHub push fails (no token configured). All MKS motor code changes exist in:
- Replit workspace (committed, correct)
- Giada `/opt/painfader` (directly patched source files)

The Giada's source is NOT in sync with GitHub, so `git pull` won't restore motor code.

## Restore command (run on Giada)
```bash
python3 /opt/painfader/scripts/restore-giada-motor.py
```

If the script file is missing (e.g. after a git reset):
```bash
python3 << 'PYEOF'
import subprocess, os
BASE = "/opt/painfader"
hw = open(f"{BASE}/artifacts/api-server/src/lib/hardware-config.ts").read()
hw = hw.replace("motorUpPosition: 3000number", "motorUpPosition: number")
hw = hw.replace("motorDownPosition: 3000number", "motorDownPosition: number")
hw = hw.replace("motorMaxSpeed: 200number", "motorMaxSpeed: number")
open(f"{BASE}/artifacts/api-server/src/lib/hardware-config.ts","w").write(hw)
r = subprocess.run(["pnpm","--filter","@workspace/api-server","run","build"], cwd=BASE, capture_output=True, text=True)
if r.returncode == 0:
    subprocess.run(["systemctl","restart","painfader"])
    print("OK — check: journalctl -u painfader -n 3 | grep -i motor")
else:
    print("FAILED:", r.stderr[-300:])
PYEOF
```

## Key files patched directly on Giada (not via git)
- `artifacts/api-server/src/lib/hardware-config.ts` — motorDriverType:"mks", motorPort:"/dev/ttyACM0", upPosition/downPosition:3000ms, maxSpeed:200RPM
- `artifacts/api-server/src/lib/stepper-motor.ts` — full MKS UART implementation (0xF3/0xF6/0xF7 protocol, XOR CRC, 38400 baud)
- `artifacts/api-server/src/lib/dmx.ts` — updateHardwareConfig() reinitializes StepperMotorController when motor fields change
- `artifacts/painfader/src/pages/Dashboard.tsx` — MKS option added to driver dropdown

## What works (confirmed 2026-07-27)
- MKS connects on `/dev/ttyACM0` (UTS-T01, CH341 VID=1a86 PID=55d3)
- Log: `"MKS Servo57C stepper motor connected"`
- Commands sent: CW (UP, 3000ms), CCW (DOWN, 3000ms), STOP
- Motor still needs physical calibration (upPosition/downPosition ms values)

**Why:** GitHub push auth fails in Replit; direct source patching is the only deploy path.
**How to apply:** Run restore script above; or copy from Replit and SCP to Giada.
