# Tasks: Phase 4b — Precomputed Feature Extraction

Scope: requirements-4b.md / design-4b.md. Python build-time extractor +
golden fixtures + sidecar + TS lookup + prompt v2 + eval vs 4a baseline.

## Phase 1 — Python extractor (build pipeline)

- [ ] **1.1** `scripts/tabiya_build/features/` package skeleton: `extract.py`
      orchestrator + `EXTRACTOR_VERSION = 1`, per-group modules, typed dicts.
- [ ] **1.2** Group 1 material (+tests): balance_cp, imbalance label, bishop pair.
- [ ] **1.3** Group 2 pawns (+tests): doubled/isolated/backward/passed/
      candidates/islands/chains/majorities/IQP/hanging duo.
- [ ] **1.4** Group 3 king safety (+tests): castled, shield, adjacent files,
      king-zone attackers.
- [ ] **1.5** Group 4 center/space (+tests): occupancy, attacks, space counts,
      locked flag.
- [ ] **1.6** Group 5 files/diagonals (+tests): open/half-open, rook
      placements, 7th rank, long diagonals.
- [ ] **1.7** Group 6 activity (+tests): mobility, outposts, bad bishop,
      fianchetto, trapped, development, tempo.
- [ ] **1.8** Group 7 tactics geometry (+tests): pins, x-rays, overloaded,
      discovered candidates, en prise.

## Phase 2 — Golden fixtures (the spec of record)

- [ ] **2.1** `evals/features/golden/<feature>.json` for every feature —
      ≥3 positions each (positive / negative / edge: rim files, ep, promotion-
      adjacent). Author reviews fixtures for chess truth (HUMAN GATE).
- [ ] **2.2** pytest golden runner looping all fixture files; CI-wired;
      100% pass required.

## Phase 3 — Sidecar emission

- [ ] **3.1** `features/sidecar.py`: walk lines → dedupe by fen_hash →
      `public/features.json` (sorted keys, deterministic).
- [ ] **3.2** Wire into `build_catalog.py` (`--skip-features` flag, summary
      line); incremental reuse by extractor_version.
- [ ] **3.3** Determinism test: double build byte-identical; JSON Schema
      committed + validated at build.

## Phase 4 — TS consumption

- [ ] **4.1** `PositionFeatures.ts` types + `FeatureExtractor` interface.
- [ ] **4.2** `SidecarFeatureExtractor` (lazy fetch, schema check, hash
      lookup) + tests (hit / miss / version-mismatch degrade).
- [ ] **4.3** `renderFeaturesBlock.ts` — compact prose, omits empty facts;
      snapshot test.
- [ ] **4.4** Pipeline integration: CoachContext.features typed properly
      (replace 4a `unknown` placeholder), prompt v2 path, promptVersion
      v2/v1 switching + tests.

## Phase 5 — Prompt v2 + eval

- [ ] **5.1** `prompts/coach/v2.txt` + CHANGELOG entry (grounding rules,
      3 few-shots incl. honest hedge).
- [ ] **5.2** `evals/coach/4b-walkthrough.md`: same 10 positions as 4a
      baseline, prompt v2, rated. Success: mean ≥ +1.0 vs 4a AND zero
      uncited chess claims (manual audit).

## Phase 6 — Stretch S1 (optional, cut first on overrun)

- [ ] **6.1** Build-time native-Stockfish PV precompute (depth 25, multipv 3)
      into twin sidecar `public/engine.json`; runtime cache-first consumption;
      live engine fallback intact.

## Dependency spine

1.1 → (1.2…1.8 parallel) → 2.x (per-feature, parallel with impl) →
3.x → 4.x → 5.x. 6.1 independent after 3.2.

## Definition of done

1. All golden fixtures pass in CI (pytest) — fixtures human-reviewed.
2. `features.json` emitted deterministically; build summary reports position
   count + dedupe ratio.
3. Drill Why-click on a catalog position produces prompt v2 with VERIFIED
   FACTS; non-catalog FEN degrades to v1 with no error.
4. 4b-walkthrough recorded; ≥ +1.0 mean vs 4a baseline; zero uncited claims.
5. TS strict, lint, bundle ceiling all green (sidecar is a fetched asset,
   not a chunk).
