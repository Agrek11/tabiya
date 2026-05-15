# Architecture

System view of tabiya: components, data flow, repository seams, layered AI Coach pipeline, deployment model. For the project's why and roadmap see [about.md](./about.md). For binding decisions see [design-decisions.md](./design-decisions.md). For the feature catalog see [features.md](./features.md).

## High-level data flow

```
                  ┌────────────────────────────────────┐
                  │ Authoring sources (offline, manual)│
                  │  • scripts/curated/*.yml (hand)    │
                  │  • lichess-org/chess-openings TSV  │
                  │  • Lichess Opening Explorer API    │
                  │  • Stockfish (sharp-line classify) │
                  └─────────────┬──────────────────────┘
                                │  uv run python -m scripts.build_catalog
                                ▼
                  ┌────────────────────────────────────┐
                  │  Python build pipeline             │
                  │  scripts/build_catalog.py          │
                  │  + Phase 1b: validate_explain.py   │
                  │  + Phase 2:  build_key_squares     │
                  │              build_transposition   │
                  │  Schema = pydantic v2              │
                  └─────────────┬──────────────────────┘
                                │  emits
                                ▼
                  ┌────────────────────────────────────┐
                  │  Static bundle (checked into repo) │
                  │  • public/catalog.json (~76 KB)    │
                  │  • public/explain/<line_id>.json   │  ← Phase 1b
                  │  • public/transposition.json       │  ← Phase 2
                  │  • public/stockfish.wasm (lazy)    │  ← Phase 4a
                  └─────────────┬──────────────────────┘
                                │  served by Vite (dev) / nginx (prod)
                                ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                  React + TypeScript SPA                         │
   │                                                                 │
   │   Repository layer (Article 5 — all storage behind interfaces)  │
   │   ├── OpeningRepository        (catalog reads)                  │
   │   ├── SrsRepository            (Leitner state, IndexedDB)       │
   │   ├── EventsRepository         (session events, IDB)   [P1.5]   │
   │   ├── RepertoireRepository     (preset + overrides, IDB)[P1.5]  │
   │   ├── LichessRepository        (games + OOB events, IDB)[P3]    │
   │   └── CoachContextRepository   (engine + LLM context)   [P4]    │
   │                                                                 │
   │   UI layer                                                      │
   │   ├── AppShell + Sidebar + TopBar                               │
   │   ├── 5 routed pages (Dashboard, Repertoire, Drill,             │
   │   │                   Progress, Settings)                       │
   │   ├── Drill engine + Explain hook + Coach hook                  │
   │   └── Board overlays: HighlightLayer + ArrowLayer +             │
   │                       SpotlightOverlay (Article 15)             │
   └─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────────┐
                ▼               ▼                   ▼
       browser storage    Lichess API         LLM (cloud or local)
       IndexedDB          (opt-in, P3)        (opt-in, P4)
       localStorage       OAuth PKCE          • Anthropic
                          CORS-friendly       • OpenAI
                          no backend          • Ollama (localhost)
                                              • llama.cpp WebGPU
```

Three clean seams across the whole app: **storage seam** (everything through repository interfaces), **drill / pedagogy seam** (drill engine emits events; SRS, explain, telemetry subscribe), **AI seam** (engine + LLM behind interfaces, fully optional, degrades cleanly).

## Tech stack

Open source only. Latest stable as of 2026. See `specs/tech.md` for the full per-package license declaration (Constitution Article 1 binding).

### Runtime + language

| Area | Choice | Why |
| --- | --- | --- |
| Backend / build / AI | Python 3.12+ | Article 2 — primary project language; ML ecosystem lives here |
| Frontend | TypeScript 5+ strict on React 18+ | Article 2 — TS scoped to browser only; strict mode merge-blocking |
| Bundler / dev | Vite 5+ | Fast HMR, simple static-asset story |
| Engine | Stockfish (GPL-3) | WASM build for Phase 4a, in Web Worker; standalone binary for catalog-build sharp-line classification |

### Frontend dependencies

| Package | License | Purpose |
| --- | --- | --- |
| `react` + `react-dom` | MIT | UI framework |
| `react-chessboard` (Clariity) | MIT | Chess board UI component |
| `chess.js` (jhlywa) | BSD | Move validation, SAN/FEN/PGN, legal moves |
| `react-router-dom` v7 | MIT | Routing for 5 pages + future /coach + /lichess/* |
| `lucide-react` | ISC | Icon set |
| `tailwindcss` | MIT | Utility-first CSS |
| `idb` | ISC | IndexedDB wrapper (typed) |
| `vitest` | MIT | Unit tests |
| `fake-indexeddb` (dev) | MIT | IDB simulator for tests |
| `@anthropic-ai/sdk` (P4a) | MIT | Direct LLM API; prompt caching on system+few-shot |
| `openai` (P4a) | Apache-2 | Direct LLM API |

### Python dependencies

| Package | License | Purpose |
| --- | --- | --- |
| `python-chess` | GPL-3 | PGN/FEN/SAN parsing, board state, UCI bridge, feature extraction (P4b) |
| `httpx` | BSD | Async HTTP for Lichess Explorer API + Chess.com API |
| `pydantic` v2 | MIT | Typed data models, schema validation |
| `fastapi` (P4 backend, optional) | MIT | API layer if local LLM via backend |
| `uvicorn` | BSD | ASGI server |
| `pytest` | MIT | Test runner |
| `ruff` | MIT | Lint + format (replaces flake8 + black + isort) |
| `uv` | Apache-2 | Package + venv manager |
| `anthropic` (P1b authoring + P4) | MIT | Direct SDK for explain-block batch authoring + coach |
| `transformers` + `peft` (P4 stretch) | Apache-2 | HuggingFace for fine-tune lane |
| `torch` (P4 stretch) | BSD | PyTorch runtime |

All MIT / Apache-2 / BSD / GPL / ISC. No proprietary, no "free-tier" libraries, no source-available licenses.

## Repository pattern (Article 5)

All persistent state and catalog data flow through interfaces. Consumers never import concrete implementations directly. The DI container lives in `src/storage/index.ts` (legacy path) and `src/repository/container.ts` (Phase 1.5+).

| Interface | Concrete impl(s) | Backing store | Phase introduced | Surface |
| --- | --- | --- | --- | --- |
| `OpeningRepository` | `JsonOpeningRepository` | `public/catalog.json` (read-only) | 0c | Catalog reads: families, variations, openings, lines, search, gambits |
| `SrsRepository` | `IndexedDbSrsRepository`, `InMemorySrsRepository` (tests) | IndexedDB store `srs_state` | 1 | Leitner box state CRUD: due queue, promotion/demotion, mastery |
| `EventsRepository` | `IndexedDbEventsRepository` | IndexedDB store `session_events` | 1.5 | Append-only drill events: streaks, heatmap, accuracy aggregation |
| `RepertoireRepository` | `IndexedDbRepertoireRepository` | IndexedDB store `repertoire_pick` (single row) | 1.5 | Preset id + additions + removals; computes `EffectivePick` |
| `LichessRepository` | `IndexedDbLichessRepository` | IndexedDB stores `lichess_games` + `lichess_oob_events` | 3 | Game sync, OOB detection results, position viewer |
| `CoachContextRepository` | (in-memory v1) | none in 4a; future IDB | 4a | Cached `CoachContext` by `(lineId, plyIndex, preset, model)` |

Concrete impls are wired by the DI container (`getOpeningRepository()`, `getSrsRepository()`, …). Tests use `_setSrsRepositoryForTesting(…)` style escape hatches. The repository swap from JSON to SQLite (planned v2) or backend-served (Phase 4 if a backend lands) is a one-line DI change — zero consumer changes.

### ESLint guardrails

An ESLint rule scopes `idb` imports to `src/repository/` and `src/storage/` only. Components and hooks importing `idb` directly fail the build. Same posture for Article 11: a lint rule blocks `fetch`/`sendBeacon`/non-self `postMessage` from new telemetry code paths.

## Storage layer

### IndexedDB schema evolution

```
DB_NAME = 'tabiya'

v1  ──  srs_state                     (keyPath: line_id, index: box)
       └ shipped Phase 1

v2  ──  srs_state                     (unchanged)
        session_events                (keyPath: id autoIncrement,
                                       indices: timestamp, lineId,
                                       eventType, lineId_timestamp)
        repertoire_pick               (out-of-line key, single row 'current')
       └ Phase 1.5 — migration is strictly additive

v3  ──  + lichess_games               (keyPath: id)
        + lichess_oob_events          (keyPath: [gameId, plyIndex])
       └ Phase 3 — strictly additive

future ─ + coach_context_cache        (optional, only if 4a's in-memory
                                       cache proves insufficient)
```

Each version bump runs an idempotent `runMigrations(db, oldVersion)` block. No store is ever dropped or rewritten. Tests under `tests/events/migration.spec.ts` assert that a v1 DB with seeded SRS records survives the upgrade to v2 with zero data loss.

### localStorage keys

User preferences and feature flags. Article 11 — local only.

| Key | Purpose | Introduced |
| --- | --- | --- |
| `tabiya.theme` | light / dark | 0d.1 |
| `tabiya.boardTheme` | one of 6 board presets | 0d.2 |
| `tabiya.sound` | sound v2 settings | 0d.2 |
| `tabiya.repertoirePreset` | active preset id (Beginner/Intermediate/Advanced/off) | 0d.4 |
| `tabiya:linePrefs:<lineId>:mode` | drill vs explain per-line | 1b |
| `tabiya:linePrefs:<lineId>:keySquareOverlay` | spotlight on/off per-line | 2 |
| `tabiya:linePrefs:<lineId>:ttsMute` | per-line TTS mute | 1b |
| `tabiya:flag:explainTts` | global TTS feature flag | 1b |
| `tabiya.heatmapTab` | last-selected heatmap tab | 1.5 |
| `tabiya.lichess.token.sensitive` | Lichess OAuth token (PKCE) | 3 |
| `tabiya.ai.location` | cloud / local-ollama / local-webgpu | 4a |
| `tabiya.ai.provider` | anthropic / openai | 4a |
| `tabiya.ai.model` | model id string | 4a |
| `tabiya.ai.apiKey` | user-supplied LLM API key | 4a |
| `tabiya.engine.preset` | Fast / Balanced / Deep | 4a |

The Lichess token key carries the `.sensitive` suffix as a documentation marker; v1 stores it plain. Token encryption-at-rest with a user passphrase is tracked as an open question.

## UI layer

### Routes + pages

```
/                          → DashboardPage      (drill due, streaks, accuracy, heatmap, OOB widget)
/repertoire                → RepertoirePage     (family grid, line picker, RepertoirePicker)
/drill?line=<id>           → DrillPage          (board + drill or explain + coach Why?)
/drill?queue=due           → DrillPage          (queue mode, cycles due lines)
/progress                  → ProgressPage       (per-line mastery, attempts, hint uses)
/settings                  → SettingsPage       (theme, sounds, presets, danger zone, AI, engine, Lichess)
/lichess/callback          → LichessCallback    (Phase 3 — OAuth code exchange)
/lichess/oob/:gameId/:ply  → OOBPositionViewer  (Phase 3 — out-of-book position viewer)
```

### Shell

```
AppShell
├── Sidebar          — nav, due badge (hides at 0)
├── TopBar           — page title, contextual actions
└── <main>           — routed page
```

Primitives (in `src/ui/`):

- `<Card>`, `<Button>`, `<PageHeader>`, `<StateMessage>`, `<StatusStrip>` — locked Phase 0d.1
- `<ChessBoardPanel>` — wraps `react-chessboard`, exposes `<board-overlay>` slot
- `<HighlightLayer>` — single board-square overlay primitive (Article 15)
- `<ArrowLayer>` — SVG arrow overlay between squares (Phase 1b)
- `<SpotlightOverlay>` — dim non-key + glow key squares (Phase 2; consumes HighlightLayer)
- `<ModeToggle>` — Drill / Explain segmented control (Phase 1b)
- `<TruncatedText>` — soft-truncate at 280 chars + show-more (Phase 1b)

### Drill engine

`useDrill(line)` is the state machine. States: `idle → ready → waiting → playing → checking → feedback → complete`. Emits events at every transition. Owns one `chess.js` instance per line; never leaks across mode switches (mounted under React `key={mode-lineId}`).

Sibling hook `useExplainMode(line, blocks)` (Phase 1b) walks both colors ply-by-ply with overlays and rationale, reusing the same chess.js iterator pattern. Mode switching mid-line dispatches `RESET` and remounts; no shared state across modes.

`useCoach(lineId, plyIndex)` (Phase 4a) calls `CoachPipeline.run()` → engine analyze → LLM complete. Results cached in-memory by `(lineId, plyIndex, enginePreset, modelName)`.

### Board overlay system (Article 15)

One highlight primitive across every overlay feature the project will ever ship. Different "modes" via a discriminated mode prop, not different components:

```
<HighlightLayer
  squares={[{ square: 'd5', intent: 'focus' }, ...]}
  mode='bright' | 'spotlight'
/>

mode='bright'     → colored tint per square (Explain Mode default)
mode='spotlight'  → dim non-listed squares with one big overlay + cutouts at listed squares
                     glow per square colored by intent.role (Phase 2 Pattern Viz)
```

`<ArrowLayer>` is a *sibling* primitive (not a fork) — single `<svg>` overlay sized to the board, one path with marker-end per arrow. Coordinates derived from `react-chessboard`'s known square size + flip state via `getSquarePixel(square, isFlipped, boardSize)`.

The Phase 4e visual highlights (red threats, blue outposts, yellow weak squares, plan icons) reuse `<HighlightLayer>` with new `intent` values. No new overlay primitive is ever introduced.

## AI Coach 5-layer pipeline

Phase 4a–4e. Layered architecture; each downward arrow is a typed interface; each layer may be bypassed (Article 11 invariant — every layer degrades gracefully).

```
                  PGN / FEN / live drill ply
                            │
                            ▼
                  Position Extractor          (chess.js / python-chess)
                            │
                            ▼
              ┌─────────────────────────┐
              │  Stockfish (4a)         │  ──── ACTIVE BUILD
              │  WASM in Web Worker     │       Output: bestmove SAN + top-K PVs
              └────────────┬────────────┘             eval cp / mateIn, depth, engineName
                           │
                           ▼
              ┌─────────────────────────┐
              │  Feature Extractor      │  ──── Phase 4b (future)
              │  python-chess rules     │       Output: ~30 features per position
              │  Pyodide or backend     │       (development, center, king safety, pawn structure,
              └────────────┬────────────┘        open files, outposts, motifs candidates, ...)
                           │
                           ▼
       ┌──────────────────────────────────┐
       │  Position Classifier             │  ──── Phase 4c (future)
       │  + Motif Detector                │       Output: type (open/closed/semi-open),
       │  heuristic rules                 │               sharpness (tactical/positional/mixed),
       │                                  │               pawn_structure[] (iqp/hedgehog/maroczy...),
       │                                  │               Motif[] (pin/fork/skewer/minority-attack/...)
       └────────────┬─────────────────────┘
                    │
                    ▼
       ┌──────────────────────────────────┐
       │  Semantic Tagger                 │  ──── Phase 4d (future)
       │  + Plan Extractor                │       Output: MovePurpose[] for candidate move,
       │  + Opening Knowledge Graph       │               Plan[] (8–12 ply walk segmented by purpose),
       │  hand-curated KG +               │               OpeningKGNode with named_plans + counterplay
       │  bootstrapped from P1b/P2        │
       └────────────┬─────────────────────┘
                    │
                    ▼
       ┌──────────────────────────────────┐
       │  Grounded Prompt Builder         │  ──── Phase 4e (future)
       │  labelled-section template       │       Output: PromptPayload with explicit
       │  + hallucination block           │               [ENGINE_OUTPUT] [FEATURES]
       │                                  │               [POSITION_CLASS] [MOTIFS]
       │                                  │               [SEMANTIC_TAGS] [PLAN] [KG_FACTS]
       │                                  │       LLM constrained: cite only what is provided
       └────────────┬─────────────────────┘
                    │
                    ▼
       ┌──────────────────────────────────┐
       │  LLMClient                       │  ──── 4 concrete impls in 4a
       │  Anthropic / OpenAI / Ollama /   │       direct SDK calls only (Article 3)
       │  llama.cpp WebGPU                │       prompt caching on system + few-shot
       └────────────┬─────────────────────┘
                    │
                    ▼
       ┌──────────────────────────────────┐
       │  Post-validator (4e)             │       Assert: every cited tag / motif / feature
       │  citation enforcement            │               in LLMResponse exists in input.
       │                                  │       If not: retry once, else downgrade to engine-only.
       └────────────┬─────────────────────┘
                    │
                    ▼
                 UI Surfaces
                 A = in-drill Why? button         (Phase 4a)
                 B = OOB list "Ask Coach"          (Phase 4e — consumes Phase 3 OOBEvent)
                 C = free-form chat sidebar       (Phase 4e)
```

The point of the symbolic stack is that **chess intelligence lives in code, prose is a render target**. By Phase 4e the only freedom the LLM has left is wording — every chess claim it can make is already in the input bundle. Hallucination is structurally blocked.

4a alone is the *honest baseline* the moat layers replace. Its UI always shows raw engine PVs alongside the LLM prose so the user sees engine truth even when prose is weak. The "honest acceptance" of 4a (R9.9): roughly half of 4a explanations will feel shallow or generic. That is acceptable — it is the baseline 4b–4e measure against.

## Catalog build pipeline

Offline, one-shot, idempotent. Re-runnable any time. Stable line IDs across refreshes (Article 6).

```
                  ┌────────────────────────────────────┐
                  │  scripts/curated/                  │
                  │  • families.yml (30 entries)       │
                  │  • variations.yml (39 entries)     │
                  │  • lines.yml (51 entries)          │
                  │  • notes.yml (strategic_notes +    │
                  │              key_squares overlay)  │
                  │  • presets.yml (Beginner/Inter/    │
                  │                 Advanced + lines)  │
                  └─────────────┬──────────────────────┘
                                │  pydantic v2 validation
                                ▼
                  ┌────────────────────────────────────┐
                  │  scripts/build_catalog.py          │
                  │   --source curated-v2 (default)    │
                  │   --source curated (legacy)        │
                  │   --source flat-tsv (analysis)     │
                  └─────────────┬──────────────────────┘
                                │
                  ┌─────────────┼──────────────────┬───────────────┐
                  ▼             ▼                  ▼               ▼
        catalog.json     transposition.json   public/explain/   public/key_squares.json
        ~76 KB           [P2]                 <line_id>.json    [P2]
        families[]       FENhash → lineId[]   [P1b sidecars]
        variations[]     omit single-line
        openings[]       entries
        lines[]
        presets[]
        schema_version
```

Build-time validators are merge-blocking. Examples:

- Every `lines[].id` slug matches `^[a-z0-9-]+$` and is unique (Article 6).
- Every line's move sequence is legal under `python-chess` (rules + check rules).
- No line exceeds 20 ply; default 18, 16 for quiet positional, 20 for sharp tactical on whitelist (Article 8).
- Every Phase 1b sidecar's `blocks.length === line.moves.length` (strict equality).
- Every Phase 2 `key_squares.yml` entry's `source_url` traces to a permissively-licensed entry in `scripts/key_squares/sources.yml` (Article 1).
- Phase 2 transposition index is deterministic — byte-equal across two consecutive builds on the same input.

Source-3 (lichess-org/chess-openings TSV) and Source-4 (Lichess Opening Explorer API) feed the *legacy* `--source curated` path; the production v1 `curated-v2` path runs entirely from hand-curated YAML.

## Deployment model

Dual distribution from Phase 0a forward (Constitution Article 16). Both maintained at every phase milestone.

### Live URL (Vercel / Netlify)

- Pure static frontend deploy: `npm run build` → `dist/`.
- Service Workers / PWA off in v1 (avoid offline-cache footgun during rapid spec churn).
- Public flip pending: CI + Docker compose already in place; the flip is a decision, not a phase.

### Docker compose (self-hosted)

Per-service Dockerfiles in `docker/`. Multi-stage, alpine/slim bases. All on pinned major.minor tags, no `latest`.

```
Phase           Services in docker-compose.yml
──────          ─────────────────────────────────────────────────────
0a / 1 / 1.5    frontend (nginx:alpine serving dist)
2               frontend + backend (Python/FastAPI for Lichess sync if browser-side CORS proves insufficient)
3               frontend (no backend needed — Lichess CORS-friendly, OAuth PKCE in browser)
4a              frontend (Stockfish.wasm bundled, LLM keys user-supplied, no backend required)
4b+ (optional)  + backend (FastAPI hosting Pyodide-alternative feature extractor)
4e              + ai service (optional — only if Anthropic/OpenAI routed through backend for org policy)
5+ stretch      docker-compose.coco.yml — CoCo / Confidential Containers variant
                Kata Containers + TEE (Intel TDX or AMD SEV)
                Confidential AI inference: fine-tuned model + user data
                stay encrypted at runtime, even from cloud provider
```

Image rules:

- Frontend: `node:20-alpine` builder → `nginx:alpine` runtime, final image < 50 MB
- Backend: `python:3.12-slim` builder → `python:3.12-slim` runtime
- AI service (if built): `python:3.12-slim` + CUDA base if GPU
- No host-only paths, no system Python assumptions, no native-only deps without an alpine/slim base
- Sidecars (Phase 1b explain JSON, Phase 2 key_squares JSON, Phase 4a stockfish.wasm) are static assets bundled in the frontend image

## External integrations

All opt-in additive (Constitution Article 11). The app functions fully end-to-end with zero external integration. Disabling any integration degrades only the dependent feature, never breaks anything else.

### Lichess (Phase 3)

- **Auth:** OAuth 2.0 PKCE flow. Code verifier + challenge generated client-side with browser-native `crypto.subtle`. No client secret. No backend callback — `/<origin>/lichess/callback` route exchanges the code in-browser.
- **Scopes:** minimum to read public games. No write, no challenge, no email.
- **Token storage:** `localStorage` under `tabiya.lichess.token.sensitive`. Token cleared on disconnect or 401.
- **Sync:** rate-limited to ≤1/minute. Last 100 games or 15 days, whichever is fewer. Manual import by game ID for older / shared games.
- **CORS:** Lichess API is CORS-friendly; no backend proxy needed (Article 12 backend-optional).
- **Out-of-book:** detector walks each game vs the user's *picked* repertoire (Phase 1.5 `EffectivePick`), emits `OOBEvent` at first divergence, optionally consults Phase 2 transposition index for in-book-via-transposition match.

### Cloud LLM (Phase 4a)

- **Providers:** Anthropic (default `claude-haiku-4-5`), OpenAI (`gpt-4o-mini`). Direct SDK calls only (Article 3 — no LangChain, no LlamaIndex, no CrewAI; ESLint rule blocks import).
- **Keys:** user-supplied, stored in `localStorage` with a visible Settings warning. No keys ever leave the browser to a tabiya-controlled server.
- **Prompt caching:** Anthropic implementation uses `cache_control: { type: 'ephemeral' }` on system prompt and few-shot block. Estimated ~$0.06 per demo session at expected usage.

### Local LLM (Phase 4a)

- **Ollama:** HTTP fetch against `http://localhost:11434`. Default model `llama3.2:3b-instruct`. Settings page tests reachability inline.
- **llama.cpp WebGPU:** browser-native inference, no network. 200–500 MB first-use model download — gated behind feature flag `tabiya.flag.webgpuLlm` in 4a.

## Test architecture

Two test runners, two language layers, one CI gate.

### Frontend (Vitest)

```
tests/
├── drill/                    # state machine, move comparator, useDrill
├── srs/                      # Leitner scheduler, box transitions
├── explain/                  # useExplainMode, useExplainContent, ExplainRail [P1b]
├── events/                   # EventsRepository, migration v1→v2 [P1.5]
├── hooks/                    # useStreaks, useAccuracy, useEffectivePick [P1.5]
├── components/               # board overlays, RepertoirePicker, HeatmapTabs
├── key_squares/              # SpotlightOverlay, banner [P2]
├── lichess/                  # PKCE, sync, detect-oob (golden games) [P3]
├── coach/                    # LLMClient mocks, CoachModal, cache [P4a]
├── engine/                   # StockfishWasmEngine integration [P4a]
└── integration/              # drill-emits-events, full-line flow
```

Coverage target: ≥80% on storage + hooks. `useDrill`, `useExplainMode`, OOB detector each gate ≥10 cases. Article 14 — `@typescript-eslint/no-explicit-any` is error-level.

### Python (pytest)

```
tests/python/
├── test_build_catalog.py     # schema validation, depth cap, slug uniqueness
├── test_validate_explain.py  # sidecar shape, length match, square legality [P1b]
├── test_key_squares.py       # extractor + review CLI [P2]
├── test_transposition.py     # determinism (byte-equal) + correctness
├── test_validate_presets.py  # every preset.lines[].id exists in catalog
└── features/golden/          # Phase 4b — golden FEN → expected feature value
```

Ruff for lint + format. Type hints mandatory on public functions (Article 14).

### Eval harness (Phase 4e)

```
evals/coach/
├── retrieval/      # ≥30 (fen, expected_kg_node_ids[]) pairs, target hit@3 ≥ 0.85
├── answers/        # 50 scenarios with LLM-as-judge faithfulness + helpfulness
└── hallucination/  # 100% cited tags must be present in input — CI-blocking
```

CI-blocking on prompt / pipeline / judge_prompt changes. The eval harness is the real AI deliverable per Article 4.

## File layout (top-level summary)

```
tabiya/
├── public/
│   ├── catalog.json              # bundled catalog
│   ├── explain/<line_id>.json    # Phase 1b sidecars (build output)
│   ├── stockfish.wasm            # Phase 4a engine, lazy chunk
│   └── sounds/                   # AGPL-3.0 sourced from Lichess
├── scripts/
│   ├── build_catalog.py          # offline catalog build (Phase 0b)
│   ├── curated/                  # hand-authored YAML sources
│   ├── build_explain.py          # GPT-batch explain authoring (Phase 1b)
│   ├── review_explain.py         # human-in-the-loop review CLI (Phase 1b)
│   ├── key_squares/              # scrape + extract + review (Phase 2)
│   └── tabiya_build/             # shared pydantic schema + validators
├── src/                          # React + TS SPA
│   ├── repository/               # interfaces + concrete impls (Article 5)
│   ├── storage/                  # legacy storage seam (being absorbed into repository/)
│   ├── drill/                    # drill engine state machine
│   ├── srs/                      # Leitner state, due queue
│   ├── hooks/                    # useExplainMode, useStreaks, useCoach, ...
│   ├── pages/                    # 5 routed pages + LichessCallback + OOBPositionViewer
│   ├── ui/                       # AppShell + primitives + board overlays
│   ├── engine/                   # ChessEngine interface + StockfishWasmEngine (Phase 4a)
│   ├── coach/                    # CoachContextBuilder, LLMClient impls, CoachPipeline
│   └── lib/lichess/              # OAuth PKCE, API client, OOB detector (Phase 3)
├── prompts/coach/                # version-controlled prompt templates (Phase 4)
├── data/explain/                 # source-of-truth explain content (Phase 1b)
├── data/key_squares/             # scraped + pending + rejected (Phase 2)
├── evals/                        # eval datasets and golden positions (Phase 4)
├── tests/                        # Vitest TS suite
├── tests/python/                 # pytest Python suite
├── backend/                      # FastAPI service (Phase 4+, optional)
├── docker/                       # per-service Dockerfiles
├── docker-compose.yml            # default compose, services scale per phase
├── docker-compose.coco.yml       # Confidential Containers variant (Phase 5+ stretch)
├── specs/                        # constitution + steering + per-phase spec dirs
├── pyproject.toml
├── package.json
├── README.md
├── features.md
├── about.md
├── architecture.md
└── design-decisions.md
```

The full structure rules (naming conventions, file-per-component vs file-per-feature, Python vs TS layout) live in `specs/structure.md` and are unchanged across all phases.
