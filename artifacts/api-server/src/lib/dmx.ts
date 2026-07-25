/**
 * Central DMX / hardware controller.
 *
 * Coordinates all hardware outputs:
 *   • Art-Net pixel streaming → Gledopto 2D-EXMU controllers (LEDs)
 *   • OpenDMX USB             → Fan (CH 1 on DMX universe)
 *   • Stepper motor serial    → Opiat sign (USB-TTL GRBL/Tic)
 *   • GPIO reed contacts      → Lever position input
 *   • Screen (HDMI)           → videoFile name polled by media player
 *
 * Zone naming (replaces old ledMatrix / ledStrip1-3):
 *   haube   = Hood (2 × 16×16 matrix)   on Gledopto #1 output 1
 *   schmerz = Schmerz band (5 × 16×16)  on Gledopto #1 output 2
 *   nsar    = NSAR strip                 on Gledopto #2 output 1
 *   opiat   = Opiat strip                on Gledopto #2 output 2
 */

import fs from "fs";
import path from "path";
import { logger } from "./logger";
import {
  ZonePattern,
  DEFAULT_ZONE_PATTERN,
  HAUBE_NSAR, HAUBE_SCHMERZ, HAUBE_OPIAT, HAUBE_IDLE,
  SCHMERZ_SCHMERZ, NSAR_NSAR, OPIAT_OPIAT,
} from "./pattern-engine";
import { ArtNetPixelSender, PixelZones } from "./artnet-pixels";
import { OpenDmxController } from "./open-dmx";
import { StepperMotorController, MotorPosition } from "./stepper-motor";
import { GpioReader, FaderPosition, GpioStatus } from "./gpio-reader";
import { SerialButtonReader, DEFAULT_SERIAL_BUTTON_CONFIG } from "./serial-button";
import {
  HardwareConfig,
  DEFAULT_HARDWARE_CONFIG,
} from "./hardware-config";

// ─── Preset persistence ───────────────────────────────────────────────────────
// Stored next to the dist bundle so it survives git pulls (not tracked by git).
const PRESETS_FILE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../data/presets.json",
);

interface PersistedPresets {
  presets: FaderPreset[];
  idlePreset: FaderPreset;
  idleTimerSeconds: number;
  idleTimerEnabled: boolean;
}

function loadPersistedPresets(): PersistedPresets | null {
  try {
    const raw = fs.readFileSync(PRESETS_FILE, "utf8");
    return JSON.parse(raw) as PersistedPresets;
  } catch {
    return null;
  }
}

function savePresetsToFile(data: PersistedPresets): void {
  try {
    fs.mkdirSync(path.dirname(PRESETS_FILE), { recursive: true });
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err }, "Failed to persist presets to disk");
  }
}

// ─── Preset shape ────────────────────────────────────────────────────────────

export interface FaderPreset {
  name: string;
  fan: { speed: number; enabled: boolean };
  haube: ZonePattern;
  haube2: ZonePattern;
  schmerz: ZonePattern;
  nsar: ZonePattern;
  opiat: ZonePattern;
  motor: { position: MotorPosition; speed: number; enabled: boolean };
  screen: { videoFile: string; enabled: boolean; loop: boolean };
}

export interface PresetsState {
  /** [0]=NSAR(-1)  [1]=SCHMERZ(0)  [2]=OPIAT(1) */
  positions: FaderPreset[];
  idlePreset: FaderPreset;
  idleTimerSeconds: number;
  idleTimerEnabled: boolean;
}

// ─── Live state shape (returned by GET /dmx/state) ───────────────────────────

export interface FanState   { speed: number; enabled: boolean; dmxChannel: number }
export interface ZoneState  { pattern: ZonePattern; pixelCount: number }
export interface MotorState { position: MotorPosition; speed: number; enabled: boolean; simulated: boolean }
export interface ScreenState{ videoFile: string; enabled: boolean; loop: boolean }
export interface PainFaderState { position: FaderPosition; channel: number }

export interface DmxState {
  mode: "idle" | "experience";
  fan: FanState;
  haube: ZoneState;
  haube2: ZoneState;
  schmerz: ZoneState;
  nsar: ZoneState;
  opiat: ZoneState;
  motor: MotorState;
  screen: ScreenState;
  painFader: PainFaderState;
  gpio: GpioStatus;
  startButton: { simulated: boolean; port: string };
  hardwareConfig: HardwareConfig;
  idleTimer: { enabled: boolean; timerSeconds: number; remaining: number | null; triggered: boolean };
}

// ─── Position → preset index ─────────────────────────────────────────────────

const POS_TO_IDX: Record<number, number> = { [-1]: 0, 0: 1, 1: 2 };

// ─── Default presets ──────────────────────────────────────────────────────────

const off = DEFAULT_ZONE_PATTERN;

function makePreset(name: string, overrides: Partial<FaderPreset> = {}): FaderPreset {
  return {
    name,
    fan: { speed: 0, enabled: false },
    haube:   { ...off },
    haube2:  { ...off },
    schmerz: { ...off },
    nsar:    { ...off },
    opiat:   { ...off },
    motor:   { position: "down", speed: 3000, enabled: false },
    screen:  { videoFile: "", enabled: false, loop: true },
    ...overrides,
  };
}

const DEFAULT_PRESETS: FaderPreset[] = [
  // index 0 → position -1 (N / NSAR)
  makePreset("N – NSAR", {
    fan:     { speed: 60,  enabled: true },
    haube:   { ...HAUBE_NSAR },
    haube2:  { ...HAUBE_NSAR },
    schmerz: { ...off },
    nsar:    { ...NSAR_NSAR },
    opiat:   { ...off },
    motor:   { position: "down", speed: 3000, enabled: true },
    screen:  { videoFile: "Screen-Video_01.mp4", enabled: true, loop: true },
  }),
  // index 1 → position 0 (SCHMERZ)
  makePreset("SCHMERZ", {
    fan:     { speed: 255, enabled: true },
    haube:   { ...HAUBE_SCHMERZ },
    haube2:  { ...HAUBE_SCHMERZ },
    schmerz: { ...SCHMERZ_SCHMERZ },
    nsar:    { ...off },
    opiat:   { ...off },
    motor:   { position: "down", speed: 3000, enabled: true },
    screen:  { videoFile: "Screen-Video_02.mp4", enabled: true, loop: true },
  }),
  // index 2 → position +1 (O / OPIAT)
  makePreset("O – OPIAT", {
    fan:     { speed: 150, enabled: true },
    haube:   { ...HAUBE_OPIAT },
    haube2:  { ...HAUBE_OPIAT },
    schmerz: { ...off },
    nsar:    { ...off },
    opiat:   { ...OPIAT_OPIAT },
    motor:   { position: "up",  speed: 3000, enabled: true },
    screen:  { videoFile: "Screen-Video_03.mp4", enabled: true, loop: true },
  }),
];

const DEFAULT_IDLE_PRESET: FaderPreset = makePreset("IDLE", {
  fan:     { speed: 0,  enabled: false },
  haube:   { ...HAUBE_IDLE },
  haube2:  { ...HAUBE_IDLE },
  schmerz: { ...off },
  nsar:    { ...off },
  opiat:   { ...off },
  motor:   { position: "down", speed: 3000, enabled: false },
  screen:  { videoFile: "Screen-Video_01.mp4", enabled: true, loop: true },
});

// ─── Controller ───────────────────────────────────────────────────────────────

class DmxController {
  // ── Hardware drivers ──
  private artnet: ArtNetPixelSender;
  private openDmx: OpenDmxController;
  private motor: StepperMotorController;
  private gpio: GpioReader;
  private button: SerialButtonReader;
  private hwConfig: HardwareConfig = { ...DEFAULT_HARDWARE_CONFIG };

  // ── Live state ──
  private mode: "idle" | "experience" = "idle";
  private fan: FanState   = { speed: 0, enabled: false, dmxChannel: DEFAULT_HARDWARE_CONFIG.fanDmxChannel };
  private zones: PixelZones = {
    haube:   { ...HAUBE_IDLE },
    haube2:  { ...HAUBE_IDLE },
    schmerz: { ...off },
    nsar:    { ...off },
    opiat:   { ...off },
  };
  private motorState: MotorState = { position: "down", speed: 3000, enabled: false, simulated: true };
  private screen: ScreenState = { videoFile: "idle.mp4", enabled: true, loop: true };
  private faderPos: FaderPosition = 0;

  // ── Presets ──
  private presets: FaderPreset[];
  private idlePreset: FaderPreset;
  private idleTimerSeconds: number;
  private idleTimerEnabled: boolean;
  private idleTimerHandle: NodeJS.Timeout | null = null;
  private idleTimerStart: number | null = null;
  private idleTimerTriggered = false;

  constructor() {
    // Load persisted presets from disk, fall back to compiled defaults
    const saved = loadPersistedPresets();
    if (saved) {
      this.presets          = saved.presets.map((p) => deepClonePreset(p));
      this.idlePreset       = deepClonePreset(saved.idlePreset);
      this.idleTimerSeconds = saved.idleTimerSeconds ?? 30;
      this.idleTimerEnabled = saved.idleTimerEnabled ?? true;
      logger.info({ file: PRESETS_FILE }, "Presets loaded from disk");
    } else {
      this.presets          = DEFAULT_PRESETS.map((p) => deepClonePreset(p));
      this.idlePreset       = deepClonePreset(DEFAULT_IDLE_PRESET);
      this.idleTimerSeconds = 30;
      this.idleTimerEnabled = true;
    }

    const cfg = this.hwConfig;

    this.artnet = new ArtNetPixelSender(cfg, this.zones);

    this.openDmx = new OpenDmxController(cfg.openDmxPort);

    this.motor = new StepperMotorController({
      port: cfg.motorPort,
      driverType: cfg.motorDriverType,
      upPosition: cfg.motorUpPosition,
      downPosition: cfg.motorDownPosition,
      maxSpeed: cfg.motorMaxSpeed,
    });

    this.gpio = new GpioReader(
      {
        pinNsar:       cfg.gpioPinNsar,
        pinSchmerz:    cfg.gpioPinSchmerz,
        pinOpiat:      cfg.gpioPinOpiat,
        pollIntervalMs: cfg.gpioPollIntervalMs,
        debounceMs:    cfg.gpioDebounceMs,
      },
      (pos) => this.hardwareFaderInput(pos),
    );

    this.button = new SerialButtonReader(
      DEFAULT_SERIAL_BUTTON_CONFIG,
      () => this.startButtonPress(),
    );

    // Apply idle preset at startup
    this.applyPreset(this.idlePreset);
  }

  // ── Preset application ────────────────────────────────────────────────────

  private applyPreset(preset: FaderPreset) {
    this.fan = { ...this.fan, speed: preset.fan.speed, enabled: preset.fan.enabled };
    this.zones = {
      haube:   { ...preset.haube },
      haube2:  { ...(preset.haube2 ?? preset.haube) },
      schmerz: { ...preset.schmerz },
      nsar:    { ...preset.nsar },
      opiat:   { ...preset.opiat },
    };
    this.motorState = {
      ...this.motorState,
      position: preset.motor.position,
      speed:    preset.motor.speed,
      enabled:  preset.motor.enabled,
    };
    this.screen = { ...preset.screen };

    this.syncOutputs();
  }

  private syncOutputs() {
    // Fan → OpenDMX CH 1
    const fanValue = this.fan.enabled ? this.fan.speed : 0;
    this.openDmx.setFan(this.hwConfig.fanDmxChannel, fanValue);

    // LEDs → Art-Net pixel sender
    this.artnet.updateZones(this.zones);

    // Motor → serial
    if (this.motorState.enabled) {
      this.motor.move(this.motorState.position, this.motorState.speed).catch((err) => {
        logger.warn({ err }, "Motor move error");
      });
    }
  }

  // ── Idle timer ────────────────────────────────────────────────────────────

  private stopIdleTimer() {
    if (this.idleTimerHandle) { clearTimeout(this.idleTimerHandle); this.idleTimerHandle = null; }
    this.idleTimerStart = null;
    this.idleTimerTriggered = false;
  }

  private startIdleTimer() {
    this.stopIdleTimer();
    if (!this.idleTimerEnabled) return;
    this.idleTimerStart = Date.now();
    this.idleTimerHandle = setTimeout(() => {
      logger.info({ timerSeconds: this.idleTimerSeconds }, "Idle timer fired");
      this.idleTimerTriggered = true;
      this.mode = "idle";
      this.applyPreset(this.idlePreset);
      this.idleTimerHandle = null;
    }, this.idleTimerSeconds * 1000);
  }

  getIdleTimerRemaining(): number | null {
    if (!this.idleTimerHandle || this.idleTimerStart === null) return null;
    return Math.max(0, this.idleTimerSeconds - (Date.now() - this.idleTimerStart) / 1000);
  }

  // ── Public reads ─────────────────────────────────────────────────────────

  getState(): DmxState {
    const motorStatus = this.motor.getStatus();
    return {
      mode: this.mode,
      fan: { ...this.fan },
      haube:   { pattern: { ...this.zones.haube },   pixelCount: this.hwConfig.gledopto1.haube1PixelCount },
      haube2:  { pattern: { ...this.zones.haube2 },  pixelCount: this.hwConfig.gledopto1.haube2PixelCount },
      schmerz: { pattern: { ...this.zones.schmerz }, pixelCount: this.hwConfig.gledopto1.schmerzPixelCount },
      nsar:    { pattern: { ...this.zones.nsar },    pixelCount: this.hwConfig.gledopto2.nsarPixelCount },
      opiat:   { pattern: { ...this.zones.opiat },   pixelCount: this.hwConfig.gledopto2.opiatPixelCount },
      motor: {
        position: motorStatus.position,
        speed:    this.motorState.speed,
        enabled:  this.motorState.enabled,
        simulated: motorStatus.simulated,
      },
      screen: { ...this.screen },
      painFader: { position: this.faderPos, channel: 22 },
      gpio: this.gpio.getStatus(),
      startButton: this.button.getStatus(),
      hardwareConfig: { ...this.hwConfig },
      idleTimer: {
        enabled:      this.idleTimerEnabled,
        timerSeconds: this.idleTimerSeconds,
        remaining:    this.getIdleTimerRemaining(),
        triggered:    this.idleTimerTriggered,
      },
    };
  }

  getPresets(): PresetsState {
    return {
      positions: this.presets.map((p) => deepClonePreset(p)),
      idlePreset: deepClonePreset(this.idlePreset),
      idleTimerSeconds: this.idleTimerSeconds,
      idleTimerEnabled: this.idleTimerEnabled,
    };
  }

  getHardwareConfig(): HardwareConfig { return { ...this.hwConfig }; }

  // ── Start button ──────────────────────────────────────────────────────────

  /** Called when the physical start button is pressed (serial or injected). */
  private startButtonPress() {
    if (this.mode === "idle") {
      // Wake from idle → apply the current fader position preset
      this.mode = "experience";
      this.stopIdleTimer();
      const preset = this.presets[POS_TO_IDX[this.faderPos]] ?? this.presets[1];
      this.applyPreset(preset);
      logger.info({ faderPos: this.faderPos }, "Start button: idle → experience");
    } else {
      // Already in experience — just restart the idle timer
      this.startIdleTimer();
      logger.info("Start button: restarted idle timer");
    }
  }

  /** Inject a button press via the API (UI test button). */
  injectButtonPress(): DmxState {
    this.button.injectPress();
    return this.getState();
  }

  // ── Hardware fader input (GPIO or HTTP) ───────────────────────────────────

  hardwareFaderInput(position: FaderPosition): DmxState {
    const pos = clampPos(position);
    this.faderPos = pos;

    if (pos === 0) {
      this.startIdleTimer();
    } else {
      this.stopIdleTimer();
      this.mode = "experience";
      const preset = this.presets[POS_TO_IDX[pos]];
      if (preset) this.applyPreset(preset);
    }

    logger.info({ position: pos }, "Fader position applied");
    return this.getState();
  }

  // ── Mutators ──────────────────────────────────────────────────────────────

  setMode(mode: "idle" | "experience"): DmxState {
    this.mode = mode;
    if (mode === "idle") this.applyPreset(this.idlePreset);
    return this.getState();
  }

  setFan(updates: { speed?: number; enabled?: boolean }): DmxState {
    if (updates.speed   !== undefined) this.fan.speed   = clamp(updates.speed,   0, 255);
    if (updates.enabled !== undefined) this.fan.enabled = updates.enabled;
    this.openDmx.setFan(this.hwConfig.fanDmxChannel, this.fan.enabled ? this.fan.speed : 0);
    return this.getState();
  }

  setZone(zone: keyof PixelZones, pattern: Partial<ZonePattern>): DmxState {
    this.zones[zone] = { ...this.zones[zone], ...pattern };
    this.artnet.updateZones({ [zone]: this.zones[zone] });
    return this.getState();
  }

  setMotor(updates: { position?: MotorPosition; speed?: number; enabled?: boolean }): DmxState {
    if (updates.position !== undefined) this.motorState.position = updates.position;
    if (updates.speed    !== undefined) this.motorState.speed    = clamp(updates.speed, 0, 50000);
    if (updates.enabled  !== undefined) this.motorState.enabled  = updates.enabled;
    if (this.motorState.enabled) {
      this.motor.move(this.motorState.position, this.motorState.speed).catch((err) => {
        logger.warn({ err }, "Motor move error");
      });
    }
    return this.getState();
  }

  setScreen(updates: { videoFile?: string; enabled?: boolean; loop?: boolean }): DmxState {
    if (updates.videoFile !== undefined) this.screen.videoFile = updates.videoFile;
    if (updates.enabled   !== undefined) this.screen.enabled   = updates.enabled;
    if (updates.loop      !== undefined) this.screen.loop      = updates.loop;
    return this.getState();
  }

  // ── Preset management ─────────────────────────────────────────────────────

  updatePreset(position: string, updates: Partial<FaderPreset>): PresetsState {
    const merge = (existing: FaderPreset): FaderPreset => ({
      ...existing,
      ...updates,
      fan:    updates.fan    ? { ...existing.fan,    ...updates.fan    } : existing.fan,
      haube:  updates.haube  ? { ...existing.haube,  ...updates.haube  } : existing.haube,
      haube2: updates.haube2 ? { ...existing.haube2, ...updates.haube2 } : existing.haube2,
      schmerz:updates.schmerz? { ...existing.schmerz,...updates.schmerz} : existing.schmerz,
      nsar:   updates.nsar   ? { ...existing.nsar,   ...updates.nsar   } : existing.nsar,
      opiat:  updates.opiat  ? { ...existing.opiat,  ...updates.opiat  } : existing.opiat,
      motor:  updates.motor  ? { ...existing.motor,  ...updates.motor  } : existing.motor,
      screen: updates.screen ? { ...existing.screen, ...updates.screen } : existing.screen,
    });
    if (position === "idle") {
      this.idlePreset = merge(this.idlePreset);
    } else {
      const pos = parseInt(position, 10) as FaderPosition;
      if (![-1, 0, 1].includes(pos)) return this.getPresets();
      this.presets[POS_TO_IDX[pos]] = merge(this.presets[POS_TO_IDX[pos]]);
    }
    this.persistPresets();
    return this.getPresets();
  }

  capturePreset(position: string): PresetsState {
    const snap = this.captureCurrentAsPreset();
    if (position === "idle") {
      this.idlePreset = { ...snap, name: this.idlePreset.name };
    } else {
      const pos = parseInt(position, 10) as FaderPosition;
      if (![-1, 0, 1].includes(pos)) return this.getPresets();
      const idx = POS_TO_IDX[pos];
      this.presets[idx] = { ...snap, name: this.presets[idx]?.name ?? `POS ${pos}` };
    }
    this.persistPresets();
    return this.getPresets();
  }

  private captureCurrentAsPreset(): FaderPreset {
    return {
      name: "captured",
      fan:    { speed: this.fan.speed, enabled: this.fan.enabled },
      haube:   { ...this.zones.haube },
      haube2:  { ...this.zones.haube2 },
      schmerz: { ...this.zones.schmerz },
      nsar:    { ...this.zones.nsar },
      opiat:   { ...this.zones.opiat },
      motor:  { position: this.motorState.position, speed: this.motorState.speed, enabled: this.motorState.enabled },
      screen: { ...this.screen },
    };
  }

  updatePresetTimer(timerSeconds?: number, enabled?: boolean): PresetsState {
    if (timerSeconds !== undefined) this.idleTimerSeconds = Math.max(1, Math.min(3600, timerSeconds));
    if (enabled      !== undefined) this.idleTimerEnabled = enabled;
    if (!this.idleTimerEnabled) this.stopIdleTimer();
    this.persistPresets();
    return this.getPresets();
  }

  private persistPresets(): void {
    savePresetsToFile({
      presets:          this.presets.map((p) => deepClonePreset(p)),
      idlePreset:       deepClonePreset(this.idlePreset),
      idleTimerSeconds: this.idleTimerSeconds,
      idleTimerEnabled: this.idleTimerEnabled,
    });
  }

  // ── Scene shortcuts ───────────────────────────────────────────────────────

  loadScene(scene: "idle" | "schmerz" | "opiat" | "nsar" | "blackout"): DmxState {
    switch (scene) {
      case "idle":
        this.mode = "idle";
        this.applyPreset(this.idlePreset);
        this.faderPos = 0;
        break;
      case "schmerz":
        this.mode = "experience";
        this.applyPreset(this.presets[POS_TO_IDX[0]]);
        this.faderPos = 0;
        break;
      case "opiat":
        this.mode = "experience";
        this.applyPreset(this.presets[POS_TO_IDX[1]]);
        this.faderPos = 1;
        break;
      case "nsar":
        this.mode = "experience";
        this.applyPreset(this.presets[POS_TO_IDX[-1]]);
        this.faderPos = -1;
        break;
      case "blackout":
        this.artnet.blackout();
        this.openDmx.setFan(this.hwConfig.fanDmxChannel, 0);
        this.fan.enabled = false;
        break;
    }
    return this.getState();
  }

  blackout(): DmxState { return this.loadScene("blackout"); }

  // ── Hardware config ───────────────────────────────────────────────────────

  updateHardwareConfig(updates: Partial<HardwareConfig>): HardwareConfig {
    this.hwConfig = { ...this.hwConfig, ...updates };
    this.artnet.updateConfig(this.hwConfig);
    return { ...this.hwConfig };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    this.stopIdleTimer();
    this.artnet.destroy();
    this.openDmx.destroy();
    this.motor.destroy();
    this.gpio.destroy();
    this.button.destroy();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function clampPos(p: number): FaderPosition { return Math.max(-1, Math.min(1, Math.round(p))) as FaderPosition; }

function deepClonePreset(p: FaderPreset): FaderPreset {
  // haube2 may be absent in presets saved before this field was added — fall back to haube
  const h2 = ((p as any).haube2 ?? p.haube) as ZonePattern;
  return {
    ...p,
    fan:    { ...p.fan },
    haube:  { ...p.haube,   primaryColor: { ...p.haube.primaryColor },   secondaryColor: { ...p.haube.secondaryColor } },
    haube2: { ...h2,        primaryColor: { ...h2.primaryColor },         secondaryColor: { ...h2.secondaryColor } },
    schmerz:{ ...p.schmerz, primaryColor: { ...p.schmerz.primaryColor }, secondaryColor: { ...p.schmerz.secondaryColor } },
    nsar:   { ...p.nsar,    primaryColor: { ...p.nsar.primaryColor },    secondaryColor: { ...p.nsar.secondaryColor } },
    opiat:  { ...p.opiat,   primaryColor: { ...p.opiat.primaryColor },   secondaryColor: { ...p.opiat.secondaryColor } },
    motor:  { ...p.motor },
    screen: { ...p.screen },
  };
}

export const dmxController = new DmxController();
