# Design: Phase 2 — Pattern Visualization

## Overview

Phase 2 splits cleanly along an offline/online seam: **2a** is a Python content pipeline (scrape → extract → review → curate → catalog build), **2b** is browser UI built on top of the shipped catalog artifact. The 2a → 2b gate (≥30 reviewed openings, R9.1) means the two halves can ship in serial; 2a does not block on 2b and vice versa.

The single load-bearing cross-phase coordination point is the highlight primitive (Constitution Article 15). Phase 1b Explain Mode and Phase 2b Pattern Viz share one `<HighlightLayer>` component. Whichever phase merges first ships the primitive; the second consumes it. This design specifies the primitive's API so either ordering works.

Five clean seams:
1. **Scrape adapter seam** — one adapter class per source, dispatched by `sources.yml`. Adding a source = one new file + one whitelist entry.
2. **Extraction seam** — Anthropic SDK call wrapped in a single `extract_for_opening(record)` function. No framework (Article 3).
3. **Review CLI seam** — `pending/` is the queue, `curated/key_squares.yml` is the only output downstream consumers see (Article 11).
4. **Catalog build seam** — `build_catalog.py` joins curated data by `opening_slug` (Article 6) and emits a transposition sidecar.
5. **Highlight primitive seam** — `<HighlightLayer>` (shared with Phase 1b) renders both `arrows + highlights` (Explain) and `spotlight masks` (Pattern Viz) under one API.

---

# Phase 2a — Content acquisition pipeline

## 2a.1 Scrape pipeline architecture

### Module layout

```
scripts/key_squares/
├── __init__.py
├── scrape.py                 # entrypoint, dispatches to adapters
├── extract.py                # LLM extraction (2a.3)
├── review.py                 # manual review CLI (2a.5)
├── sources.yml               # whitelist + license register
├── adapters/
│   ├── __init__.py
│   ├── base.py               # SourceAdapter Protocol
│   ├── wikipedia.py          # WikipediaAdapter (CC BY-SA 4.0)
│   └── lichess_explorer.py   # LichessExplorerAdapter (open data, ODbL)
├── prompts/
│   └── few_shot.yml          # hand-authored exemplars
└── lib/
    ├── robots.py             # robots.txt cache + check
    ├── ratelimit.py          # token-bucket per host, ≤1 req/sec
    └── opening_keys.py       # opening_slug → canonical FEN lookup
```

### Adapter Protocol

```python
# scripts/key_squares/adapters/base.py
from typing import Protocol
from pydantic import BaseModel, HttpUrl

class ProseChunk(BaseModel):
    source_url: HttpUrl
    license: str            # SPDX-style: "CC-BY-SA-4.0", "ODbL-1.0", "CC0-1.0"
    text: str               # plain text, stripped of markup

class SourceAdapter(Protocol):
    name: str               # matches sources.yml entry id
    license: str            # SPDX
    base_url: str

    def discover(self, opening_slug: str, opening_name: str) -> list[str]:
        """Return list of candidate URLs for this opening on this source."""
        ...

    def fetch(self, url: str) -> ProseChunk | None:
        """Fetch + extract prose. None if 404 / disallowed / non-permissive."""
        ...
```

Each adapter is pure: takes opening identity, returns prose chunks. Robots check + rate limit live in `lib/` and are applied by the scrape driver, not the adapter, so a misbehaving adapter cannot bypass them.

### `sources.yml` schema

```yaml
sources:
  - id: wikipedia-en
    license: CC-BY-SA-4.0
    base_url: https://en.wikipedia.org
    adapter: wikipedia
    url_pattern: /wiki/{opening_name_url}
    selector: "#mw-content-text .mw-parser-output > p"
    rate_limit_rps: 1

  - id: lichess-opening-explorer
    license: ODbL-1.0
    base_url: https://explorer.lichess.ovh
    adapter: lichess_explorer
    url_pattern: /masters?fen={fen_after_main_line}
    rate_limit_rps: 1
```

Each `id` is referenced by every `source_url` that lands in `curated/key_squares.yml`, enabling the build-time license audit (R9.2).

### Scrape driver flow

```
scrape.py main(openings: list[Opening], force: bool = False):
  for opening in openings:
    if not force and scraped_exists(opening.slug):
      log skip
      continue
    chunks: list[ProseChunk] = []
    for source in load_sources_yml():
      adapter = load_adapter(source.adapter)
      candidate_urls = adapter.discover(opening.slug, opening.name)
      for url in candidate_urls:
        if not robots_allows(url):
          log "robots disallow"; continue
        ratelimit.wait(host_of(url))
        chunk = adapter.fetch(url)
        if chunk and chunk.license in PERMISSIVE_SPDX:
          chunks.append(chunk)
        else:
          log "non-permissive or empty"
    write_json(f"data/key_squares/scraped/{opening.slug}.json", {
      opening_slug, opening_name, fen_after_main_line, prose_chunks: chunks
    })
```

`PERMISSIVE_SPDX = {"CC-BY-SA-4.0", "CC-BY-4.0", "CC0-1.0", "ODbL-1.0", "MIT", "Apache-2.0", "BSD-3-Clause", "PD-Public-Domain"}` — hardcoded allowlist of acceptable SPDX strings (Article 1). Anything else → skip + log, never abort the batch (R1.5).

### Idempotency (R1.6)

`scraped/<slug>.json` is overwritten on re-run. Adapters MUST be deterministic on URL → chunk (or treat 5xx as skip+retry-next-run, not failure). Stable diff lets the maintainer re-scrape one opening without disturbing the others.

### Scraped record schema (R1.4)

```json
{
  "opening_slug": "ruy-lopez-closed-main",
  "opening_name": "Ruy López, Closed Variation",
  "fen_after_main_line": "r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1 w - - 0 9",
  "prose_chunks": [
    {
      "source_url": "https://en.wikipedia.org/wiki/Ruy_Lopez",
      "license": "CC-BY-SA-4.0",
      "text": "..."
    }
  ]
}
```

## 2a.2 Normalization

Pre-LLM normalization done inline in the scrape step:
- Strip HTML / wiki markup (Wikipedia adapter uses `mwparserfromhell` or BeautifulSoup; Lichess adapter consumes JSON directly).
- Collapse whitespace, drop figure captions and table cells (heuristic: chunks <40 chars dropped).
- Truncate per-chunk to 4000 chars (keeps LLM input bounded; long chess-history sections rarely contain key-square claims).
- Concatenated chunks per opening are capped at 12000 chars total for the extractor prompt (oldest-first wins; usually 1-2 chunks per opening).

No multi-source merging or dedup — extractor sees all chunks and is prompted to ignore duplicates (cheaper than de-dup logic that risks dropping nuance).

## 2a.3 LLM extraction

### Module: `scripts/key_squares/extract.py`

```python
# Article 3: Anthropic SDK direct, no LangChain.
from anthropic import Anthropic
import yaml, json, time
from pydantic import BaseModel, Field, ValidationError
from typing import Literal

class KeySquareDraft(BaseModel):
    square: str = Field(pattern=r"^[a-h][1-8]$")
    role: Literal["outpost", "weak", "tension", "control"]
    for_color: Literal["white", "black"]
    rationale: str = Field(max_length=280)
    source_url: str

class ExtractionResult(BaseModel):
    drafts: list[KeySquareDraft]

def extract_for_opening(record: dict, client: Anthropic) -> list[KeySquareDraft]:
    prompt = build_prompt(record)
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-7",   # current stable per tech.md addendum
                max_tokens=2000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            payload = parse_json_from_text(resp.content[0].text)
            result = ExtractionResult.model_validate(payload)
            return result.drafts
        except (anthropic.RateLimitError, anthropic.APIStatusError) as e:
            time.sleep(2 ** attempt)  # exponential backoff: 1, 2, 4 s
        except (json.JSONDecodeError, ValidationError) as e:
            log.warning(f"{record['opening_slug']}: drop draft, {e}")
            return []
    return []
```

### Prompt template structure

`SYSTEM_PROMPT` (static): role definition + JSON-only output contract + role taxonomy reference.

User prompt assembled by `build_prompt(record)`:
```
Opening: {opening_name} ({opening_slug})
Canonical FEN: {fen_after_main_line}

Source material:
---
{prose_chunks concatenated, each prefixed with [Source: <url>]}
---

Few-shot examples:
{N exemplars from prompts/few_shot.yml}

Task: identify 0-6 key squares for the position after the main line. For each:
- square (algebraic, e.g. d5)
- role: outpost | weak | tension | control
- for_color: white | black
- rationale: ≤280 chars, grounded in source material
- source_url: cite the [Source: …] line your rationale relies on

Output a single JSON object {"drafts": [...]}. No prose outside the JSON.
```

### Few-shot exemplar schema (`prompts/few_shot.yml`)

```yaml
exemplars:
  - opening_slug: italian-game-main
    opening_name: "Italian Game, Main Line"
    fen_canonical: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
    prose: "The bishop on c4 targets f7..."
    output:
      - square: f7
        role: weak
        for_color: black
        rationale: "f7 is defended only by the king; Bc4 + Ng5 ideas hit this square in the Fried Liver line."
        source_url: "https://en.wikipedia.org/wiki/Italian_Game"
      - square: d5
        role: control
        for_color: white
        rationale: "Central pawn break d2-d4 or pawn-push d5 contests Black's e5 and opens the c4 bishop."
        source_url: "https://en.wikipedia.org/wiki/Italian_Game"
  # ... 4 more hand-authored exemplars (5 total per open-question lean R9 open Q2)
```

Pydantic validates each `output` entry on load; bad exemplars fail tests before reaching production prompts.

### Validation + drop (R2.5, R2.6)

After SDK returns, each draft is run through `KeySquareDraft.model_validate`. Failures are logged with opening_slug + reason and dropped. The output file (`pending/<slug>.yml`) is the validated subset only — invalid drafts never surface for human review.

### Pending file (R2.7) — `data/key_squares/pending/<opening_slug>.yml`

```yaml
opening_slug: ruy-lopez-closed-main
opening_name: "Ruy López, Closed Variation"
fen_canonical: "r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1 w - - 0 9"
extracted_at: "2026-05-18T14:32:11Z"
drafts:
  - square: d5
    role: control
    for_color: white
    rationale: "Central square White's bishop on b3 + knight on f3 jointly pressure; key for c2-c3, d3-d4 break."
    source_url: "https://en.wikipedia.org/wiki/Ruy_Lopez"
  - square: c4
    role: outpost
    for_color: white
    rationale: "Knight maneuver Nb1-d2-f1-g3 or Nb1-d2-f1-e3 reroutes to d5 outpost via c4 support."
    source_url: "https://en.wikipedia.org/wiki/Ruy_Lopez"
```

Re-running extraction overwrites (R2.8) — pending is regenerable until human approves.

## 2a.4 Review CLI

### Module: `scripts/key_squares/review.py`

Renders board via `python-chess`'s built-in unicode renderer, augmented with ANSI background colors per role.

### Rendering approach (R3.3)

```python
import chess
def render_with_highlights(board: chess.Board, drafts: list[KeySquareDraft]) -> str:
    """
    Unicode board with drafts overlaid:
      - background color by role (green/blue/amber/red)
      - bold + underline on the highlighted file/rank in coordinate row
    """
    # chess.Board.unicode() output is augmented per-cell using ANSI 256-color codes.
    # Falls back to plain ASCII (with brackets around marked squares) if TERM doesn't support color.
```

ANSI was picked over a web-preview server because (a) zero new deps, (b) reviewer stays in terminal — review is high-throughput, target ~1 minute per opening. Web preview would be 50+ kB of incidental React for a maintenance-only flow.

### Review loop (R3.4)

```
review.py main():
  pending_files = glob("data/key_squares/pending/*.yml")
  state = load_state(".review_state.json")  # for resumability
  for f in pending_files:
    if f in state.completed: continue
    record = yaml.safe_load(f)
    board = chess.Board(record.fen_canonical)
    decisions: list[Decision] = state.partial.get(f, [])
    for i, draft in enumerate(record.drafts):
      if i < len(decisions): continue  # resume from where we left off
      print(render_with_highlights(board, record.drafts))
      print(f"  Draft {i+1}/{len(record.drafts)}: {draft.square} {draft.role}")
      print(f"    {draft.rationale}")
      print(f"    source: {draft.source_url}")
      action = prompt("[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit: ")
      match action:
        case 'a': decisions.append(Accept(draft))
        case 'e': decisions.append(Accept(edit_inline(draft)))
        case 'r': decisions.append(Reject(draft, prompt("note: ")))
        case 's': decisions.append(Skip(draft))
        case 'q': save_state(state); return
      save_state(state)
    commit_decisions(record, decisions)
    state.completed.add(f)
```

### `edit_inline(draft)` flow

Interactive prompts for each field. Default = current value (enter accepts). Validates input against the same Pydantic model — invalid edit re-prompts.

### Commit step (R3.6, R3.7)

- Accepts → append to `scripts/curated/key_squares.yml` under the opening slug (creates entry if absent).
- Rejects → append to `data/key_squares/rejected/<opening_slug>.yml` (git-tracked per requirements; prompt-tuning corpus).
- Skips → leave in pending (no destructive action).

Curated YAML is the **only** artifact downstream code reads (R3.9). Build script never touches `scraped/`, `pending/`, or `rejected/`.

### Resumability (R3.8) — `.review_state.json`

```json
{
  "completed": ["data/key_squares/pending/ruy-lopez-closed-main.yml"],
  "partial": {
    "data/key_squares/pending/italian-game-main.yml": [
      {"kind": "accept", "draft_index": 0},
      {"kind": "reject", "draft_index": 1, "note": "hallucinated square"}
    ]
  }
}
```

Quit + restart resumes mid-opening.

## 2a.5 Curated schema + catalog build integration

### `scripts/curated/key_squares.yml` (R4.1)

```yaml
ruy-lopez-closed-main:
  fen_canonical: "r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1 w - - 0 9"
  squares:
    - square: d5
      role: control
      for_color: white
      rationale: "Central square White's b3 bishop + f3 knight jointly pressure; key for d3-d4 break."
      source_url: "https://en.wikipedia.org/wiki/Ruy_Lopez"
    - square: c4
      role: outpost
      for_color: white
      rationale: "Knight reroute Nb1-d2-f1-g3 lands on f5 or d5 outpost via c4 support."
      source_url: "https://en.wikipedia.org/wiki/Ruy_Lopez"

italian-game-main:
  fen_canonical: "..."
  squares: [...]
```

### Build script changes (`scripts/build_catalog.py`)

Add a new module `scripts/tabiya_build/key_squares.py`:

```python
# scripts/tabiya_build/key_squares.py
import yaml
from pydantic import BaseModel, ValidationError
from .types import Opening   # existing

class KeySquareRecord(BaseModel):
    square: str
    role: Literal["outpost", "weak", "tension", "control"]
    for_color: Literal["white", "black"]
    rationale: str
    source_url: str

class OpeningKeySquares(BaseModel):
    fen_canonical: str
    squares: list[KeySquareRecord]

def load_curated_key_squares(path: Path) -> dict[str, OpeningKeySquares]:
    raw = yaml.safe_load(path.read_text())
    return {slug: OpeningKeySquares.model_validate(v) for slug, v in raw.items()}

def license_audit(curated: dict[str, OpeningKeySquares], sources_yml: Path) -> None:
    """Article 1: every source_url's host must trace to a permissive entry in sources.yml."""
    permissive_hosts = load_permissive_hosts(sources_yml)
    for slug, rec in curated.items():
        for sq in rec.squares:
            host = urlparse(sq.source_url).host
            if host not in permissive_hosts:
                raise BuildError(f"{slug}: unaudited host {host} in source_url")

def join_to_openings(openings: list[Opening], curated: dict[str, OpeningKeySquares]) -> None:
    """Article 6: join by stable opening_slug. Unknown slugs fail the build."""
    known_slugs = {o.slug for o in openings}
    for slug in curated:
        if slug not in known_slugs:
            raise BuildError(f"key_squares.yml references unknown opening_slug {slug}")
    by_slug = {o.slug: o for o in openings}
    for slug, rec in curated.items():
        by_slug[slug].key_squares = rec.squares  # additive (R4.4)
```

`build_catalog.py` calls in order:
1. Load openings/families/lines/variations as today.
2. `key_squares = load_curated_key_squares(...)` — schema validation here (R4.2).
3. `license_audit(...)` (R9.2).
4. `join_to_openings(...)` (R4.3).
5. `build_transposition_index(lines)` (next section).
6. Bump `catalog.schema_version` (R4.5).
7. Emit `public/catalog.json` + sidecar (next section).

Openings with no curated entry simply lack `key_squares` (R4.6, R6.6).

## 2a.6 Transposition index build

### Algorithm

```python
# scripts/tabiya_build/transposition.py
import hashlib, chess
from collections import defaultdict

def normalize_fen(fen: str) -> str:
    """R5.2: keep castling + ep target, strip halfmove + fullmove counters."""
    parts = fen.split()
    # piece-placement, side, castling, ep_target — drop counters [4] and [5]
    return " ".join(parts[:4])

def fen_hash(fen: str) -> str:
    return hashlib.sha1(normalize_fen(fen).encode()).hexdigest()[:16]

def build_transposition_index(lines: list[Line]) -> dict[str, list[str]]:
    index: dict[str, set[str]] = defaultdict(set)
    for line in lines:
        board = chess.Board()
        for san in line.moves:
            board.push_san(san)
            h = fen_hash(board.fen())
            index[h].add(line.id)
    # R5.6: drop singletons
    return {
        h: sorted(line_ids)   # R5.5 determinism via sort
        for h, line_ids in index.items()
        if len(line_ids) >= 2
    }
```

### Storage decision: sidecar JSON

Inlined in `catalog.json` was considered; rejected because the index can grow to 20-50 kB and triples the size of the catalog payload on lines.yml extensions. Sidecar lets the frontend lazy-load on first transposition query.

**Path:** `public/transpositions.json`

**Schema:**
```json
{
  "schema_version": 2,
  "generated_at": "2026-05-19T10:00:00Z",
  "fen_hash_algo": "sha1-16",
  "fen_normalization": "drop-counters",
  "index": {
    "a1b2c3d4e5f60011": ["italian-game-main", "ruy-lopez-closed-main"],
    "1234abcd5678ef01": ["queens-gambit-main", "slav-main"]
  }
}
```

Same `schema_version` field as catalog so the frontend can refuse a mismatched pair.

### Determinism (R5.5)

- `dict` iteration in Python 3.7+ is insertion-ordered → iterate `sorted(index.items())` on write.
- `line_ids` per entry sorted (already done in builder).
- `generated_at` excluded from byte-equality test (test reads file, drops that field, byte-compares the rest).

---

# Phase 2b — UI integration

## 2b.1 Highlight primitive coordination (Article 15)

**The contract:** `<HighlightLayer>` is one component, shipped once, consumed by both Explain Mode (1b) and Pattern Viz (2b). Whichever phase ships first ships the primitive; the second imports.

### `HighlightLayer` API

```ts
// src/components/board/HighlightLayer.tsx
type Square = `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${1|2|3|4|5|6|7|8}`;

type HighlightMode =
  | { kind: 'bright'; squares: BrightHighlight[] }       // Phase 1b Explain
  | { kind: 'spotlight'; squares: SpotlightHighlight[] } // Phase 2b Pattern Viz
  | { kind: 'none' };

type BrightHighlight = {
  square: Square;
  color: 'green' | 'red' | 'blue' | 'amber';
  tooltip?: string;
};

type SpotlightHighlight = {
  square: Square;
  role: 'outpost' | 'control' | 'tension' | 'weak';  // determines glow color
  tooltip?: string;        // rendered on hover (R6.4)
  forColor?: 'white' | 'black';   // shown in tooltip
};

type Props = {
  mode: HighlightMode;
  boardOrientation: 'white' | 'black';
  squarePx: number;        // board square size in CSS pixels
};
```

One component, two render strategies dispatched by `mode.kind`:

- `bright` → renders per-square colored translucent `<rect>` elements directly on the SVG layer. This is what Phase 1b needs.
- `spotlight` → renders one full-board dim `<rect>` with `<mask>` cutouts at each `square`, plus a per-cutout glow `<filter>` colored by `role`. This is the Pattern Viz visual (dark board, bright spotlit squares per the chessViz reference image).
- `none` → returns null. Required for graceful degrade when no data (R6.6).

Tooltip primitive is one shared `<HighlightTooltip>` subcomponent, used by both modes (Article 15 — the *tooltip* primitive is shared too).

### Why one component, not two

If Phase 1b ships `<HighlightLayer>` first with only the `bright` branch, Phase 2b extends with `spotlight` via discriminated union. Adding a branch is additive — Phase 1b consumers stay on `bright` and never see the new code path. If Phase 2b ships first the inverse holds. Either ordering yields a single file.

### `<ArrowLayer>` separation

Arrows (Phase 1b R3, explain mode) are a *separate* SVG sibling component `<ArrowLayer>`. Article 15 covers "square-highlight + tooltip"; arrows live alongside, not inside, the highlight primitive. Phase 1b and 2b agree on this boundary.

## 2b.2 `<SpotlightOverlay>` component (R6)

### Module: `src/components/board/SpotlightOverlay.tsx`

Thin adapter over `<HighlightLayer mode={{kind:'spotlight',...}}>`. Its job: take the active opening's `key_squares` and map to the primitive's `SpotlightHighlight[]`.

```tsx
type Props = {
  keySquares: KeySquareRecord[] | undefined;
  boardOrientation: 'white' | 'black';
  squarePx: number;
};

export function SpotlightOverlay({ keySquares, boardOrientation, squarePx }: Props) {
  // R6.6: graceful degrade
  if (!keySquares || keySquares.length === 0) return null;

  const highlights: SpotlightHighlight[] = keySquares.map(k => ({
    square: k.square as Square,
    role: k.role,
    tooltip: k.rationale,
    forColor: k.for_color,
  }));

  return (
    <HighlightLayer
      mode={{ kind: 'spotlight', squares: highlights }}
      boardOrientation={boardOrientation}
      squarePx={squarePx}
    />
  );
}
```

### SVG strategy (R6.1, R6.2, R6.3)

Inside `<HighlightLayer>` on `mode.kind === 'spotlight'`:

```tsx
<svg pointerEvents="none" /* R6.5 non-blocking */>
  <defs>
    <mask id="spotlight-mask">
      <rect fill="white" /* show dim by default */ width="100%" height="100%" />
      {highlights.map(h => (
        <rect
          key={h.square}
          x={...} y={...} width={squarePx} height={squarePx}
          fill="black"  /* black in mask = cut out, fully transparent */
          rx={squarePx * 0.18}  /* rounded corners */
        />
      ))}
    </mask>
    {/* per-role glow filters */}
    <filter id="glow-outpost" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation={squarePx * 0.18} />
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    {/* glow-control, glow-tension, glow-weak similar */}
  </defs>

  {/* dim layer with cutouts */}
  <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.62)" mask="url(#spotlight-mask)" />

  {/* glow ring per cutout */}
  {highlights.map(h => (
    <rect
      key={h.square}
      x={...} y={...} width={squarePx} height={squarePx}
      fill="none"
      stroke={ROLE_COLOR[h.role]}
      strokeWidth={2}
      filter={`url(#glow-${h.role})`}
      pointerEvents="auto"  /* tooltip needs hover */
      onMouseEnter={() => setHovered(h)}
      onMouseLeave={() => setHovered(null)}
    />
  ))}

  {hovered && <HighlightTooltip square={hovered.square} text={hovered.tooltip} />}
</svg>
```

`ROLE_COLOR = { outpost: '#22c55e', control: '#3b82f6', tension: '#f59e0b', weak: '#ef4444' }` — Tailwind green-500 / blue-500 / amber-500 / red-500 (palette already in `theme/`).

**Click fall-through (R6.5):** outer `<svg>` has `pointerEvents="none"`. Individual glow `<rect>`s opt in with `pointerEvents="auto"` for the hover tooltip — but `onClick` is *not* bound, so clicks still propagate to the board below. Verified in `tests/components/SpotlightOverlay.test.tsx`.

**Build-size budget (R6.8):** static color map + role enum + filter defs ≈ 1.5 kB minified. Mask logic adds ~3 kB. Total estimated 4-5 kB gzip, within 6 kB cap.

## 2b.3 Visibility rules + drill-mode toggle (R7)

### Hook: `src/hooks/useKeySquareOverlay.ts`

```ts
type ExplainModeState = 'off' | 'running';  // from Phase 1b useExplainMode

export function useKeySquareOverlay(
  lineId: string,
  hasKeySquares: boolean,
  explainState: ExplainModeState
): {
  visible: boolean;
  toggle: () => void;
  toggleDisabled: boolean;
  drillPreference: boolean;
} {
  const storageKey = `tabiya:linePrefs:${lineId}:keySquareOverlay`;
  const [drillPref, setDrillPref] = useLocalStorageBool(storageKey, false);

  // R7.3, R7.4: Explain forces on; exiting restores drill preference
  const visible = explainState === 'running' || drillPref;

  // R7.5: hide toggle when no data
  const toggleDisabled = !hasKeySquares;

  return {
    visible: hasKeySquares && visible,
    toggle: () => setDrillPref(!drillPref),
    toggleDisabled,
    drillPreference: drillPref,
  };
}
```

### LocalStorage key shape (R7.2)

```
tabiya:linePrefs:<lineId>:keySquareOverlay   // boolean, default false
```

Matches the Phase 1b convention `tabiya:linePrefs:<lineId>:mode`. Single namespace per line for all preferences.

### Drill page header integration

```tsx
// src/pages/DrillPage.tsx (existing)
const { visible, toggle, toggleDisabled, drillPreference } =
  useKeySquareOverlay(activeLine.id, !!activeOpening.key_squares, explainState);

// header
{!toggleDisabled && (
  <ToggleButton onClick={toggle} active={drillPreference}>
    Key squares: {drillPreference ? 'on' : 'off'}
  </ToggleButton>
)}

// board overlay
<Board ... />
{visible && (
  <SpotlightOverlay
    keySquares={activeOpening.key_squares}
    boardOrientation={...}
    squarePx={...}
  />
)}
```

Explain Mode's force-on logic (R7.3) is internal to `useKeySquareOverlay` — DrillPage does not need branching. Single source of truth.

## 2b.4 Transposition banner (R8)

### Sidecar fetch

```ts
// src/storage/transpositions.ts
type TranspositionSidecar = {
  schema_version: number;
  index: Record<string, string[]>;
};

let cached: TranspositionSidecar | null = null;

export async function getTranspositionIndex(): Promise<TranspositionSidecar> {
  if (cached) return cached;
  const res = await fetch('/transpositions.json');
  cached = await res.json();
  return cached!;
}
```

Loaded once on first transposition query, cached for the session. Article 11-compliant: file is bundled, no remote network. The `fetch` is a static asset load from the same origin as `catalog.json`.

### FEN normalization in browser

Must match the build-time hash (R5.2). One small TS function mirrors `normalize_fen` + sha1-16:

```ts
// src/chess/fen-hash.ts
export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export async function fenHash(fen: string): Promise<string> {
  const buf = new TextEncoder().encode(normalizeFen(fen));
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

Contract test in `tests/chess/fen-hash.test.ts` and `tests/test_transposition.py` use the same 5-position fixture set to guarantee parity.

### Hook: `src/hooks/useTransposition.ts`

```ts
type TranspositionMatch = {
  lineId: string;
  displayName: string;
};

export function useTransposition(
  currentFen: string,
  currentPly: number,
  activeLineId: string,
  pickedLineIds: Set<string>  // Phase 1c presets / RepertoirePick
): {
  matches: TranspositionMatch[];
  truncated: number;          // count beyond cap (R8.3 "+N more")
} {
  const [matches, setMatches] = useState<TranspositionMatch[]>([]);
  const [truncated, setTruncated] = useState(0);

  useEffect(() => {
    // R8.6: never at ply 0
    if (currentPly === 0) { setMatches([]); return; }
    // R8.7: never if no repertoire picks
    if (pickedLineIds.size === 0) { setMatches([]); return; }

    (async () => {
      const idx = await getTranspositionIndex();
      const hash = await fenHash(currentFen);
      const allLineIds = idx.index[hash] ?? [];
      const filtered = allLineIds
        .filter(id => id !== activeLineId && pickedLineIds.has(id))
        .sort();    // R8.3 deterministic
      const capped = filtered.slice(0, 3);
      setMatches(capped.map(toMatch));
      setTruncated(Math.max(0, filtered.length - 3));
    })();
  }, [currentFen, currentPly, activeLineId, pickedLineIds]);

  return { matches, truncated };
}
```

### Repertoire filter source (R8.1)

`pickedLineIds` comes from whichever picks-source exists in the codebase at integration time:
- If Phase 1.5 `RepertoirePick` exists (deferred per 1c notes): use it directly.
- Else: fall back to Phase 1c `presets` filter — compute the set of lineIds the active preset includes (`usePreset()` → preset.family_ids → all lines under those families).
- If neither: `pickedLineIds = new Set()` → banner never appears (R8.7 holds trivially).

DrillPage decides which source to pass; the hook stays agnostic.

### Component: `<TranspositionBanner>`

```tsx
// src/components/drill/TranspositionBanner.tsx
type Props = {
  matches: TranspositionMatch[];
  truncatedCount: number;
  onJump: (lineId: string) => void;
};

export function TranspositionBanner({ matches, truncatedCount, onJump }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || matches.length === 0) return null;

  return (
    <div className="banner-transposition" /* 3-line cap layout */>
      <span>This position also appears in:</span>
      {matches.map(m => (
        <button key={m.lineId} className="chip" onClick={() => onJump(m.lineId)}>
          {m.displayName}
        </button>
      ))}
      {truncatedCount > 0 && <span className="more">+{truncatedCount} more</span>}
      <button className="dismiss" onClick={() => setDismissed(true)} aria-label="dismiss">×</button>
    </div>
  );
}
```

### Placement

**Above the move-history rail**, inline in the right-side panel layout. Not floating — a floating overlay would either cover the board or jitter on scroll. Inline placement is non-blocking (R8.5) and ergonomically sits where the user's eye is already tracking move progression.

3-line cap (R8.3) is enforced both by `matches.slice(0, 3)` upstream and by CSS `max-lines: 3; text-overflow: ellipsis` defense in depth.

### Navigation (R8.4)

```tsx
const onJump = (lineId: string) => {
  navigate(`/drill?line=${lineId}`);   // ply 0, fresh drill state
  // SRS state is preserved because line.id is stable (Article 6).
};
```

`onJump` lives in DrillPage and uses react-router's `navigate`. The drill engine treats the URL change as a normal line switch — same path as picking a line from the repertoire grid.

### Dismiss state (R8.5)

Per-session, in-component state — not persisted. Each new drill session starts fresh; a user who dismisses today still sees the banner tomorrow. Persisting forever would silently hide a re-derived match if the index changed.

## 2b.5 Type additions

```ts
// src/types/catalog.ts (extending existing)
export type KeySquareRecord = {
  square: Square;
  role: 'outpost' | 'control' | 'tension' | 'weak';
  for_color: 'white' | 'black';
  rationale: string;
  source_url: string;
};

export interface Opening {
  // ... existing fields
  key_squares?: KeySquareRecord[];   // R4.4 additive optional
}

export type TranspositionIndex = {
  schema_version: number;
  index: Record<string, string[]>;
};
```

---

## Open questions — resolutions

| Q from requirements | Resolution in this design |
|---|---|
| OQ1 source whitelist scope | Ship 2a with Wikipedia (CC-BY-SA) + Lichess Explorer (ODbL) only. Expand after 30-opening review pass if content thin. Encoded in `sources.yml` initial entries. |
| OQ2 few-shot count vs prompt size | Start with 5 exemplars per requirements lean. Measure approval rate during review pass. Tuning is data-only (`prompts/few_shot.yml`) — no code change needed to adjust. |
| OQ3 banner in Explain Mode | Drill-only. `<TranspositionBanner>` only mounts when `explainState !== 'running'`. Explain Mode is for line pedagogy; banner is navigation. Wired in DrillPage as a render guard. |

---

## Test plan

### 2a — pipeline

**Unit:**
- `tests/key_squares/test_adapters.py` — Wikipedia + Lichess adapters mock HTTP, assert URL discovery + chunk extraction shape.
- `tests/key_squares/test_robots.py` — robots.txt cache hits, disallow paths skipped, malformed robots → conservative deny.
- `tests/key_squares/test_ratelimit.py` — ≤1 req/sec per host (clock-mocked).
- `tests/key_squares/test_extract.py` — mock Anthropic client, assert JSON parse + Pydantic validation + retry-on-rate-limit (backoff 1,2,4s) + drop-on-validation-error.
- `tests/key_squares/test_review.py` — non-interactive: feed a stub stdin sequence (`a`, `e`, `r`), assert curated.yml + rejected.yml contents.
- `tests/build/test_key_squares_join.py` — unknown opening_slug fails build; valid join succeeds; missing curated entry leaves `key_squares=undefined`.
- `tests/build/test_license_audit.py` — non-permissive `source_url` host fails build with clear error.
- `tests/build/test_transposition.py` — determinism (byte-equal across two runs sans `generated_at`), singleton omission, FEN normalization correctness, fen_hash parity with TS fixture.

**Integration:**
- `tests/integration/test_pipeline_e2e.py` — fixture: 2 mocked openings with mocked HTTP. Run scrape → extract (mocked SDK) → CLI-replay → catalog build. Assert final catalog has `key_squares` for both, transposition index byte-equal across re-runs.

### 2b — UI

**Component:**
- `tests/components/HighlightLayer.test.tsx` — `mode.kind='bright'` renders rects; `'spotlight'` renders mask + cutouts; `'none'` returns null. Covers Article 15 contract for both Phase 1b and 2b.
- `tests/components/SpotlightOverlay.test.tsx` — all 4 role colors render correct stroke; no-data → null (R6.6); click fall-through verified by spying on board's onClick (R6.5); tooltip on hover (R6.4).
- `tests/components/TranspositionBanner.test.tsx` — ≥3 matches → exactly 3 chips + `+N more`; 0 matches → null; dismiss → null; chip onClick triggers onJump.

**Hook:**
- `tests/hooks/useKeySquareOverlay.test.ts` — persists toggle to localStorage; Explain `running` forces visible=true regardless of pref; Explain back to `off` restores pref; `!hasKeySquares` → toggleDisabled + visible=false.
- `tests/hooks/useTransposition.test.ts` — ply 0 suppressed (R8.6); empty picks suppressed (R8.7); active line filtered out; sort + cap at 3; `truncated` count correct.

**Integration:**
- `tests/integration/test_pattern_viz.test.tsx` — open Drill on an opening with key_squares, toggle off → no overlay; toggle on → overlay; enter Explain → overlay forced on; exit Explain → overlay restored to toggle pref.
- `tests/integration/test_transposition_e2e.test.tsx` — fixture catalog with 2 lines that share a position at ply 4; pick both into repertoire; drill line A to ply 4; assert banner shows line B chip; click chip → navigates to `/drill?line=lineB`.

**No-regression:**
- Existing drill tests still pass with overlay off (R9.8).
- Existing Phase 1b explain tests still pass with `<HighlightLayer mode.kind='bright'>` route (Article 15 contract).

**Coverage gate:** new modules ≥80%; existing scheduler/drill 100% retained.

---

## File tree forecast

```
scripts/
├── build_catalog.py                         # extended (load + join + audit + transposition emit)
├── tabiya_build/
│   ├── key_squares.py                       # new (Pydantic models + join + license audit)
│   └── transposition.py                     # new (FEN normalize + hash + index build)
├── key_squares/
│   ├── __init__.py
│   ├── scrape.py                            # new
│   ├── extract.py                           # new
│   ├── review.py                            # new
│   ├── sources.yml                          # new (whitelist + licenses)
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── base.py                          # new (SourceAdapter Protocol)
│   │   ├── wikipedia.py                     # new
│   │   └── lichess_explorer.py              # new
│   ├── prompts/
│   │   └── few_shot.yml                     # new (5 exemplars)
│   └── lib/
│       ├── robots.py                        # new
│       ├── ratelimit.py                     # new
│       └── opening_keys.py                  # new
└── curated/
    ├── key_squares.yml                      # new (curated output)
    ├── families.yml                         # existing
    ├── lines.yml                            # existing
    ├── notes.yml                            # existing
    ├── presets.yml                          # existing
    └── variations.yml                       # existing

data/
└── key_squares/
    ├── scraped/<opening_slug>.json          # generated (gitignored)
    ├── pending/<opening_slug>.yml           # generated (gitignored)
    └── rejected/<opening_slug>.yml          # generated (git-tracked, prompt-tuning corpus)

public/
├── catalog.json                             # bumped schema_version, +key_squares on Openings
└── transpositions.json                      # new sidecar

src/
├── components/
│   ├── board/
│   │   ├── HighlightLayer.tsx               # new or extended (shared with 1b, Article 15)
│   │   ├── HighlightTooltip.tsx             # new or shared with 1b
│   │   └── SpotlightOverlay.tsx             # new
│   └── drill/
│       ├── DrillPage.tsx                    # toggle in header + banner mount
│       └── TranspositionBanner.tsx          # new
├── hooks/
│   ├── useKeySquareOverlay.ts               # new
│   └── useTransposition.ts                  # new
├── storage/
│   └── transpositions.ts                    # new (sidecar fetch + cache)
├── chess/
│   └── fen-hash.ts                          # new (mirrors Python normalize+hash)
└── types/
    └── catalog.ts                           # +KeySquareRecord, Opening.key_squares?, TranspositionIndex

tests/
├── key_squares/
│   ├── test_adapters.py
│   ├── test_robots.py
│   ├── test_ratelimit.py
│   ├── test_extract.py
│   └── test_review.py
├── build/
│   ├── test_key_squares_join.py
│   ├── test_license_audit.py
│   └── test_transposition.py
├── integration/
│   ├── test_pipeline_e2e.py
│   └── test_pattern_viz.test.tsx
├── components/
│   ├── HighlightLayer.test.tsx
│   ├── SpotlightOverlay.test.tsx
│   └── TranspositionBanner.test.tsx
├── hooks/
│   ├── useKeySquareOverlay.test.ts
│   └── useTransposition.test.ts
└── chess/
    └── fen-hash.test.ts

tech.md                                       # addendum: scrape source whitelist + licenses
```

---

## Dependency graph

```
2a.1 Scrape adapters  ──┐
2a.2 Normalization    ──┤
2a.3 LLM extraction   ──┼──>  2a.4 Review CLI  ──>  curated/key_squares.yml
                        │
2a.5 Build join       ──┘  ──>  public/catalog.json  (bumped schema_version)
2a.6 Transposition    ────────>  public/transpositions.json

                                              [gate: ≥30 openings approved]

2b.1 HighlightLayer (shared w/ 1b)
2b.2 SpotlightOverlay  ──┐
2b.3 useKeySquareOverlay ┼──>  DrillPage integration
                          │
2b.4 useTransposition    ┼──>  TranspositionBanner mount
2b.4 fen-hash + sidecar  ┘
```

Execution order (assuming Phase 1b ships first and supplies `HighlightLayer`): 2a.1, 2a.2, 2a.3, 2a.4 → run pipeline → 2a.5, 2a.6 → unlock gate → 2b.2, 2b.3 → 2b.4 → integration tests → polish.

If Phase 1b is delayed, Phase 2b ships `HighlightLayer` first (with both branches; Phase 1b consumes the `bright` branch on its merge).

---

## Constitution compliance

- **Article 1 (Open Source / Open Data):** `sources.yml` declares SPDX license per source; `license_audit` build-time check (2a.5) fails on unaudited hosts; `tech.md` addendum lists initial whitelist (Wikipedia CC-BY-SA, Lichess ODbL).
- **Article 3 (No Heavy AI Orchestration):** `extract.py` uses `anthropic.Anthropic` directly. No LangChain. Retry + JSON parse + Pydantic validation are written inline (2a.3).
- **Article 6 (Stable Line IDs):** key_squares join by `opening_slug`; transposition index entries are `lineId` strings; rebuild drops/adds entries but never renumbers.
- **Article 11 (Local-First):** scrape + extract + review are offline Python build steps. Runtime fetches `/catalog.json` and `/transpositions.json` from the same origin — no remote calls. No backend introduced for this phase.
- **Article 13 (Weekend Pace):** 5-6 weekend days as forecast in requirements timebox; 2a → 2b gate is the natural pause point if main plan demands.
- **Article 14 (Type Discipline):** TS strict throughout (`Square` template-literal type, discriminated `HighlightMode` union, `KeySquareRecord` exact shape); Python type hints + Pydantic models on every new module (adapter Protocol, `KeySquareDraft`, `OpeningKeySquares`).
- **Article 15 (Single Highlight Primitive):** `<HighlightLayer>` is one component with a discriminated `mode` prop covering Explain (`bright`) and Pattern Viz (`spotlight`). `<HighlightTooltip>` is shared. `<SpotlightOverlay>` is a thin adapter over the primitive, not a fork.
