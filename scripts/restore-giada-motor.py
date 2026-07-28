#!/usr/bin/env python3
"""
Restore-Skript für den MKS-Motor auf dem Giada / paintable.
Führe dies auf dem Giada aus:  python3 /opt/painfader/scripts/restore-giada-motor.py

Schreibt die vier gepatchten Dateien, baut den api-server neu und startet
den painfader-Dienst neu.
"""

import os, subprocess, sys

BASE = "/opt/painfader"

# ── 1. hardware-config.ts ────────────────────────────────────────────────────

HARDWARE_CONFIG = r'''/**
 * Hardware configuration for the Painfader installation.
 * All values can be overridden at runtime via the /api/hardware-config endpoint.
 *
 * Physical layout:
 *  • Gledopto GL-C-618WL #1 (WLED)  — Haube (2 × 16×16 px, GPIO16 + GPIO12)
 *  • Gledopto Elite 2D    (WLED)     — Schmerz-Band (5 × 16×16 px, IO2)
 *  • Gledopto 2D-EXMU #2  (WLED)    — NSAR-Band (strip) + Opiat-Band (strip)
 *  • Enttec OpenDMX USB              — Fan on CH 1
 *  • USB-TTL step/dir                — Stepper motor for Opiat sign
 *  • GPIO (gpiochip0)                — Reed contacts: GPI1=N(−1), GPI2=0, GPI3=O(+1)
 */

export interface GledoptoConfig {
  host: string;
  universeStart: number;
  protocol?: "artnet" | "e131" | "ddp";
}

export interface HardwareConfig {
  gledopto1: GledoptoConfig & {
    haube1PixelCount: number;
    haube2PixelCount: number;
  };
  schmerzController: GledoptoConfig & {
    schmerzPixelCount: number;
  };
  gledopto2: GledoptoConfig & {
    nsarPixelCount: number;
    opiatPixelCount: number;
  };
  pixelProtocol: "artnet" | "e131" | "ddp";
  pixelSourceIp: string;
  artnetPort: number;
  artnetRefreshRate: number;
  openDmxPort: string;
  fanDmxChannel: number;
  motorPort: string;
  /** 'mks' | 'grbl' | 'tic' | 'simulated' */
  motorDriverType: "grbl" | "tic" | "mks" | "simulated";
  /**
   * mks  → time in ms to run CW  (UP)
   * grbl → absolute position in mm
   * tic  → absolute position in steps
   */
  motorUpPosition: number;
  /**
   * mks  → time in ms to run CCW (DOWN)
   * grbl → absolute position in mm
   * tic  → absolute position in steps
   */
  motorDownPosition: number;
  /**
   * mks  → speed in RPM (0-3000)
   * grbl → feed rate in mm/min
   * tic  → steps/s
   */
  motorMaxSpeed: number;
  gpioChip: number;
  gpioPinNsar: number;
  gpioPinSchmerz: number;
  gpioPinOpiat: number;
  gpioPollIntervalMs: number;
  gpioDebounceMs: number;
}

export const DEFAULT_HARDWARE_CONFIG: HardwareConfig = {
  gledopto1: {
    host: "2.0.0.156",       // 2D EXMU "led matrix lang" — Haube, WLED 16.0.1
    universeStart: 0,
    haube1PixelCount: 256,
    haube2PixelCount: 256,
  },
  schmerzController: {
    host: "2.0.0.158",       // 4D EXMU — Schmerzband, Art-Net, WLED 16.0.1
    universeStart: 0,        // universes 0–7
    schmerzPixelCount: 1280,
  },
  gledopto2: {
    host: "2.0.0.157",       // 2D EXMU "led bänder" — NSAR + Opiat, Art-Net, WLED 16.0.1
    universeStart: 0,        // NSAR: 0–1, Opiat: 2
    nsarPixelCount: 240,
    opiatPixelCount: 125,
  },
  pixelProtocol: "artnet",
  pixelSourceIp: "2.0.0.10",
  artnetPort: 6454,
  artnetRefreshRate: 30,

  openDmxPort: "/dev/ttyUSB0",
  fanDmxChannel: 1,

  motorPort: "/dev/ttyACM0",   // UTS-T01 USB-TTL (CH341 1a86:55d3)
  motorDriverType: "mks",
  motorUpPosition: 3000,       // ms CW  for UP   — calibrate!
  motorDownPosition: 3000,     // ms CCW for DOWN — calibrate!
  motorMaxSpeed: 200,          // RPM (0-3000)

  gpioChip: 0,             // gpiochip0 = INTC1057 (Intel platform GPIO — confirmed DI connector)
  gpioPinNsar: 5,          // DI0 — confirmed chip0 line 5
  gpioPinSchmerz: 6,       // DI1 — confirmed chip0 line 6
  gpioPinOpiat: 7,         // DI2 — confirmed chip0 line 7
  gpioPollIntervalMs: 50,
  gpioDebounceMs: 30,
};
'''

# ── 2. stepper-motor.ts ──────────────────────────────────────────────────────

STEPPER_MOTOR = r'''/**
 * Stepper motor driver for the Opiat sign (USB-TTL board).
 *
 * Supports:
 *   - MKS  (default): MKS Servo57CPCBA UART protocol, 38400 baud
 *   - GRBL           : G-code commands over 115200 baud serial
 *   - Pololu Tic     : binary quick-commands over 115200 baud serial
 *   - simulated      : logs only (Replit dev mode)
 *
 * MKS velocity-mode semantics (motorDriverType = "mks"):
 *   motorMaxSpeed    -> speed in RPM (0-3000)
 *   motorUpPosition  -> time in ms to run CW for UP
 *   motorDownPosition-> time in ms to run CCW for DOWN
 */

import { logger } from "./logger";

export type MotorPosition = "up" | "down" | "stop";
export type MotorDriverType = "grbl" | "tic" | "mks" | "simulated";

export interface MotorConfig {
  port: string;
  driverType: MotorDriverType;
  upPosition: number;
  downPosition: number;
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
        await delay(200);
        await this.enableMks(true);
        logger.info({ port: config.port }, "MKS Servo57C stepper motor connected");
      } else if (config.driverType === "grbl") {
        await this.writeGrbl("\x18");
        await delay(1500);
        await this.writeGrbl("$X\n");
        await this.writeGrbl("G21\n");
        await this.writeGrbl(`F${config.maxSpeed}\n`);
        logger.info({ port: config.port }, "GRBL stepper motor connected");
      } else if (config.driverType === "tic") {
        await this.writeTic(0x85, 0);
        logger.info({ port: config.port }, "Tic stepper motor connected");
      }
    } catch (err) {
      logger.warn({ port: config.port, err }, "Stepper motor unavailable — simulation mode");
      this.simulated = true;
    }
  }

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
      this.writeGrbl("!");
    }
    if (this.driverType === "mks" && !this.simulated) {
      this.stopMks().catch(() => {});
    }
    try { this.port?.close(); } catch (_) { /* ignore */ }
  }

  // MKS Servo57CPCBA — Protocol: [ADDR=0x01][CMD][DATA...][XOR-CRC], 38400 baud 8N1

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

  // CMD 0xF6: run — [ADDR][0xF6][dir|speedH][speedL][acc][CRC]
  private async runMks(direction: "cw" | "ccw", rpm: number, accel = 2) {
    const speed = Math.max(0, Math.min(3000, Math.round(rpm)));
    const speedH = (direction === "cw" ? 0x80 : 0x00) | ((speed >> 8) & 0x7F);
    const speedL = speed & 0xFF;
    await this.writeMks(0xF6, speedH, speedL, accel);
  }

  // CMD 0xF7: stop — [ADDR][0xF7][CRC]
  private async stopMks() {
    await this.writeMks(0xF7);
  }

  // CMD 0xF3: enable — [ADDR][0xF3][0x01=on|0x00=off][CRC]
  private async enableMks(on: boolean) {
    await this.writeMks(0xF3, on ? 0x01 : 0x00);
  }

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

  // GRBL driver
  private async moveGrbl(position: MotorPosition, feedRate: number) {
    switch (position) {
      case "up":   await this.writeGrbl(`G90 G1 X${this.cfg.upPosition} F${feedRate}\n`); break;
      case "down": await this.writeGrbl(`G90 G1 X${this.cfg.downPosition} F${feedRate}\n`); break;
      case "stop": await this.writeGrbl("!\n"); break;
    }
  }

  private writeGrbl(cmd: string): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.port?.isOpen) { res(); return; }
      this.port.write(Buffer.from(cmd, "ascii"), (err) => (err ? rej(err) : res()));
    });
  }

  // Pololu Tic driver
  private async moveTic(position: MotorPosition, stepsPerSec: number) {
    switch (position) {
      case "up":   await this.writeTic(0x85,  Math.round(Math.min(stepsPerSec, 50000000) * 10000)); break;
      case "down": await this.writeTic(0x85, -Math.round(Math.min(stepsPerSec, 50000000) * 10000)); break;
      case "stop": await this.writeTic(0x85, 0); break;
    }
  }

  private writeTic(cmd: number, value: number): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.port?.isOpen) { res(); return; }
      const buf = value !== 0
        ? Buffer.from([cmd, (value>>0)&0x7f, (value>>7)&0x7f, (value>>14)&0x7f, (value>>21)&0x7f])
        : Buffer.from([cmd]);
      this.port.write(buf, (err) => (err ? rej(err) : res()));
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
'''

# ── 3. updateHardwareConfig patch in dmx.ts ──────────────────────────────────
# Only patch if the old one-liner is still there; skip if already patched.

DMX_OLD = '''  updateHardwareConfig(updates: Partial<HardwareConfig>): HardwareConfig {
    this.hwConfig = { ...this.hwConfig, ...updates };
    this.artnet.updateConfig(this.hwConfig);
    return { ...this.hwConfig };
  }'''

DMX_NEW = '''  updateHardwareConfig(updates: Partial<HardwareConfig>): HardwareConfig {
    const motorChanged = updates.motorPort !== undefined || updates.motorDriverType !== undefined ||
      updates.motorUpPosition !== undefined || updates.motorDownPosition !== undefined ||
      updates.motorMaxSpeed !== undefined;

    this.hwConfig = { ...this.hwConfig, ...updates };
    this.artnet.updateConfig(this.hwConfig);

    if (motorChanged) {
      this.motor.destroy();
      this.motor = new StepperMotorController({
        port:          this.hwConfig.motorPort,
        driverType:    this.hwConfig.motorDriverType,
        upPosition:    this.hwConfig.motorUpPosition,
        downPosition:  this.hwConfig.motorDownPosition,
        maxSpeed:      this.hwConfig.motorMaxSpeed,
      });
    }

    return { ...this.hwConfig };
  }'''

# ── 4. Dashboard.tsx — add MKS option ───────────────────────────────────────
DASH_OLD = '''<option value="grbl">GRBL (default)</option>'''
DASH_NEW = '''<option value="mks">MKS Servo57C (UART)</option>
                            <option value="grbl">GRBL (default)</option>'''

# ── write helpers ─────────────────────────────────────────────────────────────

def write(path, content):
    full = os.path.join(BASE, path)
    with open(full, "w") as f:
        f.write(content)
    print(f"  wrote {full}")

def patch(path, old, new):
    full = os.path.join(BASE, path)
    with open(full) as f:
        src = f.read()
    if old in src:
        with open(full, "w") as f:
            f.write(src.replace(old, new, 1))
        print(f"  patched {full}")
    elif new in src:
        print(f"  already patched {full} — skip")
    else:
        print(f"  WARNING: expected text not found in {full}")

# ── run ───────────────────────────────────────────────────────────────────────

print("=== Painfader motor restore ===")

print("\n1. Writing hardware-config.ts …")
write("artifacts/api-server/src/lib/hardware-config.ts", HARDWARE_CONFIG)

print("\n2. Writing stepper-motor.ts …")
write("artifacts/api-server/src/lib/stepper-motor.ts", STEPPER_MOTOR)

print("\n3. Patching dmx.ts (updateHardwareConfig) …")
patch("artifacts/api-server/src/lib/dmx.ts", DMX_OLD, DMX_NEW)

print("\n4. Patching Dashboard.tsx (MKS option) …")
patch("artifacts/painfader/src/pages/Dashboard.tsx", DASH_OLD, DASH_NEW)

print("\n5. Building api-server …")
r = subprocess.run(
    ["pnpm", "--filter", "@workspace/api-server", "run", "build"],
    cwd=BASE, capture_output=True, text=True
)
print(r.stdout[-1000:] if r.stdout else "")
if r.returncode != 0:
    print("BUILD FAILED:", r.stderr[-500:])
    sys.exit(1)

print("\n6. Building frontend …")
r = subprocess.run(
    ["pnpm", "--filter", "@workspace/painfader", "run", "build"],
    cwd=BASE, capture_output=True, text=True
)
print(r.stdout[-500:] if r.stdout else "")

print("\n7. Restarting painfader …")
subprocess.run(["systemctl", "restart", "painfader"], check=True)

print("\nDone. Check: journalctl -u painfader -n 5 | grep -i motor")
