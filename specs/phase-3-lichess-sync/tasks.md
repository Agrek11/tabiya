# Tasks: Phase 3 — Lichess Sync

Structured task list with explicit BlockedBy graph for maximum parallelism. Every task references requirements (R#) and design sections from this spec's `requirements.md` and `design.md`. Constitution articles cited inline where they bind.

Strategy: lock the IDB schema first, ship OAuth and the repository layer in parallel, then sync + manual import + detector in a second parallel wave, then UI surfaces, then quality gates. The detector (Phase 6) is the longest critical-path leg; everything that does not depend on it is fanned out around it.

---

## Implementation Tasks

### Phase 1: Setup — IDB schema bump + types + config scaffold

- [x] **Task 1.1**: Add Lichess module types
  - **ID**: `task-1.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/types.ts`
  - **Change**: Create file with `LichessColor`, `LichessResult`, `LichessOpening`, `LichessGame`, `OOBEvent`, `LICHESS_SCOPES`, error classes (`LichessAuthError`, `LichessRateLimitError`), and `StoredToken` types per design §4
  - **Outcome**: All Lichess data shapes typed; importable by repository, oauth, api, detector
  - **Context**: R4 AC3/AC4; design.md §4 Types block; Article 14 TS strict — no `any`

- [x] **Task 1.2**: Add Lichess config constants
  - **ID**: `task-1.2`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/config/lichess.ts`
  - **Change**: Export `LICHESS_CLIENT_ID` (`'tabiya-web'`), `LICHESS_OAUTH_AUTHORIZE_URL`, `LICHESS_OAUTH_TOKEN_URL`, `LICHESS_API_BASE`, `LICHESS_SCOPES`, `SYNC_WINDOW_DAYS=15`, `SYNC_MAX_GAMES=100`, `SYNC_RATE_LIMIT_MS=60_000`, `resolveRedirectUri()`
  - **Outcome**: Single source of truth for Lichess endpoints + tunables; Docker `LICHESS_OAUTH_ORIGIN` shim honored
  - **Context**: design.md §1 Endpoints + Redirect URL resolution; Article 16 (no host-only paths)

- [x] **Task 1.3**: Bump IDB schema to add `lichess_games` + `lichess_oob_events` stores
  - **ID**: `task-1.3`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/db.ts` (or wherever Phase 1's `openDB` upgrade callback lives)
  - **Change**: Bump DB version `+1`; in upgrade hook, conditionally create `lichess_games` (keyPath `id`, indices `by_playedAt` on `createdAt`, `by_openingEco` on `opening.eco`, `by_oobChecked` on `oobChecked`) and `lichess_oob_events` (keyPath `['gameId','plyIndex']`, indices `by_detectedAt` on `detectedAt`, `by_lineId` on `lineId`). Do NOT touch existing `srs_state` store
  - **Outcome**: Existing Phase 1 SRS data preserved; new stores available on next page load
  - **Context**: R4 AC2; design.md §4 Object stores; Article 5 (single DB, multi-store)

- [x] **Task 1.4**: Add async serial queue utility
  - **ID**: `task-1.4`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/async-serial-queue.ts`
  - **Change**: Implement `AsyncSerialQueue` with `enqueue(fn: () => Promise<void>): void` running tasks strictly sequentially; expose `size`, `idle: Promise<void>` for test sync
  - **Outcome**: Detection runs one game at a time without blocking sync UI
  - **Context**: design.md §5 Async scheduling; single-threaded JS — no point parallelizing CPU-bound detection

- [x] **Task 1.5**: Add `SensitiveStore` wrapper
  - **ID**: `task-1.5`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `security-reviewer`
  - **File**: `src/lib/lichess/sensitive-store.ts`
  - **Change**: Export `sensitiveStore` with `get<T>(key): T | null`, `set<T>(key, value): void`, `clear(key): void`. Backs onto `localStorage` for v1. Emit `console.warn` on first read in dev mode naming XSS risk. Interface designed so future AES-GCM-at-rest impl is a one-line swap
  - **Outcome**: Token storage centralized behind a named seam; XSS risk documented
  - **Context**: R1 AC6; design.md §1 Token storage; Open Question 1 deferral is intentional

---

### Phase 2: OAuth PKCE flow (R1)

- [x] **Task 2.1**: Implement PKCE primitives
  - **ID**: `task-2.1`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `security-reviewer`
  - **File**: `src/lib/lichess/oauth.ts`
  - **Change**: Export `generatePkcePair()` (32-byte verifier → SHA-256 → base64url challenge), `generateState()` (16-byte base64url), `buildAuthorizeUrl({verifier, state})`, `exchangeCodeForToken({code, verifier, state, returnedState})`, `revokeToken(token)`. Use `crypto.subtle` + `fetch` only. Validate state round-trip; throw `LichessAuthError('state_mismatch')` on mismatch. No third-party auth SDK
  - **Outcome**: PKCE flow callable from Settings + Callback page; pure functions, no DOM coupling
  - **Context**: R1 AC2/AC9; design.md §1 Code verifier/challenge + State parameter; Article 1 + Article 3 (no Auth0/Passport)

- [x] **Task 2.2**: OAuth unit tests
  - **ID**: `task-2.2`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/oauth.test.ts`
  - **Change**: Cover verifier length (43 chars), challenge derivation (known SHA-256 vector → expected base64url), state generation length, state round-trip mismatch throws, token exchange POST body shape (form-urlencoded with `grant_type`, `code`, `code_verifier`, `redirect_uri`, `client_id`), 401 path throws `LichessAuthError('rejected')`
  - **Outcome**: PKCE crypto and exchange wire format pinned by tests
  - **Context**: R8 AC1; design.md Test plan Unit table

- [x] **Task 2.3**: Lichess account fetch + token persistence helper
  - **ID**: `task-2.3`
  - **BlockedBy**: `task-2.1`, `task-1.5`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/oauth.ts` (extend)
  - **Change**: Add `fetchAndStoreAccount(accessToken)` that calls `GET /api/account`, builds `StoredToken { accessToken, tokenType:'Bearer', scope, obtainedAt, expiresAt, username }`, writes via `sensitiveStore.set('tabiya.lichess.token', ...)`. Returns `StoredToken`
  - **Outcome**: Callback page completes consent in one call after exchange
  - **Context**: R1 AC4; design.md §1 Token storage shape

- [x] **Task 2.4**: `LichessCallback` route component
  - **ID**: `task-2.4`
  - **BlockedBy**: `task-2.3`
  - **Agent**: `general-purpose`
  - **File**: `src/pages/LichessCallback.tsx`
  - **Change**: Read `code` + `state` from URL search params; read `verifier` + stored `state` from `sessionStorage` (`tabiya.lichess.oauthVerifier`, `tabiya.lichess.oauthState`); call `exchangeCodeForToken` then `fetchAndStoreAccount`; clear sessionStorage entries; navigate to `/settings#lichess` with success toast. On failure: clear sessionStorage, show "Authorization failed — try again" + Back-to-Settings link
  - **Outcome**: Round-trip completes; Settings re-renders into connected state
  - **Context**: R1 AC4; design.md §1 State parameter + Disconnect mechanics

- [x] **Task 2.5**: Register `/lichess/callback` route
  - **ID**: `task-2.5`
  - **BlockedBy**: `task-2.4`
  - **Agent**: `general-purpose`
  - **File**: `src/App.tsx` (or central router)
  - **Change**: Add `<Route path="/lichess/callback" element={<LichessCallback />} />`. Ensure route renders even when not connected (it IS the connect step)
  - **Outcome**: Browser arriving from Lichess hits the callback page
  - **Context**: R1 AC3; design.md Component tree (full)

- [x] **Task 2.6**: `LichessSection` Connect/Disconnect UI in Settings
  - **ID**: `task-2.6`
  - **BlockedBy**: `task-2.1`, `task-1.5`
  - **Agent**: `general-purpose`
  - **File**: `src/components/settings/LichessSection.tsx`
  - **Change**: Render two states based on `sensitiveStore.get('tabiya.lichess.token')`. Disconnected: "Connect Lichess" button → generate PKCE pair, store verifier + state in sessionStorage, navigate to authorize URL. Connected: show username + "Disconnect" button → best-effort `DELETE /api/token` → `sensitiveStore.clear` → `repo.clearAll()` → dispatch `lichess:disconnected` window event. Subscribe to `lichess:token-rejected` event → re-render into disconnected state with "Reconnect Lichess" prompt
  - **Outcome**: User can connect, disconnect, and observe the token-rejected fallback
  - **Context**: R1 AC1/AC7/AC8; design.md §1 Disconnect mechanics

- [x] **Task 2.7**: Mount `LichessSection` in Settings page
  - **ID**: `task-2.7`
  - **BlockedBy**: `task-2.6`
  - **Agent**: `general-purpose`
  - **File**: `src/pages/Settings.tsx`
  - **Change**: Add `<LichessSection />` to Settings page in a new "Lichess" section with anchor `#lichess`
  - **Outcome**: Settings page exposes the connect surface
  - **Context**: R1 AC1; design.md Component tree

---

### Phase 3: Sync endpoint client (R2)

- [x] **Task 3.1**: `authedFetch` wrapper + NDJSON stream parser
  - **ID**: `task-3.1`
  - **BlockedBy**: `task-1.5`, `task-1.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/lib/lichess/api.ts`
  - **Change**: Implement `authedFetch(url, init)` injecting `Authorization: Bearer <token>` from `sensitiveStore`; on 401 clear token + dispatch `lichess:token-rejected` + throw `LichessAuthError('rejected')`; on 429 throw `LichessRateLimitError(retryAfter)`. Implement `async function* streamNdjson<T>(response): AsyncGenerator<T>` with line-buffered `TextDecoder` per design §2
  - **Outcome**: Single fetch primitive used by sync + manual import + account fetch; native fetch only, zero npm deps added
  - **Context**: R2 AC2; design.md §HTTP client + §2 NDJSON streaming; Article 1 (no axios/ky)

- [x] **Task 3.2**: `getUserGames` sync client
  - **ID**: `task-3.2`
  - **BlockedBy**: `task-3.1`, `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/api.ts` (extend)
  - **Change**: Implement `async function* getUserGames(username, opts)` calling `GET /api/games/user/{username}?max=100&since={now - 15d}&pgnInJson=true&clocks=false&evals=false&opening=true` with `Accept: application/x-ndjson`. Yield mapped `LichessGame` records via `streamNdjson` + a `mapLichessApiGame(raw, username)` helper that resolves `userColor` from white/black username match, sets `importedAt = Date.now()`, `oobChecked = false`
  - **Outcome**: Streaming generator of synced games — caller controls termination
  - **Context**: R2 AC2/AC3; design.md §2

- [x] **Task 3.3**: Sync orchestrator (rate-limit + idempotency + counters)
  - **ID**: `task-3.3`
  - **BlockedBy**: `task-3.2`, `task-5.2`, `task-1.4`
  - **Agent**: `chief-programmer`
  - **File**: `src/lib/lichess/sync.ts`
  - **Change**: Implement `syncRecentGames({onProgress, onComplete})` — check `tabiya.lichess.lastSyncAt` rate gate (60s); read token username; iterate `getUserGames(username)`; for each game `existing = await repo.getGame(g.id)`: if `existing && existing.importedAt >= g.importedAt` increment `knownCount`, else `repo.putGame(g)` + `detectionQueue.enqueue(() => runDetection(g.id))` + increment `newCount`; call `onProgress({newCount, knownCount})` after each game; on stream end write `lastSyncAt = Date.now()` and call `onComplete`
  - **Outcome**: Idempotent, rate-limited sync; sync UI driven by `onProgress` callbacks
  - **Context**: R2 AC3/AC4/AC7; R4 AC6; design.md §2 Idempotency + Rate limit

- [x] **Task 3.4**: Sync UI in `LichessSection`
  - **ID**: `task-3.4`
  - **BlockedBy**: `task-3.3`, `task-2.6`
  - **Agent**: `general-purpose`
  - **File**: `src/components/settings/LichessSection.tsx` (extend)
  - **Change**: Add "Sync now" button (visible only when connected). On click: disable button, render progress text "Synced N games..." driven by `onProgress`. On complete: re-enable, show toast "Synced N new games, M already known". On rate-limit: tooltip "Wait Ns". On `LichessAuthError('rejected')`: dispatch already handled, re-render shows Reconnect CTA
  - **Outcome**: User-facing sync surface complete
  - **Context**: R2 AC1/AC4/AC5/AC6/AC7

- [x] **Task 3.5**: Sync pipeline tests
  - **ID**: `task-3.5`
  - **BlockedBy**: `task-3.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/sync.test.ts`
  - **Change**: Cover NDJSON line buffering across chunk boundaries (mock `Response.body` as `ReadableStream` with split chunks); idempotency (run sync twice on same response → identical `lichess_games` snapshot, no duplicate `OOBEvent` records); rate-limit gate (second call within 60s rejects); 429 → `LichessRateLimitError` with `Retry-After` parsed
  - **Outcome**: Sync pipeline pinned by tests; idempotency proven
  - **Context**: R8 AC2; design.md Test plan Unit table

---

### Phase 4: Manual import-by-ID (R3)

- [x] **Task 4.1**: `getGameById` client + ID validator
  - **ID**: `task-4.1`
  - **BlockedBy**: `task-3.1`, `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/api.ts` (extend)
  - **Change**: Export `LICHESS_ID_RE = /^[a-zA-Z0-9]{8}$/`, `validateGameId(id)`, and `getGameById(id)` calling `GET /game/export/{id}?pgnInJson=true&clocks=false&evals=false&opening=true` with `Accept: application/json`. Map response via shared `mapLichessApiGame`. 404 → throw `LichessNotFoundError`
  - **Outcome**: Single-game endpoint client; reuses mapping logic from sync
  - **Context**: R3 AC2/AC3/AC5; design.md §3

- [x] **Task 4.2**: Manual import flow + UI
  - **ID**: `task-4.2`
  - **BlockedBy**: `task-4.1`, `task-5.2`, `task-3.4`
  - **Agent**: `general-purpose`
  - **File**: `src/components/settings/LichessSection.tsx` (extend)
  - **Change**: Add "Import game by ID" text input + Import button (connected-only). On Import: validate via `validateGameId` → inline error "Game ID must be 8 letters/digits" if malformed; check `repo.getGame(id)` → if exists show "Already imported" (no fetch); else fetch via `getGameById` → `repo.putGame` → `detectionQueue.enqueue(() => runDetection(id))` → toast "Imported game vs {opponent}". 404 → inline "Game not found"
  - **Outcome**: Single-game import path live; same persistence + detection pipeline as sync
  - **Context**: R3 AC1/AC2/AC4/AC5/AC6; design.md §3 Flow

---

### Phase 5: `LichessRepository` + IDB persistence (R4)

- [x] **Task 5.1**: `LichessRepository` interface
  - **ID**: `task-5.1`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `api-designer`
  - **File**: `src/lib/lichess/repository.ts`
  - **Change**: Export `interface LichessRepository` with `getGame`, `putGame`, `listGames`, `clearAll`, `getOOBEvents(opts?: {limit?, offset?, gameId?})`, `putOOBEvent`, `markGameChecked(gameId)`. Doc comment on `putGame` documents idempotent overwrite semantics; doc on `getOOBEvents` documents reverse-chronological default ordering via `by_detectedAt` index
  - **Outcome**: One seam for all Lichess persistence; consumers depend on this only
  - **Context**: R4 AC1/AC5; design.md §4 Interface; Article 5

- [x] **Task 5.2**: IDB-backed implementation + DI accessor
  - **ID**: `task-5.2`
  - **BlockedBy**: `task-5.1`, `task-1.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/lib/lichess/repository-idb.ts`
  - **Change**: Implement `IdbLichessRepository` using shared `tabiya` DB. `putGame`: read existing, no-op if `existing.importedAt >= game.importedAt`, else `put`. `putOOBEvent`: direct `put` (composite key idempotent). `getOOBEvents`: reverse cursor on `by_detectedAt` honoring `limit`/`offset`/`gameId` filter. `clearAll`: clear both stores in one transaction. Also create `src/lib/lichess/repository-di.ts` exporting `getLichessRepository(): LichessRepository` singleton + `__setLichessRepositoryForTest(impl)`
  - **Outcome**: Concrete persistence layer hidden behind interface + DI
  - **Context**: R4 AC2/AC5/AC6; design.md §4 DI accessor + Idempotent write semantics

- [x] **Task 5.3**: Repository contract test
  - **ID**: `task-5.3`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/repository-contract.test.ts`
  - **Change**: Export `runLichessRepositoryContract(name, makeRepo: () => Promise<LichessRepository>)` describing: empty start, put/get round-trip, put idempotency on equal `importedAt`, list ordering, OOB event upsert on composite key, `getOOBEvents` returns reverse-chronological, `clearAll` empties both stores, `markGameChecked` flips boolean. Reusable across implementations
  - **Outcome**: Future backend-served impl ships only when this suite passes against it
  - **Context**: R8 AC5; design.md Test plan; Article 5

- [x] **Task 5.4**: IDB impl + in-memory test double
  - **ID**: `task-5.4`
  - **BlockedBy**: `task-5.2`, `task-5.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/repository-idb.test.ts`
  - **Change**: Create `InMemoryLichessRepository` test double (Map-backed) inside the test file or `tests/lichess/test-doubles.ts`. Run contract suite against both `IdbLichessRepository` (via `fake-indexeddb`) and `InMemoryLichessRepository`. Proves interface is implementation-agnostic
  - **Outcome**: Two impls, one contract; Article 5 enforced by test
  - **Context**: R8 AC5

- [x] **Task 5.5**: PGN→SAN helper
  - **ID**: `task-5.5`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/pgn.ts`
  - **Change**: Export `parsePgnToSan(pgn: string): string[]` using `chess.js` (`new Chess(); chess.loadPgn(pgn); return chess.history()`). On `loadPgn` failure, throw `LichessPgnError` with the original error attached. Test that annotations + clock comments are stripped by `chess.js` (no manual scrubbing)
  - **Outcome**: Single PGN parser used by detector
  - **Context**: R5 AC2; Article 9 (SAN throughout); design.md §5 Algorithm

---

### Phase 6: OOB detection algorithm (R5)

- [x] **Task 6.1**: Picked-repertoire adapter
  - **ID**: `task-6.1`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `architect`
  - **File**: `src/lib/lichess/picked-lines.ts`
  - **Change**: Export `loadPickedLinesForColor(color: LichessColor): Promise<PickedLine[]>` reading from Phase 1.5 `RepertoirePick` store via its repository. Map to detector-shaped `PickedLine { id, color, plies: string[], openingEco?, openingName? }`. Returns `[]` when no picks exist for that color
  - **Outcome**: Detector decoupled from Phase 1.5 storage shape
  - **Context**: R5 AC3; design.md §5 Inputs; Article 5

- [x] **Task 6.2**: Linear OOB detector
  - **ID**: `task-6.2`
  - **BlockedBy**: `task-5.5`, `task-6.1`, `task-1.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/lib/lichess/detect-oob.ts`
  - **Change**: Implement `detectOOB(input: DetectInput): Promise<OOBEvent | null>` per design §5 algorithm. Walk plies, prune alive lines on opponent moves, emit `OOBEvent` on first user-color divergence with `expectedSANs` sorted lex + deduped, `lineId` = deepest alive (lex tiebreak via `pickDeepestAlive`), `fenAtOOB` = board FEN before played move. Return `null` for: no picks for user color, opponent leaves book, full-book game. Determinism: no `Date.now()` inside loop, only at emission for `detectedAt`
  - **Outcome**: Deterministic, replayable OOB events keyed to stable line IDs
  - **Context**: R5 AC1–AC10; Article 6; Article 9; design.md §5 Algorithm + Determinism

- [x] **Task 6.3**: Detection runner + queue wiring
  - **ID**: `task-6.3`
  - **BlockedBy**: `task-6.2`, `task-5.2`, `task-1.4`
  - **Agent**: `general-purpose`
  - **File**: `src/lib/lichess/run-detection.ts`
  - **Change**: Export module-level `detectionQueue = new AsyncSerialQueue()` and `runDetection(gameId: string): Promise<void>`. `runDetection` loads game via `repo.getGame`, returns early if `oobChecked`, loads picked lines via `loadPickedLinesForColor(game.userColor)`, calls `detectOOB`, if event `await repo.putOOBEvent(event)`, then always `await repo.markGameChecked(gameId)`. Catches `LichessPgnError` → log warn, still mark checked (R5 doesn't block on malformed PGN)
  - **Outcome**: Single entrypoint sync + manual-import call after every `putGame`
  - **Context**: R5 AC1; design.md §5 Async scheduling + Failure modes (malformed PGN)

- [x] **Task 6.4**: Detector golden-game tests
  - **ID**: `task-6.4`
  - **BlockedBy**: `task-6.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/detect-oob.test.ts` + `tests/lichess/fixtures/*.pgn`
  - **Change**: Five fixtures: `game-in-book.pgn`, `game-oob-ply6.pgn`, `game-opponent-oob.pgn`, `game-no-picks.pgn`, `game-transposition.pgn`. For each: hardcode the picked-lines input + expected `OOBEvent | null`. Mock `Date.now()` so `detectedAt` is deterministic. Assert: full event shape match, `expectedSANs` sorted, `lineId` tiebreak deterministic, two consecutive runs produce identical event (idempotency-in-detector)
  - **Outcome**: Detector pinned against five canonical scenarios; regression-proof
  - **Context**: R8 AC3; design.md Test plan Unit table

---

### Phase 7: Optional transposition-aware OOB (R6)

- [x] **Task 7.1**: Transposition-aware detector branch
  - **ID**: `task-7.1`
  - **BlockedBy**: `task-6.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/lib/lichess/detect-oob.ts` (extend)
  - **Change**: Inside `detectOOB`, before emitting an OOB event at ply N: import `getTranspositionIndex` from `src/lib/transposition` (Phase 2); if returns non-null, compute `fenAfterPlayed` by `board.move(played); fen = board.fen(); board.undo()`; normalize via Phase 2's `normalizeFen` helper; query `idx.findLinesReachingFen(normalizedFen, {color: userColor, pickedOnly: true})`; if any match, switch `alive` to the transposed lines at their reached depth + 1 and continue (no event emitted). If `getTranspositionIndex` returns null, skip this branch entirely
  - **Outcome**: Caro-Kann/Slav transposition recognized as in-book when Phase 2 index exists
  - **Context**: R6 AC1–AC5; design.md §6

- [x] **Task 7.2**: Transposition test (conditionally skipped)
  - **ID**: `task-7.2`
  - **BlockedBy**: `task-7.1`, `task-6.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/detect-oob.test.ts` (extend)
  - **Change**: Add transposition fixture test using `describe.skipIf(getTranspositionIndex() === null)`. Provide a stub `transpositionIndex` via `__setTranspositionIndexForTest` for the test even if Phase 2 not present, OR genuinely skip if Phase 2 module absent at build time. Verify game-transposition.pgn produces `null` (in-book) when index is loaded
  - **Outcome**: Transposition path verified; graceful degrade documented
  - **Context**: R6 AC4; R8 AC3 (5th fixture)

---

### Phase 8: Dashboard OOB widget + position viewer + CoachSlot placeholder (R7)

- [x] **Task 8.1**: `<CoachSlot>` placeholder component
  - **ID**: `task-8.1`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `architect`
  - **File**: `src/components/CoachSlot.tsx`
  - **Change**: Export `CoachSlotProps` with full payload (`gameId`, `plyIndex`, `fenAtOOB`, `playedSAN`, `expectedSANs`, `lineId`) and `CoachSlot` component returning `null`. Document that Phase 4 replaces ONLY this file's body with the Coach drawer — no prop or type changes
  - **Outcome**: Phase 4 plug-point reserved with stable contract
  - **Context**: R7 AC7; design.md §7 `<CoachSlot>` placeholder; Article 4 (forward-compat for AI feature)

- [x] **Task 8.2**: `OOBWidget` dashboard component
  - **ID**: `task-8.2`
  - **BlockedBy**: `task-5.2`, `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `src/components/dashboard/OOBWidget.tsx`
  - **Change**: Subscribe to `lichess:disconnected` + `lichess:token-rejected` events to re-render. Compute `connected` from `sensitiveStore.get('tabiya.lichess.token')`. Read events via `repo.getOOBEvents({limit: 10, offset})`. Three render states: not-connected empty state (link to `/settings#lichess`), connected-no-events empty state, list state with `OOBEventRow × N` + "Load more" button incrementing offset. Pure read surface — no mutation
  - **Outcome**: Dashboard widget renders all three states correctly
  - **Context**: R7 AC1–AC4, AC8; design.md §7 Component tree + Empty states

- [x] **Task 8.3**: `OOBEventRow` component
  - **ID**: `task-8.3`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `src/components/dashboard/OOBEventRow.tsx`
  - **Change**: Render one row with game date (from `LichessGame.createdAt`, fetched via `repo.getGame(event.gameId)` or denormalized into event in a follow-up — design says join at render), opponent username (resolved from `userColor`), opening name + ECO (or "—"), ply number, played SAN, first 2 expected SANs + "+N more" indicator. Row click → `navigate(/lichess/oob/${gameId}/${plyIndex})`
  - **Outcome**: Compact dense row; click → viewer
  - **Context**: R7 AC4/AC5

- [x] **Task 8.4**: `OOBPositionViewerPage` route
  - **ID**: `task-8.4`
  - **BlockedBy**: `task-5.2`, `task-8.1`
  - **Agent**: `general-purpose`
  - **File**: `src/pages/OOBPositionViewerPage.tsx`
  - **Change**: Read `gameId`, `plyIndex` from route params. Load event via `repo.getOOBEvents({gameId})` filter to ply. Render: `<BoardAtFEN fen={event.fenAtOOB} interactive={false} />` with `<HighlightOverlay>` (Phase 1.5 primitive) showing playedMove in color A and expectedMoves in color B; metadata panel with opening name + ECO + "You played: X / Expected: A, B (+1 more)" + linkified lineId (or "(line removed)" if `getOpeningRepository().getLineById(lineId)` null); `<CoachSlot {...props} />`; external link `https://lichess.org/{gameId}/{userColor}#{plyIndex}` with `target="_blank" rel="noopener"`
  - **Outcome**: Full position context displayed; Phase 4 plug-point already mounted
  - **Context**: R7 AC5–AC7; R5 AC8 (line-removed handling); Article 15 (shared highlight primitive)

- [x] **Task 8.5**: Register `/lichess/oob/:gameId/:plyIndex` route
  - **ID**: `task-8.5`
  - **BlockedBy**: `task-8.4`
  - **Agent**: `general-purpose`
  - **File**: `src/App.tsx`
  - **Change**: Add `<Route path="/lichess/oob/:gameId/:plyIndex" element={<OOBPositionViewerPage />} />`
  - **Outcome**: Viewer reachable from widget clicks + direct URL
  - **Context**: R7 AC5

- [x] **Task 8.6**: Mount `OOBWidget` in Dashboard
  - **ID**: `task-8.6`
  - **BlockedBy**: `task-8.2`
  - **Agent**: `general-purpose`
  - **File**: `src/pages/Dashboard.tsx`
  - **Change**: Insert `<OOBWidget />` below existing `<DrillDueWidget />`. No other layout changes
  - **Outcome**: Widget visible on Dashboard
  - **Context**: R7 AC1

---

### Phase 9: Quality gates (R8) + Docker + docs

- [x] **Task 9.1**: Integration test — connect → sync → display
  - **ID**: `task-9.1`
  - **BlockedBy**: `task-3.4`, `task-8.6`, `task-6.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/connect-sync-display.test.tsx`
  - **Change**: Mock Lichess endpoints (MSW or fetch mock). Render full app with router. Drive: click Connect (in Settings) → simulate Lichess redirect to `/lichess/callback?code=X&state=Y` → assert token stored → navigate Dashboard → click Sync (in Settings) → stream 3 NDJSON games → assert 2 OOB events emitted → assert Dashboard widget renders 2 rows. Use `InMemoryLichessRepository` via `__setLichessRepositoryForTest`
  - **Outcome**: End-to-end flow proven in test environment
  - **Context**: R8 (integration); design.md Test plan Integration table

- [x] **Task 9.2**: Integration test — disconnect clears everything
  - **ID**: `task-9.2`
  - **BlockedBy**: `task-3.4`, `task-8.6`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/disconnect-clears-everything.test.tsx`
  - **Change**: Seed token + games + events in `InMemoryLichessRepository`. Render Settings. Click Disconnect. Assert: `sensitiveStore.get('tabiya.lichess.token')` null, `repo.listGames()` empty, `repo.getOOBEvents()` empty, OOBWidget shows not-connected empty state
  - **Outcome**: Disconnect contract proven
  - **Context**: R1 AC7; design.md §1 Disconnect mechanics

- [x] **Task 9.3**: Integration test — token-rejected mid-sync
  - **ID**: `task-9.3`
  - **BlockedBy**: `task-3.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/lichess/token-rejected-mid-sync.test.tsx`
  - **Change**: Mock NDJSON response that returns 401 after first game. Drive sync. Assert: first game persisted, token cleared, `lichess:token-rejected` dispatched, Settings shows "Reconnect Lichess" CTA
  - **Outcome**: 401-mid-stream failure mode pinned
  - **Context**: R1 AC8; design.md Failure modes table

- [x] **Task 9.4**: License audit script
  - **ID**: `task-9.4`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `scripts/check_phase3_deps.ts`
  - **Change**: Diff `package.json` dependencies + devDependencies against the Phase 1c baseline (stored as `scripts/baseline-phase1c-deps.json`). Fail with exit 1 if any new entry appears. Hook into `npm test` or CI
  - **Outcome**: Zero-new-deps invariant enforced at CI
  - **Context**: design.md §HTTP client + Constitution compliance; Article 1

- [x] **Task 9.5**: ESLint rule tightened for `src/lib/lichess/**`
  - **ID**: `task-9.5`
  - **BlockedBy**: `task-1.1`
  - **Agent**: `general-purpose`
  - **File**: `.eslintrc.cjs` (or equivalent)
  - **Change**: Add override block for `src/lib/lichess/**` setting `@typescript-eslint/no-explicit-any` to `error`. Lint passes are merge-blocking
  - **Outcome**: Lichess module typed strictly; no `any` smuggled in
  - **Context**: R8 AC4; Article 14

- [x] **Task 9.6**: Docker `LICHESS_OAUTH_ORIGIN` shim
  - **ID**: `task-9.6`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `general-purpose`
  - **File**: `docker/frontend.Dockerfile` + `docker/entrypoint.sh`
  - **Change**: At container start, run `envsubst '${LICHESS_OAUTH_ORIGIN}' < /usr/share/nginx/html/index.html.tpl > /usr/share/nginx/html/index.html` to inject `window.LICHESS_OAUTH_ORIGIN = "..."` shim. Default empty (falls back to `window.location.origin`)
  - **Outcome**: Self-hosted Docker users configure callback origin via env var only
  - **Context**: R1 AC3; Article 16; design.md §1 Redirect URL resolution

- [x] **Task 9.7**: Update `tech.md` + README
  - **ID**: `task-9.7`
  - **BlockedBy**: `task-9.4`, `task-9.6`
  - **Agent**: `general-purpose`
  - **File**: `specs/tech.md` + `README.md`
  - **Change**: `tech.md`: add Lichess REST API + `crypto.subtle` PKCE notes; record zero-new-deps audit; note `LICHESS_OAUTH_ORIGIN` env var. `README.md`: add "Connect Lichess" section for dev (Vite `http://localhost:5173/lichess/callback` registered with Lichess client) + Docker (`LICHESS_OAUTH_ORIGIN=https://your.host`)
  - **Outcome**: Phase 3 setup documented for both dev and self-hosted paths
  - **Context**: R1 AC3 + R1 AC9; design.md File tree forecast

- [x] **Task 9.8**: Coverage gates
  - **ID**: `task-9.8`
  - **BlockedBy**: `task-9.1`, `task-9.2`, `task-9.3`, `task-6.4`, `task-5.4`
  - **Agent**: `testability-reviewer`
  - **File**: `vitest.config.ts` (or coverage config)
  - **Change**: Add per-file coverage thresholds: `src/lib/lichess/**` ≥ 85% line, `src/lib/lichess/detect-oob.ts` = 100% line + branch. Wire into `npm test -- --coverage` CI step
  - **Outcome**: Coverage drift caught at CI
  - **Context**: design.md Quality gates (R8); R8 AC3 + AC4

---

## Dependency Diagram

```
                        ┌─────────────────┐
                        │  task-1.1 types │
                        └────────┬────────┘
                                 │
        ┌──────────┬─────────────┼──────────────┬──────────────┐
        │          │             │              │              │
   ┌────▼───┐ ┌───▼────┐ ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
   │task-1.3│ │task-1.5│ │  task-5.1   │ │ task-6.1  │ │  task-8.1   │
   │IDB bump│ │sensitive│ │ Repo iface  │ │picked-lines│ │ CoachSlot   │
   └────┬───┘ └───┬────┘ └──────┬──────┘ └─────┬─────┘ └─────────────┘
        │         │             │              │
   ┌────┴──┐      │       ┌─────┴─────┐        │
   │       │      │       │           │        │
   │  ┌────▼──────▼──┐  ┌─▼────┐  ┌──▼────┐    │
   │  │  task-5.2    │  │task- │  │task-  │    │
   │  │  IDB impl+DI │  │ 5.3  │  │ 5.4   │    │
   │  └──┬───────────┘  │contract│ │idb+mem│    │
   │     │              └──┬───┘  └───────┘    │
   │     │                 │                   │
   │  ┌──▼────────┐        │                   │
   │  │ task-5.5  │        │                   │
   │  │ pgn helper│        │                   │
   │  └──┬────────┘        │                   │
   │     │                 │                   │
   │  ┌──▼─────────────────┴──┐                │
   │  │      task-6.2         │                │
   │  │  detector (linear)    │                │
   │  └───┬───────────────┬───┘                │
   │      │               │                    │
   │  ┌───▼──────┐   ┌────▼─────┐              │
   │  │ task-6.3 │   │ task-6.4 │              │
   │  │ runner   │   │ golden t.│              │
   │  └───┬──────┘   └──────────┘              │
   │      │                                    │
   │      │   ┌─────────────┐                  │
   │      │   │  task-7.1   │                  │
   │      │   │ transp-OOB  │                  │
   │      │   └──────┬──────┘                  │
   │      │          │                         │
   │      │   ┌──────▼─────┐                   │
   │      │   │ task-7.2   │                   │
   │      │   │transp test │                   │
   │      │   └────────────┘                   │
   │      │                                    │
   │      │              ┌────────────────┐    │
   │      │              │   task-8.2     │    │
   │      └──────────────│   OOBWidget    │◄───┤
   │                     └────┬───────────┘    │
   │                          │                │
   │              ┌───────────▼──────┐         │
   │              │    task-8.6      │         │
   │              │  mount Dashboard │         │
   │              └──────────────────┘         │
   │                                           │
   │  ┌────────────────────────────────────────┘
   │  │
   │  │  ┌────────────┐    ┌────────────┐
   │  │  │  task-8.3  │    │  task-8.4  │
   │  │  │  EventRow  │    │ ViewerPage │
   │  │  └────────────┘    └──────┬─────┘
   │  │                           │
   │  │                    ┌──────▼─────┐
   │  │                    │  task-8.5  │
   │  │                    │ route reg  │
   │  │                    └────────────┘
   │  │
   │  │ ┌──────────────────────────────────┐
   │  │ │            task-1.2              │
   │  │ │         config constants         │
   │  │ └──┬──────────────┬──────────────┬─┘
   │  │    │              │              │
   │  │ ┌──▼───┐      ┌───▼────┐    ┌────▼─────┐
   │  │ │ 2.1  │      │  3.1   │    │   9.6    │
   │  │ │ PKCE │      │authFtch│    │ Docker   │
   │  │ └──┬───┘      └───┬────┘    │  shim    │
   │  │    │              │         └──────────┘
   │  │ ┌──▼───┐       ┌──▼───┐
   │  │ │ 2.2  │       │ 3.2  │
   │  │ │tests │       │getUsr│
   │  │ └──────┘       │Games │
   │  │ ┌──▼────┐      └──┬───┘
   │  │ │ 2.3   │         │
   │  │ │acct+st│         │
   │  │ └──┬────┘    ┌────▼─────┐
   │  │    │         │ task-1.4 │
   │  │ ┌──▼────┐    │serialQ   │
   │  │ │ 2.4   │    └────┬─────┘
   │  │ │Callbk │         │
   │  │ └──┬────┘    ┌────▼──────┐
   │  │    │         │ task-3.3  │◄─── needs task-5.2 (repo)
   │  │ ┌──▼────┐    │   sync    │
   │  │ │ 2.5   │    │orchestrtr │
   │  │ │route  │    └────┬──────┘
   │  │ └───────┘         │
   │  │ ┌──▼────┐    ┌────▼─────┐
   │  │ │ 2.6   │    │ task-3.4 │
   │  │ │LichSec│    │ Sync UI  │
   │  │ │ UI    │    └────┬─────┘
   │  │ └──┬────┘         │
   │  │    │         ┌────▼─────┐
   │  │ ┌──▼────┐    │ task-3.5 │
   │  │ │ 2.7   │    │ sync tst │
   │  │ │mount  │    └──────────┘
   │  │ └───────┘
   │  │
   │  │ ┌──────────┐
   │  │ │ task-4.1 │◄─── task-3.1
   │  │ │ getById  │
   │  │ └────┬─────┘
   │  │      │  + task-5.2 + task-3.4
   │  │ ┌────▼─────┐
   │  │ │ task-4.2 │
   │  │ │ manual UI│
   │  │ └──────────┘
   │
   │  Convergence into integration + quality gates:
   │  ┌─────────────────────────────────────────┐
   └─▶│   task-9.1 (sync+display integration)   │ ◄─ 3.4 + 8.6 + 6.3
      │   task-9.2 (disconnect clears)          │ ◄─ 3.4 + 8.6
      │   task-9.3 (token-rejected mid-sync)    │ ◄─ 3.4
      │   task-9.4 (license audit script)       │ ◄─ 1.1
      │   task-9.5 (eslint tighten)             │ ◄─ 1.1
      │   task-9.6 (docker shim)                │ ◄─ 1.2
      │   task-9.7 (tech.md + README)           │ ◄─ 9.4 + 9.6
      │   task-9.8 (coverage gates)             │ ◄─ 9.1/9.2/9.3/6.4/5.4
      └─────────────────────────────────────────┘
```

### Parallel opportunities

Five fan-out waves are exposed:

- **Wave A (after `task-1.1`)** runs five tasks fully in parallel: `task-1.3` (IDB schema), `task-1.5` (SensitiveStore), `task-5.1` (Repository interface), `task-6.1` (PickedLines adapter), `task-8.1` (CoachSlot placeholder). Independent files, no shared mutation.
- **Wave B (after `task-1.2`)** branches into three independent legs: OAuth (`task-2.1` → `2.2`/`2.3`), API client (`task-3.1` → `3.2`), Docker shim (`task-9.6`).
- **Wave C (after `task-5.1`)** branches: `task-5.2` (IDB impl + DI) parallel to `task-5.3` (contract suite). They reunite at `task-5.4`.
- **Wave D (after `task-6.2`)** the detector forks: `task-6.3` (runner) parallel to `task-6.4` (golden tests) parallel to `task-7.1` (transposition branch). Three contributors can work this leg simultaneously.
- **Wave E (after `task-8.2`)** the UI branches: `task-8.3` (EventRow) parallel to `task-8.4` (ViewerPage). Reunite at `task-8.5` + `task-8.6`.

Tests (`task-2.2`, `task-3.5`, `task-5.4`, `task-6.4`, `task-7.2`) run parallel with all consumer-facing tasks gated on the same code being written; they are never on the critical path.

### Critical path

The longest dependency chain is:

```
task-1.1 → task-5.1 → task-5.2 → task-5.5 → task-6.2 → task-6.3 → task-9.1 → task-9.8
```

Eight tasks. Detector + IDB persistence dominate the schedule because they are mutually dependent and feed every integration test. The OAuth leg (`1.1 → 1.2 → 2.1 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 3.4 → 9.1`) is comparable in step count but each task is smaller; the detector tasks are individually larger.

The Phase 7 transposition leg is OFF the critical path — `task-7.1`/`task-7.2` can ship after `task-9.1` lands without blocking quality gates, since Phase 6's linear path satisfies R5 standalone (Phase 2 is optional per R6 AC4).

---

## Completion Criteria

Phase 3 is **done** when all of the following hold:

1. **Functional**
   - User can click "Connect Lichess" in Settings, complete the PKCE round-trip, and see their connected username — without any third-party auth SDK in the bundle (Article 1, Article 3).
   - "Sync now" pulls up to 100 games OR 15 days (whichever is fewer) idempotently; re-clicking within 60s shows the rate-limit tooltip; re-clicking after settles to 0 new games for the same window.
   - Manual import accepts an 8-char Lichess ID, rejects malformed input inline, surfaces "Game not found" on 404, surfaces "Already imported" without a network call for known IDs.
   - "Disconnect" wipes `tabiya.lichess.token`, both IDB stores, and the OOBWidget reverts to its empty state.
   - Token-rejected (401) anywhere clears the token and surfaces a "Reconnect Lichess" CTA without crashing.

2. **Detection correctness**
   - All five golden-game tests pass deterministically against the linear detector.
   - Transposition test passes when Phase 2 index is present and is conditionally skipped when absent — both paths verified in CI.
   - `OOBEvent` records survive catalog refreshes; `(line removed)` shown when source line deleted.

3. **Constitution compliance audited**
   - Article 1: `scripts/check_phase3_deps.ts` reports zero new npm dependencies vs Phase 1c baseline.
   - Article 5: `grep -rn "IdbLichessRepository" src/ | grep -v "src/lib/lichess/"` returns empty — no direct concrete imports.
   - Article 6: `OOBEvent.lineId` references picked-repertoire IDs only; renaming forbidden + removal handled.
   - Article 9: `playedSAN`, `expectedSANs`, all detector internals are SAN; PGN parsed via `chess.js`.
   - Article 11: network call enumeration table (design.md) verified at runtime — zero calls fire on app boot or while disconnected.
   - Article 12: no backend service shipped; `backend/` empty; `docker-compose.yml` retains frontend-only.
   - Article 14: ESLint passes; `@typescript-eslint/no-explicit-any` set to error for `src/lib/lichess/**`.
   - Article 15: `OOBPositionViewer` reuses Phase 1.5 `HighlightOverlay`, not a fork.
   - Article 16: `LICHESS_OAUTH_ORIGIN` env var documented; `docker compose up` ships Phase 3 with one env edit.

4. **Quality gates**
   - All `tests/lichess/**` suites green; integration tests cover connect→sync→display, disconnect-clears-everything, token-rejected-mid-sync, manual-import-already-known.
   - Coverage: `src/lib/lichess/**` ≥ 85% line; `detect-oob.ts` = 100% line + branch.
   - Repository contract suite passes against both `IdbLichessRepository` and `InMemoryLichessRepository`.
   - `npx tsc --noEmit` produces zero new TS errors beyond Phase 1 baseline.
   - `npm run lint` passes with the tightened Lichess rule.

5. **Documentation**
   - `specs/tech.md` lists Lichess REST + `crypto.subtle` PKCE under the technology inventory; records zero-new-deps audit.
   - `README.md` documents both dev (`http://localhost:5173/lichess/callback`) and Docker (`LICHESS_OAUTH_ORIGIN`) callback setup.
   - Phase 3 status updated in any external tracker (`tabiya.md` Implementation Status, `features.md`).

6. **Phase 4 readiness**
   - `<CoachSlot>` placeholder mounts in `OOBPositionViewer` with the full event payload; Phase 4 plugs in by editing only `src/components/CoachSlot.tsx`.
   - `OOBEvent` records are replayable: `fenAtOOB`, `lineId`, `expectedSANs`, `playedSAN` together let a Coach RAG pipeline reconstruct the moment without re-running the detector (Article 4 forward-compat).

---

## Summary

37 tasks across 9 phases. Critical path is 8 tasks long (types → repository interface → IDB impl → PGN helper → linear detector → detection runner → connect-sync-display integration → coverage gates), dominated by the persistence-layer-to-detector chain. Five distinct fan-out waves expose substantial parallelism — the OAuth leg, the API client leg, and the Docker shim leg all run concurrently after `task-1.2`; the detector forks into runner + golden tests + transposition branch after `task-6.2`. Phase 7 (transposition) is intentionally off the critical path and degrades gracefully when Phase 2 is absent. Phase 9 closes with explicit Article 1 / 5 / 11 / 12 / 14 / 15 / 16 audit gates so Phase 4 inherits a clean, contract-tested foundation for the Coach.

---

## Addendum — chess.com integration SHIPPED (2026-06-11)

"Chess.com sync" moved from Out-of-scope to done, by user request. Design:
- **No OAuth** — chess.com Published-Data API (`api.chess.com/pub/*`) is
  public read-only + CORS-enabled; the only config is a username
  (`tabiya:chesscom:username`, plain localStorage — public info, not a secret).
- **Full pipeline reuse:** games map into the same stored shape with an
  additive `source: 'lichess' | 'chesscom'` field (legacy rows = lichess via
  `gameSource()`); same IDB stores, same `LichessRepository`, same OOB
  detector/queue, same window (100 games / 15 days) + idempotency.
- Sync walks monthly archives overlapping the window; variants
  (`rules !== 'chess'`) and no-PGN records skipped; ECO/opening parsed from
  PGN headers. No manual import (API has no game-by-id endpoint).
- UI: `ChessComSection` Settings card (Link/Unlink/Sync); Unlink deletes that
  provider's rows via new `LichessRepository.clearSource(source)`; Dashboard
  widget rows carry a provider badge; viewer external link branches per source.
- Tests: tests/lichess/chesscom.test.ts (mapping, draw/win codes, ECO parse,
  archive windowing, sync idempotency via shared ingest, clearSource).
