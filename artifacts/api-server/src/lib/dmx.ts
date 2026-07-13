import dgram from "node:dgram";
import { logger } from "./logger";

export interface DmxConfig {
  host: string;
  universe: number;
  port: number;
  refreshRate: number;
}

export interface FanState {
  speed: number;
  enabled: boolean;
  channel: number;
}

export interface LedMatrixState {
  r: number;
  g: number;
  b: number;
  brightness: number;
  pattern: number;
  enabled: boolean;
  channels: { r: number; g: number; b: number; brightness: number; pattern: number };
}

export interface LedStripState {
  r: number;
  g: number;
  b: number;
  brightness: number;
  enabled: boolean;
  channels: { r: number; g: number; b: number; brightness: number };
}

export interface DiscState {
  speed: number;
  direction: "cw" | "ccw" | "stop";
  enabled: boolean;
  channel: number;
}

export interface PainFaderState {
  position: number;
  dmxValue: number;
  channel: number;
}

export interface DmxState {
  mode: "idle" | "experience";
  fan: FanState;
  ledMatrix: LedMatrixState;
  ledStrips: { strip1: LedStripState; strip2: LedStripState };
  disc: DiscState;
  painFader: PainFaderState;
  channels: number[];
  artnetConnected: boolean;
}

const CHANNEL_MAP = {
  FAN_SPEED: 0,
  LED_MATRIX_R: 2,
  LED_MATRIX_G: 3,
  LED_MATRIX_B: 4,
  LED_MATRIX_BRIGHTNESS: 5,
  LED_MATRIX_PATTERN: 6,
  LED_STRIP1_R: 7,
  LED_STRIP1_G: 8,
  LED_STRIP1_B: 9,
  LED_STRIP1_BRIGHTNESS: 10,
  LED_STRIP2_R: 11,
  LED_STRIP2_G: 12,
  LED_STRIP2_B: 13,
  LED_STRIP2_BRIGHTNESS: 14,
  DISC_SPEED: 15,
  DISC_DIRECTION: 16,
  PAIN_FADER: 17,
};

const PAIN_FADER_DMX: Record<number, number> = {
  0: 0,
  1: 64,
  2: 127,
  3: 191,
  4: 255,
};

const DIRECTION_DMX: Record<string, number> = {
  stop: 0,
  cw: 128,
  ccw: 255,
};

class DmxController {
  private channels: number[] = new Array(512).fill(0);
  private config: DmxConfig = {
    host: "255.255.255.255",
    universe: 0,
    port: 6454,
    refreshRate: 44,
  };

  private state: Omit<DmxState, "channels" | "artnetConnected"> = {
    mode: "idle",
    fan: { speed: 0, enabled: false, channel: CHANNEL_MAP.FAN_SPEED + 1 },
    ledMatrix: {
      r: 255,
      g: 255,
      b: 255,
      brightness: 128,
      pattern: 0,
      enabled: false,
      channels: {
        r: CHANNEL_MAP.LED_MATRIX_R + 1,
        g: CHANNEL_MAP.LED_MATRIX_G + 1,
        b: CHANNEL_MAP.LED_MATRIX_B + 1,
        brightness: CHANNEL_MAP.LED_MATRIX_BRIGHTNESS + 1,
        pattern: CHANNEL_MAP.LED_MATRIX_PATTERN + 1,
      },
    },
    ledStrips: {
      strip1: {
        r: 255,
        g: 255,
        b: 255,
        brightness: 128,
        enabled: false,
        channels: {
          r: CHANNEL_MAP.LED_STRIP1_R + 1,
          g: CHANNEL_MAP.LED_STRIP1_G + 1,
          b: CHANNEL_MAP.LED_STRIP1_B + 1,
          brightness: CHANNEL_MAP.LED_STRIP1_BRIGHTNESS + 1,
        },
      },
      strip2: {
        r: 255,
        g: 255,
        b: 255,
        brightness: 128,
        enabled: false,
        channels: {
          r: CHANNEL_MAP.LED_STRIP2_R + 1,
          g: CHANNEL_MAP.LED_STRIP2_G + 1,
          b: CHANNEL_MAP.LED_STRIP2_B + 1,
          brightness: CHANNEL_MAP.LED_STRIP2_BRIGHTNESS + 1,
        },
      },
    },
    disc: { speed: 0, direction: "stop", enabled: false, channel: CHANNEL_MAP.DISC_SPEED + 1 },
    painFader: { position: 0, dmxValue: 0, channel: CHANNEL_MAP.PAIN_FADER + 1 },
  };

  private socket: dgram.Socket | null = null;
  private artnetConnected = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastSendTime = 0;

  constructor() {
    this.initSocket();
    this.startRefresh();
  }

  private initSocket() {
    try {
      if (this.socket) {
        this.socket.close();
      }
      this.socket = dgram.createSocket("udp4");
      this.socket.bind(() => {
        this.socket?.setBroadcast(true);
        logger.info({ host: this.config.host }, "Art-Net socket ready");
        this.artnetConnected = true;
      });
      this.socket.on("error", (err) => {
        logger.warn({ err }, "Art-Net socket error");
        this.artnetConnected = false;
      });
    } catch (err) {
      logger.warn({ err }, "Failed to init Art-Net socket");
      this.artnetConnected = false;
    }
  }

  private buildArtDmxPacket(): Buffer {
    const numChannels = Math.max(18, 2);
    const length = numChannels % 2 === 0 ? numChannels : numChannels + 1;
    const buf = Buffer.alloc(18 + length, 0);

    buf.write("Art-Net\0", 0, "ascii");
    buf.writeUInt16LE(0x5000, 8);
    buf.writeUInt16BE(14, 10);
    buf[12] = 0;
    buf[13] = 0;
    buf.writeUInt16LE(this.config.universe & 0x7fff, 14);
    buf.writeUInt16BE(length, 16);

    for (let i = 0; i < length; i++) {
      buf[18 + i] = this.channels[i] ?? 0;
    }

    return buf;
  }

  private sendArtNet() {
    if (!this.socket || !this.artnetConnected) return;
    const packet = this.buildArtDmxPacket();
    this.socket.send(packet, 0, packet.length, this.config.port, this.config.host, (err) => {
      if (err) {
        logger.debug({ err }, "Art-Net send error");
        this.artnetConnected = false;
      } else {
        this.artnetConnected = true;
        this.lastSendTime = Date.now();
      }
    });
  }

  private startRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    const intervalMs = Math.round(1000 / this.config.refreshRate);
    this.refreshTimer = setInterval(() => {
      this.sendArtNet();
    }, intervalMs);
  }

  private syncChannels() {
    const { fan, ledMatrix, ledStrips, disc, painFader } = this.state;

    this.channels[CHANNEL_MAP.FAN_SPEED] = fan.enabled ? fan.speed : 0;

    this.channels[CHANNEL_MAP.LED_MATRIX_R] = ledMatrix.enabled ? ledMatrix.r : 0;
    this.channels[CHANNEL_MAP.LED_MATRIX_G] = ledMatrix.enabled ? ledMatrix.g : 0;
    this.channels[CHANNEL_MAP.LED_MATRIX_B] = ledMatrix.enabled ? ledMatrix.b : 0;
    this.channels[CHANNEL_MAP.LED_MATRIX_BRIGHTNESS] = ledMatrix.enabled ? ledMatrix.brightness : 0;
    this.channels[CHANNEL_MAP.LED_MATRIX_PATTERN] = ledMatrix.enabled ? ledMatrix.pattern : 0;

    const s1 = ledStrips.strip1;
    this.channels[CHANNEL_MAP.LED_STRIP1_R] = s1.enabled ? s1.r : 0;
    this.channels[CHANNEL_MAP.LED_STRIP1_G] = s1.enabled ? s1.g : 0;
    this.channels[CHANNEL_MAP.LED_STRIP1_B] = s1.enabled ? s1.b : 0;
    this.channels[CHANNEL_MAP.LED_STRIP1_BRIGHTNESS] = s1.enabled ? s1.brightness : 0;

    const s2 = ledStrips.strip2;
    this.channels[CHANNEL_MAP.LED_STRIP2_R] = s2.enabled ? s2.r : 0;
    this.channels[CHANNEL_MAP.LED_STRIP2_G] = s2.enabled ? s2.g : 0;
    this.channels[CHANNEL_MAP.LED_STRIP2_B] = s2.enabled ? s2.b : 0;
    this.channels[CHANNEL_MAP.LED_STRIP2_BRIGHTNESS] = s2.enabled ? s2.brightness : 0;

    this.channels[CHANNEL_MAP.DISC_SPEED] = disc.enabled ? disc.speed : 0;
    this.channels[CHANNEL_MAP.DISC_DIRECTION] = disc.enabled ? DIRECTION_DMX[disc.direction] ?? 0 : 0;

    this.channels[CHANNEL_MAP.PAIN_FADER] = painFader.dmxValue;
  }

  getState(): DmxState {
    return {
      ...this.state,
      channels: [...this.channels],
      artnetConnected: this.artnetConnected,
    };
  }

  getConfig(): DmxConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DmxConfig>): DmxConfig {
    this.config = { ...this.config, ...updates };
    this.initSocket();
    this.startRefresh();
    return { ...this.config };
  }

  setMode(mode: "idle" | "experience"): DmxState {
    this.state.mode = mode;
    this.syncChannels();
    return this.getState();
  }

  setFan(updates: { speed?: number; enabled?: boolean }): DmxState {
    if (updates.speed !== undefined) this.state.fan.speed = clamp(updates.speed, 0, 255);
    if (updates.enabled !== undefined) this.state.fan.enabled = updates.enabled;
    this.syncChannels();
    return this.getState();
  }

  setLedMatrix(updates: {
    r?: number;
    g?: number;
    b?: number;
    brightness?: number;
    pattern?: number;
    enabled?: boolean;
  }): DmxState {
    const m = this.state.ledMatrix;
    if (updates.r !== undefined) m.r = clamp(updates.r, 0, 255);
    if (updates.g !== undefined) m.g = clamp(updates.g, 0, 255);
    if (updates.b !== undefined) m.b = clamp(updates.b, 0, 255);
    if (updates.brightness !== undefined) m.brightness = clamp(updates.brightness, 0, 255);
    if (updates.pattern !== undefined) m.pattern = clamp(updates.pattern, 0, 255);
    if (updates.enabled !== undefined) m.enabled = updates.enabled;
    this.syncChannels();
    return this.getState();
  }

  setLedStrips(updates: {
    strip1?: { r?: number; g?: number; b?: number; brightness?: number; enabled?: boolean };
    strip2?: { r?: number; g?: number; b?: number; brightness?: number; enabled?: boolean };
    sync?: boolean;
  }): DmxState {
    const applyToStrip = (
      strip: LedStripState,
      u: { r?: number; g?: number; b?: number; brightness?: number; enabled?: boolean }
    ) => {
      if (u.r !== undefined) strip.r = clamp(u.r, 0, 255);
      if (u.g !== undefined) strip.g = clamp(u.g, 0, 255);
      if (u.b !== undefined) strip.b = clamp(u.b, 0, 255);
      if (u.brightness !== undefined) strip.brightness = clamp(u.brightness, 0, 255);
      if (u.enabled !== undefined) strip.enabled = u.enabled;
    };

    if (updates.sync && updates.strip1) {
      applyToStrip(this.state.ledStrips.strip1, updates.strip1);
      applyToStrip(this.state.ledStrips.strip2, updates.strip1);
    } else {
      if (updates.strip1) applyToStrip(this.state.ledStrips.strip1, updates.strip1);
      if (updates.strip2) applyToStrip(this.state.ledStrips.strip2, updates.strip2);
    }
    this.syncChannels();
    return this.getState();
  }

  setDisc(updates: { speed?: number; direction?: "cw" | "ccw" | "stop"; enabled?: boolean }): DmxState {
    if (updates.speed !== undefined) this.state.disc.speed = clamp(updates.speed, 0, 255);
    if (updates.direction !== undefined) this.state.disc.direction = updates.direction;
    if (updates.enabled !== undefined) this.state.disc.enabled = updates.enabled;
    this.syncChannels();
    return this.getState();
  }

  setPainFader(position: number): DmxState {
    const pos = clamp(Math.round(position), 0, 4);
    this.state.painFader.position = pos;
    this.state.painFader.dmxValue = PAIN_FADER_DMX[pos] ?? 0;
    this.syncChannels();
    return this.getState();
  }

  loadScene(scene: "idle" | "warmup" | "experience_low" | "experience_mid" | "experience_high" | "blackout"): DmxState {
    switch (scene) {
      case "idle":
        this.state.mode = "idle";
        this.state.fan = { ...this.state.fan, speed: 0, enabled: false };
        this.state.ledMatrix = { ...this.state.ledMatrix, r: 255, g: 200, b: 120, brightness: 60, pattern: 0, enabled: true };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, r: 255, g: 200, b: 120, brightness: 50, enabled: true };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, r: 255, g: 200, b: 120, brightness: 50, enabled: true };
        this.state.disc = { ...this.state.disc, speed: 30, direction: "cw", enabled: true };
        this.state.painFader = { ...this.state.painFader, position: 0, dmxValue: PAIN_FADER_DMX[0] };
        break;

      case "warmup":
        this.state.mode = "experience";
        this.state.fan = { ...this.state.fan, speed: 80, enabled: true };
        this.state.ledMatrix = { ...this.state.ledMatrix, r: 255, g: 140, b: 0, brightness: 140, pattern: 10, enabled: true };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, r: 255, g: 80, b: 0, brightness: 100, enabled: true };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, r: 255, g: 80, b: 0, brightness: 100, enabled: true };
        this.state.disc = { ...this.state.disc, speed: 80, direction: "cw", enabled: true };
        this.state.painFader = { ...this.state.painFader, position: 1, dmxValue: PAIN_FADER_DMX[1] };
        break;

      case "experience_low":
        this.state.mode = "experience";
        this.state.fan = { ...this.state.fan, speed: 130, enabled: true };
        this.state.ledMatrix = { ...this.state.ledMatrix, r: 200, g: 0, b: 255, brightness: 180, pattern: 30, enabled: true };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, r: 200, g: 0, b: 200, brightness: 150, enabled: true };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, r: 200, g: 0, b: 200, brightness: 150, enabled: true };
        this.state.disc = { ...this.state.disc, speed: 130, direction: "cw", enabled: true };
        this.state.painFader = { ...this.state.painFader, position: 2, dmxValue: PAIN_FADER_DMX[2] };
        break;

      case "experience_mid":
        this.state.mode = "experience";
        this.state.fan = { ...this.state.fan, speed: 190, enabled: true };
        this.state.ledMatrix = { ...this.state.ledMatrix, r: 255, g: 0, b: 80, brightness: 220, pattern: 60, enabled: true };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, r: 255, g: 0, b: 50, brightness: 200, enabled: true };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, r: 255, g: 0, b: 50, brightness: 200, enabled: true };
        this.state.disc = { ...this.state.disc, speed: 190, direction: "ccw", enabled: true };
        this.state.painFader = { ...this.state.painFader, position: 3, dmxValue: PAIN_FADER_DMX[3] };
        break;

      case "experience_high":
        this.state.mode = "experience";
        this.state.fan = { ...this.state.fan, speed: 255, enabled: true };
        this.state.ledMatrix = { ...this.state.ledMatrix, r: 255, g: 0, b: 0, brightness: 255, pattern: 100, enabled: true };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, r: 255, g: 0, b: 0, brightness: 255, enabled: true };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, r: 255, g: 0, b: 0, brightness: 255, enabled: true };
        this.state.disc = { ...this.state.disc, speed: 255, direction: "ccw", enabled: true };
        this.state.painFader = { ...this.state.painFader, position: 4, dmxValue: PAIN_FADER_DMX[4] };
        break;

      case "blackout":
        this.channels.fill(0);
        this.state.fan = { ...this.state.fan, speed: 0, enabled: false };
        this.state.ledMatrix = { ...this.state.ledMatrix, enabled: false };
        this.state.ledStrips.strip1 = { ...this.state.ledStrips.strip1, enabled: false };
        this.state.ledStrips.strip2 = { ...this.state.ledStrips.strip2, enabled: false };
        this.state.disc = { ...this.state.disc, speed: 0, direction: "stop", enabled: false };
        this.sendArtNet();
        return this.getState();
    }

    this.syncChannels();
    return this.getState();
  }

  blackout(): DmxState {
    return this.loadScene("blackout");
  }

  destroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.socket) this.socket.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const dmxController = new DmxController();
