# Technology Stack

Open-source only. Latest stable as of 2026.

## Runtime & Language

- **Backend / build / AI:** Python 3.12+ (primary project language)
- **Frontend:** TypeScript 5+ on React 18+, served by Vite 5+
- **Engine binary:** Stockfish (latest stable, GPL-3) for position evaluation in catalog build + game analysis

Single-language backend: Python owns the catalog build script, AI service, and any future API layer. JavaScript/TypeScript is scoped to the browser.

## Key Dependencies

### Python (backend, build, AI)

| Package | Purpose |
|---------|---------|
| `python-chess` (GPL-3) | PGN/FEN parsing, move generation, board state, UCI engine bridge |
| `httpx` (BSD) | Async HTTP client for Lichess Explorer API + Chess.com API |
| `pydantic` v2 (MIT) | Typed data models, validation, serialization |
| `fastapi` (MIT) | AI service / API layer (Phase 3+) |
| `uvicorn` (BSD) | ASGI server for FastAPI |
| `pytest` (MIT) | Test runner |
| `ruff` (MIT) | Lint + format (replaces flake8 + black + isort) |
| `uv` (Apache-2) | Package + venv manager (replaces pip + poetry) |
| `transformers` + `peft` (Apache-2) | HuggingFace, AI fine-tune layer (Phase 3+) |
| `torch` (BSD) | PyTorch, AI runtime (Phase 3+) |
| `sentence-transformers` (Apache-2) | Embeddings for RAG approach (Phase 3+) |
| `anthropic` (MIT) | Anthropic SDK for Phase 1b explain-block authoring (build-time only; never ships in frontend bundle) |
| `jinja2` (BSD-3) | Prompt templating for Phase 1b authoring pipeline (build-time only) |

### Frontend (browser only)

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` (MIT) | UI framework |
| `typescript` (Apache-2) | Static typing |
| `vite` (MIT) | Dev server + bundler |
| `react-chessboard` (MIT, Clariity) | Chess board UI component |
| `chess.js` (BSD, jhlywa) | Move validation, FEN/PGN, legal moves |
| `tailwindcss` (MIT) | Utility-first CSS |
| `vitest` (MIT) | Unit tests |
| `idb` (ISC) | IndexedDB wrapper for local SRS state |
| `fake-indexeddb` (MIT, dev-only) | IndexedDB simulator for tests |

All MIT / Apache-2 / BSD / GPL / ISC — fully open source, no proprietary deps.

## Build & Development

| Command | Purpose |
|---------|---------|
| `uv sync` | Install Python deps (creates / updates `.venv`) |
| `uv run pytest` | Run Python tests |
| `uv run ruff check .` | Lint Python |
| `uv run ruff format .` | Format Python |
| `uv run python scripts/build_catalog.py` | Regenerate `public/catalog.json` (one-shot, manual) |
| `uv run uvicorn backend.main:app --reload` | Start FastAPI dev server (Phase 3+) |
| `npm install` | Install frontend deps |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production frontend build to `dist/` |
| `npm run test` | Run frontend tests |
| `npm run lint` | Run ESLint + Prettier |

## Catalog Pipeline

- Source 1: `lichess-org/chess-openings` TSV (naming + ECO codes)
- Source 2: Lichess Opening Explorer API (continuation extension at build time)
- Engine: Stockfish via `python-chess` UCI for sharp-line classification
- Output: `public/catalog.json` (static, ~150-300 KB, ~375-500 lines)
- No runtime API calls in v1
- Refresh = re-run `build_catalog.py`, bump `version` field

## Storage

- **v1 catalog:** Bundled JSON read-only at app start
- **v1 user state (SRS):** IndexedDB via `idb` (per-browser local persistence)
- **v2:** SQLite (via wasm in browser OR server-side if backend grows), swapped behind `OpeningRepository` interface

## Containerization (Constitution Article 16)

Project ships as `docker compose up` at every phase milestone. Dual distribution story: live URL (Vercel/Netlify) for casual users + container for self-hosted users.

### Per-phase compose evolution

| Phase | Services in compose |
|---|---|
| 0a / 1 / 1.5 | `frontend` (nginx:alpine serving static dist) |
| 2 | `frontend` + `backend` (Python/FastAPI for Lichess sync) |
| 2.5 | `frontend` + `backend` + `db` (Postgres or SQLite-in-image) |
| 3 | + `ai` (Python/HF, optional GPU) |
| 5 stretch | CoCo / Confidential Containers compose variant for confidential AI inference (Kata Containers + TEE — VP-recommended OSS lane synergy) |

### Image rules

- Multi-stage Dockerfiles per service
- Frontend: builder = `node:20-alpine`, runtime = `nginx:alpine`
- Backend: builder = `python:3.12-slim`, runtime = `python:3.12-slim`
- AI service: `python:3.12-slim` + CUDA base if GPU
- All images on alpine/slim/distroless where possible
- No `latest` tags in compose — pin major.minor

### Commands

| Command | Purpose |
|---|---|
| `docker compose up` | Bring up the full app on default ports |
| `docker compose up frontend` | Frontend only (Phase 0a default) |
| `docker compose -f compose.coco.yml up` | Confidential Containers variant (Phase 5+ stretch) |
| `docker compose build` | Rebuild all images |
| `docker compose down -v` | Stop + remove volumes |

## Conventions

- **Python:** PEP 8 enforced via Ruff. Snake_case for functions/vars, PascalCase for classes. Type hints mandatory on public functions.
- **TypeScript:** strict mode. camelCase functions/vars, PascalCase types/components. Kebab-case file names (`drill-engine.ts`).
- **Stable line IDs** as slugs derived from opening + line name (`ruy-lopez-closed-main`). Never renumber on catalog refresh.
- **Repository pattern** for storage. Consumers depend on `OpeningRepository` interface, never concrete impl.
- **One tree per line** — no branching trees in catalog data model.
- **All chess moves in SAN format** (interoperable with `chess.js` and `python-chess`).
- **FEN strings cached** alongside lines (`end_fen`) for AI features.
- **No LangChain / CrewAI / heavy AI orchestration libs.** Direct SDK calls (Anthropic, OpenAI) or local HF models.
- **No backend in v0/v1** — introduce only when AI coach lands (Phase 3).
- **No proprietary dependencies.** Every dep must be OSS with permissive or copyleft license declared.

## Phase 2a — Scrape source whitelist (Article 1)

The key-squares pipeline (`scripts/key_squares/`) only fetches prose from
sources whose license is in the permissive SPDX allowlist
(`scripts/key_squares/adapters/base.py::PERMISSIVE_SPDX`). The active
whitelist is `scripts/key_squares/sources.yml`. Every `source_url` in
`scripts/curated/key_squares.yml` is checked against this list at build time
by `scripts/tabiya_build/key_squares.py::license_audit` — the build fails if
any unaudited host slips through.

| Source                     | License        | Base URL                          | Notes |
|----------------------------|----------------|-----------------------------------|-------|
| `wikipedia-en`             | CC-BY-SA-4.0   | https://en.wikipedia.org          | English Wikipedia chess opening articles. Attribution preserved via `source_url` citation in curated YAML. |
| `lichess-opening-explorer` | ODbL-1.0       | https://explorer.lichess.ovh      | Lichess public masters database. Returns opening name/ECO; thin prose, used to ground canonical opening identity. |

### Adding a new source

1. Confirm the source's license is in `PERMISSIVE_SPDX`. If not, do not add it.
2. Add the entry to `scripts/key_squares/sources.yml` with: `id`, `license` (SPDX), `base_url`, `adapter` (module name), `url_pattern`, `rate_limit_rps`.
3. Add the adapter module under `scripts/key_squares/adapters/` and register it in `scripts/key_squares/scrape.py::ADAPTER_REGISTRY`.
4. Append a row to the table above with license + rationale.
5. Re-run `uv run pytest tests/python/build/test_license_audit_smoke.py` to confirm the live curated corpus still passes.

Article 11: the scrape pipeline is an OFFLINE BUILD STEP. The runtime app
never fetches scrape sources; only the bundled `public/catalog.json` and
`public/transpositions.json` are loaded.
