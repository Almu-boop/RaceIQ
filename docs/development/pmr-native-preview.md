# Project Motor Racing native UDP preview

The `pmr-pr-review` branch adds a built-in Project Motor Racing receiver to RaceIQ. It does not need SimHub, Simulator Controller or another bridge application. Enable PMR's UDP telemetry under **Settings → Preferences** and enter a driving session on the RaceIQ PC.

## Connection

Set PMR’s **UDP Port to 7576** and **UDP Host to 127.0.0.1** when both apps run on the same PC. Frequency 60 is a suitable test setting. RaceIQ binds UDP port **7576** with address reuse and joins multicast group **224.0.0.150** on available non-loopback IPv4 interfaces. The receiver starts with RaceIQ, independent of executable-name detection. The regular Forza/F1 UDP listener and HTTP/remote HUD ports are unchanged. If Windows requests network access for the rebuilt RaceIQ executable, permit it on your private network.

The first log identifies the listening port/group and the required game setting. A successful player join logs the native car, circuit and protocol version. Every 30 seconds, packet totals, rejected datagrams and readings skipped under persistence backpressure help distinguish no network traffic from missing player/session context. Invalid datagrams log type, version and byte length at most once every five seconds. Socket errors state the port and error. The game must supply active race information, a fresh `IsPlayer` race state and matching vehicle telemetry; AI-car telemetry is ignored.

Race information is retained until an explicit stop or session identity change because session metadata need not be sent continuously. Player state expires after two seconds. Session-stop/inactive messages clear context; track, car, lap-counter and clock resets change the recording identity. Unsupported versions and malformed/truncated packets are rejected with decoder error details. Each packet type has an independent version: v1 race and player state can join v2 vehicle telemetry. Player identity and freshness remain required. Live returns to the waiting screen after five seconds without accepted player readings.

## Protocol reference

Official PMR FAQ confirms UDP telemetry and the Settings → Preferences setting:
https://www.projectmotorracing.com/newsArticle.php?articleCode=NmNjNmE0MjQy&country=AE&lang=en

Wire layout and default connection reference: Simulator Controller, commit `ddb554a0b7ed40c7a07b7b500054f2efc6952542`:
https://github.com/SeriousOldMan/Simulator-Controller/blob/ddb554a0b7ed40c7a07b7b500054f2efc6952542/Sources/Special/PMR%20UDP%20Connector/PMR%20UDP%20Connector/PMRUDPProtocol.cs
https://github.com/SeriousOldMan/Simulator-Controller/blob/ddb554a0b7ed40c7a07b7b500054f2efc6952542/Sources/Special/PMR%20UDP%20Connector/PMR%20UDP%20Connector/PMRUDPReceiver.cs

RaceIQ's TypeScript decoder and receiver are an original implementation of the published wire layout. No Simulator Controller binary or source code is bundled. The supported versions are **1 and 2**, for four-wheel vehicles. The decoder branches on each packet’s version rather than assuming v1. The published reference includes newer-version field ordering for race/session and participant state; vehicle telemetry retains its length-prefixed gear/load arrays. Protocol-2 telemetry was observed in Shawn’s Windows log at 964 bytes. Tests include a synthetic 964-byte fixture with six gear entries and three suspension-load entries; that fixture is not a capture of Shawn’s packet and does not assert his actual array counts. The header identifies race information (0), participant race state (1), vehicle telemetry (2) and session stopped (3). Values are little-endian; strings have a one-byte UTF-8 byte-length prefix. The decoder checks bounds, field values, counts, matching player IDs and complete packet lengths.

Unlike Simulator Controller's v1 fallback, RaceIQ does **not** substitute `BestLapTime` for `LastLapTime` or best-sector values for last-sector values.

## Available preview behavior

- PMR Home/game navigation, Driver route, Sessions, Analyse, Compare, cars/tracks and development Raw Data.
- Direct speed, RPM, controls, fuel/capacity, ambient/track temperatures, world positions, per-wheel pressures, tread bands, carcass and brake temperatures, wheel rotation and native slip channels.
- Native sector index and current/best splits in Live, including S2/S3 without a track map or guessed sector lines. V2 additionally supplies native last splits. Saved completed split durations use current-sector durations; the final split uses the completed lap time.
- Discovered car and circuit names, keyed separately from other games. Recorded world-position outlines remain game-specific.
- Normal RaceIQ session/lap recording and self-contained raw replay. `RQPMR001` snapshots retain the race/state/vehicle datagrams byte-for-byte with receive timestamp and connection epoch. Every snapshot includes all necessary context. Generic sparse capture checkpoints reconstruct the exact original snapshots.
- Partial native setup readings (brake bias, ABS and TC level) are retained in the PMR extension; the complete telemetry datagram also preserves the other native setup fields. This is **not** full garage setup capture or an editable setup library.

## Limits and validation

A real Windows driving capture now verifies decoding and joining v1 race/player metadata with v2 vehicle telemetry. The rebuilt app still needs in-game confirmation. Automated fixtures verify the referenced packet layout, native-unit conversions, player selection, session clearing/restarts, sector progression, actual local UDP reception and lossless recording/replay. Native units, coordinate conventions, packet rates, game-version compatibility and behavior during pause, pits, finish and restart require Windows in-game confirmation.

V2 adds native last-lap time and lap-validity flags: positive last-lap time is used for completed recordings, and any invalid flag observed during a lap marks it invalid. Native last-sector values populate Live. V1 does not provide an official last-lap time or official lap-validity flag. Completed lap times are estimated from the last elapsed-lap sample, receive-time gap and next lap timer. RaceIQ's saved validity reflects its own completeness/pit checks; it is not certification that PMR accepted the lap. The first captured lap is treated as an outlap. Source gaps over two seconds are not repaired with a best-lap value. No official last-sector timings are claimed for v1. If v2’s last-lap time is not yet positive at the boundary, the existing estimate remains the fallback.

Unavailable: normalized suspension travel, measured wheel load, tire wear/health, damage, tire compounds, native yaw/pitch/roll, complete setups and Setup Engineer experiments. Raw native chassis quaternion and other unmapped channels remain in the capture for later work. The dashboard does not invent those missing semantics. PMR can use the existing remote HUD connection, but no Track Titan-style desktop overlay is added here.

No new database schema or migration is required. PMR connection instructions exist in all 12 supported locales. This standalone contribution contains no AMS2 adapter or unrelated UI-scaling changes. Full setups, suspension travel/compression, measured wheel load, wear and orientation are not claimed.

## Windows acceptance check

1. Check out the standalone `pmr-pr-review` branch, install dependencies, typecheck and build.
2. Close older RaceIQ instances. Start the newly built executable and enable UDP telemetry in PMR Settings → Preferences.
3. Enter a practice/race session. Confirm a `[PMR] Receiving player telemetry` log and correct car/circuit names in Live.
4. Compare RPM, speed, gear, pedals, fuel, pressure and temperature with the game. Check left/right wheel order and acceleration signs.
5. Drive at least three laps. Confirm S1 → S2 → S3, recorded lap estimates and replay. Compare times with the game; v2 should use the native last-lap reading when available. Report any discrepancy.
6. Return to menus; verify Live clears. Start a new session, change track/car and test pause/resume. Confirm old player/context readings are not reused.
7. Verify the existing remote HUD and other supported games still work independently.
