# Requirements: Phase 4b — Deterministic Feature Extraction (precomputed)

## Introduction

4a ships an honest-but-shallow coach: engine PVs + LLM prose, where the LLM
guesses chess reasons and ~half the narrations feel generic or invented. 4b
inserts the first symbolic layer of the moat: a **deterministic feature
extractor** that computes ~30 verifiable positional facts per position, so the
LLM's job shrinks from "know chess" to "turn provided facts into readable
sentences."

**Architecture decision (2026-06-11): features are PRECOMPUTED at catalog
build time.** The drill catalog is a fixed set (~900 unique positions across
51 lines after transposition dedup), so extraction runs in Python
(`python-chess`, already a build dependency) inside the existing catalog
pipeline and ships as a static sidecar keyed by normalized-FEN hash (the
Phase 2 `sha1-16` / drop-counters infra, reused). Runtime extraction becomes a
map lookup — no Pyodide, no TS reimplementation, no per-click latency. The
runtime-extractor question returns only when the Coach meets arbitrary FENs
(OOB games, "why not this move") — 4d/4e scope, deferred.

Constitution: Article 4 (real, evaluated AI work — 4b must measurably beat the
4a baseline), Article 5 (interfaces), Article 9 (SAN), Article 11 (sidecar =
same-origin static asset; graceful degrade to 4a behavior when absent),
Article 14 (TS strict), Article 16 (build reproducible in container).

## Requirements

### R1 — Feature catalog (the ~30 facts)

THE EXTRACTOR SHALL compute, per position, the following feature groups.
Every fact is deterministic, side-aware (white/black), and SAN/square-named:

1. **Material**: balance in centipawns-by-convention (P=1,N=B=3,R=5,Q=9),
   imbalance descriptor (e.g. "R+P vs B+N"), bishop pair per side.
2. **Pawn structure**: doubled / isolated / backward / passed / candidate
   passer squares per side; pawn islands count; pawn chains (base+head);
   majorities by wing; IQP flag; hanging-pawn duo flag.
3. **King safety**: castled status per side (short/long/uncastled +
   rights remaining); pawn-shield integrity (intact / one-breach / shattered);
   open + half-open files adjacent to king; attacker count in king zone
   (3×3 + front).
4. **Center & space**: occupancy + attack counts of d4/e4/d5/e5; space count
   per side (squares in opponent half attacked by own pawns); locked-center
   flag.
5. **Files & diagonals**: open files; half-open files per side; rooks on
   open/half-open files; rook on 7th (2nd); long-diagonal control per side.
6. **Piece placement & activity**: legal-move mobility per piece; knight
   outposts (current + available); bad-bishop flag (own-color-blocked);
   fianchetto integrity; trapped pieces; undeveloped minor count; tempo
   (side to move + development lead).
7. **Tactics-adjacent geometry** (facts, not evaluations): absolute +
   relative pins; x-ray alignments through pieces; overloaded defenders
   (defending ≥2 attacked targets); discovered-attack candidates; en-prise
   pieces (attacked, underdefended).

Each feature SHALL have a written definition in the design doc precise enough
that two implementers produce identical output (golden-fixture enforceable).

### R2 — Build-time extraction + sidecar

1. Extraction SHALL run inside the catalog build (`scripts/tabiya_build/`),
   walking every line's positions ply-by-ply.
2. Output SHALL be ONE sidecar `public/features.json`:
   `{ schema_version, generated_at, extractor_version, index: { <fen_hash>: PositionFeatures } }`,
   keyed by the Phase 2 normalized-FEN sha1-16 hash (transpositions dedupe
   naturally).
3. THE SIDECAR SHALL validate against a JSON Schema committed in-repo; build
   fails on schema violation.
4. Build SHALL be incremental: positions whose hash already exists with the
   same `extractor_version` are skipped; bumping `extractor_version`
   recomputes all.
5. Python and any future TS implementation SHALL agree byte-for-byte on the
   hash (existing parity fixture covers this).

### R3 — Runtime consumption

1. A TS `FeatureExtractor` interface (Article 5) SHALL front the sidecar:
   `extract(fen) → Promise<PositionFeatures | null>`; the 4b impl is
   `SidecarFeatureExtractor` (lazy-loads `features.json`, hash lookup).
2. `CoachContext.features` (typed placeholder since 4a) SHALL carry the
   result; `CoachContextBuilder` populates it when available.
3. Sidecar missing / hash miss / schema-version mismatch SHALL degrade to 4a
   behavior (features omitted, prompt v1 path) — never an error surface
   (Article 11).
4. Lookup SHALL add no perceptible latency (in-memory map after first lazy
   load; the load itself is a lazy chunk/fetch, not in the base bundle).

### R4 — Prompt v2 (grounded narration)

1. A new `prompts/coach/v2.txt` SHALL include a `{{features_block}}` and the
   grounding rules: every chess claim must be supported by the features block
   or engine block; if facts don't explain the move, say so rather than
   invent ("engine preference — no clear positional reason at this depth").
2. Few-shot examples SHALL demonstrate fact-grounded explanations (cite
   features) AND one honest-hedge example.
3. `promptVersion` SHALL report `v2` when features were present, `v1` when
   degraded — eval traceability (Article 4).
4. v1 SHALL remain in-repo and selectable for A/B comparison during eval.

### R5 — Golden-fixture verification

1. EVERY feature SHALL have a golden fixture file
   (`evals/features/golden/<feature>.json`): real FENs + expected output,
   including at least one negative case and one edge case (rim files,
   en-passant interactions, promotion-adjacent).
2. A pytest suite SHALL run all fixtures against the Python extractor in CI;
   100% pass required.
3. Fixture positions SHALL be reviewed by the author for chess correctness
   before merge (the human gate — fixtures encode truth).

### R6 — Eval vs 4a baseline (the moat proof)

1. The SAME 10 walkthrough positions from `evals/coach/4a-walkthrough.md`
   SHALL be re-narrated under prompt v2 + features and rated on the same
   1–5 scale, recorded in `evals/coach/4b-walkthrough.md`.
2. Success bar: mean rating improvement ≥ +1.0 AND zero narrations containing
   chess claims absent from the facts (manual audit at 4b; mechanical
   validation is 4e).
3. Cost note: prompt grows by the features block; verify Haiku prompt-cache
   still absorbs the static system prompt (R5.3 from 4a holds).

### R7 — Quality gates

1. TS strict, no bare `any` (existing no-any test extends to new files).
2. Python extractor: typed (mypy-clean or pragmatic equivalent), pytest
   coverage on every feature function.
3. Bundle budget unchanged: `features.json` is a fetched static asset, not a
   bundle chunk; entry-chunk ceiling untouched.
4. Determinism: extractor output for a FEN is pure; sidecar regeneration with
   unchanged inputs is byte-identical (stable key order, no timestamps inside
   entries).

## Stretch (same pipeline, optional within 4b)

- **S1 — Precomputed engine PVs**: native Stockfish at build time
  (depth 25+, multipv 3) for every catalog position, shipped in the same or a
  twin sidecar; runtime engine becomes fallback-only for catalog drills.
  Why-click latency → ~0. Gate: build-time cost ~30 min, incremental cache by
  hash.

## Out of scope (4b)

- Runtime extraction for arbitrary FENs (OOB real-game positions,
  "why not this move") — 4d/4e, where the Pyodide-vs-TS decision actually
  bites.
- Position classification (IQP *opening family*, Carlsbad, Hedgehog…) and
  motif *detection* beyond geometric facts — 4c.
- Plans, opening KG — 4d. Hallucination post-validator — 4e.
- Pre-generated narrations shipped as content ("stock coach for keyless
  users") — parked product idea, Open Question.

## Open questions

1. Stretch S1 in or out of the first 4b cut? (Bias: in, if build-time cost
   confirms ≤30 min.)
2. Pre-generated narration sidecar for keyless users — product decision,
   revisit after 4b eval shows quality.
3. Feature verbosity in prompt: full JSON vs prose-rendered facts block?
   (Bias: compact prose rendering, token-cheaper; decide during R4 with eval.)

## Timebox

3–4 weekends (extraction + fixtures ≈ 2, prompt v2 + eval ≈ 1, stretch S1 ≈ 1).
Overrun → cut S1 first, then defer tactics-adjacent group (R1.7) to 4c.
