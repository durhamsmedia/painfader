/**
 * Hardware configuration for the Painfader installation.
 * All values can be overridden at runtime via the /api/hardware-config endpoint.
 *
 * Physical layout:
 *  • Gledopto 2D-EXMU #1  — Haube (2 × 16×16 px) + Schmerz-Band (5 × 16×16 px)
 *  • Gledopto 2D-EXMU #2  — NSAR-Band (strip) + Opiat-Band (strip)
 *  • Enttec OpenDMX USB   — Fan on CH 1
 *  • USB-TTL step/dir      — Stepper motor for Opiat sign
 *  • GPIO (gpiochip0)      — Reed contacts: GPI1=N(−1), GPI2=0, GPI3=O(+1)
 */

export interface GledoptoConfig {
  /** Unicast or broadcast IP of this Gledopto unit */
  host: string;
  /** Art-Net universe of the first pixel on this unit */
  universeStart: number;
}

export interface HardwareConfig {
  // ── Gledopto #1 (Haube + Schmerz) ───────────────────────────────────────
  gledopto1: GledoptoConfig & {
    /** Haube Matrix 1 (GPIO16): 1 × 16×16 = 256 pixels */
    haube1PixelCount: number;
    /** Haube Matrix 2 (GPIO12): 1 × 16×16 = 256 pixels — independently controlled */
    haube2PixelCount: number;
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

  /** Pixel streaming protocol: "artnet" (UDP unicast) or "e131" (sACN multicast) */
  pixelProtocol: "artnet" | "e131";
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

  // ── Stepper motor (USB-TTL step/dir board) ────────────────────────────────
  motorPort: string;
  /** 'grbl' | 'tic' | 'simulated' */
  motorDriverType: "grbl" | "tic" | "simulated";
  /** Absolute position (steps or mm) representing sign visible (UP) */
  motorUpPosition: number;
  /** Absolute position (steps or mm) representing sign hidden (DOWN) */
  motorDownPosition: number;
  /** Max feed rate (mm/min for GRBL, steps/s for Tic) */
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
    schmerzPixelCount: 1280, // 5 × 256
  },
  gledopto2: {
    host: "2.0.0.255",     // same subnet broadcast
    universeStart: 16,     // starts after Gledopto #1's 11 universes (with gap)
    nsarPixelCount: 300,   // adjust to physical strip length
    opiatPixelCount: 300,
  },
  pixelProtocol: "artnet",
  pixelSourceIp: "2.0.0.10",   // enp1s0 on Giada — multicast leaves on this NIC
  artnetPort: 6454,
  artnetRefreshRate: 30,

  openDmxPort: "/dev/ttyUSB0",
  fanDmxChannel: 1,

  motorPort: "/dev/ttyACM0",
  motorDriverType: "grbl",
  motorUpPosition: 100,    // mm — adjust after physical calibration
  motorDownPosition: 0,
  motorMaxSpeed: 3000,     // mm/min

  gpioChip: 0,
  gpioPinNsar: 0,          // GPIO line numbers — check with `gpioinfo` on target hardware
  gpioPinSchmerz: 1,
  gpioPinOpiat: 2,
  gpioPollIntervalMs: 50,
  gpioDebounceMs: 30,
};
