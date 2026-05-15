# Phase 2 — Pattern Visualization Requirements

**Trigger:** v1 trainer (Phase 1c) teaches sequences; it does not teach *position*. A drilling user memorizes the Ruy Lopez moves but cannot articulate why d5 is a key square or why the c4-knight outpost matters. Pattern Visualization adds key-square awareness to the board for ~50 openings, plus a position-keyed transposition index so the user notices when a line they're drilling shares a position with another line in their repertoire.

**Relationship to other phases:**
- **Phase 1b Explain Mode** — reuses the same square-highlight primitive (Constitution Article 15). Spotlight overlay is implemented on top of the existing `<HighlightLayer>` from 1b. Explain Mode also *consumes* this phase: it forces overlay on for the explain run regardless of drill-mode toggle.
- **Phase 1c Requirement 8 (deferred transposition index)** — fulfilled here. FEN-keyed `Map<FENhash, Set<lineId>>` built at catalog-build time and consumed by a drill-mode banner.
- **Phase 4 AI Coach** — `key_squares` records are part of the Coach's prompt context: when the user asks "why this move?" the Coach grounds its answer with the curated key-square data instead of hallucinating from FEN alone.
- **Article 13 (Weekend Pace)** — implementation must fit weekend cadence; pauses immediately if main plan slips.

**Scope split:**
- **Phase 2a — Content acquisition pipeline.** Scrape permissively-licensed chess theory sources, run LLM extraction over normalized prose, manually review drafts, land approved `key_squares.yml` in the catalog build. Offline build step. Unblocks 2b.
- **Phase 2b — UI integration.** Spotlight overlay component, drill-mode toggle, Explain Mode forced-on integration, transposition banner, banner navigation. Consumes 2a artifacts at build time.

**Phase 2a gate for 2b unlock:** ≥30 openings reviewed and approved before 2b ships. See R9.

**Out of scope:**
- Tactical motif visualization (pins, forks, skewers on live board).
- Engine-derived threat arrows (that's Phase 3+).
- Dynamic key squares per live game state. Key squares are tied to opening *canonical* positions only — the FEN after the line's main sequence, not whatever the user happens to be looking at.
- Branching key-square narration (Article 7 — linear lines only).
- Runtime LLM calls for key squares. All extraction is offline build (Article 11).
- User-authored key squares via in-app editor.

---

## R1 — Scrape pipeline for chess opening theory prose

**User Story:** As the catalog maintainer, I need a Python pipeline that pulls opening-theory prose from permissively-licensed sources so I have raw material for LLM extraction, without manually writing chess theory I don't know.

### Acceptance criteria

1. THE SYSTEM SHALL ship `scripts/key_squares/scrape.py` as the entry point.
2. THE SCRAPER SHALL only fetch from a maintained source whitelist (`scripts/key_squares/sources.yml`) of permissively-licensed sites. Initial whitelist candidates: Wikipedia chess-opening pages (CC BY-SA), Lichess opening explorer descriptions (open data), openly-licensed PDFs/sites. Each entry SHALL declare license + URL pattern + scrape selector.
3. THE SCRAPER SHALL respect each source's `robots.txt` and rate limit to ≤1 request/sec per host.
4. THE SCRAPER SHALL produce one normalized record per opening: `{ opening_slug, opening_name, fen_after_main_line, prose_chunks: [{source_url, license, text}] }` written to `data/key_squares/scraped/<opening_slug>.json`.
5. WHEN a source returns a non-permissive license or robots-disallowed path, THE SCRAPER SHALL skip and log, not abort the run.
6. THE SCRAPER SHALL be idempotent — re-running on already-scraped openings refreshes content without duplicating records.
7. THE SOURCE LICENSE REGISTER SHALL be reflected in `tech.md` addendum (Article 1).

---

## R2 — LLM extraction of key squares

**User Story:** As the catalog maintainer, I want an LLM step that reads scraped prose for one opening and proposes structured `key_squares` records I can review, so I don't manually transcribe chess theory.

### Acceptance criteria

1. THE SYSTEM SHALL ship `scripts/key_squares/extract.py`.
2. THE EXTRACTOR SHALL call the Anthropic SDK directly. No LangChain or equivalent abstraction (Article 3).
3. THE EXTRACTOR SHALL take a scraped record (R1.4) as input and emit zero or more draft records:
   ```py
   { square: 'd5', role: 'outpost'|'weak'|'tension'|'control', for_color: 'white'|'black', rationale: str, source_url: str }
   ```
4. THE PROMPT SHALL be few-shot grounded with hand-authored exemplars (target: 3-5 openings) checked into `scripts/key_squares/prompts/few_shot.yml`.
5. THE EXTRACTOR SHALL validate each draft: square ∈ a1..h8, role ∈ the enum, for_color ∈ {white, black}, rationale ≤ 280 chars (matches Phase 1b rationale cap convention).
6. INVALID DRAFTS SHALL be logged + dropped, not surfaced for review.
7. DRAFTS SHALL be written to `data/key_squares/pending/<opening_slug>.yml` as a flat list, preserving source URL for audit.
8. THE EXTRACTOR SHALL be re-runnable per opening; existing pending drafts SHALL be overwritten (review queue is regenerable until approved).

---

## R3 — Manual review CLI

**User Story:** As the catalog maintainer, I review each LLM draft on a rendered board so I catch hallucinated squares before they reach users.

### Acceptance criteria

1. THE SYSTEM SHALL ship `scripts/key_squares/review.py`.
2. THE CLI SHALL iterate `data/key_squares/pending/*.yml`, one opening at a time.
3. FOR EACH OPENING, THE CLI SHALL render the canonical FEN as an ASCII or unicode chess board with the draft squares marked.
4. FOR EACH DRAFT, THE CLI SHALL prompt: `[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit`.
5. `edit` SHALL allow inline override of square / role / for_color / rationale.
6. APPROVED DRAFTS SHALL be appended to `scripts/curated/key_squares.yml` keyed by `opening_slug`.
7. REJECTED DRAFTS SHALL be moved to `data/key_squares/rejected/<opening_slug>.yml` with reviewer note (free-text), for future prompt-tuning.
8. THE CLI SHALL be resumable — quitting mid-opening preserves accept/reject decisions made so far.
9. APPROVED `key_squares.yml` IS the only artifact the catalog build consumes. Scraped + pending + rejected dirs SHALL NOT be read by runtime or build (Article 11 — only curated, audited content ships).

---

## R4 — `key_squares.yml` schema + catalog build integration

**User Story:** As the catalog build, I consume curated key-square data and produce a runtime artifact the frontend can render with no network calls.

### Acceptance criteria

1. THE SCHEMA SHALL be:
   ```yaml
   <opening_slug>:
     fen_canonical: "<FEN string>"
     squares:
       - square: d5
         role: outpost
         for_color: white
         rationale: "..."
         source_url: "..."
   ```
2. THE CATALOG BUILD (Phase 0b pipeline) SHALL validate `scripts/curated/key_squares.yml` against the schema. Build fails on malformed entries.
3. THE BUILD SHALL join key_squares to existing `Opening` records by `opening_slug` (Article 6 — stable IDs). Unknown slugs fail the build, not runtime.
4. THE BUILD ARTIFACT SHALL surface `Opening.key_squares?: KeySquareRecord[]` to the frontend. Additive — old consumers unaffected.
5. CATALOG `schema_version` SHALL bump to reflect the additive field.
6. WHEN an opening has no curated key-square entry, THE BUILD SHALL succeed and emit `key_squares: undefined`. Frontend graceful-degrades (R6.6).

---

## R5 — Position-keyed transposition index build step

**User Story:** As the catalog build, I produce a FEN-keyed index so the frontend can detect when a drilled position appears in other lines in the user's repertoire.

### Acceptance criteria

1. THE BUILD SHALL emit `Map<FENhash, lineId[]>` covering every position in every line, written into the catalog artifact (`catalog.transposition_index`).
2. `FENhash` SHALL be derived from a *normalized* FEN — castling rights + en-passant target preserved, halfmove + fullmove counters stripped (collisions across move counts are intended).
3. EACH lineId SHALL be a stable line ID (Article 6). Index entries point only to currently-published lineIds; refresh rebuilds the index, removing any lineIds that no longer exist.
4. THE INDEX SHALL be persisted alongside the catalog. No runtime computation — load once, query in-memory.
5. THE INDEX SHALL be deterministic — same catalog input produces byte-identical index output (testable).
6. INDEX ENTRIES WITH ONLY ONE lineId SHALL be omitted to keep the artifact small (transposition only meaningful when ≥2 lines share a position).

---

## R6 — Spotlight overlay component (UI primitive)

**User Story:** As a player, when key squares are shown, I want the rest of the board dimmed and the key squares spotlit — so my attention is pulled to the pattern, not the pieces.

### Acceptance criteria

1. THE SYSTEM SHALL ship `<SpotlightOverlay>` as an SVG layer on top of the board, rendered from the same square-highlight primitive used by Phase 1b Explain Mode (Article 15). Not a fork.
2. WHEN active, THE OVERLAY SHALL dim non-key squares via a single semi-transparent rectangle covering the board, with cutouts at the key squares' coordinates.
3. EACH KEY SQUARE SHALL render a soft glow inside its cutout, colored by `role`:
   - `outpost` → green
   - `control` → blue
   - `tension` → amber
   - `weak` → red
4. Hover over a key square SHALL show a tooltip with `rationale` text + `for_color` indicator. Tooltip primitive reused from Phase 1b (Article 15).
5. THE OVERLAY SHALL be non-blocking — clicks on key squares fall through to the underlying board (drill input continues to work).
6. WHEN the active opening has no `key_squares` data, THE OVERLAY SHALL render nothing (graceful degrade, not error).
7. Visual reference: `/workspaces/personal/AI/Projects/tabiya/chessViz` (dark board, bright spotlit squares).
8. Build size budget: +6kB gzip cap for `<SpotlightOverlay>` + glow color config combined.

---

## R7 — Visibility rules + drill-mode toggle

**User Story:** As a player drilling a line, I want a toggle for the spotlight overlay so I can switch between "show me the pattern" and "stop dimming the board, I know it." In Explain Mode I expect the overlay always on, because that mode is *for* understanding.

### Acceptance criteria

1. THE DRILL PAGE HEADER SHALL include an overlay toggle (`[Key squares: on/off]`). Default = off.
2. THE TOGGLE STATE SHALL persist per-line in `localStorage` (key: `tabiya:linePrefs:<lineId>:keySquareOverlay`). Consistent with Phase 1b mode persistence.
3. WHEN drill toggle is off AND the user enters Explain Mode, THE OVERLAY SHALL force on for the duration of the explain run.
4. WHEN the user exits Explain Mode back to drill, THE OVERLAY SHALL restore to the persisted drill toggle state (off, in the default case).
5. THE TOGGLE SHALL be hidden / disabled when the active opening has no `key_squares` data (graceful degrade).

---

## R8 — Transposition banner UX

**User Story:** As a player drilling a line, when I reach a position that also appears in another line I've picked into my repertoire, I want a non-blocking nudge so I notice the connection and can jump there if I want.

### Acceptance criteria

1. WHEN the current drill position's normalized FEN (R5.2) appears in `catalog.transposition_index` with ≥2 lineIds AND ≥1 of those lineIds is in the user's picked repertoire (other than the active line), THE SYSTEM SHALL render a non-blocking banner above the move-history rail.
2. THE BANNER SHALL read: `"This position also appears in: [Line A], [Line B]"` with each line as a clickable chip.
3. THE BANNER SHALL cap suggestions at 3 lineIds max. If more match, show the first 3 (sorted by lineId for determinism) with a `+N more` suffix.
4. CLICKING a line chip SHALL navigate to `/drill?line=<lineId>` and start that line from ply 0. SRS state is preserved (Article 6 — IDs stable, state survives).
5. THE BANNER SHALL be dismissable for the current drill session (close button); it does not block drill input regardless.
6. THE BANNER SHALL NOT appear at ply 0 (start position is shared by every line; would always fire).
7. WHEN the user's repertoire is empty (no picks), THE BANNER SHALL never appear (no false positives).

---

## R9 — Quality gates + Phase 2a → 2b unlock criteria

### Acceptance criteria

1. **Phase 2a unlock for 2b:** ≥30 openings reviewed end-to-end and approved in `scripts/curated/key_squares.yml` before any 2b UI work merges. Below this threshold, the overlay has too little content to be worth shipping.
2. **Source license audit:** every URL in `scripts/curated/key_squares.yml`'s `source_url` traces to an entry in `scripts/key_squares/sources.yml` with a permissive license declared (Article 1). Build-time check.
3. **Schema validation tests:** `scripts/curated/key_squares.yml` and the generated transposition index both have schema-validator test coverage. Malformed entries fail the build, not runtime.
4. **Determinism test:** transposition index byte-equal across two consecutive builds on the same catalog input (R5.5).
5. **Component tests:** `<SpotlightOverlay>` covers all 4 role colors, no-data graceful degrade, click fall-through to board.
6. **Hook tests:** drill toggle persistence + Explain Mode force-on logic (R7) covered.
7. **Banner tests:** ≥3-line cap, repertoire filter, ply-0 suppression, navigation target correctness.
8. **No regression:** drill mode + Explain Mode unchanged when overlay is off. Existing tests still pass.
9. **Type discipline:** TS strict, no `any`; Python type hints on all new scripts (Article 14).
10. **Local-first:** runtime app SHALL NOT make any network call for key squares or transposition data. Both ship in the catalog bundle (Article 11).

---

## Files touched (forecast)

### Phase 2a (content pipeline)

- `scripts/key_squares/scrape.py` — new
- `scripts/key_squares/extract.py` — new
- `scripts/key_squares/review.py` — new
- `scripts/key_squares/sources.yml` — new (whitelist + licenses)
- `scripts/key_squares/prompts/few_shot.yml` — new
- `scripts/curated/key_squares.yml` — new (the curated output)
- `data/key_squares/scraped/*.json` — generated, gitignored or git-tracked per repo norm
- `data/key_squares/pending/*.yml` — generated, gitignored
- `data/key_squares/rejected/*.yml` — generated, git-tracked for prompt-tuning history
- `scripts/build_catalog.py` — extend to validate + join key_squares + emit transposition index
- `tech.md` — addendum listing source whitelist + licenses

### Phase 2b (UI)

- `src/components/board/SpotlightOverlay.tsx` — new
- `src/components/board/HighlightLayer.tsx` — reused (Article 15)
- `src/components/drill/DrillPage.tsx` — overlay toggle in header
- `src/components/drill/TranspositionBanner.tsx` — new
- `src/hooks/useKeySquareOverlay.ts` — new (persistence + Explain Mode forcing)
- `src/hooks/useTransposition.ts` — new (index query against picked repertoire)
- `src/types/catalog.ts` — `KeySquareRecord`, `Opening.key_squares?`, `catalog.transposition_index`
- `tests/key_squares/*` — schema + extractor + review CLI tests
- `tests/components/SpotlightOverlay.test.tsx` — new
- `tests/components/TranspositionBanner.test.tsx` — new

---

## Open questions

1. **Source whitelist scope.** Wikipedia + Lichess open data are obvious; are openly-licensed opening books (e.g., CC-licensed excerpts) worth the legal review burden? Lean: ship 2a with Wikipedia + Lichess only; expand whitelist after first 30 openings pass review, if content is thin.
2. **Few-shot exemplar count vs prompt size.** 3 exemplars may underfit role taxonomy; 10 burns tokens per call. Lean: start with 5, measure approval rate in review CLI, tune from there.
3. **Banner across modes.** Should the transposition banner appear in Explain Mode too, or is it drill-only? Lean: drill-only — Explain Mode's job is line pedagogy, not navigation. Confirmable in 2b polish.

---

## Timebox

### Phase 2a (content pipeline)

- Spec + scraper + sources whitelist: 1 weekend day.
- Extractor + few-shot + review CLI: 1 weekend day.
- Run pipeline across ~50 openings, review 30+: 1-2 weekend days (review is the throttle).

### Phase 2b (UI)

- Catalog build integration (key_squares + transposition index) + tests: 1 weekend half-day.
- `<SpotlightOverlay>` + drill toggle + Explain Mode forcing + tests: 1 weekend day.
- Transposition banner + navigation + tests: 1 weekend half-day.

Total: 5-6 weekend days across 2a + 2b. If 2a content review stalls below 30 approved openings, 2b is blocked (R9.1). Article 13 holds: pauses immediately if main plan slips.

---

## Constitution compliance

- Article 1 (Open Source / Open Data): only permissively-licensed scrape sources; whitelist + license declared in `sources.yml` and `tech.md`.
- Article 3 (No Heavy AI Orchestration): extractor uses Anthropic SDK directly; no LangChain.
- Article 6 (Stable Line IDs): key_squares join by `opening_slug`; transposition index points to stable lineIds.
- Article 7 (Linear Lines): key squares tied to canonical opening positions only, no branch narration.
- Article 11 (Local-First): scraping + extraction are offline build steps; runtime app makes zero network calls for this feature.
- Article 13 (Weekend Pace): timebox structured around weekend days; 2a → 2b gate prevents overrun bleed.
- Article 14 (Type Discipline): TS strict + Python type hints on all new modules.
- Article 15 (Single Highlight Primitive): `<SpotlightOverlay>` builds on the Phase 1b `<HighlightLayer>` primitive; not a fork.
