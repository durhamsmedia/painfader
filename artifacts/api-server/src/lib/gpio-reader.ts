/**
 * GPIO reed-contact reader for the Painfader lever + start button.
 *
 * Uses gpioget (libgpiod v2) via child_process — works on Giada AF208-N97
 * where the DI connector maps to gpiochip0 (Intel INTC1057).
 *
 * Wiring (DI connector, 3.3 V from DI connector):
 *   DI0  gpiochip0 line 5  → N / NSAR   (lever position −1)
 *   DI1  gpiochip0 line 6  → SCHMERZ 0  (lever spring center)
 *   DI2  gpiochip0 line 7  → O / OPIAT  (lever position +1)
 *   DI3  gpiochip0 line 8  → START button (parallel to Waveshare serial)
 *
 * Logic:
 *   - Lever priority: OPIAT > NSAR > SCHMERZ (center is the spring-return default)
 *   - Lever debounce: position must be stable for gpioDebounceMs before firing
 *   - Button: rising-edge detection (inactive → active), debounced via buttonDebounceMs
 *   - Falls back to simulation mode when gpioget is unavailable or chip missing
 */

import { execSync } from "child_process";
import { logger } from "./logger";

export type FaderPosition = -1 | 0 | 1;

export interface GpioConfig {
  chip: number;           // gpiochip index, e.g. 0 for /dev/gpiochip0
  pinNsar: number;        // line number for NSAR   (position −1)
  pinSchmerz: number;     // line number for SCHMERZ (center / 0)
  pinOpiat: number;       // line number for OPIAT   (position +1)
  /** Optional: DI3 line used as a parallel start button trigger */
  pinButton?: number;
  pollIntervalMs: number;
  debounceMs: number;
  /** Debounce window for the start button in ms (default = debounceMs) */
  buttonDebounceMs?: number;
}

export interface GpioStatus {
  simulated: boolean;
  position: FaderPosition;
  raw: { nsar: boolean; schmerz: boolean; opiat: boolean; button: boolean };
}

export class GpioReader {
  private simulated = true;
  private chipPath: string;
  private cfg: GpioConfig;
  private position: FaderPosition = 0;
  private rawState = { nsar: false, schmerz: false, opiat: false, button: false };
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingPos: FaderPosition | null = null;
  private prevButtonActive = false;
  private buttonArmed = true;
  private buttonDebounceTimer: NodeJS.Timeout | null = null;
  private readonly onPositionChange: (pos: FaderPosition) => void;
  private readonly onStartButton?: () => void;

  constructor(
    config: GpioConfig,
    onPositionChange: (pos: FaderPosition) => void,
    onStartButton?: () => void,
  ) {
    this.cfg = config;
    this.chipPath = `/dev/gpiochip${config.chip}`;
    this.onPositionChange = onPositionChange;
    this.onStartButton = onStartButton;
    this.init();
  }

  private init() {
    // Probe: try to read one line — if it works, we're in hardware mode
    try {
      readLine(this.chipPath, this.cfg.pinNsar);
      this.simulated = false;
      logger.info(
        {
          chip: this.chipPath,
          pins: {
            nsar:    this.cfg.pinNsar,
            schmerz: this.cfg.pinSchmerz,
            opiat:   this.cfg.pinOpiat,
            button:  this.cfg.pinButton ?? "(none)",
          },
        },
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
      position:  this.position,
      raw:       { ...this.rawState },
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
    if (this.pollTimer)         { clearInterval(this.pollTimer);        this.pollTimer         = null; }
    if (this.debounceTimer)     { clearTimeout(this.debounceTimer);     this.debounceTimer     = null; }
    if (this.buttonDebounceTimer) { clearTimeout(this.buttonDebounceTimer); this.buttonDebounceTimer = null; }
  }

  // ── Poll ───────────────────────────────────────────────────────────────────

  private poll() {
    try {
      const nsar    = readLine(this.chipPath, this.cfg.pinNsar);
      const schmerz = readLine(this.chipPath, this.cfg.pinSchmerz);
      const opiat   = readLine(this.chipPath, this.cfg.pinOpiat);

      // ── Start button (DI3) — rising-edge detection ──────────────────────
      let button = false;
      if (this.cfg.pinButton !== undefined) {
        button = readLine(this.chipPath, this.cfg.pinButton);
        if (button && !this.prevButtonActive && this.buttonArmed && this.onStartButton) {
          // Rising edge detected
          this.buttonArmed = false;
          logger.info("GPIO: start button rising edge — press detected");
          this.onStartButton();

          const debMs = this.cfg.buttonDebounceMs ?? this.cfg.debounceMs;
          if (this.buttonDebounceTimer) clearTimeout(this.buttonDebounceTimer);
          this.buttonDebounceTimer = setTimeout(() => {
            this.buttonArmed = true;
            this.buttonDebounceTimer = null;
          }, debMs);
        }
        this.prevButtonActive = button;
      }

      this.rawState = { nsar, schmerz, opiat, button };

      // ── Lever position — priority: opiat → nsar → schmerz (spring center) ─
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
