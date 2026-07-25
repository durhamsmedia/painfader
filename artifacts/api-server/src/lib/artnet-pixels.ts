/**
 * Art-Net pixel sender for Gledopto 2D-EXMU controllers.
 *
 * Each zone is rendered by the pattern engine into a flat RGB buffer
 * and chunked into Art-Net DMX universes (170 pixels = 510 bytes each),
 * then sent as UDP unicast to each Gledopto unit.
 *
 * Universe layout:
 *   Gledopto #1 (haube + schmerz):
 *     universeStart+0 … +ceil(haubePixelCount/170)-1   → haube
 *     universeStart+N … +ceil(schmerzPixelCount/170)-1 → schmerz
 *   Gledopto #2 (nsar + opiat):
 *     universeStart+0 … +ceil(nsarPixelCount/170)-1    → nsar
 *     universeStart+M … +ceil(opiatPixelCount/170)-1   → opiat
 */

import dgram from "node:dgram";
import { logger } from "./logger";
import { ZonePattern, renderPattern } from "./pattern-engine";
import { HardwareConfig } from "./hardware-config";

const PIXELS_PER_UNIVERSE = 170; // 170 × 3 = 510 bytes ≤ 512 DMX slots

export interface PixelZones {
  haube: ZonePattern;
  schmerz: ZonePattern;
  nsar: ZonePattern;
  opiat: ZonePattern;
}

type ZoneName = keyof PixelZones;

export class ArtNetPixelSender {
  private socket: dgram.Socket;
  private connected = false;
  private config: HardwareConfig;
  private zones: PixelZones;
  private timer: NodeJS.Timeout | null = null;
  private lastFrameMs = Date.now();

  /** Phase accumulators [0..1) — one per zone, advanced per frame */
  private phases: Record<ZoneName, number> = { haube: 0, schmerz: 0, nsar: 0, opiat: 0 };

  constructor(config: HardwareConfig, initialZones: PixelZones) {
    this.config = { ...config };
    this.zones  = { ...initialZones };

    this.socket = dgram.createSocket("udp4");
    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      this.connected = true;
      logger.info(
        { g1: config.gledopto1.host, g2: config.gledopto2.host },
        "Art-Net pixel socket ready",
      );
    });
    this.socket.on("error", (err) => {
      logger.warn({ err }, "Art-Net pixel socket error");
      this.connected = false;
    });

    this.startLoop();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  updateZones(zones: Partial<PixelZones>) {
    Object.assign(this.zones, zones);
  }

  updateConfig(config: HardwareConfig) {
    this.config = { ...config };
    this.stopLoop();
    this.startLoop();
  }

  /** Send all-zero pixels immediately (blackout). */
  blackout() {
    const dead: ZonePattern = {
      type: "solid",
      primaryColor: { r: 0, g: 0, b: 0 },
      secondaryColor: { r: 0, g: 0, b: 0 },
      brightness: 0,
      speed: 0,
      enabled: true,
    };
    this.zones = { haube: dead, schmerz: dead, nsar: dead, opiat: dead };
    this.flush();
  }

  get isConnected() { return this.connected; }

  destroy() {
    this.stopLoop();
    try { this.socket.close(); } catch (_) { /* ignore */ }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private startLoop() {
    const intervalMs = Math.round(1000 / Math.max(1, this.config.artnetRefreshRate));
    this.timer = setInterval(() => this.flush(), intervalMs);
  }

  private stopLoop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private flush() {
    if (!this.connected) return;

    const now = Date.now();
    const dt  = Math.min((now - this.lastFrameMs) / 1000, 0.5);
    this.lastFrameMs = now;

    // Advance per-zone phase accumulators
    const ZONES: ZoneName[] = ["haube", "schmerz", "nsar", "opiat"];
    for (const z of ZONES) {
      const hz = (this.zones[z].speed / 255) * 2.0; // 0..2 Hz
      this.phases[z] = (this.phases[z] + hz * dt) % 1;
    }

    const g1 = this.config.gledopto1;
    const g2 = this.config.gledopto2;

    // Gledopto #1: haube then schmerz on consecutive universes
    const haubeUniStart   = g1.universeStart;
    const schmerzUniStart = haubeUniStart + universesNeeded(g1.haubePixelCount);
    this.sendZone(g1.host, haubeUniStart,   "haube",   g1.haubePixelCount);
    this.sendZone(g1.host, schmerzUniStart, "schmerz", g1.schmerzPixelCount);

    // Gledopto #2: nsar then opiat
    const nsarUniStart  = g2.universeStart;
    const opiatUniStart = nsarUniStart + universesNeeded(g2.nsarPixelCount);
    this.sendZone(g2.host, nsarUniStart,  "nsar",  g2.nsarPixelCount);
    this.sendZone(g2.host, opiatUniStart, "opiat", g2.opiatPixelCount);
  }

  private sendZone(
    host: string,
    universeStart: number,
    zone: ZoneName,
    pixelCount: number,
  ) {
    const pixels = renderPattern(this.zones[zone], pixelCount, this.phases[zone]);
    this.sendPixelBuffer(host, universeStart, pixels);
  }

  private sendPixelBuffer(host: string, universeStart: number, pixels: Buffer) {
    const numU = Math.ceil(pixels.length / (PIXELS_PER_UNIVERSE * 3));
    for (let u = 0; u < numU; u++) {
      const offset = u * PIXELS_PER_UNIVERSE * 3;
      const slice  = pixels.subarray(offset, offset + PIXELS_PER_UNIVERSE * 3);
      const pkt    = buildArtDmxPacket(universeStart + u, slice);
      this.socket.send(pkt, 0, pkt.length, this.config.artnetPort, host, (err) => {
        if (err) logger.warn({ err, host }, "Art-Net send error (ignored)");
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function universesNeeded(pixelCount: number): number {
  return Math.ceil(pixelCount / PIXELS_PER_UNIVERSE);
}

function buildArtDmxPacket(universe: number, data: Buffer): Buffer {
  const dmxLen = data.length % 2 === 0 ? data.length : data.length + 1;
  const pkt    = Buffer.alloc(18 + dmxLen, 0);
  pkt.write("Art-Net\0", 0, "ascii");
  pkt.writeUInt16LE(0x5000, 8);          // OpDmx
  pkt.writeUInt16BE(14, 10);             // protocol version 14
  pkt[12] = 0; pkt[13] = 0;             // sequence, physical
  pkt.writeUInt16LE(universe & 0x7fff, 14);
  pkt.writeUInt16BE(dmxLen, 16);
  data.copy(pkt, 18);
  return pkt;
}
