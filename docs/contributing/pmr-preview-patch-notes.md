# Project Motor Racing preview review notes

## Scope

- Add a standalone PMR adapter and metadata package on upstream main. AMS2 support and unrelated UI changes are excluded.
- Receive native UDP on port 7576, with multicast support and independently versioned v1/v2 race, player-state and vehicle packets.
- Match the selected player vehicle, reject malformed datagrams, expire stale player context, and reset on session changes.
- Discover game-specific car/track names and enable PMR navigation, catalogs, sessions, analysis and replay.
- Retain the original datagrams in self-contained source frames and lossless sparse recordings.
- Use native v2 timing and validity where present; document estimated v1 timing and unavailable source fields.
- Support native sector indices and split durations through an optional shared adapter contract, without inventing equal-third sector positions.
- Clear stale PMR live displays and preserve schema information so telemetry can resume.
- Request both Analyse G-force axes and avoid inventing suspension compression readings for PMR.

## Verification

The protocol tests cover synthetic v1/v2 packets and a recorded mixed-version packet fixture with the player name replaced. Other checks exercise local UDP transport, player selection, resets, native timing, invalid laps, raw replay and sparse-recording reconstruction. UI and runtime regressions cover game routes, unsupported compression, G-force requests and stale display resumption.

The standalone branch requires an in-game Windows acceptance pass; previous testing of the combined prototype does not establish that this extracted branch has been driven in-game. Final automated results are recorded after validation. Protocol sources and the Windows checklist are in [the developer guide](../development/pmr-native-preview.md).

Automated validation: full project typecheck passed; 86 focused protocol, recording, route, runtime and client tests passed; the client production build passed. The commit also runs the repository's standard pre-commit checks.
