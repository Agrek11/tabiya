# Tabiya Master Execution Checklist (Full-Feature, Quality-First)

Last updated: 2026-06-23
Mode: finish scoped phases, no net-new scope, no quality compromise.

## Program Rules

- No new feature ideation outside already defined phase scope.
- Every milestone closes only when all quality gates pass.
- Preserve constitution constraints (especially Articles 5, 11, 12, moat lock).
- Keep changes reviewable: small, thematic commits.
- Pushes are manual unless explicitly requested and correctly authenticated.

## Global Quality Gates (apply to every milestone)

- Type/lint:
  - `tsc -b` passes.
  - ESLint passes with all custom seam rules.
  - Ruff passes for Python.
- Tests:
  - Vitest green for changed areas.
  - Pytest green for changed areas.
  - Playwright smoke green for touched routes.
- Product quality:
  - Honest fallback behavior verified (no fake data surfaces).
  - Degraded modes validated (no provider key/token/engine edge cases).
  - Bundle/asset budgets still within limits.

---

## Stage 0: Baseline Stabilization (Immediate)

### 0.1 Checkpoint current uncommitted work
- [x] Slice and commit:
  - Explain v2 deterministic core.
  - Play-vs-engine plumbing.
  - UX/stability sweep.
- [ ] Ensure no accidental coupling or cross-cutting regressions.
- [x] Preserve all existing user edits not in scope.

### 0.2 Remove Explain v1 legacy
- [x] Remove `build_explain.py` path and legacy authored explain sidecar usage.
- [x] Remove dead hooks/components tied only to Explain v1.
- [x] Verify Explain v2 is sole active path for all lines.

Exit criteria:
- [ ] Drill explain path works end-to-end with deterministic blocks only.
- [x] No references to retired explain pipeline remain in runtime path.

---

## Stage 1: Phase 4 Completion (Critical Path)

### 1.1 4b evidence closure
- [ ] Produce `evals/coach/4b-walkthrough.md` against 4a baseline.
- [ ] Demonstrate improvement and citation-grounded behavior.

### 1.2 4c-runtime universal extractor (TypeScript)
- [ ] Implement runtime deterministic extraction for any FEN.
- [ ] Coach resolution chain: sidecar -> runtime extractor -> engine-only fallback.
- [ ] Add TS<->Python parity harness using golden fixtures.
- [ ] Lock deterministic output contract and perf guardrails.

### 1.3 4c.2 classification completion
- [ ] Ensure center and structure classification deterministic coverage.
- [ ] Add positive + near-miss fixtures for each named structure.

### 1.4 4d semantic stack
- [ ] Deterministic move-purpose tagging.
- [ ] PV-derived plan extraction.
- [ ] Opening knowledge graph integration into coach context.

### 1.5 4e production coach hardening
- [ ] Structured grounded output contract (`prose` + citations).
- [ ] Citation post-validator with retry-once then fallback.
- [ ] "Why not this move?" comparison flow complete.
- [ ] Any-position coaching surface (`/coach`) upgraded from placeholder.

Exit criteria:
- [ ] Universal coach works for catalog and non-catalog FENs.
- [ ] Hallucination guard is structural and test-verified.
- [ ] All Phase 4 acceptance checks in specs are satisfied.

---

## Stage 2: Phase 5 Completion (Closed Loop)

### 2.1 Shared analysis substrate
- [ ] Extend engine path for played-move evaluation (`searchmoves` support).
- [ ] Build cached analysis pass keyed by `(gameId, enginePreset)`.
- [ ] Background queue with cancellation/throttling/idempotency.

### 2.2 Tier 1 (must-do together)
- [ ] 5a Ghost Blunders: deterministic ghost line generation + auto-SRS injection.
- [ ] 5d Leak Detector: MCL aggregation + thresholded leak signals.
- [ ] A' Interactive Game Review: eval graph + move-level grounded panel + drill CTA.

### 2.3 Tier 2
- [ ] B' Opponent scouting (live fetch + deterministic profile, no DB clone).
- [ ] C Blunder DNA clustering from ghost data.
- [ ] D Structure-first training surface.
- [ ] F Weakness->resource recommendations from curated mapping.

### 2.4 Tier 3/4 backlog completion
- [ ] 5f-light silent coach.
- [ ] 5c transposition roulette.
- [ ] 5g gambit diversion branches.
- [ ] 5b play-vs-engine deepening/feedback loop integration.
- [ ] 5e feature-tag search.

Exit criteria:
- [ ] Full post-book loop operational from synced game to corrective drill/review.
- [ ] Tier dependencies respected and validated.
- [ ] No commodity infra duplication beyond analysis-layer value.

---

## Stage 3: Phase 6 Launch Readiness

### 3.1 Release engineering
- [ ] Hosted deployment path hardened (Cloudflare target).
- [ ] Container path (`docker compose up`) verified at milestone.
- [ ] COOP/COEP, worker behavior, and caching headers verified in deployed env.

### 3.2 Product readiness
- [ ] README/docs updated to shipped truth.
- [ ] Demo assets and launch narrative prepared.
- [ ] UX intake protocol run with external users and feedback triaged.

Exit criteria:
- [ ] Public launch package complete (hosted + container + docs).
- [ ] Metrics instrumentation for adoption outcomes is in place.

---

## Stage 4: Phase 7 Identity & Sync (Post-launch but in full-scope plan)

### 4.1 Preconditions
- [ ] Confirm phase trigger (post-launch commitment).
- [ ] Amend constitution wording where required to reflect optional backend sync.

### 4.2 Implementation
- [ ] Federated auth only (Lichess + Google + Passkey), no passwords.
- [ ] Secure cookie session model (rotation, CSRF protection, redirect hardening).
- [ ] Incremental resumable sync for scoped entities.
- [ ] First-login local adoption/merge flow.
- [ ] Account lifecycle operations (unlink/delete/export policy).

### 4.3 Verification
- [ ] Security review pass.
- [ ] Merge property tests (idempotent/commutative policy behavior).
- [ ] Multi-runtime portability checks (Cloudflare default + alternate build path).

Exit criteria:
- [ ] Identity is additive; local-first mode remains fully usable without account.

---

## Suggested Execution Rhythm

- Work in 1-week sprints with strict milestone closure.
- Maximum one "high-risk" track active at once (runtime extractor OR shared analysis queue).
- Keep a release branch only for stabilization once Stage 3 begins.

## Current Immediate Next Actions

- [ ] Finalize Stage 0 commit slicing plan by file group.
- [ ] Execute Explain v1 teardown.
- [ ] Begin Stage 1.2 runtime extractor with parity harness first (before UI expansion).
