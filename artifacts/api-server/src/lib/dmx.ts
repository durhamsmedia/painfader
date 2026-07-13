import dgram from "node:dgram";
import { logger } from "./logger";

export interface DmxConfig {
  host: string;
  universe: number;
  port: number;
  refreshRate: number;
}

export interface FaderPreset {
  name: string;
  fan: { speed: number; enabled: boolean };
  ledMatrix: { r: number; g: number; b: number; brightness: number; pattern: number; enabled: boolean };
  ledStrip1: { r: number; g: number; b: number; brightness: number; enabled: boolean };
  ledStrip2: { r: number; g: number; b: number; brightness: number; enabled: boolean };
  disc: { speed: number; direction: "cw" | "ccw" | "stop"; enabled: boolean };
}

export interface PresetsState {
  positions: FaderPreset[];
  idlePreset: FaderPreset;
  idleTimerSeconds: number;
  idleTimerEnabled: boolean;
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
  idleTimer: {
    enabled: boolean;
    timerSeconds: number;
    remaining: number | null;
    triggered: boolean;
  };
  hardwareLastSeen: number | null;
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

function makeDefaultPreset(name: string, overrides: Partial<FaderPreset> = {}): FaderPreset {
  return {
    name,
    fan: { speed: 0, enabled: false },
    ledMatrix: { r: 255, g: 255, b: 255, brightness: 100, pattern: 0, enabled: true },
    ledStrip1: { r: 255, g: 255, b: 255, brightness: 100, enabled: true },
    ledStrip2: { r: 255, g: 255, b: 255, brightness: 100, enabled: true },
    disc: { speed: 0, direction: "stop", enabled: false },
    ...overrides,
  };
}

const DEFAULT_PRESETS: FaderPreset[] = [
  makeDefaultPreset("SCHMERZ MAX", {
    fan: { speed: 255, enabled: true },
    ledMatrix: { r: 255, g: 0, b: 0, brightness: 255, pattern: 0, enabled: true },
    ledStrip1: { r: 255, g: 0, b: 0, brightness: 255, enabled: true },
    ledStrip2: { r: 255, g: 0, b: 0, brightness: 255, enabled: true },
    disc: { speed: 200, direction: "ccw", enabled: true },
  }),
  makeDefaultPreset("OPIOID LOW", {
    fan: { speed: 180, enabled: true },
    ledMatrix: { r: 200, g: 60, b: 255, brightness: 200, pattern: 0, enabled: true },
    ledStrip1: { r: 180, g: 40, b: 255, brightness: 180, enabled: true },
    ledStrip2: { r: 180, g: 40, b: 255, brightness: 180, enabled: true },
    disc: { speed: 150, direction: "cw", enabled: true },
  }),
  makeDefaultPreset("OPIOID HIGH", {
    fan: { speed: 120, enabled: true },
    ledMatrix: { r: 80, g: 120, b: 255, brightness: 160, pattern: 0, enabled: true },
    ledStrip1: { r: 60, g: 100, b: 255, brightness: 140, enabled: true },
    ledStrip2: { r: 60, g: 100, b: 255, brightness: 140, enabled: true },
    disc: { speed: 100, direction: "cw", enabled: true },
  }),
  makeDefaultPreset("NSAR LOW", {
    fan: { speed: 80, enabled: true },
    ledMatrix: { r: 0, g: 200, b: 120, brightness: 130, pattern: 0, enabled: true },
    ledStrip1: { r: 0, g: 180, b: 100, brightness: 120, enabled: true },
    ledStrip2: { r: 0, g: 180, b: 100, brightness: 120, enabled: true },
    disc: { speed: 70, direction: "cw", enabled: true },
  }),
  makeDefaultPreset("NSAR HIGH", {
    fan: { speed: 40, enabled: true },
    ledMatrix: { r: 0, g: 255, b: 60, brightness: 100, pattern: 0, enabled: true },
    ledStrip1: { r: 0, g: 220, b: 40, brightness: 90, enabled: true },
    ledStrip2: { r: 0, g: 220, b: 40, brightness: 90, enabled: true },
    disc: { speed: 40, direction: "cw", enabled: true },
  }),
];

const DEFAULT_IDLE_PRESET: FaderPreset = makeDefaultPreset("IDLE", {
  fan: { speed: 0, enabled: false },
  ledMatrix: { r: 255, g: 200, b: 100, brightness: 60, pattern: 0, enabled: true },
  ledStrip1: { r: 255, g: 180, b: 80, brightness: 50, enabled: true },
  ledStrip2: { r: 255, g: 180, b: 80, brightness: 50, enabled: true },
  disc: { speed: 30, direction: "cw", enabled: true },
});

class DmxController {
  private channels: number[] = new Array(512).fill(0);
  private config: DmxConfig = {
    host: "255.255.255.255",
    universe: 0,
    port: 6454,
    refreshRate: 44,
  };

  private state: Omit<DmxState, "channels" | "artnetConnected" | "idleTimer" | "hardwareLastSeen"> = {
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

  private presets: FaderPreset[] = DEFAULT_PRESETS.map((p) => ({ ...p }));
  private idlePreset: FaderPreset = { ...DEFAULT_IDLE_PRESET };
  private idleTimerSeconds = 30;
  private idleTimerEnabled = true;

  private idleTimerHandle: NodeJS.Timeout | null = null;
  private idleTimerStart: number | null = null;
  private idleTimerTriggered = false;

  private socket: dgram.Socket | null = null;
  private artnetConnected = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private hardwareLastSeen: number | null = null;

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

  private applyPreset(preset: FaderPreset) {
    const s = this.state;
    s.fan = { ...s.fan, speed: preset.fan.speed, enabled: preset.fan.enabled };
    s.ledMatrix = {
      ...s.ledMatrix,
      r: preset.ledMatrix.r,
      g: preset.ledMatrix.g,
      b: preset.ledMatrix.b,
      brightness: preset.ledMatrix.brightness,
      pattern: preset.ledMatrix.pattern,
      enabled: preset.ledMatrix.enabled,
    };
    s.ledStrips.strip1 = {
      ...s.ledStrips.strip1,
      r: preset.ledStrip1.r,
      g: preset.ledStrip1.g,
      b: preset.ledStrip1.b,
      brightness: preset.ledStrip1.brightness,
      enabled: preset.ledStrip1.enabled,
    };
    s.ledStrips.strip2 = {
      ...s.ledStrips.strip2,
      r: preset.ledStrip2.r,
      g: preset.ledStrip2.g,
      b: preset.ledStrip2.b,
      brightness: preset.ledStrip2.brightness,
      enabled: preset.ledStrip2.enabled,
    };
    s.disc = {
      ...s.disc,
      speed: preset.disc.speed,
      direction: preset.disc.direction,
      enabled: preset.disc.enabled,
    };
    this.syncChannels();
  }

  private captureCurrentAsPreset(name: string): FaderPreset {
    const s = this.state;
    return {
      name,
      fan: { speed: s.fan.speed, enabled: s.fan.enabled },
      ledMatrix: {
        r: s.ledMatrix.r,
        g: s.ledMatrix.g,
        b: s.ledMatrix.b,
        brightness: s.ledMatrix.brightness,
        pattern: s.ledMatrix.pattern,
        enabled: s.ledMatrix.enabled,
      },
      ledStrip1: {
        r: s.ledStrips.strip1.r,
        g: s.ledStrips.strip1.g,
        b: s.ledStrips.strip1.b,
        brightness: s.ledStrips.strip1.brightness,
        enabled: s.ledStrips.strip1.enabled,
      },
      ledStrip2: {
        r: s.ledStrips.strip2.r,
        g: s.ledStrips.strip2.g,
        b: s.ledStrips.strip2.b,
        brightness: s.ledStrips.strip2.brightness,
        enabled: s.ledStrips.strip2.enabled,
      },
      disc: {
        speed: s.disc.speed,
        direction: s.disc.direction,
        enabled: s.disc.enabled,
      },
    };
  }

  private stopIdleTimer() {
    if (this.idleTimerHandle) {
      clearTimeout(this.idleTimerHandle);
      this.idleTimerHandle = null;
    }
    this.idleTimerStart = null;
    this.idleTimerTriggered = false;
  }

  private startIdleTimer() {
    this.stopIdleTimer();
    if (!this.idleTimerEnabled) return;
    this.idleTimerStart = Date.now();
    this.idleTimerTriggered = false;
    this.idleTimerHandle = setTimeout(() => {
      logger.info({ timerSeconds: this.idleTimerSeconds }, "Idle timer fired — applying idle preset");
      this.idleTimerTriggered = true;
      this.state.mode = "idle";
      this.applyPreset(this.idlePreset);
      this.idleTimerHandle = null;
    }, this.idleTimerSeconds * 1000);
  }

  getIdleTimerRemaining(): number | null {
    if (!this.idleTimerHandle || this.idleTimerStart === null) return null;
    const elapsed = (Date.now() - this.idleTimerStart) / 1000;
    return Math.max(0, this.idleTimerSeconds - elapsed);
  }

  getState(): DmxState {
    return {
      ...this.state,
      channels: [...this.channels],
      artnetConnected: this.artnetConnected,
      idleTimer: {
        enabled: this.idleTimerEnabled,
        timerSeconds: this.idleTimerSeconds,
        remaining: this.getIdleTimerRemaining(),
        triggered: this.idleTimerTriggered,
      },
      hardwareLastSeen: this.hardwareLastSeen,
    };
  }

  getConfig(): DmxConfig {
    return { ...this.config };
  }

  getPresets(): PresetsState {
    return {
      positions: this.presets.map((p) => ({ ...p })),
      idlePreset: { ...this.idlePreset },
      idleTimerSeconds: this.idleTimerSeconds,
      idleTimerEnabled: this.idleTimerEnabled,
    };
  }

  updateConfig(updates: Partial<DmxConfig>): DmxConfig {
    this.config = { ...this.config, ...updates };
    this.initSocket();
    this.startRefresh();
    return { ...this.config };
  }

  updatePreset(position: string, updates: Partial<FaderPreset>): PresetsState {
    if (position === "idle") {
      this.idlePreset = { ...this.idlePreset, ...updates };
      if (updates.fan) this.idlePreset.fan = { ...this.idlePreset.fan, ...updates.fan };
      if (updates.ledMatrix) this.idlePreset.ledMatrix = { ...this.idlePreset.ledMatrix, ...updates.ledMatrix };
      if (updates.ledStrip1) this.idlePreset.ledStrip1 = { ...this.idlePreset.ledStrip1, ...updates.ledStrip1 };
      if (updates.ledStrip2) this.idlePreset.ledStrip2 = { ...this.idlePreset.ledStrip2, ...updates.ledStrip2 };
      if (updates.disc) this.idlePreset.disc = { ...this.idlePreset.disc, ...updates.disc };
    } else {
      const pos = parseInt(position, 10);
      if (isNaN(pos) || pos < 0 || pos > 4) return this.getPresets();
      const existing = this.presets[pos];
      this.presets[pos] = {
        ...existing,
        ...updates,
        fan: updates.fan ? { ...existing.fan, ...updates.fan } : existing.fan,
        ledMatrix: updates.ledMatrix ? { ...existing.ledMatrix, ...updates.ledMatrix } : existing.ledMatrix,
        ledStrip1: updates.ledStrip1 ? { ...existing.ledStrip1, ...updates.ledStrip1 } : existing.ledStrip1,
        ledStrip2: updates.ledStrip2 ? { ...existing.ledStrip2, ...updates.ledStrip2 } : existing.ledStrip2,
        disc: updates.disc ? { ...existing.disc, ...updates.disc } : existing.disc,
      };
    }
    return this.getPresets();
  }

  capturePreset(position: string): PresetsState {
    if (position === "idle") {
      const captured = this.captureCurrentAsPreset("IDLE");
      this.idlePreset = { ...captured, name: this.idlePreset.name };
    } else {
      const pos = parseInt(position, 10);
      if (isNaN(pos) || pos < 0 || pos > 4) return this.getPresets();
      const name = this.presets[pos]?.name ?? `POS ${pos}`;
      this.presets[pos] = { ...this.captureCurrentAsPreset(name) };
    }
    return this.getPresets();
  }

  updatePresetTimer(timerSeconds?: number, enabled?: boolean): PresetsState {
    if (timerSeconds !== undefined) this.idleTimerSeconds = Math.max(1, Math.min(3600, timerSeconds));
    if (enabled !== undefined) this.idleTimerEnabled = enabled;
    if (!this.idleTimerEnabled) this.stopIdleTimer();
    return this.getPresets();
  }

  hardwareFaderInput(position: number): DmxState {
    const pos = Math.max(0, Math.min(4, Math.round(position)));
    this.hardwareLastSeen = Date.now();

    this.state.painFader.position = pos;
    this.state.painFader.dmxValue = PAIN_FADER_DMX[pos] ?? 0;

    if (pos === 0) {
      this.startIdleTimer();
    } else {
      this.stopIdleTimer();
      this.state.mode = "experience";
      const preset = this.presets[pos];
      if (preset) this.applyPreset(preset);
    }

    this.syncChannels();
    logger.info({ position: pos }, "Hardware fader input received");
    return this.getState();
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
        this.applyPreset(this.idlePreset);
        this.state.painFader = { ...this.state.painFader, position: 0, dmxValue: PAIN_FADER_DMX[0] };
        break;
      case "warmup":
        this.state.mode = "experience";
        this.applyPreset(this.presets[1]);
        this.state.painFader = { ...this.state.painFader, position: 1, dmxValue: PAIN_FADER_DMX[1] };
        break;
      case "experience_low":
        this.state.mode = "experience";
        this.applyPreset(this.presets[2]);
        this.state.painFader = { ...this.state.painFader, position: 2, dmxValue: PAIN_FADER_DMX[2] };
        break;
      case "experience_mid":
        this.state.mode = "experience";
        this.applyPreset(this.presets[3]);
        this.state.painFader = { ...this.state.painFader, position: 3, dmxValue: PAIN_FADER_DMX[3] };
        break;
      case "experience_high":
        this.state.mode = "experience";
        this.applyPreset(this.presets[4]);
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
    if (this.idleTimerHandle) clearTimeout(this.idleTimerHandle);
    if (this.socket) this.socket.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const dmxController = new DmxController();
