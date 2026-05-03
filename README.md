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
├── drill/        # state machine, move comparator, sample line
├── sound/        # move sound (Lichess AGPL audio)
├── theme/        # board theme presets + persistence
└── ui/           # React components (DrillView, ChessBoardPanel, StatusBar, ThemePicker)

scripts/          # offline catalog build (Phase 0b)
public/sounds/    # bundled audio assets (AGPL-3.0, sourced from Lichess)
docker/           # Dockerfile + nginx.conf
specs/            # project principles + per-phase requirements/design/tasks
tests/            # Vitest unit tests
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
