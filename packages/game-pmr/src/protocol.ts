/** PMR UDP protocols v1 and v2. Wire layout reference and provenance: docs/development/pmr-native-preview.md. */
export const PMR_PORT = 7576;
export const PMR_MULTICAST_GROUP = "224.0.0.150";
class Cursor {
  private at = 1;
  private readonly bytes: Buffer;
  constructor(bytes: Buffer) {
    this.bytes = bytes;
  }
  private take(n: number): number {
    if (this.at + n > this.bytes.length) throw new Error(`Truncated PMR datagram at byte ${this.at}: need ${n}, length ${this.bytes.length}`);
    const start = this.at;
    this.at += n;
    return start;
  }
  byte(): number {
    return this.bytes[this.take(1)]!;
  }
  bool(): boolean {
    const n = this.byte();
    if (n > 1) throw new Error("Invalid PMR boolean");
    return n === 1;
  }
  version(): 1 | 2 {
    const version = this.bytes.readUInt16LE(this.take(2));
    if (version !== 1 && version !== 2) throw new Error(`Unsupported PMR protocol version ${version}`);
    return version;
  }
  int(): number {
    return this.bytes.readInt32LE(this.take(4));
  }
  uint(): number {
    return this.bytes.readUInt32LE(this.take(4));
  }
  float(): number {
    const n = this.bytes.readFloatLE(this.take(4));
    if (!Number.isFinite(n)) throw new Error("Non-finite PMR value");
    return n;
  }
  string(): string {
    const n = this.byte();
    const start = this.take(n);
    return new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(start, start + n));
  }
  vector(): [number, number, number] {
    return [this.float(), this.float(), this.float()];
  }
  array(max: number): number[] {
    const n = this.byte();
    if (n > max) throw new Error(`Invalid PMR array count ${n} at byte ${this.at - 1}: maximum ${max}`);
    return Array.from({ length: n }, () => this.float());
  }
  done(): void {
    if (this.at !== this.bytes.length) throw new Error(`Unexpected PMR packet length: decoded ${this.at} of ${this.bytes.length} bytes`);
  }
}
export interface PMRRaceInfo {
  type: 0;
  version: 1 | 2;
  sessionTimeElapsed?: number;
  trackGrip?: number;
  sessionIsLaps?: boolean;
  track: string;
  layout: string;
  season: string;
  weather: string;
  session: string;
  gameMode: string;
  layoutLength: number;
  duration: number;
  overtime: number;
  ambientTemperature: number;
  trackTemperature: number;
  isLaps: boolean;
  state: number;
  numParticipants: number;
}
export interface PMRRaceState {
  type: 1;
  version: 1 | 2;
  lastLapTime?: number;
  lastSectorTimes?: number[];
  tyreCompoundFront?: string;
  tyreCompoundRear?: string;
  inPitLane?: boolean;
  lapValid?: boolean;
  aeroDamage?: number;
  suspensionDamage?: number;
  engineDamage?: number;
  vehicleId: number;
  isPlayer: boolean;
  vehicleName: string;
  driverName: string;
  liveryId: string;
  vehicleClass: string;
  racePos: number;
  currentLap: number;
  currentLapTime: number;
  bestLapTime: number;
  lapProgress: number;
  currentSector: number;
  currentSectorTimes: number[];
  bestSectorTimes: number[];
  inPits: boolean;
  sessionFinished: boolean;
  dq: boolean;
  flags: number;
}
export interface PMRWheel {
  contactMaterialHash: number;
  angularVelocity: number;
  linearSpeed: number;
  slideLS: number[];
  forceLS: number[];
  momentLS: number[];
  contactRadius: number;
  pressure: number;
  inclination: number;
  slipRatio: number;
  slipAngle: number;
  treadTemp: number[];
  carcassTemp: number;
  internalAirTemp: number;
  wellAirTemp: number;
  rimTemp: number;
  brakeTemp: number;
  springStrain: number;
  damperVelocity: number;
  hubTorque: number;
  hubPower: number;
  wheelTorque: number;
  wheelPower: number;
}
export interface PMRVehicleTelemetry {
  type: 2;
  version: 1 | 2;
  vehicleId: number;
  wheels: PMRWheel[];
  chassis: {
    posWS: number[];
    quat: number[];
    angularVelocityWS: number[];
    angularVelocityLS: number[];
    velocityWS: number[];
    velocityLS: number[];
    accelerationWS: number[];
    accelerationLS: number[];
    overallSpeed: number;
    forwardSpeed: number;
    sideslip: number;
  };
  drivetrain: Record<DrivetrainField, number>;
  drivetrainFlags: boolean[];
  gears: number[][];
  suspension: { avgLoads: number[]; loadBias: number };
  input: { steering: number; accelerator: number; brake: number; clutch: number; handbrake: number; gear: number };
  setup: { brakeBias: number; frontAntiRollStiffness: number; rearAntiRollStiffness: number; regenLimit: number; deployLimit: number; absLevel: number; tcsLevel: number };
  general: {
    centerOfGravity: number[];
    steeringWheelAngle: number;
    totalMass: number;
    drivenWheelAngVel: number;
    nonDrivenWheelAngVel: number;
    estRollingSpeed: number;
    estLinearSpeed: number;
    totalBrakeForce: number;
    absActive: boolean;
  };
  constant: Record<ConstantField, number>;
  boundingBox: number[][];
  numberOfWheels: number;
  forwardGears: number;
  reverseGears: number;
  isHybrid: boolean;
}
const DRIVETRAIN_FIELDS = [
  "engineRPM",
  "engineRevRatio",
  "engineTorque",
  "enginePower",
  "engineLoad",
  "engineTurboRPM",
  "engineTurboBoostPressure",
  "fuelRemaining",
  "fuelUseRate",
  "engineOilPressure",
  "engineOilTemperature",
  "engineCoolantTemperature",
  "exhaustGasTemperature",
  "motorRPM",
  "batteryRemaining",
  "batteryUseRate",
  "transmissionRPM",
  "gearboxInputRPM",
  "gearboxOutputRPM",
  "gearboxTorque",
  "gearboxPower",
  "gearboxLoadIn",
  "gearboxLoadOut",
  "timeSinceShift",
  "estDrivenSpeed",
  "outputTorque",
  "outputPower",
  "outputEfficiency",
] as const;
type DrivetrainField = (typeof DRIVETRAIN_FIELDS)[number];
const CONSTANT_FIELDS = [
  "starterIdleRPM",
  "engineTorquePeakRPM",
  "enginePowerPeakRPM",
  "engineMaxRPM",
  "engineMaxTorque",
  "engineMaxPower",
  "engineMaxBoost",
  "fuelCapacity",
  "batteryCapacity",
  "trackWidthFront",
  "trackWidthRear",
  "wheelbase",
] as const;
type ConstantField = (typeof CONSTANT_FIELDS)[number];
export type PMRDatagram = PMRRaceInfo | PMRRaceState | PMRVehicleTelemetry | { type: 3 };
export function decodePMRDatagram(bytes: Buffer, onRejected?: (reason: string) => void): PMRDatagram | null {
  try {
    if (bytes.length === 1 && bytes[0] === 3) return { type: 3 };
    if (bytes.length < 3 || bytes[0]! > 2) return null;
    const c = new Cursor(bytes);
    const version = c.version();
    let packet: PMRDatagram;
    switch (bytes[0]) {
      case 0: {
        const track = c.string(),
          layout = c.string(),
          season = c.string(),
          weather = c.string(),
          session = c.string(),
          gameMode = c.string();
        const layoutLength = c.float(),
          duration = c.float(),
          overtime = c.float(),
          ambientTemperature = c.float(),
          trackTemperature = c.float();
        const extra = version === 2 ? { sessionTimeElapsed: c.float(), trackGrip: c.float() } : {};
        const isLaps = c.bool();
        const sessionIsLaps = version === 2 ? c.bool() : undefined;
        packet = {
          type: 0,
          version,
          track,
          layout,
          season,
          weather,
          session,
          gameMode,
          layoutLength,
          duration,
          overtime,
          ambientTemperature,
          trackTemperature,
          ...extra,
          isLaps,
          ...(sessionIsLaps === undefined ? {} : { sessionIsLaps }),
          state: c.byte(),
          numParticipants: c.byte(),
        };
        if (packet.state > 2 || (packet.state === 1 && (packet.layoutLength <= 0 || !packet.track.trim()))) throw new Error("Invalid PMR race identity/state");
        break;
      }
      case 1: {
        const vehicleId = c.int(),
          isPlayer = c.bool(),
          vehicleName = c.string(),
          driverName = c.string(),
          liveryId = c.string(),
          vehicleClass = c.string();
        const racePos = c.int(),
          currentLap = c.int(),
          currentLapTime = c.float(),
          bestLapTime = c.float();
        const lastLapTime = version === 2 ? c.float() : undefined;
        const lapProgress = c.float(),
          currentSector = c.int(),
          currentSectorTimes = c.array(16),
          bestSectorTimes = c.array(16);
        const splits = version === 2 ? { lastLapTime, lastSectorTimes: c.array(16), tyreCompoundFront: c.string(), tyreCompoundRear: c.string() } : {};
        const inPits = c.bool();
        const pitFlags = version === 2 ? { inPitLane: c.bool(), lapValid: c.bool() } : {};
        const sessionFinished = c.bool(),
          dq = c.bool(),
          flags = c.uint();
        const damage = version === 2 ? { aeroDamage: c.float(), suspensionDamage: c.float(), engineDamage: c.float() } : {};
        packet = {
          type: 1,
          version,
          vehicleId,
          isPlayer,
          vehicleName,
          driverName,
          liveryId,
          vehicleClass,
          racePos,
          currentLap,
          currentLapTime,
          bestLapTime,
          lapProgress,
          currentSector,
          currentSectorTimes,
          bestSectorTimes,
          ...splits,
          inPits,
          ...pitFlags,
          sessionFinished,
          dq,
          flags,
          ...damage,
        };
        if (packet.currentLap < 0 || packet.currentLapTime < 0 || packet.lapProgress < 0 || packet.lapProgress > 1 || packet.currentSector < 0 || packet.currentSector > 15)
          throw new Error("Invalid PMR lap/sector state");
        break;
      }
      case 2: {
        const vehicleId = c.int();
        const wheelCount = c.byte();
        if (wheelCount !== 4) return null;
        const wheels = Array.from({ length: wheelCount }, (): PMRWheel => ({
          contactMaterialHash: c.int(),
          angularVelocity: c.float(),
          linearSpeed: c.float(),
          slideLS: c.vector(),
          forceLS: c.vector(),
          momentLS: c.vector(),
          contactRadius: c.float(),
          pressure: c.float(),
          inclination: c.float(),
          slipRatio: c.float(),
          slipAngle: c.float(),
          treadTemp: c.vector(),
          carcassTemp: c.float(),
          internalAirTemp: c.float(),
          wellAirTemp: c.float(),
          rimTemp: c.float(),
          brakeTemp: c.float(),
          springStrain: c.float(),
          damperVelocity: c.float(),
          hubTorque: c.float(),
          hubPower: c.float(),
          wheelTorque: c.float(),
          wheelPower: c.float(),
        }));
        const chassis = {
          posWS: c.vector(),
          quat: [c.float(), c.float(), c.float(), c.float()],
          angularVelocityWS: c.vector(),
          angularVelocityLS: c.vector(),
          velocityWS: c.vector(),
          velocityLS: c.vector(),
          accelerationWS: c.vector(),
          accelerationLS: c.vector(),
          overallSpeed: c.float(),
          forwardSpeed: c.float(),
          sideslip: c.float(),
        };
        const drivetrain = Object.fromEntries(DRIVETRAIN_FIELDS.map((name) => [name, c.float()])) as Record<DrivetrainField, number>;
        const drivetrainFlags = Array.from({ length: 7 }, () => c.bool());
        const gearCount = c.byte();
        if (gearCount > 16) return null;
        const gears = Array.from({ length: gearCount }, () => [c.float(), c.float()]);
        const suspension = { avgLoads: c.array(16), loadBias: c.float() };
        const input = { steering: c.float(), accelerator: c.float(), brake: c.float(), clutch: c.float(), handbrake: c.float(), gear: c.int() };
        const setup = {
          brakeBias: c.float(),
          frontAntiRollStiffness: c.float(),
          rearAntiRollStiffness: c.float(),
          regenLimit: c.float(),
          deployLimit: c.float(),
          absLevel: c.byte(),
          tcsLevel: c.byte(),
        };
        const general = {
          centerOfGravity: c.vector(),
          steeringWheelAngle: c.float(),
          totalMass: c.float(),
          drivenWheelAngVel: c.float(),
          nonDrivenWheelAngVel: c.float(),
          estRollingSpeed: c.float(),
          estLinearSpeed: c.float(),
          totalBrakeForce: c.float(),
          absActive: c.bool(),
        };
        const boundingBox = [c.vector(), c.vector()];
        const constant = Object.fromEntries(CONSTANT_FIELDS.map((name) => [name, c.float()])) as Record<ConstantField, number>;
        packet = {
          type: 2,
          version,
          vehicleId,
          wheels,
          chassis,
          drivetrain,
          drivetrainFlags,
          gears,
          suspension,
          input,
          setup,
          general,
          constant,
          boundingBox,
          numberOfWheels: c.byte(),
          forwardGears: c.byte(),
          reverseGears: c.byte(),
          isHybrid: c.bool(),
        };
        if (packet.numberOfWheels !== 4 || input.gear < -1 || input.gear > 16) return null;
        break;
      }
      default:
        return null;
    }
    c.done();
    return packet;
  } catch (error) {
    onRejected?.(error instanceof Error ? error.message : String(error));
    return null;
  }
}
