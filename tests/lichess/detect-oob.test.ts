/**
 * OOB detector golden suite — Phase 3 R8 AC3.
 *
 * Five spec-mandated fixtures (in-book / user OOB at ply 6 / opponent OOB /
 * no picks / transposition) plus determinism + grace-walk edges. PGNs are
 * generated through chess.js so every fixture is guaranteed legal.
 */

import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { detectOOB } from '../../src/lib/lichess/detect-oob';
import { fenHash } from '../../src/chess/fenHash';
import type { TranspositionSidecar } from '../../src/types/keySquares';
import type { LichessGame, PickedLine } from '../../src/lib/lichess/types';

const NOW = 1_750_000_000_000;

function pgnOf(moves: string[]): string {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.pgn();
}

function gameOf(moves: string[], userColor: 'white' | 'black' = 'white'): LichessGame {
  return {
    id: 'testgame',
    createdAt: NOW,
    whiteUsername: 'me',
    blackUsername: 'them',
    userColor,
    result: '*',
    pgn: pgnOf(moves),
    opening: { eco: 'C50', name: 'Italian Game', ply: 5 },
    importedAt: NOW,
    oobChecked: false,
  };
}

/** Build a Phase-2-shaped sidecar from picked lines (hash of every position). */
async function sidecarOf(lines: PickedLine[]): Promise<TranspositionSidecar> {
  const index: Record<string, string[]> = {};
  for (const line of lines) {
    const board = new Chess();
    for (const san of line.plies) {
      board.move(san);
      const h = await fenHash(board.fen());
      index[h] = [...new Set([...(index[h] ?? []), line.id])].sort();
    }
  }
  return {
    schema_version: 1,
    generated_at: 'test',
    fen_hash_algo: 'sha1-16',
    fen_normalization: 'drop-counters',
    index,
  };
}

const ITALIAN: PickedLine = {
  id: 'italian-main',
  color: 'white',
  plies: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6'],
};
const CARO_WHITE: PickedLine = {
  id: 'caro-advance-w',
  color: 'white',
  plies: ['e4', 'c6', 'd4', 'd5'],
};

describe('detectOOB — golden games', () => {
  it('1. game that stays entirely in book → no event', async () => {
    const event = await detectOOB({
      game: gameOf([...ITALIAN.plies, 'O-O', 'd6']),
      pickedLines: [ITALIAN],
      now: () => NOW,
    });
    expect(event).toBeNull();
  });

  it('2. user diverges at ply 6 → event with expected SANs + fen before move', async () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6'];
    const event = await detectOOB({
      game: gameOf(moves),
      pickedLines: [ITALIAN],
      now: () => NOW,
    });
    const boardBefore = new Chess();
    for (const m of moves.slice(0, 6)) boardBefore.move(m);

    expect(event).toEqual({
      gameId: 'testgame',
      plyIndex: 6,
      playedSAN: 'c3',
      expectedSANs: ['d3'],
      color: 'white',
      fenAtOOB: boardBefore.fen(),
      openingEco: 'C50',
      openingName: 'Italian Game',
      lineId: 'italian-main',
      detectedAt: NOW,
    });
  });

  it('3. opponent leaves book → no event for the opponent move', async () => {
    const event = await detectOOB({
      game: gameOf(['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4']),
      pickedLines: [ITALIAN],
      now: () => NOW,
    });
    expect(event).toBeNull();
  });

  it('4. no picked lines for user color → no event (degenerate case)', async () => {
    const event = await detectOOB({
      game: gameOf(['e4', 'e5', 'Nf3', 'Nc6'], 'black'),
      pickedLines: [ITALIAN], // white-only prep, user is black
      now: () => NOW,
    });
    expect(event).toBeNull();
  });

  it('5. transposition (1.d4 c6 2.e4 d5 into the 1.e4 c6 2.d4 d5 Caro) → in book with index', async () => {
    const game = gameOf(['d4', 'c6', 'e4', 'd5', 'e5', 'Bf5']);
    const index = await sidecarOf([CARO_WHITE]);

    const withIndex = await detectOOB({
      game,
      pickedLines: [CARO_WHITE],
      transpositionIndex: index,
      now: () => NOW,
    });
    expect(withIndex).toBeNull();

    // Without the index the move-order transposition can't be rescued — but the
    // divergence is at move 1 (ply 0), now suppressed as noise (MIN_OOB_PLY), so
    // there is still no event.
    const withoutIndex = await detectOOB({
      game,
      pickedLines: [CARO_WHITE],
      now: () => NOW,
    });
    expect(withoutIndex).toBeNull();
  });

  it('6. user diverges at move 1 → suppressed as noise (MIN_OOB_PLY)', async () => {
    // White prep is the Italian (1.e4) but the user opens 1.d4 — leaving prep at
    // move 1 is just a different opening choice, not a mid-theory leak.
    const event = await detectOOB({
      game: gameOf(['d4', 'd5', 'c4', 'e6']),
      pickedLines: [ITALIAN],
      now: () => NOW,
    });
    expect(event).toBeNull();
  });
});

describe('detectOOB — determinism + attribution', () => {
  const SHORT: PickedLine = { id: 'a-short', color: 'white', plies: ['e4', 'e5', 'Nf3'] };
  const LONG: PickedLine = { id: 'b-long', color: 'white', plies: ['e4', 'e5', 'Bc4', 'Bc5'] };

  it('expectedSANs are deduped + sorted; lineId is the deepest alive line', async () => {
    // Diverge at ply 2 with both lines alive at depth 2 (Qh5 in neither).
    const event = await detectOOB({
      game: gameOf(['e4', 'e5', 'Qh5']),
      pickedLines: [SHORT, LONG],
      now: () => NOW,
    });
    expect(event!.expectedSANs).toEqual(['Bc4', 'Nf3']);
    // Equal depth → lex tiebreak on id.
    expect(event!.lineId).toBe('a-short');
  });

  it('same input twice → identical event (R5 AC10)', async () => {
    const input = {
      game: gameOf(['e4', 'e5', 'Qh5']),
      pickedLines: [SHORT, LONG],
      now: () => NOW,
    };
    expect(await detectOOB(input)).toEqual(await detectOOB(input));
  });

  it('grace window expiring still reports the ORIGINAL divergence ply', async () => {
    const index = await sidecarOf([ITALIAN]);
    // Follows the Italian for two plies, then diverges at ply 2 (Qh5, move 2 so
    // past MIN_OOB_PLY); no transposition rescues it, the grace window expires,
    // and the original divergence stands.
    const event = await detectOOB({
      game: gameOf(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'g6']),
      pickedLines: [ITALIAN],
      transpositionIndex: index,
      now: () => NOW,
    });
    expect(event!.plyIndex).toBe(2);
    expect(event!.playedSAN).toBe('Qh5');
  });
});
