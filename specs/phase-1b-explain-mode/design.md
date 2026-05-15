# Design: Phase 1b — Explain Mode

## Overview

Explain Mode is a sibling render of an opening line: instead of asking the user to play moves, it walks both colors ply-by-ply with overlays (arrows, highlighted squares) and a "why this move" rationale, then auto-advances. It reuses everything `useDrill` already owns (chess.js instance, line iterator, sound, last-move highlight) and the Phase 1.5/Article 15 highlight primitive. Nothing in drill mode changes; explain is a new branch from `DrillPage` keyed by a per-line localStorage flag.

Architectural seams:

1. **Mode seam** — `DrillPage` becomes a router between `<DrillView>` (existing) and `<ExplainView>` (new). Both consume the same `Line` from `OpeningRepository`. No new top-level route, no new global store.
2. **Content seam** — `explain` data is sidecar (`data/explain/<lineId>.json`), lazy-loaded on mode entry. The base `Line` shape stays the same byte-for-byte; only `Line.explain?` (optional) hangs off it after hydration. Catalog bundle size unchanged for lines without explain content.
3. **Overlay seam** — `<ArrowLayer>` and `<HighlightLayer>` are dumb primitives consumed by both Pattern Viz (Phase 1.5) and Explain Mode. Constitution Article 15 — one primitive, not two.
4. **Authoring seam** — `scripts/build_explain.py` and `scripts/review_explain.py` live alongside `scripts/build_catalog.py` and do not ship in the bundle. Pure Python, direct SDK call (Article 3).

Build size budget: +12kB gzip for the mode shell + overlay components combined (R5).

Dependency graph:

```
[R2 schema]  ──► [R3 hook]  ──► [R1 toggle]
   │              │  ▲
   ▼              │  │
[R4 author]   [R6 TTS]   [R7 truncate]
   │
   ▼
[Gold line content]
```

Execution order: R2, R3 (no TTS yet), R1, R6, R7, then R4 (authoring pipeline + gold content), R5 (tests + budget).

---

## 1. R1 — Mode toggle on drill page

### Placement

Inside the existing `DrillPage` header row, beside the Opening/Line pickers (per the v1.3 layout comment block in `src/pages/DrillPage.tsx`). The toggle is a small two-state segmented control, pill-styled to match the existing pickers:

```
[Opening ▼]  [Line ▼]                  [ Drill │ Explain ]
```

The header `[Mode ▼]` slot already noted in the wireframe comment is where this lands. Mobile: same row, last in flex order.

### Visibility rules

| `activeLine.explain` (after lazy-load) | Toggle |
|---|---|
| `undefined` (sidecar 404 or not yet authored) | Hidden |
| `[]` empty array | Hidden |
| Non-empty `ExplainBlock[]` | Visible, default Drill |

Hidden ≠ removed from DOM permanently. The fetcher transitions through `loading`; the toggle renders disabled (greyed) during `loading`, hidden on `missing`, enabled on `loaded`. Avoids flicker.

### Per-line persistence

```
localStorage key: tabiya:linePrefs:<lineId>:mode
value:            "drill" | "explain"
default:          "drill" (if absent)
```

Read on `activeLineId` change. Write on toggle click. Switching lines does not clear other lines' preferences (one key per line).

### Mode switch semantics

Switching mode mid-line: dispatch `RESET` to whichever hook is active and re-mount the inactive view. The unified line view (`DrillView` or `ExplainView`) sees ply 0 as if freshly loaded. This is enforced by mounting them under different React keys (`key={"drill-" + lineId}` vs `key={"explain-" + lineId}`), so React unmounts cleanly and chess.js instances do not leak across modes.

### Sidebar / Repertoire entry

Unchanged. Repertoire grid still drives into DrillPage (0d.1 decision). Explain Mode never appears in Sidebar.

### Component sketch

```tsx
// src/pages/DrillPage.tsx (additions)
const [mode, setMode] = useLinePrefMode(activeLineId);      // 'drill' | 'explain'
const explain = useExplainContent(activeLineId);            // see §3

const toggleVisible = explain.kind === 'loaded';
const toggleDisabled = explain.kind === 'loading';

return (
  <>
    <Header>
      <OpeningPicker /> <LinePicker />
      {toggleVisible && <ModeToggle value={mode} onChange={setMode} disabled={toggleDisabled} />}
    </Header>
    {mode === 'drill'
      ? <DrillView key={`drill-${activeLineId}`} line={activeLine} />
      : <ExplainView key={`explain-${activeLineId}`} line={activeLine} blocks={explain.data} />}
  </>
);
```

`useLinePrefMode(lineId)` is a tiny hook that wraps `localStorage` get/set and re-syncs on `lineId` change. Constitution Article 11 (local-first) holds — no network.

---

## 2. R2 — Schema extension for explain blocks

### TypeScript additions to `src/storage/types.ts`

```ts
export type ArrowColor = 'green' | 'red' | 'blue';

export type Arrow = {
  from: string;          // algebraic square e.g. "e2"
  to: string;            // algebraic square e.g. "e4"
  color?: ArrowColor;    // default 'green'
};

export type HighlightSquare = {
  square: string;        // e.g. "d5"
  intent?: 'focus' | 'threat' | 'support';   // styling hint
};

export type ExplainBlock = {
  rationale: string;            // 1-3 sentence "why"
  arrows?: Arrow[];             // overlay arrows
  highlights?: HighlightSquare[]; // overlay squares (reuses Article 15 primitive)
  threats?: string;             // optional deeper "if ..." note
  pauseMs?: number;             // default 2500; per-ply override
};

// Existing MoveNode/Line gains optional explain:
// In the runtime, blocks attach by index = ply_index. Sidecar shape (see §3)
// is { line_id, schema_version, blocks: ExplainBlock[] }. We DO NOT widen
// `Line.moves` (it stays string[]). Instead `Line.explain?: ExplainBlock[]`
// is set after lazy-load — same length as `Line.moves` (one per ply) or
// undefined if no sidecar.

export type Line = {
  // ... existing fields ...
  explain?: ExplainBlock[];     // length === moves.length when present
};
```

### Python additions to `scripts/tabiya_build/schema.py`

```python
class Arrow(BaseModel):
    from_: str = Field(..., alias="from", min_length=2, max_length=2)
    to: str = Field(..., min_length=2, max_length=2)
    color: Literal["green", "red", "blue"] | None = None

class HighlightSquare(BaseModel):
    square: str = Field(..., min_length=2, max_length=2)
    intent: Literal["focus", "threat", "support"] | None = None

class ExplainBlock(BaseModel):
    rationale: str = Field(..., min_length=1)   # no upper bound (R7)
    arrows: list[Arrow] | None = None
    highlights: list[HighlightSquare] | None = None
    threats: str | None = None
    pause_ms: int | None = Field(default=None, ge=500, le=20_000)

class ExplainSidecar(BaseModel):
    line_id: str
    schema_version: int                          # mirrors Catalog.schema_version
    blocks: list[ExplainBlock]                   # length MUST match line.moves
```

### Validation gates (build time)

In `scripts/build_catalog.py` (or a new `scripts/validate_explain.py` invoked by it):

1. For every file in `data/explain/`, load `ExplainSidecar`.
2. Look up the line by `line_id`. If missing → build fails.
3. Assert `len(blocks) == len(line.moves)` (strict equality). Off-by-one fails build.
4. Assert each `arrow.from`/`arrow.to`/`highlight.square` is a legal square string (regex `^[a-h][1-8]$`).
5. `schema_version` matches current `Catalog.schema_version`.

Failures at build time, not runtime (per R2 AC).

### Catalog schema_version bump

Add `schema_version: int` to the top-level `Catalog` model (currently has only `version: str` = build date). Bump from 1 → 2 in this phase. Frontend reads the field on catalog load; mismatch → console.warn + force users to clear IndexedDB (existing SRS-reset path, no-op v1 if no DB writes happen yet).

```python
class Catalog(BaseModel):
    version: str
    schema_version: int = 2     # NEW in Phase 1b
    families: list[Family]
    # ...
```

TypeScript mirror in `src/storage/types.ts`:

```ts
export type Catalog = {
  version: string;
  schema_version: number;  // NEW
  // ...
};
```

### Why optional, why sidecar, why not inline

- **Optional**: Article 7 lines are unchanged; explain is purely additive. Lines without explain ship zero bytes of explain data.
- **Sidecar**: Bundle stays lean — `catalog.json` doesn't bloat by ~5-8 KB per fully-annotated line. Only lines the user actually opens cost the fetch.
- **Stable IDs**: Sidecar files are keyed on `line_id` (Article 6). A catalog refresh that removes a line orphan-leaves its sidecar, harmless.

---

## 3. Sidecar layout + lazy-load

### File layout

```
public/explain/
  <line_id>.json     # e.g. public/explain/italian-game-main.json
```

Lives in `public/` (Vite static asset root) so the production build copies it to `dist/explain/`. The authoring source lives in `data/explain/<line_id>.json`; a build step (`scripts/build_explain.py --copy-to-public`) copies validated files into `public/explain/`. The `data/explain/` source dir is checked in; `public/explain/` is build output (gitignored, regenerated).

### Sidecar JSON shape

```json
{
  "line_id": "italian-game-main",
  "schema_version": 2,
  "blocks": [
    {
      "rationale": "King's pawn opens lines for the bishop and queen, contests the center.",
      "arrows": [{ "from": "e2", "to": "e4" }],
      "highlights": [{ "square": "d5", "intent": "focus" }],
      "pauseMs": 2500
    }
    // ... one entry per ply ...
  ]
}
```

### Fetcher: `useExplainContent(lineId)`

```ts
// src/hooks/useExplainContent.ts
type ExplainContentState =
  | { kind: 'idle' }
  | { kind: 'loading'; lineId: string }
  | { kind: 'loaded'; lineId: string; data: ExplainBlock[] }
  | { kind: 'missing'; lineId: string }        // 404 — graceful degrade
  | { kind: 'error'; lineId: string; err: string };

const cache = new Map<string, ExplainBlock[] | 'missing'>();

export function useExplainContent(lineId: string | null): ExplainContentState {
  // 1. lineId === null → idle
  // 2. cache hit → synchronous 'loaded' or 'missing'
  // 3. cache miss → fetch(`/explain/${lineId}.json`)
  //    - 200: validate length === activeLine.moves.length; cache; 'loaded'
  //    - 404: cache 'missing'; emit 'missing'
  //    - other: 'error' (no cache write — allow retry)
  // 4. Abort fetch on lineId change via AbortController.
}
```

Cache key: `lineId`. Cache survives page navigation within the SPA but resets on hard reload. No need for localStorage caching — `public/explain/*.json` is already a static asset with HTTP cache.

### Graceful degrade

- 404 → toggle hidden, drill mode works as today.
- 200 with `blocks.length !== moves.length` → treat as `missing`, log to console. Build-time validation should have caught this; runtime is the last line of defense.
- Network error → toggle disabled with tooltip "Explain content unavailable offline" (rare; static asset is bundled).

### Article 11 / Article 16 compliance

Sidecars are bundled as static assets under `public/`. The nginx:alpine runtime serves them. `docker compose up frontend` works offline.

---

## 4. R3 — `useExplainMode` autoplay loop

### State machine

```
       ┌───────────────────────────── reset / restart ───────────────────────┐
       ▼                                                                     │
  ┌────────┐  enter   ┌──────────────┐  pauseMs   ┌─────────────┐  cleared  ┌───────────────┐
  │  idle  │ ────────►│ showOverlays │ ─────────► │ playingMove │ ────────► │ awaiting_next │
  └────────┘          └──────────────┘            └─────────────┘           └───────────────┘
                          ▲   │                                                     │
                          │   │  next (manual)                                      │
                          │   └─────────────────────────────────────────────────────┘
                          │
                          │  prev                                             ┌───────────┐
                          ├────────────────────────────────────────────────── │ complete  │
                          │                                                   └───────────┘
                          │  (when lineIndex >= line.length after advance, → complete)
                          │
       paused (orthogonal flag) — freezes pauseMs timer in showOverlays
```

### States

```ts
export type ExplainState =
  | { kind: 'idle' }
  | { kind: 'showOverlays'; lineIndex: number; pausedAt: number | null }
  | { kind: 'playingMove'; lineIndex: number }
  | { kind: 'awaiting_next'; lineIndex: number }     // post-move, pre-next-overlay tick
  | { kind: 'complete' };
```

`pausedAt`: timestamp ms remaining if user paused mid-overlay; null if running. On unpause, restart the timer for the remainder.

### Actions

```ts
type ExplainAction =
  | { type: 'ENTER' }              // idle → showOverlays(0)
  | { type: 'PAUSE_MS_ELAPSED' }   // showOverlays → playingMove
  | { type: 'MOVE_PLAYED' }        // playingMove → awaiting_next
  | { type: 'AUTO_ADVANCE' }       // awaiting_next → showOverlays(idx+1) (or complete)
  | { type: 'PAUSE' }              // pause flag on
  | { type: 'RESUME' }             // pause flag off
  | { type: 'NEXT' }               // force advance from any state
  | { type: 'PREV' }               // go back one ply, re-show overlays
  | { type: 'RESTART' }            // → showOverlays(0)
  | { type: 'SKIP' };              // → complete (user clicked Skip to drill)
```

### Timer handling

Single `useRef<number | null>` holding a `setTimeout` id. Helpers `setT(ms, action)` and `clearT()`. Rules:

- Enter `showOverlays`: schedule `PAUSE_MS_ELAPSED` after `block.pauseMs ?? 2500`.
- Enter `playingMove`: synchronous call to `chess.move(san)` + `playMove()`, then dispatch `MOVE_PLAYED` on the next microtask (to let React paint the move).
- Enter `awaiting_next`: schedule `AUTO_ADVANCE` after a short post-move beat (300ms). This gap matters for visual rhythm — overlays gone, move just landed, brief breath, then next overlay.
- `PAUSE`: `clearT()`; if state is `showOverlays`, capture elapsed and store `pausedAt`.
- `RESUME`: schedule remaining time.
- `NEXT` / `PREV` / `RESTART` / `SKIP`: always `clearT()` first, then transition.
- Unmount: `clearT()`.
- TTS cancellation hooks onto the same lifecycle points (see §9).

### Chess.js handling

Reuse one Chess instance owned by the hook (just like `useDrill`). On `PREV`, call `chess.undo()`. On `MOVE_PLAYED`, call `chess.move(san)`. On `RESTART`, `chess.reset()`. On `SKIP`, leave chess at current state — the drill takeover re-mounts and resets.

### Auto-play of both colors

Unlike drill (where one color is "player" and the other "auto"), Explain plays both. Each ply runs the same `showOverlays → playingMove` cycle. The `playerColor` argument is ignored except for board orientation.

### "Skip to drill" semantics

Per resolved Q2: drill starts at ply 0. Implementation: dispatch `SKIP`, parent observes `state.kind === 'complete'` AND `skipped === true`, calls `setMode('drill')`, which re-mounts `<DrillView>` from ply 0 (its normal initial state).

```ts
type UseExplainModeReturn = {
  state: ExplainState;
  fen: string;
  currentBlock: ExplainBlock | null;
  currentPly: number;
  lastMove: { from: string; to: string } | null;
  paused: boolean;
  // controls
  next(): void;
  prev(): void;
  togglePause(): void;
  restart(): void;
  skip(): void;       // → onSkip callback fires; parent flips mode
  // for ExplainRail
  canPrev: boolean;
  canNext: boolean;
};
```

### Progress bar reuse

The same progress bar used by drill (`<ProgressBar current={ply} total={line.length} />`) renders with `current = state.lineIndex`. No new component. R3 AC: "Progress bar visible (same component drill mode uses). No new bar."

### End-of-line summary

When `state.kind === 'complete'` AND not skipped: render `<EndOfLineSummary>` (Phase 1c already shipped this component) with `drillResult = null` (Explain doesn't produce a DrillResult — pass null and the component already handles it as a non-drilled summary). CTA "Drill this line" calls `setMode('drill')`.

---

## 5. R3 — `<ExplainRail>` component + overlay coordination

### `<ExplainRail>` placement

Replaces the "INLINE COACH LINE" + action chips block in the main column when Explain Mode is active. Same column position as the drill action chips, below the board. Sticky on tall scrolls.

```
┌───────────────── ExplainRail ──────────────────┐
│  Ply 4 — White: Bc4                            │
│                                                │
│  Rationale (max 280ch, then "show more"):      │
│    Develops the bishop to its most active...   │
│                                                │
│  Threats:  (collapsible, same truncate rule)   │
│    If ...Nxe4 then Re1 wins material           │
│                                                │
│  [◀ Prev] [⏸ Pause] [▶ Next] [↻ Restart]       │
│                                  [⏩ Skip to drill] │
└────────────────────────────────────────────────┘
```

### Props

```ts
type ExplainRailProps = {
  block: ExplainBlock | null;
  ply: number;
  totalPlies: number;
  paused: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev(): void;
  onNext(): void;
  onTogglePause(): void;
  onRestart(): void;
  onSkip(): void;
};
```

### Soft-truncate (R7)

Encapsulated in a small reusable `<TruncatedText text={...} limit={280} />` primitive, used twice (rationale, threats), with **per-render-instance** ephemeral state — so it resets automatically every time the rail's `ply` prop changes (the component remounts under a new `key={ply}`):

```tsx
function TruncatedText({ text, limit = 280 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= limit) return <span>{text}</span>;
  return (
    <span>
      {expanded ? text : text.slice(0, limit) + '…'}
      <button onClick={() => setExpanded(v => !v)}>
        {expanded ? 'show less' : 'show more'}
      </button>
    </span>
  );
}
```

The "reset to truncated view on ply change" requirement (R7 AC) is enforced by giving `<ExplainRail>` a `key={ply}` from the parent, which remounts `<TruncatedText>` and clears `expanded`. No effect needed.

Character counting: `text.length` — JS string length, code units. Acceptable for the 280-char soft target; emoji edge cases not a concern in chess-rationale text. Article 14 — no `any`, no library needed.

### Overlay coordination (Article 15)

Two overlay components live in `src/ui/board/` (or current equivalent location):

| Component | Owns | Consumed by |
|---|---|---|
| `<HighlightLayer squares={...} />` | Square-tinted overlays + tooltip on hover | Pattern Viz (Phase 1.5), Explain Mode, Coach (Phase 3) |
| `<ArrowLayer arrows={...} />` | SVG arrow overlay between two squares | Explain Mode (primary), Coach (Phase 3) |

`HighlightLayer` is the existing `KeySquareOverlay` evolved — same primitive, additional `intent` styling. `ArrowLayer` is new in this phase.

Both render absolutely-positioned inside `<ChessBoardPanel>`. The board panel exposes a `<board-overlay>` slot that takes children; Explain Mode passes both layers as siblings:

```tsx
<ChessBoardPanel ...>
  <HighlightLayer squares={block?.highlights ?? []} />
  <ArrowLayer arrows={block?.arrows ?? []} />
</ChessBoardPanel>
```

When `state.kind === 'playingMove' | 'awaiting_next' | 'complete'`, both layers receive empty arrays — overlays cleared (per R3 "overlays clear" AC).

ArrowLayer implementation: single `<svg>` overlay sized to the board, one `<line>` (or `<path>` with marker-end) per arrow. Coordinates derived from `react-chessboard`'s known square size + flip state via the existing `getSquarePixel(square, isFlipped, boardSize)` helper used by `KeySquareOverlay`. No new geometry layer.

Size: `<ArrowLayer>` ≈ 1.5 KB gzip (small SVG component, no deps). Well inside the 12 KB budget.

---

## 6. R4 — Authoring pipeline

### `scripts/build_explain.py` architecture

```
                        ┌────────────────────────────────┐
                        │  CLI: --line-id, --opening,    │
                        │  --gold-path, --out-dir        │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  1. Load Line from catalog     │
                        │     (OpeningRepository in py)  │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  2. Build per-ply context:     │
                        │     fen_before, san, fen_after,│
                        │     piece_moved, opening_name  │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  3. Load few-shot examples     │
                        │     from gold sidecar          │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  4. Render prompt (Jinja2)     │
                        │     → call Anthropic SDK       │
                        │       (direct, no LangChain —  │
                        │       Article 3)               │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  5. Parse JSON response into   │
                        │     ExplainSidecar (pydantic)  │
                        └────────────────┬───────────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  6. Write to                   │
                        │     data/explain/pending/      │
                        │       <line_id>.json           │
                        └────────────────────────────────┘
```

### Pending directory layout

```
data/explain/
  italian-game-main.json           # GOLD (hand-authored, committed)
  pending/
    ruy-lopez-closed-main.json     # LLM draft, awaiting human review
    ruy-lopez-marshall.json
  rejected/                         # optional: archive bad drafts
```

`pending/` is committed to repo (PR diff visible). Only files moved out of `pending/` (by `review_explain.py`) reach `data/explain/<id>.json` and from there are copied to `public/explain/` at build time.

### Prompt template (Jinja2)

```
specs/phase-1b-explain-mode/prompts/
  build_explain.j2
```

Structure:

```
System:
You are an opening-theory annotator. Given a chess opening line, produce
per-ply rationale for a beginner audience.

Output strict JSON conforming to:
{ "line_id": str, "schema_version": 2, "blocks": [ExplainBlock, ...] }

ExplainBlock = { rationale, arrows?, highlights?, threats?, pauseMs? }

Constraints:
- One block per ply, in order.
- rationale: 1-3 sentences, beginner-friendly.
- arrows: at most 2 per ply. Use 'green' for the planned move, 'red' for
  threats prevented, 'blue' for piece coordination.
- highlights: at most 3 squares. Mark contested/key squares.
- pauseMs: only set if move warrants extra dwell time (>3000ms).

Few-shot (gold reference: Italian Game main line):
{{ gold_blocks_truncated }}

User:
Opening: {{ opening_name }} ({{ eco }})
Line: {{ line_id }}
Moves (SAN with positions):
{% for ply in plies %}
  {{ ply.index }}. {{ ply.san }}    (FEN after: {{ ply.fen_after }})
{% endfor %}

Produce blocks for this line.
```

### Anthropic SDK call

`uv add anthropic`. Direct API call (Article 3). Caching headers — use prompt caching on the gold few-shot block (Anthropic supports `cache_control: { type: "ephemeral" }`). Reduces token spend when batch-running across 14 Tier-2 lines.

### `scripts/review_explain.py` CLI flow

Text-only TUI (no board render). Board ASCII rendering via `python-chess`'s `chess.Board.unicode()` for orientation. Keeps the CLI dependency-free beyond what's already in `pyproject.toml`.

```
$ uv run python scripts/review_explain.py --line ruy-lopez-closed-main

Line: ruy-lopez-closed-main  (12 ply)
─── Ply 0/12 — White: e4 ─────────────────────────

  8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜
  7 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟
  6 . . . . . . . .
  5 . . . . . . . .
  4 . . . . ♙ . . .
  3 . . . . . . . .
  2 ♙ ♙ ♙ ♙ . ♙ ♙ ♙
  1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖
    a b c d e f g h

  Rationale:
    King's pawn opens lines for the bishop and queen, contests the center.
  Arrows: e2→e4 (green)
  Highlights: d5 (focus)
  Threats: (none)
  Pause: default

  [a]ccept  [e]dit  [r]eject  [s]kip-to-next  [q]uit-save
> a

─── Ply 1/12 — Black: e5 ─────────────────────────
...
```

- `[a]ccept` → keep block as-is
- `[e]dit` → open `$EDITOR` on a temp JSON snippet, re-validate
- `[r]eject` → mark block as null; will fail validation, prompting either regeneration or hand-fill
- `[s]kip` → leave block unchanged; useful when planning to revisit
- `[q]uit-save` → persist accepted/edited blocks to `data/explain/<line_id>.json` (only if all blocks accepted) or back to `pending/` (if any incomplete)

When all blocks pass, prompts: "Move to data/explain/ and run validator? [y/n]". On yes:

1. Write `data/explain/<line_id>.json`
2. Run `python -m scripts.tabiya_build.validate_explain <line_id>` synchronously
3. Delete `pending/<line_id>.json`
4. Print copy-to-public instructions: `python scripts/build_explain.py --copy-to-public`

### Build integration

`scripts/build_catalog.py` gets a new optional step at the end:

```python
def main():
    catalog = build_catalog()
    write_catalog(catalog)
    # NEW Phase 1b:
    validate_all_explain_sidecars()      # over data/explain/*.json
    copy_explain_to_public()              # data/explain/*.json → public/explain/
```

Authoring scripts NEVER ship in the bundle — they live under `scripts/` (Article 16: per-service Dockerfiles; frontend Dockerfile is `node:20-alpine` + `nginx:alpine` runtime, no Python at runtime).

---

## 7. R6 — TTS feature flag wiring

### Storage keys

| Key | Type | Default | Purpose |
|---|---|---|---|
| `tabiya:flag:explainTts` | `"true" \| "false"` | `"false"` | Global enable for TTS |
| `tabiya:linePrefs:<lineId>:ttsMute` | `"true" \| "false"` | `"false"` | Per-line opt-out (only checked when global flag is on) |

### Hook: `useExplainTts`

```ts
// src/hooks/useExplainTts.ts
type UseExplainTtsArgs = {
  lineId: string | null;
  paused: boolean;
};

type UseExplainTtsReturn = {
  speak(text: string): void;
  cancel(): void;
  available: boolean;       // window.speechSynthesis defined
  enabled: boolean;         // global flag on AND not muted for line
  toggleLineMute(): void;
};
```

Internals:

```ts
function speak(text: string) {
  if (!available || !enabled || paused) return;
  if (text.length === 0) return;
  cancel();                          // always cancel any in-flight utterance first
  const u = new SpeechSynthesisUtterance(text);
  // R6: voice/rate/pitch defaults only; tuning deferred to 1b.3
  utteranceRef.current = u;
  window.speechSynthesis.speak(u);
}

function cancel() {
  if (!available) return;
  window.speechSynthesis.cancel();
  utteranceRef.current = null;
}
```

### Wiring into `useExplainMode`

A small effect in `useExplainMode` (or in `<ExplainView>` consuming both hooks):

```ts
useEffect(() => {
  if (state.kind !== 'showOverlays') return;
  const block = blocks[state.lineIndex];
  if (!block) return;
  tts.speak(block.rationale);          // R6: only the rationale, not threats
}, [state.kind, state.lineIndex, blocks, tts]);

// Cancel on advance/pause/prev/skip — all of these change state.kind or
// state.lineIndex, which the above effect's cleanup handles via the next-run
// flow. But for explicit PAUSE we also cancel:
useEffect(() => {
  if (paused) tts.cancel();
}, [paused, tts]);

// Cancel on unmount:
useEffect(() => () => tts.cancel(), [tts]);
```

`SpeechSynthesisUtterance` lifecycle:

- `speak()` queues an utterance. Calling `cancel()` aborts any in-progress speech and clears the queue.
- Per R6 AC: Pause, Next, Prev all cancel. Implementation: every state transition's `clearT()` call is paired with `tts.cancel()`. The cleanest insertion is at the dispatch site, not deep in the reducer (reducer should stay pure).

### Settings UI placement

`src/pages/SettingsPage.tsx` — new section "Explain Mode" with:

```
Explain Mode
─────────────
  ☐ Speak rationale aloud (browser TTS)
     Uses your browser's built-in voice. No network.
     [Disabled if speechSynthesis unavailable]
```

A single checkbox bound to `tabiya:flag:explainTts`. Description text notes Article 11 compliance (no network).

Per-line mute UI: in `<ExplainRail>`, a small speaker icon next to the rationale (only rendered when global flag is on). Toggles `tabiya:linePrefs:<lineId>:ttsMute`. Icon state:

- 🔊 = TTS will speak on next ply (global on, line not muted)
- 🔇 = TTS muted for this line

### Graceful no-op

```ts
const available = typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined';
```

If `available === false`: global Settings checkbox renders disabled with caption "Your browser does not support speech synthesis". `useExplainTts.speak()` is a no-op.

### No TTS on Skip / Summary

`onSkip` calls `tts.cancel()` before transitioning. `EndOfLineSummary` does not consume `useExplainTts` at all — it never speaks.

---

## 8. R5 — Test plan and file layout

### Test files

```
tests/explain/
  useExplainMode.test.ts        # state machine — ≥10 cases (R5 AC)
  useExplainContent.test.ts     # fetch + cache + 404 fallback
  useExplainTts.test.ts         # speak/cancel/availability fallback
  ExplainRail.test.tsx          # render + truncate + controls fire
  TruncatedText.test.tsx        # boundary cases (exact 280, 281, multi-toggle)
  ModeToggle.test.tsx           # visibility, persistence, mode switch resets ply
  ArrowLayer.test.tsx           # arrow rendering, board-flip geometry

scripts/tests/
  test_validate_explain.py      # schema validator, length-mismatch fails
  test_build_explain.py         # prompt rendering, JSON parse round-trip
```

### `useExplainMode` cases (≥10 per R5)

1. Initial state on mount with non-empty line → `showOverlays(0)`.
2. `PAUSE_MS_ELAPSED` from `showOverlays(0)` → `playingMove(0)`.
3. `MOVE_PLAYED` → `awaiting_next(0)`.
4. `AUTO_ADVANCE` from `awaiting_next(last)` → `complete`.
5. `NEXT` from `showOverlays(2)` skips immediately to `awaiting_next(2)`.
6. `PREV` from `showOverlays(3)` undoes chess + returns to `showOverlays(2)`.
7. `PAUSE` then `RESUME` from `showOverlays` preserves remaining timer (within tolerance).
8. `RESTART` from any state → `showOverlays(0)`, chess reset, line.length unchanged.
9. `SKIP` from `showOverlays(4)` → `complete` with `skipped: true` flag.
10. Per-ply `pauseMs` override is used in place of default 2500.
11. Unmount during `showOverlays` clears timer (no leaked dispatch).
12. Empty `blocks` array (length 0) → immediately `complete` on `ENTER`.

### Schema validator tests (Python)

1. Valid sidecar passes.
2. Mismatched `len(blocks) != len(moves)` fails with a clear error message.
3. Bad square (`"e9"`) in arrow fails.
4. Missing `rationale` fails.
5. `pause_ms` out of bounds (`< 500` or `> 20000`) fails.
6. `schema_version` mismatch fails.

### Wife re-test gate

Manual, not automated. Pass/fail recorded in `specs/phase-1b-explain-mode/wife-retest.md` (skeleton text file, like Phase 1c R8 intake doc).

### Build size budget enforcement

Add to `package.json`:

```json
"scripts": {
  "build:size": "vite build && node scripts/check-explain-size.js"
}
```

The check script diffs bundle size before/after the explain components are imported (using a dummy entry point), asserts delta ≤ 12 KB gzip. Soft gate (warns in CI, blocks if exceeded by >20%).

### Existing regression coverage

R5 AC: "Existing 94 tests still pass." Standard CI run; no new requirement, just a gate.

---

## 9. Build size analysis (+12 kB gzip budget)

Component-by-component estimate (gzip-compressed JS, post-tree-shake):

| Component | Estimated size |
|---|---|
| `useExplainMode.ts` (state machine, timers) | ~2.5 KB |
| `useExplainContent.ts` (fetcher + cache) | ~0.8 KB |
| `useExplainTts.ts` (Web Speech wrapper) | ~0.6 KB |
| `useLinePrefMode.ts` (localStorage hook) | ~0.3 KB |
| `<ExplainView>` (composition) | ~1.2 KB |
| `<ExplainRail>` (rail + buttons) | ~1.8 KB |
| `<TruncatedText>` (R7) | ~0.4 KB |
| `<ArrowLayer>` (new SVG primitive) | ~1.5 KB |
| `<ModeToggle>` (segmented control) | ~0.8 KB |
| Schema type expansion (compile-time only) | 0 KB |
| Settings page TTS section | ~0.5 KB |
| **Subtotal** | **~10.4 KB** |
| Margin for icons/strings | ~1.6 KB |
| **Total** | **~12 KB (at budget)** |

`HighlightLayer` is reused from Phase 1.5 (existing `KeySquareOverlay` scaffold) — does not count. Sidecar JSON files are static assets, not bundled JS.

If over budget at build time: first lever is to inline `<ModeToggle>` as plain CSS+span rather than a separate component (~-0.5 KB), then drop the segmented-control hover animations.

---

## 10. Constitution compliance

- **Article 1** (OSS only): No new runtime deps. Dev/build deps (`anthropic` Python SDK, `jinja2` if not already present) are MIT/Apache-2. Declared in `tech.md` update.
- **Article 3** (no heavy AI orchestration): `scripts/build_explain.py` calls Anthropic SDK directly. No LangChain.
- **Article 5** (repository pattern): Sidecar fetch is encapsulated in `useExplainContent`; `OpeningRepository` interface remains untouched. Future migration (e.g., serve sidecars from backend in Phase 3) is a one-hook swap.
- **Article 6** (stable IDs): Sidecars keyed on `line_id`. Catalog refresh that removes a line orphans its sidecar, harmless.
- **Article 7** (linear lines): Explain walks `line.moves` linearly. No branch narration.
- **Article 11** (local-first): TTS uses Web Speech API (browser-native, no network). Sidecars are static assets bundled with the app.
- **Article 13** (weekend pace): 3 weekend days, with a documented cut-line (drop batch script, ship gold only) if overrun.
- **Article 14** (type discipline): TS strict, no `any`. Python type hints on all public functions.
- **Article 15** (single highlight primitive): `<HighlightLayer>` is the Phase 1.5 primitive reused. `<ArrowLayer>` is a sibling, not a fork.
- **Article 16** (containerized): Sidecars are static assets served by `nginx:alpine`. Authoring scripts are Python, not in the runtime image. `docker compose up frontend` continues to work offline.

---

## 11. Files touched (final list)

### New

```
src/hooks/useExplainContent.ts
src/hooks/useExplainMode.ts
src/hooks/useExplainTts.ts
src/hooks/useLinePrefMode.ts
src/ui/ModeToggle.tsx
src/ui/explain/ExplainView.tsx
src/ui/explain/ExplainRail.tsx
src/ui/explain/TruncatedText.tsx
src/ui/board/ArrowLayer.tsx
src/ui/board/HighlightLayer.tsx          # if not already shipped by Phase 1.5; otherwise reused
scripts/build_explain.py
scripts/review_explain.py
scripts/tabiya_build/validate_explain.py
scripts/check-explain-size.js
specs/phase-1b-explain-mode/authoring.md
specs/phase-1b-explain-mode/prompts/build_explain.j2
specs/phase-1b-explain-mode/wife-retest.md
data/explain/italian-game-main.json      # gold reference
tests/explain/*.test.ts(x)
scripts/tests/test_validate_explain.py
scripts/tests/test_build_explain.py
```

### Modified

```
src/pages/DrillPage.tsx                  # header toggle, mode router
src/pages/SettingsPage.tsx               # Explain Mode section (TTS toggle)
src/storage/types.ts                     # ExplainBlock, Arrow, HighlightSquare, Line.explain?, Catalog.schema_version
src/storage/JsonOpeningRepository.ts     # no shape change; passthrough of new optional field
scripts/tabiya_build/schema.py           # pydantic mirrors
scripts/build_catalog.py                 # validate + copy explain step
tech.md                                  # add anthropic + jinja2 (if new) to Python table
public/explain/                          # build output dir (gitignored)
```

### Out of bundle

```
data/explain/pending/                    # LLM drafts pre-review
data/explain/rejected/                   # optional archive
```
