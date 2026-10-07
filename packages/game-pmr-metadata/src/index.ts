import type { GameAdapter } from "@raceiq/shared/games/types";
const cars = new Map<number, string>();
const tracks = new Map<number, string>();
const trackLengths = new Map<number, number>();
export function getPMRTrackLength(ordinal: number): number | undefined {
  return trackLengths.get(ordinal);
}
export function registerPMRIdentity(car: number, carName: string, track: number, trackName: string, trackLengthM?: number): void {
  cars.set(car, carName);
  tracks.set(track, trackName);
  if (trackLengthM != null && Number.isFinite(trackLengthM) && trackLengthM > 0) trackLengths.set(track, trackLengthM);
}
export function injectDiscoveredPMRIdentity(carRows: Iterable<{ ordinal: number; name: string }>, trackRows: Iterable<{ ordinal: number; name: string }>): void {
  for (const car of carRows) cars.set(car.ordinal, car.name);
  for (const track of trackRows) tracks.set(track.ordinal, track.name);
}
const unavailable = { source: "unavailable", reason: "source-limitation" } as const;
export const pmrAdapter: GameAdapter = {
  id: "pmr",
  displayName: "Project Motor Racing",
  shortName: "PMR",
  routePrefix: "pmr",
  coordSystem: "pmr-world",
  nativeSectors: true,
  appendsDelayedFinishFrame: false,
  getNativeSectorTiming: (packet) =>
    packet.pmr
      ? {
          lastTimes: packet.pmr.lastSectorTimes,
          lastLapTime: packet.pmr.lastLapTime,
          currentSector: packet.pmr.currentSector,
          currentTimes: packet.pmr.currentSectorTimes,
          bestTimes: packet.pmr.bestSectorTimes,
          trackLengthM: packet.pmr.trackLengthM,
          lapFraction: packet.pmr.lapFraction,
        }
      : undefined,
  authoritativeTrackLength: true,
  steeringCenter: 0,
  steeringRange: 127,
  carForwardOffset: (yaw) => [Math.sin(yaw), Math.cos(yaw)],
  followViewRotation: (yaw) => Math.PI - yaw,
  telemetry: {
    fuel: { packetUnit: "litre", binding: { kind: "value", semanticId: "fuel.fuel" } },
    tireTemperature: { packetUnit: "celsius", binding: { kind: "value", semanticId: "tire.temperature.surface.representative" } },
    brakeTemperature: { packetUnit: "celsius", binding: { kind: "value", semanticId: "brakes.brake-temp" } },
    tirePressure: { packetUnit: "psi", binding: { kind: "value", semanticId: "tires.tire-pressure" } },
    power: { packetUnit: "watt", binding: { kind: "value", semanticId: "engine.power" } },
    torque: { packetUnit: "newton-metre", binding: { kind: "value", semanticId: "engine.torque" } },
    tireCarcassTemperature: { packetUnit: "celsius", binding: { kind: "value", semanticId: "tire.temperature.carcass.representative" } },
    tireSurfaceProfile: { source: "direct", freshness: "continuous", binding: { kind: "value", semanticId: "tire.temperature.surface.middle" } },
    handBrake: { source: "direct", freshness: "continuous", binding: { kind: "value", semanticId: "brakes.hand-brake" } },
    clutch: { source: "direct", freshness: "continuous", binding: { kind: "value", semanticId: "inputs.clutch" } },
    pitStatus: { source: "direct", freshness: "continuous", binding: { kind: "value", semanticId: "race.pit-status" } },
    analysis: {
      balance: unavailable,
      gripDemand: unavailable,
      traction: unavailable,
      surface: unavailable,
      lateralSlip: unavailable,
      slipRatio: { source: "direct", freshness: "continuous", display: "per-wheel", binding: { kind: "value", semanticId: "tires.tire-slip-ratio" } },
      slipAngle: { source: "direct", freshness: "continuous", display: "per-wheel", binding: { kind: "value", semanticId: "tires.tire-slip-angle" } },
      suspensionCompressionBias: unavailable,
      suspensionTravel: unavailable,
      wheelRotation: { source: "direct", freshness: "continuous", display: "per-wheel", binding: { kind: "value", semanticId: "tires.wheel-rotation-speed" } },
      tireTemperature: { source: "direct", freshness: "continuous", display: "per-wheel", binding: { kind: "value", semanticId: "tire.temperature.surface.representative" } },
      tirePressure: { source: "direct", freshness: "continuous", display: "per-wheel", binding: { kind: "value", semanticId: "tires.tire-pressure" } },
      tireHealth: unavailable,
      tireWearRate: unavailable,
    },
  },
  tireHealthThresholds: { green: 0.85, yellow: 0.7 },
  tireTempThresholds: { cold: 70, warm: 105, hot: 125 },
  suspensionThresholds: { values: [25, 65, 85] },
  getCarName: (id) => cars.get(id) ?? `PMR car #${id}`,
  getTrackName: (id) => tracks.get(id) ?? `PMR track #${id}`,
  getTrackOrdinalByName: (name) => [...tracks].find(([, n]) => n.toLowerCase() === name.toLowerCase())?.[0],
};
