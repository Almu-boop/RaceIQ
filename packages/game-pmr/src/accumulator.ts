import { decodePMRDatagram, type PMRRaceInfo, type PMRRaceState } from "./protocol";
import { encodePMRFrame } from "./frame";
export const PMR_STATE_MAX_AGE_MS = 2000;
/** Retain session metadata until an explicit stop or identity change. Join only the player's fresh race state to vehicle telemetry. AI packets do not refresh it. */
export class PMRAccumulator {
  private race: { value: PMRRaceInfo; raw: Buffer; at: number } | null = null;
  private player: { value: PMRRaceState; raw: Buffer; at: number } | null = null;
  private epoch = 0;
  private lastTelemetryAt: number | null = null;
  reset(): void {
    this.race = null;
    this.player = null;
    this.lastTelemetryAt = null;
    this.epoch++;
  }
  accept(raw: Buffer, now: number): Buffer | null {
    if (!Number.isFinite(now) || now < 0) return null;
    const packet = decodePMRDatagram(raw);
    if (!packet) return null;
    if (packet.type === 3) {
      this.reset();
      return null;
    }
    if (packet.type === 0) {
      const key = (r: PMRRaceInfo) => JSON.stringify([r.version, r.track, r.layout, r.session, r.gameMode, r.duration, r.isLaps]);
      if (packet.state !== 1) {
        this.reset();
        return null;
      }
      if (!this.race || key(this.race.value) !== key(packet)) {
        this.player = null;
        this.epoch++;
      }
      this.race = { value: packet, raw: Buffer.from(raw), at: now };
      return null;
    }
    if (!this.race || now < this.race.at) return null;
    // Versions describe each packet type independently; PMR sends v1 metadata with v2 vehicle telemetry.
    if (packet.type === 1) {
      if (!packet.isPlayer) return null;
      const prev = this.player?.value;
      if (
        prev &&
        (packet.vehicleId !== prev.vehicleId ||
          packet.vehicleName !== prev.vehicleName ||
          packet.currentLap < prev.currentLap ||
          (packet.currentLap === prev.currentLap && packet.currentLapTime + 2 < prev.currentLapTime))
      )
        this.epoch++;
      this.player = { value: packet, raw: Buffer.from(raw), at: now };
      return null;
    }
    if (
      !this.player ||
      packet.vehicleId !== this.player.value.vehicleId ||
      now - this.player.at > PMR_STATE_MAX_AGE_MS ||
      now < this.player.at ||
      this.player.value.dq ||
      this.player.value.sessionFinished ||
      !this.player.value.vehicleName.trim()
    )
      return null;
    if (this.lastTelemetryAt !== null && now - this.lastTelemetryAt > 5000) this.epoch++;
    this.lastTelemetryAt = now;
    return encodePMRFrame(this.race.raw, this.player.raw, raw, now, this.epoch);
  }
}
