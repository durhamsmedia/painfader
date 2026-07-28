---
name: VideoController + mpv setup
description: How HDMI video playback works on Giada — mpv IPC, video states, DRM mode
---

## Rule
mpv is controlled via Unix socket (`/tmp/mpv-painfader.sock`) using JSON IPC.
Use `--vo=drm --drm-connector=HDMI-A-1` for bare-metal Giada (no display server needed).
Set `videoDisplay: "gpu"` in hardware-config if X11/Wayland is available.

## Video state machine
- `idle` → idle loop
- `start` → intro plays once → IPC `end-file` event → auto-transitions to `prompt_nsar`
- `prompt_nsar` → loop until lever moves
- `nsar` → lever −1
- `opiat` → lever +1
- `schmerz` → lever 0 during experience
- idle timer fires → back to `idle`

**Why:** mpv has no inherent state machine; VideoController tracks it in-process and
sends `loadfile` + `loop-file` commands over the socket.

## How to apply
- Video files live in `/home/painfader/videos/` (configurable via `videoDir` in HardwareConfig)
- Filenames: idle.mp4, start.mp4, prompt-nsar.mp4, nsar.mp4, opiat.mp4, schmerz.mp4
- `start.mp4` MUST NOT be set to loop — the `end-file` IPC event drives the → prompt_nsar transition
- If mpv crashes, VideoController auto-restarts it after 3 s
- IPC connection retries up to 10× with 500 ms intervals before giving up

## Install on Giada
```bash
sudo apt install mpv   # or: sudo nix-env -i mpv
```
