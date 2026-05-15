# Tasks: Phase 2 — Pattern Visualization

Implementation plan for Phase 2 (Pattern Visualization). Spec splits into **2a** (offline content pipeline, Python) and **2b** (browser UI, TypeScript). The 2a → 2b gate is the ≥30-opening curated-content threshold (R9.1) plus a passing license audit, FEN-hash parity test, and determinism test (Phase 7 gates).

Each task is independently dispatchable to an implementation agent. Tasks declare their `BlockedBy` predecessors so the dependency graph below can be walked breadth-first to maximize parallelism.

References:
- Requirements: `specs/phase-2-pattern-viz/requirements.md` (R1–R9)
- Design: `specs/phase-2-pattern-viz/design.md` (2a.1–2a.6, 2b.1–2b.5)
- Constitution: `specs/constitution.md` (Articles 1, 3, 6, 7, 11, 13, 14, 15)

---

## Implementation Tasks

### Phase 1: Source adapter scaffolding (2a foundation)

- [ ] **Task 1.1**: SourceAdapter Protocol + ProseChunk model
  - **ID**: `task-1.1`
  - **BlockedBy**: `none`
  - **Agent**: `architect`
  - **File**: `scripts/key_squares/adapters/base.py`
  - **Change**: Create `SourceAdapter` Protocol with `name`, `license`, `base_url` attrs and `discover(opening_slug, opening_name) -> list[str]`, `fetch(url) -> ProseChunk | None` methods. Define `ProseChunk` Pydantic model (`source_url: HttpUrl`, `license: str` SPDX, `text: str`). Export `PERMISSIVE_SPDX` constant set.
  - **Outcome**: Adapter contract is the only seam between scrape driver and source-specific code; new sources are one new file.
  - **Context**: R1.2, design §2a.1 "Adapter Protocol"; Article 14 (type hints + Pydantic).

- [ ] **Task 1.2**: `sources.yml` whitelist + license register
  - **ID**: `task-1.2`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `scripts/key_squares/sources.yml`
  - **Change**: Author whitelist with two initial entries — `wikipedia-en` (CC-BY-SA-4.0) and `lichess-opening-explorer` (ODbL-1.0). Each entry declares `id`, `license`, `base_url`, `adapter`, `url_pattern`, `selector` (if HTML), `rate_limit_rps`.
  - **Outcome**: Single source of truth for permissible scrape targets; consumed by scrape driver + license audit.
  - **Context**: R1.2, R9.2, design §2a.1 "sources.yml schema"; Article 1.

- [ ] **Task 1.3**: robots.txt cache + check
  - **ID**: `task-1.3`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/lib/robots.py`
  - **Change**: Implement `robots_allows(url: str) -> bool` with a per-host `RobotFileParser` cache. Malformed robots → conservative deny. TTL: process lifetime (CLI run).
  - **Outcome**: Adapter cannot bypass robots; check lives in driver, not adapter.
  - **Context**: R1.3, design §2a.1 "Scrape driver flow"; test: `tests/key_squares/test_robots.py`.

- [ ] **Task 1.4**: Token-bucket rate limiter per host
  - **ID**: `task-1.4`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/lib/ratelimit.py`
  - **Change**: Implement `wait(host: str)` token-bucket throttle, default ≤1 req/sec/host configurable from `sources.yml` `rate_limit_rps`. Clock-injectable for tests.
  - **Outcome**: Rate limit enforced at driver level; safe for parallel sources.
  - **Context**: R1.3, design §2a.1; test: `tests/key_squares/test_ratelimit.py` (clock-mocked).

- [ ] **Task 1.5**: Wikipedia adapter
  - **ID**: `task-1.5`
  - **BlockedBy**: `task-1.1`, `task-1.2`
  - **Agent**: `general-purpose`
  - **File**: `scripts/key_squares/adapters/wikipedia.py`
  - **Change**: Implement `WikipediaAdapter` conforming to `SourceAdapter`. `discover()` derives Wikipedia URL from `opening_name`; `fetch()` pulls via `requests`, parses with `BeautifulSoup` using the `selector` from sources.yml, returns `ProseChunk` with `license="CC-BY-SA-4.0"`. None on 404 / disambiguation page heuristic.
  - **Outcome**: First production source; targets Wikipedia chess opening articles.
  - **Context**: R1.2, R1.4, design §2a.1; test: `tests/key_squares/test_adapters.py` (mock HTTP).

- [ ] **Task 1.6**: Lichess Explorer adapter
  - **ID**: `task-1.6`
  - **BlockedBy**: `task-1.1`, `task-1.2`
  - **Agent**: `general-purpose`
  - **File**: `scripts/key_squares/adapters/lichess_explorer.py`
  - **Change**: Implement `LichessExplorerAdapter`. `discover()` uses `fen_after_main_line` from the opening record. `fetch()` consumes the JSON API, extracts opening name + commentary text (where present), returns `ProseChunk` with `license="ODbL-1.0"`.
  - **Outcome**: Second source; covers openings Wikipedia handles thinly.
  - **Context**: R1.2, R1.4, design §2a.1.

- [ ] **Task 1.7**: Scrape driver entry point
  - **ID**: `task-1.7`
  - **BlockedBy**: `task-1.3`, `task-1.4`, `task-1.5`, `task-1.6`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/scrape.py`
  - **Change**: Implement `main(openings, force=False)` driver: loads `sources.yml`, dispatches to adapters, applies robots + rate limit, filters non-permissive licenses (skip + log, never abort per R1.5), writes `data/key_squares/scraped/<opening_slug>.json` per schema in design §2a.1. Idempotent re-run overwrites.
  - **Outcome**: One CLI command produces normalized prose records for the full opening set.
  - **Context**: R1.1, R1.4, R1.5, R1.6, design §2a.1 "Scrape driver flow"; Article 11 (offline build).

- [ ] **Task 1.8**: Scrape adapter + driver tests
  - **ID**: `task-1.8`
  - **BlockedBy**: `task-1.7`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/key_squares/test_adapters.py`, `tests/key_squares/test_robots.py`, `tests/key_squares/test_ratelimit.py`
  - **Change**: Adapter tests use `responses`/`httpx_mock` to stub HTTP; assert URL discovery shape, chunk extraction shape, license stamp. Robots test: allow/deny/malformed paths. Ratelimit test: clock-mocked, asserts ≤1 req/sec/host.
  - **Outcome**: Pipeline scaffolding is unit-tested before extractor lands.
  - **Context**: R9.5 implicit via test plan in design "Test plan §2a"; coverage ≥80%.

### Phase 2: Prose normalization

- [ ] **Task 2.1**: Inline normalization helpers
  - **ID**: `task-2.1`
  - **BlockedBy**: `task-1.7`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/scrape.py` (inline) + `scripts/key_squares/lib/normalize.py` (new)
  - **Change**: Add `normalize_chunk(raw_text: str) -> str` that strips HTML/wiki markup (uses `mwparserfromhell` for Wikipedia inputs, plain BeautifulSoup elsewhere), collapses whitespace, drops captions/cells <40 chars, truncates per-chunk to 4000 chars. Apply per-opening cap of 12000 chars total (oldest-first wins).
  - **Outcome**: LLM prompt input is bounded and clean; reduces token spend + hallucination risk.
  - **Context**: Design §2a.2 "Normalization"; no dedup across sources (extractor handles).

- [ ] **Task 2.2**: Normalization tests
  - **ID**: `task-2.2`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/key_squares/test_normalize.py`
  - **Change**: Fixtures: wiki-markup string, HTML string, short-caption string. Assert markup stripped, <40-char chunks dropped, 4000-char per-chunk cap, 12000-char per-opening cap (oldest-first ordering preserved).
  - **Outcome**: Normalization regressions caught before they corrupt extractor inputs.
  - **Context**: Design §2a.2.

### Phase 3: LLM extractor

- [ ] **Task 3.1**: Few-shot exemplar corpus
  - **ID**: `task-3.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `scripts/key_squares/prompts/few_shot.yml`
  - **Change**: Hand-author 5 exemplars (`italian-game-main`, `ruy-lopez-closed-main`, `queens-gambit-declined-main`, `sicilian-najdorf-main`, `kings-indian-mainline`) — each with `opening_slug`, `opening_name`, `fen_canonical`, `prose` excerpt, and 2-3 output `KeySquareDraft` entries covering all four roles (`outpost`, `control`, `tension`, `weak`).
  - **Outcome**: Few-shot grounding for LLM extraction; covers role taxonomy.
  - **Context**: R2.4, design §2a.3 "Few-shot exemplar schema"; OQ2 lean (5 exemplars).

- [ ] **Task 3.2**: KeySquareDraft + ExtractionResult Pydantic models
  - **ID**: `task-3.2`
  - **BlockedBy**: `none`
  - **Agent**: `architect`
  - **File**: `scripts/key_squares/extract.py` (models top of file)
  - **Change**: Define `KeySquareDraft` (`square: str` regex `^[a-h][1-8]$`, `role: Literal[...]`, `for_color: Literal[white,black]`, `rationale: str` max 280, `source_url: str`) and `ExtractionResult` wrapping `drafts: list[KeySquareDraft]`. Both Pydantic v2.
  - **Outcome**: Strict validation at API boundary; invalid drafts dropped, not surfaced.
  - **Context**: R2.3, R2.5, R2.6, design §2a.3.

- [ ] **Task 3.3**: Prompt template builder
  - **ID**: `task-3.3`
  - **BlockedBy**: `task-3.1`, `task-3.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/extract.py` (`build_prompt` function)
  - **Change**: Implement `SYSTEM_PROMPT` constant (role definition + JSON-only output contract + role taxonomy reference) and `build_prompt(record) -> str` per design §2a.3 "Prompt template structure". Concatenates prose chunks with `[Source: <url>]` prefix, inlines 5 exemplars from `few_shot.yml`, emits the task instruction.
  - **Outcome**: Single prompt builder; tunable by editing `few_shot.yml` (data-only, no code change).
  - **Context**: R2.4, design §2a.3.

- [ ] **Task 3.4**: Anthropic SDK extraction call + retry
  - **ID**: `task-3.4`
  - **BlockedBy**: `task-3.3`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/extract.py` (`extract_for_opening` function)
  - **Change**: Implement `extract_for_opening(record, client) -> list[KeySquareDraft]`. Use `anthropic.Anthropic` directly — NO LangChain or wrapper (Article 3). Call `client.messages.create(model="claude-sonnet-4-7", max_tokens=2000, system=SYSTEM_PROMPT, messages=[...])`. Parse JSON from response text, validate with `ExtractionResult.model_validate`. Retry on `RateLimitError`/`APIStatusError` with exponential backoff (1s, 2s, 4s, max 3 attempts). On `JSONDecodeError`/`ValidationError`: log + return `[]` (R2.6 drop).
  - **Outcome**: Direct SDK use; defensive against transient API errors; never surfaces malformed drafts.
  - **Context**: R2.2, R2.3, R2.5, R2.6, design §2a.3; Article 3 (no orchestration framework).

- [ ] **Task 3.5**: Pending YAML writer + extractor CLI
  - **ID**: `task-3.5`
  - **BlockedBy**: `task-3.4`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/extract.py` (`main` + writer)
  - **Change**: Implement `main(opening_slugs: list[str] | None)`: reads `data/key_squares/scraped/<slug>.json`, calls `extract_for_opening`, writes `data/key_squares/pending/<slug>.yml` per design §2a.3 "Pending file" schema (includes `opening_slug`, `opening_name`, `fen_canonical`, `extracted_at`, `drafts: [...]`). Overwrites on re-run (R2.8).
  - **Outcome**: One CLI step produces the human-review queue.
  - **Context**: R2.1, R2.7, R2.8.

- [ ] **Task 3.6**: Extractor tests (mocked SDK)
  - **ID**: `task-3.6`
  - **BlockedBy**: `task-3.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/key_squares/test_extract.py`
  - **Change**: Mock Anthropic client. Cases: valid JSON → drafts returned; JSON with one invalid draft (bad square) → invalid dropped, others returned; full JSON parse error → `[]`; rate-limit error → retry with backoff 1s/2s/4s then succeed on attempt 3 → returns drafts; all retries fail → `[]`.
  - **Outcome**: Extractor failure modes covered; backoff timing asserted via clock mock.
  - **Context**: R2.5, R2.6, design test plan §2a.

### Phase 4: Review CLI

- [ ] **Task 4.1**: python-chess unicode board renderer with role colors
  - **ID**: `task-4.1`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/review.py` (`render_with_highlights` function)
  - **Change**: Implement `render_with_highlights(board: chess.Board, drafts: list[KeySquareDraft]) -> str` using `chess.Board.unicode()` augmented with ANSI 256-color backgrounds per role (`outpost`→green, `control`→blue, `tension`→amber, `weak`→red). Plain-ASCII fallback (bracket markers around marked squares) when `TERM` doesn't support color.
  - **Outcome**: Reviewer sees the board with role-colored squares directly in terminal; zero new deps beyond `python-chess`.
  - **Context**: R3.3, design §2a.4 "Rendering approach".

- [ ] **Task 4.2**: Resumable review state file
  - **ID**: `task-4.2`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/review.py` (`load_state`, `save_state`, `ReviewState` model)
  - **Change**: Implement `.review_state.json` load/save with `completed: list[str]` (file paths) + `partial: dict[path, list[Decision]]`. `Decision` is a discriminated union (`Accept(draft)`, `Reject(draft, note)`, `Skip(draft)`). Save after every per-draft decision.
  - **Outcome**: Quit-and-resume works mid-opening.
  - **Context**: R3.8, design §2a.4 "Resumability".

- [ ] **Task 4.3**: Review loop + interactive prompt
  - **ID**: `task-4.3`
  - **BlockedBy**: `task-4.1`, `task-4.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/review.py` (`main`)
  - **Change**: Iterate `data/key_squares/pending/*.yml`. For each opening: render board, for each draft print rationale + source_url + prompt `[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit`. Implement `edit_inline(draft)` with per-field prompts (default = current value, Pydantic re-validation on submit). On `q` save state and exit.
  - **Outcome**: Throughput target ~1 minute per opening; no missed decisions.
  - **Context**: R3.2, R3.4, R3.5, design §2a.4 "Review loop".

- [ ] **Task 4.4**: Commit step writes curated.yml + rejected/<slug>.yml
  - **ID**: `task-4.4`
  - **BlockedBy**: `task-4.3`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/key_squares/review.py` (`commit_decisions`)
  - **Change**: Append accepted drafts to `scripts/curated/key_squares.yml` under the opening slug (creates entry if absent; preserves YAML ordering). Append rejects to `data/key_squares/rejected/<slug>.yml` with reviewer free-text note. Skips remain in pending (no-op). Curated YAML is the only artifact downstream consumers read (R3.9).
  - **Outcome**: Single-file output contract; rejected corpus tracked for prompt tuning.
  - **Context**: R3.6, R3.7, R3.9, design §2a.4 "Commit step".

- [ ] **Task 4.5**: Review CLI tests (stub stdin)
  - **ID**: `task-4.5`
  - **BlockedBy**: `task-4.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/key_squares/test_review.py`
  - **Change**: Non-interactive tests feed a stub stdin sequence. Cases: accept-all → curated.yml populated; reject-with-note → rejected/<slug>.yml populated; quit mid-opening → state file shows `partial`, re-run resumes from saved index; edit flow validates Pydantic on submit.
  - **Outcome**: Review CLI is regression-tested end-to-end without a human.
  - **Context**: R9.3 schema validation, design test plan §2a.

### Phase 5: Curated schema + catalog build integration

- [ ] **Task 5.1**: KeySquareRecord + OpeningKeySquares Pydantic models
  - **ID**: `task-5.1`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `architect`
  - **File**: `scripts/tabiya_build/key_squares.py`
  - **Change**: Define `KeySquareRecord` (`square`, `role` Literal, `for_color` Literal, `rationale`, `source_url`) and `OpeningKeySquares` (`fen_canonical`, `squares: list[KeySquareRecord]`). Implement `load_curated_key_squares(path) -> dict[str, OpeningKeySquares]` with Pydantic validation; build fails on malformed entries.
  - **Outcome**: Schema validation is the build's first line of defense.
  - **Context**: R4.1, R4.2, design §2a.5.

- [ ] **Task 5.2**: License audit at build time
  - **ID**: `task-5.2`
  - **BlockedBy**: `task-5.1`, `task-1.2`
  - **Agent**: `security-reviewer`
  - **File**: `scripts/tabiya_build/key_squares.py` (`license_audit` function)
  - **Change**: Implement `license_audit(curated, sources_yml_path)`. Build a set of permissive hosts from `sources.yml`. For each `source_url` in curated data: extract host, fail build with explicit error if host not in permissive set.
  - **Outcome**: Article 1 enforced at build; no untracked source ever ships.
  - **Context**: R9.2, design §2a.5; Article 1.

- [ ] **Task 5.3**: Join curated key_squares onto Opening records
  - **ID**: `task-5.3`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/tabiya_build/key_squares.py` (`join_to_openings`)
  - **Change**: Implement `join_to_openings(openings, curated)`. Unknown `opening_slug` in curated → `BuildError`. Known slug → attach `key_squares` list to opening (additive). Openings without curated entry remain `key_squares=None`.
  - **Outcome**: Article 6 stable-slug join; build fails loud on unknown openings.
  - **Context**: R4.3, R4.4, R4.6, design §2a.5; Article 6.

- [ ] **Task 5.4**: Wire build orchestration in `build_catalog.py`
  - **ID**: `task-5.4`
  - **BlockedBy**: `task-5.2`, `task-5.3`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/build_catalog.py`
  - **Change**: Insert calls in order: `load_curated_key_squares` → `license_audit` → `join_to_openings`. Bump `catalog.schema_version`. Emit `public/catalog.json` with `key_squares` field on Openings (additive). Existing consumers unaffected.
  - **Outcome**: Single command (`python -m scripts.build_catalog`) produces a catalog with key_squares.
  - **Context**: R4.4, R4.5, design §2a.5.

- [ ] **Task 5.5**: Catalog build tests
  - **ID**: `task-5.5`
  - **BlockedBy**: `task-5.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/build/test_key_squares_join.py`, `tests/build/test_license_audit.py`
  - **Change**: Join tests: unknown slug → build fails with clear error; valid slug → opening gets key_squares list; absent slug → opening.key_squares is None. Audit tests: unaudited host → build fails; all-permissive → passes; missing sources.yml entry → fails.
  - **Outcome**: Build-level invariants tested independently of pipeline runs.
  - **Context**: R9.2, R9.3, design test plan §2a.

### Phase 6: Transposition index + FEN-hash sidecar

- [ ] **Task 6.1**: FEN normalization + 16-char SHA1 hash (Python)
  - **ID**: `task-6.1`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/tabiya_build/transposition.py`
  - **Change**: Implement `normalize_fen(fen) -> str` (keep parts [0..3]: placement, side, castling, ep-target; drop halfmove + fullmove counters) and `fen_hash(fen) -> str` (SHA-1 of normalized FEN, first 16 hex chars).
  - **Outcome**: Hash function lives in one Python place; mirrored by TS in Phase 7 parity test.
  - **Context**: R5.2, design §2a.6 "Algorithm".

- [ ] **Task 6.2**: Build transposition index
  - **ID**: `task-6.2`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/tabiya_build/transposition.py` (`build_transposition_index`)
  - **Change**: Implement `build_transposition_index(lines) -> dict[str, list[str]]`. For each line, replay SAN moves, hash each position, accumulate `Map<fen_hash, Set<lineId>>`. Drop singletons (`len < 2`). Sort line IDs within each entry (determinism, R5.5). Sort top-level keys on serialization.
  - **Outcome**: Deterministic index; only meaningful transpositions retained.
  - **Context**: R5.1, R5.3, R5.5, R5.6, design §2a.6.

- [ ] **Task 6.3**: Sidecar JSON writer
  - **ID**: `task-6.3`
  - **BlockedBy**: `task-6.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/build_catalog.py` (transposition emit step)
  - **Change**: After `join_to_openings`, call `build_transposition_index(lines)`. Write `public/transpositions.json` with shape `{schema_version, generated_at, fen_hash_algo: "sha1-16", fen_normalization: "drop-counters", index: {...}}`. Use `json.dumps(..., sort_keys=True, indent=2)`.
  - **Outcome**: Frontend can lazy-load index from a stable, small sidecar.
  - **Context**: R5.4, design §2a.6 "Storage decision: sidecar JSON".

- [ ] **Task 6.4**: Determinism + correctness tests
  - **ID**: `task-6.4`
  - **BlockedBy**: `task-6.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/build/test_transposition.py`
  - **Change**: Determinism test: build index twice on identical input, compare bytes (excluding `generated_at` field). FEN normalization: assert two FENs differing only in halfmove counter hash equal. Singleton omission: position appearing in 1 line absent from index. Correctness fixture: 2 lines sharing a known position → entry contains both lineIds, sorted.
  - **Outcome**: R5.5 byte-equality contract enforced.
  - **Context**: R5.5, R5.6, R9.4, design test plan §2a.

### Phase 7: 2a quality gates (2a → 2b unlock)

- [ ] **Task 7.1**: ≥30 openings approved gate check
  - **ID**: `task-7.1`
  - **BlockedBy**: `task-4.4`, `task-5.4`
  - **Agent**: `general-purpose`
  - **File**: `scripts/key_squares/gate_check.py` (new)
  - **Change**: Implement CLI that loads `scripts/curated/key_squares.yml`, counts top-level entries (= reviewed-and-approved openings), exits non-zero if `< 30` with explicit message. Wired as a pre-merge check for 2b PRs.
  - **Outcome**: 2b UI cannot ship until content threshold met (R9.1).
  - **Context**: R9.1, design "Phase 2a gate for 2b unlock".

- [ ] **Task 7.2**: FEN-hash Python ⇄ TypeScript parity fixture
  - **ID**: `task-7.2`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/fixtures/fen_hash_parity.json` (new) + `tests/build/test_transposition.py` (extend) + (later) `tests/chess/fen-hash.test.ts`
  - **Change**: Author a JSON fixture with 5 FENs and their expected `normalize_fen` + `fen_hash` outputs (generated by Python). Python test asserts `fen_hash(fen) == expected`. The same fixture is consumed by the TS test in Phase 8 → contract test guarantees parity.
  - **Outcome**: Cross-language hash drift caught immediately.
  - **Context**: R9.4, design §2b.4 "FEN normalization in browser".

- [ ] **Task 7.3**: License audit smoke run
  - **ID**: `task-7.3`
  - **BlockedBy**: `task-5.2`
  - **Agent**: `security-reviewer`
  - **File**: `tests/build/test_license_audit_smoke.py` (new)
  - **Change**: Test loads real `scripts/curated/key_squares.yml` + real `scripts/key_squares/sources.yml`; asserts `license_audit` passes. Acts as a tripwire if a reviewer somehow lands an unaudited source_url.
  - **Outcome**: Continuous Article 1 enforcement against the live curated corpus.
  - **Context**: R9.2; Article 1.

- [ ] **Task 7.4**: `tech.md` source whitelist addendum
  - **ID**: `task-7.4`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `general-purpose`
  - **File**: `tech.md`
  - **Change**: Append "Scrape source whitelist" section listing each `sources.yml` entry with its SPDX license and rationale. Note future-source-addition checklist (license review → entry in sources.yml → re-run audit).
  - **Outcome**: Article 1 source register has a human-readable index.
  - **Context**: R1.7, R9.2; Article 1, Article 14.

---

### Phase 8: HighlightLayer primitive (2b foundation, Article 15 coordination)

> **Gate**: All of Phase 7 must pass before Phase 8+ begin.

- [ ] **Task 8.1**: Discriminated `HighlightMode` type + `Square` template-literal type
  - **ID**: `task-8.1`
  - **BlockedBy**: `task-7.1`, `task-7.2`, `task-7.3`
  - **Agent**: `api-designer`
  - **File**: `src/components/board/HighlightLayer.tsx` (types section) + `src/types/board.ts`
  - **Change**: Define `Square = ${'a'..'h'}${1..8}` template-literal type. Define `HighlightMode = {kind:'bright',squares:BrightHighlight[]} | {kind:'spotlight',squares:SpotlightHighlight[]} | {kind:'none'}`. Define `BrightHighlight` (Phase 1b shape: square/color/tooltip) and `SpotlightHighlight` (square/role/tooltip/forColor). Coordinate with Phase 1b: if 1b shipped first, extend its `HighlightMode`; if 2b first, ship full union.
  - **Outcome**: One discriminated-union API used by both Explain Mode and Pattern Viz; Article 15 contract codified.
  - **Context**: R6.1, design §2b.1 "HighlightLayer API"; Article 15.

- [ ] **Task 8.2**: HighlightLayer `bright` branch
  - **ID**: `task-8.2`
  - **BlockedBy**: `task-8.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/board/HighlightLayer.tsx`
  - **Change**: Implement render branch for `mode.kind === 'bright'`: per-square colored translucent `<rect>` overlays on an SVG layer matched to board coordinates. Uses `boardOrientation` + `squarePx` props to compute x/y. (If Phase 1b already shipped this branch, this task is a no-op — verify and document.)
  - **Outcome**: Phase 1b Explain Mode highlights render through the shared primitive.
  - **Context**: Article 15; consumed by Phase 1b Explain Mode.

- [ ] **Task 8.3**: HighlightLayer `spotlight` branch (mask + glow filters)
  - **ID**: `task-8.3`
  - **BlockedBy**: `task-8.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/board/HighlightLayer.tsx`
  - **Change**: Implement render branch for `mode.kind === 'spotlight'`: SVG `<defs>` with `<mask>` (full-board white rect, black rounded `<rect>` cutouts per key square) + per-role `<filter>` glow (`feGaussianBlur` + `feMerge`). Render a single dim `<rect fill="rgba(0,0,0,0.62)" mask="url(#spotlight-mask)" />` plus per-cutout glow rings (`<rect>` with `stroke=ROLE_COLOR[role]` + `filter=url(#glow-<role>)`). Outer `<svg pointer-events="none">`; glow rects opt-in to `pointer-events="auto"` for hover, but bind no `onClick` → clicks fall through to the board (R6.5).
  - **Outcome**: Spotlight visual (dark board, bright spotlit squares) per `chessViz` reference; non-blocking input.
  - **Context**: R6.1, R6.2, R6.3, R6.5, design §2b.2 "SVG strategy".

- [ ] **Task 8.4**: HighlightLayer `none` branch + role color map
  - **ID**: `task-8.4`
  - **BlockedBy**: `task-8.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/board/HighlightLayer.tsx`
  - **Change**: Implement `mode.kind === 'none'` → return null (R6.6 graceful degrade). Export `ROLE_COLOR = { outpost:'#22c55e', control:'#3b82f6', tension:'#f59e0b', weak:'#ef4444' }` (Tailwind 500-shade tokens; align with existing `theme/`).
  - **Outcome**: Graceful-degrade default + central color source.
  - **Context**: R6.3, R6.6, design §2b.2.

- [ ] **Task 8.5**: Shared HighlightTooltip subcomponent
  - **ID**: `task-8.5`
  - **BlockedBy**: `task-8.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/board/HighlightTooltip.tsx`
  - **Change**: Implement reusable tooltip positioned relative to a square coordinate. Props: `square: Square`, `text: string`, `forColor?: 'white'|'black'`. Used by both `bright` (Phase 1b) and `spotlight` (Phase 2b) on hover. Article 15 explicitly covers the tooltip primitive too.
  - **Outcome**: One tooltip implementation, two consumers; eliminates fork risk.
  - **Context**: R6.4, design §2b.1; Article 15.

- [ ] **Task 8.6**: HighlightLayer component tests
  - **ID**: `task-8.6`
  - **BlockedBy**: `task-8.2`, `task-8.3`, `task-8.4`, `task-8.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/components/HighlightLayer.test.tsx`
  - **Change**: Tests: `mode.kind='bright'` renders one `<rect>` per highlight with expected color; `'spotlight'` renders mask + per-cutout rects + per-role filters; `'none'` returns null; tooltip renders on hover for both modes; click fall-through verified (parent `<div>` onClick fires when overlay clicked).
  - **Outcome**: Article 15 contract test: both consumers exercise the primitive's full surface.
  - **Context**: R9.5, design test plan §2b "Component".

### Phase 9: SpotlightOverlay component

- [ ] **Task 9.1**: SpotlightOverlay thin adapter
  - **ID**: `task-9.1`
  - **BlockedBy**: `task-8.6`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/board/SpotlightOverlay.tsx`
  - **Change**: Implement `<SpotlightOverlay keySquares boardOrientation squarePx />`. If `!keySquares || keySquares.length === 0` → return null (R6.6). Else map `KeySquareRecord[]` → `SpotlightHighlight[]` and render `<HighlightLayer mode={{kind:'spotlight', squares: highlights}} ... />`.
  - **Outcome**: Pattern Viz consumer of the primitive; ≤30 LOC.
  - **Context**: R6.1, R6.6, design §2b.2 "SpotlightOverlay component"; Article 15.

- [ ] **Task 9.2**: SpotlightOverlay tests
  - **ID**: `task-9.2`
  - **BlockedBy**: `task-9.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/components/SpotlightOverlay.test.tsx`
  - **Change**: Tests: all 4 role colors render correct stroke; no-data (`undefined` and `[]`) → returns null; click fall-through verified (spy on a sibling `onClick`); tooltip text matches `rationale`; `forColor` surfaced in tooltip.
  - **Outcome**: R6 acceptance criteria all asserted.
  - **Context**: R6.3, R6.4, R6.5, R6.6, design test plan §2b.

### Phase 10: useKeySquareOverlay hook

- [ ] **Task 10.1**: useLocalStorageBool helper (if missing)
  - **ID**: `task-10.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/hooks/useLocalStorageBool.ts`
  - **Change**: Implement `useLocalStorageBool(key: string, defaultValue: boolean): [boolean, (v: boolean) => void]`. JSON-stringify booleans for storage; ignore parse errors → fall back to default. (Skip if a Phase 1b equivalent already exists; consume it instead.)
  - **Outcome**: Reusable persistence helper; matches the Phase 1b mode-persistence convention.
  - **Context**: R7.2, design §2b.3.

- [ ] **Task 10.2**: useKeySquareOverlay hook
  - **ID**: `task-10.2`
  - **BlockedBy**: `task-10.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useKeySquareOverlay.ts`
  - **Change**: Implement `useKeySquareOverlay(lineId, hasKeySquares, explainState) -> {visible, toggle, toggleDisabled, drillPreference}`. Storage key: `tabiya:linePrefs:${lineId}:keySquareOverlay`. `visible = hasKeySquares && (explainState === 'running' || drillPref)`. `toggleDisabled = !hasKeySquares`. Explain Mode force-on (R7.3) + restore on exit (R7.4) handled by reading `explainState` each render.
  - **Outcome**: Single source of truth for overlay visibility; DrillPage stays branchless.
  - **Context**: R7.1, R7.2, R7.3, R7.4, R7.5, design §2b.3.

- [ ] **Task 10.3**: useKeySquareOverlay tests
  - **ID**: `task-10.3`
  - **BlockedBy**: `task-10.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/hooks/useKeySquareOverlay.test.ts`
  - **Change**: Tests: toggle persists to localStorage with correct key; `explainState='running'` forces `visible=true` regardless of pref; flip back to `'off'` restores pref; `!hasKeySquares` → `toggleDisabled=true` and `visible=false`; per-line keys are independent (lineA on, lineB off).
  - **Outcome**: R7 acceptance criteria asserted.
  - **Context**: R7, design test plan §2b "Hook".

### Phase 11: Transposition banner + hook

- [ ] **Task 11.1**: TS FEN-hash mirror (parity with Python)
  - **ID**: `task-11.1`
  - **BlockedBy**: `task-7.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/chess/fen-hash.ts`
  - **Change**: Implement `normalizeFen(fen)` (split on space, slice 0..4, join) and `async fenHash(fen)` (Web Crypto `crypto.subtle.digest('SHA-1', utf8(normalized))` → first 16 hex chars). Must produce byte-identical output to the Python implementation on the Phase 7 fixture.
  - **Outcome**: Browser can hash positions deterministically; matches build-time index.
  - **Context**: R5.2, design §2b.4 "FEN normalization in browser".

- [ ] **Task 11.2**: TS ⇄ Python parity test
  - **ID**: `task-11.2`
  - **BlockedBy**: `task-11.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/chess/fen-hash.test.ts`
  - **Change**: Load `tests/fixtures/fen_hash_parity.json` (Phase 7 fixture). For each entry, assert `normalizeFen(fen) === expected.normalized` and `await fenHash(fen) === expected.hash`.
  - **Outcome**: Cross-language hash drift fails CI in both Python and TS suites.
  - **Context**: R9.4, design §2b.4.

- [ ] **Task 11.3**: Sidecar fetch + session cache
  - **ID**: `task-11.3`
  - **BlockedBy**: `task-6.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/transpositions.ts`
  - **Change**: Implement `getTranspositionIndex() -> Promise<TranspositionSidecar>`. Lazy-fetch `/transpositions.json` on first call, cache the result for the session. Assert `schema_version` matches the catalog's version; throw with a clear message on mismatch.
  - **Outcome**: One network/asset round-trip per session; Article 11 compliant (same-origin static asset).
  - **Context**: R5.4, design §2b.4 "Sidecar fetch"; Article 11.

- [ ] **Task 11.4**: useTransposition hook
  - **ID**: `task-11.4`
  - **BlockedBy**: `task-11.1`, `task-11.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useTransposition.ts`
  - **Change**: Implement `useTransposition(currentFen, currentPly, activeLineId, pickedLineIds) -> {matches, truncated}`. Suppress at ply 0 (R8.6). Suppress when `pickedLineIds.size === 0` (R8.7). Otherwise: fetch index, hash current FEN, look up entry, filter out `activeLineId`, intersect with `pickedLineIds`, sort, cap at 3, compute `truncated = max(0, len - 3)`. Resolve `lineId → displayName` from the catalog repo.
  - **Outcome**: One hook owns banner data logic; component stays presentational.
  - **Context**: R8.1, R8.3, R8.6, R8.7, design §2b.4.

- [ ] **Task 11.5**: useTransposition tests
  - **ID**: `task-11.5`
  - **BlockedBy**: `task-11.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/hooks/useTransposition.test.ts`
  - **Change**: Tests: ply 0 → empty; empty picks → empty; active line filtered out; ≥4 matches → 3 results + `truncated=1`; sort stable; index fetch error → empty + no throw.
  - **Outcome**: R8 logic invariants asserted independently of UI.
  - **Context**: R8, design test plan §2b.

- [ ] **Task 11.6**: TranspositionBanner component
  - **ID**: `task-11.6`
  - **BlockedBy**: `task-11.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/components/drill/TranspositionBanner.tsx`
  - **Change**: Implement presentational component. Props: `matches`, `truncatedCount`, `onJump`. Local `dismissed` state (per-session, not persisted). Renders chips with `displayName`, dismiss `×` button (R8.5), and `+N more` suffix when truncated. Returns null when dismissed or `matches.length === 0`. CSS: `max-lines: 3` defense-in-depth on chip overflow.
  - **Outcome**: Banner is a thin view; dismiss state local and ephemeral.
  - **Context**: R8.2, R8.3, R8.5, design §2b.4 "Component".

- [ ] **Task 11.7**: TranspositionBanner component tests
  - **ID**: `task-11.7`
  - **BlockedBy**: `task-11.6`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/components/TranspositionBanner.test.tsx`
  - **Change**: Tests: 0 matches → null; 2 matches → 2 chips, no `+more`; 5 matches passed in → 3 chips + `+2 more` (component does its own slice as defense in depth, OR asserts truncated prop flow); dismiss → null after click; chip onClick → onJump called with lineId.
  - **Outcome**: R8 UI surface asserted.
  - **Context**: R8.3, R8.5, design test plan §2b.

### Phase 12: Drill page header + Explain Mode wiring

- [ ] **Task 12.1**: Add catalog types: KeySquareRecord, Opening.key_squares, TranspositionIndex
  - **ID**: `task-12.1`
  - **BlockedBy**: `task-5.4`, `task-6.3`
  - **Agent**: `api-designer`
  - **File**: `src/types/catalog.ts`
  - **Change**: Add `KeySquareRecord` (square, role enum, for_color enum, rationale, source_url). Extend `Opening` with `key_squares?: KeySquareRecord[]` (additive optional). Add `TranspositionIndex = {schema_version, index: Record<string, string[]>}`. No `any`.
  - **Outcome**: Frontend type system reflects new catalog shape; build emits matching JSON.
  - **Context**: R4.4, design §2b.5; Article 14.

- [ ] **Task 12.2**: Drill page header toggle integration
  - **ID**: `task-12.2`
  - **BlockedBy**: `task-9.2`, `task-10.3`, `task-12.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/pages/DrillPage.tsx` (or `src/components/drill/DrillPage.tsx` per repo layout)
  - **Change**: Call `useKeySquareOverlay(activeLine.id, !!activeOpening.key_squares, explainState)`. Render `<ToggleButton onClick={toggle} active={drillPreference}>Key squares: {drillPreference ? 'on' : 'off'}</ToggleButton>` in the page header when `!toggleDisabled`. Mount `<SpotlightOverlay keySquares={activeOpening.key_squares} boardOrientation squarePx />` over the board when `visible`. Explain Mode integration is automatic via hook.
  - **Outcome**: User-facing toggle + automatic Explain forcing; no branching code in DrillPage.
  - **Context**: R7.1, R7.3, R7.4, design §2b.3 "Drill page header integration".

- [ ] **Task 12.3**: Drill page transposition banner mount
  - **ID**: `task-12.3`
  - **BlockedBy**: `task-11.7`, `task-12.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/pages/DrillPage.tsx`
  - **Change**: Compute `pickedLineIds` from current source (Phase 1.5 RepertoirePick if present, else Phase 1c preset's expanded line set, else empty Set). Call `useTransposition(currentFen, currentPly, activeLine.id, pickedLineIds)`. Mount `<TranspositionBanner matches={...} truncatedCount={truncated} onJump={(id) => navigate('/drill?line=' + id)} />` above the move-history rail. Render-guard: only when `explainState !== 'running'` (drill-only banner, OQ3 resolution).
  - **Outcome**: Banner appears at transposition points, never at ply 0, never in Explain Mode, never with empty repertoire.
  - **Context**: R8.1, R8.4, R8.5, R8.6, R8.7, design §2b.4 "Placement" + OQ3 resolution.

- [ ] **Task 12.4**: Integration tests — Pattern Viz + Transposition
  - **ID**: `task-12.4`
  - **BlockedBy**: `task-12.2`, `task-12.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/integration/test_pattern_viz.test.tsx`, `tests/integration/test_transposition_e2e.test.tsx`
  - **Change**: Pattern Viz test: open Drill on opening with key_squares; toggle off → no overlay; toggle on → overlay visible; enter Explain → overlay forced on; exit Explain → overlay restored. Transposition test: fixture catalog with 2 lines sharing ply-4 position; pick both into repertoire; drill line A to ply 4 → banner shows line B chip; click chip → navigates to `/drill?line=lineB`.
  - **Outcome**: End-to-end behavior of the two main user flows asserted.
  - **Context**: R7, R8, design test plan §2b "Integration".

### Phase 13: 2b quality gates

- [ ] **Task 13.1**: Build-size budget check (+6kB gzip cap)
  - **ID**: `task-13.1`
  - **BlockedBy**: `task-9.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/check_bundle_size.py` (or extend existing build size check) + CI config
  - **Change**: Measure gzipped size delta of `SpotlightOverlay` + role-color config + HighlightLayer spotlight branch combined. Fail build if delta > 6 kB. Implementation: stub bundle pre/post the spotlight code path or measure module size via `rollup-plugin-visualizer` output.
  - **Outcome**: R6.8 enforced in CI; visual feature stays cheap.
  - **Context**: R6.8.

- [ ] **Task 13.2**: No-regression check — Phase 1b Explain Mode
  - **ID**: `task-13.2`
  - **BlockedBy**: `task-8.6`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/integration/explain_mode_regression.test.tsx`
  - **Change**: Run existing Phase 1b Explain Mode integration tests against the shared `<HighlightLayer mode.kind='bright'>` route. Assert no behavior change vs. pre-Phase-2 baseline (snapshot or behavior assertions, not implementation snapshots).
  - **Outcome**: Article 15 single-primitive change does not break Phase 1b consumers.
  - **Context**: R9.8, design §2b.1 "Why one component, not two"; Article 15.

- [ ] **Task 13.3**: Type-discipline + lint pass on all new modules
  - **ID**: `task-13.3`
  - **BlockedBy**: `task-12.4`
  - **Agent**: `chief-programmer`
  - **File**: (all new files in `src/`, `scripts/key_squares/`, `scripts/tabiya_build/`)
  - **Change**: `npx tsc --noEmit` returns no NEW errors. `ruff check scripts/key_squares scripts/tabiya_build` passes. ESLint passes on `src/components/board/SpotlightOverlay.tsx`, `src/components/drill/TranspositionBanner.tsx`, `src/hooks/useKeySquareOverlay.ts`, `src/hooks/useTransposition.ts`, `src/chess/fen-hash.ts`, `src/storage/transpositions.ts`. No `any` without an inline justification comment.
  - **Outcome**: Article 14 enforced; merge-blocking.
  - **Context**: R9.9; Article 14.

- [ ] **Task 13.4**: Local-first audit
  - **ID**: `task-13.4`
  - **BlockedBy**: `task-12.4`
  - **Agent**: `security-reviewer`
  - **File**: (audit only)
  - **Change**: `grep -rn "fetch\|axios" src/hooks/useKeySquareOverlay.ts src/hooks/useTransposition.ts src/components/board/SpotlightOverlay.tsx src/components/drill/TranspositionBanner.tsx` → only `fetch('/transpositions.json')` (same-origin static asset) and `fetch('/catalog.json')` (existing) are present. No remote hosts referenced.
  - **Outcome**: Article 11 compliance verified at the code level.
  - **Context**: R9.10; Article 11.

---

## Dependency Diagram

```
                                        Phase 1: Source adapter scaffolding
                                        ─────────────────────────────────────
                          task-1.1 (Protocol) ─┬─────────────────────────────┐
                          task-1.2 (sources.yml)─┴─┬─ task-1.5 (Wikipedia) ──┤
                          task-1.3 (robots)        └─ task-1.6 (Lichess)  ───┤
                          task-1.4 (ratelimit)                               │
                                                                             ▼
                                                       task-1.7 (scrape driver)
                                                                             │
                                                                             ▼
                                                          task-1.8 (adapter tests)
                                                                             │
                                                Phase 2: Normalization      │
                                                ────────────────────────────│
                                                       task-2.1 (normalize) ◀┘
                                                            │
                                                            ▼
                                                       task-2.2 (norm tests)

  Phase 3: LLM extractor                                                    Phase 4: Review CLI
  ──────────────────────                                                    ────────────────────
  task-3.1 (few-shot) ─┐                                                   task-4.2 (state file)
  task-3.2 (models) ───┴── task-3.3 (prompt) ── task-3.4 (SDK call) ── task-3.5 (CLI/writer)
                                                                                │
                                                                                ▼
                                                                       task-3.6 (extractor tests)
                                                                                │
                                                                                ▼
                            task-3.2 ──────────────┐                  task-4.1 (board render)
                                                   │                          │
                                                   ▼                          ▼
                            Phase 5: Catalog build integration         task-4.3 (review loop)
                            ─────────────────────────────────                 │
                            task-5.1 (Pydantic models)                        ▼
                                       │                              task-4.4 (commit step)
                            ┌──────────┴──────────┐                           │
                            ▼                     ▼                           ▼
                  task-5.2 (license audit) ◀── task-1.2          task-4.5 (review tests)
                  task-5.3 (join)                                             │
                            └──────────┬──────────┘                           │
                                       ▼                                      │
                            task-5.4 (build_catalog wiring) ◀─────────────────┤
                                       │                                      │
                                       ▼                                      │
                            task-5.5 (build tests)                            │
                                                                              │
  Phase 6: Transposition index                                               │
  ────────────────────────────                                                │
  task-6.1 (FEN hash, py) ── task-6.2 (build index) ── task-6.3 (sidecar) ── task-6.4 (det tests)
                                                                              │
                                                                              ▼
                                  Phase 7: 2a quality gates ◀─────────────────┤
                                  ──────────────────────────                  │
                                  task-7.1 (30 openings)  ◀── task-4.4, task-5.4
                                  task-7.2 (parity fixture) ◀── task-6.1
                                  task-7.3 (license smoke) ◀── task-5.2
                                  task-7.4 (tech.md)        ◀── task-1.2
                                                                              │
                                                                              ▼
                                                                     [GATE: 2a → 2b]
                                                                              │
  Phase 8: HighlightLayer primitive (2b foundation)                          │
  ──────────────────────────────────────────────────                          │
                            task-8.1 (types) ◀── task-7.1, task-7.2, task-7.3
                                  │
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
              task-8.2        task-8.3        task-8.5
              (bright)        (spotlight)     (tooltip)
                  └───────────────┬───────────────┘
                                  ▼
                              task-8.4 (none + colors)
                                  │
                                  ▼
                              task-8.6 (HL tests)
                                  │
  Phase 9: SpotlightOverlay        │
  ────────────────────────         │
                              task-9.1 (overlay component)
                                  │
                                  ▼
                              task-9.2 (overlay tests)
                                  │
  Phase 10: useKeySquareOverlay    │           Phase 11: Transposition banner
  ────────────────────────────     │           ─────────────────────────────
  task-10.1 (lsBool helper)        │           task-11.1 (TS fen-hash) ◀── task-7.2
        │                          │                 │
        ▼                          │                 ▼
  task-10.2 (hook) ◀───────────────┤           task-11.2 (parity test)
        │                          │                 │
        ▼                          │                 │
  task-10.3 (hook tests)           │           task-11.3 (sidecar fetch) ◀── task-6.3
                                   │                 │
                                   │           task-11.4 (useTransposition) ◀── task-11.1
                                   │                 │
                                   │                 ▼
                                   │           task-11.5 (hook tests)
                                   │                 │
                                   │           task-11.6 (banner component) ◀── task-11.4
                                   │                 │
                                   │                 ▼
                                   │           task-11.7 (banner tests)
                                   │                 │
  Phase 12: DrillPage integration  │                 │
  ──────────────────────────────   │                 │
                              task-12.1 (catalog types) ◀── task-5.4, task-6.3
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                                 ▼
              task-12.2                        task-12.3
              (header toggle)                  (banner mount)
              ◀── task-9.2, task-10.3          ◀── task-11.7
                  └────────────────┬────────────────┘
                                   ▼
                              task-12.4 (integration tests)
                                   │
  Phase 13: 2b quality gates       │
  ─────────────────────────        │
                              task-13.1 (bundle size) ◀── task-9.2
                              task-13.2 (regression)  ◀── task-8.6
                              task-13.3 (type+lint)   ◀── task-12.4
                              task-13.4 (local-first) ◀── task-12.4
```

### Parallel opportunities

**Phase 1 (massive fan-out):** `task-1.1`, `task-1.2`, `task-1.3`, `task-1.4` all have no predecessors → 4 parallel agents. Then `task-1.5` and `task-1.6` run in parallel after their deps land.

**Phase 3 vs Phase 4:** `task-3.1` (few-shot) and `task-4.1` (board renderer) and `task-4.2` (state file) all start independently. Phase 3's chain and Phase 4's chain progress in parallel until they converge in Phase 5 (curated-yml dependency).

**Phase 5 vs Phase 6:** `task-5.1`/`task-5.2`/`task-5.3` (build join) and `task-6.1`/`task-6.2`/`task-6.3` (transposition) are independent chains that re-converge only at `task-5.4` / `task-6.3` for the `build_catalog.py` wiring.

**Phase 7 gates are massively parallel:** four independent gate checks (`7.1`, `7.2`, `7.3`, `7.4`) can run concurrently once their respective predecessors land.

**Phase 8 (HighlightLayer fan-out):** after `task-8.1` (types), `task-8.2` (bright), `task-8.3` (spotlight), and `task-8.5` (tooltip) run in parallel.

**Phase 10 vs Phase 11:** `useKeySquareOverlay` chain and `useTransposition` chain are fully independent. Two agents can ship in parallel.

**Phase 12 parallel:** `task-12.2` and `task-12.3` are independent integrations on the same page; run in parallel, single PR.

**Phase 13 quality gates:** all four checks (`13.1`–`13.4`) are independent.

### Critical path

```
task-1.1 → task-1.5 → task-1.7 → task-1.8
                                 │
       (+ task-2.1 → task-3.5 path runs in parallel)
                                 ▼
                          task-3.4 → task-3.5 → task-4.3 → task-4.4
                                                             │
                                                             ▼
                                                       task-5.4 (build wiring)
                                                             │
                                                             ▼
                                                       task-7.1 (≥30 gate — content review throttle)
                                                             │
                                                             ▼  [content review = longest non-code wait]
                                                             │
                                                       task-8.1 → task-8.3 → task-8.6
                                                             │
                                                             ▼
                                                       task-9.1 → task-9.2
                                                             │
                                                             ▼
                                                       task-12.2 → task-12.4 → task-13.3
```

The dominant cost is **content review** (≥30 openings through the CLI, ~1 minute each = 30+ minutes of focused human work; with breaks, easily one weekend day). Code work on Phase 8+ cannot start until the gate clears. Phase 6 (transposition) sits off the critical path because it does not depend on curated key_squares content — it indexes line positions only, so it can ship and be tested as soon as Phase 5 wiring lands.

---

## Completion Criteria

The phase is **done** when all of the following hold:

1. **Content threshold met (R9.1):** `scripts/curated/key_squares.yml` contains ≥30 reviewed-and-approved openings. `scripts/key_squares/gate_check.py` exits 0.
2. **Build artifacts emitted:**
   - `public/catalog.json` includes `key_squares` field on Openings that have curated data; `schema_version` bumped.
   - `public/transpositions.json` exists with `fen_hash_algo: "sha1-16"`, `fen_normalization: "drop-counters"`, and ≥1 entry.
3. **License audit (R9.2):** every `source_url` host traces to a permissive entry in `scripts/key_squares/sources.yml`. `tests/build/test_license_audit_smoke.py` passes.
4. **Determinism (R9.4):** two consecutive `python -m scripts.build_catalog` runs produce byte-identical `transpositions.json` (excluding `generated_at`). `tests/build/test_transposition.py` asserts this.
5. **FEN-hash parity (R9.4):** `tests/build/test_transposition.py` and `tests/chess/fen-hash.test.ts` both pass against the shared `tests/fixtures/fen_hash_parity.json` fixture.
6. **UI behavior (R6, R7, R8):**
   - Drill page shows the `Key squares: on/off` toggle when the active opening has curated data; toggle persists per-line in localStorage.
   - Entering Explain Mode forces overlay on regardless of drill preference; exiting restores it.
   - Toggle is hidden/disabled when no key_squares data (graceful degrade).
   - Transposition banner appears when current position matches another picked line; capped at 3 chips + `+N more`; never at ply 0; never with empty repertoire; never in Explain Mode; dismissable per session; click navigates to `/drill?line=<lineId>`.
7. **All tests pass:**
   - `pytest tests/key_squares tests/build tests/integration` — green.
   - `npm test` — green, including `HighlightLayer.test.tsx`, `SpotlightOverlay.test.tsx`, `TranspositionBanner.test.tsx`, `useKeySquareOverlay.test.ts`, `useTransposition.test.ts`, `fen-hash.test.ts`, `pattern_viz.test.tsx`, `transposition_e2e.test.tsx`.
   - Coverage gates: new Python modules ≥80%; new TS components ≥80%; scheduler/drill coverage unchanged.
8. **No regression (R9.8):** Phase 1b Explain Mode integration tests pass against the shared `<HighlightLayer mode.kind='bright'>` route.
9. **Type + lint (R9.9):** `npx tsc --noEmit` returns no new errors; `ruff check` passes on all new Python; ESLint passes; no `any` without inline justification.
10. **Bundle budget (R6.8):** SpotlightOverlay + role-color config + spotlight branch combined ≤ 6 kB gzip delta.
11. **Local-first (R9.10):** no new code makes any remote-host network call; `transpositions.json` is fetched as a same-origin static asset.
12. **Documentation:** `tech.md` source-whitelist addendum lands (Task 7.4); README phase progress reflects Phase 2 shipped; constitution articles 1, 3, 6, 7, 11, 13, 14, 15 explicitly verified by named tests.

---

## Summary

Phase 2 splits cleanly across an offline (2a) / browser (2b) seam, with a content-review threshold (≥30 approved openings) as the natural gate between them. Phase 2a is seven phases of Python pipeline work (adapter scaffolding → normalization → LLM extractor → review CLI → catalog build integration → transposition index → quality gates), structured so adapter scaffolding (`task-1.1` through `task-1.4`) fans out to four parallel workers immediately. Phase 2b is six phases of TypeScript work built atop the shared `<HighlightLayer>` primitive (Article 15), with `useKeySquareOverlay` and `useTransposition` developed as fully independent chains for parallel delivery. The critical path runs through content review — once 30+ openings clear the gate, the UI tier can land in a single weekend.

