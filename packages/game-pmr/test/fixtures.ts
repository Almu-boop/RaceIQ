class WireWriter {
  private chunks: Buffer[] = [];
  byte(n: number): this {this.chunks.push(Buffer.from([n])); return this;}
  bool(n: boolean): this {return this.byte(n ? 1 : 0);}
  u16(n: number): this {const b=Buffer.alloc(2);b.writeUInt16LE(n);this.chunks.push(b);return this;}
  int(n: number): this {const b=Buffer.alloc(4);b.writeInt32LE(n);this.chunks.push(b);return this;}
  float(n: number): this {const b=Buffer.alloc(4);b.writeFloatLE(n);this.chunks.push(b);return this;}
  floats(ns: number[]): this {ns.forEach(n=>this.float(n));return this;}
  string(s: string): this {const b=Buffer.from(s);this.byte(b.length);this.chunks.push(b);return this;}
  array(ns: number[]): this {return this.byte(ns.length).floats(ns);}
  finish(): Buffer {return Buffer.concat(this.chunks);}
}
export function raceFixture(state=1, track="Interlagos", version: 1 | 2 = 1): Buffer {
  const w = new WireWriter().byte(0).u16(version).string(track).string("GP").string("Summer").string("Clear").string("race").string("SinglePlayer").floats([3000,10,0,23,32]);
  if (version === 2) w.floats([125, .98]);
  w.bool(true); if (version === 2) w.bool(false);
  return w.byte(state).byte(20).finish();
}
export function stateFixture(opts: {version?: 1 | 2; id?: number; player?: boolean; lap?: number; time?: number; progress?: number; sector?: number; sectors?: number[]; inPits?: boolean; inPitLane?: boolean; lapValid?: boolean; lastLapTime?: number; lastSectors?: number[]; finished?: boolean; dq?: boolean} = {}): Buffer {
  const version = opts.version ?? 1;
  const w = new WireWriter().byte(1).u16(version).int(opts.id??42).bool(opts.player??true).string("Ginetta G55 GT4").string("Shawn").string("livery-1").string("GT4").int(3).int(opts.lap??1).floats([opts.time??12,58]);
  if (version === 2) w.float(opts.lastLapTime ?? 61.25);
  w.float(opts.progress??.2).int(opts.sector??0).array(opts.sectors??[0,0,0]).array([19,20,19]);
  if (version === 2) w.array(opts.lastSectors ?? [20,21,20.25]).string("Medium").string("Hard");
  w.bool(opts.inPits??false);
  if (version === 2) w.bool(opts.inPitLane??false).bool(opts.lapValid??true);
  w.bool(opts.finished??false).bool(opts.dq??false).int(0);
  if (version === 2) w.floats([.01,.02,.03]);
  return w.finish();
}
export function telemetryFixture(id=42,speed=50,version: 1 | 2=1,gearCount=2,loads=[1,2,3,4]): Buffer {
  const w=new WireWriter().byte(2).u16(version).int(id).byte(4);
  for(let i=0;i<4;i++) {
    w.int(123).floats([100+i,50, 0,0,0, 1,2,3, 0,0,0, .3,200000+i*1000,0,.1+i/100,.02, 70+i,80+i,90+i, 85+i,40,40,40,400+i, .01,0,10,20,10,20]);
  }
  w.floats([10,1,20, 0,0,0,1, 0,0,0, 0,0,0, 0,0,speed, 0,0,speed, 1,0,2, 1,0,2, speed,speed,0]);
  const drivetrain=Array(28).fill(0);drivetrain[0]=6000;drivetrain[2]=300;drivetrain[3]=180000;drivetrain[7]=40;
  w.floats(drivetrain).byte(0).byte(1).byte(0).byte(0).byte(0).byte(0).byte(0).byte(gearCount).floats(Array.from({length:gearCount},()=>[7000,2000]).flat());
  w.array(loads).float(.5).floats([-.25,.75,.2,.1,0]).int(3).floats([.6,100,100,0,0]).byte(2).byte(3);
  w.floats([0,0,0, .5,1200,100,100,speed,speed,0]).bool(false);
  w.floats([-1,-1,-2,1,1,2, 1000,5000,6500,7500,400,200000,0,80,0,1.7,1.7,2.6]).byte(4).byte(6).byte(1).bool(false);
  return w.finish();
}
