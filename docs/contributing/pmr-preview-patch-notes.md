# PMR preview patch notes

## 2026-10-04 — Protocol v2 connection follow-up

- Respond to Shawn’s in-game report: UDP reached RaceIQ, but protocol-2 vehicle datagrams were rejected by the v1-only decoder.
- Decode each datagram using its own supported v1/v2 header. V2 reads extra session elapsed time/grip, last-lap time/splits, compounds, pit-lane/validity flags and damage in the published field order. Retain all native bytes for replay.
- Read bounded, length-prefixed drivetrain gear and suspension-load arrays; load-array count is independent of wheel count. Keep the four-wheel vehicle check.
- Keep old v1 captures readable. The subsequent real-capture fix below permits independent packet-type versions.
- Use native v2 last-lap time when positive and game invalid-lap flags during recording. Live last-sector values use the native v2 array. V1 keeps the documented estimates and missing last-lap semantic, without substituting best times.
- Include decode error details in rejected-packet logs and identify the connected protocol version. Update the connection note in all 12 languages and the Unreleased changelog.
- Add v2 truncation, variable-length arrays, mixed-version context, semantic availability, native timing/invalidity, raw replay and UDP transport checks. Fixtures are synthetic; live v2 acceptance still needs Shawn’s test.


## 2026-10-04 — Native PMR preview

- Add Project Motor Racing as a separate registered game with built-in UDP reception. Enable UDP telemetry in PMR Settings → Preferences; no bridge application is needed.
- Add PMR game selection, Home/Live navigation, game-scoped Driver profiles, discovered car/track catalogs, recorded sessions, analysis/comparison and Raw Data.
- Show available engine, controls, fuel, weather, tire/brake and motion readings while preserving source limitations in the telemetry catalog.
- Join only matching player-car packets; reject malformed/unsupported data, discard stale player state and clear stopped sessions. Log listening/connection state, rejected packets and periodic receiver diagnostics.
- Use native sector indices and durations for Live and recorded splits; do not invent equal-third sector positions.
- Retain exact native datagrams in self-contained snapshots and lossless sparse recordings, allowing replay without previous-lap context or a running game.
- Estimate completed lap time from native elapsed-time samples. Do not relabel the best lap as the last lap. Explain the missing official lap-validity flag in connection instructions and developer notes.
- Keep full setups and Setup Engineer experiments unavailable until their required source/model support exists. Partial brake bias/ABS/TC readings are recorded without claiming full setup capture.
- Add connection instructions in all 12 client languages and an Unreleased changelog entry. No database migration.
- Build this preview from the existing fork PMR branch and reconcile its source/assets with the cleaned AMS2 review base. The stable AMS2 pull-request branch is not modified remotely.

## 2026-10-04 — AMS2 display follow-up included in this preview

- Correct the reported reversed track arrow by rotating the AMS2 heading 180 degrees while retaining native source provenance and raw capture bytes.
- Restore both axes of AMS2 suspension-dot movement after the requested follow-up. Use actual per-wheel travel as a display-only compression balance; it does not measure wheel load or isolate braking weight transfer.
- Preserve per-wheel suspension readings. Remove unsupported load dots from the 3D wireframe where a valid compression capability is absent.
- Label supported normalized-suspension centroids as compression bias rather than measured load distribution.
- Add heading, suspension display and two-axis balance regression checks.
- Show the existing G-force and body-attitude meters at the lower left of 2D Analyse, following the selected replay frame. Use flowing layout so the meters do not cover tire values on small screens.

## Validation and remaining work

See the delivery validation logs for actual results. PMR checks use synthetic protocol fixtures plus actual local UDP transport. Windows in-game PMR capture and the corrected AMS2 heading still require Shawn's driving test. A real PMR packet fixture was added in the subsequent connection fix below. No Windows installer build, AI-provider evaluation or broad browser E2E run is claimed.

Protocol provenance and a detailed acceptance checklist are in `docs/development/pmr-native-preview.md`. Earlier AMS2 connector, UI scaling, dates, Live navigation, sector/pressure, stale-data and LAN QR changes remain documented in `docs/contributing/ams2-preview-patch-notes.md`.

### Mixed packet versions connection fix

- Real PMR capture uses v1 race/session and player state with v2 vehicle telemetry. Decode each type by its own version and join by player vehicle identity and freshness. Preserve all original packet bytes in replay.
- Added a regression fixture from a real driving capture, with the player name replaced.

### Session Overview map display fix

- Cap the shared Overview sector map at 28rem and remove its full-width square panel sizing.
- Fit Overview bounds to the displayed recorded lap instead of invisible track edges; preserve edge-inclusive bounds in Track Focus.
- Replay map sizing and track orientation are unchanged. The affected Overview code was inherited, with no changes in the earlier AMS2/PMR patches. A distant-edge regression test reproduces the tiny-line failure; the exact EVO recording still needs user confirmation.
