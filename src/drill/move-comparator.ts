/**
 * Pure move comparator — no React, no hooks, no side effects on caller's state.
 *
 * Compares a player's attempted move (in board-coordinate form: from/to/promotion)
 * against the next expected move in a hardcoded line (in SAN format).
 *
 * Constitution Article 9: SAN is the cross-boundary format for all chess data.
 * Constitution Article 14: type hints + strict mode mandatory.
 *
 * Design decisions (see specs/phase-0a-skeleton/design.md AD3, AD5):
 *   - Returns a discriminated union, never throws.
 *   - Always restores chess.js state via undo() before returning, so the caller
 *     decides whether to re-apply on `correct`.
 *   - Caller passes a Chess instance — we do NOT construct one internally
 *     (avoids allocation + lets caller hold the canonical board state).
 */

import type { Chess, Move } from 'chess.js';

export type MoveAttempt = {
  from: string;
  to: string;
  promotion?: string;
};

export type CompareResult =
  | { kind: 'correct' }
  | { kind: 'wrong'; legalSan: string }
  | { kind: 'illegal' };

export function compareMove(
  chess: Chess,
  expectedSan: string,
  attempt: MoveAttempt
): CompareResult {
  let move: Move;
  try {
    move = chess.move(attempt);
  } catch {
    return { kind: 'illegal' };
  }

  const legalSan = move.san;
  chess.undo();

  if (legalSan === expectedSan) {
    return { kind: 'correct' };
  }
  return { kind: 'wrong', legalSan };
}
