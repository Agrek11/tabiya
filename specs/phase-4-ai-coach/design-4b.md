# Design: Phase 4b — Precomputed Feature Extraction

Requirements: `requirements-4b.md`. Build-time Python (`python-chess`) inside
the catalog pipeline → `public/features.json` sidecar keyed by normalized-FEN
sha1-16 (reuses `tabiya_build.transposition.fen_hash`) → runtime TS lookup
behind the `FeatureExtractor` interface → prompt v2 grounding.

## Module map

```
scripts/tabiya_build/features/
├── __init__.py
├── extract.py        # extract_features(board) -> PositionFeatures dict
├── material.py       # group 1
├── pawns.py          # group 2
├── king_safety.py    # group 3
├── center_space.py   # group 4
├── files_diagonals.py# group 5
├── activity.py       # group 6
├── tactics_geometry.py # group 7
└── sidecar.py        # walk lines -> {fen_hash: features}, write JSON

src/coach/features/
├── PositionFeatures.ts      # TS types mirroring the JSON schema
├── FeatureExtractor.ts      # interface (Article 5)
├── SidecarFeatureExtractor.ts # lazy-load public/features.json, map lookup
└── renderFeaturesBlock.ts   # PositionFeatures -> compact prose block for prompt v2

prompts/coach/v2.txt          # grounded template
evals/features/golden/*.json  # per-feature fixtures
tests/python/features/        # pytest: golden runner + unit tests
```

`extractor_version` constant lives in `extract.py`; bump = full recompute.

## PositionFeatures schema (JSON, per position)

```jsonc
{
  "version": 1,                       // extractor_version
  "material": {
    "balance_cp": 0,                  // +white, P=100 N=B=300 R=500 Q=900
    "imbalance": "none",              // e.g. "R+P vs B+N", "B vs N"
    "bishop_pair": { "white": true, "black": false }
  },
  "pawns": {
    "doubled":   { "white": ["c3","c4"], "black": [] },
    "isolated":  { "white": ["d4"], "black": [] },
    "backward":  { "white": [], "black": ["d6"] },
    "passed":    { "white": [], "black": [] },
    "candidate_passers": { "white": ["b4"], "black": [] },
    "islands":   { "white": 2, "black": 3 },
    "chains":    { "white": [{"base":"d4","head":"e5"}], "black": [] },
    "majorities": { "queenside": "white", "kingside": "black", "center": null },
    "iqp": null,                      // "white" | "black" | null
    "hanging_duo": null               // "white" | "black" | null
  },
  "king_safety": {
    "white": { "castled": "short", "shield": "intact",
               "adjacent_open_files": [], "adjacent_half_open_files": [],
               "king_zone_attackers": 0 },
    "black": { "castled": "none", "shield": "n/a",
               "adjacent_open_files": [], "adjacent_half_open_files": ["e"],
               "king_zone_attackers": 2 }
  },
  "center_space": {
    "center_occupancy": { "d4":"white_pawn", "e4":"white_pawn", "d5":null, "e5":"black_pawn" },
    "center_attacks":   { "white": 6, "black": 4 },   // attacks on d4/e4/d5/e5
    "space":            { "white": 14, "black": 9 },  // pawn-attacked squares in enemy half
    "locked_center": false
  },
  "files_diagonals": {
    "open_files": ["c"],
    "half_open":  { "white": ["d"], "black": ["e"] },
    "rooks_on_open":      { "white": ["Rc1"], "black": [] },
    "rooks_on_half_open": { "white": [], "black": ["Re8"] },
    "rook_on_seventh":    { "white": [], "black": [] },
    "long_diagonals": { "a1h8": "contested", "h1a8": "white" }
  },
  "activity": {
    "mobility": { "white": {"N":[3,5], "B":[7], "R":[2,4], "Q":[11]}, "black": { } },
    "outposts": { "white": { "occupied": ["Nd5"], "available": [] },
                  "black": { "occupied": [], "available": ["d4"] } },
    "bad_bishop": { "white": null, "black": "c8" },
    "fianchetto": { "white": null, "black": "intact-g7" },
    "trapped":    { "white": [], "black": [] },
    "undeveloped_minors": { "white": 0, "black": 2 },
    "tempo": { "side_to_move": "white", "development_lead": "white+2" }
  },
  "tactics_geometry": {
    "pins": [ { "pinned": "Nf6", "to": "Qd8", "by": "Bg5", "absolute": false } ],
    "xrays": [ { "through": "Nd7", "target": "Qd8", "by": "Rd1" } ],
    "overloaded": [ { "piece": "Nf3", "defends": ["e5","h2"] } ],
    "discovered_candidates": [ { "mover": "Nd4", "battery_piece": "Bb2", "target_line": "a1h8" } ],
    "en_prise": []                    // attacked + underdefended pieces
  }
}
```

Determinism: all arrays sorted (square order a1→h8; objects by primary
square); no timestamps inside entries; `json.dumps(..., sort_keys=True)`.

## Feature definitions (fixture-enforceable)

| Feature | Definition |
|---|---|
| doubled | ≥2 own pawns on one file → all listed |
| isolated | own pawn with no own pawn on adjacent files |
| backward | pawn whose stop-square is attacked by enemy pawn AND no own pawn on adjacent file is on an equal-or-lesser rank (own-perspective); rim files included, fixture-pinned |
| passed | no enemy pawn ahead on same or adjacent files |
| candidate passer | on a file where own pawns ahead-count ≥ enemy pawns ahead-count on adjacent files AND not passed yet (standard candidate rule, fixture-pinned) |
| islands | count of maximal runs of files containing own pawns |
| chain | ≥2 own pawns on a diagonal where each defends the next; base = undefended-by-pawn end |
| majority | wing (a-c / f-h) where own pawn count > enemy's |
| IQP | isolated own pawn on d-file (d4/d5) and no own c/e pawns |
| hanging duo | own pawns side-by-side on half-open files (classically c+d), both without own pawn neighbors elsewhere; fixture-pinned to c/d duo |
| shield intact | all three pawns in front of castled king on their start rank or one square advanced |
| king zone | 3×3 around king + 3 squares two ranks toward enemy; attackers = enemy pieces (not pawns' count duplicated) attacking any zone square |
| space | count of squares in ranks 5-8 (white view) attacked by own pawns |
| locked center | d4/e4/d5/e5 all occupied by pawns AND no legal pawn capture among them |
| open file | no pawns of either color on file |
| half-open (white) | no white pawn, ≥1 black pawn on file |
| rook on 7th | rook on enemy's 2nd rank |
| long diagonal control | side whose pieces attack ≥ N more squares of a1-h8 (resp h1-a8) than opponent; tie = "contested" |
| outpost (available) | square in enemy half defendable by own pawn now AND never attackable by enemy pawn advance |
| outpost (occupied) | knight/bishop currently on an outpost square |
| bad bishop | bishop hemmed by ≥3 of its OWN pawns FIXED on its square color (a pawn is fixed when the square directly ahead is occupied by any piece). The fixed requirement is what stops it firing on the opening, where pawns are still mobile — an undeveloped bishop is not a bad bishop. |
| fianchetto intact | bishop on g2/b2/g7/b7 with its shield pawn structure unbroken |
| trapped | piece (not pawn/king) that is UNDER ENEMY ATTACK and has 0 safe destinations (every reachable square own-occupied, or attacked-and-underdefended). The attack requirement separates trapped from merely undeveloped — a home rook with no moves is passive, not trapped. |
| undeveloped minors | knights/bishops still on home squares |
| development lead | difference in developed minors + castled bonus(=1) |
| pin (absolute) | pinned to king (chess.js/python-chess native) |
| pin (relative) | sliding attacker aligned through one piece to a higher-value piece |
| x-ray | slider aligned to target THROUGH one interposed piece (either color) |
| overloaded | piece that is the SOLE defender of ≥2 attacked own pieces/squares |
| discovered candidate | own piece whose any move opens a slider attack on enemy K/Q/R |
| en prise | piece attacked more times than defended (count comparison only) |

Anything ambiguous in play is resolved BY the golden fixture — the fixture is
the spec of record per Article 4.

## Sidecar build step

```py
def build_features_index(lines: list[Line]) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for line in lines:
        board = chess.Board()
        for san in line.moves:
            board.push_san(san)
            h = fen_hash(board.fen())
            if h not in index:                  # transposition dedupe
                index[h] = extract_features(board)
    return index
```

Wired into `build_catalog.py` after the transposition step, gated by
`--skip-features`. Output `public/features.json`:
`{schema_version: 1, extractor_version, generated_at, index}`.
Incremental cache: previous sidecar consulted; entries reused when
`extractor_version` matches (generated_at excluded from comparison).

## Runtime consumption

```ts
export interface FeatureExtractor {
  extract(fen: string): Promise<PositionFeatures | null>; // null = unknown position
}
```

`SidecarFeatureExtractor`: lazy `fetch('/features.json')` (same pattern as
`storage/transpositions.ts`, schema-version-checked), `fenHash(fen)` lookup.
`CoachPipeline` step 2.5: `features = await extractor.extract(fen)`; non-null
→ render via `renderFeaturesBlock` (compact prose, token-cheap, only
NON-EMPTY facts emitted) → prompt v2; null → prompt v1 path, promptVersion
'v1' (R3.3 degrade).

## Prompt v2 sketch

```
===SYSTEM===
...4a rules, plus:
- A VERIFIED FACTS section lists computed positional facts. Every chess claim
  in your explanation MUST be supported by a listed fact or an engine line.
- If neither facts nor engine lines explain why the move is best, say
  "engine preference — no clear positional reason at this depth."
[3 few-shot examples, fact-grounded + 1 honest-hedge]
===USER===
VERIFIED FACTS
{{features_block}}
ENGINE {{engine_block}}
RECENT {{recent_plies_block}}
```

## Test plan

- pytest golden runner: every `evals/features/golden/*.json` fixture file —
  one file per feature, ≥3 positions (positive / negative / edge).
- Unit tests per module for tricky internals (backward, candidate passer,
  overloaded).
- Determinism test: build sidecar twice on fixture lines → byte-identical.
- TS: `SidecarFeatureExtractor` happy path + miss + schema-mismatch degrade
  (msw-style fetch stub); `renderFeaturesBlock` snapshot for a loaded
  position; pipeline integration: features present → prompt contains
  VERIFIED FACTS and promptVersion v2; absent → v1.
- Eval: `evals/coach/4b-walkthrough.md` — same 10 positions vs 4a baseline.
```
