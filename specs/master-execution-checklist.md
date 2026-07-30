# Tabiya Master Execution Checklist (Full-Feature, Quality-First)

Last updated: 2026-07-07
Mode: finish scoped phases, no net-new scope, no quality compromise.

## What These Stages Mean

- **Stage 0 — Baseline Stabilization**
  - Goal: clean up and lock the foundation before major new work.
  - In practice: commit slicing + removing old Explain v1 pipeline.
  - Why it exists: prevents carrying legacy debt into Phase 4/5.

- **Stage 1 — Phase 4 Completion (AI coach core)**
  - Goal: finish the universal, grounded coach.
  - In practice: runtime extractor parity, classification completion, 4d semantic stack, 4e citation-safe coach behavior.
  - Why it exists: this is the technical moat and quality gate for “coach any position.”

- **Stage 2 — Phase 5 Completion (closed-loop training)**
  - Goal: turn synced real games into corrective practice loops.
  - In practice: shared analysis pass, ghost blunders, leak detector, interactive review, then tier-2/3/4 items.
  - Why it exists: this is where long-term user improvement and retention come from.

- **Stage 3 — Phase 6 Launch Readiness**
  - Goal: make the product reliably shippable publicly.
  - In practice: deploy hardening, docs/demo/UX intake, hosted + container validation.
  - Why it exists: feature-complete is not launch-ready unless operations and UX are hardened.

- **Stage 4 — Phase 7 Identity & Sync**
  - Goal: optional account-backed sync after launch baseline is stable.
  - In practice: federated auth, secure sessions, resumable sync, merge semantics, security review.
  - Why it exists: useful but should not block core local-first product delivery.

## Current Status Snapshot

- **Completed now:** Stage 0.1 and 0.2 (checkpoint commits + Explain v1 teardown).
- **Next active stage:** Stage 1.1 (4b evidence closure), then Stage 1.2+.
- **Rule:** only one high-risk stream at a time; pass quality gates before moving stages.

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
- [x] Implement runtime deterministic extraction for any FEN.
- [x] Coach resolution chain: sidecar -> runtime extractor -> engine-only fallback.
- [x] Add TS<->Python parity harness using golden fixtures.
- [x] Lock deterministic output contract and perf guardrails.
  - Runtime extractor contract now documented at `specs/phase-4-ai-coach/runtime-extractor-contract.md` (deterministic shape, fallback guarantees, parity source-of-truth).
  - Runtime memoization and strict golden assertions are in place across all shipped fixture families.

### 1.3 4c.2 classification completion
- [x] Ensure center and structure classification deterministic coverage.
- [x] Add positive + near-miss fixtures for each named structure.
  - Classification families are now strict in golden parity (`classification.center`, `classification.structures`).

### 1.4 4d semantic stack
- [x] Deterministic move-purpose tagging.
- [x] PV-derived plan extraction.
- [x] Opening knowledge graph integration into coach context.
  - Implemented semantic extraction + plan hints + lightweight opening KG node lookup in coach context and prompt path.

### 1.5 4e production coach hardening
- [x] Structured grounded output contract (`prose` + citations).
- [x] Citation post-validator with retry-once then fallback.
  - Implemented in `CoachPipeline` with structured-citation validation when `LLMResponse.parsed` is present.
- [x] "Why not this move?" comparison flow complete.
  - Same-position constrained engine analysis (`searchmoves`) with SAN legality validation.
  - Retry + guarded loading/error UX on review and coach surfaces.
- [x] Any-position coaching surface (`/coach`) upgraded from placeholder.

Exit criteria:
- [ ] Universal coach works for catalog and non-catalog FENs.
- [ ] Hallucination guard is structural and test-verified.
- [ ] All Phase 4 acceptance checks in specs are satisfied.

---

## Stage 2: Phase 5 Completion (Closed Loop)

### 2.1 Shared analysis substrate
- [x] Extend engine path for played-move evaluation (`searchmoves` support).
- [x] Build cached analysis pass keyed by `(gameId, enginePreset)`.
- [x] Background queue with cancellation/throttling/idempotency.

### 2.2 Tier 1 (must-do together)
- [x] 5a Ghost Blunders: deterministic ghost line generation + auto-SRS injection.
- [x] 5d Leak Detector: MCL aggregation + thresholded leak signals.
- [x] A' Interactive Game Review: eval graph + move-level grounded panel + drill CTA.

### 2.3 Tier 2
- [x] B' Opponent scouting (live fetch + deterministic profile, no DB clone).
- [x] C Blunder DNA clustering from ghost data.
- [x] D Structure-first training surface.
- [x] F Weakness->resource recommendations from curated mapping.

### 2.4 Tier 3/4 backlog completion
- [x] 5f-light silent coach.
- [x] 5c transposition roulette.
- [x] 5g gambit diversion branches.
- [x] 5b play-vs-engine deepening/feedback loop integration.
- [x] 5e feature-tag search.

Exit criteria:
- [x] Full post-book loop operational from synced game to corrective drill/review.
- [x] Tier dependencies respected and validated.
- [x] No commodity infra duplication beyond analysis-layer value.
  - Loop verified across `/games` → `/review/:gameId` → ghost injection → `/drill` correction flow.
  - Tiered dependencies now land on shared analysis substrate; no duplicate game-db or commodity sync storage added.

---

## Stage 3: Phase 6 Launch Readiness

### 3.1 Release engineering
- [ ] Hosted deployment path hardened (Cloudflare target).
- [ ] Container path (`docker compose up`) verified at milestone.
- [ ] COOP/COEP, worker behavior, and caching headers verified in deployed env.
  - In progress: cloud-agnostic deployment docs added under `infra/` for Cloudflare primary + AWS alternate.

### 3.2 Product readiness
- [x] README/docs updated to shipped truth.
- [x] Demo assets and launch narrative prepared.
  - Demo narrative added at `specs/phase-6-launch/demo-narrative.md`.
- [ ] UX intake protocol run with external users and feedback triaged.
  - In progress: Phase 3 smoke checklist added at `specs/phase-3-lichess-sync/smoke-checklist.md`.

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

- [ ] Complete Stage 1.1 evidence closure in `evals/coach/4b-walkthrough.md`.
- [ ] Run live provider/account validations (Lichess/Chess.com + BYOK providers).
- [ ] Execute hosted deployment and post-deploy verification.
