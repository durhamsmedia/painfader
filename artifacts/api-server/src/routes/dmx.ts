import { Router } from "express";
import { dmxController } from "../lib/dmx";
import { logger } from "../lib/logger";

const router = Router();

router.get("/dmx/state", (_req, res) => {
  res.json(dmxController.getState());
});

router.get("/dmx/config", (_req, res) => {
  res.json(dmxController.getConfig());
});

router.put("/dmx/config", (req, res) => {
  const { host, universe, port, refreshRate } = req.body as {
    host?: string;
    universe?: number;
    port?: number;
    refreshRate?: number;
  };
  const config = dmxController.updateConfig({ host, universe, port, refreshRate });
  logger.info({ config }, "DMX config updated");
  res.json(config);
});

router.put("/dmx/mode", (req, res) => {
  const { mode } = req.body as { mode: "idle" | "experience" };
  if (mode !== "idle" && mode !== "experience") {
    res.status(400).json({ error: "mode must be 'idle' or 'experience'" });
    return;
  }
  const state = dmxController.setMode(mode);
  logger.info({ mode }, "Mode changed");
  res.json(state);
});

router.put("/dmx/fan", (req, res) => {
  const { speed, enabled } = req.body as { speed?: number; enabled?: boolean };
  const state = dmxController.setFan({ speed, enabled });
  res.json(state);
});

router.put("/dmx/led-matrix", (req, res) => {
  const { r, g, b, brightness, pattern, enabled } = req.body as {
    r?: number; g?: number; b?: number; brightness?: number; pattern?: number; enabled?: boolean;
  };
  const state = dmxController.setLedMatrix({ r, g, b, brightness, pattern, enabled });
  res.json(state);
});

router.put("/dmx/led-strips", (req, res) => {
  const { strip1, strip2, sync } = req.body as {
    strip1?: { r?: number; g?: number; b?: number; brightness?: number; enabled?: boolean };
    strip2?: { r?: number; g?: number; b?: number; brightness?: number; enabled?: boolean };
    sync?: boolean;
  };
  const state = dmxController.setLedStrips({ strip1, strip2, sync });
  res.json(state);
});

router.put("/dmx/disc", (req, res) => {
  const { speed, direction, enabled } = req.body as {
    speed?: number; direction?: "cw" | "ccw" | "stop"; enabled?: boolean;
  };
  const state = dmxController.setDisc({ speed, direction, enabled });
  res.json(state);
});

router.put("/dmx/pain-fader", (req, res) => {
  const { position } = req.body as { position: number };
  if (position === undefined || position < 0 || position > 4) {
    res.status(400).json({ error: "position must be 0-4" });
    return;
  }
  const state = dmxController.setPainFader(position);
  res.json(state);
});

router.put("/dmx/scene", (req, res) => {
  const { scene } = req.body as {
    scene: "idle" | "warmup" | "experience_low" | "experience_mid" | "experience_high" | "blackout";
  };
  const validScenes = ["idle", "warmup", "experience_low", "experience_mid", "experience_high", "blackout"];
  if (!validScenes.includes(scene)) {
    res.status(400).json({ error: "Invalid scene" });
    return;
  }
  const state = dmxController.loadScene(scene);
  logger.info({ scene }, "Scene loaded");
  res.json(state);
});

router.post("/dmx/blackout", (_req, res) => {
  const state = dmxController.blackout();
  logger.info("Blackout triggered");
  res.json(state);
});

router.post("/dmx/hardware-fader", (req, res) => {
  const { position } = req.body as { position: number };
  if (position === undefined || position < 0 || position > 4) {
    res.status(400).json({ error: "position must be 0-4" });
    return;
  }
  const state = dmxController.hardwareFaderInput(position);
  res.json(state);
});

router.get("/dmx/presets", (_req, res) => {
  res.json(dmxController.getPresets());
});

router.put("/dmx/presets/:position", (req, res) => {
  const { position } = req.params;
  const validPositions = ["0", "1", "2", "3", "4", "idle"];
  if (!validPositions.includes(position)) {
    res.status(400).json({ error: "position must be 0-4 or 'idle'" });
    return;
  }
  const presets = dmxController.updatePreset(position, req.body);
  logger.info({ position }, "Preset updated");
  res.json(presets);
});

router.post("/dmx/presets/:position/capture", (req, res) => {
  const { position } = req.params;
  const validPositions = ["0", "1", "2", "3", "4", "idle"];
  if (!validPositions.includes(position)) {
    res.status(400).json({ error: "position must be 0-4 or 'idle'" });
    return;
  }
  const presets = dmxController.capturePreset(position);
  logger.info({ position }, "Preset captured from live state");
  res.json(presets);
});

router.put("/dmx/preset-timer", (req, res) => {
  const { timerSeconds, enabled } = req.body as { timerSeconds?: number; enabled?: boolean };
  const presets = dmxController.updatePresetTimer(timerSeconds, enabled);
  logger.info({ timerSeconds, enabled }, "Preset timer config updated");
  res.json(presets);
});

export default router;
