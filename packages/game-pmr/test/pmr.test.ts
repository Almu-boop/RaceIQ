import { SectorTracker } from "@raceiq/backend-core/live-strategy/sector-tracker";
import { computeLapSectors } from "@raceiq/backend-core/lap-analysis/sectors";
import { describe, test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSocket } from "node:dgram";
import { decodePMRDatagram } from "../src/protocol";
import { encodePMRFrame, decodePMRFrame } from "../src/frame";
import { PMRAccumulator } from "../src/accumulator";
import { normalizePMRFrame } from "../src/normalizer";
import { PMRTelemetrySource } from "../src/source";
import { pmrServerAdapter } from "../src/index";
import { registerGame } from "@raceiq/shared/games/registry";
import { CapturingDbAdapter } from "@raceiq/backend-core/telemetry/pipeline-ports";
import { SparseSessionRecorder } from "@raceiq/backend-core/session-capture/sparse-recorder";
import { iterateSessionFrames } from "@raceiq/backend-core/session-capture/framing";
import { TELEMETRY_CATALOG } from "@raceiq/shared/telemetry/catalog/data";
import { assertTelemetryCatalogComplete } from "@raceiq/shared/telemetry/catalog/validation";
import { compileTelemetryResolver } from "@raceiq/telemetry-core/telemetry/resolver/compile";
import { raceFixture, stateFixture, telemetryFixture } from "./fixtures";
registerGame(pmrServerAdapter);
const frame = (state = stateFixture(), at = 1800000000000) => encodePMRFrame(raceFixture(), state, telemetryFixture(), at, 1);
describe("PMR native UDP preview", () => {
  test("decodes all packet types and rejects truncation, unsupported versions and wrong lengths", () => {
    for (const raw of [raceFixture(), stateFixture(), telemetryFixture()]) {
      expect(decodePMRDatagram(raw)).not.toBeNull();
      for (let n = 0; n < raw.length; n++) expect(decodePMRDatagram(raw.subarray(0, n))).toBeNull();
      expect(decodePMRDatagram(Buffer.concat([raw, Buffer.from([0])]))).toBeNull();
      const changed = Buffer.from(raw);
      changed.writeUInt16LE(3, 1);
      expect(decodePMRDatagram(changed)).toBeNull();
    }
    expect(decodePMRDatagram(Buffer.from([3]))).toEqual({ type: 3 });
    const invalid = telemetryFixture();
    invalid.writeFloatLE(NaN, 12);
    expect(decodePMRDatagram(invalid)).toBeNull();
  });
  test("normalizes native units and keeps unavailable readings out of the semantic resolver", () => {
    const p = normalizePMRFrame(frame())!;
    expect(p).toMatchObject({ gameId: "pmr", Speed: 50, Fuel: 40, FuelCapacity: 80, Accel: 191, Brake: 51, Gear: 3, LastLap: 0, BestLap: 58 });
    expect(p.TirePressureFrontLeft).toBeCloseTo(29.0075, 3);
    expect(p.TireSurfaceTempInnerFR).toBe(91);
    expect(p.TireCarcassAverageTempFL).toBe(85);
    expect(p.pmr?.trackName).toBe("Interlagos - GP");
    assertTelemetryCatalogComplete();
    const ids = ["fuel.fuel", "tires.tire-pressure", "timing.track-length", "tires.tire-slip-ratio", "timing.last-lap", "tires.tire-wear", "suspension.suspension-travel-m", "motion.yaw"];
    const resolver = compileTelemetryResolver(TELEMETRY_CATALOG, { simulator: "pmr", requested: ids.map((semanticId) => ({ semanticId })) });
    const view = resolver.createFrameView(p, { timestamp: { domain: "session", milliseconds: 1000 }, updateSequence: 1n });
    expect(view.resolveValue(resolver.slot(ids[0]!)).value).toBe(40);
    expect(view.resolveValue(resolver.slot(ids[2]!)).value).toBe(3000);
    expect(view.resolveValue(resolver.slot(ids[3]!)).value).toEqual([expect.closeTo(0.1, 5), expect.closeTo(0.11, 5), expect.closeTo(0.12, 5), expect.closeTo(0.13, 5)]);
    for (const id of ids.slice(4)) expect(view.resolveValue(resolver.slot(id)).state).toBe("missing");
  });
  test("requires fresh session and matching player state, ignores AI cars and clears stopped sessions", () => {
    const a = new PMRAccumulator();
    expect(a.accept(telemetryFixture(), 10000)).toBeNull();
    a.accept(raceFixture(), 10000);
    a.accept(stateFixture({ id: 99, player: false }), 10000);
    expect(a.accept(telemetryFixture(99), 10001)).toBeNull();
    a.accept(stateFixture(), 10001);
    expect(a.accept(telemetryFixture(99), 10002)).toBeNull();
    expect(a.accept(telemetryFixture(), 10002)).not.toBeNull();
    expect(a.accept(telemetryFixture(), 12002)).toBeNull();
    a.accept(stateFixture(), 12003);
    expect(a.accept(telemetryFixture(), 12004)).not.toBeNull();
    a.accept(Buffer.from([3]), 12005);
    expect(a.accept(telemetryFixture(), 12006)).toBeNull();
    a.accept(raceFixture(), 12007);
    expect(a.accept(telemetryFixture(), 12008)).toBeNull();
    a.accept(stateFixture(), 22008);
    expect(a.accept(telemetryFixture(), 22009)).not.toBeNull();
    expect(a.accept(telemetryFixture(), 24009)).toBeNull();
  });
  test("restarts and track changes produce new identities without mutating earlier bytes", () => {
    const a = new PMRAccumulator(),
      race = raceFixture();
    a.accept(race, 10000);
    a.accept(stateFixture({ lap: 3, time: 40 }), 10000);
    const first = a.accept(telemetryFixture(), 10001)!;
    race.fill(0);
    expect(decodePMRFrame(first)?.race.track).toBe("Interlagos");
    a.accept(stateFixture({ lap: 1, time: 0 }), 10002);
    const second = a.accept(telemetryFixture(), 10003)!;
    expect(decodePMRFrame(second)!.epoch).toBeGreaterThan(decodePMRFrame(first)!.epoch);
    a.accept(raceFixture(1, "Silverstone"), 10004);
    expect(a.accept(telemetryFixture(), 10005)).toBeNull();
  });
  test("records lossless self-contained snapshots across sparse checkpoints", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pmr-")),
      path = join(dir, "capture.bin"),
      recorder = new SparseSessionRecorder("pmr"),
      frames: Buffer[] = [];
    try {
      recorder.start(path);
      recorder.writeMetaFrame();
      for (let n = 0; n < 260; n++) {
        const raw = frame(stateFixture({ time: n / 10 }), 1800000000000 + n * 100);
        frames.push(raw);
        recorder.writeRecord(raw);
      }
      await recorder.stop();
      expect([...iterateSessionFrames(readFileSync(path))]).toEqual(frames);
      expect(normalizePMRFrame(frames[150]!)?.CurrentLap).toBe(15);
    } finally {
      await recorder.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("records estimated completed lap times without substituting the best lap", async () => {
    const db = new CapturingDbAdapter(),
      detector = pmrServerAdapter.createLapDetector({ db });
    for (let lap = 1; lap <= 3; lap++)
      for (let n = 0; n < 300; n++) {
        const p = normalizePMRFrame(frame(stateFixture({ lap, time: n * 0.2, progress: n / 300 }), 1800000000000 + ((lap - 1) * 300 + n) * 200))!;
        await detector.feed(p);
      }
    await detector.feed(normalizePMRFrame(frame(stateFixture({ lap: 4, time: 0, progress: 0 }), 1800000180000))!);
    expect(db.sessions[0]?.gameId).toBe("pmr");
    expect(db.sessions[0]?.sessionType).toBe("race");
    expect(db.laps).toHaveLength(3);
    for (const lap of db.laps) expect(lap.lapTime).toBeCloseTo(60, 3);
    expect(db.laps[1]?.isValid).toBe(true);
    await detector.finalizeCurrentSession?.();
  });
  test.each([1, 2] as const)("receives real protocol %i UDP traffic and releases its socket on stop", async (version) => {
    const frames: Buffer[] = [],
      source = new PMRTelemetrySource({
        port: 0,
        multicast: false,
        registerIdentity: async () => {},
        dispatchRawFrame: async (raw) => {
          frames.push(raw);
        },
      }),
      sender = createSocket("udp4");
    try {
      source.start();
      for (let n = 0; n < 100 && source.listeningPort === null; n++) await Bun.sleep(5);
      const port = source.listeningPort;
      expect(port).not.toBeNull();
      for (const raw of [raceFixture(1, "Interlagos", version), stateFixture({ version }), telemetryFixture(42, 50, version)])
        await new Promise<void>((resolve, reject) => sender.send(raw, port!, "127.0.0.1", (error) => (error ? reject(error) : resolve())));
      for (let n = 0; n < 100 && !frames.length; n++) await Bun.sleep(5);
      await source.flush();
      expect(frames).toHaveLength(1);
      expect(normalizePMRFrame(frames[0]!)?.Speed).toBe(50);
      await source.stop();
      expect(source.listeningPort).toBeNull();
    } finally {
      sender.close();
      await source.stop();
    }
  });
});

test("PMR uses native S2 and S3 timing without inventing sector locations", async () => {
  const tracker = new SectorTracker();
  const p = (sector: number, time: number, times: number[]) => normalizePMRFrame(frame(stateFixture({ sector, time, sectors: times })))!;
  const first = p(0, 10, [0, 0, 0]);
  await tracker.reset(first.TrackOrdinal, "pmr", first.CarOrdinal);
  expect(tracker.feed(first)?.currentSector).toBe(0);
  const second = tracker.feed(p(1, 25, [20, 0, 0]));
  expect(second?.currentSector).toBe(1);
  expect(second?.currentSectorTime).toBe(5);
  const third = tracker.feed(p(2, 45, [20, 20, 0]));
  expect(third?.currentSector).toBe(2);
  expect(third?.currentSectorTime).toBe(5);
  expect(tracker.getTrackLength()).toBe(3000);
  const packets = Array.from({ length: 60 }, () => p(2, 59, [20, 20, 0]));
  expect(await computeLapSectors(first.TrackOrdinal, "pmr", packets, 60)).toEqual([20, 20, 20]);
});

const v2Frame = (opts: Parameters<typeof stateFixture>[0] = {}, at = 1800000000000) =>
  encodePMRFrame(raceFixture(1, "Interlagos", 2), stateFixture({ ...opts, version: 2 }), telemetryFixture(42, 50, 2, 6, [1, 2, 3]), at, 1);

describe("PMR protocol v2", () => {
  test("decodes v2 additions in wire order and accepts variable gear/load counts", () => {
    const race = decodePMRDatagram(raceFixture(1, "Interlagos", 2));
    expect(race).toMatchObject({ type: 0, version: 2, sessionTimeElapsed: 125, trackGrip: expect.closeTo(0.98, 5), isLaps: true, sessionIsLaps: false, state: 1 });
    const state = decodePMRDatagram(stateFixture({ version: 2, inPitLane: true, lapValid: false }));
    expect(state).toMatchObject({
      type: 1,
      version: 2,
      lastLapTime: 61.25,
      lastSectorTimes: [20, 21, 20.25],
      tyreCompoundFront: "Medium",
      tyreCompoundRear: "Hard",
      inPits: false,
      inPitLane: true,
      lapValid: false,
      flags: 0,
      engineDamage: expect.closeTo(0.03, 5),
    });
    const raw = telemetryFixture(42, 50, 2, 6, [1, 2, 3]);
    expect(raw.length).toBe(964);
    expect(decodePMRDatagram(raw)).toMatchObject({ type: 2, version: 2, input: { gear: 3 }, constant: { fuelCapacity: 80 }, suspension: { avgLoads: [1, 2, 3] } });
    for (const packet of [raceFixture(1, "Interlagos", 2), stateFixture({ version: 2 }), raw]) {
      for (let n = 0; n < packet.length; n++) expect(decodePMRDatagram(packet.subarray(0, n))).toBeNull();
      expect(decodePMRDatagram(Buffer.concat([packet, Buffer.from([0])]))).toBeNull();
    }
  });
  test("joins independently versioned packet types while preserving player identity", () => {
    const a = new PMRAccumulator();
    a.accept(raceFixture(), 10000);
    a.accept(stateFixture(), 10000);
    expect(a.accept(telemetryFixture(99, 50, 2), 10001)).toBeNull();
    const raw = a.accept(telemetryFixture(42, 50, 2), 10002)!;
    expect(decodePMRFrame(raw)).toMatchObject({ race: { version: 1 }, state: { version: 1 }, telemetry: { version: 2 } });
    expect(normalizePMRFrame(raw)).not.toBeNull();
    expect(decodePMRFrame(encodePMRFrame(raceFixture(), stateFixture({ id: 99 }), telemetryFixture(), 10000, 1))).toBeNull();
  });
  test("joins captured PMR v1 metadata with v2 vehicle telemetry and replays exact bytes", () => {
    const samples = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "mixed-packet-versions.json"), "utf8")) as string[];
    const packets = samples.map((s) => Buffer.from(s, "base64"));
    const a = new PMRAccumulator();
    expect(a.accept(packets[0]!, 10000)).toBeNull();
    expect(a.accept(packets[1]!, 10001)).toBeNull();
    const raw = a.accept(packets[2]!, 10002)!;
    expect(raw).not.toBeNull();
    expect(decodePMRFrame(raw)).toMatchObject({ race: { version: 1, track: "Lime Rock Park" }, state: { version: 1, isPlayer: true, vehicleId: 0 }, telemetry: { version: 2, vehicleId: 0 } });
    expect(normalizePMRFrame(raw)).not.toBeNull();
    expect(raw.subarray(32)).toEqual(Buffer.concat(packets));
  });
  test("uses native v2 last-lap timing in the resolver and sector display", async () => {
    const p = normalizePMRFrame(v2Frame())!;
    expect(p.LastLap).toBe(61.25);
    expect(p.BestLap).toBe(58);
    const resolver = compileTelemetryResolver(TELEMETRY_CATALOG, { simulator: "pmr", requested: [{ semanticId: "timing.last-lap" }] });
    const view = resolver.createFrameView(p, { timestamp: { domain: "session", milliseconds: 1000 }, updateSequence: 1n });
    expect(view.resolveValue(resolver.slot("timing.last-lap")).value).toBe(61.25);
    const tracker = new SectorTracker();
    await tracker.reset(p.TrackOrdinal, "pmr", p.CarOrdinal);
    expect(tracker.feed(p)).toMatchObject({ lastTimes: [20, 21, 20.25], lastLapTime: 61.25 });
  });
  test("preserves v2 native fields through sparse recording checkpoints", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pmr-v2-")),
      path = join(dir, "capture.bin"),
      recorder = new SparseSessionRecorder("pmr"),
      frames: Buffer[] = [];
    try {
      recorder.start(path);
      recorder.writeMetaFrame();
      for (let n = 0; n < 260; n++) {
        const raw = v2Frame({ time: n / 10, lapValid: n < 200 }, 1800000000000 + n * 100);
        frames.push(raw);
        recorder.writeRecord(raw);
      }
      await recorder.stop();
      const replay = [...iterateSessionFrames(readFileSync(path))];
      expect(replay).toEqual(frames);
      expect(normalizePMRFrame(replay[220]!)?.pmr).toMatchObject({ protocolVersion: 2, lastLapTime: 61.25, lapValid: false });
    } finally {
      await recorder.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("records native completed lap times and rejects game-invalid laps", async () => {
    const db = new CapturingDbAdapter(),
      detector = pmrServerAdapter.createLapDetector({ db });
    for (let lap = 1; lap <= 3; lap++)
      for (let n = 0; n < 300; n++) await detector.feed(normalizePMRFrame(v2Frame({ lap, time: n * 0.2, progress: n / 300, lapValid: lap !== 2 }, 1800000000000 + ((lap - 1) * 300 + n) * 200))!);
    await detector.feed(normalizePMRFrame(v2Frame({ lap: 4, time: 0, progress: 0 }, 1800000180000))!);
    expect(db.laps).toHaveLength(3);
    for (const lap of db.laps) expect(lap.lapTime).toBe(61.25);
    expect(db.laps[1]?.isValid).toBe(false);
    expect(db.laps[2]?.isValid).toBe(true);
    await detector.finalizeCurrentSession?.();
  });
});
