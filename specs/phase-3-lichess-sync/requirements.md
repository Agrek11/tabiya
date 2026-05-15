# Requirements: Phase 3 — Lichess Sync

## Introduction

Phases 0–2 produce a self-contained trainer: curated catalog, repertoire picks (Phase 1.5), drill loop, SRS, strategic notes, fork annotations, and a position-keyed transposition index (Phase 2). The trainer answers "do you know your prep" but not "are you actually playing your prep". Phase 3 closes that loop by pulling the user's recent Lichess games, walking each one against the **picked** repertoire (not the full catalog), and surfacing the first ply where reality diverged from prep — the "out-of-book moment" (OOB).

Phase 3 is plumbing for Phase 4 (Coach). The Coach will consume the same OOB event records to generate explanations; Phase 3 produces only the passive surface — a dashboard widget and a position viewer. No auto-drill creation, no repertoire mutation, no commentary.

**Article 11 compliance — opt-in additive.** Lichess connect is gated behind an explicit user action in Settings. The app continues to function fully if the user never connects. Disconnecting clears all Lichess state and returns the app to local-only operation. This is constitution-compliant because the feature is *additive* — it adds a new surface without making any existing surface depend on Lichess presence. The dashboard widget renders an empty state ("Connect Lichess to see out-of-book moments") when disconnected; nothing else changes.

**Article 12 compliance — backend stays optional.** Lichess's public API is CORS-friendly; the browser fetches games directly. No backend proxy is required. Self-hosted Docker users get the same feature without spinning up a backend.

**Article 4 dependency note.** Phase 3 by itself is not "real AI work" — it is data ingestion + diff. The AI feature lands in Phase 4, which consumes OOB events as RAG context for the Coach. Phase 3 must produce structured, replayable OOB records to make that downstream consumption clean.

8 requirements. Priority order: OAuth + token storage (R1), then sync + persistence (R2–R4), then OOB detection (R5–R6), then surface (R7), then quality gates (R8).

## Requirements

### Requirement 1: Lichess OAuth (PKCE) connect + disconnect

**User Story:** As a player, I want to connect my Lichess account in one click from Settings so the trainer can read my recent games, and disconnect cleanly when I want to.

#### Acceptance Criteria

1. THE SETTINGS PAGE SHALL include a "Lichess" section with a "Connect Lichess" button when no token is stored, and a "Disconnect" button + connected-username display when a token is stored.
2. WHEN the user clicks "Connect Lichess" THE SYSTEM SHALL initiate Lichess OAuth2 PKCE flow (code verifier + challenge generated client-side, no client secret).
3. THE SYSTEM SHALL register and use the callback URL `/<origin>/lichess/callback`, where `<origin>` is `http://localhost:5173` for Vite dev and the deployed origin (or self-hosted Docker origin) in production.
4. WHEN Lichess redirects back to the callback with a code, THE SYSTEM SHALL exchange the code for an access token via Lichess's token endpoint, then persist the token in `localStorage` under key `tabiya.lichess.token`.
5. THE SYSTEM SHALL request only the minimum OAuth scopes needed to read public game history (no write, no challenge, no email).
6. THE token storage SHALL be marked sensitive (key name suffixed `.sensitive` OR wrapped in a `SensitiveStore` interface that documents the risk). Encryption-at-rest with a user passphrase is OPTIONAL for v1 and tracked as an open question (Q3 below).
7. WHEN the user clicks "Disconnect" THE SYSTEM SHALL clear `tabiya.lichess.token`, clear cached username, and clear the `lichess_games` IndexedDB store. The OOB dashboard widget SHALL revert to its empty state.
8. IF the token is rejected by Lichess (401) on any subsequent API call, THE SYSTEM SHALL treat it as disconnected, clear the token, and show a "Reconnect Lichess" prompt in Settings.
9. NO heavy auth framework (no Auth0 SDK, no `@auth/*`, no Passport). PKCE is implemented with browser-native `crypto.subtle` and `fetch`. (Article 1, Article 3.)

### Requirement 2: Sync recent games (last 100 OR 15 days, whichever is fewer)

**User Story:** As a connected player, when I click "Sync now" the trainer should pull my recent games — bounded so the request is fast and idempotent.

#### Acceptance Criteria

1. THE LICHESS SECTION of Settings SHALL include a "Sync now" button, visible only when connected.
2. WHEN "Sync now" is clicked THE SYSTEM SHALL call Lichess `GET /api/games/user/{username}?max=100&since={epoch_ms_of_now_minus_15d}&pgnInJson=true&clocks=false&evals=false&opening=true`.
3. THE SYSTEM SHALL stop reading the streamed response at whichever boundary hits first: 100 games OR the `since` cutoff (Lichess applies `since` server-side; the `max=100` cap is the client-side ceiling).
4. THE SYSTEM SHALL display a progress indicator during sync (e.g. "Synced N games...") and a terminal toast on completion ("Synced N new games, M already known").
5. WHEN sync is in progress THE "Sync now" BUTTON SHALL be disabled.
6. IF the user is not connected (no token) THE "Sync now" BUTTON SHALL be hidden.
7. THE SYSTEM SHALL rate-limit syncs to at most one per 60 seconds to respect Lichess API etiquette.

### Requirement 3: Manual import by game ID

**User Story:** As a player, I want to paste a Lichess game ID and import that single game — for games older than the 15-day window or shared by a friend.

#### Acceptance Criteria

1. THE LICHESS SECTION SHALL include an "Import game by ID" text input + "Import" button, visible only when connected.
2. THE input SHALL accept an 8-character Lichess game ID (base62: `[a-zA-Z0-9]{8}`). Validation regex SHALL reject malformed input with an inline error.
3. WHEN "Import" is clicked with a valid ID, THE SYSTEM SHALL call Lichess `GET /game/export/{id}?pgnInJson=true&clocks=false&evals=false&opening=true` (single-game endpoint, no auth required for public games but token sent for consistency).
4. THE IMPORTED GAME SHALL be persisted to the same `lichess_games` IndexedDB store as the bulk sync (Requirement 4) and trigger the same OOB detection pipeline.
5. IF the game ID is not found (404) THE SYSTEM SHALL show an inline error "Game not found".
6. IF the game ID is already in the store THE SYSTEM SHALL show "Already imported" and skip re-detection.

### Requirement 4: `lichess_games` IndexedDB store + `LichessRepository`

**User Story:** As a developer, I want game data behind a repository interface so the storage layer can swap (Article 5) and so the OOB detector + dashboard widget read from one source of truth.

#### Acceptance Criteria

1. THE SYSTEM SHALL define a `LichessRepository` TypeScript interface with at minimum:
   - `getGame(gameId: string): Promise<LichessGame | null>`
   - `putGame(game: LichessGame): Promise<void>`
   - `listGames(opts?: { since?: number; limit?: number }): Promise<LichessGame[]>`
   - `clearAll(): Promise<void>`
   - `getOOBEvents(opts?: { limit?: number }): Promise<OOBEvent[]>`
   - `putOOBEvent(event: OOBEvent): Promise<void>`
2. THE concrete implementation SHALL back onto IndexedDB with two object stores: `lichess_games` (keyPath `id`) and `lichess_oob_events` (keyPath `[gameId, plyIndex]`).
3. THE `LichessGame` RECORD SHALL include: `id`, `createdAt` (epoch ms), `whiteUsername`, `blackUsername`, `userColor` (`'white' | 'black'`), `result`, `pgn`, `opening` (ECO + name if Lichess provided), `importedAt`, `oobChecked` (boolean).
4. THE `OOBEvent` RECORD SHALL include: `gameId`, `plyIndex`, `playedSAN`, `expectedSANs: string[]`, `color`, `fenAtOOB`, `openingEco?`, `openingName?`, `lineId?` (the picked repertoire line the game was tracking up to OOB), `detectedAt`.
5. CONSUMERS SHALL NEVER import the IndexedDB implementation directly — always via `getLichessRepository()` DI helper (Article 5).
6. THE STORE SHALL be idempotent on write: `putGame` on an existing ID overwrites only if `importedAt` is newer; OOB event upsert is by composite key.
7. THE STORE SHALL survive page reloads and the catalog refresh (game records are user data, not catalog data; Article 6 doesn't directly apply but `OOBEvent.lineId` must remain valid across catalog refreshes — see R5.7).

### Requirement 5: Out-of-book detection against picked repertoire

**User Story:** As a player, for each imported game I want to know the exact ply where I (or my opponent against my prep) left my picked repertoire — and what I should have played.

#### Acceptance Criteria

1. WHEN a new game is persisted to `lichess_games` THE SYSTEM SHALL enqueue OOB detection for that game; detection SHALL run async without blocking the sync UI.
2. THE detector SHALL parse the PGN into a ply sequence in SAN (Article 9) using `chess.js`.
3. THE detector SHALL load the user's **picked** repertoire (`RepertoirePick` from Phase 1.5) — NOT the full catalog. If no picks exist for the user's color in this game, the game SHALL be marked `oobChecked = true` with no OOB event emitted (degenerate case: user has no prep to compare against).
4. STARTING FROM PLY 0, THE detector SHALL walk the game move-by-move. At each ply played by the user's color, it SHALL check whether the played SAN matches *any* continuation in *any* picked line that is still alive (i.e., all prior plies of that line have matched).
5. WHEN the played move matches at least one alive picked line, THE detector SHALL continue (pruning dead lines).
6. WHEN the played move matches NO alive picked line, THE detector SHALL emit an `OOBEvent` with:
   - `plyIndex` = current ply
   - `playedSAN` = the move that diverged
   - `expectedSANs` = deduped set of next-move SANs from all alive picked lines at the prior ply
   - `fenAtOOB` = FEN before the played move
   - `openingEco`/`openingName` = from Lichess's `opening` field if present
   - `lineId` = the deepest alive picked line ID at the prior ply (if multiple, pick the longest; if still tied, lexicographic on line.id for determinism)
7. WHEN no OOB is detected for the full game (user stayed in book the entire game OR game ended before leaving book) THE detector SHALL mark `oobChecked = true` with no event. This is a valid outcome.
8. WHEN a picked line's `line.id` referenced by a stored `OOBEvent` no longer exists in the catalog (line removed in refresh), THE dashboard widget SHALL render the event with `lineId` shown as `(line removed)` and SHALL NOT crash. Article 6 guarantees IDs are stable; removal is permitted, renaming is not.
9. ONLY user-color moves count as OOB candidates. Opponent moves that diverge from prep are NOT OOB events (the opponent is not following the user's repertoire) — but they DO advance the FEN walk and may prune picked lines.
10. THE detector SHALL be deterministic: same input game + same picked repertoire = same OOB event(s). Tested with golden games (R8.3).

### Requirement 6: Transposition-aware OOB (optional, depends on Phase 2)

**User Story:** As a player who studies the Caro-Kann via 1.e4 c6 and the Slav via 1.d4 d5 2.c4 c6 (which can transpose), I want my game flagged as in-book if the FEN actually matches a picked line, even if the move order differs.

#### Acceptance Criteria

1. IF the Phase 2 position-keyed transposition index is available (detected via `getTranspositionIndex()` returning non-null), THE detector SHALL use it as a secondary check before declaring OOB.
2. BEFORE emitting an `OOBEvent` at ply N, THE detector SHALL compute the FEN after the played move and query the transposition index for any picked line that reaches that FEN at any ply.
3. IF a picked line is reached via transposition, THE detector SHALL NOT emit an OOB event; instead it SHALL switch the "alive line" tracking to the transposed line and continue.
4. IF the Phase 2 index is absent (graceful degrade), THE detector SHALL fall back to pure move-by-move matching (Requirement 5) — Phase 3 ships and works without Phase 2.
5. THE transposition check SHALL be FEN-normalized per Phase 2's normalization rules (en-passant target stripped when not legal, halfmove/fullmove ignored for matching).

### Requirement 7: Dashboard OOB widget + position viewer

**User Story:** As a player, I want a passive surface on the Dashboard listing my recent out-of-book moments, and clicking one shows the board at that position with my played move and what I should have played.

#### Acceptance Criteria

1. THE DASHBOARD SHALL include an "Out-of-book moments" widget below the existing "Drill N due" surface.
2. WHEN the user is not connected to Lichess, THE WIDGET SHALL render an empty state: "Connect Lichess in Settings to see when your games leave your prep." with a link to Settings.
3. WHEN connected with zero OOB events stored, THE WIDGET SHALL render: "No out-of-book moments yet. Sync your recent games in Settings."
4. WHEN OOB events exist, THE WIDGET SHALL render a list of up to 10 most recent events, each row showing: game date, opponent username, opening name (or "—"), ply number, played SAN, expected SAN(s) (first 2, with "+N more" if longer).
5. CLICKING an OOB row SHALL open a position viewer (modal or dedicated route `/lichess/oob/:gameId/:plyIndex`).
6. THE POSITION VIEWER SHALL render: the chess board at `fenAtOOB`, the played move highlighted in one color, the expected moves highlighted in another (using the Article 15 single highlight primitive), the line name + ECO if known, and a "View full game on Lichess" external link.
7. THE POSITION VIEWER SHALL NOT include AI commentary in Phase 3. A placeholder slot SHALL be reserved (e.g., `<CoachSlot />` component rendering null) so Phase 4 plugs in cleanly.
8. THE WIDGET SHALL NOT mutate repertoire picks, SRS state, or drill queue. Pure read surface.

### Requirement 8: Quality gates

**User Story:** As a maintainer, I want the OAuth flow, sync idempotency, and OOB detection covered by tests so the feature is safe to extend in Phase 4.

#### Acceptance Criteria

1. THE OAUTH PKCE FLOW SHALL have a unit test covering: code verifier generation, challenge derivation (SHA-256 + base64url), state parameter round-trip, token exchange request shape, and token rejection (401) handling.
2. THE SYNC PIPELINE SHALL have a test verifying idempotency: syncing the same Lichess response twice results in identical `lichess_games` store contents and no duplicate `OOBEvent` records.
3. THE OOB DETECTOR SHALL have a golden-game test suite with at least 5 fixtures covering:
   - Game that stays entirely in book (no OOB)
   - Game with user OOB at ply 6
   - Game with opponent leaving book but user staying in (no event for opponent move)
   - Game with no picked lines for user's color (no event, `oobChecked = true`)
   - Game with transposition that *should* be in-book when Phase 2 index is present (skipped if index absent)
4. TS strict (Article 14) — no `any` without an inline justification comment. Lint passes are merge-blocking.
5. THE `LichessRepository` interface SHALL have a contract test runnable against any future implementation (e.g., backend-served swap).

## Files touched (forecast)

- `src/lib/lichess/oauth.ts` — PKCE flow
- `src/lib/lichess/api.ts` — fetch wrappers for `/api/games/user/*` and `/game/export/*`
- `src/lib/lichess/repository.ts` — `LichessRepository` interface
- `src/lib/lichess/repository-idb.ts` — IndexedDB implementation
- `src/lib/lichess/detect-oob.ts` — OOB detection algorithm
- `src/lib/lichess/types.ts` — `LichessGame`, `OOBEvent`, scope constants
- `src/pages/Settings.tsx` — connect/disconnect/sync/manual-import UI
- `src/pages/LichessCallback.tsx` — OAuth callback route
- `src/pages/Dashboard.tsx` — OOB widget integration
- `src/components/OOBWidget.tsx`
- `src/components/OOBPositionViewer.tsx`
- `src/components/CoachSlot.tsx` — placeholder for Phase 4
- `src/routes.tsx` — `/lichess/callback`, `/lichess/oob/:gameId/:plyIndex`
- `tests/lichess/oauth.test.ts`
- `tests/lichess/sync.test.ts`
- `tests/lichess/detect-oob.test.ts` + `tests/lichess/fixtures/*.pgn`
- `specs/tech.md` — add Lichess API + `crypto.subtle` PKCE notes
- `README.md` — connect setup for dev + Docker

## Out of scope

- Lichess puzzle import (not aligned with repertoire trainer scope)
- Training position creation from OOB events (deferred — Phase 4 Coach may surface as suggestion, not auto-create)
- Opponent preparation (importing opponent's recent games to identify their pet lines)
- Real-time game-in-progress sync (live ongoing-game tracking via Lichess board API)
- Premium Lichess API features (cloud evals, server-side analysis)
- Chess.com sync (separate provider; if pursued, separate phase with own auth model)
- Server-side game storage (everything stays in IndexedDB per Article 11)
- Repertoire auto-mutation from OOB patterns (e.g., "you go OOB here 60% of the time — add this line?" — explicitly deferred to Phase 4 or later)

## Open questions

1. **Token encryption at rest.** Lichess tokens in `localStorage` are readable by any XSS payload. Worth wrapping in `crypto.subtle` AES-GCM with a user-supplied passphrase? Cost: extra UX step on every page load. Benefit: defense-in-depth. Default for v1: plain `localStorage` with `.sensitive` naming convention; revisit if XSS surface grows.
2. **Sync window for power users.** 100 games / 15 days fits weekend players. A user playing 20+ games/day will lose history older than ~5 days. Add a "Sync older window" advanced option in Settings (e.g., 30/60/90 days), or keep the hard cap simple?
3. **OOB attribution when multiple picked lines diverge at the same ply.** Requirement 5.6 deterministically picks the deepest line with lex-sort tiebreak. Should the UI instead show all candidate `lineId`s for that event, letting the user (or Phase 4 Coach) pick the most relevant context? Tradeoff: schema becomes `lineIds: string[]` vs `lineId: string`.

## Timebox

- Weekend pace (Article 13). Estimated 3 weekends:
  - Weekend 1: R1 (OAuth PKCE end-to-end) + R4 (repository scaffold)
  - Weekend 2: R2 + R3 (sync + manual import) + R5 (OOB detector + golden tests)
  - Weekend 3: R6 (transposition-aware) + R7 (dashboard widget + viewer) + R8 (quality gates polish)
- If the main AI/ML plan slips in any of these weekends, Phase 3 pauses. No exceptions.

## Constitution compliance

- Article 1 (OSS only): `chess.js` (MIT), browser-native `crypto.subtle`, no proprietary auth SDK. License audit before merge.
- Article 3 (No heavy AI orchestration): no agent framework; PKCE + fetch only. Phase 4 Coach will call SDKs directly when it lands.
- Article 4 (Real AI work): Phase 3 is plumbing; the AI feature lives in Phase 4. OOB event schema is designed for Coach RAG consumption.
- Article 5 (Repository pattern): all Lichess data behind `LichessRepository`. No direct IndexedDB imports in consumers.
- Article 6 (Stable line IDs): `OOBEvent.lineId` references the picked repertoire by stable ID; catalog removal is handled (R5.8); renaming is forbidden by the article itself.
- Article 9 (SAN): PGN parsed to SAN; all `playedSAN` / `expectedSANs` in SAN.
- Article 11 (Local-first): OAuth + sync are opt-in additive. App functions fully when disconnected; disconnect clears state. Dashboard widget degrades gracefully.
- Article 12 (Backend optional): Lichess CORS-friendly; no backend proxy needed. Self-hosted Docker users get the feature with no backend container.
- Article 13 (Weekend pace): 3-weekend timebox, pause-on-conflict honored.
- Article 14 (TS strict): no `any` without inline justification.
- Article 15 (Single highlight primitive): position viewer reuses the Phase 1.5 / Phase 4 shared square-highlight + tooltip component.
- Article 16 (Containerized distribution): callback URL configurable via env var; Docker image documents `LICHESS_OAUTH_ORIGIN` setup.
