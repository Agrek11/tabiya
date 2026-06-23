# Tabiya Project Profile (Saved Context)

Last updated: 2026-06-23
Source: User-provided "Complete Project Brief" in chat.

## One-line product definition

Tabiya is a local-first, browser-based chess opening trainer with a hallucination-resistant AI coach: memorize openings, understand each move with deterministic explanations, and practice vs a strength-tiered engine.

## Product vision

- MVP loop: drill openings -> understand why moves are played -> play against engine.
- Moat: deterministic chess intelligence + LLM as wording layer only.
- Long-term: closed loop from real games -> leak detection -> corrective drills -> review -> opponent scouting.

## Target users and non-goals

- Target: solo improvers, club/online players, users syncing Lichess/Chess.com games.
- Non-goals: tournament platform, multiplayer/live chess, rebuilding commodity game databases.

## Constitution (locked principles)

1. Open-source dependencies only.
2. Python primary; TypeScript scoped to browser bundle.
3. No heavy AI orchestration frameworks.
4. AI deliverables must be real model work with evals.
5. Repository pattern for all persisted/catalog storage.
6. Stable human-readable line IDs forever.
7. Linear lines only (no branching trees in data model).
8. Hard cap 20 ply depth.
9. SAN everywhere; UCI only in engine internals.
10. Standalone and generalized product.
11. Local-first operation; integrations optional.
12. Backend optional by feature.
13. Weekend pace constraint.
14. Strong type discipline + lint/test gates.
15. Single square-highlight primitive.
16. Containerized distribution at milestones.

Locked moat principle (2026-06-17): do not rebuild commodity infra; only add value via deterministic analysis + coaching.

## Stack

- Frontend: React 18, TypeScript strict, Vite 5, react-chessboard, chess.js, react-router-dom v7, idb.
- Engine: stockfish.wasm in Web Worker with COOP/COEP requirements.
- Optional LLM providers: Anthropic, OpenAI, Ollama, WebLLM (lazy-loaded).
- Python build/AI scripts: Python 3.12+, uv, python-chess, pydantic v2, httpx, ruff.
- Tests: Vitest + Testing Library + jsdom/fake-indexeddb, pytest, Playwright.

## Architecture snapshot

- Build-time pipeline (`scripts.build_catalog`) emits:
  - `public/catalog.json`
  - `public/transpositions.json`
  - `public/features.json` (`EXTRACTOR_VERSION=5`)
  - legacy `public/explain/<id>.json` sidecars (pending teardown)
- Runtime SPA:
  - repositories power drill/SRS/repertoire/pattern-viz
  - features/transpositions power coaching/explain
  - optional sync with Lichess/Chess.com
  - Stockfish worker for analyze + play
  - optional BYOK/offline LLM narration

## Storage and data model

- IndexedDB (`tabiya`):
  - v1 `srs_state`
  - v2 `session_events`, `repertoire_pick`
  - v3 `lichess_games`, `lichess_oob_events`
  - v4 planned: `ghost_lines`, `game_analysis`
- localStorage: UI + provider + integration preferences.

## Key shipped features

- Drill + SRS + pattern visualization.
- Lichess + Chess.com sync and OOB detection (with transposition grace walk).
- Coach pipeline with deterministic facts + engine lines + optional LLM narration.
- Explain v2 deterministic generation for all lines.
- Play vs engine page with strength tiers and in-worker play API.

## Current roadmap gates

- Critical gate: TS runtime extractor parity with Python golden fixtures (universal coach for any FEN).
- Then: 4e coach productionization + Phase 5 closed-loop training system.
- MVP hardening target before launch: trainer + Explain v2 + catalog coach + sync/OOB + play-vs-engine.

## Known debt and pending tasks

- `Insights` mostly placeholder panels.
- `/coach` route still placeholder.
- Legacy explain authoring teardown pending (`build_explain.py`, legacy sidecars, old hooks).
- Facts are catalog-only until runtime extractor ships.
- Large uncommitted changes require checkpoint commit + deploy cycle.

## Quality bar and testing gates

- TS strict compile + ESLint (including architecture seam rules) are merge-blocking.
- Python extractor correctness locked by golden fixtures.
- Cross-browser Playwright with COOP/COEP preview.
- Bundle-size and explain-size checks active.

## Practical decision rubric for future features

Only add a feature if all apply:
- It strengthens deterministic coaching/training outcomes.
- It respects local-first and optional-backend constraints.
- It does not duplicate commodity game-database infrastructure.
- It can be evaluated with tests/fixtures and cleanly behind seam interfaces.
