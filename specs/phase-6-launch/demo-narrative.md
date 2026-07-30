# Tabiya Demo Narrative (Stage 3.2)

Use this script for a 5-8 minute product walkthrough.

## Audience

- Club players who already study openings but want tighter feedback loops.
- Users with Lichess/Chess.com history who want mistake-driven training.

## Story Arc

1. **Start with training loop**
   - Open `/drill`.
   - Show line selection, due queue, and silent coach cue.
   - Complete a short line and show end-of-line summary.
2. **Play it out immediately**
   - Click "Play vs engine" from the summary.
   - Change strength tier mid-game.
   - Show post-move cp-loss feedback in status card.
3. **Connect real games to corrective drills**
   - Open `/games`, then jump to `/review/:gameId`.
   - Show cp-loss trend and ghost candidates.
   - Inject one ghost drill and open it in `/drill`.
4. **Show learning analytics**
   - Open `/insights`.
   - Highlight Blunder DNA, leak signals, and recommendations.
   - Jump to structure training and feature/tag search routes.
5. **Close with coach moat**
   - Use "Why not this move?" panel and show constrained comparison.
   - Explain deterministic facts + engine-first grounding + graceful fallback.

## Key Messages

- Local-first by default; account and provider integrations are additive.
- Deterministic extractor + strict golden parity protects coaching quality.
- Product value is closed-loop correction, not commodity game database replication.

## Pre-Demo Checklist

- `npm run build` passes.
- Stockfish worker loads in browser (COOP/COEP path healthy).
- At least one synced game with review data is present.
- At least one injected ghost drill is available.
- Optional: API key configured for richer coach narration.
