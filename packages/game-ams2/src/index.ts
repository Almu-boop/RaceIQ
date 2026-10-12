import { ams2Adapter } from "@raceiq/game-ams2-metadata/index";
import { LapDetector } from "@raceiq/backend-core/lap-detection/detector";
import type { ServerGameAdapter } from "@raceiq/backend-core/games/types";
import { renderAnalystSchemaForPrompt } from "@raceiq/backend-core/ai/schemas";
import { normalizeAMS2Frame } from "./normalizer";
import { decodeAMS2Frame, isAMS2SessionEndFrame } from "./frame";
import { resolveAMS2LapReset } from "./lap-reset";
import { classifyAMS2PitCycle, resolveAMS2InvalidReason } from "./lap-validity";
function parseDrivingFrame(buffer: Buffer) {
  const frame = decodeAMS2Frame(buffer);
  if (!frame || ![2, 3, 4].includes(frame.memory.readUInt32LE(8))) return null;
  return normalizeAMS2Frame(buffer);
}
export const ams2ServerAdapter: ServerGameAdapter = {
  ...ams2Adapter,
  runtime: {pit: {seedFuelFromHistory: true, seedTireWearFromHistory: true, useDistanceBasedWearCurves: true}, bestLapFromSession: false, requiresTrackCalibration: false, normSuspensionTravelMm: {min: 0, max: 100}},
  processNames: ["AMS2AVX.exe", "AMS2.exe"],
  canHandle: buffer => decodeAMS2Frame(buffer) !== null,
  isSessionEndFrame: isAMS2SessionEndFrame,
  tryParse: parseDrivingFrame,
  tryParseLapIndex: parseDrivingFrame,
  primeParserState: () => {}, createParserState: () => null,
  createLapDetector: options => new LapDetector({...options, bypassPacketRateFilter: true, policy: {
    resolveLapReset: resolveAMS2LapReset,
    resolveLapTime: (_packets, next) => next.LastLap > 0 ? next.LastLap : 0,
    classifyPitCycle: classifyAMS2PitCycle,
    invalidReason: resolveAMS2InvalidReason,
  }}),
  aiSystemPrompt: `You are an Automobilista 2 driving coach. Use only the supplied telemetry. Never infer unavailable slip or setup data. Return JSON matching: ${renderAnalystSchemaForPrompt()}`,
};
