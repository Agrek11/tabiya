/**
 * fenHash (Phase 2b) — TS mirror of the Python normalize+hash.
 *
 * The full Python⇄TS parity test requires `tests/fixtures/fen_hash_parity.json`
 * which is Phase 2a's task-7.2 deliverable. Until that fixture lands, these
 * tests cover the TS side independently:
 *
 *   - normalizeFen drops counters but keeps placement/side/castling/ep.
 *   - fenHash is deterministic (same input → same hex).
 *   - fenHash output is exactly 16 lowercase hex chars (sha1-16 contract).
 *   - Two FENs differing only in halfmove/fullmove counters hash equal
 *     (R5.2 — the central transposition contract).
 *
 * TODO(phase-2a): when `tests/fixtures/fen_hash_parity.json` lands, add a
 * test that loads the fixture and asserts each (fen → hash) pair matches.
 */

import { describe, expect, it } from 'vitest';
import { fenHash, normalizeFen } from '../src/chess/fenHash';

const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const STARTING_FEN_MID_GAME_COUNTERS =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 34';
const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

describe('normalizeFen', () => {
  it('keeps the first 4 fields', () => {
    expect(normalizeFen(STARTING_FEN)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    );
  });

  it('drops halfmove and fullmove counters (R5.2)', () => {
    expect(normalizeFen(STARTING_FEN)).toBe(
      normalizeFen(STARTING_FEN_MID_GAME_COUNTERS)
    );
  });

  it('preserves castling rights', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(normalizeFen(fen)).toContain('KQkq');
  });

  it('preserves en-passant target', () => {
    expect(normalizeFen(AFTER_E4)).toContain(' e3');
  });
});

describe('fenHash', () => {
  it('returns exactly 16 lowercase hex chars (sha1-16)', async () => {
    const h = await fenHash(STARTING_FEN);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic across calls', async () => {
    const a = await fenHash(STARTING_FEN);
    const b = await fenHash(STARTING_FEN);
    expect(a).toBe(b);
  });

  it('FENs differing only in counters hash equal (R5.2)', async () => {
    const a = await fenHash(STARTING_FEN);
    const b = await fenHash(STARTING_FEN_MID_GAME_COUNTERS);
    expect(a).toBe(b);
  });

  it('different positions hash differently', async () => {
    const a = await fenHash(STARTING_FEN);
    const b = await fenHash(AFTER_E4);
    expect(a).not.toBe(b);
  });
});
