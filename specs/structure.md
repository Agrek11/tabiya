# Project Structure

## Directory Layout

```
tabiya/
├── public/
│   └── catalog.json              # Static opening catalog (bundled, generated)
├── scripts/
│   └── build_catalog.py          # Python one-shot, regenerates catalog
├── backend/                      # Python service (Phase 3+, AI features)
│   ├── main.py                   # FastAPI entrypoint
│   ├── coach/                    # Middlegame plan + Q&A endpoints
│   ├── models/                   # Pydantic models, AI loaders
│   └── tests/
├── src/                          # Frontend (TypeScript / React)
│   ├── storage/
│   │   ├── types.ts              # OpeningRepository interface, Opening, Line types
│   │   ├── JsonOpeningRepository.ts
│   │   └── index.ts              # DI: exports active impl
│   ├── drill/                    # Drill engine, move comparison, feedback
│   ├── srs/                      # Leitner state, due-line queue
│   ├── ui/                       # React components (Board, OpeningList, DrillView)
│   └── chess/                    # chess.js helpers, FEN/SAN utils
├── tests/                        # Frontend Vitest unit tests
├── docker/                       # Per-service Dockerfiles
│   ├── frontend.Dockerfile       # node:20-alpine builder + nginx:alpine runtime
│   ├── backend.Dockerfile        # python:3.12-slim (Phase 3+)
│   └── ai.Dockerfile             # python:3.12-slim + optional CUDA (Phase 3+)
├── docker-compose.yml            # Default compose: services per active phase
├── docker-compose.coco.yml       # CoCo / Confidential Containers variant (Phase 5+)
├── .dockerignore
├── pyproject.toml                # Python deps + Ruff config (uv-managed)
├── package.json                  # Frontend deps
├── steering/                     # SDD: project identity (always-on)
├── ctx/                          # SDD: branch-scoped context items
├── specs/                        # SDD: per-feature requirements/design/tasks
├── README.md
└── features.md
```

## Key Directories

| Path | Purpose |
|------|---------|
| `public/catalog.json` | Pre-built static opening catalog. Served by Vite, loaded once at app start. |
| `scripts/build_catalog.py` | Offline Python tool — generates catalog from `lichess-org/chess-openings` TSV + Lichess Explorer API + Stockfish. |
| `backend/` | Python FastAPI service for AI features. Lands at Phase 3, optional in v1/v2. |
| `src/storage/` | Storage interface + impls. Single point of swap (JSON → SQLite). |
| `src/drill/` | Drill engine: load line, expect move, validate, emit feedback events. |
| `src/srs/` | Leitner scheduler: box state, promotion/demotion, today's queue. |
| `src/ui/` | React components — keep dumb, push logic into drill / srs. |
| `src/chess/` | Thin wrappers over chess.js for SAN, FEN, legal-move helpers. |
| `pyproject.toml` | Python project metadata, deps managed by `uv`, Ruff config. |
| `docker/` | Per-service Dockerfiles (frontend, backend, ai). Multi-stage, alpine/slim bases. |
| `docker-compose.yml` | Default compose. Services scale per phase (frontend → +backend → +db → +ai). |
| `docker-compose.coco.yml` | Confidential Containers variant (Phase 5+ stretch, OSS lane synergy with Kata/CoCo). |
| `steering/` | Project identity docs, loaded into every spec session. |
| `ctx/` | Per-branch additional context (notes, decisions, snippets). |
| `specs/` | Per-feature spec dirs (`<spec-name>/requirements.md`, `design.md`, `tasks.md`). |

## Naming Conventions

### Python
- **Files:** snake_case (`build_catalog.py`, `coach_service.py`)
- **Classes:** PascalCase (`OpeningCatalog`, `LineExtender`)
- **Functions / variables:** snake_case
- **Module dirs:** snake_case

### TypeScript
- **Files:** kebab-case (`drill-engine.ts`, `opening-list.tsx`)
- **Components (export name):** PascalCase (`OpeningList`, `DrillView`)
- **Types / Interfaces:** PascalCase (`OpeningRepository`, `Line`, `BoxState`)
- **Functions / variables:** camelCase

### Data
- **Line IDs:** slug-style (`ruy-lopez-closed-main`), stable across catalog refreshes
- **Test files:** mirror source path with `.test.ts` (frontend) or `test_*.py` (Python) suffix

## Architecture Notes

The app is a single-page React frontend backed by an optional Python AI service, with three clean seams:

1. **Storage seam** — All catalog data flows through the `OpeningRepository` interface. v1 reads bundled JSON; v2 swap to SQLite (or backend-served data) touches one DI line. User SRS state lives separately in IndexedDB.

2. **Drill / SRS seam** — Drill engine emits events (correct / wrong / complete); SRS module subscribes and updates Leitner box state. UI is pure presentation, never owns drill or SRS logic.

3. **AI seam (Phase 3+)** — Frontend calls Python FastAPI endpoints with `end_fen` for middlegame plans, or with game data for analysis. Backend is fully optional — v1/v2 work without it. AI logic stays in Python where the ML ecosystem lives.

The catalog build is fully decoupled — Python script runs offline, produces `catalog.json`, commits to repo. Runtime never hits Lichess or Chess.com APIs in v1. Refresh is manual + intentional.
