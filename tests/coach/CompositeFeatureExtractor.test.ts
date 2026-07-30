import { describe, expect, it, vi } from 'vitest';
import { CompositeFeatureExtractor } from '../../src/coach/features/CompositeFeatureExtractor';
import type { FeatureExtractor } from '../../src/coach/features/FeatureExtractor';
import type { PositionFeatures } from '../../src/coach/features/PositionFeatures';

function fakeFeatures(version: number): PositionFeatures {
  return {
    version,
    material: { balance_cp: 0, imbalance: 'none', bishop_pair: { white: false, black: false } },
    pawns: {
      doubled: { white: [], black: [] },
      isolated: { white: [], black: [] },
      backward: { white: [], black: [] },
      passed: { white: [], black: [] },
      candidate_passers: { white: [], black: [] },
      islands: { white: 0, black: 0 },
      chains: { white: [], black: [] },
      majorities: { queenside: null, kingside: null, center: null },
      iqp: null,
      hanging_duo: null,
    },
    king_safety: {
      white: { castled: 'none', shield: 'n/a', adjacent_open_files: [], adjacent_half_open_files: [], king_zone_attackers: 0 },
      black: { castled: 'none', shield: 'n/a', adjacent_open_files: [], adjacent_half_open_files: [], king_zone_attackers: 0 },
    },
    center_space: {
      center_occupancy: {},
      center_attacks: { white: 0, black: 0 },
      space: { white: 0, black: 0 },
      locked_center: false,
    },
    files_diagonals: {
      open_files: [],
      half_open: { white: [], black: [] },
      rooks_on_open: { white: [], black: [] },
      rooks_on_half_open: { white: [], black: [] },
      rook_on_seventh: { white: [], black: [] },
      long_diagonals: {},
    },
    activity: {
      mobility: { white: {}, black: {} },
      outposts: { white: { occupied: [], available: [] }, black: { occupied: [], available: [] } },
      bad_bishop: { white: null, black: null },
      fianchetto: { white: null, black: null },
      trapped: { white: [], black: [] },
      undeveloped_minors: { white: 0, black: 0 },
      tempo: { side_to_move: 'white', development_lead: 'even' },
    },
    tactics_geometry: { pins: [], xrays: [], overloaded: [], discovered_candidates: [], en_prise: [] },
  };
}

describe('CompositeFeatureExtractor', () => {
  it('returns primary hit without calling fallback', async () => {
    const primary: FeatureExtractor = { extract: vi.fn().mockResolvedValue(fakeFeatures(1)) };
    const fallback: FeatureExtractor = { extract: vi.fn().mockResolvedValue(fakeFeatures(2)) };
    const fx = new CompositeFeatureExtractor(primary, fallback);
    const result = await fx.extract('fen');
    expect(result?.version).toBe(1);
    expect(fallback.extract).not.toHaveBeenCalled();
  });

  it('uses fallback when primary misses', async () => {
    const primary: FeatureExtractor = { extract: vi.fn().mockResolvedValue(null) };
    const fallback: FeatureExtractor = { extract: vi.fn().mockResolvedValue(fakeFeatures(2)) };
    const fx = new CompositeFeatureExtractor(primary, fallback);
    const result = await fx.extract('fen');
    expect(result?.version).toBe(2);
  });

  it('returns null when both extractors fail', async () => {
    const primary: FeatureExtractor = { extract: vi.fn().mockRejectedValue(new Error('x')) };
    const fallback: FeatureExtractor = { extract: vi.fn().mockRejectedValue(new Error('y')) };
    const fx = new CompositeFeatureExtractor(primary, fallback);
    await expect(fx.extract('fen')).resolves.toBeNull();
  });
});
