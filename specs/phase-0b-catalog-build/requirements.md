# Requirements: Phase 0b — Catalog Build Script

## Introduction

Phase 0b ships an offline Python script that produces `public/catalog.json`, the static opening catalog consumed by the frontend. The script is a one-shot, idempotent pipeline: it reads the canonical opening names from the [`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings) TSV repository, extends each opening's "naming sequence" via the Lichess Opening Explorer API to a controlled depth (16–20 ply), and emits a Pydantic-validated JSON document with stable line IDs, ECO classifications, popularity scores, and reserved fields for future strategic notes and key squares.

Phase 0a hardcoded a single line; Phase 0b replaces that with ~15–20 named openings × ~25 lines each (~375–500 lines total). Catalog generation runs on the developer's machine via `uv run python scripts/build_catalog.py`. The runtime app never calls Lichess directly — Constitution Article 11 (local-first) is preserved.

## Requirements

### Requirement 1: Python Project Setup

**User Story:** As the developer, I want a tidy `uv`-managed Python environment scoped to the build script, so that catalog generation has reproducible dependencies without polluting the host Python install.

#### Acceptance Criteria

1. THE SYSTEM SHALL include a top-level `pyproject.toml` declaring the project name, Python `>= 3.12` requirement, and the build-script dependencies (Constitution Articles 2, 14).
2. THE SYSTEM SHALL declare these runtime dependencies in `pyproject.toml`: `python-chess`, `httpx`, `pydantic` (v2), `tenacity`.
3. THE SYSTEM SHALL declare these dev dependencies: `pytest`, `ruff`.
4. WHEN the developer runs `uv sync` THE SYSTEM SHALL create or update `.venv` and `uv.lock` deterministically.
5. WHEN the developer runs `uv run ruff check .` THE SYSTEM SHALL lint Python sources with no errors.
6. WHEN the developer runs `uv run pytest` THE SYSTEM SHALL execute Python unit tests for the build pipeline.
7. THE SYSTEM SHALL declare a `Ruff` configuration enabling `E`, `F`, `I` (import order), `UP` (pyupgrade), and `B` (bugbear) rule sets, plus enforcing line length 100.
8. THE SYSTEM SHALL include the `.venv/` directory in `.gitignore` and `.dockerignore`.

### Requirement 2: Opening Whitelist

**User Story:** As the developer, I want a small, curated list of well-known openings driving the catalog, so that the output is focused for drilling rather than exhaustive.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship a Python module declaring 15–20 target openings keyed by canonical opening name.
2. EACH whitelist entry SHALL include: `id` (stable slug), `display_name`, `eco_range`, `color` (`white` or `black` — which side the player drills), and an optional `depth_override` (16, 18, or 20 ply).
3. THE SYSTEM SHALL include at minimum: Ruy Lopez, Italian Game, Sicilian Defense, French Defense, Caro-Kann, Queen's Gambit, King's Indian Defense, Nimzo-Indian, English Opening, Scandinavian Defense, London System, Slav Defense, Pirc Defense, Vienna Game, Alekhine's Defense.
4. THE SYSTEM SHALL flag tactical sharp lines (Sicilian Najdorf, Sicilian Dragon, KID Mar del Plata, Botvinnik Slav) for `depth_override = 20`.
5. THE SYSTEM SHALL flag positional quiet lines (London System, Caro-Kann main, Italian Quiet) for `depth_override = 16`.
6. ALL OTHER lines SHALL default to `depth = 18` ply.

### Requirement 3: TSV Ingestion (Naming Backbone)

**User Story:** As the developer, I want canonical opening names + ECO codes from a maintained source, so that the catalog uses consistent recognized terminology.

#### Acceptance Criteria

1. THE SYSTEM SHALL fetch the `lichess-org/chess-openings` TSV files (a.tsv through e.tsv, 5 files total) via `httpx`.
2. THE SYSTEM SHALL cache the fetched TSVs under `scripts/.cache/openings-tsv/` to avoid re-downloading on rerun.
3. WHEN cached files exist AND `--refresh` flag is NOT set THE SYSTEM SHALL use the cached files.
4. WHEN `--refresh` flag IS set THE SYSTEM SHALL re-download and overwrite the cache.
5. THE SYSTEM SHALL parse each TSV into a list of `(eco, name, uci_sequence, pgn_sequence)` records using `python-chess` to normalize move encoding.
6. THE SYSTEM SHALL emit a clear error and exit non-zero if any TSV is unreachable AND no cache exists.

### Requirement 4: Lichess Explorer API Extension

**User Story:** As the developer, I want each opening's lines extended past the naming point to a useful drill depth, so that the user reaches the actual middlegame setup, not just the move that names the opening.

#### Acceptance Criteria

1. THE SYSTEM SHALL call the Lichess Masters Explorer endpoint (`https://explorer.lichess.ovh/masters`) with `fen=<position>` to retrieve continuation statistics.
2. THE SYSTEM SHALL respect Lichess rate-limit guidelines (≤ 5 requests / second) by inserting delays between calls.
3. THE SYSTEM SHALL retry transient HTTP errors (timeouts, 429, 5xx) up to 3 times with exponential backoff via `tenacity`.
4. THE SYSTEM SHALL cache every API response keyed by request URL under `scripts/.cache/explorer/` so reruns are deterministic.
5. WHEN extending a line THE SYSTEM SHALL pick the top continuation by master-game frequency, AND optionally the second continuation if its frequency is within 5 percentage points of the top.
6. THE SYSTEM SHALL stop extending a line WHEN the top continuation's relative frequency falls below 15% of total games at that position (lines have diverged).
7. THE SYSTEM SHALL stop extending a line WHEN the line reaches its assigned `depth_override` (or 18 default).
8. THE SYSTEM SHALL stop extending a line WHEN the API returns zero continuations.

### Requirement 5: Catalog Schema and Validation

**User Story:** As the developer, I want a Pydantic-validated JSON output, so that schema drift is impossible and the frontend's TypeScript interface stays in sync.

#### Acceptance Criteria

1. THE SYSTEM SHALL define Pydantic v2 models (`Opening`, `Line`, `KeySquare`, `Catalog`) matching the schema in the steering structure doc and the design doc Section 11 of Phase 0a.
2. EACH `Line` model SHALL include: `id` (slug), `opening_id`, `name`, `moves` (list of SAN strings), `depth`, `end_fen`, `popularity`, `tags`, `strategic_notes` (default `[]`), `key_squares` (default `[]`).
3. EACH `Opening` model SHALL include: `id`, `name`, `eco`, `color`, `line_ids`.
4. THE SYSTEM SHALL generate stable line IDs as slugs of the form `<opening-id>-<line-name-slug>` (Constitution Article 6).
5. WHEN serializing THE SYSTEM SHALL preserve insertion order (deterministic field order) so the JSON file diff is review-friendly.
6. WHEN a generated `Line.id` collides with an already-emitted ID THE SYSTEM SHALL append a numeric suffix (`-2`, `-3`, …) so IDs remain unique without renumbering existing entries.

### Requirement 6: Strategic Notes and Key Squares Overlay

**User Story:** As the developer, I want to ship hand-curated strategic notes and key squares per line without putting them in the build script, so that curation can happen incrementally without re-running API extension.

#### Acceptance Criteria

1. THE SYSTEM SHALL read an optional `scripts/curated/notes.yml` file containing `{line_id: {strategic_notes: [string], key_squares: [{square, note, side?}]}}` mappings.
2. WHEN a `line_id` from the API-extended catalog has an entry in `notes.yml` THE SYSTEM SHALL merge `strategic_notes` and `key_squares` into the corresponding `Line`.
3. WHEN `notes.yml` references a `line_id` that no longer exists in the generated catalog THE SYSTEM SHALL log a warning but NOT fail the build.
4. WHEN `notes.yml` does NOT exist THE SYSTEM SHALL emit lines with empty `strategic_notes` and `key_squares` arrays.

### Requirement 7: Output and Versioning

**User Story:** As the developer, I want the catalog written to a known location with a version stamp, so that the frontend can detect refreshes and the file is committable.

#### Acceptance Criteria

1. THE SYSTEM SHALL write the final JSON to `public/catalog.json` (relative to repo root).
2. THE SYSTEM SHALL include a top-level `version` field, formatted `YYYY-MM-DD` (UTC date of build).
3. THE SYSTEM SHALL pretty-print the JSON with 2-space indentation, sorted lists where order is not semantic, and trailing newline.
4. WHEN the build succeeds THE SYSTEM SHALL print a summary to stdout: number of openings, number of lines, total file size, and version stamp.
5. THE SYSTEM SHALL keep the final `catalog.json` under 500 KB uncompressed.

### Requirement 8: CLI Interface

**User Story:** As the developer, I want a small set of flags so I can iterate quickly during curation.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose `scripts/build_catalog.py` as the executable entrypoint.
2. THE SYSTEM SHALL accept the following flags (all optional):
   - `--refresh`: ignore caches, re-fetch TSVs and Explorer responses
   - `--openings <id1,id2,...>`: limit build to the given opening IDs (faster iteration)
   - `--out <path>`: override output path (default: `public/catalog.json`)
   - `--max-depth <n>`: override the global depth cap for testing
3. WHEN any required input is missing or invalid THE SYSTEM SHALL exit non-zero with a clear error message on stderr.
4. WHEN the build runs THE SYSTEM SHALL log progress per-opening to stderr at INFO level.

### Requirement 9: Testability

**User Story:** As the developer, I want unit tests covering deterministic logic so future API changes or regressions are caught locally.

#### Acceptance Criteria

1. THE SYSTEM SHALL include unit tests for: TSV parser, slug generator, ID-collision suffix logic, line-extension stop conditions, schema validation, notes-overlay merge.
2. THE SYSTEM SHALL mock all `httpx` calls in unit tests — no live network access during `uv run pytest`.
3. THE SYSTEM SHALL include at least one end-to-end smoke test running the script against a fixture cache and asserting the output JSON shape plus a known opening's line count.
4. THE SYSTEM SHALL achieve at least 80% line coverage on the build module (excluding `__main__` glue).

### Requirement 10: Non-Functional

#### Acceptance Criteria

1. THE SYSTEM SHALL keep total Python source code in `scripts/` under approximately 700 lines.
2. THE SYSTEM SHALL complete a full uncached build in under 10 minutes on residential broadband (rate-limit delays included).
3. THE SYSTEM SHALL complete a fully cached rebuild in under 30 seconds.
4. ALL Python source files SHALL pass `ruff check` with the project's configuration.
5. ALL public functions SHALL have explicit type hints (Constitution Article 14).
6. THE SYSTEM SHALL NOT introduce any dependency outside the OSS allow-list (Constitution Article 1).

## Constraints

- One-shot script. No daemon, no scheduler. Catalog refreshes are intentional, manual events.
- No runtime calls to Lichess from the frontend (Constitution Article 11). Frontend reads `public/catalog.json` only.
- Python is the build language (Constitution Article 2). No JavaScript / Bash for catalog generation.
- All chess moves stored as SAN in the catalog (Constitution Article 9).
- Linear lines only — no branching variations within a line (Constitution Article 7).
- Hard depth cap 20 ply, no exceptions (Constitution Article 8).
- Stable line IDs forever — once published, never renumber (Constitution Article 6).
- Catalog must function with `notes.yml` absent (graceful degradation).
- Hand-curation of strategic notes / key squares is OUT OF SCOPE for Phase 0b. Only the merge mechanism ships. Curation happens incrementally in Phase 1.5.
- No backend introduced (Constitution Article 12).
- Weekend pace; pause if main battle plan needs the time (Constitution Article 13).
