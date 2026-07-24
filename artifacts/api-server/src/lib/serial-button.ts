/**
 * Serial-port start button reader.
 *
 * Hardware: Waveshare USB-to-TTL adapter on /dev/ttyUSB0
 * Wiring:   GND → button → RXD
 *
 * When the button is pressed, RXD is pulled LOW → the UART sees a break/framing
 * condition and delivers bytes (0x00 / framing noise) to userspace.
 * Any incoming byte is treated as "button pressed".
 *
 * Debounce: the callback fires once per press; subsequent bytes within
 * `debounceMs` are ignored.  A second press is only recognised after the
 * line goes quiet for `debounceMs`.
 */

import { logger } from "./logger";

export interface SerialButtonConfig {
  port: string;       // e.g. "/dev/ttyUSB0"
  baudRate: number;   // 9600
  debounceMs: number; // ms to suppress repeated triggers
}

export const DEFAULT_SERIAL_BUTTON_CONFIG: SerialButtonConfig = {
  port:       "/dev/ttyUSB1",
  baudRate:   9600,
  debounceMs: 800,
};

export class SerialButtonReader {
  private cfg: SerialButtonConfig;
  private onPress: () => void;
  private serialPort: import("serialport").SerialPort | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private armed = true;
  simulated = true;

  constructor(config: SerialButtonConfig, onPress: () => void) {
    this.cfg     = config;
    this.onPress = onPress;
    this.init();
  }

  private async init() {
    try {
      const { SerialPort } = await import("serialport");

      this.serialPort = new SerialPort({
        path:     this.cfg.port,
        baudRate: this.cfg.baudRate,
        autoOpen: false,
      });

      this.serialPort.open((err) => {
        if (err) {
          logger.warn({ err, port: this.cfg.port }, "Serial button: port open failed — button disabled");
          return;
        }
        this.simulated = false;
        logger.info({ port: this.cfg.port }, "Serial button: ready");
      });

      this.serialPort.on("data", (_data: Buffer) => {
        if (!this.armed) return;
        this.armed = false;
        logger.info("Serial button: press detected");
        this.onPress();

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.armed = true;
          this.debounceTimer = null;
        }, this.cfg.debounceMs);
      });

      this.serialPort.on("error", (err: Error) => {
        logger.warn({ err }, "Serial button: port error");
      });

    } catch (err) {
      logger.warn({ err }, "Serial button: serialport unavailable — button disabled");
      this.simulated = true;
    }
  }

  /** Fire programmatically — used by the UI test button. */
  injectPress() {
    if (this.armed) {
      this.armed = false;
      this.onPress();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => { this.armed = true; }, this.cfg.debounceMs);
    }
  }

  getStatus() {
    return { simulated: this.simulated, port: this.cfg.port };
  }

  destroy() {
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
    try { this.serialPort?.close(); } catch (_) { /* ignore */ }
  }
}
