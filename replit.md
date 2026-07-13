# Painfader DMX Controller

A web-based DMX control surface for operating the Painfader interactive installation — fan, LED matrix, LED strips, disc drive, pain fader, and Art-Net output, all in one dark-mode pro panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: none (no database needed — state is in-memory)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS v4 + shadcn/ui at `/`
- API: Express 5 at `/api`
- DMX output: Art-Net (ArtDMX) via Node.js UDP `dgram`
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `artifacts/api-server/src/lib/dmx.ts` — DMX state manager + Art-Net UDP sender
- `artifacts/api-server/src/routes/dmx.ts` — all DMX REST routes
- `artifacts/painfader/src/` — React frontend

## Architecture decisions

- DMX state lives entirely in memory on the server (`dmxController` singleton). No database needed — the controller is always on and state is authoritative while the server runs.
- Art-Net output uses raw UDP via Node.js `dgram`, sending ArtDMX packets on a configurable refresh timer (default 44Hz). Broadcast to `255.255.255.255:6454` by default so any Art-Net node on the LAN receives it.
- Frontend polls `/api/dmx/state` every 500ms to stay in sync with hardware state.
- Pain fader maps 5 physical positions (0–4) to DMX values 0, 64, 127, 191, 255.
- Disc direction maps: stop=0, CW=128, CCW=255.

## DMX Channel Map (default)

| CH | Component | Parameter |
|----|-----------|-----------|
| 1 | Fan | Speed |
| 3 | LED Matrix | Red |
| 4 | LED Matrix | Green |
| 5 | LED Matrix | Blue |
| 6 | LED Matrix | Brightness |
| 7 | LED Matrix | Pattern |
| 8 | LED Strip 1 | Red |
| 9 | LED Strip 1 | Green |
| 10 | LED Strip 1 | Blue |
| 11 | LED Strip 1 | Brightness |
| 12 | LED Strip 2 | Red |
| 13 | LED Strip 2 | Green |
| 14 | LED Strip 2 | Blue |
| 15 | LED Strip 2 | Brightness |
| 16 | Disc | Speed |
| 17 | Disc | Direction |
| 18 | Pain Fader | Position |

## Product

Single-page DMX control surface with:
- IDLE / EXPERIENCE mode toggle
- Scene presets (warmup, low/mid/high experience, blackout)
- Pain fader with 5 stepped positions
- Fan speed + enable
- LED matrix (RGB, brightness, pattern)
- Dual LED strips with sync option
- Disc drive (speed, CW/CCW/stop, enable)
- Art-Net config (host IP, universe, port, refresh rate)
- Live DMX channel monitor (channels 1–64)
- BLACKOUT emergency button

## Gotchas

- Art-Net uses UDP — no connection confirmation. The TX ACTIVE indicator turns green when packets are sent successfully.
- Default broadcast to `255.255.255.255` works on a LAN; for specific Art-Net nodes, change the host IP in the Art-Net Config panel.
- No database; restart clears all state back to defaults.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
