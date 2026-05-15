# Tasks: Phase 4a — Naive Engine + LLM MVP (ACTIVE BUILD)

Scope: **Phase 4a ONLY.** Stockfish.wasm in a worker, four LLMClient impls, minimal CoachContext (engine + history), Settings UI, Surface A (in-drill Why modal), engine-only degraded mode, in-memory cache, tests, lint gates, size budget.

Format: every task carries `ID`, `BlockedBy`, `Agent`, `File`, `Change`, `Outcome`, `Context`. Tasks with the same `BlockedBy` may execute in parallel.

References: `requirements.md` R1–R9 (4a active section); `design.md` Sections 1–10 (4a detailed); `constitution.md` Articles 1, 3, 5, 9, 11, 12, 13, 14.

---

## Implementation Tasks

### Phase 1: Setup — Dependencies, License Audit, Lint Gates

- [ ] **Task 1.1**: Add `stockfish.wasm` (or equivalent npm `stockfish` build) to `package.json` and verify GPLv3 compatibility for bundled distribution
  - **ID**: `task-1.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `package.json`, `tech.md`
  - **Change**: `npm install stockfish.wasm`; record exact package name, version, license (GPLv3) in `tech.md` allowed-deps table with explicit note "GPLv3 — copyleft permitted by Article 1, but redistribution requires source availability; engine ships as separate runtime asset, no static linking concern in browser context."
  - **Outcome**: Stockfish wasm binary available under `node_modules`; license declared; build still passes.
  - **Context**: R1.1 — bundle Stockfish as WASM Web Worker. Article 1 — copyleft (GPL family) is permitted, but author must declare. Article 16 — engine binary must be containerizable; verify the `.wasm` is a static asset, not a host install.

- [ ] **Task 1.2**: Add `@anthropic-ai/sdk` and `openai` to `package.json`; verify MIT licenses; record in `tech.md`
  - **ID**: `task-1.2`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `package.json`, `tech.md`
  - **Change**: `npm install @anthropic-ai/sdk openai`; add both to `tech.md` allowed-deps with version + MIT license declaration.
  - **Outcome**: Both SDKs installable; no peer-dep warnings; bundle untouched until runtime import.
  - **Context**: R5.2 — Anthropic + OpenAI direct SDK clients required. Article 1 — both MIT, permitted. Article 3 — direct SDK, NO LangChain/LlamaIndex/CrewAI. Confirm `package.json` does not pull in any of those transitively.

- [ ] **Task 1.3**: Add Ollama detection helper (no SDK — raw fetch) and stub WebGPU feature-flag config
  - **ID**: `task-1.3`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/config/featureFlags.ts`
  - **Change**: Add `tabiya.flag.webgpuLlm` feature flag (default `false`); document Ollama is fetch-only at `http://localhost:11434` (no npm dep needed).
  - **Outcome**: Feature-flag module exports typed flags map; `webgpuLlm` defaults off.
  - **Context**: R5.2 (Ollama), Open Question #2 (WebGPU behind flag). Article 11 — local-first, no mandatory network. Article 12 — Ollama is optional.

- [ ] **Task 1.4**: Install ESLint `no-restricted-imports` rule blocking `langchain`, `@langchain/*`, `llamaindex`, `crewai`
  - **ID**: `task-1.4`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `.eslintrc.cjs` (or `eslint.config.js`)
  - **Change**: Add `no-restricted-imports` with patterns `langchain`, `@langchain/*`, `llamaindex`, `crewai`; severity = error.
  - **Outcome**: CI build fails if any banned import appears anywhere in `src/`. Verified by adding a temporary import in a scratch file and watching lint fail, then removing.
  - **Context**: Article 3 — no heavy AI orchestration. R5.7, R9.6 — explicit lint gate. Stripe/Shopify ESLint patterns: package-level deny lists are the standard guardrail.

- [ ] **Task 1.5**: Verify TypeScript strict mode is enabled and add Vite Worker plugin config
  - **ID**: `task-1.5`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `tsconfig.json`, `vite.config.ts`
  - **Change**: Confirm `"strict": true`; add Vite config for Worker as dynamic-import chunk (`worker: { format: 'es' }`); confirm `?worker` import syntax supported.
  - **Outcome**: `new Worker(new URL('./stockfish-worker.ts', import.meta.url), { type: 'module' })` resolves at build time; chunk emitted as separate `.js` file.
  - **Context**: Article 14 — TS strict. Design §1 — worker entry pattern. Vite official docs `vite.dev/guide/features.html#web-workers` for ESM worker pattern; matches Linear and Vercel app patterns.

### Phase 2: ChessEngine Interface + Types (Article 5)

- [ ] **Task 2.1**: Define `ChessEngine` interface, `EngineOpts`, `EngineAnalysis` types
  - **ID**: `task-2.1`
  - **BlockedBy**: `task-1.5`
  - **Agent**: `architect`
  - **File**: `src/engine/ChessEngine.ts`
  - **Change**: Export `ChessEngine` interface (methods `analyze`, `stop`, `ready` Promise, `name` readonly union); `EngineOpts` (`depth?`, `multipv?`, `movetimeMs?`, `signal?: AbortSignal`); `EngineAnalysis` (`fen`, `bestmove` SAN, `pvs[]` with SAN moves + `scoreCp` + optional `mateIn` + `depth`, `engineName`, `engineDepth`). All move strings SAN per Article 9.
  - **Outcome**: Compiles cleanly; no concrete impl referenced. Type tests confirm `EngineAnalysis.pvs[N].moves[M]` is `string` (SAN); `EngineAnalysis` is a *strict superset* of fields that future 4b `FeatureExtractor` will consume.
  - **Context**: R2.1, R2.6 — interface contract + forward-compatibility for 4b. Article 5 — interface-first; Article 9 — SAN at all boundaries. Design §1 ChessEngine block. Pattern reference: Stripe `stripe-node` `Stripe.Resource` interface — concrete impls hidden behind a single typed surface.

### Phase 3: Stockfish.wasm Web Worker + UCI Protocol

- [ ] **Task 3.1**: Implement `stockfish-worker.ts` — load wasm, drive UCI handshake, parse `info` + `bestmove`
  - **ID**: `task-3.1`
  - **BlockedBy**: `task-2.1`, `task-1.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/engine/stockfish-worker.ts`
  - **Change**: Worker entry that imports stockfish.wasm; on `{type:'init'}` send `uci` + `isready`, reply `{type:'ready'}`; on `{type:'analyze',id,fen,opts}` send `position fen <fen>` then `go depth N multipv K` (using opts); parse incoming UCI `info depth ... multipv ... score cp ... pv ...` lines, accumulate per-multipv entries; on `bestmove <uci>` convert all UCI moves in accumulated PVs to SAN via in-worker `chess.js` instance, emit `{type:'analysis', id, analysis}`; on `{type:'stop'}` send `stop`.
  - **Outcome**: Worker handles concurrent `analyze` calls via `id` correlation; UCI is fully encapsulated inside the worker; main thread only ever exchanges SAN. PV parsing handles negative scores, `score mate N`, and partial info lines.
  - **Context**: R1.2 (worker MessageChannel only), R1.6 (parsed info + bestmove), R2.2 (UCI→SAN inside worker). Design §1 UCI protocol diagram. Pattern: lichess.org open-source uses identical wasm-in-worker isolation in `lila-stockfish-web`.

- [ ] **Task 3.2**: Implement `StockfishWasmEngine` class — owns worker, exposes `ChessEngine` interface, handles ready/pending/abort
  - **ID**: `task-3.2`
  - **BlockedBy**: `task-3.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/engine/StockfishWasmEngine.ts`
  - **Change**: Class implements `ChessEngine`. Constructor spawns Worker via `new URL(...)` ESM-style; resolves `ready` on `{type:'ready'}`. `analyze` posts `{type:'analyze',id,fen,opts}`, returns Promise tracked in `Map<id, resolve>`; wires `opts.signal?.addEventListener('abort', () => this.stop())`. `stop` posts `{type:'stop'}` and rejects all pending. `name = 'stockfish' as const`. `engineName` constant `"Stockfish 16"` (or whatever the wasm build reports — read from `uciok` handshake if available).
  - **Outcome**: Concurrent `analyze` calls resolved independently by id; aborting one cancels in-flight without affecting other clients; `stop()` is idempotent.
  - **Context**: R1.1, R1.2, R1.6, R2.3. Design §1 `StockfishWasmEngine` block. Article 11 — `ready` failure surfaces as rejected promise but does NOT crash app. Pattern: Cloudflare Workers SDK uses identical `id` correlation map for RPC over postMessage.

- [ ] **Task 3.3**: Lazy-load engine chunk on first Coach invocation (Article 11 bundle budget)
  - **ID**: `task-3.3`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/engine/engineLoader.ts`
  - **Change**: Export `loadStockfishEngine(): Promise<ChessEngine>` that dynamic-imports `./StockfishWasmEngine` so Vite emits a separate chunk; cache the resolved engine in module scope (singleton per session). Surfaces consume only this loader, never the concrete class.
  - **Outcome**: Base trainer bundle gzip does NOT include stockfish.wasm or `StockfishWasmEngine`; chunk loads on first Coach modal open. Bundle analyzer confirms split.
  - **Context**: R1.3 (lazy chunk if >2MB gzip), R9.7 (≤30 kB base bundle delta). Design §10 Size budget. Pattern: Vercel/Next.js dynamic-import pattern; Linear's Loom-style lazy editors use identical loader-singleton pattern.

### Phase 4: Engine Presets (Settings + Config)

- [ ] **Task 4.1**: Define engine preset config `Fast | Balanced | Deep` mapping to `EngineOpts`
  - **ID**: `task-4.1`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `architect`
  - **File**: `src/engine/presets.ts`
  - **Change**: Export `ENGINE_PRESETS` const object: `Fast: {depth:12,multipv:3,movetimeMs:500}`, `Balanced: {depth:20,multipv:3,movetimeMs:2000}`, `Deep: {depth:30,multipv:5,movetimeMs:5000}`. Export type `EnginePresetName = keyof typeof ENGINE_PRESETS`. Export helper `getEnginePreset(name): EngineOpts` and `loadPresetFromStorage(): EnginePresetName` reading `localStorage.tabiya.engine.preset` with default `'Balanced'`.
  - **Outcome**: Single source of truth for presets; UI and pipeline both consume from this module.
  - **Context**: R3.1, R3.2, R3.4. Design §1 presets block. Article 11 — localStorage is the persistence boundary.

- [ ] **Task 4.2**: Build `EngineSection` Settings UI — preset radio + localStorage persistence
  - **ID**: `task-4.2`
  - **BlockedBy**: `task-4.1`
  - **Agent**: `general-purpose`
  - **File**: `src/components/settings/EngineSection.tsx`
  - **Change**: React component with radio group (`Fast | Balanced | Deep`); on change, write `localStorage.tabiya.engine.preset` and emit a `tabiya:engine-preset-changed` `CustomEvent` on `window` so `useCoach` can invalidate cache. NO raw depth/multipv knobs.
  - **Outcome**: User can switch preset; choice persists across reloads; cache invalidation event dispatched.
  - **Context**: R3.1, R3.3 (no raw knobs), R3.4, R3.6 (cache invalidate on change). Design §4 Settings tree.

### Phase 5: LLMClient Interface + Four Concrete Implementations

- [ ] **Task 5.1**: Define `LLMClient` interface and prompt/response types
  - **ID**: `task-5.1`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `api-designer`
  - **File**: `src/coach/LLMClient.ts`
  - **Change**: Export `LLMClient` interface (`complete`, optional `stream`, readonly `providerName`, readonly `modelName`, `available()`); `ProviderName` union (4 values); `PromptPayload` (`systemPrompt`, `userPrompt`, optional `stops`, `maxTokens`, `temperature`); `LLMResponse` (`text`, `modelName`, optional `usage: TokenUsage`); `LLMChunk` for streaming. Forward-compatible: response shape must accommodate future `tags_cited`/`motifs_cited`/`features_cited` (4e) without breaking 4a callers — add `parsed?: unknown` escape hatch.
  - **Outcome**: Interface compiles; no concrete impl yet; type tests confirm `LLMClient.complete` returns `Promise<LLMResponse>`.
  - **Context**: R5.1, R5.7 (forward-compat hedge for 4e). Article 3 — direct SDK. Article 5 — interface-first. Design §3 LLMClient block. Pattern: Vercel AI SDK `LanguageModelV1` interface is structurally similar — typed payload in, structured response out, provider-agnostic surface.

- [ ] **Task 5.2**: Implement `AnthropicLLMClient` with prompt caching on system prompt
  - **ID**: `task-5.2`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/AnthropicLLMClient.ts`
  - **Change**: Class implements `LLMClient`. Constructor takes `modelName` + `apiKey`. `available()` returns `Boolean(this.apiKey)`. `complete` calls `Anthropic({apiKey, dangerouslyAllowBrowser: true}).messages.create` with `system: [{type:'text', text: systemPrompt, cache_control: {type:'ephemeral'}}]` (prompt caching). Default model `claude-haiku-4-5-20251001`. Concatenate text blocks; return `{text, modelName, usage}`.
  - **Outcome**: Real call against Anthropic API succeeds; usage reports cache_read_input_tokens on 2nd call with same system prompt.
  - **Context**: R5.2, R5.3 (caching mandatory for cost discipline). Article 3 — direct SDK. Design §3 AnthropicLLMClient block. Anthropic docs `docs.anthropic.com/en/docs/build-with-claude/prompt-caching` — system-message ephemeral cache_control is the documented pattern.

- [ ] **Task 5.3**: Implement `OpenAILLMClient` (direct `openai` SDK)
  - **ID**: `task-5.3`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/OpenAILLMClient.ts`
  - **Change**: Class implements `LLMClient`. Default model `gpt-4o-mini`. `complete` calls `new OpenAI({apiKey, dangerouslyAllowBrowser: true}).chat.completions.create` with system + user message; no special caching headers. `available()` returns `Boolean(apiKey)`.
  - **Outcome**: Real call against OpenAI API succeeds; returns text + usage.
  - **Context**: R5.2. Article 3 — direct SDK. Design §3.

- [ ] **Task 5.4**: Implement `OllamaLLMClient` (HTTP fetch to localhost:11434)
  - **ID**: `task-5.4`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/OllamaLLMClient.ts`
  - **Change**: Class implements `LLMClient`. Constructor takes `modelName` and optional `endpoint` (default `http://localhost:11434`). `available()` fetches `${endpoint}/api/tags` with try/catch, returns boolean. `complete` POSTs to `${endpoint}/api/chat` with `{model, messages:[{role:'system',...},{role:'user',...}], stream:false, options:{temperature, num_predict}}`; parses `json.message.content`.
  - **Outcome**: With Ollama running locally, real call succeeds; with no Ollama, `available()` returns false and surface goes to degraded mode.
  - **Context**: R5.2, R5.5 (degraded mode on unreachable). Article 11 — local-first; Article 12 — backend optional. Design §3 Ollama block.

- [ ] **Task 5.5**: Implement `LlamaCppWebGPULLMClient` skeleton (feature-flagged)
  - **ID**: `task-5.5`
  - **BlockedBy**: `task-5.1`, `task-1.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/LlamaCppWebGPULLMClient.ts`
  - **Change**: Class implements `LLMClient`. `available()` returns `Boolean((navigator as any).gpu) && featureFlags.webgpuLlm`. `complete` for 4a throws `NotImplementedError` (or returns a stub explanation) — actual WebGPU model loading deferred to 4a.1 follow-up. Skeleton ensures the interface is honored.
  - **Outcome**: Class compiles; `available()` correctly returns false on most devices and when flag off; UI gates the option behind the flag.
  - **Context**: R5.2, Open Question #2 (WebGPU 4a.1 follow-up). Design §3 LlamaCppWebGPU block.

- [ ] **Task 5.6**: Wire DI factory `getLLMClient(): LLMClient | null` reading Settings
  - **ID**: `task-5.6`
  - **BlockedBy**: `task-5.2`, `task-5.3`, `task-5.4`, `task-5.5`
  - **Agent**: `architect`
  - **File**: `src/coach/container.ts`
  - **Change**: Export `getLLMClient(): LLMClient | null` that reads `localStorage.tabiya.ai.location`, `tabiya.ai.provider`, `tabiya.ai.model`, `tabiya.ai.apiKey` and returns the configured concrete `LLMClient`, or `null` if no usable config. Export `_setLLMClientForTesting(client)` for test injection. Consumers (Coach pipeline) depend only on the interface.
  - **Outcome**: Single function returns the right client per Settings; surfaces never `import { AnthropicLLMClient }` directly.
  - **Context**: R5.4 (Settings selects provider; DI at runtime), R5.5 (returns null → degraded mode). Article 5 — single-DI swap.

### Phase 6: Settings UI — Inference Location + API Key (Security Review Required)

- [ ] **Task 6.1**: Build `AISection` Settings UI — radios, dropdowns, API key field
  - **ID**: `task-6.1`
  - **BlockedBy**: `task-5.6`
  - **Agent**: `general-purpose`
  - **File**: `src/components/settings/AISection.tsx`
  - **Change**: Section with: `Inference Location` radio (`Cloud | Local (Ollama) | Local (Browser WebGPU)`, last option gated by `featureFlags.webgpuLlm`); `Provider` dropdown (`Anthropic | OpenAI`, cloud only); `Model` text input prefilled per provider default (`claude-haiku-4-5-20251001` / `gpt-4o-mini` / `llama3.2:3b-instruct`); `API Key` password-masked input (cloud only) with helper text "Stored locally. Never sent to tabiya servers." and a `[Clear key]` button; `[Test connection]` button calling `client.complete({maxTokens:1, ...})` and rendering inline success/failure diagnostic; Ollama-unreachable inline warning when location=Ollama and `available()` is false. Default location = `Cloud` if apiKey present, else `Local (Ollama)`.
  - **Outcome**: User configures provider end-to-end; localStorage keys `tabiya.ai.location|provider|model|apiKey` populated; Test button gives actionable diagnostic.
  - **Context**: R6.1–R6.4. Design §4 Settings tree. Article 11 — keys local-only.

- [ ] **Task 6.2**: Security review of API key handling — never logged, never in snapshots, never on console, never to telemetry
  - **ID**: `task-6.2`
  - **BlockedBy**: `task-6.1`
  - **Agent**: `security-reviewer`
  - **File**: `src/components/settings/AISection.tsx`, `src/coach/*.ts`
  - **Change**: Audit: (1) `console.log` does not receive `apiKey`; (2) React test snapshots omit/mask `apiKey` (use `data-testid` and check value attr is empty in snapshot OR mask with `***`); (3) Sentry / future telemetry: add a comment-level note that any future telemetry MUST scrub `tabiya.ai.apiKey`; (4) `dangerouslyAllowBrowser: true` is documented in code with a comment explaining the threat model (single-user local app, key already in browser localStorage, no multi-tenant risk); (5) Document upgrade path to OS keychain (Tauri/Electron) for a future spec; (6) `[Clear key]` action wipes both localStorage AND any in-memory cached client instance; (7) HTTPS-only: `available()` warn if user pastes key into an `http://` page (dev only).
  - **Outcome**: Written checklist appended to `AISection.tsx` as a JSDoc block on the component; security-reviewer agent signs off in PR description.
  - **Context**: R5.6 (no props), R6.6 (no logging). Article 11. Pattern: 1Password, Bitwarden browser extensions document identical "key in browser storage" threat model — single-user local apps treat localStorage as the trust boundary, with explicit upgrade path to OS keychain documented. Stripe `dangerouslyAllowBrowser` docs explicitly call out this exact tradeoff.

### Phase 7: CoachContext Assembly (4a Minimal — No RAG)

- [ ] **Task 7.1**: Define `CoachContext` types with forward-compatible optional fields
  - **ID**: `task-7.1`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `architect`
  - **File**: `src/coach/CoachContext.ts`
  - **Change**: Export `CoachContext` type with required `engine: EngineAnalysis`, `history: PlyHistoryEntry[]`, `enginePresetName: EnginePresetName`, optional `lineId?`, `plyIndex?`, and forward-compat optionals `features?`, `classification?`, `motifs?`, `semanticTags?`, `plan?`, `kgNode?` (typed as `unknown` placeholders for 4a — typed properly in 4b–4d). `PlyHistoryEntry` = `{san, plyIndex, color, userAction?, wrongAttempts?}`.
  - **Outcome**: Type compiles; future 4b–4d additions are additive (no breaking changes for 4a consumers).
  - **Context**: R4.1, R4.4 (forward-compatible). Article 5. Design §2.

- [ ] **Task 7.2**: Implement `CoachContextBuilder.build(input)` — engine + history only, history capped at 6
  - **ID**: `task-7.2`
  - **BlockedBy**: `task-7.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/CoachContextBuilder.ts`
  - **Change**: Pure function `build({engine, drillState, enginePresetName, lineId?, plyIndex?}): CoachContext`. Pull last ≤6 plies from `drillState`, truncate oldest first. NO retrieval, NO opening KG, NO features. Optional fields stay undefined.
  - **Outcome**: Builder is pure, fully unit-testable; history cap enforced; deterministic.
  - **Context**: R4.2, R4.3. Design §2. Rationale block: 4a does NOT use Phase 1b ExplainBlock or Phase 2 key_squares retrieval — that's 4d.

- [ ] **Task 7.3**: Write 4a prompt template `prompts/coach/v1.txt` with 3 few-shot examples + honest-baseline hedge
  - **ID**: `task-7.3`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `prompts/coach/v1.txt`, `prompts/coach/CHANGELOG.md`
  - **Change**: Plain-text template with `{{engine_block}}`, `{{recent_plies_block}}`, `{{engine_preset_name}}` slots. 3 few-shot examples grounded in real positions: Italian Game ply 4, Sicilian Najdorf ply 6, French Advance ply 5 (each shows engine output → 1–4 sentence explanation). System prompt block includes honest constraint: *"You see Stockfish PVs and the user's recent moves. You do NOT see deep positional features. Keep explanations to 1–4 sentences. If the engine output is ambiguous, say so rather than invent."* Bundle as string constant via Vite `?raw` import. `CHANGELOG.md` starts at `v1 — 4a baseline (date)`.
  - **Outcome**: Template loads at build time, NO runtime fetch; v1 is reproducible.
  - **Context**: R8.1–R8.5. Article 4 — eval traceability requires version-pinned prompts. Pattern: Anthropic Cookbook and `dust.tt` both ship prompts as version-controlled text files imported as raw strings.

- [ ] **Task 7.4**: Implement `CoachPipeline.run(input)` — orchestrator engine → context → LLM, returns `{engine, llm?}`
  - **ID**: `task-7.4`
  - **BlockedBy**: `task-3.3`, `task-5.6`, `task-7.2`, `task-7.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/coach/CoachPipeline.ts`
  - **Change**: Class with `run({fen, drillState, lineId?, plyIndex?, abortSignal?}): Promise<{engine: EngineAnalysis, llm?: LLMResponse, promptVersion: 'v1'}>`. Step 1: load engine via `loadStockfishEngine()`, call `analyze(fen, preset)`. Step 2: `CoachContextBuilder.build(...)`. Step 3: if `getLLMClient()` returns non-null AND `await client.available()` is true, render prompt by interpolating template, call `client.complete(...)`; on any LLM error, log to dev console and return `{engine, llm: undefined}`. NO throw on LLM failure. Log `promptVersion: 'v1'` to console for eval traceability.
  - **Outcome**: Single entry point; engine-only degraded mode is the natural failure mode; surfaces never need try/catch around the pipeline.
  - **Context**: R5.5, R7.6, R8.5, R9.3. Article 11 — degraded path is the default failure path. Design §7.

### Phase 8: Surface A — In-Drill "Why?" Button + Modal

- [ ] **Task 8.1**: Build `WhyButton` component + keyboard shortcut `?`
  - **ID**: `task-8.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/components/coach/WhyButton.tsx`
  - **Change**: Button rendered on `DrillPage` when `state.kind !== 'idle'`. On click, opens `CoachModal` for current `(lineId, plyIndex, fen)`. Registers global `keydown` listener for `?` (Shift+/) that opens the modal; cleanup on unmount; ignore the shortcut when an input/textarea is focused.
  - **Outcome**: Button visible during drill; keyboard-accessible; ARIA `aria-label="Why is this the best move?"`.
  - **Context**: R7.1, R7.7. Design §5.

- [ ] **Task 8.2**: Build `CoachModal` component — engine card + LLM card + degraded footer
  - **ID**: `task-8.2`
  - **BlockedBy**: `task-7.4`, `task-8.1`
  - **Agent**: `general-purpose`
  - **File**: `src/components/coach/CoachModal.tsx`
  - **Change**: Modal with three sections in order: (1) Header — line name, ply index, engine name + preset name + depth (e.g., "Stockfish — Balanced — depth 20"); (2) Engine card — best move SAN, eval (cp or `#N` mate), top-N PV lines (SAN sequences each rendered as a clickable list); (3) LLM Narration card — 1–4 sentence prose, model name badge; OR Degraded footer "Configure AI in Settings to enable narration." when `llm` undefined. Always render Engine card. Close via ESC, click-outside, X button. Modal does NOT block drill state — closing returns user to the same ply.
  - **Outcome**: Modal renders correctly for both LLM-configured and degraded paths; ESC/click-outside dismiss; drill state preserved.
  - **Context**: R7.2–R7.6, R7.8. Design §5 ASCII mockup. Article 11 — engine card always present.

- [ ] **Task 8.3**: Implement `useCoach` hook — invokes pipeline + in-memory cache
  - **ID**: `task-8.3`
  - **BlockedBy**: `task-7.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useCoach.ts`
  - **Change**: Hook `useCoach({lineId, plyIndex, fen, drillState})` returns `{result, loading, error, invoke()}`. Module-level `Map<string, Promise<PipelineResult>>` keyed by `${lineId}::${plyIndex}::${enginePreset}::${modelName}`. `invoke()` checks cache; if hit, returns cached promise; if miss, calls `pipeline.run(...)`, stores promise (deduplicates concurrent invocations). Listens for `tabiya:engine-preset-changed` event and clears cache. Also clears on provider/model/apiKey localStorage change (storage event).
  - **Outcome**: Re-clicking same `(lineId, plyIndex)` does NOT re-invoke engine or LLM (verified by mock call counts in tests).
  - **Context**: R3.6, R7.5, R9.5. Design §6 cache strategy. Pattern: SWR / React Query in-memory cache keyed by tuple — single-flight pattern is the proven anti-thundering-herd shape.

### Phase 9: Engine-Only Degraded Mode (Article 11)

- [ ] **Task 9.1**: Verify engine-only degraded rendering in `CoachModal` when LLM unconfigured
  - **ID**: `task-9.1`
  - **BlockedBy**: `task-8.2`
  - **Agent**: `general-purpose`
  - **File**: `src/components/coach/CoachModal.tsx`
  - **Change**: Confirm: (1) when `result.llm` is undefined, modal shows Engine card + Degraded footer with copy "Configure AI in Settings to enable narration."; (2) NO console errors thrown; (3) modal is identical in size/layout to LLM-configured path (no layout shift). Add `data-testid="coach-modal-degraded"` on the degraded footer for testability.
  - **Outcome**: Engine-only is a first-class rendering mode, not an error state; users without API keys still see engine truth.
  - **Context**: R7.6, R9.3. Article 11 — local-first; Article 12 — backend (or in this case, LLM) optional.

- [ ] **Task 9.2**: Verify engine load failure renders graceful "engine unavailable" state
  - **ID**: `task-9.2`
  - **BlockedBy**: `task-3.3`, `task-8.2`
  - **Agent**: `general-purpose`
  - **File**: `src/components/coach/CoachModal.tsx`, `src/coach/CoachPipeline.ts`
  - **Change**: If `loadStockfishEngine()` rejects (wasm load fails, e.g., on a strict CSP site), pipeline returns `{engine: null, llm: undefined, error: 'engine-unavailable'}`. Modal renders "Engine unavailable — try reloading. Drill remains usable." Drill page does NOT crash; Why button remains clickable.
  - **Outcome**: Hard wasm load failure does not break the trainer; only the Coach surface degrades.
  - **Context**: R1.4, R1.5. Article 11.

### Phase 10: Cache Verification

- [ ] **Task 10.1**: Verify cache invalidates on Settings change for preset / provider / model
  - **ID**: `task-10.1`
  - **BlockedBy**: `task-8.3`, `task-4.2`, `task-6.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useCoach.ts`
  - **Change**: Confirm event listeners: `window.addEventListener('tabiya:engine-preset-changed', clearCache)`, `window.addEventListener('storage', ...)` filtering `tabiya.ai.provider | tabiya.ai.model | tabiya.ai.apiKey`. Also dispatch a `tabiya:ai-settings-changed` event from `AISection.tsx` on save. Cache key tuple includes both `enginePreset` AND `modelName` so a stale entry can never be served.
  - **Outcome**: User changes preset mid-session → next Why click re-invokes engine + LLM; verified in test.
  - **Context**: R3.6 (cache invalidate on preset). Design §6.

### Phase 11: Tests + Lint Check + Bundle Budget

- [ ] **Task 11.1**: Engine integration tests — 5 known FENs return valid PVs
  - **ID**: `task-11.1`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/engine/StockfishWasmEngine.test.ts`
  - **Change**: 5 integration tests against real wasm: (1) starting position, (2) Italian after `1.e4 e5 2.Nf3 Nc6 3.Bc4`, (3) Sicilian after `1.e4 c5 2.Nf3 d6`, (4) French Tarrasch, (5) Caro-Kann Advance. For each, assert `analyze(fen, Balanced).pvs.length >= 3`, every PV `moves[0]` is valid SAN, `bestmove` is SAN, `engineDepth >= 18`, `scoreCp` is finite number. Use `vitest` with a longer timeout (10s) since real engine analysis takes seconds.
  - **Outcome**: Real engine integration verified end-to-end including UCI→SAN.
  - **Context**: R9.1. Design §8.

- [ ] **Task 11.2**: `ChessEngine` interface contract test suite (reusable)
  - **ID**: `task-11.2`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/engine/ChessEngine.contract.test.ts`
  - **Change**: Export function `runChessEngineContract(factory: () => ChessEngine)` that asserts: `name` is one of the union literals, `ready` resolves, `analyze` returns shape-conformant `EngineAnalysis`, `stop()` is callable. Invoke from `StockfishWasmEngine.test.ts`. Future `LeelaEngine` can call same contract.
  - **Outcome**: Reusable contract test; new engines drop in with single-line addition.
  - **Context**: R9.2. Article 5 — interface contract. Pattern: Spring `@TestContract` / Java `Tck` pattern; structurally identical.

- [ ] **Task 11.3**: Each `LLMClient` impl has a happy-path test with provider mocked
  - **ID**: `task-11.3`
  - **BlockedBy**: `task-5.2`, `task-5.3`, `task-5.4`, `task-5.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/coach/AnthropicLLMClient.test.ts`, `tests/coach/OpenAILLMClient.test.ts`, `tests/coach/OllamaLLMClient.test.ts`, `tests/coach/LlamaCppWebGPULLMClient.test.ts`
  - **Change**: (1) Anthropic: mock `@anthropic-ai/sdk` `messages.create`, assert system prompt has `cache_control.type === 'ephemeral'`, response parsing handles text blocks; (2) OpenAI: mock `openai` SDK, assert request shape; (3) Ollama: use `msw` (Mock Service Worker) intercepting `POST /api/chat` and `GET /api/tags`, test `available()` true/false and `complete` happy path; (4) WebGPU: stub `navigator.gpu`, assert `available()` returns based on flag + presence.
  - **Outcome**: All 4 providers covered; mocks are realistic enough to catch shape regressions.
  - **Context**: R9.4. Design §8 test plan.

- [ ] **Task 11.4**: Surface A engine-only degraded-mode test
  - **ID**: `task-11.4`
  - **BlockedBy**: `task-9.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/coach/CoachModal.test.tsx`
  - **Change**: Render `CoachModal` with mocked pipeline returning `{engine: validAnalysis, llm: undefined}`. Assert: (1) Engine card present (best move SAN, PVs); (2) `data-testid="coach-modal-degraded"` footer present with expected copy; (3) NO narration card; (4) NO console errors emitted (`vi.spyOn(console, 'error')` count is 0).
  - **Outcome**: Article 11 degraded path is a first-class tested mode.
  - **Context**: R9.3. Article 11.

- [ ] **Task 11.5**: Cache test — re-click same position SHALL NOT re-invoke engine or LLM
  - **ID**: `task-11.5`
  - **BlockedBy**: `task-8.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/hooks/useCoach.test.tsx`
  - **Change**: Mock pipeline as a `vi.fn()`. Render component using `useCoach`; call `invoke()` twice for same `(lineId, plyIndex, preset, model)`; assert pipeline mock called exactly once. Then change preset (dispatch `tabiya:engine-preset-changed`); call `invoke()` again; assert mock called twice total. Then change model in localStorage and dispatch storage event; assert third call.
  - **Outcome**: Cache deduplication AND invalidation both verified.
  - **Context**: R9.5. Design §6.

- [ ] **Task 11.6**: ESLint `no-LangChain` lint check passes; add a fixture test
  - **ID**: `task-11.6`
  - **BlockedBy**: `task-1.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lint/no-langchain.test.ts`
  - **Change**: Test that runs ESLint programmatically on a fixture file containing `import "langchain"`; asserts the violation is reported. Also asserts a clean fixture passes. Locks down the rule against accidental removal.
  - **Outcome**: Lint gate is itself tested; future contributor cannot disable the rule without breaking this test.
  - **Context**: R9.6. Article 3.

- [ ] **Task 11.7**: API key never appears in test snapshots — Settings component snapshot test
  - **ID**: `task-11.7`
  - **BlockedBy**: `task-6.2`
  - **Agent**: `security-reviewer`
  - **File**: `tests/components/AISection.security.test.tsx`
  - **Change**: Render `AISection` with `localStorage.tabiya.ai.apiKey = 'sk-ant-secret123'`; serialize the rendered DOM; assert the string `'sk-ant-secret123'` does NOT appear in the snapshot (password input value should be masked/redacted). Also spy on `console.log/warn/error` during a `[Test connection]` flow and assert the key string never appears in any log call argument.
  - **Outcome**: Security regression caught at test time, not after a leak.
  - **Context**: R6.6. Article 11.

- [ ] **Task 11.8**: Bundle size budget verification — base trainer chunk delta ≤30 kB gzip
  - **ID**: `task-11.8`
  - **BlockedBy**: `task-3.3`, `task-8.2`, `task-6.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/build/bundle-budget.test.ts`, `scripts/check-bundle-budget.mjs`
  - **Change**: CI script runs `vite build`, parses build output, asserts (1) primary entry chunk gzip size delta from `main` branch baseline ≤30 kB; (2) stockfish wasm chunk is a separate lazy chunk (not in main entry); (3) Anthropic + OpenAI SDK code is in dynamic-import-only chunks. Use `rollup-plugin-visualizer` JSON output or `vite-bundle-analyzer` programmatic API. Threshold tunable in script header.
  - **Outcome**: CI fails any PR that bloats the base bundle past the budget. Article 11 enforced at gate.
  - **Context**: R9.7. Article 11. Pattern: Next.js `next-bundle-analyzer` + GitHub Actions size-limit bot.

- [ ] **Task 11.9**: TypeScript strict — no `any` without inline justification
  - **ID**: `task-11.9`
  - **BlockedBy**: `task-11.8`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lint/no-any.test.ts`
  - **Change**: Test that greps all new 4a files (`src/engine/**`, `src/coach/**`, `src/components/coach/**`, `src/components/settings/{AISection,EngineSection}.tsx`, `src/hooks/useCoach.ts`) for `: any` or `as any` and asserts each occurrence has an adjacent comment matching `// any-ok:` justifying the use. Fails CI on bare `any`.
  - **Outcome**: Type discipline mechanically enforced.
  - **Context**: R9.8. Article 14.

- [ ] **Task 11.10**: Honest-acceptance walkthrough — 10-position Markdown checklist
  - **ID**: `task-11.10`
  - **BlockedBy**: `task-8.2`, `task-7.3`
  - **Agent**: `general-purpose`
  - **File**: `evals/coach/4a-walkthrough.md`
  - **Change**: Markdown checklist of 10 positions across Italian / Sicilian Najdorf / French openings. For each: FEN, expected engine top move, observed LLM explanation pasted in, subjective quality rating (1–5), notes. Header documents expected outcome: "roughly half of explanations will feel shallow or generic — this is the 4a baseline; 4b–4e replaces this prose."
  - **Outcome**: Honest baseline documented as a markdown artifact; becomes the regression reference for 4b–4e gains.
  - **Context**: R9.9. Article 4 — eval traceability baseline.

---

## Dependency Diagram

```
                          task-1.1 ──┐
                          task-1.2 ──┤
                          task-1.3 ──┼─── (Phase 1: Setup, all parallel)
                          task-1.4 ──┤
                          task-1.5 ──┘
                                │
                                ▼
                          task-2.1 (ChessEngine interface)
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
            task-3.1       task-4.1         task-7.1
                │               │               │
                ▼               ▼               ▼
            task-3.2       task-4.2         task-7.2
                │
                ▼
            task-3.3                       task-7.3 (no deps)
                │
                └────────┐
                         │
                         ▼
                     task-7.4 ◄── task-5.6 ◄── { task-5.2, 5.3, 5.4, 5.5 } ◄── task-5.1 ◄── task-1.2
                         │                                                          │
                         │                                              task-5.5 also ◄── task-1.3
                         │
              ┌──────────┼───────────────────┐
              ▼          ▼                   ▼
          task-8.1   task-8.2            task-8.3
                         │
                         ▼
                     task-9.1
                         │
                         ▼
                     task-9.2

          task-6.1 ◄── task-5.6
              │
              ▼
          task-6.2 (security review)

          task-10.1 ◄── { task-8.3, task-4.2, task-6.1 }

   Tests (Phase 11):
     task-11.1 ◄── task-3.2
     task-11.2 ◄── task-2.1
     task-11.3 ◄── { task-5.2, 5.3, 5.4, 5.5 }
     task-11.4 ◄── task-9.1
     task-11.5 ◄── task-8.3
     task-11.6 ◄── task-1.4
     task-11.7 ◄── task-6.2
     task-11.8 ◄── { task-3.3, task-8.2, task-6.1 }
     task-11.9 ◄── task-11.8
     task-11.10 ◄── { task-8.2, task-7.3 }
```

### Parallel opportunities

- **Setup fan-out**: `task-1.1` through `task-1.5` are fully independent — all 5 in one shot.
- **Post-interface fan-out**: once `task-2.1` (ChessEngine interface) lands, three branches run in parallel:
  - Engine branch: `task-3.1 → 3.2 → 3.3`
  - Presets branch: `task-4.1 → 4.2`
  - Context branch: `task-7.1 → 7.2`
- **LLMClient fan-out**: once `task-5.1` lands, all four concrete clients (`task-5.2`, `5.3`, `5.4`, `5.5`) build in parallel.
- **Prompt template independent**: `task-7.3` has no dependencies at all — can ship Day 1 alongside Phase 1 setup.
- **Surface A fan-out**: once `task-7.4` (pipeline) lands, `task-8.1`, `task-8.2`, `task-8.3` are independent.
- **Test fan-out**: all of `task-11.1` through `task-11.10` parallelize once their respective implementation deps are met.

### Critical path

`task-1.2 (install SDKs) → task-2.1 (ChessEngine interface) → task-5.1 (LLMClient interface) → task-5.2 (Anthropic impl) → task-5.6 (DI container) → task-7.4 (pipeline) → task-8.2 (CoachModal) → task-11.4 (degraded mode test) → task-11.8 (bundle budget)`

This is the shortest sequence that proves the full 4a end-to-end: SDK → interfaces → real client → DI → pipeline → UI → tested degraded mode → bundle budget passes. Everything else parallelizes around this spine.

---

## Completion Criteria (Phase 4a Definition of Done)

1. **Engine works end-to-end.** `StockfishWasmEngine` integration tests (`task-11.1`) green on 5 known FENs; all PVs return valid SAN; UCI confined to worker (Article 9 verified by grep on `src/engine/StockfishWasmEngine.ts` finding zero UCI strings outside the worker file).
2. **All 4 LLMClient impls compile and pass happy-path mock tests** (`task-11.3`). At least one (Anthropic) verified against the real API in manual smoke.
3. **Settings UI fully wired.** User can pick Cloud or Local (Ollama), paste an API key, run Test Connection successfully, and the configuration drives the next Why click.
4. **Surface A modal renders correctly in both modes:**
   - LLM-configured: engine card + narration card.
   - Engine-only degraded: engine card + footer "Configure AI in Settings to enable narration." No console errors. (`task-11.4` passes.)
5. **Cache works.** Re-clicking the same `(lineId, plyIndex, preset, model)` does not re-invoke engine or LLM (`task-11.5` passes). Settings change invalidates cache (`task-10.1` confirmed manually + tested).
6. **No-LangChain lint gate active and tested** (`task-11.6` passes; `eslint .` clean).
7. **Bundle budget enforced.** Base trainer entry chunk gzip delta ≤ 30 kB; stockfish wasm is a separate lazy chunk; LLM SDKs in dynamic-import chunks (`task-11.8` passes).
8. **TypeScript strict, no bare `any`** (`task-11.9` passes; `npx tsc --noEmit` clean for new files).
9. **Security review of API key handling complete** (`task-6.2`); snapshot test confirms no key leakage (`task-11.7` passes).
10. **Honest-acceptance walkthrough committed** at `evals/coach/4a-walkthrough.md` with 10 real positions and observed LLM explanations (`task-11.10`). Expected: roughly half feel shallow. This is the 4a baseline by design.
11. **Constitution compliance:**
    - Article 1 — stockfish.wasm (GPLv3), `@anthropic-ai/sdk` (MIT), `openai` (MIT) declared in `tech.md`.
    - Article 3 — no LangChain/CrewAI/LlamaIndex imports (lint + lint-test gate).
    - Article 5 — `ChessEngine`, `LLMClient`, `CoachContext` all interfaces; concrete impls hidden behind DI (`getLLMClient`, `loadStockfishEngine`).
    - Article 9 — SAN at every boundary; UCI only inside the worker.
    - Article 11 — engine-only degraded mode works without any LLM; base bundle stays light.
    - Article 12 — runs fully in-browser with Local (Ollama) or even no LLM (engine-only).
    - Article 13 — 4a timebox 1–2 weekends respected; if it overruns by 50% the spec re-cuts rather than extending.
    - Article 14 — TS strict; no bare `any`.
12. **Smoke walkthrough on a real drill:** Start a drill on any line, click Why (or press `?`) mid-line, modal opens, engine card shows valid PVs, narration card (if configured) shows 1–4 sentence prose. ESC closes; drill state preserved. Toggle preset Balanced → Deep in Settings; click Why again; pipeline re-invokes; modal shows depth 30 result.

---

## Notes

- **Future sub-phases 4b–4e tracked in spec `design.md`; this `tasks.md` scopes 4a only.** Spawn a separate `tasks.md` (or split files: `tasks-4b.md`, `tasks-4c.md`, etc.) when starting 4b. Do not mix forward-looking work into 4a tasks — the moat narrative depends on shipping 4a as a deliberately shallow baseline.
- **Open Questions deferred:** Q1 (recent-plies inline disclosure) → ship as a "Details" toggle in Surface A after manual smoke; Q2 (WebGPU 4a vs 4a.1) → ship the client skeleton in 4a behind the flag, full model loading deferred; Q3 (Pyodide vs FastAPI for 4b) → not a 4a decision; Q4 (Haiku cost) → verify in manual smoke during `task-11.10`; Q5 (in-memory vs IDB cache) → in-memory only for 4a, IDB lands in 4e.
