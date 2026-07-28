/**
 * VideoController — drives mpv via IPC socket for HDMI video output.
 *
 * Video state machine:
 *   idle        → idle loop          (Wartezustand)
 *   start       → intro video once   (Startknopf gedrückt)
 *     └─ auto → prompt_nsar          (wenn intro endet)
 *   prompt_nsar → "Hebel links" loop (bis NSAR-Hebel)
 *   nsar        → NSAR video loop    (Hebel −1)
 *   opiat       → Opiat video loop   (Hebel +1)
 *   schmerz     → Rückkehr-Video     (Hebel 0 während Experience)
 *
 * mpv is controlled via Unix domain socket (JSON IPC).
 * Falls back to simulation mode if mpv is not installed.
 *
 * Giada output: mpv --vo=drm runs directly on the framebuffer.
 * Set videoDisplay: "gpu" in config to switch to X11/Wayland mode.
 */

import { spawn, ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoState =
  | "idle"
  | "start"
  | "prompt_nsar"
  | "nsar"
  | "opiat"
  | "schmerz";

export interface VideoFiles {
  idle:        string;   // filename inside videoDir
  start:       string;
  promptNsar:  string;
  nsar:        string;
  opiat:       string;
  schmerz:     string;
}

export interface VideoConfig {
  /** If false the controller does nothing (no mpv spawned). */
  enabled:    boolean;
  /** Absolute path to the directory that holds the video files. */
  videoDir:   string;
  /** Unix socket path for mpv JSON IPC. */
  ipcSocket:  string;
  /**
   * Video output backend for mpv.
   *   "drm"  — direct rendering, no display server needed (default, Giada bare-metal)
   *   "gpu"  — GPU-accelerated, requires X11 / Wayland
   */
  display:    "drm" | "gpu";
  files:      VideoFiles;
}

export interface VideoStatus {
  simulated: boolean;
  state:     VideoState;
  mpvPid:    number | null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  enabled:   true,
  videoDir:  "/home/painfader/videos",
  ipcSocket: "/tmp/mpv-painfader.sock",
  display:   "drm",
  files: {
    idle:       "idle.mp4",
    start:      "start.mp4",
    promptNsar: "prompt-nsar.mp4",
    nsar:       "nsar.mp4",
    opiat:      "opiat.mp4",
    schmerz:    "schmerz.mp4",
  },
};

// ─── Controller ───────────────────────────────────────────────────────────────

export class VideoController {
  private cfg:           VideoConfig;
  private proc:          ChildProcess | null = null;
  private ipcClient:     net.Socket | null = null;
  private ipcConnected = false;
  private ipcBuffer    = "";
  private state:         VideoState = "idle";
  private simulated    = true;
  private ipcRetries   = 0;
  private destroyed    = false;

  constructor(cfg: VideoConfig) {
    this.cfg = cfg;
    if (cfg.enabled) {
      this.spawnMpv();
    } else {
      logger.info("VideoController: disabled in config — simulation mode");
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Transition to a new video state. No-op if already in that state. */
  setState(newState: VideoState) {
    if (newState === this.state) return;
    logger.info({ from: this.state, to: newState }, "VideoController: state change");
    this.state = newState;

    if (this.simulated) return; // In simulation mode just track state

    switch (newState) {
      case "idle":
        this.loadFile("idle", true);
        break;
      case "start":
        this.loadFile("start", false); // plays once → IPC end-file → prompt_nsar
        break;
      case "prompt_nsar":
        this.loadFile("promptNsar", true);
        break;
      case "nsar":
        this.loadFile("nsar", true);
        break;
      case "opiat":
        this.loadFile("opiat", true);
        break;
      case "schmerz":
        this.loadFile("schmerz", true);
        break;
    }
  }

  getStatus(): VideoStatus {
    return {
      simulated: this.simulated,
      state:     this.state,
      mpvPid:    this.proc?.pid ?? null,
    };
  }

  destroy() {
    this.destroyed = true;
    this.ipcClient?.destroy();
    this.ipcClient = null;
    try { this.proc?.kill("SIGTERM"); } catch (_) { /* ignore */ }
    this.proc = null;
    logger.info("VideoController: destroyed");
  }

  // ── mpv spawn ───────────────────────────────────────────────────────────────

  private spawnMpv() {
    // Remove stale socket
    try {
      const fs = require("fs") as typeof import("fs");
      if (fs.existsSync(this.cfg.ipcSocket)) fs.unlinkSync(this.cfg.ipcSocket);
    } catch (_) { /* ignore */ }

    const voArgs: string[] =
      this.cfg.display === "drm"
        ? ["--vo=drm", "--drm-connector=HDMI-A-1"]
        : ["--vo=gpu"];

    const args = [
      ...voArgs,
      "--fullscreen",
      "--no-osc",
      "--no-osd-bar",
      "--no-osd-scale",
      "--no-input-default-bindings",
      "--no-terminal",
      `--input-ipc-server=${this.cfg.ipcSocket}`,
      "--loop-file=inf",              // start in loop mode (overridden per-file)
      this.filePath("idle"),
    ];

    logger.info({ args }, "VideoController: spawning mpv");

    this.proc = spawn("mpv", args, {
      stdio: "ignore",
      detached: false,
      env: { ...process.env },
    });

    this.proc.on("error", (err: Error) => {
      logger.warn({ err }, "VideoController: mpv spawn error — simulation mode");
      this.simulated = true;
    });

    this.proc.on("spawn", () => {
      logger.info({ pid: this.proc?.pid }, "VideoController: mpv process started");
      this.simulated = false;
      // Give mpv time to create the socket
      setTimeout(() => this.connectIpc(), 1500);
    });

    this.proc.on("exit", (code) => {
      if (!this.destroyed) {
        logger.warn({ code }, "VideoController: mpv exited unexpectedly — restarting in 3 s");
        setTimeout(() => this.spawnMpv(), 3000);
      }
    });
  }

  // ── IPC connection ──────────────────────────────────────────────────────────

  private connectIpc() {
    if (this.destroyed) return;

    this.ipcClient = net.createConnection(this.cfg.ipcSocket);

    this.ipcClient.on("connect", () => {
      this.ipcConnected = true;
      this.ipcRetries   = 0;
      logger.info("VideoController: IPC socket connected");
      // Observe end-file events
      this.sendCommand({ command: ["observe_property", 1, "playback-time"] });
    });

    this.ipcClient.on("data", (buf: Buffer) => {
      this.ipcBuffer += buf.toString();
      const lines = this.ipcBuffer.split("\n");
      this.ipcBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.handleEvent(JSON.parse(line));
        } catch (_) { /* not JSON, skip */ }
      }
    });

    this.ipcClient.on("error", (err: Error) => {
      if (this.ipcRetries < 10) {
        this.ipcRetries++;
        logger.debug({ err, attempt: this.ipcRetries }, "VideoController: IPC connect error, retrying");
        setTimeout(() => this.connectIpc(), 500);
      } else {
        logger.warn({ err }, "VideoController: IPC socket failed after 10 retries");
      }
    });

    this.ipcClient.on("close", () => {
      this.ipcConnected = false;
      if (!this.destroyed) {
        setTimeout(() => this.connectIpc(), 1000);
      }
    });
  }

  // ── IPC event handling ──────────────────────────────────────────────────────

  private handleEvent(msg: Record<string, unknown>) {
    if (msg["event"] === "end-file" && this.state === "start") {
      // Intro video ended → automatically advance to "please move lever" loop
      logger.info("VideoController: start video ended → prompt_nsar");
      this.state = "prompt_nsar";
      this.loadFile("promptNsar", true);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private filePath(key: keyof VideoFiles): string {
    return path.join(this.cfg.videoDir, this.cfg.files[key]);
  }

  private loadFile(key: keyof VideoFiles, loop: boolean) {
    const fp = this.filePath(key);
    // loadfile replaces current file; "replace" mode starts immediately
    this.sendCommand({ command: ["loadfile", fp, "replace"] });
    // Set loop after a brief tick so mpv has accepted the file
    setTimeout(() => {
      this.sendCommand({ command: ["set_property", "loop-file", loop ? "inf" : "no"] });
    }, 150);
  }

  private sendCommand(cmd: object) {
    if (!this.ipcConnected || !this.ipcClient) return;
    try {
      this.ipcClient.write(JSON.stringify(cmd) + "\n");
    } catch (err) {
      logger.debug({ err }, "VideoController: IPC write error");
    }
  }
}
