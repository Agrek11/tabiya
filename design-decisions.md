# Design Decisions

Architecture Decision Records (ADR-lite) for tabiya. Each entry captures context, the decision, why, what was rejected, and the binding Constitution article it ties back to. For the why-and-roadmap view see [about.md](./about.md). For the system view see [architecture.md](./architecture.md). For the feature list see [features.md](./features.md).

The 16 Constitution Articles (`specs/constitution.md`) are immutable. Decisions below either implement an article or settle a question the article leaves open. Quiet exceptions are not permitted; if an implementation contradicts the constitution, the constitution wins.

---

## ADR-1: Open-source only, no proprietary deps

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 1 — immutable)
**Context:** The project's portfolio value depends on the codebase being fully auditable, redistributable, and runnable without paid licenses or "free-tier" caveats.
**Decision:** Every runtime, build, test, and deploy dependency must be open source with a permissive or copyleft license (MIT, Apache-2, BSD, ISC, GPL family). No proprietary, "free tier", or source-available libraries. Every dep's license is declared in `specs/tech.md`.
**Rationale:** Constitution-level commitment. Locks the dependency posture before pressure (a new "must-have" feature, a faster proprietary alternative) tries to bend it.
**Alternatives considered:**
- Allow source-available "free for non-commercial" deps — rejected; relicensing risk and friction at distribution time.
- Allow proprietary AI orchestration libraries to save weekend hours — rejected; defeats the Article 4 "real AI work" deliverable.
**Trade-offs:** Slower to adopt some commercial conveniences (Auth0 SDK, LangChain, hosted vector DBs). Pays back in portability and OSS-lane signal for hiring tier-B work.
**Article reference:** Article 1.

---

## ADR-2: Python primary, TypeScript scoped to browser

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 2 — immutable)
**Context:** A web app can be built as TS-only with a Node backend, Python-only with a Pyodide front, or split. The ML ecosystem lives in Python; the chess board ecosystem (`react-chessboard`, `chess.js`) lives in JS.
**Decision:** Python owns backend, build scripts, AI features, and any future API layer. TypeScript exists only in the browser bundle. **No Node.js backend.** No polyglot drift — if a feature needs a new language, write a spec amendment first.
**Rationale:** Single-language backend keeps the AI surface area (Phase 4 symbolic stack + LLM glue) in Python, where `python-chess`, `transformers`, `peft`, `torch`, `sentence-transformers` all live. JS-side stays focused on browser rendering and `chess.js` interop.
**Alternatives considered:**
- TypeScript backend (Node + Express or Fastify) — rejected; would push ML work through a poor ecosystem and add a polyglot seam at the AI boundary.
- Pyodide-only frontend — rejected; Pyodide is heavy (10+ MB), and `react-chessboard` would still be needed.
**Trade-offs:** Two test runners (Vitest + pytest), two lint stacks (ESLint + Ruff), two CI lanes. Acceptable cost.
**Article reference:** Article 2.

---

## ADR-3: No heavy AI orchestration frameworks

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 3 — immutable)
**Context:** Frameworks like LangChain, LlamaIndex, CrewAI, AutoGen abstract LLM-tool-chain plumbing. They are tempting for speed but obscure the actual work and lock you into their abstractions.
**Decision:** No LangChain, LlamaIndex, CrewAI, AutoGen, or equivalent. Every LLM call is a direct SDK call (`@anthropic-ai/sdk`, `openai`, `httpx` to Ollama, browser-native `fetch` to llama.cpp WebGPU). Symbolic layer (Phase 4b–4d) is hand-written rule-based code, not a framework. An ESLint rule fails the build if any forbidden orchestration library is imported.
**Rationale:** The project's AI deliverable (Article 4) requires the work to be visible. A LangChain wrapper would hide the symbolic-grounded prompt pipeline behind opaque chains. Direct SDK calls also make prompt caching easy to wire correctly.
**Alternatives considered:**
- Use LangChain just for the retrieval glue — rejected; the moat is the symbolic layer, not the retrieval, and retrieval is small enough to write directly.
- Use a minimal in-house "ReAct loop" library — accepted in spirit (allowed by the article); we will write our own if we ever need agentic behavior.
**Trade-offs:** Slightly more code to write at the LLM seam. Pays back in transparency and zero framework lock-in.
**Article reference:** Article 3.

---

## ADR-4: Repository pattern for all storage

**Date:** 2026-02 (constitution baseline); Phase 0c implementation
**Status:** Accepted (Article 5 — immutable)
**Context:** v1 storage is a static JSON bundle. v2 is planned as SQLite (browser via wasm, or backend-served). Phase 1 adds IndexedDB for SRS. Phase 1.5 adds two more IDB stores. Phase 3 adds two more. The risk is N components × M stores → coupling soup.
**Decision:** All catalog and persisted data flow through interfaces (`OpeningRepository`, `SrsRepository`, `EventsRepository`, `RepertoireRepository`, `LichessRepository`, `CoachContextRepository`). Consumers never import concrete implementations directly. DI factory in `src/storage/index.ts` (legacy) and `src/repository/container.ts` (Phase 1.5+) is the single point of swap. Storage swaps (JSON → SQLite → backend-served) are single-line DI changes.
**Rationale:** Decouples consumers from storage details forever. The cost is a thin interface file per store; the payoff is that the entire repository layer can be re-platformed without touching pages or hooks.
**Alternatives considered:**
- React Context everywhere — rejected; conflates state management with persistence and hides the seam.
- Direct `idb` imports from hooks — rejected; an ESLint rule scopes `idb` to `src/repository/` only.
- Generic ORM (Dexie) — rejected; adds a dependency and the abstraction we want is at the *domain* level, not the IDB level.
**Trade-offs:** One extra layer of indirection. Tests use `_setSrsRepositoryForTesting(…)` style escape hatches.
**Article reference:** Article 5.

---

## ADR-5: Stable line IDs forever

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 6 — immutable)
**Context:** User SRS state is keyed by line.id. Catalog refreshes happen every few weekends as new openings are added. If a refresh ever renumbers IDs, every user loses their box state.
**Decision:** Line and opening IDs are slugs derived from human-readable names (`ruy-lopez-closed-main`). Once published in *any* catalog version, an ID never changes meaning. Catalog refreshes can add or remove lines but never renumber. User SRS state is keyed by these IDs and must survive every refresh.
**Rationale:** Article 6 makes the slug stability a property of the *system*, not a convention the maintainer remembers. Build-time validators enforce: slug regex `^[a-z0-9-]+$`, uniqueness, and presence in current catalog. Tests load a v0.4 SRS snapshot, upgrade to v0.7, and assert zero box-state loss.
**Alternatives considered:**
- Numeric auto-incremented IDs — rejected; trivially unstable across refresh and exact behavior we're forbidding.
- UUIDs assigned once and stored in YAML — rejected; harder to read, hand-author, debug, and grep.
**Trade-offs:** Slug collisions are possible across families (e.g. "main" appears everywhere). Resolved by namespacing: `<family>-<variation>-<line>`.
**Article reference:** Article 6.

---

## ADR-6: Linear lines only — no branching variations in the catalog

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 7 — immutable for v1; amendment required to relax)
**Context:** Real opening theory branches at every move. Chessable models this with branching trees. Linear lines under-represent the theory but radically simplify the data model and the drill flow.
**Decision:** The catalog data model stores one tree per line — pure linear sequence of moves, no branching variations. Branching, if ever introduced, requires an amendment and a version bump in the catalog schema.
**Rationale:** A linear line is one drillable sequence. Branching turns "drill this line" into "drill this position with these N legal continuations," which is a different UX and a different SRS model. Phase 1 SRS is keyed on line.id; a branching model would need position-keyed SRS, a wholly different design.
**Sub-decision (Phase 0d.4):** Sub-decisions captured as **ForkAnnotation** inside lines — inline `⋔` badges on move history with a popover showing the alternative SAN + rationale. This gives "here is a choice the user should know about" *without* turning the line into a tree.
**Alternatives considered:**
- PGN-style branching with mainline + sub-variations — rejected; explosion in catalog complexity and drill UX for v1.
- One line per branch as separate lines with shared prefix — rejected; SRS state would fragment (player learns `<prefix>-A` but not `<prefix>-B` even though both share 80% of moves).
**Trade-offs:** Catalog underspecifies theory. Mitigated by fork annotations + strategic notes + (Phase 1b) Explain Mode rationale. Phase 4d opening KG addresses the *understanding* gap from a different angle.
**Article reference:** Article 7.

---

## ADR-7: Hard depth cap at 20 ply

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 8 — immutable)
**Context:** Without a cap, an enthusiastic curator could push lines into the early middlegame, drilling 30+ moves of theory. Useful for masters, hostile for the target user (any chess player). Also blows up SRS scheduling — a wrong move on ply 28 invalidates everything before it.
**Decision:** No catalog line exceeds 20 ply (10 full moves per side). Default 18, 16 for quiet positional openings, 20 for sharp tactical lines on the whitelist. No exceptions outside this band.
**Rationale:** Caps the drill burden, keeps SRS box state meaningful (a "mastered" line is something you really know), and forces the curator to choose which theory matters.
**Alternatives considered:**
- 25-ply cap to accommodate Najdorf main lines — rejected; the article is a forcing constraint, the curator can split a long line into two shorter lines.
- Variable per-opening cap — rejected; ambiguity in "how deep should this be" is exactly what Article 8 closes.
**Trade-offs:** Some real theory is truncated. Trade-off accepted — Phase 4 AI Coach gives plan-level understanding past the linear line.
**Article reference:** Article 8.

---

## ADR-8: Local-first, no required login

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 11 — immutable)
**Context:** The default mode for a chess training app is a server-backed account with sync. That mode has friction (signup, password, lock-in) and a privacy cost (your repertoire reveals your prep to anyone who can read the server's DB).
**Decision:** No mandatory server-side accounts, no required login, no telemetry collection without opt-in. The app must run end-to-end with only its bundled assets and the user's local browser storage. Cloud/backend features are *additive*, never gating.
**Rationale:** Privacy + portability + zero-friction trial. Lichess sync (Phase 3) is opt-in PKCE OAuth; the dashboard widget shows "Connect Lichess to see out-of-book moments" when disconnected, and the rest of the app is unchanged. Cloud LLM (Phase 4a) is opt-in with user-supplied keys; the in-drill Why? button renders engine-only with a "Configure AI in Settings for narration" footer when no LLM is configured.
**Alternatives considered:**
- Mandatory account for cross-device sync — rejected; sync can be added later as opt-in.
- Anonymous telemetry by default — rejected; Article 11 forbids it.
**Trade-offs:** No cross-device sync in v1. Cross-tab sync (BroadcastChannel) is deferred to v2. Acceptable.
**Article reference:** Article 11.

---

## ADR-9: Backend optional

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 12 — immutable)
**Context:** A Python backend is needed *eventually* for some Phase 4 paths (FastAPI hosting a feature extractor if Pyodide proves too heavy; an org-policy proxy for cloud LLM calls). But forcing every user to run `docker compose up backend` for the trainer is gratuitous.
**Decision:** Phases 1, 1.5, 2, 3, and 4a must function with no backend running. Backend is introduced for *some* Phase 4 paths and remains optional — disabling it degrades AI features only, never breaks the trainer.
**Rationale:** The dual distribution story (live URL + `docker compose up`) requires the live URL to be a static deploy. Backend has to be optional or the live URL breaks. Lichess CORS is friendly enough to keep Phase 3 backend-free.
**Alternatives considered:**
- Backend from Phase 0a to avoid "introducing" it later — rejected; needless surface area for the trainer-only phases.
- Backend mandatory from Phase 3 — rejected; Lichess API is CORS-friendly.
**Trade-offs:** Some Phase 4 paths (e.g., Pyodide for feature extraction) carry a heavy first-use download. Mitigated by lazy-loading on first Coach invocation.
**Article reference:** Article 12.

---

## ADR-10: Weekend pace, never blocks main plan

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 13 — immutable)
**Context:** tabiya is a side project. The author's primary commitment is the AI/ML battle plan + DSA prep + day job at Guidewire. Side-project scope creep is the dominant failure mode.
**Decision:** This project is weekend-only. It does not steal time from the AI/ML battle plan or DSA prep. If the main plan slips or any conflict arises, this project pauses indefinitely. No exceptions.
**Rationale:** Forcing constraint. Every phase spec has a timebox with a cut-line ("if overrun by 50%, drop X and re-spec separately"). Phase 4b–4e are documented but **not scheduled** until the main plan completes the Jan 2027 application window.
**Alternatives considered:**
- Two-month sprint to ship Phase 4 end-to-end — rejected; would gut DSA prep and the application timeline.
- Treat side project as "after hours allowed, weekday eligible" — rejected; bleed into weekdays is the leak Article 13 closes.
**Trade-offs:** Slower delivery. Acceptable.
**Article reference:** Article 13.

---

## ADR-11: Single highlight primitive across every overlay feature

**Date:** 2026-02 (constitution baseline); Phase 1b implementation
**Status:** Accepted (Article 15 — immutable)
**Context:** Three features want to draw on the board: Pattern Visualization (Phase 2 — dim non-key, glow key), Explain Mode (Phase 1b — highlight per-ply focus squares), AI Coach (Phase 4e — red threats, blue outposts, yellow weak squares). Without a primitive, each builds its own SVG overlay.
**Decision:** One primitive: `<HighlightLayer squares={...} mode='bright' | 'spotlight'>`. Different visual modes via a discriminated `mode` prop, not different components. `<ArrowLayer>` is a *sibling* primitive (not a fork) for line/arrow overlays. Article 15 binds: Pattern Viz, Explain Mode, AI Coach all consume the same primitive.
**Rationale:** Three implementations would diverge in coordinate math, tooltip behavior, board-flip handling, and accessibility. One primitive with a `mode` prop normalizes all of it.
**Alternatives considered:**
- Three independent overlays, refactor later — rejected; "refactor later" is how primitives don't get built.
- Render each highlight as a full-screen absolute-positioned div — rejected; coupling to layout, brittle on resize.
**Trade-offs:** `HighlightLayer` carries every visual mode the project ever needs. New modes are added by extending the discriminated union, not forking the component.
**Article reference:** Article 15.

---

## ADR-12: Containerized distribution from Phase 0a

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 16 — immutable)
**Context:** Two distribution paths matter: live URL (Vercel/Netlify) for casual users, `docker compose up` for self-hosted / privacy / portfolio signal. Adding containers "later" usually means never.
**Decision:** Project ships as a `docker compose up` artifact at every phase milestone. All runtime dependencies — frontend, backend, database, engine binaries, AI service — are bundled into Docker images. No host-side install required beyond Docker itself. Every phase design must remain container-friendly: no host-only paths, no system Python assumptions, no native-only deps without an alpine/slim base. Dual distribution maintained from Phase 0a forward.
**Rationale:** Containers are the OSS-lane signal (Kata/CoCo synergy in Phase 5+ stretch). Building compose from day one means each new dependency lands with a tested image, not as host-side debt.
**Alternatives considered:**
- Containerize at Phase 5 polish — rejected; deferring the work makes it the size of a project.
- Single mega-image — rejected; per-service Dockerfiles + compose are the industry norm and easier to reason about per-phase.
**Trade-offs:** Per-service Dockerfiles to maintain. Multi-stage builds with alpine/slim bases keep image size down (< 50 MB frontend).
**Article reference:** Article 16.

---

## ADR-13: RepertoirePick = preset + manual additions + removals

**Date:** 2026-05 (Phase 1.5 spec)
**Status:** Accepted
**Context:** Phase 0d.4 shipped three presets (Beginner / Intermediate / Advanced) + Off, filtering the family grid. User feedback (and the deferred R8 from Phase 1c): "I want the Beginner preset *plus* one Najdorf line" — a manual override on top of a preset.
**Decision:** Persist the user's repertoire pick as `{ presetId, additions: [lineId], removals: [lineId] }` in IndexedDB store `repertoire_pick` (single row, key `current`). Effective pick computed as `(preset.lines ∪ additions) \ removals`, keyed by stable line.id (Article 6). Toggle a preset-member checkbox → moves the line to `removals` (or back). Toggle a non-preset line → moves it to `additions`. Switching presets clears additions + removals after a confirm dialog.
**Rationale:** Preset = sane starting point. Manual override = personal customization. The set-algebra model is simple, deterministic, and tested.
**Alternatives considered:**
- Full custom-only (drop presets) — rejected; new-user friction.
- Multiple stored picks (named repertoires) — deferred to v2.
- Per-color picks — implicit in current model (presets carry `recommended_color`); future expansion possible without schema change.
**Trade-offs:** Switching presets clears manual work (with confirm). Acceptable; alternative is silent merge that confuses users.
**Article reference:** Article 5 (RepertoireRepository), Article 6 (stable line.id).

---

## ADR-14: Explain blocks in sidecar files, lazy-loaded

**Date:** 2026-05-15 (Phase 1b open-question resolution)
**Status:** Accepted
**Context:** Phase 1b adds per-ply rationale + arrows + highlights. A fully-annotated line is ~5–8 KB of explain data. If inlined into `catalog.json`, the base bundle bloats by 200–400 KB once all lines are annotated; the trainer-only user pays for content they never see.
**Decision:** Explain blocks live in **sidecar files** at `data/explain/<line_id>.json` (source) and `public/explain/<line_id>.json` (build output). Lazy-loaded on entering Explain Mode. Base `catalog.json` size unchanged for lines without explain content. `Line.explain?: ExplainBlock[]` is set on the in-memory `Line` only after sidecar hydration.
**Rationale:** Bundle stays lean. Only lines the user opens cost the fetch. Sidecars are static assets bundled with the app — no network fetch in the runtime sense; the browser fetches a static file from the same origin.
**Alternatives considered:**
- Inline `explain` in catalog.json — rejected; bloat (and would force a regen on every authoring tweak).
- Single combined `explain.json` for all lines — rejected; partial loading defeated, every user fetches every line's data.
- Backend-served — rejected; Article 12 says backend optional, and a static-asset sidecar is simpler.
**Trade-offs:** Build pipeline gains a step (validate + copy `data/explain/*.json` → `public/explain/`). Tests harder to write since they need a fetch mock. Acceptable.
**Article reference:** Article 5 (encapsulated in `useExplainContent` hook; future migration to backend is one-hook swap), Article 11 (sidecars bundled).

---

## ADR-15: AI Coach = symbolic understanding layer + LLM as scribe

**Date:** 2026-05 (Phase 4 spec)
**Status:** Accepted (binding architecture decision for Phase 4)
**Context:** The default architecture for an "AI chess coach" is: Stockfish PVs in → LLM → prose. That is a thin GPT wrapper. Article 4 forbids it. The author is a weak chess player but a strong explainer when handed an authority's analysis. The architecture should reflect that.
**Decision:** A deterministic symbolic chess understanding layer sits between the engine and the LLM. The LLM is natural-language synthesis only; it never invents chess truth. The stack: Stockfish (4a) → python-chess feature extractor (4b) → position classifier + motif detector (4c) → semantic tagger + plan extractor + opening KG (4d) → grounded prompt + hallucination block (4e) → LLM as render target.
**Rationale:** This is the project's moat. Three properties matter:
1. **Hallucination is structurally blocked.** By 4e, every chess claim the LLM can make is already in the input bundle. A post-validator asserts every cited tag / motif / feature exists in the prompt input; unknown citations trigger one retry then downgrade to engine-only.
2. **Each layer degrades gracefully.** Engine-only (4a), engine+features (4b), engine+features+classification (4c), etc. — every stage is a valid surface state (Article 11 invariant).
3. **Each layer is a typed interface.** `ChessEngine`, `FeatureExtractor`, `PositionClassifier`, `MotifDetector`, `SemanticTagger`, `PlanExtractor`, `OpeningKG`, `LLMClient`, `CoachContextRepository` — all behind DI (Article 5).
**Alternatives considered:**
- Thin LLM wrapper (Stockfish → Claude → prose) — rejected; Article 4 forbids, and Phase 4a alone is exactly this baseline that 4b–4e replaces (used as a *demo of what the moat replaces*).
- Fine-tune a chess-specific LLM — rejected as primary pillar; expensive, less generalizable, less of a moat narrative. Kept as Phase 4 stretch option.
- Pure RAG over annotated games — rejected as primary; retrieval against fuzzy FEN keys is poor, retrieval against opening-KG nodes (Phase 4d) is the right shape.
**Trade-offs:** Phase 4 is the largest spec. 4a alone is 1–2 weekends; 4b–4e is a 4–5 month arc. Documented but not scheduled until the main plan permits.
**Article reference:** Article 3 (no orchestration framework), Article 4 (real AI work), Article 5 (every layer an interface), Article 9 (SAN at layer boundaries), Article 11 (each layer degrades).

---

## ADR-16: Stockfish WASM in Web Worker over native binary

**Date:** 2026-05 (Phase 4a design)
**Status:** Accepted
**Context:** Phase 4a needs an engine. Stockfish ships as native binary (used by the catalog-build pipeline for sharp-line classification) and as WASM (browser-runnable). For browser inference: native = "user installs Stockfish", WASM = "we bundle it".
**Decision:** Bundle Stockfish as WASM (`stockfish.wasm` / `stockfish.js`) loaded inside a dedicated Web Worker. Engine I/O exclusively via worker `MessageChannel`; main thread never calls engine APIs synchronously. Lazy-loaded chunk activated only on first Coach invocation. Engine state surfaced as `idle | loading | ready | error`.
**Rationale:** Aligns Article 11 (no host-side install), Article 12 (no backend required), Article 16 (containerized — bundled into frontend image, no extra service). Lazy-loading keeps the base trainer bundle untouched (R9.7 — base bundle gzip must not grow by more than 30 KB for the engine-aware shell).
**Alternatives considered:**
- Native Stockfish via FastAPI backend — rejected; forces backend dependency (Article 12 violation for the trainer-only experience).
- Leela Chess Zero — interface-compatible (`ChessEngine.name: 'stockfish' | 'leela'`) but not bundled in 4a; the engine choice is a Settings preset away.
- Engine-on-demand via cloud API (Lichess Cloud Eval) — rejected; Article 11 (no required network) and rate-limiting concerns.
**Trade-offs:** WASM Stockfish is slower than native (~50%). Acceptable; the Coach Settings presets (Fast / Balanced / Deep) accommodate the depth knob.
**Article reference:** Article 5 (`ChessEngine` interface, single concrete impl `StockfishWasmEngine`), Article 11 (engine load failure renders Coach in degraded engine-unavailable state; drill itself remains fully functional).

---

## ADR-17: OAuth PKCE in browser, no callback backend

**Date:** 2026-05 (Phase 3 design)
**Status:** Accepted
**Context:** Lichess OAuth normally expects a backend that holds the client secret and exchanges the auth code. Adding a backend just for OAuth violates Article 12.
**Decision:** Implement Lichess OAuth 2.0 **PKCE flow** in the browser. Code verifier + challenge generated client-side with browser-native `crypto.subtle` (SHA-256 + base64url). No client secret. Callback URL is `/<origin>/lichess/callback` served by the existing static deploy (Vite dev or nginx prod). The token is exchanged in-browser and persisted in `localStorage` under `tabiya.lichess.token.sensitive`. No heavy auth framework (no Auth0 SDK, no `@auth/*`, no Passport).
**Rationale:** PKCE was designed exactly for this case (public clients without a backend). Lichess supports it. The implementation is ~80 LOC of native `crypto.subtle` + `fetch`. Article 1 (OSS only) and Article 3 (no heavy framework) both satisfied. Article 12 (backend optional) preserved.
**Alternatives considered:**
- Backend proxy for OAuth — rejected; would force docker-compose backend for Lichess sync.
- Implicit grant flow — rejected; deprecated, less secure, no Lichess support.
- Skip OAuth, use public profile name + public API only — rejected; rate limits + missing private games.
**Trade-offs:** Token in `localStorage` is XSS-readable. Documented as Open Question (token encryption at rest with user passphrase via `crypto.subtle` AES-GCM is tracked for v2 if XSS surface grows).
**Article reference:** Article 1 (no proprietary auth SDK), Article 3 (no heavy auth framework), Article 11 (opt-in additive — disconnecting clears state and the dashboard widget returns to empty state), Article 12 (backend optional preserved).

---

## ADR-18: Scrape + LLM-extract + human-review pipeline for key_squares

**Date:** 2026-05 (Phase 2 design)
**Status:** Accepted
**Context:** Phase 2 needs `key_squares` data for ~50 openings. Options: hand-author every entry, runtime LLM call, or offline build pipeline. The author does not know chess theory deeply enough to hand-author 50 openings; runtime LLM calls violate Article 11; pure LLM extraction without human review will produce hallucinations.
**Decision:** Three-step offline pipeline.
1. **Scrape** permissively-licensed sources (Wikipedia chess-opening pages CC BY-SA, Lichess opening explorer descriptions, openly-licensed PDFs) into `data/key_squares/scraped/<opening_slug>.json`. Respect robots.txt, rate-limit ≤1 req/s per host.
2. **Extract** via Anthropic SDK direct call, few-shot grounded with 3–5 hand-authored exemplars. Output: draft `{square, role, for_color, rationale, source_url}` records to `data/key_squares/pending/<opening_slug>.yml`.
3. **Review** via `scripts/key_squares/review.py` — ASCII board + draft + `[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit`. Approved drafts appended to `scripts/curated/key_squares.yml`. Rejected → `data/key_squares/rejected/` for prompt-tuning history.

Only `scripts/curated/key_squares.yml` (audited) is consumed by the catalog build (Article 11 — only audited content ships).
**Rationale:** Three-step pipeline lets the author leverage LLM throughput (extraction is the slow part if done by hand) without surrendering quality control. Human review is the throttle; Phase 2a → 2b unlock gate requires ≥30 openings reviewed before any 2b UI work merges.
**Alternatives considered:**
- Pure hand-curation — rejected; author chess knowledge limits, weekend pace.
- Runtime LLM extraction — rejected; Article 11 (no required network), unreviewable hallucinations.
- LLM-only without review — rejected; hallucinated squares would ship to users.
**Trade-offs:** Review is the bottleneck. Phase 2a → 2b gate accepts this (don't ship 2b without 30 openings of content).
**Article reference:** Article 1 (permissive source licenses), Article 3 (direct Anthropic SDK, no LangChain), Article 11 (runtime makes zero network calls for key squares).

---

## ADR-19: Spotlight overlay (theatre lights) as Pattern Viz visual

**Date:** 2026-05 (Phase 2 R6)
**Status:** Accepted
**Context:** Pattern Visualization needs a visual treatment that trains *attention* on key squares. The two candidates: dim-pieces+colored-squares (the original Phase 0 sketch) and dim-everything+spotlight-cutouts (theatre-lights metaphor).
**Decision:** Spotlight overlay — single semi-transparent rectangle covers the entire board, with cutouts at the key squares' coordinates. Each cutout renders a soft glow colored by `role`: `outpost` → green, `control` → blue, `tension` → amber, `weak` → red. Visual reference at `/workspaces/personal/AI/Projects/tabiya/chessViz`.
**Rationale:** Theatre lights pull attention more strongly than colored highlights on a normal board. The dim layer removes the visual noise of all the pieces and other squares; the eye is forced to the cutouts. Trains pattern recognition rather than memorization.
**Alternatives considered:**
- Dim pieces to 20% opacity + colored square overlays — rejected; pieces still distract; multiple colors compete.
- Outline only (square borders, no fill) — rejected; too subtle.
- Animated pulse — rejected; visual noise, accessibility concerns.
**Trade-offs:** SVG overlay with cutouts is slightly more complex than per-square coloring. Bounded budget of +6 KB gzip for `<SpotlightOverlay>` (R6.8). Reuses Article 15 `<HighlightLayer>` primitive — not a fork.
**Article reference:** Article 15 (single highlight primitive; spotlight is a *mode* of HighlightLayer, not a sibling).

---

## ADR-20: Heatmap NOT reusing the single-highlight primitive

**Date:** 2026-05 (Phase 1.5 R3.6)
**Status:** Accepted
**Context:** Phase 1.5 adds a tabbed heatmap (daily activity / per-opening accuracy / hour-of-day). The board overlay primitive is `(square: ChessSquare, color: HighlightColor) → SVG overlay over a chess board`. Heatmap cells are `(coordinate: GridCoord, bucket: number) → colored rect in a calendar/grid`. A future refactor could *try* to merge them under one "highlight" abstraction.
**Decision:** The heatmap is a **separate** primitive (`HeatmapTabs` with three child renderers `DailyActivityGrid`, `OpeningAccuracyGrid`, `HourOfDayRow`). It **does not** reuse the Article 15 board square-highlight primitive. Cells are named/classed `heatmap-cell` to make the boundary obvious. The board overlay primitive remains reserved for the board.
**Rationale:** Different coordinate spaces (chess board vs calendar grid), different lifecycles (board overlay is transient on click/hover; heatmap cell is static layout). Merging them would couple two primitives that have no shared invariants beyond "renders a colored rectangle." Article 15 is explicit about the *board* primitive; this decision documents *why* heatmap is excluded so a future "let's unify all colored rectangles" refactor is blocked.
**Alternatives considered:**
- Merge under a "ColoredCell" abstraction — rejected; false generalization.
- Use the highlight primitive with a different `coordinateSpace` prop — rejected; primitive grows unbounded.
**Trade-offs:** Two primitives instead of one. Acceptable; they have nothing in common semantically.
**Article reference:** Article 15 (board primitive reserved; this ADR is the explicit non-reuse note for future refactors).

---

## ADR-21: Charting hand-rolled SVG, no charting library

**Date:** 2026-05 (Phase 1.5 design §7.3)
**Status:** Accepted
**Context:** Phase 1.5 dashboard surfaces (heatmap tabs, accuracy cards, streak cards) typically reach for a charting library (`recharts`, `victory`, `chart.js`). Combined budget is +20 KB gzip across all new components.
**Decision:** Hand-roll inline SVG + CSS grid for all charts. No charting library. Use `<rect>` per cell, native `<title>` for tooltips (zero JS, accessible, free). Bucket math is pure functions; no `d3-scale`.
**Rationale:** `recharts` / `victory` cost 40+ KB gzip — blows the budget. `d3-scale` alone is ~9 KB and pulls peer deps. Hand-rolled heatmap code is ~2 KB. Budget split: heatmap 7 KB, RepertoirePicker 5 KB, hooks 3 KB, repositories 4 KB, buffer 1 KB.
**Alternatives considered:**
- `recharts` / `victory` — rejected; budget.
- `d3-scale` only (just for bucketing) — rejected; saves bucket math but adds peer deps; the bucket math is 10 lines.
- `d3-array` `extent`/`bisect` — accepted as optional micro-import if a perf hot path appears later (not in v1.5).
**Trade-offs:** More UI code to write. Acceptable; the components are small and the team is one person.
**Article reference:** Article 14 (type discipline holds — no `any`).

---

## ADR-22: Direct SDK calls for LLM, prompt caching from day one

**Date:** 2026-05 (Phase 4a R5)
**Status:** Accepted
**Context:** Phase 4a needs four LLM providers: Anthropic (default), OpenAI, Ollama (local), llama.cpp WebGPU (in-browser). LangChain etc. forbidden (Article 3).
**Decision:** Define `LLMClient` interface; ship four concrete implementations. Anthropic uses `@anthropic-ai/sdk` directly with `cache_control: { type: 'ephemeral' }` on system + few-shot block. OpenAI uses `openai` SDK directly. Ollama uses `httpx`/`fetch` against `http://localhost:11434`. llama.cpp WebGPU is browser-native inference, gated behind feature flag `tabiya.flag.webgpuLlm` in 4a (200–500 MB first-use model download — UX is rough). Provider chosen in Settings; runtime DI returns the configured `LLMClient`.
**Rationale:** Direct SDK calls let prompt caching land correctly on day one. Estimated cost: ~50 invocations per demo session × 1500 input tokens × $0.80 / 1M = $0.06/session — comfortably under the $5/month budget.
**Alternatives considered:**
- Single LLM provider (Anthropic only) — rejected; portability matters for self-host demos.
- OpenAI default — rejected; cost (gpt-4o-mini close to haiku but worse on chess reasoning in the author's tests).
- Local-only by default — rejected; quality floor of `llama3.2:3b-instruct` is too low for the moat narrative.
**Trade-offs:** Four implementations to maintain. Acceptable; each is a ~50-line file behind the `LLMClient` interface.
**Article reference:** Article 3 (no orchestration framework), Article 5 (`LLMClient` interface; provider swap is single-DI change), Article 11 (graceful degrade: no LLM → engine card + "Configure AI in Settings" footer).

---

## ADR-23: 4a "honest baseline" — show engine truth alongside LLM prose

**Date:** 2026-05 (Phase 4a R7 + R9.9)
**Status:** Accepted
**Context:** Phase 4a is shallow by design — Stockfish PVs piped into Claude with no symbolic grounding. The 4a UI must not lie about this. The risk is users (or future-author looking back) read 4a as "the moat doesn't work" rather than "the moat hasn't been built yet."
**Decision:** The Surface A (in-drill Why?) modal always renders the **Engine card** (best move SAN, eval, top-N PVs, engine name + depth + preset). The LLM narration card is rendered *in addition* iff an LLM is configured and responded successfully. A degraded-mode footer ("Configure AI in Settings to enable narration.") replaces the LLM card when no LLM is configured. The 4a prompt template includes an explicit honest constraint: *"You see Stockfish PVs and the user's recent moves. You do NOT see deep positional features. Keep explanations to 1–4 sentences. If the engine output is ambiguous, say so rather than invent."* The 4a manual walkthrough doc (`evals/coach/4a-walkthrough.md`) labels the expected outcome: *"roughly half of explanations will feel shallow or generic. This is acceptable for 4a. It is the baseline we measure 4b–4e against."*
**Rationale:** Engineering honesty + a forcing function. The 4b–4e arc has to be worth doing; the only way to know is to have a baseline to beat. The 4a UI shows the user (and the author) what the moat replaces.
**Alternatives considered:**
- Don't ship 4a; wait for 4b — rejected; 4b–4e is 4–5 months and not scheduled. 4a is shippable in 1–2 weekends and unblocks every dependent surface.
- Hide engine PVs from the UI; show only prose — rejected; loses the honesty.
**Trade-offs:** Demo screenshots may show a shallow explanation. Acceptable; the demo narrative is "this is the baseline."
**Article reference:** Article 4 (real AI work — 4a alone is honest baseline, the AI deliverable is 4e's eval-gated grounded pipeline), Article 11 (degraded mode — engine card always present, prose optional).

---

## ADR-24: SAN at every layer boundary

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 9 — immutable)
**Context:** Chess move notation has three options: SAN (`Nf3`), UCI (`g1f3`), coordinates (`g1-f3`). `chess.js` defaults to SAN. `python-chess` defaults to UCI internally but renders SAN easily. Stockfish speaks UCI on the wire.
**Decision:** All move data in catalog, drill state, game imports, AI exchanges, and layer boundaries uses **SAN**. No UCI, no coordinates, no custom formats. UCI exists only *inside* `StockfishWasmEngine` and is converted at the boundary. `chess.js` (frontend) and `python-chess` (backend) both consume SAN by default.
**Rationale:** One notation across the whole stack. Authoring (YAML lines), runtime (drill validator), AI exchanges (OOB event `playedSAN`, `expectedSANs`; coach `EngineAnalysis.pvs[].moves[]`), tests (golden games), logs — all SAN. UCI in catalog YAML would be machine-friendly but human-hostile; mixed conventions would be a bug magnet.
**Alternatives considered:**
- UCI everywhere — rejected; human-hostile for hand-authored YAML and authoring CLIs.
- UCI in catalog, SAN at runtime — rejected; boundary conversion in two places (build + runtime).
**Trade-offs:** Layer boundaries need SAN conversion at the engine seam. Implemented once in `StockfishWasmEngine`.
**Article reference:** Article 9.

---

## ADR-25: Standalone and generalized — no hardcoded user identity

**Date:** 2026-02 (constitution baseline)
**Status:** Accepted (Article 10 — immutable)
**Context:** The author's instinct is to bake their personal Sicilian Najdorf prep into the v1 catalog. That makes the app useful to one person — the author — and unmarketable.
**Decision:** The app works for *any* player's prep, not the author's only. No hardcoded user identities, no personal repertoires baked into the bundle, no chess.com/lichess username defaults. Naming stays generic (`Repertoire`, `Line`, `Drill`, not "My Sicilian", "Abhi's Repertoire").
**Rationale:** Portfolio value, generalizability, real user count > 1. The Phase 1.5 RepertoirePick layer + Phase 3 Lichess sync make this real: each user picks their own repertoire and connects their own Lichess account.
**Alternatives considered:**
- Ship author's personal repertoire as default — rejected; Article 10.
- Author-specific demo branch — accepted as a *demo build*, not the default bundle.
**Trade-offs:** Slightly more upfront design (preset system, RepertoirePick). Pays back as soon as user count > 1.
**Article reference:** Article 10.

---

## Cross-reference: Constitution articles → ADRs

| Article | Topic | Implementing ADRs |
| --- | --- | --- |
| 1 | Open source only | ADR-1, ADR-17, ADR-18 |
| 2 | Python primary, TS browser-only | ADR-2 |
| 3 | No heavy AI orchestration | ADR-3, ADR-17, ADR-18, ADR-22 |
| 4 | AI must be real model work | ADR-15, ADR-23 |
| 5 | Repository pattern | ADR-4, ADR-13, ADR-15, ADR-16, ADR-22 |
| 6 | Stable line IDs forever | ADR-5, ADR-13 |
| 7 | Linear lines only | ADR-6 |
| 8 | Hard depth cap 20 ply | ADR-7 |
| 9 | SAN at every boundary | ADR-15, ADR-24 |
| 10 | Standalone + generalized | ADR-25 |
| 11 | Local-first | ADR-8, ADR-14, ADR-16, ADR-17, ADR-18, ADR-22, ADR-23 |
| 12 | Backend optional | ADR-9, ADR-16, ADR-17 |
| 13 | Weekend pace | ADR-10 |
| 14 | Type discipline | (all — TS strict + Python type hints across every ADR's implementation) |
| 15 | Single highlight primitive | ADR-11, ADR-19, ADR-20 |
| 16 | Containerized distribution | ADR-12 |

---

## Open questions deferred

Decisions not yet made — captured for the spec session that lands the relevant phase. Not binding.

- **Token encryption at rest** (Phase 3 Q1). Plain `localStorage` with `.sensitive` naming for v1; revisit if XSS surface grows.
- **Sync window for power users** (Phase 3 Q2). 100 games / 15 days for v1; "Sync older window" advanced option deferred.
- **OOB multiple-candidate attribution** (Phase 3 Q3). Deterministic deepest-line + lex-sort tiebreak in v1; multi-candidate UI deferred to Phase 4 Surface B.
- **Pyodide vs FastAPI for symbolic layer** (Phase 4b Q3). Lean Pyodide for Article 12; decision at 4b kickoff.
- **Sub-phase amalgamation** (Phase 4 Q5). 4b+4c may ship together as "symbolic layer"; 4d+4e separately as "grounded semantic layer." Decision at 4b kickoff.
- **Eval set composition** (Phase 4e Q4). 50 scenarios cover the 5 active openings? Need a coverage matrix before 4e.
