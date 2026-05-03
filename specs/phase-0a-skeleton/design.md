# Design: Phase 0a — Skeleton

## Overview

Phase 0a is a vertical smoke test of the chosen frontend stack: Vite + React 18 + TypeScript (strict) running `react-chessboard` and `chess.js`, served via a multi-stage Docker image behind nginx. A single hardcoded opening line drives a minimal drill loop that proves the move-comparison and feedback mechanic before any catalog, SRS, backend, or AI is introduced.

Design is deliberately small. Total hand-written source is capped at ~400 LOC. No DI framework, no router, no global state library, no animation library. State lives in component-local React hooks. Anything more is deferred.

## Architecture

### High-level component diagram

```
┌─────────────────────── browser (single-page) ───────────────────────┐
│                                                                     │
│   App                                                               │
│    └── DrillView                                                    │
│         ├── ChessBoardPanel  (react-chessboard + chess.js)          │
│         │     └── customSquareStyles  (green/red flash)             │
│         ├── StatusBar        ("Your move" / "Wrong" / "Complete")   │
│         └── useDrill()       (custom hook — state machine)          │
│                                                                     │
│   Module: drill/move-comparator.ts  (pure, testable)                │
│   Module: drill/sample-line.ts       (hardcoded SAN array)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (build + serve)
┌──────────────── docker-compose.yml ─────────────────────────────────┐
│   frontend service                                                  │
│    └── docker/frontend.Dockerfile                                   │
│         ├── stage 1: node:20-alpine  (npm ci + vite build)          │
│         └── stage 2: nginx:alpine    (serve dist/ on :80 → :8080)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Architectural decisions

**AD1. No router.** Single screen. Adding `react-router` for one screen is over-engineering. Introduce in Phase 1 if multi-screen lands.

**AD2. No global state library.** Drill state fits in one custom hook (`useDrill`) using `useState` + `useReducer`. Redux/Zustand/Jotai are unnecessary at this scope.

**AD3. Pure-function move comparator.** `compareMove(chessInstance, expectedSan, attempt)` is a stand-alone module — no React, no hooks. This is the unit-tested core (Requirement 7.3).

**AD4. `chess.js` is the source of truth.** `react-chessboard` is a presentation layer. All legality, FEN, undo, and turn tracking go through a `Chess` instance held in the drill hook. Isolates UI churn from game logic.

**AD5. SAN-only at module boundaries.** All public functions accept and return SAN strings (Constitution Article 9). The board's internal `from`/`to` square coords (which `react-chessboard` exposes via `onPieceDrop`) are converted to SAN via `chess.js` before any comparison.

**AD6. Multi-stage Docker, nginx serves static.** Phase 0a has no runtime backend, so `nginx:alpine` is the runtime. Builder stage uses `node:20-alpine` to run `npm ci && npm run build`, then `COPY --from=builder dist/ /usr/share/nginx/html/`. Final image stays under 50 MB compressed.

**AD7. No CI in this phase.** `docker compose build` is the local CI surrogate. GitHub Actions integration is a Phase 1 task once there is more than scaffolding to test.

**AD8. Wrong moves are NOT applied to chess.js.** Two equivalent implementations exist: (a) apply on chess.js, then `chess.undo()` after flash; (b) reject before applying, only flash visually. We pick (b). Simpler — no undo bookkeeping, board snaps back automatically because `react-chessboard` re-renders from chess.js's unchanged FEN. UX-level "auto-undo" semantics are preserved (Requirement 4.3).

## Implementation Details

### File layout (Phase 0a)

```
tabiya/
├── docker/
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── .dockerignore
├── public/
│   └── vite.svg                # placeholder logo, can be replaced later
├── src/
│   ├── main.tsx                # ReactDOM.createRoot, mounts <App />
│   ├── App.tsx                 # renders <DrillView />
│   ├── index.css               # body reset + 1 page-level style
│   ├── ui/
│   │   ├── DrillView.tsx       # composes board + status bar, owns useDrill
│   │   ├── ChessBoardPanel.tsx # wraps react-chessboard, applies square styles
│   │   └── StatusBar.tsx       # text-only status indicator
│   └── drill/
│       ├── useDrill.ts         # custom hook: state machine
│       ├── move-comparator.ts  # pure: compare expected vs attempted SAN
│       └── sample-line.ts      # hardcoded Ruy Lopez SAN array
├── tests/
│   └── move-comparator.test.ts # vitest unit test
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
└── .gitignore
```

### Drill state machine (`useDrill`)

States (discriminated union):

```ts
type DrillState =
  | { kind: 'awaiting_player'; lineIndex: number }
  | { kind: 'flash_correct';   lineIndex: number; square: string }
  | { kind: 'flash_wrong';     lineIndex: number; square: string }
  | { kind: 'auto_playing';    lineIndex: number }
  | { kind: 'complete' };
```

Events:

- `PLAYER_MOVE_ATTEMPTED { from, to, promotion? }` — drag-drop callback from `react-chessboard`
- `FLASH_TIMER_DONE` — fires after ~400ms in either flash state
- `AUTO_PLAY_TIMER_DONE` — fires after ~300ms in `auto_playing`

Transitions:

| From | Event | Outcome |
|---|---|---|
| `awaiting_player` | `PLAYER_MOVE_ATTEMPTED` (legal + matches expected) | apply move on chess.js; advance lineIndex; if next is opponent → `auto_playing`; else → `flash_correct` |
| `awaiting_player` | `PLAYER_MOVE_ATTEMPTED` (legal but wrong) | flash square red; do NOT apply on chess.js (AD8) → `flash_wrong` |
| `awaiting_player` | `PLAYER_MOVE_ATTEMPTED` (illegal) | drop event silently; stay in `awaiting_player` |
| `flash_correct` | `FLASH_TIMER_DONE` | if `lineIndex === line.length` → `complete`; else → `awaiting_player` |
| `flash_wrong` | `FLASH_TIMER_DONE` | → `awaiting_player` (board unchanged) |
| `auto_playing` | `AUTO_PLAY_TIMER_DONE` | apply opponent move via chess.js; advance lineIndex; → `flash_correct` (which then resolves to awaiting_player or complete) |

### Move comparator (pure)

```ts
// src/drill/move-comparator.ts
import { Chess } from 'chess.js';

export type CompareResult =
  | { kind: 'correct' }
  | { kind: 'wrong'; legalSan: string }
  | { kind: 'illegal' };

export function compareMove(
  chess: Chess,
  expectedSan: string,
  attempt: { from: string; to: string; promotion?: string }
): CompareResult {
  const move = chess.move(attempt);
  if (move === null) return { kind: 'illegal' };
  const attemptedSan = move.san;
  chess.undo();                          // always restore — caller decides whether to keep
  if (attemptedSan === expectedSan) return { kind: 'correct' };
  return { kind: 'wrong', legalSan: attemptedSan };
}
```

The hook calls `compareMove`, decides what to do on `correct` (re-apply via `chess.move()` and accept), and on `wrong`/`illegal` (no board change, just flash UI). Comparator stays pure and trivially unit-testable.

### Sample line

```ts
// src/drill/sample-line.ts
export const SAMPLE_LINE_SAN: readonly string[] = [
  'e4', 'e5', 'Nf3', 'Nc6', 'Bb5'
];
export const SAMPLE_LINE_NAME = 'Ruy Lopez (skeleton sample)';
```

Public opening only — Constitution Article 10.

### Visual feedback (square styles)

`react-chessboard` accepts `customSquareStyles: Record<Square, CSSProperties>`. The hook returns a `squareStyles` map computed from current state — only the flashed square has a non-empty style for ~400ms.

```ts
// flash_correct:
{ [flashSquare]: { background: 'rgba(0,200,0,0.35)', transition: 'background 200ms ease-out' } }
// flash_wrong:
{ [flashSquare]: { background: 'rgba(220,40,40,0.45)', transition: 'background 200ms ease-out' } }
```

No animation library. CSS transition only.

### Status text

```ts
function statusText(state: DrillState): string {
  switch (state.kind) {
    case 'awaiting_player': return 'Your move';
    case 'flash_correct':   return 'Correct';
    case 'flash_wrong':     return 'Wrong — try again';
    case 'auto_playing':    return 'Opponent…';
    case 'complete':        return 'Line complete';
  }
}
```

## Containerization

### `docker/frontend.Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- builder ----
FROM node:20.11-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `docker/nginx.conf`

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

(SPA fallback isn't needed in 0a — no router — but cheap to include now.)

### `docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: docker/frontend.Dockerfile
    image: tabiya/frontend:0.1
    ports:
      - "8080:80"
    restart: unless-stopped
```

### `.dockerignore`

```
node_modules
dist
.git
.github
.vscode
steering
ctx
specs
*.md
.dockerignore
.gitignore
```

Keeps build context small and prevents leaking SDD docs into image layers.

## API Changes

None. Phase 0a has no API surface beyond in-process module exports listed above.

## Data Model

Phase 0a uses no persisted data. Only data structure is the in-memory `SAMPLE_LINE_SAN: readonly string[]`. Catalog schemas (`Opening`, `Line`, `KeySquare`) are defined in steering / Obsidian plan but out of scope for implementation here.

## Testing Strategy

Single Vitest unit suite on `move-comparator.ts`:

```ts
// tests/move-comparator.test.ts
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { compareMove } from '../src/drill/move-comparator';

describe('compareMove', () => {
  it('returns correct for matching SAN', () => {
    const c = new Chess();
    expect(compareMove(c, 'e4', { from: 'e2', to: 'e4' })).toEqual({ kind: 'correct' });
  });

  it('returns wrong for legal but mismatched SAN', () => {
    const c = new Chess();
    expect(compareMove(c, 'e4', { from: 'd2', to: 'd4' })).toEqual({ kind: 'wrong', legalSan: 'd4' });
  });

  it('returns illegal for illegal move', () => {
    const c = new Chess();
    expect(compareMove(c, 'e4', { from: 'e2', to: 'e5' })).toEqual({ kind: 'illegal' });
  });
});
```

Manual verification covers board rendering, flash colors, line completion.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `react-chessboard` API breaks between minor versions | Pin major.minor in package.json. Re-evaluate at Phase 1. |
| chess.js SAN form mismatch (e.g. `O-O` vs `0-0`, disambiguation rules) | Always derive expected SAN by re-running through chess.js once at module load (round-trip), store canonical form |
| Bundle exceeds 500 KB gzipped | Avoid extra deps. react-chessboard + chess.js + react is well under target. Vite tree-shakes by default. |
| Docker image grows past 50 MB | nginx:alpine ≈ 25 MB + dist (few hundred KB). Stays under cap unless fonts/icons added. |
| LOC creep past 400 | Delete unused `App.css`, default vite assets. Cap discipline at PR review. |
| Constitution drift (e.g. adding lodash) | Every PR re-reads `constitution.md`. Article 1 license check is mechanical. |

## Compliance with Constitution

| Article | Where enforced |
|---|---|
| 1 — Open Source Only | All deps (react, chess.js, react-chessboard, vite, vitest, eslint) are MIT/BSD. Docker bases alpine/nginx are Apache-2/BSD. |
| 2 — Python Primary, TS Browser | Phase 0a has no Python yet (catalog build is Phase 0b). TS scoped to `src/`. No Node backend. |
| 9 — SAN Format | Move comparator and sample line both SAN. Board `from`/`to` converted to SAN via chess.js before comparison. |
| 10 — Standalone & Generalized | No author identity; sample line is a public opening. |
| 11 — Local-First | No network calls after bundle load. nginx serves static only. |
| 12 — Backend Optional | No backend. |
| 13 — Weekend Pace | Fits in one weekend (~6-8 hrs). |
| 14 — Type Discipline | `strict: true` in tsconfig.json. ESLint configured. |
| 16 — Containerized Distribution | Multi-stage Dockerfile + compose included from this phase. |

Articles 3, 4, 5, 6, 7, 8, 15 are not exercised by Phase 0a (no AI, no storage layer, no catalog). Not violated either — they simply do not apply yet.
