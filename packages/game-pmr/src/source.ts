import { createSocket, type Socket } from "node:dgram";
import { networkInterfaces } from "node:os";
import { registerDiscoveredCar } from "@raceiq/backend-core/db/discovered-cars";
import { registerDiscoveredTrack } from "@raceiq/backend-core/db/discovered-tracks";
import { processPacket } from "@raceiq/backend-core/telemetry/live-pipeline";
import { parsePacket } from "@raceiq/backend-core/games/packet-dispatch";
import { normalizePMRFrame } from "./normalizer";
import { PMRAccumulator } from "./accumulator";
import { decodePMRDatagram, PMR_PORT, PMR_MULTICAST_GROUP } from "./protocol";
export interface PMRSourceOptions {
  port?: number;
  multicast?: boolean;
  dispatchRawFrame?: (raw: Buffer, time: number) => Promise<void>;
  registerIdentity?: (packet: NonNullable<ReturnType<typeof normalizePMRFrame>>) => Promise<void>;
}
/** Built-in native UDP receiver, independent of process detection and other connectors. */
export class PMRTelemetrySource {
  private socket: Socket | null = null;
  private readonly accumulator = new PMRAccumulator();
  private pending: Promise<void> | null = null;
  private queued: { raw: Buffer; time: number } | null = null;
  private identityKey = "";
  private received = 0;
  private generation = 0;
  private dropped = 0;
  private rejected = 0;
  private lastWarningAt = 0;
  private diagnostics: ReturnType<typeof setInterval> | null = null;
  private readonly dispatch: NonNullable<PMRSourceOptions["dispatchRawFrame"]>;
  private readonly registerIdentity: NonNullable<PMRSourceOptions["registerIdentity"]>;
  private readonly options: PMRSourceOptions;
  constructor(options: PMRSourceOptions = {}) {
    this.options = options;
    this.dispatch =
      options.dispatchRawFrame ??
      (async (raw, time) => {
        const packet = parsePacket(raw);
        if (packet) await processPacket(packet, raw, time);
      });
    this.registerIdentity =
      options.registerIdentity ??
      (async (packet) => {
        if (!packet.pmr) return;
        await registerDiscoveredCar("pmr", packet.CarOrdinal, packet.pmr.carName);
        await registerDiscoveredTrack("pmr", packet.TrackOrdinal, packet.pmr.trackName);
      });
  }
  start(): void {
    if (this.socket) return;
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    this.socket = socket;
    socket.on("error", (error) => {
      console.error(`[PMR] UDP receiver failed on port ${this.options.port ?? PMR_PORT}: ${error.message}. Check whether another RaceIQ instance is running.`);
      void this.stop();
    });
    socket.on("message", (raw) => this.receive(raw, Date.now()));
    socket.bind(this.options.port ?? PMR_PORT, "0.0.0.0", () => {
      if (this.socket !== socket) return;
      if (this.options.multicast !== false) {
        const addresses = [...new Set(Object.values(networkInterfaces()).flatMap((rows) => (rows ?? []).filter((row) => row.family === "IPv4" && !row.internal).map((row) => row.address)))];
        let joined = 0;
        for (const address of addresses.length ? addresses : [undefined]) {
          try {
            socket.addMembership(PMR_MULTICAST_GROUP, address);
            joined++;
          } catch (error) {
            console.warn(`[PMR] Cannot join multicast on ${address ?? "default interface"}: ${error instanceof Error ? error.message : error}`);
          }
        }
        if (!joined) {
          console.error("[PMR] No multicast interface is available. PMR telemetry cannot connect.");
          void this.stop();
          return;
        }
      }
      console.log(
        `[PMR] Listening for native UDP on port ${socket.address().port}, multicast ${PMR_MULTICAST_GROUP}. Enable UDP telemetry in PMR Settings > Preferences, then enter a driving session.`,
      );
    });
    this.diagnostics = setInterval(() => {
      if (this.received)
        console.log(
          `[PMR] UDP diagnostics: received ${this.received} datagrams; rejected ${this.rejected}; skipped ${this.dropped} readings while processing.  ${this.identityKey ? "Player telemetry detected." : "Waiting for active session, player race state and vehicle telemetry."}`,
        );
    }, 30000);
  }
  get listeningPort(): number | null {
    try {
      return this.socket?.address().port ?? null;
    } catch {
      return null;
    }
  }
  receive(raw: Buffer, time: number): void {
    this.received++;
    let rejectionReason = "Invalid packet header or field values";
    const decoded = decodePMRDatagram(raw, (reason) => {
      rejectionReason = reason;
    });
    if (!decoded) {
      this.rejected++;
      if (time - this.lastWarningAt >= 5000) {
        const version = raw.length >= 3 ? raw.readUInt16LE(1) : "missing";
        console.warn(`[PMR] Rejected UDP datagram: type ${raw[0] ?? "missing"}, protocol ${version}, ${raw.length} bytes. Supports protocols v1/v2 and four-wheel vehicles. ${rejectionReason}.`);
        this.lastWarningAt = time;
      }
      return;
    }
    if (decoded.type === 3 || (decoded.type === 0 && decoded.state !== 1)) {
      this.queued = null;
      this.generation++;
    }
    const frame = this.accumulator.accept(raw, time);
    if (!frame) return;
    // Bound work to the in-flight frame and newest reading if persistence slows.
    if (this.queued) this.dropped++;
    this.queued = { raw: frame, time };
    if (!this.pending)
      this.pending = this.drain().finally(() => {
        this.pending = null;
      });
  }
  async flush(): Promise<void> {
    await this.pending;
  }
  private async drain(): Promise<void> {
    while (this.queued) {
      const generation = this.generation;
      const { raw, time } = this.queued;
      this.queued = null;
      try {
        const packet = normalizePMRFrame(raw);
        if (!packet?.pmr) continue;
        const identity = `${packet.CarOrdinal}:${packet.TrackOrdinal}`;
        if (identity !== this.identityKey) {
          await this.registerIdentity(packet);
          this.identityKey = identity;
          console.log(
            `[PMR] Receiving player telemetry: ${packet.pmr.carName} at ${packet.pmr.trackName}; protocol v${packet.pmr.protocolVersion}. ${packet.pmr.protocolVersion === 2 ? "Native lap times and validity flags are available." : "Lap times are estimated; game lap-validity flags are unavailable."}`,
          );
        }
        if (generation === this.generation) await this.dispatch(raw, time);
      } catch (error) {
        console.error("[PMR] Telemetry dispatch failed:", error);
      }
    }
  }
  async stop(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (this.diagnostics) clearInterval(this.diagnostics);
    this.diagnostics = null;
    if (socket)
      await new Promise<void>((resolve) => {
        try {
          socket.close(() => resolve());
        } catch {
          resolve();
        }
      });
    this.generation++;
    this.queued = null;
    await this.pending;
    this.accumulator.reset();
    this.identityKey = "";
  }
}
