/**
 * Stepper motor driver for the Opiat sign (USB-TTL board).
 *
 * Supports:
 *   - MKS  (default): MKS Servo57CPCBA UART protocol, 38400 baud
 *   - GRBL           : G-code commands over 115200 baud serial
 *   - Pololu Tic     : binary quick-commands over 115200 baud serial
 *   - simulated      : logs only (Replit dev mode)
 *
 * Motion model:
 *   UP   → sign is visible  (absolute position or timed velocity move)
 *   DOWN → sign is hidden
 *   STOP → immediate halt
 *
 * MKS velocity-mode semantics (motorDriverType = "mks"):
 *   motorMaxSpeed    → speed in RPM (0-3000)
 *   motorUpPosition  → time in ms to run CW for UP
 *   motorDownPosition→ time in ms to run CCW for DOWN
 *
 * GRBL/Tic semantics:
 *   motorMaxSpeed    → mm/min (GRBL) or steps/s (Tic)
 *   motorUpPosition  → absolute position in mm / steps
 *   motorDownPosition→ absolute position in mm / steps
 */

import { logger } from "./logger";

export type MotorPosition = "up" | "down" | "stop";
export type MotorDriverType = "grbl" | "tic" | "mks" | "simulated";

export interface MotorConfig {
  port: string;
  driverType: MotorDriverType;
  /** mm (GRBL), steps (Tic), or run-time ms (MKS) for UP position */
  upPosition: number;
  /** mm (GRBL), steps (Tic), or run-time ms (MKS) for DOWN position */
  downPosition: number;
  /** mm/min (GRBL), steps/s (Tic), or RPM (MKS) */
  maxSpeed: number;
}

export class StepperMotorController {
  private port: import("serialport").SerialPort | null = null;
  private simulated = true;
  private driverType: MotorDriverType;
  private cfg: MotorConfig;
  private currentPosition: MotorPosition = "down";
  private homed = false;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;

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
      const baud = config.driverType === "mks" ? 38400 : 115200;
      const sp = new SerialPort({ path: config.port, baudRate: baud, autoOpen: false });

      await new Promise<void>((res, rej) => sp.open((e) => (e ? rej(e) : res())));
      this.port = sp;
      this.simulated = false;

      sp.on("error", (err) => {
        logger.warn({ err }, "Stepper motor serial error — falling back to simulation");
        this.simulated = true;
        this.port = null;
      });

      if (config.driverType === "mks") {
        await delay(200); // allow controller to settle
        await this.enableMks(true);
        logger.info({ port: config.port }, "MKS Servo57C stepper motor connected");
      } else if (config.driverType === "grbl") {
        await this.writeGrbl("\x18"); // Ctrl-X soft reset
        await delay(1500);
        await this.writeGrbl("$X\n"); // clear alarm
        await this.writeGrbl("G21\n"); // mm mode
        await this.writeGrbl(`F${config.maxSpeed}\n`); // default feed rate
        logger.info({ port: config.port }, "GRBL stepper motor connected");
      } else if (config.driverType === "tic") {
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

    if (this.driverType === "mks") {
      await this.moveMks(position, spd);
    } else if (this.driverType === "grbl") {
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
    this.clearMoveTimer();
    if (this.driverType === "grbl" && !this.simulated) {
      this.writeGrbl("!"); // feed hold
    }
    if (this.driverType === "mks" && !this.simulated) {
      this.stopMks().catch(() => {});
    }
    try { this.port?.close(); } catch (_) { /* ignore */ }
  }

  // ── MKS Servo57CPCBA driver ───────────────────────────────────────────────
  //
  // Protocol: [ADDR=0x01] [CMD] [DATA...] [CRC]
  //   CRC = XOR of all bytes in frame (ADDR ^ CMD ^ DATA...)
  // Baud: 38400, 8N1
  //
  // Velocity (timed) mode:
  //   UP   = run CW  at maxSpeed RPM for upPosition ms, then stop
  //   DOWN = run CCW at maxSpeed RPM for downPosition ms, then stop
  //   STOP = send stop command immediately

  private clearMoveTimer() {
    if (this.moveTimer !== null) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
  }

  private async moveMks(position: MotorPosition, rpm: number) {
    this.clearMoveTimer();

    switch (position) {
      case "up": {
        await this.runMks("cw", rpm);
        logger.info({ rpm, ms: this.cfg.upPosition }, "MKS: running CW (UP)");
        this.moveTimer = setTimeout(async () => {
          await this.stopMks();
          logger.info("MKS: UP move complete — stopped");
        }, this.cfg.upPosition);
        break;
      }
      case "down": {
        await this.runMks("ccw", rpm);
        logger.info({ rpm, ms: this.cfg.downPosition }, "MKS: running CCW (DOWN)");
        this.moveTimer = setTimeout(async () => {
          await this.stopMks();
          logger.info("MKS: DOWN move complete — stopped");
        }, this.cfg.downPosition);
        break;
      }
      case "stop":
        await this.stopMks();
        logger.info("MKS: stop command sent");
        break;
    }
  }

  /**
   * Run the motor at the given speed.
   * CMD 0xF6: [ADDR] [0xF6] [dir|speed_H] [speed_L] [acc] [CRC]
   *   speed is 15-bit RPM (0-3000), direction in bit7 of first speed byte.
   */
  private async runMks(direction: "cw" | "ccw", rpm: number, accel = 2) {
    const speed = Math.max(0, Math.min(3000, Math.round(rpm)));
    const speedH = (direction === "cw" ? 0x80 : 0x00) | ((speed >> 8) & 0x7F);
    const speedL = speed & 0xFF;
    await this.writeMks(0xF6, speedH, speedL, accel);
  }

  /**
   * Stop the motor.
   * CMD 0xF7: [ADDR] [0xF7] [CRC]
   */
  private async stopMks() {
    await this.writeMks(0xF7);
  }

  /**
   * Enable or disable the motor.
   * CMD 0xF3: [ADDR] [0xF3] [0x01=enable | 0x00=disable] [CRC]
   */
  private async enableMks(on: boolean) {
    await this.writeMks(0xF3, on ? 0x01 : 0x00);
  }

  /** Build and write an MKS frame. CRC = XOR of all frame bytes. */
  private writeMks(cmd: number, ...data: number[]): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.port?.isOpen) { res(); return; }
      const addr = 0x01;
      const frame = [addr, cmd, ...data];
      const crc = frame.reduce((acc, b) => acc ^ b, 0);
      const buf = Buffer.from([...frame, crc]);
      logger.debug({ frame: buf.toString("hex") }, "MKS serial write");
      this.port.write(buf, (err) => (err ? rej(err) : res()));
    });
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
        const spd = Math.min(stepsPerSec, 50000000);
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
