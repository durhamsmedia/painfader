/**
 * Stepper motor driver for the Opiat sign (USB-TTL step/dir board).
 *
 * Supports:
 *   - GRBL (default): G-code commands over 115200 baud serial
 *   - Pololu Tic: binary quick-commands over 115200 baud serial
 *   - simulated: logs only (Replit dev mode)
 *
 * Motion model:
 *   UP   → sign is visible  (absolute position = motorUpPosition mm / steps)
 *   DOWN → sign is hidden   (absolute position = motorDownPosition)
 *   STOP → immediate halt
 *
 * Physical wiring (step/dir board):
 *   TX  → STEP or RX on controller
 *   RTS → DIR (some boards) OR use the protocol's direction commands
 *
 * On first connection GRBL is homed (G28) so the absolute coordinate system
 * is established.
 */

import { logger } from "./logger";

export type MotorPosition = "up" | "down" | "stop";
export type MotorDriverType = "grbl" | "tic" | "simulated";

export interface MotorConfig {
  port: string;
  driverType: MotorDriverType;
  upPosition: number;    // mm (GRBL) or steps (Tic)
  downPosition: number;
  maxSpeed: number;      // mm/min (GRBL) or steps/s (Tic)
}

export class StepperMotorController {
  private port: import("serialport").SerialPort | null = null;
  private simulated = true;
  private driverType: MotorDriverType;
  private cfg: MotorConfig;
  private currentPosition: MotorPosition = "down";
  private homed = false;

  constructor(config: MotorConfig) {
    this.cfg = config;
    this.driverType = config.driverType;
    if (config.driverType !== "simulated") {
      this.open(config);
    } else {
      logger.info("Stepper motor: running in simulation mode");
    }
  }

  private async open(config: MotorConfig) {
    try {
      const { SerialPort } = await import("serialport");
      const baud = config.driverType === "grbl" ? 115200 : 115200;
      const sp = new SerialPort({ path: config.port, baudRate: baud, autoOpen: false });

      await new Promise<void>((res, rej) => sp.open((e) => (e ? rej(e) : res())));
      this.port = sp;
      this.simulated = false;

      sp.on("error", (err) => {
        logger.warn({ err }, "Stepper motor serial error — falling back to simulation");
        this.simulated = true;
        this.port = null;
      });

      // GRBL: send soft-reset + wait for startup banner, then set feed rate
      if (config.driverType === "grbl") {
        await this.writeGrbl("\x18"); // Ctrl-X soft reset
        await delay(1500);
        await this.writeGrbl("$X\n"); // clear alarm
        await this.writeGrbl("G21\n"); // mm mode
        await this.writeGrbl(`F${config.maxSpeed}\n`); // default feed rate
        logger.info({ port: config.port }, "GRBL stepper motor connected");
      } else if (config.driverType === "tic") {
        // Tic: energize
        await this.writeTic(0x85, 0); // Set Speed = 0
        logger.info({ port: config.port }, "Tic stepper motor connected");
      }
    } catch (err) {
      logger.warn({ port: config.port, err }, "Stepper motor unavailable — simulation mode");
      this.simulated = true;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async move(position: MotorPosition, speed?: number): Promise<void> {
    this.currentPosition = position;

    if (this.simulated) {
      logger.info({ position, speed }, "Stepper motor (sim): move command");
      return;
    }

    const spd = speed ?? this.cfg.maxSpeed;

    if (this.driverType === "grbl") {
      await this.moveGrbl(position, spd);
    } else if (this.driverType === "tic") {
      await this.moveTic(position, spd);
    }
  }

  getStatus() {
    return {
      position: this.currentPosition,
      simulated: this.simulated,
      driverType: this.driverType,
      homed: this.homed,
    };
  }

  destroy() {
    if (this.driverType === "grbl" && !this.simulated) {
      this.writeGrbl("!"); // feed hold
    }
    try { this.port?.close(); } catch (_) { /* ignore */ }
  }

  // ── GRBL driver ───────────────────────────────────────────────────────────

  private async moveGrbl(position: MotorPosition, feedRate: number) {
    switch (position) {
      case "up":
        await this.writeGrbl(`G90 G1 X${this.cfg.upPosition} F${feedRate}\n`);
        break;
      case "down":
        await this.writeGrbl(`G90 G1 X${this.cfg.downPosition} F${feedRate}\n`);
        break;
      case "stop":
        await this.writeGrbl("!\n"); // feed hold
        break;
    }
  }

  private writeGrbl(cmd: string): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.port?.isOpen) { res(); return; }
      this.port.write(Buffer.from(cmd, "ascii"), (err) => (err ? rej(err) : res()));
    });
  }

  // ── Pololu Tic driver ─────────────────────────────────────────────────────
  // Quick-serial commands documented in Pololu Tic Stepper Motor Controller User's Guide §6

  private async moveTic(position: MotorPosition, stepsPerSec: number) {
    switch (position) {
      case "up": {
        const spd = Math.min(stepsPerSec, 50000000); // Tic speed in steps/10000000 s
        await this.writeTic(0x85, Math.round(spd * 10000)); // Set Target Velocity
        break;
      }
      case "down": {
        const spd = Math.min(stepsPerSec, 50000000);
        await this.writeTic(0x85, -Math.round(spd * 10000));
        break;
      }
      case "stop":
        await this.writeTic(0x85, 0); // velocity = 0
        break;
    }
  }

  /** Send a Tic quick-command with a 32-bit signed payload */
  private writeTic(cmd: number, value: number): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.port?.isOpen) { res(); return; }
      // Quick serial format: cmd byte (if no payload) or cmd + 4 data bytes
      const buf = value !== undefined && value !== 0
        ? Buffer.from([cmd,
            (value >> 0) & 0x7f,
            (value >> 7) & 0x7f,
            (value >> 14) & 0x7f,
            (value >> 21) & 0x7f])
        : Buffer.from([cmd]);
      this.port.write(buf, (err) => (err ? rej(err) : res()));
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
