# Design: Phase 3 — Lichess Sync

## Overview

Phase 3 is **data-ingestion + diff plumbing**. It introduces one external dependency (Lichess REST), one new persistence layer (`lichess_games` + `lichess_oob_events` in IndexedDB), one detector module (`detect-oob.ts`), and one passive Dashboard surface (OOB widget). It introduces zero new dependencies on npm — PKCE uses `crypto.subtle`, HTTP uses native `fetch`, PGN parsing uses the existing `chess.js` dep (Article 1, Article 3).

The phase is **opt-in additive** end-to-end: every code path that touches Lichess is gated on `tabiya.lichess.token` being present in `localStorage`. When that key is absent the new modules are inert — the Dashboard widget renders an empty state, no network calls fire, no IndexedDB stores are opened beyond an existence check (Article 11).

The phase is **backend-free**. Lichess's REST API serves browser-origin CORS for the endpoints we use, so the browser fetches directly. No FastAPI service ships in this phase — `backend/` stays empty until Phase 4 lands the Coach (Article 12).

The phase produces **structured replayable OOB events** keyed by stable line IDs so Phase 4 Coach can consume them as RAG context without revisiting Phase 3's algorithms (Article 4, Article 6).

## Module map

```
src/lib/lichess/
├── oauth.ts           # PKCE flow: verifier, challenge, authorize URL, exchange
├── api.ts             # fetch wrappers: getUserGames, getGameById, getMe
├── types.ts           # LichessGame, OOBEvent, scope constants, error types
├── repository.ts      # LichessRepository interface (Article 5)
├── repository-idb.ts  # IndexedDB-backed impl via `idb`
├── repository-di.ts   # getLichessRepository() singleton accessor
├── detect-oob.ts      # OOB detection: linear + transposition-aware
└── pgn.ts             # PGN → ply[] SAN helper (thin chess.js wrapper)
```

Single seam per Article 5. Consumers (`Settings.tsx`, `OOBWidget.tsx`, `LichessCallback.tsx`) import only the interface + the DI accessor, never the IDB impl.

## 1. R1 — OAuth PKCE connect + disconnect

### Endpoints

| Purpose | Method | URL |
|---|---|---|
| Authorize | redirect (browser) | `https://lichess.org/oauth?response_type=code&client_id={appId}&redirect_uri={origin}/lichess/callback&code_challenge_method=S256&code_challenge={challenge}&scope=preference:read&state={state}` |
| Token exchange | POST | `https://lichess.org/api/token` |
| Token revoke | DELETE | `https://lichess.org/api/token` |
| Account info | GET | `https://lichess.org/api/account` |

`client_id` is a public string (`tabiya-web`) registered with Lichess via their public-client OAuth flow — no client secret, PKCE is the proof-of-possession (Article 1: no proprietary SDK, just PKCE-over-fetch).

**Scope:** `preference:read` only. Lichess's `GET /api/games/user/{username}` and `GET /game/export/{id}` are public endpoints for public games and do not require a scope beyond authenticated-identity — `preference:read` is the minimum scope that yields a valid token without granting write or challenge permissions (R1 AC5).

### Code verifier / challenge

```ts
// src/lib/lichess/oauth.ts
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(bytes); // 43-char base64url, RFC 7636
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

### State parameter (CSRF)

```ts
export function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return base64UrlEncode(bytes);
}
```

Stored in `sessionStorage` under `tabiya.lichess.oauthState` alongside `tabiya.lichess.oauthVerifier`. Callback page reads both, validates `state` round-trip, then exchanges code + verifier.

### Redirect URL resolution

```ts
function resolveRedirectUri(): string {
  // Vite dev: import.meta.env.DEV → http://localhost:5173
  // Prod: window.location.origin (works for Vercel/Netlify deploys + self-hosted Docker)
  // Self-hosted override: window.LICHESS_OAUTH_ORIGIN if set by index.html shim
  const origin = (window as any).LICHESS_OAUTH_ORIGIN ?? window.location.origin;
  return `${origin}/lichess/callback`;
}
```

The `LICHESS_OAUTH_ORIGIN` shim lets the Docker image inject the deployed origin at container startup via `envsubst` on `index.html` — Article 16 (no host-only paths).

### Token storage

Key: `tabiya.lichess.token` (plain key for v1 simplicity; encryption-at-rest deferred per Open Question 1).

Value (JSON):
```ts
type StoredToken = {
  accessToken: string;
  tokenType: 'Bearer';
  scope: string;
  obtainedAt: number;   // epoch ms
  expiresAt: number | null; // Lichess tokens expire ~1 year; null if not provided
  username: string;     // cached from /api/account immediately after exchange
};
```

A `SensitiveStore` wrapper in `src/lib/lichess/sensitive-store.ts` exposes `get/set/clear` with a console.warn on first read in dev mode, naming the XSS risk. Wrapper exists so the future encrypted impl is a one-line swap.

### Refresh flow

Lichess does not issue refresh tokens for PKCE public clients. Tokens are long-lived (~1 year). On 401 from any subsequent call (R1 AC8), we clear the token and surface a "Reconnect Lichess" CTA in Settings. No silent refresh, no background re-auth.

### Disconnect mechanics

`Disconnect` button handler:
1. `await fetch('https://lichess.org/api/token', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }})` — best-effort revoke
2. `sensitiveStore.clear('tabiya.lichess.token')`
3. `await getLichessRepository().clearAll()` — wipes both object stores
4. `sessionStorage.removeItem('tabiya.lichess.oauthVerifier' | 'oauthState')`
5. Emit `lichess:disconnected` window event → OOBWidget reverts to empty state, Settings re-renders Connect button

Revoke failure (network down, 502) does not block local cleanup — local state is always cleared.

## 2. R2 — Sync recent games

### Endpoint

```
GET https://lichess.org/api/games/user/{username}?max=100&since={epochMs}&pgnInJson=true&clocks=false&evals=false&opening=true
Headers:
  Authorization: Bearer {token}
  Accept: application/x-ndjson
```

`since = Date.now() - 15 * 24 * 60 * 60 * 1000` — 15-day cutoff in epoch ms. Lichess applies `since` server-side; `max=100` is the client-side cap. Whichever bound hits first terminates the stream (R2 AC3).

### Response parsing — NDJSON streaming

Lichess streams one JSON game per line. We use `fetch` + `response.body.getReader()` + a line-buffered decoder:

```ts
async function* streamNdjson<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as T;
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as T;
}
```

This lets the progress indicator update per-game ("Synced N games...") without buffering all 100 into memory.

### Idempotency

For each streamed game:
1. `existing = await repo.getGame(game.id)`
2. If `existing` and `existing.importedAt > someThreshold` → skip (R2 idempotency, R4 AC6)
3. Else `await repo.putGame(mapped)` and enqueue OOB detection

Counters: `newCount` increments on first-time insert, `knownCount` increments on skip. Terminal toast: "Synced N new games, M already known."

### Rate limit

`tabiya.lichess.lastSyncAt` in `localStorage`. Sync button disabled (greyed + tooltip "Wait 60s") until `Date.now() - lastSyncAt > 60_000` (R2 AC7).

## 3. R3 — Manual import by game ID

### Endpoint

```
GET https://lichess.org/game/export/{id}?pgnInJson=true&clocks=false&evals=false&opening=true
Headers: Authorization: Bearer {token}  (sent for consistency, not required for public games)
Accept: application/json
```

### Validator

```ts
const LICHESS_ID_RE = /^[a-zA-Z0-9]{8}$/;
export function validateGameId(id: string): boolean {
  return LICHESS_ID_RE.test(id);
}
```

Inline error states (R3 AC2, AC5, AC6):
- Malformed: "Game ID must be 8 letters/digits"
- 404: "Game not found"
- Already imported: "Already imported" (no re-detection)

### Flow

1. Validate ID
2. Check `repo.getGame(id)` — if exists, show "Already imported", abort
3. Fetch `/game/export/{id}`
4. Map to `LichessGame`
5. `repo.putGame(...)` + enqueue OOB detection
6. Toast: "Imported game vs {opponent}"

## 4. R4 — IndexedDB schema + `LichessRepository`

### Database

DB name: existing `tabiya` (shared with SRS state from Phase 1).
DB version bump: `+1` per `idb` upgrade callback. Add stores conditionally in upgrade hook to avoid clobbering Phase 1 state.

### Object stores

```ts
// lichess_games
{
  keyPath: 'id',
  indices: [
    { name: 'by_playedAt', keyPath: 'createdAt', unique: false },
    { name: 'by_openingEco', keyPath: 'opening.eco', unique: false },
    { name: 'by_oobChecked', keyPath: 'oobChecked', unique: false },
  ]
}

// lichess_oob_events
{
  keyPath: ['gameId', 'plyIndex'],
  indices: [
    { name: 'by_detectedAt', keyPath: 'detectedAt', unique: false },
    { name: 'by_lineId', keyPath: 'lineId', unique: false },
  ]
}
```

### Types

```ts
// src/lib/lichess/types.ts

export type LichessColor = 'white' | 'black';
export type LichessResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface LichessOpening {
  eco: string;       // "C42"
  name: string;      // "Petrov Defense"
  ply: number;       // first ply where Lichess matched this opening
}

export interface LichessGame {
  id: string;                  // 8-char Lichess ID
  createdAt: number;           // epoch ms (game start)
  whiteUsername: string;
  blackUsername: string;
  userColor: LichessColor;
  result: LichessResult;
  pgn: string;                 // full PGN with headers
  opening: LichessOpening | null;
  importedAt: number;
  oobChecked: boolean;         // detection has run (regardless of whether event emitted)
}

export interface OOBEvent {
  gameId: string;
  plyIndex: number;            // 0-based ply where user diverged
  playedSAN: string;
  expectedSANs: string[];      // deduped, sorted
  color: LichessColor;         // always user's color
  fenAtOOB: string;            // FEN BEFORE the played move
  openingEco: string | null;
  openingName: string | null;
  lineId: string | null;       // deepest alive picked line at prior ply
  detectedAt: number;
}

export const LICHESS_SCOPES = ['preference:read'] as const;
```

### Interface

```ts
// src/lib/lichess/repository.ts
export interface LichessRepository {
  getGame(gameId: string): Promise<LichessGame | null>;
  putGame(game: LichessGame): Promise<void>;
  listGames(opts?: { since?: number; limit?: number }): Promise<LichessGame[]>;
  clearAll(): Promise<void>;
  getOOBEvents(opts?: { limit?: number; gameId?: string }): Promise<OOBEvent[]>;
  putOOBEvent(event: OOBEvent): Promise<void>;
  markGameChecked(gameId: string): Promise<void>;
}
```

### DI accessor

```ts
// src/lib/lichess/repository-di.ts
let _instance: LichessRepository | null = null;
export function getLichessRepository(): LichessRepository {
  if (!_instance) _instance = new IdbLichessRepository();
  return _instance;
}
// Test seam:
export function __setLichessRepositoryForTest(impl: LichessRepository) { _instance = impl; }
```

### Idempotent write semantics (R4 AC6)

```ts
async putGame(game: LichessGame): Promise<void> {
  const existing = await this.getGame(game.id);
  if (existing && existing.importedAt >= game.importedAt) return; // no-op
  await db.put('lichess_games', game);
}
```

OOB events upserted by composite key `[gameId, plyIndex]` — IDB `put` overwrites on collision, naturally idempotent.

### Catalog refresh resilience (R4 AC7, R5 AC8)

`OOBEvent.lineId` references picked repertoire IDs from Phase 1.5. Article 6 makes IDs stable, but a refresh may *remove* a line. The widget defensively renders `(line removed)` if `getOpeningRepository().getLineById(lineId)` returns null. The store retains the event — removal of source line does not delete history.

## 5. R5 — OOB detection (linear)

### Inputs

```ts
interface DetectInput {
  game: LichessGame;
  pickedLines: PickedLine[]; // from Phase 1.5 RepertoirePick, filtered to user's color
  transpositionIndex?: TranspositionIndex | null; // Phase 2 optional, see R6
}

interface PickedLine {
  id: string;                  // stable slug
  color: LichessColor;
  plies: string[];             // SAN sequence from start position
  openingEco?: string;
  openingName?: string;
}
```

### Algorithm

```ts
export async function detectOOB(input: DetectInput): Promise<OOBEvent | null> {
  const { game, pickedLines } = input;
  const userColor = game.userColor;
  const candidateLines = pickedLines.filter(l => l.color === userColor);
  if (candidateLines.length === 0) {
    return null; // degenerate case (R5.3): no prep to compare → mark checked, no event
  }

  const plies = parsePgnToSan(game.pgn);          // SAN array, ply 0 = white's first move
  const board = new Chess();
  let alive = candidateLines.map(l => ({ line: l, depth: 0 }));

  for (let i = 0; i < plies.length; i++) {
    const movedColor: LichessColor = i % 2 === 0 ? 'white' : 'black';
    const playedSan = plies[i];

    if (movedColor === userColor) {
      // Check played move against next-move of each alive line
      const matching = alive.filter(a => a.line.plies[a.depth] === playedSan);
      if (matching.length === 0) {
        // OOB — collect expected SANs from prior-ply alive lines
        const expectedSet = new Set(alive.map(a => a.line.plies[a.depth]).filter(Boolean));
        const deepest = pickDeepestAlive(alive); // longest depth, lex-sort tiebreak on line.id
        return {
          gameId: game.id,
          plyIndex: i,
          playedSAN: playedSan,
          expectedSANs: [...expectedSet].sort(),
          color: userColor,
          fenAtOOB: board.fen(),
          openingEco: game.opening?.eco ?? null,
          openingName: game.opening?.name ?? null,
          lineId: deepest?.line.id ?? null,
          detectedAt: Date.now(),
        };
      }
      alive = matching.map(a => ({ line: a.line, depth: a.depth + 1 }));
    } else {
      // Opponent move: prune alive lines whose next ply doesn't match (R5.9)
      alive = alive
        .filter(a => a.line.plies[a.depth] === playedSan)
        .map(a => ({ line: a.line, depth: a.depth + 1 }));
      if (alive.length === 0) {
        // Opponent left book — user is now off-prep through no fault of their own.
        // Per R5.9: NOT an OOB event. Detection ends here with no event.
        return null;
      }
    }
    board.move(playedSan);

    if (alive.every(a => a.depth >= a.line.plies.length)) {
      // All alive lines fully consumed — user stayed in book end-to-end (R5.7)
      return null;
    }
  }
  return null; // game ended before leaving book (R5.7)
}
```

### Determinism (R5 AC10)

- `expectedSANs` is sorted lexicographically before storage
- `pickDeepestAlive` ties broken by `line.id` lex-sort
- No `Date.now()` reads inside the loop; only `detectedAt` is timestamped at emission

Golden tests pin the exact emitted `OOBEvent` for fixed input — `detectedAt` is the only non-deterministic field and is mocked in tests.

### Async scheduling

Detection runs via `queueMicrotask` after `repo.putGame()` resolves, NOT inside the sync `for await` loop. This keeps the sync progress UI responsive. Concurrency cap: 1 detection at a time (in-memory queue) — detection is CPU-bound and parallelizing yields nothing in single-threaded JS.

```ts
const detectionQueue = new AsyncSerialQueue();
async function syncGame(g: LichessGame) {
  await repo.putGame(g);
  detectionQueue.enqueue(() => runDetection(g.id));
}
```

## 6. R6 — Transposition-aware OOB (optional)

### Activation

```ts
import { getTranspositionIndex } from '../transposition'; // Phase 2 module

const idx = getTranspositionIndex(); // returns null if Phase 2 not loaded / not built
if (idx) {
  // path A: transposition-aware
} else {
  // path B: linear (R5)
}
```

### Transposition path

Modified detector: before emitting an OOB event at ply N, compute `fenAfterPlayed = board.move(playedSan); fen = board.fen(); board.undo();`. Normalize per Phase 2 rules:

```ts
function normalizeFen(fen: string): string {
  // Strip halfmove + fullmove (last two fields)
  // Strip en-passant target if no en-passant capture is currently legal
  // (Phase 2 ships this helper; we import, not reimplement)
}
```

Query:
```ts
const transposed = idx.findLinesReachingFen(normalizeFen(fenAfterPlayed), { color: userColor, pickedOnly: true });
if (transposed.length > 0) {
  // Switch alive tracking to transposed lines at the matching depth
  alive = transposed.map(t => ({ line: t.line, depth: t.plyDepth + 1 }));
  board.move(playedSan);
  continue; // no OOB
}
```

### Graceful degrade (R6 AC4)

If Phase 2 module is absent at runtime, `getTranspositionIndex()` returns `null` (Phase 2 design contract). Detector skips path A entirely — no try/catch, no runtime errors. Tests for R6 are conditionally skipped via `describe.skipIf(!hasTranspositionIndex)`.

## 7. R7 — Dashboard OOB widget + position viewer

### Component tree

```
Dashboard
├── DrillDueWidget                    (existing, Phase 1)
├── OOBWidget                         (NEW)
│   ├── OOBEmptyState                 (not connected | connected-no-events)
│   ├── OOBEventList
│   │   └── OOBEventRow × up to 10
│   │       ├── (date, opponent, ECO/name, ply, played, expected[0..1] +N)
│   │       └── onClick → router.push(`/lichess/oob/:gameId/:plyIndex`)
│   └── OOBLoadMore                   (paginates to next 10 via offset)
└── ...

OOBPositionViewer (route /lichess/oob/:gameId/:plyIndex)
├── BoardAtFEN (re-uses Phase 1.5 Board with non-interactive prop)
│   └── HighlightOverlay (Article 15: shared primitive)
│       ├── highlight: playedMove (color A)
│       └── highlight: expectedMoves[] (color B)
├── OOBMetadataPanel
│   ├── opening name + ECO
│   ├── "You played: Nf6" / "Expected: e5, c5 (+1 more)"
│   └── lineId → linkified to Repertoire page (or "(line removed)")
├── CoachSlot                         (NEW, renders null in Phase 3)
└── ExternalLink → lichess.org/{gameId}/{userColor}#{plyIndex}
```

### `<CoachSlot>` placeholder

```tsx
// src/components/CoachSlot.tsx — Phase 3
export interface CoachSlotProps {
  gameId: string;
  plyIndex: number;
  fenAtOOB: string;
  playedSAN: string;
  expectedSANs: string[];
  lineId: string | null;
}
export function CoachSlot(_props: CoachSlotProps): JSX.Element | null {
  return null; // Phase 4 replaces this with the "Ask Coach" button + drawer
}
```

OOBPositionViewer passes the full context payload to `CoachSlot` even in Phase 3. The widget is **aware of but not coupled to** Phase 4 — replacing the file's body is the only edit Phase 4 needs to make to this surface. No props re-plumbing, no type changes.

### Pagination

Widget renders 10 rows initially. "Load more" reads `repo.getOOBEvents({ limit: 10, offset })` via IDB `by_detectedAt` index reverse cursor. Offset stored in component state — no URL state, no scroll restoration.

### Empty states (R7 AC2, AC3)

```tsx
function OOBEmptyState({ connected }: { connected: boolean }) {
  if (!connected) {
    return <Card>
      <h3>Out-of-book moments</h3>
      <p>Connect Lichess in Settings to see when your games leave your prep.</p>
      <Link to="/settings#lichess">Open Settings</Link>
    </Card>;
  }
  return <Card>
    <h3>Out-of-book moments</h3>
    <p>No out-of-book moments yet. Sync your recent games in Settings.</p>
  </Card>;
}
```

Read surface only (R7 AC8) — no mutation buttons, no drill-enqueue, no SRS update. Pure presentation over `LichessRepository.getOOBEvents()`.

## HTTP client

**Native `fetch`.** No `axios`, no `ky`, no wrapper library. Justification:

- Bundle weight: fetch is built into the browser; axios adds ~13KB gz (Article 1 spirit: minimal deps)
- Streaming: NDJSON sync needs `ReadableStream` — fetch supports it natively, axios in browsers does not without polyfill
- Auth header: trivial to add per call
- Article 1: every dep declared; we add zero npm deps in this phase

Thin wrapper for retries + auth header:

```ts
// src/lib/lichess/api.ts
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = sensitiveStore.get<StoredToken>('tabiya.lichess.token');
  if (!token) throw new LichessAuthError('no_token');
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.status === 401) {
    sensitiveStore.clear('tabiya.lichess.token');
    window.dispatchEvent(new Event('lichess:token-rejected'));
    throw new LichessAuthError('rejected');
  }
  if (res.status === 429) {
    throw new LichessRateLimitError(res.headers.get('Retry-After'));
  }
  return res;
}
```

## CORS

Lichess sends `Access-Control-Allow-Origin: *` on the endpoints we use (`/api/games/user/*`, `/game/export/*`, `/api/token`, `/api/account`). Verified per Lichess API docs. No CORS proxy is needed; no backend hop is introduced (Article 12).

The OAuth authorize page itself is a full-page navigation (not a fetch), so it is exempt from CORS.

## Article 11 compliance — network call enumeration

Every network call this phase introduces, and the user gesture that gates it:

| Call | Gating user action | Article 11 verdict |
|---|---|---|
| `GET https://lichess.org/oauth?...` (full-page nav) | Click "Connect Lichess" in Settings | Opt-in |
| `POST https://lichess.org/api/token` | Lichess redirected back to `/lichess/callback` after consent | Opt-in (continuation of consent) |
| `GET https://lichess.org/api/account` | Same callback flow (cache username) | Opt-in (continuation) |
| `GET https://lichess.org/api/games/user/{u}?...` | Click "Sync now" in Settings | Opt-in |
| `GET https://lichess.org/game/export/{id}?...` | Click "Import" with manual ID | Opt-in |
| `DELETE https://lichess.org/api/token` | Click "Disconnect" in Settings | Opt-in |
| External link `https://lichess.org/{gameId}/...` | Click "View on Lichess" in viewer | Opt-in (`target="_blank" rel="noopener"`) |

Zero calls fire on app boot. Zero calls fire while disconnected. Zero analytics / telemetry calls added. App works fully offline if user never connects.

## Article 12 compliance — no backend

This phase ships zero backend changes. `backend/` stays empty. `docker-compose.yml` retains `frontend`-only service set (per `tech.md` table: Phase 2 was the previously-projected backend introduction; in this design we defer backend to Phase 4 with the AI service).

Self-hosted Docker users get Lichess sync by setting one env var (`LICHESS_OAUTH_ORIGIN`) at container start — no extra service, no DB volume.

## Failure modes

| Mode | Detection | Behavior |
|---|---|---|
| Token expired (~1yr) | 401 on any authed call | Clear token, dispatch `lichess:token-rejected`, Settings shows "Reconnect Lichess" |
| User revoked from Lichess side | Same as expired (401) | Same handling — indistinguishable from the client |
| Network offline | `fetch` rejects with `TypeError: Failed to fetch` | Toast "Lichess unreachable — check connection". Local state untouched. Sync retried on next click. |
| Rate limit (429) | `Retry-After` header | Toast "Lichess rate limit — try again in {N}s". Sync button disabled until window passes. |
| Malformed PGN | `chess.js` throws on `.move(san)` | Game marked `oobChecked = true` with no event; warning logged. Detection does not crash sync. |
| NDJSON stream truncated | Reader returns done with partial buffer | Counters reflect only fully-parsed games; toast shows "Synced N (stream incomplete)". |
| Catalog refresh removes picked line | `getOpeningRepository().getLineById(event.lineId)` returns null | Viewer shows "(line removed)" — event preserved (R5 AC8). |
| IDB upgrade failure | `idb` upgrade callback throws | Surfaced as boot-time error in Settings; sync disabled. Phase 1 SRS state unaffected (different stores). |
| OAuth state mismatch on callback | Stored state ≠ returned state | Abort exchange, clear sessionStorage, surface "Authorization failed — try again" |

## File tree forecast

```
src/
├── lib/lichess/
│   ├── oauth.ts                      (NEW)
│   ├── api.ts                        (NEW)
│   ├── types.ts                      (NEW)
│   ├── pgn.ts                        (NEW)
│   ├── repository.ts                 (NEW)
│   ├── repository-idb.ts             (NEW)
│   ├── repository-di.ts              (NEW)
│   ├── detect-oob.ts                 (NEW)
│   ├── sensitive-store.ts            (NEW)
│   └── async-serial-queue.ts         (NEW)
├── pages/
│   ├── Settings.tsx                  (EDIT: add LichessSection)
│   ├── LichessCallback.tsx           (NEW)
│   ├── Dashboard.tsx                 (EDIT: mount OOBWidget)
│   └── OOBPositionViewerPage.tsx     (NEW)
├── components/
│   ├── settings/LichessSection.tsx   (NEW)
│   ├── dashboard/OOBWidget.tsx       (NEW)
│   ├── dashboard/OOBEventRow.tsx     (NEW)
│   ├── OOBPositionViewer.tsx         (NEW)
│   ├── CoachSlot.tsx                 (NEW — Phase 4 fills in)
│   └── HighlightOverlay.tsx          (REUSE from Phase 1.5, Article 15)
├── App.tsx                           (EDIT: add /lichess/callback + /lichess/oob/:gameId/:plyIndex routes)
└── config/
    └── lichess.ts                    (NEW: client_id, scope, endpoints)

tests/
├── lichess/
│   ├── oauth.test.ts                 (PKCE pair, state, exchange shape, 401)
│   ├── sync.test.ts                  (NDJSON parse, idempotency, rate limit)
│   ├── detect-oob.test.ts            (5 golden fixtures + transposition)
│   ├── repository-idb.test.ts        (contract test, idempotent put)
│   ├── repository-contract.test.ts   (reusable suite for any LichessRepository)
│   └── fixtures/
│       ├── game-in-book.pgn
│       ├── game-oob-ply6.pgn
│       ├── game-opponent-oob.pgn
│       ├── game-no-picks.pgn
│       ├── game-transposition.pgn
│       └── sync-response.ndjson

docker/
└── frontend.Dockerfile               (EDIT: envsubst LICHESS_OAUTH_ORIGIN into index.html on container start)

specs/tech.md                         (EDIT: note Lichess REST + crypto.subtle PKCE)
README.md                             (EDIT: dev callback setup + Docker env var)
```

## Component tree (full)

```
App
├── Routes
│   ├── /                    → Dashboard
│   │                          ├── DrillDueWidget
│   │                          └── OOBWidget                  [NEW]
│   ├── /settings            → Settings
│   │                          ├── PresetSection              (Phase 1c)
│   │                          ├── ...
│   │                          └── LichessSection             [NEW]
│   │                                ├── ConnectButton | ConnectedHeader
│   │                                ├── SyncNowButton
│   │                                ├── ManualImportInput
│   │                                └── DisconnectButton
│   ├── /lichess/callback    → LichessCallback                [NEW]
│   └── /lichess/oob/:gameId/:plyIndex → OOBPositionViewerPage [NEW]
│                              ├── BoardAtFEN (read-only)
│                              ├── HighlightOverlay           (Article 15 reuse)
│                              ├── OOBMetadataPanel
│                              ├── CoachSlot                  [NEW placeholder]
│                              └── LichessExternalLink
```

## Test plan

### Unit

| File | Coverage |
|---|---|
| `oauth.test.ts` | `generatePkcePair` produces 43-char verifier + valid SHA-256 base64url challenge; `generateState` 22-char; token exchange POST body shape (verifier + code + redirect_uri); 401 handling clears storage |
| `sync.test.ts` | NDJSON line buffering across chunk boundaries; idempotent putGame; rate-limit gate (60s); 429 Retry-After parse |
| `detect-oob.test.ts` | 5 golden fixtures (in-book, OOB ply 6, opponent-OOB, no-picks, transposition); determinism (same input → identical event); expectedSANs sorted; lineId tiebreak; degenerate empty-picks case marks checked |
| `repository-idb.test.ts` | putGame idempotency on equal importedAt; composite key on OOB events; index lookups for by_detectedAt |
| `repository-contract.test.ts` | Reusable suite — both IDB impl and an in-memory test double pass it (R8 AC5) |
| `pgn.test.ts` | PGN with annotations / clock comments parses to SAN-only ply array |

### Integration

| Test | Flow |
|---|---|
| `connect-sync-display.test.tsx` | Mocked Lichess: click Connect → callback handler → tokens stored → click Sync → 3 games in NDJSON → 2 OOB events → Dashboard widget renders 2 rows |
| `disconnect-clears-everything.test.tsx` | Token + games + events present → click Disconnect → all three storages empty, widget shows not-connected empty state |
| `token-rejected-mid-sync.test.tsx` | Sync in flight → 401 returned mid-stream → token cleared, partial games preserved, "Reconnect" CTA visible |
| `manual-import-already-known.test.tsx` | Game already in store → "Import" → "Already imported" inline, no network call |

### Quality gates (R8)

- TS strict, no `any` without justification (Article 14) — ESLint rule `@typescript-eslint/no-explicit-any` set to `error` for `src/lib/lichess/**`
- Vitest coverage gate: `src/lib/lichess/**` ≥ 85% line, 100% on `detect-oob.ts`
- License audit script confirms zero new npm deps introduced in this phase (`scripts/check_phase3_deps.ts` — diffs `package.json` from Phase 1c baseline)
- Contract test re-run against in-memory `LichessRepository` impl to prove the interface is implementation-agnostic (Article 5)

## Dependency graph

```
oauth.ts            ── independent (crypto.subtle + fetch only)
sensitive-store.ts  ── independent
types.ts            ── independent

repository.ts       ── types.ts
repository-idb.ts   ── repository.ts, idb
repository-di.ts    ── repository.ts, repository-idb.ts

api.ts              ── sensitive-store.ts, types.ts
pgn.ts              ── chess.js

detect-oob.ts       ── pgn.ts, types.ts, (optional) phase-2/transposition

LichessSection.tsx        ── oauth.ts, api.ts, repository-di.ts
LichessCallback.tsx       ── oauth.ts, api.ts, sensitive-store.ts
OOBWidget.tsx             ── repository-di.ts, types.ts
OOBPositionViewer.tsx     ── types.ts, HighlightOverlay (Phase 1.5), CoachSlot
CoachSlot.tsx             ── types.ts (props payload only; renders null in Phase 3)
```

Execution order: types → oauth + sensitive-store → repository (interface + IDB + DI) → api → pgn → detect-oob → LichessSection + Callback → OOBWidget + viewer + CoachSlot → tests.

## Constitution compliance

- **Article 1 (OSS only):** Zero new npm deps. `crypto.subtle`, `fetch`, `idb` (already in tree), `chess.js` (already in tree). License audit script enforces.
- **Article 3 (No heavy AI orchestration):** No agent framework introduced. Detection is a linear pure-function walk. Phase 4 Coach will call AI SDKs directly when it lands.
- **Article 4 (Real AI work):** Phase 3 is plumbing — explicitly. OOB event schema designed for downstream Phase 4 RAG/Coach consumption (`fenAtOOB`, `lineId`, `expectedSANs` all stable & replayable).
- **Article 5 (Repository pattern):** All `lichess_games` + `lichess_oob_events` access via `LichessRepository`. `__setLichessRepositoryForTest` is the only test-only escape. Contract test suite makes future backend-served swap a single DI edit.
- **Article 6 (Stable line IDs):** `OOBEvent.lineId` references picked repertoire by stable slug. Removal handled (renders "(line removed)"); renaming forbidden by the article itself.
- **Article 9 (SAN):** All move data in `playedSAN`, `expectedSANs`, `PickedLine.plies` is SAN. PGN parsed via `chess.js` produces SAN by default.
- **Article 11 (Local-first):** Network call enumeration table above; every call gated on explicit user action; app works fully when disconnected.
- **Article 12 (Backend optional):** Zero backend services added; CORS path direct to Lichess; Docker compose retains frontend-only.
- **Article 14 (TS strict):** No `any` in `src/lib/lichess/**`; ESLint rule scoped tighter than project default.
- **Article 16 (Containerized distribution):** `LICHESS_OAUTH_ORIGIN` env var resolved at container start via `envsubst` on `index.html`; documented in README.

## Open design questions (deferred from spec)

These are tracked but **not blocking implementation** — defaults are explicit in this design:

1. **Token encryption at rest** — default: plain `localStorage` behind `SensitiveStore` wrapper. Revisit if XSS surface grows in Phase 4 (Coach may render LLM HTML).
2. **Sync window for power users** — default: hardcoded 100 games / 15 days. "Advanced" UI deferred to Phase 5+ if user feedback demands.
3. **OOB attribution with multiple candidate lines** — default: single `lineId` with deterministic deepest+lex tiebreak. Schema flexibility (`lineIds: string[]`) deferred until Phase 4 shows whether Coach needs multi-line context.

These deferrals are **forward-compatible**: every change is additive to existing types, no migration of stored events required.
