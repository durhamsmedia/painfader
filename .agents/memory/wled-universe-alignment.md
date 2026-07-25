---
name: WLED Universe Alignment Problem
description: 84 pixels on GPIO12[0-83] (Matrix 2 / haube2) are consistently off due to Art-Net universe boundary mismatch. Documents what was tried and what to do Monday.
---

## The Problem

Gledopto #1 has two 256-LED matrices:
- GPIO16 (start=0, len=256) = haube1 / Matrix 1
- GPIO12 (start=256, len=256) = haube2 / Matrix 2

Art-Net universes hold 170 pixels (170×3=510 bytes). 256 is NOT a multiple of 170.
Universe 1 (combined[170-339]) spans BOTH GPIO16[170-255] (86px) AND GPIO12[0-83] (84px).

WLED does NOT correctly update GPIO12[0-83] from universe 1 data.
Result: GPIO12[0-83] = **84 pixels permanently off/black**.

## What Was Tried (all failed)

1. **Combined buffer** (haube1+haube2 as 512px, artnet): 84 pixels off on Matrix 2 start (GPIO12[0-83])
2. **GPIO12 start=340** (universe boundary alignment) + padded sends: 68 pixels off on Matrix 1 instead
3. **Independent sends** (artnet): 94 pixels off (haube2 universe offset wrong + short packets)
4. **DDP to broadcast 2.0.0.255**: No response — WLED DDP socket doesn't accept broadcast
5. **DDP with .255→.1 unicast substitution**: Both matrices went completely off (DDP may need explicit WLED enable or different packet format)

## What Happened to WLED Config

Multiple /json/cfg calls changed GPIO12 start: 256 → 340 → 256.
One call also inadvertently changed the Art-Net universe start, causing Gledopto #1 to respond to nsar/opiat universes instead of haube. Fixed by explicit cfg reset with `"if.live.dmx.uni": 0`.

## Current State (end of session)

- Protocol: artnet (combined buffer, haube1+haube2 as 512px)
- WLED GPIO12: start=256, len=256
- WLED uni: 0
- Result: 84 pixels off on Matrix 2 (GPIO12[0-83])

## Plan for Monday

**Option A — DDP via WLED web UI**:
1. On WLED web UI (http://2.0.0.1), go to Config → Sync → check "DDP" or similar
2. Then try DDP unicast from Painfader to 2.0.0.1:4048

**Option B — Test DDP manually from Giada**:
```bash
python3 -c "
import socket, struct
# Send DDP: 256 red pixels to GPIO16, 256 green pixels to GPIO12
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
# haube1: red, offset 0
d = bytes([255,0,0]*256)
pkt = struct.pack('>BBBBIH', 0x41, 1, 1, 1, 0, len(d)) + d
s.sendto(pkt, ('2.0.0.1', 4048))
# haube2: green, offset 768
d = bytes([0,255,0]*256)
pkt = struct.pack('>BBBBIH', 0x41, 2, 1, 1, 768, len(d)) + d
s.sendto(pkt, ('2.0.0.1', 4048))
print('sent')
"
```
If Matrix 1 = red and Matrix 2 = green → DDP works → enable in Painfader

**Option C — E1.31 with per-segment universe**:
WLED 0.15.x may support per-segment E1.31 universe via the web UI segment editor.
Each segment can have its own "start universe". Set:
- Segment 0 (GPIO16): E1.31 universe 1
- Segment 1 (GPIO12): E1.31 universe 3
Then Painfader sends haube1 to universes 1-2 and haube2 to universes 3-4.

**Option D — Change LED count to 170**:
If physical LED count allows it, change haube1PixelCount and haube2PixelCount to 170 each (skip 86 LEDs per matrix). Clean universe alignment, no overlap.

## WLED Config Reset Command (working)
```bash
curl -s -X POST http://2.0.0.1/json/cfg -H "Content-Type: application/json" -d '{
  "hw":{"led":{"ins":[
    {"pin":[16],"type":22,"len":256,"co":0,"skip":0,"rev":false,"start":0},
    {"pin":[12],"type":22,"len":256,"co":0,"skip":0,"rev":false,"start":256}
  ]}},
  "if":{"live":{"en":true,"timeout":2500,"maxbri":255,"no-gc":false,"offset":0,
    "dmx":{"uni":0,"seqskip":false,"addr":1,"mode":4}}}
}'
```
