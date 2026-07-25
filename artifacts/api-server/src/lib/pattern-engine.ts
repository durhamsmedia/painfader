/**
 * Pattern engine for WS2812b pixel zones.
 * All patterns are stateless given a phase [0..1).
 * The phase accumulator lives in ArtNetPixelSender and advances per frame.
 */

export type PatternType = "solid" | "pulse" | "chase" | "wave" | "sparkle";

export interface RgbColor {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface ZonePattern {
  type: PatternType;
  primaryColor: RgbColor;
  secondaryColor: RgbColor;
  /** Overall brightness scale 0-255 */
  brightness: number;
  /** Animation speed 0-255 (maps to ~0..2 Hz cycle) */
  speed: number;
  enabled: boolean;
}

export const DEFAULT_ZONE_PATTERN: ZonePattern = {
  type: "solid",
  primaryColor: { r: 255, g: 255, b: 255 },
  secondaryColor: { r: 0, g: 0, b: 0 },
  brightness: 128,
  speed: 64,
  enabled: false,
};

// ─── Preset palette defaults ─────────────────────────────────────────────────

/** Haube in NSAR state: blue pulse */
export const HAUBE_NSAR: ZonePattern = {
  type: "pulse",
  primaryColor: { r: 57, g: 56, b: 244 },
  secondaryColor: { r: 0, g: 0, b: 60 },
  brightness: 220,
  speed: 80,
  enabled: true,
};

/** Haube in SCHMERZ state: red/orange chase */
export const HAUBE_SCHMERZ: ZonePattern = {
  type: "chase",
  primaryColor: { r: 235, g: 104, b: 61 },
  secondaryColor: { r: 80, g: 20, b: 0 },
  brightness: 255,
  speed: 140,
  enabled: true,
};

/** Haube in OPIAT state: dim off */
export const HAUBE_OPIAT: ZonePattern = {
  type: "solid",
  primaryColor: { r: 10, g: 10, b: 10 },
  secondaryColor: { r: 0, g: 0, b: 0 },
  brightness: 40,
  speed: 0,
  enabled: false,
};

/** Haube in IDLE state: warm white glow */
export const HAUBE_IDLE: ZonePattern = {
  type: "pulse",
  primaryColor: { r: 255, g: 220, b: 120 },
  secondaryColor: { r: 80, g: 60, b: 20 },
  brightness: 60,
  speed: 30,
  enabled: true,
};

/** Schmerz band: red/orange wave */
export const SCHMERZ_SCHMERZ: ZonePattern = {
  type: "wave",
  primaryColor: { r: 235, g: 104, b: 61 },
  secondaryColor: { r: 120, g: 30, b: 0 },
  brightness: 255,
  speed: 160,
  enabled: true,
};

/** NSAR band: blue solid */
export const NSAR_NSAR: ZonePattern = {
  type: "solid",
  primaryColor: { r: 57, g: 56, b: 244 },
  secondaryColor: { r: 0, g: 0, b: 80 },
  brightness: 220,
  speed: 0,
  enabled: true,
};

/** Opiat band: turquoise sparkle */
export const OPIAT_OPIAT: ZonePattern = {
  type: "sparkle",
  primaryColor: { r: 193, g: 251, b: 235 },
  secondaryColor: { r: 20, g: 60, b: 55 },
  brightness: 220,
  speed: 180,
  enabled: true,
};

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Render a ZonePattern into a flat RGB buffer.
 * @param pattern  Pattern spec
 * @param pixelCount  Number of pixels in the zone
 * @param phase  Accumulator value [0..1) — caller advances this each frame
 * @returns  Buffer of length pixelCount × 3 (R,G,B,R,G,B,…)
 */
export function renderPattern(
  pattern: ZonePattern,
  pixelCount: number,
  phase: number,
): Buffer {
  const buf = Buffer.alloc(pixelCount * 3, 0);
  if (!pattern.enabled || pixelCount === 0) return buf;

  const { primaryColor: pc, secondaryColor: sc, brightness: br, speed } = pattern;
  // Gamma 2.2: WS2812b LEDs are linear but the eye is logarithmic.
  // Without this, values 20–255 all look "full brightness" and only the bottom
  // 8% of the slider has any perceptible effect.
  const bScale = Math.pow(br / 255, 2.2);

  switch (pattern.type) {
    case "solid": {
      const [r, g, b] = scale(pc, bScale);
      for (let i = 0; i < pixelCount; i++) {
        buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b;
      }
      break;
    }

    case "pulse": {
      // Sine breathe from secondaryColor to primaryColor.
      // Apply gamma to t so the perceived brightness follows the sine curve linearly —
      // without this the pulse looks like a brief flicker/blink rather than a smooth breath.
      const tLinear = (Math.sin(phase * Math.PI * 2) + 1) / 2; // 0..1
      const t = Math.pow(tLinear, 2.2);
      const r = Math.round(lerp(sc.r, pc.r, t) * bScale);
      const g = Math.round(lerp(sc.g, pc.g, t) * bScale);
      const b = Math.round(lerp(sc.b, pc.b, t) * bScale);
      for (let i = 0; i < pixelCount; i++) {
        buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b;
      }
      break;
    }

    case "chase": {
      // One dot (5% of strip) moving forward
      const dotSize = Math.max(1, Math.round(pixelCount * 0.06));
      const pos = phase * pixelCount;
      for (let i = 0; i < pixelCount; i++) {
        let dist = Math.abs(i - pos);
        if (dist > pixelCount / 2) dist = pixelCount - dist; // wrap
        if (dist < dotSize) {
          const fade = 1 - dist / dotSize;
          buf[i * 3]     = Math.round(lerp(sc.r, pc.r, fade) * bScale);
          buf[i * 3 + 1] = Math.round(lerp(sc.g, pc.g, fade) * bScale);
          buf[i * 3 + 2] = Math.round(lerp(sc.b, pc.b, fade) * bScale);
        } else {
          buf[i * 3]     = Math.round(sc.r * bScale * 0.15);
          buf[i * 3 + 1] = Math.round(sc.g * bScale * 0.15);
          buf[i * 3 + 2] = Math.round(sc.b * bScale * 0.15);
        }
      }
      break;
    }

    case "wave": {
      // Gradient that sweeps through the strip
      for (let i = 0; i < pixelCount; i++) {
        const t = (Math.sin(((i / pixelCount) - phase) * Math.PI * 2) + 1) / 2;
        buf[i * 3]     = Math.round(lerp(sc.r, pc.r, t) * bScale);
        buf[i * 3 + 1] = Math.round(lerp(sc.g, pc.g, t) * bScale);
        buf[i * 3 + 2] = Math.round(lerp(sc.b, pc.b, t) * bScale);
      }
      break;
    }

    case "sparkle": {
      // Dim secondary background + random primary sparks
      const [bgR, bgG, bgB] = scale(sc, bScale * 0.15);
      for (let i = 0; i < pixelCount; i++) {
        buf[i * 3] = bgR; buf[i * 3 + 1] = bgG; buf[i * 3 + 2] = bgB;
      }
      const density = 0.02 + (speed / 255) * 0.08; // 2..10%
      const sparkleCount = Math.max(1, Math.round(pixelCount * density));
      for (let s = 0; s < sparkleCount; s++) {
        // Deterministic seed from phase + spark index
        const seed = Math.floor(((phase * 1000 + s * 137.508) % 1) * pixelCount);
        const idx = (seed + pixelCount) % pixelCount;
        const [r, g, b] = scale(pc, bScale);
        buf[idx * 3] = r; buf[idx * 3 + 1] = g; buf[idx * 3 + 2] = b;
      }
      break;
    }
  }

  return buf;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function scale(c: RgbColor, factor: number): [number, number, number] {
  return [
    Math.round(c.r * factor),
    Math.round(c.g * factor),
    Math.round(c.b * factor),
  ];
}
