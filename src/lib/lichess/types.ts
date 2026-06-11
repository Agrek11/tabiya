/**
 * Lichess integration types — Phase 3 (R4).
 *
 * `LichessGame` is the persisted game record; `OOBEvent` is the structured,
 * replayable out-of-book record designed for Phase 4 Coach consumption
 * (Article 4) — `fenAtOOB` + `lineId` + `expectedSANs` are stable inputs the
 * Coach can re-analyze without re-running detection.
 */

export type LichessColor = 'white' | 'black';
export type LichessResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface LichessOpening {
  eco: string; // "C42"
  name: string; // "Petrov Defense"
  ply: number; // first ply where Lichess matched this opening
}

export interface LichessGame {
  id: string; // 8-char Lichess ID
  createdAt: number; // epoch ms (game start)
  whiteUsername: string;
  blackUsername: string;
  userColor: LichessColor;
  result: LichessResult;
  pgn: string; // full PGN with headers
  opening: LichessOpening | null;
  importedAt: number;
  oobChecked: boolean; // detection has run (regardless of whether event emitted)
}

export interface OOBEvent {
  gameId: string;
  plyIndex: number; // 0-based ply where user diverged
  playedSAN: string;
  expectedSANs: string[]; // deduped, sorted
  color: LichessColor; // always user's color
  fenAtOOB: string; // FEN BEFORE the played move
  openingEco: string | null;
  openingName: string | null;
  lineId: string | null; // deepest alive picked line at prior ply
  detectedAt: number;
}

/** A picked repertoire line lifted into detector input shape (R5). */
export interface PickedLine {
  id: string; // stable slug (Article 6)
  color: LichessColor;
  plies: string[]; // SAN from start position (Article 9)
}

export const LICHESS_SCOPES = ['preference:read'] as const;

/** OAuth + API endpoints — single source of truth (design §1). */
export const LICHESS = {
  authorizeUrl: 'https://lichess.org/oauth',
  tokenUrl: 'https://lichess.org/api/token',
  accountUrl: 'https://lichess.org/api/account',
  userGamesUrl: (username: string) =>
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}`,
  gameExportUrl: (id: string) => `https://lichess.org/game/export/${encodeURIComponent(id)}`,
  gameWebUrl: (id: string, color: LichessColor) => `https://lichess.org/${id}/${color}`,
  clientId: 'tabiya-web',
} as const;

export type LichessAuthFailureReason = 'no_token' | 'rejected' | 'state_mismatch' | 'exchange_failed';

export class LichessAuthError extends Error {
  readonly reason: LichessAuthFailureReason;
  constructor(reason: LichessAuthFailureReason) {
    super(`lichess auth error: ${reason}`);
    this.name = 'LichessAuthError';
    this.reason = reason;
  }
}

export class LichessRateLimitError extends Error {
  readonly retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null) {
    super('lichess rate limit (429)');
    this.name = 'LichessRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Stored token payload under `tabiya:lichess:token.sensitive`. */
export interface StoredToken {
  accessToken: string;
  tokenType: 'Bearer';
  scope: string;
  obtainedAt: number; // epoch ms
  expiresAt: number | null; // Lichess PKCE tokens live ~1 year; null if absent
  username: string; // cached from /api/account right after exchange
}
