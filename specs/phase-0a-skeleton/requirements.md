# Requirements: Phase 0a — Skeleton

## Introduction

Phase 0a establishes the technical foundation for tabiya: a Vite + React + TypeScript frontend with `react-chessboard` and `chess.js` wired up, rendering a chessboard, accepting user moves, and proving the drill mechanic on a single hardcoded opening line. The goal is a runnable smoke test of the full frontend stack — no catalog, no SRS, no backend, no AI. This is the artifact that validates the chosen toolchain before deeper investment.

## Requirements

### Requirement 1: Project Scaffold

**User Story:** As the developer, I want a working Vite + React + TypeScript project with strict mode, so that I have a reliable foundation that complies with constitution Articles 1, 2, and 14.

#### Acceptance Criteria

1. WHEN the developer runs `npm install` THE SYSTEM SHALL install only open-source dependencies with declared MIT, Apache-2, BSD, or ISC licenses (Constitution Article 1).
2. WHEN the developer runs `npm run dev` THE SYSTEM SHALL start a Vite dev server with hot module reload on a default local port.
3. WHEN the developer runs `npm run build` THE SYSTEM SHALL produce a static production bundle in `dist/` with no errors.
4. THE SYSTEM SHALL have TypeScript strict mode enabled in `tsconfig.json` (Constitution Article 14).
5. THE SYSTEM SHALL include `eslint` and `prettier` (or `biome`) configured to fail on lint errors.
6. THE SYSTEM SHALL NOT include any Node.js backend code, server framework, or polyglot dependency outside the browser bundle (Constitution Article 2).

### Requirement 2: Chess Board Rendering

**User Story:** As a player, I want to see a standard chessboard rendered in the browser, so that I have a visual surface to interact with.

#### Acceptance Criteria

1. WHEN the app loads in a browser THE SYSTEM SHALL render an 8x8 chessboard using `react-chessboard` with the standard starting position.
2. THE SYSTEM SHALL use `chess.js` for all move legality and game state (Constitution Article 9).
3. THE SYSTEM SHALL render the board at a sensible default size (e.g., 480px) and remain usable on viewports >= 320px wide.
4. THE SYSTEM SHALL display the position from White's perspective by default.

### Requirement 3: Single-Line Drill v0

**User Story:** As a player, I want to drill one hardcoded opening line move-by-move, so that I can validate the core drill mechanic before scaling to a full catalog.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship one hardcoded opening line in SAN format inside a TypeScript constant (Constitution Article 9). For example: Ruy Lopez `["e4","e5","Nf3","Nc6","Bb5"]`.
2. WHEN the drill starts AND the line begins with a White move THE SYSTEM SHALL automatically play the first White move on the board.
3. WHEN the player attempts a move THE SYSTEM SHALL compare the player's move (in SAN) against the next expected move in the hardcoded line.
4. WHEN the player's move matches the expected SAN move THE SYSTEM SHALL accept the move, advance the line index, and (if the next expected move is the opponent side) auto-play that move after a short delay (~300ms).
5. WHEN the player's move is legal but does not match the expected SAN move THE SYSTEM SHALL flag the move as wrong, undo it from the board, and re-prompt the player on the same position.
6. WHEN the player attempts an illegal move THE SYSTEM SHALL reject it via `chess.js` and leave the board unchanged.
7. WHEN the player completes all moves in the line THE SYSTEM SHALL display a "line complete" indicator and stop accepting moves.

### Requirement 4: Visual Feedback

**User Story:** As a player, I want immediate visual feedback on each attempt, so that I learn from each move during drill.

#### Acceptance Criteria

1. WHEN the player makes a correct move THE SYSTEM SHALL highlight the destination square in green for ~400ms.
2. WHEN the player makes a wrong move THE SYSTEM SHALL highlight the destination square in red for ~400ms before auto-undoing.
3. WHEN a wrong move is auto-undone THE SYSTEM SHALL restore the prior board state via `chess.js` so the player can retry.
4. THE SYSTEM SHALL display a small status text indicating current state ("Your move", "Wrong — try again", "Line complete").

### Requirement 5: Generalized and Local-First

**User Story:** As a player, I want the app to work offline and not be hardcoded to any specific user, so that the skeleton complies with the project's standalone principles.

#### Acceptance Criteria

1. THE SYSTEM SHALL function fully without any network call after the initial bundle load (Constitution Article 11).
2. THE SYSTEM SHALL NOT contain any author-specific identity, username, or chess.com/lichess profile reference (Constitution Article 10).
3. THE SYSTEM SHALL NOT call any backend service — no FastAPI, no API endpoints, no cloud (Constitution Article 12).

### Requirement 6: Containerization

**User Story:** As a self-hosted user, I want to run the entire app via `docker compose up`, so that I don't have to install Node, npm, or build tools on my host.

#### Acceptance Criteria

1. THE SYSTEM SHALL include a multi-stage `docker/frontend.Dockerfile` with `node:20-alpine` as builder stage and `nginx:alpine` as runtime stage (Constitution Article 16).
2. THE SYSTEM SHALL include a `docker-compose.yml` at the repo root with a single `frontend` service in this phase.
3. WHEN the user runs `docker compose up` THE SYSTEM SHALL build the frontend image (if not built), start the container, and serve the app on a published port (default 8080).
4. WHEN the user opens `http://localhost:8080` after `docker compose up` THE SYSTEM SHALL render the same drill experience defined in Requirements 2, 3, and 4.
5. THE SYSTEM SHALL pin Docker base image tags to `major.minor` (no `latest` tag), and declare image licenses in tech.md (Constitution Article 1).
6. THE SYSTEM SHALL include a `.dockerignore` file that excludes `node_modules/`, build outputs, and SDD directories (`steering/`, `ctx/`, `specs/`) from build context.
7. THE SYSTEM SHALL produce a final frontend image under 50 MB compressed.

### Requirement 7: Non-Functional Requirements

**User Story:** As the developer, I want the skeleton to be small, fast, and verifiable, so that it remains a true smoke test rather than over-engineered scaffolding.

#### Acceptance Criteria

1. THE SYSTEM SHALL keep total hand-written source code under approximately 400 lines of TypeScript across all files in `src/`.
2. THE SYSTEM SHALL achieve interactive board render in under 2 seconds on a modern desktop browser with a cold cache.
3. THE SYSTEM SHALL include at least one Vitest unit test that exercises the move-comparison logic (correct vs wrong vs illegal).
4. THE SYSTEM SHALL keep the production bundle under 500 KB gzipped.
5. THE SYSTEM SHALL run in a current evergreen browser (Chrome, Firefox, Safari) without polyfills.

## Constraints

- Frontend only. No Python backend, no FastAPI, no AI features in this phase (Constitution Article 12).
- Hardcoded data only. No catalog file, no JSON load, no opening browser UI in this phase.
- Single line. No SRS, no spaced repetition, no opening selection, no streak tracking, no hint mode.
- All chess moves stored and compared in SAN format (Constitution Article 9).
- All dependencies must be OSS with a permissive or copyleft license declared in `package.json` (Constitution Article 1).
- Containerized distribution required from this phase forward (Constitution Article 16). Docker compose evolves additively in later phases (backend, DB, AI).
- Confidential Containers (CoCo / Kata) variant is out of scope for Phase 0a. Defer to Phase 5+ stretch.
- Keep scope minimal — this phase exists to validate the toolchain, not to ship features. If a sub-task takes more than the allocated weekend, simplify rather than expand.
- Weekend-only build pace; pause if main battle plan needs the time (Constitution Article 13).
