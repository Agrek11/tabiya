# Requirements: Universal Coach (north-star goal)

## The goal (locked 2026-06-17)

The Coach must work on **any legal chess position**, not only the curated
opening catalog. Imported Lichess/chess.com games, a "why not this move?"
comparison, a pasted FEN, a position reached off-book mid-drill — all get the
same fact-grounded, hallucination-resistant explanation. **Universality is the
Coach's headline feature**, the thing that separates it from an opening-only
trainer and from every generic "GPT explains chess" wrapper.

The pipeline is ALREADY position-agnostic by design:

```
any FEN → Stockfish (any position) → feature extractor (pure fn of FEN)
        → grounded facts → prompt v2 → LLM scribe → explanation
```

Engine, prompt, and scribe already run on any position. The single thing tying
the Coach to the catalog today is WHERE the feature extractor runs:
build-time-only, with results precomputed into `features.json` for the 587
catalog positions. A non-catalog FEN gets a hash miss → no facts → v1
engine-only fallback.

## What "universal" requires

A **runtime feature extractor** behind the existing `FeatureExtractor`
interface (Article 5), so `CoachPipeline` resolves facts for ANY FEN:

```
extract(fen):
  1. sidecar hash hit (catalog)      → instant precomputed facts   [shipped 4b]
  2. miss → runtime extractor        → compute facts on the fly     [THIS WORK]
  3. runtime unavailable             → null → engine-only v1        [Article 11]
```

### Decision — TS port (leaning), parity-locked to the Python extractor

- **Reimplement the ~30 features + motifs + classification in TypeScript**, run
  in-browser. Keeps the app browser-only, free, offline-capable, and aligned
  with the cloud-agnostic launch (no mandatory backend).
- **Parity is non-negotiable and mechanically enforced:** the TS extractor
  runs the SAME golden fixtures (`evals/features/golden/*.json`) the Python
  build-time extractor passes. A shared parity test asserts TS output ===
  Python output (byte-equal per feature) on every fixture FEN, the same way
  `fen_hash` parity is held today. One source of truth, two implementations,
  provably identical.
- Alternatives kept on the shelf: **Pyodide** (run the exact Python in-browser,
  ~10 MB, zero reimplementation, heavier load) — fallback if the TS port proves
  too costly to maintain in lockstep; **backend API** — the optional paid lane
  (hosted, deeper, instant) per the Phase 7 economics, never the only path.

### Performance

Runtime extraction is a pure board walk — target ≤30 ms/position (the 4b
budget), comfortably interactive for a per-Why-click call. Engine analysis
(seconds) dominates anyway; the extractor is negligible. Catalog positions
still hit the precomputed sidecar (~0 ms) — the runtime path is only for the
off-book long tail.

## Surfaces this unlocks (all already wired to receive it)

- **Imported-game coaching** — the OOB viewer's `CoachSlot` (Phase 3, renders
  null today) lights up: narrate the user's actual out-of-book mistakes with
  facts + motifs + structure. THE killer demo.
- **"Why not this move?"** — extract facts for the position after the user's
  rejected move, contrast with the engine's line. (4e.)
- **Paste-a-FEN / analyze-any-position** — a general analysis surface.
- **Mid-drill off-book** — if a user explores a non-catalog continuation, the
  coach still works.

## Sequencing

This is the spine of **4e** (production coach) and the reason 4e is the
headline. Build order: runtime TS extractor + parity tests → wire into
`CoachPipeline` (sidecar-hit → runtime fallback) → CoachSlot real-game coaching
→ "why not this move". The deterministic layers (4b/4c.1/4c.2) are the
prerequisite — they define WHAT gets computed; this makes it compute ANYWHERE.

## Constitution

- Article 5 — one `FeatureExtractor` seam; sidecar and runtime impls are
  interchangeable; surfaces never know which answered.
- Article 11 — runtime path is in-browser; no mandatory network; degrades to
  engine-only if unavailable.
- Article 4 — TS↔Python parity via the shared golden fixtures is the eval that
  keeps the universal extractor honest.
