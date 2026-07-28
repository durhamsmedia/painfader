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

  // ── GPIO reed contacts (Giada AF208-N97, /dev/gpiochip1 = gpio_it87) ──────
  /** GPIO chip index (1 = /dev/gpiochip1 = gpio_it87 on Giada AF208-N97) */
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
    host: "2.0.0.156",       // 2D EXMU "led matrix lang" — Haube, DDP, static IP (WLED 16.0.1)
    universeStart: 0,
    protocol: "ddp",
    haube1PixelCount: 256,   // Matrix 1 (GPIO16) — Haube NSAR side
    haube2PixelCount: 256,   // Matrix 2 (GPIO12) — Haube Schmerz side
  },
  schmerzController: {
    host: "2.0.0.158",       // 4D EXMU — Schmerzband, DDP, static IP (WLED 16.0.1)
    universeStart: 0,
    protocol: "ddp",         // DDP: no universe boundaries, supports 1280px cleanly
    schmerzPixelCount: 1280, // 5 × 256
  },
  gledopto2: {
    host: "2.0.0.157",     // 2D EXMU "led bänder" — NSAR + Opiat, DDP, static IP (WLED 16.0.1)
    universeStart: 0,
    protocol: "ddp",
    nsarPixelCount: 240,   // GPIO16 — confirmed 240 LEDs
    opiatPixelCount: 125,  // IO2    — confirmed 125 LEDs
  },
  pixelProtocol: "artnet",
  pixelSourceIp: "2.0.0.10",   // enp1s0 on Giada — multicast leaves on this NIC
  artnetPort: 6454,
  artnetRefreshRate: 30,

  openDmxPort: "/dev/ttyUSB0",
  fanDmxChannel: 1,

  motorPort: "/dev/ttyACM0",  // UTS-T01 USB-TTL (CH341 1a86:55d3) — auto-detected by serial
  motorDriverType: "mks",
  motorUpPosition: 3000,   // mks: ms to run CW  for UP   — calibrate!
  motorDownPosition: 3000, // mks: ms to run CCW for DOWN — calibrate!
  motorMaxSpeed: 200,      // mks: RPM (0-3000)

  gpioChip: 1,             // gpiochip1 = gpio_it87 (Giada AF208-N97 DI connector)
  gpioPinNsar: 0,          // it87_gp10 — DI1 (lever position N / NSAR)
  gpioPinSchmerz: 1,       // it87_gp11 — DI2 (lever center / Schmerz)
  gpioPinOpiat: 2,         // it87_gp12 — DI3 (lever position O / Opiat)
  gpioPollIntervalMs: 50,
  gpioDebounceMs: 30,
};
