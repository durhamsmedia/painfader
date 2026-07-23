import { Router } from "express";
import { dmxController } from "../lib/dmx";
import { logger } from "../lib/logger";

const router = Router();

const VALID_POSITIONS = [-1, 0, 1];
const VALID_ZONES = ["haube", "schmerz", "nsar", "opiat"] as const;

// ── State / config ────────────────────────────────────────────────────────────

router.get("/dmx/state", (_req, res) => { res.json(dmxController.getState()); });

router.get("/dmx/hardware-config", (_req, res) => { res.json(dmxController.getHardwareConfig()); });
router.put("/dmx/hardware-config", (req, res) => {
  const config = dmxController.updateHardwareConfig(req.body);
  logger.info("Hardware config updated");
  res.json(config);
});

// ── Mode ──────────────────────────────────────────────────────────────────────

router.put("/dmx/mode", (req, res) => {
  const { mode } = req.body as { mode: "idle" | "experience" };
  if (mode !== "idle" && mode !== "experience") {
    res.status(400).json({ error: "mode must be 'idle' or 'experience'" }); return;
  }
  res.json(dmxController.setMode(mode));
});

// ── Fan ───────────────────────────────────────────────────────────────────────

router.put("/dmx/fan", (req, res) => {
  const { speed, enabled } = req.body as { speed?: number; enabled?: boolean };
  res.json(dmxController.setFan({ speed, enabled }));
});

// ── Pixel zones ───────────────────────────────────────────────────────────────

/**
 * PUT /dmx/zone/:name  — update one LED zone's pattern
 * name: haube | schmerz | nsar | opiat
 * body: Partial<ZonePattern>
 */
router.put("/dmx/zone/:name", (req, res) => {
  const { name } = req.params;
  if (!VALID_ZONES.includes(name as any)) {
    res.status(400).json({ error: `zone must be one of: ${VALID_ZONES.join(", ")}` }); return;
  }
  const state = dmxController.setZone(name as typeof VALID_ZONES[number], req.body);
  logger.debug({ zone: name }, "Zone pattern updated");
  res.json(state);
});

// ── Motor ─────────────────────────────────────────────────────────────────────

router.put("/dmx/motor", (req, res) => {
  const { position, speed, enabled } = req.body as {
    position?: "up" | "down" | "stop"; speed?: number; enabled?: boolean;
  };
  const state = dmxController.setMotor({ position, speed, enabled });
  logger.info({ position, speed, enabled }, "Motor command");
  res.json(state);
});

// ── Screen ────────────────────────────────────────────────────────────────────

router.get("/dmx/screen", (_req, res) => { res.json(dmxController.getState().screen); });

router.put("/dmx/screen", (req, res) => {
  const { videoFile, enabled, loop } = req.body as { videoFile?: string; enabled?: boolean; loop?: boolean };
  res.json(dmxController.setScreen({ videoFile, enabled, loop }));
});

// ── Fader / scene ─────────────────────────────────────────────────────────────

router.put("/dmx/pain-fader", (req, res) => {
  const { position } = req.body as { position: number };
  if (position === undefined || !VALID_POSITIONS.includes(Math.round(position))) {
    res.status(400).json({ error: "position must be -1, 0, or 1" }); return;
  }
  res.json(dmxController.hardwareFaderInput(position as -1 | 0 | 1));
});

router.put("/dmx/scene", (req, res) => {
  const { scene } = req.body as { scene: string };
  const valid = ["idle", "schmerz", "opiat", "nsar", "blackout"];
  if (!valid.includes(scene)) { res.status(400).json({ error: "Invalid scene" }); return; }
  const state = dmxController.loadScene(scene as any);
  logger.info({ scene }, "Scene loaded");
  res.json(state);
});

router.post("/dmx/blackout", (_req, res) => {
  logger.info("Blackout triggered");
  res.json(dmxController.blackout());
});

/**
 * POST /dmx/hardware-fader  — called by GPIO daemon / external MCU.
 * The GpioReader now calls hardwareFaderInput() directly; this endpoint
 * remains for manual testing and external integration.
 */
router.post("/dmx/hardware-fader", (req, res) => {
  const { position } = req.body as { position: number };
  if (position === undefined || !VALID_POSITIONS.includes(Math.round(position))) {
    res.status(400).json({ error: "position must be -1, 0, or 1" }); return;
  }
  res.json(dmxController.hardwareFaderInput(position as -1 | 0 | 1));
});

// ── Presets ───────────────────────────────────────────────────────────────────

router.get("/dmx/presets", (_req, res) => { res.json(dmxController.getPresets()); });

router.put("/dmx/presets/:position", (req, res) => {
  const { position } = req.params;
  if (!["-1", "0", "1", "idle"].includes(position)) {
    res.status(400).json({ error: "position must be -1, 0, 1, or idle" }); return;
  }
  const presets = dmxController.updatePreset(position, req.body);
  logger.info({ position }, "Preset updated");
  res.json(presets);
});

router.post("/dmx/presets/:position/capture", (req, res) => {
  const { position } = req.params;
  if (!["-1", "0", "1", "idle"].includes(position)) {
    res.status(400).json({ error: "position must be -1, 0, 1, or idle" }); return;
  }
  const presets = dmxController.capturePreset(position);
  logger.info({ position }, "Preset captured");
  res.json(presets);
});

router.put("/dmx/preset-timer", (req, res) => {
  const { timerSeconds, enabled } = req.body as { timerSeconds?: number; enabled?: boolean };
  const presets = dmxController.updatePresetTimer(timerSeconds, enabled);
  logger.info({ timerSeconds, enabled }, "Preset timer config updated");
  res.json(presets);
});

// ── Apply preset position ─────────────────────────────────────────────────────

router.post("/dmx/presets/:position/apply", (req, res) => {
  const { position } = req.params;
  if (!["-1", "0", "1", "idle"].includes(position)) {
    res.status(400).json({ error: "position must be -1, 0, 1, or idle" }); return;
  }
  const pos = position === "idle" ? null : (parseInt(position, 10) as -1 | 0 | 1);
  const state = pos === null
    ? dmxController.setMode("idle")
    : dmxController.hardwareFaderInput(pos);
  res.json(state);
});

export default router;
