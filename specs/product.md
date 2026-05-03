# Product Overview

## Purpose

Tabiya is a chess opening repertoire trainer with built-in game analysis and AI coaching. It helps a chess player drill openings into muscle memory, learn from real mistakes by ingesting Chess.com games, and understand middlegame plans through an AI coach — all in a single standalone web app.

## Target Users

- Solo chess players (club / online) who want structured opening practice
- Players who already have a Chess.com profile and want to learn from their own games
- Self-driven improvers who prefer drilling over watching content

Not targeted: tournament platforms, multiplayer chess, broadcast tools.

## Key Features

- Opening repertoire trainer with pre-loaded catalog (~15-20 openings, ~25 lines each)
- Linear lines, hard depth cap of 20 ply (16 quiet, 20 sharp)
- Drill mode with green-tick / red-cross / auto-undo feedback
- Spaced repetition (Leitner, 5 boxes)
- **Pattern Visualization** — toggle to fade pieces and highlight key squares with strategic notes (differentiator, trains visualization not memorization)
- Lichess + Chess.com game sync — pull games, detect "out of book by move N" against active repertoire, auto-create drills from divergences (later phase)
- AI coach — middlegame plan recommendations from end-of-line FEN, structural "why" explanations using RAG over `strategic_notes`, conversational Q&A (later phase)
- Engine-stress testing — play 5 moves vs Stockfish from end-of-line position to test understanding (Phase 4 stretch)

## Constraints

- Standalone + generalized: works for any player's prep, not hardcoded to one user
- Local-first: SQLite/JSON storage by default, no server-side accounts in v1
- Pre-loaded static catalog only in v1 — no runtime opening API calls
- One tree per line (linear, no branching) for drill scope containment
- Stable line IDs across catalog refreshes (preserve user SRS state)
- Storage abstracted via repository interface — JSON v1, SQLite v2 swap-in
- **Containerized distribution from Phase 0a** — `docker compose up` brings full stack live. All deps bundled. Dual delivery: live URL (Vercel) + container.
- Weekend-only build pace; never blocks anything else
- AI features must be real model work, not GPT API wrapper
- Phase 5+ stretch: Confidential Containers (Kata/CoCo) variant for confidential AI inference — synergy with OSS lane work
