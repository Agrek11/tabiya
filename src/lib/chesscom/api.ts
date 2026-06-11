/**
 * Chess.com Published-Data API wrappers — Phase 3 addendum.
 *
 * Unlike Lichess there is NO auth: api.chess.com/pub/* is public, read-only,
 * CORS-enabled. The only input is a username (stored plain in localStorage —
 * it is public information, not a secret). Article 11: every call is gated
 * behind the explicit "Sync now" gesture in Settings.
 *
 * Game flow: /pub/player/{user}/games/archives lists monthly archive URLs;
 * each archive carries full games with PGN. We fetch only the archives that
 * can overlap the sync window (current + previous month), filter by end_time,
 * cap at the shared SYNC_MAX_GAMES, and map into the same stored shape as
 * Lichess games (`source: 'chesscom'`) so the repository, OOB detector,
 * widget, and viewer are reused unchanged.
 */

import { SYNC_MAX_GAMES, SYNC_WINDOW_MS } from '../lichess/api';
import type { LichessColor, LichessGame, LichessOpening, LichessResult } from '../lichess/types';

export const CHESSCOM_USERNAME_KEY = 'tabiya:chesscom:username';

export function getChessComUsername(): string | null {
  try {
    return window.localStorage.getItem(CHESSCOM_USERNAME_KEY);
  } catch {
    return null;
  }
}

export function setChessComUsername(username: string | null): void {
  try {
    if (username === null || username === '') {
      window.localStorage.removeItem(CHESSCOM_USERNAME_KEY);
    } else {
      window.localStorage.setItem(CHESSCOM_USERNAME_KEY, username);
    }
  } catch {
    /* quota / private mode — silently degrade */
  }
}

/** Raw archive game JSON (subset we consume). */
export interface ChessComApiGame {
  url: string;
  pgn?: string;
  uuid: string;
  end_time: number; // epoch SECONDS
  rules: string; // 'chess' | 'chess960' | ...
  white: { username: string; result: string };
  black: { username: string; result: string };
}

const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
]);

function resultOf(g: ChessComApiGame): LichessResult {
  if (g.white.result === 'win') return '1-0';
  if (g.black.result === 'win') return '0-1';
  if (DRAW_RESULTS.has(g.white.result) || DRAW_RESULTS.has(g.black.result)) return '1/2-1/2';
  return '*';
}

/** ECO code + opening name from PGN headers ([ECO "B12"], [ECOUrl .../Caro-Kann-Defense...]). */
export function openingFromPgn(pgn: string): LichessOpening | null {
  const eco = /\[ECO "([^"]+)"\]/.exec(pgn)?.[1];
  if (!eco) return null;
  const ecoUrl = /\[ECOUrl "([^"]+)"\]/.exec(pgn)?.[1];
  const slug = ecoUrl?.split('/').pop() ?? '';
  const name = slug
    .replace(/-\d.*$/, '') // strip trailing move-sequence suffixes
    .replace(/-/g, ' ')
    .trim();
  return { eco, name: name || eco, ply: 0 };
}

/** Map a raw archive game to the shared stored shape (source: 'chesscom'). */
export function mapChessComGame(g: ChessComApiGame, username: string): LichessGame {
  const userColor: LichessColor =
    g.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
  return {
    id: g.uuid,
    source: 'chesscom',
    createdAt: g.end_time * 1000,
    whiteUsername: g.white.username,
    blackUsername: g.black.username,
    userColor,
    result: resultOf(g),
    pgn: g.pgn ?? '',
    opening: g.pgn ? openingFromPgn(g.pgn) : null,
    url: g.url,
    importedAt: Date.now(),
    oobChecked: false,
  };
}

/** Archive month URLs that can overlap [since, now]. */
export function archiveUrlsForWindow(archives: string[], sinceMs: number): string[] {
  // Archive URLs end in /games/YYYY/MM. Keep months >= the window start month.
  const since = new Date(sinceMs);
  const cutoff = since.getUTCFullYear() * 100 + (since.getUTCMonth() + 1);
  return archives.filter((url) => {
    const m = /\/games\/(\d{4})\/(\d{2})$/.exec(url);
    if (!m) return false;
    return Number(m[1]) * 100 + Number(m[2]) >= cutoff;
  });
}

/**
 * Fetch the user's games inside the shared sync window (15 days / 100 games),
 * oldest archive first. A 404 on the archives list = unknown username.
 */
export async function fetchChessComRecentGames(username: string): Promise<LichessGame[]> {
  const listRes = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
  );
  if (listRes.status === 404) throw new ChessComUserNotFoundError(username);
  if (!listRes.ok) throw new Error(`chess.com archives fetch failed: ${listRes.status}`);
  const { archives } = (await listRes.json()) as { archives: string[] };

  const sinceMs = Date.now() - SYNC_WINDOW_MS;
  const games: LichessGame[] = [];
  for (const url of archiveUrlsForWindow(archives, sinceMs)) {
    const res = await fetch(url);
    if (!res.ok) continue; // a missing month never aborts the whole sync
    const { games: raw } = (await res.json()) as { games: ChessComApiGame[] };
    for (const g of raw) {
      if (g.rules !== 'chess' || !g.pgn) continue; // skip variants + no-PGN records
      if (g.end_time * 1000 < sinceMs) continue;
      games.push(mapChessComGame(g, username));
      if (games.length >= SYNC_MAX_GAMES) return games;
    }
  }
  return games;
}

export class ChessComUserNotFoundError extends Error {
  constructor(username: string) {
    super(`chess.com user not found: ${username}`);
    this.name = 'ChessComUserNotFoundError';
  }
}

/** Public profile subset used by the Link confirmation step. */
export interface ChessComProfile {
  /** Canonical capitalization from chess.com (the typed name may differ). */
  username: string;
  name?: string;
  avatar?: string;
  joined: number; // epoch seconds
}

/**
 * Fetch a public profile for the link-time "is this you?" confirmation.
 * Returns null on 404 (unknown username — usually a typo).
 */
export async function fetchChessComProfile(username: string): Promise<ChessComProfile | null> {
  const res = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`chess.com profile fetch failed: ${res.status}`);
  const json = (await res.json()) as {
    username: string;
    name?: string;
    avatar?: string;
    joined: number;
  };
  return { username: json.username, name: json.name, avatar: json.avatar, joined: json.joined };
}
