# Design: Phase 1 — SRS Data Layer

## Overview

Phase 1 turns the ghost mastery bars and Dashboard placeholders into real, browser-persisted spaced-repetition state. Architecture mirrors the existing `OpeningRepository` pattern (Constitution Article 5): a typed interface, a v1 IndexedDB implementation, an in-memory test double, and a single DI factory in `src/storage/index.ts`. Promotion / demotion math lives in a pure function so the scheduler is unit-testable without a browser. The drill state machine emits exactly one `DrillResult` on the `complete` terminal state; nothing else writes SRS state.

## 1. System Architecture

### Directory layout

```
src/
├── storage/
│   ├── index.ts                    # DI: getRepository() + getSrsRepository() (NEW)
│   ├── types.ts                    # adds SrsState, DrillResult, BOX_INTERVALS
│   ├── JsonOpeningRepository.ts    # unchanged
│   ├── srs/                        # NEW — Phase 1 module
│   │   ├── SrsRepository.ts        # interface + types
│   │   ├── scheduler.ts            # pure nextSrsState() + isDue() + masteryPercent()
│   │   ├── IndexedDbSrsRepository.ts
│   │   └── InMemorySrsRepository.ts
│   └── ...
├── hooks/
│   └── useSRS.ts                   # NEW
├── pages/
│   ├── DashboardPage.tsx           # MOD — wires real stats
│   ├── RepertoirePage.tsx          # MOD — mastery bars consume useSRS
│   ├── DrillPage.tsx               # MOD — recordDrillResult on complete
│   └── SettingsPage.tsx            # MOD — Danger Zone reset block
└── drill/
    └── useDrill.ts                 # MOD — emits DrillResult, tracks per-drill counters

tests/
├── srs-scheduler.test.ts           # NEW — pure function matrix
├── indexeddb-srs-repository.test.ts # NEW — fake-indexeddb integration
├── in-memory-srs-repository.test.ts # NEW
├── use-srs.test.tsx                # NEW
├── repertoire-page.test.tsx        # MOD — mastery bar assertions
├── dashboard-page.test.tsx         # NEW or MOD — real stats
└── drill-page.test.tsx             # MOD — assert recordDrillResult call
```

### Component diagram

```
                ┌──────────────────────────────────────┐
                │           Dashboard / Sidebar        │
                │   (Lines mastered, Due count, etc.)  │
                └──────────────────┬───────────────────┘
                                   │ useSRS()
                ┌──────────────────▼───────────────────┐
                │              useSRS hook             │
                │   states map · dueLineIds · refresh  │
                └──────────────────┬───────────────────┘
                                   │ getSrsRepository()
                ┌──────────────────▼───────────────────┐
                │           SrsRepository              │  ◄─── pure types
                │  getState · listAllStates · record   │       (interface)
                │  resetState · resetAll               │
                └─────┬─────────────────┬──────────────┘
                      │                 │
            ┌─────────▼──────┐ ┌────────▼──────────┐
            │ IndexedDb (v1) │ │ InMemory (tests)  │
            └────────────────┘ └───────────────────┘

        DrillPage ──► useDrill ──► DrillResult ──► recordDrillResult()
                                                       │
                                                       ▼
                                            scheduler.nextSrsState()  (pure)
                                                       │
                                                       ▼
                                              IndexedDB write
```

## 2. Data Flow

### A. Drill completion → SRS write (happy path)

1. User reaches final ply of line; `useDrill` reducer transitions to `complete` state.
2. `useDrill` reads its in-state per-drill counters: `wrong_attempts`, `hint_uses`, `started_at`.
3. `useDrill` builds `DrillResult = { wrong_attempts, hint_uses, duration_ms, completed_at }`.
4. `useDrill` `useEffect` on `state.kind === 'complete'` fires once, calls `getSrsRepository().recordDrillResult(line.id, drillResult)`.
5. `IndexedDbSrsRepository.recordDrillResult`:
   a. `prev = await getState(line.id)` (reads from object store)
   b. `next = scheduler.nextSrsState(prev, drillResult)` (pure, sync)
   c. `await put(next)` (writes to object store)
   d. returns `next` (caller may discard; fire-and-forget OK)
6. `useDrill` does NOT await — drill UI never blocks on the SRS write.
7. On navigating back to RepertoirePage / Dashboard, `useSRS.refresh()` is called via the page's `useEffect`, which re-reads `listAllStates()` and updates the badge counts.

### B. Skip-mid-drill

1. User clicks Skip button → `useDrill` reducer transitions to `idle` (or back to drill picker).
2. NO `complete` event is emitted, so step 4 above never fires.
3. `SrsState` for the line is unchanged.

### C. First-ever drill of a line

1. `prev = null` from `getState(line.id)`.
2. `scheduler.nextSrsState(null, drillResult)`:
   - if `drillResult.wrong_attempts >= 3` → returns `{ box: 1, ... }`
   - else → returns `{ box: 2, ... }` (Requirement 3.5: flawless first attempt promotes past Box 1)
3. New record persisted.

### D. Dashboard / Sidebar render

1. Component mounts → `useSRS()` triggers `listAllStates()`.
2. Hook state: `loading: true`.
3. On resolve: `states = Map<line_id, SrsState>`, `dueLineIds = isDueFilter(states.values())`.
4. Component reads `states.size`, `dueLineIds.length`, `count(states where box>=4)`, `catalog.lines.length`, computes percentages.
5. After a drill, user navigates back → `useSRS.refresh()` repeats listAllStates, replaces map, recomputes due.

### E. Reset all SRS progress

1. User clicks Settings → "Reset all SRS progress" → confirmation dialog shows `count = states.size`.
2. On confirm: `await getSrsRepository().resetAll()` → clears object store.
3. Dialog closes. Page refreshes useSRS state. Sidebar badge clears.

## 3. Interface Specifications

### Types (`src/storage/types.ts` additions)

```ts
export type SrsState = {
  line_id: string;          // primary key
  box: 1 | 2 | 3 | 4 | 5;
  last_reviewed: string;    // ISO 8601
  attempts: number;         // ≥ 1
  wrong_attempts_total: number;
  hint_uses_total: number;
};

export type DrillResult = {
  wrong_attempts: number;
  hint_uses: number;
  duration_ms: number;
  completed_at: string;     // ISO 8601
};

/** Source of truth for box review intervals (Requirement 2.4). */
export const BOX_INTERVALS_DAYS: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = {
  1: 1, 2: 3, 3: 7, 4: 14, 5: 30,
};

export interface SrsRepository {
  getState(lineId: string): Promise<SrsState | null>;
  listAllStates(): Promise<SrsState[]>;
  recordDrillResult(lineId: string, result: DrillResult): Promise<SrsState>;
  resetState(lineId: string): Promise<void>;
  resetAll(): Promise<void>;
}
```

### Scheduler (`src/storage/srs/scheduler.ts`)

| Function | Signature | Purpose |
|---|---|---|
| `nextSrsState` | `(prev: SrsState \| null, result: DrillResult) => SrsState` | Pure transition. Pass `now()` via clock arg in tests. |
| `isDue` | `(state: SrsState, now: Date) => boolean` | `now >= last_reviewed + BOX_INTERVALS_DAYS[box]` |
| `masteryPercent` | `(state: SrsState \| null) => number` | Box 1=20, 2=40, 3=60, 4=80, 5=100, null=0 |
| `aggregateMasteryByOpening` | `(states: Map<string, SrsState>, lines: Line[]) => Map<openingId, number>` | Arithmetic mean over lines; opening with 0 drilled lines → 0. |
| `aggregateMasteryByFamily` | `(perOpening: Map<string, number>, families: Family[]) => Map<familyId, number>` | Mean over opening masteries. |

### IndexedDB schema (`IndexedDbSrsRepository`)

| Property | Value |
|---|---|
| Database name | `tabiya` |
| Database version | `1` (bumps on any object-store change) |
| Object store | `srs_state` |
| Key path | `line_id` |
| Indexes | `box` (non-unique, for future "lines by box" queries) |

### useSRS hook (`src/hooks/useSRS.ts`)

```ts
export function useSRS(): {
  states: Map<string, SrsState>;
  dueLineIds: string[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};
```

### URL conventions

| Surface | URL | Behavior |
|---|---|---|
| Dashboard "Drill" CTA when due > 0 | `/drill?queue=due` | Reserved; DrillPage may consume in Phase 1 polish or Phase 1.5 |
| Existing single-opening drill | `/drill?opening=<id>` | Unchanged |

### DI factory (`src/storage/index.ts`)

```ts
let _srsRepo: SrsRepository | null = null;

export function getSrsRepository(): SrsRepository {
  if (_srsRepo === null) _srsRepo = new IndexedDbSrsRepository();
  return _srsRepo;
}

export function _setSrsRepositoryForTesting(repo: SrsRepository | null): void {
  _srsRepo = repo;
}
```

## 4. Technical Decisions

### D1 — IndexedDB via `idb` wrapper, not raw IDB API

- **Choice:** `idb` (Jake Archibald, ISC license).
- **Rationale:** Promise-based wrapper. Already approved in obsidian plan + tabiya `tech.md` allowed dependencies. Saves ~200 LOC of callback boilerplate.
- **Alternatives:** Raw IndexedDB (verbose, error-prone), Dexie (heavier, MIT but more API surface), `localForage` (multi-backend, but we want IDB-specific schema control).

### D2 — Pure scheduler function vs methods on SrsRepository

- **Choice:** `scheduler.ts` exports pure `nextSrsState(prev, result)`. Repository wraps storage I/O, calls scheduler internally.
- **Rationale:** All transition math testable without IndexedDB. Easy to fuzz the wrong-attempts × box matrix. Decouples policy (box rules) from persistence.
- **Alternatives:** Logic inside `IndexedDbSrsRepository.recordDrillResult` directly (couples; harder tests).

### D3 — InMemorySrsRepository as a first-class artifact, not test-only fixture

- **Choice:** Ship `InMemorySrsRepository` in `src/storage/srs/`, export from storage barrel.
- **Rationale:** Useful for E2E test setup, Storybook (future), and any future "ephemeral session" mode. Cost: ~30 LOC.
- **Alternatives:** Define ad-hoc in test files (already what `drill-page.test.tsx` does for OpeningRepository — but every test re-implements). Centralizing is one-shot cost.

### D4 — Single `tabiya` IndexedDB, multiple object stores

- **Choice:** One DB named `tabiya` with version 1, store `srs_state`. Future Phase 1.5 `session_events` lives in the same DB at version 2.
- **Rationale:** Avoids multi-DB upgrade orchestration. Aligns with browser quota best practice (one origin → one app DB).
- **Alternatives:** Per-store DB (`tabiya_srs`, `tabiya_events`) — simpler per-feature but proliferates DBs and complicates Settings reset UX.

### D5 — Fire-and-forget write, no UI block

- **Choice:** `useDrill` calls `recordDrillResult` without `await`. UI immediately renders post-complete state.
- **Rationale:** IDB writes are typically <5ms but jitter can spike to 100s; user-facing blocking is unacceptable for a snappy drill loop. Errors logged to console; v1 doesn't surface them in UI (acceptable for local-first).
- **Alternatives:** Await with optimistic UI (extra complexity); show toast on error (Phase 1.5+ polish).

### D6 — Dashboard "Drill" CTA URL convention reserved, not implemented

- **Choice:** Document `/drill?queue=due` URL. DrillPage Phase 1 still loads single opening; CTA points to URL but DrillPage falls back to default-opening behavior if `queue` param is unknown.
- **Rationale:** Avoids scope creep. Drill-queue UI is its own feature, not gating on SRS data layer.
- **Alternatives:** Implement queue routing now (overscope) or omit CTA wiring entirely (loses Dashboard signal).

### D7 — Friction-tuned promotion math (locked in requirements)

- **Choice:** 0 wrong → promote, 1-2 → stay (touch `last_reviewed`), ≥3 → demote-one (floor Box 1).
- **Rationale:** Auto-undo means every line completes; pure Leitner punishes that artificially. Demote-by-one preserves long-term progress.
- **Alternatives:** Strict Leitner (rejected), threshold-based with no demote (loses signal). User chose this variant explicitly.

### D8 — `last_reviewed` stored as ISO 8601 string, not epoch ms

- **Choice:** ISO 8601 (`new Date().toISOString()`).
- **Rationale:** Human-readable in DevTools, IDB-indexable as string, parses round-trip cleanly. ~6 bytes overhead per record (negligible).
- **Alternatives:** Epoch ms number (smaller but opaque on inspection).

### D9 — `useSRS` does not poll

- **Choice:** No setInterval / setTimeout refresh. Refresh on mount + explicit `refresh()` call.
- **Rationale:** Drill→Dashboard is the only real flow. Mount on navigation triggers re-fetch naturally. Polling adds complexity, drains battery, almost never observes state change between renders.
- **Alternatives:** BroadcastChannel for tab-tab sync (deferred; v1 is single-tab implicitly).

## 5. Error Handling

| Scenario | Detection | Response |
|---|---|---|
| IndexedDB unavailable (private browsing, quota exceeded) | `idb.openDB()` throws on first call | Hook surfaces `error` state. `useSRS` returns empty `states` Map; mastery bars show 0% with caption "Storage unavailable". App stays usable for drill-only flow. |
| Schema validation fails on read (corrupt record) | Per-record runtime type guard `isSrsState(raw)` | Skip the bad record, log warning. Don't crash listAllStates; treat as if record absent (line shows 0%). |
| Concurrent write from another tab (rare) | `put()` resolves successfully (last-writer-wins) | Accept. Phase 1 is single-tab in practice. Multi-tab convergence deferred. |
| `recordDrillResult` write rejection | Promise rejects | Caller uses `.catch(err => console.error('SRS write failed:', err))`. Drill UI unaffected. |
| Reset confirmation while writes in flight | User clicks reset before fire-and-forget completes | `resetAll` runs after pending writes resolve naturally; if write lands post-reset, the reset count is "off by one" — acceptable, very rare, no data risk. |
| Box value out of band (1-5) detected post-read | Type guard | Coerce to clamp `Math.max(1, Math.min(5, n))`; log warning. Defensive. |
| Catalog refresh removes a `line.id` | `listAllStates()` returns SrsState whose line.id no longer exists in catalog | Aggregator skips the orphan when computing opening/family mastery. Record stays in DB until user resets. (Article 6: line.id never changes meaning, so re-emerging is fine.) |
| Hook used outside React tree | React error | Standard hook rule violation; not Phase 1's concern. |

## 6. Testing Approach

### Unit tests

**`tests/srs-scheduler.test.ts`** — pure function matrix
- `nextSrsState(null, result)` for `wrong_attempts ∈ {0, 1, 2, 3, 4, 10}` — verify Box 1 vs Box 2 split at 3.
- `nextSrsState(prev_box_N, result)` for every `(N, wrong_attempts) ∈ {1..5} × {0, 1, 2, 3, 5}` — verify cap at Box 5, floor at Box 1.
- Hint-uses don't affect box: `nextSrsState(prev, { wrong_attempts: 0, hint_uses: 99 })` still promotes.
- `attempts` increments by 1, lifetime totals accumulate.
- `last_reviewed` updates to passed-in clock value.
- `isDue` boundary tests: at `last_reviewed + interval - 1ms` → false, at `+ interval` → true.
- `masteryPercent` for boxes 1-5 + null → {20,40,60,80,100,0}.
- `aggregateMasteryByOpening` with mixed drilled/undrilled lines → mean correctly skips undrilled? Actually counts them as 0 per Req 7.5; verify both interpretations explicit.

**`tests/in-memory-srs-repository.test.ts`** — interface contract
- recordDrillResult creates new record on first call.
- recordDrillResult updates existing record on second call.
- listAllStates reflects all writes.
- resetState removes one record.
- resetAll empties.

**`tests/indexeddb-srs-repository.test.ts`** — IDB integration via `fake-indexeddb`
- Same contract as InMemory, plus:
- DB upgrade path: open with no existing DB creates store.
- Round-trip: write → close DB → reopen → read returns same record.
- Quota / open failure simulation (mock `openDB` to throw) — repository constructor lazy, not failing until first method.

### Component tests

**`tests/use-srs.test.tsx`** — hook
- Mounts → loading=true → states populated.
- After `recordDrillResult` external + `refresh()` call → states reflect new record.
- `dueLineIds` recomputes on state change.
- Uses InMemorySrsRepository via `_setSrsRepositoryForTesting`.

**`tests/repertoire-page.test.tsx`** (extend existing) — mastery wiring
- With one line at Box 3, RepertoirePage renders 60% mastery on that line's card.
- Family rollup card shows averaged mastery.

**`tests/dashboard-page.test.tsx`** — new
- "Lines mastered" widget = mastered count / catalog total %.
- "Due for review" widget shows due count.
- Empty state when `states.size === 0`.

**`tests/drill-page.test.tsx`** (extend existing) — drill→SRS pipeline
- Mock SrsRepository via `_setSrsRepositoryForTesting`.
- Drive drill to complete; assert `recordDrillResult` called exactly once with expected payload.
- Skip mid-drill; assert `recordDrillResult` NOT called.

### Smoke / manual

- `npm run dev` → drill 1 line in Ruy Lopez → return to RepertoirePage → mastery bar shows non-zero.
- DevTools → Application → IndexedDB → tabiya → srs_state → row visible.
- Reset all in Settings → confirm → row gone, bar back to 0%.

### Coverage targets

- Scheduler: 100% line + branch (it's pure, no excuse).
- Repositories: 90%+ (error paths optional).
- Hook: happy path + refresh + InMemory contract.
- Pages: render + recordDrillResult call assertion.

## 7. Constitution Compliance Map

| Article | Compliance |
|---|---|
| 1 OSS only | `idb` (ISC) is only addition. ✓ |
| 2 TS browser-only | All new code is TS in `src/`. No new Python. ✓ |
| 5 Repository pattern | `SrsRepository` interface + DI factory. ✓ |
| 6 Stable line IDs | SRS keyed by `line_id` only. ✓ |
| 11 Local-first | IndexedDB only, no network. ✓ |
| 12 Backend optional | No backend dependency at all. ✓ |
| 14 Type discipline | Strict TS, no `any`, hooks fully typed. ✓ |
| 16 Containerized | Pure browser code; nothing new for Docker layer. ✓ |

## 8. Migration / Rollout

- v1 IndexedDB schema introduced at version `1`. No prior version exists.
- No data migration needed (no SRS state existed before).
- Future Phase 1.5 will bump DB version to `2` and add `session_events` store; upgrade callback creates new store, leaves `srs_state` untouched.
- Feature flag: none. Phase 1 either ships or it doesn't; no half-state.

## 9. Performance Budget

- `listAllStates()` — expected ≤ 500 records (catalog has ~50 openings × ~5 lines target). IDB read ≤ 5ms typical, ≤ 50ms p99. No pagination in v1.
- `recordDrillResult` — single read + single write, ≤ 10ms typical.
- `useSRS` mount cost — one `listAllStates`, no fan-out.
- No memoization needed for v1 record counts.

## 10. Open Items Tracked for Phase 1.5+

- Drill queue routing implementation (`/drill?queue=due` consumer).
- Per-line context-menu reset (Requirement 10.3 — depends on existing UI surface).
- BroadcastChannel for multi-tab convergence.
- `last_reviewed` displayed on RepertoirePage cards as relative time.
- Mastery sparkline / trend (Phase 1.5 needs session events).
