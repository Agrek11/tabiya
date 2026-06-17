/**
 * SidecarFeatureExtractor — Phase 4b. Hash-keyed lookup over features.json:
 * hit, miss (off-book FEN), and schema-version-mismatch degrade. `fetch` is
 * stubbed directly (no msw in the repo).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fenHash } from '../../src/chess/fenHash';
import {
  SidecarFeatureExtractor,
  _resetFeaturesSidecarForTesting,
} from '../../src/coach/features/SidecarFeatureExtractor';
import type { PositionFeatures } from '../../src/coach/features/PositionFeatures';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function fakeFeatures(): PositionFeatures {
  // Minimal but type-complete; only identity (version) matters for the lookup.
  return {
    version: 2,
    material: { balance_cp: 0, imbalance: 'none', bishop_pair: { white: true, black: true } },
    pawns: {
      doubled: { white: [], black: [] },
      isolated: { white: [], black: [] },
      backward: { white: [], black: [] },
      passed: { white: [], black: [] },
      candidate_passers: { white: [], black: [] },
      islands: { white: 1, black: 1 },
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

async function stubSidecar(schemaVersion: number, withFen: boolean): Promise<void> {
  const index: Record<string, PositionFeatures> = {};
  if (withFen) index[await fenHash(FEN)] = fakeFeatures();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: schemaVersion,
        extractor_version: 2,
        generated_at: 'test',
        index,
      }),
    }),
  );
}

beforeEach(() => _resetFeaturesSidecarForTesting());
afterEach(() => {
  vi.unstubAllGlobals();
  _resetFeaturesSidecarForTesting();
});

describe('SidecarFeatureExtractor', () => {
  it('returns features for a known position', async () => {
    await stubSidecar(1, true);
    const result = await new SidecarFeatureExtractor().extract(FEN);
    expect(result?.version).toBe(2);
  });

  it('returns null for an off-book position not in the sidecar', async () => {
    await stubSidecar(1, false);
    const other = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1';
    expect(await new SidecarFeatureExtractor().extract(other)).toBeNull();
  });

  it('degrades to null on schema-version mismatch', async () => {
    await stubSidecar(999, true);
    expect(await new SidecarFeatureExtractor().extract(FEN)).toBeNull();
  });

  it('degrades to null when the sidecar fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await new SidecarFeatureExtractor().extract(FEN)).toBeNull();
  });
});
