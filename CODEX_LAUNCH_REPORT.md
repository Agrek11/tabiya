# Tabiya launch-hardening report

Date: 2026-07-30

## Initial state

- Repository: `/workspaces/personal/AI/Projects/tabiya`
- Branch: `main`; starting commit: `08eac82`.
- The working tree was already substantially dirty. All pre-existing local changes and untracked advanced systems were preserved.
- `origin` fetch was attempted but unavailable because the configured SSH host could not resolve.

## Truth gate and positioning

The local checkout includes persisted corrective-drill synthesis, review, game analysis, and tests. The appropriate supported promise is: “Stop repeating the same opening mistakes. Connect your games, find where your opening preparation breaks, and train the exact correction until it sticks.” Coach narration remains experimental.

See `docs/capability-matrix.md` for evidence and exclusions.

## Changes made in this pass

- Added a typed Stockfish worker protocol with per-request cancellation, cancellation responses, FEN validation, bounded options, readiness/request timeouts, abort-listener cleanup, dispose/fatal rejection, and loader retry reset.
- Repaired a local GameAnalysisQueue single-flight race and a conditional-hook Drill failure; focused tests pass.
- Added Node `>=22.12.0`, `.nvmrc`, local Wrangler, static-asset `wrangler.jsonc`, deployment scripts, asset verification, COOP/COEP/CORP/CSP headers, and a Workers dry-run workflow.
- Updated Docker's Node builder and nginx security/SPA configuration.
- Removed Google Fonts from `index.html`; bundled Fontsource assets remain.
- Made desktop/mobile primary navigation exactly Today, Train, Games, Progress, Settings; added a skip link, safe-area-aware mobile navigation, reduced-motion styling, and an actual Not Found route.
- Added Cloudflare, security/privacy, AI-evaluation, capability, and third-party-notice documentation.
- Brought TypeScript runtime feature extraction into strict parity with the Python feature rules for tempo, trapped pieces, and deterministic fork ordering; the full 114-case golden corpus now passes.
- Retired the stale test for the intentionally removed Phase-1b Python authoring pipeline and added runtime Explain-generator tests for the supported v2 architecture.
- Applied Ruff's safe fixes and formatting to the Python toolchain; the full Python quality gate now passes.
- Raised the Docker builder from Node 22.12 to 22.13 to satisfy the locked frontend tooling's declared Node engine floor.
- Added a versioned, locally dismissible first-run dashboard guide with direct paths to repertoire selection, drilling, and optional game sync.
- Completed the learning loop: local clean-recall retention, study time, and opening performance now power Insights and a dedicated lazy-loaded Progress route; dashboard focus persists locally and turns due reviews, correction drills, Blunder DNA, and structure signals into an actionable study plan.

## Verification evidence

Passing:

- `npm run lint`
- `npm run typecheck`
- `npx vitest run tests/engine/StockfishWasmEngine.test.ts tests/analysis/GameAnalysisQueue.test.ts tests/drill-page.test.tsx` — 22 passed, 5 skipped.
- `npm run build`
- `npm run check:bundle` — entry gzip 186,945 B, ceiling 188,000 B.
- `npm run check:assets` — largest required asset `features.json`, 1,212,376 bytes; Cloudflare individual static-asset limit used: 25 MiB.
- `npx wrangler deploy --dry-run` — passed; no deployment occurred.
- `uv sync --all-extras --frozen` — passed.
- React Router updated within major 7 to 7.18.1; npm audit still reports an RSC-mode advisory whose available fix requires a major upgrade.
- `npm run test:unit` — 615 passed, 8 skipped.
- `npx vitest run tests/coach/RuntimeFeatureExtractor.golden.test.ts` — 114 passed.
- `uv run ruff check .` and `uv run ruff format --check .` — passed.
- `uv run pytest` — 288 passed.
- `npm run test:e2e:wrangler` — 7 Chromium Workers smoke tests passed.

Known blockers:

- Docker daemon access is available. The frontend image has not yet been verified: both local builds stopped at `npm ci` without producing the local verification tag; the Dockerfile builder was corrected to Node 22.13 to satisfy dependency engines.

## Security and privacy

Value-redacted secret scanning found test fixtures, documentation, and non-secret references; no secret value was printed or added by this pass. Production policy permits only self plus the specific Lichess, Chess.com, OpenAI, Anthropic, and user-selected local Ollama origins necessary to current code. No analytics was added.

## Remaining human/credential checks

- Complete the manual ten-position Coach review.
- Test OAuth callback URLs with real Lichess credentials on the final workers.dev/custom domain.
- Restore the environment/CI trusted CA chain so future Playwright provisioning does not need a temporary TLS workaround.
- Complete Docker image/runtime verification.

## Recommendation

**DO NOT DEPLOY YET**. Local unit, Python, static-asset, Workers dry-run, and Chromium browser-smoke gates are green, but Docker image verification remains incomplete. Once it and the human credential checks above complete, the real deployment command is `npm run cf:deploy`; it has not been executed.
