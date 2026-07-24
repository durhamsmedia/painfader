/**
 * OpenDMX USB (Enttec OpenDMX / FTDI FT232R) driver.
 * Sends a full 512-channel DMX512 frame at ~40 Hz via USB serial.
 *
 * Protocol:
 *   1. Assert BREAK (≥92 µs low)
 *   2. Assert MAB  (≥12 µs high)
 *   3. Write start code 0x00 + 512 data bytes at 250 000 baud, 8N2
 *
 * Falls back to simulation (logging only) when the port is unavailable
 * so the Replit dev environment keeps running without hardware.
 */

import { logger } from "./logger";

const DMX_REFRESH_MS = 25; // ~40 Hz
const BREAK_MS = 2;        // 2 ms break — well above the 92 µs minimum
const MAB_MS = 1;          // 1 ms MAB  — well above the 12 µs minimum

export class OpenDmxController {
  private channels: number[] = new Array(512).fill(0);
  private simulated = true;
  private port: import("serialport").SerialPort | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isSending = false;

  constructor(portPath: string) {
    this.open(portPath);
  }

  private async open(portPath: string) {
    try {
      const { SerialPort } = await import("serialport");
      const sp = new SerialPort({
        path: portPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: "none",
        autoOpen: false,
      });

      await new Promise<void>((resolve, reject) => {
        sp.open((err) => (err ? reject(err) : resolve()));
      });

      this.port = sp;
      this.simulated = false;
      logger.info({ portPath }, "OpenDMX USB port opened");

      sp.on("error", (err) => {
        logger.warn({ err }, "OpenDMX USB error — falling back to simulation");
        this.simulated = true;
        this.port = null;
      });

      this.startLoop();
    } catch (err) {
      logger.warn({ portPath, err }, "OpenDMX USB unavailable — running in simulation mode");
      this.simulated = true;
      this.startLoop(); // still run loop so logs are visible
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Set a single DMX channel (1-based).
   */
  setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > 512) return;
    this.channels[channel - 1] = Math.max(0, Math.min(255, Math.round(value)));
  }

  /**
   * Convenience: set fan speed on its dedicated DMX channel.
   */
  setFan(channel: number, speed: number): void {
    this.setChannel(channel, speed);
    if (this.simulated) {
      logger.debug({ channel, speed }, "OpenDMX (sim): fan update");
    }
  }

  get isSimulated() { return this.simulated; }

  destroy() {
    this.stopLoop();
    try { this.port?.close(); } catch (_) { /* ignore */ }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private startLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => this.sendFrame(), DMX_REFRESH_MS);
  }

  private stopLoop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async sendFrame() {
    if (this.simulated || !this.port?.isOpen || this.isSending) return;
    this.isSending = true;

    try {
      // 1. Assert BREAK
      await retryOnEintr(() => setBreak(this.port!, true));
      await delay(BREAK_MS);

      // 2. Release BREAK → MAB
      await retryOnEintr(() => setBreak(this.port!, false));
      await delay(MAB_MS);

      // 3. Write start code + 512 channels
      const frame = Buffer.alloc(513);
      frame[0] = 0x00; // DMX start code
      for (let i = 0; i < 512; i++) frame[i + 1] = this.channels[i] ?? 0;

      await retryOnEintr(() => new Promise<void>((res, rej) => {
        this.port!.write(frame, (err) => (err ? rej(err) : res()));
      }));
    } catch (err) {
      logger.warn({ err }, "OpenDMX send frame error");
    } finally {
      this.isSending = false;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function setBreak(port: import("serialport").SerialPort, brk: boolean): Promise<void> {
  return new Promise((res, rej) => port.set({ brk }, (err) => (err ? rej(err) : res())));
}

/** Retry an ioctl/write op up to 3× when the kernel interrupts it (EINTR). */
async function retryOnEintr(fn: () => Promise<void>, maxRetries = 3): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (attempt < maxRetries && msg.includes("Interrupted")) continue;
      throw err;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
