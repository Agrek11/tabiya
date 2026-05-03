# Features

## Opening Repertoire Trainer (v1)

- Pre-loaded static catalog of ~15-20 popular openings, ~25 lines each (~375-500 lines total)
- One tree per line (linear, no branching)
- Hard depth cap: 20 ply max (16 quiet, 20 sharp, default 18)
- User selects which openings + which lines to add to active repertoire
- Playable board — make moves against expected line
- Green tick on correct move + auto-advance
- Red cross + auto-undo on wrong move
- Hint mode after 2 wrong attempts (show correct move)
- Streak counter per line
- Spaced repetition (Leitner, 5 boxes)
- Per-line stats: attempts, accuracy %, last reviewed, current box
- Stable line IDs across catalog refreshes (SRS state preserved)

## Pattern Visualization Mode (v1.5)

Differentiating feature. Trains visualization, not memorization.

- Toggle in line-review mode: "Visualize Key Squares"
- Pieces fade to ~20% opacity
- Key squares glow with color overlays
- Click highlighted square → tooltip with strategic note
- Catalog stores `key_squares` per line: `[{square, note}]`
- Opening-level defaults + line-specific overrides
- Same primitive feeds AI Coach (Phase 3) — LLM output points to specific squares, UI highlights automatically

## Opening Catalog Build (offline, one-shot)

- Source 1: lichess-org/chess-openings TSV (naming + ECO backbone)
- Source 2: Lichess Opening Explorer API (continuation extension at build time)
- Source 3: Hand-curated `key_squares` + `strategic_notes` per opening / line
- Sharp-line whitelist for deeper drilling
- Output: catalog.json bundled in app
- Re-run script to refresh catalog

## Storage Architecture (v1)

- JSON bundle for catalog
- IndexedDB (`idb` wrapper) for user SRS state
- Repository interface (`OpeningRepository`) abstracts catalog storage
- Plug-and-play swap to SQLite later (v2) without touching consumers

## Lichess + Chess.com Game Sync (Phase 2)

Primary source: Lichess (better free API, no auth pain). Chess.com secondary.

- Pull last N games from public profile via API
- Per-game: parse PGN, classify positions via Stockfish
- **"Out of book by move N" detection** — compare each move vs active catalog repertoire, flag first divergence
- Auto-create drill from divergence position (correct theoretical line)
- General mistake/blunder extraction (CP loss thresholds) for non-opening positions
- Group drills by theme (opening gap, tactical, endgame)
- Backfill historic profile (rate-limited)

## AI Coach (Phase 3)

AI-native, not GPT API wrapper.

- **Middlegame plan recommendations** at end of each opening line: typical pawn breaks, piece placement, tactical motifs. First AI feature target. Reads `end_fen` + `strategic_notes` from catalog.
- **Structural Coach** ("why" explanations on wrong moves and post-line review). Uses RAG over `strategic_notes` + master annotations + position FEN.
- **Pattern Viz integration** — AI explanations point to specific squares; same UI primitive as Phase 1.5 highlights them automatically.
- Position-by-position commentary
- Mistake explanation + alternatives
- Personalized weakness detection across games
- Conversational Q&A on positions

## AI-Native Pillar (pick one — required for resume signal)

- Option A: Fine-tuned small model on personal opening prep + master annotations
- Option B: RAG over annotated game corpus + `strategic_notes` (current lean)
- Option C: Agent that selects tools (Stockfish, opening DB, eval) per question

Decision deferred until Phase 3 (~August 2026).

## Distribution

- Live URL via Vercel/Netlify (frontend static deploy) — casual users
- `docker compose up` for self-hosted full-stack run — power users / privacy / portfolio signal
- Both delivery paths maintained from Phase 0a forward (Constitution Article 16)

## Phase 4 Stretch (post-deploy, only if time)

- **Engine-Stress Testing** — after completing a line, hand the board to Stockfish 17 (WASM). User plays 5 moves vs engine from end-of-line position. Tests understanding, not memorization.
- More AI options (try the 2 not picked from A/B/C)
- Tournament prep mode

## Phase 5+ Stretch (OSS lane synergy)

- **Confidential Containers (CoCo) deployment** — `docker-compose.coco.yml` variant runs full stack in Kata Containers + TEE (Intel TDX or AMD SEV). Confidential AI inference: fine-tuned model + user game data stay encrypted at runtime, even from cloud provider. Demo project for VP-recommended Kata/CoCo OSS lane. Adds resume signal for Type B (AI infra) hiring tier.

## Deferred to v2+

- Dynamic Lichess Explorer API at runtime
- User-uploaded custom PGN repertoires
- Variation branching within lines
- Multi-user / auth
- Mobile app

## Resume-Worthy Requirements (non-features, must ship)

- Public deployment with live URL
- Open source repo with README + architecture diagram + demo GIF
- Quantifiable metrics: games ingested, drills completed, personal rating delta
- 5-10 alpha users beyond self
- Blog post on build + lessons learned
