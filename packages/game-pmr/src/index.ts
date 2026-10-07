import { pmrAdapter } from "@raceiq/game-pmr-metadata/index";
import { LapDetector } from "@raceiq/backend-core/lap-detection/detector";
import type { ServerGameAdapter } from "@raceiq/backend-core/games/types";
import { renderAnalystSchemaForPrompt } from "@raceiq/backend-core/ai/schemas";
import { normalizePMRFrame } from "./normalizer";
import { decodePMRFrame } from "./frame";
export const pmrServerAdapter: ServerGameAdapter = {
  ...pmrAdapter,
  runtime: {
    pit: { seedFuelFromHistory: true, seedTireWearFromHistory: false, useDistanceBasedWearCurves: false },
    bestLapFromSession: false,
    requiresTrackCalibration: false,
    normSuspensionTravelMm: { min: 0, max: 100 },
  },
  canHandle: (buffer) => decodePMRFrame(buffer) !== null,
  tryParse: (buffer) => normalizePMRFrame(buffer),
  tryParseLapIndex: (buffer) => normalizePMRFrame(buffer),
  primeParserState: () => {},
  createParserState: () => null,
  createLapDetector: (options) =>
    new LapDetector({
      ...options,
      bypassPacketRateFilter: true,
      policy: {
        // V1 has no official LastLap. Estimate the line-crossing time from samples;
        // never substitute BestLap. The source timestamp is receive time, not game time.
        resolveLapTime: (packets, next) => {
          if ((next.pmr?.lastLapTime ?? 0) > 0) return next.pmr!.lastLapTime!;
          const last = packets.at(-1);
          if (!last) return 0;
          const gap = (next.TimestampMS - last.TimestampMS) / 1000;
          return gap >= 0 && gap <= 2 ? Math.max(last.CurrentLap, last.CurrentLap + gap - next.CurrentLap) : 0;
        },
        classifyPitCycle: (packets, count) => (packets.some((p) => p.pmr?.inPits || p.pmr?.inPitLane) ? "pit lap" : count === 0 ? "outlap" : null),
        invalidReason: (packets) => (packets.some((p) => p.pmr?.disqualified) ? "disqualified" : packets.some((p) => p.pmr?.lapValid === false) ? "invalid lap (PMR)" : null),
      },
    }),
  aiSystemPrompt: `You are a Project Motor Racing driving coach. Use only supplied telemetry. PMR v2 supplies native last-lap time and lap validity when present. PMR v1 lacks them; its completed lap times are estimates. Do not infer tire wear, suspension travel, full setups or orientation. Return JSON matching: ${renderAnalystSchemaForPrompt()}`,
};
