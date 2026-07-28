/**
 * GPIO reed-contact reader for the Painfader lever.
 *
 * Uses gpioget (libgpiod v2) via child_process — works on Giada AF208-N97
 * where the IT87 GPIO chip is /dev/gpiochip1 and onoff (sysfs) does not
 * expose these lines reliably.
 *
 * Wiring (DI connector, 12-24 V opto-isolated inputs):
 *   DI1  it87_gp10  line 0  → N / NSAR  (position −1)
 *   DI2  it87_gp11  line 1  → SCHMERZ 0 (spring center)
 *   DI3  it87_gp12  line 2  → O / OPIAT (position +1)
 *
 * Logic:
 *   - Priority: OPIAT > NSAR > SCHMERZ (center is the spring-return default)
 *   - Debounce: position must be stable for gpioDebounceMs before firing
 *   - Falls back to simulation mode when gpioget is unavailable or chip missing
 */

import { execSync } from "child_process";
import { logger } from "./logger";

export type FaderPosition = -1 | 0 | 1;

export interface GpioConfig {
  chip: number;          // gpiochip index, e.g. 1 for /dev/gpiochip1
  pinNsar: number;       // line number for NSAR  (position −1)
  pinSchmerz: number;    // line number for SCHMERZ (center / 0)
  pinOpiat: number;      // line number for OPIAT  (position +1)
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
  private chipPath: string;
  private cfg: GpioConfig;
  private position: FaderPosition = 0;
  private rawState = { nsar: false, schmerz: false, opiat: false };
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingPos: FaderPosition | null = null;
  private readonly onPositionChange: (pos: FaderPosition) => void;

  constructor(config: GpioConfig, onPositionChange: (pos: FaderPosition) => void) {
    this.cfg = config;
    this.chipPath = `/dev/gpiochip${config.chip}`;
    this.onPositionChange = onPositionChange;
    this.init();
  }

  private init() {
    // Probe: try to read one line — if it works, we're in hardware mode
    try {
      readLine(this.chipPath, this.cfg.pinNsar);
      this.simulated = false;
      logger.info(
        { chip: this.chipPath, pins: { nsar: this.cfg.pinNsar, schmerz: this.cfg.pinSchmerz, opiat: this.cfg.pinOpiat } },
        "GPIO reader initialised (hardware mode via gpioget)",
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

  /** Inject a position directly (used by the UI software fader and HTTP endpoint). */
  injectPosition(pos: FaderPosition) {
    if (pos !== this.position) {
      this.position = pos;
      this.onPositionChange(pos);
    }
  }

  destroy() {
    if (this.pollTimer)    { clearInterval(this.pollTimer);  this.pollTimer    = null; }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }

  // ── Poll ───────────────────────────────────────────────────────────────────

  private poll() {
    try {
      const nsar    = readLine(this.chipPath, this.cfg.pinNsar);
      const schmerz = readLine(this.chipPath, this.cfg.pinSchmerz);
      const opiat   = readLine(this.chipPath, this.cfg.pinOpiat);

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

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read a single GPIO line via `gpioget -c <chip> <line>`.
 * Output format (libgpiod v2): `"<line>"=active` or `"<line>"=inactive`
 * Returns true for active (HIGH), false for inactive (LOW).
 * Throws if gpioget fails.
 */
function readLine(chipPath: string, line: number): boolean {
  const out = execSync(`gpioget -c ${chipPath} ${line}`, { timeout: 200 }).toString().trim();
  return out.includes("=active");
}
