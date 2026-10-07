# RaceIQ running change log

This log records work continued locally in Codex. Update it alongside future changes so it can support GitHub commits and pull-request descriptions. Keep user-facing release notes in CHANGELOG.md.

## Working state

- Intended delivery branch: pmr-support, based on AMS2 preview commit 494d8de967561cb568ea7755aa0f275234ae486e.
- Last inspected tracking branch: origin/ams2-native-preview. Verify and correct the PMR push destination before publishing.
- Existing AMS2, PMR and shared UI work was already uncommitted when this continuation began. Do not overwrite or discard it.
- No commits, pushes, branch switches or remote uploads have been performed in this continuation.

## 2026-10-05 — Restore Analyse G-force and suspension display

Problem: AMS2 and PMR showed a G-force circle without a dot. AMS2's compression indicator appeared off-center; PMR's center was blank.

Changes:
- Add longitudinal acceleration to the shared Analyse telemetry request. The G-force meter needs both lateral and longitudinal acceleration.
- Widen the shared tire diagram and keep the compression indicator label in its centered layout.
- Explain unavailable PMR compression data instead of fabricating a suspension dot. A real PMR compression indicator still requires a verified native-data mapping.

Validation: 32 focused client tests passed; 11 changelog tests passed; full repository typecheck passed after preserving and clearing the generated backend TypeScript cache; Windows production build passed. Shawn visually confirmed the updated display looked good.

## 2026-10-05 — Remove body-attitude gauge from 2D Analyse

Changes:
- Remove the circled body-attitude gauge from the shared 2D Analyse panel for every game.
- Retain the G-force circle in 2D and the existing body-attitude gauge in 3D.
- Leave raceiq-2d-gforce-duplicate-fix unapplied: that patch removes the G-force circle, and Shawn explicitly chose to keep it.

Validation: structural check confirmed the 2D/3D gauge placement; 11 changelog tests and full repository typecheck passed; Windows production build passed. No separate post-build visual confirmation is recorded.

## 2026-10-05 — Prevent unfinished laps from defining session maps

Problem: AC Evo session Overview showed a partial Brands Hatch Indy map despite completed laps containing full world positions.

Evidence:
- The running application's aligned-telemetry response selected lap ID 8, the unfinished fourth lap, as its reference and used a span of approximately 55.17 metres.
- Completed laps were marked invalid, so the old reference selection favored the short unfinished lap.

Changes:
- Prefer completed laps with a finite, positive lap time when choosing an alignment reference, before applying existing validity and distance preferences.
- Keep unfinished laps in the selected set and preserve recorded data.
- Add an order-independent regression for completed invalid laps plus an unfinished tail.
- The alignment path is shared by all games, so this addresses the same failure mode across games. Other map causes remain outside this fix.

Validation: 17 alignment/changelog tests and full repository typecheck passed; Windows production build passed. A stored completed EVO lap combined with a synthetic unfinished tail retained approximately 586 by 389 metres of map coverage. That diagnostic used a real completed lap and a synthetic tail, not an exact replay of all four stored lap inputs. Shawn's post-build visual confirmation is pending.

## Patch audit and build preservation

- Inspected supplied patch bundles without blindly reapplying overlapping historical changes.
- Verified key code from the PMR protocol-2/player-join fixes, AMS2 heading fix and commit-check wiring was already present.
- Whole-patch forward/reverse checks did not fit the evolved checkout; this is not a claim that every historical hunk was individually verified.
- The Brands Hatch export contains AC Evo telemetry, not a source patch.
- Backed up the previous dist folder before each rebuild and restored its data afterward. Each completed rebuild preserved 1,656 original files with zero hash mismatches.
- The backend TS2589 error recurred after code changes and cleared after backing up and removing only apps/backend/dist/tsconfig.tsbuildinfo. No backend source workaround was introduced.

## Future entry format

Record date, user-visible problem, final behavior, important scope/limitations, tests and build results, user confirmation, and commit/PR identifiers once actually created. Do not invent verification or publication results.
## 2026-10-05 — GitHub checkpoint preparation

- Reviewed the local pmr-support branch at 494d8de967561cb568ea7755aa0f275234ae486e. GitHub's pmr-support branch matched this commit at the time of inspection.
- The local upstream still points to origin/ams2-native-preview; the proposed checkpoint destination is origin/pmr-support.
- Locale keys, full typecheck, test shard checks, unit tests, tooling tests, lint, telemetry catalog validation, and Git whitespace checks passed.
- Proposed scope: existing PMR/AMS2 source changes, shared UI/map fixes, related tests, generated catalogs, documentation, and Playwright build dependency configuration.
- Exclude personal ams2-test-data, executables/build output, and the unreferenced iRacing SVG asset directory. Preserve these files locally.
- No files were staged, committed, or pushed during preparation. Shawn subsequently approved creating and pushing this checkpoint to origin/pmr-support.

## 2026-10-06 — Synchronize with upstream RaceIQ

- Updated fork/local main to upstream 3d29e798 and local ams2-pr-review to the GitHub conflict-resolution commit debc4da9.
- Preserved combined checkpoint 5f56ddc8 in backup/pmr-before-upstream-2026-10-06 before merging upstream into pmr-support.
- Backed up untracked iRacing map assets under the chat workspace work/iracing-maps-before-sync-2026-10-06 before accepting upstream's tracked maps.
- Retained upstream ignore entries and regenerated telemetry catalogs from merged source to resolve conflicts. No manual AMS2/PMR capture-code conflict resolution was needed.
- Personal ams2-test-data remains excluded. Existing executable has not been rebuilt as part of this source synchronization.
- Validation before merge commit: 29 AMS2/PMR/alignment tests, 32 client telemetry UI tests, and 36 changelog/race-result/session tests passed. Repository commit hooks also run before the merge is saved.
- Initial commit hook typecheck encountered the known backend TS2589 incremental-cache failure. Backed up and removed only apps/backend/dist/tsconfig.tsbuildinfo before rerunning the checks.
