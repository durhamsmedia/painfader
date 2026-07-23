/**
 * GPIO reed-contact reader for the Painfader lever.
 *
 * On the Giada AF208-N97 running Debian, the 6 exposed GPIs are accessible
 * via /dev/gpiochip0 using the Linux GPIO character device API.
 *
 * Wiring (one GPI per lever position, active-HIGH through reed contact):
 *   GPI1 (pin configured as gpioPinNsar)    → N / NSAR  (position −1)
 *   GPI2 (pin configured as gpioPinSchmerz) → SCHMERZ 0 (spring center)
 *   GPI3 (pin configured as gpioPinOpiat)   → O / OPIAT (position +1)
 *
 * Logic:
 *   - Priority: OPIAT > NSAR > SCHMERZ (center is the spring-return default)
 *   - Debounce: position must be stable for gpioDebounceMs before firing
 *   - Falls back to simulation mode (no callbacks) when GPIO is unavailable
 *
 * The `onoff` package uses Linux sysfs (/sys/class/gpio) which is available
 * on all current Debian kernels. Install: pnpm add onoff
 * For kernels > 5.10 with CONFIG_GPIO_SYSFS=n, use the gpiod package instead.
 */

import { logger } from "./logger";

export type FaderPosition = -1 | 0 | 1;

export interface GpioConfig {
  pinNsar: number;
  pinSchmerz: number;
  pinOpiat: number;
  pollIntervalMs: number;
  debounceMs: number;
}

export interface GpioStatus {
  simulated: boolean;
  position: FaderPosition;
  raw: { nsar: boolean; schmerz: boolean; opiat: boolean };
}

export class GpioReader {
  private simulated = true;
  private pins: { nsar: GpioPin | null; schmerz: GpioPin | null; opiat: GpioPin | null } = {
    nsar: null, schmerz: null, opiat: null,
  };
  private cfg: GpioConfig;
  private position: FaderPosition = 0;
  private rawState = { nsar: false, schmerz: false, opiat: false };
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly onPositionChange: (pos: FaderPosition) => void;

  constructor(config: GpioConfig, onPositionChange: (pos: FaderPosition) => void) {
    this.cfg = config;
    this.onPositionChange = onPositionChange;
    this.init();
  }

  private async init() {
    try {
      const { Gpio } = await import("onoff");

      this.pins.nsar    = new Gpio(this.cfg.pinNsar,    "in");
      this.pins.schmerz = new Gpio(this.cfg.pinSchmerz, "in");
      this.pins.opiat   = new Gpio(this.cfg.pinOpiat,   "in");

      this.simulated = false;
      logger.info(
        { pins: this.cfg },
        "GPIO reader initialised (hardware mode)",
      );

      this.pollTimer = setInterval(() => this.poll(), this.cfg.pollIntervalMs);
    } catch (err) {
      logger.warn({ err }, "GPIO unavailable — running in simulation mode (UI / keyboard shortcuts still work)");
      this.simulated = true;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getStatus(): GpioStatus {
    return {
      simulated: this.simulated,
      position: this.position,
      raw: { ...this.rawState },
    };
  }

  /**
   * Inject a position directly (used by the software fader in the UI and
   * by the /api/dmx/hardware-fader HTTP endpoint — both still work in simulation).
   */
  injectPosition(pos: FaderPosition) {
    if (pos !== this.position) {
      this.position = pos;
      this.onPositionChange(pos);
    }
  }

  destroy() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
    try {
      this.pins.nsar?.unexport();
      this.pins.schmerz?.unexport();
      this.pins.opiat?.unexport();
    } catch (_) { /* ignore */ }
  }

  // ── Poll ───────────────────────────────────────────────────────────────────

  private poll() {
    try {
      const nsar    = (this.pins.nsar?.readSync()    ?? 0) === 1;
      const schmerz = (this.pins.schmerz?.readSync() ?? 0) === 1;
      const opiat   = (this.pins.opiat?.readSync()   ?? 0) === 1;

      this.rawState = { nsar, schmerz, opiat };

      // Priority: opiat → nsar → schmerz (spring center = default)
      const newPos: FaderPosition = opiat ? 1 : nsar ? -1 : 0;

      if (newPos !== this.position) {
        this.scheduleDebounce(newPos);
      }
    } catch (err) {
      logger.warn({ err }, "GPIO poll error");
    }
  }

  private pendingPos: FaderPosition | null = null;

  private scheduleDebounce(pos: FaderPosition) {
    this.pendingPos = pos;
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
    this.debounceTimer = setTimeout(() => {
      if (this.pendingPos !== null && this.pendingPos !== this.position) {
        this.position = this.pendingPos;
        logger.info({ position: this.position }, "GPIO: lever position change");
        this.onPositionChange(this.position);
      }
      this.pendingPos = null;
    }, this.cfg.debounceMs);
  }
}

// ── Minimal Gpio type stub (avoids import errors when onoff isn't installed) ──
type GpioPin = { readSync(): number; unexport(): void };
