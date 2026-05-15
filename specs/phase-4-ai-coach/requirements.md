# Phase 4 — AI Coach Requirements

## Introduction

The author is a weak chess player but a strong explainer when handed an authority's analysis. Phase 4 makes that the architectural pillar: **a deterministic symbolic chess understanding layer sits between the engine and the LLM. The LLM is natural-language synthesis only; it never invents chess truth.**

Real chess understanding flows from a stack of symbolic components — Stockfish engine + python-chess rule-based feature extractor + position classification + motif detection + plan extractor + opening Knowledge Graph. The LLM receives a fully-grounded, machine-verifiable context bundle and is constrained to narrate it. This inverts the usual "thin LLM wrapper" pattern: chess intelligence lives in code; prose is a render target.

This stack is the project's moat. It is also the project's largest spec. Execution is staged across sub-phases **4a … 4e**, all documented in this single Phase 4 spec. Only 4a is an **active build** target right now; 4b … 4e are documented as roadmap so the architectural narrative is visible end-to-end (interview storytelling) without committing weekend hours we don't yet have.

### Constitution anchors

- **Article 3** — No LangChain / CrewAI / AutoGen. Every LLM call is a direct SDK call. Symbolic layer is hand-written rule-based code, not a "framework".
- **Article 4** — Real model work. The symbolic layer + grounded prompting + eval harness (4e) is RAG-with-symbolic-grounding, which is the substantive AI deliverable. 4a alone is the *honest baseline* the moat layers replace.
- **Article 5** — Every layer is an interface (`ChessEngine`, `FeatureExtractor`, `PositionClassifier`, `MotifDetector`, `SemanticTagger`, `PlanExtractor`, `OpeningKG`, `LLMClient`, `CoachContextRepository`). Swaps are single-DI changes.
- **Article 9** — All moves exchanged at layer boundaries are SAN. UCI exists only inside `StockfishWasmEngine` and is converted at the boundary.
- **Article 11** — Each layer degrades gracefully: engine-only, engine+features, engine+features+classifier, etc. Coach surfaces must remain useful at every degraded level.
- **Article 12** — Backend remains optional. 4a runs fully in-browser if user picks a local LLM path. Cloud LLM is opt-in.
- **Article 13** — Weekend pace. **4a is 1–2 weekends.** 4b–4e are forecast 4–5 month arc total, documented but not scheduled until main plan permits.

---

## Scope ladder

The single binding scope decision: **build 4a now, document 4b–4e as future enhancement layers within this same spec**.

| Sub-phase | Title | Status | Brief |
|---|---|---|---|
| **4a** | **Naive Engine + LLM MVP** | **ACTIVE BUILD** | Stockfish.wasm + top-N PVs → Claude/Ollama/etc. prompt → 1–4 sentence explanation. In-drill **Why?** button only. All 3 surfaces deferred to 4e except Surface A. Honest about its shallow output. |
| 4b | Deterministic Feature Extraction Layer | DOCUMENTED, FUTURE | python-chess rule-based feature extractor: ~30 features per position. Development, center control, king safety, space, tempo, pawn structure, open files, diagonals, weak squares, outposts, piece activity, bishop pair, knight outposts, pinned / overloaded / discovered / X-ray, trapped pieces. Unit-tested with golden positions. |
| 4c | Position Classification + Motif Detection | DOCUMENTED, FUTURE | Classifiers: open/closed/semi-open, tactical-vs-positional sharpness, IQP / Carlsbad / Hedgehog / Maroczy / hanging / isolated pawns, opposite-side castling. Tactical motifs: pin, fork, skewer, discovered, X-ray, overload, deflection, removal-of-defender. Positional motifs: minority attack, central break, outpost installation, prophylaxis. Heuristic-first; ML deferred. |
| 4d | Semantic Layer + Plan Extraction + Opening KG | DOCUMENTED, FUTURE | Move-purpose taxonomy, concept hierarchy, plan extraction via deep-PV walk, opening Knowledge Graph (ECO + family + named plans + transposition), counterplay identification. |
| 4e | Production Coach + Explain UI | DOCUMENTED, FUTURE | Grounded prompt architecture (LLM cites only provided tags; hallucination-blocked). Beginner / Intermediate / Advanced skill modes. "Why not this move?" comparison. Visual highlights (arrows + squares + plan icons). All 3 surfaces (drill Why, OOB Ask Coach, free-form chat). Brevity controls. Explanation ranking. Eval thresholds. |

The active section below specifies 4a as a real shippable spec with EARS-style acceptance criteria. The trailing sections specify 4b–4e at architecture-sketch fidelity (algorithms, interfaces, JSON shapes) — sufficient that any future weekend can pick one up without rediscovery.

---

## Layered architecture

```
                 PGN / FEN / live drill ply
                            │
                            ▼
                  Position Extractor                   (existing — chess.js / python-chess)
                            │
                            ▼
                    Stockfish  (4a) ─────── ACTIVE BUILD
                            │
                            ▼
                Feature Extractor  (4b)
                            │
                            ▼
       Position Classifier + Motif Detector  (4c)
                            │
                            ▼
       Semantic Layer + Plans + Opening KG   (4d)
                            │
                            ▼
            Grounded Prompt Builder  (4e)
                            │
                            ▼
       LLMClient (Anthropic / OpenAI / Ollama / llama.cpp WebGPU)
                            │
                            ▼
                UI Explain Surfaces  (A=4a, B+C=4e)
```

Each downward arrow is a typed interface. Each layer may be *bypassed* — a degraded mode renders whatever has been computed so far. This is the Article 11 invariant.

---

# Phase 4a — Naive Engine + LLM MVP (ACTIVE BUILD)

**Interview hook.** "The MVP is intentionally shallow — Stockfish PVs piped into Claude with no symbolic grounding. The point is to show *what the moat replaces*. Everything that comes after is the moat."

**Honest acceptance.** Explanations from 4a will sometimes be shallow or contain generic chess language. This is an intentional baseline that 4b–4d deterministic layers replace. The 4a surface is wired with this in mind: it always shows raw engine PVs alongside the LLM prose, so the user sees the engine truth even when prose is weak.

## R1 — Stockfish WASM engine integration

**User Story:** As a player, when the coach needs a chess truth source, I want a strong engine running locally in my browser so analysis is instant, free, and offline-capable.

### Acceptance criteria

1. THE SYSTEM SHALL bundle Stockfish as a WASM build (`stockfish.wasm` / `stockfish.js`) loaded inside a dedicated Web Worker.
2. THE SYSTEM SHALL expose engine I/O exclusively via a worker `MessageChannel` — main thread SHALL NOT call engine APIs synchronously.
3. WHEN the worker bundle exceeds 2MB gzip THE SYSTEM SHALL ship the engine as a separate lazy-loaded chunk activated only on first Coach invocation (Article 11 — base trainer load must not pay for AI bundle).
4. THE SYSTEM SHALL surface engine readiness as a state (`idle | loading | ready | error`) consumable by Coach surfaces.
5. WHEN engine load fails THE SYSTEM SHALL render Coach surfaces in a degraded "engine unavailable" state — drill itself SHALL remain fully functional (Article 11, Article 12).
6. THE SYSTEM SHALL accept UCI commands (`position fen ...`, `go depth N multipv K`, `stop`) and emit parsed `info` lines + `bestmove` as typed events.

---

## R2 — `ChessEngine` interface (Article 5)

**User Story:** As a developer, I want engine choice to be a single-DI swap so Leela or future engines drop in without touching coach logic. I also want the interface to anticipate 4b's feature extractor injection so we don't refactor it later.

### Acceptance criteria

1. THE SYSTEM SHALL define a `ChessEngine` interface:
   ```ts
   interface ChessEngine {
     analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis>;
     stop(): void;
     ready: Promise<void>;
     readonly name: 'stockfish' | 'leela';
   }
   type EngineOpts = { depth?: number; multipv?: number; movetimeMs?: number };
   type EngineAnalysis = {
     fen: string;
     bestmove: string;                  // SAN, per Article 9
     pvs: Array<{
       moves: string[];                 // SAN sequence
       scoreCp: number;
       mateIn?: number;
       depth: number;
     }>;
     engineName: string;
     engineDepth: number;
   };
   ```
2. THE SYSTEM SHALL convert UCI moves emitted by the engine to SAN before exposing them on `EngineAnalysis` (Article 9).
3. THE SYSTEM SHALL ship one concrete implementation in 4a: `StockfishWasmEngine`. Leela is interface-compatible but not bundled.
4. Coach surfaces SHALL depend only on the `ChessEngine` interface, never on the concrete class.
5. WHEN Settings → Engine is changed THE SYSTEM SHALL re-wire the DI container at the next coach invocation — no page reload required. In-flight analyses SHALL be cancelled.
6. THE `EngineAnalysis` shape SHALL be a strict superset of what 4b's `FeatureExtractor` consumes — adding fields later SHALL NOT break the 4a contract.

---

## R3 — Engine preset modes in Settings

**User Story:** As a player, I want Fast / Balanced / Deep presets, not a raw depth knob.

### Acceptance criteria

1. THE SETTINGS PAGE SHALL include an "Engine" section with a single preset selector: `Fast | Balanced | Deep`. Default = `Balanced`.
2. Preset → `EngineOpts` mapping SHALL be:
   - Fast: `{ depth: 12, multipv: 3, movetimeMs: 500 }`
   - Balanced: `{ depth: 20, multipv: 3, movetimeMs: 2000 }`
   - Deep: `{ depth: 30, multipv: 5, movetimeMs: 5000 }`
3. THE SETTINGS PAGE SHALL NOT expose raw depth / multipv / threads / hash size in 4a.
4. Preset choice SHALL persist in `localStorage` under `tabiya.engine.preset` (Article 11).
5. THE current preset name SHALL be displayed inline on the Surface A modal ("Stockfish — Balanced — depth 20").
6. WHEN the preset changes mid-session THE SYSTEM SHALL invalidate cached coach answers keyed by `(lineId, plyIndex)`.

---

## R4 — Minimal `CoachContext` for 4a

**User Story:** As the LLM in 4a, I receive only engine output + recent ply history. I do **not** receive curated RAG content in 4a — that would imply grounded retrieval that does not yet meaningfully match positions. Curated retrieval lands in 4b/4d when symbolic features make it useful.

### Acceptance criteria

1. THE SYSTEM SHALL define a `CoachContext` shape:
   ```ts
   type CoachContext = {
     engine: EngineAnalysis;
     history: PlyHistoryEntry[];   // last ≤6 plies, drill state
     lineId?: string;              // for cache keying only — not injected into prompt
     plyIndex?: number;
     enginePresetName: 'Fast' | 'Balanced' | 'Deep';
   };
   type PlyHistoryEntry = {
     san: string;
     plyIndex: number;
     color: 'w' | 'b';
     userAction?: 'correct' | 'wrong' | 'hint';
     wrongAttempts?: string[];
   };
   ```
2. THE SYSTEM SHALL define a `CoachContextBuilder.build(input): CoachContext` function. No retrieval, no opening KG, no features in 4a.
3. THE builder SHALL cap `history` at 6 entries, truncating oldest first.
4. THE builder SHALL be **forward-compatible**: a `CoachContext` produced in 4b+ MAY add fields (`features`, `classification`, `motifs`, `semanticTags`, `plan`, `kgFacts`). 4a consumers ignore unknown fields.

> Rationale (open question resolved): 4a does NOT use Phase 1b `ExplainBlock` retrieval or Phase 2 `key_squares` retrieval. They re-enter the pipeline in 4d as KG-grounded retrieval where transposition-keyed lookup makes sense. Doing fuzzy retrieval in 4a would dilute the moat narrative ("see — the symbolic layer is what actually helps").

---

## R5 — `LLMClient` interface + four concrete implementations (Article 5, Article 3)

**User Story:** As a developer, I want LLM provider to be swappable so local-default + cloud-override coexist. I want four providers in 4a so the demo runs anywhere.

### Acceptance criteria

1. THE SYSTEM SHALL define an `LLMClient` interface:
   ```ts
   interface LLMClient {
     complete(prompt: PromptPayload): Promise<LLMResponse>;
     stream?(prompt: PromptPayload): AsyncIterable<LLMChunk>;
     readonly providerName:
       | 'cloud-anthropic'
       | 'cloud-openai'
       | 'local-ollama'
       | 'local-llamacpp-webgpu';
     readonly modelName: string;
     readonly available: () => Promise<boolean>;
   }
   type PromptPayload = {
     systemPrompt: string;
     userPrompt: string;
     stops?: string[];
     maxTokens?: number;
     temperature?: number;
   };
   ```
2. THE SYSTEM SHALL ship FOUR concrete implementations in 4a:
   - `AnthropicLLMClient` — direct `@anthropic-ai/sdk` call (Article 3 — NO LangChain). Default model `claude-haiku-4-5-20251001`. Prompt caching applied to system + few-shot block.
   - `OpenAILLMClient` — direct `openai` SDK call. Default model `gpt-4o-mini`.
   - `OllamaLLMClient` — HTTP fetch against `http://localhost:11434`. Default model `llama3.2:3b-instruct`.
   - `LlamaCppWebGPULLMClient` — in-browser inference via llama.cpp WebGPU build (probed; `available()` returns false on unsupported devices).
3. THE Anthropic implementation SHALL use prompt caching on `systemPrompt` and any few-shot block to honor cost discipline.
4. PROVIDER chosen in Settings; runtime DI returns the configured `LLMClient`.
5. WHEN no LLM is configured AND user invokes a Coach surface THE SYSTEM SHALL render the engine-only degraded card (R7.6) and a one-line "Configure AI in Settings to enable narration." hint. NO errors thrown (Article 11).
6. THE LLMClient SHALL NEVER receive raw API keys via component props — keys read from `localStorage` with a visible Settings warning. Upgrade path to OS keychain via Tauri/Electron is a future spec.
7. NO LangChain, NO LlamaIndex, NO CrewAI imports anywhere in coach code. Lint rule SHALL fail the build if any are introduced (Article 3).

---

## R6 — Settings UI: inference location + API key + model picker

**User Story:** As a player, I want a single Settings section that picks local vs cloud, chooses a model, and pastes my own API key.

### Acceptance criteria

1. THE SETTINGS PAGE SHALL include an "AI" section with:
   - `Inference Location` — radio: `Cloud | Local (Ollama) | Local (Browser WebGPU)`. Default = `Cloud` if user has previously entered a key; otherwise `Local (Ollama)`.
   - `Provider` (cloud only) — dropdown: `Anthropic (Claude Haiku 4.5)` default, `OpenAI`.
   - `Model` — text input prefilled with provider default (`claude-haiku-4-5-20251001` / `gpt-4o-mini` / `llama3.2:3b-instruct`).
   - `API Key` (cloud only) — password-masked. Helper text: "Stored locally. Never sent to tabiya servers."
2. SETTINGS SHALL persist under `localStorage`: `tabiya.ai.location`, `tabiya.ai.provider`, `tabiya.ai.model`, `tabiya.ai.apiKey` (Article 11).
3. WHEN `Local (Ollama)` AND Ollama not reachable THE Settings page SHALL show an inline diagnostic: "Ollama not detected at localhost:11434. Install Ollama or switch to Cloud."
4. THE Settings page SHALL provide a "Test connection" button that issues a 1-token completion and surfaces success/failure inline.
5. THE API key field SHALL show a "Clear key" action wiping the entry.
6. SETTINGS SHALL never log the API key to console, telemetry, or test snapshots.

---

## R7 — Surface A: in-drill "Why?" button (only surface in 4a)

**User Story:** As a player mid-drill, when I want to understand the current position, I want a single button that opens a coach modal with engine truth + LLM narration.

### Acceptance criteria

1. THE DRILL PAGE SHALL render a "Why?" button visible in all drill states except `idle`.
2. CLICKING "Why?" SHALL open a modal panel displaying the Coach response for the current `(lineId, plyIndex)`.
3. THE modal SHALL render the following panels in order:
   - **Engine card (always present)**: best move SAN, eval (cp or mate), top-N PV lines as SAN sequences, engine name + depth + preset name.
   - **LLM narration card (present iff LLM configured AND responded successfully)**: 1–4 sentence explanation.
   - **Degraded-mode footer (present iff narration card absent)**: "Enable AI in Settings for narration." (Article 11.)
4. THE modal SHALL be closable via ESC, click-outside, or explicit close button.
5. THE coach result for the `(lineId, plyIndex, enginePreset, modelName)` tuple SHALL be cached in-memory for the session — re-clicking the same position SHALL NOT re-invoke the engine or LLM.
6. WHEN LLM is unconfigured or unreachable THE modal SHALL render the Engine card only with the degraded footer. NO error thrown.
7. THE "Why?" button SHALL be keyboard-accessible via `?` shortcut.
8. THE modal SHALL NOT block drill state — closing returns the user to the exact same drill ply.

> Surfaces B (OOB "Ask Coach") and C (free-form chat) are explicitly out of scope for 4a and re-enter the spec in 4e.

---

## R8 — Prompt template + versioning (4a)

**User Story:** As a developer iterating on coach quality, I want prompts in version-controlled files, not strings glued into TS, so a future eval harness (4e) can A/B prompt versions.

### Acceptance criteria

1. THE SYSTEM SHALL store the 4a prompt template at `prompts/coach/v1.txt` as plain text with `{{placeholder}}` slots: `engine_block`, `recent_plies_block`, `engine_preset_name`.
2. THE template SHALL include at least 3 few-shot examples grounded in real positions (Italian Game ply 4, Sicilian Najdorf ply 6, French Advance ply 5).
3. THE template SHALL include an honest constraint: *"You see Stockfish PVs and the user's recent moves. You do NOT see deep positional features. Keep explanations to 1–4 sentences. If the engine output is ambiguous, say so rather than invent."* This is the 4a "honest baseline" hedge that 4e replaces with hallucination-blocking.
4. THE SYSTEM SHALL load the template at build time and bundle as a string constant. NO runtime fetch.
5. EVERY coach response SHALL log the prompt version (`v1`) for future eval traceability — log destination is in-memory dev console in 4a; structured telemetry lands in 4e.

---

## R9 — Quality gates (4a)

### Acceptance criteria

1. **Engine tests** — `StockfishWasmEngine` SHALL have integration tests covering `analyze` returning valid PVs on at least 5 known positions (starting position, Italian after 1.e4 e5 2.Nf3 Nc6 3.Bc4, Sicilian after 1.e4 c5 2.Nf3 d6, French Tarrasch, Caro-Kann advance).
2. **Interface contract tests** — `ChessEngine` SHALL have a shared test suite any implementation passes.
3. **Surface A degraded-mode test** — explicitly verify modal renders Engine card and no narration card when `LLMClient` is unconfigured (Article 11).
4. **LLMClient tests** — each of the 4 implementations has a happy-path test against a mock (Anthropic / OpenAI SDK mocking; Ollama via `msw`; llama.cpp WebGPU stubbed).
5. **Cache test** — re-clicking the same `(lineId, plyIndex, preset, model)` SHALL NOT re-invoke engine or LLM (assert via mock call counts).
6. **No-LangChain lint** — ESLint rule fails the build if `langchain`, `@langchain/*`, `llamaindex`, or `crewai` appears in any import (Article 3).
7. **Bundle budget** — engine worker chunk SHALL be lazy-loaded; base trainer bundle gzip size SHALL NOT increase by more than 30 kB (Article 11 — base app stays light).
8. **Type discipline** — TS strict, no `any` without inline justification (Article 14).
9. **Honest acceptance** — manual sanity walkthrough on 10 positions across 3 openings; documented in `evals/coach/4a-walkthrough.md` as a Markdown checklist. Expected outcome: roughly half of explanations will feel shallow or generic. **This is acceptable for 4a.** It is the baseline we measure 4b–4e against.

---

## Files touched (4a forecast)

- `src/engine/ChessEngine.ts` — interface
- `src/engine/StockfishWasmEngine.ts` — concrete impl
- `src/engine/stockfish-worker.ts` — worker entry
- `public/stockfish.wasm` — engine binary (lazy-loaded chunk)
- `src/coach/CoachContextBuilder.ts` — minimal builder (engine + history only)
- `src/coach/LLMClient.ts` — interface
- `src/coach/AnthropicLLMClient.ts`
- `src/coach/OpenAILLMClient.ts`
- `src/coach/OllamaLLMClient.ts`
- `src/coach/LlamaCppWebGPULLMClient.ts`
- `src/coach/CoachPipeline.ts` — orchestrator (engine → context → LLM)
- `src/components/coach/WhyButton.tsx` — Surface A trigger
- `src/components/coach/CoachModal.tsx` — Surface A modal
- `src/components/settings/AISection.tsx` — Settings UI
- `src/components/settings/EngineSection.tsx` — Settings UI
- `src/hooks/useCoach.ts` — invocation + caching
- `prompts/coach/v1.txt` — 4a prompt template
- `prompts/coach/CHANGELOG.md`
- `tests/coach/*`, `tests/engine/*`
- `tech.md` — add `stockfish.wasm`, `@anthropic-ai/sdk`, `openai`, `ollama` (optional) license declarations

---

## Out of scope (entire Phase 4)

- Multi-agent orchestration; ReAct loops beyond simple "retrieve → prompt → answer" (Article 3).
- Fine-tuning a chess-specific LLM model.
- Real-time analysis of a live in-progress game against a human opponent.
- Opponent-prep modes (analyze opponent's recent lichess games and suggest a line).
- Voice / TTS coach narration.
- ChatGPT-plugin / public-API integrations.
- iOS / mobile-native packaging.

---

## Open questions (4a active)

1. **Should the 4a modal show recent-plies inline?** Pro: transparency. Con: clutter on small screens. Lean: show only on a "details" disclosure within the modal.
2. **Should `Local (Browser WebGPU)` ship in 4a or be a 4a.1 follow-up?** WebGPU model loading is a 200-500 MB download — first-use UX is rough. Lean: implement the client interface in 4a, gate the UI option behind a feature flag `tabiya.flag.webgpuLlm` defaulting off.
3. **Where does the future feature-extractor (4b) actually live — Python backend or in-browser python-chess via Pyodide?** Lean Pyodide for Article 12 (backend optional). Decision deferred to 4b kickoff.
4. **`claude-haiku-4-5` as 4a default — does cost stay below $5/month at expected demo usage?** Estimate ~50 invocations per demo session × 1500 input tokens × $0.80 / 1M = $0.06/session. Confirm pre-shipping.
5. **In-memory cache vs IndexedDB cache for coach answers?** 4a: in-memory only — explanations are not durable artifacts in the moat narrative.

## Timebox (4a only)

**1–2 weekends.** Engine integration + Surface A is largely a wiring exercise; the moat work is 4b+ and is the explicit reason 4a stays small.

Future sub-phase estimates live inside each future-phase block below.

---

---

# Phase 4b — Deterministic Feature Extraction Layer (FUTURE)

**Purpose.** Replace LLM hallucination of basic chess concepts with deterministic rule-based features computed via python-chess. The LLM stops guessing at "is this an outpost?" and instead receives an authoritative list.

**Interview hook.** "Stockfish tells you *what move is best*. The feature extractor tells you *what about this position the player should notice* — and the LLM only narrates what the extractor already knows."

**Status.** DOCUMENTED. NOT scheduled.

**Estimated weekend cost.** 4–6 weekends (extractor is breadth-heavy; each feature is small but needs a golden test).

## Dependencies

- 4a complete (engine output is the feed).
- Decision on extractor runtime location: Pyodide in-browser vs FastAPI backend (Article 12 favors Pyodide).

## Design summary

### `FeatureExtractor` interface

```ts
interface FeatureExtractor {
  extract(fen: string, engineAnalysis?: EngineAnalysis): Promise<PositionFeatures>;
}
```

Python side (via Pyodide or backend):

```py
class FeatureExtractor:
    def extract(self, fen: str, engine: EngineAnalysis | None = None) -> PositionFeatures: ...
```

### `PositionFeatures` (output schema)

```json
{
  "fen": "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 5",
  "development": {
    "white_developed": ["Nc3","Nd4"],
    "black_developed": ["Nf6"],
    "white_dev_count": 2,
    "black_dev_count": 1
  },
  "center_control": {
    "white_attacks_d4_e4_d5_e5": ["d4"],
    "black_attacks_d4_e4_d5_e5": [],
    "extended_center_balance": +1
  },
  "king_safety": {
    "white": { "castled": false, "pawn_shield_score": 3, "open_files_near_king": [], "attacker_count": 0 },
    "black": { "castled": false, "pawn_shield_score": 3, "open_files_near_king": [], "attacker_count": 0 }
  },
  "space": { "white": 14, "black": 12 },
  "tempo": { "ply": 8, "expected_theory_ply": 8, "deviation": 0 },
  "pawn_structure": {
    "doubled": [], "isolated": [], "backward": [], "passed": [],
    "candidate_passers": [], "pawn_islands": { "white": 2, "black": 2 }
  },
  "open_files":  { "open": [], "half_open_for_white": ["c"], "half_open_for_black": [] },
  "diagonals":   { "long_diagonal_a1h8_controlled": "contested", "long_diagonal_a8h1_controlled": "contested" },
  "weak_squares": { "white_weaknesses": ["d6"], "black_weaknesses": ["d5"] },
  "outposts":     { "white": ["d5"], "black": ["d4"] },
  "piece_activity": { "Nd4": 8, "Nc3": 4, "Nf6": 5 },
  "pinned":         [{"piece":"Bf1","by":"none"}],
  "overloaded":     [],
  "discovered_attack_candidates": [],
  "x_ray_candidates": [],
  "trapped_pieces": [],
  "bishop_pair":    { "white": true, "black": true },
  "knight_outposts":{ "white": [], "black": [] }
}
```

### Algorithm sketches (python-chess primitives)

```py
# Development: which non-pawn, non-king pieces have left their starting square
def development(board: chess.Board) -> dict:
    start = chess.Board()
    moved = []
    for sq, piece in board.piece_map().items():
        if piece.piece_type in (chess.PAWN, chess.KING): continue
        if start.piece_at(sq) != piece:
            moved.append((piece, sq))
    ...

# Center control: attackers on each central square
def center_control(board: chess.Board) -> dict:
    central = [chess.D4, chess.E4, chess.D5, chess.E5]
    return {
        sq_name(s): {
            "white": len(board.attackers(chess.WHITE, s)),
            "black": len(board.attackers(chess.BLACK, s))
        } for s in central
    }

# Outposts: square in opponent half, defended by own pawn, not attackable by enemy pawn
def outposts(board: chess.Board, color: chess.Color) -> list[str]:
    half = range(32, 64) if color == chess.WHITE else range(0, 32)
    out = []
    for sq in half:
        if not pawn_defended(board, sq, color): continue
        if pawn_attackable(board, sq, not color): continue
        out.append(chess.square_name(sq))
    return out

# Pinned pieces: python-chess has board.is_pinned(color, square)
def pinned_pieces(board: chess.Board) -> list:
    return [
        {"piece": piece_str(board, sq), "color": piece.color}
        for sq, piece in board.piece_map().items()
        if board.is_pinned(piece.color, sq)
    ]

# Overloaded defenders: pieces defending ≥2 threatened pieces
def overloaded(board: chess.Board) -> list:
    out = []
    for sq, piece in board.piece_map().items():
        threatened_defended = [
            t for t in board.piece_map()
            if board.is_attacked_by(not piece.color, t)
            and sq in board.attackers(piece.color, t)
        ]
        if len(threatened_defended) >= 2:
            out.append({"piece": piece_str(board, sq), "defending": threatened_defended})
    return out
```

### Unit-test approach

Each feature ships with a golden-position fixture: a known FEN where domain experts (or chess.com / lichess analysis) confirm the feature value. Golden set lives at `evals/features/golden/<feature>.json`. CI runs the extractor on every golden and asserts equality.

## Inputs / outputs

- **Input:** FEN (always); optional `EngineAnalysis` for activity heuristics.
- **Output:** `PositionFeatures` (above), strict JSON, schema-versioned.

## Risks

- **Edge cases in pawn structure detection** — backward / isolated / passed have subtle definitions; mismatch with chess literature → user confusion.
- **Pyodide load weight** — python-chess + numpy can be heavy. Mitigation: lazy-load on first Coach invocation; consider pure-TS reimplementation if size unacceptable.
- **Activity scoring is heuristic** — different references rate piece activity differently; pick a single consistent reference (e.g., mobility-count = legal moves for the piece in question).

---

# Phase 4c — Position Classification + Motif Detection (FUTURE)

**Purpose.** Identify *what kind of position this is* (open, closed, IQP, Hedgehog…) and *what tactical / positional motifs are present* (pin, fork, minority attack, prophylaxis). The classification chooses which explanation template the LLM uses in 4e; motifs become the verbs of the explanation.

**Interview hook.** "Before we explain a position, we tell the model what category it's in. An IQP explanation never reads like a closed Spanish explanation, because the prompt template literally differs."

**Status.** DOCUMENTED. NOT scheduled.

**Estimated weekend cost.** 3–5 weekends.

## Dependencies

- 4a complete.
- 4b complete (classifiers consume features).

## Design summary

### `PositionClassifier` interface

```ts
interface PositionClassifier {
  classify(features: PositionFeatures, fen: string): PositionClassification;
}
type PositionClassification = {
  type: 'open' | 'closed' | 'semi-open';
  sharpness: 'tactical' | 'positional' | 'mixed';
  pawn_structure: PawnStructureClass[];      // can be multi-labeled
  king_situation: 'same-side-castled' | 'opposite-side-castled' | 'uncastled' | 'mixed';
  confidence: number;                         // 0..1 heuristic score
};
type PawnStructureClass =
  | 'iqp'             // isolated d-pawn
  | 'carlsbad'        // exchange-Slav pawn shape
  | 'sicilian'        // c5 black + d6 + e6/e5
  | 'hedgehog'        // a6+b6+d6+e6 black
  | 'maroczy'         // white c4+e4 vs Sicilian
  | 'hanging-pawns'   // c+d side-by-side on half-open files
  | 'isolated-d' | 'isolated-c' | 'isolated-e'
  | 'doubled-c' | 'doubled-f' | 'doubled-other'
  | 'pawn-chain';
```

### Classifier heuristics

```py
def classify_open(features: PositionFeatures) -> bool:
    central_pawns = features["pawn_structure"]["central_pawn_count"]
    mobility_total = sum(features["piece_activity"].values())
    return central_pawns <= 2 and mobility_total >= 30

def classify_closed(features) -> bool:
    return features["pawn_structure"]["pawn_chains"] >= 2 and \
           features["pawn_structure"]["central_pawn_count"] >= 4

def classify_iqp(board: chess.Board) -> bool:
    # white isolated d-pawn AND black has no d-pawn
    d_pawns_white = [s for s,p in board.piece_map().items()
                     if p.piece_type == chess.PAWN and p.color == chess.WHITE
                     and chess.square_file(s) == chess.D]
    if len(d_pawns_white) != 1: return False
    s = d_pawns_white[0]
    has_c = any(...)   # adjacent files
    has_e = any(...)
    return not (has_c or has_e)

def classify_hedgehog(board: chess.Board) -> bool:
    # black pawns on a6, b6, d6, e6
    needed = {chess.A6, chess.B6, chess.D6, chess.E6}
    black_pawns = {s for s,p in board.piece_map().items()
                   if p.piece_type == chess.PAWN and p.color == chess.BLACK}
    return needed.issubset(black_pawns)

def classify_sharpness(features, engine: EngineAnalysis) -> str:
    pv_evals = [pv["scoreCp"] for pv in engine["pvs"]]
    spread = max(pv_evals) - min(pv_evals)
    threat_density = len(features["overloaded"]) + len(features["pinned"]) + \
                     len(features["discovered_attack_candidates"])
    if spread > 80 or threat_density >= 3:
        return "tactical"
    if spread < 20 and threat_density == 0:
        return "positional"
    return "mixed"
```

### `MotifDetector` interface

```ts
interface MotifDetector {
  detect(fen: string, engineAnalysis: EngineAnalysis, features: PositionFeatures): Motif[];
}
type Motif = {
  kind: TacticalMotif | PositionalMotif;
  squares: string[];
  pieces: string[];
  description: string;             // human-friendly, generated by template not LLM
  confidence: number;
};
type TacticalMotif =
  | 'pin' | 'fork' | 'skewer' | 'discovered-attack' | 'x-ray'
  | 'overload' | 'deflection' | 'removal-of-defender'
  | 'zugzwang' | 'fortress';
type PositionalMotif =
  | 'minority-attack' | 'central-pawn-break'
  | 'outpost-installation' | 'prophylaxis';
```

### Motif algorithms (sketches)

```py
def detect_fork(board: chess.Board, side_to_move: chess.Color) -> list[Motif]:
    out = []
    for sq, piece in board.piece_map().items():
        if piece.color != side_to_move: continue
        attacked_high_value = [
            t for t in board.attacks(sq)
            if (q := board.piece_at(t))
            and q.color != side_to_move
            and piece_value(q) >= piece_value(piece)
        ]
        if len(attacked_high_value) >= 2:
            out.append(Motif("fork", ..., ...))
    return out

def detect_minority_attack(board, classification) -> list[Motif]:
    # White has fewer queenside pawns than black,
    # and a white queenside pawn (typically b-pawn) is advancing
    ...

def detect_central_break(board, last_move: chess.Move) -> list[Motif]:
    # Move is e4 / d4 / c4 / f4 push releasing pawn tension
    if last_move and is_central_pawn_push(board, last_move) and creates_tension(board, last_move):
        return [Motif("central-pawn-break", ..., ...)]
    return []
```

## Inputs / outputs

- **Input:** `PositionFeatures` + `EngineAnalysis` + FEN.
- **Output:** `PositionClassification` + `Motif[]`.

## Risks

- **Carlsbad vs Catalan false positives** — similar pawn shapes; need careful disambiguation.
- **Motif confidence is heuristic** — early versions will over-fire; ship with conservative thresholds and tune.
- **Sharpness threshold tuning** — eval spread is engine-depth dependent; thresholds must scale with `enginePresetName`.

---

# Phase 4d — Semantic Layer + Plans + Opening KG (FUTURE)

**Purpose.** Translate raw features + classification + motifs into a *semantic vocabulary the LLM is constrained to use*. Walk the engine PV deeper to extract multi-move *plans*. Add a position-keyed Opening Knowledge Graph so the system knows "this is an IQP Carlsbad — typical plan = minority attack on queenside; black counterplay = central break with …e5".

**Interview hook.** "The LLM has a fixed vocabulary of move purposes. If 'restrict_counterplay' is not in the input tags, the LLM cannot say 'this restricts counterplay'. Hallucination is structurally blocked."

**Status.** DOCUMENTED. NOT scheduled.

**Estimated weekend cost.** 5–7 weekends. This is the densest sub-phase.

## Dependencies

- 4b, 4c complete.

## Design summary

### Move-purpose taxonomy (enum)

```ts
type MovePurpose =
  | 'development'
  | 'pressure_center'
  | 'control_key_square'
  | 'restrict_counterplay'
  | 'prepare_break'
  | 'execute_break'
  | 'prophylaxis'
  | 'improve_worst_piece'
  | 'create_weakness'
  | 'exploit_weakness'
  | 'king_safety'
  | 'open_file_pressure'
  | 'exchange_to_simplify'
  | 'avoid_exchange'
  | 'gain_tempo'
  | 'rerouting'
  | 'pawn_break_central'
  | 'pawn_break_minority'
  | 'tactical_threat';
```

### Concept hierarchy

```
Strategic
  ├── Pawn-structure decisions (break, lock, exchange)
  ├── Piece placement (outpost, rerouting, worst-piece improvement)
  └── King decisions (castle side, open lines)
Tactical
  ├── Threats (pin, fork, skewer, discovered, x-ray)
  ├── Defenses (overprotection, deflection-prevention)
  └── Combination triggers (sacrifice, removal)
Positional
  ├── Space (advance, restrict)
  ├── Prophylaxis (anticipate, block, prevent)
  └── Exchange decisions (which piece to keep)
```

### `SemanticTagger` interface

```ts
interface SemanticTagger {
  tag(input: {
    features: PositionFeatures;
    classification: PositionClassification;
    motifs: Motif[];
    engine: EngineAnalysis;
    candidateMove: string;       // SAN
  }): MovePurpose[];
}
```

### Deterministic translation rules (illustrative)

```py
def tag(features, classif, motifs, engine, move_san) -> list[MovePurpose]:
    tags = []
    if "iqp" in classif["pawn_structure"]:
        if is_central_pawn_push(move_san) and target_square(move_san) in features["outposts"]["enemy"]:
            tags.append("execute_break")
        if is_knight_to_d5(move_san) or is_knight_to_e5(move_san):
            tags.append("control_key_square")
    if "hedgehog" in classif["pawn_structure"]:
        if move_san in ("b5", "d5"):
            tags.append("pawn_break_central")
    if any(m.kind == "minority-attack" for m in motifs):
        if is_b_pawn_push(move_san):
            tags.append("pawn_break_minority")
    if is_developing_move(move_san, features):
        tags.append("development")
    if creates_threat(move_san, motifs):
        tags.append("tactical_threat")
    return list(set(tags))
```

### `PlanExtractor` interface

```ts
interface PlanExtractor {
  extract(input: {
    engine: EngineAnalysis;
    classification: PositionClassification;
    fen: string;
  }): Plan[];
}
type Plan = {
  name: string;
  steps: PlanStep[];
  success_condition: string;
  estimated_plies: number;
};
type PlanStep = {
  san: string;
  purpose: MovePurpose;
  alternative_sans?: string[];
};
```

Plan extraction walks the top PV 8–12 plies deep, segments into purpose phases (e.g. "rerouting (4 plies) → break (1 ply) → exploit (3 plies)"), and labels each step with a purpose from the taxonomy. Multi-PV walks let the extractor identify *opponent counterplay* by classifying the opponent's best response.

### Opening Knowledge Graph

```
Nodes: positions identified by FEN hash (Zobrist-derived)
Edges: SAN moves
Node metadata:
  {
    eco: "B07",
    family: "Pirc",
    variation: "Classical",
    named_plans: [
      { name: "Kingside attack", steps: [...] },
      { name: "Central play", steps: [...] }
    ],
    typical_pawn_breaks: ["e4-e5", "f2-f4-f5"],
    characteristic_pieces: ["dark-squared bishop on g7"],
    transposition_targets: [<fen_hash>, <fen_hash>]
  }
```

Storage:

- Build artifact: `data/opening_kg/kg.json` or `data/opening_kg/kg.sqlite` (~ a few MB).
- Generated offline from Phase 1b explain blocks + Phase 2 key_squares + Phase 1c family/variation metadata + manually curated named_plans.
- Loaded lazily on first Coach invocation post-4d.

### Counterplay identification

```py
def identify_counterplay(engine: EngineAnalysis, classification) -> CounterplayKind:
    opponent_best_pv = engine["pvs"][0]["moves"][1:5]  # first few opponent moves
    if any(is_kingside_pawn_advance(m) for m in opponent_best_pv):
        return "kingside_attack"
    if any(is_central_break(m) for m in opponent_best_pv):
        return "central_break"
    if any(is_queenside_pawn_storm(m) for m in opponent_best_pv):
        return "queenside_storm"
    if any(is_exchange(m) for m in opponent_best_pv):
        return "exchange_to_draw"
    return "no_clear_counterplay"
```

## Inputs / outputs

- **Input:** features + classification + motifs + engine + candidate move (SAN).
- **Output:** `MovePurpose[]`, `Plan[]`, `OpeningKGNode` (if FEN matches), `CounterplayKind`.

## Risks

- **Taxonomy drift** — adding new MovePurpose values must be additive and version-pinned.
- **KG curation cost** — named_plans require human writing; bootstrap from Phase 1b explain blocks.
- **Transposition correctness** — Zobrist hash must include castling rights + en passant.

---

# Phase 4e — Production Coach + Explain UI (FUTURE)

**Purpose.** Wire the full symbolic stack into a *grounded prompt architecture*, render layered explanations with skill modes, ship the remaining surfaces (B: OOB Ask Coach, C: free-form chat), add visual highlights, and gate everything behind quantitative eval (faithfulness, helpfulness, retrieval, hallucination).

**Interview hook.** "By the time the LLM is invoked, the only freedom it has left is wording. Every chess claim it can make is already in the input."

**Status.** DOCUMENTED. NOT scheduled.

**Estimated weekend cost.** 5–8 weekends.

## Dependencies

- 4a, 4b, 4c, 4d complete.

## Design summary

### Grounded prompt architecture

The prompt is assembled from labeled sections; the LLM is instructed to use only what is present.

```
[SYSTEM]
You are a chess coach. You may discuss only facts present in the
sections below. If a fact you'd like to share is not in the sections,
say "the engine doesn't justify a deeper claim here" instead.

[ENGINE_OUTPUT]
Best: {{best_san}}  ({{eval_cp}})
PVs:  {{pv_table}}

[EXTRACTED_FEATURES]
Outposts (white): {{features.outposts.white}}
Weak squares (black): {{features.weak_squares.black}}
Bishop pair: white={{features.bishop_pair.white}} black={{features.bishop_pair.black}}
King safety: {{features.king_safety_summary}}

[POSITION_CLASS]
Type: {{classification.type}}
Sharpness: {{classification.sharpness}}
Pawn structures: {{classification.pawn_structure}}

[MOTIFS]
{{motifs_bulleted}}

[SEMANTIC_TAGS for candidate move {{candidate_san}}]
{{tags_bulleted}}

[PLAN]
{{plan.name}}: {{plan.steps_summarized}}

[OPENING_KG_FACTS]
{{kg_node_summary}}

[USER_QUESTION]
{{user_question or "Why is this the best move?"}}

[RESPONSE_RULES]
- Skill mode: {{skill_mode}}.
- Length cap: {{cap_words}} words.
- You MAY only reference items present above. If unsure, say so.
- Use SAN, never coordinate notation.
```

### Hallucination prevention

Two-pass:

1. LLM emits JSON with `{ "prose": str, "tags_cited": MovePurpose[], "motifs_cited": MotifKind[], "features_cited": string[] }`.
2. Post-validator asserts every cited tag / motif / feature is present in the prompt input. If a citation is unknown, the response is rejected and either retried (one retry) or downgraded to engine-only.

### Skill modes

```ts
type SkillMode = 'beginner' | 'intermediate' | 'advanced';

const SKILL_RULES: Record<SkillMode, { capWords: number; defineJargon: boolean; tone: string }> = {
  beginner:     { capWords: 60,  defineJargon: true,  tone: "Define one chess term inline if used." },
  intermediate: { capWords: 100, defineJargon: false, tone: "Assume standard chess vocabulary." },
  advanced:     { capWords: 80,  defineJargon: false, tone: "Be terse. No definitions. Cite squares." }
};
```

Each `(position_class, skill_mode)` pair has a tailored prompt template — IQP-beginner ≠ Hedgehog-advanced.

### Explanation ranking

Generate 3 candidate responses with `temperature=0.7`; LLM-judge call (separate `judge_prompt.v1.txt`) scores each on **faithfulness × concision**; best is shown. Other two are logged for eval.

### Visual highlights (Article 15 — single primitive)

- Red arrows: threat motif squares (pin/fork/skewer target).
- Blue squares: outposts.
- Yellow squares: weak squares.
- Plan icons hovering above the board: `pawn-break`, `piece-reroute`, `exchange`, `prophylaxis`.

Implementation reuses the existing `<HighlightLayer>` primitive (Article 15). Plan icons are a new component but share the primitive's positioning logic.

### "Why not this move?" comparison

User clicks an alternative SAN in the move list:

1. Pipeline re-runs on the alternative.
2. Side-by-side card: left = best move's pipeline output, right = alternative's pipeline output, diff bar shows eval-cp gap + feature deltas.

### Surfaces B and C re-enter scope

- **Surface B (Phase 3 OOB list "Ask Coach")** — uses full pipeline on `(fen_before_oob, played_san, expected_book_san)`. Renders side-by-side: engine + features for book vs played. Faithfulness gate: if engine eval shows played was equal/better, LLM SHALL acknowledge.
- **Surface C (free-form chat sidebar)** — multi-turn, always re-injects current FEN + last 6 plies + full feature bundle. In-memory only; "Position changed to <line> ply <N>" inline notice when user navigates.

### Eval harness (Article 4)

**Retrieval eval** (`evals/coach/retrieval/`):

- ≥30 hand-graded `(fen, expected_kg_node_ids[], expected_explain_block_ids[])` pairs.
- Target: `hit@3 ≥ 0.85`. CI-blocking.

**LLM-as-judge answer eval** (`evals/coach/answers/`):

- 50 scenarios `{ fen, surface, user_question?, expected_facts }`.
- Judge prompt scores **Faithfulness** (0/1) + **Helpfulness** (1–5).
- Targets: `mean_faithfulness ≥ 0.9`, `mean_helpfulness ≥ 4.0`.
- CI-blocking on prompt / pipeline / judge_prompt changes.

**Hallucination eval** — separate gate: 100% of cited tags must be present in input. CI-blocking.

## Inputs / outputs

- **Input:** full stack (`features`, `classification`, `motifs`, `tags`, `plan`, `kgNode`, `engine`, `userQuestion?`, `skillMode`).
- **Output:** validated `LLMResponse { prose, tags_cited, motifs_cited, features_cited }`.

## Risks

- **LLM ignores hallucination constraint** — mitigated by post-validator + retry + downgrade.
- **Skill-mode prompt explosion** — `(positionClass × skillMode)` templates grow fast; mitigate by composing partials.
- **Judge prompt bias** — judge LLM is Anthropic by default; cross-check by occasionally running with OpenAI judge.

---

## Common pitfalls (across all sub-phases)

- **4a:** shallow LLM output read as "the moat doesn't work" rather than as "the moat hasn't been built yet." Mitigate by labeling the demo "Naive baseline" in the UI.
- **4b:** feature extractor missing chess literature edge cases (backward pawns are subtle; passed-pawn detection over-fires near the edge of the board).
- **4c:** Carlsbad-like Catalan structures false-positive as Carlsbad; minority-attack detector fires on quiet b-pawn advances; sharpness threshold doesn't scale with engine depth.
- **4d:** semantic tagger over-generalizes ("development" tag attached to every Nf3 even mid-middlegame); KG transposition table key omits castling rights → false matches.
- **4e:** LLM ignores "use only provided facts" — post-validator must enforce in code, not prompt.

---

## MVP vs advanced roadmap

| Capability | 4a (build) | 4b | 4c | 4d | 4e |
|---|---|---|---|---|---|
| Stockfish PVs in surface | yes | yes | yes | yes | yes |
| Feature extraction | no | **add** | yes | yes | yes |
| Position classification | no | no | **add** | yes | yes |
| Motif detection | no | no | **add** | yes | yes |
| Semantic tags | no | no | no | **add** | yes |
| Plan extraction | no | no | no | **add** | yes |
| Opening KG | no | no | no | **add** | yes |
| Grounded prompt | no (shallow) | no | no | no | **add** |
| Hallucination block | no | no | no | no | **add** |
| Skill modes | no | no | no | no | **add** |
| Why-not-this-move | no | no | no | no | **add** |
| Visual highlights | no | no | no | no | **add** |
| Surface A (in-drill Why) | **yes** | yes | yes | yes | yes |
| Surface B (OOB Ask Coach) | no | no | no | no | **add** |
| Surface C (free-form chat) | no | no | no | no | **add** |
| Retrieval eval CI | no | no | no | no | **add** |
| Answer eval (judge) CI | no | no | no | no | **add** |

---

## Constitution compliance (summary)

- **Article 3** — Direct SDK calls only. ESLint rule blocks LangChain/CrewAI/LlamaIndex imports.
- **Article 4** — 4e ships RAG + symbolic-grounded eval. 4a alone is honest baseline, not the AI deliverable.
- **Article 5** — `ChessEngine`, `FeatureExtractor`, `PositionClassifier`, `MotifDetector`, `SemanticTagger`, `PlanExtractor`, `OpeningKG`, `LLMClient`, `CoachContextRepository` are all interfaces. Concrete impls behind DI.
- **Article 9** — SAN at every layer boundary; UCI confined to `StockfishWasmEngine`.
- **Article 11** — Each layer degrades. Engine-only mode (4a), features-only mode (4b), … are all valid surface states.
- **Article 12** — Backend optional. Pyodide path keeps Python features in-browser. FastAPI backend optional fallback.
- **Article 13** — 4a is 1–2 weekends. 4b–4e is documented but not scheduled. **No work on 4b–4e until main plan permits** (currently locked to Jan 2027 application window).
- **Article 14** — TS strict, Python typed.
- **Article 15** — All highlights reuse the single primitive.

---

## Open questions (cross-phase)

1. **Pyodide vs FastAPI** for the symbolic layer runtime — Pyodide aligns Article 12 but ships 10+ MB; FastAPI is lighter to ship but requires `docker compose` to run the backend.
2. **KG bootstrapping** — generated from Phase 1b/2 content or hand-curated? Lean: bootstrap from 1b/2, hand-edit named_plans.
3. **Local LLM quality floor** — `llama3.2:3b-instruct` may not handle grounded JSON output reliably; 4e may force Anthropic/OpenAI as the gate, with local LLM downgraded to 4a-style prose.
4. **Eval set composition** — 50 scenarios cover the 5 active openings? Need a coverage matrix.
5. **Sub-phase amalgamation** — should 4b+4c be a single ship? They share python-chess primitives; the natural cut may be 4b+4c together as "symbolic layer" and 4d+4e separately as "grounded semantic layer." Decision deferred.

---

## Timebox

- **4a (active build):** 1–2 weekends. Hard cap; if it overruns by 50% the spec is re-cut, not extended.
- **4b–4e:** ~17–26 weekends across a 4–5 month arc. **Not scheduled until main AI/ML plan completes Jan 2027 application window.** Article 13 holds: project pauses immediately if the main plan slips.
