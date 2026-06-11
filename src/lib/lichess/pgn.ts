/**
 * PGN → SAN ply array — thin chess.js wrapper (design module map).
 *
 * Article 9 — everything downstream of this function speaks SAN. chess.js
 * strips comments, NAGs, and clock annotations during `loadPgn`; `history()`
 * returns clean SAN. Throws on malformed PGN — callers treat that as
 * "mark checked, no event, warn" (design failure-modes table).
 */

import { Chess } from 'chess.js';

export function parsePgnToSan(pgn: string): string[] {
  const chess = new Chess();
  chess.loadPgn(pgn); // throws on malformed input
  return chess.history();
}
