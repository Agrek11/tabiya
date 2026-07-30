# Tabiya — Complete Project Brief

*A self-contained, exhaustive explainer (hand this to any LLM or new contributor).*

---

## 1. What it is (one line)

**Tabiya is a local-first, browser-based chess opening trainer with a hallucination-resistant AI coach.** You drill openings into muscle memory, *understand* the moves (deterministic per-move explanations), *practice* them live against a strength-tiered engine, and (roadmap) learn from your own real games. It runs entirely in the browser with no mandatory backend.

## 2. Goal / vision

- **Core loop (the product):** *memorize an opening → understand why each move is played → play it out vs the engine at your level.* That trio is the MVP.
- **North-star differentiator:** a **"universal coach"** that explains *any* legal chess position — not just a fixed catalog — using verified, computed facts so the LLM can only phrase truth, never invent it. The moat: "chess intelligence lives in deterministic code; the LLM is a scribe over verified facts."
- **Long-term:** a closed feedback loop — sync your real games → detect where you left book, blundered, or leak strategically → auto-generate corrective drills → review → scout opponents.

## 3. Target users / non-goals

- **Users:** solo club/online players who prefer drilling over watching content; players with a Lichess/Chess.com account who want to learn from their own games; self-driven improvers.
- **Not:** tournament platforms, multiplayer/live chess, broadcast tools, a games database (explicitly *not* rebuilt — see moat principle).

## 4. Design principles (the "Constitution" — immutable, override everything)

1. **Open-source only** — every dependency MIT/Apache-2/BSD/ISC/GPL. No proprietary, no "free-tier", no source-available libs.
2. **Python primary, TypeScript scoped to browser** — Python owns build/AI/scripts; TS exists only in the browser bundle. No Node backend.
3. **No heavy AI orchestration** — no LangChain/CrewAI/LlamaIndex. AI features call SDKs directly. (Lint rule blocks the imports.)
4. **AI must be real model work** — fine-tuning, RAG with eval, or agent with traced metrics. A thin LLM wrapper does not count. The eval harness is the real AI deliverable.
5. **Repository pattern for storage** — all catalog/persisted data flows through interfaces; consumers never import concrete impls. Storage swaps (JSON→SQLite→backend) are one-line DI changes.
6. **Stable line IDs forever** — IDs are human-readable slugs (`ruy-lopez-closed-main`); once published, never renumbered. SRS state keyed by them survives every catalog refresh.
7. **Linear lines only** — one tree per line, no branching variations in the data model.
8. **Hard depth cap 20 ply** — default 18, 16 quiet, 20 sharp.
9. **SAN for all moves** — Standard Algebraic Notation everywhere; UCI lives only inside the engine worker.
10. **Standalone & generalized** — works for any player; no hardcoded identities/repertoires.
11. **Local-first** — no mandatory accounts/login/telemetry; runs end-to-end on bundled assets + browser storage; cloud/AI features are additive and degrade gracefully.
12. **Backend optional** — disabling any integration degrades only that feature.
13. **Weekend pace** — never blocks the author's main work. *(Project-management constraint, not technical.)*
14. **Type discipline** — Python type hints mandatory; TS strict, no bare `any`; Ruff + ESLint merge-blocking.
15. **Single highlight primitive** — all square-highlight overlays share one component, not forks.
16. **Containerized distribution** — ships as `docker compose up` at every milestone; dual delivery (live URL + container).

**Plus the LOCKED moat principle (2026-06-17):** *Tabiya never rebuilds commodity infra (game storage, search, ratings, databases). It is an analysis/coaching layer on public data.* Every feature must earn its place by what the deterministic engine + LLM scribe **add**, not by re-storing/re-searching what Lichess/Chess.com/Chessbase already serve.

## 5. Tech stack

**Frontend (browser only):**
- React 18 + TypeScript 5 (strict) on Vite 5 / Rolldown.
- `react-chessboard` 5.10 (board UI; native lichess-style arrows via the `arrows` option), `chess.js` 1.4 (move legality, SAN/FEN/PGN, `attackers()` + move descriptors), `react-router-dom` v7, `lucide-react` (icons), `idb` (typed IndexedDB), `@fontsource/*`.
- **Engine:** `stockfish.wasm` (GPL-3, niklasf threaded build) in a Web Worker; requires cross-origin isolation (COOP `same-origin` + COEP `require-corp`) for `SharedArrayBuffer`.
- **LLM clients (all optional, BYOK):** `@anthropic-ai/sdk`, `openai`, Ollama (localhost HTTP), `@mlc-ai/web-llm` (in-browser WebGPU, Qwen2.5-1.5B). SDKs are dynamic-imported as lazy chunks (bundle budget: entry ≤187 kB gzip; currently ~170 kB).

**Build / AI / scripts (Python):**
- Python 3.12+, `uv` (env/package manager), `python-chess` (board logic, feature extraction), `pydantic` v2 (schema validation), `httpx`, `anthropic` (explain authoring — being retired), `ruff`.

**Testing:** Vitest (+ `@testing-library/react`, `fake-indexeddb`, jsdom) for TS (~460 tests); pytest for Python (catalog/features golden fixtures, ~115 feature tests); Playwright (Chromium/Firefox/WebKit) for cross-browser e2e.

## 6. Architecture (end to end)

### 6.1 Two-phase data flow

```
BUILD-TIME (Python, offline, one-shot, idempotent — `uv run python -m scripts.build_catalog`)
  Hand-authored YAML (scripts/curated/*.yml: families/variations/lines/notes/presets)
    + lichess-org/chess-openings TSV + Lichess Opening Explorer (legacy source)
    + Stockfish (sharp-line classification)
    → pydantic validation (legal moves, ≤20-ply cap, unique slugs, byte-stable)
    → emits STATIC JSON sidecars into public/:
         catalog.json          (30 families, 39 variations, 39 openings, 51 lines, presets)
         transpositions.json    (fen-hash → lineId[]; ~85 shared positions)
         features.json          (587 unique positions → ~30 features + motifs + classification,
                                 keyed by normalized-FEN sha1-16 hash; EXTRACTOR_VERSION=5)
         explain/<id>.json       (legacy per-line authored prose — being retired, see §8)
         stockfish/*             (wasm engine, lazy)

RUNTIME (React SPA, static-served; no backend required)
  catalog.json → repositories → drill engine + SRS + repertoire + pattern-viz
  features.json + transpositions.json → coach + explain + (future) universal coach
  Lichess/Chess.com APIs (CORS, opt-in) → game sync → OOB detection → IndexedDB
  Stockfish worker → analyze (coach) + play (vs-engine)
  LLM (opt-in, BYOK/Ollama/WebGPU) → coach narration
```

### 6.2 Three clean seams (Article 5)

- **Storage seam:** everything behind repository interfaces — `OpeningRepository` (JSON catalog), `SrsRepository` (Leitner state, IndexedDB), `EventsRepository` (append-only drill events), `RepertoireRepository` (preset + overrides), `LichessRepository` (games + OOB events), plus the Coach context. An ESLint rule scopes `idb` imports to storage layers only; another blocks `fetch`/`sendBeacon` from new telemetry paths.
- **Drill/pedagogy seam:** the drill engine emits events; SRS, explain, telemetry subscribe.
- **AI seam:** `ChessEngine` interface (`analyze` + `play`) and `LLMClient` interface, both fully optional and degrading.

### 6.3 IndexedDB schema (DB `tabiya`, additive migrations only)

```
v1  srs_state (keyPath line_id, index box)
v2  + session_events (autoincrement; indices timestamp/lineId/eventType), repertoire_pick (single row)
v3  + lichess_games (keyPath id), lichess_oob_events (keyPath [gameId, plyIndex])
v4 (planned) + ghost_lines, game_analysis  (Phase 5)
```
localStorage holds preferences/flags (theme, board theme, sound, repertoire preset, per-line mode/overlay prefs, Lichess token `.sensitive`, AI provider/key/model, engine preset).

### 6.4 Routes / pages

```
/                      Dashboard (Up Next, KPIs: streak/due/accuracy/mastered, collapsible OOB widget)
/repertoire            family/category-filtered opening browser (sidebar drives ?category / ?q)
/repertoire/gambits    gambits view
/drill?line= / ?queue=due / ?family= / ?opening=   Drill + Explain + Coach
/play?fen=&color=&label=   Play vs engine
/insights              analytics (honest "pending" panels; only Accuracy is real today)
/games                 connection status + sync + counts + weakest openings (real, from synced data)
/coach                 placeholder (becomes the universal "analyze any position" surface post-extractor)
/settings              appearance/sound/preset/engine/AI/Lichess/ChessCom/danger zone (sidebar anchor-nav)
/lichess/callback      OAuth PKCE code exchange
/lichess/oob/:gameId/:plyIndex   OOB position viewer (board + native arrows + Ask Coach + drill link)
```
Shell = sticky 68px TopBar + a context sidebar that renders **only** where it navigates/filters (Repertoire, Drill, Settings) — single-screen pages get no sidebar (full-width).

## 7. The AI Coach moat (the technically distinctive part)

A layered, anti-hallucination pipeline. Each layer is a typed interface and degrades independently (Article 11).

```
any FEN
 → Stockfish (analyze): bestmove + top-K PVs, cp/mateIn, depth          [shipped, 4a]
 → FeatureExtractor.extract(fen): ~30 deterministic features            [shipped, 4b]
      (material, pawn structure, king safety, center/space, files/diagonals,
       activity/outposts, tempo)
      + validated MOTIFS (forks/skewers/pins/batteries/removing-defender/hanging,
        each high|speculative via static SEE-lite + piece-safety)        [4c.1]
      + CLASSIFICATION (center type: open/closed/fixed/tension/fluid;
        named structures: IQP, hanging pawns, Maróczy, Stonewall, …)     [4c.2]
 → renderFeaturesBlock(features): facts → compact prose ("VERIFIED FACTS")
 → prompt v2 (grounded; "cite only verified facts or engine lines, else honest-hedge")
 → LLMClient (Anthropic / OpenAI / Ollama / WebGPU) → narration
 → (planned 4e) citation post-validator: every cited fact must exist in input, else retry/downgrade
```

**Key design:** the LLM's only freedom is wording — every chess *claim* it can make is already computed and handed to it. Hallucination is structurally blocked.

**How the catalog gets facts cheaply:** the Python extractor runs at **build time** over the catalog's 587 unique positions and writes `features.json`, keyed by a normalized-FEN sha1-16 hash (the same hashing the Phase-2 transposition index uses). At runtime, `SidecarFeatureExtractor.extract(fen)` hashes the FEN, looks it up → instant facts, ~0 cost. A non-catalog FEN is a hash miss → `null` → engine-only fallback.

**Golden fixtures = "spec of record":** `evals/features/golden/*.json` define expected feature output. The Python extractor must pass them; they've caught 5+ real chess-correctness bugs (bad-bishop firing every opening, hanging over-firing, king-in-front skewers, Maróczy/symmetric false-positives, …). `EXTRACTOR_VERSION` (now 5) gates incremental rebuilds.

**Coach surfaces:** in-drill "Why?" button (`WhyButton` → `CoachModal` → `useCoach` → `CoachPipeline`), and the OOB viewer's "Ask Coach". Always shows raw engine PVs alongside prose so engine truth is visible even when prose is weak. Honest baseline: ~half of bare-4a explanations are shallow — that's the baseline 4b–4e improve on.

## 8. Explain Mode v2 (deterministic — current)

**v1 problem:** the original Explain content was a pre-moat GPT batch (`build_explain.py`) — freeform beginner prose, no engine/features, LLM-guessed arrows, authored for only **1 of 51 lines**, didn't scale, Article-4-weak.

**v2:** content is **generated at runtime, deterministically, for all 51 lines** — zero authoring:
- **`moveAnnotator.annotateExplainPly`** (pure): from the real board via chess.js, classifies each move — develop / capture / castle / central push / wing push / the concrete enemy pieces it now attacks (via `attackers()`) / check — into grounded prose ("`3. Bc4 — develops the bishop, attacking the pawn on f7.`"). Enriched with one structural fact from `features.json` when meaningful (a validated motif / IQP). No Stockfish (book moves are good by definition; the "why" is developmental, not centipawns).
- **`generateExplainBlocks`** walks the line, hashes each resulting position, pulls features via `SidecarFeatureExtractor`, annotates. **`useExplainBlocks`** runs it per active line.
- **UI:** drill-size board left, narration rail right (matches drill), native lichess arrows, clean board (no forced dimming), per-ply autoplay (dwell 1200 ms + 150 ms beat), keyboard ←/→ step + space pause, pattern-viz spotlight only when the user toggles it.
- **Decision (locked):** deterministic core now; **optional LLM polish layer** later (rewrites the deterministic clauses into smoother prose, grounded/cite-only, off by default — *not yet built*).
- Teardown pending: delete `build_explain.py` + the legacy authored sidecar + `useExplainContent`.

## 9. Play vs Engine (5b — current)

From the end-of-line summary, "Play vs engine ↗" launches `/play` from the line's final position, your color. Six strength tiers mapped to Stockfish options in the worker: **800 / 1200** via `Skill Level` (UCI_Elo floor is ~1320), **1700 / 2000 / 2200 / 2500+** via `UCI_LimitStrength` + `UCI_Elo`. The engine `play(fen, {elo, movetimeMs})` path was added to the worker + `ChessEngine` interface; the shared worker resets to full strength for any subsequent Coach analysis. Interactive board, status (check/mate/draw detection), new-game/resign, live strength switching.

## 10. Game sync + Out-of-Book (Phase 3)

- **Lichess:** OAuth 2.0 PKCE entirely in-browser (`crypto.subtle`, no client secret, no backend callback); reads public games (NDJSON stream, last 100 games OR 15 days). **Chess.com:** no auth (public monthly-archive API), username find/confirm flow. Both APIs are CORS-friendly. Explicit "Sync now" gesture (Article 11) — connecting ≠ importing.
- **OOB detector** (`detect-oob.ts`, pure): walks each game vs the user's *picked* repertoire (the Phase-1.5 `EffectivePick`), emits an `OOBEvent` at the first divergence on the user's move. **Transposition grace-walk:** when the linear walk diverges, it continues up to `GRACE_PLIES` (4), hashing positions and consulting the transposition index, to rescue move-order transpositions. **Move-1 divergences are suppressed as noise** (`MIN_OOB_PLY = 2`).
- Surfaces on the Dashboard OOB widget (collapsible, "out by move N") → `/lichess/oob/...` viewer (board with red=played / green=book native arrows, drill-this-line link, Ask Coach).

## 11. Phase history & roadmap

**Shipped (tagged v0.1 → v1.6+):** 0a skeleton · 0b catalog build · 0c storage interface · 0d UI/UX rebuild · 1 SRS data layer · 1b explain mode (v1) · 1c v1 completeness · 1.5 telemetry/events · 2 pattern visualization (key squares + spotlight) + transposition index · 3 Lichess + Chess.com sync + OOB · 4a engine+LLM coach · 4b deterministic features · 4c.1 validated motifs · 4c.2 position classification.

**Recent (may be uncommitted at time of writing):** large stabilization sweep (killed UI-rebuild wiring debt — real pages, honest "pending" surfaces, functional sidebar, fixed drill stats, OOB UX); **Explain v2 deterministic** (universal, all lines); **Play vs engine**; native arrows; board-theme default → Lichess brown; many UX fixes.

**Planned / spec'd, not built:**
- **4c-runtime — universal coach (THE gate):** a TypeScript port of the Python extractor, parity-locked to the same golden fixtures (byte-equal), so `CoachPipeline` resolves facts for *any* FEN (sidecar hit → runtime extractor → engine-only). Unblocks 4e + all of Phase 5.
- **4d** plans + opening knowledge graph. **4e** production coach ("why not this move", real-game coaching, paste-a-FEN).
- **Phase 5 — post-book mastery / closed loop:** Tier 1 (5a Ghost Blunders → auto-SRS injection, 5d Leak Detector → mean-centipawn-loss, A′ interactive game review) sharing one engine eval pass; Tier 2 (B′ opponent scouting via live-fetch + our profile *no DB*, C Blunder DNA, D structure-first training, F weakness→resource recommendations); Tier 3 (5f-light silent coach, 5c transposition roulette, 5g gambit branches); Tier 4 (5b play-vs-engine *partly built now*, 5e feature-tag search).
- **Phase 6 — Launch:** Cloudflare Pages/Workers/D1 deploy (artifacts ready: `_headers` with COOP/COEP + cache rules, `_redirects` SPA fallback). Cloud-agnostic core (Hono handlers, `SyncStore` interface) so AWS is an alternate.
- **Phase 7 — Identity:** federated-only login (no passwords), server-side sync — built at public launch.

**MVP cutoff (decided 2026-06-19):** trainer + Explain v2 + Coach (catalog) + sync/OOB + **play-vs-engine** → harden → **Cloudflare deploy**. The runtime extractor + Phase 5 closed loop are **post-launch** (they need the extractor; play-vs-engine and deterministic explain do not).

## 12. Key technical decisions (with rationale)

- **Build-time feature precompute, hash-keyed sidecar** — catalog coaching is ~0-cost at runtime, offline, reviewable; the runtime extractor is only for the off-book long tail.
- **LLM as scribe over verified facts** — the only Article-4-honest way to use an LLM for chess without hallucination; golden fixtures keep the facts correct.
- **Deterministic Explain (move semantics + features), not GPT prose** — accurate, consistent, free across all lines, no API dependency; LLM polish is optional sugar.
- **No Stockfish for Explain** — opening book moves are good by definition; the "why" is developmental, so engine eval adds nothing.
- **Transposition index reused everywhere** — OOB grace-walk, transposition roulette, gambit branches — one deterministic primitive.
- **Move-1 OOB suppression** — opening with a different first move is a choice, not a leak.
- **Sidebar only where it navigates/filters; honest "pending" over fabricated data** — stabilization principle after the UI rebuild shipped pretty-but-fake surfaces.
- **Native react-chessboard arrows over custom SVG** — lichess-quality arrowheads for free.
- **Lazy-import LLM SDKs + bundle-budget gate** — entry chunk ~170 kB gzip (≤187 kB ceiling) despite three LLM providers.
- **Cloud-agnostic launch** — revenue model is hosted-narration paywall + (later) affiliate resource links; Cloudflare first, AWS alternate.

## 13. Testing & quality gates

- TS: ~460 Vitest tests; `tsc -b` strict; ESLint (incl. `no-explicit-any` error-level, custom seam rules) merge-blocking.
- Python: pytest with golden feature fixtures (TS↔Python parity is the eval that keeps the future runtime extractor honest); Ruff.
- Cross-browser Playwright e2e (Chromium/Firefox/WebKit) with a preview server that sets COOP/COEP.
- Bundle-budget + explain-size scripts.

## 14. Known gaps / debt (honest)

- Insights page is mostly honest "pending" panels (needs event-history aggregation).
- `/coach` is a placeholder until the runtime extractor lands.
- LLM-polish for Explain, and `build_explain.py` teardown, still pending.
- Coach facts are catalog-only until the runtime (TS) extractor ships — the single dependency gating the whole "learn from your games" half of the product.
- (At time of writing) a large body of work is uncommitted (Explain v2 + play mode + UX fixes); next checkpoint is a commit + Cloudflare deploy.
