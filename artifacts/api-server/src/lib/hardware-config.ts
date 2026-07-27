/**
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
  /** Unicast or broadcast IP of this Gledopto unit */
  host: string;
  /** Art-Net universe of the first pixel on this unit */
  universeStart: number;
  /**
   * Per-device protocol override. When set, overrides the global pixelProtocol
   * for this device only. Useful when devices support different protocols
   * (e.g. Gledopto Elite 2D only supports DDP, not Art-Net).
   */
  protocol?: "artnet" | "e131" | "ddp";
}

export interface HardwareConfig {
  // ── Gledopto #1 (Haube only) ─────────────────────────────────────────────
  gledopto1: GledoptoConfig & {
    /** Haube Matrix 1 (GPIO16): 1 × 16×16 = 256 pixels */
    haube1PixelCount: number;
    /** Haube Matrix 2 (GPIO12): 1 × 16×16 = 256 pixels — independently controlled */
    haube2PixelCount: number;
  };

  // ── Gledopto Elite 2D (Schmerz-Band, IO2) ────────────────────────────────
  schmerzController: GledoptoConfig & {
    /** Schmerz-Band: 5 matrices × 16×16 = 1280 pixels */
    schmerzPixelCount: number;
  };

  // ── Gledopto #2 (NSAR + Opiat) ───────────────────────────────────────────
  gledopto2: GledoptoConfig & {
    /** NSAR strip — pixel count (configure to match physical length) */
    nsarPixelCount: number;
    /** Opiat strip — pixel count */
    opiatPixelCount: number;
  };

  /** Pixel streaming protocol: "artnet", "e131" or "ddp" */
  pixelProtocol: "artnet" | "e131" | "ddp";
  /**
   * Source IP of the network interface that carries Art-Net / sACN traffic.
   * For Art-Net: binds the UDP socket to this IP so broadcasts (255.255.255.255) leave on
   *   the correct NIC. Without this, the OS picks the default-route NIC which may be wrong.
   * For E1.31: also sets IP_MULTICAST_IF so multicast packets leave on the right NIC.
   * Example: "2.0.0.10" (enp1s0 on Giada)
   */
  pixelSourceIp: string;
  /** Art-Net UDP port (default 6454) */
  artnetPort: number;
  /** Frame rate for the pixel animation loop (Hz) */
  artnetRefreshRate: number;

  // ── OpenDMX USB (Enttec OpenDMX / FTDI FT232R) ───────────────────────────
  openDmxPort: string;
  /** DMX channel (1-based) connected to fan controller */
  fanDmxChannel: number;

  // ── Stepper motor (USB-TTL board) ─────────────────────────────────────────
  motorPort: string;
  /** 'mks' | 'grbl' | 'tic' | 'simulated' */
  motorDriverType: "grbl" | "tic" | "mks" | "simulated";
  /**
   * Semantics depend on motorDriverType:
   *   mks  → time in ms to run CW  (UP)
   *   grbl → absolute position in mm
   *   tic  → absolute position in steps
   */
  motorUpPosition: number;
  /**
   * Semantics depend on motorDriverType:
   *   mks  → time in ms to run CCW (DOWN)
   *   grbl → absolute position in mm
   *   tic  → absolute position in steps
   */
  motorDownPosition: number;
  /**
   * Semantics depend on motorDriverType:
   *   mks  → speed in RPM (0-3000)
   *   grbl → feed rate in mm/min
   *   tic  → steps/s
   */
  motorMaxSpeed: number;

  // ── GPIO reed contacts (Giada AF208-N97, /dev/gpiochip0) ─────────────────
  /** GPIO chip index (0 = /dev/gpiochip0) */
  gpioChip: number;
  /** Line number for GPI1 — N / NSAR (position −1) */
  gpioPinNsar: number;
  /** Line number for GPI2 — SCHMERZ / center (position 0) */
  gpioPinSchmerz: number;
  /** Line number for GPI3 — O / OPIAT (position +1) */
  gpioPinOpiat: number;
  /** Poll interval in ms */
  gpioPollIntervalMs: number;
  /** Debounce window in ms */
  gpioDebounceMs: number;
}

export const DEFAULT_HARDWARE_CONFIG: HardwareConfig = {
  gledopto1: {
    host: "2.0.0.255",       // Subnet broadcast — WLED only receives broadcasts on this network
    universeStart: 0,
    haube1PixelCount: 256,   // Matrix 1 (GPIO16) — Haube NSAR side
    haube2PixelCount: 256,   // Matrix 2 (GPIO12) — Haube Schmerz side
  },
  schmerzController: {
    host: "2.0.0.158",       // Gledopto Elite 2D — unicast, IO2
    universeStart: 0,        // unused for DDP (byte-offset based)
    protocol: "ddp",         // Elite 2D firmware only supports DDP, not Art-Net
    schmerzPixelCount: 1280, // 5 × 256
  },
  gledopto2: {
    host: "2.0.0.157",     // Gledopto Elite 2D #2 — unicast, DDP only
    universeStart: 0,      // unused for DDP (byte-offset based)
    protocol: "ddp",       // Elite 2D firmware only supports DDP, not Art-Net
    nsarPixelCount: 240,   // GPIO16 — confirmed 240 LEDs
    opiatPixelCount: 125,  // IO2    — confirmed 125 LEDs
  },
  pixelProtocol: "artnet",
  pixelSourceIp: "2.0.0.10",   // enp1s0 on Giada — multicast leaves on this NIC
  artnetPort: 6454,
  artnetRefreshRate: 30,

  openDmxPort: "/dev/ttyUSB0",
  fanDmxChannel: 1,

  motorPort: "/dev/ttyUSB1",  // UTS-T01 USB-TTL converter (adjust if needed)
  motorDriverType: "mks",
  motorUpPosition: 3000,   // mks: ms to run CW  for UP   — calibrate!
  motorDownPosition: 3000, // mks: ms to run CCW for DOWN — calibrate!
  motorMaxSpeed: 200,      // mks: RPM (0-3000)

  gpioChip: 0,
  gpioPinNsar: 0,          // GPIO line numbers — check with `gpioinfo` on target hardware
  gpioPinSchmerz: 1,
  gpioPinOpiat: 2,
  gpioPollIntervalMs: 50,
  gpioDebounceMs: 30,
};
