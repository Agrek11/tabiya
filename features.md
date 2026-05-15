# Features

What tabiya ships today and what is specced for the road ahead. For project framing see [about.md](./about.md), for system view see [architecture.md](./architecture.md), for ADRs see [design-decisions.md](./design-decisions.md).

**Status legend.** A phase is fully shipped when all four are checked.

| Badge | Meaning |
| --- | --- |
| `spec`     | `requirements.md` written, EARS-style acceptance criteria locked |
| `design`   | `design.md` written, architecture seams + type shapes + test plan locked |
| `tasks`    | `tasks.md` written, implementation broken down |
| `impl`     | Implementation merged on the default branch |

Current version: **`v0.7-phase-1c`**. Active spec: **Phase 1b Explain Mode**. Active Coach build target: **Phase 4a Naive Engine + LLM MVP**.

---

## Shipped (`v0.7-phase-1c`)

### Curated content (Phase 0d.4 v2 + 1c expansion)

`spec` `design` `tasks` `impl`

- 30 families across 3 tiers (8 Tier 1 / 14 Tier 2 / 8 Tier 3)
- 39 hand-curated variations (24 Tier 1 + 14 Tier 2 + 1 Scotch)
- 51 lines, 12–20 ply, depth cap honored (Constitution Article 8)
- Fork annotations on key lines (decision points + alternative SANs inline, popover rationale)
- Strategic notes per line (1–3 sentences, will feed Phase 1b/4 explanations)
- 3 presets (Beginner / Intermediate / Advanced) + Off
- ~76 KB bundled catalog.json

Hierarchy: **3 layers** — Family (Spanish, Sicilian, KID, …) → Variation (Najdorf, Marshall, …) → Line (drillable sequence). Sub-decisions captured as `ForkAnnotation` inside lines (no 4th layer). Linear lines only (Article 7); branching deferred to v2+.

Catalog build: offline, one-shot, idempotent. Three build paths via single CLI:

| `--source` | What it does | Output size | Use case |
|---|---|---|---|
| `curated-v2` (default) | Reads `scripts/curated/{families,variations,lines}.yml` → 30/26/26 entries | ~50 KB | Production v1 |
| `curated` (legacy) | 18-opening whitelist + Lichess Explorer extension | ~18 KB | Pre-v2 baseline preserved |
| `flat-tsv` | Every `lichess-org/chess-openings` TSV row → 1 Opening + 1 Line, ~3585 entries | ~3.3 MB | Tooling / data analysis |

Stable line IDs across refreshes (Article 6).

### Drill loop

`spec` `design` `tasks` `impl`

- Playable board: click-to-move + drag-drop
- Green tick on correct move + auto-advance
- Red cross + auto-undo on wrong move
- Two-tier hint (`H` once = pulse, twice = full highlight)
- Strategic notes panel (collapsible, persisted)
- Fork annotations as inline `⋔` badges on move history with popover (label + alternatives + rationale)
- End-of-line summary card (line name, stats, notes, Restart / Drill due / Next CTAs)
- Queue mode (`?queue=due` URL): cycles through all due lines, auto-advance, "All caught up" exhaustion state
- Keyboard nav: `←/→/H/R` for prev/next/hint/restart
- Last-move highlights (Lichess-style)
- Board-flip animation
- Per-line drill / explain mode toggle scaffold (Phase 1b will populate)

### SRS engine — friction-tuned Leitner (Phase 1)

`spec` `design` `tasks` `impl`

- 5 boxes: 1d / 3d / 1w / 2w / 1m
- 0 wrong → promote (cap Box 5)
- 1–2 wrong → stay (touch `last_reviewed`)
- ≥3 wrong → demote one (floor Box 1)
- Hint use counted but doesn't affect box
- First-ever drill: flawless → Box 2, struggling → Box 1
- Skip mid-drill → no SRS update
- Per-line mastery bar (Box → % map: 20/40/60/80/100)
- Lifetime per-line counters: attempts, wrong attempts, hint uses
- Dashboard stats: lines mastered (%), due-for-review count, drilled lines
- Sidebar due badge (hides at 0)
- Settings → Reset all SRS progress (Danger Zone, confirmation gated)
- Per-line SRS reset (`↺` icon on each line in Repertoire, disabled when no state)
- Stable line.id across catalog refreshes (Article 6) — SRS state preserved
- Streak counter — deferred to Phase 1.5

### UI / UX

`spec` `design` `tasks` `impl`

- v1 design system (Phase 0d.1): light/dark theme, `lucide-react` icons, `react-router-dom` v7, 5 routed pages
- App shell: Sidebar + TopBar + AppShell
- 4 primitives: Card / Button / PageHeader / StateMessage + StatusStrip
- 5 pages: Dashboard, Repertoire, Drill, Progress, Settings
- Sound module v2 (Phase 0d.2): audio pool, persisted settings, global unlock
- Move-history rail collapse + next-move accent
- Board theme picker (6 presets, drill quick-toggle + Settings)
- Two-tier Hint UX (Phase 0d.2)
- Lichess-style last-move highlight

### Storage architecture

`spec` `design` `tasks` `impl`

- JSON bundle for catalog (`public/catalog.json`, read-only, Vite-served)
- IndexedDB (`idb` wrapper) for user SRS state — DB `tabiya` v1, store `srs_state` (keyPath `line_id`, index `box`)
- Repository interfaces:
  - `OpeningRepository` — catalog reads (families / variations / openings / lines / search / gambits)
  - `SrsRepository` — SRS state CRUD (single source for Dashboard / Repertoire / Drill)
- 3 concrete impls per side: `JsonOpeningRepository` / `IndexedDbSrsRepository` (production) + `InMemorySrsRepository` (test)
- DI factory in `src/storage/index.ts` — consumers never import concrete classes (Article 5)
- Plug-and-play swap to SQLite later (v2) without touching consumers

### Repertoire presets

`spec` `design` `tasks` `impl`

- One-click loadouts: Beginner / Intermediate / Advanced (or Off = full catalog)
- Filter applies to RepertoirePage + Drill opening picker
- Persisted in localStorage `tabiya.repertoirePreset`
- Schema in `scripts/curated/presets.yml` (additive, optional)
- Phase 1.5 will extend with explicit `lines:` array + manual additions/removals (see ADR-13)

### Quality

`spec` `design` `tasks` `impl`

- TS strict, no `any` without inline justification (Article 14)
- Python type hints on public functions (Article 14)
- Ruff lint + format (Python), ESLint (TS) — merge-blocking
- 94+ Vitest tests, Python pytest suite
- CI: lint + test + build per push
- Containerized from Phase 0a (Article 16): multi-stage `node:20-alpine` → `nginx:alpine`, final image < 50 MB
- Dual distribution: live URL (Vercel/Netlify, not yet flipped public) + `docker compose up`

### Continuous (never "done")

- **UX hardening** — Phase 0d.2 originated; protocol at `specs/ux-intake-protocol.md`. Each phase surfaces new friction; capture, triage, fix.
- **Public flip** — CI + Docker compose in place; flipping public is a decision, not a phase.

---

## Specced + planned

### Phase 1b — Explain Mode

`spec` `design` `tasks` ` ` (impl active)

Sibling pedagogy mode to drill. Walks an opening line ply-by-ply with overlays (arrows, highlighted squares) and a "why this move" rationale, then auto-advances. Both colors narrated. Reuses Phase 1.5 / Article 15 `<HighlightLayer>` primitive (not a fork).

Features:

- Drill page header toggle `[Drill] [Explain]` — per-line persistence (`tabiya:linePrefs:<lineId>:mode`), hidden when no explain content authored
- Per-ply `ExplainBlock`: `rationale`, `arrows[]`, `highlights[]`, `threats?`, `pauseMs?` (default 2500)
- Autoplay state machine (`useExplainMode`): `idle → showOverlays → playingMove → awaiting_next → complete`, with `pause / next / prev / restart / skip-to-drill` controls
- Sidecar storage: `data/explain/<line_id>.json` source → `public/explain/<line_id>.json` build output → lazy-loaded on mode entry. Bundle stays lean for un-annotated lines (ADR-14).
- `<ArrowLayer>` overlay (new): SVG, single layer, derived from `react-chessboard` square pixel geometry
- `<ExplainRail>`: rationale text + threats + ply controls, with `<TruncatedText limit={280}>` soft-truncate + show-more
- TTS narration behind feature flag `tabiya:flag:explainTts` (default off). Uses Web Speech API (`SpeechSynthesisUtterance`). Per-line mute key `tabiya:linePrefs:<lineId>:ttsMute`. Article 11 — browser-native, no network.
- Authoring pipeline:
  - 1 hand-authored gold line (Italian Game main, ~10–12 ply) at `data/explain/italian-game-main.json`
  - `scripts/build_explain.py` — Anthropic SDK direct call with few-shot from gold, drafts to `data/explain/pending/`
  - `scripts/review_explain.py` — TUI: ASCII board + draft + `[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit`
  - Prompt template at `specs/phase-1b-explain-mode/prompts/build_explain.j2`
- Build budget: +12 KB gzip combined cap for mode shell + overlay components (R5)
- Schema bump: `catalog.schema_version` 1 → 2; `Line.explain?: ExplainBlock[]` (length === `moves.length` when present)

Seeds Phase 4 AI Coach commentary (gold dataset + grounding signal for retrieval).

Spec at `specs/phase-1b-explain-mode/{requirements,design,tasks}.md`.

### Phase 1.5 — Telemetry, Streaks, Heatmap, RepertoirePick

`spec` `design` ` ` ` `

Adds the feedback layer that's missing from v1: a durable record of *what happened*, four dashboard surfaces derived from it, and a manual override on top of the preset system.

Features:

- **Session events log + EventsRepository** (R1)
  - New IndexedDB store `session_events` (autoincrement id, indices on timestamp / lineId / eventType / `[lineId, timestamp]`)
  - 6 event types: `line_start`, `move_correct`, `move_wrong`, `hint_used`, `line_complete`, `line_abandoned`
  - Per-event: `id`, `timestamp` (ms UTC), `eventType`, `lineId`, `plyIndex` (nullable), `durationMs` (nullable)
  - Emission via `useEventEmitter` at the six observable transitions in the drill state machine; one write per event, no buffering, `queueMicrotask` defer
  - Article 11 — never transmitted off-device; an ESLint rule blocks `fetch`/`sendBeacon`/non-self `postMessage` from new telemetry code
- **Streaks** (R2)
  - **Drill-day streak**: consecutive calendar days with ≥1 `line_start` (local timezone)
  - **Line-mastery streak**: consecutive `line_complete` events with 0 `move_wrong` in the session; reset on any wrong or `line_abandoned`
  - Two-card row on Dashboard: "Days in a row" + "Clean lines in a row" with muted style + encouragement caption at zero
- **Tabbed heatmap** (R3)
  - Three tabs, fixed order: **Daily activity** (GitHub-style 53×7 grid), **Per-opening accuracy** (family × accuracy bucket grid, ≥5 completed sessions threshold), **Hour of day** (24-cell row)
  - Hand-rolled inline SVG + CSS grid (ADR-21); zero charting library
  - Tab selection persisted in localStorage `tabiya.heatmapTab`
  - Empty state per tab; panel never hidden
  - Explicitly *not* the Article 15 board highlight primitive (ADR-20)
- **Accuracy %** (R4)
  - Two cards on Dashboard: "All-time accuracy" + "Last 7 days"
  - Each: percentage to 1 decimal, count of moves, delta indicator (`+1.2pp` / `-0.4pp` / `=`)
  - `—` + "No moves yet" caption when denominator zero
  - Per-line accuracy badge on Repertoire page line rows
- **RepertoirePick layer** (R5) — see ADR-13
  - Extends `scripts/curated/presets.yml` with explicit `lines: [...]` array per preset
  - IndexedDB store `repertoire_pick` (single row, key `current`): `{ presetId, additions, removals }`
  - Effective pick: `(preset.lines ∪ additions) \ removals`
  - `<RepertoirePicker>` panel: active preset + count + expandable line list with checkboxes
  - Preset switch clears additions/removals after confirm
  - Drill queue + Repertoire page + due list filter to effective pick; "Show all" toggle exposes unrestricted view
- **Schema migration** (R6)
  - IDB version bump v1 → v2; strictly additive (no existing store dropped or rewritten)
  - Test asserts Phase 1c user → Phase 1.5 with zero SRS loss
  - Settings → "Reset telemetry" action (separate from SRS reset, so the two cannot be confused)
- **Quality** (R7)
  - ≥15 EventsRepository cases, useStreaks 6 scenarios, useAccuracy 4 scenarios, integration test (drill emits exact event sequence), migration test
  - Combined build budget: +20 KB gzip across HeatmapTabs + RepertoirePicker + hooks + repos

Spec at `specs/phase-1.5-telemetry/{requirements,design}.md`.

### Phase 2 — Pattern Visualization + Transposition

`spec` ` ` ` ` ` `

Differentiating feature. Trains visualization, not memorization. Adds key-square awareness for ~50 openings + position-keyed transposition index. Split into 2a (content pipeline) + 2b (UI); 2a → 2b gate at ≥30 openings reviewed.

#### Phase 2a — Content acquisition pipeline

- **Scrape** (R1) — `scripts/key_squares/scrape.py`. Permissively-licensed sources only (whitelist in `sources.yml`: Wikipedia CC BY-SA, Lichess opening explorer, openly-licensed PDFs). robots.txt-aware, ≤1 req/s per host. Output: `data/key_squares/scraped/<opening_slug>.json`.
- **Extract** (R2) — `scripts/key_squares/extract.py`. Anthropic SDK direct call (Article 3, no LangChain). Few-shot grounded with 3–5 hand-authored exemplars. Outputs draft `{square, role, for_color, rationale, source_url}` records per opening to `data/key_squares/pending/<opening_slug>.yml`. Validation: `square ∈ a1..h8`, `role ∈ {outpost, weak, tension, control}`, `rationale ≤ 280 chars`.
- **Review** (R3) — `scripts/key_squares/review.py`. CLI iterates pending YAMLs; renders ASCII/unicode board with marked squares; prompts `[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit`. Resumable. Approved drafts → `scripts/curated/key_squares.yml`. Rejected → `data/key_squares/rejected/<opening_slug>.yml` for prompt-tuning history.
- **Schema + build integration** (R4) — `key_squares.yml` schema validated at build time. Build fails on malformed entries or unknown opening_slugs. Catalog `schema_version` bump. `Opening.key_squares?: KeySquareRecord[]` surfaced to frontend, additive.

#### Phase 2b — UI integration

- **Spotlight overlay** (R6) — `<SpotlightOverlay>` SVG layer (ADR-19, "theatre lights"). Dim non-key squares via single semi-transparent rectangle with cutouts at key-square coordinates. Each cutout: soft glow colored by `role` (outpost → green, control → blue, tension → amber, weak → red). Hover → tooltip with rationale + for_color indicator (reuses Phase 1b tooltip primitive). Non-blocking — clicks fall through to underlying board. Reuses Article 15 `<HighlightLayer>` primitive. Build budget: +6 KB gzip. Visual reference: `/workspaces/personal/AI/Projects/tabiya/chessViz`.
- **Drill-mode overlay toggle** (R7) — `[Key squares: on/off]` header toggle, default off, per-line persistence `tabiya:linePrefs:<lineId>:keySquareOverlay`. In Explain Mode the overlay **forces on** for the duration of the explain run; restores on exit. Hidden when active opening has no `key_squares` data.
- **Transposition index** (R5) — build emits `Map<FENhash, lineId[]>` over every position in every line, persisted as `catalog.transposition_index`. FEN normalized (castling rights + en-passant target preserved, halfmove + fullmove stripped). Single-line entries omitted. Deterministic build (byte-equal on same input — test gate).
- **Transposition banner** (R8) — when current drill FEN appears in the index with ≥2 lineIds AND ≥1 is in the user's picked repertoire (other than active line), render non-blocking banner above move-history rail: `"This position also appears in: [Line A], [Line B]"` with clickable chips. Capped at 3 with `+N more`. Click → `/drill?line=<lineId>` from ply 0. Dismissable per session. Not at ply 0 (start position shared by every line). Never appears when repertoire is empty.

Spec at `specs/phase-2-pattern-viz/{requirements,design}.md`.

### Phase 3 — Lichess Sync

`spec` ` ` ` ` ` `

Closes the "are you actually playing your prep" loop. Pull recent Lichess games, walk each against the picked repertoire (Phase 1.5), surface the first out-of-book ply per game. Plumbing for Phase 4 Coach.

Features:

- **OAuth PKCE connect/disconnect** (R1, ADR-17)
  - Settings → Lichess section: "Connect Lichess" button (or "Disconnect" + connected-username display)
  - PKCE flow: code verifier + challenge via `crypto.subtle`, no client secret, no backend
  - Callback `/<origin>/lichess/callback` route handles code exchange in browser
  - Token in `localStorage` as `tabiya.lichess.token.sensitive`
  - 401 on any call → auto-disconnect + "Reconnect Lichess" prompt
  - No heavy auth framework (no Auth0 SDK / `@auth/*` / Passport) — Articles 1 + 3
- **Sync last 100 games / 15 days** (R2)
  - Settings → "Sync now" button (visible only when connected)
  - `GET /api/games/user/{username}?max=100&since={epoch_ms_now_minus_15d}&pgnInJson=true&clocks=false&evals=false&opening=true`
  - Progress indicator ("Synced N games..."), terminal toast ("Synced N new games, M already known")
  - Rate-limited to ≤1 sync per 60s
- **Manual import by game ID** (R3)
  - Settings → "Import game by ID" input + button (8-char base62 validated)
  - `GET /game/export/{id}?pgnInJson=true&...`
  - Inline error for 404; "Already imported" for known IDs
- **LichessRepository + IDB stores** (R4)
  - `lichess_games` (keyPath `id`) + `lichess_oob_events` (keyPath `[gameId, plyIndex]`)
  - Interface: `getGame / putGame / listGames / clearAll / getOOBEvents / putOOBEvent`
  - Article 5 — consumers via `getLichessRepository()` DI helper only
- **Out-of-book detection** (R5)
  - Parses PGN to SAN ply sequence (Article 9, `chess.js`)
  - Walks game move-by-move against user's *picked* repertoire (Phase 1.5 `EffectivePick`), NOT full catalog
  - Tracks alive picked lines; prunes as moves diverge; emits `OOBEvent` at first user-color move that matches no alive picked line
  - `OOBEvent`: `gameId`, `plyIndex`, `playedSAN`, `expectedSANs[]`, `color`, `fenAtOOB`, `openingEco?`, `openingName?`, `lineId?`, `detectedAt`
  - Deterministic: same game + same picks = same OOB event (golden game tests, R8.3)
  - User-color moves only; opponent moves advance FEN walk but don't emit events
  - Removed line.id → renders as `(line removed)` (Article 6 guarantee: stable IDs, removal permitted, renaming forbidden)
- **Transposition-aware OOB** (R6, depends on Phase 2)
  - If Phase 2 transposition index present, before emitting OOB at ply N, compute FEN after played move and query index for any picked line reaching that FEN at any ply
  - If reached via transposition, switch "alive line" tracking instead of emitting OOB
  - Graceful degrade: works without Phase 2 (pure move-by-move)
- **Dashboard OOB widget + position viewer** (R7)
  - "Out-of-book moments" widget below "Drill N due"
  - Empty states for disconnected / connected-zero-events
  - List of up to 10 most recent: game date, opponent, opening name, ply, played SAN, expected SANs (first 2 + `+N more`)
  - Click row → position viewer (modal or `/lichess/oob/:gameId/:plyIndex`): board at `fenAtOOB`, played + expected highlighted via Article 15 primitive, line name + ECO, "View on Lichess" external link
  - `<CoachSlot />` placeholder component reserved for Phase 4 plug-in; renders null in Phase 3
  - Pure read surface; never mutates repertoire / SRS / drill queue
- **Quality gates** (R8)
  - PKCE unit tests: verifier gen, SHA-256 challenge derivation, state round-trip, token-exchange shape, 401 handling
  - Sync idempotency test
  - OOB detector golden-game suite: ≥5 fixtures (entirely in book, OOB at ply 6, opponent OOB but user in book, no picked lines for user's color, transposition in-book when Phase 2 present)
  - `LichessRepository` contract test runnable against any future implementation

Spec at `specs/phase-3-lichess-sync/{requirements}.md` (design pending).

### Phase 4 — AI Coach

`spec` (4a `design`) ` ` ` `

The moat. Five-layer pipeline; 4a is the active build, 4b–4e are documented end-to-end as the moat roadmap. See ADR-15 for the binding architectural decision.

#### Phase 4a — Naive Engine + LLM MVP (ACTIVE BUILD after Phase 1b)

`spec` `design` ` ` ` `

Stockfish.wasm + top-N PVs → LLM → 1–4 sentence explanation. In-drill **Why?** button only. Honest baseline that 4b–4e replaces.

- **Stockfish WASM engine** (R1, ADR-16)
  - Bundled `stockfish.wasm` / `stockfish.js` in dedicated Web Worker
  - Exclusively via `MessageChannel`; main thread never calls engine synchronously
  - Lazy-loaded chunk (>2 MB gzip), activated on first Coach invocation
  - State surfaced: `idle | loading | ready | error`
  - Engine load failure → Coach degraded "engine unavailable"; drill still works (Articles 11, 12)
- **`ChessEngine` interface** (R2, Article 5)
  - `analyze(fen, opts) → EngineAnalysis` with SAN PVs (Article 9), bestmove, scoreCp, depth
  - `StockfishWasmEngine` concrete impl in 4a; Leela interface-compatible but not bundled
  - DI swap re-wires on next coach invocation, cancels in-flight analyses
  - `EngineAnalysis` is a forward-compatible superset of what 4b's FeatureExtractor consumes
- **Engine preset modes** (R3) — Fast / Balanced / Deep
  - Fast: depth 12, multipv 3, movetime 500 ms
  - Balanced: depth 20, multipv 3, movetime 2000 ms (default)
  - Deep: depth 30, multipv 5, movetime 5000 ms
  - Persisted under `tabiya.engine.preset`; cache invalidates on preset change
  - Raw depth/multipv/threads NOT exposed in 4a
- **`CoachContext` (4a minimal)** (R4)
  - Engine output + last ≤6 plies of history (truncated FIFO)
  - No retrieval, no opening KG, no features in 4a (those land in 4b+)
  - Forward-compatible: 4b+ can add fields, 4a consumers ignore unknowns
- **`LLMClient` interface + 4 concrete impls** (R5, ADR-22)
  - `AnthropicLLMClient` — `@anthropic-ai/sdk` direct, default `claude-haiku-4-5-20251001`, prompt caching on system + few-shot
  - `OpenAILLMClient` — `openai` SDK direct, default `gpt-4o-mini`
  - `OllamaLLMClient` — HTTP `http://localhost:11434`, default `llama3.2:3b-instruct`
  - `LlamaCppWebGPULLMClient` — in-browser WebGPU inference, gated behind `tabiya.flag.webgpuLlm` (200–500 MB first-use download)
  - ESLint rule fails build on `langchain` / `@langchain/*` / `llamaindex` / `crewai` import (Article 3)
- **Settings UI: AI section** (R6)
  - Inference Location radio: Cloud / Local (Ollama) / Local (Browser WebGPU)
  - Provider dropdown (cloud): Anthropic / OpenAI
  - Model text input (prefilled with provider default)
  - API Key password-masked input ("Stored locally. Never sent to tabiya servers.")
  - "Test connection" button, "Clear key" action
  - Inline diagnostic if Ollama unreachable
  - No console / telemetry / snapshot logging of the API key
- **Surface A: in-drill Why? button** (R7, ADR-23)
  - Visible in all drill states except `idle`
  - Modal shows: Engine card (best SAN, eval, top-N PVs, engine + depth + preset) **always**; LLM narration card iff LLM configured and responded
  - Degraded-mode footer when narration absent
  - Cached by `(lineId, plyIndex, enginePreset, modelName)` in-memory for session
  - Keyboard shortcut `?`, ESC / click-outside / close button to dismiss
  - **Surfaces B (OOB Ask Coach) + C (free-form chat) are 4e, not 4a**
- **Prompt template + versioning** (R8)
  - `prompts/coach/v1.txt` plain text with `{{placeholder}}` slots, build-bundled (no runtime fetch)
  - ≥3 few-shot examples grounded in real positions (Italian ply 4, Najdorf ply 6, French Advance ply 5)
  - Honest constraint clause: "*You see Stockfish PVs and the user's recent moves. You do NOT see deep positional features. Keep explanations to 1–4 sentences. If the engine output is ambiguous, say so rather than invent.*"
  - Every response logs prompt version (`v1`) for future eval traceability
- **Quality** (R9)
  - Engine integration tests: ≥5 known positions
  - `ChessEngine` shared contract tests
  - Surface A degraded-mode test (no LLM configured)
  - LLMClient mock tests for all 4 impls
  - Cache test (re-click same position = no engine/LLM re-invocation)
  - No-LangChain lint
  - Bundle budget: base trainer bundle gzip NOT to grow by more than 30 KB (engine worker is separate lazy chunk)
  - 10-position manual walkthrough at `evals/coach/4a-walkthrough.md`. Expected: ~half of explanations feel shallow/generic. **This is the acceptable 4a baseline.**

Spec at `specs/phase-4-ai-coach/{requirements,design}.md` (4a is the active build target).

#### Phase 4b — Deterministic Feature Extraction Layer (FUTURE, documented)

`spec` ` ` ` ` ` `

Python-chess rule-based feature extractor: ~30 features per position. Runtime: Pyodide (in-browser, Article 12 favored) or FastAPI backend. Each feature ships with a golden-position fixture; CI asserts equality.

Feature surface (illustrative): development (which non-pawn, non-king pieces left starting squares), center control (attackers on d4/e4/d5/e5), king safety (castled, pawn shield score, open files near king, attacker count), space, tempo, pawn structure (doubled / isolated / backward / passed / candidate passers / pawn islands), open files (open / half-open per color), diagonals (long-diagonal control), weak squares, outposts, piece activity (per-piece mobility), pinned (via `board.is_pinned`), overloaded (defending ≥2 threatened), discovered-attack candidates, x-ray candidates, trapped pieces, bishop pair, knight outposts.

Interview hook: *"Stockfish tells you what move is best. The feature extractor tells you what about this position the player should notice — and the LLM only narrates what the extractor already knows."*

Estimated cost: 4–6 weekends. **Not scheduled** until main AI/ML plan permits (post Jan 2027 application window).

#### Phase 4c — Position Classification + Motif Detection (FUTURE, documented)

`spec` ` ` ` ` ` `

Heuristic-first classifiers (ML deferred): position type (open/closed/semi-open), sharpness (tactical/positional/mixed), pawn structures (IQP / Carlsbad / Sicilian / Hedgehog / Maroczy / hanging-pawns / isolated-d|c|e / doubled-c|f / pawn-chain), king situation (same-side castled / opposite / uncastled / mixed). Confidence scores per classification.

Motifs — tactical (pin / fork / skewer / discovered-attack / x-ray / overload / deflection / removal-of-defender / zugzwang / fortress) + positional (minority-attack / central-pawn-break / outpost-installation / prophylaxis). Each motif: `kind`, `squares[]`, `pieces[]`, `description` (template-generated, not LLM), `confidence`.

Classifier + motif output chooses which explanation template the LLM uses in 4e; motifs become the verbs of the explanation.

Estimated cost: 3–5 weekends. **Not scheduled.**

#### Phase 4d — Semantic Layer + Plans + Opening KG (FUTURE, documented)

`spec` ` ` ` ` ` `

The densest sub-phase. Three components:

- **Move-purpose taxonomy** (~20 enum values): `development`, `pressure_center`, `control_key_square`, `restrict_counterplay`, `prepare_break`, `execute_break`, `prophylaxis`, `improve_worst_piece`, `create_weakness`, `exploit_weakness`, `king_safety`, `open_file_pressure`, `exchange_to_simplify`, `avoid_exchange`, `gain_tempo`, `rerouting`, `pawn_break_central`, `pawn_break_minority`, `tactical_threat`.
- **Plan extractor**: walks the top PV 8–12 plies deep, segments into purpose phases (e.g. "rerouting (4 plies) → break (1 ply) → exploit (3 plies)"), labels each step. Multi-PV walks identify *opponent counterplay* by classifying the opponent's best response (kingside-attack / central-break / queenside-storm / exchange-to-draw / no-clear-counterplay).
- **Opening Knowledge Graph**: nodes = FEN-hashed positions, edges = SAN moves. Node metadata: `eco`, `family`, `variation`, `named_plans[]`, `typical_pawn_breaks[]`, `characteristic_pieces[]`, `transposition_targets[]`. Build artifact at `data/opening_kg/kg.json` (~few MB). Bootstrapped from Phase 1b explain blocks + Phase 2 key_squares + Phase 1c family/variation metadata + manually curated `named_plans`. Lazy-loaded on first Coach invocation post-4d.

Interview hook: *"The LLM has a fixed vocabulary of move purposes. If `restrict_counterplay` is not in the input tags, the LLM cannot say 'this restricts counterplay'. Hallucination is structurally blocked."*

Estimated cost: 5–7 weekends. **Not scheduled.**

#### Phase 4e — Production Coach + Explain UI (FUTURE, documented)

`spec` ` ` ` ` ` `

The real AI deliverable per Article 4. Five components:

- **Grounded prompt architecture**: labelled-section template. LLM instructed: *"You may discuss only facts present in the sections below. If a fact you'd like to share is not in the sections, say 'the engine doesn't justify a deeper claim here' instead."* Sections: `[ENGINE_OUTPUT]`, `[EXTRACTED_FEATURES]`, `[POSITION_CLASS]`, `[MOTIFS]`, `[SEMANTIC_TAGS for candidate move ...]`, `[PLAN]`, `[OPENING_KG_FACTS]`, `[USER_QUESTION]`, `[RESPONSE_RULES]`.
- **Hallucination prevention**: two-pass. LLM emits JSON `{ prose, tags_cited, motifs_cited, features_cited }`. Post-validator asserts every cited tag/motif/feature exists in prompt input. If unknown citation: one retry, else downgrade to engine-only.
- **Skill modes**: beginner (60 words, defines jargon) / intermediate (100 words, no definitions) / advanced (80 words, terse, cites squares). Each `(position_class, skill_mode)` pair has a tailored prompt template (composed from partials).
- **Explanation ranking**: generate 3 candidates with `temperature=0.7`; separate LLM-judge call scores each on `faithfulness × concision`; best shown, others logged for eval.
- **Visual highlights** (Article 15): red arrows = threat motif squares, blue squares = outposts, yellow squares = weak squares, plan icons hovering above board (`pawn-break` / `piece-reroute` / `exchange` / `prophylaxis`). All reuse `<HighlightLayer>`.
- **"Why not this move?" comparison**: side-by-side card showing best vs alternative's pipeline output with eval-cp gap + feature delta bar.
- **Surfaces re-enter scope**:
  - **Surface B** (OOB list "Ask Coach", consumes Phase 3 `OOBEvent`): full pipeline on `(fen_before_oob, played_san, expected_book_san)`; side-by-side engine + features for book vs played; faithfulness gate.
  - **Surface C** (free-form chat sidebar): multi-turn, re-injects current FEN + last 6 plies + full feature bundle each turn; in-memory only.
- **Eval harness** (Article 4 deliverable):
  - **Retrieval eval**: ≥30 hand-graded `(fen, expected_kg_node_ids[], expected_explain_block_ids[])` pairs. Target `hit@3 ≥ 0.85`. CI-blocking.
  - **LLM-as-judge answer eval**: 50 scenarios. Judge prompt scores Faithfulness (0/1) + Helpfulness (1–5). Targets `mean_faithfulness ≥ 0.9`, `mean_helpfulness ≥ 4.0`. CI-blocking on prompt / pipeline / judge_prompt changes.
  - **Hallucination eval**: 100% of cited tags must be present in input. CI-blocking.

Interview hook: *"By the time the LLM is invoked, the only freedom it has left is wording. Every chess claim it can make is already in the input."*

Estimated cost: 5–8 weekends. **Not scheduled.**

---

## Future stretch

### Phase 5 — Polish, Deploy, Blog

`spec` ` ` ` ` ` `

- Live URL flip (Vercel/Netlify) — CI + compose already in place
- Demo GIF in README
- Blog post on build + lessons learned
- Quantifiable metrics: games ingested, drills completed, personal rating delta
- 5–10 alpha users beyond self

### Phase 6 stretch — Engine-Stress Testing

` ` ` ` ` ` ` `

After completing a line, hand the board to Stockfish 17 WASM. User plays 5 moves vs engine from end-of-line position. Tests *understanding*, not memorization. Reuses Phase 4a `StockfishWasmEngine`.

### Phase 5+ stretch — Confidential Containers (CoCo)

` ` ` ` ` ` ` `

`docker-compose.coco.yml` variant runs the full stack in Kata Containers + TEE (Intel TDX or AMD SEV). Confidential AI inference: fine-tuned model + user game data stay encrypted at runtime, **even from cloud provider**. Demo project for VP-recommended Kata/CoCo OSS lane. Adds resume signal for Type B (AI infra) hiring tier.

### Phase 6 stretch — More AI options + tournament prep

` ` ` ` ` ` ` `

- Try the 2 AI approaches not picked from A/B/C (fine-tuned small model / RAG / tool-selecting agent) — current lean is RAG with symbolic grounding per Phase 4 architecture
- Tournament prep mode: opponent-style import (their recent games → their pet lines)

---

## Deferred to v2+

- Dynamic Lichess Explorer API at runtime
- User-uploaded custom PGN repertoires
- Variation branching within lines (line.id graph; transposition lookup via FEN-normalized Position layer)
- Multi-tab sync (BroadcastChannel)
- Multi-user / auth
- Mobile app
- Chess.com sync (separate provider; if pursued, separate phase with own auth model)
- Token encryption at rest with user passphrase (defense-in-depth on Lichess token)
- Real-time game-in-progress sync (live ongoing-game tracking via Lichess board API)
- Server-side telemetry / analytics pipelines / network egress of session events
- Voice / TTS coach narration (Phase 4 stretch; Phase 1b ships TTS for Explain only, behind feature flag)

---

## Resume-Worthy Requirements (non-features, must ship)

- Public deployment with live URL
- Open source repo with README + architecture diagram + demo GIF
- Quantifiable metrics: games ingested, drills completed, personal rating delta
- 5–10 alpha users beyond self
- Blog post on build + lessons learned
