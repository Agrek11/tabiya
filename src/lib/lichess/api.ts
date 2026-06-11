/**
 * Lichess API wrappers — Phase 3 R2/R3 (design §2, §3, HTTP-client section).
 *
 * Native `fetch` only — zero npm deps in this phase (Article 1). NDJSON
 * streaming via ReadableStream so the sync progress UI updates per game.
 * Every call here is gated behind an explicit user gesture (Article 11 table
 * in the design — Connect / Sync now / Import / Disconnect).
 */

import {
  LICHESS,
  LichessAuthError,
  LichessRateLimitError,
  type LichessColor,
  type LichessGame,
  type LichessOpening,
  type LichessResult,
} from './types';
import { getStoredToken, onTokenRejected } from './oauth';

/** Sync window bounds (R2; design Open Q2 defaults). */
export const SYNC_MAX_GAMES = 100;
export const SYNC_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
/** Lichess etiquette — one sync per minute (R2 AC7). */
export const SYNC_COOLDOWN_MS = 60_000;
export const LAST_SYNC_AT_KEY = 'tabiya:lichess:lastSyncAt';

export const LICHESS_ID_RE = /^[a-zA-Z0-9]{8}$/;
export function validateGameId(id: string): boolean {
  return LICHESS_ID_RE.test(id);
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  if (!token) throw new LichessAuthError('no_token');
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.status === 401) {
    onTokenRejected();
    throw new LichessAuthError('rejected');
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    throw new LichessRateLimitError(retryAfter ? Number(retryAfter) : null);
  }
  return res;
}

/** Line-buffered NDJSON reader (design §2) — exported for tests. */
export async function* streamNdjson<T>(response: Response): AsyncGenerator<T> {
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

/** Raw game JSON shape from Lichess (subset we consume). */
export interface LichessApiGame {
  id: string;
  createdAt: number;
  players: {
    white: { user?: { name: string } | null; aiLevel?: number };
    black: { user?: { name: string } | null; aiLevel?: number };
  };
  winner?: 'white' | 'black';
  status: string;
  pgn: string;
  opening?: { eco: string; name: string; ply: number };
}

function resultOf(g: LichessApiGame): LichessResult {
  if (g.winner === 'white') return '1-0';
  if (g.winner === 'black') return '0-1';
  // Lichess statuses without a winner: draw, stalemate, aborted (= '*').
  return g.status === 'aborted' || g.status === 'started' ? '*' : '1/2-1/2';
}

function playerName(p: LichessApiGame['players']['white']): string {
  return p.user?.name ?? (p.aiLevel !== undefined ? `Stockfish level ${p.aiLevel}` : 'Anonymous');
}

/** Map a raw API game to the persisted record (R4 AC3). */
export function mapApiGame(g: LichessApiGame, username: string): LichessGame {
  const white = playerName(g.players.white);
  const black = playerName(g.players.black);
  const userColor: LichessColor =
    white.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
  const opening: LichessOpening | null = g.opening
    ? { eco: g.opening.eco, name: g.opening.name, ply: g.opening.ply }
    : null;
  return {
    id: g.id,
    createdAt: g.createdAt,
    whiteUsername: white,
    blackUsername: black,
    userColor,
    result: resultOf(g),
    pgn: g.pgn,
    opening,
    importedAt: Date.now(),
    oobChecked: false,
  };
}

/**
 * R2 — stream the user's recent games (last 100 OR 15 days, whichever bound
 * hits first; `since` applied server-side, `max` is the client ceiling).
 */
export async function* fetchRecentGames(username: string): AsyncGenerator<LichessGame> {
  const params = new URLSearchParams({
    max: String(SYNC_MAX_GAMES),
    since: String(Date.now() - SYNC_WINDOW_MS),
    pgnInJson: 'true',
    clocks: 'false',
    evals: 'false',
    opening: 'true',
  });
  const res = await authedFetch(`${LICHESS.userGamesUrl(username)}?${params.toString()}`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!res.ok) throw new Error(`lichess games fetch failed: ${res.status}`);
  for await (const raw of streamNdjson<LichessApiGame>(res)) {
    yield mapApiGame(raw, username);
  }
}

/** R3 — single-game manual import. Returns null on 404. */
export async function fetchGameById(
  id: string,
  username: string,
): Promise<LichessGame | null> {
  const params = new URLSearchParams({
    pgnInJson: 'true',
    clocks: 'false',
    evals: 'false',
    opening: 'true',
  });
  const res = await authedFetch(`${LICHESS.gameExportUrl(id)}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lichess game export failed: ${res.status}`);
  return mapApiGame((await res.json()) as LichessApiGame, username);
}

/** R2 AC7 — client-side sync cooldown. */
export function syncCooldownRemainingMs(now = Date.now()): number {
  try {
    const last = Number(window.localStorage.getItem(LAST_SYNC_AT_KEY) ?? 0);
    return Math.max(0, last + SYNC_COOLDOWN_MS - now);
  } catch {
    return 0;
  }
}

export function recordSyncStarted(now = Date.now()): void {
  try {
    window.localStorage.setItem(LAST_SYNC_AT_KEY, String(now));
  } catch {
    /* ignore */
  }
}
