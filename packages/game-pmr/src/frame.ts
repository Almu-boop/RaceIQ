import { decodePMRDatagram, type PMRRaceInfo, type PMRRaceState, type PMRVehicleTelemetry } from "./protocol";
// Self-contained snapshots retain each datagram byte-for-byte. Every saved lap
// can be replayed without context from an earlier lap or a running UDP source.
export const PMR_FRAME_MAGIC = Buffer.from("RQPMR001", "ascii");
const HEADER_SIZE = 32;
export function encodePMRFrame(race: Buffer, state: Buffer, telemetry: Buffer, timestampMs: number, epoch: number): Buffer {
  if (![race, state, telemetry].every((b) => b.length > 0 && b.length <= 65507) || !Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("Invalid PMR snapshot");
  const frame = Buffer.alloc(HEADER_SIZE + race.length + state.length + telemetry.length);
  PMR_FRAME_MAGIC.copy(frame);
  frame.writeDoubleLE(timestampMs, 8);
  frame.writeUInt32LE(epoch, 16);
  frame.writeUInt32LE(race.length, 20);
  frame.writeUInt32LE(state.length, 24);
  frame.writeUInt32LE(telemetry.length, 28);
  race.copy(frame, 32);
  state.copy(frame, 32 + race.length);
  telemetry.copy(frame, 32 + race.length + state.length);
  return frame;
}
export function decodePMRFrame(frame: Buffer): { race: PMRRaceInfo; state: PMRRaceState; telemetry: PMRVehicleTelemetry; timestampMs: number; epoch: number } | null {
  if (frame.length < HEADER_SIZE || !frame.subarray(0, 8).equals(PMR_FRAME_MAGIC)) return null;
  const timestampMs = frame.readDoubleLE(8);
  const lengths = [frame.readUInt32LE(20), frame.readUInt32LE(24), frame.readUInt32LE(28)];
  if (!Number.isFinite(timestampMs) || timestampMs < 0 || lengths.some((n) => n === 0 || n > 65507) || lengths.reduce((a, b) => a + b, 32) !== frame.length) return null;
  const race = decodePMRDatagram(frame.subarray(32, 32 + lengths[0]!));
  const state = decodePMRDatagram(frame.subarray(32 + lengths[0]!, 32 + lengths[0]! + lengths[1]!));
  const telemetry = decodePMRDatagram(frame.subarray(32 + lengths[0]! + lengths[1]!));
  if (race?.type !== 0 || state?.type !== 1 || telemetry?.type !== 2 || !state.isPlayer || state.vehicleId !== telemetry.vehicleId) return null;
  return { race, state, telemetry, timestampMs, epoch: frame.readUInt32LE(16) };
}
