/**
 * USB serial port auto-detection by VID/PID (+ optional serial number).
 *
 * When two adapters share the same VID:PID (e.g. both FTDI FT232R),
 * provide `serialNumber` to pick the correct one unambiguously.
 *
 * Known devices in this installation:
 *   Enttec OpenDMX USB  VID=0403 PID=6001 serial=A50285BI
 *   Waveshare USB-TTL   VID=0403 PID=6001 serial=B0049WIS  (also FT232R)
 */

import { logger } from "./logger";

export interface UsbId {
  vendorId:      string;           // 4-char hex, e.g. "0403"
  productId:     string;           // 4-char hex, e.g. "6001"
  label:         string;           // human-readable name for logging
  serialNumber?: string;           // match only this serial when set
}

// ── Well-known devices ────────────────────────────────────────────────────────

export const FTDI_OPEN_DMX: UsbId = {
  vendorId:     "0403",
  productId:    "6001",
  serialNumber: "A50285BI",
  label:        "Enttec OpenDMX USB (FT232R A50285BI)",
};

export const FTDI_WAVESHARE: UsbId = {
  vendorId:     "0403",
  productId:    "6001",
  serialNumber: "B0049WIS",
  label:        "Waveshare USB-TTL (FT232R B0049WIS)",
};

export const CH341_UTS_T01: UsbId = {
  vendorId:     "1a86",
  productId:    "55d3",
  serialNumber: "5C66049883",
  label:        "UTS-T01 USB-TTL (CH341 5C66049883)",
};

// kept for back-compat in case anything still imports it
export const CH340_WAVESHARE = FTDI_WAVESHARE;

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

    const vid    = id.vendorId.toLowerCase();
    const pid    = id.productId.toLowerCase();
    const serial = id.serialNumber?.toUpperCase();

    const match = ports.find((p) => {
      if (p.vendorId?.toLowerCase()  !== vid) return false;
      if (p.productId?.toLowerCase() !== pid) return false;
      if (serial) {
        // serialNumber comes back in the `serialNumber` field of PortInfo
        const portSerial = (p as Record<string, unknown>).serialNumber as string | undefined;
        if (portSerial?.toUpperCase() !== serial) return false;
      }
      return true;
    });

    if (match) {
      logger.info({ path: match.path, label: id.label }, `USB auto-detect: found ${id.label}`);
      return match.path;
    }

    const available = ports
      .map((p) => {
        const sn = (p as Record<string, unknown>).serialNumber as string | undefined;
        return `${p.path} [${p.vendorId ?? "?"}:${p.productId ?? "?"}${sn ? ` sn=${sn}` : ""}]`;
      })
      .join(", ");

    logger.warn(
      { searched: `${vid}:${pid}${serial ? ` sn=${serial}` : ""}`, label: id.label, available: available || "(none)" },
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
