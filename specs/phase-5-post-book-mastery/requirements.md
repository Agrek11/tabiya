# Requirements: Phase 5 — Post-Book Mastery & Closed-Loop Training

## What Phase 5 is

The trainer learns from the user's REAL games and feeds the fixes back into
spaced repetition. Sync a game → find where it left book, where it leaked, what
blundered → drill the corrections, review the game, scout the next opponent.
This is the closed loop that turns Tabiya from an opening drill into a coach.

Naming note: the earlier "Phase 5 = public deploy" is renamed **Phase 6 —
Launch** (Cloudflare). This Phase 5 is the feature phase.

## Moat principle (LOCKED 2026-06-17 — applies project-wide)

**Tabiya never rebuilds commodity infra (game storage, game search, ratings,
databases). It is an analysis/coaching layer on top of public data.** Every
feature must earn its place by what the deterministic feature engine + LLM
scribe ADD — not by re-storing or re-searching data that lichess/chess.com/
chessbase already serve. Fetch public data live, run it through OUR engine,
present insight nobody else generates. (Consistent with Phase 3's "no
server-side game storage; re-syncable from source.")

## Hard prerequisite

5a, 5d, A', B', 5e all analyze OFF-BOOK (arbitrary) positions from real games.
That requires the **runtime feature extractor (universal coach,
requirements-universal-coach.md)** — the TS port of the build-time extractor,
parity-locked to the golden fixtures. **Build that FIRST.** Until it ships,
Phase 5's analysis features cannot run on synced-game positions.

Also needed: **per-position engine eval over arbitrary FENs** — already have
(Stockfish WASM analyzes any position). The one engine extension: evaluate a
SPECIFIC played move (UCI `searchmoves`) to measure its centipawn loss vs best,
since a blunder is usually not in the top-3 multipv. Small worker addition.

## Tiering (build order)

```
TIER 1 — the closed loop (ONE shared eval pass over the post-book window):
  5a Ghost Blunders   · 5d Leak Detector · A' Interactive Game Review
TIER 2 — differentiation:
  B' Opponent Scouting · C Blunder DNA   · D Structure-First Training
TIER 3 — cheap UX:
  5f-light Silent Coach · 5c Transposition Roulette
TIER 4 — later / redesign:
  5b Stress Test (redesign difficulty) · 5e Feature-Tag Search
DROPPED: E Shaky-knowledge SRS
```

The Tier-1 trio share ONE analysis pass: for each synced game, eval the window
from book-exit forward; that single pass simultaneously yields blunders (5a),
mean-centipawn-loss (5d), and the per-move data the review viewer renders (A').
Build the pass once.

---

## TIER 1 (detailed)

### 5a — Ghost Blunders (auto-SRS injection)

**Goal:** capture real tactical mistakes near book and inject corrective drills
into the Leitner SRS queue.

1. During/after sync, at the OOB divergence (and within a scope window — see
   AC6), eval the user's played move vs the engine best. If centipawn loss
   Δ ≥ 150 (or a shift to/from forced mate), flag a blunder.
2. Synthesize a **GhostLine**: anchor to the nearest parent `line.id`; main path
   plays the engine's correct move; the user's actual move is attached as an
   inline `ForkAnnotation` (the existing Line shape) so the drill shows
   "you played X — the move is Y."
3. Persist to a new IndexedDB store `ghost_lines` (DB v4, additive migration)
   and initialize its SRS record in Box 1.
4. Ghost lines drill through the EXISTING drill loop + SRS engine; the UI marks
   them as "from your games" and lets the user dismiss one (removes the line +
   its SRS record).
5. Determinism: same game + same repertoire → same ghost lines.
6. **Scope guard (non-negotiable):** ghost lines are created ONLY for
   divergences within **N plies of book exit** (default N=6) AND where the
   correct move is a single clear improvement (not a deep multi-move tactic).
   A deep middlegame blunder where the fix is a 4-move combination does NOT
   become a drill — memorizing one out-of-context engine move teaches nothing.
   Those route to 5d (leak stats) instead.

### 5d — Leak Detector (post-book MCL)

**Goal:** measure strategic drop-off right after book and flag leaky variations.

1. For each synced game, scan the window of `divergence_ply` → +10 plies.
2. Compute Mean Centipawn Loss across the window (reuses the 5a eval pass).
3. Aggregate MCL by `variationId`. A variation with average post-book
   MCL ≥ 50 over the last ≥5 games is a **Structural Leak**.
4. Surface: flag the variation node (amber/red) on the repertoire/dashboard;
   link to the structure's plans (4d KG when it lands; until then, link to the
   classification facts).
5. Compute is the constraint — eval over many games × 10 plies in browser WASM
   is heavy. MUST be a background, cancellable, cached queue (per-game results
   memoized by game id + engine preset). Never blocks the UI.

### A' — Interactive Game Review

**Goal:** a navigable replay of a synced game with analysis alongside — NOT a
static narrated page.

1. Route `/review/:gameId`. Board on the left, navigable move-by-move
   (←/→/click); eval graph across the game; markers for book-exit, each
   blunder (5a), and the leak window (5d).
2. Side panel per selected ply: engine eval + the deterministic facts/motifs/
   classification for that position + (when configured) a one-paragraph LLM
   narration of that moment, grounded by the facts (prompt v2 path).
3. Reuses the runtime extractor + the shared eval pass; LLM narration is
   per-ply, lazy (only for the ply in view), cached.
4. Read-only; no SRS/repertoire mutation. "Add this mistake to drills" CTA
   reuses 5a injection.

---

## TIER 2 (outline)

### B' — Opponent Scouting (live-fetch + our layer, NO database)

Fetch an opponent's PUBLIC games on demand (the chess.com/lichess APIs already
called in Phase 3 — by username, no auth for public data), run them through
OUR feature/motif/leak aggregation, produce a scouting brief: pet lines (move
frequencies), where they leave book, recurring leak structures, tactical
weaknesses. **No games DB** — fetch, analyze, present, light-cache; the value
is OUR deterministic profile, not data storage (moat principle). Tier 2.

### C — Blunder DNA

Cluster the user's accumulated ghost-blunder positions by their motif/feature
tags → "you hang pieces to pins 60%," "you miss back-rank ideas." Nearly free
on top of 5a data (the tags are already computed). A meta-insight panel.

### D — Structure-First Training

Drill by pawn-structure (4c.2 classification) across openings — "all your IQP
positions," "all your Carlsbad." Teaches transferable understanding.
**Lives on a separate "Personal Training" page — it does NOT replace or alter
the open-drill home, which stays Tabiya's main feature.**

---

## TIER 3 (cheap UX)

### 5f-light — Silent Coach (ambient hover ticker)

Hover/drag a piece → a one-line ticker under the board shows the
deterministic fact keyed to that square (reuses Phase 2 `key_squares` +
4b outposts/weak-squares). Debounced; precomputed/templated from facts (NO
per-hover LLM call — too slow/costly). Full per-square semantic sentences are
a 4d enhancement; the light version ships on existing facts.

### 5c — Transposition Roulette

Use the existing transposition index to drill a known position reached via an
alternate move order; on failure, contrast the move orders (same structure,
same plan). Content-limited to catalog transpositions (~85 shared positions).

---

## TIER 4 (later)

### 5b — Stress Test (sparring) — REDESIGN REQUIRED

Play a chosen variation vs the engine for ~10 plies past book. **Difficulty
must NOT be peak Stockfish** (3600 Elo crushes everyone → demoralizing). Cap
strength (UCI_LimitStrength ~2000–2200) and make the win condition "stay above
−1.5 / don't blunder," not "beat the engine." Biggest build (a new
play-vs-engine loop). Decide after Tier 1–2.

### 5e — Feature-Tag Search

NOT a generic game search (commodity — lichess/chess.com already do it). ONLY
the dimension public sites lack: query your synced games by OUR deterministic
tags (`IQP + knight-fork + Caro-Kann`). Thin, post-runtime-extractor. Stores
feature tags per (gameId, ply) in an IndexedDB store; multi-select filter UI.

---

## Schema additions (IndexedDB v4, additive migration)

- `ghost_lines` (keyPath `id` = `ghost:${parentLineId}:${gameId}:${ply}`):
  `{ id, parentLineId, gameSource, gameId, divergencePly, fen, correctMoveSan,
     blunderMoveSan, cpLoss, createdAt }`. SRS records reuse the existing store.
- `game_analysis` (keyPath `gameId`): memoized eval pass —
  `{ gameId, enginePreset, bookExitPly, perPly: [{ply, evalCp, cpLoss}],
     mcl, blunders: [...], analyzedAt }`. Powers 5a/5d/A' without re-eval.
- (5e, later) `position_tags` (keyPath `[gameId, ply]`): serialized feature
  flags for tag search.

## Constitution

- Article 4 — every analysis layer is deterministic + fixture/eval-backed; LLM
  only scribes grounded facts.
- Article 5 — ghost lines / analysis behind repositories; surfaces use the
  existing drill loop + SRS engine + FeatureExtractor seam.
- Article 11 — all analysis in-browser (IndexedDB + WASM); background eval
  queue never blocks; degrades if engine/extractor unavailable.
- Article 12 — no backend; public-data fetch is direct (Phase 3 CORS path).
- Article 13 — weekend pace; Tier 1 is the commit, Tiers 2–4 are backlog.

## Out of scope

- Server-side game storage / accounts / multi-device sync (Phase 7).
- Generic game search or a games database (commodity — moat principle).
- Real-time / live-game tracking.
- Full per-square semantic narration (4d).

## Open questions

1. Eval-pass depth for the post-book window — Fast preset (depth 12) for speed
   vs Balanced (depth 20) for MCL accuracy? Bias: Fast for the bulk scan,
   re-eval flagged blunders at Balanced.
2. Ghost-line scope window N (default 6) — tune against real synced games.
3. Leak threshold (MCL ≥ 50 over 5 games) — tune; expose nothing until enough
   games exist to be statistically meaningful.
4. Where the eval queue runs when many games sync — throttle/coalesce policy.
