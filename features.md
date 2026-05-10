# Features

## Opening Repertoire Trainer (v1)

**Curated content (Phase 0d.4 v2 + 1c expansion):**
- 30 families across 3 tiers (8 Tier 1 / 14 Tier 2 / 8 Tier 3)
- 39 hand-curated variations (24 Tier 1 + 14 Tier 2 + 1 Scotch)
- 51 lines, 12-20 ply, depth cap honored (Article 8)
- Fork annotations on key lines (decision points + alternative SANs inline)
- Strategic notes per line (1-3 sentences, feeds Phase 1b/3 explanations)
- 3 presets (Beginner / Intermediate / Advanced) + Off
- ~76 KB bundled catalog.json

**Hierarchy: 3 layers**
- Family (Spanish, Sicilian, KID, ...) → Variation (Najdorf, Marshall, ...) → Line (drillable sequence)
- Sub-decisions captured as ForkAnnotation inside lines (no 4th layer)
- Linear lines only (Article 7); branching deferred to v2+

**Drill flow**
- Playable board, click-to-move + drag-drop
- Green tick on correct move + auto-advance
- Red cross + auto-undo on wrong move
- Two-tier hint (H once = pulse, twice = full highlight)
- Strategic notes panel (collapsible, persisted)
- Fork annotations as inline `⋔` badges on move history with popover (label + alternatives + rationale)
- End-of-line summary card (line name, stats, notes, Restart / Drill due / Next CTAs)
- **Queue mode** (`?queue=due`): cycles through all due lines, auto-advance, "All caught up" exhaustion state

**Spaced repetition (Phase 1, friction-tuned Leitner)**
- 5 boxes: 1d / 3d / 1w / 2w / 1m
- 0 wrong → promote (cap Box 5)
- 1-2 wrong → stay (touch last_reviewed)
- ≥3 wrong → demote one (floor Box 1)
- Hint use counted but doesn't affect box
- First-ever drill: flawless → Box 2, struggling → Box 1
- Skip mid-drill → no SRS update
- Per-line mastery bar (Box → % map: 20/40/60/80/100)
- Lifetime per-line counters: attempts, wrong attempts, hint uses
- Dashboard stats: lines mastered (%), due-for-review count, drilled lines
- Sidebar due badge (hides at 0)
- Settings → Reset all SRS progress (Danger Zone, confirmation gated)
- Per-line SRS reset (`↺` icon on each line in Repertoire, disabled when no state)
- Stable line.id across catalog refreshes (Article 6, SRS state preserved)
- Streak counter — Phase 1.5

**Repertoire presets**
- One-click loadouts: Beginner / Intermediate / Advanced (or Off = full catalog)
- Filter applies to RepertoirePage + Drill opening picker
- Persisted in localStorage `tabiya.repertoirePreset`
- Schema in `scripts/curated/presets.yml` (additive, optional)

## Pattern Visualization Mode (v1.5)

Differentiating feature. Trains visualization, not memorization.

- Toggle in line-review mode: "Visualize Key Squares"
- Pieces fade to ~20% opacity
- Key squares glow with color overlays
- Click highlighted square → tooltip with strategic note
- Catalog stores `key_squares` per line: `[{square, note}]`
- Opening-level defaults + line-specific overrides
- Same primitive feeds AI Coach (Phase 3) — LLM output points to specific squares, UI highlights automatically

## Explain Mode (Phase 1b)

Sibling to drill. Pedagogy-first walkthrough — narrates *why* each move (user + CPU) before it plays. Spec: `specs/phase-1b-explain-mode/`.

- Toggle on drill page header: `[Drill] [Explain]` (per-line, persisted)
- Per-ply `explain` block in catalog: `rationale`, `arrows`, `highlights`, `threats`, `pauseMs`
- Reuses Phase 1.5 highlight primitive (Constitution Article 15) — no fork
- Auto-advance loop with pause / next / prev / restart / skip-to-drill controls
- Both colors narrated; CPU moves get their own pause + overlay step
- Authoring pipeline: 1 hand-authored gold line (Italian main) → GPT-batch script with gold as few-shot → manual-review CLI → approved into catalog
- Seeds Phase 3 AI Coach commentary (gold dataset + grounding signal for RAG)

## Opening Catalog Build (offline, one-shot)

**Three build paths, single CLI:**

| `--source` | What it does | Output size | Use case |
|---|---|---|---|
| `curated-v2` (default) | Reads `scripts/curated/{families,variations,lines}.yml` → 30/26/26 entries | ~50 KB | Production v1 |
| `curated` (legacy) | 18-opening whitelist + Lichess Explorer extension | ~18 KB | Pre-v2 baseline preserved |
| `flat-tsv` | Every TSV row → 1 Opening + 1 Line, ~3585 entries | ~3.3 MB | Tooling / data analysis |

- Source 1: lichess-org/chess-openings TSV (naming + ECO backbone)
- Source 2: Lichess Opening Explorer API (used in `curated` path)
- Source 3: Hand-authored YAML (`families.yml` + `variations.yml` + `lines.yml`)
- Source 4: `notes.yml` overlay for `strategic_notes` + `key_squares` (Phase 0b)
- Output: `public/catalog.json` bundled in app
- Re-run any time; line IDs stable across refreshes

## Storage Architecture (v1)

- JSON bundle for catalog (`public/catalog.json`)
- IndexedDB (`idb` wrapper) for user SRS state — store name `srs_state`, single tabiya DB at version 1
- Phase 1.5 will bump to version 2 to add `session_events` store
- Repository interfaces:
  - `OpeningRepository` — catalog reads (families / variations / openings / lines / search / gambits)
  - `SrsRepository` — SRS state CRUD (single source for Dashboard / Repertoire / Drill)
- 3 concrete impls per side: `JsonOpeningRepository` / `IndexedDbSrsRepository` (production) + `InMemorySrsRepository` (test + future ephemeral)
- DI factory in `src/storage/index.ts` — consumers never import concrete classes (Article 5)
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

## Ongoing (continuous, never "done")

These iterate across every phase. Not gates for release.

- **UX hardening** — ongoing real-user friction triage (Phase 0d.2 originated; protocol in `specs/ux-intake-protocol.md`). Each phase will surface new friction; capture, triage, fix.
- **Deployment / public flip** — Vercel/Netlify deploy + URL flip happen when there is something genuinely good to ship. CI + Docker compose already in place; flipping public is a decision, not a phase.

## Phase 4 Stretch (post-deploy, only if time)

- **Engine-Stress Testing** — after completing a line, hand the board to Stockfish 17 (WASM). User plays 5 moves vs engine from end-of-line position. Tests understanding, not memorization.
- More AI options (try the 2 not picked from A/B/C)
- Tournament prep mode

## Phase 5+ Stretch (OSS lane synergy)

- **Confidential Containers (CoCo) deployment** — `docker-compose.coco.yml` variant runs full stack in Kata Containers + TEE (Intel TDX or AMD SEV). Confidential AI inference: fine-tuned model + user game data stay encrypted at runtime, even from cloud provider. Demo project for VP-recommended Kata/CoCo OSS lane. Adds resume signal for Type B (AI infra) hiring tier.

## Deferred to v2+

- Dynamic Lichess Explorer API at runtime
- User-uploaded custom PGN repertoires
- Variation branching within lines (line.id graph; transposition lookup via FEN-normalized Position layer)
- Per-user RepertoirePick layer (one chosen response per fork point, drives drill queue assembly)
- Drill queue routing (`/drill?queue=due` URL convention reserved Phase 1)
- Per-line context-menu reset (deferred Phase 1.5; only "Reset all" in v1)
- Multi-tab sync (BroadcastChannel)
- Multi-user / auth
- Mobile app

## Resume-Worthy Requirements (non-features, must ship)

- Public deployment with live URL
- Open source repo with README + architecture diagram + demo GIF
- Quantifiable metrics: games ingested, drills completed, personal rating delta
- 5-10 alpha users beyond self
- Blog post on build + lessons learned
