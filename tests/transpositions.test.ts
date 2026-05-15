/**
 * Phase 2a — FEN-hash parity contract test (Python ⇄ TypeScript).
 *
 * Consumes the shared fixture `tests/fixtures/fen_hash_parity.json`, which
 * also drives `tests/python/transpositions/test_transposition.py`. Cross-
 * language hash drift fails CI in both suites simultaneously — task-7.2.
 *
 * Article 14 (type discipline): no `any`. The fixture's JSON shape is typed
 * inline to make schema drift a TS error.
 */

import fixture from './fixtures/fen_hash_parity.json' assert { type: 'json' };
import { describe, expect, it } from 'vitest';
import { fenHash, normalizeFen } from '../src/chess/fenHash';

type ParityEntry = {
  fen: string;
  normalized: string;
  hash: string;
};

type ParityFixture = {
  algo: string;
  normalization: string;
  fixtures: ParityEntry[];
};

const parity = fixture as ParityFixture;

describe('FEN-hash parity (Python ⇄ TS)', () => {
  it('fixture declares the expected algorithm + normalization rule', () => {
    expect(parity.algo).toBe('sha1-16');
    expect(parity.normalization).toBe('drop-counters');
    expect(parity.fixtures.length).toBeGreaterThanOrEqual(5);
  });

  it.each(parity.fixtures)(
    'normalizeFen matches fixture for "%s"',
    (entry) => {
      expect(normalizeFen(entry.fen)).toBe(entry.normalized);
    },
  );

  it.each(parity.fixtures)(
    'fenHash matches fixture for "%s"',
    async (entry) => {
      const got = await fenHash(entry.fen);
      expect(got).toBe(entry.hash);
    },
  );
});
