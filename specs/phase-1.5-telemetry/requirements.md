# Requirements: Phase 1.5 — Telemetry, Streaks, Heatmap, Repertoire Pick

## Introduction

Phase 1 shipped the SRS data layer with mastery boxes + due queues. Phase 1c lit up the v1 loop (queue routing, presets, summary screen, per-line reset). What's still missing is the **feedback layer**: the user has no visibility into their own training behaviour beyond "N due today" and no record of what happened in past sessions. The dashboard cannot show momentum (streaks), distribution (heatmap), or correctness trend (accuracy %) because no per-event data is recorded.

Phase 1.5 adds an **append-only session events log** in IndexedDB as the single source of truth, and builds four user-facing surfaces on top: drill-day + line-mastery streaks, a tabbed heatmap (daily activity / per-opening accuracy / hour-of-day), all-time + rolling-7-day accuracy %, and the deferred **RepertoirePick** layer (preset + manual overrides on top, keyed by stable `line.id` per Article 6).

This phase is local-first by Article 11 — no events leave the device. Backend remains optional per Article 12. The presets store extends `scripts/curated/presets.yml` from Phase 1c rather than introducing a parallel format. The heatmap is a new visualization primitive (calendar grid + bucket grid) and is **not** the square-highlight primitive of Article 15; that primitive remains reserved for board overlays in Phase 3 AI Coach.

Seven requirements. R1 (events store + repository) is the foundation — everything else reads from it. R5 (RepertoirePick) is independent and can land first or last.

## Requirements

### Requirement 1: Session events log + EventsRepository

**User Story:** As the app, I need a durable append-only record of every drill event so that streaks, heatmap, and accuracy can be derived without ad-hoc state in components.

#### Acceptance Criteria

1. THE SYSTEM SHALL define a new IndexedDB object store `session_events` with key path `id` (auto-increment) and indices on `timestamp`, `lineId`, and `eventType`.
2. THE SYSTEM SHALL define an `EventsRepository` interface (Article 5) with at minimum: `append(event)`, `listByDateRange(from, to)`, `listByLine(lineId)`, `aggregate(query)`, `clearAll()`.
3. THE EVENT TYPES SHALL be exactly: `line_start`, `move_correct`, `move_wrong`, `hint_used`, `line_complete`, `line_abandoned`. No other event types are recorded in this phase.
4. EACH EVENT SHALL carry: `id`, `timestamp` (ms epoch, UTC), `eventType`, `lineId`, `plyIndex` (nullable for `line_start`/`line_abandoned`), `durationMs` (nullable; populated on `move_correct`/`move_wrong`/`line_complete`).
5. WHEN the drill page is mounted with a line, THE SYSTEM SHALL append a `line_start` event.
6. WHEN the user submits a move that the validator confirms correct, THE SYSTEM SHALL append a `move_correct` event with `plyIndex` and the ms elapsed since the previous event for that line.
7. WHEN the user submits a wrong move, THE SYSTEM SHALL append a `move_wrong` event with `plyIndex` and `durationMs`. Repeated wrong attempts at the same ply each emit their own event.
8. WHEN the user uses the hint affordance, THE SYSTEM SHALL append a `hint_used` event with `plyIndex`.
9. WHEN a line reaches `state.kind === 'complete'`, THE SYSTEM SHALL append a `line_complete` event with total `durationMs` for the line.
10. WHEN a line is left without completion (navigation away, picker change, queue exit), THE SYSTEM SHALL append a `line_abandoned` event with the last `plyIndex` reached.
11. THE EVENTS REPOSITORY SHALL be the only path through which app code touches `session_events` — components and hooks never open the store directly (Article 5).
12. THE SYSTEM SHALL never transmit events off-device (Article 11). No fetch, no beacon, no postMessage to a non-self origin.

### Requirement 2: Streaks — both drill-day and line-mastery

**User Story:** As a player, I want to see both my daily-commitment streak and my recent-mastery streak side-by-side so I can tell whether I'm consistent AND accurate, not just one or the other.

#### Acceptance Criteria

1. THE SYSTEM SHALL compute a **drill-day streak**: the number of consecutive calendar days (user's local timezone) on which at least one `line_start` event exists in `session_events`. A day with zero `line_start` events breaks the streak.
2. THE SYSTEM SHALL compute a **line-mastery streak**: the number of consecutive `line_complete` events (in timestamp order, most recent first) for which the corresponding line had **zero `move_wrong` events on the first attempt** at each ply within that line session.
3. THE LINE-MASTERY STREAK SHALL reset to zero on the first `line_complete` that contained any `move_wrong` event, OR on any `line_abandoned` event.
4. THE DASHBOARD SHALL render both streaks side-by-side in a two-card row, labelled "Days in a row" and "Clean lines in a row" with the numeric value and an icon.
5. WHEN either streak is zero, THE CARD SHALL render with a muted style and a one-line encouragement caption ("Start a drill to begin").
6. THE SYSTEM SHALL expose a `useStreaks()` hook returning `{ drillDayStreak, lineMasteryStreak, lastUpdated }`.
7. THE STREAK COMPUTATION SHALL be memoized and recompute only when new events are appended or on dashboard mount.

### Requirement 3: Tabbed heatmap

**User Story:** As a player, I want one place that shows me when I drill, how accurate I am across openings, and which hours of the day I tend to train, so I can spot patterns in my own behaviour.

#### Acceptance Criteria

1. THE DASHBOARD SHALL include a "Heatmap" panel with three tabs in this fixed order: **Daily activity**, **Per-opening accuracy**, **Hour of day**.
2. THE **Daily activity** TAB SHALL render a GitHub-style year grid (52 weeks × 7 days, ending on today) where each cell's colour intensity reflects the count of `line_start` events on that calendar day. Empty days render as the lowest tier. The legend SHALL show the bucket thresholds.
3. THE **Per-opening accuracy** TAB SHALL render a grid with one row per opening family present in events and columns for accuracy buckets `0-49%`, `50-69%`, `70-84%`, `85-94%`, `95-100%`. The cell at (family, bucket) SHALL show how many lines in that family fall in that bucket, where line accuracy = `move_correct / (move_correct + move_wrong)` over all events for that lineId.
4. THE **Hour of day** TAB SHALL render a 24-cell row chart (hours 0..23 in local time) where each cell's intensity reflects the count of `line_start` events that occurred during that hour across the available history.
5. EACH TAB SHALL render an empty-state caption when there is no data ("Drill a line to start seeing your activity here") — the panel is never hidden.
6. THE HEATMAP COMPONENT SHALL be implemented as a single `HeatmapTabs` component with three child renderers; it SHALL NOT reuse the board square-highlight primitive of Article 15 (different domain, different primitive — explicitly noted here so future refactors don't try to merge them).
7. TAB SELECTION SHALL persist across navigation in `localStorage` under key `tabiya.heatmapTab`.

### Requirement 4: Accuracy % — all-time and rolling 7-day

**User Story:** As a player, I want to see both my long-term accuracy and my recent accuracy so a bad week doesn't hide behind a good year, and a good day doesn't mask a long-term issue.

#### Acceptance Criteria

1. THE DASHBOARD SHALL render two accuracy cards side-by-side: "All-time accuracy" and "Last 7 days".
2. THE ALL-TIME ACCURACY SHALL be computed as `move_correct / (move_correct + move_wrong)` over **all** events ever recorded for the current user.
3. THE ROLLING 7-DAY ACCURACY SHALL be computed over events with `timestamp` within the last 7 × 24 hours of `now`.
4. EACH CARD SHALL show the percentage to one decimal place, the count of moves it was computed over, and a small delta indicator comparing 7-day vs all-time (`+1.2pp`, `-0.4pp`, or `=`).
5. WHEN the denominator is zero (no moves yet), THE CARD SHALL show `—` and the caption "No moves yet".
6. THE REPERTOIRE PAGE LINE ROW SHALL display per-line accuracy (all-time only) computed from that line's events, rendered as a small badge next to the line name.
7. ACCURACY COMPUTATION SHALL go through `EventsRepository.aggregate({...})` — components never iterate raw events.

### Requirement 5: RepertoirePick layer (preset + manual override)

**User Story:** As a player, I want to start from a preset repertoire (Beginner / Intermediate / Advanced) and then add or remove specific lines on top, so my pick is mine without me building it from scratch.

#### Acceptance Criteria

1. THE SYSTEM SHALL extend `scripts/curated/presets.yml` (introduced in Phase 1c) with an explicit `lines: [...]` array per preset, listing line IDs that the preset includes. Existing tier-band filtering remains as a derivation fallback when `lines` is absent.
2. THE SYSTEM SHALL persist the user's RepertoirePick as `{ presetId, additions: [lineId], removals: [lineId] }` in IndexedDB store `repertoire_pick` (single-row, key `current`).
3. THE EFFECTIVE PICK SHALL be computed as: `(preset.lines ∪ additions) \ removals`, keyed by stable line.id (Article 6).
4. THE SETTINGS / REPERTOIRE PAGE SHALL render a `RepertoirePicker` panel showing the active preset, the count of effective lines, and an expandable list of all catalog lines with per-line checkboxes reflecting the current effective state.
5. TOGGLING a checkbox that is part of the preset SHALL add the line to `removals` (or remove it from `removals` if re-checking).
6. TOGGLING a checkbox that is NOT part of the preset SHALL add the line to `additions` (or remove it from `additions` if unchecking).
7. CHANGING the preset SHALL clear `additions` and `removals` after a confirm dialog ("Switching presets will clear your manual additions and removals. Continue?").
8. THE DRILL QUEUE + REPERTOIRE PAGE + DUE LIST SHALL filter to the effective pick. Lines outside the effective pick SHALL NOT appear in queue mode (`?queue=due` from Phase 1c) or in the family grid by default; a "Show all" toggle SHALL expose them.
9. A NEW USER (no `repertoire_pick` row) SHALL default to `{ presetId: 'off', additions: [], removals: [] }` — i.e. all lines visible (matches Phase 1c "Off — custom").
10. THE RepertoirePick SHALL be reachable from a `RepertoireRepository` interface (Article 5) — no direct IndexedDB calls from components.

### Requirement 6: IndexedDB schema migration + repositories wiring

**User Story:** As a maintainer, I need the new stores to land via a versioned schema migration so existing users don't lose their SRS state.

#### Acceptance Criteria

1. THE SYSTEM SHALL bump the IndexedDB schema version to introduce `session_events` and `repertoire_pick` stores.
2. THE MIGRATION SHALL be additive — no existing store (SRS, catalog cache) is dropped or rewritten.
3. WHEN the migration runs on a fresh browser, both new stores SHALL be created empty.
4. WHEN the migration runs on an existing Phase 1c user, SRS data SHALL remain intact and queryable. A migration test SHALL assert this.
5. THE EventsRepository AND RepertoireRepository SHALL be wired through the existing DI container alongside OpeningRepository + SrsRepository (Article 5).
6. THE SYSTEM SHALL expose a "Reset telemetry" action in Settings that calls `EventsRepository.clearAll()` with a confirm dialog. SRS state is untouched by this action.

### Requirement 7: Quality gates + tests

**User Story:** As a maintainer, I need test coverage + lint guarantees to land with this phase or the next phase inherits hidden regressions.

#### Acceptance Criteria

1. UNIT TESTS SHALL cover `EventsRepository` (append, listByDateRange, listByLine, aggregate, clearAll) with ≥15 cases including empty store, single-day, multi-day boundaries, and timezone edges.
2. UNIT TESTS SHALL cover `useStreaks` for: zero events, single-day streak, multi-day continuous streak, broken streak by gap day, mastery streak broken by wrong move, mastery streak broken by abandonment.
3. UNIT TESTS SHALL cover accuracy aggregation: zero denominator, all-correct, mixed, 7-day window boundary at the second.
4. UNIT TESTS SHALL cover `RepertoirePicker` state transitions: preset switch with confirm, add/remove toggles, effective pick derivation, default-user case.
5. INTEGRATION TEST SHALL drive a drill from start to complete + verify the exact event sequence emitted matches `[line_start, move_correct..., line_complete]` with correct `plyIndex` ordering.
6. INTEGRATION TEST SHALL cover schema migration from Phase 1c state → Phase 1.5 state without SRS loss.
7. NO `any` IN NEW TYPESCRIPT (Article 14). Python type hints on any new build script touching presets.
8. BUILD SIZE BUDGET: +20kB gzip cap combined for `HeatmapTabs`, `RepertoirePicker`, `useStreaks`, and the events repository. Charting library, if any, must be tree-shaken or hand-rolled SVG.
9. EXISTING TESTS FROM Phases 0/1/1c SHALL continue to pass. No SRS, drill, or catalog regressions.

## Constitution compliance

- Article 5 (Repository): new `EventsRepository` + `RepertoireRepository` interfaces; all reads/writes go through them.
- Article 6 (Stable line.id): RepertoirePick additions/removals + per-line accuracy keyed by `line.id` only.
- Article 11 (Local-first): every event stays in IndexedDB; no network egress; "Reset telemetry" is fully local.
- Article 12 (Backend optional): nothing in this phase requires a backend.
- Article 13 (Weekend pace): see Timebox; pauses immediately on main-plan conflict.
- Article 14 (Type discipline): TS strict no-`any`; Python type hints on any presets.yml tooling.
- Article 15 (Single highlight primitive): heatmap is a calendar/bucket primitive, explicitly **not** the board square-highlight; that primitive remains reserved for Phase 3 AI Coach and is untouched here.

## Files touched (forecast)

- `src/types/events.ts` — `SessionEvent`, `EventType`, `EventQuery` types
- `src/types/repertoire.ts` — `RepertoirePick`, `EffectivePick` types
- `src/repository/EventsRepository.ts` — interface
- `src/repository/IndexedDbEventsRepository.ts` — concrete implementation
- `src/repository/RepertoireRepository.ts` — interface
- `src/repository/IndexedDbRepertoireRepository.ts` — concrete implementation
- `src/repository/db/schema.ts` — version bump, new stores, migration
- `src/repository/container.ts` — DI wiring for both new repos
- `src/hooks/useStreaks.ts` — drill-day + line-mastery
- `src/hooks/useAccuracy.ts` — all-time + 7-day, per-line variant
- `src/hooks/useEventEmitter.ts` — thin wrapper drill page uses to append events
- `src/components/dashboard/StreaksRow.tsx` — two-card row
- `src/components/dashboard/AccuracyRow.tsx` — two-card row
- `src/components/dashboard/HeatmapTabs.tsx` — tab shell
- `src/components/dashboard/heatmap/DailyActivityGrid.tsx`
- `src/components/dashboard/heatmap/OpeningAccuracyGrid.tsx`
- `src/components/dashboard/heatmap/HourOfDayRow.tsx`
- `src/components/repertoire/RepertoirePicker.tsx`
- `src/components/drill/DrillPage.tsx` — emit events at the right transitions
- `src/components/settings/ResetTelemetryButton.tsx`
- `scripts/curated/presets.yml` — extend each preset with explicit `lines: [...]`
- `scripts/validate_presets.py` — assert preset line IDs exist in catalog
- `tests/events/EventsRepository.spec.ts`
- `tests/events/migration.spec.ts`
- `tests/hooks/useStreaks.spec.ts`
- `tests/hooks/useAccuracy.spec.ts`
- `tests/components/RepertoirePicker.spec.tsx`
- `tests/integration/drill-emits-events.spec.tsx`

## Out of scope

- Server-side telemetry, analytics pipelines, or any network egress of events.
- Multi-user accounts, login, or sync across devices.
- Social features: leaderboards, sharing streaks, comparing accuracy.
- Export to CSV / JSON / PGN of session events (capture for a later micro-phase if asked).
- New event types beyond the six listed in R1.3 (e.g. `board_flipped`, `pause`, `resume` — out).
- Mobile-specific layout tuning for heatmap (desktop-first; mobile gets a stacked fallback but no bespoke design).
- Charting library adoption — hand-roll SVG / CSS grid to stay under the 20kB budget.

## Open questions

1. **Retention cap on `session_events`.** IndexedDB has no hard size guarantee across browsers, and a heavy user could accumulate tens of thousands of events over a year. Lean: keep all events for v1.5, revisit with a "compact events older than 365 days into per-day aggregates" pass in a later phase. Decision needed before merge: ship uncapped or land the compaction job now?
2. **Streak timezone semantics.** Drill-day streak uses local timezone — what happens when the user travels and their device clock jumps a day? Lean: treat each day boundary by the device's current local timezone at query time; document the edge case and don't try to be clever. Confirm acceptable.
3. **Per-line accuracy floor for the "Per-opening accuracy" heatmap tab.** A line drilled twice with one wrong move shows 50% and dominates the visualization. Lean: only include lines with ≥5 completed sessions in that view, render a footnote ("lines with <5 sessions hidden"). Confirm threshold.

## Timebox

- Spec + design: 1 weekend half-day (this).
- R1 (events store + repository) + R6 (migration) + tests: 1 weekend day.
- R2 (streaks) + R4 (accuracy %) + tests: 1 weekend half-day.
- R3 (heatmap tabs, all three): 1 weekend day.
- R5 (RepertoirePick + presets.yml extension + tests): 1 weekend day.
- R7 polish + integration test + size budget verification: 1 weekend half-day.

Total: 4 weekend days. If overrun by 50%, cut the **Per-opening accuracy** and **Hour of day** tabs from R3 — ship only the daily activity grid and re-spec the other two tabs separately. Article 13 holds: pauses immediately if the main AI/ML plan slips.
