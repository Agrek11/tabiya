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

import type { Chess } from 'chess.js';

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
  // TODO (you): implement per design AD3.
  //
  // Hint sequence (think before typing):
  //   1. Try the attempt on `chess` via chess.move(attempt). What does it return on illegal?
  //   2. If it succeeded, what field on the returned Move object holds SAN?
  //   3. After reading SAN, you MUST chess.undo() so the caller's board state is unchanged.
  //   4. Compare the SAN string equality. Return the right discriminated-union variant.
  //
  // Cold question before you write a line: WHY do we undo() unconditionally
  // even on a `correct` result? (Hint: think about who decides to re-apply.)
  throw new Error('compareMove: not implemented');
}
