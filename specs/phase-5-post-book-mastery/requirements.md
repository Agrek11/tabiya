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
  F  Weakness-Driven Resource Recommendations (consumes C)
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

### F — Weakness-Driven Resource Recommendations (consumes C)

Map the user's deterministic weakness tags to targeted study resources — ideally
the exact chapter/lesson, e.g. "you leak in IQP middlegames → Sadler, *QGD*,
ch.4"; "Najdorf English Attack OOB → this Chessable course, line 3".

**Hard dependency — DO NOT build before C (Blunder DNA) + 5d (Leak Detector).**
The recommender is only as good as the weakness signal. Until C/5d produce
motif/structure tags, the only signal is OOB-frequency-by-opening (shallow — a
per-opening book list, which is commodity). F consumes C's clustered tags
(`hangs-to-pins`, `mishandles-IQP`, `weak-dark-squares`, …) and 5d's leaky
structures. Both are downstream of the runtime extractor.

**Moat (non-negotiable):** the value is the PERSONALIZED tag→resource mapping
from OUR weakness profile, NOT a generic "popular books per opening" list (that's
commodity — chess forums already do it). Recommend against a specific detected
weakness or it adds nothing.

**Data + constitution:**
- Curated static catalog `scripts/curated/resources.yml` (theme/ECO/structure →
  `{ title, author, chapter, url, license_note }`), bundled → works offline
  (Article 11). Live-fetch optional. Ongoing curation burden (quality, link
  rot, licensing) — same posture as `key_squares/sources.yml`.
- Mapping is DETERMINISTIC (weakness tag → resource); LLM optional only to
  phrase *why* a resource fits (Article 4 — never the source of the match).

**Revenue note (business layer, not now):** affiliate links (Chessable /
Forward Chess / Amazon) are a natural low-friction monetization — less intrusive
than feature gating; fits the hosted-paywall economics. Flagged, not scoped here.

**Surface:** a "Study next" panel on the weakness/insights surface and/or beside
a flagged leaky variation (5d) — links out to the mapped resource. Tier 2.

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

### 5g — Gambit branches / diversions (drill immersion) — idea 2026-06-19

While drilling/explaining a mainline, surface "⚔ Gambit available here" at any
position from which a **gambit-category** line branches — a fun, immersive
divert into a sharper continuation of the *same* opening (e.g. Italian Two
Knights → Fried Liver; Italian → Evans Gambit).

**Mechanism (reuses the moat):** per ply, hash the position → query the Phase-2
transposition index (`fen-hash → lineIds through that position`) → filter the
hits to lines whose family/line is gambit-category → render a chip linking to
`/drill?line=<gambitId>` (or a future in-place branch). Deterministic, no new
infra — just the transposition index + the catalog's gambit tagging.

**Caveats:** (a) coverage — needs gambit lines that actually share early
positions with the drilled mainlines; may require curating a few branch points
into the catalog. (b) the index keys by exact position, so a gambit that
*diverges* (different move) from a shared position is found at the shared node;
a gambit reachable only by a different earlier move order won't show. Tier 3,
post-MVP.

### 5b — Play vs Engine / Stress Test (sparring)

**Entry point (requested 2026-06-19):** from the end-of-line summary, a "Play
this out vs the engine" CTA — once a drill completes, the user keeps playing the
position against Stockfish instead of stopping at book end. (Also reachable as a
standalone "play any position" later, shared with the universal coach surface.)

**Strength tiers** via Stockfish WASM `UCI_LimitStrength` + `UCI_Elo`:

```
Tier        UCI_Elo        notes
Beginner    800            blunders freely
Casual      1200
Club        1700
Strong      2000
Expert      2200
Master+     2500+ (cap)    LimitStrength off above this = full engine
```

A dropdown picks the tier (mirrors the engine-preset pattern). Default to a
mid tier (~1500–1700), not peak — 3600 Elo crushes everyone and demoralizes.

**Win condition** is "stay above −1.5 / don't blunder" or "convert your edge",
NOT "beat the engine" — keeps it instructive, not punishing. Show the eval bar
+ per-move cp-loss feedback (reuses the 5a/5d eval pass) so the user sees where
they slipped.

**Build:** a new interactive play-vs-engine loop (the biggest single Phase-5
build): board accepts user moves, engine replies at the chosen Elo via the
existing Stockfish worker, with resign/restart/take-back. Independent of the
runtime extractor (pure engine play) — could even ship earlier than the
analysis features if prioritized. Tier the difficulty UI first, deepen feedback
(cp-loss, "you could have played X") after.

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
