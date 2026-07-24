/**
 * USB serial port auto-detection by VID/PID.
 *
 * Uses SerialPort.list() to scan all connected USB-serial adapters and
 * returns the first port whose vendorId+productId match the given values.
 * Falls back to `fallback` when no match is found.
 *
 * Known IDs used in this installation:
 *   Enttec OpenDMX USB  (FTDI FT232R)  VID=0403  PID=6001
 *   Waveshare USB-to-TTL (CH340)        VID=1a86  PID=7523
 */

import { logger } from "./logger";

export interface UsbId {
  vendorId:  string; // 4-char hex, e.g. "0403"
  productId: string; // 4-char hex, e.g. "6001"
  label:     string; // human-readable name for logging
}

// ── Well-known devices ────────────────────────────────────────────────────────

export const FTDI_OPEN_DMX: UsbId = {
  vendorId:  "0403",
  productId: "6001",
  label:     "Enttec OpenDMX USB (FTDI FT232R)",
};

export const CH340_WAVESHARE: UsbId = {
  vendorId:  "1a86",
  productId: "7523",
  label:     "Waveshare USB-to-TTL (CH340)",
};

// ── Finder ────────────────────────────────────────────────────────────────────

/**
 * Returns the /dev/ttyUSBx path for a device matching `id`.
 * Falls back to `fallback` (and logs a warning) when not found.
 * Returns null when not found and no fallback is given.
 */
export async function findSerialPort(
  id: UsbId,
  fallback?: string,
): Promise<string | null> {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();

    // normalise to lowercase for comparison
    const vid = id.vendorId.toLowerCase();
    const pid = id.productId.toLowerCase();

    const match = ports.find(
      (p) =>
        p.vendorId?.toLowerCase()  === vid &&
        p.productId?.toLowerCase() === pid,
    );

    if (match) {
      logger.info(
        { path: match.path, label: id.label },
        `USB auto-detect: found ${id.label}`,
      );
      return match.path;
    }

    // Log all available ports for diagnostics
    const available = ports.map((p) => `${p.path} [${p.vendorId}:${p.productId}]`).join(", ");
    logger.warn(
      { searched: `${vid}:${pid}`, label: id.label, available: available || "(none)" },
      `USB auto-detect: ${id.label} not found`,
    );

    if (fallback) {
      logger.info({ fallback, label: id.label }, "USB auto-detect: using configured fallback path");
      return fallback;
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "USB auto-detect: SerialPort.list() failed");
    return fallback ?? null;
  }
}
