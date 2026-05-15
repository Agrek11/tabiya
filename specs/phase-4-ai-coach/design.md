# Design: Phase 4 — AI Coach

## Overview

Phase 4 is the architectural pillar shift: **a deterministic symbolic chess understanding stack sits between the engine and the LLM**. Stockfish is the truth oracle for "best move + eval"; python-chess rule-based code computes ~30 features per position; classifiers identify position type and pawn structure; motif detectors find tactical and positional themes; a semantic tagger maps the raw layers into a fixed move-purpose taxonomy; a plan extractor walks the PV deeply to recover multi-ply plans; an opening Knowledge Graph supplies family-level priors. **The LLM is a scribe** — it narrates a grounded context bundle and is post-validated against hallucination.

The build ladder is **4a now, 4b–4e documented**. 4a ships a deliberately shallow engine + LLM MVP so the moat narrative starts from an honest baseline. 4b–4e specify the moat at architecture-sketch fidelity — every interface, key algorithm, JSON shape, and risk is captured so future weekends can pick up any sub-phase without rediscovery.

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

Every downward arrow is a typed interface. Every layer may be skipped — the surface always knows how to render what it has. This is the Article 11 invariant.

---

# Phase 4a design (DETAILED, IMPLEMENTABLE)

## 1. Engine integration

### Stockfish.wasm Web Worker

`stockfish.wasm` is loaded inside a dedicated Web Worker entry at `src/engine/stockfish-worker.ts`. The worker bundle is split into a Vite dynamic-import chunk; the chunk is loaded on first invocation of the Coach surface, not on app start (Article 11).

### UCI message protocol (inside worker)

```
main thread                            worker
───────────                            ──────
postMessage({type:'init'})  ─────────► load stockfish.wasm
                                       send "uci"
                            ◄────────  postMessage({type:'ready'})
postMessage({type:'analyze',fen,opts})
                                       send "position fen <fen>"
                                       send "go depth N multipv K"
                            ◄────────  info depth ... multipv ... score cp ... pv ...
                                       (parsed; UCI moves converted to SAN via chess.js)
                                       bestmove <uci>
                            ◄────────  postMessage({type:'analysis', EngineAnalysis})
postMessage({type:'stop'})  ─────────► send "stop"
```

UCI ↔ SAN conversion lives in the worker so the main thread only ever sees SAN (Article 9). chess.js inside the worker performs the conversion against a fresh `Chess(fen)`.

### `ChessEngine` interface

```ts
// src/engine/ChessEngine.ts
export interface ChessEngine {
  analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis>;
  stop(): void;
  ready: Promise<void>;
  readonly name: 'stockfish' | 'leela';
}

export type EngineOpts = {
  depth?: number;
  multipv?: number;
  movetimeMs?: number;
  signal?: AbortSignal;        // cancellation
};

export type EngineAnalysis = {
  fen: string;
  bestmove: string;            // SAN
  pvs: Array<{
    moves: string[];           // SAN sequence
    scoreCp: number;
    mateIn?: number;
    depth: number;
  }>;
  engineName: string;          // "Stockfish 16"
  engineDepth: number;
};
```

### `StockfishWasmEngine`

```ts
// src/engine/StockfishWasmEngine.ts
export class StockfishWasmEngine implements ChessEngine {
  readonly name = 'stockfish' as const;
  ready: Promise<void>;
  private worker: Worker;
  private pending: Map<string, (a: EngineAnalysis) => void> = new Map();

  constructor() {
    this.worker = new Worker(new URL('./stockfish-worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise(res => {
      this.worker.addEventListener('message', e => {
        if (e.data.type === 'ready') res();
        else if (e.data.type === 'analysis') this.resolve(e.data.analysis);
      });
      this.worker.postMessage({ type: 'init' });
    });
  }

  async analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis> {
    await this.ready;
    const id = crypto.randomUUID();
    const promise = new Promise<EngineAnalysis>(res => this.pending.set(id, res));
    this.worker.postMessage({ type: 'analyze', id, fen, opts });
    opts.signal?.addEventListener('abort', () => this.stop());
    return promise;
  }

  stop() { this.worker.postMessage({ type: 'stop' }); }
  private resolve(a: EngineAnalysis & { id?: string }) { /* ... */ }
}
```

### Engine presets

```ts
// src/engine/presets.ts
export const ENGINE_PRESETS = {
  Fast:     { depth: 12, multipv: 3, movetimeMs: 500 },
  Balanced: { depth: 20, multipv: 3, movetimeMs: 2000 },
  Deep:     { depth: 30, multipv: 5, movetimeMs: 5000 }
} as const;
export type EnginePresetName = keyof typeof ENGINE_PRESETS;
```

`localStorage.tabiya.engine.preset` persists the selection. Default = `'Balanced'`.

## 2. `CoachContext` (4a minimal shape)

```ts
// src/coach/CoachContext.ts
export type CoachContext = {
  engine: EngineAnalysis;
  history: PlyHistoryEntry[];           // last ≤6
  enginePresetName: EnginePresetName;
  // forward-compatible:
  features?: PositionFeatures;          // 4b+
  classification?: PositionClassification; // 4c+
  motifs?: Motif[];                     // 4c+
  semanticTags?: MovePurpose[];         // 4d+
  plan?: Plan;                          // 4d+
  kgNode?: OpeningKGNode;               // 4d+
};

export type PlyHistoryEntry = {
  san: string;
  plyIndex: number;
  color: 'w' | 'b';
  userAction?: 'correct' | 'wrong' | 'hint';
  wrongAttempts?: string[];
};
```

`CoachContextBuilder.build(input)` in 4a populates only `engine`, `history`, `enginePresetName`. All `?` fields stay undefined until later sub-phases.

## 3. `LLMClient` and four concrete implementations

### Interface

```ts
// src/coach/LLMClient.ts
export interface LLMClient {
  complete(prompt: PromptPayload): Promise<LLMResponse>;
  stream?(prompt: PromptPayload): AsyncIterable<LLMChunk>;
  readonly providerName: ProviderName;
  readonly modelName: string;
  available(): Promise<boolean>;
}

export type ProviderName =
  | 'cloud-anthropic' | 'cloud-openai' | 'local-ollama' | 'local-llamacpp-webgpu';

export type PromptPayload = {
  systemPrompt: string;
  userPrompt: string;
  stops?: string[];
  maxTokens?: number;
  temperature?: number;
};

export type LLMResponse = { text: string; modelName: string; usage?: TokenUsage };
```

### `AnthropicLLMClient` (with prompt caching)

```ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicLLMClient implements LLMClient {
  readonly providerName = 'cloud-anthropic' as const;
  constructor(public readonly modelName: string, private apiKey: string) {}
  async available() { return Boolean(this.apiKey); }

  async complete(p: PromptPayload): Promise<LLMResponse> {
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const res = await client.messages.create({
      model: this.modelName,
      max_tokens: p.maxTokens ?? 400,
      temperature: p.temperature ?? 0.6,
      system: [
        { type: 'text', text: p.systemPrompt, cache_control: { type: 'ephemeral' } }
      ],
      messages: [{ role: 'user', content: p.userPrompt }]
    });
    const text = res.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
    return { text, modelName: res.model, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
  }
}
```

### `OpenAILLMClient`

Direct `openai` SDK call against `client.chat.completions.create`. No caching headers.

### `OllamaLLMClient`

```ts
export class OllamaLLMClient implements LLMClient {
  readonly providerName = 'local-ollama' as const;
  constructor(public readonly modelName: string,
              private endpoint = 'http://localhost:11434') {}
  async available() {
    try { const r = await fetch(`${this.endpoint}/api/tags`); return r.ok; }
    catch { return false; }
  }
  async complete(p: PromptPayload): Promise<LLMResponse> {
    const r = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: p.systemPrompt },
          { role: 'user', content: p.userPrompt }
        ],
        stream: false,
        options: { temperature: p.temperature ?? 0.6, num_predict: p.maxTokens ?? 400 }
      })
    });
    const json = await r.json();
    return { text: json.message.content, modelName: this.modelName };
  }
}
```

### `LlamaCppWebGPULLMClient`

Stub the interface and probe `navigator.gpu`. `available()` returns false if WebGPU not supported. Model loading is feature-flagged off in 4a (`tabiya.flag.webgpuLlm`), but the implementation skeleton ships so the interface is honored.

## 4. Settings UI tree

```
Settings
├── Engine
│   └── Preset radio: Fast | Balanced | Deep   (default: Balanced)
└── AI
    ├── Inference Location radio:
    │   • Cloud
    │   • Local (Ollama)
    │   • Local (Browser WebGPU)   [feature-flagged]
    ├── Provider dropdown (cloud only): Anthropic | OpenAI
    ├── Model text input              (prefilled per provider)
    ├── API Key (password, cloud only) + [Clear key]
    ├── [Test connection]
    └── Inline diagnostic (red/yellow/green)
```

Persistence keys:
- `tabiya.engine.preset`
- `tabiya.ai.location`, `tabiya.ai.provider`, `tabiya.ai.model`, `tabiya.ai.apiKey`

## 5. Surface A modal layout

```
┌─────────────────────────────────────────────────────────┐
│  Coach — Italian Game · ply 6 · Stockfish Balanced (d20)│
├─────────────────────────────────────────────────────────┤
│ ENGINE                                                  │
│  Best:  d3   (+0.32)                                    │
│  PV 1:  d3 d6 c3 a6 ...                  +0.32  d20    │
│  PV 2:  O-O d6 ...                       +0.28  d20    │
│  PV 3:  Nc3 d6 ...                       +0.24  d20    │
├─────────────────────────────────────────────────────────┤
│ NARRATION                  [model: claude-haiku-4-5]    │
│ ───────────                                             │
│ "d3 prepares the bishop's retreat and keeps options for │
│  c3/d4 later. The natural alternative O-O is fine but   │
│  commits the king earlier than necessary."              │
├─────────────────────────────────────────────────────────┤
│ ⓘ This is a naive baseline. The full moat layers will   │
│   replace this prose with grounded explanations.        │
└─────────────────────────────────────────────────────────┘
                          [close ✕]
```

When LLM is not configured, the NARRATION panel is replaced by:

```
┌─────────────────────────────────────────────────────────┐
│ Configure AI in Settings to enable narration.           │
└─────────────────────────────────────────────────────────┘
```

The ENGINE panel always renders.

## 6. Cache strategy (4a)

In-memory `Map<string, LLMResponse>` keyed by `${lineId}::${plyIndex}::${enginePreset}::${modelName}`. Cleared on:

- Settings change (engine preset OR model OR provider).
- Page reload (session-only by design).
- Manual "Refresh" button in the modal footer (next sub-phase).

No IndexedDB persistence in 4a — explanations are not durable artifacts.

## 7. Engine-only degraded rendering

`CoachPipeline.run(input)` returns `{ engine, llm? }` where `llm` may be undefined. The modal renders `engine` unconditionally and `llm` only when present. No try/catch wrapping is needed at the UI level — the pipeline returns `llm: undefined` on failure and logs the cause.

## 8. Test plan

| Layer | Test type | Coverage |
|---|---|---|
| `StockfishWasmEngine` | Integration (real wasm) | 5 known FENs → valid PVs |
| `ChessEngine` interface | Contract suite | shared spec; future Leela passes same |
| `CoachContextBuilder` | Unit | history truncation; missing lineId; preset propagation |
| Each `LLMClient` | Unit with mocks | Anthropic SDK mock; OpenAI SDK mock; Ollama via msw; WebGPU stubbed |
| `CoachPipeline` | Unit | engine-only degraded path; cache hit / miss |
| `CoachModal` | Component | renders engine; renders narration when present; degraded footer when absent |
| Settings UI | Component | API key never appears in snapshots |
| ESLint | Static | no `langchain`/`crewai`/`llamaindex` imports |

## 9. File tree (4a)

```
src/
├── engine/
│   ├── ChessEngine.ts                  # interface
│   ├── StockfishWasmEngine.ts          # concrete
│   ├── stockfish-worker.ts             # worker entry
│   └── presets.ts
├── coach/
│   ├── CoachContext.ts                 # types
│   ├── CoachContextBuilder.ts          # builder
│   ├── LLMClient.ts                    # interface + types
│   ├── AnthropicLLMClient.ts
│   ├── OpenAILLMClient.ts
│   ├── OllamaLLMClient.ts
│   ├── LlamaCppWebGPULLMClient.ts
│   └── CoachPipeline.ts                # orchestrator
├── components/
│   ├── coach/
│   │   ├── WhyButton.tsx
│   │   └── CoachModal.tsx
│   └── settings/
│       ├── EngineSection.tsx
│       └── AISection.tsx
└── hooks/
    └── useCoach.ts                     # invocation + cache

prompts/coach/
├── v1.txt
└── CHANGELOG.md

public/
└── stockfish.wasm                      # lazy chunk
```

## 10. Size budget

- Base trainer bundle gzip delta: ≤ 30 kB (Article 11).
- Stockfish wasm chunk: ~ 1.5 MB gzip — separate lazy chunk, loaded on first Coach invocation only.
- LLM SDK code: tree-shaken; Anthropic + OpenAI SDKs only load when their respective provider is selected at runtime.

---

# Phase 4b design (ARCHITECTURE SKETCH)

## Interfaces

```ts
// TS-side wrapper (calls Pyodide or backend)
export interface FeatureExtractor {
  extract(fen: string, engine?: EngineAnalysis): Promise<PositionFeatures>;
}
```

```py
# Python implementation
class FeatureExtractor:
    def extract(self, fen: str, engine: EngineAnalysis | None = None) -> PositionFeatures:
        board = chess.Board(fen)
        return {
            "fen": fen,
            "development": self._development(board),
            "center_control": self._center_control(board),
            "king_safety": self._king_safety(board),
            "space": self._space(board),
            "tempo": self._tempo(board),
            "pawn_structure": self._pawn_structure(board),
            "open_files": self._open_files(board),
            "diagonals": self._diagonals(board),
            "weak_squares": self._weak_squares(board),
            "outposts": {
                "white": self._outposts(board, chess.WHITE),
                "black": self._outposts(board, chess.BLACK)
            },
            "piece_activity": self._piece_activity(board),
            "pinned": self._pinned(board),
            "overloaded": self._overloaded(board),
            "discovered_attack_candidates": self._discovered_candidates(board),
            "x_ray_candidates": self._x_ray_candidates(board),
            "trapped_pieces": self._trapped(board),
            "bishop_pair": {
                "white": self._bishop_pair(board, chess.WHITE),
                "black": self._bishop_pair(board, chess.BLACK)
            },
            "knight_outposts": {
                "white": self._knight_outposts(board, chess.WHITE),
                "black": self._knight_outposts(board, chess.BLACK)
            }
        }
```

## Algorithm pseudo-code

```py
def _outposts(self, board: chess.Board, color: chess.Color) -> list[str]:
    half = range(chess.A5, chess.H8 + 1) if color == chess.WHITE else range(chess.A1, chess.H4 + 1)
    res = []
    for sq in half:
        if not self._pawn_defends(board, sq, color): continue
        if self._pawn_could_attack(board, sq, not color): continue
        res.append(chess.square_name(sq))
    return res

def _pawn_defends(self, board, sq, color) -> bool:
    return any(
        board.piece_at(attacker_sq) and
        board.piece_at(attacker_sq).piece_type == chess.PAWN and
        board.piece_at(attacker_sq).color == color
        for attacker_sq in board.attackers(color, sq)
    )

def _pawn_could_attack(self, board, sq, enemy_color) -> bool:
    file = chess.square_file(sq)
    rank = chess.square_rank(sq)
    direction = -1 if enemy_color == chess.WHITE else +1
    for f in (file - 1, file + 1):
        if 0 <= f <= 7:
            for r in range(rank + direction, 0 if direction < 0 else 8, direction):
                pc = board.piece_at(chess.square(f, r))
                if pc and pc.piece_type == chess.PAWN and pc.color == enemy_color:
                    return True
                if pc: break
    return False

def _pawn_structure(self, board: chess.Board) -> dict:
    return {
        "doubled": self._doubled(board),
        "isolated": self._isolated(board),
        "backward": self._backward(board),
        "passed": self._passed(board),
        "candidate_passers": self._candidate_passers(board),
        "pawn_islands": {
            "white": self._islands(board, chess.WHITE),
            "black": self._islands(board, chess.BLACK)
        }
    }
```

## JSON output schema

See `PositionFeatures` JSON in requirements.md (Phase 4b section).

## Golden-test approach

`evals/features/golden/<feature>.json`:

```json
{
  "feature": "outposts",
  "positions": [
    {
      "fen": "r1bqkb1r/pp2pppp/2n2n2/3pp3/8/2N2NP1/PPPPPPBP/R1BQK2R w KQkq - 0 5",
      "expected": { "white": ["d5"], "black": ["d4"] }
    },
    ...
  ]
}
```

CI runs `pytest evals/features/test_golden.py` which loops every golden fixture.

## Dependencies

- Engine output (optional) for activity heuristics.
- Pyodide runtime OR FastAPI backend.

## Risks

- python-chess pin detection is correct; over-eager backward-pawn detection is the typical bug.
- Pyodide size; consider pure-TS reimplementation if Pyodide >10 MB on cold load.

---

# Phase 4c design (ARCHITECTURE SKETCH)

## Interfaces

```ts
export interface PositionClassifier {
  classify(features: PositionFeatures, fen: string): PositionClassification;
}

export interface MotifDetector {
  detect(input: {
    fen: string;
    engine: EngineAnalysis;
    features: PositionFeatures;
    sideToMove: 'w' | 'b';
  }): Motif[];
}
```

## Pseudo-code

```py
def classify(features, fen) -> PositionClassification:
    type_ = "open" if classify_open(features) else "closed" if classify_closed(features) else "semi-open"
    pawn_classes = []
    board = chess.Board(fen)
    for cls, fn in [("iqp", classify_iqp), ("carlsbad", classify_carlsbad),
                    ("hedgehog", classify_hedgehog), ("maroczy", classify_maroczy),
                    ("hanging-pawns", classify_hanging_pawns)]:
        if fn(board, features): pawn_classes.append(cls)
    return {
        "type": type_,
        "sharpness": classify_sharpness(features, engine),
        "pawn_structure": pawn_classes,
        "king_situation": classify_king_situation(board),
        "confidence": 0.85   # heuristic stub
    }

def detect_fork(board, side) -> list[Motif]:
    out = []
    for sq, piece in board.piece_map().items():
        if piece.color != side: continue
        targets = [t for t in board.attacks(sq)
                   if (q := board.piece_at(t)) and q.color != side
                   and piece_value(q) >= piece_value(piece)]
        if len(targets) >= 2:
            out.append({
                "kind": "fork",
                "squares": [chess.square_name(sq)] + [chess.square_name(t) for t in targets],
                "pieces": [piece_str(board, sq)],
                "description": f"{piece_str(board, sq)} forks {len(targets)} pieces",
                "confidence": 0.95
            })
    return out

def detect_minority_attack(board, classification) -> list[Motif]:
    if "carlsbad" not in classification["pawn_structure"]: return []
    # White's queenside pawns are fewer; look for b2-b4 or b4-b5 push intentions
    white_qside = count_pawns_on_files(board, chess.WHITE, [chess.A, chess.B, chess.C])
    black_qside = count_pawns_on_files(board, chess.BLACK, [chess.A, chess.B, chess.C])
    if white_qside < black_qside and b_pawn_can_advance(board, chess.WHITE):
        return [{"kind": "minority-attack", ...}]
    return []
```

## Schemas

```json
{
  "classification": {
    "type": "semi-open",
    "sharpness": "tactical",
    "pawn_structure": ["iqp"],
    "king_situation": "opposite-side-castled",
    "confidence": 0.82
  },
  "motifs": [
    { "kind": "pin", "squares": ["f3","g4"], "pieces": ["Nf3","Bg4"], "description": "Bg4 pins Nf3 to Qd1", "confidence": 0.99 },
    { "kind": "minority-attack", "squares": ["b2","b4","b5"], "pieces": ["b2"], "description": "White prepares queenside minority attack", "confidence": 0.72 }
  ]
}
```

## Dependencies

- 4b (features).

## Risks

- Carlsbad/Catalan disambiguation.
- Sharpness thresholds engine-depth-dependent — must accept the preset name to scale.

---

# Phase 4d design (ARCHITECTURE SKETCH)

## Interfaces

```ts
export interface SemanticTagger {
  tag(input: {
    features: PositionFeatures;
    classification: PositionClassification;
    motifs: Motif[];
    engine: EngineAnalysis;
    candidateMove: string;
  }): MovePurpose[];
}

export interface PlanExtractor {
  extract(input: {
    engine: EngineAnalysis;
    classification: PositionClassification;
    fen: string;
  }): Plan[];
}

export interface OpeningKG {
  lookup(fen: string): OpeningKGNode | null;
  transpositionsOf(fen: string): string[];   // alternate FENs reaching same node
}
```

## Pseudo-code

```py
def tag(features, classif, motifs, engine, move_san) -> list[MovePurpose]:
    tags: set[MovePurpose] = set()
    if "iqp" in classif["pawn_structure"]:
        if is_pawn_break(move_san, "d4-d5"): tags.add("execute_break")
        if to_outpost(move_san, features["outposts"]["white"]):
            tags.add("control_key_square")
    if "hedgehog" in classif["pawn_structure"]:
        if move_san in ("b5", "d5"): tags.add("pawn_break_central")
    if any(m["kind"] == "minority-attack" for m in motifs):
        if is_b_or_a_pawn_push(move_san): tags.add("pawn_break_minority")
    if is_development(move_san, features): tags.add("development")
    if creates_threat(move_san, motifs): tags.add("tactical_threat")
    if is_prophylactic(move_san, motifs, engine): tags.add("prophylaxis")
    return list(tags)

def extract_plan(engine, classif, fen) -> Plan:
    top_pv = engine["pvs"][0]["moves"][:12]
    steps = []
    for san in top_pv:
        purpose = tag_single_move(san, features, classif, motifs)
        steps.append({"san": san, "purpose": purpose[0] if purpose else "development"})
    return {
        "name": _name_plan(steps, classif),
        "steps": steps,
        "success_condition": _condition_for(classif),
        "estimated_plies": len(steps)
    }
```

## Opening KG schema

```json
{
  "node_id": "B07-pirc-classical-after-Be2",
  "fen_hash": "0x9a3b...",
  "fen_examples": ["rnbqk2r/pp..."],
  "eco": "B07",
  "family": "Pirc",
  "variation": "Classical",
  "named_plans": [
    {
      "name": "Kingside attack",
      "steps": [
        {"san": "Qd2", "purpose": "prepare_break"},
        {"san": "O-O-O", "purpose": "king_safety"},
        {"san": "h4", "purpose": "pawn_break_minority"},
        {"san": "h5", "purpose": "execute_break"}
      ],
      "success_condition": "open h-file vs kingside-castled black",
      "estimated_plies": 8
    }
  ],
  "typical_pawn_breaks": ["e4-e5", "f2-f4-f5", "h2-h4-h5"],
  "characteristic_pieces": ["g7-bishop"],
  "transposition_targets": ["0x4dc1...", "0xc92a..."]
}
```

Storage: `data/opening_kg/kg.json` (~ 2–5 MB) generated by `scripts/build_kg.py` from Phase 1b explain blocks, Phase 2 key_squares, Phase 1c family metadata, and hand-curated named_plans.

## Counterplay identification

```py
def identify_counterplay(engine, classif) -> CounterplayKind:
    opp = engine["pvs"][0]["moves"][1:5]
    if any(is_kingside_pawn_advance(m) for m in opp): return "kingside_attack"
    if any(is_central_break(m) for m in opp): return "central_break"
    if any(is_queenside_pawn_storm(m) for m in opp): return "queenside_storm"
    if any(is_exchange(m) for m in opp): return "exchange_to_draw"
    return "no_clear_counterplay"
```

## Dependencies

- 4b + 4c outputs.

## Risks

- Taxonomy drift; freeze the enum and require an amendment to extend.
- KG transposition keys must include castling rights + en passant square or false matches occur.

---

# Phase 4e design (ARCHITECTURE SKETCH)

## Grounded prompt builder

```ts
export class GroundedPromptBuilder {
  build(ctx: CoachContext, userQuestion: string | undefined, skill: SkillMode): PromptPayload {
    const tpl = TEMPLATES[ctx.classification!.pawn_structure[0] ?? 'default'][skill];
    return {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: render(tpl, {
        engine_block: renderEngine(ctx.engine),
        features_block: renderFeatures(ctx.features!),
        class_block: renderClassification(ctx.classification!),
        motifs_block: renderMotifs(ctx.motifs!),
        tags_block: renderTags(ctx.semanticTags!),
        plan_block: renderPlan(ctx.plan!),
        kg_block: renderKG(ctx.kgNode),
        user_question: userQuestion ?? "Why is this the best move?",
        cap_words: SKILL_RULES[skill].capWords,
        skill_mode: skill
      })
    };
  }
}
```

## Sample prompt fragment (IQP, intermediate)

```
[SYSTEM]
You are a chess coach. You may discuss only facts present in the
sections below. If a fact you'd like to share is not in the sections,
say "the engine doesn't justify a deeper claim here" instead.

[ENGINE_OUTPUT]
Best: Nd5  (+0.42 at depth 20)
PV 1: Nd5 Bxd5 exd5 Nb8 c4 ...
PV 2: Qd3 Qd7 ...

[EXTRACTED_FEATURES]
Outposts (white): [d5]
Weak squares (black): [d5, e6]
Bishop pair: white=false black=true

[POSITION_CLASS]
Type: semi-open · Sharpness: positional · Pawn-structure: iqp

[MOTIFS]
• outpost-installation at d5

[SEMANTIC_TAGS for candidate move Nd5]
[control_key_square, exploit_weakness]

[PLAN]
"Knight to d5, exchange light-squared bishop, fix the IQP weakness."

[USER_QUESTION]
Why is Nd5 the best move?

[RESPONSE_RULES]
- Skill mode: intermediate. Cap 100 words.
- You MAY only reference items present above.
- Use SAN.
- Output JSON: { "prose": str, "tags_cited": [...], "motifs_cited": [...], "features_cited": [...] }
```

## Hallucination post-validator

```ts
function validate(resp: ParsedLLMResponse, ctx: CoachContext): { ok: boolean; reason?: string } {
  for (const tag of resp.tags_cited) {
    if (!ctx.semanticTags?.includes(tag)) return { ok: false, reason: `tag ${tag} not in input` };
  }
  for (const motif of resp.motifs_cited) {
    if (!ctx.motifs?.some(m => m.kind === motif)) return { ok: false, reason: `motif ${motif} not in input` };
  }
  for (const feat of resp.features_cited) {
    if (!featurePresent(feat, ctx.features!)) return { ok: false, reason: `feature ${feat} not in input` };
  }
  return { ok: true };
}
```

On failure: one retry with `temperature -= 0.2`; on second failure, downgrade to engine-only render.

## Explanation ranking

```ts
async function rank(candidates: ParsedLLMResponse[], judge: LLMClient): Promise<ParsedLLMResponse> {
  const judgePrompt = JUDGE_TEMPLATE.replace('{{candidates}}', JSON.stringify(candidates));
  const verdict = await judge.complete({ systemPrompt: '', userPrompt: judgePrompt, maxTokens: 200 });
  const winnerIndex = parseInt(verdict.text.match(/winner:\s*(\d)/)![1]);
  return candidates[winnerIndex];
}
```

## Skill modes

```ts
const SKILL_RULES: Record<SkillMode, { capWords: number; defineJargon: boolean; tone: string }> = {
  beginner:     { capWords: 60,  defineJargon: true,  tone: "Define one chess term inline if used." },
  intermediate: { capWords: 100, defineJargon: false, tone: "Standard vocabulary." },
  advanced:     { capWords: 80,  defineJargon: false, tone: "Terse. Cite squares only." }
};
```

Each `(pawnStructureClass, skillMode)` pair has a tailored template — IQP-beginner ≠ Hedgehog-advanced.

## Visual highlights

```ts
// shared with Phase 1.5 / 2 — Article 15
<HighlightLayer
  arrows={motifs.flatMap(m => motifToArrows(m))}
  squares={[
    ...features.outposts.white.map(s => ({ square: s, color: 'blue' })),
    ...features.weak_squares.black.map(s => ({ square: s, color: 'yellow' }))
  ]}
  icons={planIcons(plan)}
/>
```

## "Why not this move?" comparison

```ts
async function whyNot(altSan: string, currentCtx: CoachContext): Promise<ComparisonResult> {
  const altCtx = await pipeline.run({ ...currentCtx.input, candidateMove: altSan });
  return {
    best: currentCtx,
    alt: altCtx,
    evalDelta: currentCtx.engine.pvs[0].scoreCp - altCtx.engine.pvs[0].scoreCp,
    featureDelta: diffFeatures(currentCtx.features!, altCtx.features!),
    tagDelta: diffTags(currentCtx.semanticTags!, altCtx.semanticTags!)
  };
}
```

## Surfaces

- **Surface A** — same modal as 4a, layered panels (engine / features / semantic / prose), collapsible sections.
- **Surface B** — Phase 3 OOB list `Ask Coach` button. Pipeline runs on `(fen_before, played_san)` AND `(fen_before, book_san)`. Comparison view (same `WhyNot` primitive).
- **Surface C** — sidebar drawer, streaming chat, position-change notices inline.

## Eval harness

```
evals/coach/
├── retrieval/
│   ├── run.py
│   ├── gold.json                # ≥30 (fen, expected_kg_node_ids[], expected_explain_block_ids[])
│   └── results/<timestamp>.csv
├── answers/
│   ├── run.py
│   ├── scenarios.json           # 50 (fen, surface, user_question?, expected_facts)
│   ├── judge_prompt.v1.txt
│   └── results/<timestamp>.json
└── hallucination/
    └── run.py                   # 100% citation-in-input gate
```

Targets:

- Retrieval `hit@3 ≥ 0.85`.
- Faithfulness `≥ 0.9`, helpfulness `≥ 4.0` (judge).
- Hallucination = 0 (post-validator gate).

CI-blocking on PRs touching `prompts/coach/`, `LLMClient`, `CoachContextBuilder`, or the symbolic layers.

## Risks

- LLM ignores the "only cited facts" rule — mitigated by JSON output + post-validator + retry.
- Judge prompt bias — periodic cross-check with OpenAI judge.
- Template explosion `(class × skill)` — compose from partials.

---

## Common pitfalls (across layers)

| Layer | Typical bug |
|---|---|
| 4a engine | UCI ↔ SAN conversion drops promotion pieces |
| 4a LLMClient | API key logged accidentally in dev console |
| 4a cache | Cache key omits preset → stale entry served after preset change |
| 4b feature | Backward-pawn detection over-fires on rim files |
| 4b feature | Outpost detection forgets en passant target square |
| 4c classifier | Carlsbad false-positive on Catalan with c-file pawn |
| 4c motif | Fork detector counts same-color forks (false hits) |
| 4d tagger | "development" tag attached to mid-middlegame minor-piece moves |
| 4d KG | FEN hash key omits castling rights → false transposition matches |
| 4e prompt | Skill-mode template grew to handle a position class with N=0 examples |
| 4e validator | LLM cites a tag with different casing → must normalize before compare |

---

## MVP vs advanced roadmap

| Capability | 4a (build) | 4b | 4c | 4d | 4e |
|---|---|---|---|---|---|
| Stockfish PVs in surface | yes | yes | yes | yes | yes |
| Feature extraction | — | **add** | yes | yes | yes |
| Position classification | — | — | **add** | yes | yes |
| Motif detection | — | — | **add** | yes | yes |
| Semantic tags | — | — | — | **add** | yes |
| Plan extraction | — | — | — | **add** | yes |
| Opening KG | — | — | — | **add** | yes |
| Grounded prompt | — | — | — | — | **add** |
| Hallucination block | — | — | — | — | **add** |
| Skill modes | — | — | — | — | **add** |
| "Why not this move?" | — | — | — | — | **add** |
| Visual highlights | — | — | — | — | **add** |
| Surface A (in-drill Why) | **yes** | yes | yes | yes | yes |
| Surface B (OOB Ask Coach) | — | — | — | — | **add** |
| Surface C (free-form chat) | — | — | — | — | **add** |
| Retrieval eval CI | — | — | — | — | **add** |
| Answer eval CI | — | — | — | — | **add** |

---

## Scaling considerations

- **Engine cost** — Stockfish is cheap per analyze; depth 20 ~ 1.5s on a laptop. For Surface C chat where many positions may be analyzed in quick succession, the worker queues requests sequentially and cancels in-flight on new request (`stop()`).
- **LLM token cost** — Anthropic Haiku 4.5 ~ $0.80 input / $4 output per 1M. Surface A prompt ≈ 1.5 k input + 200 output → ~$0.0008 per invocation. Surface C is a multi-turn chat; project ~$0.02 / 10-turn session.
- **Caching** — 4a uses in-memory keyed by `(lineId, plyIndex, preset, model)`. 4e adds IndexedDB cache with TTL (24 h) for repeated demo positions.
- **Eval set growth** — start at 30 retrieval + 50 answer scenarios; budget 10 new scenarios per sub-phase shipped to track regressions.
- **Symbolic layer cost** — feature extraction ~10 ms / position in python-chess; classification + motifs ~5 ms. Per-position pipeline (engine + symbolic + LLM) ~3 s end-to-end at Balanced preset; acceptable for Surface A click latency.

---

## Eval thresholds per sub-phase

| Sub-phase | Quantitative gate |
|---|---|
| 4a | 5 engine integration tests pass; engine-only degraded mode test passes; bundle gzip delta ≤ 30 kB; 10-position manual walkthrough completed (qualitative; no hard threshold). |
| 4b | 100% of golden feature fixtures pass; feature extractor ≤ 30 ms / position p95 on mid-range laptop. |
| 4c | Classifier accuracy ≥ 0.85 on a 100-position labeled set covering 5 pawn structures; motif precision ≥ 0.9 on a 50-position labeled motif set. |
| 4d | Tagger precision ≥ 0.9 on a 100-position labeled tag set; KG covers ≥ 50 openings; transposition false-match rate = 0 on a 30-pair test. |
| 4e | Faithfulness ≥ 0.9; helpfulness ≥ 4.0; hallucination = 0; retrieval hit@3 ≥ 0.85. All CI-blocking. |

---

## Constitution compliance (design-level checks)

- **Article 3** — `eslint-plugin-import` rule `no-restricted-imports` blocks `langchain`, `@langchain/*`, `llamaindex`, `crewai`. CI gate.
- **Article 4** — 4e's RAG + symbolic eval harness is the "real model work" deliverable. 4a is staged baseline, explicitly labeled in the UI.
- **Article 5** — all 9 interfaces enumerated above. DI container at `src/coach/container.ts` wires concretes.
- **Article 9** — SAN is the lingua franca; UCI is confined to the worker boundary in `StockfishWasmEngine`.
- **Article 11** — every layer optional; `CoachPipeline.run` returns whichever subset of fields the active layers produced; surface renders accordingly.
- **Article 12** — Pyodide path keeps Python features in-browser; FastAPI is a fallback, not a requirement.
- **Article 13** — 4a hard-capped at 2 weekends; 4b–4e off the schedule until main plan permits.
- **Article 14** — TS strict; Python type hints; Ruff + ESLint required CI.
- **Article 15** — Highlights reuse `<HighlightLayer>`.
- **Article 16** — All optional Python services (Pyodide first, FastAPI backend second) remain `docker compose up` friendly.
