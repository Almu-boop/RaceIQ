# AMS2 real raw-dump fixtures

These fixtures come from `bun run dev:dump:ams2` captures made before entering
the session. They are not exports of ordinary RaceIQ session recordings.
Original local dumps remain untouched and are not committed.

| Fixture | Scenario |
| --- | --- |
| `time-trial.bin.gz` | Native practice session, two untimed start-line crossings, three timed laps, menu exit |
| `race-pit-stop.bin.gz` | Five-lap race with a pause and manually driven pit stop; grid start and unfinished cooldown |
| `weekend-sparse-qualifying.bin.gz` | Practice → sparse qualifying → race, including the stale finished qualifying frame |
| `qualifying.bin.gz` | Healthy qualifying capture, four completed laps, transition to the next race and menu exit |

## Reduction and provenance

Fixtures use the real AMS2 dump framing, UTC timestamps, sequence numbers and
decoded telemetry bytes. The generator retains samples at approximately 10 Hz,
both sides of session/game/race/lap/pit/invalid/timing-state changes, start-line
zone changes, and the first/last sample. Sparse input stays sparse.

All 64 participant-name fields are zeroed. Frames retain only the known
7,388-byte ABI prefix; unknown extensions and page padding are omitted rather
than publishing potentially identifying unknown fields. Frame lengths and the
dump count are rewritten to describe this reduced fixture, then gzip-compressed.
These are reduced real-source fixtures, not byte-for-byte original dumps.
Synthetic reader/recorder tests separately cover full mapped extensions.

`manifest.json` records original filenames, frame counts, SHA-256 of concatenated
original source frames, and compressed fixture hashes/sizes. The source-frame
hash does not include the dump header or record-length prefixes.

Regenerate from the repository root with the original recordings available:

```powershell
bun packages/game-ams2/test-support/generate-fixtures.ts "C:\path\to\original-dumps"
```

This rewrites the four generated fixture files and manifest, never source dumps.

Run through the isolated integration runner:

```powershell
bun run --filter '@raceiq/game-ams2' test:integration
```

Tests replay the real snapshots through the AMS2 source and lap detector with
an in-memory capturing database, restoring acquisition time from each frame.
They assert session detection and menu-driven finalisation before EOF, timed
laps/validity, pit exclusions, and suppression of the stale transition session.

They do not exercise live Windows memory acquisition, reproduce the earlier
qualifying sample loss, validate export ZIPs, or fix stale raw-import transitions.
The existing unfinished cooldown entry remains excluded, not silently removed.
