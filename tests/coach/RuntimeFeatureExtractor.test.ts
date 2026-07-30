import { describe, expect, it } from 'vitest';
import { RuntimeFeatureExtractor } from '../../src/coach/features/RuntimeFeatureExtractor';

describe('RuntimeFeatureExtractor', () => {
  it('returns deterministic features for a valid FEN', async () => {
    const fx = new RuntimeFeatureExtractor();
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const a = await fx.extract(fen);
    const b = await fx.extract(fen);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.material.balance_cp).toBe(0);
    expect(a).toEqual(b);
  });

  it('returns null for invalid FEN', async () => {
    const fx = new RuntimeFeatureExtractor();
    await expect(fx.extract('not-a-fen')).resolves.toBeNull();
  });
});
