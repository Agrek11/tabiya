# Requirements: Phase 1 — SRS Data Layer

## Introduction

Phase 1 ships the spaced-repetition scheduling engine and persistence layer that activate every "real data" surface in v1. Today the Repertoire mastery bars, Dashboard "Lines mastered" + "Due for review" counts, drill queue, and sidebar progress widget all render ghost placeholders. After Phase 1 they become real.

The engine is a 5-box Leitner scheduler with friction-tuned promotion/demotion rules tailored to the auto-undo drill loop (Phase 0d.1). State lives in browser IndexedDB, accessed exclusively through a new `SrsRepository` interface that mirrors `OpeningRepository` (Constitution Article 5). State is keyed by stable `line.id` (Article 6) and survives every catalog refresh.

Phase 1 deliberately does not include analytics or session event logging — those land in Phase 1.5. Phase 1 stores enough state to drive scheduling and mastery bars; Phase 1.5 adds the append-only event stream for heatmaps, accuracy curves, and trend charts.

## Requirements

### Requirement 1: SRS State Schema

**User Story:** As the developer, I want a typed, durable SRS state record per drilled line, so that scheduling decisions are deterministic and replayable.

#### Acceptance Criteria

1. THE SYSTEM SHALL persist exactly one `SrsState` record per `line.id` that the user has ever completed a drill on.
2. EACH `SrsState` record SHALL include: `line_id` (string, primary key), `box` (integer 1–5), `last_reviewed` (ISO 8601 timestamp), `attempts` (integer ≥ 1, total drill completions), `wrong_attempts_total` (integer ≥ 0, lifetime wrong moves), `hint_uses_total` (integer ≥ 0, lifetime hint-button presses).
3. THE SYSTEM SHALL NOT create an `SrsState` record for a line until the user has completed a drill on that line at least once (initial state = "unseen").
4. THE SYSTEM SHALL keep `SrsState` keyed by `line_id` only — no opening_id, no family_id, no schema-derived fields. Catalog refreshes that re-emit the same line.id MUST preserve the user's existing record (Constitution Article 6).
5. THE SYSTEM SHALL store `SrsState` in IndexedDB via the `idb` wrapper, in a database scoped to tabiya, store name `srs_state`.
6. THE SYSTEM SHALL NOT store SRS state in localStorage, sessionStorage, or any non-durable medium.

### Requirement 2: Leitner Box Intervals

**User Story:** As a player, I want repeated review of weak lines and longer gaps for mastered ones, so that my study time concentrates where it matters.

#### Acceptance Criteria

1. THE SYSTEM SHALL define exactly 5 boxes with these review intervals: Box 1 = 1 day, Box 2 = 3 days, Box 3 = 7 days (1 week), Box 4 = 14 days (2 weeks), Box 5 = 30 days (1 month).
2. A line SHALL be "due for review" WHEN `now >= last_reviewed + box_interval`.
3. THE SYSTEM SHALL evaluate "due" using local time of the user's machine (no UTC normalization in the v1 query path).
4. THE SYSTEM SHALL expose box intervals as a single source-of-truth constant array, importable by both scheduler and UI mapping code.

### Requirement 3: Promotion / Demotion Rules (Friction-tuned)

**User Story:** As a player, I want the scheduler to forgive minor slips but react to genuine confusion, so that drilling stays motivating without losing signal.

#### Acceptance Criteria

1. WHEN the user completes a drill of a line WITH `wrong_attempts == 0` THE SYSTEM SHALL promote the line by one box, capped at Box 5.
2. WHEN the user completes a drill of a line WITH `wrong_attempts ∈ {1, 2}` THE SYSTEM SHALL leave `box` unchanged BUT update `last_reviewed = now` so the line exits the due queue.
3. WHEN the user completes a drill of a line WITH `wrong_attempts ≥ 3` THE SYSTEM SHALL demote the line by exactly one box, with a floor of Box 1 (never below).
4. THE SYSTEM SHALL NOT change `box` based on hint usage. Hint presses SHALL be counted separately and SHALL NOT contribute to `wrong_attempts` for promotion/demotion purposes.
5. WHEN the user has never drilled a line before AND completes a drill of it THE SYSTEM SHALL create an `SrsState` record at Box 1 IF `wrong_attempts ≥ 3` ELSE at Box 2 (so a flawless first attempt promotes; a struggling first attempt stays at Box 1).
6. THE SYSTEM SHALL increment `attempts` by 1, increment `wrong_attempts_total` by the drill's `wrong_attempts`, and increment `hint_uses_total` by the drill's hint-press count, on every drill completion.
7. WHEN the user clicks Skip mid-drill THE SYSTEM SHALL NOT update any `SrsState` record. The drill is treated as abandoned.
8. THE SYSTEM SHALL implement promotion / demotion logic as a pure function `nextSrsState(prev: SrsState | null, drillResult: DrillResult): SrsState` so that scheduling decisions are unit-testable without IndexedDB.

### Requirement 4: SrsRepository Interface

**User Story:** As the developer, I want a single repository interface for SRS state, so that Dashboard, Repertoire, and Drill consume it through one surface and storage swaps are single-DI changes.

#### Acceptance Criteria

1. THE SYSTEM SHALL declare a TypeScript interface `SrsRepository` with these methods: `getState(lineId: string): Promise<SrsState | null>`, `listAllStates(): Promise<SrsState[]>`, `recordDrillResult(lineId: string, result: DrillResult): Promise<SrsState>`, `resetState(lineId: string): Promise<void>`, `resetAll(): Promise<void>`.
2. THE SYSTEM SHALL ship `IndexedDbSrsRepository` as the v1 concrete implementation backed by `idb`.
3. THE SYSTEM SHALL ship `InMemorySrsRepository` as a test-only implementation for unit and integration tests.
4. THE SYSTEM SHALL expose a `getSrsRepository(): SrsRepository` factory in `src/storage/index.ts` mirroring the existing `getRepository()` (Constitution Article 5).
5. CONSUMERS SHALL NOT import `IndexedDbSrsRepository` directly. The DI factory is the only entry point.
6. THE SYSTEM SHALL provide a `_setSrsRepositoryForTesting(repo: SrsRepository | null): void` test escape hatch consistent with the existing pattern.

### Requirement 5: Drill Flow Integration

**User Story:** As a player, I want the SRS state to update automatically when I finish a drill, so that I never have to manually mark lines as "got it".

#### Acceptance Criteria

1. WHEN the drill state machine reaches the `complete` terminal state THE SYSTEM SHALL invoke `SrsRepository.recordDrillResult(lineId, drillResult)` exactly once.
2. THE `DrillResult` payload SHALL include: `wrong_attempts: number`, `hint_uses: number`, `duration_ms: number`, `completed_at: ISO timestamp`. (Phase 1 only consumes the first two; the rest are forward-compatible payload for Phase 1.5 event log.)
3. THE SYSTEM SHALL NOT call `recordDrillResult` if the drill terminates via Skip, navigation away, or any non-`complete` exit.
4. THE SYSTEM SHALL NOT block the drill UI on the SRS write — the write is fire-and-forget, but errors SHALL be logged to console.
5. WHEN the user starts a new drill of the same line, THE SYSTEM SHALL begin with fresh per-drill counters (`wrong_attempts = 0`, `hint_uses = 0`). Lifetime totals stay in `SrsState`, per-drill counters live in the drill state machine.

### Requirement 6: useSRS Hook

**User Story:** As a UI developer, I want a single React hook for reading SRS state, so that consuming components stay simple and consistent.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship a `useSRS()` hook returning `{ states: Map<string, SrsState>, dueLineIds: string[], loading: boolean, error: Error | null, refresh: () => Promise<void> }`.
2. THE HOOK SHALL load all states once on mount via `listAllStates()` and cache them in the hook's local state.
3. THE HOOK SHALL recompute `dueLineIds` from `states` whenever states change, using the box-interval table from Requirement 2.
4. THE HOOK SHALL expose a `refresh()` callback that re-reads from the repository, so post-drill navigation back to a list page sees fresh data.
5. THE HOOK SHALL NOT poll on a timer. Updates happen via explicit refresh or component remount.

### Requirement 7: Mastery Bar Mapping

**User Story:** As a player, I want a visible per-line mastery indicator so that I can see my progress at a glance.

#### Acceptance Criteria

1. THE SYSTEM SHALL map `box` values to mastery percentages: Box 1 = 20%, Box 2 = 40%, Box 3 = 60%, Box 4 = 80%, Box 5 = 100%.
2. THE SYSTEM SHALL render a line that has no `SrsState` record as 0% mastery with the existing "Drill to track" caption (RepertoirePage current ghost behavior).
3. THE SYSTEM SHALL aggregate per-line mastery to per-opening mastery as the simple arithmetic mean of all line mastery percentages within that opening.
4. THE SYSTEM SHALL aggregate per-opening mastery to per-family mastery as the simple arithmetic mean of all opening mastery percentages within that family. (Wires the family-rollup gate noted in Phase 0d.3 spec line 307.)
5. WHEN an opening has zero lines drilled, the opening mastery SHALL display as 0% with caption "Not started".

### Requirement 8: Dashboard Real Stats

**User Story:** As a player, I want the Dashboard to show real numbers I can act on, not placeholders.

#### Acceptance Criteria

1. THE DASHBOARD "Lines mastered" widget SHALL display `count(SrsState where box >= 4) / count(catalog.lines)` as a percentage.
2. THE DASHBOARD "Due for review" widget SHALL display `len(dueLineIds)` from the `useSRS` hook.
3. THE DASHBOARD "Drill" CTA SHALL navigate to `/drill?queue=due` when there are due lines, falling back to current behavior otherwise. (The drill page consumes the queue; the URL convention is reserved here.)
4. WHEN `count(SrsState) == 0` (no lines drilled yet) THE DASHBOARD SHALL render an empty-state message guiding the user to the Repertoire page to pick a first line.

### Requirement 9: Sidebar Progress Widget

**User Story:** As a player, I want a persistent reminder of what's due, so that I open the app and act, not browse.

#### Acceptance Criteria

1. THE SIDEBAR SHALL render the count of `dueLineIds` next to the Repertoire nav item OR an existing dedicated slot, whichever the v1 design system provides.
2. WHEN `dueLineIds.length == 0` THE SIDEBAR SHALL hide the badge entirely (no "0" badge clutter).
3. THE SIDEBAR badge SHALL update without a manual page refresh after a drill completes (uses `useSRS` `refresh()` or a shared store).

### Requirement 10: Reset Affordance

**User Story:** As a player, I want to reset SRS progress for a line or the whole catalog, so that I can recover from a long break or change of repertoire.

#### Acceptance Criteria

1. THE SETTINGS PAGE SHALL include a "Reset all SRS progress" button under a "Danger Zone" section.
2. WHEN the user clicks "Reset all SRS progress" THE SYSTEM SHALL show a confirmation dialog with the count of records about to be deleted before invoking `resetAll()`.
3. THE LINE-LEVEL CONTEXT MENU (or equivalent surface in v1 design system) SHALL include "Reset this line" invoking `resetState(lineId)`. Reuse existing UI surface; if none exists in v1, this requirement is deferred to Phase 1.5 follow-up.

### Requirement 11: Tests

**User Story:** As the developer, I want exhaustive scheduler tests, so that promotion/demotion math is correct on every release.

#### Acceptance Criteria

1. THE SYSTEM SHALL include unit tests for `nextSrsState` covering every transition combination: 0/1/2/3+ wrong attempts × Box 1–5 starting state × null prev (first drill).
2. THE SYSTEM SHALL include unit tests for the box-interval `isDue` predicate at exact boundary timestamps (just-after vs just-before due).
3. THE SYSTEM SHALL include integration tests for `IndexedDbSrsRepository` using `fake-indexeddb` (no real browser required) covering: empty initial state, write-then-read, write-then-update, reset single, reset all.
4. THE SYSTEM SHALL include component tests for `useSRS` using `InMemorySrsRepository` covering: load, due computation, refresh after recordDrillResult.
5. THE SYSTEM SHALL include an integration test for the full drill→SRS write pipeline (drill complete event triggers exactly one `recordDrillResult` call with correct payload).

### Requirement 12: Constitution Compliance

**User Story:** As the maintainer, I want Phase 1 to honor the constitution without exceptions.

#### Acceptance Criteria

1. THE SYSTEM SHALL NOT introduce any backend or network dependency for SRS state (Article 11 — local-first).
2. THE SYSTEM SHALL keep all consumer code dependent on `SrsRepository`, never on `IndexedDbSrsRepository` (Article 5).
3. THE SYSTEM SHALL key all state by stable line.id (Article 6) and survive a catalog refresh that re-emits the same line.id with no change to the line's drill experience.
4. THE SYSTEM SHALL use only open-source dependencies. The `idb` library (ISC license) is already declared and remains the only addition (Article 1).
5. THE SYSTEM SHALL keep TypeScript scoped to the browser bundle (Article 2). No Python equivalent SRS engine exists; all SRS logic is browser-side.

## Out of Scope (Phase 1.5+)

These intentionally do not appear in Phase 1 acceptance criteria:

- Append-only `session_events` log (Phase 1.5)
- Heatmap, accuracy %, time-this-week, recent activity, suggested-for-you (Phase 1.5)
- Streak counter (Phase 1.5)
- Period filters on Progress page (Phase 1.5)
- Trend indicators (Phase 1.5)
- Per-line stats display beyond the mastery bar (Phase 1.5)
- Multi-device sync (deferred v2+)

## Open Questions

None at requirements stage — all major decisions locked above. Tunable thresholds (1-2 stay, ≥3 demote, box intervals) may shift after first week of real-data feedback; the constants array makes that a one-line change.
