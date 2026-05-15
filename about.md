# About tabiya

A local-first chess opening repertoire trainer that teaches understanding alongside memorization. Standalone web app, runs in any browser, optional Docker deploy, optional cloud LLM. No mandatory account, no telemetry by default.

For the system view, see [architecture.md](./architecture.md). For binding decisions and rationale, see [design-decisions.md](./design-decisions.md). For shipped + planned features, see [features.md](./features.md).

## What it is

tabiya is three things layered:

1. **A spaced-repetition opening drill app.** Pick from ~50 curated lines across 30 opening families, drill them like flashcards, get green-tick / red-cross feedback, let a friction-tuned Leitner scheduler decide what you see tomorrow.
2. **A pedagogy layer on top of the drill.** Explain Mode walks each move ply-by-ply with rationale, arrows, and key-square highlights — both colors narrated — before the move plays. Pattern Visualization Mode dims the pieces and spotlights the squares that actually decide the position.
3. **An AI coach grounded in symbolic chess understanding.** A Stockfish engine + rule-based feature extractor + position classifier + motif detector + plan extractor produce a machine-verifiable context bundle; the LLM is constrained to narrate it. Hallucination is structurally blocked, not just prompted away.

The first layer ships today (`v0.7-phase-1c`). The second has full specs and is the active build target. The third is specced end-to-end across sub-phases 4a–4e; 4a (engine + naive LLM MVP) is the next active build after the pedagogy layer.

## Why "tabiya"

In opening theory, a *tabiya* is a known position from which a player is "at home" — the canonical starting point for their middlegame plans, reached by many move orders. The name reflects what the app trains: not just the move list of a line, but the *position* you arrive at, the squares that matter once you get there, and the plans that follow. Memorizing a sequence gets you to ply 10. Knowing the tabiya is what you do at ply 11.

## Why it exists

The chess training market is segmented in a way that leaves a gap:

- **Lichess Studies / Chessable** drill move sequences. Strong for memorization, weak for "why."
- **Chess.com Lessons** are video-heavy and curriculum-driven. Strong for breadth, weak for personal repertoire.
- **YouTube IM/GM repertoire courses** are pedagogy-heavy and one-shot. Strong for understanding, no drill loop.

tabiya sits in the unfilled cell: a personal repertoire you control, drilled with SRS like Chessable, narrated with rationale like a course, and analyzed with engine + LLM grounding like an AI tutor — all in one tool, running locally, with the catalog and your progress staying on your device.

A secondary motivation: the AI Coach is real model work in the sense Article 4 of the constitution demands. It is not a thin GPT wrapper. The symbolic layer (Phase 4b–4d) is the moat, and the LLM is constrained to narrate it. That layered architecture is also the project's interview story.

## Who it is for

- **Any chess player building or refreshing a repertoire.** Beginner with a tier-1 preset, intermediate adding their own picks, tournament player drilling the exact lines they study with their coach.
- **Players who learn by understanding *and* by repetition.** Drill mode for muscle memory, Explain Mode for the "why" walkthrough, Pattern Visualization for spatial intuition.
- **Self-driven improvers who prefer tools over content.** No video subscriptions, no curriculum, no recommended schedule. Your repertoire, your pace.
- **Privacy-aware users.** Local-first by Constitution Article 11. Cloud AI is opt-in with user-supplied keys. Lichess sync is opt-in PKCE OAuth. Disconnecting clears all state.

Not targeted: tournament platforms, multiplayer chess, broadcast tools, mobile-native packaging.

## Project story

tabiya started as a personal-use weekend project. The author wanted to drill their own Sicilian and Ruy Lopez prep without paying Chessable's subscription and without losing progress between devices when Chessable's sync broke. The first cut was a static React app reading a hand-authored JSON file. That cut shipped in ~2 weekends and was used daily.

The second cut added curated breadth (30 families, 39 variations, 51 lines) and a Python catalog build pipeline that pulls from `lichess-org/chess-openings` and the Lichess Opening Explorer. At this point the project crossed from "personal tool" into "portable open-source app" and earned a constitution: 16 immutable articles covering open-source-only dependencies, repository-pattern storage, stable line IDs, hard depth caps, local-first behavior, weekend-only pace, and a single board-highlight primitive for every overlay feature ever planned.

The third cut is now in progress: pedagogy (Explain Mode, Pattern Visualization), telemetry (session events, streaks, accuracy %, heatmap, repertoire pick), Lichess sync (OAuth PKCE + out-of-book detection), and AI Coach. Each sits in `specs/<phase-name>/` with full requirements + design before any code is written. The author writes the specs in Claude Code; the implementation is hand-typed against them.

The project balances two pressures: **production discipline** (TS strict, no `any`, repository-pattern storage, schema validation, CI lint + test + build) and **pedagogy-first product thinking** (every feature has to teach something a chess player actually struggles with). The Constitution exists to keep both pressures honored when one tries to win.

## Current status

| Field | Value |
| --- | --- |
| Version | `v0.7-phase-1c` |
| Active spec | Phase 1b Explain Mode |
| Next active build (Coach) | Phase 4a Naive Engine + LLM MVP |
| Catalog size | 30 families, 39 variations, 51 lines, ~76 KB bundled |
| Storage | IndexedDB (SRS state, repertoire pick, session events forthcoming) + localStorage (prefs) |
| Backend | None required. Optional FastAPI introduced for Coach in Phase 4. |
| Distribution | Live URL (Vercel/Netlify, not yet flipped public) + `docker compose up` |
| License | Apache 2.0 |

Shipped feature one-liners (see [features.md](./features.md) for full list):

- 51 curated linear opening lines, hard 20-ply cap, fork annotations on key decision points
- Drill mode: click-to-move + drag-drop, green-tick / red-cross / auto-undo, two-tier hint, strategic notes panel
- Friction-tuned Leitner SRS (5 boxes: 1d / 3d / 1w / 2w / 1m), per-line mastery bars, due-line queue mode
- Three presets (Beginner / Intermediate / Advanced) + Off, plus per-line manual override (Phase 1.5)
- Repository-pattern storage (Opening, SRS) with JSON v1 + IndexedDB
- v1 design system: light/dark theme, 6 board themes, 5 routed pages, app shell + 4 primitives
- Docker compose distribution from Phase 0a; multi-stage `node:20-alpine` → `nginx:alpine`

## Roadmap headline

Five specced phases ahead, in order:

1. **Phase 1b — Explain Mode.** Sibling pedagogy mode to drill. Ply-by-ply rationale, arrows, highlights, TTS behind feature flag. Sidecar files at `data/explain/<lineId>.json`. Gold-authored Italian Game line + GPT-batch authoring script + manual-review CLI.
2. **Phase 1.5 — Telemetry, Streaks, Heatmap, RepertoirePick.** Append-only `session_events` log in IndexedDB. Dashboard surfaces: drill-day + line-mastery streaks, tabbed heatmap (daily / per-opening / hour-of-day), all-time + 7-day accuracy %, per-line accuracy badge. RepertoirePick = preset + manual additions / removals.
3. **Phase 2 — Pattern Visualization + Transposition.** Scrape → LLM-extract → manual-review pipeline for `key_squares.yml` covering ≥30 openings. Spotlight overlay (dim non-key squares, glow key squares colored by role). Transposition banner when current FEN appears in another picked line.
4. **Phase 3 — Lichess Sync.** OAuth PKCE in browser (no callback backend), sync last 100 games / 15 days, walk each game against picked repertoire, emit `OOBEvent` at first divergence. Dashboard widget lists out-of-book moments; position viewer shows played vs expected. Plumbing for Phase 4.
5. **Phase 4 — AI Coach.** 5-layer pipeline. 4a (Stockfish.wasm + Anthropic/OpenAI/Ollama/llama.cpp-WebGPU LLMClient + in-drill Why? button) is the next active Coach build. 4b–4e (feature extractor, position classifier + motif detector, semantic tags + plan extractor + opening KG, grounded prompt + hallucination block + eval harness) are documented end-to-end as the moat roadmap.

AI Coach is the moat. The point of the symbolic layer (4b–4d) is that the LLM never invents chess truth; it narrates a machine-verified context bundle. Hallucination is blocked structurally, not prompted away.

After Phase 4: live URL flip (Phase 5 polish + deploy + blog post), then optional stretch — Engine-Stress Testing (Phase 4 stretch: play 5 moves vs Stockfish from end-of-line), Confidential Containers (Phase 5+: `docker-compose.coco.yml` runs the full stack in Kata Containers + TEE for confidential AI inference, demo project for the VP-recommended OSS lane).

## Running it

Two ways to run tabiya. Pick one.

### Local development (Node)

Prerequisites: Node 20+ and npm.

```sh
npm install
npm run dev          # Vite dev server with HMR on http://localhost:5173
npm run build        # type-check + production bundle to dist/
npm run test         # Vitest unit suite
npm run lint         # ESLint
```

### Containerized (Docker)

Prerequisites: Docker + Docker Compose v2.

```sh
docker compose up    # builds the image if needed, serves on http://localhost:8080
docker compose down  # stop
```

Image built from `docker/frontend.Dockerfile` — multi-stage `node:20-alpine` builder → `nginx:alpine` runtime. Final image under 50 MB, contains only the static bundle and nginx.

### Catalog rebuild (optional, advanced)

The catalog (`public/catalog.json`) is checked in. Regenerate only when extending or refreshing it.

```sh
export LICHESS_API_TOKEN=lip_xxxxxxxx         # from https://lichess.org/account/oauth/token
uv sync --all-extras                          # Python deps + dev tools
uv run python -m scripts.build_catalog        # rebuild catalog
uv run pytest                                 # Python tests
uv run ruff check .                           # Python lint
```

Hand-curated content lives under `scripts/curated/` as YAML (`families.yml`, `variations.yml`, `lines.yml`, `notes.yml`, `presets.yml`).

## Contributing

The project is solo and weekend-paced (Constitution Article 13) but open to pull requests. Every change must:

- Comply with the Constitution (`specs/constitution.md`, 16 articles). Violations require a deliberate amendment, not a quiet exception.
- Land behind a spec in `specs/<phase-or-feature-name>/` with `requirements.md` (EARS-style acceptance criteria) and `design.md` (architecture seams, type shapes, test plan).
- Pass `npm run lint`, `npm run test`, `npm run build`, and `uv run pytest` if Python is touched.
- Keep TS strict (no `any` without an inline justification comment) and Python type-hinted on public functions.

## Attribution

- Move sounds: `public/sounds/Move.mp3` sourced from `lichess-org/lila` (AGPL-3.0).
- Opening backbone: derived from `lichess-org/chess-openings` (CC0) and the Lichess Masters Opening Explorer.
- Stockfish (Phase 4a): GPL-3.

## License

Apache 2.0. See [LICENSE](./LICENSE).
