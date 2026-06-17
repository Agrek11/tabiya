# Requirements: Phase 4c.2 — Position Classification

## Introduction

The other half of 4c (4c.1 shipped validated motifs). Classification names the
TYPE of position so the coach can frame the right kind of advice — "in this
closed center, maneuvering and pawn breaks matter more than tempo." Same
build-time deterministic pattern; new `classification` group on
`PositionFeatures`.

Scope discipline (classification is opinionated and easy to get chess-wrong):
ship only CRISP, deterministic judgments. Center type is fully decidable from
the pawn skeleton + contacts. Named structures are emitted ONLY when their
defining pattern matches exactly — no fuzzy "looks like a Carlsbad." When in
doubt, emit nothing rather than a wrong label (a wrong structure name is worse
than silence — it makes the coach sound confidently wrong).

Constitution: Article 4 (fixture-proven), Article 5, Article 14.

## Requirements

### R1 — Center type (always emitted)

`center.type` ∈:
- **open** — ≤1 pawn total on d4/e4/d5/e5 AND ≥1 of the d/e files fully open.
- **closed** — center pawns locked head-to-head with no pawn captures available
  (reuses 4b `locked_center`).
- **fixed** — center pawns in direct contact (e.g. white e5 vs black d6/f6
  chain) but at least partly immobile; not fully locked.
- **tension** — at least one pawn capture available among the center pawns
  (the center is unresolved).
- **fluid** — center pawns present but not in contact (can still be formed).

Plus `center.open_files_central` (subset of open/half-open d,e files) and the
existing space delta as `center.space_edge` (white|black|null).

### R2 — Named pawn structures (emitted only on exact match)

`structures: string[]` — zero or more of, each with a precise pattern test:
- **isolated-queens-pawn** — promote 4b `iqp` (already exact).
- **hanging-pawns** — promote 4b `hanging_duo` (c+d, exact).
- **maroczy-bind** — white pawns on c4 AND e4, black has no pawn on d5 or c5
  contesting (mirror for black). Exact.
- **stonewall** — one side has pawns on d4+e3+f4+c3 (white) / d5+e6+f5+c6
  (black) — the defining Stonewall wall. Exact.
- **closed-ruy-chain** / generic **locked-chain** — locked center + a pawn
  chain ≥3 long (from 4b chains). Generic name only; do NOT guess the ECO.
- **symmetric** — white and black pawn files + counts mirror exactly.

Anything not matching a listed pattern → omitted. No ECO-name guessing.

### R3 — Game character (heuristic, low-confidence tag)

`character` ∈ { open-tactical, closed-maneuvering, balanced, sharp-imbalanced }
derived from center type + king-safety asymmetry + material imbalance.
Marked as a soft descriptor in the prompt ("this looks like …"), never a
hard claim. Optional — cut if it reads as over-reach in eval.

### R4 — Sidecar + runtime + render

1. `classification` group added to `PositionFeatures` (additive, bump
   `EXTRACTOR_VERSION`).
2. TS type + `renderFeaturesBlock` "Position type:" line (center type +
   structures; character only if present).
3. Prompt unchanged — classification facts cited under the existing v2
   grounding rule. Motif-and-classification-aware few-shots → optional prompt
   v3 at the eval run.

### R5 — Golden fixtures

Per center type (open/closed/fixed/tension/fluid) + per named structure
(positive + a near-miss negative that must NOT match). Fixture = spec of
record; a wrong-label position is the key negative case.

## Out of scope

- ECO / opening-name classification (that's the 4d opening KG).
- Fuzzy structure guesses (Carlsbad, Benoni, etc. unless an exact pattern is
  added later with its own fixtures).
- Plans / "what to do about" the structure — 4d.

## Decision 2026-06-17

Build classification before 4d because 4d plans are KEYED on structure +
center type ("minority attack" only makes sense given a Carlsbad/queenside
majority). Classification is the vocabulary 4d's plan extraction reads.
Accuracy rule: silence beats a wrong label.
