# Runtime Extractor Contract (Stage 1.2)

This document is the implementation contract for `RuntimeFeatureExtractor` and the parity harness in `tests/coach/RuntimeFeatureExtractor.golden.test.ts`.

## Scope

- Applies to `src/coach/features/RuntimeFeatureExtractor.ts`.
- Applies to runtime coach resolution chain:
  - sidecar hit (`features.json`) -> runtime extractor -> engine-only fallback.
- Applies to deterministic extraction for any legal FEN.

## Determinism Rules

- Same input FEN must produce byte-stable feature output.
- Feature arrays are sorted where ordering is otherwise non-deterministic (pins, xrays, discovered candidates, motifs, en-prise lists).
- Invalid FEN returns `null` (never throws).
- Runtime extractor must not call network services.

## Shape / Compatibility Rules

- Output must match `PositionFeatures` in `src/coach/features/PositionFeatures.ts`.
- `version` is tied to `RUNTIME_EXTRACTOR_VERSION` and updates only when extraction semantics change.
- Optional sections (`motifs`, `classification`) remain additive and backward-compatible.

## Parity Source Of Truth

- Golden fixtures in `evals/features/golden/*.json` are the parity source-of-truth.
- Harness requirement:
  - every shipped golden feature family must be strict in `STRICT_FEATURES`.
  - no shipped fixture family may remain TODO once implemented.
- Current state: all golden fixture families are strict.

## Performance Guardrails

- Runtime cache is mandatory (`Map<FEN, features | null>`) to avoid repeated recomputation in the same session.
- Extraction must stay synchronous/CPU-local with `chess.js` only (no heavy provider calls).
- Coach surfaces should continue to degrade gracefully:
  - if extraction returns `null`, pipeline continues with engine-only context.

## Verification Checklist

- `npx tsc -b` passes.
- Golden parity harness includes all fixture families.
- No uncaught errors for invalid FEN inputs.
- Coach pages still render under extractor miss/fallback conditions.
