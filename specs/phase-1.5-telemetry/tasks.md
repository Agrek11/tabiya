# Tasks: Phase 1.5 — Telemetry, Streaks, Heatmap, Repertoire Pick

Each task is one agent session. Metadata block per task: ID, BlockedBy, Agent, File, Change, Outcome, Context. Requirements R1..R7 are from `requirements.md`; design sections are from `design.md`.

## Implementation Tasks

### Phase 1: Setup — IDB schema bump + new types

- [ ] **Task 1.1**: Extract shared DB schema module
  - **ID**: `task-1.1`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `src/repository/db/schema.ts`
  - **Change**: Create new module exporting `DB_NAME`, `DB_VERSION = 2`, and `runMigrations(db, oldVersion)` with v0→v1 (`srs_state`) and v1→v2 (`session_events`, `repertoire_pick`) blocks, each guarded by `objectStoreNames.contains`.
  - **Outcome**: One canonical upgrade path that both existing SRS repo and new Events/Repertoire repos open through; additive migration with no destructive ops.
  - **Context**: Requirement R6 criteria 1-3; design §6.2-6.3. Mirrors existing inline schema in `src/storage/srs/IndexedDbSrsRepository.ts` — that file later switches to import from here in Task 6.1. Pattern follows the `idb` library upgrade callback contract.

- [ ] **Task 1.2**: Define `SessionEvent` + `EventQuery` + `AggregateResult` types
  - **ID**: `task-1.2`
  - **BlockedBy**: `none`
  - **Agent**: `api-designer`
  - **File**: `src/types/events.ts`
  - **Change**: Export `EventType` union (six values), `SessionEvent` interface (`id`, `timestamp`, `eventType`, `lineId`, `plyIndex: number|null`, `durationMs: number|null`), `EventQuery` (`from?`, `to?`, `lineId?`, `eventTypes?`), `AggregateResult` (`countByType`, `totalMoves`, `correctMoves`, `accuracy: number|null`).
  - **Outcome**: Strict, no-`any` type surface for the events log; null is used for missing fields, not `undefined`.
  - **Context**: Requirement R1 criteria 3-4, R7 criterion 7; design §1.2. `id` is `number`, not `number|undefined` — repo assigns it on append and returns the persisted shape. EventType is the closed set R1.3.

- [ ] **Task 1.3**: Define `RepertoirePick` + `RepertoirePreset` + `EffectivePick` types
  - **ID**: `task-1.3`
  - **BlockedBy**: `none`
  - **Agent**: `api-designer`
  - **File**: `src/types/repertoire.ts`
  - **Change**: Export `RepertoirePreset` (extend existing with `lines: string[]`), `RepertoirePick` (`presetId`, `additions: string[]`, `removals: string[]`), `EffectivePick` (`lineIds: Set<string>`, `presetId`, `isFiltered: boolean`).
  - **Outcome**: One source of truth for preset + override + computed effective shape across components, hooks, repositories.
  - **Context**: Requirement R5 criteria 1-3, 9; design §5.2. The existing Phase 1c preset type must be extended, not replaced — keep `tier_band`, `family_ids`, `recommended_color`; add `lines: string[]`. `'off'` is a real preset id with `lines: []`.

### Phase 2: EventsRepository + migration (R1, R6)

- [ ] **Task 2.1**: Define `EventsRepository` interface
  - **ID**: `task-2.1`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `api-designer`
  - **File**: `src/repository/EventsRepository.ts`
  - **Change**: Export `EventsRepository` interface with `append`, `listByDateRange`, `listByLine`, `listAll`, `aggregate`, `clearAll`, `resetDbCache`.
  - **Outcome**: Article 5 seam — all event reads/writes go through this interface; concrete class is invisible to consumers.
  - **Context**: Requirement R1 criteria 2, 11; design §1.3. `listAll` is bounded by retention math in design §1.3 (<3 MB/year worst case). `resetDbCache` exists for test re-mocking, mirroring `IndexedDbSrsRepository`.

- [ ] **Task 2.2**: Implement `IndexedDbEventsRepository`
  - **ID**: `task-2.2`
  - **BlockedBy**: `task-1.1, task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/repository/IndexedDbEventsRepository.ts`
  - **Change**: Concrete class implementing `EventsRepository`. Lazy `dbPromise` cache; `getDb()` opens via shared `runMigrations`. Implement append (autoIncrement returns id), listByDateRange (timestamp index + IDBKeyRange.bound), listByLine (lineId_timestamp compound index), listAll, aggregate (route to listByLine / listByDateRange / listAll based on query), clearAll (db.clear). Include `isSessionEvent` runtime type guard that skips and `console.warn`s malformed rows.
  - **Outcome**: Production-ready append-only events store with per-call implicit transactions; corruption-resilient reads.
  - **Context**: Requirement R1 criteria 1, 4-12; design §1.1, §1.4, §1.7. Compound index `lineId_timestamp` exists for the hot per-line path. Mirror `IndexedDbSrsRepository`'s defensive-read pattern from Phase 1.

- [ ] **Task 2.3**: Define + implement `EventsBus` pub/sub
  - **ID**: `task-2.3`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/repository/EventsBus.ts`
  - **Change**: Export `EventsBus` interface (`subscribe(fn): unsubscribe`, `publish()`) and `createEventsBus()` factory. `publish` coalesces notifications via `requestAnimationFrame` so a burst of appends collapses to one subscriber callback.
  - **Outcome**: Single seam through which hooks observe new-event arrival without polling and without coupling to the repository class.
  - **Context**: Design §2.1 (`useEventsBus`), §2.3 (rAF coalescing), §6.5 (`wrapWithBusNotify` decorator). Pure in-memory — no IDB, no network. Coalescing prevents N recomputes during a fast drill burst.

- [ ] **Task 2.4**: Wire EventsRepository through DI container with bus-notify decorator
  - **ID**: `task-2.4`
  - **BlockedBy**: `task-2.2, task-2.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/index.ts`
  - **Change**: Add `_eventsRepo`, `_eventsBus` singletons; `getEventsRepository()` returns `wrapWithBusNotify(new IndexedDbEventsRepository(), bus)`; `getEventsBus()` returns the singleton; `_setEventsRepositoryForTesting(r)` for swap; `wrapWithBusNotify` decorator calls `bus.publish()` after `append` and `clearAll`.
  - **Outcome**: Article 5 wiring complete; consumer code calls `getEventsRepository()` and never imports the concrete class; bus notification is invisible to the repo implementation.
  - **Context**: Requirement R6 criterion 5; design §6.5. Pattern mirrors existing `getSrsRepository()`/`_setSrsRepositoryForTesting()` from Phase 1.

- [ ] **Task 2.5**: Migrate `IndexedDbSrsRepository` to import shared schema
  - **ID**: `task-2.5`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/srs/IndexedDbSrsRepository.ts`
  - **Change**: Replace inline `DB_NAME`/version/upgrade-callback with imports of `DB_NAME`, `DB_VERSION`, `runMigrations` from `src/repository/db/schema.ts`. No behavior change for SRS — only the source of the schema definition moves.
  - **Outcome**: Two stores, one upgrade path. The next phase that adds a store extends `runMigrations` only.
  - **Context**: Requirement R6 criterion 2 (additive migration — SRS untouched). Design §6.3. After this task the SRS repo and the new events repo open the same DB through the same callback. No SRS data is rewritten; the test in Task 8.3 will assert this.

### Phase 3: Drill event emission (R1.5-1.10)

- [ ] **Task 3.1**: Create `useEventEmitter` hook
  - **ID**: `task-3.1`
  - **BlockedBy**: `task-2.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useEventEmitter.ts`
  - **Change**: Hook takes `activeLine` and returns `{ emit(eventType, plyIndex?) }`. Internal refs: `lineStartTsRef`, `lastEventTsRef`, `lastPlyRef`. `useEffect` keyed on `activeLine.id` emits `line_start` on activation and `line_abandoned` on cleanup if latest state was not `complete`. `emit` schedules `getEventsRepository().append(...)` via `queueMicrotask` so writes never block render.
  - **Outcome**: Drill page gets a one-line emission API; lifecycle correctness (start on mount, abandoned on unmount unless complete) is owned by the hook, not the page.
  - **Context**: Requirement R1 criteria 5-10; design §1.5 transition table, §1.6 batching rationale. The hook is a passive observer — it does not own drill state, only records transitions.

- [ ] **Task 3.2**: Wire emission points into `DrillPage`
  - **ID**: `task-3.2`
  - **BlockedBy**: `task-3.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/drill/DrillPage.tsx`
  - **Change**: Import `useEventEmitter`. Call `emit('move_correct', plyIndex)` on validator-confirmed correct submit, `emit('move_wrong', plyIndex)` on wrong submit, `emit('hint_used', plyIndex)` on hint button click, `emit('line_complete', lastPly)` when `state.kind === 'complete'`. `line_start` / `line_abandoned` are owned by the hook.
  - **Outcome**: Drill page emits the exact event sequence R1.5-R1.10 specifies, at the right transitions, with correct `plyIndex`.
  - **Context**: Requirement R1 criteria 5-10; design §1.5. Each wrong attempt at the same ply gets its own event (R1.7) — do not collapse repeats. The complete transition's `durationMs` is `now - lineStartTs` (total line time), not the last move delta — the hook handles this distinction.

### Phase 4: Streaks + Accuracy hooks (R2, R4)

- [ ] **Task 4.1**: Implement `computeStreaks` pure function
  - **ID**: `task-4.1`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/streaks/computeStreaks.ts`
  - **Change**: Pure function `computeStreaks(events: SessionEvent[], now: Date): StreaksResult`. Uses `localDayKey(ts)` for drill-day grouping. Walks back from today over a `Set<localDayKey>` of `line_start` days. Mastery streak via `groupIntoLineSessions` (walks events, opens session on `line_start`, accumulates `move_wrong`, closes on `line_complete`/`line_abandoned`), then iterates terminal events newest-first; breaks on `line_abandoned` or `wrongMoves > 0`.
  - **Outcome**: Deterministic, pure, testable streak computation isolated from React.
  - **Context**: Requirement R2 criteria 1-3; design §2.2. Local timezone at query time per Open Question #2 disposition. A `line_start` without a terminal is dropped from mastery walk — neither breaks nor extends.

- [ ] **Task 4.2**: Create `useStreaks` hook
  - **ID**: `task-4.2`
  - **BlockedBy**: `task-4.1, task-2.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useStreaks.ts`
  - **Change**: Hook returns `{ drillDayStreak, lineMasteryStreak, lastUpdated }`. On mount and on `eventsBus.subscribe` callback, calls `getEventsRepository().listAll()` and pipes into `computeStreaks(events, new Date())`. Holds result in `useState`. Cleanup unsubscribes; cancelled flag guards async race.
  - **Outcome**: Component-friendly streak surface that recomputes only on append (via bus) or mount — no polling.
  - **Context**: Requirement R2 criteria 6-7; design §2.1, §2.3. The bus's rAF coalescing means a 6-move drill triggers one recompute, not six.

- [ ] **Task 4.3**: Create `useAccuracy` + `useLineAccuracy` hooks
  - **ID**: `task-4.3`
  - **BlockedBy**: `task-2.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useAccuracy.ts`
  - **Change**: `useAccuracy()` returns `{ allTime, rolling7d, deltaPp }` via two `aggregate` calls — `{}` for all-time, `{ from: now - 7d, to: now + 1 }` for rolling. Computes `deltaPp = (rolling.accuracy - allTime.accuracy) * 100` rounded to 1 decimal, `null` if either null. `useLineAccuracy(lineId)` reads from a shared `EventsContext` map to avoid N+1.
  - **Outcome**: One hook for dashboard cards, one for per-line badges; both go through `aggregate` so components never iterate raw events.
  - **Context**: Requirement R4 criteria 1-7; design §4.1-4.4. Null denominator → `null` accuracy → `—` in UI per R4.5. Delta within ±0.05pp renders as `=` per design §4.3.

- [ ] **Task 4.4**: Create `EventsContext` provider for dashboard fan-out
  - **ID**: `task-4.4`
  - **BlockedBy**: `task-2.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/state/EventsContext.tsx`
  - **Change**: React context exposing `{ events, perLineAggregates: Map<lineId, AggregateResult>, isLoading }`. Owns one `listAll()` per provider mount, subscribes to events bus, recomputes per-line map. Used by `DashboardPage` and `RepertoirePage` to prevent multiple independent `listAll`s.
  - **Outcome**: Single IDB read per dashboard mount instead of 3+ from independent hooks; per-line badge fan-out reads from the map.
  - **Context**: Design §4.4 (per-line badge data flow), §8 (`EventsContextProvider` as dedup seam). Without it, N=50 line rows trigger N+3 reads.

### Phase 5: RepertoirePick + presets.yml extension + RepertoireRepository (R5)

- [ ] **Task 5.1**: Extend `presets.yml` with explicit `lines:` arrays
  - **ID**: `task-5.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `scripts/curated/presets.yml`
  - **Change**: Add `lines: [<lineId>, ...]` array to each preset (`beginner`, `intermediate`, `advanced`, `off`). `'off'` gets `lines: []`. Existing `tier_band` + `family_ids` retained for fallback derivation. Preset line IDs must match catalog slugs.
  - **Outcome**: Curated preset membership is explicit, not derived; preset changes review-able as YAML diffs.
  - **Context**: Requirement R5 criterion 1; design §5.1. The fallback to tier/family derivation remains when `lines` is absent (legacy compat) but new presets must declare explicit membership.

- [ ] **Task 5.2**: Add `validate_presets.py` build-time check
  - **ID**: `task-5.2`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/validate_presets.py`
  - **Change**: Python script (full type hints — Article 14) that loads `presets.yml`, loads `public/catalog.json`, asserts every `preset.lines[]` ID exists in catalog. Non-zero exit on mismatch. Wire into the same step that already builds catalog (or `npm run build` prebuild hook).
  - **Outcome**: Drifted preset references caught at build time, not runtime.
  - **Context**: Requirement R5 criterion 1, R7 criterion 7; design §5.1, §7.4. Python primary per Article 2; typed per Article 14.

- [ ] **Task 5.3**: Define `RepertoireRepository` interface
  - **ID**: `task-5.3`
  - **BlockedBy**: `task-1.3`
  - **Agent**: `api-designer`
  - **File**: `src/repository/RepertoireRepository.ts`
  - **Change**: Interface with `getPick(): Promise<RepertoirePick>` (returns default if no row), `savePick(pick)`, `resetPick()`, `resetDbCache()`.
  - **Outcome**: Article 5 seam for the pick; components never touch IDB for repertoire state.
  - **Context**: Requirement R5 criterion 10; design §5.3. Default for a new user is `{ presetId: 'off', additions: [], removals: [] }` (R5.9).

- [ ] **Task 5.4**: Implement `IndexedDbRepertoireRepository`
  - **ID**: `task-5.4`
  - **BlockedBy**: `task-1.1, task-5.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/repository/IndexedDbRepertoireRepository.ts`
  - **Change**: Single-row store `repertoire_pick`, out-of-line key `'current'`. `getPick` returns row or default; `savePick` writes whole row; `resetPick` deletes the row. Lazy `dbPromise` via shared `runMigrations`.
  - **Outcome**: Persistent pick state surviving reload; one IDB row total.
  - **Context**: Requirement R5 criterion 2, 9; design §5.3, §6.2.

- [ ] **Task 5.5**: Implement `computeEffectivePick` pure function
  - **ID**: `task-5.5`
  - **BlockedBy**: `task-1.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/repertoire/effectivePick.ts`
  - **Change**: `computeEffectivePick(pick, presets, allLineIds): EffectivePick`. Handle `presetId === 'off'` (all lines ∪ additions \ removals). Handle preset with `lines` (preset.lines ∪ additions \ removals). Handle preset without `lines` (legacy: derive from tier_band + family_ids, then apply add/remove).
  - **Outcome**: Pure set-algebra function, trivial to unit-test, no React or IDB coupling.
  - **Context**: Requirement R5 criterion 3, 8; design §5.4.

- [ ] **Task 5.6**: Wire `RepertoireRepository` through DI container
  - **ID**: `task-5.6`
  - **BlockedBy**: `task-5.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/index.ts`
  - **Change**: Add `_repertoireRepo` singleton; `getRepertoireRepository()`; `_setRepertoireRepositoryForTesting(r)`. Re-export `RepertoirePick`, `EffectivePick` types via the barrel.
  - **Outcome**: Pick is now reachable through one factory; tests can swap freely.
  - **Context**: Design §6.5; mirrors `getEventsRepository` pattern from Task 2.4.

- [ ] **Task 5.7**: Create `useEffectivePick` hook
  - **ID**: `task-5.7`
  - **BlockedBy**: `task-5.5, task-5.6`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useEffectivePick.ts`
  - **Change**: Hook returns `EffectivePick`. On mount loads pick from repo + presets + allLineIds, runs `computeEffectivePick`. Exposes also `savePick(next)` that writes through the repo and recomputes. Replaces the existing `usePreset` hook from Phase 1c.
  - **Outcome**: All consumers of preset filtering migrate to this hook; URL semantics carried via `presetId` for backward compatibility.
  - **Context**: Requirement R5 criterion 8; design §5.6. `usePreset` removal is a string-for-string substitution (presetId still present).

- [ ] **Task 5.8**: Build `RepertoirePicker` component
  - **ID**: `task-5.8`
  - **BlockedBy**: `task-5.7`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/repertoire/RepertoirePicker.tsx`
  - **Change**: Panel with PresetRadio (4 options), ShowAllToggle, collapsible LineList per family, per-line checkbox. On checkbox toggle: branch on whether line is in `preset.lines` — toggle `removals` or `additions` accordingly, then `savePick`. On preset change: open existing confirm modal if `additions ∪ removals` non-empty; on confirm clear both lists then `savePick`.
  - **Outcome**: User can pick a preset, then add/remove lines individually, state persists, confirm on preset switch.
  - **Context**: Requirement R5 criteria 4-7; design §5.5. Reuse the modal primitive from the Phase 1c summary screen — do not introduce a new modal.

- [ ] **Task 5.9**: Integrate effective pick into RepertoirePage, DrillPage, SRS queue
  - **ID**: `task-5.9`
  - **BlockedBy**: `task-5.7`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/repertoire/RepertoirePage.tsx`
  - **Change**: Call `useEffectivePick()`. Filter family grid by `effective.lineIds` (unless `ShowAllToggle` enabled on the picker). Update `DrillPage` line picker dropdown to filter the same way. In `useSRSDueQueue`, intersect `dueLineIds` with `effective.lineIds` so `?queue=due` only routes drillable picks.
  - **Outcome**: The pick actually affects what the user sees and drills; "Show all" reveals the unfiltered catalog on demand.
  - **Context**: Requirement R5 criterion 8; design §5.6 consumer list.

### Phase 6: HeatmapTabs + 3 child renderers (R3)

- [ ] **Task 6.1**: Build `HeatmapTabs` shell + tab persistence
  - **ID**: `task-6.1`
  - **BlockedBy**: `task-4.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/HeatmapTabs.tsx`
  - **Change**: Tab bar with three buttons in fixed order: Daily activity, Per-opening accuracy, Hour of day. Active tab persisted to `localStorage['tabiya.heatmapTab']` with default `'daily'`. Renders the selected child renderer; passes `events` from `useEventsContext()` to children. Renders empty-state caption per-tab when `events` is empty — panel is never hidden.
  - **Outcome**: One tab shell controlling three views with shared event slice and persistent selection.
  - **Context**: Requirement R3 criteria 1, 5, 6, 7; design §3.1, §3.5. CSS-class cells named `heatmap-cell` — explicitly NOT the board square-highlight primitive (Article 15).

- [ ] **Task 6.2**: Build `DailyActivityGrid` renderer
  - **ID**: `task-6.2`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/heatmap/DailyActivityGrid.tsx`
  - **Change**: 53-week × 7-day SVG grid. Inline `<rect>` per cell (12×12 px, 2 px gap), Sunday-leftmost, today rightmost. Aggregate `Map<localDayKey, count>` over `line_start` events. 5-tier color buckets: 0, 1, 2-3, 4-7, 8+. Native `<title>` element per cell for tooltips. Legend showing bucket thresholds.
  - **Outcome**: GitHub-style daily activity grid; ~2 kB gzip; no charting library.
  - **Context**: Requirement R3 criterion 2; design §3.2. Hand-rolled SVG per design §3.2 and §7.3 size budget — `d3-scale`/`recharts` rejected.

- [ ] **Task 6.3**: Build `OpeningAccuracyGrid` renderer
  - **ID**: `task-6.3`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/heatmap/OpeningAccuracyGrid.tsx`
  - **Change**: Group events by `lineId`, compute per-line accuracy, filter lines with `< MIN_LINE_COMPLETES_FOR_HEATMAP` (=5), resolve `lineId → familyId` via `OpeningRepository`, bucket into `[0-49, 50-69, 70-84, 85-94, 95-100]%`, render CSS grid `Map<familyId, Record<bucket, count>>`. Empty cell = hairline outline. Footnote: "Lines with fewer than 5 completed sessions are hidden."
  - **Outcome**: Per-family accuracy distribution at a glance; small-sample bias suppressed by the floor.
  - **Context**: Requirement R3 criterion 3; design §3.3. The threshold constant `MIN_LINE_COMPLETES_FOR_HEATMAP` is the tuning knob per Open Question #3.

- [ ] **Task 6.4**: Build `HourOfDayRow` renderer
  - **ID**: `task-6.4`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/heatmap/HourOfDayRow.tsx`
  - **Change**: 24-cell CSS grid row (hours 0..23 in local time). Tally `line_start` count by `new Date(ts).getHours()`. 5-tier bucket: 0, 1-2, 3-5, 6-10, 11+. Tick labels at 0, 6, 12, 18, 23.
  - **Outcome**: User sees which hours they tend to drill.
  - **Context**: Requirement R3 criterion 4; design §3.4.

### Phase 7: Dashboard surfaces + Settings reset (R2, R4, R6)

- [ ] **Task 7.1**: Build `StreaksRow` dashboard component
  - **ID**: `task-7.1`
  - **BlockedBy**: `task-4.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/StreaksRow.tsx`
  - **Change**: Two-card grid with `StreakCard` children. Card props: label, value, icon, muted, caption. Muted style + "Start a drill to begin" caption when value is 0. Labels: "Days in a row", "Clean lines in a row".
  - **Outcome**: Dashboard shows both streaks side-by-side with consistent visual treatment.
  - **Context**: Requirement R2 criteria 4-5; design §2.4.

- [ ] **Task 7.2**: Build `AccuracyRow` dashboard component
  - **ID**: `task-7.2`
  - **BlockedBy**: `task-4.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/AccuracyRow.tsx`
  - **Change**: Two `AccuracyCard` instances side-by-side. Each shows percentage to 1 decimal place, move count, "All-time" or "Last 7 days" label. Last-7-days card also shows delta badge (`+1.2pp` / `-0.4pp` / `=`). Null accuracy → `—` + "No moves yet" caption.
  - **Outcome**: Dashboard shows long-term + recent accuracy with delta — bad week visible vs good year.
  - **Context**: Requirement R4 criteria 1-5; design §4.2-4.3.

- [ ] **Task 7.3**: Add per-line accuracy badge to RepertoirePage line rows
  - **ID**: `task-7.3`
  - **BlockedBy**: `task-4.3, task-4.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/repertoire/LineRow.tsx`
  - **Change**: Wrap RepertoirePage in `EventsContextProvider`. In each line row, call `useLineAccuracy(line.id)` which reads from the context map. Render `<AccuracyBadge value={accuracy} moves={moves} />` next to the line name when `moves > 0`.
  - **Outcome**: Player sees per-line accuracy at the level where they pick which line to drill next.
  - **Context**: Requirement R4 criterion 6; design §4.4. Reads share the single `listAll` from the context provider — no N+1.

- [ ] **Task 7.4**: Compose dashboard with new rows + heatmap
  - **ID**: `task-7.4`
  - **BlockedBy**: `task-7.1, task-7.2, task-6.2, task-6.3, task-6.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/dashboard/DashboardPage.tsx`
  - **Change**: Wrap page contents in `EventsContextProvider`. Insert in order: existing HeaderRow, `<StreaksRow />`, `<AccuracyRow />`, existing DueQueueCTA, `<HeatmapTabs />`. Layout uses existing dashboard grid tokens.
  - **Outcome**: Full Phase 1.5 dashboard live with one IDB read powering all surfaces.
  - **Context**: Design §8 component tree. The order is fixed by design — streaks and accuracy precede the heatmap because they are smaller cognitive load.

- [ ] **Task 7.5**: Add `ResetTelemetryButton` to SettingsPage
  - **ID**: `task-7.5`
  - **BlockedBy**: `task-2.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/settings/ResetTelemetryButton.tsx`
  - **Change**: Button in a new "Data" section of SettingsPage. On click, open existing confirm modal: "Reset telemetry will delete all session events. SRS progress is not affected. Continue?". On confirm, `await getEventsRepository().clearAll()`. Bus publish inside `clearAll` triggers dashboard recomputes to empty state.
  - **Outcome**: User has a local-only "wipe my telemetry" affordance separate from the existing per-line SRS reset.
  - **Context**: Requirement R6 criterion 6; design §6.6. Per Article 11, this is fully local — no server call. Must live separately from SRS reset so the two cannot be confused.

### Phase 8: Tests + size budget (R7)

- [ ] **Task 8.1**: Unit tests for `EventsRepository`
  - **ID**: `task-8.1`
  - **BlockedBy**: `task-2.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/events/EventsRepository.spec.ts`
  - **Change**: ≥15 cases per design §7.2 matrix. Use `fake-indexeddb`. Cover: append assigns id; listByDateRange empty/inclusive-from/exclusive-to/cross-day/DST forward/DST backward; listByLine empty/lineId-scoped/timestamp-ordered; aggregate empty/all-correct/mixed/per-line; clearAll preserves schema; corrupt record skipped + warned; append publishes on bus.
  - **Outcome**: Repository contract locked; regressions caught at unit level.
  - **Context**: Requirement R7 criterion 1; design §7.2.

- [ ] **Task 8.2**: Unit tests for `useStreaks`
  - **ID**: `task-8.2`
  - **BlockedBy**: `task-4.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/hooks/useStreaks.spec.ts`
  - **Change**: 6 scenarios: zero events, single-day streak, multi-day continuous streak, broken streak by gap day, mastery streak broken by wrong move, mastery streak broken by abandonment. Use `_setEventsRepositoryForTesting(InMemoryEventsRepository)`.
  - **Outcome**: Streak edge cases nailed — the hardest semantic surface in this phase.
  - **Context**: Requirement R7 criterion 2; design §2.2 algorithm.

- [ ] **Task 8.3**: Integration test for schema migration v1 → v2
  - **ID**: `task-8.3`
  - **BlockedBy**: `task-2.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/events/migration.spec.ts`
  - **Change**: Seed v1 DB with 3 SRS records via `fake-indexeddb`, close, reopen at v2. Assert: (a) `srs_state` still returns all 3 records unchanged; (b) `session_events` exists and is empty; (c) `repertoire_pick` exists and is empty.
  - **Outcome**: Phase 1c users prove safe; no SRS loss across the upgrade.
  - **Context**: Requirement R6 criterion 4, R7 criterion 6; design §6.4.

- [ ] **Task 8.4**: Unit tests for `useAccuracy`
  - **ID**: `task-8.4`
  - **BlockedBy**: `task-4.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/hooks/useAccuracy.spec.ts`
  - **Change**: 4 scenarios: zero denominator → null; all-correct → 1.0; mixed → expected ratio; 7-day window boundary at the second (event at `cutoff - 1ms` excluded, event at `cutoff` included).
  - **Outcome**: Accuracy math + window boundary verified.
  - **Context**: Requirement R7 criterion 3; design §4.2.

- [ ] **Task 8.5**: Unit tests for `effectivePick` + `RepertoireRepository`
  - **ID**: `task-8.5`
  - **BlockedBy**: `task-5.5, task-5.6`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/repertoire/effectivePick.spec.ts`
  - **Change**: Set-algebra cases: preset='off' no overrides; preset='off' with additions only; preset='beginner' default; preset with additions ∪ removals; preset switch clearing; default-user (no row) returns `'off'`. Also `tests/repertoire/RepertoireRepository.spec.ts`: get on empty store, save round-trip, reset clears.
  - **Outcome**: Pick derivation + persistence locked.
  - **Context**: Requirement R7 criterion 4; design §5.4.

- [ ] **Task 8.6**: Component test for `RepertoirePicker`
  - **ID**: `task-8.6`
  - **BlockedBy**: `task-5.8`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/components/RepertoirePicker.spec.tsx`
  - **Change**: Confirm dialog opens on preset switch when overrides present; cancel restores prior preset; confirm clears additions+removals; toggling a preset-member line adds to removals (and re-toggle removes from removals); toggling a non-member adds to additions.
  - **Outcome**: Picker UX state machine verified.
  - **Context**: Requirement R5 criteria 5-7, R7 criterion 4.

- [ ] **Task 8.7**: Integration test — drill emits exact event sequence
  - **ID**: `task-8.7`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/integration/drill-emits-events.spec.tsx`
  - **Change**: Render `<DrillPage />` with a 6-ply line via test repository. Make 6 correct moves through chess-board test harness. Assert `listAll()` returns exactly `[line_start, move_correct×6, line_complete]` with ascending plyIndex 0..5 on move events and 5 on line_complete. Variant: inject one wrong move at ply 3 → expect `[line_start, move_correct×3, move_wrong, move_correct×3, line_complete]` and assert mastery streak broken.
  - **Outcome**: End-to-end event emission contract proved.
  - **Context**: Requirement R7 criterion 5; design §7.5.

- [ ] **Task 8.8**: Component test for `HeatmapTabs`
  - **ID**: `task-8.8`
  - **BlockedBy**: `task-6.2, task-6.3, task-6.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/components/HeatmapTabs.spec.tsx`
  - **Change**: Tab bar renders 3 tabs in fixed order. Clicking a tab updates `localStorage['tabiya.heatmapTab']` and shows the right child. Empty events array → empty-state caption per tab; panel still rendered. Active tab restored on remount.
  - **Outcome**: Tab shell behavior verified including persistence.
  - **Context**: Requirement R3 criteria 1, 5, 7.

- [ ] **Task 8.9**: Size budget verification
  - **ID**: `task-8.9`
  - **BlockedBy**: `task-7.4, task-5.8, task-6.2, task-6.3, task-6.4`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/check_phase15_size.py`
  - **Change**: Python script reads `dist/` manifest or vite chunk report, sums gzip sizes for `HeatmapTabs` + 3 renderers + `RepertoirePicker` + `useStreaks` + `useAccuracy` + events/repertoire repositories + schema module. Exit non-zero if combined > 20 kB gzip. Wire into `npm run build` postbuild.
  - **Outcome**: Size budget enforced in CI; no charting library can sneak in.
  - **Context**: Requirement R7 criterion 8; design §7.3 budget split. The script is the gate — failing build is preferable to a quiet regression.

- [ ] **Task 8.10**: Constitution compliance audit
  - **ID**: `task-8.10`
  - **BlockedBy**: `task-7.4, task-5.9, task-7.5`
  - **Agent**: `security-reviewer`
  - **File**: `specs/phase-1.5-telemetry/audit.md`
  - **Change**: Grep audit: (a) no `IndexedDbEventsRepository` / `IndexedDbRepertoireRepository` imports outside `src/repository/`/`src/storage/` (Article 5); (b) no `fetch`/`sendBeacon`/`postMessage` to non-self in any new file (Article 11); (c) no `any` type in `src/types/events.ts`, `src/types/repertoire.ts`, new repos/hooks/components (Article 14); (d) `heatmap-cell` classname distinct from board square-highlight classes (Article 15); (e) `validate_presets.py` has full type hints. Document each check + result.
  - **Outcome**: Articles 5, 11, 14, 15 verified before merge.
  - **Context**: Constitution Articles 5, 6, 11, 12, 14, 15; design §10.

- [ ] **Task 8.11**: Regression sweep + manual smoke
  - **ID**: `task-8.11`
  - **BlockedBy**: `task-8.1, task-8.2, task-8.3, task-8.4, task-8.5, task-8.6, task-8.7, task-8.8, task-8.9, task-8.10`
  - **Agent**: `general-purpose`
  - **File**: `specs/phase-1.5-telemetry/smoke.md`
  - **Change**: Run full test suite — all Phase 0/1/1c tests still green plus new Phase 1.5 suite. `npx tsc --noEmit` no new errors. Manual smoke: drill clean line → StreaksRow shows 1/1; drill with 2 wrong moves → mastery streak resets to 0, daily streak still 1; switch to "Per-opening accuracy" tab → see family bucket; Settings → Reset telemetry → all surfaces reset, SRS untouched. Document results.
  - **Outcome**: No Phase 0/1/1c regression; Phase 1.5 surfaces work end-to-end.
  - **Context**: Requirement R7 criterion 9.

## Dependency Diagram

```
                                  Phase 1: Setup (parallel root)
                                  +-------------------+-------------------+
                                  |                   |                   |
                                task-1.1            task-1.2            task-1.3
                                schema              events types        repertoire types
                                  |                   |                   |
                  +---------------+---------+         +---------+         +---------+
                  |                         |                   |                   |
              task-2.5                  task-2.1            task-4.1            task-5.3
              SRS->shared schema        EventsRepo iface    computeStreaks      RepertoireRepo iface
                                            |                                       |
                                        task-2.2                                task-5.4
                                        IndexedDb impl                          IndexedDb impl
                                            |                                       |
                                        task-2.3                                task-5.5
                                        EventsBus                               computeEffectivePick
                                            |                                       |
                                        task-2.4 <----+                         task-5.6
                                        DI wiring     |                         DI wiring
                                            |         |                             |
            +---------------+---------------+---------+---------+                   |
            |               |               |                   |                   |
        task-3.1        task-4.2        task-4.3            task-4.4            task-5.7
        useEventEmit    useStreaks      useAccuracy         EventsContext       useEffectivePick
            |               |               |                   |                   |
        task-3.2        task-7.1        task-7.2            task-7.3            +--+--+
        DrillPage emit  StreaksRow      AccuracyRow         LineRow badge       |     |
                            \                /                  /            task-5.1 task-5.8
                             \              /                  /             presets.yml RepertoirePicker
                              \            /                  /                  |        |
                               \      task-6.1 <-------------+               task-5.2  task-5.9
                                \     HeatmapTabs                            validate  page integ
                                 \      |
                                  \     +-----------+-----------+
                                   \    |           |           |
                                    \ task-6.2   task-6.3    task-6.4
                                     DailyGrid   OpeningGrid  HourOfDay
                                      \   |       /
                                       \  |      /
                                       task-7.4 <-- (also waits on task-7.1, task-7.2)
                                       DashboardPage composition
                                            |
                                       task-7.5
                                       ResetTelemetry  (only needs task-2.4)

                            Phase 8: Tests (parallel fan-out per source task)
                            task-8.1  EventsRepo tests           (after 2.2)
                            task-8.2  useStreaks tests           (after 4.2)
                            task-8.3  migration test             (after 2.5)
                            task-8.4  useAccuracy tests          (after 4.3)
                            task-8.5  effectivePick tests        (after 5.5, 5.6)
                            task-8.6  RepertoirePicker test      (after 5.8)
                            task-8.7  drill emits integration    (after 3.2)
                            task-8.8  HeatmapTabs test           (after 6.2, 6.3, 6.4)
                            task-8.9  size budget check          (after 7.4, 5.8, 6.2-6.4)
                            task-8.10 constitution audit         (after 7.4, 5.9, 7.5)
                                            |
                                       task-8.11
                                       regression + smoke (all 8.x converge)
```

### Parallel opportunities

- **Root burst (no blockers)**: `task-1.1`, `task-1.2`, `task-1.3`, `task-5.1` — four independent agent sessions can run simultaneously.
- **Post-types burst**: After `task-1.2` lands, `task-2.1` and `task-4.1` run in parallel. After `task-1.3` lands, `task-5.3` runs. After `task-1.1` lands, `task-2.5` runs.
- **Post-DI burst**: After `task-2.4` (events DI), `task-3.1`, `task-4.2`, `task-4.3`, `task-4.4`, `task-7.5` are all independent — five sessions in parallel.
- **Heatmap children**: `task-6.2`, `task-6.3`, `task-6.4` run in parallel after `task-6.1`.
- **Repertoire stack**: After `task-5.7`, both `task-5.8` and `task-5.9` are independent.
- **Test phase**: All ten Phase 8 tasks fan out independently from their source tasks; only `task-8.11` is a convergence point.

### Critical path

`task-1.1 → task-2.5 → task-2.2 → task-2.3 → task-2.4 → task-3.1 → task-3.2 → task-8.7 → task-8.11`

(types-and-schema → events repo → bus → DI → emitter hook → drill wiring → integration test → smoke).

The dashboard composition path (`task-2.4 → task-4.2/4.3/4.4 → task-7.1/7.2 → task-6.1 → task-6.2/6.3/6.4 → task-7.4`) is slightly shorter but fully parallelizable across the four post-DI hooks plus three heatmap renderers, so the events-emission path dominates wall time.

## Completion Criteria

Phase 1.5 is done when:

1. All 33 tasks above are checked off.
2. `npm test -- --run` passes the full suite — every Phase 0/1/1c spec plus every new Phase 1.5 spec.
3. `npx tsc --noEmit` reports no new errors beyond the documented Phase 1 baseline.
4. `npm run build` succeeds and `scripts/check_phase15_size.py` reports combined gzip ≤ 20 kB for the named modules (R7.8).
5. `scripts/validate_presets.py` passes — every preset `lines[]` ID exists in `public/catalog.json` (R5.1).
6. Migration test `tests/events/migration.spec.ts` proves a seeded v1 SRS dataset is preserved unchanged after v2 upgrade (R6.4, R7.6).
7. Manual smoke (`task-8.11`) confirms: a clean drill bumps both streaks to 1/1; a drill with wrong moves resets mastery streak but keeps daily; "Reset telemetry" wipes events and leaves SRS intact; "Per-opening accuracy" tab shows a real family with ≥5 completes; effective pick filters the family grid and drill picker.
8. Constitution audit (`task-8.10`) passes all five checks: Article 5 (no concrete repo imports outside `src/repository/`/`src/storage/`); Article 6 (all keying on `line.id`); Article 11 (no network egress); Article 14 (no `any`, Python type hints on `validate_presets.py`); Article 15 (heatmap cells distinctly named from board square-highlights).
9. No `usePreset` references remain — replaced by `useEffectivePick` (R5 design §5.6).
10. Open Question #1 (retention cap) explicitly resolved with user before merge — design lean is "ship uncapped, revisit"; confirm or call for compaction now.

## Summary

Phase 1.5 lands an append-only `session_events` store as the single source of truth, derives four user-facing surfaces from it (streaks, tabbed heatmap, accuracy %, per-line accuracy badge), and adds the `RepertoirePick` layer over Phase 1c presets. 33 tasks across 8 phases. Critical path is types → schema → events repo → DI → emitter hook → drill wiring → integration test. Parallelism is high: four root tasks fan out immediately, five hooks/components fan out after DI, three heatmap renderers after the shell, ten tests fan out independently from their source tasks. All work is local-first (Article 11), goes through repository interfaces (Article 5), and stays under a 20 kB gzip budget (R7.8).
