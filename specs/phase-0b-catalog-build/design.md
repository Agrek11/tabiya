# Design: Phase 0b — Catalog Build Script

## Overview

A single Python entrypoint (`scripts/build_catalog.py`) drives an offline pipeline that produces `public/catalog.json`. The pipeline is composed of small, individually testable modules: TSV fetcher, line extender (Lichess Explorer client), schema models, notes overlay, writer. Caching is mandatory — both TSVs and Explorer responses persist under `scripts/.cache/`, so reruns are deterministic and offline-friendly.

`uv` manages the Python environment; `pyproject.toml` declares all dependencies; `ruff` is the lint authority; `pytest` runs the test suite.

## Architecture

### Pipeline diagram

```
┌─ scripts/build_catalog.py (CLI) ──────────────────────────────────────┐
│                                                                       │
│   parse_args()                                                        │
│        │                                                              │
│        ▼                                                              │
│   load_whitelist()  ──────────►  list[OpeningSpec]                   │
│        │                                                              │
│        ▼                                                              │
│   ensure_tsv_cache(refresh) ───►  cached a-e.tsv files                │
│        │                                                              │
│        ▼                                                              │
│   parse_tsvs()  ───────────────►  dict[(eco, naming_uci)] -> name    │
│        │                                                              │
│        ▼                                                              │
│   for spec in whitelist:                                              │
│       extend_lines(spec) ──────►  list[Line]   (calls Explorer API)  │
│            │                                                          │
│            ▼                                                          │
│       (line cache hits / new fetches)                                 │
│                                                                       │
│   merge_notes(catalog, notes.yml) ───►  Catalog with overlays         │
│        │                                                              │
│        ▼                                                              │
│   write_catalog(catalog, out_path)                                    │
│        │                                                              │
│        ▼                                                              │
│   print_summary()                                                     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Architectural decisions

**AD1. uv-managed environment, not pip + venv.** `uv` is faster, deterministic via lockfile, and matches the chosen 2026-stable Python toolchain (steering/tech.md). One command (`uv sync`) for both install and venv creation.

**AD2. Modules over a monolith script.** `scripts/build_catalog.py` is the entrypoint glue only. Real logic lives in `scripts/tabiya_build/` package: `whitelist.py`, `tsv.py`, `explorer.py`, `extender.py`, `schema.py`, `notes.py`, `writer.py`. Each is independently importable and testable.

**AD3. Pydantic v2 as the source of truth for the schema.** Models are defined once in `schema.py`. JSON output is produced via `model.model_dump_json(...)`. Same models will be re-imported in test fixtures. This guarantees the output JSON shape matches the design and gives us validation for free.

**AD4. Aggressive caching by URL and request.** TSVs cached by URL → file. Explorer responses cached by `fen` parameter → JSON file. This makes incremental development cheap (`--openings ruy-lopez` re-uses prior cache) and the unit tests rely on a fixture cache for offline determinism.

**AD5. Stop-conditions encoded as a small state machine, not nested ifs.** The line-extender returns a `LineWithReason` (the line and the stop reason: `depth_reached`, `low_popularity`, `no_continuations`) so the test suite can assert on the right path being taken.

**AD6. Notes overlay is read AFTER catalog generation.** This decouples curation from network. Curators can edit `notes.yml` and rerun the cached pipeline in seconds; no API requests fire.

**AD7. Slug generation is the one place IDs are minted.** A single function `slugify(name)` is the canonical source of slugs. Collisions are deterministic via numeric suffix. Line IDs survive across runs because slugify(name) is stable.

**AD8. CLI uses `argparse` from stdlib.** No `click` / `typer` dependency for this small surface.

## Implementation Details

### File layout

```
tabiya/
├── pyproject.toml              # uv-managed Python project + Ruff config
├── uv.lock                     # generated, committed
├── scripts/
│   ├── build_catalog.py        # __main__ entrypoint (CLI glue, ~80 LOC)
│   ├── tabiya_build/
│   │   ├── __init__.py
│   │   ├── whitelist.py        # OpeningSpec dataclass, TARGET_OPENINGS list
│   │   ├── tsv.py              # download + parse lichess-org/chess-openings TSVs
│   │   ├── explorer.py         # httpx client for Lichess Masters Explorer
│   │   ├── extender.py         # line extension state machine
│   │   ├── schema.py           # Pydantic v2 models
│   │   ├── notes.py            # YAML notes overlay merger
│   │   └── writer.py           # JSON serializer + summary printer
│   ├── curated/
│   │   └── notes.yml           # OPTIONAL hand-curated overlays (Phase 1.5+)
│   └── .cache/                 # gitignored
│       ├── openings-tsv/       # raw TSVs
│       └── explorer/           # one JSON per cached FEN
├── tests/
│   ├── python/
│   │   ├── test_tsv.py
│   │   ├── test_extender.py
│   │   ├── test_schema.py
│   │   ├── test_slug.py
│   │   ├── test_notes_overlay.py
│   │   └── test_smoke_e2e.py   # uses fixture cache, no network
│   └── python/fixtures/
│       ├── tsv/                # canned TSV samples
│       └── explorer/           # canned Explorer responses
└── public/
    └── catalog.json            # output, committed
```

### Key types (Python)

```python
# scripts/tabiya_build/schema.py
from pydantic import BaseModel, Field

class KeySquare(BaseModel):
    square: str
    note: str
    side: str | None = None  # 'white' | 'black' | 'both' | None

class Line(BaseModel):
    id: str
    opening_id: str
    name: str
    moves: list[str]                         # SAN
    depth: int
    end_fen: str
    popularity: float
    tags: list[str] = Field(default_factory=list)
    strategic_notes: list[str] = Field(default_factory=list)
    key_squares: list[KeySquare] = Field(default_factory=list)

class Opening(BaseModel):
    id: str
    name: str
    eco: str
    color: str                               # 'white' | 'black'
    line_ids: list[str]

class Catalog(BaseModel):
    version: str                             # YYYY-MM-DD
    openings: list[Opening]
    lines: list[Line]
```

```python
# scripts/tabiya_build/whitelist.py
from dataclasses import dataclass

@dataclass(frozen=True)
class OpeningSpec:
    id: str
    display_name: str
    eco_range: str
    color: str                          # 'white' | 'black'
    seed_pgn: str                       # canonical naming sequence in SAN
    depth_override: int | None = None   # None → default 18

TARGET_OPENINGS: list[OpeningSpec] = [
    OpeningSpec("ruy-lopez", "Ruy Lopez", "C60-C99", "black",
                "1. e4 e5 2. Nf3 Nc6 3. Bb5"),
    # ... 14+ more
    OpeningSpec("london-system", "London System", "D02", "white",
                "1. d4 d5 2. Nf3 Nf6 3. Bf4", depth_override=16),
    OpeningSpec("sicilian-najdorf", "Sicilian Najdorf", "B90-B99", "black",
                "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
                depth_override=20),
]
```

### Line extension algorithm

```python
# scripts/tabiya_build/extender.py
from dataclasses import dataclass

@dataclass
class StopReason:
    code: str  # 'depth_reached' | 'low_popularity' | 'no_continuations'

@dataclass
class ExtendedLine:
    moves: list[str]      # SAN
    end_fen: str
    popularity: float
    stop: StopReason

POPULARITY_THRESHOLD = 0.15
DEFAULT_DEPTH = 18

def extend_line(spec, seed_moves, explorer):
    depth_cap = spec.depth_override or DEFAULT_DEPTH
    board = chess.Board()
    for san in seed_moves:
        board.push_san(san)

    moves: list[str] = list(seed_moves)
    popularity = 1.0  # seed is canonical, fully popular by definition

    while len(moves) < depth_cap:
        response = explorer.fetch(board.fen())
        if not response.moves:
            return ExtendedLine(moves, board.fen(), popularity, StopReason('no_continuations'))

        top = response.moves[0]
        total = sum(m.total_games for m in response.moves)
        relative = top.total_games / total if total else 0.0
        if relative < POPULARITY_THRESHOLD:
            return ExtendedLine(moves, board.fen(), popularity, StopReason('low_popularity'))

        moves.append(top.san)
        board.push_san(top.san)
        popularity = relative

    return ExtendedLine(moves, board.fen(), popularity, StopReason('depth_reached'))
```

The "branch into top 2 if close" behavior (Req 4.5) is layered on top by the caller — `build_catalog.py` calls `extend_line` once for the main path, and (when the gap between top-1 and top-2 is < 5pp) recursively for the alternative, producing a second `ExtendedLine`.

### Explorer client (rate-limited, retried, cached)

```python
# scripts/tabiya_build/explorer.py
import httpx
import json
import time
from pathlib import Path
from tenacity import retry, stop_after_attempt, wait_exponential

class ExplorerClient:
    BASE = "https://explorer.lichess.ovh/masters"
    MIN_INTERVAL_S = 0.25  # ≤ 4 rps, well under 5 rps limit

    def __init__(self, cache_dir: Path):
        self._cache = cache_dir
        self._cache.mkdir(parents=True, exist_ok=True)
        self._last_call = 0.0

    def fetch(self, fen: str) -> ExplorerResponse:
        cache_path = self._cache / (sha1(fen) + ".json")
        if cache_path.exists():
            return ExplorerResponse.parse_file(cache_path)

        elapsed = time.monotonic() - self._last_call
        if elapsed < self.MIN_INTERVAL_S:
            time.sleep(self.MIN_INTERVAL_S - elapsed)

        data = self._fetch_with_retry(fen)
        cache_path.write_text(json.dumps(data, indent=2))
        self._last_call = time.monotonic()
        return ExplorerResponse(**data)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def _fetch_with_retry(self, fen: str) -> dict:
        with httpx.Client(timeout=10.0) as c:
            r = c.get(self.BASE, params={"fen": fen})
            r.raise_for_status()
            return r.json()
```

### Slug + collision logic

```python
# scripts/tabiya_build/slug.py (or in writer.py)
import re

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

class IdMinter:
    """Deterministic, collision-aware ID generator."""
    def __init__(self):
        self._used: set[str] = set()
    def mint(self, base: str) -> str:
        if base not in self._used:
            self._used.add(base)
            return base
        i = 2
        while f"{base}-{i}" in self._used:
            i += 1
        self._used.add(f"{base}-{i}")
        return f"{base}-{i}"
```

### Pyproject

```toml
[project]
name = "tabiya-build"
version = "0.1.0"
description = "Offline catalog builder for tabiya"
requires-python = ">=3.12"
dependencies = [
  "python-chess>=1.999",
  "httpx>=0.27",
  "pydantic>=2.7",
  "tenacity>=8.4",
  "PyYAML>=6.0",
]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-cov>=5", "ruff>=0.5"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.pytest.ini_options]
testpaths = ["tests/python"]
addopts = "--cov=scripts/tabiya_build --cov-report=term-missing"
```

## API Changes

### External API consumed

- `GET https://explorer.lichess.ovh/masters?fen=<FEN>` — Lichess Masters Explorer. Public, no auth, ~5 rps.
- `GET https://raw.githubusercontent.com/lichess-org/chess-openings/master/{a..e}.tsv` — TSV files committed in the upstream repo.

### No internal API changes

The frontend's `OpeningRepository` interface (Phase 0c) consumes `public/catalog.json`. Schema in this phase matches what was reserved in Phase 0a's design Section 11 + the new fields (`strategic_notes`, `key_squares`).

## Data Model

See "Key types (Python)" above. The TypeScript interface in `src/storage/types.ts` (created in Phase 0c) mirrors these models 1:1.

### Catalog file shape (excerpt)

```json
{
  "version": "2026-05-10",
  "openings": [
    {
      "id": "ruy-lopez",
      "name": "Ruy Lopez",
      "eco": "C60-C99",
      "color": "black",
      "line_ids": ["ruy-lopez-closed-main", "ruy-lopez-berlin", "..."]
    }
  ],
  "lines": [
    {
      "id": "ruy-lopez-closed-main",
      "opening_id": "ruy-lopez",
      "name": "Closed Main Line",
      "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "..."],
      "depth": 18,
      "end_fen": "...",
      "popularity": 0.42,
      "tags": ["positional", "main-line"],
      "strategic_notes": [],
      "key_squares": []
    }
  ]
}
```

## Testing Strategy

- **Unit tests** (mocked httpx) for: TSV parsing (sample TSV → records), slug + collision (`slugify` + `IdMinter`), extender stop-conditions, schema validation, notes overlay merge.
- **Smoke E2E** (no network): run `build_catalog.py` against a fixture cache directory containing canned TSVs and Explorer responses; assert output JSON has the expected openings, total line count, schema-valid.
- **Coverage gate** ≥ 80% on `scripts/tabiya_build/`.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Lichess Explorer API changes shape | Schema validation at parse time + unit fixtures; pin tested response format |
| TSV format drifts in upstream repo | Cache + version-pin via commit hash if it becomes a problem (defer) |
| Catalog explodes past 500 KB | Cap depth aggressively; `--max-depth` for testing; tune `POPULARITY_THRESHOLD` upward if needed |
| Stable IDs break across runs (regression of Article 6) | `IdMinter` only ever appends suffixes; existing IDs always re-minted to the same slug |
| Network flakiness midway through a build | Per-FEN cache means rerun continues from where it left off |
| Rate limit hit anyway | tenacity retries + 0.25s min interval keeps us well under 5 rps |

## Compliance with Constitution

| Article | Where enforced |
|---|---|
| 1 — Open Source Only | All deps MIT/BSD/Apache; Lichess data CC-BY/AGPL — declared in tech.md |
| 2 — Python Primary, TS Browser | This is the Python phase; build script is Python end-to-end |
| 5 — Repository Pattern | Catalog is read by `OpeningRepository` impls in Phase 0c — no consumer touches the JSON directly past that boundary |
| 6 — Stable Line IDs Forever | `IdMinter` enforces; existing IDs re-mint deterministically |
| 7 — Linear Lines Only | Extender produces a single move-list per line; second-best alternative becomes a separate `Line` row, not a branch |
| 8 — Hard Depth Cap 20 Ply | `depth_override <= 20` validated in whitelist |
| 9 — SAN Format | `python-chess` push_san produces canonical SAN; stored as-is |
| 10 — Standalone & Generalized | No author identity; whitelist names are public openings |
| 11 — Local-First | No runtime network; build is an offline batch |
| 12 — Backend Optional | Build script is offline; nothing introduced to the running app |
| 13 — Weekend Pace | Plan is one weekend (~6-8 hrs); per `tasks.md` |
| 14 — Type Discipline | Type hints + Pydantic everywhere; ruff enforced |
| 16 — Containerized Distribution | Build script runs locally OR can be added as a `builder` service in compose later (not required for Phase 0b) |
