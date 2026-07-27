/**
 * Pixel sender for Gledopto 2D-EXMU controllers.
 *
 * Supports two protocols (selectable via HardwareConfig.pixelProtocol):
 *
 *  • "artnet"  — Art-Net DMX unicast UDP to each Gledopto's IP (port 6454)
 *  • "e131"    — sACN / E1.31 DMX multicast UDP (port 5568, 239.255.U.U)
 *                Works across WiFi-AP / Ethernet simultaneously (IGMP multicast).
 *
 * Universe layout (same for both protocols):
 *   Gledopto #1 (haube1 + haube2 only):
 *     universeStart+0  … → haube  (Matrix 1, GPIO16)
 *     universeStart+N  … → haube2 (Matrix 2, GPIO12)
 *   Elite 2D / schmerzController (IO2):
 *     universeStart+0  … → schmerz (independent device)
 *   Gledopto #2 (nsar + opiat):
 *     universeStart+0 … +ceil(nsarPixelCount/170)-1    → nsar
 *     universeStart+M … +ceil(opiatPixelCount/170)-1   → opiat
 */

import dgram from "node:dgram";
import { randomBytes } from "node:crypto";
import { logger } from "./logger";
import { ZonePattern, renderPattern } from "./pattern-engine";
import { HardwareConfig } from "./hardware-config";

const PIXELS_PER_UNIVERSE = 170; // 170 × 3 = 510 bytes ≤ 512 DMX slots

// DDP (Distributed Display Protocol) — direct byte-offset pixel addressing
const DDP_PORT          = 4048;
const DDP_MAX_DATA_BYTES = 1440; // safe below Ethernet MTU (480 RGB pixels)

/**
 * Build a DDP (Distributed Display Protocol) packet.
 * DDP uses a 10-byte header with a direct byte-offset into the LED buffer,
 * so GPIO16 (offset 0) and GPIO12 (offset 256*3=768) are addressed independently
 * of Art-Net universe boundaries — no 170-pixel alignment issue.
 */
function buildDdpPacket(byteOffset: number, data: Buffer, seqNum: number): Buffer {
  const pkt = Buffer.allocUnsafe(10 + data.length);
  pkt[0] = 0x41;                  // Flags: VER=1 (bit6), PUSH=1 (bit0)
  pkt[1] = seqNum & 0x0f;         // 4-bit rolling sequence (1-15)
  pkt[2] = 0x01;                  // Data type: RGB (3 bytes/pixel)
  pkt[3] = 0x01;                  // Destination ID: default output
  pkt.writeUInt32BE(byteOffset, 4);
  pkt.writeUInt16BE(data.length,  8);
  data.copy(pkt, 10);
  return pkt;
}

// sACN / E1.31 constants
const E131_PORT = 5568;
const E131_MULTICAST_BASE = "239.255"; // base; full = 239.255.(hi).(lo)

export interface PixelZones {
  haube: ZonePattern;
  haube2: ZonePattern;
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
  private phases: Record<ZoneName, number> = { haube: 0, haube2: 0, schmerz: 0, nsar: 0, opiat: 0 };

  /** sACN sequence number, 1-255 wrapping */
  private seqNum = 1;

  /** sACN CID — 16 random bytes, fixed for this process lifetime */
  private readonly cid: Buffer = randomBytes(16);

  constructor(config: HardwareConfig, initialZones: PixelZones) {
    this.config = { ...config };
    this.zones  = { ...initialZones };

    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    // Art-Net spec requires source port 6454; WLED checks remotePort() and drops packets from other ports.
    // Bind to pixelSourceIp (e.g. "2.0.0.10") so broadcasts leave on the correct NIC (enp1s0),
    // not on the default-route NIC (enp2s0). Without this, 255.255.255.255 goes on the wrong interface.
    const bindIp = this.config.pixelSourceIp || undefined;
    this.socket.bind(6454, bindIp, () => {
      this.socket.setBroadcast(true);
      // For E1.31 multicast: also set IP_MULTICAST_IF so multicast packets leave on the right NIC.
      if (this.config.pixelProtocol === "e131" && this.config.pixelSourceIp) {
        try {
          this.socket.setMulticastInterface(this.config.pixelSourceIp);
        } catch (e) {
          logger.warn({ err: e }, "setMulticastInterface failed — multicast may use wrong NIC");
        }
      }
      this.connected = true;
      logger.info(
        { protocol: this.config.pixelProtocol, g1: config.gledopto1.host, sc: config.schmerzController.host, g2: config.gledopto2.host },
        "Pixel socket ready",
      );
    });
    this.socket.on("error", (err) => {
      logger.warn({ err }, "Pixel socket error");
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
    this.zones = { haube: dead, haube2: dead, schmerz: dead, nsar: dead, opiat: dead };
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
    const ZONES: ZoneName[] = ["haube", "haube2", "schmerz", "nsar", "opiat"];
    for (const z of ZONES) {
      const hz = (this.zones[z].speed / 255) * 6.0; // 0..6 Hz
      this.phases[z] = (this.phases[z] + hz * dt) % 1;
    }

    const g1 = this.config.gledopto1;
    const g2 = this.config.gledopto2;
    const sc = this.config.schmerzController;

    // Gledopto #1: haube1 + haube2 as ONE combined 512-pixel buffer so WLED's
    // sequential universe mapping (Universe N → combined pixels N×170..(N+1)×170-1)
    // aligns across the GPIO16→GPIO12 boundary correctly.
    const haubeBuf = Buffer.concat([
      renderPattern(this.zones.haube,  g1.haube1PixelCount,  this.phases.haube),
      renderPattern(this.zones.haube2, g1.haube2PixelCount,  this.phases.haube2),
    ]);
    this.sendPixelBuffer(g1.host, g1.universeStart, haubeBuf);

    // Elite 2D: schmerz-band — uses DDP (Art-Net not supported in this firmware)
    this.sendZone(sc.host, sc.universeStart, "schmerz", sc.schmerzPixelCount, sc.protocol);

    // Gledopto #2: nsar then opiat
    const nsarUniStart  = g2.universeStart;
    const opiatUniStart = nsarUniStart + universesNeeded(g2.nsarPixelCount);
    this.sendZone(g2.host, nsarUniStart,  "nsar",  g2.nsarPixelCount);
    this.sendZone(g2.host, opiatUniStart, "opiat", g2.opiatPixelCount);

    // Advance sACN sequence (wraps 1-255, 0 is reserved)
    this.seqNum = (this.seqNum % 255) + 1;
  }

  private sendZone(
    host: string,
    universeStart: number,
    zone: ZoneName,
    pixelCount: number,
    protocolOverride?: "artnet" | "e131" | "ddp",
  ) {
    const pixels = renderPattern(this.zones[zone], pixelCount, this.phases[zone]);
    this.sendPixelBuffer(host, universeStart, pixels, protocolOverride);
  }

  private sendDdpBuffer(host: string, byteOffset: number, pixels: Buffer) {
    // DDP requires unicast — broadcast (x.x.x.255) is not accepted by WLED's DDP socket.
    // If the configured host is a subnet broadcast, derive unicast by replacing last octet with .1
    const ddpHost = host.endsWith(".255") ? host.replace(/\d+$/, "1") : host;
    for (let i = 0; i < pixels.length; i += DDP_MAX_DATA_BYTES) {
      const chunk = pixels.subarray(i, i + DDP_MAX_DATA_BYTES);
      const pkt   = buildDdpPacket(byteOffset + i, chunk, this.seqNum);
      this.socket.send(pkt, 0, pkt.length, DDP_PORT, ddpHost, (err) => {
        if (err) logger.warn({ err, ddpHost }, "DDP send error (ignored)");
      });
    }
  }

  private sendPixelBuffer(host: string, universeStart: number, pixels: Buffer, protocolOverride?: "artnet" | "e131" | "ddp") {
    const protocol = protocolOverride ?? this.config.pixelProtocol ?? "artnet";

    if (protocol === "ddp") {
      this.sendDdpBuffer(host, 0, pixels);
      return;
    }

    const numU = Math.ceil(pixels.length / (PIXELS_PER_UNIVERSE * 3));

    for (let u = 0; u < numU; u++) {
      const universe = universeStart + u;
      const offset   = u * PIXELS_PER_UNIVERSE * 3;
      const slice    = pixels.subarray(offset, offset + PIXELS_PER_UNIVERSE * 3);

      let pkt: Buffer;
      let destHost: string;
      let destPort: number;

      if (protocol === "e131") {
        // E1.31 universes are 1-based (1-63999); add 1 to convert from 0-based Art-Net numbering.
        const e131Universe = universe + 1;
        pkt      = buildE131Packet(e131Universe, slice, this.seqNum, this.cid);
        destHost = e131MulticastAddress(e131Universe);
        destPort = E131_PORT;
      } else {
        pkt      = buildArtDmxPacket(universe, slice);
        destHost = host;
        destPort = this.config.artnetPort;
      }

      this.socket.send(pkt, 0, pkt.length, destPort, destHost, (err) => {
        if (err) logger.warn({ err, destHost, protocol }, "Pixel send error (ignored)");
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function universesNeeded(pixelCount: number): number {
  return Math.ceil(pixelCount / PIXELS_PER_UNIVERSE);
}

/** Returns the sACN multicast address for a given universe: 239.255.(hi).(lo) */
function e131MulticastAddress(universe: number): string {
  const hi = (universe >> 8) & 0xff;
  const lo = universe & 0xff;
  return `${E131_MULTICAST_BASE}.${hi}.${lo}`;
}

// ── Art-Net ArtDmx packet ─────────────────────────────────────────────────────

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

// ── sACN / E1.31 packet ───────────────────────────────────────────────────────
//
// Reference: ANSI E1.31-2018 §6 (Network Data Transmission)
//
// Packet layout (big-endian unless noted):
//   Root Layer       (offset 0):   38 bytes
//   Framing Layer    (offset 38):  77 bytes
//   DMP Layer        (offset 115): 11 bytes + data
//   Total header:                  126 bytes
//
function buildE131Packet(universe: number, data: Buffer, seq: number, cid: Buffer): Buffer {
  // DMX payload: start code (0x00) + data bytes, padded to even length
  const dmxLen   = data.length % 2 === 0 ? data.length : data.length + 1;
  const propCount = 1 + dmxLen; // start code byte + data
  const totalLen  = 126 + dmxLen;
  const pkt       = Buffer.alloc(totalLen, 0);

  // ── Root Layer ──────────────────────────────────────────────────────────────
  pkt.writeUInt16BE(0x0010, 0);         // Preamble size
  pkt.writeUInt16BE(0x0000, 2);         // Postamble size
  // ACN packet identifier (12 bytes): "ASC-E1.17\0\0\0"
  // A=41 S=53 C=43 -=2d E=45 1=31 .=2e 1=31 7=37 \0\0\0
  Buffer.from("4153432d45312e313700000000", "hex").copy(pkt, 4);
  // Flags + length for Root PDU (from offset 16 to end)
  const rootLen = totalLen - 16;
  pkt.writeUInt16BE(0x7000 | rootLen, 16);
  pkt.writeUInt32BE(0x00000004, 18);    // VECTOR_ROOT_E131_DATA
  cid.copy(pkt, 22);                    // CID (16 bytes)

  // ── Framing Layer ───────────────────────────────────────────────────────────
  const framingLen = totalLen - 38;
  pkt.writeUInt16BE(0x7000 | framingLen, 38);
  pkt.writeUInt32BE(0x00000002, 40);    // VECTOR_E131_DATA_PACKET
  // Source name (64 bytes, null-terminated UTF-8)
  pkt.write("Painfader\0", 44, "utf8");
  pkt[108] = 100;                        // Priority (default 100)
  pkt.writeUInt16BE(0, 109);            // Synchronization address (0 = none)
  pkt[111] = seq & 0xff;                // Sequence number
  pkt[112] = 0x00;                      // Options (no preview, no stream terminated)
  pkt.writeUInt16BE(universe & 0xffff, 113); // Universe (1-based in E1.31; WLED also accepts 0-based)

  // ── DMP Layer ───────────────────────────────────────────────────────────────
  const dmpLen = 11 + dmxLen;
  pkt.writeUInt16BE(0x7000 | dmpLen, 115);
  pkt[117] = 0x02;                      // VECTOR_DMP_SET_PROPERTY
  pkt[118] = 0xa1;                      // Address type: rel, range, octet
  pkt.writeUInt16BE(0x0000, 119);       // First property address (0 = start code)
  pkt.writeUInt16BE(0x0001, 121);       // Address increment
  pkt.writeUInt16BE(propCount, 123);    // Property count (1 start code + data)
  pkt[125] = 0x00;                      // DMX start code
  data.copy(pkt, 126);

  return pkt;
}
