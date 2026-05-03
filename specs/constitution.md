# Constitution

Immutable principles for tabiya. These hold regardless of phase, feature, or pressure. Every spec, design, and implementation must comply. Violations require a deliberate amendment to this document, not a quiet exception.

## Article 1 — Open Source Only

Every runtime, build, test, and deploy dependency must be open source with a permissive or copyleft license (MIT, Apache-2, BSD, ISC, GPL family). No proprietary, "free tier", or source-available libraries. License must be declared in `tech.md`. No proprietary AI orchestration libraries.

## Article 2 — Python Primary, TypeScript Scoped to Browser

Python owns backend, build scripts, AI features, and any future API layer. TypeScript exists only in the browser bundle. No Node.js backend. No polyglot drift — if a feature needs a new language, write a spec amendment first.

## Article 3 — No Heavy AI Orchestration

No LangChain, CrewAI, AutoGen, or equivalent abstraction layers. AI features call SDKs directly (Anthropic, OpenAI, HuggingFace `transformers`) or run local models. No agent frameworks beyond ReAct loops the project owns.

## Article 4 — AI Must Be Real Model Work

AI features must include at least one of: fine-tuning, RAG with measurable retrieval/answer eval, or agent with logged tracing and tool-call accuracy metrics. A thin LLM API wrapper does not count as an AI feature. Resume bullets must point to real model work.

## Article 5 — Repository Pattern for Storage

All catalog and persisted data flow through interfaces (`OpeningRepository` and successors). Consumers never import concrete implementations directly. Storage swaps (JSON → SQLite → backend-served) are single-DI changes.

## Article 6 — Stable Line IDs Forever

Line and opening IDs are slugs derived from human-readable names (`ruy-lopez-closed-main`). Once published in any catalog version, an ID never changes meaning. Catalog refreshes can add or remove lines but never renumber. User SRS state is keyed by these IDs and must survive every refresh.

## Article 7 — Linear Lines Only

The catalog data model stores one tree per line — pure linear sequence of moves, no branching variations. Branching, if ever introduced, requires an amendment and a version bump in the catalog schema.

## Article 8 — Hard Depth Cap 20 Ply

No catalog line exceeds 20 ply (10 full moves per side). Default 18, 16 for quiet positional openings, 20 for sharp tactical lines on the whitelist. No exceptions outside this band.

## Article 9 — SAN Format for All Chess Moves

All move data in catalog, drill state, game imports, and AI exchanges uses Standard Algebraic Notation. No UCI, no coordinates, no custom formats. Interoperable with both `chess.js` (frontend) and `python-chess` (backend) by default.

## Article 10 — Standalone and Generalized

The app works for any player's prep, not the author's only. No hardcoded user identities, no personal repertoires baked into the bundle, no chess.com/lichess username defaults. Naming stays generic (`Repertoire`, `Line`, `Drill`).

## Article 11 — Local-First

No mandatory server-side accounts, no required login, no telemetry collection without opt-in. The app must run end-to-end with only its bundled assets and the user's local browser storage. Cloud/backend features are additive, never gating.

## Article 12 — Backend Optional

Phases 1, 2, and 1.5 must function with no backend running. Backend is introduced for AI features in Phase 3 and remains optional — disabling it degrades AI features only, never breaks the trainer.

## Article 13 — Weekend Pace, Never Blocks Main Plan

This project is weekend-only. It does not steal time from the AI/ML battle plan or DSA prep. If the main plan slips or any conflict arises, this project pauses indefinitely. No exceptions.

## Article 14 — Type Discipline

Python: type hints mandatory on public functions and module exports. TypeScript: strict mode on, no `any` without an inline justification comment. Lint passes (Ruff, ESLint) are merge-blocking.

## Article 15 — Single Highlight Primitive

Pattern Visualization (Phase 1.5) and AI Coach output (Phase 3) share one square-highlight + tooltip primitive. They do not fork into two implementations.

## Article 16 — Containerized Distribution

The project ships as a `docker compose up` artifact at every phase milestone. All runtime dependencies — frontend, backend, database, engine binaries, AI service — are bundled into Docker images. No host-side install required beyond Docker itself. Every phase design must remain container-friendly: no host-only paths, no system Python assumptions, no native-only deps without an alpine/slim base. Distribution story is dual at all times: a live URL (Vercel/Netlify) for casual users AND `docker compose up` for self-hosted users.

---

## Amendment Process

Changing an article requires:

1. Stating which article and why current rule fails
2. Updating this file
3. Updating affected steering docs (`product.md`, `tech.md`, `structure.md`) and any specs in `specs/`
4. Bumping a `constitution_version` in the next schema/build artifact where it materializes

Quiet exceptions are not permitted. If a spec or implementation contradicts this document, the document wins by default.
