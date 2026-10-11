import {describe, expect, test} from "bun:test";
import {GameUdpPortsSchema, PartialSettingsSchema, validateGameUdpPorts, loadSettings, saveSettings} from "@raceiq/backend-core/runtime/config/settings";

describe("per-game UDP ports", () => {
  test("saved game ports survive reload without changing the shared default", () => {
    const original = loadSettings();
    try {
      saveSettings({...original, gameUdpPorts: {pmr: 7577, "f1-2025": 20777}});
      const reloaded = loadSettings();
      expect(reloaded.gameUdpPorts).toEqual({pmr: 7577, "f1-2025": 20777});
      expect(reloaded.udpPort).toBe(original.udpPort);
      expect(reloaded.unit).toBe(original.unit);
    } finally { saveSettings(original); }
  });
  test("legacy settings have no overrides", () => {
    expect(GameUdpPortsSchema.parse({})).toEqual({});
  });
  test("accepts independent forwarded ports", () => {
    const ports = {pmr: 7577, "fm-2023": 5302, "f1-2025": 20777};
    expect(PartialSettingsSchema.parse({gameUdpPorts: ports}).gameUdpPorts).toEqual(ports);
    expect(validateGameUdpPorts(ports, 5301)).toBe(true);
  });
  test("rejects invalid ports and shared-memory games", () => {
    for (const port of [0, 1023, 65536, 7577.5, "7577", NaN]) {
      expect(GameUdpPortsSchema.safeParse({pmr: port}).success).toBe(false);
    }
    expect(GameUdpPortsSchema.safeParse({ams2: 7577}).success).toBe(false);
  });
  test("prevents PMR colliding with any generic receiver", () => {
    expect(validateGameUdpPorts({}, 5301)).toBe(true);
    expect(validateGameUdpPorts({pmr: 5301}, 5301)).toBe(false);
    expect(validateGameUdpPorts({"f1-2025": 7576}, 5301)).toBe(false);
    expect(validateGameUdpPorts({pmr: 7577, "fm-2023": 7577}, 5301)).toBe(false);
    expect(validateGameUdpPorts({"fm-2023": 5302, "f1-2025": 5302}, 5301)).toBe(true);
  });
});


test("binds a shared override once and releases all receiver sockets", async () => {
  const {createSocket} = await import("node:dgram");
  const {udpListener} = await import("../../src/runtime/udp-listener");
  const probe = createSocket("udp4");
  await new Promise<void>(resolve => probe.bind(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const sender = createSocket("udp4");
  udpListener.setGamePorts({"fm-2023": port, "f1-2025": port});
  try {
    await udpListener.start(0, "127.0.0.1");
    const before = udpListener.droppedPackets;
    await new Promise<void>((resolve, reject) => sender.send(Buffer.alloc(1), port, "127.0.0.1", error => error ? reject(error) : resolve()));
    const deadline = Date.now() + 2000;
    while (udpListener.droppedPackets === before && Date.now() < deadline) await Bun.sleep(10);
    expect(udpListener.droppedPackets).toBe(before + 1);
  } finally {
    sender.close();
    await udpListener.stop();
    udpListener.setGamePorts({});
  }
  const reuse = createSocket("udp4");
  try {
    await new Promise<void>((resolve, reject) => {reuse.once("error", reject); reuse.bind(port, "127.0.0.1", resolve);});
    expect(reuse.address().port).toBe(port);
  } finally { reuse.close(); }
});
