import { describe, expect, spyOn, test } from "bun:test";
import { readAMS2DumpFrames } from "@raceiq/capture-formats/ams2/dump";
import { CapturingDbAdapter } from "@raceiq/backend-core/telemetry/pipeline-ports";
import { registerGame } from "@raceiq/shared/games/registry";
import { ams2ServerAdapter } from "../src/index";
import { AMS2TelemetrySource } from "../src/source";
import { AMS2_MEMORY_SIZE, PARTICIPANT_OFFSET as P, PARTICIPANT_SIZE } from "../src/layout";

registerGame(ams2ServerAdapter);

async function replay(name: string) {
  const db = new CapturingDbAdapter();
  const detector = ams2ServerAdapter.createLapDetector({ db });
  let memory: Buffer | null = null;
  let ended = 0;
  const source = new AMS2TelemetrySource({
    reader: { start() {}, async stop() {}, readLatest: () => memory },
    registerIdentity: async () => {},
    onSessionEnd: async () => { ended++; await detector.finalizeCurrentSession?.(); },
    dispatchRawFrame: async raw => {
      const packet = ams2ServerAdapter.tryParse(raw, null);
      if (packet) await detector.feed(packet);
    },
  });
  const log = spyOn(console, "log").mockImplementation(() => {});
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  let acquisitionTime = 0;
  const clock = spyOn(Date, "now").mockImplementation(() => acquisitionTime);
  try {
    for await (const raw of readAMS2DumpFrames(`${import.meta.dir}/fixtures/${name}.bin.gz`)) {
      memory = raw.subarray(24);
      acquisitionTime = raw.readDoubleLE(8);
      expect(memory.length).toBe(AMS2_MEMORY_SIZE);
      // Committed fixtures must never contain participant names.
      for (let i = 0; i < 64; i++) {
        const start = P + i * PARTICIPANT_SIZE + 1;
        if (memory.subarray(start, start + 64).some(byte => byte !== 0)) throw new Error("Participant name in fixture");
      }
      await source.pollOnce();
    }
    // Finalisation must come from the real menu frame, before artificial EOF handling.
    expect(ended).toBeGreaterThan(0);
    expect(detector.session).toBeNull();
    const messages = log.mock.calls.map(call => call.map(String).join(" "));
    return { db, diagnostics: source.getDiagnostics(), messages };
  } finally {
    await source.stop();
    await detector.finalizeCurrentSession?.();
    log.mockRestore();
    warn.mockRestore();
    clock.mockRestore();
  }
}

const completed = (db: CapturingDbAdapter, sessionId = 1) =>
  db.laps.filter(lap => lap.sessionId === sessionId && lap.invalidReason !== "incomplete");

describe("AMS2 real raw-dump fixtures", () => {
  test("Time Trial preserves timed laps and classifies both untimed crossings", async () => {
    const { db, messages } = await replay("time-trial");
    expect(db.sessions.map(s => s.sessionType)).toEqual(["practice"]);
    const laps = completed(db);
    expect(laps.map(l => l.invalidReason)).toEqual(["outlap", null, null]);
    expect(laps.map(l => l.lapTime.toFixed(3))).toEqual(["50.460", "52.080", "51.300"]);
    expect(messages.filter(m => m.includes("Untimed start-line crossing"))).toHaveLength(2);
    expect(messages.filter(m => m.includes("Race restart detected"))).toHaveLength(0);
  });

  test("race grid-start is valid while actual pit laps and cooldown remain excluded", async () => {
    const { db } = await replay("race-pit-stop");
    expect(db.sessions.map(s => s.sessionType)).toEqual(["race"]);
    expect(completed(db).map(l => l.invalidReason)).toEqual([null, null, "inlap", "outlap", null]);
    expect(completed(db).map(l => l.lapTime.toFixed(3))).toEqual(["84.850", "72.645", "112.819", "70.170", "66.820"]);
    expect(db.laps.at(-1)?.invalidReason).toBe("incomplete");
  });

  test("healthy qualifying retains three valid timed laps", async () => {
    const { db, diagnostics } = await replay("qualifying");
    expect(db.sessions.map(s => s.sessionType)).toEqual(["qualifying", "race"]);
    expect(completed(db).map(l => l.invalidReason)).toEqual(["outlap", null, null, null]);
    expect(completed(db).map(l => l.lapTime.toFixed(3))).toEqual(["65.396", "65.371", "65.738", "65.478"]);
    expect(diagnostics.staleTransition).toBe(1);
    expect(db.laps.at(-1)?.invalidReason).toBe("incomplete");
  });

  test("weekend transitions do not create a leftover qualifying session", async () => {
    const { db, diagnostics } = await replay("weekend-sparse-qualifying");
    expect(db.sessions.map(s => s.sessionType)).toEqual(["practice", "qualifying", "race"]);
    expect(diagnostics.staleTransition).toBe(1);
    expect(completed(db, 3).map(l => l.invalidReason)).toEqual([null, null, null, null, null]);
    // The old dump already has missing qualifying samples: do not invent valid laps.
    expect(completed(db, 2).map(l => l.invalidReason)).toEqual([
      "game-invalidated", "too few telemetry packets", "too few telemetry packets", "too few telemetry packets",
    ]);
    expect(db.laps.at(-1)?.invalidReason).toBe("incomplete");
  });
});
