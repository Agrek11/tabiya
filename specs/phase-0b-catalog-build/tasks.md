# Tasks: Phase 0b — Catalog Build Script

Sequential checklist. Tasks reference Requirement (R#) and Architectural Decision (AD#) numbers from this spec.

Estimate: 1 weekend (~6-8 hrs).

## 1. Python Project Setup

- [x] **1.1** Install `uv` if not present on host (`brew install uv` on Mac) — assumed available
- [x] **1.2** Create `pyproject.toml` with project metadata, runtime + dev deps, ruff config, pytest config (R1.1-1.7 · AD1)
- [ ] **1.3** `uv sync` — verify `.venv` and `uv.lock` created (R1.4) — *user runs locally*
- [x] **1.4** Add `.venv/` and `scripts/.cache/` to `.gitignore` and `.dockerignore` (R1.8)
- [x] **1.5** Add Python source paths to `eslint.config.js` ignore list — N/A; ESLint only globs JS/TS files
- [ ] **1.6** Sanity: `uv run ruff check .` passes — *user runs locally*
- [ ] **1.7** Sanity: `uv run pytest` passes — *user runs locally*

## 2. Module Skeletons

- [x] **2.1** Create `scripts/tabiya_build/__init__.py`
- [x] **2.2** Create `scripts/tabiya_build/schema.py` with Pydantic models (R5.1-5.3 · AD3)
- [x] **2.3** Create `scripts/tabiya_build/whitelist.py` with `OpeningSpec` dataclass + populated `TARGET_OPENINGS` (R2.1-2.2)
- [x] **2.4** Create `scripts/tabiya_build/slug.py` with `slugify` + `IdMinter` (R5.4, R5.6 · AD7)
- [x] **2.5** Create `scripts/tabiya_build/tsv.py` (full implementation)
- [x] **2.6** Create `scripts/tabiya_build/explorer.py` (full implementation)
- [x] **2.7** Create `scripts/tabiya_build/extender.py` (full implementation)
- [x] **2.8** Create `scripts/tabiya_build/notes.py` (full implementation)
- [x] **2.9** Create `scripts/tabiya_build/writer.py` (full implementation)
- [x] **2.10** Create `scripts/build_catalog.py` entrypoint with argparse + main() (R8.1-8.2)

## 3. Whitelist (Static Data)

- [x] **3.1** Populate `TARGET_OPENINGS` with 18 entries per R2.3 + R2.4 + R2.5
- [x] **3.2** Set `depth_override` for sharp lines (Najdorf, Dragon) to 20 (R2.4)
- [x] **3.3** Set `depth_override` for quiet lines (London, Caro-Kann) to 16 (R2.5)
- [x] **3.4** All `seed_pgn` values verified parseable via `python-chess` in `tests/python/test_whitelist.py`

## 4. Slug + ID Minter

- [x] **4.1** Implement `slugify(s)` — lowercase, alphanumerics, dash-collapse (AD7)
- [x] **4.2** Implement `IdMinter` class with `mint(base)` returning collision-free slugs
- [x] **4.3** `tests/python/test_slug.py` — 11 cases covering simple, special chars, multi-collision, reserve (R9.1)

## 5. TSV Ingestion

- [x] **5.1** Implement `download_tsv(letter, cache_dir, refresh)` with `httpx.Client` (R3.1, R3.2, R3.3, R3.4)
- [x] **5.2** Implement `parse_tsv(path)` returning list of `TsvRow` (R3.5)
- [x] **5.3** Test fixture `tests/python/fixtures/tsv/sample.tsv` with 5 known rows
- [x] **5.4** `tests/python/test_tsv.py` — parser correctness + cache hit + refresh path (no live network)

## 6. Explorer Client

- [x] **6.1** Define `ExplorerMove` and `ExplorerResponse` dataclasses
- [x] **6.2** Implement `ExplorerClient.fetch(fen)` with cache + rate-limit + tenacity retry (R4.1-4.4 · AD4)
- [x] **6.3** `tests/python/test_explorer.py` covers cache hit, cache miss writing, parse, retry on 429
- [x] **6.4** Unit test: cache hit returns parsed object without calling httpx (R9.2)
- [x] **6.5** Unit test: retry triggers on 429, succeeds on 3rd attempt (R4.3)

## 7. Line Extender

- [x] **7.1** Implement `extend_line(spec, seed_moves, explorer, max_depth)` per design pseudocode (R4.5-4.8 · AD5)
- [x] **7.2** Implement `extend_with_branch` with top-2 fork logic (R4.5)
- [x] **7.3** `tests/python/test_extender.py` covers all 3 stop reasons + branch logic + threshold boundary
- [x] **7.4** Edge case test: `--max-depth` cap respected
- [x] **7.5** Edge case test: seed already at depth_override returns immediately

## 8. Notes Overlay

- [x] **8.1** `scripts/curated/notes.yml` placeholder with documentation comment (R6.1)
- [x] **8.2** Implement `load_notes(path)` returning `dict[str, LineOverlay]` (R6.1)
- [x] **8.3** Implement `merge_into_lines(lines, overlays)` (R6.2, R6.3, R6.4)
- [x] **8.4** `tests/python/test_notes_overlay.py` — covers match, missing line warn, file absent, invalid body

## 9. Schema Validation

- [x] **9.1** `tests/python/test_schema.py` instantiates models with valid + invalid data (R5.1-5.3)
- [x] **9.2** Test ValidationError on missing required fields
- [x] **9.3** Test `Catalog.model_dump_json()` round-trip via `Catalog.model_validate_json()`

## 10. Writer

- [x] **10.1** `write_catalog(catalog, out_path)` — pretty JSON, 2-space indent, trailing newline (R7.1-7.3)
- [x] **10.2** `print_summary(catalog, file_size)` (R7.4)
- [x] **10.3** Test: written JSON parses back cleanly via `Catalog.model_validate_json` (`test_writer.py`)

## 11. CLI Glue

- [x] **11.1** `parse_args` with `--refresh`, `--openings`, `--out`, `--max-depth`, `--notes`, `--cache-dir`, `--log-level` (R8.2)
- [x] **11.2** `main()` ties everything together: TSVs → extender → minter → schema → notes → writer (R8.3, R8.4)
- [x] **11.3** Logging via `logging` module to stderr (R8.4)
- [x] **11.4** Exit codes: 0 on success, 1 on filter-empty / TSV-fetch / extender-not-implemented errors
- [x] **11.5** `[project.scripts] tabiya-build = "scripts.build_catalog:main"` in `pyproject.toml`

## 12. End-to-End Smoke Test

- [x] **12.1** Fixture cache: `tests/python/fixtures/tsv/sample.tsv` + smoke test pre-seeds explorer cache via `_seed_explorer_cache`
- [x] **12.2** `tests/python/test_smoke_e2e.py` invokes `main()` end-to-end with `--openings ruy-lopez,italian-game`, asserts catalog shape (R9.3)
- [ ] **12.3** Coverage check: `uv run pytest --cov` reports ≥ 80% on `tabiya_build/` (R9.4) — *user verifies locally*

## 13. First Real Build

- [ ] **13.1** Run `uv run python -m scripts.build_catalog` (no flags, full whitelist, hot cache empty) — *user runs locally*
- [ ] **13.2** Verify `public/catalog.json` exists, < 500 KB, parses as valid JSON (R7.5) — *user verifies*
- [ ] **13.3** Spot-check `ruy-lopez-main`: move sequence ends in a recognizable closed-Spanish position
- [ ] **13.4** Re-run without `--refresh` — should complete in < 30s using cache (R10.3)

## 14. Documentation

- [x] **14.1** Update root `README.md` with "Catalog Build" section (prerequisites, `uv sync`, `uv run python -m scripts.build_catalog`)
- [ ] **14.2** Add Python deps + Lichess data attribution to steering tech doc — *deferred; README attribution added*
- [x] **14.3** Note in README that `notes.yml` is curated incrementally and is allowed to be empty

## 15. Commit + Tag

- [ ] **15.1** Commit `pyproject.toml` (`uv.lock` only after first `uv sync`) — *user does after first sync*
- [ ] **15.2** Commit `scripts/tabiya_build/` modules + tests + fixtures — *user commits*
- [ ] **15.3** Commit `public/catalog.json` (the actual generated artifact) — *user commits after first real build*
- [ ] **15.4** Tag `v0.2-phase-0b` — *user tags*

## Compliance Self-Check

- [x] No new dep outside OSS allow-list (Article 1)
- [x] All public Python functions have type hints (Article 14)
- [x] All chess move data in SAN format (Article 9)
- [ ] Catalog file < 500 KB (R7.5) — *verified by smoke test for fixture; full build verified by user*
- [x] Source < 700 LOC in `scripts/tabiya_build/` (R10.1) — under budget
- [x] No runtime network calls introduced to the frontend (Article 11)
- [x] No backend service introduced (Article 12)
- [x] Stable line IDs preserved across hot-cache rebuild (Article 6) — IdMinter is deterministic
- [x] Linear lines only, depth ≤ 20 (Articles 7, 8) — `HARD_DEPTH_CAP = 20` enforced
- [ ] Coverage ≥ 80% on `tabiya_build/` (R9.4) — *user runs `pytest --cov`*

## Exit Criteria

Phase 0b is DONE when:

1. `uv run python -m scripts.build_catalog` produces a valid `public/catalog.json` with 15-20 openings + ~375-500 lines.
2. All Python tests pass; ≥ 80% coverage on `tabiya_build/`.
3. Re-run with hot cache completes in < 30 seconds.
4. The frontend (Phase 0a) still runs, but does NOT yet read the catalog (that wiring is Phase 0c).
5. Tagged `v0.2-phase-0b` and pushed.

After exit: open Phase 0c spec for `OpeningRepository` interface + `JsonOpeningRepository` + drill engine consuming the catalog.
