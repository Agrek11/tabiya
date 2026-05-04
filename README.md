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

Active development. Phase 0d.2 (drill UX hardening) in flight.

### Phase progress

| Phase | Status | What shipped |
| --- | --- | --- |
| 0a — Skeleton | ✅ done | Vite/React/TS, drill state machine, sounds, themes, confetti, tick/cross overlays, Docker compose |
| 0b — Catalog build | ✅ done | Python `build_catalog.py`, Pydantic schema, Lichess Explorer client, 18 openings × 19 lines |
| 0c — Storage interface | ✅ done | `OpeningRepository` interface + `JsonOpeningRepository`, catalog-driven drill, keyboard nav (←/→/H/R), one-shot Hint, last-move highlights |
| 0d.1 — v1 design system | ✅ done | Theme tokens (light/dark), `lucide-react` icons, `react-router-dom` v7, 5 routed pages, app shell (Sidebar + TopBar + AppShell), 4 primitives (Card/Button/PageHeader/StateMessage), v1 wireframe locked as design destination |
| 0d.2 — UX hardening | 🚧 in flight | Sound module v2 (audio pool, persisted settings, global unlock), move-history rail collapse + next-move accent, status strip primitive, board theme picker (6 presets, drill quick-toggle + Settings), two-tier Hint UX, board-flip animation, lichess-style last-move highlight |
| 0d.3 — Catalog v2 + Repertoire | 📝 specced | Family schema layer, gambits cross-cut, repertoire restructure |
| 1 — SRS data layer | 📝 specced | IndexedDB schema, Leitner scheduler, mastery bars |
| 1.5 — Session event log | planned | Heatmap, accuracy %, streak, suggested-for-you |
| 2 — Pattern Viz + end-of-line plans | planned | KeySquareOverlay, hand-curated key squares, Stockfish + LLM pre-computed plans baked into catalog |
| 3 — Lichess + Chess.com sync | planned | FastAPI backend, Postgres + pgvector, OAuth, "out of book by move N", auto-drills |
| 4 — AI Coach v1 | planned | Q&A `/coach`, game review, dynamic plan AI (Stockfish + RAG + frontier LLM with prompt caching) |
| 5 — Polish + Deploy + Blog | planned | Live URL, demo GIF, blog post, soft launch |
| 6 — Stretch | optional | Engine-stress, CoCo confidential containers, multi-user |

See [specs/](./specs/) for full per-phase requirements + design + tasks.

## Getting Started

Two ways to run tabiya. Pick one.

### Option A — Local development (Node)

Prerequisites: Node 20+ and npm.

```sh
npm install
npm run dev          # starts Vite dev server, opens http://localhost:5173
```

Other scripts:

| Command           | What it does                                                |
| ----------------- | ----------------------------------------------------------- |
| `npm run dev`     | Vite dev server with hot module reload                      |
| `npm run build`   | Type-check (`tsc -b`) and produce a production bundle in `dist/` |
| `npm run preview` | Serve the built `dist/` locally for sanity-check            |
| `npm run test`    | Run the Vitest unit suite once                              |
| `npm run test:watch` | Run Vitest in watch mode                                 |
| `npm run lint`    | Run ESLint                                                  |

### Option B — Containerized (Docker)

Prerequisites: Docker + Docker Compose v2.

```sh
docker compose up    # builds the image if needed, serves on http://localhost:8080
```

The image is built from `docker/frontend.Dockerfile` (multi-stage `node:20-alpine` builder → `nginx:alpine` runtime). The final image is small (under 50 MB) and contains only the static bundle and nginx.

To force a rebuild after pulling new code:

```sh
docker compose build --no-cache
docker compose up
```

To stop:

```sh
docker compose down
```

## Project Layout

```
src/
├── drill/        # state machine, move comparator, sample line, useDrill hook, rail-collapsed hook
├── pages/        # DashboardPage, RepertoirePage, DrillPage, ProgressPage, SettingsPage
├── sound/        # move sound module v2 (audio pool, persisted settings, global unlock)
├── storage/      # OpeningRepository interface + JsonOpeningRepository impl
├── theme/        # ThemeContext (light/dark), BoardThemeContext (board presets), tokens
├── ui/           # ChessBoardPanel + primitives (Card/Button/PageHeader/StateMessage/StatusStrip) + shell (AppShell/Sidebar/TopBar)
└── App.tsx, main.tsx

scripts/          # offline catalog build (Phase 0b) — Python + uv
public/sounds/    # bundled audio assets (AGPL-3.0, sourced from Lichess)
public/catalog.json   # checked-in opening catalog
docker/           # Dockerfile + nginx.conf
specs/            # project principles + per-phase requirements/design/tasks
tests/            # Vitest unit tests (TS) + Python pytest under tests/python/
.github/workflows/ # CI: lint, test, build
```

## Catalog Build

The opening catalog (`public/catalog.json`) is checked in. Regenerate only when extending or refreshing it.

### Prerequisites

- [`uv`](https://github.com/astral-sh/uv) — Python 3.12+ env manager. macOS: `brew install uv`
- Lichess API token — required by `explorer.lichess.ovh`. Generate one at https://lichess.org/account/oauth/token (no scopes needed). Export as `LICHESS_API_TOKEN`.
- (Corporate networks only, e.g. Zscaler) export your CA bundle so `uv` can fetch from PyPI:
  ```sh
  security find-certificate -a -p -c "Zscaler" /Library/Keychains/System.keychain > /tmp/zscaler.pem
  security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> /tmp/zscaler.pem
  export SSL_CERT_FILE=/tmp/zscaler.pem
  export UV_NATIVE_TLS=true
  ```

### Commands

```sh
export LICHESS_API_TOKEN=lip_xxxxxxxx         # required (one-time)
uv sync --all-extras                          # install Python deps + dev tools (pytest, ruff)
uv run python -m scripts.build_catalog        # build the catalog (full whitelist)
uv run pytest                                 # run Python unit + smoke tests
uv run ruff check .                           # lint
```

### Common flags

| Flag                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `--refresh`                | ignore caches; re-fetch TSVs and Explorer responses      |
| `--openings ruy-lopez,...` | limit build to specific opening IDs                      |
| `--out path`               | override output path (default: `public/catalog.json`)    |
| `--max-depth N`            | override the global depth cap (testing)                  |
| `--notes path`             | override hand-curated YAML notes file                    |

Hand-curated strategic notes and key squares live at `scripts/curated/notes.yml`. May be empty.

## Asset Attribution

- Move sound: [`Move.mp3`](public/sounds/Move.mp3) sourced from [lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/sound/standard) (AGPL-3.0).
- Opening data: derived from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0) and Lichess Masters Opening Explorer.

## License

See [LICENSE](./LICENSE).
