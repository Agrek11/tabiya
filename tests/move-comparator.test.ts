/**
 * Unit tests for compareMove.
 *
 * Three cases (Requirement 7.3 of phase-0a-skeleton):
 *   - correct: legal move, matches expected SAN
 *   - wrong:   legal move, but NOT the expected SAN
 *   - illegal: not a legal move at all
 *
 * Also verifies the caller-state-preservation contract:
 *   compareMove MUST NOT mutate the passed Chess instance, regardless of result.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import { compareMove } from '../src/drill/move-comparator';

describe('compareMove', () => {
  let chess: Chess;
  const STARTING_FEN =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  beforeEach(() => {
    chess = new Chess();
  });

  it('returns { kind: "correct" } when the attempted move matches expected SAN', () => {
    const result = compareMove(chess, 'e4', { from: 'e2', to: 'e4' });
    expect(result).toEqual({ kind: 'correct' });
  });

  it('returns { kind: "wrong" } with legalSan when the move is legal but does not match expected', () => {
    const result = compareMove(chess, 'e4', { from: 'd2', to: 'd4' });
    expect(result).toEqual({ kind: 'wrong', legalSan: 'd4' });
  });

  it('returns { kind: "illegal" } when the move is illegal', () => {
    // pawn cannot jump 3 squares
    const result = compareMove(chess, 'e4', { from: 'e2', to: 'e5' });
    expect(result).toEqual({ kind: 'illegal' });
  });

  it('does NOT mutate the chess instance on a correct move', () => {
    compareMove(chess, 'e4', { from: 'e2', to: 'e4' });
    expect(chess.fen()).toBe(STARTING_FEN);
  });

  it('does NOT mutate the chess instance on a wrong move', () => {
    compareMove(chess, 'e4', { from: 'd2', to: 'd4' });
    expect(chess.fen()).toBe(STARTING_FEN);
  });

  it('does NOT mutate the chess instance on an illegal move', () => {
    compareMove(chess, 'e4', { from: 'e2', to: 'e5' });
    expect(chess.fen()).toBe(STARTING_FEN);
  });
});
