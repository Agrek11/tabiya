# Design: Phase 1.5 — Telemetry, Streaks, Heatmap, Repertoire Pick

## Overview

Phase 1.5 introduces a persistent, append-only event log as the single source of truth for everything that happens during drilling, then derives every new dashboard surface (streaks, heatmap tabs, accuracy cards) from it. The events log is the only new IndexedDB store with write traffic; `repertoire_pick` is a tiny single-row store. All new surfaces go through Repository interfaces (Article 5), all derivations are keyed on `line.id` (Article 6), and no event ever leaves the device (Article 11). The DI seam in `src/storage/index.ts` grows by two getters; no consumer imports a concrete class.

Two existing seams stay untouched: the SRS scheduler (Phase 1) and the drill state machine (Phase 1c). The events emitter is a passive observer wired into `DrillPage` at the points the state machine already transitions through — it does not own state, it records it. Charting is hand-rolled SVG / CSS-grid; no charting library is introduced. The single highlight primitive of Article 15 stays reserved for the board — heatmap cells are an explicitly different primitive.

R1 (events repo) blocks R2/R3/R4. R5 (RepertoirePick) is independent. R6 (migration) lands with R1 in the same PR. R7 quality gates ride on each requirement's tests.

## 1. Session events log + EventsRepository (R1)

### 1.1 IndexedDB object store

```ts
// In schema upgrade for DB_VERSION = 2
const store = db.createObjectStore('session_events', {
  keyPath: 'id',
  autoIncrement: true,
});
store.createIndex('timestamp', 'timestamp', { unique: false });
store.createIndex('lineId', 'lineId', { unique: false });
store.createIndex('eventType', 'eventType', { unique: false });
// Compound for the hot "events for line X, ordered" path
store.createIndex('lineId_timestamp', ['lineId', 'timestamp'], { unique: false });
```

Rationale: `auto-increment` keeps writes O(1) and lets us treat the store as an append-only log. The compound index serves both `listByLine` and per-line accuracy aggregation without an in-memory sort.

### 1.2 `SessionEvent` type

```ts
// src/types/events.ts
export type EventType =
  | 'line_start'
  | 'move_correct'
  | 'move_wrong'
  | 'hint_used'
  | 'line_complete'
  | 'line_abandoned';

export interface SessionEvent {
  id: number;              // assigned by IDB autoIncrement
  timestamp: number;       // ms since epoch, UTC
  eventType: EventType;
  lineId: string;          // stable slug (Article 6)
  plyIndex: number | null; // null on line_start / line_abandoned (R1.4)
  durationMs: number | null;
}

export interface EventQuery {
  from?: number;             // inclusive ms epoch
  to?: number;               // exclusive ms epoch
  lineId?: string;
  eventTypes?: EventType[];
}

export interface AggregateResult {
  countByType: Record<EventType, number>;
  totalMoves: number;        // move_correct + move_wrong
  correctMoves: number;
  accuracy: number | null;   // null if totalMoves === 0
}
```

`id` is typed `number` rather than `number | undefined` because the repository assigns it on `append` and returns the persisted event.

### 1.3 `EventsRepository` interface

```ts
// src/repository/EventsRepository.ts
export interface EventsRepository {
  append(event: Omit<SessionEvent, 'id'>): Promise<SessionEvent>;
  listByDateRange(fromMs: number, toMsExclusive: number): Promise<SessionEvent[]>;
  listByLine(lineId: string): Promise<SessionEvent[]>;
  listAll(): Promise<SessionEvent[]>; // used by streak walk-back
  aggregate(query: EventQuery): Promise<AggregateResult>;
  clearAll(): Promise<void>;
  // Test escape hatch — drop cached DB handle so a re-mocked global indexedDB takes effect.
  resetDbCache(): void;
}
```

`listAll` is bounded — at v1 retention (uncapped, see Open Question carry-over) the realistic ceiling for a heavy weekend user over a year is ~30k events at ~80 bytes/each ≈ 2.4 MB. IDB easily handles this; the cost of iterating once on dashboard mount is acceptable. If we ever exceed it, the lever is the time-windowed `listByDateRange`.

### 1.4 `IndexedDbEventsRepository`

```ts
// src/repository/IndexedDbEventsRepository.ts
const STORE = 'session_events';

export class IndexedDbEventsRepository implements EventsRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, { upgrade: runMigrations });
    }
    return this.dbPromise;
  }

  async append(ev: Omit<SessionEvent, 'id'>): Promise<SessionEvent> {
    const db = await this.getDb();
    const id = (await db.add(STORE, ev)) as number;
    return { ...ev, id };
  }

  async listByDateRange(fromMs: number, toMsExclusive: number) {
    const db = await this.getDb();
    const range = IDBKeyRange.bound(fromMs, toMsExclusive, false, true);
    return (await db.getAllFromIndex(STORE, 'timestamp', range)) as SessionEvent[];
  }

  async listByLine(lineId: string) {
    const db = await this.getDb();
    return (await db.getAllFromIndex(STORE, 'lineId_timestamp',
      IDBKeyRange.bound([lineId, -Infinity], [lineId, Infinity]))) as SessionEvent[];
  }

  async listAll() {
    const db = await this.getDb();
    return (await db.getAll(STORE)) as SessionEvent[];
  }

  async aggregate(q: EventQuery): Promise<AggregateResult> {
    // Hot path: time-windowed all-event sweep with in-memory tally.
    // For the per-line case, route through lineId_timestamp index instead.
    const events = q.lineId
      ? await this.listByLine(q.lineId)
      : (q.from !== undefined && q.to !== undefined)
        ? await this.listByDateRange(q.from, q.to)
        : await this.listAll();
    return tally(events, q);
  }

  async clearAll() { /* db.clear(STORE) */ }
}
```

Corrupt-record handling mirrors `IndexedDbSrsRepository`: a runtime type guard `isSessionEvent` skips and `console.warn`s malformed rows. This protects against partial writes if the user force-quits mid-transaction.

### 1.5 Event emission points

The drill state machine already transitions through six observable points. Emission is one-line `eventEmitter.emit(...)` per transition, scheduled via `queueMicrotask` so the IDB write never blocks the React render.

| Transition in DrillPage | Event emitted | plyIndex | durationMs |
|---|---|---|---|
| Mount with selected line (effect on `activeLine.id` change) | `line_start` | `null` | `null` |
| Move validated correct | `move_correct` | current ply | `now - lastEventTs` |
| Move validated wrong | `move_wrong` | current ply | `now - lastEventTs` |
| Hint button click | `hint_used` | current ply | `null` |
| `state.kind === 'complete'` transition | `line_complete` | last ply | `now - lineStartTs` |
| `selectedLineId` change, unmount, or `queueState` exit before complete | `line_abandoned` | last ply reached | `now - lineStartTs` |

The hook `useEventEmitter(activeLine)` owns three refs: `lineStartTsRef`, `lastEventTsRef`, `lastPlyRef`. It exposes `emit(eventType, plyIndex?)`. The hook subscribes to a single `useEffect` keyed on `activeLine.id` — on activation it emits `line_start` and seeds refs; on cleanup, if the latest state was not `complete`, it emits `line_abandoned`.

### 1.6 Batching strategy

**One write per event, no buffering.** Rationale:
- Event volume is human-paced (a fast drill is ~10 moves/min ≈ 1 event/4s). IDB `db.add` is sub-ms in this regime.
- A buffer introduces a "lost on tab close" failure mode that breaks the streak invariant (R2.1) more visibly than the user can recover from.
- The `queueMicrotask` deferral keeps the write off the render path; if a burst occurs, microtasks still serialize through the IDB connection's transaction queue.

If volume ever spikes (e.g. an auto-drill mode), revisit with a 100ms debounce buffer flushed via a single readwrite transaction.

### 1.7 Transaction strategy

Default `db.add` opens an implicit `readwrite` transaction per call — fine for the single-event path. `clearAll` uses an explicit `db.clear` (single transaction). Aggregation reads use `readonly` transactions via `getAllFromIndex`. No multi-store transactions in this phase; events and SRS are independent stores.

## 2. Streaks (R2)

### 2.1 `useStreaks` hook

```ts
// src/hooks/useStreaks.ts
export interface StreaksResult {
  drillDayStreak: number;
  lineMasteryStreak: number;
  lastUpdated: number; // ms epoch of newest event seen
}

export function useStreaks(): StreaksResult {
  const [result, setResult] = useState<StreaksResult>(EMPTY);
  const eventsBus = useEventsBus(); // notifies on append

  useEffect(() => {
    let cancelled = false;
    const recompute = async () => {
      const events = await getEventsRepository().listAll();
      if (cancelled) return;
      setResult(computeStreaks(events, new Date()));
    };
    recompute();
    return eventsBus.subscribe(recompute); // returns unsubscribe
  }, [eventsBus]);

  return result;
}
```

`useEventsBus` is a tiny in-memory pub/sub registered alongside the repository in `src/storage/index.ts`. `EventsRepository.append` calls `eventsBus.publish()` after a successful write. This avoids polling and keeps the recompute trigger explicit.

### 2.2 Computation algorithm

```ts
function computeStreaks(events: SessionEvent[], now: Date): StreaksResult {
  // Day-grouping in LOCAL timezone (R2.1 + Open Question #2 lean answer).
  const localDayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  // Drill-day streak: walk back from today.
  const daysWithStart = new Set<string>();
  for (const e of events) {
    if (e.eventType === 'line_start') daysWithStart.add(localDayKey(e.timestamp));
  }
  let drillDayStreak = 0;
  const cursor = new Date(now);
  while (daysWithStart.has(localDayKey(cursor.getTime()))) {
    drillDayStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Line-mastery streak: walk back from newest line_complete / line_abandoned.
  // Sort terminal events desc by timestamp; for each line_complete, check the
  // wrong-count for *that line session* (events between its line_start and the
  // line_complete). Reset on line_abandoned or any wrong-move in the session.
  const sessions = groupIntoLineSessions(events);
  const terminals = sessions
    .filter(s => s.terminal !== null)
    .sort((a, b) => b.terminal!.timestamp - a.terminal!.timestamp);
  let lineMasteryStreak = 0;
  for (const s of terminals) {
    if (s.terminal!.eventType === 'line_abandoned') break;
    if (s.wrongMoves > 0) break;
    lineMasteryStreak++;
  }

  return {
    drillDayStreak,
    lineMasteryStreak,
    lastUpdated: events.length ? events[events.length - 1].timestamp : 0,
  };
}
```

`groupIntoLineSessions` walks events in timestamp order, opens a session on `line_start`, accumulates `move_wrong` into `wrongMoves`, closes on `line_complete` or `line_abandoned`. Edge case: a `line_start` without a terminal (interrupted by browser close + no `beforeunload` flush) is dropped from the mastery walk — neither breaks nor extends the streak. The next `line_start` opens a fresh session.

R2.2 says "zero `move_wrong` events on the first attempt at each ply." Since each wrong attempt emits its own event, this collapses to "session had zero `move_wrong` events at all" — which is exactly what the walk above checks.

### 2.3 Memoization

`computeStreaks` is pure. The hook's `useState` holds the last result; recompute is triggered only by event-bus publish or initial mount. No need for `useMemo` over the result. The events bus emits coalesced notifications via `requestAnimationFrame` so a burst of writes during a drill session collapses into one recompute.

### 2.4 `StreaksRow` component

```tsx
// src/components/dashboard/StreaksRow.tsx
export function StreaksRow() {
  const { drillDayStreak, lineMasteryStreak } = useStreaks();
  return (
    <div className="grid grid-cols-2 gap-3">
      <StreakCard label="Days in a row" value={drillDayStreak}
                  icon="flame" muted={drillDayStreak === 0}
                  caption={drillDayStreak === 0 ? 'Start a drill to begin' : null} />
      <StreakCard label="Clean lines in a row" value={lineMasteryStreak}
                  icon="check" muted={lineMasteryStreak === 0}
                  caption={lineMasteryStreak === 0 ? 'Start a drill to begin' : null} />
    </div>
  );
}
```

## 3. Tabbed heatmap (R3)

### 3.1 Component tree

```
HeatmapTabs
├── TabBar (Daily activity | Per-opening accuracy | Hour of day) — selection persisted to localStorage['tabiya.heatmapTab']
├── DailyActivityGrid       (active when tab === 'daily')
├── OpeningAccuracyGrid     (active when tab === 'accuracy')
└── HourOfDayRow            (active when tab === 'hour')
```

Each child renderer is a pure function of `events: SessionEvent[]` provided by `HeatmapTabs` via a single `useEvents()` hook (one `listAll` per mount, re-subscribes via events bus). This guarantees the three views show consistent slices and avoids three independent IDB reads.

### 3.2 Daily activity grid

- **Layout:** 7 rows × 53 columns CSS grid, each cell 12×12 px with 2 px gap (matches GitHub contributions density).
- **Week start:** Sunday-leftmost. Today's column is the rightmost; we render the trailing 53 weeks so the rightmost column may be partial.
- **Aggregation:** `Map<localDayKey, count>` over `line_start` events. Empty days render as the lowest bucket.
- **Color buckets (5 tiers):** `0`, `1`, `2-3`, `4-7`, `8+` lines drilled. Bucket thresholds chosen so an average weekend user hits the middle tier on a normal session.
- **Implementation:** Hand-rolled inline SVG `<rect>` per cell; viewBox `0 0 742 96`. No `d3-scale` (saves 8kB). Tailwind classes for the 5 fill colors.
- **Tooltip:** Native `<title>` element on each rect — zero JS, accessible, free.

### 3.3 Per-opening accuracy grid

- **Aggregation pipeline:**
  1. Group events by `lineId`.
  2. For each line: compute `accuracy = correct / (correct + wrong)` over all events.
  3. Filter out lines with `< 5 line_complete events` (Open Question #3 lean answer — guard against tiny-sample distortion).
  4. Resolve `lineId → familyId` via `OpeningRepository.getOpeningByLineId(lineId)`.
  5. Bucket each line into one of 5 accuracy ranges.
  6. Tally `Map<familyId, Record<bucket, count>>`.
- **Layout:** CSS grid, rows = families with ≥1 qualifying line, columns = `[0-49, 50-69, 70-84, 85-94, 95-100]%`. Each cell is a colored square with the line count, intensity proportional to count.
- **Empty cell:** rendered as a neutral hairline outline (not blank — keeps grid scannable).
- **Footnote:** "Lines with fewer than 5 completed sessions are hidden."

### 3.4 Hour of day row

- **Layout:** Single row of 24 cells (hours 0..23 local time), 24 × 32 px CSS grid.
- **Aggregation:** Tally `line_start` count by `new Date(ts).getHours()`.
- **Color buckets:** Same 5-tier scale as daily activity, thresholds rescaled to typical hourly counts (`0`, `1-2`, `3-5`, `6-10`, `11+`).
- **Labels:** Tick marks at 0, 6, 12, 18, 23.

### 3.5 Empty state per tab

If `events.length === 0` (or no `line_start` events), render `<EmptyState caption="Drill a line to start seeing your activity here." />` inside the tab body. The panel and tab bar always render (R3.5).

### 3.6 Why not the Article 15 highlight primitive

The board highlight primitive (Phase 3 AI Coach) is `(square: ChessSquare, color: HighlightColor) → SVG overlay over a chess board`. Heatmap cells are `(coordinate: GridCoord, bucket: number) → colored rect in a calendar/grid`. Different coordinate spaces, different lifecycles (board overlay is transient on click; heatmap cell is static layout). Article 15 explicitly reserves the board primitive — we name `HeatmapTabs`' cells "heatmap-cell" in classnames so no future refactor mistakes them for square highlights.

## 4. Accuracy (R4)

### 4.1 `useAccuracy` hook

```ts
// src/hooks/useAccuracy.ts
export interface AccuracyResult {
  allTime: { accuracy: number | null; moves: number };
  rolling7d: { accuracy: number | null; moves: number };
  deltaPp: number | null; // 7d - allTime, in percentage points, null if either side null
}

export function useAccuracy(): AccuracyResult { /* ... */ }
export function useLineAccuracy(lineId: string): { accuracy: number | null; moves: number };
```

### 4.2 Aggregation queries

```ts
const repo = getEventsRepository();
const all = await repo.aggregate({}); // listAll path
const sevenDayCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recent = await repo.aggregate({ from: sevenDayCutoff, to: Date.now() + 1 });
```

`AggregateResult.accuracy` is `correctMoves / totalMoves` or `null` when `totalMoves === 0`. Components render `—` and "No moves yet" for null (R4.5).

### 4.3 Delta computation

```ts
const deltaPp = (rolling7d.accuracy !== null && allTime.accuracy !== null)
  ? +(rolling7d.accuracy * 100 - allTime.accuracy * 100).toFixed(1)
  : null;
```

Rendered as `+1.2pp` / `-0.4pp` / `=` (within ±0.05pp shown as `=`).

### 4.4 Per-line badge data flow

```
RepertoirePage
  └─ LineRow (per line)
       └─ const { accuracy, moves } = useLineAccuracy(line.id)
             → renders <AccuracyBadge value={accuracy} moves={moves} />
```

`useLineAccuracy` shares the events-bus subscription with `useStreaks`/`useAccuracy` so a single drill session triggers one cascade of recomputes across the page. To prevent N+1 IDB reads when N=50 lines are rendered, the hook reads from a shared in-memory `useEventsContext` provider that publishes `Map<lineId, AggregateResult>` derived once.

## 5. RepertoirePick (R5)

### 5.1 `presets.yml` schema extension

Existing preset shape carries `tier_band` + `family_ids`. We add an optional `lines:` field. When present it is authoritative; when absent the legacy tier/family filter is used (R5.1 fallback).

```yaml
presets:
  - id: beginner
    name: Beginner
    description: Solid, low-theory openings. Great starting point.
    tier_band: [1]
    family_ids: [london, caro-kann, italian]
    lines:
      - london-system-main
      - caro-kann-classical-main
      - italian-giuoco-piano-main
      # ... explicit line IDs
    recommended_color: both
  - id: 'off'
    name: 'Off — custom'
    description: All lines visible. Pick freely.
    tier_band: [1, 2, 3]
    family_ids: []
    lines: []   # empty + presetId='off' means "no preset filter"
    recommended_color: both
```

`scripts/validate_presets.py` asserts every `lines[].id` exists in `public/catalog.json`; failure breaks the build (Article 14 lint posture).

### 5.2 Types

```ts
// src/types/repertoire.ts
export interface RepertoirePreset {
  id: string;
  name: string;
  description: string;
  tier_band: number[];
  family_ids: string[];
  lines: string[];        // new — explicit member line IDs; empty for 'off'
  recommended_color: 'white-only' | 'black-only' | 'both';
}

export interface RepertoirePick {
  presetId: string;
  additions: string[];    // lineIds added on top of preset
  removals: string[];     // lineIds removed from preset
}

export interface EffectivePick {
  lineIds: Set<string>;   // (preset.lines ∪ additions) \ removals
  presetId: string;
  isFiltered: boolean;    // false when presetId === 'off' AND additions/removals empty
}
```

### 5.3 `RepertoireRepository` interface

```ts
// src/repository/RepertoireRepository.ts
export interface RepertoireRepository {
  getPick(): Promise<RepertoirePick>;       // returns default if no row
  savePick(pick: RepertoirePick): Promise<void>;
  resetPick(): Promise<void>;                // back to default { presetId: 'off', ... }
  resetDbCache(): void;
}

// src/repository/IndexedDbRepertoireRepository.ts — single-row store
const STORE = 'repertoire_pick';
const KEY = 'current';

// upgrade: db.createObjectStore('repertoire_pick'); // out-of-line key, key='current'
```

### 5.4 Effective pick computation

```ts
// src/repertoire/effectivePick.ts
export function computeEffectivePick(
  pick: RepertoirePick,
  presets: RepertoirePreset[],
  allLineIds: string[],
): EffectivePick {
  const preset = presets.find(p => p.id === pick.presetId);
  if (!preset || preset.id === 'off') {
    return {
      lineIds: new Set([...allLineIds, ...pick.additions].filter(id => !pick.removals.includes(id))),
      presetId: pick.presetId,
      isFiltered: pick.additions.length > 0 || pick.removals.length > 0,
    };
  }
  const base = preset.lines.length > 0
    ? new Set(preset.lines)
    : deriveFromTierAndFamily(preset, allLineIds); // legacy fallback (R5.1)
  for (const id of pick.additions) base.add(id);
  for (const id of pick.removals) base.delete(id);
  return { lineIds: base, presetId: pick.presetId, isFiltered: true };
}
```

### 5.5 `RepertoirePicker` component

```
RepertoirePicker (panel)
├── Header: "Active preset: <name>" + count "<N> effective lines"
├── PresetRadio (Off | Beginner | Intermediate | Advanced)
│      └── on change → showConfirmDialog if (additions ∪ removals).size > 0
├── ShowAllToggle (default off → only show preset members; on → show all catalog lines)
└── LineList (collapsible per family)
       └── LineCheckbox (per line) — checked iff line.id ∈ effective.lineIds
              on toggle:
                if line ∈ preset.lines:
                  if currently in removals → remove from removals
                  else → add to removals
                else:
                  if currently in additions → remove from additions
                  else → add to additions
              then call RepertoireRepository.savePick(...)
```

The confirm dialog (R5.7) uses the existing modal primitive from Phase 1c summary screen. Cancel keeps prior preset selected via controlled radio state.

### 5.6 Filter integration

`usePreset()` (Phase 1c) is replaced by a new `useEffectivePick()` hook:

```ts
export function useEffectivePick(): EffectivePick;
```

Consumers updated:
- `RepertoirePage` — filters family grid by `effective.lineIds`; respects `ShowAllToggle`.
- `DrillPage` line picker — filters dropdown by `effective.lineIds`.
- `useSRSDueQueue` (Phase 1c) — intersects `dueLineIds` with `effective.lineIds` so `?queue=due` only routes drillable picks.

`usePreset` is removed in this phase; the migration is a string-for-string substitution since `EffectivePick` carries `presetId`.

## 6. Schema migration + DI wiring (R6)

### 6.1 Baseline

```
DB_NAME = 'tabiya'
DB_VERSION (current) = 1
  └── 'srs_state' (keyPath: 'line_id', index: 'box')
```

### 6.2 New version

```
DB_VERSION (new) = 2
  ├── 'srs_state'  (unchanged)
  ├── 'session_events' (keyPath: 'id' autoIncrement, indices: timestamp, lineId, eventType, lineId_timestamp)
  └── 'repertoire_pick' (out-of-line key, single row keyed 'current')
```

### 6.3 Upgrade function

The schema definition is hoisted out of `IndexedDbSrsRepository` into a new shared module so both repositories open the DB through one upgrade path:

```ts
// src/repository/db/schema.ts
export const DB_NAME = 'tabiya';
export const DB_VERSION = 2;

export function runMigrations(db: IDBPDatabase, oldVersion: number): void {
  // v0 -> v1
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains('srs_state')) {
      const s = db.createObjectStore('srs_state', { keyPath: 'line_id' });
      s.createIndex('box', 'box', { unique: false });
    }
  }
  // v1 -> v2 (this phase)
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains('session_events')) {
      const s = db.createObjectStore('session_events', { keyPath: 'id', autoIncrement: true });
      s.createIndex('timestamp', 'timestamp', { unique: false });
      s.createIndex('lineId', 'lineId', { unique: false });
      s.createIndex('eventType', 'eventType', { unique: false });
      s.createIndex('lineId_timestamp', ['lineId', 'timestamp'], { unique: false });
    }
    if (!db.objectStoreNames.contains('repertoire_pick')) {
      db.createObjectStore('repertoire_pick'); // out-of-line keys
    }
  }
}
```

### 6.4 Additivity proof

- No `db.deleteObjectStore` call.
- No mutation of `srs_state` schema or contents.
- New stores created only via `createObjectStore` guarded by `objectStoreNames.contains` checks.
- A fresh browser at v0 cascades both `oldVersion < 1` and `oldVersion < 2` blocks in order.
- An existing Phase 1c user at v1 runs only the `oldVersion < 2` block; their `srs_state` is untouched.

Test `tests/events/migration.spec.ts` seeds a v1 DB with 3 SRS records via `fake-indexeddb`, reopens at v2, asserts (a) `srs_state` still returns those records and (b) `session_events` + `repertoire_pick` exist and are empty.

### 6.5 DI wiring

```ts
// src/storage/index.ts (extended)
let _eventsRepo: EventsRepository | null = null;
let _repertoireRepo: RepertoireRepository | null = null;
let _eventsBus: EventsBus | null = null;

export function getEventsRepository(): EventsRepository {
  if (_eventsRepo === null) {
    const bus = getEventsBus();
    _eventsRepo = wrapWithBusNotify(new IndexedDbEventsRepository(), bus);
  }
  return _eventsRepo;
}

export function getRepertoireRepository(): RepertoireRepository {
  if (_repertoireRepo === null) {
    _repertoireRepo = new IndexedDbRepertoireRepository();
  }
  return _repertoireRepo;
}

export function getEventsBus(): EventsBus {
  if (_eventsBus === null) _eventsBus = createEventsBus();
  return _eventsBus;
}

export function _setEventsRepositoryForTesting(r: EventsRepository | null): void { _eventsRepo = r; }
export function _setRepertoireRepositoryForTesting(r: RepertoireRepository | null): void { _repertoireRepo = r; }
```

`wrapWithBusNotify` is a thin decorator that calls `bus.publish()` after `append` and `clearAll`. This keeps the repository concrete impl ignorant of the bus.

### 6.6 Reset telemetry button

```tsx
// src/components/settings/ResetTelemetryButton.tsx
export function ResetTelemetryButton() {
  const onClick = async () => {
    const ok = await confirm('Reset telemetry will delete all session events. SRS progress is not affected. Continue?');
    if (!ok) return;
    await getEventsRepository().clearAll();
    // bus.publish fires inside clearAll, dashboards recompute to empty state.
  };
  return <button onClick={onClick} className="btn-danger-secondary">Reset telemetry</button>;
}
```

Lives in `SettingsPage` under a "Data" section, separate from existing per-line SRS reset (Phase 1c) so the two cannot be confused.

## 7. Quality gates + tests (R7)

### 7.1 Test file layout

```
tests/
├── events/
│   ├── EventsRepository.spec.ts        # append, listByDateRange, listByLine, aggregate, clearAll, TZ edges
│   └── migration.spec.ts               # v1 → v2 additivity, SRS preserved
├── hooks/
│   ├── useStreaks.spec.ts              # 6 scenarios (R7.2)
│   └── useAccuracy.spec.ts             # 4 scenarios (R7.3) incl. 7-day boundary at the second
├── repertoire/
│   ├── effectivePick.spec.ts           # set algebra
│   └── RepertoireRepository.spec.ts
├── components/
│   ├── HeatmapTabs.spec.tsx            # tab switching, empty state per tab, localStorage persistence
│   ├── RepertoirePicker.spec.tsx       # confirm flow, toggle adds-to-additions vs removals
│   └── StreaksRow.spec.tsx             # muted style at zero
└── integration/
    └── drill-emits-events.spec.tsx     # full sequence assertion (R7.5)
```

### 7.2 EventsRepository case matrix (R7.1, ≥15 cases)

| # | Case |
|---|---|
| 1 | append assigns id and returns persisted event |
| 2 | listByDateRange empty store returns [] |
| 3 | listByDateRange respects inclusive `from` |
| 4 | listByDateRange respects exclusive `to` |
| 5 | listByDateRange across day boundary returns both |
| 6 | listByDateRange across DST forward jump |
| 7 | listByDateRange across DST backward jump |
| 8 | listByLine empty returns [] |
| 9 | listByLine returns only requested lineId in timestamp order |
| 10 | aggregate empty store → null accuracy |
| 11 | aggregate all-correct → 1.0 |
| 12 | aggregate mixed → expected ratio |
| 13 | aggregate per-line scoping |
| 14 | clearAll removes all but leaves store schema intact |
| 15 | corrupt record (manual put with wrong shape) is skipped + warned |
| 16 | append publishes on events bus |

### 7.3 Charting and size budget

Heatmap chart strategy:

| Approach | Approx gzip cost | Verdict |
|---|---|---|
| `d3-scale` only | ~9 kB | Rejected — saves bucket math but pulls peer deps |
| `recharts` / `victory` | 40+ kB | Rejected — blows budget |
| Hand-rolled inline SVG + CSS grid + pure-fn bucketing | ~2 kB heatmap code itself | **Chosen** |
| `d3-array` `extent`/`bisect` | ~3 kB | Optional micro-import if perf hot path appears later |

20 kB combined budget split (gzip estimates):

| Module | Budget |
|---|---|
| HeatmapTabs + 3 child renderers | 7 kB |
| RepertoirePicker | 5 kB |
| useStreaks + useAccuracy + computeStreaks/aggregate helpers | 3 kB |
| EventsRepository + RepertoireRepository (incl. schema migration) | 4 kB |
| Buffer | 1 kB |

Enforced via existing `npm run build` step that already prints chunk sizes; CI gate asserts the diff against the baseline `dist/` manifest. If overrun by 50% of a single module, the file is split and the offending dep audited via `vite-bundle-visualizer` (dev-only).

### 7.4 Type discipline

- `src/types/events.ts` and `src/types/repertoire.ts` use `interface`/`type` exclusively, no `any` (Article 14).
- `runMigrations` argument typed `IDBPDatabase` directly from `idb`.
- `scripts/validate_presets.py` gets full Python type hints (Article 14 second clause).
- ESLint `@typescript-eslint/no-explicit-any` is already error-level; no new inline justification comments anticipated.

### 7.5 Integration test (R7.5)

`drill-emits-events.spec.tsx`:
1. Render `<DrillPage />` with a 6-ply line via test repository.
2. Make 6 correct moves through the chess-board test harness.
3. Assert `getEventsRepository().listAll()` returns exactly: `[line_start, move_correct×6, line_complete]` with `plyIndex` ascending 0..5 on the move events and equal to 5 on `line_complete`.
4. Variant: same line but inject one wrong move at ply 3 → expect `[line_start, move_correct×3, move_wrong, move_correct, ..., line_complete]` and assert mastery streak for this single session is broken.

## 8. Component tree — Dashboard surface

```
DashboardPage
├── HeaderRow (existing)
├── StreaksRow                       (new) — R2
│    ├── StreakCard "Days in a row"
│    └── StreakCard "Clean lines in a row"
├── AccuracyRow                      (new) — R4
│    ├── AccuracyCard "All-time"
│    └── AccuracyCard "Last 7 days" (+ delta badge)
├── DueQueueCTA (existing — Phase 1c)
├── HeatmapTabs                      (new) — R3
│    ├── TabBar
│    └── (one of)
│        ├── DailyActivityGrid
│        ├── OpeningAccuracyGrid
│        └── HourOfDayRow
└── EventsContextProvider (wraps the above, single listAll() per dashboard mount)
```

`EventsContextProvider` is the deduplication seam: it owns one `listAll()` result and a bus subscription; `useStreaks`, `useAccuracy`, and the heatmap children all read from it. Without it the dashboard would fire 3+ `listAll`s on mount.

`RepertoirePage` (separate route) gets its own `EventsContextProvider` for the per-line badge fan-out described in §4.4.

## 9. Files-touched delta vs requirements forecast

Design adds two files not in the requirements forecast:

- `src/repository/db/schema.ts` — extracted upgrade path (see §6.3).
- `src/state/EventsContext.tsx` — dashboard-scoped events provider (see §8) and bus seam.

Two files in the forecast are renamed by this design for clarity:

- `src/repository/EventsRepository.ts` is created; the old `src/storage/srs/IndexedDbSrsRepository.ts` is **not** moved (keeps Phase 1 churn at zero).
- `src/hooks/useEventEmitter.ts` is created exactly as forecast; it imports `getEventsRepository()` and `getEventsBus()` from `src/storage/index.ts`.

The package layout choice (`src/repository/` per forecast vs existing `src/storage/`): we will adopt the new path `src/repository/` for the two new repositories, keeping legacy `src/storage/` for existing code. A follow-up micro-phase can rename the existing `src/storage/` to `src/repository/` once the new path stabilizes — not in scope here, deliberately, to keep this phase's diff focused.

## 10. Constitution compliance

- **Article 5** — Two new repository interfaces (`EventsRepository`, `RepertoireRepository`); zero direct IDB calls from components/hooks (verified by ESLint rule scoping `idb` imports to `src/repository/` and `src/storage/`).
- **Article 6** — Every event row carries `lineId` slug. RepertoirePick `additions`/`removals` are `string[]` of line slugs. Per-line accuracy keyed by `line.id`.
- **Article 11** — No `fetch`, `navigator.sendBeacon`, `postMessage` to a non-self origin in any new file. Lint rule added to enforce. "Reset telemetry" is fully local.
- **Article 12** — Backend stays optional; this phase adds zero backend surface.
- **Article 14** — Strict TS, no `any` in new files. Python type hints on `validate_presets.py`. Lint passes are merge-blocking as today.
- **Article 15** — Heatmap cells explicitly named/classed as `heatmap-cell`, not square highlights. Board overlay primitive remains untouched.

## 11. Open question dispositions

| # | Question | Lean → Design decision |
|---|---|---|
| 1 | Retention cap on `session_events` | **Ship uncapped in v1.5.** Volume math (§1.3) shows <3 MB/year worst case. Revisit with daily-aggregate compaction in a separate micro-phase if/when a real user hits 50k events. **Flagged for user confirmation before merge.** |
| 2 | Streak timezone semantics | **Use local timezone at query time** (§2.2 `localDayKey`). Document edge case (travelling user) in `Settings → Help → Telemetry`. No clock-jump heuristics. |
| 3 | Per-line accuracy minimum sample | **Threshold = 5 line_complete events** (§3.3). Footnote shown under the grid. Adjustable via a single constant `MIN_LINE_COMPLETES_FOR_HEATMAP` if tuning needed. |

Outstanding for user input: **#1 retention strategy** — confirm "uncapped + revisit later" is acceptable, or call for compaction now. Everything else folds into the implementation.
