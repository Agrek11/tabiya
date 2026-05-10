# Design: Phase 1c — V1 Completeness

## Overview

Phase 1c is connective-tissue work — wiring already-shipped data into UX surfaces. No new schema layers (transposition index + RepertoirePick are explicitly Phase 2+). Single-file changes dominate; minimal cross-module coupling.

## 1. Drill queue routing (`?queue=due`)

### Architecture

Queue lives in DrillPage local state. No new global store. Source of truth: `useSRS().dueLineIds` snapshot at queue entry — frozen for the session so a Box-3 → Box-2 transition mid-session doesn't reorder remaining drills.

### State machine

```
DrillPage.queueState =
  | { kind: 'off' }
  | { kind: 'active'; lineIds: string[]; index: number }
  | { kind: 'exhausted' }
```

Transitions:
- mount with `?queue=due` AND `dueLineIds.length > 0` → `active`, index=0, line = lineIds[0]
- line `complete` AND queueState.kind === 'active' AND index+1 < lineIds.length → advance index, set selectedLineId = lineIds[index+1]
- line `complete` AND queueState.kind === 'active' AND index+1 === lineIds.length → `exhausted`
- user changes opening/line via picker → `off`
- mount without `?queue=due` → `off`

### Header indicator

When `queueState.kind === 'active'`: render small badge in repertoire row "QUEUE 2/4 due". Click → exits queue mode.

### Exhausted state UI

Replace board with StateMessage: "All caught up · 4 lines mastered today" + CTA "Back to Dashboard".

## 2. Strategic notes panel

### Placement

Below board, above move history rail (or in right rail above existing "INLINE COACH LINE"). Single React component `StrategicNotesPanel` taking `notes: string[]`.

### Behavior

- Default state: collapsed (chevron right + "Strategy")
- Persisted open/closed in `localStorage tabiya.strategyOpen`
- Empty state: rendered with caption, not hidden

## 3. Fork annotation rendering

### Data flow

- `activeLine.forks: ForkAnnotation[]` already in catalog
- Map each fork by `ply_index`
- During render, decorate move-history-grid cells at fork ply with badge

### Components

- `ForkBadge` — small `⋔` icon button next to ply number
- `ForkPopover` — opens on click, lists alternatives + label + rationale; closes on outside click via `useClickOutside`
- Reuse popover-item visual style from existing piece dropdown

### Move-history grid wiring

Pass `forks: ForkAnnotation[]` prop. Grid checks `forks.find(f => f.ply_index === idx)` per cell.

## 4. Tier 2 content expansion

### YAML additions

For each Tier 2 family in `families.yml`, add 1 variation in `variations.yml` + 1 line in `lines.yml`. ~14 new variations + 14 new lines.

Critical lines per family (most-played at master level):

| Family | Variation | Line |
|---|---|---|
| Vienna | Vienna Game | 1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 ... |
| Scotch | Schmidt Variation | 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nxc6 ... |
| Scandinavian | 3...Qa5 | 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 ... |
| Pirc | Classical | 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 ... |
| Alekhine | Modern | 1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 ... |
| Slav | Main Line | 1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 ... |
| Semi-Slav | Meran | 1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 ... |
| Nimzo-Indian | Rubinstein | 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 ... |
| Queen's Indian | Petrosian | 1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.a3 ... |
| Grünfeld | Exchange | 1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 ... |
| Catalan | Open | 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 ... |
| English | Symmetrical | 1.c4 c5 2.Nc3 Nc6 3.g3 ... |
| KIA | Main | 1.Nf3 d5 2.g3 Nf6 3.Bg2 c6 4.O-O ... |
| Dutch | Stonewall | 1.d4 f5 2.g3 Nf6 3.Bg2 e6 4.Nf3 d5 ... |

## 5. Repertoire presets

### Schema

```yaml
# scripts/curated/presets.yml
presets:
  - id: beginner
    name: Beginner
    description: Solid, low-theory openings. London + Caro-Kann.
    tier_band: [1]
    family_ids: [london, caro-kann, italian]
    recommended_color: both

  - id: intermediate
    name: Intermediate
    description: Classical mainlines.
    tier_band: [1, 2]
    family_ids: [spanish, italian, sicilian, french, queens-gambit-declined, kings-indian]
    recommended_color: both

  - id: advanced
    name: Advanced
    description: Sharp tactical theory + deep variations.
    tier_band: [1, 2, 3]
    family_ids: []  # empty = all
    recommended_color: both
```

### Type

```ts
type RepertoirePreset = {
  id: string;
  name: string;
  description: string;
  tier_band: number[];
  family_ids: string[];   // empty = all
  recommended_color: 'white-only' | 'black-only' | 'both';
};
```

### Storage

`localStorage tabiya.repertoirePreset` — preset.id or 'custom' (default). Read by `usePreset()` hook. Filter Repertoire + Drill picker.

### UI

Settings page: card with 4 radio options (Off / Beginner / Intermediate / Advanced). Tooltip per preset shows description + family list.

## 6. End-of-line summary screen

### Component

`<EndOfLineSummary line={activeLine} drillResult={drillResult} prevSrsState={...} nextSrsState={...} onRestart={...} onDrillDue={...} onNext={...} />`

### Position

Replaces "INLINE COACH LINE" + status row when `state.kind === 'complete'` AND `queueState.kind !== 'active'`.

### Mastery delta

Compute from `prevSrsState?.box` + `nextSrsState?.box`. Show "Box 2 → Box 3 ↑" style indicator.

## 7. Per-line SRS reset menu

### Component

`<LineActionsMenu line={...} hasState={boolean} onReset={...} />` — small `⋮` icon button next to each line row in Repertoire page.

### Behavior

- Click → popover with single item "Reset SRS"
- Disabled if `!hasState`
- On click: `getSrsRepository().resetState(line.id)` + refresh useSRS

## 8. Wife re-test intake doc

Just a skeleton text file in `specs/`. Pure markdown.

## Dependency graph

```
[1] Drill queue ─── independent
[2] Strategic notes ─── independent
[3] Fork render ─── independent
[4] Tier 2 content ─── independent
[5] Presets ─── depends on [4] for tier_band filtering to be useful
[6] End-of-line summary ─── depends on [1] for queue-skip behavior
[7] Per-line reset ─── independent
[10] Wife intake ─── independent
```

Execution order: 4, 1, 2, 3, 6, 5, 7, 10.

## Testing approach

- Unit tests for new helpers: queue state machine transitions, preset filter logic, mastery delta computation
- Component tests: StrategicNotesPanel render, ForkPopover, EndOfLineSummary, LineActionsMenu
- Integration: queue mode end-to-end (queue 3 lines → drill all → exhausted state), preset filter applied to Repertoire grid
- Build test: rebuild catalog with new Tier 2 lines + presets.yml, verify family/variation/line counts

Coverage gate: scheduler 100% retained; new modules ≥ 80%.

## Constitution compliance

- Article 5: queue state local to DrillPage; preset filter via existing Repository methods, no new concrete deps
- Article 6: queue keyed on line.id snapshots; preset filter on family.id (stable)
- Article 8: build-time validation runs over Tier 2 additions
- Article 11: queue and preset are pure browser state (URL + localStorage)
- Article 14: full strict TS, no `any`
