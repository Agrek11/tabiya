# Requirements: Phase 4c.1 — Validated Motif Detection (heuristic layer)

## Introduction

4b ships ~30 deterministic positional facts + raw tactical GEOMETRY (pins,
x-rays, overloads, discovered-attack alignments, en-prise). 4c.1 turns geometry
into NAMED, VALIDATED motifs — the layer that lets the LLM stop reasoning about
tactics and just narrate them. A raw geometric candidate is untrustworthy until
validated (a fork that hangs the forking piece is not a fork); 4c.1's value is
the validation stage, not the geometry.

Same architecture as 4b: build-time Python in the catalog pipeline, shipped in
the features sidecar (new `motifs` group on `PositionFeatures`), runtime is a
lookup. Self-contained: STATIC validation only (safety + attacker/defender
counts), no engine dependency — openings are shallow-tactic, so static catches
most cases; engine cross-check of survivors is deferred to 4c.2 (uses the
precomputed PVs from 4b stretch 6.1).

Constitution: Article 4 (fixture-proven accuracy IS the eval for this layer,
independent of any LLM narration eval), Article 5, Article 9 (SAN/squares),
Article 14.

## Requirements

### R1 — Motif catalog

THE DETECTOR SHALL emit these motifs, each side-aware, square/SAN-named, with a
`confidence` of `high` (static validation passed cleanly) or `speculative`
(geometry present but validation ambiguous — e.g. target defended exactly as
many times as attacked):

1. **fork / double attack** — one piece attacks ≥2 enemy targets where ≥2 are
   "valuable" (piece, or undefended pawn, or a mate/again-attack square);
   include the forking square + the targets.
2. **skewer** — slider alignment where the FRONT piece is more valuable than
   the rear (inverse of a pin); front piece + rear target + attacker.
3. **battery** — two own line-pieces stacked on the same file/rank/diagonal
   aimed at an enemy target or the enemy king's line (Q+R, Q+B, R+R).
4. **pin** — promoted from 4b geometry (absolute / relative kept).
5. **discovered-attack** — promoted from 4b candidates, validated that the
   unveiled hit lands on a real target.
6. **overload / removing-the-defender** — promoted from 4b overload geometry:
   a defender whose removal hangs ≥1 defended target; name the defender + the
   targets it can't keep covering.
7. **hanging piece** — promoted from 4b en-prise, but ONLY pieces (not pawns)
   and only when the attacker can actually capture safely (SEE ≥ 0 for the
   capturing side).

### R2 — Static validation

1. A motif involving an own piece landing on / capturing a square SHALL be
   discarded or downgraded to `speculative` if that piece would be lost
   (simple SEE: attacker value vs defended exchange on the destination).
2. A fork SHALL require the forking piece to be safe on its square (not itself
   hanging) for `high`; otherwise `speculative`.
3. Validation is STATIC (material + attacker/defender counts + a 1-ply SEE on
   the key square). Deep refutations (zwischenzug, back-rank counter) are out
   of scope — flagged as the known 4c.1 ceiling, closed by 4c.2 engine
   cross-check.

### R3 — Sidecar + runtime

1. New `motifs` group on `PositionFeatures` (additive; bump
   `EXTRACTOR_VERSION`). Sidecar regenerates for all positions.
2. TS `PositionFeatures.motifs` typed; `renderFeaturesBlock` gains a Tactics →
   Motifs sub-section emitting named motifs with confidence (speculative ones
   prefixed "possible").
3. Prompt v2 already says "cite VERIFIED FACTS" — motifs are facts, so no new
   prompt version required for 4c.1; a v3 with motif-aware few-shots is
   optional and deferred until the 4b/4c eval is run.

### R4 — Golden fixtures (the accuracy proof)

1. Every motif type SHALL have a golden fixture (positive / negative /
   speculative-edge), verified by running the detector. Fixture is the spec of
   record.
2. A discarded-candidate fixture per type: geometry present but validation
   correctly rejects it (e.g. a "fork" where the forking piece hangs).

## Out of scope (4c.1)

- Engine-validated motifs (4c.2).
- Position classification — open/closed, IQP/Carlsbad/Hedgehog structure names
  (the rest of 4c).
- Positional motifs (minority attack, bishop pair leverage) — 4d plans.
- New prompt version / narration eval — deferred to the 4b/4c eval run.

## Decision recorded 2026-06-17

Build the heuristic motif layer BEFORE position classification because it is
the higher-leverage scribe-enabler: tactics are what the 4a/4b LLM most often
hallucinated. "Accurate motifs → LLM becomes scribe" holds, with the caveat
that validation (not geometry) is what makes it accurate, and the asymptote
still needs the 4e post-validator (the LLM can mis-attribute true facts).
