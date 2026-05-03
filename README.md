# tabiya

Chess opening rep trainer + game analysis + AI coach.

## What It Does

Build and drill a chess opening repertoire, import your Chess.com / Lichess games, and turn your own mistakes into targeted repetition drills. An AI coach explains middlegame plans, weaknesses, and what to study next.

## Pillars

1. **Opening repertoire trainer** — playable per-line drills against your prep, with spaced repetition (Leitner)
2. **Pattern visualization** — toggle to fade pieces and highlight key squares with strategic notes (trains visualization, not memorization)
3. **Game analysis** — import Lichess + Chess.com games, detect "out of book" by move N, auto-generate drills from your mistakes
4. **AI coach** — middlegame plan recommendations from end-of-line FEN, structural "why" explanations, conversational Q&A

## AI Approach

The coach is AI-native, not a thin API wrapper. Candidate approaches under evaluation:

- Fine-tuned small model on personal opening prep + master middlegame annotations
- RAG over annotated game corpus + strategic notes (current lean)
- Agent that selects tools (Stockfish, opening DB) per question

First AI feature target: **middlegame plan recommendations from end-of-line position** (typical pawn breaks, piece placement, tactical motifs).

## Stack

- **Frontend:** React + TypeScript (Vite)
- **Board UI:** [`react-chessboard`](https://github.com/Clariity/react-chessboard) (MIT)
- **Chess logic:** [`chess.js`](https://github.com/jhlywa/chess.js) (BSD) — move validation, FEN/PGN, legal moves
- **Storage v1:** Static JSON catalog bundled with app
- **Storage v2:** SQLite via repository interface (plug-and-play swap)
- **Catalog build:** Python, one-shot — generates from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) TSV + Lichess Opening Explorer API
- **Backend (later):** Python + FastAPI for AI features
- **Distribution:** `docker compose up` (self-hosted) + Vercel/Netlify (live URL)

## Opening Catalog

- Pre-loaded static catalog, no runtime API calls in v1
- ~15-20 popular openings × ~25 lines each = ~375-500 total lines
- One tree per line (linear, no branching)
- Hard depth cap: 20 ply max (default 18, 16 for quiet positional, 20 for sharp tactical)
- Stable line IDs across catalog refreshes (preserves user SRS state)

## Spaced Repetition

Leitner system, 5 boxes (daily → 3 days → 1 week → 2 weeks → 1 month). Wrong answer drops a line back to Box 1.

## Status

Early development. See [features.md](./features.md) for full scope and [specs/](./specs/) for project principles + per-phase requirements.

## Getting Started

TBD — populated when Phase 0a skeleton lands.

## License

See [LICENSE](./LICENSE).
